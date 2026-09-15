---
frage: Traegt B1 mit echten claude- und codex-Agenten durch die verschachtelte SSH/tmux-Bruecke?
urteil: B1 steht im erlaubten Handpfad; beide Agenten nehmen Prompts an, ihre Startmarker erscheinen aussen und laufende Turns ueberleben den SSH-Abbruch. Die echte Owner-/send-Acceptance bleibt unknown; groesste beobachtete Linux-RSS inklusive Codex-Wrapper 353060 KiB.
bereich: [multi-host, session-runtime, harness-adapter, kanarie]
belege: [docs/messungen/2026-09-15-second-host-sessions-optionen.md §3, server.ts:577, server.ts:6144, server.ts:6224, server.ts:6253]
nicht-gemessen: echte Owner-/send-Quittung und paneReadiness des Servers; Dauerlast und Speicher-Peak; vier gleichzeitige Lanes mit Suiten; langer Scrollback
stand: 2026-09-15
---

# B1-Bruecke: Kanarie mit zwei echten Agenten

Gemessen am **15.09.2026**, etwa 18:58–19:03 Europe/Berlin. Der Dateiname vom 16.09.
folgt dem Auftrag. Quellbaum und frischer Klon: `6bea85a84e3d96775b2d67f62bf3b9dc6ca26355`.
Genau ein Claude-Code-Prozess (2.1.269, `claude-sonnet-5`, low) und ein Codex-Agent
(0.153.4, `gpt-5.6-sol`, low); keine Agenten-Neustarts. Claude bekam drei Turns,
Codex drei plus eine begruendete Wiederholung des Abbruchversuchs im selben Agenten.

## Aufbau und Aussagegrenze

**Erlaubter Handpfad, keine Scratch-Fleet-Instanz.** `FLEET_CMD=ssh` mit
`FLEET_HARNESS_COMMS=ssh` wuerde zwar den aeusseren Prozess anerkennen, aber der
Default-Adapter deklariert seinen Composer nur bei `IS_CLAUDE` (`server.ts:577`).
Ohne Composer liefert `sendText` `not-applicable` (`server.ts:6144`). Der Codex-Adapter
hat einen Composer, erwartet aber `codex`/`node` (`server.ts:1212`), nicht `ssh`.
Das waere ohne Codeaenderung keine Messung von `acceptance: observed`.
Darum hier `load-buffer`/`paste-buffer`/`capture-pane`, wie im Auftrag gestattet.
**Die folgenden Antwortzeiten sind keine API-Acceptance-Latenzen.** Server-Quittung,
Arrival-/Composer-Parser und `paneReadiness()` wurden nicht ausgefuehrt.

Alle SSH-Kommandos unten verwenden `$TARGET` als redigiertes, privat aufgeloestes
SSH-Ziel. `$REMOTE_HOME` und `<HOME_KEY>` ersetzen den privaten Homepfad bzw. dessen
Claude-Projektschluessel. Ausgaben sind ansonsten woertliche Ausschnitte; keine
Prozessargumente wurden aufgelistet. Die lokale SSH-Shell hatte zunaechst keinen
Agenten-PATH (`claude: command not found`); `bash -lc 'command -v claude codex'`
loeste beide auf. Die Starts verwenden deshalb explizit `~/.local/bin`.

Klon: lokal `git bundle create "$SCRATCH/repo.bundle" HEAD`, Upload nach
`~/kanarie/repo.bundle`, remote:

```sh
git clone -q ~/kanarie/repo.bundle ~/kanarie/repo
git -C ~/kanarie/repo worktree add -q --detach ~/kanarie/claude HEAD
git -C ~/kanarie/repo worktree add -q --detach ~/kanarie/codex HEAD
```

Vorher waren `~/kanarie` und beide Kanariensockets abwesend. Innere Sessions:

```sh
ssh "$TARGET" 'tmux -L fleetkanarie new-session -d -s claude -x 140 -y 45 '\''export PATH="$HOME/.local/bin:$PATH"; cd ~/kanarie/claude; exec ~/.local/bin/claude --model claude-sonnet-5 --effort low --permission-mode acceptEdits --allowedTools "Bash(sleep *)"'\'''
ssh "$TARGET" 'tmux -L fleetkanarie new-session -d -s codex -x 140 -y 45 '\''export PATH="$HOME/.local/bin:$PATH"; cd ~/kanarie/codex; exec ~/.local/bin/codex -m gpt-5.6-sol -c model_reasoning_effort="low" -s workspace-write -a never'\'''
```

