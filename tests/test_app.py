#!/usr/bin/env python3
"""
Automated tests for The Real Cut (reseller-tracker).

WHAT THIS IS
------------
Each function below opens the real app in a real (headless) browser,
clicks around like a user would, and checks that the result matches
what's expected. That's what "automated testing" means: code that plays
user, so a person doesn't have to manually re-click through every
scenario by hand after every change. Running this whole file takes a
few seconds.

These tests cover what can be checked without your personal Supabase
project: the calculator math, local (signed-out) history, and CSV
export. Testing real sign-up/log-in against your live Supabase project
is done separately, by hand — it needs your specific project's
credentials and creates a real account every time it runs, which isn't
something a repeatable, share-with-anyone test file should do on its
own.

ONE-TIME SETUP (skip if you've already got this from Milestone 3 testing)
---------------------------------------------------------------------------
    python3 -m pip install --user playwright
    python3 -m playwright install chromium

RUN IT
------
    python3 tests/test_app.py
"""

import pathlib
import sys
import time
import urllib.parse

from playwright.sync_api import sync_playwright

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX_URL = "file://" + urllib.parse.quote(str(PROJECT_ROOT / "index.html"))

# Every test navigates with wait_until="domcontentloaded" rather than the
# default "load" — "load" also waits for the Google Fonts stylesheet to
# finish downloading, which is irrelevant to anything these tests check
# and occasionally times out on a slow connection for no functional
# reason. The Supabase CDN <script> tag still gets waited on either way,
# since it's a regular blocking script tag that finishes before
# DOMContentLoaded fires.


class Skipped(Exception):
    """Raise this inside a test to mark it skipped rather than passed or
    failed — for a check that only makes sense in one particular (and
    equally valid) app state, like "Supabase is actually configured"."""


def test_calculator_math(page, context):
    """A known Etsy example, hand-checked, catches the fee formula ever drifting."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.click('button.platform-pill:has-text("Etsy")')
    page.fill("#price", "100.00")
    page.fill("#shipCharged", "10.00")
    page.fill("#shipCost", "0")
    page.fill("#itemCost", "0")
    page.wait_for_timeout(150)
    # (100+10)*0.065 + (100+10)*0.03 + 0.25 = 7.15 + 3.30 + 0.25 = 10.70
    assert page.inner_text("#rFee") == "-$10.70", page.inner_text("#rFee")
    assert page.inner_text("#rKeep") == "$99.30", page.inner_text("#rKeep")


def test_compare_all_platforms(page, context):
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#toggleCompareBtn")
    assert page.is_hidden("#compareSection")

    page.click("#toggleCompareBtn")
    page.wait_for_timeout(150)
    assert page.is_visible("#compareSection")

    rows = page.query_selector_all(".compare-row")
    assert len(rows) == 7, "one row per platform"

    keeps = [float(r.query_selector(".compare-keep").inner_text().lstrip("$").replace(",", "")) for r in rows]
    assert keeps == sorted(keeps, reverse=True), "should be sorted highest payout first"
    assert "is-best" in rows[0].get_attribute("class"), "the top row should be marked is-best"
    assert "Depop" in page.query_selector(".compare-row.is-current").inner_text(), \
        "the currently-selected platform (Depop by default) should be marked"

    # Switching platforms moves which row is marked "current"
    page.click('button.platform-pill:has-text("Poshmark")')
    page.wait_for_timeout(150)
    assert "Poshmark" in page.query_selector(".compare-row.is-current").inner_text()

    page.click("#toggleCompareBtn")
    page.wait_for_timeout(150)
    assert page.is_hidden("#compareSection")


def test_print_view(page, context):
    """The receipt restates every input as its own line, so the whole
    calculator card + account card + history card can hide when printed
    without losing anything — checks that print mode actually does that,
    and that the platform name is included in the receipt's own title."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#receiptTitle")

    page.click('button.platform-pill:has-text("Etsy")')
    page.wait_for_timeout(150)
    title = page.evaluate("document.getElementById('receiptTitle').textContent")
    assert title == "Payout breakdown — Etsy", title

    page.emulate_media(media="print")
    page.wait_for_timeout(150)
    for hidden_id in ["calculatorCard", "authCard", "historyCard"]:
        assert not page.is_visible(f"#{hidden_id}"), f"#{hidden_id} should be hidden when printing"
    assert not page.is_visible(".theme-toggle")
    assert not page.is_visible("#saveSaleBtn")
    assert page.is_visible("#receipt"), "the receipt itself must stay visible when printing"
    assert page.is_visible("#printStamp"), "the print-only date stamp should appear"


