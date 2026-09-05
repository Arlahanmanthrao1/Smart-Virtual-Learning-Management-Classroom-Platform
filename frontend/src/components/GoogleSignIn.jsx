import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";

let googleScript;
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (googleScript) return googleScript;
  googleScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    const timer = setTimeout(() => fail(), 15000);
    const fail = () => {
      clearTimeout(timer); script.onload = null; script.onerror = null; script.remove(); googleScript = null;
      reject(new Error("Google sign-in could not load. Check your connection or use your password."));
    };
    script.onload = () => {
      clearTimeout(timer);
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return googleScript;
}

export default function GoogleSignIn({ onCredential, disabled = false, emailDomain }) {
  const container = useRef(null);
  const handler = useRef(onCredential);
  const disabledRef = useRef(disabled);
  handler.current = onCredential;
  disabledRef.current = disabled;
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let accepting = true;
    setState("loading"); setError("");
    const element = container.current;
    element?.replaceChildren();
    (async () => {
      const config = await apiFetch("/auth/google/config");
      if (!active) return;
      if (!config.client_id) { setState("unconfigured"); return; }
      const google = await loadGoogleIdentity();
      if (!active) return;
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join("");
      google.initialize({
        client_id: config.client_id, nonce, auto_select: false,
        ux_mode: "popup", ...(emailDomain ? { hd: emailDomain } : { hd: "*" }),
        callback: async (result) => {
          if (!active || !accepting || disabledRef.current) return;
          accepting = false; setError("");
          try {
            if (!result.credential) throw new Error("Google did not return a sign-in response. Please try again.");
            await handler.current(result.credential, nonce);
          } catch (err) { if (active) setError(err.message); }
          finally { accepting = true; }
        },
      });
      google.renderButton(element, { type: "standard", theme: "outline", size: "large", text: "signin_with",
        width: Math.min(400, Math.max(200, element.clientWidth)), shape: "rectangular" });
      setState("ready");
    })().catch(err => { if (active) { setError(err.message); setState("error"); } });
    return () => { active = false; element?.replaceChildren(); };
  }, [emailDomain, attempt]);

  return <section className="google-signin" aria-label="Google college account sign-in">
    <div className="login-divider"><span>or use your college Google account</span></div>
    {state === "loading" && <p role="status">Loading Google sign-in…</p>}
    <div ref={container} className={disabled ? "google-button google-button-busy" : "google-button"} aria-busy={disabled} />
    {state === "unconfigured" && <><button className="btn google-unavailable" type="button" disabled>Sign in with Google</button><p className="google-signin-hint">Google sign-in is not enabled yet. Please use your email and password.</p></>}
    {state === "ready" && <p className="google-signin-hint">Use an institution-managed Google account already registered by your administrator.</p>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    {state === "error" && <button type="button" className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry Google sign-in</button>}
  </section>;
}
