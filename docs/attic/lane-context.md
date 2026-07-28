# The lane's data view — what a working agent can actually see, and what it should

Design note, 2026-07-25, owner-requested. Every "is" claim below was verified first-hand today.
This is about the *information environment of the agent doing the work* — not the owner's view,
which is rich, and not the steward's, which is richer than the lane's.

## 1. The asymmetry, measured

| principal | credential | can READ | can WRITE |
|---|---|---|---|
| owner (browser) | owner token | everything — sessions, brief, diff, transcript, outcomes, dispositions, audit, merge verdicts | everything |
| ⚙ steward | `stewardToken`, keyed on the slot **label** (`server.ts:1090`) | all slots' deterministic facts, `deployGap`, `bundleStale`, `sinceLastLook`, `continuity`, the digest, **any lane's brief and transcript** | typed sends, proposals, journal, own autos |
| **lane** | `selfToken`, keyed on `s.worktree` (`server.ts:1084`) | **nothing** | its own autos only (`POST /api/self/autos`) |
| plain session | **none** — the export is gated on `s.worktree` | nothing | nothing |

**The agent doing the work is the least situated principal in the system** — strictly less
informed than the observer watching it. The steward can read a lane's brief *and* transcript;
the lane cannot query one fact about itself, its siblings, or the gate that will judge it.

A lane's entire information environment is therefore: the brief (prose, static, spawn-time), a
**copy** of `CLAUDE.md` (snapshot, drifts, uncommittable — `ungoverned-artifacts.md`), its own
worktree, its own transcript, and two env vars.

## 2. Why "it can just look" is not the answer

Much is *technically* reachable from disk — sibling worktrees, `git log HEAD..main`, the ledger
in the main checkout. Three reasons that does not resolve it:

1. **The project's own isolation rule forbids it.** `CLAUDE.md`: anything outside this repo's
   worktree "is shared reality: stop and report instead of touching it." We cannot simultaneously
   tell lanes not to look around and expect them to be situated.
