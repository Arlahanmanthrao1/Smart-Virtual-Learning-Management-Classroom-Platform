const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Pushes a Jitsi join/leave event to the LMS backend, which records
 * attendance and forwards it to the ERP automatically.
 */
export async function postAttendanceEvent(payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/attendance/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Attendance sync failed:", await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Attendance sync error:", err);
    return null;
  }
}