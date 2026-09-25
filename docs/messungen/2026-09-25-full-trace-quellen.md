# Full-Trace: Quellen, Zuordnung und Grenzen (2026-09-25)

T1/T2 sind lokal belegbar, aber ein Tool-Call-Index ist noch keine vollstaendige
Dateiaenderungs- oder Laufzeitspur. Der groesste Verlust liegt in historischen
Occupation-Schluesseln und in Werkzeugen, die mehrere Operationen kapseln.

## 1. Messrahmen und fuenf Befunde

Gelesen: Plan aus `main`, `docs/overhaul-plan-2026-09-25.md:60` und `:243`;
Quellcode auf `9e7642c4`; lokale Sessiondateien; `fleet.json`, alle vorhandenen
Generationen von `audit.jsonl`, `lane-outcomes.jsonl`, `fleet-reports.jsonl`;
929 JSON-Land-Notizen aus `git notes --ref=fleet/land`. Vorarbeit:
`docs/messungen/2026-09-21-band-transkript-quelle.md:24`, einschliesslich des
spaeteren Nachtrags. Deren damalige Bestandszahlen wurden nicht uebernommen.

Transkript-Bestandsaufnahme 25.09.2026, 20:41–20:46 UTC, lesend und nicht atomar.
Groessen sind `stat().st_size` beim Inventar, keine Schaetzung nach Tokens.
Alle Pfade unten sind Schablonen; `$HOME` bezeichnet das lokale Benutzerverzeichnis.
Keine Prompts, Antworten, Argumentwerte oder Dateiinhalte werden hier wiedergegeben.
Die zwoelf Belege unten sind anonymisiert, keine Slot- oder Task-Betriebsinventur.

| Rang | Gemessener Befund | Kosten / Konsequenz |
|---|---|---|
| 1 | Claude, Codex und pi-zai: je 3/3 Stichproben mit Session-ID + cwd + Task + exakter Occupation im erhaltenen Report. Pi: 3/3 mit Lane, Task und Audit-Slotfenster, 0/3 mit erhaltenem exaktem `openedAt`. | Historische Occupation darf bei Pi nicht erfunden werden; ein dauerhafter Bindungsbeleg fehlt dort. |
| 2 | Codex: 221 von 341 aeusseren Calls heissen `exec`; deren Eingabe ist Code. | Ein aeusserer Call kann mehrere Werkzeuge/Dateien umfassen; AST-Extraktion allein beweist deren Ausfuehrung nicht. |
| 3 | Direkte Schreibwerkzeuge: Claude 6 von 467 Calls, Pi 28 von 233, pi-zai 21 von 369. Shell-Aufrufe: 439, 144 und 338. | `files[]` aus Schreibwerkzeugen allein hat erhebliche unbekannte Abdeckung; Shell ist nicht pauschal Schreiben. |
| 4 | Identitaetsbestaetigte Hauptdateien belegen insgesamt rund 5,46 GB; Codex-p90 6.922.737 B. | Kein Vollscan pro UI-Poll; einmaliger Aufbau plus inkrementelles Lesen und Detailabruf. |
| 5 | Alle 1.410 Calls der Stichprobe haben ein Ergebnis mit passender ID; eine allgemeine strukturierte Laufzeit fehlt. | Paarbarkeit reicht fuer Zeitabstaende, nicht fuer belastbare Tool-Laufzeiten oder vollstaendige Hintergrundjobs. |

Das sind Existenzbelege, keine zufaellige Qualitaetsstichprobe. Drei Dateien pro Adapter
wurden aus den erhaltenen Bindungen gewaehlt, fuer Pi aus den juengsten drei
Task-belegten Lane-Verzeichnissen. Nicht gelesen: fremde Hosts, Container-Homes,
geloeschte Dateien, andere Provider-Homes, saemtliche Transkriptinhalte des Bestands,
Claude-/Codex-interne Loeschimplementierungen. Pi-Installationsdoku wurde lokal gelesen.

## 2. Quellen und sicherer Join

| Harness | Lokale Quelle | Identitaet und Codebeleg |
|---|---|---|
| claude | `$HOME/.claude/projects/<cwd-ersetzt>/<sessionId>.jsonl` | `projDir` ersetzt jedes nicht-alphanumerische cwd-Zeichen durch `-` (`server.ts:5127`). Gepinnte Datei via `transcriptFile` (`server.ts:18072`); zusaetzlich `sessionId` und `cwd` in den Records pruefen, weil der Slug verlustbehaftet ist. |
| codex | `$HOME/.codex/sessions/YYYY/MM/DD/rollout-<zeit>-<id>.jsonl` | Konfigurierbarer Root `FLEET_CODEX_SESSIONS_DIR` (`server.ts:193`). Dateisuffix = `session_meta.payload.id`, dazu `cwd`, `timestamp`, `thread_source`; User-Thread von Subagent unterscheiden (`server.ts:5982`). |
| pi | `$HOME/.pi/agent/sessions/--<physischer-cwd-slug>--/<zeit>_<id>.jsonl` | Dateisuffix plus erster Record `type:session`, `id`, `cwd`; genau ein Treffer, sonst unknown (`server.ts:36711`). |
| pi-zai | `$HOME/.config/claude-fleet/pi-zai-agent/sessions/--<physischer-cwd-slug>--/<zeit>_<id>.jsonl` | Eigener Root, ggf. `FLEET_PI_ZAI_AGENT_DIR` (`server.ts:782`); gleicher Headerbeweis durch `isolatedPiContextFile` (`server.ts:36754`, `:36766`). |

