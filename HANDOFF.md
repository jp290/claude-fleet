# HANDOFF — 2026-07-25 (session 4: the perception write side · the discrepancy hunt · four own errors)

*A thin map, NOT the knowledge. Durable findings live in `docs/` and are named below with their
owner-doc. **Treat every line here as a claim to verify** — look up commits, states and counts before
building on them. Three of this session's four own errors were exactly that failure (§5).*

---

## 1. State — and the ONE thing that must happen first

```
git log --oneline -4 && tmux -L claudefleet list-sessions -F '#{session_name} #{t:session_created}' | grep srv \
  && curl -s -o /dev/null -w '%{http_code}\n' http://100.64.0.1:8790/ && wc -l lane-outcomes.jsonl
```

| what | commit | state |
|---|---|---|
| Perception **write side** — deterministic `done-looking`, auto-③, review-on-row | `600d401` | landed, **NOT yet deployed** |
| `knowledge-layers.md` — the three-layer assessment + L1 rot corrections | `8bd7b98` | landed |
| Discrepancy audit — 13 findings, 8 doc/config fixes, the arena repair | this lane | lands with this file |
| CLAUDE.md → Deploy: the auto-③ flag contract | (gitignored) | on disk |

> ### ⚠️ `tmux -L claudefleet kill-session -t srv`
> The live `srv` has been up since **2026-07-25 00:16:54** and therefore predates `600d401`.
> **auto-③ and the whole `review` field are inert until it restarts.** Not housekeeping: this is
> what makes the write side produce its first datum. Ledger row 3 is the proof of cost — it carries
> **no `review` key at all** because the code that writes it had landed but never loaded.
>
> **This trap fired three times in two days** (ledger row 2, ledger row 3, and the fast-tier gate
> believed undeployed for a day). *Landing is not deploying.* Closing it mechanically is
> `BACKLOG.md` P-4 — which is why P-4 outranks its size.

After the restart, verify the write side actually runs rather than assuming it: the **next** landed
lane's row must contain a `review` object (`GET /api/lane-outcomes?limit=2`). Rows 1–3 never will.

---

## 2. What `600d401` built (grep the symbols — line refs drift)

`lane-signals.ts` — `DONE_LOOKING_RULES` / `laneDoneLooking`: `done-looking` as a deterministic
predicate. Its clause list **generates** the digest worker's prose rule (`DONE_LOOKING_PROSE`), so
spec and implementation cannot drift without one edit touching both. Unknown facts (null
alive/git/idleMs) read as *not* done-looking — never as permission to spawn.

`server.ts` — `tickAutoReview` (lanes only, never `⚙ steward`, one attempt per git state via
`reviewAutoTried` written **before** the spawn so failures are remembered too, max 2 concurrent,
fire-and-forget outside the busy guard, fresh `gitOpInProgress` rather than the 10 s cache);
`startReview` (freezes `{key, cwd, branch}` and re-checks before the cache write — makes two real
bugs unreachable rather than unlikely); `patchIdOf` + `outcomeReview` (the `OutcomeReview` union
`covered | superseded | inflight | none`).

**Independently verified on `git archive` of the lane commit** — not taken from the lane's claim:
`tsc` 0 errors · `bun run build` exit 0 · `e2e-isolated.sh` **ALL PASS, 626 checks, 0 FAIL** ·
`e2e-claude-gate.sh` ALL PASS · `e2e-clean-review.sh` ALL PASS. The known pane-capture flake did not
fire.

**Two places the lane beat its own spec — keep as the pattern:** it made spec/implementation drift
*structurally impossible* rather than merely unlikely, and it turned two states into four
(`inflight` and `none` as explicit answers instead of a missing field).

**auto-③ is ON by default** (`FLEET_AUTO_REVIEW_MS` 15 s tick, `FLEET_AUTO_REVIEW_IDLE_MS` 60 s;
`=0` disables). Owner decision 2026-07-25: keep it on, document it — done in CLAUDE.md → Deploy.
Expect after the restart: real throwaway claude sessions spawning unprompted on done-looking lanes.
A harness with no `FLEET_REVIEW_CMD` stand-in **must** set `FLEET_AUTO_REVIEW_MS=0`;
`e2e-claude-gate.sh` and `e2e-clean-review.sh` do.

**Ledger row 3 is the first healthy row.** `commitCount: 1`, all 6 `filesTouched`, `shortstat`
present, `verified: true`, `confirmedByHuman: false` (clean auto-land), `base` = the land site's
`mainBefore`, `ownerPrompts: 3` (brief + two corrections — the counter measuring exactly what it
should). Rows 1–2 stay zeroed on purpose. **`sessionMs` is lane *lifetime*, not work time** (row 3:
8.4 h for ~1 h of work) — never read it as effort.

---

## 3. The roadmap, merged from two independent passes

`knowledge-layers.md` §6 supplies the frame that reorders everything: the three knowledge layers
**sabotage each other in a loop** — L1's stale index misleads the briefer (L2), the un-briefed
dispatch path poisons the provenance fields (L3), and with no reader nothing ever corrects the docs
from reality (L1). **Perception is the missing closing edge, not merely a feature of L3.**

