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

## 5b. Suiten, RAM, Handoff-Rauschen — Owner 2026-09-13 „alles angehen"

Gemessen (Slot 5): volle Suite ~39 min (2 311–2 350 s, ~4 400 Checks), 69 % davon Luecken ≥ 3 s;
Second-host bei 3 Suiten 91–94 % CPU-frei, ~270 MB je Suite; Land-Gate haelt den Mutex schon ueber
die ganze Kette (`holdSuiteLock` im `gateRun`), Gate-Warten 3 d p50 0 / p90 275 s.

| Zeile / Akt | Was | Modell | Reihenfolge |
|---|---|---|---|
| Second-host `maxParallelSuites` 3 → 4 | Config geaendert 19:28, Backup `config.json.bak-20260913-suites3`; greift erst nach Daemon-Neustart — ein Hintergrund-Waechter startet neu, sobald `running` 0 ist (sonst beim naechsten `daemon-update`). Nach einem Tag messen, dann 5 | — | laeuft |
| `1fc3a5c8` | Suite schneller 1/2: lange Test-Wartezeiten kuerzen (500 s in 36 Checks, 227 s in e2e/programs.ts) | Opus 5 | nach `f6903d1e` |
| `d7b4b47d` | Suite schneller 2/2: Sharding-Probe `--shard k/n`, Abhaengigkeitskarte | Fable 5.1 (Owner-Wunsch) | nach `1fc3a5c8` |
| `1a5c49fb` | RAM der Slots/Sessions: messen, zerlegen, Rangliste (Baseline: Mac Swap 2,66 GB, ~33 Playwright-MCP-Prozesse fuer 7 Claude-Sessions) | Astra, medium | als naechste Mess-Lane frei |
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

## 6. Unter der Schnittlinie — bewusst spaeter

- `e04d15f0` Init je Repo — Karte ungueltig (`.fleet/init.md` steht unter FLAECHE statt NEU); nach Welle 3 neu lesen lassen oder mit NEU neu filen.
- `146c06f0` Inbox-Nudge — Slot 9 entscheidet den Zeitpunkt.
- `ee47b0f8` (Lebenszyklus S5b, ohne Fertig-Kriterium/Pruefweg) und `f3ca2e05` (erst klaeren) — brauchen menschliches Anreichern, starten nie von selbst.
- e2e-Test-Paket — erst nach K1.
- Private-repo-j `262a8f71` — ganz zuletzt.

## 7. Was dieser Plan nicht behauptet

- Die Token-Zerlegung des Start-Kontexts war abgeleitet; `cc8f31bd` hat sie gemessen (§5, Stand), meine fruehere 11-k-Schaetzung fuer den Render war zu niedrig (gemessen 18 335).
- Ob Code-Ausschnitte das Einlesen wirklich senken, ist ungemessen — K1 entscheidet.
- Ob eine graphify-Antwort auf die richtige Datei zeigte, ist ungemessen; rg/Read nach einer Query ist gewollter Ablauf, kein Gegenbeleg.
- Fremd-Harness-Lanes (codex/pi) sind in den Einlese-Zahlen nicht enthalten.
