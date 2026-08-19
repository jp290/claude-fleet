---
name: mess-notiz
description: Wenn dein Auftrag eine Messung oder Analyse ohne Code-Änderung ist — legt das Ergebnis als getrackte Notiz unter docs/messungen/ ab und committet es, damit die Lane landbar wird statt erntepflichtig.
---

# mess-notiz

Adaption von pstack/show-me-your-work (github.com/cursor/plugins, MIT, © 2026 Lauren Tan) für
Fleet-Lanes.

**Warum:** 97 von 350 Lanes mit Branch endeten `killed-empty` (28 %, `lane-outcomes.jsonl`,
gemessen 2026-08-19 — Herleitung in `docs/werkzeugkosten-grundlinie-2026-08-19.md` §4). Das ist der
Normalausgang einer Mess-Lane: das Ergebnis stand nur im Pane-Bericht und starb mit dem Slot. Eine
getrackte Notiz kostet einen Commit und macht aus „FILES: keine" ein landbares Ergebnis.

## Wann

Dein Auftrag lautet messen, zählen, vergleichen, prüfen, inventarisieren — und das Done-Kriterium
verlangt keine Änderung an Code. Dann gilt: **das Ergebnis ist eine Datei, nicht ein Bericht.**

Nicht anwenden, wenn die Lane ohnehin Code ändert; dort trägt der Commit-Body den Befund.

## Was

Eine Datei `docs/messungen/YYYY-MM-DD-<slug>.md`, getrackt und committet:

```markdown
# <Frage, die gemessen wurde>

<Datum>, Lane <branch>. Frage: **<die Frage in einem Satz>**

## Ergebnis
<Die Zahlen. Jede Zahl mit ihrer Definition im selben Absatz.>

## Methode
<Das ausgeführte Kommando bzw. der Skript-Block, so dass es jemand wiederholen kann.>

## Was nicht gemessen wurde
<Was außerhalb lag, was unklar blieb.>
```

Regeln für den Inhalt: der **unslop**-Skill gilt auch hier. Zahl statt Wertung, Beleg statt
Beteuerung, gemessen und abgeleitet getrennt.

## Entscheidungs-Trail (nur für autonome Läufe über ~30 min)

Zusätzlich im SELBEN Dokument, als Abschnitt `## Entscheidungs-Trail`, TSV-Zeilen, append-only:

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-08-19T09:02:00Z	korpus	nur Dateien mit usage-Zeile gezählt	ohne usage keine Token-Summe	skript §Methode	278 von 780
2026-08-19T09:40:00Z	replay	drei Definitionen getrennt geführt	ein Faktor ohne Nenner ist keine Zahl	docs/…-grundlinie §2	48x / 137x / ~40x
```

- Eine Zeile ist eine Entscheidung oder ein Kontrollpunkt, nicht jede Handlung.
- Eine Zeile ist einzeilig. Passt sie nicht in eine Zeile, ist die Entscheidung noch unscharf.
- Append-only. Eine falsche Entscheidung bekommt eine NEUE Zeile, die sie ablöst; nie editieren.
- `beleg` ist ein Zeiger: SHA, `datei:zeile`, Pfad. Nie ein Absatz.
- `ergebnis` darf `offen` oder `unklar` sein — das ist eine Aussage, kein Makel.

## Vor dem Fertigmelden

- Keine untracked Files im Worktree (sie blockieren das Land) — die Notiz gehört committet, Scratch
  in den Scratchpad.
- Jede Trail-Zeile deckt sich mit dem, was wirklich passiert ist. Erfundene oder geplante Zeilen
  streichen.
- Im Report auf die Datei zeigen, nicht die Zahlen wiederholen.
