# Queue-Ansicht neu: Teil 1 gebaut, Teil 2 zu entwerfen

Stand 2026-09-19. Die Arbeit läuft auf Branch `fleet/260918192319-a2cb`, im Gespräch mit dem Owner.
Teil 1 hat die Liste umgebaut und liegt auf dem Branch. Teil 2 ist ein NEUENTWURF von Detail-Panel und
oberer Leiste, und dafür ist diese Notiz die Übergabe. Owner, 2026-09-19: „das detail panel solltest du
im zweiten Teil nochmal neu entwerfen. Genauso die obere Leiste“. Zu Teil 1 sagte er: „so ist das ja
wie vorher“. Das Detail-Panel ist bisher nur umsortiert, nicht neu gedacht.

## 0 · Stand Teil 2 (2026-09-19, Session 2 der Lane)

Der Owner hat aus drei Skizzen je Fläche gewählt: „eigentlich gefällt mir D2 echt gut, und auch L2 mit
einer option für L3“. Beides ist gebaut, je ein Commit auf dem Branch (Bodies nennen Mechanik, Proben,
Mutationen). Die vier offenen Entscheide aus §3 blieben beim Ist-Zustand, weil sie nur mit „alles klar“
beantwortet wurden: Waves bleibt Tab, kein Jev, Program↔Repo aus den Tasks abgeleitet, Bündel als
Text-Konvention.

- **D2, Detail** (`src/client.ts#renderQueueDetail`): Der Titel steht oben. Links darunter die
  Lesespalte: Card, Bündel-Trail, Notes & comments, Refinement (offen, weil sie Entwürfe hält), dann
  eingeklappt Request, Evidence und Details. Rechts die Schiene, 260 px und sticky: Status,
  Lifecycle, die eine Hauptaktion mit ihrem Warum, clarify/refine/hold, More options, „place“
  (Program, Repo) und zuletzt eingeklappt „⋯ done · archive · delete“. Auf dem Handy stapelt die
  Ansicht Titel, Schiene und Spalte untereinander.
- **L2 + L3, Scope** (`#paintQueueScope`): Links neben der Liste steht ein Baum: Alle, dann die Repos,
  darunter im Work-Tab die Programs des gewählten Repos. „⇤ line“ klappt den Baum zu einer Auswahl
  „repo / program“ in der Leiste zusammen. Die Wahl gilt pro Gerät (`fleet.queue.scope`), ein Handy
  bekommt immer die Zeile. Leiste: Scope, Suche, Views, ⧉ Bundle, Umschalter. Ein „⋯“ gibt es oben
  nicht, weil nichts hineingehört.

§3 unten ist die Entwurfsrichtung vor der Wahl und bleibt als Begründung stehen.

### Stilvorgabe der Chat-Ansicht, angewandt (2026-09-19)

Der Owner hat über die Orchestratorin die Stilvorgabe der Chat-Ansicht geschickt (14 von ihm
abgenommene Schnitte) und verlangt, sie auf die Queue anzuwenden. Quelle: `design-prompt.md` auf dem
Screenshot-Server; die Tokens liegen auf Branch `fleet/260919003602-4ba5` und sind hier in `:root`
kopiert, bis jene Lane landet.

- **Schnitt 1** `87c584ab`: Tokens, eine Sans, Tinte-Skala, Auswahl ohne Blau, `--danger` als einzige
  Restfarbe, alles in einem Block `=== THE QUEUE IN THE CHAT LANGUAGE ===`, auf `#shell-queue`
  begrenzt, weil `.shellwin`/`.shellrow`/`.shrbtn` vier Flächen tragen.
- **Schnitt 2** `4882a6a5`: die Klammern links an den Zeilen sind weg (Owner-Wunsch; die Sektion über
  der Zeile sagt dasselbe), Chrome auf dem 4/8/12/16-Raster, Fold-Budget liest jetzt die
  `#shell-queue`-Regeln.
