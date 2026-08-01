import type { Metadata } from "next";

import { QuoteRequestForm } from "@/components/quote-request-form";

export const metadata: Metadata = {
  title: "Request a bulk quote",
  description:
    "Add the materials you need and we will come back with pricing for the whole list.",
  robots: { index: false, follow: true },
};

/**
 * The basket lives in the visitor's browser, so this page is a shell around a
 * client component. Nothing here can be server-rendered without customer accounts,
 * which are Release 2.
 */
export default function QuotePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Request a bulk quote
        </h1>
        <p className="mt-1 max-w-2xl text-concrete-600">
          Tell us what you need and we will come back with pricing for the whole
          list. Listed prices are indicative and exclude delivery and taxes.
        </p>
      </header>

      <QuoteRequestForm />
    </div>
  );
}
