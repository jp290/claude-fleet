#!/usr/bin/env python3
"""A throwaway-worker wrapper that hands the prompt on stdin to DeepSeek.

Fits runWorker's SUBPROCESS seam exactly as server.ts spawns it:
`Bun.spawn([cmd, "--model", SUMMARY_MODEL])`, prompt on stdin, answer on stdout,
any non-zero exit surfaces as a worker failure (for commitMsg that is the visible
`messageFallback` + a deterministic `wip:` subject — never a lost commit).

Two things it does NOT do, both deliberate:

  * It IGNORES the `--model` it is handed. That value is a CLAUDE model id validated
    against MODEL_RE, and a foreign name (`deepseek-chat`) cannot travel through
    FLEET_SUMMARY_MODEL by design — server.ts keeps that charset narrow for the worker
    tier on purpose. So the model lives here, in the wrapper, which is the right cut.
  * It never reads the FLEET environment. summaryViaSubprocess spawns with the SERVER's
    env inherited, which carries the fleet token and everything in .env; a wrapper that
    forwarded any of it would hand a third party credentials the prompt never needed.
    The only secret it touches is its own key file, and the only thing it sends is stdin.

The key is read from a 0600 file OUTSIDE the repository (this file is public). Never an
argument: an argv value is visible in `ps` to every process on the machine, which is the
same reason guest-ctl.sh takes its token on stdin.
"""
import json
import os
import sys
import urllib.error
import urllib.request

KEY_FILE = os.path.expanduser("~/.claude-fleet-workers/deepseek.key")
API = "https://api.deepseek.com/chat/completions"
# Asked the provider rather than assumed (GET /models, 2026-08-08): this key reaches exactly
# `deepseek-v4-flash` and `deepseek-v4-pro`. The first version of this file pinned
# `deepseek-chat`, which ANSWERED but is no longer in the catalogue — a name that is served but
# unlisted is the kind that disappears without warning. Overridable so flash/pro can be compared
# on the same seam; an unknown name is the provider's 400 to give, not ours to guess at.
MODEL = os.environ.get("FLEET_DEEPSEEK_MODEL") or "deepseek-v4-flash"
TIMEOUT_S = 120


def die(msg: str) -> None:
    print(f"worker-deepseek: {msg}", file=sys.stderr)
    sys.exit(1)


def read_key() -> str:
    try:
        with open(KEY_FILE) as f:
            key = f.read().strip()
    except OSError as e:
        die(f"no key at {KEY_FILE} ({e.strerror})")
    if not key:
        die(f"key file {KEY_FILE} is empty")
    return key


def main() -> None:
    # --probe: prove the seam end to end (key, route, envelope, usage) without a fleet.
    probe = "--probe" in sys.argv
    prompt = "Reply with exactly: ok" if probe else sys.stdin.read()
    if not prompt.strip():
        die("empty prompt on stdin")

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }
    # Thinking OFF by default, and this is MEASURED rather than taken from documentation
    # (2026-08-08, same prompt, five runs incl. a control):
    #     default              prompt 163  completion 100  reasoning  89   1.8s
    #     thinking disabled    prompt  84  completion   6  reasoning  --   1.0s
    #     invented field       prompt 163  completion  69  reasoning  59   1.3s   <- the control
    # The control is the point: an OpenAI-compatible endpoint SILENTLY IGNORES unknown fields, so
    # "no error" proves nothing about a parameter. Only the collapse of reasoning_tokens does.
    # 100 -> 6 completion tokens at equal answer quality is the whole cost of this tier.
    #
    # It also explains a gap the provider's docs attribute to "different tokenization methods":
    # prompt_tokens is 163 with thinking and 84 without ON THE SAME MODEL, so the ~79 extra tokens
    # are the thinking scaffold, not a tokenizer difference.
    #
    # NOT taken from the same advice, deliberately: a hard `stop: ["\n"]` and `max_tokens: 64`.
    # They suit a commit SUBJECT and would silently truncate any other worker that one day points
    # its FLEET_*_CMD here — a wrapper that quietly cuts a reviewer's answer in half is worse than
    # one that is merely slow. The output contract belongs to the worker's prompt, not to this file.
    if os.environ.get("FLEET_DEEPSEEK_THINKING") != "1":
        payload["thinking"] = {"type": "disabled"}
    body = json.dumps(payload).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "content-type": "application/json",
        "authorization": f"Bearer {read_key()}",
    })
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        # the provider's own words, capped — a 401 and a 429 are different operator problems
        die(f"HTTP {e.code}: {e.read()[:300].decode('utf-8', 'replace')}")
    except Exception as e:  # network, TLS, timeout, malformed JSON
        die(f"{type(e).__name__}: {e}")

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        die(f"unexpected response shape: {json.dumps(data)[:300]}")

    # usage goes to STDERR so it can never contaminate the answer stdout carries. It is the
    # only honest basis for a cost figure: token counts measured, never estimated.
    u = data.get("usage") or {}
    print(f"worker-deepseek: usage {json.dumps(u)}", file=sys.stderr)
    print(text.strip())


if __name__ == "__main__":
    main()
