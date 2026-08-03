# Brief: guest ops from the info card

Start, cut off, and watch the guest container from Fleet — without Fleet learning what a guest
*is*. Designed in conversation with the owner 2026-08-03; this file is the decision record so the
build does not re-litigate it.

Read `docs/container.md` first. This brief assumes the guest instance it describes exists.

## Why a button at all, when Fleet already gives you a shell

Fleet already puts a terminal on this machine in your pocket, so `./guest-expose.sh status` is
possible from the sofa today. What earns a surface is the thing that **fails silently at a moment
you did not choose**: the exposure window closing, and — the owner's reason, which overrode the
first draft of this brief — an attack you would otherwise learn about from your friend rather than
from your own dashboard.

**A correction that decided the shape:** an earlier suggestion was a launchd job auto-starting the
guest VM at boot. That is wrong on this machine. 8 GB that already swap; a VM that runs on every
boot pays memory on every day nobody is working. The button makes the guest opt-in per use, which
is both cheaper and more honest about what is running.

## The shape: one configured command with verbs

    FLEET_GUEST_CMD=/path/to/guest-ctl.sh        # unset → the feature does not exist, no buttons

The server calls `$FLEET_GUEST_CMD <verb>` and nothing else. Verbs: `status`, `start`, `cut`,
`stop`.

This is the point of the design, not an implementation detail: **`server.ts` must not learn about
colima, Docker, tunnels or audit files.** It learns "there is a command with these four verbs".
Every deployment specific stays in the script, which lives outside this public repository's
knowledge. It is the same idiom as the twenty existing `FLEET_*_CMD` roles, and the same
available-but-off pattern as `FLEET_DISPATCH_REPO`.

Note the one deviation from those twenty: they pass a prompt on stdin and read a model's answer.
This one takes a verb in argv and returns operator facts. It is an operator hook, not a worker.

## The four verbs

| verb | does | notes |
|---|---|---|
| `status` | prints JSON to stdout | the only read; see below for why it is not polled |
| `start` | brings the VM up | **idempotent** — measured: on a running VM, exit 0 in 4 s, "already running, ignoring" |
| `cut` | removes the ingress rule | the guest keeps running; nobody outside reaches it |
| `stop` | stops the VM | destructive to sessions; volumes survive |

**`cut` is the primary control, not `stop`.** For "fend off an attack" the right primitive is the
one that severs the attacker without destroying the friend's work — the container keeps running,
the hostname falls through to the tunnel's 404, and it is reversible in one command. `stop` is the
heavier hammer and belongs behind a confirmation. Note `cut` costs a ~30 s outage of every hostname
on that tunnel (`docs/container.md`) — acceptable under attack, which is exactly when you would
reach for it.

Because `start` is idempotent it needs no precondition check: press it when your friend says it is
not working. That property is what removes the need for status polling.

## status is NOT in the 2-second poll

`/api/sessions` is polled continuously and this repository already has a program about that —
`docs/data-saver.md`, where that endpoint at 112 KB every 2 s was the cause and not the terminal.
Spawning a subprocess on every poll would reintroduce exactly what was fixed.

So: a separate owner-only route the info card calls **when it opens and after each action**. The
poll cost stays zero.

## The data, and the line it must not cross

Nothing new is collected. `tokenGate` already writes an `owner_auth_fail` audit event on every
wrong token, and the same line runs inside the guest container — so **anyone rattling the public
hostname is already recorded there, and nobody reads it.** The `status` verb surfaces it: failed
attempts in the last hour and the last 24 h, when the most recent one was, and whether anyone is
connected right now.

**The boundary, stated so the next hand does not drift across it: security events yes, content no.**
The owner sees *that* someone knocked, never *what was done inside*. This is defensible precisely
because the public surface and the address reputation are the owner's risk while the work is the
guest's — and the whole point of the container is that those stay apart. A "peek at the guest's
sessions" feature would undo a day's work and must not be added here.

## Deliberately not built: an automatic lockout

The obvious hardening is a strike counter on `tokenGate`, and the pattern already exists a few
lines away (`INTAKE_FAIL_LOCK = 50`). It is not in this brief, for a reason worth keeping:

- A **global** lockout on the owner token is a self-DoS. An attacker sends 50 bad tokens and locks
  *you* out of your own instance.
- The correct version is per source IP, which behind a tunnel means trusting `CF-Connecting-IP` —
  legitimate only if you can also prove the request really came from Cloudflare. That is its own
  piece of work with its own way of being subtly wrong.

Seeing the count and pressing `cut` is the manual form of the same protection, with no new failure
mode. Record this reasoning at the constant if the lockout is ever built.

## Scope

- `guest-ctl.sh` — verbs, JSON status, reads the guest's audit log for the auth-failure counts.
- `server.ts` (~60 lines) — `GET /api/guest` (status) and `POST /api/guest/:verb`. Owner-only behind
  `tokenGate`, structurally 404 on share hosts, **not** reachable by a self- or steward token. One
  in-flight guard so a double-tap cannot start two VMs. A timeout, following `FLEET_VERIFY_TIMEOUT_MS`.
- `src/client.ts` (~40 lines) — one facts line in the info card plus the buttons. `stop` confirms.
- `e2e/` — checks, or it rots. At minimum: unset `FLEET_GUEST_CMD` means no route and no buttons;
  the verbs are a closed set (an arbitrary `:verb` is refused, never interpolated into a shell);
  a self-token and a steward token are both refused; the route 404s on a share host.

The verb whitelist is the one place this can go wrong in a way that matters — it reaches a command
line. Treat it like `MODEL_RE`: a closed set validated at the boundary, never a passthrough.

## The decision that was open, and how it was answered

**Does `cut` also clear the expiry window** (so re-opening starts a fresh N days), or does it only
close the door and keep the original deadline?

**Answered by the owner, 2026-08-03: keep the deadline — and add a button that resets it on
purpose.** So the panel has a fifth verb the four above do not: `renew`.

That answer is what separates three verbs that all "close the door":

| | ingress rule | deadline | timer | the verb it is |
|---|---|---|---|---|
| `cut` | removed | **kept, still running** | kept | the panic button; `start` returns you to the same deadline |
| `stop` | removed | kept | kept | cut, plus the container and VM go down |
| `down` (script only) | removed | deleted | removed | "I am done with this guest" |

`renew` is the only way to move a deadline, and it says so by being a separate press: an extension
is now a decision with a button, not a side effect of undoing a panic. `guest-expose.sh` grew
`cut` and `resume` for exactly this — `resume` re-opens on the stored deadline and **refuses once
it has passed**, which is what stops it from being a silent `up`.

Implemented 2026-08-03. Two deviations from the scope above, both deliberate:

- **"whether anyone is connected right now" is not in `status`.** The only honest sources were the
  guest instance's own API — which carries labels, cwds and git state, i.e. exactly the content
  side of the line this brief draws — or a connection count that would say nothing about who. The
  auth-failure counts, which were the point, are there.
- **The panel sits between LANES and OUTLINE in the info card**, not at the bottom: the outline is
  a list of dozens of prompts, and an emergency control below it is one you scroll for.
