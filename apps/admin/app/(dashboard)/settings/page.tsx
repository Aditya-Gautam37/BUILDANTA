"use client";

import { useState } from "react";

import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

/**
 * The one thing every admin needs and previously had no way to do from the
 * product: change their own password. `auth.changePassword` already existed on
 * the API — correctly built, session-revoking, rate-limit-independent — with
 * nothing in the UI ever calling it.
 */
export default function SettingsPage() {
  const me = trpc.auth.me.useQuery();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess() {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSucceeded(true);
    },
  });

  const errors = fieldErrors(changePassword.error);

  return (
    <div className="max-w-lg">
      <PageHeader
        title="Settings"
        description={me.data ? `Signed in as ${me.data.email}` : undefined}
      />

      <Card title="Change password">
        {succeeded ? (
          <div className="mb-4">
            <Alert tone="success">
              Password changed. Every other session you were signed in on has
              been signed out.
            </Alert>
          </div>
        ) : null}

        {changePassword.error ? (
          <div className="mb-4">
            <Alert tone="error">{errorMessage(changePassword.error)}</Alert>
          </div>
        ) : null}

        {confirmError ? (
          <div className="mb-4">
            <Alert tone="error">{confirmError}</Alert>
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSucceeded(false);
            setConfirmError(null);

            // Checked client-side for immediate feedback; the server enforces the
            // real minimum length regardless of what this form does.
            if (newPassword !== confirmPassword) {
              setConfirmError("The new password and confirmation do not match.");
              return;
            }

            changePassword.mutate({ currentPassword, newPassword });
          }}
        >
          <Field
            label="Current password"
            htmlFor="currentPassword"
            required
            errors={errors["currentPassword"]}
          >
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>

          <Field
            label="New password"
            htmlFor="newPassword"
            required
            hint="At least 12 characters."
            errors={errors["newPassword"]}
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="confirmPassword" required>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            disabled={changePassword.isPending}
          >
            {changePassword.isPending ? "Changing…" : "Change password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
