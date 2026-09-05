import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import DashboardShell, { EmptyState } from "../components/dashboard/DashboardShell";
import { dashboardPath } from "../components/dashboard/navigation";
import { dayKey, groupEvents, monthDays, monthRange } from "../components/dashboard/calendarDates";
import "../styles/calendar.css";
import "../styles/dashboard.css";

const fullDate = date => date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const time = value => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const eventPage = (role, event) => {
  if (event.status === "scheduled" && role === "faculty") return "schedule";
  if (role === "student") return event.kind === "assignment" ? "academic-assignments" : "academic-courses";
  return event.kind === "assignment" && role !== "hod" ? "assignments" : "courses";
};

export function CalendarView({ month, selected, events, loading, error, onMonth, onSelect, onRetry, role }) {
  const grouped = useMemo(() => groupEvents(events), [events]);
  const selectedEvents = grouped[dayKey(selected)] || [];
  const today = dayKey(new Date());
  return <>
    <p className="calendar-description">{role === "hod" ? "Your department’s" : role === "faculty" ? "Your courses’" : "Your enrolled courses’"} assignment deadlines and class dates. Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
    <div className="calendar-toolbar">
      <h2 aria-live="polite">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
      <div className="calendar-controls">
        <button className="btn btn-soft" aria-label="Previous month" onClick={() => onMonth(-1)}>←</button>
        <button className="btn btn-soft" onClick={() => onSelect(new Date())}>Today</button>
        <button className="btn btn-soft" aria-label="Next month" onClick={() => onMonth(1)}>→</button>
      </div>
    </div>
    <div className="calendar-legend"><span className="calendar-dot assignment"/>Assignment due <span className="calendar-dot class"/>Class scheduled or started</div>
    {error && <div className="calendar-error" role="alert">{error} <button className="btn btn-soft" onClick={onRetry}>Retry</button></div>}
    {loading && <p role="status">Loading calendar…</p>}
    <div className="calendar-layout" aria-busy={loading}>
      <section className="calendar-month" aria-label="Choose a date">
        <div className="calendar-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {monthDays(month).map(date => {
            const key = dayKey(date);
            const inMonth = date.getMonth() === month.getMonth();
            const items = !loading && !error ? grouped[key] || [] : [];
            return <button key={key} type="button" disabled={!inMonth} onClick={() => onSelect(date)}
              className={`calendar-day ${key === dayKey(selected) ? "selected" : ""}`}
              aria-pressed={key === dayKey(selected)} aria-current={key === today ? "date" : undefined}
              aria-label={`${fullDate(date)}${inMonth && !loading && !error ? `, ${items.length} events` : ""}`}>
              <span className="calendar-date-number">{date.getDate()}</span>
              <span className="calendar-cell-events" aria-hidden="true">{items.slice(0, 2).map(event => <span key={event.id} className={`calendar-event-label ${event.kind}`}>{event.course_code} · {event.kind === "assignment" ? event.title : event.status === "scheduled" ? event.title : "Class"}</span>)}{items.length > 2 && <span className="calendar-more">+{items.length - 2} more</span>}</span>
              {items.length > 0 && <span className="calendar-mobile-count" aria-hidden="true">{items.length}</span>}
            </button>;
          })}
        </div>
        {!loading && !error && events.length === 0 && <EmptyState>No dated events this month.</EmptyState>}
      </section>
      <section className="calendar-agenda" aria-label="Selected date events" aria-live="polite">
        <p className="section-eyebrow">Daily agenda</p><h2>{fullDate(selected)}</h2>
        {!loading && !error && (selectedEvents.length ? <ul>{selectedEvents.map(event => <li key={event.id} className={`calendar-agenda-item ${event.kind}`}>
          <span className="calendar-event-type">{event.kind === "assignment" ? "Assignment due" : event.status === "scheduled" ? "Class scheduled" : event.status === "ended" ? "Class ended" : "Class started"} · {time(event.starts_at)}</span>
          <h3>{event.title}</h3><p>{event.course_code} · {event.course_name}</p>
          {event.ended_at && <p>Ended {new Date(event.ended_at).toLocaleString()}</p>}
          <Link to={dashboardPath(role, eventPage(role, event))}>{event.status === "scheduled" && role === "faculty" ? "Manage schedule" : event.kind === "assignment" && role !== "hod" ? "View assignments" : "View courses"} →</Link>
        </li>)}</ul> : <EmptyState>No dated events on this day.</EmptyState>)}
        <p className="calendar-note">Quizzes and assignments without a due date aren’t shown. A planned class becomes a live class only when faculty starts it.</p>
      </section>
    </div>
  </>;
}

export default function CalendarPage() {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [data, setData] = useState({ events: [], loading: true, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let timer;
    setData({ events: [], loading: true, error: "" });
    async function load() {
      try {
        const events = await apiFetch(`/calendar/events?${new URLSearchParams(monthRange(month))}`);
        if (active) setData({ events, loading: false, error: "" });
      } catch (error) {
        if (active) setData({ events: [], loading: false, error: error.message || "Calendar could not load." });
      } finally {
        if (active) timer = setTimeout(load, 30000);
      }
    }
    load();
    return () => { active = false; clearTimeout(timer); };
  }, [month, retry, user.id]);
  const select = date => {
    setSelected(date);
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };
  return <DashboardShell user={user} title="Calendar" roleLabel={user.role === "hod" ? "HOD" : user.role === "faculty" ? "Faculty" : "Student"} onLogout={logout}>
    <CalendarView month={month} selected={selected} {...data} role={user.role} onSelect={select}
      onMonth={delta => select(new Date(month.getFullYear(), month.getMonth() + delta, 1))} onRetry={() => setRetry(value => value + 1)} />
  </DashboardShell>;
}
