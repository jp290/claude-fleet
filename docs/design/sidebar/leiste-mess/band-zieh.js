// A CLICKABLE MOCKUP OF THE BAND GESTURE (owner 2026-09-21: "Ich möchte das man die einzelnen
// session slots quasi durch ein Band ziehen kann, um so dann z.b das transscript der vorherigen
// session ansehen und analysieren zu können"). Not product code: it builds ONE html file from the
// REAL succession chain of two slots of a running fleet, and writes it OUTSIDE the checkout —
// transcripts are private working material and never enter the tree.
//
//   bun band-zieh.js <fleet.json> <out.html> <lane-slot> <main-slot>
//
// Where each past session comes from — the same sources a product route would have (the note:
// docs/messungen/2026-09-21-band-transkript-quelle.md):
//  · a LANE's past occupants are its `handoff` reports (slot + branch); each report's worker carries
//    `sessionId` + `cwd`, and ~/.claude/projects/<slug(cwd)>/<sessionId>.jsonl is its transcript.
//  · a MAIN's past occupants are its lineage records' `from` sides — slot + openedAt, NO sessionId.
//    Nothing ties them to a transcript, and the mockup says so instead of guessing by time.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const [stateFile, outFile, laneArg, mainArg] = process.argv.slice(2);
if (!stateFile || !outFile) { console.error("usage: bun band-zieh.js <fleet.json> <out.html> <lane-slot> <main-slot>"); process.exit(2); }
const st = JSON.parse(readFileSync(stateFile, "utf8"));
const reports = st.fleetReports ?? [];
const slug = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, "-");
const TURNS_MAX = 80, TURN_CHARS = 600;

// Tokens, credentials and long hex ids out before anything is written: a transcript of this fleet
// holds self-tokens, share passwords and test-instance links by construction.
const scrub = (s) => s
  .replace(/(token=|FLEET_[A-Z_]*TOKEN[=: ]+|x-fleet-self-token: |Bearer )\S+/g, "$1…")
  .replace(/\b[0-9a-f]{32,}\b/g, "…");

function turnsOf(file) {
  const out = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.type !== "user" && r.type !== "assistant") continue;
    const c = r.message?.content;
    const parts = typeof c === "string" ? [{ type: "text", text: c }] : Array.isArray(c) ? c : [];
    const text = parts.filter((p) => p.type === "text" && p.text?.trim()).map((p) => p.text).join("\n");
    const tools = parts.filter((p) => p.type === "tool_use").map((p) => p.name);
    if (!text && !tools.length) continue;
    // a run of tool-only turns is one line ("⚙ Bash ×12"), not twelve empty bubbles
    const prev = out.at(-1);
    if (!text && prev && !prev.text && prev.who === "assistant" && r.type === "assistant") { prev.tools.push(...tools); continue; }
    out.push({ who: r.type, at: r.timestamp ?? null,
      text: scrub(text.length > TURN_CHARS ? text.slice(0, TURN_CHARS) + " …" : text), tools });
  }
  // the beginning (what it was asked) and the end (where it stopped) are the two ends a reader
  // looks back for; the middle is elided and counted
  if (out.length <= TURNS_MAX) return { turns: out, elided: 0 };
  const head = out.slice(0, 20), tail = out.slice(-(TURNS_MAX - 20));
  return { turns: [...head, { who: "gap", text: `${out.length - TURNS_MAX} turns elided` }, ...tail], elided: out.length - TURNS_MAX };
}

function laneChain(id) {
  const s = st.slots?.[String(id)];
  if (!s?.worktree) return null;
  const byOcc = new Map();
  for (const r of reports)
    if (r.status === "handoff" && r.worker.slot === id && r.worker.branch === s.worktree.branch && r.worker.openedAt < s.openedAt)
      byOcc.set(r.worker.openedAt, r);
  const past = [...byOcc.values()].sort((a, b) => a.worker.openedAt - b.worker.openedAt).map((r) => {
    const file = r.worker.sessionId ? `${homedir()}/.claude/projects/${slug(r.worker.cwd)}/${r.worker.sessionId}.jsonl` : null;
    const has = !!file && existsSync(file);
    return { startedAt: r.worker.openedAt, handedAt: r.reportedAt, report: r.id, sessionId: r.worker.sessionId,
      handoff: scrub(r.text), transcript: has ? turnsOf(file) : null,
      why: has ? null : r.worker.sessionId ? "the transcript file is gone from disk" : "the report names no session" };
  });
  return { id, label: s.label ?? "", kind: "lane", branch: s.worktree.branch, openedAt: s.openedAt, past };
}