def test_only_destructive_action_hovers_red(page, context):
    """Regression test: .text-btn is shared by several non-destructive
    actions now (export, sign up, forgot password) — only "Clear all"
    (.text-btn-danger) should turn red on hover."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#authSignUpBtn")

    def hover_color(sel):
        page.hover(sel)
        return page.evaluate(f"getComputedStyle(document.querySelector('{sel}')).color")

    danger_rgb = "rgb(181, 80, 43)"
    for safe_selector in ["#authSignUpBtn", "#authForgotBtn"]:
        assert hover_color(safe_selector) != danger_rgb, f"{safe_selector} shouldn't hover red"

    page.click("#saveSaleBtn")
    page.wait_for_timeout(300)
    assert hover_color("#exportCsvBtn") != danger_rgb, "Export CSV shouldn't hover red"
    assert hover_color("#clearHistoryBtn") == danger_rgb, "Clear all should still hover red"


def test_all_platform_fee_formulas(page, context):
    """One hand-checked number per remaining platform (Etsy has its own
    test above) — isolates each fee formula with shipCost=itemCost=0 and
    shipCharged=0 so the fee is the only thing being measured."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")

    def check(platform_label, price, expected_fee, expected_keep):
        page.click(f'button.platform-pill:has-text("{platform_label}")')
        page.fill("#price", str(price))
        page.fill("#shipCharged", "0")
        page.fill("#shipCost", "0")
        page.fill("#itemCost", "0")
        page.wait_for_timeout(150)
        fee = page.inner_text("#rFee")
        keep = page.inner_text("#rKeep")
        assert fee == expected_fee, f"{platform_label}: expected fee {expected_fee}, got {fee}"
        assert keep == expected_keep, f"{platform_label}: expected keep {expected_keep}, got {keep}"

    # eBay: 100*0.1325 + 0.30 = 13.55
    check("eBay", 100, "-$13.55", "$86.45")
    # Depop: 100*0.029 + 0.30 = 3.20
    check("Depop", 100, "-$3.20", "$96.80")
    # Mercari: 100*0.10 + 100*0.029 + 0.30 = 13.20
    check("Mercari", 100, "-$13.20", "$86.80")
    # TikTok Shop: 100*0.08 = 8.00
    check("TikTok Shop", 100, "-$8.00", "$92.00")
    # Shopify: same shape as Depop -> 3.20
    check("Shopify", 100, "-$3.20", "$96.80")
    # Poshmark has a branch at $15 — check both sides of it.
    check("Poshmark", 10, "-$2.95", "$7.05")   # under $15: flat fee
    check("Poshmark", 100, "-$20.00", "$80.00")  # $15 and up: 20%


def test_negative_input_floored(page, context):
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.fill("#price", "-50")
    page.wait_for_timeout(150)
    assert page.inner_text("#rPrice") == "$0.00", "a typed negative price should floor to $0 in the math"


def test_loss_flips_to_red(page, context):
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.fill("#price", "10.00")
    page.fill("#shipCharged", "0")
    page.fill("#shipCost", "0")
    page.fill("#itemCost", "50.00")
    page.wait_for_timeout(150)
    assert page.evaluate("document.getElementById('keepBlock').classList.contains('is-loss')"), \
        "a net loss should add the is-loss class that turns the number red"


def test_shipping_insight_shows_and_hides(page, context):
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.fill("#price", "42.00")
    page.fill("#shipCharged", "3.00")
    page.fill("#shipCost", "9.00")
    page.fill("#itemCost", "8.00")
    page.wait_for_timeout(150)
    assert page.is_visible("#shippingInsight")
    assert "$6.00" in page.inner_text("#shippingInsightText")

    page.fill("#shipCost", "2.00")
    page.wait_for_timeout(150)
    assert not page.is_visible("#shippingInsight"), "insight should hide once shipping isn't underwater"


