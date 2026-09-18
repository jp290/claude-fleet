---
frage: Welches Urteil traegt jede der 40 offenen Auftragszeilen vom 2026-09-18, und in welche Sammelzeile ging sie?
urteil: 5 ueberholt, 1 erledigt, 1 unklar, 30 lebendig (17 in sieben Sammelthemen, 13 Rest), 3 liefen; ausgefuehrt wurden 4 der 5 Ueberholt-Urteile, das fuenfte (1832c7eb) blieb, weil es nur abgeleitet war
bereich: [queue, sichtung, sammelzeilen]
belege: [docs/messungen/2026-09-18-wellenplan-offene-auftraege.md, docs/messungen/2026-09-18-queue-umstellung-sammelzeilen.md, docs/messungen/2026-09-18-queue-durchsatz.md, 5388765c, d190ff8d, 906e1a50]
nicht-gemessen: Commit-Diffs ausser 83989719; ob confirmResolvedCandidate ff-lost selbst meldet; tickMigrate-Rest; Private-repo-aa K5/K6a inhaltlich; keine Pane gelesen
stand: 2026-09-18
---

# Sichtung der 40 offenen Auftraege, 2026-09-18

2026-09-18, Subagent der Orchestratorin Slot 16, nur lesend. Frage: **Welches Urteil traegt jede
offene Auftragszeile, und in welche Sammelzeile ging sie?**

Die Tabellen in §1 bis §4 sind der Bericht des Subagenten, woertlich uebernommen. Sie sind
**seine** Urteile. Nachgeprueft hat die Orchestratorin nur die vier Belege in
`2026-09-18-queue-umstellung-sammelzeilen.md` §Methode 2. Was daraus tatsaechlich wurde, steht in
§5 unten und weicht an zwei Stellen ab.

Grundlage war der gelandete Wellenplan (`5388765c`). Dessen Urteile sind mit **(W)** markiert. Der
Wellenplan zaehlte 34 Zeilen in claude-fleet, die fuenf Fremdrepo-Zeilen kamen hier dazu.
Snapshot: `fleet.json` 2026-09-18 ~10:00Z, 40 Zeilen `kind=auftrag` mit Status pending, queued oder
sent.

## Zahlen

| Urteil | Anzahl |
|---|---|
| ueberholt | 5 |
| erledigt | 1 |
| lebendig | 30 (davon 17 in sieben Themen, 13 in der Restliste) |
| unklar | 1 |
| sent (laeuft, nicht gebuendelt) | 3 (eine davon inzwischen gelandet) |

## 1 · Urteil je offener Zeile

Spalte **Thema**: A–G = Sammelthema (Abschnitt 2), R = Restliste mit Empfehlung, — = nicht buendeln.