**Join-Reihenfolge:** erhaltenes `fleet.json.slots` oder
`fleetReports.worker{sessionId,cwd,slot,openedAt,branch}` und
`fleetReports.provenance.taskId` -> genau passende Sessiondatei -> Header/Records
gegenpruefen -> Branch/Task mit Outcome verbinden. `slot` allein ist wiederverwendbar;
`cwd` allein kann mehrere Sessions enthalten. Weder mtime noch „neueste Datei“
sind ein historischer Identitaetsbeleg. Der Claude-Legacy-Fallback fuer ungepinnte
Panes (`server.ts:18093`) ist deshalb keine Trace-Zuordnungsregel.

Codex bindet initial erst nach dem ersten Prompt: cwd, User-Thread,
Startfenster und Ausschluss bereits anderweitig gepinnter IDs; nur genau ein
Kandidat wird gebunden, mehrere ergeben `ambiguous`
(`server.ts:6040`, `:6153`). Spaeter liest der Resolver nach UUID-Suffix
(`server.ts:36840`). Fuer einen neuen Index den Header erneut validieren und doppelte
UUID-Dateien als mehrdeutig ausweisen, statt den ersten sortierten Treffer zu erben.

### Zwoelf echte Lane-Belege, ohne Rohkennungen

Die Bytegroesse dient als anonymisierter Stichproben-Selektor im gemessenen Bestand.
Je Zeile wurden genau eine Sessiondatei, der passende Dateisuffix und cwd bestaetigt.
Fuer Claude wurde die Identitaet ueber **alle** Records der jeweiligen Datei geprueft:
jeweils eine Session-ID und ein cwd. Codex: 3/3 `thread_source:user`.
Pi und pi-zai: je 3/3 Header-ID und Header-cwd passend.

| Beleg | Sessiondatei B | Belegtraeger fuer Task/Lane | exakte Occupation `slot+openedAt` | Dateitreffer |
|---|---:|---|---|---:|
| C1 | 2.936.021 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| C2 | 3.151.302 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| C3 | 3.413.269 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| X1 | 1.674.337 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| X2 | 1.279.292 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| X3 | 3.232.000 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| P1 | 1.733.875 | Header-cwd -> Outcome-Branch + `taskId`, Audit `slot_open` | unknown; 1 Slotfenster | 1 |
| P2 | 641.139 | Header-cwd -> Outcome-Branch + `taskId`, Audit `slot_open` | unknown; 1 Slotfenster | 1 |
| P3 | 770.321 | Header-cwd -> Outcome-Branch + `taskId`, Audit `slot_open` | unknown; 1 Slotfenster | 1 |
| Z1 | 671.890 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| Z2 | 801.211 | erhaltener Report, `worker` + `provenance` | ja | 1 |
| Z3 | 663.129 | erhaltener Report, `worker` + `provenance` | ja | 1 |

Pi: in jedem der drei cwds liegt genau eine Pi-Sessiondatei. Die drei Starts liegen
am 23./24.08.; jeder Outcome nennt Harness `pi` und eine Task. In den drei
Auditgenerationen existiert jeweils genau ein `slot_open` fuer den cwd.
Das rekonstruiert das Fenster nach `laneSlotWindows` (`server.ts:28351`),
aber **nicht** den Occupation-Schluessel: `openedAt` wird vorher gesetzt
(`server.ts:7829`), `slot_open.ts` spaeter geschrieben (`server.ts:7891`).
Die Gleichsetzung dieser Uhren waere eine erfundene Identitaet.

Im gelesenen Report-/Slotbestand gab es 20 passende Claude-, 23 Codex-,
0 Pi- und 4 pi-zai-Sessiondateien. Das ist nur die erhaltene Auswahlmenge,
keine globale Zuordnungsquote. Der dauerhafte Report-Ledger schreibt weder
`sessionId` noch `cwd`/`openedAt` (`server.ts:11399`); der State-Tail wird
beschnitten (`server.ts:11414`). Lane-Sitze helfen bei Nachfolgen, werden aber beim
neuen Oeffnen zurueckgesetzt (`server.ts:7856`). In 929/929 gelesenen Land-Notizen
steht `branch`, in 0/929 `taskId`, `sessionId`, `slot` oder `openedAt` als Top-Level-Feld.
Land-Notizen allein schliessen die Session-Kette folglich nicht.

## 3. Felder und Tool-Call-Messung

Alle Records der zwoelf Stichprobendateien wurden JSON-geparst. Paarung stets
innerhalb derselben Session; keine globale Map nackter Call-IDs.

| Messwert | Claude | Codex | Pi | pi-zai |
|---|---:|---:|---:|---:|
| Dateien | 3 | 3 | 3 | 3 |
| Calls / Ergebnisse / gepaarte IDs | 467 / 467 / 467 | 341 / 341 / 341 | 233 / 233 / 233 | 369 / 369 / 369 |
| Calls mit Record-Zeit | 467 | 341 | 233 | 369 |
| Fehlende Ergebnisse / verwaiste Ergebnisse | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Nicht parsebare Zeilen | 0 | 0 | 0 | 0 |
| Ergebnis-Payload B | 1.204.006 | 892.765 | 1.791.466 | 597.337 |

