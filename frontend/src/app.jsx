import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ClassroomPage from "./pages/ClassroomPage";

function DashboardRouter() {
  const { user } = useAuth();
  if (user.role === "student") return <StudentDashboard />;
  if (user.role === "faculty") return <FacultyDashboard />;
  if (user.role === "admin") return <AdminDashboard />;
  // HOD dashboard isn't built yet - falls back to the faculty view for now
  // since it's the closest match (course/roster visibility).
  if (user.role === "hod") return <FacultyDashboard />;
  return <p>Unknown role.</p>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <p style={{ padding: 40, fontFamily: "sans-serif" }}>Loading...</p>;

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardRouter />} />
      <Route path="/classroom" element={<ClassroomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}