| Id | Status | Kurz | Urteil | Beleg | Thema / Empfehlung |
|---|---|---|---|---|---|
| `2cf40772` | sent | Auftrags-Dossier `/api/lane?task=` | laeuft | Lane `fleet/260918081823-4b75` | — |
| `453f7615` | sent → done | Wellenplan | inzwischen gelandet | `5388765c` Ancestor von main; Task-Status done | — (Grundlage dieses Entwurfs) |
| `f437d2b4` | sent | pi-zai fuer den Tick automatisierbar | laeuft | Lane `fleet/260918092619-c0e7` | — ; Voraussetzung dafuer, dass Flash-Karten ohne Handstart laufen |
| `32fed872` | pending | Private-repo-j Preflight-Architect (GAME-CARD-Entwurf, keine Implementierung) | **ueberholt** | private-repo-j `astra-main`: `b35fff6` "defer preflight to M1 M2", `a69cf5a` "archive architect draft", danach `c744bb1` "build playable Bachwiese water and harvest loop" — das Program ist ueber die Preflight-Stufe hinaus; Lane laut note ohne Land geschlossen | archivieren |
| `ad3b3960` | pending | Private-repo-j P0 Engine-Messprobe (nach dem Architect) | **ueberholt** | dieselben Commits; die Probe setzt den Architect-Draft voraus, den `a69cf5a` archiviert hat; `docs/engine-schnittstelle.md` existiert nicht | archivieren |
| `1832c7eb` | pending, Hold | Lebenszyklus S5c: `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM=1` | **ueberholt** (eigener Schluss; (W) sagte "schaerfen") | §8-c im Architekturdoc setzt `FLEET_DISPATCH_MAX_LANES=2` voraus; heute traegt Program f170dc46 fast die ganze Fleet-Arbeit (Durchsatz §c: 98,6 % der Lane-Zeit am Fleet selbst), und die Uebergabe-Notiz 68fbfb95 §1 haelt Platz fuer eine Gruppe mit "ZWEI gleichzeitigen Plaetzen" in genau diesem Program; ein Program-Deckel 1 waere Repo-Durchsatz 1, gegen Richtung 0f2024dc | archivieren |
| `e41ccec1` | queued | Pane-Leser: Textklassifikator vs. "jev" auf echten Panes | **ueberholt** ((W) sagte "starten") | `906e1a50` (Astra-Vorlage §5): K5 Pane-Leser steht UNTER der Schnittlinie — "darunter heute weder Queue-Zeile noch Serverbau noch API-Aufruf"; `b48865c3` "Null-Option gilt" | archivieren; spaeter hoechstens deterministische Wiederholungserkennung (Vorlage §5 Pkt. 7) |
| `d518d09d` | queued | Audit-Zeile traegt den Claim-Bar (warum lokal statt Helfer) | **ueberholt** ((W) sagte "schaerfen", "147 lokal ist die Remote-Zahl") | `d190ff8d` Body: "95/101 Voll-Audits auf dem Helfer", Audit-Dauer Median 37,7 → 14,2 min; Pruefapparatur-Notiz §c: "Hebel 2 ist gebaut" — die Auslager-Frage, die die Zeile beantworten sollte, ist entschieden | archivieren |
| `f68d27d7` | pending, Hold | Private-repo-aa K4 Wetterzeit/Niederschlag | **erledigt** | private-repo-aa `cd8e0b7` "feat: K4 weather timeline…", `git merge-base --is-ancestor cd8e0b7 main` ok; Nachweis `docs/plan/nachweise/K4.md` + K4-Nutzerprobe | archivieren — WICHTIG: die K5-Zeile traegt `after` auf diese Zeile, sie blockiert, solange diese pending bleibt |
| `42c53378` | pending, Hold | tickMigrate ehrlich fuer Program-MAIN | **unklar** | Kern gelandet: `83989719` (kein HANDOFF-Zwang fuer gebundene MAIN, nur claude-Slots, Ancestor ok) und `.env:36` `FLEET_MIGRATE_PCT='32'` seit 09-13. Offen und ungeprueft: ob "Erschoepfung/Fehlzustellung bleibt sichtbar" heute fehlt. MAIN-Kommentar 17.09.: "erst aktuellen Restdefekt lokalisieren". (W): schaerfen | R: als Klaerungsfrage an die MAIN; nur falls ein Restdefekt am Baum belegt ist, in Thema C |
| `c14fcd75` | pending | Weckruf buendeln + inbox-Ack | lebendig | `server.ts#tickWatches` sendet je Event einzeln (`sendText(... path: "fleet-event")`, ~server.ts:16298); inbox-Ack antwortet weiter 409 (server.ts:8775). (W): zusammenlegen | **A** |
| `1e170a25` | pending, Hold | langer Paste kommt nur als Schwanz an → Datei/Inbox | lebendig | kein Schwellen-/Datei-Pfad in `server.ts` gefunden (grep PASTE/long text leer). (W): zusammenlegen | **A** |
| `b5dc4dc2` | pending, Hold | Sammelkarte: MAIN-Entscheid erreicht busy Lane | lebendig (W) | Karte valid, heute gefilet | **A** |
| `803c1869` | queued, Hold | Land-Tuer oeffnet ueber Lane mit geschuldetem Vorschaulauf | lebendig (W) | `program-phase.ts` kennt kein preview/offer (rg leer) | **B** |
| `9940ec64` | pending, Hold | sent + complete-Report + ahead=0 → OWNER_GATE | lebendig | `program-phase.ts` R1–R13 kennen keinen Report-Widerspruch (Regeln gelesen, :200–275) | **B** |
| `e66d9bfc` | pending | guarded-confirm faltet verlorenes FF in `resolved` | lebendig, Rest-Pruefung offen | `server.ts#guardedConfirmJob` setzt bei nicht-"merged" weiter `status: prev?.status ?? "resolved"` (~:10463); ob `confirmResolvedCandidate` selbst `ff-lost` meldet, NICHT gelesen. (W): schaerfen | **B** (erster Schritt: diese Frage am Baum beantworten) |
| `b5a03766` | pending | MAIN kann eigene Attention nicht zurueckziehen | lebendig | `/api/self/attention` nimmt nur GET/POST (server.ts:32321), kein Rueckzug gefunden; Karte ungueltig (StudioGates-Symbol) | **C** |
| `bc1d7866` | pending, Hold | Nachfolge-Brief sagt die Wahrheit + Deckel | lebendig | `server.ts#buildLaneSuccessionBrief` schreibt fest "Kontext voll lief" / "Auftrag ist unveraendert" (:7483f); kein `FLEET_LANE_SUCCEED_MAX` | **C** |
| `84888f35` | queued | Warte-Register als Datenschicht | lebendig (W) | `waits.ts` existiert nicht; Durchsatz §e Posten 4 gehoert laut Messung auf diese Zeile | **D** |
| `4ae22c7a` | queued | MAIN-Release ohne Karte laesst `after` leer | lebendig | `server.ts#releaseTaskForMain` (:10213ff) prueft keine Karte; (W): Wellenpartner von D | **D** |
| `17d80823` | pending, Hold | Sammelkarte: Variantengruppe ganz oder gar nicht | lebendig (W) | Karte valid | **E** |
| `68a45516` | queued, Hold | Varianten-Vergleich mit serverseitiger Check-Ausfuehrung | lebendig (W) | kein Vergleicher in server.ts (grep compareVariant leer); darf laut eigener Karte nicht parallel zur Sammelkarte laufen | **E** (zweiter Commit derselben Lane) |
| `a43caeae` | queued | §11.2y-Schutz sitzt auf 2 von 32 Wartestellen | lebendig | `e2e/programs.ts`: 30× `await waitDoneLooking(`, 2× `await awaitFoundingBrief(` (heute gezaehlt); `d190ff8d`: §11.2y feuert nach Fix weiter (20,8 %) | **F** |
| `2e99a34e` | queued | vier Quelldateien mit NUL-Byte | lebendig | je genau 1 NUL in context-snippets.ts, e2e/attention.ts, e2e/helper-portal.ts, server.ts (heute gezaehlt) | **F** |
| `531bab26` | pending, Hold | `until()` statt fester Timer in der Suite | lebendig, neu zu basieren | kein `until` in `e2e/harness.ts`; Basis 1690 s ist alt: `c9d55638` hat schon 2225 → ~1650 s ueber Env-Knoepfe geholt; Pruefapparatur §c Hebel 4 verlangt zuerst modulweise Messung. (W): schaerfen | **F** |
| `10e2f7c0` | pending, Hold | `--brief` fuer state.sh/register.sh | lebendig (W) | `grep -c -- --brief` = 0 in beiden | **G** |
| `3d339443` | queued | land-quality: Anteil statt Diff-Proxy + auditRedReal | lebendig (W) | kein `auditRedReal` in land-quality.ts | **G** |
| `ee47b0f8` | queued | Lebenszyklus S5b: paneModel-Ruecklese + Push | lebendig | kein `paneModel` im Code; CLAUDE.md nennt die Luecke (Pane-`/model` aktualisiert den Datensatz nicht) | R: behalten, klein, einzeln (Partner der Program-Deckel-Zeile entfaellt, die ist ueberholt) |
| `9fe80661` | pending | README aus der Codebase | lebendig | README.md seit `c09d5f1f` (09-02) unveraendert, 128 Z. | R: behalten; NACH den Themen A–G starten, sonst beschreibt sie einen Stand, der sich gleich aendert |
| `e4409bf2` | pending, Hold | Referenzen, die die Retention nicht sieht (CLARIFY) | lebendig, Befund 1 erledigt | `b0cc4194` "tasks-archive.jsonl — archiving and the cap no longer delete rows" (Ancestor ok): verdraengte Zeilen liegen jetzt ganz im Archiv. Offen: Befund 2 (Lesung "reife Quelle"), Befund 3 (Pin-Deckel) | R: auf Befund 2+3 zuschneiden; ohne Owner-Interesse archivieren |
| `8b2baf60` | pending, Hold | Rollen-Synthese S2: DELEGATION-Kopfzeile + subagentCalls im Ledger | lebendig | VERBOTEN-Haelfte gelandet (`0497df33`, (W)); `DELEGATION`/`subagentCalls` fehlen im Code; `6ace0df8` baute nur die codex-Rollendatei | R: behalten als Kette S2 → S3 (eine Lane, zwei Commits); kein spuerbares Owner-Ergebnis, darum nicht in A–G |
| `fa07734f` | pending, Hold | Rollen-Synthese S3-Schatten: KLASSE-Register | lebendig | kein `executionClass`; wartet laut eigenem Text auf S2 | R: mit S2 zusammen, siehe dort |
| `d02fd2bd` | pending, Hold | Brief-Gegenlese vor dem Start (Messversuch) | lebendig | kein `FLEET_BRIEF_REVIEW` im Code. (W): starten (Opus). Gegenrede: Durchsatz §e Gegenliste "keine weitere Start-Plan-Mechanik"; die Gegenlese verlaengert genau die Phase vor dem Dispatch, in der 78 % der Zeit liegen | R: behalten, NICHT in der ersten Runde; erst nach D (Warte-Register), damit ihr Preis messbar ist |
| `a8e75559` | pending, Hold | ruhende Session schlaeft statt RAM zu halten | lebendig (W) | kein Schlaf-/Park-Zustand im Slot-Code gefunden | R: behalten als eigene mittlere Zeile (Karte valid); (W) Welle 3, nach der pi-zai-Zeile |
| `cd0dda27` | pending, Hold | Dev-Schnittstellen — SKIZZE, Owner "spaeter" | lebendig, geparkt (W) | MAIN-Kommentar: bleibt gehalten bis clarify | R: geparkt lassen |
| `7d70eaeb` | queued | Denkauftrag: welche Task-Felder tragen die Aggregate | lebendig | Notiz existiert nicht | R: eine docs-only Sammel-Messzeile M mit den zwei naechsten Zeilen |
| `b0279bc6` | queued | (b)-Klassifikation stehend: H1 Roh-vs-Routen-Quote, H2 Klassifikator | H2 ueberholt, H1 lebendig | H2 = Kandidat K9 der Astra-Vorlage `906e1a50`: "kein erster Korpus, solange die Taxonomie … instabil bleibt"; H1 ist deterministisch und von der Jev-Entscheidung unberuehrt | R: auf H1 schneiden, in Sammel-Messzeile M |
| `76e08dd3` | queued | Join Quittung-Auslassung vs. Handlesung | lebendig | deterministischer Join, kein Modell; keine Notiz vorhanden | R: in Sammel-Messzeile M (ihre `after`-Kante auf die H1/H2-Zeile entfaellt dann) |
| `d61133e3` | pending, Hold | Private-repo-aa K5 Relief/Farbe | lebendig | Fremdrepo, eigenes Program 247a3746, Owner-Bildentscheid als Starttor | R: behalten, nicht mit Fleet-Zeilen buendeln (Produktzeile, Durchsatz §e Posten 3 will genau solche nach vorn) |
| `e49b91bf` | pending, Hold | Private-repo-aa K6a DE/AT-Geografie | lebendig | Fremdrepo, nach K5 | R: behalten |

