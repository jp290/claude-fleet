#!/usr/bin/env python3
# Stand-in for Claude Code's composer, for server/uebergabe-brief.test.ts: paints "❯ <buffer>" between two rules, is silent otherwise, and
# logs every submitted turn to tui.<slot>.<pid>.log beside this file. A paste lands in the buffer, a carriage return submits it, a line feed
# inserts a newline (as measured on a real seat). Fleet sees the pasted words in the field, so the delivery reads as observed.
import os, sys, tty, termios, select, time
BIN = os.path.dirname(os.path.abspath(sys.argv[0]))
SLOT = os.environ.get("FLEET_SELF_SLOT", "x")
LOG = os.path.join(BIN, f"tui.{SLOT}.{os.getpid()}.log")
fd = sys.stdin.fileno()
tty.setraw(fd)
buf = ""
def paint():
    try: w, _ = os.get_terminal_size(fd)
    except OSError: w = 200
    w = max(40, w - 3)
    rows = []
    for line in buf.split("\n"):
        if line == "": rows.append(""); continue
        while line:
            rows.append(line[:w]); line = line[w:]
    if not rows: rows = [""]
    out = "\x1b[2J\x1b[H\x1b[?2004hstand-in\r\n" + "─" * (w + 2) + "\r\n❯ " + rows[0] + "\r\n"
    for r in rows[1:]: out += ("  " + r if r else "") + "\r\n"
    out += "─" * (w + 2) + "\r\n"
    os.write(1, out.encode())
def submit():
    global buf
    with open(LOG, "a") as f: f.write(f"{time.time():.3f} TURN {len(buf)} {buf!r}\n")
    buf = ""
paint()
pending = b""
while True:
    r, _, _ = select.select([fd], [], [], 1)
    if not r: continue
    data = os.read(fd, 65536)
    if not data: break
    pending += data
    while pending:
        if pending.startswith(b"\x1b[200~"):
            end = pending.find(b"\x1b[201~")
            if end < 0: break
            buf += pending[6:end].decode("utf8", "replace").replace("\r", "\n")
            pending = pending[end + 6:]
            continue
        c = pending[0]
        if c == 0x1b and len(pending) < 6: break
        if c == 0x0a: pending = pending[1:]; buf += "\n"; continue
        if c == 0x0d: pending = pending[1:]; submit(); continue
        if c == 0x7f: pending = pending[1:]; buf = buf[:-1]; continue
        l = 1 if c < 0x80 else 2 if c < 0xe0 else 3 if c < 0xf0 else 4
        if len(pending) < l: break
        buf += pending[:l].decode("utf8", "replace"); pending = pending[l:]
    paint()