Jeweils `$AGENT=claude` bzw. `codex`, aeussere Session und spaeter identisches Wiederanhaengen:

```sh
tmux -L fleetkanarie new-session -d -s "$AGENT" -x 140 -y 45 \
  "ssh -o BatchMode=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=2 -tt $TARGET tmux -L fleetkanarie attach-session -t $AGENT"
```

Beide Vertrauensdialoge fuer den eigenen frischen Klon wurden bestaetigt. Kein
Update-Kommando wurde ausgeloest. Claude zeigte spaeter dennoch woertlich
`✔ Update installed · Restart to update`; sein automatischer Updater ist eine
beobachtete Nebenwirkung, deren Installationsaenderungen hier nicht untersucht wurden.
Die Live-Instanz und ihr Socket wurden nicht angesprochen.

## (1) Owner-/send → Acceptance: beide Agenten

Je Turn 1 und 2, `$TEXT` wie unten; 150 ms zwischen Paste und Enter,
anschliessend Capture alle 250 ms, Ende bei eigenstaendiger Antwortzeile, Deadline 90 s.
Die Stoppuhr (`time.monotonic()`) begann vor `load-buffer`.

```sh
printf '%s' "$TEXT" | tmux -L fleetkanarie load-buffer -b b1 -
tmux -L fleetkanarie paste-buffer -p -b b1 -t "$AGENT"
sleep 0.15
tmux -L fleetkanarie capture-pane -p -t "$AGENT" -S -
tmux -L fleetkanarie send-keys -t "$AGENT" Enter
tmux -L fleetkanarie capture-pane -p -t "$AGENT" -S -
```

Prompt, mit `CLAUDE`/`CODEX` und `1`/`2` eingesetzt:

> Bounded terminal transport measurement, no repository work. Do not read files, do not use tools, do not delegate. Reply with exactly B1_CLAUDE_TURN_1_OK and nothing else.

Sondenquittungen (je Turn auf eine Zeile zusammengezogen) und woertliche Antwortzeilen:

```text
claude / Turn 1: load 0; paste 0; enter 0; response_ms 3098
● B1_CLAUDE_TURN_1_OK
claude / Turn 2: load 0; paste 0; enter 0; response_ms 2591
● B1_CLAUDE_TURN_2_OK
codex / Turn 1: load 0; paste 0; enter 0; response_ms 6276
• B1_CODEX_TURN_1_OK
codex / Turn 2: load 0; paste 0; enter 0; response_ms 4690
• B1_CODEX_TURN_2_OK
```

Claude zeigte vor Enter den vollstaendigen Prompt im Composer, danach `❯` ohne
Payload. Codex zeigte nach der Antwort wieder `› Ask Codex to do anything`.
Die eigenstaendigen Antworten sind zudem in den Transkripten belegt (4), also kein
blosses Prompt-Echo. **Annahme im Handpfad beobachtet; echte `/send`-Acceptance unknown.**
Weder ein gemessenes Server-Ruhefenster noch eine `acceptance: observed`-JSON-Quittung
wird daraus behauptet. Die vier Zeitwerte enthalten auch die Modellantwortzeit.

## (2) Readiness-Marker in der aeusseren Pane

Kommando jeweils `tmux -L fleetkanarie capture-pane -p -t "$AGENT" -S -`.
Startmessung ab vor dem remote `new-session`, Raster 250 ms bis zur ersten Start-/Dialoganzeige.

**Claude:** bei 721 ms zunaechst der Vertrauensdialog mit `❯ No, exit` — dieser Pfeil
ist **kein** fertiger Composer. Nach Bestaetigung belegt die naechste gezielte
Aufnahme bei **14754 ms** folgenden fertigen Bildschirm. Das ist eine obere Schranke,
kein millisekundengenauer erster Ready-Zeitpunkt; die Dialogbedienung liegt darin.

```text
 ▐▛███▛█   Claude Code v2.1.269
▝▜██████▀  Sonnet 5 with low effort · Claude Max
❯ Try "edit <filepath> to..."
```

**Codex:** der verlangte Header erschien bei **763 ms**:

```text
│ >_ OpenAI Codex (v0.153.4)            │
│ model:     loading   /model to change │
│ directory: loading                    │
```

Bei 8857 ms zeigte ein weiterer Capture den Vertrauensdialog; dieser wurde danach
bestaetigt. Der Header allein bewies also beim Start noch keine Eingabebereitschaft.
Vor den erfolgreichen Turns zeigte das TUI:

