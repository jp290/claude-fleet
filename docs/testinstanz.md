# Die Testinstanz je Worktree (`./testinstanz.sh`)

Eine Fleet-Instanz, die zu GENAU EINEM Worktree gehört: jeder Checkout leitet Port, tmux-Socket
und Verzeichnis aus seinem eigenen Pfad ab, zwei Lanes laufen deshalb nebeneinander statt sich
8862/fleetti733b zu teilen (gemessen 2026-09-24: alle Kopien antworteten mit dem Stand einer
fremden Lane). Sie läuft von selbst ab (TTL). Der Modus `snapshot` zeigt dem Owner auf Tailscale
eine bereinigte Kopie echter Daten: „[Zitat entfernt]“.

    ./testinstanz.sh up [mixed|full|snapshot] [--ttl <min>]   aufstellen, bauen, starten, Daten pflanzen
    ./testinstanz.sh refresh                         aktuellen Stand des Worktrees übernehmen; Port, Token, Fixtures bleiben
    ./testinstanz.sh fixtures [mixed|full]           neu pflanzen, ohne Neustart
    ./testinstanz.sh states                          was die Leiste JETZT malt, je Zustand
    ./testinstanz.sh status                          läuft sie, wo, Alter, Restzeit, offene Verbindungen — und wer den Mutex hält
    ./testinstanz.sh list                            jede Testinstanz der Maschine, aus State-Dateien
    ./testinstanz.sh down [--force]                  Server aus, ihr tmux per Socket, Verzeichnis weg — verweigert bei offener Verbindung
    ./testinstanz.sh reap [--dry-run] [--force]      jede abgelaufene Instanz der Maschine abräumen (der TTL-Takt ruft das)

## Abnahme sichtbarer Arbeit — fertig heißt durchgeklickt

Owner-Regel vom 2026-10-08: Sichtbare Arbeit (eine Karte, deren FLAECHE `src/` oder `public/`
nennt) landet erst, wenn sie in der laufenden Testinstanz der Lane durchgeklickt ist und der Report
den token-freien Link und ein Bild des fertigen Ablaufs trägt. Ein „fertig" ohne gesehene Wirkung
geht zurück. Anlass, Owner wörtlich: Tasks in Apps seien „[Zitat entfernt]“.

**Lane.**
1. `./testinstanz.sh up` im eigenen Worktree, einmal zu Beginn der sichtbaren Arbeit.
2. Nach jedem Commit `./testinstanz.sh refresh`: Port, Token und Fixtures bleiben, der Link hält.
3. Den Ablauf wie ein Nutzer durchgehen, bei 390 px Breite und am Desktop. Kritisch bewerten: was
   fehlt, was bricht, was ist halb. Was du dort findest, baust du fertig, bevor du meldest.
4. Zwischen den Teilen nur `refresh` und Durchklicken, keine Gate-Suite und keine Vorschau. Der
   volle Beweis (Beweismenge aus `GET /api/self/gate`) läuft einmal am Ende, vor dem Report.
5. In den Report: der token-freie Link aus `./testinstanz.sh list` oder der `refreshed`-Zeile (nie
   aus `status`, das druckt den Token) und ein Bild des fertigen Ablaufs (Pfad der Datei).
6. Die Instanz bleibt stehen, bis die MAIN abgenommen hat: kein `down` nach dem Report. Die
   Restzeit zeigt `list`; reicht sie nicht, beim `up` eine längere `--ttl` setzen (Default 240 min).

