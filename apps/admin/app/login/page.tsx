import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * A server-component shell around the client form.
 *
 * The form reads `?next=` with `useSearchParams`, which opts a component out of
 * prerendering unless it sits inside a Suspense boundary. Keeping the boundary here
 * lets the static shell — heading and card — prerender while only the form waits for
 * the URL on the client.
 */
export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-lg border border-ink-200 bg-white p-8">
        <h1 className="text-xl font-bold">Buildanta admin</h1>
        <p className="mt-1 text-sm text-ink-600">
          Sign in to manage the catalog and quote requests.
        </p>

        <Suspense
          fallback={
            <p className="mt-6 text-sm text-ink-600">Loading sign-in form…</p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
