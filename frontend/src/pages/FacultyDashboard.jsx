import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
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

  const [courses, setCourses] = useState([]);
  const [assignmentsByCourse, setAssignmentsByCourse] = useState({});
  const [students, setStudents] = useState([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState({});
  const [error, setError] = useState("");
  const [newCourse, setNewCourse] = useState({ name: "", code: "", department: "", semester: "" });
  const [gradingAssignmentId, setGradingAssignmentId] = useState(null);

  const loadCourses = async () => {
    const all = await apiFetch("/courses/");
    setCourses(all);
    const assignmentEntries = await Promise.all(
      all.map((c) => apiFetch(`/assignments/course/${c.id}`).then((a) => [c.id, a]))
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
      }
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

  return (
    <div className="dash-shell">
      <div className="dash-header">
        <div>
          <h2 className="dash-title">{user.name}</h2>
          <span className="role-chip">Faculty console</span>
        </div>
        <button onClick={logout} className="btn btn-ghost">Log out</button>
      </div>

      {error && <p className="error-banner">{error}</p>}

      <div className="section">
        <p className="section-eyebrow">Setup</p>
        <h3 className="section-title">Create a course</h3>
        <form onSubmit={handleCreateCourse} className="card form-row">
          <input className="field" placeholder="Name" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} required style={{ flex: 1, minWidth: 140 }} />
          <input className="field" placeholder="Code (e.g. CS201)" value={newCourse.code} onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })} required style={{ width: 140 }} />
          <input className="field" placeholder="Department" value={newCourse.department} onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })} style={{ width: 140 }} />
          <input className="field" placeholder="Semester" value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })} style={{ width: 100 }} />
          <button type="submit" className="btn btn-primary">Create</button>
        </form>
      </div>

      <div className="section">
        <p className="section-eyebrow">Live &amp; upcoming</p>
        <h3 className="section-title">Your courses</h3>
        {courses.map((course) => {
          const assignments = assignmentsByCourse[course.id] || [];
          return (
            <div key={course.id} className="card">
              <div className="course-row">
                <div>
                  <span className="course-name">{course.name}</span>
                  <span className="course-code">{course.code}</span>
                </div>
                <button onClick={() => scheduleAndJoin(course)} className="btn btn-secondary start-class-btn">
                  <span className="live-dot" />
                  Start class now
                </button>
              </div>

              {assignments.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p className="section-eyebrow" style={{ marginBottom: 4 }}>Assignments</p>
                  {assignments.map((a) => (
                    <div key={a.id} className="item-row">
                      <button
                        onClick={() => setGradingAssignmentId(gradingAssignmentId === a.id ? null : a.id)}
                        className="btn-text"
                      >
                        {a.title} — {gradingAssignmentId === a.id ? "hide submissions" : "grade submissions"}
                      </button>
                      {gradingAssignmentId === a.id && <GradingPanel assignment={a} onGraded={loadCourses} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="section">
        <p className="section-eyebrow">Coursework</p>
        <h3 className="section-title">Post an assignment</h3>
        <CreateAssignmentForm courses={courses} onCreated={loadCourses} />
      </div>

      <div className="section">
        <h3 className="section-title">Post a quiz</h3>
        <CreateQuizForm courses={courses} onCreated={loadCourses} />
      </div>

      <div className="section">
        <p className="section-eyebrow">Directory</p>
        <h3 className="section-title">Student roster ({students.length})</h3>
        <table className="ledger">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const summary = attendanceSummaries[s.id];
              const pct = summary?.percent;
              const atRisk = pct !== null && pct !== undefined && pct < 75;
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{s.email}</td>
                  <td>{s.department || "—"}</td>
                  <td>
                    {pct === null || pct === undefined ? (
                      <span className="pill pill-muted">No data</span>
                    ) : (
                      <span className={`pill ${atRisk ? "pill-risk" : "pill-ok"}`}>
                        <span className="pct">{pct}%</span>{atRisk && " at risk"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="footnote">
          Backlogs and performance "band" from the original feature list aren't in the current data
          model yet (no semester/results history is tracked) — attendance-based risk is what's shown
          here for now.
        </p>
      </div>
    </div>
  );
}