// Stripe webhook handler — runs on Supabase's servers, not in the browser.
//
// ⚠️ UNVERIFIED DRAFT. Everything else in this project has been tested
// against a real, running instance before being called "done." This
// file hasn't been — it can't run at all until it's deployed (it needs
// the Supabase CLI, which isn't installed yet), and I wasn't able to
// pull up Supabase's current official Stripe-webhook example to check
// this against (a fetch attempt only returned a page title, no content).
// Treat this as a solid, reasoned starting draft, not a finished,
// confirmed-working file — cross-check it against Supabase's own guide
// when you actually get to deploying this:
// https://supabase.com/docs/guides/functions/examples/stripe-webhooks
//
// WHAT THIS DOES
// ---------------
// Stripe calls this URL the moment something real happens (a checkout
// completes, a subscription renews or is canceled). This function:
//   1. Checks the request really came from Stripe (the signature check).
//   2. Reads who the payment was for (the client_reference_id we
//      attached to the Payment Link, from app.js).
//   3. Writes the result into the "subscriptions" table using the
//      SECRET service_role key — the one thing in this whole project
//      allowed to bypass Row Level Security, because there's no other
//      way for a server to say "this really happened, trust me."
//
// SECRETS THIS FUNCTION NEEDS (set as Supabase project secrets, never
// written in this file or committed anywhere):
//   STRIPE_SECRET_KEY              — from Stripe: Developers -> API keys
//   STRIPE_WEBHOOK_SIGNING_SECRET  — from Stripe: the webhook endpoint's
//                                    "Signing secret", starts with whsec_
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — Supabase sets these
//                                    automatically for every Edge
//                                    Function; you don't set them
//                                    yourself.

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

// Deno doesn't have Node's built-in crypto module the way Stripe's SDK
// expects by default, so signature verification needs this explicit
// "use the Web Crypto API instead" provider.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// This client uses the SECRET service_role key — the only place in this
// entire project that happens. It bypasses Row Level Security
// completely, which is exactly why regular browser code (app.js) must
// never have access to this key.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    // Wrong signature = not actually from Stripe. Reject it rather than
    // trust it — this is the check that stops anyone from just POSTing
    // a fake "payment succeeded" event at this URL themselves.
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // A checkout just succeeded. This is where we learn which
      // Supabase user this was for (client_reference_id, attached to
      // the Payment Link URL in app.js) and which Stripe customer/
      // subscription that maps to, going forward.
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (!userId) {
          console.warn("checkout.session.completed with no client_reference_id — can't link it to a user.");
          break;
        }
        const { error } = await supabaseAdmin.from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: "active",
          updated_at: new Date().toISOString(),
        });
        if (error) console.error("Failed to record new subscription:", error);
        break;
      }

      // A subscription renewed, was paused, or a payment failed. These
      // events carry the Stripe subscription id, not client_reference_id,
      // so we look the row up by that instead.
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: subscription.status,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        if (error) console.error("Failed to update subscription status:", error);
        break;
      }

      default:
        // Stripe sends many event types we don't act on — that's normal,
        // not an error. Acknowledging with 200 either way tells Stripe
        // not to keep retrying this event.
        break;
    }
  } catch (err) {
    console.error("Unexpected error handling Stripe event:", err);
    // Still return 200: Stripe would otherwise retry this same event
    // repeatedly, and a bug in our handling shouldn't turn into Stripe
    // hammering this endpoint.
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
