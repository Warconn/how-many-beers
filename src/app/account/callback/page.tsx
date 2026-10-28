"use client";
import { useEffect, useRef, useState } from "react";
import { accountClient } from "@/auth/client";
import { accountPath } from "@/auth/config";
export default function AccountCallback() {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search),
      code = params.get("code");
    // Clear one-time codes/provider errors from the address bar immediately.
    window.history.replaceState(null, "", window.location.pathname);
    const client = accountClient();
    if (!client || !code || params.has("error")) {
      setError(
        "The sign-in link was cancelled, invalid or expired. Please start again.",
      );
      return;
    }
    void client.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error)
          setError(
            "This link could not be verified in this browser. Please request a new sign-in email.",
          );
        else window.location.replace(accountPath());
      })
      .catch(() =>
        setError("Sign-in could not be completed. Please try again."),
      );
  }, []);
  return (
    <main className="shell account-page">
      <section className="panel">
        <h1>Completing sign-in</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <a href={accountPath()}>Return to sign in</a>
          </>
        ) : (
          <p role="status">Verifying your sign-in…</p>
        )}
      </section>
    </main>
  );
}
