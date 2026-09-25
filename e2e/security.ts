// The security perimeter, asserted as a perimeter rather than route by route.
//
// The individual guards are already covered where they were built (auth.ts: token/host/origin;
// share.ts: the guest cookie; self-token.ts: the scoped credential; steward-core.ts: the steward
// principal's 403s). What NOTHING covered is the perimeter's two structural properties:
//
//   1. WHICH routes are reachable before the owner gate. `server.ts`'s fetch() is an ordered
//      chain, and the last line of it is `tokenGate` — so everything ABOVE that line is the
//      entire pre-auth attack surface, and everything below is default-deny by construction.
//      A new route added above the line is unauthenticated by accident, and no runtime check can
//      see that: it looks like a working feature. So the pin here is SOURCE-level — the set of
//      pathname matches above the gate must equal a reviewed allowlist, and every syntactic form
//      that reaches a route must be one the extractor recognizes (else a new form escapes it).
//   2. That the four non-owner principals are denied on the DANGEROUS surface as a matrix, not
//      at the four sample points the individual modules happened to test. A denial is a status
//      in {401, 403}: a 400 would mean the request reached body validation, i.e. past auth.
//
// Plus the invariants whose only statement today is a code comment: credentials are revoked when
// a slot dies or is recycled (`server.ts` ~1147), and no secret reaches the audit log or any
// non-owner-readable payload.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, H, REPO, ROOT, TOKEN, check, get, post, readText, tmuxOut } from "./harness";
import type { Ctx, StewardCtx } from "./ctx";

interface FleetState {
  token?: string;
  stewardToken?: string;
  slots?: Record<string, { cwd?: string; selfToken?: string }>;
  shares?: { id: string; secret: string }[];
}
const readState = (): FleetState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as FleetState;
// `openSlot` mints the credential and queues `saveState()` BEFORE it awaits the pane spawn
// (server.ts ~1147/1177), and saveState is fire-and-forget through its serializing chain — so the
// route can answer a hair before the file on disk carries the new token. Poll for the shape we
// expect instead of reading once: a timeout still returns the last value read, so a genuine
// failure (no rotation) fails its check rather than hiding behind a retry.
async function selfTokenOf(slot: number, not = ""): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    seen = readState().slots?.[String(slot)]?.selfToken ?? "";
    if (/^[0-9a-f]{32}$/.test(seen) && seen !== not) return seen;
    await Bun.sleep(50);
  }
  return seen;
}

// --- §1 fixtures: the reviewed pre-auth allowlist -------------------------------------------
// Every entry is a route reachable WITHOUT the owner token. Adding one is a security decision;
// this list is where that decision is recorded. `=` is an exact pathname, `~` a regex.
const PRE_AUTH_ROUTES = [
  '= /',                  // login (?token=, tokenGate'd) AND the share-host landing page
  '= /api/dispositions',  // pre-check only: 403s a self token, then falls through to the owner gate
  // Owner-only despite sitting before the shared gate: the handler performs its own owner check so
  // valid scoped credentials can get an existence-hiding 404. No credential and unknown tokens 401.
  '= /api/machine-settings',
  // The self family's principal is per-SLOT, not per-lane. It was per-lane until 2026-08-07: the
  // credential was minted for every slot all along, but exported into a lane's pane only, and the
  // widening (server.ts, grep `selfExport`) hands it to every session with a cwd — the ⚙ steward
  // and a plain session in a foreign repo included. Recorded here because this list is where a
  // pre-auth decision is recorded, and this one moved the PRINCIPAL rather than the route set.
  // What it grants is bounded by the routes below: schedule/subscribe/read on your OWN pane, plus
  // the explicit main-session handoff that opens one successor and retires only the caller. The
  // lane-only questions keep their non-lane 409s, and §2 below re-runs the whole dangerous owner
  // surface against a plain session's token.
  '= /api/self',          // same credential, read-only: the session's own row (slot-bound, no lane needed)
  '= /api/self/autos',    // the scoped per-slot credential — no lane check, and never had one
  // A Program is a planning bracket above lanes, so this self route runs in the opposite scope:
  // a non-lane session may propose and read only rows carrying its exact session triple. It never
  // confirms, activates, completes, dispatches, or writes a task; those remain owner acts.
  '= /api/self/programs',
  '= /api/self/program-execution', // read-only and slot-bound; non-lanes only, with no mutation or foreign-slot reach
  // The project memory door (2026-09-23, tasks 42da6bdc/72dc4f35). Read-only and slot-bound; open to
  // BOTH principals, because the scope is derived from the credential rather than from the route: a
  // lane reads its own task, the bound MAIN of an active Program reads that Program, everyone else
  // is refused 409 `no-scope`. Query parameters only narrow; a foreign task/program is a named 409.
  '= /api/self/memory',
  // Program-scoped context pointers (2026-09-15, Task b28b9d89). Writes ONE field of ONE Program: the
  // Program the caller is bound MAIN of (boundProgramForMain), never one a body names; a lane 409s.
  // It stores tracked path/anchor pointers only, validated against the caller's own integration HEAD,
  // and starts, dispatches and writes into no pane.
  '= /api/self/program-context-packs',
  // The Supervisor's two Cut-2 channels, on this list for the same reason as their neighbours (the
  // self principal IS the boundary) and narrower than any of them: both answer 409 to every session
  // but the one the OWNER bound as Supervisor. The view is read-only and mutates nothing (pinned as
  // a source rule). The nudge writes into a pane, and that is bounded structurally: the receiver is
  // DERIVED from the named program's bound Program-MAIN and no body field can nominate a slot
  // (pinned), it refuses a program that is not active, a stale/absent binding, an owner debt on the
  // receiver, and a pane with no agent behind it.
  '= /api/self/supervisor-view',
  '= /api/self/nudge',
  // STN-1, the Supervisor's second voice and the one that PERSISTS: it completes exactly one
  // transition watch a non-lane Controller registered, minting one FleetEvent onto the existing
  // transport. Same 401 rail and same occupancy 409 as its two neighbours. What bounds it: the
  // watch id comes from the path and the receiver from that watch's registrant occupant
  // (re-resolved at completion, never from the body — `text` is the only field read, pinned in
  // e2e/security.ts §STN-1), once-only through spendWatch, expiry refused, and a lane can never
  // be the receiver because a lane can never register (the /api/self/watch lane rule, unchanged).
  String.raw`~ /^\/api\/self\/supervisor-watch\/([a-z0-9]+)\/complete$/`,
  '= /api/self/main-direct', // scoped non-lane provenance view; both git heads are server-read
  '= /api/self/main-direct/preflight',
  '= /api/self/main-direct/finalize',
  '= /api/self/main-direct/abandon',
  // added 2026-08-07, and it is the only entry on this list that WRITES INTO A PANE on a trigger
  // the caller does not control. What bounds it: the receiver is the token's slot and nothing in
  // the body can move it (createWatchForSlot takes `s`, never a body field), the message is one
  // server-authored line, it fires at most once per subscription, and WATCH_MAX_PER_SLOT caps how
  // many can be armed. Its subscriber rule runs the OTHER way to the original lane-only routes below:
  // a lane is refused 409 here. The opposite-scope 409s are pinned in self-token.ts/watch.ts.
  '= /api/self/watch',    // same credential: subscribe your OWN pane to a lane's done-looking
  // The three Clarification operations share two pathname shapes: GET+POST on the collection,
  // then one dynamic reply route. All remain pre-owner-gate because their exact self principal is
  // the security boundary; POST collection is lane-only, reply is non-lane-only, GET is dual-scoped.
  '= /api/self/clarifications',
  String.raw`~ /^\/api\/self\/clarifications\/([0-9a-f]{24})\/reply$/`,
  // The result sibling has the same collection split: POST is lane-only (a recognized non-lane,
  // including the steward, gets 409, never 401), while GET is dual-scoped to the caller's exact
  // worker or receiver occupant. Its receiver is derived only through clarificationReceiverFor
  // and no body field can nominate one; the body is the closed three-value status plus length-capped
  // text. The row is report-only: no land, dispatch, auto, Watch or tick gates on its status.
  '= /api/self/fleet-report',
  // The harness-block door (2026-09-13): a lane's own Claude Code hook reporting a dialog it denied or
  // is stuck on. POST only, lane-only (a recognized non-lane gets 409), closed three-field body; the
  // receiver is derived from the lane's live Program-MAIN binding or is the owner inbox, never named
  // by the body. It mints a notification row and grants nothing: no land, dispatch, auto or Watch.
  '= /api/self/harness-block',
  // The PROGRAM INBOX, the durable pull half of the same back-channel, and the narrowest entry on
  // this list: both verbs are PROGRAM-BOUND on top of the non-lane rule — the caller must be the
  // current bound MAIN of an ACTIVE Program (boundProgramForMain, slot AND openedAt), so a lane, a
  // recycled occupant and an unbound session all get 409 and reach no record at all. Neither verb
  // reads a body: the program comes from the binding and the entry id from the path, so nothing a
  // caller can write nominates a Program or an entry outside its own authority. GET is read-only.
  // The write is one RECEIPT on one entry of the caller's own Program — it stamps who read it,
  // never overwrites an existing receipt, mints nothing, sends into no pane and moves no status.
  '= /api/self/inbox',
  String.raw`~ /^\/api\/self\/inbox\/([0-9a-f]{24})\/read$/`,
  // ACP-18 · THE ADDRESSED MESSAGE RAIL, and it is broader than the inbox above in exactly one
  // respect that had to be reviewed rather than assumed: its caller need not be the MAIN of a
  // Program at all — the bound Supervisor is a principal here too. That is the POINT of the cut (a
  // role outlives the occupant holding it), so what bounds it is stated rather than inherited:
  //   · NON-LANE only, and the sender is DERIVED from the caller's own binding — a Program-MAIN
  //     sends as its Program, the bound Supervisor as `role:supervisor`. The body is closed to
  //     {to, payload, idempotencyKey, replyTo}; a `from` key is a named 400, so no request can
  //     claim an address. A session holding BOTH bindings is refused as ambiguous rather than
  //     silently attributed.
  //   · It reaches NO pane and NO tick: there is no sendText, no FleetEvent, no Watch, no auto.
  //     The rail is PULL-only, so the worst a caller can do to another principal is put bounded
  //     text (2000 chars, the nudge's own cap) into a capped record it must come and read.
  //   · It confers NOTHING: no owner, release, land or deploy authority travels with a message,
  //     and no route anywhere reads one as an instruction.
  //   · Reads and receipts are ADDRESS-scoped: a caller sees only rows addressed to or from an
  //     address it currently holds, so a recycled occupant reaches no record at all. The receipt
  //     is the addressee's and never overwrites an existing one.
  '= /api/self/messages',
  String.raw`~ /^\/api\/self\/messages\/([0-9a-f]{24})\/read$/`,
  // …and the door that JUDGES one of those rows, deliberately its own route rather than a fold
  // into the event-ack regex: that one is a TRANSPORT receipt for every event kind, this one
  // records what the receiving MAIN did with the work. Who may call it: the exact self principal
  // of the report's RECEIVER occupant — NON-lane only (a lane files its own result, it does not
  // accept the results its own MAIN is owed; 409, never 401), and the receiver triple is compared
  // inside the handler the way replyClarification compares a clarification's, so a replaced MAIN
  // session at the same slot is refused. An owner-inbox row (receiver null) is refused outright:
  // no session is invented for the owner. Which report and which verdict BOTH come from the PATH;
  // the body may carry `reason` and nothing else (any other key is a 400, never dropped), capped
  // at MAX_FLEET_REPORT_DECISION_REASON. First decision wins — a second call, even an identical
  // one, is a 409 that leaves the row untouched. What it does NOT do: no pane is written, no
  // foreign slot is reachable, no task status, land, dispatch or tick moves. Its one side effect
  // beyond the row is the transport half — settleFleetEventAcknowledged on the report's own event,
  // through the ack route's single writer, and an already-terminal event is left exactly as it is.
  String.raw`~ /^\/api\/self\/fleet-report\/([0-9a-f]{24})\/(accept|reject)$/`,
  // THE REPORT DELEGATE's pair (2026-09-24, server.ts#delegateDecideFleetReport): non-lane-only, and
  // then refused (409 not-delegate) unless the owner named THIS exact occupant and line through the
  // owner-gated PATCH /api/slots/:id/report-delegate — no label, model or role grants it. It reaches
  // only rows no living receiver can judge (reportAwaitsOwner; a live receiver is 409), writes the
  // same verdict row, ledger line, event settle and lane carry as the two doors above, or on
  // `escalate` only an escalation record; GET lists those rows. No foreign slot is reached, no task
  // status, land, dispatch or tick moves.
  String.raw`~ /^\/api\/self\/fleet-report\/([0-9a-f]{24})\/delegate\/(accept|reject|escalate)$/`,
  '= /api/self/fleet-report/delegated',
  // The owner-facing twin of the fleet-report pair above, and it is the QUIETEST entry on this list: it writes
  // nothing into any pane and reaches no foreign slot. POST is non-lane-only AND requires the
  // caller to be the current bound MAIN of an active program (programId is derived from that
  // binding, never read from the body); GET returns only rows carrying the caller's exact occupant
  // triple. The answer side — the half that does type into a pane — is owner-gated and lives on
  // /api/attention, deliberately not here.
  '= /api/self/attention',
  // Its withdrawal twin (2026-09-18): non-lane-only like the raise door above, and it closes ONE
  // row — the id comes from the path, the row must carry the CALLER'S OWN occupant triple
  // (attentionBound, compared inside the handler), it must still be open, and the required
  // `reason` travels onto the row as `refusedReason` prose. No new state value, no pane write, no
  // foreign slot, no status change: the row ends `refused`, which the owner's list already renders.
  String.raw`~ /^\/api\/self\/attention\/([0-9a-f]{24})\/withdraw$/`,
  // ACP-16, and it is the entry on this list that comes closest to the queue: a bound Program-MAIN
  // releases a PENDING row of its own Program, `pending → queued` and nothing else. It is on the
  // pre-auth surface for the same reason as its neighbours — the exact self principal IS the
  // boundary — and what bounds it is that RELEASING IS NOT STARTING: the route never dispatches, so
  // every gate on unattended execution stays with the tick (master stop, quiet hours,
  // DISPATCH_MAX_LANES, DISPATCH_MAX_LANES_PER_PROGRAM, the harness-automation bolt).
  // Non-lane only. The program is derived from the caller's MAIN binding and the target repo from
  // the caller's own checkout — the handler reads no request body at all (pinned in e2e/pins.ts) —
  // the row must be an `auftrag`, and PROGRAM_MAX_RELEASED caps how many rows one Program may hold
  // released-but-not-started. It writes into no pane and reaches no foreign slot.
  // ACP-23, the FILING half of the pair below it, and it is the newer of the two doors a bound
  // Program-MAIN has onto the queue. On this list for the same reason as every neighbour — the
  // exact self principal IS the boundary — and what bounds it is that FILING IS NOT RELEASING: the
  // row arrives `pending`, which the handler writes as a literal, so it is not even a candidate for
  // the tick until the separate release act moves it. Non-lane only. The program is derived from
  // the caller's MAIN binding and the target repo from the caller's own checkout; the body may
  // carry `text` and `kind` and NOTHING else (a closed set — `programId`, `repo`, `status`,
  // `queue`, `releasedBy` are refused 400, never dropped), `kind` runs through the same four-value
  // validator as the owner and steward create routes and defaults to the advisory `notiz`.
  // PROGRAM_MAX_PENDING caps pending `auftrag` rows; PROGRAM_MAX_PENDING_ADVISORY separately caps
  // pending notiz/richtung/betrieb rows awaiting owner disposition, so neither kind can close the
  // other's filing door. It writes into no pane, starts nothing and reaches no foreign slot.
  '= /api/self/tasks',
  // REVIEW PARK (2026-09-25, server.ts#reviewParkTaskForMain): the exact bound Program-MAIN may
  // retire one live lane of its own Program into a review candidate. The task comes from the path,
  // note/hours are the closed body, and mintReviewCandidate keeps the owner's admission rules.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/park$/`,
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/release$/`,
  // Schnitt 3 (2026-09-14) · THE HOLD, the counter-act to a program's release policy. REVIEWED: same
  // principal and same derivation as the release door beside it — non-lane only (409), the program
  // from the exact MAIN binding, the repo from the caller's checkout, and of the body ONE field, the
  // MAIN's `grund` (a closed body, any other key 400 — pinned in e2e/pins.ts). It only ever STOPS a
  // start (a flag on a pending/queued row of its own program); it starts nothing, writes into no pane
  // and reaches no foreign slot.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/hold$/`,
  // S5, 2026-09-13 · THE CARD-SURFACE CONFIRMATION — a bound Program-MAIN (or the bound ⚙ steward)
  // turns the file surface its OWN rows' VALID cards already name into `filesOrigin:"confirmed"`,
  // in one call. REVIEWED, and what bounds it: non-lane only (409); the program comes from the exact
  // MAIN binding and the target repo from the caller's own checkout, and a single id of another
  // program or repository refuses the WHOLE batch before any row is touched; the body carries `ids`
  // and nothing else (a closed set); the paths are the card's — already validated against the tree,
  // re-checked at the call — never the prose derivation, so nothing is lifted by machine (no
  // auto-lift, docs/queue-wellen-2026-09-06.md §7.1.3); a row the owner already confirmed is skipped,
  // never overwritten. It starts nothing, moves no status, writes into no pane and reaches no
  // foreign slot: the one thing it changes is which rows the wave sensor may bundle, which the
  // owner sees on the board and the owner's own POST /api/tasks/:id/files can overwrite.
  '= /api/self/tasks/confirm-cards',
  // W2 · the PROPOSE half of the file-surface pair, added 2026-09-07. REVIEWED, and the review is
  // the entry: it is the one self route in this family that answers a LANE, and it is deliberate.
  // What bounds it is that it writes NOTHING the owner has not confirmed — the row's own
  // `files`/`filesOrigin` are untouched, the proposal is parked in its own field, the caller's
  // provenance (`by`) is derived from its slot rather than read off the body, and the CONFIRM that
  // turns a proposal into a surface is an owner route BELOW the gate (POST /api/tasks/:id/files),
  // with no self mirror. It reaches no foreign slot, starts nothing, writes into no pane, and its
  // path-validation finding REPORTS rather than gates — a proposal is at worst noise on a row that
  // an owner click can drop.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/files-proposal$/`,
  // N3, 2026-09-09 · THE ASSIGNMENT DOOR — a bound Program-MAIN pins a `notiz` as the SOURCE a row
  // is to be worked against. Non-lane only, like its release neighbour and for the same "one edge
  // per role" reason. What bounds it: the program comes from the caller's exact MAIN binding and
  // the target repo from the caller's own checkout, so a row of another Program or another
  // repository is refused before the body is looked at; the body carries `note` and the boolean
  // `attach` and nothing else; the pinned row must be a `notiz` of that same repo; the assignment
  // is refused outright once the row is `sent`, so it can never reach a lane that is already
  // running. It starts nothing, lands nothing, writes into no pane and moves no status — the ONE
  // thing it changes is which text a FUTURE founding brief will carry, which is a decision the
  // owner can see on the row and undo with one click.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/notes$/`,
  // ACP-25, 2026-09-11 · THE BRIEF-SHARPENING DOOR — a bound Program-MAIN rewrites the exact bytes a
  // lane of its own Program will be founded on. REVIEWED, and the review is the entry: this route
  // exists to REMOVE a falsehood rather than to widen reach. The owner door beside it
  // (POST /api/tasks/:id/brief, below the gate) hard-writes `edited:true`, which both render sites
  // turn into "edited by the owner" — so a session sharpening a queue row through the owner bearer
  // necessarily minted a false statement about a person. What bounds this one: non-lane only (409,
  // and the loudest exclusion in the family — the brief IS the work order a lane was founded on);
  // the caller must be the current bound MAIN of an ACTIVE program; the row must belong to THAT
  // program, be an `auftrag`, be `pending` or `queued`, and target the caller's own checkout; the
  // body carries `text` and NOTHING else (a closed set — `by`, `model`, `edited` are refused 400,
  // never dropped) and the author is stamped from the caller's slot; and a brief the OWNER wrote —
  // or one pinned before authorship was recorded, which cannot be told apart from theirs — is
  // refused outright. It starts nothing, lands nothing, moves no status, writes into no pane and
  // reaches no foreign slot: the ONE thing it changes is which bytes a FUTURE lane receives, which
  // the owner sees on the row and can overwrite with one click.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/brief$/`,
  // E4 · THE VARIANT DECISION (server.ts#decideVariantForMain → #decideVariantGroup): which ONE
  // variant of a group lands. Pre-auth for its neighbours' reason — the exact self principal IS the
  // boundary. What bounds it: non-lane only (409 — a lane is one of the variants and does not judge
  // itself); the caller must be the current bound MAIN of an ACTIVE program and the group must belong
  // to THAT program; the body carries `winner` alone, which must name a variant row of the group
  // whose lane is running; a decision is written once and never rewritten (409). It lands nothing and
  // starts nothing: it archives the other variants and shelves their lanes the way the owner's
  // shelve door does — worktree and branch kept — and it makes only the winner landable through the
  // land door below, which keeps every one of its own bounds.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/variant-winner$/`,
  // ACP · THE LAND DOOR, and it is by a distance the most consequential entry on this list: it is
  // the only pre-auth route that can move an INTEGRATION BRANCH. It is here for the same structural
  // reason as its neighbours — the exact self principal IS the boundary — but what bounds it is a
  // longer list than theirs, and every item is a refusal BEFORE anything starts:
  //   · non-lane only AND steward-excluded (both 409, never 401);
  //   · the caller must be the current bound MAIN of an ACTIVE program, matched on the full
  //     identity triple slot+openedAt+sessionId — the one route that GATES sessionId rather than
  //     merely reporting it, because landing is the act where an unconfirmed occupant is not a
  //     smaller problem;
  //   · the row must belong to THAT program, be an `auftrag`, be `sent`, and name a LIVE lane slot
  //     whose repo canonicalises to the caller's own checkout (no land crosses repositories);
  //   · the Program must carry an OWNER-CONFIRMED `promotion` record whose selfLand is not `off` —
  //     absent is the default and refuses, and only the owner route below can write it;
  //   · the repo must have its OWN FLEET_VERIFY_CMD_REPOS entry, so a promotion over a repo that
  //     can structurally only answer `unknown` (exit 42) is refused rather than waved through;
  //   · the candidate must be readable and must not already carry a fleet/land note, a literally
  //     unchanged retry is refused as no-progress, the lane must be done-looking, and no merge or
  //     commit may be in flight (the SAME reservation pair the owner route holds).
  // It reads NO body (the program comes from the binding, the lane from the row, the repo from the
  // checkout, the candidate from the lane's HEAD), it starts nothing unattended, it writes into no
  // pane and it reaches no foreign slot. The land itself runs through the SAME mergeJob the owner
  // route calls — there is no second merge implementation.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/land$/`,
  '~ /^\\/api\\/self\\/events\\/([a-z0-9]+)\\/ack$/', // same slot+session credential; idempotent receipt only
  '~ /^\\/api\\/self\\/events\\/([a-z0-9]+)$/', // same credential, READ only: the receiver's own event + its rendered text (c14fcd75); another occupant 409
  '= /api/self/succeed',  // one successor for the caller's own session, never a named target. For a
  // MAIN: a free slot in the same cwd, caller retires on grace; the committed HANDOFF gate still
  // holds the unbound, Supervisor and game-maker rails, while a Standard Program-MAIN hands over the
  // Program's own measured record in the founding brief instead (2026-09-08). For a LANE (2026-09-12,
  // succeedLane): a fresh session in the SAME slot on the SAME worktree and branch, which is why it
  // is no longer a 409 here — what bounds it is that it moves NOTHING: no land, no merge (a running
  // one refuses it), no second worktree, no queue-row status change, no repo it is not already in,
  // and a tree with one uncommitted or untracked line refuses it outright. The steward stays 409 on
  // both doors and a lane stays 409 on /retire.
  '= /api/self/retire',   // non-lane only: immediately retire the token's own slot after reporting
  // added 2026-08-07. The widest READ on the every-session tier —
  // it is the only self route whose payload is not this slot's own row but a fleet-wide ledger
  // (the per-check e2e trail). What bounds it: read-only, aggregate (check names, tree shas, run
  // ids — never a check's `detail` and never prose), and it discloses nothing a session could not
  // already read off disk, since `e2e-trail/` sits in the main checkout's common dir that every
  // lane worktree shares. It answers a LANE deliberately — the proof order it replaces is an
  // obligation on lanes — so unlike its neighbours it has no 409 in either direction.
  '= /api/self/flakes',   // same credential, read-only: the flake query over the e2e trail
  '= /api/self/drift',    // same credential, read-only: the lane's own drift view (slot-bound)
  '= /api/self/gate',     // same credential, read-only: the live land-gate facts (env-derived)
  '= /api/self/criterion', // same credential: the lane's PROPOSED done-criterion (slot-bound, owner confirms)
  '= /api/self/verify-intent', // same credential: the lane's advisory gate-phase report (slot-bound)
  // The fifth lane-only pair, added 2026-08-26 with LANE SUITES IN THE REMOTE HELPER PORTAL. On
  // this list for the same structural reason as every neighbour — the exact self principal IS the
  // boundary — and what bounds it is that OFFERING IS NOT RUNNING: no suite is spawned, no queue is
  // filled, the land gate is untouched, and a remote verdict gates nothing (tier 2 gates nothing).
  // Lane-only in the drift/gate/criterion direction: the answer is about the caller's OWN working
  // tree. It reads NO body on the offer door (the repo, branch, cwd and slot all come from the
  // token's own row, so nothing can nominate WHICH tree is bundled), the withdraw door reads the
  // single boolean `abandon`, one open offer per slot, it writes into no pane and reaches no
  // foreign slot. What it exposes to the helper principal is one git bundle of the caller's own
  // worktree — through the EXISTING /api/helper/bundle route, which is why the helper perimeter
  // below is unchanged by this feature.
  '= /api/self/suite-offer',
  '= /api/self/suite-offer/withdraw',
  // W3, 2026-09-07 · THE SELF-SPLIT of a land wave. Lane-only, in the drift/gate/criterion
  // direction and for the same reason: the answer is about rows the CALLER'S OWN lane is holding.
  // What bounds it, and why it is on this list rather than behind the owner token: the door
  // reaches NO row outside the caller's own wave (membership is `t.slot === s.id`, which nothing
  // in a body can nominate), it must leave at least one row with the lane, it writes into no pane,
  // it starts nothing and it lands nothing. Its ONE effect is `sent → queued` on rows the caller
  // already holds — a state the caller could reach anyway by abandoning the lane, only with the
  // reason recorded instead of lost. The opposite scope from its files-proposal neighbour is
  // deliberate: proposing a surface costs a row nothing, writing a queue status is the act that
  // has to be bound to the party actually doing the work.
  '= /api/self/wave/split',
  // N2, 2026-09-08 · THE NOTE DOORS. On this list for the same structural reason as every
  // neighbour — the exact self principal IS the boundary — and what bounds it is NARROWER than
  // lane-only: the caller reaches exactly the note ids its OWN context receipt names, joined on
  // the token row's branch AND slot. Nothing in a body can nominate WHICH notes (`GET` reads no
  // body at all; the verdict door reads only `verdict` and `text`, and the branch it signs with
  // comes from the token's row), so a lane cannot reach the 127 pending rows, another lane's five,
  // or a row of another repo. The verdict door WRITES, and its write is one capped `TaskComment` on
  // a row the caller was already shown — it moves no status, starts nothing, lands nothing and
  // reaches no pane. The status change it can eventually cause belongs to the LAND path below the
  // owner gate (landLane#applyLandToNotes), which is the whole design: a lane may claim a note is
  // finished, and only work that reaches main makes the claim true.
  //
  // N3, 2026-09-09 widened the verdict door's BODY by one optional field and NARROWED what a
  // verdict can do. `taskId` names the row the source was delivered under, and it is checked
  // against the caller's OWN receipt (the pairing the receipt records) and against the rows the
  // lane still carries — so it can nominate neither a foreign row nor a row handed back by a
  // split. A source that was explicitly assigned may ONLY be judged that way: the global door is
  // refused for it, which is a narrowing, not a widening. The write is one entry keyed
  // (taskId, branch) on the row the caller was already shown, replacing its own previous one.
  '= /api/self/notes',
  String.raw`~ /^\/api\/self\/notes\/([a-z0-9]+)\/verdict$/`,
  // Dual-Host S2/R5, THE REMOTE COMMAND JOB. On this list for the same structural reason as every
  // neighbour — the exact self principal IS the boundary — and it is the first self route whose
  // body carries a COMMAND LINE, so what bounds it is spelled out rather than inherited:
  //   · `cmd` must be an EXACT key of HELPER_CMD_ALLOW (server/types.ts#helperCmdCheck), whose
  //     VALUE is the argv the helper execs — there is no shell, no quoting and no substitution
  //     anywhere on the path, and adding an entry is a source change under review;
  //   · a `cmd` naming `claude`, `codex` or `pi` as a token is refused FIRST and unconditionally,
  //     before the allowlist is consulted at all, so widening that list leaves the COMMAND STRING
  //     just as refused (pinned from the constant itself in e2e/pins.ts §S10). That is the whole
  //     of the claim: the refusal binds what may be NAMED, not what the named thing runs — three
  //     allowlist entries (`bun run build`, `bun test`, `bun run verify`) execute a `package.json`
  //     script out of the SUBMITTED bundle, which is the caller's own file (e2e/helper-daemon.ts's
  //     `cmdjob` lane writes exactly such a script and runs it through). Submitted repo code has
  //     always been what `suiteCmd` executes on the portal path; nothing here narrows or widens
  //     that, only the sentence written about it;
  //   · a refusal leaves NO ROW — the 400 and the absence of anything claimable are one fact;
  //   · the tree, repo, branch, cwd and slot all come from the token's own row: nothing in the
  //     body can nominate WHICH tree is bundled, exactly as on the suite-offer door above;
  //   · the job is OFFERED only to a helper device whose heartbeat named a `daemonSha`, and the
  //     claim refuses one that did not — an older daemon would run its own configured suite
  //     command on a command job;
  //   · `artifacts` are globs relative to the clone, and the receipt they produce is validated on
  //     arrival (relative path, no `..`, 64-hex digest, non-negative integer bytes; 50 rows max).
  //     NOTHING is uploaded in this slice — the receipt names files, it does not carry them;
  //   · caps: 3 open jobs per session, timeoutMs in [10s, 60min]. It starts nothing on this box,
  //     writes into no pane and reaches no foreign slot. The GET half answers the OFFERING session
  //     alone (404 for anyone else's token), and the bundle goes out through the EXISTING
  //     /api/helper/bundle route, so the helper perimeter is unchanged by this feature too.
  '= /api/self/jobs',
  String.raw`~ /^\/api\/self\/jobs\/([0-9a-f]{12})$/`,
  // The handler sits before the steward interceptor only so a steward credential meets the same
  // tokenGate 401 as any other non-owner credential. Every matching route calls tokenGate inline
  // before the owner handler; the regex is pinned here as an explicitly reviewed pre-auth shape.
  // `promotion` joined the verb set 2026-08-23. It is the OWNER's grant of the self-land permission
  // a bound Program-MAIN consumes, and it is on the owner side of this line precisely so that a
  // session can never widen its own authority: the record is written by this route alone (pinned in
  // e2e/pins.ts), and a self token meets the same tokenGate 401 here as any other non-owner
  // credential.
  // `studio` joined the verb set 2026-09-03 for the same reason `promotion` and `profile` did, and
  // with the same consequence: it is the OWNER's binding of a Program to a WORKFLOW record, written
  // by this route alone, and a session that could write it would be choosing the workflow it is
  // judged by. Owner side of this line, tokenGate inline, no self-token header read.
  // `dispatch` joined this alternation 2026-09-05 with the program-scoped dispatch door. REVIEWED,
  // not merely widened: the route is inside the block whose FIRST statement is the owner tokenGate,
  // exactly like its four neighbours here, so it is pre-auth in position and owner-only in effect.
  // `release` joined 2026-09-14 (Schnitt 3) with the release-policy door, for `dispatch`'s reason:
  // it widens WHICH rows start unattended, so it is the owner's alone — written by this route only
  // (pinned in e2e/pins.ts), tokenGate first, and a self token meets the same 401 here.
  // `release-valid` joined 2026-09-15 (Freigabe-Schnitt B) with the owner's collective release: it
  // moves named rows pending→queued, the owner's ▸ queue over a previewed selection, so it is owner
  // side for `release`'s reason — tokenGate first, a MAIN token 401 (e2e/programs.ts release-valid (2)).
  String.raw`~ /^\/api\/programs(?:\/[^/]+\/(?:confirm|activate|complete|discard|bootstrap-main|promotion|profile|studio|dispatch|release|release-valid))?$/`,
  // The studio inventory itself, beside the Programs regex and for its reasons: a Studio is owner
  // truth about the workflow (stages, gates, brief blocks), several Programs may bind the same one,
  // and the handler sits before the steward interceptor only so a steward credential meets the same
  // tokenGate 401 as any other non-owner credential.
  String.raw`~ /^\/api\/studios(?:\/[^/]+)?$/`,
  // Same placement and same reason as the Programs regex above, one bracket higher: the Supervisor
  // is cross-program owner identity, so the handler sits before the steward interceptor only so a
  // steward credential meets the same tokenGate 401 as any other non-owner credential. The route
  // calls tokenGate inline before it can mint anything, and it never reads a self-token header —
  // both are pinned as source rules in e2e/pins.ts.
  '= /api/supervisor/bootstrap',
  // …and the SECOND appointment door, added 2026-09-07: it binds an ALREADY RUNNING session as
  // Supervisor by explicit slot. Same placement and same reasons as its neighbour one line up, and
  // REVIEWED rather than merely widened: the block's FIRST statement is the owner tokenGate, it
  // reads no self-token header (both pinned as source rules in e2e/pins.ts), and the body is closed
  // to a single `slot` — no label match, no "first idle session", no wildcard, so nothing in the
  // request can make the route pick a session the caller did not name.
  '= /api/supervisor/bind',
  '= /favicon.ico',
  '= /intake',            // its own secret (FLEET_INTAKE_SECRET), never the owner token
  String.raw`~ /^\/(s\/[a-z0-9]+(\/(auth|info|send|diff|comments|brief|summary|transcript))?|ws-share\/[a-z0-9]+)$/`,
  String.raw`~ /^\/s\/([a-z0-9]+)\/(auth|info|send|diff|comments|brief|summary|transcript)$/`,
  String.raw`~ /^\/s\/[a-z0-9]+$/`,
  String.raw`~ /^\/ws-share\/([a-z0-9]+)$/`,
];
// `/helper.js` joined this set 2026-08-26 with the remote helper portal, on the same reasoning as
// `/share.js`: a BUNDLE carries no secret, and the page it belongs to is gated (handleHelperRoute)
// while its script is not — exactly the split share.html already has.
// `/hub` and `/hub.js` joined it 2026-09-11, and the class was READ rather than assumed: hub.html is
// a static shell (115 lines, one `<script src="/hub.js">` and no inline body, no embedded data), and
// src/hub.ts carries no secret — it fetches /api/sessions, /api/commits and /api/context-receipts
// with `credentials: "same-origin"`, so every byte it shows arrives through the `fleet_<port>`
// login cookie (server/auth.ts#cookieToken; legacy bare `fleet=` still read) over three routes that are NOT in the pre-auth set above and are
// therefore owner-gated. Serving the shell and its bundle without a token hands an anonymous caller
// an empty page: exactly the split `/` + `/app.js` already have.
const STATIC_ROUTES = ["/", "/hub", "/app.js", "/hub.js", "/share.js", "/helper.js", "/xterm.css", "/manifest.webmanifest", "/icon.svg", "/icon-180.png"];
// The steward token bypasses the owner gate entirely (server.ts ~4499), so its route set is a
// second pre-auth surface — pinned for the same reason.
const STEWARD_ROUTES = [
  // VERB 2 is the one pair here that is NOT under /api/steward/: the deploy verb and its ledger are
  // the same two functions the owner's routes call, reached by the principal that SEES the gap
  // (deployGap/bundleStale on /api/steward/sessions) and until now could only file a note about it.
  "= /api/deploy", "= /api/deploys",
  "= /api/dispositions", "= /api/steward/autos", "= /api/steward/digest", "= /api/steward/journal",
  "= /api/steward/send", "= /api/steward/sessions", "= /api/steward/tasks",
  String.raw`~ /^\/api\/steward\/slots\/(\d+)\/brief$/`,
  String.raw`~ /^\/api\/steward\/slots\/(\d+)\/transcript$/`,
];

