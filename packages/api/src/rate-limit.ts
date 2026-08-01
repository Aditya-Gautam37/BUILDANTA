/**
 * Fixed-window rate limiter held in process memory.
 *
 * Adequate for Release 1, which runs a single API process. Its one real
 * limitation is written down here rather than discovered later: with more than one
 * process or replica, each gets its own counter. Before scaling the API
 * horizontally, swap the map for Redis — the `consume` signature is designed not
 * to change when that happens.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Evicts expired windows so the map cannot grow without bound. */
function sweep(now: number): void {
  if (windows.size < 5_000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export function consume(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clears the counter for a key, e.g. after a successful login. */
export function reset(key: string): void {
  windows.delete(key);
}

/** Exposed for tests. */
export function clearAll(): void {
  windows.clear();
}