## 2 · Sieben Sammelthemen

Reihenfolge-Regel aus dem Wellenplan (§c): hoechstens 3 Lanes, hoechstens eine auf server.ts ohne
disjunkte Ranges. Fuenf Themen fassen server.ts an (A B C D E) und laufen darum **seriell auf einem
Platz**; F und G fassen server.ts nicht oder nur mit einem Byte an und laufen **parallel** dazu.

| Thema | Titel | Ergebnis, das der Owner spuert | Zeilen | Groesse | ROLLE | Kollisionsflaeche |
|---|---|---|---|---|---|---|
| **A** | Zustellung, die ankommt | Eine Session bekommt jede Nachricht vollstaendig, gebuendelt statt als Salve, und eine Entscheidung der MAIN erreicht auch eine Lane, die gerade arbeitet — kein abgeschnittener Paste, kein verpasster Entscheid mehr. | 3 (Tabelle, Thema A) | gross | claude/opus/high — Urteilsanteil: Zustell-Naht (idle-Uebergang, Occupant-Identitaet), so schon (W) | server.ts#tickWatches #sendText #deliverFleetReportDecision #decideFleetReport, server/types.ts, e2e/watch.ts, e2e/slots.ts, e2e/programs.ts, docs/self-api.md |
| **B** | Die Land-Tuer sagt nur "lande", wenn es stimmt | Die MAIN bekommt "inspect the diff, then land" nur noch fuer Lanes, die wirklich landbar sind; ein widerspruechlicher Abschluss landet als Owner-Frage statt als "laeuft noch", und ein verlorenes Fast-Forward heisst nicht "resolved". | 3 (Thema B) | mittel | claude/opus/high — Land-Naht (Gate-/Proportions-Klassifikation), so schon (W) | program-phase.ts#phaseOf, verify-proportion.ts, server.ts#programExecutionView #guardedConfirmJob, e2e/programs.ts |
| **C** | MAIN-Tueren und Lane-Nachfolge ohne Handarbeit | Eine MAIN raeumt ihre eigenen ueberholten Blocker selbst weg, und eine Nachfolge-Lane weiss, warum sie uebernimmt und was die MAIN zuletzt entschieden hat — keine Endlos-Staffelstaebe. | 2 (Thema C) | mittel | pi-zai/glm-5.3-flash/high | server.ts#openAttention #buildLaneSuccessionBrief #succeedLane #laneHandoffReportFor, server/types.ts, e2e/programs.ts, e2e/self-token.ts, docs/self-api.md |
| **D** | Jedes Warten hat einen Grund und einen Adressaten | Wer die Queue ansieht, liest je wartender Zeile, worauf sie wartet und wer es loesen kann; eine Freigabe ohne gueltige Karte wird abgelehnt statt spaeter still zu klemmen. | 2 (Thema D) | gross | claude/opus/high — grosser Brocken mit Urteilsanteil, so schon (W) | server.ts#tickDispatch #startPlanNow #releaseTaskForMain #openAttention, server/types.ts, start-plan.ts (lesend), NEU waits.ts, e2e/tasks.ts, e2e/programs.ts, docs/queue-analyst.md, docs/self-api.md |
| **E** | Varianten zu Ende gebaut | Eine Variantengruppe startet ganz oder gar nicht, der Server vergleicht die Varianten mit echten Checks, und genau eine landet — ohne Handvergleich. | 2 (Thema E) | gross | pi-zai/glm-5.3-flash/high ((W): beide Flash) | server.ts#startVariantGroup #releaseTaskForMain #variantReserveHolds, server/types.ts, e2e/tasks.ts, docs/queue-analyst.md, docs/self-api.md |
| **F** | Die Pruefapparatur hoert auf, falsch rot zu sein | Weniger falsche Audit-Rots aus der §11.2y-Familie, Suchen finden, was im Code steht, und die Vorschau-Suite wird kuerzer, ohne dass ein Check faellt. | 3 (Thema F) | gross | pi-zai/glm-5.3-flash/high | e2e/programs.ts, e2e/harness.ts, e2e/pins.ts, e2e/attention.ts, e2e/helper-portal.ts, context-snippets.ts, server.ts (ein Byte), docs/verify-tiering.md |
| **G** | Erdung kurz, Kennzahlen ehrlich | Jede Session erdet sich mit einer Kurzfassung statt 68 KB, und `state.sh` zeigt in einer Zeile den echten Nacharbeits-Anteil und die echten Audit-Rots statt eines Diff-Groessen-Proxys. | 2 (Thema G) | mittel | pi-zai/glm-5.3-flash/high | state.sh, register.sh, land-quality.ts, e2e/pins.ts, docs/controller.md |

