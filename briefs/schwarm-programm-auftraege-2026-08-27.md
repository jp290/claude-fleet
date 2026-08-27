# Arbeitsaufträge zum Schwarm-Programm

Quelle: `docs/schwarm-programm-2026-08-27.md` (Fassung `a8aa258`, nach Gegencheck `e3e5d29`).
Fünf Aufträge. **B ist gestrichen** (1,9 % Wiederholer-Quote gemessen), steht dort als „nicht
beauftragt".

Jeder Abschnitt unten ist ein **vollständiger, pasteable Brief**. Kette: P0 → P0b → A → C.
D1 ist unabhängig und darf parallel.

Modellzuordnung und ihr Grund:

| Auftrag | Harness/Modell | Warum |
|---|---|---|
| P0 | claude / opus, effort high | Definiert das Schema, an dem alles Spätere hängt — Urteilsarbeit auf kleiner Fläche |
| P0b | pi-zai / glm-5.3, effort max | 30 Notizen × ~18,5 KB ≈ 139k Tokens; GLMs 1M-Fenster trägt das, ein ~258k-Fenster nicht |
| A | claude / opus, effort high | Validator- und Pin-Wechselwirkung |
| C | claude / opus, effort high | Schreibarbeit mit Urteil |
| D1 | claude / opus, effort high | Empfindlichste Fläche: `server.ts` auf dem Tick-Pfad |

**Standard-Verbotsblock** (steht in jedem Brief, hier einmal begründet): kein Server starten
(`bun server.ts` mit Default-Env adoptiert den LIVE-Socket) · kein `./e2e-isolated.sh` außer wo
ausdrücklich verlangt (~9 min, nimmt den Suite-Mutex, den der Live-Server für Post-Land-Audits
braucht) · nichts außerhalb des eigenen Worktrees (kein `~/.claude`, kein anderes Repo, kein
launchd) · **keine Prozess-Kommandozeile ausgeben** (`ps -eo command`, `ps eww`) — fremde
Self-Tokens stehen in den Pane-Kommandostrings; zählen ja (`ps -eo command | grep -c '<muster>'`),
Zeilen ausgeben nein · `rg` respektiert `.gitignore`, und gitignored sind `CLAUDE.md`,
`fleet.json`, `*.jsonl`, `.env`, `.agents/` — dafür `rg -uu` oder `grep`, sonst liest sich ein
leeres Ergebnis wie „gibt es nicht".

**Herkunft der Verify-Zeilen (nachgeprüft 2026-08-27).** Die unten ausgeschriebenen Ketten sind die
LOKALE Beweiskette. Der autoritative Land-Gate ist `watchdog.sh:91` `VERIFY_CMD`; er trägt zusätzlich
den Sentinel-Guard (`[ -f fleet-e2e.ts ] || … exit 42`) und einen expliziten install-Fehlerzweig
(`|| { echo "verify failed: …"; exit 1; }`) statt `&&`. Inhaltlich dieselbe Schrittfolge — aber die
Fassung in `CLAUDE.md` ist eine Vereinfachung, und bei Abweichung gilt die Datei. Frag im Zweifel
`GET /api/self/gate` (self-token, lane-only): die Route liest den Env des LAUFENDEN Servers.

---

## P0 — Claim-Block und Index im `mess-notiz`-Skill

**Auftrag in einem Satz.** Gib dem `mess-notiz`-Template ein maschinenlesbares Front-Matter und
lass jede Notiz sich selbst in einen Index eintragen.

**Warum das die Vorbedingung von allem ist.** `docs/messungen/` hat 30 Notizen, 555 730 Bytes, und
drei gelesene davon hatten drei verschiedene Strukturen. Eine Maschine findet die Dateien, kann sie
aber nicht quer lesen. Ohne das gibt es nichts, worauf ein Kontext-Pack zeigen könnte (A), und
nichts, was ein Synthese-Schritt lesen könnte (C).

**Was du tust.**
1. Lies `.claude/skills/mess-notiz/SKILL.md` (67 Zeilen, getrackt seit `3235561`) ganz.

