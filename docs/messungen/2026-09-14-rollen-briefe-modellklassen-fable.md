---
frage: Was soll jede Rolle in Claude Fleet beim Start und unterwegs bekommen (Aufgabe, Kontext, stille Fragen, implizite Information), ueber welchen Traeger, und welche Gueteklasse von Modell faehrt welchen Job mit welchen Sub-Agents, Workern und Skripten — so dass Agenten besser arbeiten und weniger einlesen?
urteil: Der Brief ist nicht der Hebel — er kostet ~3,6 k von ~70 k Start-Tokens; der Hebel sind der Lane-Render (18,3 k, davon ~6,6 k fuer Tueren und Suiten-Innenleben, die eine Lane nie braucht) und die Erdung danach (~75–120 k, Code, gehoert der Datenschicht). Vorschlag: vier Gueteklassen (kopf · hand · fremd · wegwerf) als EIN getrackter Datensatz, den die Karte mit `ROLLE: <klasse>` traegt und der Dispatch beim Release in das Spawn-Tripel aufloest; das Provider-Profil (c269023d) ist ein ZWEITER, gitignorter Datensatz mit demselben Schluessel (harness, model), den nur der Server liest. Sub-Agents lohnen nur als read-only Erdung mit Rueckgabe `datei#symbol`, und nur gebrieft (DELEGATION-Zeile) — nie Suite, Commit, Land, Self-POST, gemeinsame Dateien. Vier Schnitte, Schnittlinie vor dem Provider-Profil und vor einer dritten Render-Achse „Modellklasse".
bereich: [rollen, briefs, rulebook, modellklassen, sub-agents, kontext]
belege: [fleet.json (Zeilen 6bd2e49c, 21ade485, c269023d, 504b0854; Slot-Roster; nur gelesen), SYSTEM.md, AGENTS.md §Portable operating contract §Verify §Reporting §If you are a Codex or Pi lane, rulebook.ts#FRAGMENTS_FOR, rulebook/einstieg.md §MODELLPOLITIK §GPT-Lane, rulebook/supervisor.md, rulebook/self-scheduling.md, docs/controller.md, docs/steward.md §Session start, docs/astra-briefbaustein-2026-09-07.md, docs/lane-brief-template.md, server.ts#briefAndSend #LANE_EXIT_FOOTER #railBlockFor #RAIL_HEAD #buildProgramMainBrief #supervisorBriefBody #handleSelfSucceed #migrateRailOf #HARNESSES #taskSpawnFromBody #DEFAULT_MODEL #SUMMARY_MODEL #CARD_MODEL #REFINE_MODEL #WORKER_ROUTES #runWorker #LaneOutcome, clarify-prompt.ts#buildClarifyBrief, wave-brief.ts#withCardHead, card-extract.ts#FORMAT_KEYS, .fleet/context-packs.json, lane-outcomes.jsonl, post-land-audits.jsonl, docs/messungen/2026-09-14-lane-startkontext-fixkosten.md, docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md §2.1–2.6 §3.4 §4, docs/messungen/2026-09-13-lane-kontext-sub-worker-glm.md §2 §4 §5, docs/messungen/2026-09-13-task-aggregation-a-e-fable.md §A §E, docs/messungen/2026-09-06-kontext-gesundheit-fable.md §1 §2, docs/tailored-context.md §2 §6 §6c §7 §8, docs/plan-fleet-betrieb-2026-09-13.md §1 §4 §5, ~/.claude/knowledge/brief-principle.md, ~/.claude/knowledge/prompt-axioms.md, ~/.claude/commands/sharpen3.md]
nicht-gemessen: K1 (Wirkung des Quellpakets nach 25b90648 an 10 Lanes) — liegt nicht vor; Wirkung von Tonfall, Grossbuchstaben und Geschichten auf die Ausfuehrung (kein A/B existiert); Gesamt-Tokens inkl. Sub-Agent-Transkripte (kein Ledger-Feld); Fremd-Harness-Startkontext in Tokens (pi/codex: nur Bytes); Zeitfenster der attentionRequests/fleetReports in fleet.json (Zeitstempel-Feld nicht aufgeloest); Geld
stand: 2026-09-13
---

# Rollen, Briefe und Gueteklassen — ein Entwurf (Fable-Haelfte des Doppel-Denkauftrags)

Owner woertlich (6bd2e49c): „ein Agent braucht eine Aufgabe und Context, der ihm hilft, diese
Aufgabe richtig erledigen zu koennen, vllt noch komplementaere Fragen, deren still erfasste
Informationen zur Ausfuehrung beitragen … Implizite Informationen innerhalb der Briefe und MDs
koennten aehnliche Effekte haben." Und (21ade485, Kommentar): „Modelle in GUETEKLASSEN einteilen,
und ein Job traegt am Ende, welche Klasse ihn ausfuehren soll — verbunden mit der Konfiguration,
welche Sub-Agents/Worker/Skripte er benutzen darf." Und (504b0854): „ist es nicht komisch, dass
Lanes gar keine Subagents nutzen? weiterdenken".

„gemessen" heisst: Zahl aus einer Notiz oder aus einem Kommando in dieser Lane. „abgeleitet" heisst:
aus gemessenen Zahlen gerechnet oder aus dem Code gelesen, ohne Lauf. Fundstellen als
`datei#symbol` oder Abschnitt.

## §1 Ist-Inventar (F1)

Groessen: Bytes vom 2026-09-06 (Kontext-Gesundheit §1, `wc -c`), Tokens vom 2026-09-13
(Fixkosten-Note, Injektions-Probe). Heute gemessen in dieser Lane: `AGENTS.md` 25 041 B,
`docs/controller.md` 8 956 B, `docs/steward.md` 11 711 B, Astra-Baustein 20 799 B, `SYSTEM.md`
13 120 B; Lane-Render (diese Kopie) 3 von 7 Fragmenten: `loader` 3 264 B + `lane-discipline`
23 320 B + `self-scheduling` 9 476 B.

| Rolle | Traeger | Was drinsteht | Groesse | Fundstelle |
|---|---|---|---|---|
| Orchestrator / Fleet Controller (claude, Haupt-Checkout) | globale `~/.claude/CLAUDE.md` · MAIN-Render `CLAUDE.md` (7 Fragmente) · `MEMORY.md` · auf Anweisung `AGENTS.md` §contract, `HANDOFF.md` oberster Block · `docs/controller.md` nur auf Zuruf | Einstieg-Ritual (`state.sh`, `register.sh`), Kontext-Band, Modellpolitik, Deploy, graphify; Rollenkarte mit Tueren und Nachfolge-Faellen | automatisch 93 946 B, auf Anweisung +20 138 B (gemessen 09-06); **kein servergebauter Rollenbrief** | `rulebook.ts#FRAGMENTS_FOR` (main = alle 7) · Kontext-Gesundheit §2 Befund 2 · `docs/controller.md` |
| Program-MAIN, fleet-control-Frame (claude) | wie Controller + Gruendungsbrief: Body (4 Schritte) + `PROGRAM_MAIN_RAIL_BLOCK` + Studio-Block + Anker; Nachfolge: `handover`-Datensatz + Vorschau im Brief | Program-JSON woertlich; Lifecycle-Projektion; Rollenschnitt als Urteil; Loop (tasks → release → warten → Claim pruefen → land → watch merge/audit) | Gruendungsbrief Median 9 506 B (n=121, 09-06) | `server.ts#buildProgramMainBrief` · `#RAIL_HEAD` `#RAIL_ROLE_STANDARD` `#RAIL_TAIL` · `#railBlockFor` · `#handleSelfSucceed` |
| Program-MAIN, target-repo-Frame (codex/Astra) | `AGENTS.md` des Zielrepos + Gruendungsbrief (Body: AGENTS.md ganz lesen, git erden) + Rail + Astra-Baustein (von Hand kopiert) | fuenf Betriebsregeln R1–R5 (Warten mit Zuegen, Ablage, Abbruch, …) | Brief 9 463 B + Baustein 20 799 B | `server.ts#buildProgramMainBrief` (target-repo) · `docs/astra-briefbaustein-2026-09-07.md` |
| Worker-Lane (claude) | fester Praefix (Werkzeug-Schemas + Systemprompt) · Lane-Render (3 Fragmente) · Skill-/Agent-Listing · globale CLAUDE.md · `MEMORY.md` · Brief = KARTE-Kopf (≤1,5 KB) + Prosa + Notizen + Quellpaket (≤8 192 B) + Studio-Lane-Block + Anker + `LANE_EXIT_FOOTER` | Verify-Kette, Land-Disziplin, Mutex-/Flake-Innenleben, Self-API (davon ~6–7 KB Tueren, die einer Lane 409 antworten), Exit in drei Akten | Start 71 387 Tokens: Praefix 32 467 · Render 18 335 · Skills 6 618 · Brief ~2,6–3,6 k · je ~2,6–2,9 k globale CLAUDE.md / MEMORY.md / Agent-Listing (gemessen 09-13) | Fixkosten-Note · `server.ts#briefAndSend` · `wave-brief.ts#withCardHead` · Kontext-Gesundheit §2 Befund 11 |
| Worker-Lane (codex/pi) | `AGENTS.md` (automatisch, ganz) + derselbe Brief; **kein Regelbuch** | portabler Vertrag; die GPT-Brief-Checkliste steht beim BRIEFER (einstieg.md), nicht bei der Lane | AGENTS.md 25 041 B (heute) + Brief; Tokens ungemessen | `AGENTS.md` §If you are a Codex or Pi lane · `rulebook/einstieg.md` §GPT-Lane |
| Clarify-Lane (claude) | Render wie Worker-Lane; Brief = deterministischer Rahmen + Rohtext im Fence; KEIN Karten-Kopf, keine Notizen, kein Quellpaket, kein Exit-Footer | vier Schritte (erden, Done je Teil, strukturiert berichten, `POST /api/self/criterion`), dann stoppen | Rahmen ~2,5 KB (abgeleitet aus dem Quelltext) | `clarify-prompt.ts#buildClarifyBrief` · `server.ts#briefAndSend` (clarify-Zweig) |
| Supervisor (claude, Haupt-Checkout) | automatisch wie Controller + `supervisorBriefBody` + Anker | Rolle (nudge, nie zweite Owner-Stimme), vier Verbote, Kanalliste, Boot (`state.sh`, `register.sh`) | 93 946 B + 1 255 B (09-06) | `server.ts#supervisorBriefBody` · `rulebook/supervisor.md` |
| Steward (claude, Worktree) | handkopierter MAIN-Render + `/steward`-Regal (10 Dateien) + Command | Lade-Ritual, zwei Pulse, Wissenspflege | 197 726 B (09-06; 8 von 10 Regal-Dateien liegen im Attic) | `docs/steward.md` §Session start · Kontext-Gesundheit §2 Befund 8 |
| Astra-Analyse-Session (codex, Haupt-Checkout oder Program) | `AGENTS.md` + Owner-/MAIN-Brief nach Schablone (System-Prefix, PRIORITY/AUTONOMY/EFFORT/DONE MEANS/DO NOT) | Denkauftrag mit Eingaengen und Gliederung | Brief je Auftrag, ~5–20 KB (abgeleitet aus den Queue-Zeilen) | Memory `feedback-astra-brief-template` · Queue-Zeile 8a3b1c46 |
| Wegwerf-Worker (merge/repair/review/cleanReview/summary/commitMsg/enhance/digest/card/refine) | Prompt-Template im Repo, kein Brief, kein Regelbuch; `TEXT_ONLY_TOOLS` bzw. `MERGE_TOOLS` | Vertrag (Ausgabeform, Marker) im Template | — | `server.ts#runWorker` · `merge-prompt.ts` |
| Studio / Game-Maker-MAIN | wie Program-MAIN, aber `RAIL_ROLE_GAME_MAKER` ERSETZT den Rollenschnitt; Studio-Block mit Stufen und Spawn-Tripel je Stufe | Preflight, vier Wahrheiten, Checkpoint-Felder | Rail deutlich laenger als Standard (abgeleitet aus dem Quelltext) | `server.ts#RAIL_ROLE_GAME_MAKER` · `#studioStageLines` |

**Regeln, die heute an der Modellklasse haengen (je eine Fundstelle):**

| Regel | Wo | Art |
|---|---|---|
| Fable orchestriert (Controller, Program-MAINs, Steward), Opus 5 high faehrt jede Lane; `FLEET_MODEL` in `.env` = Lane-Default | `rulebook/einstieg.md` §MODELLPOLITIK · `server.ts#DEFAULT_MODEL` | Prosa + Env |
| Versuch: naechste Controller-Nachfolge auf Opus 5 high | ebenda (VERSUCH-Absatz) | Prosa |
| Supervisor auf Opus 5 high; Nachfolge erbt Modell/Effort woertlich, Route + `/model` als Paar | `rulebook/supervisor.md` · `server.ts#handleSelfSucceed` | Prosa + Code |
| Kontext-Band 25/30 % gilt fuer Claude-MAINs auf 1M; NICHT auf 258 400 uebertragen; Codex kompaktiert selbst | `rulebook/einstieg.md` §Kontext-Band, §GPT-Lane · Memory `feedback-codex-ctx-is-not-succession-pressure` | Prosa |
| Ein fremdes Modell will einen DICHTEREN Brief (Verify ausgeschrieben, Verbote, Fuellstand selbst melden) | `rulebook/einstieg.md` §Eine Lane muss nicht claude sein · `docs/tailored-context.md` §8 | Prosa |
| Modell-Validierung zweigeteilt: `MODEL_RE` (claude) vs `HARNESS_MODEL_RE` (fremd); `automatable` je Harness (pi-zai: false) | `server.ts#HARNESSES` `#taskSpawnFromBody` | Code |
| Karte gegen Prosa: Haiku 4.5 (`CARD_MODEL`); Refine: Opus 5 (`REFINE_MODEL`); summary/commitMsg/enhance/digest: codex-spark, Rueckfall auf claude nur per Env-Literal; review/merge/repair/cleanReview: `SUMMARY_MODEL` = Sonnet 5 | `server.ts#CARD_MODEL` `#REFINE_MODEL` `#WORKER_ROUTES` `#SUMMARY_MODEL` | Code |
| Astra-Sessions auf effort medium; GLM nur ueber pi-zai, Tick startet es nie | Memory `feedback-astra-effort-medium` · `reference-glm-lane-is-pi-zai` | Memory |
| Migrate-Hinweis nur fuer claude-Slots, Schiene nach Bindung | `server.ts#migrateRailOf` `#tickMigrate` | Code |

**Zwei Abweichungen zwischen Regel und Live-Roster (gemessen heute an `fleet.json`, nur Slot/Label/Modell):**
Slot „Orchestrator (Opus)" und Slot „Program-MAIN: Fleet-Betrieb" laufen auf `claude-opus-5[1m]`
high, der Slot „Betriebsbeobachtung · Supervis…" auf `codex/gpt-5.6-sol/medium`. Die
MODELLPOLITIK-Zeile sagt Fable fuer beide MAINs und `supervisor.md` sagt Opus 5 fuer den
Supervisor. Offene Queue-Zeilen nach Spawn-Tripel: 90 ohne Tripel (fallen auf `DEFAULT_MODEL`),
25 `claude-opus-5[1m]/high`, 3 `codex/gpt-5.6-sol/high`, 3 `codex/gpt-6-astra/medium`, 1 `fable/high`.
Dieselbe Klasse heisst im Ledger `claude-fable-5-1[1m]` (17 Zeilen/14 d) und in der Queue `fable`.
Das ist genau der Zustand, den ein Klassen-Datensatz beendet: die Regel ist Prosa an drei Stellen,
die Wahrheit steht je Zeile.

## §2 Dynamik (F2)

Was ein Agent je Rolle zu welchem Zeitpunkt braucht, was heute fehlt oder zu viel ist:

| Zeitpunkt | Braucht | Kopf-Rollen (Controller, MAIN, Steward) heute | Hand-Rollen (Lane) heute | Befund |
|---|---|---|---|---|
| **Start** | Rolle, Autoritaet, Tueren, Aufgabe, Fläche, Done, Verify | Rail nennt nur `program-execution`; die Owner-Tuer `attention` und die Tabelle in AGENTS.md §Role contract stehen in keinem Brief (Befund 18); Controller hat gar keinen Rollenbrief (Befund 2) | Karte-Kopf + Prosa + Quellpaket + Footer: vollstaendig. Dazu 18,3 k Render, davon ~1,6 k Tueren mit 409 (Befund 11) und ~4,5 k Suiten-Innenleben | Kopf: EXPLIZIT zu wenig (Tueren). Hand: EXPLIZIT zu viel (Render) |
| **Erste Aenderung** | die Zeilen der genannten Symbole, die Nachbarn, die Claims darueber | — | Erdung 33 Tool-Aufrufe / ~75 k Tokens (Worktrail IV §2.2), Marker p50 189 k (GLM §2.1); `server.ts` in 143/171 Lanes. Quellpaket seit 25b90648 live, Wirkung = K1, liegt nicht vor | Datenschicht-Problem, kein Brief-Problem. **Hier wuerde K1 den Vorschlag aendern:** senkt das Paket den Marker nicht unter 120 k, gehoert der DELEGATION-Vorschlag (§4a) VOR den ctxPack-Ausbau, sonst dahinter |
| **Rotes Pruefergebnis** | Signatur lesen, Flake-Familie, Beweisreihenfolge | Adjudiziert Audits; braucht die Familien-Liste | Lane braucht die REGEL (Fail ist deiner; Rerun am selben Baum zuerst), nicht die 18 Familien mit SHAs (`docs/verify-tiering.md`, im Render 8,6 KB Innenleben) | Die Geschichten helfen dem ADJUDIZIERER, kosten die LANE |
| **Warten** | einen Zug oder Idle | Watch mit `idleSec:0`, quittieren (steht im Render) | Footer: „go idle", Suite im Vordergrund mit Timeout oder Abschlussereignis — seit 09-13 im Footer; davor 1 676 `sleep` in 135 Lanes (Worktrail IV §2.5) | war EXPLIZIT fehlend, jetzt im Footer; Wirkung messen (§7) |
| **Abschluss** | Report-Form, Deckel, wohin | MAIN: `fleet-report` an den Owner nur ueber attention | Deckel 4 000 jetzt in AGENTS.md §Reporting UND im Footer (`MAX_FLEET_REPORT_TEXT` interpoliert); davor 130/181 Lanes mit 334 Abweisungen (Worktrail IV §2.1) | war die teuerste EXPLIZITE Luecke (≈98 Mio. Cache-Read); geschlossen seit 56d2e084, Treffer messen (§7) |
| **Uebergabe** | Rail je Rolle | Standard-MAIN: `handover`-Datensatz, kein HANDOFF-Commit; Controller/Legacy: HANDOFF.md-Stapel aus 12 H1-Bloecken (Befund 1) | Lane: Report `handoff` + `succeed`, gleicher Worktree; Staffelstab live aus (`FLEET_MIGRATE_PCT` 0) | Controller-Rail fehlt; Lane-Rail steht, ist unbewaffnet |

**Was implizit wirkt — und ob es hilft.** Vier Sorten impliziter Information stehen in den MDs:
Geschichten („bezahlt am …"), Grossbuchstaben und Tonfall, Datumsschichten („seit `d0befb9`",
„ERSETZT die Fassung vom …"), Rueckfalltueren („diese Zeile zurueckdrehen"). Gemessen ist nur die
Groesse: 65 Datumsangaben, 27× „gemessen/bezahlt", 17 Attic-Verweise ueber die 7 Fragmente
(Kontext-Gesundheit §1). Gemessen ist auch, wo implizite Information NICHT wirkt: die Anker
(166/171 Lanes) senken die Erdung nicht; DONE-Block und FLAECHE senken die Aufrufe (22–25 gegen 34),
nicht den Marker-Kontext (Worktrail IV §2.3). Und wo sie wirkt: die Audits fuehren als „still
gewusst" Handlungswissen (Kanal selbst oeffnen, Join ueber Event-Id, Rebase zerstoert den
Blindheitsbeweis) — Saetze, keine Dateien. Abgeleitet daraus, ohne A/B: **eine Geschichte hilft dem,
der eine Entscheidung trifft, die die Geschichte geformt hat (Adjudizieren, Landen, Briefen), und
kostet den, der nur ausfuehrt.** Grossbuchstaben und Datumsschichten sind fuer die Lane Rauschen:
sie markieren, was sich geaendert hat, nicht was gilt. Also: Geschichte ins Attic mit einem Satz
Regel und einem Verweis im Fragment; Datumsschichten nur dort, wo ein Sensor sie nicht liefert.

