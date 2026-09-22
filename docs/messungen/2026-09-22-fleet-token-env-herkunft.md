---
frage: Warum tragen Prozesse auf dieser Maschine FLEET_TOKEN im Env, woher kommt er, und ist es der aktuelle Owner-Token?
urteil: Kein Prozess traegt den aktuellen Owner-Token. Die 9 Prozesse mit einer echten FLEET_TOKEN-Variable gehoeren zu drei Test- bzw. Screenshot-Instanzen (eine testinstanz.sh von heute, zwei verwaiste Screenshot-Instanzen vom 2026-09-20). Jede Instanz bekommt ihren eigenen Test-Token, und der Weg ist immer derselbe: Startzeile mit FLEET_TOKEN=, dann bun server.ts, dann der tmux-Server, den dieser bun startet und der sein Env in die globale Umgebung uebernimmt, dann jede Pane darunter (darum auch pi-agent und codex-agent). Der Live-srv und der claudefleet-tmux tragen keinen, weil der Owner-Token in fleet.json liegt und .env keine FLEET_TOKEN-Zeile hat. Der Zaun sieht hier also ein Symptom von Testinstanzen. Die Quelle waere ein env -u beim tmux-Spawn in server.ts, und brauchen tut die Variable nur der srv beim Boot.
bereich: [sicherheit, prozess-env, testinstanz]
belege: [server.ts#TOKEN, testinstanz.sh#ti_serve, docs/design/sidebar/leiste-mess/instanz-shot.sh, watchdog.sh, ctl.sh#owner_token, e2e-postland-audit.sh, docs/messungen/2026-09-21-pi-zai-lesezaun.md]
nicht-gemessen: Prozesse fremder Nutzer (205 von 601 PIDs nicht lesbar), der Prozessbestand vom 2026-09-21 (19 Treffer, nicht rekonstruierbar), Second-host, die Herkunft der Instanz fleet-shots/instance (kein Skript im Repo)
stand: 2026-09-22
---

# Woher kommt FLEET_TOKEN im Env, und ist es der Owner-Token?

2026-09-22 ~11:40, Lane `fleet/260922093652-727f`. Frage: **Welche Prozesse tragen `FLEET_TOKEN`
als echte Env-Variable, woher haben sie ihn (Elternkette bis zum Erzeuger), und ist der Wert der
aktuelle Owner-Token?**

Vorlauf: `docs/messungen/2026-09-21-pi-zai-lesezaun.md` §1/T3 hat 19 Prozesse mit `FLEET_TOKEN=`
gezaehlt, aber weder die Herkunft geklaert noch den Wert verglichen (§5 „Unter der Linie").

## Ergebnis

Momentaufnahme, ein Lauf von `envscan.ts` (§Methode). Gezaehlt wurden **601 PIDs**
(`ps -axo pid=`). **396** davon liessen sich per `sysctl(KERN_PROCARGS2)` lesen, die uebrigen 205
gehoeren anderen Nutzern (root).

| Groesse | Wert | Definition |
|---|---|---|
| echte Variable `FLEET_TOKEN=` | **9 PIDs** | Env-Block am NUL-Separator zerlegt, Eintrag beginnt mit `FLEET_TOKEN=` |
| Treffer nur INNERHALB eines Werts | **0 PIDs** | Eintrag enthaelt `FLEET_TOKEN=`, heisst aber anders (Falle vom 2026-09-05) |
| Treffer in argv | 0 (Kontrolllauf: 1) | der eine Treffer im Vorlauf war die eigene zsh dieser Lane, deren Heredoc den String enthielt |
| Wert == Owner-Token (`fleet.json` `token`) | **0 von 9** | sha256-Vergleich, im Skript, nie gedruckt |
| Wert == Token von `testinstanz.sh` | 5 von 9 | Vergleich mit `/private/tmp/fleet-testinstanz-733b/.testinstanz.token` |
| Wert kuerzer als 16 Zeichen | 4 von 9 | zwei verschiedene Kurz-Tokens, je einer pro Screenshot-Instanz |
| `FLEET_TOKEN`-Zeilen in `.env` | **0** | `grep` auf Schluesselnamen, keine Werte |

### Je Prozessklasse, mit Elternkette

| Klasse | PIDs (comm) | Elternkette | Erzeuger | Token |
|---|---|---|---|---|
| A: testinstanz `733b`, gestartet 2026-09-22 11:33 | tmux `fleetti733b`, bun `server.ts` (cwd `/private/tmp/fleet-testinstanz-733b`) | beide `< launchd(1)` (daemonisiert bzw. per `( … ) &` abgehaengt) | `testinstanz.sh#ti_serve`: `env … FLEET_TOKEN="$(cat "$TOKF")" bun server.ts` | TOKF, nicht Owner |
| A': Panes darunter | `pi-agent`, 2× `codex-agent` | `zsh < tmux(fleetti733b) < launchd` | Stand-ins aus `testinstanz.sh#ti_shims`: `pi-agent`/`codex-agent` sind Symlinks auf `~/.bun/bin/bun` und laufen `setInterval`. Das sind weder pi noch codex | TOKF, nicht Owner |
| B: Screenshot-Instanz „before", gestartet 2026-09-20 12:58, verwaist | bun `server.ts` + Kind `git`, tmux `fleetshotb1` (cwd `$TMPDIR/fleet-shot-before-k62X`) | `< launchd(1)`, `git < bun < launchd` | `docs/design/sidebar/leiste-mess/instanz-shot.sh` Z. 20–21 (`FLEET_TOKEN="$TOK" bun server.ts &`); ihr Aufraeumen (Z. 60–62) ist nie gelaufen | Kurz-Token, nicht Owner |
| C: Screenshot-Instanz `fleet-shots/instance`, gestartet 2026-09-20 13:02, verwaist | bun `server.ts`, tmux `fleetshots` | `< launchd(1)` | kein Skript im Repo erzeugt diesen Pfad oder Socket (`rg -uu 'fleet-shot'` findet nur B und die Notiz vom 2026-09-20). Vermutlich ein Scratch-Skript der Leisten-Lane vom 2026-09-20 | Kurz-Token, nicht Owner |

**Kontrolle Live-Betrieb:** Der Live-srv (Listener auf 8790, `comm=bun`, Elter `tmux`) steht nicht
in der Trefferliste. `tmux -L claudefleet show-environment -g` hat 0 `FLEET_TOKEN`-Zeilen, dagegen
`fleetti733b`, `fleetshotb1` und `fleetshots` je 1. Der Unterschied liegt beim Startweg des
Servers: `server.ts#TOKEN` nimmt `process.env.FLEET_TOKEN` nur, wenn gesetzt, sonst das
persistierte `fleet.json`-Token. Der Live-srv startet ueber `watchdog.sh`, das `.env` mit `set -a`
sourct, und `.env` hat keine `FLEET_TOKEN`-Zeile.

### Der Vererbungsweg (gemessen an drei Instanzen, Mechanismus abgeleitet)

1. Ein Start-Skript setzt `FLEET_TOKEN=<test>` in der Startzeile von `bun server.ts`.
2. Der srv ruft `tmux -L <sock> …` auf, ohne das Env zu beschneiden (`server.ts` hat kein
   `env -u`, `set-environment` oder `update-environment`: `rg` leer). Der erste Aufruf startet den
   tmux-SERVER, und der uebernimmt sein Start-Env in die globale Umgebung. Gemessen: 1
   `FLEET_TOKEN`-Zeile in `show-environment -g` je Testinstanz.
3. Jede Pane erbt die globale Umgebung. Darum tragen zsh, die Stand-in-Agenten und ihre Kinder den
   Token. In der Instanz ist er ein Test-Token, aber es ist genau der Token, mit dem man diese
   Instanz als Owner bedienen kann.

### Zum Vorlauf vom 2026-09-21

Die 19 Prozesse von gestern (u. a. `node×6`, `codex×2`) laufen heute nicht mehr. Ob einer davon
den Owner-Token trug, laesst sich nicht nachtraeglich klaeren. Der heutige Lauf findet keinen, und
nach dem Weg oben kann der Owner-Token nur in ein Env kommen, wenn jemand ihn in eine Startzeile
schreibt, zum Beispiel ein von Hand gestarteter Server mit `FLEET_TOKEN=$(jq -r .token fleet.json)`.
Heute tut das kein Skript im Baum, gesucht mit `rg -n FLEET_TOKEN` ueber `*.sh`: alle Treffer sind
Test-Tokens (`acceptance-probe.sh`, `e2e-security.sh`, `testinstanz.sh`).

## Schnittlinie (nicht gebaut)

**Wer den Token braucht:** nur der srv-Prozess, und nur einmal beim Boot (`server.ts#TOKEN`).
`ctl.sh#owner_token` liest ihn zusaetzlich aus dem Env, faellt aber auf `fleet.json` zurueck. Keine
Pane braucht ihn. `e2e-postland-audit.sh` erwartet sogar ausdruecklich einen leeren geerbten Token
(Kommentar „tmux bakes its env into every pane").

Ueber der Linie, falls die Folgezeile die Quelle abstellen soll:

1. **Quelle im srv:** nach dem Lesen in `server.ts#TOKEN` `delete process.env.FLEET_TOKEN` oder
   jedem `tmux`-Spawn ein Env ohne `FLEET_TOKEN` geben. Das schliesst den Weg fuer alle Start-Skripte
   auf einmal, denn der tmux-Server wird von diesem Prozess geboren. Ein Pin waere
   `tmux -L <testsock> show-environment -g | grep -c '^FLEET_TOKEN='` = 0 in einer Suite, deren
   Instanz mit `FLEET_TOKEN=` startet.
2. **Hilfsweise** `tmux set-environment -g -u FLEET_TOKEN` direkt nach dem ersten tmux-Aufruf. Das
   ist schwaecher: Panes, die davor entstanden sind, behalten ihn.

Unter der Linie:

- Die zwei verwaisten Screenshot-Instanzen B und C (seit 2026-09-20, je bun + tmux) beenden. Diese
  Lane beendet keine Prozesse. Das waere `tmux -L fleetshotb1 kill-server` bzw.
  `tmux -L fleetshots kill-server` plus der bun ueber seine notierte PID.
- Fuer den pi-zai-Zaun heisst der Befund: der sysctl-Kanal traegt heute keinen Owner-Token, nur
  Test-Tokens, fremde `FLEET_SELF_TOKEN` und `ZAI_API_KEY` (Zaehler der Vormessung). Die
  procargs-Regel des Zauns bleibt fuer diese beiden trotzdem noetig.

## Methode

Skript `envscan.ts` im Session-Scratchpad, nicht im Baum:

- `ps -axo pid=,ppid=,comm=` liefert Pid, Elter und Programmname, keine Argumente.
- Je PID `sysctl([CTL_KERN=1, KERN_PROCARGS2=49, pid])` ueber `bun:ffi`
  (`/usr/lib/libSystem.B.dylib`), Puffer 1 MiB. Zerlegung: `argc` (int32), exec-Pfad, NUL-Padding,
  `argc` argv-Strings, danach Env-Strings bis zum ersten leeren String. Jeder String endet am
  NUL-Separator, es gibt keinen grep ueber den Klartext.
- Treffer werden dreifach getrennt: Eintrag beginnt mit `FLEET_TOKEN=` (Variable), Eintrag enthaelt
  es nur (Wert einer anderen Variable, gedruckt wird nur ihr NAME) und argv enthaelt es (nur Anzahl).
- Wert: sha256 im Skript, verglichen mit sha256 von `fleet.json`.`token` (Label `OWNER`) und von
  jeder gefundenen `.testinstanz.token` (Label `TOKF:<pfad>`). Alles andere bekommt das Label
  `SHORT<n>` (Wert < 16 Zeichen) bzw. `OTHER<n>`. Gedruckt werden nur die Labels, weder Hash noch
  Wert.
- Elternkette ueber die `ps`-Tabelle bis PID 1. Dazu cwd (`lsof -a -p <pid> -d cwd -Fn`) und,
  nur bei tmux, der Socketname hinter `-L`.
- Kontrollen: `tmux -L <sock> show-environment -g | grep -c '^FLEET_TOKEN='` je Socket (Zahl) und
  `lsof -iTCP:8790 -sTCP:LISTEN -t` fuer den Live-srv.

## Was nicht gemessen wurde

- Prozesse anderer Nutzer: 205 PIDs, `sysctl` verweigert.
- Die 19 Prozesse vom 2026-09-21: nicht mehr vorhanden, ihre Werte nicht nachtraeglich vergleichbar.
- Second-host (Linux, `/proc/<pid>/environ`).
- Wer Instanz C gestartet hat: kein Skript im Repo, nur Pfad und Startzeit.
- Der Mechanismus in Schritt 2 ist aus Symptom (tmux ppid 1, globale Variable vorhanden) und Code
  (`rg` ohne Env-Beschnitt) abgeleitet. Ein kontrollierter Start mit und ohne `FLEET_TOKEN` wurde
  nicht gefahren.
