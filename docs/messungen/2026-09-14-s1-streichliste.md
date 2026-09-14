# S1 — Streichliste fuer den Lane-Render (2026-09-14, Orchestrator Slot 8, VOR dem Render)

Zeile `f4c2033d` (Rollen-Synthese S1). Owner-Vorgabe 17:5x: Streichliste als Tabelle VOR dem Render,
Render erst nach Owner-OK. Diese Notiz IST die Tabelle; gerendert ist noch nichts.

## 0. Gemessen (Render aus `rulebook.ts#renderRulebook("lane")`, 18:4x)

| Groesse | heute | Ziel |
|---|---|---|
| Lane-Render | 36 763 Zeichen (loader 3 231 · lane-discipline 23 488 · self-scheduling 9 612) | < 20 000 |
| Tuer-Probe `rg -c 'a lane may not\|nicht-Lane-only\|POST /api/self/(watch\|succeed\|retire\|release\|attention)'` | 6 | 0 |
| Geschichte-Probe `rg -c 'bezahlt am\|gemessen 20\|Vorfaelle:'` | 4 (3 in lane-discipline, 1 in self-scheduling) | ≤ 3 je Fragment |
| Attic-Verweise | 9 | — |
| Schnittsumme dieser Liste (gerechnet) | −17 400 ± 800 | Rest ≈ 19 300 |

Die Tuer-Treffer sind alle sechs in `self-scheduling`: die Self-Prinzipal-Liste (watch/succeed/retire),
die Gegenprobe `rg -n "not a lane|a lane may not|…"`, der Nicht-Lane-only-Absatz (2×), der
watch-Absatz und der succeed-Absatz. Der Lane-Render ist wirklich die Kopie, die eine Lane bekommt
(`server.ts` Zeile `renderRulebook("lane", frag)` im Lane-Spawn, verifiziert 18:4x).

## 1. Die drei Pins, die ein Schnitt treffen kann (am Code gelesen, `e2e/pins.ts` §6/§6b)