**Komplementaere Fragen, die ein Brief still beantworten lassen soll** (Owner: „still erfasste
Informationen"; brief-principle §2 Schritt 2; sharpen3 Schritt 0 und 6). Sie stehen als Frage im
Brief, nie als Pflicht-Abschnitt im Report:
1. Welche Pruefung deckt meine Aenderung — Gate, Vorschau, keine? (`GET /api/self/gate`, `classifiedAs`)
2. Ueber welcher Zeile, die ich anfasse, steht eine Behauptung (`supports.*`, `effortLevels`, ein Pin, eine `note`)?
3. Wer schreibt sonst auf diese Dateien — welche Notiz liegt auf meiner Flaeche, welche Welle?
4. Was wuerde meine Aenderung falsch machen: Aufrufstellen, Sonderfaelle, der Pfad, den kein Check misst?
5. Wie sieht mein Report in 4 000 Zeichen aus, und was davon gehoert in den Commit-Body statt in den Report?
Fuer Kopf-Rollen kommen zwei dazu: Welche Tuer gehoert dem Owner (Scope, Aussenwirkung, Geschmack)?
Und: Wie beweist der Report der Lane das, was er behauptet (Diff + Verify-Tail)?

## §3 Traeger-Zuordnung und Bloat-Regel (F3)

Sieben Traeger, jeder mit genau einer Sorte Inhalt. Ein Satz, der in zwei Traeger passt, steht in
dem weiter oben.

| Traeger | Leser | Inhalt | Nicht hinein |
|---|---|---|---|
| `SYSTEM.md` | Owner, Mensch | Zielbild, Objekte, Lebenszyklus | nichts, was ein Agent beim Start liest; Routen |
| `AGENTS.md` | jede Session jeder Harness | Vokabular, Rollen-Ebenen, harte Invarianten, Verify-Kette, Reporting mit Deckel | Programm-spezifischer Workflow (Game-Maker-Preflight: 21 % des Kerns, Befund 12), Messgeschichten |
| Regelbuch-Render je Leserschaft (`rulebook/`) | claude-Sessions dieses Hosts | Host-Realitaet: Pfade, Env, Sensoren, Mutex-Semantik, Modellpolitik als Verweis auf den Datensatz | Tueren, die dem Leser 409 antworten; Suiten-Innenleben fuer Lanes; Geschichten laenger als ein Satz |
| Rollenkarte (servergebauter Rail + `docs/<rolle>.md`) | eine Rolle | Auftrag, Autoritaet, Tueren mit Route, Loop, Nachfolge-Fall | Aufgabe des Tages; Modell-ID |
| Karte/Brief | eine Instanz | ZIEL, ROLLE als Klasse, FLAECHE, DONE, VERIFY, VERBOTEN, DELEGATION, Prosa, stille Fragen | Regeln, die im Vertrag stehen; Gate-Kommando ausgeschrieben (Drift, `docs/lane-brief-template.md` §Norms) |
| Datenschicht (Karte-Kopf, Notizen, Quellpaket, ctxPacks, Anker) | die Instanz, deterministisch gerendert | Zeilen, Notizen, Invarianten eines Bereichs, Verify-Rezept, Flake-Familien des Bereichs | Prosa-Regeln; Sensorzahlen |
| Server-Entscheid (unsichtbar) | niemand | Klasse → Tripel, Provider-Profil, Empfaengerwahl, `--disallowedTools`, Report-Vorpruefung | alles, was der Agent zum Handeln braucht |

**Bloat-Regel als pruefbarer Satz.** Ein Satz steht im falschen Traeger, wenn einer von drei
Tests anschlaegt:
- **Tuer-Test:** er nennt eine Route oder ein Kommando, das dem Leser dieses Traegers strukturell
  409 antwortet oder nicht zur Verfuegung steht. Probe: `rg -c 'a lane may not|nicht-Lane-only|POST /api/self/(watch|succeed|retire|release|attention)' <lane-render>` muss 0 sein.
- **Sensor-Test:** er nennt eine Zahl, die eine Route oder ein Ledger liefert (Fuellstand,
  Wartebudget, Deckel, Fensterbreite). Probe: jede Zahl im Render hat im selben Absatz einen
  `datei#symbol`-Verweis oder einen Pin in `e2e/pins.ts`; sonst gehoert sie in den Sensor.
- **Geschichte-Test:** er erzaehlt, wann und wie etwas bezahlt wurde, ohne dass die Regel selbst
  fuer den Leser eine andere Handlung ergibt. Probe: `rg -c 'bezahlt am|gemessen 20|Vorfaelle:' <fragment>`
  je Fragment ≤ 3; der Rest wandert ins Attic mit einem Verweis.
Die drei Proben sind billig und pin-faehig. Sie ersetzen kein Urteil darueber, WAS eine Regel ist;
sie sagen nur, wo sie nicht stehen darf.

## §4 Entwuerfe, woertlich einsetzbar

### (a) Lane-Brief-Template, wie eine Lane es liest

Kopf = Filing-Format (`card-extract.ts#FORMAT_KEYS`, um ROLLE-als-Klasse und DELEGATION erweitert);
danach die Prosa; danach haengt der Server Notizen, Quellpaket, Anker und Exit-Footer an (§6c).

```text
[TITEL in einer Zeile]
ROLLE: hand                       (Klasse aus .fleet/klassen.json; ein Tripel harness/model/effort bleibt als Override erlaubt)
GROESSE: klein|mittel|gross
FLAECHE: server.ts#confirmCardsForMain, e2e/tasks.ts
NEU: docs/messungen/2026-09-xx-thema.md            (optional)
NACH: 7ed73694                                     (optional)
VERIFY: install, pins | volle Kette | ./e2e-isolated.sh nur wenn e2e/, Wrapper oder Land-Pfad
DONE: <ein pruefbarer Satz mit dem Kommando, das ihn beweist>
DELEGATION: erdung:read-only                       (optional; Werte unten)
VERBOTEN: —
--- AUFTRAG ---
<Ziel in einem Absatz: beobachtbares Verhalten, nicht Schritte>

BEVOR DU SCHREIBST, stelle still fest (nichts davon wird Text im Report):
- welche Pruefung deine Aenderung deckt (GET /api/self/gate, classifiedAs) und ob eine Behauptung ueber deiner Zeile steht;
- wer sonst auf diese Dateien schreibt (Notizen auf deiner Flaeche, Welle) und was deine Aenderung falsch machen wuerde;
- wie dein Report in 4 000 Zeichen aussieht; Zahlen und Tails gehoeren in den Commit-Body.

DELEGATION (nur, wenn die Zeile oben gesetzt ist):
  erdung:read-only  — ein read-only Sub-Agent darf Dateien lesen und suchen und gibt NUR Befunde als
                      datei#symbol + ein Satz zurueck; du liest die Zeilen selbst, bevor du sie aenderst.
  perspektiven:n    — n read-only Sub-Agents lesen dieselben Quellen unter je einer Frage (Audit, Review).
  disjunkt:<dateien> — ein Sub-Agent darf GENAU die genannten Dateien aendern, die sonst niemand in dieser Lane anfasst.
  Nie im Sub-Agent: Suite, Commit, Land, POST /api/self/*, Dateien ausserhalb der Zeile, Regeln raten —
  ein Sub-Agent kennt dieses Repo nicht; gib ihm Dateien, Frage, Rueckgabeform, und lies sein Ergebnis als Claim.

REPORT: Summe, Verify-Tail woertlich, eine Zeile Offenes. Sonst nichts.
```

Was gegenueber heute weg ist: die Zeile „Project rules are in CLAUDE.md — they apply" (der Loader
liefert sie; eine codex-Lane hat sie nicht, dort gilt AGENTS.md), das ausgeschriebene Gate-Kommando,
der generische „silent complement"-Absatz — er wird zu drei konkreten stillen Fragen.

