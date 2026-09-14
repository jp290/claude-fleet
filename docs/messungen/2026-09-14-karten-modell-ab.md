---
frage: Kauft der Kartenwechsel Haiku 4.5 → Sonnet 5 (FLEET_CARD_MODEL, seit 2026-09-14 in .env) weniger echte Lesefehler und weniger answer/run-Fehler, mit alter und mit reparierter Vorlage (E1a, bb546bf2), gemessen an derselben Quelle und demselben Snapshot?
urteil: Nach der Vorab-Regel aus §5 E1c geht .env zurueck, denn Sonnet ist in den zwei Vergleichsklassen nicht besser; offene Zeilen Lesefehler+answer/run 13,8 % Haiku, 13,8 % Sonnet/alt, 13,1 % Sonnet/neu (Differenz 0,0 pp, 95-%-KI −7,8 bis +7,8). Die Regel setzte aber Sonnet als teurere Wahl voraus, und das ist widerlegt: p50 67 s gegen 10 s, 5 gegen 0 Laeufe ueber 120 s, Listenpreis 9,37 $ gegen 5,07 $ je 216 Laeufe (Haiku denkt ~7 000 Token je Karte). Die neue Vorlage senkt Vertragsfehler auf offenen Zeilen von 30,7 auf 19,0 %, die Gueltigkeit bleibt bei 30,7 %.
bereich: [karte, modellklassen, task-queue]
belege: [card-extract.ts#buildCardPrompt, card-extract.ts#parseCardAnswer, card-extract.ts#validateCard, task-metadata.ts#readTrackedSnapshot, task-metadata.ts#readSymbolIndexSnapshot, server.ts#extractCard, bb546bf2, docs/messungen/2026-09-14-queue-intelligenz-schichten.md §1 §5]
nicht-gemessen: der Live-Pfad (tmux-Session im Repo-cwd mit Projekt-CLAUDE.md statt claude -p aus dem Scratchpad); Latenz unter gleichbleibender Parallelitaet (drei Phasen 6/3/2–3 wegen Speicher-Kills); Tokenkosten der Live-Laeufe; ob die Lesefehler-Etiketten mit einer Handlesung uebereinstimmen (mechanisch, nicht einzeln gelesen)
stand: 2026-09-14
---

# Karten-A/B: Haiku 4.5 gegen Sonnet 5, alte gegen reparierte Vorlage

2026-09-14, Lane `fleet/260914081948-66bf`, E1c aus
`docs/messungen/2026-09-14-queue-intelligenz-schichten.md` §5. Frage: **Liest Sonnet 5 die
Karten-Quelle seltener falsch oder bricht es seltener ab als Haiku 4.5, und was aendert die
reparierte Vorlage?**

## Ergebnis

72 Zeilen × 3 Arme × 3 Laeufe = 648 Laeufe, alle abgeschlossen. „Offen" = Status `pending`/`sent`
in der eingefrorenen `fleet.json` (51 Zeilen, 153 Laeufe je Arm); das ist die Population, die der
Live-Tick liest. „Alle" = zusaetzlich 21 `done`/`archived`-Zeilen.

**Offene Zeilen (Entscheidungsbasis):**

| Arm | valid % | echte Lesefehler % | answer/run % | Summe der zwei | Vertrag % | Quote % | Verify-Vokabular % | Ablehnung % | ms p50 | ms p90 | ≥120 s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| haiku-4-5 / alt | 30,7 | 9,2 | 4,6 | **13,8** | 30,7 | 15,7 | 6,5 | 2,6 | 67 493 | 99 529 | 1 |
| sonnet-5 / alt | 26,8 | 10,5 | 3,3 | **13,8** | 32,7 | 19,0 | 3,9 | 3,9 | 9 592 | 13 923 | 0 |
| sonnet-5 / neu | 30,7 | 11,8 | 1,3 | **13,1** | 19,0 | 22,2 | 4,6 | 10,5 | 9 801 | 13 353 | 0 |

**Alle 72 Zeilen (216 Laeufe je Arm):**

| Arm | valid % | echte Lesefehler % | answer/run % | ms p50 | ms p90 | ≥120 s | Zeilen valid in ≥2 von 3 | Listenpreis $ | Output-Token p50 |
|---|---|---|---|---|---|---|---|---|---|
| haiku-4-5 / alt | 39,8 | 7,4 | 5,1 | 69 706 | 106 306 | 5 | 30 | 9,37 | 7 120 |
| sonnet-5 / alt | 34,7 | 10,6 | 2,8 | 9 676 | 32 073 | 0 | 26 | 5,07 | 601 |
| sonnet-5 / neu | 30,1 | 10,6 | 1,9 | 9 801 | 30 719 | 0 | 22 | 5,13 | 612 |

Definitionen, je Lauf genau eine Klasse (Rangfolge wie gelistet):

- **answer/run**: Prozess-Fehler, Laufzeit ≥120 s (Live-`CARD_TIMEOUT_MS`; Laeufe durften bis 150 s,
  keiner wurde gekillt, max. 137 856 ms) oder `parseCardAnswer` liefert `null`.
- **echte Lesefehler**: ein Wert, der nicht in der Quelle steht (erfundener Pfad/Symbol, `size`
  nicht genannt), ein Formatbruch (`symbols` ohne `datei#`), oder ein leeres/falsches Feld
  (`ziel`, `done`, `verify`, `size`, `after`), das irgendein anderer Lauf irgendeines Arms fuer
  dieselbe Zeile sauber lieferte.
- **Vertrag**: Pfad steht woertlich in der Quelle, ist aber nicht getrackt und steht unter `files`;
  oder unter `creates`, ist aber inzwischen getrackt.
- **Quote**: Wert (oder sein Symbolname, oder sein Dateiname) steht in der Quelle, nur nicht in
  der Form, die `intentText`/`namedInChain` akzeptiert.
- **Verify-Vokabular**: `verify` nennt keinen Kettenschritt, und kein Lauf der Zeile schaffte es.
- **Ablehnung**: Symbol existiert im Baum nicht, `after`-Id steht im Text, ist aber keine
  Queue-Zeile, oder Feld von keinem der 9 Laeufe lieferbar.
- `rolle.*`-Luecken sind seit Validator v5 beratend und machen keine Karte ungueltig; gezaehlt als
  Karten mit Rollenluecke: 42 (Haiku), 14 (Sonnet/alt), 8 (Sonnet/neu) von je 216.

Differenz der Summe (Lesefehler + answer/run), Bootstrap ueber Zeilen (5 000 Ziehungen):

| Vergleich | offen, pp | 95-%-KI | alle, pp | 95-%-KI |
|---|---|---|---|---|
| Sonnet/alt − Haiku/alt | 0,0 | −7,8 … +7,8 | +0,9 | −4,6 … +7,4 |
| Sonnet/neu − Haiku/alt | −0,7 | −8,5 … +6,5 | 0,0 | −5,1 … +6,9 |
| Sonnet/neu − Sonnet/alt | −0,7 | −7,8 … +5,2 | −0,9 | −5,6 … +3,7 |

**Urteil nach der Regel** („verglichen werden nur echter Lesefehler und answer/run; ist Sonnet dort
nicht besser, geht `.env` zurueck"): nicht besser, also zurueck. Das Urteil haengt an 13,8 % gegen
13,8 %. Die Klassen gleichen sich aus: Sonnet hat weniger answer/run (3,3 % gegen 4,6 %, keine
Timeouts), dafuer mehr Lesefehler (10,5 % gegen 9,2 %).

**Was die Regel nicht wiegt** (gemessen, von der Regel nicht bepreist): die Regel wurde unter
E1b-Annahme „Sonnet ist die teurere Wahl" geschrieben. In diesen Laeufen ist Haiku die teurere
und langsamere: 1 524 938 Thinking-Token ueber 216 Laeufe (~7 060 je Karte) gegen 91 492 (Sonnet/alt)
bzw. 83 513 (Sonnet/neu), daraus p50 67 s gegen 10 s und 9,37 $ gegen 5,07 $ Listenpreis (Summe
`modelUsage.costUSD` aus `claude -p --output-format json`, inklusive der Harness-eigenen
Haiku-Nebenaufrufe in allen Armen). Die Live-Kartenlaeufe lagen bei p50 63 s, p90 97 s
(§1 der Schichten-Notiz), also im Bereich des Haiku-Arms hier. Ein Rueckbau auf Haiku kauft in den
zwei Vergleichsklassen nichts und kostet Latenz, Timeouts und Geld. Ob die Regel deshalb anders
angewendet wird, entscheidet der Orchestrator, nicht diese Messung.

**Was E1a (neue Vorlage) aendert**, Sonnet/neu gegen Sonnet/alt auf offenen Zeilen:
Vertragsfehler 32,7 % → 19,0 %; `rolle`-Luecken 14 → 8 Karten. Die Gueltigkeit steigt nur von
26,8 auf 30,7 %, weil zwei Luecken nachruecken, sobald `creates`/`after` beantwortet werden:

- `after: "<id>" is not a queue row` (35 Luecken bei Sonnet/neu, 0 in den alten Armen), 10
  verschiedene Ids, keine davon in `fleet.json`: 6 aus `[NACHFOLGE:<id>]`-Koepfen, 2 aus
  „ersetzt <id>", 1 aus `NACH 10ddd013` (Zeile nicht mehr in der Queue), 1 Commit-Sha
  (`ba6177e8`), den das Modell fuer eine Zeilen-Id hielt.
- `surface.creates: "<pfad>" is already tracked` (32 Luecken): 7 der 13 betroffenen Zeilen sind
  `done`/`archived`; ihre NEU-Datei existiert inzwischen. Die alte Vorlage legt dieselbe Datei unter
  `files`, dort ist sie heute getrackt und gilt als gueltig. Auf allen 72 Zeilen ist das eine
  Verzerrung zugunsten der alten Vorlage (done/archived valid: Haiku 61,9 %, Sonnet/neu 28,6 %).

**Zwei Befunde am Validator/Parser, modellunabhaengig:**

- Quote-Klasse: die groesste Einzel-Luecke in allen Armen ist
  `surface.symbols: "<datei#symbol>" is not named as a change target` (57 Haiku, 100 Sonnet/alt,
  122 Sonnet/neu). Beispiel `bc974919`: der Text schreibt die Kurzform mit Leerzeichen
  (`card-extract.ts#buildCardPrompt #parseCardAnswer #validateCard`), `namedInChain` akzeptiert nur
  `/` und `,`. Sonnet expandiert die Kette oefter, der Validator lehnt jedes Glied nach dem ersten ab.
- answer/run: Zeile `1b47e29a` liefert 7 der 21 answer/run-Faelle (alle Arme; 16 unlesbare
  Antworten, 5 Haiku-Laeufe ≥120 s). Der Text setzt
  „⋯ mehr" mit einem ASCII-`"` als schliessendem Anfuehrungszeichen; jedes Modell kopiert es
  unmaskiert in den JSON-String, und `parseCardAnswer` (strikt `JSON.parse`) liest nichts.

## Methode

Eingaben, einmal eingefroren:

- `fleet.json` des Haupt-Checkouts kopiert am 2026-09-14 10:21 CEST (200 Zeilen).
- Zeilenmenge (72) = offene Zeilen mit Karte (`status` `pending`/`sent`, 51) ∪ Zeilen, die in
  `cards.jsonl` mit `source` ≠ `format` stehen und noch in `fleet.json` sind (61). 11 der 72 hat
  der Extraktor live nie gelesen (`format`/`author`-Karten); `cards.jsonl` nur gelesen.
- Quelle je Zeile exakt wie `server.ts#extractCard`:
  `[t.brief?.text, t.text].filter(Boolean).join("\n\n")`.
- Alte Vorlage: `git show bb546bf2^:card-extract.ts`, Importe auf den Worktree umgebogen; neue
  Vorlage: `card-extract.ts` am Lane-HEAD (`82c907db`). Beide mit
  `effortLevels = ["low","medium","high","xhigh","max"]` (= `harnessOf(null)`).

Laeufe, Arme je Zeile und Lauf verschraenkt (Lauf 1 aller Zeilen und Arme, dann Lauf 2 …):

```
claude -p --model <claude-haiku-4-5-20251001|claude-sonnet-5> --tools "" --strict-mcp-config \
  --permission-mode dontAsk --output-format json   # Prompt auf stdin, cwd = leeres Scratchpad-Verzeichnis
```

Claude Code 2.1.270. Start 08:24Z mit Parallelitaet 6; der Harness beendete den Hintergrundlauf
zweimal wegen Speicherdrucks (8-GB-Maschine mit laufender Fleet), fortgesetzt mit 3, dann 2–3 im
Vordergrund; ein Lauf schreibt sein Ergebnis erst am Ende, abgebrochene Laeufe wurden neu gefahren.
Ende 10:0xZ.

Validierung in EINEM Prozess nach allen Laeufen: `readTrackedSnapshot` und
`readSymbolIndexSnapshot` je Repo einmal (claude-fleet: Haupt-Checkout `0c3bd4a0`, 740 getrackte
Pfade, Graph 306 Dateien; private-repo-j astra-main: 72 Pfade, kein Graph), getrackte Dateien fuer
`declares` einmal gelesen und fuer alle 648 Karten gemerkt. Kontext wie
`server.ts#cardValidationContext`: `MODEL_RE`, Harness-Ids und Effort-Listen aus `server.ts#HARNESSES`
kopiert, `rowKnown` gegen die eingefrorene `fleet.json`. 24 Zeilen ohne `repo` gegen den
claude-fleet-Baum (live ueberspringt `taskRepoOf` sie, weil `FLEET_DISPATCH_REPO` nicht gesetzt ist).
`card-extract.ts` unterscheidet sich zwischen Lane-HEAD und `0c3bd4a0` nicht.

Rohdaten (Scratchpad der Lane, nicht getrackt): `raw/<arm>/<id>.<lauf>.json` (Antwort, ms, Exit,
usage), `records.jsonl` (Luecken und Klasse je Lauf), `aggregate.json`, `run.ts`, `validate.ts`.

## Was nicht gemessen wurde

- Der Live-Pfad: `server.ts#summaryViaSession` startet eine interaktive tmux-Session im Repo-cwd
  (mit Projekt-`CLAUDE.md`), hier lief `claude -p` ohne Projekt-Kontext. Absolute Latenzen sind
  darum nicht mit dem Ledger vergleichbar, nur die Arme untereinander.
- Latenz unter konstanter Last: drei Parallelitaetsphasen; die Arme teilten sich jede Phase
  verschraenkt, die Differenz Haiku/Sonnet (Faktor ~7 im p50) liegt weit ueber diesem Effekt.
- Die Klassen sind mechanisch etikettiert, nicht Karte fuer Karte gelesen. Die Grenze Vertrag gegen
  Ablehnung ist unscharf (ein nicht getrackter Pfad kann eine NEU-Datei oder eine Datei sein, die nur
  an einem SHA existiert, z. B. `0610f3a5`); die zwei Vergleichsklassen des Urteils haengen daran nicht.
- Tokenkosten und Thinking-Budget des Live-Pfads; ob die interaktive Session Haiku ebenso lange
  denken laesst.
- Eine Validator-Aenderung (Leerzeichen-Kette, JSON-Reparatur) wurde nicht nachgerechnet.
