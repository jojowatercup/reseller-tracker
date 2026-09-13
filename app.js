const PLATFORMS = {
  etsy: { name: "Etsy", note: "6.5% transaction fee on item + shipping, plus roughly 3% + $0.25 payment processing. Listing fees ($0.20 each) aren't included here.",
    fee: (price, ship) => { const t = price + ship; return t * 0.065 + t * 0.03 + 0.25; } },
  ebay: { name: "eBay", note: "About 13.25% final value fee on item + shipping (varies 2%–15% by category) plus a $0.30 per-order fee.",
    fee: (price, ship) => { const t = price + ship; return t * 0.1325 + 0.30; } },
  poshmark: { name: "Poshmark", note: "Flat $2.95 fee on sales under $15, or 20% of the sale price at $15 and up. Poshmark provides a prepaid shipping label, so buyer shipping isn't charged to you the same way.",
    fee: (price) => price < 15 ? 2.95 : price * 0.20 },
  depop: { name: "Depop", note: "Depop dropped its 10% marketplace fee for standard US sellers — you mainly pay Depop Payments processing, roughly 2.9% + $0.30. Worth double-checking against your account.",
    fee: (price, ship) => { const t = price + ship; return t * 0.029 + 0.30; } },
  mercari: { name: "Mercari", note: "10% selling fee on item + shipping, plus roughly 2.9% + $0.30 payment processing.",
    fee: (price, ship) => { const t = price + ship; return t * 0.10 + t * 0.029 + 0.30; } },
  tiktokshop: { name: "TikTok Shop", note: "Commission varies a lot by category and ongoing promotions — often somewhere in the 2–8%+ range. Check your category's current rate; this uses 8% as a general placeholder.",
    fee: (price, ship) => (price + ship) * 0.08 },
  shopify: { name: "Shopify", note: "Shopify isn't a marketplace, so there's no per-sale commission — you run your own store. This reflects a typical Shopify Payments processing rate (roughly 2.9% + $0.30 online). Your actual rate depends on your plan and payment gateway, and your monthly subscription isn't included here since it isn't tied to any one sale.",
    fee: (price, ship) => { const t = price + ship; return t * 0.029 + 0.30; } },
};

let currentPlatform = "depop";

const platformRow = document.getElementById("platformRow");
Object.entries(PLATFORMS).forEach(([key, p]) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "platform-pill";
  btn.textContent = p.name;
  btn.setAttribute("aria-pressed", key === currentPlatform ? "true" : "false");
  btn.addEventListener("click", () => {
    currentPlatform = key;
    [...platformRow.children].forEach(c => c.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    calculate();
  });
  platformRow.appendChild(btn);
});

const $ = id => document.getElementById(id);
const money = n => (n < 0 ? "-$" + Math.abs(n).toFixed(2) : "$" + n.toFixed(2));

// Escapes a value before it goes into innerHTML. The "platform" on a
// history entry is normally always one of our own fixed platform names —
// but the sales table doesn't actually enforce that in the database, so
// someone could insert a row with an arbitrary platform string directly
// through the API, bypassing this page's own dropdown. Without this,
// that string would render as real HTML instead of plain text.
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

// A small on-page message that appears near the bottom of the screen
// and fades itself out — used instead of the browser's built-in alert(),
// which blocks the whole page and looks jarring next to everything else
// here. role="alert" on an error interrupts a screen reader immediately;
// role="status" on a success message just gets mentioned when convenient.
function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = "toast" + (isError ? " is-error" : "");
  toast.setAttribute("role", isError ? "alert" : "status");
  toast.textContent = message;
  $("toastContainer").appendChild(toast);

  setTimeout(() => {
    toast.classList.add("is-leaving");
    toast.addEventListener("transitionend", () => toast.remove());
    // If reduced motion is on, there's no transition to wait for —
    // remove it directly instead of leaving it stuck on screen.
    setTimeout(() => toast.remove(), 300);
  }, isError ? 5000 : 3000);
}

