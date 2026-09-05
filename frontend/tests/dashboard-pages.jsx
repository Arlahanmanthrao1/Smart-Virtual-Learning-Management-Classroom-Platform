import assert from 'node:assert/strict';
import { CalendarView } from '../src/pages/CalendarPage';
import { CourseTypeField, CreateAssignmentForm, CreateQuizForm } from '../src/pages/FacultyDashboard';
import { courseCategory } from '../src/pages/StudentDashboard';
import { ScheduleForm, ScheduledClassList } from '../src/pages/SchedulePage';
import { ClassHistory, nextScheduledPlan, shouldShowCourseHero } from '../src/pages/FacultyCoursePage';
import { studentMaterialGroups } from '../src/pages/StudentCoursePage';
import { dayKey, groupEvents, monthDays, monthRange } from '../src/components/dashboard/calendarDates';
import { institutionHost, institutionHeaders } from '../src/api/institutionHost';
import { apiFetch, login as requestLogin, createFaculty } from '../src/api/client';
import { brand, BrandLogo, pageTitle } from '../src/branding/Brand';
import Login from '../src/pages/login';
import GoogleSignIn, { loadGoogleIdentity } from '../src/components/GoogleSignIn';
import { AuthProvider } from '../src/context/AuthContext';
import InstitutionRegistration from '../src/pages/InstitutionRegistration';
import AccountRegistrationForm from '../src/components/dashboard/AccountRegistrationForm';
import AccountEditor from '../src/components/dashboard/AccountEditor';
import ProgrammingAssessmentForm from '../src/components/dashboard/ProgrammingAssessmentForm';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route, matchRoutes } from 'react-router-dom';
import DashboardShell from '../src/components/dashboard/DashboardShell';
import { dashboardNavigation, dashboardPath, isDashboardPage, studentPortalSections, studentSectionForPage } from '../src/components/dashboard/navigation';