### Done und Verify je Thema

| Thema | Hartes Done-Kriterium | Verify |
|---|---|---|
| A | (1) 3 gleichzeitig feuernde Watches eines Empfaengers ergeben genau 1 Pane-Send mit allen Event-Ids; (2) ein inbox-Event ist per Self-Ack quittierbar (heute 409); (3) ein 200-KB-Text kommt vollstaendig an — Fixture vergleicht den Hash; (4) eine Report-Entscheidung an eine busy Lane wird zugestellt, sobald sie idle ist, und an einen recycelten Slot nie. Je Punkt ein Check, der mit der zurueckgedrehten Aenderung rot wird. | install, pins, tsc, build, clean-review, security, claude-gate; `./e2e-isolated.sh` per Suite-Offer (e2e/ angefasst) |
| B | (1) eine Lane mit geschuldetem/rotem/laufendem Vorschaulauf projiziert NICHT REVIEWABLE mit "land it yourself"; (2) sent + complete-Report + ahead=0 ergibt OWNER_GATE mit benanntem Widerspruch in `phaseBasis`, derselbe Fall mit ahead=1 bleibt REVIEWABLE; (3) ein verlorenes FF im guarded-confirm ist als eigener Grund lesbar, nicht als `resolved` — oder die Lane weist am Baum nach, dass es heute schon so ist, und streicht den Teil mit Beleg. | install, pins, tsc, build, clean-review, security, claude-gate; `./e2e-clean-review.sh` (Land-Pfad); `./e2e-isolated.sh` per Suite-Offer |
| C | (1) eine gebundene MAIN zieht eine eigene offene Attention per Self-Tuer zurueck, eine fremde bekommt 409; (2) der Nachfolge-Brief nennt den Grund aus dem handoff-Report und die juengste MAIN-Entscheidung zur Zeile statt der festen Saetze; (3) ueber dem Deckel antwortet succeed 409 mit Hinweis auf needs-main; (4) ein codex-Slot bekommt keinen succeed-Hinweis. | install, pins, tsc, build, clean-review, security, claude-gate; `./e2e-isolated.sh` per Suite-Offer |
| D | (1) `GET /api/start-plan` traegt je wartender Zeile einen Grund und einen Adressaten, abgeleitet ohne Zustand (`waits.ts`); (2) ein Hold ohne Grund wird abgelehnt oder traegt `grund: null` sichtbar; (3) MAIN-Release einer Zeile ohne gueltige Karte → 409; Karte ohne `after` bei Text mit `NACH <id>` → 409; gueltige Karte mit after → 200 und der Plan wartet. | install, pins, tsc, build, clean-review, security, claude-gate; `./e2e-isolated.sh` per Suite-Offer |
| E | (1) die Sammelkarten-DONE woertlich (Gruppe ganz-oder-gar-nicht, Deckel zaehlt n, gehaltener Anspruch faellt); (2) danach, als eigener Commit, der Vergleicher mit serverseitiger Check-Ausfuehrung nach dem bestaetigten Kriterium der Vergleichszeile. Beide Teile seriell in einer Lane. | install, pins, tsc, build, clean-review, security, claude-gate; `./e2e-isolated.sh` per Suite-Offer |
| F | (1) alle 30 `waitDoneLooking`-Stellen in e2e/programs.ts warten auf die positive Tatsache wie `awaitFoundingBrief`, ein Pin haelt die Zahl der ungeschuetzten Stellen bei 0; (2) die vier NUL-Bytes sind durch Escapes ersetzt, bit-identisches Verhalten, ein Pin verbietet neue NUL in getrackten .ts; (3) `until()` in e2e/harness.ts, und drei serielle Laeufe zeigen den Median der Trail-Summe mind. 15 % unter einer HEUTE gemessenen Basis bei gleicher Checkzahl — Basis vor der Aenderung messen, nicht die alte Zahl nehmen. | install, pins, tsc, build, clean-review, security, claude-gate; `./e2e-isolated.sh` seriell (Flake-/Zeitbeweis LOKAL, nicht per Offer) |
| G | (1) `./state.sh --brief` und `./register.sh --brief` geben je ≤ 40 Zeilen, erste Zeile nennt Zeilen- und Byte-Zahl der Vollausgabe samt Kommando; ohne Flag byteidentisch bis auf diese Kopfzeile; unbekanntes Flag exit 2; (2) die land-quality-Zeile in `state.sh` fuehrt den Anteil statt `rework3d %` und `auditRedReal` neben `auditRed`, beides aus der Sammelzeile woertlich. | install, pins, tsc, build (kein server.ts; e2e/pins.ts angefasst → pins) |

