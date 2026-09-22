---
frage: Traegt ein schmaler sandbox-exec-LESE-Zaun die Arbeitswege einer pi-zai-Lane, und lohnt er?
urteil: Ja, bauen, aber nicht als reiner Datei-Zaun. Der Owner-Token liegt nicht nur in fleet.json, sondern auch in der Prozess-Umgebung von 19 Prozessen, die jedes Programm per sysctl(KERN_PROCARGS2) liest; erst ein Paar aus sysctl-read- und process-info-Deny schliesst das (504 -> 2 lesbare PIDs). pi startet hinter dem Profil, sein Bash-Werkzeug erbt es, git commit/install/tsc/build/curl laufen. Der Preis ist gemessen: /bin/ps (setuid) laeuft unter JEDEM sandbox-exec-Profil nicht, darum stirbt bun e2e/pins.ts und jede Suite verweigert am Suite-Lock, und ctl.sh ctx braucht den Owner-Token. Kleinster Schnitt sind drei Stellen (Adapter, Profil-Pin, ps-tolerante Pin-Probe), nicht eine.
bereich: [sicherheit, harness, pi-zai]
belege: [server.ts#PI_ZAI_KEY_FILE, server.ts#PI_ZAI_AGENT_DIR, server.ts#isolatedPiContextFile, e2e-stage.sh#_st_birth_of, e2e/pins.ts#RULE_INHERIT_BIRTH, ctl.sh#owner_token, docs/attic/harness-zaun-messungen.md, f18c1ec, fc8f4ad]
nicht-gemessen: Second-host (Linux), codex- und claude-Lanes, Keychain-Geheimnisabruf (-w), eine echte Modell-Runde gegen Z.ai, Allowlist-Profil (deny default fuer Reads), vorhandene Hardlinks ausserhalb der Inventarpfade
stand: 2026-09-21
---

# Traegt ein schmaler Lese-Zaun die Arbeitswege einer pi-zai-Lane?

2026-09-21/22, Lane `fleet/260922001849-1758` (claude-opus-5, kein Z.ai-Modell). Frage: **Kann
`sandbox-exec` mit `allow default` und gezielten Read-Denies einer pi-zai-Lane die Geheimnisse der
Maschine entziehen, ohne ihr die Arbeit zu nehmen?**

Heutiger Adapter (`server.ts`, `id: "pi-zai"`): ein Shell-String
`PI_CODING_AGENT_DIR='<agent>' ZAI_API_KEY="$(cat '<key>')" pi --provider zai …`, kein Zaun.
`<agent>` = `~/.config/claude-fleet/pi-zai-agent` (`server.ts#PI_ZAI_AGENT_DIR`), `<key>` =
`~/.config/claude-fleet/secrets/zai-coding-plan.key` (`server.ts#PI_ZAI_KEY_FILE`). Alle Proben
unten: macOS 26.3.1, pi 0.85.0, bun 1.3.9, `/usr/bin/sandbox-exec`.

## Ergebnis

### 1. Inventar — was eine Lane heute lesen kann

Je Pfad nur `test -r` und `stat -f %z` bzw. Dateizahl/`du -sk`; kein Inhalt gelesen. `<main>` =
`/Users/owner/claude-fleet`. Alle Zeilen sind lesbar (`r`) aus dieser Lane:

| Pfad | Art | Groesse | traegt |
|---|---|---|---|
| `<main>/fleet.json` | Datei | 2 669 520 B | Owner-Token (erste Zeile, `ctl.sh#owner_token`) |
| `<main>/fleet.json.bak` | Datei | 2 670 048 B | Kopie davon |
| `<main>/.env` | Datei | 6 643 B | Server-Env |
| `<main>/.env.bak-20260906-0317`, `-0615` | Dateien | 3 858 / 4 087 B | alte Kopien |
| `~/.ssh` | Verz. | 6 Dateien, 332 kB | SSH-Schluessel (u. a. Second-host) |
| `~/.config/claude-fleet/secrets` | Verz. | 1 Datei (Key, 49 B) | Z.ai-Key |
| `~/.codex/auth.json` | Datei | 3 878 B | Codex-Login |
| `~/.claude/.credentials.json` | Datei | 845 B | Claude-Login |
| `~/.claude.json` | Datei | 384 557 B | Claude-Code-Konfiguration/Konto |
| `~/.config/gh/hosts.yml` | Datei | 214 B | GitHub-Token |
| `~/.cloudflared` | Verz. | 11 Dateien, 44 kB | Tunnel-Credentials |
| `~/.pi/agent/auth.json` | Datei | 2 084 B | pi-Logins (anderer Adapter) |
| `<agent>/auth.json` | Datei | 2 B | leer |
| `~/.claude/projects` | Verz. | 3 559 Dateien, 2,26 GB | Transkripte aller claude-Sessions |
| `~/.codex/sessions` | Verz. | 589 Dateien, 1,94 GB | Transkripte aller codex-Sessions |
| `~/.pi/agent/sessions` | Verz. | 76 Dateien, 55 MB | pi-Transkripte |
| `<agent>/sessions` | Verz. | 134 Dateien in 152 cwd-Slugs, 58 MB | Transkripte ALLER pi-zai-Slots |

Keychain: `security show-keychain-info` auf `login.keychain-db` exit 0, `security
find-generic-password -s "Claude Code-credentials"` (nur Attribute, ohne `-w`) exit 0 — der Eintrag
ist erreichbar; ob `-w` das Geheimnis ohne Rueckfrage liefert, ist absichtlich NICHT gemessen.

**Nicht im Dateisystem, und das ist der schwerere Befund:** der Owner-Token steht auch in
Prozess-Umgebungen. Eine `bun:ffi`-Sonde (`sysctl({CTL_KERN, KERN_PROCARGS2, pid})` ueber PID
1–99 999, Ausgabe nur Zaehler) liest ohne Zaun **504 Prozesse**; davon tragen **19** eine Variable
`FLEET_TOKEN=` mit mindestens 16 Zeichen Wert, **87** `FLEET_SELF_TOKEN=` (fremde Slots), **9**
`ZAI_API_KEY=`. Nach Programmname (Zaehlung mit der lockeren Suche, 24 Treffer): `tmux×6 node×6
bun×6 codex×2 codex-agent×2 pi-agent×1 zsh×1`. Die eigene Pane hat KEIN `FLEET_TOKEN`
(`env | grep -c '^FLEET_TOKEN='` = 0). Ob diese 19 Werte gleich dem aktuellen Owner-Token sind, ist
nicht verglichen. Ein Datei-Zaun allein laesst diesen Weg offen.

Weitere Reichweite ohne Datei: `tmux -L claudefleet list-sessions` exit 0 — eine Lane kann ueber
den Live-Socket jede Pane lesen und fernsteuern.

### 2. Profilentwurf (SBPL), erzeugt je Lane

```scheme
(version 1)
(allow default)
(deny file-read* file-write*
  (regex #"^<main>/(fleet\.json|\.env)")                       ; faengt .bak und .env.bak-* mit
  (subpath "~/.ssh") (subpath "~/.config/claude-fleet/secrets")
  (literal "~/.codex/auth.json") (literal "~/.claude/.credentials.json") (literal "~/.claude.json")
  (subpath "~/.config/gh") (subpath "~/.cloudflared") (literal "~/.pi/agent/auth.json")
  (subpath "~/.claude/projects") (subpath "~/.codex/sessions") (subpath "~/.pi/agent/sessions")
  (subpath "<agent>/sessions"))
(allow file-read* file-write* (subpath "<agent>/sessions/<slug>"))   ; nur die EIGENE Session
(allow file-read-metadata (literal "<agent>/sessions"))
(deny network-outbound (remote unix-socket (path-literal "/private/tmp/tmux-501/claudefleet")))
(deny process-info* (target others))
(deny sysctl-read (sysctl-name-regex #"^kern\.proc"))
(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.security.agent"))
```

`~` steht hier fuer den ausgeschriebenen Home-Pfad (SBPL expandiert nicht). `<slug>` =
`--<realpath(cwd) ohne fuehrenden /, / -> ->--`, dieselbe Formel wie `server.ts#isolatedPiContextFile`.
SBPL: die spaeter stehende Regel gewinnt, darum oeffnet die `allow`-Zeile die eigene Session im
gesperrten `sessions/`.

Die drei bekannten Fallen:

- **(a) Key im selben Shell-String.** Der Zaun liegt um `pi` allein, NACH dem `$(cat …)`:
  `ZAI_API_KEY="$(cat '<key>')" sandbox-exec -f <profil> pi …`. Das `$(cat)` laeuft in der
  aeusseren Shell, der Key-Pfad bleibt fuer pi und alle Kinder gesperrt. Gemessen (§3 T4): Key im
  Env drinnen vorhanden, Datei drinnen `exit 1`. Der Key selbst bleibt im Env von pi — das ist
  unvermeidbar, pi braucht ihn.
- **(b) `.git` des Worktrees zeigt auf `<main>/.git/worktrees/<name>`.** Gesperrt sind nur Dateien
  (`fleet.json*`, `.env*`), nie `<main>` oder `<main>/.git`. Gemessen: `<main>/.git/HEAD` und
  `<main>/server.ts` offen, `git commit` im Worktree exit 0.
- **(c) `~/.pi` / `PI_CODING_AGENT_DIR` und `/dev`.** `/dev` wird nicht beruehrt (`allow default`).
  Vom Agent-Dir ist nur `sessions/` gesperrt, und darin die eigene Slug-Unterordnung wieder offen —
  sonst stirbt pi am `mkdir` (Attic §„Der pi-Zaun"). Gemessen: pi legt
  `sessions/--private-tmp-…-scratchpad-cwd--` an und startet; fremde Session `exit 1`.

### 3. Proben

Alle mit Kontrollgruppe (derselbe Befehl ohne Profil). Pfade mit `~` redigiert.

**T1 — Inventarpfade oeffnen, ohne ein Byte zu lesen** (`: < datei` bzw. `ls dir > /dev/null`;
erste Sonde fiel an zsh-Wortteilung eines ungesplitteten `$P` und mass nichts, zweiter Lauf mit
Array):

```
## KONTROLLE (ohne Profil)          ## MIT PROFIL
0    -      ~/claude-fleet/fleet.json          1    EPERM  ~/claude-fleet/fleet.json
0    -      ~/claude-fleet/.env                1    EPERM  ~/claude-fleet/.env
0    -      ~/.ssh                             1    EPERM  ~/.ssh
0    -      ~/.config/claude-fleet/secrets     1    EPERM  ~/.config/claude-fleet/secrets
0    -      …/secrets/zai-coding-plan.key      1    EPERM  …/secrets/zai-coding-plan.key
0    -      ~/.codex/auth.json                 1    EPERM  ~/.codex/auth.json
0    -      ~/.claude/.credentials.json        1    EPERM  ~/.claude/.credentials.json
0    -      ~/.claude.json                     1    EPERM  ~/.claude.json
0    -      ~/.config/gh/hosts.yml             1    EPERM  ~/.config/gh/hosts.yml
0    -      ~/.cloudflared                     1    EPERM  ~/.cloudflared
0    -      ~/.pi/agent/auth.json              1    EPERM  ~/.pi/agent/auth.json
0    -      ~/.claude/projects                 1    EPERM  ~/.claude/projects
0    -      ~/.codex/sessions                  1    EPERM  ~/.codex/sessions
0    -      ~/.pi/agent/sessions               1    EPERM  ~/.pi/agent/sessions
0    -      <agent>/sessions                   1    EPERM  <agent>/sessions
0    -      <agent>/sessions/--…-claude-fleet--  1  EPERM  <agent>/sessions/--…-claude-fleet--
0    -      ~/claude-fleet/.git/HEAD           0    -      ~/claude-fleet/.git/HEAD
0    -      ~/claude-fleet/server.ts           0    -      ~/claude-fleet/server.ts
0    -      <agent>/models.json                0    -      <agent>/models.json
```

Die `.bak`-Dateien waren in der ersten Profilfassung (Literal-Regeln) NICHT erfasst; mit der Regex:
`fleet.json.bak` und `.env.bak-20260906-0317` beide `1 EPERM`.

**T2 — Nebenwege** (`bash side.sh`, ohne / mit Profil):

```
                                        KONTROLLE   MIT PROFIL
tmux -L claudefleet list-sessions       exit=0      exit=1
keychain attr query (ohne -w)           exit=0      exit=44
hardlink auf fleet.json anlegen         exit=0      exit=1      (Kontroll-Link sofort geloescht)
open ueber Symlink auf .env             exit=0      exit=1
test -f .env (nur Metadaten)            exit=0      exit=1
bun-Kind oeffnet fleet.json             ok          EPERM
Enkel-sh oeffnet .env                   exit=0      exit=1
```

Link-Zahl der Geheimnisdateien: `fleet.json`, `.env`, `fleet.json.bak`, Key je `stat -f %l` = 1 —
es gibt heute keinen zweiten Hardlink-Namen, ueber den ein Pfad-Deny umgangen wuerde.

**T3 — Prozess-Umgebungen** (`procargs.ts`, Zaehler; jede Zeile ein eigener Lauf):

```
Kontrolle                                                  readable pids=527  FLEET_TOKEN=24 SELF=104 ZAI=10
(allow default) allein                                     readable pids=527  FLEET_TOKEN=24 SELF=104 ZAI=10
(deny process-info* (target others))                       readable pids=531  FLEET_TOKEN=25 SELF=105 ZAI=10
(deny sysctl-read (sysctl-name-prefix "kern.procargs"))    readable pids=527  FLEET_TOKEN=25 SELF=105 ZAI=10
(deny sysctl-read (sysctl-name-regex #"^kern\.proc"))      readable pids=510  FLEET_TOKEN=23 SELF=87  ZAI=9
(deny process-info* others)(allow process-info* self)      readable pids=508  FLEET_TOKEN=24 SELF=88  ZAI=9
(deny process-info*) | (deny sysctl-read) | (deny sysctl*) bun stirbt, exit 133
sysctl-regex kern.proc  +  process-info* others            readable pids=2    FLEET_TOKEN=0  SELF=1   ZAI=0
volles Profil §2                                           readable pids=2    FLEET_TOKEN=0  SELF=1   ZAI=0
```

(Lockere Zaehlung `includes("FLEET_TOKEN=")`; die strenge mit Wert ≥ 16 Zeichen ergab 19.) Jede
Regel allein laesst den Weg offen; nur das Paar schliesst ihn. Die zwei uebrigen PIDs sind der
eigene Prozessbaum, `SELF=1` ist der eigene Slot-Token.

**T4 — Falle (a) und pi-Start** auf Scratch-Socket `piprobe38290` (nie `claudefleet`), Scratch-cwd
im Session-Scratchpad, Scratch-Agent-Dir mit kopierter `models.json`/`settings.json`, Dummy-Key
(`dummy-not-a-key-0000`, eigene Deny-Zeile), eine fingierte fremde Session `--foreign-slot--`:

```
--- trap (a): key read OUTSIDE fence, pi-side re-read INSIDE
env key length inside: 20
re-read key file inside exit=1
foreign session dir inside exit=1
--- pi start
Warning: No project session found with id '11111111-…'; creating a new session with that id.
 pi v0.85.0
 …
 fd not found. Downloading...
 fd installed to …/scratchpad/agent/bin/fd
 …
0.0%/1.0M (auto)                                              glm-5.3-flash • hi
```

Der Gauge `0.0%/1.0M` ist derselbe Readiness-Marker, den der Adapter erwartet. pi's eigenes
Bash-Werkzeug (`!`-Befehl im Composer) danach:

```
 $ : < ~/claude-fleet/.env; echo "env-open rc=$?"; : < ~/claude-fleet/server.ts; echo "server.ts rc=$?"; ps -o pid= -p $$ …
 /bin/bash: ~/claude-fleet/.env: Operation not permitted
 env-open rc=1
 server.ts rc=0
 ps rc=126
```

Kinder erben den Zaun: gemessen an bun-Kind, sh-Enkel (T2) und pi's Bash-Werkzeug (T4). Socket
danach per `tmux -L piprobe38290 kill-server` abgeraeumt, die verbliebene Socket-Datei geloescht.

**T5 — Arbeitswege im Worktree hinter dem Profil §2** (`sandbox-exec -f p.sb bash work.sh`, 4,4 s
gesamt):

```
$ git status --short --branch               ## fleet/260922001849-1758        [exit 0]
$ bun install --frozen-lockfile             9 packages installed [52.00ms]   [exit 0]
$ bun e2e/pins.ts                                                             [exit 1]
$ bunx tsc --noEmit --strict … (Liste aus watchdog.sh#VERIFY_CMD)             [exit 0]
$ bun run build                             hub.js  5.89 KB                   [exit 0]
$ curl /api/self/gate (nur Schluessel)      verify,lands,cleanReview,…,localProof  [exit 0]
$ ./ctl.sh ctx                              ctl.sh ctx: no owner token — set FLEET_CTL_TOKEN,
                                            or run where ~/claude-fleet/fleet.json is readable  [exit 2]
$ git commit --allow-empty -q -m "probe: …" [exit 0]   (danach git reset --soft HEAD~1)
```

`bun e2e/pins.ts` ohne Profil: `ALL PASS`, exit 0. Mit Profil:

```
746 |       const live = spawnSync("ps", ["-o", "lstart=", "-p", String(holder)],
747 |         { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } }).stdout.trim()…
TypeError: null is not an object (evaluating 'spawnSync("ps", …).stdout.trim')
      at …/e2e/pins.ts:747:69
```

Ursache eingegrenzt: `/bin/ps` ist `-rwsr-xr-x` (setuid root), und `sandbox-exec` verweigert
dessen `exec` unter JEDEM Profil — schon `(version 1)(allow default)` allein ergibt
`sh: /bin/ps: Operation not permitted`. Das liegt nicht an einer Regel dieses Entwurfs. Der Pin
kam am 2026-09-15 (`e3c2d128`), nach dem Abbau des alten pi-Zauns; darum steht dieser Preis nicht im
Attic.

Suite-Lock: `sandbox-exec -f p.sb ./e2e-security.sh` →
`[suite-lock-error] e2e-security.sh cannot record process birth for pid 35732; refusing to hold
/tmp/fleet-e2e.lock`, exit 1, nach 2 Ausgabezeilen. `e2e-stage.sh#_st_birth_of` braucht
`ps -o lstart`; ohne eigene Geburt verweigert der Wrapper — er faellt GESCHLOSSEN, er stiehlt
keinen fremden Lock (ein unmessbarer Halter heisst dort „not reaping a possibly live holder").

`ctl.sh`: die Verben `audits ctx dispatch get land send task wait-merge` brauchen den Owner-Token,
`merges commit-main wait-change` lesbares `fleet.json`, `report events watch` den Self-Token
(`awk` ueber `need_*` je Verb). Hinter dem Zaun faellt ausserdem `[ -f <main>/.env ]` → URL-Fallback
`127.0.0.1:8790`; mit `FLEET_CTL_URL=$FLEET_SELF_URL` laeuft ein Self-Verb (`ctl.sh report` →
`report: give a task id`, exit 0). `FLEET_SELF_URL` steht heute in der Pane.

### 4. Benannte Grenzen

- **Im eigenen Env bleibt lesbar:** `FLEET_SELF_TOKEN` (nur dieser Slot) und `ZAI_API_KEY` (pi
  braucht ihn). Der Anbieter bekommt den Key ohnehin; der Self-Token reicht nur auf den eigenen Slot.
- **Netz bleibt offen** (`https://api.z.ai/` 301, npm 200 hinter dem Profil). Was lesbar bleibt,
  ist exfiltrierbar: der ganze Worktree, `<main>` ohne die zwei Dateifamilien, und alles, was nicht
  im Inventar steht — `find ~ -maxdepth 3 -name .env` (ohne `node_modules`) zaehlt 38 Dateien, die
  dieser Entwurf nicht sperrt. Ein Deny-Profil ist genau so gut wie sein Inventar.
- **Kinder erben** — gemessen fuer bun, sh, pi's Bash-Werkzeug. Nicht gemessen: ein Prozess, den
  die Lane an einen AUSSERHALB laufenden Dienst delegiert (z. B. einen fremden tmux-Server ausser
  `claudefleet`, launchd). Der gesperrte Socket ist nur `claudefleet`; `claudefleet-scratch` und
  Suite-Sockets bleiben erreichbar.
- **`ps` ist tot**, nicht nur fuer fremde PIDs (setuid, s. o.). Jeder Lane-Schritt, der `ps` ruft,
  bricht — heute `e2e/pins.ts#RULE_INHERIT_BIRTH`, der Suite-Lock, `state.sh`.
- **`sandbox-exec` ist von Apple als deprecated markiert** (man page); es funktioniert auf macOS
  26.3.1, Codex nutzt denselben Mechanismus. Ein OS-Update kann es brechen — der alte Selbsttest
  an `/usr/bin/true` vor dem pi-Start (`f18c1ec`) faengt genau das.
- **Keychain:** der Deny auf `com.apple.SecurityServer` aenderte den Exit von 0 auf 44; ob 44 hier
  „nicht erreichbar" oder „nicht gefunden" heisst, ist nicht unterschieden, `-w` nicht versucht.
- **Second-host (Linux) nicht gemessen.** Gegenstueck dort: `bwrap` mit `--tmpfs`/`--ro-bind` ueber
  die Geheimnispfade und `--unshare-pid` (schliesst `/proc/<pid>/environ` fremder Prozesse, das
  Linux-Pendant zu T3), oder Landlock (nur Allowlist, kein Deny einzelner Pfade). `ps` ist dort
  nicht setuid, der pins-Preis faellt also vermutlich weg — Vermutung, nicht gemessen.

### 5. Empfehlung mit Schnittlinie

**Bauen: ja.** Der Zaun schliesst gemessen alle drei Wege zum Owner-Token (Datei, Backup,
Prozess-Env) und den Live-tmux-Socket, und pi arbeitet dahinter. Ohne ihn liest ein Z.ai-Modell den
Owner-Token mit einem `cat` und trifft jede Owner-Route.

Ueber der Linie (ein Schnitt, eine Lane):

1. **Adapter:** `pi-zai.spawnCmd` baut das Profil §2 je Lane (cwd → `<slug>`), testet es an
   `/usr/bin/true` und startet `ZAI_API_KEY="$(cat …)" sandbox-exec -p "$P" pi …`; schlaegt der
   Selbsttest fehl, startet pi NICHT (Muster `f18c1ec`, `PI_FENCE_FAILED`).
2. **Ein Pin**, der das Profil haelt: die `fleet.json|.env`-Regex, das Paar
   `process-info* others` + `sysctl-read kern.proc`, den `claudefleet`-Socket — also genau die drei
   Stellen, die in T1–T3 einzeln versagt haetten.
3. **`e2e/pins.ts#RULE_INHERIT_BIRTH` muss ein nicht startbares `ps` ueberleben** (heute
   `TypeError`, die ganze Datei stirbt). Ohne diese Zeile kann eine gezaeunte Lane ihren eigenen
   Docs-only-VERIFY (`install, pins`) nicht fahren. Der Land-Gate laeuft serverseitig und bleibt
   unberuehrt.

Das sind drei Stellen, nicht „eine Adapter-Zeile + ein Pin".

Unter der Linie (nicht jetzt):

- Suiten in einer gezaeunten Lane: sie verweigern geschlossen; Weg bleibt Suite-Offer/Helper bzw.
  der Host. Den Suite-Lock `ps`-frei zu machen waere ein eigener Umbau.
- `ctx` als Self-Route (`GET /api/self` hat heute kein `ctx`-Feld) statt Owner-Verb in `ctl.sh`.
- Allowlist-Profil (`deny file-read*` als Default, Worktree/Toolchains/`<main>/.git` offen) — schliesst
  die 38 `.env`-Dateien und alles Unbekannte, Bruchrisiko ungemessen.
- Herkunft der 19 Prozesse mit `FLEET_TOKEN` im Env (u. a. ein `pi-agent`): warum ein Agent den
  Owner-Token geerbt hat, ist eine eigene Frage.

**Derselbe Zaun fuer codex und claude — Vorschlag, nicht gebaut:** Die Form traegt, die Denyliste
nicht 1:1. claude braucht `~/.claude/projects/<eigener slug>` und seine Credentials (Datei bzw.
Keychain — der Keychain-Deny oben wuerde claude den Login nehmen); codex braucht `~/.codex/auth.json`
und `~/.codex/sessions`. Beide Harnesses laeufen hier mit vertrautem Anbieter und Full Access
(Owner-Entscheid `fc8f4ad`); der Owner-Token-Weg ueber `fleet.json` und Prozess-Env ist bei ihnen
derselbe. Der Nutzen dort waere „Lane kann keine Owner-Route treffen", nicht „Anbieter sieht weniger".

## Methode

Skripte lagen im Session-Scratchpad, nicht im Baum:

- `profile.sh <cwd> <main> <agent>` erzeugt §2 (Slug aus `pwd -P`); Selbsttest
  `sandbox-exec -f p.sb /usr/bin/true`.
- `probe-read.sh <pfade…>`: je Pfad `: < f` bzw. `ls d > /dev/null`, druckt Exit und `EPERM|-|other`.
- `side.sh`: T2-Zeilen wie gedruckt.
- `procargs.ts`: `dlopen("/usr/lib/libSystem.B.dylib")`, `sysctl([1, 49, pid])` fuer PID 1–99 999,
  zaehlt Treffer von `FLEET_TOKEN=`, `FLEET_SELF_TOKEN=`, `ZAI_API_KEY=`; druckt nur Zahlen (eine
  Variante nur Programmnamen).
- T4: `tmux -L piprobe<pid> new-session -d -x 140 -y 44 "sh pane.sh"`, `capture-pane -p`.
- T5: `work.sh` mit den Befehlen in der gezeigten Reihenfolge; `tsc`-Dateiliste aus
  `watchdog.sh#VERIFY_CMD`.

## Was nicht gemessen wurde

Second-host/Linux; codex- und claude-Lanes hinter dem Zaun; `security … -w`; eine echte Z.ai-Runde
(der Dummy-Key hat nie ein Modell erreicht); die Suiten ueber den Suite-Lock hinaus; ein
Allowlist-Profil; ob die 19 `FLEET_TOKEN`-Werte der aktuelle Owner-Token sind; Laufzeitkosten des
Zauns ueber die 4,4 s von T5 hinaus (kein Vergleichslauf ohne Profil fuer dieselbe Liste).

## Entscheidungs-Trail

Zeitstempel auf ±10 min, Reihenfolge exakt.

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-22T00:30Z	inventar	nur test -r + stat, Keychain nur Attribute	Brief: nie Inhalt	§1	17 Tabellenzeilen lesbar, Keychain erreichbar
2026-09-22T00:40Z	profil	file-read* statt file-read-data	Brief nennt file-read*; test -f bricht dadurch (ctl.sh)	T2	gewaehlt, Preis benannt
2026-09-22T00:45Z	gegenprobe	Sonde oeffnet, liest kein Byte (: < f)	Inhalt darf nicht fliessen	probe-read.sh	19/19 wie erwartet
2026-09-22T00:48Z	profil	Literal -> Regex fuer fleet.json/.env	.bak-Dateien lagen daneben	T1 Nachsatz	.bak EPERM
2026-09-22T00:55Z	prozess	procargs per bun:ffi statt ps	ps ist setuid und unter sandbox-exec tot, Kopie liefert nichts	T3	Kanal offen trotz Datei-Zaun
2026-09-22T01:00Z	prozess	Regel-Paar statt Einzelregel	jede allein 508-531 PIDs	T3	2 PIDs
2026-09-22T01:05Z	pi-start	Dummy-Key + Scratch-Agent-Dir	echten Key nicht beruehren	T4	pi startet, Gauge da
```