**MAIN.** Vor dem Land öffnest du den Link und klickst den Ablauf selbst durch. Fehlen Link oder
Bild, oder siehst du die Wirkung nicht, geht der Report mit Grund zurück. Vom Board aus öffnet
„Öffnen" an der Zeile des Worktrees in Info → Arbeitsorte die Instanz, danach schaltet der
Instanz-Chip um (beides unten).

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
synthetische Probe kann `FLEET_TI_SNAPSHOT_SRC` ein anderes Git-Quellverzeichnis setzen; Zustand und
Spiegel-Repo werden beide aus dieser Quelle abgeleitet. Der Kopiervorgang
liest die Quelle nur. Zugangswerte, Shares und Helper-Geräte werden ausgelassen. Prozess-CWDs zeigen ausschließlich
in die Instanz, `dispatch` und `autosOn` sind aus. Die ursprünglichen Belegungen (Slot und
`openedAt` je Pfad) und das Quell-Repo stehen ohne Zugangswerte in `.testinstanz.mirror.json`.
`FLEET_SNAPSHOT_MIRROR=1` aktiviert den Zaun; eine fehlende oder ungültige Spiegel-Datei verhindert
den Start. `workplaces()` liest für `GET /api/worktrees` dieselbe Git-Worktree-Liste des Quell-Repos
wie im Live-Betrieb, mit echten Pfaden, Branches und HEADs. Jede Zeile trägt `mirrored: true`;
`session.slot`/`session.openedAt` bezeichnet die Belegung beim Snapshot-Start, keine laufende
Session im echten Worktree. Die Kopie behält auch belegte Plätze über 16 mit ihren Labels
in der bestehenden Sessions-Antwort, damit die Zeile ihren Halter benennen kann. Die Kopie
startet dort weder Agenten noch `testinstanz.sh`. `distance.ahead` misst gegen `base`
(wie im Live-Betrieb, einschließlich der übernommenen Lane-Basis), `dirty` zählt die Statuszeilen.
Fehlgeschlagene Messungen bleiben `null` mit `reasons`. `session.taskId` bezeichnet die übernommene
Queue-Zeile; eine fehlende Bindung bleibt `null` mit `snapshot-task-binding-unrecorded`.
Der Worktree mit `branch === instance.source.branch` ist die Quelle dieser Instanz; die
Anzeige kann ihn damit als „Quelle dieser Instanz“ markieren, ohne eine zweite Worktree-Liste.

Prüf- und Land-Daten für den rechten Tab reisen mit: `commandJobs` und `laneSuiteJobs` als
Projektion (`testinstanz-snapshot.js#mirrorJob`: `repo` bleibt der echte Pfad, `cwd` zeigt in die
Kopie, Geräte-Id, Bundle-Pfad, Ausgabe-Tail und Artefakte sind geleert), die Land-Verdikte
`merges`/`mergeParked`, und die Ledger-Zeilen behalten ihr echtes `repo`, damit
`checks.local/preview/gate/audit` und `suiteOffers` dieselbe Zuordnung wie live treffen. Weil die
Kopie `slot.worktree` entfernt, nennt `.testinstanz.mirror.json` je Belegung zusätzlich `branch`;
`server.ts#snapshotLaneOf` liest ihn nur im Snapshot-Modus für die Merge-Bindung und den Besitzer der
Suite-Sperre (live bleibt `slot.worktree.branch` die einzige Antwort). `target.landed` liest die echten
`fleet/land`-Notes des Quell-Repos; dass eine ungelandete Lane dort `null` mit
`land-notes-truncated` trägt, ist die Kappung in `workplaceLandNotes` und live identisch.
`FLEET_TI_SUITE_LOCK` (nur `up snapshot`) zeigt die Instanz auf ein anderes Sperrverzeichnis, damit
ein Fixture einen Lane-Besitzer zeigen kann, ohne die Maschinen-Sperre anzufassen.