### (b) Rollenkarten-Geruest fuer Program-MAIN und Orchestrator

Servergebaut, zwischen Program-Payload und Anker (`server.ts#railBlockFor`), fuer beide Rollen
dieselben sechs Bloecke; nur die Inhalte unterscheiden sich. Der Orchestrator bekommt damit den
Rollenbrief, den er heute nicht hat (Befund 2); die Bind-Tuer waere die owner-authentifizierte
Bootstrap-Route, die ihn als Controller stempelt (Analog `buildSupervisorBindBrief`).

```text
--- ROLLE ---            Program-MAIN: „die eine autoritative MAIN dieses Programs"
                         Orchestrator: „Portfolio halten, Owner-Absicht in Programs uebersetzen; keine Program-Lane fuehren"
--- AUTORITAET ---       (A) reversibel im Scope → tun · (B) begrenzt (Ressourcen, Routing) → tun mit Grenze ·
                         (C) Scope, irreversibel, Aussenwirkung, Kosten, Deploy, Geschmack → Owner (AGENTS.md §Role contract)
--- DEINE TUEREN ---     Program-MAIN: program-execution (lesen) · tasks (filen, kind auftrag, ROLLE als Klasse) ·
                         tasks/:id/release · attention (GENAU eine je Owner-Grenze) · clarifications/:id/reply ·
                         inbox · tasks/:id/land (nur wenn nextAction es nennt) · watch merge → audit (idleSec:0, quittieren)
                         Orchestrator: programs (vorschlagen, lesen) · self · watch (kind lane/merge/audit) · KEINE Owner-Route:
                         du berichtest in deiner Pane; Land/Dispatch nur mit konkreter Owner-Delegation
--- DER LOOP ---         kleinster Akt → Klasse waehlen (hand fuer Bau, fremd fuer enge Lese-/Pruefslices, kopf fuer Denkauftraege) →
                         filen im Format (a) → release → warten ohne Beobachten → Report ist ein CLAIM: Diff + Verify-Tail lesen →
                         land nach Projektion → naechster Akt
--- STILLE FRAGEN ---    Welche Tuer gehoert dem Owner? Ist die Zeile ein Schnitt oder ein Programm (Vorgabe woertlich zitieren, Rangliste dort abschneiden)?
                         Kann der Report beweisen, was er behauptet? Welche Notiz auf der Flaeche der Zeile widerspricht ihr?
--- UEBERGABE ---        Program-MAIN: offene Pflichten lesbar in Program/Tasks/Reports/Inbox, dann succeed mit carry; kein HANDOFF-Commit
                         Orchestrator: HANDOFF.md-Abschnitt mit eigenem H1 (nur der oberste Block wird gelesen — Befund 1), committen, succeed
```

