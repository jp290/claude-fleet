# UI next level — Owner-Wunschbündel 2026-08-06

Für die aktuelle bzw. eine künftige Main-Session: sechs Feature-Wünsche des Owners,
im Code verankert, geschnitten und in eine Reihenfolge gebracht. Quelle: Owner-Prompt
vom 2026-08-06 („I really wanna take Claude Fleet to the next level"). Jeder Block
trägt Ist-Stand (mit file:line), Empfehlung, offene Entscheidungen und ein
Done-Kriterium — damit eine Lane damit starten kann, ohne neu zu raten.

**Wie benutzen:** die queue-fertigen Task-Texte stehen am Ende (§ Queue). Der Owner
queued sie über das 🗒-Overlay oder `POST /api/tasks` (Owner-Token; eine Lane kann
das nicht — self-token ist slot-gebunden). F1 ist bewusst als **clarify-first**
markiert, nicht als Lane.

**Vokabular:** „linker Tab" = die Slot-Sidebar (`#side`/`#slots`, gerendert von
`renderSlots`, src/client.ts:3735). „Rechter Tab" = das Board / Session brief
(`#board`, gerendert von `renderBoard`, src/client.ts:1756). Der Filemanager
(Picker, `openPicker` src/client.ts:3584) bleibt laut Owner **unangetastet**.

**Lesart von „beide Tabs neu bauen":** als Umbau, nicht als Rewrite — der Owner
sagt selbst „weiterhin die gleichen hilfreichen Informationen" (rechts) und „der
Filemanager ist gut soweit" (links). Jede Lane behält funktionierende Teile und
ordnet um, statt neu zu schreiben.

---

## Ist-Stand-Anker (verifiziert, nicht erinnert)

- **Spawn ist Single-Harness:** `BASE_CMD = process.env.FLEET_CMD ?? "claude"`
  (server.ts:77); `slotCmd` (server.ts:82) erkennt claude per Regex und hängt nur
  dann `--session-id/--resume` + `--model '…'` an. Es gibt genau EINEN Agent-Typ
  pro Deployment, keinen pro Slot.
- **Claude-Kopplung sitzt tief:** Session-Pinning/`--resume` (Restart-Route),
  Transcript-Pfad `~/.claude/projects/<slug>/`, Summary/Review/Enhance-Worker,
  das claude-alive-Gate — alles nimmt claude an. Ein zweiter Harness ist darum
  KEIN Dropdown, sondern eine Adapter-Schicht (F1).
- **Board-Reihenfolge heute** (renderBoard): deploy → gate → identity → work
  (uncommitted + commits + files) → land → **agents (summary/review)** → lanes →
  guest → outline. Der Owner will agents ans Ende — heute stehen sie auf Platz 4
  (src/client.ts:2116).
- **`BriefInfo` hat keinen HEAD-SHA** (src/client.ts:675-678: branch, ahead/behind,
  commits, files … aber kein head). Der Summary-Cache kennt `head` (client.ts:688),
  das Brief nicht — git-HEAD im Board ist ein echtes Delta, Server + Client.
- **Slot-Rows sind flach und farb-los:** eine Row pro Slot, fixe Plätze als
  Design-Prinzip („slots are fixed places, so a session stays findable",
  src/client.ts:3739). Lanes tragen nur `⎇` + Lifecycle-Dot (editing/ready/clean,
  client.ts:3788-3796). Keine Projekt-Farbe, keine Gruppierung.
- **Kein Upload-Pfad existiert:** kein multipart, kein drop/paste-Handler — Input
  geht ausschließlich als Text über tmux paste-buffer (server.ts:1651). Drag&Drop
  ist komplett neu, Client UND Server.
- **Board ist Desktop-only** (`renderBoard` returned bei `isMobile()`,
  client.ts:1760). Jede Board-Erweiterung erbt diese Grenze — bewusst so lassen
  oder pro Feature entscheiden.

---

## F1 — Agent-Typ pro Slot (ClaudeCode, Pi, opencode, Codex …) + Optionen (Effort)

**Wunsch:** beim Slot-Start den Harness wählen — „oder vllt besser, unten fest mit
weiteren Optionen für z.B. ‚effort'". Dem Owner ist klar, dass jeder Harness eine
eigene, vernünftige Anbindung braucht.

**Empfehlung — Adapter-Registry statt Dropdown-Hack:**

