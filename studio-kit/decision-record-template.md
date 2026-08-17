# Decision record (kit v1) — opens with the proof-medium slot

Append-only, one entry per promoted decision (D1, D2, …). Producers propose; the owner promotes.

## D0 (mandatory first entry): proof-medium derivation

Filled BEFORE gate 1, via the four steps — the answers are the entry:
1. Ground-truth predicate of "done" in the product's own terms (e.g. "a lap feels controllable
   and fair at 60fps" / "a screenshot invites play").
2. Candidate falsifying artifacts, enumerated (screenshots, telemetry replays + deterministic
   re-sim, test suite, human play-trace, …).
3. Score each on: (a) pack size under finite windows · (b) critic accessibility · (c) human
   promotion cost.
4. Chosen medium/media per quality axis, and what each axis's claims must name (the Private-repo-e
   form: every claim names a reproducible artifact + source commit; "unknown" is a valid label).

Everything downstream (critic design, pack schema, gate exit criteria) derives from D0.

## Dn entries

- **Decision** — one sentence.
- **Evidence** — trail citation or measurement that motivated it.
- **Mechanical form** — the check/file/command that enforces it (a decision without one is a
  candidate for the standing-rules block or should say why judgement suffices).
- **Applicability** — if this could ever transfer to another studio, its predicate (else "local").
