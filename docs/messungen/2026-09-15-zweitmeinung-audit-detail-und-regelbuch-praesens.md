---
frage: Tragen Audit-Fail-Details und ein verlustfreier Praesens-Pass fuer Einstieg und Deploy?
urteil: 'I1 anders: additive gekappte Details und ein lesendes Audit-Verb; I3 nur Teile: Widersprueche klaeren, Regeln inventarisieren, Geschichten gezielt auslagern.'
bereich: [audit, kontext, regelbuch]
belege: [server.ts, helper-daemon/daemon.ts, ctl.sh, rulebook.ts, e2e/pins.ts, e2e/helper-daemon.ts, fleet-e2e-postland-audit.ts, docs/attic/regelbuch-messgeschichten-2026-08.md, docs/messungen/2026-09-14-lane-startkontext-fixkosten.md]
nicht-gemessen: 'Konkreter roter Lauf aus dem Brief; Live-Modelle der Orchestrator-Slots; MAIN-Tokenkosten je Turn; semantische Vollstaendigkeit eines kuenftigen Neurenders.'
stand: 2026-09-15
---

# Zweitmeinung: Audit-Detail und Regelbuch im Praesens

## Messgrenze

Gelesener Codebaum: `ee33a2b13a7ffc1a3980dfbeb4aaf9746d42c0ff` (Ausgangs-HEAD, kein eigener Ergebnis-Commit). Geprueft sind die unten bezeichneten Quellen und Ausschnitte; Implementierungsverhalten ist aus Code abgeleitet, kein nachgestellter Audit-Lauf. Graphify lieferte Suchanker; die Aussagen beruhen auf gelesenen Quellen.

**Der Brief irrt bei der Kopie:** Diese Lane hat 21 010 Bytes `CLAUDE.md`, 239 Zeilen, ohne Einstieg und Deploy (`CLAUDE.md:224`). `rulebook.ts:22` bestimmt die Reihenfolge, `rulebook.ts:37` die Auswahl; `rulebook.ts:70` rendert mit Leerzeilen, `rulebook.ts:117` baut den Rueckverweis. Deshalb wurden ausschliesslich die beiden angeforderten Fragmente ueber diesen Rueckverweis im Quell-Checkout gelesen. Das ist eine aktuelle Quellenlesung, kein rekonstruiertes Volltextinventar der Lane-Kopie. Lokales `rulebook/` fehlt erwartungsgemaess.

Die private Quelle wird hier nur ueber relative Anker bezeichnet, keine Maschinenidentitaet kopiert. SHA-256 der gelesenen Fragmente: Einstieg `fb1c3643df558afc786c7accf74fcc048d9aef6954414fae76b2148a29280d07`, Deploy `a1ce26eea03c8e9d787b7084e7b4ba18a005e9d40b691c5e2530f7037aab79cc`. Sie sind ungetrackt; diese Hashes identifizieren den Messstand, machen ihn aber nicht oeffentlich abrufbar.

## Teil I1 — Rote Audit-Zeile mit Fail-Detail

### Befund und Urteil: **anders**

Diese Abstraktion soll existieren: Eine Audit-Zeile braucht eine kleine Diagnose direkt am gemessenen Fail, damit ihr Leser ohne Maschinenwechsel urteilen kann. **Die stabilen Fail-Namen duerfen dafuer nicht zu zusammengesetzten Name-plus-Detail-Strings werden.** Das wuerde bestehende Vergleiche und Zuordnungen veraendern. Ein additives Detailfeld genuegt; ein zweites Logsystem braucht es nicht.

| Grenze | Gelesener Beleg | Heutiges Verhalten und Kosten |
|---|---|---|
| Check erzeugt Diagnose | `e2e/harness.ts:76` | `check(name, ok, detail)` erzeugt `FAIL  name  (detail)` und uebergibt das Detail an `writeTrailRow`. Die Information existiert vor dem Transport. |
| Helfer liest Trail | `helper-daemon/daemon.ts:364` | Aus Zeilen mit `ok === false` wird ausschliesslich `check` gesammelt. `detail` wird gar nicht gelesen. |
| Helfer faellt auf Log zurueck | `helper-daemon/daemon.ts:379` | Vollstaendiges Log, `^FAIL `; der Regex entfernt den Suffix ab zwei Leerzeichen und `(`. Fruehe Fails werden gefunden, ihre Diagnosen verworfen. |
| Wire | `helper-daemon/daemon.ts:677` | `report` sendet `fails` plus einen Tail der letzten 40 nichtleeren Zeilen aus dem Dateiende. Ein fruehes Detail gelangt nicht verlaesslich in diesen Tail. |
| Server-Grenze | `server.ts:17573`, Konstanten `server.ts:17347` | `helperFailNames` akzeptiert nur ein String-Array, kappt auf 50 Namen und 300 Zeichen pro Name. **Hier wird der Detail-Suffix nicht entfernt**; das geschieht davor. Objekte anstelle von Strings wuerden das gesamte Feld ungueltig machen. |
| Lokaler Lauf | `server.ts:18421`, `server.ts:18638`, `server.ts:18677` | `localFailNames` liest den vollstaendigen Output, schneidet denselben Suffix ab, danach normalisiert `helperFailNames`. `out` behaelt hoechstens 4096 Bytes (`server.ts:17002`), kein vollstaendiges Diagnosearchiv. |
| Ledger | `server.ts:204`, `server.ts:18692`, `server.ts:18713`, `server.ts:19910`, `server.ts:19951` | Lokaler `runPostLandAudit` und Remote-`helperResult` bauen `PostLandAuditRow` und appenden in `post-land-audits.jsonl` neben `server.ts`. `fails?: string[]` ist ausdruecklich das Namensfeld (`server.ts:17145`); `covers` ordnet mitgemessene Lands zu. |
| Shards | `server.ts:20108`, `server.ts:20189` | Shard-Resultate speichern dieselben Namen; die Sammelzeile dedupliziert sie und kappt nochmals auf 50. Nur den ungeshardeten Pfad zu reparieren liesse einen vorhandenen Produktionspfad offen. |
| Leseflaechen | `server.ts:14430`, `server.ts:14468`, `server.ts:31757` | Audit-Ping projiziert Namen plus kurzen Tail. Der GET liefert ganze Zeilen inklusive `out`; ein neues Feld ist dort durch Spread zugaenglich. Kein Detail kann aus bereits verworfenen Bytes rekonstruiert werden. |