**ACHTUNG, das ist die Falle dieses Auftrags.** Die Datei hat ZWEI Front-Matter-Ebenen:
- Zeilen 1–4 sind das **Front-Matter des SKILLS selbst** (`name:`, `description:`). **Fass das nicht
  an.**
- Ab ~Zeile 27 steht in einem ```markdown-Block das **Template der NOTIZ** (`# <Frage…>`,
  `## Ergebnis`, `## Methode`, `## Was nicht gemessen wurde`). **Dorthin** gehört das neue
  Front-Matter — an den Anfang des Template-Blocks, also in das, was eine Lane später in ihre
  `.md`-Datei schreibt.
Wer das verwechselt, gibt dem Skill ein Feld `frage:` und jeder Notiz keins.

2. Ergänze das NOTIZ-Template um dieses Front-Matter, wörtlich diese sechs Felder:

       ---
       frage: <eine Zeile — was gemessen wurde>
       urteil: <eine Zeile — die ANTWORT, nicht die Zusammenfassung>
       bereich: [<tag>, <tag>]
       belege: [<pfad>#<symbol>, ...]
       nicht-gemessen: <eine Zeile>
       stand: YYYY-MM-DD
       ---

3. Ergänze das Skill um den Schritt: die Notiz hängt EINE Zeile an `docs/messungen/INDEX.md` an,
   Format `- <urteil> — docs/messungen/<datei>.md · bereich: a,b · stand: YYYY-MM-DD`.
4. Lege `docs/messungen/INDEX.md` an, mit einer Überschrift und einem Satz, was die Datei ist.
   Noch ohne Einträge — die kommen in P0b.
5. Schreib in das Skill EINEN Satz, dass bei fremdem Harness (`pi-*`, `codex`) das Template in den
   Brief gehört, weil `.agents/` gitignored ist und im Worktree fehlt.
6. **Eine einzige veraltete Zahl korrigieren, sonst nichts.** Das Skill begründet sich mit
   „97 von 350 Lanes … `killed-empty` (28 %, gemessen 2026-08-19)". Frisch gezogen am 2026-08-27:
   **123 von 567 Lane-Ausgängen, 21,7 %** (gegen 371 `landed`). Setz die neue Zahl mit Datum daneben
   oder an ihre Stelle — die Herleitung in `docs/werkzeugkosten-grundlinie-2026-08-19.md` bleibt
   unangetastet. **Miss nicht selbst nach**, die Zahl steht hier; und ändere sonst keinen Satz der
   Begründung.

**Ausdrücklich KEIN Pin.** Die erste Fassung des Programms verlangte einen Pin, der
`.claude/skills/…` und `.agents/skills/…` synchron hält. Das ist widerlegt: `.agents/` ist
gitignored (`.gitignore:49`) und existiert in keinem Worktree — ein strenger Pin wäre in jeder Lane
rot. Es gibt EINE getrackte Quelle und eine maschinenlokale Kopie. **Fass `.agents/` nicht an und
baue keinen Pin.**

**Done-Kriterium (ein Satz).** `.claude/skills/mess-notiz/SKILL.md` verlangt die sechs Felder und
die Index-Zeile, `docs/messungen/INDEX.md` existiert, und eine nach dem neuen Template
probeweise geschriebene Notiz hat gültiges Front-Matter und genau eine Index-Zeile.

**Verify (wörtlich).**

    bun install --frozen-lockfile && bun e2e/pins.ts

Grün = letzte Zeile `ALL PASS`. Dein Diff ist reine Doku, das ist die richtige kurze Kette.

**Nicht-Umfang.** Kein Server-Code. Keine Änderung an bestehenden Notizen (das ist P0b). Keine
Laufzeit-Validierung des Front-Matters. Kein Generator für den Index — er wird angehängt, nicht
erzeugt; ein generierter Index driftet.

**Offene Frage, die du NICHT selbst entscheidest.** Ob `bereich` freie Tags oder eine feste Liste
trägt, ist eine Owner-Entscheidung. Bau es als **freie Tags** und schreib in den Report, welche
Tags du beim Entwurf natürlich gefunden hättest — das ist die Vorlage für die Entscheidung.

**Melden.** Kurzbericht per `POST /api/self/fleet-report`. Die Skill-Änderung zusätzlich als Text
im Report, denn sie ist klein und der Owner will sie sehen, bevor P0b 30 Dateien danach ausrichtet.

---

## P0b — Retrofit der 30 vorhandenen Notizen

**Auftrag in einem Satz.** Gib jeder der 30 Notizen in `docs/messungen/` das Front-Matter aus P0
und trag sie in `INDEX.md` ein.

**Voraussetzung.** P0 ist gelandet. Lies zuerst `.claude/skills/mess-notiz/SKILL.md` — das dortige
Front-Matter ist verbindlich, nicht das, was du für besser hältst.

**Was du tust.** Für jede Datei in `docs/messungen/` (30 Stück, ~555 KB gesamt), in
alphabetischer Reihenfolge:
1. Notiz lesen.
2. `frage` und `urteil` **aus der Notiz belegen** — nicht formulieren, was du für gemeint hältst.
   Wenn die Notiz kein klares Urteil trägt, schreib `urteil: <kein explizites Urteil in der Notiz>`
   und vermerk die Datei in deinem Report. Das ist ein Befund, kein Versagen.
3. `belege` mit den Fundstellen füllen, die die Notiz selbst nennt (max 5, die tragendsten).
4. `bereich` mit 1–3 Tags.
5. `nicht-gemessen` aus dem entsprechenden Abschnitt, falls vorhanden, sonst
   `<nicht ausgewiesen>`.
6. `stand` aus dem Dateinamen oder dem Datum in der Notiz.
7. Eine Zeile an `INDEX.md` anhängen.

**Das schärfste Verbot dieses Auftrags.** **Kein Umschreiben der Notiz-Körper.** Kein Glätten,
kein Vereinheitlichen der Überschriften, kein Korrigieren von Zahlen, die dir falsch vorkommen.
Du stellst Front-Matter voran und indizierst — sonst nichts. Widersprüche zwischen Notizen löst du
NICHT auf, du nennst sie im Report. Wer beim Aufräumen glättet, zerstört Belege.

**Done-Kriterium (ein Satz).** Alle 30 Dateien tragen gültiges Front-Matter mit den sechs Feldern,
`INDEX.md` hat 30 Zeilen, und in einer Stichprobe von drei zufälligen Notizen steht das `urteil`
wörtlich oder sinngleich so in der Notiz.

**Verify (wörtlich).**

    bun install --frozen-lockfile && bun e2e/pins.ts

Zusätzlich selbst prüfen, mit konkreten Zahlen statt Gefühl: `docs/messungen/` enthielt am
2026-08-27 **30 Notizen**; nach P0 kommt `INDEX.md` dazu, also zählt `ls docs/messungen/*.md | wc -l`
danach **31**. `INDEX.md` trägt **30 Eintragszeilen** plus seine Überschrift. Stimmt eine der beiden
Zahlen nicht, hast du eine Notiz übersprungen oder `INDEX.md` mitindiziert — beides ist ein Fehler,
kein Rundungsproblem.

**Nicht-Umfang.** Keine neuen Notizen. Keine Änderung am Skill. Kein Löschen veralteter Notizen —
auch nicht, wenn eine offensichtlich überholt ist; das ist eine Owner-Entscheidung.

**Kontext-Disziplin.** 30 Notizen sind ~139k Tokens, wenn du sie alle offen hältst. Arbeite in
Blöcken von fünf, committe nach jedem Block, und **melde dich bei halbvollem Kontext**.

---

## A — Ein Context-Pack, das auf den Index zeigt

**Auftrag in einem Satz.** Trag ein Pack in `.fleet/context-packs.json` ein, das jeder frisch
dispatchten Lane einen Zeiger auf `docs/messungen/INDEX.md` in den Anchor-Block legt.

**Voraussetzung.** P0 und P0b sind gelandet, `INDEX.md` hat Inhalt.

**Was du wissen musst, bevor du anfängst.** Der Zustellkanal existiert und ist streng:
`server.ts#briefAndSend` liefert `brief + anchorBlock + LANE_EXIT_FOOTER`, sonst nichts. Der
Anchor-Block trägt **nur Zeiger** — `context-pack-validator.ts` wirft `PACK_CONTENT_FORBIDDEN`
(:163) und `SOURCE_CONTENT_FORBIDDEN` (:260) als **error**, und `SOURCE_KEYS` (:98) erlaubt genau
`path` und `anchor`. Ein defektes Pack wird nicht etwa ignoriert, sondern als
`omitted: "manifest-invalid"` verweigert (`context-manifest.ts:87-90`). Lies das vorhandene Pack
`rulebook-generat` in `.fleet/context-packs.json` als Vorlage — dein Eintrag hat dieselben Felder.

**Was du tust.**
1. Ein Pack anlegen: `triggers: ["always"]`, `sources: [{path: "docs/messungen/INDEX.md",
   anchor: "<die tatsächliche Überschrift der Datei>"}]`, `harnesses` wie beim Vorbild (alle),
   `estimatedBytes` realistisch aus der Dateigröße.
2. Einen Check ergänzen, der beweist, dass das Pack ausgeliefert wird — Familie
   `e2e/context-plan.ts` (Auswahl-Leiter) oder `e2e/context-packs.ts` (Vokabular/Validator).
   Sieh dir an, wie die vorhandenen Checks dort das Vorbild-Pack prüfen, und bau daneben.

**Ausdrücklich NICHT.** **Fass `DISPATCH_CONTEXT_TRIGGERS` nicht an.** Die Trigger-Menge aus
`next: Task` abzuleiten wäre der naheliegende nächste Schritt und bricht `e2e/pins.ts#RULE_REACH`
(:1381-1383) — der behauptet **absichtlich** exakte Gleichheit zwischen dormanten und erreichten
Triggern. Solange ein `always`-Pack mit Index die Frage beantwortet, ist die Verbreiterung
unbezahlte Komplexität. Wenn du beim Bauen zu dem Schluss kommst, dass es ohne nicht geht:
**stoppen und melden**, nicht den Pin anfassen.

**Done-Kriterium (ein Satz).** Eine dispatchte Lane bekommt im Anchor-Block eine Zeile, die auf
`docs/messungen/INDEX.md` zeigt, die Quittung in `context-receipts.jsonl` führt das Pack in
`selected[]`, und der neue Check ist grün.

**Verify (wörtlich).**

    bun install --frozen-lockfile && bun e2e/pins.ts && \
    bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun \
      e2e/pins.ts src/client.ts src/share.ts src/helper.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts \
      fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts \
      merge-prompt.ts && \
    bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh

**Und hier ausnahmsweise auch die Vorschau:** `./e2e-isolated.sh` (Ausgabe in eine Log-DATEI, dann
Tail lesen — nicht in den Kontext leiten). Grund: du änderst eine Aussage, über die eine Behauptung
steht (ein Kontrakt-Default im Manifest), und `e2e/security.ts` läuft ausschließlich dort.

**Nicht-Umfang.** Keine Änderung an `briefAndSend`, am Validator, am Manifest-Schema. Kein zweites
Pack. Kein Pack mit eingebettetem Inhalt — das ist strukturell verboten und der Validator sagt es dir.

---

## C — Schwarm-Praxis dokumentieren (kein Code)

**Auftrag in einem Satz.** Schreib die Arbeitsweise „N Lanes auf EINE Frage, Befunde statt Commits"
so auf, dass sie jemand aufsetzen kann, ohne `server.ts` zu lesen.

**Warum kein Code.** Beide Bausteine existieren. Es fehlt die Beschreibung, wie man sie
zusammensetzt, plus die Deckel-Fakten, die sonst jede Session neu ausmisst.

**Die vier Fakten, die belegt in die Seite gehören** (jeder mit `datei#symbol`, prüf sie nach,
zitier sie nicht aus diesem Brief):
1. Lanes **programm-gebunden** öffnen macht `POST /api/self/fleet-report` legal — `basis:
   "program-main"` aus `clarificationReceiverFor`. Nenne beide 409-Türen — sie stehen in
   `server.ts#openFleetReport` direkt untereinander: erst `clarificationReceiverFor(s)` mit
   `if ("error" in resolved) … 409`, dann `if (slotDeliveryBudget(resolved.receiver.slot).free === 0)
   … 409` („fleet-report receiver has no FleetEvent delivery budget"). Verweise per Symbol, nicht
   per Zeile.
2. Jede Lane schreibt eine Messnotiz und landet sie über die Docs-Kurzkette:
   `verify-proportion.ts#ruleFor` → `DOC_RULE` → `DOC_STEPS = ["install","pins"]`. Beleg aus der
   Praxis, den du zitieren darfst: der Gegencheck-Land `e3e5d29` lief in **559 ms**, `fleet/land`-Note
   `verify.proportional: true`.
3. Keine Lane landet Code. Findings-Lanes fahren keine Suite und nehmen darum den Suite-Mutex
   `/tmp/fleet-e2e.lock` nie (der stammt allein aus `e2e-stage.sh`).
4. Der beaufsichtigte Pfad `POST /api/lanes` hat **keinen Lane-Deckel**; `DISPATCH_MAX_LANES` bindet
   nur den Tick (`tickDispatch`); die reale Decke ist `MAX_SLOTS = 16`.

**Dazu die Tatsache aus dem 2026-08-27-Lauf:** eine Lane mit fremdem Harness hat **keine Skills** im
Worktree (`.agents/` ist gitignored). Die GLM-Gegencheck-Lane lieferte trotzdem eine formgerechte
Notiz, weil die Struktur im Brief stand. Regel für die Seite: **bei fremdem Harness gehört das
Notiz-Template in den Brief.**

**Risiken, die in die Seite gehören.** Maschinenlast (die gemessene Nicht-Determiniertheit bei zwei
gleichzeitigen isolierten Suiten gilt auch für N Lanes) · Provider-Kontext · die 16-Slot-Decke wird
mit echter Arbeit geteilt · und dass ein Schwarm ohne Synthese-Schritt nur Papier produziert.

**Done-Kriterium (ein Satz).** Die Seite existiert, ein Leser kann daraus einen Schwarm-Lauf
aufsetzen ohne `server.ts` zu lesen, alle vier Fakten sind mit `datei#symbol` belegt, und die
Risiken stehen drin.

**Verify (wörtlich).**

    bun install --frozen-lockfile && bun e2e/pins.ts && bun review-sweep.ts

`review-sweep.ts` prüft die `docs/*.md`-Anker; Exit 2 heißt nur „ein Check konnte nicht laufen",
nicht „rot".

**Nicht-Umfang.** Kein Board-Knopf, keine Route, kein „Schwarm-Objekt". Wenn das Aufsetzen von Hand
nervt, ist DANN der Zeitpunkt für Mechanik — nicht vorher. Und keine Regelbuch-Änderung aus der Lane
heraus: `CLAUDE.md` ist gitignored und ein Generat aus `rulebook.ts`; schlag den Absatz im Report als
Text vor.

---

## D1 — Stuck-Retention in `tickGit`

**Auftrag in einem Satz.** Mach den Zustand „Budget steigt, Fortschritt nicht" sichtbar — als
Merkmal auf einer Route, das nichts tut.

**Warum.** Das ist gleichzeitig die unproduktive Lane und die Vorbedingung dafür, dass ein Agent
kreativ außerhalb seiner Grenzen arbeitet. Das Regelbuch hat dafür nur eine Bitte („Same
fix-run-fail loop ~5×? stop and report"), keinen Sensor. Und `lane-signals.ts#laneStalled` ist
blind dafür: es verlangt `idle`, aber eine Lane in der Schleife druckt ununterbrochen, also wird
`idleMs >= t` nie wahr.

**Was du wissen musst.** Beide Zahlen fallen schon an und werden nicht zurückbehalten, aber in
**zwei verschiedenen Kadenzen** — das ist der Kern der Aufgabe:
- `contextFill(s)` im **2-s-Owner-Poll** (`server.ts:20643`), ausdrücklich „the app's most
  expensive path".
- `gitInfo.set(s.id, {branch, dirty, ahead, behind})` im **10-s-`tickGit`** (`:17742`, Schleife
  `:4209`, `:4269`).

**Was du tust.** In `tickGit` je Slot **eine Vorprobe** behalten (`usedTokens`, `ahead`, `dirty`,
Zeitstempel) und daraus ein Merkmal rechnen: `usedTokens` um mehr als N gestiegen, `ahead`
unverändert, `dirty` flach, über T. Ausgeben neben `stalled` auf `/api/steward/sessions`
(`laneSignalView`).

**N und T sind NICHT deine Entscheidung.** Owner-Vorgabe zum Draufschlagen: N = 15 % Fensterzuwachs,
T = 20 min. Beides ist geraten. Bau sie als benannte Konstanten an EINER Stelle, damit die
Kalibrierung später eine Zeile ist, und schreib in den Report, welche Werte du an den Lanes, die
während deiner Arbeit liefen, tatsächlich beobachtet hättest.

**Das schärfste Nicht-Umfang dieses Auftrags.** **Der Sensor gated nichts, tötet nichts, schickt
nichts, requeued nichts.** Kein Auto, kein Watch, kein Event, kein Board-Alarm. Er ist ein Feld auf
einer Antwort. Ein Detektor, der handelt, ist ein anderes Vorhaben mit anderen Risiken — und die
Geschichte dieses Repos kennt genug Automatiken, die beerdigt wurden.

**Ebenfalls nicht.** Keine Transkript-Analyse. Das schärfere Signal wäre „wiederholte identische
Bash-Kommandos mit Exit ≠ 0", und die Daten liegen in dem Transkript, das
`server.ts#laneToolResultBytes` (`:13232`) ohnehin durchläuft — aber die Funktion liest ganze
Verzeichnisse ganz und läuft nur beim Land. Auf einen Tick gelegt liest sie jeden Zyklus Megabytes.
Das braucht einen inkrementellen Leser und ist ein eigener Auftrag.

**Done-Kriterium (ein Satz).** Für einen Slot, dessen `usedTokens` über T um mehr als N wächst,
ohne dass `ahead` oder `dirty` sich bewegen, liefert `/api/steward/sessions` ein wahres Merkmal —
und für einen Slot, der in derselben Zeit committet, ein falsches.

**Verify (wörtlich).**

    bun install --frozen-lockfile && bun e2e/pins.ts && \
    bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun \
      e2e/pins.ts src/client.ts src/share.ts src/helper.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts \
      fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts \
      merge-prompt.ts && \
    bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh

**Wo der Check hingehört, damit du nicht suchen musst.** `/api/steward/sessions` wird in
`e2e/lanes-lifecycle.ts` abgefragt — der einzige echte Fetch der Steward-Sicht in der Suite; das ist
die erste Adresse. `e2e/review.ts` und `e2e/prompts.ts` haben zwar viele `stalled`-Treffer, die
betreffen aber Review- und Prompt-Zustände, nicht die Lane-Signale: bau dort NICHT hinein. Das
Prädikat lebt in `lane-signals.ts` (`STALLED_RULES`, `laneStalled`), der View in
`server.ts#laneSignalView`. Passt `e2e/lanes-lifecycle.ts` nach deiner Lektüre nicht, melde die
bessere Familie im Report — leg keine neue Datei an.

**Ein Hinweis, der dir Zeit spart.** Deine Sonde braucht kontrollierte Werte, keine echten Lanes.
Bau sie so, dass sie die Vorprobe direkt setzt, statt auf einen Tick zu warten — und wenn die Sonde
ihre Voraussetzung nicht herstellen kann, muss sie **als sie selbst scheitern** (eigener `check()`
auf die Voraussetzung), nie als das, was sie messen sollte.
