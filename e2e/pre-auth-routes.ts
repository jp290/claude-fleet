// DIE GEPRÜFTE PRE-AUTH-LISTE UND IHR LESER, ohne Laufzeit (W3 Auftrag 13): bisher standen sie in e2e/security.ts, das beim Import den Harness lädt
// (fleet.json, ein Server) und darum nur in der vollen Suite auf dem Helfer lief — ein Branch mit einer neuen Self-Route ohne Eintrag sah lokal grün aus.
// Hier sind sie rein: e2e/security.ts liest sie weiter für §1, und server/pre-auth-routes.test.ts vergleicht im Job `local` des Merge-Checks (bun test
// ./server) die Routen vor dem Owner-Tor in server.ts mit dieser Liste. Ein neuer Eintrag ist weiter eine Sicherheitsentscheidung — hier steht er.

// --- §1 fixtures: the reviewed pre-auth allowlist -------------------------------------------
// Every entry is a route reachable WITHOUT the owner token. Adding one is a security decision;
// this list is where that decision is recorded. `=` is an exact pathname, `~` a regex.
export const PRE_AUTH_ROUTES: readonly string[] = [
  '= /',                  // login (?token=, tokenGate'd) AND the share-host landing page
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
  // DELETE derives the owning slot from the same live self principal; foreign autos stay 409.
  String.raw`~ /^\/api\/self\/autos\/([a-z0-9]+)$/`,
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
  // Self credential via resolveSelfPrincipal, read-only and slot-bound; each context borrow is logged.
  String.raw`~ /^\/api\/self\/context\/([^/]+)$/`,
  // Program-scoped context pointers (2026-09-15, Task b28b9d89). Writes ONE field of ONE Program: the
  // Program the caller is bound MAIN of (boundProgramForMain), never one a body names; a lane 409s.
  // It stores tracked path/anchor pointers only, validated against the caller's own integration HEAD,
  // and starts, dispatches and writes into no pane.
  '= /api/self/program-context-packs',
  // The Program's living text, MAIN half (2026-10-07, docs/self-api.md §program-text). Two POST doors
  // for the bound MAIN of an active Program only (boundProgramForMain; a lane and an unbound session
  // 409; the occupant is re-resolved after the body await): `decisions` APPENDS one string to the
  // Program's decisions, `text-proposals` stores a PROPOSAL that changes no valid text — only the
  // owner's /api/programs/:id/text-proposals applies it. No pane is written, nothing starts.
  String.raw`~ /^\/api\/self\/program-(decisions|text-proposals)$/`,
  // The konzept door (Program Konzeptgedaechtnis 31aa88ea, Karte 1). Reads and APPENDS to a private
  // ledger under FLEET_KONZEPT_ROOT, open to a lane and to the bound MAIN of an active Program; every
  // other session 409s. What bounds it: the konzept id is ^k-[a-z0-9-]{1,64}$ (no path segment reaches
  // outside the root), `actor` is the resolved Principal and `kontext` is built from the credential and
  // its binding — a body naming either is a 400 — and the only file it READS beyond its two ledgers is
  // the `v<N>.md` the writer placed under that konzept, to hash it. It sends into no pane, starts,
  // releases, lands and deploys nothing.
  String.raw`~ /^\/api\/self\/konzepte\/([^/]+)\/(.+)$/`,
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
  // FERNPOST (2026-10-29): the door a NEIGHBOUR fleet writes through, with a badge of its own — never the owner token or a
  // self token (server/nachbarn.ts refuses both as a badge). What bounds it: without ~/.config/claude-fleet/nachbarn.json there
  // is no neighbour and every call is a 401; the badge is compared (timingSafeEqual) BEFORE a byte of the body is read, a wrong
  // one costs a fixed pause and counts per source; a known neighbour may only file one text message from a slot pair the
  // receiving owner listed under `erlaubt`, into the Postfach of a plain session. It starts, lands and deploys nothing.
  '= /api/fleet-nachbar/messages',
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
  // The deliberate answer to Claude Code's permission question (2026-10-22, server.ts#beantworteRueckfrage). Session
  // principal only (no steward, no helper; unknown credential 401 after 400 ms), and only the seat's opener or the
  // Orchestratorin (any seat, Owner 30.10.) — every other session 409. GET reads the dialog whole; POST takes a
  // closed three-field body and types exactly one key ("1" or Escape), only while the dialog with that GET's kennung
  // is on screen and the pane is not in copy mode. It grants nothing else: no land, dispatch, auto or Watch.
  '= /api/self/rueckfrage',
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
  '= /api/self/messages',
  String.raw`~ /^\/api\/self\/messages\/([0-9a-f]{24})\/read$/`,
  // EDGES (server/kanten.ts, server.ts#kantenTuer): the Orchestratorin lets two sessions write each other directly until a
  // time. POST and DELETE answer only her (messageSenderFor gives her role address, every other caller gets 403); both ends
  // must be plain sessions, never a lane, a MAIN or herself. An edge frees only the send check in sendMessageFor, nothing
  // else: no read of foreign mail, no reply right, no land, deploy or owner authority. GET shows a session only its own edges.
  String.raw`~ /^\/api\/self\/kanten(?:\/([0-9a-f]{16}))?$/`,
  // A SESSION LANDS ITS OWN BRANCH (rechts-7 P5, owner Z132 18.10.: „[Zitat entfernt]“; Mangel 121) — it moves the integration branch. What bounds it: the principal is the token's slot, and repo and
  // branch come from that session's own checkout (ownBranchOf: its linked worktree of a workplace repo; a main checkout, a
  // detached head or no repo is a 404); a body naming another branch is a 403. The land runs the owner door's core
  // (server/branch-land.ts#landCharge) with `own`: a board branch only, the owner's „[Zitat entfernt]“ on exactly its tip (a commit
  // after it is a 409), a repo with a merge check and that check usable for this tip on the current main; `unchecked` is
  // not reachable from here. Its side effects are the owner door's: the check after the land is scheduled. It writes into
  // no pane and deploys nothing.
  '= /api/self/branches/land',
  // A SESSION AND ITS REPO'S CHECK (added 2026-10-24, branch/fremdes-repo-rund; server/pruefbefehl.ts). Bounded like the
  // land above: the principal is the token's slot, repo and branch come from its own checkout (ownBranchOf / branchRepoOf).
  // /api/self/branch only READS its own branch as the board shows it. /api/self/branches/check starts the check of its own
  // branch only (another branch in the body is a 403), with the command the OWNER set — a session can't name one here.
  // /api/self/repo-check only PROPOSES a command: it is stored beside the owner's, runs nowhere, and becomes the repo's
  // check only through the owner door POST /api/repo-check behind the owner gate; a repo with its own ci/merge-check.ts is a 409.
  '= /api/self/branch',
  '= /api/self/branches/check',
  '= /api/self/repo-check',
  // The tip's audit without the owner token (bau/ohne-owner-token Schnitt 1): POST /api/repos/audit-tip's verb for the
  // Orchestratorin and a bound Program-MAIN (server.ts#selfDoorRoleOf), every other session 409. It queues the audit of
  // the server repo's integration tip at most once and moves no ref; the audit row names the role and slot that asked.
  '= /api/self/repos/audit-tip',
  // The land sensor without the owner token (Schnitt 2): GET /api/slots/:id/merge for every lane in one read-only answer,
  // for the same two roles. The Orchestratorin reads the fleet, a bound MAIN only the lanes of its own repo (same git
  // common dir); every other session 409. It writes nothing.
  '= /api/self/merges',
  // The Orchestratorin judges a red audit without the owner token (Schnitt 3): the owner door's writer, `by` names her
  // occupation (slot + openedAt). A bound MAIN and every other session 409; nothing reaches POSTLAND_AUDIT_FILE.
  '= /api/self/post-land-audits/adjudicate',
  // The board's branches without the owner token (Schnitt 6): the owner doors' cores (createBoardBranch, openBoardBranch)
  // for a non-lane session but the steward, in its own repo only, never under a role label; the caller becomes the
  // branch's opener (K13 postfach pair). It creates a worktree and opens one roleless session; it lands and deploys nothing.
  '= /api/self/branches',
  '= /api/self/branches/open',
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
  // The batch sibling is the same MAIN verdict repeated under one request. resolvePrincipal
  // requires the self token (otherwise 401); a lane other than the steward is 409, and the handler
  // requires a live bound MAIN of the report's own Program. It prechecks every landed, ended
  // needs-main/complete row before calling decideFleetReport for each ordinary verdict; no body
  // field grants a foreign Program, Owner, land, deploy or Task.status authority.
  '= /api/self/fleet-report/batch',
  // The owner-facing twin of the fleet-report pair above, and it is the QUIETEST entry on this list: it writes
  // nothing into any pane and reaches no foreign slot. POST is non-lane-only AND requires the
  // caller to be the current bound MAIN of an active program (programId is derived from that
  // binding, never read from the body); GET returns only rows carrying the caller's exact occupant
  // triple. The answer side writes a Program-inbox pointer; its scoped Orchestratorin exception
  // is listed separately below. Refuse and escalate remain behind the owner gate.
  '= /api/self/attention',
  // POST only: the self principal must be the unique live non-lane Orchestratorin selected by
  // deliveryRecipient({kind:"orchestrator"}), and the row must have stage:"orchestrator".
  // The answer records by:"orchestrator" with her slot and writes one Program-inbox pointer.
  // Lane, other session and replaced-occupant tokens are refused; Owner-Bearer keeps by:„[Zitat entfernt]“.
  String.raw`~ /^\/api\/attention\/([0-9a-f]{24})\/answer$/`,
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
  // Bound MAIN only: own Program + checkout; comment appends, withdraw requires pending + reason.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)$/`,
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/comment$/`,
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/withdraw$/`,
  // REVIEW PARK (2026-09-25, server.ts#reviewParkTaskForMain): the exact bound Program-MAIN may
  // retire one live lane of its own Program into a review candidate. The task comes from the path,
  // note/hours are the closed body, and mintReviewCandidate keeps the owner's admission rules.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/park$/`,
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/release$/`,
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/spawn$/`,
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
  // Its body is CLOSED to the land switches (server.ts#landSwitchesFrom) — the program comes from the
  // binding, the lane from the row, the repo from the checkout, the candidate from the lane's HEAD,
  // and a switch only says how that candidate lands —, it starts nothing unattended, it writes into no
  // pane and it reaches no foreign slot. The land itself runs through the SAME mergeJob the owner
  // route calls — there is no second merge implementation.
  String.raw`~ /^\/api\/self\/tasks\/([a-z0-9]+)\/land$/`,
  '~ /^\\/api\\/self\\/events\\/([a-z0-9]+)\\/ack$/', // same slot+session credential; idempotent receipt only
  '~ /^\\/api\\/self\\/events\\/([a-z0-9]+)$/', // same credential, READ only: the receiver's own event + its rendered text (c14fcd75); another occupant 409
  '= /api/self/succeed',  // one successor for the caller's own session, never a named target. For a
  // MAIN: a free slot in the same cwd, caller retires on grace; the committed HANDOFF gate still
  // holds the unbound and game-maker rails, while a Standard Program-MAIN hands over the
  // Program's own measured record in the founding brief instead (2026-09-08). For a LANE (2026-09-12,
  // succeedLane): a fresh session in the SAME slot on the SAME worktree and branch, which is why it
  // is no longer a 409 here — what bounds it is that it moves NOTHING: no land, no merge (a running
  // one refuses it), no second worktree, no queue-row status change, no repo it is not already in,
  // and a tree with one uncommitted or untracked line refuses it outright. The steward stays 409 on
  // both doors and a lane stays 409 on /retire.
  '= /api/self/handover', // added 2026-10-07: the caller's OWN standing handover (intent OR pointer,
  // the succeed body's checks) on its own slot row, bound to its occupation. Writes no pane, ends
  // nothing, names no target; the owner's door POST /api/slots/:id/succeed is the only reader that
  // acts on it, and that door sits behind the owner gate. Game-maker/steward 409. A LANE writes its
  // stand here since 2026-10-08 (intent only, row 14dd9154): read by its own MAIN in
  // program-execution, no door acts on it — the owner door still refuses a lane.
  '= /api/self/weglassen', // added 2026-10-24 (branch/eigenes-setup): what the caller's OWN next start leaves out of the
  // user's ~/.claude (server/weglassen.ts), on its own slot row, bound to its occupation (409 for another occupant).
  // It can only take away from its own start line, never add a right, names no other slot and acts on no pane now.
  '= /api/self/packs', // added 2026-10-24 (branch/selbst-einrichten): writes a private context pack (server/eigene-packs.ts) into
  // Fleet's state — text only (id, useWhen, text; any other field 400), never a register id, reaches no seat until one chooses it.
  // THE SETUP DOORS (direction step 4, server/setup-tueren.ts): save, export and import a setup with the self token, each behind
  // verlangeRecht (setup.save / setup.export / setup.import — no role bundle carries them) and then through the SAME routes the
  // owner gate dispatches (agentenRoute, setupRoute), so the exported file and its checks are the same whoever asks. vonSlot at
  // the save door names only the caller's own slot; the export never carries personal text (an empty place instead); an import
  // caps the file's rights (rechteGedeckelt), never starts in bypass, and its roles wait for the owner's k15 confirmation.
  '= /api/self/agenten',
  String.raw`~ /^\/api\/self\/agenten\/([^/]+)\/kopie$/`,
  '= /api/self/setups/import',
  // The constellation a seat leads (F1, server/konstellation-aus-sitzen.ts): behind verlangeRecht `setup.save` (no role bundle), it saves the caller's own seat and the
  // live seats it opened as a saved constellation; the folders travel as empty places, rights capped, never bypass, no Fleet role. GET …/setups/<id>/datei exports it.
  '= /api/self/konstellationen',
  // F6: GET /api/self/constellation — what a seat may see of the constellation it stands in (the seats it may write to and the positions of its saved constellation), never
  // its own stones; slot-bound, read-only, no right; a seat outside gets an empty list.
  '= /api/self/constellation',
  // C1: GET /api/self/overview — the overview for agents (server/lagebild.ts): the seats of the caller's line (the Orchestratorin every seat, the
  // owner's own outside her line as slot and state only), each with its state, opener, what it waits for, context fill and cache, every field with its
  // source; no text of a message, pane, transcript or pack. Slot-bound, read-only, no right, no pane read.
  '= /api/self/overview',
  // W3a: GET /api/self/harnesses — the harness catalogue GET /api/harnesses gives the owner's picker (server.ts#harnessKatalog), for a seat that picks harness and
  // model of the seats it opens; slot-bound, read-only, no right, 401 without a live seat's self token.
  '= /api/self/harnesses',
  // Sitze in einem Ordner öffnen und Rollen bilden (Richtung Schritt 5, server/selbst-sitze.ts): hinter verlangeRecht (seat.open, role.form,
  // setup.export) mit dem Self-Token; die Öffnen-Tür geht durch den Weg der Owner-Tür und durch kindNieWeiter, eine Rolle liegt als SetupRole auf dem Regal.
  '= /api/self/seats/open',
  String.raw`~ /^\/api\/self\/seats\/(\d+)\/end$/`,   // the opener ends a child it opened (seat.open; server/selbst-sitze.ts#kindBeenden)
  String.raw`~ /^\/api\/self\/seats\/(\d+)\/passt$/`, // the opener gives „passt“ on its child's tip (W3b; right branch.passt, a child it opened, the tip it names)
  '= /api/self/testinstanz', // a seat brings up a test instance for acceptance from its own tree (W3b; self token, itself, a child or a sibling; serveTestinstanz)
  '= /api/self/roles',
  String.raw`~ /^\/api\/self\/roles\/([^/]+)\/datei$/`,
  String.raw`~ /^\/api\/self\/setups\/([^/]+)\/datei$/`,
  '= /api/self/einrichten', // added 2026-10-24 (branch/selbst-einrichten): what the caller's OWN successor gets on top — a
  // purpose and context packs, text only (server/selbst-einrichten.ts; rights, model, hooks, MCP have no field and 400). Its own
  // slot row, bound to its occupation; a seat without a standing role, claude only; in force at its succession, acts on no pane.
  '= /api/self/retire',   // non-lane only: immediately retire the token's own slot after reporting
  '= /api/self/drift',    // same credential, read-only: the lane's own drift view (slot-bound)
  '= /api/self/gate',     // same credential, read-only: the live land-gate facts (env-derived)
  '= /api/self/criterion', // same credential: the lane's PROPOSED done-criterion (slot-bound, owner confirms)
  '= /api/self/verify-intent', // same credential: the lane's advisory gate-phase report (slot-bound)
  // The fifth lane-only pair, added 2026-08-26 with LANE SUITES IN THE REMOTE HELPER PORTAL. On
  // this list for the same structural reason as every neighbour — the exact self principal IS the
  // boundary — and what bounds it is that OFFERING IS NOT RUNNING: no suite is spawned, no queue is
  // filled, the land gate is untouched, and a remote verdict gates nothing (tier 2 gates nothing).
  // Lane-only in the drift/gate/criterion direction: the answer is about the caller's OWN working
  // tree. The repo, branch, cwd and slot all come from the token's own row, so nothing can nominate
  // WHICH tree is bundled, and the command stays `./e2e-isolated.sh`. The offer door reads ONE
  // optional field since 2026-09-28, `modules` — the narrowed preview — and it is a list of WORDS
  // FROM A CLOSED TABLE, never env and never argv: suite-modules.ts#moduleListFrom refuses anything
  // but an array of known check-module names (400, no row) before the idempotent branch, the daemon
  // re-checks the charset and joins them into FLEET_E2E_MODULES alone (modulesEnv), and a narrowed
  // job is shown and given only to a device declaring `lane-suite-modules` (e2e/pins.ts §S10c,
  // e2e/lane-suite.ts LS.mod). The withdraw door reads the single boolean `abandon`, one open offer
  // per slot, it writes into no pane and reaches no foreign slot. What it exposes to the helper
  // principal is one git bundle of the caller's own worktree — through the EXISTING
  // /api/helper/bundle route, which is why the helper perimeter below is unchanged by this feature.
  '= /api/self/suite-offer',
  '= /api/self/suite-offer/withdraw',
  // …and the MAIN's proxy door onto the SAME anlage (2026-09-29, server.ts#laneSuiteOfferDoor): a
  // bound Program-MAIN offers, or reads, the preview of one of its OWN program's live lanes. Same
  // session principal and flat 401; then 409 for a lane as caller, 409 for a session without a
  // Program binding (boundProgramForMain), 409 unless the target slot is a live lane whose
  // programId IS the caller's program, 404 for a slot that does not exist. The body is the lane
  // door's — `modules` alone, validated before any row exists — and the tree, repo, branch, cwd,
  // slot and openedAt come from the TARGET lane's row, never from the caller: a MAIN can choose
  // WHICH of its lanes, never WHICH tree. It starts nothing, writes into no pane, and the job it
  // mints is the lane's own (one open offer per slot, whichever door minted it).
  String.raw`~ /^\/api\/self\/lanes\/(\d+)\/suite-offer$/`,
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
  //     `cmdjob` lane writes exactly such a script and runs it through), and the four `./e2e-*.sh`
  //     entries are wrappers out of the same bundle. Submitted repo code has
  //     always been what `suiteCmd` executes on the portal path; nothing here narrows or widens
  //     that, only the sentence written about it. 2026-09-28 added the two land-gate suites
  //     (`./e2e-claude-gate.sh`, `./e2e-clean-review.sh`) as keys — eight in all — and left the ban
  //     untouched: `e2e-claude-gate.sh` is one token, and `./e2e-claude-gate.sh && claude` is still
  //     refused on its `claude` (e2e/pins.ts §S10c; the `claude` that suite starts is its own
  //     compiled stand-in, first on its server's PATH);
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
  //     and the current bound MAIN of that lane's program (exact slot + openedAt on both sides,
  //     read only; 404 for anyone else's token), and the bundle goes out through the EXISTING
  //     /api/helper/bundle route, so the helper perimeter is unchanged by this feature too.
  '= /api/self/jobs',
  String.raw`~ /^\/api\/self\/jobs\/([0-9a-f]{12})$/`,
  // …and its way back out (2026-09-29, the command-job twin of /api/self/suite-offer/withdraw): the
  // same session principal and flat 401, and it answers the OFFERING session alone (slot AND
  // openedAt, 409 for any other live session). It changes one job of that session from open or
  // claimed to withdrawn/abandoned; a claimed job needs an explicit `{"abandon":true}`. It starts
  // nothing, writes into no pane and reaches no foreign slot.
  String.raw`~ /^\/api\/self\/jobs\/([0-9a-f]{12})\/withdraw$/`,
  // The handler sits before the steward interceptor only so a steward credential meets the same
  // tokenGate 401 as any other non-owner credential. Every matching route calls tokenGate inline
  // before the owner handler; the regex is pinned here as an explicitly reviewed pre-auth shape.
  // `promotion` joined the verb set 2026-08-23. It is the OWNER's grant of the self-land permission
  // a bound Program-MAIN consumes, and it is on the owner side of this line precisely so that a
  // session can never widen its own authority: the record is written by this route alone (pinned in
  // e2e/pins.ts), and a self token meets the same tokenGate 401 here as any other non-owner
  // credential.
  // `dispatch` joined this alternation 2026-09-05 with the program-scoped dispatch door. REVIEWED,
  // not merely widened: the route is inside the block whose FIRST statement is the owner tokenGate,
  // exactly like its four neighbours here, so it is pre-auth in position and owner-only in effect.
  // `release` joined 2026-09-14 (Schnitt 3) with the release-policy door, for `dispatch`'s reason:
  // it widens WHICH rows start unattended, so it is the owner's alone — written by this route only
  // (pinned in e2e/pins.ts), tokenGate first, and a self token meets the same 401 here.
  // `release-valid` joined 2026-09-15 (Freigabe-Schnitt B) with the owner's collective release: it
  // moves named rows pending→queued, the owner's ▸ queue over a previewed selection, so it is owner
  // side for `release`'s reason — tokenGate first, a MAIN token 401 (e2e/programs.ts release-valid (2)).
  // `text-proposals` joined 2026-10-07 with the Program's living text: it APPLIES a MAIN's proposed
  // intent/successCriterion/nonGoals or rejects it — an owner confirmation by definition, so tokenGate
  // first and a MAIN token 401 (e2e/programs.ts living text (6)).
  String.raw`~ /^\/api\/programs(?:\/[^/]+\/(?:confirm|activate|complete|discard|bootstrap-main|promotion|profile|dispatch|release|release-valid|text-proposals))?$/`,


  '= /favicon.ico',
  String.raw`~ /^\/(s\/[a-z0-9]+(\/(auth|info|send|diff|comments|brief|summary|transcript))?|ws-share\/[a-z0-9]+)$/`,
  String.raw`~ /^\/s\/([a-z0-9]+)\/(auth|info|send|diff|comments|brief|summary|transcript)$/`,
  String.raw`~ /^\/s\/[a-z0-9]+$/`,
  String.raw`~ /^\/ws-share\/([a-z0-9]+)$/`,
];

