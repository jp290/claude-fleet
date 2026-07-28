<!-- GEBORGEN 2026-07-28 (Session 11): Dieses Dokument ist Session 10s Vereinfachungsplan mit
der Ring-Ordnung ("von außen nach innen"), der nur im Session-Scratchpad lag und nie committet
wurde — die committeten Schatten (HANDOFF, findings) trugen den Inhalt OHNE das Ring-Vokabular.
Verbatim gerettet; Stand seither: Ring 0 und 2.1 GELANDET (a1ffd2b..c4b74cc, bef570a, feb8737).
Zahlen-Korrekturen seit diesem Plan stehen in docs/analysis-2026-07-28-verification.md:
outcomeTally hat 4 Schreiber (propose lebt, 11x), Fold-Ersparnis ~150 TS + ~90 Shell, 34 Paare
verifiziert, 2 neue Brüche (watchdog-Kommentar, tsc-Liste). -->

# Vereinfachungsplan — 2026-07-28, Basis HEAD 479f78c

Ziel ist **kleiner**, nicht „behoben": weniger Zeilen, weniger Zustände, weniger Orte,
die von Hand übereinstimmen müssen. Von außen nach innen.

Grundlinie: 21.836 Zeilen Code (davon `server.ts` **4.777 Code**-Zeilen + 2.179 reine
Kommentarzeilen), 13.418 Zeilen Prosa, 42 `FLEET_*`-Flaggen, 34 API-Routen, 8.903 Zeilen
Verifikations-Substrat.

## Was der Plan NICHT tut — und warum das die größte Vereinfachung ist

**Keine Extraktion aus `server.ts`.** Gemessen (Agent D): die einzige saubere Naht ist
Transport+Static, 238 Zeilen, **3,3 %** der Datei. `server.ts` wuchs 26.→27. Juli von 6.201
auf 7.109 Zeilen — **+908 in zwei Tagen**. Die beste Extraktion ist ein halber Tag Wachstum.
Jede Kandidaten-Grenze *erzeugt* Muss-übereinstimmen-Paare (`saveState`↔Modulzustand,
`openSlot`↔elf `forget()`-Aufrufe, Boot-Restore↔modul-eigene Persistenz) und beseitigt keines,
weil die existierenden Paare nicht von Ko-Lokation kommen, sondern von duplizierten Idiomen
und umgangenen Helfern — beides datei-lokal behebbar.

**Nicht M2 aus `docs/structural-plan.md` wie geschrieben.** `appendEvent`+`readLedger`+
`readEventLog` besitzen die Disziplin bereits (48 Zeilen); M2 ist zu 85 % geliefert, der Rest
sind **vier Bypass-Aufrufstellen ≈10 Zeilen**. Und eine der vier versprochenen Verbesserungen
— „eine Projektion für Route und Client" — wäre eine **Rechte-Regression** (`/api/lane-outcomes`
liefert dem Owner Rohzeilen, `ledgersView` dem Steward eine Whitelist, `server.ts:5537` sagt warum).

**Der Ausbau-Pfad, falls je wieder extrahiert wird**, steht empirisch fest: sechs Module wurden
hier erfolgreich extrahiert (`continuity.ts`, `lane-signals.ts`, `merge-prompt.ts`,
`enhance-prompt.ts`, `backoff.ts`, `md.ts`) — **alle mit null Modulzustand, null I/O, null
Rück-Import**. `server.ts` besitzt Zustand und Datei, das Modul besitzt die *Ableitung*.
Ableitungen hinaus, niemals Zustand.

---

## Ring 0 — Live-Defekte im Substrat (Voraussetzung, nicht Vereinfachung)

Ein lautes Substrat macht jede spätere Verifikation teuer. Vier Änderungen, zusammen ~20 Zeilen.

| | Was | Anker | Beweis |
|---|---|---|---|
| 0.1 | `fleet-e2e-claude-gate.ts` hat **keine** Live-Socket-Weigerung; die vier Geschwister haben sie | fleet-e2e-claude-gate.ts:14-17 vs fleet-e2e.ts:42 | Agent E, verifiziert |
| 0.2 | Port-Bänder überlappen um **1800** | e2e-postland-audit.sh:13 vs e2e-security.sh:17 | 2× unabhängig verifiziert |
| 0.3 | Drei Gate-Suiten warten mit flachem `sleep 2` statt auf echte HTTP-Bereitschaft | claude-gate/clean-review/security vs isolated:247 | Agent E |
| 0.4 | `e2e-isolated.sh` schreibt dieselben ~15 Knöpfe zweimal (:244, :260); ein Knopf in nur einem revertiert still beim Mid-Run-Restart | e2e-isolated.sh:255-259 (eigener Kommentar) | Agent E |