Nicht in die Karte: Modell-IDs (die Klasse traegt sie), Kontext-Band-Zahlen (Sensor `ctx`), die
Geschichte der Nachfolge-Faelle (`docs/controller.md` §Nachfolge bleibt die Langfassung).

### (c) Beispiel-Datensatz fuer Gueteklassen

Getrackt als `.fleet/klassen.json` (oeffentliche Modell-IDs, kein Konto). Ein Eintrag je Klasse;
der Dispatch loest `ROLLE: <klasse>` beim Release in `Task.spawn` auf, so bleibt das Ledger wie heute.

```json
[
  { "id": "kopf",
    "zweck": "orchestrieren, entscheiden, synthetisieren, adjudizieren",
    "rollen": ["controller", "program-main", "steward", "supervisor", "analyse"],
    "spawn": { "harness": "claude", "model": "claude-fable-5-1[1m]", "effort": "high" },
    "alternativen": [ { "harness": "claude", "model": "claude-opus-5[1m]", "effort": "high" },
                      { "harness": "codex", "model": "gpt-6-astra", "effort": "medium", "nur": "analyse" } ],
    "kontext": { "fenster": 1000000, "band": [25, 30], "uebergabe": "succession" },
    "brief": { "dichte": "duenn", "render": "main" },
    "erlaubt": { "subagents": ["erdung:read-only", "perspektiven"], "worker": ["card", "refine", "summary", "review"],
                 "skripte": ["ctl.sh", "state.sh", "register.sh"] },
    "verboten": ["land ohne Projektion", "Pane-Injektion", "Prozesszeilen ausgeben"] },
  { "id": "hand",
    "zweck": "einen Schnitt bauen und beweisen",
    "rollen": ["lane", "clarify-lane"],
    "spawn": { "harness": "claude", "model": "claude-opus-5[1m]", "effort": "high" },
    "kontext": { "fenster": 1000000, "band": [35], "uebergabe": "lane-handoff-report" },
    "brief": { "dichte": "karte+quellpaket", "render": "lane" },
    "erlaubt": { "subagents": ["erdung:read-only", "disjunkt"], "worker": [], "skripte": ["e2e-*.sh", "graph-coverage.ts"] },
    "verboten": ["Suite im Sub-Agent", "Commit/Land/Self-POST im Sub-Agent", "bun server.ts ohne Env"],
    "tools": { "deny": ["Workflow", "ScheduleWakeup", "ReportFindings"] } },
  { "id": "fremd",
    "zweck": "enge Lese-, Pruef- und kleine Bauslices auf fremder Harness",
    "rollen": ["lane"],
    "spawn": { "harness": "codex", "model": "gpt-5.6-sol", "effort": "high" },
    "alternativen": [ { "harness": "pi-zai", "model": "glm-5.3", "effort": "high", "nur": "owner-dispatch" } ],
    "kontext": { "fenster": 258400, "band": null, "uebergabe": "selbstauskunft" },
    "brief": { "dichte": "vollstaendig", "render": "keiner", "pflicht": ["verify ausgeschrieben", "verbote", "fuellstand melden"] },
    "erlaubt": { "subagents": [], "worker": [], "skripte": ["e2e-*.sh"] },
    "verboten": ["mehr als ein Schnitt", "Suite-Ausgabe in den Kontext"] },
  { "id": "wegwerf",
    "zweck": "eine Textantwort ohne Session: Karte, Zusammenfassung, Review, Merge",
    "rollen": ["worker"],
    "spawn": null,
    "routen": { "card": "claude-haiku-4-5-20251001", "refine": "claude-opus-5",
                "summary|commitMsg|enhance|digest": "codex-exec gpt-5.3-codex-spark",
                "review|merge|repair|cleanReview": "claude-sonnet-5[1m]" },
    "kontext": { "fenster": null, "band": null, "uebergabe": null },
    "brief": { "dichte": "template im repo" },
    "erlaubt": { "subagents": [], "worker": [], "skripte": [] } }
]
```

