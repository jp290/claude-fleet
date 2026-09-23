// Gruendungsfenster am leeren Slot — statisches Mockup (docs/messungen/2026-09-22-gruendungsfenster-entwurf.md).
// Kein Produktcode, keine Route. Die Flotte ist die geschwaerzte Demo-Flotte der Leisten-Entwuerfe
// (../sidebar/marken-daten.js), die Marken zeichnet die Runde-3-Maschine (../sidebar/marken3.js,
// System C Attraktor, die Empfehlung jener Runde). ?s=1 | 2 | 3a | 3b waehlt die Stufe.
import { SLOTS, ALL } from "../sidebar/marken-daten.js";
import { MarkStage, projectHue } from "../sidebar/marken3.js";

const STUFE = new URLSearchParams(location.search).get("s") || "1";
const CLICKED = 9; // der freie Platz, auf den geklickt wurde

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const svg = (markup, cls = "ic") => {
  const t = document.createElement("template");
  t.innerHTML = `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
  return t.content.firstChild;
};
const I = {
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  chev: '<path d="M4 6l4 4 4-4"/>',
  back: '<path d="M10 3L5 8l5 5"/>',
  folder: '<path d="M2 4.5h4l1.5 1.5H14v6.5H2z"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
};

// Eine Marke, als Standbild: eine Canvas, eine Buehne, rAF aus (Bauform wie marken-tafel.html).
function mark(canvas, ident, size) {
  const stage = new MarkStage(canvas);
  stage.on = false;
  stage.setRows([{ x: 0, y: 0, size, system: "attraktor", ...ident }], size, size);
  return canvas;
}
const sessionMark = (s, size) => mark(el("canvas"), { repo: s.repo, harness: s.harness, role: s.role,
  slot: s.slot, openedAt: s.openedAt, state: s.state }, size);
// Das GESICHT eines Repos (Lesart a): dieselbe Maschine, derselbe Farbton (projectHue), aber der
// Seed kennt nur den Pfad — ein Repo hat keinen Slot und keine Oeffnungszeit.
const repoFace = (repo, size, state) => mark(el("canvas", "big"), { repo, harness: "repo", role: "repo",
  slot: 0, openedAt: 0, state }, size);

// --- Leiste ----------------------------------------------------------------------------------
function paintSide() {
  const side = document.getElementById("side");
  const head = el("div"); head.id = "sidehead";
  head.append(el("i", "dot"), el("span", null, "Claude Fleet"), el("span", "inst", "Mac"));
  side.append(head);
  for (const s of SLOTS) {
    const b = el("div", "band" + (s.free ? " free" : "") + (s.slot === CLICKED ? " pressed" : ""));
    b.dataset.slot = s.slot;
    if (s.free) {
      b.append(el("i", "st"), el("span", "id", String(s.slot)), el("span", "lbl", "frei · Session starten"));
    } else {
      b.style.setProperty("--h", projectHue(s.repo));
      b.append(el("i", "st " + s.state), el("span", "id", String(s.slot)), el("span", "lbl", s.label));
      if (s.lanes?.length) b.append(el("span", "lanes", `+${s.lanes.length}`));
      if (s.pct != null) b.append(el("span", "pct", `${s.pct}%`));
    }
    side.append(b);
  }
}

// --- Fensterrahmen ---------------------------------------------------------------------------
const STEPS = [["1", "Rolle"], ["2", "Profil & Kontext"], ["3", "Repo"]];
function frame(width, step) {
  const gf = document.getElementById("gf");
  gf.style.width = width + "px";
  const hd = el("div", "gfhead");
  const ttl = el("div", "ttl");
  ttl.append("Neue Session ", el("span", "mono", `· Slot ${CLICKED}`));
  const steps = el("div", "steps");
  STEPS.forEach(([n, name], i) => {
    if (i) steps.append(el("i", "sep"));
    const cur = Number(n);
    steps.append(el("span", "s" + (cur === step ? " on" : cur < step ? " done" : ""), `${n} ${name}`));
  });
  const x = el("button", "x"); x.title = "Schliessen — der Platz bleibt frei (Esc)"; x.append(svg(I.x));
  hd.append(ttl, steps, x);
  const body = el("div", "gfbody");
  const foot = el("div", "gffoot");
  gf.append(el("i", "notch"), hd, body, foot);
  return { gf, body, foot };
}
// Das Fenster sitzt RECHTS NEBEN dem angeklickten Platz; sein Zeiger zeigt auf die Zeile, und es
// rutscht nur so weit nach oben, wie die Fensterhoehe es verlangt.
function anchor(gf) {
  const row = document.querySelector(`.band[data-slot="${CLICKED}"]`).getBoundingClientRect();
  const mid = row.top + row.height / 2;
  const h = gf.offsetHeight;
  const top = Math.max(12, Math.min(innerHeight - h - 12, mid - h * 0.42));
  gf.style.top = top + "px";
  gf.querySelector(".notch").style.top = (mid - top - 6) + "px";
}
const carry = (body, parts, backTo) => {
  const c = el("div", "carry");
  c.append("Gewählt:");
  for (const [txt, mono] of parts) c.append(el("span", "chip" + (mono ? " m" : ""), txt));
  const b = el("a", "back", `ändern (${backTo})`);
  c.append(b);
  body.append(c);
};
const foot = (f, hint, buttons) => {
  f.append(el("span", "hint", hint));
  for (const [t, primary] of buttons) f.append(el("button", "btn" + (primary ? " primary" : ""), t));
};

// --- Stufe 1: Rolle als Comic-Seite ----------------------------------------------------------
// Die drei Rollen sind die drei, die der Owner genannt hat; „usw." ist eine Frage, kein Panel.
const ART = {
  // Orchestrator: eine Mitte, die zu den Plaetzen spricht — Faeden zu Slots, an zweien haengen Lanes
  orch: `<svg class="art" viewBox="0 0 260 368" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-linecap="round">
    <g stroke-width="1" opacity=".35">
      <path d="M130 158 L56 76"/><path d="M130 158 L206 70"/><path d="M130 158 L40 170"/>
      <path d="M130 158 L222 176"/><path d="M130 158 L78 248"/><path d="M130 158 L188 252"/>
    </g>
    <g stroke-width="1.2" opacity=".55">
      <rect x="44" y="62" width="24" height="18" rx="4"/><rect x="194" y="56" width="24" height="18" rx="4"/>
      <rect x="28" y="162" width="24" height="18" rx="4"/><rect x="210" y="168" width="24" height="18" rx="4"/>
      <rect x="66" y="240" width="24" height="18" rx="4"/><rect x="176" y="244" width="24" height="18" rx="4"/>
      <path d="M206 74 v18 q0 8 8 8 h10"/><circle cx="228" cy="100" r="3"/>
      <path d="M40 180 v16 q0 8 -8 8 h-6"/><circle cx="22" cy="204" r="3"/>
    </g>
    <g stroke-width="1.6"><circle cx="130" cy="158" r="20" opacity=".9"/><circle cx="130" cy="158" r="5" fill="currentColor" opacity=".8"/>
      <circle cx="130" cy="158" r="36" opacity=".28" stroke-dasharray="2 5"/><circle cx="130" cy="158" r="54" opacity=".14" stroke-dasharray="2 7"/></g>
  </svg>`,
  // Worker, neuer Worktree: vom Stamm waechst ein frischer Ast, an seiner Spitze ein neuer Knoten
  neu: `<svg class="art" viewBox="0 0 250 178" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-linecap="round">
    <path d="M18 128 H232" stroke-width="1.6" opacity=".45"/>
    <g opacity=".45" fill="currentColor"><circle cx="46" cy="128" r="3.5"/><circle cx="86" cy="128" r="3.5"/><circle cx="126" cy="128" r="3.5"/><circle cx="196" cy="128" r="3.5"/></g>
    <path d="M126 128 C 146 128 150 84 176 80 L 196 78" stroke-width="1.8" opacity=".9"/>
    <circle cx="206" cy="78" r="9" stroke-width="1.8" opacity=".95"/>
    <path d="M206 73 v10 M201 78 h10" stroke-width="1.6"/>
    <g stroke-width="1.2" opacity=".55"><path d="M222 60 l6 -6"/><path d="M226 74 h9"/><path d="M218 94 l6 6"/></g>
  </svg>`,
  // Worker, vorhandener Worktree: ein Ast liegt schon da (Arbeit darauf), eine Figur steigt wieder ein
  vorh: `<svg class="art" viewBox="0 0 250 178" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-linecap="round">
    <path d="M18 132 H232" stroke-width="1.6" opacity=".45"/>
    <g opacity=".45" fill="currentColor"><circle cx="40" cy="132" r="3.5"/><circle cx="80" cy="132" r="3.5"/><circle cx="210" cy="132" r="3.5"/></g>
    <path d="M80 132 C 100 132 104 90 126 88 H 190" stroke-width="1.8" opacity=".75"/>
    <g fill="currentColor" opacity=".75"><circle cx="140" cy="88" r="3.5"/><circle cx="162" cy="88" r="3.5"/><circle cx="184" cy="88" r="3.5"/></g>
    <g stroke-width="1.7" opacity=".95"><circle cx="203" cy="50" r="6"/><path d="M203 57 v14 M203 71 l-7 12 M203 71 l7 12 M195 63 l8 -3 8 3"/></g>
    <path d="M186 60 q-8 14 -2 24" stroke-width="1.3" stroke-dasharray="2 4" opacity=".7"/>
  </svg>`,
};
function stufe1() {
  const { gf, body, foot: f } = frame(640, 1);
  const comic = el("div", "comic");
  const P = [
    ["orch", "1", "Orchestrator", "hält die Fleet zusammen",
      "Hält das Portfolio, schärft Zeilen und verteilt Arbeit — sie landet nicht selbst. Beim Start bekommt sie ihre Rollenkarte."],
    ["neu", "2", "Worker", "auf neuem Worktree",
      "Eine eigene Lane auf frischem Branch: arbeitet, beweist, wird gelandet."],
    ["vorh", "3", "Worker", "auf vorhandenem Worktree",
      "Setzt einen liegengebliebenen Worktree wieder in einen Platz — die Arbeit darauf bleibt."],
  ];
  for (const [k, n, name, sub, say] of P) {
    const p = el("button", `panel ${k}` + (k === "neu" ? " pick" : ""));
    p.title = say;
    const t = document.createElement("template"); t.innerHTML = ART[k].trim();
    p.append(t.content.firstChild);
    const cap = el("div", "cap", name); cap.append(el("small", null, sub));
    const s = el("div", "say"); s.append(el("span", null, say));
    p.append(cap, el("span", "num", n), s);
    comic.append(p);
  }
  const q = el("div", "panel frage");
  const qt = el("div", "q", "„usw.“ — welche Rollen gehören noch auf diese Seite?");
  qt.append(el("small", null, "Offen: das entscheidest du. Bis dahin bleibt dieses Feld leer."));
  q.append(el("span", "bubble", "?"), qt);
  comic.append(q);
  body.append(comic);
  foot(f, "Klick merkt vor · Doppelklick geht gleich weiter", [["Cancel"], ["Next ▸", true]]);
  return gf;
}

// --- Stufe 2: Profil links, Kontext daneben --------------------------------------------------
// Die Pack-Zeilen sind die Fleet-Samen aus context-packs.ts (id, useWhen, estimatedBytes, harnesses),
// gekuerzt auf die Zeile; „an" = was DISPATCH_CONTEXT_TRIGGERS (always, verification) heute waehlen.
const PACKS = [
  ["Immer", "portable-core", "Vokabular und harte Invarianten, die jede Session binden.", 3800, "on"],
  ["Für diese Arbeit", "verify-e2e", "Welcher Beweis wann genügt und was das Gate fährt.", 6313, "on"],
  ["Für diese Arbeit", "task-queue", "Das Refinement-System hinter der Queue.", 3500, "off"],
  ["Für diese Arbeit", "harness-adapter", "Probe-Mengen und Automations-Grenzen der Harnesses.", 4600, "off"],
  ["Für diese Arbeit", "land-mechanics", "Passt nicht zu pi-zai — nur claude und pi-unfenced.", 4300, "no"],
  ["Für diese Arbeit", "private-deploy-overlay", "Passt nicht zu pi-zai — nur claude und pi-unfenced.", 99108, "no"],
];
function stufe2() {
  const { gf, body, foot: f } = frame(800, 2);
  carry(body, [["Worker · neuer Worktree"]], "Rolle");
  const two = el("div", "two");

  const prof = el("div", "col");
  prof.append(el("h3", null, "Profil"), el("div", "sub", "Wie der Agent läuft."));
  const h = el("div", "fld"); h.append(el("div", "k", "Harness"));
  const seg = el("div", "seg");
  for (const [id, on] of [["claude"], ["codex"], ["pi-zai", true], ["pi"], ["container"], ["mehr ▾"]]) seg.append(el("b", on ? "on" : "", id));
  h.append(seg, el("div", "hint2", "Lanes erlaubt · Chat-Ansicht · kein Container."));
  const m = el("div", "fld"); m.append(el("div", "k", "Modell"));
  const sw = el("div", "sw"); sw.append(el("span", null, "glm-5.3-flash"), svg(I.chev)); m.append(sw);
  const e = el("div", "fld"); e.append(el("div", "k", "Effort"));
  const es = el("div", "seg");
  for (const [id, on] of [["default"], ["low"], ["high", true], ["max"]]) es.append(el("b", on ? "on" : "", id));
  e.append(es);
  const more = el("div", "reiter"); more.append(el("span", null, "Mehr: Browser, Container, Kontextfenster — bei pi-zai keins davon"), svg(I.chev));
  prof.append(h, m, e, more);

  const ctx = el("div", "col");
  ctx.append(el("h3", null, "Kontext"),
    el("div", "sub", "Context-Packs sind Zeiger auf Stellen im Repo, kein kopierter Text. Du steckst sie zusammen, der Agent liest nach."));
  let cur = null, grp = null, bytes = 0, on = 0;
  for (const [g, id, uw, b, st] of PACKS) {
    if (g !== cur) {
      cur = g; grp = el("div", "grp");
      const gh = el("div", "gh", g);
      gh.append(el("span", null, g === "Immer" ? "Auslöser „always“" : "nach Auslöser vorbelegt"));
      grp.append(gh); ctx.append(grp);
    }
    const r = el("div", "pk " + st);
    const t = el("div"); t.append(el("span", "nm", id), el("span", "uw", uw));
    r.append(t, el("span", "kb", b >= 10000 ? `${Math.round(b / 1000)} KB` : `${(b / 1000).toFixed(1).replace(".", ",")} KB`),
      el("span", "tg" + (st === "on" ? " on" : st === "no" ? " off2" : ""), st === "on" ? "on" : "off"));
    if (st === "on") { bytes += b; on++; }
    grp.append(r);
  }
  const rg = el("div", "grp");
  const rh = el("div", "gh", "Aus dem Repo"); rh.append(el("span", null, ".fleet/context-packs.json"));
  rg.append(rh, el("div", "dashed", "Erscheinen nach der Repo-Wahl (Schritt 3) — jedes Repo bringt seine eigenen mit."));
  const add = el("div", "dashed"); add.append("+ Pack zusammenstecken … ", el("span", null, "(Form: Frage an dich)"));
  add.style.marginTop = "8px";
  const sum = el("div", "sum");
  sum.append(el("span", null, `${on} Packs an · später änderbar im Info-Tab`),
    el("span", "mono", `≈ ${(bytes / 1000).toFixed(1).replace(".", ",")} KB zu lesen`));
  ctx.append(rg, add, sum);

  two.append(prof, ctx);
  body.append(two);
  foot(f, "Bestätigen übernimmt beides; die Repo-Wahl kommt danach.", [["Back"], ["Confirm", true]]);
  return gf;
}

// --- Stufe 3: Repo — die Repos aus der Flotte, je mit ihren Agenten -------------------------
function repos() {
  const by = new Map();
  for (const s of ALL) {
    const r = by.get(s.repo) ?? { repo: s.repo, name: s.repo.split("/").pop(), mains: [], lanes: [] };
    (s.role === "lane" ? r.lanes : r.mains).push(s);
    by.set(s.repo, r);
  }
  return [...by.values()].sort((a, b) => (b.mains.length + b.lanes.length) - (a.mains.length + a.lanes.length));
}
const count = (r) => `${r.mains.length} Session${r.mains.length === 1 ? "" : "s"}`
  + (r.lanes.length ? ` · ${r.lanes.length} Lane${r.lanes.length === 1 ? "" : "s"}` : "");
const carry3 = (body) => carry(body, [["Worker · neuer Worktree"], ["pi-zai · glm-5.3-flash · high", true], ["2 Packs"]], "Profil & Kontext");

function stufe3a() {
  const { gf, body, foot: f } = frame(820, 3);
  carry3(body);
  const grid = el("div", "faces");
  for (const r of repos()) {
    const c = el("button", "face" + (r.name === "claude-fleet" ? " pick" : ""));
    const working = [...r.mains, ...r.lanes].some((s) => s.state === "work");
    c.append(repoFace(r.repo, 76, working ? "work" : "rest"));
    const info = el("div"); info.style.minWidth = "0";
    info.append(el("div", "nm", r.name), el("div", "ln", count(r)), el("div", "pth", r.repo.replace("/Users/o", "~")));
    const crew = el("div", "crew");
    for (const s of [...r.mains, ...r.lanes].slice(0, 10)) crew.append(sessionMark(s, 16));
    info.append(crew);
    c.append(info);
    grid.append(c);
  }
  const other = el("button", "face other");
  const o = el("div"); o.append(svg(I.folder), el("div", null, "Anderer Ordner …"), el("div", null, "der heutige Verzeichnisbaum"));
  other.append(o);
  grid.append(other);
  body.append(grid);
  const lg = el("div", "legend");
  lg.append(el("span", null, "Großes Bild = das Repo · Farbton aus projectHue(Pfad), Seed nur aus dem Pfad"),
    el("span", null, "kleine Bilder = die Session-Marken der Agenten dort"));
  body.append(lg);
  foot(f, "Das Repo trägt dasselbe Gesicht wie seine Sessions — nur ohne Slot und Uhrzeit.", [["Back"], ["Start lane ▸", true]]);
  return gf;
}

// Lesart b: die Karte zeigt, wer dort arbeitet und was das Repo einem Agenten mitgibt. Jede Zeile
// nennt ihre Quelle: dirinfo (GET /api/dirinfo heute), sessions (der Client hat sie schon), oder
// „fehlt heute" (kein Feld auf irgendeiner Route).
function stufe3b() {
  const { gf, body, foot: f } = frame(840, 3);
  carry3(body);
  const split = el("div", "split");
  const list = el("div", "rl");
  const rs = repos();
  for (const r of rs) {
    const row = el("div", "r" + (r.name === "claude-fleet" ? " on" : ""));
    row.style.setProperty("--h", projectHue(r.repo));
    row.append(el("i", "dt"), el("span", null, r.name), el("span", "c", String(r.mains.length + r.lanes.length)));
    list.append(row);
  }
  const ot = el("div", "r other"); ot.append(svg(I.folder), el("span", null, "Anderer Ordner …")); list.append(ot);

  const r = rs.find((x) => x.name === "claude-fleet");
  const card = el("div", "card");
  const hd = el("div", "hd");
  hd.append(repoFace(r.repo, 34, "work"));
  hd.lastChild.style.cssText = "width:34px;height:34px;border-radius:3px";
  const nm = el("div"); nm.append(el("div", "nm", r.name), el("div", "pth", "~/claude-fleet"));
  hd.append(nm);
  const facts = el("div", "facts");
  for (const t of ["main", "sauber", "kein Upstream"]) facts.append(el("span", "chip m", t));
  facts.append(el("span", "src", "dirinfo"));

  const sec = (title, src, miss) => {
    const s = el("div", "sec"); const sh = el("div", "sh", title);
    sh.append(el("span", "src" + (miss ? " miss" : ""), src)); s.append(sh); return s;
  };
  const who = sec("Wer hier arbeitet", "sessions");
  for (const s of [...r.mains, ...r.lanes].slice(0, 7)) {
    const a = el("div", "ag");
    a.append(sessionMark(s, 16), el("span", "id", String(s.slot)), el("span", null, s.label), el("span", "hm", `${s.harness} · ${s.model || "—"}`));
    who.append(a);
  }
  const rest = r.mains.length + r.lanes.length - 7;
  if (rest > 0) who.append(el("div", "hint2", `+ ${rest} weitere`));

  const gives = sec("Was es einem Agenten mitgibt", "dirinfo · fehlt heute", true);
  const gv = el("div", "gv");
  const g = (k, v, miss) => { gv.append(el("span", null, k), el("span", "v" + (miss ? " miss" : ""), v)); };
  g("AGENTS.md — der portable Vertrag", "liegt da · dirinfo");
  g("CLAUDE.md — das Regelbuch", "liegt da · dirinfo");
  g("Context-Packs des Repos", "2 · fehlt heute", true);
  g("Worktrees auf der Platte", "7 · dirinfo");
  g("davon ohne Platz (für Rolle 3)", "2 · fehlt heute", true);
  gives.append(gv);

  const last = sec("Zuletzt", "dirinfo");
  for (const [sha, ago, s] of [["18aa69da", "5 min", "fix(docs): Messnotiz Suite-Strecke nennt den Fleet-Host als Platzhalter"],
    ["4bee50e7", "6 min", "docs(messung): Suite-Strecke — was der Server über einen laufenden Check publiziert"],
    ["845bd555", "10 min", "feat(leiste): Zieh-Band-Tiefe als Geraete-Einstellung fleet.bandDepth"]]) {
    const c = el("div", "cm"); c.append(el("span", "sha", sha), el("span", "s", s), el("span", "ago", ago)); last.append(c);
  }
  card.append(hd, facts, who, gives, last);
  split.append(list, card);
  body.append(split);
  foot(f, "Gelb = Fakt, den heute keine Route liefert.", [["Back"], ["Start lane ▸", true]]);
  return gf;
}

paintSide();
const gf = ({ 1: stufe1, 2: stufe2, "3a": stufe3a, "3b": stufe3b })[STUFE]();
anchor(gf);
document.getElementById("caption").textContent =
  `Entwurf · Gründungsfenster · Stufe ${STUFE} · Demo-Daten (sidebar/marken-daten.js) · kein Produktcode`;
document.documentElement.dataset.ready = "1";
