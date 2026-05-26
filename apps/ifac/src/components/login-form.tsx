"use client";

import { useState } from "react";
import { signInWithPassword } from "@elkdonis/auth-client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const result = await signInWithPassword(email, password);
    setLoading(false);
    if (result.error) {
      setStatus(result.error);
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <form className="form-shell" onSubmit={submit}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} required />
      </div>
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Signing in" : "Sign in"}
      </button>
      <div className="form-status" aria-live="polite">{status}</div>
    </form>
  );
}