def test_local_history_save_reload_delete_clear(page, context):
    """Exercises the signed-out path — a fresh browser context has no
    Supabase session, so this hits localStorage exactly like Milestone 2."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    assert page.is_visible("#historyEmpty")
    assert not page.is_visible("#historySummary")

    page.click("#saveSaleBtn")
    page.wait_for_timeout(300)
    assert len(page.query_selector_all(".history-row")) == 1
    assert page.is_visible("#historySummary")

    page.reload()
    page.wait_for_timeout(200)
    assert len(page.query_selector_all(".history-row")) == 1, "local history should survive a reload"

    page.click(".history-delete")
    page.wait_for_timeout(200)
    assert len(page.query_selector_all(".history-row")) == 0
    assert page.is_visible("#historyEmpty")


def test_history_filter_and_sort(page, context):
    """The platform filter is pills, not a dropdown, specifically so more
    than one can be active at once (e.g. "Etsy + eBay + TikTok Shop")."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#saveSaleBtn")

    def save(platform_label, price):
        if platform_label:
            page.click(f'button.platform-pill:has-text("{platform_label}")')
        page.fill("#price", str(price))
        page.wait_for_timeout(80)
        page.click("#saveSaleBtn")
        page.wait_for_timeout(200)

    save(None, "42.00")     # Depop (default), lowest keep
    save("Etsy", "100.00")  # highest keep
    save("eBay", "60.00")
    page.wait_for_timeout(200)

    all_pill = page.query_selector("#historyFilterPlatforms button[data-key='all']")
    assert all_pill.get_attribute("aria-pressed") == "true", "All should be active with no filter chosen"

    # Multiple platforms together
    page.click("#historyFilterPlatforms button[data-key='etsy']")
    page.click("#historyFilterPlatforms button[data-key='ebay']")
    page.wait_for_timeout(150)
    assert all_pill.get_attribute("aria-pressed") == "false"
    rows_text = " ".join(r.inner_text() for r in page.query_selector_all(".history-row"))
    assert "Etsy" in rows_text and "eBay" in rows_text and "Depop" not in rows_text

    # Deselecting every specific pill falls back to "All"
    page.click("#historyFilterPlatforms button[data-key='etsy']")
    page.click("#historyFilterPlatforms button[data-key='ebay']")
    page.wait_for_timeout(150)
    assert all_pill.get_attribute("aria-pressed") == "true"
    assert len(page.query_selector_all(".history-row")) == 3

    # A platform with zero matching entries shows the filter-empty state
    page.click("#historyFilterPlatforms button[data-key='shopify']")
    page.wait_for_timeout(150)
    assert page.is_visible("#historyFilterEmpty")
    page.click("#historyFilterPlatforms button[data-key='all']")
    page.wait_for_timeout(150)

    # Sort by highest/lowest kept
    page.select_option("#historySortBy", "highest")
    page.wait_for_timeout(150)
    assert "Etsy" in page.query_selector(".history-row").inner_text()
    page.select_option("#historySortBy", "lowest")
    page.wait_for_timeout(150)
    assert "Depop" in page.query_selector(".history-row").inner_text()


def test_profit_chart(page, context):
    """A one-bar bar chart is a known anti-pattern (it's really just a
    number) — the chart should hold off until there's something to
    actually compare."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#saveSaleBtn")

    def save(platform_label, price):
        page.click(f'button.platform-pill:has-text("{platform_label}")')
        page.fill("#price", str(price))
        page.wait_for_timeout(80)
        page.click("#saveSaleBtn")
        page.wait_for_timeout(200)

    save("Depop", "42.00")
    page.click("#toggleChartBtn")
    page.wait_for_timeout(150)
    assert page.is_visible("#profitChartSection")
    assert "more than one platform" in page.inner_text("#profitChartNote")
    assert len(page.query_selector_all(".chart-row")) == 0

    save("Etsy", "100.00")
    page.wait_for_timeout(300)
    rows = page.query_selector_all(".chart-row")
    assert len(rows) == 2
    assert "Etsy" in rows[0].inner_text() and "1 sale" in rows[0].inner_text(), \
        "Etsy's bigger sale should sort first"
    widths = [page.evaluate("el => el.style.width", r.query_selector(".chart-row-bar")) for r in rows]
    assert widths[0] == "100%", "the largest value's bar should fill the track"
    assert float(widths[1].rstrip("%")) < 100

    # A second Depop sale should aggregate into the same bar, not a new one
    save("Depop", "10.00")
    page.wait_for_timeout(300)
    rows = page.query_selector_all(".chart-row")
    assert len(rows) == 2, "still one bar per platform, not one per sale"
    depop_row_text = next(r.inner_text() for r in rows if "Depop" in r.inner_text())
    assert "2 sales" in depop_row_text


def test_malicious_platform_value_does_not_execute_as_html(page, context):
    """Regression test: schema.sql never actually restricts the "platform"
    column to our own fixed list — someone could set it to anything via
    a direct API call, bypassing the UI entirely. renderHistory() used to
    interpolate it into innerHTML unescaped, which would have run it as
    real HTML/script instead of displaying it as plain text."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#saveSaleBtn")

    page.evaluate("""
        () => {
            history.push({
                id: 'test-xss-entry',
                date: new Date().toISOString(),
                platform: '<img src=x onerror="window.__xss = true">',
                price: 10, shipCharged: 0, shipCost: 0, itemCost: 0, fee: 0, keep: 10,
            });
            renderHistory();
        }
    """)
    page.wait_for_timeout(150)

    assert page.evaluate("window.__xss") is not True, "the payload must never actually execute"
    assert page.locator(".history-platform img").count() == 0, "no real <img> element should exist"
    shown_text = page.inner_text(".history-platform")
    assert "<img" in shown_text, "the tag should appear as literal visible text, not be swallowed"


