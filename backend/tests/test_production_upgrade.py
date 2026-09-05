import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from scripts.production_upgrade import fingerprint


def connection(rows):
    return SimpleNamespace(
        dialect=SimpleNamespace(identifier_preparer=SimpleNamespace(quote=lambda value: value)),
        execute=lambda statement: SimpleNamespace(mappings=lambda: iter(rows)),
    )


class BackupFingerprintTest(unittest.TestCase):
    def test_timestamps_compare_as_instants_across_timezones(self):
        utc = datetime(2026, 9, 4, 12, tzinfo=timezone.utc)
        india = utc.astimezone(timezone(timedelta(hours=5, minutes=30)))
        self.assertEqual(fingerprint(connection([{"id": 1, "created_at": utc}]), ["users"]),
                         fingerprint(connection([{"id": 1, "created_at": india}]), ["users"]))

    def test_password_changes_are_detected(self):
        self.assertNotEqual(fingerprint(connection([{"id": 1, "hashed_password": "test-old"}]), ["users"]),
                            fingerprint(connection([{"id": 1, "hashed_password": "test-new"}]), ["users"]))

    def test_only_expected_migration_fields_are_excluded(self):
        before = {"id": 1, "name": "Isolated test", "department": " cs "}
        after = {**before, "department": "CS", "institution_id": 1}
        self.assertEqual(fingerprint(connection([before]), ["users"]), fingerprint(connection([after]), ["users"]))
        self.assertNotEqual(fingerprint(connection([before]), ["users"]),
                            fingerprint(connection([{**after, "name": "Changed"}]), ["users"]))

    def test_row_order_does_not_change_backup_comparison(self):
        rows = [{"id": 1}, {"id": 2}]
        self.assertEqual(fingerprint(connection(rows), ["users"]), fingerprint(connection(rows[::-1]), ["users"]))


if __name__ == "__main__":
    unittest.main()