Ergebnisgroesse: String als UTF-8, Nicht-String als kompaktes JSON mit
unescaped Unicode. Gemessen wurden Claude `content`, Codex `output`, Pi
`message.content`, ohne JSONL-Envelope, `details` oder externe Outputdatei.
Diese Definition ist reproduzierbar, aber nicht die urspruengliche ungekappte Ausgabe.

| Eigenschaft | Claude | Codex | Pi / pi-zai |
|---|---|---|---|
| Name / Argumente | `message.content[].type:tool_use`, `name`, `input`, `id` | `response_item.payload.type:function_call/custom_tool_call`, `name`, ggf. `namespace`, `arguments` bzw. `input`, `call_id` | `message.content[].type:toolCall`, `name`, `arguments`, `id` |
| Ergebnisjoin | `tool_result.tool_use_id`, `content`, `is_error` | `function_call_output/custom_tool_call_output.call_id`, `output` | `message.role:toolResult`, `toolCallId`, `toolName`, `content`, `isError`, `details` |
| Zeit | Record `timestamp`; `uuid`, `parentUuid` fuer Struktur | Record `timestamp`; `session_meta` und `turn_context` fuer Einordnung | Record `timestamp`, `id`, `parentId`; zusaetzlich `message.timestamp` |
| Dateikandidaten | `Write/Edit.input.file_path`; optional `toolUseResult.filePath/structuredPatch/bashEditDiff` | aeusseres `exec.input` ist Code; Patch-/Shell-/verschachtelte Werkzeugargumente darin, kein allgemeines `files`-Feld | `edit.arguments.path`, `edits`; bei Erfolg teilweise `details.diff/patch/firstChangedLine` |
| Dauer | kein allgemeines Dauerfeld gefunden | kein allgemeines strukturiertes Dauerfeld im aeusseren Envelope gefunden | `details.executionTime` in 4/233 Ergebnissen bei Pi, 0/369 bei pi-zai; keine allgemeine Laufzeituhr |

Claude: sechs `Write/Edit`-Calls, sechs Ergebnisse mit `filePath` und
`structuredPatch`, 56 mit `bashEditDiff`. Pi: 28 `edit`, 25 Ergebnisse mit
`diff/patch`; pi-zai: 21 `edit`, 18 Ergebnisse mit `diff/patch`. Das sind
**keine** Zaehler unterschiedlicher geschriebener Dateien. Fehlschlag, relativer
Pfad, cwd-Wechsel und spaeteres Rueckgaengigmachen muessen getrennt bleiben.

Codex: 221 `exec`, 102 `sleep`, 18 `wait`; keine unabhaengige flache Liste der
inneren Tool-Calls in den gezaehlten `response_item`-Paaren. Der Name im Index muss
Namespace mittragen. Ein Code-String ist geplante Ausfuehrung, kein Systemcall-Protokoll.
Ausgabe-Text kann Laufzeit oder geschriebene Dateien melden, das ist kein
harnessuebergreifendes strukturiertes Feld.

`result.timestamp - call.timestamp` ist als **beobachteter Abstand** ableitbar,
inklusive Scheduling, Queue und Hintergrundstart; nicht als exakte Tool-Dauer.
Ein Sleep-Argument oder Timeout ist ebenfalls keine gemessene Dauer.
Claude: vier Ergebnisse mit `persistedOutputSize`; Pi: vier mit `truncation`,
drei mit `fullOutputPath`. Externe Ausgabe muss optional nachgeladen und ihr Fehlen
benannt werden. Kompaktierte/abgeschnittene Ausgabe ist nicht vollstaendige Evidenz.

## 4. Horizont, Groessen und Aufbewahrung

Inventar: Claude `projects/*/*.jsonl`, Codex `sessions/**/*.jsonl`, Pi und pi-zai
je `sessions/*/*.jsonl`. Unteragent-Unterverzeichnisse bei Claude sind ausgeschlossen;
Codex umfasst auch Subagent-Rollouts und Sitzungen ausserhalb von Lanes.
Fuer Identitaet wurde pro Datei bis zu 60 Zeilen nach dem passenden Record gelesen;
bei Codex/Pi ist das der Header. Keine Rekonstruktion geloeschter Sessions.
p90 ist nearest-rank `sort(bytes)[ceil(0,9*n)-1]`, Median der mittlere Wert bzw.
das Mittel der zwei mittleren Werte. Keine Gewichtung nach Nachrichtenanzahl.

| Quelle / bestaetigte Sessiondateien | n | Summe B | Median B | p90 B | aeltester beobachteter Sessionzeitpunkt UTC |
|---|---:|---:|---:|---:|---|
| Claude, Dateiname = Record-Session-ID | 1.664 | 2.276.921.653 | 675.719,5 | 3.023.780 | 2026-08-26 08:12:14 |
| Codex | 807 | 3.035.706.257 | 1.624.715 | 6.922.737 | 2026-08-08 09:41:17 |
| Pi | 77 | 56.143.976 | 641.139 | 1.294.139 | 2026-08-07 14:41:37 |
| pi-zai | 185 | 95.096.349 | 421.181 | 1.023.091 | 2026-08-15 11:05:44 |

Claude-Rohinventar: 2.185 Dateien, 2.281.194.557 B; Median 121.707 B,
p90 2.731.830 B. Davon 520 ohne Session-ID/cwd im untersuchten Bereich
(nachgelesen: maximal sieben Zeilen je Datei, vorwiegend Sessionmetadaten),
eine weitere Datei mit abweichendem Dateiname/Record-ID. Diese 521 Dateien
sind keine bestaetigten zusaetzlichen Sessions. Der Rohdatei-Median waere deshalb
als Session-Median irrefuehrend. Eine Datei im Rohinventar heisst nur `.jsonl`.

