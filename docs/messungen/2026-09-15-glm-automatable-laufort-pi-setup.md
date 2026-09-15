---
frage: Was fehlt für unbeaufsichtigtes pi-zai, wo soll es laufen und welches Pi-Setup passt zum Einsatz?
urteil: Zuerst lokal Startverhalten messen und absichern, dann pi-zai automatable machen; Remote-Platzierung erst nach einer echten Pi-Kanarie. Eine VM auf der Veröffentlichungsmaschine ist eine zusätzliche Vertrauensentscheidung, kein nachgewiesener RAM-Gewinn.
bereich: [harness-adapter, pi-zai, automation, multi-host, ram]
stand: 2026-09-15
---

# GLM automatisieren: Mechanik, Laufort und Pi-Setup

## 1 · MECHANIK

**Die vorhandene Harness-Abstraktion soll bleiben:** Sie trennt Prozessbeobachtung, Zustellerlaubnis und Fähigkeiten je Adapter; GLM braucht eine belegte Start- und Zustellzusage innerhalb dieser Naht, keine zweite Queue.

**Empfehlung:** zunächst auf dem bisherigen Fleet-Mac automatisieren. Tragende aktuelle Zahl: `memory_pressure` meldet in der eigenen Stichprobe **40 %** frei/zurückholbar (§2); es gibt hier keinen gemessenen Pi-RAM-Engpass. Das rechtfertigt einen begrenzten Versuch, keine Kapazitätsgarantie. Vor dem Schalter muss die neue Pi-Vertrauensabfrage geklärt sein. Die Veröffentlichungsmaschine jetzt zusätzlich einzubinden vergrößert die Vertrauens- und Betriebsfläche ohne gemessenen Nutzen.

**Basis und Abdeckung.** Gelesen am Baum `bf7e06e89871c09c4d3c30123fe91d7fc03c60c0` (`git rev-parse HEAD`): Adapter, Automation/Dispatch/Readiness, Lane-Signale und Selbst-Land, lokale Spawn-/Git-/Kontextnaht; die unten genannten E2E-Abschnitte und Messnotizen; installierte Pi-Hilfe und Dokumentation. Die Bestandsnotizen sind historische Messungen, keine heutigen Live-Sensoren. `graphify query "PI_ZAI_HARNESS HARNESS_AUTOMATION paneReadiness laneSignalView" --graph "$(dirname "$(git rev-parse --git-common-dir)")/graphify-out/graph.json" --budget 1200` lieferte die Einstiegspunkte; alle folgenden Codebefunde wurden im Quelltext gegengeprüft. Bei `server.ts` braucht die Textsuche `rg -an`, weil gewöhnliches `rg` die Datei als binär behandelt.

**Nicht erhoben:** kein Pi-/GLM-Start, kein SSH, keine VM, kein Modellaufruf; weder `fleet.json`, `.env` noch die Key-Datei geöffnet. Die Angabe **58 GLM-Lanes, überwiegend Gegenleser** stammt allein aus dem Auftragsbrief; die zugrunde liegende Lane-Zählung wurde nicht wiederholt. Ebenso ist die Owner-Zustimmung aus dem Brief übernommen. Einziger API-Schreibakt dieses Auftrags ist der ausdrücklich verlangte abschließende Fleet-Report.

### Wirkstellen und notwendige Änderungen

Zeilen beziehen sich auf den Basisbaum; `datei#symbol` ist der dauerhaftere Suchanker.