1. **Lane (a) — the outcome feed.** Client-only (`src/client.ts` + `public/index.html`), footprint-
   disjoint from everything else. **The reason is measurement, not UI:** `knowledge-layers.md` §5
   gap 3 shows a prompt land structurally beats auto-③ (60 s idle + ≤15 s tick + ≤180 s agent), so
   the modal row may permanently be review-less — and nothing can reveal that without a reader.
   Its brief is already assembled across three docs plus one fact only this session knows:
   `perception-layer.md` §6's two honesty constraints (*empty findings ≠ clean*; `↩ undo` is
   one-step only), `knowledge-layers.md` §5 gap 4 (rows 1–2 must render as *not measured*, never as
   *measured zero*), and — **rows 1–3 have no `review` key at all while row 4+ will have
   `{state: …}`**, so the renderer must carry both shapes and lane 1's e2e assertion "every
   disposition carries the review relation" holds only for rows written after the restart.
   **Blocker to fix first or accept:** `discrepancy-audit.md` F5 — `OutcomeReview` persists neither
   `scope`, `notes` nor `raw`, so a reviewer whose answer did not parse is stored as
   `{state:"covered", findings:[]}`, byte-identical to a real clean review. §6's first honesty
   constraint is **not satisfiable from the ledger alone** until those fields are added write-side.
2. **P-4 — the deploy-gap fact.** The server knows its boot time and its HEAD; `rev-list --count`
   plus "does any of those commits touch code" is ~15 lines. No longer theoretical: three strikes in
   two days, each costing trust in a row that looked right.
3. **Provenance honesty (one lane, one root cause).** The outcome row's provenance reads **one of
   five source tags**. `laneOwnerPrompts` keeps only `source === "owner"`, so pane-typed prompts
   (`"terminal"`, 755 of 2441 live journal lines) are invisible and dispatcher-delivered briefs
   (`"auto"`) make `briefHash` null or the hash of a later follow-up — measured: **25 of 49 live
   lanes null, 5 hashing a later prompt, 19 correct** (`discrepancy-audit.md` F3). Ride along here:
   the ledger riders `repo` and a `filesTouched`-truncated flag, and F6 (the ledger rotates; its only
   reader reads one generation while both sibling readers span).
4. **The L1 rot detector.** Two mechanical checks — every index pointer resolves; no doc says
   "unbuilt" about a symbol `server.ts` defines (`knowledge-layers.md` §7.3). It already has a
   backlog: slot 9 ran both by hand and reports **four further "unbuilt" hits** (steward-nudge, the
   stuck-looping detector in overview/roadmap), deliberately left because it had not read those
   docs. Rides along with any docs-touching lane; the only item that prevents its own class of
   failure from recurring.
5. **The dispatcher brief** — after (1), per its own argument: without measurement it repeats the
   listed dead end ("promoting a prompt edit as an improvement while no eval set exists").
6. **`steward-nudge.md` §8, honestly shrunk.** From existing artefacts it can deliver **recall and
   the direction split only**, on an idle *proxy* signal, minus every dirty-tree condition.
   Precision needs a small **forward recorder** (surface state at each owner/terminal prompt +
   downsampled per-lane samples) plus N days — so if wanted at all, that recorder ships early,
   because its data only accrues from the day it lands.

**Deliberately parked:** footprint-disjoint parallel dispatch (capacity was never the constraint;
review is) and any prompt writer (THE GUARD, `steward-nudge.md` §9).

**A number that must not be trusted as it stands.** `BACKLOG.md` Track A records "~25 % of un-nudged
slots look helped" as *the null any future nudge must beat*. It is a per-boot artefact:
`baselineSamples` is an in-memory ring (cap 50), absent from `fleet.json`. Live re-read this
session: **6.7 % (1/15)** vs 25 % (3/12) — **Fisher exact p = 0.294**, indistinguishable. Detecting
a 15→30 pp lift needs **≈121 samples per arm**; the ring holds 50 and empties on every restart, and
the nudged arm stands at **0**. Never set a done-criterion of "nudged rate beats `baselineRate`".

---

## 4. New durable knowledge — which doc owns what

- **`docs/knowledge-layers.md`** (new, `8bd7b98`) — the three layers measured against their own
  stated bars, the sabotage loop, §7's ordering. Read before proposing any knowledge store: the
  answer to "does Fleet need a lookup service" is **no**, because the recurring defect is currency,
  not findability.
- **`docs/discrepancy-audit.md`** (new) — **operative.** Eight discrepancy classes each with a
  confirmed instance and the command that proved it; five proof rules; fix-vs-document; five sweep
  axes; hard limits; findings log F1–F13. Load it before auditing the corpus against the code.
- **`docs/perception-layer.md`** — the design, with its build status, and §5's corrected staleness
  rule: **content identity via `git patch-id --stable`, not commit identity** (the land path
  rebases, so a key comparison would mark reviews superseded chronically — worst under the
  parallelism the layer exists for). Empirically: patch-id survives a rebase whose main-side edits
  are far from the lane hunks and changes when main edited inside the ±3 context lines, which is the
  honest answer because that is the interaction the review never saw.