Zweite Grundgesamtheit, **Lane-cwd-Kandidaten**, nicht bestaetigte Fleet-Tasks:
Header/Record-cwd enthaelt `.worktrees/`. Das kann andere Repos oder Neben-Sessions
einschliessen und ist nur ein expliziter Groessenfilter.

| Quelle | Dateien / unterschiedliche cwds | Summe B | Median B | p90 B | aeltester Lane-Kandidat UTC |
|---|---:|---:|---:|---:|---|
| Claude | 578 / 531 | 1.290.714.007 | 1.475.610,5 | 5.068.035 | 2026-08-26 18:06:32 |
| Codex | 386 / 226 | 1.084.464.653 | 1.557.534,5 | 6.385.587 | 2026-08-08 09:43:25 |
| Pi | 54 / 53 | 42.381.873 | 766.787,5 | 1.231.203 | 2026-08-08 04:44:44 |
| pi-zai | 161 / 155 | 84.549.166 | 421.380 | 1.046.431 | 2026-08-16 09:40:36 |

**Horizont ist beobachteter Bestand, keine garantierte Retention.** Claude:
`cleanupPeriodDays` fehlt in der gelesenen lokalen `settings.json`; der etwa
30 Tage alte Beginn beweist weder eine Frist noch lueckenlose Historie. Effektive
Default-Loeschregel und geloeschte Menge unknown. Codex: lokales
`archived_sessions`-Verzeichnis nicht vorhanden; Rotation/Loeschfrist unknown,
kein Beweis unbegrenzter Aufbewahrung. Pi/pi-zai: installierte Version 0.85.0,
`@earendil-works/pi-coding-agent/docs/session-format.md:13` und
`docs/sessions.md:48` dokumentieren manuelles Loeschen und, wenn verfuegbar,
Papierkorb via `trash`; automatische Loeschfrist unknown. Die lokale Versionsangabe
beweist nicht die Writer-Version jeder alten Datei.

Fleet-Ledger-Rotation ist ein anderer Horizont: 5.000.000-B-Schwelle
(`server/persist.ts:6`), aktive Datei -> `.1`, vorige `.1` -> `.archive`
(`server/persist.ts:39`). Der Zweigenerationenleser liest nur `.1` und aktiv
(`server/persist.ts:109`). Ein vollstaendiger Trace muss alle vorhandenen Generationen
beruecksichtigen und pro Quelle fehlende/malformed/abgeschnittene Daten ausweisen.
Weder Ledger-Retention noch Report-Tail garantieren die Existenz der Rohsession.

## 5. Abbildung auf TraceEvent und Schnitt T1/T2

Vorschlag, kein implementiertes Schema: Plan `TraceEvent{source,kind,at,refs,files,detailRef}`
aus `docs/overhaul-plan-2026-09-25.md:257` bleibt die duenne Timeline-Projektion.

| Feld | Passt hinein | Grenze / notwendiger Detaildatensatz |
|---|---|---|
| `source` | harnessspezifischer Session-Quelltyp | eigener Root/Host und Formatversion im Quellenkatalog; kein privater absoluter Pfad auf dem Draht |
| `kind` | `tool.call`, `tool.result`, `file.write.observed`, `commit` | Versuch, Erfolg, Hintergrundstart und Commit nicht zusammenziehen |
| `at` | geparster Record-Zeitpunkt | fehlender Zeitpunkt = unknown, nicht mtime; Abstand/Dauer getrennt |
| `refs` | bestaetigte Task, Slot, Branch; SHA nur aus Git-Beleg | bestehendes `{task,slot,branch,sha}` hat weder Session-ID noch `openedAt`, Call-ID oder Elternbezug; diese im adressierten Detail/Bindungsindex halten, bei Abfragen als explizite typisierte Erweiterung planen |
| `files[]` | normalisierte repo-relative, beobachtete Dateikandidaten | leere Liste bedeutet unbekannt/kein belegter Pfad, nicht „nichts geschrieben“; Basis und Evidenzgrad im Detail |
| `detailRef` | opaker stabiler Locator zu Quelle + Session + Zeile/Block bzw. Bytebereich | Dateirevision/Fingerprint und Call-ID sichern; Rewrite, Rotation oder Loeschung duerfen keinen anderen Inhalt unter demselben Zeiger liefern |

**T1 zuerst:** gemeinsame native Eventleser fuer alle vier Quellen mit getrennten
Adaptern; bestehende Resolver wiederverwenden, aber nicht die fuer Chat gekuerzten
`TEntry`-Inhalte. Der aktuelle Codex-Chatleser kuerzt Argumente auf 600 Zeichen
und uebernimmt keine Call-ID in den Toolblock (`server/conversation-read.ts:100`).
Pi-Chat zeigt nur den aktiven Elternpfad (`server/conversation-read.ts:118`);
Full-Trace muss auch verlassene Aeste mit `id/parentId` erhalten und kennzeichnen.
Sessions derselben Lane und echte Subagent-Sessions separat verknuepfen,
nicht gleiche cwds zu einer Unterhaltung verkleben.