```ts
interface Harness {
  id: "claude" | "opencode" | "codex" | "pi";
  spawnCmd(o: { sessionId: string | null; resume: boolean;
                model: string | null; effort: string | null }): string;
  supports: { resume: boolean; transcript: boolean; model: boolean;
              effort: boolean; selfSchedule: boolean };
}
```

- `Slot` bekommt `harness: string | null` (null = claude, volle Rückwärts-Kompat).
- `slotCmd` wird `harness.spawnCmd(...)`; der heutige claude-Zweig wird Adapter #1.
- Jedes Feature, das claude annimmt, fragt künftig `supports.*` und **degradiert
  sichtbar** (kein Transcript-Toggle, kein ✨/🔍, kein „bring session back" für
  einen Harness ohne resume) statt still zu brechen.
- UI: im Picker-Dir-Detail eine Options-Zeile (Harness-Select + harness-
  spezifische Optionen wie Modell/Effort) neben „Start session here"/„⎇ New lane
  here" — die „unten fest"-Variante, die der Owner bevorzugt. **Befund der
  Nachprüfung (2. Runde):** es gibt heute NIRGENDS im Client eine Spawn-Option —
  die Server-Routen akzeptieren `model` längst (`modelOf`, server.ts:8561, 9498,
  9518), aber kein Client-Aufruf sendet es (`newLane` client.ts:1177 postet nur
  `{repo, branch}`). Die Options-Zeile ist also die ERSTE Spawn-Options-UI
  überhaupt und schließt nebenbei eine bestehende Lücke: Modell-pro-Slot ist
  bisher nur per API erreichbar, nie per Klick. Die Schnellpfade (⎇+ quicklane,
  ⌘Enter) bleiben Ein-Klick und nehmen Defaults (claude + DEFAULT_MODEL).
- **Mit ZWEI Harnesses anfangen** (claude + der eine, der wirklich installiert
  ist), nicht mit vieren. Zwei erzwingen die Abstraktion; vier multiplizieren nur
  die Testfläche.

**Warum clarify-first, nicht Lane:** vor jeder Zeile Code sind Owner-Fragen offen —
(a) welche CLIs sind auf der Maschine real installiert und in welcher Version,
(b) welche Spawn-Flags (Modell/Effort/Resume) hat jedes davon wirklich — nicht aus
dem Gedächtnis behaupten, `--help` lesen, (c) reicht Interactive-TUI-in-Pane oder
wird print-mode/API erwartet, (d) was heißt „Effort" außerhalb von claude konkret.
Sicherheitsrand: jeder Spawn-String landet in einer tmux-Shell-Zeile — pro Adapter
gilt dieselbe Validierungs-Disziplin wie `MODEL_RE` (server.ts:100-102), sonst ist
das Options-Feld ein Injection-Vektor.

**Owner-Antworten (2026-08-06, direkt eingeholt):**
- **Keine der vier CLIs ist installiert; Pi ist das spannendste Ziel.** Harness #2
  = Pi, opencode/Codex frühestens danach. Aus der Clarify-Lane wird damit ein
  **Pi-Spike**: erst verifizieren, WAS „Pi" konkret ist (Primärquelle suchen —
  der Name stammt aus dem Owner-Prompt, nicht aus dem Gedächtnis auf ein Paket
  zeigen), dann installieren, dann `--help` der ECHTEN Installation als Wahrheit
  für das Adapter-Interface nehmen.
- **Installation ist Maschinen-Ebene**, außerhalb jedes Worktrees — normalerweise
  stoppt eine Lane davor (shared reality). Der Owner hat den Spike sanktioniert:
  Installation ausdrücklich erlaubt, aber **user-lokal** (~/.local, bun/npm
  user-scope — keine System-Pfade, kein sudo, kein brew-global), und der Spike
  baut NICHTS in server.ts um. Ergebnis ist ein Adapter-Brief, kein Code.
