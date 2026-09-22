# Der Git-Transport zwischen den beiden Fleet-Hosts

Owner-Entscheid 2026-09-05 (Weg **b**, über Controller Slot 12): **ein Host bleibt kanonisch für
alle Repos**, der zweite **zieht per git über das private Netz, fährt Sessions und Suiten und
LANDET NICHT**. Das Zielbild danach — kanonisch je REPO statt je Fleet — ist ausdrücklich eine
eigene Zeile und nicht Teil dieses Schnitts.

Diese Datei nennt **keinen Host, keine Adresse, keinen Benutzer und kein Credential**: das Repo ist
öffentlich. Dieselbe Regel, aus demselben Grund, tragen `fleet-watchdog.service` und
`helper-daemon/fleet-helper.service` in ihrem Kopf. Die realen Werte leben in der gitignorierten
`.git/config` des Folger-Checkouts und in dessen `~/.ssh` — Host-Zustand, nie getrackt.

## Die drei Richtungen, und was jede kostet

| | Richtung | Credential | Frische | Status |
|---|---|---|---|---|
| **P1** | kanonisch → Folger, über den Baum des Helfer-Daemons | keins (der Daemon hat schon gezogen) | nur so frisch wie das letzte `daemon-update` | gemessen 2026-09-05 |
| **P2** | kanonisch → Folger, direkt per ssh | **ein** Schlüssel auf dem Folger, fetch-only autorisiert | live | gemessen 2026-09-05 |
| **R** | Folger → kanonisch (die Arbeit des zweiten Hosts holen) | der schon vorhandene Verwaltungs-Schlüssel, vom kanonischen Host aus | live | gemessen 2026-09-05 |

**P1 ist der Weg ohne neue Vertrauenskante und bleibt als Rückfalltür stehen.** Der Helfer-Daemon
hält den Code ohnehin als Baum unter seinem `work/current`-Symlink (`helper-daemon/README.md`), und
ein Folger-Checkout kann daraus fetchen wie aus jedem lokalen Repo. Der Preis steht in der Tabelle:
dieser Baum bewegt sich nur, wenn ein `daemon-update`-Job gefahren wird — ein Owner-Akt. P1 ist
damit ein Transport, aber kein Auto-Link.

**P2 ist der Auto-Link, und seine Kante ist absichtlich schmal.** Der Folger bekommt ein eigenes
Schlüsselpaar (nicht den Verwaltungs-Schlüssel), und der kanonische Host autorisiert es mit
**erzwungenem Kommando**:

    restrict,command="/usr/bin/git-upload-pack 'FLEET-DIR'" ssh-ed25519 AAAA…KEY KOMMENTAR

`restrict` nimmt pty, Agent- und Port-Forwarding; `command=` ersetzt jede Anfrage des Clients durch
genau dieses eine `git-upload-pack` auf genau diesem einen Pfad. Was der Schlüssel damit **kann**,
ist `git fetch` aus einem Repo. Was er **nicht** kann, ist eine Shell, ein zweites Repo, ein Push —
`upload-pack` ist die Lesehälfte des Protokolls, `receive-pack` wird nie erreicht. Beide
Verweigerungen sind gemessen, nicht abgeleitet (§Verifikation).

Das ist der Punkt, an dem die Phase-0-Notiz ihr Owner-Gate 4 gesetzt hat
(`docs/attic/dual-host-session-runtime-phase0-2026-08-30.md` §Owner-Gates): eine zweite erreichbare
Instanz ist eine zweite Fläche. Ein fetch-only-Schlüssel ist die kleinste Fläche, mit der der
Auto-Link überhaupt existiert — er trägt den kanonischen Baum nach drüben und **nichts zurück**.

**R braucht gar nichts Neues.** Der kanonische Host hat den Verwaltungs-Schlüssel bereits in der
richtigen Richtung; er holt die Branches des zweiten Hosts, wenn er sie braucht:

    git fetch ssh://USER@SECOND-HOST/PFAD/ZUM/CHECKOUT '+refs/heads/*:refs/remotes/ZWEITHOST/*'

Damit ist auch die Frage beantwortet, wie die Arbeit des zweiten Hosts nach Hause kommt, **ohne**
dass er landet: als Branch, den der kanonische Fleet durch sein eigenes Land-Gate schickt.

## Warum der Folger fast-forwarded und nie resettet