**Gegen die Begruendung „nur per ssh“:** Der Daemon versucht bereits nach dem Verdict einen `suite.log`-Upload (`helper-daemon/daemon.ts:712`), maximal 8 MiB, ohne Retry. Der Server fuegt `remote.artifact` beim GET hinzu; der Abruf erfolgt ueber `GET /api/post-land-audits/artifact?at=…` (`server.ts:31769`, `server.ts:31790`), mit unterscheidbarem „nicht vorhanden“ und „geprunt“. Bei Shards erhaelt erst der abschliessende Reporter einen Zeilenschluessel (`server.ts:20137`); damit ist der Upload gerade **kein garantierter vollstaendiger Logsatz aller Shards**. Fuer den im Brief genannten Vorfall ist weder ein vorhandenes Artefakt noch dessen Fehlen nachgemessen. „Detail nur per ssh geholt“ bleibt ein Vorfallsbericht, keine bewiesene Systemeigenschaft.

### Kartenfertiger Kopf — Vorschlag, nicht gefilt

```text
TITEL: Rote Audit-Zeilen behalten gekappte Fail-Details; ctl.sh audit liest sie per SHA
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: server.ts#PostLandAuditRow, #AuditShardResult, #helperFailNames, #localFailNames, #runPostLandAudit, #helperResult, #reportAuditShard, #shardedAuditRowOf, #fetch (Bun.serve, GET /api/post-land-audits); helper-daemon/daemon.ts#failNamesOf, #report; ctl.sh#CTL_VERBS, #usage und Verb-Dispatch; e2e/helper-daemon.ts#run; e2e/ctl.ts#run; fleet-e2e-postland-audit.ts#startSrv und Audit-Fixtures; docs/controller.md Abschnitt Werkzeuge
VERIFY: GET /api/self/gate; dessen lokale Schritte in Reihenfolge; zusaetzlich ./e2e-postland-audit.sh und ./e2e-isolated.sh gemaess AGENTS.md (Helper-Angebot zuerst, wenn faellig und verfuegbar).
DONE: Ein lokaler, ein Remote- und ein geshardeter roter Fixture-Lauf liefern nach Persistenz/Neulesen unveraenderte Fail-Namen plus zugeordnete Details von hoechstens 512 UTF-8-Bytes; das gesamte serialisierte Zusatzfeld bleibt hoechstens 64 KiB, hoechstens 50 Detail-Eintraege, Kappung ist sichtbar; ctl.sh audit <sha> --repo <path> liest exakt passende Audit-Zeilen mit Details und unknown bei fehlenden Details; Entfernen des Detailfeldes aus einem Report-Body macht den Remote-Check rot.
VERBOTEN: Verdict-, Adjudikations-, Watch- oder Land-Semantik aendern; bestehendes fails umtypisieren; Altzeilen migrieren; Detail als Anweisung behandeln; Host- oder Deploy-Aenderungen.
```

Der Kopf nennt die vorhandenen Naehte; neue Parser-/Validator-Symbole bestimmt die Baulane. `server.ts` ist mit `rg -an` zu lesen. Das `ctl.sh`-Verb braucht auch den Werkzeuge-Absatz: `e2e/pins.ts:8433` bindet Deklaration, Usage und Dokumentation aneinander. Keine neue Datei erforderlich.

**Pruefbarer Detailvertrag:** additives optionales `failDetails`, Eintraege mit `name`, `detail` (String oder `null`), `truncated` und bei Shards einer Herkunft. Fehlende/ungueltige Details bleiben unbekannt, niemals leer erfunden. Mehrere gleichnamige Fails behalten unterscheidbare Eintraege bis zum gemeinsamen Deckel; die bestehende deduplizierte `fails`-Liste bleibt unveraendert. Verwaiste Details ohne passenden Fail-Namen werden verworfen. UTF-8-Kappung darf keine halben Zeichen produzieren; Steuerzeichen werden entfernt. Zaehler fuer verworfene Eintraege und Kappung muessen sichtbar sein. Der Server begrenzt unabhaengig vom Daemon; am Shard-Zusammenbau gilt der Deckel erneut. Der Deckel fuer das serialisierte Zusatzfeld umfasst JSON-Escaping und Metadaten, nicht nur die Summe der Detailstrings. Alte Helfer/Altzeilen bleiben lesbar. Ein fehlendes oder defektes Zusatzfeld entwertet nicht das bestehende Verdict.

**Quelle:** strukturierter Trail, soweit lesbar; fuer dort fehlende Diagnosen Log-Fallback pro Fail, aus dem ganzen Log vor Tail-Kappung. Ein leeres oder fehlendes Trail-Detail darf vorhandene Log-Diagnose nicht verdecken. Bei Parser-Mehrdeutigkeit `unknown` statt erfundener Zuordnung. Der Original-Trail kann bereits gekappt sein (`e2e/trail-emit.ts:326`); das Zusatzfeld behauptet deshalb keine Vollstaendigkeit des urspruenglichen Details.

**Das lesende Verb:** `./ctl.sh audit <sha> [--repo <path>] [--json]`. SHA im angegebenen Repo mit Git zu einem Commit aufloesen; gegen `mainSha` **oder** `covers[].mainAfter` matchen. Existierende Owner-GET-Route um optionalen Repo-/SHA-Filter **vor** `limit` erweitern: bloss die neuesten 100/1000 Zeilen lokal zu filtern koennte ein vorhandenes Audit als fehlend ausgeben. Mehrere passende Laeufe mit Zeit und gemessenem Tip anzeigen, nicht willkuerlich einen als einzigen ausgeben. Kein Treffer ist „keine Audit-Zeile gefunden“, nicht „laeuft noch“. Exit 0 bedeutet Treffer, auch bei rotem Audit; Exit 1 keinen Treffer, Exit 2 ungueltiges Argument/Auth-/Leseproblem. Keine automatische Log-Ausgabe; Artefaktverweis neben `out` und Detail nennen. Das Verb ist ein Owner-Leser und erweitert keine Self-Token-Reichweite.

