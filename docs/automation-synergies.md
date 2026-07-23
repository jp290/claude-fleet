# Automation synergies — cross-layer findings

*Synthesis 2026-07-21. The mechanisms read as four layers: substrate (tmux,
worktrees, transcript JSONL, fleet.json), server primitives (slots/lanes/land,
queue+dispatcher, intake, autos, `sendText`, ephemeral agents, tokens), agent
conventions (docs shelf, CLAUDE.md inheritance, briefs, /sharpen, steward), and
the owner workflow (praise-gate review, promotion, land). The findings below are
places where two mechanisms are secretly the same thing, or where combining two
unlocks something neither does alone. Ranked by leverage; each verified against
the code, not asserted.*

---

## 1. Machine-readable done-criteria → a server-run verify gate

**Pieces:** the §7 brief (done-criterion + verification command,
`tailored-context.md`), lanes (own worktree = safe place to run anything), the
board's planned Phase-3 verify gate (BACKLOG #10), and the mined fact that
"verifiziere, bevor du fertig meldest" is the owner's most constant demand.
**Synergy:** today the verification command lives as prose inside the brief and
is run *by the lane on trust*. If the brief carries it as a **structured field**
(stored on the task/lane, not in the tree), the server can run it itself in the
lane's worktree — deterministically — and the board's "verified" badge becomes a
fact instead of an idle heuristic. Review collapses from "read the claims" to
"check the green light plus the diff". This is the single biggest attack on the
review bottleneck, and it makes joint-2's *done-looking* condition hard instead
of heuristic.
**Cost/risk:** running arbitrary commands is nothing new (the lane's claude
already can), but a *server-triggered* run needs a timeout, serialization per
worktree, and must never run while the session is mid-write (reuse the
`MERGE_IDLE_MS` stance, `server.ts` merge path).
**Build-order impact:** Phase 2 "brief at launch" must be designed with this
field from day one — brief becomes data `{text, verifyCmd}`, not a string.

## 2. Playbook enforcement belongs in the `sendText` choke point

**Pieces:** every delivery path already funnels through one server function with
gates (idle, claude-alive, slot re-verification); the scoped steward token
(next lane); the playbook's caps and windows (`steward-autonomy.md`); the audit
log (in flight).
**Synergy:** if steward sends carry a declared intervention type, the server —
not the steward's discipline — enforces caps, the 10-min effect window, and
audit entries. The playbook doc stays the *source*, the server becomes the
*enforcement*. Combined with the token's scope this is the injection endgame:
even a fully-injected steward physically cannot exceed cap 1 or send without a
matching condition episode, because the counter lives server-side.
**Cost/risk:** small route surface (a `kind` field + counters keyed
slot×episode); the risk of over-modeling is real — enforce only what the
playbook already fixes (type, cap, window), nothing speculative.
**Hardening (steward review 2026-07-21, confirmed real):** a declared `kind`
alone is spoofable — an injected steward could label arbitrary text as a
favorable kind and inherit its cap. Fix: for every v1 playbook kind the
**server renders the message itself** from its template plus deterministic
inputs (event ref, condition, slot); the steward's typed-send call carries
*references, never free text*. Free-text delivery simply is not in the scoped
token's capability set — mislabeling becomes impossible rather than detected.
Plus one global sends-per-hour cap across all kinds.
**Build-order impact:** fold into the token lane — the token and the typed-send
route are one feature ("scoped principals with typed, capped actions").

## 3. The steward is shelf + journal + identity — his workers are ephemeral

**Pieces:** `summaryViaSession` (server.ts) — spawn a throwaway
interactive claude, read the answer from transcript JSONL,
subscription-covered, git-keyed cache; the ✨ enhancer already reuses exactly
this machinery (server.ts, grep `✨ prompt enhancer` — "same machinery" by its own comment); the
steward's context-degradation problem (a recurring Rundgang auto would eat his
conversation toward the handoff cliff).
**Synergy:** the Rundgang's mechanical half (sense + interpret over 16 slots) is
a `summaryViaSession`-shaped job: ephemeral worker, deterministic inputs, digest
out, cache keyed on fleet state. The steward's *conversation* only receives the
digest. Consequence worth stating as doctrine: **the steward is not his
conversation** — everything durable lives in shelf + journal + slot identity;
the chat context is disposable, so the 60% cliff is harmless and his handoff is
one line ("read shelf + journal tail").
**Cost/risk:** none new — the plumbing exists and is e2e-hooked
(`FLEET_SUMMARY_CMD`). Guard: workers inherit the read-only stance; they never
send.
**Build-order impact:** Rundgang gets built on this plumbing, not as autos-fed
prompts into the steward pane; the steward-slot auto only delivers the digest.

