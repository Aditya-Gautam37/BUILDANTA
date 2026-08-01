import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent-700">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        No such admin page
      </h1>
      <Link
        href="/"
        className="mt-8 inline-block rounded-md bg-accent-600 px-5 py-2.5 font-medium text-white hover:bg-accent-700"
      >
        Back to overview
      </Link>
    </div>
  );
}