```text
│ model:     gpt-5.6-sol low   /model to change │
› Ask Codex to do anything
```

Der fertige Ready-Zeitpunkt nach Codex-Trust wurde nicht separat gestoppt. Beide
verlangten Startmarker kamen aussen an. Die Block-Erkennung des echten Servers
(`server.ts:6253`, Codex-Regeln `server.ts:1220`) bleibt ungeprueft.

## (3) Remote-Probe: pane_pid → comm

Je Agent ueber SSH, ausschliesslich PID/PPID/comm/RSS:

```sh
p=$(tmux -L fleetkanarie display-message -p -t "$AGENT" '#{pane_pid}')
ps -p "$p" -o pid=,ppid=,comm=,rss=
for k in $(pgrep -P "$p"); do ps -p "$k" -o pid=,ppid=,comm=,rss=; done
```

Ausgabe einer Aufnahme nach den ersten beiden Antworten:

```text
claude pane_pid=2798369
2798369 2798362 claude          305836
codex pane_pid=2798694
2798694 2798362 MainThread      51284
child 2798704 2798694 codex           301776
```

Claude ist selbst der Pane-Prozess. Bei Codex muss die Probe dessen direktes Kind
ansehen; `MainThread` allein identifiziert keinen Codex-Agenten. Die aeusseren
Pane-PIDs lieferten jeweils `ssh` (im Abbruchversuch erneut vor dem Kill geprueft).

## (4) Transkript/Rollout per SSH lesbar

Per `ssh "$TARGET" python3 -` wurden `Path.read_text().splitlines()` und
`json.loads()` auf genau die Kanarien-Dateien angewandt. Die Claude-Datei wurde ueber
`~/.claude/projects/*kanarie*/*.jsonl`, der Codex-Rollout ueber den Dateisuffix der
Session gefunden; andere Inhalte wurden nicht ausgegeben. Wiederholbare Byte-/Lesesonde:

```sh
ssh "$TARGET" 'wc -c "$HOME/.claude/projects/<HOME_KEY>-kanarie-claude/2079efd8-747b-4124-83dd-f7604b0ec202.jsonl"'
ssh "$TARGET" 'wc -c "$HOME/.codex/sessions/2026/09/15/rollout-2026-09-15T18-58-37-01a0a601-9896-7500-b481-2b450ff2e014.jsonl"'
```

Woertliche Parserausgabe nach Turn 3, vor Codex-Wiederholung:

```text
file=$REMOTE_HOME/.claude/projects/<HOME_KEY>-kanarie-claude/2079efd8-747b-4124-83dd-f7604b0ec202.jsonl
readable=yes bytes=277488 lines=44
model=claude-sonnet-5
assistant=B1_CLAUDE_TURN_1_OK
assistant=B1_CLAUDE_TURN_2_OK
assistant=B1_CLAUDE_TURN_3_OK
file=$REMOTE_HOME/.codex/sessions/2026/09/15/rollout-2026-09-15T18-58-37-01a0a601-9896-7500-b481-2b450ff2e014.jsonl
readable=yes bytes=124186 lines=42
model=gpt-5.6-sol effort=low
assistant=B1_CODEX_TURN_1_OK
assistant=B1_CODEX_TURN_2_OK
assistant=B1_CODEX_TURN_3_OK
```

Wiederholte Modellzeilen und Codex' Vorankuendigung wurden hier ausgelassen. Die
Dateigroessen sind Momentaufnahmen. Lokale Fleet-Transkriptleser wurden nicht getestet.

## (5) SSH-Abbruch im laufenden Turn und Wiederanhaengen

Prompt fuer Turn 3, jeweils mit `CLAUDE`/`CODEX`:

> Transport canary turn 3. Run exactly one shell command: sleep 15. No other tool, no files, no delegation. When it finishes reply exactly B1_CLAUDE_TURN_3_OK.

Der Abbruch traf ausschliesslich die eigene aeussere SSH-PID. Entsprechende Kommandos
(die Sonde verwendete `os.kill(int(pid), signal.SIGTERM)` nach dem comm-Vergleich):

```sh
p=$(tmux -L fleetkanarie display-message -p -t "$AGENT" '#{pane_pid}')
ps -p "$p" -o comm=
kill -TERM "$p"  # nur nach geprueftem comm=ssh
ssh "$TARGET" "tmux -L fleetkanarie has-session -t $AGENT"
# danach identisches aeusseres new-session/attach-session aus dem Aufbau
```

