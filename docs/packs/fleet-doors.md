# Fleet's doors

Read this when you work through Fleet with your self token: before you look for a route, open a seat, hand over, or
wonder which door your role opens.

Every door below takes **your self token**, sent as `x-fleet-self-token: $FLEET_SELF_TOKEN` to `$FLEET_SELF_URL`. The
token names your slot and its current occupant; it never names another slot. Never print it, and never put it in a URL.
The owner's key does not replace it here: a self door is a session's own door. What a door *also* requires is written
beside it, because that is what the code checks today.

Your start carries one line, `FLEET SERVER RIGHTS (checked at Fleet's doors): …`, naming each server right you hold with
what it opens; `GET /api/self` shows the same rights, effective now. A right you lack is the owner's to grant
(`POST /api/slots/<id>/rechte`); the door that refuses you says which one (`missingRight`).

An **orchestrator** is exactly this: a person's own agent with this pack, its rights and a direction. Fleet's own
orchestrator is one with Fleet's direction; another person's orchestrator is one with theirs. Granting or closing an
edge (`POST /api/self/kanten` · `DELETE /api/self/kanten/<id>`) is the right `edge.grant`: Fleet's Orchestratorin carries
it in her role bundle, and the owner can grant it to any seat with `POST /api/slots/<id>/rechte`. Adjudicating a red
post-land audit (`POST /api/self/post-land-audits/adjudicate`) and queueing a tip's audit (`POST /api/self/repos/audit-tip`,
read through `GET /api/self/merges`) still ask for the Orchestratorin's role, and the role keeps them (owner 2026-10-26).
A seat with this pack and a direction is an orchestrator in the direction's sense; it is not appointed to a role, and
it takes nothing from one.

Changing the setup as such — saving an agent (`POST /api/self/agenten`), copying one into a new version that names what it
derives from (`POST /api/self/agenten/<id>/kopie`), exporting a setup as one file (`GET /api/self/setups/<id>/datei`) and
importing one (`POST /api/self/setups/import`) — are the rights `setup.save`, `setup.export` and `setup.import`. No role
bundle carries them: the owner grants them to a seat, per seat, at `POST /api/slots/<id>/rechte`. They change Fleet's state
beyond one start, which is why they never ride with a role. A seat opened later from a setup you saved or imported is still
capped by yours (`kindNieWeiter` at the open door), an import never starts in bypass, and rights an imported seat asks for
still wait for the owner's confirmation. A one-seat import asks the same way: the file's rights come with the preview and are
named in `erbetenRechte` after the write; the owner sets them with `PUT /api/agenten/<id>`.

A constellation is saved the same way (`POST /api/self/konstellationen`, right `setup.save`): the seat you lead — yourself and
the live seats you opened, each with its goal, its formed role and its folder as an empty place — becomes one saved
constellation, and `GET /api/self/setups/<id>/datei` exports it as one file another Fleet imports whole. The mailbox
pairs (opener and child, siblings) are not stored: the importer's Fleet derives them from the `reports-to` lines. A seat
that holds a formed role does not carry it into a single saved agent (`nichtGetragen` says so); the role travels with
the constellation.

