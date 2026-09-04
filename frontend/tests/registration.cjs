// Intercepted API fixtures only; never creates real accounts.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const base = process.env.LMS_TEST_URL || 'http://localhost:5173';
    await page.goto(base + '/register');
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(await page.getByRole('link', { name: 'Create an account' }).count(), 0);
    const admin = { id: 100, name: 'Test Admin', email: 'admin@college.edu', role: 'admin', department: 'CS' };
    let submitted, count = 0, succeed = false;
    await page.route('**/*', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (pathname === '/auth/me') return route.fulfill({ json: admin, headers });
      if (pathname === '/users/') return route.fulfill({ json: [admin], headers });
      if (pathname === '/courses/') return route.fulfill({ json: [], headers });
      if (!['/auth/register', '/auth/register-faculty'].includes(pathname)) return route.continue();
      const faculty = pathname === '/auth/register-faculty';
      count++;
      assert.equal(request.headers().authorization, 'Bearer isolated-browser-test');
      submitted = request.postDataJSON();
      return route.fulfill({ status: succeed ? 201 : 400, headers,
        json: succeed ? { id: faculty ? 102 : 101, name: submitted.name, email: submitted.email, department: submitted.department, role: faculty ? 'faculty' : 'student' }
          : { detail: 'Email already registered' } });
    });
    await page.evaluate(() => localStorage.setItem('lms_token', 'isolated-browser-test'));
    await page.goto(base + '/');
    const nav = page.getByRole('navigation', { name: 'Dashboard sections' });
    await nav.getByRole('link', { name: 'Register student', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/admin/register-student');
    assert.equal(await page.locator('#register-faculty').count(), 0);
    const form = page.locator('#register-student');
    await form.getByLabel('Full name').fill('Browser Test');
    await form.getByLabel('College email').fill('browser-test@college.edu');
    await form.getByLabel('Department').fill('Computer Science');
    await form.getByLabel('Password', { exact: true }).fill('Test-password-123');
    await form.getByLabel('Confirm password').fill('Different-password-123');
    await form.getByRole('button').click();
    await form.getByRole('alert').filter({ hasText: 'Passwords do not match.' }).waitFor();
    assert.equal(count, 0);
    await form.getByLabel('Confirm password').fill('Test-password-123');
    await form.getByRole('button').click();
    await form.getByRole('alert').filter({ hasText: 'Email already registered' }).waitFor();
    assert.equal('role' in submitted, false);
    succeed = true;
    await form.getByRole('button').click();
    await form.getByRole('status').filter({ hasText: 'Student account created' }).waitFor();
    assert.equal(await form.getByLabel('Password', { exact: true }).inputValue(), '');
    await nav.getByRole('link', { name: 'Users', exact: true }).click();
    await page.locator('#users').getByText('browser-test@college.edu', { exact: true }).waitFor();
    await nav.getByRole('link', { name: 'Create faculty', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/admin/register-faculty');
    assert.equal(await page.locator('#register-student').count(), 0);
    const facultyForm = page.locator('#register-faculty');
    await facultyForm.getByLabel('Full name').fill('Faculty Test');
    await facultyForm.getByLabel('College email').fill('faculty-test@hitam.org');
    await facultyForm.getByLabel('Department').fill('Computer Science');
    await facultyForm.getByLabel('Password', { exact: true }).fill('Test-password-123');
    await facultyForm.getByLabel('Confirm password').fill('Different-password-123');
    const before = count;
    await facultyForm.getByRole('button').click();
    await facultyForm.getByRole('alert').filter({ hasText: 'Passwords do not match.' }).waitFor();
    assert.equal(count, before);
    await facultyForm.getByLabel('Confirm password').fill('Test-password-123');
    succeed = false;
    await facultyForm.getByRole('button').click();
    await facultyForm.getByRole('alert').filter({ hasText: 'Email already registered' }).waitFor();
    assert.equal('role' in submitted, false);
    succeed = true;
    await facultyForm.getByRole('button').click();
    await facultyForm.getByRole('status').filter({ hasText: 'Faculty account created' }).waitFor();
    assert.equal(await facultyForm.getByLabel('Password', { exact: true }).inputValue(), '');
    await nav.getByRole('link', { name: 'Users', exact: true }).click();
    const facultyRow = page.locator('#users tr').filter({ hasText: 'faculty-test@hitam.org' });
    await facultyRow.getByText('faculty', { exact: true }).waitFor();
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const label of ['Register student', 'Create faculty']) {
        if (viewport.width < 600) await page.getByRole('button', { name: 'Toggle navigation' }).click();
        await nav.getByRole('link', { name: label, exact: true }).click();
        const box = await page.locator('main form').boundingBox();
        assert.ok(box.width > 0 && box.x + box.width <= viewport.width + 1);
      }
    }
    console.log('PASS login-only public UI, admin form, authorization, validation, errors, directory update, and responsive sizing');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
