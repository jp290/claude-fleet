# helper-daemon — the other machine's half of the remote helper portal

Automates, unchanged, the ritual `src/helper.ts#bootstrapText` spells out for a human: claim a job
from a Fleet's portal, download its git bundle, clone it, `bun install --frozen-lockfile`, run the
suite, POST the exit code, the log tail and the trail id back.

It replaces exactly one sentence of the portal's Stage-1 non-goals — *"a human on the other machine
clicks claim"* (owner promotion G0, 2026-08-28). The other three stand and are not negotiable here:
**no server-side auto-dispatch, no ssh runner, no push.** The Fleet never opens a *connection*
towards the helper machine; everything this daemon does is a pull. The one exception to that last
word is named and bounded below (**Wake-on-LAN**): a magic packet is not a connection — nothing can
answer it, and all it does is switch a box on so it can start pulling.

## Running it

    bun helper-daemon/daemon.ts /etc/fleet-helper/config.json

`config.example.json` is the full field list. Get the token from the Fleet host, as the owner:
`GET /api/helper/token` (owner-gated — it is neither the owner token nor a slot's self token).

## The rules this file exists to keep

- **The token travels as the `x-fleet-helper-token` header and nowhere else.** Not in a URL (the
  portal page's `?token=` affordance is for a browser; the daemon refuses a `fleetUrl` carrying
  one), not in argv, not in an `Environment=` line, not in a log line. The config file must be
  `0600` — the daemon refuses to start otherwise, because a readable config has already handed the
  credential to every account on the box.
- **`off` means not one request.** Quiet hours, `enabled: false`, and an owner wish of `off` all
  stop the daemon before it makes any call at all — no heartbeat, no job poll. A machine that does
  not poll claims nothing, and a claim that is never made cannot be lost: the portal's expiry rail
  falls a job back to the Fleet's own drain.
- **A fresh audit job may be held for this machine — `FLEET_AUDIT_HELPER_GRACE_MS`, on the Fleet
  side.** A land kicks the Fleet's own drain synchronously, so without it an audit is already the
  Fleet's before this daemon's 15 s poll has seen it exist (measured 2026-08-29,
  `docs/messungen/second-host-baseline-2026-08-29.md`). Set above zero, the Fleet's drain leaves an
  entry that young alone for that long — but only while a device is registered, wished `active`,
  reporting `active` and beating recently. Unset or `0` is the old behaviour exactly. It never
  starves anything: the moment the grace lapses the local drain takes the job, which is the same
  fallback the expiry rail above provides, one step earlier.
- **Parallel runs are COUNTED, never derived from the load average.** `maxParallelSuites` (default
  `1`) is how many jobs this machine will run at once; the daemon claims only while the number of
  jobs it already has in flight is below it. The load cap stays as a *second* condition and never
  replaces the count — the 1-minute average is a lagging figure, and a suite that started twenty
  seconds ago has barely moved it. Measured on the work-horse 2026-09-06
  (`docs/messungen/2026-09-06-second-host-parallel-suiten.md`): one `./e2e-isolated.sh` sits at load1
  0.21 mean / 0.94 peak, so `maxLoad1: 2` let a *third* audit through while two were running. Two
  parallel suites there cost +0.24 %/+0.29 % run time and 224 MB; more than two is not measured, so
  `2` is the value that fixture supports.

  Above `1`, each run gets its **own** `FLEET_SUITE_LOCK` (under its run directory), because
  `./e2e-isolated.sh` takes `/tmp/fleet-e2e.lock` through `e2e-stage.sh` *inside* the clone — two
  runs on one lock would serialize there and the second slot would only be a place in the waiting
  line. At `1` the shared default lock is deliberately left alone: that is what makes a
  hand-started suite on that machine serialize against this daemon's.

  The heartbeat carries `running` and `maxParallelSuites`, so the board shows `1/2 suite slots`,
  and the Fleet's claim door refuses a device whose own last heartbeat said it was full. That
  refusal uses nothing but the machine's own words — a device that reports neither field (a browser
  on the portal page, any daemon older than this) is uncapped, exactly as before.
- **The quieter of the two modes wins.** The owner's `desiredMode`, pulled in the reply to this
  machine's heartbeat, always wins downwards; it never overrides quiet hours or the load threshold
  upwards, because the person who set those is standing next to the machine.