→ **Lane A**, läuft.

## Ring 1 — Die Konfigurationsfläche: erst sichtbar, dann kleiner

**Korrektur an meiner eigenen ersten Idee.** „Eine Konfigurationsdatei" ist **nicht verfügbar**:
30 der 42 Werte werden von Test-Wrappern gesetzt, und Agent A hat 20 Randbedingungen aufgelistet,
die jeder Entwurf erhalten muss (u.a. `FLEET_SOCK`/`FLEET_PORT` müssen beim Modulladen auflösbar
sein; sieben `*_CMD`-Haken müssen pro Prozess auf ein Skript im `$$`-Scratch zeigen können;
`auditChildEnv` muss *jedes* `FLEET_*` als **Regel** strippen können). Das Richtige ist kleiner:

| | Was | Warum das die Fläche verkleinert |
|---|---|---|
| 1.1 | **Ein Konfigurations-Sensor** in `state.sh` / einer Route | **31 von 42 Werten haben heute gar keinen Sensor**, darunter alle sechs der Gefahrenliste. `state.sh` leitet HEAD, Lanes, Ledger, Prozesse, Hygiene ab — und **null Konfiguration**. Das ist die Lücke, aus der „deployGap grün und falsch" folgt |
| 1.2 | **Die 9 Kostüm-Variablen löschen** (`FLEET_MODEL`, `FLEET_SUMMARY_MODEL`, `FLEET_CHIPS`, `FLEET_GIT_TIMEOUT_MS`, `FLEET_STEWARD_SENDS_PER_HOUR`, `FLEET_STEWARD_MAX_PENDING`, `FLEET_MERGE_TIMEOUT_MS`, `FLEET_MERGE_REPAIR_ROUNDS`, `FLEET_CLEAN_REVIEW_TIMEOUT_MS`) | von *nichts* gesetzt, je. „Ein hartkodierter Default im Env-Var-Kostüm." Echte Löschung, −9 Verzweigungen |
| 1.3 | `FLEET_SOCK`/`FLEET_PORT`-Defaults von Live-Socket/Port wegbewegen | Produktion läuft **auf den Defaults**; der einzige Schutz ist Konvention in sieben Skripten |

*1.2 wartet auf Agent C (Löschkandidaten) — die Lane soll vorschlagen, nicht blind löschen.*

## Ring 2 — Aufgelöste Optionalität und duplizierte Idiome in `server.ts`

| | Was | Entfernt |
|---|---|---|
| 2.1 | **`runWorker(…)`** — die acht identischen Worker-Gabeln zu einer; dabei das Tool-Profil zu einem **erforderlichen, typisierten** Parameter machen | −44 Zeilen, −8 Muss-übereinstimmen-Paare, **und die größte Deckungslücke des Substrats wird ein Compile-Fehler** |
| 2.2 | `saveState` ↔ Boot-Restore als **eine** deklarative Feldtabelle (21 Schlüssel, heute 170 Zeilen in zwei Richtungen von Hand) | ~−100 Zeilen; die größte Muss-übereinstimmen-Fläche des Repos wird strukturell unbrechbar |
| 2.3 | Die vier Rotations-Bypässe — **in dieser Reihenfolge**: erst die Leser (`laneOwnerPrompts:3476`, `continuityView:5524`, Boot `:4862`), **dann** der Schreiber (`logPrompt:378`) | schließt Klasse A8; `prompts.jsonl` steht bei 69 % der Rotationsschwelle, die umgekehrte Reihenfolge **bewaffnet** zwei stille Leser |

→ **2.1 ist Lane B**, läuft. 2.2 zuletzt und allein (Begründung in der Selbstprüfung).

## Ring 3 — Das Verifikations-Substrat

| | Was | Entfernt |
|---|---|---|
| 3.1 | Die fünf `cp`-Listen **ableiten** statt pflegen | die Fehlerklasse, die `e2e-postland-audit.sh` wochenlang still getötet hat |
| 3.2 | Danach: die vier Einzeldatei-Harnesses auf `e2e/harness.ts` falten | ~−260 Zeilen — **und der Pre-Land-Gate bekommt zum ersten Mal einen Trail** (heute deckt er `e2e-isolated` allein ab; die 158 Checks, die tatsächlich gaten, hinterlassen null Beobachtung) |
| 3.3 | tsc-Liste in `watchdog.sh:71` auf `*.ts src/*.ts` weiten — **erst messen** | `fleet-e2e-postland-audit.ts` fehlt dort; dieselbe Auslassungsklasse |
| 3.4 | Client-Klassifizierer (`kProgress`, `postLandAlarm`, `pollPlan`) nach `src/` ziehen und importieren statt per `indexOf`-Slice + Transpiler | 3 fragile Tricks; ~19 Regex-über-Quelltext-Checks werden echte Tests |

