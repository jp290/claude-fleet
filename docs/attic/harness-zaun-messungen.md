# Attic: Harness-Zaun-Messungen (2026-08, aus `CLAUDE.md` umgezogen 2026-08-18)

**Status:** Messbelege der Zaun-Ära. Der heutige Betriebszustand ist **Full Access** (`fc8f4ad`,
2026-08-12): claude, pi und codex laufen mit vollem lokalem Zugriff, jede Lane committet selbst,
`POST /api/slots/:id/commit` ist nur Notweg. Die Absätze unten sind als Messungen korrekt und als
Betriebsanleitung überholt — sie wurden beim Regelbuch-Schnitt vollständig hierher bewegt, nichts
wurde gelöscht. Bei Widerspruch gilt der Code.

## Die Full-Access-Korrektur (der Absatz, der die Ära beendet hat)

- **KORREKTUR 2026-08-12, GILT VOR ALLEN ZAUN-ABSÄTZEN DARUNTER: FULL ACCESS IST DER NORMALZUSTAND
  (`fc8f4ad`).** Owner-Entscheid: Claude, pi und codex laufen mit vollem lokalem Zugriff — der
  pi-Zaun (sandbox-exec) ist ENTFERNT, codex spawnt mit `--dangerously-bypass-approvals-and-sandbox`
  plus einem idempotenten Trust-Eintrag in `~/.codex/config.toml` (der TUI-Trust-Prompt wird vom
  Bypass-Flag NICHT übersprungen — gemessen; nur der persistierte Eintrag schließt ihn),
  `hostCommits` ist überall `false`, codex-Lanes sind wieder WORKTREES. Jede Lane committet
  selbst; `POST /api/slots/:id/commit` ist nur noch Notweg. Die Absätze unten über Codex-Sandbox,
  „Codex-Lane kann nicht committen", Arbeitsteilung „Lane produziert / Host committet" und den
  pi-Zaun (`f18c1ec`/`2682bdc`) sind damit HISTORIE — als Messbelege korrekt, als Betriebsanleitung
  überholt. [ÜBERHOLT AM SELBEN TAG, korrigiert 2026-08-14: hier stand „`codex.automatable` bleibt
  `false` (Login-Screen + Dispatch-Paste-Race ungelöst)" — der Readiness-Schnitt vom 2026-08-12
  (CODEX-DISPATCH-BOOT-RACE-Absatz oben) hat genau das gelöst; `codex.automatable` ist seither
  `true`, per Pin an die Readiness-Naht gekoppelt. Bei Widerspruch gilt der Code.] Was WEITER gilt:
  `container` bleibt der isolierte Sonderfall, und Lese-Reichweite = Provider-Reichweite
  bleibt die Vertrauensfrage von vorher. Aktives Programm: `docs/core-program-2026-08-12.md`.

## Codex' Schreib-Zaun war kein Lese-Zaun (Messung 2026-08-08)

- **Codex' `--sandbox workspace-write` ist ein SCHREIB-Zaun, KEIN Lese-Zaun** (HISTORIE seit `fc8f4ad`, s. o.) — gemessen 2026-08-08, mit
  Kontrollgruppe, auf dem echten Agenten-Pfad.** Die Sandbox-Zeile der Session nennt
  `[workdir, /tmp, $TMPDIR]`, und das sind die SCHREIB-Wurzeln: ein `cat ~/.fleet-canary` ausserhalb davon
  gelang in 0 ms und der Inhalt kam als Modell-Antwort zurueck. Gegenprobe, die das Ergebnis erst
  aussagekraeftig macht: Lesen INNERHALB gelang (die Sonde misst also etwas), und SCHREIBEN ausserhalb wurde
  mit `Operation not permitted` mechanisch verweigert (seatbelt, keine Modell-Hoeflichkeit — dieselbe
  Beweisregel wie beim `--allowedTools`-Befund unten). **Konsequenz:** ein Codex-Slot auf dieser Maschine kann
  `~/private-repo-a` und `~/private-repo-b` lesen, egal in welchem Worktree er laeuft — und was ein
  Agent liest, geht als Kontext an seinen Anbieter. Das ist eine VERTRAUENSFRAGE, keine Sandbox-Frage; fuer
  claude/pi gilt dasselbe, nur ist der Anbieter dort einer, dem der Owner vertraut. Zwei weitere Fakten aus
  derselben Messung: `codex exec` verweigert ausserhalb eines git-Repos/trusted directory
  (`Not inside a trusted directory and --skip-git-repo-check was not specified`) — eine eigene Schutzschicht,
  die nichts mit der Sandbox zu tun hat; und `--ask-for-approval` gibt es NUR an der interaktiven Form, nicht
  an `codex exec`. **Und die Falle fuer den Container-Weg:** ein bind-gemounteter Worktree liegt auf der
  HOST-Platte und ist damit von genau dieser Lese-Reichweite erfasst — Isolation entsteht erst, wenn die
  Arbeitskopie in einem VOLUME liegt und der Agent drinnen laeuft.

