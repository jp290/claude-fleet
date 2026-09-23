---
frage: Welche der drei Topologien — (A) zwei Fleet-Instanzen, (B) Host-Platzierung in dieser Fleet, (C) die Command-Jobs des Helfer-Portals — erfuellt das Erfolgskriterium des Programs cd110019 am billigsten, reversibel und beweisbar?
urteil: A, aber ehrlich als „zwei Instanzen, der Mensch foederiert" — nicht als Foederation im Code. A ist die einzige Option, die alle vier Session-Verben des Kriteriums (gruenden · fortsetzen · Succession · Fleet-Report) HEUTE mit demselben Code erfuellt; die zweite Instanz laeuft seit heute mit 0 Slots. C ist keine Konkurrenz, sondern die schon gebaute Tuer fuer den Teil „nicht-iOS-Testlast" und faellt fuer Sessions an seiner eigenen Perimeter (`claude` im cmd = 400). B verletzt ein Non-Goal des Programs und ist ein Umbau von 41 host-lokalen Aufrufstellen ohne Rueckweg per Env. Was wirklich offen ist, sind drei Owner-Fragen (Program-Datensatz auf der zweiten Instanz, Report-Rueckweg, Land-Sperre als Mechanismus) — nicht die Topologie.
bereich: [multi-host, session-runtime, topologie, identitaet, helper-portal]
belege: [server.ts#ensureSlot, server.ts#slotCmd, server.ts#paneAgentAt, server.ts#canDeliver, server.ts#clarificationReceiverFor, server.ts#handleSelfSucceed, server.ts#succeedProgramMain, server.ts#bootstrapProgramMainReserved, server.ts#boundProgramForMain, server.ts#helperJobsView, server.ts#claimCommandJob, server.ts#expireHelperClaims, server.ts#tickWatches, server.ts#armProgramMainLandWatch, server/tmux.ts#tmux, server/types.ts#helperCmdCheck, server/types.ts#Slot, helper-daemon/daemon.ts, fleet-sync.sh, fleet-watchdog.service, docs/dual-host-git-transport.md, docs/attic/dual-host-session-runtime-phase0-2026-08-30.md, docs/messungen/2026-09-04-falsifikator-second-host.md]
nicht-gemessen: kein Slot auf dem Second-host geoeffnet (Verbot dieser Lane) — ob eine ECHTE claude-Session dort gruendet, ist weiter ungemessen; `src/client.ts` nur per grep auf `instance` (Umschalter fehlt, Panel nicht gelesen); Aufwandsklassen sind ABGELEITET; das Program-Lebenszyklus-Doc §3–§7 (Inbox, Program-Handoff) ist PLAN, am Code nicht gebaut — hier als Plan zitiert
stand: 2026-09-05
---

# Dual-Host — die Topologie-Entscheidung (Denkauftrag Phase 4, 2026-09-05)

Read-only-Lane auf Fable 5.1. Kein Code, kein Schreibakt auf dem Second-host. Was ohne Marke steht,
ist am Baum `5986afa` gelesen oder heute per Login-Shell auf dem Second-host GEMESSEN (nur Lesen);
Abgeleitetes traegt **ABGELEITET**. Das Repo ist oeffentlich: keine Hostnamen, Adressen, Nutzer.

**Zwei Owner-Entscheide stehen schon und werden hier nicht neu verhandelt, nur benannt, weil sie
den Raum vorzeichnen** (`docs/attic/dual-host-session-runtime-phase0-2026-08-30.md` §Owner-Gates):
Gate 1 = **A** (2026-09-04: zweite Instanz + Client-Link B1) und Gate 2 = **NEIN** (2026-08-30:
Fleet-Reports ueberqueren keine Hostgrenze). Frage (1) des Programs — „welche Topologie ist die
sicherste erste" — ist damit formal beantwortet; was diese Vorlage leistet, ist der Vergleich am
HEUTIGEN Code (die zweite Instanz existiert seit 19:50) und die Zerlegung in die Fragen, die A noch
offen laesst. Kippt der Owner Gate 1, steht B hier fertig geprueft.

## 0. Wo das Program steht — gemessen heute

| Sensor (Second-host, Login-Shell, nur Lesen) | Wert |
|---|---|
| Fleet-Server | lauscht auf der eigenen privaten Adresse `:8790` (Loopback antwortet `000`), `srv`-Pane = `bun`, User-Unit `fleet-watchdog.service` active, `Linger=yes` |
| Instanzname / Slots | `FLEET_INSTANCE` gesetzt (Rollenwort), `fleet.json` 844 B, `audit.jsonl` 346 B — 0 Slots je gefahren |
| Code-Stand | `5986afa1` = `main` hier; `fleet-sync.timer` active, Journal `fleet-sync: b7c2cc10 -> 5986afa1`, naechster Trigger 15 min |
| Agenten-Binaries | `claude` 2.1.261 unter `~/.local/bin` (nur Login-PATH; `watchdog.sh` exportiert ihn), `~/.claude/.credentials.json` vorhanden · `codex`, `pi`, `node`, `npm`, `docker` **fehlen** · `bun` 1.4.0 nur unter `~/.bun/bin` (Login-PATH kennt es NICHT) · `ast-grep` unter `/usr/local/bin` (die Luecke vom 08-30 ist zu) · kein `xcodebuild` |
| Plattform | x86_64, 16 Kerne, 7,8 GB RAM (6,7 frei), tmux 3.5a, `LANG=de_DE.UTF-8` (alle vier `lstart`-Leser sind seit 09-02 gefenzt) |
| Helfer | System-Unit `fleet-helper.service` active — der Daemon der KANONISCHEN Fleet, parallel zur eigenen Fleet |
| Board hier | `GET /api/sessions` traegt `instance {name}` (einmal pro Antwort, `server.ts#INSTANCE`), `FleetReport.provenance.instance` gestempelt; **kein Umschalter**: `rg '\binstance\b' src/client.ts` trifft nur `instanceof` |

**Das Erfolgskriterium, woertlich, und wo die Rangliste abschneidet:** „Nach einer ausdruecklich
vom Owner akzeptierten Architekturentscheidung kann ein reversibler Betriebsmodus aktiviert werden,
in dem mindestens eine nicht-iOS Program-MAIN samt Worker auf second-host gegruendet, fortgesetzt,
per Succession ersetzt und per Fleet-Report zurueckgefuehrt wird; iOS-Arbeit bleibt auf dem Mac;
API und Board nennen den ausfuehrenden Host; ein offline/recycelter Second-host-Occupant erzeugt
weder Doppelarbeit noch Fehlrouting. Setup, Ruecknahme und ein realer End-to-End-Lauf sind
dokumentiert und gemessen." — Sechs Saetze. Alles unten wird nur daran gemessen; „Foederation im
Code", „ein Namensraum", „Spiegel der Programs" stehen NICHT im Kriterium und werden hier nur als
Owner-Frage gefuehrt, nie als Pflicht.

## 1. Drei Topologien im selben Raster

### A — Zwei Fleet-Instanzen, der Mensch foederiert (B1-Client-Link)

- **Mechanismus am Code.** Derselbe `server.ts` je Host. Alles, was eine Session ausmacht, ist
  prozesslokal per Entwurf: `server/tmux.ts#tmux` spawnt `tmux -L SOCK` lokal (38 `tmux(` + 3
  `tmuxNewSession(` Aufrufstellen in `server.ts`); `server.ts#ensureSlot` backt `FLEET_SELF_TOKEN`
  und den Server-PATH (`PATH_EXPORT`) in den zsh-String der Pane; `server.ts#createWorktree`
  legt Worktrees per lokalem git an; `STATE_FILE` und die drei Ledger haengen an
  `import.meta.dir`. Instanz-Identitaet: `server.ts#INSTANCE_NAME` aus `FLEET_INSTANCE`
  (`src/protocol.ts#INSTANCE_NAME_RE`, `null` statt Default-Wort), einmal pro `/api/sessions`
  und auf jeder Report-Zeile (`server.ts#openFleetReport`, `provenance.instance`).
  Git-Transport: `fleet-sync.sh` (`merge --ff-only`, fuenf Ausgaenge, 3 = DIVERGED) per
  `fleet-sync.timer`; Boot: `fleet-watchdog.service` startet dasselbe `watchdog.sh`
  (`KillMode=process`, `PrivateTmp=false`; Pin in `e2e/pins.ts` haelt die Schrittkette gleich).
- **Existiert heute.** Die zweite Instanz (Tabelle §0), Instanzname, Report-Provenienz, der
  Fast-Forward-Timer, der Helfer-Daemon daneben, Richtung R (`git fetch` der Second-host-Branches
  vom kanonischen Host, gemessen `docs/dual-host-git-transport.md` §Verifikation).
- **Zu bauen** (Schnitte in §3): (1) der B1-Umschalter in `src/client.ts` (Kopfzeile, Liste
  `{name,url}`, Wechsel der Origin, kein Proxy, kein geteiltes Token) · (2) eine **Land-Sperre als
  Mechanismus**: heute gibt es keinen Env-Schalter, der `mergeJob` verweigert (`rg 'FLEET_LAND_'
  server.ts` findet nur `FLEET_LAND_FF_RETRY_ROUNDS`); die Regel „der Second-host landet nie" ist ein
  Owner-Entscheid, `fleet-sync.sh` MISST nur (Ausgang 3) · (3) optional: Instanzname im
  Lane-Branch (`server.ts#createWorktree` benennt `fleet/<stamp>-<hex>`), damit ein per R geholter
  Branch seinen Ursprung traegt.
- **Identitaet hostuebergreifend beweisbar?** Innerhalb der Instanz vollstaendig: Slot +
  `openedAt` + `sessionId` (`server.ts#boundProgramForMain`), Self-Token in-memory geprueft,
  Checkout = `git rev-parse HEAD` gegen das Sync-Journal, Instanz = `instance.name`. **Ueber die
  Grenze gibt es keinen gemeinsamen Namensraum und keinen Kanal, der einen erzeugt** — beweisbar
  ist nur die Herkunft eines Artefakts: `provenance.instance` auf der Report-Zeile, der
  Branch-Name (nach (3)), und der Git-Commit selbst. Sensoren: `GET /api/sessions` je Origin,
  `GET /api/self` je Pane, `git ls-remote` in Richtung R.
- **Offline / recycelter Occupant.** Kein Fehlrouting per Konstruktion: keine Route der einen
  Instanz kennt einen Slot der anderen. Doppelarbeit ist moeglich, aber nur ORGANISATORISCH —
  derselbe Program-Text auf beiden Boards aktiv; kein Mechanismus verhindert oder erkennt das.
  Ein offline gehender Second-host nimmt seine Sessions mit (kein Drain, wie bei Sessions ueberall);
  ein recycelter Slot dort unterliegt derselben `slot+openedAt`-Regel wie hier.
- **Ruecknahme.** `systemctl --user disable --now fleet-watchdog fleet-sync.timer` auf dem
  Second-host (Host-Akt) plus Entfernen des Umschalters hier — ein Unit-Flip, kein Umbau des
  kanonischen Servers. Laufende Sessions dort sind weg; es gibt keine Migration (M4 der Phase-0).
- **Kosten / Risiken.** Zweite netzerreichbare Flaeche („a reachable fleet is remote code
  execution as your user", Gate 4 der Phase-0) · zweites Claude-Login als Credential-Flaeche ·
  zwei `fleet.json`, zwei Ledger-Saetze, zwei Inboxen, die niemand joint · Programs sind
  Instanz-Zustand (`programs` in `fleet.json`): ein Program fuer den Second-host muss DORT
  vorgeschlagen und bestaetigt werden, oder ein Spiegel entsteht (neuer Code) · zeitempfindliche
  Fixtures fallen dort oefter (`D2 setup` 3 von 5 Laeufen rot gegen 0 von 5 lokal,
  `docs/messungen/2026-09-04-falsifikator-second-host.md` §6) · tmux 3.5a gegen die hier
  vermessenen 3.6a-Flakes · Game-Maker-Verify ist NICHT portabel (T14-Digest,
  `docs/messungen/2026-08-31-second-host-session-canary-private-repo-o.md`): Spiele darf der Second-host
  fahren und bebildern, nicht gruen/rot sprechen.
- **FALSIFIKATOR.** EIN echter claude-Slot auf der zweiten Instanz (S1 in §3): `agent` muss
  `alive` lesen (`server.ts#paneAgentAt`, comm `claude`), ein Gruendungstext muss `acceptance:
  observed` erreichen (`server.ts#sendText`, Composer-Glyph `❯`), die Transcript-Route muss
  Eintraege liefern. Liest die Pane reproduzierbar `no-agent` oder `not-observed`, dann gruendet
  „derselbe Code" auf Linux eben nicht — A ist dann ein Reparaturprogramm, kein Betriebsmodus.
  Zweiter Falsifikator, organisatorisch: ein Program, das binnen der ersten Woche auf BEIDEN Boards
  aktiv steht (Ledger beider Instanzen) — dann traegt der Mensch die Foederation nicht, und B-lite
  (Spiegel/Lock) wird noetig.

### B — Host-Platzierungs-Schicht in DIESER Fleet (Slot traegt einen Host)

- **Mechanismus am Code — was fehlt, praezise.** `server/types.ts#Slot` hat `cwd`, `worktree`,
  `model`, `harness`, `container`, `containerContext`, `effort`, `taskId`, `programId`,
  `selfToken`, `sessionId` — **kein Host-Feld**. Jede Beobachtung ist ein lokaler Spawn: `tmux`
  (41 Stellen), `ps -o comm=` und `pgrep -P` in `server.ts#paneAgentAt`, `capture-pane` in
  `server.ts#paneReadiness` und `sendText`, `git` in `createWorktree`/`handoffCommittedAfterOpen`,
  `pipe-pane -o exec cat >> <STREAM_DIR>` in `ensureSlot`. Der Server hat **keinen HTTP-Client**:
  das einzige `fetch(` in `server.ts` ist der `Bun.serve`-Handler. Die einzige Stelle, die „wo
  laeuft der Agent" von „wo laeuft die Pane" trennt, ist `CONTAINER_HARNESS.spawnCmd`
  (`docker --context '<ctx>' exec -it -w "$PWD" '<box>' …`) — und sie verlangt den Worktree am
  identischen Pfad im Container, `supports.transcript:false`, `automatable:false`, `worker:()=>null`.
- **Existiert heute.** Nichts von B. Naechste Verwandte: der Container-Adapter (Agent anderswo,
  Pane hier) und der Helfer-Daemon (Pull-Runner ohne Pane, `helper-daemon/daemon.ts#runArgv`).
- **Zu bauen.** Host-Feld + Projektion (`Slot`, `/api/sessions`, Byte-Decke `e2e/tasks.ts`
  `bytes < 14 * 1024` bei 16 Slots — ein String pro Slot ist die teure Form) · ein Transport fuer
  tmux/ps/git/capture/send: entweder ein ssh-Runner (ausdruecklich Non-Goal des Programs) oder ein
  Daemon-seitiger „Slot-Runner" im Pull-Modell mit eigenem Protokoll (tmux-Verben, Stream-Rueckweg,
  Composer-Beobachtung binnen des 1500-ms-Ruhefensters) · Worktree und Stream auf dem Remote-Host ·
  Liveness-Heartbeat je Remote-Pane, weil `has-session` sonst „offline" und „tot" nicht trennt ·
  `handleSelfSucceed`/`succeedProgramMain` (beide suchen `slots.find(!x.cwd)` und oeffnen mit
  demselben cwd-String) · `clarificationReceiverFor`/FleetEvent-Zustellung (tippt per tmux in die
  Empfaenger-Pane). ABGELEITET: XL, und jede Teilmenge halb gebaut erzeugt genau das Fehlrouting
  aus M5 der Phase-0.
- **Identitaet.** Die Staerke von B: EIN Namensraum, `slot+openedAt+sessionId` gilt fleetweit,
  `boundProgramForMain` bleibt wahr, Reports und Attention brauchen keinen zweiten Weg. Das ist die
  einzige Zeile, in der B A schlaegt.
- **Offline / recycelt.** Heute ohne Gegenstueck: `ensureSlot` wuerde bei `has-session ≠ 0`
  respawnen wollen, ohne zu wissen, ob der Host weg ist oder die Pane; `bootstrapProgramMainReserved`
  liest eine Bindung ohne lebenden Occupant als STALE und gruendet neu — kommt der Host zurueck,
  stehen zwei MAINs. Genau das Fehlrouting, das das Kriterium ausschliesst, muss B erst erfinden.
- **Ruecknahme.** Code-Entfernung; ein Env-Flip nur, wenn die Schicht von Tag 1 hinter einem Flag
  steht — und dann ist das Flag selbst neue Flaeche in jeder der 41 Stellen.
- **Kosten / Risiken.** Non-Goal woertlich: „Kein Cross-host-tmux-, SSH-Runner- oder Push-Umbau
  vor der Owner-Entscheidung ueber die Topologie" — B ist nur DURCH diese Entscheidung waehlbar.
  Sicherheit: der kanonische Host haelt ein Ausfuehrungsrecht auf den zweiten; die RCE-Aussage
  wird transitiv (`docs/messungen/2026-08-27-linux-second-host-machbarkeit.md` §8: „der Mac fuehrt nie
  Code aus, den der Linux-PC schickt" — B kehrt die Richtung fuer die Beobachtung um, auch wenn der
  Runner im Pull-Modell bleibt).
- **FALSIFIKATOR.** Ein Spike, der `paneAgentAt` + `sendText`-Acceptance ueber den Transport
  fuehrt und dabei die vier Zustaende (`alive|no-agent|no-pane|unprobed`, `observed|not-observed|
  refused|unobservable`) NICHT innerhalb desselben Ticks liefern kann, zeigt, dass B die
  Faktschicht verliert — dann lueg das Board fuer Remote-Slots. Umgekehrt: faellt der Falsifikator
  von A (claude gruendet auf Linux nicht), faellt B mit, denn die Pane laege ebenfalls auf Linux.

### C — Command-Jobs des Helfer-Portals

- **Mechanismus am Code.** `POST /api/self/jobs` (nicht lane-only; `server.ts`, Route) nimmt
  `cmd` gegen `server/types.ts#HELPER_CMD_ALLOW` (sechs Schluessel, Wert = argv), verweigert jeden
  `cmd`, dessen Token `claude|codex|pi` enthaelt (`HELPER_CMD_FORBIDDEN`, 400 ohne Zeile), buendelt
  den EIGENEN Baum (`git stash create`, untracked bleibt zu Hause) und legt `commandJobs` an
  (Deckel 3 offene je Session, 20 settled). `server.ts#helperJobsView` bietet den Job nur einem
  Geraet mit `daemonSha` an; `server.ts#claimCommandJob` prueft dasselbe und die Lebendigkeit des
  Anbieters (`slot+openedAt`), sonst `reaped`. Der Daemon klont, `bun install`, `runArgv` OHNE
  Shell (`helper-daemon/daemon.ts#runArgv`), `childEnv()` streift `FLEET_*`, meldet Exit-Code,
  Tail, `clonedSha`, Artefakt-Quittungen (Pfad, sha256, Bytes — **keine Bytes**). Rueckweg:
  `{kind:"job"}`-Watch (`docs/self-api.md` §watch/job), dreiwertig ueber
  `server.ts#remoteVerdictOf` (127/126/`VERIFY_SKIP_EXIT`/kein Code = `unknown`).
- **Existiert heute.** Vollstaendig, und am 2026-09-04 gefahren (`./e2e-isolated.sh` als
  Command-Job, 1 516 824 ms, Trail 973 273 B).
- **Zu bauen — fuer Sessions: die falsche Frage.** Ein Job hat keine Pane, kein Transcript, keinen
  Composer, keine Steuerung, keine Clarification, keine Succession. Ihn zur Session-Runtime zu
  machen hiesse, ein allowlisted Skript einzutragen, das selbst `claude` startet — der
  Fehlertext von `helperCmdCheck` sagt woertlich, dass er „the command string, not what an
  allowlisted script goes on to run" bindet. Das ist exakt die Hintertuer, die das Non-Goal „Das
  bestehende Helper-Portal … wird nicht stillschweigend als Session-Runtime umgedeutet" verbietet.
  **C ist fuer den Programm-Intent „nicht-iOS-Testlast" die kleine Tuer und ist fuer die vier
  Session-Verben des Kriteriums keine.** Was fuer die Testlast noch fehlt: Artefakt-BYTES fuer
  Command-Jobs (`uploadSuiteLog` haengt an `auditAt`, also audit-only — die in
  `2026-09-04-falsifikator-second-host.md` §4 benannte Luecke) und ein Weg, einen BESTIMMTEN Baum zu
  messen (der Job buendelt den Baum des eigenen cwd zur Claim-Zeit).
- **Identitaet.** Job → Anbieter-Occupant (`slot+openedAt`), `commitSha`/`treeSha` beim Claim,
  `clonedSha` vom Geraet, `daemonSha` und Geraetename im Heartbeat. Beweisbar ueber
  `GET /api/self/jobs/:id` (nur der Anbieter) und `audit.jsonl` (`helper_claim`).
- **Offline / recycelt — geloest.** `server.ts#expireHelperClaims`: Claim-Verfall
  (`HELPER_CLAIM_TIMEOUT_MS` 2 700 000) ⇒ `lapsed` mit `unknown`-Verdikt; toter Anbieter ⇒
  `reaped`; kein Drain hinter Command-Jobs ⇒ keine Doppelarbeit; der Watch feuert in jedem Ausgang.
  Wake-Rail: `server.ts#tickHelperWake` weckt ein `desiredMode:active`-Geraet nur bei wartender
  Arbeit, mit Backoff.
- **Ruecknahme.** Nichts zurueckzunehmen.
- **Kosten / Risiken.** **Der Claim-Guard prueft nur die ANWESENHEIT von `daemonSha`**
  (`claimCommandJob`: `if (!helperDevices.get(deviceId)?.daemonSha)`), nicht ob dieser Baum
  `kind:"command"` kennt — ein Daemon von einem Baum zwischen der Einfuehrung von `daemonSha` und
  S2 faellt auf `cfg.suiteCmd` durch und liefert ein Gruen ueber ein Kommando, das niemand
  verlangt hat. Reparatur klein: `git merge-base --is-ancestor <S2-sha> <daemonSha>` serverseitig
  oder ein Capability-Feld im Heartbeat. Zweitens: `ast-grep` liegt jetzt unter `/usr/local/bin`,
  also im Daemon-PATH — die Ausnahme der Baseline-Notiz ist damit hinfaellig (gemessen §0).
- **FALSIFIKATOR.** Fuer C als Topologie ist er schon gelaufen: `POST /api/self/jobs {cmd:"claude
  …"}` → 400 per Entwurf. C kann kein Session-Verb erfuellen, ohne seinen eigenen Perimeter zu
  brechen. Fuer C als Testlast-Tuer: ein Command-Job, dessen Verdikt vom lokalen Lauf desselben
  Baums abweicht, ohne Plattform-Signatur — dann misst der Daemon etwas anderes als die Frage.

## 2. Empfehlung

**A — zwei Instanzen, der Mensch foederiert ueber den B1-Umschalter; C bleibt die Tuer fuer
Testlast und wird nicht umgedeutet; B wird nicht begonnen.** Begruendung in drei Saetzen: A ist
die einzige Option, die gruenden · fortsetzen · Succession · Fleet-Report heute mit demselben Code
erfuellt (`e2e/programs.ts` und `e2e/slots.ts` waren in allen fuenf vergleichbaren Second-host-Laeufen
gruen, `2026-09-04-falsifikator-second-host.md` §6), und ihre Ruecknahme ist ein Unit-Flip. B
erfuellt das Kriterium erst nach einem XL-Umbau, dessen erster Schritt ein Non-Goal des Programs
aufhebt. C erfuellt einen Teil des Intents, keinen Satz des Kriteriums, und seine Umdeutung ist ein
weiteres Non-Goal.

**Was A NICHT gratis mitbringt, und was deshalb die eigentlichen Owner-Fragen sind (§4):**
(i) der Program-Datensatz lebt in der `fleet.json` der Instanz, die ihn bestaetigt hat — ein
Program fuer den Second-host wird DORT vorgeschlagen (`POST /api/self/programs` von einer dortigen
Controller-Session oder `POST /api/programs` vom Owner ueber das dortige Board), oder es braucht
einen Spiegel; (ii) der Rueckweg ueber die Hostgrenze bleibt per Gate 2 = NEIN der Mensch am
zweiten Board plus Richtung R fuer die Arbeit — ein Fleet-Report einer Second-host-Lane erreicht
ihre Second-host-MAIN, nie den Controller hier; (iii) „der Second-host landet nie" ist heute Regel, kein
Mechanismus.

**Falsifikator der Empfehlung:** S1 (§3). Liefert der eine echte claude-Slot auf der zweiten Instanz
nicht `agent: alive` + `acceptance: observed` + lesbares Transcript, ist „derselbe Code gruendet auf
Linux" widerlegt und A wird zum Reparaturprogramm — dann ist die naechste Frage nicht B, sondern
„claude auf Linux in einer tmux-Pane", die B genauso traefe.

**Sind zwei Optionen gleich gut?** A und C konkurrieren nicht. A gegen B trennt EINE Frage: **muss
ein Occupant hostuebergreifend in EINEM Namensraum beweisbar sein?** Ja ⇒ B (mit Umbau,
Non-Goal-Aufhebung, transitiver RCE). Nein — zwei Boards, zwei Ledger, der Owner joint — ⇒ A.
Das Kriterium verlangt „API und Board nennen den ausfuehrenden Host", und das erfuellt A ueber
`instance.name` je Origin; es verlangt keinen gemeinsamen Namensraum.

## 3. Erste Schnitte fuer A — vier, in dieser Reihenfolge

Jeder Schnitt als dispatchbarer Auftragstext. Verify-Zeile = die volle Kette aus `AGENTS.md`
§Verify, sofern nicht „docs-only" steht. Jeder externe Schreibakt ist ein einzeln benanntes
Owner-Gate (W-Nummern), nie Teil des Lane-Auftrags.

**S1 — Die Kanarie: ein echter claude-Slot auf der zweiten Instanz.** *Auftrag:* Nach W1 (Owner
oeffnet auf dem Second-host-Board GENAU EINEN Slot im dortigen Fleet-Checkout, Harness claude, Modell
wie hier ueblich) misst eine Lane HIER per Read-only-ssh und `curl` gegen die zweite Instanz fuenf
Sensoren und legt sie als Mess-Notiz ab: (1) `GET /api/sessions` dort → `agent` des Slots, (2)
`tmux -L claudefleet list-panes -F '#{pane_current_command}'` → Pane-Kette `zsh/bash → claude`, (3)
der Owner tippt einen Satz mit Codewort in die Pane; `GET /api/slots/:id/transcript` dort liefert
ihn, (4) ein Owner-`/send` mit `submit:true` liefert `acceptance: observed` in der Receipt, (5)
`GET /api/self` aus der Pane (Owner tippt das `curl`) antwortet mit der eigenen Zeile.
*Done-Kriterium:* `docs/messungen/2026-09-0X-second-host-claude-slot-kanarie.md` zitiert alle fuenf
Werte woertlich und schliesst mit „A steht / A faellt". *Verify:* docs-only (`bun install
--frozen-lockfile && bun e2e/pins.ts`, Leak-Grep leer). *Dateien:* nur die Notiz. *Owner-Gates:* W1
(Slot oeffnen — ein Session-Start auf dem zweiten Host), W1b (die zwei Tipp-Akte in die Pane). *Warum
zuerst:* es ist der Falsifikator von A, kostet keinen Code, und jede weitere Zeile haengt daran.

**S2 — Land-Sperre als Mechanismus.** *Auftrag:* ein Env-Schalter (Vorschlag `FLEET_LANDS=0`;
Default = heutiges Verhalten) laesst jede der ZWEI `mergeJob(`-Aufrufstellen (`server.ts`, der
Owner-Merge-Route und `server.ts#selfLandTaskForMain`) mit 409 `this instance does not land — it
follows a canonical main` antworten, ohne Job, ohne Verdikt-Zeile; `GET /api/self/gate` traegt
`lands: boolean`; `GET /api/sessions` traegt es einmal neben `instance`; das Board blendet ⏏/⏫ aus,
wenn `false`. *Done-Kriterium:* ein neuer Check in `e2e/land.ts`-Nachbarschaft (Familie des
Land-Pfads) startet die Suite-Instanz mit dem Schalter und beweist beide 409 und die drei Sichten;
ein Pin in `e2e/pins.ts` haelt „`mergeJob(` hat genau zwei Aufrufstellen, beide hinter dem
Schalter". *Verify:* volle Kette **und** `./e2e-isolated.sh` **und** `./e2e-clean-review.sh` (Land-
Pfad beruehrt). *Dateien:* `server.ts` (die zwei Routen, gate-Route, sessions-Projektion),
`src/client.ts` (Knopf-Sichtbarkeit), `e2e/pins.ts`, ein `e2e/`-Modul, `docs/dual-host-git-
transport.md` §„Was dieser Schnitt NICHT tut" (der Satz „die Regel ist der Owner-Entscheid, nicht
das Skript" wird korrigiert). *Owner-Gates:* W2 = die Zeile `FLEET_LANDS=0` in die `.env` des
Second-host schreiben und `srv` dort neu starten (zwei Host-Akte, einzeln). *Warum zweitens:* bevor
irgendjemand dort eine Lane fahren darf, muss der Fehlweg „Land auf dem Folger" strukturell zu sein;
`fleet-sync.sh` Ausgang 3 bleibt der Sensor dahinter.

**S3 — B1-Umschalter im Board** (Schnitt 4 der Phase-0, unveraendert gueltig). *Auftrag:* eine
Liste `{name, url}` als Env `FLEET_INSTANCES` (JSON, validiert wie `INSTANCE_NAME_RE` + URL-Charset)
oder als Owner-Route; die Kopfzeile zeigt den eigenen `instance.name` und einen Umschalter, ein
Klick wechselt `location.origin`; kein Proxy, kein geteiltes Token, kein Outbound-Fetch im Server.
*Done-Kriterium:* Umschalten wechselt die Origin, jede Instanz behaelt Login und Cookie; ein
`e2e/`-Check beweist Validierung und Projektion; Screenshot im Report. *Verify:* volle Kette +
`bun run build`; Demo-Repo-Typecheck als MELDUNG (Lane hat nur getrackte Dateien). *Dateien:*
`server.ts` (Env-Parsing, `/api/sessions`), `src/client.ts`, `src/protocol.ts`, `e2e/`. *Owner-Gates:*
keins auf dem Second-host; hier ein normales Land + `srv`-Restart. *Warum drittens:* das Kriterium
sagt „Board nennt den Host" — heute nennt es nur die API.

**S4 — Der reale End-to-End-Lauf des Kriteriums.** *Auftrag (Owner-gefuehrt, Lane misst):* nach S1
gruen und S2 dort aktiv (via `fleet-sync` + W2b `srv`-Restart): W3 der Owner bestaetigt auf dem
Second-host-Board ein nicht-iOS Program (z. B. eine Mess- oder Doku-Zeile dieses Repos); dort
`bootstrapProgramMainReserved` → MAIN → `POST /api/self/tasks` + `release` → Lane → Fleet-Report an
die MAIN → `POST /api/self/succeed` → Nachfolgerin; die Lane-Branch wird hier per Richtung R geholt
(`git fetch ssh://… '+refs/heads/*:refs/remotes/ZWEITHOST/*'`, W4) und durch DIESEN Land-Gate
gelandet. *Done-Kriterium:* Mess-Notiz mit Ledger-Zitaten BEIDER Instanzen (`audit.jsonl` dort:
`program_main_*`, `fleet_report_open`, `slot_kill … handoff`; hier: die Land-Note mit
`verify.proportional`), plus `provenance.instance` der Report-Zeile. *Verify:* docs-only fuer die
Notiz; der Land hier laeuft seinen eigenen Gate. *Owner-Gates:* W3, W4, W2b. *Warum viertens:* es
ist der Satz „ein realer End-to-End-Lauf ist dokumentiert und gemessen" — und er ist erst nach
S1–S2 ueberhaupt erlaubt.

**S4 — GEMESSEN 2026-09-06 05:17–05:40 (Controller Slot 2 auf der kanonischen Instanz, Owner-Delegation
vom 2026-09-05 20:2x).** Der reale Lauf ist gefahren und dokumentiert; die Notiz ist
`docs/messungen/2026-09-06-dual-host-s4-folger-lauf.md` (Commit `56da69f`, geschrieben von der
Folger-Lane, hier per Richtung R geholt und ueber DIESEN Gate gelandet: Land-Note `verify.ok true`,
`proportional true`, Schritte `install, pins`, 974 ms). Was auf dem Folger gefallen ist, in Ledger-Zeilen
dessen `audit.jsonl`: `program_dispatch` (Program `4f6f3144…`, `maxLanes 1`) → `main_task`/`task_release`
(`cfd49c10`, durch die dortige MAIN, Fable 5.1) → `slot_open` der Lane (Opus 5, Branch
`fleet/260906032010-5d95`) → `fleet_report_open` (`748dfd0e…`, `basis program-main`, angenommen 05:29:36
nach eigenem Nachfahren des roten Pins) → `slot_kill 1 handoff` (Succeed der MAIN, HANDOFF-Commit
`f5a00e2` auf `s4/main`) → `slot_kill 3 handoff` (Retire der Nachfolgerin nach ihrem Nachtrag `27e3b82`).
Zwei Nahte, die der Entwurf oben nicht benannt hatte:

- **Die Folger-MAIN darf NICHT im main-Checkout leben.** `POST /api/self/succeed` verlangt einen
  committeten `HANDOFF.md`; ein Commit auf `main` des Folgers waere die Divergenz, die `fleet-sync.sh`
  mit Exit 3 meldet. Gefahren wurde sie deshalb im Worktree `claude-fleet.worktrees/s4-main` auf der
  Branch `s4/main` (`preflightProgramMain` klassifiziert einen Worktree als `target-repo`, der Brief
  liest dann `AGENTS.md` — das reichte). Die Lane der MAIN entstand als Worktree UNTER diesem Worktree;
  `main` des Folgers blieb unberuehrt und der naechste Sync war ein reiner ff (`b224ef8 -> 56da69f`, mit
  Build).
- **Der leak-pin ist auf dem Folger fuer JEDE Lane rot** (`FLEET_ALLOWED_HOSTS` dort traegt den nackten
  Maschinennamen, der in 252 getrackten Zeilen steht); die Lane hat das als Host-Konfiguration
  adjudiziert und die MAIN es reproduziert. Owner-Wahl als Queue-Notiz gefilet (drei Wege; Empfehlung:
  der Pin ueberspringt einlabelige Namen).

Vorbedingung (a) davor: `fleet-sync.sh` baut das Bundle (`b224ef8`, Exit 5 fuer einen roten Build,
`%h/.bun/bin` im Unit-PATH), am Folger in drei Laeufen gemessen (ff ohne Build mit dem alten Skript-Inode,
dann Fall A „current, Bundle fehlt → Build", dann ueber die neu installierte Unit ohne Build). Was die
Ledger-Zeile `lane-outcomes.jsonl` des FOLGERS fuer diese Lane sagt, ist `killed-dirty` — aus SEINER Sicht
ist die Branch nie gelandet, denn gelandet hat sie die andere Instanz; das ist die erwartete Blindstelle
von Topologie A, kein Defekt.

Nicht als Schnitt gefuehrt, aber klein und unabhaengig: **C-Guard** — `claimCommandJob` prueft
`daemonSha` per `merge-base` gegen den S2-Commit statt auf Anwesenheit (Risiko in §1 C).

## 4. Owner-Entscheidungen — fuer sich lesbar

| # | Frage | Ja / A | Nein / B |
|---|---|---|---|
| E1 | **Topologie bleibt A** (zwei Instanzen, der Mensch foederiert; Gate 1 vom 09-04 bestaetigt)? | S1–S4 laufen in dieser Reihenfolge; B wird nicht begonnen | B wird geplant: Non-Goal „kein Cross-host-tmux/SSH-Runner" faellt, XL-Umbau, transitive RCE-Flaeche; A-Instanz wird zurueckgebaut |
| E2 | **Gate 2 bleibt NEIN** (kein Fleet-Report ueber die Hostgrenze)? | Rueckweg = Richtung R (Branch holen, hier landen) + der Owner liest das zweite Board; der Controller hier erfaehrt vom Second-host-Program nichts automatisch | eine Relay-/Inbox-Bruecke wird entworfen: neuer Outbound-Code in einem Server ohne HTTP-Client, eigener Architekturentscheid |
| E3 | **Land-Sperre als Env-Mechanismus bauen** (S2)? | der Folger kann auch von Hand nicht landen; Board zeigt es; `fleet-sync` Ausgang 3 wird zur Nie-Zeile | die Regel bleibt Regel; ein Handklick am zweiten Board landet dort, und der Timer meldet es 15 min spaeter als `failed` |
| E4 | **Program-Datensatz:** auf der zweiten Instanz NEU vorschlagen und bestaetigen (A) — oder einen Spiegel bauen (B)? | zwei Handgriffe des Owners je Program, kein Code; Doppelarbeit bleibt organisatorisch moeglich | neuer Sync-Code fuer `programs`, Kollisionsregeln, ein weiterer Namensraum-Join |
| E5 | **Kanarie S1 jetzt** (W1: einen claude-Slot auf dem Second-host-Board oeffnen, zwei Saetze tippen)? | der Falsifikator von A wird gefahren; Ergebnis diese Woche | A bleibt „ABGELEITET"; jeder weitere Schnitt baut auf einer ungemessenen Praemisse |
| E6 | **Weitere Harnesses auf dem Second-host installieren** (codex braucht `node`+`codex`; pi braucht `pi`; container braucht `docker`) — je ein Host-Akt? | mehr Sessionformen dort; jede Installation einzeln freigegeben | claude-only dort; codex/pi/container bleiben Mac-Formen |
| E7 | **C-Guard haerten** (`daemonSha` per `merge-base` statt Anwesenheit)? | ein alter Daemon kann kein falsches Gruen ueber ein nie gefahrenes Kommando liefern | das Risiko bleibt benannt und offen; heute steht der Daemon auf einem Baum mit S2 |

Reihenfolge der Antworten, die den Rest freischaltet: E5 (kostet nichts) → E1 → E3 → E2/E4 → E6/E7.

## 5. Sessionformen auf Linux — am Adapter und am Geraet gemessen

`HARNESSES` in `server.ts` = sieben Adapter. Voraussetzung ist jeweils ein Binary im PATH des
SERVERS (`PATH_EXPORT` wird in jede Pane gebacken; `watchdog.sh` exportiert `~/.local/bin`,
`~/.bun/bin`), geprueft durch `commsFor(s)` → `paneAgentAt` eine Ebene tief.

| Adapter | braucht (Code) | Second-host heute (gemessen) | Verdikt |
|---|---|---|---|
| `claude` | `claude` in PATH, `comms:["claude"]`, `automatable:true` | 2.1.261 unter `~/.local/bin`, Credentials vorhanden | **laeuft** — Maschinerie unter Stand-in bewiesen, echte Session = S1 |
| `codex` | `codex` + `node` (`comms:["codex","node"]`), Rollout-Recovery liest `~/.codex` | `codex`, `node`, `npm` fehlen | nur nach E6; Vendor-Pfad ist arch-spezifisch (Adapter-Kommentar) |
| `pi`, `pi-zai`, `pi-ox` | `pi` (`comms:["pi"]`) | `pi` fehlt | nur nach E6 |
| `pi-unfenced` | wie pi, `singleton`, `allowsLanes:false` | fehlt | Main-only, keine Lane — dort ohne Zweck |
| `container` | `docker` + Kontext + Bind-Mount am identischen Pfad, `automatable:false`, `transcript:false` | `docker` fehlt | keine unbeaufsichtigte Form; nicht der Weg |

**Mac-exklusiv bleibt:** die gesamte iOS-/Xcode-/Simulator-Kette (kein `xcodebuild` auf dem Geraet,
kein Linux-Aequivalent — Non-Goal 1 des Programs) und damit jede Studio-Form, die sie voraussetzt;
**Game-Maker-Verify** als Verdikt (T14-Digest ist plattformgebunden: fahren und bebildern ja,
gruen/rot nein, `2026-08-31-second-host-session-canary-private-repo-o.md`). **Linux-tauglich, gemessen:**
die Suite-Maschinerie (`./e2e-isolated.sh` vollstaendig, `programs.ts`/`slots.ts` gruen), Builds,
Command-Jobs; **mit Vorbehalt:** zeitempfindliche Fixtures (`D2 setup`), `sh` ist dash (Kill-Staffel
seit `server/proc.ts#descendantPids` behandelt), tmux 3.5a.

**Frage (5) — welches Ereignis beendet den normalen Lauf ohne Controller-Polling?** Innerhalb EINER
Instanz ist die Kette gebaut und event-getrieben: die Lane filet `POST /api/self/fleet-report` →
`server.ts#openFleetReport` legt eine `FleetReport`-Zeile und ein `fleet-report`-FleetEvent an →
`server.ts#clarificationReceiverFor` waehlt die gebundene Program-MAIN (`basis:"program-main"`),
sonst den Watch-Halter, sonst die Owner-Inbox → `server.ts#tickWatches` stellt das Event per
`sendText` in die Empfaenger-Pane zu, sobald sie 60 s ruhig ist (`receiverIdleSec`), mit
beobachteter Annahme (`observed`), `subject-gone`/`receiver-gone` als terminale Fakten. Landet
irgendwer eine Program-Lane, armt `server.ts#armProgramMainLandWatch` der MAIN den `{kind:"merge"}`-
Watch selbst; `{kind:"audit"}` liefert das Stufe-2-Verdikt; die MAIN endet ihre Schleife mit GENAU
EINER `POST /api/self/attention` an den Owner. **Ueber die Hostgrenze gibt es unter Gate 2 = NEIN
kein solches Ereignis**: der Lauf auf dem Second-host endet mit einer Attention-Zeile auf dem
SECOND-HOST-Board und einem Branch, den Richtung R holt. Das einzige automatische Signal, das den
kanonischen Host erreicht, ist negativ und spaet: `fleet-sync.service` `failed` bei Ausgang 3.
Wer hier ohne Polling erfahren will, dass dort etwas fertig ist, braucht E2 = Nein — oder liest das
zweite Board. Das ist der Preis von A, ausgesprochen.

## 6. W5 — der Second-host als Git-Nabe und vollwertige zweite Instanz (Owner-Richtung 2026-09-06, W5a gemessen)

Owner 2026-09-06 06:1x/06:2x, woertlich: „was wenn wir einen Git-Server auf dem Second-host laufen
lassen wuerden?" und „second-host sollte ausserdem vollwertig aufgesetzt sein, je nachdem wie wir das
vernuenftig aufsetzen". Das ist Topologie A mit dem Second-host als Hub (Weg 1C) — und es ersetzt die
Praemisse „der Folger landet nie" durch „jeder landet, die Nabe entscheidet". Auftrag mit vier Teilen
und Kriterium je Teil: Queue-Zeile `1e7765c9` in `cd110019` (W5a Hub · W5b Land-Push · W5c Toolchain
+ Rulebook · W5d Umschalten).

**Warum zwei landende Instanzen kein Lock-Design brauchen:** ein Land endet mit `git push hub main`
ff-only; das Ref-Update im Bare-Repo ist atomar, und git lehnt Nicht-ff ab. Der abgelehnte Push ist
genau der Fall, den R2' (`server.ts#mergeJob`, bounded rebase+ff) heute lokal behandelt — W5b richtet
dieselbe Schleife gegen `hub/main`. Der Post-Land-Audit laeuft dort, wo gelandet wurde.

**W5a, gemessen 2026-09-06 06:2x (Controller Slot 6, mac):** `git init --bare --initial-branch=main`
unter `~/git/claude-fleet.git` auf dem Second-host; mac: Remote `hub` (ssh, Adresse nur in
`.git/config`), `git push hub main` → `[new branch] main -> main`; Second-host-Checkout: Remote `hub`
(lokaler Pfad) ZUSAETZLICH zu `canonical`, Timer unveraendert auf `canonical`. Kriterium erfuellt:
`git rev-parse main` (mac) = `git ls-remote hub main` (mac) = `git ls-remote hub main` (Second-host) =
`96326dad1961`; `./fleet-sync.sh hub` auf dem Second-host: `already current at 96326dad`, Exit 0.
Vorgefunden dort (Login-Shell): `bun` und `claude` vorhanden, `node`/`npm`/`codex`/`pi`/`docker`
fehlen, kein `CLAUDE.md`, kein `rulebook/` (gitignored, lebt nur auf dem mac) — das ist W5c.
16 Kerne, 7 GB RAM, 30 GB frei, Debian 13, tmux 3.5a. Ein Bare-Repo im Tailnet ist keine
Publikation; nach GitHub wird von hier weiterhin nie gepusht.

**W5c, gemessen 2026-09-06 07:3x (Controller Slot 6, mac; alles Host-Akte per ssh, kein Code):**
Node `v24.20.0` als Tarball unter `~/.local/node-v24.20.0` (kein apt, kein root — apt haette
20.19 geliefert), `npm prefix ~/.local`, `@openai/codex@0.153.4` und
`@earendil-works/pi-coding-agent@0.85.0` global — dieselben Versionen und dasselbe
`~/.local/lib/node_modules`-Layout wie auf dem mac; `bun`/`bunx` per Symlink in `~/.local/bin`, weil
`~/.bun/bin` in der Login-Shell dort NICHT im PATH liegt (der srv sah bun nur ueber den Watchdog-Export).
Kriterium 1 erfuellt: Login-Shell findet 6/6 (`node npm codex claude bun pi`). Die sieben
`rulebook/`-Fragmente per scp, `CLAUDE.md` dort gerendert: 81 293 B, byte-identisch zum mac, und der
Byte-Pin §6b ist dort GRUEN. `bun e2e/pins.ts` dort: 417 PASS, 1 FAIL — der leak-pin (287 Treffer,
`FLEET_HOST`/`FLEET_ALLOWED_HOSTS`/`FLEET_SHARE_HOSTS` gegen getrackte Dateien), das ist Notiz
`25361e42`, Owner-Wahl, kein W5c-Befund. `.env` dort: `FLEET_SUMMARY_MODEL='claude-opus-5[1m]'`.
**Offen an W5c:** Kriterium 3 (Codex-Lane erreicht den Accept-Marker) haengt am Codex-Login auf dem
Second-host — das ist das OpenAI-Konto des Owners, ein Owner-Akt; ebenso ein pi-Provider-Key dort.
`docker` bleibt draussen (Container-Pfad ist Sonderfall, opt-in).

**E8-Folge fuer W5, gemessen 2026-09-06 10:2x–10:59 (Controller Slot 5, mac):** das Vorschau-Artefakt aus
E8 (`f8babcd`: `fails[]` auf dem Vorschau-Verdikt, `artifactAt` auf jeder Quittung, Log-Upload nicht
mehr am `auditAt`) hat ZWEI Haelften, und beide muessen einzeln nachgezogen werden — der Server per
`POST /api/deploy`, der Helfer per `POST /api/helper/devices/secondhostlinux1/update`. Das Daemon-Update
ist gefahren, waehrend der Second-host auditfrei war (der Daemon startet sich beim Update neu, exit 75,
und wuerde einen laufenden Lauf toeten): Update-Zeile `state: reported`, `ok: true`, Tail
`swapped …/work/current → …/work/tree-780d2f546417`; Beweis der naechste Heartbeat 10:59:14 mit
`daemonSha 780d2f5` (vorher `40a55e40` vom 2026-09-04). Solange der Server dahinter liegt
(`codeBehind:true`), laeuft jede Lane-Vorschau weiter LOKAL auf dem 8-GB-mac — gemessen um 10:59:
ein `e2e-isolated.sh` einer Lane haelt den Mutex seit 57 min, das Server-Audit zu `f8babcd`/`c4e53f9`
wartet seit 38 min dahinter. Genau diese Schlange ist, was das Suite-Offer nach dem Deploy auf den
Second-host verlegt. Hub-Regel unveraendert: `git push hub main` von Hand nach jedem Land
(`docs/messungen/2026-09-06-mac-ssd-gesundheit.md` sagt, warum der mac entlastet gehoert).

**W5b gelandet — der Push haengt am Land, nicht mehr an der Hand (Code, keine Host-Akte; aus Lane
`fleet/260906133225-c1f9`, die Land-Sha traegt die MAIN nach).** Der letzte Satz des Absatzes darueber
ist damit ueberholt. Nach jedem Land, das `main` BEWEGT hat, pusht der Server selbst:
`server.ts#pushLandToHub`, gerufen aus `server.ts#recordLand` — dem einen Choke-Point, durch den der
saubere Auto-Land (`server.ts#mergeJob`), der Confirm-Land des Owners und die Boot-Nachholung
(`server.ts#finishLandsInFlight`) gleichermassen laufen; ein Land, das `main` nicht bewegt hat, pusht
darum strukturell nichts. Gepusht wird die GELANDETE Sha (`<sha>:refs/heads/<main>`), nicht das, worauf
`main` im Moment des Pushes zeigt — ein zweites Land haette den Ref sonst schon weitergeschoben und die
Note truege fremde Arbeit als ihre eigene. Kein `--force`: ff oder gar nicht ist die einzige
Schiedsregel, die die Nabe braucht, und sie ist die Regel des Bare-Repos, nicht die dieses Servers.
**Abwesenheit ist AUS** — ohne `FLEET_HUB_REMOTE` kein Push und KEIN `hubPush`-Feld auf der Note; ein
Feld, das „kein Hub konfiguriert" sagt, waere auf jedem Commit jedes Ein-Host-Fleets eine Messung von
nichts. Das Ergebnis steht auf der Land-Note (`server.ts#writeLandNote`; lesbar per
`git notes --ref=fleet/land show <sha>` und ueber `GET /api/slots/:id/merge`) als
`hubPush {ok:true, remote, sha}` bzw. `{ok:false, remote, reason}`, reason = git-Stderr auf 500 Zeichen.
**Ein abgelehnter Push ist ein Notenfeld, kein Fehlschlag des Lands:** `verify.ok` bleibt, was es war,
`main` bleibt gelandet, und es gibt weder Retry noch Rebase gegen den Hub — das ist W5d. Eigenes Budget
`HUB_PUSH_TIMEOUT_MS` = 60 s, ausdruecklich nicht `GIT_TIMEOUT_MS` (30 s): dieser eine git-Aufruf redet
ueber ssh mit einer anderen Maschine, wo 30 s Schweigen eine langsame Leitung sind und noch kein Urteil.
Der Preis ist benannt und begrenzt: ein haengender Hub verzoegert Note und Tier-2-Audit um hoechstens
dieses Budget und kann am Gelandeten nichts aendern. Bewiesen in `e2e/land-durability.ts` §G gegen ein
echtes Bare-Repo (`git init --bare`) und einen zweiten Klon, der es divergieren laesst — drei Checks:
„FLEET_HUB_REMOTE: a land fast-forwards the hub to the landed commit and says so on the land note" ·
„a hub that has moved on is a red hubPush field with git's own reason — the land itself still stands" ·
„with no FLEET_HUB_REMOTE the land carries NO hubPush field, and the hub is not touched". Gepinnt in
`e2e/pins.ts` unter RULE_LAND: opt-in per Env, kein `--force`, die gelandete Sha, und der Push VOR der
Note (sonst koennte die Note sein Ergebnis nicht tragen). **Eine Folge fuer W5d, benannt statt entdeckt:** die Variable gilt fleetweit, der Remote-NAME aber je Repo — ein Land in einem Checkout ohne Remote `hub` traegt dann `hubPush {ok:false, reason: "'hub' does not appear to be a git repository"}`. Das ist die ehrliche Lesart (es wurde nichts gepusht) und kein Fehlschlag des Lands; wer das nicht will, legt den Remote dort an oder laesst die Variable aus.
**Eingeschaltet ist er hier noch nicht** —
`FLEET_HUB_REMOTE` steht in keinem `.env` und auf keiner Spawn-Zeile; das Umschalten ist W5d und
Owner-Akt.

**STAND 2026-09-23 — der Satz darüber ist überholt (gemessen, Lane `fleet/260922230144-9078`).**
`FLEET_HUB_REMOTE='hub'` steht auf dem kanonischen Host seit längerem in der `.env` und ist scharf:
15 von 15 notentragenden Lands der letzten 30 `main`-Commits tragen `hubPush {ok:true}`, und
`git ls-remote hub main` = `git rev-parse main` auf beiden Hosts = derselbe Commit. Was NICHT
umgeschaltet ist, ist der zweite Host: dort steht `FLEET_LANDS='0'` (Kommentar vom 2026-09-05) und
kein `FLEET_HUB_REMOTE`, und sein `fleet-sync`-Timer ruft das Skript ohne Argument auf, zieht also
weiter von `canonical` statt von der Nabe. Zwei Branches des zweiten Hosts liegen seit 2026-09-11
unverarbeitet auf der Nabe (`second-host/leak-pin-lan-name`, `second-host/md-renderer`, beide nicht in
`main`) — der Beleg, dass der Rückweg „Branch, und die kanonische Fleet landet ihn" nicht gefahren
wird.

**W5d T1–T3 gelandet (Kriterium `29ad3230`, Owner-Bestätigung 2026-09-23 19:23:44Z; aus der Lane
`fleet/260922230144-9078`, die Land-Shas trägt die MAIN nach).** Der Satz aus W5b, ein abgelehnter
Push sei nur ein Notenfeld, gilt damit nicht mehr für den sauberen Auto-Land:

- **T1** — der Push wandert aus `server.ts#recordLand` in die R2'-Schleife von `server.ts#mergeJob`
  und **vor** `advanceIntegration`. Die Annahme der Nabe IST der Land; lokales `main` bewegt sich
  nie auf einen Commit, den die Nabe nicht hat. Eine Ablehnung sammelt `server.ts#catchUpMainToHub`
  ein (fetch + ff-only) und fällt danach in die **bestehende** gedeckelte Schleife: re-rebase,
  Gate neu, erneut anbieten. Zwei neue getypte Gründe in `lane-signals.ts#MergeErrorReason`:
  `hub-lost` (der andere Lander war schneller) und `hub-unreachable` (es wurde nichts entschieden),
  unterschieden an git's eigenem `! [rejected]`, mit `unreachable` als sicherem Default.
  `confirm-land` und die Boot-Nachholung arbitrieren NICHT und pushen weiter nachträglich.
- **T2** — `fleet-sync.sh` verliert die Folger-Exklusivität; beide Hosts ziehen von der Nabe.
  Exit 3 behält seinen Code, wechselt die Bedeutung (siehe Kopf von `docs/dual-host-git-transport.md`).
  Der kanonische Host baut im Sync NICHT (`FLEET_SYNC_BUILD_CMD=true`) — das Bundle gehört dort
  `POST /api/deploy`; ein Lauf mit nicht-default Build-Kommando behauptet kein „bundle built" mehr.
- **T3** — `ctl.sh commit main` pusht den Direkt-Commit ff-only mit. Die Annahme „Direkt-Commits
  erreichen den Hub nie" war falsch: sie erreichen ihn huckepack auf dem nächsten Land (gemessen
  2026-09-22: `b3ea7306` um 22:02 committet, 23:56 auf der Nabe — 1 h 54 min; 8 der letzten 60
  `main`-Commits sind Direkt-Commits). Der Preis war Verzug; unter zwei Landern ist der Verzug ein
  Strandungsfenster. Eine Ablehnung ist **Exit 3** mit dem Reparaturweg im Text, der Commit steht.
- **T4 — NICHT ausgeführt.** Die Host-Akte (`FLEET_LANDS=1`, `FLEET_HUB_REMOTE`,
  `FLEET_SYNC_REMOTE=hub` auf beiden, `FLEET_SYNC_BUILD_CMD=true` auf dem kanonischen) sind Owner-
  bzw. Deploy-Akte und bleiben offen, bis T1–T3 auf **beiden** Servern laufen. Reihenfolge und
  Sensoren stehen im bestätigten Kriterium; ein Flip vor dem Deploy ließe den zweiten Host mit dem
  ALTEN Code landen und erzeugte genau die Divergenz ohne Schiedsrichter, die W5d verhindert.

**Zwei Suiten gleichzeitig auf dem Second-host — der Deckel ZAEHLT jetzt, statt Last zu messen
(2026-09-06).** Die Messnotiz `docs/messungen/2026-09-06-second-host-parallel-suiten.md` nannte den
Mechanismus: der Lastdeckel des Daemons (`helper-daemon/daemon.ts#localMode`, `maxLoad1`) hat
waehrend der Messung ein DRITTES Audit geclaimt, weil load1 eine nachlaufende Zahl ist — eine Suite
liegt dort bei 0,21 im Mittel, also sieht ein Deckel von 2 zwanzig Sekunden lang eine leere
Maschine. Der Daemon hat deshalb ein Feld, das Jobs zaehlt: `maxParallelSuites`, Default 1,
gelesen von `helper-daemon/daemon.ts#freeSuiteSlots`, das der Tick VOR der Job-Liste fragt. Der
Lastdeckel bleibt als zweite Bedingung; er ersetzt das Zaehlen nie. Ueber 1 bekommt jeder Lauf
seinen EIGENEN `FLEET_SUITE_LOCK` unter seinem Run-Verzeichnis — ohne das serialisiert der Mutex in
`e2e-stage.sh` INNERHALB des Klons, und der zweite Slot waere nur ein Platz in der Warteschlange;
bei 1 bleibt der geteilte Default-Lock stehen, weil genau er eine handgestartete Suite dort gegen
die des Daemons serialisiert. Der Heartbeat traegt `running`/`maxParallelSuites`, das Board zeigt
`1/2 suite slots`, und `server.ts#helperClaim` weist ein Geraet ab, dessen EIGENER letzter
Heartbeat es voll gemeldet hat (wer beide Felder nie meldet — ein Browser auf der Portalseite,
jeder aeltere Daemon — ist unveraendert ungedeckelt). Ueber einen Neustart ueberlebt der Deckel
und der Zaehler NICHT: `running` ist ein Fakt ueber fremde Prozesse, und ein restaurierter wuerde
eine gesunde Maschine abweisen, bis der naechste Heartbeat kommt. Bewiesen in
`e2e/helper-daemon.ts` (HD.1) und (HD.10) sowie `e2e/helper-portal.ts` (K8), gepinnt in
`e2e/pins.ts` unter RULE_PAR. **Der Wert 2 fuer den Second-host ist Konfiguration auf jener Maschine
und hier nicht gesetzt**; mehr als 2 ist dort nicht gemessen, und der Land-Gate-Pfad (der den Mutex
dreimal nimmt) ebenfalls nicht.

## Was nicht gemessen wurde

- **Kein Slot auf dem Second-host** geoeffnet, nichts getippt, keine Unit angefasst — die
  Kernpraemisse „claude gruendet dort in einer Pane" bleibt ABGELEITET bis S1.
- `src/client.ts` nur per `rg` auf `instance`/`devicesSection`; die Byte-Decke `14 * 1024` in
  `e2e/tasks.ts` gelesen, nicht nachgemessen.
- Das Program-Lebenszyklus-Doc §4/§7 (Report `basis:"program"`, Program-Handoff ohne git) ist am
  Code NICHT gebaut (`rg 'basis: "program"|/api/self/handoff' server.ts` leer) — S4 rechnet mit dem
  heutigen `program-main`-Pfad und `HANDOFF.md`-Gate (`server.ts#handleSelfSucceed`).
- Die 41 tmux-Stellen sind gezaehlt, nicht einzeln gelesen; Aufwandsklassen (S/XL) sind ABGELEITET.
- Ob `docker --context` auf einen entfernten Daemon zeigen kann, bleibt wie in der Phase-0
  UNGEPRUEFT — fuer diese Vorlage ohne Folge, weil `docker` auf dem Geraet fehlt.
