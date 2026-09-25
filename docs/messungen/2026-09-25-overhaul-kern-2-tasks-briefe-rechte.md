# Kern 2: Tasks, Karten, Briefe, Rollen und Berechtigung (Befund, 2026-09-25)

**Abdeckung.** Gelesen habe ich in `server.ts` die Task-Türen (Self und Owner), `tickDispatch`, `briefAndSend`, das Karten-Format und die Kartenextraktion, dazu die Release-, Hold-, Brief- und Confirm-Funktionen. Außerdem `wave-brief.ts#renderCardHead/withCardHead`. Ausgewertet habe ich die Ledger `fleet.json`, `tasks-archive.jsonl`, `cards.jsonl`, `lane-outcomes.jsonl`, `audit.jsonl` und `context-receipts.jsonl`.
**Zeiträume.** Die Ledger decken verschiedene Spannen ab: Archiv 2026-09-15 18:06 bis 09-25 14:11, `audit.jsonl` 09-20 11:56 bis 09-25 14:15, `cards.jsonl` 09-13 bis 09-25. „Seit 09-15“ heißt: Zeile ab 2026-09-15 angelegt, Archiv und Live-Queue zusammengeführt, dedupliziert nach id.

**Soll die Abstraktion existieren?** Ja, ein durables Auftragsregister mit prüfbarem Kopf ist die richtige Naht zwischen dem, der denkt, und dem, der baut. In der heutigen Form existiert es aber zweimal: einmal als fein geschnittenes Türensystem für Self-Tokens und einmal als Owner-Token, über den die tatsächlich orchestrierende Rolle fast alles fährt.

---

## 1. Prozesskarte

```
Owner/Orchestratorin ──POST /api/tasks (owner-Token, kein audit)──┐
Program-MAIN ──POST /api/self/tasks (Default notiz, Deckel 5)──────┤→ Task{kind,text,spawn?,card?}  status pending
Steward ──POST /api/steward/tasks (ohne programId)─────────────────┘
        │ Kartenleser (FLEET_CARD_MS=60000): formatCardOf (Kopfzeilen, 0 ms) sonst Modell (FLEET_CARD_MODEL)
        ▼
   pending ──release── queued ──tickDispatch (Startplan: after/Kollision/Deckel/Harness/Slot)── sent ── Lane ── land ── done
     │  Türen: owner ▸queue · MAIN /self/tasks/:id/release (manual: gültige Karte + Deckel 5) · Policy card-valid/all
     │  Hold: MAIN /self/tasks/:id/hold  (stoppt Start unter jeder Policy)
     └─ archived (ohne Lauf)
Brief an die Lane = KARTE-Kopf + (brief ?? text) + Kommentare + Notizen + Code-Snippets + Studio + Anker + Exit-Footer + Memory
                    (server.ts#briefAndSend: `deliveredBrief`, Zeile ~15470)
```

### Rechte-Matrix (am Code verifiziert, Stellen in Klammern)

