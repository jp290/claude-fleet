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

## Was dieser Schnitt NICHT tut

- **Nichts läuft automatisch.** Es gibt keinen Timer und keine Unit; jeder Zug ist bis auf Weiteres
  ein Kommando. Der Timer gehört in den systemd-Schnitt (`fleet-watchdog.service`), nicht hierher —
  und er kann `fleet-sync.sh` erst aufrufen, wenn diese Datei auf dem Folger angekommen ist.
- **Die Gegenrichtung ist manuell und bleibt es**, solange sie vom kanonischen Host aus getrieben
  wird: dessen launchd-Seite ist Host-Zustand außerhalb dieses Repos.
- **Kein Land auf dem zweiten Host.** `fleet-sync.sh` erzwingt das nicht, es MISST es nur (Ausgang
  `3`). Die Regel ist der Owner-Entscheid, nicht das Skript.
