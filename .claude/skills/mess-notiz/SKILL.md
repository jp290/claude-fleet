---
name: mess-notiz
description: Wenn dein Auftrag eine Messung oder Analyse ohne Code-Änderung ist — legt das Ergebnis als getrackte Notiz unter docs/messungen/ ab und committet es, damit die Lane landbar wird statt erntepflichtig.
---

# mess-notiz

Adaption von pstack/show-me-your-work (github.com/cursor/plugins, MIT, © 2026 Lauren Tan) für
Fleet-Lanes.

**Warum:** 123 von 567 Lane-Ausgängen endeten `killed-empty` (21,7 %, gegen 371 `landed`;
`lane-outcomes.jsonl`, frisch gezogen 2026-08-27; die ältere Lesung 97/350 = 28 % vom 2026-08-19 und
ihre Herleitung stehen in `docs/werkzeugkosten-grundlinie-2026-08-19.md` §4). Das ist der
Normalausgang einer Mess-Lane: das Ergebnis stand nur im Pane-Bericht und starb mit dem Slot. Eine
getrackte Notiz kostet einen Commit und macht aus „FILES: keine" ein landbares Ergebnis.

## Wann

Dein Auftrag lautet messen, zählen, vergleichen, prüfen, inventarisieren — und das Done-Kriterium
verlangt keine Änderung an Code. Dann gilt: **das Ergebnis ist eine Datei, nicht ein Bericht.**

Nicht anwenden, wenn die Lane ohnehin Code ändert; dort trägt der Commit-Body den Befund.

## Was

Eine Datei `docs/messungen/YYYY-MM-DD-<slug>.md`, getrackt und committet:

```markdown
---
frage: <eine Zeile — was gemessen wurde>
urteil: <eine Zeile — die ANTWORT, nicht die Zusammenfassung>
bereich: [<tag>, <tag>]
belege: [<pfad>#<symbol>, ...]
nicht-gemessen: <eine Zeile>
stand: YYYY-MM-DD
---

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

### Die sechs Front-Matter-Felder

Das Front-Matter ist der maschinenlesbare Teil der Notiz: es macht den Korpus querlesbar, statt nur
auffindbar. Alle sechs Felder sind Pflicht, in dieser Reihenfolge.

- `frage` — **was** gemessen wurde, eine Zeile. Deckt sich mit der Überschrift.
- `urteil` — die **Antwort**, eine Zeile, nicht die Zusammenfassung. „Nein, der Pin liefe in jeder
  Lane rot" ist ein Urteil; „Untersuchung der Pin-Frage" ist keins. Diese Zeile wandert wörtlich in
  den Index — sie muss allein stehen können.
- `bereich` — **freie Tags**, YAML-Liste, ein bis drei Stück. Kein festes Vokabular (Owner-Frage
  offen); nimm den Begriff, unter dem jemand die Notiz suchen würde.
- `belege` — YAML-Liste von Zeigern, `<pfad>#<symbol>` (`server.ts#handleSelfSucceed`), Commit-SHA
  oder Doc-Pfad. **Symbol, nicht Zeilennummer**, außer die Notiz trägt ein Datum im Namen und
  vermisst einen datierten Baum.
- `nicht-gemessen` — eine Zeile, was außerhalb lag. Die Kurzform des gleichnamigen Abschnitts; ein
  leeres Feld gibt es nicht, „nichts ausgeschlossen" wäre selbst eine Aussage.
- `stand` — `YYYY-MM-DD`, der Tag der Messung, nicht der Tag des Commits.

### Die Index-Zeile

Nach dem Schreiben der Notiz hängst du **genau eine Zeile** an `docs/messungen/INDEX.md` an:

```
- <urteil> — docs/messungen/<datei>.md · bereich: a,b · stand: YYYY-MM-DD
```

`<urteil>` ist wörtlich das Feld aus dem Front-Matter, `bereich` dessen Tags mit Komma verbunden.
Angehängt, nicht erzeugt: der Index wird von der schreibenden Notiz fortgeschrieben, nie aus dem
Korpus generiert — ein generierter Index driftet gegen die Dateien, ein angehängter kann es nicht.
Eine Notiz, eine Zeile; wer eine bestehende Notiz überarbeitet, ändert ihre Zeile, statt eine
zweite anzufügen. Das `urteil` darf kein ` — ` enthalten (Gedankenstrich mit Leerzeichen davor und
danach) — das ist das Trennzeichen der Zeile; steht es im Urteil, ist die Zeile nicht mehr
maschinell in Urteil und Pfad zerlegbar.

### Fremder Harness

Läufst du unter einem fremden Harness (`pi-*`, `codex`), gehört das Template oben **in den Brief**:
`.agents/` ist gitignored und existiert in keinem Worktree, dieses Skill erreicht dich dort also
nicht.

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
- Alle sechs Front-Matter-Felder gefüllt, und `docs/messungen/INDEX.md` trägt genau eine neue Zeile.
- Jede Trail-Zeile deckt sich mit dem, was wirklich passiert ist. Erfundene oder geplante Zeilen
  streichen.
- Im Report auf die Datei zeigen, nicht die Zahlen wiederholen.
