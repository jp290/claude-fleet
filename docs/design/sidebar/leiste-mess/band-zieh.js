// A CLICKABLE MOCKUP OF THE BAND GESTURE (owner 2026-09-21: "Ich möchte das man die einzelnen
// session slots quasi durch ein Band ziehen kann, um so dann z.b das transscript der vorherigen
// session ansehen und analysieren zu können"). Not product code: it builds ONE html file from the
// REAL succession chain of two slots of a running fleet, and writes it OUTSIDE the checkout —
// transcripts are private working material and never enter the tree.
//
//   bun band-zieh.js <fleet.json> <out.html> <lane-slot> <main-slot> [sessions.json]
//
// sessions.json is optional: the body of GET /api/sessions (owner token). With it, ctx and the
// state come from the live poll itself; without it (a lane's self-token gets 401 there) they are
// computed the way the server computes them — see "THE ROW'S READINGS" below.
//
// Where each past session comes from — the same sources a product route would have (the note:
// docs/messungen/2026-09-21-band-transkript-quelle.md):
//  · a LANE's past occupants are its `handoff` reports (slot + branch); each report's worker carries
//    `sessionId` + `cwd`, and ~/.claude/projects/<slug(cwd)>/<sessionId>.jsonl is its transcript.
//  · a MAIN's past occupants are its lineage records' `from` sides — slot + openedAt, NO sessionId.
//    Nothing ties them to a transcript, and the mockup says so instead of guessing by time.
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { contextWindowFor, FLEET_DEFAULT_MODEL } from "../../../../src/protocol.ts";

const [stateFile, outFile, laneArg, mainArg, sessionsFile] = process.argv.slice(2);
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

// THE ROW'S READINGS (owner round 8: "die beiden aktivitätsleuchten und auch das Kontext level"). The
// same three facts src/client.ts#slotRow draws, from the same sources:
//  · ctx — server.ts#contextFill: the LAST usage record of the pinned claude transcript, input plus
//    both cache tiers, over protocol.ts#contextWindowFor(model, default FLEET_DEFAULT_MODEL). A
//    harness Fleet reads differently (Codex: its rollout) is not read here and says so; nothing
//    becomes 0.
//  · state — src/client.ts#slotState: work under RECENT_MS since the last output, asleep from
//    SLEEP_MS, otherwise resting; broken when stalled / no agent. Without the live poll the last
//    output is the transcript's mtime, a snapshot at build time.
//  · a lane's lifecycle — the lcdot on main: editing (uncommitted) / ready (commits to land) / clean,
//    read with git in the worktree.
// A PAST session has no live state: it gets its ctx at the handover (its own transcript's last usage
// record) and nothing else.
const RECENT_MS = 5000, SLEEP_MS = 30 * 60_000, CTX_TAIL = 256 * 1024, NOW = Date.now();
const polled = sessionsFile ? new Map((JSON.parse(readFileSync(sessionsFile, "utf8")).slots ?? []).map((x) => [x.id, x])) : null;
const pollNow = sessionsFile ? JSON.parse(readFileSync(sessionsFile, "utf8")).now ?? NOW : NOW;
const transcriptOf = (cwd, sid) => `${homedir()}/.claude/projects/${slug(cwd)}/${sid}.jsonl`;
function lastUsage(file) {
  let text;
  try { const size = statSync(file).size, from = Math.max(0, size - CTX_TAIL), fd = openSync(file, "r"), buf = Buffer.alloc(size - from);
    const n = readSync(fd, buf, 0, buf.length, from); closeSync(fd); text = buf.toString("utf8", 0, n); } catch { return null; }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    let u; try { u = JSON.parse(lines[i]).message?.usage; } catch { continue; }
    if (typeof u !== "object" || u === null) continue;
    const num = (k) => (typeof u[k] === "number" && u[k] >= 0 ? u[k] : 0);
    return num("input_tokens") + num("cache_creation_input_tokens") + num("cache_read_input_tokens");
  }
  return null;
}
const isClaude = (s) => !s.harness || s.harness === "claude";
const windowOf = (s) => (isClaude(s) ? contextWindowFor(s.model ?? FLEET_DEFAULT_MODEL) : null);
const fill = (used, win) => (used != null && win ? { usedTokens: used, windowTokens: win, pct: Math.round((used / win) * 1000) / 10 } : null);
function liveFacts(id) {
  const s = st.slots[String(id)], p = polled?.get(id);
  let git = null;
  if (s.worktree) try {
    const dirty = execFileSync("git", ["-C", s.cwd, "status", "--porcelain"], { encoding: "utf8" }).split("\n").filter(Boolean).length;
    const ahead = Number(execFileSync("git", ["-C", s.cwd, "rev-list", "--count", "main..HEAD"], { encoding: "utf8" }).trim());
    git = { dirty, ahead, life: dirty > 0 ? "editing" : ahead > 0 ? "ready" : "clean" };
  } catch { git = null; }
  if (p) {
    const age = pollNow - p.lastOutput, bad = p.stalled || p.agent === "no-agent" || p.agent === "no-pane";
    return { ctx: p.ctx ?? null, why: p.ctx ? null : "der Server kann diesen Slot nicht messen", source: "live-poll",
      state: bad ? "bad" : age < RECENT_MS ? "work" : age >= SLEEP_MS ? "sleep" : "rest", age, git };
  }
  const file = isClaude(s) && s.sessionId ? transcriptOf(s.cwd, s.sessionId) : null;
  let mtime = null; try { mtime = file ? statSync(file).mtimeMs : null; } catch { mtime = null; }
  const ctx = fill(mtime != null ? lastUsage(file) : null, windowOf(s)), age = mtime == null ? null : NOW - mtime;
  return { ctx, source: "transcript", git, age,
    why: ctx ? null : !isClaude(s) ? `Harness ${s.harness}: den liest der Server selbst (Rollout), dieser Entwurf nicht` : "kein usage-Eintrag im Transkript",
    state: age == null ? null : age < RECENT_MS ? "work" : age >= SLEEP_MS ? "sleep" : "rest" };
}

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
      ctxEnd: has ? fill(lastUsage(file), windowOf(s)) : null,
      handoff: scrub(r.text), transcript: has ? turnsOf(file) : null,
      why: has ? null : r.worker.sessionId ? "die Transkript-Datei ist nicht mehr auf der Platte" : "der Report nennt keine Session" };
  });
  return { id, label: s.label ?? "", kind: "lane", branch: s.worktree.branch, openedAt: s.openedAt, past, live: liveFacts(id) };
}