// …and the SECOND scoped principal's, added 2026-08-26 with the remote helper portal. Same rule,
// same reason: `handleHelperRoute` sits above the owner gate, so its route set is pre-auth surface
// and a new entry here is a security decision. What the portal's token buys is bounded to exactly
// these seven: read the queue, name this device, take one job, fetch its bundle, report its
// verdict, and hand back that run's suite.log.
// `/api/helper/token` is deliberately ABSENT — reading the credential is the owner's act and lives
// below the owner gate, and the handler's own guard regex leaves it out.
//
// THE SEVENTH, added by Dual-Host R2: `/api/helper/artifact/<12hex>` is the only route on this
// perimeter that takes BYTES, and what bounds it is written out rather than inherited:
//   · it runs AFTER the verdict by the daemon's own order and writes to a SIDE rail
//     (HELPER_ARTIFACT_FILE) — it cannot reach POSTLAND_AUDIT_FILE at all, so no upload, refused
//     or accepted, can move a `result`;
//   · the target row is named by `?at=<row key>` and must EXIST and must carry `remote.jobId`
//     equal to the job in the path — a log cannot be filed onto another job's row;
//   · the caller names no path: the storage location is rebuilt on this side from the rail row,
//     under STREAM_DIR, which is gitignored as a directory so an artefact can never become the
//     untracked file that blocks a land;
//   · the body is capped twice — the content-length claim is refused before buffering (413, body
//     DRAINED, never cancelled) and the decoded size is the authoritative check;
//   · the digest is computed HERE over the bytes written, never copied off the wire.
const HELPER_ROUTES = [
  String.raw`~ /^\/(helper|api\/helper\/(jobs|device|claim|result|bundle\/[0-9a-f]{12}|artifact\/[0-9a-f]{12}))$/`,
  "= /helper", "= /api/helper/jobs", "= /api/helper/device",
  "= /api/helper/claim", "= /api/helper/result",
  String.raw`~ /^\/api\/helper\/bundle\/([0-9a-f]{12})$/`,
  String.raw`~ /^\/api\/helper\/artifact\/([0-9a-f]{12})$/`,
];

