import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../api/client";

export default function CourseEnrollmentPanel({ course }) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inFlight = useRef(false);
  const cancelRef = useRef(null);
  const panelId = `course-students-${course.id}`;

  useEffect(() => { if (pending) cancelRef.current?.focus(); }, [pending]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setStudents([]);
    setPending(null);
    apiFetch(`/courses/${course.id}/students`)
      .then((data) => { if (active) setStudents(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, course.id, refresh]);

  const remove = async () => {
    if (!pending || inFlight.current) return;
    inFlight.current = true;
    setRemoving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/courses/${course.id}/students/${pending.id}`, { method: "DELETE" });
      setStudents((current) => current.filter((student) => student.id !== pending.id));
      setSuccess(`${pending.name} was removed from ${course.name}. Their account and saved academic records were kept.`);
      setPending(null);
    } catch (err) {
      setError(err.message || "Could not remove this enrollment. Please refresh and try again.");
    } finally {
      inFlight.current = false;
      setRemoving(false);
    }
  };

  return (
    <div className="enrollment-panel">
      <button type="button" className="btn btn-soft" aria-expanded={open} aria-controls={panelId}
        disabled={removing} onClick={() => { setOpen(!open); setSuccess(""); }}>
        {open ? "Hide enrolled students" : "Manage enrolled students"}
      </button>
      {open && <section id={panelId} aria-label={`Enrolled students in ${course.name}`}>
        <div className="section-title-row"><h3>Enrolled students{!loading && !error ? ` (${students.length})` : ""}</h3>
          <button className="btn-text" disabled={loading || removing} onClick={() => { setSuccess(""); setRefresh((value) => value + 1); }}>Refresh list</button>
        </div>
        <p className="footnote">Removal affects this course only, not the student’s account or saved work. Self-enrollment remains available, so the student can enroll again. This does not disconnect an ongoing video call.</p>
        {error && <p className="error-banner" role="alert">{error}</p>}
        {success && <p className="success-banner" role="status">{success}</p>}
        {loading ? <p role="status">Loading enrolled students…</p> : <>
          {pending && <div className="enrollment-confirm" role="group" aria-label="Confirm student removal">
            <p>Remove <strong>{pending.name}</strong> ({pending.email}) from <strong>{course.name} ({course.code})</strong>?</p>
            <div className="form-row"><button ref={cancelRef} className="btn btn-ghost" disabled={removing} onClick={() => setPending(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={removing} onClick={remove}>{removing ? "Removing…" : "Confirm removal"}</button></div>
          </div>}
          {!students.length && !error && <p className="footnote">No students are enrolled in this course.</p>}
          {!!students.length && <div className="ledger-wrap"><table className="ledger"><thead><tr><th>Student</th><th>Email</th><th>Department</th><th>Action</th></tr></thead>
            <tbody>{students.map((student) => <tr key={student.id}><td>{student.name}</td><td>{student.email}</td><td>{student.department || "—"}</td>
              <td><button className="btn btn-ghost" disabled={removing || !!pending} aria-label={`Remove ${student.name} from ${course.name}`}
                onClick={() => { setPending(student); setError(""); setSuccess(""); }}>Remove from course</button></td></tr>)}</tbody></table></div>}
        </>}
      </section>}
    </div>
  );
}