function mainChain(id) {
  const s = st.slots?.[String(id)];
  if (!s?.lineageId) return null;
  const past = (st.lineageHandovers ?? []).filter((h) => h.lineageId === s.lineageId).sort((a, b) => a.at - b.at)
    .map((h) => ({ startedAt: h.from.openedAt, handedAt: h.at, report: null, sessionId: null, fromSlot: h.from.slot,
      handoff: scrub(h.intent ?? (h.pointer ? `pointer: ${h.pointer}` : "")), transcript: null,
      why: "ein Linien-Record nennt nur Slot und Startzeit — welches Gespräch diese Session war, steht nirgends" }));
  return { id, label: s.label ?? "", kind: "main", openedAt: s.openedAt, past, live: liveFacts(id) };
}

const chains = [laneChain(Number(laneArg ?? 4)), mainChain(Number(mainArg ?? 1))].filter(Boolean);
const others = Object.entries(st.slots ?? {}).filter(([, s]) => s?.cwd).map(([k, s]) => ({ id: Number(k), label: s.label ?? "", live: liveFacts(Number(k)) }))
  .filter((o) => !chains.some((c) => c.id === o.id));
const data = JSON.stringify({ chains, others, built: Date.now() }).replace(/</g, "\\u003c");
const hintFile = outFile.replace(/\.html$/, "") + "-andeutung.html";
const hintName = hintFile.split("/").pop();

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
<nav id="side"><h1>Band ziehen · Entwurf <a href="${hintName}" style="color:var(--mute);font-weight:400;margin-left:6px">→ Andeutung</a></h1><div id="rows"></div>
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
writeFileSync(hintFile, hintPage(data));
console.log(`wrote ${outFile} + ${hintName}: ${chains.map((c) => `slot ${c.id} (${c.kind}) ${c.past.length} past, ${c.past.filter((p) => p.transcript).length} with transcript`).join(" · ")}`);