2. **The authoritative values are not in files at all.** The live gate is `FLEET_VERIFY_CMD` in
   the *server's* environment. Verified today, again: `CLAUDE.md`'s Verify line typechecks
   `… fleet-e2e.ts merge-prompt.ts`; the live gate typechecks `… fleet-e2e.ts` — a superset
   relation, not identity. Worse, `watchdog.sh` on disk can differ from the running watchdog
   until `launchctl kickstart` (exactly today's `exit 42` case). **No file a lane can read tells
   it what will actually gate it.**
3. **Nothing prompts the lookup.** `lane-brief-template.md` already concluded that its two real
   defects were "attention-allocation failures, not information failures" and that a brief's job
   is only "the residue — what the lane cannot discover by reading." That is the right doctrine,
   and the system currently provides no *at-need* channel for the discoverable part.

## 3. What this cost today (evidence, not hypothesis)

- `flake-mission` ran 64 min and drifted to `behind: 4` while four siblings landed under it. It
  had no signal; the steward's entire phase-A trial existed to hand it that one fact.
- The brief norm "name the *other* producer, not just your own files" exists because sibling
  collision surface is not queryable. It requires the briefer to foresee it.
- Lanes hand-run all three suites before landing (correct, and expensive) partly because they
  cannot know which checks will actually gate them.
- `verify-tristate` lost two runs to an `index.lock` race against the server's periodic git
  polling of its own worktree — a server behaviour no lane is told about.
- `e2e-split` correctly updated `CLAUDE.md` and could not know the edit would die with the tree.

**The sharpest reading:** the steward's phase-A pulse is an elaborate *push* mechanism —
moment-detection, send caps, quiet hours, idle gates, owner attention — built to deliver facts
the lane could simply **pull**. We built a courier because there is no library.

## 4. The proposal — invert push into pull

### 4.1 `GET /api/self/context` (self-token scoped, read-only)

Returns deterministic facts about the caller's **own** slot. No diagnoses, no advice (A8).

- **`lane`** — branch, base, `baseSha`, ahead/behind, dirty count, whether the fork point moved.
- **`main`** — commits that landed since your fork: subjects + files touched. *"What moved under
  you."*
- **`siblings`** — other active lanes: branch, committed files touched, dirty file names. The
  collision surface, served deterministically instead of hand-written into a brief.
- **`gate`** — the **live** `FLEET_VERIFY_CMD`, `VERIFY_TIMEOUT_MS`, and which judges are active
  (`FLEET_CLEAN_REVIEW` mode, auto-③ on/off). Kills the folklore class in §2.2 outright.
- **`rulebook`** — hash + mtime of the main checkout's `CLAUDE.md` vs the lane's copy → an
  explicit drift flag (the ⚙ steward has been 9 lines stale for a day).
- **`history`** — prior outcome rows for this branch, if any.

Why this is safe: read-only; scoped to the caller's own slot by the same token→principal→slot
shape already proven twice (`selfToken`, `stewardToken`); it expands *knowledge*, never
authority. Blast radius is unchanged — the gate still decides everything.

### 4.2 Give plain sessions the same read scope

Today a non-lane session gets **no** credential at all, so it cannot even ask what it is. The
same endpoint, slot-scoped, with the worktree-specific fields simply absent (A4: absent ≠ zero).

### 4.3 The consequence for the steward: stop couriering facts, keep asking the question

If facts are pullable, the phase-A nudge sheds its hardest and most attention-expensive half.
What remains is the part only a sighted observer can contribute: **one question, chosen at a
moment of judgement**. That is a sharpening of the steward's role, not a removal — and it
retires the moment-detection problem (`steward-pulse-v2.md`: neither `idleMs` nor `doneLooking`
is reachable for a continuously-working lane) for the facts half entirely.

### 4.4 The brief gets thinner, on purpose

With §4.1 live, a brief should carry only the residue the docs already define: the decision and
its reason, the hazard and why the obvious precedent does not apply, the owner's ranking between
two goods. Everything mechanical — sibling producers, gate command, base, drift — moves to the
pull.

## 5. Argued against (the steelman I owe this)

- **Injection surface.** Sibling commit subjects and filenames are attacker-influenceable text
  entering another agent's context. Mitigation is already the house pattern: deliver inside the
  untrusted-DATA delimiter that `buildMergePrompt` / `buildEnhancePrompt` use, stated as facts
  that are never instructions.
- **Over-situating.** A lane that knows more may act outside its scope. The payload must be
  facts about its environment with scope unchanged; the gate remains the only authority.
- **Context cost.** One small JSON fetch against a 40-minute lane is negligible.
- **"Just fix the briefs."** That is the approach whose failure `lane-brief-template.md` already
  documented: it requires the briefer to foresee everything, and it does not scale.
- **It does not fix** the static-prose brief, the rulebook's uncommittability, or the fact that
  the gate is thin (`gate-coverage.md`). Different problems.

## 6. How we would know it worked — pre-registered before building (A9)

The feeder already exists: **`ownerPrompts`** is recorded on every outcome row and is the
intervention proxy (1 = took its brief and landed unaided; each mid-flight correction adds one).

**Baseline, measured before writing any code (n = 18 landed rows): `{1: 15, 2: 2, 3: 1}`,
median 1.** Stated plainly because it *weakens the case above*: 83 % of lanes already take their
brief and land with no owner correction at all. On this metric there is almost no headroom, and
a proposal justified by "lanes are under-situated" must not quietly ignore that most of them
cope.

Two honest consequences:

1. **`ownerPrompts` is the wrong primary metric** — it measures corrections the *owner* had to
   make, not cost the lane absorbed silently: minutes lost re-running suites the gate does not
   require, drifting to `behind: 4` unnoticed, near-miss collisions, an `index.lock` race.
   Those are real (§3) and invisible to this counter. The correct primary metric is **lane
   wall-clock and token spend per landed change** — which, per `trust-perimeter.md`, the system
   does not record at all. *That instrument should exist before this endpoint is justified on
   efficiency grounds.*
2. **A secondary metric I proposed does not exist:** `behind`-at-land is not a recorded field on
   the outcome row (checked). Either add it with §4.1 or drop the claim.

So the honest status of this note: the **asymmetry in §1 is a verified fact** and the folklore
problem in §2.2 is a verified defect worth fixing on correctness grounds alone (a lane cannot
learn what will gate it). The broader "lanes are starved" argument is **plausible but not yet
evidenced** — 15 of 18 lanes landed unaided. Build §4.1's `gate` and `rulebook` fields first,
because those close verified defects; hold `siblings` and `main` until the cost instrument
exists to show they pay for themselves.