**Nicht** der parametrisierte Einheits-Wrapper (S7) — höchstes Risiko der Liste, die Schicht
zwischen Testlauf und LIVE-Socket. Erst nach 3.1/3.2, wenn weniger zu parametrisieren ist.

---

## Selbstprüfung: die zwei Stellen, an denen dieser Plan am wahrscheinlichsten falsch ist

**1 — Ring 1.2 („die 9 Kostüm-Variablen löschen") unterstellt, dass nie-gesetzt = wertlos.**
Sie könnten bewusste Notausgänge sein: ein Wert, den man ändern will, ohne auf einer Maschine
zu deployen, auf der Deployen teuer ist. Der Löschantrag entfernt dann eine Betreiber-Fähigkeit,
die nie gebraucht wurde, aber billig zu halten ist. **Was das widerlegen würde:** ein Fund in
`drills/`, in einer Doc-Prozedur oder in einem vergangenen Vorfall, wo einer davon von Hand
gesetzt wurde. **Absicherung:** Agent C liefert die Löschliste; die Lane *schlägt vor* und löscht
nicht blind, und `FLEET_CLEAN_REVIEW`s Dreiwertigkeit bleibt ausdrücklich unangetastet (laufende
Messreihe).

**2 — Ring 2.2 ist die riskanteste Änderung im Plan, und ich habe sie auf Platz 2 gesetzt.**
Sie fasst den Boot-Pfad eines Systems an, dessen **Credential-Store genau diese Datei ist**.
Agent D maß 16 der 21 Blöcke als reines Validate-and-Assign und 5 als echte Migrationen — aber
„rein" wurde durch Lesen bestimmt, und ein einziges falsch migriertes Feld bedeutet frisch
geprägtes Owner-Token = **Totalaussperrung**. Der vorhandene Schutz (`.bak`, Verschieben der
korrupten Datei) schützt die **Datei**, nicht einen *falschen-aber-parsebaren* Restore.
**Was das widerlegen würde:** wenn die fünf bespoke Migrationen miteinander interagieren, ist die
Tabelle eine schlechtere Abstraktion als die 161 handgeschriebenen Zeilen — dann fällt 2.2 ganz.
**Absicherung:** zuletzt, allein, und mit einer Rundreise-Eigenschaft (`save → restore → save`
byte-identisch) **bevor** irgendetwas anderes angefasst wird.

**3 (ehrlich, kein Ranking) — ich starte zwei Lanes, bevor Agent B und C berichten.** Beide
berühren nichts, worüber B oder C urteilen. Überschneidet sich Cs Löschliste mit Ring 3, kostet
das einen Rebase, keine Rücknahme.

---

## Ring 4 — Löschen (Agent C): ~1.800 Zeilen, 8 % des Codes

Nach Konfidenz geordnet. **Jede Zeile hat negative Evidenz**, nicht nur fehlende positive.

| | Was | Zeilen | Beweis |
|---|---|---|---|
| 4.1 | `steward-arena.sh` + `docs/steward-arena.md` | 487 | **Ist bereits kaputt**: `:155` kopiert 2 von 4 lokalen Modulen, stirbt seit ≥07-26 an der Modulauflösung. Null Referenzen im Repo |
| 4.2 | Die **Interventions-Outcome-Messung** (Produzent, Tally, Prädikat, Route, Boot-Restore) | ~590 | `grep -c 'steward_send' audit.jsonl` = **0** über ein unrotiertes Log seit 07-21. Der einzige Produzent hat **nie** gelaufen; `GET /api/steward/outcomes` hat **keinen Aufrufer** |
| 4.3 | Transport-Byte-Ledger | ~100 | `/api/transport`: 0 Aufrufer außer e2e. **`transportWs` NICHT löschen** — es ist der Kompressionsschalter im Buchhaltungsmantel |
| 4.4 | `/api/repo-base` + `repoBases` | ~35 | live `{}`, kein Client-Aufrufer |
| 4.5 | Sechs Nur-Schreib-Felder (`Auto.created`, `Auto.lastRun`, `PostLandAuditRow.startedAt/cmd`, `OutcomeReview.dirty`, `LandRecord.repo`) | ~15 | die ersten beiden reiten auf `/api/sessions`, das alle 2 s pollt |
| 4.6 | Fünf tote Docs | ~550 | Prämisse erledigt; **erst Axiome A4/A8/A9/A10 aus `autonomy-plan.md` bergen** — vier andere Docs zitieren sie nach Nummer |
| — | `Slot.mission` (~84) | | mechanisch sauber, aber **zwei Tage alt** — Owner-Entscheidung, keine Lane |

**NICHT löschen** (Agent Cs wichtigste Liste): die zehn nie gefeuerten `AuditEvent`-Literale
(Recovery-Pfade tun ihre Arbeit, indem sie schweigen) · `VERIFY_SKIP_EXIT` · die sieben
`*_CMD`-Testnähte · `e2e-postland-audit.sh` (kaputt, weil niemand es fährt — **Aufrufer geben,
nicht löschen**) · das Share-Subsystem · `transportWs`.

## Der Mechanismus (Agent B): 37 Muss-übereinstimmen-Paare, 31 davon still

**Kein Bündel Einzelfixes — ein Mechanismus, den dieses Repo bereits viermal gebaut hat,
ohne zu merken, dass es einer ist:** `e2e/security.ts:73` extrahiert Routen aus dem Quelltext
von `server.ts` und verlangt Gleichheit; `lane-signals.ts:48` generiert die Prosa aus dem
Prädikat; `server.ts:5433` speist Validator und Prompt aus einem Array; `e2e/harness.ts:63`
ersetzt eine Env-Whitelist durch eine *Regel*. **27 der 37 Zeilen haben exakt diese Form.**

Drei Stücke, in dieser Reihenfolge: **(1) `e2e/pins.ts`** — reine Textprüfungen über das Repo,
Millisekunden, gehört als *erster* Schritt in `watchdog.sh:71`. **(2) `src/protocol.ts`** — die
geteilten Konstanten und Interfaces; danach macht tsc, das ohnehin gatet, jede dieser Drifts
zu einem Compile-Fehler. **(3) Eine Konvention statt eines Werkzeugs für die Doc-Referenzen.**

Sechs Paare sind **jetzt** gebrochen: `steward-arena.sh:155` · `BACKGROUND_MARKS` (2 Marker gegen
8 Aufrufstellen → nach einem Restart wird ein fremdes Resolver-/Digest-Transcript als eigene
Unterhaltung des Slots serviert) · der Render-Key ohne `git.behind` · `verify-tiering.md` sagt
Tier-2 sei auskommentiert, produktiv läuft es · **102 von 117 Doc-`file:line`-Referenzen tot** ·
und `CLAUDE.md`s NUL-Regel.

**Die Referenz-Zahl ist die härteste:** 15 treffen, 98 daneben, 4 falsch — 87 % zeigen nicht mehr
auf das, was sie behaupten, Abweichungen bis **+2463 Zeilen**. Am schlimmsten `docs/security-model.md`,
das Trust-Perimeter-Dokument, wo **jeder** geprüfte Anker tot ist. Die Gegenprobe entscheidet die
Konvention: **38 von 38 Symbol-Ankern** der Form `` (`server.ts`, grep `runCleanReview`) `` lösen
auf. Null tot.

## Von Hand im Haupt-Checkout nachzuziehen (CLAUDE.md ist gitignored)

1. **Die NUL-Byte-Regel streichen.** `src/client.ts` enthält kein NUL mehr (behoben in `688d22e`,
   Ancestor von HEAD); plain `grep -c 'MAX_CHUNK' src/client.ts` liefert 2, exit 0. Die Regel ist
   diese ganze Session in jeden Agenten-Prompt gewandert.
2. **„ALLE vier Wrapper prüfen" → sechs Skripte** tragen `cp`-Listen (die fünf plus `steward-arena.sh`).
3. **„Der Dispatcher ist verfügbar UND an" → er steht auf `off`** (`fleet.json` `"dispatch": false`).
4. `docs/lane-brief-template.md:84-85` beschreibt den Land-Gate falsch — und diese Datei geht in
   jeden Lane-Start. (Nicht gitignored, also per Lane behebbar.)

## Lane-Zerlegung

| Lane | Ring | Dateien | Kollisionsfläche |
|---|---|---|---|
| **A** | 0 (alle vier) | die fünf `e2e-*.sh`, `fleet-e2e-claude-gate.ts` | **null** zu B |
| **B** | 2.1 | `server.ts` (Worker-Regionen), `e2e/prompts.ts` | **null** zu A |
| *später* | 1.1/1.2, 3.1→3.2, 2.3 | | |
| *zuletzt, allein* | 2.2 | `server.ts` Boot | |

Beide Lanes: **do NOT land** — Hausdoktrin „Lanes report, the owner lands", vom Owner nicht
aufgehoben. Der Dispatcher steht auf `off`, kann also keine dritte Lane danebenstellen.
