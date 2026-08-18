# Appeal anchor (kit v2) — owner-supplied, bootstrap-blocking

The anchor is the comparator for every appeal verdict. It exists because absolute beauty
judgment by a blind critic measurably failed (Private-Repo-C Gate 1 passed its full rubric and died
at the owner's "very underwhelming"), while one borrowed comparison — "Re-Volt", arriving by
accident — sharpened three rounds immediately. Comparative judgment is what a blind critic CAN
do reliably. Origin: `docs/studio-underwhelm-audit-2026-08-18.md` §4, §8.

**Who fills it: the OWNER.** Producers never write the anchor they are measured against (kit
permanent constraint) — an anchor authored by the MAIN or a worker is invalid, and nobody
suggests candidate games to the owner either: the whole point is that the anchor carries the
owner's taste, not a producer's guess at it.

**Two-stage blocking (names are cheap, frames are work):**
- The NAMES (2–3 reference games, one owner message) block the bootstrap: `docs/anchor.md`
  missing or empty → the MAIN reports the unfilled slot instead of starting work, exactly like
  a brief without its standing-rules block.
- The FRAMES block every appearance/appeal verdict: a verdict without its anchor pair is
  invalid. Content work never waits on frames.

**Contents (committed as `docs/anchor.md` + `docs/anchor/` in the program repo):**
1. 2–3 named reference games; per game one line: what this program steals from it (and
   optionally what it explicitly does not).
2. Reference frames per game: 3–6 GAMEPLAY situations (never menus or title screens), each
   downscaled before commit (≤{MAX_MEDIA_KB} KB, same cap as the media-read rule), filename
   naming the situation (`revolt-mid-drift.jpg`).
3. The situation list doubles as the capture list for product frames: every comparative verdict
   pairs an anchor frame with a product frame of the SAME situation.

**Verdict form (comparative, forced choice — never absolute):**
- The blind critic sees (anchor frame, product frame) pairs per situation and answers two
  questions per pair: which frame invites play, and which two concrete visible elements decide
  it. An adjective without a named element is not evidence — same discipline as `unknown`
  labeling.
- The fail condition is per-program (contract half), but must have the comparative shape, e.g.
  "the gate fails while the critic picks the anchor on a majority of pairs and can name no
  product element that would flip the choice".

**Mechanical checks:** bootstrap check on `docs/anchor.md` (≥2 named games) · paired-frame check
before any appearance verdict · provenance line in the file ("authored by: owner"), verified in
setup-health.
