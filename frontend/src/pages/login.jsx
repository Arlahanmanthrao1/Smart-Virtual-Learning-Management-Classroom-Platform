import { useState } from "react";
import { Icon } from "../components/dashboard/DashboardShell";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-art">
        <div className="login-art-badge"><Icon name="courses" size={22} /> Smart Virtual Learning</div>
        <div><h1>Your campus,<br />connected.</h1><p>Classes, attendance, coursework, and academic resources in one focused learning space.</p></div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-logo"><span className="brand-mark"><Icon name="courses" size={22} /></span> LMS Platform</div>
          <h2>Welcome back</h2><p>Sign in with your approved college account.</p>
          <form onSubmit={handleSubmit} className="login-form">
            <label className="field-label">College email<input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@hitam.org" required autoComplete="email" /></label>
            <label className="field-label">Password<input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
            {error && <p className="error-banner">{error}</p>}
            <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="auth-switch">Need an account? Contact your college administrator.</p>
        </div>
      </section>
    </div>
  );
}
