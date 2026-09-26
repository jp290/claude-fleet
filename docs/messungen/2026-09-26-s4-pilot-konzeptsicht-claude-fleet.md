---
frage: Laesst sich aus dem eingefrorenen Inventar per Code-Aufnahme K0, Map je Batch und Reduce eine Konzeptsicht "Claude Fleet" bauen, in der jeder inhaltliche Satz mechanisch auf eine Quelle zeigt?
urteil: Ja, mechanisch belegt; 7617 K0-Quellen (JS-Semantik, MAIN-Entscheid), 25 Batches, 1718 Aussagen-Datensaetze, Sicht mit 239 Saetzen und 428 zitierten Quellen aus 25 von 25 Batches, 29 Abloesungen, check.py ALL PASS und nachweislich rot faehig; der Pruefstein Bewerbungstext steht aus und faehrt die MAIN.
bereich: [konzeptgedaechtnis, s4, pilot]
belege: [docs/messungen/2026-09-26-s4-jev-ergebnis-messung4.md, docs/messungen/2026-09-26-s4-jev-vorregistrierung-messung4.md]
nicht-gemessen: inhaltliche Treue der Map-Aussagen gegen Gold; Sessions als Korpus; ob ein fremder Agent aus der Sicht einen brauchbaren Bewerbungstext schreibt
stand: 2026-09-26
---

# S4 Pilot — erste Konzeptsicht "Claude Fleet" aus dem Inventar

2026-09-26, Lane `fleet/260926130057-c1e5`, Program Konzeptgedaechtnis `31aa88ea`, Schnitt 2.
Frage: **Traegt die Kette K0 → Map → Reduce eine Konzeptsicht, deren Saetze alle mechanisch auf
Inventar-Quellen zeigen?**

Diese Notiz ist der oeffentliche Teil. Sie enthaelt Methode, Schema, Zahlen und Hashes, aber keinen
Satz Konzeptinhalt. Sicht, Quellen und Auszuege liegen privat unter
`~/claude-fleet-private/konzepte/pilot-claude-fleet-2026-09-26/`.

## Ergebnis

**Aufnahme K0.** K0 ist die Code-Regel `codeFleetRegel` aus `rubrik-v3.json` mit dem Flag `i`,
angewendet als "trifft irgendwo". Das entspricht Entscheidungsregel D4 aus Messung 4. Die Eingaenge
sind per Hash geprueft: Inventar `23babf3d…` (9923 Zeilen), Rubrik `b1d8a50f…`.

- **7617 Treffer:** 4622 commit-body, 2928 measurement-paragraph, 67 memory-line; zusammen
  3 664 362 Bytes Text.
- **Abweichung zur Zaehlung der MAIN (7616):** genau eine Quelle mit 406 Bytes, Kandidat `4f5d6cfa`.
  Ursache ist die Regex-Semantik. In JavaScript ist `\b` ASCII-basiert, ein Umlaut gilt dort als
  Nicht-Wortzeichen, und ein Wortanfang direkt vor einem Umlaut trifft. Python wertet `\b` nach
  Unicode aus und trifft dort nicht.
- **Entscheid:** Die MAIN hat per Report-Entscheid `62dc67c4` die JS-Zaehlung festgelegt, weil
  `lauf4/lauf.ts` K0 genau so gefahren hat. Die Quelle bleibt im Korpus.

**Datierung.** Alle 4622 Commit-Quellen sind datiert (0 fehlende Commits). Undatiert (`unknown`)
bleiben 126 Messnotiz-Absaetze und 39 Memory-Zeilen.

**Batches.** Der Korpus liegt in 25 Batches, chronologisch geschnitten, `unknown` am Ende.

- Batch 1–24: 148 990 bis 149 990 Bytes Text.
- Batch 25: 71 740 Bytes.
- Je Batch 135 bis 356 Quellen.

**Map.** Je Batch lief ein Subagent, 25 insgesamt, zusammen 4 530 634 Subagent-Tokens laut
Laufzeitmeldung. Er schrieb 50 bis 70 Datensaetze, zusammen **1718**. Nach Typ: teil 462,
messbefund 353, arbeitsregel 276, prinzip 240, grenze 162, owner-entscheidung 105, abgeloest 95,
zweck 25. Jede zitierte ID loest in ihrem eigenen Batch eindeutig auf; das prueft `check.py`.

**Reduce-Ergebnis (`check.py`, letzter Lauf).** Alle 7617 Quellen stehen in 25 Batches, und jeder
Batch hat eine Auszugsdatei.