Die `routen` der Klasse `wegwerf` sind heute Code (`server.ts#WORKER_ROUTES`, `#CARD_MODEL`,
`#REFINE_MODEL`, `#SUMMARY_MODEL`) und bleiben es; der Datensatz nennt sie nur, damit EINE Datei
alle Modellentscheidungen zeigt. Ob der Server sie aus dem Datensatz liest, ist ein spaeterer Schnitt.

### (d) Vorgeschlagener Absatz fuer `AGENTS.md` (§Portable operating contract, nach „Load the smallest relevant context")

```text
- A sub-agent is a tool inside one session, not a Fleet principal. Delegate to one only for
  read-only grounding across more than a handful of files, for parallel read-only perspectives on
  the same sources, or for a mechanical change to files nobody else in this session touches — and
  only when the brief's DELEGATION line allows it. Never run a suite, commit, land, or call a
  `/api/self` door from a sub-agent; the session stays the one responsible voice. A sub-agent
  inherits none of this contract: give it the files, the question and the return shape, and read
  what it returns as a claim (`file#symbol` plus one sentence), never as verified. Your own context
  sensor does not see its tokens — total cost is measured, not assumed.
```

## §5 Gueteklassen und Profile (F4, F5)

**Warum vier Klassen und nicht drei Modelle.** Die Klasse ist die Guete, die ein Job braucht, nicht
das Modell, das gerade frei ist: `kopf` haelt und entscheidet, `hand` baut und beweist, `fremd`
faehrt enge Slices ohne Fuellstandssensor und ohne Regelbuch, `wegwerf` antwortet einmal. Die vier
unterscheiden sich in genau den Feldern, die heute als Prosa an drei bis vier Stellen stehen:
Fenster und Band (1M/25–30 · 1M/35 · 258 400/keins · keins), Uebergabe (succession · handoff-Report
· Selbstauskunft · keine), Render (main · lane · keiner · keiner), Brief-Dichte (duenn · Karte +
Paket · vollstaendig · Template), erlaubte Sub-Agents, Worker, Skripte. Ein Modell kann in zwei
Klassen stehen (Opus 5 als `kopf`-Alternative und als `hand`-Default); das ist gewollt, denn der
Owner-Entscheid vom 09-02 und der VERSUCH vom 09-07 (Controller auf Opus) sind genau dieser Wechsel.
Was heute `fable` gegen `claude-fable-5-1[1m]` heisst, wird eine Zeile im Datensatz.

**Wie ein Job seine Klasse traegt.** `ROLLE: hand` im Filing-Format; `card-extract.ts#validateCard`
prueft die Klasse gegen den Datensatz statt nur gegen `MODEL_RE`; beim Release loest der Dispatch
in das Spawn-Tripel auf (`server.ts#taskSpawnFromBody` bekommt die Klasse als dritte Form neben
„kein Tripel" und „Tripel"). Das Tripel bleibt im Ledger (`LaneOutcome.model/harness/effort`), so
dass keine Auswertung bricht. Die beiden Beispiele des Owners: d7b4b47d (Sharding-Probe) wuerde
`ROLLE: kopf` tragen — ein Bauauftrag, den der Owner ausdruecklich auf Fable will, also die
Klassen-Alternative statt einer Modell-ID; 1fc3a5c8 traegt `ROLLE: hand`. Ein Tripel als Override
bleibt erlaubt, damit ein Owner-Wunsch nicht am Datensatz vorbei muss.

