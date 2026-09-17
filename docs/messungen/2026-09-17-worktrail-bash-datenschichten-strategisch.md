---
frage: Welche Datenschichten des Fleets sind aggregiert, wer liest die Aggregate, und an welcher Stelle greifen Orchestrator, Program-MAIN und Lane zu Bash, weil die passende Schicht unbekannt ist, nicht passt oder fehlt?
urteil: Dem Fleet fehlen kaum Schichten, es fehlen Türen zu ihnen. Von 283 symptomatischen Bash-Aufrufen in neun Sessions dreier Rollen treffen 241 (85 %) einen Fall, für den eine Aggregation schon existiert (95 unbekannt, 146 falsch geschnitten), nur 42 brauchen einen Neubau. Fünf Ledger mit Leseroute werden zu 91,9 % roh gelesen (1.480 zu 131 in 14 Tagen), das Lane-Dossier hat null Agenten-Leser, und die drei Verb-Vorschläge vom 15.09. liegen ungefilet als Notiz 9d610a68, während ihr Auth-Befund in drei von vier Haupt-Checkout-Sessions wiederkehrt.
bereich: [datenlayer, worktrail, bash, cli]
belege: [docs/messungen/2026-09-15-worktrail-orchestrator-bash-datenschichten.md, server.ts#laneDossier, server.ts#ledgersView, server.ts#programExecutionView, ctl.sh, state.sh, register.sh, land-quality.ts]
nicht-gemessen: Codex- und Pi-Sessions (Astra, GLM), Browser-Leser der Routen, tatsächliche Ersparnis der drei Auftragszeilen, was Agenten aus einer Pane-Lesung brauchen, Modellkosten je Aufruf.
stand: 2026-09-17
---

# Bash-Benutzung und die aggregierten Datenschichten: strategische Worktrail-Analyse

2026-09-17, Lane `fleet/260917072842-ec0d`, Baum `e93c3de9` (Fork-Basis, auf main). Frage: **Welche
Datenschichten hat dieses Fleet, welche davon sind aggregiert, und wo greift ein Agent zu Bash,
weil die passende Schicht fehlt oder unauffindbar ist?** Owner-Vorgabe, wörtlich: „eine Strategische
Worktrail Analyse ... mit fokus auf die bash-cmnd benutzung und die dazugehoerigen Daten und ihre
aggregierten schichten".

Die taktische Hälfte steht in `docs/messungen/2026-09-15-worktrail-orchestrator-bash-datenschichten.md`
(im Folgenden **Lauf 1**): 305 Bash-Aufrufe dreier Orchestrator-Sessions, 20 Fragemuster, drei
Verb-Vorschläge A/B/C. Diese Notiz wiederholt davon nichts. Sie übernimmt die Messdefinition aus
Lauf 1 §2 (Aufruf, Bytes, Join über `tool_use_id`) und fragt eine Ebene höher.

## 1. Ergebnis

1. **Schichtenkarte.** Von den 14 Rohledgern haben neun eine Aggregation, drei keine
   (`fleet-reports.jsonl`, `cards.jsonl`, `inspektion-register.jsonl`), eines ist selbst ein
   Aggregat (`land-quality.jsonl`), eines ist tot (`dispositions.jsonl`, 2 Zeilen, letzter
   Schreibakt 06.08.). Vier Aggregate hat in 14 Tagen kein Agent gelesen: `/api/audit`,
   `/api/lane-outcomes`, `/api/context-receipts` und das Lane-Dossier `/api/lane?branch=`
   (je 0 Aufrufe in 47.877 Bash-Aufrufen); dazu `slotstats.ts` und `/api/slot-stats` (0),
   `briefstats.ts` (zuletzt 03.09.).
2. **Bash als Symptom.** 1.204 Bash-Aufrufe in neun Sessions: 787 stellen keine Frage an eine
   Fleet-Datenschicht (Code lesen, bauen, schreiben, Git). Von den 417 Datenfragen trafen 134 eine
   Schicht wie vorgesehen, 283 sind Symptome: **95 (a) Schicht existiert, Agent kannte sie nicht ·
   146 (b) Schicht existiert, beantwortet die Frage nicht · 42 (c) keine Schicht.**
   Je Rolle: Orchestrator 50/89/29, Program-MAIN 44/38/13, Lane 1/19/0.
3. **Schnitt.** Drei Auftragszeilen über der Linie (§5): Türen (`ctl get` + Türenblock),
   Auftrags-Dossier (`/api/lane?task=` + `ctl task`), `ctl audits`. Sie decken 184 der 283
   symptomatischen Aufrufe (65 %) und 195.897 von 368.517 Bytes (53 %). Alle drei sind (a)- oder
   (b)-Arbeit; kein Neubau einer Schicht steht über der Linie.
4. **Kennzahl.** Roh-Anteil der Ledger-Lesungen, heute **91,9 %** (§6).

Dass A/B/C aus Lauf 1 §6 bis heute nicht gefilet sind, ist gemessen: im lebenden `fleet.json` nennt
sie genau eine Zeile, `9d610a68`, Status `pending`, Art `notiz`; `CTL_VERBS` in `ctl.sh` ist auf
main unverändert zwölf Verben. Der Notiz-Kanal ist der Kanal, der laut Auftrag 3 von 69 schloss.
Die Kosten liefen weiter: die Auth-Suche aus Lauf 1 §5.2 (falscher Header `x-fleet-token`, dann
Quellensuche, dann Bearer) steht in O1, O2 und M1 wieder, 11 Aufrufe mit falschem Header, einen
Tag nach Lauf 1 und zum ersten Mal auch in der MAIN-Rolle belegt.

## 2. Stichprobe und Messdefinition

Aufruf, Ergebnisbytes und Join wie Lauf 1 §2. Abweichungen: (i) Sidechain-Zeilen zählen nicht,
(ii) jedes Transkript ist am Start der messenden Session eingefroren (`2026-09-17T07:28:47Z`) —
L4 lief nach der Stichprobenziehung weiter und hätte sonst 66 statt 60 Aufrufe, (iii) der
SHA-256 identifiziert das eingefrorene Präfix, nicht die heutige Datei.

**Auswahlregel, mechanisch:** je Rolle die zuletzt beendeten Sessions vor dem Einfrierzeitpunkt,
Transkript ≥ 150 KB. Orchestrator und MAIN je zwei, Lanes fünf. Die jeweils laufende Session
(`2f3a564e`, `bd2a23bc`, `93baba96`) ist ausgeschlossen. Rolle aus dem Gründungsprompt:
„[fleet succession] … Linien-Record f54c5977…" = Orchestrator-Linie, „[fleet Program-MAIN
succession]" = Program-MAIN Fleet-Betrieb, Arbeitsverzeichnis unter `claude-fleet.worktrees/` = Lane.
Alle neun laufen auf `claude-opus-5`.

| Key | Session | Rolle | Fenster UTC | Tool-Aufrufe | Bash | Bash-Ergebnisbytes |
|---|---|---|---|---:|---:|---:|
| O1 | `c21e730a` | Orchestrator | 16.09. 17:56–19:22 | 168 | 165 | 236.844 |
| O2 | `6ba575c0` | Orchestrator | 16.09. 19:20–17.09. 06:23 | 193 | 192 | 241.478 |
| M1 | `2127fa4b` | Program-MAIN | 16.09. 23:07–17.09. 01:41 | 151 | 151 | 238.538 |
| M2 | `f91abc28` | Program-MAIN | 17.09. 01:40–06:21 | 125 | 125 | 255.744 |
| L1 | `7f7b1788` | Lane (Entscheid `stalled`) | 17.09. 01:39–03:07 | 124 | 124 | 242.939 |
| L2 | `32751363` | Lane (E2E-Sonde ②) | 17.09. 03:06–03:58 | 111 | 111 | 196.012 |
| L3 | `85053419` | Lane (autoCloseTried) | 17.09. 03:22–05:30 | 99 | 99 | 172.483 |
| L4 | `796ad3b0` | Lane (capTasks/after) | 17.09. 06:31–07:06 | 60 | 60 | 112.080 |
| L5 | `1e2eb50c` | Lane (Watch lane-ready) | 17.09. 03:03–07:11 | 177 | 177 | 246.216 |
| | | | | **1.209** | **1.204** | **1.942.334** |

Bash ist 1.204 von 1.209 Tool-Aufrufen (99,6 %); MAIN und Lanes benutzen kein anderes Werkzeug.
Auch jede Datei-Lesung läuft damit durch Bash (`sed -n`, `grep`), siehe §4.4.

**Klassifikation in zwei Stufen.** Stufe 1 ordnet jedem Aufruf mechanisch ein Zugriffs-Tag zu
(geordnete Regexe über das Kommando, nachdem Token-Abruf, Heredoc-Körper, POST-Bodies und
Quittungen entfernt sind; §9). Stufe 2 bildet das Tag auf eine Klasse ab; 156 Aufrufe tragen eine
Handkorrektur nach Lesung (`OVR` im Skript, jede einzeln nachprüfbar über das Register §11).
Ich habe O1, O2 und M1 vollständig gelesen, bei M2 und den Lanes jeden Aufruf, dessen Tag eine
Datenfrage sein kann, und die übrigen nur über ihr Tag. Ein Lane-Aufruf, der in `server.ts` nach
Routen greppt, zählt als Codearbeit, nicht als Türensuche.

| Klasse | Definition | Art des Problems |
|---|---|---|
| N | keine Frage an eine Fleet-Datenschicht: Quellcode/Doku lesen, bauen, prüfen, schreiben, Git, Host | — |
| 0 | eine Schicht wie vorgesehen benutzt: `state.sh`, `register.sh`, ein `ctl`-Leseverb, eine Self-Tür, eine schmale Zweckroute | — |
| a | es gibt eine Schicht, der Agent kannte sie nicht: Header-, Token-, Routen- und Feldsuche; Rohlesung, deren Antwort eine Route oder ein Skript wörtlich liefert | Doku |
| b | es gibt eine Schicht, sie beantwortet die Frage nicht: nur als Blob ohne gezielten Leser, Filter oder Join fehlt, oder für diese Rolle nicht erreichbar | Schnitt |
| c | es gibt keine Schicht | Bau |

„Nicht erreichbar für die Rolle" zählt als (b), nicht als (c): eine bestehende Projektion einem
weiteren Prinzipal zu öffnen ist ein Schnitt, kein Bau. Orchestrator und MAIN gelten als
Owner-Routen-fähig, weil beide sie in der Stichprobe benutzen (M1 löst den Deploy mit dem
Owner-Token aus); eine Lane nicht.

## 3. Schichtenkarte (Frage 1)

„Leser" heißt hier: ausgeführter Bash-Aufruf in einem Claude-Transkript unter
`~/.claude/projects/*claude-fleet*`, Fenster 2026-09-03 bis zum Einfrierzeitpunkt, 47.877
Bash-Aufrufe in rund 1.350 Dateien (§9, zweites Skript). „Roh" zählt Lesekommandos auf die Datei;
Inventur-Aufrufe über fünf und mehr Ledger oder `*.jsonl` sind ausgenommen. Browser-Leser
(`src/client.ts` ruft `/api/audit`, `/api/lane-outcomes`, `/api/dispositions`, `/api/lane?`,
`/api/fleet-report`, `/api/events`) sind **ungemessen**: GET-Routen schreiben kein Zugriffslog.