**Proben gegen die Spezifikation:** Frueher Fail plus genug Nachlauf, dass das Detail ausserhalb des Tails liegt; Detail exakt erhalten; 512/513 ASCII-Bytes und mehrbyteige Zeichen; 50/51 Eintraege; leeres Log, fehlender Trail, zerrissene JSONL-Zeile, `null`, Objekte statt Strings, Steuerzeichen, gleiche Namen mit verschiedenen Details in zwei Shards. Die Detail-Transport-Mutation oben muss rot werden; eine zweite Mutation, Filter erst nach `limit`, muss den Abruf eines aelteren passenden Audits brechen. Bestehende Names-only-Fixtures bleiben gruen. Das sind Anforderungen fuer die Baulane, hier nicht ausgefuehrte Tests.

**Oberflaechenentscheidung:** apply = lokaler Produzent, Daemon/Wire, Servervalidierung, Shard-Persistenz/Aggregation, Ledger-GET, CLI, Dokumentation und Proben. not-applicable = Providerwahl, Slot-Lifecycle, neuer Board-Dialog, Aenderung von Push-/Watch-/Ping-Inhalten; diese behalten Namen und ihre bisherigen Grenzen, Diagnose wird explizit abgerufen. unsupported = Details alter Zeilen ohne erhaltenes Log rekonstruieren. Kosten: begrenztes Ledger-Wachstum und ein kompatibel zu haltendes optionales Feld; Gewinn: die haeufige erste Diagnose braucht keinen Voll-Log-Transfer. **Keinen universellen Logparser und keinen automatischen SSH-Fallback bauen.**

## Teil I3 — Praesens-Pass

Diese Aufteilung soll existieren: verbindliche Gegenwartsregel im Einstieg, begrenzte Begruendung daneben, datierte Messgeschichte ueber einen Anker erreichbar. Eine pauschale Entfernung aller Daten waere die falsche Abstraktion: Daten unterscheiden Promotion, Beobachtung und veralteten Zustand.

### Absatzinventar des gelesenen Standes

E = `rulebook/einstieg.md`, P = `rulebook/deploy.md` im privaten Quell-Checkout. Bereiche sind inklusive; jede Textpassage hat einen Anker, verschachtelte Listen eigene Zeilen. Tabellenzeilen sind **Inventarparaphrasen, keine promotierten Ersatzregeln**. Bei gemischten Absaetzen klassifiziert die Art den jeweiligen Kern; datierte Belege bleiben mit ihm verbunden. „ueberholt“ bezeichnet eine zu klaerende Formulierung, nicht die Erlaubnis, ihre enthaltene Schutzregel zu loeschen. Jede Regelzelle bleibt unter 26 Woertern.

