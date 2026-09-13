# Plan Fleet-Betrieb ab 2026-09-13 — Betrieb stabil, Queue startet selbst, Lanes lesen weniger ein

Owner-Auftrag 2026-09-13 (woertlich): „Ja, ich will, dass du jetzt einen Plan ausarbeitest, der sich um
all diese Punkte vernuenftig kuemmert." Die Punkte stammen aus demselben Gespraech: automatische
Freigabe („was startet, muss geprueft sein", „nicht zu streng"), vorher anreichern, Einlesen
verschmalern (Briefe/System) und hochwertige Datenschichten, graphify entschaerfen, Subagents weiterdenken,
Rollen/Briefe mit viel Bedacht ueberarbeiten.

Program: Fleet-Betrieb `f170dc46`. Autor: Orchestrator Slot 5. Alle Zeilen-IDs sind Queue-Zeilen in
`fleet.json`; Stand der Zeilen ist ein Schnappschuss vom 2026-09-13 abends — `./register.sh` ist die
lebende Ableitung.

## 1. Die Messungen, auf denen der Plan steht

| Befund | Zahl | Quelle |
|---|---|---|
| Freigabe ist der Engpass | 7 d: 94 `auftrag`-Zeilen gefilet, 38 Freigaben, alle von Hand | `docs/messungen/2026-09-13-queue-pipeline-system-entwurf.md` |
| Start-Kontext einer Claude-Lane | p50 69 k Tokens; andere Projekte starten bei ~43 k | 174 Lane-Transkripte, 14 d (Slot 5) |
| Einlesen bis zur ersten Aenderung | p50 151 k, also ~82 k Einlesen; davon Code 71 % (server.ts 33 %, e2e 20 %, Suchen 18 %), docs 6 %, CLAUDE/AGENTS 0,7 % | 163 Lanes, 14 d (Slot 5) |
| Kontext am Lane-Ende | p50 25 %, p90 42 %, max 89 %; kein messbarer Qualitaetsabfall | `docs/messungen/2026-09-13-lane-kontext-sub-worker-glm.md` |
| Kontext-Uebergabe fuer Lanes | live AUS (0 Zustellungen) | ebenda |
| Subagents in Lanes | 6 von 369 Transkripten, nur Lesearbeit | Notiz `504b0854` |
| Strenge Freigaberegel | 9 von 21 offenen Fleet-Betrieb-Auftraegen haetten sie bestanden; mit HART/HINWEIS-Trennung 13 | Slot 5, `fleet.json` |
| Warum die uebrigen 8 haengen | 3× „volle Kette" nicht erkannt, 2–3× Leser (Haiku/neue Datei), nur 2 wirklich unfertig | Slot 5 |
| graphify | 9 727 Mahnungen/14 d in MAIN-Sessions, 48 % der Antworten abgeschnitten, median 48 Commits veraltet, 19 % der Funktionen fehlen | `docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md` §3.5 |

Folgerung: schmalere Briefe/Regeln treffen die ~26 k Fleet-Fixkosten; der grosse Brocken ist
Code-Einlesen und gehoert einer Datenschicht. Die Automatik scheitert heute weniger an fehlenden
Inhalten als an einem strengen Leser.

## 2. Wer was tut

- **Orchestrator (Slot 5):** filet und schaerft Zeilen, gibt nach diesem Plan frei (bis die Politik in
  Welle 5 das uebernimmt), faehrt die Checkpoint-Messungen, haelt diesen Plan aktuell.
- **Program-MAIN Fleet-Betrieb (Slot 9):** treibt Lanes, landet, deployt, beurteilt Audits, faehrt die
  „nach dem Land"-Schritte, die in den Zeilen stehen.