// ---- Theme toggle (light/dark) ----------------------------------------
// The CSS already switches automatically based on the OS setting
// (@media prefers-color-scheme). Setting data-theme="light" or "dark" on
// <html> overrides that — this button just flips that override on and
// off and remembers the choice. The inline script at the top of
// index.html applies a saved choice immediately on load, before this
// file even runs, so there's no flash of the wrong theme.
const THEME_KEY = "resellerTracker.theme";
const themeToggle = $("themeToggle");

function currentTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeToggle() {
  const isDark = currentTheme() === "dark";
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
}

themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (err) {
    // The theme still switches for this visit even if it can't be
    // remembered for next time (e.g. storage blocked or full).
    console.warn("Couldn't save theme preference.", err);
  }
  updateThemeToggle();
});

updateThemeToggle();

// Reads the current form fields and does the fee math once, so both the
// on-screen receipt and the "save to history" button use the exact same
// numbers instead of two copies of the same calculation drifting apart.
// Math.max(0, ...) floors a typed negative number to $0 for the actual
// math — a negative sale price or cost isn't a real scenario this
// calculator needs to support, so we quietly ignore the minus sign
// rather than let it produce a nonsensical receipt.
function computeCurrent() {
  const price = Math.max(0, parseFloat($("price").value) || 0);
  const shipCharged = Math.max(0, parseFloat($("shipCharged").value) || 0);
  const shipCost = Math.max(0, parseFloat($("shipCost").value) || 0);
  const itemCost = Math.max(0, parseFloat($("itemCost").value) || 0);

  const platform = PLATFORMS[currentPlatform];
  const total = price + shipCharged;
  const fee = platform.fee(price, shipCharged);
  const keep = total - fee - shipCost - itemCost;
  const rate = price > 0 ? (keep / price) * 100 : 0;

  return { price, shipCharged, shipCost, itemCost, platform, total, fee, keep, rate };
}

function calculate() {
  const r = computeCurrent();

  $("platformNote").textContent = r.platform.note;
  $("receiptTitle").textContent = `Payout breakdown — ${r.platform.name}`;
  $("rPrice").textContent = money(r.price);
  $("rShipCharged").textContent = money(r.shipCharged);
  $("rTotal").textContent = money(r.total);
  $("rFee").textContent = "-" + money(r.fee);
  $("rShipCost").textContent = "-" + money(r.shipCost);
  $("rItemCost").textContent = "-" + money(r.itemCost);
  $("rKeep").textContent = money(r.keep);
  $("rRate").innerHTML = `That's <strong>${r.rate.toFixed(1)}%</strong> of your $${r.price.toFixed(2)} sale price.`;
  $("keepBlock").classList.toggle("is-loss", r.keep < 0);

  // A gentle heads-up when shipping alone is already a losing proposition,
  // independent of whatever else the sale does or doesn't make.
  const shippingGap = r.shipCost - r.shipCharged;
  const insight = $("shippingInsight");
  if (shippingGap > 0) {
    insight.hidden = false;
    $("shippingInsightText").textContent =
      `Your shipping cost is ${money(shippingGap)} more than what you charged the buyer for shipping.`;
  } else {
    insight.hidden = true;
  }
}

["price", "shipCharged", "shipCost", "itemCost"].forEach(id => {
  $(id).addEventListener("input", calculate);
});

calculate();

// Only rendered when the page is printed (see the @media print rules in
// style.css) — a plain paper trail of when this record was produced.
$("printStamp").textContent =
  `Printed ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} ` +
  "from The Real Cut — estimates only, not tax advice.";

// ---- Cloud connection (Supabase) --------------------------------------
// supabase-config.js (loaded before this file) defines SUPABASE_URL and
// SUPABASE_ANON_KEY. Until those are filled in with a real project, we
// stay "not configured" and the app quietly behaves exactly like
// Milestone 2 — sales history saved to this browser only.
const isSupabaseConfigured =
  typeof SUPABASE_URL === "string" &&
  SUPABASE_URL &&
  SUPABASE_URL !== "YOUR_PROJECT_URL_HERE" &&
  window.supabase;

