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

Fünf Ausgänge, je mit eigenem Code, damit ein Fehlschlag als er selbst scheitert und nie als der
falsche: `0` aktuell oder fast-forwarded · `2` Fetch gescheitert · `3` auseinandergelaufen · `4`
Vorbedingung verweigert (nicht auf `main`, schmutziger Baum, unbekanntes Remote).

## Verifikation (2026-09-05, gemessen)

- **P2 direkt:** der Folger holt `main` vom kanonischen Host, `refs/remotes/<remote>/main` steht auf
  dessen Spitze; der Folger-Checkout danach auf derselben Sha und sauber.
- **Die zwei Verweigerungen des Schlüssels:** eine Shell-Anfrage (`ssh … id`) liefert statt einer
  Ausgabe von `id` das Protokoll von `upload-pack` — das erzwungene Kommando lief, nicht das
  angefragte; `git push` endet in `the remote end hung up unexpectedly`.
- **P1:** Fetch aus dem Helfer-Baum bringt `main` bis zu dessen letztem `daemon-update`.
- **R:** `git ls-remote` vom kanonischen Host auf den Checkout des zweiten liefert dessen Refs.
- **`fleet-sync.sh`, alle fünf Ausgänge** gegen ein Paar Wegwerf-Repos auf dem Folger (Linux, `sh`
  ist dort **dash**): aktuell `0` · Fast-Forward `0` · schmutzig `4` · unbekanntes Remote `4` ·
  auseinandergelaufen `3` · nicht auf `main` `4`.

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

**Der Timer läuft `fleet-sync.sh`, er wiederholt es nicht.** Die fünf Ausgänge oben sind die ganze
Semantik: alles außer `0` lässt die Unit `failed`, sichtbar in `systemctl --user status fleet-sync`
und in `systemctl --user list-timers`. Ein `SuccessExitStatus=` dort wäre die Umkehrung dieses
Schnitts — Ausgang `3` ist genau das Ereignis, das ein Mensch sehen muss.

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
  Env-Schalter `FLEET_LANDS`, `fleet-sync.sh` ist der Sensor dahinter.** `FLEET_LANDS=0` laesst
  beide Tueren auf den Land-Pfad — die Owner-Merge-Route und `server.ts#selfLandTaskForMain` — mit
  409 `this instance does not land — it follows a canonical main` antworten, und zwar VOR jedem
  Schreibakt: kein Job, kein `mergeLast`-Verdikt, keine `lane-outcomes`-Zeile, keine Land-Note.
  Sichtbar als `lands` auf `GET /api/sessions` (einmal, neben `instance`) und auf
  `GET /api/self/gate`; das Board blendet die ⏏-Knoepfe aus, wenn `lands === false`. Der Schalter
  ist DEFAULT OFFEN und ein unerkannter Wert bleibt offen (Logzeile) — ein Tippfehler darf nie den
  kanonischen Host stranden. Was `fleet-sync.sh` weiter leistet, ist die Gegenprobe: Ausgang `3`
  (DIVERGED) misst, dass der Folger doch abgewichen ist — durch einen Land vor dem Schalter, einen
  Handgriff an `git`, oder eine Fleet, die ohne die Variable gestartet wurde.
