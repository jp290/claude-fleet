---
frage: Wie tragen Mac und Second-host mit weniger Speicher mehr parallele Fleet-Arbeit?
urteil: Zuerst den tmpfs-Scratch des Second-host begrenzen, am Mac MCP bedarfsweise starten und abgeschlossene Sessions freigeben; fünf Suiten sind durch diese Messung nicht freigegeben.
bereich: [ram, slots, betrieb, helper, scratch]
belege: [helper-daemon/daemon.ts#work, helper-daemon/daemon.ts#pruneRuns, server.ts#agentCmd, server.ts#ensureSlot, server.ts#transcriptTail, e2e-isolated.sh, e2e-stage.sh]
nicht-gemessen: Reale Freisetzung fremden Scratchs, Produktions-Schlaf/Resume, vier/fünf gleichzeitige Suiten, Board-Tab-Zuordnung, Footprint privilegierter Prozesse und Spitzen zwischen Samples.
stand: 2026-09-13
---

# Weniger RAM für mehr Fleet

| Rang / Hebel | Ersparnis MB (gemessen oder Probe) | Maß | Aufwand | Risiko | wer entscheidet |
|---|---:|---|---|---|---|
| 1. Second-host: Suite-Scratch auf Disk, begrenzte Fehlerbelege | Altersfilter-Dry-run: 3403,43 → 1069,72; Differenz 2333,71, davon 488,89 resident + 1844,82 nichtresident | allokierte tmpfs-Seiten, `du` + `mincore`; **keine ausgeführte Löschung** | mittel | Beweisverlust; aktive Runs dürfen nie in Retention geraten | Owner für Altbestand/Host; Maintainer für C1 |
| 2. Mac: Browser-MCP nur in Browser-Aufgaben | Claude-Pane 364,11 → 160,83 nach 105 s: **203,28**; MCP-Kinder allein 195,02 → 0; Codex **168,51** weniger | Physical Footprint, A/B | klein–mittel | erforderliche Tools fehlen bei falschem Profil | Owner für Fähigkeitspolitik; Maintainer für C2 |
| 3. Mac: regulär abgeschlossene Sessions freigeben | eigene MCP-freie Claude-Pane **160,83 → 0**, alle erfassten Kinder beendet | Physical Footprint, Exit-Probe; keine Produktions-Schlafprobe | klein organisatorisch; Schlafzustand mittel–groß | offene Arbeit oder Zustellpfade verlieren | zuständiger MAIN im Abschlussvertrag; Owner für Schlafpolitik |
| 4. Transkript-Leser mit Bytebudget | eigene Bun-Probe **93,77 → 34,19**, Differenz 59,58 | Physical Footprint am Haltepunkt; identische letzte 30 Rohzeilen | mittel | lange Belege müssen erkennbar gekürzt werden | Maintainer für C4 |
| 5. Suite-Zulassung am Second-host | zusätzliche Suite-Kosten: siehe F7; keine gemessene Ersparnis durch Deckeländerung | PSS + Host-Swap-Aktivität | mittel | längere Warteschlange oder Überlast | Owner; C5 erst nach C1 |

**Entscheidung:** Der bisher übersehene tmpfs-Bestand kommt zuerst. Seine Tabellenzahl ist eine **gemessene Bestandsdifferenz vor/nach einem lesenden Altersfilter**,
keine gemessene Absenkung von Host-RAM oder Swap. Der Auftrag erlaubt auf dem Second-host nur Lesen; reale Bereinigung ist hier nicht messbar, weil sie fremde Dateien
verändern würde. C1 verhindert künftige Ansammlung; Altbestandsbereinigung bleibt ein eigener Owner-Akt. Alter allein erteilt keine Löschfreigabe. Die lokalen
A/B-/Exit-Proben liefern zusätzlich ausgeführte Eingriffe an ausschließlich eigenen Prozessen.

MB bedeutet überall MiB (2²⁰ Bytes). Messdatum 13.09.; Dateiname folgt dem Auftrag. Quellbaum `bdc9acdd`; Gleichheit mit den laufenden Builds ungeprüft. Werkzeuge: Claude
Code 2.1.270, Codex CLI 0.153.4, Bun 1.3.9. Scratch außerhalb des Repos: `/tmp/fleet-ram-astra`. Keine Settings, Daemons oder fremden Prozesse geändert; keine Mac-Suite
gestartet.

## F1 — Was steckt in „outside“ und „other“?

Die Begriffe überlappen: `outside` bedeutet keine gefundene Pane-Abstammung; `other` bedeutet keine der bisherigen Prozessklassen. Die erste Runde lässt sich deshalb
nicht durch Addition erklären. Wiederverwendet: Prozessklassifikation und PPID-Verfolgung aus [erster
Messung](2026-09-14-ram-slots-sessions-astra.md#reproduzierbare-prozessmessung), ergänzt um alle Socket-Panes und `proc_pid_rusage`. Snapshot 18:38:26 UTC:

| Posten | RSS | Footprint | Zuordnung / Grenze |
|---|---:|---:|---|
| outside insgesamt, 383 Prozesse | 2333,64 | 4400,89 lesbar | Footprint 241/383; Rest unknown |
| other insgesamt, 339 Prozesse | 1656,58 | 1893,89 lesbar | Footprint 199/339; überlappt outside |
| fremder Gateway-Dienst | 199,23 | 1251,32 | außerhalb Fleet-Panes; kein Sparauftrag für diesen Dienst |
| outside Bun / Node / Python | 73,38 / 89,90 / 26,38 | 385,35 / 332,89 / 198,76 | gemischte Dienste; PPID allein beweist kein Leck |
| Simulator | 7,73 | 142,35 | keine belegte Board-Kausalität |
| Spotlight, inklusive zugehöriger Prozesse | 161,86 | 103,71 lesbar | OS; privilegierte Anteile unknown |
| zusätzlicher Web-Entwicklungsserver | 11,95 | 90,65 | eigenes Projekt; kein Board-Nachweis |
| Finder / ControlCenter / NotificationCenter | 20,25 / 18,17 / 13,48 | 67,74 / 52,27 / 49,92 | Desktop-Grundlast |
| zwei Tunnel-Prozesse | 22,44 | 54,43 | Infrastruktur; genaue Produktanteile unknown |
| WindowServer | 16,17 | nicht lesbar | fehlende Prozessberechtigung |
| Safari / drei WebKit-Prozesse | 1,58 / 5,36 | 5,05 / 27,38 | Tab-Zuordnung nicht erhoben |

Kein Chrome-Prozess im Snapshot. Board-Anteil und WindowServer-Mehrkosten sind **nicht messbar, weil weder Tab-/Fensterzuordnung noch ein erlaubter Board-an/aus-Vergleich
vorliegt**. Die fremden Dienste sind keine stillschweigend freigegebenen Abschaltkandidaten. E2E-Reste: F6.

## F2 — Maß und neue Rangfolge

Physical Footprint enthält belastete schmutzige sowie komprimierte/ausgelagerte Seiten; RSS lässt letztere verschwinden. Footprint ist darum **keine zusätzlich residente
RAM-Summe**. Insbesondere nicht Footprint + SWAPPED rechnen. Das entspricht [Apples Messbeschreibung](https://developer.apple.com/videos/play/wwdc2022/10106/). Der
schnelle Sensor nutzt `proc_pid_rusage(pid, 2, &rusage_info_v2).ri_phys_footprint`, das Layout aus [Apples
Header](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/resource.h). Gegenprobe am selben MCP-PID direkt vor/nach `vmmap -summary PID`: **62,496 / 62,5 /
62,496 MiB**.

| Prozessklasse, gleicher Snapshot | Anzahl | Footprint | RSS |
|---|---:|---:|---:|
| Playwright-MCP einschließlich npx-Unterbau | 34 | 2145,37 | 347,73 |
| Claude | 7 | 1947,07 | 1392,12 |
| other, nur lesbarer Footprint | 339 | 1893,90 | 1656,58 |
| Codex | 22 | 1545,90 | 283,52 |
| fremder Gateway-Dienst | 1 | 1251,32 | 199,23 |
| übrige Node / Bun | 33 / 13 | 551,07 / 385,35 | 186,75 / 73,38 |
| Bun-Server | 10 | 420,14 | 315,53 |
| tmux | 2 | 33,24 | 8,73 |

337/481 Footprints waren lesbar; fehlende Werte wurden bei Summen ausgelassen, niemals als bewiesene Null behandelt. Ein ergänzender `vmmap`-Schnitt zeigt beim Gateway
**979,3 MiB SWAPPED**, beim größten Codex-Prozess **554,9**, bei einer Claude-Session **253,6**, beim Fleet-Server **137,8**. Diese Größen sind separate
Kompressions-/Swap-Indizien, keine addierbaren Ersparnisse. Hostanfang: Kompressor physisch **2588,16**, darin logisch **9514,69**; Swap belegt **2646,62**.

## F3 — Spitze über Zeit

**18:38:39–19:08:39 UTC**, je 73 Samples über 1800 s. Collector-Dauer Mac 0,109–0,203 s, Linux 0,062–0,181 s; größter Abstand 25,153 / 25,103 s. Keine fehlende Zeile.

| Maß über 30 min | Mac | Second-host |
|---|---:|---:|
| Swap belegt min–max | 2606,62–2646,62 | konstant 1913,75 |
| kumulativ neu eingelagert / ausgelagert | 42,84 / 0,00 | 0,00 / 0,00 |
| Kompressor physisch / MemAvailable min–max | 1940,67–2963,44 | 2798,50–3199,15 |
| Footprint-Summe / lesbare PSS-Summe min–max | 10316,78–11033,42 | 1434,68–1825,27 |
| Mac `memory_pressure` free-percentage | 36–50 % | — |

Second-host-PSI: `some.total` +7 µs, `full.total` +6 µs; keine anhaltende Stall-Phase belegt. Mac-Kategorien min–max Footprint: MCP **2066,96–2369,21**, Claude
**1696,32–2195,31**, Codex **1519,43–1990,49**, Bun-Server **272,66–431,30**. Eigene Codex-CLI-PIDs mit dem Paketnamen im Override wurden anhand ihrer Prozessgeburt
korrigiert (F4); Gesamt-Footprint unverändert. Größter positiver Sample-Schritt: **+598,04 MiB um 18:58:39**, davon Codex +248,52 und MCP +223,66; er fällt in eine eigene
Codex-Startprobe. Die Reihe beweist Startup-Kosten, keinen Produktions-OOM. Ein vollständiges Land-Gate oder eine fremde Lane-Gründung ist im Raster **nicht belegt**;
kausale Gate-/OOM-Zuordnung nicht messbar, weil kein solches Ereignis synchron nachgewiesen wurde. Subsekunden-Bun-Proben können zwischen die Samples fallen; ihre
Haltepunkte stehen separat in F9.

Methode: `python3 /tmp/fleet-ram-astra/sample.py > /tmp/fleet-ram-astra/mac-30min.jsonl`; remote derselbe Collector über SSH-stdin, Ausgabe ausschließlich lokal. Fester
Abstand 25 s, Laufzeit 1800 s, Zahlen pro Kategorie/PID/Pane; keine Kommandozeilen gespeichert. Mac: `memory_pressure -Q`, `vm_stat`, `sysctl vm.swapusage`,
libproc-Footprints. Linux: `/proc/meminfo`, `/proc/vmstat` (`pswpin/pswpout`), `/proc/pressure/memory`, `/proc/PID/smaps_rollup`. Seit Boot kumulierte Swapzähler werden
differenziert. Die eigene A/B-Arbeit ist Teil des Messfensters; sie wird als solche ausgewiesen.

## F4 — Wer startet MCP, wie oft wird es benutzt, was spart Abschalten?

Claude: User-Settings aktivieren `playwright@claude-plugins-official`; das aktive Plugin enthält `.mcp.json` mit `playwright → npx @playwright/mcp@latest`.
Projekt-`.mcp.json` fehlt; die gelesenen Projektsettings und die globale MCP-Server-Tabelle enthalten keine zusätzliche Playwright-Definition. Codex:
`plugins."playwright@claude-plugins-official".enabled=true`; dessen Plugin-Manifest enthält denselben npx-Start. Die zwei direkten MCP-Konfigurationen betreffen andere
Werkzeuge. Es wurden ausschließlich relevante Konfigurationsschlüssel gelesen.

Eigener Socket `ramprobe71269`, jeweils eine Pane im selben Arbeitsbaum, seriell: `claude --model 'claude-opus-5[1m]' --effort high --prompt-suggestions false` gegen
denselben Befehl plus `--strict-mcp-config --mcp-config '{"mcpServers":{}}'`. Kein Arbeitsauftrag gesendet. Das entspricht der dokumentierten [exklusiven
MCP-Auswahl](https://code.claude.com/docs/en/cli-reference).

| Leerlauf nach Start | normal, Footprint | strict, Footprint | Differenz |
|---|---:|---:|---:|
| 45 s | 377,58 | 174,28 | 203,30 |
| 75 s | 378,24 | 174,74 | 203,50 |
| 105 s | 364,11 | 160,83 | 203,28 |

Normal: ein Claude + zwei MCP-Prozesse; strict: ein Claude, kein MCP. Die MCP-Kinder allein tragen konstant **195,02 MiB**. Der Rest der Differenz liegt im Elternprozess;
CPU-/Warm-up-Unterschiede sind damit nicht ausgeschlossen. Ein warmgelaufener Browser wurde nicht geöffnet.

Codex-Probe `ramprobe11076`: heutiger Start mit `--dangerously-bypass-approvals-and-sandbox` und `-c check_for_update_on_startup=false`. Die zusätzlichen Plugin-Overrides
`plugins."playwright@claude-plugins-official".enabled=false` sowie `plugins."playwright@claude-plugins-official".mcp_servers.playwright.enabled=false` ließen beide
MCP-Kinder stehen (**328,78 / 338,57 MiB** nach 105 s; Default **324,59**). Dokumentierter [Plugin-Schalter](https://learn.chatgpt.com/docs/config-file/config-reference)
und diese Installation stimmen hier praktisch nicht überein. `mcp_servers.playwright.enabled=false` allein scheiterte schon am Start: `invalid transport`; kein Agent,
daher ist dessen Null-Footprint **keine Ersparnis**.

Wirksam laut `codex mcp list --json` und eigener Pane (`ramprobe62994`) ist die vollständige Definition: `-c
'mcp_servers.playwright={command="npx",args=["@playwright/mcp@latest"],enabled=false}'`. Nach 45/75/105 s: **154,67 / 156,06 / 156,07 MiB**; gegen Default bei 105 s
**168,51 MiB weniger**. Die Executable-Gegenprobe (`ramprobe71467`) fand genau `node`, `codex`, `node_repl`, **0 MCP-Kinder**, bei **252,93 MiB** nach 45 s. Der
identische Start schwankt also deutlich; 168,51 MiB sind ein gemessener Vergleich, keine garantierte Ersparnis je Codex-Session. Der Paketname im Override brachte den
alten Klassifikator dazu, die beiden Codex-Startprozesse fälschlich als MCP zu zählen. Die Gegenprobe liest dafür nur Executable/Skriptposition; die Gesamt-Footprints
waren davon unberührt. Globalen Pluginzustand unverändert lassen.

Nutzung: rekursiver JSONL-Scan der Lane-Projektverzeichnisse über exakt die letzten 14 Tage, Filter `message.content[].type == "tool_use"` und Name enthält `playwright`,
Zeitstempel je Eintrag. **193 Lane-Verzeichnisse, 203 jüngst geänderte Dateien, 3 Verzeichnisse mit 42 Aufrufen**; 0 fehlerhafte JSON-Zeilen. Verteilung: Screenshot 14,
Klick 7, Evaluate 6, Navigate 5, Resize/Snapshot je 4, Close/Type je 1. Aufruftage: 01./05./09.09. Quote 3/193 = **1,55 %** der vorhandenen Verzeichnisse;
gelöschte/verlagerte Historien und andere Harness-Archive sind nicht erfasst. Gezählt wurden Aufrufe, keine Erfolgsmeldungen oder Textnennungen.

C2 gehört in `server.ts:223` (`agentCmd`) und den Codex-Startpfad `server.ts:1095`, ebenso Resume. `slotCmd` (`217`) verpackt nur das Kommando. Vorschlag: explizites
Browser-Profil aus der Aufgabe; Text-Lanes ohne Browser-MCP, Browser-Lanes mit. Claude-strict unterdrückt **alle** ambienten MCPs; benötigte andere MCPs müssen
ausdrücklich enthalten sein. Kein pauschaler Verlust fremder Tools. Claude/Codex: apply; Pi ohne diesen Plugin-Pfad: not-applicable; Container: gesondert prüfen oder unsupported. Server, Start/Resume, Karten-/Client-Auswahl, Dokumentation und Canary sind apply. Die Spawn-Signatur
(`server.ts:346`) braucht dafür den Profilwert; eine globale Settings-Änderung genügt nicht.

## F5 — Nutzen je Session und Schlafen

`GET /api/sessions` mit Lane-Self-Token: **HTTP 401**. API-Idle und `ctx` sind daher **nicht messbar, weil diese Route Owner-Authentifizierung verlangt**; es wurde kein
Owner-Token benutzt. Ersatz: ausschließlich Slot-Metadaten aus dem persistenten Zustand sowie `stat` des zum `openedAt` passenden Streams (`server.ts:2797`). Streamruhe
bedeutet Zeit seit letzter Dateiänderung, keine belegte Arbeitslosigkeit. Footprints stammen vom früheren Snapshot; keine Gleichzeitigkeit behauptet.

| Slot / Zweck aus Label oder Program-Bindung | Footprint Baum | davon MCP | Streamruhe min |
|---|---:|---:|---:|
| 1 / diese RAM-Lane, Betriebsprogram | 383,36 | 126,72 | 0,00 |
| 2 / Supervisor | 301,08 | 118,99 | 1352,13 |
| 3 / Betriebsprogram-Lane | 383,23 | 119,28 | 20,59 |
| 4 / Betriebsprogram-Lane | 461,18 | 196,64 | 0,41 |
| 6 / ohne Zwecklabel | 372,01 | 123,25 | 1,72 |
| 7 / Orchestrator | 394,84 | 123,75 | 6,10 |
| 9 / Betriebs-MAIN laut Label | 409,55 | 124,08 | 0,00 |
| 10 / Controller | 1098,52 | 489,57 | 353,23 |
| 11 / Analyse, resumed | 281,87 | 120,17 | 1875,69 |
| 14 / Storage | 414,91 | 118,99 | 24,59 |
| 15 / Usage | 459,16 | 119,23 | 521,81 |
| 16 / weiteres Produkt | 810,60 | 364,69 | 1457,18 |

Nur 1/3/4 tragen in den gelesenen Slotdaten eine `programId`; Program-MAIN-/Supervisor-Bindungen liegen zusätzlich außerhalb dieses Feldes. Labels verleihen keine Bindung
oder Abschaltautorität. Slots 10/16 besitzen 8/6 MCP-Prozesse; der große Baum ist keine einzelne minimale CLI.

Exaktes Resume existiert (`ensureSlot`, `server.ts:4815–4817`; Codex `1098–1100`). `/restart` (`31505–31539`) startet unmittelbar neu. Einfaches Pane-Ende wird alle 2 s
repariert (`26129–26136`); `teardownSlotOccupant` (`5169–5215`) löscht Identität/Zweck. **Dauerhafter Schlaf fehlt hier.** Eigene Exit-Probe: strict-Baum **160,83 → 0
MiB**, anschließend kein lebender erfasster PID mit passender Prozessgeburt. Das beweist Freigabe beim Exit, keinen produktionsfähigen Schlaf/Resume-Vertrag. Bestehender
kleinerer Weg: `tickLaneAutoClose` (`12986–13040`) für verbrauchte, beurteilte, commitlose Lanes; dessen Refusals (`12888–12964`) bewusst beibehalten. SIGSTOP ist kein
RAM-Hebel. C3 erst mit persistiertem Pausezustand, sicherer Zustellung/Wake und Identitätsprüfung nach Awaits.

## F6 — Leichen und Scratch

Die Aussage von `state.sh:329–331` zählt Namen. Gemessen: drei passende Socket-Dateien, davon Produktions-Socket lebend, ein Test-Socket tot (**kein zugeordneter
Server-RAM**), ein weiterer Test-Socket lebend (Server + sichtbare Panes **16,82 MiB Footprint**, Agentenkinder nicht durch diese Teilzahl ausgeschlossen). Keine dieser
drei Zahlen ist eine automatische Kill-Liste.

Zehn `bun server.ts`-Prozesse wurden per cwd geprüft. Einer gehört zum Hauptbaum (**221,61 MiB**), einer zu einer E2E-TMPDIR-Instanz, PPID 1 (**38,30 MiB**); acht weitere
gehören anderen cwd. Der E2E-Prozess hat PPID 1; Zugehörigkeit zu einem noch aktiven Lauf und ursprünglicher Abbruchgrund bleiben unknown. Mac-Scratch: 12
E2E-Verzeichnisse, **616,54 MiB allokiert** (`du -sk`, exit 0), daneben **240,56 MiB logische Dateigrößen**; damit ist der alte 617-MB-Diskbefund reproduziert. Weder
Größe noch Alter beweisen Resident-Bytes.

Cleanup existiert: tote Sockets in `e2e-stage.sh:399–401`; lebende verwaiste Suite-Sockets beim nächsten passenden Start in `e2e-isolated.sh:730–737`. SIGKILL umgeht
EXIT-Cleanup; als heutige Ursache unbelegt. Rote Instanzen bleiben absichtlich erhalten (`e2e-isolated.sh:858`). Sicherer Reaper braucht exakte Run-/Socket-Identität, PID
**plus Geburtszeit**, keine aktiven cwd/Datei-Referenzen und Owner-Regeln für Fehlerbelege. Für alte Scratch-Verzeichnisse fehlt der Run-Marker; unbekannte Zugehörigkeit
muss erhalten bleiben. C6 korrigiert zuerst den Sensor.

## F7 — Second-host: vier oder fünf Suiten, und wessen Swap?

Live gemeldeter Helper-Deckel: **3**; der Brief nennt Dateiänderung auf 4. Config wird nur beim Start geladen (`helper-daemon/daemon.ts:902–907`); Heartbeat meldet den
geladenen Wert (`843`). Kein Neustart durchgeführt. Datei-Config gemessen: **4**, `keepRuns=10`, Timeout 3600 s; der Arbeitsordner liegt laut `stat -f -c %T` auf
`ext2/ext3`, also außerhalb tmpfs.

Zusatzreihe 18:52:38–18:57:38 UTC: 13 Samples / 300,01 s, alle 25 s. Eine E2E-Instanzgruppe war durchgehend sichtbar: **102,33–163,24 MiB PSS**, 6–15 lesbare Prozesse;
eine zweite erschien in einem Sample mit **76,77 MiB**. Gruppierung per `/proc/PID/cwd` unter einem Instanzpfad, dazu dessen tmux-Server. Wrapper außerhalb des Pfads und
kurzlebige Prozesse zwischen Samples sind nicht vollständig enthalten. Die Grenze von vier/fünf wurde nie erreicht.

Die entscheidende zweite Speicherklasse lebt in Dateien: `df -k -t tmpfs` findet `/tmp` mit **3929,39 MiB Kapazität / 3764,01 belegt / 165,38 verfügbar**. `du -sk` über
dessen Kinder: 65 E2E-Instanzen **3398,35 MiB**, weitere Fleet-Dateien **190,09**, CLI-Scratch **106,35**. `du` endet wegen unzugänglicher fremder Unterbäume mit 1; die
gelesenen Zahlen bleiben Teilabdeckung. Swap insgesamt **1913,75**, Zswap/Zswapped **0**; alle gelesenen `/proc/PID/status` liefern `VmSwap=0`. PSS ist bei 240 Prozessen
unzugänglich. POSIX-SHM-Dateien: 8192 Bytes; SYSV-SHM: 0 Einträge.

**Lesende Residency-Probe:** eigene tmpfs-Dateien `O_RDONLY` öffnen, `mmap(PROT_NONE, MAP_SHARED)`, `mincore`, sofort `munmap`; Dateiinhalt wird nicht gelesen oder in RAM
geholt. Pro Datei `st_blocks*512` gegen residente Seiten × 4096; Symlinks auslassen, Inodes je Wurzel deduplizieren. Methode und tmpfs-Accounting:
[Kernel-Dokumentation](https://docs.kernel.org/filesystems/tmpfs.html).

| Altersfilter auf Verzeichnis-mtime | Dateien | allokiert | resident | allokiert, nichtresident |
|---|---:|---:|---:|---:|
| bis 24 h | 186777 | 1069,72 | 1069,72 | 0,00 |
| älter als 24 h | 409240 | 2333,71 | 488,89 | 1844,82 |
| nach hypothetischem Ausschluss alter Wurzeln | 186777 | 1069,72 | 1069,72 | 0,00 |

0 unlesbare Dateien in dieser Eigentümer-Stichprobe. 46 alte Wurzeln ohne gefundenen lesbaren Same-UID-cwd/fd-Verweis; sieben Prozesse unlesbar, andere UIDs unknown.
Aktive Nutzung ist damit nicht vollständig ausgeschlossen; aus diesen Zahlen folgt keine Löschfreigabe. Andere Zeitpunkte erklären die kleine Differenz zur vorigen
`du`-Summe. Nichtresidente allokierte tmpfs-Seiten sind der starke Beleg für das fehlende Swap-Konto: **1844,82 MiB entsprechen 96,4 % des gemessenen Host-Swaps**. Das
ist keine exakte Swap-Slot-Zuordnung je Datei; Löcher, gleichzeitige Schreibvorgänge und andere Shmem-Nutzer begrenzen den Vergleich. Ein realer Vorher/Nachher-Reclaim
bleibt ungemessen.

`e2e-isolated.sh:44` legt Instanzen in TMPDIR oder `/tmp` an; `858` behält rote Instanzen. `pruneRuns` (`helper-daemon/daemon.ts:807–815`, `keepRuns` Default 10) begrenzt
nur `workDir/run-*`. Diese Retention erreicht `/tmp` nicht. C1: Scratch neben `tree` unter den Disk-Laufordner, über `suiteEnv` (`504–505`, Aufruf `584`) weiterreichen.
Aktive Runs von Retention ausnehmen: der bestehende Pruner schützt sie noch nicht. Keine globale tmpfs-/Swap-Umkonfiguration nötig. **Vier/fünf ohne Swap-Druck sind nicht
nachgewiesen.** Erst diesen Bestand/Entstehungspfad behandeln, dann einen Vierer-Pilot über eine volle Suite messen. Fünf erst nach dessen Spitzen-/Wartezeitbeleg.

## F8 — Verlagerung auf den Second-host

Es bestehen zwei Instanzen mit Git-Transport, keine gemessene transparente Session-Migration: `server/tmux.ts:5–9`, `server.ts:4855–4858`,
[Transport](../dual-host-git-transport.md), [Topologie](../dual-host-topologie-entscheidung-2026-09-05.md). Der Folger baut selbst (`fleet-sync.sh:113–116`); beide
Grundinstanzen bleiben bestehen.

Im ergänzenden Linux-Snapshot tragen vier Claude-Prozesse **1177,02 MiB PSS**, im Mittel **294,25**; Mac: sieben Claude-Prozesse **1947,07 MiB Footprint**. Diese Maße und
Aufgaben sind verschieden. Verlagern entlastet den Mac um den dort tatsächlich beendeten Baum; im Ziel entsteht ein neuer. **Hostübergreifende Nettoersparnis ist nicht
messbar, weil kein gleicher Arbeitsauftrag auf beiden Hosts gestartet und beendet werden durfte.** Fehlendes MCP auf Linux kann helfen, aber C2 bietet bereits eine lokale
Abhilfe. Der tmpfs-Bestand schwächt die vermeintlich freie Zielkapazität zusätzlich.

## F9 — Server-Puffer: reale Daten und ausgeführte Gegenprobe

Größenprobe per `stat`, keine Inhalte ausgegeben: 1005 Claude-Fleet-Transkripte **1077,53 MiB**, größtes **29631099 Bytes**; 390 Codex-Rollouts **1513,49 MiB**, größtes
**91535200 Bytes**; 23 Streams **133,34 MiB**, größter **94274455 Bytes**. Codex-Dateien gehören zu einem anderen Reader und sind keine `transcriptTail`-Eingabe. Wachstum
nach diesem Snapshot bleibt möglich.

`transcriptTail` (`server.ts:12011`) liest alles vor `split/filter/slice(-300)`. Die größte echte Claude-Datei hat **1064 Zeilen**, maximale Zeile **965313 Bytes**; ihre
letzten 300 Zeilen tragen **14726192 Bytes**, die letzten 30 nur **40795**. Ein Zeilenlimit begrenzt die Bytes kaum.

Eigene Bun-Probe: ganze Datei → 300 Rohzeilen → letzte 30 gegen rückwärts gelesene 64-KiB-Blöcke, maximal 1 MiB → letzte 30. **29631099 → 1048576 gelesene Bytes**,
Footprint **93,77 → 34,19 MiB**; beide Ausgaben **40794 Bytes**, SHA-256 `472fc83d7f8c99108c22c68942f8172c2585201ccdd58179a20c25de32fc32e7`. Das prüft den Speicherhebel
und Rohzeilen-Erhalt an dieser Datei, nicht den vollständigen `viewEntry`-Renderer. Die begrenzte Seite sah 72 statt 300 Zeilen; Produktionscode braucht ein sichtbares
Kürzungskennzeichen.

Die Gegenprobe hat einen schlechten Entwurf verworfen: wiederholtes Dekodieren/Verketten wachsender 64-KiB-Tails kostete **208,30 statt 136,06 MiB**, trotz gleichem
300-Zeilen-Ergebnis. Blockweises Byte-Lesen allein senkte das nur auf **128,39 statt 135,83**. Erst Bytebudget und kleine Ausgabe lieferten den oben gemessenen Gewinn.
Erste 4-MiB-Probegrenze war für diese 14-MiB-Tail zu klein; der dadurch fehlende Messbeleg wurde als Probenfehler behandelt.

`tickHarvest` (`11923–11945`) überspringt alten Bestand beim ersten Kontakt, allokiert später den ganzen Zuwachs und nochmals `Buffer.concat`; Restzeilen sind
unbeschränkt. `poll` (`11437–11454`) liest jeden Stream-Rückstand vollständig. Dateigrößen liefern deren **mögliche** Eingangsgröße, keinen Nachweis eines aktuell so
großen Rückstands oder eines Lecks. Fix: Bytebudget pro Tick, begrenzte Restzeile, konsumierter Cursor, UTF-8-/Rotationstests; Poll separat mit Occupant-Guard. Keine
zusätzliche Speicher-Abstraktion nötig: Budgets gehören an diese vorhandenen Lesergrenzen.

## Schnitte

**Schnittlinie:** C1 und C2 zuerst. C3 nur mit ausdrücklich entschiedener Schlafsemantik; reguläre Abschlüsse nutzen schon den vorhandenen Vertrag. C4 ist unabhängig. C5
folgt C1. C6 beginnt lesend. Alle Blöcke sind Vorschläge, keine gefilten Tasks, keine Freigabe für Settings/Deploy/Altbestand-Löschung.

```text
C1 — Suite-Scratch unter begrenzte Disk-Retention
ROLLE: codex / gpt-6-astra / high
GROESSE: mittel
FLAECHE: helper-daemon/daemon.ts#work/#pruneRuns, e2e/helper-daemon.ts
NEU: —
VERIFY: install, pins, tsc, build, clean-review, security, claude-gate; isolated nach Gate-Regel
DONE: Zwei parallele Runs nutzen je eigenen Scratch neben tree; rote Belege bleiben innerhalb keepRuns; Retention entfernt keinen aktiven Run; Ziel-Dateisystem ist als Disk belegt.
Schnittlinie: kein Neustart, keine globalen Settings, keine Altbestands-Löschung; aktive Runs müssen vor Prune geschützt sein.

C2 — Explizites MCP-Profil für Lane-Start und Resume
ROLLE: codex / gpt-6-astra / high
GROESSE: mittel
FLAECHE: server.ts#agentCmd/#slotCmd/#CLAUDE_HARNESS/#CODEX_HARNESS, server/types.ts, src/protocol.ts, src/client.ts, e2e/harness.ts, e2e/pins.ts
NEU: —
VERIFY: install, pins, tsc, build, clean-review, security, claude-gate; isolated
DONE: Text-Lane startet ohne Playwright-Kinder; Browser-Lane besteht Tool-Canary; Resume erhält das Profil; sonst benötigte MCPs bleiben erreichbar; alle Adapter explizit disponiert.
Schnittlinie: nur neue bzw. regulär resumierte Occupants; keine laufenden Sessions oder globalen Plugins umstellen.

C3 — Owner-gesteuertes Schlafen mit exaktem Wake
ROLLE: codex / gpt-6-astra / high
GROESSE: gross
FLAECHE: server.ts#ensureSlot/#teardownSlotOccupant, server/types.ts#Slot, src/protocol.ts, src/client.ts, e2e/restart.ts
NEU: —
VERIFY: install, pins, tsc, build, clean-review, security, claude-gate; isolated
DONE: Schlaf überlebt Self-heal und Serverneustart; Wake bindet exakte Session; Zustellung an schlafende Occupants ist dauerhaft geklärt; laufende Tools und fehlende Resume-Belege führen zur Ablehnung.
Schnittlinie: zunächst Claude/Codex; andere Adapter explizit unsupported; keine automatische Idle-Abschaltung.

C4 — Bytebudget der Transkript-Leser
ROLLE: codex / gpt-6-astra / high
GROESSE: mittel
FLAECHE: server.ts#transcriptTail/#tickHarvest, e2e/summary.ts
NEU: —
VERIFY: install, pins, tsc, build, clean-review, security, claude-gate
DONE: Große Datei und überlange Einzelzeile überschreiten das festgelegte Leserbudget nicht; normale Ausgabe bleibt gleich; Kürzung ist sichtbar; Rotation/UTF-8/gleichzeitiges Append verlieren keinen unmarkierten Cursorbereich.
Schnittlinie: kein voller Poll-Umbau; keine Änderung fremder Transkriptdateien.

C5 — Vierer-Pilot vor höherem Suite-Deckel
ROLLE: codex / gpt-6-astra / high
GROESSE: mittel
FLAECHE: helper-daemon/daemon.ts#freeSuiteSlots, e2e/helper-daemon.ts, docs/messungen/INDEX.md
NEU: docs/messungen/2026-09-suite-kapazitaet.md
VERIFY: install, pins, tsc, build, clean-review, security, claude-gate; isolated auf freigegebenem Ziel
DONE: Voller Vierer-Lauf belegt PSS-Spitze, MemAvailable, tmpfs/Disk-Verbrauch, si/so und Durchsatz; fünfte Suite nur nach vorher benanntem Reservekriterium zulässig, sonst ausdrückliche Ablehnung.
Schnittlinie: hängt an C1 und Owner-Laufbudget; keine Suite auf dem Mac, kein stiller Daemon-Neustart.

C6 — Hygiene-Sensor mit lebend/tot/unknown
ROLLE: codex / gpt-6-astra / high
GROESSE: klein
FLAECHE: state.sh, e2e/pins.ts
NEU: —
VERIFY: install, pins, tsc, build, clean-review, security, claude-gate
DONE: Produktions-Socket zählt nicht als Leak; tote Socket-Datei trägt keinen behaupteten Prozess-RAM; lebende Test-Sockets nennen Zugehörigkeit oder unknown; Scratch zeigt Dateisystem und Speichermaß.
Schnittlinie: reines Lesen; Reaper und Löschfreigaben bleiben ein separater Owner-Akt.
```

## Belegabschluss

Verifikation: `bun install --frozen-lockfile` exit 0;
`bun e2e/pins.ts` exit 0. Exakter Tail: **ALL PASS**.

 Zehn eigene Sockets geprüft: `ramprobe{71269,92920,97871,99940,7986,11076,46042,60135,62994,71467}`. Für jeden endete `tmux -L NAME ls` mit **exit
1**. Eigene Claude-/Codex-Kinder: **0 Überlebende** nach Vergleich von PID plus Prozessgeburt. Fehlgeschlagene Probe-Starts zählen nicht als Speichergewinn.
Abnahmegrenze: Die wörtliche Top-3-Forderung bleibt für Rang 1 unerfüllt: ein lesender Bestandsfilter ersetzt keine reale Optimierungs-A/B-Probe. Dafür ist ein separat
autorisierter Altbestands-/Scratch-Pilot nötig. Produktionsreclaim, Schlaf/Wake und Vierer-/Fünfer-Lauf bleiben offen.
