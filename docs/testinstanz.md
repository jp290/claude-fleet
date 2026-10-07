# Die Testinstanz je Worktree (`./testinstanz.sh`)

Eine Fleet-Instanz, die zu GENAU EINEM Worktree gehört: jeder Checkout leitet Port, tmux-Socket
und Verzeichnis aus seinem eigenen Pfad ab, zwei Lanes laufen deshalb nebeneinander statt sich
8862/fleetti733b zu teilen (gemessen 2026-09-24: alle Kopien antworteten mit dem Stand einer
fremden Lane). Sie läuft von selbst ab (TTL). Der Modus `snapshot` zeigt dem Owner auf Tailscale
eine bereinigte Kopie echter Daten: „[Zitat entfernt]“.

    ./testinstanz.sh up [mixed|full|snapshot] [--ttl <min>]   aufstellen, bauen, starten, Daten pflanzen
    ./testinstanz.sh fixtures [mixed|full]           neu pflanzen, ohne Neustart
    ./testinstanz.sh states                          was die Leiste JETZT malt, je Zustand
    ./testinstanz.sh status                          läuft sie, wo, Restzeit — und wer den Mutex hält
    ./testinstanz.sh list                            jede Testinstanz der Maschine, aus State-Dateien
    ./testinstanz.sh down                            Server aus, ihr tmux per Socket, Verzeichnis weg

## Die Ableitung — eine Instanz je Worktree

`cksum` über den absoluten Worktree-Pfad (POSIX, auf Mac und Workhorse dasselbe) ergibt den
kurzen Hash `<h>`; daraus werden Socket `fleetti<h>` und Verzeichnis
`/tmp/fleet-testinstanz-<h>` abgeleitet. Der Port ist `8900 + hash mod 100`; ist er belegt, wird
der nächste freie im Bereich 8900–8999 genommen. Was tatsächlich gewählt wurde, steht in der
State-Datei der Instanz (`testinstanz.state`) — dieselbe Datei ist das Maschinen-Verzeichnis für
`list` und den Abräum-Lauf. `FLEET_TI_PORT`, `FLEET_TI_SOCK`, `FLEET_TI_DIR`, `FLEET_TI_TOKEN`,
`FLEET_TI_INSTANCE(S)`, `FLEET_TI_WORKHORSE_URL` gelten unverändert weiter und schlagen die
Ableitung; ein explizit gesetzter Port wird genau genommen und bindet oder scheitert ehrlich.

Zwei `up` aus zwei verschiedenen Worktrees laufen nebeneinander; `down` in dem einen lässt den
anderen laufen, weil Socket und Verzeichnis disjunkt sind. Derselbe Worktree teilt sich eine
Instanz: das zweite `up` meldet „already up".

## Warum nicht `instanz-shot.sh`

Der Schuss-Treiber staged über `. ./e2e-stage.sh`, und **das Sourcen von `e2e-stage.sh` nimmt auf
oberster Ebene den Suite-Mutex**. Eine Minute lang ist das egal; eine STEHENDE Instanz hielte ihn,
solange der Tab offen ist, und jeder Land-Gate und jeder Post-Land-Audit dieser Maschine stünde
dahinter in der Schlange. `testinstanz.sh` staged deshalb mit `rsync` und fasst `e2e-stage.sh` nicht
an. `status` druckt `./ctl.sh lock` mit — der Beweis gehört neben die Behauptung.

## Keine Live-Werte — der Zaun in drei Schichten

Dieser Zaun gilt unverändert für `mixed` und `full`. Nur `up snapshot` öffnet ihn für den Owner
auf Tailscale: Der echte overhaul-Server liest eine bereinigte Kopie von `fleet.json` und den
letzten sieben Tagen aus `lane-outcomes.jsonl`, `post-land-audits.jsonl` und `audit.jsonl`. Ohne
echte Queue-, Programm- und Reportzeilen lässt sich die overhaul-Oberfläche nicht beurteilen.
Die Quelle ist der Haupt-Checkout, ermittelt über `git rev-parse --git-common-dir`; für eine
synthetische Probe kann `FLEET_TI_SNAPSHOT_SRC` ein anderes Verzeichnis setzen. Der Kopiervorgang
liest die Quelle nur. Zugangswerte, Shares und Helper-Geräte werden ausgelassen, Slot-Pfade
zeigen ausschließlich in die Instanz, `dispatch` und `autosOn` sind aus. Program-Bindungen werden
mitgenommen (`main` mit `slot`/`openedAt`/`boundAt`), nur die Session-Id der Bindung wird auf
`null` gesetzt — der Loader des Servers würde einen `main`-Datensatz ohne dieses Feld ganz
verwerfen und die Kopie hätte stille „unbekannt“-Bindungen, wo sie den wahren Stand trägt. Die
isolierte Kopie bleibt hinter dem eigenen Port, Socket, Verzeichnis und `env -i`.

