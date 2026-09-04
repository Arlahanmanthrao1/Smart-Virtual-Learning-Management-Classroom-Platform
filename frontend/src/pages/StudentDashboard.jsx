import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import DashboardShell, { EmptyState, Icon, StatCard } from "../components/dashboard/DashboardShell";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

const ATTENDANCE_RISK_THRESHOLD = 75;

function QuizTaker({ quiz, onClose, onSubmitted }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      const response = await apiFetch("/quizzes/attempt", {
        method: "POST",
        body: JSON.stringify({ quiz_id: quiz.id, answers }),
      });
      setResult(response);
      onSubmitted(quiz.id, response.score);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="quiz-taker">
      <div className="section-title-row">
        <div><p className="section-eyebrow">Quiz in progress</p><h4>{quiz.title}</h4></div>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
      {result ? (
        <div className="result-banner"><Icon name="check" /> Your result: {result.correct}/{result.total} correct · {result.score.toFixed(0)}%</div>
      ) : (
        <>
          {quiz.questions.map((question, questionIndex) => (
            <fieldset key={question.id} className="quiz-question">
              <legend>{questionIndex + 1}. {question.text}</legend>
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="quiz-option">
                  <input type="radio" name={`question-${question.id}`} checked={answers[question.id] === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {error && <p className="error-banner">{error}</p>}
          <button onClick={submit} className="btn btn-primary">Submit answers</button>
        </>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { page = "dashboard" } = useParams();
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [sessionsByCourse, setSessionsByCourse] = useState({});
  const [attendanceByCourse, setAttendanceByCourse] = useState({});
  const [assignmentsByCourse, setAssignmentsByCourse] = useState({});
  const [quizzesByCourse, setQuizzesByCourse] = useState({});
  const [materialsByCourse, setMaterialsByCourse] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [submitUrls, setSubmitUrls] = useState({});
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [completedQuizzes, setCompletedQuizzes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadDashboard = async () => {
    try {
      const [enrolledCourses, everyCourse] = await Promise.all([apiFetch("/courses/enrolled"), apiFetch("/courses/")]);
      setCourses(enrolledCourses);
      setAllCourses(everyCourse);
      const [sessions, attendance, assignments, quizzes, materials, mySubmissions] = await Promise.all([
        Promise.all(enrolledCourses.map((course) => apiFetch(`/attendance/sessions/${course.id}`).then((data) => [course.id, data]))),
        Promise.all(enrolledCourses.map((course) => apiFetch(`/attendance/${course.id}/${user.id}`).then((data) => [course.id, data]))),
        Promise.all(enrolledCourses.map((course) => apiFetch(`/assignments/course/${course.id}`).then((data) => [course.id, data]))),
        Promise.all(enrolledCourses.map((course) => apiFetch(`/quizzes/course/${course.id}`).then((data) => [course.id, data]))),
        Promise.all(enrolledCourses.map((course) => apiFetch(`/materials/course/${course.id}`).then((data) => [course.id, data]))),
        apiFetch("/assignments/submissions/me"),
      ]);
      setSessionsByCourse(Object.fromEntries(sessions));
      setAttendanceByCourse(Object.fromEntries(attendance));
      setAssignmentsByCourse(Object.fromEntries(assignments));
      setQuizzesByCourse(Object.fromEntries(quizzes));
      setMaterialsByCourse(Object.fromEntries(materials));
      setSubmissions(mySubmissions);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) loadDashboard(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!courses.length) return undefined;
    const interval = window.setInterval(async () => {
      try {
        const entries = await Promise.all(courses.map((course) => apiFetch(`/attendance/sessions/${course.id}`).then((data) => [course.id, data])));
        setSessionsByCourse(Object.fromEntries(entries));
      } catch { /* A missed poll can safely wait for the next refresh. */ }
    }, 6000);
    return () => window.clearInterval(interval);
  }, [courses]);

  const enroll = async (courseId) => {
    setEnrolling(courseId);
    setError("");
    try { await apiFetch(`/courses/${courseId}/enroll`, { method: "POST" }); await loadDashboard(); }
    catch (err) { setError(err.message); }
    finally { setEnrolling(null); }
  };

  const attendancePercent = (courseId) => {
    const records = attendanceByCourse[courseId] || [];
    return records.length ? Math.round((records.filter((record) => record.present).length / records.length) * 100) : null;
  };

  const joinSession = (course, session) => navigate("/classroom", { state: {
    sessionId: session.id, roomId: session.jitsi_room_id, courseId: course.id, courseName: course.name,
    studentId: user.id, studentName: user.name, isFaculty: false,
  } });

  const submissionFor = (assignmentId) => submissions.find((submission) => submission.assignment_id === assignmentId);
  const submitAssignment = async (assignmentId) => {
    const fileUrl = submitUrls[assignmentId];
    if (!fileUrl) return;
    try {
      const submission = await apiFetch("/assignments/submit", { method: "POST", body: JSON.stringify({ assignment_id: assignmentId, file_url: fileUrl }) });
      setSubmissions([...submissions, submission]);
      setSubmitUrls({ ...submitUrls, [assignmentId]: "" });
    } catch (err) { setError(err.message); }
  };
  const openQuiz = async (quiz) => {
    try { setActiveQuiz(await apiFetch(`/quizzes/${quiz.id}`)); }
    catch (err) { setError(err.message); }
  };

  const allAssignments = Object.values(assignmentsByCourse).flat();
  const allQuizzes = Object.values(quizzesByCourse).flat();
  const attendanceRecords = Object.values(attendanceByCourse).flat();
  const overallAttendance = attendanceRecords.length ? Math.round((attendanceRecords.filter((record) => record.present).length / attendanceRecords.length) * 100) : null;
  const pendingAssignments = allAssignments.filter((assignment) => !submissionFor(assignment.id));
  const activeClasses = courses.flatMap((course) => (sessionsByCourse[course.id] || []).filter((session) => !session.ended_at).map((session) => ({ course, session })));
  const enrolledIds = new Set(courses.map((course) => course.id));
  const availableCourses = allCourses.filter((course) => !enrolledIds.has(course.id));
  const matchesSearch = (course) => `${course.name} ${course.code} ${course.department || ""}`.toLowerCase().includes(search.toLowerCase());
  const shownCourses = useMemo(() => courses.filter(matchesSearch), [courses, search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="loading-screen"><span className="loading-mark">LMS</span><p>Preparing your dashboard…</p></div>;

  return (
    <DashboardShell user={user} title="Student Hub" roleLabel="Student" onLogout={logout} searchValue={search} onSearch={setSearch} searchPlaceholder="Search your courses…">
      {page === "dashboard" && <section className="page-hero" id="dashboard">
        <div><h1>Good day, {user.name}! <span className="wave">👋</span></h1><p>Here’s what’s happening across your courses.</p></div>
        {activeClasses[0] && <button className="btn btn-primary hero-button" onClick={() => joinSession(activeClasses[0].course, activeClasses[0].session)}><Icon name="video" /> Join active class</button>}
      </section>}
      {error && <p className="error-banner">{error}</p>}
      {page === "dashboard" && <section className="stats-grid" aria-label="Student overview">
        <StatCard icon="courses" label="Enrolled courses" value={courses.length} tone="blue" />
        <StatCard icon="check" label="Overall attendance" value={overallAttendance === null ? "—" : `${overallAttendance}%`} tone="green" detail="Target: 75%" />
        <StatCard icon="assignments" label="Pending assignments" value={pendingAssignments.length} tone="red" />
        <StatCard icon="quiz" label="Available quizzes" value={allQuizzes.length} tone="amber" />
      </section>}
      {page === "dashboard" && <><div className="page-actions"><Link className="btn btn-primary" to="/student/courses">Open my courses</Link><Link className="btn btn-soft" to="/student/assignments">View assignments</Link><Link className="btn btn-soft" to="/student/quizzes">Take a quiz</Link></div><section className="section"><h2 className="section-title">Live classes</h2>{!activeClasses.length && <EmptyState>No classes are live right now.</EmptyState>}{activeClasses.map(({ course, session }) => <div className="active-class-card" key={session.id}><div><span className="pill pill-live">Live now</span><h3>{course.name}</h3></div><button className="btn btn-primary" onClick={() => joinSession(course, session)}>Join now</button></div>)}</section></>}
      <div className={page === "courses" ? "content-grid" : "page-grid"}>
        <div className="content-stack">
          {page !== "dashboard" && <section className="section" id={page}>
            <div className="section-title-row"><div><p className="section-eyebrow">Your enrolled courses</p><h2 className="section-title">{{ courses: "My courses", assignments: "Course assignments", quizzes: "Course quizzes", materials: "Course study guides" }[page]}</h2></div></div>
            {page === "courses" && activeClasses.map(({ course, session }) => <div className="active-class-card" key={session.id}><span className="active-class-icon"><Icon name="video" /></span><div><span className="pill pill-live">Live now</span><h3>{course.name}</h3><p>{course.code} · Attendance starts when you enter</p></div><button className="btn btn-primary" onClick={() => joinSession(course, session)}>Join now</button></div>)}
            {!shownCourses.length && <EmptyState>{search ? "No enrolled course matches your search." : "You are not enrolled in a course yet."}</EmptyState>}
            <div className="course-list">
              {shownCourses.map((course) => {
                const percentage = attendancePercent(course.id);
                const atRisk = percentage !== null && percentage < ATTENDANCE_RISK_THRESHOLD;
                const assignments = assignmentsByCourse[course.id] || [];
                const quizzes = quizzesByCourse[course.id] || [];
                const materials = materialsByCourse[course.id] || [];
                return <article className="card course-card" key={course.id}>
                  <div className="course-row"><div><span className="course-name">{course.name}</span><span className="course-code">{course.code}</span><div className="course-meta"><span>{course.department || "Department not set"}</span><span>{course.semester || "Semester not set"}</span></div></div><span className={`pill ${atRisk ? "pill-risk" : percentage === null ? "pill-muted" : "pill-ok"}`}>{percentage === null ? "No attendance yet" : `${percentage}% attendance${atRisk ? " · at risk" : ""}`}</span></div>
                  <div className="page-grid">
                    {page === "assignments" && <div><p className="mini-heading">Assignments</p>{!assignments.length && <p className="footnote">Nothing posted yet.</p>}{assignments.map((assignment) => { const mine = submissionFor(assignment.id); return <div className="item-row" key={assignment.id}><div className="split-row"><span>{assignment.title}</span>{mine && <span className={`pill ${mine.marks_obtained !== null ? "pill-ok" : "pill-muted"}`}>{mine.marks_obtained !== null ? `${mine.marks_obtained}/${assignment.max_marks}` : "Awaiting grade"}</span>}</div>{!mine && <div className="inline-submit"><input className="field" type="url" placeholder="Paste your file URL" value={submitUrls[assignment.id] || ""} onChange={(event) => setSubmitUrls({ ...submitUrls, [assignment.id]: event.target.value })} /><button className="btn btn-soft" onClick={() => submitAssignment(assignment.id)}>Submit</button></div>}</div>; })}</div>}
                    {page === "quizzes" && <div><p className="mini-heading">Quizzes</p>{!quizzes.length && <p className="footnote">Nothing posted yet.</p>}{quizzes.map((quiz) => <div className="item-row split-row" key={quiz.id}><span>{quiz.title}</span>{completedQuizzes[quiz.id] !== undefined ? <span className="pill pill-ok">{completedQuizzes[quiz.id].toFixed(0)}%</span> : <button className="btn-text" onClick={() => openQuiz(quiz)}>Take quiz →</button>}</div>)}</div>}
                  </div>
                  {page === "materials" && <div><p className="mini-heading">Study guide</p>{!materials.length && <p className="footnote">No materials uploaded yet.</p>}<div className="material-links">{materials.map((material) => <a key={material.id} href={material.file_url} target="_blank" rel="noreferrer"><Icon name="material" size={16} /><span>{material.title}</span><small>{material.material_type}</small></a>)}</div></div>}
                  {page === "quizzes" && activeQuiz && quizzes.some((quiz) => quiz.id === activeQuiz.id) && <QuizTaker quiz={activeQuiz} onClose={() => setActiveQuiz(null)} onSubmitted={(quizId, score) => setCompletedQuizzes({ ...completedQuizzes, [quizId]: score })} />}
                </article>;
              })}
            </div>
          </section>}
        </div>
        <aside className="content-stack">
          {page === "dashboard" && (<section className="card panel-card profile-card"><div className="profile-card-avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><h3>{user.name}</h3><p>{user.email}</p><span className="pill pill-muted">{user.department || "Department not set"}</span></section>)}
          {page === "dashboard" && (<section className="card panel-card"><div className="section-title-row"><h3>Attendance overview</h3><Icon name="chart" /></div><div className="attendance-number">{overallAttendance === null ? "—" : `${overallAttendance}%`}</div><div className="split-row footnote"><span>Overall attendance</span><span>Target 75%</span></div><div className="progress-track"><div className={`progress-fill ${overallAttendance !== null && overallAttendance < 75 ? "risk" : ""}`} style={{ width: `${overallAttendance || 0}%` }} /></div></section>)}
          {page === "courses" && (<section className="card panel-card"><div className="section-title-row"><h3>Browse courses</h3><Icon name="courses" /></div>{!availableCourses.length && <p className="footnote">You’re enrolled in every available course.</p>}{availableCourses.filter(matchesSearch).map((course) => <div className="item-row split-row" key={course.id}><div><strong>{course.name}</strong><div className="footnote">{course.code}</div></div><button className="btn btn-soft" disabled={enrolling === course.id} onClick={() => enroll(course.id)}>{enrolling === course.id ? "Adding…" : "Enroll"}</button></div>)}</section>)}
        </aside>
      </div>
    </DashboardShell>
  );
}