- **Sicht:** 239 Saetze, jeder mit mindestens einer ID; 4482 Woerter ohne Zitatmarken.
- **Abschnitt Kern:** 334 Woerter, erlaubt sind hoechstens 400.
- **Zitierte Quellen:** 428, jede eindeutig in `quellen-k0.jsonl`. Der Quellenindex fuehrt fuer
  jede ID Pointer und Datum und stimmt mit den Quellen ueberein.
- **Abdeckung:** 25 von 25 Batches tragen zur Sicht bei, also 100 %.
- **Abloesungen:** 29.
- **Leak-Muster:** keine (CGNAT-Adressen 100.64/10, `FLEET_SELF_TOKEN=`, `sk-`, `ghp_`,
  E-Mail-Adressen).
- **Ende:** `ALL PASS`, exit 0.

**Rot-Nachweis fuer check.py:**

```
$ sed: [q:653a9a81] -> [q:653a9a8f] (erste Stelle im Kern)
$ python3 check.py
…
FAIL: zitierte ID 653a9a8f loest nicht eindeutig in quellen-k0.jsonl auf (0 Treffer)
exit=1
$ Leak-Mutation: Satz im Kern um eine E-Mail-Adresse ergaenzt
FAIL: Leak-Muster E-Mail-Adresse in der Sicht bei Offset 2865
$ zurueckgesetzt, python3 check.py
ALL PASS
exit=0
```

Nach dem Zuruecksetzen ist die Sicht byte-gleich mit dem Stand davor (gleicher sha256).

Der erste Lauf von `check.py` auf dem Entwurf fiel rot: ein Satz im Kern hatte keine ID. Der Satz
wurde belegt.

**Zahlenprobe (beratend, `zahlenprobe.py`).** Die Probe fragt: Steht jede Zahl eines Satzes woertlich
in mindestens einer seiner zitierten Quellen? Geprueft wurden 93 Zahlen. Der erste Lauf fand 9 ohne
Fundstelle:

- **5 unvollstaendig zitiert:** Die Sicht nannte nur einen Teil der Quellen des Map-Datensatzes. Die
  fehlenden IDs wurden ergaenzt.
- **1 ohne jede Quelle:** Eine Zeitspanne hatte die Map-Stufe hinzugefuegt. Sie wurde gestrichen und
  durch die in der Quelle genannte Grundgesamtheit ersetzt.
- **1 Schreibweise:** In der Quelle steht die Zahl in der Form `3,6 k`.
- **1 Ziffer in Prosa:** Die Ziffer wurde als Wort umformuliert.
- **1 Artefakt der Probe:** Deren Tausender-Normalisierung verklebte `p90 141`. Der Wert steht in
  der zitierten Quelle.

Endstand: 93 Zahlen geprueft, 1 ohne Fundstelle, und das ist das genannte Artefakt.

**Hashes:**
- `quellen-k0.jsonl`: `fb5d738432048d9603efde6622374dea68cda12b68a47d131560d625c4d2894e`
- `konzeptsicht-claude-fleet.md`: `17fc73bcc9f5bd9262c61bea35c41fa51e9a639346351630dae3b0250fbb46e1`

## Methode

1. **Aufnahme, deterministisch (`schritt1-k0.ts`, Bun).**
   - Hashes von Inventar und Rubrik pruefen.
   - Die Regex anwenden mit `new RegExp(regex, "i")` und `.test(text)`.
   - Datum je Quelle bestimmen:
     - Commit: `git log --no-walk=unsorted --format='%H %cI' --stdin` in diesem Repo, vorher
       `git cat-file --batch-check`; fehlt der Commit, dann `unknown`.
     - Messnotiz: erstes `YYYY-MM-DD` im Dateinamen.
     - Memory: erstes `20YY-MM-DD` im Text, sonst `unknown`.
   - Sortieren: Zeitstempel in UTC, reine Tage als Tagesbeginn, `unknown` zuletzt, bei Gleichstand
     nach `sourcePointer`.
   - Batches schneiden: hoechstens 150 000 Bytes Quelltext je Batch.
   - Das 8-Zeichen-Praefix der `candidateId` ist ueber alle 7617 Quellen eindeutig. Das Skript
     bricht sonst ab.
2. **Map.** Je Batch ein Subagent (`general-purpose`, parallel). Er liest nur seine Batch-Datei und
   schreibt `auszuege/batch-NN.json`. Er prueft selbst, dass jede ID in seiner Batch steht, und
   meldet nur eine Zaehlzeile zurueck. Der Batch-Text kam nie in den Kontext der Lane.
