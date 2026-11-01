# Operating a constellation

Read this when a request comes to you and you decide where it goes: you do it, a running seat takes it, or you open a
seat for it; and when what comes back is judged before it reaches the owner. It is for the seat the owner talks to and
for any lead. The door bodies are in `fleet-doors`, the brief's five parts and the lead's loop in `setting-up-agents`;
this pack is the judgment between them.

## Where a request goes

Ask in this order and take the first that fits.

1. **Is it the owner's?** Money they haven't set aside, anything public, anything that can't be undone, a right only
   they grant, taste. It goes back to them as one question, because no seat can decide it for them.
2. **Is it unclear what is meant?** Which branch, which result, done by when. Ask one question before anyone works on a
   guess.
3. **Can you answer it in a few calls from where you stand?** What runs, a short lookup, why something is red. Do it:
   a handoff costs more than the answer. A change that must land is not this step, even when you found the cause.
4. **Does it fit the work of a running seat?** Send it there. That seat has the context and often a warm cache; a fresh
   seat pays a whole start before it reads your first line.
5. **Is it breadth you won't need again?** Many reads, one answer, nothing that must outlive you: a subagent through
   your harness's own agent tool, which hands you only the answer.
6. **Otherwise open a seat,** when the work needs another model, an independent check, other rights, more time than
   your context holds, or a result that outlives you. If it needs none of these, do it yourself.

Keep your own context for the overview: when you have read for a while without an answer to the owner, the work belongs
in a seat.

## Which seat for which request

A role formed on the shelf (`POST /api/self/roles`, listed by `GET /api/self/roles`) is opened with `role: "<id>"`
and keeps its address through succession. Where there is none, a seat with a purpose and a brief does the same work.
These kinds have carried work:

| Request | Seat | What comes back |
| --- | --- | --- |
| a change that lands (code, a pack, a doc) | a builder on the branch the work belongs to (`POST /api/self/branches/open`; a new branch with `POST /api/self/branches` first) | one final report: commits, the check, what was missing from its start |
| "is this right?" about a change, a text or a plan | an independent checker, in a detached worktree or its own folder, changing no file | per point holds or fails, with the input that shows each defect, in a file; it looks again after each fix |
| facts across many files, logs or transcripts | a researcher | findings with `file:line` and a closing line of what it did not verify |
| a choice between options | a judge, with the facts in its brief | a verdict with its reasons |
| a change to the system you all run on, or to its plan | the orchestrator, through the mailbox | it takes it into its plan, or says why not |

Harness and model follow the work and the owner's words about which model takes which kind of work
(`setting-up-agents`, *Who*). When you open a seat, tell the owner in one line what
it does and on which model, so they can change it before it costs much.

## How you hand it over

- **Read who is there first.** `GET /api/self/constellation` lists your constellation (the seat that opened you,
  the seats you opened, their siblings) with purpose, model, state and address. Take the address from it, not a slot
  number from an earlier answer: the list follows succession. Other running seats are not in a seat's view yet.
- **Write as `to` in `POST /api/self/messages`:** `{kind:"session", slot}` for a running seat, `{kind:"role", role}`
  for a formed role, which reaches its newest live holder. A Claude seat writes any other Claude seat that holds no
  standing role directly. A pi or Codex seat, a lane or a MAIN outside your constellation answers 409; the way there
  goes through the seat that opened you or the orchestrator, never through the owner's key.
- **Say how it relates.** A request to a seat with history names how it relates to what that seat is doing; otherwise
  it drops its own thread for yours (`sharpening-an-order`).
- **A new seat gets its brief as a file.** Write it to a folder outside the repo, open the seat with the goal "read
  <path>", and pass model and effort on every open: a file outlives the 2000 characters of a message, the seat's
  successor reads it again, and the checker gets the same text. Give the seat the packs its task needs (`bibliothek`
  at the folder door), not yours.
- **The brief's "Back to" names your address** and asks for one final report, then "stop and wait". Every message
  wakes its receiver, so progress notes cost both of you, and a seat that isn't told to stop looks for more work while it
  holds a place in your cap.
- **Read the door's answer.** `delivery` means the seat lives but its pane can't take the message now; it goes in
  when it can. A `note` that the seat is no longer live means it ended: a successor reads messages to its
  predecessor, a seat that ended without one never will, so write to the address the constellation gives now.
- **Mark the owner's own data.** A message with `personal: true` reaches only an Anthropic seat and is refused for any
  other, because personal data never goes to another provider. Set it on everything about the owner's own life.

## While it runs

- **You wake from the delivery, not from a clock.** Fleet types every message into your pane. Don't poll a child or
  schedule a tick to look; for a land, an audit or a job, use `POST /api/self/watch`.
- **A child's question that only the owner can answer** goes up the line: if you are the seat the owner talks to, ask
  them one question and pass their words down; otherwise send it to the seat that opened you, which filters and asks.
- **A child at its context limit hands over,** and no brief forbids it. Its successor reads the brief file again.
- **At your cap** (`FLEET_SELF_SEAT_CAP`), the open door answers 409. End a seat whose work is done, or tell the owner
  what waits.

## What comes back

- **A report is a claim until you have seen the line.** Before it reaches the owner, read the line or run the command
  behind each claim the result rests on, in one tool call.
- **The checker says "done", not the builder.** Give the builder's fix back to the checker; the loop ends when the
  checker finds nothing. When the same defect comes back, the brief is wrong: rewrite it.
- **End what is done.** Tell the child to retire, or `POST /api/self/seats/<slot>/end`.
- **Keep what was missing.** Each report ends with what was missing from its start. Put it into the next brief you
  write; when it comes back a second time, propose it as a pack (`docs/packs/making-a-pack.md` says how).

## Traps

- **A fresh seat for a request a running one could take.** You see it when the new seat's first calls read what another
  seat already knows.
- **A seat reopened where succession belongs.** A role that should go on continues by succession: its successor starts
  with the handover and keeps the address. A reopened seat starts as a stranger.
- **The owner's key for a door you lack.** A self door that refuses you names what is missing. Tell the owner the step in
  one sentence and wait.

## Done

The owner got the result where they wanted it without naming a role, every seat you opened for it has reported and
ended, and each one's start brief shows what it was given.