| ID / Anker | Regel im Praesens | Art |
|---|---|---|
| E01 · E:3–11 | MAIN liest Zustand, Arbeitsregister, datierten Snapshot, obersten Handoff und Live-Queue; alte Backlogs gelten nicht als aktueller Arbeitsstand. | Default |
| E02 · E:12–17 | Zustand wird abgeleitet; Handoff bewahrt Absicht, laufende Arbeit, Korrekturen, Reihenfolge und Begruendung. | Default |
| E03 · E:18–19 | Idle allein beweist keinen Abschluss; Pane, Commits und schmutzigen Baum gemeinsam lesen. | harte Invariante |
| E04 · E:20 | Fertige Arbeit mit Commits ist Land-Kandidat. | Default |
| E05 · E:21–22 | Reine Messarbeit ohne Dateien braucht keine Commits; ihren Bericht vor Slot-Ende ernten. | Default |
| E06 · E:23–24 | Nach Kriterienbestaetigung braucht eine wartende Lane eine Zustellung. | Default |
| E07 · E:25–28 | Scout-Vorschlaege werden vor Dispatch geklaert; unchanged beim Refine macht keinen Auftrag. | Default |
| E08 · E:29–32 | Vor dem Abwenden einen Rueckweg armieren; die pauschale Behauptung fehlender Eingangskanaele gilt nicht mehr. | ueberholt |
| E09 · E:33–38 | Nicht-Lanes abonnieren Lane-Watches; Lanes erhalten 409 und brauchen einen anderen Rueckweg. | harte Invariante |
| E10 · E:39–42 | Fuer Zustaende ohne passenden Rueckkanal dient ein stiller Hintergrund-Watcher auf die Terminalbedingung. | Default |
| E11 · E:43–46 | Ein eigener One-Shot-Auto bleibt Ausnahme; Timer und Composer-Verschmelzung begrenzen seine Eignung. | Default |
| E12 · E:47–49 | Handarbeitsanweisungen gegen aktuellen Code pruefen; die Geschichte bleibt im Attic. | Default |
| E13 · E:50–60 | Lands serialisieren, Audit nicht abwarten; Sammel-Rot verlangt Zuordnung, Undo reicht nur drei kontigue Lands; feste Laufzeitangaben sind historische Messwerte. | Default |
| E14 · E:61–67 | Uncommittete Lane-Arbeit vor Mutationsproben sichern oder committen; checkout darf sie nicht verwerfen. | harte Invariante |
| E15 · E:68–74 | Direkt-Commits umgehen Land-Ledger und Audit; volle Handverifikation und Handoff-Offenlegung sind erforderlich. | Default |
| E16 · E:75–92 | Dirty-main blockiert ueberlappende Dateien vor Gate und vor Fast-forward; MAIN-Edits kurz halten und bewusst committen. | Default |
| E17 · E:93–106 | MAIN-Bewegung kann volle Retry-Gates kosten; Wartelimit und Rebase-Konflikt bleiben Abbruchgruende. | Default |
| E18 · E:108–115 | Vor MAIN-Commit ctl.sh merges lesen; running oder interrupted ohne verify beachten, Suite-Mutex ist kein Ersatzsensor. | Default |
| E19 · E:116–127 | Claude-MAIN entscheidet bei 25 Prozent ueber Nachfolge, beginnt ab 30 keine unklare Tiefenarbeit; kurze Abschluesse duerfen enden. | Default |
| E20 · E:119–125 | Autonomie nutzt schlanken Brief und wirkliche Nachfolge; Handoff-Commits dienen echter Nachfolge, Zwischenstaende gehoeren in Program-Record oder Commit-Body. | harte Invariante |
| E21 · E:120–127 | Keine neue Auto-Compact-Schwelle oder pauschale Controller-Ausnahme; Rollengates bleiben, Codex nutzt eigene Compaction, konkrete Owner-Vorgaben und Restarbeit entscheiden. | Default |
| E22 · E:128–136 | Claude-Kontext mit ctl.sh ctx messen; null bleibt unmessbar, GPT meldet selbst, Schaetzungen tragen Tilde; URL-Default nicht frei erfinden. | Default |
| E23 · E:137–138 | Historische Kontext-Messungen bleiben ueber Attic erreichbar. | Messgeschichte |
| E24 · E:139–142 | Retirierte Rollback-, rerere-, Hook-, Shadow- und Eval-Vorhaben nicht ohne neue Entscheidung wieder oeffnen. | Default |
| E25 · E:143–150 | Nur selbst geoeffnete oder ausdruecklich zugewiesene Slots schliessen; vorher Program und Label lesen, fremde Aufraeumwuensche melden. | harte Invariante |
| E26 · E:152–156 | Ideen ohne pruefbares Done und Verify werden geschaerft oder geklaert, nie direkt dispatcht. | harte Invariante |
| E27 · E:158–168 | Fable orchestriert, Opus arbeitet in Lanes; Broadcasts buendeln, Datensatz und Pane beim Modellwechsel konsistent halten, Footer pruefen. | Default |
| E28 · E:168–174 | Die naechste echte Controller-Nachfolge erprobt Opus mit gleicher Leistung ohne zusaetzliche Attentions; Rueckfall erfolgt ueber Nachfolge, keine kuenstliche Ausloesung. | Messgeschichte |
| E29 · E:175–181 | Kontingent vor Antritt und Filing messen; bei ueber zehn Punkten Rueckstand Beratung mit vollstaendigem Brief an Astra geben. | Default |
| E30 · E:182–188 | GPT-Briefing beruecksichtigt eigenes Fenster, Inputkosten und fixe Bytes; Claude-Prozentmarken sind nicht uebertragbar. | Default |
| E31 · E:189–192 | Briefs nennen bekannte Dateibereiche; historische Dateilaengen ersetzen keine aktuelle Messung. | Default |
| E32 · E:193–198 | Server-Blattmodule bleiben ohne Import aus server.ts separat lesbar. | harte Invariante |
| E33 · E:199–200 | GPT liest angeforderte private Abschnitte, nicht das ganze Regelbuch; AGENTS wird automatisch geladen. | Default |
| E34 · E:201–202 | Briefs nennen Suchwerkzeuge; ein fehlender Lane-Graph bedeutet keinen Architektur-Lesestopp. | ueberholt |
| E35 · E:203–204 | Suite-Ausgabe geht in eine Datei; Kontext erhaelt den aussagekraeftigen Tail. | Default |
| E36 · E:205–206 | GPT erhaelt einen begrenzten Schnitt, kein ganzes Programm. | Default |
| E37 · E:207–208 | GPT meldet Fuellstand selbst, solange der Slot-Sensor null liefert. | Default |
| E38 · E:209 | GPT-Kontextmessungen bleiben datiert im Attic. | Messgeschichte |
| E39 · E:210–212 | Fremde Modelle erhalten dichtere Briefs mit benoetigter Hostrealitaet. | Default |
| E40 · E:213–221 | Task-Dispatch erhaelt Harness, Modell, Effort und Task-Link; Modellvalidierung bleibt geteilt, Alive-Gate bleibt trotz Owner-Waiver bindend. | harte Invariante |
| E41 · E:222–227 | Pi bekommt portablen Kern; private Naehte gezielt briefen und Loaderverhalten nach Aenderungen erneut beobachten. | Default |
| E42 · E:228–230 | Schwaechere Modelle bekommen kleinere Aufgaben, niemals unvollstaendige Done-, Verify- oder Verbotsangaben. | Default |
| E43 · E:231–233 | Effort-, Task-Link- und Loader-Messgeschichten bleiben im Attic. | Messgeschichte |
| E44 · E:234–240 | Codex-Dispatch wartet begrenzt auf Readiness, requeued bei blockiertem Screen; manuelles Nachsenden bleibt Notweg. | harte Invariante |
| E45 · E:241 | Codex-Unteragentenansicht ueber gesicherten Composer und Agent-Picker verlassen; Esc kann Main unterbrechen, Footer zeigt den Thread. | Default |
| E46 · E:242–244 | Genau ein optionaler Steward arbeitet isoliert, briefed Lanes und landet nicht selbst. | Default |
| E47 · E:246 | MAIN-Tueren fehlen im Lane-Render; pauschales Lane-409 muss die eigene succeed-Schiene ausnehmen. | ueberholt |
| E48 · E:247–256 | Gebundene MAIN released eigene pending-Tasks ohne Dispatch; Repo-, Politik-, Hold- und Deckelregeln bleiben wirksam. | harte Invariante |
| E49 · E:257–258 | Scope-Verweigerung lautet 409, nicht 401. | harte Invariante |
| E50 · E:259–270 | Lanes duerfen weder abonnieren noch releasen oder retiren; succeed hat eigene Lane-Schiene, Steward-Sperren und weitere Owner-Watch-Reichweite bleiben. | harte Invariante |
| E51 · E:271–286 | Lane-, Merge- und Audit-Watches sind einmalig; Merge-Ausgang sofort abonnieren, Signal nicht als Beweis behandeln, idleSec null Sekunden und Events quittieren. | Default |
| E52 · E:287 | Nachfolge richtet sich nach wirklicher Rollenbindung. | harte Invariante |
| E53 · E:288–291 | Standard-MAIN braucht keinen neuen Handoff-Commit; offene Pflichten dauerhaft erhalten, handover lesen, Watches nicht als automatisch rearmiert behaupten. | harte Invariante |
| E54 · E:292 | Legacy und Supervisor brauchen sauberen, juengeren Handoff-Commit. | harte Invariante |
| E55 · E:293 | Game-Maker nutzt eigenen committeten Checkpoint und Nachfolgepfad, kein generisches carry. | harte Invariante |
| E56 · E:294–301 | Nachfolge beweist exakte Bindung und lesbare Pflichten; Receipt und carry genuegen nicht, fehlende Quellen bleiben unknown, keine blinde Doppelmeldung. | harte Invariante |
| E57 · E:302–305 | Doc-Arbeit vor Lane-Spawn committen und vor Land mit MAIN-Arbeitskopie abgleichen; behauptete stille Regression beruecksichtigt dirty-main nicht. | ueberholt |
| P01 · P:3–7 | Normaler Deploy nutzt die Deploy-Route; Watchdog-Aenderungen brauchen eigenen Neustart, ein srv-Neustart allein aktiviert sie nicht. | ueberholt |
| P02 · P:8–16 | Oeffentliche Dateien enthalten keine privaten Identitaeten oder Tokens; Deploywerte bleiben privat, shell-gequotet und im Kindprozess geladen; Leak-Pruefung bleibt Pflicht. | harte Invariante |
| P03 · P:17–22 | Umgeschriebene oeffentliche Historie entwertet lokale SHA-Zitate; private Sicherheitsnotizen und alte Branches nicht blind veroeffentlichen oder mergen. | Messgeschichte |
| P04 · P:23–28 | Deploy-Health an konfigurierter Bindeadresse und Owner-Poll pruefen; bundleStale, deployGap und errors beachten, veralteten Client bauen. | Default |
| P05 · P:29–34 | Verify-Skip bleibt null und verhindert Auto-Land; unkonfiguriert ist davon verschieden, Watchdog-Konfiguration wird erst nach Neustart aktiv. | harte Invariante |
| P06 · P:35–42 | Repair-, Clean-review- und Automationsflags getrennt behandeln; Automatisierung verlangt Zustimmung plus Adapterfaehigkeit, kein Tick landet, Suiten isolieren Flags. | Default |
| P07 · P:43–57 | Autoclose braucht alle benannten Nachweise und killed-empty; unbekanntes Flag bleibt aus, nur Outcome markiert Automatik, Aktivierung verlangt Owner-Akt. | harte Invariante |
| P08 · P:58–75 | Datierter Autoclose-Erfolg zeigt Paint-Timer-Kopplung; Schwellen gelten nur fuer gemessenen Harness, andere TUIs bleiben ungeprueft. | Messgeschichte |
| P09 · P:76–80 | Env-Sonden unterscheiden Variablen von Zuweisungstext innerhalb anderer Werte. | harte Invariante |
| P10 · P:81–89 | Normale Harnesses haben Vollzugriff und committen selbst; Codex braucht Trust plus Readiness, Host-Commit bleibt Notweg, Container bleibt Sonderfall. | Default |
| P11 · P:90–95 | Lesereichweite ist Provider-Vertrauen; bind-gemountete Hostkopien sind keine isolierten Volumes. | harte Invariante |
| P12 · P:96–100 | Ausfuehrbare Artefakte werden durch Ausfuehrung geprueft, nicht bloss durch Textfund. | harte Invariante |
| P13 · P:101–105 | Tool-Scoping beachtet additive Settings; echte Faehigkeitsbegrenzung und mechanische Ablehnung muessen beobachtet werden, Modellweigerung beweist keine Sperre. | harte Invariante |
| P14 · P:106–116 | Audit misst Integration ohne Gate oder Rollback; proportionale Ausnahme beachten, Undo ist kontiguer Dreierstack, Adjudikation aendert Rot nicht. | ueberholt |
| P15 · P:117–121 | Netzantwort-Casts ersetzen keine Feldpruefung; fehlende Poll-Felder aus autoritativer Quelle beziehen und Voraussetzung eigenstaendig testen. | harte Invariante |
| P16 · P:122–127 | Audit-Gruen braucht Nachweis gemessener Checks und ausgefuehrter Kette; historische Dauer ist kein allgemeiner Echtheitsbeweis. | ueberholt |
| P17 · P:128–135 | Fehlende Audit-Zeile beweist weder laufenden noch verlorenen Lauf; erst Terminal- und Laufzustand feststellen. | ueberholt |
| P18 · P:136–146 | Deploy setzt Idle-Beobachtungszeit neu; vorher Programme mit laufenden Idle-Fenster-Messungen abstimmen. | harte Invariante |
| P19 · P:147–158 | Deploy-Route baut vor Restart, Folgeboot urteilt dreiwertig; Audit blockiert Deploy, Automatik ruft die Route nicht, Watchdog bleibt Sonderweg. | harte Invariante |
| P20 · P:159–163 | Gast-Konsole bleibt entfernt; Container ist Agentenzaun, Share bleibt Zuschauerfenster. | Default |
| P21 · P:164–168 | Share verwirft Gast-Input; Kommentare bleiben Rueckkanal, entfernte Pfade nicht als aktuelle Backtick-Pfade dokumentieren. | harte Invariante |
| P22 · P:169–184 | Dispatch-Zustand messen; Tick nimmt queued, Maschinen koennen requeuen, nur Auftrag ist freigebbar; Handdispatch umgeht Stop/Deckel/Quiet-Hours, Analyse ist retired. | Default |
| P23 · P:181–184 | Brief-Kompiler hat eigenen Default-aus-Schalter; Tests ohne Stand-in verhindern echte Agentenstarts. | harte Invariante |
| P24 · P:185–189 | Auto-Review ist Default-an, kein Gate; Tests ohne Review-Stand-in schalten den Tick aus. | harte Invariante |
| P25 · P:190–191 | Defaultmodell und Wegwerf-Workermodell bleiben getrennte, validierte Einstellungen. | Default |
| P26 · P:192–197 | Repo-Worker ueberschreibt Env; gespeicherten Executable-Pfad per API lesen, keine Kommandozeile und keine weiteren Workerarten konfigurieren. | harte Invariante |
| P27 · P:198–206 | Vier Probe-Mengen unterscheiden; ein Adapter pro Harness, getrennte Modell-Charsets, Containerkontext pro Slot; Waiver nicht auf Autorenprobe ausdehnen. | harte Invariante |
| P28 · P:207–210 | Agent-Faktschicht bleibt von Automationspolicy getrennt; gecachte Beobachtung ist kein Gate und null keine Antwort. | harte Invariante |
| P29 · P:211–215 | Modellnamen mit Klammern bleiben in Shell-Kommandos einfach gequotet; Harness-Test prueft ausfuehrbaren Spawn. | harte Invariante |
| P30 · P:216–218 | Watchdog exportiert benoetigte Programmpfade fuer launchd und geerbte Pane-Umgebung. | Default |

