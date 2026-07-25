# Feature intake — an email address that files tasks

The dashboard has a public **task inbox**: `POST /intake`, reachable on the share
host (the Cloudflare-tunnelled domain) alongside the guest share routes. Anyone
with the shared secret can drop a feature request; it lands in the queue as a
**`pending`** task. Nothing runs until *you* promote it to `queued` in the queue
panel (🗒). External text is never a command — it is a note you review.

This lets you hand someone (e.g. a CEO) an **email address** they can send
feature ideas to, which show up in your dashboard queue.

## Security model (read before enabling)

- **Own secret, never the owner token.** Set `FLEET_INTAKE_SECRET` to a long
  random string. Requests must send it as the `X-Intake-Secret` header. The
  compare is constant-time; a wrong/absent secret is a 401.
- **Disabled by default.** No `FLEET_INTAKE_SECRET` → `/intake` returns 404.
- **Only ever creates `pending` tasks.** There is no path from intake to a
  running session. Promotion to `queued`, and any dispatch, is owner-only.
- **Caps:** text is truncated to 20 000 chars (`MAX_TASK_TEXT`); max 30 submissions
  per rolling hour (429 after that). **Corrected 2026-07-25 — read the two caveats
  before exposing this endpoint:**
  - *The 200-task queue cap does not bind intake tasks.* `capTasks` evicts only
    `status === "done"` ("a still-pending/queued/sent task must never be evicted"),
    and intake always writes `status: "pending"`. `queue-automation.md` states it
    correctly ("keeps all live + newest done"); this line had dropped the qualifier.
    So the retained-state bound on intake is not 200 — it is however many pending
    tasks the owner has not dispositioned, each one persisted in `fleet.json` and
    rewritten in full on every `saveState`.
  - *The hourly limit is per boot.* `intakeStrikes` is an in-memory array and is not
    in `saveState`'s body, so the window resets to zero on every server restart —
    unlike the steward's send caps, which are deliberately re-derived from
    `audit.jsonl` (`stewardRecentSends`) precisely to avoid a restart-fragile counter.
- **Reachable on the share host** (exact path `/intake` only) — it does not
  widen the share-host allowlist to anything else.

## Enable it

```sh
# in the server's environment (launchd plist / watchdog.sh export)
export FLEET_INTAKE_SECRET="$(openssl rand -hex 24)"
```

Restart the server (`tmux -L claudefleet kill-session -t srv`). Verify:

```sh
curl -sS -X POST https://cowork.example.com/intake \
  -H "X-Intake-Secret: <the secret>" \
  -H "content-type: application/json" \
  -d '{"text":"add dark-mode toggle","from":"jane@acme.co"}'
# → {"ok":true}
```

## The email address: Cloudflare Email Worker

Cloudflare Email Routing can deliver a mailbox to a Worker. The Worker turns the
email into an `/intake` POST. Route e.g. `features@example.com` to this
Worker (Cloudflare dashboard → Email → Email Workers):

```js
export default {
  async email(message, env) {
    // pull the plain-text body (fall back to raw stream)
    let text = "";
    try {
      const reader = message.raw.getReader();
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
    } catch { text = message.headers.get("subject") ?? ""; }

    // keep it small; the server caps at 20k anyway
    const body = `${message.headers.get("subject") ?? ""}\n\n${text}`.slice(0, 20000);

    const res = await fetch("https://cowork.example.com/intake", {
      method: "POST",
      headers: {
        "X-Intake-Secret": env.INTAKE_SECRET,   // set as a Worker secret
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: body, from: message.from }),
    });
    if (!res.ok) message.setReject(`intake rejected: ${res.status}`);
  },
};
```

Set the Worker secret: `wrangler secret put INTAKE_SECRET` (same value as
`FLEET_INTAKE_SECRET` on the server). Now anything emailed to that address
appears in your queue as a pending task from that sender — you review, then
queue or discard.

**Note:** a raw MIME body will include headers/encoding; the snippet above is
deliberately minimal. For clean plain-text extraction use a MIME parser
(e.g. `postal-mime`) in the Worker. Untrusted by design — you read every task
before it does anything.
