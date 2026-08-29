#!/usr/bin/env python3
"""Finde eine vergangene Claude-Code-Konversation an dem, was der OWNER getippt hat.

    python3 find-conv.py 'hugging ?face'
    python3 find-conv.py 'huggingface' --all     # auch Subagenten-Briefe zeigen

Warum so und nicht per grep: ~/.claude/projects hat ein SCHEMA (eine JSON-Zeile je Turn mit
`type`), und der Schnitt `type == "user"` ist selektiver als jede Textsuche — im Messfall
1434 MB -> 44 Dateien (grep) -> 11 Zeilen (dieser Schnitt). Voller Pass ueber das Korpus:
~8,5 s. Ein grep-Vorfilter ist hier MESSBAR LANGSAMER, weil ein Subprozess das echte
grep-Binary bekommt und nicht den ugrep-Shim der interaktiven Shell (docs/transkript-forensik-2026-08-29.md §4/§5).

`type:"user"` heisst NICHT "der Mensch hat getippt": Tool-Ergebnisse, <task-notification>,
<system-reminder>, <local-command-stdout> und der Gruendungsprompt jedes Subagenten stehen
ebenfalls darunter. Darum die Filter unten — und darum bleibt der letzte Schritt Lesen:
eine Owner-Zeile klingt wie Sprache, ein Subagenten-Brief klingt wie ein Brief.
"""
import json
import os
import re
import sys

NOISE = ("<task-notification", "<local-command-stdout>", "<command-name>", "<local-command-caveat>")


def texts(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(b.get("text", "") for b in content
                        if isinstance(b, dict) and b.get("type") == "text")
    return ""


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    show_all = "--all" in sys.argv[1:]
    if not args:
        print(__doc__.strip().splitlines()[0], file=sys.stderr)
        print("usage: find-conv.py <regex> [--all]", file=sys.stderr)
        return 2
    pat = re.compile(args[0], re.I)
    root = os.path.expanduser("~/.claude/projects")

    rows = []
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if not name.endswith(".jsonl"):
                continue
            path = os.path.join(dirpath, name)
            try:
                fh = open(path, errors="replace")
            except OSError:
                continue  # a transcript we may not read is not an answer, and not an error either
            with fh:
                for line in fh:
                    if not pat.search(line):
                        continue  # billiger Vorfilter auf der Rohzeile, spart das json.loads
                    try:
                        o = json.loads(line)
                    except ValueError:
                        continue
                    if o.get("type") != "user":
                        continue
                    t = texts(o.get("message", {}).get("content"))
                    if not pat.search(t):
                        continue  # Treffer lag im Tool-Output derselben Zeile, nicht im Gesagten
                    if not show_all and t.lstrip().startswith(NOISE):
                        continue
                    rows.append((o.get("timestamp", ""), os.path.relpath(path, root),
                                 o.get("sessionId", ""), " ".join(t.split())))

    for ts, rel, sid, t in sorted(rows):
        print(f"{ts} | {rel}")
        print(f"    {t[:240]}")
    print(f"\n{len(rows)} Zeilen in {len({r[1] for r in rows})} Transkripten", file=sys.stderr)
    print("Fortsetzen:  claude --resume <session-id>   (cwd = der Slug im Verzeichnisnamen)",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
