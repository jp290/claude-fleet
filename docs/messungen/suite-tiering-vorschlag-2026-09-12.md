---
frage: Welche Prüfungen müssen vor dem Land laufen, welche danach, und wo trägt der Trail eine Frequenzsenkung?
urteil: 19 Prüfungen der Deploy-Anzeige tragen 10,67 Stunden historische Zeit; 10-Prozent-Sampling ergibt bedingt 9,60 Stunden weniger, ohne belegte heutige Gate-Ersparnis.
bereich: [e2e-trail, land-gate, post-land-audit, sampling]
belege: [trailstats.ts#treeKind, watchdog.sh#VERIFY_CMD, watchdog.sh#AUDIT_CMD, e2e/pins.ts#pin, e2e/security.ts#run, e2e/merge.ts#run, e2e/deploy-facts.ts#settle]
nicht-gemessen: heutige Netto-Wallclock nach Umbau, TMPDIR-Trails, Remote-Trails außerhalb des Registers, CPU-Zeit und Vollständigkeit historischer Produktfehlerzuordnung
stand: 2026-09-12
---

# Suite-Tiering-Vorschlag

## Ergebnis

19 Prüfungen der Deploy-Anzeige (§1–4) zuerst für Sampling abtrennen: ihre historischen
38.399.985 ms ergeben bei 10 % Frequenz rechnerisch 34.559.986,5 ms = 9,60 h weniger.
Das sind 3,45 % der gesamten erfassten Zeit; geändertes Verhalten verlangt weiterhin einen
gezielten Lauf. Für die heutige synchrone Land-Kette ergibt dieser Vorschlag **0 ms Entlastung**,
weil diese 19 Checks bereits in der nachgelagerten Suite liegen. Die Entlastung betrifft den
gemeinsam belegten Suite-Mutex; ihre Wirkung auf die Wartezeit eines Lands ist ungemessen.

Messbasis: Codebaum `c8845a744e39abda5b0fbf940a2565ab065e5813`; Snapshot am 12.09.2026
06:56:18–06:56:27 UTC, alle 7.258 Dateien direkt unter `e2e-trail/`, 566.703.606 gelesene Bytes.
Zeilenzeitraum: 27.07.2026 09:09:56 bis 12.09.2026 06:44:22 UTC. 2.173.633 gültige Zeilen,
7.258 Lauf-IDs, 5.607 verschiedene Check-Namen, 755 Namen mit Rot, 1.605 Rotzeilen in
511 verschiedenen Läufen; 93 Namen waren auf mindestens zwei sauberen Bäumen rot.
985.478 Zeilen sind sauber, 1.188.155 dirty, 0 mit unbekannter Baumidentität;
0 unlesbare Zeilen und 0 fehlende/unbrauchbare Zeitwerte in diesem Korpus.

Die folgende Tabelle zählt jeden Check-Namen genau einmal. Rot-Anzahl summiert rote
Check×Lauf-Paare; produktiv-rot-Anzahl zählt Namen mit mindestens einem belegten Produkt-Rot.

| Klasse | Check-Anzahl | Summe-ms | Rot-Anzahl | produktiv-rot-Anzahl |
|---|---:|---:|---:|---:|
| Land-Gate | 1.275 | 353.160.556 | 367 | 3 |
| Post-Land-Audit | 4.312 | 603.099.218 | 1.235 | 10 |
| Gesampelt | 19 | 38.399.985 | 3 | 0 |
| Streichbar | 1 | 5.815.547 | 0 | 0 |
| Gesamt | 5.607 | 1.000.475.306 | 1.605 | 13 |

Gesamtzeit: 277,91 h erfasste Check-Abstände über den gesamten Korpus.

## Die zwanzig teuersten Checks

Absteigend nach Summe-ms, Namen wörtlich aus dem Trail; Median-ms ist ebenfalls ein
Check-Abstand. Historische und aktuelle Namen bleiben getrennt.

| Check | Klasse | Läufe / Rot | Median-ms | Summe-ms | Fundstelle |
|---|---|---:|---:|---:|---|
| episode cap survives an audit rotation — pre-rotation send still counted from .1 (429) | Post-Land-Audit | 719 / 0 | 311 | 10.631.943 | e2e/steward-core.ts:402 |
| the held recurring pulse fires once quiet hours are cleared | Post-Land-Audit | 790 / 0 | 11.757 | 9.329.119 | e2e/autos.ts:119 |
| §2b blocking on a LIVE holder speaks immediately, naming the pid it is waiting for | Land-Gate | 589 / 0 | 15.163 | 8.922.913 | e2e/verify-queue.ts:347 |
| §2b a hand-parked (pid-less) dir is called parked, and says nothing will ever reap it | Land-Gate | 589 / 0 | 15.162 | 8.921.895 | e2e/verify-queue.ts:384 |
| V1: a verify KILLED by the timeout records ok:null + timedOut — a non-answer, not a failure | Land-Gate | 626 / 0 | 12.547 | 7.986.535 | e2e/merge.ts:950 |
| V1: a verify that ignores the term is still ended — ok:null + timedOut, same verdict as any timeout | Land-Gate | 562 / 0 | 13.549 | 7.819.914 | e2e/merge.ts:1151 |
| worktrees map reports real dirty FILE NAMES, not just a count | Post-Land-Audit | 760 / 0 | 9.036 | 7.663.382 | e2e/lane-risk.ts:18 |
| orphaned worktree listed with slot null | Land-Gate | 761 / 0 | 8.195 | 6.782.167 | e2e/merge.ts:1825 |
| a review completing after a slot recycle is NOT filed under the new lane | Post-Land-Audit | 783 / 0 | 8.509 | 6.683.911 | e2e/review.ts:222 |
| pulse: a second pulse to the same slot inside the episode window is capped (429) — one per session per episode | Post-Land-Audit | 717 / 0 | 150 | 6.655.030 | e2e/steward-outcomes.ts:336 |
| dispatcher post-spawn gate requeues the task when the fresh claude died (dispatch held … requeued) | Land-Gate | 1.201 / 3 | 4.961 | 6.587.103 | fleet-e2e-claude-gate.ts:508 |
| WS replay for slot 1 non-empty | Post-Land-Audit | 815 / 0 | 8.038 | 6.553.796 | e2e/slots.ts:529 |
| auto-③ attempts a failing review exactly once per git state (no retry storm) | Post-Land-Audit | 783 / 0 | 8.518 | 6.491.377 | e2e/review.ts:237 |
| §2 a commit after boot is counted | Gesampelt | 639 / 1 | 10.132 | 6.416.382 | e2e/deploy-facts.ts:113 |
| §2 a server-code commit IS a deploy — this is the line the owner never saw | Gesampelt | 639 / 1 | 9.994 | 6.408.339 | e2e/deploy-facts.ts:122 |
| §3 rebuilding clears it — the fact follows the filesystem, it is not sticky | Gesampelt | 636 / 0 | 10.084 | 6.345.730 | e2e/deploy-facts.ts:204 |
| §2b a top-level module the server imports is still a deploy, harness neighbours or not | Gesampelt | 633 / 0 | 9.966 | 6.311.413 | e2e/deploy-facts.ts:145 |
| (h10)(c) with the colliding work gone both held rows start on their own | Streichbar | 580 / 0 | 9.754 | 5.815.547 | Entfernt in `ac48155a` |
| §6b ...while a default-adapter slot keeps the unprobed waiver (agent=unprobed) | Land-Gate | 529 / 1 | 11.010 | 5.807.625 | e2e/security.ts:1445 |
| §6b a pi slot is genuinely PROBED (adapter-declared comms), not waived like the undeclared FLEET_CMD | Land-Gate | 529 / 1 | 11.010 | 5.794.894 | e2e/security.ts:1438 |

## Methode und Lesart

Die Auswertung gruppiert nach dem exakten `check`-Namen über alle Suites; umbenannte Checks
bleiben getrennt. Läufe zählen verschiedene `run`, Rot zählt Läufe mit mindestens einer
roten Zeile dieses Namens. Produktiv-rot zählt verschiedene Check-Namen mit mindestens einem
belegten Produktfehler; es zählt weder Vorfälle noch sämtliche roten Wiederholungen eines Namens.
Eine saubere Baumidentität verlangt eine SHA mit 40 Hexzeichen und `dirty:false`
(`trailstats.ts#treeKind`); mindestens zwei solche roten Bäume belegen eine Wiederholung,
aber weder Flakiness noch Fehlerfreiheit des Produkts.

`msSincePrev` misst den Weg vom vorherigen Check bis zu diesem Check, einschließlich Vorbereitung
und Warten (`docs/e2e-trail.md:95`). Eine Summe ist erfasste verstrichene Zeit über historische
Läufe; sie ist keine isolierte Assertion-Laufzeit und keine CPU-Zeit. Die unten errechneten
Einsparungen setzen voraus, dass die zugehörigen Arbeiten und Wartephasen entfallen.
Nur einen `check()`-Aufruf wegzulassen verschiebt die Zeit in die nächste Trail-Zeile.

## Vier Klassen

Ein Gate für Promotions- und Berechtigungsgrenzen ist erforderlich, weil nachträgliche
Feststellung eine bereits ausgeführte Promotion oder unberechtigte Aktion nicht verhindert.
Die Einteilung ist ein Vorschlag; die bestehenden Wrapper und ihre Reihenfolge bleiben der
Ausführungsstand dieser Messung.

- **Land-Gate:** Die bereits synchron geprüften Suites und der geschützte Vertragskern bleiben
  bei jeder relevanten Promotion Pflicht, weil sie Autorität, Baumidentität und Landfolgen beweisen.
- **Post-Land-Audit:** Die übrigen Checks bleiben pro Audit-Bündel erhalten, weil das Register
  ohne Ersatzbeleg keinen weiteren Abbau trägt und breite Integration nach dem Land geprüft wird.
- **Gesampelt:** Die ausdrücklich benannten teuren Szenarien laufen als Vorschlag in jedem
  zehnten Audit und bei Änderungen an ihrem Verhalten, weil ihre belegten Kosten bei bislang
  fehlendem Produkt-Rot-Beleg die erste begrenzte Frequenzsenkung begründen.
- **Streichbar:** Der unten benannte historische h10-Check darf entfallen bleiben, weil sein
  Queue-Analyst bereits entfernt wurde und für diesen Namen kein Rot im Trail vorkommt.

## Unantastbar

`e2e/pins.ts#pin` schützt Vereinbarungen zwischen Shell, Dokumentation und Code; der lokale
Pin-Schreiber erzeugt keine Harness-Trail-Zeilen, deshalb wird seine Checkzahl dem Trail-Nenner
nicht hinzugerechnet. `e2e/security.ts#run` schützt unter anderem die Pre-Auth-Allowlist und
die Principal-Matrix mit positiver Owner-Kontrolle (`e2e/security.ts:550`, `e2e/security.ts:650`).
Der Merge-Pfad umfasst Dirty-/Identitäts-/Verify-/Confirm-Grenzen (`e2e/merge.ts#run`),
Provenienz und Undo (`e2e/land-provenance.ts#run`), den Erhalt der Landfolgen nach Prozessabbruch
(`e2e/land-durability.ts#run`) und den Erhalt fremder Arbeitskopien beim Ref-Vorschub
(`e2e/ref-advance.ts#run`). Ebenfalls geschützt sind die ganzen Familien
`e2e/concurrency.ts#run`, `e2e/outcomes.ts#run` und `e2e/verify-queue.ts#run`: sie prüfen
konkurrierende Merge-Akte, deren Ergebniszeilen und die Verify-Ausführung.
Diese Beweise werden weder gesampelt noch gestrichen; die Zuordnung zählt ihr Setup mit.

Der heutige `watchdog.sh#VERIFY_CMD` führt drei fokussierte Harnesses aus;
`watchdog.sh#AUDIT_CMD` führt die isolierte Hauptsuite aus. Sicherheits- und Merge-Familien
in dieser Hauptsuite sind damit heute nachgelagert. Die Zielklasse Land-Gate erteilt keinen
Auftrag, die ganze zustandsabhängige Hauptsuite synchron zu fahren: ihre Familien teilen
Fixtures und eine feste Reihenfolge (`fleet-e2e.ts:5`, `fleet-e2e.ts:103`, `fleet-e2e.ts:208`).
Ein separates deterministisches Gate für diese Beweise benötigt einen eigenen Implementierungs-
und Laufzeitnachweis; seine Mehrkosten sind hier nicht als Ersparnis verbucht.

## Eindeutige Zuordnung und Sampling-Grenze

Die Regeln werden in dieser Reihenfolge angewandt:

1. Land-Gate: jeder Name, der in `clean-review`, `security` oder `claude-gate` vorkommt,
   sowie aktuelle Literal-/Template-Namen aus den acht oben genannten geschützten E2E-Familien.
2. Streichbar: exakt `(h10)(c) with the colliding work gone both held rows start on their own`.
   `git show ac48155a -- e2e/tasks.ts` belegt die Entfernung mit dem Queue-Analysten.
3. Gesampelt: die 19 aktuellen Namen der `check()`-Aufrufe in `e2e/deploy-facts.ts:99–234`.
4. Post-Land-Audit: jeder übrige Name; das verlangt keine Wiederherstellung historischer Checks.

Die Quellenzuordnung liest TypeScript-Aufrufe: Literale exakt, Template-Fragmente mit
beliebigem Inhalt zwischen den festen Fragmenten. 717 Namen haben so keine aktuelle Fundstelle;
sie bleiben historisch oder unzugeordnet, ohne daraus einen Löschgrund abzuleiten.
Die vollständige Liste samt Einstufung liegt im Scratch-CSV; die Regeln oben erhalten einen
definierten Auffangfall auch für diese Namen.

Die Sampling-Grenze endet vor §5: tatsächlicher Deploy und dessen Folgeverdict bleiben im Audit.
§1–4 verändert eine eigene Git-Fixture, wartet auf die Anzeige und startet den Testserver neu;
`e2e/deploy-facts.ts#settle` pollt alle 400 ms bis höchstens 14 Sekunden.
Abzutrennen sind die Vorbereitung, positive/negative Kontrollen und das zugehörige Aufräumen.
Vor einem Umbau muss nachgewiesen werden, dass §5 ohne diese Vorbereitung dieselben
Vorbedingungen erhält; anderenfalls ist diese Abtrennung zu überdenken.
Die Frequenz 1:10 ist eine gesetzte Annahme, kein aus Rotquoten abgeleitetes Sicherheitsniveau.

## Zeitrechnung je Klasse

| Klasse | Rechnung aus historischen Summen | Entlastung heutiges Gate |
|---|---|---:|
| Land-Gate | Frequenz bleibt 100 %: 0 ms gespart; 353.160.556 ms bleiben geschützt. | 0 ms |
| Post-Land-Audit | Frequenz bleibt 100 % pro Audit-Bündel: 0 ms gespart; 603.099.218 ms bleiben. | 0 ms |
| Gesampelt | 38.399.985 × 0,9 = 34.559.986,5 ms = 9,60 h; Änderungsanlässe vermindern dies. | 0 ms |
| Streichbar | 5.815.547 ms = 1,62 h historisch; bereits entfernt, zusätzlich 0 ms. | 0 ms |

Die 242.727.153 ms des geschützten Kerns aus `isolated` liegen heute außerhalb der
synchronen Kette. Seine Verschiebung kann Gate-Latenz erhöhen; 67,42 historische Stunden
werden daher ausdrücklich nicht als freigesetzte Zeit gerechnet. Aus Summen verschieden
häufiger Teilprozesse lässt sich keine neue Gate-Dauer pro Land ableiten.

## Produkt-Rot-Belege

13 der 755 roten Namen tragen mindestens einen Produktbeleg; diese Zahl ist eine belegte
Untergrenze. „Nie produktiv rot“ heißt bei den übrigen 742 Namen: kein solcher Beleg im
geprüften Suchumfang, Ursachenstatus `unknown`; es behauptet keine Fehlerfreiheit.

| Namensgruppe im Trail | Namen | Klasse | Produktbeleg und Mechanismus |
|---|---:|---|---|
| `the cap is a ceiling…`, beide `the refused POST wrote nothing…`, `the cap does not drift…` | 4 | Audit | `07e5969`, Diff `server.ts`; `audit-adjudications.jsonl:13`: Slice vor Stundenfilter lässt überzählige Journal-POSTs zu. |
| `FIX1: concurrent merges settle…` | 1 | Gate | `2bca3d2`, Diff `server.ts`; `docs/verify-tiering.md:948`: eigene Git-Status-Polls blockieren Rebase-Abbruch mit index.lock. |
| `the sessions payload stays under 12 KB…` | 1 | Audit | `audit-adjudications.jsonl:47`, `audit-adjudications.jsonl:52`: Poll-Payload überschreitet 12-KiB-Vertrag. |
| `§7 fixture: the land gate actually ran…` | 1 | Gate | `3814f40`, Diff `server.ts`; `audit-adjudications.jsonl:56`: running wird vor dem asynchronen Preflight publiziert. |
| `reseed + live bytes…` | 1 | Audit | `docs/verify-tiering.md:1034`, `docs/verify-tiering.md:1047`: doppelte serverseitige Zeile an der Reseed-/Live-Naht; Wurzel noch offen. |
| `subject-gone:…`, `counterprobe: the live subject…`, `tick window: a row…` | 3 | Audit | `c36c1e9`, Diff `server.ts`; `docs/verify-tiering.md:2195`: Tick überschreibt einen inzwischen terminalen Event nach await. |
| `projection nextAction:…` | 1 | Audit | `4c562e7`, Diff `server.ts`; `docs/verify-tiering.md:3104`: Ruhefenster verschluckt erste Beobachtung; Pane bleibt unknown. |
| `outcome: a reviewer answer that did NOT parse…` | 1 | Gate | `audit-adjudications.jsonl:88`, `docs/verify-tiering.md:2305`: neuer Bewohner joint Vorgänger-Review ohne Ergebnisablage; konservativ produktiv gezählt, obwohl die Reparatur an der Probe ansetzt. |

Die vollständigen Namen und roten Datei-/Zeilenbelege stehen in `red-evidence.json` im Scratch.
Alle 755 Namen wurden gegen normalisierten Text im Tiering-Dokument einschließlich §11, Adjudications und Git-Commit-Bodies
abgeglichen; Kandidaten wurden an den oben genannten Diffs und Ursachenabschnitten gelesen.
Das ist keine Durchsicht jedes historischen Git-Diffs. Ein Texttreffer allein zählt nicht als
Produktbeleg. Frühere „flake“-Labels werden bei später belegtem Serverfehler nicht übernommen.
Umgekehrt beschreibt §11.2l beim roten Restart-Check eine verlorene Busy-Vorbedingung
(`docs/verify-tiering.md:2523`); das frühere „real“ in `audit-adjudications.jsonl:105` bleibt
als widersprechendes Urteil dokumentiert und wird nicht als Produktbeweis gezählt.

Die drei Sampling-Rots betreffen `§2 a commit after boot is counted`, `§2 a server-code commit
IS a deploy — this is the line the owner never saw` und `§2b an e2e-only commit is NOT a deploy
— the wrappers load the harness, srv never does`; ihre Ursachen bleiben ohne Produktbeleg offen.

## Nicht gemessen

- Keine Suite ausgeführt; einzige beauftragte Ausführungsprüfung ist `bun e2e/pins.ts`.
- Der TMPDIR-Fallback aus `docs/e2e-trail.md:75` und weitere Remote-/archivierte Register fehlen;
  0 unbekannte Bäume gilt ausschließlich für den gelesenen lokalen Korpus.
- `msSincePrev` enthält Setup und Sleeps, aber keine vollständige Job-Wallclock: Install,
  Build, Typecheck, Mutex-Vorwartezeit und Nachlauf nach dem letzten Check sind nicht erfasst.
- Abbrüche und alte/umbenannte Checks verändern die Nenner; ihre Kosten sind kein Forecast.
  Auch 0 produktive Belege ersetzt keine vollständige kausale Untersuchung aller Rots.
- Kein Lauf mit abgetrennten Szenarien, kein Vorher/Nachher-Vergleich, keine Lastnormalisierung;
  die tatsächlich realisierte Ersparnis dieser reinen Messarbeit beträgt 0 ms.
- `postland-audit`, `acceptance-probe`, `watch-only` und `watchonly` sind mitgezählte Suite-Labels;
  ihr Vorkommen belegt keine Aufnahme in die konfigurierten Gate-/Audit-Kommandos.

## Reproduktion und Prüfung

Scratch: `/tmp/suite-tiering-20260912.n99UKs/`.
`aggregate.json` hält Dateimanifest, Zähler, Semantik und Suite-Aufteilung; `aggregate.csv`
enthält alle 5.607 Namen. `aggregate-red-evidence.jsonl` hält die 1.605 Rotstellen mit Datei/Zeile;
`red-evidence.json` ergänzt Details und Ursacheneinstufung für alle 755 roten Namen. `classification.csv` und `classification.json` enthalten jeden Namen mit Klasse;
`source-map.json`, `classify.py` und `red-screen.py` dokumentieren deren Herleitung.
Der Reader wurde ohne Zeitfenster und ohne Dateicap nachgebildet (`trailstats.ts:186–226`);
Median-Rundung folgt `trailstats.ts:128`. Eine zweite Rohdaten-Summierung bestätigte die Werte.
CSV-SHA256: `f7f4343825d71d24448ef8341da95a7c36239bc3a19188fef978cd585ac9d4fb`.
`python3 /tmp/suite-tiering-20260912.n99UKs/verify-report.py` prüft Partition, Tabellen und Verweise.

```text
RAW_AGGREGATE ALL PASS: 5607 names; 2173633 rows; 1000475306 ms; 1605 red rows; snapshot sizes unchanged
PARTITION ALL PASS: 1275 + 4312 + 19 + 1 = 5607; 755 red names covered; 0 productive reds in Streichbar
REFERENCES ALL PASS: 13 file#symbol references resolve with rg -n
SCREEN ALL PASS: 755 red names, 13 productive, 742 without productive evidence
bun e2e/pins.ts: exit 0
ALL PASS
```

Offen: Produktursachen ohne Beleg und die ausführbare Abtrennung samt heutiger Wallclock.