def test_csv_export(page, context):
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    assert page.is_disabled("#exportCsvBtn"), "export should be disabled with nothing saved yet"

    page.click("#saveSaleBtn")
    page.wait_for_timeout(300)
    page.click('button.platform-pill:has-text("Etsy")')
    page.fill("#price", "100.00")
    page.wait_for_timeout(100)
    page.click("#saveSaleBtn")
    page.wait_for_timeout(300)

    with page.expect_download() as dl_info:
        page.click("#exportCsvBtn")
    raw = pathlib.Path(dl_info.value.path()).read_bytes().decode("utf-8")

    assert "\r\n" in raw, "CSV should use CRLF line endings"
    lines = raw.strip().split("\r\n")
    assert lines[0] == "Date,Platform,Sale Price,Shipping Charged,Shipping Cost,Item Cost,Fee,Kept"
    assert len(lines) == 3, f"expected header + 2 rows, got {len(lines)}: {lines}"
    assert "Depop" in lines[1], "the sale saved first should come first (oldest-first order)"
    assert "Etsy" in lines[2], "the sale saved second should come second"


def test_csv_export_defuses_formula_injection(page, context):
    """Regression test: same root cause as the XSS test above — since
    "platform" isn't actually restricted to our own list in the database,
    a value like "=cmd|...'" would be interpreted as a live formula by
    Excel/Sheets, not displayed as text, if exported as-is."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.evaluate("""
        () => {
            history.push({
                id: 'test-csv-injection',
                date: new Date().toISOString(),
                platform: '=1+1',
                price: 10, shipCharged: 0, shipCost: 0, itemCost: 0, fee: 0, keep: 10,
            });
        }
    """)
    with page.expect_download() as dl_info:
        page.evaluate("() => { renderHistory(); document.getElementById('exportCsvBtn').click(); }")
    raw = pathlib.Path(dl_info.value.path()).read_bytes().decode("utf-8")
    assert "'=1+1" in raw, "a leading apostrophe should defuse the formula while keeping the value readable"


def test_failed_cloud_save_does_not_show_false_success(page, context):
    """Regression test: a failed save used to still flash "Saved ✓" and
    stay disabled, because the click handler didn't check the outcome."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#saveSaleBtn")

    # Fake being signed in with a save that's rigged to fail, without
    # needing a real Supabase project or network access.
    page.evaluate("""
        () => {
            currentUser = { id: 'fake-user-for-test', email: 'fake@example.com' };
            supabaseClient = {
                from: () => ({ insert: async () => ({ error: { message: 'simulated failure' } }) }),
            };
        }
    """)
    page.click("#saveSaleBtn")
    page.wait_for_timeout(400)

    assert page.inner_text("#saveSaleBtn") == "Save this sale to history", \
        "must not show 'Saved' text when the save actually failed"
    assert not page.is_disabled("#saveSaleBtn"), "button should re-enable after a failure, not stay stuck"
    assert page.locator(".toast.is-error").count() == 1, "a failure should show one error toast"


