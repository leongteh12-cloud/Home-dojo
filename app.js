/* Home Dojo: app logic. Data lives in Supabase (shared by the family) with an
   on-device copy and a queue of unsent changes, so the app keeps working offline. */
(function () {
"use strict";

const { star, LIB, BONUS, SHOP, SLOTS, LEVELS, COLORS, SHAPES, TOPS, SPECIES, MOUTHS, monsterSvg, shade, trophySvg, medalSvg, badgeSvg, HOUSE, FURNI, houseTier, houseSvg, houseOutsideSvg, petSvg, PET_IDS, PRICE_TIERS, priceTier, furniCloseup } = window.HD;
const pendingCfg = () => S.outbox.some((o) => o.op === "saveConfig" || o.op === "equip" || o.op === "monster" || o.op === "family");
const CONF = window.HOME_DOJO_CONFIG || {};
// A host page (such as the claude.ai version) can supply its own storage: { start, saveCfg, add, remove }.
let HOST = window.HD_HOST || null;
const sb = (CONF.supabaseUrl && CONF.supabaseAnonKey && window.supabase)
  ? window.supabase.createClient(CONF.supabaseUrl, CONF.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

/* ---------- state ---------- */
const S = {
  phase: "boot",            // boot | nosetup | signin | nofamily | app
  mode: "cloud",            // cloud | local (try-it-out on one device)
  user: null, family: null, role: "carer", members: [],
  cfg: null, cfgLoaded: false, awards: [],
  route: { name: "home" }, draft: null, lastHtml: "", lastRoute: null,
  outbox: [], online: navigator.onLine, channel: null, authTab: new URLSearchParams(location.search).get("invite") ? "signup" : "signin", recovery: false,
  view: lget("hd.view", "menu") === "kids" ? "kids" : "menu"   // menu | kids | parents (see "home menu" below)
};
const $ = (s, el) => (el || document).querySelector(s);
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clone = (o) => JSON.parse(JSON.stringify(o));
const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const kidsMode = () => S.view === "kids";
const isAdmin = () => !kidsMode() && (S.mode === "local" || S.role === "admin");
// Admin mode: a parent turns it on (behind the PIN) to edit anything: an Admin tab on each child gives or takes away
// items, eggs, game tries and high scores, and any game can be tried. Admin games don't count towards limits or high scores.
// It lasts until turned off or the app is closed.
const adminPlay = () => isAdmin() && !!S.adminPlay;
function lget(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function ldel(k) { try { localStorage.removeItem(k); } catch (e) {} }

const params = new URLSearchParams(location.search);
// An invite link carries the code plus who sent it and the family name, just for a friendly welcome.
// It's remembered on this device so it survives the trip out to the confirmation email and back.
const INVITE = (() => {
  const code = (params.get("invite") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  if (code) { const v = { code, from: (params.get("from") || "").slice(0, 40), fam: (params.get("fam") || "").slice(0, 60) }; lset("hd.invite", v); return v; }
  return lget("hd.invite", null) || { code: "", from: "", fam: "" };
})();
const inviteFromLink = INVITE.code;
const inviteQuery = () => inviteFromLink ? "?" + new URLSearchParams({ invite: inviteFromLink, from: INVITE.from, fam: INVITE.fam }).toString() : "";

/* ---------- boot ---------- */
async function boot() {
  render();
  registerSW();
  window.addEventListener("online", () => { S.online = true; flush(); syncDot(); });
  window.addEventListener("offline", () => { S.online = false; syncDot(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.phase === "app" && S.mode === "cloud") { flush(); refreshAll(); } });

  if (HOST) return startHost();
  if (lget("hd.localMode", false)) return startLocal();
  if (!sb) { S.phase = "nosetup"; return render(); }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { S.recovery = true; showNewPassword(); }
    if (event === "SIGNED_OUT") { teardown(); S.user = null; S.phase = "signin"; render(); }
  });
  const { data } = await sb.auth.getSession();
  if (!data.session) { S.phase = "signin"; return render(); }
  await afterSignIn(data.session.user);
}

async function afterSignIn(user) {
  S.user = user;
  // Show the last known state straight away (works offline), then refresh.
  const lastFam = lget("hd.family." + user.id, null);
  if (lastFam) { loadCache(lastFam.id); S.family = lastFam; S.role = lastFam.role || "carer"; S.phase = "app"; render(); }
  let rows = null;
  try {
    const r = await sb.from("members").select("family_id, role, display_name, families(name)").eq("user_id", user.id);
    if (r.error) throw r.error; rows = r.data;
  } catch (e) {
    if (lastFam) { S.outbox = lget("hd.outbox." + lastFam.id, []); syncDot(); return; }
    S.phase = "nofamily"; render(); toast("Couldn't reach the server. Check your connection."); return;
  }
  if (!rows.length) {
    // Came from an invite link: join straight away, no extra form.
    const name = (user.user_metadata && user.user_metadata.name) || "";
    if (inviteFromLink && name && !S.autoJoinTried) {
      S.autoJoinTried = true;
      const j = await sb.rpc("join_family", { p_code: inviteFromLink, p_display: name });
      if (!j.error) { history.replaceState(null, "", location.pathname); ldel("hd.invite"); await afterSignIn(user); return welcomeJoined(); }
      toast("That invite didn't work: " + j.error.message);
    }
    S.phase = "nofamily"; S.family = null; return render();
  }
  const pick = rows.find((r) => lastFam && r.family_id === lastFam.id) || rows[0];
  await openFamily({ id: pick.family_id, name: (pick.families && pick.families.name) || "Our family", role: pick.role });
}

async function openFamily(f) {
  teardown();
  S.family = { id: f.id, name: f.name }; S.role = f.role;
  lset("hd.family." + S.user.id, { id: f.id, name: f.name, role: f.role });
  loadCache(f.id);
  S.outbox = lget("hd.outbox." + f.id, []);
  S.phase = "app"; S.mode = "cloud"; render();
  subscribe();
  await refreshAll();
  flush();
}

function teardown() {
  if (S.channel && sb) { try { sb.removeChannel(S.channel); } catch (e) {} }
  S.channel = null;
}

function loadCache(fid) {
  const c = lget("hd.cache." + fid, null);
  if (c) { S.cfg = c.cfg; S.awards = c.awards || []; S.members = c.members || []; S.cfgLoaded = true; }
  else { S.cfg = null; S.awards = []; S.members = []; S.cfgLoaded = false; }
}
let cacheTimer = null;
function saveCache() {
  if (S.mode !== "cloud" || !S.family) return;
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => lset("hd.cache." + S.family.id, { cfg: S.cfg, awards: S.awards, members: S.members }), 300);
}

async function refreshAll() {
  if (!S.family || S.mode !== "cloud") return;
  const fid = S.family.id;
  try {
    const [c, m] = await Promise.all([
      sb.from("family_config").select("config").eq("family_id", fid).maybeSingle(),
      sb.from("members").select("user_id, role, display_name").eq("family_id", fid)
    ]);
    if (c.error) throw c.error;
    const all = []; let from = 0;
    for (;;) {
      const r = await sb.from("awards").select("id, kid, kind, label, icon, bid, item, mid, pts, at, by").eq("family_id", fid).order("at", { ascending: true }).range(from, from + 999);
      if (r.error) throw r.error;
      all.push(...r.data); if (r.data.length < 1000) break; from += 1000;
    }
    // Keep anything still waiting to be sent.
    const pending = S.outbox.filter((o) => o.op === "insertAward").map((o) => o.rec);
    const ids = new Set(all.map((a) => a.id));
    const deleting = new Set(S.outbox.filter((o) => o.op === "deleteAward").map((o) => o.id));
    S.awards = all.concat(pending.filter((p) => !ids.has(p.id))).filter((a) => !deleting.has(a.id)).sort((a, b) => a.at - b.at);
    if (!pendingCfg()) S.cfg = c.data ? c.data.config : null;
    S.members = m.data || [];
    const me = S.members.find((x) => x.user_id === S.user.id);
    if (me && me.role !== S.role) { S.role = me.role; lset("hd.family." + S.user.id, { id: fid, name: S.family.name, role: me.role }); }
    if (!me && S.members.length) { // removed from the family
      ldel("hd.family." + S.user.id); S.family = null; S.phase = "nofamily"; render(); return;
    }
    S.cfgLoaded = true; saveCache(); render();
  } catch (e) { syncDot(); }
}

function subscribe() {
  const fid = S.family.id;
  S.channel = sb.channel("family-" + fid)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "awards", filter: "family_id=eq." + fid }, (p) => {
      const a = p.new; if (S.awards.some((x) => x.id === a.id)) return;
      S.awards = S.awards.concat([a]).sort((x, y) => x.at - y.at); saveCache(); render();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "awards" }, (p) => {
      const o = p.old || {}; if (o.family_id && o.family_id !== fid) return;
      if (!S.awards.some((x) => x.id === o.id)) return;
      S.awards = S.awards.filter((x) => x.id !== o.id); saveCache(); render();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "family_config", filter: "family_id=eq." + fid }, (p) => {
      if (!p.new || !p.new.config) return;
      if (pendingCfg()) return;
      S.cfg = p.new.config; S.cfgLoaded = true; saveCache(); render();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: "family_id=eq." + fid }, () => refreshAll())
    .subscribe((status) => { if (status === "SUBSCRIBED") { S.live = true; syncDot(); } else if (status === "CLOSED" || status === "CHANNEL_ERROR") { S.live = false; syncDot(); } });
}

/* ---------- writes: apply locally, queue, send ---------- */
function queue(op) {
  if (S.mode === "local") return;
  if (op.op === "saveConfig") S.outbox = S.outbox.filter((o) => o.op !== "saveConfig" && o.op !== "equip" && o.op !== "monster" && o.op !== "family");
  if (op.op === "family") S.outbox = S.outbox.filter((o) => o.op !== "family");
  if (op.op === "monster") {
    const prev = S.outbox.find((o) => o.op === "monster" && o.kid === op.kid);
    if (prev) { Object.assign(prev.patch, op.patch); lset("hd.outbox." + S.family.id, S.outbox); syncDot(); flush(); return; }
  }
  S.outbox.push(op); lset("hd.outbox." + S.family.id, S.outbox); syncDot(); flush();
}
let flushing = false;
async function flush() {
  if (flushing || S.mode !== "cloud" || !S.family || !S.outbox.length) return;
  flushing = true;
  const fid = S.family.id;
  try {
    while (S.outbox.length) {
      const op = S.outbox[0]; let res;
      if (op.op === "insertAward") res = await sb.from("awards").insert(Object.assign({ family_id: fid }, op.rec));
      else if (op.op === "deleteAward") res = await sb.from("awards").delete().eq("family_id", fid).eq("id", op.id);
      else if (op.op === "saveConfig") res = await sb.from("family_config").upsert({ family_id: fid, config: op.cfg, updated_at: new Date().toISOString() });
      else if (op.op === "equip") res = await sb.rpc("set_monster", { p_family: fid, p_kid: op.kid, p_patch: { equip: op.equip } });
      else if (op.op === "monster") res = await sb.rpc("set_monster", { p_family: fid, p_kid: op.kid, p_patch: op.patch });
      else if (op.op === "family") res = await sb.rpc("set_family_island", { p_family: fid, p_island: op.island });
      const err = res && res.error;
      if (err && err.code !== "23505") {
        if (isNetworkError(err)) break;                 // try again later
        toast(op.op === "insertAward" ? "That change wasn't allowed, so it was undone." : "Couldn't save a change: " + (err.message || "unknown error"));
        if (op.op === "insertAward") S.awards = S.awards.filter((a) => a.id !== op.rec.id);
      }
      S.outbox.shift(); lset("hd.outbox." + fid, S.outbox);
    }
  } catch (e) { /* offline */ }
  flushing = false; syncDot(); saveCache(); render();
}
function isNetworkError(err) { return !navigator.onLine || /fetch|network|timeout|Failed|Load failed/i.test((err && (err.message || err.details)) || ""); }
setInterval(() => { if (S.outbox.length) flush(); }, 20000);

function syncDot() {
  const d = $("#syncDot");
  if (S.phase !== "app" || S.mode !== "cloud") { d.hidden = true; return; }
  const pending = S.outbox.length;
  d.hidden = false;
  d.className = "sync" + (!pending && S.online ? " ok" : "");
  d.title = pending ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync` : S.online ? "All changes saved" : "Offline";
  d.setAttribute("aria-label", d.title);
}

async function saveCfg(cfg) {
  S.cfg = clone(cfg);
  if (S.mode === "local") localCfg(S.cfg); else { queue({ op: "saveConfig", cfg: S.cfg }); saveCache(); }
  render();
}
function addRecord(rec) {
  rec = Object.assign({ id: uid(), by: S.user ? S.user.id : null }, rec);
  S.awards = S.awards.concat([rec]);
  if (S.mode === "local") { if (HOST) HOST.add(rec); else lset("hd.local.awards", S.awards); } else { queue({ op: "insertAward", rec }); saveCache(); }
  render();
  return rec.id;
}
function removeRecord(id) {
  const rec = S.awards.find((a) => a.id === id);
  const queuedInsert = S.outbox.findIndex((o) => o.op === "insertAward" && o.rec.id === id);
  S.awards = S.awards.filter((a) => a.id !== id);
  if (S.mode === "local") { if (HOST) HOST.remove(id); else lset("hd.local.awards", S.awards); }
  else if (queuedInsert >= 0) { S.outbox.splice(queuedInsert, 1); lset("hd.outbox." + S.family.id, S.outbox); syncDot(); saveCache(); }
  else { queue({ op: "deleteAward", id }); saveCache(); }
  render();
  if (rec && rec.kind === "buy" && rec.item) {
    const kid = kidById(rec.kid);
    if (kid && Object.values(kid.equip || {}).includes(rec.item)) setMonster(kid, { equip: wornBy(kid) });
  }
}
function canDelete(a) {
  if (kidsMode()) return false;
  if (isAdmin()) return true;
  return S.user && a.by === S.user.id && Date.now() - a.at < 14 * 60 * 1000;
}

/* ---------- local try-it-out mode ---------- */
function startLocal() {
  S.mode = "local"; S.phase = "app"; S.role = "admin";
  S.cfg = lget("hd.local.cfg", null); S.awards = lget("hd.local.awards", []); S.cfgLoaded = true; render();
}
function localCfg(cfg) { if (HOST) HOST.saveCfg(cfg); else lset("hd.local.cfg", cfg); }
function startHost() {
  S.mode = "local"; S.phase = "app"; S.role = "admin"; render();
  HOST.start({
    cfg: (cfg) => { S.cfg = cfg; S.cfgLoaded = true; render(); },
    awards: (list) => { S.awards = list.slice().sort((a, b) => a.at - b.at); render(); },
    fail: () => { HOST = null; toast("Couldn't reach the shared save, so points are saved on this device."); startLocal(); }
  });
}

/* ---------- derived numbers ---------- */
function stats(kidId) {
  let earned = 0, spent = 0; const owned = new Set(), given = new Set();
  for (const a of S.awards) {
    if (a.kid !== kidId) continue;
    if (a.kind === "earn") earned += a.pts || 0;
    else if (a.kind === "buy") { spent += a.pts || 0; if (a.item) owned.add(a.item); }
    else if (a.kind === "spend") spent += a.pts || 0;
    else if (a.kind === "given") given.add(a.mid);
  }
  let level = 1; for (let i = 0; i < LEVELS.length; i++) if (earned >= LEVELS[i]) level = i + 1;
  const next = LEVELS[level] != null ? LEVELS[level] : null, prev = LEVELS[level - 1];
  return { earned, spent, balance: earned - spent, owned, given, level, next, prev };
}
const kidById = (id) => (S.cfg && S.cfg.kids || []).find((k) => k.id === id);
const milestonesOf = (kid) => (kid.milestones || []).slice().sort((a, b) => a.at - b.at);
// Two kinds of points: "Dojos" (every point ever earned; levels, goals, trophies) and "Dojo $" (what's left to spend).
const coin = (n) => `<span class="coin" aria-hidden="true">$</span><span class="price">${n}</span>`;
function wallet(st, small) {
  return `<div class="wallet${small ? " small" : ""}">
    <div class="pot total" aria-label="${st.earned} Dojos earned"><span class="dstar" aria-hidden="true">★</span><div><b>${st.earned}</b><small>Dojos${small ? "" : " earned"}</small></div></div>
    <div class="pot money" aria-label="${st.balance} Dojo dollars to spend"><span class="coin big" aria-hidden="true">$</span><div><b>${st.balance}</b><small>Dojo $${small ? "" : " to spend"}</small></div></div></div>`;
}
// What a monster is wearing, leaving out anything no longer owned (e.g. a purchase that was removed).
function wornBy(kid) {
  const e = kid.equip || {}, owned = stats(kid.id).owned, out = {};
  Object.keys(e).forEach((slot) => { if (e[slot] && owned.has(e[slot])) out[slot] = e[slot]; });
  return out;
}
const SEC_IC = { Pets: "🐾", Hats: "🎩", Accessories: "🕶️", Skins: "✨", Backgrounds: "🖼️", "Reward trophies": "🏆", "Monster medals": "🥇", "Skill badges": "🎖️", "Collector badges": "💎" };
const secTitle = (t) => (SEC_IC[t] ? `<span aria-hidden="true">${SEC_IC[t]}</span> ` : "") + t;
const memberName = (id) => { const m = S.members.find((x) => x.user_id === id); return m ? (m.display_name || "Someone") : ""; };

/* ---------- sound ---------- */
let actx = null, master = null;
function audio() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  if (!master) {
    // A compressor lets the chime be loud without crackling on phone speakers.
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = actx.createGain(); master.gain.value = 1.6;
    master.connect(comp); comp.connect(actx.destination);
  }
  return actx;
}
function soundOn() { return S.cfg && S.cfg.sound !== false && !lget("hd.mute", false); }
// notes: [frequency, length, start, kind]; kind "bell" (default) rings with overtones, "pluck" is short and bright.
function beep(notes, vol, dest) {
  if (!soundOn()) return;
  try {
    const ac = audio(), now = ac.currentTime, v = vol || 0.5;
    notes.forEach(([f, d, at, kind]) => {
      const parts = kind === "pluck" ? [[1, "triangle", 1], [2, "sine", .35]] : [[1, "triangle", 1], [2, "sine", .5], [3, "sine", .22], [4.2, "sine", .12]];
      parts.forEach(([m, type, amp]) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = now + at, len = d * (m > 1 ? .7 : 1);
        o.type = type; o.frequency.value = f * m;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + len + 0.05);
      });
    });
  } catch (e) {}
}
function whoosh(at, len, vol) {
  if (!soundOn()) return;
  try {
    const ac = audio(), t = ac.currentTime + (at || 0), n = Math.floor(ac.sampleRate * (len || .5));
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(5000, t + (len || .5));
    g.gain.setValueAtTime(vol || .35, t);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t);
  } catch (e) {}
}
const SND = {
  earn: () => { whoosh(0, .35, .3); beep([[784, .5, 0], [988, .5, .08], [1175, .5, .16], [1568, 1.1, .26], [2093, .9, .34, "pluck"], [2637, .8, .42, "pluck"]], .55); },
  buy: () => { whoosh(0, .3, .25); beep([[523, .3, 0, "pluck"], [659, .3, .07, "pluck"], [784, .3, .14, "pluck"], [1047, .4, .21, "pluck"], [1568, 1, .3]], .5); },
  goal: () => { whoosh(0, .6, .35); beep([[523, .35, 0], [659, .35, .15], [784, .35, .3], [1047, .5, .45], [784, .25, .7, "pluck"], [1047, 1.6, .85], [1319, 1.4, .85], [1568, 1.4, .85], [2093, 1, 1.0, "pluck"]], .5); }
};

/* ---------- confetti + bounce ---------- */
// One shared particle loop, so several bursts can play at once.
const FX = { parts: [], running: false };
function confetti(x, y, colors, n, opt) {
  if (reduced()) return;
  opt = opt || {};
  const spread = opt.spread || 1, power = opt.power || 1, dir = opt.dir == null ? null : opt.dir;
  for (let i = 0; i < (n || 40); i++) {
    let vx, vy;
    if (dir == null) { vx = (Math.random() - .5) * 14 * spread; vy = -(Math.random() * 12 + 4) * power; }
    else { const a = dir + (Math.random() - .5) * .7, sp = (Math.random() * 10 + 9) * power; vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; }
    FX.parts.push({ x, y, vx, vy, r: Math.random() * 7 + 6, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6, spin: (Math.random() - .5) * .5, star: Math.random() < .25, life: 110 + Math.random() * 40 });
  }
  if (FX.running) return;
  FX.running = true;
  const c = $("#fx"), ctx = c.getContext("2d"), dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    FX.parts = FX.parts.filter((p) => --p.life > 0 && p.y < innerHeight + 40);
    for (const p of FX.parts) {
      p.vy += .3; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.spin;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.c;
      if (p.star) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? p.r * .45 : p.r, an = k * Math.PI / 5; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.fill(); }
      else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (FX.parts.length) requestAnimationFrame(tick); else { ctx.clearRect(0, 0, innerWidth, innerHeight); FX.running = false; }
  })();
}
// Confetti cannons from both bottom corners plus a burst at a point.
function bigBurst(x, y, colors) {
  confetti(x, y, colors, 70, { spread: 1.3, power: 1.1 });
  confetti(0, innerHeight, colors, 55, { dir: -Math.PI / 3, power: 1.25 });
  confetti(innerWidth, innerHeight, colors, 55, { dir: -Math.PI * 2 / 3, power: 1.25 });
}
// A big "+1" that pops up in the middle of the screen.
function popText(text, color) {
  if (reduced()) return;
  const el = document.createElement("div");
  el.className = "pop"; el.textContent = text; el.style.setProperty("--pc", color || "#FFB400");
  document.body.appendChild(el);
  el.animate([{ transform: "translate(-50%, -50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%, -50%) scale(1.25)", opacity: 1, offset: .25 }, { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: .45 }, { transform: "translate(-50%, -90%) scale(1.05)", opacity: 0 }], { duration: 1300, easing: "ease-out" }).onfinish = () => el.remove();
}
function bounce(el, big) {
  if (!el || reduced() || !el.animate) return;
  if (big) return el.animate([{ transform: "translateY(0) scale(1) rotate(0)" }, { transform: "translateY(4px) scale(1.12, .86)", offset: .12 }, { transform: "translateY(-46px) scale(.92, 1.12) rotate(-8deg)", offset: .38 }, { transform: "translateY(-50px) scale(1.05) rotate(8deg)", offset: .5 }, { transform: "translateY(0) scale(1.14, .88) rotate(0)", offset: .72 }, { transform: "translateY(-10px) scale(.97, 1.04)", offset: .86 }, { transform: "translateY(0) scale(1)" }], { duration: 900, easing: "ease-out" });
  el.animate([{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-14px) scale(1.06, .96)" }, { transform: "translateY(0) scale(.97, 1.03)" }, { transform: "translateY(0) scale(1)" }], { duration: 520, easing: "ease-out" });
}

/* ---------- toast + modal ---------- */
let toastTimer = null;
function toast(msg, undo) {
  const host = $("#toastHost"); clearTimeout(toastTimer);
  host.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${undo ? '<button id="undoBtn">Undo</button>' : ""}</div>`;
  if (undo) $("#undoBtn").onclick = () => { host.innerHTML = ""; undo(); };
  toastTimer = setTimeout(() => { host.innerHTML = ""; }, undo ? 6000 : 3500);
}
function modal(html, wire) {
  const ov = $("#overlay");
  ov.innerHTML = `<div class="ov" id="ovbg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  $("#ovbg").onclick = (e) => { if (e.target.id === "ovbg") closeModal(); };
  if (wire) wire(ov);
  const f = ov.querySelector("[data-autofocus]") || ov.querySelector("button"); if (f) f.focus();
}
function closeModal() { $("#overlay").innerHTML = ""; }
function confirmBox(title, text, yes, onYes) {
  modal(`<h2>${esc(title)}</h2><p class="meta">${esc(text)}</p><div class="row" style="justify-content:center"><button class="btn ghost" id="no">Cancel</button><button class="btn primary" id="yes">${esc(yes)}</button></div>`, () => { $("#no").onclick = closeModal; $("#yes").onclick = () => { closeModal(); onYes(); }; });
}
function requirePin(then) {
  const pin = S.cfg && S.cfg.pin;
  if (!pin) return then();
  let entry = "";
  const draw = () => {
    modal(`<h2>Grown-ups only</h2><p class="meta">Enter the 4-digit parent PIN.</p><div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i < entry.length ? "f" : ""}"></i>`).join("")}</div>
      <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-k="${d}">${d}</button>`).join("")}<button data-k="x" aria-label="Cancel">✕</button><button data-k="0">0</button><button data-k="b" aria-label="Delete">⌫</button></div>`, (ov) => {
      ov.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => {
        const k = b.dataset.k;
        if (k === "x") return closeModal();
        if (k === "b") entry = entry.slice(0, -1); else entry += k;
        if (entry.length === 4) { if (entry === pin) { closeModal(); return then(); } entry = ""; toast("That PIN didn't match. Try again."); }
        draw();
      });
    });
  };
  draw();
}

/* ---------- actions ---------- */
function award(kid, b, btn) {
  if (kidsMode()) return;
  const before = stats(kid.id), wonBefore = wonIds(kid);
  SND.earn();
  const r = btn && btn.getBoundingClientRect();
  const cols = [kid.look.color, "#FFD43B", "#FF5E8A", "#3D7BFF", "#4CBF5A", "#FFFFFF", shade(kid.look.color, .4)];
  bigBurst(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2, cols);
  popText("+1", kid.look.color);
  bounce($("#heroMonster"), true);
  if (navigator.vibrate) try { navigator.vibrate([30, 40, 60]); } catch (e) {}
  const id = addRecord({ kid: kid.id, kind: "earn", label: b.label, icon: b.icon, bid: b.id, pts: 1, at: Date.now() });
  toast(`+1 ${b.label} for ${kid.name}`, () => removeRecord(id));
  const after = stats(kid.id);
  const team = teamOf();
  if (team && teamProgress(team) === team.target) setTimeout(() => celebrateTeam(team), 1300);
  if (Math.floor(after.earned / EGG_EVERY) > Math.floor(before.earned / EGG_EVERY)) setTimeout(() => toast(`🥚 A mystery egg for ${kid.name} appeared in the garden!`), 1600);
  const sk = streakOf(kid.id); if (sk.n >= 2 && !S.awards.some((a) => a.kid === kid.id && a.kind === "earn" && a.id !== id && a.at >= new Date().setHours(0, 0, 0, 0))) setTimeout(() => toast(`🔥 ${sk.n} days in a row! Streak fire is growing!`), 2200);
  const hit = milestonesOf(kid).find((m) => before.earned < m.at && after.earned >= m.at);
  const fresh = trophiesFor(kid).filter((t) => t.at && !wonBefore.has(t.id) && (t.group === "skill" || t.group === "collect"));
  if (hit) setTimeout(() => celebrateGoal(kid, hit), 500);
  else if (after.level > before.level) setTimeout(() => celebrateLevel(kid, after.level), 500);
  else if (fresh.length) setTimeout(() => celebrateBadge(kid, fresh[0]), 500);
}
function celebrateGoal(kid, m) {
  SND.goal(); bigBurst(innerWidth / 2, innerHeight / 3, ["#FFD43B", "#FF5E8A", "#3D7BFF", "#4CBF5A", "#fff", kid.look.color]); setTimeout(() => bigBurst(innerWidth / 2, innerHeight / 3, ["#FFD43B", "#FF5E8A", "#3D7BFF", kid.look.color]), 700);
  modal(`<div class="m">${monsterSvg(kid.look, wornBy(kid), stats(kid.id).level)}</div><h2>${esc(kid.name)} reached ${m.at} Dojos!</h2><p style="font-family:var(--font-display);font-size:22px;margin:0">${esc(m.icon || "🎁")} ${esc(m.label)}</p><p class="meta">You'll find this trophy in the Trophies case. A parent taps "Mark given" once they've had it.</p><button class="btn primary" data-autofocus id="ok">Hooray!</button>`, () => { $("#ok").onclick = closeModal; });
}
function celebrateLevel(kid, lvl) {
  SND.goal(); bigBurst(innerWidth / 2, innerHeight / 3, ["#FFD43B", "#FF5E8A", kid.look.color, "#fff"]);
  const what = { 2: "spots", 3: "sparkly stars", 4: "wings", 5: "a magic glow", 6: "a magic glow" }[lvl] || "";
  modal(`<div class="m">${monsterSvg(kid.look, wornBy(kid), lvl)}</div><h2>Level ${lvl}!</h2><p class="meta">${esc(kid.name)}'s monster grew ${what}.</p><button class="btn primary" data-autofocus id="ok">Brilliant!</button>`, () => { $("#ok").onclick = closeModal; });
}
function buyItem(kid, item) {
  const st = stats(kid.id);
  if (st.balance < item.cost) return;
  const preview = Object.assign({}, wornBy(kid), { [item.slot]: item.id });
  modal(`<div class="m">${monsterSvg(kid.look, preview, st.level)}</div><h2>Buy the ${esc(item.name)}?</h2><p class="meta">Costs <b>${coin(item.cost)} Dojo $</b>. ${esc(kid.name)} will have ${st.balance - item.cost} Dojo $ left. Their Dojos stay the same.</p><div class="row" style="justify-content:center"><button class="btn ghost" id="no">Not now</button><button class="btn kid" style="--kid:${esc(kid.look.color)}" id="yes" data-autofocus>Buy it</button></div>`, () => {
    $("#no").onclick = closeModal;
    $("#yes").onclick = () => {
      closeModal();
      const wonBefore = wonIds(kid);
      addRecord({ kid: kid.id, kind: "buy", item: item.id, label: item.name, icon: "🛍️", pts: item.cost, at: Date.now() });
      SND.buy(); bigBurst(innerWidth / 2, innerHeight / 3, [kid.look.color, "#FFD43B", "#FF5E8A", "#fff"]);
      equip(kidById(kid.id), item.slot, item.id);
      toast(`${kid.name} got the ${item.name}! It's in the wardrobe and the house.`);
      const fresh = trophiesFor(kidById(kid.id)).filter((t) => t.at && !wonBefore.has(t.id) && t.group === "collect");
      if (fresh.length) setTimeout(() => celebrateBadge(kid, fresh[0]), 700);
    };
  });
}
// Anyone in the family (carers too) can change a monster's look, outfit, name and trophy shelf.
function setMonster(kid, patch) {
  const cfg = clone(S.cfg), k = cfg.kids.find((x) => x.id === kid.id);
  if (!k) return;
  Object.assign(k, clone(patch));
  S.cfg = cfg;
  if (S.mode === "local") localCfg(cfg); else { queue({ op: "monster", kid: kid.id, patch: clone(patch) }); saveCache(); }
  render();
}
// The family island belongs to everyone, so carers can build on it too.
function saveFamilyIsland(island) {
  const cfg = clone(S.cfg); cfg.familyIsland = island; S.cfg = cfg;
  if (S.mode === "local") localCfg(cfg); else { queue({ op: "family", island }); saveCache(); }
  render();
}
function equip(kid, slot, itemId) {
  const e = Object.assign({}, wornBy(kid)); e[slot] = itemId || null;
  setMonster(kid, { equip: e });
}
function peekHouse(kid, tierIdx) {
  const st = stats(kid.id), h = HOUSE[tierIdx], cur = houseTier(st.owned), can = tierIdx > cur && st.balance >= h.cost;
  modal(`<div style="width:100%;max-width:360px;margin:0 auto">${houseSvg({ tier: tierIdx, owned: st.owned, look: kid.look, equip: wornBy(kid), level: st.level, shelf: shelfArt(kid) })}</div><h2>${esc(h.name)}</h2>
    <p class="meta">${tierIdx === cur ? `This is ${esc(kid.name)}'s house now.` : tierIdx < cur ? `${esc(kid.name)} has already moved up from here.` : st.balance >= h.cost ? `Costs <b>${coin(h.cost)} Dojo $</b>.` : `Costs <b>${coin(h.cost)} Dojo $</b>. ${h.cost - st.balance} more Dojo $ to go!`}</p>
    <div class="row" style="justify-content:center"><button class="btn ghost" id="no">Close</button>${can ? `<button class="btn kid" style="--kid:${esc(kid.look.color)}" id="yes">Move in</button>` : ""}</div>`, () => {
    $("#no").onclick = closeModal;
    if (can) $("#yes").onclick = () => { closeModal(); buyHouse(kid, h, "tier"); };
  });
}
function buyHouse(kid, item, kind) {
  const st = stats(kid.id); if (st.balance < item.cost) return;
  const owned = new Set(st.owned); owned.add(item.id);
  const tier = houseTier(owned);
  modal(`<div style="width:100%;max-width:360px;margin:0 auto">${houseSvg({ tier, owned, look: kid.look, equip: wornBy(kid), level: st.level, shelf: shelfArt(kid) })}</div><h2>${kind === "tier" ? "Move up to the " + esc(item.name) : "Buy the " + esc(item.name)}?</h2><p class="meta">Costs <b>${coin(item.cost)} Dojo $</b>. ${esc(kid.name)} will have ${st.balance - item.cost} Dojo $ left. Their Dojos stay the same.</p><div class="row" style="justify-content:center"><button class="btn ghost" id="no">Not now</button><button class="btn kid" style="--kid:${esc(kid.look.color)}" id="yes" data-autofocus>Buy it</button></div>`, () => {
    $("#no").onclick = closeModal;
    $("#yes").onclick = () => {
      closeModal();
      addRecord({ kid: kid.id, kind: "buy", item: item.id, label: item.name, icon: kind === "tier" ? "🏠" : "🛋️", pts: item.cost, at: Date.now() });
      SND.buy(); bigBurst(innerWidth / 2, innerHeight / 3, [kid.look.color, "#FFD43B", "#FF5E8A", "#fff"]);
      toast(kind === "tier" ? `Welcome to the ${item.name}!` : `The ${item.name} is in the house!`);
    };
  });
}
function buyTreat(kid, t) {
  const st = stats(kid.id);
  if (st.balance < t.cost) return;
  if (!isAdmin()) return toast("Ask a parent to spend Dojo $ on treats.");
  requirePin(() => modal(`<div style="font-size:56px">${esc(t.icon || "🎁")}</div><h2>${esc(t.label)}</h2><p class="meta">Spend <b>${coin(t.cost)} Dojo $</b> of ${esc(kid.name)}'s ${st.balance}?</p><div class="row" style="justify-content:center"><button class="btn ghost" id="no">Not now</button><button class="btn kid" style="--kid:${esc(kid.look.color)}" id="yes" data-autofocus>Spend points</button></div>`, () => {
    $("#no").onclick = closeModal;
    $("#yes").onclick = () => {
      closeModal();
      const id = addRecord({ kid: kid.id, kind: "spend", label: t.label, icon: t.icon || "🎁", pts: t.cost, at: Date.now() });
      SND.buy(); toast(`Enjoy: ${t.label}!`, () => removeRecord(id));
    };
  }));
}
function markGiven(kid, m) {
  if (!isAdmin()) return toast("A parent can mark this as given.");
  requirePin(() => { addRecord({ kid: kid.id, kind: "given", mid: m.id, label: m.label, icon: m.icon || "🎁", pts: 0, at: Date.now() }); toast(`Marked as given: ${m.label}`); });
}