| Stelle | Heute | Nötig / Wirkung | Beleg |
|---|---|---|---|
| Adapter und Registrierung | `pi-zai` ist registriert, `automatable:false`; `comms:["pi"]`, `composer:PI_COMPOSER`, keine `readiness`, kein gemessenes `bootSettleMs`. | Nach Feuerprobe Start absichern und genau diesen Adapter freigeben. Kein globaler Harness-Waiver. | `server.ts#PI_ZAI_HARNESS`, `server.ts#HARNESSES` (751–804, 1318) |
| Doppelte Erlaubnis | Default-Claude immer erlaubt; benannte Adapter nur bei `HARNESS_AUTOMATION && h.automatable`. | Der Adapter-Flip allein reicht nur bei eingeschaltetem Operator-Flag. Aktiven Prozesswert hier nicht aus einer verbotenen Konfigurationsdatei erschließen. Die Doku beschreibt ihn als eingeschaltet, kein eigener Laufzeitbeweis. | `server.ts#harnessAutomatableFor`, `server.ts#HARNESS_AUTOMATION` (6193–6198, 1316); `docs/harness-adapter.md` §Land-Pfad-Flags |
| Queue, Release, Varianten | Tick hält die Zeile mit Harness-Grund; unbeaufsichtigter Dispatch sperrt nochmals vor der Arbeit; MAIN-Release und Varianten beachten dieselbe Policy. Owner-Dispatch darf die Policy übergehen. | Bestehende Tore verwenden. Negativarm mit Flag aus erhalten; den bisherigen „pi-zai lehnt selbst ab“-Arm auf einen weiterhin ablehnenden Adapter/geeignete isolierte Fixture umstellen. | `server.ts#tickDispatch` (12556–12576), `server.ts#dispatchTask` (11102–11116), `server.ts#releaseTaskForMain` (9761–9765), `server.ts#harnessAutomationWhy` (6206–6208); `e2e/tasks.ts` §e6, ab 2736 |
| Zustellung | `canDeliver` prüft Policy, frische Prozessbeobachtung und dann deklarierte blockierende Screens. `pending` sperrt etablierte Zustellungen nicht. | Prozess- und Screen-Beweis nicht gegeneinander austauschen. Fehlender Key ergibt heute eine Shell; deren Lebenszeichen ist kein Agent. | `server.ts#canDeliver`, `server.ts#paneAgentAt`, `server.ts#claudeAlive` (10799–10828, 6210–6247) |
| Readiness und Gründung | `paneReadiness` liefert für Pi-Zai `null`. Ohne Deklaration beendet `waitForFoundingReadiness` sofort erfolgreich; Codex wartet dagegen auf seinen Accept-Marker. | Aktuelle Pi-Startzustände messen. Entweder blockierende Abfragen deterministisch unterdrücken und Nichtanwendbarkeit belegen oder echte Pi-Marker deklarieren; keine Codex-Glyphen erfinden. | `server.ts#paneReadiness`, `server.ts#waitForFoundingReadiness`, `server.ts#briefAndSend` (6253–6280, 11395–11413) |
| Shell bei fehlendem Key | Fehlende/leere Datei führt mit Fehlermeldung zu `exec SHELL`; fehlgeschlagene Katalogvorbereitung ebenso. Auch nach Pi-Ende bleibt eine Shell. | Vor jeder unbeaufsichtigten Sendung muss die lebende Pi-Instanz feststehen. Vorhandene Key-Fixture um den Nachweis „kein Brief in Shell, korrekt requeued“ erweitern; falscher/nur whitespace enthaltender Key und Providerfehler sind bislang damit nicht bewiesen. | `server.ts#PI_ZAI_HARNESS` (755–763), `server.ts#briefAndSend` (11395–11413); `e2e/security.ts` §6a `keyGuardProbe` (1341–1361) |
| Lane-Fakten | `tickGit` speichert echte `agentInfo`, aber `aliveInfo` zusätzlich mit Automation-Policy. `laneSignalView` liest standardmäßig die letztere Map. | Flip öffnet done-looking für Watch-Ziele und Auto-Review, sobald die übrigen Fakten passen. `unknown` und fehlende Beobachtung müssen erhalten bleiben. | `server.ts#tickGit`, `server.ts#laneSignalView` (4021–4035, 28701–28720) |
| Watch-Ablehnung | Ein Lane-Watch auf ein nicht automatisierbares **Ziel** antwortet 409 mit dem Harness-Grund. | Diesen Zielarm positiv und mit Flag aus negativ testen. Lane-eigene Subscribe-Verbote bleiben eine andere Rollenregel. | `server.ts#createWatchForSlot` (6429–6432); `e2e/programs.ts` ab 11279 |
| Selbst-Land: Brief-Prämisse korrigiert | Eine gebundene MAIN kann bereits eine Pi-Zai-Lane landen: `selfLandTaskForMain` liest `laneSignalView(...,"fact")`. Das fehlende Automation-Signal sperrt diesen Weg nicht mehr. | Diesen vorhandenen Weg erhalten. Weder Lane-Selbst-Land noch autonomes Tick-Landen hinzufügen. | `server.ts#selfLandTaskForMain` (10203–10213), `server.ts#laneSignalView`; `e2e/programs.ts` 11206–11304; Historie: `git log --oneline --grep=pi-zai` nennt `5885d97b` |
| Empfangsbestätigung | Pi hat bereits eine Composer-Deklaration; `sendText` unterscheidet `observed`, `not-observed`, `unobservable`, `not-applicable`. Readiness allein beweist keine Prompt-Annahme. | Feuerprobe muss das Leeren des Pi-Composers und den tatsächlich angekommenen Turn zeigen; `unobservable` nie als Erfolg verkaufen. | `server.ts#PI_ZAI_HARNESS`, `server.ts#sendText`, `server.ts#Acceptance` (773, 6045 ff., 5835); `server.ts#PI_COMPOSER` |

**Codex-Naht vom 2026-08-12:** `server.ts#CODEX_HARNESS` deklariert den Header `>_ OpenAI Codex (v` als Accept-Marker und benannte Trust-/Login-Blöcke; inzwischen kommt der Update-Block hinzu (1210–1230). `server.ts#READY_WAIT_MS` setzt einen begrenzten Gründungs-Wartezeitraum (Default 20 Sekunden, 5818). `server.ts#briefAndSend` hält den Brief zurück und requeued mit Screen-Namen oder Timeout-Grund. `e2e/tasks.ts` §f3 (4108–4186) prüft Trust, Login, Update, stummes Booten und Accept-Marker mittels lebendem Stand-in. Der Test setzt das Wartebudget auf 3 Sekunden; das ist eine Fixture-Zahl, keine Pi-Messung. `e2e/pins.ts` (3137–3153) pinnt Screen-Gate und gemeinsame begrenzte Readiness auf den Gründungswegen. **Genau dieses Prinzip fehlt Pi-Zai als aktueller Nachweis; der gemeinsame Mechanismus existiert.**