/** Die Pre-Auth-Region von server.ts: von `async fetch(req, server) {` bis zur Zeile des Owner-Tors („[Zitat entfernt]“). Leer,
 *  wenn ein Anker fehlt — dann ist jeder Vergleich leer, und die Prüfungen sagen es (security.ts §1, pre-auth-routes.test.ts). */
export function preAuthRegion(src: string): string {
  const start = src.indexOf("async fetch(req, server) {"), gate = src.indexOf("everything below carries authority");
  return start < 0 || gate <= start ? "" : src.slice(start, gate);
}

export const LITERAL = /url\.pathname === "([^"]+)"/g;
export const REGEXP = /(\/\^[^\n]*?\/)\.(?:exec|test)\(url\.pathname\)/g;
export const routeSet = (src: string): string[] => [...new Set([
  ...[...src.matchAll(LITERAL)].map((m) => `= ${m[1]}`),
  ...[...src.matchAll(REGEXP)].map((m) => `~ ${m[1]}`),
])].sort();

// DER STRENGE LESER (W3 Auftrag 15, F2; bis dahin in e2e/security.ts und damit nur auf dem Helfer): jede Form eines Pfad-Lesens, die routeSet nicht
// liest, wird genannt. pre-auth-routes.test.ts fährt ihn lokal über die echte Region und über je eine Probe der Idiome, die der Prüfer fand.
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
//   · the door-label form below: `verlangeRecht(..., `${req.method} ${url.pathname}`)` names the
//     refusal a right check answers with. It READS the path but routes nothing (the route already
//     matched above it), so it is consumed like the STATIC lookup: recognized, yet never added to
//     routeSet. Kept as its own spelling so the pin does not have to accept an arbitrary
//     template-string read.
export const RIGHT_DOOR_LABEL = /verlangeRecht\([^;\n]*url\.pathname/g;
//   · the share-host whitelist is consumed only as this ONE list, word for word (W3 Auftrag 15, F2): before, any `[…].includes(url.pathname)`
//     passed, so a new pre-auth route spelled `["/x"].includes(url.pathname)` stayed green. A changed list is a security decision and turns the
//     check red until this constant names it.
export const SHARE_HOST_PUBLIC = '["/share.js", "/xterm.css", "/icon.svg", "/icon-180.png", "/favicon.ico"].includes(url.pathname)';
const exakt = (text: string): RegExp => new RegExp(text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "g");
export const RECOGNIZED = [LITERAL, REGEXP, exakt(SHARE_HOST_PUBLIC), /STATIC\[url\.pathname\]/g, RIGHT_DOOR_LABEL];
export const TOKENLESS = /\burl\s*\[|\}\s*=\s*url\b|(?<!new URL\()\breq\.url\b/;
export const unrecognized = (src: string): string[] =>
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
export const PATH_ALIAS_BINDING = /(?:const|let|var)\s*(?:\{[^}]*\bpathname\b[^}]*\}\s*=|[A-Za-z_$][\w$]*\s*=\s*url\.pathname)/g;
export const PATH_ALIAS_USE = /(?<!\.)\bpathname\b\s*(?:===|!==)|\.(?:exec|test)\(\s*(?!url\.pathname\s*\))[\w$.]*[Pp]ath[\w$]*\s*\)/g;
export const pathAliases = (src: string): string[] => [
  ...[...src.matchAll(PATH_ALIAS_BINDING)].map((m) => m[0].trim()),
  ...[...src.matchAll(PATH_ALIAS_USE)].map((m) => m[0].trim()),
];