| Aktion | Owner-Token | Orchestratorin | Program-MAIN (Self, gebunden) | Steward (Self+Label) | Lane (Self) |
|---|---|---|---|---|---|
| Zeile anlegen | ja, jede kind, jedes Program, `queue:true` gibt direkt frei (server.ts:41649–41721), **kein audit** | nur über den Owner-Token; eine Self-Tür bekommt sie nicht, weil `boundProgramForMain` für ungebundene Sessions scheitert (server.ts:12640) | eigenes Program, Default `notiz`, Deckel `PROGRAM_MAX_PENDING`=5 je Kategorie (`createTaskForMain` 14011) | `/api/steward/tasks`, ohne programId (38143) | 409 (38862) |
| kind ändern | `/api/tasks/:id/kind` | Owner-Token | — | — | — |
| Worker (spawn) ändern | `/api/tasks/:id/spawn` (41726) | Owner-Token | **nur beim Anlegen** | — | — |
| Brief schärfen | `/api/tasks/:id/brief` | Owner-Token (wird als `by:"owner"` gestempelt) | eigenes Program, nicht über einen `by:"owner"`-Brief hinweg (`sharpenBriefForMain` 13115) | ja (gebunden) | 409 |
| Fläche bestätigen | `/api/tasks/:id/files` | Owner-Token | `confirm-cards`, bis 20 Zeilen (13184) | ja | nur vorschlagen: `files-proposal` (38756) |
| Freigeben | ▸queue, **kein audit** (42294ff) | Owner-Token | eigenes Program + gültige Karte + Deckel 5 nur unter `manual` (`releaseTaskForMain` 13304) | ja | 409 |
| Anhalten (hold) | — | — | eigenes Program (13454) | ja | 409 |
| Hand-Dispatch | `/api/tasks/:id/dispatch`, umgeht Deckel, Startplan und Kartenregel (41959–42040) | Owner-Token | — | — | — |
| Release-Politik / Dispatch-Grant | `/api/programs/:id/release`, `/dispatch` (34013, 33963) | Owner-Token | — | — | — |
| Kriterium | bestätigen (42264) | Owner-Token | — | — | vorschlagen (`/api/self/criterion` 39107) |
| Welle teilen | — | — | — | — | nur die eigene Welle (`/api/self/wave/split`) |
| Landen | Owner-Route | Owner-Token (98× `owner_token_ambient_use` in 5 Tagen) | `/self/tasks/:id/land`, nur eigenes Program | 409 | 409 |

Astra hat keinen eigenen Prinzipal. Sie erbt die Rechte der Rolle, deren Slot sie besetzt (MAIN oder Lane).

---

## 2. BLEIBT (wirkt nachweislich)

- **Kopfzeilen-Format** ROLLE/GROESSE/FLAECHE/VERIFY/DONE/VERBOTEN mit deterministischem Parser. 256 von 302 gelaufenen Aufträgen seit 09-15 tragen alle fünf Pflichtzeilen. `formatCardOf` (server.ts:15921) liefert 0 ms und ist in 249 von 323 Fällen gültig. Die Land-Quote seit 09-15 liegt bei 319 von 340 Lane-Ausgängen (94 %).
- **Kartengültigkeit als Freigabebedingung** (`releaseCardRefusal` 13235ff). Sie hält eine Lane auf, bevor sie Arbeit verbraucht. In mindestens 10 Archiv-Gründen steht wörtlich „Kartenkopf ungültig“ oder „Kartenlücke“, danach folgte eine Ersatzzeile. Die Regel greift also; der Preis dafür steht in Ä2.
- **Scope aus der Bindung statt aus dem Body.** Das Program kommt aus der Bindung, das Repo aus dem Checkout, und der Body ist geschlossen. Das gilt für alle MAIN-Türen (13115, 13184, 13304, 14011). Einen Vorfall habe ich nicht gefunden; das ist ungeprüft über 09-20 hinaus.
- **Wartegrund an der Zeile.** `tickDispatch` überspringt Zeilen statt abzubrechen und schreibt `waiting: …` auf die Zeile (17203ff). Alle 13 offenen `auftrag`-Zeilen tragen einen lesbaren Grund (fleet.json, gemessen).
- **Hold mit `grund`.** 80 Ereignisse an 41 Zeilen in 5 Tagen, die Gründe sind lesbar im Audit. Das Werkzeug wird wirklich benutzt, siehe aber Ä4.
- **DONE mit Falsifikation, wörtliches VERIFY, VERBOTEN, Such-Kommando.** In allen fünf Stichproben (§5) haben diese Teile nachweislich das Ergebnis geformt.
- **Parken nach drei Blockier-Bildschirmen** (`DISPATCH_PARK_AFTER`=3, server.ts:4549, Commit `036df834` vom 09-24 20:15). Davor lief Zeile `52c33c3b` 241-mal in 32 min in dieselbe Trust-Abfrage (audit 09-24 13:39–14:11, dazu 55-mal `f02fbb36`). Ob der Fix live ist, habe ich nicht geprüft.

