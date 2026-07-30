import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

const ATTENDANCE_RISK_THRESHOLD = 75; // typical college attendance policy

function QuizTaker({ quiz, onClose, onSubmitted }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      const res = await apiFetch("/quizzes/attempt", {
        method: "POST",
        body: JSON.stringify({ quiz_id: quiz.id, answers }),
      });
      setResult(res);
      onSubmitted(quiz.id, res.score);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card" style={{ marginTop: 10, borderColor: "var(--purple)" }}>
      <p className="section-eyebrow" style={{ marginBottom: 2 }}>Quiz</p>
      <h4 style={{ fontFamily: "var(--font-display)", margin: "0 0 12px" }}>{quiz.title}</h4>

      {result ? (
        <p style={{ color: "var(--teal-dark)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
          {result.correct}/{result.total} correct — {result.score.toFixed(0)}%
        </p>
      ) : (
        <>
          {quiz.questions.map((q, i) => (
            <div key={q.id} className="quiz-question">
              <p style={{ margin: "0 0 6px", fontWeight: 500 }}>{i + 1}. {q.text}</p>
              {q.options.map((opt, idx) => (
                <label key={idx} style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === idx}
                    onChange={() => setAnswers({ ...answers, [q.id]: idx })}
                  />{" "}
                  {opt}
                </label>
              ))}
            </div>
          ))}
          {error && <p className="error-banner">{error}</p>}
          <div className="form-row">
            <button onClick={submit} className="btn btn-secondary">Submit answers</button>
            <button onClick={onClose} className="btn btn-ghost">Close</button>
          </div>
        </>
      )}
      {result && (
        <button onClick={onClose} className="btn btn-ghost" style={{ marginTop: 10 }}>Close</button>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  const loadDashboard = async () => {
    try {
      const [enrolledCourses, everyCourse] = await Promise.all([
        apiFetch("/courses/enrolled"),
        apiFetch("/courses/"),
      ]);
      setCourses(enrolledCourses);
      setAllCourses(everyCourse);

      const [sessionsEntries, attendanceEntries, assignmentEntries, quizEntries, materialEntries, mySubmissions] =
        await Promise.all([
          Promise.all(enrolledCourses.map((c) => apiFetch(`/attendance/sessions/${c.id}`).then((s) => [c.id, s]))),
          Promise.all(enrolledCourses.map((c) => apiFetch(`/attendance/${c.id}/${user.id}`).then((r) => [c.id, r]))),
          Promise.all(enrolledCourses.map((c) => apiFetch(`/assignments/course/${c.id}`).then((a) => [c.id, a]))),
          Promise.all(enrolledCourses.map((c) => apiFetch(`/quizzes/course/${c.id}`).then((q) => [c.id, q]))),
          Promise.all(enrolledCourses.map((c) => apiFetch(`/materials/course/${c.id}`).then((m) => [c.id, m]))),
          apiFetch("/assignments/submissions/me"),
        ]);

      setSessionsByCourse(Object.fromEntries(sessionsEntries));
      setAttendanceByCourse(Object.fromEntries(attendanceEntries));
      setAssignmentsByCourse(Object.fromEntries(assignmentEntries));
      setQuizzesByCourse(Object.fromEntries(quizEntries));
      setMaterialsByCourse(Object.fromEntries(materialEntries));
      setSubmissions(mySubmissions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (courses.length === 0) return;
    const interval = setInterval(async () => {
      try {
        const entries = await Promise.all(
          courses.map((c) => apiFetch(`/attendance/sessions/${c.id}`).then((s) => [c.id, s]))
        );
        setSessionsByCourse(Object.fromEntries(entries));
      } catch {
        // Silent - a missed poll isn't worth surfacing an error for.
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [courses]);

  const enroll = async (courseId) => {
    setEnrolling(courseId);
    setError("");
    try {
      await apiFetch(`/courses/${courseId}/enroll`, { method: "POST" });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnrolling(null);
    }
  };

  const attendancePercent = (courseId) => {
    const records = attendanceByCourse[courseId] || [];
    if (records.length === 0) return null;
    const present = records.filter((r) => r.present).length;
    return Math.round((present / records.length) * 100);
  };

  const isAtRisk = (courseId) => {
    const pct = attendancePercent(courseId);
    return pct !== null && pct < ATTENDANCE_RISK_THRESHOLD;
  };

  const joinSession = (course, session) => {
    navigate("/classroom", {
      state: {
        sessionId: session.id,
        roomId: session.jitsi_room_id,
        courseId: course.id,
        courseName: course.name,
        studentId: user.id,
        studentName: user.name,
        isFaculty: false,
      },
    });
  };

  const submissionFor = (assignmentId) => submissions.find((s) => s.assignment_id === assignmentId);

  const submitAssignment = async (assignmentId) => {
    const fileUrl = submitUrls[assignmentId];
    if (!fileUrl) return;
    try {
      const newSubmission = await apiFetch("/assignments/submit", {
        method: "POST",
        body: JSON.stringify({ assignment_id: assignmentId, file_url: fileUrl }),
      });
      setSubmissions([...submissions, newSubmission]);
      setSubmitUrls({ ...submitUrls, [assignmentId]: "" });
    } catch (err) {
      setError(err.message);
    }
  };

  const openQuiz = async (quiz) => {
    try {
      const detail = await apiFetch(`/quizzes/${quiz.id}`);
      setActiveQuiz(detail);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="dash-shell">Loading dashboard...</p>;

  return (
    <div className="dash-shell">
      <div className="dash-header">
        <div>
          <h2 className="dash-title">{user.name}</h2>
          <span className="role-chip">Student</span>
        </div>
        <button onClick={logout} className="btn btn-ghost">Log out</button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>{user.name}</div>
        <div style={{ color: "var(--ink-muted)", fontSize: 13, fontFamily: "var(--font-mono)" }}>{user.email}</div>
        <div style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 4 }}>
          {user.department || "No department set"} &middot; {user.role}
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {(() => {
        const enrolledIds = new Set(courses.map((c) => c.id));
        const available = allCourses.filter((c) => !enrolledIds.has(c.id));
        if (available.length === 0) return null;
        return (
          <div className="section" style={{ marginTop: 0 }}>
            <p className="section-eyebrow">Enroll</p>
            <h3 className="section-title">Browse courses</h3>
            {available.map((c) => (
              <div key={c.id} className="card course-row">
                <span>
                  <span className="course-name" style={{ fontSize: 14 }}>{c.name}</span>
                  <span className="course-code">{c.code}</span>
                </span>
                <button
                  onClick={() => enroll(c.id)}
                  disabled={enrolling === c.id}
                  className="btn btn-primary"
                >
                  {enrolling === c.id ? "Enrolling..." : "Enroll"}
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {courses.length === 0 && <p className="footnote">You're not enrolled in any courses yet.</p>}

      {courses.map((course) => {
        const sessions = sessionsByCourse[course.id] || [];
        const latestSession = sessions[0];
        const pct = attendancePercent(course.id);
        const atRisk = isAtRisk(course.id);
        const assignments = assignmentsByCourse[course.id] || [];
        const quizzes = quizzesByCourse[course.id] || [];
        const materials = materialsByCourse[course.id] || [];

        return (
          <div key={course.id} className="card" style={{ marginBottom: 20, padding: "20px 22px" }}>
            <div className="course-row">
              <div>
                <span className="course-name">{course.name}</span>
                <span className="course-code">{course.code}</span>
                <div style={{ marginTop: 6 }}>
                  {pct === null ? (
                    <span className="pill pill-muted">No sessions yet</span>
                  ) : (
                    <span className={`pill ${atRisk ? "pill-risk" : "pill-ok"}`}>
                      <span className="pct">{pct}%</span> attendance{atRisk && " — at risk"}
                    </span>
                  )}
                </div>
              </div>
              {latestSession && (
                <button onClick={() => joinSession(course, latestSession)} className="btn btn-primary start-class-btn">
                  <span className="live-dot" />
                  Join class
                </button>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <p className="section-eyebrow" style={{ marginBottom: 2 }}>Assignments</p>
              {assignments.length === 0 && <p className="footnote" style={{ marginTop: 4 }}>None posted yet.</p>}
              {assignments.map((a) => {
                const mine = submissionFor(a.id);
                return (
                  <div key={a.id} className="item-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>
                      {a.title} <span style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>max {a.max_marks}</span>
                    </span>
                    {mine ? (
                      <span className={`pill ${mine.marks_obtained !== null ? "pill-ok" : "pill-muted"}`}>
                        {mine.marks_obtained !== null ? `Graded ${mine.marks_obtained}` : "Awaiting grade"}
                      </span>
                    ) : (
                      <div className="form-row" style={{ gap: 6 }}>
                        <input
                          className="field"
                          placeholder="Paste file URL"
                          value={submitUrls[a.id] || ""}
                          onChange={(e) => setSubmitUrls({ ...submitUrls, [a.id]: e.target.value })}
                          style={{ fontSize: 13, padding: "6px 10px", width: 170 }}
                        />
                        <button onClick={() => submitAssignment(a.id)} className="btn btn-primary" style={{ fontSize: 13, padding: "6px 12px" }}>
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16 }}>
              <p className="section-eyebrow" style={{ marginBottom: 2 }}>Quizzes</p>
              {quizzes.length === 0 && <p className="footnote" style={{ marginTop: 4 }}>None posted yet.</p>}
              {quizzes.map((q) => (
                <div key={q.id} className="item-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{q.title}</span>
                  {completedQuizzes[q.id] !== undefined ? (
                    <span className="pill pill-ok">Completed {completedQuizzes[q.id].toFixed(0)}%</span>
                  ) : (
                    <button onClick={() => openQuiz(q)} className="btn btn-secondary" style={{ fontSize: 13, padding: "6px 12px" }}>
                      Take quiz
                    </button>
                  )}
                </div>
              ))}
              {activeQuiz && quizzes.some((q) => q.id === activeQuiz.id) && (
                <QuizTaker
                  quiz={activeQuiz}
                  onClose={() => setActiveQuiz(null)}
                  onSubmitted={(quizId, score) => setCompletedQuizzes({ ...completedQuizzes, [quizId]: score })}
                />
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <p className="section-eyebrow" style={{ marginBottom: 2 }}>Study guide</p>
              {materials.length === 0 && <p className="footnote" style={{ marginTop: 4 }}>No materials uploaded yet.</p>}
              {materials.map((m) => (
                <div key={m.id} className="item-row">
                  <span className="pill pill-muted" style={{ marginRight: 8 }}>{m.material_type}</span>
                  <a href={m.file_url} target="_blank" rel="noreferrer" className="btn-text">{m.title}</a>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}