1. **Beim Kopieren:** das rsync trägt `.env`, `fleet.json*` und `*.jsonl` nicht über — keine
   private Konfiguration, keine fremden Sessions, keine Transkripte im Klon.
2. **Beim Start:** der Instanz-Server startet hinter `env -i` und bekommt nur die acht
   `FLEET_*`-Werte, die das Skript selbst setzt. Vor dem Start schreibt das Skript deren NAMEN
   (nie Werte) in `<instanzdir>/env-names`; keiner von `FLEET_HUB_REMOTE`, `FLEET_HELPER_*`,
   `FLEET_SHARE_*` kann darin stehen, und das Skript prüft das mit einer scharfen Verweigerung,
   statt es nur anzunehmen. `LANG=en_US.UTF-8` steht zusätzlich in `env-names`, weil tmux das Tab
   unter C-Locale als `_` ausgibt.
3. **Beim Ableiten:** Port 8790, Socket `claudefleet` und ein Verzeichnis INNERHALB des Checkouts
   werden mit Namen abgewiesen (exit 2) — ein Env-Override ist genau der Weg, auf dem jemand dem
   Skript versehentlich den Live-Fleet reicht. Abräumt wird per notierter PID — aber nur bei
   Port-Identität — und `tmux -L <socket> kill-server`, nie über ein Namensmuster.

Dazu: `FLEET_CMD=true`, also wird nie ein Agent gespawnt; die Harness-CLI in den Panes ist ein
stand-in (siehe den Kopf von `testinstanz.sh`). Im Modus `snapshot` heißt der Stellvertreter
`cat`: `true` endet sofort, die Pane fällt auf die Shell zurück, und jede Zustellung stünde dort
als „command not found“ — die Instanz sähe kaputt aus. `cat` liest das tty und gibt Eingefügtes
als Text wieder, es führt nichts aus. Die State-Datei trägt den Token nicht — der
bleibt in `.testinstanz.token`, und `list` druckt die URL OHNE Token.

Von einem anderen Gerät kommt der Owner an den Link über das Board: die Testinstanz-Karte listet
jede Instanz der Maschine mit „öffnen", dahinter `openUrl` aus `GET /api/testinstanzen`, die der
Server nur auf dem Owner-Pfad (unter dem `tokenGate`) aus der `.testinstanz.token` der Instanz
liest (`server.ts#testinstanzList`) — Steward-, Self-, Share-Credential und anonym enden vorher mit
401/403 und sehen nie ein Token.

Danach schaltet der **Instanz-Chip** um, im selben Tab und ohne Token: der Live-Server hängt die
laufenden Testinstanzen aus Worktrees seines eigenen Repos (`server.ts#instanceChipLinks`, dieselbe
`testinstanzList` ohne `openUrl`, alle 10 s neu gelesen) mit `kind:"testinstanz"` an die
`instances` des Sessions-Polls, und `ti_serve` gibt jeder Instanz einen Eintrag `live` in ihre
`FLEET_INSTANCES` (Origin `http://<ti_addr>:8790`, `FLEET_TI_LIVE_URL` überschreibt), den sie als
`kind:"live"` sendet. Der Board-Client führt beide als Gruppe „Umschalter" im Chip-Menü und im
Sessions-Blatt des Handys, getrennt von den Computern (`src/client.ts#renderInstanceHead`). Ein
ausdrücklich gesetztes `FLEET_TI_INSTANCES` bleibt unverändert, ohne Rückweg. Der erste Besuch je
Gerät bleibt „öffnen": erst er setzt den Cookie der Instanz. Eine Kopie ohne `.git` (jede
Testinstanz, jedes e2e-Staging) listet keine Testinstanzen.

Was die Snapshot-Instanz über sich selbst sagt (Owner-Befund 2026-10-06): die Kopie hat kein
`.git`, ihr Boot-Head ist unlesbar — sie nennt sich in den Arbeitsorten deshalb nicht „Live“,
sondern „Testinstanz“ mit dem vor dem Kopieren gemessenen Stand (`instance.source`, dieselben
Worte wie das Band). Die eigene Kopie erscheint nicht als weiterer Arbeitsort. Helfer-Geräte
fehlen nicht still: die Gruppe steht als „in der Testinstanz nicht gemeldet“. Eine Session, deren
Program-Bindung sich nicht lesen lässt, sagt unter Rechte „Im Snapshot nicht belegt“ statt
„An keinen Auftrag, kein Program gebunden“ — eine unbekannte Bindung darf nirgends als „Keine"
erscheinen.