| Rohquelle (Größe, Zeilen) | Aggregator | Letzter belegter Agenten-Leser des Aggregats | Roh gelesen (14 d) | Beantwortet das Aggregat die Frage der Quelle? |
|---|---|---|---:|---|
| `audit.jsonl` (4,4 MB, 33.070) | `/api/audit` (letzte N), `/api/slot-stats` + `slotstats.ts` (Slot-Gesundheit), `state.sh` (merge-Verdikte), Dossier-Ereignisse | Routen und `slotstats.ts`: **keiner**; `state.sh` 17.09. 06:23 | 275 in 98 Sessions | **Nein.** Gefragt wird nach Ereignistyp, Task-ID oder Slot-Fenster (O1.051–052, O2.035, L4.008); die Route kann nur „letzte N". |
| `post-land-audits.jsonl` (2,9 MB, 701) | `/api/post-land-audits` (mit Adjudikation und Artefakt gejoint), `state.sh` (Zähler + jüngste Zeile), `land-quality.ts`, `land-log.ts`, `server.ts#ledgersView`, `server.ts#programExecutionView` | Route 16.09. 18:19 (25 Aufrufe, 15 Sessions) | **804 in 170 Sessions** | **Ja** für „letzte Zeilen, Fails, Adjudikation" — und wird trotzdem 32-mal öfter roh gelesen. **Nein** für „dieser Fail-Name über alle Zeilen" und „Zeile zu dieser mainSha". |
| `lane-outcomes.jsonl` (1,4 MB, 1.080) | `state.sh` (Zähler, Land-Gesundheit), `land-quality.ts`, `briefstats.ts`, `land-collision-stats.ts`, `lane-context-cost.ts`, `/api/lane-outcomes`, **Dossier `/api/lane`** (`server.ts#laneDossier`, sechs Quellen je Branch) | `land-quality.ts` 17.09. 06:16 (28); Route und Dossier: **keiner** | 294 in 96 Sessions | **Teilweise.** Das Dossier beantwortet „die Geschichte einer Lane", ist aber nach Branch adressiert, gesucht wird nach Task-ID; niemand ruft es. |
| `context-receipts.jsonl` (1,5 MB, 879) | `briefstats.ts`, `lane-context-cost.ts`, `/api/context-receipts` (alle Zeilen, ungefiltert), MAIN-/Supervisor-Sicht | `lane-context-cost.ts` 15.09.; `briefstats.ts` 03.09.; Route: **keiner** | 21 in 11 Sessions | **Ja** für Brief-Statistik, aber ohne laufenden Leser; die Route ist ein Volldump. |
| `tasks-archive.jsonl` (756 KB, 141) | `register.sh --archived <muster>`, `server.ts#youngestArchivedTask` | `register.sh` 17.09. 06:35 (Flag-Nutzung nicht getrennt gezählt) | 4 | **Ja** für „finde eine verschwundene Zeile". |
| `fleet-reports.jsonl` (527 KB, 338) | **keiner** — im getrackten Code nur zwei Schreibstellen (`FLEET_REPORT_LEDGER_FILE`) | — | 4 | **Keine Aggregation.** Lebende Reports kommen aus dem Serverzustand (`ctl report`, `/api/fleet-report`, Inbox); die Historie liest niemand. |
| `land-quality.jsonl` (285 KB, 628) | ist selbst das Aggregat (`land-quality.ts --out`); Leser `lane-context-cost.ts --quality` | `land-quality.ts` 17.09. 06:16 | 3 | **Ja**, für Qualität je Land; Berührung mit der Schwesterzeile, §7. |
| `cards.jsonl` (263 KB, 355) | **keiner** — eine Schreibstelle (`CARD_FILE`) | — | 25 in 10 Sessions | **Keine Aggregation.** Gefragt wird „warum fiel die Karte dieser Zeile" (Lauf 1 S3.092–099). |
| `steward-journal.jsonl` (95 KB, 184) | `/api/steward/journal`, `/api/steward/digest` | 03.09. (je 1 Aufruf); letzter Schreibakt 13.09. | 2 | Ja, aber der Leser (Steward-Puls) ruht. |
| `helper-artifacts.jsonl` (75 KB, 339) | auf die Audit-Zeile gejoint; `/api/post-land-audits/artifact?at=` liefert das `suite.log` | 17.09. 02:28 (53 Aufrufe, 47 davon Lanes) | 15 | **Ja.** Gegenbeispiel M1.112–118, §4.3. |
| `audit-adjudications.jsonl` (67 KB, 190) | in `/api/post-land-audits` gejoint; `land-quality.ts`; `server.ts#carryFlakeAdjudications` | über die Route, s. o. | 40 in 24 Sessions | Ja. |
| `deploys.jsonl` (63 KB, 226) | `/api/deploys`, `deployGap` in `/api/sessions`, Supervisor-Sicht | 17.09. 05:21 (106 Aufrufe, 44 Sessions) | 86 in 52 Sessions | **Ja** — das einzige Ledger, dessen Route öfter gelesen wird als die Datei. |
| `inspektion-register.jsonl` (9,6 KB, 26) | keiner im Code; nur `.claude/commands/inspektion.md` | — ; letzter Schreibakt 30.07. | 1 | Tot. |
| `dispositions.jsonl` (212 B, 2) | `/api/dispositions` | keiner; letzter Schreibakt 06.08. | 3 | Tot. |
| `streams/prompts.jsonl` (24 MB) | `lane-context-cost.ts`, `continuity.ts`, Dossier-Prompts | `lane-context-cost.ts` 15.09. | 52 (zählt auch die `prompts.jsonl` von E2E-Instanzen) | Ja für Kontextkosten. |

Die Skript-Schicht selbst: `state.sh` 430 Läufe in 159 Sessions, `register.sh` 362 in 153,
`ctl.sh` 786 in 43, `repo-map.ts` 46, `land-quality.ts` 28, `start-plan.ts` 20,
`lane-context-cost.ts` 17, `land-collision-stats.ts` 7 (plus indirekt über `state.sh`),
`land-log.ts` 7, `briefstats.ts` 4, `trailstats.ts` 3, `task-notes.ts` 2, `capability-map.ts` 1,
`slotstats.ts` 0. Lebende Routen: `/api/sessions` 984, `/api/self/program-execution` 394,
`/api/tasks` 250, `/api/start-plan` 53, `/api/helper/jobs` 37.

**Lesart.** Die zwei Erdungen und `ctl.sh` sind die einzigen Aggregate, die jede Rolle kennt, weil
der Gründungsprompt sie nennt. Alles, was nur in `docs/self-api.md` oder im Quelltext steht, wird
nicht gefunden: die Ledger-Routen existieren seit Wochen, und die Agenten öffnen die Datei.

## 4. Bash als Symptom über drei Rollen (Frage 2)

### 4.1 Klassenverteilung je Rolle

Aufrufe : Ergebnisbytes. „Trefferquote" = Klasse 0 / (0 + a + b + c).

| Rolle (Sessions) | alle | N | 0 | a | b | c | Trefferquote Aufrufe / Bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestrator (2) | 357 : 478.322 | 154 : 175.780 | 35 : 91.313 | **50** : 34.489 | **89** : 111.387 | **29** : 65.353 | 17,2 % / 30,2 % |
| Program-MAIN (2) | 276 : 494.282 | 111 : 180.449 | 70 : 174.010 | **44** : 41.230 | **38** : 40.176 | **13** : 58.417 | 42,4 % / 55,4 % |
| Lane (5) | 571 : 969.730 | 522 : 921.900 | 29 : 30.365 | **1** : 264 | **19** : 17.201 | **0** : 0 | 59,2 % / 63,5 % |
| Summe | 1.204 : 1.942.334 | 787 : 1.278.129 | 134 : 295.688 | 95 : 75.983 | 146 : 168.764 | 42 : 123.770 | 32,1 % / 44,5 % |

- **Orchestrator:** 57 % aller Aufrufe sind Datenfragen, und nur jede sechste trifft eine Schicht.
  Der Schwerpunkt ist (b): die Schicht ist da (`/api/sessions`, `/api/tasks`, der Serverzustand),
  aber als Blob, aus dem jede Frage von Hand herausgeschnitten wird.
- **Program-MAIN:** die eigene Tür `/api/self/program-execution` trägt (394 Aufrufe in 14 Tagen,
  Klasse 0). Das Symptom sitzt daneben: Audit-Zeilen und Audit-Schlange (32 Aufrufe), die
  Türensuche (20) und der ssh-Umweg (8).
- **Lane:** 91 % sind Codearbeit. Die Self-Türen (`gate`, `drift`, `suite-offer`, `notes`) tragen;
  was bleibt, ist fast nur (b): eine Lane, die den Verlauf einer Task oder eines Branches braucht,
  greppt die Rohledger im Haupt-Checkout (L3.008–016, L4.008–011), weil das Dossier eine
  Owner-Tür ist.

241 der 283 Symptome (85 %) sind (a) oder (b). Nach Bytes 244.747 von 368.517 (66 %); die (c)-Bytes
sind zu 83 % Pane-Lesungen (§4.2).

### 4.2 Familien: wo die Symptome sitzen

| Familie | Klasse | Orchestrator | MAIN | Lane | Summe |
|---|---|---:|---:|---:|---:|
| DISCOVER · Header, Token, Route, Feldform suchen | a | 40 : 28.258 | 20 : 15.350 | 1 : 264 | **61 : 43.872** |
| TASK · Zeile, Karte, Startplan-Grund, Program nach ID | b | 29 : 57.362 | 6 : 15.252 | 4 : 4.658 | 39 : 77.272 |
| REPORT · Report und Entscheid zu einer Task | b | 24 : 17.017 | — | 2 : 2.814 | 26 : 19.831 |
| LEDGER · Outcome/Audit-Trail nach ID, Ereignis, Harness | a/b | 5 : 5.843 | 2 : 1.263 | 3 : 7.258 | 10 : 14.364 |
| AUDIT · Audit-Zeilen, Fails, Schlange, Trail | a/b | 21 : 17.068 | 32 : 29.760 | 2 : 836 | **55 : 47.664** |
| PANE · `capture-pane` | c | 17 : 48.993 | 12 : 53.963 | — | 29 : 102.956 |
| HELPER · Helfer-Job, `suite.log` per ssh | a/b | 4 : 4.067 | 14 : 15.517 | 4 : 22 | 22 : 19.606 |
| BOARD · Slots, Alter, Lane je Slot | b | 9 : 8.753 | — | 4 : 1.613 | 13 : 10.366 |
| DEPLOY · Vorbedingung, Verdikt, Gap | a/b/c | 5 : 5.489 | 5 : 2.603 | — | 10 : 8.092 |
| QUOTA · Abo-Verbrauch in `~/.claude`, `~/.codex` | c | 9 : 8.996 | — | — | 9 : 8.996 |
| STATE_OTHER · messages, watches, autos fremder Slots | b/c | 5 : 9.383 | 4 : 6.115 | — | 9 : 15.498 |

Quer dazu, nicht additiv: **79 Aufrufe (Orchestrator 62, MAIN 17) bauen den Owner-Token von Hand**
(`python3 -c … fleet.json['token']`, `sed … fleet.json`, `grep FLEET_TOKEN .env`), obwohl
`ctl.sh#owner_token` genau das tut — aber nur für zwölf feste Verben erreichbar ist.

### 4.3 Vier Belege, je einer pro Mechanismus

- **(a) am reinsten — M1.112–118.** Die MAIN adjudiziert das Audit `1789607632110` und holt dessen
  `suite.log` in sieben Aufrufen per ssh vom Second-host. `helper-artifacts.jsonl` trägt für genau
  diese Zeile einen Upload (763.810 B, 238 ms nach der Audit-Zeile), den
  `/api/post-land-audits/artifact?at=1789607632110` ausliefert. Lanes kennen diese Route (47
  Aufrufe in 14 Tagen), die MAIN kannte sie nicht.
