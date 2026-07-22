# HANDOFF — the steward is built, safe, and beating; the roadmap is set, Phase 1 is next (2026-07-22)

*A prompt for you, the next session. Treat every claim, number, path, and commit hash here as
a **claim to verify** against the tree and the running system before building on it (CLAUDE.md)
— deterministic evidence beats this document. Its job is to induce the right model, not to be
trusted.*

## Start here (primary sources — read, don't accept this handoff in their place)

- `docs/README.md` — the corpus index (two shelves + the steward subsystem).
- `docs/steward-overview.md` — **start here**: the as-built map (code-cited) of what the
  steward *is*, can *do today*, and is *primed to become*.
- `docs/steward-roadmap.md` — **the ordered plan** (Phase 1→5 + continuous), and *why the order
  is what it is* (four forces; don't-sequence-by-excitement).
- `docs/steward-intelligence.md` — the theory: §1 doctrine (autonomy×safety), §3 the three
  models + learning loop, §4 the ladder, §7 the impact layer, **§8 the learning engine**
  (dream mode + the self-report channel + the common-service resolution).
- `docs/synergy-findings.md` — the ranked, evidence-cited backlog (the source for Phase 1).
- `OWNER.md` (gitignored, in the checkout) — the model of JP; **§4 risk-surface binds the gate**.
- `docs/prompt-axioms.md` — what makes a prompt good; the CLAUDE.md lane discipline.

## Verified current state (check each — most is now LIVE, a change from prior handoffs)

- **Doctrine (steward-intelligence §1, revised 2026-07-22):** the permanent gate is on the
  **unrecoverable-and-large-blast few only**; everywhere else the steward acts, accepting
  bounded probabilistic harm **scaled to judgment quality**; *for a capable model, context
  beats restraint*. On `main`.
- **Owner-model built:** `OWNER.md` — home resolved (gitignored, mirrors CLAUDE.md, in the
  steward worktree, read by the `/steward` load ritual). §4 risk-surface corpus-confirmed
  (48/48 transcripts, two extraction agents).
- **Spine deployed + a bounded live heartbeat armed:** `srv` restarted (sessions survived);
  perpetual/kill-switch/quiet are live. Auto **`3499a018`**: `/rundgang` every **7200s**,
  perpetual, idle-gated 60s, quiet **23–8**. **Proven once** (it ran a pulse and correctly
  refused to treat the deploy's reset `0`-idle values as real). Steward = **slot 1** (`s1`),
  Sonnet 5. Journal live at `/api/steward/journal`.
- **Kill-switch caveat (verified):** `POST /api/autos/switch {"on":false}` stops all *scheduled*
  autos (incl. the live beat) — but `autosOn`/`quietHours` are checked **only** in `tickAutos`,
  so they do **NOT** gate a direct `/api/steward/send` or the dispatcher (Tier-0 seam, inert
  today; `synergy-findings.md`).
- **Docs on `main`** (HEAD after commit; verify with `git log`): `steward-overview.md`,
  `synergy-findings.md`, `steward-roadmap.md`, `OWNER.md`, `steward-intelligence.md` §1/§3/§8.
  Steward worktree ff-merged; both checkouts clean.

## The front — Phase 1 (see `steward-roadmap.md` for the full plan + why)

**Phase 1 = Foundation** (next; all reversible/low-risk → act-freely to prototype): make the
steward reason from *facts*, behind one safe delivery gate.
- **Tier-1 signal-sharing:** surface `claudeAlive` **first** (the linchpin — fold into `tickGit`
  + cache for reads, but keep the delivery/dispatch gates on a **fresh** check), the full
  `mergeLast` verdict, `idleMs`, `gitOp`, `Task` status, and the summarizer's
  `verification`/`openThreads` (advisory). **The `condition` classifier is deferred** (corrected
  2026-07-22): its git subset is already derivable by the steward and it's not the 6-way
  `rundgang.md:14` taxonomy — see `synergy-findings.md` Tier 1.
- **Tier-0 `canDeliver()`:** one delivery-gate choke-point (imitate `createAutoForSlot`) that
  closes the kill-switch/dispatcher seams structurally.

Then: **Phase 2** (digest engine via `summaryViaSession`, fixes context-drain; the learning
engine v1 = Grok survey + dream-mode v1), **Phase 3** (self-model home + intervention
outcomes), **Phase 4** (the typed self-report channel + cross-lane conflict), **Phase 5** (the
gated endgame: ladder promotion, steward-files-Task, per-session model / Opus-Fable dispatch —
land stays owner-only). **Continuous:** test the steward under the long-autonomous lens; Item A
(the real commit-QA gate).

**Two open owner calls** (`steward-roadmap.md`): digest-engine-early?; cross-lane-conflict pull
forward?

## Load-bearing decisions + WHY (do not re-litigate or undermine)

- **Autonomy and safety are one design** (§1, revised): gate only the unrecoverable-and-
  large-blast; tolerance scales with judgment; **the owner-model licenses the loosened
  tolerance — building it and loosening the gate are one move.**
- **Three models + the learning engine** (§3/§8): system (docs), owner (`OWNER.md`), self
  (journal). The learning loop and **dream mode** keep them current — **propose, never apply;
  the owner promotes.** Auto-rewriting the steward's own binding prompts is self-modification,
  on the never-cross line.
- **Facts before claims** (§8): the deterministic layer (Phase 1) must precede the self-report
  channel (Phase 4) — a claim is cross-checked against a fact, so the fact must exist first.
  Self-reports are advisory, typed, injection-scanned, never gating (§4d).
- **The journal is the keystone**, but **promotion counts must live in a durable write-time
  tally**, never a scan of the rotatable journal (the second rotation would reset the record).
- **Perpetual/kill-switch/quiet are owner-only** by construction; **land/merge, third-party
  outbound, real money, credential exposure, driving an active human's pane** are the permanent
  gates (`OWNER.md` §4b).
- **The impact lives in the library of proven prompts**, not the machinery; scheduling
  *multiplies* value and harm → **prove-before-schedule**, and **don't sequence by excitement**.
- **The common service is the server** — extend it, don't spawn a peer process (§8).

## How this session worked (keep this rhythm — the owner values it)

Question every assumption against the **actual code** before building (it changed the design
repeatedly — and caught a wrong claim: the kill-switch does *not* mute a direct steward send,
found only by re-reading `handleStewardSend`). Delegate to **sharp, parallel agents** with
exact files + done-criterion; **verify their load-bearing claims yourself** before enshrining.
**Docs and code move together.** Deploy/land/commit are **owner-triggered** (OWNER.md §4c); the
owner-token stays out of the assistant's context (hand a `!` one-liner that reads `.token`
locally). Verify-first (tsc + `bun run build` + a collision-safe `./e2e-isolated.sh`); judge it
by the tail (`ALL PASS`).

## Operational facts (verify)

Steward = **slot 1**, cwd `<repo>.worktrees/steward` (absolute: `~/claude-fleet.worktrees/steward`),
`FLEET_STEWARD_TOKEN` baked at spawn. Owner token = `fleet.json` `.token` (server.ts:2428–2432;
never read it into context — `!`-run it). **Deploy ritual:** `tmux -L claudefleet kill-session
-t srv` (watchdog respawns from `main`; **slot sessions survive** — verify `srv` is its own
session first), health-check `curl http://100.64.0.1:8790/` (binds the Tailscale IP only);
`rundgang.md`/doc changes also need the steward worktree ff-merged
(`git -C ~/claude-fleet.worktrees/steward merge --ff-only main`). `OWNER.md` +
`.claude/commands/*` reach the live steward via that ff-merge, **not** an `srv` restart (the
server reads none of docs/OWNER/commands at runtime). `./e2e-isolated.sh` can exceed a 120s
foreground limit — run it backgrounded, judge the tail.

## Not mine (pre-existing dirty at session start)

`public/share.html`, `watchdog.sh` were modified before this session — left untouched.
