# Lane V2 — git-note provenance at land ("own your work")

Spec: `docs/merge-review-autonomy.md` §4 (binding — read first; §6 for the hard rules).
Server-only + e2e. Depends on V1's `verify` field being on main — if it isn't, stop and
report instead of inventing the shape.

Build: on EVERY land that moves main (all three paths: mergeJob clean-path land,
confirm-land, already-merged land), the SERVER attaches the review story to the landed
tip, in the repo:

- `git notes --ref=fleet/land add -m <json> <tip>` where json =
  `{branch, mainBefore, mainAfter, conflicted?, resolverDetail?, verify?,
  confirmedByHuman: boolean, at}` — everything already in scope at the land sites
  (`recordLand` is the natural seam: it already receives repo/main/branch/before/after).
- Server-authored ONLY — never the resolver agent (docs §4 records why the
  agent-written commit-message variant was rejected; don't resurrect it).
- Notes must not break anything: they alter no SHAs, dirty no tree. A notes-write
  FAILURE must never fail the land — log/audit and continue (provenance is best-effort,
  landing is the job).
- Never delete notes: undo-land keeps the note (it is the record THAT it happened).
  A second land of a re-opened branch writes a new note on the new tip (use `add -f`
  only if the same tip is landed twice — decide and document).

Tests (e2e): after a clean-path land, `git log --notes=fleet/land -1` on main shows a
note that parses and carries mainBefore/mainAfter matching the land; after a confirm
land, `confirmedByHuman:true`; after undo-land, the note still exists; a land where the
notes write fails (e.g. read-only GIT_DIR trick or bogus notes ref) still lands.
Mutation-grade where feasible (note-write removed → note-exists test fails).

Verify: tsc + collision-immune e2e scratch copy, tail "ALL PASS" (1 known flake OK).
Commit clean, no untracked files, report only the slice.