def test_signup_without_session_prompts_email_confirmation(page, context):
    """Regression test: if a Supabase project has "Confirm email" on,
    signUp succeeds but returns no session — the UI must say so instead
    of silently doing nothing. (This project's real settings have it off,
    so this is only exercised via a mocked response.)

    Only runs when supabase-config.js currently holds real credentials —
    the auth form (and its signUp wiring) only exists in that state. If
    you've reset it to the placeholder values, this test skips itself
    rather than failing over something that isn't actually broken."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#authCard")
    if page.is_visible("#authNotConfigured"):
        raise Skipped("supabase-config.js doesn't hold real credentials right now")

    page.wait_for_selector("#authForm")
    page.evaluate("""
        () => {
            supabaseClient.auth.signUp = async () => ({ data: { user: {id:'x'}, session: null }, error: null });
        }
    """)
    page.fill("#authEmail", "someone@example.com")
    page.fill("#authPassword", "password123")
    page.click("#authSignUpBtn")
    page.wait_for_timeout(300)
    assert "check your email" in page.inner_text("#authMessage").lower()


def test_pro_status_not_configured_fallback(page, context):
    """refreshProStatus() must short-circuit to the "not set up yet"
    state without ever touching currentUser or the database, when
    stripe-config.js holds the placeholder value. Only makes sense while
    it actually does — once a real Payment Link is filled in (as it now
    is, verified end-to-end with a real Stripe test-mode checkout), this
    scenario no longer applies, so it skips rather than fails, the same
    pattern as the analogous Supabase-not-configured test elsewhere."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#authCard")

    if page.evaluate("() => isStripeConfigured"):
        raise Skipped("stripe-config.js holds a real Payment Link right now")

    # #proNotConfigured lives inside #authSignedIn, which onAuthStateChange
    # would normally unhide on a real sign-in. Unhide it here directly so
    # this test can check refreshProStatus() in isolation, without also
    # depending on the (separately-tested) sign-in flow.
    page.evaluate("() => { document.getElementById('authSignedIn').hidden = false; }")
    page.evaluate("() => refreshProStatus()")
    page.wait_for_timeout(150)

    assert page.is_visible("#proNotConfigured")
    assert not page.is_visible("#proUpgradeBtn")
    assert page.evaluate("document.getElementById('planBadge').textContent") == "Free plan"


