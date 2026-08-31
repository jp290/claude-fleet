# Befunde vom 2026-08-06 — Eingaben für die Autonomie-Landkarte

*Geschrieben im Haupt-Checkout, damit sie nicht in einem Transcript verwehen. `briefs/autonomy-gap.md`
verlangt, die Befunde aus den LEDGERN neu zu rechnen — diese hier stehen in keinem Ledger, also
könnte die Analyse sie weder finden noch widerlegen. Sie sind Eingabe, nicht Beschluss: die
Reihenfolge festzulegen ist Aufgabe der Landkarte, nicht dieses Dokuments.*

*Warum es überhaupt existiert: an diesem Tag wäre zweimal wertvolle Analyse gestorben. Die
Ledger-Untersuchung einer Lane (jetzt `briefs/lane-stalled-ledger.md`) hätte ihren Worktree nicht
überlebt; die Befunde unten hätten nur in einer Gesprächshistorie gelegen. Der Mechanismus, der
Analyse haltbar macht, fehlt — das ist selbst ein Befund für Bereich 5.*

---

## 1. Der Drift-Fakt wird vollständig gerechnet und ist für alle unerreichbar außer der Lane selbst

**Gelesen, nicht vermutet.** `laneDrift()` (`server.ts:5144`) liefert `behind`, `wouldConflict`,
`conflictFiles`, `overlap` (*„files BOTH sides touched"*), `dirty` und `otherLanes` — die in-flight-
Dateien der anderen offenen Lanes. Das ist genau die Zutat, die Bereich 3 der Landkarte
(Kollisionsvermeidung vor dem Spawn) als fehlend führt.

**Er hat genau einen Abnehmer**: `GET /api/self/drift` (`server.ts:7721`), und der verlangt
`x-fleet-self-token` — die Credential, die ausschließlich die betreffende Lane besitzt. Der Steward
kann den Fakt strukturell nicht sehen, das Board auch nicht. Der Kommentar an der Route nennt das
Board sogar als vorgesehenen Leser; gebaut wurde es nie.

**Die Anweisung an die Lane hat vier Schwächen, alle nachgeprüft:**

1. Sie existiert genau **einmal** — `CLAUDE.md`, Zeile 15: *„Vor dem Done-Report Drift prüfen"*. Also
   zum spätestmöglichen Zeitpunkt, wenn das Budget schon ausgegeben ist.
2. Ihr **Träger ist eine beim Spawn kopierte, gitignorierte Datei**. Ein Spawn-Zeit-Snapshot, kein
   Mechanismus.
3. Der **Gründungsbrief trägt sie nicht**: `briefPayload` rechnet zwar selbst `ahead`/`behind`
   (`server.ts:1073-1084`), instruiert aber mit keinem Wort zu Drift oder Rebase.
4. Und ob sie je befolgt wird, ist **unbeobachtbar**: die Route schreibt null Audit-Events, während
   `audit.jsonl` 1923 Zeilen über 22 Event-Typen führt. Die belastbare Aussage ist deshalb nicht
   „Lanes tun es nie", sondern „niemand kann es sagen" — was schlechter ist.

**Was es kostet.** Die Kollisionsmessung vom 2026-08-05 (Landkarte, Bereich 3) zeigte: der Konflikt
entsteht beim **Spawnen**, die merge-tree-Probe ergab in beiden Land-Reihenfolgen dieselben vier
Konflikte. Ein Check am Ende verwandelt einen Merge-Konflikt also nur noch in einen Selbst-Rebase —
nützlich, aber keine Prävention. Prävention wäre der Blick zu Beginn.

**Vorgeschlagene Scheiben, klein nach groß:**

- **2a — Instrumentierung (eine Zeile).** Ein Audit-Event auf `/api/self/drift`. Danach ist „prüfen
  Lanes ihren Drift, und wann?" zum ersten Mal beantwortbar. **Das gehört zuerst**, weil jede
  weitere Entscheidung sonst gegen eine Vermutung gebaut wird — auch meine eigenen unten.
- **2b — der Hinweis in `briefPayload`**, mit frühem Zeitpunkt, statt nur in der kopierten Datei.
- **2c — Steward-Sicht auf den Fakt**, plus die Provenienz-Lücke aus Befund 2.

Ein serverseitiger *Sender* (die Maschine sagt der Lane, dass sie driftet) ist damit ausdrücklich
**nicht** vorgeschlagen. Er ist Stufe `act` und braucht die Feuerprobe, die 2a erst ermöglicht.

---

## 2. `POST /send` schreibt jede Nachricht dem Owner zu

**Gelesen.** `server.ts:9414` — `logPrompt(s, body.text, "owner", ts)`. Alles, was durch diese Route
geht, erscheint im Prompt-Log als Owner-Wort.

Heute konkret geworden: drei Notizen an laufende Lanes wurden über diese Route zugestellt und stehen
dort nun als Äußerungen des Owners.

**Konsequenz für alles Automatische:** ein maschineller Sender braucht ein eigenes Quell-Label,
sonst lügt der Prompt-Log und die empfangende Lane kann nicht unterscheiden, wer mit ihr spricht.
Das ist eine **Vorbedingung**, kein Nice-to-have — Provenienz nachträglich zu reparieren ist
unmöglich, weil die alten Zeilen nicht mehr unterscheidbar sind.

---

## 3. Der Verify-Gate kann an der Uhr scheitern — und das liest sich wie ein Nein

**Gemessen an einem Live-Fall an diesem Tag.** Ein Land wurde gestoppt mit `verify.ok: false` und
`detail: "clean rebase, but verify failed"`. Die zurückbehaltene Ausgabe enthält jedoch **null
FAIL-Zeilen**, endet mit `ALL PASS` einer Suite und dann:

```
[verify timed out after 300000ms]
```

`FLEET_VERIFY_TIMEOUT_MS=300000` ist das Budget für die **ganze** Kette (`bun install` + Pins + tsc +
drei Suiten). Zum Vergleich: dieselbe Kette lief bei zwei erfolgreichen Lands desselben Tages in
**~105 s** durch. Der gestoppte Lauf brauchte das Dreifache und lief ins Limit.

**Zwei Befunde daraus, und der zweite ist der wichtigere:**

1. **Ein Timeout ist ein Nicht-Urteil** — weder ja noch nein — wird aber als `verify.ok: false`
   geführt und liest sich damit wie ein begründetes Nein. Das Repo unterscheidet solche Zustände
   anderswo bereits sauber: der Gate ist dreiwertig, `verify.ok: null` heißt SKIPPED (`exit 42`),
   und „gar nicht konfiguriert" ist nochmal etwas anderes als „übersprungen". **Ein Timeout wäre der
   vierte Zustand und fällt heute mit „gefallen" zusammen.** Das Muster, ihn zu trennen, existiert
   also schon.
2. **Das Budget ist flottenweit.** Eine Suite, die die Kette dauerhaft über fünf Minuten drückt,
   blockiert **jede** Lane, nicht nur die, die sie eingeführt hat. Es gibt heute nichts, was diesen
   Verbrauch sichtbar macht, bevor er zuschlägt — kein Kanal meldet „die Kette nähert sich ihrem
   Budget".

*Offen und der Lane übergeben:* ob der konkrete Ausreißer von ihrer eigenen Suiten-Änderung stammt
(sie fügt der Suite, in der die Kette stand, +97 Zeilen hinzu). Das ist ein starker Verdacht, kein
Urteil — die Messung läuft dort, nicht hier.

---

## 4. Die Entscheidungs-Inbox: acht Item-Typen, die es alle schon gibt

Jedes „der Owner muss etwas beantworten" wird heute **serverseitig berechnet** und landet je an einer
anderen Ecke. Das Dashboard wäre eine Aggregation über Vorhandenes, kein Neubau:

| Item | wo es heute lebt |
|---|---|
| rotes Tier-2-Audit ohne Adjudikation | `post-land-audits.jsonl` minus `audit-adjudications.jsonl` |
| Rundgang-Notiz, unbeantwortet | Queue, Status `pending`, `kind: note` |
| review-reife Lane | `doneLooking` |
| festgefahrene Lane | `stalled` |
| Lane wartet auf Kriteriums-Bestätigung | `awaiting === "owner"` |
| blockierter/fehlerhafter Merge | `mergeLast.status` |
| gelandet-aber-nicht-live | `deployGap.codeBehind` / `bundleStale` |
| driftende Lane | `laneDrift` (Befund 1 — heute unerreichbar) |

**Die Regel, die verhindert, dass daraus Archiv Nr. 8 wird:**

> Kein Item kommt in die Inbox, das der Owner nicht **aus der Inbox heraus auflösen** kann.

Die Aggregation ist der leichte Teil; der Rückschreibe-Pfad ist ungleich verteilt. `adjudicate`,
`criterion-confirm`, Promote und Land existieren — für eine Rundgang-Notiz gibt es kein „erledigt",
für Drift kein „zur Kenntnis genommen". Diese Typen gehören erst hinein, wenn sie eine Auflöse-Aktion
haben.

**Der Nebeneffekt ist der eigentliche Gewinn:** damit wird `resolved / raised` pro Typ messbar — also
genau die Frage, die die Landkarte in Bereich 5 als unbeantwortbar stehen lässt (*„woran würde man
sehen, dass er konsumiert wird und nicht bloß läuft?"*).

**Architektur-Empfehlung:** deterministische Ableitung, **kein Worker**. Jedes Item oben ist bereits
ein Fakt; ein Modell bräuchte man nur zum Ranken und Formulieren, und dafür gilt die Hausregel
advisory-nie-Quelle. Vor allem muss die Inbox da sein, **wenn der Owner hinsieht** — nicht, wenn ein
Worker zufällig gelaufen ist.

---

## 5. Was hier ausdrücklich NICHT vorgeschlagen wird

- **Kein automatischer Sender an Lanes**, solange 2a nicht gemessen hat.
- **Kein generisches Instanz-Ledger.** Eine Abstraktion für einen zweiten Konsumenten, den es noch
  nicht gibt, ist die verfrühte Sorte.
- **Keine Reihenfolge über die Bereiche hinweg.** Das ist die Aufgabe von `briefs/autonomy-gap.md`,
  und der Sinn dieses Dokuments ist, ihr Material zu liefern, das sie sonst nicht hätte.

---

## Verifikationsstand

| Behauptung | Stand |
|---|---|
| `laneDrift`-Felder, Zeilennummer, genau ein Abnehmer | **gelesen** (Definition + Aufrufstelle) |
| `/api/self/drift` schreibt kein Audit-Event | **gemessen** (kein `audit(`-Aufruf in der Route) |
| `audit.jsonl`: 1923 Zeilen, 22 Event-Typen, keiner ist Drift | **gemessen** |
| `CLAUDE.md` weist einmal an, „vor dem Done-Report" | **gelesen** |
| `briefPayload` erwähnt Drift/Rebase nicht | **gemessen** (Grep über die Funktion) |
| `logPrompt(…, "owner", …)` in `/send` | **gelesen** |
| Kette ~105 s vs. 300 s Limit | **abgeleitet** aus Zeitstempeln zweier Lands, nicht instrumentiert |
| Ursache des Timeout-Ausreißers | **unbewiesen** — Verdacht, Messung läuft in der betroffenen Lane |
| Die acht Item-Typen existieren als Fakten | **teils gelesen, teils aus den Ledgern gezählt** |