Die Snapshot-Instanz verweigert alle mutierenden HTTP-Methoden zentral mit **409** und
`refusal: "snapshot-mirrored-read-only"`, auch Land/Merge, Entfernen/Discard, Lane-Anlage/Attach,
Commit, Datei-Schreiben/Create/Move/Delete, Testinstanz-Up/Down, Slot-Öffnen und Pane-Zustellungen
(`send`, Brief und Clarification-Antwort). Auch interne Zustellungen werden vor der Queue
in `sendText` als `snapshot-mirrored-read-only` abgebrochen. Die Sperre gilt
vor der Ausführung einer Route und unabhängig davon, ob der Pfad im Body, Query oder Slot steht.
Terminal-Eingaben per WebSocket schließen mit Code 1008 und demselben benannten Grund,
bevor Bytes eine Pane erreichen; lesende Terminal-Verbindungen bleiben möglich.
Lesende Git-Abfragen laufen mit `GIT_OPTIONAL_LOCKS=0`; eine nicht gelesene Testinstanz-Beobachtung
bleibt `null` mit dem Grund `snapshot-mirrored-read-only`. `mixed` behält seine Fixture-Schreibwege.
Der Check `e2e/lanes-lifecycle.ts#snapshotMirrorChecks` startet `up snapshot` gegen einen echten
Git-Fixture mit Worktree, prüft jede dieser Türen und vergleicht HEAD, Status und Kanarien-Bytes.
Eine Server-Mutation öffnet die Slot-Tür in der Kopie und macht denselben Verweigerungscheck rot. Program-Bindungen werden
mitgenommen (`main` mit `slot`/`openedAt`/`boundAt`), nur die Session-Id der Bindung wird auf
`null` gesetzt — der Loader des Servers würde einen `main`-Datensatz ohne dieses Feld ganz
verwerfen und die Kopie hätte stille „unbekannt“-Bindungen, wo sie den wahren Stand trägt. Die
isolierte Kopie bleibt hinter dem eigenen Port, Socket, Verzeichnis und `env -i`.

1. **Beim Kopieren:** das rsync trägt `.env`, `fleet.json*` und `*.jsonl` nicht über — keine
   private Konfiguration, keine fremden Sessions, keine Transkripte im Klon.
2. **Beim Start:** der Instanz-Server startet hinter `env -i` und bekommt nur die expliziten
   `FLEET_*`-Werte, die das Skript selbst setzt. Vor dem Start schreibt das Skript deren NAMEN
   (nie Werte) in `<instanzdir>/env-names`; keiner von `FLEET_HUB_REMOTE`, `FLEET_HELPER_*`,
   `FLEET_SHARE_*` kann darin stehen, und das Skript prüft das mit einer scharfen Verweigerung,
   statt es nur anzunehmen. `LANG=en_US.UTF-8` steht zusätzlich in `env-names`, weil tmux das Tab
   unter C-Locale als `_` ausgibt.
3. **Beim Ableiten:** Port 8790, Socket `claudefleet` und ein Verzeichnis INNERHALB des Checkouts
   werden mit Namen abgewiesen (exit 2) — ein Env-Override ist genau der Weg, auf dem jemand dem
   Skript versehentlich den Live-Fleet reicht. Abräumt wird per notierter PID — aber nur bei
   Port-Identität —, `tmux -L <socket> kill-server` und Prozess-cwd im Instanzverzeichnis, nie
   über ein Namensmuster.

Dazu: `FLEET_CMD=true`, also wird nie ein Agent gespawnt; die Harness-CLI in den Panes ist ein
stand-in (siehe den Kopf von `testinstanz.sh`). Im Modus `snapshot` heißt der Stellvertreter
`cat`: `true` endet sofort, die Pane fällt auf die Shell zurück, und jede Zustellung stünde dort
als „command not found“ — die Instanz sähe kaputt aus. `cat` liest das tty und gibt Eingefügtes
als Text wieder, es führt nichts aus. Die State-Datei trägt den Token nicht — der
bleibt in `.testinstanz.token`, und `list` druckt die URL OHNE Token.

