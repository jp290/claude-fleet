# Buendelungs-Kette live — unabhaengige GLM-Kontrolle

- Datum: 2026-09-13, Messfenster 11:45–11:58 Uhr
- Live-main bei Messung: `286349c7` (Behauptung war `0c2cd734` — zwischenzeitlich durch einen zweiten Owner-Deploy abgeloest, s. C1)
- Modell: glm-5.3 (pi-zai, high) · Kontroll-Lane `fleet-260913095026-db29`, read-only
- Gegenstand: Karten-Tick → Kartenvalidierung → confirm-cards → Land-Wellen, alles auf Live-Dateien des Haupt-Checkouts (deploys/cards/audit/fleet.json nur als Projektion gelesen)

## Gesamturteil

Die Kette laeuft auf dem Live-Host und misst, was Code und Doku sagen: der Tick arbeitet unter dem laufenden Server (71. Kartenzeile entstand 2 min nach Anlage der neuesten Queue-Zeile), es gibt genau zwei Mehrzeilen-Wellen, ausschliesslich aus bestaetigten Flaechen desselben Programs, und alle Suite-Wrapper stellen den Tick still. Ein formaler FAIL bleibt: die bestaetigte Zeile `66df05b4` traegt keine gueltige Karte (einzige Luecke `rolle.model "Opus 5"`), weil `confirmCardsForMain` nur `surfaceValid` prueft — die Kontrollregel ist strenger als der Code. Das eigentliche Live-Limit ist die Reichweite: nur 5 von 40 offenen Zeilen haben eine bestaetigte Flaeche; 10 koennen strukturell nie eine gueltige Karte erhalten (Lieferdatei existiert noch nicht), 8 haben kein Program und buendeln daher nie.

## C1 — Deploy + Tick live: PASS

- `tail -2 deploys.jsonl`: `{"id":"f79c3689","stage":"boot","ok":true,"hitTarget":true,"target":"0c2cd734…","at":1789284890966}` (= 09:34:50) — die Behauptung stimmt fuer diese Zeile. Die LETZTE Zeile ist aber inzwischen `{"id":"a6e521bd",…,"target":"286349c7…","ok":true,"hitTarget":true,"bundleStale":false}` (11:08:10) = live HEAD; der Owner hat den Karten-Fix `286349c7` nachgeschoben. Kein Widerspruch zur Kette, aber die Brief-Angabe „letzte Zeile f79c3689" war zur Messzeit schon falsch.
- `cards.jsonl`: 71 Zeilen (waehrend der Kontrolle von 70 auf 71 gewachsen), alle `at` > 1789284890966. Stand am Ende: 13 valid / 58 invalid, Modell durchgehend `claude-haiku-4-5-20251001`, ms-Median 69072 (n=71).
- Tick live bewiesen: erste Karte 09:36:32 (= Boot + 102 s, passend zu 60-s-Tick); letzte Zeile `{"at":1789293231066,"taskId":"20fb7151",…}` = 11:53:51, die Queue-Zeile `20fb7151` wurde 11:51:46 angelegt — der Sweep liest unter dem JETZT laufenden Server.

## C2 — Kartentreue (6 gueltige Karten, 2 Programs): PASS

Stichprobe: `7ed73694`, `e3e5084a`, `1e1dcd50` (Program f170dc46) · `a05fa7ff`, `9940ec64`, `67abe12c` (Program f9dc8e10).

