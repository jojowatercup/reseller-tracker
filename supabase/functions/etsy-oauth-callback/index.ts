// Etsy OAuth callback — runs on Supabase's servers, not in the browser.
//
// ⚠️ UNVERIFIED DRAFT, same honest caveat as the Stripe webhook: this
// can't run at all until deployed, and OAuth token-exchange code is
// exactly the kind of thing that's easy to get subtly wrong in ways
// only a real end-to-end run (a real "Connect Etsy" click, approved on
// Etsy's real consent screen) can catch. Reasoned carefully, not yet
// proven — that distinction gets confirmed or fixed once we actually
// run it together.
//
// WHAT THIS DOES
// ---------------
// After you click "Connect Etsy" in the app and approve access on
// Etsy's site, Etsy sends your browser here with a `code` and a
// `state`. This function:
//   1. Looks up `state` in oauth_flow_state to recall which signed-in
//      user started this, and the PKCE code_verifier that attempt
//      generated (see schema-platform-connections.sql for why that
//      hand-off table exists).
//   2. Exchanges the code for a real access/refresh token pair by
//      calling Etsy's token endpoint directly (server-to-server —
//      the Etsy Shared Secret this needs must never reach the browser).
//   3. Saves those tokens to platform_connections, using the SECRET
//      service_role key — same narrow exception as the Stripe webhook,
//      for the same reason: no other way for a server to do this.
//   4. Shows a plain confirmation page, since this function IS what the
//      browser lands on — there's no app page to redirect back to yet
//      (that's Milestone 6).
//
// SECRETS THIS FUNCTION NEEDS (already set as Supabase project secrets):
//   ETSY_KEYSTRING, ETSY_SHARED_SECRET — from Etsy: your app's API key page
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — set automatically by Supabase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// This function's own URL — Etsy needs the exact same redirect_uri in
// both the initial "send me to Etsy" link and this token exchange, or
// Etsy rejects it. Filled in once we know it (right after first deploy).
const REDIRECT_URI = "https://utaepqledbcvwrjpqvys.supabase.co/functions/v1/etsy-oauth-callback";

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html><body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #182018;">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const etsyError = url.searchParams.get("error");

  if (etsyError) {
    return html(`<h2>Connection canceled</h2><p>Etsy said: ${etsyError}. You can close this tab and try again from the app.</p>`, 400);
  }
  if (!code || !state) {
    return html(`<h2>Something's missing</h2><p>This link is missing information Etsy is supposed to send. Try connecting again from the app.</p>`, 400);
  }

  // Recall which user started this, and the PKCE secret that attempt
  // generated. This row only ever exists briefly, on purpose.
  const { data: flow, error: flowError } = await supabaseAdmin
    .from("oauth_flow_state")
    .select("user_id, code_verifier, created_at")
    .eq("state", state)
    .eq("platform", "etsy")
    .maybeSingle();

  if (flowError || !flow) {
    return html(`<h2>This connection attempt expired or was already used</h2><p>Go back to the app and click "Connect Etsy" again.</p>`, 400);
  }

  // Clean up immediately — this row is single-use either way, whether
  // the exchange below succeeds or not.
  await supabaseAdmin.from("oauth_flow_state").delete().eq("state", state);

  // Reject anything more than 10 minutes old. A code_verifier sitting
  // around for that long is more likely abandoned than legitimate.
  const ageMs = Date.now() - new Date(flow.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) {
    return html(`<h2>This connection attempt expired</h2><p>Go back to the app and click "Connect Etsy" again.</p>`, 400);
  }

  // The actual token exchange — server-to-server, using the Shared
  // Secret that must never reach browser code.
  const tokenResponse = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: Deno.env.get("ETSY_KEYSTRING")!,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: flow.code_verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    console.error("Etsy token exchange failed:", tokenResponse.status, errText);
    return html(`<h2>Etsy didn't accept that connection</h2><p>Nothing was saved. Go back to the app and try again.</p>`, 502);
  }

  const tokens = await tokenResponse.json();
  // Etsy's access tokens are formatted "<etsy_user_id>.<opaque string>"
  // — the shop owner's Etsy user id is readable straight out of it,
  // no extra API call needed just to identify who this is.
  const etsyUserId = String(tokens.access_token).split(".")[0];

  const { error: saveError } = await supabaseAdmin.from("platform_connections").upsert({
    user_id: flow.user_id,
    platform: "etsy",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    external_shop_id: etsyUserId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,platform" });

  if (saveError) {
    console.error("Failed to save Etsy connection:", saveError);
    return html(`<h2>Connected, but saving it failed</h2><p>Etsy approved access, but something went wrong saving it on our end. Try again, or let the developer know.</p>`, 500);
  }

  return html(`<h2>&#9989; Connected to Etsy</h2><p>You can close this tab and go back to the app — your account is now linked.</p>`);
});
