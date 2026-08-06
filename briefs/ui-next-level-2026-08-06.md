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
- UI: im Picker-Dir-Detail (wo heute das Modell gewählt wird) ein Harness-Select +
  harness-spezifische Optionen darunter — das ist die „unten fest"-Variante, die
  der Owner bevorzugt.
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
  Zustand in localStorage, bleibt auf.
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

**Done:** 2 Repos × (1 Main + 2 Lanes) rendern als 2 Stapel; auf/zu bleibt über
Reload; Fokus auf eingeklappte Lane klappt auf; ⏸/💬/hot am Anker sichtbar, wenn
zu. Client-only; `bun run build` + Sichtprüfung.

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
| Summary/Review | **agents, Platz 4** | ans Ende — NICHT löschen, nur degradieren (③-Review schreibt weiter das Outcome-Ledger) |
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
- **Server, 3 Routen** (Owner-Auth, nie Guest): Tree (git-tracked Files des
  Slot-Repos — `git ls-files` ist der billigste ehrliche Explorer und zeigt
  keinen node_modules-Müll), File-GET (Größen-Cap ~1 MB, binary-Erkennung →
  refuse), File-PUT (nur nach explizitem Edit-Klick im Client).
- **Der eine Sicherheitsrand, der nicht verhandelbar ist:** Pfad wird gegen
  `realpath(slot.cwd)` prefix-geprüft (Symlink-aufgelöst, wie `canonPath` es im
  Dispatcher-Deckel vormacht) — die Route macht aus einem UI-Feature sonst
  ein Read/Write-Gadget über die ganze Maschine. `.env` und `fleet.json`
  zusätzlich hart ausschließen: das Repo ist public, der Server hält Secrets.
- **Editor bewusst simpel:** `<textarea>` monospace + Zeilenzähler, dirty-Marker,
  Save, Esc. KEIN CodeMirror/Monaco im ersten Schnitt — 6.700 Zeilen client.ts
  brauchen keine Editor-Dependency, und „simpel aber robust" ist wörtlich der
  Auftrag. Konflikt-Schutz light: beim Save den beim Laden gemerkten Content-Hash
  mitschicken; Server lehnt bei Drift ab (Agent hat parallel geschrieben — real
  in einer working Lane).
- Warnhinweis im Editor, wenn die Session gerade ● working ist (Signal existiert:
  `sessionActive`, client.ts:958).

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
- Nach Upload fügt der Client `@/abs/pfad` in den Composer ein — „direkt in der
  Nachricht erwähnt", der Owner tippt den Rest.
- Retention von Anfang an mitliefern (Löschen beim Slot-Kill + Alters-Sweep),
  sonst wächst ein unsichtbares Verzeichnis für immer.

**Done:** PNG auf die Pane droppen → Pfad steht im Composer → senden → Session
liest das Bild nachweislich (beschreibt den Inhalt); dito Textdatei; 25-MB-Datei
wird mit klarer Meldung abgelehnt; Kill räumt `drops/<slot>/` weg. e2e-Check für
die Route (Auth + Cap + Pfad).

## F7 — Drag&Drop im File-Explorer (Phase 2)

Owner: „wäre natürlich auch sehr cool". Explizit HINTER F5+F6 — es komponiert
beide (Upload-Route + Explorer-Baum, Ziel dann bewusst IM Worktree). Nicht vorher
anfangen; eigener Task, wenn F5/F6 gelandet sind.

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

## Queue — fertige Task-Texte

Owner-Weg A: 🗒-Overlay → Task anlegen (Texte unten einfügen), dann promote.
Owner-Weg B: Main-Session im Haupt-Checkout:

```sh
# TOKEN + FLEET_HOST aus der .env des Haupt-Checkouts; queue:true = direkt queued
curl -s -X POST "http://$FLEET_HOST:8790/api/tasks" \
  -H "x-fleet-token: $TOKEN" -H "content-type: application/json" \
  -d '{"text":"<Task-Text>","queue":true}'
```

Task-Texte (jeder verweist auf dieses Dossier — die Lane liest den Abschnitt,
nicht eine Nacherzählung):

1. `F4 Board-Neuordnung + git-HEAD — briefs/ui-next-level-2026-08-06.md §F4 lesen und exakt diesen Schnitt bauen. Reihenfolge deploy/gate→identity(+HEAD)→land-pending→commits→files→lanes→guest→agents→outline; head-Feld in Brief-Route+BriefInfo. Volle Gate-Verify.`
2. `F2+F3 Projekt-Pastellfarben + Slot-Stapel — briefs/ui-next-level-2026-08-06.md §F2+§F3. Erst Farben (deterministisch aus Repo-Pfad, beide Themes), dann Gruppierung unter Ein-Anker-Main-Session mit den drei benannten Kanten (verwaiste Lanes, Fokus-schlägt-Collapse, Badge-Aggregation). Client-only.`
3. `F6 Drag&Drop/Paste-Uploads — briefs/ui-next-level-2026-08-06.md §F6. Upload-Route (multipart, Cap, Owner-Auth), Ablage AUSSERHALB des Worktrees (~/.claude-fleet/drops/<slot>/), Composer-Mention, Retention, e2e-Check für Auth+Cap.`
4. `F5 Board-File-Explorer + Editor — briefs/ui-next-level-2026-08-06.md §F5. NACH F4 starten. git-ls-files-Tree, Read-Route mit realpath-Prefix-Guard + .env/fleet.json-Ausschluss, Edit erst nach extra Klick, Content-Hash-Konfliktschutz, security-e2e für Pfad-Escape.`
5. (kein Task) `F1 Harness-Auswahl` → erst Clarify-Gespräch, Fragen in §F1.

Nicht von hier queuebar (Lane, self-token ist slot-gebunden — geprüft an
server.ts:9116, die Route verlangt Owner-Auth); darum liegen die Texte hier.