---

## 3. ÄNDERN (gerankt nach Wirkung)

**Ä1. Die orchestrierende Rolle hat keinen eigenen Prinzipal und fährt den Owner-Token. Dadurch ist die Herkunft im Ledger falsch.**
- Beleg: Die Self-Task-Türen verweigern jeder ungebundenen Session (`boundProgramForMain` server.ts:12640).
  - `POST /api/tasks` stempelt `source:"owner"` und schreibt keine Audit-Zeile (41649–41721). ▸queue, archive und delete sind ebenfalls nicht auditiert (42294ff, nur unarchive).
  - 154 von 289 Owner-Zeilen seit 09-15 weisen sich im Text selbst als agentisch aus („Orchestratorin“, „gefilet … von … Slot“). Das ist ein Heuristik-Untergrenzwert.
  - Alle 35 Briefe mit `by:"owner"` nennen die Orchestratorin als Autorin.
  - `task_spawn` 150-mal in 5 Tagen, jedes Mal `slot=undefined`, also über die Owner-Route.
  - `owner_token_ambient_use` 98-mal, jeweils ein Land am MAIN vorbei.
- Kosten:
  - Das Ledger kann Owner-Entscheid und Agenten-Entscheid nicht trennen. Die Owner-Vorgabe „Owner raus aus der Bewertungsschleife“ ist deshalb unmessbar.
  - Die feine Propose/Promote-Architektur (Lane schlägt vor, MAIN bestätigt, Owner promoviert) gilt nur für den, der den Token nicht hat.
  - `sharpenBriefForMain` sperrt eine MAIN aus einem Brief aus, den in Wahrheit die Orchestratorin geschrieben hat (13128).
- Richtung: Die Orchestratorin bekommt eine eigene Rolle mit eigenem Token und benanntem Scope. Jede Task-Mutation schreibt `actor{kind,slot,session}` ins Audit. Der Owner-Token bleibt dem Board vorbehalten.

**Ä2. Editieren geschieht als Neu-Filen. 23 % der Aufträge enden ohne Lauf.**
- Beleg: Von 410 `auftrag`-Zeilen seit 09-15 wurden 96 archiviert, davon nur 3 mit einem Lane-Ausgang.
  - Von 58 Archivierungen mit Grund heißen mindestens 24 „ersetzt durch …“ oder „neu gepostet“: Kartenkopf ungültig, falsches Modell, Umstellung auf GLM oder Sol.
  - 38 Archivierungen haben gar keinen Grund.
  - Eine MAIN kann den Worker nur beim Anlegen setzen, einen Self-Spawn-Pfad gibt es nicht (Liste der Self-Routen: 7 Task-Subrouten, keine `spawn`).
  - Die Modellwechsel laufen darum über die Owner-Route: 150 `task_spawn` in 5 Tagen.
- Kosten: Jede Ersatzzeile ist eine neue id. Kette, `after`-Bezüge, Kommentare und Kartenhistorie reißen ab. Die Queue-Zahlen sind aufgebläht, und die dritte Queue-Sichtung in 24 h (Memory-Eintrag vom 09-18) ist ein Symptom davon.
- Richtung: Eine MAIN-Tür für `spawn` und für eine Neufassung des Kopfes an derselben id. Archivieren nur noch mit Pflichtgrund.

**Ä3. Notizen an Lanes sind überwiegend Ballast.**
- Beleg: `note_verdict` in 5 Tagen 174-mal: 164 „offen“ (94 %), 6 „erledigt“, 4 „widerlegt“.
  - Das waren 26 verschiedene Notizen bei 83 Lanes. Notiz `d53b7c98` (Befund vom 09-02, 23 Tage alt) wurde 28-mal zugestellt und 28-mal als „offen“ beurteilt.
  - 97 von 244 Zustellungen seit 09-21 trugen Notizen, zusammen 210.
  - Die Stichprobe b6a67f36 zeigt es wörtlich: „Alle vier zugestellten Notizen wurden einzeln als offen beurteilt“.
