---
frage: Kann irgendein Principal außer der exakt gebundenen MAIN eines Programms mit Owner-promoteter Policy einen Land auslösen, nicht-grünen/unknownen/stalen Baum landen, außerhalb guarded bestätigen, doppelt landen oder unattribuiert landen?
urteil: Kein Pfad gefunden, über den ein nicht gebundener, stale, Lane-, Steward-, Worker- oder Self-Token-Principal einen Land auslöst oder unattribuiert landet; die zwei dokumentierten Design-Grenzen (textueller Call-Site-Pin, via-Spoofbarkeit des Suspect-Flags) gewähren keine Autorität
bereich: [autoritaet, verify]
belege: [docs/authority-slice-brief-2026-08-23.md, server.ts#selfLandTaskForMain, e2e/pins.ts, e2e/programs.ts, fleet/260824000948-c4a7]
nicht-gemessen: <nicht ausgewiesen>
stand: 2026-08-24
---

# Authority-Critic — Branch `fleet/260824000948-c4a7` (10 commits, 6f75a8c → 210fcd9)

Read-only security/authority review of the AUTHORITY slice (task 2574cb20). Spec:
`docs/authority-slice-brief-2026-08-23.md` §1–§3. ONE QUESTION: can any principal other than the
exact live bound MAIN of a Program with an owner-confirmed policy cause a land, land a
non-green/unknown/skipped or stale tree, confirm an unreviewed resolution outside `guarded`, land
the same candidate twice, or produce a land whose ledger does not name its actor?

Method: `git diff main...fleet/260824000948-c4a7`, branch file reads (`git show …:server.ts`),
commit bodies. Line numbers are BRANCH lines. No checkout; no fixes.

## The 14 items

**1. Body/query trust on the self route — holds.**
The route handler matches pathname only and reads no body and no query parameter
(server.ts:18606–18615); `selfLandTaskForMain` takes `(s, id)` with `id` from the URL regex
`[a-z0-9]+`. Program comes from the binding (:6517), lane from the task row (:6545), repo from
`repoKeyOf(s)` on the caller's own checkout (:6551), candidate from lane HEAD via
`git rev-parse HEAD` (:6574–6577). Verify cmd comes from `FLEET_VERIFY_CMD_REPOS`
(:10484), never from a request. Slot/repo/branch/candidate/program/verify-cmd: no field is
caller-nominatable anywhere on this path. Verified absent.

**2. Exact MAIN identity — holds.**
`boundProgramForMain` (server.ts:6334–6348) requires `p.status === "active"`, `p.main.slot === s.id`
and `p.main.openedAt === s.openedAt`; >1 match is refused as ambiguous (:6337). The land door then
GATES sessionId exactly: `if (program.main!.sessionId !== s.sessionId) return 409` (:6527–6528).
null===null passes because it is the recorded triple itself being compared, not
`sessionIdMatch === "exact"` — correct per design comment (:6520–6525).
Stale/retired/reused slot: `openedAt` is stamped at every session open (server.ts:4946) and zeroed
at kill (:5029), so any successor occupant of the same slot fails the openedAt half; a dead MAIN's
slot has `openedAt 0`, which can never equal a positive bound `openedAt`. A non-active program is
refused at :6335. Impersonation by "another null-sessionId occupant" would require occupying the
same tmux pane within the same openedAt instant — i.e. BEING the bound occupant; identity on such
fleets honestly reduces to pane occupancy, which the code says rather than hides. Holds.

**3. Task ownership — holds.**
Foreign programId: `t.programId !== program.id` → 409 (server.ts:6534–6535); null programId is a
string-vs-undefined mismatch caught by the same line. Non-auftrag kind → 409 (:6539–6540).
status `done` → "already landed" (:6541–6542); status ≠ `sent` → 409 (:6543–6544). Dead/reused
lane slot: `lane.taskId !== t.id` plus cwd/worktree presence required (:6545–6547) — a recycled
slot runs another row's id and refuses. Runtime probes: e2e/programs.ts:2303–2355 (lane/steward
409s, unknown/foreign/advisory/not-running each its own sentence).

**4. Repo binding — holds.**
`repoCanon` realpath-syncs both spellings once and caches (server.ts:2872–2879); `repoKeyOf`
routes lanes through their stored symlink-resolved toplevel and plain checkouts through
`rev-parse --show-toplevel`, both canonicalized (:10281–10287) — the same helper the dispatch cap
uses. The land refuses unless `repoCanon(lane.worktree.repo) !== mainRepo` is false (:6554–6555);
failure to derive the repo fails as itself instead of reading as "matches" (:6552–6553). A MAIN
bound in repo A cannot reach a lane in repo B.