let supabaseClient = null;
if (isSupabaseConfigured) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn("Supabase config looks invalid, falling back to local-only history.", err);
  }
}

// ---- Pro subscription (Stripe) -----------------------------------------
// stripe-config.js (loaded before this file) defines STRIPE_PAYMENT_LINK
// — just a URL, filled in once a Payment Link exists in the Stripe
// Dashboard. Until then, the Upgrade button stays hidden and a "not set
// up yet" note shows instead (same fallback pattern as Supabase above).
const isStripeConfigured =
  typeof STRIPE_PAYMENT_LINK === "string" &&
  STRIPE_PAYMENT_LINK &&
  STRIPE_PAYMENT_LINK !== "YOUR_PAYMENT_LINK_URL_HERE";

// Bumped every time onAuthStateChange fires. If someone signs out and
// back in as a different account while a slow refreshProStatus() /
// refreshConnections() call for the *previous* account is still waiting
// on a database round-trip, that older call checks this before touching
// the page — so it can never overwrite what the newer sign-in already
// correctly displayed. Defaults to "whatever generation is current right
// now" so a direct, ad-hoc call (tests, or future code) is always its
// own generation and never second-guesses itself.
let authGeneration = 0;

async function refreshProStatus(forGeneration = authGeneration) {
  const badge = $("planBadge");
  const statusText = $("planStatusText");
  const upgradeBtn = $("proUpgradeBtn");
  const notConfigured = $("proNotConfigured");

  if (!isStripeConfigured) {
    upgradeBtn.hidden = true;
    notConfigured.hidden = false;
    return;
  }
  notConfigured.hidden = true;

  // Shown (and already usable — the link works standalone) before we
  // even know the current status, so a failed status check below can
  // never leave someone stuck with no way to upgrade at all.
  upgradeBtn.hidden = false;

  // Attaching who's checking out is what lets the webhook later know
  // *which* Supabase account to mark as Pro — Stripe carries this
  // straight through from the URL into the resulting Checkout Session.
  upgradeBtn.href = `${STRIPE_PAYMENT_LINK}?client_reference_id=${encodeURIComponent(currentUser.id)}`;

  // maybeSingle() (rather than single()) tolerates zero rows without
  // treating it as an error — a brand-new account that's never
  // subscribed simply has no row in "subscriptions" yet.
  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("status, current_period_end")
    .maybeSingle();

  // Someone else signed in (or out) while that request was in flight —
  // whichever call is actually current gets to keep the last word.
  if (forGeneration !== authGeneration) return;

  if (error) {
    // Not fatal — the upgrade link above already works even if we can't
    // read current status yet (e.g. schema-subscriptions.sql hasn't
    // been run). Leave the badge on its default "Free plan" rather than
    // claiming to know more than we do.
    console.warn("Couldn't check Pro status", error);
    return;
  }

  const isPro = data && data.status === "active";
  badge.textContent = isPro ? "Pro" : "Free plan";
  badge.classList.toggle("is-pro", isPro);
  upgradeBtn.hidden = isPro;

  if (isPro) {
    const until = data.current_period_end
      ? new Date(data.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : null;
    statusText.textContent = until
      ? `You're on Pro, renewing ${until}.`
      : "You're on Pro.";
  } else {
    statusText.textContent = "Pro unlocks automatic marketplace imports once Milestone 4 ships.";
  }

  currentUserIsPro = isPro;
  await refreshConnections(forGeneration);
}

// ---- Marketplace connections (Etsy OAuth) ------------------------------
// Only relevant once someone's on Pro — the free tier stays manual-entry
// only, per the Milestone 5 plan.
let currentUserIsPro = false;

// Etsy's OAuth needs an extra security step called PKCE: before sending
// someone to Etsy to approve access, we generate a random secret (the
// "verifier"), keep it hidden, and only send Etsy a scrambled version of
// it (the "challenge" — a SHA-256 hash). When Etsy sends the person back
// with an approval code, our server proves it was really us who started
// this by revealing the original verifier. Without this, someone who
// intercepted the approval code alone couldn't finish the exchange.
function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

// Must exactly match the redirect_uri the etsy-oauth-callback function
// itself uses when exchanging the code — Etsy rejects a mismatch.
const ETSY_REDIRECT_URI = "https://utaepqledbcvwrjpqvys.supabase.co/functions/v1/etsy-oauth-callback";

async function refreshConnections(forGeneration = authGeneration) {
  const block = $("connectionsBlock");
  if (!currentUserIsPro) {
    block.hidden = true;
    return;
  }
  block.hidden = false;

  const { data, error } = await supabaseClient
    .from("platform_connection_status")
    .select("connected_at")
    .eq("platform", "etsy")
    .maybeSingle();

  // Same stale-response guard as refreshProStatus() above.
  if (forGeneration !== authGeneration) return;

  const badge = $("etsyBadge");
  const text = $("etsyStatusText");
  const btn = $("connectEtsyBtn");

  if (!error && data) {
    badge.textContent = "Connected";
    badge.classList.add("is-pro");
    const since = new Date(data.connected_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    text.textContent = `Connected to Etsy since ${since}.`;
    btn.textContent = "Reconnect Etsy";
  } else {
    badge.textContent = "Not connected";
    badge.classList.remove("is-pro");
    text.textContent = "Connect your Etsy shop to import orders automatically.";
    btn.textContent = "Connect Etsy";
  }
}

$("connectEtsyBtn").addEventListener("click", async () => {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = makeId();

  // user_id isn't sent — like the sales table, it's filled in
  // automatically from auth.uid() (see schema-platform-connections.sql).
  const { error } = await supabaseClient.from("oauth_flow_state").insert({
    state,
    platform: "etsy",
    code_verifier: verifier,
  });

  if (error) {
    showToast("Couldn't start the Etsy connection: " + error.message, true);
    return;
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: ETSY_KEYSTRING,
    redirect_uri: ETSY_REDIRECT_URI,
    scope: "transactions_r shops_r",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.href = `https://www.etsy.com/oauth/connect?${params.toString()}`;
});

// Set by the auth listener near the bottom of this file. null = signed out.
let currentUser = null;

// ---- Sales history: local (localStorage) when signed out, ------------
// ---- cloud (Supabase) when signed in ----------------------------------
const HISTORY_KEY = "resellerTracker.history";
let history = [];

function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    // If the saved text is ever corrupted or from an old format,
    // fail safe with an empty list instead of crashing the page.
    console.warn("Couldn't read saved history, starting fresh.", err);
    return [];
  }
}

function persistLocalHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function makeId() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Supabase gives back column names like "ship_charged" (snake_case, the
// SQL convention). This turns a row into the same shape the rest of the
// app already uses (camelCase), so renderHistory() doesn't need to care
// which storage a given entry came from. Number(...) guards against the
// database occasionally sending numeric columns back as text.
function fromCloudRow(row) {
  return {
    id: row.id,
    date: row.created_at,
    platform: row.platform,
    price: Number(row.price),
    shipCharged: Number(row.ship_charged),
    shipCost: Number(row.ship_cost),
    itemCost: Number(row.item_cost),
    fee: Number(row.fee),
    keep: Number(row.keep),
  };
}

// Talking to Supabase happens over the internet, so it takes a little
// time and can fail (bad connection, etc). "async" + "await" is how
// JavaScript waits for that without freezing the rest of the page:
// this function pauses at each "await" until that step finishes, then
// continues — everything else on the page keeps working meanwhile.
async function refreshHistory() {
  if (currentUser) {
    // No need to filter "where user_id = me" here — the Row Level
    // Security policies in schema.sql already guarantee this only
    // returns the signed-in user's own rows.
    const { data, error } = await supabaseClient
      .from("sales")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("Couldn't load cloud history", error);
      history = [];
    } else {
      history = data.map(fromCloudRow);
    }
  } else {
    history = loadLocalHistory();
  }
  renderHistory();
}

// Returns true/false so the "Saved ✓" button feedback only shows up
// when the sale actually got saved — without this, a failed cloud save
// (bad connection, etc.) would still flash a false success message.
async function addSaleToHistory(entry) {
  if (currentUser) {
    // user_id isn't sent — the database fills it in from auth.uid()
    // automatically (see schema.sql's "default auth.uid()").
    const { error } = await supabaseClient.from("sales").insert({
      platform: entry.platform,
      price: entry.price,
      ship_charged: entry.shipCharged,
      ship_cost: entry.shipCost,
      item_cost: entry.itemCost,
      fee: entry.fee,
      keep: entry.keep,
    });
    if (error) { showToast("Couldn't save to your account: " + error.message, true); return false; }
  } else {
    history.push(entry);
    persistLocalHistory();
  }
  await refreshHistory();
  return true;
}

async function deleteSaleFromHistory(id) {
  if (currentUser) {
    const { error } = await supabaseClient.from("sales").delete().eq("id", id);
    if (error) { showToast("Couldn't delete: " + error.message, true); return; }
  } else {
    history = history.filter(entry => entry.id !== id);
    persistLocalHistory();
  }
  await refreshHistory();
}

async function clearAllHistory() {
  if (currentUser) {
    const { error } = await supabaseClient.from("sales").delete().eq("user_id", currentUser.id);
    if (error) { showToast("Couldn't clear: " + error.message, true); return; }
  } else {
    history = [];
    persistLocalHistory();
  }
  await refreshHistory();
}

// The dropdown's current choices — changing either just re-runs
// renderHistory() below, entirely in memory, no re-fetch needed.
let historyFilterPlatform = "all";
let historySortBy = "newest";

// Filters and sorts a *copy* of history, leaving the real array (and its
// on-disk/on-server order) untouched — CSV export and the running totals
// on save still reflect everything, regardless of what's on screen.
function getVisibleHistory() {
  // .filter() already hands back a brand-new array, so it's already
  // safe for .sort() to rearrange in place below without touching the
  // real, on-disk/on-server ordering in `history` itself.
  const items = history.filter(entry =>
    historyFilterPlatform === "all" || entry.platform === historyFilterPlatform
  );
  const byDate = (a, b) => new Date(a.date) - new Date(b.date);
  switch (historySortBy) {
    case "oldest": items.sort(byDate); break;
    case "highest": items.sort((a, b) => b.keep - a.keep); break;
    case "lowest": items.sort((a, b) => a.keep - b.keep); break;
    default: items.sort((a, b) => byDate(b, a)); break; // "newest"
  }
  return items;
}

function renderHistory() {
  const listEl = $("historyList");
  const emptyEl = $("historyEmpty");
  const filterEmptyEl = $("historyFilterEmpty");
  const summaryEl = $("historySummary");
  const filtersEl = $("historyFilters");
  const clearBtn = $("clearHistoryBtn");
  const exportBtn = $("exportCsvBtn");

  listEl.innerHTML = "";
  clearBtn.disabled = history.length === 0;
  exportBtn.disabled = history.length === 0;

  if (history.length === 0) {
    emptyEl.hidden = false;
    filterEmptyEl.hidden = true;
    summaryEl.hidden = true;
    filtersEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  filtersEl.hidden = false;
  summaryEl.hidden = false;

  const visible = getVisibleHistory();

  // The summary reflects whatever's currently filtered — "how much did I
  // make on Depop" is a more useful answer than always repeating the
  // grand total once a platform filter is applied.
  const totalKeep = visible.reduce((sum, entry) => sum + entry.keep, 0);
  $("historyCount").textContent = visible.length;
  $("historyTotalKeep").textContent = money(totalKeep);

  if (visible.length === 0) {
    filterEmptyEl.hidden = false;
    return;
  }
  filterEmptyEl.hidden = true;

  visible.forEach(entry => {
    const platformName = PLATFORMS[entry.platform]?.name ?? entry.platform;
    const dateLabel = new Date(entry.date).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });

    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML = `
      <div class="history-main">
        <span class="history-platform">${escapeHtml(platformName)}</span>
        <span class="history-date">${dateLabel}</span>
      </div>
      <div class="history-amounts">
        <span class="history-price">${money(entry.price)} sale</span>
        <span class="history-keep">${money(entry.keep)} kept</span>
      </div>
      <button class="history-delete" type="button" data-id="${escapeHtml(entry.id)}" aria-label="Delete this entry">&times;</button>
    `;
    listEl.appendChild(row);
  });
}