**Neue Gegenbeobachtung:** Der Adapter-Kommentar „Pi has no known input-eating rendered boot screens“ (`server.ts#PI_ZAI_HARNESS`) ist keine tragfähige Freigabe für die heute installierte Version. `pi --version` ergibt **0.85.0**. Deren mitgeliefertes `README.md` §Project Trust und `docs/security.md` §Project Trust beschreiben eine interaktive Abfrage bei unbekannten Projekten mit lokalen Pi-Ressourcen bzw. `.agents/skills`. Ob diese Abfrage einen Fleet-Brief verschluckt, ist **nicht gemessen**; dass es die Abfrage gibt, ist dokumentiert. `--no-approve` überspringt solche Ressourcen, lässt aber Kontextdateien laden. Der benachbarte `server.ts#PI_OX_HARNESS` nutzt diesen Flag bereits samt deaktivierter Discovery und atomarem Katalogersatz (ab 807): eine vorhandene Vorlage, kein Beweis für GLM.

**Disposition der Flächen für den lokalen Flip:** Server, Adapter, Probe, Dispatch-/Watch-E2E und Doku **apply**. Wire/Client: bestehendes `GET /api/harnesses`-Feld nutzen (`server.ts#HARNESSES`, Route ab 32770), für den reinen Flip kein neues Feld, also **not-applicable** als Protokollumbau. Reverse-State: Pi-Kontext und Session-Pin **apply**, Claude-Transkript weiterhin **unsupported** (`server.ts#piZaiContextFile`, `server.ts#PI_ZAI_HARNESS`). Die anderen Adapter behalten ihre jeweilige Entscheidung; für diesen Flip **not-applicable**. Pi-Worker, Self-Schedule-Werbung, Container und Browser-MCP bleiben **unsupported** bzw. beim Browser **not-applicable**. Ein späteres Einsatzprofil braucht dagegen Wire, Server, Client und Persistenz gemeinsam (§3, Karte C).

## 2 · LAUFORT

### Was die Zahlen wirklich sagen

| Quelle / Zeitpunkt | Befund | Reichweite |
|---|---|---|
| Auftragsbrief, 2026-09-15 „18:4x“ | Fleet-Mac: 8 GiB, 52 % frei, 10 Claude-Prozesse ~2,0 GiB RSS, 28 Codex ~0,47 GiB RSS | Übernommene Messangabe; Originalkommando/-protokoll nicht mitgeliefert. Keine eigene Wiederholung dieses Zustands. |
| Eigene Stichprobe, 2026-09-15 18:43:27 +02:00 | `hw.memsize=8589934592` Bytes = 8 GiB; `memory_pressure`: **40 %**; exakte Prozess-Basenamen: Claude 9 / 1247520 KiB RSS, Codex 30 / 595728 KiB RSS, Pi 0 | Kommando unten. Pi-RSS ist **unknown**, nicht null Speicherbedarf. Kein Sample einer arbeitenden GLM-Session. |
| `2026-09-15-second-host-sessions-optionen.md` §1 | Second-host: `free -m` notiert 7858 „MB“, 4090 verfügbar; Pi 0.85.0 installiert. B1-Rohtransport bytegleich, 6274 Bytes; Remote-Agentenprobe 0,03 s. | Historische Fremdmessung. `free -m` berichtet MiB; verfügbar damit ~3,99 GiB (4090 / 1024). Kein echter Agent durch B1 und kein Linux-Pi-RSS gemessen. |
| `2026-09-13-second-host-auslagerung-glm.md` §1–2 | Helfer damals mit 3 Suiten belegt; Swap-Bestand 1913 von 2276 MB; wesentliche Audit-Arbeit bereits remote. | Session-Auslagerung schafft dort Konkurrenz zu Suiten; keine heutige Reserve daraus ableiten. |
| `2026-09-06-second-host-parallel-suiten.md` §Ergebnis | Zweiter Suite-Arm +224 MB Peak-RAM; dritte Suite verunreinigte das Endfenster. | **Keine** Pi-Prozesszahl und keine Dauerfreigabe zusätzlicher Sessions. Neuere `2026-09-14-ram-optimierung-astra.md` §F7 / Entscheidung nennt tmpfs-Bestand und Swap als eigenen Lastblock. |
| Haupt-MacBook | 16 GB laut Owner-/Auftragsangabe | Freier Speicher, Chip/Architektur, Grundlast, Virtualisierung und Gast noch ungemessen. GB nicht stillschweigend in gemessene GiB umetikettieren. |

Reproduzierbare lokale Sonde (nur aggregierte Werte; keine Prozessargumente, keine Credentials):

```sh
python3 - <<'PYRAM'
import datetime, json, os, subprocess
print(datetime.datetime.now().astimezone().isoformat())
print('hw.memsize=' + subprocess.check_output(['sysctl','-n','hw.memsize'], text=True).strip())
print('\n'.join(x for x in subprocess.check_output(['memory_pressure'], text=True).splitlines() if 'percentage' in x))
stats = {k: [0, 0] for k in ['claude', 'codex', 'pi']}
for row in subprocess.check_output(['ps','-axo','rss=,comm='], text=True).splitlines():
    parts = row.strip().split(None, 1)
    if len(parts) == 2 and os.path.basename(parts[1]) in stats:
        key = os.path.basename(parts[1])
        stats[key][0] += 1
        stats[key][1] += int(parts[0])
print(json.dumps(stats))  # Anzahl, RSS in KiB
PYRAM
```

