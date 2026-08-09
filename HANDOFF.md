# HANDOFF — Session 44 (2026-08-09 nachts: drei GPT-Lands, und ein `checkout --`, das fremde Arbeit fraß) · 43/42/41/40/39/38 darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log 3863b29..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, was in Flug ist, Korrekturen.*

---

## Session 44: drei pi/GPT-Lanes, drei Lands, und der erste Live-Beweis des Rückkanals

**ctx beim Übergeben: ~28 %.** Produziert: **3 Lands** (alle aus pi/gpt-5.6-sol-Lanes über den
Dispatch-Knopf, alle drei Queue-Zeilen haben sich beim Land SELBST geschlossen), **3 grüne
Tier-2-Audits**, **2 Deploys**, **1 neue Queue-Zeile mit Messung**, **3 Regelbuch-Einträge**, und ein
`graphify update`.

| Commit | was |
|---|---|
| `5358a2a` | die Zaun-Pin: Schreibwurzeln von `piSandboxProfile` ↔ `PI_HARNESS.note`, beide Richtungen, unmapped = FAIL |
| `4354048` | der Rückkanal: `laneHostCommitLooking` als ZWEITES Prädikat + `Harness.hostCommits` als Pflichtfeld |
| `76e948c` | `POST /api/tasks/:id/dispatch` reicht `effort` durch (bis dahin still ignoriert → Adapter-Default) |

Audits: `5358a2a` green · `4354048` green · `76e948c` **lief beim Übergeben noch** — nachsehen, nicht
annehmen (`tail -1 post-land-audits.jsonl`). Deploy-Stand beim Übergeben: `4354048` ist deployt,
**`76e948c` ist es NICHT** (`codeBehind: true`, 1 dahinter) — der srv-Restart wartet auf das Ende
seines Audits, weil ein srv-Kill mitten im Audit ihn GAR KEINE Zeile schreiben lässt.

### KORREKTUR an Session 43s Handoff

**`3863b29` HAT einen Audit-Eintrag** — der neue Boot hat ihn nachgeholt (`result: "green"`,
`exitCode 0`, 678 s). S43 schrieb, er fehle und das sei Absicht; die Abdeckungslücke im Register
existiert nicht. Der Mechanismus dahinter bleibt aber wahr und ist die eigentliche Lehre: stirbt srv
selbst, schreibt der Audit keine Zeile — aber der nächste Boot fährt ihn nach.

### MEIN FEHLER, und er ist der teuerste Posten dieser Session

**`git checkout -- server.ts` im Lane-Worktree hat 98 Zeilen uncommittete Lane-Arbeit gelöscht.** Ich
hatte eine Mutationsprobe gefahren (Adapter-Wert flippen, Pin muss rot werden) und danach
zurückgesetzt. Bei der Lane davor war exakt dieselbe Probe harmlos, weil `server.ts` dort unberührt
war — **daraus wurde ein Handgriff, und der Handgriff war die Falle.** Seit der Arbeitsteilung ist der
Normalfall, dass eine fremde Lane fertige Arbeit UNCOMMITTET hält (sie KANN nicht committen), also
gibt es im Lane-Worktree keinen sicheren `checkout --` mehr.

Erholung: die Lane hat ihre sieben Stellen aus dem eigenen Gedächtnis neu eingetragen — **der Compiler
war das Netz**, weil `lane-signals.ts` und die vier `e2e/`-Dateien die neuen Namen schon
referenzierten, und der Diff kam auf dieselben 98 Zeilen. Kosten: ein zweiter 11-min-Suite-Lauf.
Steht als Regel in `CLAUDE.md`: `git stash push -- <datei>` oder eine Kopie — besser noch **erst der
Host-Commit, dann die Probe**, dann ist `checkout --` wieder harmlos.

### DER RÜCKKANAL IST LIVE — und die Messung an ihm ist wertvoller als das Feature

`4354048` gibt einer eingezäunten Lane einen Namen für ihren Fertig-Zustand (`dirty>0 && ahead===0`,
disjunkt zu `doneLooking` per `ahead`-Klausel) und lässt `POST /api/self/watch` darauf feuern. **Ich
habe es unmittelbar nach dem Deploy auf die nächste laufende pi-Lane scharf gestellt**, und das
Ergebnis ist zweigeteilt:

- **Das Prädikat trägt, live bewiesen:** `hostCommitLooking` kippte auf der Steward-Sicht von `false`
  auf `true`, genau als `idleMs` die 60-s-Schwelle passierte (41810 → 54013 → **66203 = erster
  true**), bei `dirty 6 / ahead 0 / alive / gitOp false / awaiting null`.
- **Die Nachricht kam NICHT an**, ~25 min lang `armed:true, firedAt:null`, obwohl das Ziel-Prädikat
  818 s true stand. Ursache ist das Busy-Gate der Zustellung, nicht das Prädikat: `canDeliver` prüft
  `now - s.lastOutput` am EMPFÄNGER, und **eine Claude-Code-Pane repaintet während eines Tool-Calls**
  (Spinner/Token-Zähler) — mein `idleMs` stand bei **64 ms** mitten in einer Kette, in der 10 min
  nichts Sichtbares in die Pane ging. Also: **der Watch erreicht eine PARKENDE Session, nicht eine
  ARBEITENDE** — und letztere ist genau der Fall, für den `00e5f771` gebaut wurde.
- Zweitbefund: **es gibt keine Route, einen Watch zu entwaffnen oder umzuhängen** (kein `DELETE` in
  `server.ts`), und ein zweites Abo auf dasselbe Ziel gibt denselben zurück. Der dokumentierte
  `idleSec:0`-Opt-out ist damit unerreichbar, sobald ein Watch mit `idleSec>0` existiert — daran ist
  mein Zustellungs-Beweis gescheitert.

Beides steht mit Messwerten und drei offenen Fragen in der neuen Zeile **`fc47f1e1`**. **Nicht
nebenbei anfassen:** die naheliegende Reparatur (`lastOutput` soll Spinner-Bytes von Agenten-Bytes
trennen) hängt an JEDEM `canDeliver`-Aufrufer — Autos, Steward-Send, auto-③. Der kleine Schnitt ist
die Entwaffnungs-Route.

### WAS DIE ARBEITSTEILUNG DIESE SESSION GEKOSTET UND GEBRACHT HAT

Dreimal derselbe Takt, und er funktioniert: **briefen → Lane produziert → HOST fährt
`./e2e-isolated.sh` (~11 min) → HOST committet mit echtem Body → landen → Audit → deployen.**

- **Der Host-Lauf ist Pflicht, nicht Vorsicht.** Alle drei Lanes hatten Checks in Familien, die eine
  eingezäunte Lane strukturell nicht fahren kann (`e2e/lanes-lifecycle.ts`, `e2e/watch.ts`,
  `e2e/prompts.ts`, `e2e/security.ts` §6, `fleet-e2e-harness.ts`). Vier Läufe, alle grün — die Lanes
  haben blind geschrieben und richtig geschrieben.
- **Eine Runde Nachschärfen ist billig und lohnt.** Bei `5358a2a` hatte die Lane eine hartkodierte
  Erwartungstabelle gebaut — genau der Schnappschuss, den `e2e/pins.ts`' eigener Kopf verbietet. Ein
  `POST /send` mit einer präzisen Anweisung, und sie hat die pi-Hälfte aus der `.git`-Deny-Klausel
  ABGELEITET; für claude/codex/container blieb eine benannte Owner-Entscheidung, weil im Baum nichts
  steht, woraus sie ableitbar wäre. **Vorher fragen, ob die Regel eine Regel ist.**
- **Kosten, gemessen:** ~9 Punkte meines Fensters für drei Lands inkl. zweier Suite-Wiederholungen.
  Lane-Verbrauch: 20 % / 56 % / 36 % ihres 258 400er Fensters.

### KLEINKRAM, der Zeit spart

- **Der Owner-Poll will `authorization: Bearer <token>`** — `x-fleet-token` gibt es nicht,
  `x-fleet-self-token` ist nur der Self-Pfad. Token: `python3 -c "import json;print(json.load(open('fleet.json'))['token'])"`,
  Steward-Token analog aus `stewardToken`. Hat mich zwei Fehlversuche gekostet.
- **Die Merge-/Land-Route ist `POST /api/slots/:id/merge`**, nicht `.../land`. Der Owner-Send ist
  `POST /send` mit `{slot, text}` — **nicht** `/api/slots/:id/send` (404).
- **Ein Watcher auf eine fremde Lane braucht ZWEI unabhängige Klauseln.** Stille allein reicht nicht:
  ein GPT-Modell schweigt während eines langen Denkzuges minutenlang, und 120 s Ruhe haben mich einmal
  mitten in der Arbeit geweckt (die Lane editierte gerade `server.ts`). Was trägt:
  `#{session_activity}` bewegt sich ≥3 min nicht **UND**
  `capture-pane -p | grep -c 'Working\.\.\.\|Esc to interrupt'` = 0 **UND** `git status --porcelain`
  nicht leer. Steht so im Regelbuch.
- **`e2e-isolated.sh` puffert:** die Log-Datei bleibt ~11 min bei zwei Lock-Zeilen und schreibt dann
  alles. Ein `tail` nach 2 min sieht wie ein Hänger aus. Und ein `grep -c '^FAIL'` mit 0 Treffern
  liefert exit 1 — das liest sich in der Task-Notification als „failed", ist aber grün.
- **Meine `until`-Warteschleifen wurden zweimal bei 10 min abgeschnitten** (Tool-Timeout-Deckel), der
  Hintergrundprozess lief weiter. Für >10 min: `run_in_background` und auf die Notification warten.

### REIHENFOLGE, die ich empfehle

1. **`76e948c` deployen**, sobald sein Audit durch ist (`tmux -L claudefleet kill-session -t srv`,
   dann `deployGap.codeBehind` + `bundleStale` + `errors` auf `/api/sessions` prüfen). Kein
   `bun run build` nötig — kein Client-Quellcode in diesen drei Lands.
2. **`fc47f1e1`** — der Rückkanal-Befund oben. Erst entscheiden, welcher der beiden Schnitte
   (Entwaffnungs-Route vs. `lastOutput`-Semantik); der zweite ist weitreichend.
3. Aus dem Register mit hartem Kriterium und in-Domain: **`2975afe9`** (ein `/send` an eine noch
   bootende fremde TUI geht ins Leere) — `ready`, Fläche `e2e-claude-gate.sh` + `server.ts`.
4. **Nicht neu untersuchen:** die needs-you-Zeilen (Sols Durchgang von 2026-08-08 gilt weiter, seine
   ZEILENANGABEN sind gedriftet, seine Urteile nicht) und das Attic-Backlog (beerdigt 2026-08-07).

### IN FLUG BEIM ÜBERGEBEN

Der Post-Land-Audit zu `76e948c`. Slot 2 (`fleet/260808114656-6e86`) ist weiterhin die
ZURÜCKGESTELLTE ToS-Lane: nicht landen, nicht killen. Sonst nichts.

---

# HANDOFF — Session 43 (2026-08-08 nachts: der erste GPT-Arbeitstag, und drei Sonden, die vor dem Code kaputt waren) · 42/41/40/39/38 darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log f8665ac..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, was in Flug ist, Korrekturen.*

---

## Session 43: drei GPT-Lanes, drei Lands, und die Erkenntnis, dass die Arbeitsteilung der Endzustand ist

**ctx beim Übergeben: ~38 %.** Produziert: **3 Lands** aus pi/gpt-5.6-sol-Lanes, **1 Direkt-Commit**,
**1 rotes Tier-2-Audit adjudiziert**, **2 neue Queue-Zeilen**, **4 Regelbuch-Einträge**, und eine
Bewertung von zwei Owner-Vorschlägen, die beide anders ausgingen als gedacht.