const LITERAL = /url\.pathname === "([^"]+)"/g;
const REGEXP = /(\/\^[^\n]*?\/)\.(?:exec|test)\(url\.pathname\)/g;
const routeSet = (src: string): string[] => [...new Set([
  ...[...src.matchAll(LITERAL)].map((m) => `= ${m[1]}`),
  ...[...src.matchAll(REGEXP)].map((m) => `~ ${m[1]}`),
])].sort();
// every path read the two extractors above do NOT consume. A line is judged by its RESIDUE: each
// spelling `routeSet` reads (LITERAL, REGEXP) and the two forms that deliberately narrow rather than
// route (the share-host whitelist, the STATIC map lookup) are cut out, and a `pathname` still left
// over is a form nobody reads. Keyed on the bare word, not on `url.pathname`: the older whole-line
// filter only looked at lines carrying the literal text `url.pathname` and then passed a line as
// soon as ONE recognized form was on it, so `url["pathname"]`, url[`pathname`], a named regex's
// `BACK.test(url.pathname)` and an unread second form beside a read one all routed past it.
// TOKENLESS adds the spellings that reach the path without the word at all: a computed key on
// `url` (`url[k]`), a destructure OF `url`, and `req.url` read raw instead of via `new URL(req.url)`.
// Whole-line comments are skipped — they route nothing, and one names "the pathname" in prose.
const RECOGNIZED = [LITERAL, REGEXP, /\]\.includes\(url\.pathname\)/g, /STATIC\[url\.pathname\]/g];
const TOKENLESS = /\burl\s*\[|\}\s*=\s*url\b|(?<!new URL\()\breq\.url\b/;
const unrecognized = (src: string): string[] =>
  src.split("\n").map((l) => l.trim()).filter((l) => !/^(?:\/\/|\*(?:\s|$))/.test(l)).filter((l) =>
    /pathname/i.test(RECOGNIZED.reduce((rest, re) => rest.replace(re, ""), l)) || TOKENLESS.test(l));
// THE ALIAS GAP. `routeSet` keys on the literal text `url.pathname`, so a route that reads the
// path under any other name — `const { pathname } = url`, `const p = url.pathname` — is invisible
// to it: it routes, `routeSet` never sees it, and the allowlist check passes while an
// unauthenticated route exists (`unrecognized` flags the BINDING since 2026-09-14; before, it was
// blind to both). That is the file's own
// premise (see the header: "every syntactic form that reaches a route must be one the extractor
// recognizes") turned against it, so the alias is banned outright in the pinned regions rather
// than taught to the extractor: one recognized spelling is what makes the pin legible at all.
// Two shapes — the binding itself, and a use in routing position under any other name (in case
// the binding came from elsewhere, e.g. a destructured parameter).
const PATH_ALIAS_BINDING = /(?:const|let|var)\s*(?:\{[^}]*\bpathname\b[^}]*\}\s*=|[A-Za-z_$][\w$]*\s*=\s*url\.pathname)/g;
const PATH_ALIAS_USE = /(?<!\.)\bpathname\b\s*(?:===|!==)|\.(?:exec|test)\(\s*(?!url\.pathname\s*\))[\w$.]*[Pp]ath[\w$]*\s*\)/g;
const pathAliases = (src: string): string[] => [
  ...[...src.matchAll(PATH_ALIAS_BINDING)].map((m) => m[0].trim()),
  ...[...src.matchAll(PATH_ALIAS_USE)].map((m) => m[0].trim()),
];

// --- §2 fixtures: the dangerous owner surface ------------------------------------------------
// `owner` marks the probes whose invalid-body owner call is provably side-effect-free, so the
// positive control can prove the route exists without the matrix itself changing fleet state —
// and it is the EXACT status that call answers, not a flag. The control used to exclude only
// 401/403/404, so a 500 from a broken handler read as "the owner is admitted": a crash was the
// existence proof. An exact status is a route that ran its own validation and said so; a 5xx cannot
// be written here (the type admits 200/400/409 only). Measured 2026-09-14 on a
// scratch instance with the suite's FLEET_DISPATCH_REPO set (without it, the task dispatch probe
// answers 400 "no target repo" instead of 409).
// /api/dispatch is the one exclusion: it reads `body.on` with no validation (server.ts ~5393).
interface Probe { path: string; method: "GET" | "POST"; body?: unknown; owner?: 200 | 400 | 409 }
const dangerous = (slot: number): Probe[] => [
  { path: "/send", method: "POST", body: { slot, text: "x" }, owner: 400 },
  { path: `/api/slots/${slot}/kill`, method: "POST", body: {}, owner: 200 },
  { path: `/api/slots/${slot}/open`, method: "POST", body: { model: "not a model!" }, owner: 400 },
  { path: `/api/slots/${slot}/open-worktree`, method: "POST", body: {}, owner: 400 },
  { path: `/api/slots/${slot}/share`, method: "POST", body: { password: "short" }, owner: 400 },
  { path: `/api/slots/${slot}/unshare`, method: "POST", body: {}, owner: 200 },
  { path: `/api/slots/${slot}/rename`, method: "POST", body: { label: "sec" }, owner: 400 },
  { path: `/api/slots/${slot}/mission`, method: "POST", body: { mission: "sec" }, owner: 400 },
  // the record a slot is next SPAWNED from — its value lands in a shell word on the next heal or
  // restart, so the route is dangerous in the same way `open` is. An invalid model answers the
  // owner a side-effect-free 400 (record untouched), which is what carries the positive control.
  { path: `/api/slots/${slot}/model`, method: "POST", body: { model: "not a model!" }, owner: 400 },
  { path: `/api/slots/${slot}/land`, method: "POST", body: {}, owner: 400 },
  { path: `/api/slots/${slot}/merge`, method: "POST", body: {}, owner: 400 },
  { path: `/api/slots/${slot}/shelve`, method: "POST", body: {}, owner: 400 },
  { path: `/api/slots/${slot}/autos`, method: "POST", body: {}, owner: 400 },
  { path: "/api/worktrees/remove", method: "POST", body: {}, owner: 400 },
  { path: "/api/worktrees/discard", method: "POST", body: {}, owner: 400 },
  { path: "/api/worktrees/note", method: "POST", body: {}, owner: 400 },
  { path: "/api/repos/undo-land", method: "POST", body: {}, owner: 400 },
  { path: "/api/repo-base", method: "POST", body: {}, owner: 400 },
  // the per-repo unattended lane cap: the one owner setting that WIDENS how many sessions the
  // machine starts by itself, so a scoped credential reaching it would be a queue that meters
  // itself. An empty body answers the owner a side-effect-free 400 (no entry written), which is
  // what carries the positive control.
  { path: "/api/repo-lane-cap", method: "POST", body: {}, owner: 400 },
  { path: "/api/autos/switch", method: "POST", body: {}, owner: 400 },
  { path: "/api/autos/quiet", method: "POST", body: { start: 99, end: 99 }, owner: 400 },
  { path: "/api/dispositions", method: "POST", body: {}, owner: 400 },
  // the tier-2 adjudication rail's only writer. A judgement on a red audit is EVIDENCE that someone
  // looked, and evidence any principal can forge is worse than none — an empty body answers the
  // owner a side-effect-free 400 (no verdict), so it carries the positive control too.
  { path: "/api/post-land-audits/adjudicate", method: "POST", body: {}, owner: 400 },
  { path: "/api/tasks", method: "POST", body: {}, owner: 400 },
  // GET /api/tasks serves the full prompt texts (intake mail included) that the 2 s poll no
  // longer carries — a read route, but the most content-bearing one the queue has
  { path: "/api/tasks", method: "GET", owner: 200 },
  // the repo sheet (K2): one owner reading per canonical repo over lands, audits, adjudications
  // and queue rows — per-repo ledger content no scoped credential may read. A junk canon answers
  // the owner a real 200 over empty layers, which carries the positive control.
  { path: "/api/repos/authprobe/view", method: "GET", owner: 200 },
  // Full Program bodies are owner-only. Empty POST is a side-effect-free named 400; GET proves
  // the content-bearing read exists while the principal matrix proves scoped credentials do not.
  { path: "/api/programs", method: "POST", body: {}, owner: 400 },
  { path: "/api/programs", method: "GET", owner: 200 },
  // The studio inventory is owner truth about the WORKFLOW a Program binds — stages, spawn triples,
  // gates, brief blocks — so it is owner-only for the reason the Program bodies above are: a session
  // that could write it would be choosing the workflow it is judged by. Empty POST is a
  // side-effect-free named 400 (no id), which is what lets it carry the positive control.
  { path: "/api/studios", method: "POST", body: {}, owner: 400 },
  { path: "/api/studios", method: "GET", owner: 200 },
  { path: "/api/dispatch", method: "POST", body: {} },
  // the board editor's pair (§F5). The WRITE route is the only one on this server that puts bytes
  // into a file the caller named, so an auth regression here is not a leak — it is arbitrary code
  // reaching disk. Both answer the owner a side-effect-free 400 on an empty body (no slot), which
  // is what lets them carry the positive control; the containment guards themselves (realpath
  // prefix, the .env/fleet.json refusal, the hash conflict) are proved in fleet-e2e-security.ts §10.
  { path: "/api/file/write", method: "POST", body: {}, owner: 400 },
  // the second write route: the owner's drop lands as a FILE inside a session's working directory,
  // so an auth regression here is the same class of thing. An empty JSON body names no active slot,
  // so the owner's own call is a side-effect-free 400 and carries the positive control.
  { path: `/api/slots/${slot}/upload`, method: "POST", body: {}, owner: 400 },
  { path: "/api/tree", method: "GET", owner: 400 },
  { path: "/api/sessions", method: "GET", owner: 200 },
  { path: "/api/audit", method: "GET", owner: 200 },
  { path: "/api/prompts", method: "GET", owner: 200 },
  { path: "/api/steward/token", method: "GET", owner: 200 },
  { path: "/api/lanes", method: "POST", body: {}, owner: 400 },
];
// The task-scoped + guest surface (2026-08-05): these routes sat outside the matrix and were
// protected only by §1's structural pin (tokenGate last in the chain). §2 is the mechanism that
// catches a handler regressing to its own weaker inline check — the way /api/dispositions already
// special-cases one principal inline — and it was silent on exactly the newest clarify-adjacent
// surface. `fix` is a DONE fixture task: criterion-confirm / brief / dispatch answer a
// side-effect-free 409 to the owner (proving the route exists) and must answer 401/403 to every
// other principal. The mutating task actions and the guest routes ride matrix-only (no `owner`
// control), same stance as /api/dispatch.
const taskSurface = (fix: string): Probe[] => [
  { path: `/api/tasks/${fix}/criterion-confirm`, method: "POST", body: {}, owner: 409 },
  // the brief is a PROMPT a lane will execute — an unauthenticated write here would be arbitrary
  // remote code execution through the back door, so it belongs on this matrix more than most
  { path: `/api/tasks/${fix}/brief`, method: "POST", body: { text: "probe" }, owner: 409 },
  { path: `/api/tasks/${fix}/dispatch`, method: "POST", body: {}, owner: 409 },
  // ↻ refine spawns a repo-reading agent and refine-confirm mints task rows — both answer the
  // owner a side-effect-free 409 on this DONE fixture (wrong status / no proposal), so both can
  // carry the positive control while every other principal must be denied outright
  { path: `/api/tasks/${fix}/refine`, method: "POST", body: {}, owner: 409 },
  { path: `/api/tasks/${fix}/refine-confirm`, method: "POST", body: {}, owner: 409 },
  // W2 · the CONFIRM of a row's file surface — the only writer of `filesOrigin:"confirmed"` that a
  // request can reach, and therefore the door a scoped credential must never open (its lane-facing
  // twin, /api/self/tasks/:id/files-proposal, deliberately cannot promote). On this DONE fixture
  // the owner gets a side-effect-free 409, which is what lets it carry the positive control.
  { path: `/api/tasks/${fix}/files`, method: "POST", body: {}, owner: 409 },
  { path: `/api/tasks/${fix}/adopt`, method: "POST", body: {} },
  { path: `/api/tasks/${fix}/queue`, method: "POST", body: {} },
  { path: `/api/tasks/${fix}/archive`, method: "POST", body: {} },
  { path: `/api/tasks/${fix}/delete`, method: "POST", body: {} },
  // a read, not a write, and on the matrix for what it READS: an error message quotes filesystem
  // paths and git output off the owner's own machine, so it belongs to the owner alone. GET with
  // no side effect at all, which makes it the cheapest possible positive control.
  { path: "/api/errors", method: "GET", owner: 200 },
];

const fire = (p: Probe, headers: Record<string, string>): Promise<Response> =>
  fetch(BASE + p.path, {
    method: p.method,
    headers: { "content-type": "application/json", ...headers },
    ...(p.method === "POST" ? { body: JSON.stringify(p.body ?? {}) } : {}),
  });