Die Prozesszählung erfasst nur den exakten Basenamen, keine nachgeladenen Kinder/Tools. RSS ist kein vollständiger Host-Footprint; `memory_pressure`-„free“ ist kein fest zugesagtes Startbudget. Die Differenz zum Brief ist ein anderer Messzeitpunkt mit anderer Prozessmenge, kein reproduzierter Messfehler.

### Optionen und Schnitte

Aufwandszahlen in dieser Tabelle sind **Planungsannahmen**, keine gemessenen Implementierungstage. Pi-RAM überall **ANNAHME: 0,25–0,50 GiB je Text-Session** als anfänglicher Reservierungsansatz; Langkontext, Tools, Build, Browser und Nebenprozesse können darüber liegen. GLM-Gewichte werden beim Provider ausgeführt (`server.ts#PI_ZAI_HARNESS`: `--provider zai`), nicht als lokales Modell in diesen RAM geladen.

| Option | RAM / anfängliches Budget | Was Fleet dafür fehlt | Vertrauensgrenze | Aufwand in Schnitten |
|---|---|---|---|---|
| Bisheriger Fleet-Mac, lokal | Gemessen 8 GiB / aktuell 40 %-Anzeige. **Vorschlag:** zunächst höchstens 2 GLM-Text-Sessions; reservierte 0,5–1,0 GiB = 2 × obige ANNAHME. Keine Zusage, dass diese Reserve tatsächlich frei ist. | Kein Host-Feld, Remote-Spawn oder Rückkanal nötig; lokales `ensureSlot`, `paneAgentAt`, `gitWith`, Pi-Kontext vorhanden. Start-/Zustellbeweis und Adapter-Flip fehlen. | Pi besitzt Rechte seines lokalen Accounts. Nur bestehende, ausdrücklich freigegebene lokale Arbeitsfläche; kein neuer Zugriff auf die Veröffentlichungsmaschine. | A: lokale Feuerprobe; B: Startabsicherung + Automation. C: Einsatzprofile separat. |
| Second-host über B1 | Historisch ~3,99 GiB verfügbar, aber mit Suiten geteilt; Pi-RAM **ANNAHME** wie oben, Linux-PSS/Peak noch zu messen. | Host-Feld/Projektion; lokale äußere Pane mit SSH-Anbindung an entfernte tmux-Session; echte Remote-Prozessprobe; entfernte Worktrees/Git-/Kontextleser; Commit-Rücktransport vor lokalem Land; Offline-/Reconnect-/Occupant-Semantik. | Agent und Z.ai-Key dort; nur eigenes Lane-Self-Credential zum Fleet-Rückkanal, kein Owner-Token. SSH-Kontrollverbindung nicht als Agentenleben zählen. Branch-Rücktransport ist zu prüfen, bevor vertrauenswürdige Integration ihn verarbeitet. | **ANNAHME 4 Schnitte nach lokaler Freigabe:** echte Pi-B1-Kanarie; Host/Spawn/Probe; Git/Kontext/Rücktransport; Unterbrechung/Recovery/Abnahme. |
| Linux-VM auf Haupt-MacBook | Owner nennt 16 GB physisch. **ANNAHME/Vorschlag:** Gast zunächst 4 GiB mit obigem Pi-Budget; Gast-OS und Hypervisor zusätzlich, freie Host-Reserve unbekannt. VM teilt physischen RAM, sie erzeugt keinen. | Dieselbe B1-nahe Host-/Spawn-/Probe-/Git-/Rückkanal-Arbeit; zusätzlich VM-Provisionierung und Start/Stop/Resume, Netz-Erreichbarkeit sowie Architektur-/Toolchain-Abnahme. Kein vorhandenes `containerContext`-Routing für Pi: `supports.container:false`. | **Veröffentlichungsmaschine.** Kein Host-Home, Signing-/Publishing-Credential, SSH-Agent oder beschreibbarer Veröffentlichungs-Checkout im Gast. Separater Gast-Account/Key und bewusst begrenzter Rückkanal. Kopien statt Host-RW-Mounts; weder `--no-approve` noch Toolauswahl ist eine VM-Grenze. | **ANNAHME 5 Schnitte:** isolierte VM-/Vertrauens-Kanarie zusätzlich zu den B1-Schnitten. Erst nach ausdrücklicher Freigabe der Maschine. |

