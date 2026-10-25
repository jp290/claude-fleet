# Die Testinstanz je Worktree (`./testinstanz.sh`)

Eine Fleet-Instanz, die zu GENAU EINEM Worktree gehört: jeder Checkout leitet Port, tmux-Socket
und Verzeichnis aus seinem eigenen Pfad ab, zwei Lanes laufen deshalb nebeneinander statt sich
8862/fleetti733b zu teilen (gemessen 2026-09-24: alle Kopien antworteten mit dem Stand einer
fremden Lane). Sie läuft von selbst ab (TTL). Der Modus `snapshot` zeigt dem Owner auf Tailscale
eine bereinigte Kopie echter Daten: „[Zitat entfernt]“.

    ./testinstanz.sh up [mixed|full|snapshot] [--ttl <min>]   aufstellen, bauen, starten, Daten pflanzen
    ./testinstanz.sh up mixed --real-seats           dasselbe, und jeder danach geöffnete Sitz ist ein echter claude in auto (unten, „Echte Sitze“)
    ./testinstanz.sh refresh                         aktuellen Stand des Worktrees übernehmen; Port, Token, Fixtures bleiben
    ./testinstanz.sh fixtures [mixed|full]           neu pflanzen, ohne Neustart
    ./testinstanz.sh states                          was die Leiste JETZT malt, je Zustand
    ./testinstanz.sh status                          läuft sie, wo, Alter, Restzeit, offene Verbindungen — und wer den Mutex hält
    ./testinstanz.sh list                            jede Testinstanz der Maschine, aus State-Dateien
    ./testinstanz.sh down [--force]                  Server aus, ihr tmux per Socket, Verzeichnis weg — verweigert bei offener Verbindung
    ./testinstanz.sh reap [--dry-run] [--force]      jede abgelaufene Instanz der Maschine abräumen (der TTL-Takt ruft das)

Für mehrere Branches gibt es eine Instanz je Runde (unten, „Eine Instanz je Runde“):

    bun tools/runde.ts up <name> <branch> [<branch> …]   die Branches auf dem main von jetzt, eine Instanz dazu
    bun tools/runde.ts status | tick | down <name>

## Accepting visible work — done means clicked through

Owner rule of 2026-10-08: visible work (a card whose FLAECHE line, the files it may touch, names `src/` or `public/`) lands only once it has been
clicked through in the lane's running test instance and the report carries the token-free link and a picture of the
finished flow. A "done" without a seen effect goes back. The occasion, in the owner's words: tasks in apps were „[Zitat entfernt]“.

**Lane.**
1. `./testinstanz.sh up` in your own worktree, once at the start of the visible work.
2. After every commit, `./testinstanz.sh refresh`: port, token and fixtures stay, the link holds.
3. Go through the flow like a user, at 390 px width and on the desktop. Judge it critically: what is missing, what
   breaks, what is half done. Whatever you find there, you finish before you report.
4. Between the parts, only `refresh` and clicking through: no gate suite and no preview. The full proof (the proof
   set from `GET /api/self/gate`) runs once at the end, before the report.