// THE BAND, NOT DRAWN — FASSUNG A, WITH A GESTURE THAT DOES NOT CATCH (owner round 4, 2026-09-21:
// "lieberminimalistisch mit einer andeutung das man das so ziehen kann"; round 5: "Strich am rand
// finde ich super, aber die bedienung ist ziemlich hakelig gerade.."). B is gone; A is the hint: a
// 2px sliver on the row's left edge, only on a row that has a past; on a past session it moves to
// the right edge and points back to the present. The row drops its state glyph there.
//
// What made round 4 catch, each one driven over CDP before it was changed:
//  · a trackpad swipe did not move the row at all while the fingers moved — the wheel handler
//    debounced to ONE step 60 ms after the last event, and macOS keeps sending momentum events for
//    most of a second: the step came ~1 s late, and any gap in the tail stepped again (1 to 3
//    sessions per swipe, depending on timing);
//  · a quick flick did nothing: release looked at distance only (a fifth of the row, ~47 px);
//  · no dead zone and no direction decision: every pixel of sideways drift moved the band, also
//    during a vertical movement, and every release re-rendered the main pane;
//  · a press during the snap animation jumped the band ~25 px (it restarted from the target, not
//    from where the eye saw it);
//  · a mostly vertical trackpad scroll with a little sideways noise stepped the band.
// The rules below answer those one by one: 7 px dead zone, then horizontal or vertical is decided
// once; the row follows 1:1 through a transform written once per frame; release snaps by distance
// OR speed with a short spring; a swipe commits the moment it is a third across and swallows the
// rest of its momentum (one swipe, one session); a press grabs the band where it visibly is; ← → on
// focus; no click fires after a drag.
//
// Round 6 (owner: "für bessere Mausbedienung sollten wir glaube ich einen faktor einführen der es
// einfacher macht zu wechseln, vlt auch eine bessere animation die dann auch einrastet und nicht
// komplett dem mauszeiger folgt"). For the MOUSE only — trackpad and finger keep round 5 — the
// pointer decides and the animation moves: while the button is down the row only leans, damped and
// capped (a share of its width, never 1:1), and the moment the pull passes a short threshold the
// next session snaps in with a spring, button still down. Pull on and it steps again once the snap
// has landed. Round 7 chose "weich": 40 px to switch, lean k=0.8 capped at 28 % of the row, 380 ms
// with a soft overshoot ("knapp", 24 px / 220 ms, is gone).
//
// Round 7 (owner: "ich hätte gerne noch einen indikator oder so wie viele sessions kommen"): a depth
// indicator, switchable between two forms (#punkte / #zahl). It is not a second permanent element —
// the sliver stays the only one — so it shows only on hover, focus, while pulling, and for a moment
// after a step. Dots: one per session, oldest left, the present right, the current one lit; past
// seven the dots become a window that slides with the position, and a smaller end dot says there is
// more beyond it — 14 sessions never overflow the row. Number: position/total in the corner.
// DEPTH is how far back a row reaches, read in ONE place (reach); the later setting "only the last
// 3 or 5 sessions" is a one-liner there, and the indicator then counts the capped depth.
// Round 8 chose the dots (the number is gone).
//
// Round 8 (owner: "die kennwerte wie z.b die beiden aktivitätsleuchten und auch das Kontext level,
// klar&sauber in die dargestellten slots zu integrieren"). The two lights are main's: the state
// glyph (four shapes: work disc, rest ring, sleep bar, broken cross) and, on a lane, the lifecycle
// dot (editing filled amber, ready green ring, clean none). The ctx level sits between the label
// and them. Two forms, #reihe / #ring:
//   Reihe — "24%" as mono text, then the lights; "?" when it cannot be measured, never 0.
//   Ring  — ctx as a thin arc AROUND the state glyph, so the two share one place; unmeasurable =
//           a dashed ring. The number is in the tooltip.
// Both sit on the vertical centre, the dots on the bottom edge: they cannot meet. A past session has
// no lamps — only its ctx at the handover, faint, and only where its transcript measured it.
function hintPage(data) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Band ziehen · Kante</title>
<style>
:root { --ink:#e7e7ea; --prose:#d4d4d8; --mute:#8b8b94; --faint:#5c5c66; --surface:#111113; --raised:#17171a;
  --hover:#141416; --edge:#26262b; --edge-soft:#1b1b1f; --void:#000; --wait:#e0a458; --live:#3fb950; --danger:#f85149;
  --sans: ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif;
  --mono: ui-monospace,"SF Mono",Menlo,Consolas,monospace; }
