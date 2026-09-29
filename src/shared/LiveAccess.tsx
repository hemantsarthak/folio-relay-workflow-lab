import { useState } from "react";

const KEY = "portfolio-live-access";
function savedCode() {
  try {
    return Boolean(sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
}

/**
 * Hosted demo only. The public site routes with local rules; a reviewer who
 * was given the access code can unlock calls to the real Jev model. The code
 * is a quota gate for the shared provider key, not user authentication.
 */
export default function LiveAccess() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(savedCode);
  const [message, setMessage] = useState("");
  return (
    <details className="live-access">
      <summary>
        <span className={unlocked ? "live-dot on" : "live-dot"} />
        {unlocked
          ? "Live Jev unlocked for this tab"
          : "Have a reviewer code? Unlock live Jev"}
      </summary>
      <p>
        This public demo routes documents and tickets with transparent local
        rules. To try the real Jev model, enter the code Hemant shared with you.
        It stays in this tab and is only sent with live requests; the provider
        key never leaves the server.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            sessionStorage.setItem(KEY, code.trim());
            setCode("");
            setUnlocked(true);
            setMessage(
              "Saved. Choose “Jev live” as the routing engine; the server checks the code on your next request.",
            );
          } catch {
            setMessage("Session storage is unavailable in this browser.");
          }
        }}
      >
        <input
          type="password"
          aria-label="Reviewer access code"
          placeholder="Reviewer access code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          autoComplete="off"
        />
        <button type="submit">Unlock</button>
        {unlocked && (
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(KEY);
              } catch {
                // Nothing stored.
              }
              setUnlocked(false);
              setMessage("Live access code cleared.");
            }}
          >
            Clear
          </button>
        )}
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