### Rangierte Widersprueche, Dopplungen, Alterung

1. **Falsche Audit-Schluesse sind teurer als Textlaenge.** P:128: „Eine FEHLENDE Audit-Zeile heisst ‚laeuft noch‘, nie ‚verloren‘“. Eine ausgeschaltete Audit-Konfiguration liefert gerade keine Zeile (`server.ts:18466`); die Absenz allein ist unknown. P:106: „nach jedem Land … die volle“ widerspricht der proportionalen Auswahl (`server.ts:17047`, `server.ts:18469`, `fleet-e2e-postland-audit.ts:1117`, `AGENTS.md` §Verify). P:124: „Ein echter Lauf liegt bei ~680–700 s“ und P:130: „~25–35 min“ sind unterschiedliche datierte Zeitbilder, keine allgemeine Echtheitsregel. Kosten: Gruen falsch verwerfen, fehlende Messung als laufend entschuldigen, unnoetig warten. **Zusaetzlicher Gegenbeleg gegen einen reinen Textfix:** Der ausgefuehrte Pin `e2e/pins.ts:8913` verlangt selbst „audit laeuft“ fuer eine fehlende Zeile; `land-log.ts#renderLandLog` bildet das so ab. Die Aussage ist damit auch implementierte Anzeige-Policy. Eine Korrektur braucht eine gesonderte Entscheidung samt Anzeige-/Testaenderung, nicht stilles Umformulieren des Regelbuchs.
2. **Deploy-Einstieg empfiehlt den spaeter ersetzten Weg.** P:3 setzt Deploy mit direktem Session-Kill gleich; P:147 sagt „Deploy laeuft ueber Verb 2 … statt“. Beide enthalten weiterhin richtige Watchdog-Unterscheidungen; diese duerfen bei Zusammenlegung nicht verschwinden. Kosten: Leser kann den beschriebenen Build-/Audit-/Boot-Beweisweg umgehen. Der Vorher/Nachher-Vorschlag muss die Route als Normalweg und den benannten Restfall bewahren; keine Autoritaetserweiterung.
3. **Modellpolitik ist Ausnahme plus unaufgeloester Versuchsstatus.** E:159: „Fable 5.1 fuer alles, was ORCHESTRIERT“; E:169: „die NAECHSTE Controller-Succession … auf Opus 5 high“; E:173: „Der Versuch wartet auf die erste ECHTE Succession“. E:130 dokumentiert hingegen bereits „slot 4 (Orchestrator (Opus))“. Der Brief nennt ebenfalls eine Opus-Orchestrierung. Damit ist die universelle Kurzregel als Leseregel unzureichend. Das beweist **weder** eine neue Owner-Promotion fuer alle MAINs **noch** einen abgeschlossenen erfolgreichen Versuch. Kosten: Modell zurueckstellen, falsche Defaults briefen oder einen bereits laufenden Versuch erneut beginnen. Owner/Orchestratorin muss geltende Ausnahme und Versuchsausgang klaeren; ein Praesens-Pass darf das nicht selbst entscheiden. Live-Slots wurden nicht gelesen.
4. **Rueckweg-Text hat seine eigene Reparatur nicht eingearbeitet.** E:31: „keinen eingehenden Kanal“ steht vor der Watch-Anleitung; E:39 „fuer alles, was KEINE Lane ist“ wird durch Merge-/Audit-Watches E:274 ergaenzt. E:246 „auf jede 409“ widerspricht der Lane-succeed-Ausnahme E:265. E:65 „erst der Host-Commit“ ist als Normalrezept ueberholt gegen P:84 „jede Lane committet selbst“. E:304 „ein blinder ff-Land regressiert sie still“ ignoriert die dokumentierte dirty-main-Abwehr E:78 und `server.ts:4710`. Kosten: manuelle Beobachtung, falsche API-Erwartung, unnoetige fremde Commits. Die Schutzabsicht (Rueckweg, Arbeit sichern, Arbeitskopie abgleichen) bleibt.
5. **Guenstig entfernbare Dopplung, teuer unklarer Geltungsbereich.** E:117 „30 % = keine NEUE unklare Tiefenarbeit“ und E:118 „keine neue unklare Tiefenarbeit im vollen Kontext beginnen“ wiederholen dieselbe Klausel. Die Wiederholung kann weg, nicht der Satz ueber kurze Abschluesse oder die Codex-Ausnahme. E:202 „graphify gibt es in einer Lane nicht“ verkuerzt den Sachverhalt gegen den expliziten read-only-Rueckweg in `AGENTS.md` §If you are a Codex or Pi lane. E:55 „15-min-Budget“ und E:103 „live … 45 min“ zeigen weiteres Zustandsalter; der gelesene Gate-Sensor meldete `waitMs:2700000`, keine 15 Minuten. Kosten: falsche Warteannahmen und verschenkte vorhandene Werkzeuge.