| Commit | was |
|---|---|
| `8e154dd` | Codex-Effort via `-c model_reasoning_effort`, feste Liste; `resume --last` gemessen statt pauschal verneint |
| `6cc8283` | **Direkt-Commit** — die zurückgebliebene §6e-Behauptung, die das Tier-2-Audit fand |
| `2682bdc` | pi-Zaun: `~/.bun/install/cache` als Schreibwurzel, wahre Picker-Notiz, ausführbare Fixture |
| `08c7787` | pi-ctx-Sensor: eigener `Harness.context`-Hook, GPT-Fenster 258 400, sechste Absenz |

**EIN POST-LAND-AUDIT ÜBERLEBT EINEN srv-KILL — gemessen 2026-08-08 an `3863b29`.** Der Deploy kam
mitten in seinem Audit (Owner-Entscheid; der Audit war ohnehin redundant, weil das Land ein
Fast-Forward auf genau den Commit war, den ich host-seitig schon grün vermessen hatte). Ergebnis:
**der Audit lief zu Ende und schrieb `green`, 678 s, `exit 0`** — dieselbe Laufzeit wie ein
ungestörter.

**Ich hatte hier zuerst das Gegenteil stehen**, weil ich ~4 min nach dem Kill nachsah, keine Zeile
fand und daraus einen Mechanismus schloss („stirbt srv, schreibt der Audit gar keine Zeile"). Beobachtet
hatte ich nur „noch keine Zeile" — ein Audit braucht ~11 min. Derselbe Fehler wie bei den drei Watchern:
eine Momentaufnahme als Gesetz gelesen.

**Der Mechanismus ist NICHT gemessen** (überlebt der Kindprozess verwaist? schreibt der neu gebootete srv
die Zeile? beides plausibel) — also bau nichts darauf. Was gilt: **der Fall von 2026-08-06 bleibt der
gefährliche, und er ist ein ANDERER** — dort traf `pkill -f 'e2e-isolated.sh'` die Suite selbst, srv lebte
und protokollierte `exit 143` als falsches Rot. Regel unverändert: **nie ein Namensmuster killen**, die
notierte PID nehmen. Ein srv-Kill ist danach *nicht* dasselbe wie ein Suite-Kill.

**`6cc8283` ist ein Direkt-Commit und darum für jedes land-seitige Ledger unsichtbar** — kein
`fleet/land`-Note, keine `lane-outcomes`-Zeile, **kein automatischer Post-Land-Audit**. Die
Verifikation ist von Hand vollständig gefahren (`./e2e-isolated.sh` → exit 0, 0 FAIL, ALL PASS).
Wer `post-land-audits.jsonl` liest, schließt sonst korrekt-aber-falsch, er sei nie vermessen worden.

### DIE ARBEITSTEILUNG IST DER ENDZUSTAND, nicht eine Übergangslösung

Das ist der Satz, der die nächste Session am meisten spart. Gemessen (`2682bdc`), nicht geschlossen:

- **Eine pi-Lane KANN hinter ihrem Zaun:** `bun e2e/pins.ts`, `bunx tsc`, `bun run build`,
  `./e2e-security.sh`.
- **Sie KANN NICHT:** alles claude-Abhängige — `./e2e-claude-gate.sh` stirbt an `ENOENT` auf eine
  Transkript-Datei unter `~/.claude/projects/…`, `./e2e-isolated.sh` an `EPERM` beim Anlegen ebendort.
- **`~/.claude` aufzumachen ist der falsche Fix.** Lane produziert, Host verifiziert — und eine
  ehrliche Grenze ist mehr wert als eine aufgeweichte.

**Operative Folge, plan sie ein:** wer eine fremde Lane briefet, plant **einen host-seitigen
`./e2e-isolated.sh`-Lauf ein (~11 min)** — besonders, wenn die Arbeit in `e2e/*.ts` liegt, denn diese
Familie läuft NUR dort. Ich habe ihn heute viermal gefahren und er hat dreimal etwas gefunden.

Ebenso gemessen: **Buns Meldung `unable to write files to tempdir: PermissionDenied` meint NICHT
`$TMPDIR`**, sondern seinen Package-Cache. Der Fehlermeldung zu glauben hätte die falsche Wurzel
geöffnet.

**WAS EINE FREMDE LANE AN ORIENTIERUNG HAT — und es ist weniger, als man denkt** (gemessen
2026-08-08). **Keinen graphify-Graphen**: `graphify-out/` ist gitignored (`.gitignore:35`), ein
Worktree bekommt nur getrackte Dateien — das gilt für JEDE Lane, auch claude, ist also kein
GPT-Nachteil. **`.claude/commands` und `.claude/skills` SIND im Baum** (15 getrackte Dateien, sie
reisen mit) — **aber für pi/codex tote Buchstaben**, das sind Claude-Code-Konventionen, die kein
fremder Agent liest. **Hooks hat sie gar keine** (die leben in `~/.claude/settings.json`, außerhalb
des Repos). Was bleibt: `AGENTS.md`, der getrackte Baum, `rg`/`ast-grep`, und dein Brief. **Der Brief
IST ihre Orientierungsschicht, weil es sonst keine gibt** — das ist der eigentliche Grund, warum die
Datei:Zeile-Disziplin so viel trägt und nicht bloß Höflichkeit ist.

### DIE LEHRE DES TAGES: die Sonde war viermal der erste Verdächtige — und einmal war BEIDES kaputt

Vier rote Läufe, jeder an frisch geschriebener Arbeit, jeder aufgelöst durch das Lesen der SIGNATUR
statt durch das Glauben des Fehlschlags:

1. **Die Escaping-Falle, zum ZWEITEN Mal in diesem Repo.** Profil aus `#{pane_start_command}`
   gehoben, tmux escaped `"`, SBPL liest `\"` als unbound variable — drei Zaun-Behauptungen fielen,
   ohne den Zaun je befragt zu haben. `e2e/lanes-basic.ts:53` löst das seit `f18c1ec` und nennt es im
   Kommentar „this check's own first red"; 400 Zeilen weiter wurde es wiederholt. **Das Wissen stand
   geschrieben und ist nicht angekommen.**
2. **Die Fixture daneben konnte es strukturell nicht fangen**, weil sie auf `(version 1)` und
   `(deny file-write*)` prüfte — **beide enthalten kein Anführungszeichen** und überleben die
   Verstümmelung. Daraus die Regel, die über Sandboxen hinausgeht und jetzt im Regelbuch steht:
   **eine Fixture für ein ausführbares Artefakt muss es AUSFÜHREN.**
3. **Der realpath-Slug — und hier war die Sonde kaputt UND der Code.** pi ist ein node-Prozess,
   `process.cwd()` liefert den physischen Pfad, also legt es `--private-var-folders-…--` an, während
   Fleet `/var/folders/…` kennt. Eine Lane unter `<repo>.worktrees/…` durchquert keinen Symlink —
   dort hätte der Defekt jahrelang richtig ausgesehen. **Wer nach der ersten Erklärung aufhört,
   repariert die Hälfte und hält es für fertig.**
4. **Eine Sonden-Anordnung, die nichts beweist, ohne rot zu werden.** Der Absenz-Check und der
   Mehrdeutigkeits-Check des ctx-Sensors erwarten BEIDE `null` — sie bestehen also auch, wenn der
   Leser ausnahmslos `null` liefert. Sie sind nur gültig, weil der positive Check HINTER ihnen steht.
   Wer die Reihenfolge dreht oder ihn entfernt, nimmt beiden die Beweiskraft, und nichts wird rot.
   **Ich habe diese drei Grünen zuerst selbst als Entlastung gelesen. Waren sie nicht.**

### DAS ROTE TIER-2-AUDIT: der benannte Preis wurde zum ERSTEN MAL fällig

`8e154dd` gab codex eine Effort-Fähigkeit; `e2e/security.ts` behauptete an einer zweiten Stelle noch
den alten Kontrakt und wurde rot — **9 min nach dem Land, in der am 2026-08-07 vorhergesagten Form und
Frist.** Adjudiziert als `stale-test`, repariert in `6cc8283`. **Der Entscheid bleibt richtig**, und
der Mechanismus hat funktioniert.

**Korrektur an meiner eigenen Regelbuch-Zeile von zwei Stunden vorher:** ich schrieb erst „wenn du
`e2e/*.ts` anfasst" — das zielt daneben. Die Lane änderte einen **Adapter-Wert in `server.ts`**; die
zurückgebliebene Behauptung lag woanders. Der richtige Auslöser ist: **du änderst eine Aussage, über
die irgendwo eine Behauptung steht** (ein `supports.*`, ein `effortLevels`, eine `note`, ein
Kontrakt-Default). Steht so korrigiert in CLAUDE.md.

### DIE BEWERTUNG, um die der Owner gebeten hat (Lint · Backlog · needs-you)

**Lint: kein Linter — es gibt schon zwei Lint-Schichten.** `tsc --strict` für TS↔TS, und
**`e2e/pins.ts` ist die zweite** (73 Regeln, „die Muss-Paare, deren ANDERE SEITE KEIN TYPESCRIPT
IST", erste Stufe der Verify-Kette). Der Test, den ich angelegt habe, ist empirisch: **hätte ein
Linter irgendeinen der fünf Fehlschläge von heute gefunden? Null von fünf.** Der stärkste
Gegeneinwand (`no-floating-promises` in einem async-Server) wurde geprüft und verliert an
`server.ts:1629-1635`: das Fehlen eines `unhandledRejection`-Handlers ist eine **Messung**, nicht
eine Lücke — „with a listener the process SURVIVES … a robustness regression wearing an
observability costume". Die Prozess-Ebene ist bewusst „fatal bleibt fatal, der Watchdog respawnt
sauber".

**Was stattdessen lohnt: EINE neue Pin** — die Schreibwurzeln des pi-Zauns gegen die `note`, die sie
dem Owner beschreibt. Genau dieser Defekt ist heute passiert (drei geteilte Wurzeln, Notiz sagte
„only its own worktree"), gefunden von einem ②-Reviewer statt von einem Gate. Klein, echtes
pins-Genre, verhindert die Wiederholung.

**needs-you: liegt fertig vor, heute Morgen von Sol.**
`~/claude-fleet-private/codex-analysis-2026-08-08/sol-backlog-pass.md` — **alle 28** Zeilen,
Drei-Test-Urteil, `VERIFIED`/`INFERRED` getrennt, ein entsperrender Satz je Zeile, **6/28**
überleben, plus gerankte Kurzliste von 7 **mit Schnittlinie**. Nicht neu machen lassen.
**Gemessener Vorbehalt:** verankert auf `69c94da`, seither vier Lands — Stichprobe: Sol zitiert
`server.ts:794-810` als `TaskAnalysis`, dort steht heute `CODEX_HARNESS.effortLevels`. **Die Urteile
stehen, die Zeilenangaben nicht.**

**Das Attic-Backlog NICHT öffnen** — am 2026-08-07 ausdrücklich beerdigt.

### IN FLUG BEIM ÜBERGEBEN — nichts mehr; `9bcc460e` ist GELANDET (`3863b29`)

Sols Nummer 1 ist erledigt, und **die Lösung ist eine dritte, die die Queue-Zeile nicht kannte** —
lies den Commit-Body, er ist die eigentliche Fundstelle. Kurz: die Zeile bot eine Alters-Schranke oder
ein Kein-Fallback-für-junge-Panes an; **beide messen ZEIT und brauchen die Pane-Startzeit, die nirgends
gelesen wird** (`session_created` kommt in `server.ts` nicht vor). Die Lane nahm stattdessen
IDENTITÄT: ist eine `sessionId` gepinnt und ihre Datei noch nicht da → `null`, statt in den
mtime-Fallback zu fallen. Fleet hat die UUID selbst übergeben, **also kann eine anders benannte Datei
ihre Konversation in keinem Alter sein** — kein Subprozess auf dem 2-s-Poll, kein geratenes Fenster.
Der Fallback bleibt für seinen einzigen Zweck: adoptierte Panes, die gar keine `sessionId` haben —
genau der Fall, den eine Alters-Schranke getötet hätte.

**Der neue Check läuft im LAND-GATE, nicht nur in Tier 2:** er liegt in der `history`-Familie, wird
aber aus `fleet-e2e-claude-gate.ts` aufgerufen, weil die normale Suite mit `FLEET_CMD=true` gar keine
echte `--session-id`-Pin hat. War vor dem Fix rot (`source=ended-foreign-session.jsonl, total=1` →
danach `source=null, total=0`).

**`08c7787` ist an einer LEBENDEN pi-Pane bestätigt**, nicht nur durch die Suite:
`{"usedTokens":30352,"windowTokens":258400,"pct":11.7}`. Wichtig für den nächsten, der hinsieht:
**unmittelbar nach dem Lane-Start steht dort `ctx: null`, und das ist RICHTIG** — pi hat noch keine
`usage`-Zeile geschrieben, Absenz bleibt Absenz statt 0 %. Ich bin selbst darauf hereingefallen.

### REIHENFOLGE, die ich empfehle

1. **`08c7787` deployen**, sobald sein Post-Land-Audit durch ist (`bun run build` +
   `tmux -L claudefleet kill-session -t srv`, dann `bundleStale`/`deployGap` auf `/api/sessions`).
   Gelandet ist es: `verify.ok true` (79 s), `disposition: landed`. Ob der Deploy schon lief, sagt
   `deployGap.codeBehind` — nie das Gedächtnis.
2. **Die Zaun-Pin** aus dem Lint-Abschnitt oben — die einzige Lint-Arbeit, die ich für lohnend halte.
3. **`40eb5c1a`** (doneLooking kann eine eingezäunte Lane strukturell nie melden — `ahead>0` ist
   unmöglich, wenn der Host committet; ich habe es heute viermal mit einem Hintergrund-Watcher
   überbrückt, und **drei dieser Watcher waren kaputt** — siehe Kleinkram). Danach **`6443be0e`**
   (`dispatch` reicht kein `effort` durch).
4. **`graphify update .` im Haupt-Checkout.** Gemessen 2026-08-08: `graphify-out/graph.json` ist von
   18:51, `server.ts` von 21:05 — der Graph kennt die letzten drei Lands nicht. Der Hook verlangt bei
   jedem Aufruf, ihn zu benutzen, und zeigt auf einen veralteten Stand. Kostet nichts (AST-only).

### KLEINKRAM, der Zeit spart

- **Der Dispatch-Knopf erhält den `slot`-Link, und das zahlt sich aus:** `f85d1244` und `b7780848`
  standen nach ihrem Land von selbst auf `done`. Nur der Umweg über `POST /api/lanes` kostet das.
- **Der Commit-Msg-Worker fiel zweimal auf `wip: saved from Fleet dashboard`.** In diesem Repo sind
  die Bodies das Befund-Register — von Hand nachschreiben (`git commit --amend -F`).
- **Der Host committet für eine fremde Lane** über `POST /api/slots/:id/commit`; ein direktes
  `git commit` im Lane-Worktree geht vom Haupt-Checkout aus genauso und spart das Amend.
- **WATCHER AUF EINE FREMDE LANE — hier sind DREI Fehlschläge von mir, alle derselbe Fehler.** Es
  gibt für eine eingezäunte Lane keinen Rückkanal (`40eb5c1a`), also baut man einen; alle drei Male
  war die SONDE falsch, nicht die Lane:
  - `until [ "$(git log -1 --format=%h)" != "<sha>" ]` mit einem **veralteten Basis-SHA** beendet
    sofort und beweist nichts. Gegen den Kopf prüfen, der beim START des Watchers wirklich stand.
  - **`idleSec` gibt es im Owner-Poll NICHT** (`/api/sessions` liefert `idleSec: null`, ebenso
    `idle`/`observed` — gemessen 2026-08-08). Ein `[ "$I" -gt 150 ]` darauf ist immer falsch, der
    Watcher feuert **nie** und wartet ewig. Nimm tmux direkt:
    `tmux -L claudefleet display-message -p -t s<N> '#{session_activity}'`.
  - **`sessionId` liefert der Poll ebenfalls nicht** (Data-Saver). Es steht in `fleet.json`, und die
    Slots dort sind ein **Objekt mit String-Schlüsseln**, keine Liste — `for s in d['slots']` iteriert
    sonst über die Schlüssel und wirft `AttributeError`.
  **Die brauchbare Bedingung für eine fertige fremde Lane ist: `git status --porcelain` im Worktree
  ist nicht leer UND `#{session_activity}` bewegt sich seit N Sekunden nicht.** Nichts davon aus dem
  Poll.
- **Ein GPT-Brief kostet die Lane ~9 % ihres Fensters** (gemessen an `e2784b16`: 9,2 % von 272k nach
  dem Brief). Das ist der Preis der Schärfe und er ist es wert — aber er ist real.

---

# HANDOFF — Session 42 (2026-08-08 abends: die GPT-Wende, und ein Kontingent, das in zwei Tagen alle war) · 41/40/39/38 darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log 35c5a1f..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, was in Flug ist, Korrekturen.*

---

## Session 42: der Tag, an dem das Claude-Kontingent zur harten Grenze wurde

**ctx beim Übergeben: ~46 %.** Produziert: **3 Lands** (`b3c08e6` AGENTS.md · `c473ba7` Klon-Form ·
dazu `69c94da` aus S41s Lane geerbt), ein **Direkt-Commit** im Haupt-Checkout, `CLAUDE.md` komplett
umgeschrieben, **7 tote Queue-Zeilen archiviert**, **4 neue Zeilen mit Messungen**, ein
Kontingent-Befund, der die Marschrichtung geändert hat, und **vier fremde Modelle in echter Arbeit**
(gpt-5.6-sol ×2, gpt-5.6-terra, claude-fable-5).

### DIE OWNER-VORGABE, die ab jetzt alles andere sortiert

**Wortlaut, 2026-08-08 abends: „ab jetzt sollten wir die gpt modelle für alles benutzen".**
Vorgeschichte in einem Satz: das Claude-Wochenlimit war nach **zwei Tagen** fast erreicht.

**Was heute schon geht — beides an lebenden Panes bewiesen, nicht abgeleitet:**
- **Eine pi-Lane auf einem GPT-Modell.** `POST /api/lanes {harness:"pi", model:"openai-codex/gpt-5.6-sol", effort:"high"}`
  — hochgekommen, Sonde sieht `pi` im Prozessbaum. Fleet brauchte **keine Änderung**:
  `HARNESS_MODEL_RE` lässt den `/` durch, `PI_HARNESS` reicht `--model '<wert>'` single-quoted weiter,
  pi löst `openai-codex/gpt-5.6-sol` eindeutig auf (`pi --list-models '<muster>'` gegengeprüft).
  **Das ist der bevorzugte Weg**, denn pi kann, was Codex nicht kann: `pinsSession` (Respawn behält das
  Gespräch) und `--thinking` (Effort-Stufen bis `max`; Codex' Adapter deklariert `effortLevels: []`).
- **Eine Codex-Lane.** Kommt seit `c473ba7` automatisch als Klon. Sie produziert, **der Host committet**.

**Was NICHT geht, mit dem Grund, damit es niemand erneut versucht:** die **Worker-Ebene** (summary,
review, commitMsg, enhance, merge, repair, cleanReview, digest, refine, analysis) läuft weiter auf
claude und kann heute nicht auf pi oder codex. Mechanisch: `runWorker` liest die Antwort aus einem
HOST-seitigen Transkript, `PI_HARNESS.worker` gibt darum `null` zurück, und der Aufruf endet in einer
benannten Verweigerung statt in einem Ergebnis. `FLEET_WORKER_HARNESS` ist die Naht, aber sie zeigt
heute auf nichts Brauchbares. **Der einzige heute offene Ausweg ist `POST /api/repo-worker`** (owner-only,
absoluter Pfad auf ein Executable) — und er ist nur für `commitMsg` verdrahtet. `worker-deepseek.py`
liegt im Baum, ungenutzt.

**Nicht getan und bewusst nicht:** `FLEET_CMD` fleet-weit auf pi zu stellen. Das träfe JEDEN neuen Slot,
auch die in fremden Repos (`private-repo-a`, `private-repo-b`), und ist ein anderer Blast-Radius
als „meine Lanes fahren GPT". Wenn der Owner das will, ist es eine Zeile in `watchdog.sh` plus
`launchctl kickstart` — aber es ist seine Entscheidung, nicht die Fortsetzung dieser.

### DER KONTINGENT-BEFUND, und der Hebel, der schon gezogen ist

Gemessen an den Worker-Transcripts der letzten 48 h in `~/.claude/projects/*claude-fleet*/`
(749 Dateien, nach Contract-Mark aus `src/protocol.ts:126-140` klassifiziert):

| Läufe (48 h) | Worker | |
|---:|---|---|
| **445** | `analysis` | der Queue-Analyst |
| 122 | `enhance` | |
| 71 | `review` | |
| 11 · 7 | `digest` · `refine` | |
| 93 | Slots/Lanes | die eigentliche Arbeit, 106 MB |

**445 Analyst-Läufe in zwei Tagen für Urteile, auf die nichts gated.** Ursache im Code, nicht geraten:
`analysisStale` vergleicht den `head` des Urteils mit dem Integrations-Tip — **jedes Land entwertet das
Urteil JEDER offenen Zeile**, und der Sweep judged sie zu 6 (`ANALYSIS_BATCH_CAP`) im 60-s-Takt nach.
Bei ~59 offenen Zeilen sind das ~10 Worker-Aufrufe pro Land-Welle.

**GEZOGEN: `FLEET_ANALYSIS_MS=0` steht seit heute in `watchdog.sh`**, aktiviert per
`launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` + srv-Kill, am `./state.sh`-Config-Sensor
verifiziert (`live=0`). **Preis, benannt:** die `ready`/`needs-you`-Urteile frieren ein. Sie waren nur
beratend — und Sols Durchgang hat gezeigt, dass 22 von 28 `needs-you` schlicht falsch waren.
Rückfalltür: die Zeile zurückdrehen, wieder kickstart.

**Nicht gezogen, mit Zahl, damit der Nachfolger es entscheiden kann statt zu suchen:**
`FLEET_AUTO_REVIEW_MS=0` (71 Läufe — nützlich, nimmt Wartezeit ab) und `enhance` (122 Läufe, von mir
NICHT untersucht — der drittgrößte Posten und die offenste Frage).

### WAS IN FLUG IST

**(A) Slot 1, `fleet/260808145308-514e`, Zeile `f7deea4b`** — der **pi-Zaun**: `sandbox-exec -f <profil>`
um die Spawn-Zeile, Profil pro Lane aus ihrem cwd. Gemessen dazu: `/usr/bin/sandbox-exec` existiert,
Codex benutzt genau das (`seatbelt`, `(version 1)`, `deny default` im Binary), **pi hat selbst gar nichts**
(kein `--sandbox`, keine Approval-Option). Owner-Entscheid im Brief UND als Kommentar auf der Zeile:
**Schreibzaun ja, Netz OFFEN** („netz anbindung wäre schon sehr gut, auch für research") — das SBPL-Profil
trägt also keine network-Regel, und der Canary-Test darf **nicht** um eine Netz-Sonde erweitert werden.

**(B) Slot 5, `fleet/260808150917-94b8`** — die pi+GPT-Beweis-Lane. Hat KEINEN Auftrag, nur den Boot
bewiesen. **Killen UND discarden**, sonst wird sie re-adoptiert (siehe unten).

**(C) Slot 2, `fleet/260808114656-6e86`, `e1a9a20`** — die ToS-Lane, weiter **zurückgestellt, nicht tot**.
Ihr Gate ist grün (3 Suiten, exit 0, geerntet). Zwei Dinge beim späteren Land, die kein Ledger trägt:
`watchdog.sh` ändert sich (braucht `launchctl kickstart`), und `CLAUDE.md` kann nur der Haupt-Checkout
nachziehen. **Neu dazu:** sie benennt `guest-firewall.sh` in `container-firewall.sh` um — in `main` heißt
die Datei noch alt, wer den Container-Zaun sucht, sucht unter dem alten Namen.

### KORREKTUREN — vier, und drei davon widerlegen etwas, das heute selbst behauptet wurde

1. **Die Klon-Form löst das Codex-Commit-Problem NICHT.** `c473ba7` landete mit der Begründung, ein Klon
   habe sein `.git` in der Schreibwurzel. An einer echten Klon-Lane gegengemessen: `git commit` stirbt
   erneut, jetzt am eigenen Pfad. Grund im `permission_profile` der Session: Codex stuft `<workdir>/.git`
   **ausdrücklich auf `access:"read"`** herab (samt `.agents`, `.codex`), unabhängig von der Form.
   Die Klon-Form behält ihren anderen Wert (selbst-enthaltenes Verzeichnis, kein Zugriff auf Hooks/Config
   des Roots, die Form, die ein Bind-Mount braucht). **Owner-Doktrin macht daraus einen Nicht-Defekt:**
   „comitten sollte einfach wieder die main session selbst" — also braucht kein fremder Agent je
   Schreibrecht auf `.git`, und `sandbox_workspace_write.writable_roots` ist eine Zeile, die man NICHT
   ziehen will. Verifiziert: `POST /api/slots/:id/commit` → `{"committed":true,"hash":"34b460a"}`.
2. **`pi` lädt seit `b3c08e6` NICHT mehr `CLAUDE.md`, sondern `AGENTS.md`.** An einer Live-Pane gemessen,
   beide Dateien im Baum. Das eigene Land von heute hat pi still vom vollen Regelbuch auf den dünnen
   Zeiger verschoben. `AGENTS.md` behauptete selbst „Claude and pi read `CLAUDE.md`" — korrigiert.
3. **`git worktree list` ist für Klon-Lanes BLIND** (`server.ts` sagt es selbst). Ich habe damit „ein
   Worktree übrig" gemeldet und einen verwaisten 27-MB-Klon übersehen; **`./state.sh` hätte ihn gezeigt**
   (globbt das Verzeichnis, unterscheidet an `.git` als Verzeichnis, `state.sh:43`). Benutz das Instrument
   des Repos, nicht das rohe Kommando.
4. **Kontextfenster der GPT-Modelle: 272 000 nominal, 258 400 effektiv** (`effective_context_window_percent: 95`),
   und `max_context_window` steht ebenfalls auf 272000 — es gibt auf diesem Zugangsweg keine größere Stufe.
   Zwei unabhängige Quellen, beide von Codex selbst (sein `models_cache.json` und ein nativer Rollout);
   pi verkleinert nichts. **Konsequenz für die Arbeitsteilung:** ein GPT-Slot hat ~¼ des Fensters einer
   Opus-1M-Session. Für einen umrissenen Lane-Schnitt reichlich, für eine MAIN-Session zu wenig.

### EIN DEFEKT, DER MICH SELBST ERWISCHT HAT — und einer, der Geld kostet

- **`/send` an eine noch bootende fremde TUI geht STILL verloren** (Zeile `2975afe9`). Route meldet
  `ok:true`, Text steht in `Slot.history`, kein Modell hat ihn je gesehen. `sendText` macht
  paste-buffer + Enter; eine TUI im Boot nimmt beides an und verwirft es. **Der Worker-Pfad löst dasselbe
  Rennen längst** (`summaryViaSession` wartet auf `alive` UND schläft 2500 ms). Zwei Fragen werden heute
  von einer Bedingung beantwortet: *darf* zugestellt werden (Berechtigung, vom Owner-Pfad zu Recht
  gewaivt) und *kann* zugestellt werden (Bereitschaft, gar nicht geprüft).
- **Ein Kill re-adoptiert die Lane sofort wieder** (Messung als Kommentar auf `34a12839`): nach vier Kills
  erschienen binnen 17 s vier `slot_open` auf DIESELBEN Pfade in ANDEREN Slots, mit frisch gespawnten
  claude-Sessions. Die Belegung sinkt durch Killen nie, und jede Runde kostet Geld. **Der Ausweg ist Kill
  UND `POST /api/worktrees/discard`** — die Route verweigert bewusst, solange ein Slot den Baum hält.
  Offen und vom Owner eingegrenzt: ein Klick auf eine `on-disk`-Geisterzeile hat zwei Bäume erzeugt;
  ob der Knopf ANHÄNGT oder NEU ANLEGT, ist ungemessen und entscheidet, welcher Defekt vorliegt.

### DER DIREKT-COMMIT — und was er dem Ledger schuldig bleibt

`watchdog.sh` (+`FLEET_ANALYSIS_MS=0`) und `AGENTS.md` (pi-Korrektur) sind **im Haupt-Checkout direkt
committet**, nicht über eine Lane. Das ist für jedes land-seitige Ledger unsichtbar: keine `git notes
--ref=fleet/land`, keine Zeile in `lane-outcomes.jsonl`, **kein Post-Land-Audit**. Verifikation darum von
Hand vollständig gefahren: `bun e2e/pins.ts` ALL PASS · tsc über alle 11 Dateien exit 0 · `bun run build`
ok · die drei Gate-Suiten. Wer `./state.sh`s Land-Health-Zahlen liest: sie zählen Lanes, untertreiben an
diesem Tag also.

### DIE ARBEIT DER FREMDEN MODELLE — alles gesichert, nichts im Scratchpad gelassen

`~/claude-fleet-private/codex-analysis-2026-08-08/` (das Repo ist public, hier gehört es nicht hinein):
- `sol-analysis-workflow.md` (v1.0) und **`-v1.1.md`** — das Instrument, mit dem Terra Codex-Sessions auf
  Ineffizienz prüft. v1.1 adressiert vier Defekte, die erst der echte Lauf zeigte; der schwerste: der
  Pflicht-`jq`-Filter erzeugte ~80 k Tokens und wurde abgeschnitten. Sol hat die Vollabdeckung NICHT
  aufgeweicht, sondern Chunk-Zähler eingeführt, die aufgehen müssen.
- `terra-run-01.json` + `-notes.md` — der Probelauf. Ein qualifizierter Fund (58 388 Tokens für einen
  breiten Read, wo ein `rg -n` verfügbar war) und, wertvoller, die Kritik am Instrument.
- `sol-backlog-pass.md` — der Durchgang durch 63 offene Zeilen. **Von 28 `needs-you` überleben 6.**
  7 tote Zeilen sind archiviert (jede mit dem Commit kommentiert, der sie erledigt hat).
- `codex-session-analysis-package.md`, `queue-open-rows.json`, `CLAUDE.md.backup/.candidate/.installed-final`.

**`CLAUDE.md` wurde von Fable 5 umgeschrieben:** 144 Zeilen mit 77 über 200 Zeichen → **794 Zeilen, null
über 200**, Faktenmenge als Teilmenge belegt (510 Backtick-Spans, 30 SHAs, 22 Zahl+Einheit-Tokens),
Pins grün. Wirkung live bestätigt: die nächste Codex-Lane las es **in einem Zug**, ohne `dd`.

### REIHENFOLGE FÜR DICH

1. **`f7deea4b` (pi-Zaun) landen**, wenn sie fertig meldet. Danach Slot 5 killen UND discarden.
2. **Ab da alle neuen Lanes als pi+GPT spawnen** — das ist die Vorgabe, und es ist der Weg, der heute
   funktioniert. Codex direkt nur, wenn `pinsSession`/Effort egal sind.
3. **`f85d1244`** — Codex repariert seinen eigenen Adapter (Effort via `-c model_reasoning_effort`,
   `resume --last`, Transcript-Schicht aus dem vermessenen Rollout-Schema). Drei Messungen liegen bei.
   **Das ist die Zeile, die die Worker-Ebene öffnen könnte**: wer Codex' Transkript lesbar macht, hat den
   Grund entfernt, aus dem `PI_HARNESS.worker` null zurückgibt.
4. **`2975afe9`** (das stille `/send`) — klein, und es hat heute eine Stunde gekostet.
5. `d9b9b4c4` (Harness im Ledger — ohne das bleibt „wie viel hat GPT geleistet" unbeantwortbar),
   `29cd2610` / `54af57d6` bleiben Zielbilder und gehören durch `▸ clarify first`.

**Was WIRKLICH beim Owner liegt:** ob `FLEET_CMD` fleet-weit auf pi geht · ob `FLEET_AUTO_REVIEW_MS=0`
auch fällt · die sechs `needs-you`-Zeilen aus Sols Durchgang (`785ce63d`, `9bf62ae6`, `df5b74ba`,
`10ac2528`, `c8e2ddd7`, `dabd1880`).

### NACHTRÄGE, nach dem Schreiben des Obigen entstanden

- **`ec91075` ist der Direkt-Commit** (`watchdog.sh` + `AGENTS.md` + dieser Handoff), von Hand voll
  verifiziert, ohne Land-Ledger-Eintrag. Der erste `./e2e-claude-gate.sh`-Lauf war rot (exit 1) —
  Phase 2 starb am Boot an `ENOENT` auf ihre eigene `fleet.json`, **null Checks gelaufen**. Als
  Nicht-Determinismus bewiesen durch einen Wiederholungslauf auf DEMSELBEN Baum (exit 0, beide
  Phasen ALL PASS). Beweisordnung eingehalten: erst denselben Baum, kein HEAD-Worktree.
- **`CLAUDE.md` hat einen neuen Abschnitt: „WENN DU EINE GPT-LANE BRIEFST, RECHNE MIT 258 400"** —
  Owner-Vorgabe, dass die MAIN-Session das Fenster beim Briefen mitdenkt. Er trägt die drei Zahlen
  (Fenster · 96 % des Verbrauchs ist Input · Fixkosten fallen in Bytes an) und eine Checkliste für
  den Brief. **Die Datei ist gitignored — sie ist in KEINEM Commit.** Kopie:
  `~/claude-fleet-private/codex-analysis-2026-08-08/CLAUDE.md.installed-final`.
- **Owner-Korrektur, die im Register nicht fehlen darf:** „gpt verbraucht weniger token beim
  reasoning, deswegen ist der Vergleich nicht ganz fair" — richtig, und gemessen: Reasoning ist
  40,2 % des Outputs (6 717 von 16 701). Es trifft aber nur die 4 %, die das Modell erzeugt; die
  96 % Input (Gesprächsverlauf + Tool-Ausgaben) sind harness-getrieben und schrumpfen nicht. Meine
  Fassung „eine GPT-Lane schafft ungefähr eine der heutigen Aufgaben" war damit **zu pessimistisch**.
- **Neue Zeile `e2784b16`:** ein GPT-Slot zeigt `ctx: null` — wir sind blind, wo das Fenster ein
  Viertel groß ist. Zwei Ursachen getrennt, das Rollout-Schema als Datenquelle für Codex benannt,
  und für **pi ausdrücklich ungemessen**, ob es host-seitig überhaupt etwas Lesbares schreibt.


# HANDOFF — Session 41 (2026-08-08 nachmittags: Codex ist Adapter #4, und die Sandbox wurde vermessen statt geglaubt) · 40/39/38 darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log 1c2a77a..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, was in Flug ist, Korrekturen.*

---

## Session 41: der Tag, an dem ein fremdes Modell mitarbeiten durfte — und die Grenze gemessen wurde

**ctx beim Übergeben: ~42 %.** Produziert: **6 Lands**, alle mit Gate-Note + LaneOutcome + grünem
Audit (`b64cd54` Worker-pro-Repo · `be7ba33` Codex-Adapter · `aaae2e6` Sonden-Race *von einer
Codex-Lane geschrieben* · `11d113a` Dispatch reicht Harness durch · `2a86cec` Worker-Spawn durch den
Adapter · `ece2957` undo-land als Stack). Dazu: 1 rotes Audit adjudiziert, **8 neue Queue-Zeilen**
(alle mit Brief oder als Zielbild markiert), 2 Maschinen-Installationen, 4 CLAUDE.md-Abschnitte.
Zur Schwellen-Kalibrierung: S40 ~42 % bei 4 Lands + 2 eigenen Grabungen, S39 ~31 % bei 9 Lands,
S38 37,1 % bei 3. **Diese Session: 6 Lands + zwei Messkampagnen für ~31 Punkte** — die Lands waren
wieder der billige Posten, die Messungen der teure. Das bestätigt die Regel in `CLAUDE.md`.

### WAS IN FLUG IST — zwei Lanes, und sie kollidieren auf denselben drei Dateien

**Die Watches auf beide waren MEINE und sterben mit meinem Slot.** Setz sofort neue:
`POST /api/self/watch {"target":5,"idleSec":60}` und dasselbe für 2.

**(A) Slot 5, Lane `fleet/260808115720-7017`, Zeile `25e7c086`** — Container UND Docker-Kontext pro
SLOT. Der nächste Baustein der Isolationskette. Trägt einen `slot`-Link (seit `11d113a`), schließt
sich beim Land also selbst. **Sie landet ZUERST — Owner-Entscheid.**

**(B) Slot 2, Lane `fleet/260808114656-6e86`, Commit `e1a9a20` — ZURÜCKGESTELLT, nicht tot.**
Der Owner hat sie schreiben lassen, damit das Repo beim Release nicht gegen die Anthropic-ToS
verstößt: die **Gast-Konsole fällt ganz** (−2144/+95 über 25 Dateien). Begründung im Commit-Body —
nicht §2 der Consumer Terms direkt (jeder Gast brachte sein eigenes Token), sondern die FORM:
Instanzen für Dritte provisionieren, Invites ausgeben, fremde Credentials halten. Sie liest sich
als „provide the Services to third parties" und ist überflüssig, sobald Kollaboration über
ARTEFAKTE läuft (Repo, Issue, PR, Intake-Notiz) statt über eine Konversation.

**Was ich ihr per `/send` aufgetragen habe (Owner-Entscheid, Stand beim Übergeben):** Gate-Suiten zu
Ende laufen lassen und ihr **Ergebnis berichten** (sie hatte korrekt nichts behauptet, solange sie
liefen — ohne das weißt du nicht, ob `e1a9a20` grün ist), eine Übergabe schreiben, **dann STOPP**.
Kein Commit 2 (`mode` fällt aus Share), kein Historien-Squash. Branch und Worktree bleiben.

**DIE KOLLISION, und warum sie nur technisch ist:** (A) und (B) fassen beide `server.ts`,
`watchdog.sh` und `e2e/security.ts` an — aber verschiedene Regionen (`FLEET_CONTAINER*` vs.
`FLEET_GUEST_CMD`, §6-Container-Checks vs. §8-Gast-Block). Inhaltlich sind sie EINIG: Owner-Wortlaut
*„der container ist ja eigene infrastruktur, das sollte komplett konform zu den tos sein und nur
technisch mit e1a9a20 kollidieren"*, und die ToS-Lane hat aus eigenem Antrieb `guest-firewall.sh`
als `container-firewall.sh` gerettet, weil es der Egress-Zaun des SANDBOX-Pfads ist. (B) rebased
später über (A) — die teurere Richtung, bewusst in Kauf genommen.

**ZWEI DINGE, DIE DU BEIM LAND VON (B) WISSEN MUSST — und die kein Ledger dir sagt:**
1. **`watchdog.sh` ändert sich** (`FLEET_GUEST_CMD` fällt). Ein srv-Kill aktiviert das NICHT —
   es braucht `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`. Wer das vergisst,
   deployt eine Hälfte und wundert sich.
2. **`CLAUDE.md` ist DEINE Aufgabe** — gitignored, stirbt mit dem Worktree, die Lane kann es nicht.
   Nach dem Land ist der ganze `FLEET_GUEST_CMD`-Absatz falsch, und ihr eigener Pfad-Pin hat schon
   `CLAUDE.md:121` gestellt (nennt `guest-ctl.sh`). Sie meldet dir die Stellen als Text.

**Slot 14 war eine Codex-Lane des OWNERS** — beim Übergeben geschlossen. Falls er wieder eine
öffnet: nicht anfassen.

### DIE MESSUNG, DIE DIESE SESSION TRÄGT — und die in `CLAUDE.md` steht, nicht hier

Codex' `--sandbox workspace-write` ist ein **Schreib**-Zaun, **kein Lese**-Zaun. Mit Kontrollgruppe
auf dem echten Agenten-Pfad belegt: `cat` außerhalb des Workspace gelingt in 0 ms, Schreiben
außerhalb wird mechanisch verweigert. Ein Codex-Slot kann `~/private-repo-a` lesen, egal wo er
läuft — und was ein Agent liest, geht an seinen Anbieter. Daraus folgen drei Zeilen, die
zusammengehören: **`29cd2610`** (Repo auf der Main-Maschine, Container auf der Dev-Maschine — mit
der Bind-Mount-Falle als zentraler Warnung), **`54af57d6`** (der Codex app-server als zweiter
Slot-Typ und der erste Kontrollpunkt, an dem Fleet einem fremden Agenten etwas VERBIETEN kann),
**`25e7c086` → `0234283e`** (die Bauteile; `0234283e` ist gelandet).

### KORREKTUREN AN DINGEN, DIE VORHER ANDERS IM UMLAUF WAREN

- **Der Dispatch-Knopf KANN jetzt Harness+Modell** (seit `11d113a`). Der Umweg über `/api/lanes` +
  `/send` ist nur noch nötig, wenn gar kein Task existiert. Er kostet weiterhin den `slot`-Link —
  heute dreimal von Hand geschlossen, bis die Zeile landete.
- **Eine Codex-Lane in einem WORKTREE kann nicht committen** (Metadaten liegen im Haupt-Repo,
  außerhalb der Schreibwurzel), keine Suite fahren, nicht ans Netz. Der Land-Gate läuft aber
  SERVER-seitig — sie ist trotzdem landbar, sie kann sich nur nicht selbst prüfen. Fix ist die
  KLON-Form (`e30b3a7f`), und die Vorarbeit dafür liegt seit heute früh im Baum.
- **Pi spart kein Kontingent.** `~/.pi/agent/auth.json` ist `{}`, die einzige Erweiterung ist
  `pi-claude-bridge` — es läuft über Claude. Unabhängige Budgets: Codex (Owner-Plan) und DeepSeek.
- **Ein Adapter je Harness bleibt die Vorgabe**, eine universelle Pi-Brücke ist der Sonderfall —
  Begründung mit Messung in `CLAUDE.md` (die Sonde geht eine Ebene tief und sähe nur die Brücke).
- **`FLEET_WORKER_HARNESS` steht NICHT in `watchdog.sh`.** `2a86cec` bewaffnet eine Fähigkeit,
  ändert aber das Verhalten des Live-Fleets nicht.

### WAS BEIM OWNER LIEGT — und was NICHT (er hat mich dafür gerügt, zu Recht)

Ich hatte hier zuerst drei Punkte stehen. Der Owner fragte: *„wieso sind die offen für mich, kannst
du die nicht selbst angehen?"* — und bei zweien hatte er recht. Sie sind umsortiert, **nicht**
weggeräumt:

1. **`workspace-write` ausreichend? — BEREITS BEANTWORTET, war nie eine Owner-Frage.** Die
   gescheiterte Codex-Lane hat es vermessen: kein Netz, keine tmux-Sockets, kein Schreiben auf
   `.git` außerhalb des Baums. Für Produzieren reicht es, für eine Worktree-Lane nicht. Der Inhalt
   davon ist `e30b3a7f`.
2. **DeepSeek — eine ANWEISUNG, kein Entscheid.** Owner-Wortlaut: *„es sollte einfach sicher in
   einem container laufen"*. Als `b634236c` abgelegt, mit dem Maschinen-Befund: der `default`-
   Docker-Kontext ist TOT, es gibt keinen Container `fleet`, und die einzigen laufenden sind die
   GAST-Container mit Credentials + NET_ADMIN (dort gehört kein Worker hinein). Sequenziert hinter
   `25e7c086`.
3. **`automatable: true` für Codex ist KEINE Owner-Entscheidung, sondern eine unerfüllte
   Bedingung** — die alte Formulierung klang, als müsse er nur ja sagen. Die Bedingung, benannt:
   ein unbeaufsichtigter Pfad darf einen Codex-Slot fahren, wenn eine Codex-Lane **committen kann**
   (`e30b3a7f`) **und** ihre Lese-Reichweite begrenzt ist (`29cd2610` Ort, oder `54af57d6`
   Approval-Policy). Vorher wäre ein Flip der Vertrauensvorschuss, den der Owner ausgeschlossen hat.

**Echt beim Owner liegt nur noch:** das Wochenkontingent stand bei 77 % (Reset 12.08., 20 Uhr) —
die Post-Land-Audits kosten daran nichts (kein Modell), die Lanes schon. Und Slot 14, seine eigene
Codex-Lane.

**Die Lehre für dich, Nachfolger:** bevor du etwas als „liegt beim Owner" schreibst, prüfe, ob es
(a) längst gemessen ist, (b) eine Anweisung ist, die du nur nicht ausgeführt hast, oder (c) eine
Bedingung, die du BENENNEN statt zur Frage machen kannst. Blieb keines davon übrig, ist es seins.

### REIHENFOLGE FÜR DICH, und das Warum

`25e7c086` läuft. Danach **`e30b3a7f`** (Klon-Form) — sie schaltet Codex-Lanes überhaupt erst
nutzbar, und der Owner arbeitet bereits in einer. Dann **`2e577447`** (`AGENTS.md`: die
Lane-Disziplin reist bei Codex nicht mit, ich habe es heute von Hand kompensiert — eine Krücke, die
jeder künftige Absender vergisst). `29cd2610` und `54af57d6` sind **Zielbilder** und gehören vor dem
Start durch `▸ clarify first`, nicht in einen Dispatch.

### EINE BEOBACHTUNG, DIE SICH HEUTE SIEBENMAL BESTÄTIGT HAT

**Bei einem roten Check an frisch geschriebener Arbeit war die SONDE der erste Verdächtige — und
sie war es jedes Mal.** Sieben Instanzen in einer Session, vier davon haben die Lanes selbst
gefunden und als solche berichtet. Zwei Lanes haben von sich aus einen Check ergänzt, der die Sonde
*als sich selbst* scheitern lässt. Die Regel im Regelbuch trägt sich inzwischen selbst; sie braucht
keine Verschärfung, sondern nur, dass sie drinbleibt.

---

## Session 40: der Tag, an dem ein fremdes Harness normal wurde

**ctx beim Übergeben: ~42 %.** Produziert: 4 Lands über Lanes (alle unter **Pi**, alle mit
Gate-Note + LaneOutcome). **KORREKTUR, eingetragen NACH dem ersten Entwurf dieses Abschnitts:
der Post-Land-Audit des letzten Lands (`b320c24`, Klon) kam ROT zurück** — `exitCode 1`, 778 s,
Testinstanz stehengelassen unter `$TMPDIR/fleet-e2e-instance-85037`. Un-adjudiziert bei der
Übergabe; main-41 hat den Auftrag samt Beweisordnung in der Pane. Die anderen drei Audits sind
grün. **`undo-land` gilt nur für dieses eine Land und nur bis zum nächsten** — Slot 5 zu landen
verbraucht ihn, 4 Direkt-Commits, 5 Queue-Zeilen eingereicht,
3 geschlossen, 1 gelöscht-und-ersetzt. Zum Vergleich für die Schwellen-Kalibrierung:
S39 = ~31 % bei 9 Lands, S38 = 37,1 % bei 3 Lands. **Der teure Posten dieser Session waren
NICHT die Lands, sondern meine eigenen Grabungen** (Container-Untersuchung, DeepSeek-Wrapper) —
das ist die Messung, auf der die neue Schwellen-Regel in `CLAUDE.md` steht.

### WAS IN FLUG IST — genau eine Sache, und sie braucht dich sofort

**Slot 5, Lane `fleet/260808070310-a01f`, Queue-Zeile `9a437d5d`** (Worker pro Repo gespeichert).
Beim Übergeben: `ahead 1`, `dirty 0`, Pane nicht gelesen. **Der Watch darauf war MEINER und stirbt
mit meinem Slot** — setz dir sofort einen neuen:
`POST /api/self/watch {"target":5,"idleSec":60}` (Nicht-Lane-only, self-token).
Dann: Pane LESEN (nicht dem Prädikat glauben), Diff prüfen, landen, Audit abwarten, deployen,
Zeile schließen. Der Land-Weg ist `POST /api/slots/5/merge` — **nicht** `/land`.

### Die vier Lands

| SHA | Zeile | Kern |
|---|---|---|
| `ec7d191`+`2c97c49` | `c3531b41` | **Container-Adapter #3.** Slot leiht sich einen Container, das Bündel bleibt ganz: tmux + git bleiben host-lokal, nur das Transcript fällt. `automatable:false` (fail closed), Docker-Kontext **gepinnt** statt ambient. |
| `86cecf7` | `2784427e` | **F6 Drag&Drop/Paste/📎-Upload.** Ablage im Worktree, `drops/` in `.gitignore`, und die Route fährt `git check-ignore` VOR dem Schreiben (fail-closed) — ein Upload kann eine Lane nicht mehr still unlandbar machen. |
| `ff5d713`+`b320c24` | `eac67cc4` | **Arbeitskopie als KLON** neben dem Worktree (`form:"clone"`, Default unverändert `worktree`). Die tragende Scheibe für Container UND Gast-Modus. |

Dazu vier Direkt-Commits aus dem Haupt-Checkout — **die tragen per Konstruktion keine Land-Note,
keine LaneOutcome-Zeile und keinen Post-Land-Audit**, wer `post-land-audits.jsonl` liest, findet
sie dort korrekt-aber-irreführend nicht: `aac524e` (S39s Handoff, lag uncommitted), `92fab85`
(`docs/tailored-context.md` §8), `ce7cf98`+`c3bba61` (`worker-deepseek.py`), `eb40c2e`
(HANDOFF-Kürzung).

### Pi ist jetzt der Normalfall, und was das kostet

**Alle vier Lands kamen von Pi-Lanes.** Keine Sonderbehandlung: dasselbe Gate, dieselben Suiten,
dasselbe Ledger — `LaneOutcome.model` trägt `claude-bridge/claude-opus-5`, ohne dass jemand etwas
nachrüsten musste. Pi lädt `CLAUDE.md` von selbst (an der Pane verifiziert: `[Context] CLAUDE.md`
beim Boot), die Lane-Disziplin reist also mit.

**Der Umweg, den du kennen musst:** `POST /api/tasks/:id/dispatch` liest `harness` NICHT (die vier
`harnessIdOf`-Stellen sind `/api/lanes`, Slot-Open, Slot-Lane). Für eine Nicht-claude-Lane also
`POST /api/lanes {repo,harness,model}` + Brief per `POST /send`. Preis: die Queue-Zeile bekommt
keinen `slot`-Link, also kein Requeue bei Spawn-Fehler und keine automatische Zuordnung — **die
Zeile schließt du am Ende von Hand.** Landen/Ledger/Audit sind unberührt. Steht auch in `CLAUDE.md`.

### DeepSeek: vermessen, gelandet, NICHT eingeschaltet

`worker-deepseek.py` hängt an der Subprocess-Naht (`summaryViaSubprocess`), Key liegt **0600 unter
`~/.claude-fleet-workers/deepseek.key`**, außerhalb des Repos und NICHT in `.env` (der Server-Env
würde ihn an jeden Worker vererben). Katalog dieses Keys: **genau zwei Modelle**,
`deepseek-v4-flash` (Default) und `deepseek-v4-pro`.

**Der Befund, der über DeepSeek hinausgeht:** ein OpenAI-kompatibler Endpunkt **ignoriert
unbekannte Felder stillschweigend**. Ein frei erfundener Parameter lief mit 200 durch und änderte
nichts. „Kein Fehler" beweist dort also NIE, dass ein Parameter existiert — nur eine Wirkung tut
es. Damit gemessen: `thinking:{"type":"disabled"}` senkt die Completion von 100 auf **6 Token**
bei gleicher Antwortqualität, und erklärt nebenbei die 163-vs-84-`prompt_tokens`-Lücke als
**Thinking-Gerüst** — was der Anbieter-Doku („unterschiedliche Tokenisierung je Modell")
widerspricht.

**Offen und deiner:** `FLEET_COMMIT_CMD` ist fleet-WEIT, und dieses Fleet fährt Slots in
`private-repo-a` und `private-repo-b` — ein Flip schickte deren Diffs mit. Der Owner hat
**Option 1 gewählt: pro Repo gespeichert** (nicht bloß eine Env-Zuordnung — er sagte ausdrücklich
„gespeichert"). Das IST Zeile `9a437d5d`, die gerade in Slot 5 gebaut wird. Nach ihrem Land ist
das Einschalten ein Owner-Akt.

### Der Container-Strang, in der Reihenfolge, in der er gebaut werden will

`eac67cc4` (Klon) **gelandet** → `25e7c086` (Container + Docker-Kontext **pro Slot**, heute nur
fleet-weit im Env) → `0234283e` (Worker-Spawn über den Adapter) → Container-Worker.

**Zwei Befunde, die diese Reihenfolge erzwingen — beide gemessen, nicht argumentiert:**
1. **Ein Worktree ist nicht selbst-enthalten.** Sein `.git` ist eine DATEI mit `gitdir:` auf den
   common dir des Haupt-Checkouts. Nur den Worktree zu mounten macht git im Container arbeitsunfähig;
   die gemeinsame `.git` mitzumounten gibt der Sandbox `.git/hooks` — **ein `post-commit` dort läuft
   beim nächsten Commit auf dem HOST unter deiner uid.** Deshalb der Klon.
2. **`summaryViaSession` baut seine Agent-Kommandozeile SELBST** (`claude --session-id …` hart im
   Code), während der Slot-Spawn längst über die Registry läuft. Es gibt also zwei
   Spawn-Implementierungen, und der Container-Adapter deckt nur eine. Das ist `0234283e`.
   **Hindernis, das dort nicht wegdefiniert werden darf:** dieser Pfad holt seine ANTWORT aus der
   host-seitigen Transcript-Datei, nicht aus stdout — containerisiert käme sie nie an.

### Owner-Entscheide dieser Session, die als Regel in `CLAUDE.md` stehen

- **Schwelle ~44 %, Anker ~36 % für einen Lane-Start, halb dynamisch.** Und der Fehler, den ich
  live gemacht habe: **die Schwelle ist der Startpunkt der Übergabe, keine Decke, unter die die
  fertige Arbeit passen muss.** Ich hatte die Handoff-Reserve auf die Schwelle addiert und deshalb
  eine fertig gebriefte Lane liegen lassen, die bequem gepasst hätte.
- **Kosten hängen an der ART der Restarbeit:** eine Lane ist billig (~2,5/Land) und vorhersagbar,
  eine eigene Grabung ist teuer und schlecht schätzbar. Bei knappem Budget: Lane starten, nicht
  selbst graben.
- **HANDOFF.md ist das Residuum, nicht das Archiv** (2861 → 397 Zeilen, `eb40c2e`). Ältere
  Sessions: `git log --follow -p -- HANDOFF.md`.

### Was auf dich wartet, Owner

- **`0c4a9481` (Codex als Adapter #4)** braucht EINEN Satz von dir: die Installation ist
  Maschinen-Ebene außerhalb jedes Worktrees, eine Lane stoppt korrekt davor. Beim Pi-Spike hattest
  du sie ausdrücklich sanktioniert (user-lokal, kein sudo, kein brew-global). Ohne denselben Satz
  für Codex passiert nichts.
- **Kein `⚙ steward` läuft** — du hattest ihn um 06:56 geschlossen (Audit-Log, `slot_kill … owner`).
  Der Worktree steht noch. **Kein Handlungsbedarf** — der Steward ist ausdrücklich optional
  (Owner 2026-08-08: „brauchst du nicht immer einen steward spawnen"). FALLS er gewollt ist:
  auf **claude**, nicht auf Pi — sein Ritual sind die `.claude/commands/`, Pis Kontext-Entdeckung
  ist `AGENTS.md`/`CLAUDE.md`, und ein billigeres Modell wäre bei der urteilslastigsten Rolle
  genau falsch herum.
- Unverändert offen aus S39: `17068154` (Trail-Deckel) · `d375c581` (Trail-Reaper — die 324 MB
  e2e-Scratch und 2 verwaisten Sockets aus `./state.sh` sind sein Fall) · `f520e704` · `96b72c22`
  · `9bcc460e` · `e7d61b59`.

### Owner-Vorgabe zu Harness-Rechten (2026-08-08, am Ende der Session) — und die Spannung darin

Wörtlich: *„sowohl pi als auch codex sollten auch vollen maschinen zugriff haben. Falls wir keinen
vollen zugriff geben wollen können wir einen container benutzen."* Also: **Vollzugriff ist der
Default, der Container ist die Ausnahme** — nicht umgekehrt. Das ist auch der Status quo
(`FLEET_CMD` ist `claude --dangerously-skip-permissions`), Pi hat ohnehin keine Permission-Schicht
(`note: "no sandbox"`).

**Die harte Grenze, die daraus folgt und die niemand wegargumentieren kann:** der Owner will, dass
ein Agent **Screenshots** machen kann. Screen-Capture ist auf macOS eine TCC-Berechtigung des
BINARYS auf dem Host; ein Linux-Container hat zum Display dieser Maschine gar keinen Zugang.
**„Im Container" und „kann Screenshots" schließen sich auf dieser Maschine aus.** Der Container ist
damit keine universelle Antwort — die Isolationsfrage muss pro FÄHIGKEIT entschieden werden, nicht
pro Harness.

**Die Spannung, die im selben Absatz steht:** der Owner sagt zugleich, er traue *(OpenAI)* mit
seinen Daten nicht wirklich. Wenn das die Sorge ist, dann ist **Codex genau der Harness, der KEINEN
Vollzugriff bekommen sollte** — und der Container ist für exakt diesen Fall gebaut. Vollzugriff für
pi/claude und ein geschnittener Pfad für Codex ist die Auflösung, die beide Sätze erfüllt; „beide
voll" erfüllt nur den ersten. **Nicht von mir entschieden — vorgelegt.**

**Offene Frage des Owners an die nächste Session:** „können wir uns für Codex manches an
Berechtigungen sparen?" Antwort steht noch aus und gehört in den Codex-Spike (`0c4a9481`), weil sie
nur gemessen zu haben ist. Was dabei aus diesem Repo gilt: `--allowedTools` ist ADDITIV zur
Allow-Liste in `~/.claude/settings.json`, geklammerte Muster binden erst mit `--setting-sources ""`
(empirisch 2026-07-25) — und **eine Modell-Weigerung beweist NICHTS**, nur eine mechanische
Verweigerung zählt, wörtlich zitiert. Was immer Codex über seine Rechte behauptet, wird mit einem
Canary geprüft.

**Als IDEE abgelegt, ausdrücklich nicht jetzt zu tun** (Owner: „das sollten wir aber nur als idee
ablegen und bald darauf zurückkommen"): die Daten auf dieser Maschine aufräumen und Claude Fleet im
Zweifel von der Main-Session des Owners auf diesem Rechner fahren. Motiv ist dasselbe
Vertrauensthema. Nicht anfangen, ohne dass der Owner es aufruft.

### Owner-Kritik an MEINER Arbeitsweise, 2026-08-08 — bitte nicht wiederholen

Wörtlich: *„ich denke das hauptproblem gerade ist das du dich so viel auf deinen Kontext
fokussierst"*. Er hat recht. Ich habe in dieser Session laufend Budget-Arithmetik in die Antworten
geschrieben und dreimal eine Kette NICHT angefangen, die bequem gepasst hätte — der Owner musste
die Schwelle dreimal nach oben korrigieren (40 → 42 → 44), bis ich aufhörte, sie als Decke zu lesen.

**Operativ:** rechne dein Budget, wenn eine Entscheidung wirklich davon abhängt, und schreib die
Schätzung dann EINMAL hin (so verlangt es die Regel in `CLAUDE.md`). Aber mach den eigenen Kontext
nicht zum Gesprächsthema — der Owner will Arbeit sehen, nicht Buchhaltung. Der Owner hat
angekündigt, sich dafür „ein smartes System bzw. einen Prompt" zu überlegen; bis dahin gilt:
im Zweifel arbeiten, nicht abwägen.

### Korrekturen, die man kennen muss

- **`post-land-audits.jsonl` führt das Ergebnis als `result` (`green`/`red`), nicht als `ok`.**
  Ich habe in dieser Session einmal auf `ok` gelesen, `None` bekommen und beinahe einen grünen
  Audit als „nicht feststellbar" gemeldet.
- **Das Feld einer LaneOutcome-Zeile heißt `disposition`, nicht `outcome`** — darüber ist auch
  eine Lane gestolpert.
- **Sechs Sonden-Defekte an einem Tag, jedes Mal war der CODE richtig** (drei in F6, zwei im
  Container, einer im Klon). Die Regel im Regelbuch steht damit auf sechs Instanzen aus einem Tag,
  nicht auf dreien.

---

## Session 39: acht Lands, alle über Lanes, alle mit Ledger-Spur

**Das Erste:** `./state.sh` · `./register.sh` · die ersten zwei Regeln in `CLAUDE.md` — **und die
zwei Zeilen, die ich dort geändert habe** (der Verb-2-Absatz im Deploy-Abschnitt · die
`BACKLOG.md`-Korrektur in Zeile 12). `CLAUDE.md` ist gitignored, sie stehen in keinem Commit.

### Was in Flug ist

**NICHTS.** Alle neun Lands sind durch, alle Zeilen geschlossen, keine Lane auf Platte außer dem
Steward, Suite-Mutex frei, Adjudikations-Schuld null. Der letzte Post-Land-Audit (`59f59b9`) ist
**grün** (639 s) — der erste grüne Audit nach zwei roten, und zwar auf genau dem Baum, der die
Commit-Sonden umgebaut hat. Deploy ist verifiziert: `codeBehind:false`, `bundleStale:false`,
`errors:null`. Du startest auf einem sauberen Brett; **prüf es trotzdem selbst.**

### Die acht Lands (Bodies lesen, die tragen die Messungen)

| SHA | Zeile(n) | Kern |
|---|---|---|
| `11eea2a` | `8bdf0e81` `8830dddc` | Verify-Gate: SIGTERM→SIGKILL-Staffel **und** `FLEET_VERIFY_CMD_REPOS` pro Repo |
| `1241abd` | `25b79c23` | Repair-Worker darf committen; ein Check hält Prompt↔Profil zusammen |
| `3280a10` | `a5030c42` | Drift-Block filtert den Nenner auf die instrumentierte Population |
| `374f29a` | `118ad609` | **`CLAUDE.md` hat einen Drift-Pin** (`e2e/pins.ts` §6), dreiwertig und stumm |
| `0db08ac` | `cf557dc4` | `docs/data-saver.md` §2 + §5 nachgeschrieben |
| `2216de8` | `2c92a467` | Requeue nimmt seine Lane mit — außer sie trägt Arbeit |
| `53f5ce8` | `c0a8366b` | Worktree-Stapel hängt unter der zuletzt aktiven Main-Session |
| `4311c92` | `989cccf7` | **Verb 2 (Deploy) gebaut** — und nie gezogen |
| `59f59b9` | `560b7196` | die „siebte Flake-Familie" war **keine** — plus ein echter Client-Defekt |

Zehn Zeilen geschlossen, drei eingereicht (davon eine sofort erledigt) → **59 offen von 157**.
Alle neun Lands mit Gate-Note, LaneOutcome UND Post-Land-Audit; die Ledger-Lücke aus Session 38
wächst nicht weiter.

### Die „siebte Flake-Familie" — und warum sie am Ende keine war

Signatur: ein Check der Commit-Familie fällt mit
`{"committed":false,"reason":"the session is actively working right now …"}`. **Welcher Check es
trifft, wechselt von Lauf zu Lauf** — fünf Sichtungen an einem Tag (drei Lanes, zwei
Post-Land-Audits), in `docs/verify-tiering.md` vorher **null** mal geführt.

**Die Auflösung, und sie widerlegt mein eigenes erstes Urteil: der Commit-Gate feuerte KORREKT.**
Die Sonden hatten nur nie erklärt, dass sie den Baum meinen — sie posteten `/commit` ohne
`confirm`, und die Wache kam ihrer eigentlichen Absage zuvor (`detached-HEAD` und `FIX4` fielen
mit dem FALSCHEN Grund). Nicht der Baum war schuld, sondern der Test. Ich hatte beide roten Audits
als `flake` adjudiziert; **nach dem Fix habe ich beide auf `stale-test` korrigiert** (neuestes
Urteil gewinnt). Adjudikations-Schuld null.

Der Fix wählte `confirm:true` statt Abwarten, mit einem Argument, das man kennen sollte: Warten
wäre keine Wartezeit, sondern eine Retry-Schleife in genau der `send-keys+sleep`-Form, die §11.2c
verboten hat — ≥3 s × 16 Aufrufstellen pro Lauf. Die Wache bleibt scharf (ein Beweisblock in
`e2e/lanes-basic.ts` hält beide Richtungen), und ein **Rot-Schutz als Regel statt Liste** scannt
`e2e/*.ts` auf Commit-POSTs ohne `confirm`. Drei serielle Läufe grün gegen ~25 % Basisrate.

**Ein echter Produktdefekt fiel dabei heraus:** `doLand` (`src/client.ts`) committete ohne
`confirm`, obwohl die gerade bestätigte Risk-Preview wörtlich sagt, dass zuerst committet wird —
auf einer noch schreibenden Lane also 409, und weil der Body `reason` statt `error` trägt, las der
Alert `could not commit the work first: undefined` für einen **gesunden** Baum.

**Die Beweisform, die ich gelernt habe und die schärfer ist als die dokumentierte:** beim ersten
Rot war der Rerun desselben Baums NICHT grün — es fielen **zwei andere Checks derselben Familie**.
Verschiedene Checks auf identischem Baum belegen Nicht-Determiniertheit *direkter* als ein grüner
Lauf, denn ein grüner kann auch „die Flake hat diesmal nicht gefeuert" heißen.

**Und ein Argument für den Trail, ungeplant:** die Ausgabe des zweiten roten Audits hatte ihre
eigene `FAIL`-Zeile durch Retention verloren („1 FAILURES", null FAIL-Zeilen). Der Trail trug alle
1698 Zeilen, genau eine mit `ok:false`, mit Detail. Das macht `17068154` (Trail-Deckel) **teurer**,
nicht billiger: das Werkzeug wird gerade wertvoll, während seine Selbstaussage unbelegt ist.

### Verb 2 ist gebaut und wartet auf DEINE Hand

`POST /api/deploy` / `GET /api/deploys`, Owner **und** Steward-Token. **Kein Tick ruft sie** — der
erste Zug ist dein Entscheid, und ich habe alle acht Deploys dieser Session bewusst von Hand
gefahren statt die frische Route auf sich selbst loszulassen. Konstruktion: der Deploy tötet
seinen eigenen Verifizierer, also verifiziert der **nächste Boot** über `deploy-inflight.json` →
`deploys.jsonl`; `ok:null` = „nicht feststellbar", nie ein Pass; Build zuerst und allein; 409 bei
laufendem Post-Land-Audit. Details stehen jetzt in `CLAUDE.md`, Deploy-Abschnitt.

### Was ICH falsch gemacht habe (beides billig, beides lehrreich)

1. **Eine Schleifenbedingung gegen einen SHA aus dem Gedächtnis.** Die erfundene Langform von
   `374f29a` stimmte nicht, die Bedingung war sofort wahr, mein Watcher meldete „fertig", während
   das Land noch lief. Kein Schaden — aber die Regel „nie eine Zahl aus dem Gedächtnis" gilt
   besonders dort, wo sie still falsch wird statt laut.
2. **Geschätzte `ctx`-Zahlen berichtet.** Ich nannte ~33 %, gemessen waren 19,8 %. Der Sensor ist
   an der Slot-Row (`ctx`), er kostet einen Poll — schätz ihn nie.

Dazu ein Fast-Fehler, der die Lese-Regel bestätigt: direkt nach `bun run build` meldete der Poll
weiter `bundleStale:true` mit dem **alten** `appJsMtime`, während `stat` frische Dateien zeigte.
Derselbe alte Wert in der Antwort = **gecachter Fakt**, nicht „Build hat nicht geschrieben".

### Was der Brief-Kompiler wert war (für die Frage „lohnt das?")

**Jede** der acht Zeilen hatte veraltete Zeilenrefs — mehrfach um 1000+ Zeilen (`MERGE_TOOLS` stand
als 4007 in der Zeile, real 5258; `briefAndSend` als 1993, real 2742). Zweimal war die *Begründung*
der Zeile überholt: `a5030c42` argumentierte mit „11 %, unter der Schwelle" — gemessen waren es
32,5 %, also darüber. Und dreimal fand die Lane einen Fehler in MEINEM Brief (die §5-SHAs waren
Zwillinge der umgeschriebenen Historie; `/api/steward/sessions` trug die Deploy-Fakten längst).
**Der Kompiler ist der Grund, warum keine dieser acht Lanes auf eine tote Referenz gebaut hat.**

### Kontext-Praxis (zweiter Datenpunkt)

`ctx` beim Übergeben = **32,9 %** (329.496 / 1M, am Poll gelesen). Produziert: 9 Lands · 10 Zeilen geschlossen · 3 eingereicht ·
2 rote Audits beurteilt (und nach besserem Wissen korrigiert) · 2 `CLAUDE.md`-Korrekturen ·
1 verwaister Worktree entfernt. Session 38 übergab bei 37,1 % mit 3 Lands. Die Fixkosten-Rechnung hält: der Unterschied
ist nicht Sparsamkeit, sondern dass Lanes die Arbeit tragen und die Main-Session nur brieft,
landet und urteilt.

### Für dich offen (unverändert Owner-Sache, nicht erneut vorlegen)

`17068154` (Trail-Deckel — jetzt teurer, s. o.) · `d375c581` (Trail-Reaper) · `f520e704` ·
`2784427e` · `96b72c22` · `c3531b41`. Neu von mir eingereicht: `9bcc460e` (mtime-Fallback serviert
fremde Konversation, an HEAD verifiziert) · `e7d61b59` (immutable-Cache-Widerspruch, als NOTIZ
gemeint — die Owner-Route setzt `kind` hart auf `lane`, siehe `65af341f`).

Maschinen-Hygiene, ungeräumt: 2 verwaiste e2e-tmux-Sockets, **325 MB** TMPDIR-Scratch.

---

## Session 38: die Session, deren Arbeit in keinem Land-Ledger steht

**Das Erste für die nächste Session:** `./state.sh` · `./register.sh` · die ersten zwei Regeln in
`CLAUDE.md` — **und dann die vier Zeilen, die ich heute eingefügt habe** (Direkt-Commit-Blindheit ·
40-%-Schwelle · Sonden-Regel · `FLEET_HARNESS_AUTOMATION`). Sie stehen dort, weil sie sonst
verloren gehen: `CLAUDE.md` ist gitignored.

### DAS WICHTIGSTE, sonst liest du den Zustand falsch: drei Lands, NULL Ledger-Spur

`0e2a672` · `4955444` · `efda3eb` — alle drei sind **Direkt-Commits auf main aus dem
Haupt-Checkout** (der Owner sagte „arbeite selbst"), nicht Lands über eine Lane. Konsequenz,
gemessen und nicht vermutet:

- **kein** `git notes --ref=fleet/land` für die drei SHAs
- **keine** Zeile in `lane-outcomes.jsonl`
- **KEIN Post-Land-Audit** — `schedulePostLandAudit(repo, main, BRANCH, mainAfter)` hängt am
  Land-Pfad, nicht an einer Bewegung von main. Das Audit-Ledger endet bei `6061b491` (Session 37).

**Die Abdeckung ist trotzdem gleichwertig**, und das ist der Punkt: das Audit-Kommando IST
`./e2e-isolated.sh`, und ich habe die volle Gate-Kette auf jedem Baum von Hand seriell gefahren —
`pins` · `tsc --strict` (11 Ziele) · `e2e-clean-review` · `e2e-security` · `e2e-claude-gate` ·
`e2e-isolated` (1635 Checks, 0 FAIL beim letzten Lauf). Was fehlt, ist der **EINTRAG**, nicht die
Messung. Ich habe zweimal fast selbst darauf hereingefallen und dem Owner einmal fälschlich
gemeldet, die Audits liefen. **`./state.sh`s Land-Health-Zahlen zählen Lanes — sie untertreiben
diesen Tag.** Steht jetzt als Regel im Regelwerk.

### Was gelandet ist (Bodies lesen, die tragen die Messungen)

| SHA | Register-Zeile | Kern |
|---|---|---|
| `0e2a672` | `5388c07d` `04607d0b` `4544f602` `380d24ee` | vier stille Halbwahrheiten; die eigentliche Falle waren die FIXTURES |
| `4955444` | `b28ce533` | Probe pro Slot — Fakt getrennt vom Gate, Entscheid blieb beim Owner |
| `efda3eb` | (Owner-Auftrag) | Automation scharf, mit ZWEI Bedingungen statt einer |

Fünf Register-Zeilen geschlossen, zwei neue eingereicht → **65 offen von 154**.

### `FLEET_HARNESS_AUTOMATION=1` ist LIVE — und heute wirkungslos

Owner-Entscheid. Live verifiziert am Config-Sensor (`./state.sh`: `live=1 | watchdog.sh` — der
Sensor erfasst neue Variablen von selbst, es war keine Zusatzarbeit nötig).

- **Zwei Bedingungen, nicht eine:** der Flag ist die Zustimmung des Operators,
  `automatable: true` am Adapter ist der Anspruch des einzelnen Harness. Pflichtfeld → ein neuer
  Adapter antwortet beim Compile. Ich hatte das in `4955444` falsch gebaut (ein globales `||`) und
  es beim Prüfen VOR dem Flip repariert; sonst hätte die Container-Zeile `c3531b41` die Erlaubnis
  stillschweigend geerbt.
- **Wirkung am Tag des Einschaltens: NULL.** Kein Slot fährt einen fremden Harness (alle aktiven
  tragen `harness: null`, an `fleet.json` geprüft). Der Flag bewaffnet eine Fähigkeit.
- **Was er NICHT öffnet, und darum war er entscheidbar: kein Tick landet.** Die einzige
  `mergeJob(`-Aufrufstelle ist eine Route. Jeder geöffnete Pfad tippt einen PROMPT in eine Pane.
- Zurückdrehen = das eine Wort in `watchdog.sh`, dann `launchctl kickstart` **zuerst**, dann
  srv killen. (Diese Reihenfolge live bestätigt: der kickstart tastet ein laufendes srv nicht an —
  es lebte danach noch, ich musste es extra killen.)

### Owner-Entscheid 2026-08-07: Kontext-Schwelle ~40 % statt 45 %

Meine Empfehlung war 40 und **gegen 35**, mit Rechnung: Fixkosten ~10–11 % pro Session (davon
**7,6 % nur Erdung**, an mir gemessen), also bleiben bei 40 % ~29 % produktiv, bei 35 % nur ~24 % =
**1,42× so viele Sessions** für dieselbe Arbeit. Belegt an dieser Session: meine zwei ersten Lands
kosteten 24,5 % (7,6 → 32,1) — bei 35 % hätte ich EINES geschafft.

**Die Zahl ist der schwächere Teil. Der stärkere: fang keine Kette an, deren plausible Kosten dein
Restbudget bis ~70 % übersteigen.** Ich habe das auf mich angewandt und den Trail-Umbau
(`17068154`, plausibel 12–15 %) bei 32 % NICHT angefangen, sondern die Wissensschuld bezahlt.

**Erster Datenpunkt der neuen Praxis (jeder Handoff notiert das ab jetzt):**
`ctx` beim Übergeben = **37,1 %** (370.769 / 1M). Produziert: 3 Lands, 20 neue Checks, 3 Pins,
2 Deploys, 5 Zeilen geschlossen, 2 eingereicht, 7 Regelwerk-Änderungen.

### Die Lehre des Tages, dreimal bezahlt: bei einem roten Check an FRISCHER eigener Arbeit ist die SONDE der erste Verdächtige

Dreimal rot, dreimal war der **Code richtig und mein Check falsch** — und jedes Mal lautete die
naive Lesart „der neue Gate ist kaputt":

1. `§6b` erwartete `no-agent` für einen Pi-Slot — **maschinenabhängig** (`pi` ist hier installiert).
   Richtig ist `!== "unprobed"`: die einzige Antwort, die beweist, dass die Probe NICHT stattfand.
2. `§6c` erzeugte seinen Probe-Auto mit `inSec: 0` → die Route weist das mit **400** ab
   („one-shot needs inSec ≥ 1"), und mein Helfer **verschluckte den 400 still**.
3. `§6b` verlangte von einem gerade zurückgesetzten Slot `unprobed` und bekam den Wert seiner
   Pi-Phase — `agent` ist ein **git-Tick-Cache**, und ein beim `kill` schon fliegender Tick
   schreibt NACH dem Neu-Öffnen zurück.

**Das Werkzeug ist die SIGNATUR gegen die Erwartung zu lesen, nicht den Fehlschlag zu glauben:**
bei (2) verriet es „`null` in BEIDEN Zeilen, auch der Gegenprobe" = nie gemessen; bei (3)
„`no-agent` kann aus einer LEEREN comms-Liste strukturell nicht entstehen" = also war der Slot zum
Messzeitpunkt noch pi. Konsequenz, jetzt Regel: **eine Sonde, die nicht laufen konnte, muss als SIE
SELBST scheitern** — eigener `check()` auf ihre Voraussetzung.

### Was dem Owner zur Entscheidung vorliegt (nicht erneut melden, er weiß es)

- **`17068154`** (Trail-Deckel) — `GET /api/flakes` sagt `never-failed` über 741 verschwiegenen
  Dateien. Drei Schnitte stehen in der Zeile; „Deckel hochsetzen" ist keiner. **Höchste Kosten von
  allem Offenen**, weil ein geglaubtes Werkzeug schlimmer ist als keines.
- **`d375c581`** (Trail-Reaper, ~4,4 MB/Tag) — hängt an `17068154`.
- **`f520e704`** (Steward kritisch beleuchten) · **`2784427e`** (F6, Entwurf ≠ Brief beim Ablageort)
- **NEU `96b72c22`** — billiges Fremdmodell an EINEN Wegwerf-Worker. **Der Seam existiert schon,
  keine Server-Änderung nötig:** `runWorker` → `summaryViaSubprocess` (`Bun.spawn([cmd, "--model",
  …])`, Prompt auf stdin), neun der zehn Worker haben ihr eigenes `FLEET_*_CMD`. Erster Kunde
  `commitMsg`, weil seine Ausgabe begrenzt ist und sein Fehlschlag seit `0e2a672` SICHTBAR.
  Braucht einen API-Key. Warze: `SUMMARY_MODEL` validiert gegen `MODEL_RE` (kein `/`), das Modell
  muss also im Wrapper stehen. Preise belegt: $1,25/M in, $4,25/M out — **nicht** „cents".
- **NEU `c3531b41`** — Slots/Worktrees in Container. Der teure Teil ist nicht das Starten, sondern
  das ZUSEHEN: tmux, `git -C` und `projDir` sind alle drei host-lokal. Vorbedingung war
  `b28ce533` — **die ist jetzt gelandet.**

### Kleinigkeiten, die man wissen muss

- **Slot 5 (`main-37`) ist geschlossen** — `fleet.json` führt ihn gar nicht mehr, und das schreibt
  nur `killSlot`. Nicht mein Deploy (Beweis oben). 11 aktive Slots.
- Der Steward-Puls `f2a34b1f` (Slot 12, `/inspektion`, stündlich) und mein Heartbeat `5e2229c3`
  (Slot 7) laufen. **Fasst du Slot 12 an, leg sein Auto neu an** — der Puls stirbt beim Neu-Öffnen.
- Adjudikations-Schuld: **0** (alle 18 roten Audits von 80 tragen ein Urteil).
- `e2e-isolated` gemessen: **p50 8,7 min, p90 10,0 min** über 80 Läufe. Die drei Gate-Suiten sind
  der schnelle Teil.
- Die Suiten setzen `FLEET_HARNESS_AUTOMATION=0` jetzt **explizit** (`e2e-isolated.sh`): nicht
  genannte Vars erbt der Test-Server aus der aufrufenden Shell, und `§6c` hängt an ihrem
  Aus-Zustand.
- **Nicht bestätigt, entgegen meiner eigenen früheren Behauptung:** die Suite-Mutex-Gewohnheit vor
  jedem Land („warte auf einen freien Mutex") hat von MIR keine neue Evidenz — meine drei Commits
  liefen nie durchs Land-Gate, es gibt also kein `waitMs`. Session 37s Beobachtung (8 Lands, alle
  `waitMs 0`) steht weiter allein.

---

# Ältere Sessions (37 und darunter): in der git-Historie dieser Datei, nicht mehr hier

Bis 2026-08-08 sammelte diese Datei **jede** Session im Detail — 2861 Zeilen, Session 13 bis 39.
Gekürzt auf die drei jüngsten, Owner-Entscheid: „die letzten paar sind ja vielleicht noch
hilfreich, aber nicht alle".

**Es ging nichts verloren.** Die Datei hat 103 Commits; jede alte Übergabe steht vollständig darin:

```sh
git log --follow -p -- HANDOFF.md        # alles, chronologisch rückwärts
git log --oneline -- HANDOFF.md          # welcher Commit welche Übergabe brachte
git show <sha>:HANDOFF.md                # eine bestimmte Fassung im Ganzen
```

**Warum das richtig ist und nicht bloß aufgeräumt:** diese Datei trägt per Konstruktion nur das
*Residuum* — Absicht, was in Flug ist, Korrekturen. Alles andere wird abgeleitet und ist damit
aktueller als jede Prosa hier: der Zustand aus `./state.sh` und `./register.sh`, die Befunde aus
den **Commit-Bodies** (`git log <letzter Handoff>..HEAD`), die Regeln aus `CLAUDE.md`. Ein
Handoff von vor zwei Wochen beschreibt einen Baum, den es nicht mehr gibt; ihn oben liegen zu
lassen macht ihn nicht wahrer, sondern nur sichtbarer als die Quellen, die stimmen.

## Ein loses Ende aus dem gekürzten Teil, bewusst mitgenommen

`0de526c` (*„docs(autonomy): vier Bausteine, und drei Prämissen, die sich bewegt haben"*,
2026-08-06, doc-only, 333 Zeilen) hängt an **keinem Branch** — `git branch -a --contains` ist
leer. Auffindbar war er nur über die Handoff-Zeile, die ihn nannte; darum steht er hier.
Seine Queue-Zeile `1981be9a` ist `done`, und `docs/autonomy-bausteine-2026-08-06.md` existiert
in main — aber mains Fassung **weicht ab** (132+/99−). Ob die 99 Zeilen des verwaisten Standes
inhaltlich abgedeckt sind, ist **ungeprüft**; wer es beantworten will:
`git diff 0de526c main -- docs/autonomy-bausteine-2026-08-06.md`. Ein verwaister Commit
überlebt kein `git gc` mit Ablauf — wer die Antwort braucht, holt sie besser früh.