- Kosten: Jede Lane zahlt Lese- und Urteilsturns für Befunde, die mit ihrer Fläche nichts zu tun haben. Die 6 Schließungen stehen gegen 174 Urteile.
- Richtung: Zustellen nur bei Flächenschnitt. Nach dem zweiten „offen“ ohne Flächenbezug nicht mehr an dieselbe Fläche zustellen.

**Ä4. FLAECHE sagt die berührten Dateien schlecht voraus. MAINs gleichen das mit Hand-Holds aus.**
- Beleg: 117 von 258 gelandeten Lanes mit Kartenfläche (45 %) berührten Dateien außerhalb der Fläche, im Median 2.
  - `filesTouched` habe ich gegen `git show` des Land-Commits geprüft: 60 von 60 identisch.
  - Die häufigsten Ausreißer sind mechanische Mitläufer: `e2e/pins.ts` 40, `server/audit-log.ts` 20, `docs/messungen/INDEX.md` 10, `docs/repo-map.generated.md` 8.
  - Holds stellen sichtbar Hand-Reihenfolge her, z. B. „Hält den server.ts-Platz frei für …“ (audit `task_hold` 8bd19aac).
- Kosten: Kollisionsprüfung und Wellenbündelung im Startplan rechnen mit einer Fläche, die in fast der Hälfte der Fälle zu klein ist. Den Rest leisten MAIN-Kontext und Holds.
- Richtung: Deterministische Mitläufer-Regeln ergänzen (neues Audit-Event → `server/audit-log.ts`, neue Messnotiz → `INDEX.md`, neue Route → `e2e/pins.ts`/`security.ts`) oder aus der Co-Change-Historie ableiten.

**Ä5. Die Karte steht doppelt im Brief, ihr ZIEL ist oft falsch und ihre ROLLE stimmt nicht.**
- Beleg: 224 von 302 Lanes bekamen den KARTE-Kopf (`wave-brief.ts#renderCardHead`, bis 1,5 KB) vor einer Prosa, die dieselben Kopfzeilen schon trägt (`withCardHead` wave-brief.ts:138).
  - `ZIEL` ist bei gültigen Karten oft ein Nicht-Ziel: mindestens 33 von 255 beginnen mit SUCHE, WARUM, NACH, QUELLEN oder VORBEDINGUNG. Stichproben: b6a67f36 hat „ZIEL: SUCHE: rg -n …“, 87b9482b hat „ZIEL: WARUM DIESE ROLLE …“.
  - Die ROLLE in der Karte weicht in 16 von 177 Fällen vom tatsächlichen `spawn` ab.
  - Kartengültigkeit sagt den Ausgang kaum voraus: gültig 261 von 273 gelandet (95,6 %), ungültig 55 von 60 (91,7 %).
- Kosten: Die erste Zeile, die eine Lane liest, ist in einem relevanten Teil der Fälle falsch. Einer Codex-Lane wird gesagt, sie sei „claude/opus-5-5“. Dazu kommen rund 1,4 KB Dopplung je Brief.
- Richtung: Ein Rendering. ZIEL muss ein Pflichtfeld mit eigenem Label sein und darf nicht der erste freie Absatz sein. Die ROLLE-Zeile gehört nicht in die Bytes an die Lane (sie ist Dispatch-Metadatum).

**Ä6. Freigeben ist Handarbeit, weil nur 1 von 8 aktiven Programs eine Politik hat.**
- Beleg: `release.policy` ist nur bei f170dc46 gesetzt (`card-valid`). In 5 Tagen gab es 108 `task_release` über die MAIN-Tür gegen 45 durch die Politik.
  - Nach Politik-Freigabe war die Lane im Median nach 1,6 h fertig, nach MAIN-Freigabe nach 4,5 h. Das ist durch das Program konfundiert, nicht bereinigt.