### Abhaengigkeiten und Reihenfolge

| Platz | Folge | Warum |
|---|---|---|
| server.ts-Platz | **D → A → E → B → C** | D zuerst: die Durchsatz-Messung nennt das Warte-Register als den ungebauten Hebel ("genau die, die nicht gebaut sind"), und jedes spaetere Reihenfolge-Urteil liest seine Daten. A danach: Owner-Prioritaet "Zustellung langer Texte MAXIMAL robust". E: Karte schon valid, kostet keine Vorbereitung. B und C haben schaerfbare Teile (FF-Frage, Karten-Gaps), die die MAIN vorher klaeren kann. D und E beruehren beide `releaseTaskForMain` → nie parallel. |
| zweiter Platz | **G → F** | kein server.ts (F nur ein Byte, disjunkte Region): laufen neben dem server.ts-Platz. G ist klein und spart jeder Folge-Session Erdung; F braucht serielle Suite-Laeufe und damit ruhige Maschine. |
| dritter Platz | die laufende pi-zai-Zeile, danach Produktzeilen (Private-repo-aa K5) | Durchsatz §e Posten 3: ein Platz gehoert einer GROSS- oder Produktzeile. |

Nicht-Abhaengigkeit, benannt: ROLLE pi-zai/glm-5.3-flash startet ueber den Tick erst, wenn die
laufende pi-zai-Zeile gelandet ist (heute `automatable:false`, (W) §d); bis dahin brauchen C, E, F,
G einen Owner-Handstart.

