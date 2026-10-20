/* A stand-in for the Supabase client, used only by the tests (tests/run.js serves it instead of vendor/supabase.js).
   Data lives in window.__DB, seeded from window.__SEED. Every query is logged in __DB.log so tests can check what was asked for,
   and window.__emit(table, event, row) plays a live update as if another phone had made it. */
(function () {
"use strict";
const seed = window.__SEED || {};
const DB = window.__DB = {
  user: seed.user || { id: "u1", email: "parent@example.com", user_metadata: { name: "Parent" } },
  families: seed.families || [{ id: "f1", name: "Test family" }],
  members: seed.members || [{ family_id: "f1", user_id: "u1", role: "admin", display_name: "Parent" }],
  family_config: seed.family_config || [],
  awards: seed.awards || [],
  feedback: [], invites: [],
  log: []
};
const handlers = [];
window.__emit = (table, event, row, old) => handlers.filter((h) => h.table === table && (h.event === "*" || h.event === event)).forEach((h) => h.cb({ eventType: event, new: row || {}, old: old || {} }));
const clone = (o) => JSON.parse(JSON.stringify(o));

function project(row, cols, table) {
  if (!cols || cols === "*") return clone(row);
  const out = {};
  cols.split(",").map((c) => c.trim()).forEach((c) => {
    const m = c.match(/^(\w+)\((.+)\)$/);
    if (m) { const f = DB[m[1]].find((x) => x.id === row.family_id); out[m[1]] = f ? project(f, m[2]) : null; }
    else if (c in row) out[c] = clone(row[c]);
  });
  return out;
}

class Query {
  constructor(table) { this.t = table; this.f = []; this.op = "select"; this.cols = "*"; this.opts = {}; }
  select(cols, opts) { if (this.op === "select") this.cols = cols || "*"; this.opts = opts || {}; return this; }
  eq(k, v) { this.f.push((r) => r[k] === v); this.desc = (this.desc || []).concat([`${k}=${v}`]); return this; }
  neq(k, v) { this.f.push((r) => r[k] !== v); this.desc = (this.desc || []).concat([`${k}!=${v}`]); return this; }
  not(k, op, v) { this.f.push((r) => !(op === "is" && v === null ? r[k] == null : r[k] === v)); this.desc = (this.desc || []).concat([`${k} not ${op} ${v}`]); return this; }
  in(k, arr) { this.f.push((r) => arr.includes(r[k])); this.desc = (this.desc || []).concat([`${k} in ${arr.length}`]); return this; }
  order(k, o) { this.ord = [k, !o || o.ascending !== false]; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  maybeSingle() { this.single = true; return this; }
  insert(row) { this.op = "insert"; this.row = row; return this; }
  upsert(row) { this.op = "upsert"; this.row = row; return this; }
  update(row) { this.op = "update"; this.row = row; return this; }
  delete() { this.op = "delete"; return this; }
  run() {
    const T = DB[this.t] = DB[this.t] || [];
    const match = (r) => this.f.every((f) => f(r));
    let data = null, count;
    if (this.op === "insert") {
      const rows = [].concat(this.row);
      for (const r of rows) {
        if (this.t === "awards" && T.some((x) => x.family_id === r.family_id && x.id === r.id)) return { data: null, error: { code: "23505", message: "duplicate" } };
        T.push(clone(r));
      }
    } else if (this.op === "upsert") {
      const i = T.findIndex((x) => x.family_id === this.row.family_id);
      if (i >= 0) T[i] = Object.assign(T[i], clone(this.row)); else T.push(clone(this.row));
    } else if (this.op === "update") {
      T.filter(match).forEach((r) => Object.assign(r, clone(this.row)));
    } else if (this.op === "delete") {
      DB[this.t] = T.filter((r) => !match(r));
    } else {
      let rows = T.filter(match);
      if (this.ord) { const [k, asc] = this.ord; rows = rows.slice().sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1)); }
      count = rows.length;
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
      data = this.opts.head ? null : rows.map((r) => project(r, this.cols, this.t));
      if (this.single) data = data[0] || null;
    }
    const res = { data, error: null, count };
    DB.log.push({ table: this.t, op: this.op, cols: this.cols, filters: this.desc || [], bytes: JSON.stringify(data || "").length });
    return res;
  }
  then(ok, bad) { return Promise.resolve().then(() => this.run()).then(ok, bad); }
}

function setKid(fam, kid, patch) {
  const c = DB.family_config.find((x) => x.family_id === fam); if (!c) return;
  c.config.kids = c.config.kids.map((k) => (k.id === kid ? Object.assign({}, k, clone(patch)) : k));
}
const RPC = {
  is_app_owner: () => false,
  set_monster: (a) => { const allowed = ["look", "equip", "monsterName", "shelf", "eggs", "plays", "best", "island", "yard"]; setKid(a.p_family, a.p_kid, Object.fromEntries(Object.entries(a.p_patch).filter(([k]) => allowed.includes(k)))); return null; },
  set_family_island: (a) => { const c = DB.family_config.find((x) => x.family_id === a.p_family); if (c) c.config.familyIsland = clone(a.p_island); return null; }
};

const client = {
  auth: {
    getSession: async () => ({ data: { session: DB.user ? { user: DB.user } : null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null })
  },
  from: (t) => new Query(t),
  rpc: async (name, args) => { DB.log.push({ rpc: name, args }); return { data: RPC[name] ? RPC[name](args || {}) : null, error: null }; },
  channel: () => {
    const ch = {
      on: (kind, opt, cb) => { handlers.push({ table: opt.table, event: opt.event, cb }); return ch; },
      subscribe: (cb) => { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; }
    };
    return ch;
  },
  removeChannel: () => {}
};
window.supabase = { createClient: () => client };
})();
