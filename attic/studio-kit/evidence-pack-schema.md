# Evidence-pack schema + fidelity rules (kit v2)

A pack is the ONLY form in which raw trails/logs cross into a judging context. The judge never
opens the raw source; the pack names it.

**Required fields per pack:**
- `source` — path + range (or transcript id + turn range) of the raw material.
- `method` — the exact script/command that produced the pack (re-runnable).
- `coverage` — what was included, and EXPLICITLY what was dropped or capped (silent truncation
  is the known killer: it produced our only false audit finding).
- `items` — capped counts, stated in the pack header.

**Fidelity rules (the guardian — a script the MAIN runs, never an agent):**
1. Repetition/identity keys are (file, content-hash) — NEVER a truncated argument prefix.
   Truncated keys made distinct edits indistinguishable from retries.
2. Any per-item text cap is declared in the header; a capped field is marked, not silently cut.
3. Pack size has a hard ceiling ({PACK_MAX_KB} KB); an over-limit pack is split, not shrunk by
   stealth truncation.
4. Hash or length of every referenced log/file is recorded, so "what reached the judge" is
   checkable against "what exists on disk".
5. A pack that fails these checks is rejected BEFORE it reaches a critic or gate; the failure is
   itself a setup-health signal (see checklist).
