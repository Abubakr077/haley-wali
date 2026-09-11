"use client";

import { useState, type FormEvent } from "react";

export function SignInForm({ returnTo }: { returnTo: string }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: data.get("password") }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "Could not sign in.");
      setSubmitting(false);
      return;
    }
    window.location.href = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  }

  return (
    <form className="admin-signin-form" onSubmit={submit}>
      <label>
        STORE MANAGER PASSWORD
        <input name="password" type="password" autoComplete="current-password" required autoFocus />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? "SIGNING IN…" : "SIGN IN"}</button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}
