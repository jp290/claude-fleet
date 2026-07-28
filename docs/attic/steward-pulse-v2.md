# Steward-Pulse v2 — nudge test runs as the first upstream-autonomy trials

Owner-initiated 2026-07-25. Status: **protocol, running watched** — phase A's `kind:"pulse"` is
AS-BUILT (server.ts, grep `kind:"pulse"`); phases B/C name their one missing fact each.
German/English mixed as spoken.

**Correction (2026-07-26, as-built):** the original "no new code required for phase A" was wrong
and is retracted — `handleStewardSend` hard-refuses free text, so none of the three typed kinds
could carry a pulse (falsified in `compiler-program.md` rung 1, then closed by this lane). The
message below is now rendered BY THE SERVER from `briefPayload` + `transcriptFact`; the steward
composes exactly one field, `FRAGE`.

## The premise that makes this safe now

Since 2026-07-25 the risk is concentrated at ONE machine-checked boundary: the land gate
(deterministic verify `cffa4a5`, outcome ledger + feed `9c1ffbe`, undo-land, graduation
criteria pre-registered). Everything UPSTREAM of that boundary — who nudges, who briefs,
who spawns — can run autonomy trials cheaply: a wrong upstream decision produces at worst
a lane that the gate stops. Autonomy loosens above, hardness holds below.

Second premise: the intervention-outcome machinery (`outcomePending`/`outcomeTally`/
`promotionEligible`, server.ts grep `intervention-outcome`) was built for exactly these
nudges and has been starving (`outcomeTally {}`). These test runs are its feeder — no new
measurement code needed, it already persists and classifies.

## Phase A — the sharpened nudge (runnable now, watched)

The steward (slot `⚙ steward`, steward token, existing caps: `FLEET_STEWARD_SENDS_PER_HOUR`,
`FLEET_STEWARD_MIN_IDLE_MS`, quiet hours, `canDeliver` idle gate — dosing is ALREADY
machine-enforced, do not re-implement it in prose) sends for ONE working session:

```
POST /api/steward/send  {"slot": <n>, "kind": "pulse", "question": "<one bounded line>"}
```

`question` is the ONLY composed field: one line, ≤240 chars, control characters refused (a
multi-line or over-long question is REFUSED, never flattened or truncated — a mangled question is
a different question). `ref` is server-fixed to `"pulse"`; a body `ref` is ignored. Everything
else is server-rendered scaffold, and a slot whose git facts are unreadable is refused (400) —
there is no path by which the steward states a fact rather than asking about one:

```
[steward-pulse] DATA:
- branch/commits: <ahead/behind, letzte Commit-Subjects>
- letzte sichtbare Ausgabe: <1-2 Zeilen, wörtlich>
- idle: <s> · Kontext-Indiz: <falls bekannt>
FRAGE: <genau eine, aus den Fakten — nie eine Diagnose, nie eine Arbeitsanweisung>
Prüfe kritisch, ob diese Frage dir gerade hilft. Antworte mir in EINER Zeile:
[pulse-reply] hilfreich | unnötig | falsch — <halber Satz warum>. Dann arbeite weiter.
```

Rules (each one is a lesson already paid for):
- **Facts + one question. Never a diagnosis, never a directive.** THE GUARD
  (`steward-nudge.md` §9): a diagnosis gets conformed to even when wrong. The receiver is
  sighted; the steward is not.
- **The mandated reply IS the label.** In watched phase A the owner reads the reply and
  labels via the disposition rail — no code needed. If phase A graduates, `[pulse-reply]`
  lines are harvestable DETERMINISTICALLY from the transcript JSONL's assistant entries
  (same ground-truth file the terminal-prompt harvester reads for typed prompts — NOT pane
  parsing; the existing harvester itself only captures user entries, corrected 2026-07-25).
  Vocabulary maps onto the rail: hilfreich→accepted, unnötig→ignored, falsch→wrong.
  That harvest is the deliberate fast-follow, NOT built here. One rule it must ship with:
  `falsch` may never auto-write `harmed` — harm stays owner-attested, so a `falsch` reply
  surfaces as a harm CANDIDATE for owner confirmation (same pattern as the `claudeAlive`
  crash-candidate, server.ts grep `harm_candidate`).
- **Skepsis-Prelude ist Pflichtteil des Nudges**, nicht Höflichkeit: sie entwertet falsche
  Nudges billig (eine Zeile) statt teuer (befolgte Fehl-Diagnose).
