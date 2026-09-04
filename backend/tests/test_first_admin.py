import unittest
from unittest.mock import MagicMock

import bcrypt
from scripts.create_first_admin import create_first_admin, validate_database_url


class FirstAdminTest(unittest.TestCase):
    def connection(self, results):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.side_effect = results
        return connection, cursor

    def test_creates_admin_with_hash_not_plaintext(self):
        connection, cursor = self.connection([None, None, (42,)])
        result = create_first_admin(connection, "Administrator", "test@example.invalid", "Test-password-123")
        self.assertEqual(result, 42)
        query, values = cursor.execute.call_args.args
        self.assertIn("'admin'", query)
        self.assertEqual(values[:2], ("Administrator", "test@example.invalid"))
        self.assertTrue(bcrypt.checkpw(b"Test-password-123", values[2].encode()))

    def test_existing_admin_or_email_is_never_overwritten(self):
        for results in [[(1,)], [None, (2,)]]:
            connection, cursor = self.connection(results)
            with self.assertRaises(ValueError):
                create_first_admin(connection, "Administrator", "test@example.invalid", "Test-password-123")
            self.assertFalse(any("INSERT" in call.args[0] for call in cursor.execute.call_args_list))

    def test_weak_password_is_rejected_before_query(self):
        connection, cursor = self.connection([])
        for password in ["short", "x" * 73]:
            with self.assertRaises(ValueError):
                create_first_admin(connection, "Administrator", "test@example.invalid", password)
        cursor.execute.assert_not_called()

    def test_only_neon_postgres_url_accepted(self):
        for url in ["sqlite:///lms.db", "https://example.com", "postgresql://localhost/lms", "postgresql://x.neon.tech.evil.test/lms"]:
            with self.assertRaises(ValueError):
                validate_database_url(url)

    def test_accepts_neon_copy_formats_without_changing_credentials(self):
        url = "postgresql://test:encoded%40password@ep-test-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        for value in [url, f"psql '{url}'", f'psql "{url}"', f"DATABASE_URL='{url}'", f'"{url}"', f"  {url}\n"]:
            self.assertEqual(validate_database_url(value), url)

    def test_rejects_empty_incomplete_or_multiple_urls_without_leaking(self):
        values = ["", "\x16", "postgresql://test:PRIVATE_PASSWORD@bad-host/lms",
                  "postgresql://test@ep-test.neon.tech/neondb", "postgresql://test:PRIVATE_PASSWORD@ep-test.neon.tech/",
                  "postgresql://test:PRIVATE_PASSWORD@[bad/neondb",
                  "postgresql://u:p@ep-one.neon.tech/db postgresql://u:p@ep-two.neon.tech/db"]
        for value in values:
            with self.assertRaises(ValueError) as caught:
                validate_database_url(value)
            self.assertNotIn("PRIVATE_PASSWORD", str(caught.exception))
