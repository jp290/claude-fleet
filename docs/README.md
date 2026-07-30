# Claude Fleet — the knowledge, not just the tool

Fleet is a **harness for Claude Code** — see, send, spawn, land, let go. That is the whole
of it (owner decision, 2026-07-28). What this shelf holds is the operating knowledge that
makes the harness work: how to brief a session, what a green gate actually attests, which
failures are the machine's and which are yours.

Every feature that survives is a principle wearing a UI:

| Principle | Made concrete as |
|---|---|
| Quarantine work by default; promotion is the human's call | **lanes** (worktree isolation, land-only-if-safe) |
| First-pass reliability comes from context, not vigilance | **tailored briefs** (`tailored-context.md`) |
| A done-signal must be deterministic to be trusted | **the verify gate** + the tier-2 post-land audit |
| An unknown must never read as a zero | the derived ledgers (`continuity.ts`, `slotstats.ts`) |

## Two shelves, and the second matters more

1. **Knowledge (human-facing)** — the *why*. Prose you read to build the mental model.
2. **Operative context (agent-facing)** — the *discipline made loadable*. Context that
   changes how a session behaves when it is loaded (CLAUDE.md, the commands, brief
   templates). The test of "usefully documented" is not "well written" — it is **does a
   session that loads this behave more reliably?**

## Where knowledge actually lives (read this before hunting for a doc)

Three places, and only the first is this folder:

- **`docs/*.md`** — the ten operative docs below. Everything that earns ongoing
  maintenance.
- **Commit bodies** — *this repo's finding register.* A defect, its mechanism, its
  measurement and its rejected alternatives are written where the change is:
  `git log <last handoff>..HEAD` with bodies, never a summary. Integration provenance
  hangs off the commits too (`git notes --ref=fleet/land show <sha>`).
- **Code comments at the decision site** — where a *why* would rot if it lived apart from
  the line it explains. `slotstats.ts` and `continuity.ts` carry their direction discipline
  in the file; `runReview`'s context delivery carries its rejected alternatives at the
  constants.

Deliberately **not** a fourth place: a summary doc that restates any of the three. That is
how the shelf grew to 52 docs whose claims nobody re-derived.

## The ten operative docs

One line per doc — its *purpose*, not its contents, so this index points without rotting.

**Verification and its failure modes**
- **`verify-tiering.md`** — what a green gate actually *attests*, every candidate suite
  priced by wall-clock, and why the full suite cannot be a hard pre-land gate (it flipped
  red on an unchanged tree). Carries the flake families and the proof discipline: **run the
  same tree twice first**; a green HEAD run proves nothing and reads like a conviction.
  Read before proposing to gate on a suite, and before adjudicating a red check.
- **`suite-contention.md`** — suite non-determinism root-caused to `index.lock` races
  against Fleet's own polling. Read before treating flakiness as a property of the suite,
  and before serializing anything else around it.
- **`e2e-trail.md`** — the per-check trail: the row shape, why it lives in the main
  checkout, and why the timing field is `msSincePrev` and not a duration. Read before
  querying or extending it.

**Briefing and scope**
- **`tailored-context.md`** — the brief principle: shape the environment, induce silent
  capture of the complementary parameters, emit only the result. The lever on review cost.
- **`lane-brief-template.md`** — the per-task framing passed at launch.
- **`scope-inflation.md`** — the step from a finding to a *program*, and how it inflates: a
  ranked list without a cut line is a portfolio, not a plan. Quote the owner's ask verbatim
  and cut the list where it is satisfied.

**Knowledge hygiene**
- **`knowledge-currency.md`** — a worktree delivers the shelf as of *spawn time*. A lane
  reads main's newest knowledge with `git show main:docs/x.md`. Read before proposing a
  shared knowledge store (the answer has been no three times).
- **`ungoverned-artifacts.md`** — `CLAUDE.md`, `OWNER.md` and the `.jsonl` trails are
  untracked and copied per-lane at spawn: why a lane cannot fulfil Wissenspflege for the
  rulebook, and the measured drift.

**The steward**
- **`steward.md`** — the convention (optional, recognizable as `⚙ steward`, plans but never
  lands) and its **two pulses**: the Rundgang watches the operation, the Inspektion watches
  the substance.

**Measured programs**
- **`data-saver.md`** — the bandwidth program: `/api/sessions` was the cause, not the
  terminal. Doubles as `scope-inflation.md`'s worked case.

*(`docs/screenshot.png` is the board image the top-level README embeds — not a doc.)*

## The attic

`docs/attic/` holds ~52 docs from the ideation layer: the autonomy/graduation program, the
steward concept universe, dated analysis snapshots. **Nothing there is deleted** — it is
readable and reactivatable with `git mv`, and its own README names the decision. But
nothing there demands maintenance, generates rules, or binds attention. A pointer into the
attic is a pointer into history, and the commands that still cite one write
`docs/attic/…` so the path itself tells you which shelf you are on.

Not published at all: the four internal security working documents (trust-perimeter,
security-model, the 2026-07-25 review, security-findings) — their status markers track a
live deployment and read as false statements out of context. Named without file extensions
on purpose, so the pointer check below does not trip over four entries that are *supposed*
to be absent: a check people learn to ignore is worse than no check. What they produced IS
public: the regression suite `./e2e-security.sh` and the hardening in the code (closed tool
profiles, delimited agent input, 0600 lane copies).

## Keeping this index honest

Every pointer here must resolve to a file. That check is one line, and this index failed it
for two days after the attic move — 10 of 61 pointers resolved, and the doc that stated the
rule was the one breaking it:

```sh
for f in $(grep -oE '`[a-z0-9-]+\.md`' docs/README.md | tr -d '`' | sort -u); do
  [ -f "docs/$f" ] || echo "BROKEN: $f"
done
```

The failure mode was not laziness — an index of 61 entries cannot be re-derived by hand, so
nobody re-derived it. Ten can. That is the real argument for a small shelf.

## The bar

Write each piece so that a session which loads it makes fewer first-pass mistakes and needs
less review. If a doc doesn't change behavior, it belongs in the attic — not dressed up as
operative context.