- **(a) mit Wiederholung — O1.007–023, O2.008–015, M1.049–055.** Header `x-fleet-token` → leere oder
  401-Antwort → `grep` nach `tokenFrom`/`ownerH` in `ctl.sh` und `server.ts` → Bearer → Feldform
  raten (`sessions` statt `slots`). 15, 6 und 6 Aufrufe. Lauf 1 hat dieselbe Kette in S1, S2 und
  S3 gezählt (7 Aufrufe Auth, 6 Feldform); sie gehört damit zu fünf von fünf gemessenen
  Orchestrator-Sessions.
- **(b) — O2.147–150.** `bun land-quality.ts` läuft, beantwortet „welche Harness/Modell-Paare haben
  je gelandet" nicht, drei Rohlesungen auf `lane-outcomes.jsonl` folgen. Die Schicht ist da und
  bekannt; ihr Schnitt passt nicht.
- **(b) durch Länge — die Erdung.** Alle vier Haupt-Checkout-Sessions fahren `state.sh` und
  `register.sh` je **zweimal** (`tail -80`, dann `head -60`), weil der Gründungsprompt den Lauf
  verlangt und die Ausgabe nicht in ein Ergebnis passt: 15 Aufrufe, 128.152 B, das sind 43 % aller
  Klasse-0-Bytes. Klasse 0, weil die Schicht benutzt wird; genannt, weil es derselbe Befund ist wie
  Lauf 1 §5.1 D und seitdem unverändert.

### 4.4 Was nicht Symptom ist

787 Aufrufe (N). Lanes: 273 Quelltext-Lesungen mit 720.456 B (74 % aller Lane-Bytes), 128 Akte, 65
Bau-/Suite-Aufrufe, 21 Git. MAIN: 32 Git-Aufrufe mit 103.139 B — das ist Review der Lane-Diffs
vor dem Land und die Arbeit dieser Rolle. Orchestrator: 68 Akte, 49 Quelltext-Lesungen. Dass
Quelltext über `sed -n` statt über ein Lesewerkzeug läuft, ist eine Harness-Frage und hier nur
gezählt, nicht bewertet.

## 5. Der Schnitt (Frage 3)

Die Vorgabe verlangt eine Analyse mit Fokus auf Bash-Benutzung und aggregierte Schichten. Sie ist
erfüllt, wenn jede (a)/(b)-Familie mit mindestens 40 Aufrufen eine Auftragszeile hat; das sind
drei. Darunter wird abgeschnitten. Kostenbereich = beobachtete Aufrufe und Bytes aus §4.2 in neun
Sessions — die Obergrenze einer Ersparnis, keine Zusage. Für ein Szenario gilt die Rechenregel aus
Lauf 1 §5.1 unverändert.

| Rang | Posten | Klasse | Kostenbereich (9 Sessions) | Verhältnis zu Lauf 1 §6 |
|---|---|---|---:|---|
| **P1** | Türen: `ctl get` + Türenblock in `state.sh` | a | 61 Aufrufe / 43.872 B; dazu 79 Aufrufe mit handgebautem Token-Abruf | **ersetzt A** |
| **P2** | Auftrags-Dossier: `/api/lane?task=` + `ctl task` | b | 68 Aufrufe / 104.361 B (TASK 39, REPORT 26, Lane-LEDGER 3) | **übernimmt B**, Fläche geändert |
| **P3** | `ctl audits` | a/b | 55 Aufrufe / 47.664 B; flottenweit 804 Rohlesungen in 14 d | neu; nimmt den Audit-Teil von **C** |
| — | *Linie: 184 von 283 Aufrufen (65 %), 195.897 von 368.517 B (53 %)* | | | |
| u1 | Pane-Blick (`capture-pane`) | c | 29 / 102.956 B | Lauf 1 E: weiter 0 zugesagt |
| u2 | Deploy-Status | a/b/c | 10 / 8.092 B | **C zurückgestellt** |
| u3 | Quota-Sensor | c | 9 / 8.996 B | gehört `docs/messungen/2026-09-17-sub-routing-regelbarkeit.md` |

**Warum A ersetzt wird.** A wollte eine Sessions-Projektion (`ctl sessions`). Die Messung über drei
Rollen zeigt: der Schaden ist nicht das Board (BOARD 13 Aufrufe / 10.366 B), sondern dass der
Credential-Resolver hinter festen Verben liegt und jede weitere Route wieder Header- und
Feldsuche auslöst (DISCOVER 61 / 43.872 B, in O und M). Ein credentialierter GET-Durchgriff plus
ein Türenblock in der einen Ausgabe, die jede Session als Erstes liest (`state.sh`, 430 Läufe),
behebt die Auth-Hälfte von A für alle Routen auf einmal und macht die vier ungelesenen
Ledger-Routen, das Dossier und die Artefakt-Route sichtbar. Das ist (a)-Arbeit und damit die
billigste der drei.

**Warum B mit geänderter Fläche.** B wollte den Join in `ctl.sh` bauen und erklärte `server.ts`
für nicht betroffen. Der Join existiert aber schon: `server.ts#laneDossier` verbindet Task,
Prompts, Ereignisse, Commits, Outcomes, Land-Notizen und Audits — nur nach Branch adressiert und
mit null Agenten-Lesern in 14 Tagen. Ein zweiter Join in Bash wäre die Dopplung, vor der Lauf 1
selbst warnt. Also: das Dossier nimmt eine Task-ID, `ctl task` rendert es.

**Warum C zurückgestellt wird.** In dieser Stichprobe kostet DEPLOY 10 Aufrufe / 8.092 B (Lauf 1:
21 / 71.263 B, davon laut Lauf 1 selbst viel Nebenarbeit). Der teure Teil von C war der
Audit-Zustand als Deploy-Blocker; den trägt P3 (erste Ausgabezeile: läuft, wartet, Leerlauf). Der
Rest von C bleibt eine valide Karte in Lauf 1 §6 und kann von dort gefilet werden, wenn Lauf 2
ihn wieder über 20 Aufrufe sieht.

**Warum der Pane-Blick unter der Linie steht.** Er ist die einzige (c)-Familie mit Volumen und nach
Bytes die größte Einzelfamilie überhaupt. Aber was ein Agent aus der Pane braucht — letzter Satz,
offener Dialog, Fortschritt — ist hier nicht gemessen, und ohne das ist jede Karte geraten. Das ist
ein Messauftrag, kein Bauauftrag, und die Vorgabe ist ohne ihn erfüllt.

Die drei Zeilen sind mit `card-extract.ts#parseFormattedCard` und `card-extract.ts#validateCard`
gegen diesen Baum geprüft (leerer Symbolindex, Deklarations-Fallback für die zwei
`server.ts`-Symbole): je `valid: true`, `surfaceValid: true`, `gaps: []`. Das bescheinigt Form und
Fläche, nicht Machbarkeit. Rolle nach Owner-Regel vom 02.09.: Lanes auf `claude-opus-5[1m]/high`.

### P1 — Türen

```card
[FLEET-BETRIEB · MITTEL · TUEREN: ctl get UND EIN TUERENBLOCK IN state.sh — Auth-, Schema- und Routensuche kostet in drei Rollen 61 Aufrufe / 43.872 B · docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §5 P1 · ersetzt Vorschlag A der Notiz 2026-09-15]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: ctl.sh, state.sh, e2e/ctl.ts, docs/controller.md
VERIFY: pins, tsc, build, clean-review, security, claude-gate; isolierte Vorschau, weil e2e/ctl.ts beruehrt ist
DONE: ./ctl.sh get <pfad> beantwortet einen GET unter /api/ mit dem vorhandenen Credential-Resolver (Owner-Token, fuer /api/self das Self-Token), verweigert benannt jede andere Methode und jeden Pfad ausserhalb von /api/, gibt nie ein Token aus, und --keys druckt statt des Koerpers die Schluessel der obersten zwei Ebenen; state.sh druckt einen Block "Tueren" mit hoechstens zwoelf Zeilen, der ctl get, die Leserouten der Ledger, das Lane-Dossier und die Artefakt-Route nennt; e2e/ctl.ts prueft Erfolg, 401, die beiden Verweigerungen und dass keine Ausgabe das Token enthaelt.
WARUM: In neun Sessions dreier Rollen suchten 61 Bash-Aufrufe nach Header, Token-Quelle, Route oder Feldform einer Tuer, die es gibt; 79 Aufrufe bauten den Token-Abruf von Hand. Der Resolver existiert in ctl.sh, aber nur hinter zwoelf festen Verben. Die Ledger-Routen liest fast niemand: 1.480 Rohlesungen gegen 131 Routenlesungen in 14 Tagen.
NICHT: kein POST-Durchgriff, keine neue Route, keine Aenderung an Berechtigungen, kein Token in einer Ausgabe oder Fehlermeldung.
```

### P2 — Auftrags-Dossier

```card
[FLEET-BETRIEB · MITTEL · AUFTRAGS-DOSSIER: /api/lane NIMMT EINE TASK-ID, ctl task RENDERT ES — 68 Aufrufe / 104.361 B Handsuche nach einer Zeile und ihren Belegen · docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §5 P2 · uebernimmt Vorschlag B der Notiz 2026-09-15 mit geaenderter Flaeche]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: server.ts#laneDossier, server.ts#dossierTaskFor, ctl.sh, e2e/outcomes.ts, e2e/ctl.ts, docs/controller.md
VERIFY: pins, tsc, build, clean-review, security, claude-gate; isolierte Vorschau, weil e2e/ beruehrt ist
DONE: GET /api/lane?task=<id> loest die Task-ID ueber die lebende Zeile, die taskId der Outcome-Zeile und tasks-archive.jsonl auf ihren Branch auf und liefert dasselbe Dossier wie ?branch=, mit je einem benannten Ergebnis fuer eine unbekannte ID und fuer eine Zeile ohne Lane; ./ctl.sh task <id> rendert daraus Status, Kartengueltigkeit, den Startplan-Grund einer wartenden Zeile, den Kopf des juengsten Reports, Outcome und Audit in je einer Zeile mit benannter Quelle, den Volltext nur mit --full; isolierte Checks decken lebende Zeile, archivierte Zeile, recycelte Slotnummer und unbekannte ID.
WARUM: Das Dossier verbindet sechs Quellen je Branch und hatte in 14 Tagen keinen einzigen Agenten-Aufruf, waehrend Orchestrator, MAIN und Lanes dieselbe Verbindung 68-mal von Hand ueber fleet.json, /api/sessions und die Rohledger suchten. Gesucht wird nach der Task-ID, das Dossier kennt nur den Branch.
NICHT: kein zweiter Join in der Shell, kein neues Register, keine Bewertung eines Reports, kein Zugriff fuer Self-Tokens ueber das heutige Mass hinaus.
```

### P3 — ctl audits