## 3 · Restliste — Empfehlungen zusammengefasst

- **Archivieren (6):** die zwei Biber-Preflight-Zeilen, die Program-Deckel-1-Zeile, der Pane-Leser,
  die Claim-Bar-Zeile (alle ueberholt) und die erledigte Private-repo-aa-K4-Zeile (entsperrt K5).
- **Sammel-Messzeile M (docs-only, kein Bau):** Feld-Kataster + H1-Quote + Quittungs-Join in einer
  Lane, drei Abschnitte einer Notiz, VERIFY install, pins. Nach Richtung 0f2024dc nicht vor den
  Bau-Themen.
- **Behalten, einzeln:** paneModel-Ruecklese (klein), README (nach A–G), Schlaf-Session (mittel),
  Private-repo-aa K5/K6a (Produkt), Rollen-Kette S2→S3 (eine Lane, zwei Commits, spaeter).
- **Zurueckstellen:** Brief-Gegenlese (erst nach D messbar).
- **Zuschneiden oder archivieren:** Retention-Referenzen (Befund 1 erledigt).
- **Klaeren:** tickMigrate-Rest.
- **Geparkt lassen:** Dev-Schnittstellen-Skizze.

## 4 · Was NICHT geprueft wurde

- Inhalt der Commits nur ueber Subject/Body; Diffs gelesen nur fuer `83989719` (Body), nicht fuer
  `b0cc4194`, `c9d55638`, `cd8e0b7` (dort nur Nachweis-Doc + Ancestor).
