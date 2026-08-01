/**
 * The three real origins these tests drive, read from the same root `.env`
 * every other workspace uses. Centralised here rather than re-parsed per spec
 * file, and used by both `playwright.config.ts` (to start/reuse the servers)
 * and the specs themselves (to navigate and to call the API directly for
 * fixture setup/teardown).
 */
export const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";
export const STOREFRONT_URL = "http://localhost:3000";
export const ADMIN_URL = "http://localhost:3001";
