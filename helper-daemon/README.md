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

`instanceDir` is optional. Set it to the absolute path of this machine's Fleet checkout to
report its instance health on each heartbeat. The daemon reads that checkout only: its HEAD,
`src/` and `public/{app,share,helper,hub}.js` mtimes, the local `canonical/main` ref for the
commit distance, and `.fleet-sync-status.json` written by `fleet-sync.sh`. If any reading is
missing or outside the heartbeat's supported `syncExit` range 0–7, it omits `instance`; an
omitted field means no measurement, not a healthy instance. Leave `instanceDir` out on a machine
without that checkout.

## Explicit repo reports

`repos` is optional: `[{"name":"example-repo","path":"~/example-repo"}]`. Names are unique,
1–64 ASCII letters/digits/underscores/hyphens starting with a letter. Paths are local config
only; `~/` expands to this account's home. No disk discovery, fetch, remote URL reading or extra
network call occurs. Omit `repos` to keep the previous config and heartbeat bytes unchanged.
An explicit empty list reports no configured repositories; an omitted field means unreported.

Each existing heartbeat carries `repos:{at,repos:[...]}`: name, measured HEAD, branch (null
for detached HEAD), configured remote names, and locally stored remote refs with their HEAD,
unique merge-base and exact ahead/behind counts. A repo without remotes has `remote:"none"`.
Unreadable measurements stay null with a fixed reason, never a raw Git error. A ref's
`updatedAt` is its last local reflog update, or null; it does not prove remote freshness.
The configured directory must match Git's repository root after resolving symlinks;
a subdirectory reports null measurements with `not-repo-root`.
The Fleet exposes these readings as `helper-repo` carriers in `/api/worktrees`'s `stands`,
identified by Fleet machine name and repo name, with no helper path or network address.

Limits: 8 repositories, 8 remote names and 8 remote refs per repo, 512 exclusive commits per
comparison; larger or unfinished readings have incomplete coverage and a named reason.
The entire measurement has a 5-second budget, each Git command at most 750 ms and 32 KiB
stdout. Results are reused for 60 seconds, including failures, preserving the original
measurement time. Repo wire data is capped at 32 KiB; a heartbeat carrying it at 36 KiB total.
The receiver replaces malformed repo/ref rows with null measurements and `invalid-report`,
preserving healthy rows and other heartbeat fields. Full remote ref names avoid Git's ambiguous
shortening when a local branch has the same name. The configuration does not update or deploy a helper.

## The rules this file exists to keep

- **The token travels as the `x-fleet-helper-token` header and nowhere else.** Not in a URL (the
  portal page's `?token=` affordance is for a browser; the daemon refuses a `fleetUrl` carrying
  one), not in argv, not in an `Environment=` line, not in a log line. The config file must be
  `0600` — the daemon refuses to start otherwise, because a readable config has already handed the
  credential to every account on the box.
