# State note (kit v1) — the only valid output at the turn cap, ≤2k tokens

1. **Works** — what is verified done, with the quoted command tail.
2. **Residual defects** — ranked, each with the exact file:line or artifact path.
3. **Decisive diffs** — the changes that mattered (paths + one line why each).
4. **Rejected approaches** — what was tried and abandoned, one line each, so the successor
   never re-walks a dead end.
5. **Exact next steps** — imperative, ordered, resumable by a fresh worker with zero shared
   memory.

A state-note continuation is the SAME attempt. The note is committed (or written to the pack
directory) BEFORE termination — a note in a dying context does not exist.
