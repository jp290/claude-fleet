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

## 6 · Prompt für die Folge-Session auf diesem Worktree

```
Du setzt die Queue-Ansicht-Arbeit auf Branch fleet/260918192319-a2cb fort, im Gespräch mit dem Owner.
Lies zuerst docs/queue-redesign-2026-09.md ganz und `git log main..HEAD` mit Bodies.

AUFTRAG: Teil 2, ein NEUENTWURF (kein Umräumen) von (a) Detail-Panel und (b) oberer Leiste der
Task-Queue in src/client.ts (renderQueueDetail, openQueue, paintQueueScope) und public/index.html.
Die Liste aus Teil 1 bleibt, wie sie ist, außer der Owner sagt etwas anderes.

ERSTER ZUG, danach auf den Owner warten, vorher kein Code:
1. Die Vorschau-Instanz nach §5 hochziehen, oder die laufende auf :8871 wiederverwenden, wenn sie antwortet.
2. Zwei bis drei Entwurfsvarianten für Detail-Panel und Leiste als kurze ASCII-Skizzen vorlegen. §3 ist
   ein Vorschlag, keine Vorgabe.
3. Die vier offenen Owner-Entscheide aus §3 als knappe Fragen stellen.

DANN: die gewählte Variante in kleinen Schritten bauen, je Schritt ein Commit. Jeder Schritt wird in
der Vorschau selbst per Headless-Chrome angesehen, bevor der Owner den Link bekommt. Die Proben aus §4
als Spezifikation mitziehen: Invarianten halten, nie aufweichen, und für jeden neuen Check einen
Negativfall.

VERIFY vor jedem „fertig“: GET /api/self/gate, dann pins + tsc (Gate-Liste) + bun run build, danach
FLEET_E2E_MODULES=tasks ./e2e-isolated.sh (per Suite-Offer, wenn ein Helfer frei ist). Beurteilt wird
am Ende des Logs („ALL PASS“ bzw. den FAIL-Zeilen).

NICHT: Jev bauen ohne Owner-Freigabe. bun server.ts mit Default-Env. Die Vorschau über die IP
verlinken. Landen (das tut MAIN/Owner). Den Kontextfüllstand bei ~25 % melden.
```