Nicht jeder datierte Satz ist ueberholt: P:43 „per Default AUS“ und P:58 „SCHARF“ unterscheiden Code-Default und damalige Aktivierung, das ist fuer sich **kein Widerspruch**. E:96 „IST … LIVE“ bleibt eine datierte Beobachtung, keine heute nachgemessene Laufzeitwahrheit. „Im Praesens geschrieben“ ist kein Guetesiegel fuer Aktualitaet.

### Verlustfreier Pass: Verfahren und eine Probe

1. Vorher private Quellbytes sichern, Hash und Grenzen erfassen. Absatzinventar oben zu **atomaren Regel-IDs** verfeinern: Akteur, Ausloeser, Muss/Darf/Verbot, Geltungsbereich, Ausnahme, Zahl mit Einheit, Beweisweg, Promotion und Begruendung. Ein Tabellenkurzsatz allein ist kein Vollstaendigkeitsbeweis.
2. Jede ID bekommt genau ein Nachher-Ziel: aktive Regel, erhaltene Begruendung oder datiertes Archiv mit Rueckverweis. Widerspruch bleibt als offene Entscheidung sichtbar; Archivierung ist keine Aufhebung. Gleich klingende Regeln verschiedener Rollen nicht verschmelzen.
3. Vorher-/Nachher-Liste mengenweise und bidirektional vergleichen: keine fehlende ID, keine neue Pflicht ohne Promotion, jede Ausnahme und Messgrenze bleibt zugeordnet. Mechanisch pruefbar sind IDs, Ziele, Zahlen, Linkauflösung und Render; Bedeutungsidentitaet braucht Gegenlesen gegen die Originale. Die semantische Unsicherheit wird nicht mit einer gruenen Liste verdeckt.
4. Fragment editieren, rendern, `bun e2e/pins.ts` ausfuehren. §6b prueft Bytegleichheit zum **jeweils aktuellen** Quellrender und Platzierung der alten Bedeutungsprobe (`e2e/pins.ts:4338`). Das beweist nicht, dass ein gleichzeitiger Edit an Fragment und Render keine unkartierte Regel entfernt hat. Substring-Proben bewahren weder Negation noch Modalitaet vollstaendig. Sie bleiben notwendige, aber nicht hinreichende Sicherungen.
5. Im isolierten Probebaum eine Ausnahme entfernen oder „darf“ in „muss“ verkehren: der Vorher-/Nachher-Regelvergleich muss scheitern, auch wenn der neue Render bytegleich zu seinen Fragmenten ist. Erst nach Owner-Klaerung offener Normkonflikte promoten. Archiv mit passendem Anker aufloesbar halten.

