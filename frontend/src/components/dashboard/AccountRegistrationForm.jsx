import { useState } from "react";
import { createStudent, createFaculty, createHod } from "../../api/client";

const emptyForm = { name: "", email: "", department: "", password: "", confirmPassword: "" };

export default function AccountRegistrationForm({ accountType = "student", onCreated, departments = [] }) {
  const isFaculty = accountType === "faculty";
  const isHod = accountType === "hod";
  const label = isHod ? "HOD" : isFaculty ? "Faculty" : "Student";
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const account = await (isHod ? createHod : isFaculty ? createFaculty : createStudent)({ name: form.name, email: form.email,
        department: form.department || null, password: form.password });
      onCreated(account);
      setForm(emptyForm);
      setSuccess(`${label} account created for ${account.name}. Share their login details privately.`);
    } catch (err) {
      setError(err.message || `Could not create ${label.toLowerCase()} account.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section card panel-card" id={`register-${accountType}`}>
      <div className="section-title-row"><div><p className="section-eyebrow">Administrator access</p><h2 className="section-title">{isHod ? "Create HOD" : isFaculty ? "Create faculty" : "Register student"}</h2></div></div>
      <p className="footnote">Create a {label.toLowerCase()} login using their approved college email. {isHod ? "HODs can view only faculty and students in their assigned department; they cannot administer accounts." : isFaculty ? "Faculty can access only their courses and enrolled students." : "Students cannot register themselves."} Share credentials privately; no email is sent automatically.</p>
      {!departments.length && <p className="footnote">Create a department first using the Departments page.</p>}
      <form onSubmit={submit} className="form-grid">
        <label className="field-label">Full name<input className="field" name="name" value={form.name} onChange={update} required minLength={2} maxLength={120} autoComplete="off" /></label>
        <label className="field-label">College email<input className="field" name="email" type="email" value={form.email} onChange={update} required autoComplete="off" /></label>
        <label className="field-label">Department<select className="field" name="department" value={form.department} onChange={update} required><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}</select></label>
        <label className="field-label">Password<input className="field" name="password" type="password" value={form.password} onChange={update} required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        <label className="field-label">Confirm password<input className="field" name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        {error && <p className="error-banner wide" role="alert">{error}</p>}
        {success && <p className="success-banner wide" role="status">{success}</p>}
        <div className="wide"><button type="submit" disabled={submitting || !departments.length} className="btn btn-primary">{submitting ? "Creating account…" : `Create ${label.toLowerCase()} account`}</button></div>
      </form>
    </section>
  );
}