## Bauen, TTL, Abräumen

`up` führt **vor** dem Serverstart `bun run build` in der Kopie aus; scheitert der Build, startet
nichts und das Skript endet mit exit 1 — eine Instanz, die das Client-Bundle von gestern zeigt,
ist schlimmer als keine.

`up --ttl <min>` (Default 240) schreibt `expiresAt` in die State-Datei; `status` zeigt die
Restzeit und die URL. Der Lauf `scratch-reap.sh` (derselbe, der die e2e-Scratch-Halde besitzt,
und der die Familie DORT sucht, wohin sein Argument zeigt) beendet eine abgelaufene Instanz
per `tmux -L <socket> kill-server`, löscht ihr Verzeichnis — und signalisiert die notierte PID
NUR, wenn sie noch den Port hält, den dieselbe Datei verzeichnet (`lsof -iTCP:<port>
-sTCP:LISTEN -t`). Ein recycelter PID-Kreis ist inzwischen ein fremder Prozess; Alter und
Ablauf geben über ihn keine Autorität, der Port ist der Identitätsbeweis. Ohne Beweis wird
verschont (safe direction), und jede Entscheidung steht in einer Zeile. State-Dateien ohne
`expiresAt` (alte Instanzen) werden nur gelistet, nie beendet.

`testinstanz.sh list` liest ausschließlich State-Dateien — nie `ps` (Kommandozeilen tragen
Tokens), nie Sockets — und zeigt Worktree, Port, URL ohne Token und Restzeit.

## Die Grenzen, und sie sind namentlich verweigert

Eigener Port, eigener tmux-Socket, eigenes Verzeichnis (die State-Datei leitet der Server aus
SEINEM Verzeichnis ab — `STATE_FILE = import.meta.dir/fleet.json` —, deshalb ist die Kopie das, was
ihr eigenen Zustand gibt).

## Die vier Zustände der Leiste — welche gepflanzt werden können und welche nicht

| Zustand | wie er hier entsteht |
|---|---|
| **arbeitend** | jede frische Pane, für 5 Sekunden (`RECENT_MS`). Kommt zurück, sobald irgendwo getippt wird. |
| **ruhend** | dieselben Sessions Sekunden später — der Normalfall auf dieser Instanz |
| **schlafend** | **nicht pflanzbar.** Der Zustand liest `lastOutput`; der Server hält das im SPEICHER und schreibt es nie nach `fleet.json` (die persistierten Slot-Felder sind cwd/label/harness/model/…). Es gibt keine Datei zum Altern und keine Route zum Setzen. Er stellt sich nach 30 Minuten Ruhe von selbst ein — `./testinstanz.sh states` zeigt es, ohne den Tab zu öffnen. |
| **kaputt** | Pane-Session killen reicht NICHT: der Server heilt sie in Sekunden nach (gemessen 2026-09-20, `s6` war 9 s später zurück). Was hält: `remain-on-exit on` plus das Töten des Pane-Prozesses — tmux behält das Fenster, also sieht der Server nichts zu heilen, und `paneAgentAt` findet eine `pane_pid` ohne lebenden Prozess und antwortet `no-agent`. Genau das, was der Zustand bedeutet. |

## Zwei Dinge, die die Fixtures am Produkt gelernt haben

- **Eine Lane belegt einen Platz.** „Alle 16 belegt" plus Lanes heißt deshalb 13 Sessions + 3 Lanes;
  16 Sessions beantworten jede Lane mit `409 no free slot`.
- **Der Faltzustand des Stacks liegt im `localStorage` des BROWSERS** (`fleet.stacks`), nicht auf dem
  Server. Die Instanz kommt zugeklappt hoch; ein Klick auf das ▸ neben dem Anker klappt sie auf und
  merkt es sich. Deshalb hängen alle drei Lanes an EINEM Anker (`parent` im `POST /api/lanes`): bei
  zwei gleichzeitigen Stacks wird der Faltschlüssel generationsqualifiziert
  (`${repo}\n${slot}:${openedAt}`, `src/client.ts`), bei einem bleibt er der Repo-Pfad.

## Eine Beobachtung, die kein Befund ist, aber notiert gehört

Beim Neupflanzen auf eine laufende Instanz antwortete `POST /api/slots/1/open` mit
`400 could not prove tmux session s1 absent: tmux session s6 returned no absolute pane path` — die
tote Pane aus dem Kaputt-Fixture lässt den Absenz-Beweis für JEDEN anderen Slot scheitern. Das
Skript umgeht es, indem es vor dem Pflanzen abräumt. Ob das je außerhalb dieses Fixtures vorkommt,
ist NICHT gemessen: die tote Pane entsteht hier durch `remain-on-exit`, das Fleet selbst nicht setzt.
