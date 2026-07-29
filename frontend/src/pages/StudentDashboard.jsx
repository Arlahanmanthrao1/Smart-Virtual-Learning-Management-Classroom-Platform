import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

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
    <div style={{ border: "1px solid #5b3fa8", borderRadius: 10, padding: 16, marginTop: 12, background: "#faf9ff" }}>
      <h4 style={{ marginTop: 0 }}>{quiz.title}</h4>

      {result ? (
        <p style={{ color: "#1a7f37", fontWeight: 600 }}>
          Submitted — {result.correct}/{result.total} correct ({result.score.toFixed(0)}%)
        </p>
      ) : (
        <>
          {quiz.questions.map((q, i) => (
            <div key={q.id} style={{ marginBottom: 12 }}>
              <p style={{ margin: "4px 0", fontWeight: 500 }}>{i + 1}. {q.text}</p>
              {q.options.map((opt, idx) => (
                <label key={idx} style={{ display: "block", fontSize: 14, marginLeft: 12 }}>
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
          {error && <p style={{ color: "#c0392b" }}>{error}</p>}
          <button onClick={submit} style={{ background: "#5b3fa8", color: "white", border: "none", borderRadius: 6, padding: "6px 14px" }}>
            Submit answers
          </button>
        </>
      )}
      <button onClick={onClose} style={{ marginLeft: 8, background: "none", border: "1px solid #ccc", borderRadius: 6, padding: "6px 14px" }}>
        Close
      </button>
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
  const [activeQuiz, setActiveQuiz] = useState(null); // full quiz detail with questions, or null
  const [completedQuizzes, setCompletedQuizzes] = useState({}); // quizId -> score
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

  // Poll just the session list every few seconds - this is the actual fix
  // for "faculty starts a class but student is looking at stale data":
  // without this, a student who loaded the dashboard before the class
  // started would never see the Join button appear, or would join an
  // old/different room than the one faculty is actually in.
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
        roomId: session.jitsi_room_id,
        courseId: course.id,
        courseName: course.name,
        studentId: user.id,
        studentName: user.name,
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

  if (loading) return <p style={{ padding: 40, fontFamily: "sans-serif" }}>Loading dashboard...</p>;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Welcome, {user.name}</h2>
        <button onClick={logout} style={{ background: "none", border: "1px solid #ccc", borderRadius: 6, padding: "6px 12px" }}>
          Log out
        </button>
      </div>

      {/* Full student profile per the "all student details displayed" requirement */}
      <div style={{ background: "#f7f7f8", borderRadius: 10, padding: 16, marginBottom: 24, fontSize: 14 }}>
        <strong>{user.name}</strong>
        <div style={{ color: "#666" }}>{user.email}</div>
        <div style={{ color: "#666" }}>Department: {user.department || "—"}</div>
        <div style={{ color: "#666" }}>Role: {user.role}</div>
      </div>

      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      {/* Browse & enroll - courses the student isn't in yet */}
      {(() => {
        const enrolledIds = new Set(courses.map((c) => c.id));
        const available = allCourses.filter((c) => !enrolledIds.has(c.id));
        if (available.length === 0) return null;
        return (
          <div style={{ marginBottom: 24 }}>
            <h3>Browse courses</h3>
            {available.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid #eee", borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{c.name} <span style={{ color: "#999" }}>({c.code})</span></span>
                <button
                  onClick={() => enroll(c.id)}
                  disabled={enrolling === c.id}
                  style={{ background: "#0f5c4a", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", opacity: enrolling === c.id ? 0.6 : 1 }}
                >
                  {enrolling === c.id ? "Enrolling..." : "Enroll"}
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {courses.length === 0 && <p style={{ color: "#666" }}>You're not enrolled in any courses yet.</p>}

      {courses.map((course) => {
        const sessions = sessionsByCourse[course.id] || [];
        const latestSession = sessions[0];
        const pct = attendancePercent(course.id);
        const atRisk = isAtRisk(course.id);
        const assignments = assignmentsByCourse[course.id] || [];
        const quizzes = quizzesByCourse[course.id] || [];
        const materials = materialsByCourse[course.id] || [];

        return (
          <div key={course.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0 }}>{course.name} <span style={{ color: "#999", fontWeight: 400 }}>({course.code})</span></h3>
                <p style={{ margin: "4px 0", color: "#666", fontSize: 14 }}>
                  Attendance: {pct === null ? "No sessions yet" : `${pct}%`}
                  {atRisk && (
                    <span style={{ color: "#c0392b", fontWeight: 600, marginLeft: 8 }}>
                      ⚠ At risk (below {ATTENDANCE_RISK_THRESHOLD}%)
                    </span>
                  )}
                </p>
              </div>
              {latestSession && (
                <button
                  onClick={() => joinSession(course, latestSession)}
                  style={{ background: "#0f5c4a", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
                >
                  Join class
                </button>
              )}
            </div>

            {/* Assignments */}
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14 }}>Assignments</strong>
              {assignments.length === 0 && <p style={{ color: "#999", fontSize: 13 }}>None posted yet.</p>}
              {assignments.map((a) => {
                const mine = submissionFor(a.id);
                return (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #f2f2f2" }}>
                    <div style={{ fontSize: 14 }}>
                      {a.title} <span style={{ color: "#999" }}>(max {a.max_marks})</span>
                    </div>
                    {mine ? (
                      <span style={{ fontSize: 13, color: mine.marks_obtained !== null ? "#1a7f37" : "#999" }}>
                        {mine.marks_obtained !== null ? `Graded: ${mine.marks_obtained}` : "Submitted, awaiting grade"}
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          placeholder="Paste file URL"
                          value={submitUrls[a.id] || ""}
                          onChange={(e) => setSubmitUrls({ ...submitUrls, [a.id]: e.target.value })}
                          style={{ padding: 6, fontSize: 13, width: 160 }}
                        />
                        <button onClick={() => submitAssignment(a.id)} style={{ fontSize: 13, background: "#0f5c4a", color: "white", border: "none", borderRadius: 6, padding: "6px 10px" }}>
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quizzes */}
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14 }}>Quizzes</strong>
              {quizzes.length === 0 && <p style={{ color: "#999", fontSize: 13 }}>None posted yet.</p>}
              {quizzes.map((q) => (
                <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #f2f2f2" }}>
                  <div style={{ fontSize: 14 }}>{q.title}</div>
                  {completedQuizzes[q.id] !== undefined ? (
                    <span style={{ fontSize: 13, color: "#1a7f37" }}>Completed: {completedQuizzes[q.id].toFixed(0)}%</span>
                  ) : (
                    <button onClick={() => openQuiz(q)} style={{ fontSize: 13, background: "#5b3fa8", color: "white", border: "none", borderRadius: 6, padding: "6px 10px" }}>
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

            {/* Study guide */}
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14 }}>Study guide</strong>
              {materials.length === 0 && <p style={{ color: "#999", fontSize: 13 }}>No materials uploaded yet.</p>}
              {materials.map((m) => (
                <div key={m.id} style={{ padding: "6px 0", borderTop: "1px solid #f2f2f2", fontSize: 14 }}>
                  <span style={{ textTransform: "uppercase", fontSize: 11, color: "#5b3fa8", fontWeight: 700, marginRight: 8 }}>
                    {m.material_type}
                  </span>
                  <a href={m.file_url} target="_blank" rel="noreferrer">{m.title}</a>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}