# Claude Fleet

**Fleet is built to be the harness where one agent becomes very capable, constellations of such agents solve hard tasks in the highest quality, and many people build on each other's setups.** It starts from the coding agent you already use. A session in Fleet is your own Claude Code with what Fleet adds on top: a few texts and settings, each one switchable, each one shown word for word before the session starts. Your own files stay as they are, with one exception named below.

*Set up an agent well. See exactly what it gets. Share it.*

**Experimental.** Fleet is young and changes every day. More than code contributions, I'm looking for people to think it through with me: whether the ideas hold, what is missing, what is confusing. If that speaks to you, open an issue. I'd like to talk.

## What you can do with it

- **Run your Claude Code as you know it**, in a dashboard that keeps every session alive in its own terminal, side by side, on your desktop and on your phone.
- **Add what helps, one piece at a time.** Context packs are how-tos written for agents: how to work with you, how to check its own work, how to hand work to another agent. On top of those come a notebook its successor reads, rights that limit what it may change, its own branch that reaches `main` only through a merge check, and a handover to a fresh session before its context runs full. Each one says what the agent can do with it.
- **See exactly what it gets.** Before a session starts, the start brief shows every text it will read, in the order it reads them, compared with a plain `claude` in the same folder. What you see is what starts.
- **Share it.** An agent you set up travels as one file. Another Fleet imports it and starts the same setup, and the setup hash in the file shows that it is the same. A changed setup says which one it was derived from. For now a context pack you wrote yourself stays home: see Status.
- **Let an agent build the next one.** A session can write a context pack for its successor and hand over to it. You judge the new version by working with it.
- **Go further when the work needs it.** An orchestrator agent opens a session on its own branch for each piece of work and brings back the result. A second computer can run its own Fleet, steered from either one. A helper machine runs the checks. A test instance lets you try a change to Fleet itself before it lands.

## Status

Fleet is young, and it is in the middle of a rebuild (November 2026).