**Eine einzige Textprobe: P:96–100, ausfuehrbare Fixtures.** Dieser Abschnitt enthaelt keine private Identitaet und keinen offenen Normkonflikt. UTF-8-Bytes, inklusive abschliessendem LF und Markdown; keine Ueberschrift mitgezaehlt.

Vorher:

```text
- **Eine Fixture für ein ausführbares Artefakt muss es AUSFÜHREN** — eine Fixture, die nur Text liest, kann
  nicht beweisen, dass ein Profil/Skript ausführbar ist; die Sonden dahinter hängen an USABLE, nie an
  VORHANDEN, sonst liest sich „nichts wurde gemessen" wie „der Zaun verbietet alles". Die Regel gilt über
  Sandboxen hinaus; die zwei Instanzen, die sie bezahlt haben: `docs/attic/harness-zaun-messungen.md`
  §Fixture.
```

Nachher (Vorschlag):

```text
- Fixtures pruefen ausfuehrbare Artefakte durch Ausfuehrung, auch ausserhalb von Sandboxen.
  Textfund beweist keine Nutzbarkeit; eine ausgebliebene Messung beweist kein Verbot.
  Belege: `docs/attic/harness-zaun-messungen.md` §Fixture.
```

| Regel-ID | Vorher | Nachher |
|---|---|---|
| F1 | Ausfuehrbares Artefakt tatsaechlich ausfuehren | Satz 1 |
| F2 | Textfund/Vorhandensein beweist keine Nutzbarkeit | Satz 2, erste Haelfte |
| F3 | Keine Messung beweist keine Sperre | Satz 2, zweite Haelfte |
| F4 | Regel gilt ueber Sandboxen hinaus | Satz 1, zweite Haelfte |
| F5 | Belegzugang zur Fixture-Geschichte erhalten | Satz 3, gleicher Pfad und Abschnitt |

Die historische Anzahl der Instanzen ist kein Handlungsgebot und bleibt in der unveraenderten Quelle/Beleggeschichte. Die Liste bewahrt sie als Herkunft der Probe; sie wird nicht als neue Anzahl behauptet. **Gemessen: vorher 443 Bytes, nachher 238 Bytes, Ersparnis 205 Bytes (46,28 %).** Der Vorher-Block wurde bytegleich aus P:96–100 eingesetzt; die Nachher-Liste erhaelt alle fuenf Regel-IDs.

### Byte-Rechnung, Kosten und Urteil: **nur Teile**

| Messflaeche | UTF-8-Bytes | Zeilen |
|---|---:|---:|
| MAIN-Render, Quelle | 76 336 | 818 |
| Einstieg | 29 282 | 305 |
| Deploy | 21 088 | 218 |
| Beide Fragmente | 50 370 | 523 |
| Lane-Kopie | 21 010 | 239 |

