---
frage: Sollen Task-Queue und Board ueberarbeitet werden, so dass sie BEIDE Geraete zeigen und miteinander kompatibel sind?
urteil: Der Schmerz aus 39857582 ist fuer die SICHT belegt (47 Lands wanderten am 22.09. an einem Folger-Board vorbei, das seit 10:12 drei Staende gleichzeitig auslieferte, und kein Feld auf dem Mac-Board haette es gesagt), fuer die QUEUE nicht; empfohlen ist Variante C, bei der der Folger seine Instanz-Gesundheit auf dem Herzschlag meldet, den er ohnehin sendet, denn Sicht-Foederation im Browser ist heute doppelt gesperrt (403 cross-origin request blocked gemessen, dazu SameSite=Strict) und eine gemeinsame Queue scheitert nicht am Transport, sondern daran, dass eine Zeile kein Host-Feld hat
bereich: [dual-host, board, queue, helper-portal, instanzen]
belege:
  - server/auth.ts#guard
  - server.ts#INSTANCE_LINKS
  - src/protocol.ts#instanceLinksFrom
  - src/client.ts#renderInstanceHead
  - src/client.ts#deviceCard
  - server.ts#helperDevicesView
  - server.ts#setHelperDevice
  - server/types.ts#helperCmdCheck
  - server/types.ts (interface Task)
  - helper-daemon/daemon.ts
  - fleet-sync.sh
  - 1370e250
  - 39857582
  - 29ad3230
nicht-gemessen: alles auf dem Second-host selbst (kein ssh, kein Login auf dessen Board) — sein HEAD, seine fleet.json, seine Slots und seine journalctl-Zeilen sind hier ZITIERT aus 1370e250, nie nachgemessen; ebenso ungemessen: Laufzeit/Byte-Kosten einer erweiterten Herzschlag-Antwort und die Git-Seite (W5d, 29ad3230)
stand: 2026-09-23
---

# Ein Board und eine Queue fuer zwei Geraete?

2026-09-23, Lane `fleet/260922231416-fed4`. Frage: **traegt die Idee „Queue und Board zeigen beide
Geraete und sind kompatibel" heute, und in welcher Form?**

Anlass, Owner 2026-09-23 ~01:1x woertlich: „Ich hatte gerade auch noch eine krasse Idee ob wir nicht
die task-queue und anzeigen-dashboard diesr, hiermit nicht auch überarbeiten sollten so das es beide
geräte anzeigt und diese so mteinander kompatibel wären".

Der stehende Entscheid `39857582` (Owner 2026-09-11) lautet „erst zwei Listen, spaeter eine — wenn es
weh tut", Ausloeser: **nachgewiesener Schmerz beim Umschalten, nicht ein Datum**. Diese Notiz misst,
ob der Schmerz jetzt belegt ist, und was die drei moeglichen Formen kosten.

**Was hier NICHT entschieden wird:** die Git-Seite. Wer landet, wie die Nabe schiedsrichtert, was aus
`DIVERGED`/Exit 3 wird und ob Direkt-Commits im Zwei-Host-Betrieb erlaubt bleiben, gehoert der
Nachbarzeile `29ad3230` (W5d, CLARIFY, live in Slot 7). Deren Kriterium stand zum Zeitpunkt dieser
Messung noch nicht (`./ctl.sh task 29ad3230`: `card none`, `report none`); diese Notiz beruehrt ihre
vier Fragen nicht und widerspricht ihnen nicht.

---

## 0 · Das Urteil in vier Saetzen

1. **Der Schmerz ist fuer die SICHT belegt, nicht fuer die QUEUE.** Am 22.09. lief das Folger-Board
   seit 10:12 auf drei verschiedenen Staenden gleichzeitig; in demselben Fenster landeten **47
   Commits** auf `main` (gemessen). Kein Feld auf dem Mac-Board haette das gesagt — der Owner fand es
   von Hand um 00:54.
2. **Die billige Form ist gesperrt.** „Der Browser liest einfach beide Instanzen" endet heute an
   `server/auth.ts#guard`: eine Anfrage mit fremdem `Origin` bekommt **HTTP 403 `cross-origin request
   blocked`** (gemessen gegen den Live-Server), und das Sitzungs-Cookie ist `SameSite=Strict`. Diese
   Variante kostet genau den CSRF-Perimeter.
3. **Die teure Form ist unveraendert teuer.** Ein Server-Proxy waere der erste ausgehende
   HTTP-Client dieses Servers (`server.ts` haelt heute **einen einzigen** `fetch(` — den
   `Bun.serve`-Handler; nachgemessen, s. §1.3) und legte das Owner-Token der einen Maschine dauerhaft
   auf der anderen ab.
4. **Es gibt eine dritte Form, und sie ist schon halb gebaut.** Der Second-host spricht bereits von
   sich aus in den Mac hinein — `POST /api/helper/device`, zuletzt 7 s vor dieser Messung, mit
   `mode`, `load`, `daemonSha`, `maxParallelSuites`, `running`. Dieser Herzschlag ist ein
   erweiterbarer Vertrag mit lautem Refusal. **Empfehlung: Variante C** (§5).

---

## 1 · Frage 1 — Was gibt es schon?

### 1.1 `FLEET_INSTANCES` ist eine Linkliste, kein Verbund (gemessen)

`src/protocol.ts#instanceLinksFrom` parst die Env zu `{name, url}[]`, verwirft jede kaputte Zeile
EINZELN mit Grund und deckelt die Liste bei `INSTANCE_LINKS_MAX_BYTES = 1024`. `server.ts#INSTANCE_LINKS`
liest sie einmal beim Boot; der Kommentar daneben sagt woertlich, was sie nicht ist:

> „WHAT THIS IS NOT … it is not federation. No proxy, no shared token, no outbound request".

Auf dem Live-Board (gemessen, `./ctl.sh get /api/sessions`):

```
"instance":  { "name": "mac" },
"instances": [ { "name": "mac",       "url": "http://$MAC:8790" },
               { "name": "second-host", "url": "http://$SECOND-HOST:8790" } ],
"lands": true
```

`src/client.ts#renderInstanceHead` macht daraus einen Chip `1/2` und ein Menue mit zwei Zeilen; ein
Klick ist `location.assign(link.url)` — **eine Navigation, kein Datenzugriff**. Die Menuezeile der
Fremdinstanz traegt als einzige Information ihre URL und den Titel „open second-host at … (its own
login)". Mehr weiss das Mac-Board ueber die zweite Instanz nicht.

### 1.2 Die `/hub`-Seite ist single-origin (gemessen)

`src/hub.ts` holt seine drei Routen mit `fetch(u, { credentials: "same-origin" })` und joint Slots,
Programme und Tasks **dieser** Instanz. `server/transport.ts:12–14` bindet `/hub` und `/hub.js` an
`public/`. Nichts darin kennt `instances`. Die Seite ist eine zweite Sicht auf EIN Fleet, nicht auf
zwei.

### 1.3 Die Praemisse „NULL ausgehende fetch-Aufrufe" haelt — nachgemessen

`39857582` behauptete es fuer 2026-09-11. Stand heute (`grep -c 'fetch(' server.ts` = 2):

| Treffer | Zeile | Was es ist |
|---|---|---|
| 1 | `server.ts:1211` | ein **Kommentar**, der genau diese Eigenschaft behauptet |
| 2 | `server.ts:35466` | `async fetch(req, server)` — der **Bun.serve-Handler**, eingehend |

Also: **null ausgehende Aufrufe**, unveraendert. Ausgehend fetchen in diesem Repo nur
`helper-daemon/daemon.ts:230` (die andere Maschine, s. §1.4) und Suiten/Werkzeuge
(`fleet-e2e-security.ts` 12, `acceptance-probe.ts` 1, `codex-quota.ts` 1, `review-sweep.ts` 1).

### 1.4 Was heute WIRKLICH zwischen den Maschinen fliesst (gemessen, live)

Ein Kanal existiert — und er laeuft in die andere Richtung als erwartet. `helper-daemon/daemon.ts`
sagt in seinem Kopf:

> „the fleet never opens a connection towards this machine. Every line below is a PULL."

Die Live-Zeile aus `/api/sessions.helperDevices` (`server.ts#helperDevicesView`), Messzeitpunkt
2026-09-23 ~01:1x:

```
id: secondhostlinux1 · name: second-host · lastSeen: 7 s alt
mode: active · load: 0.51 · capabilities: [bun, tmux, git, zsh]
desiredMode: active (desiredSet) · lapses: 5
daemonSha: 48c090506556b9b73e3416876752c0ad41baf938
maxParallelSuites: 5 · running: 2
claims: 2 × lane-suite auf claude-fleet (fleet/260922220020-cc56, fleet/260922204739-3482)
update: reported/ok → tree-48c090506556
```

Das ist der zweite Kanal. Er traegt **den Daemon**, nicht die Instanz: `daemonSha` ist der Commit des
Baums unter `/var/lib/fleet-helper/work/current`, nicht der HEAD des Fleet-Checkouts unter
`~/claude-fleet`, den `fleet-sync.sh` bewegt. Zwei Checkouts auf einer Maschine, und das Board sieht
nur den einen.

### 1.5 Es gibt bereits einen Vorentwurf, und er hat die Frage in A/B1/B2 zerlegt

`docs/attic/geraeteverwaltung-federation-entwurf-2026-08-27.md` (Status: Vorschlag, teils gebaut):

- **Stufe A** — Geraete-Register mit Heartbeat + Modus + Board-Flaeche. **Gebaut** (S1/S2; die Notiz
  traegt die Erledigt-Vermerke selbst: `server.ts#setHelperDevice`, `src/client.ts#devicesSection`).
- **B1** — Client-Link, Origin-Umschalter. **Gebaut** (das ist §1.1).
- **B2** — Server-Proxy `/remote/<device>/api/…`. **Empfehlung dort: nicht bauen**, Begruendung
  woertlich: „a reachable fleet is remote code execution as your user" gilt dann transitiv.

Ein Satz in B1 ist heute die tragende Fussnote: „der Punkt kann aus dem Stufe-A-Heartbeat kommen,
dafuer braucht es B nicht." Genau dieser Punkt wurde nie gebaut — das ist Variante C.

### 1.6 `24bff40e` und `f3ca2e05` sind Queue-ZEILEN, keine Commits

| Id | Was sie ist | Status heute (`./ctl.sh task`) |
|---|---|---|
| `24bff40e` | Buendel 3/6 Cross-Host-Dispatch, Traeger Program `f170dc46…` | `pending (notiz)`, nie dispatcht |
| `f3ca2e05` | Cross-Host-Dispatch CLARIFY, B-foermig (Mac oeffnet Lanes drueben) | `archived`, Lane `fleet/260918093916-67b3` endete **killed-empty** 2026-09-18 |
| `39857582` | der stehende Entscheid | `pending (notiz)`, kein Lane-Ausgang |
| `29ad3230` | W5d, Git-Seite | `sent`, Clarify-Lane live in Slot 7 |

