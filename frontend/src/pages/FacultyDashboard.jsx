import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import DashboardShell, { EmptyState, Icon, StatCard } from "../components/dashboard/DashboardShell";
import { useAuth } from "../context/AuthContext";
import CourseEnrollmentPanel from "../components/dashboard/CourseEnrollmentPanel";
import "../styles/dashboard.css";

function CreateAssignmentForm({ courses, onCreated }) {
  const [form, setForm] = useState({ course_id: "", title: "", description: "", max_marks: 100 });
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/assignments/", {
        method: "POST",
        body: JSON.stringify({ ...form, course_id: Number(form.course_id), max_marks: Number(form.max_marks) }),
      });
      setForm({ course_id: "", title: "", description: "", max_marks: 100 });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="card">
      <div className="form-row">
        <select className="field" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required>
          <option value="">Course</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="field" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ flex: 1, minWidth: 160 }} />
        <input className="field" placeholder="Max marks" type="number" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} style={{ width: 100 }} />
        <button type="submit" className="btn btn-primary">Post assignment</button>
      </div>
      {error && <p className="error-banner" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p>}
    </form>
  );
}

function CreateQuizForm({ courses, onCreated }) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ text: "", options: ["", ""], correct_option: 0 }]);
  const [error, setError] = useState("");

  const updateQuestion = (i, patch) => {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    setQuestions(next);
  };

  const updateOption = (qi, oi, value) => {
    const next = [...questions];
    next[qi].options = next[qi].options.map((o, idx) => (idx === oi ? value : o));
    setQuestions(next);
  };

  const addQuestion = () => setQuestions([...questions, { text: "", options: ["", ""], correct_option: 0 }]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/quizzes/", {
        method: "POST",
        body: JSON.stringify({ course_id: Number(courseId), title, total_marks: 100, questions }),
      });
      setCourseId("");
      setTitle("");
      setQuestions([{ text: "", options: ["", ""], correct_option: 0 }]);
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="card">
      <div className="form-row" style={{ marginBottom: 14 }}>
        <select className="field" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
          <option value="">Course</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="field" placeholder="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ flex: 1, minWidth: 160 }} />
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="quiz-question">
          <input
            className="field"
            placeholder={`Question ${qi + 1}`}
            value={q.text}
            onChange={(e) => updateQuestion(qi, { text: e.target.value })}
            required
            style={{ width: "100%", marginBottom: 8, boxSizing: "border-box" }}
          />
          {q.options.map((opt, oi) => (
            <div key={oi} className="option-row">
              <input type="radio" checked={q.correct_option === oi} onChange={() => updateQuestion(qi, { correct_option: oi })} title="Mark as correct answer" />
              <input
                className="field"
                placeholder={`Option ${oi + 1}`}
                value={opt}
                onChange={(e) => updateOption(qi, oi, e.target.value)}
                required
                style={{ flex: 1 }}
              />
            </div>
          ))}
          <button type="button" className="add-btn" onClick={() => updateQuestion(qi, { options: [...q.options, ""] })}>
            + option
          </button>
        </div>
      ))}

      <div className="form-row" style={{ marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" onClick={addQuestion}>+ Add question</button>
        <button type="submit" className="btn btn-secondary">Post quiz</button>
      </div>
      {error && <p className="error-banner" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p>}
    </form>
  );
}

