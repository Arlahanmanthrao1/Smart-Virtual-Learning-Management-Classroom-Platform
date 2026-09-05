import { useState } from "react";
import { apiFetch } from "../../api/client";

const languages = [
  ["python", "Python 3"], ["java", "Java"], ["c", "C"], ["c++", "C++"], ["javascript", "JavaScript"],
];
const emptyCase = () => ({ stdin: "", expected_output: "", is_hidden: false, points: 1 });

export default function ProgrammingAssessmentForm({ course, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", starter_code: "", allowed_languages: ["python"], test_cases: [emptyCase()] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const updateCase = (index, values) => setForm(current => ({ ...current, test_cases: current.test_cases.map((test, position) => position === index ? { ...test, ...values } : test) }));
  const toggleLanguage = language => setForm(current => ({ ...current, allowed_languages: current.allowed_languages.includes(language) ? current.allowed_languages.filter(value => value !== language) : [...current.allowed_languages, language] }));
  const submit = async event => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await apiFetch("/programming/assessments", { method: "POST", body: JSON.stringify({ ...form, course_id: course.id }) });
      onCreated();
    } catch (submitError) { setError(submitError.message); }
    finally { setBusy(false); }
  };
  return <form className="programming-builder" onSubmit={submit}>
    <div className="form-grid"><label className="field-label">Title<input className="field" value={form.title} maxLength={200} required onChange={event => setForm({ ...form, title: event.target.value })} /></label><label className="field-label wide">Problem statement<textarea className="field" rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><label className="field-label wide">Starter code (optional)<textarea className="field code-input" rows="6" spellCheck="false" value={form.starter_code} onChange={event => setForm({ ...form, starter_code: event.target.value })} /></label></div>
    <fieldset className="programming-languages"><legend>Allowed languages</legend>{languages.map(([value,label]) => <label key={value}><input type="checkbox" checked={form.allowed_languages.includes(value)} onChange={() => toggleLanguage(value)} /> {label}</label>)}</fieldset>
    <div className="section-title-row"><div><p className="section-eyebrow">Automatic checking</p><h3>Test cases</h3></div><button className="btn btn-soft" type="button" disabled={form.test_cases.length >= 5} onClick={() => setForm(current => ({ ...current, test_cases: [...current.test_cases, emptyCase()] }))}>Add test case</button></div>
    {form.test_cases.map((test, index) => <fieldset className="programming-test-builder" key={index}><legend>Test case {index + 1}</legend><label className="field-label">Input (stdin)<textarea className="field code-input" rows="3" value={test.stdin} onChange={event => updateCase(index, { stdin: event.target.value })} /></label><label className="field-label">Expected output<textarea className="field code-input" rows="3" required value={test.expected_output} onChange={event => updateCase(index, { expected_output: event.target.value })} /></label><label className="field-label">Points<input className="field" type="number" min="0.1" max="100" step="0.1" value={test.points} onChange={event => updateCase(index, { points: Number(event.target.value) })} /></label><label className="programming-hidden-toggle"><input type="checkbox" checked={test.is_hidden} onChange={event => updateCase(index, { is_hidden: event.target.checked })} /> Hide this test case from students</label>{form.test_cases.length > 1 && <button className="btn-text" type="button" onClick={() => setForm(current => ({ ...current, test_cases: current.test_cases.filter((_, position) => position !== index) }))}>Remove test case</button>}</fieldset>)}
    {error && <p className="error-banner" role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={busy || !form.allowed_languages.length}>{busy ? "Publishing…" : "Publish programming assessment"}</button>
  </form>;
}
