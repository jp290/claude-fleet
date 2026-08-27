---
frage: In drei zufällig gezogenen Bereichen je Behauptung, trägt der Code sie heute, kann die Sonde überhaupt fallen, und was hat keine Gegenprobe?
urteil: Fünf Funde, schwerster ist, dass der LIVE-Land-Gate src/helper.ts seit sieben Tagen nicht typprüft (der Watchdog liest VERIFY_CMD nur bei eigenem Neustart); dazu 26 ungetestete Validator-Codes, eine nicht-fallbare .git-Sonde und zwei Sonden ohne Invarianten-Deckel
bereich: [verify]
belege: [watchdog.sh:91, e2e/dirs-pins.ts:70, context-pack-validator.ts, server.ts#buildCodeGraph, server.ts#fleetReportsFor]
nicht-gemessen: Keine Suite gefahren (Sonde-bleibt-grün-Aussagen für Fund 4 und 5 sind abgeleitet); die vier Messungen im buildCodeGraph-Kommentar nicht nachgemessen; kumulatives Zeitbudget nicht verfolgt; kein Ausspruch über src/helper.ts-Inhalt
stand: 2026-08-26
---

# Stichprobe: tragen die Behauptungen in drei GEZOGENEN Bereichen noch?

2026-08-26, Lane `fleet/260826174445-b746`. Frage: **In drei zufällig gezogenen Bereichen — je
Behauptung: trägt der Code sie heute, kann die Sonde überhaupt fallen, was hat keine Gegenprobe?**

Kein Produktionscode geändert. Alle Mutationsversuche liefen auf einer Kopie im Scratchpad.

## Die drei Lose

Gezogen VOR jedem Lesen, ein Durchgang, keine Nachziehung:

```
A) ls e2e/*.ts | sort -R | head -2
   → e2e/dirs-pins.ts · e2e/context-packs.ts

B) rg -n '^(async )?function [a-zA-Z]' server.ts | sort -R | head -3
   → server.ts#pulseLastOutput · server.ts#buildCodeGraph · server.ts#fleetReportsFor

C) ls docs/*.md | sort -R | head -2
   → docs/queue-analyst.md · docs/rollen-evidenz-2026-08-21.md
```

## Ergebnis — fünf gerankte Funde

Schnittlinie nach Fund 5: darunter steht eine Korrektur ohne Kostensatz, keine Verbesserungsliste.

### 1. Der LIVE-Land-Gate typprüft `src/helper.ts` seit sieben Tagen nicht — vier Dateien behaupten, er täte es

Nicht aus einem Los. Gefunden im VERIFY-Schritt dieses Auftrags selbst.

`watchdog.sh:91`, `AGENTS.md:148`, `CLAUDE.md:65` und `rulebook/lane-discipline.md:26` führen
`src/helper.ts` in der tsc-Liste. Die tatsächlich laufende Kette — `GET /api/self/gate`,
`verify.cmd` — führt sie **nicht**.

Gemessen, dass die Datei damit gar nicht erreicht wird (nicht transitiv über einen Import):

```
bunx tsc --noEmit --strict … --listFiles \
  e2e/pins.ts src/client.ts src/share.ts server.ts fleet-e2e.ts … merge-prompt.ts \
  | grep -c 'src/helper.ts'
→ 0
```

Mechanismus, belegt: `VERIFY_CMD` ist eine Shell-Variable in `watchdog.sh`, die bei
`watchdog.sh:148` als `FLEET_VERIFY_CMD='$VERIFY_Q'` in das Pane-Kommando des Servers gebacken
wird. Der laufende Watchdog hat `watchdog.sh` zu SEINEM Start gelesen:

| | |
|---|---|
| `13451c0` fügte `src/helper.ts` in `watchdog.sh` ein | 2026-08-26 10:44 |
| Server-Prozess (pid 51988) gestartet | 2026-08-26 19:35 — **nach** dem Commit |
| Watchdog-Prozess (pid 25122) gestartet | **2026-08-19 19:38** — sieben Tage **vor** dem Commit |

Ein Server-Neustart zieht eine `VERIFY_CMD`-Änderung also NICHT nach; nur ein Watchdog-Neustart tut
es. Der Server von heute Abend trägt die Kette vom 19.08.

**Kosten:** Typfehler in `src/helper.ts` landen grün — in genau der Datei, die `13451c0`
ausdrücklich in den Gate aufgenommen hat, damit das nicht passiert. Und die Abweichung ist
strukturell unsichtbar: alle vier geschriebenen Quellen sind sich einig, nur der laufende Prozess
weicht ab — und `CLAUDE.md` erklärt ausgerechnet den laufenden Prozess für maßgeblich („bei
Abweichung von der Verify-Zeile oben gilt die Route"). Wer die Regel korrekt befolgt, misst das
Loch nicht, sondern übernimmt es. Dieselbe Naht trägt `AUDIT_Q` und jede andere `FLEET_*`-Variable
in `watchdog.sh:148`.

Nicht repariert: der Watchdog ist geteilte Realität außerhalb dieses Repos-Baums.

### 2. `e2e/dirs-pins.ts:70` „the search never descends into .git" KANN nicht fallen

Die Sonde läuft mit `hidden` AUS (`e2e/dirs-pins.ts:63`, kein `&hidden=1`). In `server.ts#findDirs`
greift dann schon der generische Punkt-Filter, lange bevor die `.git`-Wache erreicht wird:

```ts
if (!hidden && e.name.startsWith(".")) continue;   // ← hier ist .git bereits weg
…
if (!link && e.name !== ".git") next.push(path);   // ← DIESE Zeile wird nie geprüft
```

**Mutationsbeweis** (Kopie im Scratchpad, Fixture mit `alpha/a1/needlehere`, `alpha/.git/needlehere`,
`.dotzone/needlehere`) — die Wache entfernt, `if (!link) next.push(path);`:

| Lauf | hits | Sonde :70 |
|---|---|---|
| unmutiert, `hidden` aus | `alpha/a1/needlehere` | grün |
| **mutiert**, `hidden` aus — *was die Suite fährt* | `alpha/a1/needlehere` | **grün** |
| mutiert, `hidden=1` — *was die Suite nie fährt* | `.dotzone/…`, `alpha/a1/…`, **`alpha/.git/needlehere`** | (rot, ungeprüft) |

Gegenprobe im unmutierten Lauf: `visited` steigt 5 → 7 bei `hidden=1`, d. h. mit `hidden` aus wird
`.git` gar nicht erst geöffnet — es wird als Punktordner verworfen, nicht als `.git`.

**Kosten:** Die `.git`-Wache ist löschbar, ohne dass die Suite es sagt. Sie trägt genau im
`hidden=1`-Fall, und der Kommentar in `e2e/dirs-pins.ts:17` („the walk must classify its parent as a
repo and never descend into it") behauptet eine Deckung, die die Zeile nicht hat. Die Fixture baut
das `.git`-Verzeichnis eigens dafür — die Sonde liest sich wie ein Beweis und misst den Punkt-Filter.

### 3. 26 der 38 Validator-Codes haben nirgends im Repo eine Sonde — alle 26 feuern

`context-pack-validator.ts` deklariert 38 Codes (`CONTEXT_PACK_VALIDATION_CODES`).
`e2e/context-packs.ts` prüft 12. Die übrigen 26 kommen im ganzen Repo nur in Prosa vor
(`docs/unterbau-audit-glm-2026-08-21.md`, `docs/triage/…`), in keiner Suite.

Gemessen, dass keiner davon toter Code ist: 26 gezielte Mutationen gegen den echten Manifest, jede
feuert ihren Code (Skript in §Methode). Auszug:

```
caps map EMPTY (no harness observed)      verdict=unknown  CAPABILITY_AVAILABILITY_UNKNOWN ×32
supersedes -> nonexistent id              verdict=fail     SUPERSEDES_TARGET_MISSING
pack: unknown top-level key               verdict=fail     PACK_UNKNOWN_KEY
public pack: carries privateSourceId      verdict=fail     PUBLIC_SOURCE_REFERENCE_INVALID
public pack: hash without observedAt      verdict=fail     SOURCE_OBSERVATION_INCOMPLETE
```

Der teuerste einzelne: **`CAPABILITY_AVAILABILITY_UNKNOWN`**. Er ist der Zwilling des EINEN
Unknown-Pfades, den die Suite pinnt — `e2e/context-packs.ts:196`, „absent injected bytes are
explicit unknown, never pass or false". Dieselbe Invariante („unbeobachtet ≠ bestanden"), andere
Hälfte, keine Sonde: wer im Capability-Zweig `continue` durch einen Durchlauf ersetzt, kippt
`unknown` → `pass`, und die Suite meldet ALL PASS.

Zweiter Befund derselben Familie: `PRIVATE_SOURCE_LEAK` hat zwei unabhängige Zweige (`"sources" in
raw` und die `PRIVATE_LEAK_KEY`-Schleife). `e2e/context-packs.ts:132-141` löst BEIDE gleichzeitig
aus und prüft mit `hasCode(…)` nur, dass irgendeiner feuerte — gemessen feuert jeder auch allein,
also ist keiner der beiden einzeln festgenagelt.

**Kosten:** Der Validator ist die einzige Instanz, die zwischen `pass`, `fail` und `unknown`
unterscheidet; 26 seiner Urteile sind löschbar, ohne dass eine Suite rot wird.

Ausdrücklich KEIN Fund: `e2e/context-packs.ts:83` prüft seine eigene Voraussetzung als sie selbst
(„fixture: tracked paths and source bytes were explicitly collected") — genau die Form, die das
Regelbuch verlangt.

### 4. `server.ts#buildCodeGraph` — die lasttragende Invariante hat keine Sonde

Der Kommentarblock über `buildCodeGraph` beschreibt einen bezahlten Unfall: die erste Fassung baute
den Graphen IM Worktree, `graphify-out/` wurde untracked sichtbar und **54 Checks wurden rot** —
zwölf als blockierter Land, der Rest als „agent reported rebased, but the lane is not clean", d. h.
der Server beschuldigte den Agenten für ein Verzeichnis, das er selbst angelegt hatte.

Die Reparatur ist heute genau zwei Zeichenketten an der Aufrufstelle:

```ts
const laneDir = `${tmpdir()}/fleet-lane-graph-${randomBytes(6).toString("hex")}`;
const mainDir = `${tmpdir()}/fleet-main-graph-${randomBytes(6).toString("hex")}`;
```

Gelesen: keine Sonde fasst `buildCodeGraph` an. `e2e/prompts.ts` prüft ausschließlich die
PROMPT-Seite und tut das gründlich (fail-closed ohne Graph, beide Seiten getrennt benannt,
`MERGE_TOOLS` ohne bares `graphify`) — mit **fest verdrahteten Fantasiepfaden**
(`e2e/prompts.ts:181-182`), die die Bau-Funktion nie ausführen. In `e2e/pins.ts` steht dazu nichts.

**Kosten:** Ein Rückfall auf ein worktree-relatives Verzeichnis landet grün durch den Gate (der
`e2e-isolated.sh` nicht fährt) und erscheint danach als „agent reported rebased, but the lane is not
clean" — also in einer Signatur, die `docs/verify-tiering.md` §11 als bekannte Flake-Familie führt
und die den AGENTEN beschuldigt. Der Unfall würde ein zweites Mal bezahlt und dabei falsch
zugeordnet.

### 5. `fleetReportsFor` bindet auf ein Tripel — geprüft wird nur ein Drittel davon

`server.ts#fleetReportsFor` (und ihr byte-gleicher Zwilling `server.ts#clarificationsFor`) binden
auf `slot` UND `openedAt` UND `sessionId`. Das ist die Wache gegen den recycelten Slot: ein neuer
Bewohner von Slot N darf die Reports des vorigen nicht sehen.

Geprüft wird davon nur `slot`. `e2e/watch.ts:1333` (Q3) stellt Worker, gebundene MAIN und eine
FREMDE MAIN gegenüber — drei **verschiedene Slotnummern**. Gelesen: keine Sonde in `e2e/` hält
dieselbe Slotnummer mit neuem `openedAt` gegen `/api/self/fleet-report` oder gegen die
Clarification-Sicht.

Das Muster ist im Repo etabliert und anderswo dreimal geprüft — `e2e/programs.ts:1318` („same slot
with new openedAt inherits no Program"), `e2e/steward-outcomes.ts:653` („a recycled slot reports NO
founding task"), `e2e/share.ts:170` („a share must not outlive its session"). Nur diese Familie hat
es nicht.

**Kosten:** `bound()` auf `b.slot === s.id` zu verkürzen lässt Q3 grün (alle Beteiligten haben
verschiedene Slotnummern) und leckt Fremdberichte an den Nachmieter eines Slots — in einer Route,
deren Kommentar (`server.ts:19536`) „GET is dual-scoped to the exact worker or receiver occupant"
verspricht. *Dass Q3 grün bliebe, ist aus dem Sondenaufbau abgeleitet, nicht durch einen Suite-Lauf
gemessen* — die Suite wurde auftragsgemäß nicht gefahren.

---

Unterhalb der Schnittlinie, ohne Kostensatz:

**`docs/rollen-evidenz-2026-08-21.md` §1, Zeilenverweis um eins daneben.** Das Dossier ist ein
DATIERTER Snapshot und nennt seinen Baum (`de1f6c6`) — Zeilennummern sind dort richtig. Geprüft:
`de1f6c6` ist erreichbar, `server.ts` hat dort exakt die behaupteten 19 323 Zeilen, und 12 von 13
zitierten Zeilen treffen. Die dreizehnte trifft nicht: der Block zitiert `:16786` für
`t.criterion = {text, proposedAt, confirmedAt: null}` („NUR dieses eine Feld"). Bei `de1f6c6` ist
`:16786` `saveState();`; die Zuweisung steht auf `:16785`. Ausgerechnet die Zeile, die die Aussage
des Absatzes trägt.

## Geprüft und in Ordnung (Behauptungen, die HEUTE tragen)

Gemessen, nicht abgeleitet:

- **`runGraphStep`s Timeout-Pfad ist korrekt.** Nachgebaut in Bun 1.3.9: ein per Timer getöteter
  Prozess liefert `await p.exited === 143` (`exitCode: null`, `signalCode: "SIGTERM"`), also
  `!== 0` → `return null`. Ein Timeout kann sich hier nicht als Erfolg tarnen.
- **`subjects` in `renderStewardMessage` braucht kein Flatten.** Git `%s` faltet einen mehrzeiligen
  ersten Absatz zu EINER Zeile (`od -c` an einem Commit mit zweizeiligem Subject: keine `\n` außer
  dem Abschluss). Die Asymmetrie zu `pulseLastOutput` (das flacht ZUSÄTZLICH ab) ist damit harmlos.
- **`docs/queue-analyst.md` §5 stimmt Wert für Wert** mit `server.ts:7854-7881`:
  `FLEET_ANALYSIS_MS` 60000, `FLEET_BRIEF_MS` 0, `FLEET_ANALYSIS_MODEL` `claude-opus-5`,
  `FLEET_ANALYSIS_TIMEOUT_MS` 420000, Batch-Cap 6, 3 Versuche, Backoff 60 s × 2^attempts,
  3 gleichzeitige Brief-Kompilate. Invariante 1 („`tickDispatch` selects `status === "queued"`
  only") trägt: `server.ts:8326`. Alle Symbolverweise der Kopfzeile lösen auf
  (`tickAnalysisSweep`, `tickDispatch`, `qGroupOf`, `analysisStale`, `e2e/tasks.ts` §(h) bei
  `:1638`).
- **`graphDirs`-Aufräumen läuft auf JEDEM Ausgang** — `server.ts:14917-14921`, im `finally`, wie
  der Kommentar behauptet.

Gelesen, kein Fund:

- **`[pulse-reply]` hat keinen Leser** — die Entschärfung in `server.ts#pulseLastOutput` und in
  `renderStewardMessage` nennt als Grund „a reply that a later harvest would read as this session's
  verdict", und diese Ernte existiert nicht. **Das ist kein neuer Befund:** das Repo hat es bereits
  gemessen und abgegrenzt (`docs/triage/pruefung-streichen-B.md:172`,
  `briefs/steward-kritik-2026-08-07.md:449` — „Ausdrücklich nicht Teil des Baus"). Absichtliche
  Lücke, kein Rot.
- **`question` im Pulse ist wirklich einzeilig** — `server.ts:17504` weist alle C0-Steuerzeichen ab
  (Bereich `\u0000-\u001f` plus `\u007f`), nicht nur `\n`.

## Methode

Lose: die drei Kommandos oben, einmal ausgeführt.

Fund 1: `GET /api/self/gate` gegen `watchdog.sh:91` / `AGENTS.md:148` / `CLAUDE.md:65`;
`tsc --listFiles | grep -c 'src/helper.ts'`; `git log -1 --format='%h %ci' 13451c0`;
`ps -o lstart= -p <pid>` für Server und Watchdog (PIDs über `pgrep`, **nie** eine Kommandozeile
ausgegeben — Token-Hygiene).

Fund 2: `e2e-stage.sh`s eigene `stage_instance` in ein Scratch-Verzeichnis, Server auf
`127.0.0.1:8877` / `8878` mit eigenem tmux-Socket `fleetlane77` / `78` und `FLEET_CMD=true`;
Fixture unter dem Scratchpad; `sed` entfernte die `.git`-Wache in der SCRATCH-Kopie; danach beide
Server über die notierte PID beendet und beide Sockets `kill-server`. *Beim Sourcen von
`e2e-stage.sh` wird der Suite-Mutex `/tmp/fleet-e2e.lock` als Nebenwirkung genommen — nach jedem
Aufruf wieder freigegeben, Endzustand geprüft: frei.*

Fund 3: Skript im Scratchpad, importiert `context-packs.ts` + `context-pack-validator.ts` direkt,
30 Mutationen gegen `JSON.parse(JSON.stringify(CONTEXT_PACKS))`, Repo-Fakten aus `git ls-files`.
Abdeckungsvergleich: `rg -no '"[A-Z][A-Z_]{3,}"' context-pack-validator.ts | sort -u` gegen
`rg -o '"[A-Z_]{4,}"' e2e/context-packs.ts`, dann je Restcode `rg -l <CODE> --glob '!context-pack-validator.ts'`.

Fund 4/5: gelesen (`server.ts`, `e2e/prompts.ts`, `e2e/watch.ts`), Aufrufstellen über
`ast-grep`/`rg`. Keine Suite gefahren.

Fund 6: `git show de1f6c6:server.ts` in eine Datei, `sed -n '<zeile>p'` für jeden der 13 Verweise.

## Was nicht gemessen wurde

- **Keine Suite gefahren** — weder `./e2e-isolated.sh` (auftragsgemäß, Suite-Mutex ~11 min, und
  weder `e2e/` noch der Land-Pfad wurden angefasst) noch eine der sechs anderen. Alle Aussagen der
  Form „diese Sonde bliebe grün" für Fund 4 und 5 sind aus dem Sondenaufbau ABGELEITET. Für Fund 2
  ist sie durch die Mutation auf der Scratch-Kopie GEMESSEN.
- **Der Kommentarblock über `buildCodeGraph` nennt vier Messungen vom 2026-08-05** (bares
  `graphify .` scheitert an 108 Doc-Dateien; `--code-only` kostet 5,7 s / 1158 Knoten / 2938
  Kanten). Nicht nachgemessen — `graphify` ist auf PATH (`~/.local/bin/graphify`), aber ein Lauf
  hätte den Auftrag nicht bewegt.
- **`buildCodeGraph`s kumulatives Zeitbudget** — drei Schritte × 120 s (`GRAPH_BUILD_TIMEOUT_MS`),
  beide Seiten in `Promise.all`, also bis zu ~360 s Wandzeit an einem Konflikt-Merge. Ob ein
  äußeres Budget das deckelt: nicht verfolgt. Unkostierte Beobachtung.
- **`e2e/context-packs.ts:121`** (`missingCapabilities.get("codex")!`) wirft bei fehlendem Harness
  statt zu scheitern — nicht verfolgt, ob der Runner das als Modul-Fail oder als Suite-Abbruch
  rendert.
- **Von den Losen nicht gelesen:** in `e2e/dirs-pins.ts` die Pin-Sektion (`:34-45`) nur überflogen;
  in `docs/queue-analyst.md` §3a, §3b, §6 und §7 (die Dispatcher-Betriebsreferenz) nicht geprüft;
  in `docs/rollen-evidenz-2026-08-21.md` nur §1 und §4 von 617 Zeilen; von den Aufrufstellen der
  Los-B-Funktionen nur die in §Ergebnis zitierten.
- **Keine Aussage über `src/helper.ts`s Inhalt** — nur darüber, dass der laufende Gate ihn nicht
  ansieht. Ob dort aktuell ein Typfehler steht, wurde nicht geprüft.