- **The clone always NAMES its ref.** A helper bundle carries exactly the refs it was built from
  and no HEAD, so a plain `git clone` of one checks a tree out only if git can *guess* the ref —
  and it guesses with `init.defaultBranch`. Where that is `master` (Debian's default, and the value
  of an unset one) the guess misses: the clone exits 0, warns `remote HEAD refers to nonexistent
  ref`, and leaves an EMPTY tree. So both kinds are cloned with `-b`: a lane-suite claim names that
  ref `branch`, an audit claim names it `main`. Measured live on the work-horse 2026-08-29 — before
  the fix an audit clone came back empty, `bun install --frozen-lockfile` found no `package.json`,
  and the ledger row read `unknown` for a suite that was never started. A clone that leaves no
  working tree now fails as ITSELF rather than as a failed install.
- **One suite at a time.** Enforced in-process; the machine-wide lock (`/tmp/fleet-e2e.lock`, taken
  by `e2e-stage.sh` inside the clone) is deliberately not duplicated.
- **The daemon reports the sha it actually checked out.** After a successful clone it runs
  `git rev-parse HEAD` in the tree and sends the result as `clonedSha`; the Fleet stores it under
  `remote.clonedSha` on the ledger row, BESIDE — never instead of — the `mainSha` the server derived
  from the bundle header it built. The two answer different questions: `mainSha` is what was handed
  over, `clonedSha` is what was run. Until this existed, a remote red over a repo somebody was
  editing in parallel could not be adjudicated at all, because "the helper measured a different
  tree" was neither provable nor refutable (2026-08-29, `748ec97`). Measured or absent: a rev-parse
  that fails sends no field, and the server drops anything that is not 40 hex digits — an absent
  field is honest, a stored non-measurement is not.
- **A tree that could not be prepared reports `unknown`, never `red`.** A failed clone or install
  reports exit 127 and a timeout reports no exit code at all — both of which the Fleet classifies
  as "nothing was measured". A red for a suite that never ran is the one lie this rail must not
  tell.

- **It updates itself, as a job — and the check comes before the swap.** The owner queues one
  `daemon-update` per device (`POST /api/helper/devices/:id/update`, owner token; a queued or
  claimed one answers 409, an unknown device 404, a fleet with no checkout 503). The row is a
  wish like `desiredMode`: nothing is pushed, the daemon finds it on its own poll, and only the
  device it is addressed to is ever offered it. It then does four things in this order and no
  other: clone the fleet's main out of the bundle into `<workDir>/tree-<sha>` · parse-check the
  new daemon there (`bun build --target=bun helper-daemon/daemon.ts` — **not** `bun --check`,
  which on Bun 1.3.9 is no check at all and RUNS the file) · move the `checkoutLink` symlink
  (`<workDir>/current` unless configured) onto the new tree with a create-and-rename, so at no
  instant does it point at an unchecked tree · exit 75. The unit's `RestartForceExitStatus=75`
  restarts it from the link; the previous tree stays on disk, and `ln -sfn` back onto it is the
  whole rollback. A tree that fails the check is reported (`failed`), the link is not moved, and
  the daemon keeps running. The proof the update TOOK is not the result POST but the next
  heartbeat: it carries `daemonSha`, the `git rev-parse HEAD` of the tree the daemon booted from,
  and the board shows it beside the sha it bundled.

