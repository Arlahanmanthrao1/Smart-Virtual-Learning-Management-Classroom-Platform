import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    course_id: "",
    title: "",
    material_type: "notes",
    file_url: "",
    description: "",
  });

  useEffect(() => {
    apiFetch("/courses/").then(setCourses).catch((err) => setError(err.message));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await apiFetch("/materials/", {
        method: "POST",
        body: JSON.stringify({ ...form, course_id: Number(form.course_id) }),
      });
      setSuccess("Material uploaded.");
      setForm({ course_id: "", title: "", material_type: "notes", file_url: "", description: "" });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Welcome, {user.name}</h2>
        <button onClick={logout} style={{ background: "none", border: "1px solid #ccc", borderRadius: 6, padding: "6px 12px" }}>
          Log out
        </button>
      </div>

      <h3>Upload study material</h3>
      <p style={{ color: "#666", fontSize: 13 }}>
        Note: this expects a link to an already-uploaded file (e.g. from S3)
        - direct file upload from the browser isn't wired up yet.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <select
          value={form.course_id}
          onChange={(e) => setForm({ ...form, course_id: e.target.value })}
          required
          style={{ padding: 10 }}
        >
          <option value="">Select course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>

        <input
          placeholder="Title (e.g. Unit 3 Notes)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          style={{ padding: 10 }}
        />

        <select
          value={form.material_type}
          onChange={(e) => setForm({ ...form, material_type: e.target.value })}
          style={{ padding: 10 }}
        >
          <option value="notes">Notes</option>
          <option value="exam">Exam</option>
          <option value="pyq">Previous Year Questions</option>
        </select>

        <input
          placeholder="File URL"
          value={form.file_url}
          onChange={(e) => setForm({ ...form, file_url: e.target.value })}
          required
          style={{ padding: 10 }}
        />

        <textarea
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{ padding: 10 }}
        />

        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
        {success && <p style={{ color: "#1a7f37" }}>{success}</p>}

        <button
          type="submit"
          style={{ background: "#0f5c4a", color: "white", border: "none", borderRadius: 6, padding: 10 }}
        >
          Upload
        </button>
      </form>
    </div>
  );
}