Einmaliges Inventar und persistierte Cursor pro Datei; neue vollstaendige Zeilen
inkrementell einlesen, letzte angeschnittene Zeile erneut lesen. Bei Shrink/Rewrite
invalidieren. Ergebnisjoins duerfen spaeter eintreffen. Detailabruf getrennt,
begrenzt und nur auf autorisierte lokale Quelle; kein frei waehlbarer Dateipfad
und keine Volltexte im Timeline-Poll. Dauerhafte Bindungsreceipts zukuenftig bei
bekannter Occupation erfassen; alte Luecken bleiben unknown, ohne mtime-Backfill.

**T2 danach:** spezifische Parser fuer direkte Schreib-/Edit-/Patch-Werkzeuge,
Ergebnisstatus und cwd-Normalisierung. Shell/`exec` bleiben bei fehlendem
strukturiertem Beleg `unmeasured`. Git-Diff mit Status fuer Anlegen/Aendern/Loeschen/
Umbenennen liefert den beobachteten Commit-Dateisatz; Commitzeit ist keine genaue
Schreibzeit und kein Beweis des verursachenden Calls. Ein Systemcall-/Watcher-Protokoll
waere ein eigener spaeterer Auftrag, nicht stillschweigend Teil dieser Projektion.

Abnahme fuer den Bau: je Harness Positivfixture plus falsche UUID/cwd und doppelte
Datei als Reject; wiederverwendeter Slot; fehlender Report; nachlaufendes Ergebnis;
angeschnittene letzte Zeile; geloeschte Quelldatei; Pi-Astwechsel; Codex-`exec` mit
mehreren inneren Aufrufen ohne erfundene Einzelereignisse; fehlgeschlagener Edit
setzt kein bestaetigtes Schreiben. Rohdaten dabei synthetisch, keine Privattranskripte
als Testfixtures. Kein neuer UI-/T4-Bau in diesem Schnitt.

## 6. T3: Welche Eingabe braucht Jev?

T3 braucht mehr als Toolname und Pfad. Vorschlag fuer einen kleinen, versionierten
lokalen Klassifikationsdatensatz: bestaetigter Taskzweck und Schreibscope,
Toolname/Namespace, begrenzte redigierte Argumentstruktur, Ergebnisstatus und
belegte Dateiaenderung, unmittelbarer Vorher-/Nachher-Kontext sowie IDs der
relevanten Konzepte. Der Code stellt Bedeutungsoptionen, z.B. Lesen, Aendern,
Verifizieren, Warten, Berichten und **nicht bestimmbar**, samt Definitionen bereit.
Ein aeusserer Codex-`exec` darf mehrere Bedeutungen oder unknown haben.
Jev waehlt unter diesen Optionen; kein Gate und keine erfundene kausale Zuordnung.

Nur Feldnamen/Zaehler wie in dieser Notiz reichen fuer semantische Bedeutung
nicht: zwei gleich geformte Shell-Calls koennen voellig andere Ziele verfolgen.
Vor einem Aufruf sind daher Auswahl/Redaktion der Inhalte, erlaubte Verarbeitung,
Konzeptversion und eine unabhaengig gelabelte deutsche Stichprobe zu klaeren.
Hier wurden keine Inhalte an Jev oder andere externe Dienste gesendet und keine
Genauigkeit gemessen. Urteil mit Eingabereferenz, Optionsversion und Modellversion
speichern; unbekannte Evidenz bleibt auch bei eindeutiger Klassifikation unbekannt.

| Oberflaeche / Adapter | Entscheidung fuer den vorgeschlagenen Schnitt |
|---|---|
| claude, codex, pi, pi-zai | apply: native lokale Quellleser; obige Unterschiede explizit |
| pi-ox und Container | not-applicable fuer diese Messung; deren Zugriff/Bestand nicht vermessen, keine Coverage behaupten |
| Server / Reverse-State | apply: Identitaetsjoin, Cursor, Quellenhorizont, begrenzter Detailabruf |
| Protokoll / Wire | apply: duennes TraceEvent plus adressiertes Detail und unbekannte Bindungen |
| Client | T1/T2-Datenvertrag apply; neue Full-Trace-Seite not-applicable, T4 separat |
| Docs / Probes | apply: diese Messung und genannte deterministische Negativfaelle |
| Exakte Laufzeit, alle inneren Codex-Calls, alle Shell-Schreibeffekte | unsupported aus diesen Rohquellen allein |

## 7. Erweiterung T5–T9: Ereignisse, Kommunikation und damalige Sicht

Zusaetzlicher Messschnitt 25.09., 20:50–20:51 UTC. Datei-Bytes sind physische
JSONL-Groessen; State-Teilgroessen sind jeweils UTF-8 von kompaktem JSON der
Eintragsliste, ohne umgebendes `fleet.json`. Das sind unterschiedliche Zaehler,
nicht addierbare Speicherkosten. Ein aeltester erhaltener Eintrag beweist keine
lueckenlose Historie bis heute. Offene Quellenluecken heissen hier **UNGEMESSEN**.

### T5 — jeder Fleet-Report samt Art

**Heute: ja fuer Report-Eroeffnung und Entscheidung seit Ledgerbeginn; teilweise
fuer vollstaendige historische Identitaet und Zustellung.**
`server.ts#ledgerReportOpen:11399` schreibt `kind:open`, `status`, `basis`,
`taskId`, `programId`, `slot`, `branch`, `text`, `at`;
`ledgerReportDecision:11405` schreibt die getrennte Entscheidung mit `disposition`.
Die vier Reportarten stehen in `src/protocol.ts:39`: `complete`, `needs-main`,
`failed`, `handoff`. „Terminal“ ist keine fuenfte Reportart, sondern eine
Lebenszyklus-/Prune-Eigenschaft (`server.ts:11414`). Status, Entscheidungsart und
Transportzustand brauchen getrennte Felder im Detail.

