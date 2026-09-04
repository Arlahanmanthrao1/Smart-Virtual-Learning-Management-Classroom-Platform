import { apiFetch } from "./client";

/**
 * Pushes a Jitsi join/leave event to the LMS backend, which records
 * attendance and forwards it to the ERP automatically.
 */
export async function postAttendanceEvent(payload, options = {}) {
  try {
    return await apiFetch("/attendance/event", {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: options.keepalive ?? false,
    });
  } catch (err) {
    console.error("Attendance sync error:", err);
    return null;
  }
}
