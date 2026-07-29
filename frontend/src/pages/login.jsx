import { useState } from "react";
import { useAuth } from "../context/AuthContext";

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
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h2>LMS Platform</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Sign in with your college email.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@college.edu"
          required
          style={{ width: "100%", padding: 10, marginBottom: 16, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 16, boxSizing: "border-box" }}
        />

        {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: 10,
            background: "#0f5c4a",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}