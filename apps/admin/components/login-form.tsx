"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.auth.login.useMutation({
    async onSuccess() {
      // The cached `me` result predates the login, so it has to be invalidated
      // before navigating or the dashboard bounces straight back here.
      await utils.auth.me.invalidate();

      const next = params.get("next");
      // Only same-app relative paths are followed. Without this check a link like
      // /login?next=https://evil.example would make this form an open redirect that
      // looks like it came from Buildanta. The `//` test blocks protocol-relative
      // URLs, which are also absolute.
      const safe = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(safe);
    },
  });

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        login.mutate({ email, password });
      }}
    >
      {login.error ? (
        <Alert tone="error">{errorMessage(login.error)}</Alert>
      ) : null}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        disabled={login.isPending}
        aria-busy={login.isPending}
      >
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