- (a) Datei-Treue: 13/13 surface.files in `git -C /Users/owner/claude-fleet ls-files` (Zaehlung 13, erwartete 13). Keine erfundene Datei.
- (b) Ziel/Done-Deckung durch den Zeilentext, Belegstellen:
  - `7ed73694` ziel: „…rendert die Program-Status-Projektion aus Schnitt 2 mit Feldern vom Owner-Poll" ↔ Rowtext: „die bestehende Program-Detailflaeche … rendert die Program-Status-Projektion aus Schnitt 2 — … liest genau die Felder, die S2 … in den Owner-Poll (`GET /api/sessions`) … gelegt hat". done (build/tsc/Mutations-e2e/`~/claude-fleet-demo typecheck`) steht genauso im Rowtext-DONE.
  - `1e1dcd50` done: „H1 or H2 determined … smallest product fix …" ↔ Rowtext: „DONE: H1/H2 am echten isolierten Adapter getrennt … Daraus EINEN kleinsten Produktfix mit Dateien/Symbolen/Test vorschlagen".
  - `e3e5084a` done: „records survive reboot, … byte-equal" ↔ Rowtext: „(7) Nach Boot ist der Record le[bar]" bzw. „(6) … byte-gleicher Record wie heute (Regressionscheck…)"; `intent`-Feld ↔ „gedeckeltes Prosafeld `intent`".
  - `a05fa7ff` ziel ist wortmaessig der AUFTRAG-Satz („Critic-Liveness/Supersession in server.ts, server/types.ts und e2e/tasks.ts implementieren…"); done wortgleich aus DONE.
  - `9940ec64` ziel ↔ „program-phase.ts#phaseOf … OWNER_GATE ergibt; e2e/programs.ts ergaenzt den Nachweis".
  - `67abe12c` ziel ↔ „FLEET_E2E_MODULES-Modulfilter in fleet-e2e.ts mit transitivem Fixture-Schluss und begruendeten skipped-Trailzeilen implementieren".
- (c) verify je benannte Kette oder Route: `e3e5084a` nennt die vollstaendige Kette (install→pins→tsc→build→clean-review→security→claude-gate) + `./e2e-isolated.sh`; `67abe12c` „FLEET_E2E_MODULES=slots,tasks …; GET /api/self/gate; ./e2e-isolated.sh"; `a05fa7ff` „GET /api/self/gate … ./e2e-isolated.sh … ALL-PASS-Tails". Randnotiz: `7ed73694` verify nennt „betroffene e2e-Suite-Datei" unscharf, aber pins/tsc/build sind konkrete Schritte — keine FAIL-wuerdige Abweichung.

## C3 — Ungueltige Karten: PASS

58 invalid-Zeilen; Lueckenstatistik und Stichproben sind regelgegruendet, keine erfundene Gueltigkeit, kein grundloses invalid:

- `20fb7151` (11:53): gaps `rolle.model: "Opus 5" is not a registered model`, `surface.files: ".claude/settings.json" is not tracked`, `surface.files: "e2e/<familie>.ts" is not tracked` — der Rowtext enthaelt tatsaechlich einen Platzhalter-Pfad und einen Kurznamen; alle drei Luecken sind wahr.
- `ee47b0f8`: Rowtext ist ein Verweis-Brief („Dein Brief ist der Abschnitt §8-b … in docs/program-lebenszyklus-architektur-2026-09-04.md") ohne eigene DONE/VERIFY-Karte → gaps `done: no checkable sentence`, `verify: no command named`, `rolle.harness: "Codex" is not a registered harness` — wahr.
- `02131402`: Lauf 1 (09:39) verweigert `server.ts#helperClaim`; Lauf 2 (11:09, validatorVersion 2, nach dem Fix `286349c7` „Kurzform-Kette") akzeptiert denselben Symbolnamen und ist valid — der Wiederlese-Mechanismus fuer alte Validator-Versionen wirkt exakt wie gebaut (genau ein Nachlesen, dann Ruhe).
- Nicht jede der 58 Zeilen wurde einzeln gegen ihren Rowtext gelesen (Stichprobe + Lueckenstatistik); ein Gegenbeispiel (valid:true mit erfundener Datei / valid:false ohne Luecke) wurde nicht gefunden.

## C4 — Bestaetigung: FAIL (nach der Brief-Regel)

Genau EINE `task_cards_confirm`-Zeile in audit.jsonl, ts 1789292991761 (11:49:51), slot 4, program f170dc46, ids `7ed73694,66df05b4,1e1dcd50,e3e5084a,1b47e29a` (n=5).

- Alle 5: `files == card.surface.files` und `filesOrigin == "confirmed"` (Projektion aus fleet.json). Erster Teil der Regel haelt.
- 4/5 tragen gueltige Karten. `66df05b4` nicht: `card.valid=false`, einzige Luecke `rolle.model: "Opus 5" is not a registered model`; `surfaceValid=true`; alle 4 Flaechendateien sind tracked. `confirmCardsForMain` (server.ts:8761) prueft nur `surfaceValid` bzw. gaps mit Praefix `surface.` — eine nur-flaechengueltige Karte ist bestaetigbar, das ist Code-Design (die Bestaetigung betrifft die Flaeche, nicht die Rolle). Die Kontrollregel „bestaetigte Zeile ohne gueltige Karte ist FAIL" ist dagegen verletzt.
- Einordnung: der Maengel liegt in der ROLLE-Dimension des Rowtexts („Opus 5" ist kein registriertes Modellkuerzel), nicht in der bestaetigten Flaeche. Ob das ein Ketten-Defekt oder eine zu strenge Kontrollregel ist, ist Owner-Entscheid; gemessen ist: Code prueft `surfaceValid`, Brief verlangt `valid`.

## C5 — Wellen: PASS (mit zwei Praezisierungen)

`bun task-land-waves.ts --state /Users/owner/claude-fleet/fleet.json --default-repo /Users/owner/claude-fleet > /tmp/glm-waves.json` — exit 0; `grep -c token /tmp/glm-waves.json` = 0 (vor dem Lesen geprueft). budget 5, 2 Repos, unresolved [].

Zwei Mehrzeilen-Wellen, beide Program f170dc46, Repo claude-fleet:

- W1 `[7ed73694, 1b47e29a]`, shared `src/client.ts`, units 3 (mittel 2 + klein 1) ≤ 5, 2 Zeilen ≤ 6, keine Gate-Maschinerie. Naehe: `1b47e29a` hat KEINE Ranges → `collidesOn`-Fallback verbindet auf Datei-Ebene (konservativ, im Modul dokumentiert); die ≤40-Zeilen-Regel allein haette nicht verbunden.
- W2 `[66df05b4, e3e5084a]`, shared `server.ts` + `server/types.ts`, units 4. Praezisierung: die server.ts-Ranges liegen weit auseinander (3000–3300 vs 5853–6005 und 18671–18774, Abstand ≫ 40) — verbunden wird ueber `server/types.ts`, fuer das BEIDE Seiten keine Ranges haben (derselbe Fallback). `sharedFiles` nennt auch `server.ts`, weil es „von ≥2 Zeilen getragen" heisst, nicht „verbindend". Regelkonform nach Code; die Brief-Paraphrase der Regel gilt nur fuer Seiten MIT Ranges.
- (d) keine gate-aenderer-Zeile in einer Welle. `e3e5084a` nennt `e2e/programs.ts`, `e2e/self-token.ts`, `e2e/supervisor.ts` — Check-Module, die per `GATE_MACHINERY_FILES`/Globs (`e2e-*.sh`, `fleet-e2e*.ts`) absichtlich NICHT Gate-Maschinerie sind (Entscheidung 2026-09-12, im Modul begruendet: Check-Module sind Passagiere, nicht Apparat).
- Einzelwellen reasonAgainst (claude-fleet): `flaeche-nur-abgeleitet` 20, `kein-program` 7, `keine-flaeche` 3, `null` 1 (`1e1dcd50`: buendelbar, fand keinen Partner — einzige docs-Zeile ihres Programs mit Flaeche). astra-main: 5× `flaeche-nur-abgeleitet`.
- Warum nur 2 Mehrzeilen-Wellen — korrekt, kein Defekt: R3 laesst nur bestaetigte Flaechen zu, und nur 5/40 offene Zeilen sind bestaetigt (alle in f170dc46); davon teilen 4 Dateien, die 5. (docs) hat keinen Partner.

## C6 — Sicherheit: PASS

- (a) `sed -n '10511,10546p' server.ts | rg 'status|dispatch'` → 0 Treffer. `tickCardSweep` schreibt nur `t.card`, `cardRetry`, `appendEvent(CARD_FILE, …)` und `saveState()` — kein status, kein dispatch (server.ts:10511–10545).
- (b) Server-Startzeilen mit FLEET_CARD_MS=0: `e2e-clean-review.sh` 2/2, `e2e-claude-gate.sh` 3/3, `e2e-postland-audit.sh` 2/2, `e2e-security.sh` 1/1, `e2e-isolated.sh` 1/1 (rg-Beleg, je Boot-Zeile). `e2e-stage.sh` enthaelt kein FLEET_CARD_MS und bootet keinen Server (`rg 'exec bun|bun server' e2e-stage.sh` → exit 1) — es ist die geteilte Lock-/Stage-Bibliothek, kein Wrapper mit Server.
- (c) `watchdog.sh`: 0 FLEET_CARD_MS-Treffer — der Owner-Schalter lebt nur in .env, wie behauptet.

## C7 — Was fehlt: drei Stellen, an denen die Kette still versagen kann

1. Zeilen, die nie eine gueltige Karte bekommen koennen: `validateCard` verlangt surface.files ⊆ trackedPaths des JETZIGEN Baums (card-extract.ts#validateCard, Kontext aus server.ts#cardValidationContext). Eine Zeile, deren Lieferung eine NEUE Datei ist (GAME-CARD.md, VISUAL_DIRECTION.md, docs/messungen/2026-09-13-*.md), ist vor der Arbeit nie surfaceValid → nie bestaetigbar → nie buendelbar. Live: 10/40 offene Zeilen mit „is not tracked"-Luecke.
2. Invalid ohne Wiederlesen: `cardDue` (server.ts#cardDue) liest nur bei validatorVersion-Rueckstand oder bewegtem `brief.at` erneut; `CARD_MAX_ATTEMPTS=3` zaehlt nur Transportfehler, nicht inhaltliche Luecken. Live: 27 Zeilen tragen invalid-v2-Karten, davon 9 surfaceValid (durch die MAIN bestaetigbar), 18 nicht — ohne Validator-Bump oder Textaenderung bleiben sie fuer immer „flaeche-nur-abgeleitet".
3. Programmlose Zeilen: task-land-waves.ts#classify stuft `kein-program`; 8/40 offene Zeilen haben kein programId (5 davon sogar gueltige Karten) und koennen nie buendeln, egal was bestaetigt wird.
- Randbeobachtung: der Sweep bedient pro Tick nur EIN Repo (`due[0]` entscheidet, batch ≤ 4, server.ts#tickCardSweep) — bei 2 Live-Repos Verzoegerung, kein Stillstand.

## Nicht geprueft

- .env-Inhalt (verboten): FLEET_CARD_MS='60000' nur indirekt belegt (erster Tick ≈ 102 s nach Boot; Karte 2 min nach Row-Anlage).
- ps/Prozesstabelle (verboten); Owner-Routen (verboten).
- Ob Slot 4 wirklich die gebundene Program-MAIN-Session war: audit.jsonl nennt slot 4 + program f170dc46; die Session-Identitaet wurde nicht verifiziert.
- Symbol-Graph (graphify-out) nur indirekt ueber die task-metadata-Ranges gesehen.
- Die 58 invalid-Zeilen nicht einzeln gegen ihre Rowtexte gelesen (Stichproben + Lueckenstatistik).
- confirm-cards-Idempotenz/Reboot-Verhalten nur am Code gelesen („already carries a confirmed surface"-Skip), nicht live provoziert.
