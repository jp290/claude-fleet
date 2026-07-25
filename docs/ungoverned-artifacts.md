# Ungoverned artifacts — the rulebook and the evidence live outside every mechanism that protects the code

2026-07-25, third adversarial pass. Everything here was verified first-hand today, and §2 is a
**live incident caught before the loss**, not a hypothetical.

Fleet's whole discipline is: nothing changes main except through a gate; every change is a
reviewed diff; every claim cites evidence; every advisory output gets labeled. That discipline
covers *tracked source files only*. Two classes of artifact sit entirely outside it — and they
are, respectively, the file that governs every lane and the data that will decide autonomy.

## 1. `CLAUDE.md` is untracked, and is copied per-lane at spawn (VERIFIED)

- `.gitignore` lists `CLAUDE.md`, `OWNER.md`, `fleet.json`, `lane-outcomes.jsonl`,
  `dispositions.jsonl`, `audit.jsonl`, `steward-journal.jsonl`.
- `git ls-files --error-unmatch CLAUDE.md` → *did not match any file known to git*. It is not
  merely ignored, it is **untracked**: no history, no diff, no blame, no review, no rollback.
- It reaches lanes by a deliberate copy: `server.ts:868–877` copies `.env`, `CLAUDE.md`,
  `.claude/settings.local.json` into a new worktree — and, by design, **only if the file is
  git-ignored**, precisely so the copy cannot dirty the lane and block `land`. The mechanism is
  well-built and well-commented; the consequences below are unintended.
- `OWNER.md` (15 KB, the safety-critical owner-model) is untracked *and* not in the copy list —
  so no lane has ever seen it. Probably intended; recorded because nothing states it.

The reason for the ignore is legitimate: `gh repo view` → **PUBLIC**. These files carry the
Tailscale address, deploy specifics and owner model. So the fix is not `git add` (§5).

## 2. Live victim: the `e2e-split` lane's rulebook update is scheduled for silent deletion

While auditing, the running `e2e-split` lane had already done exactly what the Wissenspflege
rule demands — updated its `CLAUDE.md` with (a) "no known flakes" replacing the stale
two-flake amnesty, and (b) a full paragraph teaching every future lane the new `e2e/*.ts`
structure (where checks go, `e2e/harness.ts`, `paneEnv()` instead of hand-rolled
send-keys+sleep+capture, which harnesses stay single-file).

`git -C …/e2e-split status --short` → **empty**. Git cannot see the edit; the file is ignored.
At land, `removeWorktreeSafe` → `git worktree remove` deletes the worktree — and the update
with it. The lane would have reported "docs updated per Wissenspflege" **truthfully**, and
nothing would have arrived on main. Nobody would have noticed until a later lane hand-rolled a
pane probe the removed rule warns against.

Rescued to the session scratchpad (`CLAUDE.md.e2e-split-rescued`, 11 120 bytes). **Apply it to
the main checkout's `CLAUDE.md` after e2e-split lands** — not before: it describes a structure
that does not exist on main yet.

## 3. The anti-drift norm institutionalizes drift (VERIFIED, measured)

`lane-brief-template.md:69` (yesterday's own norm) says: never paste the gate command into a
brief — write *"run the Verify line in the lane's CLAUDE.md"*, because **"the lane has that
file, and it is the single source."**

There is no single source. Each lane holds a snapshot from its spawn instant. Measured today
against the main checkout's copy:

| worktree | copy taken | lines differing from main |
|---|---|---|
| `arch-review` | 07-25 13:26 | 0 |
| `e2e-split` | 07-25 14:58 | 3 (its own rescue-pending edit) |
| `⚙ steward` | **07-24 09:14** | **9** |

The steward — the designated planning agent, alive since yesterday — is running on a rulebook
that lacks the `fails-identically-at-HEAD` proof duty, and whose Verify line is missing both
`merge-prompt.ts` and `./e2e-clean-review.sh`. A brief that points it at "the Verify line in
your CLAUDE.md" points it at the *wrong command*, silently. The norm was written to prevent
exactly this drift and, because of the copy mechanism, guarantees it instead.

## 4. Nothing is backed up (VERIFIED)

- `git remote -v` → `github.com/jp290/claude-fleet`, and `gh repo view` reports
  **`pushedAt: 2026-07-13`**. Twelve days of commits — including every land of the calibration
  program — exist on this disk only.
- The untracked layer (rulebook, owner model, `fleet.json`, and all four `.jsonl` trails:
  ~98 KB of ledger/audit/journal) has never had version control or an off-machine copy at all.
  `fleet.json.bak` is one generation deep.

So the graduation programme's entire evidential base — the thing every criterion is counted
from, and which by design cannot be reconstructed (it records events, not derivable state) —
has a single point of failure with no redundancy. A disk loss doesn't set the program back; it
ends it, and the code with it.

## 5. Fixes, ordered, constrained by the public remote

1. **Today, free:** apply the rescued `CLAUDE.md` after e2e-split lands (§2). Then add one line
   to `lane-brief-template.md`: a lane's `CLAUDE.md` is a *spawn-time snapshot* — long-lived
   lanes must re-read the main checkout's copy, and rulebook edits must be reported in the
   lane's report as text, since they cannot be committed.
2. **Version the rulebook privately (small, high value):** a private repo (or a second remote
   with a private mirror) holding `CLAUDE.md`, `OWNER.md`, and the `.jsonl` trails; a one-line
   commit hook or a daily job. This gives the governing file what every source file already
   has: history, diff, review, rollback — and gives the evidence base a backup.
   *Do not* `git add` them into the public repo.
3. **Refresh, don't just copy:** at lane spawn the copy is right; for a long-lived lane, make
   staleness visible — a steward fact (`rulebookAge`/hash mismatch vs the main checkout) costs
   almost nothing and turns §3 from invisible into perceptible. Preferred over auto-overwriting
   a lane's file mid-flight.
4. **Push the code.** Twelve days unpushed is the cheapest fix on this page.

## Why this belongs with the other findings

`gate-coverage.md` found a safety design half-built; this one finds the governance layer
missing where the project believes it is total. Both share a shape worth naming: **Fleet's
rules are enforced on the artifacts Fleet was built to manage, and absent on the artifacts that
manage Fleet.** The rulebook, the owner model, the ledgers, and the deploy scripts' effects are
exactly the objects with no gate, no review, no history, and no backup.
