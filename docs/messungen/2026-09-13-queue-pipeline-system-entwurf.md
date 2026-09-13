---
frage: Wie wird aus filen → Karte → Buendel → Freigabe → Start → Land EIN Ablauf ohne Handgriff dazwischen, und welche heutigen Teile fallen dabei weg?
urteil: Der Handgriff, der den Durchsatz haelt, ist die FREIGABE (38 task_release in 7 Tagen, jede von Hand, 40 offene Zeilen davon 1 queued), nicht die Karte (60-s-Tick, 1–6 min), nicht die Bestaetigung (1x benutzt, Auto-Lift 51df715e gefilet) und nicht das Land (53 von 95 Lands durch die MAIN, 42 vom Owner). Der Entwurf macht die Freigabe zur einzigen Entscheidung, laesst den Tick danach Welle, Reihenfolge und Kollision als EINE Rechnung lesen, und streicht den Owner-Wellen-Knopf, die Batch-Bestaetigung als Vorbedingung und die Einzelzeilen-Sicht.
bereich: [queue, karten, wellen, freigabe, dispatch, land, board]
belege: [server.ts#tickCardSweep, server.ts#cardDue, server.ts#confirmCardsForMain, server.ts#landWaveProjectionNow, server.ts#tickDispatch, server.ts#dispatchTask, server.ts#releaseTaskForMain, server.ts#createTaskForMain, server.ts#landLane, server.ts#waveRowsOf, task-land-waves.ts#wavesFor, task-land-waves.ts#classify, task-land-waves.ts#collidesOn, task-land-waves.ts#placeByAfter, card-extract.ts#parseFormattedCard, card-extract.ts#validateCard, fleet.json, audit.jsonl, cards.jsonl, lane-outcomes.jsonl, post-land-audits.jsonl]
nicht-gemessen: Latenz Freigabe→Start (kein releasedAt auf der Zeile), Owner-Zeit je Handgriff, Kollisions-Trefferquote R4 (land-collision-stats.ts existiert seit 1f9da6b6, hier nicht gefahren), Programs ausserhalb claude-fleet, .env, ps
stand: 2026-09-13 16:3x
---

# Die Queue-Pipeline als EIN System — Entwurf, kein Code

Denklane Fable 5.1, Baum `551cee57` (Lane `fleet/260913142340-11ec`), read-only am Haupt-Checkout
`/Users/owner/claude-fleet` (Ledger nur als Python-Projektion mit Feldauswahl; die
Wellen-Simulation in §3 lief auf Kopien im Session-Scratchpad, `grep -c token` = 0 je Ausgabe vor
dem Lesen). Eingang: `docs/queue-wellen-2026-09-06.md` §5/§7, die A–E-Note
(`docs/messungen/2026-09-13-task-aggregation-a-e-fable.md`), die GLM-Kontrolle
(`docs/messungen/2026-09-13-buendelung-live-kontrolle-glm.md`), der 09-12-Befund, die Notizen
`144e84ff` und `0786df49` auf dieser Flaeche. Owner 2026-09-13 ~15:4x woertlich: *„ich denke
einfach das es einfach ein smartes system braucht fuer das ganze"*.

Was hier VERIFIZIERT heisst: am Code der genannten Symbole gelesen oder mit dem genannten Befehl
am Ledger gezaehlt. Was GEFOLGERT heisst, steht unter §4–§6 als Entwurf und ist so markiert.

## 0. Gegenlesung des Anlasses (jede Zahl selbst erhoben)

| Behauptung im Brief | Gemessen | Befehl / Quelle |
|---|---|---|
| Karte 1–6 min nach dem Filen, Kadenz kein Engpass | bestaetigt: `CARD_TICK_MS` aus `FLEET_CARD_MS` (`server.ts#tickCardSweep`, Batch 4 je Tick, `server.ts#CARD_BATCH_CAP`); 84 Zeilen `cards.jsonl`, Modell-Lesung p50 69 s (GLM-Note C1) | `python3` ueber `cards.jsonl`: `source/valid/surfaceValid` |
| Kein unbeaufsichtigter Wellen-Leser; `POST /api/wave/dispatch` Owner-only; `task_wave_dispatch` 3x | bestaetigt: der Kommentar an der Route sagt woertlich „NOTHING UNATTENDED REACHES HERE … stands explicitly under the cut line of §5"; `tickDispatch` ruft `dispatchTask(next, free, false, false, spawn)` OHNE `wave`-Argument | `rg -n 'api/wave/dispatch' server.ts`; audit.jsonl `event == task_wave_dispatch`: 3 gesamt, 1 heute (02:33) |
| 22 von 36 Zeilen flaeche-nur-abgeleitet | live 16:2x: **40** offene `auftrag`-Zeilen, Sensor: 27 `flaeche-nur-abgeleitet` · 6 `kein-program` · 3 `keine-flaeche` · 2 Wellen der Groesse 2 (Simulation A, §3) | `bun task-land-waves.ts --state <kopie> --default-repo /Users/owner/claude-fleet` |
| `task_cards_confirm` 1x | bestaetigt: 1 Zeile gesamt (11:49, Slot 4, 5 Ids) | audit.jsonl |
| Veraltete Program-Bindungen | **teils**: Leichtgewicht `f9dc8e10` → Slot 10 = „🎛 Fleet Controller (Astra)", `openedAt` UND `sessionId` stimmen — die Bindung ist LEBENDIG, aber auf den Controller statt eine Program-MAIN. Private-repo-j `9ce08219` → Slot 2, heute „Betriebsbeobachtung · Supervisor", `openedAt` stimmt NICHT — tote Bindung. Fleet-Betrieb `f170dc46` → Slot 4, exakt | `fleet.json` `programs[].main` gegen `slots[<id>].openedAt/sessionId` |
| Budget 5, Zeile ohne Groesse = 2; voll bestaetigt fast nur Paare | bestaetigt und verschaerft: 33 von 40 Zeilen tragen KEINE Groesse (4 klein · 2 mittel · 1 gross); unter Auto-Lift entstehen bei Budget 5 drei Paare, bei Budget 12 ein Fuenfer (§3) | `card.size` je Zeile; Simulation §3 |
| Freigabe ist der Hebel: alle auftrag-Zeilen pending, 1x task_release seit 09:34 | bestaetigt: 39 pending + 1 queued (`51df715e`, Owner-Release 15:19); `task_release` heute 7 (Slot 3: 3, Slot 4: 4), seit 09:34 genau 1 (11:52, `20fb7151`) | audit.jsonl `task_release`, `ts >= 2026-09-13` |

Abweichung zum Brief: es sind 40 Zeilen, nicht 36, und die Bindung von Leichtgewicht ist nicht
veraltet, sondern auf die falsche Rolle gesetzt (Controller mit `awaiting`-Pflichten statt einer
MAIN, die freigibt). Das aendert F2 (unten): das Problem ist nicht „Program ohne MAIN", sondern
„Program, dessen MAIN nicht freigibt" — 14 pending Zeilen, 7 `task_release` in 7 Tagen von Slot 10.

## 1. Der Fluss einer Zeile heute — sechs Stufen, am Code gelesen

Je Stufe: Ausloeser · Entscheider · Sensor (was der Server dazu weiss) · Ablehnungsgrund (was die
Zeile stoppt). „Handgriff" = ein Mensch oder eine Session muss eine Route rufen.

### Stufe 1 · FILEN (Zeile entsteht als `pending`)

- **Ausloeser:** `POST /api/tasks` (Owner-Token, keine Audit-Zeile) oder `POST /api/self/tasks`
  (`server.ts#createTaskForMain`, Audit `main_task`). Beide schreiben `status:"pending"` als
  Literal; die MAIN-Tuer bindet `programId` aus der Bindung, nie aus dem Body, und deckelt mit
  `PROGRAM_MAX_PENDING` je Program.
- **Entscheider:** der Filer. Handgriff, unvermeidbar — das ist der Eingang.
- **Sensor:** keiner. Die Zeile hat Text, `repo`, `programId` (oder nicht), optional `spawn` und
  eine Autor-Karte (`body.card` → `authorCardFrom`).
- **Ablehnung:** Deckel, Bindung, Repo (409 mit Satz).
- **Gemessen 7 d:** 176 Zeilen, davon `source:"owner"` 139 · `source:"main"` 37; `auftrag` 89
  (70 Owner · 19 MAIN). Der Owner filet also VIER von fuenf Zeilen selbst.

### Stufe 2 · KARTE (Zeile bekommt `card`)

- **Ausloeser:** `server.ts#tickCardSweep` alle `FLEET_CARD_MS` (Wrapper setzen 0 = aus, GLM C6),
  je Tick EIN Repo (`due[0]` entscheidet) und max. 4 Zeilen. `server.ts#cardDue` sagt wann: keine
  Karte, aelterer Validator bei ungueltiger Karte, oder `brief.at` nach `card.at`.
- **Entscheider:** Regel. `card-extract.ts#parseFormattedCard` liest die fuenf Pflicht-Kopfzeilen
  (`ROLLE GROESSE FLAECHE VERIFY DONE`, optional `NEU NACH`) ohne Modell; sonst Haiku
  (`extractCard`, TEXT_ONLY). Beides geht durch `card-extract.ts#validateCard` gegen `git ls-files`,
  Symbolindex, `declaresSymbol`, `LOCAL_PROOF_STEPS`, Harness-Register.
- **Sensor:** `card.valid`, `card.surfaceValid`, `card.gaps[]`, `card.size`, `card.after[]`,
  `card.surface.creates[]`. Jede Lesung eine Zeile in `cards.jsonl`.
- **Ablehnung:** keine — eine ungueltige Karte wird GESPEICHERT (ehrlicher Befund), nur ein
  Transportfehler zaehlt gegen `CARD_MAX_ATTEMPTS`.
- **Gemessen:** 40 offene Zeilen: 14 valid · 9 surfaceValid-aber-ungueltig · 17 beides nicht.
  `cards.jsonl` 84 Lesungen, 18 valid, alle mit `model: claude-haiku-4-5-20251001`, kein
  `source`-Feld in einer Zeile — und die Format-Zeilen von heute (`51df715e 56d2e084 146c06f0
  e04d15f0`, Kopfzeilen `ROLLE/GROESSE/…`) tragen Haiku-Karten mit `validatorVersion 2`:
  **`parseFormattedCard` und Validator v3 stehen im Baum, nicht im Live-Server** (der Baum
  `551cee57` hat beides; welcher Sha live laeuft, wurde hier nicht aus `deploys.jsonl` gelesen).
  **Kein Handgriff.**
  Aber: eine inhaltlich ungueltige Karte wird NIE wieder gelesen, solange Text und
  Validator-Version stehen (`cardDue`, GLM C7-2) — die Zeile bleibt fuer immer
  `flaeche-nur-abgeleitet`, und niemand sieht es ausser am Chip.

### Stufe 3 · FLAECHE BESTAETIGEN (Zeile bekommt `files` + `filesOrigin:"confirmed"`)

- **Ausloeser:** `POST /api/self/tasks/confirm-cards` (`server.ts#confirmCardsForMain`, gebundene
  MAIN, Batch ≤ 20, eigenes Program, eigenes Repo) oder `POST /api/tasks/:id/files` (Owner) oder
  der refine-promote.
- **Entscheider:** MAIN oder Owner. **Handgriff.** Inhaltlich prueft die Tuer nichts, was die Karte
  nicht schon geprueft hat: sie liest `surfaceValid`, prueft die Pfade nochmal gegen den Baum und
  kopiert `card.surface.files` (A–E §B: „Unterschrift ohne zweite Pruefung").
- **Sensor:** `filesOrigin`, `Task.surface{files,ranges,origin,sha}`.
- **Ablehnung:** je Zeile benannt und uebersprungen (kein `auftrag`, nicht offen, schon
  bestaetigt, keine Karte, Flaechen-Luecke, leere Flaeche, Pfad nicht mehr getrackt); Batch-409
  bei fremdem Program/Repo.
- **Gemessen:** `task_cards_confirm` 1 (heute), `task_files_confirm` 13 (0 heute), 4 von 40
  Zeilen bestaetigt, alle in `f170dc46`. Auto-Lift `51df715e` ist gefilet und `queued` — er macht
  diese Stufe fuer `surfaceValid && files && programId` zum Tick-Schritt (`filesOrigin:"card"`).

### Stufe 4 · FREIGABE (`pending → queued`)

- **Ausloeser:** `POST /api/tasks/:id/queue` (Owner-Knopf, `releaseTask(t,"owner")`) oder
  `POST /api/self/tasks/:id/release` (`server.ts#releaseTaskForMain`, gebundene MAIN,
  `releaseTask(t,"machine")`, Audit `task_release`).
- **Entscheider:** Owner oder MAIN. **Handgriff — der einzige, der heute JEDE Zeile trifft.**
  Kein Tick schreibt `queued` ausser dem Requeue nach gescheitertem Spawn und dem
  Boot-Reconcile (Kommentar an `server.ts#releaseTask`).
- **Sensor:** die Tuer prueft acht Dinge, aber KEINES davon ist Welle, Reihenfolge oder Kollision:
  Bindung, Program, Kind, Status, Repo, Harness-Automatisierbarkeit, `PROGRAM_MAX_RELEASED` (5).
  `card.after` (NACH) wird hier NICHT gelesen; `landWaveProjectionNow` NICHT gerufen.
- **Ablehnung:** 409 je Satz; Deckel 5 je Program.
- **Gemessen 7 d:** `task_release` 38 (Slot 6: 10 · Slot 4: 10 · Slot 10: 7 · Slot 3: 4 · andere
  7); Outcomes 7 d `releasedBy`: owner 56 · machine 50 · null 7. Heute: 7, seit 09:34 eine.
  **Alle 39 pending Zeilen warten genau hier.** Und die Reihenfolge, die der Orchestrator heute
  „per NACH von Hand" legte, ist eine Reihenfolge der FREIGABEN, nicht ein Feld, das der Tick liest:
  0 von 40 offenen Zeilen tragen `card.after` (nur `51df715e` nennt `NACH: 2f8897ab` im Text, und
  dessen Karte ist `valid` mit `after` — die Zeile ist bereits `queued`, das Ziel gelandet).

### Stufe 5 · START (Tick gruendet eine Lane)

- **Ausloeser:** `server.ts#tickDispatch` alle `DISPATCH_TICK_MS` (8 s), oldest-first ueber
  `queued` `auftrag`-Zeilen, EINE Lane je Tick.
- **Entscheider:** Regel. Je Zeile in dieser Reihenfolge: Master-Stop (`dispatchOn`, persistiert
  `true`) oder Program-Grant · Harness automatisierbar · Repo-Lane-Deckel (`repoLaneCap`, live
  claude-fleet 3 laut Notiz `0786df49`) · Program-Lane-Deckel · freier Slot · `canDeliver`
  (Autos-Killswitch, Quiet Hours — letztere sind weg seit 2026-09-07).
- **Sensor:** die `waiting:`-Note auf der Zeile (nur bei Aenderung geschrieben).
- **Ablehnung:** skip je Zeile (Deckel sind Eigenschaften der Zeile), return nur bei „kein freier
  Slot".
- **Was der Tick NICHT liest:** die Wellen-Projektion, `card.after`, Kollision mit laufenden
  Lanes (die Kollisionslesung ging am 2026-09-10 mit dem Queue-Analysten, Kommentar in
  `tickDispatch`: „nothing replaced it"). Der Tick startet also zwei Zeilen desselben Programs auf
  derselben Datei parallel, wenn der Deckel es zulaesst, und er startet eine `NACH`-Zeile vor ihrem
  Ziel, wenn beide `queued` sind. **Kein Handgriff — aber blind.**
- **Attended Gegenstueck:** `POST /api/tasks/:id/dispatch` (Owner, `task_dispatch` 24 in 7 d,
  6 heute, alle Slot 3/7 = Orchestrator/Owner) und `POST /api/wave/dispatch` (3 gesamt).

### Stufe 6 · LAND (Lane → main, Zeilen → `done`)

- **Ausloeser:** `POST /api/self/tasks/:id/land` (MAIN unter `program.promotion.selfLand`
  `guarded`/`green-only`, Audit `self_land_start`) oder der Owner-Knopf am Board. Davor: die MAIN
  wird durch `program_main_land_watch` geweckt, wenn die Lane `done-looking` ist.
- **Entscheider:** MAIN oder Owner. **Handgriff je Lane.** Danach Regel: Verify-Kette
  (`watchdog.sh#VERIFY_CMD`, proportional bei docs-only), Post-Land-Audit
  (`server.ts#drainPostLandAudits`).
- **Sensor:** `server.ts#landLane` markiert JEDE Zeile mit `t.slot === s.id && status==="sent"`
  als `done` — die N:1-Kante (`server.ts#waveRowsOf`) existiert also schon fuer jede Lane, nicht
  nur fuer Wellen-Lanes.
- **Gemessen 7 d:** 95 Lands, `landedBy` main 53 · owner 42; `repairRounds` 0 bei allen 95;
  `resolvedConflict` 2 von 95; `confirmedByHuman` 2 von 95; Sitzung p50 125 min (n=78).
  Post-Land-Audit: 568 volle Laeufe, Median 990 s bei 1 Cover, 1 999 s bei 2 Covers (n=18),
  1 673 s bei 3 (n=4); die letzten 30 vollen Audits p50 2 279 s.

### Die Handgriff-Bilanz (7 Tage, `audit.jsonl` + `lane-outcomes.jsonl`)

| Handgriff | Wer | 7 d | heute | Entfaellt? |
|---|---|---:|---:|---|
| Filen (`POST /api/tasks`, `main_task`) | Owner 139 / MAIN 37 | 176 | 4 (`main_task`; Owner-Filen ist unauditiert) | **bleibt** — der Eingang |
| Karte lesen | Tick | — | — | schon Regel |
| Flaeche bestaetigen (`task_cards_confirm`, `task_files_confirm`) | MAIN / Owner | 14 | 1 | **entfaellt** als Vorbedingung (Auto-Lift `51df715e`); bleibt als Override |
| Freigeben (`task_release` + Owner-Knopf) | MAIN 38 / Owner ≈56 | ~94 | 7 | **bleibt als DIE Entscheidung** — wird aber zur Program-Regel statt Zeile-fuer-Zeile (§4 F1) |
| Reihenfolge legen (NACH im Text, seriell freigeben) | Orchestrator | ungezaehlt | ≥ 1 (Brief-Anlass) | **entfaellt** — `card.after` wird vom Tick gelesen (§4 F4) |
| Welle starten (`task_wave_dispatch`) | Owner | 3 | 1 | **entfaellt** — Welle ist Tick-Rechnung (§4 F1/F6) |
| Einzelstart (`task_dispatch`) | Owner/Orchestrator | 24 | 6 | **bleibt** als Notausgang, ohne Deckel wie heute |
| Land (`self_land_start`, Board-Knopf) | MAIN 53 / Owner 42 | 95 | 16 + 3 | **bleibt** (Owner-Entscheid 2026-09-10: Landen gehoert der Betriebs-MAIN); Regel-Anteil steigt ueber `guarded` |
| Audit-Verdikt, Report-Entscheid | MAIN / Owner | — | — | in Arbeit (gamma `601f75dc`) |

Verifiziert: die Zaehlungen. Gefolgert: die Spalte „Entfaellt?", begruendet in §4.

## 2. Wo die Kette heute reisst — drei Stellen, gemessen

1. **Freigabe ist ein Zeilen-Akt ohne Blick auf das Ganze.** `releaseTaskForMain` liest weder
   Welle noch `after` noch laufende Lanes; wer buendeln will, muss ZWEI Zeilen freigeben und
   danach den Owner-Wellen-Knopf druecken, und wer eine Reihenfolge will, gibt seriell frei und
   wartet je Zeile auf ein Land (heute: 7 Freigaben, 5 davon direkt nach einem `land_actor`).
   Kosten: 39 pending Zeilen, Median-Alter > 3 Tage (A–E §0: 27 > 3 d).
2. **Der Tick kennt keine Kollision und keine Reihenfolge.** Zwei `queued` Zeilen auf
   `server.ts` desselben Programs starten parallel (Repo-Deckel 3), und die zweite zahlt beim
   Rebase — historisch 2,0 % `resolvedConflict` (13/659), heute 2/95. Klein, aber der Preis
   liegt bei der Lane, nicht beim Entscheider.
3. **Die Welle braucht drei Zustimmungen, die je einem anderen gehoeren:** Karte (Tick) →
   Bestaetigung (MAIN) → Freigabe beider Zeilen (MAIN) → Wellen-Knopf (Owner). Vier Stellen, drei
   Rollen, und der Sensor (`landWaveProjectionNow`) wird nur von der LETZTEN gelesen. Ergebnis:
   3 Wellen in einer Woche gegen 95 Lands.

## 3. Was Buendelung bei heutiger Queue ueberhaupt bringen kann — Simulation

`bun task-land-waves.ts --state <scratch-kopie> --default-repo /Users/owner/claude-fleet --budget N`
auf drei Kopien der 200 Zeilen (Token-Felder entfernt, `grep -c token` = 0 je Ausgabe):
**A** = live · **B** = Auto-Lift (jede `surfaceValid`-Karte mit Dateien und Program wird
`confirmed`, 7 Zeilen) · **C** = B + die 6 programlosen Zeilen an `f170dc46` gehaengt (11 Zeilen).

| Variante | Budget | Wellen | n>1 | Groessen | Ersparnis | Einzelgruende |
|---|---:|---:|---:|---|---:|---|
| A live | 5 / 8 / 12 | 38 | 2 | 2+2 | 3 430 s | abgeleitet 27 · kein-program 6 · keine-flaeche 3 |
| B Auto-Lift | 5 | 37 | 3 | 2+2+2 | 5 145 s | abgeleitet 20 · kein-program 6 · keine-flaeche 3 · gate-aenderer 3 · null 2 |
| B | 8 | 36 | 2 | 2+4 | 6 860 s | dito |
| B | 12 | 35 | 2 | 2+5 | 8 575 s | dito |
| C + Program | 5 | 36 | 4 | 2+2+2+2 | 6 860 s | abgeleitet 22 · keine-flaeche 3 · gate-aenderer 3 · null 4 |
| C | 12 | 34 | 3 | 2+2+5 | 10 290 s | dito |

Drei Saetze daraus (verifiziert am Sensor, nicht gefolgert):

- **Das Budget ist heute nicht der Deckel — die Fluechen sind es.** Bei Budget 5 bis 12 aendert
  sich die Zahl der Wellen um 3. Was die Zeilen einzeln haelt, sind 20–27 `flaeche-nur-abgeleitet`
  (17 davon ohne `surfaceValid`, also ohne Auto-Lift-Chance: Pfade nicht getrackt, Platzhalter,
  Denkauftraege) und die 3 `gate-aenderer`, die B erst sichtbar macht.
- **Die Paare sind echt, und sie sind die Wellen, die der Orchestrator heute von Hand legt:**
  `7ed73694 + 66df05b4` und `e3e5084a + 1b47e29a` (beide f170dc46, `sharedFiles` leer = Kante
  ueber Bereichs-Rueckfall auf `server/types.ts`/`src/client.ts`), unter B dazu
  `a05fa7ff + 9940ec64` (f9dc8e10, `server.ts`).
- **Der Fuenfer bei Budget 12 ist der Klumpen, vor dem §7.2 warnt** (`server.ts`-Nabe, 10
  Einheiten in einer Lane) — das Budget 5 haelt ihn zu Recht auf zwei Paare.

Kosten je Zusatzzeile in einer Welle, am Audit-Ledger: ein 2-Cover-Audit dauert im Median
1 999 s gegen 990 s bei einem Cover, also ~1 000 s mehr, und spart ein ganzes Land (107 s Gate +
1 608 s Audit aus `LAND_WAVE_COSTS_2026_09`, gemessen 990–2 279 s). Netto ~700 s je Zusatzzeile
(die Brief-Zahl 1 715 s ist die Audit-Dauer eines 3-Cover-Audits, n=4 — kein belastbarer Median).
**F3-Antwort:** Budget 5 mit Default `mittel` = 2 ist richtig dimensioniert; was fehlt, sind
Groessen (33 von 40 ohne) — das ist ein Filing-Format-Problem (`GROESSE:`-Zeile), kein
Budget-Problem. Eine Zeile ohne Groesse als `mittel` zu zaehlen ist die sichere Seite und bleibt.

## 4. Der Entwurf — sechs Antworten

Leitsatz, dem alles folgt: **Eine Zeile wird EINMAL entschieden (Freigabe), alles danach ist
Rechnung.** Der Tick liest je Program die freigegebenen Zeilen als EINE Menge und beantwortet
„was startet jetzt, mit wem, in welcher Reihenfolge" deterministisch aus Karte, Sensor und
Lane-Zustand. Die Rechnung heisst hier **Startplan**; sie ist ein Projektor wie
`landWaveProjectionNow`, kein neuer Objekttyp.

### F1 · Wer darf was, ohne dass jemand klickt?

**Die Grenze „kein Tick startet eine nie freigegebene Zeile" BLEIBT.** Sie ist die eine
Invariante, die den Owner vor seiner eigenen Queue schuetzt (139 Owner-Filings in 7 Tagen, viele
davon Notizen und Entwuerfe, `capTasks` haelt die Liste bei 200). Was sich aendert, ist die
KOERNUNG der Freigabe:

- **Freigabe wird Program-Regel, Zeile-fuer-Zeile bleibt Override.** Ein Program traegt eine
  Freigabe-Politik (Vorschlag, Feldname offen): `manual` (heute) · `card-valid` (jede Zeile des
  Programs mit `card.valid && card.surfaceValid && card.size` gilt als freigegeben, sobald die Karte
  steht) · `all` (jede `auftrag`-Zeile). Der Tick liest die Politik, nicht die MAIN. Die MAIN und
  der Owner koennen weiter einzeln freigeben und — neu — einzeln ZURUECKHALTEN (`hold`, heute
  `unqueue`). **Owner-Entscheid je Program**, ausdruecklich nicht vorweggenommen: `card-valid`
  ist die Fassung, unter der eine Zeile ohne pruefbares DONE nie startet, denn `validateCard`
  verlangt es.
- **Freigabe ist die Stelle fuer Buendel UND Reihenfolge — weil sie die einzige Stelle ist, an
  der eine MENGE bekannt ist.** Der Startplan rechnet ueber die freigegebenen Zeilen eines
  Programs: Welle (`wavesFor`) und `after`-Ordnung (`placeByAfter`) sind darin schon EINE
  Rechnung, `task-land-waves.ts#wavesFor` ruft `afterOrder` VOR `componentsOf` und
  `placeByAfter` danach. Was fehlt, ist nur der Leser: `tickDispatch` nimmt heute `candidates[0]`
  nach `created`; er muss stattdessen die ERSTE PLATZIERTE WELLE des Startplans nehmen, deren
  Zeilen alle `queued` sind und deren `after`-Ziele alle `done` sind.
- Was der Tick damit tun darf: eine Welle als EINE Lane starten (`dispatchTask` mit `wave`-Arg,
  heute nur vom Owner-Knopf befuellt) — unter denselben Deckeln wie eine Einzelzeile, mit einem
  neuen Audit-Ereignis (`task_wave_start`, `by:"tick"`). Was er nicht darf: eine Welle bilden, deren
  Zeilen nicht alle freigegeben sind (eine Teilmenge ist keine Welle — dieselbe Regel, die
  `POST /api/wave/dispatch` heute mit exakter Mengengleichheit durchsetzt; im Startplan heisst
  sie: eine projizierte Welle mit einer `pending` Zeile darin startet NICHT, die Zeile bekommt die
  Note `waiting: wave partner <id> is not released`).

Das ist die **Architektur-Umkehrung der §5-Schnittlinie** („automatische Wellenbildung im Tick …
bewusst NICHT auf dieser Liste, weil keiner ohne die gemessene Wellengroesse zu bewerten ist").
Die Wellengroesse IST jetzt gemessen (§3: Paare, 3 430–6 860 s je Woche bei heutiger Queue; 3
Owner-Wellen in 7 Tagen). Ob das die Umkehrung rechtfertigt, ist **Owner-Entscheid** — der Befund
sagt nur, dass der Grund fuer die Schnittlinie nicht mehr besteht.

### F2 · Was ersetzt die MAIN-Bestaetigung?

**Auto-Lift `51df715e` plus die Freigabe-Politik aus F1 — mehr nicht.** Die Bestaetigung war die
Unterschrift unter eine Karte, die ihre Pfade schon gegen den Baum bewiesen hat (§1 Stufe 3); mit
`filesOrigin:"card"` und der Bereichs-Wache in `collidesOn` faellt sie als Vorbedingung. Was die
MAIN behaelt: den Override (`confirmed` schlaegt `card`), das Zurueckhalten (`hold`) und das Land.

**Program ohne lebende MAIN:** die Kette lief bisher an drei Stellen ueber die MAIN — Bestaetigen,
Freigeben, Landen. Nach F1/F2 haengt nur noch das LAND an ihr, und das ist richtig so (Owner
2026-09-10). Also: ein Program ohne exakte Bindung (`boundProgramForMain` findet keinen Match,
heute Biber `9ce08219`) startet unter Politik `card-valid` weiter Lanes, und die Lanes landen
NICHT von selbst — sie werden `done-looking`, `program_main_land_watch` hat keinen Empfaenger, und
das Board zeigt „no MAIN to land". Das ist ein SICHTBARER Stau statt eines stillen; der Owner
landet vom Board oder bindet eine MAIN. Zusaetzliche Regel, klein: unter Politik `card-valid`
startet der Tick fuer ein Program ohne exakte Bindung hoechstens EINE Lane (statt Repo-Deckel),
damit ein verwaistes Program nicht drei done-looking Lanes stapelt.

Leichtgewicht ist der andere Fall: Bindung lebt, aber auf dem Controller (Slot 10), der 7
Freigaben in 7 Tagen tat und 14 Zeilen pending haelt. Politik `card-valid` loest das ohne
Umbinden — der Controller behaelt Land und Override.

### F3 · Buendelgroesse

Siehe §3: **Budget 5, Default 2, bleibt.** Aenderung nur an der Quelle der Groessen — die
`GROESSE:`-Kopfzeile ist bereits Pflichtfeld des Formats (`FORMAT_REQUIRED`); die vier
Format-Zeilen von heute tragen als einzige neben `e3e5084a`/`1b47e29a` eine Groesse, gelesen von
Haiku aus dem Kopf (§1 Stufe 2: der Parser ist noch nicht live). Die Rangliste A–E Posten 1 (Format) ist damit die Vorbedingung
fuer jede Welle mit mehr als zwei Zeilen; ohne Groessen zaehlt alles 2 und der Fuenfer bleibt
strukturell aus. Keine Budget-Aenderung, kein Owner-Entscheid noetig.

### F4 · Reihenfolge und Kollision als dieselbe Rechnung

Heute drei getrennte Entscheider: `NACH` (Text, vom Menschen seriell freigegeben),
`collidesOn` (nur im Wellen-Sensor, nur fuer LANDE-Wellen), Lane-Deckel (`tickDispatch`, zaehlt
Lanes, kennt keine Dateien). Der Startplan verschmilzt sie so:

1. **Eingabe:** die freigegebenen `auftrag`-Zeilen eines Repos (alle Programs), die laufenden
   Lanes mit ihren `Task.surface.files/ranges` (die Zeile der Lane traegt sie), die Deckel.
2. **Wellen:** `projectLandWaves` wie heute (R1–R4, Program-Grenze, `after`-Ordnung).
3. **Parallel-Kanten:** zwei Wellen desselben Repos duerfen NICHT gleichzeitig laufen, wenn
   `collidesOn` zwischen einer ihrer Zeilen und einer Zeile der anderen (oder einer LAUFENDEN
   Lane) wahr ist — derselbe Rueckfall („kein Bereich = kollidiert") wie heute, auf der sicheren
   Seite. Das ist die Kollisionslesung, die am 2026-09-10 mit dem Analysten ging, als
   deterministische Rechnung statt Modellurteil (der Kommentar in `tickDispatch` nennt genau
   diese Alternative: „a computed intersection of predicted file surfaces is a different check").
4. **Reihenfolge:** `after`-Kanten ueber Wellen hinweg (`placeByAfter` liefert sie) UND
   Kollisionskanten ergeben eine Startordnung; `after` ist hart (Ziel muss `done` sein),
   Kollision ist weich (Ziel muss GELANDET oder geschlossen sein — nicht bloss `done-looking`).
5. **Ausgabe je Tick:** die erste Welle ohne offene harte Kante, ohne Kollision mit einer
   laufenden Lane, unter den Deckeln. Alle anderen tragen eine benannte Note
   (`waiting: after 2f8897ab not landed` · `waiting: collides with lane 3 on server.ts#taskView`
   · `waiting: 3/3 lanes`).

**Preis, benannt:** eine Kollisionskante auf Datei-Rueckfall (kein Symbolindex fuer die Zeile)
serialisiert mehr, als noetig waere — §3 zeigt, dass beide heutigen Paare genau ueber diesen
Rueckfall haengen. Mit Format-Karten (`FLAECHE: datei#symbol`) und `graphify-out/` im
Haupt-Checkout (`ranges` nur dort, in der Lane `null`) wird die Kante scharf. `land-collision-stats.ts`
(seit `1f9da6b6`) misst Praezision/Recall von R4 gegen echte Hunks — die Zahl gehoert VOR den
Bau von Schritt 3 gefahren (hier nicht getan).

### F5 · Was sieht der Owner?

**Eine Sicht je Repo: der Startplan.** Statt 40 Zeilen mit Chips: die geordnete Liste der
Wellen, je Welle `{ids, klasse, units/budget, warum zusammen (sharedFiles oder Bereich), was sie
haelt (after / Kollision mit Lane n / Deckel / nicht freigegeben: welche Zeile), naechster
Start: jetzt | nach <id> | nach Land von Lane n}`, darunter die Einzelzeilen mit ihrem
`reasonAgainst` — genau die Felder, die `LandWave` heute schon traegt, plus die drei Wartegruende
aus F4. Die Zeilen-Detailsicht bleibt fuer Text und Karte. Der Owner-Wellen-Knopf und der
Einzelstart werden zu EINEM Knopf „jetzt starten" auf einer Welle des Plans (attended, ohne
Deckel, wie heute `task_dispatch`). Der Plan ist dieselbe Projektion, die der Tick liest — nie eine
zweite Rechnung (dieselbe Regel, mit der `landWaveProjectionNow` Board und Knopf zusammenhaelt).

### F6 · Was faellt WEG

| Teil heute | Urteil | Warum |
|---|---|---|
| `POST /api/wave/dispatch` als eigener Owner-Knopf | **weg** — wird „jetzt starten" auf einer Plan-Welle | die Route erzwingt Mengengleichheit mit dem Sensor; im Plan ist die Welle schon der Sensor, ein zweiter Pfad mit eigener Validierung ist doppelt |
| `POST /api/self/tasks/confirm-cards` als VORBEDINGUNG des Buendelns | **weg** als Vorbedingung, **bleibt** als Override (`confirmed` > `card`) | A–E §B, Auto-Lift `51df715e`; die Tuer prueft inhaltlich nichts, was die Karte nicht prueft |
| `POST /api/self/tasks/:id/release` Zeile-fuer-Zeile | **bleibt** als Override, hoert auf, der Normalweg zu sein | F1: Program-Politik |
| `PROGRAM_MAX_RELEASED` (5 je Program) | **weg** unter Politik `card-valid`/`all` (die Menge der freigegebenen Zeilen ist dann die Queue selbst, gedeckelt von `PROGRAM_MAX_PENDING` und den Lane-Deckeln); bleibt fuer `manual` | ein Deckel auf einer Zaehlung, die es dann nicht mehr gibt |
| `card.after` als Karten-Feld ohne Leser im Tick | **bleibt, bekommt seinen Leser** | F4 |
| Lane-Deckel je Repo/Program | **bleiben** | sie deckeln Maschinenlast; der Plan sortiert nur, wer als Erster durch darf |
| `waiting:`-Noten je Zeile | **bleiben, werden auf drei Saetze normiert** | F4 Schritt 5 |
| Queue-Overlay mit 40 Zeilen | **wird zweitrangig** hinter dem Startplan | F5 |
| `POST /api/tasks/:id/dispatch` Einzelstart ohne Deckel | **bleibt** | Notausgang des Owners |

Kleiner wird das System um: einen Owner-Knopf mit eigener Validierung, einen Zaehl-Deckel, eine
Vorbedingung und eine Sicht. Groesser um: einen Projektor (Startplan = `projectLandWaves` +
Kollisionskanten + Lane-Zustand), eine Program-Politik (ein Feld), einen Tick-Leser.

## 5. Drei Bau-Schnitte, in dieser Reihenfolge — jeder mit pruefbarem Done

Vorbedingungen, die schon laufen und hier NICHT wiederholt werden: Auto-Lift `51df715e` (Stufe 3
wird Tick), gamma `601f75dc` (Entscheidungen per Regel), Format A (Groessen).

### Schnitt 1 · Der Startplan als Sensor (read-only, kein Dispatch)

`start-plan.ts` neben `task-land-waves.ts`: nimmt `projectLandWaves`-Ausgabe, laufende Lanes
(`{slot, files, ranges, programId, repo}`), Deckel; liefert je Repo die geordnete Wellenliste mit
`{next: "now" | {after: id} | {collides: {slot, file, symbol?}} | {cap: sentence} | {unreleased: id[]}}`.
`GET /api/start-plan` (Owner) und `bun start-plan.ts --state fleet.json` liefern dasselbe Objekt;
der Client rendert es als Sicht neben der Queue (F5).

*Done:* (1) Ueber die live `fleet.json` von heute liefert der Plan fuer claude-fleet genau die
2 Wellen aus §3 A mit `next:{unreleased:[…]}` (beide Partner pending) und fuer `51df715e`
`next:"now"`; (2) ein Check in `e2e/tasks.ts` beweist mit gepinnten Fixtures: eine Zeile mit
`after` auf eine nicht-`done` Zeile ⇒ `{after}`; zwei Wellen mit `collidesOn`-Kante auf
Datei-Rueckfall ⇒ die zweite `{collides}`; eine laufende Lane auf derselben Datei ⇒ `{collides:
{slot}}`; Mutation „Rueckfall = disjunkt" macht den Check rot; (3) Reinheit: zweimal gerufen =
identisch; (4) `bun e2e/pins.ts` gruen, Pin: `tickDispatch` importiert den Plan NICHT (der Sensor
ist in diesem Schnitt nur Sicht).
*Verify:* volle Kette; `./e2e-isolated.sh` als Vorschau (neues `e2e/`-Modul; ueber Suite-Offer).

### Schnitt 2 · Der Tick liest den Plan (Start = Rechnung)

`tickDispatch` ersetzt `candidates[0]` durch die erste Welle des Plans mit `next:"now"`, ruft
`dispatchTask` mit `wave`-Arg fuer n>1 (die Abbruch-/Split-/Land-Pfade sind seit S3 fuer n Zeilen
gebaut: `detachSlotTasks`, `/api/self/wave/split`, `landLane`), schreibt die drei normierten Noten,
auditiert `task_wave_start by=tick`. `POST /api/wave/dispatch` wird zum Alias von „diese Plan-Welle
jetzt" (F6). Program-Politik NOCH `manual` — die Menge der freigegebenen Zeilen aendert sich in
diesem Schnitt nicht, nur ihre Ordnung und Buendelung.

*Done:* (1) Scratch-Instanz (`FLEET_CMD=true`, eigener Socket): zwei freigegebene Zeilen desselben
Programs mit bestaetigter gemeinsamer Datei starten als EINE Lane mit `wave lane` im Label und
EINEM `task_wave_start`; drei freigegebene Zeilen, `C after B`, `B` kollidiert mit `A` auf
`server.ts` ohne Bereich: Reihenfolge der Starts ist A, (Land A), B, (Land B), C, und jede wartende
Zeile traegt ihre Note; (2) Gegenprobe: eine Welle mit einer `pending` Zeile startet NICHT und die
`queued` Zeile traegt `waiting: wave partner … not released`; (3) `land-collision-stats.ts` VOR dem
Land gefahren und die Zahl in der Land-Note zitiert — Recall < 0,9 heisst: Kollisionskante bleibt
Datei-Rueckfall (sicher), nur `after` und Welle gehen live; (4) volle Kette + `./e2e-clean-review.sh`
(Merge-/Land-Pfad beruehrt) + `./e2e-isolated.sh` gruen.
*Owner-Entscheid davor:* die §5-Schnittlinie faellt (F1). Dieser Schnitt wird nicht ohne den
Entscheid gefilet.

### Schnitt 3 · Freigabe als Program-Politik

`Program.release: "manual" | "card-valid" | "all"` (Owner-Route wie `promotion`), Tick liest
`released(t) = t.status==="queued" || (policy(t.programId)==="card-valid" && card.valid &&
card.surfaceValid && card.size) || policy==="all"`; `hold` als Gegenakt (`POST /api/self/tasks/:id/hold`,
MAIN, schreibt eine Sperre, die die Politik nicht ueberstimmt); `PROGRAM_MAX_RELEASED` gilt nur
noch unter `manual`; ein Program ohne exakte Bindung startet unter `card-valid` hoechstens eine
Lane (F2).

*Done:* (1) Scratch-Instanz: Program auf `card-valid`, drei Zeilen — Format-Karte valid mit
Groesse · valid ohne Groesse · ungueltig — genau die erste startet, die zwei anderen tragen
`waiting: not released (card …)`; `hold` auf der ersten stoppt sie vor dem Start und der Tick
schreibt die Note; (2) Program ohne Bindung auf `card-valid`: nach einem Start bleibt die zweite
Zeile mit `waiting: no bound MAIN to land — one lane at a time`; (3) `manual`-Program: Verhalten
byte-gleich zu heute (Check: derselbe Fixture-Lauf vor/nach dem Schnitt, `task_release` weiter
noetig); (4) Pin: die Politik wird NIE aus einem Self-Body gelesen; volle Kette gruen.
*Owner-Entscheid davor:* je Program die Politik — Vorschlag: Fleet-Betrieb `card-valid`,
Leichtgewicht `card-valid`, Biber `manual` (auf Eis).

— Schnittlinie — Nicht in diesem Entwurf: ein Modell, das Zeilen priorisiert (der Plan ordnet
nach `after`, Kollision und `created`, nichts anderes); ein Auto-Land ohne MAIN (Owner-Entscheid
2026-09-10 gilt); Program-uebergreifende Wellen (R-Program-Grenze bleibt); ein Pull-Kanal fuer
Lanes (Q3 aus `144e84ff` bleibt offen).

## 6. Was gefolgert ist und wo es bricht

- **Gefolgert:** dass Politik `card-valid` die 14 Leichtgewicht-Zeilen bewegt. Nur 6 davon haben
  `card.valid` (`a05fa7ff 9940ec64 67abe12c` + 3), und 0 eine Groesse — unter der vorgeschlagenen
  Regel starten heute NULL, bis die Zeilen im Format neu gefilet sind. Das ist Absicht (eine
  Zeile ohne Groesse und DONE startet nicht unbeaufsichtigt), aber es heisst: Schritt 3 bringt erst
  mit Format A Durchsatz.
- **Gefolgert:** dass die Kollisionskante auf Datei-Rueckfall den Durchsatz nicht unter heute
  drueckt. Heute startet der Tick blind parallel; der Plan serialisiert Zeilen auf derselben Datei
  ohne Bereich. Bei 27 von 41 Flaechen mit `server.ts` (09-12-Befund) kann das den Repo-Deckel 3
  faktisch auf 1 senken. Darum Done (3) in Schnitt 2: die Kante geht nur live, wenn
  `land-collision-stats.ts` einen Recall ≥ 0,9 zeigt — sonst bleibt Kollision advisory in der Sicht.
- **Nicht gemessen:** wie lange eine `queued` Zeile heute bis zum Start wartet (kein
  `releasedAt`; `task_release`-Zeitstempel gegen `slot_open` waere der Join, hier nicht gerechnet).
  Wenn das Warten heute schon Minuten ist, ist der Startplan ein Sicht-Gewinn, kein
  Durchsatz-Gewinn — der Durchsatz-Gewinn liegt dann ganz in Schnitt 3.