**5. Policy — holds.**
Every write to `program.promotion` is inside the owner promotion route between the two matcher
constants: grant at server.ts:15482, revoke (`delete`) at :15467; grep over the branch file finds
no third write. Self token on that route = 401 before anything is written (route behind
`tokenGate`, :18789–18792; runtime probe e2e/programs.ts:2141–2147). Loader direction probed in
the dangerous sense: `loadPromotion` (server.ts:2235–2241) returns undefined for unknown key,
v≠1, value outside the closed set, missing/absurd stamp — and e2e/programs.ts:2150–2168 plants a
v2 record next to a well-formed `guarded` control in ONE boot, proving absence AND survival;
four further malformed shapes, one per rejection branch (:2170–2205). Revocation is idempotent
and audited only where something was taken back (server.ts:15466–15470). Legacy byte-for-byte:
the cookie counter-probe doubles as the legacy probe after revocation — owner-shaped note/outcome,
no flag, own self-door refuses with the absent sentence (e2e/programs.ts:2743–2790). Real.

**6. Verify — holds.**
Missing `FLEET_VERIFY_CMD_REPOS` entry refuses BEFORE mergeStart/candidate/mergeJob
(server.ts:6569–6570, ahead of :6636). Guarded arm: `if (!fresh || fresh.ok !== true)` returns a
non-land BEFORE markLandIntent (:13560–13564 region — `confirmResolvedCandidate`, fresh run gated
on `!opts.byHuman`, refusal via `freshConfirmRefusal` covering undefined/red/skip/timeout/
never-started, :13454–13462); runVerify runs through `reportServerRun` so the suite mutex sees it.
Lands only ok:true, `confirmedByHuman: opts.byHuman` = false on the MAIN arm (:13497,
:13530–13532). Ordinary path unchanged: mergeJob's clean auto-land stops on verify.ok===false AND
ok===null (skip/timeout/never-started), landing only green or unconfigured (:13975–14020) —
pre-existing main behavior, not touched by this slice. Pins hold the structural halves
(e2e/pins.ts:2940–2947).