// Same platform list the calculator uses, so the filter never drifts out
// of sync with what a saved entry could actually be.
Object.entries(PLATFORMS).forEach(([key, p]) => {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = p.name;
  $("historyFilterPlatform").appendChild(option);
});

$("historyFilterPlatform").addEventListener("change", e => {
  historyFilterPlatform = e.target.value;
  renderHistory();
});

$("historySortBy").addEventListener("change", e => {
  historySortBy = e.target.value;
  renderHistory();
});

const saveSaleBtn = $("saveSaleBtn");
let saveResetTimer = null;

saveSaleBtn.addEventListener("click", async () => {
  const r = computeCurrent();

  // We store the *results* of the math (fee, keep), not just the raw
  // inputs. That way, if a platform's fee formula changes later, old
  // history entries still show what was true when you saved them.
  const entry = {
    id: makeId(),
    date: new Date().toISOString(),
    platform: currentPlatform,
    price: r.price,
    shipCharged: r.shipCharged,
    shipCost: r.shipCost,
    itemCost: r.itemCost,
    fee: r.fee,
    keep: r.keep,
  };

  saveSaleBtn.disabled = true;
  const saved = await addSaleToHistory(entry);
  clearTimeout(saveResetTimer);

  if (saved) {
    saveSaleBtn.textContent = "Saved ✓";
    saveResetTimer = setTimeout(() => {
      saveSaleBtn.textContent = "Save this sale to history";
      saveSaleBtn.disabled = false;
    }, 1200);
  } else {
    // addSaleToHistory already alerted what went wrong — just unlock
    // the button again instead of claiming success it didn't have.
    saveSaleBtn.disabled = false;
  }
});

