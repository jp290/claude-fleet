# Fleet's doors

Read this when you work through Fleet with your self token: before you look for a route, open a seat, hand over, or
wonder which door your role opens.

Every door below takes **your self token**, sent as `x-fleet-self-token: $FLEET_SELF_TOKEN` to `$FLEET_SELF_URL`. The
token names your slot and its current occupant; it never names another slot. Never print it, and never put it in a URL.
The owner's key does not replace it here: a self door is a session's own door. What a door *also* requires is written
beside it, because that is what the code checks today.

An **orchestrator** is exactly this: a person's own agent with this pack, its rights and a direction. Fleet's own
orchestrator is one with Fleet's direction; another person's orchestrator is one with theirs. Today this pack alone
does not give you the Orchestratorin's role: granting or closing an edge (`POST /api/self/kanten` ·
`DELETE /api/self/kanten/<id>`), adjudicating a red post-land audit (`POST /api/self/post-land-audits/adjudicate`) and queueing a tip's audit (`POST /api/self/repos/audit-tip`,
read through `GET /api/self/merges`) still ask for that role, and the role keeps them (owner 2026-10-26). A seat with
this pack and a direction is an orchestrator in the direction's sense; it is not appointed to a role, and it takes
nothing from one.

## If you are a seat without a standing role

You can always: read and write your own handover, succeed or retire, open and land your own branch, propose its check,
borrow a context pack, write a pack of your own, set what your successor gets, schedule an auto, read the events and
messages addressed to you, see the edges you are in, and hand a tree and a command to the helper.

You cannot fill the queue, judge a fleet report, release or land a Program row, read a Program inbox, grant an edge,
or adjudicate an audit. Those need a lane, a bound MAIN or the Orchestratorin, named below. A refusal is a 409 with
the reason, never a silent drop.

## The doors every seat has

| Door | What it is for | What opens it today |
| --- | --- | --- |
| `POST /api/self/handover` | Keep the standing handover your successor and the owner door read. | self token; a lane writes its stand, the steward never |
| `POST /api/self/succeed` | Start your successor in your place with your handover. | self token; a lane uses its own baton rail, the steward never |
| `POST /api/self/retire` | End your own session. | self token; not the steward |
| `GET /api/self/messages` · `POST /api/self/messages` · `POST /api/self/messages/<id>/read` | Read your addressed mail, send a message, mark one read. | self token; the sender comes from your binding, and a body never names a principal |
| `GET /api/self/events/<id>` · `POST /api/self/events/<id>/ack` | Read the event addressed to you, or acknowledge it. | self token, this occupant's events only |
| `GET /api/self/kanten` | See the edges you are in. | self token |
| `POST /api/self/watch` | Subscribe your own slot to one server-generated completion fact. | self token, non-lane (the steward may watch) |
| `POST /api/self/autos` · `DELETE /api/self/autos/<id>` | Schedule one prompt for yourself, or take your schedule back. | self token, for your own slot only |
| `GET /api/self/branch` · `POST /api/self/branches/check` · `POST /api/self/repo-check` | Read your own branch and its check, run the check, propose the repo's command. | self token, own branch and own repo only; the check never runs as a repair (`repair: true` answers 409 — a land on a red main is the owner's door) |
| `POST /api/self/branches/land` | Land your own branch after the person's "Looks good" and a green check. | self token, own branch; both conditions are checked |
| `POST /api/self/branches` · `POST /api/self/branches/open` | Open a board branch, or a session on one. | self token, non-lane, non-steward, in your own repo; the child is never wider than you |
| `POST /api/self/packs` | Write a private context pack of your own, valid at once. | self token; an id from Fleet's register is refused, and the owner's private pack is the Orchestratorin's |
| `GET /api/self/einrichten` · `POST /api/self/einrichten` | Set or read the purpose and packs your successor gets on top of your start. | self token, a seat without a standing role; text only, on every harness |
| `POST /api/self/weglassen` | Leave part of your own `~/.claude` out of your next start. | self token, Claude Code only, a seat of its own (never a lane) |
| `GET /api/self/context/<id>` | Borrow one context pack's text and its source at HEAD. | self token; a seat borrows Fleet's library, a role borrows its own plan |
| `GET /api/self/konzepte/<konzept>/<op>` · `POST /api/self/konzepte/<konzept>/<op>` | Read a concept's versions and annotations, or annotate it. | self token; publishing a version needs a lane or a bound MAIN |
| `GET /api/self/konzepte/k-owner-korrekturen/leseansicht` | Read the owner's corrections as they apply to your binding. | self token; a lane, MAIN, orchestrator or a seat in Fleet's repo |
| `POST /api/self/jobs` · `GET /api/self/jobs/<id>` · `POST /api/self/jobs/<id>/withdraw` | Hand a tree and an allowed command to the helper; read or withdraw it. | POST and withdraw: self token, own job; GET: also the bound MAIN of the offering lane's Program |
| `POST /api/self/rueckfrage` · `GET /api/self/rueckfrage` | Answer or read the permission question your pane stands on. | self token |