A seat started from a file gets what the file says it is told first: a position of a saved or imported constellation (`"sitz": "<konst>/<pos>"` at the
owner's open door, the folder door and the branch door) starts with the position's goal as its first message, unless you send a `goal` (then yours wins and
the answer says `goalFromFile: "replaced"`), and a position's empty folder place is filled by `cwd` — without it the door answers 400 naming the place and the
sender's hint. At the folder door a seat of that constellation may leave `cwd` out: the hint next to its own folder is taken when it exists.

What your seat saves is not the owner's hand. Every agent this door writes carries the mark of the seat that saved it
(`vonSitz` in the answer; the owner's list `GET /api/agenten` says who saved it), and that mark works at every open door,
the owner's included: such an agent never starts in bypass or in a role, and its rights are stored capped like an
import's (`src/sitz.ts#rechteGedeckelt` — `gedeckelt` in the answer names what the cap held back; the cap keeps the server
rights your seat itself holds, except those only the owner gives (`RECHTE_NUR_DURCH_OWNER`), and
drops the rest, each named by its id in `gedeckelt`). Only the owner's own
change of the agent (`PUT /api/agenten/<id>`, his door) takes the mark away.

Opening a seat in any folder (`POST /api/self/seats/open`) and forming a role of your own (`POST /api/self/roles`) are the
last two doors that used to stop an agent: it can now set up a constellation itself, without the owner's key. A role is a saved
object on the shelf (`SetupRole`, the same format a setup carries); a seat opened with `role: "<id>"` gets its bundle as
grants (additive, like every role, and still capped by yours) and its start text, shows both in its start brief, and
reads mail sent to `{kind:"role", role:"<id>"}` when it is the newest live holder. A purpose you give through this door
(or the branch door) reaches the child as "written for you by the session in slot N", never as the owner's word. Only a
role formed here opens at this door, and an imported role once the owner has confirmed its rights (`POST /api/k15/freigabe`
on the position that carries it; a role with no rights has nothing to confirm). Until then the door refuses it. A role keeps the
packs it reads on the receiver's shelf, also when the receiver's library has them already (so does every pack of an imported file: a seat from it reads them in any folder, with the hash the file carried); it stays with a seat through
succession on every harness (a harness without Fleet's system prompt reads its start text in the brief). A seat the owner opens
from a position of an imported constellation carries the role of that position once its rights are confirmed, so its address works;
the owner's open door also takes `role: „[Zitat entfernt]“` for a role formed or confirmed here. The start text of a role names who formed it
(`FLEET ROLE (<id>, author: the session in slot N) — <name>`); at a position start the stone carries the text and the profile's purpose is left out when it is the
same. `POST /api/self/roles` and `POST /api/self/seats/open` answer 400 for a key they do not read and name the keys they do, so `bundle` instead of `rights`
is not silently dropped. The first message of a seat a session opened says which door opened it and by whom.

## If you are a seat without a standing role

You can always: read and write your own handover, succeed or retire, open and land your own branch, propose its check,
borrow a context pack, write a pack of your own, set what your successor gets, schedule an auto, read the events and
messages addressed to you, see the edges you are in, and hand a tree and a command to the helper. Each of these acts
is a server right in your generic bundle, named in the table; the start brief and `GET /api/self` show the rights this
occupant actually has.

You cannot fill the queue, judge a fleet report, release or land a Program row, read a Program inbox, or adjudicate an
audit. Those need a lane, a bound MAIN or the Orchestratorin, named below. Granting an edge needs the right
`edge.grant`: the Orchestratorin's bundle carries it; the owner can grant it to your seat. A refusal is a 409 with
the reason, never a silent drop.

## The doors every seat has

| Door | What it is for | What opens it today |
| --- | --- | --- |
| `POST /api/self/handover` | Keep the standing handover your successor and the owner door read. | right `text.handover` (generic, lane, bound MAIN, Orchestratorin — not the steward); self token; a lane writes its stand |
| `POST /api/self/succeed` | Start your successor in your place with your handover. | right `text.handover` (generic, lane, bound MAIN, Orchestratorin — not the steward); self token; a lane uses its own baton rail |
| `POST /api/self/retire` | End your own session. | self token; not the steward |
| `GET /api/self/constellation` | See the constellation you stand in — the seats you may write to (the one that opened you, the ones you opened, their siblings) and the other positions of your saved constellation: per seat slot, name, folder (a path only under your seat root, else a hint), role, purpose title, harness, model, effort, live / ended / not started, and the address you write to. Never your own start, packs, rights or hash. | self token; no right; a seat outside any constellation gets an empty list |
| `GET /api/self/overview` | See what runs around you, without the owner's key: per seat of your line (with the right `overview.fleet`: every live seat) its name, harness, model, effort, state and since when, who opened it (by the line), what it waits for (a permission or trust question, unread mail as a count, a handover), context fill and whether its cache is warm; whether an agent runs behind its pane; for a seat you opened (with `overview.fleet`: every seat but the owner's own) also how long it has been idle, its branch and head as the git tick last read them and that branch's last merge check. Your own row is `me.seat`. The seats holding a position of your own saved constellation count as your line. `sources` names where Fleet reads each field and how old the git tick's reading is; a field Fleet doesn't know is `null` with its reason under `unknown`. Without `overview.fleet` you see no seat outside your line (a seat nobody opened and that opened nobody sees an empty list); with it every other seat counts too, with idle time, branch, head and last check as for a seat you opened, and the owner's own seats outside your line show only slot and state. A seat in one of Fleet's roles (MAIN, steward, lane, Orchestratorin) is never one of the owner's own. `overview.fleet` widens what the door shows and never closes it: the Orchestratorin's bundle carries it for herself, and otherwise only the owner gives it, to one running seat with `POST /api/slots/<n>/rechte {"grant": ["overview.fleet"]}`, and takes it back with `{"revoke": ["overview.fleet"]}`; a child never gets it (named in `rechte` the open answers 409, and it is not inherited) and a formed role never carries it. No message, pane or transcript text. | self token; no right; read-only |
| `GET /api/self/harnesses` | What this machine runs now: per harness its models, effort levels, whether it is available and started here, and the default model. The same catalogue the owner's picker reads; choose harness and model for a seat you open from it. | self token; no right |
| `GET /api/self/messages` · `POST /api/self/messages` · `POST /api/self/messages/<id>/read` | Read your addressed mail, send a message, mark one read. | self token; the sender comes from your binding, and a body never names a principal |
| `GET /api/self/events/<id>` · `POST /api/self/events/<id>/ack` | Read the event addressed to you, or acknowledge it. | self token, this occupant's events only |
| `GET /api/self/kanten` | See the edges you are in. | self token |
| `POST /api/self/watch` | Subscribe your own slot to one server-generated completion fact. | self token, non-lane (the steward may watch) |
| `POST /api/self/autos` · `DELETE /api/self/autos/<id>` | Schedule one prompt for yourself, or take your schedule back. | self token, for your own slot only |
| `GET /api/self/branch` · `POST /api/self/branches/check` · `POST /api/self/repo-check` | Read your own branch and its check, run the check, propose the repo's command. | self token, own branch and own repo only; the check never runs as a repair (`repair: true` answers 409 — a land on a red main is the owner's door) |
| `POST /api/self/branches/land` | Land your own branch after "Looks good" on its tip (the person's, or your opener's with `branch.passt`) or the repo's standing word, and a green check. The land row says whose "Looks good" it was. | right `land.branch` (every role bundle); self token, own branch; both conditions are checked |
| `POST /api/self/branches` · `POST /api/self/branches/open` | Open a board branch, or a session on one. | right `seat.open` (generic, bound MAIN, Orchestratorin); self token, non-lane, non-steward, in your own repo; the child is never wider than you |
| `POST /api/self/seats/open` | Open a seat in a folder, not only a branch of your repo: `cwd`, and `harness`, `model`, `effort`, `purpose`, `bibliothek`, `goal`, `rechte`, `permissionMode`, `role` as at the owner's open door. It is that door's own path. | right `seat.open` (generic, bound MAIN, Orchestratorin); self token, non-lane, non-steward; the folder lies under `FLEET_SELF_SEAT_ROOT` (your home folder without it); at most `FLEET_SELF_SEAT_CAP` (3) live seats you opened; the child is never wider than you (harness, fence, permission mode, rights; a mode below yours in plan < manual < dontAsk < acceptEdits < auto < bypassPermissions is fine, so from bypass you open a seat in auto); a label that reads as a role is refused; `bibliothek` is a list of ids from Fleet's library, `false` for none (the two door lines below still come), and `true` or nothing for the folder's default (a private pack of the owner's is refused) |
| `POST /api/self/seats/<slot>/passt` | Give „[Zitat entfernt]“ („passt“) on the current tip of the branch of a seat you opened, so that seat may land it through `POST /api/self/branches/land`; the body names `head`, the tip you looked at (it must be the current tip), and may name `openedAt`. A later commit makes it stale, like the person's. The land row and the audit line name you. | right `branch.passt` (no role bundle; the person grants it, or confirms it at a template position); self token; only a seat you or a predecessor in your line opened |
| `POST /api/self/testinstanz` | Bring up (`{"action": "up"}`) or take down (`"down"`) a test instance to accept a visible change, built from your own worktree or with `slot` from a seat you opened or a sibling (the checker from the builder's). It ends by itself when "Looks good" comes on that branch or when your line ends; your successions keep it. | self token; yourself, a seat your line opened or a sibling |
| `POST /api/self/seats/<slot>/end` | End a live seat you opened yourself, through the folder door or the branch door; the body may name `openedAt` (the answer of the open) so a place taken over since is refused. The pane gets the same end as `retire`, and the place no longer counts against the cap. | right `seat.open`; self token; never your own opener, a sibling, a stranger or a seat in one of Fleet's own roles (409 names the reason) |
| `POST /api/self/roles` | Form a role of your own — a name, an address `{kind:"role", role:<id>}`, a bundle of rights and a start text with the packs it reads. | right `role.form` (no role bundle carries it; the owner grants it to your seat); self token; the bundle is never wider than your effective rights, and the refusal names the right; Fleet's own role names are refused; a role someone formed is formed anew only by the seat that formed it (slot and folder) |
| `GET /api/self/roles` | List the roles formed here, to find one to open a seat in. | right `seat.open` (generic, bound MAIN, Orchestratorin); self token |
| `GET /api/self/roles/<id>/datei` | Export a formed role as one setup file. | right `setup.export` (no role bundle); self token; the owner's import asks for the role's rights again |
| `POST /api/self/packs` | Write a private context pack of your own, valid at once. | right `text.pack` (every role bundle); self token; an id from Fleet's register is refused, and the owner's private pack is the Orchestratorin's |
| `POST /api/self/agenten` · `POST /api/self/agenten/<id>/kopie` | Save an agent of your own — the same body `POST /api/agenten` takes, `vonSlot` included, or a copy of an existing agent that carries "derived from". | right `setup.save` (no role bundle carries it; the owner grants it to your seat); self token; at this door `vonSlot` names only your own slot; what you save carries your seat's mark — it never starts in bypass or a role and its rights are stored capped, until the owner changes it |
| `POST /api/self/konstellationen` | Save the constellation you lead — your own seat and the live seats you opened (at most `FLEET_SELF_SEAT_CAP`) — as one saved constellation: per seat harness, model, effort, purpose, packs, the formed role with its text, the goal it was opened with and its folder as an empty place (a path relative to the seat root as a hint, never an absolute path); one `reports-to` edge per child. `{name?}`; the answer names the id and `GET /api/self/setups/<id>/datei`, which exports it as one file. | right `setup.save` (no role bundle); self token; you must have opened at least one live seat; rights are stored capped like a saved agent's, nothing starts in bypass or in a Fleet role, and rights the file asks for wait for the owner's confirmation |
| `GET /api/self/setups/<id>/datei` | Export a setup as one file — an own agent or a saved constellation; personal knowledge leaves only as an empty place. | right `setup.export` (no role bundle); self token; the same export the owner's door writes |
| `POST /api/self/setups/import` | Import a setup file (`{datei}`) or one of Fleet's templates (`{vorlage: "lead-with-builders"}`): the preview first, then `schreiben: true` writes it. | right `setup.import` (no role bundle), also for the preview; self token; the file's rights arrive capped, a role waits for the owner's confirmation, and nothing imported starts in bypass |
| `GET /api/self/einrichten` · `POST /api/self/einrichten` | Set or read the purpose and packs your successor gets on top of your start. | POST: right `text.handover` (generic; a lane and a standing role are refused by the door); GET: self token; text only, on every harness |
| `POST /api/self/weglassen` | Leave part of your own `~/.claude` out of your next start. | self token, Claude Code only, a seat of its own (never a lane) |
| `GET /api/self/context/<id>` | Borrow one context pack's text and its source at HEAD. | self token; a seat borrows Fleet's library and the packs of its own, a role borrows its own plan |
| `GET /api/self/konzepte/<konzept>/<op>` · `POST /api/self/konzepte/<konzept>/<op>` | Read a concept's versions and annotations, or annotate it. | reading: self token; annotating: right `text.concept.annotation` (every role bundle); publishing: right `text.concept.version` (lane, bound MAIN); withdrawing an annotation: `text.concept.annotation` and the lane/MAIN scope |
| `GET /api/self/konzepte/k-owner-korrekturen/leseansicht` | Read the owner's corrections as they apply to your binding. | self token; a lane, MAIN, orchestrator or a seat in Fleet's repo |
| `POST /api/self/jobs` · `GET /api/self/jobs/<id>` · `POST /api/self/jobs/<id>/withdraw` | Hand a tree and an allowed command to the helper; read or withdraw it. | POST and withdraw: self token, own job; GET: also the bound MAIN of the offering lane's Program |
| `POST /api/self/rueckfrage` · `GET /api/self/rueckfrage` | Answer or read the permission question your pane stands on. | self token |

## What you send

Bodies as the doors read them. Keys the door does not know are ignored today, so check the answer, not the request.

- `GET /api/self`: nothing. The answer has your slot, your effective rights (`rechte.effective`, the ones the doors
  check) and whom you may write to. Read it first; it tells you where you stand.
- `POST /api/self/seats/open`: `{"cwd": "~/arbeit/projekt", "goal": "…", "model": "claude-sonnet-5-5", "effort":
  "high", "role": "prufer"}`. `cwd` is required. Optional: `harness`, `model`, `effort`, `purpose`, `bibliothek`,
  `goal` or `aufgabe` (the first message), `rechte`, `permissionMode`, `label`, `role`. Pass `model` and `effort`
  every time: a child without them runs a default you did not choose. Answer 200 `{slot, openedAt, cwd}`.
- `POST /api/self/roles`: `{"name": "Prüfer", "text": "<its start text: purpose and rules in your words>", "rights":
  ["text.pack"], "packs": ["fleet-doors"]}`. `name` and `text` are required. The id is made from the name (`prufer`)
  and is the role's address `{"kind":"role","role":"prufer"}`. Answer 201 `{ok, role: {id, name, rights, packs,
  address, hash}}`; a right wider than yours is 409 with `missingRight`.
- `POST /api/self/messages`: `{"to": {"kind":"session","slot": 15}, "payload": {"kind":"text","text": "…"},
  "idempotencyKey": "<any string, new per message>"}`. `to` is `{kind:"session", slot}` or `{kind:"role", role}`; from
  a terminal `./ctl.sh send --seat <slot> <textfile>` does the same. The door names what is missing itself: 400 states
  the cap and the form, 409 states the rules and the seats you may write now. Read the error body; `curl -o /dev/null`
  hides it. A report fits in one message (at most 10 000 characters).
- `GET /api/self/context/<id>`: the text of one library pack at HEAD, for example `setting-up-agents` when your start
  did not carry it.
- `POST /api/self/retire`: ends your own seat. A seat you opened ends itself the same way when its work is done, so
  tell it to; until then it counts against your cap of live seats.

## Opening a second seat (a checker)

Two doors, by where the seat works.

**In a folder** (any folder under your seat root, a git repository or not): `POST /api/self/seats/open`, body above. The
child gets that folder, your `goal` as its first message, the model and effort you pass, and the knowledge you choose
with `bibliothek`: a list of ids from Fleet's library gives it exactly those packs in its start (`["setting-up-agents"]`) plus
the two door lines (`fleet-doors`, `setting-up-agents`) as skills where it did not choose them, `false` gives it no library but
still the two door lines, and `true` or nothing is the folder's default (in a plain folder the two door lines as skills, in
Fleet's repo the whole library). The door lines belong to the token the child holds, not to its library choice. A purpose you give reaches it as "written for you
by the session in slot N", never as the owner's word. With `role: „[Zitat entfernt]“` it starts in a role you formed
(`POST /api/self/roles`) and gets its bundle and start text. It is never wider than you in harness, fence, permission
mode or rights.

**On a board branch of your own git repo:**

1. `POST /api/self/branches {"name": "Checker"}` creates the board branch (repo defaults to your folder; `branch` and
   `base` are optional). It answers `201` with `branch` (a fresh `Checker` usually gets `branch/checker`; a name
   already taken gets a suffix), `path` and `name`. The branch's Board-Name becomes the child's label.
2. `POST /api/self/branches/open {"branch": "branch/checker", "goal": "Check <what> against <where>."}` opens a free
   session in that branch's worktree. It answers `200` with the child's `slot`, `openedAt` and `cwd`. `fresh` starts a
   new conversation instead of continuing the worktree's newest one; a branch that already has a session answers `409`
   with that slot. Both branch doors answer `400` with `not a git repository` for a plain folder, and `… is not a workplace
   repo` for a git folder the board does not carry: use the folder door there.

What either child gets: its own start, your slot recorded as its opener, and your `goal` as its first message. It does
not get your conversation, your purpose or your model. Without `rechte` it inherits the rights you were granted;
`rechte` narrows them, never wider than yours (`rechte give … more than yours`). On the branch door it inherits your library choice and
the packs you gave yourself (`Slot.selbst`) as text, shown in its start and in Info → Setup. It is a seat without a
standing role, so it can hand over, succeed, retire, read and write its own branch, and borrow packs. A seat you open
counts against your cap until it retires: tell it to when its work is done.

How the two talk: through the mailbox, as in "What you send". Read `GET /api/self/messages?unread=1&read=1`; a reply
adds `"replyTo": "<message id>"`. No `openedAt` is needed. Who may write whom is in the start brief under „Works with“.

A seat that wants to know who else is in its constellation reads `GET /api/self/constellation` instead of keeping slot numbers from door answers: the list
follows the line, so after your succession or a child's you read the same seats, and a child that ended stays in it as ended, without an address. Write to the
`address` it gives (`{kind:"session", slot}`, or `roleAddress` for a formed role); a position that nobody has started yet has none — open it with `"sitz": "<id>"`.

To know what those seats are doing — waiting on a question, holding unread mail, near their handover, idle, on which branch head — read `GET /api/self/overview`
rather than `./ctl.sh get /api/sessions`: it needs no borrowed key, and `./ctl.sh status` in your pane reads its seat lines from it.

## Doors of Fleet's own roles

These doors are about Fleet's own lanes, Programs, steward and Orchestratorin. Most ask for one of those roles; a row
that says `non-lane` is open to any non-lane seat. The role keeps every one of them (owner 2026-10-26); switching this
pack on adds no role and takes none away.

| Door | What it is for | What opens it today |
| --- | --- | --- |
| `GET /api/self/programs` · `POST /api/self/programs` | Read the Programs you propose or are bound to; propose one. | self token, non-lane |
| `GET /api/self/program-execution` | Read what your bound Program is doing: lanes, rows, stands. | self token, non-lane, bound MAIN |
| `POST /api/self/program-context-packs` | Write the context pointers of your own Program. | right `text.program` (bound MAIN bundle); self token, non-lane, bound MAIN |
| `POST /api/self/program-decisions` · `POST /api/self/program-text-proposals` | Append a Program decision; propose a change to its goal text. | right `text.program` (bound MAIN bundle); self token, non-lane, bound MAIN |
| `GET /api/self/memory` | Read the project memory in your scope (`view=work`, `sources`, `evidence`, `observations`). | self token; the scope comes from your lane or MAIN binding |
| `POST /api/self/main-direct/preflight` · `POST /api/self/main-direct/finalize` · `POST /api/self/main-direct/abandon` · `GET /api/self/main-direct` | Report provenance for work a NON-lane session does straight on main. | self token, non-lane |
| `POST /api/self/kanten` · `DELETE /api/self/kanten/<id>` | Grant or close an edge between two seats. | right `edge.grant` (Orchestratorin bundle; the owner grants it to any seat); self token; two plain sessions, never the granter as an end |
| `GET /api/self/fleet-report` · `POST /api/self/fleet-report` | Read reports addressed to you; file a worker result. | GET: self token; POST: a worker lane (never MAIN or the steward) |
| `POST /api/self/fleet-report/batch` · `POST /api/self/fleet-report/<id>/accept` · `POST /api/self/fleet-report/<id>/reject` | Judge the reports your Program is owed. | self token, non-lane MAIN or steward |
| `GET /api/self/clarifications` · `POST /api/self/clarifications` · `POST /api/self/clarifications/<id>/reply` | Ask your MAIN a question; answer a lane's question. | GET: self token; POST: a worker lane; reply: non-lane MAIN or steward |
| `GET /api/self/inbox` · `POST /api/self/inbox/<id>/read` | Read and acknowledge your Program's inbox pointers. | self token, non-lane, bound MAIN |
| `GET /api/self/attention` · `POST /api/self/attention` · `POST /api/self/attention/<id>/withdraw` | Raise a decision to the owner, read your questions, take one back. | self token, non-lane MAIN or steward |
| `POST /api/self/tasks` | File a queue row into your Program. | self token, non-lane MAIN or steward |
| `GET /api/self/tasks/<id>` | Read a queue row. | self token; a lane reads only its own row, a MAIN its Program's rows |
| `POST /api/self/tasks/<id>/files-proposal` | Propose the file surface a row stands on. | self token; lane or MAIN, while the row is open |
| `POST /api/self/tasks/<id>/notes` · `POST /api/self/tasks/<id>/brief` · `POST /api/self/tasks/<id>/comment` | Assign a source, sharpen a brief, comment a row. | right `text.program` (bound MAIN bundle); self token, non-lane |
| `POST /api/self/tasks/<id>/withdraw` | Withdraw a queue row. | self token, non-lane MAIN or steward (a status decision, not a text right) |
| `POST /api/self/tasks/<id>/spawn` · `POST /api/self/tasks/<id>/variant-winner` · `POST /api/self/tasks/confirm-cards` | Choose a row's worker, decide a variant group, confirm a card surface. | self token, non-lane MAIN or steward |
| `POST /api/self/tasks/<id>/release` · `POST /api/self/tasks/<id>/hold` | Release a row into the queue, or hold it. | release: right `seat.open` (generic, bound MAIN, Orchestratorin); hold: self token, non-lane MAIN or steward |
| `POST /api/self/tasks/<id>/land` | Land a finished row on the integration branch. | right `land.program` (bound MAIN bundle); self token, non-lane MAIN (not the steward) |
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
- **403** means a hard owner/scope boundary outside the rights layer remains in the way.
- **409** means the token is right but the act is not askable from where you stand; the sentence names what is missing
  (a lane, a binding, the Orchestratorin, the owner's „[Zitat entfernt]“, a green check). A missing server right is a 409
  with `missingRight: "<id>"` (and `door`, `role`); the owner grants it at `POST /api/slots/<id>/rechte`. Do not
  retry the act unchanged.
- **400** means the body asked for something the door does not read; the answer names the fields it does read.

A door that answers 202 has accepted work, not finished it. Read the state it names before you report it as done.

## Handing over

Text is the only thing you can add to your successor's start: a purpose and context packs. Rights, hooks and MCP
servers are the person's. Model and effort are yours to choose at the succession itself: `POST /api/self/succeed`
takes `model` and `effort` and validates them as an open does; without them the successor inherits yours. Claude Code and every pi adapter read the purpose and packs in their appended system
prompt (a pi seat reads them from the file Fleet passes with `--append-system-prompt`); on a harness without one they
arrive in the succession brief. Either way each stone is one `+` line that names its author and is followed by its
text. A restart keeps your own start; only the succession brings the new one.

## Fleet's own doors are not yours

Owner routes (for example `/api/slots/...`, `/api/programs/...`, `/api/branches/...` outside the self family) take the
owner's key. A self token does not open them. If the person must act, say which act and why in one sentence rather than
looking for a way around it.
