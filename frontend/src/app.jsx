import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { dashboardPath, isDashboardPage } from "./components/dashboard/navigation";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/login";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import HodDashboard from "./pages/HodDashboard";
import ClassroomPage from "./pages/ClassroomPage";

function DashboardRouter() {
  const { user } = useAuth();
  const { page = "dashboard" } = useParams();
  if (!isDashboardPage(user.role, page)) return <Navigate to={dashboardPath(user.role)} replace />;
  if (user.role === "student") return <StudentDashboard />;
  if (user.role === "faculty") return <FacultyDashboard />;
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "hod") return <HodDashboard />;
  return <p>Unknown role.</p>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p style={{ padding: 40, fontFamily: "sans-serif" }}>Loading...</p>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" state={{ from: location.pathname }} replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path={`/${user.role}/:page?`} element={<DashboardRouter />} />
      <Route path="/classroom" element={<ClassroomPage />} />
      <Route path="*" element={<Navigate to={
        location.pathname === "/login" && location.state?.from?.startsWith(`/${user.role}/`)
          ? location.state.from : dashboardPath(user.role)
      } replace />} />
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
