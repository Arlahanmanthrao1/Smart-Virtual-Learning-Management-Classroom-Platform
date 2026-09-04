import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { dashboardNavigation, dashboardPath } from "./navigation";

const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  courses: <><path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12.5V17l5 3 5-3v-4.5"/></>,
  assignments: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4"/></>,
  quiz: <><path d="M8.5 9a3.5 3.5 0 1 1 5.6 2.8c-1.3 1-2.1 1.5-2.1 3.2"/><path d="M12 19h.01"/><circle cx="12" cy="12" r="10"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  video: <><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-3v10l-4-3"/></>,
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 20h14"/></>,
  chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/></>,
  alert: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  material: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
  department: <><path d="M3 21h18M6 21V9h12v12M9 13h2m2 0h2m-6 4h2m2 0h2M8 9V5h8v4"/></>,
  check: <><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
};

export function Icon({ name, size = 20 }) {
  return (
    <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.dashboard}
    </svg>
  );
}

export function StatCard({ icon, label, value, tone = "blue", detail }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon stat-${tone}`}><Icon name={icon} size={22} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

export default function DashboardShell({ user, title, roleLabel, onLogout, searchPlaceholder, searchValue, onSearch, children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { page = "dashboard" } = useParams();
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const navItems = dashboardNavigation[user.role];
  const currentPage = navItems.find((item) => item.id === page);
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    setMobileNavOpen(false);
    onSearch?.("");
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current?.focus({ preventScroll: true });
    document.title = `${currentPage?.label || "Dashboard"} · ${title}`;
  }, [pathname, currentPage?.label, title, onSearch]);

  return (
    <div className="portal-shell">
      <aside className={`portal-sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="profile-block">
          <div className="avatar">{initials}</div>
          <div><strong>{user.name}</strong><span>{user.department || roleLabel}</span></div>
        </div>
        <nav className="portal-nav" aria-label="Dashboard sections">
          {navItems.map((item) => (
            <NavLink key={item.id} to={dashboardPath(user.role, item.id)} end onClick={() => setMobileNavOpen(false)}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="sidebar-logout" onClick={onLogout}><Icon name="logout" /> Sign out</button>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation" aria-expanded={mobileNavOpen}>☰</button>
          <Link className="portal-brand" to={dashboardPath(user.role)}><span className="brand-mark"><Icon name="courses" size={22} /></span>{title}</Link>
          {onSearch && (
            <label className="search-box">
              <Icon name="search" size={18} />
              <input value={searchValue} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder || "Search…"} />
            </label>
          )}
          <div className="top-avatar">{initials}</div>
        </header>
        <main className="portal-content" ref={mainRef} tabIndex={-1}>
          {page !== "dashboard" && <div className="page-heading"><p className="section-eyebrow">{roleLabel}</p><h1>{currentPage?.label}</h1></div>}
          {children}
        </main>
      </div>
    </div>
  );
}