- **In use:** sessions and the dashboard, the start window and its start brief, context packs, branches with their own worktree, the merge check, land and post-land audit, deploy, sharing an agent as a file, the orchestrator, and the mailbox between sessions.
- **On ice:** the task queue and its cards, the dispatcher, and Programs with their MAIN sessions. They worked. They rest while the new system takes shape, and their code is still here. [How it works inside](docs/how-it-works.md#where-the-parts-on-ice-live) shows where each part lives.
- **Not yet:** a context pack you wrote yourself doesn't travel yet. The file holds an empty place for it that the receiver fills, and the hash covers the empty place, so the same hash doesn't mean the same pack. **Share…** downloads the file at once, without showing first what travels. An agent from someone else's file doesn't ask first yet: read what the file starts before you start it. The pack on Fleet's doors, which many agents read, is long and still describes the parts on ice. Tasks and runs don't travel in the shared file yet. A saved agent with a purpose, the Super FleetBot too, can't change its model or packs in the window yet, and a copy of it is held the same way. Fleet has been started from this copy under a new user on a second machine, but no one but its builders has walked this path yet, so expect the first steps to catch. Claude Code is the harness Fleet is built around; adapters for Codex and Pi exist. An orchestrator for your own projects is coming; the built-in one is set up to work on Fleet itself.

## Quick start

**Requirements:** [Bun](https://bun.sh), tmux, git, at least one agent CLI, macOS or Linux. Without tmux the server stops at boot with a raw error; without an agent CLI a session shows a bare shell error in its pane. Your first session shows Claude Code's own first run in its pane, its login included.

```sh
bun install
bun run build
bun server.ts            # binds 127.0.0.1:8790 unless FLEET_HOST/FLEET_PORT say otherwise
```

On boot the server prints a one-click login URL carrying the access token, but only when stdout is a terminal; redirected to a log, it withholds the token, which then has to be read out of `fleet.json`. The token goes into a `SameSite=Strict` cookie, so you log in once per browser.

An empty board shows **Start your agent**; with a session already open, a free place in the sidebar does the same. In the window that opens, pick the folder your agent works in: **Choose a folder…** on an empty board, **Another folder…** once a row exists, both take a path you paste (a relative one reads from the folder shown above the field). Then press **Start** on the agent you want. To read the start brief first, press the agent's row for its setup screen and open **Start brief** there.

**To update:** `git pull`, `bun install`, `bun run build`, then start it again.

Fleet writes its state, `fleet.json` with your token and the session streams, into the folder you cloned it to. A second Fleet on the same machine is a second clone, with its own `FLEET_PORT` and its own `FLEET_SOCK`: the default tmux socket is shared, and two Fleets on it would see each other's sessions.

## What Fleet does on your machine

- **Your files stay as they are, with one exception.** Fleet changes none of your `CLAUDE.md`, settings, skills or hooks. The exception: so a session in a new folder doesn't stop at Claude Code's trust question, Fleet writes that folder's trust entry into your `~/.claude.json`, and it stays there; the start brief names it. It keeps its context packs as skills in a folder of its own state and adds them to a session's start when you switch them on.
- **Agents in Fleet run as you:** they can read what you can read and reach what you can reach, unless a fence says otherwise. That includes your owner token in `fleet.json`, so rights steer an agent, they don't contain it. Fleet's fence exists only for models from other providers.
- **A reachable Fleet is remote code execution as your user**, because every session is a shell. Read [Security and trust model](#security-and-trust-model) before you bind it to anything but loopback.

## Security and trust model

A reachable fleet is **remote code execution as your user** — every session is a shell. In order:

1. **Bind address** — loopback by default. `FLEET_HOST` should only ever name a private address on a
   network you trust end to end; traffic is plain `ws://`, so anything but an encrypted overlay is
   sniffable.
2. **Owner token** — required on every API and WebSocket request (`server.ts#tokenGate`), generated
   on first boot, persisted in `fleet.json` at mode 600, overridable with `FLEET_TOKEN`. It is the
   whole owner authority: there is one principal, not accounts.
3. **Self-token** — each session additionally holds a scoped credential (`Slot.selfToken`) that can
   only ever act on its own slot. It is what makes `/api/self/*` safe to hand to an agent: the route
   binds to the token's slot, a `slot` field in the body is ignored, and lane-only doors answer a
   non-lane `409`, never `401`. Because the credential is exported into the pane's shell, it is
   visible in that machine's process list — a hygiene fact, not isolation. Scope list:
   `docs/self-api.md`.
4. **Share links** — a share is a *window*, not an account: password-gated, view-only, one slot, and
   served on its own hostname set (`FLEET_SHARE_HOSTS`) where everything else 404s. See
   [SHARING.md](SHARING.md).
5. **Cross-site guards** — `SameSite=Strict` cookie plus Origin and Host checks
   (`server/auth.ts#guard`) block cross-site WebSocket hijacking, CSRF and DNS rebinding. Reaching
   the fleet by hostname needs that name in `FLEET_ALLOWED_HOSTS`.
6. **Session command** — `FLEET_CMD` (default `claude`) is the base line. A claude session Fleet
   spawns outside a container runs in Claude Code's auto mode, except the orchestrator, which runs
   in `bypassPermissions`, and a session you start with **No limits**: Fleet sets the mode
   per role and passes the classifier environment per launch in `--settings`
   (`server/session-start.ts#startAspects`), and it takes `--dangerously-skip-permissions` off the
   line, so the old bypass opt-in in `FLEET_CMD` no longer applies there
   (`server/session-start.ts#withoutSkipPermissions`). The exception is a session in its own setup,
   one without a standing role in a folder outside Fleet's repo (`server/eigenes-setup.ts`): it keeps
   your own permission mode unless you choose one in the start window. The worker tier (summaries, reviews, merge
   resolver) runs `--permission-mode dontAsk` with a fixed tool profile. A line Fleet sets no mode on
   — the container adapter, a foreign harness, a non-claude `FLEET_CMD` — runs `FLEET_CMD` as it is.
   Stream files and state are chmod 600/700, because terminal output contains secrets.

Not provided: TLS, multiple users, rate limiting. Two suites hold the perimeter rather than one:
`e2e/security.ts` pins which routes are reachable *above* the owner gate at source level, and
`fleet-e2e-security.ts` (run by `./e2e-security.sh`, which the land gate runs) drives the share
brute-force lockout, the injection charsets, the self-token's out-of-scope refusals, and the proof
that a `pending` row is never dispatched.

## Known limits

- **One suite at a time.** The verify gate, the previews and the audit all serialize on a single
  machine-wide lock (`server.ts#holdSuiteLock`). A land can therefore wait minutes for the machine
  without ever looking at its own tree, and the code says so rather than calling it a red.
- **The suite is not deterministic.** Known flake families are tracked in `docs/verify-tiering.md`
  and adjudicated per audit row; a green re-run at a base rate of a few percent proves little, which
  is why the trail register exists instead of a re-run rule.
- **Caps are blunt.** Lanes per repo, tasks, programs, watches, autos and report sizes are all fixed
  numbers in `server.ts`. They bound damage; they do not schedule intelligently.
- **The land path mutates a tree someone may be sitting in** — if a worktree has the integration
  branch checked out, the fast-forward happens inside it (`docs/land-mechanics.md`).
- Single shared owner token, no TLS, no rate limiting: the private network is part of the trust
  boundary.
- `streams/*.raw` grow unbounded; killing a slot deletes its stream.
- One terminal size per session, last writer wins — two clients on one slot fight over width.
- xterm is pinned at 5.5.0; 6.x removed the overflow-scroll viewport the mobile scrollback depends on.

## License

MIT. Fleet began as a fork of [claude-deck](https://github.com/jp290/claude-deck).