`39857582` §3 sagt ueber `f3ca2e05`: „NICHT … in seiner heutigen Fassung" — und begruendet es mit dem
Preis aus §1.3. Der Entscheid steht; diese Notiz schlaegt keine Wiederaufnahme vor.

---

## 2 · Frage 2 — Sicht-Foederation, gemeinsame Queue, oder dazwischen?

### 2.1 Sicht-Foederation im Browser ist heute DOPPELT gesperrt (gemessen)

Der intuitiv billigste Weg — die Seite auf dem Mac holt `/api/sessions` von beiden Origins — scheitert
an zwei unabhaengigen Sperren:

Die beiden Origins stehen unten als `$MAC` und `$SECOND-HOST`: dieses Repo ist oeffentlich, und
die Adressen sind Host-Konfiguration, die nie getrackt wird (dieselbe Regel, die `fleet-sync.sh`
in seinem Kopf als „NO HOST, NO ADDRESS, NO CREDENTIAL" fuehrt, mechanisch gehalten von
`e2e/pins.ts` §0 — diese Notiz ist an genau dieser Zeile einmal rot gelaufen).

**(a) Der Origin-Guard.** `server/auth.ts#guard` prueft `Host` gegen `ALLOWED_HOSTS` und dann: ist ein
`Origin`-Header da, muss sein Host gleich `Host` sein, sonst 403. Gemessen gegen den Live-Mac-Server:

```
$ curl -o /dev/null -w '%{http_code}' http://$MAC:8790/api/sessions
401                                        # ohne Credential, ohne Origin
$ curl -H 'Origin: http://$SECOND-HOST:8790' http://$MAC:8790/api/sessions
403  {"error":"cross-origin request blocked"}
```

**(b) Das Cookie.** `server.ts:36616` setzt `SameSite=Strict; HttpOnly`. Ein `fetch` von einer fremden
Origin traegt es nicht mit, selbst wenn (a) faellt. Und es gibt **keinen einzigen**
`Access-Control-Allow-*`-Header im Repo (gegrept ueber `server.ts`, `server/http.ts`, `server/auth.ts`,
`server/transport.ts`: 0 Treffer).

Der Kommentarkopf von `server/auth.ts` nennt beide als das, was „between 'any website you visit' and
keystroke injection into your shells" steht. **Sicht-Foederation im Browser ist nicht billig — sie
kostet den CSRF-Perimeter.** Das ist der Befund, der die naive Form dieser Idee erledigt.

Gegenprobe zur Erreichbarkeit (damit „gesperrt" nicht mit „unerreichbar" verwechselt wird):

```
$ curl -o /dev/null -w '%{http_code} %{time_total}' http://$SECOND-HOST:8790/
200 0.151674 s                             # das zweite Board steht und antwortet
$ curl -o /dev/null -w '%{http_code}'      http://$SECOND-HOST:8790/api/sessions
401                                        # seine Daten brauchen SEIN Login
```

Netz: ja. Sicht: nein. Der Abstand zwischen diesen beiden Zeilen ist die ganze Aufgabe.

### 2.2 Eine gemeinsame Queue scheitert nicht am Transport, sondern an einem fehlenden Feld

`server/types.ts` `interface Task` (gelesen, Zeile 1221 ff.) traegt: `id`, `originId`, `programId`,
`text`, `source`, `kind`, **`repo`**, `spawn`, `variants…`, `files…`. Kein `host`, kein `instance`,
kein `device` — eine Zeile sagt WELCHES REPO, nie WELCHE MASCHINE.

Darunter liegen drei host-lokale Tatsachen (gemessen):

| Was | Wo | Warum host-lokal |
|---|---|---|
| die Wahrheit der Liste | `server.ts:183` `STATE_FILE = ${import.meta.dir}/fleet.json` | eine Datei je Checkout |
| der Treiber | `server.ts#tickDispatch` (Z. 15442), `DISPATCH_REPO` (Z. 3231) | liest nur lokale `tasks` |
| der Traeger einer Zeile | `server.ts#createWorktree` + `server.ts#ensureSlot` | tmux-Pane auf `claudefleet` DIESER Maschine plus Worktree auf DIESER Platte |

Die Deckel sind ausdruecklich host-blind: `FLEET_DISPATCH_MAX_LANES` (Default 3) und das Repo-Overlay
`repoLaneCaps` zaehlen Lanes, nicht Maschinen.

**Folgerung (abgeleitet, nicht gemessen):** „eine Queue" heisst nicht „eine Liste zeigen", sondern
drei Dinge — ein Host-Feld auf der Zeile, ein Deckel je Host, und ein Weg, auf dem eine Zeile drueben
zu einem Pane wird. Das dritte ist genau `f3ca2e05`, und das ist per `39857582` nicht zu dispatchen.

### 2.3 Das Dazwischen existiert und hat schon eine Bahn

Zwischen „Browser liest beide" und „eine Wahrheit" liegt: **die zweite Maschine erzaehlt der ersten,
wie es ihr geht** — ueber den Kanal, der schon laeuft und der die Pull-Invariante nicht anfasst
(§1.4). Das Mac-Board zeigt dann beide Geraete, ohne dass irgendwo eine Wahrheit wandert, ein Token
reist oder ein Guard faellt.

Zwei Bahnen kaemen dafuer in Frage; eine davon scheidet gemessen aus:

- **Die Kommando-Bahn ist KEIN allgemeiner Transport.** `server/types.ts#helperCmdCheck` prueft gegen
  eine geschlossene Allowlist von **sechs** Kommandos: `bun run build`, `bun test`, `bun run verify`,
  `./e2e-isolated.sh`, `./e2e-security.sh`, `bun e2e/pins.ts`. Alles andere ist 400. Ausserdem laeuft
  ein Kommando-Job im **Klon des Bundles** (`helper-daemon/daemon.ts:645`
  `runArgv(j.argv!, clone, …)`), nicht im Live-Checkout drueben — eine Gesundheitssonde saehe dort
  nichts von der laufenden Instanz. (Die Bahn ist ansonsten offen: `POST /api/self/jobs` steht jedem
  Self-Prinzipal offen, und der Live-Daemon ist neu genug — der Floor `1748417c…` ist Vorfahr von
  `48c09050…`, gemessen. Sie taugt nur fuer diese Aufgabe nicht.)
- **Der Herzschlag ist die Bahn.** `POST /api/helper/device` (`server.ts:24409`) nimmt heute sechs
  optionale Felder, prueft jedes einzeln und lehnt ein falsches LAUT ab („a daemon that reports a mode
  this fleet does not know is a version skew, and swallowing it would leave the board showing a stale
  mode forever with nothing to point at"). Ein siebtes Feld ist derselbe Handgriff, den `daemonSha`
  und das Kapazitaets-Paar schon zweimal gemacht haben.

---

## 3 · Frage 3 — „Kompatibel": was jedes Board vom anderen sehen kann

### 3.1 Was das Mac-Board HEUTE ueber den Second-host weiss (gemessen)

| Signal | Traeger heute | Gezeichnet als |
|---|---|---|
| lebt die Maschine? | `lastSeen`, abgeleitet gegen `DEVICE_ONLINE_MS = 90 s` | „● online · last beat 7 s ago" |
| Last / Kapazitaet | `load`, `running`/`maxParallelSuites` | „load 0.51 · 2/5 suite slots" |
| Version des DAEMONS | `daemonSha` | „daemon at 48c09050" — **acht Hex, kein Abstand** |
| Zuverlaessigkeit | `lapses` | „5 lapses" |
| was es gerade haelt | Join ueber `helperClaimOf`/`laneSuiteClaimOf` | zwei lane-suite-Claims |

### 3.2 Was es NICHT weiss — die vier Felder der Frage

| Gefragt | Existiert auf dem Mac-Board? | Wo es drueben lebt |
|---|---|---|
| **HEAD** der Fremdinstanz | nein | `~/claude-fleet`, bewegt von `fleet-sync.sh` |
| **bundleStale** | nein — nur der eigene (`/api/sessions.bundleStale`) | `server.ts#bundleStale` drueben |
| **deployGap** | nein — nur der eigene | `server.ts#deployGap` drueben |
| **Sync-Exit** | **nirgends, auf keinem der beiden Boards** | nur `journalctl --user -u fleet-sync` drueben |

Die vierte Zeile ist die teuerste. `fleet-sync.sh` antwortet in fuenf Exits (0 aktuell/ff · 2 fetch
· 3 DIVERGED · 4 Vorbedingung · 5 Build) und `fleet-sync.service` haelt sie ausdruecklich fuer
`systemctl status` fest — auf der Folger-Maschine. **Keine Route auf keinem Board liest sie.**

### 3.3 Der belegte Schmerz

Aus Zeile `1370e250` (ZITIERT, dort am 2026-09-23 00:4x gemessen, hier nicht nachgemessen):

> „auf dem Second-host endete JEDER Sync seit 2026-09-22 10:12 mit ‚SYNCED, then BUILD FAILED'
> (`@xterm/addon-web-links` fehlte im node_modules), der ausgelieferte app.js stand auf 2026-09-21
> 21:24, der srv-Prozess auf 2026-09-20 15:13 — der Owner sah ein Board aus drei verschiedenen
> Staenden."

Das ist genau der Exit-5-Pfad, den `fleet-sync.sh` selbst so beschreibt: „the checkout has moved and
its bundle has not". Er ist ehrlich — er sagt es, nur in ein Journal hinein, das niemand liest.

Dazu von mir gemessen, am Baum:

- **47 Commits** landeten auf `main` im Blindfenster 2026-09-22 10:12 → 2026-09-23 00:55
  (`git rev-list --count main --since … --until …`).
- Der laufende Helfer-Daemon steht auf `48c09050…` vom **2026-09-15**, das sind **430 Commits** hinter
  `main` (`git rev-list --count 48c09050…..main`) — und das Board zeichnet dafuer `daemon at 48c09050`
  ohne jede Abstandsangabe (`src/client.ts#deviceCard`, `shaLine`). Der Abstand ist am Mac
  **berechenbar** (der Sha ist Vorfahr von `main`, geprueft), er wird nur nicht berechnet.
- Zur Einordnung: der Mac selbst stand zur Messzeit sauber — `deployGap {behindCount: 0, codeBehind:
  false}`, `bundleStale {stale: false}`, `bootHead == head == 21efdfab`. Die Asymmetrie ist der
  Befund: **fuer die eigene Instanz gibt es vier Gesundheitsfelder, fuer die fremde null.**

### 3.4 Was „kompatibel" mechanisch heissen muesste

Abgeleitet, nicht gemessen: die vier Felder sind alle **auf der Maschine, auf der sie entstehen,
billig** (`git rev-parse`, vier `stat`, ein Exit-Code aus der letzten Timer-Runde) und auf der anderen
Maschine **gar nicht beschaffbar**, ohne einen der drei Perimeter zu oeffnen. Das ist die Bauform, fuer
die ein Push existiert und ein Pull nicht.

---

## 4 · Frage 4 — Wo laeuft eine Zeile, und wer dispatcht sie?

**Heute, gemessen:** eine Zeile laeuft dort, wo die `fleet.json` liegt, die sie enthaelt. Der Mac hat
202 Tasks und 73 Programme (live gelesen); der Second-host hat seine eigenen (11 Tasks / 2 Programme am
2026-09-11, `39857582` — seither nicht nachgemessen). `tickDispatch` laeuft auf beiden Maschinen ueber
die je eigene Liste. Es gibt **keine** Zeile, die beide sehen, und **keinen** Weg, eine Zeile
hinueberzureichen.

**Bei einer Sicht auf zwei Listen (Variante C) aendert sich daran nichts** — und das ist die Antwort,
nicht ein Mangel: eine Sicht, die nur ZEIGT, hat keinen Dispatch-Pfad noetig. Der Owner sieht zwei
Listen nebeneinander, klickt auf eine Zeile der Fremdliste und landet per Origin-Wechsel auf deren
Board, wo sein dortiges Login gilt. Das ist die heutige Semantik des Umschalters, nur mit Inhalt.

**Bei einer gemeinsamen Liste** muessten drei Dinge entschieden sein, von denen keines heute ein
Traeger hat (abgeleitet aus §2.2):

1. **Wer besitzt die Zeile?** Zwei `fleet.json` ohne gemeinsamen Schreiber heisst: entweder eine ist
   die Wahrheit und die andere ein Spiegel (dann ist der Spiegel bei Ausfall der Wahrheit blind), oder
   beide schreiben (dann braucht es eine Konfliktregel, die es nirgends gibt).
2. **Wer haelt den Deckel?** `FLEET_DISPATCH_MAX_LANES` zaehlt Lanes, nicht Hosts. Zwei Instanzen mit
   je 3 Lanes auf demselben Repo sind heute 6 gleichzeitige Lanes auf einem `main` — und der
   Suite-Mutex ist eine Verzeichnis-Mutex in LOKALEM `/tmp`, also zwei Mutexe.
3. **Wer entscheidet, wo sie laeuft?** Owner je Zeile, Deckel je Host, oder Lastregel — das sind Q4
   aus `f3ca2e05`, unbeantwortet, und die Zeile ist archiviert.

Punkt 1 und 2 beruehren die Git-Seite und gehoeren damit teilweise `29ad3230` (W5d). Diese Notiz
stellt sie fest und entscheidet sie nicht.

---

## 5 · Drei Varianten im selben Raster

| | **A · Browser liest beide** | **B · Eine Wahrheit (Server-Proxy)** | **C · Der Folger meldet sich** ✅ |
|---|---|---|---|
| **Was der Owner sieht** | ein Board, in dem Slots/Zeilen beider Hosts nebeneinander stehen, aus zwei Quellen im Client gemischt | ein Board, eine Liste, ein Login; die Herkunft einer Zeile ist ein Feld | sein heutiges Board plus eine zweite **Instanz-Karte** neben den helper devices: Name, HEAD + Abstand zu `main`, bundleStale, deployGap, letzter Sync-Exit, Alter — und der `1/2`-Chip bekommt einen Zustandspunkt statt nur einer Zahl |
| **Was sich am Server aendert** | `guard()` muss fremde Origins zulassen **und** eine CORS-Schicht bekommen **und** das Cookie von `SameSite=Strict` weg — drei Lockerungen an einem Perimeter | erster **ausgehender** HTTP-Client in `server.ts` (heute: 0), plus Token-Haltung der Gegenseite, plus Fehler-/Timeout-Semantik fuer jede geproxyte Route | **nichts am Perimeter.** Ein siebtes optionales Feld auf `POST /api/helper/device` (`setHelperDevice`, gleicher Validierungs-Handgriff wie `daemonSha`), eine Erweiterung von `helperDevicesView`, eine Karte in `src/client.ts` |
| **Was an der Queue** | nichts — zwei Listen bleiben zwei Listen, sie werden nur nebeneinander gemalt | eine Liste; `Task` braucht ein Host-Feld, `tickDispatch` einen Host-Deckel, `createWorktree` einen Fernweg (= `f3ca2e05`, nicht zu dispatchen) | **nichts.** Der stehende Entscheid „zwei Listen" bleibt unberuehrt; die Sicht wird kompatibel, die Wahrheit bleibt geteilt |
| **Preis in Code-Flaeche** | klein im Client, **teuer im Sicherheitsmodell**: `server/auth.ts#guard` ist der einzige Schutz gegen „jede Website, die du besuchst" (sein eigener Kommentar). Kein Pin, kein e2e und keine Doku deckt heute ein gelockertes Modell ab | gross: der Vorentwurf von 2026-08-27 §3 empfiehlt ausdruecklich **nicht bauen**; „a reachable fleet is remote code execution as your user" gilt dann transitiv — wer den Mac hat, hat beide | **gemessen an einem Praezedenzfall**: das Kapazitaets-Paar (`84c16f20`, zwei Herzschlag-Felder) kostete 62 Zeilen `server.ts`, 9 Zeilen `src/client.ts`, 138 `helper-daemon/daemon.ts`, 56 `e2e/pins.ts`, ~310 e2e — 580 Insertions in 9 Dateien. Dazu neu: ein Konfig-Feld im Daemon, das auf den FLEET-Checkout zeigt (`config.example.json` hat heute nur `workDir`/`checkoutLink`) |
| **Bei Ausfall EINES Hosts** | der Client sieht die tote Haelfte als Fetch-Fehler; die lebende Haelfte arbeitet weiter. **Kein Datenverlust, aber der Perimeter bleibt gelockert, auch wenn nie wieder ein zweiter Host existiert** | faellt der Proxy-Host, ist das andere Board nur noch direkt erreichbar und die gemeinsame Liste ist weg. Ein Ausfall, zwei Maschinen | **exakt wie heute**: der Herzschlag hoert auf, `lastSeen` altert, die Karte sagt „○ offline · last beat 4 min ago". Kein Zustand geht verloren, weil nie einer wanderte. Der tote Host degradiert genau so, wie der Helfer heute degradiert (Claim-Verfall, Lapse-Ledger) |

### 5.1 Warum C

1. **Es ist die einzige Variante, die den belegten Schmerz trifft und nur ihn.** Der Schmerz von
   §3.3 ist „ich sehe nicht, dass das andere Board kaputt ist" — nicht „ich kann von hier keine Zeile
   drueben starten". A und B loesen Probleme, die der Owner nicht hatte, und zahlen dafuer an einem
   Perimeter.
2. **Sie verletzt keine Invariante.** Die Pull-Richtung („this server never opens a connection to the
   other machine", `server.ts:21392`) bleibt woertlich stehen; der Folger redet, der Mac hoert zu.
   `guard()` bleibt unveraendert, das Cookie bleibt `SameSite=Strict`, `fetch(`-Zahl in `server.ts`
   bleibt 1.
3. **Sie hat einen gebauten Praezedenzfall und eine gemessene Preisspanne** (§5, Zeile
   „Preis in Code-Flaeche") statt einer Schaetzung.
4. **Sie ist mit `39857582` vertraeglich, ohne ihn zu beugen.** Der Entscheid sagt „erst zwei Listen"
   — C aendert an den zwei Listen nichts. Er sagt „spaeter eine, wenn es weh tut" — C macht das
   Wehtun zum ersten Mal SICHTBAR und damit messbar. Wer spaeter ueber eine Liste entscheidet, hat
   dann Zahlen statt eines Eindrucks.
5. **Sie steht der Git-Seite nicht im Weg.** Wenn W5d (`29ad3230`) zu „beide landen, die Nabe
   schiedsrichtert" fuehrt, ist ein Feld „letzter Sync-Exit / DIVERGED" auf der Instanz-Karte genau
   das Instrument, das dieser Betrieb braucht — C wird durch W5d wertvoller, nie widersprochen.

**Die Schnittlinie.** Unter C faellt ausdruecklich: kein gemeinsamer Task-Store, keine Zeile, die
drueben startet, kein Feld `Task.host`, keine Lockerung an `guard()`. Wer das will, braucht einen
neuen Owner-Entscheid gegen `39857582` — nicht eine Karte.

---

## 6 · Kartenentwuerfe fuer Variante C (die MAIN filet, nicht diese Lane)

Vier Zeilen, in Reihenfolge. K1 und K2 sind das Minimum, das den Schmerz von §3.3 abstellt; K3 und K4
sind die Ausbaustufe und koennen entfallen, ohne dass K1/K2 unvollstaendig werden.

### K1 — Der Folger misst seine eigene Instanz und haengt sie an den Herzschlag

```
[DUAL-HOST · C1 · INSTANZ-GESUNDHEIT AUF DEM HERZSCHLAG · gefilet <datum> von <main>]
ROLLE: pi-zai/glm-5.3-flash/high
GROESSE: mittel
FLAECHE: helper-daemon/daemon.ts, helper-daemon/config.example.json, helper-daemon/README.md,
         server.ts (setHelperDevice, HelperDevice, HelperHeartbeat, helperDevicesView),
         e2e/helper-portal.ts, e2e/helper-daemon.ts
VERIFY: install, pins, e2e-isolated
DONE: `POST /api/helper/device` nimmt EIN weiteres optionales Objekt `instance`
  {head: 40 hex, bundleStale: bool, behindCount: int>=0, syncExit: int 0..5, at: int} — jedes Feld
  einzeln validiert und bei falscher Form mit 400 und Namen abgelehnt (derselbe Handgriff wie
  `daemonSha`); Abwesenheit ist "nie gesagt" und aendert nichts. Der Daemon liest die Werte aus
  einem NEUEN Konfig-Feld `instanceDir` (absent = Feld wird nicht gesendet, kein Fehler) per
  `git rev-parse HEAD` und `stat` auf public/*.js, `syncExit` aus einer Datei, die K2 schreibt.
  `helperDevicesView` reicht das Objekt unveraendert durch. e2e belegt: (a) ein Heartbeat ohne
  `instance` laesst die Zeile byte-gleich, (b) jede der fuenf Falschformen ist ein 400 mit dem
  Feldnamen darin, (c) die Zeile ueberlebt einen Neustart mitten im Lauf. install, pins gruen,
  e2e-isolated ALL PASS.
VERBOTEN: ausgehender fetch in server.ts · irgendeine Aenderung an server/auth.ts#guard oder am
  Cookie · den Daemon in den fremden Checkout SCHREIBEN lassen (er liest, mehr nicht) ·
  `instanceDir` mit einem Default belegen (ein Default zeigt auf einen Baum, den es nicht gibt)
```

### K2 — `fleet-sync.sh` hinterlaesst seinen Exit dort, wo der Daemon ihn findet

```
[DUAL-HOST · C2 · SYNC-EXIT WIRD ABLESBAR · gefilet <datum> von <main>]
ROLLE: pi-zai/glm-5.3-flash/high
GROESSE: klein
FLAECHE: fleet-sync.sh, e2e/land-durability.ts
VERIFY: install, pins, e2e-isolated
DONE: fleet-sync.sh schreibt am Ende JEDES Laufs — auch bei 2/3/4/5 — eine Zeile
  `{"at":<ms>,"exit":<n>,"head":"<40hex>"}` nach `.fleet-sync-status.json` im Checkout (gitignored,
  atomar ueber tmp+rename), und zwar OHNE seinen eigenen Exit-Code zu veraendern. e2e belegt je
  einen Lauf mit Exit 0 und Exit 5, dass die Datei danach den richtigen Code traegt und der
  Prozess-Exit unveraendert ist. install, pins gruen, e2e-isolated ALL PASS.
VERBOTEN: die Sync-Quelle oder die DIVERGED-Semantik anfassen (das ist W5d, Zeile 29ad3230) ·
  die Datei tracken · watchdog.sh anfassen
```

### K3 — Das Board zeichnet die zweite Instanz als Instanz, nicht als Daemon

```
[DUAL-HOST · C3 · INSTANZ-KARTE UND ZUSTANDSPUNKT AM 1/2-CHIP · gefilet <datum> von <main>]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: src/client.ts (deviceCard, renderInstanceHead, devicesSection), e2e/pins.ts
VERIFY: install, pins, e2e-isolated
DONE: Wo eine Geraetezeile ein `instance`-Objekt traegt, zeichnet deviceCard zusaetzlich: HEAD als
  8 Hex MIT Abstand zu unserem main in Commits (die Zahl wird SERVERSEITIG gejoint, der Client
  rechnet nichts), "bundle aktuell/veraltet", und den letzten Sync-Exit im Klartext (0 aktuell,
  2 fetch, 3 DIVERGED, 4 Vorbedingung, 5 Build). Fehlt das Objekt, fehlt die Flaeche ganz —
  dieselbe Regel wie bei wakeConfigured. Der `1/2`-Chip (renderInstanceHead) bekommt einen
  Zustandspunkt, der GENAU DREI Zustaende kennt: gesund · gemeldet-krank · nichts gemeldet; der
  dritte ist der Default und sieht aus wie heute. Jeder gezeichnete Wert traegt sein Alter daneben,
  damit kein Zustand eine nackte Behauptung ist (Regel aus deviceCard). e2e/pins.ts pinnt, dass
  der Chip weiterhin GENAU EINE Navigation kennt. install, pins gruen, e2e-isolated ALL PASS.
VERBOTEN: der Client darf keine zweite Origin abfragen · keine Ampelfarbe ohne Zahl daneben ·
  "offline" nicht aus einem fehlenden `instance`-Objekt ableiten (das ist "nie gesagt")
```

### K4 — Der Abstand wird ein Signal, nicht nur eine Zahl

```
[DUAL-HOST · C4 · DER VERSIONSABSTAND MELDET SICH · gefilet <datum> von <main>]
ROLLE: pi-zai/glm-5.3-flash/high
GROESSE: klein
FLAECHE: server.ts (attention-/errors-Naht), e2e/helper-portal.ts
VERIFY: install, pins, e2e-isolated
DONE: Meldet eine Fremdinstanz zweimal in Folge denselben Sync-Exit != 0, ODER liegt ihr HEAD mehr
  als N Commits hinter unserem main (N als Env mit gemessenem Default), erscheint EIN Eintrag in der
  bestehenden Aufmerksamkeits-Flaeche mit Instanzname, Exit bzw. Abstand und dem Alter der Meldung.
  Er verschwindet von selbst, sobald eine gesunde Meldung eintrifft, und er wiederholt sich nicht.
  e2e belegt: zwei kranke Beats erzeugen genau EINEN Eintrag, der dritte keinen weiteren, ein
  gesunder Beat raeumt ihn ab. install, pins gruen, e2e-isolated ALL PASS.
VERBOTEN: eine Aktion an den Eintrag haengen (kein Knopf, der drueben etwas tut) · den Schwellwert
  N ohne Messung setzen · den Eintrag aus AUSBLEIBENDEN Beats erzeugen (dafuer gibt es lastSeen)
```

---

## 7 · Methode

Alles unten ist aus diesem Worktree (`fleet/260922231416-fed4`, HEAD `21efdfab`) und dem LIVE-Board
gelesen; nichts wurde auf dem Second-host ausgefuehrt.

```sh
# Frage 1 — was existiert
grep -c 'fetch(' server.ts                      # 2: ein Kommentar + der Bun.serve-Handler
rg -n instanceLinksFrom                          # src/protocol.ts#instanceLinksFrom, server.ts:1217
sed -n '152,182p' src/client.ts                  # renderInstanceHead: location.assign, sonst nichts
grep -n 'hub' server/transport.ts                # /hub, /hub.js -> public/, same-origin

# Frage 2 — die beiden Sperren, gegen den LIVE-Server gemessen
curl -s -o /dev/null -w '%{http_code}\n' http://$MAC:8790/api/sessions            # 401
curl -s -w '%{http_code}\n' -H 'Origin: http://$SECOND-HOST:8790' \
     http://$MAC:8790/api/sessions                                                # 403
grep -n 'SameSite' server.ts                                                              # :36616 Strict
grep -rn 'Access-Control-Allow' server.ts server/                                         # 0 Treffer
curl -s -o /dev/null -w '%{http_code} %{time_total}\n' http://$SECOND-HOST:8790/          # 200 0.151674
curl -s -o /dev/null -w '%{http_code}\n'              http://$SECOND-HOST:8790/api/sessions # 401

# Frage 3 — was das Board weiss, und der Abstand
./ctl.sh get /api/sessions --json | bun -e '…'   # helperDevices, deployGap, bundleStale, instances
git merge-base --is-ancestor 48c090506556b9b73e3416876752c0ad41baf938 main && echo ancestor
git rev-list --count 48c090506556b9b73e3416876752c0ad41baf938..main                       # 430
git rev-list --count main --since='2026-09-22 10:12' --until='2026-09-23 00:55'           # 47

# Frage 4 / Preis
sed -n '1221,1290p' server/types.ts              # interface Task: kein host/instance/device
grep -n 'STATE_FILE =\|DISPATCH_REPO =' server.ts
sed -n '<HELPER_CMD_ALLOW>,+20p' server/types.ts # sechs erlaubte Kommandos
c=$(git log -S'maxParallelSuites' --format='%H' -- server.ts | tail -1); git show --stat $c
```

Gegenprobe zur Aktualitaet: der `main` dieses Worktrees (`21efdfab`) ist identisch mit
`deployGap.head` des laufenden Servers — die Baum-Messungen und die Live-Messungen reden ueber
denselben Stand.

---

## 8 · Was nicht gemessen wurde

- **Alles auf dem Second-host.** Kein ssh, kein Login auf seinem Board. Sein HEAD, seine `fleet.json`,
  seine Slots, seine `journalctl`-Zeilen und die heutige Fassung seiner `.env` sind hier entweder
  ZITIERT (`1370e250`, `39857582`) oder als unbekannt markiert. Die beiden `curl`-Aufrufe gegen die Second-host-Origin waren unauthentifiziert und
  read-only.
- **Der Preis von C in Laufzeit und Bytes.** Wie viele Bytes ein `instance`-Objekt am Herzschlag
  kostet und ob es unter die Byte-Decke von `docs/data-saver.md` faellt, ist nicht gerechnet. Die
  580-Insertions-Zahl ist der Praezedenzfall `84c16f20`, keine Schaetzung fuer diese Arbeit.
- **Ob `N` in K4 einen sinnvollen Default hat.** Die Karte verlangt ausdruecklich eine Messung.
- **Die Git-Seite.** Land gegen `hub/main`, `DIVERGED`, Direkt-Commits, Umschaltreihenfolge — das ist
  `29ad3230` (W5d), deren Kriterium zum Messzeitpunkt noch nicht stand.
- **Ob der Owner die Sicht oder die Queue meinte.** Sein Satz nennt beides. Diese Notiz beantwortet
  beides getrennt und empfiehlt nur die Haelfte, fuer die ein Schmerz belegt ist.
- **Variante D — die Nabe traegt die Queue** (beide Hosts lesen/schreiben Queue-Zeilen als Dateien im
  gemeinsamen Bare-Repo). Erwogen und aus der Rangliste geschnitten, bevor sie vermessen wurde: sie
  braucht dieselben drei fehlenden Stuecke wie B (Host-Feld, Host-Deckel, Fernweg zum Pane) und
  zusaetzlich eine Konfliktregel auf Dateiebene. Nicht gemessen, nicht empfohlen.

---

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-22T23:05:00Z	verankern	zuerst die vier Zeilen lesen (39857582, 24bff40e, f3ca2e05, 29ad3230), dann Code	die Frage ist eine Wiederaufnahme, kein Neuland — der stehende Entscheid setzt das Kriterium	./ctl.sh task --full	24bff40e/f3ca2e05 sind ZEILEN, keine Commits; Praemisse "null fetch" nachzumessen
2026-09-22T23:12:00Z	messen	die "null ausgehende fetch"-Praemisse von 2026-09-11 nachrechnen statt zitieren	eine Praemisse aus einer anderen Messung ist ein Anspruch, kein Fakt	grep -c 'fetch(' server.ts	haelt: 2 Treffer, beide nicht ausgehend
2026-09-22T23:18:00Z	messen	die billige Variante EMPIRISCH gegen den Live-Server pruefen, nicht aus dem Code ableiten	ein Guard, den man nur liest, koennte eine Ausnahme haben	curl -H 'Origin: …'	403 cross-origin request blocked — A ist gesperrt, nicht nur teuer
2026-09-22T23:24:00Z	schneiden	die Kommando-Bahn als Transport fuer eine Gesundheitssonde verwerfen	Allowlist mit sechs Kommandos, und der Job laeuft im Bundle-Klon, nicht im Live-Checkout	server/types.ts#helperCmdCheck, daemon.ts:645	verworfen; der Herzschlag bleibt die einzige Bahn
2026-09-22T23:31:00Z	messen	den Schmerz quantifizieren statt ihn aus 1370e250 zu uebernehmen	"der Owner sah ein altes Board" ist kein Mass	git rev-list --count main --since … --until …	47 Commits im Blindfenster; Daemon 430 hinter main
2026-09-22T23:38:00Z	preis	die Preisspanne fuer C an einem GEBAUTEN Praezedenzfall messen, nicht schaetzen	eine geschaetzte Codeflaeche ist eine Meinung	git show --stat 84c16f20	580 Insertions / 9 Dateien fuer zwei Herzschlag-Felder
2026-09-22T23:44:00Z	schneiden	Variante D (Queue in der Nabe) aus der Rangliste nehmen, bevor sie vermessen wird	sie braucht dieselben drei fehlenden Stuecke wie B plus eine Konfliktregel — drei Varianten reichen fuer die gestellte Frage	docs/scope-inflation.md §7	als geschnitten benannt in §8, nicht als Variante gefuehrt
2026-09-22T23:52:00Z	abgrenzen	die Queue-Haelfte NICHT empfehlen, obwohl der Owner-Satz sie nennt	der Ausloeser aus 39857582 ist belegter Schmerz, und der ist fuer die Sicht belegt, fuer die Queue nicht	39857582, §2.2	Empfehlung C; Queue-Haelfte als "braucht neuen Owner-Entscheid" benannt
```
