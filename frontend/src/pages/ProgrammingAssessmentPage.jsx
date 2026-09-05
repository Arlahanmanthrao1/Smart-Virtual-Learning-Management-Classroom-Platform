import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import DashboardShell, { EmptyState } from "../components/dashboard/DashboardShell";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";
import "../styles/programming.css";

const languageLabels = { python: "Python 3", java: "Java", c: "C", "c++": "C++", javascript: "JavaScript" };

export default function ProgrammingAssessmentPage() {
  const { assessmentId } = useParams();
  const { user, logout } = useAuth();
  const [assessment, setAssessment] = useState(null);
  const [language, setLanguage] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [execution, setExecution] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch(`/programming/assessments/${assessmentId}`).then(data => {
      if (!active) return;
      setAssessment(data); setLanguage(data.allowed_languages[0] || ""); setSourceCode(data.starter_code || "");
      const sample = data.test_cases.find(test => !test.is_hidden);
      setStdin(sample?.stdin || "");
    }).catch(loadError => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [assessmentId]);

  const run = async () => {
    setBusy("run"); setError(""); setExecution(null);
    try { setExecution(await apiFetch("/programming/run", { method: "POST", body: JSON.stringify({ assessment_id: Number(assessmentId), language, source_code: sourceCode, stdin }) })); }
    catch (runError) { setError(runError.message); }
    finally { setBusy(""); }
  };
  const submit = async () => {
    setBusy("submit"); setError(""); setSubmission(null);
    try { setSubmission(await apiFetch(`/programming/assessments/${assessmentId}/submit`, { method: "POST", body: JSON.stringify({ language, source_code: sourceCode }) })); }
    catch (submitError) { setError(submitError.message); }
    finally { setBusy(""); }
  };

  if (!assessment && !error) return <DashboardShell user={user} title="Programming assessment" roleLabel="Student" onLogout={logout} activePage="programming-assessments"><p role="status">Loading assessment…</p></DashboardShell>;
  if (!assessment) return <DashboardShell user={user} title="Programming assessment" roleLabel="Student" onLogout={logout} activePage="programming-assessments"><p className="error-banner" role="alert">{error}</p><Link className="btn btn-soft" to="/student/programming-assessments">← Back to assessments</Link></DashboardShell>;
  const visibleTests = assessment.test_cases.filter(test => !test.is_hidden);
  return <DashboardShell user={user} title={assessment.title} roleLabel="Student" onLogout={logout} activePage="programming-assessments">
    <Link className="course-back-link" to="/student/programming-assessments">← Programming assessments</Link>
    <header className="programming-hero"><div><span className="course-code">{assessment.course_code}</span><h1>{assessment.title}</h1><p>{assessment.course_name}</p></div><span className="pill pill-muted">{assessment.test_count} test case{assessment.test_count === 1 ? "" : "s"}</span></header>
    {assessment.description && <section className="card panel-card programming-problem"><p className="section-eyebrow">Problem statement</p><p>{assessment.description}</p></section>}
    <div className="programming-layout"><section className="card panel-card programming-editor"><div className="programming-toolbar"><label>Language<select className="field" value={language} onChange={event => setLanguage(event.target.value)}>{assessment.allowed_languages.map(value => <option value={value} key={value}>{languageLabels[value] || value}</option>)}</select></label><div><button className="btn btn-soft" disabled={Boolean(busy) || !sourceCode.trim()} onClick={run}>{busy === "run" ? "Running…" : "Run code"}</button><button className="btn btn-primary" disabled={Boolean(busy) || !sourceCode.trim()} onClick={submit}>{busy === "submit" ? "Checking…" : "Submit all tests"}</button></div></div><textarea className="code-editor" aria-label="Source code" spellCheck="false" value={sourceCode} onChange={event => setSourceCode(event.target.value)} placeholder="Write your solution here…" /><label className="field-label">Custom input<textarea className="field code-input" rows="5" value={stdin} onChange={event => setStdin(event.target.value)} /></label></section>
      <aside className="programming-results"><section className="card panel-card"><p className="section-eyebrow">Sample cases</p><h2>Visible test cases</h2>{!visibleTests.length && <EmptyState>All test cases are hidden.</EmptyState>}{visibleTests.map((test,index) => <div className="programming-sample" key={test.id}><strong>Sample {index + 1}</strong><span>Input</span><pre>{test.stdin || "No input"}</pre><span>Expected output</span><pre>{test.expected_output}</pre></div>)}</section>{execution && <section className="card panel-card"><p className="section-eyebrow">Run result</p><h2>{execution.exit_code === 0 ? "Finished" : "Execution error"}</h2><pre className="programming-output">{execution.output || execution.stderr || execution.compile_output || "No output"}</pre></section>}{submission && <section className="card panel-card"><p className="section-eyebrow">Submission result</p><h2>{submission.passed_count}/{submission.total_count} passed · {submission.score}%</h2>{submission.results.map(result => <div className="programming-case-result" key={result.case}><span className={`pill ${result.passed ? "pill-ok" : "pill-risk"}`}>Test {result.case}: {result.passed ? "Passed" : "Failed"}</span>{!result.hidden && !result.passed && <><span>Your output</span><pre>{result.output || result.stderr || "No output"}</pre><span>Expected</span><pre>{result.expected_output}</pre></>}</div>)}</section>}</aside></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
  </DashboardShell>;
}