Quelle/Ort: `fleet-reports.jsonl`, zusaetzlich `fleet.json.fleetReports`,
`events` und Program-Inbox fuer Zustellung/Lesebestaetigung.
Gemessen: 1.267 Ledgerzeilen, 1.968.711 B, aelteste `at` 14.09. 12:58:44 UTC;
639 Eroeffnungen und 628 Entscheidungen. Eroeffnungen nach Art:
511 complete, 97 needs-main, 31 handoff, 0 failed in diesem Bestand.
Null failed sagt nichts ueber die erlaubte Art aus. Rotation wie §4.
Die fehlenden historischen Session-/Occupation-Felder aus §2 bleiben bestehen;
die Inbox bewahrt einen Zeiger, nicht automatisch den ganzen Reportinhalt.

### T6 — gerichtete Kommunikation und Akteure

**Heute insgesamt: teilweise.** Richtungen sind auf spezialisierten Tueren oft
belegbar, aber `source:owner`, Authentifizierung und Zustellpfad beweisen nicht,
dass ein Mensch statt einer Session gesendet hat. Die S2-Synthese
(`docs/messungen/2026-09-25-overhaul-s2-rechte-synthese.md:29`) wurde dazu gelesen;
entscheidend fuer diese Notiz sind die folgenden Schreiber/Resolver.

| Kante / Quelle und Ort | Heute / Akteursbeleg | Erhaltener Horizont und Groesse |
|---|---|---|
| `/send` -> Empfaenger-Occupation; `streams/prompts.jsonl`, `server.ts#logPrompt:5162`, `#auditSend:8589` | teilweise: Journal traegt Empfaenger `slot,cwd,openedAt,sessionId`, `source,text`, optional `sendId,delivery`; Audit traegt `path,bytes,acceptance`. Owner-Route stempelt `source:owner` (`server.ts:43233`), keinen sessiongebundenen Sender. | Promptjournal: 20.630 Zeilen, 36.339.052 B, ab 05.07. 15:38 UTC; Schreiber appendet ohne eigene Rotation (`server.ts:5173`). Audit alle drei Generationen: 95.082 Zeilen, 12.035.801 B, ab 21.07. 18:15 UTC. Das sind gemeinsame Traeger, nicht nur `/send`. |
| Zustellkopf / `server.ts#deliveryHeader:8536` | teilweise: `source,path,slot` sind Transportprovenienz. Kopf nur fuer Standard-Claude unter den genannten Guards, kein universeller Senderaktor und kein eigenes Inhalts-Ledger. | Kein eigener Bytezaehler; Bestandteil zugestellter Inhalte, sofern erhalten. Separater Kopf-Horizont UNGEMESSEN. |
| Lane -> MAIN: Report; Lane <-> MAIN: Clarification; `fleet.json.clarifications`, `server.ts#openClarification:11177`, `#replyClarification:11674` | ja im erhaltenen Record: `worker`, `receiver`, `provenance`, `askedAt`, Antwort und `eventId`; teilweise historisch wegen Prune. | 20 Clarifications, 54.497 B, ab 20.08. 16:49 UTC; maximal 20 terminale Eintraege (`server.ts:10797`). Reportgroesse siehe T5. |
| MAIN -> Owner -> MAIN: Attention; `fleet.json.attentionRequests`, `server.ts#openAttention:14322`, `#answerAttention:14525` | teilweise: gebundener Requester und Antwortrolle `by:owner`; letztere ist keine unabhaengige Personenattestation. Antwort wird ueber Inbox erreichbar, Zustellung/Lesen gesondert. | 20 Eintraege, 23.879 B, ab 25.09. 10:40 UTC; maximal 20 terminale Eintraege (`server.ts:12456`). |
| Program/gebundener Supervisor <-> Program/gebundener Supervisor: Messages; `fleet.json.messages`, `server.ts#messageSenderFor:12987`, `#appendMessage:2245` | ja fuer adressierte Prinzipalkante: `from,to,replyTo,at,readBy,readAt`; `from` wird aus Bindung abgeleitet. Lane als Sender abgewiesen. Controller/Orchestrator ist heute keine aufloesbare Rollenadresse (`server.ts:13026`); nur dessen Program-Adresse, falls gebunden. | 34 Eintraege, 52.054 B, ab 12.09. 12:55 UTC; Cap 200 (`server/types.ts:2789`). Eine Prinzipalkante ist noch kein Nachweis der damals sendenden konkreten Occupation. |
| Inbox -> gebundene MAIN; `fleet.json.programs[].inbox`, `server.ts#readProgramInboxEntry:12955` | teilweise: `kind,ref,at,readBy,readAt`; GET setzt keinen Lesestempel, explizites POST tut es. Inhalt des referenzierten Objekts kann fehlen. | 526 Eintraege ueber Programme, 122.979 B, ab 09.09. 17:53 UTC; Cap 100 je Program (`server/types.ts:2668`). |
| Watch/Sensor -> Empfaenger; `fleet.json.watches/events`, `server.ts#pruneFleetEvents:10783` | teilweise: Watch-/Event-ID, Subject und Receiver-Occupation, `createdAt,deliveredAt,acknowledgedAt`; nicht als menschliche Nachricht umetikettieren. Pruning verliert historische Payloads. | Watches 31 / 8.964 B, ab 23.09. 19:24 UTC; Events 138 / 112.793 B, ab 07.09. 18:55 UTC. Terminalcaps `server.ts:4945`, `:4966`; kein fester Tageshorizont. |