**Claude:** der laufende `sleep` wurde ueber `/proc/<pid>/task/<pid>/children`
rekursiv vom Pane-Prozess aus gefunden (Raster 500 ms, Deadline 75 s). Abbruch nach
2762 ms seit Promptstart. Auszug der Sondenfelder (Prozesslisten verdichtet):

```text
killed_ssh_pid: 59033
killed_comm: ssh
remote_has_session_exit: 0
before: pid=2798369 comm=claude; pid=2810377 comm=bash; pid=2810379 comm=sleep
during_disconnected: pid=2798369 comm=claude; pid=2810377 comm=bash; pid=2810379 comm=sleep
reattach (0, '', '')
completion_after_disconnect_ms: 16762
● B1_CLAUDE_TURN_3_OK
```

**Codex, erster Versuch:** die gleiche Nachfahren-Sonde lief mit
`no_running_sleep` aus. Der Rollout bewies dennoch `sleep 15` mit Exit 0 und
`B1_CODEX_TURN_3_OK`. Es erfolgte **kein Abbruch**: fehlende Messabdeckung dieser
Sonde, kein Sessionverlust. Wo der Tool-Prozess relativ zum TUI laeuft, wurde nicht
weiter untersucht. Scrollback (7) wurde jetzt, nach genau drei Turns, gesichert.

**Codex, Wiederholung im selben Agenten:**

> Repeat only the interrupted-transport measurement: run exactly sleep 15 once, no other tools, no files, no delegation. Then reply exactly B1_CODEX_REATTACH_OK.

Ausloeser war diesmal im per SSH gelesenen Rollout der letzte `task_started`-Abschnitt
mit einem `custom_tool_call` fuer `sleep 15`, noch ohne `custom_tool_call_output`
(Raster 250 ms, Deadline 40 s). Nach 6149 ms seit Promptstart wurde SSH getrennt.
Dieselbe `call_id` verband vor und nach dem Abbruch:

```text
2026-09-15T17:01:59.158Z custom_tool_call call_QYDz3dioUSe8uc5a8RjUch29
killed_ssh_pid: 59797
killed_comm: ssh
has_session_exit=0
2798694 2798362 MainThread      51284
2798704 2798694 codex           256440
reattach (0, '', '')
2026-09-15T17:02:14.241Z custom_tool_call_output call_QYDz3dioUSe8uc5a8RjUch29
completion_after_disconnect_ms: 17745
• B1_CODEX_REATTACH_OK
```

Beide Agenten liefen mit denselben PIDs weiter. Gemessen wurde SSH-Prozessabbruch
mit sofortigem Wiederanhaengen, kein laengerer Netz-Blackout oder Hostneustart.

## (6) Linux-RSS und Grundlage fuer den Host-Deckel

Kommando je Agent: `ps -p "$p" -o pid=,ppid=,comm=,rss=` wie (3), waehrend des
Abbruchs zusaetzlich `VmRSS` aus `/proc/<pid>/status`. Linux-Werte in KiB:

| Aufnahme | Claude-Agent | Codex-Agent | Codex-Wrapper |
|---|---:|---:|---:|
| Nach den ersten beiden Antworten, Ausgabe (3) | 305836 | 301776 | 51284 |
| Spaetere Dateilesesonde (4) | 301052 | 255440 | 51284 |
| Laufender Abbruchversuch, vor bzw. beim Trennen | 297732 | 256440 | 51284 |

Groesster **beobachteter Einzelwert**, kein kontinuierlich gemessener Peak:
Claude 298,7 MiB; Codex inklusive Wrapper **353060 KiB = 344,8 MiB**.
Vier solcher kurzen Codex-Lanes waeren etwa 1,35 GiB fuer Agent+Wrapper allein.
Die gleichzeitige `/proc/meminfo`-Aufnahme der Dateilesesonde lautete:

```text
MemTotal:        8047384 kB
MemAvailable:    3881072 kB
```

Damit bleibt **vier Lanes als vorsichtiger Anfangsdeckel plausibel**, nun auf etwa
345 MiB statt der aus macOS uebertragenen 175 MB begruendet. Das ist eine Ableitung,
keine Kapazitaetsfreigabe: Compiler, Tools, tmux, sonstige Dienste und parallel
laufende Suiten sind nicht in dieser Prozess-RSS enthalten; lange Kontexte ebenfalls
nicht. Ein erhoehtes oder garantiert belastbares Parallelitaetslimit ist nicht gemessen.

