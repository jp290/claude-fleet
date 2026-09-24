# Die Testinstanz je Worktree (`./testinstanz.sh`)

Eine Fleet-Instanz, die zu GENAU EINEM Worktree gehört: jeder Checkout leitet Port, tmux-Socket
und Verzeichnis aus seinem eigenen Pfad ab, zwei Lanes laufen deshalb nebeneinander statt sich
8862/fleetti733b zu teilen (gemessen 2026-09-24: alle Kopien antworteten mit dem Stand einer
fremden Lane). Sie läuft von selbst ab (TTL), und sie trägt keine Live-Werte.

    ./testinstanz.sh up [mixed|full] [--ttl <min>]   aufstellen, bauen, starten, Fixtures pflanzen
    ./testinstanz.sh fixtures [mixed|full]           neu pflanzen, ohne Neustart
    ./testinstanz.sh states                          was die Leiste JETZT malt, je Zustand
    ./testinstanz.sh status                          läuft sie, wo, Restzeit — und wer den Mutex hält
    ./testinstanz.sh list                            jede Testinstanz der Maschine, aus State-Dateien
    ./testinstanz.sh down                            Server aus, ihr tmux per Socket, Verzeichnis weg

## Die Ableitung — eine Instanz je Worktree

`cksum` über den absoluten Worktree-Pfad (POSIX, auf Mac und Second-host dasselbe) ergibt den
kurzen Hash `<h>`; daraus werden Socket `fleetti<h>` und Verzeichnis
`/tmp/fleet-testinstanz-<h>` abgeleitet. Der Port ist `8900 + hash mod 100`; ist er belegt, wird
der nächste freie im Bereich 8900–8999 genommen. Was tatsächlich gewählt wurde, steht in der
State-Datei der Instanz (`testinstanz.state`) — dieselbe Datei ist das Maschinen-Verzeichnis für
`list` und den Abräum-Lauf. `FLEET_TI_PORT`, `FLEET_TI_SOCK`, `FLEET_TI_DIR`, `FLEET_TI_TOKEN`,
`FLEET_TI_INSTANCE(S)`, `FLEET_TI_SECOND-HOST_URL` gelten unverändert weiter und schlagen die
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

1. **Beim Kopieren:** das rsync trägt `.env`, `fleet.json*` und `*.jsonl` nicht über — keine
   private Konfiguration, keine fremden Sessions, keine Transkripte im Klon.
2. **Beim Start:** der Instanz-Server startet hinter `env -i` und bekommt nur die acht
   `FLEET_*`-Werte, die das Skript selbst setzt. Vor dem Start schreibt das Skript deren NAMEN
   (nie Werte) in `<instanzdir>/env-names`; keiner von `FLEET_HUB_REMOTE`, `FLEET_HELPER_*`,
   `FLEET_SHARE_*` kann darin stehen, und das Skript prüft das mit einer scharfen Verweigerung,
   statt es nur anzunehmen.
3. **Beim Ableiten:** Port 8790, Socket `claudefleet` und ein Verzeichnis INNERHALB des Checkouts
   werden mit Namen abgewiesen (exit 2) — ein Env-Override ist genau der Weg, auf dem jemand dem
   Skript versehentlich den Live-Fleet reicht. Abräumt wird per notierter PID — aber nur bei
   Port-Identität — und `tmux -L <socket> kill-server`, nie über ein Namensmuster.

Dazu: `FLEET_CMD=true`, also wird nie ein Agent gespawnt; die Harness-CLI in den Panes ist ein
stand-in (siehe den Kopf von `testinstanz.sh`). Die State-Datei trägt den Token nicht — der
bleibt in `.testinstanz.token`, und `list` druckt die URL OHNE Token.

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