1. **`RULE_PLACED`** („every rule of the meaning probe stands in the fragment its Fragment column
   names"): jede Zeile L1–L5, D1–D48, F1–F8 der Bedeutungsprobe
   (`docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md`) muss ihre `<code>`-Muster im genannten
   Fragment finden. **Eine Streichung, die ein Muster entfernt, faellt das Land an Stufe 1.** Darum
   traegt jede Zeile unten die Spalte „Probe": *bleibt* (Muster steht im Verweis-Satz, weil es der
   Kern der Regel ist — kein Stuffing), *→ einstieg* (Umzug, Fragment-Spalte wird umgeschrieben und
   im Prosa-Teil nach dem Muster von Schnitt C benannt — der Pin verlangt genau das) oder
   *Zeile streichen* (die Regel verlaesst das Regelbuch ganz, `AGENTS.md` traegt sie; die Zeile wird
   aus der Tabelle genommen und in einem neuen Absatz „Schnitt S1" aufgezaehlt).
2. **`RULE_PATHS`/`RULE_GREPS`/`RULE_ANCHORS`** (§6): jeder Pfad, jedes `grep`-Rezept und jeder
   `§`-Anker, den der Render zitiert, muss aufloesen. Ein Verweis-Satz darf also nur existierende
   Ziele nennen; die neuen Attic-Abschnitte muessen VOR dem Render existieren (getrackt ⇒ Commit).
3. **`RULE_RENDER`** (§6b): CLAUDE.md = Render der sieben Fragmente Byte fuer Byte — nach jedem
   Fragment-Edit rendern, nie CLAUDE.md anfassen.

`RULE_VERIFY` (Ordnung der Schrittkette) liest `watchdog.sh`, `AGENTS.md`, `verify-proportion.ts` —
NICHT das Regelbuch. Die Verify-Kette darf also aus dem Fragment, ohne dass diese Sonde reagiert.

## 2. Die Tabelle

Spalten: Block = Fragment#Index (Reihenfolge der Bullets im Fragment) · Aktion ∈ gestrichen /
gekuerzt / verschoben / bleibt · Zeichen vorher → nachher (nachher geschaetzt am Entwurfssatz) ·
Probe = Auswirkung auf die Bedeutungsprobe.

### 2a. AGENTS-Dubletten → je Thema ein Verweis-Satz (Owner-Antwort 1)

| # | Block | Aktion | Grund | Zeichen | Probe |
|---|---|---|---|---|---|
| 1 | lane#1 „Proportionale lokale Verifikation" | gekuerzt auf 1 Satz | Vollstaendig in `AGENTS.md` §Verify (localProof.steps, classifiedAs, null ⇒ volle Kette, docs-only kurz in Gate UND Audit, koaleszierter Eintrag, nie an den Helfer). Satz: „Proportionale Verifikation — erst `GET /api/self/gate`, dann `localProof.steps`; `isolatedPreview` steuert nur die Vorschau: `AGENTS.md` §Verify, Mapper `verify-proportion.ts`." | 1 516 → ~200 | D1 bleibt (`localProof.steps`) |
| 2 | lane#2 „Suite-Offer" | gekuerzt auf 1 Satz | `AGENTS.md` §Verify: anbieten, idle gehen, lokal erst nach Wartebudget; Ausnahme Suite-Reparatur. Satz behaelt, was AGENTS nicht traegt: Rueckzugsroute und die zwei Budgets als Symbol (`server.ts#SUITE_OFFER_WAIT_FREE_MS`/`_HELD_MS`, gepinnt), Zahlen raus. | 796 → ~220 | keine Zeile |
| 3 | lane#3 Done-Satz + Tail | bleibt | 199 Zeichen, die wichtigste Regel; Dublette zu §Before you start ist billiger als ein Verweis. | 199 | D2 bleibt |
| 4 | lane#5+#6+#7 Verify-Kette + Erklaerung | gestrichen, 1 Absatz Verweis | Kette woertlich und kopierbar in `AGENTS.md` §Verify. Bleibt: „sie IST Schritt fuer Schritt der Live-Land-Gate (`watchdog.sh`, `VERIFY_CMD`; bei Abweichung gilt die Datei), `bun e2e/pins.ts` ist seine ERSTE Stufe (Millisekunden, kein Server), `RULE_VERIFY` haelt die Ordnung ueber die drei Quellen." Geschichte (Build-Luecke, Gate-Loecher) bleibt Attic §4. | 1 441 → ~420 | **D4 Zeile streichen** (Muster = die Kette selbst); D5 bleibt (`ERSTE Stufe`) |
| 5 | lane#8 „e2e-isolated ist Tier-2-Vorschau" | gekuerzt | Ausloeser-Liste steht in `AGENTS.md` §Verify. Bleibt host-spezifisch: Tier-2-Vorschau/kein Gate; `e2e/security.ts` laeuft AUSSCHLIESSLICH dort; `./e2e-clean-review.sh` bei Merge-/Land-Pfad; `./e2e-postland-audit.sh` bei Audit-Pfad (kein Gate faehrt sie). Die Stau-Zahlen vom 2026-09-06 (7 h Suiten, 3/11 Timeouts) → Attic §9-Nachtrag. | 1 339 → ~640 | D6/D7/D8/D9 bleiben |
| 6 | lane#14+#15+#16 roter Check (drei Bullets) | gestrichen, 1 Absatz Verweis | `AGENTS.md` §A red check is yours traegt: deiner bis Gegenbeweis, denselben Baum erneut, Sonde vor Code, Signatur lesen, Sonde scheitert als sie selbst, ~5×. Bleibt als Host-Zusatz: HEAD-Worktree nur Fallback (gruener HEAD-Lauf trennt nichts), Zeiger `docs/verify-tiering.md` §11.7, Belege Attic §10. | 1 430 → ~420 | D16/D17/D18/D19/D20 bleiben (Kern-Woerter DEINER, denselben Baum, SONDE, SIE SELBST, ~5 stehen im Verweis-Absatz, weil sie die Regel sind) |
| 7 | lane#25 Runner-Regel | gekuerzt | `AGENTS.md` §Where a test goes traegt runner-only, Familie, harness.ts, ctx.ts, pins-Regel. Bleibt: `paneEnv()`-Pflicht, die vier Einzeldatei-Harnesses, Kopierlisten aus `e2e-stage.sh` (`3d38960`, zwei Pins). | 894 → ~480 | D29/D30 bleiben |
| 8 | lane#37 „Nie ueber Namensmuster beenden" | gekuerzt | Kern in `AGENTS.md` §Verify („never kill a suite run by name pattern … PID you noted"). Bleibt host-spezifisch: Scratch-Instanzen per `tmux -L <sock> kill-server`; **Regel B** (Owner-Promotion 2026-09-14) woertlich; Wrapper-Kill reicht nicht (Runner + `tmux -L fleettest<pid>`); zwei verschraenkte Laeufe. Geschichte (gemessen 2026-08-06, falsches Rot) → Attic §15 (steht dort). | 1 121 → ~600 | D45/D46/D47 bleiben |

Summe 2a: −5 600 (Owner-Schaetzung 5 200 — die Differenz ist lane#8 und lane#37, die halb dublett sind).

### 2b. Suiten-Innenleben, das nur der Adjudizierer braucht → je ein Satz + Attic-Verweis (Fable §6 S1)

Die Originalbloecke liegen bereits in `docs/attic/regelbuch-messgeschichten-2026-08.md` §15.30–§15.37
(gegengelesen an den Ueberschriften 18:4x); der Render behaelt nur den Satz, der eine Handlung aendert.

| # | Block | Aktion | Grund | Zeichen | Probe |
|---|---|---|---|---|---|
| 9 | lane#19 Suite-Mutex (drei Sensoren, drei Nullfenster) | gekuerzt auf 2 Saetze | Handlung fuer eine Lane: kein `until mkdir`; Lock-Dir existiert ≠ gehalten, `pid`-Datei entscheidet, pid-lose Dir = Park-Halt, nie reapen. Sensor-Rangfolge und Nullfenster braucht nur, wer die Maschine beurteilt. | 1 220 → ~320 | D23 bleibt (`existiert ≠ gehalten` · `pid`) |
| 10 | lane#20 Ticket-Schlange | gekuerzt auf 1 Satz | Fairness-Mechanik; eine Lane muss nur wissen: Warten ist geordnet, `position N of M` ist normal, der Server steht nicht in der Schlange. | 1 125 → ~200 | keine Zeile |
| 11 | lane#21 „drei Zahlen" | gekuerzt auf 1 Satz | Diagnose-Rezept fuer den Beobachter; Lane braucht: Wrapper-ELAPSED ≠ Laufzeit, Gate gewinnt den Mutex DREIMAL, `nohup`-Ausgabe ist blockgepuffert (`server.log`/Trail). Messungen bleiben Attic §15. | 1 248 → ~330 | D28 bleibt (`server.log`, auch in #24) |
| 12 | lane#23 parallel-sicher ≠ Maschinenlast | gekuerzt | Kern bleibt woertlich (Maschinenlast, Freifahrtschein, seriell, Audit IST e2e-isolated); die Erklaerung von SOCK/PORT/DIR aus `$$` auf einen Halbsatz. | 639 → ~330 | D21/D25/D26 bleiben |
| 13 | lane#24 claude-gate DREI Phasen | gekuerzt | Phasenliste bleibt (wer `MODEL_RE` anfasst, braucht sie), der 30-s-Satz bleibt; Rest Attic §15. | 608 → ~380 | D27/D28 bleiben |
| 14 | lane#18 Flake-Familien | gekuerzt | Die drei Saetze bleiben; die §-Aufzaehlung (§5b, §11, §11.2b–p) und der Klammer-Stand „achtzehn Familien, SHAs, Basisraten" raus — die Tiering-Doc ist ohnehin der einzige Ort. | 804 → ~560 | D21/D22 bleiben (`Freifahrtschein`, `FIX1`) |
| 15 | lane#36 NEVER `bun server.ts` mit Default-Env | gekuerzt | Regel + Rezept bleiben; „likely cause of the historic sessions-vanished incident" und „(passiert 2026-07-19)" raus. | 824 → ~650 | D44 bleibt |

Summe 2b: −4 100.

### 2c. Geschichten → Attic mit §-Verweis, Regel bleibt (Owner-Antwort 3)

| # | Block | Aktion | Grund | Zeichen | Probe |
|---|---|---|---|---|---|
| 16 | lane#17 eigene Commit-Shas | gekuerzt | Regel bleibt (Platzhalter/Branch, MAIN setzt Shas ein, `git merge-base --is-ancestor`); der §11.2j-Fall (ee98c8d/2c40368 vs c36c1e9/1db9296) wird **neuer Attic-Abschnitt §16** — er steht heute nirgends im Attic. | 837 → ~380 | keine Zeile |
| 17 | lane#32 Symbolverweise | gekuerzt | Regel bleibt; „(gemessen 96 % Fehlschuss, docs/messungen/video-codebase-klarheit-2026-08-25.md §2.1)" wird ein Klammer-Zeiger ohne Zahl. | 533 → ~400 | keine Zeile |
| 18 | lane#10 drift-curl | gekuerzt | curl auf `${FLEET_SELF_URL:-http://100.64.0.1:8790}`; Semantik (wouldConflict true/null, behind, dirty, MERGE-Probe vs REBASE-Land) bleibt; die Hooks-Land-Geschichte (`2b9a7fe0`, Deploy `83989719`, Spawn-Zeit-Snapshot) auf einen Halbsatz „nur in Panes nach 2026-09-13 gesetzt, darum der Default". „Nie `$FLEET_HOST`" bleibt (ein Satz). | 1 014 → ~620 | D11 bleibt (`wouldConflict`) |
| 19 | lane#11 gate-curl | gekuerzt | dieselbe URL-Form; zwei Budgets, `waitedOut`, `rulebookDrifted` bleiben woertlich. | 766 → ~600 | D12/D13/D14 bleiben |
| 20 | load#2 GENERIERT | bleibt | Die drei Handedits vom 2026-09-04 sind Geschichte, aber der Loader ist mit MAIN geteilt; nicht in S1 anfassen (Main-Churn ohne Lane-Gewinn: 200 Zeichen). | 479 | L-Zeilen unberuehrt |

Summe 2c: −1 150.

### 2d. MAIN-Absaetze aus `self-scheduling` → `einstieg` (Owner-Frage 2, Antwort: kein achtes Fragment)

Die Tuer-Probe trifft ausschliesslich diese Bloecke. Im Lane-Fragment bleibt EIN Rueckweg-Satz
(„Die MAIN-Tueren watch/release/succeed antworten einer Lane 409 — sie stehen im Einstieg des
Voll-Renders"), ohne die Routen auszuschreiben; der Loader verspricht der Lane genau diesen Rueckweg.
Beim Einfuegen in `einstieg` werden die Bloecke auf `./ctl.sh`-Verben verkuerzt, wo das Verb
existiert (`watch lane|merge|audit --idle 0`, `events --ack`); der einstieg-Absatz „Rueckweg als
Mechanismus" nimmt den watch-Text auf, statt ihn zu verdoppeln.

| # | Block | Aktion | Grund | Zeichen | Probe |
|---|---|---|---|---|---|
| 21 | self#2 „Was jede Session als Self-Prinzipal hat" | gekuerzt + umgeschrieben | Lane behaelt `POST /api/self/autos` und `GET /api/self` (armed UND abgelaufene Watches — fuer eine Lane irrelevant, raus); watch/succeed/retire werden nicht genannt. | 741 → ~300 | F1 bleibt (`FLEET_SELF_TOKEN`, in self#0) |
| 22 | self#3 release-Tuer | verschoben nach einstieg | Tuer einer gebundenen Program-MAIN; Lane bekommt 409. | 881 → 0 (einstieg +~600) | keine Zeile |
| 23 | self#4+#6 Nicht-Lane-only-Absatz | verschoben nach einstieg | 409-Scope-Liste der MAIN-Tueren; fuer die Lane bleibt der Rueckweg-Satz oben. | 1 064 → ~180 (einstieg +~800) | **F3 → einstieg**, **F4 → einstieg** (Muster `lane may not subscribe` · `409` · `stehende Rolle` stehen dann dort) |
| 24 | self#5 Lane-only-Liste | gekuerzt | bleibt (das sind IHRE Tueren); die Gegenprobe `rg -n "not a lane\|a lane may not\|…"` wird zu `rg -n "not a lane" server.ts` — sonst trifft die Tuer-Probe die Gegenprobe selbst. | 389 → ~330 | F2 bleibt (`verify-intent`) |
| 25 | self#12 watch-Absatz | verschoben nach einstieg, dort auf ctl-Verben verkuerzt | Route antwortet einer Lane 409; der einstieg-Rueckweg-Absatz nennt sie schon. | 1 151 → 0 (einstieg +~500) | **F7 → einstieg** (`nie auf sie allein landen`) |
| 26 | self#13 idleSec:0 + Event-Quittung (Controller-Messung 2026-09-07) | verschoben nach einstieg, gekuerzt | Controller-/MAIN-Regel; `./ctl.sh watch` setzt idleSec 0 und `events --ack` quittiert — die Zeile „bis ctl.sh das tut, von Hand" ist ueberholt (verifiziert an `./ctl.sh` 18:3x). Messung → Attic §1-Nachtrag. | 1 234 → 0 (einstieg +~450) | keine Zeile |
| 27 | self#14–#17 succeed-Schiene | verschoben nach einstieg | Nachfolge ist MAIN-/Supervisor-Sache; eine Lane landet statt zu migrieren (409). | 1 472 → 0 (einstieg +~1 200) | **F8 → einstieg** (`jünger als diese Session`) |
| 28 | self#7–#11 autos + Disziplin | bleibt | Das ist der Self-Prinzipal-Kern einer Lane. | 1 016 | F5/F6 bleiben |
| 29 | self#0, self#1 Env-Vars + Token-Hygiene | bleibt | Beide gelten in jeder Pane; Token-Hygiene ist die teuerste Lehre des Fleets (zwoelf Tokens im Kontext). | 1 647 | F1 bleibt |

Summe 2d: Lane −6 300; einstieg +~3 550 (Main-Render waechst netto um ~1 500, weil derselbe Text
heute doppelt — in einstieg als Rueckweg-Absatz und in self-scheduling — steht und beim Umzug
zusammengezogen wird).

### 2e. Ein Block, der eine Lane NICHT betrifft, aber in lane-discipline steht

| # | Block | Aktion | Grund | Zeichen | Probe |
|---|---|---|---|---|---|
| 30 | lane#33 Doc-Kollision Lane↔Haupt-Checkout | verschoben nach einstieg | Beide Handlungen (vor dem Landen reconcilen; main-seitige Analyse committen, BEVOR man spawnt) sind Handlungen der MAIN — eine Lane kann keine davon ausfuehren. | 399 → 0 | **D40 → einstieg** (`committen, bevor`), nach dem Muster von D36/D41 (Schnitt C) |

### 2f. Bleibt unveraendert (zur Vollstaendigkeit; kein Schnitt)

loader (alle 8 Bloecke) · lane#0 Ueberschrift · lane#4 review-sweep · lane#9 landbar · lane#12
CLARIFY-Lane · lane#13 Report-Slice · lane#22 woertlich zitieren · lane#26 CLAUDE.md nur kopiert ·
lane#27 Claims · lane#28 rg -uu · lane#29 Commit-Bodies · lane#30 `git show main:` · lane#31
Wissenspflege · lane#34 Demo · lane#35 Client-Bundles · lane#38 shared reality. Zusammen 8 330
Zeichen — das ist der Rest, den die Lane wirklich braucht.

## 3. Rechnung und Restunsicherheit

| Fragment | heute | nach S1 (gerechnet) |
|---|---|---|
| loader | 3 231 | 3 231 |
| lane-discipline | 23 488 | ~12 640 |
| self-scheduling | 9 612 | ~3 290 |
| **Lane-Render** | **36 763** | **~19 200** |

Die „nachher"-Zahlen sind Entwurfssaetze, keine Messung — die Messung ist der Render nach dem OK,
und das Done-Kriterium (< 20 000) wird am Render geprueft, nicht an dieser Tabelle. Spielraum ~800
Zeichen: reicht er nicht, faellt als Naechstes lane#34 (Demo, 474) auf einen Satz.

## 4. Was NEBEN den Fragmenten angefasst wird (getrackt ⇒ Commits)

1. `docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md`: Fragment-Spalte fuer F3, F4, F7, F8, D40
   → `einstieg`; Zeile D4 raus; neuer Prosa-Absatz „Schnitt S1 (2026-09-14)" nach dem Muster von
   Schnitt C, der die fuenf Umzuege und die eine Streichung mit Grund nennt (der Pin verlangt die id
   im Prosa-Teil).
2. `docs/attic/regelbuch-messgeschichten-2026-08.md`: §16 (eigene Shas nach Rebase-Land, der
   §11.2j-Fall), §9-Nachtrag (Stau-Zahlen 2026-09-06), §1-Nachtrag (idleSec-Messung 2026-09-07).
3. `docs/astra-briefbaustein-2026-09-07.md`: R3 („HANDOFF ist die Bedingung deiner Nachfolge",
   Zeilen 151–176) durch einen Verweis auf die Nachfolge-Schiene ersetzen (`server.ts#migrateRailOf`
   / `handleSelfSucceed`: eine exakt gebundene Program-MAIN braucht keinen HANDOFF-Commit; Legacy und
   Supervisor weiterhin); den `/api/self/notes`-Satz (Zeile 271) streichen — DONE-Teil von `f4c2033d`.
4. Danach: Render-Einzeiler, `bun e2e/pins.ts` (muss ALL PASS zeigen), die drei Proben erneut.

## 5. Drei Punkte, die das OK abdecken muss

1. **D4 wird aus der Bedeutungsprobe gestrichen** (die Verify-Kette steht dann nur noch in
   `AGENTS.md`, gehalten von `RULE_VERIFY`). Alternative: Kette im Regelbuch lassen (+1 000 Zeichen).
2. **Fuenf Zeilen wandern nach `einstieg`** (F3, F4, F7, F8, D40). Der Main-Render waechst dadurch
   nicht, er ordnet um.
3. **Der Rueckweg-Satz im Lane-Fragment nennt die MAIN-Tueren beim Namen** (watch/release/succeed),
   ohne Routenform — damit die Tuer-Probe 0 zeigt, ohne dass die Lane sie fuer nicht existent haelt.