- Kosten: Jede Freigabe ist ein MAIN-Turn auf einem 1M-Kontext. Die Wartezeit zwischen Anlegen und Freigabe hat ein p75 von 6,8 h.
- Richtung: `card-valid` als Default für neue Programs. Der Hold bleibt das Gegenmittel.

**Ä7. Tote oder unbenutzte Türen und Maschinerie.**
- Beleg: Brief-Kompiler aus (`FLEET_BRIEF_MS` nicht gesetzt, `BRIEF_TICK_MS`=0, server.ts:15615). Brief-Gegenlese aus (`FLEET_BRIEF_REVIEW` nicht gesetzt, 16363).
  - Nutzung in 5 Tagen Audit, jeweils 0: `task_refine*`, `task_cards_confirm` (confirm-cards), `task_files_propose`, `task_note_attach` (MAIN-notes), `task_wave_split`, `variant_*`, `task_kind`.
  - Nur 4 Kriteriums-Vorschläge und 5 Klärungen in 5 Tagen.
  - Kind `betrieb`: 0 Zeilen seit 09-15 (1 im ganzen Archiv).
  - 15 538 von 43 085 Zeilen in `server.ts` sind Kommentar (36 %). `docs/self-api.md` hat 4 269 Zeilen.
- Kosten: Jede Tür trägt Pins, eigene Weigerungssätze, Doku und Platz im Kontext eines Agenten, der sie lesen muss, um die richtige zu finden.
- Richtung: Einfrieren und löschen (refine, brief-compiler, brief-review, files-proposal, notes-assign, wave-split, kind `betrieb`), mit Wiedervorlage nach 14 Tagen Null-Nutzung.

**Ä8. Der Kartenleser läuft auf Opus 5.5, obwohl der Code die billigste Stufe verlangt.**
- Beleg: `.env` setzt `FLEET_CARD_MODEL='claude-opus-5-5[1m]'` und `FLEET_CARD_MS='60000'`. Der Code-Kommentar sagt „cheapest tier … nothing about that work improves with a bigger model“ (server.ts:15774–15778).
  - Modellkarten sind in 265 von 403 Läufen ungültig (66 %), Opus in 24 von 49. Median 14 s je Lauf.
  - Der Format-Parser liefert 249 von 323 gültig in 0 ms.
- Kosten: Teure Läufe, die überwiegend Absagen produzieren.
- Richtung: Karten nur aus dem Format lesen. Der Modellleser darf der Autorin einen Kopf vorschlagen und selbst nicht urteilen.

---

## 4. FEHLT

**F1. Ein Zuhause für Programs ohne lebende MAIN, und eine Kostenrechnung der Orchestrierung.**
- Beleg: Zwei aktive Programs haben eine tote Bindung: 9ce08219 Private-repo-j mit Slot 2, das heute einem anderen Program gehört, und f9dc8e10 Leichtgewicht mit Slot 10, heute Jev. Für ihre Zeilen gibt es keine MAIN, die sie freigeben könnte.
  - Live stehen 10 Nicht-Lane-Sessions (7 benannte MAINs/Orchestratorin plus 3 weitere) gegen 4 Lanes (Slots 17–20), alle MAINs auf Opus 5.5 1M.
- Kosten: Headless-Programs horten Zeilen. Das Verhältnis von Orchestrierung zu Arbeit liegt bei etwa 2,5 zu 1.

**F2. Keine Rückkopplung vom Brief zum Ausgang.**
- Beleg: Bei pi-zai/GLM-Lanes stehen `sessionMs` auf 0 und `toolResultBytes` auf `null` (24 der 45 jüngsten Ausgänge). Das ist der erklärte Default-Worker.
  - `review.state` ist seit 09-15 bei 340 von 340 Ausgängen `none` (vorher 183 `covered`).
  - `briefHash` existiert, aber nichts verbindet Brief-Merkmale mit Turns, Kosten oder Nacharbeit.