- **Modus („robust und vernünftig", Owner war unsicher → Entscheid hier):
  Interactive-TUI in der Pane ist die primäre Integrationsform** — Fleets gesamte
  Maschinerie (paste-buffer-Send server.ts:1651, capture-pane, Idle-Erkennung,
  Transcript-Anzeige) ist Pane-basiert; ein zweiter Harness in derselben Form
  erbt sie alle. Ein print-/API-Modus wäre eine zweite Produktfläche und kommt
  erst, wenn TUI-in-Pane an Pi einen realen Mangel zeigt — der Spike notiert
  dann den Mangel, statt ihn still zu umbauen.

**Done (nach Clarify):** ein Slot lässt sich mit Harness B spawnen, arbeitet in
der Pane, und ALLE claude-only-Features sind auf diesem Slot sichtbar degradiert
statt kaputt; `./e2e-claude-gate.sh` bleibt grün (der quoted-model-Check dort ist
der Kanarienvogel für slotCmd-Umbauten).

## F2 — Pastellfarbe pro Projekt

**Wunsch:** jede Session + Worktree im selben Projekt bekommt automatisch dieselbe
angenehme Pastellfarbe.

**Empfehlung:** deterministisch, kein Zustand — Hash über den kanonischen
Repo-Pfad (`s.worktree?.repo ?? s.cwd`; Lanes erben so automatisch die Farbe ihres
Haupt-Repos) → Hue, feste Sättigung/Helligkeit in HSL, je ein Wertepaar für
Hell/Dunkel-Theme. Sichtbar als schmale linke Border/Chip der Slot-Row und als
Akzent im Pane-Header. Kollisionsfrei muss es nicht sein — bei einer Handvoll
Projekte reicht gut gestreuter Hue (goldener Winkel).

**Done:** zwei Slots im selben Repo (Main + Lane) tragen sichtbar dieselbe Farbe,
zwei Repos verschiedene; Farben identisch nach Reload (deterministisch); beide
Themes lesbar. Reine Client-Sache: `bun run build` + Sichtprüfung, kein Server-Diff.

## F3 — Slot-Gruppierung: Stapel unter der Main-Session

**Wunsch:** Lanes gruppieren sich unter der Main-Session ihres Projekts zu einem
einfarbigen Stapel; Klick klappt auf und bleibt auf. Owner-Entscheid schon
getroffen: **ein Stapel hängt an genau EINER Main-Session** („wahrscheinlich
sowohl einfacher und besser"). Ziel: Übersicht + Platz, ohne die Slot-Zahl zu
erhöhen.

**Empfehlung:**
- Gruppierung ist eine **Render-Sache**, keine Daten-Sache: Slot-IDs, fleet.json,
  Server bleiben unberührt. `renderSlots` gruppiert nach kanonischem Repo-Pfad;
  Anker = der non-lane-Slot mit der niedrigsten ID in diesem Repo.
- Zugeklappt: Anker-Row + Chip „⎇ N" in der Projektfarbe (F2 zuerst — die Farbe
  IST die Stapel-Identität). Aufgeklappt: Lane-Rows leicht eingerückt darunter;
  Zustand in localStorage, bleibt auf (per Gerät — Handy und Desktop dürfen
  verschieden aufgeklappt sein, das ist gewollt).
- **Klick-Semantik, wörtlich vom Owner** („erst aufklappt und klickbar wenn man
  auf ihn drückt, bleibt dann auf"): Klick auf den ZUGEKLAPPTEN Stapel klappt nur
  auf — er wechselt NICHT die Pane. Erst danach sind die Rows normal klickbar;
  ein weiterer Klick auf die Anker-Row fokussiert die Main-Session. Zuklappen
  über ein kleines ▾/▸ am Anker, nie über den Row-Klick (sonst kann man die
  Main-Session nicht mehr fokussieren, ohne den Stapel zu schließen).
- **Zweite Main-Session im selben Repo** (Owner-Lean: ein Stapel = EIN Anker):
  Anker ist der non-lane-Slot mit der niedrigsten ID; jede weitere Main-Session
  des Repos bleibt eine normale flache Row — mit derselben Projektfarbe, damit
  die Zugehörigkeit sichtbar bleibt, aber ohne zweiten Stapel. (Default, im
  Clarify-Block unten bestätigen lassen.)
- **Drei Kanten, die über Gelingen entscheiden:**
  1. Lanes ohne Main-Session im selben Repo (kommt real vor — Dispatcher-Lanes):
     eigener schmaler Repo-Header als Anker, nie unsichtbar.
  2. Fokus schlägt Collapse: `showSlot`/Tastatur-Navigation auf eine eingeklappte
     Lane klappt den Stapel auf — eine Lane, die Aufmerksamkeit braucht
     (`mergePending` ⏸, 💬, hot-dot), darf nicht hinter dem Stapel verschwinden;
     solche Badges aggregiert der zugeklappte Anker.
  3. Das „fixed places"-Prinzip (client.ts:3739) wird hier bewusst gebogen:
     Empty-Slots bleiben flach an ihrem Platz, nur belegte Lane-Rows ziehen unter
     ihren Anker. Im Commit-Body festhalten, dass das Absicht ist.
- **Kein Migrate-Zustand — Gruppierung wird abgeleitet, nie gespeichert** (Owner-
  Frage 2026-08-06: „was, wenn eine neue Main anfängt, obwohl ein alter Worktree
  noch existiert?"). Genau darum ist die Render-Ableitung die richtige Form: eine
  neue Main-Session im Repo IST beim nächsten Render der Anker, die Lanes rutschen
  von selbst unter sie; stirbt die Main, greift der Repo-Header (Kante 1). Es
  existiert kein gespeicherter Stapel, der veralten oder migriert werden könnte.
- **Ghost-Rows statt Migrate-Knopf (Erweiterung aus derselben Owner-Frage):**
  Worktrees, die auf der Platte liegen, aber keine Session haben, sind heute NUR
  im Board sichtbar (lanes-Sektion: „open" = reattach via `POST /api/lanes
  {attach}`, client.ts:2265-2280; „close" mit Discard-Gate; Shelve-Note reist
  mit, client.ts:2309). Der aufgeklappte Stapel zeigt sie als Ghost-Rows
  („⎇ branch · on disk", gedimmt, in Projektfarbe) — Klick = adopt in einen
  freien Slot über die EXISTIERENDE attach-Route, null neuer Server-Code. Der
  Stapel wird damit die vollständige Projekt-Wahrheit: laufende UND geparkte
  Lanes. **Poll-Disziplin:** die Worktree-Liste erst beim Aufklappen laden
  (lazy, wie loadGuest), NIE im 2s-Poll — `/api/sessions` ist laut
  Data-Saver-Befund schon der teuerste Pfad der App, und pro Repo git zu
  spawnen würde ihn vervielfachen.

**Done:** 2 Repos × (1 Main + 2 Lanes) rendern als 2 Stapel; auf/zu bleibt über
Reload; Fokus auf eingeklappte Lane klappt auf; ⏸/💬/hot am Anker sichtbar, wenn
zu; Main-Session killen → Lanes hängen am Repo-Header, neue Main im Repo starten
→ sie ist ohne weiteres Zutun der neue Anker; ein sessionsloser Worktree
erscheint als Ghost-Row und „adopt" hängt ihn in einen freien Slot. Client-only
bis auf die Lazy-Fetch-Nutzung bestehender Routen; `bun run build` + Sichtprüfung.

## F4 — Board-Neuordnung + git-HEAD

**Wunsch-Reihenfolge des Owners:** Slot-/Directory-Infos + Share oben → zu
landende Commits → schon gemachte Commits (Session/Projekt, „vllt beides") →
in der Session angefasste Files → File-Explorer (F5) → Worktrees → Gastzugang →
der Rest („mittlerweile wahrscheinlich ziemlich überholte" Summary/Review-Buttons).
Plus: git-HEAD sichtbar.

**Das meiste existiert** — es ist eine Um-Sortierung von `renderBoard` plus ein
Server-Feld, KEIN Neubau:

| Owner-Wunsch | heute | Delta |
|---|---|---|
| Infos + Share oben | identity, Platz 3 | deploy/gate davor LASSEN (Alarme, nur sichtbar wenn fällig — Owner-Entscheid 2026-08-04) |
| zu landende Commits | work: „N ready to land" + Commit-Liste | work aufteilen: LAND-PENDING vor Historie |
| gemachte Commits | work: „commits this session" | „vllt beides": Lane-Commits UND Repo-recent — zwei Subheads |
| angefasste Files | work: „files changed vs base" | bleibt, rückt hinter die Commits |
| File-Explorer | — | **F5, neu** |
| Worktrees | lanes, Platz 5 | rückt hinter F5 |
| Gastzugang | guest, Platz 6 | bleibt relativ |
| Summary/Review | **agents, Platz 4** | ans Ende UND hinter „more ▸" (Owner-yep 2026-08-06), zugeklappt per Default — NICHT löschen (③-Review schreibt weiter das Outcome-Ledger) |
| git-HEAD | fehlt im Brief | `head` (short-SHA) in die Brief-Route + `BriefInfo` (client.ts:675), Anzeige in identity neben Branch |

Outline (prompts) bleibt letzter. **Done:** Board zeigt die neue Reihenfolge, HEAD
steht in identity und wechselt nach einem Commit; tsc + `bun run build` grün;
`./e2e-isolated.sh` grün (Board-Checks existieren in e2e/).

## F5 — File-Explorer im Board + Lese-/Edit-Editor

**Wunsch:** simpler File-Explorer über das aktuelle Repo; Klick öffnet einen
simplen, robusten Editor — erst ganz lesen/verstehen, **Bearbeiten erst nach
extra Klick**. (Owner denkt schon an agentisches Code-Review darauf — Anschluss
offen halten, nicht bauen.)

**Empfehlung:**
- **Die Lese-Hälfte EXISTIERT schon — wiederverwenden, nicht neu bauen**
  (Anschauungs-Befund, s. Nachtrag unten): `GET /api/file` (server.ts:9038)
  liefert Datei-Bytes von Platte ODER aus einem Commit (`rev` via `git show`),
  und `showFileView` (client.ts:3457) rendert sie bereits mit Versions-
  Ehrlichkeit („as it is on disk right now" / „in commit X") — heute erreichbar
  über das Review-Fenster („read the whole file"). F5 schrumpft damit auf:
  **(a)** eine Tree-Route (`git ls-files` — billig, ehrlich, kein
  node_modules-Müll), **(b)** den Explorer-Baum im Board als weiteren EINSTIEG
  in dieselbe FileView, **(c)** die neue Write-Route + ✎-Edit-Zustand in der
  FileView (nur nach explizitem Klick).
- **Der eine Sicherheitsrand, der nicht verhandelbar ist — präzisiert auf die
  WRITE-Route:** `/api/file` liest bewusst jeden absoluten Pfad (Owner-only;
  dieselbe Philosophie, mit der der Picker die ganze Home browst — das ist
  bestehendes Design, nicht anfassen). Die neue File-PUT-Route dagegen wird
  gegen `realpath(slot.cwd)` prefix-geprüft (Symlink-aufgelöst, wie `canonPath`
  es im Dispatcher-Deckel vormacht), mit Größen-Cap, binary-refuse und hartem
  Ausschluss von `.env`/`fleet.json`: das Repo ist public, der Server hält
  Secrets, und ein Schreib-Gadget über die Maschine ist die eine Route, die es
  nie geben darf.
- **Editor bewusst simpel:** `<textarea>` monospace + Zeilenzähler, dirty-Marker,
  Save, Esc. KEIN CodeMirror/Monaco im ersten Schnitt — 6.700 Zeilen client.ts
  brauchen keine Editor-Dependency, und „simpel aber robust" ist wörtlich der
  Auftrag. Konflikt-Schutz light: beim Save den beim Laden gemerkten Content-Hash
  mitschicken; Server lehnt bei Drift ab (Agent hat parallel geschrieben — real
  in einer working Lane).
- Warnhinweis im Editor, wenn die Session gerade ● working ist (Signal existiert:
  `sessionActive`, client.ts:958).
- **Reichweiten-Grenze benennen:** das Board rendert auf Mobile gar nicht
  (`renderBoard` returned bei `isMobile()`, client.ts:1760, plus CSS-Breakpoints)
  — Explorer + Editor sind damit im ersten Schnitt Desktop-only. Bewusst so
  lassen (ein Editor auf dem Handy ist ein eigenes Projekt); im Clarify-Block
  unten steht die Frage, ob dem Owner das reicht.

**Done:** File im Board-Explorer anklicken → Inhalt lesbar; Edit-Klick → ändern →
Save → `git diff` im Worktree zeigt exakt die Änderung; Pfad-Escape (`../`,
Symlink) wird mit 400 abgelehnt und ein e2e-Check beweist das (e2e/, Familie
security); Guest-Token kommt nicht dran.

## F6 — Drag&Drop / Paste: Dateien & Bilder in eine Session geben

**Wunsch:** Dateien/Bilder ins Fleet-Fenster droppen, um sie einer Session zu
geben und direkt in der Nachricht zu erwähnen.

**Empfehlung:**
- Client: Drop-Zone über Pane + Composer (`dragover`/`drop` auf `#main`), plus
  `paste`-Handler im Composer für Screenshots aus der Zwischenablage — der
  Paste-Fall ist im Alltag der häufigere.
- Server: `POST /api/slots/:id/upload` (multipart, Cap ~20 MB, Owner-Auth).
- **Ablage-Ort ist DIE Design-Entscheidung:** NICHT in den Worktree. Untracked
  Files blocken den Land (Lane-Disziplin), landen im `git status` des Agenten
  und im Zweifel im public Repo. Stattdessen `~/.claude-fleet/drops/<slot>/
  <ts>-<name>` — außerhalb jedes Repos (gleiche Logik wie die Guest-Verzeichnisse
  außerhalb des public Repos). Claude liest absolute Pfade problemlos, Bilder
  eingeschlossen.
- Nach Upload fügt der Client die Erwähnung in den Composer ein — „direkt in der
  Nachricht erwähnt", der Owner tippt den Rest. **Format in der Lane VERIFIZIEREN,
  nicht annehmen:** ob ein per tmux paste-buffer eingefügtes `@/abs/pfad` die
  @-Mention der claude-CLI wirklich auslöst, ist ungeprüft — der robuste Fallback
  ist schlichter Text (`attached: /abs/pfad — read it`), das Modell liest den Pfad
  per Read ohnehin. Erst testen, dann das schönere Format wählen.
- **Handy-Parität von Anfang an:** Drag&Drop existiert auf dem Phone schlicht
  nicht — dieselbe Upload-Route braucht dort einen 📎-Knopf neben dem Composer
  (`<input type=file>`, öffnet Kamera/Fotos/Dateien). Der Owner bedient Fleet
  real vom Handy (die rowacts-Leiste existiert genau dafür, client.ts:3860);
  ein Desktop-only-Upload wäre das halbe Feature. Paste im Composer deckt
  Desktop-Screenshots, 📎 deckt Mobile — beides über dieselbe Route.
- Retention von Anfang an mitliefern (Löschen beim Slot-Kill + Alters-Sweep),
  sonst wächst ein unsichtbares Verzeichnis für immer.

**Done:** PNG auf die Pane droppen → Pfad steht im Composer → senden → Session
liest das Bild nachweislich (beschreibt den Inhalt); dito Textdatei; dito einmal
über den 📎-Knopf (der Handy-Pfad, am Desktop testbar); 25-MB-Datei wird mit
klarer Meldung abgelehnt; Kill räumt `drops/<slot>/` weg. e2e-Check für die
Route (Auth + Cap + Pfad).

## F7 — Drag&Drop im File-Explorer (Phase 2)

Owner: „wäre natürlich auch sehr cool". Explizit HINTER F5+F6 — es komponiert
beide (Upload-Route + Explorer-Baum, Ziel dann bewusst IM Worktree). Nicht vorher
anfangen; eigener Task, wenn F5/F6 gelandet sind.

---

## Aus eigener Anschauung — Nachtrag (2026-08-06)

Nach der Owner-Antwort-Runde wurde die UI real gefahren: isolierte Instanz nach
dem sanktionierten Muster (Scratch-Kopie, `127.0.0.1:8877`, eigener tmux-Socket,
`FLEET_CMD=true`, `FLEET_ANALYSIS_MS=0`/`FLEET_AUTO_REVIEW_MS=0` gegen
Agenten-Spawns), geseedet mit 2 Repos, Main + arbeitender Lane (dirty + 1 ahead),
Non-Git-Session und einem absichtlich verwaisten Worktree; per Browser bedient
(Desktop 1440px + Phone 390px): Sidebar, Board Main + Lane, Diff-Fenster,
Whole-File-View, Picker, Queue-Overlay, Mobile-Drawer. Was NICHT angesehen wurde:
Share/Guest-Flows, Transcript-View, Audit/Outcome-Overlays (leer in der
Test-Instanz), echte claude-Sessions in den Panes.

**Funde, klein aber real (alle im Code verifiziert):**

1. **Branch-Truncation zeigt das Ende nicht** — fleet-Branches teilen ~16
   Zeichen Präfix (`fleet/260806142…`), und die lanes-Sektion schnitt im Test
   BEIDE Lanes auf denselben String; unterscheidbar waren sie nur noch an den
   Buttons. Die Identität steckt im SUFFIX (die Slot-Labels machen es richtig:
   „webapp b2cb"). Fix: Mitte-Ellipsis oder Suffix behalten, eine CSS/JS-Zeile
   in der bwtbr-Row (client.ts:2240).
2. **Untracked-Tooltip lügt** — eine `??`-Datei zeigt „staged + unstaged
   changes": in der Ternary-Kette (client.ts:1905) wird `x !== " "` vor
   `f.startsWith("??")` geprüft, und bei `??` sind beide Porcelain-Spalten
   gesetzt. Badge-Klasse ist korrekt (`new`), nur der title-Zweig gehört
   umsortiert. Einzeiler.
3. **⎇+ auf jeder leeren Row ist Rauschen** — 12 identische Quicklane-Chips,
   sobald eine Repo-Session fokussiert ist (renderSlots hängt den Chip an JEDE
   Empty-Row, client.ts:3753). Nach F3 gehört „⎇ neue Lane" an den
   Stapel-Anker — dort steht der Kontext (WELCHES Repo), und die Empty-Rows
   werden wieder still. In den F2/F3-Schnitt aufgenommen.
4. **F3 nützt dem Phone am meisten** — im Mobile-Drawer trägt jede belegte Row
   ihre rowacts-Leiste und ist damit doppelt so hoch; vier Sessions + zwölf
   Empty-Rows füllen bereits mehr als eine Bildschirmhöhe. Der Drawer ist die
   primäre Phone-Navigation; die Stapel halbieren ihn. Bestätigt die
   Priorität von F2/F3, ändert nichts am Schnitt.
5. **F5s Lese-Treppe existiert schon** — Diff-Fenster („to land"/„uncommitted",
   per-File-Hunks) → „read the whole file" → FileView mit Quellen-Zeile. Der
   Editor ist Stufe 3 derselben Treppe (✎ in der FileView), der Board-Explorer
   nur ein weiterer Einstieg. §F5 oben entsprechend umgeschrieben — die Lane
   baut KEINE parallele Datei-Ansicht.

**Was der Rundgang bestätigt hat, ohne Änderungsbedarf:** die Board-Erzählung
Main vs. Lane trägt (Main: clean/commits/agents; Lane: uncommitted → commit →
land — genau die Owner-Reihenfolge aus F4, nur mit agents zu früh); der
verwaiste Worktree ist in „lanes" mit open/close voll bedienbar (die
Ghost-Rows aus §F3 machen ihn nur SICHTBAR, die Mechanik existiert); die
Gate-Zeile benennt einen stale Suite-Lock ehrlich mit pid und Alter.

---

## Reihenfolge & Schnitt (Empfehlung)

1. **F4** — kleinster Eingriff, sofort sichtbarer Wert, baut das Gerüst, in das
   F5 einzieht. Eine Lane.
2. **F2 → F3** — EINE Lane, F2 zuerst (die Farbe ist die Stapel-Identität).
3. **F6** — unabhängig von allem, hoher Alltagswert. Eine Lane.
4. **F5** — größte neue Fläche, NACH F4 (sonst zweimal ins Board-Layout
   schneiden). Eine Lane.
5. **F1** — clarify-first mit dem Owner (Fragen oben), erst danach Adapter-Lane.
6. **F7** — Phase 2.

**Parallelitäts-Warnung:** alle UI-Lanes schneiden in dieselbe 6.700-Zeilen-Datei
`src/client.ts`. F4 und F5 berühren beide `renderBoard` → strikt sequenziell.
F2/F3 (`renderSlots`) und F6 (Composer + neue Server-Route) sind zueinander und
zu F4 weitgehend disjunkt — **maximal zwei UI-Lanes gleichzeitig**, und nach
jedem Land rebasen die offenen Lanes, bevor sie weiterbauen. Der
Merge-Resolver repariert Konflikte, aber ein 3-Wege-Konflikt im selben Render-
Funktionskörper ist vermeidbarer Selbstbeschuss.

Jede Lane läuft das volle Gate (CLAUDE.md Verify-Zeile); F5/F6 schreiben ihre
Server-Checks in `e2e/` neben die passende Familie, nie ans Runner-EOF.

---

## Owner-Fragen — Stand nach der Antwort-Runde (2026-08-06)

Alle fünf gestellt, vier beantwortet, eine erklärt-und-als-Default-stehend:

1. **F1 — beantwortet:** keine der CLIs ist installiert; **Pi zuerst**. Details
   und Konsequenzen (Pi-Spike, sanktionierte user-lokale Installation) in §F1.
2. **F1 Modus — beantwortet** („robust und vernünftig", sonst unsicher):
   übersetzt in den Entscheid TUI-in-der-Pane, §F1.
3. **Mobile — beantwortet:** Desktop-only-Editor ist für den ersten Schnitt ok;
   F6 behält den 📎-Handy-Pfad.
4. **F4 Summary/Review — beantwortet (yep):** ans Ende UND hinter einen
   „more ▸"-Aufklapper — zugeklappt per Default, nichts wird gelöscht.
5. **F3-Defaults — nachgefragt, Frage kam nicht verständlich an.** Die Defaults
   stehen im §F3 in Klartext (welcher Slot der Stapel-Kopf ist; was mit einer
   zweiten Main-Session im selben Repo passiert; dass Zuklappen über einen
   eigenen Pfeil geht, nicht über den Row-Klick). Sie gelten, bis der Owner beim
   ersten Anfassen des Features widerspricht — die F2/F3-Lane baut sie so und
   zeigt sie vor.

## Queue — fertige Task-Texte

Owner-Weg A: 🗒-Overlay → Task anlegen (Texte unten einfügen), dann promote.
Owner-Weg B: Main-Session im Haupt-Checkout:

```sh
# TOKEN + FLEET_HOST aus der .env des Haupt-Checkouts; queue:true = direkt queued.
# Auth ist Bearer/Cookie/?token= (tokenFrom, server.ts:5878) — einen x-fleet-token-
# Header gibt es NICHT (die 2. Prüfrunde hat genau den hier gefunden und ersetzt).
curl -s -X POST "http://$FLEET_HOST:8790/api/tasks" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"text":"<Task-Text>","queue":true}'
```

Task-Texte (jeder verweist auf dieses Dossier — die Lane liest den Abschnitt,
nicht eine Nacherzählung):

1. `F4 Board-Neuordnung + git-HEAD — briefs/ui-next-level-2026-08-06.md §F4 lesen und exakt diesen Schnitt bauen. Reihenfolge deploy/gate→identity(+HEAD)→land-pending→commits→files→lanes→guest→agents(hinter "more ▸", zu per Default)→outline; head-Feld in Brief-Route+BriefInfo. Volle Gate-Verify.`
2. `F2+F3 Projekt-Pastellfarben + Slot-Stapel — briefs/ui-next-level-2026-08-06.md §F2+§F3+Nachtrag. Erst Farben (deterministisch aus Repo-Pfad, beide Themes), dann Gruppierung unter Ein-Anker-Main-Session mit den drei benannten Kanten (verwaiste Lanes, Fokus-schlägt-Collapse, Badge-Aggregation) plus Ghost-Rows für sessionslose Worktrees (adopt via bestehender attach-Route, lazy beim Aufklappen laden — NIE im 2s-Poll). Dabei den ⎇+-Chip von den 12 Empty-Rows an den Stapel-Anker ziehen (Nachtrag Fund 3). Client-only bis auf Lazy-Fetches bestehender Routen.`
3. `F6 Drag&Drop/Paste/📎-Uploads — briefs/ui-next-level-2026-08-06.md §F6. Upload-Route (multipart, Cap, Owner-Auth), Ablage AUSSERHALB des Worktrees (~/.claude-fleet/drops/<slot>/), Composer-Mention (Format erst verifizieren: triggert tmux-Paste die @-Mention?), 📎-Knopf für Mobile, Retention, e2e-Check für Auth+Cap.`
4. `F5 Board-File-Explorer + Editor — briefs/ui-next-level-2026-08-06.md §F5 (inkl. Nachtrag Fund 5). NACH F4 starten. git-ls-files-Tree; LESEN über die existierende /api/file+showFileView-Treppe (nichts Paralleles bauen); NEU nur die Write-Route mit realpath-Prefix-Guard + .env/fleet.json-Ausschluss, ✎-Edit erst nach extra Klick, Content-Hash-Konfliktschutz, security-e2e für Pfad-Escape auf der WRITE-Route.`
5. `F1 Pi-Spike (KEIN Umbau) — briefs/ui-next-level-2026-08-06.md §F1 lesen. Verifizieren was 'Pi' konkret ist (Primärquelle, nicht raten), user-lokal installieren (vom Owner 2026-08-06 sanktioniert: user-scope, kein sudo/brew-global), --help + Spawn/Resume/Modell/Effort-Flags dokumentieren, TUI-in-Pane kurz real in einem tmux testen. Ergebnis: Adapter-Brief (Harness-Interface gegen die echte CLI geschärft) — server.ts bleibt unangetastet, danach STOPPEN und berichten.`

6. `Mini-Fixes aus dem UI-Rundgang — briefs/ui-next-level-2026-08-06.md, Nachtrag Funde 1+2. (a) Branch-Truncation in der lanes-Sektion Suffix-erhaltend machen (bwtbr, client.ts:2240) — fleet-Branches unterscheiden sich nur hinten. (b) Untracked-Tooltip-Ternary umsortieren (client.ts:1905): ?? zeigt fälschlich 'staged + unstaged changes'. Winzig, zusammen eine Lane.`

Die Clarify-Vorfragen zu F1 sind beantwortet (§F1, Owner-Antworten) — der Spike
ist damit queuebar wie die anderen vier.

Nicht von hier queuebar (Lane, self-token ist slot-gebunden — geprüft an
server.ts:9116, die Route verlangt Owner-Auth); darum liegen die Texte hier.
