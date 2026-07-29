import { useEffect, useRef } from "react";
import { postAttendanceEvent } from "../../api/attendanceApi";

const JITSI_SCRIPT_URL = "https://meet.jit.si/external_api.js";

function loadJitsiScript() {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load the Jitsi script"));
    document.body.appendChild(script);
  });
}

/**
 * Embeds a Jitsi Meet room directly in the page and reports the local
 * user's own join/leave as attendance events.
 *
 * BRANDING NOTE: SHOW_JITSI_WATERMARK / SHOW_BRAND_WATERMARK below are
 * included because they're the correct config for hiding Jitsi's logo -
 * but the public meet.jit.si server silently ignores them (confirmed
 * across years of reports on Jitsi's own forum; this isn't a bug in this
 * code). They start working for real once self-hosted - see
 * self-hosted-jitsi/ in the repo root, and swap the domain below from
 * "meet.jit.si" to your own once deployed.
 *
 * Until then, the CSS overlay in the corner is the practical fix: it sits
 * on top of the iframe and covers Jitsi's watermark with our own badge.
 * It's a visual cover, not real removal - fine for a demo, not a
 * substitute for the self-hosted fix long-term.
 */
export default function Classroom({ roomId, courseId, studentId, studentName }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    loadJitsiScript().then(() => {
      if (cancelled || !containerRef.current) return;

      const api = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName: roomId,
        parentNode: containerRef.current,
        userInfo: { displayName: studentName },
        width: "100%",
        height: 500,
        configOverwrite: {
          prejoinConfig: { enabled: false },
        },
        interfaceConfigOverwrite: {
          APP_NAME: "LMS Platform",
          NATIVE_APP_NAME: "LMS Platform",
          PROVIDER_NAME: "LMS Platform",
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          TOOLBAR_BUTTONS: ["microphone", "camera", "desktop", "chat", "raisehand", "tileview", "hangup"],
        },
      });
      apiRef.current = api;

      const sendEvent = (eventType) => {
        postAttendanceEvent({
          room_id: roomId,
          course_id: courseId,
          student_id: studentId,
          event_type: eventType,
          timestamp: new Date().toISOString(),
        });
      };

      api.addEventListener("videoConferenceJoined", () => sendEvent("joined"));
      api.addEventListener("videoConferenceLeft", () => sendEvent("left"));
    });

    return () => {
      cancelled = true;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, courseId, studentId, studentName]);

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", minHeight: 500 }}>
      <div ref={containerRef} style={{ minHeight: 500, background: "#111" }} />

      {/* Covers the corner where Jitsi's watermark renders (public server
          only - see the note above). Positioned to sit on top of the
          iframe visually; adjust top/left if Jitsi's layout shifts it. */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "rgba(15, 92, 74, 0.9)",
          color: "white",
          padding: "6px 12px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "sans-serif",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        LMS Platform
      </div>
    </div>
  );
}