**Was eine Klasse erlaubt** steht im Datensatz (§4c): Sub-Agents, Worker, Skripte, Kontextband,
Compact-vs-Nachfolge, Brief-Dichte, `tools.deny`. Die Fixkosten-Note misst, was `tools.deny` in
einer Lane kauft: Workflow + ScheduleWakeup + ReportFindings + ListAgents zusammen 4 900 Tokens
(gemessen in `-p`; interaktiv ungeprueft). Das Agent-Werkzeug (3 275) und das Agent-Listing (2 569)
bleiben fuer `hand`, weil die DELEGATION-Zeile sie braucht; fuer `fremd` sind sie ohnehin nicht da.

**Ein Datensatz oder zwei (21ade485 gegen c269023d).** Zwei, mit einem Schluessel. Das
Klassen-Profil ist die Agenten-Seite: oeffentlich, getrackt, von Karte und Dispatch gelesen, vom
Owner promoviert. Das Provider-Profil ist die Server-Seite: `{cacheTtlMs, quotaWindow, quotaResetAt,
softLimitPct}` je (harness, model, Konto) — Kontodaten, also gitignored in `fleet.json` oder
`.env`, von Empfaengerwahl, Spawn-Ablehnung und Board gelesen, nie in einen Brief geschrieben. Der
Join ist `(harness, model)`: die Klasse sagt, WELCHES Tripel ein Job bekommt; das Provider-Profil
sagt, OB der Server es jetzt spawnen oder anpingen soll. Ein Agent sieht von beidem nichts ausser
seinem eigenen `ctx` und der Dichte seines Briefs. Das ist die Bloat-Regel von c269023d, und sie
haelt nur, wenn die beiden Datensaetze getrennt bleiben — ein Kontoprofil im getrackten Repo waere
oeffentlich, ein Klassenprofil in `fleet.json` waere fuer Lanes unlesbar.