3. **Reduce.**
   - `merge.py` gruppiert die 1718 Datensaetze nach Typ und Datum.
   - Die Lane-Session liest sie und schreibt die Sicht. Bei widerspruechlichen Quellen gewinnt die
     juengere; die aeltere Fassung steht unter Abloesungen mit beiden Daten und IDs.
   - `build_index.py` erzeugt den Quellenindex mechanisch aus den Zitaten.
4. **Pruefung.** `check.py` ist der Gate, `zahlenprobe.py` beratend.

### Schema eines Aussagen-Datensatzes (Map-Ausgabe)

```json
{"aussage": "ein bis zwei Saetze, fuer Fremde verstaendlich",
 "typ": "zweck|prinzip|teil|arbeitsregel|owner-entscheidung|messbefund|grenze|abgeloest",
 "quellen": ["<8 Zeichen der candidateId>", "…"],
 "datum": "YYYY-MM-DD der juengsten zitierten Quelle | unknown"}
```

Vorgaben an die Map:

- 30 bis 70 Datensaetze je Batch, im letzten Batch 20 bis 50.
- Hoechstens 8 IDs je Aussage.
- Zahlen nur, wenn sie woertlich in einer zitierten Quelle stehen.
- Verboten in `aussage`: Adressen, Tokens, E-Mail-Adressen, Klarnamen, Pfade unter dem
  Benutzerverzeichnis.
- `abgeloest` nur, wenn beide Zustaende in derselben Batch belegt sind.

### Schema der Sicht

Abschnitte in fester Folge:

- Kern (hoechstens 400 Woerter)
- Tragende Prinzipien
- Teile
- Arbeitsregeln
- Owner-Entscheidungen
- Belegte Messbefunde
- Grenzen und Nicht-Ziele
- Abloesungen (frueher, dann spaeter, beide Daten und IDs)
- Quellenindex (`` `id8` · sourcePointer · datum ``)

Jeder Satz ausser im Quellenindex endet mit `[q:<id8>, …]`. Unterueberschriften (`###`) sind erlaubt
und brauchen keine ID. Der Vorspann vor dem ersten Abschnitt traegt nur Stand, Korpus und
Zitierweise.

Satzgrenze fuer `check.py`: ein `.`, `!` oder `?`, gefolgt von Leerraum und einem Grossbuchstaben,
einem Anfuehrungszeichen oder einer Klammer.

## Was nicht gemessen wurde

- **Map-Stufe ohne Gold.** Die Map-Stufe ist LLM-Urteil ohne Goldstandard. Ob eine Aussage ihre
  Quellen inhaltlich richtig wiedergibt, prueft `check.py` nicht; es prueft nur, dass die IDs
  existieren und aufloesen. Die Zahlenprobe prueft Zahlen, keine Behauptungen ohne Zahl.
- **Reduce als Urteil.** Aus 1718 Datensaetzen wurden 239 Saetze. Welche Datensaetze tragen, und die
  Regel "die juengere gewinnt", hat die Lane-Session per Lesen angewandt, nicht mechanisch.
- **Korpusgrenze.** Nur Commit-Bodies, Messnotiz-Absaetze und Memory-Zeilen. Session-Transkripte
  sind nicht im Korpus, obwohl die Saat im Kandidatenkatalog aus Sessions stammt.
- **Datierung.** 165 Quellen bleiben `unknown`. Memory-Daten stammen aus dem Text und koennen das
  Datum eines genannten Ereignisses statt der Niederschrift sein. Messnotiz-Daten sind Tagesdaten
  ohne Uhrzeit.
- **Abloesungen.** Ein Teil beschreibt den Vorher-Nachher-Stand aus einem einzigen Commit. Beide
  Daten sind dann dasselbe Belegdatum.
- **K0-Semantik.** Unter Python-Semantik fiele eine Quelle heraus (siehe Ergebnis). K0 ist eine
  lexikalische Regel und nimmt auch Quellen auf, die Fleet nur beilaeufig nennen.
- **Pruefstein offen.** Ob ein fremder Agent ohne Repo-Zugriff aus der Sicht einen brauchbaren
  Bewerbungstext schreibt, ist nicht gemessen. Das faehrt die MAIN.
- **Kein Jev-Aufruf.** Die Markierungen K3c und K4 aus D4 sind im Pilot nicht angewendet.
