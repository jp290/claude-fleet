---
frage: Wie kommen Slots und Sessions dieser Fleet auf den second-host — welche Option traegt am besten, gemessen an den Naehten von heute, und was ist der erste Schnitt?
urteil: B1, die Agenten-Bruecke — die Pane bleibt lokal, der Agent laeuft in einer tmux-Session auf dem second-host, erreicht per ssh. Sie behaelt EINEN Namensraum und laesst Board, sendText, capture, Streams, Watches, Reports und Succession unveraendert, weil die Pane lokal bleibt. Die Kette ist heute ohne Agent gemessen byte-treu, capture-sichtbar, abbruchfest und mit ControlMaster in 10–40 ms ansprechbar. A bleibt die Rueckfalltuer; A+, B2, C und D verlieren an benannten Stellen. Erster Schnitt ist eine Kanarie mit echtem Agenten, kein Code.
bereich: [multi-host, session-runtime, topologie, second-host, harness-adapter]
belege: [docs/dual-host-topologie-entscheidung-2026-09-05.md §1-§4, docs/messungen/2026-09-11-host-aufteilung-entscheid.md, docs/dual-host-git-transport.md §Richtungen, server/tmux.ts#tmux, server.ts#gitWith, server.ts#paneAgentAt, server.ts#ensureSlot (FLEET_SELF_URL), server.ts#CONTAINER_HARNESS]
nicht-gemessen: kein echter Agent durch die Bruecke (nur bash/head im Raw-Modus); Scrollback und Composer-Ruhefenster unter einem echten TUI; Speicherbedarf eines Agenten auf Linux; wie viele Stellen Transkript-/Rollout-Dateien lesen (nicht gezaehlt); der Mechanismus, mit dem S4 am 2026-09-06 den Folger-Branch hier landete (nur das Ergebnis ist belegt)
stand: 2026-09-15
---

# Slots und Sessions auf dem second-host — Optionen, gemessen

Orchestratorin Slot 12. Anlass, Owner 2026-09-15: „wir brauchen auch noch ne loesung wie wir die
Slots und sessions auf second-host kriegen". Das ist der Ausloeser, den der Host-Entscheid vom
2026-09-11 §0 fuer die gemeinsame Liste benannt hat („wenn es weh tut"). Die Topologie-Vorlage vom
2026-09-05 hatte B als XL bewertet, weil sie die tmux-AUFRUFSTELLEN zaehlte (41). Diese Notiz misst
die ENGSTELLEN und eine Variante, die jene Vorlage nicht hatte.

## 1. Gemessen heute

| Sensor | Methode | Wert |
|---|---|---|
| second-host Plattform | `uname`, `nproc`, `free -m` per ssh | Linux x86_64, 16 Kerne, 7 858 MB, 4 090 MB verfuegbar, Memory-PSI avg300 0,00 |
| Harnesses dort | `command -v` + `--version` | claude 2.1.269, codex-cli 0.153.4 (auth vorhanden), pi 0.85.0, node v24.20.0, bun 1.4.0, git 2.47.3; docker fehlt; kein xcodebuild |
| eigene Instanz dort | `fleet.json` gelesen | 0 Slots, 8 archiviert / 3 done |
| Helfer | `fleet.json helperDevices` | second-host maxParallelSuites 3, running 1, load 0,35; beide Audit-Shards der letzten vier Audits liefen dort |
| Last Mac | `uptime`, `hw.memsize` | 8 GB, 8 Kerne, load 2,9 |
| claude-Prozesse Mac | `ps -eo rss,comm` | 9 Prozesse, 1 572 MB (175 MB je Prozess, macOS-RSS) |
| ssh ohne Multiplex | `time ssh true` ×3 | 0,36–0,40 s |
| ssh mit ControlMaster | dasselbe ×3 | 0,02–0,14 s (erster Aufruf 0,14) |
| remote `tmux capture-pane` ueber Multiplex | ×3 | 0,01–0,03 s |
| remote Agenten-Probe (`display pane_pid` + `ps` + `pgrep`) | 1 ssh | 0,03 s |
| second-host → Mac-Board | `curl` vom second-host | HTTP 200 in 0,156 s |
| ssh auf unerreichbaren Host | Exit-Code | 255 |

**Die Bruecken-Sonde** (Sandbox-Sockets auf beiden Hosts, kein Agent, danach per `kill-server` geraeumt):
aussen eine lokale tmux-Pane mit `ssh -tt … tmux attach -t inner`, innen eine tmux-Session auf dem second-host.

1. `capture-pane` der AEUSSEREN Pane zeigt den Text der INNEREN Session (`READY-INNER`).
2. 6 274 Bytes per `paste-buffer -p` in die aeussere Pane, innen `stty raw; head -c 6274`:
   sha256 identisch zur Quelle, und identisch zur lokalen Kontrollprobe ohne ssh.
   Im KANONISCHEN Modus (`read -r` in bash) kamen 4 095 Bytes an — die Zeilengrenze des tty
   (`MAX_CANON`), nicht der Transport; claude und codex lesen im Raw-Modus.
3. Aeussere Session getoetet → innere lebt (`has-session` ja); neu angehaengt → Bildschirm wieder da.
4. Prozesskette der aeusseren Pane: `ssh`. `paneAgentAt` saehe dort nie einen Agenten — die Probe muss
   fuer solche Slots remote laufen.

Code-Naehte (`rg -c`, Stand `38f5451d`): alle tmux-Aufrufe ausser zwei `load-buffer`-Spawns laufen
durch `server/tmux.ts#tmux` bzw. `tmuxNewSession`; git laeuft durch `server.ts#gitWith` plus 8 direkte
`spawn(["git"`; `STREAM_DIR` hat 12 Verwendungen; `FLEET_SELF_URL` wird bereits aus HOST:PORT in
jede Pane gebacken (`server.ts#ensureSlot`).

## 2. Die Optionen

**A — zwei Instanzen, der Mensch foederiert (heute).** Existiert, S4 ist gelaufen. Kostet nichts.
Traegt nicht, was der Owner jetzt verlangt: Slots des second-host stehen nicht auf diesem Board, die
Queue, Programs, Reports und Watches sind getrennt, und erledigte Arbeit dort wird unsichtbar
(Host-Entscheid §7). Bleibt die Rueckfalltuer.

**A+ — Delegation ueber den Hub.** Eine MAIN hier legt Zeilen in der Instanz dort an (Owner-API per
Session/ctl), dortige Lanes committen, hier wird per Richtung R geholt und gelandet. Zwei
Namensraeume bleiben; Gate 2 (keine Reports ueber die Hostgrenze) haelt, also sieht keine MAIN hier
den Report; eine Tuer „fremden Branch landen" gibt es als Route nicht. Mittel, und das Ergebnis ist
immer noch kein Slot auf diesem Board.

**B1 — Agenten-Bruecke: Pane lokal, Agent remote.** Der Slot bekommt ein Host-Feld; sein
Pane-Kommando ist `ssh -tt <host> tmux -L <sock> new-session -A -s <slot> …`. Unveraendert bleiben,
weil die Pane lokal ist: `tmux()` und alle ihre Aufrufe, `sendText` samt Acceptance, `capture-pane`,
`pipe-pane`-Streams, WS-Terminal, Watches, Events, Reports, Succession, `slot+openedAt`. Zu bauen:
Host-Feld + Projektion · Pane-Kommando im Adapter (eine Stelle, wie `CONTAINER_HARNESS.spawnCmd`) ·
`paneAgentAt` remote (gemessen 30 ms) · git-Lesungen fuer Host-Slots durch `gitWith` und die 8
direkten Spawns · Worktree anlegen/entfernen remote · Transkript-/Rollout-Leser (ctx, transcript,
sessionId) remote · Land: Branch per R holen, lokal materialisieren, dann der unveraenderte
`mergeJob` · Repo-Bereitstellung je Host (claude-fleet folgt dort per `fleet-sync`, andere Repos
nicht) · Offline-Semantik. Die Heilung ist fast geschenkt: stirbt die ssh-Verbindung, stirbt die
lokale Pane, der bestehende Respawn fuehrt dasselbe `new-session -A` aus und haengt sich wieder an
den noch laufenden Agenten (Sonde §1.3).
Sicherheit: nutzt nur die schon vorhandene Richtung Mac → second-host; die Pane dort ruft dieselbe
self-API wie jede lokale Lane. Die Invariante „der Mac fuehrt nie Code aus, den der Linux-PC
schickt" bleibt wahr. Ruecknahme: ein Slot ohne Host-Feld ist byte-identisch zu heute.

**B2 — tmux-Routing: die Pane selbst liegt remote.** `tmux()` routet je Session per ssh, Streams
kommen per `ssh tail -F` zurueck. Nativer Scrollback, keine verschachtelte Kette. Der Preis: jede
der ~40 Stellen, die einen tmux-Exit-Code als „keine Session" liest, liest bei einem Netzausfall
eine TOTE Pane statt „unbekannt" — genau das Fehlrouting (Respawn, Neugruendung einer MAIN), das die
Vorlage vom 05.09. §1 B beschreibt. B1 hat dieses Problem nur an EINER Stelle (der Agenten-Probe).

**C — Pull-Runner im Helfer-Daemon.** Bricht den Helfer-Perimeter (`HELPER_CMD_FORBIDDEN`), braucht
ein eigenes Pane-/Stream-Protokoll, XL. Der Sicherheitsgewinn (keine Mac→Linux-Ausfuehrung) ist
klein, weil der Verwaltungs-Schluessel in dieser Richtung schon existiert. Verworfen.

**D — eine gemeinsame Queue im Code.** Erster ausgehender HTTP-Client des Servers, Program-Spiegel,
Gate 2 kippt. Groesster Umbau, und am Ende laufen die Sessions immer noch auf zwei Boards. Verworfen.

## 3. Empfehlung

**B1.** Sie beantwortet die Owner-Frage woertlich (Slots auf diesem Board, Agenten dort), haelt die
Faktschicht an genau einer neuen Stelle ehrlich statt an vierzig, und ist je Slot zuruecknehmbar.
Platzierung: iOS, Simulator und GPU-Browser-Arbeit bleiben am Mac (harte Grenze vom 2026-09-11);
alles andere ist second-host-faehig. Deckel je Host, anfangs 4 Lanes dort — ABGELEITET aus 4 GB
verfuegbar, 175 MB macOS-RSS je claude-Prozess und den Suiten, die dort ebenfalls laufen; die
Kanarie misst die echte Zahl.

**Falsifikator.** B1 faellt, wenn mit einem ECHTEN Agenten durch die Bruecke (a) ein Owner-`/send`
nicht `acceptance: observed` erreicht, weil das Composer-Ruhefenster ueber die Kette nicht haelt,
(b) ein Readiness-Marker (claude `❯`, codex `>_ OpenAI Codex (v`) in der aeusseren `capture-pane`
nicht erscheint, oder (c) ein Verbindungsabbruch waehrend eines Turns die Session verliert statt sie
per Wiederanhaengen fortzusetzen. Faellt nur der Scrollback im Board (die innere tmux zeichnet als
Vollbild), ist das ein UX-Preis, kein Falsifikator — dann ist die Variante ohne innere tmux
(`ssh -tt … exec claude` plus `--resume` beim Respawn) zu messen.

## 4. Erster Schnitt

Die Kanarie, kein Code: ein echter claude- und ein echter codex-Agent durch die Bruecke, gesteuert
aus einer Sandbox-tmux hier, gemessen: (a)–(c) oben, Remote-Probe `alive`, Transkript-/Rollout-Datei
per ssh lesbar, RSS je Agent auf Linux, Scrollback. Danach, und nur bei bestandenem Falsifikator:
Host-Feld + Spawn + Remote-Probe fuer claude, gelandet ueber R — als eigene Karte.

`f3ca2e05` war B-foermig formuliert und ist unter dem Entscheid vom 11.09. nicht zu dispatchen; diese
Notiz ist ihre Neufassung auf B1.
