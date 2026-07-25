# Discrepancy audit — operative context for the claim-vs-reality hunt

*Operative shelf: this file changes how a session behaves when it loads it. Its job is to make a
discrepancy hunt **provable and bounded** instead of a list of opinions. Seeded 2026-07-25 from a
session that found seven of these by hand — every class below has at least one confirmed instance
with the command that proved it.*

## What this hunts

Not bugs. **Discrepancies between what the project asserts and what is actually true** — in docs,
in schemas, in config sets, in numbers written down as facts. This class is expensive precisely
because it is invisible to every deterministic gate: `tsc` and the e2e suites prove *the code does
not break*. Nothing checks whether the corpus still describes the code, whether a recorded
measurement still means what it meant, or whether a doc's promise can be kept by the artefacts
that exist.

The project's own standing risk applies to this hunt too (`automation-frontiers.md`,
"the theory is ahead of the build"): **a hunt that produces forty observations is a net loss**,
because review capacity — not machine capacity — is the constraint (`operating-model.md`
Invariant 5). Five proven findings beat twenty plausible ones.

## The eight classes, each with a confirmed instance

| | Class | Confirmed instance (2026-07-25) | How it was proven |
|---|---|---|---|
| **D1** | **Stale status** — a doc states a deploy/build state that has since changed | `merge-review-autonomy.md` said the fast-tier land gate was "**NOT yet deployed**, needs `launchctl kickstart`" — it had been deployed since 2026-07-24 17:45 | `ps eww <srv pid>` → live `FLEET_VERIFY_CMD` matched `watchdog.sh:38` char-for-char; watchdog process start > file mtime |
| **D2** | **Citation rot** — a pointer names the wrong doc, section, or symbol | HANDOFF §7.2 *and* `docs/README.md` both cited "`merge-review-autonomy.md` component #6" for the outcome feed; that doc's §6 is "Hard rules". The feed is `lane-autonomy-future.md` item 6 | opened both cited locations and read what is actually there |
| **D3** | **Volatile number recorded as a durable fact** | `BACKLOG.md` Track A records "a working, un-nudged slot looks helped ~25 % of the time" as *the null any future nudge must beat*. It is a per-boot artefact: `baselineSamples` is an in-memory ring (`server.ts`, cap 50), absent from `fleet.json`. Live re-read: 6.7 % (1/15) vs 25 % (3/12), Fisher exact **p = 0.294** — statistically indistinguishable | found the number's writer, checked its lifetime (persisted? capped? reset on boot?), re-measured live, computed the test |
| **D4** | **Metric-name mismatch** — a field measures something narrower than its name and its uses imply | `ownerPrompts` counts only `source === "owner"` (UI-composed sends); prompts typed straight into a pane are logged `"terminal"` and excluded — live journal ≈ 90 owner vs ≈ 747 terminal. `steward-nudge.md` used it as "every human correction adds one" | read every `logPrompt` call site, then counted the real distribution in the journal |
| **D5** | **Promise the artefacts cannot keep** — a planned analysis needs data nothing records | `steward-nudge.md` §8 asked to "reconstruct the surface state at that moment (idle, dirty tree, …)". Dirty-tree-at-T exists nowhere: `gitInfo` is in-memory and `saveState` excludes it | for each input the plan names, searched for a durable writer; proved absence, not just failure to find |
| **D6** | **Incomplete set** — a copy/config/whitelist enumerates members and one is missing | `steward-arena.sh:153` copies `server.ts` but not `merge-prompt.ts` — **already broken at HEAD** before any new module. Related, since fixed: `SUMMARIZER_MARK` covered only one of the two prompts run via `summaryViaSession` | rebuilt the exact copy set in a scratch dir and ran `bun build server.ts --target=bun` → `Could not resolve: "./merge-prompt"` |
| **D7** | **Asserted invariant vs enforced invariant** | "a lane worktree session cannot affect the live server or the main checkout" — token scope *is* enforced; filesystem/process isolation is **convention only** (same user, bypass permissions, `fleet.json` readable) | searched for an enforcement point per invariant; reported "asserted only" where none exists |
| **D8** | **Broken join / silent cap** — a record cannot answer the question it exists for | `reverted`→`landed` joins **by branch**, but a branch survives a land and can be re-landed, and the row carries no `repo`. `filesTouched` is `.slice(0, 200)` with no truncation flag, and `--name-only` without `--no-renames` records only the destination path | constructed the failing case; for the rename claim, an empirical two-commit repo test |

