# helper-daemon — the other machine's half of the remote helper portal

Automates, unchanged, the ritual `src/helper.ts#bootstrapText` spells out for a human: claim a job
from a Fleet's portal, download its git bundle, clone it, `bun install --frozen-lockfile`, run the
suite, POST the exit code, the log tail and the trail id back.

It replaces exactly one sentence of the portal's Stage-1 non-goals — *"a human on the other machine
clicks claim"* (owner promotion G0, 2026-08-28). The other three stand and are not negotiable here:
**no server-side auto-dispatch, no ssh runner, no push.** The Fleet never opens a connection towards
the helper machine; everything this daemon does is a pull.

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
- **A tree that could not be prepared reports `unknown`, never `red`.** A failed clone or install
  reports exit 127 and a timeout reports no exit code at all — both of which the Fleet classifies
  as "nothing was measured". A red for a suite that never ran is the one lie this rail must not
  tell.

## Deploying it

`fleet-helper.service` is a template with ALL-CAPS placeholders and no host, address or credential
in it — this repository is public. Installing it on the helper machine is an **owner act**
(programme plan `docs/linux-second-host-programm-2026-08-28.md`, gate G2); nothing in this repo
deploys itself.

## What proves it works

`e2e/helper-daemon.ts`, driven by `./e2e-postland-audit.sh` — it runs this daemon against a scratch
Fleet instance through a counting proxy, and asserts the claim, the clone, the install, the verdict
on the audit ledger with its `remote` provenance, the zero-request `off` mode, and the
single-request refusal of a bad token.
