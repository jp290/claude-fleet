# HANDOFF — Session 34 (2026-08-07 vormittags: vier Lands, zwei Ernten, acht neue Zeilen) · 33/32/31/… darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log e89c1bb..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, Entscheide, was in Flug ist, Korrekturen.*

---

## Session 34: der Vormittag, an dem „idle" dreimal etwas anderes hieß

**Das Erste für die nächste Session:** `./state.sh` · `./register.sh` ·
`briefs/work-waves-2026-08-07.md` — und **die neue erste Regel in `CLAUDE.md`**, weil sie
diese Session dreimal Zeit gekostet hat (s. u.).

**Gelandet, vier Lands + zwei Doc-Commits, alle Gates grün, `waitMs: 0` bei ALLEN vier:**

| SHA | Was | Gate | Audit |
|---|---|---|---|
| `d046ceb` | zwei Messberichte aus Panes geerntet (doc-only, Direkt-Commit) | — | — |
| `0e345c6` | `releasedBy` auf `Task`/`LaneOutcome` | 68 s | GREEN 542 s |
| `438c326` | der Fehlerkanal — `/api/errors`, Ringpuffer nach Signatur | 70 s | GREEN 649 s |
| `22415f5` | Denk-Session „Überblick + Mitarbeiter" geerntet (doc-only) | — | — |
| `6cd79fd` | Token-Umbau, dreizehn Töne bekommen einen Namen | 73 s | GREEN 534 s |
| `86f99f1` | Kollisionsfläche als Git-Fakt, Analyst sieht Dateien | 72 s | GREEN 524 s |

**Deploy gefahren und verifiziert** (srv pid 81145, 09:31): `watchdog.sh` unberührt → normale
Reihenfolge, `bun run build` → `srv` kill → Respawn. Am Prozess-Env geprüft:
`FLEET_VERIFY_WAIT_MS=900000`, `e2e/pins.ts` im Gate. **Der zweite Deploy ist ebenfalls gefahren** (srv pid 3590, 10:31): `bun run build` +
srv-Respawn nach `6cd79fd`+`86f99f1`. Verifiziert am Owner-Poll: `codeBehind:false`,
`bundleStale.stale:false`, `errors:null`, Health 200. **Beim Deployen gilt: erst das Audit
abwarten** — ein srv-Kill tötet den laufenden Audit (das ist die `unknowable`-Todesart vom 06.08.).

---

## Die Regel, die diese Session gekostet hat — steht jetzt in `CLAUDE.md`

**„Idle" heißt nicht „fertig". Vier Zustände sehen identisch aus, nur einer ist landbar.**
Dreimal gestolpert:

1. **Slot 1+4 morgens** — fertig seit ~4 h, aber `FILES: keine` (reine Messzeilen): `ahead=0` ist
   ihr SOLL, ihr Ergebnis war ein Pane-Bericht. Geerntet als `d046ceb`, sonst wäre er mit dem
   Slot gestorben.
2. **Slot 2** — Kriterium bestätigt, aber die Lane hat davon nie erfahren. **Ein
   `criterion-confirm` öffnet nur das Tor, es stupst niemanden an.** Sie saß am leeren Prompt und
   hätte beliebig lange gewartet. Erst ein `POST /send` hat sie gestartet.
3. **Slot 1 (`21c6eb4b`)** — hat einen Brief kompiliert statt gebaut, völlig zu Recht: die Zeile
   war eine Scout-**Idee**. Mein Fehler war, sie mit `▸ start lane` zu starten, weil der Refine
   `unchanged:true` sagte. **`unchanged` heißt „nichts zu schneiden", nicht „das ist ein Auftrag".**

---

## Was in Flug ist

- **Slot 3 `denk/mitarbeiter`** — Denk-Session, fertig, Dokument geerntet (`22415f5`). Der Baum
  lebt noch; er darf abgeräumt werden (`ahead=0`, nichts zu landen).
- **Slot 1 — eine Lane, die NICHT von dieser Session gestartet wurde**: `ba18d3c8`
  (`fleet/260807082852-df5a`, 10:28:53, über den Board-Knopf). **Sie ist der dritte Fall der Regel
  oben und noch nicht bemerkt worden:** die Zeile ist eine Scout-IDEE, und `server.log:1645` sagt
  zusätzlich „analysis: brief compile failed for ba18d3c8 … summarizer timed out". Die Lane hat
  also den ROHEN Ideentext als Gründungsprompt bekommen, ohne kompilierten Brief. Erwartung: sie
  liefert einen Brief statt Code — das ist dann richtig, nicht falsch. Erst lesen, dann urteilen.
- Alle vier Audits dieser Session waren GREEN (542 / 649 / 534 / 524 s), null offene Rote.

## Acht neue Queue-Zeilen, alle mit hartem DONE + Verify-Weg

**Dringend, weil es das Register beschädigt:**
- **`197c7766`** — eine fehlgeschlagene Re-Analyse **löscht** das Urteil, das sie ersetzen
  sollte. `unknown()` (`server.ts:2280-2287`) weist `t.analysis` komplett neu zu und rettet nur
  `attempts`. Um `07:41:11Z` sind so **sechs** offene Zeilen gekippt (4 begründete `needs-you`,
  2 `ready` → `"analyst returned no JSON"`). Batch-Cap 6, ein Batch. Verschärfend: der Sweep
  sortiert **released rows first**. Die sechs brauchen ein `reanalyse`, ihre alten Urteile sind weg.

**Aus der Denk-Session:** `00e5f771` — es gibt **keine Benachrichtigung, in keine Richtung**
(Browser-`Notification` 0 · `document.title` 0 · Audio 0 · Webhook 0). Die Fakten existieren alle
auf dem 2-s-Poll und tragen im Code den Vermerk, dass niemand sie liest. Zwei Empfänger, zwei
Mechanismen — Owner = `1cb6778e` (Tab-Ampel), treibende Session = `autos` (Verrohrung existiert,
nur der Auslöser fehlt).

**UI-Kette, Owner-Entscheid 2026-08-07 „Neuentwurf der ganzen Fläche, NACH `21c6eb4b`":**
`c0a8366b` (Stapel-Anker auf `lastOutput` — heute gewinnt die niedrigste Slot-Nummer, der Stapel
hing unter einer übergebenen Session) → `ed4a318c` (Main behält die Nummer, **Lanes** werden frei;
Teil A Anzeige, Teil B Zuteilung über clarify) → `c8e2ddd7` (Queue-Neuentwurf, **erster Knopf ist
`▸ clarify first`**) · dazu `f5cf00dd` (Worktree benannt starten — der Knopf existiert als
`⎇ New lane here`, kann aber keinen Namen und versteckt sich innerhalb eines Worktrees) und
`5d55bcfc` (Bewegungs-Vokabular, geschärftes Kind von `bb0475b8`).

**Aus den Ernten:** `cf557dc4` (`docs/data-saver.md` §2+§5) · `a5030c42` (der `instr`-Filter, weil
der jq-Block sonst dauerhaft 11 % liefert — knapp unter seiner eigenen Schwelle, rein als Artefakt).

## Korrekturen, die man kennen muss

- **`CLAUDE.md` schickte zum `bundleStale`-Check auf `/api/steward/sessions`** — die Route ist
  steward-only und gibt dem Owner-Token **404**. Beide Deploy-Fakten liegen längst auf
  `/api/sessions`. Gefixt.
- **Der „merge droppt still main-Arbeit"-Satz stimmt so nicht.** Nachgeschlagen
  (`docs/attic/lane-autonomy-future.md:17`): beobachtet wurde, dass eine *Merge-Auflösung* eine
  `const` samt ihrer einzigen Verwendung fallen ließ und das tsc-grün blieb — ein Befund über die
  Tauglichkeit des Gates, kein Argument für Rebase. Der echte Grund für Rebase ist, dass der Land
  **`--ff-only`** ist und der Rebase dessen Vorbedingung. Sein Preis steht in
  `docs/land-mechanics.md` §5 (stale `baseSha` → Ledger erhöht Größen) — und genau den hat
  `86f99f1` gerade weggebaut.
- **`releasedBy` bleibt auf Lanes leer, die vor dem 09:31-Deploy gespawnt wurden** — das Feld wird
  beim Spawn gesetzt. Kein Defekt.
- **Die Denk-Session fand `state.sh:56-58`**: vergleicht gegen `$PWD` und meldet aus einer Lane den
  LIVE-Server als „stray", während `CLAUDE.md` jede Lane anweist, `./state.sh` zu fahren. Steht in
  `briefs/mitarbeiter-2026-08-07.md`, **noch keine Queue-Zeile**.

## Unverändert blockiert auf den Owner

`526ecd5e` (Self-Credential für alle Sessions — fasst eine Credential-Grenze an) · Steward-Cap
10/10 · Pi (`944281c5`) nicht starten (`~/.pi/agent/auth.json` = 2 Bytes) · **in mehreren
Composern steht ungesendeter Owner-Text — dort NICHTS hineinsenden** (`sendText` ist
paste-buffer + Enter ohne Clearing).

---

# HANDOFF — Session 33 (2026-08-07 nachts: sieben Lands, das Wellenprogramm läuft) · 32/31/30/… darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`** (die Arbeitsliste, abgeleitet).
Historie: `git log dc2940e..HEAD` mit Bodies. Diese Datei trägt nur das Residuum:
Absicht, Entscheide, was in Flug ist, und die Reihenfolge der nächsten Schritte.*

---

## Session 33: das Wellenprogramm, sieben Lands, ein adjudiziertes Rot

**Das Erste für die nächste Session — in dieser Reihenfolge:** `./state.sh` · `./register.sh` ·
**`briefs/work-waves-2026-08-07.md`**. Das dritte ist neu und ist ab jetzt DAS operative Dokument
für die Reihenfolge: sieben Wellen entlang der harten Grenzen der Maschine, mit Stand je Zeile.
`docs/work-register-2026-08-06.md` bleibt Schnappschuss, `register.sh` bleibt die Ableitung.

**Gelandet, sieben Commits, alle Gates grün, `waitMs: 0` bei allen sechs gemessenen:**

| SHA | Was |
|---|---|
| `7941c3f` | der Wellenplan selbst (Slot 2s Wert-Review, aus einer `.jsonl` gerettet) |
| `3b22aa8` | vier belegte Doc-Falschaussagen · Gate 108 s |
| `eacd52a` | `briefs/session-capabilities-2026-08-07.md`, 326 Z. |
| `d122e29` | Scheduler-Ticks konfigurierbar · Gate 68 s |
| `a00e127` | roher Start kostet eine zweite Geste (`rawAcknowledged`) · 70 s |
| `08dc17a` | Land-Gate zahlt nicht mehr für die Schlange · 69 s |

Der Takt hat sich dabei selbst halbiert: 108 s → 69 s, weil `d122e29` im Baum liegt. Das war der
Zweck von Welle 1 und ist jetzt gemessen, nicht versprochen.

**Deploy ist GEFAHREN und verifiziert.** `srv` pid 51878. Reihenfolge war die für `watchdog.sh`
vorgeschriebene: `launchctl kickstart` ZUERST (Watchdog 91123 → 23453, `srv` dabei unangetastet,
Audit überlebte), dann `srv`-Respawn. Beweis, dass es wirkte: `FLEET_VERIFY_WAIT_MS=900000` steht
im Env des laufenden Prozesses. `bun run build` zweimal gefahren (`a00e127`, `08dc17a`).

**Das eine Rot — adjudiziert, nicht weggeschaut.** Post-Land-Audit zu `08dc17a`: 4 FAILURES,
`at=1786070439613`, adjudiziert als **`flake`**. Voller Beleg als Kommentar auf Zeile `6b9f77d0`.
Kurz: alle vier sind EINE Kaskade aus einem Setup-Check (die Test-Lane produzierte keine
Pane-Ausgabe → `lastOutput:0` → `observed:false` → das `stalled`-Prädikat kann nie greifen);
derselbe Baum erneut gefahren gab ALL PASS mit `observed:true`; dieselben vier Checks waren am
06.08. um 08:03Z und 08:16Z rot, **13 h bevor dieser Branch existierte**; und der Diff enthält
NULL Zeilen mit `observed|lastOutput|stalled|doneLooking|idleMs`.

**In Flug bei Übergabe:**
- **Slot 2** — clarify-Lane `fleet/…5408-c8f3` für `05ba5609` **+** `db02104d` als EINE Klärung,
  unter Owner-Weg (a). Sie schlägt ein Kriterium vor und STOPPT; `awaiting:"owner"`.
- **Slot 1 + 4** — die zwei read-only-Messungen (`32fc334a`, `caaf8b16`). Stehen seit ~2,5 h still,
  ohne Commits, mit unabgeschicktem Text im Composer. Wenn das nicht der Owner war, hängen sie.
- **Slot 12 ⚙ steward** — frisch besetzt, Worktree neu von `main`, stündlicher `/rundgang` als auto.

**Vier Owner-Entscheide sind in dieser Session gefallen und ausgeführt:** Share `d8eb7ba4`
widerrufen · 13 Zeilen archiviert (77 → 64 offen; drei trugen Inhalt, der vorher auf lebende
Zeilen weitergetragen wurde) · F2 Schwellen-Klasse wird in Bau + Auswertung getrennt · F1 Weg (a),
der Analyst bekommt Dateien.

**Korrekturen, die man kennen muss:**
- **`kind: lane→note` hat keine Route.** `t.kind` wird an genau zwei Stellen gesetzt (`adopt`
  note→lane und der Steward-Create). Deshalb war „die 3 Formfehler auf note ziehen" nur für
  `0be58694` ausführbar; `10ac2528` und `63626cdb` stehen weiter als startbare `lane`-Zeilen da,
  die sich selbst als „kein Arbeitsauftrag" deklarieren. Zeile `65af341f`.
- **`files` fällt beim Refine-Confirm auf den Boden** — live gemessen: Vorschlag zu `cccd76b2` trug
  acht Dateien, das Kind `028bdcc1` hat `files:None`. Macht `9e0fdc3b` zur Vorbedingung.
- **Es gibt ZWEI Trails**: `e2e-trail/` im Haupt-Checkout (863 Läufe) und `$TMPDIR/fleet-e2e-trail/`
  (35, dorthin schreiben die Audits). Wer nur einen liest, sieht die halbe Basisrate — beim Rot oben
  hätte der Audit-Trail allein `1/21` gesagt und die entscheidenden 06.08.-Instanzen nicht enthalten.
  Das ändert den Zuschnitt von `6b9f77d0`.
- **Die Historien-Warnung in CLAUDE.md gilt für den `steward`-Branch nicht mehr**: `main..steward`
  = 0 Commits, der Merge war ein Fast-Forward, nicht „421 fremde Commits". Für die übrigen ~70
  lokalen Branches ist sie ungeprüft und bleibt stehen.
- **Der Steward-Worktree existierte gar nicht** — dort lagen zwei leere Verzeichnisse.
- **Kontext-Sensor**: eine Session kann ihren eigenen Stand aus dem Transcript rechnen
  (`message.usage`, Summe aus `input_tokens + cache_creation + cache_read`). Er hinkt einen Zug
  hinterher und liest damit ZU NIEDRIG — bei einem Schwellwert die gefährliche Richtung. Deshalb
  beide Quellen lesen und den höheren nehmen. Details: `briefs/session-capabilities-2026-08-07.md`.

**Offene Owner-Entscheide, die die Reihenfolge blockieren:**
1. **`526ecd5e` freigeben?** Self-Credential für ALLE Sessions — Owner-Vorgabe „maximale
   Möglichkeiten". Der Befund macht sie klein: `s.selfToken` existiert bereits für jeden Slot, der
   Server erkennt es an (**409, nicht 401**), es wird nur nie in die Pane exportiert. Das Tor ist ein
   Ternary in `server.ts:1506`. Nicht ohne den Owner gestartet, weil es eine Credential-Grenze
   anfasst. Teil 3 ihres DONE ist bewusst ein *Verweigerungs*-Test: `/api/self/gate` und
   `/api/self/drift` müssen einer Nicht-Lane weiter 409 geben.
2. **Steward filing-blockiert**: Pending-Cap 10/10, vier Plätze halten die Juli-Notizen, die bewusst
   liegen bleiben sollen. Entweder über die vier urteilen oder `FLEET_STEWARD_MAX_PENDING` hoch
   (Env → srv-Restart).
3. **Pi (`944281c5`) NICHT starten** — der Steward hat den Test gefahren, den die Zeile selbst
   nennt: `~/.pi/agent/auth.json` ist 2 Bytes, unveränderter Vor-Login-Zustand. Eine Lane liefe bis
   zur Anmeldung und verbrennt dabei Kontingent.
4. F3 Verb 2 Deploy · F5 F6-Upload-Ablage (Entwurf und Brief widersprechen sich) · F6 F7 noch
   gewollt? · F8–F12 unverändert aus `briefs/work-waves-2026-08-07.md` §3.

**Reihenfolge der nächsten Schritte:** Slot 2s Klärung lesen und bestätigen → dann `1e0c9434`
(releasedBy, klein) → dann Welle 3 (`3975427d` nach refine · `bbf2eea1`+`7d380d5e` als EINE Lane).
`526ecd5e` und `65af341f` kollidieren beide mit der `2bd333ac`-Fläche, also strikt seriell danach.
Deckel unverändert: max 2 `server.ts`-Lanes, Lands seriell, **vor jedem Land den Mutex prüfen**
(`/tmp/fleet-e2e.lock`, die pid-Datei entscheidet) — das ist der Grund, warum alle sieben Gates
`waitMs: 0` hatten.

---

## Session 32: Register gebaut, alle Doc-Ideen dingfest, vier Ideen-Scouts

**Das Erste für die nächste Session:** `./state.sh` · `./register.sh` (NICHT mehr das
work-register-Doc als Liste lesen — es ist Schnappschuss, das Skript ist die Ableitung).
Die Queue ist DAS Register: ~80 offene Zeilen, alle `pending`, nichts startet von selbst.

**Gelandet (4 Lands + 2 Direkt-Commits, alle Audits grün bzw. in Flug):**
`e6203a1` register.sh + L1-Rot-Detektor (e2e/pins.ts §5, rot-ok-Fluchttür) ·
`c366c66` BACKLOG.md → docs/attic/backlog-2026-07.md (39 Posten: 26 gelandet / 11 offen /
2 überholt; 14 neue Zeilen) · `d139698` 0/12→1/15-Korrektur (4 Doc-Stellen) ·
`f378d4c` e2e/pins.ts in die Gate-tsc-Liste — **ERLEDIGT 00:52**: kickstart + srv-Respawn
gefahren, neue VERIFY_CMD am laufenden Prozess verifiziert, Sessions überlebt, beide
Post-Land-Audits grün (e6203a1 in 564 s, c366c66 in 699 s).

**In Flug bei Übergabe:** Slot 2 (`task-review`, Haupt-Checkout) fährt den Wert-Review
aller ~80 offenen Zeilen („tatsächlich hilfreich?" je Zeile: BEHALTEN+Welle / ARCHIV-KANDIDAT /
BRAUCHT-OWNER / MERGEN; Quellen-übergreifender Dedupe; sequenzierte Drück-Liste als Output)
plus als Zusatzauftrag die Frage, wie ein besetzter Steward bei der Registerpflege mitwirken
könnte (Vorschlag, kein Bau). Der Owner drückt danach; nichts startet von selbst.

**Woher die neuen Zeilen kommen (Provenienz steht in jedem Zeilentext):**
- 21 aus der Doc-Aggregation (`891dfc49`, Lane `…4956-3b38`): alle offenen Punkte aus
  autonomy-map/verbs/bausteine + agent-visibility + Briefs, G1–G7-gerastert.
- 14 aus dem BACKLOG-Abgleich (Lane `…1017-324f`): 7 Lane-Zeilen mit Done-Kriterium,
  5 Steward-Notes, 2 Owner-Zeilen.
- 28 aus vier Ideen-Scouts (Präfix `[idee scout-A/B/C/D 08-07]`; A=Owner-UX, B=Betrieb
  mit ECHTEN Messungen — 197k Trail-Zeilen, 26 verlorene Gespräche Slot 1, 166s Fest-sleep —,
  C=Polish, D=kühn; 2 Quer-Merges: Tab-Ampel A+C, Tastatur/⌘K A+D). Die Scout-Vollreports
  lagen nur im Session-Scratchpad (ephemär) — die Zeilen SIND die dauerhafte Fassung.

**Korrekturen, die man kennen muss:** die 0/12-Basisrate ist 1/15 (ein echtes `real`,
`07e5969`) · „nach `queued` nur durch Owner-Promote" ist FALSCH (zwei Maschinen-Pfade:
requeue + Boot-Abgleich; CLAUDE.md Punkt (d) trägt die Korrektur) · das Rundgang-Ritual
liegt getrackt unter `.claude/commands/rundgang.md` und ERLAUBT `kind:"lane"` schon
(Zeile 36) — was fehlt, ist die Form (Done-Kriterium im Filing) · Scout B fand still
gestorbene Brief-Kompilate (JSON-Parse-Fehler, server.log) — `1e0c9434` ist reanalysiert.

