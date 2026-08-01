"use client";

/**
 * Rendered when a server component throws — most plausibly because the API process
 * is not running. The message says so, because "something went wrong" sends a
 * developer looking in the wrong place.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        The catalog is unavailable
      </h1>
      <p className="mt-3 text-concrete-600">
        We could not reach the Buildanta API. If you are running this locally,
        check that the API process is up on the port in <code>API_URL</code> and
        that Postgres is running.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-md bg-signal-600 px-5 py-2.5 font-medium text-white hover:bg-signal-700"
      >
        Try again
      </button>
    </div>
  );
}