5. Into the report: the token-free link from `./testinstanz.sh list` or from the `refreshed` line (never from
   `status`, which prints the token), and a picture of the finished flow (the file's path).
6. Your own instance ends with your report: `./testinstanz.sh down`, once link and picture are in it. The owner sees
   your branch in the instance of their round (section "Eine Instanz je Runde", below). If your own instance ran for the owner because you build
   live, it stays until the owner says „[Zitat entfernt]“.

**MAIN.** Before the land, open the link and click through the flow yourself. If the link or the picture is missing,
or you don't see the effect, the report goes back with the reason. From the board, "Open" on the worktree's row in
Info → Arbeitsorte opens the instance, and afterwards the instance chip switches (both described further down in this file).

### Visible work, widened

The rule above is the narrow case: a lane's card paints something. The same bar holds for every change the owner
will see, and for how you get there.

- **The whole window, not only your surface.** Click through everything the window shows at 390 px and at
  desktop width, including the neighbours of your change. A DOM claim is not a look: the report names what you
  saw in the window yourself, also outside your card's surface.
- **The bar is the owner's: AAA indie software, made with love.** Calm: it shows what counts now, the engine room
  only on request. Honest: it claims nothing and raises no false alarm, and says once and calmly what it doesn't
  know. One voice: one language, human words, no internal jargon. Care in the small: a name may be shortened when one
  click shows it whole, nothing else is cut off, everything aligned, empty states thought through, nothing waits
  without feedback. With character: small own details, never at the cost of clarity. Equally good everywhere,
  desktop and phone. One agent with taste walks the board about once a week and brings the owner the three things
  that disturb the feel most; not more rounds than that.
- **Pin the surface before you build.** The owner names surfaces by what he does, not by component names, and
  two panes of one window are one view to him. Find the detail in his words that fits only one surface (a noun
  that exists on one of them, a spatial word like "rechts"), say it back, then build. When his words fit two
  surfaces, build the one his symptom explains; "[Zitat entfernt]" speaks against the surface where it
  would be unmissable. A vague report gets a question with concrete symptom options, not a guess. When he says
  "[Zitat entfernt]", list every door that starts X and fix the one he used. For spoken feedback on placement, answer
  with a two-line mock of the exact rows and wait for his yes; a wrong round costs his trust.
- **A view of a system starts with its principles.** For a view that explains a whole system (what an agent
  gets, keeps, may), lay the system's principles on one page first, each as one sentence with one real example,
  and go through it with the owner. Then a clickable mock he tries with a real task. Build after that. Collect his
  remarks into one brief instead of handing each to the builder; under time pressure at most two strands, and
  report only decisions to him. Empty places are invitations ("task: empty, write here"), not blanks.
- **His look comes before the land.** A land that changes `src/client.ts`, `public/index.html` or any visible
  bar, tab or chip waits for his look at the test instance (link and picture), unless he built or named exactly
  that state himself. An open owner question about the same surface is a stop. Night autonomy covers backend,
  audits and repairs, not a UI he sees for the first time when he wakes up: the lane holds, the instance stays
  up, the morning list names it.
- **His look has to reach him.** The page you hand him carries, per branch, one sentence in his words on what he
  gains, a before and an after of the same spot side by side at the measure of his own screen, and the click
  path from where the page opens. Look at every picture yourself before you send the link. A change deep in a
  collapsed box is invisible to him unless the path leads there: say where it is, or that it can't be seen at
  all. Work he gains nothing from today stays off the page, with one line on why. A link and a port alone
  never reach him.
- **A seat that checks never changes what he is meant to see.** In an instance prepared for his look there is no
  "seen", no save, no answer and no close. A picture that needs a changing click comes from an instance of its
  own; otherwise he opens a state that no longer shows the change.
- **A probe that misses because the column moves found a product bug.** When a DOM probe's press lands beside
  its target because content shifts after load or on repaint, a user's mouse hits the same shift. Fix the jump in
  `src/` (reserve space, keep layout stable across repaint). Never teach the probe to wait for a still column;
  it stays as strict as before.
- **No token in any text.** The instance link with `?token=` goes into no report, message, plan file, commit or
  note. Name port and slot ("test instance :8903, slot 9"); the owner's link is built by whoever talks to him.
- The design concept behind the board is a Design canvas (`https://example.com/design-artifact`,
  concepts 1 to 3), with its reasoning in `~/local-notes/shots-0d51-2026-10-07/`. Its look: Instrument
  Sans and IBM Plex Mono, ground `#0B0B0C`, moss `#8DBE86`, amber `#E3A857`, red `#E5705F`, radii 8·14·26.

## Eine Instanz je Runde

Owner 22.10.: um 12:5x trieben sieben Instanzen, je Branch eine, den Mac auf Last 80, und er sah eine
Runde über mehrere Links. Sein Wort: eine Instanz je Runde, „[Zitat entfernt]“. Und: eine Instanz endet mit
ihrem Branch, nicht mit ihrer TTL.

**Was eine Runde ist.** Ein Wegwerf-Worktree ohne Branch, `<repo>.worktrees/runde-<name>`: das main
von jetzt, darauf die Branches der Runde in der genannten Reihenfolge zusammengeführt (`git merge-tree`,
je ein Merge-Commit, den kein Branch trägt). Ihre Instanz ist die gewöhnliche Testinstanz dieses
Worktrees. Das Band oben nennt Runde, main, die Branches darin und jeden, der draußen blieb, mit Grund:

    Runde abend · main 1a2b3c4 · mit branch/a, branch/b · ohne branch/c: kollidiert mit branch/a in src/client.ts

**Aufstellen** tut, wer die Runde schneidet (die Orchestratorin), aus einem beliebigen Checkout des
Repos: `bun tools/runde.ts up abend branch/a branch/b`. Dasselbe `up` mit einer anderen Liste setzt die
Branches neu. Gedruckt wird der Link ohne Token.

**Wie der Owner hinkommt.** Der Instanz-Chip des Boards führt sie unter „[Zitat entfernt]“ als `runde-<name>`
(`server.ts#instanceChipLinks`). Der erste Besuch je Gerät braucht den Link mit Token, den baut, wer mit
ihm spricht, aus `.testinstanz.token` im Verzeichnis der Instanz. Eine Zeile mit „Öffnen“ in Info →
Arbeitsorte hat eine Runde noch nicht: die Git-Ansicht zeigt nur Worktrees mit Branch
(`src/gitstruktur.ts#gitModel`).

**Neu gebaut** wird sie vom Server (`server.ts#tickRundenNow`, jede Minute, `FLEET_RUNDE_MS`), sobald
sich main oder einer ihrer Branches bewegt: `testinstanz.sh refresh`, Port und Token bleiben, ein offener
Tab bekommt das Neuladen angeboten. Ein roter Bau lässt das alte Bild stehen und wird erst mit einem
neuen Stand wieder versucht. Ging die Instanz (TTL, Neustart), stellt der Takt sie wieder auf.

**Kollidiert** ein Branch mit main oder einem Branch davor, bleibt er draußen; der Grund nennt den
anderen und die Dateien. Die Reihenfolge im `up` entscheidet, wer bei einem Konflikt drin ist.

**Gelandet** wird weiter Branch für Branch über die Land-Tür; die Runde ist nur das Bild.

**Sie endet**, wenn jeder ihrer Branches fertig ist: gelandet bis zu seiner Spitze (das Branch-Buch: das
letzte Land hat genau diese Spitze, in jeder Land-Form), nach seinem Land beendet (`server/branch-ende.ts`)
oder beiseitegelegt. Dann `testinstanz.sh down`, Worktree und Runde gehen. Was sie hält:
- wer schaut oder in den letzten zehn Minuten schaute (unten, „Wer schaut, hält sie“);
- eine Session im Runden-Worktree, eine Änderung darin, eine ignorierte Datei außer `node_modules/` und
  Fleets Gerüst — dieselben Halte wie beim Ende eines Branches;
- ein git-Fehler: Kann git eine Spitze nicht lesen, endet und baut der Takt in diesem Durchgang nichts.

Eine Runden-Datei gilt nur an ihrem eigenen Pfad (`runde-<name>`), im Repo des Takts und in einem
detached Worktree; jede andere überspringt der Takt und nennt sie. `bun tools/runde.ts tick` von Hand baut
neu, beendet aber nichts (was gelandet ist und wer im Worktree sitzt, weiß nur der Server).
`bun tools/runde.ts down <name>` beendet sie von Hand, nach derselben Schonfrist; `--force` übergeht nur
die. Die TTL einer Runde ist die längste (1440 min).

## Wann eine eigene Instanz sich lohnt

Der Normalfall ist die Instanz der Runde. Eine eigene Instanz je Sitz lohnt sich nur:

- **beim Live-Bau mit dem Owner** (unten): er klickt, während du baust, und jedes `refresh` gilt ihm;
- **bei einer Änderung am Start oder an der Datenform des Servers** (Boot, `fleet.json`, Migration):
  das muss allein hochkommen, bevor es neben anderen Branches etwas beweist;
- **für einen riskanten Versuch**, der eine gemeinsame Instanz kaputt machen könnte.

Wer baut, misst in seiner eigenen Instanz und beendet sie mit seinem Report (`./testinstanz.sh down`).
Eine Instanz aus einem Branch endet sonst mit ihm: wenn er nach seinem Land endet oder beiseitegelegt
wird, ruft der Server ihr `down` (`server/branch-ende.ts`). Wer hineinschaut oder in den letzten zehn
Minuten schaute, hält sie.

## Live build with the owner — building while the owner clicks in the instance

For a lane whose card chooses the live-build variant (a line `VARIANTE: live-bau` in the order). The owner watches
in the test instance and says what comes next; your work loop is build, `refresh`, the owner clicks. The land comes
only on the owner's word, which your MAIN sends you. Draft and measurement: `docs/design/live-bau-profil-2026-10.md`.

1. Once at the start, `./testinstanz.sh up` in your own worktree. Give your MAIN the token-free link from
   `./testinstanz.sh list`, never the output of `status` (it prints the token).
2. After every build step, `./testinstanz.sh refresh`. It mirrors the working tree; no commit is needed for it.
   Port, token and fixtures stay, so the owner's link holds. A red build leaves the old instance standing; the line
   `refreshed …` names the head it took over.
3. Between build steps only `refresh`: no gate suite, no preview, no `suite-offer`. What you see there is in the
   instance, not in a suite tail.
4. Committing stays a duty as in every lane: the tree must be landable before you report or hand over.
5. Before the land, so only on the owner's word: `GET /api/self/context/verify-e2e` lends you the verify and land
   rules, then you run the proof set from `GET /api/self/gate`, check drift and report like any lane. The rulebook
   sections on verify, suites and land that your `CLAUDE.md` doesn't carry in this variant are named, with the
   reading path, in its closing block.

## Probe — einen Befund an der eigenen Instanz zeigen

Für eine Beweiserin, die einen Befund nicht nur liest, sondern vorführt (Schritt 4 der Richtung,
`docs/aufgaben/sicherheitspruefung.fleet.json`):

    ./testinstanz.sh probe GET|POST|PUT|PATCH|DELETE /path [--as owner|none|self:<slot>] [--body <file>]

Eine Anfrage an die Instanz DIESES Worktrees, mit ihrem eigenen Ausweis: `owner` ist ihr Owner-Token
(`.testinstanz.token`), `self:<slot>` der Self-Token dieses Slots aus ihrem `fleet.json`, `none` kein
Ausweis. Gelesen wird beides in bun, nie in einer Kommandozeile, und gedruckt werden nur `HTTP <status>`
und der Body. Ohne eigene laufende Instanz endet `probe` mit exit 2; den Live-Server erreicht es nie.

## Eine Aufgabe aus einer Datei — Bibliothek und Sitz-Repo

Die Kopie einer Instanz hat kein `.git`. Fleets Bibliothek liest sie deshalb im Worktree, aus dem sie kopiert wurde, an dem
Commit, auf dem er bei `up` oder `refresh` stand (`FLEET_LIBRARY_REPO`, `FLEET_LIBRARY_HEAD`, gesetzt in `ti_serve`). Ohne das
starteten ihre Sitze ohne Packs, und ein Export trug leere Sitz-Blöcke (Schritt 5, Lauf 2).

Wer eine Aufgabe aus einer Datei auf einer Instanz nachfährt, gibt ihren Sitzen ein Repo, das die früheren Läufe nicht kennt:

    bun tools/sitz-repo.ts "$DIR/sitz-repo" --aufgabe docs/aufgaben/<datei>.fleet.json --in ~/fleet-testinstanz-repo [--commit <rev>]

Das ergibt einen Commit ohne Vorfahren auf einem eigenen Branch `sitz/…`. Die Datei steht darin ohne `laeufe`, und es fehlt jede
Datei, die ein Lauf nennt und die dort liegt, wo die Datei ihre Beweise hinlegt (`beweise/<n>.sh`). `$DIR/sitz-repo` ist ein Worktree
des blinden Haupt-Repos `~/fleet-testinstanz-repo`. Der Owner hat diesen Pfad am 22.10. einmal vertraut („[Zitat entfernt]“
); ein echter claude fragt in seinen Worktrees deshalb nicht nach Vertrauen. Das Haupt-Repo kennt nur Sitz-Branches, also zeigt
`git log --all` einem Sitz keine Geschichte von claude-fleet. Die Sitze eines Laufs committen dorthin; die nächste Instanz lehnt das
Werkzeug ab, bis deren Arbeit geerntet ist und `--alte-zweige-weg` sie wegnimmt. `down` räumt den Worktree ab. Im Fenster wählt man
ihn über „Repo hinzufügen“. Ohne `--in` entsteht ein frisches Repo, in dem ein echter claude nach Vertrauen fragt.

## Echte Sitze — `up --real-seats`

Owner 22.10.: „[Zitat entfernt]“
 Ohne den Schalter startet eine Testinstanz nie ein Modell: `FLEET_CMD=true`, und
unter ihrem eigenen HOME ist `claude` nirgends angemeldet. Mit dem Schalter:

    FLEET_TI_MODEL=claude-haiku-5-5 ./testinstanz.sh up mixed --real-seats [--ttl <min>]

- **Was echt wird.** Jeder Sitz, der nach `up` geöffnet wird, im Fenster, über die Owner-Tür oder über
  die Self-Tür einer Session der Instanz. Seine Pane fährt die claude-Zeile, die der Server der Instanz
  baut (`server.ts#agentCmd`), und davor steht `$DIR/bin/claude` (`testinstanz-claude.sh`). Der
  startet den echten `claude` mit genau dieser Zeile, aber unter dem HOME des Owners, wo er angemeldet
  ist. Das Transkript wird in das HOME der Instanz verlinkt, damit das Board Kontext und
  Permission-Mode liest wie live. Die Fixture-Sitze der Demo bleiben Stand-ins: `up` hält ihre
  Self-Tokens fest (`bin/.stand-ins`, sha256), bevor es scharf schaltet (`bin/.real-armed`).
- **Nie Bypass.** Der Server läuft mit `FLEET_NO_BYPASS=1`, damit startet jede Rolle in auto, auch die
  Orchestratorin (`server/session-start.ts#startAspects`). `testinstanz-claude.sh` verweigert außerdem
  jede Zeile ohne `--permission-mode auto` und jede mit einem Bypass-Flag. Ebenso verweigert er jeden
  Worker-Aufruf (`claude -p`: Zusammenfassungen, Merge-Resolver).
- **Kein weiterer claude aus dem Sitz.** Unter dem HOME des Owners legt dessen Shell den echten `claude`
  vorn in den PATH, die Bash eines Sitzes käme also am Wrapper vorbei. Deshalb tragen die `--settings` jedes
  Sitzes drei Deny-Regeln (`session-start.ts#REAL_SEAT_DENY`): `Bash(claude:*)`, `Bash(*/claude *)` und
  `Bash(*/claude)`. Sie stehen neben den Rechten des Sitzes, nicht an deren Stelle. Was sie nicht treffen,
  etwa ein `sh -c` um den Aufruf, hält nur noch der Klassifizierer auf.
- **Höchstens zwei auf dem ganzen Rechner.** Jeder echte Sitz jeder Instanz trägt seine pid in
  `/tmp/fleet-echte-sitze/<pid>.seat` ein, unter einer Sperre. Das Register ist eines je Rechner, egal unter
  welchem `FLEET_TI_ROOT` eine Instanz liegt (`FLEET_TI_SEAT_REGISTRY` gibt es nur für Tests). Die Sperre
  nennt ihre Halterin und wird nur einer toten Halterin abgenommen. Ein dritter Sitz wird an der Tür
  abgelehnt, an jeder Tür, die einen Slot öffnet (`server/echte-sitze.ts`, aus `openSlot`): HTTP 400
  mit dem Satz, wie viele laufen, wie viele erlaubt sind und in welchen Slots. Der Slot bleibt leer.
  Öffnen zwei Türen gleichzeitig, lehnt der Wrapper den zweiten unter seiner Sperre in der Pane ab.
  Ein gerade geschlossener Sitz zählt, bis sein claude beendet ist (gemessen: wenige Sekunden). Deshalb
  wartet die Tür an der Grenze bis zu 15 s auf einen freien Platz, bevor sie ablehnt. So verliert eine
  Nachfolge (`POST /api/self/succeed`, auch die von `FLEET_MIGRATE_PCT` angestoßene) ihren Sitz nicht,
  und ein echter dritter Sitz hört den Satz nach diesen 15 s.
  `./testinstanz.sh status` zählt die Sitze.
- **Nichts läuft weiter.** `down` und `reap` beenden jeden eingetragenen Sitz der Instanz über pid
  und Startzeit, samt allem, was er gestartet hat (MCP-Server, Werkzeugbefehle, egal mit welchem cwd).
  Dann folgen tmux und alles, was noch mit seinem cwd in der Instanz läuft. Ein echter Sitz endet
  außerdem von selbst zur `expiresAt` der Instanz, denn der Reap-Takt läuft nur beim Start einer e2e. Die
  TTL ist mit dem Schalter 60 statt 240 Minuten und höchstens 240.
- **Transkripte liegen beim Owner.** Ein echter Sitz schreibt nach `~/.claude/projects/<cwd>/` des Owners,
  wie jeder Live-Sitz. Die Instanz verlinkt sie nur. Liefe ein Sitz der Instanz in einem Live-Worktree,
  würde sein Gespräch dort zum Kandidaten für „Fortsetzen“ (`server.ts#lastConversationIn`). Deshalb
  arbeiten echte Sitze im Verzeichnis der Instanz oder in ihren eigenen Repos.
- **Was es kostet.** Das Standardmodell der Instanz ist `claude-sonnet-5-5` (`FLEET_TI_MODEL` wählt
  ein anderes, ein Sitz kann sein eigenes setzen), nicht das 1M-Opus des Live-Fleet. Ein Sitz kostet
  nur, wenn er arbeitet: Der Start allein schickt keine Anfrage. Er läuft über das Claude-Max-Abo des
  Owners (die Pane zeigt „[Zitat entfernt]“), zählt also gegen dessen Kontingent und nicht gegen ein
  API-Konto. Gemessen am 22.10. mit Haiku 5.5, effort low, aus den Transkripten:
  - Sitz ohne Rolle, zwei Ein-Zeilen-Aufgaben (eine davon mit einem curl): 3 Aufrufe, 141 k Eingabe
    (davon 112 k aus dem Cache), 677 Ausgabe-Tokens.
  - Orchestratorin, nur ihre Rollenkarte: 2 Aufrufe, 94 k Eingabe, 1 127 Ausgabe-Tokens. Die
    Rollenkarte allein startet Arbeit; eine Orchestratorin kostet also schon beim Öffnen.

  Ein geöffneter Sitz ohne Aufgabe macht keinen Aufruf (kein Transkript). Jeder Sitz belegt außerdem
  RAM: gemessen 297 MB für claude und 117 MB für seine Kindprozesse (MCP), auf einem Mac mit 8 GB.
- **Was anders ist als live.** Der Sitz liest die Einstellungen, Hooks, Plugins und `~/.claude/CLAUDE.md`
  des Owners, wie jeder Live-Sitz. Die `claudeMdExcludes` der Zeile nennen aber das HOME der Instanz,
  `~/AGENTS.md` des Owners wird also nicht ausgeschlossen.
- **Postfach.** Nachrichten an eine Session oder an die Orchestratorin kommen wie live nach dem
  Postfach-Fenster von 60 s in die Pane (`server/zustellung.ts`, „direkt“). Gemessen am 22.10.: 69 s,
  die echte Orchestratorin antwortete darauf.
- **Offen: ein Sitz in einem Git-Repo.** Im Verzeichnis der Instanz startet ein Sitz ohne Rückfrage,
  denn `/private/tmp` ist in `~/.claude.json` des Owners vertraut. Ein Sitz in einem eigenen Repo der
  Instanz (`fixture-repo/`) bleibt dagegen an Claudes Vertrauensfrage stehen, mit „[Zitat entfernt]“ vorgewählt.
  Claude fragt je Repo-Wurzel, und Fleet beantwortet die Frage nie (`server.ts#CLAUDE_TRUST_DIALOG`).
  Ohne Repo hat ein Sitz keine Projektbindung, die Orchestratorin bekommt dann ihre Owner-Korrekturen
  nicht („[Zitat entfernt]“). Gemessen am 22.10. mit claude
  2.1.308, ohne Anfrage ans Modell:
  - Ein `git worktree` eines vertrauten Haupt-Repos startet ohne Rückfrage, auch unter `/private/tmp`.
    So starten die Lanes des Live-Fleet: Ihre Worktrees haben keinen eigenen Eintrag, nur
    `~/claude-fleet`. Ein Repo, das die Instanz als Worktree eines einmal vertrauten Haupt-Repos
    anlegt, braucht also keine Rückfrage, und zwar für jede Instanz.
  - Ein eigener Config-Ordner je Instanz (`CLAUDE_CONFIG_DIR`) ist nirgends angemeldet. Er trägt nur
    mit kopierten Zugangsdaten (deren Refresh-Token sich beim Erneuern ändern kann, dann wäre live
    abgemeldet) oder mit einem eigenen Login. Und er verlöre Einstellungen und Plugins des Owners.

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
und anonym enden vorher mit 401/403 und sehen nie ein Token. In einer Testinstanz selbst
(`FLEET_INSTANCE_SOURCE` gesetzt, `ti_serve`) fehlt `openUrl` ganz: dort ist das Owner-Token das
der Instanz, und die Liste ist maschinenweit (Mangel 115).

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

**Das Ende mit dem Branch.** Vor der TTL endet eine Instanz mit ihrem Branch: Endet ein gelandeter Branch
von selbst (`server/branch-ende.ts`), ruft der Server vorher `testinstanz.sh down` in seinem Worktree; aus
einem beiseitegelegten Worktree genauso. Innerhalb der Schonfrist, bei offener Verbindung oder neben einem
Befehl vom Board bleiben Instanz und Branch bis zum nächsten Durchgang. Eine Instanz, die gerade startet
(`pid=0`), hält den Branch ebenso.

**Wer schaut, hält sie — auch ohne Verbindung in dieser Sekunde.** Ein Handy-Tab im Hintergrund trennt
seinen Socket, ein Desktop-Tab wartet zwischen zwei Versuchen bis zu 15 s. Deshalb notiert eine Instanz
jeden Poll des Boards (eine Anfrage mit dem Owner-Cookie, nie ein Bearer-Aufruf wie `status`) in
`.testinstanz.seen` ihres Verzeichnisses (`server.ts#noteInstanceLook`). Was eine Instanz von außen beendet
(das Ende eines Branches, ein Beiseitelegen, eine Runde, `tools/runde.ts down`), wartet zehn Minuten nach
dem letzten Blick, bei einer nie geöffneten nach dem Start (`server/instanz-blick.ts`). Das `down` von Hand
und `reap` kennen die Schonfrist nicht; für sie gilt die offene Verbindung.

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