- Kosten: Welche Brief-Teile helfen, lässt sich nur per Stichprobe schätzen, so wie hier in §5.

**F3. Kein Abgleich von VERIFY gegen die Fähigkeiten des Harness.**
- Beleg: b6a67f36 verlangte Screenshots bei 1200 und 390 px. Die Codex-Lane meldete `agent.browsers.list() = []`, die MAIN musste sie selbst machen (Report-Entscheid, fleet.json `fleetReports`). Der Owner-Hand-Dispatch prüft weder Deckel noch Startplan noch Karte (41959ff).
- Kosten: Ein Pflichtteil des DONE ist für die gewählte Lane strukturell unerfüllbar, und das merkt erst die MAIN.

---

## 5. Brief-Stichprobe (5 jüngste, verschieden nach Autorin, Harness und Größe)

| Zeile | Autorin → Harness | Brief-Bytes → zugestellt | Ausgang | Hat geholfen | Ballast / Schaden |
|---|---|---|---|---|---|
| e01a4e95 | MAIN Slot 4 → codex/sol, klein | 1 148 → 5 839 | landed, 47 min, +1 Zeile; Report zitiert 6002/0 ALL PASS | exaktes `rg`-Suchmuster; DONE mit Rot-Bedingung („fällt rot, wenn die Route vor das Owner-Gate rutscht“); VERBOTEN `server.ts` | KARTE-Kopf doppelt; ~4,7 KB feste Hülle für eine Zeile Diff |
| b6a67f36 | Orchestratorin als „owner“-Brief → codex/sol, mittel | 3 018 → 12 507 (4 Notizen, 2,8 KB Snippet) | landed, 135 min, 4 Dateien | wörtliche Positivliste; VERBOTEN „Liste aus process.env ableiten“ wurde zum Pin; Report mit Tails | ROLLE sagt `claude/opus-5-5`, text `gpt-6-sol`, spawn `gpt-5.6-sol` (drei Werte); ZIEL = SUCHE-Zeile; Screenshots für die Lane unerfüllbar; 4 Notizen „offen“ |
| 7b9d786b | MAIN Slot 4 → claude/opus-5-5, klein | 1 720 → 14 823 (7,3 KB Snippets, 3 Notizen) | Arbeit fertig und Vorschau grün (17:41), Land scheitert an Hub-Divergenz (`land_hub_only` 17:53), Fix erreicht main als 1f16290c; Ledger sagt `killed-dirty` 206 min | Befund mit Symbolnamen; Pflicht zur Mutationsprobe | Snippets 4× so groß wie der Brief; 3 Notizen „offen“. Der Ausgang wurde nicht vom Brief verursacht (Land-Pfad) |
| 4961ea66 | Orchestratorin als „owner“ → codex/astra, gross (Analyse) | 10 742 → 23 749 | landed, 33 min, 221-Z.-Notiz, 1,9 MB Tool-Output | OUTPUT-Gliederung, vorgemessene Zahlen mit „prüf sie“, Sub-Agent-Budget, Korpus-Grenzen | „This brief outranks SKILL.md/AGENTS.md“ widerspricht dem Loader-Vertrag; leeres FLAECHE, deshalb Karte ohne Fläche, Größe und Rolle und trotzdem `valid:true` |
| 87b9482b | MAIN Demo 2 → pi-zai/GLM, gross, fremdes Repo | 8 343 → 12 226 (alle Kontext-Packs `source-unavailable`) | landed, 9 Dateien/+1620, gelandet per Owner-Token am MAIN vorbei (`bypassed`) | Tabelle Owner-Satz → Element; HARTE GRENZEN; 3-h-Deckel; Gegenproben | ZIEL = „WARUM DIESE ROLLE“; `src/board-data.ts` fehlt in NEU; Kosten unmessbar (`sessionMs` 0) |