- Ob `confirmResolvedCandidate` ein verlorenes FF selbst als `ff-lost` meldet (Thema B, Teil 3).
- Ob die Erschoepfungs-Sichtbarkeit von tickMigrate heute fehlt (darum `unklar`).
- Die Kartenvalidierung: vom Subagenten nicht gefahren; die Orchestratorin hat sie danach lokal
  nachgeholt (Umstellungs-Notiz §Methode 3).
- Die zwei Private-repo-aa-Zeilen K5/K6a nur auf Status und after-Kante geprueft, nicht inhaltlich.
- Die Biber-Zeilen nur ueber `git log` des Worktrees `private-repo-j.worktrees/astra-main`, nicht gegen
  das Program-Record 9ce08219.
- Der Ueberholt-Schluss zur Program-Deckel-1-Zeile (S5c) ist abgeleitet (Program-Lastverteilung + Uebergabe-Notiz), kein
  woertlicher Owner-Entscheid gegen den Program-Deckel.
- Keine Pane gelesen; welche der queued Zeilen im Moment wirklich startbar ist, sagt nur
  `GET /api/start-plan` (nicht abgefragt).


## 5 · Was ausgefuehrt wurde (Orchestratorin, 2026-09-18 ~10:10–10:20Z)

| Thema | Sammelzeile (gueltige Fassung) | archiviert, Grund „aufgefangen in Sammelzeile …" |
|---|---|---|
| D | `7404df11` | `84888f35`, `4ae22c7a` |
| A | `40235c0c` (NACH D) | `c14fcd75`, `1e170a25`, `b5dc4dc2` |
| E | `85f45012` (NACH A) | `17d80823`, `68a45516` |
| B | `6a58c0f5` (NACH E) | `803c1869`, `9940ec64`, `e66d9bfc` |
| C | `07a0ce56` (NACH B) | `b5a03766`, `bc1d7866` |
| F | `85fa31bc` | `a43caeae`, `2e99a34e`, `531bab26` |
| G | `713881a5` | `10e2f7c0`, `3d339443` |