Damit ist Lane<->MAIN ueber fachliche Tueren erkennbar; eine beliebige direkte
Sessionkommunikation ueber `/send` ist **keine** vollstaendig aktorierte Kante.
Rolle aus Label/Text raten oder die verwendete Credential als Aktor ausgeben
waere falsch. Fuer neue Kanten benoetigt S2 den aufgeloesten Senderaktor,
Empfaenger-Occupation, Send-/Reply-ID und Transportpfad als getrennte Fakten.

### T7 — Profil, Gruendung und Aufbau

**Heute: teilweise.** Quelle `context-receipts.jsonl`, Schreiber
`server.ts:15617` fuer Lane-Gruendung; `fleet.json.slots/programs`,
`lineageHandovers`, `laneSeats`, Promptjournal und native Sessionmetadaten ergaenzen.
Receipt-Bestand: 1.288 Zeilen, 2.437.943 B, ab 14.08. 08:36 UTC.
`harness,model,effort,selected,hash` in je 1.288 Records (Vorhandensein bedeutet
nicht nicht-null); `briefHash` in 1.226, `snippet` in 528;
Top-Level `role,binding,sessionId,openedAt` in jeweils 0.

Der Schreiber hasht Ankerblock und ausgewaehlte Planfakten, nicht den gesamten
historischen Inhalt aller referenzierten Dateien (`server.ts:15610`).
`selected/omitted`, Repo-HEAD und Renderer helfen der Rekonstruktion; ein ContextPlan
beweist Auswahl/Zustellung, nicht tatsaechliches Lesen. Gruendungsbrief als gesendeter
Text liegt zusaetzlich im Promptjournal: dessen Horizont/Groesse siehe T6.
Ein Hash ersetzt weder Inhaltskopie noch die damaligen ungetrackten Quellen.

Aktuelles Profil wird in `stateSnapshot` persistiert (`server.ts:5247`), ist aber
kein lueckenloses Aenderungsjournal fuer Modell/Effort/Rolle. Nachfolge:
`lineageHandovers` 17 Records, 37.689 B, ab 18.09. 09:08 UTC;
Lane-Sitze werden gesondert begrenzt und beim Neuoeffnen zurueckgesetzt (§2).
Program-Bindungen/-Linien sind zusaetzliche Records, keine aus diesen 17 Zeilen
ableitbare Vollabdeckung. Vollstaendiger historischer Profil-/Packinhalt und dessen
separate Bytes/Tag: **UNGEMESSEN**. T7 muss Gruendung, Profilwechsel, Bindung und
Nachfolge als unterschiedliche Ereignisse samt unveraenderlicher Quellreferenz zeigen.

### T8 — damals gelesene Datenschichten mit Inhalt

**Heute: nein als allgemeines serverseitiges Antwortjournal; teilweise zufaellig
im Tool-Ergebnis.** Gelesene GET-Pfade: `/api/self/memory`
(`server.ts:38666`), `/api/self/program-execution` (`:38653`) und
`/api/self/inbox` (`:38841`). Sie liefern berechnete Projektionen;
`server/http.ts:6` serialisiert die Antwort ohne Inhalts-Ledger.
Explizite Inbox-Read-Receipts dokumentieren einen Leseakt, nicht die Antwortbytes.
Native Tool-Ergebnisse koennen eine damals ausgegebene Antwort enthalten,
koennen aber auch nur Auszuege, Dateiumleitungen oder gekappte Ausgabe enthalten.
Aus einem Shellkommando mit URL folgt weder erfolgreicher Aufruf noch voller Body.

`state-snapshots.jsonl` ist kein Ersatz: `server.ts#buildStateSnapshot:35892`
schreibt Zustandszaehlungen und Lane-Sensoren, keine pro Request ausgelieferte
Antwort. Gemessen: 4.594 Samples, 4.012.314 B, ab 22.09. 15:55 UTC;
Aktivdatei, Rotation wie §4. Die fruehere Antwort kann daraus nicht exakt
rekonstruiert werden. Historischer Antwortinhalt-Horizont: **UNGEMESSEN**.

Drei echte lesende Einzelaufrufe der eigenen Memory-Sichten lieferten HTTP 200:
`work` 1.709 B, `sources` 4.392 B, `evidence` 1.441 B, zusammen 7.542 B.
Das sind drei Response-Body-Groessen, kein Tagesmittel. Program-Execution ist fuer
eine Lane gesperrt und wurde nicht als fremde MAIN aufgerufen.
Vollstaendige echte Aufrufzahlen pro Tag fehlen fuer die untersuchten GETs;
`self_drift`, Inbox-Receipts oder URLs in Prompts sind kein Ersatzzaehler.
**Schreiberkosten in Bytes/Tag deshalb UNGEMESSEN**, nicht null.