**Muster:** Durchgehend geholfen haben ein DONE mit Rot-Bedingung, ein wörtliches VERIFY, VERBOTEN und ein Such-Kommando. Durchgehend Ballast waren Notizen, der doppelte Kartenkopf, die ROLLE-Zeile und das falsche ZIEL.

Die zugestellten Bytes sind 1,4- bis 8,6-mal so groß wie der verfasste Brief (Median der Zustellungen seit 09-15: 10 380 B, p90 15 881, n=431). Gefolgert, nicht an Transkripten beobachtet: Was die Lane tatsächlich gelesen hat, habe ich nicht geprüft.

---

## 6. Zahlen

| Größe | Wert | Zeitraum und Quelle |
|---|---|---|
| Zeilen angelegt | 511: auftrag 410, notiz 93, richtung 8, betrieb 0 | seit 09-15, Archiv + fleet.json |
| Quelle | owner 289 (davon ≥154 agentisch), main 222; steward 4 im ganzen Archiv | dito |
| auftrag-Status | done 298, archived 96 (3 mit Lauf), pending 11, sent 4, queued 1 | dito |
| Offen jetzt | notiz 42 (Alter median 4,6 d, max 23 d), richtung 18 (9,9 d, 23 d), auftrag 13 (4,0 d, 11 d; 9 mit Hold) | fleet.json 09-25 |
| Anlegen → Freigabe | p25 0,01 h, med 0,33 h, p75 6,8 h, p90 23 h (n=148) | audit 09-20…25 |
| Freigabe → Lane-Ende | MAIN med 4,5 h (n=92); Politik med 1,6 h (n=40) | dito |
| Anlegen → erster Lane-Ausgang (done) | p25 0,7 h, med 3,5 h, p75 14,7 h, p90 29 h (n=286) | seit 09-15 |
| Lane-Ausgänge | landed 319, killed-empty 14, killed-dirty 6, shelved 1 | lane-outcomes seit 09-15 |
| Karten | 814 Lesungen an 497 Zeilen; Format gültig 249/323, Modell gültig 138/403 | cards.jsonl 09-13…25 |
| Requeue-Schleife | 298 `dispatch_requeued`, davon 296 an einer Trust-Abfrage (2 Zeilen) | audit 09-24 |
| Türen-Nutzung (5 d) | main_task 168, task_release 153, task_hold 80, main_brief 68, task_spawn 150 (owner), task_dispatch 14, criterion 4/3, 0 bei refine/confirm-cards/files-proposal/notes/split/variant/kind | audit.jsonl |

---

## 7. Nicht geprüft

- `docs/self-api.md`, `docs/queue-analyst.md`, `docs/controller.md` und `AGENTS.md` habe ich nur per grep gelesen, nicht ganz. Die Rechte-Matrix stützt sich allein auf den Code.
- Die Innereien von `start-plan.ts`, `card-extract.ts#validateCard`, `task-notes.ts` (Auswahllogik der Notizen) und `context-plan.ts` habe ich nicht gelesen.
- Lane-Transkripte habe ich nicht gelesen. „Hat geholfen“ in §5 ist aus Brief, Diff und Report gefolgert, nicht an Turns beobachtet.
- Den Live-Env des laufenden Servers habe ich nicht geprüft. Die Werte stammen aus `.env` und `watchdog.sh` (FLEET_DISPATCH_MAX_LANES=1 in watchdog.sh, repoLaneCaps claude-fleet 7, private-repo-aa 2).
- Ob der Park-Fix `036df834` deployt ist, habe ich nicht geprüft.
- Klärungskanal, Varianten, Wellen-Dispatch und Steward-Pfade habe ich nicht vertieft (aktuell ist kein Steward-Slot besetzt).
- Die Zählung „agentisch als owner“ ist eine Regex-Heuristik, also eine Untergrenze.
- Die Deckel-Absagen der MAIN-Türen (409) werden nicht auditiert. Wie oft ein Deckel griff, ist deshalb unbekannt.
