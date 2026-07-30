import { useLocation, useNavigate } from "react-router-dom";
import Classroom from "../components/classroom/Classroom";

export default function ClassroomPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = location.state;

  if (!session) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        <p>No active class session. Go back to your dashboard and click Join.</p>
        <button onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 12, background: "none", border: "1px solid #ccc", borderRadius: 6, padding: "6px 12px" }}>
        ← Back to dashboard
      </button>
      <h2>{session.courseName}</h2>
      <p style={{ color: "#666", fontSize: 14 }}>
        Joining marks attendance automatically - check your dashboard and the ERP after you join.
      </p>
      <Classroom
        roomId={session.roomId}
        courseId={session.courseId}
        studentId={session.studentId}
        studentName={session.studentName}
        sessionId={session.sessionId}
        isFaculty={session.isFaculty}
      />
    </div>
  );
}