**Codegrundlage der Ortslücke:** `server/types.ts#Slot` (1496 ff.) trägt Harness, cwd, Worktree und Container-Kontext, aber keine allgemeine Agenten-Host-Zuordnung; `server.ts#Harness`/`server.ts#ensureSlot` (385 ff., 5185 ff., 5250–5264) starten über lokale tmux. `server.ts#paneAgentAt` (6221–6247) untersucht lokale Pane-PID und direkte Kinder. `server.ts#gitWith` (3381–3394) startet lokales Git; `server.ts#piZaiContextFile`/`server.ts#isolatedPiContextFile` (ab 28932 bzw. davor) lesen lokale Sessions. `server.ts#ensureSlot` (5239–5240) exportiert bereits Self-Token, Slot und Self-URL: **API-Vertrag vorhanden**, die sichere Übertragung in die entfernte Agentenumgebung und deren Erreichbarkeit sind noch kein gebauter Fernpfad. Für B1/VM wären Wire/Server/Client/Reverse-State/Probes/Doku alle **apply**. Keine Vollinventur sämtlicher Datei-Leser behauptet.

**B1-Vorlage enger lesen:** Ihre Bash/Raw-Transportsonde beweist keine funktionierende Pi-Readiness, Composer-Annahme oder Session-Recovery. „Watches/Reports/Succession unverändert“ ist dort ein Entwurf aufgrund der lokalen Außen-Pane. Nach externem Await müssen exakte Slot-Belegung und entfernte Session erneut stimmen; ein lebender SSH-Prozess oder Wiederanheften allein beweist das nicht. Netzverlust muss `unknown` erzeugen, nicht einen zweiten Agenten. Land bleibt nach geprüftem Branch-Rücktransport am bisherigen Integrationsort.

**Entscheid:** lokal zuerst, weil die aktuelle **40-%-Anzeige** keinen akuten, Pi zurechenbaren Speichermangel belegt und der Pi-Bedarf ungemessen ist. Bei der lokalen Kanarie RSS/Hostdruck vor Start, im Leerlauf, während repräsentativer Read-/Write-Tools und nach Ende erfassen; Kinder einbeziehen, keine Kommandozeilen ausgeben. Bei wachsendem Druck Parallelität zurücknehmen, nicht aus der Annahme weitere Slots errechnen. Erst nach gemessenem Bedarf B1 auf dem Second-host prüfen; VM nur, wenn dessen Reserve nicht trägt und die Veröffentlichungstrennung konkret abgenommen ist. Kein Geräteeingriff ist durch diese Notiz freigegeben.

## 3 · PI-SETUP

### Bestand und empfohlene Konfiguration

Lokale Primärquellen: Installation über `readlink "$(command -v pi)"`, `pi --version`, `pi --help`; darunter `README.md` §§Context Files / Project Trust sowie `docs/security.md`, `docs/settings.md`. Öffentlich nachgelesen: [Pi README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md), [Pi Security](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md). Maßgeblich für diese Empfehlung ist die **installierte 0.85.0**, kein künftig bewegliches `main`.

| Bereich | Heute im Fleet / gelesener Bestand | Konsequenz |
|---|---|---|
| Regelbuch | Pi lädt Kontext aus Agent-Home, Elternpfaden und cwd; `AGENTS.override.md` hat Vorrang, sonst `AGENTS.md` vor `CLAUDE.md` pro Verzeichnis. `--no-context-files` würde das abschalten. Pi-Zai setzt diesen Flag nicht. | AGENTS-Laden erhalten; globaler Kontext ist wegen `PI_CODING_AGENT_DIR` nicht automatisch `~/.pi/agent`. `--no-approve` schaltet Kontext nicht ab. Quelle: installierte README §Context Files / Security §Project Trust; `server.ts#PI_ZAI_HARNESS`. |
| Key und Agent-Home | `server.ts#PI_ZAI_KEY_FILE` default `~/.config/claude-fleet/secrets/zai-coding-plan.key`; `server.ts#PI_ZAI_AGENT_DIR` default `~/.config/claude-fleet/pi-zai-agent`, jeweils validierbarer Env-Override. Key erst in Pane-Shell nach `ZAI_API_KEY` expandiert. Gemeinsames Adapter-Home, **nicht je Session ein eigener Ordner**. | Key-Datei hier ungeöffnet; keine Güte-/Ablaufbehauptung. Parallelstarts schreiben heute denselben `models.json` per direktem `printf >`; atomaren Ersatz nach dem Pi-Ox-Muster prüfen. Eine Verzeichnisverlagerung isoliert Einstellungen, nicht OS-Rechte. Beleg: `server.ts#PI_ZAI_HARNESS` (755–763), `server.ts#PI_OX_HARNESS` (ab 807). |
| Modell und Effort | Fester `zai/glm-5.3`; `--session-id` bei vorhandenem Pin, `--thinking` bei explizitem Effort. Zulässig `low`, `high`, `max`; kein `medium`. Kein `--models`-Cycling-Limit im Zai-Spawn. | `high` als **Empfehlung**, nicht gemessene Qualitätsdominanz. `low` für enges Extrahieren, `max` nur bei begründeter Aufgabe. Katalogfenster ist keine gemessene stabile Kontextkapazität. Quelle: `server.ts#PI_ZAI_HARNESS`, `e2e/security.ts` §6a. |
| Tatsächlich gelesene Konfiguration | In `~/.pi/agent/settings.json` nur erlaubte Felder projiziert: `packages=["npm:pi-claude-bridge"]`, Default-Provider `openai-codex`, Default-Modell `gpt-5.6-sol`. Im Standard-Zai-Home ist `settings.json` vorhanden, aber keines der geprüften Felder `packages/extensions/skills/defaultProvider/defaultModel/defaultThinkingLevel/defaultProjectTrust` gesetzt. Dort kein AGENTS-/Override-File und kein `extensions`-/`skills`-Verzeichnis; `trust.json` existiert, Inhalt nicht gelesen. | **Nur Standardpfade**, ein Laufzeit-Override ist unbekannt. Bridge des normalen Pi nicht zu GLM dazuerfinden. Existierende Trust-Datei beweist keine Freigabe zukünftiger Lane-cwds. Prüfung: Python `Path.exists()` und JSON-Projektion genau dieser Feldliste; keine Auth-, Session- oder Key-Datei gelesen. |
| Tools / Extensions | `pi --help`: Standard `read,bash,edit,write`; Allowlist `--tools` gilt auch für Extension-Tools. Zai-Adapter setzt derzeit keine Tools-Allowlist, keine Discovery-Sperren. `worker:()=>null`; Pi-Worker im Fleet-Worker-Tier **unsupported**. Browser-Profil `not-applicable`. | Ein read-only Brief ist mit offenem Bash nur eine Verhaltensregel. Extensions laufen mit Prozessrechten; Pi hat keine eingebaute Sandbox. Quelle: installierte Help/Security, `server.ts#PI_ZAI_HARNESS` (766–802). |