`fleet-sync.sh` ist die Folger-Hälfte und benutzt dieselbe Primitive wie der Land-Pfad selbst
(`server.ts`, `merge --ff-only`). Ein Reset wäre bequemer und wäre falsch: er verwürfe still, was
der Folger selbst committet hat. `--ff-only` bewegt `main` nur, wenn `main` sich ausschließlich auf
der anderen Seite bewegt hat, und **verweigert laut**, sobald die beiden auseinanderlaufen. Genau
diese Verweigerung ist das Signal, das ein Mensch sehen muss: sie heißt, dieser Host hat gelandet,
und unter Weg b darf er das nicht.

Sieben Ausgänge, je mit eigenem Code, damit ein Fehlschlag als er selbst scheitert und nie als der
falsche: `0` aktuell oder fast-forwarded (Bundle vorhanden oder frisch gebaut, Deploy angenommen,
aufgeschoben oder nicht zutreffend) · `2` Fetch gescheitert · `3` auseinandergelaufen · `4`
Vorbedingung verweigert (nicht auf `main`, schmutziger Baum, unbekanntes Remote) · `5` der
Client-Build ist rot · `6` das Auflösen der Abhängigkeiten ist rot · `7` der Deploy, um den dieser
Host seine eigene Instanz gebeten hat, kam nicht zustande.

## Warum der Folger auch BAUT

`public/*.js` ist ein gitignoriertes BUILD-Artefakt. Ein Fetch trägt es nie mit, also bewegt ein
Fast-Forward `src/` und lässt das JS dahinter stehen — und ein Checkout, der geklont und nie gebaut
wurde, hat überhaupt keins. **Gemessen am 2026-09-06 04:14 am Folger-Poll:**
`bundleStale {appJsMtime:null, shareJsMtime:null, helperJsMtime:null, stale:null}`, `ls public/*.js`
dort nicht gefunden — das Board des Folgers war HTML ohne JS.

Darum baut `fleet-sync.sh` selbst, und zwar in genau zwei Fällen: **nach einem erfolgreichen
Fast-Forward**, und wenn `main` schon aktuell ist, aber eine der vier Dateien aus
`server.ts#BUNDLES` (`public/app.js`, `public/share.js`, `public/helper.js`, `public/hub.js`) fehlt. Ist der Folger
aktuell UND vollständig, läuft kein Build — sonst wäre der 15-Minuten-Timer eine Bundler-Schleife.
Das Kommando ist `${FLEET_SYNC_BUILD_CMD:-bun run build}`, dieselbe Form wie
`server.ts#DEPLOY_BUILD_CMD`.

**Nicht in `watchdog.sh`**, und das ist eine Entscheidung: denselben Watchdog booten BEIDE Hosts,
ein Build im srv-Spawn-Pfad träfe also auch den kanonischen. `fleet-sync.sh` ist das einzige, was
auf dem Folger läuft und sonst nirgends.

**`5` ist nicht `4`.** Ein `4` heißt, dass nichts passiert ist; bei `5` hat der Fast-Forward
bereits stattgefunden und **steht** — nur das Bundle dahinter nicht. Die Ausgabezeile sagt beides
(`… -> … SYNCED, then BUILD FAILED …`), damit ein Leser des Journals nicht raten muss, wo `main`
gelandet ist. Dasselbe gilt für `6` und `7`: auch dort steht der Fast-Forward, und nur das, was ihm
folgen musste, steht nicht.

## Warum der Folger auch INSTALLIERT und den eigenen srv nachzieht

**Gemessen am 2026-09-23 00:4x auf dem Second-host:** jeder Sync seit dem 2026-09-22 10:12 endete
`SYNCED, then BUILD FAILED` — ein Fast-Forward hatte `@xterm/addon-web-links` in die `package.json`
gebracht, und aufgelöst hat sie nie jemand. Das ausgelieferte `app.js` stand auf 2026-09-21 21:24,
der `srv`-Prozess auf 2026-09-20 15:13: **drei verschiedene Stände einer Instanz auf einem Board.**
Ein Fetch trägt das Manifest und das Lockfile und NICHTS, was sie auflöst — also liegt
`${FLEET_SYNC_INSTALL_CMD:-bun install --frozen-lockfile}` auf derselben Schiene wie der Build,
davor, und zwar vor BEIDEN Builds des Skripts: auch der Checkout, der noch nie gebaut hat, ist
einer, dessen `node_modules` niemand verbürgt. Ein rotes Install ist `6` und nicht `5`, und der
Build wird dann gar nicht erst versucht — wer im Journal `5` findet, sähe sonst den Bundler an
statt die Abhängigkeit.