```card
[FLEET-BETRIEB · KLEIN · ctl audits: AUDIT-ZEILEN, FAILS UND SCHLANGE OHNE ROHDATEI — 55 Aufrufe / 47.664 B in neun Sessions, 804 Rohlesungen in 14 Tagen · docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §5 P3]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: klein
FLAECHE: ctl.sh, e2e/ctl.ts, docs/controller.md
VERIFY: pins, tsc, build, clean-review, security, claude-gate; isolierte Vorschau, weil e2e/ctl.ts beruehrt ist
DONE: ./ctl.sh audits [--last N] [--fail <text>] [--sha <sha>] liest GET /api/post-land-audits und druckt je Zeile Zeit, result, mainSha, covers, checks, fails und Adjudikation; --fail zaehlt ueber alle gelieferten Zeilen und nennt den Nenner; die erste Ausgabezeile nennt aus GET /api/sessions, ob ein Audit laeuft oder wartet, wobei null Leerlauf heisst; eine unbekannte sha und ein leeres Ledger sind benannte Ergebnisse; e2e/ctl.ts prueft diese vier Faelle gegen ein Fixture-Ledger.
WARUM: post-land-audits.jsonl ist das meistgelesene Rohledger des Fleets (804 Rohlesungen in 170 Sessions gegen 25 Aufrufe seiner Route). Die MAIN liest nach jedem Audit-Ereignis die letzte Zeile und 15-mal die Schlangendatei; die Orchestratorin zaehlt einen Fail-Namen ueber alle Zeilen. Die Route liefert das alles bereits samt Adjudikation.
NICHT: keine Aenderung an der Route, kein Schreibakt, keine Adjudikation aus dem Verb heraus.
```

Reihenfolge: P1 zuerst, weil P3 auf demselben Resolver-Pfad liegt und P1 die Verbliste-Pins
(`e2e/pins.ts`, `CTL_VERBS` gegen `docs/controller.md` §Werkzeuge) einmal bewegt. P1 und P3
berühren beide `ctl.sh`, `e2e/ctl.ts` und `docs/controller.md` — nacheinander landen, nicht
parallel. P2 ist davon bis auf `ctl.sh` unabhängig.

## 6. Stehende Kennzahl (Frage 4)

**Roh-Anteil der Ledger-Lesungen** = Roh-Lesungen / (Roh-Lesungen + Routen-Lesungen), über die fünf
Ledger mit eigener GET-Route, in allen Claude-Transkripten unter `~/.claude/projects/*claude-fleet*`,
Fenster 14 Tage. Roh-Lesung = Bash-Aufruf, der die Datei mit `open(`, `tail`, `head`, `cat`, `grep`,
`wc` oder `jq` anfasst, Inventur-Aufrufe (≥ 5 Ledger oder `*.jsonl`) ausgenommen. Routen-Lesung =
Bash-Aufruf mit `curl` auf genau diese Route. Mechanisch, ohne Urteil, mit dem zweiten Skript in §9
wiederholbar.

| Ledger | roh | Route | Roh-Anteil |
|---|---:|---:|---:|
| `post-land-audits.jsonl` · `/api/post-land-audits` | 804 | 25 | 97,0 % |
| `lane-outcomes.jsonl` · `/api/lane-outcomes` | 294 | 0 | 100 % |
| `audit.jsonl` · `/api/audit` | 275 | 0 | 100 % |
| `deploys.jsonl` · `/api/deploys` | 86 | 106 | 44,8 % |
| `context-receipts.jsonl` · `/api/context-receipts` | 21 | 0 | 100 % |
| **Summe, Fenster 03.09.–17.09. 07:28Z** | **1.480** | **131** | **91,9 %** |

Warum diese und nicht die Trefferquote aus §4.1: die Trefferquote (heute 17,2 % / 42,4 % / 59,2 %)
hängt an 156 Handkorrekturen und ist zwischen zwei Messenden nicht stabil. Der Roh-Anteil zählt
nur Zeichenketten. Er fällt, wenn P1 und P3 wirken, und er fällt nicht, wenn sie nur landen.
`deploys.jsonl` ist der Beleg, dass er fallen kann: die Route steht im Deploy-Ablauf, den jede
Session kennt, und wird öfter gelesen als die Datei. Lauf 2 misst zusätzlich die Klassenverteilung
mit demselben Skript und derselben Auswahlregel; vergleichbar ist sie nur der Größenordnung nach.

## 7. Berührung mit der Schwesterzeile 6067c240

`6067c240` (Worktrail-Analyse Lauf 1, periodisch: Qualität je Lane gejoint mit Modell, Harness,
Größe) steht bei dieser Messung nicht mehr im lebenden `fleet.json`; `tasks-archive.jsonl` führt sie
mit Ereignis `terminal`, Status `archived`. Ob ein Ersatz lebt, habe ich nicht geprüft. Die beiden
Analysen berühren sich an drei Stellen, und an keiner habe ich ihre Arbeit gemacht:

- **`land-quality.jsonl` / `land-quality.ts`** ist ihr Instrument. Hier erscheint es nur als Zeile
  der Schichtenkarte und als (b)-Beleg O2.147–150. Die fehlende Harness/Modell-Sicht ist ihr Befund.
- **`lane-outcomes.jsonl#toolResultBytes`** existiert je Lane. Meine Bytes je Rolle (§4.1) sind
  dieselbe Größe aus dem Transkript; der Join Bytes × Qualität × Modell gehört ihr.
- **Dieselben acht Ledger.** Ihr Auftragstext nennt sie als Rohquellen. Landet P1, liest ihr
  nächster Lauf sie über Türen — das senkt §6, ohne dass sie etwas dafür tut.

## 8. Was nicht gemessen wurde

- **Codex- und Pi-Sessions.** Astra, Sol/Terra und GLM-Lanes schreiben nach `~/.codex` bzw. in den
  Pi-Zustand, nicht in die hier gelesenen Transkripte. Slot 11 wurde weder gelesen noch angesprochen.
- **Browser-Leser.** Ob der Owner das Dossier oder `/api/audit` im Dashboard öffnet, steht in keinem
  Log. „Null Agenten-Leser" heißt nicht „null Leser".
- **Ersparnis.** Kein Verb ist gebaut, kein Replay gefahren. §5 nennt Kostenbereiche.
- **Pane-Inhalt.** Was aus den 29 Pane-Lesungen verwendet wurde, ist nicht kodiert.
- **Absicht hinter (a).** „Kannte sie nicht" ist aus dem Verhalten geschlossen: die Tür wird in der
  Session nie benutzt, oder erst nach einer Suche. DISCOVER enthält auch erfolgreiche Nachschläge in
  `docs/self-api.md` (M2.043, M2.116); sie kosten Aufrufe, sind aber kein Doku-Versagen.
- **N im Detail.** Bei M2 und den Lanes sind die N-Aufrufe nur über ihr Tag klassifiziert, nicht
  einzeln gelesen. Ein falsch als N getaggter Datenaufruf senkt die Symptomzahl, nicht umgekehrt.
- **Rollenabgrenzung der 14-Tage-Zählung.** „orch" umfasst jede `[fleet succession]`-Linie des
  Haupt-Checkouts, also auch die frühere Controller-Linie.
- **`prompts.jsonl`.** Die 52 Rohlesungen treffen zum Teil die gleichnamige Datei einer E2E-Instanz.
- Modellkosten, interne Schleifenrunden eines Aufrufs und HTTP-Bytes: wie Lauf 1 §2, unbekannt.
- Nicht geöffnet: `.env`, Token-Werte, fremde Prozess-Kommandozeilen. `fleet.json` wurde nur für
  Task-Texte und -Status gelesen. In allen ausgegebenen Kommandos sind Hex-Ketten ≥ 32 Zeichen,
  `TOKEN=`- und `Bearer`-Werte vor der Anzeige ersetzt.

## 9. Methode

Beide Skripte lesen ausschließlich Transkripte, schreiben nach stdout und führen kein
Transkript-Kommando aus. Aufruf: `python3 measure.py --register` und `python3 readers.py`.
Die Assertions im ersten Skript prüfen eindeutige `tool_use`-IDs, genau ein Ergebnis je Bash-Aufruf
und den Korpus von 1.204 Aufrufen; ein nach dem Einfrierzeitpunkt gewachsenes Transkript ändert
nichts, ein gekürztes lässt sie scheitern.

Schichtenkarte: Schreib- und Lesestellen je Ledger mit `rg -a` über `server.ts` (die Datei enthält
ein NUL-Byte, ohne `-a` bricht `rg` still ab) und `rg` über die getrackten Skripte; Routen zu
Funktionen über die nächste `url.pathname`-Zeile oberhalb der Aufrufstelle. Größen und Zeilenzahlen
mit `ls -la` und `wc -l` im Haupt-Checkout, 2026-09-17 09:28–09:30 Ortszeit.

### 9.1 `measure.py` — Stichprobe, Tags, Klassen, Familien