// One click listener on the whole list (instead of one per row) handles
// delete clicks for every row, including ones added after page load.
// This is called "event delegation."
$("historyList").addEventListener("click", async e => {
  const btn = e.target.closest(".history-delete");
  if (!btn) return;
  await deleteSaleFromHistory(btn.dataset.id);
});

$("clearHistoryBtn").addEventListener("click", async () => {
  if (history.length === 0) return;
  if (!confirm("Delete all saved sales? This can't be undone.")) return;
  await clearAllHistory();
});

// Turns a "," or a `"` or a newline inside a value into a quoted, escaped
// CSV field — without this, a stray comma would silently split one column
// into two when the file is opened in a spreadsheet.
function csvField(value) {
  let s = String(value);
  // Same underlying gap as escapeHtml() above (platform isn't actually
  // restricted to our own list in the database): Excel/Sheets treats a
  // cell starting with =, +, -, or @ as a formula to run, not text to
  // display. A leading apostrophe tells it "literally this," without
  // changing what's visibly shown.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function historyToCsv(rows) {
  const header = ["Date", "Platform", "Sale Price", "Shipping Charged", "Shipping Cost", "Item Cost", "Fee", "Kept"];
  // `history` is already stored oldest-first (renderHistory() is what
  // reverses it for the newest-first list on screen) — so exporting it
  // as-is gives a ledger in the order a bookkeeper would expect.
  const dataRows = rows.map(entry => [
    new Date(entry.date).toLocaleDateString("en-US"),
    PLATFORMS[entry.platform]?.name ?? entry.platform,
    entry.price.toFixed(2),
    entry.shipCharged.toFixed(2),
    entry.shipCost.toFixed(2),
    entry.itemCost.toFixed(2),
    entry.fee.toFixed(2),
    entry.keep.toFixed(2),
  ]);
  return [header, ...dataRows].map(row => row.map(csvField).join(",")).join("\r\n");
}

