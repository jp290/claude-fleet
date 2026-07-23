# HANDOFF — the fact-layer + frame day (2026-07-23)

*A state snapshot + pointers, not the knowledge itself. Treat every claim as a claim to
verify (CLAUDE.md): look up commits/lines/states before building on them. The canonical
knowledge lives in the docs shelf — this points, the shelf carries the depth. This
handoff is deliberately THIN: today's work landed as committed docs + code, which is the
point (`three-axes.md` — the repo IS the handoff).*

## What this session did (one paragraph)

Executed the previous arc's plan tail and then outgrew it: proved the digest beat live
(first `/rundgang` on the digest route, 09:16), landed the deep-assessment fixes (lanes
A/B/C), built and deployed the merge fact layer (V1 verify-in-verdict, V2 git-note land
provenance, `FLEET_VERIFY_CMD` set — all LIVE on srv since 13:34), designed and
validated the **foreman** (stateless propose-only pulse, v0 validated by a real pulse +
the steward's independent spec check — same verdict), and captured the umbrella
**program frame** (`three-axes.md`): sharpen as premise, three investments
(agency/ground/memory), roadmap re-weighted — **learning engine v1 is the next major
focus**. The steward independently mined and adversarially hardened a sharpen-corpus
axes model (in its pane, NOT yet persisted — blocking on two owner answers).

## Verified state (confirm with `git log --oneline -15`)

All landed on main and deployed where applicable; srv restarted 13:34 with
`FLEET_VERIFY_CMD` env-probe-confirmed in the process:
- `6a82240` A: client fail-closed land-review + race hygiene (bundles rebuilt+deployed)
- `51dc4f7` B: three high-blast gates now mutation-grade tested
- `f35e4cc` C: merge-state recycle hygiene
- `3b6bb7f` V1 verify-in-verdict · `5d6ad8f` V2 git-note provenance (`git log
  --notes=fleet/land`) · `4d98ef2` FLEET_VERIFY_CMD in watchdog.sh (repo-guarded tsc;
  watchdog changes need `launchctl kickstart`, not just srv restart)
- `660ee88` foreman doc + `/foreman` ritual · `5c69417` v0-validation results into §6.2
- `50de1d9` `three-axes.md` frame + roadmap re-weighting + learning-brief wiring
- Briefs on main: `briefs/learning-engine-v1.md` (NEXT), `arena-episode-1.md`,
  `lane-V1/V2` (done — historical). V3 has NO brief yet (deliberate).

## Read in this order (fresh session)

1. `docs/three-axes.md` — the umbrella frame + the 2026-07-23 re-weighting (§7).
2. `docs/orchestrator-autonomy.md` — foreman concept; §6.2 carries the two EMPIRICALLY
   found server increments (steward task-queue read, deploy-gap fact).
3. `docs/merge-review-autonomy.md` — the land-pipeline spec; V1+V2 built, V3 open.
4. `docs/steward-roadmap.md` — the living plan (Phase-2 entry re-weighted).

## The owner's three-step list (as agreed, in order)

1. **Answer the steward's two questions in the s1 pane** (it asked, unanswered):
   corpus durable home (proposed `~/.claude/knowledge/sharpen-corpus/` — shared
   reality, owner call) and the altitude question (bidirectional-axes lens vs. more
   situated). → Steward then persists the corpus; until persisted, the hardened model
   exists ONLY in the steward pane's context (fragile — do this first).
2. **Open a fresh session** (Opus 4.8): "Lies briefs/learning-engine-v1.md und führe
   ihn aus." Propose-never-apply; output = proposal doc only. First real flywheel turn.
3. **Commit BACKLOG.md §17** (foreign session's 93-line retrieval-layer section —
   owner's work, owner's name). Decision on it comes AFTER the learning session.

Then: proposal pre-review (verify claims) → owner promotes. Later queue, deliberately
demoted/parked: V3 brief · the two §6.2 server increments · foreman auto ·
arena episode · BACKLOG-17 decision.

## Lessons / gotchas (this session's hard-won)

- **Steward-worktree staleness bites twice**: the rundgang skill file is read BEFORE
  the ritual's own ff — a skill change lands one beat late unless the worktree is ff'd
  first (done manually once, 09:12). Guard 1 catches it, but only at pulse time.
- **Lane-base staleness is real and self-healing if verify exists**: the V2 lane
  branched pre-V1; its tsc gate + the land rebase resolved it — the auto-rebase-if-clean
  guard (§6.2) would have prevented it silently.
- **B+C shared-file collision resolved by serial landing** (B then C rebased clean).
- **`mergeLast` verdicts die at land/recycle/re-run** (`:3750`/`:1038`/`:3773`) — V2's
  git notes exist BECAUSE of this; don't reintroduce state that dies at the moment it
  becomes history.
- **Foreman v0 honesty gates held under real conditions**: it reported two guards as
  structurally not executable instead of guessing, and escalated the learning-engine
  initiation as owner-held. That behavior is the spec — protect it in any iteration.
- **Model split that worked**: Fable for the thinking/doctrine turns, Opus for build
  lanes and rituals. The learning-engine RUN is Opus-suitable (briefed why); its
  PROPOSAL REVIEW before promotion deserves Fable.