**Eine dritte Render-Achse „Modellklasse" braucht es NICHT.** Der Unterschied zwischen Opus-Lane
und Codex-Lane liegt in der Brief-Dichte und in dem, was die Harness laedt — beides regelt die
Klasse; das Regelbuch bleibt zweigeteilt (main/lane). Was die Lane-Fassung schrumpfen laesst, ist
nicht eine Achse mehr, sondern ein Fragment weniger (§6 S1). Die Fable-Safeguard-Fehlalarme
(Regelbuch-Kopf) sind eine Formulierungsregel im `kopf`-Profil (`brief.hinweise`), keine Fassung.

**Sub-Agents (F5): wann, wo, was nie.** Gemessen: 6/369 Lane-Transkripte mit Sub-Agent-Aufrufen,
alle 18 Aufrufe zerlegbare Lese- oder Fleissarbeit (504b0854); 0/142 im GLM-Fenster; die Fixkosten-
Note zaehlt 0/142 und empfiehlt trotzdem gebriefte Delegation. Abgeleitet: Delegation lohnt (1) in
`kopf`-Rollen fuer Erdung ueber mehr als ~5 Dateien und fuer parallele Audit-Perspektiven (die eine
gemessene Nutzung: Worktrail-IV-Lane liess ~400 KB Prosa unter Zitatpflicht lesen); (2) in `hand`-
Lanes nur als `erdung:read-only` — die Lane muss die Zeilen, die sie aendert, ohnehin selbst lesen,
also zielt die Delegation auf die SUCHE (2 790 Such- gegen 2 053 Lese-Aufrufe vor dem Marker,
Worktrail IV §2.2), nicht auf die Lesung; (3) `disjunkt:` nur bei Dateien, die sonst niemand in der
Lane anfasst. Nie: Suite (Mutex, Last), Commit, Land, `/api/self`-POST, gemeinsame Dateien, Regeln
raten (der Sub-Agent hat weder AGENTS.md noch Render). „Worker haben Worker" auf Fleet-Ebene bleibt
unter der Schnittlinie — die GLM-Note §4(e) hat das mit Code belegt (keine Tuer, Deckel 1,
Claim-Kette), und nichts hier widerspricht ihr.

**Wie man misst, ob es wirkt (504b0854 (c)).** `LaneOutcome` bekommt `subagentCalls` (Anzahl
`tool_use name=Agent` im Transkript) und `subagentTokens` (Summe `usage` der Sidechain-Zeilen
derselben `.jsonl`); beide 0 fuer Lanes ohne Transkript und `null` fuer fremde Harnesses. Dann 4–6
vergleichbare `hand`-Lanes mit gegen ohne DELEGATION-Zeile: Marker-Kontext, Endkontext,
Gesamt-Tokens (Lane + Sidechain), Land-Ergebnis, roter Audit. Kriterium: Marker-p50 sinkt, Gesamt-
Tokens steigen nicht ueber +10 %, Land-Quote gleich.

## §6 Schnittliste (F6)

Owner-Vorgabe woertlich: „mit sehr viel Bedacht angehen … und dann am Ende die bessere Version
bzw. Ansaetze+Idee und das Beste aus beidem nehmen". Erfuellt ist sie mit diesem Dokument und der
Synthese; die Schnitte darunter sind der Vorschlag, in Reihenfolge, jeder allein landbar.

1. **S1 — Lane-Render schrumpfen (Regelbuch).** `self-scheduling` in `self-lane` (Token-Hygiene,
   `GET /api/self`, autos) und `self-main` teilen; `FRAGMENTS_FOR.lane` = loader + lane-discipline +
   self-lane; die zehn Mutex-/Flake-/Suite-Bullets aus `lane-discipline` zu je einem Satz mit
   Verweis, Langfassung ins Attic. Done: Lane-Render < 20 000 Zeichen (heute 36 092) und die
   Tuer-Probe aus §3 = 0. Verify: `bun e2e/pins.ts` (RULE_VERIFY, §6b-Pin) + der Render-Einzeiler
   aus `rulebook.ts` + `rg -c` aus §3. Promoviert: Owner (Fragmente sind untracked; die Lane meldet
   den Text). Ersparnis abgeleitet: ~6,6 k Tokens je Claude-Lane (Fixkosten-Note).
2. **S2 — Klasse als Datensatz.** `.fleet/klassen.json` (§4c), `card-extract.ts` nimmt in ROLLE
   eine Klasse oder ein Tripel, `validateCard` prueft gegen den Datensatz, Release loest in
   `Task.spawn` auf; `wave-brief.ts#renderCardHead` zeigt die Klasse. Done: eine Zeile mit
   `ROLLE: hand` wird gueltige Karte, ihre Lane traegt im Ledger `claude-opus-5[1m]/high`; die
   MODELLPOLITIK-Zeile im Regelbuch wird ein Verweis auf den Datensatz. Verify: `e2e/cards`-Familie
   (Klasse gueltig, unbekannte Klasse = Luecke, Tripel-Override bleibt) + pins + volle Kette.
   Promoviert: Owner (Klassenliste und Zuordnung — Frage 1 in §8); baut: eine `hand`-Lane.
3. **S3 — Sub-Agents messbar und gebrieft.** `subagentCalls`/`subagentTokens` in `LaneOutcome`
   (`server.ts#buildLaneOutcome`, aus dem Transkript), DELEGATION-Zeile im Filing-Format und im
   Template (§4a), AGENTS.md-Absatz (§4d). Done: neue Ledger-Zeilen tragen beide Felder; eine Lane
   mit `DELEGATION: erdung:read-only` startet und der Wert steht im Ledger. Verify: ein Check in
   `e2e/tasks.ts` gegen ein Fixture-Transkript + pins. Promoviert: Owner (der Absatz); die A/B-Probe
   aus §5 laeuft danach als Messlane.