**Offene Owner-Entscheidungen (blockieren die optimale Reihenfolge):**
1. Verb 2 (Deploy) bauen — ja/nein? (`989cccf7`)
2. Lane-Deckel anheben — erst nach G2 (`05ba5609`+`db02104d` als EINE Lane) ist der sichere Weg.
3. Pi-Login (`944281c5`).
4. Die 28 Scout-Ideen sichten — minten war absichtlich großzügig; archivieren ist dein Veto.
5. `info-card-controls`: ist dein Wunsch von 08-03 mit F4 erfüllt? (Aggregation: „Owner-Frage")
6. Slot 6 ist aktiv geteilt mit cwd=Haupt-Checkout (`56be77a3` führt die Messung).

**Vorschlag erste Welle (unverändert gültig):** Lane A = G2 (`otherOpenLanes`, beide
Fehlerrichtungen in EINER Lane) · Lane B = `1e0c9434` releasedBy (klein, schaltet G6 frei) ·
danach `cccd76b2` (Verify-Budget ohne Lock-Warten — behebt die 469s/499s-Klasse) und
`62302c47` (Schlaf-Uhr — verkürzt den 12-min-Takt selbst). Max. 2 server.ts-Lanes,
Lands seriell, Takt ~12 min.

---

## Session 31: Runde 2+3 gelandet — und der Versuch, ALLE Fäden einmal sauber zu sortieren

**Das Erste für die nächste Session — drei Dateien, in dieser Reihenfolge:**

1. `./state.sh` (Zustand ist ein Kommando, keine Erinnerung).
2. **`docs/work-register-2026-08-06.md`** — alle Dokumente einmal durchgesehen: vier Klassen
   statt einer, das offene Register in sieben Gruppen (§3), der Beleg, dass `BACKLOG.md` ein
   Juli-Register ist (§4), und in §6 ausdrücklich, was NICHT geprüft wurde.
3. **`briefs/work-register.md`** — die FORM des Registers, das das ersetzen soll: keine dritte
   Liste, drei Wahrheitswerte, `Task.files` als fehlender Join, Fluchttür für den Rot-Detektor.

**Zwei neue Queue-Zeilen tragen genau das:** `1a08e5db` (`register.sh` + L1-Rot-Detektor,
Stufen 1–3 ohne `server.ts`-Eingriff) und `8997bff1` (BACKLOG abgleichen → Queue-Zeilen →
Attic; **nach** `1a08e5db`, dessen Ausgabe ist der Abgleichspartner).

Die Gruppierung unten ist nach einer Achse gebaut, nicht nach Themen: siehe „Wie sortiert wurde".

**Deploy-Stand bei Übergabe:** `bootHead` = `ed5c352`, HEAD = `5fd1018` — die drei Commits
darüber sind **doc-only** (`codeBehind:false`, `bundleStale:false`), also ist **nichts zu
deployen**. Slot 5 landet seine eigene Zeile (`1981be9a`) selbst; sein Ergebnis gehört gelesen,
bevor G6 geplant wird.

### Gelandet und deployed (6 Commits, alle Audits grün außer einem fremdgetöteten)

| | |
|---|---|
| `72da914` | T3-Doc: `Stop`-Hooks als Nullpunkt der idle-Uhr — **gerechnet und verworfen** (die Lane hat ihren eigenen Vorschlag adversarial gekippt; 92/104 Lanes ≤1 Owner-Prompt, Median-Session 67,8 min → die Klausel hätte die gesunde Median-Lane als `stalled` markiert) |
| `46e0bc3` | Mini-Fixes: Branch-Truncation suffix-erhaltend, Untracked-Tooltip-Ternary |
| `04646d3` | `docs/agent-visibility-2026-08-06.md` (455 Z.) — was jede Rolle sieht, gemessen |
| `d49c6e8` | **Der Dispatcher liest `collides`** — der Deckel spielt nicht mehr Kollisionsvermeidung |
| `1074b86` | F2+F3: Pastellfarbe pro Projekt, Lanes falten sich unter die Main-Session |
| `ed5c352` | F5: Dateibaum im Board + Editor mit realpath-Containment, Hash-Konflikt, Deny-Liste |

Vier davon `verified:true, confirmedByHuman:false` (vollmaschinell). `72da914` trägt
`verify:null` + Hand-Kette (5× ALL PASS) + Confirm — die Verify lief in den Timeout, **469 s
davon Warten auf den Suite-Mutex, 31 s echte Arbeit.**

### Wie sortiert wurde — die Achse, nicht das Thema

Wer parallelisieren will, gruppiert nach **Kollisionsfläche** (welche Datei schneidet ein
Strang) und quer dazu nach **Entscheidungs-Eigentum** (mechanisch vs. Owner). Ein
Themen-Cluster, dessen zwei Stränge dieselbe Funktion anfassen, ist keine Gruppe, sondern eine
Warteschlange — heute live vorgeführt: `05ba5609` und `db02104d` sind zwei Befunde in
**derselben Funktion** (`otherOpenLanes`), in entgegengesetzte Richtungen.

### Die Decke, heute gemessen — jeder Orchestrierungsplan muss sie tragen

- **Ein Suite-Mutex für die ganze Maschine.** Ein Land = ~110 s Gate + ~600 s Post-Land-Audit,
  beide auf demselben Lock. **Lands sind zwangsläufig seriell**, Takt ~12 min. Parallelität
  gilt fürs Produzieren, nie fürs Landen.
- **Drei Suiten sind heute fremdgetötet worden**, alle durch Muster-Kills: Slot 1s
  `-f "bun server.ts"` traf Live-Server + die Sandbox von Slot 7; sein späterer
  `pkill -f 'e2e-isolated.sh'` traf den Post-Land-Audit (exit 143, 15,6 s, **null Checks** —
  stand als ROT im Register, adjudiziert `unknowable`). Regel steht jetzt in CLAUDE.md:
  eigenen Lauf nur über die notierte PID beenden.
- **Tier-2-Vorschau in der Lane ist verzichtbar** (Vorschau, kein Gate) — der Post-Land-Audit
  fährt dieselbe Suite ohnehin. Das halbiert die Mutex-Last pro Lane.

### Die sieben Gruppen

**G1 — Land-/Merge-Maschinerie.** `25b79c23` (Repair-Worker darf nicht committen: `git commit`
kommt in `MERGE_TOOLS` 0× vor, `merge-prompt.ts:187` verlangt es wörtlich; **latent**, nie
ausgelöst — `repairRounds` = 0 in allen 104 Ledger-Zeilen). Fläche: `server.ts` Tool-Profile +
`merge-prompt.ts` + `e2e/prompts.ts`. Blocker: keiner. `ready`.

**G2 — Die Queue-Wahrheit.** `05ba5609` (rebaste Lane meldet 37 Dateien statt 1) +
`db02104d` (leere Lane hält eine Zeile: Fehlalarm der neuen Kollisionsprüfung, live gemessen).
**EINE Lane, nicht zwei** — beide Fehlerrichtungen sitzen in `otherOpenLanes`. Dazu passend:
`cabf3c88` (eine startende Zeile sieht man ihr nicht an) und Map-**5.3** (`files` als Feld am
Refine-Kind). Fläche: `server.ts` (`otherOpenLanes`/`tickDispatch`/Analyse), `e2e/tasks.ts`,
`src/client.ts` (Row-Note). Blocker: keiner. **Höchste Hebelwirkung**, weil der Deckel gerade
durch diese Prüfung ERSETZT wurde.

**G3 — Sensoren + die fünf ungelesenen Notizen.** Map-**6.2** (`sinceLastLook` nach Repo
schlüsseln), **6.3** (`transcriptFact.mtime` warnt nicht vor sich selbst), **9.2** (requeueter
Dispatch lässt seine Lane stehen — ein Leck), **E** (Digest-TTL; `DIGEST_TTL` existiert im
Code, ob es der Map-Punkt ist: **ungeprüft**). Notizen `05320523`, `94565a55`, `b759e8d9`,
`9821035e` füttern genau das. Plus der ungespawnte Brief `briefs/stalled-parked-and-ledger.md`
(Parkungs-Markierung, dann Instanz-Ledger). Fläche: `server.ts` Steward-Views + `lane-signals.ts`.

**G4 — Board-Rest.** `2784427e` (F6 Uploads, Owner-Entscheid „lane-lokal" steht wörtlich im
Brief, Analyst hält nur wegen brief-drift), F7 (Drag&Drop im Explorer, im UI-Brief §F7, **keine
Queue-Zeile**), `356333db` (Zeit der letzten Ausgabe sichtbar). Fläche: `src/client.ts` +
`public/index.html` (+ eine Upload-Route für F6). **Diese Gruppe kollidiert mit sich selbst** —
immer nur EIN Board-Strang gleichzeitig.

**G5 — Harness-Öffnung + Pi.** `0d39cc94` (drei harness-blinde Stellen: `claudeAlive`,
`MODEL_RE`, unauflösbares Modell → tote Pane) und `944281c5` (Pi anschließen, **braucht deinen
Login**). Fläche: `server.ts` Spawn-Pfad. `0d39cc94` ist `ready` und ohne dich baubar.

**G6 — Autonomie: Verben 2–5 + der Rückkanal.** Verb 2 Deploy (`api/deploy` kommt in
`server.ts` **0×** vor — ungebaut, verifiziert), Verb 3 Auto-Promote, Verb 4 Steward auf neuen
Schienen (Steward ist unbesetzt), Verb 5 Auto-Land; Map-**G** (Inbox) steht bewusst zuletzt.
Dazu `1981be9a` — **in Flug in Slot 5**, Commit `0de526c` (doc-only) **unlandet**. Und
`0be58694` (Entscheidungsnotiz, kein Auftrag).

**G7 — Plan-Hygiene, und sie ist überfällig.** `BACKLOG.md` (1269 Z., zuletzt 2026-08-05)
beschreibt Arbeit unter anderen Namen als der UI-Brief und die Landkarte: **Item 13
(„Right sideboard: project file tree") ist F5 und heute gelandet**, **Item 12 („File /
screenshot drop") ist F6 ist `2784427e`** — drei Namen für eine Sache. P-4 sagt „Client
rendering still open", `deployGap` steht 5× in `src/client.ts`. Zwei Zeilen tragen noch
„SHIPPED, NOT yet deployed". Wer die nächste Runde aus dem BACKLOG plant, plant gegen einen
veralteten Baum.

### Was NICHT nebeneinander laufen darf

1. Zwei Stränge aus **G4** (alle schneiden `src/client.ts` an derselben Stelle).
2. **G2 in sich** — die beiden Befunde sind dieselbe Funktion; getrennt gebaut heben sie sich auf.
3. Mehr als **zwei** `server.ts`-Lanes gleichzeitig (G1, G2, G3, G5, G6 fassen alle `server.ts` an).
4. Zwei Lands. Nie. Und keine Lane-Tier-2-Vorschau neben einem Land.

### Drei Owner-Entscheidungen, die den Rest freischalten

1. **Verb 2 (Deploy) bauen — ja/nein?** Ohne ihn bleibt jede gelandete Arbeit dunkel, bis ein
   Mensch `bun run build` + srv-Neustart fährt. Heute waren das drei Handgriffe von mir.
2. **Lane-Deckel anheben — jetzt oder erst nach G2?** Der Deckel wurde durch eine Prüfung
   ersetzt, die am selben Abend einen Fehlalarm produziert hat. Erst G2, dann anheben, ist die
   sichere Reihenfolge; „jetzt" geht, kostet aber Hand-Knopf-Betrieb.
3. **Pi (`944281c5`) — wann machst du den Login?** Ohne dich bewegt sich dort nichts;
   `0d39cc94` (die harness-blinden Stellen) läuft davon unabhängig.

### Vorschlag für die erste Welle der nächsten Session

Zwei produzierende Lanes, ein serieller Land-Takt:

- **Lane A = G2** (die eine `otherOpenLanes`-Lane, beide Richtungen + Check). Höchster Hebel,
  weil sie die Instanz repariert, die jetzt allein Kollisionen zurückhält.
- **Lane B = G1** (Repair-Worker-Profil + der Check, der Prompt und Profil verkoppelt).
  Andere Region in `server.ts`, kleiner Diff.
- **Lane C = `1a08e5db`** (`register.sh` Stufen 1–3 + Rot-Detektor Prüfung 1) — sie fasst
  `server.ts` NICHT an und kollidiert deshalb mit A und B nicht. Wenn nur zwei Lanes laufen
  sollen: diese hier vor B, denn sie ist die Voraussetzung dafür, dass die übernächste Session
  nicht wieder von Hand sortiert.
- **Slot 5** (`1981be9a`, Autonomie-Bausteine) landet der Owner selbst — nicht anfassen; sein
  Ergebnis gehört gelesen, BEVOR G6 geplant wird, denn genau dort liegen die Prämissen.
- **Welle 2:** G6/Verb 2 (Deploy) gegen G4/F6 — verschiedene Flächen, sauber parallel.
- **Welle 3:** G3 als **ein** Bündel (die vier Sensor-Punkte + die vier Notizen gehören
  zusammen, einzeln erzeugen sie vier Rebase-Runden auf denselben Views).

### Was ich NICHT geprüft habe

Ob Map-**E** wirklich offen ist (`DIGEST_TTL` existiert, den Punkt selbst habe ich nicht
gelesen) · den Inhalt der fünf Rundgang-Notizen (nur ihre Titel) · ob F7 heute noch gewollt ist
(steht nur im Brief, keine Queue-Zeile) · den vollen `BACKLOG.md`-Text (1269 Zeilen; ich habe
die Registerzeilen und drei Stichproben geprüft, die Drift ist damit belegt, ihr Umfang nicht) ·
und die Frage, ob der Fehlalarm aus `db02104d` wirklich in `otherOpenLanes` entsteht — die
Eingrenzung steht, der Mechanismus ist Teil der Arbeit.

---

## Session 30 (2026-08-06 abends): der Owner kann zurückschreiben, die Zeilen sagen was sie sind, und die Suite ist zum ersten Mal vermessen

**Das Erste für die NÄCHSTE frische Session: Runde 2 des UI-Programms.** F2+F3 (`cb607025`)
und Mini (`547c7c36`) zusammen freigeben — sie kollidieren nicht miteinander, beide `ready`.
Danach F5 (`9534b49a`), aber **nicht neben Mini** (Kollision) und erst nach F4s Land. F6
(`2784427e`) bleibt stehen, bis der Owner die Ablage entschieden hat (siehe „Offen").
**Einzeln freigeben, nie als Stapel** — Begründung unten unter „Der Deckel".

### Gelandet und live (alle vier deployed, `bootHead == HEAD`, `bundleStale:false`)

| | |
|---|---|
| `035c1a9` | Phantom-Park: `landLane` räumt jetzt auch `mergeLast`, sonst schrieb `killSlot` den Eintrag Millisekunden später zurück. Lane-Fund, unabhängig nachgeprüft, Gate grün in 101 s. |
| `debf0b6` | **Kommentare auf Task-Zeilen** — der erste Rückkanal vom Owner IN die Queue. Plus „Backlog — about to start". |
| `bdcc63a` | Die Zeile heißt, was sie ist: Schnitt am Satzende statt bei Zeichen 120, Ablage-Stempel `[rundgang …]` raus aus dem Namen. |
| `334d33d` | Der PI.agent-Adapter-Brief (F1-Spike, 251 Zeilen, `server.ts` unberührt). |

### Owner-Entscheide dieser Session

- **Kommentar-Kontrakt:** ein Kommentar wird **nie** in den Brief gefaltet, den eine Lane
  bekommt. Ein Check pinnt es. Folge, die man kennen muss: **der Analyst sieht Kommentare
  nicht** — was für die Maschine zählen soll, muss in den Brief (`POST /api/tasks/:id/brief`).
- **Pi bleibt interessant — die Abrechnungs-Absage war MEIN Fehler und ist zurückgenommen.**
  Zwischenstand war „Fremd-Harness läuft pro Token über extra usage, also unattraktiv"; Quelle
  war Pis eigene `docs/providers.md`, und die ist **veraltet** — sie beschreibt eine Änderung,
  die Anthropic angekündigt und dann ausgesetzt hat. Primärquelle (support.claude.com,
  Artikel 15036540, geholt 2026-08-06): *„We're pausing the changes … For now, nothing has
  changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your
  subscription's usage limits."* Also **Abo-Kontingent, nicht extra usage** — und zwar für den
  direkten Weg wie für die Bridge. **Lehre, die teurer war als sie aussieht:** eine
  Drittanbieter-Doku ist kein Beleg über die Abrechnung eines anderen Unternehmens; der Owner
  hat meiner Fehlaussage zugestimmt, und wir haben eine Richtungsentscheidung darauf gebaut.
- **`elidickinson/pi-claude-bridge`** (254 ★, vom Owner eingebracht) ist **kein Umgehungstrick**:
  eine Pi-Extension, die Claude Code über das offizielle Agent SDK als Inference-Provider
  einbindet. Konsequenz für Fleet, die man vor dem Bauen kennen muss: ein Pi-Slot spawnt dann
  `pi`, das darunter Claude Code startet — der Prozessbaum trägt BEIDE, und was der
  Adapter-Brief zu `comm=pi` gemessen hat, gilt für den Bridge-Fall **nicht** ungeprüft.
- Die lohnende Arbeit ist unabhängig davon **nicht Pi-spezifisch** — drei Stellen im Server sind
  harness-blind (`claudeAlive` server.ts:1698 winkt jede Nicht-claude-BASE_CMD durch ·
  `MODEL_RE` server.ts:101 kennt nur claude-Namen · ein unauflösbares Modell hinterlässt eine
  lebende Pane ohne Agenten). Das trifft jede zweite Harness, nicht nur diese.
- **Der Lane-Deckel bleibt bei 2.** Gemessen, nicht gefühlt — siehe unten.
- **Zwei neue Queue-Zeilen beauftragt:** `fcd30f9e` (Dispatcher liest `collides`) und
  `1981be9a` (Autonomie-Bausteine, read-only Untersuchung mit „bereits entschieden"-Riegel).

### Der Deckel: warum er bleibt, und was ihn freischaltet

Gemessen am Register: **Median 8 Lands/Tag** (Spitze 14) · ein Land hält die Maschine
~101 s Gate + **442 s** Tier-2-Audit ≈ 9 min exklusiv · Spitzentag 11 Audits = 81 min von
24 h · **122 Lane-Paare mit überlappender Lebenszeit** bei 92 messbaren Lanes · Konflikte
5/102. **Kapazität ist also NICHT der Grund.** Was der Deckel wirklich ersetzt:

1. **Der Dispatcher ist kollisionsblind.** `tickDispatch` (server.ts:2317) wählt wörtlich die
   erste `queued`-Zeile; `analysis.collides` wird berechnet und nie gelesen. Live vorgeführt:
   die sechs UI-Tasks tragen das Dreieck F4 ↔ F2+F3 ↔ F6; eine Stapel-Freigabe hätte genau
   das Paar gestartet. Der Deckel tut diese Arbeit **versehentlich**, weil 2 klein ist.
2. **Der Gate läuft im Land-Request, nicht in einer Queue** („⑦ v2"). Das 300-s-Timeout ist
   eine Wanduhr, die Wartezeit mitzählt.

**Freischalter = `fcd30f9e`.** Danach hält die Maschine zurück statt eines Menschen.

### Der Vorfall, der Punkt 2 innerhalb einer Stunde bewiesen hat

F1s Land lief in den Verify-Timeout: **334 s gesamt, davon 303 s Warten auf
`/tmp/fleet-e2e.lock`, 31 s echte Verifikation, NULL FAIL-Zeilen.** Der Server verhielt sich
richtig (`verify.ok: null`, `timedOut: true`, „killed mid-run — this is not a verdict") und
hielt die Lane zur Ansicht fest, statt ungeprüft zu landen. Die volle Kette wurde dann VON
HAND auf demselben rebasten Baum gefahren (install/pins/tsc 0, drei Suiten ALL PASS, 0 FAIL),
erst danach confirm-land.

**Und daraus der Befund, der in keinem Ledger stand:** die Akte zu `334d33d` sagt
`verify.ok: null`, `verified: null`, `confirmedByHuman: true`. Ein Leser kann **„Mensch hat
blind bestätigt" nicht von „Mensch hat die volle Kette gefahren und dann bestätigt"
unterscheiden.** Für eine autonome Kette ist genau das die tragende Unterscheidung. Liegt als
Kommentar auf `1981be9a`, ausdrücklich als Eingangsmaterial, nicht als Antwort.

### Die Suiten-Messung — zum ersten Mal aus dem Check-Trail gerechnet

Owner-Frage war, ob Audits/Suiten parallel oder schneller laufen können. Antwort: **die Suite
ist nicht CPU-gebunden, sie schläft.** Am Trail eines echten Audit-Laufs (1395 Checks, 537 s):

- 1079 Checks (77 %) kosten zusammen **11,4 s** = 2,1 % · 29 Checks (2 %) kosten **254 s** = 47 %
- **97,9 %** der Zeit liegt in Lücken ≥ 200 ms

Drei Hebel, gemessen, mit Schnittlinie:

1. **Feste Sleeps → Poll: 122 Aufrufe in `e2e/*.ts` = 166,6 s von 537 s (31 %).** Muster:
   `Bun.sleep(9000) // past due + one 5s scheduler tick`. Der Poll-Helfer `till()` existiert
   bereits — **lokal in `e2e/tasks.ts:324`, in keiner anderen Datei benutzt.** Timeout auf den
   alten Sleep-Wert setzen, dann ist der Worst Case identisch und nur der Schlupf weg.
2. **Deploy-Fakten von `tickGit` abkoppeln: 63,6 s in 14 Checks.** `refreshDeployFacts()` fährt
   auf `setInterval(tickGit, 10_000)` mit (server.ts:1196), liest aber **nur das Haupt-Repo**
   (drei git-Kommandos auf `REPO_DIR`, kein Lane-Worktree). Eigenes Intervall + Env-Knopf.
   **`tickGit` selbst NICHT beschleunigen** — das ist der Poller aus `suite-contention.md` §2.
3. **Der Mutex-Poll:** `e2e-stage.sh:100` wartet in `sleep 15`-Schritten (nur gegen einen
   LEBENDEN Halter; ein totes Lock wird sofort gereapt). Verkürzt keine einzelne Suite, aber
   jede Warteschlange — und der Gate nimmt das Lock 3× pro Lauf.

— Schnittlinie. **Echte Parallelität lohnt nicht:** zwischen Suiten verkürzt sie einen
einzelnen Lauf um null Sekunden, und die Messung von 2026-07-26, die sie verbietet, stammt von
**vor** den Race-Fixes vom 28.07. — sie ist also nicht mehr widerlegt, sondern ungeprüft. Der
ehrliche Weg dahin ist eine Messung NACH Hebel 1+2, nicht eine Meinung. Innerhalb eines Laufs
teilen die Module einen Server, einen Socket und ein Repo und mutieren globalen Zustand.
Obergrenze von 1+2 zusammen: ~215 s der 537 s — eine Decke, keine Zusage.

### Korrekturen an eigenen Aussagen

1. **Ich habe Pis Abrechnungs-Satz als Tatsache verkauft.** Er stammt aus
   `docs/providers.md` von `@earendil-works/pi-coding-agent` — ein Drittanbieter über die
   Abrechnung eines anderen Unternehmens. Korrekt zitiert, falsch gerahmt. (Der Owner hat ihn
   dann selbst bestätigt gefunden — das ändert nichts daran, dass die Rahmung falsch war.)
2. **Ich habe dem Owner ein erfundenes Wort hingelegt** („Satz-Schnitt") statt der Sache. Der
   Fix war, das Vorher/Nachher an seinen echten Daten zu zeigen. Merke: eine UI-Änderung
   erklärt man am gerenderten Ergebnis, nicht am Mechanismus.
3. **Der Handoff von Session 29 führte F6 als `ready`** — die Zeile sagt `needs-you`.

### In Flug / offen

- **F4 ist GELANDET (`3e41cc3`) und deployed** — Gate `verify.ok:true`, exit 0, 110 s, 0 s
  Lock-Warten, 0 FAIL, `confirmedByHuman:false` (also vollmaschinell verifiziert, anders als
  F1). `bootHead == HEAD`, `bundleStale:false`, 8 Sessions haben den Neustart überlebt.
  Sie hat zwei Dinge über den Auftrag hinaus geliefert: **`repoCommits` wird aus dem
  GAST-Payload entfernt** (ein Gast ist in EINE Session geteilt, nicht in mains letzte zehn
  Commit-Betreffs — beim Schreiben der Route aufgefallen, nicht beim Rendern), und ihr eigener
  `pkill -f "bun server.ts"` hat den **LIVE-Server** getroffen (Watchdog respawnte in ~1 s, alle
  8 Sessions überlebten). Die Regel dagegen steht jetzt in CLAUDE.md — von Hand, weil eine Lane
  diese Datei nicht landen kann.
- **RUNDE 2 IST DER NÄCHSTE SCHRITT:** F2+F3 (`cb607025`) + Mini (`547c7c36`) zusammen, danach
  F5 (`9534b49a`) allein (kollidiert mit Mini). F6 (`2784427e`) trägt jetzt den Owner-Entscheid
  „lane-lokal" im Brief und wird gerade neu analysiert.
- **Slot 2 untersucht die Agenten-Sichtbarkeit** (`9e933b31`, Lane `fleet/260806172211-613f`,
  per Hand gestartet). Owner-Frage: *„was Agenten aktuell wie sehen und wie sie bestimmte tools
  benutzen"*, mit Subagenten-Auftrag. Der Brief zerlegt sie in **gewährt / erreichbar /
  gewusst** — ein Fleet, in dem *erreichbar* > *gewährt* ist, hat ein Sicherheitsthema; eines,
  in dem *gewusst* < *gewährt* ist, verschenkt gebaute Fähigkeiten. Leithypothese des Owners,
  ausdrücklich als zu prüfen markiert: eine Session im Haupt-Checkout sieht mehr, weil
  `fleet.json` dort liegt und den Owner-Token trägt — dann wäre die Mehrsicht ein Nebeneffekt
  der Dateilage, kein entworfenes Recht. **Bericht steht aus — die nächste Session sammelt ihn
  ein.**
- **Vier neue Zeilen aus dieser Session**, alle `pending`: `fcd30f9e` (Dispatcher liest
  `collides` — der Freischalter für einen höheren Lane-Deckel) · `1981be9a` (Autonomie-
  Bausteine, read-only) · `0d39cc94` (Fleet harness-fähig — **ohne Login baubar**) ·
  `944281c5` (Pi konkret anschließen — **braucht den Login des Owners**, er hat ihn zugesagt).
- **Slot 5** hält eine Lane des Owners ohne Task — nicht angefasst.
- **Slot 5 hält eine Lane des Owners ohne Task** (`fleet/260806163737-7852`, per `slot_open`,
  nicht per Dispatch). Bei letzter Prüfung ohne Commit und ohne uncommittete Datei.
- **F6 wartet auf eine Owner-Entscheidung**, nicht auf Arbeit: Ablage in
  `~/.claude-fleet/drops/<slot>/` oder lane-lokal? Der Aufräum-Lauf löscht nach Slot-Nummer,
  und dieselben Nummern benutzt der LIVE-Server — ein e2e-Lauf könnte dessen Ablage löschen.
- **`1fb929e9` ist erledigt und kann archiviert werden**: die Prämisse (`FLEET_EVAL_CMD` in
  `e2e/tasks.ts`) ist nachgeprüft falsch — der Name kommt in `server.ts` UND in `e2e/tasks.ts`
  null mal vor, dort steht heute `FLEET_ANALYSIS_CMD` (Zeilen 364, 718).
- Verben 2–5 unverändert ungebaut. 5 pending-Notes, 2 alte needs-you-Zeilen.

---

## Session 29 (2026-08-06 nachmittags): Schritt A + Verb 1 gelandet, das Verb-Programm steht, die Adjudikations-Schuld ist null

**Das Erste für die NÄCHSTE frische Session — zwei Aufträge, beide vom Owner:**

**1. Der Startdienst (Owner wörtlich: „kann die nächste session das auch alles sauber für
mich starten?" — JA, das hier ist die Autorisierung).** Das UI-Programm
(`briefs/ui-next-level-2026-08-06.md`) als sein Operator fahren, mit Owner-Token, attended:

- `./state.sh`; falls die Phantom-Park-Lane (Slot 1, `f93deff8`) gemeldet hat: unabhängig
  verifizieren (Report = Behauptung), landen. Ihr Land geht allem voran.
- **F4 (`3322990f`) releasen** (`POST /api/tasks/:id/queue`) — `ready`, Doc-Reihenfolge Platz 1.
- **Zweites Release erst, wenn Phantom-Park gelandet ist** (Lane-Deckel 2/Repo): dann
  F2+F3 (`cb607025`) oder F6 (`2784427e`) oder Mini (`547c7c36`), alle `ready`.
- **F1 (`0bfd3d7e`): Release ÜBER den reach-Einspruch ist vom Owner autorisiert** (Sanktion
  steht im Task-Text UND hier; der `task_override`-Audit-Event ist gewollt — er macht die
  gesprochene Erlaubnis aktenkundig). Zeitpunkt frei, keine Abhängigkeiten.
- **F5 (`9534b49a`) NIE vor F4s Land** — danach `↻ re-analyse`, auf `ready` warten, releasen.
- Vor jedem Spawn die Maschine fragen — dafür ist Verb 1 da: `gate` auf
  `/api/steward/sessions` bzw. das Owner-Board; bei gehaltenem Lock warten, nicht stapeln.
  Max. zwei UI-Lanes zugleich (Doc-Warnung: alle schneiden `src/client.ts`).
- Gelandete UI-Lanes brauchen `bun run build` (Client!) + srv-Restart — `bundleStale` prüfen.

**2. Verb 2, das Deploy-Verb**, als eigene Bauarbeit zwischen den Releases —
`docs/autonomy-verbs-2026-08-06.md` trägt Bauform, Rückweg-Antwort und Schwelle. (Verb 2
macht übrigens genau den `bun run build`+Restart-Handgriff aus Punkt 1 überflüssig — wer es
früh baut, erntet es noch im selben UI-Programm.)

### Gelandet und LIVE (deployed, bootHead == HEAD, je verifiziert)

| | |
|---|---|
| `2ada187` | **Schritt A**: `self_drift`-Audit-Event auf `/api/self/drift` — nur frische Antworten (Dedupe über den Drift-Cache), Join-Key = Branch. §12-Recompute-Stanza in der Landkarte. Basiswert: landed 78, checked 0. |
| `2a0047d` | `briefs/phantom-park.md` — §9.1-Auftrag samt der Falle (parkMergeVerdict aus killSlot streichen = Datenverlust) |
| `9849f92` + `9c4b757` | `docs/autonomy-verbs-2026-08-06.md` — die fünf Verben mit Einschalt-Bedingungen; Verb 5 nach Owner-Einwand korrigiert |
| `103d133` | **Verb 1**: `gate: gateView()` auf `/api/steward/sessions`, `suiteLock` auf `/api/self/gate` — der Sensor existierte (9c1b73c), nur die zwei Konsumenten waren blind. Checks gegen Platten-Wahrheit. |

Parallel gelandet (eigene Lane, 417c): `briefs/ui-next-level-2026-08-06.md` — **ein** Doc,
446 Zeilen, fünf Commits (Owner sagte „4 docs", die Messung sagt 1/5).

### Owner-Entscheide dieser Session

- **Die fünf Verben sind die Richtung** („run his findings autonomously … we basically got it").
  Schnittlinie im Doc: Inbox, clarify-Umbau, Auto-Rollback, stalled-Handeln bleiben draußen.
- **Auto-Land: JA als Richtung, Form = Kollisions-Reviewer** — der Owner hat meinen K2-Einwand
  gekippt („an opus5 session with context would understand this"), und er hatte recht: der
  K2-Richter hatte eine varianzlose Frage. Verb 5 = schlafende ②-Maschinerie mit Opus 5 auf
  der main-seit-Fork-Kollisionsfrage, Shadow-Phase als Feuerprobe. Agent urteilt, Maschine landet.
- **UI-Programm freigegeben** („der sollte passen") → 6 Tasks angelegt (`3322990f` F4 ·
  `cb607025` F2+F3 · `2784427e` F6 · `9534b49a` F5 · `0bfd3d7e` F1-Spike · `547c7c36`
  Mini-Fixes), **bewusst `pending` statt des im Doc vorgesehenen `queue:true`** (dispatch:true
  läuft, Maschine war belegt). F4 + F2+F3 tragen bereits `ready`. Promote in Doc-Reihenfolge:
  F4 zuerst, max. zwei UI-Lanes, F4 strikt vor F5.
- **Beide Adjudikationen gefiled** (mit den Notizen der Slot-2-Lane): 28.7. → **`real`, der
  erste im Register überhaupt** (Journal-Cap-Defekt, 38 min später in `07e5969` behoben) ·
  3.8. → `flake` (Idle-Gate-Race, seit `0e4d65c` strukturell zu). **Register: 0 un-adjudizierte
  Rote** (1 real / 3 flake / 2 stale-test / 8 unknowable). Konsequenz: Auto-Rollback bleibt
  beerdigt (der Fix ging vorwärts), der Verb-5-Breaker ist durch genau diesen Fall validiert.
- **Steward ist unbesetzt** (Owner-Kill 16:30, Autos leer) — Wiederaufstellung = Verb 4, mit
  Ritual-Revision (Verfallsdatum trennt note/lane; kind:lane MIT Kriterium) + Digest-TTL (E).
- **Queue geputzt** (Owner-OK): 4 beweisbar erledigte Notes + `81514506` archiviert (2a gebaut,
  2b hängt an der 20-Lanes-Messung, 2c in Verb 4/5). `unarchive` existiert.

### Korrekturen an eigenen Aussagen

1. **`/api/audit` liefert NEUESTE ZUERST** — mein erster Drift-Check las positional-chronologisch
   und fiel. Dritter Fall dieser Familie im Register. Die §12-jq nutzt `min`, ordnungsunabhängig.
2. **Mein K2-Beleg gegen den Reviewer-Agenten war Überdehnung** — vom Owner gekippt, Korrektur
   steht im Verbs-Doc §Verb 5 und im Body von `9c4b757`.
3. **Adjudizieren hat KEINEN Board-Knopf** (steht in CLAUDE.md) — Owner-„mache ich" lief deshalb
   ins Leere; API-only, diesmal von mir mit Owner-Wort gedrückt.

### Live-Instrumente, frisch — und ihre Vergiftungs-Kaveats

- **`self_drift`** fängt echte Events (Lane 417c 2× organisch). ABER: Briefs, die die Route
  nennen (phantom-park tut es), vergiften die §11.2-Messung „findet die Lane sie selbst?" —
  Lanes 5684/51bf beim Auswerten ausschließen.
- **`suiteLock`/`gate`** auf beiden Flächen live (Steward-Notiz `05320523` war der Anlass).
- Task-Sichtbarkeit im 🗒-Overlay per Playwright-Browser VERIFIZIERT (alle 6 malen) — „ich sehe
  sie nicht" war Client-Cache/falsche Fläche, nicht der Server.

### In Flug / offen

- **Slot 1, Phantom-Park** (`f93deff8`, Brief `2a0047d`): arbeitet, uncommitted in server.ts +
  e2e/merge.ts + Landkarten-Refs. Report abwarten, unabhängig verifizieren, landen.
- **5 pending-Notes bleiben absichtlich**: 4 Befunde füttern Verb 4 / Map 6.2/6.3
  (`05320523`, `94565a55`, `b759e8d9`, `9821035e`) + Owner-Idee `356333db` (Anzeige ungebaut).
- 3 alte lane-Tasks mit needs-you (`0be58694`, `1fb929e9` — Prämisse vermutlich überholt,
  Audits grün —, `cabf3c88`).
- Verben 2–5 ungebaut. Reihenfolge im Doc: 2 Deploy → 3 Auto-Promote → 4 Steward → 5 Auto-Land.

---

## Session 28 (2026-08-06): `stalled` wird ein Fakt — und der Land-Gate lernt, dass Stille kein Urteil ist

**Der Auftrag für die NÄCHSTE frische Session steht ganz unten unter „Das Erste".** Beide
gebrieften Sessions sind gelaufen UND gelandet — du musst nichts mehr einsammeln. Ihr Ergebnis ist
`docs/autonomy-map-2026-08-06.md`, und dessen §11.3 ist die Reihenfolge, nach der du arbeitest.

### Gelandet (11 Commits, `d7142d8..a67a96f`) — Mechanismen in den Bodies, hier nur die Namen

| | |
|---|---|
| `523f5dc` | Perception-Fix: `lastOutput` wurde nach JEDEM Neustart als ~1.79e12 ms gelesen; zwei Verbraucher handelten darauf (`canDeliver`s busy-Gate, die auto-③-Idle-Klausel) |
| `29c6799` | der Brief zum `stalled`-Fakt |
| `28014d4` | der `stalled`-Fakt selbst — zweite Klausel-Liste in `lane-signals.ts`, Feld auf `stewardSlotsView`, Digest-Prompt aus derselben Quelle |
| `2758e0a` | der Fakt trägt seine Neustart-Verzerrung im Kommentar + `briefs/lane-stalled-ledger.md` |
| `79f0111` | `briefs/autonomy-findings-2026-08-06.md` — vier Befunde, die in keinem Ledger stehen |
| `26acdbd` | Pane zurückholen, ohne den Slot wegzuwerfen |
| `b169785` | dieser Handoff + `land-gate-speaks` + `autonomy-gap-addendum` |
| `909ace3` | `briefs/stalled-parked-and-ledger.md` — Markierung VOR Ledger |
| `6e96eaf` | `briefs/audit-reds-familie-b.md` |
| `5d707bc` | `docs/autonomy-map-2026-08-06.md` — die Landkarte, 593 Zeilen |
| `9c1b73c` | Timeout ist kein Nein mehr, das Warten schreibt sich auf |

**Alle sechs Tier-2-Audits danach grün.** Server läuft auf `9c1b73c`, `codeBehind: false`,
`bundleStale: false` — der Stand ist vollständig deployt (Bundle neu gebaut, weil `9c1b73c`
`src/client.ts` anfasst).

### Owner-Entscheide dieser Session

- **`stalled` bleibt ein Fakt ohne Aktion.** Kein Auto-Kill, kein Nudge, kein Tick liest ihn.
- **Instanz-Ledger: BEAUFTRAGT, nicht mehr offen.** Erst vertagt („schauen, ob überhaupt etwas zu
  zählen ist"), dann feuerte der Fakt binnen Stunden, dann Owner-Auftrag wörtlich: *„leg ein Log an,
  damit `stalledSince`-Daten einen Neustart überleben."* → `briefs/stalled-parked-and-ledger.md`
  (`909ace3`), Markierung als Teil 1 VOR dem Ledger als Teil 2. **Offen ist nur noch das WANN**: die
  Landkarte stellt es hinter die Instrumentierung (§11.3, Schritt F).
- **Owner-Token-Rotation: ausdrücklich nicht jetzt** („erstmal egal"). Der Token steht durch einen
  Shell-Fehler von mir im Transcript dieser Session.
- **Zwei rote Tier-2-Audits adjudiziert** (`flake`, Beleg: sie liefen 4½ h bzw. 3 h VOR `2bca3d2`,
  dem Commit, der die FIX1-Flake behob). Offene Rote: 4 → 2.
- **Reihenfolge dieser Session:** Land-Gate und Landkarte parallel — beides ausgeführt und
  gelandet. Die Reihenfolge für ALLES WEITERE gehört ab jetzt der Landkarte, nicht mir.

### Korrekturen an eigenen Aussagen (alle in dieser Session entstanden und belegt)

1. **`GET /api/post-land-audits` liefert NEUESTE ZUERST.** Ich habe zweimal `rows[rows.length-1]`
   gelesen und die ÄLTESTE Zeile als „letzter Audit" zitiert. Entscheidungen hingen nicht daran
   (die stützten sich auf den Zeilen-Zähler), die zitierten Zeilen waren trotzdem falsch.
2. **Meine Timeout-Hypothese war falsch.** Ich hielt die +97 Zeilen einer Lane in
   `fleet-e2e-claude-gate.ts` für die Ursache — plausibel, gut begründet, **widerlegt**: 37,9 s vs
   37,4 s, also +0,5 s. Eine automatische Diagnose hätte dasselbe Muster erkannt und dieselbe
   falsche Schuld zugewiesen. Konsequenz, die im Gate-Brief steht: automatische Diagnose darf nur
   Fakten benutzen, die der Server hält — nie kausale Zuschreibung nach Plausibilität.
3. **Mein eigener `stalled`-Entwurf hatte einen echten Defekt.** Ich hatte ihn im Haupt-Checkout
   gebaut (falscher Ort, verworfen); ihm fehlte die `observed`-Klausel. `idleMs` leitet sich von
   `lastOutput` ab, und das ist `0`, bis der Poll ein erstes Byte sieht — `0` liefert eine ZAHL
   (~1.79e12), kein `null`. Meine Null-Disziplin prüfte nur auf `null` und hätte damit jede frisch
   geöffnete Pane sofort angeklagt. Die Lane fand es durch MESSUNG, nicht durch Nachdenken.
4. **`stalled: true` auf Lane 8 ist ein FEHLALARM gegenüber der Absicht.** Ich meldete es als
   „erster echter Fang". Der Owner: Slot 6 und Lane 8 sind **Notiz-Worktrees**, absichtlich
   geparkt. Das Prädikat erfüllte jede Klausel korrekt — trotzdem falsch. `awaiting: "owner"` deckt
   nur Clarify-Lanes; für „absichtlich geparkt" gibt es **kein Feld**. Das bedroht die Feuerprobe
   des Fakts direkt (sein Brief verlangt 10 Instanzen bei höchstens 2 Fehlalarmen) und ist damit
   die erste offene Frage am Instanz-Ledger, nicht eine Randnotiz.

### Der Vorfall, aus dem der Gate-Brief entstand

Ein Land wurde gestoppt: `verify.ok: false`, `detail: "clean rebase, but verify failed"` — die
Ausgabe enthielt aber **null FAIL-Zeilen**, endete mit `ALL PASS` und dann
`[verify timed out after 300000ms]`. Die Lane maß die Ursache selbst: ihre Änderung kostete 0,5 s,
die ganze Kette auf leerer Maschine 106,8 s von 300 s. Die fehlenden ~255 s waren **Warten auf den
maschinenweiten Suite-Mutex** — `e2e-stage.sh` blockiert in einer `sleep 15`-Schleife und schreibt
dabei kein Byte. `FLEET_VERIFY_TIMEOUT_MS` ist ein Wanduhr-Budget und enthält damit still eine
unbegrenzte Wartezeit (ein gequeuetes `isolated` = ~8 min). Auslöser war der Tier-2-Vorschaulauf
der Lane selbst; CLAUDE.md verbietet Parallelläufe nur neben dem **Post**-Land-Audit, nicht neben
dem Pre-Land-Gate.

**Zweiter Anlauf auf leerer Maschine: 100 s, `verify.ok: true`, gelandet.** Die Diagnose ist damit
empirisch bestätigt, nicht nur plausibel.

### Das Ordnungsprinzip, auf das sich diese Session festgelegt hat

> **Erst reden lassen, dann unterscheiden, dann handeln.** Nichts automatisieren, dessen Ursache
> das System heute nicht selbst benennen kann.

Belegt durch Korrektur 2: der Grund, warum hier ein Mensch nötig war, ist nicht Komplexität — es
ist **Stille**. Der blockierende Prozess kannte die Zahl und schrieb sie nicht hin.

### Beide gebrieften Sessions sind gelaufen und GELANDET — das ist nicht mehr „in Flug"

- **`briefs/land-gate-speaks.md` → `9c1b73c`.** Timeout als eigener Gate-Zustand, Lock-Wartezeit
  schreibt sich auf, `verifyMs` im Record. Sie hat `docs/suite-contention.md` neu angelegt und
  `docs/verify-tiering.md` nachgezogen, und den Zustand testbar gemacht, indem
  `e2e-isolated.sh` `FLEET_VERIFY_TIMEOUT_MS=8000` setzt (~100× Kopf gegen die realen ~50 ms der
  Stand-ins). Verifikation im Body, inkl. `e2e-postland-audit` — die Suite, die sonst unbemerkt
  verrottet.
- **`briefs/autonomy-gap-addendum-2026-08-06.md` → `docs/autonomy-map-2026-08-06.md` (`5d707bc`).**
  Die Landkarte, 593 Zeilen, aus den Ledgern gerechnet. **Sie ist ab jetzt die Reihenfolge**, siehe
  unten.
- **`briefs/audit-reds-familie-b.md` (`6e96eaf`)** — der Auftrag für die zwei letzten
  un-adjudizierten Roten. Im Repo, **noch nicht gespawnt**.
- **`briefs/stalled-parked-and-ledger.md` (`909ace3`)** — Parkungs-Markierung (Teil 1) vor
  Instanz-Ledger (Teil 2). Im Repo, **noch nicht gespawnt**. Die Landkarte hat den Brief gelesen und
  schlägt ausdrücklich nichts vor, was dort schon steht — sie ergänzt ihn nur um die
  Neustart-Zählung (siehe unten).
- **Queue-Task `81514506`** (`pending`, `kind: lane`) — Drift-Blindheit, mit dem Vermerk, dass die
  Landkarte ihn einordnen soll, bevor er promotet wird. Sie hat es getan: Schritt **A**.

### Die Landkarte korrigiert diesen Handoff und das Findings-Doc an fünf Stellen

Nachlesen in `docs/autonomy-map-2026-08-06.md` §2 — hier nur die, die man kennen muss:

1. **Zeilennummern verrotten binnen Stunden.** `laneDrift` steht bei `5180` (nicht 5144), sein
   Abnehmer bei `7780` (nicht 7721), `/send` bei `9503` (nicht 9414). Die *Aussagen* wurden alle
   bestätigt — die Referenzen wanderten, weil drei Commits in `server.ts` landeten.
2. **„`/send` schreibt jede Nachricht dem Owner zu" war zu weit.** Die Quell-Union hat fünf Werte
   (`owner|share|auto|terminal|steward`), und der Steward-Sender schreibt bereits `"steward"`.
   `/send` IST die Owner-Route. Was fehlt, ist enger: **ein Label für „Maschine, die mit dem
   Owner-Credential spricht"** — bis es existiert, muss jeder maschinelle Sender über eine eigene
   Route laufen, nie über `/send`.
3. **Mein `briefPayload`-Beleg war wertlos** (das ist ein UI-Payload, kein Prompt). Der Befund hält
   trotzdem: in `enhance-prompt.ts`/`refine-prompt.ts`/`clarify-prompt.ts` kommt Drift nicht vor.
4. **„Die Analyse gated nichts" (CLAUDE.md) ist unpräzise**: das *Verdict* gated nichts, die
   *Existenz* einer frischen Analyse gated den unbeaufsichtigten Tick sehr wohl.
5. **`RefineChild.files` existiert nur im Vorschlag** — der Confirm faltet es in den Fließtext.
   Damit ist die Zutat für Kollisionsvermeidung *nicht* da, wo der Hauptbrief sie vermutet.

### Der härteste Einzelbefund der Landkarte

**0 von 12 adjudizierten roten Tier-2-Audits waren `real`.** Ein Auto-Rollback auf ein rotes Audit
hätte bisher in 100 % der Fälle falsch ausgelöst. Das beerdigt die Idee ohne Diskussion — und es ist
der Grund, warum die Inbox in ihrer Reihenfolge ganz hinten steht: zwei ihrer acht Item-Typen sind
heute nicht vertrauenswürdig, und eine Inbox, die am ersten Tag falsche Items zeigt, wird als
Rauschen gelernt.

### Das Erste für die nächste frische Session

**Die Reihenfolge steht jetzt, und sie ist nicht mehr meine.** `docs/autonomy-map-2026-08-06.md`
§11.3, begründet statt nach Aufwand sortiert:

1. **Instrumentierung zuerst**, sonst wird jede folgende Entscheidung gegen eine Vermutung gebaut:
   **A** Audit-Event auf `/api/self/drift` (eine Zeile — Task `81514506`), dann **9.1** der
   Phantom-`mergeParked`-Eintrag (ein Bug mit Live-Beleg, verfälscht ausgerechnet den Item-Typ, den
   die Inbox zuerst zeigen würde), dann **E** `DIGEST_TTL_MS` über das Puls-Intervall.
2. **Sensoren:** `sinceLastLook` nach Repo schlüsseln, `mtime`-Caveat, Timeout-Zustand *(letzterer
   ist mit `9c1b73c` erledigt)*.
3. **Prävention:** 9.2 (requeueter Dispatch lässt seine Lane stehen — ein Leck, kein Feature),
   dann `otherLanes.files` auf uncommittete Dateien, dann `files` als Feld am Refine-Kind.
4. **Zuletzt der Rückkanal:** die Entscheidungs-Inbox.

**§11.2 trägt für jeden Schritt eine Schwelle** — welche Zahl, über wie viele Läufe, wann man
abbricht. Ohne die ist ein Vorschlag eine Meinung; mit ihr ist er prüfbar. Nicht in der Liste,
bewusst: Auto-Deploy — der Neustart ist harmloser als gedacht (die Audit-Queue überlebt ihn), aber
„was ist der Rückweg, wenn ein Auto-Deploy etwas Kaputtes live stellt" ist unbeantwortet.

Ergänzung der Landkarte zum Instanz-Ledger, die in `909ace3` fehlt: **jede Zeile muss die Zahl der
srv-Neustarts in ihrem Fenster tragen.** Gemessen 5 / 11 / 12 / **38** Neustarts an den letzten vier
Tagen — ohne diese Zahl ist die Stichprobe nicht „zehn Instanzen", sondern „zehn Instanzen aus den
ruhigen Tagen".

Stehend offen:
- **2 un-adjudizierte rote Audits** — Brief `6e96eaf` liegt, Lane nicht gespawnt
- **Parkungs-Markierung + Instanz-Ledger** — Brief `909ace3` liegt, Lane nicht gespawnt
- 7 ungelesene Rundgang-Notizen in der Queue
- `Slot.mission` existiert und ist leer — bevor ein neues Feld für „geparkt" entsteht, gehört
  begründet, warum das vorhandene nicht der Träger ist (Landkarte §9.4/§10)

---

## Session 27 (2026-08-05): der Issue-/Lücken-Sweep, und was oberhalb der Schnittlinie gebaut wurde

Owner-Auftrag wörtlich: *„wir haben jetzt echt viel Arbeit geleistet in den letzten Sessions,
und deswegen sollten wir das ganze jetzt nochmal analysieren, nach issues und lücken suchen
und dann verbessern."* Methode: sechs parallele Read-only-Reviews (Merge/Resolver, Eval/
Dispatcher, Self-Routen/Clarify, Steward, Docs-Währung, Client/Terminal), jeden tragenden
Befund selbst am Code nachvollzogen, Rangliste mit Schnittlinie, dann acht Commits
(`3a02e8d`..`964b5c2` + Nachfix). Mechanismen in den Bodies; hier nur das Residuum.

### Der eine systemische Befund, falls du nur eine Zeile liest

**`defuseDelimiters` existierte und wurde in genau einem von ~sechs Fence-Buildern angewandt.**
Drei unabhängige Reviews konvergierten am selben Tag darauf — am schärfsten beim Eval-Richter
(der einzige Riegel zwischen Intake-Text und unbeaufsichtigtem Spawn; ein Fence-Break sprach
für den ganzen Batch). Jetzt geteilt in `src/protocol.ts`, überall angewandt, adversarial
gepinnt. Der alte Eval-Check fütterte nur harmlosen Text und **pinnte die verwundbare Form
als korrekt** — ein Check, der seine Klasse nie fangen musste, dokumentiert nur Hoffnung
(dasselbe galt für den Motion-Regex: Kommentar versprach `H/f`, Klasse hatte kein `f`).

### Ein Regress von mir, vom Gate gefangen — und die Semantik dahinter

Der Entry-Status-Restore (Eval-Cap-Fix, `88a7da7`) war zu breit: claude-gate 6b fiel, weil ein
**attended** Start nach totem claude jetzt zu `pending` statt `queued` requeued hätte.
Korrigiert auf die präzise Regel: **transienter Post-Spawn-Fail = Retry-förmig** (`queued` bei
Owner-Akt, Entry-Status nur unattended — schützt die Eval-Identität), **persistenter
Spawn-Fehler = zurück an den Ursprung** (auch attended; sonst loopt eine kaputte Repo-Task
durch den Tick). Die Asymmetrie ist Absicht und im Code begründet.

### Unterhalb der Schnittlinie — geflaggt, NICHT gebaut (Owner-Entscheid oder eigene Scheibe)

1. **Land-Serialisierung pro Repo** (zwei zeitgleiche ⏫: Crash-Fenster kann Provenienz/Undo
   des Verlierers verlieren; Normalfall nur roher ff-Fehler). Eingriff in den Land-Kern.
2. **`awaiting-author` ohne Versuchszähler/erzwingbaren Fallback** — kann still zur Gummiwand
   werden; die Form (Owner-Knopf „diesmal der Worker"?) ist Owner-Sache.
3. `resolvedBy:"author"`-Fehlattribution im Randfall (Konflikt verschwindet, weil main
   zurücknimmt) · Self-Routen drift/gate/criterion ohne Rate-Limit (capRecent existiert) ·
   `verify.cmd` wird Lanes wörtlich serviert (nie ein Secret hineinschreiben!) · Send-Belt
   accept/release und propose-outcome-Anreicherung ungepinnt · Steward-Dedup verwirft frischen
   Text ohne lastSeen · Journal-Ack vor Durability (dokumentierter Kontrakt).

### Governance-Lücken (die größten „Lücken" im Wortsinn, beide unentschieden)

- **2 von ~30 Commits seit `14dafdc` tragen eine Provenienz-Note** — Direkt-auf-main ist der
  Normalfall geworden, die ganze Land-Buchhaltung (Notes, Outcome-Rows, Tier-2, undo) greift
  nur für Lane-Lands. Blessen (Minimal-Buchhaltung für Direkt-Commits) oder Lanes erzwingen?
- **12 von 33 Tier-2-Audits sind rot, keiner trägt eine Adjudikation** — Alarm+Ack existieren,
  aber ob ein Rot als Flake bewiesen oder nie angesehen wurde, steht nirgends maschinenlesbar.

### Stehende offene Fäden (unverändert, nur gesammelt)

Terminal-Task `2e9ed996` zu ⅔ offen · **Enhance-Job = vom Owner benannter Erstauftrag** (Session
25, unangetastet) · Auto-Land-Entscheid (Bedingung „echte Läufe ansehen" ist erfüllt) ·
Gast-Container nie mit echter Claude-Session bewiesen · `recordLand` ohne `repo`/`mainAfter`
auf der Row (Session 16).

### Verifikation dieser Session

Volle Kette seriell auf dem finalen Baum: pins + tsc + build grün, clean-review / security /
claude-gate / isolated je ALL PASS (claude-gate nach dem Nachfix erneut, die anderen drei
danach seriell erneut — 0 FAIL). `e2e-postland-audit.sh` bewusst nicht gefahren (kein
Tier-2-Pfad angefasst). Deploy + Health-Check am Sessionende, siehe state.sh.

## Session 26 (2026-08-05, parallel zum Steward-/Eval-Strang): der Resolver sieht beide Seiten

*Fortsetzung des ②-Programms aus Session 24. Die Commits `38ec2bd`, `bb9e067`, `0e4d65c`,
`8194aea`, `669d2c9`, `33b3105` gehören NICHT zu diesem Strang — sie sind der parallel
laufende Steward-/clarify-Strang.*

### GELANDET (`b297aad`) und deployed

Lane `fleet/260805124635-95a7` (Slot 1, Basis `33b3105`, Task `10bc0b91` per Hand-Knopf —
der umgeht das Eval-Gate bewusst, attended schlägt Automatik), gebrieft aus
`briefs/resolver-both-sides.md`. Ein Commit, drei Dateien (`e2e/prompts.ts`,
`merge-prompt.ts`, `server.ts`), kein `src/` → **kein Bundle-Bau nötig.**

Vollständig protokolliert: `verified:true`, Provenienz-Note `ab2319e → b297aad`,
Tier-2-Audit **grün** (exit 0, 460 s, `covers` nennt die Lane), `bootHead == HEAD`.
**Vor** dem Land unabhängig verifiziert (der Report einer Lane ist eine Behauptung):
tsc 0 + alle vier Suiten ALL PASS auf ihrem Baum — und der Diff zwischen dem so geprüften
Commit und dem gelandeten ist über die drei Dateien **0 Zeilen**, es ist also exakt der
geprüfte Stand.

**Was die Lane über den Brief hinaus gefunden hat** (beides gehört ins Register):
- **`git rev-parse <unbekanntes-ref>` echot den REF SELBST auf stdout und exitet 128.** Ein
  Truthiness-Test hätte den String `"main"` als sha durchgereicht. Der Exit-Code entscheidet.
- **`core.hooksPath` ist unset** — die Ergänzung, die meinen Hook-Befund unten erst
  vollständig macht. Ohne sie wäre „`.git/hooks` trägt kein `post-merge`" nicht ausreichend
  gewesen, weil die Hooks umgeleitet sein könnten.
- Beide Archive kommen aus dem LANE-Worktree: Worktrees teilen eine Objektdatenbank, mains
  Commit ist dort lesbar, **ohne den Haupt-Checkout anzufassen**. Parallel gebaut, 4,75 s für
  beide gegen ~5,7 s für einen seriell.

**Offene Design-Frage, jetzt als Kontrakt festgenagelt:** der **Autor-Prompt bekommt keine
Karte**. Begründbar (der Autor ist eine echte Session mit eigenen Werkzeugen), aber die
Graphen liegen in TMPDIR und **die Pfade kennt nur der Server** — der Autor könnte sie also
nicht benutzen, selbst wenn er wollte. Er bekommt das Diff-Kommando, nicht die Karte. Ein
neuer Check pinnt das; wer es ändern will, ändert bewusst einen Kontrakt.

### Der Befund, der die Scheibe ausgelöst hat

Owner-Frage war, womit der Merge-Agent eigentlich arbeitet. Gemessen am Prompt-Bauer:

- **Er bekommt Betreffs, nicht Inhalt.** `buildMergePrompt` und `buildAuthorPrompt` reichen
  `git log --oneline` BEIDER Seiten hin — Einzeiler. Den echten Diff kann er sich holen
  (`git diff` ist im Profil), aber **nichts sagt ihm, dass er soll**. Die einzige Stelle mit
  hingereichter Maschinenausgabe ist der Repair-Prompt; das Muster existiert, es ist nur nicht
  auf den Merge angewandt.
- **Der Lane-Graph ist aus dem Lane-HEAD gebaut** und enthält main nur bis zum Fork — einen
  Aufrufer, den main SEIT dem Fork hinzugefügt hat, kann er prinzipiell nicht sehen. Genau der
  Konfliktfall, der schiefgeht.

### Die Messung, die einen fertigen Entwurf gekippt hat — nicht wieder aufmachen

Der naheliegende Fix war, den graphify-Graphen des Haupt-Checkouts mitzureichen: ein
`post-commit`-Hook pflegt ihn ja. **Falsch, gemessen 2026-08-05:**

- Der Server bewegt main mit `git merge --ff-only` (`server.ts:1183`) bzw. `git branch -f`
  (`:1188`) — **keins von beidem feuert `post-commit`**.
- Installiert sind nur `post-commit` und `post-checkout`, **kein `post-merge`**.
- **`.git/hooks/` ist nicht getrackt** (`git ls-files` zählt dort 0) — der Hook reist mit
  keinem Klon und in keinen Worktree mit.

Also ist der Graph des Haupt-Checkouts **genau nach einem Land veraltet** — dem Moment, in dem
die nächste Lane merged. Beim Nachsehen sah er aktuell aus (`built_at_commit == HEAD`), aber
nur weil der letzte Schritt zufällig ein Hand-Commit war. **Nicht wieder vorschlagen:**
Hook-Pflege, `graphify watch`, Cron, oder irgendein Produktfeature auf `.git/hooks`. Der
Server baut main's Graphen stattdessen selbst aus `git archive <main-sha>` — per Konstruktion
der richtige Commit, damit entsteht die Frische-Frage gar nicht erst.

### Korrekturen an eigenen Aussagen dieser Session

- **„Fremde uncommittete Arbeit blockiert die Lane" war zu breit.** Sie blockiert das **Land**,
  nie den **Spawn** — ein Worktree entsteht aus committed HEAD und rührt den Haupt-Checkout
  nicht an. Die Unterscheidung kostet sonst grundlos Wartezeit.
- **`built_at_commit == HEAD` ist kein Frische-Beweis für den Merge-Zeitpunkt**, sondern nur
  für den Augenblick des Nachsehens. Siehe oben.
- **Ein Warte-Loop auf `merges[slot].running` direkt nach dem ⏫-POST bricht sofort ab** — die
  Flagge ist da noch nicht gesetzt. Ich habe daraus eine Fehldiagnose gebaut („der Server ist
  mitten im Job gestorben", weil main unbewegt war und kein Verdict dastand) und sie fast als
  Störfall gemeldet. Der Job lief die ganze Zeit normal. **Auf `main`-Bewegung bzw. das
  Verschwinden des Worktrees warten, nicht auf die Running-Flagge** — und ein fehlender
  Beweis ist kein Beweis des Fehlens. Was es aufgeklärt hat: Outcome-Row und Provenienz-Note
  nachschlagen statt der ersten Beobachtung glauben.

---

## Session 25 (2026-08-05): der Autonomie-Kreislauf ist geschlossen — hinter Ventilen

Drei Commits (`db02562` Reaper · `184fc72` `/api/self/gate` · `ca55b52` Eval-Gate), alle
deployed und live nachgeprüft; Mechanismen in den Bodies. Hier nur das Residuum.

### Owner-Entscheide dieser Session

- **Eval-Gate gebaut und AN**: maschinell eingereihte Tasks bekommen VOR dem unbeaufsichtigten
  Spawn eine kritische Sicht (Opus 5, read-only, `eval-prompt.ts`; ②-Kontrakt: downgrade-only,
  fail-closed). **Dispatcher wieder AN** — der Flip kam NACH dem Gate, das war die Bedingung.
  Owner-Promote und Hand-Knopf umgehen das Gate bewusst (attended schlägt Automatik).
- **Eval-Modell = `claude-opus-5`** (Owner wörtlich: „Beim eval-Model … einfach opus5 nehmen").
- **Steward-Dauerpuls**: perpetual-Auto `69b31603` auf Slot 2 (`⚙ steward`), stündlich,
  idleSec 600. perpetual ist owner-only per Design (`server.ts`, grep `allowPerpetual`).

### Live bewiesen, erste Minuten

Der erste echte Sweep fing eine **Queue-Dublette mit Zeilenzitat** („slice C is already
implemented and landed. wakeAuthor exists at server.ts:4457") — und der erste Rundgang-Puls
des Stewards fand **dieselbe Dublette unabhängig**. Die Terminal-Task `2e9ed996` wurde
korrekt als `review` geparkt (mehrteilig, teilerledigt) und wartet auf Owner-Split.

### Korrekturen, die man kennen muss

- **Der Steward-Worktree ist NEU**: der alte hing auf der Vor-Publish-Historie (`b5a140b`)
  und wurde ersetzt — Branch `steward-live` auf aktuellem main, Scaffolding von Hand kopiert
  (0600). Der alte Branch `steward` liegt als Altlast. `inspektion-register.jsonl` (26 Zeilen
  Puls-Register) wurde in den Haupt-Checkout gerettet, jetzt gitignored.
- Das ⚙-Zahnrad fehlte, weil KEIN Slot auf den Steward-Worktree zeigte — Label exakt
  `⚙ steward` ist token-tragend (`server.ts`, grep `STEWARD_LABEL`); die Open-Route nimmt
  `label` direkt mit, dann bakes der Erst-Spawn den Token (verifiziert per `ps eww`, nur Key).
- Bewusste v1-Lücke: eine am Tages-Cap (`FLEET_EVAL_MAX_AUTO_PER_DAY`, 10) wartende
  auto-Task trägt keine waiting-Note — nur den eval-Chip.

### „▸ clarify first" — die dritte Antwort auf ein eval:review

Owner-Ask: ein Knopf, der die Lane spawnt, dem Agenten aber sagt, er soll das Done-Kriterium
ZUERST mit dem Owner ermitteln. Gebaut; Mechanik im Commit-Body. Das Residuum:

- **Der Enhancer läuft auf diesem Pfad bewusst NICHT.** Er kompiliert einen Arbeitsauftrag mit
  Done-Kriterium — und eine Task, die diesen Knopf erreicht, ist genau die, wo diese Prämisse
  nicht gilt. Deterministischer Rahmen + Rohtext in einer Fence, kein Modellaufruf. Kein
  `/sharpen3` aus demselben Grund.
- **Das Kriterium ist dauerhaft und gehört am Ende dem Owner**: Lane schlägt vor
  (`POST /api/self/criterion`, `confirmedAt:null`), Owner bestätigt mit EIGENEM Text. Danach
  kann die Lane es nicht mehr überschreiben (409). Das ist die propose/promote-Grenze — ein
  Produzent schreibt nie den Anker, an dem er gemessen wird (`server.ts`, `Slot.mission`).
- **Das Warten ist ein ZUSTAND, nicht nur ein Satz im Prompt.** `Slot.awaiting="owner"`
  (persistiert) lässt `handleStewardSend` den Slot mit 409 abweisen. Ohne das wäre eine
  wartende Clarify-Lane schlicht eine idle Lane, also ein `continue_nudge`-Ziel — der Steward
  hätte sie am Owner vorbei weitergeschoben. auto-③ war nie ein Risiko: `git.ahead>0` ist
  Pflicht (`lane-signals.ts:44`), eine Lane ohne Code hat null Commits.

**Zwei Dinge, die beim Selbst-Audit auffielen und die man kennen muss:**

1. **Der Public-Repo-Guard hat eine Lücke.** `git grep -inE '…|100\.68…'` (CLAUDE.md, Deploy)
   sieht **nur getrackte Dateien** — eine noch untracked NEUE Datei mit der Deploy-IP läuft
   glatt durch. Genau das wäre hier fast passiert (`clarify-prompt.ts` hatte den Host
   hardcodiert). Die Base-URL wird jetzt zur Laufzeit übergeben, ein Check pinnt es. **Wer den
   Guard fährt, muss ihn bei neuen Dateien gegen den ARBEITSBAUM fahren, nicht gegen den Index.**
2. **`bun run build` deployt den Client sofort** — auch aus einem uncommitteten Baum. Dadurch
   stand der „▸ clarify first"-Knopf im Live-Board, während der Live-Server die Routen noch
   nicht hatte (404). Steht so schon in der CLAUDE.md; hier als gelebter Fall.

### Das Erste für die nächste frische Session (Owner-Auftrag, wörtlich)

**Der automatische Prompt-Enhance-Job für Tasks.** Owner: *„für genau diesen Task wäre ein
funktionierender und automatischer prompt-enhance job genau das richtige! Das sollten wir aber
am besten in einer neuen frischen Session angehen."* Erstfall ist `2e9ed996` (Terminal-Task,
parkt mit eval:review — bewusst NICHT von Hand gesplittet). Die Form ist zu entwerfen, die
Maschinerie existiert: `runEnhance` (additiv-only-Kontrakt) + danach das Eval-Gate; der
Ideen-Pool ist `kind:note`. Offene Formfragen für den Entwurf: Wo hängt der Job — Knopf pro
Task („↻ refine"), automatisch auf eval:review-Tasks, oder beides? Darf er EINE Task in
MEHRERE saubere lane-Tasks zerlegen (der Erstfall braucht genau das)? Was passiert mit dem
Original (archive mit Verweis?) — und das Verdict-ist-final-Prinzip beachten: neue Tasks
bekommen frisches Urteil. **Ausnahme seit `37510f5`: `↻ re-eval`** (`POST
/api/tasks/:id/eval-reset`, nur auf pending) räumt ein Verdict ab und lässt den Sweep neu
urteilen — ein ausdrücklicher Owner-Akt, kein Automatismus. Wer den Enhance-Job entwirft,
entscheidet, ob eine veredelte Task diesen Weg nimmt oder eine neue Row wird.

**Der Eval-Kontrakt hat am ersten Tag eine Korrektur gebraucht** (Owner: „the eval doesn't
make sense to me at all", und er hatte recht): `reason` war bei 200 Zeichen gekappt, das
erste Live-Verdict öffnete mit seinen stützenden Befunden und verlor das Urteil im
abgeschnittenen Nachsatz — sichtbar blieb ein review, das für auto argumentierte. Behoben in
drei Schichten (Cap 2000, Digest-Anriss vs. voller Text auf `/api/tasks`, Prompt-Regel
„entscheidender Faktor zuerst"); Mechanismus im Commit-Body. **Die Lehre für den Enhance-Job:
was ein Urteilstext SAGT, ist erst dann geprüft, wenn ihn jemand ganz gelesen hat** — kein
Check hätte das gefangen, der Owner-Blick auf die Fläche hat es gefangen.

### Weitere Stufen (Reihenfolge im Chat begründet, nichts davon begonnen)

1. ~~**Auto-Land für eval-auto-Lanes** (Entscheid #6)~~ — **hinfällig seit Session 28**: es gibt
   keine eval-auto-Lanes mehr. Das Gate ist zur beratenden Analyse geworden, unbeaufsichtigt
   läuft nur noch, was der Owner freigegeben hat (`docs/queue-analyst.md`). Die Frage „Auto-Land"
   ist damit eine eigene, unbeantwortete Frage über *freigegebene* Lanes, nicht die Fortsetzung
   dieser hier.
2. **⑦ v2: die Verify-Queue besitzt die Läufe** — erst danach `DISPATCH_MAX_LANES` > 2.
3. **Overlap-bewusstes Zurückhalten im Dispatcher** — die Analyse liefert `collides` jetzt
   inklusive der laufenden Lanes (nicht mehr nur Batch-Geschwister), `laneDrift` liefert den Rest.
   Der Dispatcher LIEST beides noch nicht. Cross-Repo-Parallelität ist schon heute echt
   (Deckel zählt pro Repo).

---

## Session 24 (2026-08-05 nachts): Punkt 2 der Liste erledigt, Punkt 1 als Brief zurückgegeben

Autonome Session auf Zuruf („mach autonom weiter, denk gut nach was du tust"), abgearbeitet
in der Reihenfolge der Session-23-Liste. **Sechs Commits**, `9d3fba8` · `f3ab318` · `d0e2260` · `9fa6311` · `200f959` · `bbbe4ad`,
alle gelandet; jeder Code-Commit deployed und live nachgeprüft (bootHead == HEAD).

### Was erledigt ist

- **`isServerCode` (Listenpunkt 2) — behoben, verifiziert, deployed.** Dritte Allowlist
  (`e2e/**` + fünf `fleet-e2e*.ts`-Runner), Check in `e2e/deploy-facts.ts` §2b auf frischem
  Boot. Mechanismus + die bewusst offen gelassene Rest-Klasse stehen im Commit-Body.
  Kette seriell auf demselben Baum: tsc + build, `./e2e-isolated.sh` ALL PASS,
  clean-review + security + claude-gate je ALL PASS.
- **Deploy nachgeprüft ohne Owner-Credential**: Commit 23:57:49, srv-Boot 23:58:05 →
  `bootHead == HEAD`; Bundle-mtimes (1785880090) neuer als die neueste `src/`-Datei
  (1785875802) → nicht stale. Beides ist dieselbe Rechnung, die die Route macht.
  **Nebenbefund: `.env` trägt KEIN `FLEET_TOKEN`** — die Zeile „Health-Check per
  `/api/steward/sessions`" in der CLAUDE.md setzt eine Credential voraus, die eine Session
  nicht ohne Weiteres hat. Lokal nachrechnen geht und ist billiger.

### Warum ② (Listenpunkt 1) NICHT gebaut wurde

`briefs/server-first-sync.md` liegt fertig da — abgeleitet aus dem Code, nicht aus dem
Handoff. Zwei Gründe, beide beim Lesen entstanden und beide gegen das Bauen:

1. **② ist enger als sein Name.** „Der Server fährt den Rebase" ist `tryScriptRebase`
   (`server.ts:4203`) und existiert längst. Offen ist nur, **wer den Konflikt löst** —
   heute ein kontextloser Wegwerf-Agent (`runMerge`, `:4227`), nach ② der Autor.
2. **② schreibt `e2e/merge.ts` um, statt sie zu erweitern** (≈7 Check-Familien, namentlich
   im Brief). Eine Suite, die die heutige Zusage beweist, kann nicht nebenbei umgeschrieben
   werden — welche Zusagen fallen, ist Owner-Sache.

**Die blockierende Frage steht am Ende des Briefs**: was ⏫ tun soll, wenn die Lane-Session
tot oder beschäftigt ist (Autor-mit-Fallback / nur Autor / Timeout). Sie entscheidet, ob
`runMerge` bleibt oder geht. Drei Formen, ausformuliert, mit Kosten.

### Zahlen, neu gerechnet statt zitiert (2026-08-05, `lane-outcomes.jsonl`)

83 Rows · 67 Lands · **42/67 sahen ein fremdes Land in ihrer Lebenszeit** · `resolvedConflict`
jemals true: **4/83** · `repairRounds` **0 in allen 83** · und der Fakt, den bisher niemand
notiert hat: **nur 8 von 67 Lands hat je ein Mensch bestätigt.** Konsequenz, die im Brief
steht und die man vor dem Bauen von ② kennen muss: **② wirkt auf 4 Ereignisse in 83 Lanes.
Es ist eine Qualitäts-, keine Durchsatzscheibe.**

### Terminal-Task `2e9ed996`: ein Drittel gebaut, zwei Drittel gemessen und benannt

Owner-Wortlaut: *„improving the terminal formatting, making it more robust and giving it
colour back - also to make it fully scrollback-able"* — drei Dinge, und sie sind verschieden
weit.

**Farbe: gebaut (`d0e2260`), deployed.** Die drei WS-Seed-Captures nahmen bewusst kein `-e`.
Der Kommentar im Code begründete das mit absoluten Spaltensprüngen (`\x1b[200G`), die eine
schmalere Client-Breite garblen würden — Preis ausdrücklich „old scrollback loses color".
**Diese Prämisse ist auf tmux 3.6a widerlegt, in drei Experimenten:** breite gefärbte
TUI-Zeilen in einer 200-Spalten-Pane, auf 55 resized wie der Pfad es tut → 0 Cursor-Escapes;
und entscheidend: **`-e`-Ausgabe minus SGR ist byte-identisch zur plain-Ausgabe** (1004 = 1004
B, leerer diff), der einzige CSI-Finalbyte ist `m`. Der Trade-off war leer.

**Die Angst war trotzdem berechtigt und ist jetzt ein Check, kein Verzicht** (`e2e/slots.ts`):
der Seed trägt SGR **und** trägt keine Cursor-Bewegungs-Escape. Ein tmux, das je eine
emittiert, wird laut rot statt still zu verschieben. Ohne diesen zweiten Check wäre die
Änderung ein Downgrade von „sicher" auf „heute zufällig sicher".

**Auf der Fläche geprüft, nicht nur auf der Leitung:** Wegwerf-Instanz (eigener Socket/Port,
danach restlos entfernt), gefärbte Ausgabe in die Pane, dann ein *frischer Seitenaufruf* —
reiner Reseed ohne eine Zeile Live-Ausgabe — malt den vollen gefärbten Scrollback, sauber auf
Spalte 0.

**„fully scrollback-able": NICHT gebaut, aber die Ursache steht fest.** `SEED_LINES = 3000`
(`server.ts:35`) deckelt jeden Connect, während tmux `history-limit 50000` hält (`:1248`) und
xterm `scrollback: 50000` fasst (`src/client.ts:237`). Der `seed`-Parameter ist bei
`server.ts` mit `Math.min(SEED_LINES, …)` geklammert — **ein Client kann nur WENIGER
anfordern, nie mehr.** Der Browser kann also 50 000 Zeilen halten und bekommt nie mehr als
3000. Eigene Scheibe, und die schwierige Stelle ist nicht der Server: **xterm kann nicht in
den Scrollback prependen**, „ältere laden" heisst also Puffer neu schreiben. Naheliegende
Form: ein ausdrückliches „volle Historie laden" (Reseed mit hohem `seed`), nicht ein grösserer
Default — sonst zahlt jeder Connect den Transfer, und genau davon kam das Data-Saver-Programm.

**„more robust": nicht angefasst, bewusst.** Es ist der einzige der drei Punkte ohne benanntes
Symptom. Ein Beispiel vom Owner (welche Ausgabe bricht wie) ist billiger als jede Vermutung.

### ② ist entschieden und angefangen — A und B stehen, C ist eine Lane

Owner-Entscheid: **Form 1 — Autor zuerst, Wegwerf-Agent als Fallback**, mit zwei Auflagen.
Messung, Begründung und Reihenfolge stehen in `briefs/server-first-sync.md` (`bbbe4ad`);
hier nur, was git nicht trägt.

**Warum überhaupt ein Fallback, und wie oft er greift:** Konflikt 4/83 Lanes · Autor-Pane
stirbt oft (484 Heals / 279 Öffnungen), wird aber **184-mal mit Kontext** zurückgeholt ·
kontextlos nur 32-mal, an 2 von 15 Tagen · **Konflikt UND kontextloser Autor: 0-mal in 83
Lanes**, gerechnet ~1 von 300. **Die Zahl ist eine Untergrenze, keine Schätzung** — n=4, also
zwei multiplizierte Randverteilungen, und die Faktoren sind vermutlich positiv korreliert.

**Ein Argument von mir wurde widerlegt und steht als Widerlegung im Brief:** „ein Zweig, der
nie feuert, verrottet" gilt hier nicht — der Repair-Loop hat in 83 Rows nie gefeuert und ist
von sechs Checks abgedeckt. Die Suite hält solche Zweige ehrlich.

**A + B gelandet (`200f959`), deployed** (bootHead == HEAD, 10 Sessions überlebten):
- **A — graphify für den Resolver.** Korrektur, die man kennen muss: „kontextlos" war meine
  zu grobe Wortwahl — `MERGE_TOOLS` gab dem Resolver Projekt und git längst; es fehlte nur
  graphify. **Der Graph liegt bewusst AUSSERHALB des Worktrees** (`git archive` → TMPDIR,
  Agent bekommt `--graph <abs>`), gebaut nur auf dem Konfliktpfad, aufgeräumt im `finally`.
- **B — `resolvedBy: "agent" | "author"`**, geschrieben nur wo `resolvedConflict` wahr ist.

**Der Fehler, der dabei am meisten wert war** (54 rote Checks): die erste Fassung baute den
Graphen IM Worktree. `git status --porcelain` ist auf dem Merge-Pfad die Autorität, also
wurde aus `?? graphify-out/` ein „agent reported rebased, but the lane is not clean" — **der
Server lastet dem Agenten einen Zustand an, den der Server selbst erzeugt hat.** Exakt die
FIX1-Pathologie. In diesem Repo unsichtbar (gitignored), aufgeschlagen wäre sie beim ersten
Dispatch in ein fremdes Repo über `task.repo`. Wer dort etwas ändert: der Graph darf nie in
den Baum zurück.

**C ist GELANDET (`a9b5a13`) und deployed.** Lane `fleet/260804233117-3ab1`, vom Dispatcher
gespawnt, ein Commit, +551/-34 über 8 Dateien. Bewusst **eine** Lane, nicht zwei: B und C
hätten beide `mergeJob` und dieselben Test-Familien angefasst — die Kollision, gegen die ②
gebaut wird.

Zum Land, weil es das erste vollständig protokollierte seit Langem ist: Verify-Gate grün,
Auto-Land auf dem clean-Pfad (`resolvedConflict:false`, also korrekt **kein** `resolvedBy`),
**Provenienz-Note + Outcome-Row + Tier-2-Audit vorhanden** — genau das, was den neun
Direkt-auf-main-Commits dieser Session fehlt. Der Tier-2-Audit ist **grün** auf `a9b5a13`
(419 s, `covers` nennt die Lane). Unabhängig vorher nachgeprüft: ich habe die volle Kette
selbst auf dem Lane-Baum gefahren, statt dem Report zu glauben — tsc + vier Suiten ALL PASS,
**20 ②-Checks gelaufen und grün, kein Check übersprungen**.

**Was C geändert hat, und was daran unbeweisbar bleibt:** bei Konflikt weckt der Server die
Lane-Session (Verdict `awaiting-author`, im Board als Warten gemalt, nicht als Fehler); der
Wegwerf-Resolver ist Fallback. Die Suite fährt dafür ein `claude`, das ein **Symlink auf
/bin/cat** ist (auf macOS zwingend Symlink — eine Kopie einer Plattform-Binary wird mit
SIGKILL erschlagen, gemessen). Dass ein ECHTES claude den Brief liest und gut auflöst, ist
in keiner Harness prüfbar. **Gefallen ist:** die sieben alten Check-Familien beschreiben ab
jetzt den Fallback, nicht den Hauptweg — die Lane hat das korrekt als Owner-Entscheid
gemeldet, statt die Suite passend zu machen.

**Der erwartete Preis war kleiner als im Brief geschätzt:** weil `e2e-isolated.sh` mit
`FLEET_CMD=true` fährt, antwortet die strenge Alive-Sonde dort „no-claude" — es musste
**keine** der sieben Familien umgeschrieben werden.

### Unverändert offen (nichts davon angefasst)

- **Maschinenhygiene bleibt OFFENE OWNER-ENTSCHEIDUNG.** Nichts gelöscht. Gemessen zu
  Sessionbeginn: 124 verwaiste Sockets, 70 MB Instanz-Scratch — die Suitenläufe dieser
  Session kommen obendrauf. Zwei Wege stehen unten in der Session-23-Liste.
- Queue-Task `2e9ed996` (Terminal) — **noch offen, ein Drittel erledigt** (Farbe gebaut;
  Scrollback-Tiefe und „robust" siehe oben). Die Task bleibt `pending`; der Status im Board
  wurde nicht angefasst, weil zwei der drei Punkte offen sind.
- **Buchhaltungslücke setzt sich fort:** `9d3fba8` ist wieder direkt auf main im
  Haupt-Checkout entstanden, ohne Lane → kein `fleet/land`-Note, keine Outcome-Row, kein
  Tier-2-Audit, kein `undo-land`. Rückweg ist `git revert`. Ob das der richtige Weg ist,
  ist weiterhin unbeantwortet (Session 23 hat die Frage gestellt, niemand hat sie
  beschieden). **Gemessen statt gezählt** (`git notes --ref=fleet/land show` über
  `14dafdc^..HEAD`): **9 Commits ohne Provenienz-Note** — 8 aus Session 23, 1 aus dieser.
  Der letzte Commit MIT Note ist `14dafdc`, das letzte echte Lane-Land. Session 23s
  Handoff nennt „sieben" und an anderer Stelle „fünf"; beide Zahlen stimmen nicht, die
  Messung ist die Zahl.
- **Latenter Privacy-Fund, heute ungefährlich, beim Antippen scharf:** die
  `refs/notes/fleet/land`-Notes tragen die volle Verify-Ausgabe und darin Accountname und
  Rechnername (`14dafdc`s Note enthält beides mehrfach). In einem öffentlichen Repo wäre das
  ein Leck — **ist es heute nicht**: `remote.origin.push` ist ungesetzt, und der
  Default-Push fasst `refs/notes/*` nie an (beides gerade nachgesehen). Gefährlich wird
  ausschliesslich ein ausdrückliches `git push origin refs/notes/*`. Wer die Notes je
  veröffentlichen will, redigiert vorher die `verify.out`-Felder.

---

## Session 23 (2026-08-04 abends): ⑦ landen, benutzen, und im Gebrauch reparieren

Diese Session hat die vier Handgriffe aus Session 22 abgearbeitet, dann ⑦ gelandet — und dann
etwas gefunden, das nur durch **Benutzen** sichtbar wurde. Mechanismen stehen in den Commit-Bodies
(`git log 75b2ca1..HEAD`); hier nur, was git nicht trägt.

### Die Lehre, falls du nur eine Zeile liest

⑦ war eine Stunde alt, als der erste echte Gebrauch einen Fehler zeigte, den kein Check hatte:
die Gate-Zeile stand **18 Minuten am Stück auf ⚠** auf einer ruhigen Maschine (533 von 567 Zeilen
eines Beobachter-Logs). Ursache: `e2e-stage.sh:38` gibt den Lock absichtlich nicht frei, also
hinterlässt JEDE fertige Suite eine Leiche — der Ruhezustand war der Alarmzustand, und die eine
echte Anomalie (lebender Halter, der zu lange hält) trug denselben Ton wie ein gesunder Lauf.
Bauen → landen → **benutzen** → korrigieren, innerhalb einer Stunde. Genau dafür sind ① und ⑦ da.

### Buchhaltungs-Lücke, die beim Ledger-Lesen auffallen wird

**Die sieben Commits ab `14dafdc` sind DIREKT auf main entstanden, im Haupt-Checkout, ohne Lane.**
Konsequenz, die man kennen muss, bevor man den Zahlen glaubt:
- `git notes --ref=fleet/land` ist für alle fünf **leer** — die Integrations-Provenienz kennt sie nicht.
- `lane-outcomes.jsonl` hat für sie **keine Rows** (der Ledger endet bei `fleet/260804154311-a0c8`).
- `post-land-audits.jsonl` ebenso — der Tier-2-Audit feuert nur nach einem Land.
- `undo-land` greift für sie nicht; der Rückweg ist `git revert`.

Ersatzweise lief vor JEDEM dieser Commits die volle Kette von Hand (`pins` + tsc + build +
clean-review + security + claude-gate) **plus** `./e2e-isolated.sh` als Stufe 2 auf demselben Baum,
und für Client-only-Teile ein gerenderter Frame im Browser — keine Suite sieht eine CSS-Farbe.
Ob das der richtige Weg ist, ist eine **offene Owner-Entscheidung**: die CLAUDE.md beschreibt nur
den Lane-Weg und sagt nichts über Direkt-Commits aus dem Haupt-Checkout.

### Operativ gelernt (kostet sonst wieder eine Stunde)

- **Suiten-Reihenfolge ist eine Fehlerquelle.** `./e2e-isolated.sh` als FÜNFTE Suite direkt hinter
  vier anderen fiel mit dem dokumentierten steward-send-cap-Paar (429 erwartet, 409 bekommen,
  `docs/verify-tiering.md:233-238`, lastabhängig). Derselbe Baum seriell wiederholt: ALL PASS.
  Danach isolated ZUERST gefahren → kein Rot mehr. Wer die Kette am Stück fährt, provoziert das.
- **`bun run build` ist ein Deploy.** Es schreibt `public/app.js`, und der Live-Server serviert das
  sofort — auch aus einem uncommitteten Baum. Genau so ging heute unbeabsichtigt Client-Code live.
  `bundleStale` merkt das NICHT: es vergleicht mtimes, nicht Commits.
- **`.playwright-mcp/` habe ich versehentlich gelöscht** (308 Artefakte seit 18.07., gitignored, von
  nichts referenziert). Rückholbar aus dem TM-Snapshot `2026-08-04-220316` mit sudo; Owner hat noch
  nicht entschieden, ob es die Mühe wert ist.

### Owner-Entscheide dieser Session

- **Dispatcher bleibt AUS** (`fleet.json` trägt `"dispatch": false`). Die CLAUDE.md behauptete zwei
  Sessions lang „AN" — korrigiert. Der Hand-Knopf läuft unabhängig weiter.
- **Picker-Filter: „sagen, was fehlt"** — gewählt aus vier Optionen; nicht „nur den Baum filtern",
  nicht „Default aus", nicht „so lassen".
- **Zwei Picker-Beobachtungen am Live-Board**, beide bestätigt und behoben: das rechte Pane
  widersprach dem Baum (40 vs. 200 Deckel auf denselben Ordner), und der Pfad stand in #777.

### Was als Nächstes ansteht

1. **② Server-first Sync** — der nächste Schritt des Merge/Land-Programms, unverändert.
2. ~~**`isServerCode` ist zu grob**~~ — **ERLEDIGT in Session 24, `9d3fba8`**, gelandet und
   deployed (bootHead == HEAD, bundleStale false). Dritte Allowlist: `e2e/**` + fünf
   `fleet-e2e*.ts`-Runner, namentlich statt per Präfix, und der Check in `e2e/deploy-facts.ts` §2b
   fährt auf frischem Boot, weil eine „zählt-nicht"-Aussage nur in einer sonst leeren Range
   beweisbar ist. Rest-Fehlalarm-Klasse, bewusst offen gelassen und im Body benannt:
   **Shell-Skripte zählen weiter als Server-Code** — `watchdog.sh` wird von einem srv-Restart gar
   nicht eingesammelt, also hat kein `.sh` hier eine einzige ehrliche Antwort.
3. **Maschinenhygiene — OFFENE OWNER-ENTSCHEIDUNG, nichts wurde gelöscht.** Gemessen am Ende
   dieser Session: **124 verwaiste tmux-Sockets, davon 119 nachweislich tot** (kein Server dahinter;
   der eine lebende ist `claudefleet`), und **6 Instanzverzeichnisse mit 70 MB**, die rote Läufe
   "kept for inspection" stehen liessen — eines davon aus dieser Session. Wächst mit jeder Session
   (85 heute früh → 124 abends). Zwei Wege: einmal aufräumen (sicher, tote Sockets sind
   Dateileichen) ODER `e2e-stage.sh` reapt tote `fleettest*`-Sockets beim Start mit, wie es den
   Lock schon reapt — stoppt das Wachstum, fasst aber Suiten-Klempnerei an.
4. Queue: `2e9ed996` (Terminal — Farbe, Robustheit, Scrollback) ist die einzige offene Task.
5. **Nicht bauen, bewusst zurückgezogen:** der Stundendeckel auf `verify_intent`-Audit-Zeilen. Er
   würde ausgerechnet dann Zeilen wegwerfen, wenn eine Lane zwischen Phasen springt — im
   interessantesten Fall, und die Fläche existiert genau dafür. Begründung im Body von `aef612e`.

---

## Session 22 (2026-08-04, Lane `fleet/260804150902-7c66`, parallel zu 21): das Merge/Land-Programm

Owner-Auftrag wörtlich: das Worktree/Land-System „wirkt eher instabil … nur einen land
rückgängig … nicht so als könnte man einfach worktree's aufsetzen und die später clean
resolven — denk gut nach wie und ob man das ganze besser aufsetzen könnte". Diese Session
hat das Programm hergeleitet, adversarial geprüft (zwei eigene Begründungen dabei widerlegt)
und Scheibe ① gebaut. Mechanik im Commit-Body (`feat(drift): eine Lane sieht, …`).

### Die Diagnose, in drei Zahlen (lane-outcomes.jsonl, 80 Rows, selbst tabuliert)

- 41/63 Lands sahen ≥1 anderes Land innerhalb ihrer Lebenszeit → **Staleness ist häufig**.
- Nur 4/64 Lands hatten je einen Konflikt; `repairRounds` war in ALLEN 80 Rows 0 → die
  Kosten der Staleness sind **Drift, nicht Konflikt**; der Repair-Loop hat nie gefeuert.
- These, die alles ordnet: **Integration ist heute ein Ereignis (zur Land-Zeit) statt ein
  Prozess.** Konflikte löst dann ein kontextloser Wegwerf-Resolver; sichtbar ist vorher nichts.

### Das Programm (Reihenfolge beschlossen, Owner-bestätigt)

1. **① Drift-Surface — GEBAUT, diese Lane.** `laneDrift()` + `GET /api/self/drift`
   (self-token, slot-gebunden): behind / wouldConflict (merge-tree-Probe, advisory — Merge
   simuliert, Land rebased, Mengen können abweichen) / conflictFiles / overlap / otherLanes
   / dirty. Board-Projektion = eigene Folge-Scheibe, Platzierung mit Owner festnageln.
2. **⑦ Verify-Queue, v1 = NUR Sichtbarkeit** — Brief liegt fertig in
   `briefs/verify-queue-2026-08-04.md`. Motivation: heute starb ein isolated-Lauf dieser
   Lane mit exit 144 (Killer unbekannt, Log leer), während Session 21 zeitgleich ihr Gate
   fuhr; Wrapper koordinieren blind über den mkdir-Mutex. Erst sehen, dann besitzen.
3. **② Server-first Sync**: der Server fährt den Script-Rebase in der Lane (tryScriptRebase-
   Muster), nur bei Konflikt wird die Lane-Session geweckt — Autor löst mit Kontext.
   Konflikt-Fall setzt deterministisch ein Review-Flag (Server traf die Konflikte selbst).
4. **③ oxlint error-level** ins Gate (geprüft: 1.77.0 läuft, 27 Warnings / 0 Errors auf
   server.ts+src/+e2e/ — sofort grün) und **④ Revert-Undo** für JEDES Land aus den
   Provenienz-Notes (`mainBefore..mainAfter` linear, revertierbar; Fallback Outcome-Row).
5. **Graphify-Stecker**: `FLEET_OVERLAP_CMD` als Provider-Kommando (Default = interner
   git-Datei-Overlap), sobald ⑦/② stehen — Symbol-Ebene statt Dateinamen.

Adversarial geprüft und GEKIPPT (nicht wieder vorschlagen): Lint als Gate-*Beschleuniger*
(tsc ist mit 1,5 s längst die Fail-Fast-Stufe); Verify-Memo als eigene Säule (confirm-land
re-verifiziert absichtlich nicht — markiert stale; Rest-Nutzen reist als Miniatur mit ②);
merge-tree als Review-Flag-Quelle (Vorhersage ≠ Wahrheit — der Server-Rebase-Versuch ist die
Wahrheit). rerere und Hard-Block bleiben verworfen wie dokumentiert.

### Was der Owner von Hand tun muss (Reihenfolge) — ✅ ALLE VIER ERLEDIGT in Session 23

*Historie, nicht offene Arbeit. Punkt 3 wurde beim Ausführen korrigiert: die vorgeschlagene Zeile
benutzte `$FLEET_HOST`, das es in einer Lane-Pane nicht gibt (gemessen: nur `FLEET_SELF_TOKEN` +
`FLEET_SELF_SLOT`), sie wäre zu `http://:8790/` expandiert. Steht jetzt mit literalem Host in der
CLAUDE.md, samt `wouldConflict: null` = UNKNOWN.*

1. Diese Lane landen (⏫) — Code + dieses Handoff + der ⑦-Brief landen zusammen.
2. Deploy: `tmux -L claudefleet kill-session -t srv`, dann Health-Check. Erst danach
   existiert `/api/self/drift` live. (Kein Client-Build nötig — src/ unberührt.)
3. **Eine Zeile in die CLAUDE.md des Haupt-Checkouts** (gitignored, landet nie aus einer
   Lane), Abschnitt Lane-Disziplin: *„Vor dem Done-Report Drift prüfen:
   `curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://$FLEET_HOST:8790/api/self/drift`
   — bei `wouldConflict:true` erst selbst auf main rebasen, verifizieren, dann fertigmelden."*
   Ohne diese Zeile benutzt keine Session den Endpoint — er wurde gebaut, damit die Session
   es selbst sieht (Owner-Vorgabe wörtlich: „am ende sollte es die session selbst sehen").
4. ⑦-Lane spawnen mit `briefs/verify-queue-2026-08-04.md` als Brief.

### Beobachtungen, die git nicht trägt

- Der §1-Pre-Auth-Pin (e2e/security.ts) fing die neue Route wie designed — einziger Rot im
  ersten Durchlauf, Allowlist-Zeile ist die bewusste Antwort. Der Pin funktioniert.
- Der verworfene erste Suitenlauf: exit 144 unter Doppel-Session-Kontention, nach
  §11.7 seriell wiederholt → finaler Baum 1068 PASS / 0 FAIL. Kein neuer Flake-Eintrag.
- Diese Lane hat ihr eigenes Rezept angewandt: vor dem Handoff-Edit selbst auf main
  rebased (6 Commits, Session 21 war gelandet), merge-tree-Probe vorher exit 0, Rebase
  konfliktfrei, tsc+build auf dem kombinierten Baum grün.

---

## Session 21 (2026-08-04): die Queue wird ein Werkzeug, und graphify zieht ein

4 Feature-Commits `f172053` + `27a9576` + `91c22ec` + `ec66a96`, alle deployed und live
nachgeprüft (bootHead == HEAD == `ec66a96`, behind 0, bundleStale false). Mechanismen in
den Bodies — hier nur das Residuum.

### Nachtrag (zweite Runde derselben Session, auf Owner-Zuruf)

- **`91c22ec` — Hand-Knöpfe**: „▸ start lane" (POST /api/tasks/:id/dispatch — sofort, ohne
  Tick, am Deckel vorbei, ohne Master-Stop; claude-alive-Gate gilt IMMER) und status
  „archived" (Regal; restore → pending; archive-on-pending-steward schreibt „dismissed").
  Tick und Knopf teilen den Kern (dispatchTask/briefAndSend) — claude-gate beweist die
  tote-claude-Eigenschaft für beide Wege (branch 6 + 6b).
- **`ec66a96` — Per-Task-Repo**: `Task.repo` (owner-only; Intake/Steward hart null), Tick
  und Knopf spawnen aus `task.repo ?? DISPATCH_REPO`, Deckel zählt pro Ziel-Repo, Composer
  hat das Repo-Feld (Pins/Recents-Datalist). Der Ein-Repo-Dispatcher war der vom Owner
  benannte Fehler („das wäre genau der fehler den ich meine").
- **Im Browser GEDRÜCKT** (Wegwerf-Instanz, Playwright, Session-19-Lektion): start lane →
  sent + Lane im Task-Repo + kompilierter Brief in der Pane; archive → Archiv-Gruppe →
  restore → pending; Bad-Repo → abgelehnt, Text bleibt im Composer.
- **graphify global** (`~/.claude/skills/`, settings.json nachweislich unangetastet) +
  **post-commit-Hook im Fleet-Repo** (`.git/hooks/post-commit`, baut den Graph pro Commit
  neu; die vom Installer erzeugte `.gitattributes` liegt jetzt in `.git/info/attributes`).
  Der lokale PreToolUse-Guard (`.claude/settings.json`, gitignored) nagt advisory in jeder
  Fleet-Session — wen es stört: Datei löschen, der Skill funktioniert ohne.
- **Wegwerf-Instanz-Falle, neu gelernt: `. ./e2e-stage.sh` NIMMT DEN SUITE-LOCK** („Sourcing
  this file IS starting a suite") — für UI-Instanzen schlicht Top-Level-`*.ts` + `src/` +
  `public/` + `package.json` kopieren und `node_modules` symlinken, kein stage_instance.
- Beobachtet, nicht angefasst: die Slot-4-Lane fuhr währenddessen ihre eigene
  `e2e-isolated`-Verifikation (hielt den Lock korrekt).

### Was in FLUG ist (das Erste, was die nächste Session wissen muss)

1. **Slot 2 fährt die Picker-Lane** (`fleet/260804154311-a0c8`, Task `9fc24684`) — vom
   NEUEN Dispatcher gespawnt und mit kompiliertem Brief gestartet (der injizierte Prompt
   endet mit `/sharpen3`; Rohtext-Fallback wäre ohne). Scope ist Owner-Entscheid, wörtlich:
   **„Nur linker Baum"** — Suche, die eingeklappte Ordner findet; versteckte Ordner;
   ehrlicher 200er-Deckel. Das rechte Contents-Panel ist AUSDRÜCKLICH nicht im Scope.
   Beim Fertig-Werden: Review + Land bleibt Owner-Hand (Auto-Land-Entscheid: „noch nicht,
   erst echte Läufe ansehen"). Nach dem Land läuft der Tier-2-Audit → Maschine ruhig halten.
2. **Task `3389865a` (pending)**: stewardTaskView zeigt nach Slot-Recycling die falsche
   Gründungs-Task (live doppelt belegt auf Slot 2 beobachtet; der Code-Kommentar
   „find-by-slot is safe" ist falsch, weil landLane `t.slot` nie abräumt). Befund,
   Blast-Prüfauftrag (laneSignalView/auto-③!), Fix-Skizze und Verify stehen IM Task-Text.
3. Slot 4 (`imprv worktree/landing`, fleet-Lane von 15:09) war vor der Session da — fremde
   Arbeit, nicht angefasst.

### Owner-Entscheide dieser Session

- **Picker**: nur linker Ordnerbaum. **graphify**: Code-Graph jetzt; der Erfahrungs-Korpus
  (Transkripte/Outcomes, BACKLOG 17) bleibt ausdrücklich separates Folgethema.
  **Auto-Land**: noch nicht — erst echte Dispatcher-Läufe ansehen.

### Was live ist

- **Queue-Umbau (`f172053`)**: `kind: lane|note` (Steward default note, nie dispatcht,
  Opt-in-Claim), Kapazität zählt nur DISPATCH_REPO-Lanes (realpath-kanonisiert),
  Warte-Notes auf blockierten Rows, Compile-at-dispatch via Enhancer. **Live bewiesen**:
  der Dispatcher nahm `9fc24684` beim ersten Tick, obwohl eine Fremd-Repo-Lane (Slot 8)
  mit dem alten repo-übergreifenden Zähler 2/2 blockiert hätte — der Stau, den Fix 1
  behebt, bestand real auf der Live-Flotte.
- **graphify (`27a9576`)**: 2073 Knoten/3666 Kanten in Sekunden, LLM-frei. Skill getrackt
  (reist in Lanes), `graphify-out/` + `.claude/settings.json` gitignored (der PreToolUse-
  Guard ist advisory, ~50 ms, und trägt den Accountnamen im Pfad — darum lokal-only).
  Nach Code-Änderungen: `graphify update .` (Sekunden). Nagelprobe: `explain tickDispatch`
  kannte runEnhance/inDispatchRepo sofort; `affected canDeliver` = exakt die drei Sites.
- **CLAUDE.md-Dispatcher-Absatz neu geschrieben** (Dispatcher ist AN; live gilt die
  Watchdog-Zeile `FLEET_DISPATCH_MAX_LANES=2`, nicht der server-Default 3).

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **„Steward-Notes bei Promote mit 409 abweisen" war mein erster Entwurf und ist FALSCH** —
  `e2e/steward-outcomes.ts` pinnt Owner-Promote als ok + propose-outcome („the meta-gate",
  P-1a-Anker). Die Suite ist die Spec; gebaut ist Dispatcher-Skip + laute Standing-Note.
- **Gate-Kette 2 fing einen ECHTEN Regress von mir** (claude-gate branch 6): das
  Compile-Await saß vor dem Post-Spawn-Gate — ein toter claude hätte den Requeue um den
  Worker-Timeout verzögert. Antwort: Gate vor Await, zweites Gate direkt vor Send, und der
  fakeenh-Stand-in auch im Gate-Harness. Wer die Gate-Ordnung in tickDispatch anfasst,
  liest zuerst den Kommentar dort.
- **createWorktree speichert das Symlink-aufgelöste git-Toplevel** (`/tmp`→`/private/tmp`)
  — ein naiver String-Vergleich mit `FLEET_DISPATCH_REPO` zählt NULL Lanes und schafft den
  Deckel lautlos ab (`inDispatchRepo`, canon+raw).

### Nicht verifiziert — und niemand sollte es behaupten

1. Die Live-Latenz des echten Enhance-Workers pro Dispatch (der kompilierte Prompt kam
   heute innerhalb von ~40 s; nicht gemessen, nicht gepinnt).
2. Der Output der Picker-Lane (läuft noch — nichts davon ist reviewt oder gelandet).
3. graphify: Community-Labeling (LLM), Doc-/Semantik-Pass, MCP-Server — bewusst NICHT
   gebaut; der Graph altert mit Code-Änderungen, bis jemand `graphify update .` läuft
   (die CLAUDE.md-Regel sagt es jeder Session, erzwungen ist es nicht).

---

## Session 20 (2026-08-04): die drei Plätze, und was daran hing

3 Commits, `647f4a7`..`a4be955`, alle deployed und live nachgeprüft. Die Mechanismen stehen in
den Bodies — hier nur, was git nicht trägt.

### Das Erste, was die nächste Session tun sollte

**Slot 2 ist eingerichtet und läuft, aber NICHT öffentlich — und die zwei fehlenden Schritte sind
beide Owner-Sache, weil sie nach draußen reichen:**

1. `cloudflared tunnel route dns <tunnel> containerTwo.<domain>` — der DNS-Record.
2. `./guest-ctl.sh renew 2` — öffnet Fenster und Tür.

Vorher: lokal erreichbar auf `127.0.0.1:8792` (antwortet 200), im Panel als `no hostname
configured`/`closed`. **Die Namensfrage des Owners ist NUR halb umgesetzt:** Slot 2 heißt
`containerTwo.<domain>`, Slot 1 heißt weiterhin `container.<domain>`. Ihn auf `containerOne.`
umzubenennen **bricht den bereits verteilten Invite-Link** (Hostname steckt in DNS, in
`FLEET_ALLOWED_HOSTS` des Containers und in dem, was jemand schon bekommen hat) — deshalb nicht
getan. Owner-Entscheid, nicht Versehen.

### Was live ist und wovon die nächste Session wissen muss

- **Die Gast-Sektion ist eine Kontroll-Fläche**: drei Zeilen (ein Platz je Zeile, ob er existiert
  oder nicht), darunter EIN Detailblock für den gewählten. Die Knöpfe folgen dem gewählten Slot,
  und jede Aktivierung ist die Vorbedingung von `guest-ctl.sh` selbst.
- **`start` hat drei Gesichter**: `▸ start` · `▸ re-open` · `↻ re-apply`. Wer daran etwas ändert,
  liest zuerst die Korrektur unten — die Ruhe-Beschriftung war das Problem, nicht die Quittung.
- **Slot 1 ist migriert**: `/home/fleet/.claude` liegt auf `fleet-guest-claude`. Damit überleben
  Credential und Transkripte einen `docker rm`. Backups der Migration liegen als
  `~/.claude-fleet-guest/1/claude-backup-*.tar` (zwei Stück, 0600) — sie können weg, wenn der Gast
  eine Weile gut läuft.
- **`guest-ctl.sh` hat drei neue Verben**: `provision <slot> [hostname]`, `export <slot>
  [work|all]`, `import <slot> <tar>`. `status` trägt zusätzlich `claudeVolume` (Boolean).
- **`guest-claude-volume.sh` ist für NEUE Slots unnötig** — `provision` legt `.claude` von Anfang
  an auf ein Volume. Das Skript bleibt für Altbestand und dokumentiert den Mechanismus.
- **Beide Gäste haben `claudeAuth: false`.** Owner-Entscheid dieser Session: sich selbst einloggen
  statt einen Token zu injizieren (Begründung unten).

### Was NICHT verifiziert ist — und niemand sollte es behaupten

1. **Ob eine echte Claude-Session in einer echten Pane im Container läuft.** Unverändert die größte
   Lücke des Strangs, steht seit Session 18 hier. Alles Grüne fährt Shell-Stubs.
2. **`export`/`import` gegen einen ECHTEN Gast.** Bewiesen ist ein Round-Trip gegen einen
   Wegwerf-Gast (Slot 99, eigene Volumes, danach restlos entfernt), 17/17.
3. **Der exponierte Pfad von `provision`.** Mit Hostname geschrieben und geprüft, aber DNS + `renew`
   sind nie durchlaufen — d. h. „Slot 2 ist wirklich öffentlich erreichbar" ist unbewiesen.
4. **Das Board ist weiterhin desktop-only** (`renderBoard` kehrt bei `isMobile()` sofort zurück).
   JEDE Kontrolle dieser Session ist auf dem Handy unsichtbar. Bewusst nicht angefasst.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **`--user root` ist im Gast-Image WIRKUNGSLOS.** Der Entrypoint fällt auf uid 1000 zurück, auch
  wenn der Run root verlangt. Gemessen: `docker run --user root … id` → `uid=1000(fleet)`, mit
  `--entrypoint sh` → `0`. Wer dort einen Wegwerf-Container braucht, der schreiben oder chownen
  muss, MUSS den Entrypoint umgehen. Das hat die Migration beim ersten echten Lauf gekillt.
- **Ein grüner Round-Trip-Test kann aus dem falschen Grund grün sein.** Der erste bewies nichts,
  weil er nur in Volumes zurückspielte, die es schon gab und die `1000:1000` gehörten. Der Fall,
  der zählt, ist ein FRISCHES, root-eigenes Volume.
- **Die Quittung am Start-Knopf war NICHT das Problem.** Zwei mechanische Erklärungen geprüft und
  beide falsch: sie malt zuverlässig, auch in data-saver mit 10-s-Board-Tick, und eine persistente
  Notiz überlebt sie. Der Defekt war die Ruhe-Beschriftung, die auf einem laufenden Gast weiter
  „start" versprach.
- **Der alte Chip-Picker war kaputt, nicht nur eng.** `guestSel` wurde bei JEDEM Render auf einen
  existierenden Slot geklammert, also war ein Klick auf Platz 2/3 rückgängig, bevor er malte, und
  der Erklärtext war unerreichbarer toter Code. Bewiesen durch Bau des Vor-Änderungs-Bundles.
- **`.claude` lag NICHT auf einem Volume**, also warf `▸ give claude token` die Konversations-
  historie des Gastes weg. Der Text im Kasten sagte „its volumes … do not change" — wahr und
  irreführend. Für Slot 1 behoben, für neue Slots strukturell zu.
- **Das Image hat GNU tar 1.34, und sein Entrypoint-Banner geht auf STDERR.** Auf stdout hätte er
  jedes exportierte Archiv beschädigt. Beides gemessen, bevor darauf gebaut wurde.
- **`~/.claude/.credentials.json` ist NICHT die Credential, die man einem Container gibt.**
  `claudeAiOauth.accessToken` ist kurzlebig (der auf Platte war beim Messen bereits abgelaufen) und
  wird von Claude Code still erneuert; ein Container tut das nicht. Injiziert ergäbe das einen
  Gast, der nach Stunden in jeder Pane stirbt.
- **Prüfstand-Falle:** `labels.py` braucht einen Stub, der beim `start` die Welt WIRKLICH verändert
  (`AFTER=`), sonst bleibt die Beschriftung korrekt auf „start" und der Fehlschlag liest sich wie
  ein Regress. Einmal passiert; die Vorbedingung wird jetzt geprüft und als SKIP gemeldet.

### Key Decisions (mit Grund)

- **Ein leerer Platz bekommt dieselbe Karte mit toten Kontrollen, keinen anderen Bildschirm** — das
  ist, was die drei Plätze als EINE Fläche lesbar macht. Preis, den der Owner sofort gefunden hat:
  tote Knöpfe laden zum Drücken ein. Deshalb `provision`.
- **`✂ cut` bleibt sichtbar, wenn die Tür schon zu ist** (deaktiviert statt weg): ein Knopf, den man
  in Eile sucht, darf nicht wandern.
- **`re-apply` statt `repair`**, weil der Hook nichts repariert — colima und docker sind no-ops, und
  was wirklich passiert ist `resume`: Ingress-Regel neu schreiben, Ablauf-Timer neu installieren.
- **Verlaufs-/Quittungswörter werden beim PRESS festgehalten**, nicht beim Render: bis die Quittung
  malt, hat die Aktion den Zustand verändert, aus dem sie sonst abgeleitet würde.
- **`export` hat zwei Scopes**, und der Unterschied ist genau „darf ich diese Datei weitergeben":
  `work` ist das Projekt-Volume, `all` trägt Credential und Transkripte und ist ein Backup.
- **`provision` hört beim DNS-Record auf.** Ein Skript, das öffentliche Namen erzeugen kann, erzeugt
  sie irgendwann versehentlich.
- **Die Rezeptur wird aus einem bestehenden Slot ABGELEITET**, nicht aufgeschrieben — Image, Caps,
  Memory, Tunnel-Config sind Deployment-Tatsachen und diese Datei ist öffentlich.
- **„Use my own token" wurde VERWORFEN** (Begründung oben). Stattdessen: selbst einloggen — das
  erneuert sich selbst und überlebt seit der Migration einen Recreate.
- **opencode als Gast-Option: vertagt, nicht verworfen.** `FLEET_CMD` ist bereits eine Variable, ein
  Gast mit `FLEET_CMD=opencode` liefe heute. Aber alles Transkript-Abgeleitete hängt an
  `~/.claude/projects` (`server.ts`, grep `projDir`) und würde STILL degradieren — leere Outline,
  „no transcript" — was wie kaputt aussieht statt wie „nicht zutreffend". Fehlt: ein Begriff „welcher
  Agent läuft hier" in der Status-Schicht.

### RAM, weil die Frage kam und die Antwort nicht offensichtlich ist

**Nichts ist reserviert.** `--memory 1g` ist eine Decke, `MemoryReservation=0`, und die VM-RAM wird
demand-paged. Die bindende Grenze ist NICHT der Container, sondern die VM: **1,91 GiB**, davon
gemessen 526 MB benutzt. Drei Gäste à 1 GiB Limit sind darin **1,6× überbucht** — sie können ihre
Limits nicht alle einlösen. Wer Slot 3 wirklich will, dreht zuerst an der VM-Größe, nicht am
Container-Limit.

### Offene Owner-Entscheide

1. DNS-Record + `renew 2` für Slot 2 (siehe oben).
2. Slot 1 auf `containerOne.` umbenennen? Bricht den verteilten Invite-Link.
3. Slot 3 — braucht erst die VM-Größe.
4. opencode.
5. `export`/`import` einmal gegen einen echten Gast fahren, bevor sich jemand darauf verlässt.

---

## Session 19 (2026-08-03): der Gast bekommt eine Konsole

4 Commits, `b6639c2`..`d67c819`, **alle deployed und live nachgeprüft** (`bootHead == HEAD`,
`bundleStale:false`, Site 200, 8 Sessions haben die Restarts überlebt). Die Mechanismen stehen
in den Bodies — hier nur, was git nicht trägt.

### Das Erste, was die nächste Session tun sollte

**Der Owner hat den nächsten Auftrag schon benannt: die Kontroll-Fläche rechts in der Info-Karte
ordnen.** Der Brief liegt fertig unter `briefs/info-card-controls.md` — er ist gemessen, nicht
geraten (84 Buttons, 7 Sektionen, 5886 Zeilen `src/client.ts`), und er nennt die drei Fallen, an
denen ein Umbau dort sonst stirbt. **Nicht neu entwerfen — lesen.** Die eine offene Owner-Frage
steht am Ende des Briefs und ist blockierend, weil sie die Form entscheidet.

### Was live ist und wovon die nächste Session wissen muss

- **`FLEET_GUEST_CMD` ist seit dieser Session in `watchdog.sh`** und zeigt auf `guest-ctl.sh`.
  Damit existiert die Gast-Sektion in der Info-Karte. Variable weg = Feature weg (Routen 404,
  keine Knöpfe). Aktiv wurde sie durch `launchctl kickstart` **vor** dem srv-Restart — die
  umgekehrte Reihenfolge respawnt srv mit der alten Zeile, und dann fehlt die Variable.
- **Gäste sind SLOTS**, ein Verzeichnis je Gast unter `~/.claude-fleet-guest/<n>/`. Der bestehende
  Gast wurde nach `1/` migriert (gleiche Deadline, gleicher Token, Container unberührt). Slot 2
  und 3 existieren NICHT: sie brauchen je einen Hostnamen mit DNS-Record. **Der DNS-Record ist
  bewusst kein Knopf** — er reicht nach außen, also Owner-Entscheid.
- **Der Live-Gast hat weiterhin KEINE Claude-Credential** (`claudeAuth:false`, live geprüft). Sein
  Dashboard öffnet, Sessions starten, `claude` stirbt in jeder Pane. Der Knopf dafür existiert
  jetzt (`▸ give claude token`), benutzt wurde er nie.
- **Ein Ingress-Marker in zwei Formen.** Die Ein-Gast-Version schrieb einen Marker ohne Slot;
  `del_rule` erkennt beide. Wer das je vereinfacht, baut einen Panikknopf, der „already cut"
  meldet, während die Tür offen steht.

### Was NICHT verifiziert ist — und niemand sollte es behaupten

1. **Ob eine echte Claude-Session in einer echten Pane im Container läuft.** Unverändert die
   größte Lücke des Strangs (steht seit Session 18 hier). Alles, was grün ist, fährt Shell-Stubs.
   Der Token-Knopf ist genau der Weg, das endlich zu testen.
2. **Der Recreate-Pfad gegen einen ECHTEN Container.** `claude-token` ist nur gegen den
   Stand-in-Hook gelaufen. Was er tut, ist `docker rm -f` + `run` aus der eigenen Inspect-Config —
   die Volumes überleben, aber bewiesen ist das hier nicht.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **Der Steward-Send-Zweier ist KEIN Regress und keine offene Adjudikation mehr.** Vier Läufe
  entscheiden es: derselbe Baum einmal grün, zweimal rot, und **clean HEAD `9d7b2cb` ohne eine
  Zeile dieser Session fällt identisch**. Ein Check, der auf einem Baum passt UND fällt, und ohne
  unseren Code fällt, ist ein Rennen. Mechanismus auf Zeilen festgenagelt: `server.ts:5300`
  (Idle-Gate, 409) läuft VOR dem Episoden-Cap `:5314` (429), und `e2e/steward-core.ts:243` sendet
  direkt nach dem Paste — der Check muss das pipe-pane-Echo schlagen. Der Geschwister-Check
  `:261` settelt deshalb neu und sagt es im Kommentar. Test-seitige Fragilität, Fix kostet ~60 s
  pro Lauf, **Owner-Entscheid, nicht genommen.** Damit ist auch Session 18s roter Tier-2-Audit auf
  `6081449` erklärt: dieselbe Signatur.
- **Eine Falle im Harness, die 12 fremde Checks rot machte und meine war:** `restart.ts` pflanzte
  `FLEET_REPO_DIR` nur in die SERVER-Spawn-Zeile, `harness.restartSrv()` baut diese Zeile aber aus
  `process.env` neu. Jedes Modul, das danach srv neu startet, verlor die Variable — und
  deploy-gap/bundle-staleness lasen `null`, was wie echte Fehler aussieht. Behoben an der Quelle
  (`restart.ts` pflanzt jetzt zusätzlich in `process.env`), Falle bei `restartSrv` dokumentiert.
- **Zweimal habe ich „der Knopf ist gefixt" behauptet, ohne ihn zu drücken.** Beim dritten Mal
  habe ich ihn in einem echten Browser gegen eine Wegwerf-Instanz geklickt und die Label-Folge
  abgetastet: `… starting → ✓ started → ▸ start`. **Und die Harness hat zuerst selbst gelogen** —
  2,5 s Wartezeit gegen ein Panel, das auf dem 3-s-Board-Tick malt. Sie pollt jetzt.
- **`no-store` rettet keinen offenen Tab.** `/` und `/app.js` liefern `Cache-Control: no-store`,
  ein Reload holt also immer frischen Code — ein Tab, der nie neu geladen wurde, fährt den alten
  Bundle ewig weiter. Genau das war der erste „der Knopf tut nichts"-Report.

### Key Decisions (mit Grund)

- **`cut` behält die Deadline, `renew` verschiebt sie** (Owner, wörtlich: *„I think it should keep
  the deadline, but some button to reset the deadline would also be very good"*). Ein Panikknopf,
  der die Exposition still verlängert, wenn man ihn zurücknimmt, ist die falsche Form. `resume`
  verweigert ein abgelaufenes Fenster — sonst wäre es ein stilles `up` und die Schranke Beiwerk.
- **Die Credential geht auf STDIN, nie in argv.** argv ist für die Laufzeit des Aufrufs in `ps`
  weltlesbar. Als Messung geprüft, nicht als Behauptung: der Stub schreibt argv UND stdin mit.
- **Der Invite ist eine eigene Route mit eigenem Verb.** `status` wird bei jedem Kartenöffnen und
  nach jeder Aktion gelesen; ein Token, das dort mitreist, ist ein Token in jedem Log.
- **`claudeAuth` ist ein BOOLEAN in `status`, nie der Wert** — die Frage „hat der Gast überhaupt
  eine Credential" ist Betriebszustand, der Wert ist es nicht.
- **Ein Timer für alle Slots** (`enforce-all`) statt N launchd-Labels: ein Fenster, dessen
  Enforcer nie installiert wurde, ist genau der Fehler, gegen den das Skript existiert.
- **Status bleibt aus dem 2-s-Poll draußen** (jeder Aufruf spawnt Subprozesse), und das Panel sagt
  deshalb `checked HH:MM:SS — not polled`, statt Aktualität zu suggerieren.

---

## Session 18 (2026-08-03): der Container-Strang

4 Commits, `1bbc9ee`..`d2d4910`. **Alle Mechanismen stehen in den Bodies** — hier nur, was
git nicht trägt.

### Das Erste, was die nächste Session tun sollte

**Zwei Dinge, die live offen sind, in dieser Reihenfolge:**

1. **`bundleStale: true`, srv ist 3 Commits zurück** (gemessen 14:15). Der Picker-Land
   `6081449` fasst `src/client.ts` + `public/index.html` an — der Client-Teil davon ist
   **unsichtbar**, bis jemand `bun run build` im Haupt-Checkout fährt. Der Server-Restart
   (`tmux -L claudefleet kill-session -t srv`) ist die zweite Hälfte und Owner-Entscheid.
2. **Der Tier-2-Audit auf `6081449` ist ROT** — Signatur aus Session 16, siehe unten.
   Adjudikation steht aus.

### Die zweite Instanz einer benannten Nicht-Determiniertheit

Session 16 notierte einen Zweier-Fail im Steward-Send-Episoden-Limiter und schrieb dazu
ausdrücklich: *„Eine Beobachtung, keine sechste Flake-Familie — dafür braucht es mehr als
eine Instanz."* **Die zweite Instanz ist da**, byte-identisch:

    FAIL  a second send of the same kind×slot within the episode window is 429  (409)
    FAIL  a capped send is audited (steward_send_capped)

Was sie belastet: der auslösende Diff ist **43 Zeilen Picker/Client** (`public/index.html`,
`src/client.ts`) und kann den Steward-Send-Pfad nicht erreichen — dieselbe Konstellation wie bei
der fünften Familie am 2026-08-01. Der Land-Gate war grün (`verified: true`), nur Tier 2 ist rot.

**Die Hausregel gilt trotzdem: erst denselben Baum seriell wiederholen**
(`docs/verify-tiering.md` §11.7), Maschine ruhig. Grün → bewiesen, und es gehört als **sechste
Familie** nach §11, nicht in CLAUDE.md, damit die Zahl nicht an zwei Stellen altert. Identisch
rot → echter Regress im Limiter, keine Flake.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **„Die Lane ist beim Landen gescheitert" — nein.** `fleet/260803082354-3ec9` ist sauber
  gelandet (`disposition: landed`, `verified: true`, `mainAfter: 6081449`). Rot ist der
  Tier-2-Audit **danach**. Zwei verschiedene Dinge; die Outcome-Row sagt es eindeutig.
- **Mein „≥ 4 GB RAM für eine Gast-Flotte" war deutlich zu hoch.** Es kam aus „25 Prozesse,
  1,2 GB" — davon ~20 winzige Hilfsprozesse. Echte Sessions kosten im Schnitt **110 MB**;
  Fleet-Boden im Container **23,6 MB**, pro Slot **~8 MB**, vier Slots 55 MB.
- **Eine colima-VM reserviert ihre Zuteilung NICHT.** Die 2-GiB-VM, die die volle Suite fuhr,
  kostet den Host im Leerlauf **~213 MB**, nicht 2 GB. Darauf stand mein „diese Maschine ist zu
  knapp" — es war falsch, und deshalb läuft der Gast jetzt hier statt auf einem VPS.
- **SIGHUP lädt cloudflared NICHT neu, es beendet es.** launchd startet neu; ~30 s lang
  antworten **alle** Hostnames des Tunnels 502, die Website eingeschlossen. Erkennbar an der
  wechselnden PID. Mein Skript-Kommentar behauptete das Gegenteil, korrigiert in `d2d4910`.
- **`--memory 1g` war nicht die Ursache eines gestorbenen Containers.** Ein Testlauf starb mit
  `ExitCode=137`, `OOMKilled=false`, bei 55 MB Verbrauch, ohne OOM-Zeile im VM-Kernel. In vier
  Folgeversuchen mit identischen Flags nicht reproduziert. **Unerklärt**, praktisch aufgefangen
  durch `--restart unless-stopped`.
- **Der Crash um 12:08 war nicht Hitze.** Panic-Log: `userspace watchdog timeout … WindowServer
  … in 120 seconds`. Begleitend 18 Swapfiles und `kernel_task` als CPU-stärkster Thread
  (= Drosselung lief). Ein echter Hitze-Abschalter hinterlässt **gar keinen** Panic-Log. Nichts
  ging verloren: Ledger 0 kaputte Zeilen, 7 von 8 Slots per `--resume` zurück.
- **Der Session-Scratchpad in `/private/tmp` überlebt keinen Reboot.** Der Gast-Token lag dort
  und war weg. Liegt jetzt in `~/.claude-fleet-guest/token` (0600).

### Was live ist und wovon die nächste Session wissen muss

- **Gast-Flotte öffentlich** unter dem `container.*`-Hostnamen, **befristet bis 10.08. 13:51**,
  erzwungen durch einen stündlichen launchd-Job (`guest-expose.sh`; mit zurückdatiertem Ablauf
  getestet). Owner-Entscheid: **kein Cloudflare Access**, Fenster statt Identität.
- **VM `fleetguest` läuft**, Container `fleet-guest` mit Egress-Firewall (`--user root
  --cap-add NET_ADMIN --cap-add NET_RAW -e FLEET_FIREWALL=1`), 1 GB Limit, 24–31 MB Verbrauch.
- **Zweite VM `fleetbuild`** (gestoppt) ist die Bau-/Prüf-VM. Nicht löschen, sonst dauert der
  nächste `./docker-verify.sh` wieder eine Viertelstunde.
- **`~/.cloudflared/config-logic-extraction.yml` wurde bearbeitet** (Markerblock, verwaltet von
  `guest-expose.sh`) — außerhalb des Repos, Sicherung als `.bak-container-*` daneben.
- **`~/.claude-fleet-guest/`** trägt `token`, `expose.env`, `expose-until`. Alles 0600 und
  außerhalb des Repos, weil dieses öffentlich ist.
- **Nach einem Mac-Neustart ist die Gast-Flotte weg**, bis `colima start -p fleetguest` läuft.
  Die Live-Flotte kommt über launchd zurück, die Gast-VM hat kein Äquivalent — bewusst, siehe
  den Brief unten (auto-start kostet RAM an jedem Tag, an dem niemand arbeitet).

### Was der Owner selbst tun muss

Node-Sharing/URL-Weitergabe und das `claude setup-token` seines Freundes in den Container —
**bis dahin ist ungetestet, ob eine echte Claude-Session in einer echten Pane im Container läuft.**
Der gesamte Suite-Beweis fährt Shell-Stubs; das ist die größte offene Lücke dieses Strangs.

### Der nächste Bauauftrag liegt fertig da

`briefs/guest-ops-panel.md` — Knöpfe in der Info-Karte (`start` · `cut` · `stop`) plus die
Auth-Fehler-Zahlen aus dem Audit-Log des Gastes. Der Entwurf ist entschieden, inklusive der
abgelehnten Alternativen (kein automatischer Lockout: Selbst-DoS) und **einer offenen Owner-Frage**
am Ende. Nicht neu entwerfen — lesen.

### Key Decisions (mit Grund)

- **Ganze App im Container, niemals einzelne Slots.** Der Transkriptpfad wird aus dem `$HOME` des
  Servers und dem cwd-String gebildet (`projDir`, server.ts:361) — eine Grenze quer durchs Bündel
  blendet Konversationsansicht, `laneDoneLooking`, Digest und auto-③ gleichzeitig aus und lässt
  Fleets eigene Worker trotzdem draußen.
- **Denylist statt Allowlist in der Firewall.** Eine Allowlist ist stärker gegen Exfiltration und
  bricht den Zweck („er nimmt sein git-Projekt mit" heißt Push auf ein Remote, das niemand vorher
  gelistet hat). Gemessen war das Risiko *Erreichbarkeit ins Tailnet*; RFC1918 + CGNAT +
  link-local entfernt genau das, wartungsfrei.
- **Die Ingress-Regel ist der Schalter, nicht DNS.** `cloudflared` legt Records an und löscht
  keine; ohne Regel fällt der Hostname auf den 404-Catch-All.
- **Der Zustand liegt im Named Volume über dem App-Verzeichnis.** Alle 25 Zustands-Pfade hängen
  an `import.meta.dir`, ohne Env-Override. Preis: ein neu gebautes Image erreicht die Instanz
  nicht mehr. Für einen Versuch richtig, dauerhaft falsch — `FLEET_STATE_DIR` wäre die Lösung.
- **Der Transkript-Check bleibt im Container rot** (`e2e/history.ts:52` braucht echte
  `.jsonl`-Historie). Bewusst nicht angefasst: ihn hermetisch zu machen ändert, was eine
  Gate-Suite behauptet, und das ist ein Owner-Entscheid, kein Nebeneffekt.

---

## Session 17 (2026-08-01/02): der Picker, und danach die Liste abgearbeitet

7 Commits, `ff0c8fb`..`0ac753e`, alle deployed. srv läuft seit 02.08. 17:00 als pid 13497,
17 tmux-Sessions haben den Neustart überlebt, `bootHead == HEAD`, `bundleStale:false`.

### Das Erste, was die nächste Session tun sollte

**Die Entscheidung über die UI-Checks ist fällig und wurde zum dritten Mal vertagt** (Session 15
Punkt 3, Session 16 Punkt 1, jetzt hier). Owner-Vorgabe wörtlich, 2026-08-02: *„vertagen, minimale
Lösung jetzt und in nächster Session angehen."* Die minimale Lösung ist getan: **100 Playwright-Checks
liegen lauffähig in `~/claude-fleet-private/ui-checks-2026-08-02/`** (41 Picker-Geometrie · 24
Ordner-Baum · 25 Contents-Baum · 10 Stale-Client), mit README, parametrisierter `ui-harness.sh` und
leerem Privacy-Grep — ich habe sie von dort gegen eine frische Instanz laufen lassen, 100/0.
Die Entscheidung selbst steht: **opt-in Suite im Repo** (muss `exit 42` überspringen, wenn Playwright
fehlt — es ist eine Homebrew-*Python*-Installation und KEIN Repo-Dependency, ein Gate-Eintrag bricht
jede Lane) **oder ausdrücklich festhalten, dass diese Fenster handgeprüft bleiben.** Der Status quo
bleibt die schlechteste Variante: die Suiten sind grün und sehen abgedeckt aus.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **Ich habe zweimal die falsche Fläche gebaut.** Der Owner meinte durchgehend das *rechte
  Detail-Panel* (Contents), ich habe Icons und Klick-zum-Aufklappen in den *linken Ordner-Baum*
  gebaut. Der Hinweis stand in seinem ersten Satz — „die dateien sind jetzt zwar anklickbar", und
  Dateien gibt es nur in Contents. Danach habe ich zwei Runden lang Caches, Tunnel und Bundles
  verdächtigt, statt seine Worte nochmal zu lesen. Lehre gespeichert.
- **Die 11 roten Tier-2-Audits sind NICHT offen.** Das Inspektions-Register hat sie am 29.07. alle
  nachverfolgt, jeder ist erklärt (`journal-cap 07e5969` war ein echter Bug und ist behoben).
  `state.sh` zeigt nur den Zähler, nicht diesen Kontext — ich hatte sie im Catchup als
  unadjudiziert bezeichnet, das war falsch.
- **`codeBehind` hat KEINEN Leser im Client** (grep über `src/*.ts`, `docs/`, `commands/` ist leer).
  Es ist eine Zahl in der Steward-Fakten-Schicht, kein Abzeichen auf dem Dashboard. Ich hatte beim
  Vorschlagen das Gegenteil behauptet.
- **`/api/dirinfo` ist pro Aufklappen NICHT teuer** — `statSync(pfad/.git)` wirft für gewöhnliche
  Unterordner, die Funktion kehrt nach einem `readdir` zurück. Nur echte Repo-Roots zahlen die
  fünf git-Aufrufe. Ich hatte das als Kostenproblem vermutet; Lesen hat die Frage erledigt.
- **`task/delete` schreibt bei steward-Tasks ein `dismissed` ins Steward-Journal**, `done` nicht.
  Fünf erledigte Tasks gehören also auf `done` abgeräumt, nie auf `delete` — sonst misst der
  Propose-Outcome-Kanal Ablehnungen, die nie stattfanden.

### Was offen bleibt (meine Liste, nicht die des Owners)

1. **Die UI-Test-Entscheidung** — siehe oben.
2. **Zwei pending Tasks, beide echte Entscheidungen:** `d76e791e` (der Steward kann „Rotes ohne
   Nachspiel" strukturell nicht prüfen — sein Ledger-Fenster hängt am letzten rundgang-Record) und
   `411dd13a` (Entscheidung zum getakteten Rundgang). Von 7 auf 2 runter; die anderen fünf waren
   im Code erledigt und sind jetzt als `done` markiert.
3. **Drei ungegrabene Inspektions-Kandidaten** (30.07., alle in der Puls-Fakten-Schicht):
   `sinceLastLook` klassifiziert inkonsistent und meldete danach drei Pulse in Folge leer, obwohl
   main drei Commits vorrückte; `self_heal_recreate` 196× created vs 1× resumed; `dispositions.jsonl`
   eine Zeile seit 25.07. bei weiter existierender Route.
4. **Contents-Zeilen sind auf dem Handy ~26px hoch** — und seit dieser Session sitzt dort eine
   Tipp-Geste (Ordner aufklappen). Unter Fingergröße; kein Overflow, aber eng.
5. **Mobile-Durchgang für Queue- und Activity-Fenster** ist weiter nie gemacht worden
   (Session 15, Punkt 2).
6. Unverändert offen aus 15/16: zwei Overlay-Idiome nebeneinander, `src/client.ts` wächst weiter,
   der Picker-Filter expandiert nicht, der Kinder-Cache lebt so lange wie das Fenster,
   `showDirDetail` feuert pro Pfeiltaste, `/api/commits` deckelt bei 200 ohne Paging.
7. **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt weiter ohne Slot auf Platte.

### Key Decisions (mit Grund)

- **`codeBehind` bekam eine ALLOWLIST, keine Denylist.** Der Kommentar über der Funktion verlangt
  „ein unbekannter Pfad muss eine Lücke melden, nicht verstecken" — eine Allowlist erhält genau
  das: eine neue `src/`-Datei ist Code, bis jemand sie einträgt. `src/protocol.ts` fehlt dort
  bewusst, weil server.ts es importiert.
- **`mainAfter` reitet über `LandFacts` vom Land-Site mit, statt in `buildLaneOutcome` gelesen zu
  werden.** Zur Aufzeichnungszeit ist main schon vorgerückt — aber WELCHER Branch der
  Integrationsbranch ist, ist die Tatsache des Aufrufers, nicht die der Funktion. Dasselbe Muster,
  das `baseSha` dort schon nutzt.
- **`suite-contention.md` §3 wurde als überholt MARKIERT, nicht umgeschrieben.** Es ist eine
  datierte Analyse vom 27.07.; die Prämisse zu fälschen würde das Argument darüber unlesbar machen.
- **Der Intake-Lockout-Test feuert seine 50 Fehlversuche PARALLEL.** Der Strike wird nach dem
  400-ms-Delay gepusht, also passieren alle den Vorabcheck und landen exakt `FAIL_LOCK` Strikes —
  ein Roundtrip statt 20 Sekunden. Die Schranke wird per Regex aus `server.ts` gelesen, nicht
  zweimal geschrieben.
- **Maschinenhygiene: 179 tote e2e-Sockets gereapt**, der lebende `claudefleet` explizit
  ausgeschlossen und danach nachgeprüft. Von 164+ auf 1.

---

## Session 16 (2026-08-01): Picker und Activity werden benutzbar, und Dateien lassen sich öffnen

5 Commits, `c85f1a0`..`08bdcfb`, alle deployed und gegen den Live-Server nachgeprüft
(`08bdcfb` = bootHead = HEAD, `bundleStale:false`, 6 Sessions haben die Restarts überlebt).

### Das Erste, was die nächste Session tun sollte

**Der einzige benannte, noch offene Punkt aus dem Gespräch: `recordLand` schreibt `repo` und
`mainAfter` NICHT auf die Outcome-Row — und hat beide in der Hand** (`server.ts`, grep
`async function recordLand(repo, main, branch, mainBefore, mainAfter, prov)`). Zwei Felder mehr
auf der Row lösen ZWEI Dinge auf einmal:

1. die Dateiliste in der Lands-Linse wird klickbar (heute ist sie als einzige der vier
   Dateilisten tot, weil eine Row einen PFAD kennt, aber weder Repo noch Revision), und
2. der Commits↔Lands-Join hört auf, ein ±1-h-Zeittreffer zu sein — das ist wörtlich Punkt 7
   der Session-15-Liste („Ein echter Join bräuchte, dass recordLand den resultierenden
   Commit-SHA schreibt").

Gilt nur für NEUE Rows; alte sagen ehrlich „kein Repository auf der Row". Genau dasselbe
Muster wie `recent`/`last` in `/api/dirinfo`.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **`mdInto` rendert KEIN Markdown.** Es gibt ``` ```-Fences Struktur und sonst nichts —
  absichtlich, weil es feindlichen Transcript-Text rendert (`src/md.ts`, Kopfkommentar). Ich
  hatte schon „`.md` rendert als Markdown" gebaut und den Kommentar dazu geschrieben, BEVOR
  ich die Datei gelesen habe; der Check hat es gefangen. Wer eine Markdown-Ansicht will,
  braucht einen echten Renderer und muss die XSS-Entscheidung neu treffen.
- **`git()` und `gitRead()` TRIMMEN ihre Ausgabe.** Für Hashes egal, für Dateiinhalt falsch:
  führende/abschließende Leerzeichen verschwinden. `/api/file` spawnt darum sein eigenes git —
  dieselbe Begründung, die schon über `statusLines` steht.
- **Die Info-Karte (`#board`) hat ZWEI Dateilisten, nicht eine**: `brief.uncommittedFiles`
  (dirty, das was man normalerweise sieht) und `brief.files` (committed footprint). Ich hatte
  zuerst nur die zweite verdrahtet und es im Browser gemerkt — die sichtbare war die andere.
- **`.shellsect` ist `text-transform: uppercase`.** Playwright `inner_text()` liefert damit
  „CONTENTS", nicht „Contents". Drei meiner Checks sind daran gescheitert und haben KORREKTEN
  Code angeklagt. Bei Text-Assertions gegen dieses UI: `.upper()` vergleichen.
- **Die Suiten-Wrapper und `bun run build` sind cwd-empfindlich.** Ein `cd` in ein
  Scratch-Verzeichnis früher in derselben Bash-Zeile lässt `bun run build` dort laufen, es
  meldet Erfolg, und der Test misst danach ALTEN Code. Zweimal passiert. Build und `cp` immer
  mit absoluten Pfaden aus dem Repo heraus.
- **`pkill -f "bun server.ts"` killt den LIVEN Server.** Ich habe es getan (10:53). Der
  Watchdog hat ihn nach ~2 s neu gestartet, der Audit-Trail zeigt danach kein einziges
  Slot-Event, es ging nichts verloren — aber das war Glück im Sinne von „der Watchdog
  funktioniert", nicht Vorsicht. Eine Wegwerf-Instanz beendet man über ihren PORT:
  `kill $(lsof -ti tcp:23462)`.
- **`./e2e-isolated.sh` fiel einmal mit 2 Checks im Steward-Send-Episoden-Limiter**
  („a second send of the same kind×slot within the episode window is 429 (409)" +
  „a capped send is audited"). Derselbe Baum, direkt danach: 993 PASS. Damit ist die
  Nicht-Determiniertheit nach der Hausregel bewiesen; der Diff fasst diesen Pfad nirgends an.
  Eine Beobachtung, keine sechste Flake-Familie — dafür braucht es mehr als eine Instanz.

### Was ich als offen kenne (meine Liste, nicht die des Owners)

1. **Die vier Fenster haben WEITER null e2e-Abdeckung — und die Lücke ist jetzt GRÖSSER, nicht
   kleiner.** Ich habe diese Session vier Playwright-Harnesses geschrieben, zusammen **72
   Checks** (24 Picker · 17 Activity · 13 Mobile · 18 Datei-Viewer): der Picker-Baum inklusive
   aller Guide-Arrays gegen ein Fixture bekannter Form, Mobile mit Touch-Emulation, die drei
   Activity-Linsen gegen die LIVEN Ledger, der Datei-Viewer über alle vier Aufrufstellen. Sie liegen in `$SCRATCH/{pick,act,mob,fileview}.py` und **sterben mit dieser
   Session** — sie sind bewusst NICHT eingecheckt worden, und der Grund ist wichtig: sie tragen
   absolute Pfade mit dem Maschinen-Accountnamen (8 Vorkommen über die vier Dateien), und dieses
   Repo ist öffentlich. Wer sie einchecken will, muss die Pfade vorher parametrisieren (env /
   argv) und danach den Privacy-Grep aus `CLAUDE.md` (Abschnitt Deploy) leer sehen — der
   Owner-Entscheid aus Session 14 gilt weiter. Der Entscheid aus Session 15 (Punkt 3) ist damit fällig und schärfer geworden:
   entweder die Harnesses werden ein echter, opt-in Suite-Ordner im Repo — **Achtung: sie
   brauchen Playwright, das eine Homebrew-*Python*-Installation ist und KEINE Repo-Abhängigkeit;
   ein Gate-Eintrag würde jede Lane brechen, die es nicht hat** — oder es wird ausdrücklich
   festgehalten, dass diese Fenster handgeprüft bleiben. Der Status quo ist weiterhin die
   schlechteste Variante.
2. **Mobile: nur der Picker ist geprüft.** Queue- und Activity-Fenster sind auf dem Handy
   unverändert UNGEPRÜFT (Session 15, Punkt 2 — der Picker-Teil davon ist erledigt).
3. **Der Datei-Viewer kann keine Datei aus der Lands-Linse öffnen** — siehe „Das Erste" oben.
4. Unverändert offen aus Session 15: zwei Overlay-Idiome nebeneinander (Punkt 3), `src/client.ts`
   ist jetzt 5394 Zeilen (Punkt 4), der Picker-Filter expandiert nicht (5), der Kinder-Cache
   lebt so lange wie das Fenster (6), `showDirDetail` feuert pro Pfeiltaste (8), `/api/commits`
   deckelt bei 200 ohne Paging (9).

### Aus 15/13 unverändert offen

- **Beide Pulse sind jetzt still**, nicht nur einer: `/inspektion` UND beide `/rundgang`-Autos
  stehen auf `runsLeft: 0` (live nachgezählt). Die fällige Entscheidung aus Session 13 gilt
  damit für alle drei.
- **7 pending Tasks** (live: 8 Rows, 7 pending) — unverändert, zwei davon laut Session 13
  längst erledigt und nur nicht abgeräumt.
- **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt weiter ohne Slot auf Platte.
- **Maschinenhygiene steigt weiter: 146 geleakte e2e-tmux-Sockets, 17 MB TMPDIR-Scratch.**
  Nichts reapt sie. Ein Teil davon ist diese Session (ich habe ~10 Suite-Läufe gefahren).
- Die zwei Messreihen aus Session 13 brauchen weiter Lanes, bevor sie etwas sagen.

### Key Decisions (mit Grund)

- **Ein Viewer, vier Aufrufstellen, jede benennt ihre Revision.** Der Entwurfsfehler wäre „einen
  Datei-Viewer bauen": eine Datei hat mehr als eine Version, und jede Liste meint eine andere.
  Darum liefert jeder Aufrufer WELCHE Revision er meint und wohin `‹ zurück` führt — und die
  Kopfzeile sagt es immer laut.
- **Markdown wird NICHT gerendert** (siehe Korrektur oben) — ein Viewer zeigt die Quelle.
- **Untracked bekam eine eigene Pick-Art** im Review-Fenster. Als `file`-Pick behandelt rendert
  es „no longer in this diff": wahr und nutzlos. Die Datei selbst IST das Neue an ihr.
- **`/api/file` ist owner-only durch POSITION** (hinter tokenGate, unter dem Share-Gate) — genau
  die Eigenschaft, die ein späteres Verschieben eines Blocks lautlos bricht. Deshalb prüft
  `fleet-e2e-security.ts` §8 jetzt beide Hälften gegen `fleet.json`: ohne Token 401 und keine
  Bytes im Body, auf dem Share-Host 404 **auch MIT** Owner-Token.
- **Klick öffnet, Doppelklick startet** (Picker). Und: ein Klick klappt nur AUF, nie zu — sonst
  springt die Zeile unter dem Cursor weg.

### Womit man sofort weiterarbeitet

`./state.sh`, dann `git log 8f4565b..HEAD` MIT Bodies — die fünf Bodies sind das Befund-Register
dieser Session. Neue Einstiege: `showFileView`/`loadFile`/`renderFileBody` und `appendDirContents`
in `src/client.ts`, `dirEntries`/`fileBody` und die Routen `/api/file` + `/api/commit-diff` in
`server.ts`, `auditProjects` (die abgeleitete Slot→Projekt-Zuordnung) ebenfalls in `client.ts`.

---

## Session 15 (2026-07-31/08-01): vier Overlays wurden Fenster, und das Land-Gate ist wieder grün

8 Commits, `0ea14e8`..`41c1733`, alle deployed (srv läuft seit 08-01 09:57 als pid 39482, alle 19
tmux-Sessions haben den Restart überlebt) und live nachgeprüft.

### Das Erste, was die nächste Session tun muss

**Der Owner hat gesagt: „but there are still some things left to fix on this work" — und NICHT
gesagt, was.** Nicht raten. Die Liste unter „Was ich selbst als offen kenne" ist MEINE Liste, nicht
seine; sie kann sich mit seiner überschneiden oder gar nicht. Erste Handlung: fragen.

### Absicht dieser Session

Zwei Runden, beide „eins nach dem anderen" auf Owner-Vorgabe. Runde 1: die vier Flächen, die er als
Brain-Dump nannte — Diff/Commit-Review, Projektauswahl, Task-Queue, Outcome-Feed — waren alle
dieselbe `.overlay > .panel`-Box (520–900 px, eine scrollende Spalte) und mussten deshalb alle
abschneiden, was sie zeigen. Runde 2: Polish — der Picker lud endlos, ein Ordnerbaum wurde gewünscht,
der Outcome-Feed sollte auch Commits zeigen, der Audit-Trail „vielleicht als View-Option".

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **`bun run build` IST ein halber Deploy.** Der Server liefert `public/app.js` von Platte — der
  Client ist also sofort live, neue ROUTEN erst nach srv-Restart. Genau das hat der Owner als
  „lädt endlos" gesehen: gemessen `/api/dirs` → 200, `/api/dirinfo` → 404 gegen die laufende
  Instanz. Wer hier Client UND Server anfasst, muss beide Hälften deployen, sonst baut er dem
  Owner eine kaputte Oberfläche. Der Client sagt das jetzt selbst (`SKEW_NOTE`) statt zu drehen.
- **Ein Kommentar, der die Landmarken zitiert, an denen `e2e/outcomes.ts` die Datei zerschneidet,
  macht die Checks LEER.** Passiert in Schritt 4: `indexOf()` traf den Kommentar statt den Code,
  vier Ehrlichkeits-Checks waren vakuum und meldeten trotzdem grün. Gefunden, weil ich alle 14
  Source-Assertions lokal nachgebaut habe, BEVOR ich eine Suite dafür bezahlt habe. Diese
  Nachbau-Prüfung ist billig und gehört vor jede Änderung am Outcome-Renderer.
- **Das Land-Gate war seit dem 07-28-Flip rot und niemand hat es gefahren.** `bun e2e/pins.ts` ist
  sein erster Schritt, also war ALLES dahinter (tsc + drei Suiten) vier Tage lang unerreichbar.
  Kein Land in dem Fenster — nur deshalb ist es nicht als kaputter Auto-Land aufgefallen.

### Was ich selbst als offen kenne (meine Liste, nicht die des Owners)

1. **Die vier Fenster haben NULL e2e-Abdeckung.** `grep` über `e2e/*.ts` + `fleet-e2e*.ts` nach
   `openShell`/`shell-review`/`shell-picker`/`shell-queue`/`shell-outcomes` ist leer. Die einzigen
   Client-Checks sind die Source-Text-Assertions über den Outcome-Renderer-WORTLAUT. Jede
   Regression in Layout, Auswahl, Tastatur oder Datenfluss dieser vier Fenster ist für JEDES Gate
   unsichtbar. Alles, was ich geprüft habe, war Playwright von Hand gegen eine Wegwerf-Instanz.
   Das ist die größte Qualitätslücke dieser Arbeit.
2. **Mobile nur für das Review-Fenster geprüft** (390 px, Liste↔Detail-Push und Zurück-Knopf).
   Picker-Baum, Queue und Activity-Fenster sind auf dem Handy UNGEPRÜFT — und das Handy ist hier
   eine echte Fläche (`docs/screenshot-mobile.png`).
3. **Zwei Overlay-Idiome koexistieren.** Vier Shell-Fenster, und weiter als `.panel`:
   `#hist` (Prompt-History), `#autodlg` (Zeitpläne), `#sharedlg` (Share), `#gate` (Token). Kein
   Fehler, aber inkonsistentes Vokabular; wer das angleicht, sollte es bewusst tun.
4. **`src/client.ts` ist 4938 Zeilen.** Die Renderer wurden bewusst NICHT ausgelagert (Begründung
   unter Entscheide) — die Spannung bleibt und wächst.
5. **Der Filter im Picker expandiert nicht.** Ein Treffer in einem eingeklappten Ordner bleibt
   unsichtbar. Absichtlich (ehrlich: er filtert, was da ist), aber eine echte Grenze.
6. **Der Kinder-Cache des Baums lebt so lange wie das Fenster.** Ein Ordner, der während des
   Offenseins angelegt wird, erscheint erst nach Re-Root/Neuöffnen.
7. **Der Commits↔Lands-Join ist ein ZEIT-Treffer (±1 h), kein Beweis.** Ein echter Join bräuchte,
   dass `recordLand` den resultierenden Commit-SHA schreibt — das wäre die saubere Server-Änderung.
8. **`showDirDetail` feuert pro Pfeiltaste** (latest-wins, aber N Requests beim Durchscrollen).
   Ein Debounce wäre billig.
9. `/api/commits` liefert max. `MAX_COMMIT_ROWS` (200) ohne Paging; die Audit-Timeline ist auf ±8
   Ereignisse begrenzt. Beides bewusst gedeckelt, beides sagt es im UI.

### Aus Session 13 unverändert offen — ich habe nichts davon angefasst

- **`/inspektion` hat `runsLeft 0`** und ist still. Die fällige Entscheidung (neu aufsetzen oder
  ruhen lassen) steht weiter aus.
- **7 pending Tasks** — live nachgezählt, immer noch exakt 7. Zwei davon waren laut Session 13
  bereits erledigt und nur nicht abgeräumt.
- **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt weiter ohne Slot auf Platte.
- **Maschinenhygiene:** 127 geleakte e2e-tmux-Sockets. Meine eigenen sieben habe ich gereapt; die
  127 sind Altbestand, und nichts reapt sie.
- Die zwei Messreihen aus Session 13 brauchen weiter ~15 Lanes, bevor sie etwas sagen.

### Key Decisions (mit Grund, weil der Grund das Wiederaufrollen entscheidet)

- **Die Renderer bleiben in `src/client.ts`; nur neue Chrome ging nach `src/shell.ts`.**
  `e2e/outcomes.ts` und `fleet-e2e-security.ts` lesen diese Datei als SOURCE TEXT, und ein Check
  schneidet einen Bereich per Index heraus, transpiliert und FÜHRT IHN AUS. Ein Umzug bricht die
  Test-Maschinerie, nicht den Test — das ist teurer als die Dateigröße.
- **Ein Klick wählt aus, statt zu navigieren (Picker).** Plattform-Standard (Finder/Explorer/VS
  Code) und die Vorbedingung dafür, dass ein Detail-Panel überhaupt erreichbar ist. Nebeneffekt:
  der 250-ms-Timer, der nur Einzel- von Doppelklick trennte, ist weg.
- **Audit als LENS, nicht als viertes Fenster.** Owner war unsicher („maybe just as a view option");
  die drei Linsen beantworten eine Frage aus drei Winkeln, und die Lücken dazwischen waren das
  Problem — der Ledger sieht einen von Hand getippten Commit nicht.
- **`off` wurde ein benannter Wert, statt den Pin zu lockern.** Ein Pin, der aufhört zu fallen, ist
  schlechter als ein roter: er schweigt dann für immer über echte Tippfehler. Mutation beweist
  beide Richtungen (`off` → PASS, `offf` → FAIL exit 1).
- **Verifikation dieser Session:** tsc + `bun run build` + der Demo-Checkout (`~/claude-fleet-demo`,
  eigenes `typecheck`/`build`, KEIN Gate hier fängt einen Bruch) + Land-Gate + `./e2e-isolated.sh`
  für alles, was den Outcome-Renderer berührt. Plus Playwright von Hand — siehe Lücke 1.

### Reihenfolge der nächsten Schritte, und warum diese Reihenfolge

1. **Owner fragen, was noch offen ist.** Blockierend: er weiß es, ich nicht, und jede Minute an
   meiner Liste kann an seiner vorbeigehen.
2. **Mobile-Durchgang für Picker/Queue/Activity.** Billig, und das Handy ist eine echte Fläche.
   Vor jeder weiteren Feature-Arbeit, weil Layout-Fehler dort strukturell sind, nicht kosmetisch.
3. **Entscheiden, ob die vier Fenster e2e-Abdeckung bekommen** — oder ausdrücklich festhalten, dass
   sie handgeprüft bleiben. Der Status quo ist die schlechteste Variante: er sieht abgedeckt aus
   (die Suiten sind grün) und ist es für diese Fenster nicht.
4. Erst danach die Punkte 5–9 meiner Liste, falls der Owner sie überhaupt will.

### Womit man sofort weiterarbeitet

`./state.sh`, dann `git log 99a9c0f..HEAD` MIT Bodies — die acht Commit-Bodies sind das
Befund-Register dieser Session (Messungen, Mechanismen, was gemessen vs. nur gelesen wurde).
Die Dateien, die man dafür kennen muss:

- `src/shell.ts` (190 Z.) — das Fenster, das alle vier Flächen teilen. Nur Chrome: Layout,
  Auswahl, Tastatur, Mobile-Push, Escape in der CAPTURE-Phase. Generalisiert bewusst keine Rows.
- `src/client.ts` — alle vier Renderer. Einstiege: `openReview` · `openPicker`/`paintPicker`/
  `dirRow` · `openQueue`/`renderQueue` · `openActivity`/`renderActivity` (+ `renderOutcomes`,
  `renderCommits`, `renderAudit`). `SKEW_NOTE` erklärt die Deploy-Falle.
- `e2e/outcomes.ts` §(9d)–(9i) — die Source-Text-Assertions über den Outcome-Renderer. VOR jeder
  Änderung dort lokal nachbauen; sie schneiden die Datei zwischen Landmarken-Statements.
- `e2e/pins.ts` (Block `FLEET_CLEAN_REVIEW`) — leitet die erkannten Werte aus den Regexen in
  `server.ts` ab, damit die Menge nicht zweimal geschrieben wird.
- `server.ts` — neu: `slotCommits`/`commitRows`, `dirInfo`, `knownRepos` und die Routen
  `/api/slots/:id/commits`, `/commit-diff`, `/api/dirinfo`, `/api/commits`.

Nicht-offensichtlicher Zustand: die Wegwerf-Instanz zum Anschauen steht in
`$SCRATCH/ui-harness.sh` (eigener Socket/Port 23450, `FLEET_CMD=true`, `FLEET_AUTO_REVIEW_MS=0`) —
sie ist NICHT im Repo und muss ggf. neu geschrieben werden; Muster ist `e2e-isolated.sh`.
Deploy bleibt `tmux -L claudefleet kill-session -t srv`, danach IMMER `bundleStale` prüfen
(`/api/steward/sessions`, Bearer = `stewardToken` aus `fleet.json`, nicht der Owner-Token —
der gibt dort 404).

---

## Session 14 (2026-07-30): Teil A der öffentlichen Demo ist aufgenommen

Zwei Commits, `d638c63` + `214f630`, **nicht gepusht**. Vier echte Claude-Code-Sessions auf
einer Wegwerf-Instanz (Port 8877, eigener Socket, Scratch-Kopie — die Live-Instanz auf 8790
wurde nicht berührt), ihre Roh-Streams liegen in `demo/fixtures/`. Neues Bild in
`docs/screenshot.png`, dazu erstmals ein Handy-Bild. **Das operative Wissen dazu steht in
`docs/demo-fixtures.md`** — vier Fallen, die aus den Bytes nicht ableitbar sind; wer den
Replay-Player baut (Session B) oder das Bild neu schießt, liest das zuerst.

**Der Owner-Entscheid dieser Session, und er gilt weiter: der Maschinen-Accountname darf
nirgends sichtbar sein.** Er stand 80× in den Aufnahmen und im Screenshot. Konsequenzen, die
über diese Session hinausreichen:

1. **Redaktion in einem Terminal-Stream muss längentreu sein** (8 Bytes für 8), sonst
   verschiebt sich jede Cursor-Adresse danach. Kein Text-Ersetzen ohne diese Eigenschaft.
2. **Ein Grep über die Bytes reicht nicht.** Ein Vorkommen lag als die ersten sieben Zeichen
   des Namens + Cursor-Sprung im Stream, das achte hatte ein früherer Redraw gemalt — der Grep
   war sauber, der *gerenderte Frame* zeigte den Namen. Gefunden über alle Fragmente ≥ 3
   Zeichen, bewiesen durch Rendern des Frames vor/nach dem Patch. Für Terminal-Aufnahmen gilt:
   prüfen, was **malt**, nicht was greppt.
3. **Die Regel gilt auch für die Prosa.** Der erste Anlauf dieser Dokumentation nannte das
   Fragment wörtlich und hätte sieben Achtel des Namens in ein öffentliches Repo geschrieben —
   in derselben Datei, die vor genau diesem Fehler warnt. Beschreiben, nicht zitieren.
4. **Die Commits wurden vor jedem Push umgeschrieben**, damit kein Blob den Namen je trug. Ein
   Nachbesserungs-Commit hätte ihn dauerhaft in der Historie gelassen — das ist das Leck, nicht
   der Working Tree. Prüfung: `git log -p 4b8fec4..HEAD` gegen den Namen und gegen jedes seiner
   Fragmente ≥ 3 Zeichen = 0.

**Was als Nächstes ansteht (Demo-Strang):** Session B baut den Replay-Modus, Session C bettet
ein. Beide brauchen `docs/demo-fixtures.md`; der Geometrie-Vertrag (76×28) und „vor dem ersten
Byte den Terminal löschen" sind harte Vorgaben, keine Vorschläge.

**Offen, klein:** Das Board-Bild rendert die Fixtures, nicht eine lebende Flotte (vier fertige
Live-Sessions sind nachträglich nicht mehr fotografierbar) — steht im Commit-Body und in der
Doc. Wer es je wieder live schießen will, muss die Aufnahme neu fahren.

**Nicht im Repo, aber erhalten:** die vier echten Diffs der Sessions und die Aufnahme-Skripte
liegen in `~/claude-fleet-private/demo-2026-07-30/`. Der `claude-deck`-Patch (500 → 400 an der
Boundary) ist ein echter Fix für dieses öffentliche Repo und wartet dort auf Übernahme; die
Scratch-Klone sind weg.

---

## Session 13 (2026-07-29/30): der zweite Puls, und ein Datenlayer für Slots

### Was diese Session getan hat

Der Owner wollte zweierlei: den Steward autonom nach Fehlern/Verbesserungen schauen lassen,
und den Datenlayer über Sessions/Slots/Lanes ausbauen. Beides steht: 10 Commits, `c1f4ad5`
bis `fd982e9`, alle deployed und verifiziert. (`fc24499..HEAD` sind 13 — die drei ältesten
darin, Privacy-Scrub und `.env`-Umzug, stammen noch aus der Vor-Session.)

**Der Inspektor (`/inspektion`) ist der zweite Puls.** Der Rundgang schaut auf den *Betrieb*,
der Inspektor auf die *Substanz* — ein Revier pro Lauf aus fünf, rotierend über sein eigenes
Register, read-only, filed höchstens 1–2 `pending`. Konzept in `docs/steward.md` §Die zwei
Pulse; Register ist `inspektion-register.jsonl` im Steward-Worktree (untracked, 23 Zeilen).

**Er hat sich in zwei Läufen bezahlt gemacht.** Puls 1: eine verifizierte latente Auth-Lücke
und ein verwaistes Mess-Subsystem. Puls 2: **einen echten Bug in Code, der zwei Stunden vorher
gelandet und auf Owner-Nachfrage kritisch nachgeprüft worden war** (`b7d449a0` → `ba4b24f`).
Das ist der stärkste Beleg, den es für den Puls gibt.

**Der Slot-Datenlayer** (`slotstats.ts`, `GET /api/slot-stats`, `slotHealth` im Digest) misst,
was ein Slot verspricht: behält er seine Identität über einen Crash. Reine Ableitung aus
Events, die längst geschrieben wurden — plus zwei Erfassungszeilen dort, wo die Ableitung an
eine Wand lief (Heal-Grund, Kill-Grund).

**Der ③-Reviewer bekommt Kontext statt Werkzeug** (`b50c233`): die vollen Inhalte der
meistberührten vorbestehenden Dateien reiten im DATA-Block mit. Werkzeuglos und one-shot
bleibt er — die Ablehnungsgründe für die Alternativen stehen an den Konstanten in `server.ts`
und sind die Checkliste für die Eskalation, falls die Messreihe sie fordert.

### Zwei Messreihen laufen — beide brauchen ~15 Lanes, bevor sie etwas sagen

Nicht vorher interpretieren. Beide lesen sich aus vorhandenen Ledgern, ohne neue Erfassung:

1. **Wirkt der ③-Kontext?** Basis vor der Änderung: 46 % der Findings `basis:"inferred"`
   (36/78), und 32 von 66 Notes sagen „did not check code outside the diff". Beides muss
   fallen. Quelle: `review.findings[].basis` und `review.notes` in `lane-outcomes.jsonl`.
2. **Hält der Slot sein Versprechen?** Die Serie startet bei `ba4b24f` neu — Rows davor können
   die Frage nicht beantworten, weil die Klassifikation kaputt war. Zu lesen an `healReasons`
   in `/api/slot-stats`: `no-session` = die harmlose openSlot-Race, `no-transcript` = die echte
   Verletzung. Vorher war Letzteres unerreichbar.

### Was als Nächstes ansteht — in dieser Reihenfolge

1. **Die Pulse laufen aus, und das ist Absicht.** `/rundgang` (`ad14fc62`, alle 3 h) hat noch 3
   von 8 Läufen; `/inspektion` (`cf216970`, alle 6 h) hat **runsLeft 0** und ist damit still.
   Endliche Run-Caps sind der Mechanismus, der „weiterlaufen" zu einer Entscheidung macht statt
   zu einem Default — genau daran ist der alte Rundgang-Auto im Juli unbemerkt gestorben.
   **Fällige Entscheidung: Inspektor neu aufsetzen (dann ggf. `perpetual: true`, owner-only)
   oder ruhen lassen.** Entscheidungsgrundlage: zwei Läufe, zwei verwertbare Befunde, einer
   davon ein echter Bug.
2. **7 pending Tasks.** Zwei davon sind diese Session verifiziert UND erledigt (`0b21cc94`
   gelöscht in `59eccbb`, `d8efc50f` gehärtet in `d495607`) — die Rows stehen aber noch auf
   `pending` und gehören abgeräumt, sonst zählen sie beim nächsten Blick doppelt. Der Rest ist
   ungeprüft. Vor einem Dispatch-Einschalten ohnehin durchzusehen (Steward-Benachrichtigungen
   landen in derselben Queue und würden als Brief gespawnt).
3. **Maschinenhygiene wird laut:** 88 geleakte e2e-tmux-Sockets, 60 MB TMPDIR-Scratch. Nichts
   reapt die. Kein Betriebsrisiko heute, aber monoton steigend.
4. **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt ohne Slot auf Platte — landen
   oder verwerfen.

### Korrekturen an früheren Behauptungen (diese Session gemessen)

- **„Der Steward-Ladepfad funktioniert" war falsch.** `/steward` Schritt 0 (`git merge main`)
  hätte **418 fremde Commits** gezogen (History-Rewrite beim Public-Release), und 11 von 13
  Doc-Referenzen der drei Steward-Commands zeigten ins Attic. Beides behoben: Branch auf main
  zurückgesetzt (Rückweg als Tag `steward-pre-reset-2026-07-29`; 13 Unikate gerettet nach
  `~/claude-fleet-private/steward-rescue/`), Pfade korrigiert.
- **Der Doc-Index war zu 84 % falsch** — 10 von 61 Pointern lösten auf. Neu geschrieben auf die
  10 operativen Docs, mit dem Pointer-Check als ausführbarer Zeile darin. Der Check fand beim
  ersten Lauf einen Fehler in seiner eigenen Neufassung und danach fünf weitere in
  `steward.md` — das ist der Grund, ihn zu behalten.
- **`self_heal_recreate` feuert bei JEDEM `ensureSlot`-Spawn**, nicht nur bei Heilungen. Das
  erklärt `opens ≈ heals` in den Live-Zahlen; die 196:1-Zahl der ersten Messung war deshalb nie
  „196 Heilungen". Die Trennung leistet jetzt die Reason-Spalte.
- **Zwei Protokoll-Abweichungen des ersten Pulses** waren im Pane-Output unsichtbar und nur im
  Audit-Trail zu sehen (zwei Reviere in einem Lauf; erfundene Register-Zeitstempel), beide im
  Command geschlossen (`41e8313`). Die Lehre: die Puls-Ausgabe ist kein Compliance-Beleg.

### Key Decisions

- **„Deliver context, not tools" statt Snapshot-Worktree für ③.** Gemessen, nicht geraten: das
  Defizit war Kontext (46 % inferred, 32 „did not check"-Notes), nicht Werkzeug (Truncation nur
  3×). Ein Reviewer mit Tools im *lebenden* Lane-Baum wurde verworfen — er rennt gegen die
  index.lock-Klasse, liest die kopierte `.env` und bricht die patchId-Ehrlichkeit. Der
  Snapshot-Worktree bleibt die Eskalationsstufe, falls die Messreihe sie fordert.
- **Die A2-Nullkontrollgruppe gelöscht, nicht repariert.** Keine der zwei Entscheidungen, die
  sie verwaisen ließen, war falsch — erst ihre Konjunktion ließ eine Messung ohne Frage laufen.
  Zusätzliches Argument, das die Sache entschied: die Baseline war in-memory und starb bei jedem
  Deploy, akkumulierte also nie über ein Boot-Fenster — genau der Fehler, den
  `graduation-criteria.md` selbst benannt hatte.
- **Endliche Run-Caps für beide Pulse.** `perpetual` existiert (owner-only) und wurde bewusst
  nicht genommen: ein Puls, der nie ausläuft, wird nie wieder bewertet.
- **Der Datenlayer ist Ableitung, nicht Erfassung.** Kriterium des Owners, wörtlich: „aufpassen
  das wir nicht irgendwelche Daten erfassen und mitgeben die unbrauchbar sind". Es hat sofort
  gegriffen — der Realdaten-Lauf fand `malformed: 468` auf einer Datei ohne eine einzige kaputte
  Zeile (Scope-Prüfung stand hinter der Feldvalidierung). Jede Zahl beantwortet eine benannte
  Frage, sonst fliegt sie raus.

### Womit man sofort fortsetzen kann

`./state.sh`, dann `git log fc24499..HEAD` mit Bodies. Die zwei Messreihen brauchen keine
Erklärung, nur Geduld und einen Ledger-Query; die eine fällige Entscheidung ist Punkt 1.
