"use client";

/**
 * Rendered when a client component throws. Most often the API is not running, which
 * this says outright — "something went wrong" sends a developer looking in the wrong
 * place.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">
        The admin could not load
      </h1>
      <p className="mt-3 text-ink-600">
        We could not reach the Buildanta API. Check that the API process is running
        on the port in <code>API_URL</code>, and that Postgres is up.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-md bg-accent-600 px-5 py-2.5 font-medium text-white hover:bg-accent-700"
      >
        Try again
      </button>
    </div>
  );
}
