---
frage: Was passiert mit zwei neuen Feldern, deren FEHLEN eine Aussage ist, solange der laufende Serverprozess aelter ist als ihr Land?
urteil: JEDE ZEILE ZWISCHEN LAND UND DEPLOY LUEGT SPAETER. `coResident` und `modelOrigin` heissen bei Abwesenheit "kann es nicht sagen"; der alte Prozess schreibt sie nicht, und nach dem Deploy liest dieselbe Absenz wie ein gemessener Fakt. Beide Aufloesungen passieren AT WRITE TIME und sind nachtraeglich nicht reparierbar — nur die Grenze ist notierbar, und nur jetzt.
bereich: [deploy, ledger, absenz-semantik, audit, lane-outcome]
belege: [post-land-audits.jsonl Zeile des Audits auf a7a738c9, lane-outcomes.jsonl Zeile des Lands von 8d550b87, e2e/helper-portal.ts (Kommentar zu coResident), server.ts#resolvedModel]
nicht-gemessen: ob weitere optionale Ledger-Felder dieselbe Konstruktion haben — beantwortbar per rg ueber die optionalen Felder der Ledger-Typen samt Kommentaren, hier nicht gestellt
stand: 2026-09-17
---

# Der Deploy-Rand: wenn Absenz eine Aussage ist

## 1. Die zwei Felder

Am 2026-09-17 sind zwei Felder gelandet, deren **Fehlen** eine Aussage ist:

- **`PostLandAuditShard.coResident`** (gelandet `5518a259`). Schluessel FEHLT = "dieser Shard hatte
  nie ein Fenster, wurde nie geclaimt". `e2e/helper-portal.ts` sagt es woertlich: die Absenz ist
  *"a third answer rather than an old server"* — genau darauf beruht der Check `(K11d)`, der sie von
  einem gemessenen `with: []` unterscheidet.
- **`LaneOutcome.modelOrigin`** (gelandet `a7a738c9`). FEHLT = "diese Zeile kann es nicht sagen",
  ausdruecklich NICHT `"ambient"`; Altzeilen werden bewusst nicht nachgestempelt, weil ein
  nachtraeglicher Stempel die beiden Faelle verschmoelze.

## 2. Der laufende Prozess ist aelter als beide Lands

Boot des Servers: **2026-09-17 07:20:16**. Beide Lands liegen danach, `deploy.codeBehind` stand den
ganzen Tag auf `true`. Also schreibt der Prozess seit dem Land Zeilen OHNE diese Felder — und zwar
genau die Sorte, die sie tragen muesste. Zwei Belege, an den Ledgern gelesen:

- `post-land-audits.jsonl`, Audit auf `a7a738c9` (covers `80ae2979` + `a7a738c9`): **zwei Shards,
  beide gelaufen, beide mit `ms` und `ran`, beide `coResident` abwesend.** Ein Fenster existiert; die
  Absenz behauptet das Gegenteil.
- `lane-outcomes.jsonl`, Land von `8d550b87` (`fleet/260917083827-3686`, `disposition: landed`,
  `model: claude-opus-5[1m]`): **`modelOrigin` fehlt** — auf dem Land ausgerechnet der Zeile, die das
  Feld eingefuehrt hat.

## 3. Warum das nicht reparierbar ist

Beide Aufloesungen passieren **beim Schreiben**. `server.ts#resolvedModel` sagt es im eigenen
Kommentar: ein spaeterer Leser kann nicht wissen, mit welchem `FLEET_MODEL` der Server lief. Dasselbe
gilt fuer das Zeitfenster eines Shards, sobald der Lauf vorbei ist. Es gibt keinen Backfill, der
ehrlich waere.

## 4. Was beim Deploy zu tun ist (Owner-Akt, kein Gate)

Die **Grenz-Shas datiert festhalten**, in `docs/verify-tiering.md` §11.2y fuer `coResident` und bei
der `modelOrigin`-Beschreibung:

- `coResident` ist ab `5518a259` im Baum, aber erst ab dem ERSTEN Boot danach tatsaechlich
  geschrieben.
- `modelOrigin` ist ab `a7a738c9` im Baum, dieselbe Einschraenkung.

Wer die Grenze nicht notiert, hat spaeter keinen Weg mehr, eine alte Absenz von einer gemessenen zu
unterscheiden — und die Felder sind genau fuer den Fall gebaut, in dem jemand einem roten Audit oder
einer Modell-Statistik glauben muss. Die Notiz kostet zwei Saetze und ist nur solange verfuegbar, wie
die Bootzeit bekannt ist.
