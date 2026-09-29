import { useState } from "react";

export default function LiveAccess() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  return (
    <details className="live-access">
      <summary>Reviewer live access</summary>
      <p>
        Enter the access code supplied by Hemant. It stays in this tab session.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            sessionStorage.setItem("portfolio-live-access", code.trim());
            setCode("");
            setMessage(
              "Code saved for this tab session. The server checks it on your next live request.",
            );
          } catch {
            setMessage("Session storage is unavailable in this browser.");
          }
        }}
      >
        <input
          type="password"
          aria-label="Reviewer access code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          autoComplete="off"
        />
        <button type="submit">Use code</button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("portfolio-live-access");
            setMessage("Live access code cleared.");
          }}
        >
          Clear
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