**Gemeinsames Zielprofil für unbeaufsichtigte Textarbeit (Vorschlag, heute nicht gesetzt):** fester Provider/Modell/Session-Pin wie bisher; zusätzlich `--models glm-5.3 --no-approve --no-extensions --no-skills --no-prompt-templates --no-themes`. Kontextdateien weiter laden. Kein pauschales `--approve` für fremde Projekt-Extensions. Explizite, geprüfte `-e`-Erweiterungen wären trotz `--no-extensions` möglich (`pi --help`), aber kein Teil der ersten Freigabe. Die Version pro Kanarie festhalten und Änderungen der Startoberfläche erneut prüfen.

| Einsatz | Empfohlenes Pi-Profil zusätzlich zur gemeinsamen Basis | Rechte, Lieferung und Grenze |
|---|---|---|
| Gegenleser, tatsächlich nur Lesen | `--thinking high --tools read,grep,find,ls`; bei vollständig gelieferten Ausschnitten optional `--no-tools` | Keine Bash-, Write-, Edit- oder Extension-Ausführung durch Modelltools. Tool-Allowlist begrenzt weder lesbare Pfade noch Provider-Übertragung. Prüfer liefert Text; beauftragter Operator übernimmt Notiz/Commit/Report, weil diese Shell-Akte dem Prüfer fehlen. Heute kein solches Rollenprofil im Fleet-Spawn: **unsupported bis Karte C**. |
| Messnotiz | `--thinking high --tools read,grep,find,ls,bash,write,edit`; Brief begrenzt genau Notiz und benannte Messkommandos | Bash ist für Sensoren/Verify/Git/Report nötig und ermöglicht technisch weitere Writes. Also **kein technisch read-only Modus**. Nur bekannte Repos/zugelassene Daten; fremden Code nicht als angebliche Lesemessung ausführen. Heutiger Adapter kann die Arbeit bereits, die explizite Auswahl folgt Karte C. |
| Code-Lane | `--thinking high --tools read,grep,find,ls,bash,write,edit`; `max` nur bewusste Aufgabenwahl | Eigene Lane, AGENTS, exakter Session-Pin, Compiler/Tests, eigener Commit und Self-Report. Kein Worker-/Transkript-/Container-Versprechen daraus ableiten. An Veröffentlichungs-Credentials nur mit eigens bestätigter Grenze; VM/Remote bei Bedarf separat. |

Die beiden schreibenden Einsätze benötigen zunächst dieselbe Toolmenge; dafür keine künstlich unterschiedlichen Rechteklassen erfinden. Ein späterer technischer „nur diese Notiz schreiben“-Zaun wäre ein anderer Auftrag. `selfSchedule:false` verhindert nicht das Vorhandensein des Self-Tokens: `server.ts#ensureSlot` exportiert ihn unabhängig vom Harness. Es beschreibt eine nicht zugesagte Fähigkeit, keine Firewall.

### Ersatz-Karten-Köpfe

Reihenfolge **A → B → C** ist ein Vorschlag mit benannten Abschlussbedingungen. Keine Queue-IDs erfunden: A zuerst filen; B erst nach dokumentiertem PASS der A-Kanarie, C nach B. Nach dem Filen kann die Orchestratorin echte `NACH`-IDs setzen und erneut validieren. A braucht bei Freigabe ausdrücklich isolierte Pi-/Modell- und Sandbox-API-Akte; der vorliegende Leseauftrag führt sie nicht aus. B und C sind Codeaufträge, keine Gerätekonfiguration/Deploys. B1/VM bleiben bis zum Ortsentscheid ungefilet.