Und ein frisches Bundle vor einem alten Prozess ist dieselbe Lüge eine Schicht höher. Darum bittet
ein **grüner Build nach einem Fast-Forward** die eigene Instanz dieses Hosts per
`POST /api/deploy` um den srv-Nachzug: Adresse wie `ctl.sh` sie auflöst (`FLEET_HOST`/`FLEET_PORT`
aus der gitignorierten `.env`, sonst `127.0.0.1:8790`), Owner-Token aus der lokalen `fleet.json`,
und das Token erreicht curls `argv` nie — es reist durch curls Config auf stdin, und keine Zeile
im Journal enthält es. Keine `fleet.json` heißt „hier läuft keine Instanz" und ist ein benannter
Skip, kein Fehler.

**Die Route, nie ein `tmux kill-session -t srv`.** Nur die Route weiß, ob ein Land reserviert, ein
Post-Land-Audit unterwegs oder eine Succession in der Luft ist (`server.ts#deployBlocker`); ein
Kill ginge an allen dreien vorbei und tötete ein laufendes Land, sobald der Folger landet. Ihr
`409` ist deshalb eine ANTWORT und kein Fehlschlag: Zeile `deploy deferred: <Grund>`, Exit `0`.

**Was das offen lässt, ausgesprochen statt angedeutet:** der Deploy beantwortet eine BEWEGUNG, kein
Ticken. Ein Lauf ohne Fast-Forward fragt nicht (sonst startete der 15-Minuten-Timer das Board
viermal pro Stunde neu), und ein roter Build fragt erst recht nicht. Nach einem aufgeschobenen
(`409`) oder gescheiterten (`7`) Deploy bleibt der srv also hinter dem Baum, **bis der nächste
Fast-Forward kommt** — bei einer stillen Flotte sind das Stunden. Der Sensor dafür gehört der
Instanz, nicht diesem Skript (`GET /api/deploys`, `bundleStale` im Poll); geschlossen ist die Lücke
nicht.

**Die Naht daemon×PATH, beide Hälften bezahlt.** Ein User-Manager vererbt systemds eigenen PATH,
und `bun` liegt in keinem Distributionspfad, sondern in `~/.bun/bin` — aus dem Timer ist
`bun run build` also ein `command not found`, das ein Terminal-Lauf nie reproduziert. Deshalb (1)
löst `fleet-sync.sh` `bun` selbst auf (`command -v bun`, sonst `$HOME/.bun/bin/bun`) und meldet ein
fehlendes `bun` als `5` im Klartext, und (2) trägt `fleet-sync.service` `%h/.bun/bin` im
`Environment=PATH=` — mit dem Grund daneben, wie der Kommentar dort ihn verlangt. Zwei Hälften,
weil nur eine von beiden durch ein Land reist: eine bereits installierte Unit ist ein Host-Artefakt
und ändert sich nicht mit dem Repo.

## Verifikation (2026-09-05, gemessen)

- **P2 direkt:** der Folger holt `main` vom kanonischen Host, `refs/remotes/<remote>/main` steht auf
  dessen Spitze; der Folger-Checkout danach auf derselben Sha und sauber.
- **Die zwei Verweigerungen des Schlüssels:** eine Shell-Anfrage (`ssh … id`) liefert statt einer
  Ausgabe von `id` das Protokoll von `upload-pack` — das erzwungene Kommando lief, nicht das
  angefragte; `git push` endet in `the remote end hung up unexpectedly`.
- **P1:** Fetch aus dem Helfer-Baum bringt `main` bis zu dessen letztem `daemon-update`.
- **R:** `git ls-remote` vom kanonischen Host auf den Checkout des zweiten liefert dessen Refs.
- **`fleet-sync.sh`, alle fünf Ausgänge** (die fünf, die es an diesem Tag gab — `6` und `7` kamen
  am 2026-09-23 dazu) gegen ein Paar Wegwerf-Repos auf dem Folger (Linux, `sh`
  ist dort **dash**): aktuell `0` · Fast-Forward `0` · schmutzig `4` · unbekanntes Remote `4` ·
  auseinandergelaufen `3` · nicht auf `main` `4`.
