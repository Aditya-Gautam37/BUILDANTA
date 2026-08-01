"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Header search box.
 *
 * A real form with a submit button rather than search-as-you-type: the query runs
 * against Postgres, and firing a request per keystroke would be slower for the user
 * and far more load on the API for no benefit.
 */
export function SiteSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        router.push(
          query ? `/products?q=${encodeURIComponent(query)}` : "/products",
        );
      }}
      className="flex"
    >
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search cement, tiles, wiring…"
        className="w-full rounded-l-md border-0 bg-white px-3 py-2 text-concrete-900 placeholder:text-concrete-400"
      />
      <button
        type="submit"
        className="rounded-r-md bg-signal-600 px-4 py-2 font-medium text-white hover:bg-signal-700"
      >
        Search
      </button>
    </form>
  );
}
