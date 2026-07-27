# Data-layer audit, 2026-07-27 — six parallel read-only agents over Fleet's data plumbing

Commissioned by the owner after the ledger mining (`docs/mining-2026-07-26.md`): "look for more
obvious flaws or potential improvements on the data and data handling side." Six agents, each
given one concern with named files and the house standards (read before claiming, cite
`file:line`, cost every finding, state what was not checked). This is the synthesis. Findings
keep their agent's evidence; the ranking is mine.

**Method note:** the audit was read-only — no server started, no suite run, nothing edited.
Everything below is either read out of the code, measured off a file, or explicitly marked
inferred.

---

## The cut line

Items 1–9 are worth acting on. Everything under "Below the line" is real, cited, and can wait.

---

### 1. The ② reviewer's main-side feed was computed as `main..main` — empty for every lane, always

Found by lane `fleet/260726201422-b499` while enriching the prompt, verified in its diff.
`runCleanReview` computed main's new work as `${base}..${main}` where `base` is a *branch name*
that tracks the tip and `main` is that same branch — so the range was `main..main`: **empty for
every lane ever reviewed, regardless of what main actually gained.**

This supersedes `mining-2026-07-26.md` finding 3. That finding read the symptom right — all 25
valid shadow verdicts argue "main gained zero commits since the fork" — and got the cause wrong:
it is not a degenerate input *distribution*, it is a **broken feed**. Every K2 shadow verdict on
record measured a reviewer being told there was nothing to check.

Cost: the entire ②-shadow measurement series is void as evidence about judgment.
`graduation-criteria.md` §2's N≥25 counts answers to a question that was never asked. Fixed in
the lane (anchors on the fork *commit*, renders an unresolvable fork as UNKNOWN rather than a
settled zero); the fix is not deployed, so the correction takes effect on the first srv restart
after landing.

### 2. A restart mid-merge can let agent-resolved conflicts auto-land unreviewed

`server.ts:6110-6111` deletes `mergeLast` and persists that deletion **before** `mergeJob` starts;
the verdict is only written back at `server.ts:3798`. A restart in between — a window as long as a
resolver run plus verify plus repair rounds — leaves the lane rebased with agent-chosen conflict
resolutions committed and **no verdict at all**. The ⏸ review guard at `server.ts:6104` keys on
`status === "resolved"`, so it does not fire; a re-run finds the branch already rebased
(`tryScriptRebase` exits 0), takes the clean path, and auto-lands.

Silent: the board shows no verdict, indistinguishable from "no merge was ever run here". Measured
restart cadence makes this live, not theoretical — `server.log` holds **125 watchdog respawns
between 07-14 and 07-26** (~10/day). This is the exact failure the boot comment at
`server.ts:4270` believes persisting `mergeLast` fixed; persisting closed "a deploy wipes a
written verdict" and left "a deploy during the run that would have written it" open.

### 3. A restart mid-land moves `main` with zero provenance — and recovery is impossible

`advanceIntegration` moves main at `server.ts:3762`; `recordLand` (undo record, land note, tier-2
audit) runs at `:3770`. A restart between them leaves main advanced with **no undo record, no
`refs/notes/fleet/land`, no post-land audit, no outcome row**, and the worktree still on disk.
Re-running does not repair it: `recordLand` returns early when `mainBefore === mainAfter`
(`server.ts:2800`), so the second pass creates none of it either.

Silent, and it destroys the one property the whole autonomy argument rests on — reversibility.

### 4. `confirmedByHuman: false` does not mean unattended, and the graduation criterion reads it as if it does

`mergeJob` has exactly one caller: `server.ts:6112`, inside `POST /api/slots/:id/merge`. No tick,
no dispatcher, no auto-③ path reaches it. So `false` means only *"the owner did not have to click
a second confirm"* — never *"no human initiated this"*.

```
Counter({False: 42, True: 4})   # confirmedByHuman across landed rows
```

`kProgress` (`src/client.ts:3074`) counts that field into `clean` and the chip reads "davon N/10
clean" with the tooltip "a clean auto-land"; `graduation-criteria.md` §1 wants "≥10 clean
auto-lands" as evidence for **unattended** landing. Not one of the 42 happened without an owner
request. The criterion measures confirmation depth and is labelled attendance. (This is the
mechanical form of what the ladder already says in prose: no number of attended lands licenses an
unattended one.)

### 5. The post-land audit alarm is shipped 30×/minute to a client that never reads it

