// ─────────────────────────────────────────────────────────────
//  SINGLE SOURCE OF TRUTH FOR THE BUILD VERSION.
//  ⛔ No other file may hardcode a version string.
//     Bump APP_VERSION as part of any shipped change.
//     Format: YYYY-MM-DD.N   (N increments for same-day builds)
// ─────────────────────────────────────────────────────────────
export const APP_VERSION = '2026-07-23.2';
export const CACHE_NAME  = `ptracker-${APP_VERSION}`;