export async function run(ctx: Ctx, sc: StewardCtx): Promise<void> {
  // ===== §1 the pre-auth surface is a pinned allowlist, not an emergent property =====
  const src = await readText(`${ROOT}/server.ts`);
  const gate = src.indexOf("everything below carries authority");
  const preAuth = src.slice(src.indexOf("async fetch(req, server) {"), gate);
  check("§1 the owner gate is still the last line of fetch()'s chain (the whole pin rests on it)",
    gate > 0 && preAuth.length > 1000 && src.slice(gate, gate + 200).includes("tokenGate"), `gate@${gate}`);
  const stray = unrecognized(preAuth);
  check("§1 every pre-auth pathname match uses a form the extractor reads (a new form cannot slip past the pin)",
    stray.length === 0, stray.join(" | "));
  // The pin's blind spot, closed and then PROVEN blind: a destructured route is a working route
  // that neither `routeSet` nor `unrecognized` can see. The negative control is the point — if
  // this ever passes without the alias detector firing, the detector has stopped working and the
  // two checks below it would go quietly vacuous.
  const ALIAS_PROBE = 'const { pathname } = url;\n  if (pathname === "/api/back-door") return json({ ok: true });';
  check("§1 the alias detector fires on a destructured route that the route extractor is blind to",
    pathAliases(ALIAS_PROBE).length > 0 && routeSet(ALIAS_PROBE).length === 0,
    `aliases=[${pathAliases(ALIAS_PROBE).join(" | ")}] routes=[${routeSet(ALIAS_PROBE).join(" | ")}]`);
  // …and the same proof for every routing spelling `routeSet` cannot read, one check per form. Each
  // probe is a WORKING back door in that form; the check holds only if the extractor really misses it
  // (else the probe tests nothing) AND one of the two region detectors fires on it — which is what
  // turns the three region checks red on it. Measured against the detectors as they stood before
  // 2026-09-14: six of the eight slipped past all three (Astra finding 1, repro R1 for the first);
  // the renamed destructuring (alias binding regex) and the template-string comparison (old line
  // filter) were already caught and ride along so a rewrite cannot lose them.
  const BACK_DOOR = '"/api/back-door"';
  const blindForms: [string, string][] = [
    ["computed property url[\"pathname\"]", `if (url["pathname"] === ${BACK_DOOR}) return json({ ok: true });`],
    ["template-string key url[`pathname`]", `if (url[\`pathname\`] === ${BACK_DOOR}) return json({ ok: true });`],
    ["renamed destructuring { pathname: p }", `const { pathname: p } = url;\n  if (p === ${BACK_DOOR}) return json({ ok: true });`],
    ["an unread form beside a read one on the same line", `if (url.pathname === "/favicon.ico" || url["pathname"] === ${BACK_DOOR}) return json({ ok: true });`],
    ["a named regex tested against url.pathname", `const BACK = /^\\/api\\/back-door$/;\n  if (BACK.test(url.pathname)) return json({ ok: true });`],
    ["a computed key without the word (url[k])", `const k = "path" + "name";\n  if (url[k] === ${BACK_DOOR}) return json({ ok: true });`],
    ["a template-string comparison", `if (url.pathname === \`/api/back-door\`) return json({ ok: true });`],
    ["req.url read raw", `if (req.url.endsWith("/api/back-door")) return json({ ok: true });`],
  ];
  for (const [form, probe] of blindForms) {
    const routes = routeSet(probe), stray = unrecognized(probe), aliases = pathAliases(probe);
    check(`§1 a route spelled as ${form} turns the pin red (the extractor misses it, a detector fires)`,
      !routes.some((r) => r.includes("back-door")) && stray.length + aliases.length > 0,
      `routes=[${routes.join(" | ")}] stray=[${stray.join(" | ")}] aliases=[${aliases.join(" | ")}]`);
  }
  const preAlias = pathAliases(preAuth);
  check("§1 the pre-auth region routes on `url.pathname` only — no alias the allowlist pin cannot see",
    preAlias.length === 0, preAlias.join(" | "));
  const found = routeSet(preAuth);
  check("§1 the pre-auth route set equals the reviewed allowlist",
    found.join("\n") === [...PRE_AUTH_ROUTES].sort().join("\n"),
    `unexpected: [${found.filter((r) => !PRE_AUTH_ROUTES.includes(r)).join(", ")}] missing: [${PRE_AUTH_ROUTES.filter((r) => !found.includes(r)).join(", ")}]`);
  // the static map and bundleV live in server/transport.ts since the P4 split, so the anchors are
  // read where they now are. The anchor probe is its OWN check: a slice between two missing anchors
  // is the empty string, and an empty static map would read as "nothing is served without a token".
  const transportSrc = await readText(`${ROOT}/server/transport.ts`);
  const staticAt = transportSrc.indexOf("const STATIC");
  const staticEnd = transportSrc.indexOf("function bundleV");
  check("§1 the static map's own anchors are found in server/transport.ts (else the map check below is vacuous)",
    staticAt >= 0 && staticEnd > staticAt, `STATIC@${staticAt} bundleV@${staticEnd}`);
  const statics = [...transportSrc.slice(staticAt, staticEnd).matchAll(/^\s*"([^"]+)": \{ path/gm)].map((m) => m[1]);
  check("§1 the unauthenticated static map equals the reviewed set (no new file served without a token)",
    [...statics].sort().join(" ") === [...STATIC_ROUTES].sort().join(" "), statics.join(" "));
  const stewSrc = src.slice(src.indexOf("async function handleStewardRoute"), src.indexOf("Bun.serve<WSData>"));
  const stewStray = unrecognized(stewSrc);
  const stewFound = routeSet(stewSrc);
  const stewAlias = pathAliases(stewSrc);
  check("§1 the steward principal's route set equals the reviewed allowlist, in a form the extractor reads",
    stewStray.length === 0 && stewAlias.length === 0 && stewFound.join("\n") === [...STEWARD_ROUTES].sort().join("\n"),
    `stray: [${stewStray.join(" | ")}] alias: [${stewAlias.join(" | ")}] unexpected: [${stewFound.filter((r) => !STEWARD_ROUTES.includes(r)).join(", ")}]`);
  // the steward gate is default-deny: an unmatched path must fall to a 403, never to the owner
  // chain below it. If this `?? json(…403)` ever becomes a fallthrough, every owner route opens.
  check("§1 the steward gate ends in a default-deny (an unmatched path 403s, never falls through)",
    /const r = await handleStewardRoute\(req, url\);\s*\n\s*return r \?\? json\(\{ error: "steward token: route not in scope" \}, 403\);/.test(src));
  // the helper principal, held to the same three properties as the steward's. The FIRST of them is
  // the load-bearing one for this handler in particular: its guard is a regex rather than a
  // `startsWith` prefix precisely so the extractor below can see what it opens — a prefix would have
  // been a working pre-auth surface this whole section is blind to.
  const helpSrc = src.slice(src.indexOf("async function handleHelperRoute"), src.indexOf("// --- ADJUDICATION"));
  const helpStray = unrecognized(helpSrc);
  const helpAlias = pathAliases(helpSrc);
  const helpFound = routeSet(helpSrc);
  check("§1 the helper principal's route set equals the reviewed allowlist, in a form the extractor reads",
    helpSrc.length > 500 && helpStray.length === 0 && helpAlias.length === 0
      && helpFound.join("\n") === [...HELPER_ROUTES].sort().join("\n"),
    `slice=${helpSrc.length} stray: [${helpStray.join(" | ")}] alias: [${helpAlias.join(" | ")}] unexpected: [${helpFound.filter((r) => !HELPER_ROUTES.includes(r)).join(", ")}] missing: [${HELPER_ROUTES.filter((r) => !helpFound.includes(r)).join(", ")}]`);
  // …and its two ends. It must AUTHENTICATE before it does anything (the guard regex is the only
  // thing above that line), and an unmatched path inside it must 403 rather than reach the owner
  // chain. The dispatch in fetch() returns only a non-null answer, so the second half is what stops
  // a helper path from ever falling through.
  check("§1 the helper gate authenticates before every route and default-denies an unmatched path",
    /return null;\n\s*if \(!\(await helperAuthed\(req, url\)\)\) return json\(\{ error: "unauthorized" \}, 401\);/.test(helpSrc)
      && /return json\(\{ error: "helper token: route not in scope" \}, 403\);\n\}/.test(helpSrc),
    `authFirst=${/return null;\n\s*if \(!\(await helperAuthed/.test(helpSrc)} deny=${/route not in scope" \}, 403\);\n\}/.test(helpSrc)}`);

  // ===== §2 the non-owner principals × the dangerous owner surface =====
  const sess = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
  const idle = sess.slots.find((s) => !s.cwd);
  check("§2 an idle slot is available as the matrix's blast-radius-free target", !!idle, JSON.stringify(sess.slots.map((s) => s.id + (s.cwd ? "*" : ""))));
  // a DONE task as the matrix's task-scoped fixture — every owner-controlled probe on it answers 409
  // before any mutation (no criterion, no verdict, not pending/queued), so the owner control
  // proves existence without touching state
  const fixT = (await (await post("/api/tasks", { text: "sec-matrix-fixture", queue: false })).json()) as { task: { id: string } };
  await post(`/api/tasks/${fixT.task.id}/done`, {});
  const probes = [...dangerous(idle?.id ?? 16), ...taskSurface(fixT.task.id)];
  // A scoped self credential, taken from state rather than a pane probe (deterministic, and it is
  // the same string the pane exports — server.ts reads it from exactly here). SLOT 2 BY NAME, and
  // that name is the point: it is a PLAIN (non-lane) session, and since 2026-08-07 its pane carries
  // this credential too (see the self family's note in PRE_AUTH_ROUTES). The widening handed a real
  // Fleet token to sessions that can never land, so the whole dangerous owner surface is fired
  // against one — an escalation shows up here as a status that is neither 401 nor 403.
  //
  // This used to read `Object.values(slots).map(s => s.selfToken).find(Boolean)` under the name "a
  // lane selfToken", which was a mislabel: state keys are slot ids, so it returned whichever slot
  // sorted first and was active — empirically slot 2, the plain one. Nothing is lost by naming it,
  // because the matrix asserts a property of the credential CLASS (the owner gate never honours a
  // self token, whoever holds it); a real LANE's token is exercised against the self routes it CAN
  // reach in §3 below and throughout e2e/self-token.ts.
  const plainSelf = await selfTokenOf(2);
  check("§2 fixtures: a PLAIN session's selfToken and a real guest cookie are available as principals",
    /^[0-9a-f]{32}$/.test(plainSelf) && /^share_[0-9a-f]+=/.test(ctx.shICookie),
    `plain=${plainSelf.slice(0, 8)}… cookie=${ctx.shICookie.slice(0, 16)}…`);
  const principals: { name: string; headers: Record<string, string> }[] = [
    { name: "no credential", headers: {} },
    { name: "an unknown bearer token", headers: { authorization: "Bearer 00000000000000000000000000000000" } },
    { name: "a guest share cookie", headers: { cookie: ctx.shICookie } },
    { name: "a plain session's selfToken offered as the owner token", headers: { authorization: `Bearer ${plainSelf}` } },
    { name: "a plain session's selfToken in its own header", headers: { "x-fleet-self-token": plainSelf } },
    { name: "the steward token", headers: { authorization: `Bearer ${sc.token}` } },
  ];
  // D-5 · the class-2 read is owner-only and closed by construction. The control first proves the
  // route returned its documented row shape; every forbidden class-3 example then gets its own
  // negative assertion so one disappearing check cannot hide behind the rest of the set.
  const MACHINE_SETTING_NAMES = [
    "FLEET_DISPATCH_MAX_LANES", "FLEET_VERIFY_TIMEOUT_MS", "FLEET_VERIFY_WAIT_MS",
    "FLEET_MIGRATE_PCT", "FLEET_LANE_MIGRATE_PCT", "FLEET_MODEL", "FLEET_STALLED_IDLE_MS",
    "FLEET_CARD_MS", "FLEET_BRIEF_MS", "FLEET_LAND_FF_RETRY_ROUNDS",
    "FLEET_MERGE_REPAIR_ROUNDS", "FLEET_AUTO_REVIEW_MS",
  ];
  const [machineOwner, machineSelf, machineShare] = await Promise.all([
    fetch(BASE + "/api/machine-settings", { headers: H }),
    fetch(BASE + "/api/machine-settings", { headers: { "x-fleet-self-token": plainSelf } }),
    fetch(BASE + "/api/machine-settings", { headers: { cookie: ctx.shICookie } }),
  ]);
  const machineBody = await machineOwner.json().catch(() => null) as
    { settings?: { name?: unknown; value?: unknown; default?: unknown; how?: unknown }[] } | null;
  const machineRows = Array.isArray(machineBody?.settings) ? machineBody.settings : [];
  const machineNames = machineRows.map((r) => r.name).filter((name): name is string => typeof name === "string");
  check("§2 machine settings: the owner reads only the reviewed allowlist, at most twelve complete rows",
    machineOwner.status === 200 && machineRows.length === machineNames.length && machineNames.length <= 12
      && new Set(machineNames).size === machineNames.length
      && machineNames.every((name) => MACHINE_SETTING_NAMES.includes(name))
      && machineRows.every((r) => (typeof r.value === "string" || typeof r.value === "number")
        && (typeof r.default === "string" || typeof r.default === "number")
        && (r.how === ".env + Neustart" || r.how === "watchdog.sh + kickstart")),
    `${machineOwner.status} [${machineNames.join(",")}]`);
  for (const forbidden of ["FLEET_TOKEN", "FLEET_SELF_TOKEN", "FLEET_HOST", "FLEET_CMD", "FLEET_HUB_REMOTE"]) {
    check(`§2 machine settings: ${forbidden} is absent`,
      machineOwner.status === 200 && !machineNames.includes(forbidden), machineNames.join(","));
  }
  check("§2 machine settings: valid Self- and Share-credentials get existence-hiding 404",
    machineSelf.status === 404 && machineShare.status === 404,
    `self=${machineSelf.status} share=${machineShare.status}`);
  for (const p of principals) {
    const res = await Promise.all(probes.map(async (probe) => ({ probe, status: (await fire(probe, p.headers)).status })));
    const leaked = res.filter((r) => r.status !== 401 && r.status !== 403);
    check(`§2 ${p.name} is denied on all ${probes.length} dangerous owner routes (401/403 — never far enough to validate a body)`,
      leaked.length === 0, leaked.map((r) => `${r.probe.path}:${r.status}`).join(" "));
  }
  // the anti-tautology control: the same probes, with the owner token, must NOT be denied —
  // otherwise the matrix above would pass just as well against a list of routes that don't exist.
  // Admission is the probe's OWN expected status, never "anything but a denial": a 500/502/503 is a
  // handler that crashed or a proxy that never reached it, and neither proves the route exists.
  const ownerProbes = probes.filter((p) => p.owner !== undefined);
  const ownerMisses = (res: { probe: Probe; status: number }[]) => res.filter((r) => r.status !== r.probe.owner);
  // the guard's own negative control, one check per server-error code: fed that status on every
  // probe, the comparison must reject all of them — else the live control below is vacuous for it
  for (const code of [500, 502, 503]) {
    const injected = ownerMisses(ownerProbes.map((probe) => ({ probe, status: code })));
    check(`§2 control guard: an injected ${code} on every owner probe is rejected, never read as admission`,
      ownerProbes.length > 0 && injected.length === ownerProbes.length, `${injected.length}/${ownerProbes.length} rejected`);
  }
  const ownerRes = await Promise.all(ownerProbes.map(async (probe) => ({ probe, status: (await fire(probe, H)).status })));
  const missed = ownerMisses(ownerRes);
  check(`§2 control: the owner gets each probe's expected status on all ${ownerProbes.length} of them (so the denials above are about auth, not missing or crashing routes)`,
    missed.length === 0, missed.map((r) => `${r.probe.path}:${r.status}≠${r.probe.owner}`).join(" "));
  await post(`/api/tasks/${fixT.task.id}/delete`, {}); // the task-surface fixture, retired

  if (!REPO) return; // §3–§5 need a lane; the lane sections of the suite are repo-gated too

  // ===== §3 a scoped credential dies with its session =====
  const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  const selfTok = await selfTokenOf(ln.slot);
  const selfAuto = (tok: string) => fetch(BASE + "/api/self/autos", {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": tok },
    body: JSON.stringify({ text: "security-probe", inSec: 3600 }),
  });
  const live = await selfAuto(selfTok);
  const liveJ = (await live.json()) as { auto?: { id: string } };
  check("§3 control: the live lane's selfToken authenticates (so the refusals below mean revocation)",
    live.ok && !!liveJ.auto, `${live.status} ${JSON.stringify(liveJ)}`);
  if (liveJ.auto) await post(`/api/autos/${liveJ.auto.id}/delete`, {});

  // ===== §STN-1 the transition rail's perimeter: nobody impersonates the Supervisor, nobody
  // nominates a receiver, and no Supervisor text can reach a lane =====
  {
    const completeUrl = `${BASE}/api/self/supervisor-watch/deadbeef/complete`;
    const completeAs = (headers: Record<string, string>): Promise<Response> =>
      fetch(completeUrl, { method: "POST", headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ text: "perimeter probe" }) });
    const [noCred, ownerTok, stewardTok, guestCookie, plainSession, laneSession] = await Promise.all([
      completeAs({}),
      completeAs({ authorization: `Bearer ${TOKEN}` }),
      completeAs({ authorization: `Bearer ${sc.token}` }),
      completeAs({ cookie: ctx.shICookie }),
      completeAs({ "x-fleet-self-token": plainSelf }),
      completeAs({ "x-fleet-self-token": selfTok }),
    ]);
    check("§STN-1 the completion door is a self-principal door: owner, steward, guest and no credential are all 401",
      noCred.status === 401 && ownerTok.status === 401 && stewardTok.status === 401 && guestCookie.status === 401,
      `${noCred.status}/${ownerTok.status}/${stewardTok.status}/${guestCookie.status}`);
    // WHAT THIS CHECK IS ABOUT IS THE STATUS, and that is asserted first and unchanged: a
    // recognized self principal meets 409, never a 401, so nothing here sends anyone looking for a
    // better credential. The SENTENCE moved on 2026-09-07, when the occupancy stage learned to name
    // which of its three states it is in (server.ts#supervisorRefusal) — and this suite runs AFTER
    // e2e/supervisor.ts, which leaves a dead binding behind, so the honest answer here is "the role
    // is unfilled", not "you are not it". Read the state from the owner side rather than hard-coding
    // one: a fixed sentence is what made this check fall on a change it was never about, and a bare
    // `.includes("bound Supervisor")` would pass on all three and assert nothing.
    const svOccupancy = ((await (await get("/api/programs")).json()) as
      { supervisorHealth: { occupancy: string } }).supervisorHealth.occupancy;
    const expectedRefusal = svOccupancy === "unbound" ? "no Supervisor binding exists"
      : svOccupancy === "stale" ? "the Supervisor binding is STALE"
      : "not the bound Supervisor";
    const plainText = await plainSession.text();
    check("§STN-1 a recognized self principal that is not the bound Supervisor is 409 (plain and lane alike) — no token hunt, and the refusal names the occupancy state the fleet is actually in",
      plainSession.status === 409 && laneSession.status === 409
        && !/unauthorized/i.test(plainText) && plainText.includes(expectedRefusal),
      `${plainSession.status}/${laneSession.status} occupancy=${svOccupancy} expected="${expectedRefusal}" got=${plainText}`);
    const register = (tok: string, body: unknown): Promise<Response> =>
      fetch(`${BASE}/api/self/watch`, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": tok }, body: JSON.stringify(body) });
    const base = { kind: "transition", idleSec: 60, deadlineSec: 600, awaiting: "perimeter" };
    const [laneRegisters, nominatesTarget, nominatesSlot, asksInbox] = await Promise.all([
      register(selfTok, base),
      register(plainSelf, { ...base, target: ln.slot }),
      register(plainSelf, { ...base, slot: ln.slot }),
      register(plainSelf, { ...base, delivery: "inbox" }),
    ]);
    const [tTarget, tSlot, tInbox] = await Promise.all([nominatesTarget, nominatesSlot, asksInbox].map((r) => r.text()));
    check("§STN-1 a lane never registers a transition watch, so Supervisor text can structurally never reach a lane pane (409)",
      laneRegisters.status === 409 && (await laneRegisters.text()).includes("a lane may not subscribe"),
      String(laneRegisters.status));
    check("§STN-1 no caller nominates a receiver anywhere: target and slot are refused by name at registration (400)",
      nominatesTarget.status === 400 && tTarget.includes("[target] is not read")
        && nominatesSlot.status === 400 && tSlot.includes("[slot] is not read"),
      `${nominatesTarget.status}:${tTarget} | ${nominatesSlot.status}:${tSlot}`);
    check("§STN-1 the owner operations inbox is not a Controller's: delivery is refused by name for a transition watch (400)",
      asksInbox.status === 400 && tInbox.includes("[delivery] is not read"), `${asksInbox.status}:${tInbox}`);
    // the source rule behind the two refusals above: the completion handler reads `text` and
    // nothing else from the body, and the receiver comes from the WATCH's slot.
    const srv = readFileSync(`${ROOT}/server.ts`, "utf8");
    const handlerAt = srv.indexOf("async function completeTransitionWatch(");
    const handlerEnd = srv.indexOf("\n}\n", handlerAt);
    const handler = handlerAt < 0 ? "" : srv.slice(handlerAt, handlerEnd);
    check("§STN-1 source: completeTransitionWatch reads only `text` from the body and derives the receiver from the watch's own slot",
      handler.includes('Object.keys(body).filter((k) => k !== "text")')
        && handler.includes("const receiver = slotFrom(w.slot);")
        && !/body\.(slot|target|receiver|programId|delivery)/.test(handler),
      `${handlerAt}:${handlerEnd}`);
  }

  // ===== §4 no secret reaches a non-owner-readable payload =====
  const SHARE_PW = "sec-sweep-password-7712";
  const shRes = await post(`/api/slots/${ln.slot}/share`, { mode: "view", password: SHARE_PW });
  const sh = (await shRes.json()) as { id: string };
  const shAuth = await fetch(BASE + `/s/${sh.id}/auth`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: SHARE_PW }),
  });
  const shCookie = (shAuth.headers.get("set-cookie") ?? "").split(";")[0];
  check("§4 fixture: a fresh view share on the probe lane is authenticated", shAuth.ok && shCookie.startsWith(`share_${sh.id}=`), shCookie.slice(0, 24));
  const stAll = readState();
  // every secret the process holds, keyed by name so a hit names WHICH one leaked. Deduped BY
  // VALUE (the share just created appears twice — as the password sent and as the stored secret),
  // so the ×N in the check names below is the count of distinct strings actually searched for.
  const secrets = [...new Map<string, string>([
    ["owner token", TOKEN], ["steward token", sc.token], ["this share's password", SHARE_PW],
    ...Object.entries(stAll.slots ?? {}).filter(([, v]) => v.selfToken).map(([id, v]) => [`slot ${id} selfToken`, v.selfToken!] as [string, string]),
    ...(stAll.shares ?? []).map((s) => [`share ${s.id} secret`, s.secret] as [string, string]),
  ].map(([n, v]) => [v, n] as [string, string]))].map(([v, n]) => [n, v] as [string, string]);
  check("§4 fixture: the secret inventory covers all four credential classes and nothing too short to be distinctive",
    ["owner token", "steward token", "selfToken", "secret"].every((c) => secrets.some(([n]) => n.includes(c)))
    && secrets.every(([, v]) => v.length >= 8),
    secrets.map(([n, v]) => `${n}:${v.length}`).join(" "));
  const sweep = async (label: string, reqs: [string, Promise<Response>][]): Promise<void> => {
    const bodies = await Promise.all(reqs.map(async ([p, r]) => [p, await (await r).text()] as [string, string]));
    const hits = bodies.flatMap(([p, b]) => secrets.filter(([, v]) => b.includes(v)).map(([n]) => `${p}→${n}`));
    check(`§4 no ${label} payload carries any credential (${bodies.length} endpoints × ${secrets.length} secrets)`,
      hits.length === 0, hits.join(" "));
    const empty = bodies.filter(([, b]) => b.length < 2);
    check(`§4 control: every ${label} endpoint answered with a body to search`, empty.length === 0, empty.map(([p]) => p).join(" "));
  };
  const guest = (p: string) => fetch(BASE + `/s/${sh.id}${p}`, { headers: { cookie: shCookie } });
  await sweep("guest-readable", [["info", guest("/info")], ["brief", guest("/brief")], ["diff", guest("/diff")],
    ["transcript", guest("/transcript")], ["comments", guest("/comments")]]);
  await sweep("steward-readable", [["sessions", sc.stewGet("/api/steward/sessions")],
    ["brief", sc.stewGet(`/api/steward/slots/${ln.slot}/brief`)],
    ["transcript", sc.stewGet(`/api/steward/slots/${ln.slot}/transcript`)],
    ["journal", sc.stewGet("/api/steward/journal?tail=5")],
    ["dispositions", sc.stewGet("/api/dispositions?limit=50")]]);
  await post(`/api/slots/${ln.slot}/unshare`, {});

  // ===== §3 continued: shelve kills the pane → the credential must die with it =====
  const NOTE = "shelve-note-secret-marker-8823";
  check("§3 fixture: the probe lane is shelved with a distinctive note", (await post(`/api/slots/${ln.slot}/shelve`, { note: NOTE })).ok);
  const dead = await selfAuto(selfTok);
  check("§3 a killed lane's selfToken no longer authenticates (the slot's cwd is what the route binds to)",
    dead.status === 401, String(dead.status));
  // recycle the same slot: server.ts ~1147 claims a fresh session mints a fresh credential
  check("§3 fixture: the slot is recycled onto a plain session", (await post(`/api/slots/${ln.slot}/open`, { cwd: REPO })).ok);
  const reTok = await selfTokenOf(ln.slot, selfTok);
  check("§3 a recycled slot mints a NEW selfToken (the prior session's credential is not inherited)",
    /^[0-9a-f]{32}$/.test(reTok) && reTok !== selfTok && selfTok.length === 32, `${selfTok.slice(0, 8)}… → ${reTok.slice(0, 8)}…`);
  const stale = await selfAuto(selfTok);
  check("§3 the prior session's selfToken is refused against the recycled slot", stale.status === 401, String(stale.status));
  await post(`/api/slots/${ln.slot}/kill`, {});
  await post("/api/worktrees/discard", { repo: REPO, path: ln.cwd, branch: ln.branch });

  // ===== §5 the audit log records that things happened, never the secrets they carried =====
  // restart.ts rotates the log mid-suite, so both halves are searched — a secret that rotated
  // out is still on disk.
  const auditRaw = (await readText(ctx.auditPath)) + (await readText(`${ctx.auditPath}.1`));
  check("§5 control: the audit log recorded the shelve (so the absence checks below search a real record)",
    auditRaw.includes(`"slot_shelve"`) && auditRaw.includes(`"note:${NOTE.length}"`), `${auditRaw.length} bytes`);
  check("§5 the audit log records a shelve note's LENGTH, never its text", !auditRaw.includes(NOTE));
  check("§5 the audit log never contains the steward token", !auditRaw.includes(sc.token));
  check("§5 the audit log never contains a lane selfToken (live or revoked)",
    !auditRaw.includes(selfTok) && !auditRaw.includes(reTok)
    && Object.values(readState().slots ?? {}).every((s) => !s.selfToken || !auditRaw.includes(s.selfToken)));
  check("§5 the audit log never contains this section's share password", !auditRaw.includes(SHARE_PW));

  // ===== §6 the model/effort charset is per HARNESS, and every adapter's is an allowlist =====
  // Every spawn option is interpolated into a tmux shell line, so each adapter widening the
  // charset re-opens the same question rather than inheriting an answer. `'` is THE character:
  // it is the one that can terminate the single-quoted word the whole scheme rests on. A space or
  // `;` would split the line; `*` is admitted on purpose and is exactly why the quotes are not
  // decoration (zsh aborts an unmatched glob and takes the pane with it).
  //
  // This suite runs under FLEET_CMD=true — an UNDECLARED command — so the DEFAULT adapter here is
  // judged by MODEL_RE. That is the counter-proof half: a per-slot harness must not have widened
  // the charset for slots that never asked for one. (The live-agent half — that a declared foreign
  // harness's models reach a real pane and the agent survives — is fleet-e2e-harness.ts, phase 2 of
  // ./e2e-claude-gate.sh, and is not duplicated here.)
  // a slot no other module touches: §6 recycles it repeatedly and asserts on the PANE's command
  // line, so a fixture another section left behind would be read as this section's result
  const HARNESS_SLOT = 10;
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {}); // ensure it is free before the first open
  const cat = (await (await get("/api/harnesses")).json()) as
    { harnesses: { id: string; default: boolean; automatable: boolean; allowsLanes: boolean; singleton: boolean; role?: string; supports: { transcript: boolean; effort: boolean; resume: boolean; model: boolean; selfSchedule: boolean; container: boolean }; effortLevels: string[]; note: string | null }[];
      defaultModel?: string };
  const pi = cat.harnesses.find((h) => h.id === "pi");
  const piZai = cat.harnesses.find((h) => h.id === "pi-zai");
  const piOx = cat.harnesses.find((h) => h.id === "pi-ox");
  const piHost = cat.harnesses.find((h) => h.id === "pi-unfenced");
  const def = cat.harnesses.find((h) => h.default);
  check("§6 the catalogue names the default and all four explicit Pi-family adapters",
    !!pi && !!piZai && !!piOx && !!piHost && !!def && def.id === "claude", cat.harnesses.map((h) => h.id).join(","));
  check("§6 pi-unfenced is attended, main-only and singleton — the exception cannot become a pool",
    piHost?.automatable === false && piHost.allowsLanes === false && piHost.singleton === true
    && /UNFENCED/.test(piHost.note ?? "") && /unrestricted filesystem writes, git and network/.test(piHost.note ?? ""),
    JSON.stringify(piHost));
  // the caveat is part of the contract, not a UI string: an owner picks this harness from it, and
  // since 2026-08-12 what it must state is the REACH, not a fence — full local access is the
  // normal mode, so a note still promising a write fence would be the concealment now.
  const piNote = pi?.note ?? "";
  check("§6 the pi adapter names its full local reach at pick time, and claims no fence",
    /full local access/.test(piNote) && /git\/commit/.test(piNote) && /network/.test(piNote)
    && !/fence/.test(piNote), piNote);

  // THE BROWSER PROFILE is disposed per adapter, never left to silence (Slot.browser, 2026-09-14): the
  // catalogue publishes it so a picker can say why a pi or container lane has no browser choice.
  const profiles = (cat.harnesses as { id: string; browserProfile?: string }[])
    .map((h) => `${h.id}:${h.browserProfile ?? "MISSING"}`).sort().join(",");
  check("§6 the catalogue disposes the browser profile per adapter — claude/codex apply, pi family not-applicable, container unsupported",
    profiles === "claude:apply,codex:apply,container:unsupported,pi-ox:not-applicable,pi-unfenced:not-applicable,pi-zai:not-applicable,pi:not-applicable",
    profiles);

  // TWO AXES, NOT ONE. `container` answers "where does this run"; claude/pi/codex answer "what am
  // I working with". They shared one field until 2026-08-10, so the picker listed the hull in the
  // harness dropdown as a peer of claude — and `codex in a box` could not be expressed at all. The
  // catalogue now PUBLISHES which is which instead of leaving the client to infer it from the id,
  // and that is the whole point of asserting it here: the client filters on this field, so a
  // harness added later without a role would silently become an agent choice.
  const places = cat.harnesses.filter((h) => h.role === "place").map((h) => h.id);
  const agents = cat.harnesses.filter((h) => h.role === "agent").map((h) => h.id);
  check("§6 every catalogue entry declares an axis — agent (what) or place (where), none unlabelled",
    places.length + agents.length === cat.harnesses.length,
    cat.harnesses.map((h) => `${h.id}:${h.role ?? "MISSING"}`).join(","));
  check("§6 the container hull is the only PLACE, and all six selectable agent modes are agents",
    places.join(",") === "container"
    && ["claude", "pi", "pi-zai", "pi-ox", "pi-unfenced", "codex"].every((id) => agents.includes(id)),
    `places=${places.join(",")} agents=${agents.join(",")}`);
  // the inverse, which is what makes the pair meaningful: a `place` is exactly the entry that runs
  // something somewhere else, so it is also the only one carrying supports.container. If these two
  // ever disagree the axis label is decoration rather than the fact the client filters on.
  check("§6 place and supports.container name the SAME entry — the label is not decoration",
    cat.harnesses.every((h) => (h.role === "place") === h.supports.container),
    cat.harnesses.map((h) => `${h.id}:${h.role}/${h.supports.container}`).join(","));
  // the picker shows this as the model field's placeholder, so "leave it empty" is a visible
  // choice. A missing value would silently degrade to the word "default" and hide the real id.
  check("§6 the catalogue publishes what an empty model launches on the default adapter",
    typeof cat.defaultModel === "string" && cat.defaultModel.length > 0, String(cat.defaultModel));

  // --- the quote, per adapter. Rejected BEFORE it can reach a shell line, both times.
  for (const h of ["pi", "pi-zai", "pi-ox", "pi-unfenced", "claude", "codex"]) {
    const q = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: h, model: "a/b'c" });
    check(`§6 harness ${h} rejects a model carrying a single quote (400)`, q.status === 400, String(q.status));
  }
  // --- ...and the shapes the WIDER charset exists for are still refused on the default adapter.
  for (const bad of ["claude-bridge/claude-haiku-4-5", "sonnet:high", "anthropic/*"]) {
    const r = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, model: bad });
    check(`§6 the default adapter still rejects the foreign model shape ${bad} (400)`, r.status === 400, String(r.status));
  }
  // --- the glob DOES reach a pi pane, and it reaches it SHELL-QUOTED. A deliberately unresolvable
  // provider: this asserts the spawn STRING (what tmux was told to run), which is recorded whether
  // or not `pi` is installed here — so the pin is about the quoting and nothing else.
  const GLOB = "e2e-probe/*";
  const og = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi", model: GLOB, effort: "low" });
  check("§6 a pi slot accepts a glob model and an effort level (200)", og.ok, String(og.status));
  const gcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  check("§6 the pi spawn line quotes the glob model (an unquoted one aborts the pane under zsh)",
    gcmd.includes(`--model '${GLOB}'`), gcmd.slice(-160));
  check("§6 the pi spawn line pins a session id (--session-id is create-or-attach: it IS the resume path)",
    /--session-id [0-9a-f-]{36}\b/.test(gcmd), gcmd.slice(-160));
  check("§6 the pi spawn line carries the effort level as --thinking", gcmd.includes("--thinking low"), gcmd.slice(-160));
  check("§6 ...and it spawns pi, not the fleet's FLEET_CMD", /(^|\s|;)pi --session-id/.test(gcmd), gcmd.slice(-160));

  // The fence this section used to EXECUTE here (extract the SBPL profile off the spawn line, run
  // it over /usr/bin/true, prove the three write rows) is retired by the 2026-08-12 owner
  // decision: full local access is the normal operating mode, so the security property FLIPS from
  // "the profile fences" to "no fence machinery reappears on the spawn line". A re-grown fence
  // would silently re-route lane commits through host rescue — that is the regression this now
  // guards against.
  const gcmdFlat = gcmd.replaceAll("\\", "");
  check("§6 the pi spawn line carries no sandbox machinery — full access is the deliberate contract",
    !gcmdFlat.includes("sandbox-exec") && !gcmdFlat.includes("FLEET_PI_SB"), gcmdFlat.slice(-200));

  // pi-unfenced now shares normal pi's access; what it still pins is POLICY: main-only,
  // singleton, attended. Assert both halves — the command runs bare, and the server refuses the
  // two ways the stricter shape could silently become broader.
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const uf = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-unfenced", effort: "low" });
  check("§6 pi-unfenced opens as an attended main session", uf.ok, String(uf.status));
  const ucmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out.replaceAll("\\", "");
  check("§6 pi-unfenced starts Pi without sandbox-exec (the warning describes real host power)",
    /(^|;)\s*(?:export [^;]+;\s*)*pi --session-id/.test(ucmd) && !ucmd.includes("sandbox-exec"), ucmd.slice(-220));
  const UF_OTHER = 12;
  await post(`/api/slots/${UF_OTHER}/kill`, {});
  const secondUf = await post(`/api/slots/${UF_OTHER}/open`, { cwd: REPO, harness: "pi-unfenced" });
  const secondUfJ = (await secondUf.json()) as { error?: string };
  check("§6 pi-unfenced is singleton at the server boundary",
    secondUf.status === 400 && secondUfJ.error === "harness pi-unfenced permits only one active slot",
    `${secondUf.status} ${secondUfJ.error ?? ""}`);
  const laneUf = await post(`/api/slots/${UF_OTHER}/open-worktree`, { repo: REPO, harness: "pi-unfenced" });
  const laneUfJ = (await laneUf.json()) as { error?: string };
  check("§6 pi-unfenced refuses lanes before creating a working copy",
    laneUf.status === 400 && laneUfJ.error === "harness pi-unfenced is main-session only — it cannot open a lane",
    `${laneUf.status} ${laneUfJ.error ?? ""}`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  await post(`/api/slots/${UF_OTHER}/kill`, {});

  // --- effort is a CLOSED SET, not a charset: nothing outside it can reach the line at all, and a
  // harness without the concept refuses one rather than accepting a flag it will silently drop.
  const be = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi", effort: "low; rm -rf /" });
  check("§6 a pi effort outside the declared level set is rejected (400)", be.status === 400, String(be.status));
  // the default adapter GAINED a flag on 2026-08-21 (`claude --effort <level>`), so the row that
  // used to stand here — "refused because there is no flag" — now asserts the two halves that are
  // actually live: a declared level is TAKEN, and one outside this adapter's own set is refused
  // with effortErrFor's exact text. "ultra" is deliberate: it is a real level on the codex adapter
  // and not on this one, so a shared/widened set would pass the acceptance row and fail here.
  const defH = cat.harnesses.find((h) => h.id === "claude");
  const okE = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, effort: "high" });
  const okEJ = okE.ok ? { error: "" } : ((await okE.json()) as { error?: string });
  check("§6 the default adapter accepts a declared effort level (200) — it is no longer effort-less",
    okE.ok, `${okE.status} ${JSON.stringify(okEJ)}`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const badDefE = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, effort: "ultra" });
  const badDefEJ = (await badDefE.json()) as { error?: string };
  check("§6 the default adapter refuses a level outside its OWN set, naming the levels it takes",
    badDefE.status === 400 && badDefEJ.error === `bad effort (one of: ${defH?.effortLevels.join(", ") ?? ""})`
    && (defH?.effortLevels.length ?? 0) > 0,
    `${badDefE.status} ${JSON.stringify(badDefEJ)} levels=${JSON.stringify(defH?.effortLevels)}`);
  // ...and the NO-CONCEPT branch of effortErrFor keeps a probe at /open rather than only at ▸ start
  // below: the container hull has no flag to pass on, and must refuse rather than drop. effortOf
  // runs before boxOf in this route, so no pane is spawned by this row.
  const ce = await post(`/api/slots/${HARNESS_SLOT}/open`,
    { cwd: REPO, harness: "container", container: "e2e-effort-probe", effort: "high" });
  const ceJ = (await ce.json()) as { error?: string };
  check("§6 a harness with no effort concept refuses one at /open, rather than dropping it (400)",
    ce.status === 400 && ceJ.error === "harness container takes no effort",
    `${ce.status} ${JSON.stringify(ceJ)}`);

  // ▸ start is its own spawn reader, so repeat both effort rejections at that boundary rather
  // than inferring them from /open. The error TEXT is part of the contract: a generic 400 could
  // come from the task, repo or capacity checks and would not prove effortOf judged the request.
  const deT = await post("/api/tasks", { text: "dispatch-effort-rejection-probe", queue: false });
  const deId = ((await deT.json()) as { task?: { id: string } }).task?.id ?? "";
  check("§6 dispatch-effort fixture: a pending task exists for rejection probes", deT.ok && !!deId,
    `${deT.status} id=${deId || "missing"}`);
  if (deId) {
    const badDispatchEffort = await post(`/api/tasks/${deId}/dispatch`,
      { harness: "pi", effort: "high; id" });
    const badDispatchJ = (await badDispatchEffort.json()) as { error?: string };
    const piEffortErr = `bad effort (one of: ${pi?.effortLevels.join(", ") ?? ""})`;
    check("§6 ▸ start rejects a pi effort outside effortLevels with effortErrFor's exact text",
      badDispatchEffort.status === 400 && badDispatchJ.error === piEffortErr,
      `${badDispatchEffort.status} ${JSON.stringify(badDispatchJ)}`);

    const noEffortHarness = await post(`/api/tasks/${deId}/dispatch`,
      { harness: "container", effort: "high" });
    const noEffortJ = (await noEffortHarness.json()) as { error?: string };
    check("§6 ▸ start rejects effort on a harness without the capability with effortErrFor's exact text",
      noEffortHarness.status === 400 && noEffortJ.error === "harness container takes no effort",
      `${noEffortHarness.status} ${JSON.stringify(noEffortJ)}`);
    await post(`/api/tasks/${deId}/delete`, {});
  }

  const uh = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "opencode" });
  check("§6 an unregistered harness is refused (400) — the registry is an allowlist too", uh.status === 400, String(uh.status));

  // --- the transcript degradation, proven where it actually bites. The slot's cwd is REPO, which
  // this suite has had claude-less sessions in; what matters is that transcriptFile's newest-by-
  // mtime FALLBACK is not consulted for a harness that writes no claude transcript. Its `source`
  // is the observable: null means "no transcript", and for a pi slot it must be null ALWAYS,
  // never "whatever .jsonl happened to be newest in this directory". The unfenced-policy probes
  // above deliberately killed their slot, so establish this probe's own Pi precondition explicitly
  // instead of letting an inactive-slot error masquerade as a transcript regression.
  const tpOpen = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" });
  check("§6 transcript fixture: a fenced Pi slot is active before its degradation is measured",
    tpOpen.ok, String(tpOpen.status));
  const tp = (await (await get(`/api/slots/${HARNESS_SLOT}/transcript?after=0`)).json()) as { source: string | null; entries: unknown[] };
  check("§6 a pi slot reports NO transcript source (the mtime fallback must not hand it a stranger's conversation)",
    tp.source === null && tp.entries.length === 0, `${String(tp.source)} / ${tp.entries.length}`);

  // --- the SEPARATE context reader. Keep transcript=false above: this fact comes from Pi's own
  // host-side usage file, identity-pinned by cwd + session UUID, and enables no conversation view.
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const piCtxOpen = await post(`/api/slots/${HARNESS_SLOT}/open`,
    { cwd: REPO, harness: "pi", model: "openai-codex/gpt-5.6-sol" });
  check("§6 ctx fixture: a Pi GPT slot opens for the usage-file probe", piCtxOpen.ok, String(piCtxOpen.status));
  const piCtxCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  const piSid = piCtxCmd.match(/--session-id ([0-9a-f-]{36})\b/)?.[1] ?? "";
  check("§6 ctx fixture: the probe has the pinned Pi session UUID it must identify",
    /^[0-9a-f-]{36}$/.test(piSid), piCtxCmd.slice(-160));
  // REALPATH, because that is where pi itself writes: it is a node process and `process.cwd()`
  // returns the physical path, so a slot opened on $TMPDIR (a symlink on macOS) produces a
  // `--private-var-folders-…--` slug. Deriving this fixture from the RAW REPO was this check's own
  // first red — it planted the file in a directory pi would never use, and the failure then read
  // like "the reader is broken" while nothing had been measured. It also exposed the same blind spot
  // in the reader itself, which is the finding this row exists to protect.
  const piSessionDir = `${process.env.HOME}/.pi/agent/sessions/--${realpathSync(REPO).replace(/^\/+/, "").replaceAll("/", "-")}--`;
  mkdirSync(piSessionDir, { recursive: true });
  const matchingPiFiles = (): string[] => readdirSync(piSessionDir)
    .filter((n) => n.endsWith(`_${piSid}.jsonl`)).map((n) => `${piSessionDir}/${n}`);
  for (const file of matchingPiFiles()) rmSync(file, { force: true });
  check("§6 ctx fixture: the pinned Pi session has NO readable file before the absence probe",
    piSid !== "" && matchingPiFiles().length === 0, matchingPiFiles().join(","));
  type PiFill = { usedTokens: number; windowTokens: number; pct: number } | null;
  const piFill = async (): Promise<PiFill> => {
    const sx = (await (await get("/api/sessions")).json()) as { slots: { id: number; ctx: PiFill }[] };
    return sx.slots.find((s) => s.id === HARNESS_SLOT)?.ctx ?? null;
  };
  check("§6 Pi context absence stays absence: no readable session yields ctx=null, never 0%",
    await piFill() === null);

  // the header carries the PHYSICAL path, because that is what pi records: it is a node process and
  // `process.cwd()` resolves symlinks. Writing the raw REPO here was this fixture's second red — the
  // file then sat in the right directory under the right UUID and was still rejected by the header
  // check, which is indistinguishable from "the reader is broken" unless you look at the row. A
  // fixture that does not model what the real producer writes cannot prove anything about the reader.
  const session = JSON.stringify({ type: "session", version: 3, id: piSid,
    timestamp: "2026-08-08T00:00:00.000Z", cwd: realpathSync(REPO) });
  const piFile = `${piSessionDir}/2026-08-08T00-00-00.000Z_${piSid}.jsonl`;
  const piDuplicate = `${piSessionDir}/2026-08-08T00-00-01.000Z_${piSid}.jsonl`;
  writeFileSync(piFile, `${session}\n`);
  writeFileSync(piDuplicate, `${session}\n`);
  check("§6 ctx fixture: two independently readable files claim the same cwd + pinned UUID",
    existsSync(piFile) && existsSync(piDuplicate));
  check("§6 ambiguous Pi identity stays absent (two matching files are never resolved by mtime)",
    await piFill() === null);
  rmSync(piDuplicate, { force: true });
  const older = JSON.stringify({ type: "message", message: { role: "assistant",
    usage: { input: 1, output: 9_000_000, cacheRead: 2, cacheWrite: 3, reasoning: 4, totalTokens: 9_000_006 } } });
  const newest = JSON.stringify({ type: "message", message: { role: "assistant",
    usage: { input: 1_167, output: 585, cacheRead: 51_712, cacheWrite: 0, reasoning: 116, totalTokens: 53_464 } } });
  const trailing = JSON.stringify({ type: "message", message: { role: "user", content: "tail" } });
  writeFileSync(piFile, `${session}\n${older}\n${newest}\n${trailing}\n`);
  check("§6 ctx fixture: exactly one cwd+UUID-pinned Pi usage file remains",
    matchingPiFiles().length === 1 && matchingPiFiles()[0] === piFile, matchingPiFiles().join(","));
  let measured: PiFill = null;
  for (let i = 0; i < 20 && measured === null; i++) {
    measured = await piFill();
    if (measured === null) await Bun.sleep(100);
  }
  check("§6 Pi context reads newest input+cache usage, excludes completion, and uses 258,400 effective",
    measured?.usedTokens === 52_879 && measured.windowTokens === 258_400 && measured.pct === 20.5,
    JSON.stringify(measured));
  rmSync(piFile, { force: true });

  // --- §6a PI-ZAI: one provider, two named models, one process-local Pi home, no key bytes in tmux. ---
  // automatable flipped 2026-09-18 together with its readiness seam (e2e/pins.ts couples the two)
  check("§6a pi-zai publishes the closed measured capability set",
    piZai?.automatable === true && piZai.allowsLanes === true && piZai.singleton === false
    && piZai.supports.resume === true && piZai.supports.transcript === false
    && piZai.supports.model === true && piZai.supports.effort === true
    && piZai.supports.selfSchedule === false && piZai.supports.container === false
    && JSON.stringify(piZai.effortLevels) === JSON.stringify(["low", "high", "max"]),
    JSON.stringify(piZai));
  check("§6a pi-zai's picker note names fixed zai/glm-5.3 (default) plus glm-5.3-flash, the default key path, its read fence and isolated Pi home",
    /zai\/glm-5\.3/.test(piZai?.note ?? "") && /glm-5\.3-flash/.test(piZai?.note ?? "")
      && /~\/\.config\/claude-fleet\/secrets\/zai-coding-plan\.key/.test(piZai?.note ?? "")
      && /read fence \(sandbox-exec\)/.test(piZai?.note ?? "") && /~\/\.pi untouched/.test(piZai?.note ?? ""),
    piZai?.note ?? "missing");

  // Every request boundary that accepts a harness/model/effort tuple must apply this adapter's
  // exact model regexp and effort allowlist before any pane or worktree can be created.
  const pzRejectTask = await post("/api/tasks", { text: "pi-zai-rejection-probe", queue: false });
  const pzRejectTaskId = ((await pzRejectTask.json()) as { task?: { id?: string } }).task?.id ?? "";
  check("§6a pi-zai rejection fixture has a pending attended-dispatch task",
    pzRejectTask.ok && !!pzRejectTaskId, `${pzRejectTask.status} id=${pzRejectTaskId || "missing"}`);
  // Free the slot FIRST: the §6 context probe above leaves slot 10 occupied, and the
  // open-worktree door refuses an active slot BEFORE it validates the model — so without this
  // kill that surface answers "slot already active" and the loop below would measure the wrong
  // 400 (found by the strengthened text assertion in the 2026-09-15 full-suite preview; the old
  // status-only assertion had been passing for that wrong reason whenever the slot was held).
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const pzRejectSurfaces = [
    ["open", (body: Record<string, unknown>) => post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, ...body })],
    ["open-worktree", (body: Record<string, unknown>) => post(`/api/slots/${HARNESS_SLOT}/open-worktree`, { repo: REPO, ...body })],
    ["lanes", (body: Record<string, unknown>) => post("/api/lanes", { repo: REPO, ...body })],
    ["dispatch", (body: Record<string, unknown>) => post(`/api/tasks/${pzRejectTaskId}/dispatch`, body)],
  ] as const;
  if (pzRejectTaskId) {
    for (const [surface, call] of pzRejectSurfaces) {
      const wrongModel = await call({ harness: "pi-zai", model: "glm-5.2" });
      const wrongModelText = await wrongModel.text();
      check(`§6a ${surface} rejects a pi-zai model outside glm-5.3/glm-5.3-flash (400)`,
        wrongModel.status === 400 && wrongModelText.includes("glm-5.3-flash"), `${wrongModel.status} ${wrongModelText}`);
      const wrongEffort = await call({ harness: "pi-zai", effort: "medium" });
      const wrongEffortText = await wrongEffort.text();
      check(`§6a ${surface} rejects pi-zai effort outside low/high/max (400)`,
        wrongEffort.status === 400 && wrongEffortText.includes("effort"), `${wrongEffort.status} ${wrongEffortText}`);
    }
    await post(`/api/tasks/${pzRejectTaskId}/delete`, {});
  }

  const zaiAgentDir = process.env.FLEET_PI_ZAI_AGENT_DIR ?? "";
  const zaiKeyFile = process.env.FLEET_PI_ZAI_KEY_FILE ?? "";
  const zaiStandIn = "fleet-e2e-zai-stand-in-key";
  const zaiModels = '{"providers":{"zai":{"models":[{"id":"glm-5.3","name":"GLM-5.3","contextWindow":1000000,"maxTokens":131072,"reasoning":true,"thinkingLevelMap":{"off":null,"minimal":null,"low":"low","medium":null,"high":"high","xhigh":null,"max":"max"}},{"id":"glm-5.3-flash","name":"GLM-5.3-Flash","contextWindow":1000000,"maxTokens":131072,"reasoning":true,"thinkingLevelMap":{"off":null,"minimal":null,"low":"low","medium":null,"high":"high","xhigh":null,"max":"max"}}]}}}\n';
  const globalPiModels = `${process.env.HOME}/.pi/agent/models.json`;
  check("§6a pi-zai fixture uses scratch overrides for both external paths",
    realpathSync(zaiAgentDir).startsWith(realpathSync(ROOT) + "/")
      && realpathSync(zaiKeyFile).startsWith(realpathSync(ROOT) + "/"),
    `${zaiAgentDir} / ${zaiKeyFile}`);
  check("§6a global ~/.pi/agent/models.json is absent before the isolated adapter probe",
    !existsSync(globalPiModels), globalPiModels);
  if (zaiAgentDir && zaiKeyFile) {
    mkdirSync(zaiAgentDir, { recursive: true });
    writeFileSync(zaiKeyFile, `${zaiStandIn}\n`);
  }
  const paneComms = async (target: string): Promise<string[]> => {
    const panePid = Number((await tmuxOut("display-message", "-p", "-t", target, "#{pane_pid}")).out);
    if (!panePid) return [];
    const children = spawnSync("pgrep", ["-P", String(panePid)], { encoding: "utf8" }).stdout
      .split("\n").filter(Boolean);
    return [String(panePid), ...children].map((pid) =>
      spawnSync("ps", ["-o", "comm=", "-p", pid], { encoding: "utf8" }).stdout.trim().split("/").pop() ?? "")
      .filter(Boolean);
  };
  const waitForPi = async (target: string): Promise<string[]> => {
    let comms: string[] = [];
    for (let i = 0; i < 40; i++) {
      comms = await paneComms(target);
      if (comms.includes("pi")) break;
      await Bun.sleep(100);
    }
    return comms;
  };
  const waitForModels = async (): Promise<string> => {
    let text = "";
    for (let i = 0; i < 40; i++) {
      try { text = readFileSync(`${zaiAgentDir}/models.json`, "utf8"); } catch { text = ""; }
      if (text === zaiModels) break;
      await Bun.sleep(100);
    }
    return text;
  };

  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const pzOpen = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-zai", effort: "high" });
  check("§6a a pi-zai slot opens without a model pin (the adapter owns the fixed default)",
    pzOpen.ok, String(pzOpen.status));
  const pzCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  check("§6a pi-zai spawn pins provider/model/session/effort and the process-local agent home",
    pzCmd.includes("pi --provider zai --model 'glm-5.3'")
      && /--session-id [0-9a-f-]{36}\b/.test(pzCmd) && pzCmd.includes("--thinking high")
      && pzCmd.includes(`PI_CODING_AGENT_DIR='${zaiAgentDir}'`), pzCmd.slice(-320));
  check("§6a pane_start_command contains $(cat key-path), never the stand-in key bytes",
    pzCmd.includes(`ZAI_API_KEY="$(cat '${zaiKeyFile}')"`) && !pzCmd.includes(zaiStandIn),
    pzCmd.slice(-320));
  // --- §6a THE READ FENCE (server/pi-zai-fence.ts, docs/messungen/2026-09-21-pi-zai-lesezaun.md).
  // Shape first, then the profile the pane ACTUALLY carries is executed: a profile that allowed
  // everything would pass any assertion about its text. Lifted out of this pane's own command line,
  // never rebuilt here — the failure that matters is a server that stops emitting it. The profile
  // holds no backslash by construction, so the de-escaped copy is byte-for-byte what the pane runs.
  const pzSbx = process.env.FLEET_PI_ZAI_SANDBOX_EXEC ?? "/usr/bin/sandbox-exec";
  const pzProfile = /FLEET_PZ_SB='([^']*)'/.exec(pzCmd)?.[1] ?? "";
  const pzFenceAt = pzCmd.indexOf(`'${pzSbx}' -p "$FLEET_PZ_SB" /usr/bin/true`);
  check("§6a pi-zai spawn self-tests its read fence at /usr/bin/true and starts pi only inside it",
    pzProfile.startsWith("(version 1)(allow default)") && pzFenceAt > 0
      && pzCmd.includes(`ZAI_API_KEY="$(cat '${zaiKeyFile}')" '${pzSbx}' -p "$FLEET_PZ_SB" pi --provider zai`)
      && !/(^|[\s;])pi --provider/.test(pzCmd.replace(`'${pzSbx}' -p "$FLEET_PZ_SB" pi --provider`, "")),
    `profile=${pzProfile.length} bytes, selfTestAt=${pzFenceAt}`);
  // FAIL-CLOSED, on every platform: the same line with an unreachable fence binary must print the
  // named marker and never start pi: the marker branch ends in `exec $SHELL`, so no path leads
  // from it to pi. Run through sh with no stdin, so that shell reads EOF and ends (a started
  // stand-in would hold the run to its timeout instead); the pane's credential exports ride along
  // and are never printed.
  // EXECUTED, so the display copy is not enough: tmux renders pane_start_command wrapped in `"…"`
  // with `\"` and `\\` escapes (measured on tmux 3.6a), and the backslash-stripped pzCmd keeps the
  // outer quotes — dash on the Linux helper then parsed a different line than the pane ran (first
  // helper preview, job 282fb099cb03). Unwrap once, unescape once: the pane's exact text.
  // trimEnd: without it the trailing newline defeats the anchored unwrap, sh runs the display copy
  // as ONE word, and the `File name too long` error echoes that word — marker text included. That
  // vacuous green is why the marker must also stand on a line of its own below.
  const pzRaw = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out.trimEnd();
  const pzExact = /^".*"$/s.test(pzRaw) ? pzRaw.slice(1, -1).replace(/\\(.)/gs, "$1") : pzRaw;
  const pzBroken = spawnSync("/bin/sh", ["-c", pzExact.replaceAll(`'${pzSbx}'`, "'/nonexistent/sandbox-exec'")],
    { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] });
  const pzBrokenOut = `${pzBroken.stdout ?? ""}${pzBroken.stderr ?? ""}`;
  check("§6a a pi-zai fence that cannot run prints its named marker and never starts pi",
    /^pi-zai: pi was NOT started - its read fence \(sandbox-exec\) failed its self-test\. This pane is a plain shell, not an agent\.$/m.test(pzBrokenOut)
      && pzBroken.status === 0 && pzBroken.error === undefined,
    `${pzBroken.error?.message ?? `exit ${pzBroken.status}`} / ${pzBrokenOut.slice(-200)}`
      + ` / exact line runnable=${pzExact.includes(`'${pzSbx}'`) && !pzExact.startsWith('"')}`);
  if (process.platform === "darwin") {
    // The canary: fenced vs. unfenced, same probe, same path — without the control the EPERM
    // measures nothing. Opens only; not one byte of either file is read.
    const pzRun = (sh: string, fenced: boolean): string => {
      if (!pzProfile) return "PROBE-DID-NOT-RUN";
      const r = fenced ? spawnSync(pzSbx, ["-p", pzProfile, "/bin/sh", "-c", sh], { encoding: "utf8" })
        : spawnSync("/bin/sh", ["-c", sh], { encoding: "utf8" });
      return `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? `spawn:${r.error.message}` : ""}`;
    };
    const opens = (f: string): string => `: < '${f}' && echo OPENED`;
    const fleetJson = `${realpathSync(ROOT)}/fleet.json`;
    const zaiOwn = `${realpathSync(zaiAgentDir)}/sessions/--${realpathSync(REPO).replace(/^\/+/, "").replaceAll("/", "-")}--`;
    const zaiForeign = `${realpathSync(zaiAgentDir)}/sessions/--fleet-e2e-foreign-slot--`;
    mkdirSync(zaiForeign, { recursive: true });
    const ctl = [pzRun(opens(fleetJson), false), pzRun(opens(zaiKeyFile), false), pzRun(`ls '${zaiForeign}' && echo OPENED`, false)];
    check("§6a fence canary control: fleet.json, the key file and a foreign session open WITHOUT the fence",
      ctl.every((o) => o.includes("OPENED")), ctl.map((o) => o.trim().slice(0, 80)).join(" | "));
    const fenced = [pzRun(opens(fleetJson), true), pzRun(opens(zaiKeyFile), true), pzRun(`ls '${zaiForeign}' && echo OPENED`, true)];
    check("§6a fence canary: fleet.json, the key file and a foreign pi-zai session are refused MECHANICALLY behind the fence",
      fenced.every((o) => o.includes("Operation not permitted") && !o.includes("OPENED")),
      fenced.map((o) => o.trim().slice(-90)).join(" | "));
    // THE DENY ROOTS: five SYNTHETIC roots the wrapper made under its instance dir, each with a real
    // child file (e2e-isolated.sh, FLEET_PI_ZAI_DENY_ROOTS) — the owner's real roots are private
    // names and never enter a tracked probe. Metadata only (`stat`), control first: an EPERM on a
    // path that does not open unfenced either measures nothing.
    const denyRoots = (process.env.FLEET_PI_ZAI_DENY_ROOTS ?? "").split(":").filter(Boolean);
    check("§6a deny-root canary has five configured synthetic roots, each with a real child file",
      denyRoots.length === 5 && denyRoots.every((p) => existsSync(`${p}/child/canary`)),
      `${denyRoots.length} roots, ${denyRoots.filter((p) => !existsSync(`${p}/child/canary`)).length} without child`);
    check("§6a the spawned profile names every deny root by its realpath",
      denyRoots.length > 0 && denyRoots.every((p) => existsSync(p) && pzProfile.includes(`(subpath "${realpathSync(p)}")`)),
      `${denyRoots.filter((p) => !existsSync(p) || !pzProfile.includes(`(subpath "${realpathSync(p)}")`)).length} roots absent from the profile`);
    for (const [index, root] of denyRoots.entries()) {
      if (!existsSync(root)) continue;
      const resolved = realpathSync(root);
      for (const [kind, path] of [["root", resolved], ["child", `${resolved}/child/canary`]] as const) {
        const probe = `stat -f %N '${path}' >/dev/null && echo OPENED`;
        const open = pzRun(probe, false);
        const denied = pzRun(probe, true);
        check(`§6a deny root ${index + 1} ${kind} opens without the fence`,
          open.includes("OPENED"), open.trim().slice(-90));
        check(`§6a deny root ${index + 1} ${kind} gets EPERM behind the spawned fence`,
          denied.includes("Operation not permitted") && !denied.includes("OPENED"), denied.trim().slice(-90));
      }
    }
    const own = pzRun(`echo x > '${zaiOwn}/fence-canary' && echo WROTE; rm -f '${zaiOwn}/fence-canary'`, true);
    const lane = pzRun(`: < '${realpathSync(REPO)}/.git/HEAD' && echo OPENED`, true);
    check("§6a fence canary: the pane's OWN session dir stays writable and the repo stays readable",
      own.includes("WROTE") && lane.includes("OPENED"), `${own.trim().slice(0, 90)} | ${lane.trim().slice(0, 90)}`);
    rmSync(zaiForeign, { recursive: true, force: true });
  } else {
    // No seatbelt on this host: the wrapper names a pass-through stand-in, so nothing above the
    // marker check measured a fence — said here under its own name instead of reading as green.
    check("§6a fence canary NOT measurable off darwin — the wrapper's pass-through stand-in is in use, not a fence",
      pzSbx !== "/usr/bin/sandbox-exec" && existsSync(pzSbx), pzSbx);
  }
  check("§6a the controlled Pi stand-in really started after the key guard",
    (await waitForPi(`s${HARNESS_SLOT}`)).includes("pi"));
  check("§6a models.json is the exact two-entry catalogue (glm-5.3 + glm-5.3-flash) in the scratch agent directory",
    await waitForModels() === zaiModels, `${zaiAgentDir}/models.json`);
  check("§6a creating the pi-zai catalogue does not create global ~/.pi/agent/models.json",
    !existsSync(globalPiModels), globalPiModels);

  // A second spawn repairs drift back to the exact catalogue rather than appending duplicates.
  writeFileSync(`${zaiAgentDir}/models.json`, "{}\n");
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const pzAgain = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-zai", effort: "max" });
  const pzAgainCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  const pzSid = pzAgainCmd.match(/--session-id ([0-9a-f-]{36})\b/)?.[1] ?? "";
  check("§6a repeated pi-zai spawn idempotently restores the exact catalogue",
    pzAgain.ok && await waitForModels() === zaiModels, `${pzAgain.status} / ${zaiAgentDir}/models.json`);

  // The context hook reads the relocated Pi session and the model-less slot still gets GLM-5.3's
  // exact denominator because the adapter's no-pin default is the literal glm-5.3.
  const zaiSessionDir = `${zaiAgentDir}/sessions/--${realpathSync(REPO).replace(/^\/+/, "").replaceAll("/", "-")}--`;
  mkdirSync(zaiSessionDir, { recursive: true });
  const zaiSession = JSON.stringify({ type: "session", version: 3, id: pzSid,
    timestamp: "2026-08-15T00:00:00.000Z", cwd: realpathSync(REPO) });
  const zaiUsage = JSON.stringify({ type: "message", message: { role: "assistant",
    usage: { input: 1_167, output: 585, cacheRead: 51_712, cacheWrite: 0, reasoning: 116, totalTokens: 53_464 } } });
  const zaiSessionFile = `${zaiSessionDir}/2026-08-15T00-00-00.000Z_${pzSid}.jsonl`;
  writeFileSync(zaiSessionFile, `${zaiSession}\n${zaiUsage}\n`);
  let zaiMeasured: PiFill = null;
  for (let i = 0; i < 20 && zaiMeasured === null; i++) {
    zaiMeasured = await piFill();
    if (zaiMeasured === null) await Bun.sleep(100);
  }
  check("§6a pi-zai context reads its relocated Pi JSONL and uses the exact 1M GLM-5.3 window",
    zaiMeasured?.usedTokens === 52_879 && zaiMeasured.windowTokens === 1_000_000 && zaiMeasured.pct === 5.3,
    JSON.stringify(zaiMeasured));
  rmSync(zaiSessionFile, { force: true });

  // Missing and empty are separate shell predicates. Both must fail as themselves in the pane and
  // leave only the fallback shell — no provider/model fallback and no Pi process to accept input.
  const keyGuardProbe = async (kind: "missing" | "empty"): Promise<void> => {
    await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
    if (kind === "missing") rmSync(zaiKeyFile, { force: true });
    else writeFileSync(zaiKeyFile, "");
    const opened = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-zai" });
    let pane = "";
    for (let i = 0; i < 40; i++) {
      pane = (await tmuxOut("capture-pane", "-p", "-t", `s${HARNESS_SLOT}`)).out;
      if (pane.includes(zaiKeyFile)) break;
      await Bun.sleep(100);
    }
    const comms = await paneComms(`s${HARNESS_SLOT}`);
    check(`§6a ${kind} key file prints a loud path-specific error and never starts Pi`,
      opened.ok && pane.includes("pi-zai: missing or empty Z.ai Coding Plan key file:")
        && pane.includes(zaiKeyFile) && !comms.includes("pi"),
      `${opened.status} / ${pane.slice(-220)} / comms=${comms.join(",")}`);
  };
  await keyGuardProbe("missing");
  await keyGuardProbe("empty");
  writeFileSync(zaiKeyFile, `${zaiStandIn}\n`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6a all pi-zai probes leave global ~/.pi/agent/models.json absent",
    !existsSync(globalPiModels), globalPiModels);

  // --- §6a2 PI-OX: Pi lifecycle, one fixed free OpenCode model, no ambient fallback. ---
  check("§6a2 pi-ox publishes the closed declared capability set",
    piOx?.automatable === true && piOx.allowsLanes === true && piOx.singleton === false
    && piOx.supports.resume === true && piOx.supports.transcript === false
    && piOx.supports.model === true && piOx.supports.effort === false
    && piOx.supports.selfSchedule === false && piOx.supports.container === false
    && JSON.stringify(piOx.effortLevels) === "[]",
    JSON.stringify(piOx));
  check("§6a2 pi-ox's picker note names anonymous auth, mutable terms and missing billing/model fallback",
    /opencode\/x-preview-f-free/.test(piOx?.note ?? "")
      && /anonymous/.test(piOx?.note ?? "") && /no billing credential/.test(piOx?.note ?? "")
      && /no model\/provider fallback/.test(piOx?.note ?? "")
      && /terms may change/.test(piOx?.note ?? ""),
    piOx?.note ?? "missing");

  const oxTaskResponse = await post("/api/tasks", {
    text: "pi-ox-task-spawn-probe", queue: false, harness: "pi-ox", model: "x-preview-f-free",
  });
  const oxTask = (await oxTaskResponse.json()) as
    { task?: { id?: string; spawn?: { harness: string | null; model: string | null; effort: string | null } } };
  const oxTaskId = oxTask.task?.id ?? "";
  check("§6a2 Task.spawn preserves the selected pi-ox triple byte-for-byte",
    oxTaskResponse.ok && JSON.stringify(oxTask.task?.spawn)
      === JSON.stringify({ harness: "pi-ox", model: "x-preview-f-free", effort: null }),
    `${oxTaskResponse.status} / ${JSON.stringify(oxTask.task?.spawn)}`);
  const oxRejectSurfaces = [
    ["open", (body: Record<string, unknown>) => post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, ...body })],
    ["open-worktree", (body: Record<string, unknown>) => post(`/api/slots/${HARNESS_SLOT}/open-worktree`, { repo: REPO, ...body })],
    ["lanes", (body: Record<string, unknown>) => post("/api/lanes", { repo: REPO, ...body })],
    ["dispatch", (body: Record<string, unknown>) => post(`/api/tasks/${oxTaskId}/dispatch`, body)],
  ] as const;
  if (oxTaskId) {
    for (const [surface, call] of oxRejectSurfaces) {
      const wrongModel = await call({ harness: "pi-ox", model: "x-preview-f" });
      check(`§6a2 ${surface} rejects every pi-ox model except exact x-preview-f-free (400)`,
        wrongModel.status === 400, String(wrongModel.status));
      const effort = await call({ harness: "pi-ox", effort: "low" });
      check(`§6a2 ${surface} rejects effort because pi-ox has no effort contract (400)`,
        effort.status === 400, String(effort.status));
    }
  }
  check("§6a2 a native opencode harness id remains rejected rather than becoming a second lifecycle",
    (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "opencode" })).status === 400
      && (await post("/api/tasks", { text: "native-opencode-must-stay-closed", queue: false,
        harness: "opencode" })).status === 400);

  const oxAgentDir = process.env.FLEET_PI_OX_AGENT_DIR ?? "";
  const oxModels = '{"providers":{"opencode":{"baseUrl":"https://opencode.ai/zen/v1","api":"openai-completions","apiKey":"public","models":[{"id":"x-preview-f-free","name":"Ox Alpha Free (Unlimited)","reasoning":true,"input":["text","image"],"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0},"contextWindow":1000000,"maxTokens":131072,"thinkingLevelMap":{"off":null,"minimal":null,"low":"low","medium":null,"high":"high","xhigh":null,"max":"max"},"compat":{"supportsStore":false,"supportsDeveloperRole":false,"maxTokensField":"max_tokens"}}]}}}\n';
  check("§6a2 pi-ox fixture uses a distinct scratch agent directory",
    !!oxAgentDir && realpathSync(oxAgentDir).startsWith(realpathSync(ROOT) + "/")
      && realpathSync(oxAgentDir) !== realpathSync(zaiAgentDir),
    `${oxAgentDir} / ${zaiAgentDir}`);
  const waitForOxModels = async (agentDir: string): Promise<string> => {
    let text = "";
    for (let i = 0; i < 40; i++) {
      try { text = readFileSync(`${agentDir}/models.json`, "utf8"); } catch { text = ""; }
      if (text === oxModels) break;
      await Bun.sleep(100);
    }
    return text;
  };

  // A fresh adapter root has no Pi trust store. Project-local `.pi` settings are sufficient to
  // trigger Pi 0.84's trust selector without --no-approve; two simultaneous opens additionally
  // prove that each UUID-derived home receives an independent atomically replaced catalogue.
  const oxParallelSlot = 11;
  const oxProjectConfigDir = `${REPO}/.pi`;
  check("§6a2 trust-selector fixture starts without a pre-existing project .pi directory",
    !existsSync(oxProjectConfigDir), oxProjectConfigDir);
  mkdirSync(oxProjectConfigDir);
  writeFileSync(`${oxProjectConfigDir}/settings.json`, "{}\n");
  writeFileSync(`${oxAgentDir}/models.json`, "{base-must-not-participate\n");
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  await post(`/api/slots/${oxParallelSlot}/kill`, {});
  const [poOpen, poParallelOpen] = await Promise.all([
    post(`/api/slots/${HARNESS_SLOT}/open`, {
      cwd: REPO, harness: "pi-ox", model: "x-preview-f-free",
    }),
    post(`/api/slots/${oxParallelSlot}/open`, {
      cwd: REPO, harness: "pi-ox", model: "x-preview-f-free",
    }),
  ]);
  const poCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  const poParallelCmd = (await tmuxOut("display-message", "-p", "-t", `s${oxParallelSlot}`, "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  const poSid = poCmd.match(/--session-id ([0-9a-f-]{36})\b/)?.[1] ?? "";
  const poParallelSid = poParallelCmd.match(/--session-id ([0-9a-f-]{36})\b/)?.[1] ?? "";
  const oxSessionAgentDir = `${oxAgentDir}/${poSid}`;
  const oxParallelAgentDir = `${oxAgentDir}/${poParallelSid}`;
  check("§6a2 pi-ox spawn pins Pi provider/model/cycle/key/no-trust/session and its session-local home",
    poOpen.ok && poParallelOpen.ok
      && poCmd.includes("pi --provider opencode --model 'x-preview-f-free' --models opencode/x-preview-f-free --api-key public --no-approve --no-extensions --no-skills --no-prompt-templates --no-themes --verbose")
      && /--session-id [0-9a-f-]{36}\b/.test(poCmd)
      && poCmd.includes(`PI_CODING_AGENT_DIR='${oxSessionAgentDir}'`)
      && !poCmd.includes("--thinking"), poCmd.slice(-520));
  check("§6a2 concurrent pi-ox sessions get distinct UUID-derived homes, never a shared base home",
    poSid !== poParallelSid
      && poParallelCmd.includes(`PI_CODING_AGENT_DIR='${oxParallelAgentDir}'`)
      && !poCmd.includes(`PI_CODING_AGENT_DIR='${oxAgentDir}' pi`)
      && !poParallelCmd.includes(`PI_CODING_AGENT_DIR='${oxAgentDir}' pi`),
    `${oxSessionAgentDir} / ${oxParallelAgentDir}`);
  check("§6a2 both parallel controlled Pi processes start under the pi-ox profile",
    (await waitForPi(`s${HARNESS_SLOT}`)).includes("pi")
      && (await waitForPi(`s${oxParallelSlot}`)).includes("pi"));
  check("§6a2 parallel spawns write an exact independent Canary catalogue in both session homes",
    await waitForOxModels(oxSessionAgentDir) === oxModels
      && await waitForOxModels(oxParallelAgentDir) === oxModels,
    `${oxSessionAgentDir} / ${oxParallelAgentDir}`);
  check("§6a2 session-local atomic replacement leaves no private temporary file in either home",
    [oxSessionAgentDir, oxParallelAgentDir].every((dir) =>
      readdirSync(dir).every((name) => !name.startsWith(".models.json."))),
    `${readdirSync(oxSessionAgentDir).join(",")} / ${readdirSync(oxParallelAgentDir).join(",")}`);
  check("§6a2 malformed base-root catalogue remains unused by both isolated sessions",
    readFileSync(`${oxAgentDir}/models.json`, "utf8") === "{base-must-not-participate\n",
    `${oxAgentDir}/models.json`);
  let oxReadyPane = "";
  for (let i = 0; i < 80; i++) {
    oxReadyPane = (await tmuxOut("capture-pane", "-p", "-t", `s${HARNESS_SLOT}`)).out;
    if (oxReadyPane.includes("Model scope: x-preview-f-free")
      || oxReadyPane.includes("Trust project folder?")) break;
    await Bun.sleep(100);
  }
  check("§6a2 --no-approve bypasses the input-eating project-trust selector and reaches exact model readiness",
    oxReadyPane.includes("Model scope: x-preview-f-free")
      && !oxReadyPane.includes("Trust project folder?"), oxReadyPane.slice(-520));
  rmSync(`${oxProjectConfigDir}/settings.json`, { force: true });
  rmSync(oxProjectConfigDir, { recursive: true, force: true });
  await post(`/api/slots/${oxParallelSlot}/kill`, {});
  check("§6a2 pi-ox never writes the global Pi catalogue",
    !existsSync(globalPiModels), globalPiModels);

  const oxSessionDir = `${oxSessionAgentDir}/sessions/--${realpathSync(REPO).replace(/^\/+/, "").replaceAll("/", "-")}--`;
  mkdirSync(oxSessionDir, { recursive: true });
  const oxSession = JSON.stringify({ type: "session", version: 3, id: poSid,
    timestamp: "2026-08-22T00:00:00.000Z", cwd: realpathSync(REPO) });
  const oxUsage = JSON.stringify({ type: "message", message: { role: "assistant",
    usage: { input: 1_167, output: 585, cacheRead: 51_712, cacheWrite: 0, reasoning: 116, totalTokens: 53_464 } } });
  const oxSessionFile = `${oxSessionDir}/2026-08-22T00-00-00.000Z_${poSid}.jsonl`;
  writeFileSync(oxSessionFile, `${oxSession}\n${oxUsage}\n`);
  let oxMeasured: PiFill = null;
  for (let i = 0; i < 20 && oxMeasured === null; i++) {
    oxMeasured = await piFill();
    if (oxMeasured === null) await Bun.sleep(100);
  }
  check("§6a2 pi-ox reverse-state reads only its relocated Pi JSONL with the exact 1M denominator",
    oxMeasured?.usedTokens === 52_879 && oxMeasured.windowTokens === 1_000_000 && oxMeasured.pct === 5.3,
    JSON.stringify(oxMeasured));
  rmSync(oxSessionFile, { force: true });

  writeFileSync(`${oxSessionAgentDir}/models.json`, "{}\n");
  await post(`/api/slots/${HARNESS_SLOT}/restart`, {});
  const poRestartCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  check("§6a2 restart preserves the exact pi-ox session/profile and repairs catalogue drift",
    poRestartCmd.includes("pi --provider opencode --model 'x-preview-f-free' --models opencode/x-preview-f-free --api-key public --no-approve --no-extensions --no-skills --no-prompt-templates --no-themes --verbose")
      && poRestartCmd.includes(`--session-id ${poSid}`)
      && poRestartCmd.includes(`PI_CODING_AGENT_DIR='${oxSessionAgentDir}'`)
      && await waitForOxModels(oxSessionAgentDir) === oxModels,
    poRestartCmd.slice(-520));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  rmSync(`${oxAgentDir}/models.json`, { force: true });
  if (oxTaskId) await post(`/api/tasks/${oxTaskId}/delete`, {});

  const piProbeOpen = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" });
  check("§6b fixture: a Pi slot is active before the per-slot liveness cache is measured",
    piProbeOpen.ok, String(piProbeOpen.status));

  // --- §6b THE PROBE IS PER SLOT, and this fleet is the sharpest place to prove it: FLEET_CMD is
  // `true`, an UNDECLARED command, so HARNESS_COMMS is empty and every default-adapter slot takes
  // the "unprobed" waiver. A pi slot declares its comms through the ADAPTER, so it is genuinely
  // probed — and since `pi` is not running in that pane, it answers "no-agent". Before the per-slot
  // probe BOTH read "unprobed" (the fleet-wide empty set short-circuits paneAgentAt), so the two
  // rows below cannot both pass unless the resolution really moved from the fleet to the slot.
  // The agent field is a TICK cache, hence the bounded poll rather than a single read.
  // Reads the SETTLED value, not the first non-null one — and that is not belt-and-braces, it is the
  // documented contract: `agent` is a git-TICK cache ("Bericht, nie Gate"), the tick awaits
  // paneAgentAt per slot, and a tick already in flight when a slot is killed and reopened can write
  // the PREVIOUS occupant's answer after the reopen. Measured: this row read `no-agent` (the pi-era
  // value) on a slot that had just become default again. So: wait for a first answer, then let one
  // full tick interval pass and take the second. A stale value cannot survive that; a genuinely
  // wrong one is unaffected, which is what keeps the row a real assertion.
  // Read back off the SAME env the server got (FLEET_GIT_TICK_MS, parsed and floored as server.ts
  // does), so this sleep and the interval it has to out-wait are one number — a harness that sets
  // no knob keeps the production 10 000. Hard-coded until 2026-09-16, which cost 33,0 s per run
  // once the suite started shortening the tick.
  const GIT_TICK_MS = Math.max(1000, Number(process.env.FLEET_GIT_TICK_MS ?? 10_000) | 0);
  const agentOf = async (slot: number): Promise<string | null> => {
    const read = async (): Promise<string | null> => {
      const sx = (await (await get("/api/sessions")).json()) as { slots: { id: number; agent: string | null }[] };
      return sx.slots.find((x) => x.id === slot)?.agent ?? null;
    };
    let first: string | null = null;
    for (let i = 0; i < 60 && first === null; i++) { first = await read(); if (first === null) await Bun.sleep(200); }
    if (first === null) return null;
    await Bun.sleep(GIT_TICK_MS + 1000);
    return await read();
  };
  // The assertion is "genuinely probed", NOT a specific verdict: whether the answer is `alive` or
  // `no-agent` depends on whether `pi` happens to be installed on the machine running the suite,
  // and §6 above says why that must never decide a row. `unprobed` is the only answer that proves
  // the probe did NOT happen — it is what the fleet-wide empty set returns by short-circuit — so
  // "not unprobed" is exactly the discriminator and nothing more.
  const piAgent = await agentOf(HARNESS_SLOT);
  check("§6b a pi slot is genuinely PROBED (adapter-declared comms), not waived like the undeclared FLEET_CMD",
    piAgent !== null && piAgent !== "unprobed", String(piAgent));
  // the counter-case, and it is what makes the row above about the SLOT rather than a blanket
  // strictness: a default-adapter slot on the same fleet still takes the undeclared waiver.
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6b fixture: the same slot reopens on the default harness", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO })).ok);
  const defAgent = await agentOf(HARNESS_SLOT);
  check("§6b ...while a default-adapter slot keeps the unprobed waiver (agent=unprobed)",
    defAgent === "unprobed", String(defAgent));

  // --- §6c THE POLICY, which is a DIFFERENT question from the probe and stays closed by default:
  // may an unattended path drive a foreign-harness slot? FLEET_HARNESS_AUTOMATION is off here (the
  // suite sets nothing), so the answer is no — and the refusal must NAME the harness instead of
  // reporting a generic not-idle/quiet-hours, because being skipped silently was the expensive half
  // of the defect this closes. Asserted through the steward send, the one gated path with a
  // synchronous error body; the auto/watch paths carry the same reason in their lastResult.
  // Driven through a scheduled AUTO rather than a steward send: same choke-point (canDeliver), no
  // steward token or kind vocabulary in the way, and it exercises the REPORTING too — the refusal
  // has to land in the auto's own lastResult, which is where an owner would actually read it.
  // The auto text is a shell no-op (`:`) on purpose: if a gate ever wrongly opened, what reaches
  // the pane is a bare shell, and this must not be the row that runs something there.
  // `inSec: 1`, not 0: a one-shot with inSec < 1 is refused 400 ("one-shot needs inSec ≥ 1"), and
  // the first version of this helper swallowed that refusal and returned null — which read as "the
  // gate did not fire" for BOTH rows, including the counter-case. Hence the check() on creation:
  // a probe that cannot run must fail as itself, never as the thing it was meant to measure.
  const autoResultOn = async (slot: number, label: string): Promise<string | null> => {
    const c = await post(`/api/slots/${slot}/autos`, { text: ": e2e-harness-policy-probe", everySec: null, inSec: 1, idleSec: 0 });
    const cj = (await c.json()) as { auto?: { id?: string }; error?: string };
    check(`§6c fixture: the probe auto was created (${label})`, c.ok && !!cj.auto?.id, `${c.status} ${JSON.stringify(cj)}`);
    const id = cj.auto?.id ?? "";
    if (!id) return null;
    for (let i = 0; i < 80; i++) { // nextAt is +1s and FLEET_AUTOS_TICK_MS is 250 here
      const sx = (await (await get("/api/sessions")).json()) as { autos: { id: string; lastResult: string | null }[] };
      const row = sx.autos.find((a) => a.id === id);
      if (row?.lastResult) return row.lastResult;
      await Bun.sleep(100);
    }
    return null;
  };
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6c fixture: a pi slot for the policy gate", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" })).ok);
  const polRes = await autoResultOn(HARNESS_SLOT, "pi");
  check("§6c an unattended auto into a foreign-harness slot is refused, and the reason NAMES the harness",
    (polRes ?? "").includes("harness pi is not automatable"), String(polRes));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  // the counter-case: the identical auto on a DEFAULT-adapter slot is not refused for that reason.
  // Without it the row above would also pass if every auto were simply broken.
  check("§6c fixture: the same slot on the default harness", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO })).ok);
  const polRes2 = await autoResultOn(HARNESS_SLOT, "default");
  check("§6c ...and a default-adapter slot is never refused for the harness reason",
    polRes2 !== null && !polRes2.includes("not automatable"), String(polRes2));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6c fixture: the pi slot is restored for the recycle check below",
    (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" })).ok);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});

  // ===== §6d THE CONTAINER ADAPTER =====
  // Stage 1: a slot whose agent runs inside a container the OPERATOR started. There is deliberately
  // no docker here and there must never be — a container runtime in the gate is an external
  // dependency no lane has (docs/container.md says the same about ./docker-verify.sh). So what is
  // asserted is the SPAWN STRING tmux was told to run, which is recorded whether or not the
  // container (or docker itself) exists. That splits cleanly: the wrapper is the new code and is
  // pinned here; the agent line inside it is agentCmd's, already proven by every slotCmd row in
  // this suite and in ./e2e-claude-gate.sh.
  const con = cat.harnesses.find((h) => h.id === "container");
  check("§6d the catalogue carries the container adapter", !!con, cat.harnesses.map((h) => h.id).join(","));
  // automatable is published for exactly this: `false` means "no unattended path, flag or not",
  // which is a property an owner cannot otherwise see. The pi row is the counter-case — without it
  // this would also pass if the field were hardcoded false for everyone.
  check("§6d the container adapter is NOT automatable, while pi (owner-decided) is",
    con?.automatable === false && pi?.automatable === true, `${String(con?.automatable)} / ${String(pi?.automatable)}`);
  check("§6d the container adapter declares no transcript and no effort concept",
    con?.supports.transcript === false && con?.supports.effort === false && con?.effortLevels.length === 0,
    JSON.stringify(con?.supports));
  // the note is the ONLY place an owner learns that Fleet does not provide the container. It has to
  // name the very container the spawn line will exec into, or the caveat points at nothing.
  check("§6d the container adapter states at pick time that the owner supplies the container",
    !!con?.note && con.note.includes("'fleet'") && /mount/i.test(con.note), String(con?.note));
  // the note must also name the DAEMON, not just the container: with three docker contexts on this
  // machine, "container 'fleet'" is an ambiguous sentence until the context is part of it.
  check("§6d ...and which docker it means, since a container name alone does not identify one",
    !!con?.note && con.note.includes("docker --context 'default'"), String(con?.note));

  const oc = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container" });
  check("§6d a slot opens on the container harness (200)", oc.ok, String(oc.status));
  const ccmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  // `-w "$PWD"` is the adapter's one hard requirement made mechanical: the worktree must be mounted
  // at the IDENTICAL path. Double quotes, not single — it has to expand in the pane shell.
  // Backslashes stripped first: tmux RE-QUOTES pane_start_command for display, escaping `"` and `$`
  // — so the raw capture reads `-w \"\$PWD\"`. The pi rows above never noticed because a single
  // quote is not escaped by that rendering. Nothing else here contains a backslash.
  const ccmdRaw = ccmd.replaceAll("\\", "");
  check("§6d the container spawn line execs into the named container at the pane's OWN cwd",
    ccmdRaw.includes(`docker --context 'default' exec -it -w "$PWD" 'fleet' `), ccmd.slice(-160));
  // THE ROW THAT MATTERS MOST HERE, and it is not defensive: `docker` resolves through a context,
  // the current one is a user setting, and on the machine this was written the ACTIVE context was
  // the VM running two guest containers with other people's live sessions. An ambient `docker exec`
  // would have landed there. So: the spawn line must never contain a bare `docker exec`.
  check("§6d the spawn line pins the docker CONTEXT — never ambient (the active one is a user setting)",
    !/docker exec/.test(ccmdRaw) && /docker --context '[A-Za-z0-9][A-Za-z0-9_.-]*' exec/.test(ccmdRaw),
    ccmd.slice(-160));
  // ...and what it execs is this fleet's agent line verbatim (FLEET_CMD=true here), not a second
  // implementation of the flag rules. A reimplementation would drift and nothing else would notice.
  check("§6d ...and the command inside the box is agentCmd's, not a restatement",
    ccmd.includes(`'fleet' true;`), ccmd.slice(-160));
  // the pane must survive a missing container: docker prints its error, then the shell catches it.
  check("§6d the container spawn line keeps the `; exec $SHELL` fallback (a missing container must"
    + " leave a live pane, not a dead slot)", /;\s*exec\s+\S+$/.test(ccmd.trim()), ccmd.slice(-80));
  // the transcript degradation, and it bites HARDER here than for pi: the mount is at the identical
  // path, so the projDir slug is identical too — the mtime fallback would hand this slot an earlier
  // HOST-side conversation from the same directory and label it this session's.
  const ctp = (await (await get(`/api/slots/${HARNESS_SLOT}/transcript?after=0`)).json()) as { source: string | null; entries: unknown[] };
  check("§6d a container slot reports NO transcript source (identical mount path makes the mtime fallback WORSE, not better)",
    ctp.source === null && ctp.entries.length === 0, `${String(ctp.source)} / ${ctp.entries.length}`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});

  // --- the rejections. Every one of them is a value that would otherwise reach a tmux shell line.
  const cq = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container", model: "a/b'c" });
  check("§6d a container model carrying a single quote is refused (400)", cq.status === 400, String(cq.status));
  const ce2 = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container", effort: "high" });
  check("§6d the container adapter refuses an effort it has no flag for (400)", ce2.status === 400, String(ce2.status));
  // modelRe: null means it is judged by the SAME charset as a default slot — the widened foreign
  // shapes must still bounce. This is the row that fails if someone "helpfully" widens the adapter.
  for (const bad of ["claude-bridge/claude-haiku-4-5", "sonnet:high", "anthropic/*"]) {
    const r = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container", model: bad });
    check(`§6d the container adapter did not widen the model charset: ${bad} refused (400)`, r.status === 400, String(r.status));
  }

  // ----- §6d2 THE BOX IS PER SLOT -----
  // Which container, and on which docker daemon, used to be two module constants read once from the
  // process env — so changing either meant editing watchdog.sh and restarting, and every container
  // slot on the fleet got the same answer. That is the same KIND of decision as `model`, which has
  // been per-slot since the registry existed, and this section proves the pair moved.
  //
  // Two slots AT ONCE is the load-bearing shape: a single slot carrying a non-default value would
  // pass just as well if the value were still fleet-wide and merely settable at boot. Only two
  // simultaneous panes disagreeing about their box prove the resolution is per session.
  const BOX_SLOT_A = HARNESS_SLOT, BOX_SLOT_B = 11; // 11 is untouched by every other module
  const paneOf = async (id: number) =>
    (await tmuxOut("display-message", "-p", "-t", `s${id}`, "#{pane_start_command}")).out.replaceAll("\\", "");
  const oa = await post(`/api/slots/${BOX_SLOT_A}/open`,
    { cwd: REPO, harness: "container", container: "box-a", containerContext: "ctx-a" });
  const ob = await post(`/api/slots/${BOX_SLOT_B}/open`,
    { cwd: REPO, harness: "container", container: "box-b", containerContext: "ctx-b" });
  check("§6d2 two container slots open with DIFFERENT boxes (200/200)", oa.ok && ob.ok, `${oa.status}/${ob.status}`);
  const pa = await paneOf(BOX_SLOT_A), pb = await paneOf(BOX_SLOT_B);
  check("§6d2 slot A execs into its OWN container on its OWN docker context",
    pa.includes(`docker --context 'ctx-a' exec -it -w "$PWD" 'box-a' `), pa.slice(-160));
  check("§6d2 ...and slot B into a different one, at the same time — the pair is per slot, not per fleet",
    pb.includes(`docker --context 'ctx-b' exec -it -w "$PWD" 'box-b' `) && pa !== pb, pb.slice(-160));
  // the values reach the line SHELL-QUOTED, which is the whole reason the charsets exclude `'`.
  // Asserted on the raw line rather than inferred from the includes above: a future line that
  // interpolated them bare would still contain the substring if the surrounding quotes moved.
  check("§6d2 both values are single-quoted in the spawn line (an unquoted one is a shell injection point)",
    /--context 'ctx-a' exec -it -w "\$PWD" 'box-a'/.test(pa), pa.slice(-160));

  // ...and the row can ANSWER "which VM am I in" — the question that motivated this. RESOLVED, and
  // present even when the slot chose nothing, because a default that sends no field leaves the
  // question exactly as unanswerable as the env did.
  const sb = (await (await get("/api/sessions")).json()) as
    { slots: { id: number; harness?: string; container?: string; containerContext?: string }[] };
  const rowA = sb.slots.find((x) => x.id === BOX_SLOT_A);
  check("§6d2 /api/sessions reports slot A's box and daemon",
    rowA?.container === "box-a" && rowA?.containerContext === "ctx-a", JSON.stringify(rowA));
  // a slot on a harness with no box concept must not carry the fields at all — an owner reading
  // "container: fleet" on a plain claude slot would be reading a fiction
  const rowPlain = sb.slots.find((x) => x.id !== BOX_SLOT_A && x.id !== BOX_SLOT_B && !x.harness && x.container !== undefined);
  check("§6d2 ...and no default-harness slot carries them (they would be a fiction there)",
    rowPlain === undefined, JSON.stringify(rowPlain));

  // the box survives a PANE RESPAWN — it is slot state, not a spawn argument that dies with the
  // first pane. ↻ restart is the cheapest observable form of that (ensureSlot rebuilds the line).
  const rs = await post(`/api/slots/${BOX_SLOT_A}/restart`, {});
  check("§6d2 fixture: the slot restarts (200)", rs.ok, String(rs.status));
  check("§6d2 the respawned pane re-enters the SAME box — a persisted choice, not a spawn-time argument",
    (await paneOf(BOX_SLOT_A)).includes(`docker --context 'ctx-a' exec -it -w "$PWD" 'box-a' `),
    (await paneOf(BOX_SLOT_A)).slice(-160));
  await post(`/api/slots/${BOX_SLOT_B}/kill`, {});

  // --- ABSENCE. The one property the env default existed for, and the one a per-slot field could
  // quietly lose: nothing given must fall to the NEUTRAL default, never to docker's ambient
  // context (on this machine that is the VM holding the guests' live sessions).
  check("§6d2 fixture: a container slot naming neither field", (await post(`/api/slots/${BOX_SLOT_A}/open`,
    { cwd: REPO, harness: "container" })).ok);
  check("§6d2 absence falls back to the fleet default, never to the ambient docker context",
    (await paneOf(BOX_SLOT_A)).includes(`docker --context 'default' exec -it -w "$PWD" 'fleet' `),
    (await paneOf(BOX_SLOT_A)).slice(-160));
  // ...and each half falls back on its own: "the usual box, over in that VM" is a real request,
  // and demanding both would make the common case the awkward one.
  check("§6d2 fixture: a slot naming only the context", (await post(`/api/slots/${BOX_SLOT_A}/open`,
    { cwd: REPO, harness: "container", containerContext: "ctx-only" })).ok);
  check("§6d2 a context without a container keeps the DEFAULT container — the halves are independent",
    (await paneOf(BOX_SLOT_A)).includes(`docker --context 'ctx-only' exec -it -w "$PWD" 'fleet' `),
    (await paneOf(BOX_SLOT_A)).slice(-160));
  await post(`/api/slots/${BOX_SLOT_A}/kill`, {});

  // --- THE REJECTIONS, and they are 400s rather than a silent fold to the default. The env path
  // folds on purpose (one typo in watchdog.sh must not kill every container slot at boot); a spawn
  // request is one owner's one click, and folding it would open a box other than the one they named.
  // The seven metacharacters are the model rows' set: each is a value that would otherwise be
  // interpolated into a single-quoted word on a tmux command line.
  for (const bad of ["a'b", "a b", "a;b", "a$b", "a`b", "a|b", "a&b"]) {
    const rc = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: "container", container: bad });
    check(`§6d2 a container name carrying ${JSON.stringify(bad)} is refused (400)`, rc.status === 400, String(rc.status));
    const rx = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: "container", containerContext: bad });
    check(`§6d2 a docker context carrying ${JSON.stringify(bad)} is refused (400)`, rx.status === 400, String(rx.status));
  }
  // a leading `-` would be read by docker as a FLAG, not a name — the charset requires alphanumeric
  // first, and that is the reason, not tidiness
  const rdash = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: "container", container: "-rm" });
  check("§6d2 a container name starting with a dash is refused (docker would read it as a flag)",
    rdash.status === 400, String(rdash.status));
  // ...and NAMED FOR A HARNESS THAT HAS NO BOX: refused, not dropped. Dropping it is the failure
  // that matters most in this family — the owner would believe the session is contained.
  for (const h of ["claude", "pi", "pi-zai", "pi-ox", "codex"]) {
    const rh = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: h, container: "box-a" });
    check(`§6d2 harness ${h} refuses a container it would never enter (400, never silently dropped)`,
      rh.status === 400, String(rh.status));
  }
  // and the lane route takes the same body — the two spawn paths must not disagree about the box,
  // the way they once could about the model
  const lb = await post(`/api/slots/${BOX_SLOT_A}/open-worktree`, { repo: REPO, harness: "container", container: "a'b" });
  check("§6d2 the lane spawn route validates the box too (400) — not just /open", lb.status === 400, String(lb.status));
  await post(`/api/slots/${BOX_SLOT_A}/kill`, {});

  // ===== §6e THE CODEX ADAPTER =====
  // `@openai/codex`, adapter #4. Same discipline as §6d: what is asserted is the SPAWN STRING tmux
  // was told to run, which is recorded whether or not codex is installed on the machine running the
  // suite — a gate must never depend on a third-party CLI being present.
  const cx = cat.harnesses.find((h) => h.id === "codex");
  check("§6e the catalogue carries the codex adapter", !!cx, cat.harnesses.map((h) => h.id).join(","));
  // automatable flipped TRUE on 2026-08-12, alongside the readiness seam that makes it sound: the
  // measured hazard (an un-authenticated pane sits on its sign-in screen with the node wrapper
  // RUNNING, probes alive, and eats an unattended paste) is now refused at the SCREEN level —
  // canDeliver's blocked-screen gate plus the dispatch tail's bounded accept-marker wait
  // (counterprobes: e2e/tasks.ts f3; source coupling: e2e/pins.ts). The pi row keeps the
  // contrast honest — two adapters, both true, for two different reasons.
  check("§6e the codex adapter is automatable ALONGSIDE its readiness seam, like pi (both true, published)",
    cx?.automatable === true && pi?.automatable === true, `${String(cx?.automatable)} / ${String(pi?.automatable)}`);
  // Resume is identity-safe only beside the lazy rollout-discovery seam pinned in e2e/pins.ts:
  // fresh spawn still pins no id, and recency/--last remain forbidden. Transcript remains false;
  // effort is the fixed config-key capability asserted below.
  check("§6e the codex adapter declares exact-id resume and effort, but no Fleet transcript",
    cx?.supports.transcript === false && cx?.supports.effort === true
    && JSON.stringify(cx?.effortLevels) === JSON.stringify(["low", "medium", "high", "xhigh", "max", "ultra"])
    && cx?.supports.resume === true, JSON.stringify(cx));
  // the note is the only place an owner learns, at pick time, that the login is theirs to do
  check("§6e the codex adapter states at pick time that authentication is the owner's act",
    !!cx?.note && /codex login/.test(cx.note), String(cx?.note));

  const bx = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", effort: "off" });
  check("§6e codex rejects an effort outside its fixed list (400, never config pass-through)",
    bx.status === 400, String(bx.status));
  const ox = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", effort: "ultra" });
  check("§6e a slot opens on the codex harness with a declared effort (200)", ox.ok, String(ox.status));
  const xcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  // THE ROW THAT MATTERS MOST HERE flipped on 2026-08-12: full local access is the owner's
  // decision for normal harnesses, so the spawn line must carry the bypass flag AND the persisted
  // trust entry — without the latter, codex blocks on its own per-path trust prompt (measured:
  // the flag does not cover it) and an unattended brief lands in a dead prompt.
  const xcmdFlat = xcmd.replaceAll("\\", "");
  check("§6e the codex spawn line runs full access and writes the slot's trust entry first",
    xcmdFlat.includes("codex --dangerously-bypass-approvals-and-sandbox")
    && !xcmdFlat.includes("--sandbox workspace-write")
    && xcmdFlat.includes('trust_level = "trusted"'), xcmdFlat.slice(-200));
  // ...and the entry lands under THIS instance's CODEX_HOME (e2e-isolated.sh exports it before its
  // tmux server starts), never in the owner's ~/.codex/config.toml — which had collected 8 502
  // suite temp paths before (docs/messungen/2026-09-14-codex-lane-verdrahtung.md). Keyed on the
  // instance directory's own name, so a /private/var vs /var spelling of the cwd cannot hide it.
  const codexHome = process.env.CODEX_HOME ?? "";
  const instanceKey = `/${ROOT.split("/").filter(Boolean).pop() ?? ""}/`;
  const hasOwn = (p: string): boolean => {
    try { return readFileSync(p, "utf8").split("\n").some((l) => l.startsWith("[projects.") && l.includes(instanceKey)); }
    catch { return false; }
  };
  let scopedTrust = false;
  for (let i = 0; i < 40 && codexHome.includes(instanceKey) && !(scopedTrust = hasOwn(`${codexHome}/config.toml`)); i++) await Bun.sleep(125);
  const leakedTrust = hasOwn(`${process.env.HOME}/.codex/config.toml`);
  check("§6e the codex trust entry lands in the instance's CODEX_HOME, and none of this instance's paths in ~/.codex/config.toml",
    codexHome.includes(instanceKey) && scopedTrust && !leakedTrust,
    `CODEX_HOME=${codexHome || "(unset)"} scoped=${scopedTrust} leaked=${leakedTrust} key=${instanceKey}`);
  // ...and it spawns codex, not the fleet's FLEET_CMD (`true` in this suite)
  check("§6e ...and it spawns codex, not the fleet's FLEET_CMD", /(^|\s|;)codex --dangerously/.test(xcmdFlat), xcmdFlat.slice(-160));
  check("§6e the codex spawn line passes only the fixed update and effort config keys",
    xcmd.includes(" -c check_for_update_on_startup=false")
    && xcmd.includes(" -c model_reasoning_effort='ultra'")
    && (xcmd.match(/(?:^|\s)-c(?:\s|$)/g) ?? []).length === 2, xcmd.slice(-220));
  // no session id anywhere: pinsSession is false, and a pinned-but-unpassed id is the shape that
  // makes a respawn silently resume nothing while the state file claims a conversation
  check("§6e the codex spawn line pins NO session id (`--last` cannot identify this pane)",
    !/--session-id/.test(xcmd), xcmd.slice(-160));
  check("§6e the codex spawn line keeps the `; exec $SHELL` fallback (a missing binary must leave a"
    + " live pane, not a dead slot)", /;\s*exec\s+\S+$/.test(xcmd.trim()), xcmd.slice(-80));
  // the transcript degradation, same bite as pi's: codex writes its rollout files under $CODEX_HOME,
  // so transcriptFile's newest-by-mtime fallback in ~/.claude/projects/<slug>/ must not be consulted.
  const xtp = (await (await get(`/api/slots/${HARNESS_SLOT}/transcript?after=0`)).json()) as { source: string | null; entries: unknown[] };
  check("§6e a codex slot reports NO transcript source (codex writes under $CODEX_HOME, not projDir)",
    xtp.source === null && xtp.entries.length === 0, `${String(xtp.source)} / ${xtp.entries.length}`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});

  // --- the QUOTING, on the shape that makes it load-bearing. The bracket suffix is the context
  // variant (`claude-opus-5[1m]`) and zsh — tmux's default-shell — aborts the whole line on an
  // unmatched glob, pane and all. It is also the SUPERSET proof: a declared foreign harness must
  // never lose a model name a claude fleet would have taken.
  const BR = "codex-probe-5[1m]";
  const obr = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", model: BR });
  check("§6e a codex slot accepts a bracket-suffixed model (the foreign charset is a superset)", obr.ok, String(obr.status));
  const brcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  check("§6e the codex spawn line quotes the bracket model (an unquoted one aborts the pane under zsh)",
    brcmd.includes(`--model '${BR}'`), brcmd.slice(-160));
  // --- §6e-probe: the adapter declares its own comms, so it takes NO "unprobed" waiver. Same
  // discriminator as §6b and for the same reason: whether the verdict is `alive` or `no-agent`
  // depends on whether `codex` happens to be installed on the machine running the suite, and that
  // must never decide a row. `unprobed` is the only answer that proves the probe did not happen —
  // it is what the fleet-wide empty set (FLEET_CMD=true here) returns by short-circuit.
  const cxAgent = await agentOf(HARNESS_SLOT);
  check("§6e a codex slot is genuinely PROBED (adapter-declared comms), never waived like the undeclared FLEET_CMD",
    cxAgent !== null && cxAgent !== "unprobed", String(cxAgent));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  // --- the rejections. Every value here would otherwise reach a tmux shell line.
  // codex DOES take an effort now (`-c model_reasoning_effort=<level>`, 8e154dd), so the old row here
  // — "it refuses an effort it has no flag for" — stopped describing the adapter and started
  // describing history. The block's own purpose is the one that survives: every value in it would
  // otherwise reach a tmux shell line, so what belongs here is not "any effort" but an effort that
  // is shell-dangerous. The fixed-list rejection has its own row at §6e above; this one proves the
  // list is a MEMBERSHIP test rather than a charset filter that a clever value could satisfy.
  const xe = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", effort: "high; id" });
  check("§6e the codex adapter refuses a shell-dangerous effort, rather than dropping it (400)",
    xe.status === 400, String(xe.status));

  // --- and the harness dies with the session: a recycled slot must not inherit the binary the
  // previous occupant ran. Same rule (and same reason) as the selfToken rotation in §3.
  check("§6 fixture: the slot is recycled with no harness named", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO })).ok);
  const rcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  check("§6 a recycled slot is spawned by the DEFAULT harness, never the previous occupant's",
    !rcmd.includes("pi --session-id") && !rcmd.includes("--thinking") && !rcmd.includes("docker exec")
    // PATH may legitimately contain an installed package directory named `codex`; only an
    // executable command token says the recycled pane actually inherited that harness.
    && !/(^|[; ])codex(?: |$)/.test(rcmd.replaceAll("\\", "")), rcmd.slice(-160));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
}