- **Owner:** hat die drei Checkpoint-Entscheidungen (§4) am 2026-09-13 an den Orchestrator delegiert
  („Bitte beantworte die Fragen selbst"). Der Orchestrator entscheidet sie an den Zahlen und berichtet
  Entscheidung + Zahlen; K2 (Scharfschalten) wird trotzdem vorher gemeldet, nicht nachher.

Takt: hoechstens zwei bauende Lanes gleichzeitig plus eine reine Mess-Lane (Mac 8 GB, ein Suite-Mutex).
Freigegeben wird welleweise; eine Welle beginnt, wenn ihre NACH-Zeilen gelandet sind.

## 2a. Stand und Freigabe-Reihenfolge (Orchestrator Slot 7, 2026-09-13 ~20:5x)

Gelandet seit dem Plan: `e23a727a` (83989719), `56d2e084` (7c19d416), `cc8f31bd` (6871514c), `1a5c49fb`
RAM 1 (4fdc3ebb), `f6903d1e` graphify 1/2 (5927e099), `25b90648` Quellpaket im Brief (bdc9acdd).
Deploy von bdc9acdd: Slot 9, sobald kein Audit laeuft. Second-host `maxParallelSuites` 4: Neustart steht aus.

Laufend (Deckel 3): `1fc3a5c8` Suite 1/2 (bauend) · `adfc7506` RAM 2, Astra high (Mess-Lane) ·
`4f033335` Denkauftrag Fable; `8a3b1c46` Denkauftrag Astra steht `queued` und startet am naechsten freien Platz.

Reihenfolge danach — aus NACH-Ketten und Kartenflaechen, nicht nach Alter:

| # | Zeile | wartet auf | warum hier |
|---|---|---|---|
| 1 | `57d7ec3b` Startplan-Anzeiger | freier Platz | Kopf der Freigabe-Kette; teilt server.ts/e2e/tasks.ts/pins mit 31df1009, 35bc6afe, 6d841a14 |
| 2 | `d7b4b47d` Sharding-Probe (Fable) | Land 1fc3a5c8 | NACH-Kette; Flaeche fleet-e2e.ts/e2e/ctx.ts disjunkt zu 57d7ec3b |
| 3 | `35bc6afe` Karte anreichern + `31df1009` graphify 2/2 | Land 57d7ec3b | untereinander disjunkt (card-extract.ts+tasks.ts gegen pins+server.ts), also parallel |
| 4 | `6d841a14` Starten nach Plan | Land 35bc6afe | gross, allein bauen; teilt e2e/tasks.ts mit 35bc6afe |
| 5 | `f1aeba10` Politik | Land 6d841a14 und K2 | Scharfschalten vorher melden |
| — | `7363b89f`, `5ca92bfb` | ein bauender Platz ohne kettenreife Zeile | nur pins-Beruehrung, rebasen billig |

Unter der Linie, mit Grund: `e3e5084a` Handover-Record (gueltig, aber Nachfolge-Pfad — nach Welle 5 neu
bewerten); `1b47e29a` Mehr-Knopf (wartet auf Owner-Antwort zur UI, §5c); `11441e5e`, `1733502c`,
`42141e34` (heute gefilet, Karte ungueltig — nach 35bc6afe neu lesen lassen, sonst von Hand
schaerfen); `146c06f0`, `e04d15f0`, `ee47b0f8`, `f3ca2e05` wie §6.

Takt bleibt 2 bauend + 1 Mess-Lane; solange zwei Denk-Lanes und RAM 2 laufen, baut nur eine Lane. Das ist
gewollt: der Mac hat heute zweimal Hintergrundprozesse wegen Speichermangel beendet (RAM 2 klaert, ob mehr geht).

## 3. Die Wellen

### Welle 0 — Betrieb (Slot 9, sofort)

1. `e23a727a` (tickMigrate nur fuer claude, rollenrichtige MAIN-Nachricht) landen. Lane ist fertig
   (1 Commit, sauber).
2. Direkt nach dem Land, VOR dem Deploy: `FLEET_MIGRATE_PCT='32'` in `.env` (Owner-Freigabe
   2026-09-13). So nimmt EIN Neustart Code und Schalter zugleich auf.
3. Deploy ueber Verb 2; danach `bundleStale` und `deployGap` auf `/api/sessions` pruefen. Der Deploy
   bringt auch den neuen Karten-Leser v3 (Filing-Format ohne Modell, `NEU:`-Dateien) live.
4. Pruefen: die naechste claude-Lane ueber 40 % bekommt eine Uebergabe-Nachricht.
5. Rote Audits `a10af8de`, `cefbfabb` beurteilen.
6. Helfer-Daemon auf dem Second-host aktualisieren (sonst wirkt `80b9b650`/`b984fcac` nur halb).

*Fertig, wenn:* `deployGap.codeBehind` false, eine Uebergabe-Zustellung im Ledger, beide Audits beurteilt.

### Welle 1 — Einlesen und Anleitung (laeuft / jetzt)

| Zeile | Was | Flaeche | Stand |
|---|---|---|---|
| `56d2e084` | Lane-Anleitung: Report-Deckel, isolated-Pflicht, Warten ohne sleep | AGENTS.md, server.ts, e2e/pins.ts | laeuft |
| `25b90648` | Code-Ausschnitte in den Brief (context-snippets anschliessen; umgehaengt aus `c71b96eb`) | server.ts#briefAndSend, context-snippets.ts, e2e/tasks.ts | freigeben |
| `cc8f31bd` | Messung: woraus bestehen die 69 k Start-Kontext | nur docs/messungen | freigeben |

`56d2e084` und `25b90648` teilen nur `server.ts` in verschiedenen Funktionen — parallel vertretbar.

### Welle 2 — Sensor und graphify

| Zeile | Was | NACH |
|---|---|---|
| `57d7ec3b` | Startplan-Anzeiger: was wuerde starten, welche Pruefungen bestanden | `51df715e` (gelandet) |
| `f6903d1e` | graphify 1/2: Read-Hook raus, ehrliche Wortwahl, Abdeckungs-Sonde | `20fb7151` (gelandet); wegen AGENTS.md/pins nach `56d2e084` |

### Welle 3 — Anreichern und frischer Graph

| Zeile | Was | NACH |
|---|---|---|
| `35bc6afe` | Karte anreichern, deterministisch: „volle Kette"/„e2e-isolated" sind Pruefwege, Validator v4 liest alte Karten neu | `57d7ec3b` |
| `31df1009` | graphify 2/2: Graph nach jedem Land code-only neu bauen | `51df715e` (gelandet); nach `f6903d1e` |

### Welle 4 — Starten nach Plan

`6d841a14` (gross, allein bauen): der Tick startet die erste Welle des Startplans statt der aeltesten
Zeile — Buendel, Reihenfolge, Kollision. Die Menge der freigegebenen Zeilen aendert sich nicht.

### Welle 5 — Automatische Freigabe

`f1aeba10`: Freigabe als Program-Politik. HART (sonst kein Selbststart): Fertig-Kriterium, Pruefweg,
belegte Dateien, Quelle Owner oder gebundene MAIN, keine Scout-Idee. HINWEIS (startet trotzdem):
fehlende Groesse, Symbol-/Rollen-Luecke. `hold` als Notbremse. Nach dem Land nur Fleet-Betrieb auf
`card-valid`; Leichtgewicht und Biber bleiben manuell.

## 4. Checkpoints und Owner-Entscheidungen

- **K1 — wirkt die Datenschicht?** Nach Deploy von `25b90648`, an 10 natuerlichen claude-Lanes:
  Kontext bei der ersten Aenderung p50 < 120 k (heute 151 k) und weniger Bash davor. Ja ⇒ als
  naechstes ein Test-Paket fuer e2e-Lanes (ctxPack `e2e-check-schreiben`, Worktrail IV §3.4) filen.
  Nein ⇒ zuerst verstehen, warum, kein zweites Paket. *Entscheidet: Orchestrator (delegiert).*
  **Verfahren (Slot 7, 2026-09-13):** `python3 docs/messungen/k1-kontext-erste-aenderung.py --since <Boot des
  Deploys> --rows` — vorher und nachher durch dieselbe Definition (Kontext der Assistant-Nachricht, die die
  erste Edit/Write- oder schreibende Bash-Aktion ausloest), dazu getrennt: Lanes MIT geliefertem Quellpaket.
  Basis nach dieser Definition, 14 d bis 20:5x: **p50 134 k, p90 185 k, Bash davor p50 23, n=178**. Die 151 k
  oben stammen aus einer anderen, nicht festgehaltenen Definition und sind kein Vergleichswert. Neues
  Kriterium: p50 der Lanes MIT Quellpaket < 115 k (−15 %) und Bash davor sinkt, n ≥ 10.
- **K2 — ist die Automatik scharf genug, aber nicht zu streng?** Nach Deploy von `57d7ec3b` und
  `35bc6afe`: der Anzeiger zeigt, wie viele offene Fleet-Betrieb-Auftraege HART bestehen. Unter der
  Haelfte ⇒ Gruende zaehlen und dem Owner vorlegen, bevor `f1aeba10` scharf geschaltet wird.
  *Entscheidet: Orchestrator (delegiert), vorher gemeldet.*
- **K3 — eine Woche `card-valid`:** die MAIN nennt die ersten fuenf Selbststarts einzeln und zaehlt,
  was an HART haengen blieb. Still gelockert wird nie.

## 5. Rollen und Briefe (Richtung `6bd2e49c`) — mit Bedacht, nicht in einer Welle

Owner-Wunsch: sehr bedacht, parallel auch mit einer Astra-Session ausarbeiten, das Beste aus beiden
nehmen. Start, wenn `cc8f31bd` (Fixkosten) und K1 (Datenschicht-Wirkung) vorliegen — vorher wuesste
der Entwurf nicht, was Brief und was Datenschicht tragen soll.

Eingaenge, die schon an der Zeile haengen oder hier genannt sind: Worktrail IV (`60b23ebc`),
Lane-Kontext (`79681633`), Subagent-Notiz `504b0854` (DELEGATION-Zeile, AGENTS.md-Absatz,
`subagentCalls` messen, A/B), Einlesen-Messung (Kommentar an `6bd2e49c`), dazu `cc8f31bd` und K1.
Form: zwei unabhaengige Denkauftraege (Fable, Astra), gleiche Eingaenge, ein Vergleich — Ergebnis ist
ein Vorschlag an den Owner, kein Code.

**Stand 2026-09-13 ~19:4x:** `cc8f31bd` ist gelandet (`6871514c`): Start 71 387 Tokens = fester
Praefix 32 467 (davon ~30 200 Werkzeug-Schemas) + Lane-CLAUDE.md-Render 18 335 + Skill-Listing 6 618
+ Brief/globale CLAUDE.md/MEMORY.md/Agent-Listing je ~2,6–2,9 k; kuerzbar am meisten Render (~6,6 k),
ungenutzte Werkzeuge (≥4,9 k), Listings (2,3–8,1 k). **Entscheid (Orchestrator, delegiert):** der
Doppel-Denkauftrag wartet NICHT auf die 10-Lane-Messung von K1, sondern startet, sobald `25b90648`
gelandet ist; K1-Zahlen kommen als spaeter Eingang dazu. Grund: Rollen, Briefe und Modellklassen
haengen nicht an der Wirkungszahl, nur ihre Datenschicht-Abgrenzung — und die ist ein Abschnitt,
kein Vorbehalt fuer den ganzen Auftrag. Denkblock-Partner: `21ade485` (Modellklassen, Owner-Gedanke
„Gueteklassen: ein Job traegt, welche Klasse ihn ausfuehrt, verbunden mit der Sub-Agent/Worker/
Skript-Konfiguration" als Kommentar) und `c269023d` (Provider-Profile).

**Stand ~20:5x (Slot 7):** gefilet und freigegeben als `4f033335` (Fable 5.1 high) und `8a3b1c46` (Astra
medium, Astra-Schablone) — gleicher Kern (Owner-Worte, Fragen F1–F6, Gliederung §1–§8 mit Entwuerfen:
Lane-Brief-Template mit DELEGATION, Rollenkarten MAIN/Orchestrator, Gueteklassen-Datensatz,
AGENTS.md-Absatz Sub-Agents), gegenseitig nicht lesen. Ergebnis: `docs/messungen/2026-09-14-rollen-briefe-
modellklassen-{fable,astra}.md`. Danach: Synthese Orchestrator + Owner, Abschnitt fuer Abschnitt.

**Stand ~21:3x:** beide gelandet (Fable `fc743413`, Astra `ab03a032`, Astra bestaetigt: Parallelentwurf nicht
gelesen). Entscheidungsvorlage `docs/messungen/2026-09-14-rollen-briefe-synthese.md` (Fable-Subagent des
Orchestrators): Form von Fable, Semantik von Astra; vier Schnitte (Render schrumpfen · Delegation gebrieft
und messbar · Klassen-Register erst im Schatten · Rollenkarten); fuenf Owner-Fragen mit Empfehlung. Vom
Orchestrator nachgeprueft: eine `KLASSE:`-Kopfzeile macht eine Karte heute zu Prosa
(`card-extract.ts#parseFormattedCard`, Probe mit/ohne Zeile) — der Parser muss vor jedem Template-Schnitt
erweitert werden. **Wartet auf die fuenf Owner-Antworten**; danach Schnitte filen, G1 (§5d) freigeben.

## 5b. Suiten, RAM, Handoff-Rauschen — Owner 2026-09-13 „alles angehen"

Gemessen (Slot 5): volle Suite ~39 min (2 311–2 350 s, ~4 400 Checks), 69 % davon Luecken ≥ 3 s;
Second-host bei 3 Suiten 91–94 % CPU-frei, ~270 MB je Suite; Land-Gate haelt den Mutex schon ueber
die ganze Kette (`holdSuiteLock` im `gateRun`), Gate-Warten 3 d p50 0 / p90 275 s.

| Zeile / Akt | Was | Modell | Reihenfolge |
|---|---|---|---|
| Second-host `maxParallelSuites` 3 → 4 | Config geaendert 19:28, Backup `config.json.bak-20260913-suites3`; greift erst nach Daemon-Neustart — ein Hintergrund-Waechter startet neu, sobald `running` 0 ist (sonst beim naechsten `daemon-update`). Nach einem Tag messen, dann 5 | — | laeuft |
| `1fc3a5c8` | Suite schneller 1/2: lange Test-Wartezeiten kuerzen (500 s in 36 Checks, 227 s in e2e/programs.ts) | Opus 5 | nach `f6903d1e` |
| `d7b4b47d` | Suite schneller 2/2: Sharding-Probe `--shard k/n`, Abhaengigkeitskarte | Fable 5.1 (Owner-Wunsch) | nach `1fc3a5c8` |
| `1a5c49fb` | RAM der Slots/Sessions: messen, zerlegen, Rangliste (Baseline: Mac Swap 2,66 GB, ~33 Playwright-MCP-Prozesse fuer 7 Claude-Sessions) | Astra, medium | gelandet 4fdc3ebb — flach (8 min, 2 k Reasoning-Tokens): „outside/other" 3,8 GB ungeklaert, RSS statt Footprint, MCP-Hebel unbewiesen |
| **Second-host 4 Suiten ZURUECKGENOMMEN** (Slot 7, 21:3x) | RAM 2 §F7 + Live-Messung: `/tmp` ist tmpfs 3 930 MB, 98 % voll (94 MB frei), 68 e2e-Instanzen (46 > 24 h), ~1,8 GB davon nichtresident = fast der ganze Swap. Config wieder 3 (`config.json.bak-20260913-suites4` behalten), Neustart-Waechter gestoppt, Slot 9 informiert. Altbestand loeschen = Owner-Akt (gefragt). Dauerfix `1aaf7eb8` (C1: Scratch auf Disk, Retention schuetzt aktive Runs) freigegeben; 4 erst nach C1 + Vierer-Pilot (C5) | — | laeuft |
| `adfc7506` | RAM 2/2: optimieren statt messen — F1–F9, Top-3-Hebel mit Probe (Wegwerf-Pane auf eigenem Socket), Schnitte als Filing-Bloecke | Astra, high (Owner) | gelandet 79fb4c96 — Rangliste: (1) Second-host-tmpfs-Scratch, (2) Browser-MCP nur in Browser-Aufgaben: Probe −203 MB Claude / −169 MB Codex, (3) fertige Sessions freigeben, (4) Transkript-Leser mit Bytebudget −60 MB, (5) Suite-Zulassung erst nach C1; Schnitte C1–C6 |
| `7363b89f` | HANDOFF entruempeln: Rotation + state.sh-Warnung (271 HANDOFF-Commits/14 d, Datei 572 KB) | Opus 5 | frei |
| `5ca92bfb` | Land-Chronik: eine Zeile je Land aus den Land-Notizen, kein Squash | Opus 5 | frei |

Squash-Entscheid: kein Umschreiben, kein Squash beim Land (509/674 Lands sind schon ein Commit).
Ein gesquashter LESE-Branch am Hub waere eine Einbahnstrasse fuer spaeter; vorher fehlt, dass
Land-Notizen ueberhaupt zum Hub reisen (gemessen: der Hub traegt nur `main` + `second-host/*`).

## 5c. UI — nach diesem Plan

Owner 2026-09-13: die Kernansicht bleibt; umstrukturiert werden die linke Spalte (`#side`: Kopf,
Werkzeugleiste, Session-Liste) und die rechte (`#board`, „Session brief") EINZELN. Die „Lage"-Sicht
(was laeuft / startet / wartet / wo der Owner gebraucht wird) gehoert ins Hub-Overlay
(`docs/fleet-hub-overlay-2026-09-06.md`), nicht in diese Spalten. Vorgehen je Spalte: nummerierte
Screenshot-Bestandsaufnahme → Owner markiert in eigenen Worten → eine Lane mit seinen Worten
woertlich → Vorher/Nachher-Screenshot (Rechner + Handy). Neue Knoepfe gehen zuerst ins
„Mehr"-Panel (`1b47e29a`). Offen beim Owner: linke Spalte zuerst? Screenshots erlaubt?

## 5d. Spiele mit Astra — Astra → zwei Grok-Sessions → Game-Studio (Richtung `262a8f71`)

Owner 2026-09-13 13:3x woertlich: „Wir sollten hier Grok fragen, was die mittlerweile am besten etablierten
Art und Weisen sind, Spiele mit Astra zu bauen, und wie man Astra am besten dazu bekommt, Arbeit anzuweisen
oder auch selbst Subagenten zu benutzen … Neben diesen beiden Punkten sollten wir ihr dann einfach erklaeren,
nach welcher Struktur wir das Ganze haben wollen, damit Claude Fleet es am Ende sauber weiterentwickeln kann
… anstatt uns in Workflows zu verirren." Reihenfolge laut Zeile: nach Task-Aggregation, Worktrail IV und
Rollen/Briefe — die ersten beiden sind gelandet, Rollen/Briefe steht in der Synthese (§5). Program:
Private-repo-j `9ce08219` (MAIN-Bindung Slot 2 ist tot; Slot 2 ist heute Supervisor).

| # | Schritt | Wer | NACH | Ergebnis |
|---|---|---|---|---|
| G1 | Die zwei Grok-Prompts scharf formulieren — (1) **Astra-Orchestrierung**: wie bringt man Astra dazu, Arbeit anzuweisen und selbst Sub-Agents zu nutzen; (2) **Astra Game-Development Best Practices**: die etabliertesten Wege, Spiele mit Astra zu bauen — je ein kopierfertiger Prompt mit dem, was Grok ueber Fleet wissen muss (Harness codex/gpt-6-astra, native Sub-Agent-Threads, Studio-Laeufe aus docs/game-maker/worktrail-audit-II/-III: was scheiterte, Owner hat die Spiele nicht gespielt), oeffentlich-sicher | Astra-Lane (medium), Fleet-Betrieb | Synthese §5 entschieden | `docs/messungen/…-grok-fragen-spiele-astra.md` |
| G2 | Zwei Grok-Sessions, eine je Frage; Antworten woertlich als Notiz unter `262a8f71` | **Owner** (kein Netz von dieser Maschine) | G1 | zwei Notizen |
| G3 | Ziel-Struktur fuer das Game-Studio: Program → Studio → Akte → Lanes, Objekte/Ledger/Verify, Delegation ab Harness-Ebene (codex-Sub-Agents) statt nur per Prompt, Gueteklassen aus der Rollen-Synthese, was Fleet danach uebernimmt | Astra-Lane (high), Brief nach docs/astra-briefbaustein-2026-09-07.md | G2 + Owner-Entscheid Rollen/Gueteklassen | Vorschlagsdoc, kein Code |
| G4 | Owner entscheidet die Struktur; danach Private-repo-j neu aufsetzen: die fuenf pending Biber-Zeilen (`32fed872`, `ad3b3960`, `6e7de1eb`, `0610f3a5`, `e80466c9`, alle Karte ungueltig) gegen die neue Struktur lesen — uebernehmen, neu filen oder archivieren; Mandat `a33d7300` bleibt Quelle | Orchestrator + Owner | G3 | Program mit gebundener MAIN und erster Welle |

G1 ist klein und darf frueher laufen, sobald die Rollen-Synthese entschieden ist; G3/G4 bleiben „zuletzt"
im Sinne des Owners — erst wenn Wellen 3–5 dieses Plans stehen oder der Owner das Studio vorzieht.

## 5e. Nachbar-Programs und programlose Owner-Richtungen — damit der Plan vollstaendig ist

**Leichtgewicht `f9dc8e10` (MAIN = Astra-Controller Slot 10, faehrt selbst):** 14 offene Auftraege — Feld-
Schnitte (`60fff186` from, `666d0b67` refine, `df50b95b` criterion, `e0c1ba07` filesProposal, `f6db3487`
filesOrigin-Nachweis), sieben `[NACHFOLGE:…]`-Zeilen (`531bab26`, `60257e41`, `67abe12c`, `9940ec64`,
`a05fa7ff`, `a17a630b`, `db756205`), `42c53378`, `04f55eba`. Dieser Plan gibt sie nicht frei; der Orchestrator
prueft nur Flaechen-Kollisionen mit Fleet-Betrieb (meist `server.ts`) vor jeder eigenen Freigabe.

**Programlose Owner-Richtungen und Auftraege:**

| Zeile | Was | Einordnung |
|---|---|---|
| `3f7363bf` | Pruefapparatur deterministisch und leichter (Owner 09-08; 26 % rote, 20 % unknown Audits) | nach 1fc3a5c8/d7b4b47d neu messen — die Suite-Arbeit ist ihr erster Teil; dann ins Program holen |
| `0694cb78` | Docs ohne Suite und ohne eigenen git-HEAD (Teil 1 erfuellt) | Teil 2 zusammen mit `5ca92bfb` Land-Chronik/`7363b89f` HANDOFF-Rotation lesen |
| `233ee108` | Dokument „wie Prozesse wirklich aussehen sollen" (agentische Analyse + Auto-Dispatch) | wird von Welle 4/5 (Starten nach Plan, Politik) praktisch beantwortet; danach als Doc schliessen |
| `e9c47a54` | Merge-Zustandsflaeche luegt oder haengt (MergeLast) | Nachbar von `11441e5e` — zusammen schaerfen, nach 35bc6afe |
| `812e8458` | Sicherheit der Session-Kommunikation spaeter | bewusst spaeter (Owner) |
| `9fe80661` README aus der Codebase · `e1ce58fd`, `fa1112eb` Steward-Briefs | klein; `fa1112eb` ist Nachbar von e9c47a54 | Lueckenfueller nach Kartenpruefung |

**Fleet-Betrieb, bisher ungenannt:** `1832c7eb`/`7ed73694` Lebenszyklus S5c/S12 (codex sol) und `66df05b4`
nach Welle 5 neu bewerten; `ee824afd` Channels-Probe und `ff88072c` agentische Code-Bewertung (Karte
ungueltig) — nach 35bc6afe neu lesen; `e4409bf2` clarify first.

## 6. Unter der Schnittlinie — bewusst spaeter

- `e04d15f0` Init je Repo — Karte ungueltig (`.fleet/init.md` steht unter FLAECHE statt NEU); nach Welle 3 neu lesen lassen oder mit NEU neu filen.
- `146c06f0` Inbox-Nudge — Slot 9 entscheidet den Zeitpunkt.
- `ee47b0f8` (Lebenszyklus S5b, ohne Fertig-Kriterium/Pruefweg) und `f3ca2e05` (erst klaeren) — brauchen menschliches Anreichern, starten nie von selbst.
- e2e-Test-Paket — erst nach K1.
- Private-repo-j `262a8f71` — ausgearbeitet als Spur §5d (G1–G4).

## 7. Was dieser Plan nicht behauptet

- Die Token-Zerlegung des Start-Kontexts war abgeleitet; `cc8f31bd` hat sie gemessen (§5, Stand), meine fruehere 11-k-Schaetzung fuer den Render war zu niedrig (gemessen 18 335).
- Ob Code-Ausschnitte das Einlesen wirklich senken, ist ungemessen — K1 entscheidet.
- Ob eine graphify-Antwort auf die richtige Datei zeigte, ist ungemessen; rg/Read nach einer Query ist gewollter Ablauf, kein Gegenbeleg.
- Fremd-Harness-Lanes (codex/pi) sind in den Einlese-Zahlen nicht enthalten.