- **`docs/merge-review-autonomy.md`** — the fast-tier gate **is deployed** (believed otherwise for a
  day), and F9's adjudication in both directions.
- **`CLAUDE.md` → Deploy** — the auto-③ flag contract (gitignored; Fleet copies it into every lane).

---

## 5. Method lessons — including four of this session's own errors

Statements about *working method*, not about Fleet. Each is a worked example inside
`discrepancy-audit.md`, which is why its proof rules read the way they do.

1. **Running a check is not reading its output.** A `patch-id` experiment was reported as
   "empirically verified" while `fatal: invalid upstream 'master'` sat visibly in the same output —
   the rebase under test never ran. The conclusion happened to be right; the evidence was worthless,
   and it was handed to a lane as proven.
2. **A correction must address the same object as the claim.** "9 slots were free all day" (about
   2026-07-24) was "corrected" with a measurement taken 2026-07-25 — and the fact is *unknowable*,
   since historical slot occupancy is never persisted. Retracted.
3. **Judging a diff by its TypeScript.** "I read the whole diff" had skipped the three shell
   scripts — which is exactly where both real findings were (auto-③ ON by default in production;
   harnesses must disable it). The land gate lives in a shell script.
4. **Editing a section after reading part of it.** The F9 correction was written after reading 30
   lines of a 67-line entry, so it landed beside the lane's own counter-argument — which had already
   *rejected* the objection the correction *accepted*. Result: two contradictory paragraphs in the
   land preview. Same class as (3), one level finer. **This is what the owner saw as "the dispute".**
   Adjudicated in `40c4611`: the objection wins about the title (row 3 falsifies "cannot" deductively)
   and loses about the verdict (proof rule 2 — the worktree is gone, so *why* it passed is
   unrecoverable), and the mechanism offered was refuted in its one checkable part.
5. **Read the surrounding comment before calling something wrong.** This codebase documents its
   deliberate trades in place. When the code owns the trade, the finding is not "this is a defect"
   but "a doc elsewhere uses it as if the trade did not exist." The audit lane applied this and
   **dropped 14 of 27 candidates** with that as the dominant cluster; dropping is a result.
6. **Delegation gives breadth, not verdicts.** Five dedicated agents produced the map that made this
   session's findings possible — and one of their headline findings (F9) was too absolute and
   contradicted a ledger row. Every agent finding is a candidate until re-proven first-hand.
7. **The reviewer is the author.** For anything designed in this session, the owner's read is the
   only independent check; the "gib dir Mühe" rounds are the only mechanism compensating for it.
   There is ③ for lane diffs and nothing adversarial for specs and briefs.

---

## 6. Traps that bit, with mitigations

- **Landing ≠ deploying** — 3×. Mitigation: §1's box; mechanically P-4.
- **Doc collision lane ↔ main checkout** — fired live: slot 9 committed `8bd7b98` touching the same
  four docs the audit lane had already edited → three real conflicts. It failed *loudly* only
  because slot 9 committed rather than leaving work uncommitted. Both sides were real work and were
  merged by hand keeping each side's unique insight — main's tombstone deliberately carries no
  filename-with-extension so the planned pointer-check cannot trip over its own gravestone; the
  lane's carried the proof and where the norm moved. **Rule: two producers on `docs/` at once needs
  the second's footprint known up front, or the first landed.**
- **A claim I retracted:** that running a suite inside a lane worktree leaves untracked files and
  blocks `land`. **False** — `e2e-isolated.sh` copies the tree to a `$$`-derived `$DIR` and the
  stand-ins write there. Concurrent verification *is* possible; the `git archive` copy used this
  session was unnecessary caution with a false rationale.
- **The land gate's first step is luck-dependent** (`discrepancy-audit.md` F9). `bunx tsc
  --types bun` needs `node_modules`; `createWorktree` copies only
  `.env`/`CLAUDE.md`/`.claude/settings.local.json`; the resolution walk does not rescue it
  (`~/node_modules` holds 4 packages, no `bun-types`); 3 of 5 worktrees have none. Row 3 proves it
  *can* pass, but not why — and an unexplainable green is not a gate.

---

## 7. Outside the repo — reported, not touched

Shared reality per CLAUDE.md: **3 leaked `bun server.ts` from prior sessions** (pids 51871 Jul 18,
57507 Jul 21, 23907 Jul 23 + its tmux server 23906) and **216 stale socket files** in
`/private/tmp/tmux-501/`. Owner's call; cleanup command on request.

`FLEET_CLEAN_REVIEW` stays **off**, auto-dispatch stays **off** — both are autonomy expansions and
owner decisions.

---

## 8. A fresh session's first five minutes

1. Run the state command in §1. If `srv` still predates the newest code commit, **that is the first
   task** — nothing measured before it means anything.
2. `docs/README.md` for the map, then `docs/knowledge-layers.md` §7 for the ordering and
   `docs/discrepancy-audit.md` for the proof discipline. Those three make this file mostly
   redundant, which is the intent.
3. Check whether any ledger row carries a `review` object yet. That single fact says whether the
   perception write side has ever run in production.