let count = 0;
assert.ok(isDashboardPage('student', 'timetable'));
assert.equal(isDashboardPage('student', 'calendar'), false);
for (const role of ['faculty', 'hod']) assert.ok(isDashboardPage(role, 'calendar'));
assert.equal(isDashboardPage('admin', 'calendar'), false);
assert.equal(monthDays(new Date(2024, 1, 1)).length, 35);
assert.equal(monthDays(new Date(2026, 1, 1)).length, 35);
assert.equal(monthDays(new Date(2026, 2, 1)).length, 42);
const range = monthRange(new Date(2026, 11, 15));
assert.equal(dayKey(new Date(range.start)), '2026-12-01');
assert.equal(dayKey(new Date(range.end)), '2027-01-01');
const calendarProps = { month: new Date(2026, 8, 1), selected: new Date(2026, 8, 4), events: [], loading: false, error: '', onMonth() {}, onSelect() {}, onRetry() {}, role: 'student' };
assert.ok(renderToStaticMarkup(<CreateAssignmentForm courses={[]} onCreated={() => {}} />).includes('type="datetime-local"'));
const courseTypeField = renderToStaticMarkup(<CourseTypeField value="academic" onChange={() => {}} />);
assert.ok(courseTypeField.includes('Course type') && courseTypeField.includes('Academic') && courseTypeField.includes('Non-Academic'));
assert.equal(courseCategory({course_type:'non_academic'}), 'non_academic');
assert.equal(courseCategory({course_type:'academic'}), 'academic');
assert.equal(courseCategory({}), 'academic');
const fixedCourse = {id:7,code:'C7',name:'Specific course'};
const fixedAssignment = renderToStaticMarkup(<CreateAssignmentForm courses={[fixedCourse]} fixedCourse={fixedCourse} onCreated={() => {}} />);
assert.ok(fixedAssignment.includes('C7 · Specific course'));
assert.ok(!fixedAssignment.includes('<select'));
const fixedQuiz = renderToStaticMarkup(<CreateQuizForm courses={[fixedCourse]} fixedCourse={fixedCourse} onCreated={() => {}} />);
assert.ok(fixedQuiz.includes('C7 · Specific course'));
assert.ok(!fixedQuiz.includes('<select'));
assert.ok(!dashboardNavigation.faculty.some(item => ['assignments','quizzes'].includes(item.id)));
const scheduleForm = renderToStaticMarkup(<StaticRouter><ScheduleForm courses={[{id:1,code:'T1',name:'Test course'}]} onSubmit={() => {}} busy={false} /></StaticRouter>);
assert.ok(scheduleForm.includes('type="datetime-local"') && scheduleForm.includes('Students can join only after'));
const fixedSchedule = renderToStaticMarkup(<StaticRouter><ScheduleForm courses={[fixedCourse]} fixedCourse={fixedCourse} onSubmit={() => {}} busy={false} /></StaticRouter>);
assert.ok(fixedSchedule.includes('C7 · Specific course') && !fixedSchedule.includes('<select'));
const scheduleList = renderToStaticMarkup(<StaticRouter><ScheduledClassList plans={[{id:1,status:'scheduled',title:'Test class',course_code:'T1',course_name:'Test course',starts_at:'2030-01-01T10:00:00Z'}]} busy={false} onStart={() => {}} onCancel={() => {}} /></StaticRouter>);
assert.ok(scheduleList.includes('Start class') && scheduleList.includes('Cancel schedule'));
const endedScheduleList = renderToStaticMarkup(<StaticRouter><ScheduledClassList plans={[{id:2,status:'ended',title:'Ended class',course_code:'T1',course_name:'Test course',starts_at:'2030-01-01T10:00:00Z'}]} busy={false} onStart={() => {}} onCancel={() => {}} /></StaticRouter>);
assert.ok(!endedScheduleList.includes('Start class') && !endedScheduleList.includes('Rejoin class'));
const classHistory = renderToStaticMarkup(<ClassHistory sessions={[{id:2,scheduled_at:'2030-01-01T10:00:00Z',ended_at:'2030-01-01T11:15:00Z'}]} />);
assert.ok(classHistory.includes('Class history') && classHistory.includes('75 minutes'));
assert.ok(!classHistory.includes('Start class') && !classHistory.includes('Join now') && !classHistory.includes('Rejoin'));
assert.equal(shouldShowCourseHero([]), true);
assert.equal(shouldShowCourseHero([{id:1,ended_at:null}]), true);
assert.equal(shouldShowCourseHero([{id:1,ended_at:'2030-01-01T11:15:00Z'}]), false);
assert.equal(shouldShowCourseHero([{id:1,ended_at:'2030-01-01T11:15:00Z'},{id:2,ended_at:null}]), true);
const scheduledPlans = [{id:2,status:'scheduled',starts_at:'2030-01-02T10:00:00Z'},{id:1,status:'scheduled',starts_at:'2030-01-01T10:00:00Z'},{id:3,status:'live',starts_at:'2029-01-01T10:00:00Z'}];
assert.equal(nextScheduledPlan(scheduledPlans).id, 1);
assert.equal(shouldShowCourseHero([{id:1,ended_at:'2030-01-01T11:15:00Z'}], scheduledPlans), true);
const calendarHtml = props => renderToStaticMarkup(<StaticRouter><CalendarView {...calendarProps} {...props} /></StaticRouter>);
assert.ok(calendarHtml().includes('No dated events this month.'));
assert.ok(calendarHtml().includes('Previous month'));
assert.ok(calendarHtml().includes('Daily agenda'));
assert.ok(!calendarHtml({loading: true}).includes('No dated events this month.'));
assert.ok(calendarHtml({error: 'Test load failure'}).includes('role="alert"'));
const isolatedEvent = {id: 'assignment-1', kind: 'assignment', title: '<script>test</script>', course_code: 'TEST', course_name: 'Test course', starts_at: new Date(2026, 8, 4, 10).toISOString()};
assert.equal(groupEvents([isolatedEvent])['2026-09-04'].length, 1);
assert.ok(calendarHtml({events: [isolatedEvent]}).includes('&lt;script&gt;'));
assert.ok(calendarHtml({events: [isolatedEvent]}).includes('href="/student/academic-assignments"'));
assert.ok(calendarHtml({events: [isolatedEvent], role: 'hod'}).includes('href="/hod/courses"'));
assert.ok(!calendarHtml({events: [isolatedEvent], role: 'hod'}).includes('href="/hod/assignments"'));
const plannedEvent = {...isolatedEvent,id:'scheduled-1',kind:'class',status:'scheduled',title:'Planned class'};
assert.ok(calendarHtml({events:[plannedEvent],role:'faculty'}).includes('Manage schedule'));
assert.ok(calendarHtml({events:[plannedEvent],role:'faculty'}).includes('href="/faculty/schedule"'));
console.log('PASS calendar dates, month/year boundaries, empty/loading/error states, escaped content and role links');
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
    assert.ok(html.includes('id="portal-navigation"'));
    assert.ok(html.includes('aria-controls="portal-navigation"'));
    assert.ok(html.includes('aria-label="Close left menu"'));
    assert.ok(html.includes('sidebar-collapse-toggle'));
    assert.ok(!html.includes('mobile-menu'));
    assert.match(html, new RegExp(`aria-current="page"[^>]*href="${pathname}"`));
    const expectedSidebarItems = role === 'student' ? studentSectionForPage(item.id).items : items;
    for (const other of expectedSidebarItems) assert.ok(html.includes(`href="${dashboardPath(role, other.id)}"`));
    if (role === 'student') {
      for (const section of studentPortalSections) {
        assert.ok(html.includes(`href="${dashboardPath(role, section.entry)}"`));
        assert.ok(html.includes(`>${section.label}</a>`));
      }
      assert.ok(html.includes(`>${studentSectionForPage(item.id).label}</span>`));
    }
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
const facultyCourseRoute = matchRoutes([{path:'/faculty/courses/:courseId'}], '/faculty/courses/17');
assert.equal(facultyCourseRoute[0].params.courseId, '17');
assert.equal(matchRoutes([{path:'/faculty/courses/:courseId'}], '/student/courses/17'), null);
const studentCourseRoute = matchRoutes([{path:'/student/courses/:courseId'}], '/student/courses/17');
assert.equal(studentCourseRoute[0].params.courseId, '17');
assert.equal(matchRoutes([{path:'/student/courses/:courseId'}], '/faculty/courses/17'), null);
const groupedStudentMaterials = studentMaterialGroups([
  {id:1,material_type:'notes'}, {id:2,material_type:'pyq'}, {id:3,material_type:'exam'},
]);
assert.deepEqual(groupedStudentMaterials.notes.map(item => item.id), [1]);
assert.deepEqual(groupedStudentMaterials.pyqs.map(item => item.id), [2]);
assert.deepEqual(groupedStudentMaterials.other.map(item => item.id), [3]);
console.log('PASS separate student course route and course-specific notes, PYQ and other-material grouping');
const programmingRoute = matchRoutes([{path:'/student/programming-assessments/:assessmentId'}], '/student/programming-assessments/21');
assert.equal(programmingRoute[0].params.assessmentId, '21');
assert.ok(dashboardNavigation.student.some(item => item.id === 'programming-assessments'));
const programmingBuilder = renderToStaticMarkup(<ProgrammingAssessmentForm course={{id:7,name:'Specific course'}} onCreated={() => {}} />);
assert.ok(programmingBuilder.includes('Publish programming assessment'));
assert.ok(programmingBuilder.includes('Hide this test case from students'));
assert.ok(programmingBuilder.includes('Python 3') && programmingBuilder.includes('JavaScript'));
console.log('PASS programming-assessment route, navigation and faculty builder rendering');
console.log(`PASS ${count} page URLs, sidebar links, active state, headings, and role-specific route matching`);
const onboarding = renderToStaticMarkup(<StaticRouter location="/register-institution"><InstitutionRegistration /></StaticRouter>);
for (const text of ['Institution details', 'Administrator profile', 'Official institution email', 'Logo', 'Create institution and administrator']) {
  assert.ok(onboarding.toLowerCase().includes(text.toLowerCase()), text);
}
assert.ok(onboarding.includes('minLength="12"'));
assert.ok(onboarding.includes('href="/login"'));
assert.ok(onboarding.includes('not automatically verified'));
assert.ok(onboarding.includes('type="file"'));
assert.ok(onboarding.includes('accept="image/png,image/jpeg,image/webp"'));
assert.ok(onboarding.includes('Choose logo image'));
assert.ok(onboarding.includes('Or use a hosted HTTPS logo URL'));
for (const accountType of ['student', 'faculty', 'hod']) {
  const html = renderToStaticMarkup(<AccountRegistrationForm accountType={accountType} departments={[{id: 1, name: 'Isolated test department'}]} onCreated={() => {}} />);
  assert.ok(html.includes('<select') && html.includes('Isolated test department'));
  assert.ok(html.includes('type="password"'));
  assert.ok(html.includes(`id="register-${accountType}"`));
  if (accountType === 'hod') assert.ok(html.includes('cannot administer accounts'));
}
const emptyForm = renderToStaticMarkup(<AccountRegistrationForm accountType="hod" departments={[]} onCreated={() => {}} />);
assert.ok(emptyForm.includes('disabled=""'));
assert.ok(emptyForm.includes('Create a department first'));
const editor = renderToStaticMarkup(<AccountEditor account={{id: 1, name: 'Isolated test', role: 'hod', email: 'test@example.com', department: 'CS'}} departments={[{id:1,name:'CS'}]} onSaved={() => {}} onCancel={() => {}} />);
assert.ok(editor.includes('Save account'));
assert.ok(!editor.includes('name="role"') && !editor.includes('name="institution_id"'));
console.log('PASS institution onboarding, role-specific account forms, department selection and safe account editor rendering');
assert.equal(brand.name, 'EKEEKRTA');
assert.equal(pageTitle('Sign in'), 'Sign in · EKEEKRTA');
assert.equal(pageTitle('Courses', 'Test Institution'), 'Courses · Test Institution · EKEEKRTA');
assert.equal(pageTitle('EKEEKRTA'), 'EKEEKRTA');
const logo = renderToStaticMarkup(<BrandLogo />);
assert.ok(logo.includes('EKEEKRTA') && logo.includes('/brand-mark.svg'));
const login = renderToStaticMarkup(<AuthProvider><StaticRouter location="/login"><Login /></StaticRouter></AuthProvider>);
assert.ok(login.includes('EKEEKRTA') && login.includes('type="password"'));
assert.ok(login.includes('href="/register-institution"'));
assert.ok(login.includes('Google college account sign-in'));
assert.ok(renderToStaticMarkup(<GoogleSignIn onCredential={() => {}} />).includes('Loading Google sign-in'));
assert.ok(!login.includes('LMS Platform') && !login.includes('Smart Virtual Learning'));
assert.ok(onboarding.includes('EKEEKRTA'));
const institutionShell = renderToStaticMarkup(<StaticRouter location="/student"><DashboardShell user={{name:'Isolated test',role:'student',institution:{name:'Independent Institution',logo_url:'https://example.com/institution.svg'}}} title="Student Hub" roleLabel="Student" onLogout={() => {}}><p>Own dashboard</p></DashboardShell></StaticRouter>);
assert.ok(institutionShell.includes('Independent Institution'));
assert.ok(institutionShell.includes('https://example.com/institution.svg'));
assert.ok(institutionShell.includes('alt="Independent Institution logo"'));
assert.ok(institutionShell.includes('EKEEKRTA'));
const institutionFallbackShell = renderToStaticMarkup(<StaticRouter location="/student"><DashboardShell user={{name:'Isolated test',role:'student',institution:{name:'Independent Institution',logo_url:null}}} title="Student Hub" roleLabel="Student" onLogout={() => {}}><p>Own dashboard</p></DashboardShell></StaticRouter>);
assert.ok(institutionFallbackShell.includes('institution-fallback-logo') && institutionFallbackShell.includes('>II<'));
assert.ok(!institutionFallbackShell.includes('portal-brand-mark'));
console.log('PASS EKEEKRTA wordmark, sign-in branding, page titles and separate institution identity');
globalThis.window = { location: { hostname: 'ekeekrta.alpha.edu' } };
const institutionLogin = renderToStaticMarkup(<AuthProvider><StaticRouter location="/login"><Login /></StaticRouter></AuthProvider>);
assert.ok(institutionLogin.includes('ekeekrta.alpha.edu'));
assert.ok(institutionLogin.includes('Loading your institution'));
assert.ok(!institutionLogin.includes('type="password"'));
assert.ok(!institutionLogin.includes('href="/register-institution"'));
assert.ok(!institutionLogin.includes('Google college account sign-in'));
delete globalThis.window;
console.log('PASS institution portal waits for verified configuration before showing login and hides onboarding');
assert.equal(institutionHost('localhost'), null);
assert.equal(institutionHost('smart-virtual-lms-frontend-ruby.vercel.app'), null);
assert.equal(institutionHost('EKEEKRTA.HITAM.ORG'), 'ekeekrta.hitam.org');
assert.equal(institutionHost('ekeekrta.unknown.edu'), 'ekeekrta.unknown.edu');
assert.equal(institutionHost('ekeekrta-platform.vercel.app'), null);
assert.deepEqual(institutionHeaders(), {});
(async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.window = { location: { hostname: 'ekeekrta.alpha.edu' } };
  globalThis.localStorage = { getItem: () => 'isolated-test-token' };
  globalThis.fetch = async (url, options) => { calls.push({url, options}); return {ok: true, status: 200, json: async () => ({})}; };
  try {
    await apiFetch('/auth/me', {headers: {'X-Institution-Host': 'ekeekrta.beta.edu'}});
    await requestLogin('isolated@alpha.edu', 'unused-test-password');
    await createFaculty({});
    for (const call of calls) assert.equal(call.options.headers['X-Institution-Host'], 'ekeekrta.alpha.edu');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer isolated-test-token');
    globalThis.window.location.hostname = 'localhost';
    await requestLogin('isolated@alpha.edu', 'unused-test-password');
    assert.equal(calls.at(-1).options.headers['X-Institution-Host'], undefined);
    console.log('PASS API requests derive institution context from the hostname; main-site login stays generic');
    const scripts = [];
    globalThis.document = { createElement: () => ({remove() { this.removed = true; }}), head: {appendChild(script) { scripts.push(script); }} };
    const first = loadGoogleIdentity();
    assert.equal(loadGoogleIdentity(), first);
    assert.equal(scripts[0].src, 'https://accounts.google.com/gsi/client');
    scripts[0].onerror();
    await assert.rejects(first, /could not load/);
    assert.equal(scripts[0].removed, true);
    const retry = loadGoogleIdentity();
    const googleApi = { initialize() {}, renderButton() {} };
    globalThis.window.google = { accounts: { id: googleApi } };
    scripts[1].onload();
    assert.equal(await retry, googleApi);
    assert.equal(await loadGoogleIdentity(), googleApi);
    assert.equal(scripts.length, 2);
    console.log('PASS Google script loading deduplication, load failure, cleanup and retry (non-browser unit check)');
  } finally {
    globalThis.fetch = previousFetch;
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.document;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