Vorschlag: pro Antwort ein Receipt mit Request-ID, aufgeloestem Aktor und
Occupation, Route/erlaubten Parametern, HTTP-Status, Start-/Antwortzeit,
Body-Bytezahl, Schema-/Serverrevision und Hash; Inhalt einmal unter Hash speichern,
separat vom Timeline-Index. SHA-256-Hash: 32 B binaer bzw. 64 ASCII-B-Zeichen,
zuzueglich Envelope und Index. Messformel fuer unkomprimierte Kosten:
Summe aller Receipt-Bytes + Summe der einmal gespeicherten Body-Bytes je Hash;
bei drei verschiedenen Bodies dieser Probe 7.542 B Inhalt + 192 B Hex-Hashes,
zuzueglich noch zu messender Envelopes. Deduplikation ist kein garantierter Gewinn,
weil `generatedAt` oder andere fluechtige Felder jeden Body aendern koennen.

Fuer den ersten Messbetrieb als **Vorschlag** sieben Tage Inhaltsretention mit
sichtbarem `retainedFrom/deletedAt`; dieser Horizont besteht heute nicht.
Danach Bytebudget anhand wirklicher Requestzaehler festlegen. Exakte Antwortbytes
und redigierte Ansicht brauchen getrennte Hashes/Referenzen; Credential-Header
gehoeren nicht in den Datensatz. Kein Schreiber wurde hier gebaut oder eingeschaltet.

### T9 — parallele Sessions auf gemeinsamer Zeitachse

**Heute: teilweise.** Auf diesem Mac stammen Fleet-Auditzeiten aus `Date.now()`
(`server/audit-log.ts:495`), Prompt-/Receipt-/Reportzeiten ebenfalls aus
Server-Wallclock-Schreibern (T5–T7). Native Records tragen ISO-Zeitstempel;
Pi zusaetzlich numerische `message.timestamp`. Die 1.410 Call-Records aus §3
sind zeitlich adressierbar. Aufloesung der Fleet-Felder: Unix-Millisekunden;
Darstellungsaufloesung ist keine gemessene Genauigkeit. Pi-Nachrichtzeit und
Recordzeit koennen verschiedene Ereignisphasen bezeichnen (§3).

Quellenhorizont und Bytevolumen sind die jeweiligen Tabellen §4/T5–T8;
die Swimlane selbst hat heute keinen separaten persistenten Traeger, ihre
zukuenftige Indexgroesse ist **UNGEMESSEN**. Fleet-Audit beginnt im gelesenen
Bestand am 21.07., Transkriptquellen spaeter; ein gemeinsamer Bildschirm darf
diese unterschiedlichen Horizonte nicht zu einem angeblich vollstaendigen Band glatten.

Fuer Records desselben Hosts sind Wallclock-Zeitpunkte vergleichbar, soweit keine
Uhrkorrektur vorliegt. Totale Ausfuehrungsreihenfolge folgt daraus nicht:
Batching, gleiche Millisekunde und nachtraegliches Schreiben bleiben moeglich.
Datei-/Recordfolge und Call-/Reply-IDs liefern zusaetzliche partielle Ordnung.
Server-Empfangszeit eines Helper-Resultats ist eine andere Uhrmessung als dessen
Ausfuehrungszeit auf Second-host. Second-host-Uhrversatz, NTP-Zustand, Drift und
Netzverzoegerung wurden **nicht gemessen**; cross-host Genauigkeit und
ueberlappende Intervalle nahe der Grenze deshalb **UNGEMESSEN**. Kein ungeprueftes
Mac/Second-host-Offset und keine angebliche Millisekunden-Synchronitaet angeben.

Vorschlag: Swimlane nach stabiler Session-ID plus Host und Occupation, nicht nach
Slotnummer. `occurredAt`, serverseitiges `observedAt`, Uhrquelle und unbekannte
Uhrunsicherheit getrennt halten. Nachrichten als gerichtete Kanten; gleiche
Zeitstempel deterministisch anzeigen, aber Gleichstand nicht als Kausalitaet ausgeben.
Uhrversatz erst durch eine benannte Cross-Host-Messung begrenzen; bis dahin
zeitliche Ueberlagerung als beobachtete Wallclock-Sicht kennzeichnen.

## 8. Erweiterter Schnitt und offene Grenze

T1/T2 aus §5 bleiben der erste Transkript-Schnitt. T5 und die bereits belegbaren
T6/T7-Ereignisse koennen parallel als **lesende Projektionen** derselben Timeline
modelliert werden; gemeinsame IDs/Detailreferenzen vermeiden doppelte Ereignisse
fuer Report, Inbox-Zeiger und Zustellung. Der heutige Chat-Export allein reicht
fuer keinen dieser Vollstaendigkeitsansprueche.

Naechster, eigener Schreiberschnitt: S2-Akteur an Kommunikationskanten,
dauerhafte Session-/Occupation-/Profilbindung, Inhaltsbeleg vor dem Prunen und
T8-Antwortreceipts mit Inhaltsablage. Vor Retentionsdimensionierung echte
Aufrufzahlen messen. T9 ist Teil des Datenvertrags ab Beginn (Host/Uhrquelle,
partielle Ordnung); die interaktive Swimlane bleibt T4. Probes ergaenzen um
Reportstatus versus Transportterminal, Actor versus Credential, verlorenen
Inbox-Zielinhalt, identische/differente Antwort-Hashes, Loeschhorizont und zwei
Hosts mit absichtlich verschobenen Uhren.

Offen: exakte historische Occupation der drei Pi-Belege, effektive
Claude-/Codex-Retention, historische Vollabdeckung der Kommunikationsakteure und
Profile, T8-Tageskosten, Cross-Host-Uhrgenauigkeit und semantische T3-Qualitaet.
Diese Grenzen sind explizit unknown/UNGEMESSEN; keine Ersatzwerte aus Annahmen.
