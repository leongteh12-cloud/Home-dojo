/* Home Dojo browser tests. Run from the repository folder:  node tests/run.js
   Needs Node and Playwright with Chromium (npm i -g playwright). Starts its own little web server, swaps the real
   database for tests/fake-supabase.js, and drives the app like a person would. Nothing touches the family's real data. */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const { execSync } = require("child_process");
let pw; try { pw = require("playwright"); } catch (e) { pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

const ROOT = path.resolve(__dirname, ".."), PORT = 8790, BASE = `http://localhost:${PORT}/`;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, BASE).pathname); if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});

const VERSION = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").match(/VERSION = "([^"]+)"/)[1];
const DAY = 864e5;
const results = []; let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`); }

/* ---------- test data ---------- */
function kid(id, name, age, extra) {
  return Object.assign({ id, name, age, look: { species: "monster", shape: "round", color: id === "k1" ? "#3D7BFF" : "#FF6F59", eyes: 2, top: "horns", mouth: "smile" }, monsterName: "", shelf: [], equip: {},
    behaviours: [{ id: "listen", icon: "👂", label: "Good listening" }, { id: "calm", icon: "🌬️", label: "Calm body" }], rewards: [{ id: "t1", icon: "🍨", label: "Choose dessert", cost: 5 }],
    milestones: [{ id: "m1", icon: "🍦", label: "Park trip with ice cream", at: 25 }] }, extra || {});
}
function earns(kidId, n, opts) {
  opts = opts || {}; const out = [];
  for (let i = 0; i < n; i++) out.push({ id: `${kidId}-e${i}`, family_id: "f1", kid: kidId, kind: "earn", label: opts.label || "Good listening", icon: "👂", bid: opts.bid || "listen", item: null, mid: null, pts: 1, at: (opts.from || Date.now() - 2 * DAY) + i * (opts.step || 60000), by: "u1" });
  return out;
}
function seed(kids, awards, cfgExtra) {
  return { family_config: [{ family_id: "f1", config: Object.assign({ version: 1, sound: false, pin: "1234", kids, games: { on: true, limit: 3 } }, cfgExtra || {}) }], awards: awards || [] };
}

/* ---------- page helpers ---------- */
async function open(data, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: 400, height: 820 }, serviceWorkers: "block", reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  await ctx.route("**/vendor/supabase.js", (r) => r.fulfill({ path: path.join(__dirname, "fake-supabase.js"), contentType: "text/javascript" }));
  await ctx.addInitScript(([s, v, view]) => {
    window.__SEED = s;
    if (!localStorage.getItem("hd.seenVersion")) localStorage.setItem("hd.seenVersion", JSON.stringify(v));
    if (view && !localStorage.getItem("hd.view")) localStorage.setItem("hd.view", JSON.stringify(view));
  }, [data, VERSION, opts.view || null]);
  const page = await ctx.newPage(); page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(BASE + "index.html"); await page.waitForTimeout(700);
  page.ctx = ctx;
  return page;
}
async function pin(page) { for (const d of "1234") { await page.click(`.keys [data-k="${d}"]`); } await page.waitForTimeout(250); }
async function parents(page) { await page.click("#goParents"); await page.waitForTimeout(200); await pin(page); }
const db = (page, expr) => page.evaluate(expr);
const text = (page) => page.evaluate(() => document.body.innerText);
async function done(page, name) { check(`${name}: no script errors`, !page.errors.length, page.errors.join(" | ")); await page.ctx.close(); }

/* ---------- tests ---------- */
async function testParentsHome() {
  const p = await open(seed([kid("k1", "Liam", 6), kid("k2", "Aaron", 2)], earns("k1", 5)));
  check("menu shows on start", await p.$("#goKids") && await p.$("#goParents"));
  await parents(p);
  const quick = await p.$$('[data-qbeh^="k1|"]');
  check("Parents home has Liam's behaviour buttons (2 + bonus)", quick.length === 3, `found ${quick.length}`);
  await p.click('[data-qbeh="k1|calm"]'); await p.waitForTimeout(600);
  const rows = await db(p, () => window.__DB.awards.filter((a) => a.kid === "k1" && a.kind === "earn" && a.bid === "calm").length);
  check("one tap on the home screen saves a Dojo to the database", rows === 1, `rows ${rows}`);
  check("toast confirms with undo", /\+1 Calm body for Liam/.test(await text(p)) && await p.$("#undoBtn"));
  await p.click("#undoBtn"); await p.waitForTimeout(600);
  const after = await db(p, () => window.__DB.awards.filter((a) => a.bid === "calm").length);
  check("undo removes it from the database", after === 0, `rows ${after}`);
  check("wallet totals show for grown-ups", (await p.$$(".kidcard .wallet")).length === 2);
  await done(p, "Parents home");
}

async function testRewardShow() {
  const p = await open(seed([kid("k1", "Liam", 6)], earns("k1", 24)));
  await parents(p);
  await p.click('[data-qbeh="k1|listen"]'); await p.waitForTimeout(900);
  check("reaching a big reward opens the full-screen show", await p.$(".rshow"));
  check("show names the child and the reward", /Liam did it!/.test(await text(p)) && /Park trip with ice cream/.test(await text(p)));
  check("Hooray is locked at first", await p.$eval("#rsOk", (b) => b.disabled));
  await p.waitForTimeout(3200);
  check("Hooray unlocks after 3 seconds", !(await p.$eval("#rsOk", (b) => b.disabled)));
  await p.click("#rsOk");
  check("Hooray closes the show", !(await p.$(".rshow")));
  check("device remembers it has seen this show", (await p.evaluate(() => localStorage.getItem("hd.rshow")) || "").includes("k1|m1"));
  check("Parents home shows the reward ready to redeem", /Ready to redeem/.test(await text(p)));
  await done(p, "Reward show");
}

async function testRewardReplay() {
  // A grown-up's phone gave the winning Dojo; this tablet has been used before (hd.rshow exists) and is in Kids' play.
  const p = await open(seed([kid("k1", "Liam", 6)], earns("k1", 26, { from: Date.now() - 3600e3 })), { view: "kids" });
  await p.evaluate(() => localStorage.setItem("hd.rshow", "[]")); await p.reload(); await p.waitForTimeout(700);
  await p.click('.kidcard[data-kid="k1"]'); await p.waitForTimeout(1000);
  check("tablet replays the show in Kids' play", await p.$(".rshow"));
  await p.waitForTimeout(3200); await p.click("#rsOk");
  await p.click("#backBtn").catch(() => {}); await p.waitForTimeout(300);
  await p.click('.kidcard[data-kid="k1"]'); await p.waitForTimeout(1000);
  check("and only once", !(await p.$(".rshow")));
  await done(p, "Reward replay");

  const q = await open(seed([kid("k1", "Liam", 6)], earns("k1", 26)), { view: "kids" });
  await q.click('.kidcard[data-kid="k1"]'); await q.waitForTimeout(1000);
  check("a device on its first run doesn't replay rewards won before", !(await q.$(".rshow")));
  await done(q, "Reward first run");
}

async function testKidsPlay() {
  const p = await open(seed([kid("k1", "Liam", 6), kid("k2", "Aaron", 2)], earns("k1", 30).concat(earns("k2", 12))), { view: "kids" });
  check("Kids' play home hides totals", (await p.$$(".kidcard .wallet")).length === 0 && !/Dojo \$/.test(await p.$eval(".kids", (e) => e.innerText)));
  check("Kids' play has no give buttons", (await p.$$("[data-qbeh]")).length === 0);
  await p.click('.kidcard[data-kid="k1"]'); await p.waitForTimeout(500);
  check("Kids' play has no Earn tab", !(await p.$('[data-tab="earn"]')));
  for (const tab of ["shop", "monster", "trophies", "games", "week"]) { await p.click(`[data-tab="${tab}"]`); await p.waitForTimeout(250); }
  check("Kids' play hides the 8-week trend", !(await p.$(".trend")));
  await done(p, "Kids' play");
}

async function testSettingsKeepsYard() {
  const k = kid("k1", "Liam", 6, { yard: { seen: 0, garden: [] } });
  const p = await open(seed([k], earns("k1", 3)));
  await parents(p);
  await p.click("#setBtn"); await p.waitForTimeout(250); await pin(p); await p.waitForTimeout(300);
  check("Settings opens", await p.$("#setSave"));
  // Meanwhile, on the tablet, Liam plants a sunflower and picks new scenery.
  await p.evaluate(() => {
    const c = JSON.parse(JSON.stringify(window.__DB.family_config[0]));
    c.config.kids[0].yard = { seen: 0, garden: [{ t: "sunflower", e: 3 }], scene: { theme: "adv", bg: "space" } };
    c.config.kids[0].best = { bubbles: 42 };
    window.__DB.family_config[0] = c; window.__emit("family_config", "UPDATE", c);
  });
  await p.waitForTimeout(200);
  await p.click("#setSave"); await p.waitForTimeout(700);
  const saved = await db(p, () => window.__DB.family_config[0].config.kids[0]);
  check("saving Settings keeps the yard changed on another device", saved.yard && saved.yard.garden.length === 1 && saved.yard.scene.bg === "space", JSON.stringify(saved.yard));
  check("saving Settings keeps game high scores", saved.best && saved.best.bubbles === 42);
  await done(p, "Settings save");
}

async function testVoiceNotes() {
  const audio = "data:audio/webm;base64," + "A".repeat(120000);
  const notes = [
    { id: "n1", family_id: "f1", kid: "k1", kind: "note", label: "So proud of you!", icon: "💌", bid: null, item: audio, mid: null, pts: 0, at: Date.now() - DAY, by: "u1" },
    { id: "n2", family_id: "f1", kid: "k1", kind: "note", label: "Great listening!", icon: "💌", bid: null, item: null, mid: null, pts: 0, at: Date.now() - DAY / 2, by: "u1" }
  ];
  const p = await open(seed([kid("k1", "Liam", 6)], earns("k1", 3).concat(notes)));
  const startBytes = await db(p, () => window.__DB.log.filter((l) => l.table === "awards" && l.op === "select").reduce((n, l) => n + l.bytes, 0));
  check("opening the app doesn't download voice recordings", startBytes < 20000, `${startBytes} bytes`);
  const cache = await p.evaluate(() => localStorage.getItem("hd.cache.f1") || "");
  check("the on-device copy has no recordings in it", cache.length > 0 && !cache.includes("data:audio"), `${cache.length} chars`);
  await parents(p);
  await p.click('.kidcard[data-kid="k1"]'); await p.waitForTimeout(800);
  const fetched = await db(p, () => window.__DB.log.filter((l) => l.table === "awards" && l.filters.some((f) => f.startsWith("id in"))).length);
  check("a child's page loads their voice notes in the background", fetched === 1, `queries ${fetched}`);
  // A new note from another phone arrives live: it should be slimmed too.
  await p.evaluate((a) => { const n = { id: "n3", family_id: "f1", kid: "k1", kind: "note", label: "Love you!", icon: "💌", bid: null, item: a, mid: null, pts: 0, at: Date.now(), by: "u2" }; window.__DB.awards.push(n); window.__emit("awards", "INSERT", n); }, audio);
  await p.waitForTimeout(600);
  const cache2 = await p.evaluate(() => localStorage.getItem("hd.cache.f1") || "");
  check("a live note doesn't put its recording in the on-device copy", cache2.includes("Love you!") && !cache2.includes("data:audio"));
  await done(p, "Voice notes");
}

async function testTrendAndLevels() {
  const hist = [];
  for (let w = 0; w < 8; w++) hist.push(...earns("k1", 2 + w, { from: Date.now() - (7 * (7 - w) + 1) * DAY, step: 3600e3, label: "Calm body", bid: "calm" }).map((a, i) => Object.assign(a, { id: `t${w}-${i}` })));
  const p = await open(seed([kid("k1", "Liam", 6)], hist.concat(earns("k1", 720, { from: Date.now() - 200 * DAY, step: 6000e3 }))));
  await parents(p);
  await p.click('.kidcard[data-kid="k1"]'); await p.waitForTimeout(500);
  const hero = await p.$eval(".hero", (e) => e.innerText);
  check("levels go beyond 6 (760+ Dojos = level 7)", /Level 7/.test(hero), hero.replace(/\s+/g, " ").slice(0, 120));
  await p.click('[data-tab="week"]'); await p.waitForTimeout(300);
  check("Week page shows the 8-week trend", await p.$(".trend .trow"));
  check("Calm body is trending up", await p.$eval(".trend", (e) => /Calm body/.test(e.innerText)) && (await p.$$(".tdir.up")).length >= 1);
  await p.click('[data-tab="trophies"]'); await p.waitForTimeout(300);
  check("Trophies list the new level medals", /Level 11 monster/.test(await text(p)));
  await done(p, "Trend and levels");
}

async function testEveryScreen() {
  const k1 = kid("k1", "Liam", 6), k2 = kid("k2", "Aaron", 2);
  const p = await open(seed([k1, k2], earns("k1", 40).concat(earns("k2", 8))));
  await parents(p);
  const words = [];
  for (const k of ["k1", "k2"]) {
    await p.click(`.kidcard[data-kid="${k}"]`); await p.waitForTimeout(400);
    if (await p.$("#toddlerView")) { /* toddler view is the default for under 4s; open the full profile */ }
    const tabs = await p.$$eval("[data-tab]", (b) => b.map((x) => x.dataset.tab));
    for (const t of tabs) {
      await p.click(`[data-tab="${t}"]`); await p.waitForTimeout(250);
      if (t === "monster") for (const s of ["house", "island", "wardrobe", "make"]) { const b = await p.$(`[data-sub="${s}"]`); if (b) { await b.click(); await p.waitForTimeout(200); } }
      if (t !== "games") words.push(await p.$eval("#view", (e) => e.innerText));
    }
    await p.click("#backBtn").catch(() => {}); await p.waitForTimeout(300);
  }
  const all = words.join("\n");
  check("no screen says \"points\" for Dojos", !/\bpoints?\b/i.test(all), (all.match(/.{0,40}\bpoints?\b.{0,40}/i) || [""])[0]);
  check("no screen says \"Mark given\"", !/Mark given/.test(all));
  await done(p, "Every screen");
}

async function testReducedMotion() {
  const p = await open(seed([kid("k1", "Liam", 6)], earns("k1", 24)), { reduced: true });
  await parents(p);
  await p.click('[data-qbeh="k1|listen"]'); await p.waitForTimeout(3000);
  const vis = await p.$eval(".rs-name", (e) => getComputedStyle(e).opacity);
  check("reduced motion: the show still appears and is readable", vis === "1", `opacity ${vis}`);
  await done(p, "Reduced motion");
}

async function testOffline() {
  // The real files with the service worker on; the real database is blocked so nothing leaves this machine.
  const ctx = await browser.newContext({ viewport: { width: 400, height: 820 } });
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "index.html");
  await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500);
  const keys = await p.evaluate(() => caches.keys());
  check("service worker caches this version", keys.includes(VERSION), keys.join(","));
  const files = await p.evaluate(async (v) => (await (await caches.open(v)).keys()).length, VERSION);
  check("all app files are cached for offline use", files >= 20, `${files} files`);
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(1200);
  const body = await p.$eval("#view", (e) => e.innerText);
  check("app opens with no internet", body.length > 0 && !/This site can.t be reached/.test(body), body.slice(0, 80));
  check("offline: no script errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  browser = await pw.chromium.launch();
  const tests = [testParentsHome, testRewardShow, testRewardReplay, testKidsPlay, testSettingsKeepsYard, testVoiceNotes, testTrendAndLevels, testEveryScreen, testReducedMotion, testOffline];
  for (const t of tests) { try { await t(); } catch (e) { check(`${t.name} finished`, false, e.message.split("\n")[0]); } }
  await browser.close(); server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