```card
[A · Pi-Zai-Start und Annahme lokal vermessen]
ROLLE: codex/gpt-6-astra/high
GROESSE: mittel
FLAECHE: docs/messungen/2026-09-15-glm-automatable-laufort-pi-setup.md
NEU: docs/messungen/2026-09-15-pi-zai-automation-feuerprobe.md
VERIFY: pins; isolierte Pi-Kanarie mit exakt protokollierten Frames, Zustellbelegen und RSS-Sensoren
DONE: Die neue Notiz gibt PASS oder STOP mit Belegen für Trust, fehlenden/leeren/ungültigen Key, Ready, Composer-Annahme, Resume und Prozessende aus; jeder unmessbare Arm bleibt unknown und verhindert PASS.
Nur die neue Messnotiz schreiben; diese Vorlage bei nötiger Korrektur aktualisieren. Bestehenden Adapter und empfohlenes Startprofil getrennt in privatem Scratch prüfen, keine Live-Slots, globalen Pi-Einstellungen oder echten Schlüsseldateien verändern. Nur freigegebenen Zai-Key verwenden, nie loggen. Tool-Read-Roundtrip und tatsächlichen Turn-Eingang belegen, nicht bloß lebende Pane. Pi-Peak inklusive Kinder und Hostdruck messen. Unerwarteter Trust-/Auth-/Update-Screen oder unobservable Acceptance bedeutet STOP; kein Adapter-Flip. Scratch und eigene Sessions am Ende gezielt räumen.
```

```card
[B · Pi-Zai lokal sicher für Automation freigeben]
ROLLE: codex/gpt-6-astra/high
GROESSE: mittel
FLAECHE: server.ts#PI_ZAI_HARNESS server.ts#paneReadiness server.ts#briefAndSend e2e/tasks.ts e2e/security.ts e2e/programs.ts e2e/watch.ts e2e/pins.ts docs/harness-adapter.md
VERIFY: volle Kette; ./e2e-isolated.sh
DONE: Nach bestandener Feuerprobe startet pi-zai mit Flag an unbeaufsichtigt, nimmt den Brief beobachtet an und wird als Watch-Ziel erkannt; Flag aus, blockierter Start, tote Shell und Slotwechsel bleiben ohne Zustellung; MAIN-Selbst-Land bleibt grün.
Nur nach PASS von A. Gemessene Startup-Policy aus A implementieren: feste Modellwahl, keine impliziten Projektressourcen/Extensions, atomarer Katalogersatz; benötigte Readiness nur aus belegten Pi-Frames. Dann automatable aktivieren. Vorhandene Queue-, Watch-, Capability- und declined-harness-Fixtures an die neue Entscheidung anpassen, die Ablehnungsfälle separat erhalten. Kein globaler Waiver, kein autonomes Landen, keine neuen Transkript-/Worker-/Container-Zusagen und kein Hostwechsel. Gleiche unbeaufsichtigte Ablehnung bei Capture-Fehler, Auth-/Providerfehler und Identitätswechsel beweisen; keine automatische Prompt-Wiederholung bei unklarer Annahme.
```

```card
[C · Pi-Zai-Leseprofil explizit durch den Spawn tragen]
ROLLE: codex/gpt-6-astra/high
GROESSE: gross
FLAECHE: server.ts#Harness server.ts#PI_ZAI_HARNESS server.ts#ensureSlot server/types.ts#Slot server/types.ts#DispatchSpawn src/protocol.ts src/client.ts e2e/security.ts e2e/tasks.ts e2e/restart.ts e2e/pins.ts docs/harness-adapter.md
VERIFY: volle Kette; ./e2e-isolated.sh
DONE: Ein geschlossenes Pi-Zai-Profil read-only oder work wird validiert, angezeigt und über Task, Dispatch, Restart und Resume identisch bewahrt; read-only hat ausschließlich read/grep/find/ls, work zusätzlich bash/write/edit; fremde Werte und unzulässige Harness-Kombinationen scheitern vor Spawn.
Nach B nur diese Profilwahl ergänzen, kein frei formulierbares CLI-Feld. Legacy-Absenz behält heutige Arbeitsrechte; explizit null oder malformed Input an der Eingangsgrenze ablehnen, nicht still auf work erweitern. Neue Belegung löscht das alte Profil. read-only hat keine Extensions und kann keinen eigenen Commit/Report ausführen: diese Akte übernimmt der beauftragte Operator; Oberfläche und Doku benennen das. Andere Harnesses explizit unsupported, keine Veränderung ihres Spawns. Messnotiz und Code-Lane teilen work; kein behaupteter Dateipfad-Zaun. Wire, Client, Server, persistierter Rückzustand und Negativ-/Concurrent-Recycle-Proben gemeinsam liefern.
```

### Deterministische Kartenprüfung

Das folgende Skript liest die **Kartenblöcke aus dieser Notiz**, importiert den echten Parser und Validator und liest Rollen/Model-Regel/Effort aus dem geprüften `server.ts`. Es importiert **nicht** den Server und startet keine Instanz. Eine leere Symbol-Map erzwingt für jede Symbolreferenz den echten Deklarations-Fallback `card-extract.ts#declaresSymbol`, statt ohne Graph nur Dateiexistenz gelten zu lassen. Keine behaupteten Graph-Zeilenbereiche. `rowKnown:false` ist korrekt, weil kein Kopf `NACH` enthält; echte Abhängigkeiten brauchen nach dem Filen einen erneuten Live-Check.

