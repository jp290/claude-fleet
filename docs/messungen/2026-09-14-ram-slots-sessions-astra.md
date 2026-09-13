---
frage: Wie lässt sich der RAM-Verbrauch der Fleet-Slots und Sessions auf beiden Hosts senken?
urteil: Bedarfsgesteuertes MCP spart voraussichtlich 250–330 MiB am Mac; Session-Anzahl und Suite-Parallelität sind die weiteren großen Hebel, tmux-History ist nachrangig.
bereich: [ram, slots, betrieb]
belege: [server.ts#agentCmd, server.ts#ensureSlot, server.ts#tickHarvest, server.ts#transcriptTail, src/client.ts, docs/harness-adapter.md]
nicht-gemessen: A/B-Einsparungen, Spitzenlast über Zeit, Board-Tabs, vollständige private Speicherzuordnung und tatsächlicher Toolbedarf je Session.
stand: 2026-09-13
---

# RAM der Slots und Sessions

| Posten | Host | MB gemessen | Methode (exaktes Kommando; Skript unten) |
|---|---|---:|---|
| Physischer RAM | Mac | 8192,00 | `sysctl -n hw.memsize` / 1048576 |
| Frei / wired | Mac | 73,13 / 1881,92 | `vm_stat`; Seiten × 16384 / 1048576 |
| Kompressor physisch / darin logischer Inhalt | Mac | 3066,30 / 10938,48 | `vm_stat`; occupied / stored × 16384 / 1048576 |
| Swap belegt / Kapazität | Mac | 2662,62 / 4096,00 | `sysctl vm.swapusage` |
| Claude, 8 Prozesse; davon 7 in s-Slots | Mac | 1572,86 RSS; s-Slots 1359,27 | `python3 /tmp/fleet-ram-probe.py` → CATEGORIES / SLOTS |
| Playwright-MCP samt npm/npx, 34 Prozesse | Mac | 366,80 RSS | `python3 /tmp/fleet-ram-probe.py` → playwright-mcp |
| bun server.ts, 10 Prozesse; eigener Server enthalten | Mac | 339,41 RSS; eigener Server 195,02 | `python3 /tmp/fleet-ram-probe.py` → bun-server / server |
| Codex, 22 Prozesse / übrige Node, 33 | Mac | 274,95 / 181,47 RSS; davon in s-Slots zusammen 334,9 | `python3 /tmp/fleet-ram-probe.py` → codex / node / SLOTS |
| Übriges Bun, 13 Prozesse | Mac | 91,08 RSS | `python3 /tmp/fleet-ram-probe.py` → bun |
| tmux, 2 Prozesse / History aller sichtbaren Panes | Mac | 11,72 RSS / 7,418 History | `python3 /tmp/fleet-ram-probe.py` → tmux / Summe history_MiB |
| Fremdes Projekt openclaw-gateway | Mac | 230,47 RSS | `python3 /tmp/fleet-ram-probe.py` → openclaw |
| Übrige Prozesse, einschließlich OS und fremder Apps | Mac | 1637,02 RSS | `python3 /tmp/fleet-ram-probe.py` → other |
| RAM / verfügbar / frei | Second-host | 7858,77 / 2769,37 / 237,51 | `free -k`; total / available / free jeweils / 1024 |
| buff/cache / shared (überlappend) | Second-host | 4628,29 / 1789,98 | `free -k`; buff/cache / shared jeweils / 1024 |
| Swap belegt / Kapazität | Second-host | 1913,75 / 2277,00 | `free -k`; Swap used / total jeweils / 1024 |
| Zswap / Zswapped | Second-host | 0 / 0 | `cat /proc/meminfo`; entsprechende kB / 1024 |
| Claude, 4 Prozesse | Second-host | 1421,05 RSS / 1181,78 PSS / 0 VmSwap | `python3 /tmp/fleet-ram-probe.py` → claude |
| Drei Suite-Runner | Second-host | 460,84 RSS / 344,79 PSS / 0 VmSwap | `python3 /tmp/fleet-ram-probe.py` → bun-e2e |
| bun server.ts, 5 Prozesse | Second-host | 346,54 RSS / 173,95 PSS / 0 VmSwap | `python3 /tmp/fleet-ram-probe.py` → bun-server |
| Übriges Bun, 1 Prozess | Second-host | 43,55 RSS / 12,01 PSS / 0 VmSwap | `python3 /tmp/fleet-ram-probe.py` → bun |
| tmux, 4 Prozesse / History aller Panes | Second-host | 60,30 RSS / 11,762 History | `python3 /tmp/fleet-ram-probe.py` → tmux / Summe history_MiB |
| Drei Suiten einschließlich Fixture-Panes und eigener tmux-Server (Teilmenge obiger Zeilen) | Second-host | 945,43 RSS | `python3 /tmp/fleet-ram-probe.py`; SLOTS t0+t1+t2 = 434,78 + bun-e2e 460,84 + tmux 17,01+18,49+14,32 |
| Übrige Prozesse | Second-host | 1088,13 RSS; PSS nur Teilabdeckung 167,62 | `python3 /tmp/fleet-ram-probe.py` → other |

**Einheit:** „MB“ in den Tabellen bedeutet MiB (2²⁰ Bytes). Hostmessung 2026-09-13 ca. 19:35 CEST;
Prozesssnapshots Mac 19:37:52, Second-host 19:37:53; vmmap 19:38:48–54. Dateiname folgt dem Auftrag.
Quellbaum `dadefeb9`; Gleichheit mit den laufenden Builds ungeprüft. Prozessstarts/-enden zwischen
Sensoren sind möglich: der erste Mac-Snapshot enthielt s5; beim maßgeblichen zweiten war dessen
Prozessbaum bereits verschwunden. Diese Lane hat keinen Prozess beendet.

RSS zählt residente Mappings mit möglichen gemeinsamen Seiten mehrfach. Linux-PSS teilt solche
Seiten anteilig; Zugriff auf fremde Prozesse ist teilweise verweigert. Kompressor-Inhalt ist logische
Größe, seine physische Belegung steckt bereits im RAM. Swap, PSS, RSS und History sind keine
addierbaren Hostposten. Der hohe Swap-Füllstand allein beweist keine aktuelle Überlast:
`vmstat 1 2` zeigte im zweiten Linux-Sample **si=0, so=0 KiB/s**; außerhalb dieses Sekundenintervalls unknown.
Der Host-Swap lässt sich aus den lesbaren Fleet-VmSwap-Werten nicht erklären; fremde Prozesse und
Shared-Memory-Swap sind nicht vollständig zugeordnet. Auf dem Mac wurde pro Prozess vmmap ergänzend gemessen.

## Rangliste: fünf größte zuordenbare Fleet-Posten und ihr Hebel

Reihenfolge nach umsetzbarem Nutzen für den Mac. Ersparnisse sind **Schätzungen aus dem Snapshot**, keine A/B-Messung.

| Hebel | Ersparnis MB | Aufwand | Risiko | wer entscheidet |
|---|---:|---|---|---|
| 1. Playwright-MCP bedarfsweise aktivieren; Posten 366,80 Mac | 250–330 Mac RSS, wenn 70–90 % der gemessenen Instanzen entfallen | klein bis mittel; explizites Profil pro Harness und Browser-Aufgabe | Browser-Fähigkeit fehlt bei falscher Auswahl; automatische Wiederstarts vermeiden | Owner bei globalen Claude-/Codex-Plugin-Settings; Maintainer setzt freigegebenes Profil um |
| 2. Gleichzeitig gehaltene Claude-Sessions am Mac begrenzen; Posten 1359,27 in s-Slots | 310–580 Mac RSS bei zwei weniger gleichzeitig gehaltenen Sessions, aus 154–289 je Prozess | klein organisatorisch, mittel für verlässlichen Abschluss-/Resume-Pfad | weniger Parallelität; ohne geprüfte Übergabe Kontextverlust | Owner für Kapazitätsregel; MAIN für regulären Abschluss innerhalb seiner Autorität |
| 3. Suite-Parallelität auf Second-host budgetieren; Posten 945,43 | etwa 315 RSS je vermiedener gleichzeitiger Suite; zwei statt drei: etwa 315 | klein im Betrieb, mittel für gemeinsame Zulassung | längere Verify-Wartezeit; fremde Instanz darf den Deckel nicht umgehen | Owner für hostweiten Deckel; Maintainer für Scheduler |
| 4. Eigene Claude-Sessions der zweiten Instanz begrenzen; Posten 1421,05 Second-host | 303–402 Second-host RSS je weniger gleichzeitig gehaltener Session; PSS 269–323 | klein organisatorisch | Durchsatz sinkt; bloßes Verschieben vom Mac spart hostübergreifend unknown | Owner der zweiten Instanz |
| 5. Codex-/Node-Sitzungsbäume nach regulärem Abschluss freigeben; Posten 334,9 in Mac-s-Slots | 38–158 Mac RSS für einen abgeschlossenen belegten Baum; ohne dessen MCP | mittel; Zugehörigkeit und laufende Arbeit vor Abschluss beweisen | Node enthält weitere Dienste; pauschales Beenden kann Werkzeuge zerstören | MAIN für eigene abgeschlossene Session; Owner für globale Lifecycle-Regeln |

Szenarien 1 und 2 betreffen verschiedene Prozessklassen: zusammen etwa **560–910 MiB Mac-RSS**;
die reale physische Entlastung bleibt wegen Sharing, Kompression und Nachbelegung unknown.
Die Größenordnung rechtfertigt zuerst einen freigegebenen MCP-Pilot mit Vorher-/Nachher-PSS bzw.
Footprint, Tool-Canary und unveränderter Aufgabe. Laufende Sessions bleiben bis zu ihrem regulären Ende erhalten.

**Schnittlinie:** Zuerst Hebel 1 und reguläre Session-Abschlüsse aus 2/5; parallel den Suite-Deckel aus 3
mit dem Owner festlegen. Hebel 4 gehört zur Kapazitätsentscheidung der zweiten Instanz.
Unterhalb der Linie: tmux-History, Server-Puffer und Harness-Wechsel als Sparmaßnahme.
Mac-History misst insgesamt nur 7,418 MiB, bei höchstens 2091 belegten History-Zeilen pro Pane;
50.000 → 10.000 würde im Snapshot keine Zeile entfernen. Auf Linux tragen die drei Fixture-Panes
mit rund 30.952 Zeilen jeweils rund 3,109 MiB; ein linearer Schnitt auf 10.000 ergäbe nur etwa 6 MiB.
Allocator-Effekte sind dabei ungeprüft. Das rechtfertigt keinen Eingriff in Beweis-History vor dem MCP-Pilot.

## Je Slot: RSS inklusive Nachkommen, eigene Agenten und MCP

Alle Zahlen: `python3 /tmp/fleet-ram-probe.py` → SLOTS. „Rest“ enthält Shells und übrige Dienste.
PPID-Zuordnung belegt Zugehörigkeit zum Pane-Baum, keine aktive Benutzung. Reparentete Prozesse landen
unter outside. Anonyme `aux`-Namen ersetzen fremde Session-Namen. Linux-t-Nummern unterscheiden tmux-Sockets
nur innerhalb dieses Snapshots; t4 ist die Instanz mit echten Agenten, t0/t1/t2 tragen Fixture-Panes.

| Host / Slot | RSS gesamt | Claude oder Codex+Node | MCP | History MiB |
|---|---:|---:|---:|---:|
| Mac / aux660 | 2.69 | 0.00 | 0.00 | 0.079 |
| Mac / aux702 | 13.8 | 0.00 | 0.00 | 0.001 |
| Mac / aux901 | 215.25 | 213.59 | 0.00 | 0.067 |
| Mac / outside | 2176.38 | 121.51 | 0.00 | — |
| Mac / s1 | 240.14 | 202.59 | 36.48 | 0.953 |
| Mac / s10 | 61.48 | 45.09 | 15.78 | 0.891 |
| Mac / s11 | 64.5 | 38.03 | 25.94 | 0.615 |
| Mac / s14 | 188.12 | 156.59 | 30.48 | 0.611 |
| Mac / s15 | 160.53 | 156.23 | 3.69 | 1.28 |
| Mac / s16 | 105.27 | 55.23 | 49.41 | 0.78 |
| Mac / s2 | 43.02 | 38.34 | 4.05 | 0.259 |
| Mac / s3 | 230.52 | 158.20 | 50.03 | 0.186 |
| Mac / s4 | 234.62 | 193.06 | 40.50 | 0.376 |
| Mac / s6 | 184.14 | 153.78 | 29.33 | 0.369 |
| Mac / s7 | 346.19 | 289.08 | 50.59 | 0.148 |
| Mac / s9 | 244.11 | 207.92 | 30.52 | 0.802 |
| Mac / server | 195.02 | 0.00 | 0.00 | 0.001 |
| Second-host / outside | 1395.29 | 0.00 | 0.00 | — |
| Second-host / t4:aux22 | 19.68 | 0.00 | 0.00 | 0.001 |
| Second-host / t4:aux40 | 51.39 | 0.00 | 0.00 | 0.001 |
| Second-host / t4:s15 | 305.87 | 302.54 | 0.00 | 0.054 |
| Second-host / t4:s6 | 405.17 | 401.88 | 0.00 | 0.04 |
| Second-host / t4:s7 | 351.54 | 348.39 | 0.00 | 0.087 |
| Second-host / t4:s8 | 371.5 | 368.24 | 0.00 | 0.046 |
| Second-host / t4:server | 85.19 | 0.00 | 0.00 | 0.001 |

Linux-Fixtures je Slot (gleicher Befehl, RSS; Rest = Shell/Stand-in):
- t0: s1 5.93, s2 5.84, s3 5.83, s4 5.85, s5 4.67, server 60.19 MiB.
- t1: s1 5.88, s10 19.2, s11 19.25, s12 6.02, s13 5.95, s14 5.94, s15 6.05, s2 5.94, s3 5.88, s4 19.24, s5 5.94, s6 19.1, s7 5.97, s8 19.24, s9 5.85, server 75.82 MiB.
- t2: s1 5.89, s2 5.86, s3 5.9, s4 5.85, s5 5.86, s6 5.87, s7 6.02, server 73.95 MiB.

Linux-PSS je echter Session: t4:s15 300,04; s6 322,88; s7 269,48; s8 289,38 MiB;
VmSwap jeweils 0. Befehl: `python3 /tmp/fleet-ram-probe.py` → DETAIL.

## Kompression und Server-Puffer

`vmmap -summary PID` wurde intern gelesen; ausgegeben wurden ausschließlich Physical-footprint- und
TOTAL-Zeilen (erste TOTAL-Tabelle). Deren Spalte SWAPPED wird separat wiedergegeben; sie ist keine
Messung physischer Kompressor-Bytes pro PID und keine mit RSS addierbare RAM-Ersparnis.

| Mac-Prozess | PID | Physical footprint MiB | SWAPPED MiB |
|---|---:|---:|---:|
| s1 Claude | 91288 | 328,6 | 208,0 |
| s4 Claude | 17644 | 249,9 | 146,2 |
| s6 Claude | 97127 | 247,4 | 142,6 |
| s7 Claude | 52938 | 263,2 | 102,2 |
| s9 Claude | 82031 | 282,0 | 143,5 |
| s14 Claude | 76817 | 294,1 | 238,0 |
| s15 Claude | 80095 | 339,0 | 220,2 |
| aux901 Claude | 59749 | 191,0 | 77,1 |
| Fleet-Server | 12424 | 210,5 | 127,2 |

Je Zeile exakt: `vmmap -summary PID 2>/dev/null | awk '/^Physical footprint:|^TOTAL /'` mit der PID der Zeile.
PID vor Wiederholung gegen frischen Prozesssnapshot prüfen. Für MCP/Codex wurde vmmap nicht erhoben;
deren individuelle Kompression bleibt unknown. Die zweite TOTAL-Tabelle beschreibt MALLOC-Zonen.
Ein erster vmmap-Aufruf auf die inzwischen beendete s5-PID lieferte exit 255 und wurde nicht als Messung verwendet.

Die Slot-Abstraktion soll existieren: Sie ordnet einen isolierten Arbeitsprozess einer wiederaufnehmbaren
Sitzung zu. Geprüft wurden Startpfad und ausgewählte Puffer, kein vollständiges Heap-Profil:
- `server.ts:224–239`: agentCmd ergänzt Session, Modell, Effort und prompt-suggestions; hier fehlt ein MCP-Profil.
  `BASE_CMD` kommt aus FLEET_CMD (`server.ts:211`), daher ist die konkrete Laufzeitkonfiguration zusätzlich relevant.
- Lokales `~/.claude/settings.json`: Playwright aktiviert; keine mcpServers-Schlüssel in dieser Datei.
  Gelesene Playwright-Plugin-Manifeste in Claude- und Codex-Cache nennen `npx` mit `@playwright/mcp@latest`.
  Das erklärt den möglichen npm/Node-Unterbau; Prozesse unter beiden Harnesses sind gemessen.
  **Welche Konfigurationsschicht jede Instanz tatsächlich startete, bleibt unknown.**
- `docs/harness-adapter.md:75–84` erklärt Tool-Scoping; `server.ts:12105–12108` nutzt strict-mcp-config
  für Text-Helfer. Ein pauschales setting-sources-Leeren kann andere Owner-Regeln entfernen.
  Deshalb Pilot je Harness; Codex- und Claude-Plugin-Auswahl benötigen eigene Umsetzung und Tool-Canary.
- `src/client.ts:443–451`: 10.000 Zeilen gehören zum Browser-xterm. Board-Tabs liegen außerhalb dieses Auftrags.
  `server.ts:143–149`: Reconnect-Seed 3000 Zeilen. `server.ts:4802`: tmux-History-Limit 50.000.
- `server.ts:11861–11903`: Harvest liest den Zuwachs, behält eine kopierte Restzeile; die Größe eines
  Zuwachses und einer unvollständigen Zeile ist dort unbeschränkt. `server.ts:11966–11980` liest für
  transcriptTail die ganze Datei vor dem Schnitt auf 300 Zeilen. Möglich sind temporäre Spitzen;
  deren Höhe und Anteil am Server-Footprint sind **unknown**. Keine belegte dauerhafte Transkript-Leckbehauptung.

## Reproduzierbare Prozessmessung

Folgenden Block außerhalb des Repos als `/tmp/fleet-ram-probe.py` speichern, dann auf jedem Host
`python3 /tmp/fleet-ram-probe.py` ausführen; remote alternativ `ssh "$RAM_SSH_TARGET" python3 - < /tmp/fleet-ram-probe.py`.
RAM_SSH_TARGET wird lokal gesetzt und gehört nicht ins Repo. Ausgabe enthält ausschließlich Kategorien,
anonymisierte Pane-Bezeichner, PIDs und Zahlen. Kommandozeilen werden nur intern klassifiziert.
Mac-Swap/PSS-Nullen der CATEGORIES-Ausgabe sind technisch leere Akkumulatoren und bedeuten **unknown**;
Linux-Summen für other sind Teilabdeckung (PssReadableCount). DETAILS verwendet dafür None.
Die Sonde überspringt unzugängliche tmux-Sockets; unsichtbare Panes sind unknown. Mehrere Panes
mit demselben Session-Namen würden History überschreiben; die gemessenen erfolgreichen Socket-Listen
hatten je Session eine Pane. Wiederholungen mit mehreren Panes benötigen zusätzlich pane_id als Schlüssel.

```python
import subprocess as s, platform, pathlib, re, collections, json, datetime
mac=platform.system()=='Darwin'
def run(a):
    p=s.run(a,text=True,capture_output=True); return p.stdout if p.returncode==0 else ''
# Kommandozeilen nur intern klassifizieren; niemals ausgeben oder speichern.
rows={}
for line in run(['ps','-axo','pid=,ppid=,rss=,comm=']).splitlines():
    a=line.split(None,3)
    if len(a)==4: rows[int(a[0])]={'ppid':int(a[1]),'rss':int(a[2]),'comm':a[3]}
args={}
for line in run(['ps','-axo','pid=,args=']).splitlines():
    a=line.split(None,1)
    if len(a)==2: args[int(a[0])]=a[1]
sockets=[None] if mac else list(pathlib.Path('/tmp').glob('tmux-*/*'))
panes={}; histories={}
for si,sock in enumerate(sockets):
    cmd=['tmux']+(['-S',str(sock)] if sock else [])
    for line in run(cmd+['list-panes','-a','-F','#{session_name}|#{pane_id}|#{pane_pid}|#{history_size}|#{history_bytes}']).splitlines():
        name,pane,pid,lines,b=line.split('|')
        label=name if re.fullmatch(r's\d+',name) else ('server' if name=='srv' else 'aux'+pane.replace('%',''))
        label=('t'+str(si)+':'+label) if not mac else label
        panes[int(pid)]=label; histories[label]=(int(lines),int(b))
def category(pid):
    r=rows[pid]; c=pathlib.Path(r['comm']).name; a=args.get(pid,'')
    if any(k in r['comm'] for k in ['node','npm','npx']) and ('@playwright/mcp' in a or 'playwright-mcp' in a): return 'playwright-mcp'
    if 'openclaw' in c: return 'openclaw'
    if c=='bun' and re.search(r'\bserver\.ts\b',a): return 'bun-server'
    if c=='bun' and ('e2e' in a): return 'bun-e2e'
    for k in ['claude','codex','bun','node','npm','npx','tmux']:
        if c.startswith(k) or r['comm'].startswith(k): return k
    return 'other'
def owner(pid):
    seen=set()
    while pid in rows and pid not in seen:
        if pid in panes: return panes[pid]
        seen.add(pid); pid=rows[pid]['ppid']
    return 'outside'
agg=collections.defaultdict(lambda:[0,0,0,0,0]); slots=collections.defaultdict(lambda:collections.defaultdict(int)); details=[]
for pid,r in rows.items():
    cat=category(pid); slot=owner(pid); swap=pss=None
    if not mac:
        try:
            st=pathlib.Path('/proc',str(pid),'status').read_text(); m=re.search(r'^VmSwap:\s+(\d+)',st,re.M); swap=int(m[1]) if m else None
            sm=pathlib.Path('/proc',str(pid),'smaps_rollup').read_text(); m=re.search(r'^Pss:\s+(\d+)',sm,re.M); pss=int(m[1]) if m else None
        except (OSError,PermissionError): pass
    v=agg[cat]; v[0]+=1; v[1]+=r['rss']; v[2]+=swap or 0; v[3]+=pss or 0; v[4]+=pss is not None
    slots[slot][cat]+=r['rss']
    if cat in ['claude','bun-server','bun-e2e','tmux']: details.append([pid,slot,cat,round(r['rss']/1024,2),None if swap is None else round(swap/1024,2),None if pss is None else round(pss/1024,2)])
print('UTC',datetime.datetime.now(datetime.timezone.utc).isoformat())
print('CATEGORIES count RSS_MiB SwapKnown_MiB PssKnown_MiB PssReadableCount')
for k,v in sorted(agg.items(),key=lambda x:-x[1][1]): print(k,v[0],*[round(x/1024,2) for x in v[1:4]],v[4])
print('SLOTS RSS_MiB by_category history_lines history_MiB')
for k,v in sorted(slots.items()): print(k,round(sum(v.values())/1024,2),json.dumps({c:round(n/1024,2) for c,n in v.items()}),histories.get(k,(None,None))[0],round(histories[k][1]/1048576,3) if k in histories else None)
print('DETAIL pid slot category RSS_MiB Swap_MiB PSS_MiB')
for d in details: print(*d)
```

Nicht geprüft: die Brief-Basisrate „4 von 182 Lanes nutzten Playwright“, vollständige Plugin-Startkette,
CPU-/Latenzwirkung, Peak-RAM einer kompletten Suite und RAM-Gewinn durch Modell-/Harness-Wechsel.
Die settings-Datei wurde nur auf enabledPlugins und mcpServers-Namen gelesen. Keine Settings-, Host-
oder Session-Änderung; Vorschläge brauchen die oben genannte Entscheidung.

Verifikation dieser Dokumentationsänderung: `bun install --frozen-lockfile` exit 0
(`9 packages installed [55.00ms]`); `bun e2e/pins.ts` exit 0, Schlusszeile **ALL PASS**.