- **Schnitt 3**: das komplementäre Paar `--q-live` / `--q-wait` (Owner: „komplementäre farbgebung
  wichtiger elemente und bereiche"). Eine Farbe heißt „läuft von selbst", die andere „wartet auf
  dich"; sie sitzen auf Chips, Lane-Zeile und Freigabe-Hinweis, nie auf Knöpfen oder Stationen.
  Variante A (Grün/Bernstein) wurde gewählt, weil die Referenz denselben Kontrast schon zeigt.

**ZIEL-ÄSTHETIK, Referenzbilder** (Screenshot-Server, aus der Chat-Lane):
`c14-counter-after-send.png` und der Prosa-Screenshot vom 2026-09-19 15:34. Was daran das Ziel ist:
reines Schwarz mit Flakes; Blasen rechts in `--chat-raised` mit r3 r3 r1 r3; Agenten-Prosa links ohne
Kasten; Inline-Code-Chips für IDs und Symbole; Codeblöcke mit Kopfzeile (Sprache links, wrap/copy
rechts); Tabellen mit Mute-Kopf und Haarlinien; Zitatzeilen mit linker Haarlinie; kleine quadratische
Knöpfe; Zahlen tabellarisch; Farbe nur auf CLI-Marke und Live-Punkt.

**Offen (Schnitt 4 und danach):** Inline-Code-Chips für Task-Ids und Flächen, `.qdtext` als Codeblock
mit Kopf und Kopieren, die Karte als Tabelle. Hoverbare Ids (`src/entcard.ts`), Flakes
(`src/flakes.ts`) und der „Aa"-Regler (`src/chatsize.ts`) brauchen die Chat-Lane; Emoji in den
Beschriftungen (🗄 📎 💬) will die Vorgabe durch CLI-Marken und einstrichige SVG-Icons ersetzt sehen.

## 1 · Was der Owner will (seine Worte, 2026-09-18/19)

- „Die aktuell laufenden Tasks sollten über den releasten stehen, sodass sie von unten nach oben
  wandern.“ **Gebaut.**
- Tasks zeigen Notizen und Kommentare als Anhang, und Notizen hängen an ihrem Task. **Gebaut:** Chips
  und die Einrückung unter dem Task.
- Bündel und Zwischenschritte werden klarer angezeigt und eingehalten, mit Aggregieren per Klick, einem
  Trail und einem Reverse-Knopf. **Gebaut:** Bündel-Modus und `⧉ auflösen`.
- „Die Ansicht rechts … komplett überarbeiten: wichtigstes zuerst, dann ein paar sinnvolle Optionen,
  danach Kommentare usw.“ Ganz unten vielleicht eine Jev-Abfrage zu Klarheit usw. Später Agenten für
  Kommentare, Ausarbeitung und Nachforschung. **Teil 2.**
- Obere Leiste: Ein Program ist ein Abschnitt oder Kapitel, das Wissen und Arbeitsweisen über seine
  MAINs in die Tasks einbringt. Tasks können zu einem Program gehören, Programs gehören zu Repos.
  Erledigtes kommt in die Historie. Es braucht Tabs oder ein Menü für alle Repos, vielleicht auch eine
  gemeinsame Ansicht. **Teil 1 hat einen Anfang, Teil 2 entwirft neu.**
- Zu Teil 1: Die Leiste aufräumen, eine Auswahl soll das Element markieren (keine Checkbox), Bündeln
  per Knopf statt eines aufploppenden Menüs, und die Running-Zeile immer zeigen. **Gebaut.**

## 2 · Was Teil 1 gebaut hat (Branch, sieben Commits nach `main`)

`git log --oneline main..fleet/260918192319-a2cb` zeigt die Commits. Die Bodies nennen Mechanik und
Belege. Kurz:

- **Liste** (`src/client.ts#renderQueue`, `#Q_GROUPS`, `#qTaskSummary`):
  - Gruppen von oben nach unten: Running (immer sichtbar) · Released (Dispatch-Reihenfolge) · Needs
    you · Backlog · Notes & direction (eingeklappt).
  - Zeile = Titel (`#qRowTitle` schneidet Program- und Größen-Segmente aus Kartentiteln), Alter und
    Chips: ▶ slot · ⏸ held · ? criterion · Program · Größe · ⤴ after n · brief/raw · 📎 · 💬 · ⧉ n.
- **Poll:** `server.ts#taskDigest` trägt jetzt `hold`. Vorher sah das Board keinen einzigen der 13
  MAIN-Stopps.
- **Scope** (`#paintQueueScope`):
  - Projekt-Umschalter. Ein Worktree-Pfad zählt zu seinem Repo; Zeilen ohne Repo landen im Tab „no repo“.
  - Program-Dropdown. Ein Program gehört zu den Repos seiner Tasks (`#qProgramRepos`), weil Programs
    kein Repo-Feld haben.
- **Bündel** (`#qBundleDraft`, `#qMakeBundle`, `#qDissolveBundle`):
  - Ein Bündel ist ein normaler Auftrag. Zeile 1 ist `[BÜNDEL · a + b]`, Zeile 2
    `⧉ gebündelt aus: <ids>`, optional Zeile 3 `⧉ freigegeben waren: <ids>`. Danach folgen die
    Quelltexte vollständig.
  - Die Quellen werden mit dem Grund `gebündelt in <id>` archiviert. Auflösen ruft für jede Quelle
    `unarchive` auf, gibt die vorher freigegebenen wieder frei und archiviert dann das Bündel.
  - Nicht bündelbar sind: advisory Zeilen, `sent`, MAIN-Hold, Varianten, fremdes Repo oder Program,
    mehr als 20 000 Zeichen.
  - Vorschläge kommen aus dem Lande-Wellen-Sensor (`task-land-waves.ts`) und erscheinen nur im
    Bündel-Modus.
- **Notiz → Task:** Das Detail einer Notiz hat „Attached to“ mit einer Auswahl (`POST /api/tasks/:id/notes`).
- **Detail** (`#renderQueueDetail`), in dieser Reihenfolge:
  - Titelblock
  - Kopf aus `#qHeadPlan`: Status, Program/Repo, Lifecycle-Leiste, eine Hauptaktion
  - Card: goal/done/verify/role/after/verboten/gaps, geladen über `GET /api/tasks` in `taskCardFull`
  - Actions: Buttons, darunter „More options“ mit kind/agent/review
  - Notes & comments · Request · Evidence · Details (eingeklappt) · Danger zone

**Verifikation Teil 1:**
- Pins, tsc über die volle Gate-Liste und Build sind grün.
- Der volle `./e2e-isolated.sh` über den vorletzten Stand war rot, mit genau zwei Checks der Lane. Beide
  sind im letzten Commit korrigiert.
- Der Nachlauf `FLEET_E2E_MODULES=tasks ./e2e-isolated.sh` über den Stand mit dieser Notiz meldete
  `ALL PASS` (1132 PASS, exit 0), darunter die zwei vorher roten Checks. `drift`: `wouldConflict:false`,
  `behind:0`. Teil 1 ist damit landbar; landen tun MAIN oder Owner.
- Einen Lane-Report gibt es nicht. Diese Lane wurde von Hand gegründet und trägt kein `taskId`, und
  `POST /api/self/fleet-report` antwortet ihr deshalb absichtlich mit 409 (`docs/self-api.md` §B4,
  Zeile „Lane ohne `taskId`“). Diese Notiz ist die Übergabe.

## 3 · Teil 2: Entwurfsrichtung (Vorschläge, noch nicht vom Owner bestätigt)

Erst eine Skizze oder einen Screenshot aus der Vorschau zeigen und das Urteil des Owners einholen,
dann bauen. Wenn er „wie vorher“ sagt, heißt das: Umräumen reicht nicht.

### Detail-Panel

- **Fester Kopf, der beim Scrollen stehen bleibt:**
  - Titel.
  - Ein Status-Pill als kompakte Fortschrittsleiste pending → queued → sent → landed, statt heute
    Statuswort plus vier Stations-Chips.
  - Genau EINE Hauptaktion, daneben 2–3 Icon-Aktionen: clarify, refine, hold.
  - Ein „⋯“-Menü für done, archive und delete.
  - Program und Repo als Chips im Titel statt als eigene Zeile.
- **Körper als Tabs statt als lange Sektionsfolge:**
  - Überblick: die Karte (Ziel, Done, Verify, Rolle, NACH als klickbare Kette), Bündel-Trail, Anhänge.
  - Diskussion: angeheftete Notizen, Urteile, Kommentare mit Eingabe.
  - Brief: Brief, Kriterium, Refine-Vorschlag, Original-Request.
  - Lane: Lane-Zeile, Evidence, Land-Fakten.
  - Später Bewertung, siehe Jev unten.
- **Jev ganz unten bzw. als Tab „Bewertung“:** Klarheit, Umfang, Risiko je Task.
  - Jev ist ein TypeSafe System-One-Modell (siehe Memory „Jev = TypeSafe System-One-Modell“).
  - Der Aufruf kostet Geld und geht nach außen. Nicht ohne Owner-Freigabe bauen.
  - Als Triage anzeigen, nie als Urteil.

### Obere Leiste

- **Links ein Breadcrumb Projekt › Program:**
  - Projekt als Dropdown mit Zählern; das skaliert über vier Repos hinaus, anders als Tabs.
  - „Alle Projekte“ ist die gemeinsame Ansicht.
- **Mitte:** Work · Programs · History.
- **Rechts:** Suche, ⧉ Bündeln und „⋯“ mit Waves (Parallel-Plan und „start wave“) und dem Dispatcher-Schalter.
- **Die Zähler im Untertitel werden klickbare Filter:** running / released / need you / held.
- **Programs-Ansicht je Projekt:** Program-Karten mit offenen, gehaltenen und laufenden Tasks, dem
  MAIN-Status und dem Erfolgskriterium.

### Offene Owner-Entscheide

1. Waves: Soll der Tab ganz weg (Parallel-Plan ins „⋯“, Bündel übernehmen den Rest) oder bleiben?
2. Jev: Freigabe für Kosten und externen Aufruf?
3. Program ↔ Repo: Reicht die Ableitung aus den Tasks, oder bekommt `Program` ein echtes `repo`-Feld
   (Server, `server/types.ts#Program`)?
4. Bündel als Text-Konvention (heute) oder als echter Typ am Server (`Task.bundleOf`)?

## 4 · Was an einem Neuentwurf mitzieht (Proben in `e2e/tasks.ts`)

Das Detail-Panel ist durch Quelltext-Proben festgenagelt. Ein Neuentwurf ändert sie als Spezifikation,
die Invarianten dahinter bleiben:

- **`qHeadPlan` / `qMainActionOf` / `qLifecycleOf`** (Block `// --- TASK DETAIL HEAD`): Genau eine
  Hauptaktion je Status. Kein advisory Row bekommt start/release. Unbekannter Status heißt `unknown`.
  Diese Logik behalten, nur die Darstellung ändern.
- **headPaint**: Status, Facts, Leiste, `mainBox` und Why werden in dieser Reihenfolge vor der ersten
  Sektion gemalt. Es gibt genau ein `mainBox.appendChild(` und keine neue Tür im Kopf.
- **keptHandlers**: Die bestehenden Handler bleiben byte-gleich, das sind `qAct`/`qDispatchBody`/`showSlot`.
- **Danger zone**: ✕ delete bleibt eingeklappt und nie neben der Hauptaktion. Ein „⋯“-Menü muss das
  genauso halten.
- **Sektionsreihenfolge** („title → head → Card → …“) und Sektionen mit Entwürfen: Eine Sektion mit
  einem refresh-sicheren Entwurf (Kommentar, Brief, Kriterium) darf nie eingeklappt sein. Tabs müssen
  das respektieren, also den Entwurfs-Knoten behalten und nicht beim Tabwechsel wegwerfen.
- **Höhenbudget** („task detail head geometry“): wird aus dem CSS gerechnet (`.qdtitle-t`, `.qdhead-*`,
  `.qlife*`, `.qdmain*`, `.shrbtn`). Ein fester Kopf braucht ein neues, ehrliches Budget.
- **openQueue**: `type QView = "work" | "programs" | "history" | "waves"` und die vier Labels. Mobile-CSS
  (`.qview` flex-basis 100 %, `.pkfilterin`) bei max-width 700px.
- **Neu seit Teil 1**: Advisory-Zeilen landen in `notes`. Der Bündel-Trail liest seinen Header und nicht
  den eines verschachtelten Bündels.

`e2e/tasks.ts` läuft nur in `./e2e-isolated.sh` (Tier-2-Vorschau), nicht im Land-Gate. Gezielt:
`FLEET_E2E_MODULES=tasks ./e2e-isolated.sh`. Ob ein Helfer frei ist, zeigt `GET /api/self/gate`; dann
per Suite-Offer (`AGENTS.md` §Verify).

## 5 · Vorschau-Instanz (Rezept, das Skript lebte im Scratchpad)

Platzhalter: `<tailscale-ip>` ist die Adresse, auf der der Live-Server lauscht (`FLEET_HOST` im
Live-Env). `<magicdns-name>` liefert `/Applications/Tailscale.app/Contents/MacOS/Tailscale status --self
--json | jq -r .Self.DNSName` (ohne den Punkt am Ende), `<kurzname>` ist dessen erstes Label. Die echten
Werte stehen absichtlich nicht hier: `e2e/pins.ts` („leak-pin“) hält Deploy-Identitäten aus getrackten
Dateien heraus.

Scratch-Kopie mit eigenem Socket und Port. Daten: nur `tasks`, `programs` und `comments` aus dem
Live-`fleet.json`. Keine Slots, kein Dispatcher, alle Worker-Kommandos auf `true`/`false`.

- **Staging und Build:**
  - `git ls-files -z | rsync -a --from0 --files-from=- <lane>/ <dir>/`
  - `bun install` in `<dir>`, dann `bun run build`
- **Seed:**
  - `jq '{tasks: [.tasks[] | .repo //= "/Users/owner/claude-fleet"], programs, comments}' /Users/owner/claude-fleet/fleet.json > <dir>/fleet.json`
  - `repo //=`: Zeilen ohne Repo zielen live auf das Dispatch-Default. Die Vorschau hat keins.
- **Start:** in `<dir>`:
  `FLEET_HOST=<tailscale-ip> FLEET_PORT=8871 FLEET_SOCK=fleetlane71 FLEET_CMD=true FLEET_TOKEN=<test>
  FLEET_INSTANCE=queue-preview FLEET_ALLOWED_HOSTS=<magicdns-name>:8871,<kurzname>:8871
  FLEET_HARNESS_AUTOMATION=0 FLEET_LANE_AUTOCLOSE=0 FLEET_BRIEF_MS=0 FLEET_CARD_MS=0
  FLEET_BACKLOG_NUDGE_MS=0 FLEET_AUTO_REVIEW_MS=0 FLEET_INBOX_NUDGE_MS=0` plus alle `FLEET_*_CMD` auf
  `/usr/bin/true` bzw. `/usr/bin/false`, dann `nohup bun server.ts >> server.log 2>&1 &` und die PID
  notieren.
- **Öffnen:** Der Owner öffnet **`http://<magicdns-name>:8871/?token=<test>`**, nie die IP. Der
  Auth-Cookie `fleet` gilt pro Host und nicht pro Port. Auf `<tailscale-ip>` würde der Vorschau-Login das
  Live-Dashboard ausloggen.
- **Nach Client-Änderungen:** `src/` und `public/index.html` in die Kopie syncen, `bun run build`, im
  Browser neu laden (`app.js` kommt mit `no-store`).
- **Stoppen:** `kill <notierte PID>` und `tmux -L fleetlane71 kill-server`. Nie über ein Namensmuster.
- **Selbst ansehen, bevor der Owner es sieht:** `playwright-core` im Scratchpad mit
  `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, Viewport 1440×900.
  Das Skript klickt `#queuebtn` und macht einen Screenshot.

## 6 · Prompt für die Folge-Session auf diesem Worktree (Session 3)

Session 2 hat Teil 2 gebaut (§0) und danach die Stilvorgabe der Chat-Ansicht in vier Schnitten
angewandt. Der Owner hat die Übergabe verlangt; es ist nichts halb gemacht.

```
Du setzt die Queue-Arbeit auf Branch fleet/260918192319-a2cb fort, im Gespräch mit dem Owner.
Lies zuerst §0 dieser Datei (docs/queue-redesign-2026-09.md), dann `git log main..HEAD` mit Bodies.

STAND: Teil 2 (D2-Detail, L2-Baum mit L3-Zeile) ist gebaut. Darauf liegen vier Stil-Schnitte:
Tokens/Tinte-Skala, Klammern raus + 4/8/12/16-Raster, das komplementäre Paar --q-live/--q-wait
(Owner: Bernstein, "etwas weniger kräftig" → #cc9a6b), Textblöcke mit Kopf und copy + IDs als
Inline-Chips. Der Branch ist frisch auf main rebast (behind 0, kein Konflikt) und landbar; landen
tun MAIN oder Owner.

ZIEL-ÄSTHETIK: die zwei Referenz-Screenshots des Owners, benannt in §0 ("ZIEL-ÄSTHETIK"). Sieh sie
dir an, bevor du etwas zeichnest — sie sind die Abnahme-Latte, nicht die Prosa dieser Datei.

OFFEN, in dieser Reihenfolge, aber NUR auf Owner-Wunsch:
1. Die Karte (GOAL/DONE/VERIFY/ROLE/AFTER) und die Bündel-Quellen als Tabelle mit Mute-Kopfzeile
   und Haarlinien, wie die Tabelle im Prosa-Screenshot.
2. Emoji in den Beschriftungen (🗄 📎 💬 ⧉) durch CLI-Marken und einstrichige SVG-Icons ersetzen
   (src/icons.ts#harnessMark liegt auf der Chat-Lane).
3. Flakes, hoverbare IDs und der "Aa"-Regler: brauchen src/flakes.ts, src/entcard.ts,
   src/chatsize.ts von fleet/260919003602-4ba5. Solange stehen die --chat-* Tokens zweimal im Repo
   (in :root hier UND dort); beim Land jener Lane die Dublette auflösen.
4. Studio in der Schiene unter "place" — erst wenn ein echtes Studio existiert (live: 0).

ARBEITSWEISE, die der Owner hier eingefordert hat:
- Vor dem Bau die Tabelle "sein Satz → Element"; was keinen Satz hat, fliegt raus.
- Je Schnitt: Kanten per getBoundingClientRect bei 1200x612 vor/nach, Screenshots qNN-<zustand>.png
  auf den Screenshot-Server (:8874), pins + tsc(Gate-Liste) + build, und für jede neue Probe eine
  Mutation, die sie rot macht.
- Varianten entscheidest du selbst und sagst warum; nicht zurückfragen.
- Vorschau-Instanz: preview.sh im Scratchpad der Session ecbea9ca (Port 8871, Socket fleetlane71),
  nie über die IP verlinken. Rezept steht in §5.

NICHT: bun server.ts mit Default-Env. Landen. Jev ohne Freigabe.
```