- **One nudge per session per work-episode.** The caps enforce the rate (the existing
  per-`kind`×slot episode cap covers `pulse` unchanged — a second pulse to the same slot inside
  the window is a 429); the steward's judgment picks the moment (post-`done-looking` or
  long-idle — never mid-burst).
- **Moment-detection caveat (trial #1, 2026-07-25):** for a continuously-working,
  not-yet-committing lane BOTH named triggers are unreachable — `idleMs` stays ~0 (the
  working pane repaints) and `doneLooking` needs `ahead>0`. `transcriptFact.mtime` is the
  better signal but NOT sufficient alone: the transcript also goes quiet for the whole
  length of a long-running tool call (observed: 10-min background e2e loops), so
  transcript-quiet-≥N alone can fire mid-burst. A real moment-trigger needs the
  conjunction (transcript quiet AND pane visibly at the input prompt / claude idle), or a
  commit event. Any typed `kind:"pulse"` implementation must encode this, not the naive
  mtime rule. **As-built:** the endpoint has NO auto-trigger at all — `kind:"pulse"` never fires
  itself, `bestNudgeCandidate` was left untouched, and the moment stays the steward's watched
  judgment call. The conjunction rule is what any future trigger owes; nothing may be wired to
  the naive mtime rule in the meantime.
- **As-built facts and their unknowns** (server.ts, grep `kind:"pulse"`): `branch/commits`,
  `ahead/behind` from `briefPayload`; `letzte sichtbare Ausgabe` = the last assistant TEXT entry
  of the session's transcript JSONL (tail-read, flattened to one line, ≤200 chars, a quoted
  `[pulse-reply]` marker defused so echoed output cannot forge a reply); `Kontext-Indiz` =
  `transcriptFact` bytes. Every unknown renders `unbekannt` — never a 0, never a guess.
- Watched: owner reads the exchange in the transcript. Nothing here is autonomous yet —
  it is a TEST RUN producing the tally the promotion predicate needs
  (`PROMOTION_MIN_N` helps, zero harm, harm-attest fresh — fed by the disposition rail).

## Phase B — the handoff-recycle ritual (one missing fact)

Steward detects a session worth recycling → sends (same caps): *"Schreib ein HANDOFF
(/handoff), committe es, melde `[recycled-ready]`."* → verifies the handoff commit exists
(git fact, not trust) → owner (later: steward) kills + respawns the slot with
`/catchup` + mission. The session lifecycle becomes managed.

Missing fact, one small lane when wanted: a **context-size proxy** on the steward sessions
API — transcript JSONL byte-size/mtime for the slot's active session (the transcript path
derivation exists, grep `transcript view` in server.ts). Deterministic, no pane parsing.
Until then phase B triggers on the owner's eye only.

Hard rule from day one: recycle NEVER fires on a lane that is not `doneLooking` or on
`⚙ steward` itself, and the kill only happens after the handoff commit is verified.

## Phase C — mission sessions ("suche gute Ideen + implementiere")

A steward-briefed lane whose brief is a MISSION, not a task: constraints + done-criterion
("finde und implementiere eine Verbesserung an X; lande nur durchs normale Gate").
Why this is cheap now: the mission lane has exactly the same blast radius as any lane —
none until the gate. The interesting failure is wasted tokens, and the ledger prices that.
First trials: owner picks the mission, steward compiles the brief (sharpen discipline:
files, context, done-criterion, footprint). Graduation of *steward-picked* missions is a
later criteria entry, written before its data like everything else.

## The owner-attention budget (axiom, added 2026-07-25)

**Owner attention is the system's scarcest resource — every design that spends it has a
budget.** Labels are one tap, never a form. Nothing the owner must read to keep the system
safe; reading is always optional, acting on defaults always safe. The nudge dose (phase A)
counts against the same budget: caps are machine-enforced, and a nudge that costs the owner
more attention than it saves the session is `harmed`, not merely `unnötig`. Every new
consumer of owner attention names its cost here before shipping.

## What graduates, and on what

Phase A nudges: the existing `promotionEligible` predicate (criteria doc §4), now genuinely fed —
a sent pulse parks `class:"pulse"` on its outcome row, `measureOutcomes` classifies it
class-generically, and `outcomeTally["pulse"]` / `promotionEligible("pulse")` are readable on
`GET /api/steward/outcomes`. Pulse-replies + disposition labels remain the quality signal on top. Phase B recycle: own criteria entry BEFORE the first
autonomous kill (never before). Phase C missions: own entry likewise. No step skips the
ladder: record → display → advise → gate → act.