- **Der Build-Schritt** ist seit dem W2-Bundle-Land maschinell gehalten, nicht nur gemessen:
  `e2e/pins.ts` hält die Exit-Code-Menge `{0,2,3,4,5,6,7}` über drei Seiten deckungsgleich (was das
  Skript wirklich exit-et, seine eigene Kopfzeilen-Tabelle, die Liste im Kommentar von
  `fleet-sync.service`) und die Bundle-Liste des Skripts gegen `server.ts#BUNDLES`;
  `e2e/land-durability.ts` §F fährt das echte Skript gegen ein Wegwerf-Paar aus kanonischem Repo
  und Folger-Klon, mit Stand-ins statt `bun install`/`bun run build`: aktuell ohne Bundle → Build
  und `0` · aktuell mit Bundle → **kein** Build · Fast-Forward → Build · roter Build → `5`, `main`
  trotzdem bewegt.
- **Install und Deploy** (dieselbe Sektion, gegen eine Stand-in-Instanz auf `127.0.0.1`): ein
  Fast-Forward mit neuer Abhängigkeit installiert sie und baut DANN → `0` · rotes Install → `6`,
  und der Build läuft nicht · grüner Build → genau EIN `POST /api/deploy` mit dem Token aus der
  `fleet.json`, das in keiner Ausgabezeile steht · `409` → `deploy deferred: …` und `0` · jede
  andere Antwort → `7`, der Fast-Forward steht · roter Build und Lauf ohne Fast-Forward → gar keine
  Anfrage.

## Der systemd-Schnitt auf dem Folger (2026-09-05, gemessen)

Der Folger fährt seit diesem Schnitt **drei** Units, und sie gehören verschiedenen Ebenen an —
das ist der Grund, warum eine von ihnen Linger braucht und die andere nicht:

| Unit | Manager | Was sie ist |
|---|---|---|
| `fleet-watchdog.service` | **User** (`systemctl --user`) | die Fleet des Folgers selbst: startet `watchdog.sh`, das die `srv`-tmux-Session hält. Die Sessions, die sie spawnt, müssen dem Owner gehören und in dessen `tmux -L claudefleet` liegen — darum User und nicht System. |
| `fleet-sync.service` + `.timer` | **User** | dieser Transport: alle 15 min ein `fleet-sync.sh`, plus einmal 3 min nach dem Boot. |
| `fleet-helper.service` | **System** (`/etc/systemd/system`) | der Helfer-Daemon, der Suiten für die *kanonische* Fleet fährt. Stand vorher, wurde nicht angefasst. |

**`loginctl enable-linger` ist die Bedingung genau der ersten beiden.** Ohne Linger existiert der
User-Manager nur, solange eine Session dieses Benutzers offen ist: nach einem Reboot ohne Login
kommt keine User-Unit hoch, egal wie `enabled` sie ist. Die System-Unit des Helfers braucht das
nicht und hat es nie gebraucht — sie hängt an PID 1. Gemessen: `Linger=no` vorher, `Linger=yes`
nach `sudo loginctl enable-linger USER`.

**Der Timer läuft `fleet-sync.sh`, er wiederholt es nicht.** Die sieben Ausgänge oben sind die
ganze Semantik: alles außer `0` lässt die Unit `failed`, sichtbar in
`systemctl --user status fleet-sync` und in `systemctl --user list-timers`. Ein
`SuccessExitStatus=` dort wäre die Umkehrung dieses Schnitts — Ausgang `3` ist genau das Ereignis,
das ein Mensch sehen muss, und `6` und `7` sind die zwei, die er sonst erst am Board bemerkt.

**Was der Timer NICHT absichert, ausgesprochen statt angedeutet:** er nimmt keinen Lock, weder den
Suite-Mutex noch git. Der Baum, den er bewegt, ist der Baum, den die Sessions und Suiten des Folgers
lesen. Die Fläche ist kleiner als sie klingt — `e2e-stage.sh` kopiert den Baum einer Suite in ihr
eigenes Scratch-Verzeichnis, bevor sie läuft, also trifft ein Fast-Forward höchstens das Fenster
dieser Kopie und nie einen ganzen Lauf — aber sie ist nicht null. Deshalb steht die Periode in
Minuten, und deshalb ist ihr Verkürzen eine Entscheidung und kein Handgriff.

