# Review-Signale — woran dieses Repo schlechten Code direkt erkennt

**Rolle dieser Datei:** Sie ist PROMPT-INHALT. Der Review-Anschluss (Plan:
`docs/plan-review-layer-2026-08-16.md`, WP2′) stellt den passenden Abschnitt server-seitig
inline in den Prompt des ③-Reviewers. Jede Zeile hier kostet also Reviewer-Aufmerksamkeit bei
jedem Review — der Schnitt ist Absicht: sieben belegte Signale, keine Sammlung. Ein neues
Signal kommt nur mit bezahltem Incident herein, nie aus einem Katalog.

**Form je Signal:** Mechanismus · woran erkennbar (mechanisch prüfbar ja/nein) · Beleg ·
Kosten. Anker über Symbole und Überschriften, nie über Zeilennummern.

---

## Teil 1 — Portable Signale (gültig in jeder Codebase; zugleich die Vorlage für den
`## Code quality contract`-Abschnitt eines Ziel-Repos)

### P1 · Cast auf eine fremde Fläche

- **Mechanismus:** Ein `as`-Cast (oder eine eigene Typ-/Interface-Deklaration) über eine
  Antwort, die ein ANDERES System produziert — Netz-Payload, Subprozess-Ausgabe, geparste
  Datei — ist eine Behauptung, kein Typ. Der Compiler prüft fortan gegen die Behauptung,
  nie gegen die Fläche; ein Feld, das die Gegenseite umbenennt oder nie emittiert, ist für
  immer `undefined` und übersetzt trotzdem.
- **Erkennbar:** mechanisch (AST: `as`-Cast auf `fetch`/`.json()`/Spawn-Ergebnisse;
  Interface-Doppeldeklarationen nur per Review).
- **Beleg:** zweimal in diesem Repo — ein e2e-Filter, der ein nie emittiertes Feld abfragte
  und strukturell nie grün werden konnte (repariert `8e2b3e5`), und eine Server-Umbenennung,
  nach der der Client gegen seine eigene alte Union weiter kompilierte: Gruppierung und drei
  Guards tot, null Compiler-Wort (`dd0c9a8`).
- **Kosten:** Sonden, die nie messen; UI-Zweige, die nie feuern; beides unsichtbar, weil der
  Typcheck grün bleibt. Gegenmittel im Review: die Deklaration gegen die tatsächliche
  Emissions-Stelle halten, oder die Quelle beider Seiten teilen.

### P2 · Datei-Enden-Verstümmelung, die syntaktisch gültig bleibt

- **Mechanismus:** Eine Änderung an den letzten Zeilen einer Datei schneidet den Rest ab —
  und das Ergebnis parst weiter (Shell fällt mit Status 0 ans Ende, ein Objektliteral bleibt
  wohlgeformt). Es verschwindet nicht das Ergebnis, sondern die ARBEIT; übrig bleibt ein
  Erfolg.
- **Erkennbar:** mechanisch (Zeilenzahl-Delta bei Edits am Dateiende; Skripte: endet die
  Datei mit ihrer Exit-Propagation?).
