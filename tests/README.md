# Tests

Automated tests: code that clicks around the real app like a user would, then
checks the result is what's expected. It replaces manually re-testing every
scenario by hand after every change.

## Run them

```
python3 tests/test_app.py
```

Takes a few seconds. You'll see `PASS`/`FAIL` per test and a final count.

## One-time setup

If you haven't already installed these while building Milestone 3:

```
python3 -m pip install --user playwright
python3 -m playwright install chromium
```

## What's covered, and what isn't

Covered: the calculator's math for all 7 platforms, input validation (negative
numbers, the loss color, the shipping insight), local (`localStorage`) history
— save, reload, delete, clear — CSV export, the print view, button hover
colors, the Pro-status upgrade button (both with and without Stripe
configured), and a couple of real bugs that got fixed along the way (a failed
cloud save used to still say "Saved ✓"; a sign-up with no session used to
give no feedback) as regression tests. A few of these fake out `supabaseClient`
(or call `refreshProStatus()` directly) with `page.evaluate()` so they can
check the *code path* without needing a real project or creating a real
account.

**Not covered here on purpose:** actually completing a Stripe checkout, or
anything a real webhook delivery would trigger. That part genuinely happened
— a real test-mode payment, a real webhook, a real database write, confirmed
by hand — but running it automatically every time this suite runs would mean
hitting Stripe's real (test-mode) API and creating a new subscription record
on every run, which isn't something a test file that anyone could copy and
run against their own project should do by itself.

Two tests are mirror images of each other and only one of them applies at a
time, depending on whether `stripe-config.js` (or `supabase-config.js`, for a
third, older test) currently holds a real value or the placeholder. Whichever
one doesn't apply shows as `SKIP`, not `FAIL` — a third possible outcome for
a check that doesn't apply to the current state, not a broken one.

## Why a fresh browser "context" per test

Each test opens its own private browser context (`browser.new_context()`) —
think of it like a separate incognito window per test, with its own empty
`localStorage`. Without that, one test's saved sale could leak into the next
test and make it pass or fail for the wrong reason.
