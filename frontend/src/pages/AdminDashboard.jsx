import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import DashboardShell, { EmptyState, Icon, StatCard } from "../components/dashboard/DashboardShell";
import { useAuth } from "../context/AuthContext";
import { BrandLoading } from "../branding/Brand";
import AccountEditor from "../components/dashboard/AccountEditor";
import InstitutionProfile from "../components/dashboard/InstitutionProfile";
import AccountRegistrationForm from "../components/dashboard/AccountRegistrationForm";
import "../styles/dashboard.css";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { page = "dashboard" } = useParams();
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingAccount, setEditingAccount] = useState(null);
  const [departmentRecords, setDepartmentRecords] = useState([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ course_id: "", title: "", material_type: "notes", file_url: "", description: "" });

  useEffect(() => {
    Promise.all([apiFetch("/courses/"), apiFetch("/users/"), apiFetch("/institutions/departments")])
      .then(([courseData, userData, departmentData]) => { setCourses(courseData); setUsers(userData); setDepartmentRecords(departmentData); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await apiFetch("/materials/", { method: "POST", body: JSON.stringify({ ...form, course_id: Number(form.course_id) }) });
      setSuccess("Study material published successfully.");
      setForm({ course_id: "", title: "", material_type: "notes", file_url: "", description: "" });
    } catch (err) { setError(err.message); }
  };

  const createDepartment = async (event) => {
    event.preventDefault(); setError(""); setSuccess(""); setCreatingDepartment(true);
    try {
      const department = await apiFetch("/institutions/departments", { method: "POST", body: JSON.stringify({ name: newDepartment }) });
      setDepartmentRecords((current) => [...current, department]); setNewDepartment(""); setSuccess("Department created. You can now assign HODs, faculty and students to it.");
    } catch (err) { setError(err.message); }
    finally { setCreatingDepartment(false); }
  };

  const students = users.filter((entry) => entry.role === "student");
  const faculty = users.filter((entry) => entry.role === "faculty");
  const hods = users.filter((entry) => entry.role === "hod");
  const departments = departmentRecords.map((department) => department.name);
  const filteredCourses = useMemo(() => courses.filter((course) => `${course.name} ${course.code} ${course.department || ""}`.toLowerCase().includes(search.toLowerCase())), [courses, search]);

  if (loading) return <BrandLoading>Preparing the administration portal…</BrandLoading>;

  return (
    <DashboardShell user={user} title={user.institution?.name || "Administration"} roleLabel="Administrator" onLogout={logout} searchValue={search} onSearch={setSearch} searchPlaceholder="Search users, courses, departments…">
      {page === "dashboard" && (<section className="page-hero" id="dashboard"><div><h1>Welcome, Administrator <span className="wave">👋</span></h1><p>Manage accounts and courses within your institution.</p></div><div className="hero-actions"><Link className="btn btn-primary" to="/admin/materials"><Icon name="upload" /> Upload material</Link></div></section>)}
      {error && <p className="error-banner">{error}</p>}
      {success && <p className="success-banner">{success}</p>}
      {page === "register-student" && (<AccountRegistrationForm departments={departmentRecords} onCreated={(account) => setUsers((current) => [account, ...current])} />)}
      {page === "register-faculty" && (<AccountRegistrationForm accountType="faculty" departments={departmentRecords} onCreated={(account) => setUsers((current) => [account, ...current])} />)}
      {page === "register-hod" && <AccountRegistrationForm accountType="hod" departments={departmentRecords} onCreated={(account) => setUsers((current) => [account, ...current])} />}
      {page === "institution" && <InstitutionProfile />}
      {page === "users" && editingAccount && <AccountEditor key={editingAccount.id} account={editingAccount} departments={departmentRecords} onCancel={() => setEditingAccount(null)} onSaved={(account) => { setUsers((current) => current.map((entry) => entry.id === account.id ? account : entry)); setEditingAccount(null); setSuccess("Account updated."); }} />}
      {page === "dashboard" && <section className="stats-grid stats-six">
        <StatCard icon="users" label="Total students" value={students.length} tone="blue" />
        <StatCard icon="users" label="Faculty" value={faculty.length} tone="green" />
        <StatCard icon="users" label="HODs" value={hods.length} tone="amber" />
        <StatCard icon="department" label="Departments" value={departments.length} tone="purple" />
        <StatCard icon="courses" label="Courses" value={courses.length} tone="blue" />
        <StatCard icon="users" label="Total accounts" value={users.length} tone="green" />
      </section>}
      {page === "dashboard" && <div className="page-actions"><Link className="btn btn-primary" to="/admin/register-student">Register student</Link><Link className="btn btn-soft" to="/admin/register-faculty">Create faculty</Link><Link className="btn btn-soft" to="/admin/register-hod">Create HOD</Link><Link className="btn btn-soft" to="/admin/departments">Manage departments</Link><Link className="btn btn-soft" to="/admin/users">View users</Link></div>}

      <div className="page-grid">
        <div className="content-stack">
          {page === "users" && (<section className="card panel-card" id="users"><div className="section-title-row"><div><p className="section-eyebrow">Platform activity</p><h2 className="section-title">User directory</h2></div><span className="pill pill-ok">{users.length} accounts</span></div>{!users.length ? <EmptyState>No user accounts are available.</EmptyState> : <div className="ledger-wrap"><table className="ledger"><thead><tr><th>User</th><th>Role</th><th>Department</th><th>Email</th><th>Manage</th></tr></thead><tbody>{users.filter((entry) => `${entry.name} ${entry.email} ${entry.department || ""} ${entry.role}`.toLowerCase().includes(search.toLowerCase())).map((entry) => <tr key={entry.id}><td><div className="person-cell"><span className="person-initial">{entry.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><strong>{entry.name}</strong></div></td><td><span className="pill pill-muted">{entry.role}</span></td><td>{entry.department || "—"}</td><td className="mono-cell">{entry.email}</td><td><button className="btn-text" onClick={() => setEditingAccount(entry)}>Edit account</button></td></tr>)}</tbody></table></div>}</section>)}
          {page === "courses" && (<section className="section" id="courses"><div className="section-title-row"><div><p className="section-eyebrow">Institution catalogue</p><h2 className="section-title">Course overview</h2></div></div>{!filteredCourses.length ? <EmptyState>No course matches your search.</EmptyState> : <div className="ledger-wrap"><table className="ledger"><thead><tr><th>Course</th><th>Code</th><th>Type</th><th>Department</th><th>Semester</th><th>Faculty ID</th></tr></thead><tbody>{filteredCourses.map((course) => <tr key={course.id}><td><strong>{course.name}</strong></td><td><span className="course-code">{course.code}</span></td><td><span className="pill pill-muted">{course.course_type === "non_academic" ? "Non-Academic" : "Academic"}</span></td><td>{course.department || "—"}</td><td>{course.semester || "—"}</td><td>{course.faculty_id || "Unassigned"}</td></tr>)}</tbody></table></div>}</section>)}
        </div>

        <aside className="content-stack">
          {page === "dashboard" && (<section className="card panel-card system-panel"><div className="section-title-row"><h3><Icon name="chart" /> Data coverage</h3></div><div className="status-line"><span>Registered accounts</span><strong>{users.length}</strong></div><div className="status-line"><span>Courses with faculty</span><strong>{courses.filter((course) => course.faculty_id).length}</strong></div><div className="status-line"><span>Unassigned courses</span><strong>{courses.filter((course) => !course.faculty_id).length}</strong></div></section>)}
          {page === "departments" && (<section className="card panel-card" id="departments"><div className="section-title-row"><h3>Departments</h3><Icon name="department" /></div><form onSubmit={createDepartment}><label className="field-label">New department name<input className="field" value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} minLength={2} maxLength={120} required /></label><button className="btn btn-primary" disabled={creatingDepartment}>{creatingDepartment ? "Creating…" : "Create department"}</button></form>{!departments.length && <p className="footnote">No departments are present in the returned records.</p>}{departments.filter((department) => department.toLowerCase().includes(search.toLowerCase())).map((department) => <div className="item-row" key={department}><strong>{department}</strong></div>)}</section>)}
        </aside>
      </div>

      {page === "materials" && (<section className="section card panel-card material-panel" id="materials"><div className="section-title-row"><div><p className="section-eyebrow">Resource management</p><h2 className="section-title">Upload study material</h2></div><Icon name="upload" size={26} /></div><p className="footnote material-note">Publish notes, exams, or previous-year questions using a hosted file link.</p><form onSubmit={handleSubmit} className="form-grid"><label className="field-label">Course<select className="field" value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })} required><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name} ({course.code})</option>)}</select></label><label className="field-label">Material type<select className="field" value={form.material_type} onChange={(event) => setForm({ ...form, material_type: event.target.value })}><option value="notes">Notes</option><option value="exam">Exam</option><option value="pyq">Previous Year Questions</option></select></label><label className="field-label">Title<input className="field" placeholder="Unit 3 Notes" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label className="field-label">Hosted file URL<input className="field" type="url" placeholder="https://…" value={form.file_url} onChange={(event) => setForm({ ...form, file_url: event.target.value })} required /></label><label className="field-label wide">Description<textarea className="field" placeholder="Optional description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="wide"><button type="submit" className="btn btn-primary"><Icon name="upload" /> Publish material</button></div></form></section>)}
    </DashboardShell>
  );
}
