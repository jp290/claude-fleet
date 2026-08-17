# Standing rules (kit v1 template)

This file IS the mandatory block below. The MAIN copies the block verbatim to the END of every
worker brief AND every reviewer/critic brief. A brief without the block is invalid: an agent
receiving one reports the missing block instead of starting work. Promoting a rule = editing this
one file in the program repo; every future spawn inherits it mechanically.

Per-program: replace the {BRACED} slots; add product-specific mechanical rules below the line
marked PROGRAM. Never add judgement-call rules here — they belong in the decision record.

---

## STANDING RULES (copy verbatim; binding)

- Delivery proof: your FIRST action is to commit `ack.md` containing the content hash named at
  the top of your brief. No hash in the brief = report that instead of starting.
- Media reads are size-gated: before ANY image/media Read, `stat -f%z <file>`; Read only if
  ≤{MAX_MEDIA_KB} KB. To inspect larger media, first make a compliant copy (downscale or crop)
  in the scratchpad and Read the copy. Applies to reviewers and critics too.
- Self-check captures are one pipeline: capture → downscale into the scratchpad → DELETE the
  full-resolution original in the same command. A full-res iteration artifact must never exist
  to be Read. (Artifacts of record are exempt: committed from a clean tree, consumed via
  crops/downscales only.)
- Stop mechanics: at turn {TURN_CAP} your NEXT output is the state note
  (`state-note-template.md`, ≤2k tokens), then terminate. A state-note continuation is the SAME
  attempt. Iteration is not suspect — the ceiling exists because context grows quadratically
  with lifetime.
- Large tool output goes to a file, never the transcript: any command whose output can exceed
  ~100 lines runs as `cmd > log 2>&1` and you Read the tail. Judge suites by their tail.
- Smallest sufficient context: read the files the brief names and what your task provably
  needs; never load repository-wide context on spec.
- Report only the slice: summary + quoted verification tails + one line per unresolved item.
  Label unavailable evidence `unknown`, never infer it.

## PROGRAM-SPECIFIC MECHANICAL RULES (still copied verbatim)

- {e.g. capture viewport, telemetry command, determinism canary invocation}