4. **S4 — Rollenkarten servergebaut.** `RAIL_HEAD` bekommt die Zeile „DEINE TUEREN" (§4b; Befund
   18), und der Orchestrator bekommt einen Bind-Brief nach dem Muster `buildSupervisorBindBrief`
   (Befund 2). Done: der Program-MAIN-Rail nennt `attention`; ein gebundener Controller hat einen
   Rollenbrief im Receipt (`briefSource founding`). Verify: `e2e/programs.ts` (Byte-Pin des Rails
   nachziehen) + pins. Promoviert: Owner (Text); baut: eine `hand`-Lane.

— Schnittlinie —

Nicht jetzt: **Provider-Profil (c269023d)** — braucht seine eigene Denknote (Messbarkeit je
Provider), und S2 legt vorher den Schluessel fest. **Dritte Render-Achse „Modellklasse"** — nicht
noetig (§5). **`tools.deny` je Klasse im Spawn** — erst, wenn geprueft ist, dass eine interaktive
Session die Schemas wirklich weglaesst (Fixkosten-Note §Was nicht gemessen wurde). **ctxPacks mit
Inhalt** — nach K1; **wenn K1 zeigt, dass das Quellpaket den Marker nicht senkt, rueckt S3 vor S2.**
**Steward-Regal und HANDOFF-Stapel** (Befunde 1, 8) — eigene Zeilen, nicht dieser Block.

## §7 Messplan

Jede Zahl mit Vorher-Wert und Quelle; „eigene Zaehlung" = Kommando in dieser Lane ueber die
gitignorten Ledger (nur gelesen).

| Groesse | Vorher | Quelle | Erwartung nach S1–S4 | Messweg |
|---|---|---|---|---|
| Start-Kontext einer Claude-Lane (p50) | 69 314 Tokens (n=180) | Fixkosten-Note | < 63 000 nach S1 (−6,6 k abgeleitet) | Skript `first.ts` der Fixkosten-Note ueber `~/.claude/projects/…-worktrees-fleet-*` |
| Kontext bei der ersten Aenderung (p50) | 151 k (Plan §1, „erste Aenderung"); Marker 189 349 (GLM §2.1, Edit/Write/commit) | Plan §1 · GLM-Note | K1-Kriterium < 120 k; mit DELEGATION zusaetzlich −10 % (Annahme) | Worktrail-IV-Rezept §5 / GLM §6 |
| Bash-Aufrufe vor dem Marker (p50) | 33 (Worktrail IV §2.2) | Worktrail IV | < 30 ueber 10 Lanes eines Bereichs | ebenda |
| Report-Deckel-Treffer | 130/181 Lanes, 334 Abweisungen (bis 09-13) | Worktrail IV §2.1 | 0 nach 56d2e084 (Deckel steht in Vertrag und Footer) | `grep -c 'text must be at most 4000' <transkripte>` |
| `sleep`-Aufrufe je Lane | 1 676 in 135/181 Lanes | Worktrail IV §2.5 | halbiert nach dem Footer-Satz vom 09-13 | ebenda |
| Land-Quote | 239/278 gelandet, 25 killed-empty, 9 killed-dirty (14 d) | eigene Zaehlung `lane-outcomes.jsonl` | gleich oder besser | dasselbe Kommando |
| Owner-Prompts in Lanes | 127 in 68/278 Lanes (14 d) | eigene Zaehlung (`ownerPrompts`) | sinkt (Tueren und Klassen klar) | dasselbe Kommando |
| Owner-Attentions | 20 gespeichert: 11 answered, 9 refused (Fenster nicht aufgeloest) | eigene Zaehlung `fleet.json#attentionRequests` | je Session ≤ 1 je Owner-Grenze | Zeitstempel-Feld klaeren, dann 14-d-Fenster |
| Fleet-Reports nach Status | 43 gespeichert: 34 complete, 9 needs-main | eigene Zaehlung `fleet.json#fleetReports` | Anteil `needs-main` sinkt | ebenda |
| Rote Post-Land-Audits | 112 gruen / 79 rot / 24 sonstige (14 d; Feldzuordnung `verdict|result|status`, Annahme) | eigene Zaehlung `post-land-audits.jsonl` | nicht schlechter; Flake-Familien getrennt lesen | Trail `docs/e2e-trail.md` |
| `subagentCalls` je Lane | 6/369 Transkripte, 18 Aufrufe | 504b0854 | > 0 in Lanes mit DELEGATION-Zeile; 0 sonst | Ledger-Feld aus S3 |
| Gesamt-Tokens je Lane inkl. Sub-Agents | nicht gemessen | — | ≤ +10 % gegen Lane ohne Delegation | `subagentTokens` aus S3 |
| Ledger-Modell-Schreibweisen | `fable` vs `claude-fable-5-1[1m]` nebeneinander | eigene Zaehlung | eine Schreibweise je Klasse | `rg -uu -o '"model":"[^"]*"' lane-outcomes.jsonl \| sort \| uniq -c` |

## §8 Nicht gemessen, Annahmen, Fragen an den Owner

Nicht gemessen: K1 (liegt nicht vor; §2 sagt, wo es den Vorschlag aendert) · ob Tonfall,
Grossbuchstaben und Geschichten die Ausfuehrung veraendern (kein A/B; die Zuordnung in §2 ist
abgeleitet) · Gesamt-Tokens inkl. Sidechain (kein Feld) · Startkontext einer codex/pi-Lane in
Tokens · ob `--disallowedTools` interaktiv wirkt · das Zeitfenster der Attention-/Report-Zaehlung.

Annahmen: (1) Das Quellpaket (25b90648) senkt die Lesung, nicht die Suche — darum zielt DELEGATION
auf die Suche. (2) Sidechain-Transkripte liegen in derselben `.jsonl` wie die Lane (Claude-Code-
Format); sonst braucht `subagentTokens` einen zweiten Pfad. (3) Der Owner will Klassen, die ein
Modell in zwei Klassen zulassen (Opus als `kopf`-Alternative und `hand`-Default).

Fragen an den Owner:
1. **Klassenliste und Zuordnung:** stimmen `kopf · hand · fremd · wegwerf` und die Defaults in §4c —
   insbesondere `kopf` = Fable, obwohl Orchestrator und Program-MAIN heute auf Opus laufen und der
   Supervisor-Slot auf codex/Sol steht?
2. **Sub-Agents mit Schreibrecht:** darf eine `hand`-Lane `disjunkt:<dateien>` benutzen, oder
   bleibt Delegation in Lanes strikt read-only, bis die A/B-Probe gelaufen ist?
3. **Ablage des Provider-Profils:** `fleet.json` (Server liest es ohnehin) oder `.env` (Deploy-Skript
   liest es)? Die Antwort legt fest, wo der Join-Schluessel `(harness, model)` beim ersten Schnitt
   entsteht.