Aus Repo-cwd: Skript als `/tmp/glm-automatable-note/check-cards.ts` speichern und `bun /tmp/glm-automatable-note/check-cards.ts` ausführen:

```typescript
import { resolve } from 'node:path';
const root = process.cwd();
const { parseFormattedCard, validateCard, declaresSymbol } = await import(resolve(root, 'card-extract.ts'));
const path = 'docs/messungen/2026-09-15-glm-automatable-laufort-pi-setup.md';
const note = await Bun.file(resolve(root, path)).text();
const server = await Bun.file(resolve(root, 'server.ts')).text();
const files = Bun.spawnSync(['git', 'ls-files', '-z'], { cwd: root });
if (files.exitCode !== 0) throw new Error('git ls-files failed');
const trackedPaths = new Set(files.stdout.toString().split('\0').filter(Boolean));
const registry = server.match(/^const HARNESSES: readonly Harness\[\] = \[([^\]]+)\];/m);
if (!registry) throw new Error('registry absent');
const harnesses = registry[1].split(',').map((name: string) => {
  const start = server.indexOf(`const ${name.trim()}: Harness = {`);
  if (start < 0) throw new Error(`adapter absent: ${name}`);
  const body = server.slice(start, server.indexOf('\n};', start));
  const id = body.match(/\bid: "([^"]+)"/);
  if (!id) throw new Error(`id absent: ${name}`);
  return id[1];
});
const literal = server.match(/^const MODEL_RE = (\/.+\/);$/m)?.[1];
if (!literal) throw new Error('MODEL_RE absent');
const modelRe = new RegExp(literal.slice(1, -1));
const efforts = new Set([...server.matchAll(/effortLevels: \[([^\]]*)\]/g)]
  .flatMap((hit) => [...hit[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])));
const cards = [...note.matchAll(/```card\n([\s\S]*?)\n```/g)];
if (cards.length !== 3) throw new Error(`expected 3 cards, got ${cards.length}`);
for (const [i, match] of cards.entries()) {
  const sourceText = match[1];
  const raw = parseFormattedCard(sourceText);
  if (!raw) throw new Error(`card ${i + 1}: parse failed`);
  const sources = new Map<string, string>();
  for (const file of trackedPaths) {
    if (sourceText.includes(file)) sources.set(file, await Bun.file(resolve(root, file)).text());
  }
  const ctx = {
    sourceText, trackedPaths, symbolIndex: new Map(),
    harnessKnown: (v: string) => harnesses.includes(v),
    modelKnown: (v: string) => modelRe.test(v),
    effortKnown: (v: string) => efforts.has(v),
    declares: (file: string, symbol: string) => trackedPaths.has(file) && declaresSymbol(sources.get(file) ?? '', symbol),
    rowKnown: (_id: string) => false,
  };
  const result = validateCard(raw, ctx);
  process.stdout.write(`${String.fromCharCode(65 + i)} valid=${result.valid} surfaceValid=${result.surfaceValid} gaps=${JSON.stringify(result.gaps)}\n`);
  if (!result.valid || !result.surfaceValid || result.gaps.length) throw new Error('card invalid');
  const bad = validateCard({ ...raw, verify: 'not-a-chain-command' }, ctx);
  if (bad.valid || !bad.gaps.some((g: string) => g.startsWith('verify:'))) throw new Error('negative verify probe failed');
}
const declared = declaresSymbol(server, 'PI_ZAI_HARNESS');
const absent = declaresSymbol(server, 'THIS_SYMBOL_MUST_NOT_EXIST');
if (!declared || absent) throw new Error('symbol fallback probe failed');
process.stdout.write('Negative verify probes: PASS; declaration positive/negative: PASS\nALL PASS\n');
```

Prüfausgabe:

```text
A valid=true surfaceValid=true gaps=[]
B valid=true surfaceValid=true gaps=[]
C valid=true surfaceValid=true gaps=[]
Negative verify probes: PASS; declaration positive/negative: PASS
ALL PASS
```

### Verifikation dieses Docs-Schnitts

Nur diese Notiz geändert; der INDEX bleibt der Orchestratorin vorbehalten. Entsprechend dem ausdrücklichen VERIFY des Auftrags wurde die Docs-Kurzkette gefahren:

```text
$ bun install --frozen-lockfile
9 packages installed [45.00ms]
$ bun e2e/pins.ts
PASS  land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT  (land-log says 42)

ALL PASS
```

Beide Kommandos endeten mit Exit 0. Kartenprüfung oben ebenfalls `ALL PASS`; `git diff --check` ohne Ausgabe. Ein zusätzlicher lesender Deklarationscheck aller Quellreferenzen mit Symbolanker löste jede Referenz im Basisbaum auf. Keine Produktsuite oder echte GLM-Kanarie gefahren; die kurze Kette beweist den Dokumentationsschnitt, nicht das vorgeschlagene Startverhalten.

Offen bleiben die echte Pi-Feuerprobe, Pi-RAM unter Last, der aktive Operator-Flag und jede Remote-/VM-Abnahme. **Die Notiz liefert eine Umsetzungsvorlage; sie behauptet keine bereits aktivierte GLM-Automation.**
