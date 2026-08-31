# Worker/reviewer brief template (kit v2)

Every slot is mandatory; an empty slot is written as `none`, never omitted — absence must be
distinguishable from forgetting.

1. **Content hash** — `sha256` of this brief's body; the worker's ACK commit must echo it.
2. **Role + deliverable boundary** — ONE bounded deliverable; what is explicitly out of scope.
3. **Contract excerpt** — the 3–10 lines of the program contract this task must honor (never
   "read the contract": the excerpt IS the delivery; cite the file for depth).
4. **Files** — exact paths (with line ranges where known) to read; exact paths allowed to edit.
5. **Done criterion + verification** — one checkable sentence and the literal command whose tail
   proves it; quote the tail in the report.
6. **Attempt budget** — which attempt this is (max two per gate; feel/tuning work counts
   attempts per hypothesis, not per gate, if the program adopted that rule).
7. **Evidence** — which pack schema applies (`evidence-pack-schema.md`), where packs land.
8. **STANDING RULES block** — verbatim, at the end, always (also for reviewers/critics).