Von einem anderen Gerät kommt der Owner an den Link über das Board: in Info → Arbeitsorte steht
unter dem Worktree jeder laufenden Instanz die Zeile „[Zitat entfernt]“ mit „Öffnen"
(`src/board.ts#tiLine`, seit 2026-10-08 statt der eigenen Testinstanz-Karte, Owner: „[Zitat entfernt]“
). „Öffnen" ist `POST …/testinstanz {action:"open"}` und bekommt die URL samt
Token aus `testinstanz.sh status` (`server.ts#testinstanzFact`). `GET /api/testinstanzen` mit
`openUrl` bleibt: der Server liest es nur auf dem Owner-Pfad (unter dem `tokenGate`) aus der
`.testinstanz.token` der Instanz (`server.ts#testinstanzList`) — Steward-, Self-, Share-Credential
und anonym enden vorher mit 401/403 und sehen nie ein Token.

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
sondern „Testinstanz läuft“; der vor dem Kopieren gemessene Stand (`instance.source`, dieselben
Worte wie das Band) steht im Titel der Zeile. Die eigene Kopie erscheint nicht als weiterer
Arbeitsort. Helfer-Geräte fehlen nicht still: unter Geräte steht eine Zeile „Helfer · nicht
angemeldet“, der Grund (die Kopie trägt keine Helfer über) beim Darüberfahren. Eine Session, deren
Program-Bindung sich nicht lesen lässt, sagt unter Rechte „Im Snapshot nicht belegt“ statt
„An keinen Auftrag, kein Program gebunden“ — eine unbekannte Bindung darf nirgends als „Keine"
erscheinen.

## Bauen, TTL, Abräumen

`up` führt **vor** dem Serverstart `bun run build` in der Kopie aus; scheitert der Build, startet
nichts und das Skript endet mit exit 1 — eine Instanz, die das Client-Bundle von gestern zeigt,
ist schlimmer als keine.

`up --ttl <min>` (Default 240) schreibt `expiresAt` in die State-Datei; `status` zeigt Alter,
Restzeit, URL und die ESTABLISHED-Verbindungen auf den Port samt Gegenstelle (`status --json`:
`ageMs`, `connections {count, peers}`, `null` wenn der Host sie nicht sehen kann).

**Der TTL-Takt** ist `scratch-reap.sh`, gerufen beim Start jedes `e2e-isolated.sh` dieser Maschine;
er ruft `testinstanz.sh reap`. Die Hand liegt bewusst in DERSELBEN Datei wie `up`: bis 2026-10-09
suchte `scratch-reap.sh` die Familie unter seinem Argument (`$TMPDIR`, auf dem Mac
`/var/folders/…/T`), `up` schreibt nach `/tmp` — der Takt lief und sah keine einzige Instanz
(2965429957 stand 40 h über `expiresAt`). `reap` beendet eine abgelaufene Instanz unabhängig davon,
ob ihre Lane noch lebt: die notierte PID NUR, wenn sie noch den Port hält, den dieselbe Datei
verzeichnet (`lsof -iTCP:<port> -sTCP:LISTEN -t` — ein recycelter PID ist ein fremder Prozess),
`tmux -L <socket> kill-server` samt zurückgelassener Socket-Datei, jeden Prozess, dessen cwd im
Instanzverzeichnis liegt, dann das Verzeichnis. Jede Entscheidung steht in einer Zeile.
State-Dateien ohne `expiresAt` (alte Instanzen) werden nur gelistet, nie beendet.

**Offene Verbindung = jemand schaut.** `reap` und `down` verweigern eine Instanz mit
ESTABLISHED-Verbindung auf ihren Port (`lsof`, auf Linux ohne lsof `ss`) und nennen die
Gegenstelle; kann der Host Verbindungen nicht sehen, verweigern sie ebenso. `--force` übersteuert.
Anlass: 2026-10-08 traf das Abräumen von :8902 den offenen Tab des Owners. Die Kehrseite: ein Tab,
der offen bleibt, hält eine abgelaufene Instanz am Leben — `reap` zählt sie als „refused“.
Belege: `e2e/scratch-reap-checks.ts` §e10–§e14.

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
