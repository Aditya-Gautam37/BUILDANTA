"use client";

import { formatUnit } from "@buildanta/api/client";
import Link from "next/link";
import { useState } from "react";

import { MAX_BASKET_LINES, useQuoteBasket } from "@/lib/quote-basket";

/**
 * Adds a specific variant to the quote basket.
 *
 * Quantity is entered here rather than on the quote page, because the unit matters:
 * "40" means something different for bags of cement than for tonnes of steel, and
 * the buyer is looking at the unit right now.
 */
export function AddToQuote({
  variantId,
  unit,
}: {
  variantId: string;
  unit: string;
}) {
  const { add, has, lines, ready } = useQuoteBasket();
  const [quantity, setQuantity] = useState("1");
  const [justAdded, setJustAdded] = useState(false);

  const alreadyInBasket = ready && has(variantId);
  const basketFull = ready && lines.length >= MAX_BASKET_LINES && !alreadyInBasket;

  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(quantity);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        add(variantId, quantity);
        setJustAdded(true);
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor={`quantity-${variantId}`}
            className="block text-sm font-medium"
          >
            Quantity ({formatUnit(unit, "long")})
          </label>
          <input
            id={`quantity-${variantId}`}
            name="quantity"
            type="number"
            min="0.001"
            step="any"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setJustAdded(false);
            }}
            className="mt-1 w-28 rounded-md border border-concrete-200 bg-white px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={basketFull}
          className="rounded-md bg-signal-600 px-5 py-2.5 font-semibold text-white hover:bg-signal-700 disabled:cursor-not-allowed disabled:bg-concrete-400"
        >
          {alreadyInBasket ? "Add more" : "Add to quote"}
        </button>
      </div>

      {basketFull ? (
        <p role="alert" className="mt-2 text-sm font-medium text-signal-700">
          Your request already has {MAX_BASKET_LINES} products, which is the
          maximum. Submit it and start another.
        </p>
      ) : null}

      {justAdded ? (
        // `role="status"` so a screen reader announces the add without stealing
        // focus from the quantity field.
        <p role="status" className="mt-2 text-sm text-concrete-800">
          Added.{" "}
          <Link href="/quote" className="font-semibold text-signal-700 underline">
            Review your quote request
          </Link>
        </p>
      ) : null}
    </form>
  );
}