/* ---------- backup + restore ---------- */
function backupData() {
  return { app: "home-dojo", version: 1, exportedAt: new Date().toISOString(), family: { name: S.family ? S.family.name : "Our family" }, config: S.cfg, awards: S.awards.map(({ id, kid, kind, label, icon, bid, item, mid, pts, at, by }) => ({ id, kid, kind, label, icon, bid, item, mid, pts, at, by })) };
}
async function downloadBackup() {
  const data = JSON.stringify(backupData(), null, 2);
  const name = `home-dojo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([data], name, { type: "application/json" });
  lset("hd.lastBackup", Date.now());
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: "Home Dojo backup" });
      toast("Backup ready. Save it to Files, iCloud or Google Drive."); render(); return;
    }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(file), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast("Backup downloaded: " + name); render();
}
function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { return toast("That file isn't a Home Dojo backup."); }
    if (!data || !data.config || !Array.isArray(data.awards)) return toast("That file isn't a Home Dojo backup.");
    const have = new Set(S.awards.map((a) => a.id));
    const fresh = data.awards.filter((a) => a && a.id && !have.has(a.id));
    confirmBox("Restore this backup?", `It replaces your current settings (children, behaviours, shop and goals) and adds ${fresh.length} history ${fresh.length === 1 ? "entry" : "entries"}. Nothing already here is deleted.`, "Restore", async () => {
      if (S.mode === "local") {
        S.cfg = data.config; S.awards = S.awards.concat(fresh).sort((a, b) => a.at - b.at);
        if (HOST) { HOST.saveCfg(S.cfg); fresh.forEach((a) => HOST.add(a)); } else { lset("hd.local.cfg", S.cfg); lset("hd.local.awards", S.awards); }
        render(); return toast("Backup restored");
      }
      try {
        for (let i = 0; i < fresh.length; i += 500) {
          const r = await sb.rpc("import_awards", { p_family: S.family.id, p_rows: fresh.slice(i, i + 500) });
          if (r.error) throw r.error;
        }
        const c = await sb.from("family_config").upsert({ family_id: S.family.id, config: data.config, updated_at: new Date().toISOString() });
        if (c.error) throw c.error;
        S.route = { name: "home" }; S.draft = null; await refreshAll(); toast("Backup restored");
      } catch (e) { toast("Restore failed: " + (e.message || "check your connection and try again")); }
    });
  };
  reader.readAsText(file);
}
function pickBackupFile() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = () => { if (inp.files && inp.files[0]) restoreBackup(inp.files[0]); };
  inp.click();
}

/* ---------- family: invites + members ---------- */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newCode() { let s = ""; const a = new Uint32Array(8); crypto.getRandomValues(a); for (const n of a) s += CODE_CHARS[n % CODE_CHARS.length]; return s; }
async function createInvite(role) {
  const code = newCode();
  const r = await sb.from("invites").insert({ code, family_id: S.family.id, role });
  if (r.error) return toast("Couldn't create an invite: " + r.error.message);
  const me = S.members.find((m) => S.user && m.user_id === S.user.id);
  const from = (me && me.display_name) || "", fam = S.family.name || "";
  const link = location.origin + location.pathname + "?" + new URLSearchParams({ invite: code, from, fam }).toString();
  const who = role === "admin" ? "a parent" : "a carer";
  const msg = `${from ? from + " has" : "You've been"} invited you to join ${fam || "our family"} on Home Dojo Monsters 👾\n\n` +
    `1. Tap this link: ${link}\n2. Tap Create account and put in your name, email and a password.\n3. If a confirmation email arrives, tap the link in it.\n4. You'll join the family automatically.\n\n` +
    `Then add it to your home screen: on iPhone, Safari > Share > Add to Home Screen. On Android, Chrome > ⋮ > Install app.`;
  modal(`<h2>Invite ${who}</h2><p class="meta">Send them this message. The link fills everything in for them, works once and lasts 14 days.</p>
    <div class="code">${code}</div><div class="invmsg">${esc(msg).replace(/\n/g, "<br>")}</div>
    <div class="row" style="justify-content:center">${navigator.share ? '<button class="btn primary" id="sh">Share…</button>' : ""}<button class="btn" id="cp">Copy message</button><button class="btn ghost" id="ok">Done</button></div>`, () => {
    $("#ok").onclick = closeModal;
    $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(msg); toast("Message copied. Paste it into a text or WhatsApp."); } catch (e) { toast("Copy didn't work. Press and hold the message to copy it."); } };
    const sh = $("#sh"); if (sh) sh.onclick = async () => { try { await navigator.share({ title: "Join our Home Dojo", text: msg }); } catch (e) {} };
  });
}
// First thing a new parent or carer sees after joining: a hello, how to install, and what they can do.
function welcomeJoined() {
  const parent = S.role === "admin";
  modal(`<div style="font-size:44px;line-height:1">🎉</div><h2>Welcome to ${esc(S.family ? S.family.name : "the family")}!</h2>
    ${installHelp() ? `<div style="text-align:left">${installHelp()}</div>` : ""}
    <ul class="welcome-list"><li>Tap <b>Parents</b> to give Dojos when you see great behaviour.</li>${parent ? "<li>Settings has the children's behaviours, rewards and invites.</li>" : "<li>A parent looks after rewards and settings.</li>"}<li>Everything you do shows up on everyone's phones straight away.</li></ul>
    <button class="btn primary" id="welOk">Let's go!</button>`, () => {
    $("#welOk").onclick = closeModal;
    const ib = $("#installBtn"); if (ib) ib.onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall = null; closeModal(); };
  });
}
async function removeMember(m) {
  confirmBox(`Remove ${m.display_name || "this person"}?`, "They'll lose access straight away. Their points stay in the history.", "Remove", async () => {
    const r = await sb.from("members").delete().eq("family_id", S.family.id).eq("user_id", m.user_id);
    if (r.error) return toast("Couldn't remove them: " + r.error.message);
    refreshAll(); toast("Removed");
  });
}
async function setMyName(name) {
  if (S.mode !== "cloud") return;
  await sb.from("members").update({ display_name: name }).eq("family_id", S.family.id).eq("user_id", S.user.id);
}

