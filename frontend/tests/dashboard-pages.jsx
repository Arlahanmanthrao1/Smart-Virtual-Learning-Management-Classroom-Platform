import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route, matchRoutes } from 'react-router-dom';
import DashboardShell from '../src/components/dashboard/DashboardShell';
import { dashboardNavigation, dashboardPath, isDashboardPage } from '../src/components/dashboard/navigation';

let count = 0;
for (const [role, items] of Object.entries(dashboardNavigation)) {
  const pattern = `/${role}/:page?`;
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assert.equal(dashboardPath(role), `/${role}`);
  for (const item of items) {
    const pathname = dashboardPath(role, item.id);
    const route = matchRoutes([{ path: pattern }], pathname);
    assert.ok(route, `Direct route ${pathname}`);
    assert.equal(route[0].params.page || 'dashboard', item.id);
    assert.ok(isDashboardPage(role, item.id));
    const html = renderToStaticMarkup(
      <StaticRouter location={pathname}>
        <Routes><Route path={pattern} element={
          <DashboardShell user={{ name: 'Isolated Test', role }} title="LMS" roleLabel={role} onLogout={() => {}}>
            <p>Current page content</p>
          </DashboardShell>
        } /></Routes>
      </StaticRouter>
    );
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1, 'One active sidebar item');
    assert.match(html, new RegExp(`aria-current="page"[^>]*href="${pathname}"`));
    for (const other of items) assert.ok(html.includes(`href="${dashboardPath(role, other.id)}"`));
    assert.equal(html.includes('href="#'), false, 'No scroll-only sidebar or brand links');
    if (item.id !== 'dashboard') assert.ok(html.includes(`<h1>${item.label}</h1>`));
    assert.ok(html.includes('Current page content'));
    count++;
  }
  assert.equal(isDashboardPage(role, 'not-a-page'), false);
  assert.equal(matchRoutes([{ path: pattern }], `/${role}/courses/extra`), null);
  for (const otherRole of Object.keys(dashboardNavigation).filter(value => value !== role)) {
    assert.equal(matchRoutes([{ path: pattern }], `/${otherRole}/register-faculty`), null);
  }
}
assert.equal(isDashboardPage('student', 'register-faculty'), false);
assert.equal(isDashboardPage('faculty', 'register-student'), false);
assert.equal(isDashboardPage('unknown'), false);
console.log(`PASS ${count} page URLs, sidebar links, active state, headings, and role-specific route matching`);