## The proof discipline (this is the load-bearing part)

Two of the three errors the seeding session made were *not* reasoning errors. They were **running a
check and not reading its output.** Both worked examples are worth carrying:

- A `patch-id` experiment reported "VERSCHIEDEN" while `fatal: invalid upstream 'master'` sat
  visibly in the same output — the rebase under test never ran. The conclusion happened to be
  right; the evidence was worthless.
- A claim about *yesterday's* slot occupancy was "corrected" with *today's* measurement. Worse: the
  underlying fact is unknowable, because historical slot state is never persisted (D5, applied to
  one's own correction).

So, binding:

1. **Every finding pastes the command and its actual output.** Never the word "verified" standing
   alone. A finding whose command errored is not a finding — re-run it correctly or drop it.
2. **A correction must address the same object as the claim.** Same time, same file, same scope.
   If the claim is about a past state that nothing records, the honest finding is *"unverifiable,
   and here is why nothing could verify it"* — not a refutation.
3. **Read the surrounding comment before calling something wrong.** This codebase documents its
   deliberate trades in place (`baselineSamples`: *"advisory number — not worth the persist/restore
   surface"*). When the code already owns the trade, the finding is **not** "this is a defect" but
   "a doc elsewhere uses it as if the trade did not exist." That reframing is the whole finding, and
   getting it wrong burns owner attention on a settled decision.
4. **Line numbers drift; symbols do not.** Cite `file:symbol` and grep for it. A stale line number
   is not a discrepancy.
5. **Argue against each finding once before writing it down.** If the counter-argument wins, the
   finding is dropped — and dropping it is a result, not a failure.

## Fix directly vs document

**Fix directly** (the change is local and the correct value is provable): citation rot, stale
status lines, a wrong number, a missing member of a set, a doc sentence contradicted by the code it
describes. Commit these with the proof in the message.

**Document** (needs a schema change, new recording, or a design decision): everything else. Each
entry needs three things or it is not actionable — **the failing case**, **the cost** (what breaks,
degrades, or becomes unmaintainable), and **the verification that would prove a fix**. No entry
without a cost; an uncosted observation is labelled as such.

## Where to look (five sweep axes, agent-parallelizable)

Fan out for *breadth*; adjudicate centrally, because agents do not inherit this file's discipline
and reliably over-report. Give each agent the proof rules above verbatim, and require a
`not examined` list.

1. **Doc ↔ code**: every doc claim about how the code behaves, against the symbol it names.
2. **Doc ↔ deployed reality**: status/deploy claims against the running process, its env, and
   commit dates. (Read-only. Never restart, never `launchctl`, never touch the live socket.)
3. **Schema ↔ consumer**: for each persisted record, can a consumer actually compute the question
   the record exists for? (D8)
4. **Enumerated sets**: copy sets, env whitelists, marker lists, validated-field lists, `cp -R`
   lines, dispositions, route allowlists. (D6)
5. **Numbers**: every figure written in a doc — is it reproducible today, and is its lifetime what
   the doc assumes? (D3, D4)

## Hard limits

- **Read-only on everything outside the repo**: the live server, `launchctl`, `~/.claude`,
  `~/.cloudflared`, other repos. Worktree isolation covers files in this repo only — outside it,
  report instead of touching (CLAUDE.md).
- **Do not edit `server.ts`, `src/`, or `fleet-e2e.ts`** unless a finding is a one-line provable
  correction *and* no other lane holds that file. Footprint collisions on those files are this
  project's known land-blocker.
- **One findings file** — append to this doc's log below. No new analysis docs: the corpus already
  holds more analysis than shipped mechanism.
- **Never "fix" a documented deliberate decision.** See rule 3.

## Findings log

*Newest first. Each entry: class, the claim, the reality, the command + output that proved it, the
cost, and either the fix commit or what a fix would require.*

- (empty — the first audit appends here)
