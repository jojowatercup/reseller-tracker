// Fill these in from your own Supabase project: Settings (gear icon) -> API Keys.
//
// The "Publishable key" (formerly called the "anon" key — Supabase renamed
// it in 2025/2026) is DESIGNED to be visible in browser code — by itself
// it can only do what the Row Level Security rules in schema.sql allow
// (e.g. "only see rows you own"). It is not a secret.
//
// Never put the "Secret key" (formerly "service_role") here or in any
// browser-side file. That key skips Row Level Security entirely and must
// only ever be used on a server you control — this app doesn't need it
// anywhere.
//
// Until these are filled in with real values, the app quietly falls back
// to saving your sales history in this browser only (same as Milestone 2).
const SUPABASE_URL = "https://utaepqledbcvwrjpqvys.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VnQ0-pqZuUOuAO9-v8W8VA_-_-isADC";
