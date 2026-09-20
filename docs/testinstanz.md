# Die stehende Testinstanz (`./testinstanz.sh`)

Eine Fleet-Instanz auf DIESEM Checkout, die der Owner im Browser bedient — keine Wegwerf-Instanz,
die nach dem Schuss abräumt. Sie existiert, weil die linke Leiste vor dem Land ausgiebig angesehen
werden soll und weil drei ihrer vier Zustände an einer frischen Instanz gar nicht vorkommen.

    ./testinstanz.sh up [mixed|full]        aufstellen, Fixtures pflanzen, URL drucken
    ./testinstanz.sh fixtures [mixed|full]  neu pflanzen, ohne Neustart
    ./testinstanz.sh states                 was die Leiste JETZT malt, je Zustand
    ./testinstanz.sh status                 läuft sie, wo — und wer hält den Suite-Mutex
    ./testinstanz.sh down                   Server aus, ihr tmux per Socket, Verzeichnis weg

## Warum nicht `instanz-shot.sh`

Der Schuss-Treiber staged über `. ./e2e-stage.sh`, und **das Sourcen von `e2e-stage.sh` nimmt auf
oberster Ebene den Suite-Mutex**. Eine Minute lang ist das egal; eine STEHENDE Instanz hielte ihn,
solange der Tab offen ist, und jeder Land-Gate und jeder Post-Land-Audit dieser Maschine stünde
dahinter in der Schlange. `testinstanz.sh` staged deshalb mit `rsync` und fasst `e2e-stage.sh` nicht
an. `status` druckt `./ctl.sh lock` mit — der Beweis gehört neben die Behauptung.

## Die Grenzen, und sie sind namentlich verweigert

Eigener Port, eigener tmux-Socket, eigenes Verzeichnis (die State-Datei leitet der Server aus
SEINEM Verzeichnis ab — `STATE_FILE = import.meta.dir/fleet.json` —, deshalb ist die Kopie das, was
ihr eigenen Zustand gibt), `FLEET_CMD=true`, also wird **nie ein Agent gespawnt**. Port 8790, Socket
`claudefleet` und ein Verzeichnis INNERHALB des Checkouts weist das Skript mit Namen ab, statt sie
nur zu meiden: ein Env-Override ist genau der Weg, auf dem jemand ihm versehentlich den Live-Fleet
reicht. Abgeräumt wird per `tmux -L <socket> kill-server`, nie über ein Namensmuster.

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