## Opening a second seat (a checker)

A session opens another seat through a board branch, not by launching an agent itself. In your own git repo:

1. `POST /api/self/branches {"name": "Checker"}` creates the board branch (repo defaults to your folder; `branch` and
   `base` are optional). It answers `201` with `branch` (a fresh `Checker` usually gets `branch/checker`; a name
   already taken gets a suffix), `path` and `name`. The branch's Board-Name becomes the child's label.
2. `POST /api/self/branches/open {"branch": "branch/checker", "goal": "Check <what> against <where>."}` opens a free
   session in that branch's worktree. It answers `200` with the child's `slot`, `openedAt` and `cwd`. `fresh` starts a
   new conversation instead of continuing the worktree's newest one. `POST /api/self/branches/open` is the door; a
   branch that already has a session answers `409` with that slot.

What the child gets: its own worktree on that branch, the branch's Board-Name as its label, its own start (the branch
session file its harness reads, and on Claude Code Fleet's library if it is on), your slot recorded as its opener, and
your `goal` as its first message. It does not get your conversation as such (without `fresh` it continues the newest
conversation already in that worktree), your purpose, your packs, your rights or your model: its harness, sandbox and
rights are never wider than yours. It is a seat without a standing role, so it can
hand over, succeed, retire, read and write its own branch, and borrow packs.

How the two talk: the opener and the session on its branch are each other's Postfach counterpart, so no edge is
needed. Read `GET /api/self/messages?unread=1&read=1`, then send
`POST /api/self/messages {"to": {"kind": "session", "slot": <other slot>}, "payload": {"kind": "text", "text": "…"},
"idempotencyKey": "checker-1"}`. A reply adds `"replyTo": "<message id>"`. No `openedAt` is needed; a slot recycled
into another folder stops being the counterpart, and the door then answers `409`.

If your folder is not a git repository, both branch doors answer `400` with `not a git repository`; a git folder the
board does not carry answers `400` with `… is not a workplace repo — GET /api/branches would not show it`. There is
then no branch, no worktree and no second seat through your self token. Tell the person: the owner opens a plain
folder through the owner's doors, and inventing a branch around it is not your way.

## Doors of Fleet's own roles

These doors are about Fleet's own lanes, Programs, steward and Orchestratorin. Most ask for one of those roles; a row
that says `non-lane` is open to any non-lane seat. The role keeps every one of them (owner 2026-10-26); switching this
pack on adds no role and takes none away.