/* ---------- install help ---------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; render(); });
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
function installHelp() {
  if (HOST || isStandalone()) return "";
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (deferredInstall) return `<div class="note row" style="justify-content:space-between"><span>Put Home Dojo on your home screen.</span><button class="btn small primary" id="installBtn">Install</button></div>`;
  if (ios) return `<div class="note">To install on this iPhone or iPad: open this page in <b>Safari</b>, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.</div>`;
  return `<div class="note">To install: open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.</div>`;
}

/* ---------- lobby: the monsters hang out on the lawn ---------- */
// Scene coordinates are 400 x 300; the lawn where monsters walk runs from y 185 to 285.
const LOBBY = { st: {}, root: null, raf: 0, last: 0, sel: null };
const LAWN = { x0: 26, x1: 374, y0: 188, y1: 284 };
const rnd = (a, b) => a + Math.random() * (b - a);
function lobbyActors() {
  const out = [];
  (S.cfg.kids || []).forEach((k) => {
    const st = stats(k.id);
    out.push({ id: "k:" + k.id, kid: k, type: "monster", level: st.level });
    PET_IDS.filter((p) => st.owned.has(p) && p !== (wornBy(k)).pet).forEach((p) => out.push({ id: "p:" + k.id + ":" + p, kid: k, type: "pet", pet: p }));
  });
  return out;
}
function viewLobby() {
  const kids = S.cfg.kids || [], n = kids.length, slot = 400 / Math.max(n, 1), hw = Math.min(140, slot * 0.82);
  let s = `<svg viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD3FF"/><stop offset="1" stop-color="#E4F6FF"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#lbSky)"/><g data-egg="sun" style="cursor:pointer"><circle cx="352" cy="40" r="30" fill="#FFE98A" opacity=".5"/><circle cx="352" cy="40" r="20" fill="#FFD43B"/></g>
    ${[[40, 42, 1], [210, 26, .8], [300, 70, .7]].map(([x, y, k], i) => `<g class="cloud" data-egg="cloud" style="animation-delay:${-i * 13}s;cursor:pointer"><g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="0" rx="26" ry="12" fill="#fff"/><ellipse cx="18" cy="-6" rx="16" ry="12" fill="#fff"/><ellipse cx="-14" cy="-4" rx="12" ry="9" fill="#fff"/></g></g>`).join("")}
    <path d="M0 132 Q60 98 130 124 Q200 92 270 120 Q340 96 400 122 V160 H0Z" fill="#A9DC8A"/>
    <path d="M0 150 H400 V300 H0Z" fill="#7CC95A"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="0" y="${168 + i * 17}" width="400" height="8.5" fill="#8BD46A" opacity=".55"/>`).join("")}
    <g stroke="#E9D6B4" stroke-width="3">${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 20 + 4} 152 V136"/>`).join("")}<path d="M0 141 H400 M0 148 H400"/></g>`;
  kids.forEach((k, i) => {
    const st = stats(k.id), cx = slot * (i + 0.5), sc = hw / 120;
    s += `<path d="M${cx - 8} 158 L${cx - 16} 300 H${cx + 16} L${cx + 8} 158Z" fill="#E8D3A8" opacity=".75"/><g data-visit="${esc(k.id)}" style="cursor:pointer">
      <g transform="translate(${cx - hw / 2} ${158 - 110 * sc}) scale(${sc})">${houseOutsideSvg(houseTier(st.owned), k.look.color)}</g>
      <g transform="translate(${cx + hw / 2 - 8} 146)"><rect x="-2" y="0" width="4" height="16" fill="#8D6E63"/><rect x="-22" y="-12" width="44" height="15" rx="4" fill="#FFF8E7" stroke="#8D6E63" stroke-width="2"/><text x="0" y="-1.5" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="10" fill="#5B4636">${esc(k.name.slice(0, 8))}</text></g></g>`;
  });
  const fl = [[30, 200], [372, 214], [120, 292], [260, 196], [338, 280], [70, 262], [200, 276]];
  // Decorations sit on top of the sky but must never block taps on the sun, clouds or houses.
  s += `<g pointer-events="none">${seasonDecor(seasonNow(), kids, kids.some((k) => isBirthday(k))) + birthdayDecor(kids, slot)}</g>`;
  s += fl.map(([x, y], i) => `<g data-egg="flower" style="cursor:pointer" transform="translate(${x} ${y})"><path d="M0 0 V-8" stroke="#3E8E41" stroke-width="2"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${Math.cos(a * Math.PI / 180) * 3.5}" cy="${-10 + Math.sin(a * Math.PI / 180) * 3.5}" r="3" fill="${["#FF5E8A", "#FFD43B", "#fff", "#C77DFF"][i % 4]}"/>`).join("")}<circle cy="-10" r="2.2" fill="#FFB400"/></g>`).join("");
  s += `</svg>`;
  return `<section class="lobby${LOBBY.night ? " night" : ""} season-${seasonNow() || "none"}" id="lobby" aria-label="The monsters' garden">${s}<div class="nightsky" aria-hidden="true"><span class="moon"></span>${Array.from({ length: 8 }, (_, i) => `<i class="fly" style="left:${8 + i * 11}%;top:${50 + (i * 37) % 40}%;animation-delay:${i * .6}s"></i>`).join("")}</div><div class="lobby-layer" id="lobbyLayer"></div><button class="bedbtn" id="bedtime" aria-label="Bedtime">🌙</button>${isl() ? `<button class="dockbtn" id="toIslands" aria-label="Sail to Monster Islands">⛵ Islands${(S.cfg.kids || []).concat([{ id: "family" }]).some((k) => isl().hasNew(k.id)) ? `<span class="isl-new" aria-hidden="true">🎁</span>` : ""}</button>` : ""}</section>
    <p class="meta lobby-hint">Tap a monster to play, then tap the grass to send it there, or tap another monster for a high five or hug. Tap a house to visit, or sail to the islands. Psst… try tapping the sun and the clouds.</p>`;
}
function mountLobby() {
  const root = $("#lobbyLayer"); if (!root) return;
  LOBBY.root = root;
  const actors = lobbyActors(), keep = new Set(actors.map((a) => a.id));
  Object.keys(LOBBY.st).forEach((id) => { if (!keep.has(id)) delete LOBBY.st[id]; });
  root.innerHTML = actors.map((a) => {
    const art = a.type === "monster" ? monsterSvg(a.kid.look, dressedFor(a.kid), a.level) : `<svg viewBox="-30 -34 60 60" aria-hidden="true">${petSvg(a.pet)}</svg>`;
    const sk = a.type === "monster" ? streakOf(a.kid.id).n : 0;
    const label = a.type === "monster" ? (a.kid.monsterName || a.kid.name) + (sk >= 2 ? ` 🔥${sk}` : "") : "";
    return `<button class="walker ${a.type}" data-w="${esc(a.id)}" style="--kid:${esc(a.kid.look.color)}" aria-label="${esc(a.type === "monster" ? "Play with " + (a.kid.monsterName || a.kid.name + "'s monster") : "Pat the " + a.pet)}"><span class="shadow"></span><span class="act"><span class="face"><span class="bob">${art}</span></span></span>${label ? `<span class="tag">${esc(label)}</span>` : ""}</button>`;
  }).join("");
  actors.forEach((a, i) => {
    if (!LOBBY.st[a.id]) {
      const x = a.type === "pet" && LOBBY.st["k:" + a.kid.id] ? LOBBY.st["k:" + a.kid.id].x + rnd(-30, 30) : 60 + (i * 97) % 280;
      LOBBY.st[a.id] = { x: Math.max(LAWN.x0, Math.min(LAWN.x1, x)), y: rnd(LAWN.y0 + 20, LAWN.y1), tx: 0, ty: 0, wait: rnd(.2, 2), busy: 0, dir: 1, walking: false };
    }
    const st = LOBBY.st[a.id]; st.actor = a; st.el = root.querySelector(`[data-w="${CSS.escape(a.id)}"]`);
    st.el.onclick = () => lobbyTap(st);
    place(st);
  });
  const lob = $("#lobby"), kidsL = S.cfg.kids || [], slotL = 400 / Math.max(kidsL.length, 1);
  kidsL.forEach((k, i) => {
    const eg = eggsOf(k); if (!eg.waiting) return;
    const b = document.createElement("button"); b.className = "egg"; b.dataset.taps = "0";
    b.setAttribute("aria-label", `${k.name}'s mystery egg. Tap three times to hatch it`); b.style.setProperty("--kid", k.look.color);
    b.style.left = ((slotL * (i + 0.5) + 34) / 4) + "%"; b.style.top = (196 / 3) + "%"; b.style.zIndex = "196";
    b.innerHTML = eggSvg(k.look.color, 0) + (eg.waiting > 1 ? `<span class="eggn">×${eg.waiting}</span>` : "") + `<span class="bubble egghint">${esc(k.name)}'s egg! Tap me</span><span class="eggname">${esc(k.name)}</span>`;
    b.onclick = (e) => {
      e.stopPropagation();
      const t = +b.dataset.taps + 1; b.dataset.taps = String(t);
      const h = b.querySelector(".egghint"); if (h) h.remove();
      if (t < 3) { b.querySelector("svg").outerHTML = eggSvg(k.look.color, t); if (!reduced()) b.animate([{ transform: "translate(-50%,-100%) rotate(0)" }, { transform: "translate(-50%,-100%) rotate(-14deg)" }, { transform: "translate(-50%,-100%) rotate(14deg)" }, { transform: "translate(-50%,-100%) rotate(0)" }], { duration: 400 }); beep([[880 + t * 220, .08, 0, "pluck"]], .45); return; }
      b.remove(); openEgg(k);
    };
    root.appendChild(b);
  });
  $("#bedtime").onclick = (e) => { e.stopPropagation(); openBedtime(); };
  const ti = $("#toIslands"); if (ti) ti.onclick = (e) => { e.stopPropagation(); go({ name: "islands" }); };
  lob.onclick = (e) => {
    const sec = e.target.closest("[data-egg]"); if (sec) return lobbySecret(sec.dataset.egg, e);
    if (e.target.closest(".walker") || e.target.closest("[data-visit]")) return;
    const r = lob.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 400, y = (e.clientY - r.top) / r.height * 300;
    if (y < LAWN.y0 - 25) return;
    lobbyGo(Math.max(LAWN.x0, Math.min(LAWN.x1, x)), Math.max(LAWN.y0, Math.min(LAWN.y1, y)));
  };
  if (!LOBBY.raf && !reduced()) { LOBBY.last = performance.now(); LOBBY.raf = requestAnimationFrame(lobbyTick); }
}
let meetCount = 0;
function lobbyMeet(a, b) {
  const kind = meetCount++ % 2 ? "hug" : "five";
  const my = (a.y + b.y) / 2, mx = Math.max(LAWN.x0 + 30, Math.min(LAWN.x1 - 30, (a.x + b.x) / 2));
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  left.tx = mx - 26; right.tx = mx + 26; left.ty = right.ty = my;
  [left, right].forEach((st) => { st.meet = { kind, partner: st === left ? right : left, side: st === left ? 1 : -1 }; st.arrived = false; st.cmd = true; st.wait = 0; st.busy = 0; });
  const mk = $("#lobbyMark"); if (mk) mk.remove();
  LOBBY.sel = null;
  if (reduced()) { left.x = left.tx; left.y = my; right.x = right.tx; right.y = my; left.arrived = right.arrived = true; tryMeet(left); }
  beep([[660, .1, 0, "pluck"], [880, .14, .08, "pluck"]], .35);
  Object.values(LOBBY.st).forEach(place);
}
function tryMeet(st) {
  const m = st.meet; if (!m || !m.partner.arrived) return;
  const pair = [st, m.partner];
  pair.forEach((p) => { p.dir = p.meet.side; p.busy = 1.6; p.wait = rnd(2, 4); p.walking = false; place(p); });
  const hug = m.kind === "hug";
  pair.forEach((p) => {
    const sx = p.meet.side;
    if (!reduced()) p.el.querySelector(".act").animate(hug
      ? [{ transform: "translateX(0)" }, { transform: `translateX(${sx * 16}%) scale(1.05, .95)`, offset: .3 }, { transform: `translateX(${sx * 16}%) scale(.95, 1.05) rotate(${sx * 6}deg)`, offset: .55 }, { transform: `translateX(${sx * 16}%) scale(1.05, .95)`, offset: .75 }, { transform: "translateX(0)" }]
      : [{ transform: "translateX(0) rotate(0)" }, { transform: `translateX(${-sx * 6}%) rotate(${-sx * 10}deg)`, offset: .3 }, { transform: `translateX(${sx * 12}%) translateY(-18%) rotate(${sx * 14}deg)`, offset: .5 }, { transform: "translateX(0) rotate(0)" }], { duration: hug ? 1400 : 800, easing: "ease-in-out" });
    const b = document.createElement("span"); b.className = "bubble"; b.textContent = hug ? "Big hug!" : "High five!"; p.el.querySelector(".bubble") && p.el.querySelector(".bubble").remove();
    p.el.appendChild(b); setTimeout(() => b.remove(), 1600);
  });
  speak(hug ? "Big hug!" : "High five!", pair[0].kid || pair[0].actor.kid, true);
  if (hug) beep([[523, .3, 0], [659, .3, .12], [784, .5, .24], [1047, .8, .4]], .4);
  else { whoosh(0, .12, .5); beep([[1568, .15, .38, "pluck"], [2093, .4, .44, "pluck"]], .5); }
  if (!reduced()) {
    const lob = $("#lobby"), lr = lob.getBoundingClientRect(), r1 = st.el.getBoundingClientRect(), r2 = m.partner.el.getBoundingClientRect();
    const cx = (r1.left + r1.right + r2.left + r2.right) / 4 - lr.left, cy = Math.min(r1.top, r2.top) - lr.top + r1.height * .35;
    const icons = hug ? ["💖", "💕", "💗", "💖", "💞", "✨"] : ["✋", "⭐", "✨", "💥", "⭐"];
    icons.forEach((ic, i) => setTimeout(() => {
      const f = document.createElement("span"); f.className = "floaty"; f.textContent = ic;
      f.style.left = (cx + rnd(-20, 20)) + "px"; f.style.top = cy + "px"; if (i === 0 && !hug) f.style.fontSize = "38px";
      lob.appendChild(f);
      f.animate([{ transform: "translate(-50%, 0) scale(.4)", opacity: 1 }, { transform: `translate(calc(-50% + ${rnd(-40, 40)}px), -80px) scale(1.3)`, opacity: 0 }], { duration: 1100, easing: "ease-out" }).onfinish = () => f.remove();
    }, (hug ? 300 : 380) + i * 90));
  }
  pair.forEach((p) => { p.meet = null; p.arrived = false; });
}
// Send the picked monster (or the nearest one) to a spot on the lawn.
function lobbyGo(x, y) {
  let st = LOBBY.sel && LOBBY.st[LOBBY.sel];
  if (!st) st = Object.values(LOBBY.st).filter((s) => s.actor.type === "monster").sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  if (!st) return;
  LOBBY.sel = st.actor.id;
  st.tx = x; st.ty = y; st.wait = 0; st.busy = 0; st.cmd = true;
  if (reduced()) { st.x = x; st.y = y; }
  let mk = $("#lobbyMark");
  if (!mk) { mk = document.createElement("span"); mk.id = "lobbyMark"; mk.className = "mark"; LOBBY.root.appendChild(mk); }
  mk.style.left = (x / 4) + "%"; mk.style.top = (y / 3) + "%"; mk.style.setProperty("--kid", st.actor.kid.look.color);
  beep([[880, .08, 0, "pluck"], [1175, .12, .06, "pluck"]], .35);
  Object.values(LOBBY.st).forEach(place);
}
function place(st) {
  const el = st.el; if (!el) return;
  const depth = 0.72 + 0.4 * (st.y - LAWN.y0) / (LAWN.y1 - LAWN.y0);
  el.style.left = (st.x / 4) + "%"; el.style.top = (st.y / 3) + "%";
  el.style.transform = `translate(-50%, -100%) scale(${depth.toFixed(3)})`;
  el.style.zIndex = String(Math.round(st.y));
  el.classList.toggle("walking", st.walking);
  el.classList.toggle("selected", LOBBY.sel === st.actor.id);
  el.querySelector(".face").style.transform = st.dir < 0 ? "scaleX(-1)" : "";
}
function pickTarget(st) {
  const a = st.actor, owner = a.type === "pet" && LOBBY.st["k:" + a.kid.id];
  if (owner && Math.random() < .6) { st.tx = owner.x + rnd(-45, 45); st.ty = owner.y + rnd(-15, 15); }
  else { st.tx = rnd(LAWN.x0, LAWN.x1); st.ty = rnd(LAWN.y0, LAWN.y1); }
  st.tx = Math.max(LAWN.x0, Math.min(LAWN.x1, st.tx)); st.ty = Math.max(LAWN.y0, Math.min(LAWN.y1, st.ty));
}
function lobbyTick(t) {
  if (!LOBBY.root || !document.body.contains(LOBBY.root)) { LOBBY.raf = 0; return; }
  // Everyone is asleep while the bedtime screen is open.
  if (document.querySelector(".bedtime, .game")) { LOBBY.last = t; LOBBY.raf = requestAnimationFrame(lobbyTick); return; }
  const dt = Math.min(0.05, (t - LOBBY.last) / 1000); LOBBY.last = t;
  Object.values(LOBBY.st).forEach((st) => {
    if (!st.el) return;
    if (st.busy > 0) { st.busy -= dt; st.walking = false; }
    else if (st.wait > 0) { st.wait -= dt; st.walking = false; if (st.wait <= 0) pickTarget(st); }
    else {
      const dx = st.tx - st.x, dy = st.ty - st.y, d = Math.hypot(dx, dy), sp = (st.cmd ? 75 : st.actor.type === "pet" ? 62 : 40) * dt;
      if (d < 1.5) {
        st.walking = false; st.wait = st.cmd ? 6 : rnd(1, st.actor.type === "pet" ? 2.5 : 4);
        if (st.cmd) { st.cmd = false; const mk = $("#lobbyMark"); if (mk) mk.remove(); }
        if (st.meet) { st.arrived = true; st.wait = 8; tryMeet(st); }
      }
      else { st.walking = true; st.x += dx / d * Math.min(sp, d); st.y += dy / d * Math.min(sp, d); if (Math.abs(dx) > 1) st.dir = dx < 0 ? -1 : 1; }
    }
    place(st);
  });
  LOBBY.raf = requestAnimationFrame(lobbyTick);
}
const TRICKS = {
  peek: [[{ transform: "translateY(0)" }, { transform: "translateY(60%) scale(1, .6)", offset: .3 }, { transform: "translateY(60%) scale(1, .6)", offset: .6 }, { transform: "translateY(-25%) scale(.95, 1.1)", offset: .8 }, { transform: "translateY(0)" }], 1200, [[392, .12, 0, "pluck"], [523, .12, .7, "pluck"], [784, .12, .8, "pluck"], [1047, .25, .9, "pluck"]]],
  jump: [[{ transform: "translateY(0) scale(1)" }, { transform: "translateY(4%) scale(1.15, .85)", offset: .15 }, { transform: "translateY(-55%) scale(.9, 1.1)", offset: .45 }, { transform: "translateY(0) scale(1.12, .88)", offset: .8 }, { transform: "translateY(0) scale(1)" }], 800, [[523, .15, 0, "pluck"], [784, .15, .08, "pluck"], [1175, .3, .16, "pluck"]]],
  spin: [[{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], 700, [[660, .1, 0, "pluck"], [880, .1, .1, "pluck"], [1100, .1, .2, "pluck"], [1320, .25, .3, "pluck"]]],
  flip: [[{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(-60%) rotate(-180deg)", offset: .5 }, { transform: "translateY(0) rotate(-360deg)" }], 900, [[392, .2, 0, "pluck"], [784, .2, .2, "pluck"], [1568, .4, .45]]],
  dance: [[{ transform: "rotate(0) translateX(0)" }, { transform: "rotate(-14deg) translateX(-8%)" }, { transform: "rotate(14deg) translateX(8%)" }, { transform: "rotate(-14deg) translateX(-8%)" }, { transform: "rotate(14deg) translateX(8%)" }, { transform: "rotate(0) translateX(0)" }], 1200, [[523, .12, 0, "pluck"], [659, .12, .2, "pluck"], [523, .12, .4, "pluck"], [784, .12, .6, "pluck"], [1047, .3, .8, "pluck"]]],
  wiggle: [[{ transform: "scale(1)" }, { transform: "scale(1.2, .8)" }, { transform: "scale(.85, 1.15)" }, { transform: "scale(1.1, .9)" }, { transform: "scale(1)" }], 650, [[330, .1, 0, "pluck"], [262, .1, .1, "pluck"], [392, .2, .2, "pluck"]]]
};
const SAYS = ["Hi!", "Yay!", "Wheee!", "Hee hee!", "Boing!", "Let's play!", "High five!", "That tickles!", "Woo hoo!"];
const PET_SAYS = { hamster: "Squeak!", bunny: "Hop hop!", cat: "Meow!", puppy: "Woof!", owl: "Hoot!", babydragon: "Rawr!" };
function lobbyTap(st) {
  const a = st.actor, el = st.el, prev = LOBBY.sel && LOBBY.st[LOBBY.sel];
  // A second monster tapped soon after the first: they meet for a high five or a hug.
  if (a.type === "monster" && prev && prev !== st && prev.actor.type === "monster" && Date.now() - LOBBY.selAt < 10000 && !prev.meet && !st.meet) return lobbyMeet(prev, st);
  LOBBY.sel = a.id; LOBBY.selAt = Date.now(); Object.values(LOBBY.st).forEach(place);
  const names = Object.keys(TRICKS).filter((t) => t !== "peek"), trick = a.type === "pet" ? "jump" : isToddler(a.kid) && Math.random() < .5 ? "peek" : names[Math.floor(Math.random() * names.length)], [frames, ms, notes] = TRICKS[trick];
  st.busy = ms / 1000 + 0.6; st.walking = false;
  if (!reduced()) el.querySelector(".act").animate(frames, { duration: ms, easing: "ease-in-out" });
  beep(notes, .45);
  const say = a.type === "pet" ? PET_SAYS[a.pet] || "Hi!" : trick === "peek" ? "Peekaboo!" : (Math.random() < .25 && a.kid.monsterName ? `I'm ${a.kid.monsterName}!` : SAYS[Math.floor(Math.random() * SAYS.length)]);
  const old = el.querySelector(".bubble"); if (old) old.remove();
  const b = document.createElement("span"); b.className = "bubble"; b.textContent = say; el.appendChild(b);
  setTimeout(() => b.remove(), 1600);
  speak(say, a.type === "pet" ? "pet" : a.kid);
  if (!reduced()) {
    const lob = $("#lobby"), r = el.getBoundingClientRect(), lr = lob.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const f = document.createElement("span"); f.className = "floaty"; f.textContent = ["💖", "⭐", "✨", "💛"][i % 4];
      f.style.left = (r.left - lr.left + r.width / 2 + rnd(-24, 24)) + "px"; f.style.top = (r.top - lr.top + r.height * .3) + "px";
      lob.appendChild(f);
      f.animate([{ transform: "translateY(0) scale(.5)", opacity: 1 }, { transform: `translate(${rnd(-30, 30)}px, -70px) scale(1.2)`, opacity: 0 }], { duration: 1000 + i * 120, easing: "ease-out" }).onfinish = () => f.remove();
    }
  }
}

/* ---------- extras: eggs, stickers, streaks, talking monsters, seasons, team jar, bedtime ---------- */
const STICKERS = [["🦖", "T-rex"], ["🚀", "Rocket"], ["🦈", "Shark"], ["⚡", "Lightning"], ["🌋", "Volcano"], ["🏎️", "Race car"], ["🐉", "Dragon"], ["👾", "Space invader"], ["🤖", "Robot"], ["🦄", "Unicorn"], ["🐙", "Octopus"], ["🛸", "UFO"], ["🌈", "Rainbow"], ["🍕", "Pizza"], ["🎸", "Guitar"], ["⚽", "Football"], ["🦁", "Lion"], ["🐯", "Tiger"], ["🦊", "Fox"], ["🐸", "Frog"], ["🦕", "Dino"], ["🚒", "Fire truck"], ["🚂", "Train"], ["🌟", "Superstar"]];
const RARE = [["#39FF14", "Neon green"], ["#00B3FF", "Electric blue"], ["#FF3B1F", "Lava red"], ["#5B2BD9", "Galaxy purple"], ["#FFC400", "Pure gold"]];
const EGG_EVERY = 10;
function strHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// Every egg's prize is fixed by the child and the egg number, so every phone agrees. Every 5th egg is a rare colour.
function eggPrize(kidId, n) {
  if ((n + 1) % 5 === 0 && (n + 1) / 5 <= RARE.length) { const [color, name] = RARE[(n + 1) / 5 - 1]; return { type: "colour", color, name }; }
  const [icon, name] = STICKERS[strHash(kidId + ":" + n) % STICKERS.length]; return { type: "sticker", icon, name };
}
function eggsOf(kid) {
  const earned = stats(kid.id).earned, total = Math.floor(earned / EGG_EVERY), opened = Math.min(kid.eggs || 0, total);
  return { opened, waiting: total - opened, next: (total + 1) * EGG_EVERY - earned };
}
function prizesOf(kid) {
  const stickers = {}, colours = [];
  for (let n = 0; n < (kid.eggs || 0); n++) { const p = eggPrize(kid.id, n); if (p.type === "colour") colours.push(p.color); else stickers[p.icon] = (stickers[p.icon] || 0) + 1; }
  return { stickers, colours };
}
function eggSvg(color, cracks) {
  return `<svg viewBox="-30 -38 60 70" aria-hidden="true"><ellipse cx="0" cy="28" rx="18" ry="4" fill="rgba(0,0,0,.18)"/><path d="M0 -34 C18 -34 24 0 24 8 C24 22 13 30 0 30 C-13 30 -24 22 -24 8 C-24 0 -18 -34 0 -34Z" fill="#FFF8E7" stroke="${shade(color, -0.3)}" stroke-width="2.5"/>
    <circle cx="-9" cy="-8" r="5" fill="${color}"/><circle cx="8" cy="4" r="6" fill="${color}"/><circle cx="-6" cy="16" r="4" fill="${color}"/><circle cx="10" cy="-18" r="3.5" fill="${color}"/><path d="M-8 -24 q4 -5 9 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${cracks >= 1 ? `<path d="M-20 0 l7 4 l5 -6 l6 6" stroke="#5B4636" stroke-width="2" fill="none"/>` : ""}${cracks >= 2 ? `<path d="M-2 4 l6 -5 l6 6 l8 -4" stroke="#5B4636" stroke-width="2" fill="none"/>` : ""}</svg>`;
}
function openEgg(kid) {
  const n = kid.eggs || 0, prize = eggPrize(kid.id, n);
  setMonster(kid, { eggs: n + 1 });
  SND.goal(); bigBurst(innerWidth / 2, innerHeight / 3, ["#FFD43B", "#FF5E8A", "#3D7BFF", "#4CBF5A", kid.look.color]);
  const art = prize.type === "colour" ? `<div class="m">${monsterSvg(Object.assign({}, kid.look, { color: prize.color }), wornBy(kid), stats(kid.id).level)}</div>` : `<div class="sticker-big" aria-hidden="true">${prize.icon}</div>`;
  const say = (prize.type === "colour" ? `A rare colour: ${prize.name}` : `A ${prize.name} sticker`) + ` for ${kid.name}!`;
  modal(`${art}<h2>${esc(say)}</h2><p class="meta">${prize.type === "colour" ? `It's in ${kid.name}'s Monster → Make now.` : `It's in ${kid.name}'s Sticker book in the Trophies tab.`}</p><div class="row" style="justify-content:center">${prize.type === "colour" ? `<button class="btn ghost" id="ok">Later</button><button class="btn kid" style="--kid:${prize.color}" id="tryOn" data-autofocus>Try it on!</button>` : `<button class="btn primary" id="ok" data-autofocus>Yay!</button>`}</div>`, () => {
    $("#ok").onclick = closeModal;
    const t = $("#tryOn"); if (t) t.onclick = () => { closeModal(); setMonster(kid, { look: Object.assign({}, kid.look, { color: prize.color }) }); };
  });
}
function viewStickerBook(kid) {
  const { stickers } = prizesOf(kid), e = eggsOf(kid), got = Object.keys(stickers).length;
  return `<div class="sect"><h3>📒 Sticker book</h3><p>${got} of ${STICKERS.length}. ${e.waiting ? `${e.waiting} egg${e.waiting === 1 ? "" : "s"} waiting in the garden!` : `Next egg in ${e.next} Dojos`}</p></div>
    <div class="stickers">${STICKERS.map(([icon, name]) => stickers[icon] ? `<div class="stk"><span class="e" aria-hidden="true">${icon}</span><span class="n">${esc(name)}</span>${stickers[icon] > 1 ? `<span class="x">×${stickers[icon]}</span>` : ""}</div>` : `<div class="stk locked" aria-label="Not found yet"><span class="e">?</span></div>`).join("")}</div>`;
}

// Streak: days in a row with at least one Dojo. Up to two missed days pause it instead of resetting it.
function streakOf(kidId) {
  const days = [...new Set(S.awards.filter((a) => a.kid === kidId && a.kind === "earn" && a.bid !== "admin").map((a) => new Date(a.at).setHours(0, 0, 0, 0)))].sort((a, b) => b - a);
  if (!days.length) return { n: 0, lit: false };
  const today = new Date().setHours(0, 0, 0, 0), gap = (a, b) => Math.round((a - b) / 864e5);
  if (gap(today, days[0]) > 2) return { n: 0, lit: false };
  let n = 1; for (let i = 1; i < days.length && gap(days[i - 1], days[i]) <= 3; i++) n++;
  return { n, lit: days[0] === today };
}
function streakChip(kidId) {
  const s = streakOf(kidId); if (s.n < 1) return "";
  const t = s.n >= 14 ? 4 : s.n >= 7 ? 3 : s.n >= 3 ? 2 : 1;
  return `<span class="streak t${t}${s.lit ? "" : " paused"}" title="${s.n} day${s.n === 1 ? "" : "s"} in a row${s.lit ? "" : " (earn a Dojo today to keep it going)"}" aria-label="${s.n} day streak"><span aria-hidden="true">🔥</span>${s.n}</span>`;
}

// The monster talks: a speech bubble, read aloud in a cartoon voice when sound is on.
// Outside games, voices only play when someone taps a monster, a pet or a 🔊 button. In games the monster says what to do.
// Each kind of character has its own voice: monsters are low and gruff, dragons deeper with a rumble,
// robots flat with beeps, pets squeaky. A short growl or beep plays first, then the words.
// pitch/rate are for the browser's own speech; play is the playback speed of the recorded clips (voice.js).
// Bright, happy voices: monsters a touch higher than the recording, dragons only a little lower, pets squeaky.
const VOICE = { monster: { pitch: 1.35, rate: 1.05, play: 1.06, lead: 260 }, dragon: { pitch: 1.05, rate: 1, play: .97, lead: 300 }, robot: { pitch: 1.2, rate: 1, play: 1.04, lead: 280 }, pet: { pitch: 2, rate: 1.25, play: 1.4, lead: 0 }, narrator: { pitch: 1.2, rate: 1.05, play: 1.02, lead: 0 } };
function voiceOf(who) {
  if (!who) return Object.assign({ kind: "narrator" }, VOICE.narrator);
  if (who === "pet") return Object.assign({ kind: "pet" }, VOICE.pet);
  const look = who.look || who, sp = VOICE[look.species] ? look.species : "monster", v = Object.assign({ kind: sp }, VOICE[sp]);
  // Shape and colour nudge the pitch so each child's monster sounds a bit different.
  const hue = [...String(look.color || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  v.pitch = Math.max(0, Math.min(2, v.pitch + ({ round: .1, tall: 0, wide: -.1 }[look.shape] || 0) + (hue - 2) * .05));
  v.play += ({ round: .04, tall: 0, wide: -.04 }[look.shape] || 0) + (hue - 2) * .025;
  return v;
}
let ttsVoice = null;
function pickVoice() {
  if (ttsVoice || !window.speechSynthesis) return ttsVoice;
  const vs = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); if (!vs.length) return null;
  const score = (v) => (/en[-_]AU/i.test(v.lang) ? 3 : /en[-_]GB/i.test(v.lang) ? 2 : 1) + (/male|daniel|fred|lee|james|ralph|aaron|gordon/i.test(v.name) && !/female/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return (ttsVoice = vs.sort((a, b) => score(b) - score(a))[0]);
}
if (window.speechSynthesis) try { speechSynthesis.onvoiceschanged = () => { ttsVoice = null; pickVoice(); }; } catch (e) {}
// Gravelly "hrrm!" for monsters, a rumbling "rawr" for dragons, blips for robots.
// A cheerful hello sound before a monster speaks: a bouncy "boop-bee!" (robots beep, dragons give a happy little whoosh).
function growl(kind) {
  if (!soundOn()) return;
  try {
    if (kind === "robot") return beep([[880, .07, 0, "pluck"], [1175, .07, .09, "pluck"], [1568, .1, .18, "pluck"]], .35);
    const ac = audio(), t = ac.currentTime, base = kind === "dragon" ? 330 : 523;
    [[0, base, base * 1.5], [.11, base * 1.5, base * 2]].forEach(([d, f0, f1]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f0, t + d); o.frequency.exponentialRampToValueAtTime(f1, t + d + .09);
      g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.4, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .12);
      o.connect(g); g.connect(master); o.start(t + d); o.stop(t + d + .14);
    });
    if (kind === "dragon") whoosh(0, .3, .08);
  } catch (e) {}
}
let speakTimer = null;
// Recorded clips (voice.js) work everywhere Web Audio does, including in-app browsers with no speech.
const CLIPS = window.HD_VOICE || {}, clipBufs = {};
const clipKey = (t) => String(t || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
// Lines with names or numbers in them are said as the closest recorded line.
const VOICE_LIKE = [[/^we got /i, "Great job today!"], [/ to level \d/i, "Keep going to reach the next level!"], [/more dojos to /i, "Your next big reward is getting closer!"], [/days in a row/i, "You're on a streak! Keep it going!"], [/^i love my /i, "I love my hat!"], [/^my .* says hi/i, "My pet says hi!"], [/^happy birthday/i, "Happy birthday!"], [/^i'm .+!$/i, "That's my name!"]];
function clipFor(text) {
  let k = clipKey(text); if (CLIPS[k]) return k;
  const like = VOICE_LIKE.find(([re]) => re.test(text)); if (like && CLIPS[k = clipKey(like[1])]) return k;
  return null;
}
let clipNow = null;
function stopClip() { if (clipNow && clipNow.src) try { clipNow.src.stop(); } catch (e) {} clipNow = null; }
function clipBuffer(k) {
  if (!clipBufs[k]) {
    const bin = atob(CLIPS[k]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    clipBufs[k] = new Promise((res, rej) => audio().decodeAudioData(u.buffer, res, rej));
  }
  return clipBufs[k];
}
function playClip(k, v, delay) {
  stopClip(); const me = {}; clipNow = me;
  clipBuffer(k).then((buf) => {
    if (clipNow !== me) return;
    const ac = audio(), t = ac.currentTime + (delay || 0), src = ac.createBufferSource(), out = ac.createGain();
    src.buffer = buf; src.playbackRate.value = Math.max(.6, Math.min(1.8, v.play)); out.gain.value = 1.5;
    if (v.kind === "robot") {
      // Ring modulation: the classic robot sound, mixed with some of the plain voice so the words stay clear.
      const rm = ac.createGain(), osc = ac.createOscillator(), dry = ac.createGain(); rm.gain.value = 0; dry.gain.value = .7; osc.frequency.value = 90;
      osc.connect(rm.gain); src.connect(rm); src.connect(dry); rm.connect(out); dry.connect(out); osc.start(t); osc.stop(t + buf.duration / src.playbackRate.value + .1);
    } else if (v.kind === "dragon") { const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200; src.connect(lp); lp.connect(out); }
    else src.connect(out);
    out.connect(master); src.start(t); me.src = src;
  }).catch(() => {});
}
// who: a child (their monster's voice), "pet", or nothing (the friendly narrator). quick skips the growl.
function speak(text, who, quick) {
  if (!soundOn()) return;
  clearTimeout(speakTimer);
  const ck = clipFor(text);
  if (ck) {
    try { if (window.speechSynthesis && speechSynthesis.speaking) speechSynthesis.cancel(); } catch (e) {}
    const v = voiceOf(who), lead = !quick && v.lead;
    if (lead) growl(v.kind);
    return playClip(ck, v, lead ? v.lead / 1000 : 0);
  }
  if (!window.speechSynthesis) return;
  // Only cancel when something is playing: on iPhones a cancel straight before speaking can swallow the new words.
  try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) {}
  const v = voiceOf(who), say = () => {
    try {
      const u = new SpeechSynthesisUtterance(String(text).replace(/[^\p{L}\p{N}\s!?.,'’-]/gu, ""));
      const tv = pickVoice(); if (tv) u.voice = tv;
      u.pitch = v.pitch; u.rate = v.rate; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  };
  // Speech must start inside the tap itself or phones block it, so the growl plays alongside the words.
  if (!quick && v.lead) growl(v.kind);
  say();
}
// Some phones only allow speech once it has started inside a tap, so warm it up on the first one.
document.addEventListener("pointerdown", function warm() {
  document.removeEventListener("pointerdown", warm, true);
  if (window.speechSynthesis) try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); pickVoice(); } catch (e) {}
}, true);
function monsterLines(kid) {
  const st = stats(kid.id), today = new Date().setHours(0, 0, 0, 0), lines = [];
  const todays = S.awards.filter((a) => a.kid === kid.id && a.kind === "earn" && a.at >= today);
  const counts = {}; todays.forEach((a) => { counts[a.label] = (counts[a.label] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top) lines.push(`We got ${top[1]} ${top[0]} today!`); else lines.push("Let's earn a Dojo today!");
  if (st.next != null) lines.push(`Only ${st.next - st.earned} Dojos to level ${st.level + 1}!`);
  const ms = milestonesOf(kid).find((m) => st.earned < m.at); if (ms) lines.push(`${ms.at - st.earned} more Dojos to ${ms.label}!`);
  const s = streakOf(kid.id); if (s.n >= 2) lines.push(`${s.n} days in a row! Keep it going!`);
  if (eggsOf(kid).waiting) lines.push("There's an egg in the garden!");
  const w = wornBy(kid), hat = SHOP.find((i) => i.id === w.hat), pet = SHOP.find((i) => i.id === w.pet);
  if (hat) lines.push(`I love my ${hat.name.toLowerCase()}!`);
  if (pet) lines.push(`My ${pet.name.toLowerCase()} says hi!`);
  if (isBirthday(kid)) lines.unshift(`Happy birthday ${kid.name}!`);
  lines.push("You're awesome!", "Give me a high five!", "I'm so proud of you!");
  return lines;
}
function monsterSay(kid, text, silent) {
  const host = $("#heroMonster"); if (!host) return;
  const old = host.querySelector(".say"); if (old) old.remove();
  const b = document.createElement("span"); b.className = "say"; b.textContent = text; host.appendChild(b);
  setTimeout(() => b.remove(), 3800);
  if (!silent) speak(text, kid);
}

// Seasons and birthdays.
function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); }
function isBirthday(kid, d) {
  if (!kid.birthday) return false; d = d || new Date();
  const [, mm, dd] = String(kid.birthday).split("-").map(Number);
  return mm === d.getMonth() + 1 && dd === d.getDate();
}
// On their birthday a monster wears a party hat (just for show).
function dressedFor(kid) { const w = wornBy(kid); return isBirthday(kid) ? Object.assign({}, w, { hat: "party" }) : w; }
// Holidays and seasons for the garden, set for Australia (southern hemisphere).
// Dates that move each year (lunar and Islamic calendars) come from a table; extend it past 2035.
const MOVING = {
  lunar: { 2026: "02-17", 2027: "02-06", 2028: "01-26", 2029: "02-13", 2030: "02-03", 2031: "01-23", 2032: "02-11", 2033: "01-31", 2034: "02-19", 2035: "02-08" },
  midautumn: { 2026: "09-25", 2027: "09-15", 2028: "10-03", 2029: "09-22", 2030: "09-12", 2031: "10-01", 2032: "09-19", 2033: "09-08", 2034: "09-27", 2035: "09-16" },
  deepavali: { 2026: "11-08", 2027: "10-29", 2028: "10-17", 2029: "11-05", 2030: "10-26", 2031: "11-14", 2032: "11-02", 2033: "10-22", 2034: "11-10", 2035: "10-30" },
  hariraya: { 2026: "03-20", 2027: "03-10", 2028: "02-27", 2029: "02-15", 2030: "02-05", 2031: "01-25", 2032: "01-14", 2033: "01-03", 2034: "12-12", 2035: "12-02" }
};
function dayOf(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function daysFrom(d, y, mmdd) { const [m, dd] = mmdd.split("-").map(Number); return Math.round((dayOf(d) - new Date(y, m - 1, dd)) / 864e5); }
function nthSunday(y, month, n) { const d = new Date(y, month - 1, 1); d.setDate(1 + ((7 - d.getDay()) % 7) + (n - 1) * 7); return d; }
function nearMoving(kind, d, before, after) {
  const y = d.getFullYear();
  return [y - 1, y].some((yy) => MOVING[kind][yy] && (() => { const n = daysFrom(d, yy, MOVING[kind][yy]); return n >= -before && n <= after; })());
}
// The one holiday shown today (first match wins), or "".
function seasonNow(d) {
  d = d || new Date(); const m = d.getMonth() + 1, day = d.getDate(), y = d.getFullYear(), today = dayOf(d);
  if ((m === 12 && day === 31) || (m === 1 && day <= 2)) return "newyear";
  if (m === 12 && day <= 26) return "christmas";
  if (nearMoving("lunar", d, 2, 14)) return "lunar";
  if (nearMoving("hariraya", d, 1, 3)) return "hariraya";
  const e = easter(y); if (Math.abs(today - dayOf(e)) <= 7 * 864e5) return "easter";
  if (nearMoving("deepavali", d, 3, 2)) return "deepavali";
  if (nearMoving("midautumn", d, 4, 2)) return "midautumn";
  if (m === 10 && day >= 25) return "halloween";
  if (m === 2 && day >= 10 && day <= 14) return "valentines";
  const md = nthSunday(y, 5, 2), fd = nthSunday(y, 9, 1);
  if ((md - today) / 864e5 >= 0 && (md - today) / 864e5 <= 1) return "mothers";
  if ((fd - today) / 864e5 >= 0 && (fd - today) / 864e5 <= 1) return "fathers";
  return "";
}
// Australian seasons: summer from December.
function ausSeason(d) { const m = (d || new Date()).getMonth() + 1; return m === 12 || m <= 2 ? "summer" : m <= 5 ? "autumn" : m <= 8 ? "winter" : "spring"; }
// Rough school holiday dates (most states): mid-April, early July, late September, and the summer break.
function schoolHols(d) {
  d = d || new Date(); const m = d.getMonth() + 1, day = d.getDate();
  return (m === 12 && day >= 19) || (m === 1 && day <= 27) || (m === 4 && day >= 5 && day <= 19) || (m === 7 && day <= 14) || (m === 9 && day >= 21) || (m === 10 && day <= 5);
}
function banner(text, bg, fg, y) { const w = Math.min(300, 30 + text.length * 7.2); return `<rect x="${200 - w / 2}" y="${y || 6}" width="${w}" height="20" rx="6" fill="${bg}" opacity=".92"/><text x="200" y="${(y || 6) + 14}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="11.5" fill="${fg}">${text}</text>`; }
function heart(x, y, r, fill) { return `<path d="M${x} ${y + r * .9} C${x - r * 1.6} ${y - r * .2} ${x - r * .7} ${y - r * 1.4} ${x} ${y - r * .5} C${x + r * .7} ${y - r * 1.4} ${x + r * 1.6} ${y - r * .2} ${x} ${y + r * .9}Z" fill="${fill}"/>`; }
function lantern(x, y, c) { return `<g transform="translate(${x} ${y})"><path d="M0 -10 V-4" stroke="#8D6E63" stroke-width="1"/><ellipse cx="0" cy="4" rx="7" ry="8" fill="${c}"/><path d="M-4 -3 Q-6 4 -4 11 M4 -3 Q6 4 4 11" stroke="#FFD43B" stroke-width=".8" fill="none" opacity=".8"/><rect x="-3" y="-5" width="6" height="2.5" fill="#FFD43B"/><rect x="-3" y="11" width="6" height="2.5" fill="#FFD43B"/><path d="M0 13.5 v5" stroke="#FFD43B" stroke-width="1.2"/></g>`; }
function diya(x, y) { return `<g transform="translate(${x} ${y})"><path d="M-7 0 Q0 7 7 0Z" fill="#C8662F"/><path d="M-7 0 H7" stroke="#8D3E14" stroke-width="1"/><path class="flicker" d="M0 -1 q-3 -4 0 -9 q3 5 0 9z" fill="#FFB400"/><circle cx="0" cy="-5" r="6" fill="#FFD43B" opacity=".2"/></g>`; }
function burst(x, y, c, delay) { return `<g class="twinkle" style="animation-delay:${delay}s">${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<path d="M${x + Math.cos(a) * 4} ${y + Math.sin(a) * 4} L${x + Math.cos(a) * 12} ${y + Math.sin(a) * 12}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`; }).join("")}</g>`; }

// Season layer (always on), then any school-holiday extras, then today's holiday.
function seasonDecor(season, kids, quietBanner) {
  const d = new Date(); let s = "";
  const base = ausSeason(d);
  if (base === "summer") {
    s += `<g transform="translate(64 268)"><ellipse rx="34" ry="11" fill="#3FA7F5" stroke="#FFF" stroke-width="3"/><ellipse cx="-8" cy="-2" rx="12" ry="3" fill="#BDE6FF" opacity=".8"/><circle cx="16" cy="0" r="4" fill="#FFD43B"/><path d="M14 -4 l3 -2" stroke="#FF8A2A" stroke-width="2"/></g>`;
    s += `<g transform="translate(352 262)"><path d="M0 0 V-38" stroke="#8D6E63" stroke-width="2"/><path d="M-26 -34 Q0 -60 26 -34Z" fill="#FF5E8A"/><path d="M-9 -34 Q0 -60 9 -34Z" fill="#fff"/><g transform="translate(-30 4)"><path d="M-4 -6 L0 6 L4 -6Z" fill="#E8B07A"/><circle cy="-8" r="5" fill="#FF8FC7"/><circle cx="2" cy="-12" r="3.5" fill="#FFF3C4"/></g></g>`;
  } else if (base === "autumn") {
    s += Array.from({ length: 9 }, (_, i) => `<path class="fall" style="animation-delay:${-i * 1.3}s;animation-duration:${9 + (i % 3) * 2}s" d="M${20 + i * 44} -10 q6 -6 12 0 q-6 6 -12 0z" fill="${["#E8701A", "#C2264B", "#F2B705"][i % 3]}"/>`).join("");
    s += [[40, 240], [150, 286], [300, 230], [372, 292], [220, 258]].map(([x, y], i) => `<path d="M${x} ${y} q5 -5 10 0 q-5 5 -10 0z" fill="${["#E8701A", "#C2264B", "#F2B705"][i % 3]}"/>`).join("");
  } else if (base === "winter") {
    s += Array.from({ length: 16 }, (_, i) => `<circle class="fall" style="animation-delay:${-i * .8}s;animation-duration:${8 + (i % 4)}s" cx="${10 + i * 25}" cy="-6" r="${1.6 + (i % 3) * .6}" fill="#fff"/>`).join("");
    s += `<path d="M0 150 Q100 146 200 150 T400 150 V156 H0Z" fill="#fff" opacity=".7"/><g transform="translate(364 268)"><circle cy="0" r="13" fill="#fff" stroke="#DDE3EA"/><circle cy="-18" r="9" fill="#fff" stroke="#DDE3EA"/><circle cx="-3" cy="-20" r="1.3" fill="#222"/><circle cx="3" cy="-20" r="1.3" fill="#222"/><path d="M0 -17 l6 1.5 l-6 1.5z" fill="#FF8A2A"/><path d="M-8 -11 H8" stroke="#E63946" stroke-width="3"/><rect x="-7" y="-33" width="14" height="7" fill="#1C2433"/><rect x="-10" y="-27" width="20" height="2.5" fill="#1C2433"/></g>`;
  } else {
    s += `<g transform="translate(18 176)"><path d="M0 0 V-44" stroke="#8D6E63" stroke-width="5"/>${[[-14, -48, 16], [6, -56, 18], [18, -42, 14], [-4, -38, 14]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFB3D1"/>`).join("")}${[[-10, -54], [8, -62], [16, -44], [-2, -42], [2, -50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff"/>`).join("")}</g>`;
    s += [[120, 210, "#FFD43B", 0], [270, 236, "#9ED8FF", 1.2], [330, 200, "#FF8FC7", 2.1]].map(([x, y, c, dl]) => `<g class="flutter" style="animation-delay:${-dl}s"><g transform="translate(${x} ${y})"><path class="wingb" d="M0 0 q-8 -9 -10 -1 q2 6 10 1z M0 0 q8 -9 10 -1 q-2 6 -10 1z" fill="${c}"/><path d="M0 -4 V4" stroke="#1C1830" stroke-width="1.5"/></g></g>`).join("");
  }
  if (schoolHols(d) && !season) {
    s += `<g class="bob2"><path d="M96 36 L110 20 L124 36 L110 54Z" fill="#E63946"/><path d="M110 20 V54 M96 36 H124" stroke="#fff" stroke-width="1.2"/><path d="M110 54 Q104 80 118 100 Q126 116 120 140" stroke="#555" stroke-width="1" fill="none"/>${[70, 86, 102].map((y, i) => `<path d="M${112 + (i % 2 ? 4 : -4)} ${y} l4 -3 l1 5z" fill="${["#FFD43B", "#3D7BFF", "#4CBF5A"][i]}"/>`).join("")}</g>`;
    s += `<g transform="translate(250 282)"><circle r="8" fill="#fff"/><path d="M-8 0 A8 8 0 0 1 0 -8 V0Z" fill="#E63946"/><path d="M8 0 A8 8 0 0 1 0 8 V0Z" fill="#3D7BFF"/><path d="M0 -8 A8 8 0 0 1 8 0 H0Z" fill="#FFD43B"/></g>`;
  }
  if (season === "halloween") {
    s += `<rect width="400" height="300" fill="#5B2BD9" opacity=".12"/>`;
    [[30, 150], [92, 154], [318, 152], [378, 150]].forEach(([x, y]) => { s += `<g transform="translate(${x} ${y})"><ellipse rx="11" ry="9" fill="#FF8A2A"/><path d="M-4 -9 q4 -6 6 -2" stroke="#3E8E41" stroke-width="3" fill="none"/><path d="M-6 -2 l3 -3 l3 3Z M1 -2 l3 -3 l3 3Z" fill="#3B1F00"/><path d="M-6 3 q6 5 12 0 l-2 2 l-2 -2 l-2 2 l-2 -2 l-2 2Z" fill="#3B1F00"/></g>`; });
    const dragon = (body, belly, cls, k) => `<g class="flyer ${cls}"><g transform="scale(${k})"><path d="M-10 2 Q-22 4 -28 -4 L-24 -2 L-26 -8 Q-18 -2 -10 -3Z" fill="${body}"/><ellipse cx="0" cy="0" rx="12" ry="7" fill="${body}"/><ellipse cx="1" cy="3" rx="8" ry="3.5" fill="${belly}"/><circle cx="13" cy="-5" r="6" fill="${body}"/><path d="M17 -5 q6 0 7 3 q-4 2 -8 1z" fill="${body}"/><path d="M10 -10 l-2 -6 l4 3z M14 -10 l1 -6 l2 5z" fill="${belly}"/><circle cx="14" cy="-6" r="1.6" fill="#1C1830"/><path class="wing" d="M-4 -4 Q-6 -22 8 -26 Q4 -16 10 -14 Q4 -12 4 -4Z" fill="${shade(body, -0.2)}"/><path class="puff" d="M25 -2 q6 -4 10 0 q-4 4 -10 0z" fill="#FF8A2A"/><path d="M-2 6 v4 M6 6 v4" stroke="${shade(body, -0.2)}" stroke-width="2.5" stroke-linecap="round"/></g></g>`;
    s += dragon("#4CBF5A", "#C5F2B5", "d1", 1) + dragon("#7B61FF", "#D9CFFF", "d2", .75);
  } else if (season === "christmas") {
    s += `<g transform="translate(372 152)"><path d="M0 -60 L22 -6 H-22Z M0 -40 L26 6 H-26Z" fill="#2E8B57"/><rect x="-4" y="6" width="8" height="10" fill="#8D6E63"/>${star(0, -62, 8, "#FFD43B")}${[[-8, -28, "#E63946"], [8, -18, "#3D7BFF"], [-12, -2, "#FFD43B"], [12, 0, "#FF5E8A"], [0, -38, "#fff"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3" fill="${c}"/>`).join("")}</g>`;
    s += `<path d="M0 136 Q50 146 100 136 T200 136 T300 136 T400 136" stroke="#2E8B57" stroke-width="2" fill="none"/>${Array.from({ length: 20 }, (_, i) => `<circle class="twinkle" style="animation-delay:${(i % 5) * .3}s" cx="${i * 20 + 10}" cy="${139 + Math.sin(i) * 3}" r="2.6" fill="${["#E63946", "#FFD43B", "#3D7BFF", "#4CBF5A"][i % 4]}"/>`).join("")}`;
    s += `<rect x="330" y="160" width="16" height="13" fill="#E63946"/><path d="M338 160 V173 M330 166 H346" stroke="#FFD43B" stroke-width="2"/>`;
  } else if (season === "easter") {
    [[40, 236], [150, 268], [250, 214], [350, 258], [96, 288]].forEach(([x, y], i) => { s += `<ellipse cx="${x}" cy="${y}" rx="6" ry="8" fill="${["#FFB3D1", "#B3E5FC", "#FFF59D", "#C5E1A5", "#D1C4E9"][i]}" stroke="#fff" stroke-width="1.5"/>`; });
  } else if (season === "newyear") {
    s += banner("Happy New Year!", "#1C2433", "#FFD43B", 30) + burst(60, 40, "#FFD43B", 0) + burst(150, 22, "#FF5E8A", .5) + burst(250, 30, "#3FA7F5", 1) + burst(320, 70, "#4CBF5A", .3);
  } else if (season === "lunar") {
    s += `<path d="M0 34 Q100 46 200 34 T400 34" stroke="#8D6E63" stroke-width="1" fill="none"/>` + [30, 90, 150, 210, 270, 330, 390].map((x, i) => lantern(x, 46 + (i % 2) * 4, "#E63946")).join("");
    if (!quietBanner) s += banner("Happy Lunar New Year!", "#C2264B", "#FFD43B", 62);
    s += `<g class="dance"><g transform="translate(0 286)">${Array.from({ length: 7 }, (_, i) => `<g class="seg" style="animation-delay:${-i * .15}s"><ellipse cx="${-i * 13}" cy="0" rx="9" ry="7" fill="${i % 2 ? "#FFD43B" : "#E63946"}"/><path d="M${-i * 13 - 4} -6 l4 -5 l4 5" fill="#FFD43B"/></g>`).join("")}<g><ellipse cx="11" cy="-2" rx="11" ry="9" fill="#E63946"/><circle cx="15" cy="-6" r="2.5" fill="#fff"/><circle cx="15.5" cy="-6" r="1.2" fill="#222"/><path d="M20 0 q6 2 4 6" stroke="#FFD43B" stroke-width="2" fill="none"/><path d="M6 -10 l-4 -6 M12 -11 l0 -7" stroke="#FFD43B" stroke-width="2"/></g></g></g>`;
  } else if (season === "valentines") {
    s += Array.from({ length: 8 }, (_, i) => `<g class="rise" style="animation-delay:${-i * 1.1}s"><g transform="translate(${30 + i * 48} 300)">${heart(0, 0, 6 + (i % 3) * 2, ["#FF5E8A", "#E63946", "#FF8FC7"][i % 3])}</g></g>`).join("");
  } else if (season === "midautumn") {
    s += `<circle cx="70" cy="44" r="22" fill="#FFF3C4"/><circle cx="64" cy="38" r="4" fill="#F2E3A0"/><circle cx="78" cy="50" r="3" fill="#F2E3A0"/>`;
    s += [26, 70, 330, 374].map((x, i) => lantern(x, 128, ["#E63946", "#FF8A2A", "#FFD43B", "#E63946"][i])).join("");
    s += `<g transform="translate(200 288)"><ellipse rx="26" ry="5" fill="#fff" stroke="#DDE3EA"/><circle cx="-9" cy="-4" r="7" fill="#D99A4E"/><circle cx="9" cy="-4" r="7" fill="#D99A4E"/><circle cx="-9" cy="-4" r="4" fill="none" stroke="#B5763A"/><circle cx="9" cy="-4" r="4" fill="none" stroke="#B5763A"/></g>`;
    if (!quietBanner) s += banner("Happy Mid-Autumn Festival!", "#7B3F00", "#FFD43B", 30);
  } else if (season === "deepavali") {
    s += [20, 70, 120, 170, 230, 280, 330, 380].map((x) => diya(x, 296)).join("");
    s += `<g transform="translate(200 236)" opacity=".9">${[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => `<ellipse cx="${Math.cos(a * Math.PI / 180) * 12}" cy="${Math.sin(a * Math.PI / 180) * 6}" rx="7" ry="4" fill="${["#E63946", "#FFD43B", "#3D7BFF", "#4CBF5A"][i % 4]}" transform="rotate(${a} ${Math.cos(a * Math.PI / 180) * 12} ${Math.sin(a * Math.PI / 180) * 6})"/>`).join("")}<circle r="5" fill="#FF8A2A"/></g>`;
    s += burst(80, 30, "#FFD43B", 0) + burst(170, 18, "#FF5E8A", .6) + burst(260, 40, "#C77DFF", 1.1);
    if (!quietBanner) s += banner("Happy Deepavali!", "#7B2CBF", "#FFD43B", 58);
  } else if (season === "hariraya") {
    s += `<path d="M0 30 Q100 40 200 30 T400 30" stroke="#8D6E63" stroke-width="1" fill="none"/>` + [40, 120, 200, 280, 360].map((x) => `<g transform="translate(${x} 44)"><path d="M0 -12 V-8" stroke="#8D6E63"/><path d="M0 -8 L9 1 L0 10 L-9 1Z" fill="#4CAF50" stroke="#2E7D32"/><path d="M-4.5 -3.5 L4.5 5.5 M4.5 -3.5 L-4.5 5.5" stroke="#C5E1A5" stroke-width="1.5"/><path d="M0 10 l-2 6 M0 10 l2 6" stroke="#FFD43B" stroke-width="1.2"/></g>`).join("");
    s += [20, 60, 340, 380].map((x) => diya(x, 160)).join("");
    if (!quietBanner) s += banner("Selamat Hari Raya!", "#2E7D32", "#FFF59D", 62);
  } else if (season === "mothers") {
    if (!quietBanner) s += banner("Happy Mother's Day!", "#FF5E8A", "#fff", 30);
    s += [[60, 60], [340, 66], [130, 40], [280, 44]].map(([x, y], i) => `<g class="bob2" style="animation-delay:${i * .4}s">${heart(x, y, 7, i % 2 ? "#FF8FC7" : "#E63946")}</g>`).join("");
  } else if (season === "fathers") {
    if (!quietBanner) s += banner("Happy Father's Day!", "#2F6BFF", "#fff", 30);
    s += `<path d="M0 54 Q100 70 200 54 T400 54" stroke="#8D6E63" stroke-width="1" fill="none"/>` + Array.from({ length: 13 }, (_, i) => `<path d="M${i * 31 + 6} ${56 + Math.sin(i) * 3} l8 14 l8 -14z" fill="${["#2F6BFF", "#FFD43B", "#4CBF5A"][i % 3]}"/>`).join("");
  }
  return s;
}
function birthdayDecor(kids, slot) {
  let s = "";
  kids.forEach((k, i) => {
    if (!isBirthday(k)) return;
    const cx = slot * (i + 0.5);
    s += `<g transform="translate(${cx} 30)">${["#FF5E8A", "#FFD43B", "#3D7BFF"].map((c, j) => `<path d="M${(j - 1) * 14} 18 Q${(j - 1) * 8} 60 ${(j - 1) * 2} 110" stroke="#9AA3B2" stroke-width="1" fill="none"/><ellipse class="bob2" style="animation-delay:${j * .4}s" cx="${(j - 1) * 14}" cy="8" rx="9" ry="11" fill="${c}"/>`).join("")}</g>
      <rect x="${cx - 62}" y="2" width="124" height="18" rx="6" fill="#FF5E8A"/><text x="${cx}" y="15" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="10.5" fill="#fff">Happy birthday ${esc(k.name.slice(0, 10))}!</text>`;
  });
  return s;
}

// Lobby secrets: tap the sun for night, a cloud for rain, the sun five times fast for fireworks.
const SECRET = { sunTaps: [] };
function lobbySecret(kind, e) {
  const lob = $("#lobby"); if (!lob) return;
  if (kind === "sun") {
    const now = Date.now(); SECRET.sunTaps = SECRET.sunTaps.filter((t) => now - t < 2000).concat([now]);
    if (SECRET.sunTaps.length >= 5) { SECRET.sunTaps = []; LOBBY.night = true; lob.classList.add("night"); return fireworks(); }
    LOBBY.night = !LOBBY.night; lob.classList.toggle("night", LOBBY.night);
    beep(LOBBY.night ? [[784, .4, 0], [659, .4, .15], [523, .7, .3]] : [[523, .3, 0], [659, .3, .12], [784, .5, .24]], .3);
  } else if (kind === "cloud") rain();
  else if (kind === "flower") {
    const g = e.target.closest("[data-egg]"); if (g && g.animate && !reduced()) g.animate([{ transform: g.getAttribute("transform") + " scale(1)" }, { transform: g.getAttribute("transform") + " scale(1.8) rotate(180deg)" }, { transform: g.getAttribute("transform") + " scale(1)" }], { duration: 700 });
    beep([[1047 + Math.random() * 500, .3, 0, "pluck"]], .35);
  }
}
function rain() {
  const lob = $("#lobby"); if (!lob || lob.querySelector(".rain")) return;
  const r = document.createElement("div"); r.className = "rain";
  r.innerHTML = Array.from({ length: 50 }, () => `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * .8).toFixed(2)}s;animation-duration:${(.5 + Math.random() * .4).toFixed(2)}s"></i>`).join("");
  lob.appendChild(r); whoosh(0, 2.5, .15);
  setTimeout(() => { r.remove(); const rb = document.createElement("div"); rb.className = "rainbow"; lob.appendChild(rb); beep([[523, .3, 0], [659, .3, .1], [784, .3, .2], [1047, .6, .3]], .3); setTimeout(() => rb.remove(), 4000); }, 3000);
  Object.values(LOBBY.st).forEach((st) => { if (st.actor.type === "monster" && st.el) { const old = st.el.querySelector(".bubble"); if (old) old.remove(); const b = document.createElement("span"); b.className = "bubble"; b.textContent = ["Splash!", "Rain!", "Wheee!"][Math.floor(Math.random() * 3)]; st.el.appendChild(b); setTimeout(() => b.remove(), 1600); } });
}
function fireworks() {
  const lob = $("#lobby"); if (!lob) return;
  const r = lob.getBoundingClientRect();
  for (let i = 0; i < 7; i++) setTimeout(() => {
    const x = r.left + r.width * (0.15 + Math.random() * 0.7), y = r.top + r.height * (0.12 + Math.random() * 0.3);
    confetti(x, y, [["#FFD43B", "#FF5E8A"], ["#3D7BFF", "#fff"], ["#4CBF5A", "#FFD43B"], ["#C77DFF", "#fff"]][i % 4], 40, { spread: 1.6, power: .7 });
    whoosh(0, .25, .4); beep([[200 + Math.random() * 120, .25, .05, "pluck"]], .5);
  }, i * 380);
}

// Team jar: both boys fill it together for a family treat.
const TEAM_DEFAULT = { icon: "🎬", label: "Family movie night", target: 30 };
function teamOf() { return S.cfg && S.cfg.team ? S.cfg.team : null; }
function teamProgress(team) { return S.awards.filter((a) => a.kind === "earn" && a.bid !== "admin" && a.at >= (team.startAt || 0)).reduce((n, a) => n + (a.pts || 0), 0); }
function jarSvg(team, prog) {
  const earns = S.awards.filter((a) => a.kind === "earn" && a.bid !== "admin" && a.at >= (team.startAt || 0)), max = 48, tgt = Math.max(1, team.target || 30);
  const shown = tgt > max ? Math.round(max * Math.min(prog, tgt) / tgt) : Math.min(prog, tgt), step = earns.length / Math.max(shown, 1);
  let marbles = "";
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(i / 6), col = i % 6, a = earns[Math.floor(i * step)] || {}, k = kidById(a.kid);
    marbles += `<circle cx="${24 + col * 14.5 + (row % 2) * 6}" cy="${128 - row * 12}" r="6.5" fill="${k ? k.look.color : "#FFD43B"}" stroke="#fff" stroke-width="1.5"/>`;
  }
  return `<svg viewBox="0 0 130 150" aria-hidden="true"><rect x="30" y="8" width="70" height="12" rx="4" fill="#C49A6C"/><path d="M26 22 H104 Q112 30 112 44 V128 Q112 144 96 144 H34 Q18 144 18 128 V44 Q18 30 26 22Z" fill="#E8F6FF" opacity=".75" stroke="#9CC9E8" stroke-width="3"/>${marbles}<path d="M28 40 V120" stroke="#fff" stroke-width="4" opacity=".7" stroke-linecap="round"/></svg>`;
}
function viewTeam() {
  const team = teamOf(); if (!team) return "";
  const prog = teamProgress(team), full = prog >= team.target;
  return `<section class="team${full ? " full" : ""}"><div class="jar">${jarSvg(team, prog)}</div><div class="stack" style="gap:6px">
    <div class="meta" style="font-weight:700">Team jar</div><h3 style="font-size:20px">${esc(team.icon || "🎁")} ${esc(team.label)}</h3>
    <div class="bar" aria-hidden="true"><i style="width:${Math.min(100, Math.round(100 * prog / team.target))}%"></i></div>
    <div class="meta">${full ? "The jar is full! Time for the treat 🎉" : `${Math.min(prog, team.target)} of ${team.target} Dojos. Fill it up together!`}</div>
    ${full && isAdmin() ? `<button class="btn small primary" id="teamDone">We did it! Start a new jar</button>` : ""}</div></section>`;
}
function celebrateTeam(team) {
  SND.goal(); bigBurst(innerWidth / 2, innerHeight / 3, (S.cfg.kids || []).map((k) => k.look.color).concat(["#FFD43B", "#fff"])); setTimeout(() => bigBurst(innerWidth / 2, innerHeight / 3, ["#FFD43B", "#FF5E8A", "#3D7BFF"]), 700);
  modal(`<div class="jar" style="width:140px;margin:0 auto">${jarSvg(team, team.target)}</div><h2>The team jar is full!</h2><p style="font-family:var(--font-display);font-size:22px;margin:0">${esc(team.icon || "🎁")} ${esc(team.label)}</p><p class="meta">You filled it together. Brilliant teamwork!</p><button class="btn primary" data-autofocus id="ok">Hooray!</button>`, () => { $("#ok").onclick = closeModal; });
}

// Bedtime: a calm screen with sleepy monsters, a breathing guide and a soft lullaby.
const BED = { timers: [] };
const TWINKLE = "CCGGAAG-FFEEDDC-GGFFEED-GGFFEED-CCGGAAG-FFEEDDC-";
function lullaby() {
  if (!soundOn()) return;
  const f = { C: 262, D: 294, E: 330, F: 349, G: 392, A: 440 }, beat = .62;
  let t = 0; const notes = [];
  [...TWINKLE].forEach((ch, i) => { if (ch === "-") { t += beat; return; } const last = TWINKLE[i + 1] === "-"; notes.push([f[ch] * 2, last ? beat * 2.2 : beat * 1.3, t]); t += last ? beat : beat; });
  // The lullaby plays through its own volume knob, so closing bedtime can silence notes already scheduled.
  stopLullaby();
  const ac = audio(); BED.bus = ac.createGain(); BED.bus.connect(master);
  const bus = BED.bus;
  for (let rep = 0; rep < 3; rep++) BED.timers.push(setTimeout(() => { if (BED.bus === bus) beep(notes, .12, bus); }, rep * t * 1000 + 300));
}
function stopLullaby() {
  BED.timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); BED.timers = [];
  if (BED.bus) { try { BED.bus.gain.setValueAtTime(0, actx.currentTime); BED.bus.disconnect(); } catch (e) {} BED.bus = null; }
}
function openBedtime() {
  if ($(".bedtime")) closeBedtime();
  const kids = S.cfg.kids || [], today = new Date().setHours(0, 0, 0, 0);
  const tally = kids.map((k) => { const n = S.awards.filter((a) => a.kid === k.id && a.kind === "earn" && a.at >= today).reduce((x, a) => x + (a.pts || 0), 0); return `${esc(k.name)} earned ${n} ${n === 1 ? "Dojo" : "Dojos"}`; }).join(" and ");
  const el = document.createElement("div"); el.className = "bedtime"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Bedtime");
  el.innerHTML = `<div class="stars-bg"></div><div class="moon"></div>
    <div class="sleepers">${kids.map((k, i) => `<div class="sleeper" style="animation-delay:${i * .7}s"><div class="m">${monsterSvg(k.look, dressedFor(k), stats(k.id).level)}</div><span class="zz" style="animation-delay:${i * .9}s">z</span><span class="zz z2" style="animation-delay:${i * .9 + 1}s">Z</span></div>`).join("")}</div>
    <h2>Goodnight ${kids.map((k) => esc(k.name)).join(" and ")}</h2><p class="today">Today ${tally}. Well done!</p>
    <div class="breath"><div class="ring"></div><span id="breathTxt">Breathe in…</span></div>
    <button class="btn" id="bedClose">Goodnight 🌙</button>`;
  document.body.appendChild(el);
  let inhale = true; clearInterval(BED.breath); BED.breath = (setInterval(() => { inhale = !inhale; const t = el.querySelector("#breathTxt"); if (t) t.textContent = inhale ? "Breathe in…" : "Breathe out…"; }, 4000));
  lullaby();
  el.querySelector("#bedClose").onclick = closeBedtime; el.querySelector("#bedClose").focus();
}
// Leaving the app (screen off, another app) stops the lullaby too.
document.addEventListener("visibilitychange", () => { if (document.hidden) { stopLullaby(); clearTimeout(speakTimer); stopClip(); if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} } });
function closeBedtime() {
  stopLullaby(); clearInterval(BED.breath);
  if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
  const el = $(".bedtime"); if (el) el.remove();
}

// Toddler mode: one giant button per behaviour, a big monster that plays peekaboo.
const isToddler = (k) => k.toddler != null ? !!k.toddler : (k.age || 6) < 4;
function viewToddler(kid) {
  const st = stats(kid.id), today = new Date().setHours(0, 0, 0, 0);
  const n = S.awards.filter((a) => a.kid === kid.id && a.kind === "earn" && a.at >= today).reduce((x, a) => x + (a.pts || 0), 0);
  const bs = (kid.behaviours || []).concat([BONUS]);
  return `<div class="toddler" style="--kid:${esc(kid.look.color)}">
    <div class="row" style="margin-bottom:10px;justify-content:space-between"><button class="iconbtn" id="backBtn" aria-label="Back to all monsters">← All monsters</button><button class="btn small ghost" id="fullView">Grown-up view</button></div>
    <button class="tod-stage" id="peekaboo" aria-label="Play peekaboo"><div class="m" id="heroMonster">${monsterSvg(kid.look, dressedFor(kid), st.level)}</div><svg class="bush" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 V34 Q14 8 40 22 Q56 0 82 16 Q102 -2 122 16 Q146 0 162 22 Q186 8 200 34 V60Z" fill="#5CC260"/><path d="M0 60 V44 Q20 26 44 38 Q70 22 96 36 Q122 22 148 38 Q176 26 200 44 V60Z" fill="#4CAF50"/></svg></button>
    <div class="tod-name">${esc(kid.name)} ${streakChip(kid.id)}</div>
    <div class="tod-stars" aria-label="${n} Dojos today">${n ? Array.from({ length: Math.min(n, 10) }, () => `<span>⭐</span>`).join("") + (n > 10 ? `<b>+${n - 10}</b>` : "") : `<span class="none">Let's get a star!</span>`}</div>
    <div class="tod-btns">${kidsMode() ? "" : bs.map((b) => `<button class="beh tod${b.id === "bonus" ? " bonus" : ""}" data-beh="${esc(b.id)}"><span class="e" aria-hidden="true">${esc(b.icon)}</span><span class="l">${esc(b.label)}</span></button>`).join("")}</div>${adminPlay() || (gameCfg().on && stats(kid.id).level >= 2 && playsLeft(kid)) ? `<button class="btn kid tod-game" data-game="bubbles">🫧 Bubbles!</button><button class="btn kid tod-game" data-game="peek">👋 Peekaboo!</button>` : ""}${isl() ? `<button class="btn kid tod-game" data-islgo="${esc(kid.id)}" data-islas="${esc(kid.id)}" data-islfrom="kid">🏝️ My island</button>` : ""}
    <div class="row" style="justify-content:center;margin-top:12px">${wallet(st, true)}</div></div>`;
}
function peekaboo(kid) {
  const m = $("#heroMonster"); if (!m || m.dataset.busy) return;
  m.dataset.busy = "1";
  beep([[392, .12, 0, "pluck"], [330, .12, .1, "pluck"]], .35);
  const done = () => {
    delete m.dataset.busy;
    beep([[523, .12, 0, "pluck"], [784, .12, .08, "pluck"], [1047, .25, .16, "pluck"], [1319, .3, .24, "pluck"]], .45);
    const b = document.createElement("span"); b.className = "say"; b.textContent = "Peekaboo!"; m.appendChild(b); setTimeout(() => b.remove(), 1800);
    speak(`Peekaboo ${kid.name}!`, kid);
    confetti(innerWidth / 2, innerHeight * .3, [kid.look.color, "#FFD43B", "#FF5E8A"], 30);
  };
  if (reduced() || !m.animate) return done();
  m.animate([{ transform: "translateY(0)" }, { transform: "translateY(70%)", offset: .25 }, { transform: "translateY(70%)", offset: .7 }, { transform: "translateY(-12%)", offset: .85 }, { transform: "translateY(0)" }], { duration: 1800, easing: "ease-in-out" });
  setTimeout(done, 1450);
}

/* ---------- carers' guide ---------- */
// Shows docs/carers-guide.md (via guide.js) with the children's names and current behaviours filled in.
function mdInline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
function mdToHtml(md) {
  const out = [], lines = md.split("\n"); let i = 0;
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith("## ")) { out.push(`<h2>${mdInline(l.slice(3))}</h2>`); i++; continue; }
    if (l.startsWith("<")) { out.push(l); i++; continue; }
    if (l.startsWith("|")) {
      const rows = []; while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const head = cells(rows[0]), body = rows.slice(2).map(cells);
      out.push(`<div class="gtable"><table><thead><tr>${head.map((c) => `<th>${mdInline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const ol = /^\d+\. /.test(l);
    if (ol || l.startsWith("- ")) {
      const items = []; while (i < lines.length && (ol ? /^\d+\. /.test(lines[i]) : lines[i].startsWith("- "))) items.push(lines[i++].replace(/^(\d+\. |- )/, ""));
      out.push(`<${ol ? "ol" : "ul"}>${items.map((t) => `<li>${mdInline(t)}</li>`).join("")}</${ol ? "ol" : "ul"}>`);
      continue;
    }
    out.push(`<p>${mdInline(l)}</p>`); i++;
  }
  return out.join("");
}
function viewGuide() {
  const kids = S.cfg.kids || [], n1 = (kids[0] && kids[0].name) || "your older child", n2 = (kids[1] && kids[1].name) || "your younger child";
  const behs = kids.map((k) => `<div class="gkid" style="--kid:${esc(k.look.color)}"><h3>${esc(k.name)}</h3><ul>${(k.behaviours || []).map((b) => {
    const lib = LIB.find((x) => x.id === b.id);
    return `<li><span class="e" aria-hidden="true">${esc(b.icon)}</span><div><b>${esc(b.label)}</b>${lib ? `<p>${esc(lib.why)}</p>` : ""}</div></li>`;
  }).join("") || "<li>No behaviours set yet.</li>"}</ul></div>`).join("");
  const md = GUIDE_MD.replace("{{BEHAVIOURS}}", "<!--B-->").split("{1}").join(n1).split("{2}").join(n2);
  return `<div class="row" style="justify-content:space-between;margin-bottom:8px"><button class="iconbtn" id="guideBack">← Back</button><h1 style="font-size:24px">📖 Carers' guide</h1><span style="width:60px"></span></div>
    <article class="guide card">${mdToHtml(md).replace("<!--B-->", `<div class="gkids">${behs}</div>`)}</article>`;
}

/* ---------- games ---------- */
// Little games unlocked by monster level. Points come from speed and accuracy, streaks multiply them,
// and each child's best score is kept. Games never give Dojos; a parent sets the daily limit in Settings.
const GAMES = [
  { id: "bubbles", level: 2, icon: "🫧", name: "Bubble pop", blurb: "Pop only the colour your monster asks for. Quick streaks score double.", time: 40 },
  { id: "feed", level: 2, icon: "🍎", name: "Feed the monster", blurb: "Your monster asks for a snack. Find it fast for more points.", time: 45 },
  { id: "memory", say: "Flip two cards and find the matching pairs!", level: 3, icon: "🃏", name: "Memory match", blurb: "Find pairs before time runs out. Pairs in a row score extra.", time: 75 },
  { id: "puzzle", say: "Slide the pieces to fix the picture!", level: 3, icon: "🧩", name: "Monster puzzle", blurb: "Slide the pieces to fix your monster. Fewer moves, more points.", time: 150 },
  { id: "peek", say: "Tap the monsters when they pop up! Let the sleepy ones sleep!", level: 1, icon: "🕳️", name: "Peekaboo pals", blurb: "Tap the monsters as they pop up. Don't wake the sleepy ones!", time: 40 },
  { id: "race", say: "Ready, set, go! Tap left or right to change lanes!", level: 2, icon: "🏎️", name: "Monster racing", blurb: "Zoom past the other racers, grab coins and boosts. Can you finish first?", time: 50 },
  { id: "stars", say: "Catch the stars and dodge the rocks!", level: 4, icon: "🌟", name: "Catch the stars", blurb: "Catch the stars, dodge the rocks. It gets faster!", time: 45 },
  { id: "jump", say: "Tap to jump over the rocks! Tap again in the air to jump higher!", level: 5, icon: "🪨", name: "Monster jump", blurb: "Jump the rocks and grab the coins. It gets faster!", time: 45 },
  { id: "copy", say: "Watch me, then copy me!", level: 6, icon: "🥁", name: "Copy the monster", blurb: "Copy the drum pattern. Every round adds one more beat.", time: 75 }
];
function gameCfg() { return Object.assign({ on: true, limit: 3 }, S.cfg && S.cfg.games); }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function playsLeft(kid) { if (adminPlay()) return Infinity; const g = gameCfg(), p = kid.plays || {}; return g.limit ? Math.max(0, g.limit - (p.d === todayKey() ? p.n || 0 : 0)) : Infinity; }
function bestOf(kid, id) { return (kid.best || {})[id] || 0; }
// The admin editor for one child: give or take away anything. Gifts are free; taking back a bought item returns its Dojo $.
function viewAdminKid(kid, st) {
  const g = gameCfg(), used = kid.plays && kid.plays.d === todayKey() ? kid.plays.n || 0 : 0, e = eggsOf(kid);
  const row = (id, name, has, extra) => `<div class="admrow"><span class="t"><b>${esc(name)}</b>${extra ? `<small>${extra}</small>` : ""}</span>${has ? `<span class="pill own">Has it</span><button class="btn small ghost" data-adm="take" data-v="${esc(id)}">Take away</button>` : `<button class="btn small kid" style="--kid:${esc(kid.look.color)}" data-adm="give" data-v="${esc(id)}">Give</button>`}</div>`;
  const bought = (id) => S.awards.some((a) => a.kid === kid.id && a.kind === "buy" && a.item === id && a.pts > 0);
  const open = S.admOpen || (S.admOpen = new Set());
  const group = (title, items) => `<details class="card admgrp" data-grp="${esc(title)}"${open.has(title) ? " open" : ""}><summary><b>${title}</b> <span class="meta">${items.filter((i) => st.owned.has(i.id)).length} of ${items.length}</span></summary>${items.map((i) => row(i.id, i.name, st.owned.has(i.id), st.owned.has(i.id) && bought(i.id) ? "Bought: taking it back returns the Dojo $" : "")).join("")}</details>`;
  return `<div class="sect"><h3>🛠 Admin</h3><p>Give or take away anything. Changes save straight away. Dojos only change from the Earn tab and the Week history.</p></div>
  <section class="card"><h3 style="font-size:18px">⭐ Dojos and 🪙 Dojo $</h3><p class="meta" style="margin:0">Now: <b>${st.earned}</b> Dojos and <b>${st.balance}</b> Dojo $. Adding Dojos adds the same Dojo $, just like earning. Changes show in the Week history as "Admin adjustment" and don't count towards streaks or the team jar.</p>
    <label class="field" style="max-width:200px">How many<input id="admAmt" type="number" min="1" max="1000" value="5" inputmode="numeric"></label>
    <div class="row"><button class="btn small" data-adm="dojos" data-v="1">+ Add Dojos</button><button class="btn small ghost" data-adm="dojos" data-v="-1">− Take Dojos</button></div>
    <div class="row"><button class="btn small" data-adm="cash" data-v="1">+ Add Dojo $ only</button><button class="btn small ghost" data-adm="cash" data-v="-1">− Take Dojo $ only</button></div></section>
  <section class="card"><h3 style="font-size:18px">🎮 Game tries today</h3><p class="meta" style="margin:0">${g.limit ? `${Math.min(used, g.limit)} of ${g.limit} used, ${Math.max(0, g.limit - used)} left.` : `${used} played. There's no daily limit.`}</p>
    <div class="row"><button class="btn small" data-adm="tries" data-v="-1">− Give one back</button><button class="btn small" data-adm="tries" data-v="1">+ Use one up</button><button class="btn small ghost" data-adm="tries" data-v="0">Reset today</button></div></section>
  <section class="card"><h3 style="font-size:18px">🏆 High scores</h3>${GAMES.map((gm) => `<div class="admrow"><span class="t"><b>${gm.icon} ${esc(gm.name)}</b><small>${bestOf(kid, gm.id) ? "Best: " + bestOf(kid, gm.id) : "No score yet"}</small></span>${bestOf(kid, gm.id) ? `<button class="btn small ghost" data-adm="best" data-v="${gm.id}">Clear</button>` : ""}</div>`).join("")}</section>
  <section class="card"><h3 style="font-size:18px">🥚 Mystery eggs</h3><p class="meta" style="margin:0">${kid.eggs || 0} hatched (stickers and rare colours). ${e.waiting ? `${e.waiting} waiting in the garden.` : ""}</p>
    <div class="row"><button class="btn small" data-adm="eggs" data-v="-1">− Take the last prize back</button><button class="btn small" data-adm="eggs" data-v="1">+ Hatch one now</button></div></section>
  ${SLOTS.map(([slot, title]) => group(secTitle(title), SHOP.filter((i) => i.slot === slot))).join("")}
  ${group("🏠 Houses", HOUSE.slice(1))}${group("🛋️ Furniture", FURNI)}${isl() ? group("🏝️ Island specials", islSpecials()) + isl().adminHtml(kid) : ""}`;
}
function adminEdit(kid, act, v) {
  kid = kidById(kid.id) || kid;
  if (act === "give") { const it = SHOP.concat(FURNI, HOUSE, islSpecials()).find((i) => i.id === v); if (it) { addRecord({ kid: kid.id, kind: "buy", item: it.id, label: it.name + " (gift)", icon: "🎁", pts: 0, at: Date.now() }); toast(`${kid.name} now has the ${it.name}.`); } }
  else if (act === "take") { const it = SHOP.concat(FURNI, HOUSE, islSpecials()).find((i) => i.id === v); S.awards.filter((a) => a.kid === kid.id && a.kind === "buy" && a.item === v).forEach((a) => removeRecord(a.id)); if (it) toast(`The ${it.name} was taken away.`); }
  else if (act === "tries") { const n = kid.plays && kid.plays.d === todayKey() ? kid.plays.n || 0 : 0, d = +v; setMonster(kid, { plays: { d: todayKey(), n: d === 0 ? 0 : Math.max(0, Math.min(gameCfg().limit || 999, n) + d) } }); }
  else if (act === "best") { const b = Object.assign({}, kid.best); delete b[v]; setMonster(kid, { best: b }); }
  else if (act === "eggs") setMonster(kid, { eggs: Math.max(0, (kid.eggs || 0) + +v) });
  else if (act === "dojos" || act === "cash") {
    const st = stats(kid.id), amt = Math.max(0, Math.min(1000, parseInt(($("#admAmt") || {}).value, 10) || 0)); if (!amt) return toast("Type how many first.");
    // Dojos: an "earn" entry (moves Dojos and Dojo $ together). Dojo $ only: a "spend" entry (negative gives Dojo $ back). Never below zero.
    if (act === "dojos") { const n = +v > 0 ? amt : -Math.min(amt, st.earned, Math.max(0, st.balance)); if (!n) return toast("There are no Dojos to take."); addRecord({ kid: kid.id, kind: "earn", bid: "admin", label: "Admin adjustment", icon: "🛠", pts: n, at: Date.now() }); toast(`${n > 0 ? "Added" : "Took"} ${Math.abs(n)} Dojo${Math.abs(n) === 1 ? "" : "s"} ${n > 0 ? "to" : "from"} ${kid.name}.`); }
    else { const n = +v > 0 ? amt : Math.min(amt, Math.max(0, st.balance)); if (!n) return toast("There are no Dojo $ to take."); addRecord({ kid: kid.id, kind: "spend", bid: "admin", label: "Admin adjustment (Dojo $)", icon: "🛠", pts: +v > 0 ? -n : n, at: Date.now() }); toast(`${+v > 0 ? "Added" : "Took"} ${n} Dojo $ ${+v > 0 ? "to" : "from"} ${kid.name}.`); }
  }
  rerender();
}
function viewGames(kid, st) {
  const g = gameCfg(), left = playsLeft(kid);
  return `<div class="sect"><h3>🎮 Games</h3><p>${adminPlay() ? "Admin mode: every game is unlocked. These games don't count towards the daily limit or high scores." : !g.limit ? "Play as much as you like." : left ? `${left} of ${g.limit} game${g.limit === 1 ? "" : "s"} left today.` : "No games left today. Come back tomorrow!"} Beat your best score! Games are just for fun and don't give Dojos.</p></div>
  <div class="games">${GAMES.map((gm) => {
    const open = adminPlay() || st.level >= gm.level, need = LEVELS[gm.level - 1] - st.earned, best = bestOf(kid, gm.id);
    return `<button class="gcard${open ? "" : " locked"}" ${open && left ? `data-game="${gm.id}"` : "disabled"}><span class="gi" aria-hidden="true">${open ? gm.icon : "🔒"}</span><b>${esc(gm.name)}</b><small>${open ? esc(gm.blurb) : `Unlocks at level ${gm.level}: ${need} more Dojo${need === 1 ? "" : "s"}`}</small>${open && best ? `<span class="gbest">🏆 Best ${best}</span>` : ""}</button>`;
  }).join("")}</div>`;
}
const GAME = { stop: null };
function closeGame() { if (GAME.stop) GAME.stop(); GAME.stop = null; const el = $(".game"); if (el) el.remove(); }
function startGame(kidIn, id) {
  const gm = GAMES.find((g) => g.id === id); if (!gm) return;
  closeGame();
  if (!playsLeft(kidIn)) return toast("No games left today. Come back tomorrow!");
  const p = kidIn.plays && kidIn.plays.d === todayKey() ? kidIn.plays.n || 0 : 0;
  if (!adminPlay()) setMonster(kidIn, { plays: { d: todayKey(), n: p + 1 } });
  const kid = kidById(kidIn.id) || kidIn, best = bestOf(kid, id);
  const el = document.createElement("div"); el.className = "game"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", gm.name);
  el.style.setProperty("--kid", kid.look.color);
  el.innerHTML = `<div class="gtop"><button class="iconbtn" id="gameX" aria-label="Close the game">✕</button><b>${gm.icon} ${esc(gm.name)}</b><span class="gscore" id="gScore">0</span></div>
    <div class="gsub"><span>${best ? `🏆 Best: ${best}` : "Set a high score!"}</span><span class="combo" id="gCombo"></span></div>
    <div class="gbar"><i id="gTime"></i></div><div class="gstage" id="gStage"></div>`;
  document.body.appendChild(el);
  const stage = el.querySelector("#gStage"), comboEl = el.querySelector("#gCombo");
  let score = 0, combo = 0, stopped = false, endMsg = null; const timers = [];
  const showScore = () => { const s = el.querySelector("#gScore"); if (s) { s.textContent = score; bounce(s); } };
  const api = {
    kid, stage, toddler: isToddler(kid), monster: () => monsterSvg(kid.look, wornBy(kid), stats(kid.id).level),
    get score() { return score; }, get combo() { return combo; },
    // A right answer: points times the streak bonus (x2 from 5 in a row, x3 from 10).
    hit(base, x, y) {
      combo++; const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1, pts = Math.round((base || 1) * mult);
      score += pts; showScore();
      comboEl.textContent = mult > 1 ? `🔥 ×${mult} streak!` : combo >= 3 ? `${combo} in a row` : "";
      if (x != null) floatPts(stage, x, y, "+" + pts, mult > 1);
      return pts;
    },
    miss(x, y, text) { combo = 0; comboEl.textContent = ""; if (x != null) floatPts(stage, x, y, text || "Oops", false, true); beep([[196, .14, 0, "pluck"]], .35); },
    add(n) { score += n; showScore(); },
    elapsed: 0,
    every(ms, fn) { const t = setInterval(() => { if (!stopped) fn(); }, ms); timers.push(t); return t; },
    after(ms, fn) { const t = setTimeout(() => { if (!stopped) fn(); }, ms); timers.push(t); return t; },
    loop(fn) { let last = performance.now(); const tick = (t) => { if (stopped) return; fn(Math.min(0.05, (t - last) / 1000)); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); },
    onStop(fn) { cleanups.push(fn); },
    onEnd(fn) { endMsg = fn; },
    end(msg) { if (stopped) return; stop(); finishGame(kid, gm, score, msg || (endMsg && endMsg()), stage); }
  };
  const cleanups = [];
  const stop = () => { stopped = true; timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); cleanups.splice(0).forEach((f) => { try { f(); } catch (e) {} }); };
  GAME.stop = stop;
  el.querySelector("#gameX").onclick = closeGame;
  const t0 = performance.now(), bar = el.querySelector("#gTime");
  api.every(150, () => { const sec = (performance.now() - t0) / 1000; api.elapsed = sec; const f = sec / gm.time; bar.style.width = Math.max(0, 100 - f * 100) + "%"; bar.classList.toggle("low", f > .8); if (f >= 1) api.end(); });
  GAME_PLAY[id](api);
  if (gm.say) speak(gm.say, kid, true);
}
// "+3" floating up from where the point was scored, relative to the stage.
function floatPts(stage, x, y, text, big, bad) {
  const r = stage.getBoundingClientRect(), s = document.createElement("span");
  s.className = "gpts" + (big ? " big" : "") + (bad ? " bad" : ""); s.textContent = text;
  s.style.left = (x - r.left) + "px"; s.style.top = (y - r.top) + "px"; stage.appendChild(s); setTimeout(() => s.remove(), 900);
}
function finishGame(kid, gm, score, msg, stage) {
  kid = kidById(kid.id) || kid;
  const old = bestOf(kid, gm.id), record = !adminPlay() && score > old && score > 0;
  if (record) setMonster(kid, { best: Object.assign({}, kid.best, { [gm.id]: score }) });
  kid = kidById(kid.id) || kid;
  const left = playsLeft(kid);
  const head = record ? (old ? "New high score!" : "First high score!") : score >= old * .8 && old ? "So close to your best!" : "Nice playing!";
  speak(head, kid, true);
  SND.goal(); if (record) { bigBurst(innerWidth / 2, innerHeight / 3, [kid.look.color, "#FFD43B", "#FF5E8A", "#3D7BFF"]); setTimeout(() => bigBurst(innerWidth / 2, innerHeight / 2, ["#FFD43B", "#FFF59D", "#FFFFFF"]), 500); }
  stage.innerHTML = `<div class="gend"><div class="m">${monsterSvg(kid.look, wornBy(kid), stats(kid.id).level)}</div><h2>${esc(head)}</h2>
    <div class="gfinal">${score}<small>points</small></div>${msg ? `<p class="meta">${esc(msg)}</p>` : ""}
    <p class="meta">${Math.max(old, score) ? `🏆 Best: ${Math.max(old, score)}` : "Score points to set a high score!"}${left === Infinity ? "" : ` · ${left ? `${left} game${left === 1 ? "" : "s"} left today` : "No more games today"}`}</p>
    <div class="row" style="justify-content:center"><button class="btn ghost" id="gDone">Done</button>${left ? `<button class="btn kid" id="gAgain">Play again</button>` : ""}</div></div>`;
  stage.querySelector("#gDone").onclick = closeGame;
  const again = stage.querySelector("#gAgain"); if (again) again.onclick = () => startGame(kid, gm.id);
}
const BUBBLE_COLS = [["#E63946", "red"], ["#3D7BFF", "blue"], ["#FFD43B", "yellow"], ["#4CBF5A", "green"]];
// How the monster asks for each food out loud.
const FOOD_SAY = { apple: "an apple", banana: "a banana", strawberry: "a strawberry", carrot: "a carrot", cookie: "a cookie", donut: "a donut" };
const FOODS = [["🍎", "apple"], ["🍌", "banana"], ["🍓", "strawberry"], ["🍇", "grapes"], ["🥕", "carrot"], ["🍉", "watermelon"], ["🍪", "cookie"], ["🧀", "cheese"], ["🥦", "broccoli"], ["🍕", "pizza"], ["🍩", "donut"], ["🌽", "corn"]];
const GAME_PLAY = {
  bubbles(api) {
    const { stage } = api; stage.classList.add("g-bubbles");
    // Toddlers can pop any bubble; everyone else pops the colour the monster asks for.
    stage.innerHTML = api.toddler ? `<p class="ghint">Pop the bubbles!</p>` : `<div class="ask" id="bAsk"></div>`;
    const ask = stage.querySelector("#bAsk"); let want = 0;
    const setWant = () => { want = Math.floor(Math.random() * BUBBLE_COLS.length); if (ask) { ask.innerHTML = `Pop <b style="color:${BUBBLE_COLS[want][0]}">${BUBBLE_COLS[want][1]}</b> bubbles! <i style="background:${BUBBLE_COLS[want][0]}"></i>`; bounce(ask); } };
    setWant(); if (!api.toddler) api.every(7000, () => { setWant(); speak(`Pop the ${BUBBLE_COLS[want][1]} bubbles!`, api.kid, true); });
    speak(api.toddler ? "Pop the bubbles!" : `Pop the ${BUBBLE_COLS[want][1]} bubbles!`, api.kid, true);
    const spawn = () => {
      const b = document.createElement("button"), sp = 1 + Math.min(1.2, api.elapsed / 30), size = (api.toddler ? 70 : 54) + Math.random() * 34;
      const ci = Math.random() < .4 ? want : Math.floor(Math.random() * BUBBLE_COLS.length), gold = Math.random() < .06;
      b.className = "bub"; b.setAttribute("aria-label", gold ? "Gold bubble" : BUBBLE_COLS[ci][1] + " bubble");
      b.style.cssText = `left:${4 + Math.random() * 74}%;width:${size}px;height:${size}px;animation-duration:${(5.5 + Math.random() * 2) / sp}s;--bc:${gold ? "#FFC400" : BUBBLE_COLS[ci][0]}`;
      if (gold) b.innerHTML = `<span class="bs">⭐</span>`;
      b.onpointerdown = (e) => {
        e.preventDefault(); if (b.classList.contains("pop")) return; b.classList.add("pop");
        const rc = b.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top + rc.height / 2;
        if (api.toddler || gold || ci === want) { api.hit(gold ? 5 : 1, x, y); beep([[650 + Math.min(10, api.combo) * 60, .09, 0, "pluck"]], .55); confetti(x, y, [gold ? "#FFC400" : BUBBLE_COLS[ci][0], "#FFFFFF"], 12); }
        else api.miss(x, y, "Wrong colour");
        setTimeout(() => b.remove(), 250);
      };
      b.addEventListener("animationend", (e) => { if (e.animationName === "bubup") b.remove(); });
      stage.appendChild(b);
    };
    spawn(); api.every(api.toddler ? 650 : 480, spawn);
  },
  feed(api) {
    const { stage } = api; stage.classList.add("g-feed");
    stage.innerHTML = `<div class="feedtop"><div class="feedm" id="feedM">${api.monster()}</div><div class="ask big" id="fAsk"></div></div><div class="foodgrid" id="fGrid"></div>`;
    const grid = stage.querySelector("#fGrid"), ask = stage.querySelector("#fAsk"), mon = stage.querySelector("#feedM");
    let want = null, askedAt = 0, busy = false;
    const deal = () => {
      // Show 6 snacks at first, then all 9 once the player is warmed up; the wanted one is always there.
      const n = api.score >= 12 ? 9 : 6, pool = FOODS.slice().sort(() => Math.random() - .5).slice(0, n);
      want = pool[Math.floor(Math.random() * n)];
      grid.className = "foodgrid n" + n;
      grid.innerHTML = pool.map(([e, name]) => `<button class="food" data-f="${name}" aria-label="${name}">${e}</button>`).join("");
      ask.innerHTML = `I want <span class="fe">${want[0]}</span> ${want[1]}! <button class="sayit" aria-label="Say it out loud">🔊</button>`; bounce(ask);
      const w = want, line = `I want ${FOOD_SAY[w[1]] || w[1]}!`; speak(line, api.kid, true);
      ask.querySelector(".sayit").onpointerdown = (e) => { e.preventDefault(); speak(line, api.kid, true); };
      askedAt = performance.now(); busy = false;
      grid.querySelectorAll(".food").forEach((f) => f.onpointerdown = (e) => { e.preventDefault(); pickFood(f); });
    };
    const pickFood = (f) => {
      if (busy) return;
      const rc = f.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top;
      if (f.dataset.f !== want[1]) { api.miss(x, y, "Not that one!"); f.classList.add("nope"); mon.classList.remove("shake"); void mon.offsetWidth; mon.classList.add("shake"); return; }
      busy = true;
      const secs = (performance.now() - askedAt) / 1000, base = secs < 1.5 ? 3 : secs < 3 ? 2 : 1;
      const b = mon.getBoundingClientRect(), dx = b.left + b.width / 2 - x, dy = b.top + b.height * .6 - (rc.top + rc.height / 2);
      const anim = f.animate([{ transform: "none" }, { transform: `translate(${dx}px,${dy}px) scale(.3)` }], { duration: 280, easing: "ease-in" });
      anim.onfinish = () => { f.style.visibility = "hidden"; api.hit(base, x, y); bounce(mon, true); beep([[330, .07, 0, "pluck"], [262, .09, .08, "pluck"]], .6); api.after(250, deal); };
    };
    deal();
  },
  memory(api) {
    const { stage } = api; stage.classList.add("g-memory");
    let board = 0;
    const deal = () => {
      const pairs = [4, 6, 8][Math.min(board, 2)]; board++;
      const pick = PET_IDS.slice().sort(() => Math.random() - .5).slice(0, pairs), deck = pick.concat(pick).sort(() => Math.random() - .5);
      stage.innerHTML = `<p class="ghint">Board ${board}</p><div class="cards c${pairs}">${deck.map((p, i) => `<button class="card2" data-i="${i}" data-p="${p}" aria-label="Card"><span class="back">?</span><span class="face"><svg viewBox="-30 -30 60 60" aria-hidden="true">${petSvg(p)}</svg></span></button>`).join("")}</div>`;
      let open = [], found = 0, busy = false;
      stage.querySelectorAll(".card2").forEach((c) => c.onclick = () => {
        if (busy || c.classList.contains("up")) return;
        c.classList.add("up"); open.push(c); beep([[520, .06, 0, "pluck"]], .4);
        if (open.length < 2) return;
        const [a, b] = open; open = []; const rc = b.getBoundingClientRect();
        if (a.dataset.p === b.dataset.p) {
          found++; a.classList.add("got"); b.classList.add("got"); api.hit(10, rc.left + rc.width / 2, rc.top); beep([[660, .1, 0], [880, .14, .1]], .5);
          if (found === pairs) { api.add(20); floatPts(stage, innerWidth / 2, innerHeight / 3, "Board clear +20", true); api.after(900, deal); }
        } else { api.miss(); busy = true; api.after(800, () => { a.classList.remove("up"); b.classList.remove("up"); busy = false; }); }
      });
    };
    deal();
  },
  puzzle(api) {
    const { stage } = api; stage.classList.add("g-puzzle");
    const SIZES = [[2, 2], [3, 3]];
    let board = 0;
    const deal = () => {
      const [rows, cols] = SIZES[Math.min(board, SIZES.length - 1)], n = rows * cols; board++;
      // Shuffle by making random legal moves from the solved picture, so every board can be solved.
      let tiles = Array.from({ length: n }, (_, i) => i), gap = n - 1, prev = -1;
      const near = (g) => [g - cols, g + cols, g % cols ? g - 1 : -1, (g + 1) % cols ? g + 1 : -1].filter((x) => x >= 0 && x < n);
      const misplaced = () => tiles.filter((t, i) => t !== i && t !== n - 1).length;
      for (let k = 0; k < n * 12 || misplaced() < Math.min(n - 1, 5); k++) { const opts = near(gap).filter((x) => x !== prev); const m = opts[Math.floor(Math.random() * opts.length)]; [tiles[gap], tiles[m]] = [tiles[m], tiles[gap]]; prev = gap; gap = m; }
      let moves = 0;
      const art = api.monster();
      stage.innerHTML = `<div class="pzhead"><span>Board ${board}</span><span id="pzMoves">Moves: 0</span><div class="pzpeek" title="The finished picture">${art}</div></div>
        <div class="pzgrid" id="pzGrid" style="grid-template-columns:repeat(${cols},1fr);aspect-ratio:${cols}/${rows}"></div>`;
      const grid = stage.querySelector("#pzGrid");
      const draw = () => {
        grid.innerHTML = tiles.map((t, i) => t === n - 1 ? `<div class="pzt empty"></div>` :
          `<button class="pzt" data-pos="${i}" aria-label="Piece ${t + 1}"><div class="pzimg" style="width:${cols * 100}%;height:${rows * 100}%;left:${-(t % cols) * 100}%;top:${-Math.floor(t / cols) * 100}%">${art}</div><span class="pzn">${t + 1}</span></button>`).join("");
        grid.querySelectorAll(".pzt[data-pos]").forEach((b) => b.onpointerdown = (e) => { e.preventDefault(); slide(+b.dataset.pos, b); });
      };
      const slide = (pos, el) => {
        const g = tiles.indexOf(n - 1);
        if (!near(g).includes(pos)) { el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); return; }
        [tiles[g], tiles[pos]] = [tiles[pos], tiles[g]]; moves++; stage.querySelector("#pzMoves").textContent = `Moves: ${moves}`;
        beep([[440 + (tiles[g] % 5) * 60, .06, 0, "pluck"]], .4); draw();
        if (tiles.every((t, i) => t === i)) {
          // Points for the board size, plus a bonus for solving it in few moves.
          const par = n === 4 ? 4 : 30, pts = n * 5 + Math.max(0, par * 2 - moves);
          grid.classList.add("solved"); grid.innerHTML = `<div class="pzdone">${art}</div>`;
          const r = grid.getBoundingClientRect(); api.add(pts); floatPts(stage, r.left + r.width / 2, r.top + 20, `Solved! +${pts}`, true); speak("You did it!", api.kid, true);
          SND.buy(); confetti(innerWidth / 2, innerHeight / 2, [api.kid.look.color, "#FFD43B", "#FFFFFF"], 30);
          api.after(1400, deal);
        }
      };
      draw();
    };
    deal();
  },
  stars(api) {
    const { stage } = api; stage.classList.add("g-stars");
    // The outer box only moves left and right; the inner one does the happy bounce, so a catch never knocks the monster out of place.
    stage.innerHTML = `<div class="smon" id="sMon"><div class="smi">${api.monster()}</div></div><p class="ghint">Drag anywhere to move. Catch ⭐, dodge 🪨</p>`;
    const mon = stage.querySelector("#sMon"), inner = mon.firstElementChild, items = [];
    let W = stage.clientWidth, H = stage.clientHeight, mx = W / 2, tx = W / 2, held = false, key = 0, gap = 0;
    const clampX = (x) => Math.max(45, Math.min(W - 45, x));
    const setT = (e) => { const r = stage.getBoundingClientRect(); tx = clampX(e.clientX - r.left); };
    stage.onpointerdown = (e) => { e.preventDefault(); held = true; setT(e); try { stage.setPointerCapture(e.pointerId); } catch (x) {} };
    stage.onpointermove = (e) => { if (held) setT(e); };
    stage.onpointerup = stage.onpointercancel = () => { held = false; };
    const kd = (e) => { if (e.key === "ArrowLeft") key = -1; else if (e.key === "ArrowRight") key = 1; };
    const ku = (e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") key = 0; };
    addEventListener("keydown", kd); addEventListener("keyup", ku);
    api.onStop(() => { removeEventListener("keydown", kd); removeEventListener("keyup", ku); });
    api.loop((dt) => {
      W = stage.clientWidth; H = stage.clientHeight;
      const sp = 1 + Math.min(1.2, api.elapsed / 28);
      gap -= dt; if (gap <= 0) {
        const r = Math.random(), kind = r < (api.toddler ? 0 : .26) ? "rock" : r < .36 ? "gold" : "star";
        const s = document.createElement("span"); s.className = "fstar " + kind; s.textContent = kind === "rock" ? "🪨" : kind === "gold" ? "🌟" : "⭐";
        stage.appendChild(s); items.push({ el: s, x: 30 + Math.random() * (W - 60), y: -36, v: (110 + Math.random() * 70) * sp, kind });
        gap = .66 / sp;
      }
      if (key) tx = clampX(tx + key * 420 * dt);
      // Follows the finger closely but smoothly, and stays where it was left when the finger lifts.
      mx += (tx - mx) * Math.min(1, dt * 18); mon.style.left = (mx - 50) + "px";
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.y += it.v * dt; it.el.style.transform = `translate(${it.x - 16}px,${it.y}px)`;
        if (it.y > H - 125 && it.y < H - 45 && Math.abs(it.x - mx) < 50) {
          const r = it.el.getBoundingClientRect();
          if (it.kind === "rock") { api.miss(r.left, r.top, "Bonk!"); mon.classList.remove("oops"); void mon.offsetWidth; mon.classList.add("oops"); }
          else { api.hit(it.kind === "gold" ? 3 : 1, r.left, r.top); beep([[it.kind === "gold" ? 1046 : 784, .1, 0, "pluck"]], .5); confetti(r.left + 16, r.top + 16, ["#FFD43B", "#FFF59D", api.kid.look.color], 8); bounce(inner); }
          it.el.remove(); items.splice(i, 1);
        } else if (it.y > H) { it.el.remove(); items.splice(i, 1); }
      }
    });
  },
  peek(api) {
    const { stage } = api; stage.classList.add("g-peek");
    // Nine holes. Friends pop up for a moment: tap them. Gold ones are worth more. Sleepy ones (not for toddlers) want to be left alone.
    stage.innerHTML = `<p class="ghint">Tap the monsters! 😴 Let sleepy ones sleep.</p><div class="holes">${Array.from({ length: 9 }, (_, i) => `<div class="hole"><button class="pal" data-h="${i}" aria-label="Monster"></button></div>`).join("")}</div>`;
    const pals = [...stage.querySelectorAll(".pal")], up = new Array(9).fill(null);
    const look = (c) => Object.assign({}, api.kid.look, { color: c });
    const hide = (i) => { const p = pals[i]; p.classList.remove("up"); up[i] = null; };
    pals.forEach((p, i) => p.onpointerdown = (e) => {
      e.preventDefault(); const u = up[i]; if (!u || u.tapped) return; u.tapped = true;
      if (u.kind === "sleepy") { api.miss(e.clientX, e.clientY, "Shh!"); p.classList.add("woke"); }
      else { api.hit(u.kind === "gold" ? 3 : 1, e.clientX, e.clientY); beep([[u.kind === "gold" ? 1046 : 660, .08, 0, "pluck"], [u.kind === "gold" ? 1318 : 880, .1, .06, "pluck"]], .45); confetti(e.clientX, e.clientY, [u.c, "#FFD43B", "#fff"], 8); p.classList.add("bopped"); }
      clearTimeout(u.t); u.t = setTimeout(() => { p.classList.remove("woke", "bopped"); hide(i); }, 260);
    });
    const popOne = () => {
      const free = up.map((u, i) => u ? -1 : i).filter((i) => i >= 0); if (!free.length) return;
      const i = free[Math.floor(Math.random() * free.length)], r = Math.random();
      const kind = !api.toddler && r < .2 ? "sleepy" : r > .9 ? "gold" : "pal", c = kind === "gold" ? "#F5B700" : COLORS[Math.floor(Math.random() * COLORS.length)];
      const p = pals[i]; p.className = "pal " + kind; p.innerHTML = monsterSvg(look(c), {}, 1) + (kind === "sleepy" ? `<span class="zz">💤</span>` : kind === "gold" ? `<span class="zz">✨</span>` : "");
      void p.offsetWidth; p.classList.add("up");
      const stay = Math.max(api.toddler ? 1400 : 650, (api.toddler ? 2200 : 1500) - api.elapsed * 22);
      up[i] = { kind, c, t: api.after(stay, () => hide(i)) };
    };
    const tick = () => { popOne(); if (api.elapsed > 12 && Math.random() < .45) popOne(); api.after(Math.max(420, 900 - api.elapsed * 12), tick); };
    api.after(500, tick);
  },
  race(api) {
    const RACE_ART = {
      coin: `<svg viewBox="0 0 60 90" aria-hidden="true"><circle cx="30" cy="45" r="20" fill="#F5B700"/><circle cx="30" cy="45" r="15" fill="#FFD43B"/>${star(30, 45, 8, "#F5B700")}</svg>`,
      boost: `<svg viewBox="0 0 60 90" aria-hidden="true"><circle cx="30" cy="45" r="24" fill="#7B61FF"/><path d="M34 22 L18 49 H29 L25 68 L42 40 H31Z" fill="#FFD43B"/></svg>`,
      cone: `<svg viewBox="0 0 60 90" aria-hidden="true"><rect x="8" y="62" width="44" height="9" rx="3" fill="#E8590C"/><path d="M30 18 L46 62 H14Z" fill="#FF8A2A"/><path d="M24 35 H36 L39 45 H21Z" fill="#fff"/></svg>`
    };
    const { stage } = api; stage.classList.add("g-race");
    const kart = (c, inner) => `<svg viewBox="0 0 60 90" aria-hidden="true"><rect x="2" y="12" width="10" height="20" rx="4" fill="#222"/><rect x="48" y="12" width="10" height="20" rx="4" fill="#222"/><rect x="2" y="60" width="10" height="20" rx="4" fill="#222"/><rect x="48" y="60" width="10" height="20" rx="4" fill="#222"/><rect x="8" y="4" width="44" height="82" rx="18" fill="${c}"/><rect x="14" y="10" width="32" height="10" rx="5" fill="rgba(255,255,255,.55)"/>${inner || `<circle cx="30" cy="50" r="13" fill="rgba(0,0,0,.25)"/><circle cx="30" cy="48" r="10" fill="#fff"/><circle cx="26" cy="46" r="2.4" fill="#17203B"/><circle cx="34" cy="46" r="2.4" fill="#17203B"/>`}</svg>`;
    stage.innerHTML = `<div class="road" id="rRoad"><div class="lines"></div></div><div class="rpos" id="rPos"></div><div class="rcar me" id="rMe">${kart(api.kid.look.color, " ")}<div class="rmon">${api.monster()}</div></div>
      <button class="rbtn l" id="rL" aria-label="Move left">◀</button><button class="rbtn r" id="rR" aria-label="Move right">▶</button><p class="ghint">Tap ◀ ▶ or either side to change lanes</p>`;
    const road = stage.querySelector("#rRoad"), lines = road.firstElementChild, me = stage.querySelector("#rMe"), posEl = stage.querySelector("#rPos"), things = [];
    const RIVALS = 7; let lane = 1, px = 0, dist = 0, speed = 240, boost = 0, crash = 0, passed = 0, next = 1, coinNext = .6, W = 0, H = 0, RL = 0, LW = 0;
    const place = () => Math.max(1, RIVALS + 1 - passed), nth = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
    const showPos = () => { posEl.textContent = `🏁 ${nth(place())}`; };
    showPos();
    const move = (d) => { const nl = Math.max(0, Math.min(2, lane + d)); if (nl !== lane) { lane = nl; beep([[440 + lane * 110, .05, 0, "pluck"]], .3); } };
    stage.onpointerdown = (e) => { if (e.target.closest(".rbtn")) return; e.preventDefault(); const r = stage.getBoundingClientRect(); move(e.clientX - r.left < r.width / 2 ? -1 : 1); };
    stage.querySelector("#rL").onpointerdown = (e) => { e.preventDefault(); move(-1); };
    stage.querySelector("#rR").onpointerdown = (e) => { e.preventDefault(); move(1); };
    const kd = (e) => { if (e.key === "ArrowLeft") move(-1); else if (e.key === "ArrowRight") move(1); };
    addEventListener("keydown", kd); api.onStop(() => removeEventListener("keydown", kd));
    const laneX = (l) => RL + (l + .5) * LW;
    const spawn = (kind, l) => {
      const el = document.createElement("div"); el.className = "rthing rk-" + kind;
      if (kind === "rival") { const c = COLORS[Math.floor(Math.random() * COLORS.length)]; el.innerHTML = kart(c); }
      else el.innerHTML = RACE_ART[kind];
      stage.insertBefore(el, me); things.push({ el, kind, lane: l, y: -100, v: kind === "rival" ? 110 + Math.random() * 40 : 0 });
    };
    api.loop((dt) => {
      W = stage.clientWidth; H = stage.clientHeight; LW = Math.min(115, (W - 70) / 3); RL = (W - LW * 3) / 2;
      road.style.left = RL + "px"; road.style.width = LW * 3 + "px";
      const top = 260 + Math.min(200, api.elapsed * 5), target = crash > 0 ? 110 : boost > 0 ? top * 1.6 : top;
      speed += (target - speed) * Math.min(1, dt * (crash > 0 ? 8 : 2.5));
      if (boost > 0) boost -= dt; if (crash > 0) crash -= dt;
      dist += speed * dt; lines.style.backgroundPositionY = (dist % 120) + "px";
      me.classList.toggle("zoom", boost > 0);
      px += (laneX(lane) - px) * Math.min(1, dt * 14); if (!px) px = laneX(lane);
      const meY = H - 150; me.style.transform = `translate(${px - 30}px, ${meY}px)`;
      next -= dt; if (next <= 0) {
        const r = Math.random(), l = Math.floor(Math.random() * 3);
        spawn(r < .5 ? "rival" : api.toddler ? "coin" : "cone", l);
        // Every so often a second obstacle in another lane, but always leave a way through.
        if (api.elapsed > 15 && Math.random() < .35 && !api.toddler) spawn("cone", (l + 1 + Math.floor(Math.random() * 2)) % 3);
        next = Math.max(.7, 1.5 - api.elapsed / 50) + Math.random() * .5;
      }
      coinNext -= dt; if (coinNext <= 0) { spawn(Math.random() < .15 ? "boost" : "coin", Math.floor(Math.random() * 3)); coinNext = .9 + Math.random(); }
      for (let i = things.length - 1; i >= 0; i--) {
        const t = things[i]; t.y += (speed - t.v) * dt;
        t.el.style.transform = `translate(${laneX(t.lane) - 30}px, ${t.y}px)`;
        const near = Math.abs(laneX(t.lane) - px) < LW * .55, hitY = t.kind === "rival" ? 80 : 60;
        if (!t.done && near && t.y > meY - hitY && t.y < meY + 70) {
          t.done = true; const r = t.el.getBoundingClientRect();
          if (t.kind === "coin") { api.hit(1, r.left, r.top); beep([[1175, .07, 0, "pluck"]], .4); t.el.remove(); things.splice(i, 1); continue; }
          if (t.kind === "boost") { boost = 2.2; api.hit(2, r.left, r.top); beep([[523, .08, 0], [784, .08, .07], [1046, .14, .14]], .45); confetti(r.left + 20, r.top + 20, ["#FFD43B", "#fff", api.kid.look.color], 12); t.el.remove(); things.splice(i, 1); continue; }
          // A bump: spin, slow down, and a rival you bump gets back past you.
          crash = api.toddler ? .4 : .9; boost = 0; api.miss(r.left, r.top, "Bump!");
          me.classList.remove("oops"); void me.offsetWidth; me.classList.add("oops");
          if (t.kind === "rival" && !api.toddler) { passed = Math.max(0, passed - 1); showPos(); t.v = speed + 140; t.passedBy = false; }
          else { t.el.classList.add("knocked"); }
          continue;
        }
        if (t.kind === "rival" && !t.passedBy && t.y > meY + 80) { t.passedBy = true; passed++; showPos(); const mr = me.getBoundingClientRect(); api.hit(2, mr.left + 30, mr.top); if (passed === RIVALS) { beep([[784, .1, 0], [988, .1, .1], [1318, .2, .2]], .5); bigBurst(innerWidth / 2, innerHeight / 3, ["#FFD43B", api.kid.look.color, "#fff"]); speak("I'm in first place!", api.kid, true); } }
        if (t.y > H + 120 || t.y < -400) { t.el.remove(); things.splice(i, 1); }
      }
    });
    api.onEnd(() => `You finished ${nth(place())}!`);
  },
  jump(api) {
    const { stage } = api; stage.classList.add("g-jump");
    stage.innerHTML = `<div class="ground"></div><div class="jmon" id="jMon">${api.monster()}</div><p class="ghint">Tap to jump. Tap again in the air for a double jump!</p>`;
    const mon = stage.querySelector("#jMon"), things = [];
    let y = 0, vy = 0, jumps = 0, next = 1.1, coinNext = 2;
    const jump = (e) => { if (e) e.preventDefault(); if (y <= 0.5) jumps = 0; if (jumps < 2) { vy = jumps ? 560 : 640; jumps++; beep([[523 + jumps * 120, .06, 0, "pluck"]], .45); } };
    stage.onpointerdown = jump;
    api.loop((dt) => {
      const W = stage.clientWidth, H = stage.clientHeight, ground = H * .3, speed = 220 + Math.min(200, api.elapsed * 5);
      vy -= 1650 * dt; y = Math.max(0, y + vy * dt); if (y === 0) { vy = Math.max(vy, 0); jumps = 0; }
      mon.style.transform = `translateY(${-y}px)`;
      next -= dt; if (next <= 0) {
        const big = api.elapsed > 12 && Math.random() < .35, r = document.createElement("span"); r.className = "rock" + (big ? " big" : "");
        stage.appendChild(r); things.push({ el: r, x: W + 20, kind: "rock", h: big ? 52 : 32, hit: false, done: false });
        next = Math.max(.75, 1.5 - api.elapsed / 60) + Math.random() * 1.1;
      }
      coinNext -= dt; if (coinNext <= 0) {
        const c = document.createElement("span"), hy = 90 + Math.random() * 120; c.className = "coin2"; c.textContent = "🪙"; c.style.bottom = `calc(30% + ${hy}px)`;
        stage.appendChild(c); things.push({ el: c, x: W + 20, kind: "coin", hy }); coinNext = 1.6 + Math.random() * 1.6;
      }
      for (let i = things.length - 1; i >= 0; i--) {
        const t = things[i]; t.x -= speed * dt; t.el.style.transform = `translateX(${t.x}px)`;
        if (t.kind === "rock") {
          if (!t.hit && !t.done && t.x < 110 && t.x > 40 - (t.h > 40 ? 10 : 0) && y < t.h) { t.hit = true; api.miss(); mon.classList.remove("oops"); void mon.offsetWidth; mon.classList.add("oops"); }
          if (!t.done && t.x < 30) { t.done = true; if (!t.hit) { const r = mon.getBoundingClientRect(); api.hit(t.h > 40 ? 2 : 1, r.left + 45, r.top); beep([[880, .07, 0, "pluck"]], .35); } }
        } else if (!t.got && t.x < 120 && t.x > 30 && Math.abs(y + 45 - t.hy) < 50) {
          t.got = true; const r = t.el.getBoundingClientRect(); api.hit(3, r.left, r.top); beep([[1175, .08, 0, "pluck"], [1568, .1, .06, "pluck"]], .45); t.el.remove(); things.splice(i, 1); continue;
        }
        if (t.x < -70) { t.el.remove(); things.splice(i, 1); }
      }
    });
  },
  copy(api) {
    const { stage } = api; stage.classList.add("g-copy");
    const PADS = [["#E63946", 262], ["#3D7BFF", 330], ["#FFD43B", 392], ["#4CBF5A", 523]];
    stage.innerHTML = `<div class="cmon"><div class="m">${api.monster()}</div><div class="bubble csay" id="cSay">Watch me!</div></div><div class="pads">${PADS.map(([c], i) => `<button class="pad" data-i="${i}" style="--pc:${c}" aria-label="Drum ${i + 1}"></button>`).join("")}</div>`;
    const pads = [...stage.querySelectorAll(".pad")], say = stage.querySelector("#cSay");
    let seq = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)], pos = 0, listening = false, tries = 0;
    const hit = (i, len) => { const p = pads[i]; p.classList.add("lit"); beep([[PADS[i][1], len || .3, 0]], .55); api.after(260, () => p.classList.remove("lit")); };
    // The pattern plays a little faster as it gets longer.
    const play = () => { listening = false; say.textContent = `Watch me! ${seq.length} beats`; const gap = Math.max(380, 640 - seq.length * 30); seq.forEach((i, k) => api.after(600 + k * gap, () => hit(i, .22))); api.after(600 + seq.length * gap, () => { listening = true; pos = 0; say.textContent = "Your turn!"; speak("Your turn!", api.kid, true); }); };
    pads.forEach((p, i) => p.onpointerdown = (e) => {
      e.preventDefault(); if (!listening) return; hit(i);
      const rc = p.getBoundingClientRect();
      if (i !== seq[pos]) {
        listening = false; tries++; api.miss(rc.left + rc.width / 2, rc.top, "Oops");
        // Two misses on the same pattern starts a fresh, shorter one so nobody gets stuck.
        if (tries >= 2 && seq.length > 2) { seq = seq.slice(0, Math.max(2, seq.length - 2)); tries = 0; say.textContent = "Let's try a shorter one."; }
        else say.textContent = "Listen again!";
        speak(say.textContent, api.kid, true);
        return api.after(1500, play);
      }
      pos++; api.hit(1, rc.left + rc.width / 2, rc.top);
      if (pos === seq.length) {
        listening = false; tries = 0; api.add(seq.length); floatPts(stage, innerWidth / 2, innerHeight / 2, `Pattern +${seq.length}`, true);
        say.textContent = "Yes! One more beat…"; speak("Yes! One more!", api.kid, true); confetti(innerWidth / 2, innerHeight / 2, PADS.map((x) => x[0]), 18);
        seq.push(Math.floor(Math.random() * 4)); api.after(1500, play);
      }
    });
    api.after(1600, play);
  }
};

/* ---------- trophies ---------- */
const TIERS = ["bronze", "silver", "gold", "ruby"];
const SKILL_STEPS = [[10, "bronze"], [25, "silver"], [50, "gold"]];
const COLLECT_STEPS = [[3, "bronze", "Collector"], [10, "silver", "Super collector"], [SHOP.length, "gold", "Collected everything"]];
// Works out every trophy, medal and badge for a child, with the moment each was won.
function trophiesFor(kid) {
  const mine = S.awards.filter((a) => a.kid === kid.id).sort((a, b) => a.at - b.at);
  const ms = milestonesOf(kid), behs = (kid.behaviours || []).concat([BONUS]);
  const won = {}; let earned = 0; const counts = {}; const owned = new Set(); const given = {};
  for (const a of mine) {
    if (a.kind === "earn") {
      earned += a.pts || 0; counts[a.bid] = (counts[a.bid] || 0) + 1;
      ms.forEach((m) => { if (earned >= m.at && !won["g:" + m.id]) won["g:" + m.id] = a.at; });
      LEVELS.forEach((lv, i) => { if (i && earned >= lv && !won["l:" + (i + 1)]) won["l:" + (i + 1)] = a.at; });
      SKILL_STEPS.forEach(([n]) => { if (counts[a.bid] >= n && !won["s:" + a.bid + ":" + n]) won["s:" + a.bid + ":" + n] = a.at; });
    } else if (a.kind === "buy" && a.item && SHOP.some((i) => i.id === a.item)) {
      owned.add(a.item);
      COLLECT_STEPS.forEach(([n]) => { if (owned.size >= n && !won["c:" + n]) won["c:" + n] = a.at; });
    } else if (a.kind === "given") given[a.mid] = a.at;
  }
  const list = [];
  ms.forEach((m, i) => list.push({ id: "g:" + m.id, group: "goal", tier: TIERS[Math.min(i, 3)], name: m.label, icon: m.icon || "🎁", need: `${m.at} Dojos earned`, at: won["g:" + m.id], m, given: given[m.id] }));
  LEVELS.forEach((lv, i) => { if (i) list.push({ id: "l:" + (i + 1), group: "level", tier: TIERS[Math.min(i - 1, 3)], name: `Level ${i + 1} monster`, n: i + 1, need: `${lv} points earned`, at: won["l:" + (i + 1)] }); });
  behs.forEach((b) => {
    const c = counts[b.id] || 0;
    SKILL_STEPS.forEach(([n, tier], si) => {
      const id = "s:" + b.id + ":" + n, got = !!won[id];
      const prevGot = si === 0 || won["s:" + b.id + ":" + SKILL_STEPS[si - 1][0]];
      if (got || prevGot) list.push({ id, group: "skill", tier, name: `${b.label} ×${n}`, icon: b.icon, need: `${b.label} ${n} times (${Math.min(c, n)} so far)`, at: won[id] });
    });
  });
  COLLECT_STEPS.forEach(([n, tier, name]) => list.push({ id: "c:" + n, group: "collect", tier, name, icon: "🛍️", need: `Own ${n} shop items (${owned.size} so far)`, at: won["c:" + n] }));
  return list;
}
function trophyArt(t, locked) {
  if (t.group === "goal") return trophySvg(t.tier, locked, t.icon);
  if (t.group === "level") return medalSvg(t.n, t.tier, locked);
  return badgeSvg(t.icon, t.tier, locked);
}
function shelfArt(kid) {
  const all = trophiesFor(kid); const byId = Object.fromEntries(all.map((t) => [t.id, t]));
  return (kid.shelf || []).map((id) => byId[id]).filter((t) => t && t.at).map((t) => trophyArt(t, false));
}
function openTrophy(kid, t) {
  const locked = !t.at, onShelf = (kid.shelf || []).includes(t.id);
  const when = t.at ? new Date(t.at).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" }) : "";
  modal(`<div style="width:150px;height:150px;margin:0 auto">${trophyArt(t, locked)}</div><h2>${esc(locked ? "Still to win" : t.name)}</h2>
    <p class="meta" style="margin:0">${locked ? `${t.group === "goal" ? esc(t.icon + " " + t.name) + ". " : ""}Win it with ${esc(t.need)}.` : `Won on ${esc(when)}.`}</p>
    ${!locked && t.group === "goal" ? `<p class="meta" style="margin:0">${t.given ? "Reward given ✓" : "Reward not given yet."}</p>` : ""}
    <div class="row" style="justify-content:center">
      ${!locked ? `<button class="btn ${onShelf ? "ghost" : "kid"}" style="--kid:${esc(kid.look.color)}" id="shelfBtn">${onShelf ? "Take off my shelf" : "Put on my shelf"}</button>` : ""}
      ${!locked && t.group === "goal" && !t.given && isAdmin() ? `<button class="btn" id="givenBtn">Mark given</button>` : ""}
      <button class="btn ghost" id="ok">Close</button></div>`, () => {
    $("#ok").onclick = closeModal;
    const sb2 = $("#shelfBtn");
    if (sb2) sb2.onclick = () => {
      let shelf = (kid.shelf || []).filter((x) => x !== t.id);
      if (!onShelf) { shelf.push(t.id); if (shelf.length > 3) { shelf = shelf.slice(-3); toast("Your shelf holds 3, so the oldest one moved back to the case."); } }
      closeModal(); setMonster(kid, { shelf });
    };
    const gb = $("#givenBtn"); if (gb) gb.onclick = () => { closeModal(); markGiven(kid, t.m); };
  });
}
function celebrateBadge(kid, t) {
  SND.goal(); bigBurst(innerWidth / 2, innerHeight / 3, ["#FFD43B", "#3D7BFF", kid.look.color, "#fff"]);
  modal(`<div style="width:140px;height:140px;margin:0 auto">${trophyArt(t, false)}</div><h2>New ${t.group === "collect" ? "badge" : "skill badge"}!</h2><p style="font-family:var(--font-display);font-size:20px;margin:0">${esc(t.name)}</p><p class="meta">It's in the Trophies case. Put your favourites on your shelf.</p><button class="btn primary" data-autofocus id="ok">Amazing!</button>`, () => { $("#ok").onclick = closeModal; });
}
const wonIds = (kid) => new Set(trophiesFor(kid).filter((t) => t.at).map((t) => t.id));

/* ---------- views ---------- */
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; }
function fmtWhen(ts) {
  const d = new Date(ts), now = new Date(); const sameDay = d.toDateString() === now.toDateString();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? t : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) + ", " + t;
}

function viewNoSetup() {
  return `<div class="auth"><div class="m">${monsterSvg({ shape: "round", color: COLORS[0], eyes: 2, top: "horns" }, {}, 1)}</div>
    <h1>Almost ready</h1><p class="lead">This copy of Home Dojo isn't connected to a database yet, so it can't share points between phones.</p>
    <div class="note">If you're setting it up, follow the steps in the README: add your Supabase Project URL and anon key to <b>config.js</b>.</div>
    <button class="btn primary" id="tryLocal">Try it on this device only</button></div>`;
}
function viewSignIn() {
  const t = S.authTab;
  return `<div class="auth"><div class="m">${monsterSvg({ shape: "tall", color: COLORS[1], eyes: 1, top: "ears" }, {}, 1)}</div>
    <h1>${inviteFromLink ? `${INVITE.from ? esc(INVITE.from) + " invited you!" : "You're invited!"}` : "Home Dojo"}</h1>
    ${inviteFromLink ? `<div class="card invitebox"><p style="margin:0">Join ${INVITE.fam ? `<b>${esc(INVITE.fam)}</b>` : "the family"} on Home Dojo Monsters, where the kids earn Dojos for great behaviour and grow their monsters.</p>
      <ol><li><b>Create account</b> below with your name, email and a password.</li><li>If an email arrives, tap the link in it to confirm.</li><li>You'll join the family automatically. That's it!</li></ol>
      <p class="meta" style="margin:0">Already have an account? Tap Sign in instead.</p></div>` : `<p class="lead">Points for good behaviour, with monsters that grow.</p>`}
    <div class="seg2"><button data-auth="signin" aria-pressed="${t === "signin"}">Sign in</button><button data-auth="signup" aria-pressed="${t === "signup"}">Create account</button></div>
    <form id="authForm" class="card" novalidate>
      ${t === "signup" ? `<label class="field">Your name (as the kids call you)<input id="aName" autocomplete="nickname" placeholder="e.g. Mum, Dad, Nana" required></label>` : ""}
      <label class="field">Email<input id="aEmail" type="email" autocomplete="email" inputmode="email" required></label>
      <label class="field">Password<input id="aPass" type="password" autocomplete="${t === "signup" ? "new-password" : "current-password"}" minlength="8" required></label>
      <p class="err" id="aErr" hidden></p>
      <button class="btn primary" type="submit">${t === "signup" ? "Create account" : "Sign in"}</button>
      ${t === "signin" ? `<button type="button" class="linkbtn" id="forgot">Forgot password?</button>` : ""}
    </form></div>`;
}
function viewNoFamily() {
  const name = (S.user && S.user.user_metadata && S.user.user_metadata.name) || "";
  return `<div class="auth"><h1>Join your family</h1>
    <form class="card" id="joinForm"><h3 style="font-size:19px">I have an invite code</h3>
      <label class="field">Invite code<input id="jCode" value="${esc(inviteFromLink)}" autocapitalize="characters" autocomplete="off" placeholder="8 letters and numbers" required></label>
      <label class="field">Your name (as the kids call you)<input id="jName" value="${esc(name)}" required></label>
      <p class="err" id="jErr" hidden></p><button class="btn primary" type="submit">Join family</button></form>
    <form class="card" id="newForm"><h3 style="font-size:19px">Start a new family</h3><p class="meta" style="margin:0">For the first parent. You can invite everyone else afterwards.</p>
      <label class="field">Family name<input id="nFam" placeholder="e.g. The Tan family" required></label>
      <label class="field">Your name (as the kids call you)<input id="nName" value="${esc(name)}" required></label>
      <p class="err" id="nErr" hidden></p><button class="btn" type="submit">Create family</button></form>
    <button class="linkbtn" id="signOut">Sign out</button></div>`;
}
function viewSetup() {
  if (!isAdmin()) return `<div class="empty"><div class="m" style="width:140px;height:140px;margin:0 auto">${monsterSvg({ shape: "wide", color: COLORS[2], eyes: 3, top: "antenna" }, {}, 1)}</div><p>Waiting for a parent to set up the monsters.</p></div>`;
  return `<div class="card"><h1 style="font-size:28px">Set up your monsters</h1><p class="meta" style="margin:0">Add each child. You can change everything later in settings.</p>
    <div class="list">${[0, 1, 2].map((i) => `<div class="row"><input class="inp" style="flex:2;min-width:140px" id="sName${i}" placeholder="Child ${i + 1} name"><input class="inp" style="flex:1;min-width:80px" id="sAge${i}" type="number" min="1" max="16" placeholder="Age"></div>`).join("")}</div>
    <button class="btn primary" id="setupGo">Create monsters</button>
    <button class="linkbtn" id="setupRestore">Moving from the old app? Restore a backup file instead</button></div>`;
}
function viewHome() {
  const kids = S.cfg.kids || [];
  const last = lget("hd.lastBackup", 0);
  const nudge = isAdmin() && S.mode === "cloud" && S.awards.length > 20 && Date.now() - last > 30 * 864e5;
  return `${viewLobby()}${viewTeam()}<div class="kids">${kids.map((k) => {
    const st = stats(k.id), ms = milestonesOf(k).find((m) => st.earned < m.at);
    const pct = ms ? Math.round(100 * st.earned / ms.at) : 100;
    return `<button class="kidcard" data-kid="${esc(k.id)}" style="--kid:${esc(k.look.color)}" aria-label="Open ${esc(k.name)}">
      <div class="m">${monsterSvg(k.look, dressedFor(k), st.level)}</div>
      <div class="stack"><h2>${esc(k.name)} ${streakChip(k.id)}</h2>${wallet(st, true)}
      ${ms ? `<div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div><div class="meta">${ms.at - st.earned} to ${esc(ms.icon || "🎁")} ${esc(ms.label)}</div>` : `<div class="meta">Level ${st.level} monster</div>`}</div>
    </button>`;
  }).join("")}</div>
  <div class="list" style="margin-top:18px">
  ${kidsMode() ? "" : `<button class="btn ghost" id="guideBtn" style="justify-self:start">📖 Carers' guide: how and when to give Dojos</button>`}
  ${nudge ? `<div class="note row" style="justify-content:space-between"><span>It's been a while since your last backup.</span><button class="btn small primary" id="nudgeBackup">Back up now</button></div>` : ""}
  ${S.mode === "local" && !HOST ? `<p class="note">Try-it-out mode: points are saved on this device only.</p>` : ""}
  ${installHelp()}</div>`;
}

function viewKid(kid, tab) {
  if (kidsMode() && (tab === "earn" || tab === "admin")) tab = S.route.tab = "monster";
  if (isToddler(kid) && !S.route.full) return viewToddler(kid);
  const st = stats(kid.id);
  const toNext = st.next != null ? st.next - st.earned : 0;
  const pct = st.next != null ? Math.round(100 * (st.earned - st.prev) / (st.next - st.prev)) : 100;
  let body = "";
  if (tab === "earn") {
    const bs = (kid.behaviours || []).concat([BONUS]);
    const today = new Date().setHours(0, 0, 0, 0);
    body = `<div class="grid">${bs.map((b) => {
      const n = S.awards.filter((a) => a.kid === kid.id && a.kind === "earn" && a.bid === b.id && a.at >= today).length;
      return `<button class="beh${b.id === "bonus" ? " bonus" : ""}" data-beh="${esc(b.id)}"><span class="e" aria-hidden="true">${esc(b.icon)}</span><span class="l">${esc(b.label)}</span><span class="c">${n ? `${n} today` : "+1"}</span></button>`;
    }).join("")}</div>
    <p class="note" style="margin-top:16px">Tap straight away, and say what you saw: "You took big breaths when you were cross. That's a Calm body point!"</p>`;
  } else if (tab === "shop") {
    const owned = st.owned, eq = wornBy(kid);
    const tierChip = (cost) => { const [, k, label] = priceTier(cost); return `<span class="ptier ${k}">${label}</span>`; };
    body = `<div class="tiers-key">${PRICE_TIERS.map(([, k, label], i) => `<span class="ptier ${k}">${label}</span><small>${["about a day", "a few days", "a week or more", "a big goal"][i]}</small>`).join("")}</div>` +
    SLOTS.map(([slot, title]) => `<div class="sect"><h3>${secTitle(title)}</h3></div><div class="grid">${SHOP.filter((i) => i.slot === slot).sort((a, b) => a.cost - b.cost).map((i) => {
      const has = owned.has(i.id), on = eq[slot] === i.id;
      const prev = Object.assign({}, eq, { [slot]: i.id });
      const action = has ? `<button class="btn small ${on ? "ghost" : "kid"}" data-wear="${i.id}">${on ? "Take off" : "Wear"}</button>`
        : `<button class="btn small kid" data-buy="${i.id}" ${st.balance < i.cost ? "disabled" : ""}>${coin(i.cost)}</button>`;
      return `<div class="item${on ? " on" : ""}">${has ? "" : tierChip(i.cost)}<div class="m${slot === "pet" ? " pet-big" : ""}">${slot === "pet" ? `<svg viewBox="-32 -30 64 62" aria-hidden="true"><ellipse cx="0" cy="26" rx="22" ry="4" fill="rgba(0,0,0,.12)"/>${petSvg(i.id)}</svg>` : monsterSvg(kid.look, prev, st.level)}</div><div class="n">${esc(i.name)}</div>${action}</div>`;
    }).join("")}</div>`).join("") +
    (() => {
      const tier = houseTier(owned);
      return `<div class="sect"><h3>🏡 Houses</h3><p>Now: ${esc(HOUSE[tier].name)}. Tap one to look inside</p></div><div class="grid">` +
        HOUSE.map((h, i) => {
          const status = i === tier ? `<span class="pill ready">Your house</span>`
            : i < tier ? `<span class="pill given">Lived here ✓</span>`
            : `<button class="btn small kid" data-house="${h.id}" ${st.balance < h.cost ? "disabled" : ""}>${coin(h.cost)}</button>`;
          return `<div class="item${i === tier ? " on" : ""}">${i > tier ? tierChip(h.cost) : ""}<button class="m house-out" data-peek="${i}" aria-label="Look inside the ${esc(h.name)}"><svg viewBox="-12 -8 144 126" aria-hidden="true"><rect x="-12" y="-8" width="144" height="126" fill="#BDE6FF"/><rect x="-12" y="104" width="144" height="14" fill="#7CC95A"/>${houseOutsideSvg(i, kid.look.color)}</svg></button><div class="n">${esc(h.name)}</div>${i > tier && st.balance < h.cost ? `<div class="meta">${h.cost - st.balance} more Dojo $</div>` : ""}${status}</div>`;
        }).join("") + `</div><div class="sect"><h3>🛋️ Furniture</h3><p>For the ${esc(HOUSE[tier].name.toLowerCase())}</p></div><div class="grid">` +
        FURNI.slice().sort((a, b) => a.cost - b.cost).map((f) => { const has = owned.has(f.id);
          return `<div class="item${has ? " on" : ""}">${has ? "" : tierChip(f.cost)}<div class="m furni-big">${furniCloseup(f.id, tier)}</div><div class="n">${esc(f.name)}</div>${has ? `<span class="pill given">In the house ✓</span>` : `<button class="btn small kid" data-furni="${f.id}" ${st.balance < f.cost ? "disabled" : ""}>${coin(f.cost)}</button>`}</div>`; }).join("") + `</div>`;
    })() +
    (isl() ? isl().shopHtml(kid, st) : "") +
    `<div class="sect"><h3>🍦 Treats</h3><p>Real-world rewards${isAdmin() ? "" : ". A parent spends these"}</p></div>
    ${(kid.rewards || []).length ? `<div class="list">${kid.rewards.map((t) => `<div class="treat"><span class="e" aria-hidden="true">${esc(t.icon || "🎁")}</span><div class="t"><b>${esc(t.label)}</b><span class="meta">${coin(t.cost)} Dojo $</span></div>${isAdmin() ? `<button class="btn small kid" data-treat="${esc(t.id)}" ${st.balance < t.cost ? "disabled" : ""}>Spend</button>` : ""}</div>`).join("")}</div>` : `<div class="empty">No treats yet. A parent can add some in settings.</div>`}`;
  } else if (tab === "games" && (gameCfg().on || adminPlay())) {
    body = viewGames(kid, st);
  } else if (tab === "admin" && adminPlay()) {
    body = viewAdminKid(kid, st);
  } else if (tab === "trophies") {
    const ms = milestonesOf(kid), nx = ms.find((m) => st.earned < m.at);
    const all = trophiesFor(kid), shelf = (kid.shelf || []).map((id) => all.find((t) => t.id === id)).filter((t) => t && t.at);
    const tile = (t) => `<button class="trophy${t.at ? "" : " locked"}" data-trophy="${esc(t.id)}"><div class="art">${trophyArt(t, !t.at)}</div><div class="n">${esc(t.at || t.group !== "goal" ? t.name : t.name)}</div><div class="d">${t.at ? (t.group === "goal" ? (t.given ? "Given ✓" : "Ready!") : new Date(t.at).toLocaleDateString([], { day: "numeric", month: "short" })) : esc(t.group === "goal" ? (t.m.at - st.earned) + " to go" : "Keep going")}</div></button>`;
    const group = (g, title, note) => { const items = all.filter((t) => t.group === g); return items.length ? `<div class="sect"><h3>${secTitle(title)}</h3>${note ? `<p>${note}</p>` : ""}</div><div class="case">${items.map(tile).join("")}</div>` : ""; };
    const treats = S.awards.filter((a) => a.kid === kid.id && a.kind === "spend" && a.bid !== "admin").slice().reverse();
    body = (nx ? `<div class="goal"><div class="meta">Next big reward</div><div class="big">${esc(nx.icon || "🎁")} ${esc(nx.label)}</div><div class="bar"><i style="width:${Math.round(100 * st.earned / nx.at)}%"></i></div><div class="meta"><b class="price" style="color:var(--ink)">${st.earned}</b> of ${nx.at} Dojos earned. ${nx.at - st.earned} to go!</div><div class="meta">Spending Dojo $ in the shop never moves you backwards here.</div></div>`
      : ms.length ? `<div class="goal"><div class="big">All reward goals won! 🎉</div><div class="meta">A parent can add new goals in settings.</div></div>` : "") +
      `<div class="sect"><h3>⭐ My shelf</h3><p>Tap a trophy to show it off here and in the house</p></div>
      <div class="shelfbig">${shelf.length ? shelf.map(tile).join("") : `<p class="meta" style="margin:0">Nothing on the shelf yet. Tap any trophy you've won and choose "Put on my shelf".</p>`}</div>` +
      group("goal", "Reward trophies", "Won by earning Dojos") +
      group("level", "Monster medals", "") +
      group("skill", "Skill badges", "Won by doing the same great thing again and again") +
      group("collect", "Collector badges", "") + viewStickerBook(kid) +
      (treats.length ? `<div class="sect"><h3>🍦 Treats enjoyed</h3></div><div class="log">${treats.slice(0, 30).map((a) => `<div class="logrow"><span aria-hidden="true">${esc(a.icon || "🎁")}</span><div class="t">${esc(a.label)}<div class="when">${fmtWhen(a.at)}</div></div></div>`).join("")}</div>` : "");
  } else if (tab === "monster") {
    const sub = S.route.sub || "house", eq = wornBy(kid), lk = kid.look || {};
    const subnav = `<div class="seg2" style="margin-bottom:14px">${[["house", "House", "🏠"], ["island", "Island", "🏝️"], ["wardrobe", "Wardrobe", "👕"], ["make", "Make", "🎨"]].filter((x) => x[0] !== "island" || isl()).map(([id, l, ic]) => `<button data-sub="${id}" aria-pressed="${sub === id}"><span aria-hidden="true">${ic}</span> ${l}</button>`).join("")}</div>`;
    if (sub === "house") {
      const tier = houseTier(st.owned), nextT = HOUSE[tier + 1];
      const furn = FURNI.filter((f) => st.owned.has(f.id)).length;
      body = subnav + `<div class="house" id="houseScene">${houseSvg({ tier, owned: st.owned, look: lk, equip: eq, level: st.level, shelf: shelfArt(kid) })}</div>
        <div class="row" style="justify-content:space-between;margin-top:10px"><b style="font-family:var(--font-display);font-size:20px">${esc(kid.monsterName || kid.name + "'s monster")}'s ${esc(HOUSE[tier].name.toLowerCase())}</b><span class="meta">${furn} of ${FURNI.length} furniture</span></div>
        <p class="note">Tap a hat, outfit, poster, paint pot or pet in the house to put it on. ${nextT ? `Next upgrade: the ${esc(nextT.name)} for ${nextT.cost} Dojo $, in the Shop.` : "This is the biggest house there is!"}</p>`;
    } else if (sub === "island" && isl()) {
      body = subnav + isl().kidCard(kid);
    } else if (sub === "wardrobe") {
      const ownedItems = SHOP.filter((i) => st.owned.has(i.id));
      body = subnav + (ownedItems.length ? SLOTS.map(([slot, title]) => {
        const mine = SHOP.filter((i) => i.slot === slot && st.owned.has(i.id)), total = SHOP.filter((i) => i.slot === slot).length;
        if (!mine.length) return "";
        return `<div class="sect"><h3>${secTitle(title)}</h3><p>${mine.length} of ${total}</p></div><div class="grid">${mine.map((i) => {
          const on = eq[slot] === i.id, prev = Object.assign({}, eq, { [slot]: on ? null : i.id });
          return `<button class="item${on ? " on" : ""}" data-wear="${i.id}" aria-pressed="${on}"><div class="m">${monsterSvg(lk, Object.assign({}, eq, { [slot]: i.id }), st.level)}</div><div class="n">${esc(i.name)}</div><span class="pill ${on ? "ready" : "locked"}">${on ? "Wearing" : "Tap to wear"}</span></button>`;
        }).join("")}</div>`;
      }).join("") : `<div class="empty">Nothing in the wardrobe yet.<br>Buy hats, outfits and pets in the Shop with your Dojo $.</div><div class="row" style="justify-content:center"><button class="btn kid" data-tab="shop">Go to the Shop</button></div>`);
    } else {
      const opt = (field, val, label, extra) => `<button aria-pressed="${(lk[field] || (field === "species" ? "monster" : field === "mouth" ? "smile" : null)) === val}" data-look="${field}" data-v="${val}">${extra || ""}${label}</button>`;
      const mini = (patch) => `<span class="mini">${monsterSvg(Object.assign({}, lk, patch), {}, 1)}</span>`;
      body = subnav + `<div class="card make">
        <div class="studio" aria-live="polite"><div class="m" id="studioMonster">${monsterSvg(lk, eq, st.level)}</div><div class="studio-name" id="studioName">${esc(kid.monsterName || "My monster")}</div></div>
        <label class="field">My monster's name<input id="monName" maxlength="24" value="${esc(kid.monsterName || "")}" placeholder="e.g. Zap, Bubbles, Captain Fluff"></label>
        <div><div class="meta" style="font-weight:700;margin-bottom:6px">Character</div><div class="seg pick">${SPECIES.map(([v, l]) => opt("species", v, l, mini({ species: v }))).join("")}</div></div>
        <div><div class="meta" style="font-weight:700;margin-bottom:6px">Colour</div><div class="swatches">${COLORS.concat(prizesOf(kid).colours.filter((c) => !COLORS.includes(c))).map((c) => `<button class="sw${COLORS.includes(c) ? "" : " rare"}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${lk.color === c}" data-look="color" data-v="${c}"></button>`).join("")}</div></div>
        ${lk.species === "robot" ? "" : `<div><div class="meta" style="font-weight:700;margin-bottom:6px">Body</div><div class="seg">${SHAPES.map(([v, l]) => opt("shape", v, l)).join("")}</div></div>`}
        <div><div class="meta" style="font-weight:700;margin-bottom:6px">Eyes</div><div class="seg">${[1, 2, 3].map((v) => `<button aria-pressed="${(lk.eyes || 2) === v}" data-look="eyes" data-v="${v}">${v} ${v === 1 ? "eye" : "eyes"}</button>`).join("")}</div></div>
        ${lk.species === "robot" ? "" : `<div><div class="meta" style="font-weight:700;margin-bottom:6px">On top</div><div class="seg">${TOPS.map(([v, l]) => opt("top", v, l)).join("")}</div></div>`}
        <div><div class="meta" style="font-weight:700;margin-bottom:6px">Mouth</div><div class="seg">${MOUTHS.map(([v, l]) => opt("mouth", v, l)).join("")}</div></div>
        <button class="btn kid" id="surprise">🎲 Surprise me!</button></div>`;
    }
  } else {
    const ws = weekStart(new Date()).getTime();
    const wk = S.awards.filter((a) => a.kid === kid.id && a.kind === "earn" && a.at >= ws);
    const counts = {}; wk.forEach((a) => { counts[a.label] = (counts[a.label] || 0) + (a.pts || 1); });
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...rows.map((r) => r[1]));
    const days = Array.from({ length: 7 }, (_, i) => { const s = ws + i * 864e5, e = s + 864e5; return { d: new Date(s), n: wk.filter((a) => a.at >= s && a.at < e).length, today: Date.now() >= s && Date.now() < e }; });
    const recent = S.awards.filter((a) => a.kid === kid.id).slice(-30).reverse();
    body = `<div class="wk"><div class="row" style="justify-content:space-between"><h3>This week</h3><span class="bal" style="font-size:26px">${wk.length}<span>Dojos</span></span></div>
      <div class="days">${days.map((d) => `<div class="d${d.today ? " today" : ""}">${d.d.toLocaleDateString([], { weekday: "short" })}<b>${d.n}</b></div>`).join("")}</div>
      ${rows.length ? rows.map(([l, n]) => `<div class="wkrow"><span>${esc(l)}</span><div class="bar"><i style="width:${Math.round(100 * n / max)}%"></i></div><b>${n}</b></div>`).join("") : `<div class="meta">No points yet this week.</div>`}
      ${rows.length ? `<div class="note">Praise the pattern: "You were ${esc(rows[0][0].toLowerCase())} ${rows[0][1]} ${rows[0][1] === 1 ? "time" : "times"} this week!"</div>` : ""}</div>
      <div class="sect"><h3>🕘 Recent</h3></div>
      ${recent.length ? `<div class="log">${recent.map((a) => {
        const who = a.by && S.mode === "cloud" ? memberName(a.by) : "";
        return `<div class="logrow"><span aria-hidden="true">${esc(a.icon || "•")}</span><div class="t">${esc(a.kind === "buy" ? "Bought " + a.label : a.kind === "spend" && a.bid !== "admin" ? "Treat: " + a.label : a.kind === "given" ? "Reward given: " + a.label : a.label)}<div class="when">${fmtWhen(a.at)}${who ? ` <span class="by">· ${esc(who)}</span>` : ""}</div></div>${(() => { const d = a.kind === "given" ? 0 : a.kind === "earn" ? a.pts : -a.pts; return `<span class="p${d < 0 ? " neg" : ""}">${d ? (d > 0 ? "+" : "−") + Math.abs(d) + (a.kind === "spend" && a.bid === "admin" ? " $" : "") : ""}</span>`; })()}${canDelete(a) ? `<button class="x" data-del="${esc(a.id)}" aria-label="Remove this entry">✕</button>` : ""}</div>`;
      }).join("")}</div>` : `<div class="empty">Nothing here yet.</div>`}`;
  }
  return `<div style="--kid:${esc(kid.look.color)}">
    <div class="row" style="margin-bottom:10px;justify-content:space-between"><button class="iconbtn" id="backBtn" aria-label="Back to all monsters">← All monsters</button>${isToddler(kid) ? `<button class="btn small ghost" id="toddlerView">Toddler view</button>` : ""}</div>
    <section class="hero"><div class="m" id="heroMonster" role="button" tabindex="0" aria-label="Talk to the monster">${monsterSvg(kid.look, dressedFor(kid), st.level)}</div>
      <div class="stack"><h1>${esc(kid.name)}</h1>${wallet(st)}
      <div class="row" style="gap:8px"><span class="lvl">Level ${st.level}</span>${streakChip(kid.id)}${kid.monsterName ? `<span class="meta">${esc(kid.monsterName)}</span>` : ""}</div>
      ${(() => { const sh = shelfArt(kid); return sh.length ? `<div class="minishelf">${sh.map((a) => `<span>${a}</span>`).join("")}</div>` : ""; })()}
      ${st.next != null ? `<div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div><div class="meta">${toNext} more ${toNext === 1 ? "Dojo" : "Dojos"} to level ${st.level + 1}</div>` : `<div class="meta">Top level reached!</div>`}</div></section>
    <nav class="tabs" role="tablist">${[].concat(kidsMode() ? [] : [["earn", "Earn", "⭐"]]).concat([["shop", "Shop", "🛍️"], ["monster", "Monster", "👾"], ["trophies", "Trophies", "🏆"]]).concat(gameCfg().on || adminPlay() ? [["games", "Play", "🎮"]] : []).concat([["week", "Week", "📅"]]).concat(adminPlay() ? [["admin", "Admin", "🛠"]] : []).map(([id, l, ic]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}"><span class="ti" aria-hidden="true">${ic}</span>${l}</button>`).join("")}</nav>
    ${body}</div>`;
}

function starterKid(name, age, i) {
  const little = age < 4;
  const bs = LIB.filter((b) => b.star && (b.for === (little ? "little" : "big"))).map(({ id, icon, label }) => ({ id, icon, label }));
  const r = () => uid();
  return {
    id: r(), name, age,
    look: { species: "monster", shape: ["round", "tall", "wide"][i % 3], color: COLORS[(i * 3) % 8], eyes: little ? 1 : 2, top: little ? "ears" : "horns", mouth: "smile" }, monsterName: "", shelf: [],
    equip: {}, behaviours: bs,
    rewards: little ? [{ id: r(), icon: "⭐", label: "Sticker", cost: 1 }, { id: r(), icon: "🎵", label: "Pick a song to dance to", cost: 3 }, { id: r(), icon: "📚", label: "Extra story", cost: 5 }]
      : [{ id: r(), icon: "📖", label: "Pick tonight's story", cost: 5 }, { id: r(), icon: "🍨", label: "Choose dessert", cost: 5 }, { id: r(), icon: "🎬", label: "Pick the family film", cost: 15 }, { id: r(), icon: "🎡", label: "Trip out", cost: 40 }],
    milestones: little ? [{ id: r(), at: 10, icon: "🫧", label: "Bubbles in the garden" }, { id: r(), at: 30, icon: "🧸", label: "New small toy" }]
      : [{ id: r(), at: 25, icon: "🛝", label: "Park trip with ice cream" }, { id: r(), at: 75, icon: "🧱", label: "New Lego set" }, { id: r(), at: 150, icon: "🎢", label: "Special day out" }]
  };
}

function famCard() {
  const me = S.members.find((m) => S.user && m.user_id === S.user.id);
  const admin = isAdmin();
  if (S.mode !== "cloud") return "";
  return `<section class="card"><h3 style="font-size:19px">${esc(S.family.name)}</h3>
      <label class="field">Your name (as the kids call you)<input id="myName" value="${esc(me ? me.display_name : "")}"></label>
      <div><div class="meta" style="font-weight:700">Who's in the family</div>${S.members.map((m) => `<div class="member"><div class="t"><b>${esc(m.display_name || "Someone")}${S.user && m.user_id === S.user.id ? " (you)" : ""}</b></div><span class="pill role">${m.role === "admin" ? "Parent" : "Carer"}</span>${admin && S.user && m.user_id !== S.user.id ? `<button class="x" data-rmmember="${esc(m.user_id)}" aria-label="Remove ${esc(m.display_name)}">✕</button>` : ""}</div>`).join("")}</div>
      ${admin ? `<div class="row"><button class="btn small primary" data-invite="carer">+ Invite a carer</button><button class="btn small" data-invite="admin">+ Invite a parent</button></div>
      <p class="meta" style="margin:0">Carers can give points and dress the monsters. Parents can also spend treats, mark goals as given, change settings and invite people.</p>` : `<p class="meta" style="margin:0">You're a carer: you can give points and help dress the monsters. Ask a parent to spend treats or change settings.</p>`}
    </section>`;
}
function backupCard() {
  if (!isAdmin() || HOST) return "";
  return `<section class="card"><h3 style="font-size:19px">Backups</h3><p class="meta" style="margin:0">Everything is saved online automatically. A backup file is an extra copy you keep, in case anything ever goes wrong.</p>
    <div class="row"><button class="btn small primary" id="bkDown">Download backup</button><button class="btn small" id="bkUp">Restore from a file…</button></div>
    ${lget("hd.lastBackup", 0) ? `<p class="meta" style="margin:0">Last backup from this device: ${new Date(lget("hd.lastBackup", 0)).toLocaleDateString()}</p>` : ""}</section>`;
}
function deviceCard() {
  if (HOST) return "";
  return `<section class="card"><h3 style="font-size:19px">This device</h3>${installHelp() || `<p class="meta" style="margin:0">Installed on this device.</p>`}
    <label class="row" style="gap:8px"><input type="checkbox" id="muteDev" ${lget("hd.mute", false) ? "checked" : ""}> Mute sounds on this device</label>
    <button class="btn small" id="newsBtn">✨ What's new</button>
    ${S.mode === "cloud" ? `<button class="btn small ghost" id="signOutBtn">Sign out</button>` : HOST ? "" : `<button class="btn small ghost" id="leaveLocal">Leave try-it-out mode</button>`}</section>`;
}
function viewFamilyPanel() { return famCard() + backupCard() + deviceCard(); }

// Settings opens on a page of big tiles; each tile is a short page of its own. Edits stay in the draft across pages until Save.
const SET_PAGES = [
  ["kids", "👧", "Children & behaviours", "Names, ages, birthdays and the behaviours that earn Dojos.", "Children"],
  ["rewards", "🎁", "Treats & reward goals", "What Dojo $ can buy, the big goals and the family team jar.", "Rewards"],
  ["games", "🎮", "Games & admin mode", "Turn games on or off, set a daily limit, and edit anything in admin mode.", "Games"],
  ["family", "👪", "Family & invites", "Who's in the family. Invite a parent or a carer.", "Family"],
  ["device", "🔒", "PIN, backups & this device", "Parent PIN, backup files, sounds, sign out and what's new.", "This device"]
];
function setKidPicker(d) {
  if (d.kids.length < 2) return "";
  return `<div class="seg2 kidpick">${d.kids.map((k, i) => `<button data-setkid="${i}" aria-pressed="${i === S.setKid}">${esc(k.name || "Child")}</button>`).join("")}</div>`;
}
function viewSettings() {
  const d = S.draft;
  if (!isAdmin()) {
    return `<div class="row" style="margin-bottom:12px;justify-content:space-between"><button class="iconbtn" id="setCancel">← Back</button><h1 style="font-size:24px">Settings</h1><span></span></div><div class="list" style="gap:18px">${viewFamilyPanel()}</div>`;
  }
  const pages = SET_PAGES.filter(([id]) => id !== "family" || S.mode === "cloud");
  const page = pages.find((x) => x[0] === S.setPage);
  if (!page) S.setPage = null;
  S.setKid = Math.min(S.setKid || 0, Math.max(0, d.kids.length - 1));
  const top = `<div class="row" style="margin-bottom:12px;justify-content:space-between">${page ? `<button class="iconbtn" data-setpage="">← Settings</button>` : `<button class="iconbtn" id="setCancel">Cancel</button>`}<h1 style="font-size:24px">${page ? page[1] + " " + page[4] : "Settings"}</h1><button class="btn primary" id="setSave">Save</button></div>`;
  if (!page) return top + `<div class="list" style="gap:14px">${pages.map(([id, ic, t, txt]) => `<button class="menutile settile" data-setpage="${id}"><span class="mi" aria-hidden="true">${ic}</span><span class="mt"><b>${t}</b><small>${txt}</small></span><span class="chev" aria-hidden="true">›</span></button>`).join("")}
    <p class="meta" style="text-align:center;margin:0">Changes are kept as you move between pages. Tap Save when you're done.</p></div>`;
  const ki = S.setKid, k = d.kids[ki];
  let body = "";
  if (S.setPage === "kids") {
    body = setKidPicker(d) + (k ? (() => {
    const big = (k.age || 6) >= 4, n = k.behaviours.length, rec = big ? "3 to 4" : "2", max = big ? 5 : 3;
    const libFor = LIB.filter((b) => b.for === "both" || b.for === (big ? "big" : "little"));
    const groups = [...new Set(libFor.map((b) => b.group))];
      return `<section class="card" style="--kid:${esc(k.look.color)}">
      <div class="row"><div class="m" style="width:96px;height:96px">${monsterSvg(k.look, wornBy(k), 1)}</div>
        <div class="stack" style="flex:1"><label class="field">Name<input id="nm${ki}" data-k="${ki}" data-f="name" value="${esc(k.name)}"></label>
        <div class="row" style="gap:10px;flex-wrap:wrap"><label class="field" style="max-width:100px">Age<input id="ag${ki}" data-k="${ki}" data-f="age" type="number" min="1" max="16" value="${esc(k.age)}"></label>
        <label class="field" style="max-width:170px">Birthday<input id="bd${ki}" data-k="${ki}" data-f="birthday" type="date" value="${esc(k.birthday || "")}"></label></div>
        <label class="row" style="gap:8px;font-weight:700"><input type="checkbox" data-k="${ki}" data-f="toddler" ${isToddler(k) ? "checked" : ""}> Toddler view (giant buttons, peekaboo)</label></div></div>
      <p class="meta" style="margin:0">Change the character, colours and outfit in ${esc(k.name || "their")}'s Monster tab. The kids can do it too.</p>
      <div><div class="row" style="justify-content:space-between"><h3 style="font-size:19px">Behaviours</h3><span class="count${n > max ? " over" : ""}">${n} active · aim for ${rec}</span></div>
        ${n > max ? `<p class="meta" style="color:var(--warn);margin:4px 0 0">That's a lot to keep track of. Try mastering a few first, then swap.</p>` : ""}
        <div class="list" style="margin-top:8px">${k.behaviours.map((b, bi) => `<div class="editrow two"><input class="inp" style="text-align:center" aria-label="Icon" data-k="${ki}" data-arr="behaviours" data-i="${bi}" data-f="icon" value="${esc(b.icon)}"><input class="inp" aria-label="Behaviour name" data-k="${ki}" data-arr="behaviours" data-i="${bi}" data-f="label" value="${esc(b.label)}"><button class="x" data-rm="${ki}" data-arr="behaviours" data-i="${bi}" aria-label="Remove ${esc(b.label)}">✕</button></div>`).join("")}</div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-addcustom="${ki}">+ Your own behaviour</button></div>
        <details style="margin-top:8px"><summary>📚 Behaviour ideas (${libFor.length}, each explained). Tap Add to use one</summary><div class="lib" style="padding-top:8px">
          ${groups.map((g) => `<div class="meta" style="font-weight:700;margin-top:6px">${esc(g)}</div>` + libFor.filter((b) => b.group === g).map((b) => {
            const on = k.behaviours.some((x) => x.id === b.id);
            return `<div class="libitem"><span class="e" aria-hidden="true">${b.icon}</span><div><b>${esc(b.label)}</b><p>${esc(b.why)}</p><div>${b.star ? '<span class="tag star">Suggested</span>' : ""}${b.fresh ? '<span class="tag new">New idea</span>' : ""}${b.lens.map((l) => `<span class="tag">${l}</span>`).join("")}</div></div><button class="btn small ${on ? "ghost" : ""}" data-lib="${ki}" data-id="${b.id}">${on ? "Remove" : "Add"}</button></div>`;
          }).join("")).join("")}
        </div></details></div>
      <div class="row" style="justify-content:flex-end"><button class="btn small ghost" data-rmkid="${ki}">Remove ${esc(k.name || "child")}</button></div>
    </section>`;
    })() : `<div class="empty">No children yet.</div>`) + `<button class="btn" id="addKid">+ Add a child</button>`;
  } else if (S.setPage === "rewards") {
    body = setKidPicker(d) + (k ? `<section class="card" style="--kid:${esc(k.look.color)}"><h3 style="font-size:21px">${esc(k.name || "Child")}</h3>
      <div><h3 style="font-size:19px">Treats in the shop</h3><p class="meta" style="margin:2px 0 8px">Small everyday rewards ${esc(k.name || "they")} can buy. Keep at least one cheap enough to earn in a day.</p>
        <div class="list">${(k.rewards || []).map((t, ti) => `<div class="editrow"><input class="inp" style="text-align:center" aria-label="Icon" data-k="${ki}" data-arr="rewards" data-i="${ti}" data-f="icon" value="${esc(t.icon)}"><input class="inp" aria-label="Treat" data-k="${ki}" data-arr="rewards" data-i="${ti}" data-f="label" value="${esc(t.label)}"><input class="inp" aria-label="Cost in points" type="number" min="1" data-k="${ki}" data-arr="rewards" data-i="${ti}" data-f="cost" value="${esc(t.cost)}"><button class="x" data-rm="${ki}" data-arr="rewards" data-i="${ti}" aria-label="Remove">✕</button></div>`).join("")}</div>
        <button class="btn small" style="margin-top:8px" data-add="${ki}" data-arr="rewards">+ Add treat</button></div>
      <div><h3 style="font-size:19px">Reward goals</h3><p class="meta" style="margin:2px 0 8px">Bigger rewards unlocked by total Dojos earned. Spending Dojo $ in the shop doesn't count against them.</p>
        <div class="list">${(k.milestones || []).map((m, mi) => `<div class="editrow"><input class="inp" style="text-align:center" aria-label="Icon" data-k="${ki}" data-arr="milestones" data-i="${mi}" data-f="icon" value="${esc(m.icon)}"><input class="inp" aria-label="Reward" data-k="${ki}" data-arr="milestones" data-i="${mi}" data-f="label" value="${esc(m.label)}"><input class="inp" aria-label="Points needed" type="number" min="1" data-k="${ki}" data-arr="milestones" data-i="${mi}" data-f="at" value="${esc(m.at)}"><button class="x" data-rm="${ki}" data-arr="milestones" data-i="${mi}" aria-label="Remove">✕</button></div>`).join("")}</div>
        <button class="btn small" style="margin-top:8px" data-add="${ki}" data-arr="milestones">+ Add goal</button></div>
    </section>` : "") + `
  <section class="card"><h3 style="font-size:19px">Team jar</h3><p class="meta" style="margin:0">A family treat the children fill together. Every Dojo either of them earns adds a marble.</p>
    <div class="editrow"><input class="inp" style="text-align:center" aria-label="Icon" id="tmIc" value="${esc((d.team || TEAM_DEFAULT).icon)}"><input class="inp" aria-label="Treat" id="tmLb" value="${esc((d.team || TEAM_DEFAULT).label)}"><input class="inp" aria-label="Dojos to fill the jar" id="tmTg" type="number" min="5" max="500" value="${esc((d.team || TEAM_DEFAULT).target)}"></div></section>
`;
  } else if (S.setPage === "games") {
    body = `
  <section class="card"><h3 style="font-size:19px">🎮 Games</h3><p class="meta" style="margin:0">Little games that unlock as monsters level up. They never give Dojos.</p>
    <label class="row" style="gap:8px;font-weight:700"><input type="checkbox" id="gmOn" ${(d.games || {}).on === false ? "" : "checked"}> Games on</label>
    <label class="field" style="max-width:260px">Games per child per day (0 = no limit)<input id="gmLim" type="number" min="0" max="50" value="${esc((d.games || {}).limit == null ? 3 : d.games.limit)}"></label></section>
  <section class="card"><h3 style="font-size:19px">🛠 Admin mode</h3><p class="meta" style="margin:0">For grown-ups: adds an 🛠 Admin tab to each child where you can give or take away any shop item, pet, house or furniture, mystery egg prizes, today's game tries and high scores. You can also try any game; admin games don't use up the children's games or change their high scores. It stays on until you turn it off or close the app.</p>
    <div class="row"><button class="btn ${S.adminPlay ? "ghost" : "primary"}" id="adminTgl">${S.adminPlay ? "Turn admin mode off" : "Turn admin mode on"}</button></div></section>
`;
  } else if (S.setPage === "family") {
    body = famCard();
  } else if (S.setPage === "device") {
    body = `
  <section class="card"><h3 style="font-size:19px">Parent PIN</h3><p class="meta" style="margin:0">Useful on a shared tablet: locks settings, treats and goal sign-off so little fingers can't. Leave blank for no PIN.</p>
    <input class="inp" id="pinIn" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="4 digits" value="${esc(d.pin || "")}" style="max-width:160px"></section>
` + backupCard() + deviceCard();
  }
  return top + `<div class="list" style="gap:18px">${body}</div>`;
}

/* ---------- home menu: Kids' play, Parents and Set up ---------- */
// Kids' play is safe to hand over: monsters, shop items, island, games and eggs all work, but nothing can award Dojos,
// spend treats, delete history or change settings. It survives a reload. Parents needs the PIN and isn't remembered,
// so a closed app always reopens on the menu (or straight back into Kids' play).
function setView(v) { S.view = v; lset("hd.view", v === "kids" ? "kids" : "menu"); S.adminPlay = false; S.touchAt = Date.now(); }
function toMenu() { setView("menu"); closeModal(); go({ name: "home" }); }
function enterKids() { setView("kids"); go({ name: "home" }); toast("Kids' play: have fun! Nothing can be changed here."); }
function enterParents(then) { parentPin(() => { setView("parents"); if (then) then(); else go({ name: "home" }); }); }
// The PIN guards Parents and Set up. With no PIN yet, a parent chooses one first (or skips for now).
function parentPin(then) {
  if (S.cfg && S.cfg.pin) return requirePin(then);
  if (!S.cfg || !isAdminRole()) return then();
  modal(`<h2>Choose a parent PIN</h2><p class="meta">4 numbers you'll type to get into Parents and Set up. Keep it secret from the kids!</p>
    <input class="inp" id="newPin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="4 digits" style="max-width:180px;margin:0 auto;text-align:center;font-size:24px;letter-spacing:6px" data-autofocus>
    <div class="row" style="justify-content:center"><button class="btn ghost" id="pinSkip">Skip for now</button><button class="btn primary" id="pinSet">Save PIN</button></div>`, () => {
    const inp = $("#newPin"); inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 4); };
    $("#pinSkip").onclick = () => { closeModal(); then(); };
    $("#pinSet").onclick = () => { if (inp.value.length !== 4) return toast("The PIN needs 4 numbers."); const cfg = clone(S.cfg); cfg.pin = inp.value; saveCfg(cfg); closeModal(); toast("PIN saved."); then(); };
  });
}
function viewMenu() {
  const kids = S.cfg.kids || [];
  const tile = (id, icon, title, text, lock) => `<button class="menutile" id="${id}"><span class="mi" aria-hidden="true">${icon}</span><span class="mt"><b>${title}${lock ? ' <span aria-label="needs the PIN">🔒</span>' : ""}</b><small>${text}</small></span></button>`;
  return `<div class="menu">
    <div class="menu-monsters" aria-hidden="true">${kids.map((k) => `<div class="m">${monsterSvg(k.look, dressedFor(k), stats(k.id).level)}</div>`).join("")}</div>
    <h1 class="menu-title">Hi! Who's using the app?</h1>
    ${tile("goKids", "🎮", "Kids' play", "Play with your monster, island and games. Nothing can be given or changed.")}
    ${tile("goParents", "🧑‍🧑‍🧒", "Parents", "Give Dojos, spend treats, see the week and change settings.", true)}
    ${isAdminRole() ? tile("goSetup", "🧭", "Set up", "Answer a few questions to choose behaviours, big rewards and treats.", true) : ""}
    ${tile("goSettings", "⚙️", "Settings", isAdminRole() ? "Children, rewards, games, family invites and backups." : "Your name, this device and signing out.", isAdminRole())}
    <button class="btn ghost" id="guideBtn" style="justify-self:center">📖 Carers' guide</button></div>`;
}

/* ---------- guided setup ---------- */
const GOAL_IDEAS = { big: [["🍦", "Ice cream trip", 20], ["🛝", "Park trip with ice cream", 25], ["🎮", "Extra game time", 30], ["🍕", "Pizza night", 50], ["🧱", "New Lego set", 75], ["🎢", "Special day out", 150]],
  little: [["🫧", "Bubbles in the garden", 10], ["🎈", "Balloon", 15], ["🦆", "Feed the ducks", 20], ["🧸", "New small toy", 30], ["🚂", "Train ride", 50]] };
const TREAT_IDEAS = { big: [["📖", "Pick tonight's story", 5], ["🍨", "Choose dessert", 5], ["🎵", "Pick the car music", 3], ["🛁", "Bubble bath", 4], ["🎬", "Pick the family film", 15], ["🎡", "Trip out", 40]],
  little: [["⭐", "Sticker", 1], ["🎵", "Pick a song to dance to", 3], ["📚", "Extra story", 5], ["🛁", "Bath toys", 3]] };
const isAdminRole = () => S.mode === "local" || S.role === "admin";
function startWizard() {
  const d = S.cfg ? clone(S.cfg) : { version: 1, sound: true, pin: "", kids: [] };
  d.kids.forEach((k) => { k.behaviours = k.behaviours || []; k.milestones = k.milestones || []; k.rewards = k.rewards || []; });
  d.games = Object.assign({ on: true, limit: 3 }, d.games); d.team = Object.assign({ startAt: Date.now() }, TEAM_DEFAULT, d.team);
  S.wiz = { d, step: 0 };
}
function wizSteps() { const st = ["kids"]; S.wiz.d.kids.forEach((k, i) => st.push("beh:" + i, "goals:" + i, "treats:" + i)); st.push("family", "done"); return st; }
const bigKid = (k) => (k.age || 6) >= 4;
function viewWizard() {
  if (!S.wiz) startWizard();
  const w = S.wiz, d = w.d, steps = wizSteps(), step = steps[Math.min(w.step, steps.length - 1)], [kind, ki] = step.split(":"), k = d.kids[+ki];
  let body = "", title = "", lead = "";
  const row = (arr, i, it, numF, numLabel) => `<div class="editrow"><input class="inp" style="text-align:center" aria-label="Icon" data-wk="${ki}" data-warr="${arr}" data-wi="${i}" data-wf="icon" value="${esc(it.icon)}"><input class="inp" aria-label="Name" data-wk="${ki}" data-warr="${arr}" data-wi="${i}" data-wf="label" value="${esc(it.label)}"><input class="inp" aria-label="${numLabel}" type="number" min="1" data-wk="${ki}" data-warr="${arr}" data-wi="${i}" data-wf="${numF}" value="${esc(it[numF])}"><button class="x" data-wrm="${arr}" data-wk="${ki}" data-wi="${i}" aria-label="Remove">✕</button></div>`;
  if (kind === "kids") {
    title = "Who are the monsters for?"; lead = "Add each child and their age. Under-4s get the toddler view with giant buttons.";
    body = `<div class="list">${d.kids.map((c, i) => `<div class="row wkid" style="--kid:${esc(c.look.color)}"><span class="m" style="width:52px;height:52px">${monsterSvg(c.look, {}, 1)}</span><input class="inp" style="flex:2;min-width:120px" aria-label="Name" data-wkid="${i}" data-wf="name" value="${esc(c.name)}"><input class="inp" style="flex:1;max-width:90px" aria-label="Age" type="number" min="1" max="16" data-wkid="${i}" data-wf="age" value="${esc(c.age)}"><button class="x" data-wrmkid="${i}" aria-label="Remove ${esc(c.name)}">✕</button></div>`).join("")}</div>
      <button class="btn" id="wAddKid">+ Add a child</button>`;
  } else if (kind === "beh") {
    const big = bigKid(k), lib = LIB.filter((b) => b.for === "both" || b.for === (big ? "big" : "little")), n = k.behaviours.length;
    title = `What would you like to see more of from ${esc(k.name)}?`; lead = `Pick ${big ? "3 or 4" : "2"} to start. Fewer is easier to notice every day; you can swap later. ⭐ = a good first choice.`;
    body = `<p class="count${n > (big ? 5 : 3) ? " over" : ""}" style="margin:0">${n} picked</p><div class="wchips">${lib.map((b) => { const on = k.behaviours.some((x) => x.id === b.id); return `<button class="wchip${on ? " on" : ""}" data-wbeh="${b.id}" aria-pressed="${on}" title="${esc(b.why)}"><span aria-hidden="true">${b.icon}</span> ${esc(b.label)}${b.star ? " ⭐" : ""}</button>`; }).join("")}</div>`;
  } else if (kind === "goals") {
    const ideas = GOAL_IDEAS[bigKid(k) ? "big" : "little"].filter(([, l]) => !k.milestones.some((m) => m.label === l)), perDay = bigKid(k) ? 4 : 3;
    title = `Big rewards for ${esc(k.name)}`; lead = `Won by total Dojos earned. Spending Dojo $ never moves these backwards. At about ${perDay} Dojos a day, 25 Dojos takes about a week.`;
    body = `<div class="list">${k.milestones.slice().sort((a, b) => a.at - b.at).map((m) => row("milestones", k.milestones.indexOf(m), m, "at", "Dojos needed")).join("")}</div>
      <div class="meta" style="font-weight:700">Ideas: tap to add</div><div class="wchips">${ideas.map(([ic, l, at]) => `<button class="wchip" data-wadd="milestones" data-wk="${ki}" data-ic="${ic}" data-l="${esc(l)}" data-n="${at}">${ic} ${esc(l)} · ${at}</button>`).join("")}<button class="wchip" data-wadd="milestones" data-wk="${ki}" data-ic="🏆" data-l="New reward" data-n="${(k.milestones.reduce((x, m) => Math.max(x, m.at), 0) || 0) + 25}">+ Your own</button></div>`;
  } else if (kind === "treats") {
    const ideas = TREAT_IDEAS[bigKid(k) ? "big" : "little"].filter(([, l]) => !k.rewards.some((t) => t.label === l));
    title = `Small treats for ${esc(k.name)}`; lead = "Everyday rewards a parent spends Dojo $ on. Keep at least one cheap enough to earn in a day.";
    body = `<div class="list">${k.rewards.map((t, i) => row("rewards", i, t, "cost", "Cost in Dojo $")).join("")}</div>
      <div class="meta" style="font-weight:700">Ideas: tap to add</div><div class="wchips">${ideas.map(([ic, l, c]) => `<button class="wchip" data-wadd="rewards" data-wk="${ki}" data-ic="${ic}" data-l="${esc(l)}" data-n="${c}">${ic} ${esc(l)} · ${c}</button>`).join("")}<button class="wchip" data-wadd="rewards" data-wk="${ki}" data-ic="🎁" data-l="New treat" data-n="5">+ Your own</button></div>`;
  } else if (kind === "family") {
    title = "Family settings"; lead = "Last few things, for everyone.";
    body = `<label class="field">Parent PIN (4 numbers) for Parents and Set up<input class="inp" id="wPin" inputmode="numeric" maxlength="4" value="${esc(d.pin || "")}" placeholder="4 digits" style="max-width:160px"></label>
      <label class="field">Games per child per day (0 = no limit)<input class="inp" id="wGames" type="number" min="0" max="50" value="${esc(d.games.limit)}" style="max-width:120px"></label>
      <div class="field">Team jar: a family treat everyone fills together<div class="editrow"><input class="inp" style="text-align:center" aria-label="Icon" id="wTmIc" value="${esc(d.team.icon)}"><input class="inp" aria-label="Treat" id="wTmLb" value="${esc(d.team.label)}"><input class="inp" aria-label="Dojos to fill it" id="wTmTg" type="number" min="5" max="500" value="${esc(d.team.target)}"></div></div>`;
  } else {
    title = "All set!"; lead = "Here's what you chose. Save it, then hand the tablet over in Kids' play.";
    body = d.kids.map((c) => `<div class="card wsum" style="--kid:${esc(c.look.color)}"><b>${esc(c.name)}${c.age ? `, ${esc(c.age)}` : ""}</b><div class="meta">Behaviours: ${c.behaviours.map((b) => esc(b.icon + " " + b.label)).join(", ") || "none yet"}</div><div class="meta">Big rewards: ${c.milestones.slice().sort((a, b) => a.at - b.at).map((m) => esc(`${m.icon} ${m.label} (${m.at})`)).join(", ") || "none yet"}</div><div class="meta">Treats: ${c.rewards.map((t) => esc(`${t.icon} ${t.label} (${t.cost})`)).join(", ") || "none yet"}</div></div>`).join("") +
      `<p class="meta">PIN ${d.pin ? "set" : "not set"} · ${d.games.limit ? d.games.limit + " games a day" : "no game limit"} · Team jar: ${esc(d.team.icon + " " + d.team.label)} (${esc(d.team.target)})</p>`;
  }
  const last = w.step >= steps.length - 1;
  return `<div class="wiz"><div class="row" style="justify-content:space-between;margin-bottom:6px"><button class="iconbtn" id="wQuit">✕ Close</button><span class="meta">Step ${w.step + 1} of ${steps.length}</span></div>
    <div class="bar" aria-hidden="true"><i style="width:${Math.round(100 * (w.step + 1) / steps.length)}%"></i></div>
    <section class="card" style="margin-top:12px${k ? `;--kid:${esc(k.look.color)}` : ""}">${k ? `<div class="m wmon">${monsterSvg(k.look, wornBy(k), 1)}</div>` : ""}<h1 style="font-size:24px">${title}</h1><p class="meta" style="margin:0">${lead}</p>${body}</section>
    <div class="row" style="justify-content:space-between;margin-top:14px">${w.step ? `<button class="btn ghost" id="wBack">← Back</button>` : "<span></span>"}${last ? `<button class="btn primary" id="wSave">Save and finish</button>` : `<button class="btn primary" id="wNext">Next →</button>`}</div></div>`;
}
function wizSave() {
  const d = clone(S.wiz.d);
  if (d.pin && d.pin.length !== 4) return toast("The PIN needs exactly 4 numbers, or leave it blank.");
  d.kids.forEach((c) => { delete c._new; delete c._age; c.name = (c.name || "").trim() || "Child"; c.milestones = c.milestones.filter((m) => m.at > 0 && m.label); c.rewards = c.rewards.filter((t) => t.cost > 0 && t.label);
    const live = kidById(c.id); if (live) ["look", "equip", "monsterName", "shelf", "eggs", "plays", "best", "island"].forEach((f) => { if (live[f] !== undefined) c[f] = live[f]; }); });
  if (S.cfg) d.familyIsland = S.cfg.familyIsland;
  S.wiz = null; saveCfg(d); go({ name: "home" }); toast("All set! Your monsters are ready.");
  SND.earn(); confetti(innerWidth / 2, innerHeight * .3, ["#FFD43B", "#FF5E8A", "#3D7BFF", "#4CBF5A"], 60);
}
function wireWizard() {
  const v = $("#view"), w = S.wiz; if (!w) return;
  const d = w.d, on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  // Text boxes update the draft as you type; buttons redraw.
  v.querySelectorAll("[data-wkid]").forEach((inp) => inp.oninput = () => { const c = d.kids[+inp.dataset.wkid]; c[inp.dataset.wf] = inp.type === "number" ? (parseInt(inp.value, 10) || 0) : inp.value; if (inp.dataset.wf === "age") delete c.toddler; });
  v.querySelectorAll("[data-warr]").forEach((inp) => inp.oninput = () => { const it = d.kids[+inp.dataset.wk][inp.dataset.warr][+inp.dataset.wi]; it[inp.dataset.wf] = inp.type === "number" ? (parseInt(inp.value, 10) || 0) : inp.value; });
  v.querySelectorAll("[data-wrm]").forEach((b) => b.onclick = () => { d.kids[+b.dataset.wk][b.dataset.wrm].splice(+b.dataset.wi, 1); rerender(); });
  v.querySelectorAll("[data-wrmkid]").forEach((b) => b.onclick = () => { const c = d.kids[+b.dataset.wrmkid]; confirmBox(`Remove ${c.name || "this child"}?`, "Their monster and settings go when you save. Their point history stays.", "Remove", () => { d.kids.splice(+b.dataset.wrmkid, 1); rerender(); }); });
  on("#wAddKid", () => { if (d.kids.length >= 6) return; d.kids.push(Object.assign(starterKid("", 6, d.kids.length), { _new: true })); rerender(); });
  v.querySelectorAll("[data-wbeh]").forEach((b) => b.onclick = () => { const [, ki] = wizSteps()[w.step].split(":"), c = d.kids[+ki], it = LIB.find((x) => x.id === b.dataset.wbeh), i = c.behaviours.findIndex((x) => x.id === it.id); if (i >= 0) c.behaviours.splice(i, 1); else c.behaviours.push({ id: it.id, icon: it.icon, label: it.label }); beep([[880, .06, 0, "pluck"]], .3); rerender(); });
  v.querySelectorAll("[data-wadd]").forEach((b) => b.onclick = () => { const c = d.kids[+b.dataset.wk], it = { id: uid(), icon: b.dataset.ic, label: b.dataset.l }; it[b.dataset.wadd === "milestones" ? "at" : "cost"] = +b.dataset.n; c[b.dataset.wadd].push(it); rerender(); });
  const pin = $("#wPin"); if (pin) pin.oninput = () => { pin.value = pin.value.replace(/\D/g, "").slice(0, 4); d.pin = pin.value; };
  const gm = $("#wGames"); if (gm) gm.oninput = () => { d.games.limit = Math.max(0, parseInt(gm.value, 10) || 0); };
  [["icon", "#wTmIc"], ["label", "#wTmLb"], ["target", "#wTmTg"]].forEach(([f, sel]) => { const el = $(sel); if (el) el.oninput = () => { d.team[f] = f === "target" ? Math.max(5, parseInt(el.value, 10) || 30) : el.value; }; });
  on("#wQuit", () => confirmBox("Close set up?", "Nothing you changed here is saved.", "Close", () => { S.wiz = null; go({ name: "home" }); }));
  on("#wBack", () => { w.step = Math.max(0, w.step - 1); go(S.route); });
  on("#wNext", () => {
    if (wizSteps()[w.step] === "kids") {
      if (!d.kids.length) return toast("Add at least one child."); if (d.kids.some((c) => !(c.name || "").trim())) return toast("Give each child a name.");
      // A new child's starting behaviours, goals and treats depend on their age, which is typed after they're added.
      d.kids.forEach((c, i) => { if (!c._new || c._age === c.age) return; const f = starterKid(c.name, c.age || 6, i); Object.assign(c, { behaviours: f.behaviours, milestones: f.milestones, rewards: f.rewards, look: Object.assign({}, c.look, { eyes: f.look.eyes, top: f.look.top }), _age: c.age }); });
    }
    w.step++; go(S.route);
  });
  on("#wSave", wizSave);
}

/* ---------- Monster Islands (islands.js) ---------- */
let ISL = null;
function isl() {
  if (!ISL && window.HD_ISLANDS) ISL = window.HD_ISLANDS({ S, $, esc, stats, kidById, setMonster, saveFamilyIsland, addRecord, monsterSvg, petSvg, PET_IDS, houseOutsideSvg, houseTier, wornBy, dressedFor, beep, SND, toast, modal, closeModal, confirmBox, go, rerender, confetti, speak, isToddler, adminPlay, coin, reduced });
  return ISL;
}
const islSpecials = () => (isl() ? isl().SHOP : []);

/* ---------- render + wiring ---------- */
function soundIcon() {
  const on = !(S.cfg && S.cfg.sound === false) && !lget("hd.mute", false);
  const b = $("#soundBtn"); b.setAttribute("aria-label", on ? "Sound on" : "Sound off");
  b.hidden = S.phase !== "app";
  $("#setBtn").hidden = S.phase !== "app" || S.view !== "parents";
  const mb = $("#menuBtn"); if (mb) mb.hidden = S.phase !== "app" || S.view === "menu" || !(S.cfg && (S.cfg.kids || []).length);
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/>${on ? '<path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>' : '<path d="m22 9-6 6M16 9l6 6"/>'}</svg>`;
}
// What's new lives in news.json (newest first). Add an entry with every update; v matches VERSION in sw.js.
// fresh = skip every cache, to read the notes of an update that's waiting to be installed.
const loadNews = (fresh) => fetch("news.json" + (fresh ? "?t=" + Date.now() : ""), fresh ? { cache: "no-store" } : {}).then((r) => r.json()).catch(() => []);
function whatsNewHtml(list) {
  return `<div style="font-size:44px;line-height:1">✨</div><h2>What's new</h2>
    ${list.map((n) => `<div class="news">${list.length > 1 ? `<div class="meta" style="font-weight:700">${esc(n.date)}</div>` : ""}<ul>${n.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("")}
    <button class="btn primary" id="newsOk">Got it!</button>`;
}
function showWhatsNew(list) { if (!list.length) return toast("No notes for this version."); modal(whatsNewHtml(list), () => { $("#newsOk").onclick = closeModal; }); }
// After an update, show what changed since this device last looked. A brand-new install just remembers the version.
async function maybeWhatsNew() {
  if (HOST || S.newsChecked) return;
  S.newsChecked = true;
  const news = await loadNews(false), top = news[0];
  if (!top) return;
  const seen = lget("hd.seenVersion", null);
  lset("hd.seenVersion", top.v);
  if (!seen || seen === top.v) return;
  const i = news.findIndex((n) => n.v === seen);
  const fresh = news.slice(0, i < 0 ? 3 : Math.min(i, 3));
  if (fresh.length) setTimeout(() => { if (!$("#overlay").innerHTML) showWhatsNew(fresh); }, 600);
}
// The update banner's "What's new": the notes of the waiting version, read before installing it.
async function previewUpdate(w) {
  const news = await loadNews(true), seen = lget("hd.seenVersion", null);
  const i = news.findIndex((n) => n.v === seen), list = news.slice(0, i < 0 ? 1 : Math.min(Math.max(i, 1), 3));
  modal(whatsNewHtml(list).replace('<button class="btn primary" id="newsOk">Got it!</button>', '<div class="row" style="justify-content:center"><button class="btn ghost" id="newsLater">Later</button><button class="btn primary" id="newsUpd">Update now</button></div>'), () => {
    $("#newsLater").onclick = closeModal;
    $("#newsUpd").onclick = () => { if (news[0]) lset("hd.seenVersion", news[0].v); w.postMessage("skipWaiting"); };
  });
}

function render() {
  soundIcon(); syncDot();
  $("#brand").innerHTML = esc(S.phase === "app" && S.family ? S.family.name : "Home Dojo") + (S.phase === "app" && S.view !== "menu" ? ` <span class="modechip ${S.view}">${S.view === "kids" ? "Kids' play" : "Parents"}</span>` : "");
  const r = S.route; let html;
  if (S.phase === "boot") html = `<div class="empty">Waking up the monsters…</div>`;
  else if (S.phase === "nosetup") html = viewNoSetup();
  else if (S.phase === "signin") html = viewSignIn();
  else if (S.phase === "nofamily") html = viewNoFamily();
  else if (r.name === "settings") { if (S.lastRoute === "settings") return; html = viewSettings(); }
  else if (!S.cfgLoaded) html = `<div class="empty">Waking up the monsters…</div>`;
  else if (r.name === "setup" && isAdminRole()) html = viewWizard();
  else if (!S.cfg || !(S.cfg.kids || []).length) { if (isAdminRole()) { if (!S.wiz) startWizard(); S.route = { name: "setup" }; html = viewWizard(); } else html = viewSetup(); }
  else if (S.view === "menu" && r.name !== "guide") html = viewMenu();
  else if (r.name === "guide") html = viewGuide();
  else if ((r.name === "island" || r.name === "islands") && isl()) html = isl().view(r);
  else if (r.name === "kid" && kidById(r.kid)) html = viewKid(kidById(r.kid), r.tab || "earn");
  else { S.route = { name: "home" }; html = viewHome(); }
  if (adminPlay() && S.phase === "app" && r.name !== "settings") html = `<div class="adminbar" role="status"><span>🛠 Admin mode: everything is editable</span><button class="btn small ghost" id="adminOff">Turn off</button></div>` + html;
  const key = S.phase + "|" + html.replace(/ id="m\d+[a-z]?"| url\(#m\d+[a-z]?\)|clip-path="url\(#m\d+c\)"/g, "");
  S.lastRoute = S.phase === "app" ? r.name : S.phase;
  if (S.phase === "app" && S.cfgLoaded) maybeWhatsNew();
  if (key === S.lastHtml) return;
  S.lastHtml = key;
  const y = window.scrollY;
  $("#view").innerHTML = html;
  if (r.name !== "settings") window.scrollTo(0, y);
  const ao = $("#adminOff"); if (ao) ao.onclick = () => { S.adminPlay = false; toast("Admin mode off."); rerender(); };
  wire();
}
function go(route) { S.route = route; S.lastRoute = null; S.lastHtml = ""; render(); window.scrollTo(0, 0); }
function rerender() { S.lastRoute = null; S.lastHtml = ""; render(); }

function wire() {
  const v = $("#view");
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };

  // no setup / sign in / join
  on("#tryLocal", () => { lset("hd.localMode", true); startLocal(); });
  v.querySelectorAll("[data-auth]").forEach((b) => b.onclick = () => { S.authTab = b.dataset.auth; rerender(); });
  const af = $("#authForm");
  if (af) af.onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#aEmail").value.trim(), pass = $("#aPass").value, err = $("#aErr");
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    if (!email || pass.length < 8) return fail("Enter your email and a password of at least 8 characters.");
    const btn = af.querySelector("[type=submit]"); btn.disabled = true;
    try {
      if (S.authTab === "signup") {
        const name = $("#aName").value.trim(); if (!name) { btn.disabled = false; return fail("Add your name so the family knows who gave each point."); }
        const r = await sb.auth.signUp({ email, password: pass, options: { data: { name }, emailRedirectTo: location.origin + location.pathname + inviteQuery() } });
        if (r.error) throw r.error;
        if (!r.data.session) { btn.disabled = false; S.authTab = "signin"; rerender(); return modal(`<div style="font-size:44px;line-height:1">📬</div><h2>Check your email</h2><p class="meta">We sent a link to <b>${esc(email)}</b>. Tap it to confirm${inviteFromLink ? " and you'll join the family straight away" : ", then sign in here"}.</p><p class="meta">It can take a few minutes, and sometimes lands in Junk or Spam.</p><button class="btn primary" id="okMail">OK</button>`, () => { $("#okMail").onclick = closeModal; }); }
        await afterSignIn(r.data.session.user);
      } else {
        const r = await sb.auth.signInWithPassword({ email, password: pass });
        if (r.error) throw r.error;
        await afterSignIn(r.data.user);
      }
    } catch (ex) { btn.disabled = false; fail(/Invalid login/i.test(ex.message) ? "That email and password don't match." : ex.message || "Something went wrong. Try again."); }
  };
  on("#forgot", async () => {
    const email = $("#aEmail").value.trim();
    if (!email) { const err = $("#aErr"); err.textContent = "Type your email above first."; err.hidden = false; return; }
    const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    toast(r.error ? r.error.message : "Check your email for a link to reset your password.");
  });
  const jf = $("#joinForm");
  if (jf) jf.onsubmit = async (e) => {
    e.preventDefault();
    const code = $("#jCode").value.trim().toUpperCase(), name = $("#jName").value.trim(), err = $("#jErr");
    if (!code || !name) { err.textContent = "Add the invite code and your name."; err.hidden = false; return; }
    const r = await sb.rpc("join_family", { p_code: code, p_display: name });
    if (r.error) { err.textContent = r.error.message; err.hidden = false; return; }
    if (inviteFromLink) { history.replaceState(null, "", location.pathname); ldel("hd.invite"); }
    await afterSignIn(S.user);
    welcomeJoined();
  };
  const nf = $("#newForm");
  if (nf) nf.onsubmit = async (e) => {
    e.preventDefault();
    const fam = $("#nFam").value.trim(), name = $("#nName").value.trim(), err = $("#nErr");
    if (!fam || !name) { err.textContent = "Add a family name and your name."; err.hidden = false; return; }
    const r = await sb.rpc("create_family", { p_name: fam, p_display: name });
    if (r.error) { err.textContent = r.error.message; err.hidden = false; return; }
    await openFamily({ id: r.data, name: fam, role: "admin" });
  };
  on("#signOut", () => sb.auth.signOut());

  // home
  v.querySelectorAll("[data-kid]").forEach((b) => b.onclick = () => go({ name: "kid", kid: b.dataset.kid, tab: "earn" }));
  v.querySelectorAll("[data-visit]").forEach((b) => b.onclick = () => go({ name: "kid", kid: b.dataset.visit, tab: "monster", sub: "house" }));
  if ($("#lobbyLayer")) mountLobby();
  on("#nudgeBackup", downloadBackup);
  on("#installBtn", async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {} deferredInstall = null; rerender(); });

  // setup
  on("#setupGo", () => {
    const kids = [];
    [0, 1, 2].forEach((i) => { const n = $("#sName" + i).value.trim(), a = parseInt($("#sAge" + i).value, 10) || 6; if (n) kids.push(starterKid(n, a, i)); });
    if (!kids.length) return toast("Add at least one name.");
    saveCfg({ version: 1, sound: true, pin: "", kids });
  });
  on("#setupRestore", pickBackupFile);

  // kid
  on("#backBtn", () => { S.greetFor = null; go({ name: "home" }); });
  on("#fullView", () => { S.route.full = true; rerender(); });
  on("#toddlerView", () => { S.route.full = false; rerender(); });
  on("#teamDone", () => requirePin(() => { const cfg = clone(S.cfg); cfg.team = Object.assign({}, cfg.team, { startAt: Date.now(), filled: (cfg.team.filled || 0) + 1 }); saveCfg(cfg); toast("New jar started. Go team!"); }));
  if (S.route.name === "home" && S.phase === "app" && S.cfg && !S.cfg.team && isAdmin()) { const cfg = clone(S.cfg); cfg.team = Object.assign({ startAt: Date.now() }, TEAM_DEFAULT); setTimeout(() => saveCfg(cfg), 0); }
  v.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { S.route.tab = b.dataset.tab; rerender(); });
  const kid = S.route.name === "kid" && kidById(S.route.kid);
  if (kid && S.phase === "app") {
    const hm = $("#heroMonster");
    if (hm && $("#peekaboo")) $("#peekaboo").onclick = () => peekaboo(kid);
    else if (hm) hm.onclick = () => { const ls = monsterLines(kid); monsterSay(kid, ls[Math.floor(Math.random() * ls.length)]); bounce(hm); beep([[880, .12, 0]]); };
    if (hm && S.greetFor !== kid.id) { S.greetFor = kid.id; const ls = monsterLines(kid); setTimeout(() => monsterSay(kid, `Hi ${kid.name}! ${ls[0]}`, true), 500); }
    v.querySelectorAll("[data-game]").forEach((b) => b.onclick = () => startGame(kid, b.dataset.game));
    v.querySelectorAll("details[data-grp]").forEach((d) => d.ontoggle = () => { const o = S.admOpen || (S.admOpen = new Set()); d.open ? o.add(d.dataset.grp) : o.delete(d.dataset.grp); });
    v.querySelectorAll("[data-adm]").forEach((b) => b.onclick = () => { if (adminPlay()) adminEdit(kid, b.dataset.adm, b.dataset.v); });
    v.querySelectorAll("[data-beh]").forEach((b) => b.onclick = () => { const id = b.dataset.beh; const beh = id === "bonus" ? BONUS : kid.behaviours.find((x) => x.id === id); if (beh) award(kid, beh, b); });
    v.querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => buyItem(kid, SHOP.find((i) => i.id === b.dataset.buy)));
    v.querySelectorAll("[data-wear]").forEach((b) => b.onclick = () => { const it = SHOP.find((i) => i.id === b.dataset.wear); const worn = (wornBy(kid))[it.slot] === it.id; equip(kid, it.slot, worn ? null : it.id); });
    v.querySelectorAll("[data-treat]").forEach((b) => b.onclick = () => buyTreat(kid, kid.rewards.find((t) => t.id === b.dataset.treat)));
    v.querySelectorAll("[data-given]").forEach((b) => b.onclick = () => markGiven(kid, kid.milestones.find((m) => m.id === b.dataset.given)));
    v.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
      const go2 = () => confirmBox("Remove this entry?", "Its points come off the total.", "Remove", () => removeRecord(b.dataset.del));
      isAdmin() ? requirePin(go2) : go2();
    });
    v.querySelectorAll("[data-sub]").forEach((b) => b.onclick = () => { S.route.sub = b.dataset.sub; rerender(); });
    v.querySelectorAll("[data-trophy]").forEach((b) => b.onclick = () => { const t = trophiesFor(kid).find((x) => x.id === b.dataset.trophy); if (t) openTrophy(kid, t); });
    v.querySelectorAll("[data-house]").forEach((b) => b.onclick = () => buyHouse(kid, HOUSE.find((h) => h.id === b.dataset.house), "tier"));
    v.querySelectorAll("[data-peek]").forEach((b) => b.onclick = () => peekHouse(kid, +b.dataset.peek));
    v.querySelectorAll("[data-furni]").forEach((b) => b.onclick = () => buyHouse(kid, FURNI.find((f) => f.id === b.dataset.furni), "furni"));
    v.querySelectorAll("[data-monster]").forEach((g) => g.onclick = () => { bounce(g); beep([[880, .12, 0]]); });
    v.querySelectorAll("[data-look]").forEach((b) => b.onclick = () => {
      const f = b.dataset.look, val = f === "eyes" ? +b.dataset.v : b.dataset.v;
      setMonster(kid, { look: Object.assign({}, kid.look, { [f]: val }) }); beep([[660, .08, 0]]); bounce($("#studioMonster"));
    });
    const mn = $("#monName"); if (mn) mn.oninput = () => { const n = $("#studioName"); if (n) n.textContent = mn.value.trim() || "My monster"; };
    if (mn) mn.onchange = () => { setMonster(kid, { monsterName: mn.value.trim().slice(0, 24) }); toast("Name saved"); };
    on("#surprise", () => {
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      setMonster(kid, { look: { species: pick(SPECIES)[0], color: pick(COLORS), shape: pick(SHAPES)[0], eyes: pick([1, 2, 3]), top: pick(TOPS)[0], mouth: pick(MOUTHS)[0] } });
      SND.earn(); bounce($("#studioMonster"));
    });
  }
  const gb = $("#guideBtn"); if (gb) gb.onclick = () => go({ name: "guide" });
  const gk = $("#guideBack"); if (gk) gk.onclick = () => go({ name: "home" });
  if (S.route.name === "settings" && S.phase === "app") wireSettings();
  if (S.route.name === "setup" && S.phase === "app") wireWizard();
  on("#goKids", enterKids); on("#goParents", () => enterParents());
  on("#goSetup", () => enterParents(() => { startWizard(); go({ name: "setup" }); }));
  on("#goSettings", () => isAdminRole() ? enterParents(openSettings) : openSettings());
  if (isl() && S.phase === "app" && S.cfg) isl().wireAll();
}

function wireSettings() {
  const v = $("#view"), d = S.draft;
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  // family panel (everyone)
  const mn = $("#myName"); if (mn) mn.onchange = () => { setMyName(mn.value.trim()); toast("Name saved"); };
  v.querySelectorAll("[data-invite]").forEach((b) => b.onclick = () => createInvite(b.dataset.invite));
  v.querySelectorAll("[data-rmmember]").forEach((b) => b.onclick = () => removeMember(S.members.find((m) => m.user_id === b.dataset.rmmember)));
  on("#bkDown", downloadBackup);
  on("#newsBtn", async () => showWhatsNew((await loadNews(false)).slice(0, 3)));
  on("#bkUp", pickBackupFile);
  const md = $("#muteDev"); if (md) md.onchange = () => { lset("hd.mute", md.checked); soundIcon(); };
  on("#signOutBtn", () => confirmBox("Sign out?", "You'll need your email and password to sign back in on this device.", "Sign out", () => sb.auth.signOut()));
  on("#leaveLocal", () => confirmBox("Leave try-it-out mode?", "Points saved on this device stay here in case you come back.", "Leave", () => { ldel("hd.localMode"); location.reload(); }));
  on("#installBtn", async () => { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall = null; });
  on("#setCancel", () => { S.draft = null; S.setPage = null; go({ name: "home" }); });
  if (!isAdmin()) return;
  v.querySelectorAll("[data-setpage]").forEach((b) => b.onclick = () => { S.setPage = b.dataset.setpage || null; rerender(); window.scrollTo(0, 0); });
  v.querySelectorAll("[data-setkid]").forEach((b) => b.onclick = () => { S.setKid = +b.dataset.setkid; rerender(); });

  const redraw = () => rerender();
  v.querySelectorAll("input[data-k]").forEach((inp) => inp.oninput = inp.onchange = () => {
    const k = d.kids[+inp.dataset.k], f = inp.dataset.f;
    const val = inp.type === "number" ? (parseInt(inp.value, 10) || 0) : inp.type === "checkbox" ? inp.checked : inp.value;
    if (inp.dataset.arr) k[inp.dataset.arr][+inp.dataset.i][f] = val; else k[f] = val;
  });
  v.querySelectorAll("[data-look]").forEach((b) => b.onclick = () => { const k = d.kids[+b.dataset.look]; k.look[b.dataset.lf] = b.dataset.lf === "eyes" ? +b.dataset.v : b.dataset.v; redraw(); });
  v.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { d.kids[+b.dataset.rm][b.dataset.arr].splice(+b.dataset.i, 1); redraw(); });
  v.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
    const k = d.kids[+b.dataset.add];
    if (b.dataset.arr === "rewards") k.rewards.push({ id: uid(), icon: "🎁", label: "New treat", cost: 10 });
    else { const last = (k.milestones || []).reduce((m, x) => Math.max(m, x.at), 0); (k.milestones = k.milestones || []).push({ id: uid(), icon: "🏆", label: "New reward", at: last + 50 }); }
    redraw();
  });
  v.querySelectorAll("[data-addcustom]").forEach((b) => b.onclick = () => { d.kids[+b.dataset.addcustom].behaviours.push({ id: "c" + uid(), icon: "✨", label: "New behaviour" }); redraw(); });
  v.querySelectorAll("[data-lib]").forEach((b) => b.onclick = () => {
    const k = d.kids[+b.dataset.lib], it = LIB.find((x) => x.id === b.dataset.id), i = k.behaviours.findIndex((x) => x.id === it.id);
    if (i >= 0) k.behaviours.splice(i, 1); else k.behaviours.push({ id: it.id, icon: it.icon, label: it.label });
    redraw();
  });
  v.querySelectorAll("[data-rmkid]").forEach((b) => b.onclick = () => {
    const ki = +b.dataset.rmkid, k = d.kids[ki];
    confirmBox(`Remove ${k.name}?`, "Their monster and settings go when you save. Their point history stays, in case you add them back.", "Remove", () => { d.kids.splice(ki, 1); redraw(); });
  });
  on("#addKid", () => { d.kids.push(starterKid("New child", 6, d.kids.length)); S.setKid = d.kids.length - 1; redraw(); });
  const tm = (f, el) => { d.team = Object.assign({ startAt: Date.now() }, TEAM_DEFAULT, d.team); d.team[f] = el.type === "number" ? Math.max(5, parseInt(el.value, 10) || 30) : el.value; };
  [["icon", "#tmIc"], ["label", "#tmLb"], ["target", "#tmTg"]].forEach(([f, sel]) => { const el = $(sel); if (el) el.oninput = () => tm(f, el); });
  const adT = $("#adminTgl"); if (adT) adT.onclick = () => { S.adminPlay = !S.adminPlay; adT.textContent = S.adminPlay ? "Turn admin mode off" : "Turn admin mode on"; adT.className = "btn " + (S.adminPlay ? "ghost" : "primary"); toast(S.adminPlay ? "Admin mode on: open a child and use the 🛠 Admin tab." : "Admin mode off."); };
  const gmOn = $("#gmOn"); if (gmOn) gmOn.onchange = () => { d.games = Object.assign({ on: true, limit: 3 }, d.games, { on: gmOn.checked }); };
  const gmLim = $("#gmLim"); if (gmLim) gmLim.oninput = () => { d.games = Object.assign({ on: true, limit: 3 }, d.games, { limit: Math.max(0, parseInt(gmLim.value, 10) || 0) }); };
  const pin = $("#pinIn"); if (pin) pin.oninput = (e) => { d.pin = e.target.value.replace(/\D/g, "").slice(0, 4); };
  on("#setSave", () => {
    if (d.pin && d.pin.length !== 4) return toast("The PIN needs exactly 4 digits, or leave it blank.");
    d.kids.forEach((k) => { k.name = (k.name || "").trim() || "Child"; k.milestones = (k.milestones || []).filter((m) => m.at > 0); k.rewards = (k.rewards || []).filter((t) => t.cost > 0); });
    // keep whatever the monsters are wearing now (a carer may have changed it meanwhile)
    d.kids.forEach((k) => { const live = kidById(k.id); if (live) { k.equip = live.equip || {}; k.look = live.look || k.look; k.monsterName = live.monsterName || ""; k.shelf = live.shelf || []; k.eggs = live.eggs || 0; k.plays = live.plays; k.best = live.best; k.island = live.island; } });
    d.familyIsland = S.cfg.familyIsland;
    const cfg = clone(d); S.draft = null; S.setPage = null; S.route = { name: "home" };
    saveCfg(cfg); rerender(); window.scrollTo(0, 0); toast("Settings saved");
  });
}

function showNewPassword() {
  modal(`<h2>Set a new password</h2><input class="inp" id="np" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" data-autofocus><button class="btn primary" id="npGo">Save password</button>`, () => {
    $("#npGo").onclick = async () => {
      const p = $("#np").value; if (p.length < 8) return toast("Use at least 8 characters.");
      const r = await sb.auth.updateUser({ password: p });
      if (r.error) return toast(r.error.message);
      closeModal(); toast("Password updated"); S.recovery = false;
      const s = await sb.auth.getSession(); if (s.data.session) afterSignIn(s.data.session.user);
    };
  });
}

$("#menuBtn").onclick = () => { if (S.phase === "app") { S.wiz = null; S.draft = null; toMenu(); } };
// Parents locks itself after 10 minutes without a tap, in case the tablet gets handed over.
document.addEventListener("pointerdown", () => { S.touchAt = Date.now(); }, true);
setInterval(() => { if (S.view === "parents" && Date.now() - (S.touchAt || 0) > 10 * 60 * 1000 && !S.draft && !S.wiz) { toMenu(); toast("Parents locked after 10 quiet minutes."); } }, 30000);
function openSettings() { S.draft = S.cfg ? clone(S.cfg) : { version: 1, sound: true, pin: "", kids: [] }; S.draft.kids.forEach((k) => { k.rewards = k.rewards || []; k.milestones = k.milestones || []; k.behaviours = k.behaviours || []; k.look = k.look || {}; }); S.setPage = null; go({ name: "settings" }); }
$("#setBtn").onclick = () => {
  if (S.phase !== "app" || S.view !== "parents") return;
  isAdmin() ? requirePin(openSettings) : openSettings();
};
$("#soundBtn").onclick = () => { const m = !lget("hd.mute", false); lset("hd.mute", m); soundIcon(); if (!m) beep([[880, .15, 0]]); };

/* ---------- service worker (offline + updates) ---------- */
function registerSW() {
  if (HOST || !("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const offer = (w) => {
      $("#updateHost").innerHTML = `<div class="banner" role="status"><span>✨ A new version of Home Dojo is ready.</span><button id="updNews" class="ghostb">What's new</button><button id="updGo">Update</button></div>`;
      $("#updNews").onclick = () => previewUpdate(w);
      $("#updGo").onclick = () => { w.postMessage("skipWaiting"); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

boot();
})();
