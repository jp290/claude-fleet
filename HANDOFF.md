# HANDOFF — Orchestrator Slot 9 → Nachfolgerin (Haupt-Checkout, Owner-Token): Handoff-Dynamik diagnostiziert, Grok-Antwort 1 + Prompt 3 committet, Grok-Gegenlesen in Zeilen verwandelt (4 auftrag, 3 notiz), Klassen-Register als Router-Vorstufe geschaerft; 2026-09-14 13:1x, ctx GEMESSEN 34,3 % (Server-Praedikat, `/api/sessions`)

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Rollenschnitt unveraendert (Owner 2026-09-14 10:4x):** Lane-Treiben gehoert der Program-MAIN Fleet-Betrieb (**Slot 8**, ctx 23 %, weiss die Freigabe-Reihenfolge — Pane-Zitat 12:13). Orchestratorin: Entscheidungspunkte, Filen/Schaerfen, Variantenpaare. **Vor jedem `POST /send` `GET /api/programs` main.slot lesen.**
- **Modell dieser Pane:** der Owner hat sie beim Antritt per `/model` auf Fable 5.1 gestellt und um 13:1x per `/model` zurueck auf **Opus 5** — das letzte Owner-Wort gilt; die Nachfolge wird mit `model: claude-opus-5[1m], effort: high` explizit angefordert, damit Pane und Datensatz zusammenfallen.
- **`ctl.sh` BENUTZEN, nicht Rezepte tippen:** `./ctl.sh merges` (exit 1 = Land in Flug; VOR jedem Direkt-Commit), `./ctl.sh ctx`, `./ctl.sh watch|land|report|events`. Diese Schicht hat alles davon von Hand gerollt, weil das Regelbuch die python/curl-Rezepte lehrt und `ctl.sh` nur einmal nennt. Gefilet: `8c5ecf37` (Verben `send --main`, `commit-main`). **Danach, im Haupt-Checkout (Fragment + Render + Pin):** in `rulebook/einstieg.md` die Rezepte fuer Land-Sensor und ctx durch die Verben ersetzen — Owner-Richtung 13:1x „wiederkehrende Abfragen durch alle Schichten mechanisch".
- **Handoff-Dynamik — Diagnose steht, Entscheid beim Owner (§0.3).** Die Orchestratorin MUSS HANDOFF committen (`server.ts#handleSelfSucceed`, ungebunden ⇒ `handoffCommittedAfterOpen`-Gate); die MAIN muss nicht, tut es aber, weil NACH-Reihenfolge, Rollout-Pflichten und Deploy-Stopp keine typisierte Heimat haben (Commit-Body `c104cfd3`), und weil `rulebook/einstieg.md:14` + `server.ts:23755` dazu einladen. 100 HANDOFF-Commits in 7 Tagen. Vorschlag an den Owner: MAIN schreibt nie HANDOFF (Rest als `betrieb`-Zeilen), Orchestrator→MAIN nur `POST /send`/Zeile, Orchestratorin entweder einzige Schreiberin oder an ein Program gebunden.
- **Grok-Antwort 1 liegt jetzt WOERTLICH in `docs/messungen/2026-09-14-grok-antworten-spiele-astra.md`** (`96ee589b`), mit drei `<!-- LUECKE -->`-Markern (Anfang; ein Satz §1; Uebergang §5→Empfehlung 1). Der Board-Editor war NIE defekt: Hash-Gate + Audit-Ledger (`file_write` 24 732 → 42 953 B) bewiesen, dass viermal Antwort 2 in der Zwischenablage lag. Eine Vollfassung ueber den Editor ersetzt den Block; Datei vorher NEU oeffnen (Hash).
- **Prompt 3 (Astra effektiv einsetzen) steht in `docs/messungen/2026-09-14-grok-fragen-spiele-astra.md`** (`b23ff3b8`) — Antwort kommt vom Owner; Kennzeichen: Tabelle Einstellung|Wirkung|Quelle zu config.toml/Effort.

