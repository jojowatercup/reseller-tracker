# Reseller Profit & Tax Tracker

A tool for part-time resellers/creators (Etsy, Depop, Poshmark, eBay, Mercari, TikTok Shop)
and small businesses running their own Shopify store, to see their real profit after platform
fees, shipping, and item cost — and eventually track it automatically across platforms for
tax season.

This project is being built one small milestone at a time, each one teaching a new concept
on top of the last. No prior coding experience assumed.

## How to view it right now

Open `index.html` by double-clicking it, or dragging it into any web browser. No install,
no build step needed. As of Milestone 3 it's a few files instead of one (see below), but
they still just sit on disk — no server required to try the calculator and local history.

If your IDE has a "Live Server" / "Preview" feature (VS Code's Live Server extension, for
example), you can use that instead to auto-refresh while editing.

**To get accounts + cloud sync working (Milestone 3), do this once:**

1. Go to [supabase.com](https://supabase.com) and create a free account, then click
   "New Project." Pick any name/region and set a database password (Supabase asks for one;
   this app doesn't need you to remember it).
2. Once the project finishes setting up (~2 minutes), open **SQL Editor** in the left sidebar
   → **New query** → paste in the entire contents of this project's `schema.sql` → **Run**.
   That creates the `sales` table and locks it so each signed-in seller only ever sees their
   own rows.
3. Go to **Authentication → Providers → Email** and turn **off** "Confirm email." (We're not
   deployed anywhere yet, so there's no working link-back address for a confirmation email to
   send you to — we'll turn this back on at Milestone 6.)
4. Go to **Settings → API Keys** (Supabase renamed things in 2025/2026 — this used to be
   called just "API"). Copy the **Project URL** and the **Publishable key** (formerly called
   the "anon" key, looks like `sb_publishable_...`) — not the **Secret key** (formerly
   "service_role"), that one must never be used in this app.
5. Open `supabase-config.js` in this project and paste those two values in, replacing the
   placeholder text.
6. Reload `index.html`. The Account card should now show a login form instead of the
   "cloud sync isn't set up yet" message.

## Roadmap

1. ✅ **Fee calculator** (`index.html`) — a single HTML/CSS/JS page. Pick a platform, enter
   sale numbers, see what you actually keep. Covers Etsy, eBay, Poshmark, Depop, Mercari,
   TikTok Shop, and Shopify (a self-run store, so its "fee" is just payment processing —
   no marketplace commission). No accounts, no server, no database.
   Doubles as a free marketing tool to attract early users.
2. ✅ **Save your sales history** — remember past calculations between visits using the
   browser's own storage (`localStorage`). Still zero setup. Data lives only in the browser
   you saved it in — it won't follow you to another device (that's what Milestone 3's
   real database is for).
3. ✅ **Real accounts + a real database** — move off a single file, set up a proper project,
   add user sign-in and a database (using Supabase). Verified end-to-end against a real
   Supabase project: sign up, log in, session persists across reloads, saving/deleting/
   clearing sales all hit the real `sales` table and are private per-account via RLS.
4. 🚧 **Connect marketplaces for real** — pull a seller's actual orders automatically instead
   of typing numbers by hand, feeding straight into the same sales history list. Gated to Pro
   accounts (free stays manual-entry, unlimited, exactly as it is today).
   Requires Milestone 3 first: a real API connection means OAuth tokens/secrets, which must
   live on a server, never in browser-side code anyone can read via dev tools.
   Availability varies a lot by platform, so the order will likely be:
     - **Etsy** and **eBay** first — both have open, self-serve seller APIs.
     - **TikTok Shop** and **Mercari** — partner APIs exist but require approval; may not be
       reachable for a small/solo seller account.
     - **Depop** and **Poshmark** — no public seller API as of this writing. Likely fallback:
       let sellers upload the CSV order-export these platforms already offer, so the list
       still fills in automatically, just from a file instead of a live connection.
     - **Shopify** — open, self-serve Admin API; a store owner can generate their own access
       token with no approval wait for a single store. To connect *many* different sellers'
       stores (what this app needs), we'd register as a free Shopify Partner and use their
       OAuth flow — same backend requirement as everything else here, but no gatekeeping.

   **Etsy status:** the real connection (OAuth, approved by Etsy, tokens saved) is verified
   working end-to-end with a real account — see "Milestone 4 status" below. What's left is
   the order-import logic: actually fetching orders and turning them into sales history rows.
5. ✅ **Add payments** — Stripe, so people can subscribe and pay for the Pro version. Pro
   unlocks Milestone 4's automatic marketplace imports once that exists; free stays exactly
   as-is otherwise. Verified end-to-end for real: a real Stripe test-mode checkout (test
   card, real webhook delivery) correctly flipped a test account to Pro in the database,
   and the app correctly showed it.
6. ⬜ **Deploy it live** — a permanent URL anyone can visit, not tied to any one session.

## Project structure so far

```
reseller-tracker/
├── README.md                          ← this file
├── index.html                         ← page structure/markup only now
├── style.css                          ← all the styling
├── app.js                             ← calculator, history, account/cloud-sync, Pro status
├── supabase-config.js                 ← your Supabase project's URL + anon key go here
├── stripe-config.js                   ← your Stripe Payment Link goes here
├── schema.sql                         ← run once: creates the "sales" table
├── schema-subscriptions.sql           ← run once: creates the "subscriptions" table
├── supabase/functions/stripe-webhook  ← the webhook function (deployed via Supabase CLI)
└── tests/                             ← automated tests — see tests/README.md
```

As milestones are added, this file will note what's new and where to find it.

## What's new in Milestone 2

- A **"Save this sale to history"** button under the receipt stores the current calculation.
- A **Sales history** card lists everything you've saved (newest first), with a running count
  and total kept, plus a delete button per entry and a "Clear all."
- Saved data is stored in your browser's `localStorage` under the key `resellerTracker.history`,
  as JSON. It survives closing the tab and restarting your browser, but it's tied to this one
  browser on this one device — clearing your browser's site data would erase it too.
- Added **Shopify** as a platform option, since it's a common way small resale businesses sell
  directly. Its fee model is different from the marketplaces (no commission, just payment
  processing) — see the roadmap note under Milestone 4 for why its future API access is
  actually easier than most of the marketplaces here.

## What's new in Milestone 3

- Split the single `index.html` into `index.html` (markup), `style.css`, and `app.js` — a
  "proper project" with each kind of code in its own file, which is how most real websites
  are organized.
- Added **Supabase**: a hosted Postgres database + login system that a webpage can talk to
  directly over the internet via a small JavaScript library (loaded from a CDN, no install).
- Added an **Account** card: sign up / log in / log out with email + password.
- **Signed out:** sales history still saves to this browser's `localStorage`, exactly like
  Milestone 2 — nothing about the free, no-signup calculator changed.
- **Signed in:** sales history reads from and writes to your own private rows in the
  `sales` table instead, which means it now follows you to any browser or device you log in
  from — the thing `localStorage` could never do.
- **Row Level Security (RLS)**, set up in `schema.sql`, is the database rule that actually
  keeps one seller's sales private from another. It's enforced by the database itself, not
  by our JavaScript — so even a bug in `app.js` couldn't leak someone else's data.
- The **Publishable key** (Supabase's current name for what used to be called the "anon" key)
  in `supabase-config.js` is safe to leave visible in browser code — it can only do what the
  RLS rules allow. The separate **Secret key** (formerly "service_role") bypasses RLS entirely
  and must never appear in this app.
- Until you fill in `supabase-config.js` with a real project (see the setup steps above), the
  Account card shows a "cloud sync isn't set up yet" note and the app behaves exactly like
  Milestone 2.

## Between Milestone 3 and Milestone 4

Everything below happened in one overnight session of polish, bug-hunting, and prep — while
the fee calculator, local/cloud history, and accounts from Milestones 1–3 stayed unchanged.
Every item was tested (`python3 tests/test_app.py`, currently 10/10) before moving to the next.

### New features

- **Export CSV** — a button in the Sales History card that downloads everything you've saved
  (local or cloud, whichever's active) as a spreadsheet-ready `.csv` file, oldest sale first
  like a real ledger, for tax season or handing to a bookkeeper. Built entirely in the
  browser via a `Blob` — no server involved.
- **Manual light/dark toggle** (the moon/sun button, top right) — the CSS already auto-matched
  your OS setting since Milestone 1; this adds an explicit override remembered in
  `localStorage`, applied by a tiny inline script before the page paints so there's no flash
  of the wrong theme on reload.
- **Shipping-loss insight** — a small warning when your shipping cost exceeds what you
  charged the buyer for shipping, with the exact gap.
- **Loss coloring** — "You keep" turns red instead of staying green when a sale is a net loss.
- **Print-friendly view** — printing the page (or "Print to PDF") shows a clean, self-contained
  receipt instead of the whole interactive app; the calculator inputs, account card, and
  history list all hide, since the receipt already restates every number as its own line. This
  also exposed a small gap: the receipt never said which platform it was for, so its title now
  reads e.g. "Payout breakdown — Etsy" on screen too.
- **"Forgot password?"** in the Account card — emails a reset link via Supabase, tested
  against the real project and confirmed working. What's *not* built: the landing page that
  link opens, where you'd type a new password. That needs a stable `https` address to
  redirect to, which doesn't exist until Milestone 6 (deploy) — left as a documented gap
  rather than untestable guesswork.

### Bugs found and fixed (via testing and a couple of code read-throughs)

- **A `hidden`-attribute bug from Milestone 2**: several elements (like the sales-history stat
  row) were toggled with the plain `hidden` attribute, but their CSS class also set `display`,
  which silently overrode it and kept them visible. Fixed with one defensive rule:
  `[hidden] { display: none !important; }`.
- **A false "Saved ✓"**: a failed cloud save used to still flash success — the button always
  showed "Saved ✓" regardless of whether the save actually worked. It now only shows success
  when the save truly succeeded, and re-enables immediately (instead of staying stuck) if it
  didn't.
- **A missing sign-up message**: signing up with no error but also no session (what happens
  if a Supabase project has "Confirm email" turned on) used to leave "Creating account…"
  stuck with no explanation. It now says to check your email. Doesn't change this project's
  behavior today (confirmation is off), but will matter once Milestone 6 turns it back on.
- **A validation-styling regression I introduced, then caught**: the red "invalid" border
  added for negative calculator numbers was scoped too broadly (`.field input:invalid`) and
  was also making the Account card's empty, merely-not-filled-in-yet email/password fields
  look like an error the instant the page loaded. Rescoped to the calculator's own fields
  (`#calculatorCard input:invalid`) only.
- **A hover-color mismatch found during a `style.css` read-through**: `.text-btn:hover` turned
  red for every text-button (Export CSV, create an account, forgot password, log out), which
  made sense back when that class was only ever "Clear all" but not anymore. Only the
  genuinely destructive one (`.text-btn-danger`, i.e. Clear all) still hovers red; the rest
  hover to a neutral, stronger text color.

### Test suite and robustness

- Added a real **automated test suite** (`tests/`) — see `tests/README.md`. Run it with
  `python3 tests/test_app.py`. Now covers: calculator math for all 7 platforms (including
  both sides of Poshmark's $15 flat-fee-vs-percentage branch), input validation, local
  history, CSV export, the print view, and the two bug fixes above as regression tests.
- Added a `Skipped` outcome to the test runner (distinct from pass/fail) for the one test
  that only makes sense while `supabase-config.js` holds real credentials, so clearing it back
  to placeholders (or a fresh clone that hasn't set one up yet) shows as skipped, not failed.
- Hardened navigation against a flaky-network false failure: tests use
  `wait_until="domcontentloaded"` instead of the default `"load"`, which was needlessly
  waiting on the (functionally irrelevant) Google Fonts stylesheet to finish downloading.
- Consistent keyboard focus styling: every button (save, clear, export, theme toggle, delete)
  now gets the same accent-colored focus ring the platform pills and inputs already had,
  instead of the browser's default outline on some buttons but not others.
- Added a `.gitignore` (Python's `__pycache__/`, macOS's `.DS_Store`). Not used by anything
  yet — there's no git repo here — but it's ready for whenever Milestone 3's "set up a proper
  project" gets extended to actual version control.
- Added a `<main>` landmark around the page content (it was a bare `<div class="page">`) —
  lets screen reader users jump straight to the main content instead of having no landmarks
  to navigate by at all. Purely semantic: same class, same layout, nothing visually changes.
- Added `role="status"` to the Account card's message area, so a screen reader announces
  "Logging in…", "Account created — check your email…", or an error the moment it appears,
  instead of it being silent unless focus happened to already be there. Left the
  shipping-insight warning alone on purpose — it updates on every keystroke, and announcing
  that live would be noisy rather than helpful.

### Milestone 4 prep: developer account checklists

Documentation only — no signups performed on your behalf (that needs your own identity and
business info, and dashboards change often enough that exact button labels aren't worth
memorizing until you're actually there). When you're ready to start Milestone 4, Etsy and eBay
are the two to do first since both have open, self-serve developer programs.

**Etsy** ([developer.etsy.com](https://developer.etsy.com), apps managed at
[etsy.com/developers/your-apps](https://www.etsy.com/developers/your-apps)):
1. Register/log in on the Etsy Developers site (email, or continue with Google/Facebook/Apple).
2. Etsy requires two-factor authentication on your account before you can create an app
   (an authenticator app, or SMS/phone call).
3. Click "Create a new app" — you'll need an app name, description, and a callback URL (the
   address Etsy redirects back to after a seller approves access; can be edited later from the
   same page).
4. You get two credentials: a **Keystring** (API key) and a **Shared Secret**. As of a Feb 2026
   Etsy change, requests need *both* combined in the `x-api-key` header as `keystring:secret` —
   worth double-checking against their current docs when we build this, since that's the kind
   of detail that could shift again.
5. Full OAuth (a seller clicking "Connect Etsy" and approving) is a separate step from just
   having these credentials — that's the actual Milestone 4 implementation work.

**eBay** ([developer.ebay.com](https://developer.ebay.com)):
1. Sign up for the eBay Developers Program.
2. Go to the Application Keys page and create a keyset — Sandbox and Production are separate
   keysets; Sandbox is a safe fake environment to build against before touching real listings.
3. Each keyset includes an **App ID (Client ID)**, **Dev ID**, and **Cert ID (Client Secret)**
   — the ones treated as secret must stay server-side only, same rule as everything else in
   this project.
4. Before a **Production** keyset works, eBay requires subscribing to (or explicitly opting
   out of) marketplace account-deletion/closure notifications — a compliance step that shows
   up as a "keyset disabled" message with a link to resolve it. Easy to miss, worth expecting.
5. Production keys never work in Sandbox and vice versa — build and test in Sandbox first.

Sources: [Etsy Open API v3 authentication docs](https://developer.etsy.com/documentation/essentials/authentication/), [How to Get Your Etsy API Key](https://www.insightagent.app/guides/etsy-api-integration-guide), [eBay: Create the eBay API keysets](https://developer.ebay.com/api-docs/static/gs_create-the-ebay-api-keysets.html), [eBay: Understand application keysets](https://developer.ebay.com/api-docs/static/gs_understand-application-keysets.html)

## Milestone 5 prep: Stripe account + architecture

**Documentation only — no account created on your behalf.** Stripe needs your real identity,
business info, and a bank account for payouts; that's inherently something only you can do.

**Creating your account** ([dashboard.stripe.com](https://dashboard.stripe.com)):
1. Sign up with your email, then verify it.
2. You land in **test mode** immediately (a toggle top-left switches test/live) — you can
   build and fully test the whole flow with fake card numbers before any real money is
   involved. No rush to submit business/bank details until you're ready to actually charge
   people.
3. To go live later, Stripe requires business info, identity verification, and bank details
   for payouts — that's the "activation" step, separate from just having an account.
4. **Developers → API keys** gives you a **Publishable key** (`pk_test_...` / `pk_live_...`,
   safe in browser code) and a **Secret key** (`sk_test_...` / `sk_live_...`, server-only —
   same rule as Supabase's Secret key, never in `app.js` or anywhere browser-visible).

**Why this needs a webhook (a second backend piece, beyond just API keys):** knowing someone
paid isn't as simple as "they landed on a success page" — they could close the tab before
that page loads, a subscription can fail to renew next month, someone can cancel. The only
reliable way to know is a **webhook**: Stripe calls a server endpoint of ours the moment
something actually happens (`checkout.session.completed`, `customer.subscription.updated`,
etc.), signed with a secret (`whsec_...`) so we can verify it's really Stripe. That endpoint
then updates the signed-in user's row in Supabase's new `subscriptions` table.

**The plan: a Supabase Edge Function as that endpoint.** We already have a Supabase project;
Edge Functions are small serverless functions Supabase can host for us, so this doesn't mean
adding a whole new hosting provider just for one webhook. Supabase has an official pattern for
this (their CLI, a function that verifies the Stripe signature, secrets stored as Supabase
project environment variables — never committed to this repo). This is genuinely the first
piece of *server-side* code this project will have, since everything before now ran entirely
in the browser or inside Supabase's own managed database rules.

Sources: [Stripe: Set up your account](https://docs.stripe.com/get-started/account/set-up), [Stripe: API keys](https://docs.stripe.com/keys), [Supabase: Handling Stripe Webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)

## Milestone 5 status: verified end-to-end, for real

Every piece is built, deployed, and confirmed working — not just reasoned to be correct:

- `schema-subscriptions.sql` — the `subscriptions` table + its read-only-from-the-browser RLS
  policy. Run and confirmed against the real project.
- The Account card's Pro status block (`app.js`, `index.html`, `style.css`) — shows "Free
  plan" / "Pro," an Upgrade button carrying `client_reference_id`, a "not set up yet"
  fallback for a fresh clone. Along the way, testing caught a real bug (the Upgrade button
  could get stuck hidden if the status check failed) — fixed before calling it done.
- `supabase/functions/stripe-webhook/index.ts` — deployed to the real project via the
  Supabase CLI and confirmed live.
- **A full real checkout**, start to finish: a test account clicked Upgrade, paid with
  Stripe's official test card (`4242 4242 4242 4242`, no real money — test mode) at the real
  Payment Link, Stripe delivered the webhook, the deployed function verified its signature
  and wrote to `subscriptions`, and the app correctly showed that same account as "Pro" on
  the next sign-in. Every link in that chain fired for real.

**A real gotcha hit and fixed along the way**, worth remembering: Supabase Edge Functions
require their *own* auth token (a Supabase-issued one) by default — but Stripe has no idea
Supabase exists and only sends its own signature header, so the first deploy attempt got a
401 before Stripe's request ever reached our code. Fixed by deploying with
`--no-verify-jwt`, since the function already does its own, more appropriate check (the
Stripe signature) instead.

**Setup steps, for reference** (already done for this project's real Stripe/Supabase
accounts — useful if you ever need to redo this on a fresh clone or a new project):
1. In Stripe (test mode), create a Product + recurring monthly Price for "Pro," then a
   **Payment Link** for it. Paste that link into `stripe-config.js`.
2. Run `schema-subscriptions.sql` in Supabase's SQL Editor.
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), generate a scoped
   personal access token (Project Settings: Read, Edge Functions: Read-write, Edge Function
   Secrets: Read-write — nothing else needed), and `supabase login --token ...`.
4. `supabase functions deploy stripe-webhook --project-ref <ref> --no-verify-jwt`
5. `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SIGNING_SECRET=... --project-ref <ref>`
6. In Stripe, create a webhook/event destination pointed at
   `https://<ref>.supabase.co/functions/v1/stripe-webhook`, listening for
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Its Signing secret is what step 5 needs.
7. Run a real test-mode checkout with a [Stripe test card](https://docs.stripe.com/testing)
   to confirm the whole chain before ever touching live mode.

## Milestone 4 status: Etsy connection verified end-to-end, for real

**Etsy has three API access tiers**, learned the hard way mid-build: **Seller App** (your own
shop only, auto-approved in minutes), **Personal App** (broader access, ~24-48hr manual
review — this app's tier), and **Commercial Access** (a further upgrade for scaling past
Personal's rate limits). One correction to what this README said earlier: **Personal Access
alone was enough** to complete a real OAuth connection — Etsy's own description of that tier
explicitly includes "tools other buyers and sellers can use," just capped at a lower rate
limit (5 QPS / 5K QPD) than Commercial. Commercial Access is for scaling later, not a
prerequisite for this to work at all.

**Confirmed working, for real, with a real Etsy account** (not simulated):
- A real "Connect Etsy" click → real Etsy login and consent → real token exchange →
  confirmed saved to the database. The Account card now shows "CONNECTED · Connected to Etsy
  since [date]" for that account, verified by reading it back from the live Supabase project.
- `schema-platform-connections.sql` — `platform_connections` (holds real tokens; RLS enabled
  with zero policies for regular users — not even read access to their own row, since a
  leaked token could pull real order data) and `platform_connection_status` (a view exposing
  just enough to show "Connected" or not, with its own `where user_id = auth.uid()` doing the
  scoping instead of RLS), plus `oauth_flow_state` for PKCE's temporary handoff value.
- `etsy-config.js` / `stripe-config.js` split worth noting: Etsy's Keystring is the *public*
  half of OAuth (like a client ID) and belongs in browser code; only the Shared Secret is
  server-only.
- Two real errors hit and fixed along the way: Etsy's OAuth app needed its **Callback URL**
  field actually filled in with the deployed function's URL (not just left as a placeholder,
  which was the state it was in from initial setup), and the app itself needed to clear
  Etsy's Personal App review before it would recognize any connection attempt at all.

**One known, unfixable-on-our-end quirk:** the callback's confirmation page displays as raw
text instead of a styled page — Supabase Edge Functions on the default `*.supabase.co` domain
override any custom `Content-Type` header to `text/plain`, a documented, unresolved platform
bug (confirmed via Supabase's own GitHub discussions), not something wrong in this project's
code. Purely cosmetic — the actual OAuth exchange and database write both work correctly. A
custom domain is the only known workaround, and that's tied to Milestone 6.

**What's still ahead:** the actual *order-import* logic. Everything above proves the
connection works; nothing yet fetches real orders from Etsy's API and turns them into rows in
the `sales` table — that's the next real piece of Milestone 4.

## UI additions, plus a full debugging pass

**New UI:**
- **Toast notifications** replace every `alert()` popup in the app (a failed save, a failed
  Etsy connect) with a small on-page message that fades itself out — matches the rest of the
  design instead of a jarring browser dialog.
- **Sort & filter** on Sales History — a platform dropdown and a sort-by (newest/oldest/
  highest/lowest kept). The running totals shown reflect whatever's currently filtered, so
  "how much did I make on Depop" is a real, direct answer.
- Fixed a real clipped-text bug found while reviewing: the password field's placeholder
  didn't fit its column. Stacked the Account form's fields into one column (also just more
  conventional for a login form) and shortened the placeholder.

**A full code-review debugging pass** (`/code-review high` against the whole project, every
file, not just the day's diff) turned up seven real findings, all fixed:
- **Stored XSS**: `sales.platform` has no database constraint restricting it to this app's own
  platform list, so a value inserted directly through the API (bypassing the UI) rendered as
  live HTML in the history list, since `renderHistory()` interpolated it into `innerHTML`
  unescaped. Added an `escapeHtml()` helper.
- **CSV formula injection** — same root cause: a platform value starting with `=`, `+`, `-`,
  or `@` would be run as a live formula by Excel/Sheets on export, not shown as text. A
  leading apostrophe defuses it without changing what's visibly displayed.
- **A committed test was silently creating real accounts**: `test_pro_status_configured_...`
  used to call the real sign-up button on every single test run, against the live Supabase
  project — exactly what `tests/README.md` says this file shouldn't do. Rewritten to fake the
  sign-in state instead, like the other tests already do.
- **A stale-response race condition**: sign in as A (slow subscription lookup), switch to B
  (fast lookup) before A's resolves, and A's old response used to still land and overwrite
  B's correctly-displayed status. Added a generation counter — `refreshProStatus()` /
  `refreshConnections()` now check it's still the current one before touching the page.
- **`oauth_flow_state` rows never got cleaned up** for an abandoned Etsy connection attempt
  (someone who closed the tab before Etsy redirected back) — only a completed attempt deleted
  its own row. The callback function now also opportunistically sweeps out anyone else's
  expired rows whenever it runs, rather than needing a whole separate scheduled job.
- Two small correctness/accessibility nits: a redundant array copy in the history
  filter/sort logic, and a nested `aria-live` region (the toast container had its own, on top
  of each toast's own `role="alert"`/`"status"`) that could make some screen readers announce
  errors inconsistently.

Every fix has its own regression test now (`tests/test_app.py`, 15/16 — 1 correctly skipped).
The two security fixes and the race-condition fix were each verified by temporarily reverting
the fix and confirming the test actually fails, not just reasoned through.

## The last two UI additions: compare platforms, and a profit chart

**Compare all platforms** — a "Compare all platforms" toggle under the receipt shows the same
sale's payout on all 7 platforms at once, sorted best-first, with the currently-selected one
highlighted. Updates live as you change any number. Answers "where should I actually list
this" directly instead of making you flip through platforms one at a time.

**A profit chart in Sales History** — a "Show profit chart" toggle reveals total kept per
platform, across everything you've saved, as horizontal bars. Two deliberate choices worth
recording:
- **One color, not seven.** The job here is comparing *magnitude* ("who made the most"), not
  telling distinct series apart in a legend — for that job, one hue (this app's existing
  accent green, not a new palette) is the right call, not a rainbow.
- **It won't show a chart for just one platform.** A bar chart with a single bar is really
  just a number wearing a chart's clothes — a known anti-pattern. Save sales on a second
  platform and the chart appears.

Both are sorted, live-updating, fully keyboard-reachable, and covered by their own tests.

## A graphic design pass

The single objective gap: the layout was designed mobile-first and never got a real desktop
treatment — past ~640px it just sat in a narrow column with empty margins on either side,
same content, just more dead space. Fixed with a `min-width: 760px` breakpoint that widens
the column and opens up the spacing, rather than reflowing into a different layout — mobile
is untouched, desktop finally uses the room it has.

A few other deliberate choices:
- **"You keep" is now a tinted, rounded block**, not just a number under a heavier rule — the
  one figure this whole app exists to answer gets treated like a real receipt's highlighted
  total. The tint itself is the profit/loss signal (green vs. rust), readable before you've
  even read the number.
- **One small accent mark** — a 14px dash in the accent color, before the eyebrow at the very
  top of the page. The only purely decorative touch in the whole design, kept to a hairline
  so it reads as considered rather than decoration for its own sake.
- The headline now actually grows on wider screens (`clamp(28px, 5vw, 46px)` — it was capped
  at 38px regardless of how much room there was) and the card shadows have more real presence
  in both themes, instead of reading as barely-there borders.

Nothing here touches layout structure or interactive behavior, so the existing test suite
(still 18/19, 1 correctly skipped) was the regression check; visual review was by screenshot,
in both themes and at both mobile and desktop widths, including the loss-state color.

## Fixing "it all blends together"

The actual cause: `--bg` (the page) and `--surface` (white cards) were nearly the same
color — `#F5F8F4` vs `#FFFFFF` in light mode — so cards had almost no separation from the
page itself beyond a faint border and a soft shadow. Deepened `--bg` into a real sage/moss
tone (`#E1E9DD` light, `#0A0D08` dark) well below `--surface`, and darkened `--border` /
`--border-strong` to stay visible against it. Cards now read as objects sitting on the page,
not as part of one flat surface — confirmed by screenshot in both themes.
