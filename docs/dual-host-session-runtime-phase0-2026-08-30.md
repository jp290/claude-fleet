---
frage: Was bindet eine Fleet-SESSION heute an die ausführende Maschine, und welche Topologie führt allgemeine Sessions/Lanes auf `second-host`, während der Mac iOS-Host bleibt?
urteil: Zweite eigenständige Fleet-Instanz auf second-host (Option A) + Client-Link B1 — der Session-Pfad ist an EINEN Prozess gebunden (ein `slots`-Array, eine `fleet.json`, ein tmux-Socket, ein PATH, kein einziger Outbound-Fetch), und das ist keine Parametrisierungslücke, sondern der Entwurf; die EINE Aussage, die A nicht erfüllt, ist der Fleet-Report ÜBER die Hostgrenze, und die ist eine Owner-Entscheidung, kein Code-Problem
bereich: [multi-host, session-runtime, identitaet, topologie]
belege: [server.ts#slotCmd, server.ts#ensureSlot, server.ts#createWorktree, server.ts#boundProgramForMain, server.ts#handleSelfSucceed, server.ts#succeedSupervisor, server.ts#expireHelperClaims, server.ts#boxFor, src/client.ts#devicesSection, e2e/tasks.ts, docs/messungen/second-host-baseline-2026-08-29.md]
nicht-gemessen: kein Zugriff auf second-host (Verbot dieser Lane); kein Lauf einer zweiten server.ts-Instanz irgendwo; src/share.ts nur per grep; Aufwandsklassen sind ABGELEITET
stand: 2026-08-30
---

# Dual-Host Session-Runtime — Phase 0 (Messung + Optionen, kein Code)

Programm „Dual-Host Fleet — Second-host Session Runtime". Phase 0 ist PLAN-ONLY. Eingabe und damit
NICHT hier nachgemessen: `docs/messungen/2026-08-27-linux-second-host-machbarkeit.md` (Portal-Naht,
§7 = die zwei Wege), `docs/geraeteverwaltung-federation-entwurf-2026-08-27.md` (Stufe A gebaut,
B1 empfohlen / B2 abgeraten), `docs/linux-second-host-programm-2026-08-28.md` (S1–S4 gelandet),
`docs/messungen/second-host-baseline-2026-08-29.md` samt Nachtrag 2026-08-30.

Was hier ohne Marke steht, ist am Baum `5262ed0` gemessen. Alles andere trägt **ABGELEITET** oder
**UNGEPRÜFT**.

## M1 — Host-Attribution heute: es gibt sie nicht, und ein Feld wäre additiv

`server.ts#Slot` (L2113–2196) hat 30+ Felder — cwd, worktree, model, harness, container,
containerContext, effort, taskId, programId, selfToken — und **kein einziges nennt eine Maschine**.
Die Projektion in `/api/sessions` (server.ts, L23048–23100) spiegelt genau diese Felder; auch dort
kein Host. `hostname: HOST` an `Bun.serve` (server.ts L22090) ist die BIND-Adresse des Servers, kein
Ausführungsort einer Session — bestätigt, kein Treffer.

Die einzige Maschinen-Fläche des Boards ist `src/client.ts#devicesSection` samt 💻-Dialog, und ihr
eigener Kommentar sagt, was sie ist: „Helper devices — the machines that take work off this box"
(src/client.ts L1616 ff., `DEVICE_ONLINE_MS = 90_000`). Ein `helperDevice` ist ein Job-Nehmer, nie
der Ausführungsort eines Slots. Jede Slot-Kachel heißt heute implizit „diese Kiste".

**Kollisionsfrage, ehrlich:** es gibt EIN Feldpaar, das schon einen Ausführungs-Ort nennt —
`container`/`containerContext`, in der Projektion über `server.ts#boxFor` gespreizt und laut
Kommentar bewusst auch im Default-Fall gesendet („which VM did I get"). Ein `host`-Feld daneben wäre
additiv, aber die beiden würden dieselbe Frage auf zwei Ebenen beantworten (Maschine vs.
docker-Daemon); wer `host` einführt, muss sagen, wie es sich zu `containerContext` verhält.

**Byte-Decke greift:** `e2e/tasks.ts` L590 prüft `bytes < 14 * 1024` bei 16 Slots, gemessen 13 033 /
13 053 B (2026-08-24) — ~1 300 B Luft. Ein Host-String PRO SLOT ist darum die teure Form; **eine
Instanz-Zeile pro Antwort** ist die billige und für Option A auch die richtige.

## M2 — Was am Session-Pfad host-lokal ist

| Kopplung | Beleg | Klasse |
|---|---|---|
| `tmux -L SOCK …`, 39 Aufrufstellen | `server.ts#tmux` L3769/3790 spawnt lokal `Bun.spawn(["tmux","-L",SOCK,…])` | (a) host-lokal per Konstruktion |
| Klassen dieser 39: Lebenszyklus (new/has/kill-session, kill-pane) · Beobachtung (capture-pane, display-message, list-sessions) · Eingabe (send-keys, load/paste/delete-buffer) · Transkript (pipe-pane) · Geometrie (resize-window) · Server (start-server, set -g) | grep über `tmux(` | alle (a) — keine nimmt ein Ziel-Host-Argument |
| Socket-Name | `SOCK = process.env.FLEET_SOCK ?? "claudefleet"` (L66) | (c) parametrisiert, aber nur INNERHALB einer Maschine |
| Worktree-Erzeugung | `server.ts#createWorktree` — `git worktree add` / `git clone --no-hardlinks` gegen lokale Pfade, `worktreePathFor(root,branch)` | (a) |
| Zustandsdatei + alle Ledger | `STATE_FILE`/`AUDIT_FILE`/`LANE_OUTCOME_FILE`/`POSTLAND_AUDIT_FILE`/`STREAM_DIR` = **`import.meta.dir`** (L76–123) | (a) — an das Verzeichnis des laufenden Servers, nicht an Port/Socket |
| Self-Credentials in der Pane | `ensureSlot` L5591: `export FLEET_SELF_TOKEN='…'; export FLEET_SELF_SLOT='…'` in den zsh-String von `tmuxNewSession` | (a) — Env ist nur beim Spawn injizierbar |
| PATH der Pane | `PATH_EXPORT` (L132) = **der PATH des Server-Prozesses**, in jede Pane gebacken | (a) — genau die Naht, an der der Daemon-PATH auf second-host zweimal gestolpert ist |
| Shell | `SHELL = process.env.SHELL ?? "/bin/sh"` (L126) | (b) parametrisierbar, aber prozessweit, nicht pro Slot |
| Agent-Kommando | `server.ts#slotCmd` / `#agentCmd`, `BASE_CMD = FLEET_CMD ?? "claude"` | (b) |
| Transkript-/Stream-Pfade | `STREAM_DIR` + `pipe-pane -o exec cat >> '<pfad>'` (L5707) | (a) |
| Ausführungs-Ort des AGENTEN | `CONTAINER_HARNESS.spawnCmd`: `docker --context '<ctx>' exec -it -w "$PWD" '<box>' …` | **(c) schon parametrisiert** — die einzige Stelle, die „wo läuft der Agent" vom „wo läuft die Pane" trennt |
| Outbound-HTTP | **keins**: der einzige `fetch(` in server.ts ist der Bun.serve-Handler (L22106) | — |

Der letzte Punkt ist der harte: der Server hat heute keinen HTTP-CLIENT. Jede Topologie, die eine
Instanz eine andere ansprechen lässt, ist neuer Code in einem Server, der so etwas nie getan hat.

## M3 — Identität über Hostgrenzen

- **Program-MAIN-Bindung:** `server.ts#boundProgramForMain` — `p.main.slot === s.id &&
  p.main.openedAt === s.openedAt`. Slot-Nummer + Öffnungszeitpunkt. `sessionId` wird laut Kommentar
  seit 2026-08-21 nur BERICHTET, nicht gegated. Beide Bestandteile sind Zahlen aus dem `slots`-Array
  GENAU DIESES Prozesses; Slot 3 auf zwei Instanzen sind zwei verschiedene Dinge mit demselben Namen.
- **Self-Token-Scope:** die Route sucht `slots.find(x => x.cwd && secretEq(given, x.selfToken))`
  (L22171) — In-Memory, prozesslokal, in `ensureSlot` frisch geprägt. Ein Token von Instanz A ist auf
  Instanz B strukturell unbekannt (401), nicht etwa schwächer gültig.
- **Wo alles liegt:** `queueStateSave` schreibt EINE Datei neben den Server (`import.meta.dir/fleet.json`)
  mit `slots, tasks, programs, fleetReports, events, watches, helperDevices, …`. Die Ledger daneben
  (`lane-outcomes.jsonl`, `post-land-audits.jsonl`, `audit.jsonl`) ebenso.
- **Folge für einen Bericht von der anderen Maschine:** `POST /api/self/fleet-report` löst seinen
  Empfänger über `clarificationReceiverFor(s)` aus dem lokalen `slots`-Array auf und stellt ihn als
  `FleetEvent` zu — Zustellung ist ein tmux-`send-keys` in die Pane des Empfängers. Ein Report, der
  auf Instanz B entsteht, kann eine MAIN auf Instanz A **heute auf keinem Pfad erreichen**; er landet
  in B's eigener Owner-Inbox. Das ist die eine Aussage des Erfolgskriteriums, die keine Topologie
  gratis mitbringt.

Beweisbar auf einer zweiten Instanz: alles, was aus ihrem eigenen Zustand folgt (Slot, openedAt,
Self-Token, Program, Task, Ledger-Zeile). **Nicht beweisbar:** jede Identität der Gegenseite — es
gibt keinen gemeinsamen Namensraum und keinen Kanal, über den einer entstünde.

## M4 — Nachfolge und Retire

`server.ts#handleSelfSucceed` und `server.ts#succeedSupervisor` teilen dieselben drei Host-Annahmen:

1. `slots.find(x => !x.cwd && !laneSpawn.has(x.id))` — ein freier Slot in DIESEM `slots`-Array
   (`MAX_SLOTS`, ein Board). Auf einer anderen Maschine gibt es diesen Vorrat nicht.
2. `openSlot(free, predecessor.cwd, null, s.model, label, s.harness, s.effort, {container, containerContext})`
   — **derselbe cwd-STRING**. Model, Harness, Effort und Box reisen als Werte mit und wären
   host-portabel; der Pfad ist es nur, wenn beide Maschinen denselben Checkout an derselben Stelle
   hätten, was sie nicht haben.
3. `handoffCommittedAfterOpen(s)` liest git im lokalen Checkout, `waitForFoundingReadiness` +
   `canDeliver` beobachten die lokale Pane.

**Trägt** über eine Hostgrenze: das Vokabular (Modell, Harness, Effort, `carry`, HANDOFF.md als
Commit). **Bricht**: die Slot-Vergabe, der cwd, die Pane-Beobachtung, das 4-s-Boot-Fenster.
ABGELEITET: eine Nachfolgerin auf der anderen Maschine ist kein Feld mehr an dieser Funktion,
sondern ein zweiter Aufruf-Adressat für sie.

## M5 — Offline / recycelter Occupant: was Helper haben und Sessions nicht

Helper-Seite, gemessen: `HELPER_CLAIM_TIMEOUT_MS` (Default 2 700 000 ms) macht den Claim **zeitlich
begrenzt**; `expireHelperClaims` bucht den Verfall, gibt Audit-Jobs an den lokalen Drain zurück und
schließt Vorschau-Jobs als `lapsed` mit Zeile im `helperLapses`-Ledger (`HELPER_LAPSE_KEEP = 20`).
`HELPER_FRESH_MS = 3 * HELPER_SWEEP_MS` (45 s) entscheidet, ob ein Gerät „da" ist;
`AUDIT_HELPER_GRACE_MS` gibt dem Portal das Vorkaufsrecht und bewaffnet bei einem Skip genau EINEN
Re-Kick-Timer. Die Fehlerrichtung ist überall benannt: „too much local work, never a tree nobody
audited". Und die Identität eines Angebots ist `slot + openedAt`, nie die nackte Slot-Id (Kommentar
in `expireHelperClaims`) — recycelte Occupants sind auf der Helper-Seite bereits gelöst.

**Die Lücke für eine SESSION, präzise:** eine Session ist kein Job mit Deadline. Es gibt für sie
(a) keinen Claim und damit keinen Verfall, (b) keinen Heartbeat und damit kein abgeleitetes
„offline" — Liveness ist `has-session` + `paneAgentAt` auf der EIGENEN Maschine, was über eine
Hostgrenze nicht fragbar ist, (c) keinen Rückfall-Drain: hinter einer Session steht niemand, der sie
übernimmt (dieselbe Ehrlichkeit, mit der `expireHelperClaims` eine lapsed Vorschau NICHT requeuet),
und (d) keinen host-übergreifenden Occupant-Begriff — `slot+openedAt` ist pro Instanz eindeutig und
über zwei Instanzen mehrdeutig. Ich erfinde hier keine Lösung; das ist die Lücke.

## M6 — Welche Sessionformen Linux-tauglich sind

`HARNESSES` (server.ts L1148) = sieben Adapter: `claude`, vier Pi-Varianten, `container`, `codex`.
Voraussetzungen aus dem Code: `claude`/`codex`/`pi` = ein Binary im PATH des SERVERS (`PATH_EXPORT`);
`container` = ein erreichbarer docker-Daemon unter dem gepinnten Kontext. `CODEX_HARNESS.comms`
enthält bewusst `node` — und dessen Kommentar nennt die arch-spezifische Vendor-Pfad-Falle
(`codex-darwin-arm64/vendor/aarch64-apple-darwin`), die genau deshalb NICHT in die Spawn-Zeile
gebacken wurde. Das ist im Code die einzige explizit arch-/macOS-adressierende Stelle des
Session-Pfads.

macOS-gebunden bleibt: `watchdog.sh` (launchd, `com.claude-fleet.watchdog`, KeepAlive; Zeilen 3/35/103)
— server.ts selbst ruft nirgends `launchctl`; und die gesamte Xcode-/Simulator-Kette
(`docs/private-repo-p-sol-research-2026-08-23.md`, kein Linux-Äquivalent).

Vom Gerät (Baseline + Nachtrag 2026-08-30, NICHT von mir nachgemessen): `node` fehlte — die Wurzel
betraf `respawnScreen`/`screenLane`, und die stehen in `e2e/programs.ts`, also eine **Test-Fixture**,
nicht der Session-Pfad; `sh` ist dash und **forkt** bei `sh -c "<ein Kommando>"`, wo bash exect —
das trifft jede Kill-Staffel und damit auch `server.ts`-Pfade, nicht nur Tests; `ast-grep` fehlt und
liegt zudem außerhalb des Daemon-PATH. Nach den Reparaturen jener Lane ist der Lauf dort nicht mehr
enthauptet. Das Gerät habe ich nicht angefasst.

## M7 — Optionsvergleich

| | A: zweite eigenständige Instanz + B1 | B: Host-Platzierung im bestehenden Server | C: entfernter docker-Kontext (`container`-Adapter) |
|---|---|---|---|
| Fällige Dateien/Symbole | `watchdog.sh` → systemd-Einheit; `src/client.ts` (Instanz-Umschalter); optional `server.ts` (Instanz-Name in `/api/sessions`) | `server.ts#tmux` (39 Stellen), `#createWorktree`, `#ensureSlot`, `#slotCmd`, `STATE_FILE`+5 Ledger, `#handleSelfSucceed`, `#succeedSupervisor`, `#boundProgramForMain`, Zustellung der `FleetEvent`s, NEUER Outbound-Client | `server.ts#boxFor` (unverändert nutzbar), `CONTAINER_HARNESS.supports` (transcript/context/automatable), `docs/container.md` |
| Neue Vertrauenskante | **keine** bei B1 (zwei Origins, je eigenes Token/Cookie; B2 wäre eine und ist abgeraten) | Mac hält Credential + Ausführungsrecht auf der Gegenseite; „reachable fleet is RCE as your user" wird transitiv | Mac spricht mit einem **entfernten docker-Daemon** — Docker-Socket-Zugriff ist Root-äquivalent auf der Gegenseite |
| Erfüllt | gründen · fortsetzen · Succession · Fleet-Report (alles je Instanz vollständig); Host = Origin | im Prinzip alles, wenn zu Ende gebaut | nichts davon vollständig |
| Erfüllt NICHT | Report ÜBER die Hostgrenze; „API/Board nennen den Host" nur als Origin, nicht als Feld; kein gemeinsamer Occupant-Begriff | heute: nichts davon existiert | Pane, git, Worktree, Ledger, Transkript bleiben auf dem Mac; `supports.transcript:false`, `context:null`, `automatable:false` ⇒ keine unbeaufsichtigten Pfade, kein Kontext-Füllstand |
| Reversibilität | hoch — Instanz abschalten, Umschalter entfernen | niedrig — greift in jede Naht des Session-Pfads | hoch — ein Feldwert pro Slot |
| Aufwandsklasse (ABGELEITET) | S (Einheit + Umschalter) | XL (Architektur-Umbau) | S für den Versuch, offen für die Mount-Frage |

**A.** `server.ts` ist bun+tmux+git ohne macOS-API; die einzige launchd-Bindung des Betriebs ist
`watchdog.sh`. Eine zweite Instanz ist deshalb heute eine Konfigurations- und Deploy-Frage, kein
Fleet-Umbau — und sie erfüllt „gründen, fortsetzen, ersetzen, berichten" auf ihrer Maschine
VOLLSTÄNDIG, weil sie denselben Code ist. Der Preis ist genau M3: zwei Namensräume. B1 macht daraus
eine UI, keine Föderation — bewusst.

**B.** Der Optionsvergleich der Machbarkeits-Notiz nannte das „Architektur-Umbau, kein Feature";
diese Messung schärft es: es sind nicht die 39 tmux-Stellen allein, sondern dass Zustand, Ledger,
Self-Token und Slot-Vergabe an `import.meta.dir` und ein In-Memory-Array gebunden sind und der
Server keinen HTTP-Client besitzt. Jede Teilmenge davon, halb gebaut, erzeugt genau das
Fehlrouting, das M5 als ungelöst ausweist.

**C.** Der `container`-Adapter trennt bereits, WO der Agent läuft, von dem, wo die Pane läuft, und
`docker --context` ist der vorgesehene Zeiger darauf. ABGELEITET (nicht gemessen): ein Kontext, der
auf einen entfernten Daemon zeigt, würde den Agentenprozess auf second-host schieben — aber
`-w "$PWD"` verlangt laut Adapter-Kommentar den Worktree am IDENTISCHEN Pfad im Container, was
über Maschinen einen Mount/Sync verlangt, den es hier nicht gibt. Und die Deklarationen des
Adapters (`transcript:false`, `context:null`, `worker:()=>null`, `automatable:false`) schließen
unbeaufsichtigte Lanes aus. C ist also eine *Agenten*-Auslagerung, keine Session-Runtime.
**Non-Goal ausdrücklich beachtet:** ich führe C NICHT über das Helper-Portal; eine Umwidmung des
Portals zur Session-Runtime wäre ein eigenes Owner-Gate (Kosten: die Zeile „the server assigns
nothing" fiele, und der Portal-Prinzipal — heute fünf Routen, unerreichbar vom Share-Perimeter —
bekäme Rechte an Panes und Land; das ist die Sicherheitsaussage der Machbarkeits-Notiz §8 auf den
Kopf gestellt).

## Empfehlung

**Option A: eine zweite eigenständige Fleet-Instanz auf second-host, verbunden über den
Client-Link B1** — sie ist die einzige, die den vollständigen Session-Lebenszyklus heute erfüllt,
ohne eine neue Vertrauenskante zu schaffen, und sie ist reversibel; die verbleibende Lücke (Report
über die Hostgrenze, M3) ist eine benannte Owner-Entscheidung statt eines halb gebauten Pfads.

**Falsifikator (ausführbar, umwerfend):** `./e2e-isolated.sh` **einmal vollständig und seriell auf
second-host**, danach `grep -c FAIL` und die Familien in `e2e/programs.ts` (Succession, Program-MAIN,
`ACP-16`) und `e2e/slots.ts` (Spawn/Delivery) prüfen. **Sind diese Familien dort rot**, dann ist die
Behauptung „dieselbe `server.ts` gründet, führt fort und ersetzt auf Linux genauso" falsch — dann ist
A nicht „heute machbar", sondern selbst ein Umbau, und der Vergleich kippt zugunsten von C oder eines
Reparatur-zuerst-Pfads. Der Test ist real offen: der letzte grüne Lauf dort lief in einem
task-eigenen Scratch-Klon mit von Hand bereitgestelltem `ast-grep`, nicht in einer Installation, wie
Option A sie voraussetzt (Baseline-Nachtrag 2026-08-30).

## Erste Schnitte (vier, je einzeln landbar)

**Schnitt 1 — Den Falsifikator fahren, bevor irgendetwas gebaut wird.**
Owner-Akt auf dem Gerät (G2). *Done:* eine Mess-Notiz unter `docs/messungen/` mit vollständigem
seriellem Lauf, Exit, PASS/FAIL, den Signaturen der genannten Familien und der Aussage
„Empfehlung A steht / fällt". *Verify:* die Notiz zitiert die Tail-Zeile des Laufs wörtlich.

**Schnitt 2 — Instanz-Identität als EIN Feld.**
`/api/sessions` trägt einmal pro Antwort `instance: { name }` (Name aus einer Env-Variablen, kein
Hostname-Leak in Prosa), und `FleetReport.provenance` merkt sich die Instanz, in der der Report
entstand. Nicht pro Slot — siehe Byte-Decke M1. *Done:* das Feld ist da, der Report trägt es, ein
alter Client ignoriert es; `e2e/tasks.ts`-Budget-Sonde weiterhin `< 14 * 1024`. *Verify:* volle
lokale Kette + `./e2e-isolated.sh` (e2e/ berührt).

**Schnitt 3 — `watchdog.sh` als systemd-Einheit, im Repo, ohne das Gerät anzufassen.**
Vorlage neben `watchdog.sh` mit demselben `VERIFY_CMD`/`AUDIT_CMD`-Vertrag; `Environment=PATH=` als
Pflichtzeile (die zweimal bezahlte Lektion). *Done:* Vorlage existiert, und `e2e/pins.ts` vergleicht
ihre Schrittkette gegen `watchdog.sh` in derselben Familie, die die Kette schon über drei Quellen
vergleicht — Drift zwischen den beiden Boot-Wegen wird damit unmöglich. *Verify:* `bun e2e/pins.ts`.

**Schnitt 4 — B1-Instanz-Umschalter im Board.**
Erst wenn Schnitt 1 grün ist und eine zweite Instanz real läuft: eine Liste `{name, url}` neben den
Geräten, ein Umschalter im Kopf, ein Klick wechselt die Origin; kein Proxy, kein geteiltes Token.
*Done:* Umschalten wechselt die Origin, jede Instanz behält Login und Token; Screenshot im Report
(Taste-Gate wie G1). *Verify:* volle Kette + `bun run build` + Demo-Repo-Typecheck.

## Owner-Gates

1. **Topologie-Entscheid A/B/C** — diese Notiz empfiehlt A, entscheidet sie nicht.
2. **Darf ein Fleet-Report eine Hostgrenze überqueren?** Die Alternative ist „jede Maschine hat ihre
   eigene MAIN und ihre eigene Inbox". Ohne diesen Entscheid ist das Erfolgskriterium
   „per Fleet-Report zurückführen" host-übergreifend nicht definiert — und jeder Code dazu wäre eine
   erfundene Antwort auf eine ungestellte Frage.
3. **Jeder Schreibakt auf second-host** (Installation, systemd, Start, Netz-Bind) bleibt Owner-Akt —
   G2 des laufenden Programms gilt unverändert weiter.
4. **Aktivierung:** eine zweite netzerreichbare Instanz ist eine zweite Fläche, für die
   „a reachable fleet is remote code execution as your user" gilt; Bind-Adresse, Token und
   Share-Perimeter (`src/share.ts`) müssen für sie eigens entschieden werden.
5. **Nur falls C je verfolgt wird:** die ausdrückliche Umwidmung des Helper-Portals zur
   Session-Runtime — mit den in M7/C benannten Kosten. Diese Notiz rät davon ab.

## Was ich nicht gemessen habe

- **second-host selbst**: kein ssh, kein Request, kein Deploy (Verbot dieser Lane). Alle Geräte-Aussagen
  in M6 sind aus der Baseline-Notiz ZITIERT, nicht nachgemessen.
- **Kein Lauf einer zweiten `server.ts`-Instanz** irgendwo — die Kernbehauptung von Option A ist
  damit ABGELEITET aus Code-Lesung, und genau darum steht der Falsifikator als Schnitt 1.
- **`src/share.ts`** nur per grep auf die Perimeter-Position, nicht gelesen; Owner-Gate 4 ist
  entsprechend eine Frage, keine Analyse.
- **Ob `docker --context` auf einen entfernten Daemon zeigen kann und was der Bind-Mount dann
  bedeutet** — UNGEPRÜFT, deshalb trägt C in M7 seine Mount-Frage offen.
- **Die 39 tmux-Aufrufstellen** habe ich klassifiziert, nicht einzeln gelesen (Klassen aus den
  Kommandonamen); **Aufwandsklassen (S/XL)** sind ABGELEITET, nicht hochgerechnet.