`server.ts:5514` puts `postLandAudit` into the `/api/sessions` payload with the comment "the
client's job is to make a `red`/`unknown` result impossible to miss". Exhaustive search of both
client sources (python over the decoded bytes, because of the NUL byte) finds **zero**
occurrences of `postLandAudit`, `postland`, `post-land`, or `covers`. `docs/gate-coverage.md:118`
and `docs/verify-tiering.md:318` both claim this surface exists.

So the only automated safety net that runs after a land raises its alarm in three places nobody
looks at and zero places they do — which is why the two red audits of 07-26 went unread. Lane
`c2aa` just gave the *steward* a ledger feed; the **browser board still has nothing**, and the
field is dead weight on the exact payload the data-saver program is shrinking.

### 6. A red audit's row cannot say what failed — the cap keeps 4% of the output, all of it PASS lines

`server.ts:3025` keeps the last 4096 chars. The suite prints `FAIL <name>` lines interleaved among
~860 checks and only the count at the end, so the retained window holds 33 result lines — **all
PASS** — plus "6 FAILURES". Measured on both red rows: `FAIL`-substring count 1 (the word inside
"FAILURES"), PASS count 33.

The fallback is gone too: the kept TMPDIR instance is the inner server's working directory, not a
run log. **Which checks failed in the 07-26 15:57 audit is unrecoverable from any artifact on this
machine.** The same defect sits in `VERIFY_OUT_CAP` (`server.ts:2685`) — and *that* one gates
lands. Both also build `combined` as `out + err` and tail-slice it, so a large stderr would
silently displace the entire verdict.

### 7. Losing `reviewCache` writes a false "never reviewed" into the permanent ledger

`reviewCache` (`server.ts:2181`) is not persisted. `outcomeReview` returns `{state:"none"}` when it
is empty (`server.ts:3213`), and that value is stamped onto every terminal row. A restart between a
completed ③ review and the lane's land makes the ledger say the lane was never reviewed —
indistinguishable forever from a genuinely unreviewed lane, and biased in the direction that
*looks* conservative while corrupting the evidence base.

### 8. The rotation cliff: 4 of 6 ledger readers see one generation, and K1/K2 reset silently when it fires

Correction to my own earlier claim first: **`audit.jsonl.1` does not exist and rotation has never
fired.** I asserted rotation was already running, from an `audit.jsonl.1` I saw inside a TMPDIR
*test instance*, not the repo. Agent 3 caught it.

`appendEvent` (`server.ts:418-423`) rotates all five ledgers at 5 MB, **single generation,
`renameSync` clobbering the previous `.1` permanently**. Two readers span both generations
(`stewardRecentSends`, `readStewardJournal`); four do not — `/api/lane-outcomes` (`:5625`),
`/api/post-land-audits` (`:5643`), `/api/audit` (`:5607`), `readDispositions` (`:3441`).

Measured horizons: post-land-audits ≈ 63 days, lane-outcomes ≈ 81 days. On that day the K2 series
and the K1 anchor drop out of the response with no error and no log line, and the criteria
re-earn work already done.

### 9. Nothing prevents a second server from corrupting `fleet.json` — and corruption means a token lockout

`STATE_FILE` derives from `import.meta.dir` (`server.ts:30`), so any `bun server.ts` in the main
checkout targets the live file whatever `FLEET_PORT` says. The temp file has a **fixed name**
(`server.ts:463`), `saveChain` serializes writers within one process only, and greps find no
lockfile, pidfile, or `O_EXCL` anywhere. Two servers interleave into one `fleet.json.tmp` and both
rename it over the state file.

The consequences chain: an unparseable state file makes boot **mint a new owner token**
(`server.ts:4363`) — every bookmarked URL, share link, and lane `selfToken` dies at once. The
recovery affordance copies the *already-damaged* file to `.bak` (`server.ts:4346`), so it
preserves the corruption rather than the last good state. And there is **no fsync anywhere in the
codebase**, so a power loss can commit the rename ahead of the data and produce exactly the
zero-length file the temp+rename design was meant to rule out.

Related, same agent: `fleet.json.tmp` is written then `chmod`ed, leaving a 0644 window over a file
containing the owner token, the steward token, every lane `selfToken`, and every share secret. The
`umask 077` in `watchdog.sh:13` never reaches the server — it is set in the watchdog loop, but the
srv pane is a child of the *tmux server*, the same inheritance gap the file already documents for
`PATH`. Proof on disk: `server.log` is `-rw-r--r--`.

---

## Below the line