- **`off` means not one request.** Quiet hours, `enabled: false`, and an owner wish of `off` all
  stop the daemon before it makes any call at all — no heartbeat, no job poll. A machine that does
  not poll claims nothing, and a claim that is never made cannot be lost: the portal's expiry rail
  ends a claim that goes silent — a lane's preview gets its `unknown` verdict, and an audit job is
  offered again to the next claim (on a helper deployment never to the Fleet's own drain, see below).
- **On a helper deployment an audit is a helper's work ONLY — `FLEET_AUDIT_HELPER_GRACE_MS > 0`, on
  the Fleet side, is the switch** (since 2026-10-08, `eaef9c74`; `server.ts#AUDIT_HELPER_ONLY`,
  `server.ts#auditCadenceOf`, `docs/verify-tiering.md` §6.0b). The key's number is no longer read:
  above zero names a deployment that hands its offerable audits to a helper (live: `60000`). Unset
  or `0` — every harness, a deployment that never enrolled a helper — leaves the Fleet's own drain
  as the only runner, starting on the land; nothing in this bullet applies there.
  **TWO NUMBERS DECIDE WHEN — AND ONLY WHILE ANOTHER LAND IS ON ITS WAY** (since 2026-10-09,
  `server.ts#auditLandsInFlight`). With no further land of the repo reserved, running or pending on
  disk, the entry is due at once, ledger `trigger: "no-land"`: the window guessed when a burst is
  over, the land reservations say it (measured the night before: 1 206–1 220 s from land to audit on
  every quiet-released row). While one is, the repo's queue entry is held
  until the repo has been quiet for `FLEET_AUDIT_QUIET_MS` (default 1 200 000 ms = 20 min) since its
  newest unmeasured land, or until `FLEET_AUDIT_MAX_WAIT_MS` (default 3 600 000 ms = 60 min) after
  its OLDEST unmeasured land, whichever comes first — no daily cap, no night run. The quiet window
  bundles a burst into one run on the newest tip; the ceiling keeps a day that is never quiet from
  never being measured. The one exception is a deploy waiting on a tip (`server.ts#deployAuditOf`),
  which releases that tip's audit at once. While the cadence holds an entry it is not on this
  daemon's job list, its claim answers 409, and the wake rail sends no packet for it; the Fleet's
  drain looks again every 30 s whether the land it waits for has ended. The ledger row names what
  released the run: `trigger: "no-land" | "quiet" | "max-wait" | "deploy"`.
  **THEN IT WAITS FOR A HELPER, HOWEVER LONG THAT TAKES — THERE IS NO MAC FALLBACK.** A released,
  offerable entry is never run by the Fleet's drain: not after a wait, not after a lapsed claim
  (which reopens it for the next claim). A daemon that is `off`, quiet or switched off therefore
  leaves the audit queued, not run elsewhere. The wait is visible as `hold: "waiting for helper"`
  in `GET /api/post-land-audits` → `pending` (beside `hold: "quiet"` with `releaseAt` while the
  cadence holds) and in the land's memory view (`GET /api/self/memory`, `audit.hold`), and in the
  Fleet's `server.log` as `post-land audit QUIET: … until …` and `post-land audit WAITING: … —
  waiting for helper`. The drain does not ask whether a helper is online, fresh or full: the
  per-audit wait in milliseconds, the online-window reading, the clock from claimability and the
  saturation stretch that refined it until 2026-10-08 are gone with it (their measurements:
  `docs/messungen/2026-09-07-audit-platzierung-gnadenfrist.md`, the body of `eaef9c74`).
  **AND IT ONLY EVER HOLDS A JOB THIS DAEMON COULD ACTUALLY TAKE** (2026-09-08,
  `server.ts#helperClaimBar`). Four kinds of audit entry are never offered — a repo whose audit is
  its own repo-worker executable, an entry whose every land passed the docs-only gate (the Fleet
  audits that one with install+pins in seconds), a parked entry with no command, and (2026-09-13) a
  repo whose tree fails the Fleet audit command's own `[ -f … ] ||` guard or has no `package.json`
  for this daemon's install — measured 2026-09-02: Fremdprojekt was bundled and cloned here twice to
  end in `exit 127`, where the same entry declines locally in 223 ms. The Fleet runs the first,
  second and fourth kind itself, under the same two numbers (`post-land audit LOCAL: …` names the
  bar); the parked one waits until a command is configured. Drain, job list, claim door and wake
  rail ask the same predicate, so none of them waits for an offer that could never arrive.
  **A FULL MACHINE STRETCHES A LANE'S PREVIEW WAIT** (2026-09-13, `server.ts#helperSaturation`;
  measured 2026-09-12 13:49–14:27, both work-horse slots held while a lane's preview fell back to
  the Fleet after 180 s). When every claim-capable device is full — its own
  `running`/`maxParallelSuites`, or the claims the Fleet holds for it, whichever is larger — and the
  Fleet knows those claims, a lane's unclaimed suite offer is served a wait up to the earliest claim
  `expiresAt` plus two sweep intervals, capped at `FLEET_VERIFY_WAIT_MS`, as
  `waitPolicy.unclaimedMs` with a `reason` ("helper saturated until ~HH:MM"). A device that never
  reported a cap, or reports full with no claim the Fleet knows, is not saturated. An audit does not
  read this: it waits for the helper either way.
- **A job the Fleet takes back is ended here, not finished.** A lane that lands, is closed or is
  recycled takes its preview offer with it (the Fleet reaps it in the slot teardown); an audit
  claim that lapsed is offered again. Either way the Fleet would answer the verdict with `409 no
  live claim`. So while anything runs, every tick asks for the job list — **even at
  `freeSuiteSlots<=0` and even in `quiet`** — and a run whose job is no longer listed under the
  claim it got (`withdrawnRuns`) is aborted: its process tree gets TERM, then KILL after 5 s, and
  nothing is reported. Measured 2026-09-12 (7e601e57): before this, a full daemon never asked, and
  ran a landed lane's preview for 37 minutes to that 409. A list that could not be read aborts
  nothing.