## (7) Aeusserer Scrollback nach drei Turns

Kommando je Agent: `tmux -L fleetkanarie capture-pane -p -t "$AGENT" -S -`;
Zeilenzahl in der Sonde mit `len(capture.splitlines())`, aequivalent zu `wc -l`
fuer diese mit Newline abgeschlossenen Captures:

```text
claude: outer_lines=45
codex: codex_outer_lines_after_three=45
```

Jeweils einschliesslich Leerzeilen und tmux-Statuszeile, bei Pane-Hoehe 45.
Claude nach Wiederanhaengen im dritten Turn, Codex vor dem Wiederholungsversuch.
Die drei Antwortmarker waren jeweils noch im Capture vorhanden. Nach dem letzten
Wiederanhaengen zeigte `display-message -p '#{history_size} #{alternate_on}'`
bei beiden woertlich `0 1`. Das ist keine Langzeit-Scrollback-Garantie: die aeussere
Pane sieht den Vollbildschirm der inneren tmux; alte lokale History geht beim
Wiederanhaengen verloren. Laut Optionen-Notiz §3 ist Scrollback allein kein Fallkriterium.

## Aufraeumen und Nachweis

Vor dem Entfernen lief auf beiden remote Worktrees `git status --porcelain` ohne
Ausgabe. Ausgefuehrt wurde **nur**:

```sh
ssh "$TARGET" 'tmux -L fleetkanarie kill-server'
ssh "$TARGET" 'tmux -L fleetkanarie has-session >/dev/null 2>&1; printf "remote_has_session_exit=%s\n" "$?"'
ssh "$TARGET" 'rm -rf -- ~/kanarie; test ! -e ~/kanarie; printf "remote_kanarie_absent_exit=%s\n" "$?"'
tmux -L fleetkanarie kill-server
tmux -L fleetkanarie has-session >/dev/null 2>&1
printf 'local_has_session_exit=%s\n' "$?"
```

```text
remote_has_session_exit=1
remote_kanarie_absent_exit=0
local_has_session_exit=1
```

Lokal war nach dem Ende der SSH-Clients bereits kein tmux-Server mehr vorhanden;
`kill-server` meldete entsprechend `no server running`. Remote war Claude unmittelbar
nach `kill-server` noch kurz sichtbar; die anschliessende begrenzte `/proc`-Endesonde
(200-ms-Raster, hoechstens 10 s) belegte:

```text
own_claude_pid_absent=True
own_pid_2798694_absent=True
own_pid_2798704_absent=True
```

Also: `has-session` auf `fleetkanarie` auf **beiden Hosts nein**, `~/kanarie` fehlt,
alle drei verfolgten Agent-/Wrapper-PIDs beendet. Es gab keine Scratch-Fleet-Instanz
zu beenden. Lokale Messdateien bleiben ausserhalb des Repos; die beiden beschriebenen
Transkripte liegen in den normalen Agenten-Verzeichnissen.

## Dokument-Verifikation

`bun install --frozen-lockfile && bun e2e/pins.ts` bestand. Der woertliche
Suite-Tail lautet:

```text
ALL PASS
```

`git diff --cached --check` war ohne Ausgabe; die Notiz enthaelt alle sieben
Messpunkte, keine privaten Zieladressen und dasselbe Urteil wie ihre Index-Zeile.

## Urteil nach Optionen-Notiz §3

- **(a)** Im erlaubten Handpfad kein Verlust: beide Agenten antworten auf die
  transportierten Prompts. Der genaue Server-Falsifikator `acceptance: observed`
  bleibt **unknown**, weil die API nicht vermessen wurde; ein Composer-Ruhefenster
  des echten Servers ist damit weder bestaetigt noch widerlegt.
- **(b)** Beide verlangten Startmarker erscheinen aussen. Trust und Loading muessen
  trotzdem getrennt von Bereitschaft behandelt werden.
- **(c)** Beide laufenden Turns ueberleben das Trennen des SSH-Clients und laufen
  nach dem Wiederanhaengen weiter; kein neuer Agent wurde dafuer gestartet.

Die Kanarie stuetzt B1 als Transportoption, mit ausdruecklich offener Server-Acceptance.
Das Urteil gilt fuer den erlaubten Handpfad und ist keine Implementierungs- oder
Landefreigabe. Ein Fall an (a), (b) oder (c) wurde hier nicht beobachtet.

B1 steht
