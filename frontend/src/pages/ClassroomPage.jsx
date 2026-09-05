import { useLocation, useNavigate } from "react-router-dom";
import Classroom from "../components/classroom/classroom";
import { Icon } from "../components/dashboard/DashboardShell";
import { BrandLogo, BrandMark, usePageTitle } from "../branding/Brand";
import "../styles/dashboard.css";

export default function ClassroomPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = location.state;
  usePageTitle(session?.courseName ? `${session.courseName} — Classroom` : "Classroom");

  if (!session) {
    return (
      <div className="empty-classroom">
        <BrandMark size={58} />
        <h2>No active class session</h2>
        <p>Return to your dashboard and join or start a live class.</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="classroom-page">
      <header className="classroom-topbar">
        <div className="classroom-title"><BrandLogo /></div>
        <div className="classroom-course"><strong>{session.courseName}</strong><span><i className="live-indicator" /> LIVE · Attendance is tracked automatically</span></div>
        <button onClick={() => navigate(-1)} className="btn btn-danger"><Icon name="logout" size={17} /> Leave</button>
        <span className="top-avatar">{session.studentName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
      </header>
      <main className="classroom-layout">
        <Classroom roomId={session.roomId} courseId={session.courseId} studentId={session.studentId} studentName={session.studentName} sessionId={session.sessionId} isFaculty={session.isFaculty} />
      </main>
    </div>
  );
}