```python
import collections as C, glob, hashlib, json, os, re, sys
ROOT = os.path.expanduser('~/.claude/projects')
CUTOFF = '2026-09-17T07:28:47.000Z'   # Start der messenden Session; spaetere Zeilen zaehlen nicht
SAMPLE = [('O1', 'c21e730a'), ('O2', '6ba575c0'), ('M1', '2127fa4b'), ('M2', 'f91abc28'),
          ('L1', '7f7b1788'), ('L2', '32751363'), ('L3', '85053419'), ('L4', '796ad3b0'), ('L5', '1e2eb50c')]
RD = 'tail|head|cat|grep|wc|jq|ls|stat'
LEDGERS = r"(post-land-audits|lane-outcomes|audit|deploys|context-receipts|fleet-reports|cards|tasks-archive|land-quality|audit-adjudications|helper-artifacts|steward-journal|inspektion-register|dispositions|prompts)\.jsonl"
TOKFETCH = [r"TOK=\$\(python3 -c \"import json;\s*print\(json\.load\(open\('fleet\.json'\)\)\['token'\]\)\"\)",
            r"TOK=\$\(sed -n 's/\^  \"token\".{0,40}?fleet\.json \| head -1\)",
            r"TOK=\$\(grep -E '\^FLEET_TOKEN=' \.env[^)]*\)"]
# Zugriffs-Tag: erste passende Regel gewinnt (Reihenfolge = Vorrang)
RULES = [
 ('QUEUEFILE', r"post-land-audit-queue\.json"),
 ('NARROW_API', r"curl(?![^|;]*-X POST)[^|;]*/api/(deploys|slots/\d+/merge|programs/\w+/release-valid|post-land-audits|lane\b|flakes|slot-stats)"),
 ('IFACE', r"(grep|rg|awk)\b[^|;]*(api/|api\\/|pathname|self/|VERB 2)"),
 ('KEYPROBE', r"print\((list|sorted)\(\w+(\[[^\]]+\])*\.keys\(\)\)|print\(\[k for k in \w+(\[[^\]]+\])*\.keys\(\)\]\)"),
 ('LEDGER_RAW', r"(open\(['\"][^'\"]*|(?:" + RD + r")\b[^|;&]*?[ /])" + LEDGERS + r"|glob\.glob\('e2e-trail|e2e-trail/\*"),
 ('FLEETJSON_RAW', r"open\(['\"](/Users/owner/claude-fleet/)?fleet\.json['\"]\)|grep[^|;]* fleet\.json|F = \"/Users/owner/claude-fleet/fleet\.json\""),
 ('API_RAW', r"curl(?![^|;]*-X POST)[^|;]*/api/(?!self)[a-z]"),
 ('API_FOLLOW', r"(scratchpad|/tmp)/(sess|plan|pe|progexec|s2|inbox\d*)\.json|open\('(pe|progexec)\.json'\)"),
 ('PANE', r"capture-pane"),
 ('TRANSCRIPT', r"\.claude/projects|\.codex/sessions|claude --help"),
 ('AUTHSEARCH', r"grep[^|;]*(FLEET_TOKEN|x-fleet|tokenFrom|ownerH|Authorization|CTL_TOKEN)"),
 ('SCRIPT', r"\./(state|register)\.sh|bun (land-quality|trailstats|briefstats|slotstats|lane-context-cost|land-collision-stats|land-log|task-notes|capability-map|repo-map|start-plan)\.ts"),
 ('CTL_READ', r"ctl\.sh( (merges|lock(?! --reap)|ctx|report|events(?! --ack))\b| 2>&1| *$)"),
 ('SELF_GET', r"curl(?![^|;]*-X POST)[^|;]*/api/self"),
 ('ACT', r"-X POST|--data-binary|git (commit|add|worktree remove|push|rebase|cherry-pick|checkout|stash|reset)|cat > |<<'?\"?[A-Z]+'?\"?|sed -i|\bmv |\bcp |\brm |write\(|json\.dump\(|ctl\.sh (land|dispatch|send|commit|watch|wait|lock --reap|events --ack)|mkdir|chmod|kill "),
 ('BUILD', r"bun e2e/pins|bunx tsc|bun run build|e2e-[a-z-]+\.sh|bun test|bun fleet-e2e|bun install|bun review-sweep|bun [^ ]*scratchpad|bun -e|bun run |timeout \d+ bun|nohup|iso\.log|suite\.log|server\.log"),
 ('HOST', r"vm_stat|sysctl|\bps -|pgrep|lsof|memory_pressure|df -h|top -l|\bssh |uptime|du -s|tmux -L \w+ (list|kill|ls)"),
 ('GIT', r"(^|[;&|(] ?|\s)git( -C \S+)? (log|diff|show|status|merge-base|rev-|notes|branch|worktree list|blame|ls-files|cat-file|fetch|merge-tree|grep)"),
 ('SRC', r"sed -n|grep|\brg\b|\bcat\b|\bhead\b|\bwc\b|\bls\b|ast-grep|graphify|\bfind\b|awk"),
]
# Klasse je Tag: 0 = Schicht wie vorgesehen benutzt; a/b/c = Symptom; N = keine Frage an eine Fleet-Datenschicht
DEFAULT = {'SCRIPT': '0', 'CTL_READ': '0', 'SELF_GET': '0', 'NARROW_API': '0',
           'AUTHSEARCH': 'a', 'IFACE': 'a', 'KEYPROBE': 'a', 'LEDGER_RAW': 'a',
           'FLEETJSON_RAW': 'b', 'API_RAW': 'b', 'API_FOLLOW': 'b', 'QUEUEFILE': 'b',
           'PANE': 'c', 'TRANSCRIPT': 'c',
           'HOST': 'N', 'GIT': 'N', 'SRC': 'N', 'ACT': 'N', 'BUILD': 'N', 'OTHER': 'N'}
# Handkorrekturen nach Lesung jedes Daten-Kandidaten
OVR = {
 'O1': {'a': '7-10,15-17,20-21,23,38,86,154,156', 'b': '22,47,51-52,118-119', 'c': '26-28', 'N': '93,101,113,135,146'},
 'O2': {'a': '8-10,15,27,161', 'b': '28,32-35,54-55,57,68-69,74,124,148-150', 'c': '62-64,133,169', '0': '5,162',
        'N': '40,41,43,52,59,143-144,164,185,188-189'},
 'M1': {'a': '8,24-25,28,33-34,40,49-50,104-107,112-118,129', 'b': '19,21-22,35,83,100', 'c': '48',
        '0': '7,9-11,13-14,18,59,77,87', 'N': '79-81,122'},
 'M2': {'a': '7-8,13,40', 'c': '21', '0': '5,9-11,28,101,114', 'N': '30,70,74,112'},
 'L1': {'b': '28-30', 'N': '55'}, 'L2': {'N': '41,101', 'b': '51,53-54,56'},
 'L3': {'b': '8-9,16,87', 'N': '89-90'}, 'L4': {'b': '8,10-11', 'N': '39'},
 'L5': {'a': '42', 'N': '36,46,50,57,62,67,103,141,171', 'b': '138'},
}
FAM = [('HELPER', r"laneSuiteJobs|\bssh\b|helper"), ('AUDIT', r"post-land-audit|postLandAuditLive|e2e-trail|trailstats"),
       ('DEPLOY', r"deploys|deployGap|bundleStale|deployBlocker|deployVerb|api/deploy"),
       ('REPORT', r"fleetReports|fleet-report|ctl\.sh report|await-report|await-decision"),
       ('QUOTA', r"\.claude|\.codex|pi-zai|claude --help"),
       ('TASK', r"\['tasks'\]|\[\"tasks\"\]|api/tasks|start-plan|plan\.json|release-valid|\['programs'\]|programs|tasks-archive|d\.get\('tasks'"),
       ('BOARD', r"api/sessions|sess\.json|s2\.json|\['slots'\]|slots"),
       ('LEDGER', r"lane-outcomes|audit\.jsonl|context-receipts|land-quality"), ('CONFIG', r"\.env")]

def rng(spec):
    out = []
    for w in filter(None, spec.replace(' ', '').split(',')):
        p = list(map(int, w.split('-'))); out.extend(range(p[0], p[-1] + 1))
    return out

def size(c):
    return len(c.encode()) if isinstance(c, str) else len(json.dumps(c, ensure_ascii=False, separators=(',', ':')).encode())

def debody(cmd):
    # Text-Koerper tragen keine Zugriffe: cat-Heredocs, Commit-Bodies, Python-Dreifachstrings, POST-Bodies, Quittungen
    cmd = re.sub(r"(cat >+ ?\S+ <<-?\s*['\"]?(\w+)['\"]?)\n.*?\n\2\b", r"\1 <BODY>", cmd, flags=re.S)
    cmd = re.sub(r"(git commit[^\n]*<<-?\s*['\"]?(\w+)['\"]?)\n.*?\n\2\b", r"\1 <BODY>", cmd, flags=re.S)
    cmd = re.sub(r'""".*?"""', '<TEXT>', cmd, flags=re.S)
    cmd = re.sub(r"(for \w+ in [^;]+; do )?curl -s -X POST[^|;&]*/api/self/(events|inbox)/[^|;&]*?/(ack|read)\"?[^|;&]*(\| head -c \d+)?(>/dev/null)?( 2>&1)?(; done)?", "<ACK>", cmd)
    return re.sub(r"(-d|--data) '\{.*?\}'", r"\1 <JSON>", cmd, flags=re.S)

def load(prefix):
    fs = glob.glob(ROOT + '/*claude-fleet*/' + prefix + '*.jsonl'); assert len(fs) == 1, (prefix, fs)
    uses, res, kept, tools = [], {}, [], C.Counter()
    for n, line in enumerate(open(fs[0], 'rb').read().split(b'\n'), 1):
        if line.strip():
            r = json.loads(line)
            if r.get('timestamp') and r['timestamp'] > CUTOFF: break
            if not r.get('isSidechain'):
                c = (r.get('message') or {}).get('content')
                for x in c if isinstance(c, list) else []:
                    if isinstance(x, dict) and x.get('type') == 'tool_use': uses.append((n, x))
                    if isinstance(x, dict) and x.get('type') == 'tool_result': res.setdefault(x['tool_use_id'], []).append(x)
        kept.append(line)
    assert len(uses) == len({x['id'] for _, x in uses})
    calls = []
    for n, x in uses:
        tools[x['name']] += 1
        if x['name'] != 'Bash': continue
        rs = res[x['id']]; assert len(rs) == 1
        calls.append(dict(line=n, cmd=x['input'].get('command', ''), bytes=size(rs[0].get('content', '')), err=bool(rs[0].get('is_error'))))
    return dict(sha=hashlib.sha256(b'\n'.join(kept)).hexdigest(), rows=len(kept), tools=dict(tools), calls=calls)

def classify(key, i, raw):
    cmd, ntok = raw, 0
    for rx in TOKFETCH:
        cmd, k = re.subn(rx, 'TOK=<fetch>', cmd); ntok += k
    cmd = debody(cmd)
    tag = next((name for name, rx in RULES if re.search(rx, cmd)), 'OTHER')
    if tag in ('API_RAW', 'NARROW_API', 'SELF_GET', 'FLEETJSON_RAW', 'KEYPROBE'):   # POST vor dem ersten lesenden curl = Akt mit Rueckblick
        mp, mg = re.search(r"-X POST", cmd), re.search(r"curl(?![^|;]*-X POST)", cmd)
        if mp and (not mg or mp.start() < mg.start()) and not re.search(r"open\(['\"](/Users/owner/claude-fleet/)?fleet\.json", cmd[:mp.start()]): tag = 'ACT'
    ov = {n: c for c, spec in OVR.get(key, {}).items() for n in rng(spec)}
    cls = ov.get(i, 'N' if (key[0] == 'L' and tag == 'IFACE') else DEFAULT[tag])   # eine Lane, die Routen greppt, arbeitet am Code
    fam = '-'
    if cls in 'abc':
        if cls == 'a' and tag not in ('LEDGER_RAW', 'HOST', 'BUILD', 'QUEUEFILE'): fam = 'DISCOVER'
        elif tag == 'PANE' or (cls == 'c' and re.search(r'tmux', cmd)): fam = 'PANE'
        else: fam = next((f for f, rx in FAM if re.search(rx, cmd)), 'DISCOVER' if cls == 'a' else 'STATE_OTHER')
    return tag, cls, fam, ntok

rows = []
for key, p in SAMPLE:
    s = load(p)
    print('SESSION', key, p, 'rows', s['rows'], 'sha256', s['sha'], 'tools', json.dumps(s['tools'], sort_keys=True))
    for i, c in enumerate(s['calls'], 1):
        tag, cls, fam, ntok = classify(key, i, c['cmd'])
        rows.append(dict(key=f'{key}.{i:03}', role=key[0], line=c['line'], bytes=c['bytes'], err=c['err'], tag=tag, cls=cls, fam=fam, tok=ntok))
assert len(rows) == 1204
st = lambda rs: f"{len(rs)}:{sum(r['bytes'] for r in rs)}"
print('ROLE total | N | 0 | a | b | c   (Aufrufe:Bytes)')
for ro in 'OML':
    print(ro, st([r for r in rows if r['role'] == ro]), '|', ' | '.join(st([r for r in rows if r['role'] == ro and r['cls'] == x]) for x in 'N0abc'))
print('ALL', st(rows), '|', ' | '.join(st([r for r in rows if r['cls'] == x]) for x in 'N0abc'))
print('FAMILIES role fam cls Aufrufe:Bytes')
for k in sorted({(r['role'], r['fam'], r['cls']) for r in rows if r['cls'] in 'abc'}, key=lambda k: ('OML'.index(k[0]), k[1], k[2])):
    print(' ', *k, st([r for r in rows if (r['role'], r['fam'], r['cls']) == k]))
print('N_BY_TAG', {ro: dict(C.Counter(r['tag'] for r in rows if r['role'] == ro and r['cls'] == 'N').most_common()) for ro in 'OML'})
print('TOKFETCH', {ro: sum(1 for r in rows if r['role'] == ro and r['tok']) for ro in 'OML'}, 'QUEUEFILE_b', sum(1 for r in rows if r['tag'] == 'QUEUEFILE' and r['cls'] == 'b'), 'is_error', sum(r['err'] for r in rows))
if '--register' in sys.argv:
    print('REGISTER key:Zeile:Klasse:Familie:Bytes (nur Klassen 0/a/b/c; ! = is_error)')
    d = [r for r in rows if r['cls'] != 'N']
    for i in range(0, len(d), 5):
        print(' '.join(f"{r['key']}:L{r['line']}:{r['cls']}:{r['fam']}:{r['bytes']}{'!' if r['err'] else ''}" for r in d[i:i + 5]))
```

### 9.2 `readers.py` — Leser der Aggregate und Roh-Lesungen, 14 Tage