## 4. One brief compiler for every entry channel

**Pieces:** the enhancer (draft → additive directives + `/sharpen3`,
`runEnhance` in server.ts), `/sharpen3` itself (in-session compiler), the queue
(dispatcher injects raw task text today, `tickDispatch`), intake, steward mail
(inbox items), and the mined two-population finding: hand-typed briefs are
migrating toward compiled briefs.
**Synergy:** typed drafts already flow draft → enhance → `/sharpen3`. Queue
tasks, intake mail, and steward-inbox items are the *same object* — rough text
that should become a §7 brief before it reaches a lane. Route them through the
same two-stage compile (enhance-shaped pre-pass, `/sharpen3` in the lane) and
every lane starts from a brief regardless of entry channel; the dispatcher stops
injecting raw text. Stage-2 Briefer then isn't a new capability — it's the
steward *reviewing* compiler output, which is exactly the owner's current
praise-gate applied one level down.
**Cost/risk:** compile adds latency + one model call per dispatch; acceptable —
dispatch is deliberately serial anyway. Injection note: intake/mail text is
untrusted; the compiler must treat it as payload (same delimiter stance as
`steward-mail.md` layer 3), and the compiled brief inherits `pending`-gated
review before dispatch, unchanged.
**Build-order impact:** merges "brief at launch" (Phase 2) with intake/mail
processing into one mechanism; build once, three channels benefit.

## 5. One append-only event-log discipline; the transcript watcher feeds it

**Pieces:** audit.jsonl (being built, own write chain, 600, rotation), the
steward journal (planned), intervention outcomes (joint 5), prompt history —
all append-only JSONL with the same hygiene; plus the fact that every sensing
feature (conversation view, summarize, effect windows, done-looking) reads
transcript JSONL separately today.
**Synergy:** one event-log discipline (format, chmod, rotation — written once
in the audit lane) reused for journal + outcomes; and later one server-side
transcript watcher that emits *deterministic* events (turn type, tool-error
streak, question-to-owner shape) into it, instead of N features re-tailing the
same files. The learning loop (joint 6) then distills from one format.
Anti-drift guard: events are *observations with timestamps*, never derived
state presented as current — consistent with the native-over-views feedback.
**Cost/risk:** the watcher is genuinely new machinery; defer it until at least
two consumers exist (Rundgang + effect windows). The shared discipline costs
nothing now — it's a convention in the audit lane's code.
**Build-order impact:** audit lane's helper should be written as the generic
`appendEvent(file, obj)` chain, not audit-specific — one-line instruction to
that lane, no scope growth.

## 6. Scoped tokens are one mechanism, not three

**Pieces:** `FLEET_SELF_TOKEN` (slot-bound, route-limited — exists), the
steward token (next lane), share-guest credentials, the intake/mail worker
secrets.
**Synergy:** all are instances of "principal + capability scope + binding".
Build the steward token as the *general* form (token → {principal, allowed
actions, bound slots}) and the self-token becomes a special case, mail workers
another; future roles (a reviewer agent that may only read diffs) cost a row,
not a route.
**Cost/risk:** generalization before the second consumer exists is the classic
premature abstraction — but the second consumer *already exists* (self-token),
which is the test the code principles set. Keep shares out of it (different
lifecycle, guest-facing auth) — forcing them in would be abstraction for its
own sake.
**Build-order impact:** token lane briefs as "unify self-token + steward scopes",
slightly bigger, still one lane.

## Anti-synergy (deliberately kept apart)

**The dispatcher's decision path and the steward's judgment must not merge.**
Tempting: "the steward decides when to dispatch." But the dispatcher's value is
that it is *deterministic and dumb* — serial, budgeted, gated, reviewable in ten
lines of behavior. Feeding steward judgment into it converts a hard gate into a
soft one (the exact regression `land` avoided with LLM verdicts, BACKLOG #14
Phase 2). The steward improves what flows *into* the queue (briefs, triage,
digests) and what the owner *sees*; when work starts stays a deterministic
policy plus the owner's promotion. Same shape as the standing rule: advisors
inform, gates decide.

## Net build-order (unchanged spine, three amendments)

Audit lane (running — amend: generic `appendEvent`) → token lane (amend: typed,
capped sends = playbook enforcement; unify self-token) → Rundgang (amend: on
`summaryViaSession` plumbing, digest-only into the steward pane) → brief
compiler as the merged Phase-2/intake/mail mechanism, with `verifyCmd` as a
structured field → server-run verify gate → transcript watcher (last, needs two
consumers first).