**Cost / load** (agent 4, after crediting the four landed data-saver lanes — `/api/sessions`
spawns zero subprocesses and is ~8 KB now):
- `transcriptPayload` (`server.ts:1813`) reads the **entire** transcript file per chat poll (1 s);
  live transcripts here are 3–7 MB. Largest server-side read cost in the system.
- `GET /api/slots/:id/worktrees` (`server.ts:5782`) fans out ≈63 `git` spawns per request, polled
  every 3 s with the board open → ~21 processes/second. No cache, no TTL.
- `tickGit` (`server.ts:739`) spawns ~45–70 children every 10 s, 24/7, with no client connected.
- No ETag / `If-None-Match` / 304 anywhere (verified by grep in both files) — an idle fleet still
  ships a byte-identical payload 30×/min.
- `poll()` reads pane bytes off disk even when a slot has no connected client (`server.ts:1646`).
- The digest route **caches worker failures** for the full 2-minute TTL (`server.ts:5083`), so one
  transient failure suppresses retries and renders as a fresh `digest:null`.

**Reader traps — the `rawAnswer` class** (agent 2):
- Every ledger route returns `total: lines.length`, counting rows the response dropped; the client
  renders that as a benign "latest 51 of 52" cap message. `continuityView` already does this right
  (`malformed` counter) — the pattern was just never applied.
- `src/client.ts:3203` renders an **absent** `confirmedByHuman` as "auto-landed clean+green" — the
  strongest positive claim in the feed, from no data. The same file gets it right for `verified`
  130 lines earlier.
- `rawAnswer` absence means two different things (healthy row vs. pre-schema failed measurement);
  the type comment asserts only the first. 3 of 8 failed measurements are the second kind.
- Sibling ledgers collide: `disposition` has two disjoint vocabularies (lane outcomes vs.
  dispositions), and timestamps split `ts` vs `at` — so a sort by `ts` over `post-land-audits`
  silently returns file order.
- `briefHash` is null for 14 rows (dispatcher-briefed and terminal-briefed lanes are not counted as
  owner prompts) and **all 14 nulls compare equal**.

**Record correctness** (agent 6):
- A land whose worktree teardown fails writes **zero** outcome rows, and the owner's follow-up kill
  then files it as `killed-dirty` — an abandonment record for work already on main.
- The `baseSha` guard holds on only 2 of the 4 paths reaching a "landed" outcome; the
  already-merged and ⏏ paths still use the creation-time fork.
- `verified` is bound to `mainSha` only, never to the lane's HEAD, so a lane that committed more
  work after the gate run still records `verified: true`.
- `resolvedConflict` / `repairRounds` have no unknown state and default to the safe-looking value.

**Growth and hygiene** (agent 3):
- `streams/prompts.jsonl` is 3.3 MB, **never rotates** (own chain, not `appendEvent`), and is
  fully read and parsed on three paths including every digest.
- 690 MB of e2e scratch in TMPDIR (92 kept instances, oldest 07-24), reaped by nothing — the
  wrapper's `trap` kills the tmux socket but never removes the directory.
- `streams/s*.raw` grows ~3.7 MB/hour for one active slot and is only cleared on slot kill — and
  the ⚙ steward slot is never killed by convention.
- 74 `fleet/*` branches are never deleted on land, pinning every landed commit; 2751 loose objects,
  zero packs.
- An audit-log write failure sets a latch that silences reporting forever and **disables the
  steward hourly send cap**, which then fails open (`server.ts:417-432`).

---

## What was not checked

No server was started and no suite was run. Not audited: `~/.claude/projects/*.jsonl` (Claude's
own transcripts — outside the repo, shared reality, and probably the largest unbounded store
touching Fleet), the guest/share read paths in `src/share.ts` beyond the `postLandAudit` search,
the e2e harnesses' own state, tmux's write atomicity for `streams/*.raw`, and whether any of the
restart-window losses in items 2/3/7 has actually fired in production — that last one is an
available empirical check (scan for a main-move with no matching land note) and would confirm or
bound two of the top three findings.

## Verified vs inferred

Verified by reading code, running a grep, or measuring a file: every `file:line` above, all row
counts and byte measurements, the absence of any fsync/instance-lock/ETag, the reader/generation
split, the client's non-consumption of `postLandAudit`, the two red rows' PASS-only tails, the 125
watchdog respawns, and the `main..main` range (read in the lane's diff).

Inferred, not executed: that a restart mid-merge leads to an unreviewed auto-land (each branch was
read and holds; the sequence was not run); that a large stderr would displace stdout in the capped
window; the growth horizons, which extrapolate from short activity windows; and that the leaked
audit snapshot dirs come from srv being killed mid-run.