Die Quellzeilen nennen im Archivgrund die Id der ERSTEN Fassung (`1a373ca6` `43e7dab2` `9780234b`
`5abfda7c` `6adec096` `a1e2826f`). Diese Fassungen wurden archiviert und ohne `Task.spawn` neu
gepostet (Umstellung §Falle 2). Die Tabelle oben fuehrt von der alten Id zur gueltigen.

- **Ueberholt, archiviert mit Beleg:** `32fed872`, `ad3b3960`, `e41ccec1`, `d518d09d`.
- **Erledigt:** `f68d27d7` → Status `done`, nicht archiviert. Grund: `d61133e3` (K5) traegt eine
  `after`-Kante auf K4 und bliebe sonst stehen.
- **Abweichung 1:** `1832c7eb` bleibt. Das Ueberholt-Urteil war nur abgeleitet, einen Owner-Entscheid
  dagegen gibt es nicht (§4, vorletzter Punkt).
- **Abweichung 2:** `7d70eaeb` sollte in die Sammel-Messzeile M. Die Program-Politik `card-valid` hat
  die Zeile nach dem Deploy wieder freigegeben, und der Tick hat sie einzeln gestartet (Umstellung
  §Falle 1). Sie ist inzwischen gelandet (`6f70ab7a`). Die Messzeile M besteht damit nur noch aus
  `b0279bc6` (H1) und `76e08dd3` und ist nicht angelegt.
- **Ueberholt durch den Deploy:** der Satz in §2 „bis dahin brauchen C, E, F, G einen
  Owner-Handstart". Seit Deploy `9cf31f46` (`b2d92216`) startet der Tick `pi-zai`-Zeilen selbst.
- **Vorher archiviert:** `f3ca2e05` (Second-host-Lanes), ueberholt durch `710fbf40` und `39857582`.
  Das Urteil kam von einer Clarify-Lane, nicht aus dieser Sichtung.