```python
import json,glob,os,re,time,collections
root=os.path.expanduser('~/.claude/projects')
CUTOFF='2026-09-17T07:28:47.000Z'; SINCE='2026-09-03T00:00:00.000Z'
PROBES={
 'state.sh':r"(\./|/)state\.sh\b", 'register.sh':r"(\./|/)register\.sh\b", 'ctl.sh':r"(\./|/)ctl\.sh\b",
 **{f:rf"bun (\S*/)?{re.escape(f)}" for f in ['land-quality.ts','trailstats.ts','briefstats.ts','slotstats.ts','lane-context-cost.ts','land-collision-stats.ts','land-log.ts','start-plan.ts','task-notes.ts','capability-map.ts','repo-map.ts']},
 **{r:rf"curl[^|;]*{re.escape(r)}(?![\w/-])" for r in ['/api/audit','/api/lane-outcomes','/api/context-receipts','/api/post-land-audits','/api/post-land-audits/artifact','/api/deploys','/api/dispositions','/api/steward/journal','/api/steward/digest','/api/slot-stats','/api/flakes','/api/self/program-execution','/api/self/supervisor-view','/api/fleet-report','/api/events','/api/helper/jobs','/api/start-plan','/api/sessions','/api/tasks']},
 '/api/lane?branch':r"curl[^|;]*/api/lane\?",
}
LEDGERS=['audit.jsonl','post-land-audits.jsonl','lane-outcomes.jsonl','context-receipts.jsonl','tasks-archive.jsonl','fleet-reports.jsonl','land-quality.jsonl','cards.jsonl','steward-journal.jsonl','helper-artifacts.jsonl','audit-adjudications.jsonl','deploys.jsonl','inspektion-register.jsonl','dispositions.jsonl','prompts.jsonl']
READCMDS='tail|head|cat|grep|wc|jq'
for l in LEDGERS:
    PROBES['RAW '+l]=r"(open\(['\"][^'\"]*|(?:"+READCMDS+r")\b[^|;&]*?[ /])"+(r"(?<![\w-])" if l=='audit.jsonl' else '')+re.escape(l)
RX={k:re.compile(v) for k,v in PROBES.items()}
def role(first,d):
    if 'worktrees' in d: return 'lane'
    if 'Program-MAIN' in first: return 'main'
    if 'succession' in first or 'Orchestrator' in first: return 'orch'
    return 'other'
hits=collections.defaultdict(lambda:dict(n=0,last='',by=collections.Counter(),sessions=set()))
nfiles=0;ncalls=0
t0=time.mktime(time.strptime(SINCE[:10],'%Y-%m-%d'))
for d in os.listdir(root):
    if 'claude-fleet' not in d: continue
    for f in glob.glob(os.path.join(root,d,'*.jsonl')):
        if os.stat(f).st_mtime < t0: continue
        first=None;nfiles+=1
        for line in open(f,encoding='utf-8',errors='replace'):
            if first is None and '"type":"user"' in line:
                try:
                    r=json.loads(line);c=(r.get('message') or {}).get('content')
                    t=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if isinstance(x,dict))
                    if t.strip() and not t.startswith('<'): first=t[:300]
                except Exception: pass
            if '"name":"Bash"' not in line: continue
            try:r=json.loads(line)
            except Exception: continue
            if r.get('isSidechain'): continue
            ts=r.get('timestamp') or ''
            if ts<SINCE or ts>CUTOFF: continue
            for x in (r.get('message') or {}).get('content') or []:
                if isinstance(x,dict) and x.get('type')=='tool_use' and x.get('name')=='Bash':
                    ncalls+=1
                    cmd=x['input'].get('command','')
                    inv=sum(1 for l in LEDGERS if l in cmd)>=5 or '*.jsonl' in cmd
                    for k,rx in RX.items():
                        if k.startswith('RAW ') and inv: continue
                        if rx.search(cmd):
                            h=hits[k];h['n']+=1;h['sessions'].add(f)
                            ro=role(first or '',d);h['by'][ro]+=1
                            if ts>h['last']: h['last']=ts;h['lastrole']=ro
print('files',nfiles,'bash calls',ncalls,'window',SINCE,CUTOFF)
for k in PROBES:
    h=hits.get(k)
    if h: print(f"{k:34} n={h['n']:5} sessions={len(h['sessions']):4} last={h['last'][:16]} ({h.get('lastrole')}) by={dict(h['by'])}")
    else: print(f"{k:34} n=0")
```

## 10. Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-17T07:30Z	stichprobe	je Rolle die zuletzt beendeten Sessions, laufende ausgeschlossen	mechanische Regel statt Auswahl nach Inhalt	§2 Auswahlregel	9 Sessions, 1.204 Aufrufe
2026-09-17T07:34Z	klassen	vierte und fünfte Klasse N und 0 neben a/b/c geführt	787 Aufrufe stellen keine Datenfrage; ohne 0 gibt es keinen Nenner	§2 Klassentabelle	417 Datenfragen, 283 Symptome
2026-09-17T07:37Z	klassen	„für die Rolle nicht erreichbar" zählt als b, nicht c	eine Projektion einem Prinzipal zu öffnen ist Schnitt, kein Bau	§2	19 Lane-Aufrufe in b
2026-09-17T07:37Z	beleg	ssh-Kette M1.112–118 gegen helper-artifacts.jsonl geprüft	ohne Upload wäre sie b gewesen	rowAt 1789607632110, 763.810 B	a bestätigt
2026-09-17T07:40Z	korpus	alle Transkripte auf 07:28:47Z eingefroren	L4 wuchs nach der Ziehung von 60 auf 66 Aufrufe	§2 (ii)	Summe wieder 1.204
2026-09-17T07:41Z	kennzahl	Roh-Anteil statt Trefferquote als stehende Zahl	Trefferquote hängt an 156 Handkorrekturen	§6	91,9 %
2026-09-17T07:42Z	vorarbeit	A/B/C im lebenden fleet.json und im Archiv gesucht	Auftrag nennt „nicht gefilet" als Befund, nicht als Annahme	Zeile 9d610a68, notiz, pending	bestätigt
2026-09-17T07:45Z	schnitt	Linie nach drei Posten; Pane-Blick darunter	einzige c-Familie mit Volumen, aber Bedarf ungemessen	§5	3 valide Karten
```

## 11. Unveränderte Skriptausgabe und Register

```text
SESSION O1 c21e730a rows 1381 sha256 b56b924ea09f58930c230636a24a513ca62728bc540cd3ae924f3b50200c32c4 tools {"Bash": 165, "Read": 2, "Skill": 1}
SESSION O2 6ba575c0 rows 1605 sha256 2b44babdbeec614db3a68181deb4f3009724776811dcc87a459b2c6adb1ea6c2 tools {"Bash": 192, "Skill": 1}
SESSION M1 2127fa4b rows 1190 sha256 19e31064b07a065b336f2e29f8c9df6173a834e4c4405b3e55cab0ceb3653bc8 tools {"Bash": 151}
SESSION M2 f91abc28 rows 1059 sha256 5d3d3a8bb6e878eebcef1622b87dc20b0b8f234a53add1519b6437a11c148670 tools {"Bash": 125}
SESSION L1 7f7b1788 rows 814 sha256 c690633412b81e939d679de76d469c55ef53dbbe11aee1a951171d8f4e99714e tools {"Bash": 124}
SESSION L2 32751363 rows 768 sha256 4e847e842be83e1c334694c94f172083a7016cf499be2c4c0a3ab56e31c9a6b7 tools {"Bash": 111}
SESSION L3 85053419 rows 675 sha256 f78d0d61f43ae53941ebf2e48a46239b9e54c9988e9bdb3f32969add17600996 tools {"Bash": 99}
SESSION L4 796ad3b0 rows 447 sha256 fa251ad5b5e45815bb30f1d0b34fb805ee9ab5eb049d765b43385407aca19955 tools {"Bash": 60}
SESSION L5 1e2eb50c rows 1172 sha256 29a22d15c073f9741d09a5b2ca6a3c43d8f62a9eb462259dc0805eac0bd145fd tools {"Bash": 177}
ROLE total | N | 0 | a | b | c   (Aufrufe:Bytes)
O 357:478322 | 154:175780 | 35:91313 | 50:34489 | 89:111387 | 29:65353
M 276:494282 | 111:180449 | 70:174010 | 44:41230 | 38:40176 | 13:58417
L 571:969730 | 522:921900 | 29:30365 | 1:264 | 19:17201 | 0:0
ALL 1204:1942334 | 787:1278129 | 134:295688 | 95:75983 | 146:168764 | 42:123770
FAMILIES role fam cls Aufrufe:Bytes
  O AUDIT a 10:6231
  O AUDIT b 11:10837
  O BOARD b 9:8753
  O DEPLOY b 3:1735
  O DEPLOY c 2:3754
  O DISCOVER a 40:28258
  O HELPER b 4:4067
  O LEDGER b 5:5843
  O PANE c 17:48993
  O QUOTA c 9:8996
  O REPORT b 24:17017
  O STATE_OTHER b 4:5773
  O STATE_OTHER c 1:3610
  O TASK b 29:57362
  M AUDIT a 12:15150
  M AUDIT b 20:14610
  M DEPLOY a 2:1482
  M DEPLOY b 3:1121
  M DISCOVER a 20:15350
  M HELPER a 8:7985
  M HELPER b 6:7532
  M LEDGER a 2:1263
  M PANE c 12:53963
  M STATE_OTHER b 3:1661
  M STATE_OTHER c 1:4454
  M TASK b 6:15252
  L AUDIT b 2:836
  L BOARD b 4:1613
  L DISCOVER a 1:264
  L HELPER b 4:22
  L LEDGER b 3:7258
  L REPORT b 2:2814
  L TASK b 4:4658