- **Beleg:** `613faa3` enthauptete `e2e-isolated.sh` um 22 Zeilen — gültiges sh, Status 0,
  zwei „grüne" Audits mit null gelaufenen Checks. Seither hält ein Pin die Klasse zu
  („decapitated"-Regel in `e2e/pins.ts`).
- **Kosten:** ein grünes Verdict über eine Messung, die nie stattfand — gefährlicher als
  jedes Rot. Review-Frage bei jedem Diff, der am Dateiende ansetzt: stimmt die Zeilenzahl?

### P3 · Dateigrößen-Drift

- **Mechanismus:** Eine Datei wächst schleichend über jede Lesbarkeits- und Review-Grenze;
  jeder einzelne Commit ist klein, die Summe macht die Datei unnavigierbar und jede Review
  zur Volltext-Suche.
- **Erkennbar:** mechanisch (Zeilenzahl gegen Schwelle; das SIGNAL ist das Delta seit der
  letzten Messung, nicht der Bestand — sonst ist die erste Meldung für immer dieselbe).
- **Beleg:** die Hauptdatei dieses Repos steht bei ~17 700 Zeilen gegen eine erklärte
  800-Zeilen-Regel und wuchs allein zwischen zwei Regelbuch-Fassungen um ~4 000.
- **Kosten:** Review-Aufwand pro Diff steigt mit der Dateigröße, nicht mit der Diff-Größe;
  Merge-Kollisionen häufen sich auf einer Fläche. Das Signal MELDET; die Zerlegung ist eine
  eigene Owner-Entscheidung, nie ein Review-Nebenprodukt.

### P4 · Behauptung an zweiter Stelle ohne Kopplung

- **Mechanismus:** Über einen Wert (ein Capability-Feld, einen Default, einen Kontrakt)
  steht anderswo eine zweite Aussage — Test-Fixture, Doku-Satz, Kommentar. Wer den Wert
  ändert, sieht die zweite Stelle nicht; kein Gate verbindet beide.
- **Erkennbar:** teils mechanisch (greps über bekannte Paare — als Pins), im Allgemeinen
  Review-Frage: „worüber behauptet noch jemand etwas, das ich gerade ändere?"
- **Beleg:** ein Adapter bekam eine Effort-Fähigkeit (`8e154dd`), eine Suite an anderer
  Stelle behauptete weiter den alten Kontrakt und wurde rot — beide Gates grün, beide
  hatten recht (repariert `6cc8283`). Ebenso die Doc-Zeile „Promote einer Note bleibt
  erlaubt", die seit einem Owner-Entscheid falsch war und eine Lane den falschen Riegel
  entfernen ließ.
- **Kosten:** stale Tests, die echte Arbeit als Regress anklagen; Docs, die die nächste
  Session in die Gegenrichtung schicken. Die reparierte Form ist immer dieselbe: EINE
  Quelle, die andere Stelle liest sie (oder ein Pin hält beide als Paar).

### P5 · Doc-Behauptung über Code ohne lebenden Anker

- **Mechanismus:** Prosa zitiert Zeilennummern, Symbole oder Pfade; der Code bewegt sich,
  die Prosa nicht. Ein leerer Suchtreffer liest sich dann wie „gibt es nicht", eine alte
  Zeilennummer zeigt auf fremden Code.
- **Erkennbar:** mechanisch (jeden in Backticks genannten Pfad und jedes Symbol auf
  Existenz im Baum prüfen).
- **Beleg:** dieses Repo pinnt genau deshalb die Zitierflächen seiner Regelbücher („every
  path … still resolves", `e2e/pins.ts`); der jüngste Fund war dieses Plans eigenes WP4 —
  das Regelbuch führte einen Pin als offen, den der Baum längst trug (gefunden vom
  Verify-Lauf des Plan-Dokuments selbst).
- **Kosten:** Sessions bauen auf Sätzen statt auf dem Baum und erben Fehler, die der Code
  längst behoben hat. Regel: Anker über Symbole/Überschriften, nie über Zeilennummern; bei
  Widerspruch gilt der Code.

---

## Teil 2 — Fleet-spezifische Signale (Betriebs- und Sonden-Disziplin dieses Repos)

### F1 · Sonde, die als ihr Messobjekt scheitert statt als sie selbst

- **Mechanismus:** Ein Check hat eine Voraussetzung (Server erreichbar, Feld vorhanden,
  Fixture kopiert), prüft sie aber nicht separat — fällt die Voraussetzung, scheitert der
  Check im NAMEN des Gemessenen, und das Rot liest sich wie ein Code-Regress.
- **Erkennbar:** Review-Frage an jede neue Sonde: „was muss wahr sein, damit sie überhaupt
  messen kann — und hat das einen eigenen `check()`?"
- **Beleg:** dreimal an einem Tag (Session 38: maschinenabhängige Erwartung · ein still
  verschlucktes 400 · eine Zusage, die der Tick-Cache ausdrücklich nicht macht); dazu die
  Suite, die monatelang bei jedem Lauf am Boot starb, weil eine Kopierliste eine Datei
  nicht führte — unentdeckt, weil kein Gate sie fuhr.
- **Kosten:** Adjudikations-Aufwand für Phantom-Rote; schlimmer: echtes Vertrauen in die
  Suite erodiert. Eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern.

### F2 · Ein Grün ohne Messnachweis

- **Mechanismus:** Ein Ergebnis-Wort („green", „ok", „ALL PASS") wird geglaubt, ohne die
  Größen daneben zu lesen — Dauer, gelaufene Checks, PASS-Zeilen. Abgestürzt-vor-dem-Druck
  und nie-gestartet produzieren dieselbe leere Ausgabe.
- **Erkennbar:** mechanisch (`ms` unter Plausibilitätsschwelle, `checks.ran:0` bei grünem
  Verdict — beide Felder existieren auf dem Audit-Ledger genau deshalb).
- **Beleg:** zwei Lands bekamen ein 1,8-s-„Grün" mit null PASS-Zeilen (Folge von P2/`613faa3`);
  `./state.sh` meldete es der Nachfolge-Session als bestandenes Audit.
- **Kosten:** dieselben wie P2, eine Ebene höher — die Selbstauskunft der Maschine wird
  unglaubwürdig. Review-Regel: ein Verdict ohne Mess-Metadaten ist eine Behauptung.

---

## Teil 3 — Der mechanische Teil: `review-sweep.ts` (WP3, gelandet 2026-08-17)

Vier der Signale oben sind ohne Modell prüfbar, und genau die fährt `review-sweep.ts` —
`bun review-sweep.ts` in einem beliebigen Git-Baum, Sekunden, JSON-Zeilen auf stdout, ein
stabiler Fingerprint je Befund. Es ist ein **Sensor**: kein Gate, kein Auto-Fix, kein
Server-Tick. `--queue` legt je NEUEM Fingerprint eine `notiz` über die Owner-Task-API ab
(`--api` und `--token`/`FLEET_SWEEP_TOKEN` sind PFLICHT — ohne beides verweigert es laut, es
gibt keinen Default-Endpunkt und keinen Credential-Fallback, und es schreibt niemals selbst in
eine Zustandsdatei). Arbeit entsteht daraus nur durch Owner-Konvertierung.

| Signal | Was der Sweep messbar macht | Bewusste Verengung (gemessen an diesem Baum, 2026-08-17) |
| --- | --- | --- |
| P1 | `as`-Cast auf ein `fetch`/`.json()`-Ergebnis in `src/**`, `e2e/**` | nur Casts auf einen BENANNTEN Typ, ein Befund je Datei: 917 Cast-Stellen → 73 in 17 Dateien. Das inline-Literal ist an der Aufrufstelle sichtbar, die Deklaration in der Ferne ist die Incident-Form. |
| P3 | Zeilenzahl getrackter `.ts`/`.sh` gegen **fest 800** (Owner-Entscheid), Delta zur letzten Messung über `--baseline` | keine Konfigurierbarkeit der Schwelle; ohne Baseline ist das Delta „unbekannt", nie 0. |
| P5 | Backtick-Pfade/-Symbole in `docs/*.md` ohne Existenz im Baum | nur EXISTENZ, kein Semantik-Urteil; `docs/attic/**` ausgenommen (ein Grab darf tote Pfade nennen); git-ignorierte Pfade gelten als lebend (ihre Absenz misst den Worktree, nicht das Doc). |
| — | Tote VALUE-Exporte in Top-Level-`.ts` | Typ-/Interface-Exporte ausgenommen: 65 unimportierte Namen → 10, denn ein exportierter Typ neben seinen Konsumenten ist idiomatisch. |

P2 deckt der „decapitated"-Pin, P4/F1/F2 bleiben Review-Fragen — der Sweep nimmt dem Reviewer
Arbeit ab, er ersetzt ihn nicht. Beweisfläche: `e2e/sweep.ts` (Positiv-Fixture mit je einem
Negativ-Kontrollfall daneben, Clean-Fixture ohne jede Form, und der Nachweis, dass ein Check
ohne sein Werkzeug als ER SELBST scheitert statt „0 Befunde" zu melden).

**Pflege:** Ein Signal, dessen Klasse ein Pin vollständig schließt (wie P2 für die fünf
gestagten Suiten), bleibt hier stehen, solange die Klasse außerhalb der Pin-Fläche weiter
existiert (P2 gilt für jede Datei, der Pin deckt fünf). Ein Signal ohne lebende Fläche wird
gestrichen, nicht gesammelt.