- **Wake-on-LAN is the ONE named exception to "no push", and it is named here so nothing else can
  quietly join it.** Everything above is a pull: the Fleet answers, this machine asks. A magic
  packet is the single case where the Fleet emits something towards a helper, and what makes it
  acceptable is exactly what makes it useless for anything else — a connectionless UDP broadcast
  carrying six `0xFF` bytes and a MAC sixteen times, no credential, no session, no addressee that
  can answer, and no effect on the machine beyond switching it on so it can start *polling*, as
  before. The other two non-goals are untouched: still no ssh runner, still no server-side
  auto-dispatch (a woken machine claims its own work or claims nothing).

  Two doors, both refusing rather than throwing when the host is not configured for it:

  - `POST /api/helper/devices/:id/wake` (owner token, beside `/mode` and `/update`). Answers
    `{sent, at, deviceId}`. `sent: true` means **the frame left this box** — never that the machine
    is awake; WoL has no acknowledgement, and the next heartbeat is the only thing that answers
    that. Unknown device → 404, no MAC for it → 409, no wake address on the host → 409.
  - the **auto-wake tick**, which sends at most one frame per tick and only when all three hold:
    a helper job is open and unclaimed, the owner's wish for that device is `active`, and its last
    heartbeat is older than `FLEET_HELPER_WAKE_AFTER_MS`. Then `FLEET_HELPER_WAKE_BACKOFF_MS` per
    device, stamped on a failed attempt too — a box that cannot boot must not be packeted forever.

  **Configuration is env on the Fleet host and never a tracked file** (this repository is public),
  and none of it ever enters an API response: the board learns only `wakeConfigured` and
  `lastWakeAt`.

  | variable | meaning |
  | --- | --- |
  | `FLEET_HELPER_WAKE_ADDR` | **required, no default.** The subnet-directed broadcast address of the segment the helper is on (`x.x.x.255`). Unset ⇒ both doors 409 and no tick is armed. |
  | `FLEET_HELPER_WAKE_PORT` | UDP port, default `9`. |
  | `FLEET_HELPER_MAC_<DEVICEID IN CAPS>` | that device's MAC, e.g. `FLEET_HELPER_MAC_SECONDHOSTLINUX1=00:11:22:33:44:55`. Colons, dashes or bare hex; anything unparseable reads as *not configured*. |
  | `FLEET_HELPER_WAKE_AFTER_MS` | silence before the tick will wake it, default 600000. |
  | `FLEET_HELPER_WAKE_BACKOFF_MS` | per-device pause after a frame, default 900000. |
  | `FLEET_HELPER_WAKE_TICK_MS` | the tick's own clock, default 30000. Its own knob rather than `FLEET_HELPER_SWEEP_MS`, which `HELPER_FRESH_MS` is derived from. |

  **Why there is no `255.255.255.255` default** — measured on the Fleet host 2026-09-03: from a
  socket bound to `0.0.0.0` on macOS that address fails `EHOSTUNREACH` *even with* `SO_BROADCAST`
  set, while the subnet-directed address sends 102 bytes at once. A default would therefore be a
  value that throws in production while a suite pointed elsewhere goes green. The same measurement
  is why `setBroadcast(true)` is a pinned requirement and not an option in the constructor: Bun
  1.3.9 accepts any unknown constructor option silently (`{thisOptionDoesNotExist:true}` too), so
  only the *method* call is evidence — without it every broadcast send fails `EACCES`.

  **What is NOT measured, and is not claimed:** whether a frame arrives. WoL does not travel over
  Tailscale — the Fleet host and the helper must share an L2 segment, or the router must forward
  directed broadcast. Nothing in this repo tests that; the first real wake is an owner act.

## Deploying it

`fleet-helper.service` is a template with ALL-CAPS placeholders and no host, address or credential
in it — this repository is public. Installing it on the helper machine is an **owner act**
(programme plan `docs/attic/linux-second-host-programm-2026-08-28.md`, gate G2); nothing in this repo
deploys itself.

**The last manual deploy** is the one that moves the unit onto the symlink. After it, every
further deploy is a `daemon-update` job queued from the board. On the device, as the service
user unless noted (WORK-DIR is the config's `workDir`):

    git clone <the fleet repository> WORK-DIR/tree-bootstrap      # or fetch+checkout main in the existing one
    ln -sfn WORK-DIR/tree-bootstrap WORK-DIR/current
    # the suite calls ast-grep by name: put its directory into the unit's Environment=PATH line
    sudo cp WORK-DIR/current/helper-daemon/fleet-helper.service /etc/systemd/system/fleet-helper.service
    #   …then replace USER, GROUP, WORK-DIR, BUN-PATH, BUN-DIR in that copy
    sudo systemctl daemon-reload && sudo systemctl restart fleet-helper
    journalctl -u fleet-helper -n 3     # "helper-daemon up: … running <sha> from WORK-DIR/tree-bootstrap/helper-daemon"

## What proves it works

`e2e/helper-daemon.ts`, driven by `./e2e-postland-audit.sh` — it runs this daemon against a scratch
Fleet instance through a counting proxy, and asserts the claim, the clone, the install, the verdict
on the audit ledger with its `remote` provenance, the zero-request `off` mode, and the
single-request refusal of a bad token.

The **wake** rail above is proved by the same wrapper in `e2e/helper-portal.ts` §(W), against a real
UDP listener in the harness process rather than a spy on the server: one POST yields exactly one
102-byte frame with the configured MAC; an absent or unparseable MAC and an unconfigured address
each yield 409 and no frame; and the tick sends nothing while no job is waiting, exactly one when
one is, and nothing more inside the backoff. `e2e/pins.ts` holds the doctrine half — one UDP call
site in the whole server, it calls `setBroadcast`, and no MAC is written down anywhere in the
shipped code.