Beide Fragmente tragen **65,98 %** der MAIN-Renderbytes. Die Groessenbehauptung des Briefs trifft in dezimalen kB ungefaehr zu, aber nicht fuer die Lane-Kopie. Gemaess `rulebook.ts:38` sind beide bereits aus dem normalen Lane-Render ausgeschlossen. Die Startkostenmessung `docs/messungen/2026-09-14-lane-startkontext-fixkosten.md:27` betrifft eine andere Lane und einen aelteren Render: ihre Tokenzahlen duerfen nicht als hier gemessene MAIN-Kosten gelten.

**Planungsschaetzung, keine fertige Kompression:** Einstieg 15–25 % weniger = rund 4,4–7,3 kB Ersparnis, Ziel 22,0–24,9 kB; Deploy 20–30 % weniger = rund 4,2–6,3 kB, Ziel 14,8–16,9 kB. Zusammen rund 8,6–13,6 kB weniger, 36,7–41,8 kB verbleibend. Begruendung der Spanne: Einstieg enthaelt viele weiterhin notwendige Rollen-/Rueckweg-Ausnahmen; Deploy groessere datierte Betriebsberichte, etwa P:58–75. Die kurze Fixture-Probe ist absichtlich **kein** Hochrechnungsfaktor. Konfliktklaerung und erhaltene Rueckverweise koennen den Gewinn verkleinern.

Kosten des Beibehaltens: Bis zu 50 370 Quellbytes dieser beiden Fragmente bleiben Bestandteil des MAIN-Regelkontexts; historische Zahlen und doppelte Imperative beanspruchen Aufmerksamkeit bei jedem Wiederlesen. Soweit der Harness den Kontext je Turn erneut sendet, bleibt die Last im Input, gegebenenfalls als Cache-Read. **Weder Tokens noch Geld noch genau eine erneute vollstaendige Injektion pro MAIN-Turn sind hier gemessen.** Die Byteersparnis ist kein Nachweis gleicher prozentualer Rechnungsersparnis.

Kosten des Passes: Inventar und Gegenlesen, Pflege zweier Belegorte, Zusatzlesung beim Zweifelsfall. Die groesste Gefahr ist verlorene Begruendung: „kurz committen“ ohne dirty-main/Retry-Kosten oder ein Modelldefault ohne Versuchsgrenze bringt die bezahlten Fehler zurueck. Deshalb zuerst die fuenf Konfliktgruppen, dann kleine geschlossene Abschnitte mit Regelvergleich bearbeiten. **Kein kompletter Neutext beider Fragmente und keine Zielvorgabe „halbieren“.** Ein bloss grammatischer Praesens-Pass lohnt nicht; der begrenzte Konsistenz- und Archivpass lohnt.

### Ungeprueftes

- Der konkrete Fail `200 slot=8 bFresh={attention:5}` stammt aus dem Brief; Audit-SHA, Helferlog, Artefaktverfuegbarkeit und Ursache wurden nicht live gemessen.
- Keine `.env` oder `fleet.json` zur Analyse geoeffnet, keine Prozess-Kommandozeilen ausgegeben; keine Live-Slot-Modellpolitik oder fruehere Owner-Promotion rekonstruiert. Private Quellenwerte dienen nicht als aktuelle Konfiguration.
- Alle Absaetze der beiden Fragmente gelesen; viele verlinkte Implementierungen, Vendor-/Harness-Verhalten und entfernte Historien nicht erneut ausgefuehrt oder vollstaendig geprueft. Die Art-Spalte ist keine globale Code-Zertifizierung.
- Die Karten-Proben sind noch zu bauen. Pins pruefen diese Messnotiz und vorhandene Repo-Regeln, nicht die zukuenftige Detailfunktion oder vollstaendige semantische Regelerhaltung.
- INDEX-Ergaenzung und Promotion bleiben bei der Orchestratorin. Diese Lane aendert nur diese Notiz.

### Mess- und Verifikationsprotokoll

- Quellinventar: 87 Zeilen; mechanisch geprueft, dass jede nichtleere Quellzeile ausser Ueberschriften von mindestens einem Inventaranker erfasst ist; jede Regelzelle hoechstens 25 Woerter. Ueberlappende Anker zerlegen gemischte Absaetze. Das misst Abdeckung, keine vollstaendige semantische Gleichheit.
- Fixture-Probe bytegleich aus der Quelle: 443 → 238 UTF-8-Bytes, minus 205 Bytes / 46,28 %. Fragment-Hashes vor und nach der Arbeit identisch.
- Privatsphaere: aus Lane-Kopie und beiden gelesenen Fragmenten vier private Suchmuster abgeleitet; `git grep --no-index -inF -f <private-patterns> -- <notiz>` liefert Exit 1 und 0 Ausgabebytes. Zusaetzlich keine IP, URL oder absoluter privater Pfad in der Notiz; Klarnamen redaktionell geprueft. Suchliste bleibt ausserhalb des Repos.
- `bun install --frozen-lockfile`: Exit 0. Bun meldet dabei normales automatisches Env-Laden; kein Env-Inhalt wurde ausgegeben.
- Gate vor dem Commit: `classifiedAs:{}`, deshalb noch keine klassifizierte Dateiflaeche; kurze Kette nach dem ausdruecklichen docs-only-VERIFY des Briefs. Drift-Sensor: `wouldConflict:false`, `behind:0`; `dirty:true` bezeichnet hier die neue Notiz, keinen bewiesenen Konflikt.
- `git diff --check --cached`: Exit 0.

Tail von `bun e2e/pins.ts` (Exit 0):

```text
PASS  land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT  (land-log says 42)

ALL PASS
```

Der Lauf nennt ausserdem einen bestehenden SKIP fuer nicht statisch beurteilbare interpolierte Nachrichtentails (`backlogNudgeMessage` und `mergeVerdictMessage`). Das ist keine Messung dieser Tails; das Schlussurteil der Suite bleibt das oben woertlich zitierte. Keine Implementierungs- oder Regelbuch-Aenderung und keine breite Laufzeitsuite in diesem Schnitt.
