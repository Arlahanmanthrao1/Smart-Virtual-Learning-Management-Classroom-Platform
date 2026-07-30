import { useEffect, useRef, useState } from "react";
import { postAttendanceEvent } from "../../api/attendanceApi";
import { apiFetch } from "../../api/client";

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
 * Embeds a Jitsi Meet room directly in the page, reports join/leave as
 * attendance events, and enforces fullscreen for students per
 * session.fullscreen_required (faculty-controlled).
 *
 * FULLSCREEN NOTE: browsers guarantee Esc always exits fullscreen - no
 * page can override that. So this can't be a literal "trap"; instead,
 * exiting while required shows a full-viewport blocking overlay until
 * the student clicks back in. That click is a real user gesture, which
 * is required for requestFullscreen() to succeed reliably.
 */
export default function Classroom({ roomId, courseId, studentId, studentName, sessionId, isFaculty }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const apiRef = useRef(null);

  const [fullscreenRequired, setFullscreenRequired] = useState(true); // matches backend default
  const [isCurrentlyFullscreen, setIsCurrentlyFullscreen] = useState(false);
  const [togglingFullscreen, setTogglingFullscreen] = useState(false);

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

  useEffect(() => {
    const handler = () => setIsCurrentlyFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const check = () =>
      apiFetch(`/attendance/sessions/detail/${sessionId}`)
        .then((s) => setFullscreenRequired(s.fullscreen_required))
        .catch(() => {});
    check();
    const interval = setInterval(check, 4000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    if (isFaculty || !fullscreenRequired) return;
    wrapperRef.current?.requestFullscreen?.().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterFullscreen = () => {
    wrapperRef.current?.requestFullscreen?.().catch(() => {});
  };

  const toggleFullscreenRequirement = async () => {
    if (!sessionId) return;
    setTogglingFullscreen(true);
    try {
      const updated = await apiFetch(`/attendance/sessions/${sessionId}/fullscreen`, {
        method: "PATCH",
        body: JSON.stringify({ fullscreen_required: !fullscreenRequired }),
      });
      setFullscreenRequired(updated.fullscreen_required);
    } catch {
      // Non-critical - faculty can just try the toggle again.
    } finally {
      setTogglingFullscreen(false);
    }
  };

  const showBlockingOverlay = !isFaculty && fullscreenRequired && !isCurrentlyFullscreen;

  return (
    <div ref={wrapperRef} style={{ position: "relative", borderRadius: 12, overflow: "hidden", minHeight: 500, background: "#111" }}>
      <div ref={containerRef} style={{ minHeight: 500, background: "#111" }} />

      <div
        style={{
          position: "absolute", top: 12, left: 12, background: "rgba(15, 92, 74, 0.9)",
          color: "white", padding: "6px 12px", borderRadius: 6, fontSize: 13,
          fontWeight: 600, fontFamily: "sans-serif", pointerEvents: "none", zIndex: 2,
        }}
      >
        LMS Platform
      </div>

      {isFaculty && sessionId && (
        <button
          onClick={toggleFullscreenRequirement}
          disabled={togglingFullscreen}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 3,
            background: fullscreenRequired ? "#5b3fa8" : "rgba(255,255,255,0.15)",
            color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6,
            padding: "6px 12px", fontSize: 12, fontFamily: "sans-serif", cursor: "pointer",
            opacity: togglingFullscreen ? 0.6 : 1,
          }}
        >
          {fullscreenRequired ? "Fullscreen required for students" : "Normal screen allowed"}
        </button>
      )}

      {showBlockingOverlay && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(10, 16, 13, 0.96)", zIndex: 1000,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 16, fontFamily: "sans-serif", color: "white", textAlign: "center", padding: 24,
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Fullscreen is required for this class</p>
          <p style={{ fontSize: 14, color: "#c8d3ce", margin: 0, maxWidth: 360 }}>
            Your instructor hasn't released normal-screen mode yet. Click below to continue.
          </p>
          <button
            onClick={enterFullscreen}
            style={{ background: "#0f5c4a", color: "white", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, cursor: "pointer" }}
          >
            Enter fullscreen
          </button>
        </div>
      )}
    </div>
  );
}