**Der Schlüssel wird über `HOME` gefunden, nicht über einen Agenten.** Das ist der Fehlschlag, den
dieser Schnitt aktiv ausgeschlossen hat: ein `git fetch`, das nur über ein weitergereichtes
`SSH_AUTH_SOCK` funktioniert, ist aus einem Terminal grün und aus dem Timer rot. Darum startet die
Install-Anleitung im Kopf von `fleet-sync.service` die Unit einmal von Hand — ein `systemctl --user
start` hat weder tty noch Agent.

### Verifikation

- **`.env` des Folgers**, gitignoriert, Modus 600, eigener Token, `FLEET_INSTANCE` ≠ dem des
  kanonischen Hosts; `FLEET_SHARE_HOSTS`/`FLEET_SHARE_URL` **leer**, weil auf diesem Host kein
  Tunnel terminiert. `git status --porcelain` sieht die Datei nicht.
- **`systemctl --user is-active fleet-watchdog`** → `active`, `is-enabled` → `enabled`;
  `tmux -L claudefleet has-session -t =srv` → Exit `0`.
- **`GET /api/sessions`** auf der Adresse des Folgers antwortet, `instance.name` trägt dessen
  Rollenwort. Ein dort geöffneter Slot meldet `agent: alive` — die Pane-Kette ist `bash → claude`,
  d.h. `FLEET_CMD` des Folgers löst auf.
- **`fleet-sync.service` von Hand**, ohne tty und ohne Agent: `Result=success`,
  `ExecMainStatus=0`, Journal-Zeile `fleet-sync: already current at <sha>`.
- **`fleet-sync.timer`**: `enabled` + `active (waiting)`, nächster Trigger 15 min später in
  `list-timers`. (Ein `list-timers` unmittelbar nach dem `enable` zeigt `NEXT -`; das ist das
  Rennen gegen die erste Berechnung, keine fehlende Zeitplanung — Sekunden später steht der
  Trigger da.)
- **Reboot**: siehe die Zeile darunter.

## Was dieser Schnitt NICHT tut

- **Der Timer ist da, die Gegenrichtung nicht.** Der Satz „nichts läuft automatisch" galt bis zum
  systemd-Schnitt oben und gilt jetzt nur noch für die Richtung **R**. `fleet-sync.sh` erreichte den
  Folger, wie es musste — durch einen Land und dessen Fast-Forward, nicht durch eine Handkopie: eine
  untrackte Zwillingsdatei einer getrackten hätte genau den `--ff-only` blockiert, der sie holen
  sollte.
- **Die Gegenrichtung ist manuell und bleibt es**, solange sie vom kanonischen Host aus getrieben
  wird: dessen launchd-Seite ist Host-Zustand außerhalb dieses Repos.
- **Kein Land auf dem zweiten Host — der MECHANISMUS ist seit dem S2-Schnitt (2026-09-05) der
  Env-Schalter `FLEET_LANDS`, `fleet-sync.sh` ist der Sensor dahinter.** `FLEET_LANDS=0` lässt
  beide Türen auf den Land-Pfad — die Owner-Merge-Route und `server.ts#selfLandTaskForMain` — mit
  409 `this instance does not land — it follows a canonical main` antworten, und zwar VOR jedem
  Schreibakt: kein Job, kein `mergeLast`-Verdikt, keine `lane-outcomes`-Zeile, keine Land-Note.
  Sichtbar als `lands` auf `GET /api/sessions` (einmal, neben `instance`) und auf
  `GET /api/self/gate`; das Board blendet die ⏏-Knöpfe aus, wenn `lands === false`. Der Schalter
  ist DEFAULT OFFEN und ein unerkannter Wert bleibt offen (Logzeile) — ein Tippfehler darf nie den
  kanonischen Host stranden. Was `fleet-sync.sh` weiter leistet, ist die Gegenprobe: Ausgang `3`
  (DIVERGED) misst, dass der Folger doch abgewichen ist — durch einen Land vor dem Schalter, einen
  Handgriff an `git`, oder eine Fleet, die ohne die Variable gestartet wurde.
- **Kein Push am Direkt-Commit:** der Hub bekommt `main` nur über `server.ts#pushLandToHub`, gerufen
  aus `server.ts#recordLand` — ein Direkt-Commit im Haupt-Checkout erreicht ihn erst mit dem
  NÄCHSTEN Land, bis dahin altert der Hub still. Sensor: `./state.sh`, Abschnitt hub vs local main.