N_BY_TAG {'O': {'ACT': 68, 'SRC': 49, 'GIT': 16, 'HOST': 7, 'FLEETJSON_RAW': 4, 'TRANSCRIPT': 3, 'BUILD': 2, 'API_RAW': 2, 'OTHER': 1, 'CTL_READ': 1, 'NARROW_API': 1}, 'M': {'ACT': 39, 'GIT': 32, 'SRC': 28, 'BUILD': 5, 'HOST': 3, 'CTL_READ': 2, 'LEDGER_RAW': 1, 'QUEUEFILE': 1}, 'L': {'SRC': 273, 'ACT': 128, 'BUILD': 65, 'GIT': 21, 'IFACE': 12, 'OTHER': 10, 'LEDGER_RAW': 4, 'API_RAW': 4, 'HOST': 3, 'SELF_GET': 2}}
TOKFETCH {'O': 62, 'M': 17, 'L': 0} QUEUEFILE_b 15 is_error 23
REGISTER key:Zeile:Klasse:Familie:Bytes (nur Klassen 0/a/b/c; ! = is_error)
O1.001:L25:0:-:7292 O1.002:L26:0:-:13953 O1.003:L40:0:-:5068 O1.004:L41:0:-:8231 O1.006:L57:0:-:923
O1.007:L62:a:DISCOVER:299! O1.008:L68:a:DISCOVER:24 O1.009:L74:a:DISCOVER:24 O1.010:L86:a:DISCOVER:382 O1.011:L93:a:DISCOVER:31
O1.012:L99:a:DISCOVER:42 O1.013:L105:a:DISCOVER:282 O1.014:L117:0:-:1875 O1.015:L122:a:DISCOVER:31 O1.016:L126:a:DISCOVER:9
O1.017:L130:a:DISCOVER:599 O1.018:L135:a:DISCOVER:202 O1.019:L146:a:DISCOVER:2673 O1.020:L153:a:DISCOVER:364 O1.021:L158:a:DISCOVER:467
O1.022:L162:b:BOARD:1796 O1.023:L172:a:DISCOVER:135 O1.024:L176:b:TASK:1654 O1.025:L181:b:TASK:430 O1.026:L191:c:PANE:18
O1.027:L195:c:PANE:547 O1.028:L199:c:PANE:5871 O1.029:L204:b:TASK:169 O1.030:L213:b:TASK:1819 O1.031:L218:b:TASK:2979
O1.032:L223:b:TASK:484 O1.038:L262:a:DISCOVER:314 O1.039:L273:a:DISCOVER:76 O1.040:L277:b:TASK:4223 O1.041:L281:b:TASK:1204
O1.043:L296:b:TASK:9003 O1.044:L306:c:PANE:3755 O1.045:L311:b:TASK:3682 O1.047:L326:b:AUDIT:1246 O1.050:L355:b:TASK:1484
O1.051:L360:b:LEDGER:3313 O1.052:L367:b:LEDGER:393 O1.054:L382:b:TASK:2401 O1.058:L413:b:REPORT:777 O1.059:L418:b:REPORT:130
O1.060:L422:b:REPORT:31 O1.063:L441:a:DISCOVER:6000 O1.066:L461:b:REPORT:200! O1.067:L465:b:REPORT:1786 O1.069:L475:a:DISCOVER:420
O1.072:L494:b:REPORT:27 O1.074:L503:c:PANE:3374 O1.076:L518:b:TASK:160 O1.077:L535:a:DISCOVER:1552 O1.086:L605:a:DISCOVER:739
O1.087:L617:0:-:64 O1.089:L640:b:TASK:3387 O1.096:L697:b:BOARD:1221 O1.103:L763:b:TASK:310 O1.104:L773:a:DISCOVER:682
O1.109:L806:0:-:64 O1.110:L822:c:PANE:3762 O1.111:L829:0:-:299 O1.118:L897:b:REPORT:1011! O1.119:L908:b:REPORT:284
O1.124:L952:0:-:168 O1.125:L962:0:-:454 O1.126:L974:0:-:471 O1.137:L1081:0:-:343 O1.140:L1121:a:AUDIT:477
O1.143:L1169:a:AUDIT:730 O1.147:L1224:a:AUDIT:295! O1.148:L1230:a:AUDIT:355 O1.149:L1234:a:AUDIT:380 O1.150:L1240:a:AUDIT:771
O1.151:L1251:b:TASK:1287 O1.154:L1273:a:DISCOVER:31 O1.155:L1279:a:DISCOVER:31 O1.156:L1285:a:DISCOVER:475 O2.001:L25:0:-:7452
O2.002:L26:0:-:13969 O2.003:L41:0:-:6181 O2.004:L42:0:-:9273 O2.005:L54:0:-:1890 O2.006:L58:0:-:2868
O2.008:L66:a:DISCOVER:48 O2.009:L76:a:DISCOVER:24 O2.010:L80:a:DISCOVER:609 O2.011:L85:a:DISCOVER:1422 O2.012:L91:a:DISCOVER:901
O2.013:L103:b:BOARD:2241 O2.014:L112:b:DEPLOY:522 O2.015:L117:a:DISCOVER:311 O2.016:L121:b:AUDIT:3738 O2.017:L126:b:TASK:6394
O2.019:L139:b:TASK:666 O2.024:L174:c:PANE:4895 O2.025:L177:c:PANE:3976 O2.027:L191:a:DISCOVER:4280 O2.028:L201:b:REPORT:277
O2.029:L208:b:REPORT:641 O2.030:L212:b:REPORT:900 O2.031:L217:a:DISCOVER:1358 O2.032:L227:b:REPORT:2 O2.033:L231:b:REPORT:284
O2.034:L234:b:REPORT:284 O2.035:L239:b:LEDGER:642 O2.036:L247:a:DISCOVER:150 O2.038:L263:b:STATE_OTHER:232! O2.039:L267:b:STATE_OTHER:2798
O2.042:L289:b:TASK:433 O2.044:L312:b:REPORT:2313 O2.045:L315:b:TASK:225 O2.046:L325:b:STATE_OTHER:2209 O2.047:L331:0:-:429
O2.048:L337:0:-:434 O2.050:L358:0:-:312 O2.051:L362:c:PANE:5211 O2.053:L383:b:REPORT:2933 O2.054:L394:b:REPORT:2
O2.055:L398:b:REPORT:284 O2.056:L417:c:PANE:3668 O2.057:L425:b:REPORT:284 O2.058:L428:0:-:187 O2.060:L450:b:AUDIT:1720
O2.061:L456:a:DISCOVER:324 O2.062:L467:c:STATE_OTHER:3610 O2.063:L471:c:DEPLOY:2271 O2.064:L477:c:DEPLOY:1483 O2.065:L490:b:REPORT:124
O2.067:L504:a:AUDIT:1162 O2.068:L517:b:AUDIT:336 O2.069:L524:b:AUDIT:427 O2.072:L547:c:PANE:3193 O2.073:L558:b:HELPER:868
O2.074:L564:b:REPORT:422 O2.076:L589:b:DEPLOY:685 O2.077:L600:b:REPORT:978 O2.078:L605:b:BOARD:1484 O2.080:L624:c:PANE:2095
O2.083:L651:0:-:1491 O2.084:L657:b:AUDIT:942 O2.085:L668:b:HELPER:2252 O2.086:L678:b:HELPER:135 O2.088:L694:b:HELPER:812
O2.089:L705:b:AUDIT:764 O2.092:L729:c:PANE:1876 O2.096:L768:a:AUDIT:428 O2.097:L776:b:STATE_OTHER:534 O2.098:L792:0:-:771
O2.099:L798:0:-:41 O2.100:L802:0:-:570 O2.101:L808:c:PANE:2365 O2.102:L819:b:TASK:286 O2.104:L841:0:-:911
O2.105:L846:b:REPORT:2154 O2.107:L866:0:-:850 O2.109:L875:b:AUDIT:283 O2.113:L910:b:BOARD:152 O2.117:L944:a:AUDIT:376
O2.119:L963:0:-:157 O2.120:L968:0:-:275 O2.121:L974:b:DEPLOY:528 O2.122:L993:0:-:902 O2.123:L996:a:AUDIT:1257
O2.124:L1001:b:AUDIT:277 O2.125:L1027:b:AUDIT:296 O2.126:L1030:b:TASK:3696 O2.127:L1043:b:TASK:6715 O2.130:L1066:c:QUOTA:2191
O2.131:L1071:0:-:64 O2.132:L1082:c:QUOTA:2093 O2.133:L1085:c:QUOTA:2021 O2.134:L1090:c:QUOTA:1149 O2.135:L1095:c:QUOTA:173
O2.136:L1108:c:QUOTA:401 O2.138:L1129:b:TASK:320 O2.139:L1135:b:TASK:814 O2.140:L1141:b:TASK:268 O2.141:L1151:b:BOARD:121
O2.142:L1157:c:PANE:2103 O2.147:L1207:0:-:2423 O2.148:L1208:b:LEDGER:606 O2.149:L1216:b:AUDIT:808 O2.150:L1228:b:LEDGER:889
O2.153:L1252:a:DISCOVER:1681 O2.155:L1273:b:TASK:1874 O2.157:L1292:a:DISCOVER:475 O2.160:L1307:b:TASK:872 O2.161:L1318:a:DISCOVER:129
O2.162:L1322:0:-:658 O2.165:L1344:a:DISCOVER:608 O2.167:L1356:b:TASK:123 O2.168:L1373:c:QUOTA:278 O2.169:L1378:c:QUOTA:377
O2.170:L1390:c:QUOTA:313 O2.172:L1411:a:DISCOVER:54 O2.175:L1438:b:BOARD:207 O2.178:L1464:c:PANE:1052 O2.180:L1472:c:PANE:1232
O2.182:L1486:b:BOARD:389 O2.186:L1530:b:BOARD:1142 O2.187:L1541:b:REPORT:889 M1.001:L26:0:-:7448 M1.002:L27:0:-:12176
M1.003:L41:0:-:5181 M1.004:L42:0:-:229 M1.006:L52:0:-:3000 M1.007:L62:0:-:127 M1.008:L66:a:DISCOVER:692
M1.009:L70:0:-:2938 M1.010:L75:0:-:696 M1.011:L84:0:-:3032 M1.012:L89:0:-:258 M1.013:L92:0:-:998
M1.014:L97:0:-:776 M1.015:L107:0:-:1875 M1.016:L111:c:PANE:11736 M1.017:L121:a:AUDIT:1442 M1.018:L126:0:-:4832
M1.019:L136:b:AUDIT:581 M1.020:L141:a:AUDIT:5240 M1.021:L146:b:AUDIT:1138 M1.022:L156:b:AUDIT:522 M1.024:L167:a:DISCOVER:249
M1.025:L178:a:DISCOVER:2800 M1.027:L189:b:STATE_OTHER:407 M1.028:L201:a:DISCOVER:293 M1.029:L207:b:AUDIT:239 M1.032:L229:b:STATE_OTHER:113
M1.033:L234:a:LEDGER:82 M1.034:L240:a:LEDGER:1181 M1.035:L252:b:AUDIT:3988 M1.038:L279:b:AUDIT:878 M1.039:L286:b:HELPER:2042!
M1.040:L298:a:DISCOVER:572 M1.041:L302:b:HELPER:2518 M1.046:L337:b:STATE_OTHER:1141 M1.047:L347:a:DISCOVER:524 M1.048:L353:c:STATE_OTHER:4454
M1.049:L358:a:DISCOVER:43 M1.050:L368:a:DISCOVER:133 M1.051:L373:a:DISCOVER:758 M1.052:L379:a:DISCOVER:31 M1.053:L385:a:DISCOVER:545
M1.054:L396:a:DISCOVER:555 M1.055:L402:b:DEPLOY:381 M1.056:L407:a:DEPLOY:1095 M1.057:L414:0:-:1442 M1.058:L426:a:DISCOVER:560
M1.059:L439:0:-:4611 M1.060:L449:b:HELPER:664 M1.064:L478:0:-:604 M1.067:L498:b:AUDIT:937 M1.070:L531:b:AUDIT:645
M1.071:L541:a:AUDIT:390 M1.072:L548:b:HELPER:744 M1.074:L562:a:DEPLOY:387 M1.075:L566:b:DEPLOY:232 M1.076:L571:0:-:81
M1.077:L586:0:-:4118 M1.082:L617:a:AUDIT:484 M1.083:L627:b:AUDIT:193 M1.085:L642:0:-:131 M1.087:L656:0:-:4403
M1.088:L666:b:HELPER:1061 M1.091:L690:0:-:539 M1.092:L701:0:-:695 M1.094:L723:a:AUDIT:643 M1.096:L747:b:AUDIT:170
M1.098:L756:b:AUDIT:446 M1.099:L774:a:AUDIT:1358 M1.100:L781:b:AUDIT:294 M1.102:L800:a:AUDIT:12 M1.103:L804:a:AUDIT:3034
M1.104:L809:a:DISCOVER:1167 M1.105:L820:a:DISCOVER:548 M1.106:L826:a:AUDIT:553 M1.107:L831:a:AUDIT:433 M1.112:L868:a:HELPER:36
M1.113:L872:a:HELPER:347 M1.114:L876:a:HELPER:17 M1.115:L882:a:HELPER:217 M1.116:L892:a:HELPER:267 M1.117:L896:a:HELPER:2592
M1.118:L903:a:HELPER:3807 M1.127:L964:0:-:435 M1.128:L979:0:-:4440 M1.129:L984:a:AUDIT:364 M1.132:L1007:0:-:54
M1.134:L1031:c:PANE:4945 M1.135:L1044:0:-:131 M1.137:L1058:0:-:642 M1.138:L1070:b:DEPLOY:508 M1.139:L1076:0:-:4364
M1.140:L1086:b:HELPER:503 M1.146:L1136:0:-:315 M1.147:L1147:b:AUDIT:580 M1.149:L1163:b:AUDIT:335 M1.151:L1180:0:-:65
M2.001:L25:0:-:7214 M2.002:L26:0:-:12342 M2.003:L40:0:-:5255 M2.004:L41:0:-:7117 M2.005:L53:0:-:123
M2.006:L56:0:-:289 M2.007:L61:a:DISCOVER:172 M2.008:L65:a:DISCOVER:692 M2.009:L69:0:-:5215 M2.010:L79:0:-:2298
M2.011:L89:0:-:3791 M2.012:L94:0:-:258 M2.013:L97:a:DISCOVER:619 M2.015:L105:0:-:7435 M2.020:L145:0:-:12913
M2.021:L157:c:PANE:646 M2.022:L161:c:PANE:12497 M2.023:L174:a:AUDIT:1197 M2.025:L184:0:-:158! M2.027:L203:0:-:1875
M2.028:L208:0:-:4157 M2.029:L218:b:AUDIT:543 M2.031:L241:0:-:4665 M2.032:L246:0:-:674 M2.033:L256:b:TASK:2894
M2.040:L301:a:HELPER:702 M2.041:L320:b:AUDIT:1646 M2.043:L332:a:DISCOVER:276 M2.045:L348:0:-:275 M2.046:L359:0:-:4562
M2.047:L369:0:-:328 M2.049:L377:c:PANE:3326 M2.050:L389:0:-:731 M2.051:L394:c:PANE:4132 M2.052:L399:c:PANE:2925
M2.053:L411:b:TASK:3322 M2.054:L417:b:TASK:3635 M2.055:L427:b:TASK:4479 M2.063:L493:b:AUDIT:389 M2.064:L496:0:-:823
M2.065:L502:c:PANE:6570 M2.066:L515:0:-:563 M2.075:L590:0:-:506 M2.076:L607:0:-:4572 M2.079:L630:0:-:223
M2.082:L651:b:AUDIT:476 M2.087:L702:b:AUDIT:429 M2.088:L714:0:-:529 M2.089:L724:b:AUDIT:181 M2.090:L742:0:-:4485
M2.091:L748:c:PANE:1999 M2.094:L768:0:-:92 M2.098:L801:0:-:717 M2.099:L812:0:-:79 M2.100:L816:c:PANE:2278
M2.101:L834:0:-:185 M2.102:L842:b:TASK:363 M2.103:L849:c:PANE:986 M2.104:L861:0:-:1729 M2.108:L904:0:-:4475
M2.109:L909:c:PANE:1923 M2.114:L959:0:-:623 M2.115:L971:0:-:541 M2.116:L977:a:DISCOVER:4121 M2.117:L984:0:-:1241
M2.119:L1000:0:-:201 M2.123:L1027:0:-:115 M2.125:L1043:b:TASK:559 L1.028:L183:b:BOARD:210 L1.029:L187:b:BOARD:616
L1.030:L191:b:BOARD:420 L1.061:L378:0:-:1334 L1.077:L478:0:-:3312 L1.085:L545:0:-:287 L1.110:L726:0:-:761
L2.001:L24:0:-:1158 L2.051:L348:b:HELPER:11 L2.053:L356:b:HELPER:1 L2.054:L365:b:HELPER:6 L2.056:L375:b:HELPER:4
L2.073:L496:0:-:3000 L2.074:L501:0:-:2325 L2.103:L707:0:-:1433 L2.104:L711:0:-:387 L3.008:L70:b:LEDGER:4936
L3.009:L73:b:LEDGER:893 L3.010:L84:b:TASK:1076 L3.011:L89:b:REPORT:2217 L3.012:L99:b:TASK:1070! L3.014:L107:b:BOARD:367
L3.016:L120:b:LEDGER:1429 L3.055:L371:0:-:1653 L3.056:L375:0:-:165 L3.067:L442:0:-:571 L3.077:L511:0:-:233
L3.078:L521:0:-:44 L3.087:L586:b:AUDIT:214 L3.093:L626:0:-:105 L4.008:L73:b:TASK:1191 L4.010:L88:b:REPORT:597
L4.011:L93:b:TASK:1321 L4.034:L248:0:-:1405 L4.049:L343:0:-:3876 L4.051:L370:0:-:357 L4.052:L375:0:-:1395
L4.056:L403:0:-:391 L5.042:L259:a:DISCOVER:264 L5.089:L556:0:-:2918 L5.096:L596:0:-:287 L5.115:L716:0:-:113
L5.119:L741:0:-:114 L5.129:L814:0:-:182 L5.130:L819:0:-:66 L5.132:L841:0:-:145 L5.138:L886:b:AUDIT:622
L5.170:L1108:0:-:144 L5.173:L1133:0:-:2204
```

```text
files 1355 bash calls 47877 window 2026-09-03T00:00:00.000Z 2026-09-17T07:28:47.000Z
state.sh                           n=  430 sessions= 159 last=2026-09-17T06:23 (orch) by={'lane': 47, 'orch': 167, 'other': 28, 'main': 188}
register.sh                        n=  362 sessions= 153 last=2026-09-17T06:35 (orch) by={'lane': 18, 'orch': 185, 'other': 28, 'main': 131}
ctl.sh                             n=  786 sessions=  43 last=2026-09-17T07:11 (main) by={'lane': 37, 'orch': 445, 'main': 304}
land-quality.ts                    n=   28 sessions=  11 last=2026-09-17T06:16 (orch) by={'lane': 12, 'orch': 15, 'main': 1}
trailstats.ts                      n=    3 sessions=   2 last=2026-09-14T10:07 (orch) by={'orch': 3}
briefstats.ts                      n=    4 sessions=   1 last=2026-09-03T19:25 (other) by={'other': 4}
slotstats.ts                       n=0
lane-context-cost.ts               n=   17 sessions=   4 last=2026-09-15T16:05 (lane) by={'lane': 16, 'main': 1}
land-collision-stats.ts            n=    7 sessions=   4 last=2026-09-15T13:18 (lane) by={'lane': 6, 'orch': 1}
land-log.ts                        n=    7 sessions=   3 last=2026-09-14T17:50 (main) by={'lane': 3, 'main': 3, 'orch': 1}
start-plan.ts                      n=   20 sessions=  10 last=2026-09-16T16:24 (lane) by={'lane': 13, 'main': 5, 'orch': 2}
task-notes.ts                      n=    2 sessions=   1 last=2026-09-09T05:08 (lane) by={'lane': 2}
capability-map.ts                  n=    1 sessions=   1 last=2026-09-14T16:51 (lane) by={'lane': 1}
repo-map.ts                        n=   46 sessions=  22 last=2026-09-17T01:48 (lane) by={'lane': 40, 'main': 6}
/api/audit                         n=0
/api/lane-outcomes                 n=0
/api/context-receipts              n=0
/api/post-land-audits              n=   25 sessions=  15 last=2026-09-16T18:19 (lane) by={'lane': 1, 'orch': 17, 'main': 4, 'other': 3}
/api/post-land-audits/artifact     n=   53 sessions=  51 last=2026-09-17T02:28 (lane) by={'lane': 47, 'orch': 1, 'main': 5}
/api/deploys                       n=  106 sessions=  44 last=2026-09-17T05:21 (orch) by={'orch': 69, 'other': 24, 'main': 13}
/api/dispositions                  n=0
/api/steward/journal               n=    1 sessions=   1 last=2026-09-03T06:21 (lane) by={'lane': 1}
/api/steward/digest                n=    1 sessions=   1 last=2026-09-03T06:24 (lane) by={'lane': 1}
/api/slot-stats                    n=0
/api/flakes                        n=    2 sessions=   1 last=2026-09-06T10:47 (lane) by={'lane': 2}
/api/self/program-execution        n=  394 sessions=  70 last=2026-09-17T06:43 (main) by={'main': 392, 'orch': 2}
/api/self/supervisor-view          n=0
/api/fleet-report                  n=    9 sessions=   4 last=2026-09-17T00:17 (lane) by={'lane': 6, 'orch': 3}
/api/events                        n=0
/api/helper/jobs                   n=   37 sessions=  13 last=2026-09-14T20:46 (orch) by={'orch': 35, 'main': 1, 'lane': 1}
/api/start-plan                    n=   53 sessions=  17 last=2026-09-17T06:42 (orch) by={'orch': 44, 'main': 9}
/api/sessions                      n=  984 sessions= 134 last=2026-09-17T06:43 (orch) by={'lane': 69, 'orch': 557, 'other': 204, 'main': 154}
/api/tasks                         n=  250 sessions=  56 last=2026-09-17T06:46 (orch) by={'lane': 10, 'orch': 216, 'main': 14, 'other': 10}
/api/lane?branch                   n=0
RAW audit.jsonl                    n=  275 sessions=  98 last=2026-09-17T06:32 (lane) by={'lane': 100, 'orch': 102, 'main': 52, 'other': 21}
RAW post-land-audits.jsonl         n=  804 sessions= 170 last=2026-09-17T06:58 (orch) by={'lane': 79, 'orch': 316, 'other': 33, 'main': 376}
RAW lane-outcomes.jsonl            n=  294 sessions=  96 last=2026-09-17T06:58 (orch) by={'lane': 49, 'orch': 141, 'main': 87, 'other': 17}
RAW context-receipts.jsonl         n=   21 sessions=  11 last=2026-09-16T12:06 (orch) by={'lane': 13, 'orch': 4, 'other': 4}
RAW tasks-archive.jsonl            n=    4 sessions=   3 last=2026-09-17T06:32 (lane) by={'lane': 3, 'orch': 1}
RAW fleet-reports.jsonl            n=    4 sessions=   4 last=2026-09-16T12:06 (orch) by={'lane': 2, 'orch': 2}
RAW land-quality.jsonl             n=    3 sessions=   3 last=2026-09-15T15:52 (lane) by={'lane': 2, 'orch': 1}
RAW cards.jsonl                    n=   25 sessions=  10 last=2026-09-15T16:18 (orch) by={'lane': 8, 'orch': 16, 'main': 1}
RAW steward-journal.jsonl          n=    2 sessions=   1 last=2026-09-15T17:28 (orch) by={'orch': 2}
RAW helper-artifacts.jsonl         n=   15 sessions=  10 last=2026-09-16T12:59 (lane) by={'lane': 7, 'main': 8}
RAW audit-adjudications.jsonl      n=   40 sessions=  24 last=2026-09-14T10:07 (orch) by={'lane': 3, 'orch': 20, 'main': 14, 'other': 3}
RAW deploys.jsonl                  n=   86 sessions=  52 last=2026-09-17T01:40 (main) by={'lane': 2, 'orch': 41, 'other': 6, 'main': 37}
RAW inspektion-register.jsonl      n=    1 sessions=   1 last=2026-09-03T06:21 (lane) by={'lane': 1}
RAW dispositions.jsonl             n=    3 sessions=   2 last=2026-09-16T12:34 (orch) by={'orch': 3}
RAW prompts.jsonl                  n=   52 sessions=  21 last=2026-09-17T04:49 (lane) by={'lane': 35, 'orch': 7, 'main': 9, 'other': 1}
```

