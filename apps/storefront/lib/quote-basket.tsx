"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { addQuantities } from "./decimal";

/**
 * The quote basket.
 *
 * Release 1 has no customer accounts, so the basket lives in the visitor's browser
 * rather than the database. It stores only variant ids and quantities: names and
 * prices are resolved from the API on the quote page, so a stale or hand-edited
 * localStorage entry cannot make the page show a price that was never real.
 */

const STORAGE_KEY = "buildanta.quote-basket.v1";

/** Matches the API's per-request cap, so the form cannot build a request it will reject. */
export const MAX_BASKET_LINES = 50;

export interface BasketLine {
  variantId: string;
  /** Kept as a string: it comes from a text input and goes to a Decimal column. */
  quantity: string;
}

interface BasketContextValue {
  lines: BasketLine[];
  /** False until localStorage has been read, so the UI can avoid a wrong first paint. */
  ready: boolean;
  add(variantId: string, quantity?: string): void;
  setQuantity(variantId: string, quantity: string): void;
  remove(variantId: string): void;
  clear(): void;
  has(variantId: string): boolean;
}

const BasketContext = createContext<BasketContextValue | null>(null);

function parseStored(raw: string | null): BasketLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validated element by element rather than cast: this value is user-editable,
    // and one malformed entry must not throw on every page load.
    return parsed
      .filter(
        (entry): entry is BasketLine =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as BasketLine).variantId === "string" &&
          typeof (entry as BasketLine).quantity === "string",
      )
      .slice(0, MAX_BASKET_LINES);
  } catch {
    return [];
  }
}

export function QuoteBasketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [ready, setReady] = useState(false);

  // Read after mount, not during render: localStorage does not exist on the server,
  // and seeding initial state from it would produce a hydration mismatch.
  useEffect(() => {
    setLines(parseStored(window.localStorage.getItem(STORAGE_KEY)));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const add = useCallback((variantId: string, quantity = "1") => {
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variantId);
      if (existing) {
        // Adding something already in the basket increments rather than
        // duplicating, which is what a second click on "Add to quote" means.
        // Decimal-safe addition, not `Number(a) + Number(b)`: quantities go into
        // a Decimal(12,3) column, and float arithmetic on them (0.1 + 0.2, for
        // instance) produces a value with far more decimal places than that
        // column — or the shared validation regex — allows.
        const next = addQuantities(existing.quantity, quantity);
        return current.map((line) =>
          line.variantId === variantId ? { ...line, quantity: next } : line,
        );
      }
      if (current.length >= MAX_BASKET_LINES) return current;
      return [...current, { variantId, quantity }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: string) => {
    setLines((current) =>
      current.map((line) =>
        line.variantId === variantId ? { ...line, quantity } : line,
      ),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((current) =>
      current.filter((line) => line.variantId !== variantId),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<BasketContextValue>(
    () => ({
      lines,
      ready,
      add,
      setQuantity,
      remove,
      clear,
      has: (variantId) => lines.some((line) => line.variantId === variantId),
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return (
    <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
  );
}

export function useQuoteBasket(): BasketContextValue {
  const context = useContext(BasketContext);
  if (!context) {
    throw new Error("useQuoteBasket must be used inside a QuoteBasketProvider.");
  }
  return context;
}