| Door | What it is for | What opens it today |
| --- | --- | --- |
| `GET /api/self/programs` · `POST /api/self/programs` | Read the Programs you propose or are bound to; propose one. | self token, non-lane |
| `GET /api/self/program-execution` | Read what your bound Program is doing: lanes, rows, stands. | self token, non-lane, bound MAIN |
| `POST /api/self/program-context-packs` | Write the context pointers of your own Program. | self token, non-lane, bound MAIN |
| `POST /api/self/program-decisions` · `POST /api/self/program-text-proposals` | Append a Program decision; propose a change to its goal text. | self token, non-lane, bound MAIN |
| `GET /api/self/memory` | Read the project memory in your scope (`view=work`, `sources`, `evidence`, `observations`). | self token; the scope comes from your lane or MAIN binding |
| `POST /api/self/main-direct/preflight` · `POST /api/self/main-direct/finalize` · `POST /api/self/main-direct/abandon` · `GET /api/self/main-direct` | Report provenance for work a NON-lane session does straight on main. | self token, non-lane |
| `POST /api/self/kanten` · `DELETE /api/self/kanten/<id>` | Grant or close an edge between two seats. | the Orchestratorin alone |
| `GET /api/self/fleet-report` · `POST /api/self/fleet-report` | Read reports addressed to you; file a worker result. | GET: self token; POST: a worker lane (never MAIN or the steward) |
| `POST /api/self/fleet-report/batch` · `POST /api/self/fleet-report/<id>/accept` · `POST /api/self/fleet-report/<id>/reject` | Judge the reports your Program is owed. | self token, non-lane MAIN or steward |
| `GET /api/self/clarifications` · `POST /api/self/clarifications` · `POST /api/self/clarifications/<id>/reply` | Ask your MAIN a question; answer a lane's question. | GET: self token; POST: a worker lane; reply: non-lane MAIN or steward |
| `GET /api/self/inbox` · `POST /api/self/inbox/<id>/read` | Read and acknowledge your Program's inbox pointers. | self token, non-lane, bound MAIN |
| `GET /api/self/attention` · `POST /api/self/attention` · `POST /api/self/attention/<id>/withdraw` | Raise a decision to the owner, read your questions, take one back. | self token, non-lane MAIN or steward |
| `POST /api/self/tasks` | File a queue row into your Program. | self token, non-lane MAIN or steward |
| `GET /api/self/tasks/<id>` | Read a queue row. | self token; a lane reads only its own row, a MAIN its Program's rows |
| `POST /api/self/tasks/<id>/files-proposal` | Propose the file surface a row stands on. | self token; lane or MAIN, while the row is open |
| `POST /api/self/tasks/<id>/notes` · `POST /api/self/tasks/<id>/brief` · `POST /api/self/tasks/<id>/comment` · `POST /api/self/tasks/<id>/withdraw` | Assign a source, sharpen a brief, comment a row, withdraw it. | self token, non-lane MAIN or steward |
| `POST /api/self/tasks/<id>/spawn` · `POST /api/self/tasks/<id>/variant-winner` · `POST /api/self/tasks/confirm-cards` | Choose a row's worker, decide a variant group, confirm a card surface. | self token, non-lane MAIN or steward |
| `POST /api/self/tasks/<id>/release` · `POST /api/self/tasks/<id>/hold` | Release a row into the queue, or hold it. | self token, non-lane MAIN or steward |
| `POST /api/self/tasks/<id>/land` | Land a finished row on the integration branch. | self token, non-lane MAIN (not the steward) |
| `POST /api/self/tasks/<id>/park` | Park a reviewed Program lane for review. | self token, non-lane MAIN (not the steward) |
| `POST /api/self/wave/split` | Hand rows of your own wave back, with the reason. | self token, the lane holding that wave |
| `GET /api/self/merges` · `POST /api/self/repos/audit-tip` | Read the land sensor; queue the tip's audit. | self token, Orchestratorin or bound MAIN (a MAIN only from Fleet's own checkout) |
| `POST /api/self/post-land-audits/adjudicate` | Judge a red post-land audit. | self token, the Orchestratorin alone |
| `GET /api/self/drift` · `GET /api/self/gate` | Read your lane's drift against integration; read the gate it will meet. | self token, lane only |
| `POST /api/self/criterion` | Propose the done-criterion of your founding row. | self token, lane only |
| `GET /api/self/notes` · `POST /api/self/notes/<id>/verdict` | Read and judge the notes your own brief carried. | self token, lane only |
| `GET /api/self/suite-offer` · `POST /api/self/suite-offer` · `POST /api/self/suite-offer/withdraw` | Hand your lane's preview suite to the helper, or take it back. | self token, lane only |
| `GET /api/self/lanes/<id>/suite-offer` · `POST /api/self/lanes/<id>/suite-offer` | Offer the preview of one of your own Program's lanes. | self token, non-lane, bound MAIN of that lane's Program |
| `POST /api/self/verify-intent` | Record that you are about to run the verify suite, or did. | self token, lane only |
| `POST /api/self/harness-block` | Report a dialog only a person can answer. | self token, lane only |

## What a refusal tells you

- **401** means the token is not a live occupant's self token.
- **403** means another right is missing, for example granting an edge.
- **409** means the token is right but the act is not askable from where you stand; the sentence names what is missing
  (a lane, a binding, the Orchestratorin, the owner's „[Zitat entfernt]“, a green check). Do not retry it as it is.
- **400** means the body asked for something the door does not read; the answer names the fields it does read.

A door that answers 202 has accepted work, not finished it. Read the state it names before you report it as done.

## Handing over

Text is the only thing you can add to your successor's start: a purpose and context packs. Rights, model, hooks and
MCP servers are the person's. Claude Code and every pi adapter read the purpose and packs in their appended system
prompt (a pi seat reads them from the file Fleet passes with `--append-system-prompt`); on a harness without one they
arrive in the succession brief. Either way each stone is one `+` line that names its author and is followed by its
text. A restart keeps your own start; only the succession brings the new one.

## Fleet's own doors are not yours

Owner routes (for example `/api/slots/...`, `/api/programs/...`, `/api/branches/...` outside the self family) take the
owner's key. A self token does not open them. If the person must act, say which act and why in one sentence rather than
looking for a way around it.
