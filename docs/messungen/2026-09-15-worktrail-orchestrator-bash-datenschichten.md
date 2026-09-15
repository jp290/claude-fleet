---
frage: Welche Hand-Abfragen wiederholen die letzten drei Orchestrator-Sessions, und welche vorhandenen oder fehlenden Verben ersetzen sie?
urteil: 305 Bash-Aufrufe liefern 644830 Ergebnisbytes; drei abgegrenzte Abfrageketten betreffen 83 Aufrufe und 185900 Bytes. Vorrang haben Sessions/Auth, Task-Erklaerung und die lesbare vorhandene Deploy-Vorbedingung.
bereich: [datenlayer, worktrail, orchestrator, cli]
belege: [ctl.sh, state.sh, register.sh, server.ts#startPlanNow, server.ts#deployBlocker, card-extract.ts#validateCard]
nicht-gemessen: Ungeschwaerzte Originalbytes, interne Schleifen-Iterationen und HTTP-Bytes, tatsaechliche Wirkung vorgeschlagener Verben, weitere Orchestrator-Sessions.
stand: 2026-09-15
---

# Drei Orchestrator-Sessions: Bash und Datenschichten

## 1. Ergebnis und Reichweite

**305 Bash-Aufrufe, 644.830 UTF-8-Bytes in den zugehörigen Tool-Ergebnissen.**
Die wiederholte Erdung allein belegt 11 Aufrufe und 101.615 Bytes (15,8 % der Bash-Ergebnisse).
Die drei unten abgegrenzten Kandidaten betreffen zusammen **83 verschiedene Aufrufe / 185.900 Bytes**;
das ist ihr beobachteter Kostenbereich, keine bereits erreichte Ersparnis.

Die Abstraktion soll als gezielte, lesende Projektion existieren: Die Orchestratorin braucht
Antworten auf „wer arbeitet woran?“, „warum steht diese Zeile?“ und „was blockiert den Deploy?“;
die vorhandenen Fakten sollten dafür einmal mit ihren Quellen verbunden werden.
Ein neues persistentes Sammelregister ist dafür nicht begründet.

**Priorität:** (A) `ctl sessions` verwendet die vorhandene Authentifizierung und Slot-Projektion;
(B) `ctl task` verbindet Auftrag, Startplan und adressierbare Belege;
(C) `ctl deploy-status` zeigt dieselbe Vorbedingung, die der Deploy bereits prüft.
Die Karten in §6 sind Vorschläge, keine eingereichten oder freigegebenen Tasks.

Untersucht wurden die drei beauftragten, geschwärzten JSONL-Dateien vollständig maschinell,
die Bash-Kommandos nach Arbeitszweck und die relevanten Ergebnis-/Fehlerstellen inhaltlich.
Zum Abgleich gelesen: die unten zitierten Bereiche von `ctl.sh`, `state.sh`, `register.sh`,
`server.ts`, `start-plan.ts`, `card-extract.ts`, `docs/self-api.md`, `docs/controller.md`,
`e2e/ctl.ts`, `e2e/deploy-facts.ts` sowie die beiden beauftragten Vorarbeiten.
Der Messnotizen-Index enthält die Vorarbeiten; er wird hier nicht geändert.
Codebasis: **`db02cc40b6fbaf82e0c35883f7decbc85bc2cdc0`**.
Graphify lieferte Einstiegspunkte, aber einen gekürzten Graph-Ausschnitt; Belege sind die gelesenen Quellen.

**Nicht geöffnet:** `fleet.json`, `.env`, fremde Prozess-Kommandozeilen oder weitere Originaltranskripte.
Die Erwähnungen dieser Quellen unten stammen aus den geschwärzten Transkripten und dem Quellcode.
`ctl.sh` wurde ohne Argument mit gesetztem `FLEET_CTL_URL` und leerem Scratch-Home ausgeführt;
damit kam nur die Verbliste, ohne `.env`-/State-Lesung. Keine historische Shell-Zeile wurde ausgeführt.
Der globale Knowledge-Index war am vorgegebenen Pfad nicht vorhanden; die genannten Projektquellen
tragen die Analyse. Die erste vollständige Schichten-Notiz dient der Abgrenzung, nicht als heutiger Sensor.

## 2. Messdefinition und Sessions

- **Sessionfenster:** Minimum/Maximum aller vorhandenen obersten `timestamp`-Felder der jeweiligen Datei,
  einschließlich System-/Hook-Zeilen; keine aktive Arbeitszeit. Datei-Suffixe „bis 17:29/18:25“ sind keine Messuhren.
  Die Sessions überlappen geringfügig. Die vorangestellte Dateizeile hat teilweise keinen Zeitstempel.
- **Aufruf:** ein `assistant.message.content[]`-Block vom Typ `tool_use`; Toolnamen werden exakt gezählt.
  Ergebnisse: `user.message.content[]`, Join über `tool_use_id`. Es gibt keine doppelten Aufruf-IDs,
  keine fehlenden oder mehrfachen Ergebnisse und keine verwaisten Ergebnisse in diesen Dateien.
- **Bytes:** `len(tool_result.content.encode('utf-8'))` nach JSON-Decodierung, vor weiterer Maskierung.
  Alle **Bash**-Ergebnisse sind Strings. Gezählt sind auch Fehlertexte, `(No content)`-Platzhalter und
  Hintergrundstart-Quittungen; nicht die JSONL-Hülle, nicht stdout auf Platte, nicht Netzwerkverkehr.
  Beim späteren Lesen einer Logdatei zählen die erneut sichtbaren Bytes erneut. Bereits gekürzte
  Tool-Ergebnisse werden nicht hochgerechnet. Die Quellpaket-Schwärzung kann die Originalgröße verändert haben.
- **Hauptfamilie:** genau eine je Bash-Aufruf, nach dominierendem Arbeitszweck manuell codiert;
  bei mehreren Tätigkeiten bleibt der komplette Ergebnisblock in dieser Familie. `SRC` ist der ausdrücklich
  codierte Rest für Quellen-/Dokumentarbeit. Das Register in §8 ordnet **alle 305** Aufrufe mit Quellzeile zu.
- **Muster:** zusätzliche, überlappende lexikalische Facetten über den ganzen Kommandostring.
  Sie zählen auch Suchausdrücke, erzeugte Skripte und zitierten Briefinhalt mit dem betreffenden Pfad.
  Daher sind sie **Such-/Arbeitskontexte**, keine Zahl tatsächlich gesendeter Requests. §4 benennt für
  alle 20 wiederkehrenden Facetten Frage, Quelle/Felder und Abdeckung. Schwelle: mindestens zwei Sessions
  oder mindestens drei Aufrufe einer Session. Der Katalog abstrahiert IDs, Slots und konkrete Dateien;
  individuelle Literalkombinationen sind keine zusätzlichen Fragemuster.
- **Interne Arbeit:** ein Bash-Aufruf kann mehrere `curl`, `ctl` und hunderte Schleifenrunden enthalten.
  Deren tatsächlich ausgeführte Anzahl ist **unknown**. Ein Hintergrundstart mit 284 Ergebnisbytes
  beweist weder nur 284 stdout-Bytes noch einen erfolgreichen Abschluss.

| Session / beauftragte Quelldatei | Zeitfenster UTC | Dauer | Tool-Aufrufe | Bash | Bash-Ergebnisbytes |
|---|---|---:|---:|---:|---:|
| S1 / `1-slot7-bis-16-35-6dee9d73.jsonl` | 13:16:42.939–14:35:11.914 | 78 min 28,975 s | 143 | 120 | 140.268 |
| S2 / `2-slot3-bis-17-29-f9e88acd.jsonl` | 14:33:11.684–15:27:32.524 | 54 min 20,840 s | 78 | 74 | 326.367 |
| S3 / `3-slot12-bis-18-25-68eeeaa3.jsonl` | 15:27:19.172–16:23:30.220 | 56 min 11,048 s | 122 | 111 | 178.195 |
| Gesamt | keine Addition zu einer Linien-Wanduhr | — | **343** | **305** | **644.830** |

| Tool | S1 | S2 | S3 | Gesamt |
|---|---:|---:|---:|---:|
| Bash | 120 | 74 | 111 | 305 |
| Write | 10 | 0 | 2 | 12 |
| Read | 6 | 0 | 5 | 11 |
| AskUserQuestion | 4 | 1 | 0 | 5 |
| TaskStop | 0 | 2 | 2 | 4 |
| Skill | 1 | 0 | 1 | 2 |
| Edit | 2 | 0 | 0 | 2 |
| ToolSearch | 0 | 1 | 1 | 2 |

## 3. Vollständige Hauptklassifikation

Die Zahlen sind additiv. Die Beispiele sind wörtliche Teilkommandos, jeweils höchstens zwei
Quellzeilen; `<USER>`, `<IP>`, `<HOST>`, `<EMAIL>` ersetzen private Identifikatoren.
`S2.014` bedeutet den 14. Bash-Aufruf in S2; die JSONL-Zeile steht im vollständigen Register.

| Familie | S1 | S2 | S3 | Gesamt / Ergebnisbytes | Woertliches Beispiel |
|---|---:|---:|---:|---:|---|
| BOARD · Sessions/Slots/Program-Zustand | 12 | 7 | 5 | 24 / 30,114 | S1.013: `sl=d.get("slots"); print(type(sl))` |
| BOOT · Erdung state/register | 3 | 5 | 3 | 11 / 101,615 | S1.001: `./state.sh 2>&1 | tail -80` |
| CTL · ctl-Verb, teils weitere Sensoren | 11 | 5 | 11 | 27 / 21,773 | S1.107: `./ctl.sh ctx 2>&1` |
| GIT · Git/Repo-Inventar | 2 | 0 | 1 | 3 / 6,850 | S3.031: `git -C ~/private-repo-aa log --oneline | wc -l` |
| HOST · Hostprobe/SSH/Simulator, auch Versuchsschreibakte | 0 | 0 | 14 | 14 / 5,899 | S3.051: `xcrun simctl shutdown all 2>&1 | head -2` |
| HTTP_WRITE · curl/Python-API-Schreibakt, auch Ack/Send | 14 | 12 | 7 | 33 / 14,891 | S3.044: `/api/tasks/0d3a5b76/archive` |
| LEDGER · Ledger-Lesung und deren Formsuche | 8 | 3 | 4 | 15 / 56,664 | S2.015: `tail -1 post-land-audits.jsonl` |
| LOCAL_WRITE · Lokale Datei-/Commit-/Briefarbeit | 3 | 3 | 2 | 8 / 2,409 | S2.071: `open(p,"w").write(s)` |
| PANE · Pane-/tmux-Lesung, auch gespeicherte Ausgaben | 3 | 2 | 3 | 8 / 17,029 | S1.118: `tmux -L claudefleet capture-pane -p -t s12` |
| PLAN · Startplan laden/filtern/erkunden | 5 | 2 | 3 | 10 / 12,337 | S1.009: `collections.Counter(x.get("next") for x in w)` |
| SELF · Eigene Identitaet und Linie | 1 | 0 | 1 | 2 / 5,061 | S1.004: `l=d.pop("lineage",None)` |
| SRC · Gezielte Code-/Dokument-/Routensuche | 47 | 22 | 37 | 106 / 237,823 | S1.014: `rg -n 'criterion-confirm|criterion/confirm' server.ts | head -8` |
| TASK · Auftrag/Kriterium/Karte lesen | 6 | 3 | 9 | 18 / 82,361 | S1.011: `ts={t["id"]:t for t in d["tasks"]}` |
| TRANSCRIPT · Rollout-/Kontingentmessung | 1 | 7 | 0 | 8 / 27,900 | S2.069: `if e.get("type")=="token_usage_record" and lo<=ts<=hi:` |
| VERIFY · Suite/pins, neben Index-Schreibakt | 0 | 0 | 1 | 1 / 262 | S3.082: `bun install --frozen-lockfile >/dev/null 2>&1` |
| WATCH · Watcher erstellen/starten/reparieren | 4 | 3 | 10 | 17 / 21,842 | S2.059: `do sleep 30; done;` |

Token-Beschaffung ist **keine disjunkte Hauptfamilie**: In 61 Aufrufen steht der Zugriff auf
`fleet.json["token"]` (74.032 Bytes der betroffenen, gemischten Ergebnisse), in fünf die
`FLEET_TOKEN`-Suche in `.env` (8.372 Bytes). Kein davon isolierbarer Ergebnisblock belegt die
Kosten des Tokens selbst. Ebenso stehen `capture-pane` in 36 Aufrufen und `ctl.sh` in 50
Kommandokontexten; die kleineren Hauptfamilien zählen nur deren dominierende Verwendung.
Das verhindert die falsche Rechnung „61 Token-Aufrufe zusätzlich zu 305 Bash-Aufrufen“.

## 4. Wiederkehrende Fragen und vorhandene Abdeckung

Die Matrix führt **alle** Facetten auf, die die definierte Wiederholungsschwelle erreichen.
Die Zählungen `S1/S2/S3` und Bytes stehen daneben; Überlappungen dürfen nicht addiert werden.
`voll` bedeutet Abdeckung der genannten Frage im gelesenen Code, nicht gleiche Ausgabeform
oder gleiche Berechtigung für jede Rolle. Die tatsächlichen Hand-Abfragen befinden sich über
Quellzeilen im Register; Top-3-Ersparnisse verwenden die engeren manuell abgegrenzten Ketten in §5.

| Muster · Aufrufe S1/S2/S3 · Ergebnisbytes | Wiederkehrende Frage; Felder und Quelle | Vorhandene Tür und verbleibende Grenze |
|---|---|---|
| P01 · 3/5/3 · 101.615 | Was änderte sich seit der Übergabe, welche Arbeit ist offen? Git HEAD/Log; Outcomes/Audit-result; Tasks status/kind/criterion/Fläche. | `state.sh:34`, `state.sh:66`, `register.sh:170` decken die breite Erdung. Wiederholtes seitenweises Aufrufen statt einmaligem Snapshot: S2.001–005. Gezielte Ausgabe fehlt in der gelesenen Usage. |
| P02 · 3/1/1 · 22.243 | Wer bin ich, welche Linie und Rückwege habe ich? Self slot/label/lane/awaiting/lineage/autos/watches; zusätzlich historisches lineageHandovers. | `/api/self` voll für eigene Gegenwart (`server.ts:30448`); keine beliebige fremde Linie. Rohstate-Suche S1.089–091 ist eine zusätzliche historische Frage, nicht nötig für eigene Erdung. |
| P03 · 15/7/6 · 58.153 | Welche Slots sind besetzt, durch wen, mit welchem Fortschritt? API slots[].id/cwd/label/openedAt/model/effort/ctx, git, lane; Rohstate slots als Objekt. | `/api/sessions` liefert `slots` als Array (`server.ts:31803`), `ctl ctx` deckt Kontext (`ctl.sh:343`). Ein allgemeines `ctl sessions` fehlt in `CTL_VERBS` (`ctl.sh:27`). |
| P04 · 19/19/19 · 135.895 | Was ist der exakte Auftrag, ist er gestartet/freigegeben, sind Karte und Fläche gültig? Tasks id/status/kind/slot/programId/text/criterion/card/releasedBy/after. | `/api/tasks` Volltext, Sessions nur taskDigest (`server.ts:31757`); `register.sh:201` zeigt Queue/Fläche. Kein gezielter gemeinsamer Task-/Belegreader in `ctl.sh:27`. Gesuchte `program`-Felder waren teilweise `programId`. |
| P05 · 5/8/6 · 35.906 | Warum startet diese Zeile nicht? Startplan repos[].waves[].ids/rows/checks/release/next, lanes/cap/unresolved; zusätzlich after/criterion. | `/api/start-plan` ist **bereits** die Dispatcher-Projektion (`server.ts:33175`, `start-plan.ts:1`). `next` ist ein Objekt, kein hashbarer String (S1.009). `startPlanNow` nimmt nur offene pending/queued Aufträge auf (`server.ts:11038`); ein gesendeter oder verschwundener Task braucht weitere Belege. |
| P06 · 5/9/5 · 33.353 | Welches Program führt welches Repo, welche MAIN/Politik gilt? programs id/status/title/repo/main/release/profile/dispatch/promotion. | `/api/programs`; `ctl send --main` joint aktuelle Program- und Session-Identität (`ctl.sh:782`). MAIN hat eigenes `/api/self/program-execution` (`docs/self-api.md:526`). Ein Selbst-Token der Orchestratorin ersetzt keine fremde MAIN-Bindung. |
| P07 · 20/4/12 · 41.370 | Läuft oder wartet die Arbeit wirklich, steht ein Dialog? tmux session/window/current_path und sichtbarer Pane-Text. | `ctl watch lane`/`watch merge` liefern Zustandsübergänge (`ctl.sh:398`); `/api/sessions` liefert strukturierte Sensoren. Kein vollständiger Ersatz für echte Dialog-/Produktansicht. S3.101 zeigt einen Trust-Dialog, nicht bloß „idle“. |
| P08 · 12/5/5 · 86.120 | Ist etwas gelandet, was scheiterte, wann/wozu gehört es? lane-outcomes outcome/branch/taskId/mainAfter, Audit result/mainSha/fails/covers, audit event/detail/ts, cards valid/gaps/ms. | `state.sh:66` und `state.sh:123` aggregieren Outcomes/Audits; `/api/self/program-execution` ist programgebunden. `register --archived` sucht Tasks im Archiv (`register.sh:43`). Kein einheitlicher Task-Trail über diese Quellen im CLI. |
| P09 · 2/5/1 · 50.386 | Liegt ein Report für diese Arbeit vor, wer kann ihn lesen/entscheiden? fleetReports provenance.taskId/receiver/reportedAt/status/decision; Aufgaben-ID nicht am Report-Top-Level. | `ctl report` filtert korrekt auf `provenance.taskId`, aber nur sichtbare Self-Reports (`ctl.sh:358`, `ctl.sh:373`). „Kein sichtbarer Report“ ist kein Beweis für „kein Report“. Program-Inbox-/Owner-Pfad bleibt separat (`docs/self-api.md:1719`, `docs/self-api.md:1987`). |
| P10 · 6/10/15 · 64.103 | Was hindert Deploy/Integration? merges running/last, auditShardRuns, postLandAuditLive running/waiting, gate.lock, deployGap/bundleStale. | `ctl merges`, `ctl lock` und Sessions decken Teilfragen (`ctl.sh:180`, `server.ts:31779`). Die eigentliche Startvorbedingung existiert in `deployBlocker()` (`server.ts:29545`); siehe C. |
| P11 · 7/12/2 · 37.912 | Wie voll ist die Session, was kostete der Lauf? ctx pct/usedTokens/windowTokens; Rollout token_usage_record/rate_limits; Konfigurationswerte. | `ctl ctx` voll für messbaren aktuellen Kontext (`ctl.sh:347`). Historische Toolkosten und Kontingentzuordnung sind andere Messungen; keine solche Ernte im Verbinventar. S2.023–025 entwickeln dafür zwei Skriptfassungen. |
| P12 · 16/21/24 · 74.032 | Wie authentifiziere ich den nächsten Owner-Request? Rohdatei token → Authorization. | `ctl.sh:85` löst Credentials bereits verzögert auf, `ctl.sh:132` bildet den korrekten Header. Geheimnis nie ausgeben; kein neues Datenfeld erforderlich. |
| P13 · 3/0/2 · 8.372 | Steht der Owner-Token in der Env-Datei? grep/cut/tr auf FLEET_TOKEN. | Derselbe vorhandene Credential-Resolver. Die falsche Quelle/der falsche Header führt in S1/S2/S3 wieder zu Schema-Raten über Fehlerantworten. `.env`-Lesung ist kein notwendiger Schritt jedes Verbs. |
| P14 · 19/15/16 · 61.787 | Welches Verb hat welche Syntax, welches Ergebnis? Usage, merges/lock/ctx/report/watch/dispatch/send/commit main. | Vorhandene Verbliste (`ctl.sh:27`). 50 Kontexte sind nicht 50 verschiedene Verben und enthalten Quellensuchen. Explizite Akt-Verben behalten Owner-Autorität; ein Reader darf sie nicht nebenbei auslösen. |
| P15 · 13/14/8 · 69.785 | Was ist committed, dirty, gelandet oder neu? git log/status/show/notes/branch/worktree; teils Produktdokumente daneben. | `state.sh:34`, `ctl merges`/`commit main` (`ctl.sh:823`) decken Routinefragen. Fachliche Diff-Lesung bleibt Git-Arbeit. Nicht jede wiederholte Lesung ist Verschwendung. |
| P16 · 58/31/30 · 201.881 | Welche Route, Felder oder Implementierung gelten? rg/grep/sed in server.ts, ctl.sh, types, start-plan/card-extract. | `ctl.sh`, `docs/self-api.md`, vorhandene APIs beantworten Bedienungsfragen teilweise. `/open`-Suchkette S1.037–049 und Auth-Suche S3.009–013 sind Verbinventar-Lücken; Architektur-/Reviewfragen benötigen weiterhin Quellen. |
| P17 · 4/3/10 · 21.842 | Wann tritt der gewünschte Endzustand ein? until/while/seq plus Reports/Taskstatus/Panes/Audits. | `ctl wait merge`, `ctl wait change` (`ctl.sh:660`, `ctl.sh:703`) und Self-Watch existieren. `wait change` beobachtet Taskstatus, jedoch **keine Kartengültigkeit** (`ctl.sh:710`) und keinen flüchtigen Audit-Drain; C soll dieses konkrete Loch schließen. |
| P18 · 0/0/16 · 10.525 | Welche Hostressourcen/Tools sind verfügbar, wie verhält sich SSH/tmux? RSS/comm/CPU/RAM, Simulatorstatus, Toolversionen, Socket/Paste. | `state.sh:339` enthält Hygiene, Sessions `helperDevices` (`server.ts:31794`). Nicht die experimentellen SSH-/Paste-Beweise von S3.071–075. Kein Top-3-Kandidat: nur eine Session und viel absichtlich neue Messarbeit. |
| P19 · 23/14/21 · 228.313 | Wo steht die fachliche Absicht/Evidenz? Repo-Dokumente, Plan, Entscheidungen, Messnotizen, Überschriften/Zeilenzahlen. | `register.sh:311`/`:333` orientiert über Briefs/offene Marker; Messindex liefert Auswahl. Der Inhalt bleibt Quelle. Ein neuer RAG-Layer ist durch diese Trefferzahl allein nicht begründet. |
| P20 · 14/13/7 · 15.742 | Wie file/sende/bestätige/archiviere ich? POST-Body, Identität, Route und HTTP-Ergebnis. | Vorhandene `ctl send`, `dispatch`, `watch`, `events`, `land` decken einige Akte; Tasks/Program-Bootstrap/Archivieren brauchen ihre bestehenden Routen. Schreibakte bleiben explizit getrennt. P20 ist lexikalisch; die Hauptfamilie HTTP_WRITE enthält 33 Aufrufe, nicht jede POST-Erwähnung wurde ausgeführt. |

## 5. Kandidaten, Ersparnis und Fehlgriffe

### 5.1 Schichten mit Kostenbereich

**Abgrenzung zur Notiz vom 10.09.:** Deren §1 inventarisiert Speicher, Projektionen und Zustellung;
§2 nennt die CLI-Lücke, lässt konkrete Controller-Aufrufkosten aber ausdrücklich offen
(`docs/messungen/2026-09-10-datenschichten-inhalt-aufbereitung-zustellung.md:90`, `:133`).
Diese Messung liefert den fehlenden Nenner. Die 12 heute sichtbaren Verben sind kein Widerspruch
zur damaligen datierten Zehn-Verben-Liste. Die damaligen Vorschläge zu Inbox-Zustellung,
Nachfolge und Instruktionsdopplung werden hier nicht nochmals als neue Datenschichten verkauft.

| Rang / Kandidat | Rohquellen und Join | Leser / Grenze | Gemessener Kostenbereich | Geschätzte Einsparung im abgegrenzten Szenario |
|---|---|---|---:|---|
| **A · ctl sessions** | `/api/sessions`: Slots + Task-/Program-Digests; falls MAIN-Details nötig, `/api/programs` nach id; vorhandener Credential-Resolver. Kein Join über bloße Slotnummer ohne openedAt. | Orchestratorin/MAIN nur mit vorhandener Owner-Berechtigung; Lane unsupported für globale Owner-Sicht, eigenes Self bleibt verfügbar. | 21 Aufrufe / 21.491 B, sechs Ketten | **9–15 Aufrufe / ca. 4.601–15.347 B**; sechs gezielte Antworten à Budget 1.024 B, bis sechs erhaltene Nebenabfragen. |
| **B · ctl task** | Task id → Program id → Startplan wave/rows/next; Report provenance.taskId; Outcomes taskId/branch; Archiv task.id; Kartenversuch taskId. Aus Quellenzeitpunkten getrennte Herkunft, kein atomarer Snapshot behauptet. | Orchestratorin mit Owner-Zugang; MAIN nur zulässiges eigenes Program; Lane unsupported für fremde Tasks/Reports. Fehlende Berechtigung ist ein Ergebnis. | 41 Aufrufe / 93.146 B, neun Ketten | **23–32 Aufrufe / ca. 28.141–74.714 B**; neun Antworten à 2.048 B, bis neun erhaltene Nebenabfragen. |
| **C · ctl deploy-status / wait deploy** | Laufende/reservierte Lands + Audit-Runner/Drain aus `deployBlocker`; deployRunning/Marker-Alter aus Deploy-Preflight; bestehende Deploy-/Audit-Fakten und Ledger-Referenzen für getrennten Detailabruf. | Orchestratorin mit Owner-Zugang; MAIN bei entsprechender Berechtigung lesend; Lane unsupported. Meldet nur Startvorbedingung, niemals Promotion oder Produktfreigabe. | 21 Aufrufe / 71.263 B, fünf Ketten | **11–16 Aufrufe / ca. 30.511–66.143 B**; fünf Antworten à 1.024 B, bis fünf erhaltene Nebenabfragen. |
| D · Erdung einmal erfassen, gezielt anzeigen | vorhandene state/register-Ausgaben, Git/Queue/Ledgers, eigene Lineage getrennt; kein neues Persistenzschema | Orchestratorin/MAIN; Lane gezielte eigene Erdung | BOOT: 11 Aufrufe / 101.615 B | Bei weiterhin zwei Calls je Session höchstens **5 Aufrufe**; Byte-Ziel 8.192 B pro Session ergäbe **77.039 B**, rein angenommener Deckel, Vollständigkeit noch zu beweisen. Kein Grund, wichtige Erdung wegzukürzen. |
| E · Pane nur als gezielter Beleg | Slot/openedAt → tmux/Panesensor, Ereignis-ID als Anlass | Orchestratorin; MAIN eigene Arbeiter; Lane eigene Pane | Facette P07: 36 / 41.370 B | Keine belastbare positive Ersparnis: **0 zugesagt**, 41.370 B maximale betroffene Bruttomenge. Trust-Dialog und Produktansicht bleiben echte Wahrnehmung. |
| F · vorhandene mechanische Akt-Verben konsequent nutzen | Body/ID aus vorhandener Route; Resolver in ctl.sh; kein neuer Entscheidungs-Layer | Nur bereits autorisierte Aktoren | HTTP_WRITE 33 / 14.891 B; Tokenfacetten überlappen | **0 produktive Schreibakte entfallen**; vermeidbare Wiederholungen s. §5.2. Fehler-Bytes sind keine Einsparung an allen erfolgreichen Schreibantworten. |

**Rechenregel A–C:** Gruppen stehen exakt in `BUNDLES` (§7); keine ihrer 83 IDs überschneidet
sich zwischen A/B/C. Eine Gruppe ist eine thematische Abfragekette, **keine zugesicherte gleichzeitige
Beobachtung**. Oberes Szenario: alle alten Aufrufe durch eine Antwort je Gruppe ersetzen,
`Aufrufe = N − Gruppen`, `Bytes = B − Gruppen × Budget`. Vorsichtiges Szenario: je Gruppe
zusätzlich eine Nebenabfrage erhalten und insgesamt 50 % der alten Ergebnisbytes bewahren,
`Aufrufe = N − 2 × Gruppen`, `Bytes = floor(B/2) − Gruppen × Budget`.
Die Intervalle sind **Annahmen, keine Konfidenzintervalle**. Außerhalb dieser Annahmen ist auch
null Ersparnis möglich. Es gibt noch kein implementiertes Verb und keinen nachgemessenen Replay.
Gerade C enthält Produktdokument-/Git-Nebenarbeit (S2.013); die ganze Ausgabe als vermeidbar
zu behaupten wäre falsch. Budgets müssen wesentliche Felder vollständig halten und Overflow mit
Detailreferenz melden. Internes HTTP-/Polling-Aufkommen und Modellkosten sind nicht daraus ableitbar.

**Was C nicht neu erfinden darf:** `server.ts:29555` prüft laufenden oder startenden lokalen Audit,
nicht die wartende Auditqueue. S3.019 verlangte zunächst `-0`, S3.023 lockerte dies nach Quelllesung.
`postLandAuditLiveView()` liefert bei Leerlauf **null** (`server.ts:18937`), was S3.052 nicht behandelte.
`deployRunning` und ein junger Deploy-Marker blockieren zusätzlich (`server.ts:29616`, `:29630`).
Ein GET muss dieselben Vorbedingungen lesend ausweisen; ein erneuter POST prüft sie weiterhin
am Aktzeitpunkt. Weder GET noch Wait reservieren einen Deploy. Noch ein Report ist kein Deploy-Gate.

**Was B nicht duplizieren darf:** Startplan ist vorhanden; das in S2.032 formulierte Warte-Register
ist ein damaliger Auftrag, kein hier bewiesener neuer Serverzustand. B liest vorhandene `next`/
`checks`/`release` und verbindet sie mit der gezielt angefragten Arbeit. Eine beliebige historische
Zeile muss nicht im aktuellen Startplan stehen. Fehlendes Archiv/Report-Scope bleibt `unknown`.
`ctl report` darf nicht durch ein fremdes Self-Token scheinbar vervollständigt werden.

### 5.2 Fehlgriffe und Wiederholungen

`is_error=true`: **4/4/7**, zusammen 15 Bash-Ergebnisse. Das ist **keine Fehlerquote**:
S3.006 ist der korrekte Status `HELD`/Exit 1; mehrere Python-/HTTP-Fehler enden hingegen mit
Exit 0, weil spätere Pipeline-/Shell-Befehle erfolgreich sind. Die folgende manuell geprüfte
Liste zählt betroffene Tool-Aufrufe einschließlich partieller Fehler, nicht defekte Teilprozesse.
Historische rote Audits oder Fehlertexte in gelesenem Quellcode wurden nicht als Bash-Fehler gezählt.

| Ursache / betroffene Aufrufe | Anzahl / Ergebnisbytes | Beobachtung, Kosten und Fortsetzung |
|---|---:|---|
| Auth: S1.005/007/008, S2.008/009, S3.007/008 | 7 / 6.199 | Fehlerantwort wird wie Sessionliste gelesen; falscher Header `x-fleet-token` in S2/S3, Env-Quelle in S1. S3.008 zeigt 401; S2.011 und S3.014 wechseln auf Bearer. Derselbe vermeidbare Neubeginn über Nachfolge. |
| Feldform: S1.009/012/066, S2.015/063, S3.052 | 6 / 15.877 | `next` als Counter-Key unhashbar; slots-Objekt als Array; Report-Felder am falschen Ort; `sessions` statt `slots`; null-Audit wie Objekt. S1.066 zeigt nur den gekürzten Traceback-Anfang: genaue Ursache **unknown**, fehlender Ledger-Treffer ist nur eine Hypothese. |
| Leeres/nicht lesbares JSON: S2.013 | 1 / 10.104 | `JSONDecodeError`; Body vor Parser nicht bewahrt, genaue Transport-/Routenursache **unknown**. Großer gemischter Block, keine 10 kB reine Fehlerausgabe. |
| Python-/Shell-Quoting: S2.007, S3.108/109 | 3 / 4.182 | Backslashes im f-String erzeugen SyntaxError. S3.108 startet die Schleife trotzdem; S3.109 liest wiederholte SyntaxErrors. S3.110 ersetzt das Konstrukt durch direktes Python-HTTP. Kein produktiver Zustandswechsel im kaputten Parser messbar. |
| zsh/grep: S1.002/025, S3.002/005/065/067/087 | 7 / 16.561 | `echo ======` wird als zsh-Expansion behandelt; ungematchte Globs abbrechen; S3.067 zusätzlich ugrep-Komplexitätslimit; `set -- $spec` spaltet in zsh die Dreier-Spezifikation nicht. S3.087 erzeugt drei falsche Dateinamen und `bad text`; S3.088 verwendet explizite Python-Tupel. |
| Hook-Block: S1.053, S2.038, S3.097 | 3 / 3.325 | Longrunner mit head/tail bzw. `sleep 60`-Kette vor Ausführung verweigert. Reparaturen S1.054, S2.039, S3.098. Diese drei Bash-Anforderungen zählen, aber die untersuchten Kommandos liefen in diesen Versuchen nicht. |
| Ziel/Body: S2.067, S3.025/037 | 3 / 945 | `max` statt `maxLanes`; merge-Watch ohne Merge dieser Identität (409); gekürzte Program-ID bei send. Reparaturen S2.068, S3.026 (lane-Watch), S3.038 (volle ID). Refusal ist korrekt, kostet aber eine weitere Runde. |
| Host-Werkzeug/Socket: S3.045/071/076 | 3 / 2.054 | `timeout` fehlt, SSH-ControlPath überschreitet Socket-Länge, `swapon` nicht gefunden. Kürzerer Pfad S3.072; beweist Umgebungsgrenze, keinen Fleet-Datenfehler. |
| Cap/Assertion: S1.073/116 | 2 / 783 | Dispatch meldet 3/3; S1.074 nutzt explizit force. `succeed.py` scheitert mit `AssertionError: 2017`; S1.117 wiederholt nach Änderung. Erstere ist ein korrektes Gate, letztere lokale Vorprüfung, keine abgelehnte Succession-API. |

**Exakte Kommandowiederholungen:** drei Paare, ohne Normalisierung:
S1.001 = S3.001; S1.002 = S3.002; S3.020 = S3.024. Das letzte Paar startet dieselbe
Scratch-Datei nach ihrer Änderung in S3.023: gleicher Commandstring bedeutet nicht gleicher Code.
Darum ist ein bloßer Dublettenabzug keine Ersparnismessung.

**Suchschleifen ohne Shellfehler:** Die `/open`-Suche S1.037–049 und Auth-Suche S3.009–013 zeigen
mehrere leere Treffer. `(No content)` ist Ergebnistext, kein Nachweis einer fehlenden Route.
S3.092/093/099 lesen Karten-Timeouts; S3.101 sieht einen Trust-Dialog und S3.102 quittiert ihn.
Das stützt einen Readiness-Befund für diesen Versuch; nicht jeder historische Timeout ist dadurch erklärt.
Die dortige Karten-Worker-Reparatur wurde bereits als Auftrag formuliert (S3.106) und wird hier nicht erneut gefilet.

## 6. Top 3 als gegen den Baum geprüfte Karten

**Reihenfolge:** A behebt eine nachfolgeübergreifende, kleine Bedienungslücke. B hat den größeren
gezielt adressierten Kostenbereich. C macht eine vorhandene Vorbedingung verlässlich lesbar,
benötigt aber einen Server-Schnitt. Kein Kandidat darf Freigabe, Land oder Deploy automatisch auslösen.

### A — Sessions/Auth

```card
ROLLE: codex/gpt-6-astra/high
GROESSE: klein
FLAECHE: ctl.sh, e2e/ctl.ts, docs/controller.md
VERIFY: pins, tsc, build, clean-review, security, claude-gate; isolierte Vorschau fuer das geaenderte ctl-Verb
DONE: ctl sessions rendert bestehende Slot-/Task-/Program-Digests mit Herkunft; unbekannte oder unautorisierte Antworten scheitern benannt, und ein isolierter Vergleich gegen /api/sessions passt feldgenau ohne Credential-Ausgabe.
Eine gezielte lesende Sessions-Ausgabe in ctl.sh ersetzt die wiederkehrende Auth- und Feldsuche.
```

Umfang: Filter auf explizite Slotnummern und Repo, Default besetzte Slots; id/openedAt/label,
Harness/Modell/Effort, Task-/Program-ID, Kontext und Gitfelder, Quelle/Zeit. Kein Roh-Pane-Text,
keine neuen Owner-Rechte, keine Ausgabe des Tokens. Schemafehler/401 bleiben Fehler; null-Fakten
bleiben unknown. Positivprobe plus leere Slotliste, malformed Response, unbekannter Filterwert,
unauthorisiert, gleiche Slotnummer mit neuer openedAt. Budgetprobe am abgegrenzten Fixture.
**Flächenentscheid:** CLI/docs/probes apply; API/server/reverse-state/client not-applicable;
Claude/Codex/Pi apply als Leser desselben CLI, unmessbarer Kontext bleibt null.

### B — Task-Erklärung

```card
ROLLE: codex/gpt-6-astra/high
GROESSE: mittel
FLAECHE: ctl.sh, e2e/ctl.ts, docs/controller.md
VERIFY: pins, tsc, build, clean-review, security, claude-gate; isolierte Vorschau fuer Task-Reader und Scope-Verweigerung
DONE: ctl task verbindet eine exakte Task-ID mit vorhandenen Startplan-, Karten-, Report- und Outcome-Belegen; leere, verschwundene, widerspruechliche und unzugaengliche Quellen werden getrennt benannt, und isolierte Fixtures pruefen die Joins.
Ein lesender Task-Reader verbindet die bestehenden Quellen statt Auftrag, Karte und Land-Belege wiederholt von Hand zu suchen.
```

Umfang: aktueller Task + Program-/Wave-Bezug, danach begrenzte Belegreferenzen statt voller
Auftrags- und Reporttexte im Default. Archivsuche nur bei fehlendem aktuellem Task; Report/Outcome
über Task-ID und Branch, nie Slot allein. Kein neues Register, kein zweiter Startplan-Algorithmus,
keine automatische Bewertung eines Reports. Fehlender Treffer ≠ Berechtigungsfehler ≠ ungültige
Karte. Isolierte Fixtures: fehlende Datei, malformed JSONL, gleicher Slot nach Recycling,
archivierter Task, Report an andere Empfänger, gleichzeitig erneuerter Task/Plan. Quellenzeiten
und widersprüchliche Versionen zeigen; kein atomarer Join über getrennte Reads versprechen.
**Flächenentscheid:** CLI/docs/probes apply; bestehende API-Routen und lokale Ledger werden gelesen,
server/protocol/client/reverse-state not-applicable. Scope-Erweiterung unsupported. Claude/Codex/Pi
apply als Leser; keine Harness-Heuristik im Join.

### C — Deploy-Status

```card
ROLLE: codex/gpt-6-astra/high
GROESSE: mittel
FLAECHE: server.ts#deployBlocker/#deployVerb/#deployRun, ctl.sh, e2e/ctl.ts, e2e/deploy-facts.ts, docs/controller.md
VERIFY: pins, tsc, build, clean-review, security, claude-gate; isolierte Vorschau fuer Deploy-Vorbedingungen und Warteschleife
DONE: Ein Owner-GET und ctl deploy-status lesen dieselben Vorbedingungen wie Deploy inklusive laufendem Build und jungem Marker; wartende Audits allein blockieren nicht, unbekannte Quellen werden benannt und ctl wait deploy endet begrenzt ohne Schreibakt.
Die vorhandene Deploy-Vorbedingung wird lesbar und ersetzt handgeschriebene Deploy-Fenster-Pruefungen.
```

Umfang: eine lesende Owner-Route mit Erfassungszeit, blocker/unknown und bestehenden Quellenreferenzen;
CLI mit begrenztem Wait auf genau diese Projektion. Marker-Lesen ist rein; GET darf weder alte
Marker löschen noch Audit-/Deployzeilen schreiben. POST behält seine erneute Prüfung am Aktzeitpunkt.
Fixture-Matrix: freier Zustand, reservierter/laufender Land, startender/laufender Audit,
nur wartender Audit, laufender Deploy-Build, junger/alter Marker, API nicht erreichbar,
Timeout und gleichzeitig neu startender Blocker. Der neue GET ist keine Ausführungserlaubnis.
**Flächenentscheid:** server/CLI/docs/probes apply; eigenes JSON-Wire apply in der neuen Route,
Sessions-Poll und UI not-applicable; reverse-state not-applicable (nichts persistieren).
Claude/Codex/Pi apply als Leser. Self-/Lane-Zugriff unsupported; Erweiterung auf MAIN wäre eigene Autoritätsentscheidung.

Die Formatprüfung verwendet den **aktuellen** `parseFormattedCard` (`card-extract.ts:417`)
und `validateCard` (`card-extract.ts:205`). Ein leerer, aber vorhandener Symbolindex erzwingt
für die drei Server-Symbole den Deklarations-Fallback; `symbolIndex:null` würde nur Dateiexistenz
beweisen (`card-extract.ts:300`). `ranges:null` bleibt deshalb ehrlich; alle Symbole sind als
Deklaration im aktuellen Baum geprüft. Rollenprädikate prüfen exakt das hier verwendete Triple;
Codex/high ist im Adapter zugelassen (`server.ts:1262`), Modell-ID-Zeichensatz in `server.ts:316`.
Die Prüfung bescheinigt Kartenform/Fläche, weder Machbarkeit noch Freigabe.

## 7. Reproduktion und Prüfung

Aufruf aus dem untersuchten Checkout:

```sh
python3 /tmp/measure.py '<INPUT_DIR>' > /tmp/measurement.txt
```

`<INPUT_DIR>` ist das private Quellpaket-Verzeichnis mit genau den drei Dateinamen aus §2.
Das Skript unten als `/tmp/measure.py` speichern. Es liest ausschließlich diese Dateien,
schreibt stdout und führt kein Transkriptkommando aus. Die SHA-256-Werte im Output identifizieren
die **geschwärzten gelieferten Bytes**. Abweichende Inputs müssen neu beurteilt werden.
Die Assertions prüfen eindeutige Joins, vollständige Klassifikation und den erwarteten Korpus;
eine entfernte Ergebniszeile oder doppelte tool_use-ID lässt sie scheitern.

```python
import collections as C, datetime as D, hashlib, json, pathlib, re, sys
NAMES = ['1-slot7-bis-16-35-6dee9d73.jsonl', '2-slot3-bis-17-29-f9e88acd.jsonl', '3-slot12-bis-18-25-68eeeaa3.jsonl']
# Manuell codierter Hauptzweck; Rest ist gezielte Quellen-/Dokumentlesung (SRC).
GROUPS = {
 'BOOT': ['1-3', '1-5', '1-3'],
 'SELF': ['4', '', '4'],
 'BOARD': ['5,12-13,27,46-47,50-51,93,108,113,120', '7-9,11,50,55,66', '7-8,14-15,78'],
 'PLAN': ['7-10,92', '38-39', '55-57'],
 'TASK': ['11,15,21,55,62,94', '14,17-18', '16,21,43,46-47,84,103-104,110'],
 'LEDGER': ['24-25,64-66,89-91', '13,15-16', '50,92-93,99'],
 'PANE': ['56,97,118', '12,60', '27-28,91'],
 'CTL': ['6,20,73-75,78,82,85,95-96,107', '6,19,58,72-73', '5-6,25-26,37-39,52,58,107,109'],
 'HTTP_WRITE': ['16,19,36,43,52,57,71-72,80-81,101,104,115,119', '20,35,37,42-43,46,56-57,61,67-68,74', '29,44,53,87-88,106,111'],
 'WATCH': ['53-54,79,105', '21-22,59', '19-20,23-24,30,54,89,97-98,108'],
 'TRANSCRIPT': ['34', '23-25,64-65,69-70', ''],
 'GIT': ['28,30', '', '31'],
 'LOCAL_WRITE': ['77,116-117', '31-32,71', '83,86'],
 'VERIFY': ['', '', '82'],
 'HOST': ['', '', '45,48-49,51,63,71-76,96,101-102'],
}
def expand(spec):
 out=[]
 for word in filter(None,spec.split(',')):
  p=list(map(int,word.split('-')));out.extend(range(p[0],p[-1]+1))
 return out
family={}
for f,ss in GROUPS.items():
 for s,spec in enumerate(ss,1):
  for n in expand(spec):
   key=f'S{s}.{n:03}'; assert key not in family,key; family[key]=f
# Absichtsfacetten: 1 Treffer je Tool-Aufruf, auch in gemischten Kommandos.
PATTERNS={
 'P01_state_register': r'\./(?:state|register)\.sh',
 'P02_self_lineage': r'/api/self(?:[\s\"\x27]|$)|lineageHandovers|lineageRecords',
 'P03_sessions_slots': r'/api/sessions|d\["slots"\]|d\.get\("slots"',
 'P04_tasks': r'/api/tasks|d\["tasks"\]|d\.get\("tasks"|tasks\.json|task\.py',
 'P05_start_plan': r'/api/start-plan|sp\.json',
 'P06_programs': r'/api/programs|d\["programs"\]|d\.get\("programs"|prog\.json',
 'P07_pane': r'capture-pane',
 'P08_ledger': r'(?:audit|audits|outcomes|cards|deploys)\.jsonl',
 'P09_reports': r'fleetReports|\./ctl\.sh report',
 'P10_merge_audit_window': r'\./ctl\.sh merges|auditShardRuns|postLandAuditLive|deploy-(?:ready|window)\.sh',
 'P11_context_usage': r'\./ctl\.sh ctx|rate_limits|token_usage_record|model_context_window|auto_compact',
 'P12_token_fleet': r'(?:\["token"\]|\[\\"token\\"\])',
 'P13_token_env': r'grep[^\n;]*FLEET_TOKEN[^\n;]*\.env',
 'P14_ctl_verbs': r'(?:\./|/claude-fleet/)ctl\.sh',
 'P15_git_status_history': r'\bgit\b[^\n;]*(?:log|status|show|notes|worktree|branch)',
 'P16_source_schema': r'(?:rg|grep|sed|awk)[^\n]*(?:server\.ts|server/types\.ts|ctl\.sh|start-plan\.ts|card-extract\.ts|src/client\.ts)',
 'P17_wait_loop': r'\b(?:until |while :|for i in \$\(seq)|deploy-(?:ready|window)\.sh',
 'P18_host_resources': r'\b(?:ssh|ps -|sysctl|memory_pressure|xcrun simctl)',
 'P19_repo_documents': r'(?:cat|head|sed|grep|wc|ls)[^\n]*(?:docs/|\.md)',
 'P20_api_write': r'(?:curl[^\n]*-X POST|method=[\"\x27]POST|method=[\"\x27]PUT)',
}
# Ereignisgruppen fuer Ersparnisszenarien. Gemischte Arbeit bleibt erhalten (siehe Notiz).
BUNDLES={
 'A_sessions': ['1:5', '1:46-47,50-51', '1:120', '2:7-11', '2:63', '3:7-15'],
 'B_task': ['1:11-15', '1:55,62,64-66', '1:89-92', '2:14,17-18', '2:26-30', '2:38-41', '3:16,21', '3:55-57', '3:90-95,99,103-104,110'],
 'C_deploy': ['1:82,93,95-96,105', '2:13,15-16,21-22', '2:58-59', '3:17-20,22-24', '3:39,52'],
}
def keys(spec):
 s,nums=spec.split(':');return {f'S{s}.{n:03}' for n in expand(nums)}
def size(content):
 if isinstance(content,str):return len(content.encode('utf-8'))
 return len(json.dumps(content,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
root=pathlib.Path(sys.argv[1]);allcalls=[];facts=[]
for s,name in enumerate(NAMES,1):
 data=(root/name).read_bytes();rows=[json.loads(l) for l in data.splitlines() if l.strip()]
 uses=[];results={};stamps=[]
 for line,r in enumerate(rows,1):
  if r.get('timestamp'):stamps.append(D.datetime.fromisoformat(r['timestamp'].replace('Z','+00:00')))
  content=r.get('message',{}).get('content',[])
  if not isinstance(content,list):continue
  for c in content:
   if c.get('type')=='tool_use':uses.append((line,c))
   if c.get('type')=='tool_result':results.setdefault(c['tool_use_id'],[]).append(c)
 assert len(uses)==len({c['id'] for _,c in uses})
 assert {c['id'] for _,c in uses}==set(results)
 counts=C.Counter();b=0
 for line,c in uses:
  rs=results[c['id']];assert len(rs)==1
  counts[c['name']]+=1
  if c['name']!='Bash':continue
  b+=1; key=f'S{s}.{b:03}';cmd=c['input']['command'];r=rs[0]
  assert isinstance(r['content'],str), key
  allcalls.append(dict(key=key,s=s,line=line,bytes=size(r['content']),error=r.get('is_error',False),
    family=family.get(key,'SRC'),command=cmd,result=r['content']))
 facts.append(dict(session=s,sha256=hashlib.sha256(data).hexdigest(),rows=len(rows),
  first=min(stamps).isoformat(),last=max(stamps).isoformat(),seconds=round((max(stamps)-min(stamps)).total_seconds(),3),tools=dict(sorted(counts.items()))))
assert len(allcalls)==305 and len({c['key'] for c in allcalls})==305
assert set(family)<= {c['key'] for c in allcalls}
def stat(cs):return [len(cs),sum(c['bytes'] for c in cs)]
print('SESSIONS')
for f in facts:
 cs=[c for c in allcalls if c['s']==f['session']]
 print(json.dumps({**f,'bash':stat(cs),'is_error':sum(c['error'] for c in cs)},ensure_ascii=False))
print('FAMILIES family S1/S2/S3=count:bytes TOTAL=count:bytes')
for f in sorted({c['family'] for c in allcalls}):
 cs=[c for c in allcalls if c['family']==f]
 print(f,*(':'.join(map(str,stat([c for c in cs if c['s']==s]))) for s in range(1,4)),':'.join(map(str,stat(cs))))
print('PATTERNS id S1/S2/S3=count:bytes TOTAL=count:bytes (lexical, overlapping)')
for p,rx in PATTERNS.items():
 cs=[c for c in allcalls if re.search(rx,c['command'])]
 ns=[sum(c['s']==s for c in cs) for s in range(1,4)]
 if sum(n>0 for n in ns)>=2 or max(ns)>=3:
  print(p,*(':'.join(map(str,stat([c for c in cs if c['s']==s]))) for s in range(1,4)),':'.join(map(str,stat(cs))))
print('BUNDLES name count bytes groups; disjoint total also printed')
union=set()
for name,groups in BUNDLES.items():
 ids=set().union(*(keys(g) for g in groups));union|=ids
 cs=[c for c in allcalls if c['key'] in ids];print(name,*stat(cs),len(groups))
print('BUNDLE_UNION',*stat([c for c in allcalls if c['key'] in union]))
print('TOKEN_COUNTS',sum(bool(re.search(PATTERNS['P12_token_fleet'],c['command'])) for c in allcalls))
FAILURES={
 'Auth': ['1:5,7-8','2:8-9','3:7-8'],
 'Shape': ['1:9,12,66','2:15,63','3:52'],
 'JSON_empty': ['2:13'],
 'Quoting': ['2:7','3:108-109'],
 'Zsh': ['1:2,25','3:2,5,65,67,87'],
 'Hook': ['1:53','2:38','3:97'],
 'Identity_body': ['2:67','3:25,37'],
 'Host_tools': ['3:45,71,76'],
 'Caps': ['1:73,116'],
}
print('FAILURES family count bytes (affected calls, not failed subprocesses)')
for name,groups in FAILURES.items():
 ids=set().union(*(keys(g) for g in groups))
 print(name,*stat([c for c in allcalls if c['key'] in ids]))
print('REPEATS exact command (no normalization)')
reps=C.defaultdict(list)
for c in allcalls:reps[c['command']].append(c['key'])
print(json.dumps([v for v in reps.values() if len(v)>1]))
print('TOTAL',*stat(allcalls),'errors',sum(c['error'] for c in allcalls))
print('REGISTER key:source-line:family:bytes (! = is_error)')
for s in range(1,4):
 cs=[c for c in allcalls if c['s']==s]
 for i in range(0,len(cs),5):
  print(' '.join(f"{c['key']}:L{c['line']}:{c['family']}:{c['bytes']}{'!' if c['error'] else ''}" for c in cs[i:i+5]))
```

## 8. Unveraenderte Skriptausgabe und vollstaendiges Register

```text
SESSIONS
{"session": 1, "sha256": "ccadd054bfe93f9423cfa117d40f237c9aee321626fe98dda5c1930836166e81", "rows": 1166, "first": "2026-09-15T13:16:42.939000+00:00", "last": "2026-09-15T14:35:11.914000+00:00", "seconds": 4708.975, "tools": {"AskUserQuestion": 4, "Bash": 120, "Edit": 2, "Read": 6, "Skill": 1, "Write": 10}, "bash": [120, 140268], "is_error": 4}
{"session": 2, "sha256": "8d957d2d7be4280de326833ca491a736fbe861fbe03f5acbbd594fadad21913e", "rows": 867, "first": "2026-09-15T14:33:11.684000+00:00", "last": "2026-09-15T15:27:32.524000+00:00", "seconds": 3260.84, "tools": {"AskUserQuestion": 1, "Bash": 74, "TaskStop": 2, "ToolSearch": 1}, "bash": [74, 326367], "is_error": 4}
{"session": 3, "sha256": "19d5ef2ffbec871e0f895883492eadaed379704044aeaf2ae53d77feacc0f9fe", "rows": 1032, "first": "2026-09-15T15:27:19.172000+00:00", "last": "2026-09-15T16:23:30.220000+00:00", "seconds": 3371.048, "tools": {"Bash": 111, "Read": 5, "Skill": 1, "TaskStop": 2, "ToolSearch": 1, "Write": 2}, "bash": [111, 178195], "is_error": 7}
FAMILIES family S1/S2/S3=count:bytes TOTAL=count:bytes
BOARD 12:9205 7:14751 5:6158 24:30114
BOOT 3:12866 5:66413 3:22336 11:101615
CTL 11:5929 5:6868 11:8976 27:21773
GIT 2:4114 0:0 1:2736 3:6850
HOST 0:0 0:0 14:5899 14:5899
HTTP_WRITE 14:6326 12:6077 7:2488 33:14891
LEDGER 8:9770 3:43019 4:3875 15:56664
LOCAL_WRITE 3:575 3:1185 2:649 8:2409
PANE 3:4123 2:8012 3:4894 8:17029
PLAN 5:8496 2:1822 3:2019 10:12337
SELF 1:2591 0:0 1:2470 2:5061
SRC 47:56798 22:95731 37:85294 106:237823
TASK 6:17443 3:38863 9:26055 18:82361
TRANSCRIPT 1:221 7:27679 0:0 8:27900
VERIFY 0:0 0:0 1:262 1:262
WATCH 4:1811 3:15947 10:4084 17:21842
PATTERNS id S1/S2/S3=count:bytes TOTAL=count:bytes (lexical, overlapping)
P01_state_register 3:12866 5:66413 3:22336 11:101615
P02_self_lineage 3:3565 1:16208 1:2470 5:22243
P03_sessions_slots 15:10549 7:42232 6:5372 28:58153
P04_tasks 19:27730 19:74513 19:33652 57:135895
P05_start_plan 5:8496 8:23196 6:4214 19:35906
P06_programs 5:5274 9:15432 5:12647 19:33353
P07_pane 20:22594 4:11078 12:7698 36:41370
P08_ledger 12:13388 5:68841 5:3891 22:86120
P09_reports 2:788 5:49291 1:307 8:50386
P10_merge_audit_window 6:3988 10:44109 15:16006 31:64103
P11_context_usage 7:3046 12:32220 2:2646 21:37912
P12_token_fleet 16:7081 21:39910 24:27041 61:74032
P13_token_env 3:5786 0:0 2:2586 5:8372
P14_ctl_verbs 19:16790 15:34924 16:10073 50:61787
P15_git_status_history 13:15934 14:43346 8:10505 35:69785
P16_source_schema 58:54427 31:118675 30:28779 119:201881
P17_wait_loop 4:1811 3:15947 10:4084 17:21842
P18_host_resources 0:0 0:0 16:10525 16:10525
P19_repo_documents 23:40581 14:111656 21:76076 58:228313
P20_api_write 14:6326 13:6928 7:2488 34:15742
BUNDLES name count bytes groups; disjoint total also printed
A_sessions 21 21491 6
B_task 41 93146 9
C_deploy 21 71263 5
BUNDLE_UNION 83 185900
TOKEN_COUNTS 61
FAILURES family count bytes (affected calls, not failed subprocesses)
Auth 7 6199
Shape 6 15877
JSON_empty 1 10104
Quoting 3 4182
Zsh 7 16561
Hook 3 3325
Identity_body 3 945
Host_tools 3 2054
Caps 2 783
REPEATS exact command (no normalization)
[["S1.001", "S3.001"], ["S1.002", "S3.002"], ["S3.020", "S3.024"]]
TOTAL 305 644830 errors 15
REGISTER key:source-line:family:bytes (! = is_error)
S1.001:L23:BOOT:7232 S1.002:L33:BOOT:5505! S1.003:L37:BOOT:129 S1.004:L50:SELF:2591 S1.005:L57:BOARD:2164
S1.006:L63:CTL:357 S1.007:L76:PLAN:2558 S1.008:L83:PLAN:1064 S1.009:L90:PLAN:1085 S1.010:L103:PLAN:2440
S1.011:L110:TASK:3258 S1.012:L120:BOARD:272! S1.013:L124:BOARD:207 S1.014:L129:SRC:1392 S1.015:L137:TASK:3516
S1.016:L151:HTTP_WRITE:660 S1.017:L158:SRC:101 S1.018:L169:SRC:397 S1.019:L179:HTTP_WRITE:266 S1.020:L191:CTL:105
S1.021:L209:TASK:3755 S1.022:L212:SRC:255 S1.023:L226:SRC:1216 S1.024:L233:LEDGER:4391 S1.025:L245:LEDGER:2150!
S1.026:L252:SRC:1357 S1.027:L272:BOARD:3393 S1.028:L279:GIT:1712 S1.029:L282:SRC:4431 S1.030:L294:GIT:2402
S1.031:L297:SRC:3033 S1.032:L304:SRC:592 S1.033:L309:SRC:4021 S1.034:L320:TRANSCRIPT:221 S1.035:L327:SRC:4610
S1.036:L357:HTTP_WRITE:1320 S1.037:L375:SRC:31 S1.038:L381:SRC:31 S1.039:L387:SRC:31 S1.040:L393:SRC:347
S1.041:L404:SRC:1144 S1.042:L413:SRC:276 S1.043:L422:HTTP_WRITE:400 S1.044:L433:SRC:31 S1.045:L439:SRC:558
S1.046:L446:BOARD:15 S1.047:L453:BOARD:38 S1.048:L464:SRC:771 S1.049:L470:SRC:2759 S1.050:L477:BOARD:180
S1.051:L483:BOARD:914 S1.052:L496:HTTP_WRITE:91 S1.053:L501:WATCH:959! S1.054:L507:WATCH:284 S1.055:L520:TASK:4925
S1.056:L528:PANE:1217 S1.057:L541:HTTP_WRITE:204 S1.058:L546:SRC:763 S1.059:L553:SRC:185 S1.060:L566:SRC:128
S1.061:L573:SRC:774 S1.062:L585:TASK:1238 S1.063:L591:SRC:2830 S1.064:L598:LEDGER:430 S1.065:L609:LEDGER:31
S1.066:L616:LEDGER:1363 S1.067:L623:SRC:31 S1.068:L629:SRC:715 S1.069:L641:SRC:91 S1.070:L647:SRC:430
S1.071:L674:HTTP_WRITE:95 S1.072:L678:HTTP_WRITE:179 S1.073:L683:CTL:417 S1.074:L687:CTL:221 S1.075:L691:CTL:181
S1.076:L701:SRC:1004 S1.077:L718:LOCAL_WRITE:109 S1.078:L725:CTL:300 S1.079:L733:WATCH:284 S1.080:L750:HTTP_WRITE:1406
S1.081:L763:HTTP_WRITE:951 S1.082:L782:CTL:2184 S1.083:L787:SRC:251 S1.084:L801:SRC:557 S1.085:L813:CTL:1335
S1.086:L818:SRC:2341 S1.087:L825:SRC:3875 S1.088:L830:SRC:314 S1.089:L842:LEDGER:152 S1.090:L848:LEDGER:431
S1.091:L855:LEDGER:822 S1.092:L862:PLAN:1349 S1.093:L872:BOARD:618 S1.094:L877:TASK:751 S1.095:L884:CTL:263
S1.096:L907:CTL:504 S1.097:L920:PANE:2138 S1.098:L927:SRC:6875 S1.099:L937:SRC:68 S1.100:L943:SRC:394
S1.101:L962:HTTP_WRITE:48 S1.102:L967:SRC:138 S1.103:L973:SRC:92 S1.104:L980:HTTP_WRITE:200 S1.105:L993:WATCH:284
S1.106:L1002:SRC:2139 S1.107:L1009:CTL:62 S1.108:L1029:BOARD:760 S1.109:L1034:SRC:452 S1.110:L1046:SRC:2284
S1.111:L1052:SRC:922 S1.112:L1058:SRC:1350 S1.113:L1075:BOARD:113 S1.114:L1086:SRC:411 S1.115:L1097:HTTP_WRITE:389
S1.116:L1114:LOCAL_WRITE:366 S1.117:L1129:LOCAL_WRITE:100 S1.118:L1136:PANE:768 S1.119:L1144:HTTP_WRITE:117 S1.120:L1149:BOARD:531
S2.001:L25:BOOT:10362 S2.002:L37:BOOT:1442 S2.003:L43:BOOT:16086 S2.004:L54:BOOT:22315 S2.005:L65:BOOT:16208
S2.006:L78:CTL:2301 S2.007:L86:BOARD:476! S2.008:L91:BOARD:275! S2.009:L102:BOARD:69 S2.010:L107:SRC:1423
S2.011:L115:BOARD:7445 S2.012:L129:PANE:6414 S2.013:L138:LEDGER:10104! S2.014:L149:TASK:23298 S2.015:L166:LEDGER:10902
S2.016:L180:LEDGER:22013 S2.017:L196:TASK:7012 S2.018:L210:TASK:8553 S2.019:L225:CTL:1039 S2.020:L232:HTTP_WRITE:2420
S2.021:L246:WATCH:15379 S2.022:L260:WATCH:284 S2.023:L265:TRANSCRIPT:11876 S2.024:L279:TRANSCRIPT:4131 S2.025:L286:TRANSCRIPT:9070
S2.026:L298:SRC:1076 S2.027:L312:SRC:2706 S2.028:L321:SRC:2817 S2.029:L335:SRC:185 S2.030:L342:SRC:2372
S2.031:L351:LOCAL_WRITE:210 S2.032:L364:LOCAL_WRITE:767 S2.033:L378:SRC:853 S2.034:L386:SRC:340 S2.035:L400:HTTP_WRITE:246
S2.036:L407:SRC:5316 S2.037:L421:HTTP_WRITE:1127 S2.038:L430:PLAN:1190! S2.039:L439:PLAN:632 S2.040:L446:SRC:388
S2.041:L453:SRC:680 S2.042:L467:HTTP_WRITE:542 S2.043:L484:HTTP_WRITE:22 S2.044:L502:SRC:3287 S2.045:L516:SRC:3779
S2.046:L536:HTTP_WRITE:13 S2.047:L565:SRC:828 S2.048:L571:SRC:17389 S2.049:L587:SRC:4101 S2.050:L592:BOARD:5072
S2.051:L602:SRC:6422 S2.052:L609:SRC:2990 S2.053:L622:SRC:9962 S2.054:L625:SRC:18496 S2.055:L637:BOARD:1221
S2.056:L645:HTTP_WRITE:270 S2.057:L658:HTTP_WRITE:230 S2.058:L664:CTL:2524 S2.059:L686:WATCH:284 S2.060:L703:PANE:1598
S2.061:L711:HTTP_WRITE:151 S2.062:L724:SRC:9269 S2.063:L729:SRC:1052 S2.064:L755:TRANSCRIPT:1923 S2.065:L762:TRANSCRIPT:292
S2.066:L775:BOARD:193 S2.067:L781:HTTP_WRITE:752 S2.068:L787:HTTP_WRITE:167 S2.069:L794:TRANSCRIPT:51 S2.070:L805:TRANSCRIPT:336
S2.071:L811:LOCAL_WRITE:208 S2.072:L822:CTL:769 S2.073:L828:CTL:235 S2.074:L852:HTTP_WRITE:137
S3.001:L23:BOOT:7461 S3.002:L33:BOOT:5021! S3.003:L37:BOOT:9854 S3.004:L38:SELF:2470 S3.005:L52:CTL:1910!
S3.006:L57:CTL:736! S3.007:L63:BOARD:51 S3.008:L67:BOARD:18 S3.009:L76:SRC:288 S3.010:L82:SRC:31
S3.011:L88:SRC:31 S3.012:L95:SRC:795 S3.013:L101:SRC:116 S3.014:L113:BOARD:3192 S3.015:L118:BOARD:2387
S3.016:L123:TASK:8604 S3.017:L135:SRC:210 S3.018:L146:SRC:2001 S3.019:L153:WATCH:2 S3.020:L157:WATCH:284
S3.021:L163:TASK:951 S3.022:L175:SRC:801 S3.023:L183:WATCH:217 S3.024:L201:WATCH:284 S3.025:L207:CTL:97!
S3.026:L211:CTL:42 S3.027:L227:PANE:179 S3.028:L231:PANE:4380 S3.029:L239:HTTP_WRITE:307 S3.030:L251:WATCH:284
S3.031:L265:GIT:2736 S3.032:L278:SRC:818 S3.033:L283:SRC:958 S3.034:L292:SRC:14834 S3.035:L307:SRC:13198
S3.036:L319:SRC:13464 S3.037:L342:CTL:96! S3.038:L347:CTL:130 S3.039:L362:CTL:918 S3.040:L368:SRC:31
S3.041:L374:SRC:1717 S3.042:L385:SRC:2330 S3.043:L390:TASK:185 S3.044:L397:HTTP_WRITE:11 S3.045:L415:HOST:1492
S3.046:L418:TASK:4272 S3.047:L430:TASK:6369 S3.048:L435:HOST:1208 S3.049:L447:HOST:213 S3.050:L454:LEDGER:1436
S3.051:L462:HOST:707 S3.052:L481:CTL:1203 S3.053:L487:HTTP_WRITE:226 S3.054:L497:WATCH:906 S3.055:L502:PLAN:397
S3.056:L506:PLAN:1035 S3.057:L516:PLAN:587 S3.058:L522:CTL:211 S3.059:L534:SRC:1511 S3.060:L548:SRC:1016
S3.061:L553:SRC:6971 S3.062:L573:SRC:2217 S3.063:L578:HOST:361 S3.064:L583:SRC:450 S3.065:L596:SRC:91
S3.066:L603:SRC:1313 S3.067:L610:SRC:202 S3.068:L624:SRC:723 S3.069:L630:SRC:1490 S3.070:L637:SRC:264
S3.071:L658:HOST:286 S3.072:L667:HOST:88 S3.073:L673:HOST:119 S3.074:L681:HOST:107 S3.075:L692:HOST:274
S3.076:L699:HOST:276! S3.077:L706:SRC:4050 S3.078:L719:BOARD:510 S3.079:L735:SRC:1270 S3.080:L741:SRC:829
S3.081:L749:SRC:1616 S3.082:L760:VERIFY:262 S3.083:L767:LOCAL_WRITE:373 S3.084:L773:TASK:3550 S3.085:L783:SRC:1005
S3.086:L792:LOCAL_WRITE:276 S3.087:L804:HTTP_WRITE:1682 S3.088:L812:HTTP_WRITE:115 S3.089:L823:WATCH:609 S3.090:L831:SRC:2878
S3.091:L843:PANE:335 S3.092:L849:LEDGER:331 S3.093:L855:LEDGER:1966 S3.094:L867:SRC:1238 S3.095:L874:SRC:2263
S3.096:L882:HOST:145 S3.097:L895:WATCH:1176! S3.098:L901:WATCH:38 S3.099:L907:LEDGER:142 S3.100:L920:SRC:1633
S3.101:L927:HOST:576 S3.102:L935:HOST:47 S3.103:L948:TASK:700 S3.104:L956:TASK:1375 S3.105:L967:SRC:641
S3.106:L973:HTTP_WRITE:16 S3.107:L980:CTL:211 S3.108:L989:WATCH:284 S3.109:L1001:CTL:3422 S3.110:L1013:TASK:49
S3.111:L1019:HTTP_WRITE:131
```