- **Parallel runs are COUNTED, never derived from the load average.** `maxParallelSuites` (default
  `1`) is how many jobs this machine will run at once; the daemon claims only while the number of
  jobs it already has in flight is below it. The load cap stays as a *second* condition and never
  replaces the count — the 1-minute average is a lagging figure, and a suite that started twenty
  seconds ago has barely moved it. Measured on the work-horse 2026-09-06
  (`docs/messungen/2026-09-06-workhorse-parallel-suiten.md`): one `./e2e-isolated.sh` sits at load1
  0.21 mean / 0.94 peak, so `maxLoad1: 2` let a *third* audit through while two were running. Two
  parallel suites there cost +0.24 %/+0.29 % run time and 224 MB; more than two is not measured, so
  `2` is the value that fixture supports.

  Above `1`, each run gets its **own** `FLEET_SUITE_LOCK` (under its run directory), because
  `./e2e-isolated.sh` takes `/tmp/fleet-e2e.lock` through `e2e-stage.sh` *inside* the clone — two
  runs on one lock would serialize there and the second slot would only be a place in the waiting
  line. At `1` the shared default lock is deliberately left alone: that is what makes a
  hand-started suite on that machine serialize against this daemon's.

  At **every** cap each run gets `TMPDIR=<run dir>/tmp`, so the suite's instance (and the red one
  it keeps) lands on the work dir's disk beside `tree/` instead of in `/tmp` — on the work-horse a
  3.9 GB tmpfs that stood 98 % full of kept instances nothing ever pruned (2026-09-13). The lock
  path is a literal in `e2e-stage.sh` and tmux follows `TMUX_TMPDIR`, so neither moves with it.
  `keepRuns` counts FINISHED run dirs: a run still in flight is never pruned and never counted.

  At **every** cap, and for every job kind, each run also gets `FLEET_E2E_BAND`: the smallest port
  band index (`0`–`9`) no other run of this daemon holds, given back when the run ends
  (`daemon.ts#portBand`). `./e2e-isolated.sh` turns it into a 200-port sub-band of its own band
  (`8800 + 200·band + $$ % 160`), so two runs side by side can no longer bind the same port — before
  it, both took `8800 + $$ % 2000` and collided whenever their pids lay within the fixtures' port
  offsets (`+1` … `+29`) of each other: `EADDRINUSE` on 9857 in post-land audit e900ed30,
  2026-10-10. Without the variable the wrapper is unchanged. The other four wrappers (claude-gate,
  clean-review, security, postland-audit) read it the same way since d88483a5, each inside its own
  2000-port band (`base + 200·band + $$ % 160`); the bands are disjoint, so one index serves them
  all. If all ten are held the job is reported unrunnable (127), never run on a pid-derived port.

  The heartbeat carries `running` and `maxParallelSuites`, so the board shows `1/2 suite slots`,
  and the Fleet's claim door refuses a device whose own last heartbeat said it was full. That
  refusal uses nothing but the machine's own words — a device that reports neither field (a browser
  on the portal page, any daemon older than this) is uncapped, exactly as before.

  The same two figures size a sharded audit (2026-10-09, `server.ts#auditShardCount`; on only while
  the Fleet's `FLEET_AUDIT_SHARDS` is 2 or more): the FREE slots of every fresh `audit-shard` device —
  `maxParallelSuites` minus the larger of its `running` and the claims the Fleet holds for it, none
  while it drains for its own update — summed, minus one kept for a lane's preview, at most 8. Below
  three free slots the split is `FLEET_AUDIT_SHARDS` itself. The Fleet reads it at every job list and
  freezes it at the run's first claim; the shard ids carry their n, so a claim that arrives after the
  figure moved still opens the run it was shown. Nothing on this side changed for it: a daemon that
  already declares `audit-shard` needs no update.
- **The quieter of the two modes wins.** The owner's `desiredMode`, pulled in the reply to this
  machine's heartbeat, always wins downwards; it never overrides quiet hours or the load threshold
  upwards, because the person who set those is standing next to the machine. A heartbeat the Fleet
  answers with anything but 2xx carries no wish at all, so that tick ends there: no job list, no
  claim, one log line per status (before 2026-10-09 a refused beat read as `active`).
- **The clone always NAMES its ref.** A helper bundle carries exactly the refs it was built from
  and no HEAD, so a plain `git clone` of one checks a tree out only if git can *guess* the ref —
  and it guesses with `init.defaultBranch`. Where that is `master` (Debian's default, and the value
  of an unset one) the guess misses: the clone exits 0, warns `remote HEAD refers to nonexistent
  ref`, and leaves an EMPTY tree. So both kinds are cloned with `-b`: a lane-suite claim names that
  ref `branch`, an audit claim names it `main`. Measured live on the work-horse 2026-08-29 — before
  the fix an audit clone came back empty, `bun install --frozen-lockfile` found no `package.json`,
  and the ledger row read `unknown` for a suite that was never started. A clone that leaves no
  working tree now fails as ITSELF rather than as a failed install.
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
  whole rollback. Once the link has moved the daemon exits 75 even when the result POST fails, and
  a later claim of the same sha whose tree the link already names is reported as swapped and ends
  the process the same way — that tree is never removed, and pruning never touches the link's
  target. A tree that fails the check is reported (`failed`), the link is not moved, and
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
  | `FLEET_HELPER_MAC_<DEVICEID IN CAPS>` | that device's MAC, e.g. `FLEET_HELPER_MAC_helper-device-1=00:11:22:33:44:55`. Colons, dashes or bare hex; anything unparseable reads as *not configured*. |
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
(programme plan `docs/attic/linux-workhorse-programm-2026-08-28.md`, gate G2); nothing in this repo
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