def test_pro_status_configured_shows_working_upgrade_link(page, context):
    """The mirror image of the test above: once stripe-config.js holds a
    real Payment Link (as it now does — verified end-to-end with a real
    Stripe test-mode checkout that correctly flipped a test account to
    Pro), a signed-in account with no subscription row yet should see a
    working Upgrade button, not the "not configured" message. Skips if
    run against a fresh clone that hasn't set up Stripe yet.

    Faked, not a real signup: this used to click #authSignUpBtn for real,
    which created a genuine new account in the live project on every
    single test run — exactly what this file is supposed to avoid (see
    tests/README.md). Faking currentUser and the subscriptions lookup,
    then calling refreshProStatus() directly, checks the same UI logic
    without touching the real database at all."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#authCard")
    if not page.evaluate("() => isStripeConfigured"):
        raise Skipped("stripe-config.js doesn't hold a real Payment Link right now")

    page.evaluate("""
        () => {
            currentUser = { id: 'fake-user-for-test', email: 'fake@example.com' };
            document.getElementById('authSignedOut').hidden = true;
            document.getElementById('authSignedIn').hidden = false;
            supabaseClient.from = () => ({
                select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            });
            refreshProStatus();
        }
    """)
    page.wait_for_timeout(300)

    assert page.is_visible("#proUpgradeBtn"), "a never-paid account should see a working Upgrade button"
    assert not page.is_visible("#proNotConfigured")
    href = page.get_attribute("#proUpgradeBtn", "href")
    assert "client_reference_id=fake-user-for-test" in href, "the link must carry this account's id for the webhook to use"
    assert page.evaluate("document.getElementById('planBadge').textContent") == "Free plan"


def test_stale_pro_status_response_cannot_overwrite_a_newer_one(page, context):
    """Regression test: sign in as A, whose subscription lookup is slow
    and still in flight, then switch to B, whose (faster) lookup resolves
    first. When A's old response finally does arrive, it used to still
    overwrite the page with A's data even though B is who's actually
    signed in now."""
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#authCard")
    if not page.evaluate("() => isStripeConfigured"):
        raise Skipped("stripe-config.js doesn't hold a real Payment Link right now")

    page.evaluate("""
        async () => {
            document.getElementById('authSignedOut').hidden = true;
            document.getElementById('authSignedIn').hidden = false;

            // User A signs in; their lookup is rigged to hang until we
            // manually resolve it below.
            authGeneration = 5;
            currentUser = { id: 'user-a' };
            let resolveA;
            supabaseClient.from = () => ({
                select: () => ({ maybeSingle: () => new Promise(r => { resolveA = r; }) }),
            });
            const staleCall = refreshProStatus(5);

            // User B signs in next (a newer generation) before A's
            // lookup has resolved, and B's own lookup finishes fast.
            authGeneration = 6;
            currentUser = { id: 'user-b' };
            supabaseClient.from = () => ({
                select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            });
            await refreshProStatus(6);

            // *Now* A's old lookup finally resolves, claiming Pro.
            resolveA({ data: { status: 'active', current_period_end: null }, error: null });
            await staleCall;
        }
    """)
    page.wait_for_timeout(150)

    href = page.get_attribute("#proUpgradeBtn", "href")
    badge = page.evaluate("document.getElementById('planBadge').textContent")
    assert "user-b" in href, "should still point at B, not get overwritten by A's stale response"
    assert badge == "Free plan", "B's correct status shouldn't be overwritten by A's stale 'active' response"


TESTS = [
    ("calculator math (Etsy, hand-checked numbers)", test_calculator_math),
    ("compare all platforms", test_compare_all_platforms),
    ("print view: interactive chrome hides, receipt stays", test_print_view),
    ("only the destructive action hovers red", test_only_destructive_action_hovers_red),
    ("calculator math (all other platforms + Poshmark's $15 branch)", test_all_platform_fee_formulas),
    ("negative input floors to $0", test_negative_input_floored),
    ("a loss flips \"You keep\" to red", test_loss_flips_to_red),
    ("shipping-cost insight shows and hides correctly", test_shipping_insight_shows_and_hides),
    ("local history: save, reload, delete, clear", test_local_history_save_reload_delete_clear),
    ("history filter (multi-select) and sort", test_history_filter_and_sort),
    ("profit chart by platform", test_profit_chart),
    ("a malicious platform value can't execute as HTML", test_malicious_platform_value_does_not_execute_as_html),
    ("CSV export: header, order, and values", test_csv_export),
    ("CSV export defuses formula injection", test_csv_export_defuses_formula_injection),
    ("failed cloud save doesn't show a false \"Saved\"", test_failed_cloud_save_does_not_show_false_success),
    ("sign-up with no session prompts email confirmation", test_signup_without_session_prompts_email_confirmation),
    ("Pro status: not-configured fallback", test_pro_status_not_configured_fallback),
    ("Pro status: configured shows a working upgrade link", test_pro_status_configured_shows_working_upgrade_link),
    ("Pro status: a stale response can't overwrite a newer one", test_stale_pro_status_response_cannot_overwrite_a_newer_one),
]


def run_one(browser, name, fn):
    # A fresh browser context per test = a fresh, empty localStorage per
    # test, so tests can't leave data behind that trips up the next one.
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()
    page_errors = []
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    try:
        fn(page, context)
        if page_errors or console_errors:
            raise AssertionError(f"unexpected page/console errors: {page_errors + console_errors}")
        print(f"  PASS  {name}")
        return "pass"
    except Skipped as exc:
        print(f"  SKIP  {name}")
        print(f"        {exc}")
        return "skip"
    except Exception as exc:
        print(f"  FAIL  {name}")
        print(f"        {exc}")
        return "fail"
    finally:
        context.close()


def main():
    print(f"Running {len(TESTS)} tests against {INDEX_URL}\n")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        outcomes = [run_one(browser, name, fn) for name, fn in TESTS]
        browser.close()

    passed = outcomes.count("pass")
    skipped = outcomes.count("skip")
    failed = outcomes.count("fail")
    summary = f"\n{passed}/{len(TESTS)} passed"
    if skipped:
        summary += f", {skipped} skipped"
    if failed:
        summary += f", {failed} FAILED"
    print(summary)
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