* { box-sizing: border-box; }
body { margin:0; background:var(--void); color:var(--prose); font:13px/1.45 var(--sans); display:flex; height:100vh; overflow:hidden; }
.side { width:268px; flex:none; border-right:1px solid var(--edge-soft); padding:12px 8px; overflow-y:auto; display:flex; flex-direction:column; }
.side h1 { font-size:12px; color:var(--mute); margin:2px 6px 10px; font-weight:500; }
.side h1 b { color:var(--ink); font-weight:600; }
.rows { flex:1; }
.how { font-size:11px; color:var(--faint); margin:12px 6px 2px; line-height:1.5; }
.row { position:relative; border-radius:12px; margin-bottom:2px; }
.row:hover, .row:focus-within { background:var(--hover); }
.row.cur { background:var(--raised); box-shadow:inset 0 0 0 1px var(--edge); }
.view { overflow:hidden; border-radius:12px; touch-action:pan-y; user-select:none; -webkit-user-select:none; outline:none; }
.row.pull .view { cursor:grab; }
.view.drag { cursor:grabbing; }
.track { display:flex; will-change:transform; }
.track.snap { transition:transform .34s cubic-bezier(.22,1.22,.36,1); }
.track.snap.mouse { transition:transform var(--snap-ms) var(--snap-ease); }
.feel { display:flex; gap:2px; margin:0 6px 10px; padding:2px; border-radius:8px; background:var(--surface); box-shadow:inset 0 0 0 1px var(--edge-soft); width:max-content; }
.feel button { border:0; background:none; color:var(--mute); padding:2px 10px; border-radius:6px; font:11px var(--sans); cursor:pointer; }
.feel button[aria-pressed="true"] { background:var(--raised); color:var(--ink); box-shadow:inset 0 0 0 1px var(--edge); }
.feelvals { font:11px var(--mono); color:var(--faint); margin:-4px 6px 10px; }
.depth { position:absolute; pointer-events:none; opacity:0; transition:opacity .15s; z-index:1; }
.row.pull:hover .depth, .row.pull:focus-within .depth, .row.pull.dragging .depth, .row.pull.stepped .depth { opacity:1; }
.depth.dots { left:0; right:0; bottom:3px; display:flex; justify-content:center; align-items:center; gap:3px; }
.depth.dots i { width:4px; height:4px; border-radius:2px; background:var(--edge); transition:width .2s, background .2s; }
.depth.dots i.on { width:10px; background:var(--mute); }
.depth.dots i.more { width:2px; height:2px; }
.kv { display:flex; align-items:center; gap:6px; flex:none; }
.ctx { font:11px/1 var(--mono); color:var(--mute); font-variant-numeric:tabular-nums; }
.ctx.unknown { color:var(--faint); }
.cell.past .ctx { color:var(--faint); }
.lc { width:6px; height:6px; border-radius:50%; flex:none; }
.lc.editing { background:var(--wait); }
.lc.ready { box-shadow:inset 0 0 0 1.5px var(--live); }
.st { width:8px; height:8px; border-radius:50%; flex:none; background:var(--live); }
.st.rest { background:none; box-shadow:inset 0 0 0 1.5px var(--mute); }
.st.sleep { border-radius:0; background:linear-gradient(var(--faint), var(--faint)) center / 8px 2px no-repeat; }
.st.bad { border-radius:1px; background:var(--danger); clip-path:polygon(20% 0,50% 30%,80% 0,100% 20%,70% 50%,100% 80%,80% 100%,50% 70%,20% 100%,0 80%,30% 50%,0 20%); }
.st.unknown { background:none; box-shadow:none; outline:1px dashed var(--faint); outline-offset:-1px; }
.ring { position:relative; width:16px; height:16px; flex:none; display:grid; place-items:center; border-radius:50%;
  background:conic-gradient(var(--mute) calc(var(--p) * 1%), var(--edge) 0);
  -webkit-mask:radial-gradient(circle, transparent 5.5px, #000 6px); mask:radial-gradient(circle, transparent 5.5px, #000 6px); }
.ring.unknown { background:none; -webkit-mask:none; mask:none; box-shadow:none; outline:1px dashed var(--faint); outline-offset:-1px; }
.cell.past .ring { background:conic-gradient(var(--faint) calc(var(--p) * 1%), var(--edge-soft) 0); }
.ringwrap { position:relative; width:16px; height:16px; flex:none; display:grid; place-items:center; }
.ringwrap > .ring { position:absolute; inset:0; }
.ringwrap > .st { width:6px; height:6px; }
.ringwrap > .st.sleep { background-size:6px 2px; }
.cell { flex:none; display:flex; align-items:center; gap:6px; min-height:40px; padding:6px 10px 6px 30px; }
.cell.past { padding-right:12px; background:var(--surface); }
.n { font:12px/1.45 var(--mono); padding:1px 6px; border-radius:5px; background:var(--raised); box-shadow:inset 0 0 0 1px var(--edge); color:var(--mute); flex:none; }
.lbl { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cell.past .lbl { color:var(--mute); }
.when { font:11px var(--mono); color:var(--faint); flex:none; }

/* the hint: one 2px sliver — left while the present shows (a past lies under it), right on a past
   session (the present lies that way) */
.row.pull::before { content:""; position:absolute; left:3px; top:9px; bottom:9px; width:2px; border-radius:1px; background:var(--edge); transition:background .15s; z-index:1; pointer-events:none; }
.row.pull:hover::before, .row.pull:focus-within::before, .row.pull.dragging::before { background:var(--faint); }
.row.pull.back::before { left:auto; right:3px; background:var(--faint); }
.view:focus-visible { box-shadow:inset 0 0 0 1px var(--mute); }
#main { flex:1; min-width:0; display:flex; flex-direction:column; }
#head { padding:14px 22px 10px; border-bottom:1px solid var(--edge-soft); }
#head .t { color:var(--ink); font-size:15px; font-weight:600; }
#head .s { color:var(--mute); font:12px var(--mono); margin-top:3px; word-break:break-all; }
#head .acts { margin-top:8px; }
button { font:12px var(--sans); color:var(--prose); background:var(--raised); border:1px solid var(--edge); border-radius:7px; padding:4px 10px; }
button[disabled] { color:var(--faint); }
#body { flex:1; overflow-y:auto; padding:14px 22px 40px; }
.hand { border:1px solid var(--edge); border-radius:10px; padding:10px 12px; margin-bottom:16px; background:var(--surface); white-space:pre-wrap; font-size:12px; max-height:200px; overflow:auto; }
.turn { margin:0 0 10px; padding:8px 12px; border-radius:10px; white-space:pre-wrap; word-break:break-word; max-width:860px; }
.turn.user { background:var(--raised); color:var(--ink); }
.turn .tools { font:11px var(--mono); color:var(--faint); margin-top:4px; }
.turn.gap { color:var(--faint); font-style:italic; text-align:center; }
.empty { color:var(--wait); border:1px dashed var(--edge); border-radius:10px; padding:14px; max-width:620px; }
.note { color:var(--mute); max-width:640px; }
@media (max-width: 700px) { body { flex-direction:column; } .side { width:auto; max-height:45vh; border-right:0; border-bottom:1px solid var(--edge-soft); } }
@media (prefers-reduced-motion: reduce) { .track.snap, .track.snap.mouse { transition:none; } }
</style></head><body>
<nav class="side A"><h1><b>Band ziehen</b> · Strich am Rand</h1>
<div class="feel" role="group" aria-label="Kennwerte"><button data-kv="reihe">Reihe</button><button data-kv="ring">Ring</button></div>
<div class="feelvals"></div><div class="rows"></div>
<div class="how">Zeile nach rechts ziehen = frühere Session · Maus: kurz anziehen, sie rastet selbst ein · Finger oder waagrecht wischen · ← → mit Fokus · Esc = laufende</div></nav>
<main id="main"><div id="head"></div><div id="body"></div></main>
<script>
const D = ${data};
const SLOP = 7, COMMIT = 0.2, FLICK = 0.35, SWIPE_COMMIT = 0.33, WHEEL_IDLE = 90, MOMENTUM_GAP = 180, SNAP_MS = 340;
// the mouse (round 7: "weich"): T px to switch, lean slope k, lean cap as a share of the row, snap
const FEEL = { T: 40, k: 0.8, cap: 0.28, ms: 380, ease: "cubic-bezier(.2,1.3,.3,1)" };
// how many past sessions a row reaches back — the later setting (3 or 5) replaces this one value
const DEPTH = Infinity;
const reach = (chain) => { const past = chain.past.slice(-DEPTH); return { ...chain, past, hidden: chain.past.length - past.length }; };
const MAX_DOTS = 7, STEPPED_MS = 1200;
const still = matchMedia("(prefers-reduced-motion: reduce)");
document.documentElement.style.setProperty("--snap-ms", FEEL.ms + "ms");
document.documentElement.style.setProperty("--snap-ease", FEEL.ease);
let KV = "reihe";
const readings = [];
function setKv(name) {
  KV = name === "ring" ? "ring" : "reihe";
  document.querySelectorAll(".feel button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kv === KV)));
  document.querySelector(".feelvals").textContent = "Stand " + short(D.built) + " · Tiefe " + (DEPTH === Infinity ? "alle" : DEPTH);
  if (location.hash !== "#" + KV) history.replaceState(null, "", "#" + KV);
  readings.forEach((f) => f());
}
document.querySelectorAll(".feel button").forEach((b) => b.addEventListener("click", () => setKv(b.dataset.kv)));
const STATE_WORD = { work: "arbeitet", rest: "ruht", sleep: "schläft — seit 30 min oder mehr still", bad: "kaputt — hängt, oder kein Agent in der Pane" };
const LIFE_WORD = { editing: "in Arbeit — nicht committet", ready: "bereit — Commits warten aufs Landen", clean: "sauber" };
const ago = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? "gerade eben" : m < 60 ? "vor " + m + " min" : m < 1440 ? "vor " + Math.round(m / 60) + " h" : "vor " + Math.round(m / 1440) + " d"; };
const ctxTitle = (c, why, end) => c ? (end ? "Kontext beim Übergeben — " : "Kontext — ") + c.usedTokens.toLocaleString() + " von " + c.windowTokens.toLocaleString() + " Tokens (" + c.pct + " %)"
  : "Kontext unbekannt — " + (why || "nicht gemessen") + ". Kein leerer Kontext.";
// the readings of ONE cell, drawn fresh for the current form; a past cell gets only its end ctx
function kvOf(live, past) {
  const box = el("span", "kv");
  if (past) {
    if (!past.ctxEnd) return box;
    if (KV === "ring") { const r = el("span", "ring"); r.style.setProperty("--p", String(past.ctxEnd.pct)); r.title = ctxTitle(past.ctxEnd, null, true); box.append(r); }
    else { const t = el("span", "ctx", Math.round(past.ctxEnd.pct) + "%"); t.title = ctxTitle(past.ctxEnd, null, true); box.append(t); }
    return box;
  }
  if (!live) return box;
  if (live.git && live.git.life !== "clean") {
    const d = el("span", "lc " + live.git.life);
    d.title = "Lane: " + LIFE_WORD[live.git.life] + " — " + live.git.dirty + " nicht committet, " + live.git.ahead + " zu landen";
    box.append(d);
  }
  const st = el("span", "st " + (live.state || "unknown"));
  st.title = live.state ? STATE_WORD[live.state] + (live.age != null ? " · letzte Ausgabe " + ago(live.age) : "") + (live.source === "transcript" ? " (Transkript, Stand des Entwurfs)" : "")
    : "Zustand in diesem Entwurf nicht gelesen";
  if (KV === "ring") {
    const w = el("span", "ringwrap"), r = el("span", "ring" + (live.ctx ? "" : " unknown"));
    if (live.ctx) r.style.setProperty("--p", String(live.ctx.pct));
    w.title = ctxTitle(live.ctx, live.why) + "\\n" + st.title; w.append(r, st); box.append(w);
  } else {
    const t = el("span", "ctx" + (live.ctx ? "" : " unknown"), live.ctx ? Math.round(live.ctx.pct) + "%" : "?");
    t.title = ctxTitle(live.ctx, live.why); box.append(t, st);
  }
  return box;
}
const fmt = (t) => t ? new Date(t).toLocaleString() : "—";
const short = (t) => t ? new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
// a past cell's time: the clock alone when it is from the build's day, the date alone otherwise —
// the full stamp took the width the session's name needs
const when = (t) => new Date(t).toDateString() === new Date(D.built).toDateString()
  ? new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
const head = document.getElementById("head"), body = document.getElementById("body");
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function show(chain, i) {
  const live = i === chain.past.length, p = chain.past[i];
  head.replaceChildren(); body.replaceChildren();
  head.append(el("div", "t", "Slot " + chain.id + (live ? "" : " · Session " + (chain.hidden + i + 1) + " von " + (chain.hidden + chain.past.length + 1))));
  if (live) {
    head.append(el("div", "s", chain.label + " · läuft seit " + fmt(chain.openedAt)));
    body.append(el("p", "note", chain.past.length
      ? "Die laufende Session — hier stünde das Terminal. Die Zeile lässt sich nach rechts ziehen: dahinter liegen " + chain.past.length + " frühere Sessions."
      : "Die laufende Session — hier stünde das Terminal."));
    return;
  }
  head.append(el("div", "s", "begann " + fmt(p.startedAt) + " · übergab " + fmt(p.handedAt)
    + (p.fromSlot && p.fromSlot !== chain.id ? " · saß auf Slot " + p.fromSlot : "") + (p.report ? " · Report " + p.report : "")));
  const acts = el("div", "acts"); const b = el("button", null, "✨ analysieren"); b.disabled = !p.transcript; acts.append(b); head.append(acts);
  if (p.handoff) body.append(el("div", "hand", p.handoff));
  if (!p.transcript) { body.append(el("div", "empty", "Transkript nicht zugeordnet — " + p.why + ".")); return; }
  for (const x of p.transcript.turns) {
    const d = el("div", "turn " + x.who, x.text || "");
    if (x.tools && x.tools.length) { const c = new Map(); for (const n of x.tools) c.set(n, (c.get(n) || 0) + 1);
      d.append(el("div", "tools", "⚙ " + [...c].map(([n, k]) => k > 1 ? n + " ×" + k : n).join(" · "))); }
    body.append(d);
  }
}
// a long chain to check the indicator against (> 8 sessions) — invented, and labelled as such
const probe = { id: 90, label: "Probe: 14 Sessions (erfunden)", kind: "lane", openedAt: D.built, past: Array.from({ length: 13 }, (_, k) =>
  ({ startedAt: D.built - (13 - k) * 3600e3, handedAt: D.built - (12 - k) * 3600e3, report: null, handoff: "", transcript: null, why: "Probe-Kette, keine echte Session" })) };
const all = [...D.others.map((o) => ({ id: o.id, label: o.label, past: [], live: o.live })), ...D.chains, probe].sort((a, b) => a.id - b.id).map(reach);
const rows = [];
function makeRow(host, chain) {
  const n = chain.past.length + 1, pull = chain.past.length > 0;
  const row = el("div", "row" + (pull ? " pull" : ""));
  const view = el("div", "view"); view.tabIndex = 0; const track = el("div", "track");
  view.append(track); row.append(view);
  for (let k = 0; k < n; k++) {
    const live = k === n - 1, p = chain.past[k];
    const c = el("div", "cell" + (live ? "" : " past"));
    c.append(el("span", "n", String(chain.id)), el("span", "lbl", live ? (chain.label || "—") : "Session " + (chain.hidden + k + 1)));
    if (!live) { const w = el("span", "when", when(p.startedAt)); w.title = "begann " + fmt(p.startedAt); c.append(w); }
    const slotKv = el("span", "kvslot"); c.append(slotKv);
    const draw = () => slotKv.replaceChildren(kvOf(live ? chain.live : null, live ? null : p));
    readings.push(draw); draw();
    track.append(c);
  }
  const cells = [...track.children];
  let idx = n - 1, W = 0, frame = 0, want = 0, snapEnd = 0;
  const base = () => -idx * W;
  // one transform write per frame, however many moves arrived in it
  const put = (px, spring, mouse) => {
    track.classList.toggle("snap", !!spring); track.classList.toggle("mouse", !!mouse); want = px;
    if (spring) snapEnd = performance.now() + (still.matches ? 0 : mouse ? FEEL.ms : SNAP_MS);
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; track.style.transform = "translate3d(" + want + "px,0,0)"; });
  };
  // where the eye sees the band right now — a press mid-spring grabs it THERE, not at the target
  const seen = () => new DOMMatrix(getComputedStyle(track).transform).m41;
  // past either end the band gives, but less and less
  const resist = (d) => { const over = (idx === n - 1 && d < 0) || (idx === 0 && d > 0);
    return over ? Math.sign(d) * W * 0.18 * (1 - Math.exp(-Math.abs(d) / (W * 0.5))) : d; };
  const layout = () => { W = view.clientWidth; cells.forEach((c) => c.style.width = W + "px"); put(base(), false); };
  const depth = el("div", "depth");
  if (pull) row.append(depth);
  const paintDepth = () => {
    if (!pull) return;
    depth.className = "depth dots"; depth.replaceChildren();
    const from = n <= MAX_DOTS ? 0 : Math.max(0, Math.min(n - MAX_DOTS, idx - (MAX_DOTS >> 1))), to = Math.min(n, from + MAX_DOTS);
    for (let k = from; k < to; k++) {
      const more = (k === from && from > 0) || (k === to - 1 && to < n);
      depth.append(el("i", k === idx ? "on" : more ? "more" : null));
    }
  };

  let stepT = 0, shown = n - 1;
  const paint = () => {
    row.classList.toggle("back", idx < n - 1); paintDepth();
    if (idx !== shown) { shown = idx; row.classList.add("stepped"); clearTimeout(stepT); stepT = setTimeout(() => row.classList.remove("stepped"), STEPPED_MS); }
  };
  const go = (i, open, mouse) => {
    const to = Math.max(0, Math.min(n - 1, i)), moved = to !== idx;
    idx = to; put(base(), true, mouse); paint();
    if (!moved && !open) return;
    for (const r of rows) r.row.classList.toggle("cur", r.row === row);
    show(chain, idx);
  };
  // distance OR speed: more than half a row counts whole rows; less than that, a fifth of a row or
  // a flick of FLICK px/ms goes one step in the direction of travel
  const decide = (d, v) => {
    if (Math.abs(d) > W / 2) return -Math.round(d / W);
    if (Math.abs(d) > W * COMMIT || (Math.abs(v) > FLICK && Math.sign(v) === Math.sign(d))) return d > 0 ? -1 : 1;
    return 0;
  };
  const speed = (s) => { const now = s.at(-1); const old = s.find((x) => now[0] - x[0] <= 80) || s[0];
    return now[0] > old[0] ? (now[1] - old[1]) / (now[0] - old[0]) : 0; };

  let g = null, swallowClick = false;
  view.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const mouse = e.pointerType === "mouse";
    // a finger grabs the band where the eye sees it; the mouse lets a running snap land first
    const from = pull && !mouse ? seen() - base() : 0;
    if (pull && !mouse) put(base() + from, false);
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from, dir: null, mouse, s: [[e.timeStamp, e.clientX]] };
  });
  view.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.dir) {
      if (Math.hypot(dx, dy) < SLOP) return;
      g.dir = pull && Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.dir === "y") { if (pull) go(idx, false); g = null; return; }
      if (!g.mouse) g.x0 += Math.sign(dx) * SLOP; // the mouse counts its pull from the press
      view.setPointerCapture(e.pointerId); view.classList.add("drag"); row.classList.add("dragging");
    }
    g.s.push([e.timeStamp, e.clientX]); if (g.s.length > 12) g.s.shift();
    if (g.mouse) { lean(e.clientX); return; }
    put(base() + resist(g.from + e.clientX - g.x0), false);
  });
  // the mouse leans the row, it never carries it: past T px the next session snaps in, and the
  // pull counts again from wherever the pointer is once that snap has landed
  const lean = (cx) => {
    if (performance.now() < snapEnd) { g.rearm = true; return; }
    if (g.rearm) { g.x0 = cx; g.rearm = false; }
    const raw = cx - g.x0, can = raw > 0 ? idx > 0 : idx < n - 1;
    if (can && Math.abs(raw) >= FEEL.T) { g.stepped = true; g.rearm = true; go(idx + (raw > 0 ? -1 : 1), false, true); return; }
    const cap = W * FEEL.cap * (can ? 1 : 0.35);
    put(base() + Math.sign(raw) * cap * (1 - Math.exp(-FEEL.k * Math.abs(raw) / cap)), false);
  };
  const end = (e, cancelled) => {
    if (!g || e.pointerId !== g.id) return;
    const was = g; g = null; view.classList.remove("drag"); row.classList.remove("dragging");
    if (!was.dir) { if (!cancelled) go(idx, true); else put(base(), true); return; }
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 0);
    if (cancelled) { put(base(), true, was.mouse); return; }
    if (was.mouse) {
      // under the threshold only a flick still switches; otherwise the lean springs back
      const v = speed(was.s), raw = e.clientX - was.x0;
      const flick = !was.rearm && Math.abs(v) > FLICK && Math.sign(v) === Math.sign(raw);
      if (performance.now() >= snapEnd || flick) go(idx + (flick ? (raw > 0 ? -1 : 1) : 0), false, true);
      return;
    }
    go(idx + decide(was.from + e.clientX - was.x0, speed(was.s)), false);
  };
  view.addEventListener("pointerup", (e) => end(e, false));
  view.addEventListener("pointercancel", (e) => end(e, true));
  view.addEventListener("click", (e) => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);

  // a sideways trackpad swipe: the row follows the fingers; it commits the moment it is a third
  // across, and whatever momentum the swipe still carries is swallowed until the events pause
  let w = null, lockUntil = 0;
  const wheelEnd = () => { if (!w) return; const d = w.d, v = speed(w.s); w = null; lockUntil = performance.now() + MOMENTUM_GAP; go(idx + decide(d, v), false); };
  view.addEventListener("wheel", (e) => {
    if (!pull) return;
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 && Math.abs(e.deltaX) >= 1;
    if (e.timeStamp < lockUntil) { if (sideways || w) { e.preventDefault(); lockUntil = e.timeStamp + MOMENTUM_GAP; } return; }
    if (!w) { if (!sideways) return; w = { d: seen() - base(), s: [] }; }
    e.preventDefault();
    w.d -= e.deltaX; w.s.push([e.timeStamp, w.d]); if (w.s.length > 12) w.s.shift();
    put(base() + resist(w.d), false);
    clearTimeout(w.t);
    if (Math.abs(w.d) > W * SWIPE_COMMIT) { wheelEnd(); return; }
    w.t = setTimeout(wheelEnd, WHEEL_IDLE);
  }, { passive: false });
  view.addEventListener("keydown", (e) => {
    if (!pull) { if (e.key === "Enter") go(idx, true); return; }
    const to = { ArrowLeft: idx - 1, ArrowRight: idx + 1, Home: 0, End: n - 1, Escape: n - 1, Enter: idx }[e.key];
    if (to === undefined) return; e.preventDefault(); go(to, e.key === "Enter", true);
  });
  host.append(row);
  rows.push({ row, chain });
  requestAnimationFrame(() => { layout(); paint(); });
  addEventListener("resize", layout);
}
const host = document.querySelector(".side .rows");
for (const c of all) makeRow(host, c);
setKv(location.hash.slice(1));
const lane = all.find((c) => c.past.some((p) => p.transcript)) || all.find((c) => c.past.length);
if (lane) requestAnimationFrame(() => show(lane, lane.past.length));
</script></body></html>`;
}