**7. Progress guard — holds, both directions.**
Unchanged retry refused: `unchangedRetry` requires pending non-land verdict bound to the SAME
candidate with nothing new (server.ts:6613–6617), message "no progress since the last verdict —
repair or escalate" (:6618–6621); runtime probe e2e/programs.ts:2509–2512. New candidate allowed:
candidateSha inequality breaks the guard; probe shows a repaired candidate admitted and landing on
the very next call (e2e/programs.ts:2529–2535). The 2f533d6 fix: under green-only, a verdict
HOLDING an unreviewed resolution is excluded from unchangedRetry
(`!(holdsResolution && !guardedRung)`, server.ts:6614) and falls through to the shared carry
helper's ⏸ hold, whose refusal names the rung: `a "green-only" promotion never lands an unreviewed
conflict resolution; the owner grants the "guarded" rung` (:6677–6679); probe reads the PARSED
error and asserts both phrases (e2e/programs.ts:2586–2600). Under guarded after spent confirmation
the exclusion does NOT apply, so the identical call gets no-progress (:6605–6613 + spent map
:6660); red-arm probe e2e/programs.ts:2704.

**8. Duplicate/stale/race — holds.**
Same (task, candidate) after landed → fleet/land note read refuses "already landed"
(server.ts:6584–6586), plus row-done "already landed" (:6541–6542); probe :2465–2466. Candidate
re-read from lane HEAD at EVERY invocation (:6574–6577) — no stored approved sha anywhere; the
confirm path re-checks candidate identity twice around the replay and accepts only the exact tip
(:13476+). Reservation: BOTH routes test-and-set the same `mergeInflight`/`mergeStart` maps
synchronously with no await between check and add — self :6636–6637, owner :19729–19730 — so the
two doors cannot start two jobs on one lane. Background guarded job double-land: impossible —
`selfConfirmSpent.set(t.id, candidate)` happens synchronously before the job starts (:6660), so a
second parallel call fails the `resolvedCandidate` predicate (:6606–6610) and, while the first job
still holds the un-deleted verdict, hits unchangedRetry; after a successful land the row is done
and the note exists. Memory-resident reset direction documented and safe (:6452–6455).

**9. mergeJob diff vs 6f75a8c — holds.**
Function-level diff (extracted, unified): exactly three hunks — signature gains
`actor: LandActor = { kind: "owner", via: "cookie" }`; the clean auto-land prov gains `actor`;
the same site's landLane facts gain `landedBy: actor`. REAL call sites counted textually: exactly
two — server.ts:6685 (selfLandTaskForMain) and :19877 (owner merge route); definition :13706;
zero in tick bodies (pin reads five tick bodies directly, e2e/pins.ts:2897–2898).
Pin-counting method: filters lines containing `mergeJob(` that do NOT start with `//` and are not
the definition (e2e/pins.ts:2869–2872). Every current mention outside the two calls is a
line-leading `//` comment (server.ts:597, 6494, 6682, 17298, 19875), so the count is exactly 2.
Residual: an INLINE trailing comment or block-comment line containing `mergeJob(` on a code line
would fool the count — latent weakness, currently unexploited, and the independent tick-body pin
covers the dangerous direction regardless. Not a defect on this tree.

**10. Provenance — holds.**
`LandProvenance.actor` REQUIRED (server.ts:11212–11216 area; pinned e2e/pins.ts:2911–2917),
written by writeLandNote into every note (:11218–11227); `recordLand` audits `land_actor` at the
one choke point (:11259); `LaneOutcome.landedBy` on landed dispositions (:11966+, :12264);
owner-cookie-route land (`/api/slots/:id/land`) now passes `ownerLandActor(req, s)`
(:20947-region, diff hunk at main 20268); already-merged owner arm carries it too; crash-finish:
boot loads the marker's actor JUDGED through `loadLandActor` (:16096), falling to
`{kind:"unknown", why}` — never an invented owner (:11178–11190), and `finishLandsInFlight` →
`recordLand` uses that prov (:11313). Suspect flag: bearer|query only, only when the lane's task
belongs to an ACTIVE program with a LIVE bound MAIN (:11161–11171), recorded + audited
(:19731–19738), never blocking (land proceeds; probes e2e/programs.ts:2726–2741 flagged bearer
landing, :2743–2762 cookie NOT flagged). Spoofability: `via` is channel-derived and trivially
chosen by the caller (send a cookie header, avoid the flag) — inherent, honestly classified
UNSUPPORTED in type comment (:11137–11144) and docs; prevention was excluded by the owner. Within
spec.

**11. T0 — holds.**
Repo-cap `return` → `continue` (server.ts:8117), note stays on the blocked row via `waiting()`.
Serial start untouched: `return; // serial by design — one lane per tick` right after dispatchTask
(:8219). Master-stop/quiet-hours via `canDeliver` before spawn (:8215), per-program cap
(:8119–8124), analysis collision gate `continue` (:8212) all bind. Probe: two-repo regression with
four self-failing preconditions and realpathSync on BOTH sides (e2e/tasks.ts:1052–1092);
structural pin incl. the `no free slot` counter-probe (e2e/pins.ts:1369+).

**12. nextAction (a5967b4) — holds.**
`nextActionFor` (server.ts:2383–2398) is a pure function of phase + row status + promotion record,
called once per request in programExecutionView (:2479); nothing stores it — it sits in the
restart-reconstruction strip list beside phase/note/candidate (e2e/programs.ts:1233), proving it
is live-derived. It names routes, never acts. phaseOf consumers still exactly two view functions,
pinned structurally AND globally (`callsIn(server) === 2`, e2e/pins.ts:2803–2811); nextAction
takes `phase` as an argument and adds no consumer. Grading-word ban pinned over the comment-stripped
body (e2e/pins.ts:2845–2849).

**13. Pre-auth surface — holds.**
Exactly two allowlist changes in e2e/security.ts: the self-land route with a full
constraint inventory as justification (security.ts:139–158) and `promotion` joined to the owner
regex with the why-it-is-on-the-owner-side justification (:180–186). No other pre-auth widening in
the diff. Token comparison: self route uses `secretEq` (timingSafeEqual-based, server.ts:14094)
with a 400ms sleep on failure (:18609); promotion route sits behind `tokenGate` → `tokenOk` →
`secretEq` (:14101–14108), same as siblings.

**14. Pins — holds.**
Third `mergeJob(` call site anywhere (incl. a tick): "exactly two call sites" goes red AND the
independent "no tick calls mergeJob at all" body-read pin goes red (e2e/pins.ts:2874–2898) — two
named pins. Actor-less note: making `actor` optional or dropping it from writeLandNote reds
"`LandProvenance.actor` is REQUIRED and writeLandNote puts it in every note" (:2905–2917).
Second promotion writer (assignment OR delete, anywhere outside the route span): reds
"`program.promotion` is written by exactly one route" (:2083–2088). Each fails exactly its named
pin with a detail line naming what moved.

## Verdict on the ONE QUESTION

No path found by which a non-bound, stale, lane, steward, worker, or self-token principal causes a
land, lands a non-green/unknown/stale tree, confirms outside `guarded`, double-lands, or lands
unattributed. The two residual observations — (a) the textual call-site pin can in principle be
fooled by inline comment text (item 9), and (b) `via` spoofability means the suspect flag is
advisory by construction (item 10) — are both documented-in-tree design boundaries, neither
grants authority, neither needs a repair beyond a one-line filter tightening if the pin is ever
revisited.

AUTHORITY VERDICT: clean