## 0.0 ERSTER AUFTRAG DER NACHFOLGERIN: BACKLOG AUFRAEUMEN (Owner 13:4x „wann schaffen wir es, den Backlog mal richtig aufzuraeumen?")

Gemessen 13:4x (`fleet.json`): **142 offen von 200** (`server.ts#MAX_TASKS`; der Deckel verdraengt nur terminale Zeilen — es sind noch 58 done/archived da, die Historie wird vom Backlog aufgefressen). Offen: auftrag 64 (pending 56, queued 5, sent 3; Karte gueltig 25, mit Luecken 39) · **notiz 71** (davon 19 ≥7 d; der Notiz-Kanal schliesst nichts — Queue-Intelligenz §5 E5: 3 von 69) · richtung 6 · betrieb 1. Programlos: 30. Program-Verteilung: Fleet-Betrieb 69, Leichtgewicht 24, Private-repo-j 18, eine Zeile an einem `complete`-Program.
Regeln (Owner-Memory „Operatives selbst erledigen" + „Owner raus aus der Bewertungsschleife": pruefbare Sicherheitsbedingung, reversibel, kein Owner-Schritt): Archiv ist `POST /api/tasks/:id/archive`, rueckholbar per `/unarchive` (`server.ts`, grep `taskAct[2] === "archive"`).
1. **notiz (71):** je Zeile genau eine Disposition — (a) als Kommentar an die auftrag-Zeile, die sie betrifft, dann archivieren · (b) in auftrag mit Karte konvertieren (nur mit hartem DONE) · (c) archivieren mit Grund `ueberholt: <sha|Zeile>` oder `ohne Adressat ≥7 d`.
2. **auftrag (64):** gegen `git log --since=14.days` pruefen, ob gelandet/ueberholt → archivieren mit Sha; `NACHFOLGE:*`/`UMGEHAENGT`-Paare auf Dubletten; Zeile am `complete`-Program umhaengen oder archivieren; Kartenluecken nicht einzeln flicken (`3cbbe209` repariert den Validator).
3. **richtung (6):** NICHT archivieren — Owner-Richtung; nur im Bericht auflisten.
4. **programlos (30):** einem aktiven Program zuordnen oder archivieren.
**VORBEDINGUNG — ARCHIVIEREN IST HEUTE LOESCHEN MIT VERZOEGERUNG (Owner 13:5x „Archivierung und weitere Nutzung gut durchdenken", am Code geprueft):** `server.ts#capTasks` verdraengt bei >200 Zeilen die TERMINALEN (done/archived) — ersatzlos; kein Ledger haelt die Zeile (rg nach tasks-/archive-jsonl: nichts; `dispositions.jsonl` hat 2 Zeilen und ist etwas anderes). Bei 142 offenen bleiben 58 terminale Plaetze: 80 Archivierungen wuerden sofort aeltere done-Zeilen samt Text, Karte, Brief, Kommentaren LOESCHEN, und `unarchive` kaeme an archivierte Zeilen nur, bis sie verdraengt sind. Was dabei kaputtginge, ist genau die geplante Nutzung: `fa07734f` (4) klassifiziert rueckwirkend aus dem Zeilentext, `land-quality` joint Land→Zeile, E5-Worktrail liest die Queue-Historie, die Dispositionen selbst sind die Evidenz fuer `nennt[]`-Listen und fuer `b28b9d89`. **Also ZUERST eine kleine Zeile, DANN aufraeumen:** `tasks-archive.jsonl` (gitignored, append-only wie die anderen Ledger) bekommt die VOLLE Zeile beim Uebergang in einen terminalen Status und bei der Verdraengung, dazu `disposition{grund, beleg, by, at}`; `fleet.json` bleibt reiner Live-Zustand; `unarchive` liest aus dem Ledger, wenn die Zeile verdraengt ist; `register.sh` bekommt `--archived <muster>` fuer die „haben wir das schon?"-Frage (lexikalisch, kein RAG — Grok-RAG-Antwort). Checks: Verdraengung schreibt die Zeile vor dem Drop; unarchive nach Verdraengung stellt sie wieder her. Klein, Program Fleet-Betrieb, NICHT vor dieser Zeile archivieren.

Weg: EINE read-only Lane (claude/opus/high, Scratchpad-Tabelle `id | kind | Disposition | Beleg`), die Orchestratorin wendet die Tabelle in einem Zug an und legt sie als Mess-Notiz ab (`docs/messungen/2026-09-14-backlog-aufraeumen.md`). Ziel: <60 offene Zeilen, notiz <15. Richtung/Schnitt fuer „waechst nicht wieder": die Notiz braucht einen Schliessweg (E5-Befund) — als Zeile NACH dem Aufraeumen, nicht davor. **Zusammenhang:** `b28b9d89` (Program-gebundene kurzlebige Context-Packs, CLARIFY FIRST, Owner 13:5x) ist der zweite Teil desselben Befunds — viele Notizen sind Buendel-Wissen ohne Traeger. Beim Aufraeumen Disposition (d) mitzaehlen: „waere ein Program-Pack-Zeiger" (Anzahl in die Mess-Notiz), das ist die Evidenz fuer die Clarify.

## 0.1 IN FLUG (13:1x) — alles bei Slot 8

| Slot | Zeile | Was |
|---|---|---|
| 1 | `c3837cab` | Phasen je Trail-Zeile; Commit `b5a12b8e`; hat um 12:39 drei Gegenlese-Punkte von mir (50-ms-Toleranz, Mega-check teilen, Zeitstrahl-Tabelle) — im Report pruefen, ob eingearbeitet |
| 4 | `de754f94` | Suite: Core-Unit teilen |
| 5 | `71ee4882` | Reparatur des Audit-Rots (jetzt VIERMAL identisch: `bb546bf2`, `754c37ed`, `0c3bd4a0`, `2836fe97`, je 1 Fail); Commit `c8fd392d`, Beweislauf wartete hinter dem Mutex |

**DEPLOY (Owner 13:5x „ein Deploy waere langsam bestimmt auch ganz gut"):** Server auf `ba557b75`, ~40 Commits hinter HEAD. Blockiert war er durch das viermal identische Audit-Rot; die Reparatur `71ee4882` (Slot 5) war um 13:46 IM LAND. Weg, sobald ihr Land `merged` ist: Slot 8 (dem der Deploy gehoert) einmal mit dem Owner-Wunsch anstossen — `POST /api/deploy` (verweigert 409, solange ein Post-Land-Audit laeuft; dann auf `./ctl.sh watch audit <sha>` warten, nicht pollen), danach `bundleStale` auf `/api/sessions` und `deploys.jsonl`-Verdikt pruefen (`ok:null` ist KEIN Pass). Vorher die Programs fragen, deren Beleg an einem Idle-Fenster haengt (Deploy setzt die Idle-Uhr jeder Pane auf null). **Was der Deploy live macht (39 Commits, sechs serverseitig, 14:1x gelesen):** `bb546bf2` Karten-Vertrag + `FLEET_CARD_MODEL=sonnet` aus `.env` (heute NICHT live, config-Sensor ohne `live=`) · `92714664` Report-Ledger (bis dahin werden Reports bei 20 gepruned: 126 von 138 in 14 d) · `24a04501` Transkript-Tail max 1 MiB statt ganzer Datei (groesstes 29,6 MB) · `f8804bb1` Release-Politik card-valid/all je Program (danach `POST /api/programs/:id/release` setzbar) · `4a905807` Merge-Verdikt folgt der MAIN ueber `succeed` · `58c10f75` Server-Lock-Marker gegen Fremd-Kill · Client `751828fa` (`bundleStale:true`).

Gelandet seit `d5b29be6`: `bc974919` (E1c Karten-A/B, Notiz `517d869c`), `8dc26d58` (Client „▣ main", `751828fa`). Queued: `bf6fc2ea`, `f4d81b09`, `d71c7549`, `8056f3fe`, `3cbbe209` (neu, Karten-Validator-Luecken aus der A/B — von der MAIN gefilet). **Deploy: NICHT geschehen**, Server auf `ba557b75`, 36 Commits hinter HEAD, blockiert bis das Rot repariert ist (`71ee4882`).

## 0.2 HEUTE IN MEINER SCHICHT (12:1x–13:1x)

- **Grok-Code-Review von `b5a12b8e` gegen den Commit geprueft:** 3/5 Punkte halten (Toleranz, Mega-check, fehlende Tabelle), `results.length > 500` war ueberholt, einer Geschmack. Daraus `a93aa054` (AGENTS.md `## How a check is written` + `verify-e2e`-Pack, klein).
- **Grok-Antwort 1 in Zeilen verwandelt, jede am Baum geprueft:** `e8a5baab` (read-only `erdung`-Agent als TOML; Befund: `~/.codex/config.toml` ohne `[agents]`, 10 globale Agent-TOMLs ohne `sandbox_mode`, kein repo-lokales `.codex/agents/`, AGENTS.md ohne Delegationsregel — Schritt 1 ist die Harness-Probe, ob 0.153.4 repo-lokal laedt) · `ee865782` (Report traegt `outsideSurface`, gegen `files ∪ creates`, kein Gate) · Notiz `c52354d9` (drei Brief-Saetze an `8b2baf60`) · Notiz `13d65ef9` (Pilot A/B/C an Program `9ce08219`, nur Preflight-Vorlage).
- **Owner-Frage „Schwierigkeitsstufen → Modellzuordnung":** gemessen: 0/141 offene Zeilen mit Modell-Feld, `size` auf 31/141 (Wellen-Gewicht, keine Schwierigkeit), land-quality je Modell konfundiert (ohne Eingangs-Achse), kein Usage-Sensor. Antwort = **`fa07734f` geschaerft** (Register = Aufloesung Klasse→Tripel, `alternativen[].qualifiziert` mit Evidenzpflicht — „Fable als Worker" ist dort `OFFEN n=12`; Klasse deterministisch aus `KLASSE:`/`nennt[]`, KEIN Modell-Guess (Kartenregel 3); land-quality je Klasse, `unklassifiziert` als Sensor; kein Usage-Feld ohne Sensor). Dazu Angleichungen per Brief-Route: `e8a5baab` (Schritt 3 gestrichen — AGENTS.md §2d gehoert der Owner-Session), `ee865782` (`creates`), `21ade485` (E3-Sperre gefallen; Ausgabe als Registerfelder), `1ed2f6a0` (Varianten = `alternativen`, Evidenz fuer `qualifiziert`), `d02fd2bd` (ein Schreiber je Feld; Modell = `urteil`-Klasse). `8b2baf60`/`a93aa054` unveraendert. Alle sechs Briefe tragen `by: owner` (Semantik der Tuer; geschrieben von Slot 9).
- Slot 8 einmal gebuendelt informiert (12:47) ueber `a93aa054`, `e8a5baab`, `ee865782`, `c52354d9`; die Brief-Schaerfungen von 13:0x sind ihm NICHT gemeldet — die Zeilen sind pending, er liest sie beim Release.

## 0.3 OFFEN BEIM OWNER

1. **Handoff-Dynamik:** eine Schreiberin (Orchestrator) vs. Program-Bindung fuer den Orchestrator; MAIN-Rest als `betrieb`-Zeilen. Kein Schnitt gefilet — Owner-Entscheid steht aus.
2. Grok-Antwort 1 Vollfassung (Luecken) · Prompt 3 an Grok.
3. Rollen-Session S1/S4 (unveraendert).

## 0.4 UNGEPRUEFT

- Ob Slot 1 die drei Gegenlese-Punkte einarbeitet (Send `eeabba0c`, acceptance observed; kein Watch gesetzt — Lanes gehoeren Slot 8).
- Ob das vierte Audit-Rot auf `2836fe97` dieselbe Signatur hat wie die drei davor (nicht gelesen; die Reparatur-Lane laeuft ohnehin).
- Kontingent-Sensoren (Claude Code `/usage`, Codex) — nie geprobt; Voraussetzung fuer jede Usage-Schicht im Router.

# HANDOFF — Orchestrator Slot 7 → Nachfolgerin (Haupt-Checkout, Owner-Token): Variantenpaar entschieden und gelandet, Suite schneller + Pruefapparatur als zehn Zeilen mit Freigabe-Reihenfolge bei der Program-MAIN, Astra-Befunde verarbeitet, Brief-Gegenlese und Owner-Entscheid-Schicht gefilet; 2026-09-14 12:1x, ctx GEMESSEN 35 % (Pane-Fusszeile; der Slot-Datensatz meldet null, er steht noch auf Fable, die Pane lief nach Owner-/model auf Opus 5)

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Rollenschnitt (Owner 2026-09-14 10:4x):** Lane-Treiben (done-looking → landen → schliessen, Freigaben nach NACH) gehoert der **Program-MAIN Fleet-Betrieb, heute Slot 8** (um 11:59 von Slot 5 nachgefolgt). Bei der Orchestratorin bleiben Entscheidungspunkte: Variantenpaare (E4), Brief-Abgleich bei Abweichung vom DONE, Filen/Schaerfen. Keine Land-Nachricht je Lane.
- **Regel an die MAIN gegeben (Owner 12:0x):** dasselbe Fail in zwei aufeinanderfolgenden Audits = echter Befund; Reparatur-Zeile sofort per Hand-Dispatch, auch ueber den Deckel; ein Urteil ist keine Vorbedingung.
- **Vor jedem `POST /send` den Ziel-Slot unmittelbar vorher aus `GET /api/programs` (main.slot) lesen.** Heute 12:08 traf mein /send an „Slot 5" die dort gerade spawnende Reparatur-Lane und toetete sie (Zeile requeued, nichts verloren; Befund als `bf6fc2ea`).
- **Kontext/Lane-Zeit sind KEIN Vergleichssignal** (Owner-Korrektur, Memory `feedback-codex-ctx-is-not-succession-pressure`, dritter Vorfall).
- **Grok-Antwort 1 (Astra-Orchestrierung) fehlt weiter.** Der dritte Paste um 09:3x war wieder byte-identisch mit Antwort 2; die Datei steht auf dem committeten Platzhalter. Erkennung: die richtige Antwort beginnt mit Sub-Agent-Threads vs. Worktree-Sessions, nicht mit „Etablierte Wege 2026".

## 0.1 IN FLUG (12:1x)

| Slot | Zeile | Was |
|---|---|---|
| 1 | `bc974919` | E1c Karten-A/B Haiku vs Sonnet (Mess-Notiz) |
| 3 | `8dc26d58` | Client zeigt source main als owner (Astra-Befund 9) |
| 4 | `de754f94` | Suite: Core-Unit teilen |
| 5 | `71ee4882` | Reparatur „clarification identical retry" (3 Audits rot: bb546bf2, 754c37ed, 0c3bd4a0), per Hand-Dispatch ueber Deckel |
| 8 | — | Program-MAIN Fleet-Betrieb (ctx 19 %) |

Queued: `c3837cab` (Phasen je Trail-Zeile, Messung). Pending mit Reihenfolge bei Slot 8 (ging um 11:2x an Slot 5, gleiche Zeilen): `a2356a5e` Gate-Integritaet (NACH de754f94; watchdog.sh ⇒ kickstart + rulebook-Render) · `1e74ba8b` Audit als parallele Shard-Jobs (NACH de754f94; landet inert, Rollout FLEET_AUDIT_SHARDS='3') · `35654b07` Mutex birth + curl-Deadlines (NACH de754f94, a2356a5e) · `d71c7549` Ledger-Reader null · `8056f3fe` zwei schwache Sonden · `aa819dd4` warmer Helper-Baum (NACH 1e74ba8b). Aus `c3837cab` kommen bis zu drei Kuerzungs-Zeilen (Sleeps) — die filet die MAIN.

Neu gefilet, pending, noch NICHT an Slot 8 gemeldet: `bf6fc2ea` /send in spawnenden Slot (klein, Befund oben) · `d02fd2bd` Brief-Gegenlese als Messversuch (Schalter default aus, jede zweite Zeile, Abbruch nach 20 Paaren ohne Effekt) · `8bc86e4b` Denkauftrag Owner-Entscheid-Schicht, Program Astra f9dc8e10, codex/gpt-6-astra/medium.

## 0.2 HEUTE IN MEINER SCHICHT

- **Variantenpaar 1 entschieden:** Opus-Variante von `land-quality.ts` gelandet (db8186f4 + Repo-Map-Fix 81a85c08), codex shelved (Branch `fleet/260914071334-201a` bleibt). Nur die Zahl im DONE trennte; Stufe 2/3 haetten die schwaechere Variante gewaehlt. Notiz `docs/messungen/2026-09-14-variantenpaar-1.md` (71411734, 82c907db).
- Gelandet ausserdem: E1a Karten-Vertrag (bb546bf2), E2/E3 Report-Ledger + Receipt (3bd9821e), E3 Quellpaket-Wirkung (754c37ed: Quellpaket kauft nichts messbar, Karte korreliert mit 8–9 statt 18–20 Bash-Aufrufen), Astra-Befundnotiz Pruefapparatur (3a1c952a), Security-Suite-Fix 1a5d3f2d (2836fe97).
- **Audit-Rueckstau gemessen:** Second-host-Audits strikt seriell (~32 min), Land→Urteil 75–100 min; maxParallelSuites 3 begrenzt nur Previews; Second-host 16 Kerne Load ~1, RAM die Grenze (Suite ~330 MB). Server und Daemon kennen keine Shards ⇒ `1e74ba8b`.
- **Suite-Zeit:** 217 Checks mit 3–10 s Abstand = 1 070 s von 2 122 s; Git-Tick-Hypothese widerlegt (Git-Checks warten nicht laenger). ⇒ erst messen (`c3837cab`).
- Worktrail-Lauf `6067c240` um Pflichtteil (5) Memory-Durchsicht (portabel/privat/veraltet mit Vorfallszahl) und (6) Zuordnung programloser Zeilen erweitert.
- Memory: `feedback-codex-ctx-is-not-succession-pressure` um den dritten Vorfall ergaenzt.

## 0.3 BEFUNDE, DIE STEHEN

- Zwischen Filen und Ausfuehren prueft niemand den Inhalt: Karte = Form, refine lief auf 0/200 Zeilen, Analyst entfernt. Heutige Belege stehen in `d02fd2bd`.
- Startplan liest zitierte Pfade im Text als Flaeche (Schein-Kollision) — bis der deployte Karten-Vertrag `creates` traegt, beim Filen nur Aenderungsziele als Pfad nennen.
- Second-host: vier interaktive claude-Sessions des Owners (~1,4 GB) — Owner kuemmert sich, nicht anfassen.

## 0.4 OFFEN BEIM OWNER

1. Grok-Antwort 1 einfuegen. 2. Rollen-Session S1/S4 (unveraendert). 3. Second-host-Sessions (er macht es).

## 0.5 UNGEPRUEFT

- Ob Slot 8 die Freigabe-Reihenfolge der zehn Zeilen kennt: sie ging an Slot 5 vor dessen Nachfolge; Slot 8 bekam um 12:1x nur den Verweis auf diesen HANDOFF.
- Deploy-Stand: Slot 5 wollte nach gruenem Rerun deployen; das Rot kam dreimal — ob deployt wurde, nicht geprueft.