## Codex-Lane konnte nicht committen — die Arbeitsteilungs-Doktrin (TOT seit `fc8f4ad`)

- **Eine CODEX-Lane in einem WORKTREE kann strukturell nicht committen — und damit nicht landen** (am ersten
  echten Codex-Lauf gemessen, 2026-08-08, Slot 9). Grund: die Metadaten eines *linked worktree* liegen im
  HAUPT-Repo unter `<main>/.git/worktrees/<lane>/`, also **ausserhalb** der Schreibwurzel von
  `--sandbox workspace-write` — `git commit` stirbt an
  `fatal: Unable to create '.../index.lock': Operation not permitted`. Dieselbe Sandbox sperrt ausserdem
  **jede Suite** (tmux-Sockets unter `/private/tmp/tmux-501/…` → `Operation not permitted`) und **das Netz**
  (`bunx tsc` bekam kein Manifest, `curl` auf `/api/self/drift` scheiterte). Was GING: `bun install` (Cache),
  `bun e2e/pins.ts`, `bun run build`. **Zwei Dinge relativieren das, und beide muss man kennen:** (1) der
  Land-Gate laeuft SERVER-seitig, nicht in der Lane — die Suiten dort sind Vorschau, also ist eine Codex-Lane
  trotzdem landbar, sie kann sich nur nicht selbst pruefen; das Muss schrumpft damit auf „sie muss committen
  koennen". (2) **KORREKTUR 2026-08-08, gemessen am Klon: die Klon-Form loest es NICHT.** Hier stand, die
  Arbeitskopie als KLON (`ff5d713`/`b320c24`) habe ihr `.git` innerhalb der Schreibwurzel und loese das
  strukturell — das war plausibel und ist falsch. Auf einer echten Klon-Lane (`c473ba7` deployt, Slot 5)
  starb `git commit` erneut, jetzt am EIGENEN Pfad:
  `fatal: Unable to create '<lane>/.git/index.lock': Operation not permitted`. Grund im
  `permission_profile` der Session (`turn_context` im Rollout, nachlesbar unter
  `~/.codex/sessions/<Y>/<M>/<D>/rollout-*.jsonl`): Codex stuft `<workdir>/.git` **ausdruecklich auf
  `access:"read"`** herab, zusammen mit `<workdir>/.agents` und `<workdir>/.codex`, waehrend der Workdir
  selbst `write` ist. Der Zaun ist also nicht „ausserhalb des Workdir", sondern nennt `.git` beim Namen —
  **unabhaengig von der Form.** Die Klon-Form behaelt ihren anderen Wert (ein selbst-enthaltenes
  Verzeichnis, kein Zugriff auf Hooks/Config/Objekte des Roots, die Form, die ein Bind-Mount braucht);
  sie ist nur nicht die Antwort auf „committen".
  **Die Antwort ist eine ARBEITSTEILUNG, und sie ist seit dem 2026-08-08 OWNER-DOKTRIN fuer JEDEN fremden
  Harness, nicht nur fuer Codex** (Wortlaut: „comitten sollte einfach wieder die main session selbst").
  Konsequenz, und sie dreht die Bewertung um: ein fremder Agent braucht NIE Schreibrecht auf `.git`, also
  ist die `.git`-Sperre kein Defekt, den man umgehen muesste, sondern die gewollte Voreinstellung — und
  `sandbox_workspace_write.writable_roots` ist damit eine Zeile, die man NICHT ziehen will. Dieselbe
  Doktrin ist der Grund, warum pi einen Zaun BEKOMMEN hat, statt dass seine Zaunlosigkeit als Vorteil
  gebucht wurde (Queue-Zeile `f7deea4b`, gelandet als `f18c1ec` — siehe den eigenen Absatz unten).
  **Gebaut und gemessen ist der Weg: eine fremde Lane produziert, der HOST committet** — `POST /api/slots/:id/commit` (`server.ts:12579`, Worker schreibt die Message). An
  derselben Lane verifiziert: `{"committed":true,"hash":"34b460a"}`, Baum danach sauber. Eine Codex-Lane
  ist damit landbar; sie kann sich nur weder selbst pruefen noch selbst committen. Ungeprueft und darum
  keine Empfehlung: `sandbox_workspace_write.writable_roots` existiert als Config-Key im Binary — ob er
  die explizite `.git`-Herabstufung ueberstimmt, hat niemand gemessen.
  Und das Modell hat sich beide Male korrekt verhalten — nichts behauptet, jeden
  Fehlschlag woertlich zitiert, die Aenderung uncommittet stehengelassen statt sie zu verwerfen.

## Der pi-Zaun (`sandbox-exec`) — gebaut `f18c1ec`, entfernt `fc8f4ad` (TOT)

- **pi laeuft seit `f18c1ec` (2026-08-08) in einem Zaun VON AUSSEN — `sandbox-exec` um die Spawn-Zeile,
  weil pi selbst keine Berechtigungs-Schicht hat** (`pi --help` kennt weder sandbox noch approval noch
  restrict; pi's eigene Sicherheits-Doku sagt es selbst). `PI_HARNESS.spawnCmd` erzeugt das SBPL-Profil PRO
  LANE aus ihrem cwd. **Bewusste Ausnahme seit 2026-08-11:** der separat benannte Adapter `pi-unfenced`
  startet genau EINE Main-Session ohne `sandbox-exec`, damit sie Git selbst bedienen kann. Er ist serverseitig
  `automatable:false`, `allowsLanes:false`, `singleton:true` und warnt im Picker vor unbeschraenkten Datei-,
  Git- und Netzwerkrechten. Normales `pi` bleibt unveraendert gezaeunt; die Ausnahme darf nie als Bedingung
  in seinen Spawn-Pfad einsickern. Vier Dinge, die man kennen muss, bevor man darauf baut:
  - **Schreibbar sind: die Arbeitskopie, `/tmp`, `$TMPDIR`, `/dev`, `~/.pi` und `~/.bun/install/cache`
    (letzteres seit `2682bdc`). Gesperrt ist `<lane>/.git` — und `~/.claude`.**
    `~/.pi` MUSS hinein — mit gesperrtem `~/.pi` degradiert pi nicht, es **stirbt beim Start**
    (`EPERM … mkdir '~/.pi/agent/sessions/<slug>'`, ungefangener Throw aus `getDefaultSessionDir`, vor
    jedem Prompt; es liegt genau deshalb auf dem Startpfad, weil dieser Adapter `--session-id` pinnt).
    `/dev` MUSS hinein — ein GEERBTER fd ueberlebt den Zaun, ein expliziter `open` nicht: ohne `/dev`
    scheitern `> /dev/null` und `> /dev/tty` mit `Operation not permitted`, und ein TUI im Raw-Mode
    oeffnet `/dev/tty`. Die Form ist damit eine ANDERE als bei Codex: dort zaeunt das Profil die
    Kommandos ein, die der Agent AUSFUEHRT (Codex selbst steht ausserhalb und schreibt weiter `~/.codex`);
    hier liegt der Zaun um den AGENTEN, also muss sein Zustandsverzeichnis hinein.
  - **DAS NETZ BLEIBT OFFEN** (Owner-Entscheid: „netz anbindung waere schon sehr gut, auch fuer
    research"). Codex' `network:restricted` ist bewusst nicht kopiert — ein pi-Slot erreicht seinen
    Provider nativ, eine Netzsperre waere dort nicht streng, sondern kaputt. Preis benannt statt
    versteckt: mit offenen Reads UND offenem Netz ist Lese-Reichweite gleich Exfiltrations-Reichweite.
    Kein Rueckschritt — eine claude-Lane hat volle Reads, volles Netz und GAR keinen Schreibzaun.
  - **Der Zaun testet sich selbst an `/usr/bin/true`, BEVOR pi startet.** Das trennt „Zaun kaputt"
    (sandbox-exec fehlt → not found; ungueltiges Profil → exit 65) von „pi ist beendet". Faellt der Test,
    startet pi nicht — und das ist mechanisch sichtbar, nicht nur lesbar: ohne pi-Prozess findet
    `comms:["pi"]` nichts, der Slot liest `no-agent`, `canDeliver` verweigert Autos/Dispatch/Steward-Send.
  - **WAS EINE FREMDE LANE HINTER DEM ZAUN KANN UND WAS NICHT — gemessen `2682bdc`, und die Grenze ist
    der Endzustand, keine Uebergangsloesung.** Sie KANN: `bun e2e/pins.ts`, `bunx tsc`, `bun run build`,
    `./e2e-security.sh`. Sie KANN NICHT: alles claude-Abhaengige — `./e2e-claude-gate.sh` stirbt an
    `ENOENT` auf eine Transkript-Datei unter `~/.claude/projects/…`, `./e2e-isolated.sh` an `EPERM` beim
    Anlegen ebendort. `~/.claude` aufzumachen waere der falsche Fix: **Lane produziert, Host
    verifiziert** ist dann die Antwort, und eine ehrliche Grenze ist mehr wert als eine aufgeweichte.
    Also: **plane den Host-seitigen Verify-Lauf ein, wenn du eine fremde Lane briefst** — besonders,
    wenn ihre Arbeit in `e2e/security.ts` oder sonst irgendwo liegt, das NUR `e2e-isolated` faehrt.
    Die Ursache der Cache-Wurzel als Warnung fuers naechste Mal: Buns Meldung lautet
    `unable to write files to tempdir: PermissionDenied` und meint NICHT `$TMPDIR`, sondern seinen
    Package-Cache. Der Fehlermeldung zu glauben haette die falsche Wurzel geoeffnet.

## Fixture-Regel: ein ausführbares Artefakt muss AUSGEFÜHRT werden

Die Regel selbst steht weiter in `CLAUDE.md` (§Deploy); hier die zwei Instanzen, die sie bezahlt
haben:

  - **EINE FIXTURE, DIE TEXT LIEST, KANN NICHT BEWEISEN, DASS EIN PROFIL AUSFUEHRBAR IST — und diese
    Falle hat in diesem Repo ZWEIMAL zugeschlagen.** Beide Male: das Profil wird aus
    `#{pane_start_command}` gehoben, tmux escaped dort `"` und `$`, SBPL liest `\"` als unbound
    variable, und die Zaun-Sonden fallen, ohne den Zaun je befragt zu haben. `e2e/lanes-basic.ts` loest
    es seit `f18c1ec` mit `replaceAll("\\","")` und nennt es im Kommentar „this check's own first red";
    400 Zeilen weiter in `e2e/security.ts` wurde es trotzdem wiederholt. Die Fixture daneben konnte es
    strukturell nicht fangen, weil sie auf `(version 1)` und `(deny file-write*)` prueft — **beide
    enthalten kein Anfuehrungszeichen** und ueberleben die Verstuemmelung unbeschaedigt. Die Regel, die
    daraus folgt und ueber Sandboxen hinausgeht: **eine Fixture fuer ein ausfuehrbares Artefakt muss es
    AUSFUEHREN** (hier: `sandbox-exec -p <profil> /usr/bin/true`, dieselbe Selbstprobe, die der Server
    vor dem pi-Start fahrt), und die Sonden dahinter haengen an USABLE, nie an VORHANDEN — sonst liest
    sich „nichts wurde gemessen" wie „der Zaun verbietet alles".
