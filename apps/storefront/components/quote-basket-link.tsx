"use client";

import Link from "next/link";

import { useQuoteBasket } from "@/lib/quote-basket";

/** Header link to the quote basket, showing how many lines are in it. */
export function QuoteBasketLink() {
  const { lines, ready } = useQuoteBasket();

  return (
    <Link
      href="/quote"
      className="flex items-center gap-2 rounded-md bg-signal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-signal-700"
    >
      Quote request
      {/* Rendered only once localStorage has been read, so the count never flashes
          from 0 to its real value on load. */}
      {ready && lines.length > 0 ? (
        <span className="rounded-full bg-white px-1.5 text-xs font-bold text-signal-700">
          {lines.length}
        </span>
      ) : null}
    </Link>
  );
}