$("exportCsvBtn").addEventListener("click", () => {
  if (history.length === 0) return;

  // A Blob is just some raw data (our CSV text) held in memory with a type
  // label. Giving a hidden link that Blob as its href, then clicking it
  // ourselves, is the standard way to hand the browser a file to save
  // without ever needing a server to generate it.
  const csv = historyToCsv(history);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const blobUrl = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `reseller-tracker-sales-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
});

// ---- Account (sign up / log in / log out) -----------------------------
if (!isSupabaseConfigured || !supabaseClient) {
  $("authNotConfigured").hidden = false;
  $("authSignedOut").hidden = true;
  refreshHistory();
} else {
  const authForm = $("authForm");
  const authMessage = $("authMessage");

  function showAuthMessage(text, isError) {
    authMessage.textContent = text;
    authMessage.hidden = false;
    authMessage.style.color = isError ? "var(--danger)" : "var(--text-muted)";
  }

  authForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    showAuthMessage("Logging in…", false);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) showAuthMessage(error.message, true);
  });

  $("authSignUpBtn").addEventListener("click", async () => {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    if (!email || !password) {
      showAuthMessage("Enter an email and password above, then click this again.", true);
      return;
    }
    showAuthMessage("Creating account…", false);
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      showAuthMessage(error.message, true);
    } else if (!data.session) {
      // No error, but also no active session: this project has
      // "Confirm email" turned on (off right now, per our Milestone 3
      // setup, but the plan is to turn it back on at Milestone 6) — the
      // account exists but won't sign in until that link is clicked.
      showAuthMessage("Account created — check your email to confirm it before logging in.", false);
    }
    // Otherwise a session came back immediately, and onAuthStateChange
    // below takes over, clearing this message once signed-in view shows.
  });

  $("authSignOutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });

  // Only the "send me a reset link" half of forgot-password lives here.
  // The other half — the email's link landing back on this app so you
  // can actually type a new password — needs a stable https address to
  // send you to, which this project doesn't have until Milestone 6
  // (deploy). Building that half now would mean untestable guesswork,
  // so it's left as a documented gap rather than a half-working feature.
  $("authForgotBtn").addEventListener("click", async () => {
    const email = $("authEmail").value.trim();
    if (!email) {
      showAuthMessage("Enter your email above first, then click this again.", true);
      return;
    }
    showAuthMessage("Sending a reset link…", false);
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error) {
      showAuthMessage(error.message, true);
    } else {
      // Supabase deliberately never reveals whether an account exists
      // for a given email — this message stays the same either way, so
      // this form can't be used to check who has an account here.
      showAuthMessage("If an account exists for that email, a reset link is on its way.", false);
    }
  });

  // Fires immediately with whatever session already exists (e.g. after a
  // page reload), and again every time someone signs in or out.
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    authGeneration++;
    const thisGeneration = authGeneration;

    currentUser = session ? session.user : null;
    $("authSignedOut").hidden = !!currentUser;
    $("authSignedIn").hidden = !currentUser;
    if (currentUser) {
      $("authEmailLabel").textContent = currentUser.email;
      authMessage.hidden = true;
      refreshProStatus(thisGeneration);
    }
    refreshHistory();
  });
}
