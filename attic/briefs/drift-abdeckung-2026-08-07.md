# Der Drift-Abdeckungs-Join — Schwelle B kann nicht mehr auslösen (2026-08-07)

*Herkunft: Queue-Zeile `caaf8b16`, gefahren als Lane `fleet/260806231636-b1c7` (Slot 4) am
2026-08-07 gegen Baum `dc2940e`, read-only im Haupt-Checkout. Geerntet aus der Pane von Session 34
(main), weil die Zeile `FILES: keine (Messung im Haupt-Checkout)` trägt: das Ergebnis ist ein
BERICHT, kein Commit, und lebte bis zu diesem Commit ausschließlich im Scrollback.*

---

## 0 · Was die Zeile verlangt hat

> DONE: eine Zahl im Report — Anteil der gelandeten Lanes, die ihren Drift **vor dem letzten Drittel**
> ihrer Lebenszeit geprüft haben, über **≥20 gelandete Lanes**. Liegt er unter 20 %, ist die
> CLAUDE.md-Anweisung als Mechanismus widerlegt und **Schwelle B** (Drift-Hinweis in den
> Gründungsbrief) wird Pflicht statt Option. VERIFIKATION: der Block ist die Verifikation; Ausgabe
> wörtlich in den Report, keine Suite.

Basiswert vor der Einführung: `landed 78, checked 0`.

---

## 1 · Was der Block wörtlich liefert

```json
{
  "landed": 91,
  "checked": 13,
  "early": 10
}
```

## 2 · Warum 10/91 nicht die Zahl ist

Der Nenner `landed: 91` enthält die **78 Lanes des Basiswerts, die das Instrument gar nicht erreichen
konnten**: der erste `self_drift`-Eintrag steht bei `ts=1786025947269` = 2026-08-06 16:19:07 (Commit
`2ada187`). Alles davor ist **strukturell ungemessen, nicht ungeprüft** — der Doc-Kommentar sagt das
selbst („Basiswert … landed 78, checked 0 — die Frage war unbeantwortbar"), aber der Block rechnet
die 78 trotzdem in die Quote.

Aufgetrennt nach Instrument-Fenster:

```json
{
  "alle":                         { "landed": 91, "checked": 13, "early": 10 },
  "nach_instrument":              { "landed": 13, "checked": 13, "early": 10 },
  "frueh_fenster_instrumentiert": { "landed": 13, "checked": 13, "early": 10 },
  "checked_aber_vor_instrument": 0
}
```

Die drei Populationen fallen zusammen — es gibt **keine** geprüfte Lane von vor dem Instrument, und
**keine** der 13 verliert ihr frühes Fenster an die Einführungsgrenze.

**Gegenprobe bestanden:** 13 Lands nach dem Instrument auch ohne den `sessionMs>0`-Filter (der Filter
verwirft keine), und die 14. driftende Branch `…-51bf` ist korrekt draußen — `disposition:
killed-empty`.

**Anteil auf der messbaren Population: 10 von 13 = 76,9 % früh. Abdeckung überhaupt: 13 von 13 = 100 %.**

## 3 · Je Lane (`frac` = wann der erste Drift-Check fiel, in % der Lebenszeit)

```
fleet/260806133227-417c    67min   53%  frueh
fleet/260806143201-5684    73min    0%  frueh
fleet/260806163547-bc88    20min   43%  frueh
fleet/260806162942-6102    53min   57%  frueh
fleet/260806085148-3de0   557min   90%  spaet
fleet/260806173247-a20f    42min   36%  frueh
fleet/260806172211-613f    65min    2%  frueh
fleet/260806173638-7bbe    63min    0%  frueh
fleet/260806173048-c398    81min   35%  frueh
fleet/260806190701-3350    73min   90%  spaet
fleet/260806163737-7852   296min   77%  spaet
fleet/260806214130-0e6b    27min   48%  frueh
fleet/260806221017-324f    29min   47%  frueh
```

---

## 4 · Verdikt zur Schwelle

Das DONE verlangt ≥20 gelandete Lanes — die messbare Stichprobe ist **13**, die Zahl ist also **noch
nicht abnahmereif**. Die Entscheidung, die daran hängt, ist trotzdem **schon geschlossen**: `early`
kann nur wachsen, also liegt die Quote bei n=20 im schlechtesten Fall bei 10/20 = **50 %**.

**Schwelle B kann nicht mehr auslösen — die CLAUDE.md-Anweisung ist als Mechanismus nicht widerlegt,
sondern bestätigt.** Die 7 fehlenden Lands sind Formsache, keine offene Frage; wer will, kann bei
n=20 nachzählen, das Ergebnis steht fest.

---

## 5 · Zwei Befunde nebenbei

1. **Der Block als Instrument ist irreführend, solange die Vor-Instrument-Lanes im Nenner stehen.**
   Er liefert heute **11 %** — genau *unter* der 20-%-Schwelle, die B zur Pflicht machen würde, und
   das rein als Artefakt der Einführungsgrenze. Wer ihn in einem halben Jahr blind ausführt, liest
   ein falsches Verdikt ab. **Kosten: eine Fehlentscheidung pro naivem Leser.** Fix wäre ein
   `--argjson instr <erster self_drift ts>`-Filter im Block; die Lane hat die Datei nicht angefasst
   (`FILES: keine`).
2. **Drei der zehn „frühen" Checks liegen bei 0 %, 0 % und 2 %** — die Lane fragt praktisch beim
   Spawn, gegen einen Baum, von dem sie gerade geforkt hat. Formal erfüllt („vor dem letzten
   Drittel"), **informationsarm**. Unkostierte Beobachtung; wenn die Quote je zum Steuersignal wird,
   misst sie in dieser Form auch Reflexe mit.

**Rotationsblindheit:** aktuell nicht wirksam — `audit.jsonl.1` existiert nicht und hat nie
existiert (`ls audit.jsonl*` zeigt nur eine Datei). Der Doppel-Lesepfad ist heute Vorsorge, kein
tragender Teil des Ergebnisses.

---

## 6 · Owner-Auftrag, wörtlich, noch nicht ausgeführt

Der Owner hat am **2026-08-07** auf Befund (1) hin in den Composer von Slot 4 geschrieben —
abgeschickt wurde es nie, die Lane hat es nie gesehen:

> **`den instr-Filter in den Block in §12 einbauen`**

Als Queue-Zeile abgelegt. Diese Datei ist ihre Quelle.