function GradingPanel({ assignment, onGraded }) {
  const [submissions, setSubmissions] = useState([]);
  const [marksInput, setMarksInput] = useState({});
  const [error, setError] = useState("");

  const load = () => apiFetch(`/assignments/${assignment.id}/submissions`).then(setSubmissions).catch((e) => setError(e.message));

  useEffect(() => { load(); }, [assignment.id]);

  const grade = async (submissionId) => {
    const marks = marksInput[submissionId];
    if (marks === undefined || marks === "") return;
    try {
      await apiFetch(`/assignments/submissions/${submissionId}/grade?marks=${Number(marks)}`, { method: "POST" });
      onGraded();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: "2px solid var(--border)" }}>
      {error && <p className="error-banner">{error}</p>}
      {submissions.length === 0 && <p className="footnote" style={{ marginTop: 0 }}>No submissions yet.</p>}
      {submissions.map((s) => (
        <div key={s.id} className="form-row" style={{ alignItems: "center", fontSize: 13, padding: "4px 0" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>Student #{s.student_id}</span>
          <a href={s.file_url} target="_blank" rel="noreferrer" className="btn-text">view file</a>
          {s.marks_obtained !== null ? (
            <span className="pill pill-ok">Graded {s.marks_obtained}</span>
          ) : (
            <>
              <input
                className="field"
                type="number"
                placeholder="Marks"
                value={marksInput[s.id] || ""}
                onChange={(e) => setMarksInput({ ...marksInput, [s.id]: e.target.value })}
                style={{ width: 64, padding: "5px 8px" }}
              />
              <button onClick={() => grade(s.id)} className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 12 }}>
                Save
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FacultyDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { page = "dashboard" } = useParams();

  const [courses, setCourses] = useState([]);
  const [assignmentsByCourse, setAssignmentsByCourse] = useState({});
  const [students, setStudents] = useState([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState({});
  const [error, setError] = useState("");
  const [newCourse, setNewCourse] = useState({ name: "", code: "", department: "", semester: "" });
  const [gradingAssignmentId, setGradingAssignmentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadCourses = async () => {
    const all = await apiFetch("/courses/");
    const owned = all.filter((course) => course.faculty_id === user.id);
    setCourses(owned);
    const assignmentEntries = await Promise.all(
      owned.map((c) => apiFetch(`/assignments/course/${c.id}`).then((a) => [c.id, a]))
    );
    setAssignmentsByCourse(Object.fromEntries(assignmentEntries));
  };

  const loadRoster = async () => {
    const roster = await apiFetch("/users/").catch(() => []);
    const studentUsers = roster.filter((u) => u.role === "student");
    setStudents(studentUsers);

    const summaries = await Promise.all(
      studentUsers.map((s) => apiFetch(`/attendance/summary/${s.id}`).then((sum) => [s.id, sum]))
    );
    setAttendanceSummaries(Object.fromEntries(summaries));
  };

  useEffect(() => {
    async function load() {
      try {
        await loadCourses();
        await loadRoster();
      } catch (err) {
        setError(err.message);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/courses/", { method: "POST", body: JSON.stringify(newCourse) });
      setNewCourse({ name: "", code: "", department: "", semester: "" });
      await loadCourses();
    } catch (err) {
      setError(err.message);
    }
  };

  const scheduleAndJoin = async (course) => {
    try {
      const session = await apiFetch("/attendance/sessions", {
        method: "POST",
        body: JSON.stringify({ course_id: course.id }),
      });
      navigate("/classroom", {
        state: {
          sessionId: session.id,
          roomId: session.jitsi_room_id,
          courseId: course.id,
          courseName: course.name,
          studentId: user.id,
          studentName: user.name,
          isFaculty: true,
        },
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const assignmentCount = Object.values(assignmentsByCourse).flat().length;
  const atRiskStudents = students.filter((student) => {
    const percentage = attendanceSummaries[student.id]?.percent;
    return percentage !== null && percentage !== undefined && percentage < 75;
  });
  const recordedPercentages = students.map((student) => attendanceSummaries[student.id]?.percent).filter((value) => value !== null && value !== undefined);
  const averageAttendance = recordedPercentages.length ? Math.round(recordedPercentages.reduce((sum, value) => sum + value, 0) / recordedPercentages.length) : null;
  const filteredCourses = useMemo(() => courses.filter((course) => `${course.name} ${course.code} ${course.department || ""}`.toLowerCase().includes(search.toLowerCase())), [courses, search]);
  const filteredStudents = useMemo(() => students.filter((student) => `${student.name} ${student.email} ${student.department || ""}`.toLowerCase().includes(search.toLowerCase())), [students, search]);

  if (loading) return <div className="loading-screen"><span className="loading-mark">LMS</span><p>Preparing the faculty console…</p></div>;

  return (
    <DashboardShell user={user} title="Faculty Portal" roleLabel="Faculty" onLogout={logout} searchValue={search} onSearch={setSearch} searchPlaceholder="Search courses or students…">
      {page === "dashboard" && (<section className="page-hero" id="dashboard"><div><h1>Good day, {user.name}! <span className="wave">👋</span></h1><p>Manage classes, coursework, grading, and student attendance.</p></div></section>)}
      {error && <p className="error-banner">{error}</p>}
      {page === "dashboard" && <section className="stats-grid">
        <StatCard icon="courses" label="Your courses" value={courses.length} tone="blue" />
        <StatCard icon="users" label="Students" value={students.length} tone="purple" />
        <StatCard icon="assignments" label="Assignments" value={assignmentCount} tone="amber" />
        <StatCard icon="alert" label="At-risk students" value={atRiskStudents.length} tone="red" detail={averageAttendance === null ? "No attendance recorded" : `${averageAttendance}% roster average`} />
      </section>}
      {page === "dashboard" && <div className="page-actions"><Link className="btn btn-primary" to="/faculty/courses">Open your courses</Link><Link className="btn btn-soft" to="/faculty/create-course">Create a course</Link><Link className="btn btn-soft" to="/faculty/roster">View student roster</Link></div>}

      <div className="page-grid">
        <div className="content-stack">
          {["courses", "grading"].includes(page) && <section className="section" id="courses">
            <div className="section-title-row"><div><p className="section-eyebrow">Live classroom</p><h2 className="section-title">{page === "grading" ? "Grade assignments by course" : "Your courses"}</h2></div></div>
            {!filteredCourses.length && <EmptyState>{search ? "No course matches your search." : "Create your first course to get started."}</EmptyState>}
            <div className="course-list">{filteredCourses.map((course) => {
              const assignments = assignmentsByCourse[course.id] || [];
              return <article key={course.id} className="card course-card"><div className="course-row"><div><span className="course-name">{course.name}</span><span className="course-code">{course.code}</span><div className="course-meta"><span>{course.department || "Department not set"}</span><span>{course.semester || "Semester not set"}</span><span>{assignments.length} assignment{assignments.length === 1 ? "" : "s"}</span></div></div>{page === "courses" && <button onClick={() => scheduleAndJoin(course)} className="btn btn-primary start-class-btn"><Icon name="video" /> Start class now</button>}</div>
                {page === "grading" && assignments.length > 0 && <div className="assignment-list"><p className="mini-heading">Grading</p>{assignments.map((assignment) => <div key={assignment.id} className="item-row"><div className="split-row"><span>{assignment.title}</span><button onClick={() => setGradingAssignmentId(gradingAssignmentId === assignment.id ? null : assignment.id)} className="btn-text">{gradingAssignmentId === assignment.id ? "Hide submissions" : "Grade submissions →"}</button></div>{gradingAssignmentId === assignment.id && <GradingPanel assignment={assignment} onGraded={loadCourses} />}</div>)}</div>}
                {page === "grading" && !assignments.length && <p className="footnote">No assignments posted for this course.</p>}
                {page === "courses" && <CourseEnrollmentPanel course={course} />}
              </article>;
            })}</div>
          </section>}

          {page === "assignments" && (<section className="section" id="coursework"><div className="section-title-row"><div><p className="section-eyebrow">Coursework</p><h2 className="section-title">Post an assignment</h2></div></div><CreateAssignmentForm courses={courses} onCreated={loadCourses} /></section>)}
          {page === "quizzes" && (<section className="section"><div className="section-title-row"><h2 className="section-title">Build a quiz</h2></div><CreateQuizForm courses={courses} onCreated={loadCourses} /></section>)}
        </div>

        <aside className="content-stack">
          {page === "create-course" && (<section className="card panel-card create-panel"><div className="section-title-row"><div><p className="section-eyebrow">Course setup</p><h3>Create a course</h3></div><Icon name="courses" /></div><form onSubmit={handleCreateCourse} className="form-grid one-column"><label className="field-label">Course name<input className="field" placeholder="Cloud Computing" value={newCourse.name} onChange={(event) => setNewCourse({ ...newCourse, name: event.target.value })} required /></label><label className="field-label">Course code<input className="field" placeholder="CS401" value={newCourse.code} onChange={(event) => setNewCourse({ ...newCourse, code: event.target.value })} required /></label><label className="field-label">Department<input className="field" placeholder="Computer Science" value={newCourse.department} onChange={(event) => setNewCourse({ ...newCourse, department: event.target.value })} /></label><label className="field-label">Semester<input className="field" placeholder="Semester 7" value={newCourse.semester} onChange={(event) => setNewCourse({ ...newCourse, semester: event.target.value })} /></label><button type="submit" className="btn btn-primary">Create course</button></form></section>)}
          {page === "dashboard" && (<section className="card panel-card"><div className="section-title-row"><h3>Attendance snapshot</h3><Icon name="chart" /></div><div className="attendance-number">{averageAttendance === null ? "—" : `${averageAttendance}%`}</div><p className="footnote">Average across students with recorded attendance.</p><div className="progress-track"><div className={`progress-fill ${averageAttendance !== null && averageAttendance < 75 ? "risk" : ""}`} style={{ width: `${averageAttendance || 0}%` }} /></div></section>)}
          {page === "dashboard" && atRiskStudents.length > 0 && <section className="card panel-card risk-panel"><div className="section-title-row"><h3>Needs attention</h3><Icon name="alert" /></div>{atRiskStudents.slice(0, 5).map((student) => <div className="item-row split-row" key={student.id}><span>{student.name}</span><span className="pill pill-risk">{attendanceSummaries[student.id].percent}%</span></div>)}</section>}
        </aside>
      </div>

      {page === "roster" && (<section className="section" id="roster"><div className="section-title-row"><div><p className="section-eyebrow">Directory</p><h2 className="section-title">Student roster ({filteredStudents.length})</h2></div></div><div className="ledger-wrap"><table className="ledger"><thead><tr><th>Student</th><th>Email</th><th>Department</th><th>Attendance</th></tr></thead><tbody>{filteredStudents.map((student) => { const percentage = attendanceSummaries[student.id]?.percent; const atRisk = percentage !== null && percentage !== undefined && percentage < 75; return <tr key={student.id}><td><div className="person-cell"><span className="person-initial">{student.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><strong>{student.name}</strong></div></td><td className="mono-cell">{student.email}</td><td>{student.department || "—"}</td><td>{percentage === null || percentage === undefined ? <span className="pill pill-muted">No data</span> : <span className={`pill ${atRisk ? "pill-risk" : "pill-ok"}`}>{percentage}%{atRisk ? " · at risk" : ""}</span>}</td></tr>; })}</tbody></table></div></section>)}
    </DashboardShell>
  );
}