function mainChain(id) {
  const s = st.slots?.[String(id)];
  if (!s?.lineageId) return null;
  const past = (st.lineageHandovers ?? []).filter((h) => h.lineageId === s.lineageId).sort((a, b) => a.at - b.at)
    .map((h) => ({ startedAt: h.from.openedAt, handedAt: h.at, report: null, sessionId: null, fromSlot: h.from.slot,
      handoff: scrub(h.intent ?? (h.pointer ? `pointer: ${h.pointer}` : "")), transcript: null,
      why: "a lineage record names slot + openedAt only — which conversation that occupant was is written down nowhere" }));
  return { id, label: s.label ?? "", kind: "main", openedAt: s.openedAt, past };
}

const chains = [laneChain(Number(laneArg ?? 4)), mainChain(Number(mainArg ?? 1))].filter(Boolean);
const others = Object.entries(st.slots ?? {}).filter(([, s]) => s?.cwd).map(([k, s]) => ({ id: Number(k), label: s.label ?? "" }))
  .filter((o) => !chains.some((c) => c.id === o.id));
const data = JSON.stringify({ chains, others, built: Date.now() }).replace(/</g, "\\u003c");

writeFileSync(outFile, `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Band ziehen</title>
<style>
:root { --ink:#e7e7ea; --prose:#d4d4d8; --mute:#8b8b94; --faint:#5c5c66; --surface:#111113; --raised:#17171a;
  --edge:#26262b; --edge-soft:#1b1b1f; --void:#000; --wait:#e0a458;
  --sans: ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif;
  --mono: ui-monospace,"SF Mono",Menlo,Consolas,monospace; }
* { box-sizing: border-box; }
body { margin:0; background:var(--void); color:var(--prose); font:13px/1.45 var(--sans); display:flex; height:100vh; overflow:hidden; }
#side { width:268px; flex:none; border-right:1px solid var(--edge-soft); padding:12px 8px; overflow-y:auto; }
#side h1 { font-size:13px; color:var(--ink); margin:2px 6px 12px; font-weight:600; }
.row { padding:6px 8px; border-radius:12px; margin-bottom:2px; }
.row.static { display:flex; gap:6px; align-items:center; color:var(--mute); }
.n { font:12px/1.45 var(--mono); padding:1px 6px; border-radius:5px; background:var(--raised); box-shadow:inset 0 0 0 1px var(--edge); color:var(--mute); flex:none; }
.row.band { background:var(--surface); border:1px solid var(--edge-soft); padding:6px 0 8px; outline:none; }
.row.band:focus-visible { border-color:var(--edge); }
.bandhead { display:flex; gap:6px; align-items:center; padding:0 8px 6px; }
.bandhead .lbl { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink); }
.pos { font:11px var(--mono); color:var(--faint); flex:none; }
.view { overflow:hidden; touch-action:pan-y; cursor:grab; user-select:none; }
.view.drag { cursor:grabbing; }
.track { display:flex; gap:4px; transition:transform .28s cubic-bezier(.2,.8,.2,1); will-change:transform; }
.view.drag .track { transition:none; }
.box { flex:none; border-radius:9px; padding:7px 9px; background:var(--raised); box-shadow:inset 0 0 0 1px var(--edge); min-height:52px; }
.box .t { font:12px var(--sans); color:var(--ink); }
.box .s { font:11px var(--mono); color:var(--faint); margin-top:2px; }
.box.past { background:var(--surface); }
.box.past .t { color:var(--mute); }
.box.live { box-shadow:inset 0 0 0 1px var(--mute); }
.box.sel { box-shadow:inset 0 0 0 1.5px var(--ink); }
.hint { font-size:11px; color:var(--faint); padding:6px 8px 0; }
#main { flex:1; min-width:0; display:flex; flex-direction:column; }
#head { padding:14px 22px 10px; border-bottom:1px solid var(--edge-soft); }
#head .t { color:var(--ink); font-size:15px; font-weight:600; }
#head .s { color:var(--mute); font:12px var(--mono); margin-top:3px; word-break:break-all; }
#head .acts { margin-top:8px; display:flex; gap:6px; }
button { font:12px var(--sans); color:var(--prose); background:var(--raised); border:1px solid var(--edge); border-radius:7px; padding:4px 10px; cursor:pointer; }
button[disabled] { color:var(--faint); cursor:not-allowed; }
#body { flex:1; overflow-y:auto; padding:14px 22px 40px; }
.hand { border:1px solid var(--edge); border-radius:10px; padding:10px 12px; margin-bottom:16px; background:var(--surface); white-space:pre-wrap; font-size:12px; color:var(--prose); max-height:220px; overflow:auto; }
.hand b { color:var(--ink); font-weight:600; }
.turn { margin:0 0 10px; padding:8px 12px; border-radius:10px; white-space:pre-wrap; word-break:break-word; max-width:860px; }
.turn.user { background:var(--raised); color:var(--ink); }
.turn.assistant { color:var(--prose); }
.turn .tools { font:11px var(--mono); color:var(--faint); margin-top:4px; }
.turn.gap { color:var(--faint); font-style:italic; text-align:center; }
.empty { color:var(--wait); border:1px dashed var(--edge); border-radius:10px; padding:14px; max-width:620px; }
.live { color:var(--mute); }
@media (max-width: 700px) { body { flex-direction:column; } #side { width:auto; max-height:45vh; border-right:0; border-bottom:1px solid var(--edge-soft); } }
</style></head><body>
<nav id="side"><h1>Band ziehen · Entwurf</h1><div id="rows"></div>
<div class="hint">Ziehe ein Band nach rechts, um auf die vorherige Session zu kommen (auch: Klick auf den Rand links, ← → mit Fokus, Shift+Rad).</div></nav>
<main id="main"><div id="head"></div><div id="body"></div></main>
<script>
const D = ${data};
const fmt = (t) => t ? new Date(t).toLocaleString() : "—";
const rows = document.getElementById("rows"), head = document.getElementById("head"), body = document.getElementById("body");
const PEEK = 20, GAP = 4;
let active = null; // {chain, i}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function show(chain, i) {
  active = { chain, i };
  const live = i === chain.past.length, p = chain.past[i];
  head.replaceChildren(); body.replaceChildren();
  const t = el("div", "t", "Slot " + chain.id + " · Session " + (i + 1) + " von " + (chain.past.length + 1) + (live ? " · läuft" : ""));
  head.append(t);
  if (live) {
    head.append(el("div", "s", (chain.label || "") + " · seit " + fmt(chain.openedAt)));
    body.append(el("p", "live", "Die laufende Session ist das Terminal dieses Slots, wie heute. Zieh das Band nach rechts, um zurückzugehen."));
    return;
  }
  head.append(el("div", "s", "begann " + fmt(p.startedAt) + " · übergab " + fmt(p.handedAt)
    + (p.fromSlot && p.fromSlot !== chain.id ? " · saß damals auf Slot " + p.fromSlot : "")
    + (p.sessionId ? " · " + p.sessionId : "") + (p.report ? " · Report " + p.report : "")));
  const acts = el("div", "acts");
  const sum = el("button", null, "✨ analysieren"); sum.disabled = !p.transcript;
  sum.title = "die ✨-Zusammenfassung, die es für die laufende Session gibt — hier auf dieses Transkript gerichtet (im Entwurf nicht verdrahtet)";
  acts.append(sum); head.append(acts);
  if (p.handoff) { const h = el("div", "hand"); h.append(el("b", null, chain.kind === "lane" ? "Übergabe-Report\\n" : "Linien-Record\\n"), document.createTextNode(p.handoff)); body.append(h); }
  if (!p.transcript) { body.append(el("div", "empty", "Kein Transkript: " + p.why + ".")); return; }
  for (const x of p.transcript.turns) {
    const d = el("div", "turn " + x.who, x.text || "");
    if (x.tools && x.tools.length) {
      const c = new Map(); for (const n of x.tools) c.set(n, (c.get(n) || 0) + 1);
      d.append(el("div", "tools", "⚙ " + [...c].map(([n, k]) => k > 1 ? n + " ×" + k : n).join(" · ")));
    }
    body.append(d);
  }
}

function bandRow(chain) {
  const n = chain.past.length + 1;
  const row = el("div", "row band"); row.tabIndex = 0;
  const hd = el("div", "bandhead");
  const pos = el("span", "pos");
  hd.append(el("span", "n", String(chain.id)), el("span", "lbl", chain.label || (chain.kind === "lane" ? chain.branch : "")), pos);
  const view = el("div", "view"), track = el("div", "track");
  view.append(track); row.append(hd, view);
  const boxes = [];
  for (let k = 0; k < n; k++) {
    const live = k === n - 1, p = chain.past[k];
    const b = el("div", "box " + (live ? "live" : "past"));
    b.append(el("div", "t", "Session " + (k + 1) + (live ? " · läuft" : "")),
      el("div", "s", live ? "seit " + fmt(chain.openedAt) : fmt(p.startedAt) + (p.transcript ? "" : " · ohne Transkript")));
    track.append(b); boxes.push(b);
  }
  let idx = n - 1, W = 0;
  const x = (i) => -(i * (W + GAP)) + (i > 0 ? PEEK : 0);
  const layout = () => { W = view.clientWidth - PEEK - 8; boxes.forEach((b) => b.style.width = W + "px"); };
  const go = (i, open) => {
    idx = Math.max(0, Math.min(n - 1, i));
    track.style.transform = "translateX(" + x(idx) + "px)";
    boxes.forEach((b, k) => b.classList.toggle("sel", k === idx && active && active.chain === chain));
    pos.textContent = (idx + 1) + "/" + n;
    if (open !== false) { show(chain, idx); document.querySelectorAll(".box.sel").forEach((b) => b.classList.remove("sel")); boxes[idx].classList.add("sel"); }
  };
  // THE GESTURE: drag the band sideways. Right = back in time. It snaps to the nearest session,
  // a flick of more than a fifth of a box goes one further, and landing opens that session.
  let start = null, moved = 0;
  view.addEventListener("pointerdown", (e) => { start = e.clientX; moved = 0; view.setPointerCapture(e.pointerId); view.classList.add("drag"); });
  view.addEventListener("pointermove", (e) => {
    if (start === null) return; moved = e.clientX - start;
    track.style.transform = "translateX(" + (x(idx) + moved) + "px)";
  });
  const end = (e) => {
    if (start === null) return; view.classList.remove("drag"); start = null;
    if (Math.abs(moved) < 4) {
      // a click: on the peeking edge = one back, anywhere else = open what is shown
      const r = view.getBoundingClientRect();
      go(e.clientX - r.left < PEEK + 4 && idx > 0 ? idx - 1 : idx); return;
    }
    const step = Math.round(-moved / (W + GAP)) || (Math.abs(moved) > W / 5 ? (moved > 0 ? -1 : 1) : 0);
    go(idx + step);
  };
  view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
  view.addEventListener("wheel", (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!d) return; e.preventDefault();
    clearTimeout(view._w); view._w = setTimeout(() => go(idx + (d > 0 ? 1 : -1)), 60);
  }, { passive: false });
  row.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") go(idx - 1); if (e.key === "ArrowRight") go(idx + 1); });
  rows.append(row);
  requestAnimationFrame(() => { layout(); go(idx, false); });
  addEventListener("resize", () => { layout(); go(idx, false); });
  return { go };
}

const others = D.others.slice().sort((a, b) => a.id - b.id);
const byId = new Map(D.chains.map((c) => [c.id, c]));
// it opens where the owner's question starts: the band that HAS a past to read, on its running session
let first = null;
for (const id of [...new Set([...others.map((o) => o.id), ...D.chains.map((c) => c.id)])].sort((a, b) => a - b)) {
  const c = byId.get(id);
  if (c) { const r = bandRow(c); if (!first || c.past.some((p) => p.transcript)) first = { r, c }; continue; }
  const o = others.find((x) => x.id === id);
  const row = el("div", "row static"); row.append(el("span", "n", String(id)), el("span", null, o.label || "—")); rows.append(row);
}
if (first) requestAnimationFrame(() => first.r.go(first.c.past.length));
</script></body></html>`);
console.log(`wrote ${outFile}: ${chains.map((c) => `slot ${c.id} (${c.kind}) ${c.past.length} past, ${c.past.filter((p) => p.transcript).length} with transcript`).join(" · ")}`);
