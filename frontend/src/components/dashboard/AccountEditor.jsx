import { useState } from "react";
import { apiFetch } from "../../api/client";

export default function AccountEditor({ account, departments, onSaved, onCancel }) {
  const [name, setName] = useState(account.name);
  const [department, setDepartment] = useState(account.department || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const saved = await apiFetch(`/users/${account.id}`, { method: "PATCH", body: JSON.stringify({ name, department: department || null }) });
      onSaved(saved);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="card panel-card"><h2>Edit {account.name}</h2>
    <p>{account.email} · {account.role}. Updating a department changes HOD visibility immediately; course ownership and enrollments are preserved.</p>
    <form className="form-grid" onSubmit={submit}>
      <label className="field-label">Name<input className="field" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} /></label>
      <label className="field-label">Department<select className="field" value={department} onChange={(event) => setDepartment(event.target.value)} required={account.role !== "admin"}><option value="">Select department</option>{departments.map((entry) => <option key={entry.id} value={entry.name}>{entry.name}</option>)}</select></label>
      {error && <p className="error-banner wide" role="alert">{error}</p>}
      <div className="wide hero-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save account"}</button><button className="btn btn-soft" type="button" onClick={onCancel} disabled={busy}>Cancel</button></div>
    </form>
  </section>;
}
