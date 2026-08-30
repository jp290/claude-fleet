---
frage: Warum blieb der Private-repo-o-Ertrag hinter dem Aufwand zurück (Owner-Urteil nach eigenem Spielen, 2026-08-30), und welche Workflow-Änderungen folgen daraus?
urteil: Drei Wurzeln, keine davon „schwaches Bauen" — (1) der einzige echte Produktdefekt (Lenkung am Bildschirm gespiegelt, an Code und Build verifiziert) gehört zur Defektklasse, die Selbst-Spiel strukturell nicht sehen kann, und der vorgesehene fremde Blick lief nie; (2) ~10h10m von 19h41m Wanduhr (52 %) waren Tür- und Timer-Wartezeit, nicht Arbeit; (3) Verify und Tier-2-Audit hingen am Fleet-Schlüssel — 4 unverifizierte Lands, 11/11 Audits konstruktionsbedingt unknown, eine Fehldiagnose. Sieben Vorschläge, drei davon reiner Regeltext.
bereich: [game-maker, verify, product, lane-lifecycle]
belege: [docs/messungen/2026-08-30-game-maker-instrument-audit-glm.md, docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md, private-repo-o HANDOFF.md#Current-game-checkpoint]
nicht-gemessen: Pane-Transcripts der zwölf Lanes; die pi-zai-Reviewer-Kosten (Adapter liefert keine Sensorik); ob Wartezeit im Nacht-Stall 23:12–02:52 Arbeit oder Warten war (nicht trennbar, Task-Filing-Zeitpunkte stehen in keinem Ledger).
stand: 2026-08-30
---

# Workflow-Audit Game-Maker, Fall Private-repo-o — Synthese (2026-08-30)

Anlass: Der Owner spielte den Build `db6ed75` (identisch mit dem servierten `0f86bc5`, Diff ist
7 Zeilen HANDOFF.md) und urteilte: Lenkung links/rechts vertauscht, Fahrphysik unsauber, Grafik
flach, „bei dem Aufwand wäre mehr drin gewesen". Drei unabhängige Stränge haben das geprüft:
eine Produkt-Forensik am Build (Vorzeichenkette + Playwright + Sim-Messskript), eine
Prozess-Forensik über git und die drei Ledger, und eine Instrumenten-Kritik durch GLM-5.3
(`2026-08-30-game-maker-instrument-audit-glm.md`, gelandet `dbb2e09`). Die Fleet-Server-Mechanik
steht bereits in `2026-08-29-main-lane-lifecycle-gaps.md` (8 Befunde) und wird hier nur
referenziert.

## Was der Lauf geleistet hat (die Vergleichsbasis, bevor kritisiert wird)

19h41m Wanduhr (29.08. 12:39:50 → 30.08. 08:21:03) von Intake-only-Seed zu einem integrierten,
fahrbaren Spiel. 12 Lanes gespawnt, 11 gelandet, 1 killed-dirty (Architect, Draft als Tag
gepinnt). Alle 13 Feature-/Fix-Commits kamen aus Lanes; die MAIN committete direkt nur 14×
docs + 1× chore — die Regel „MAIN baut nie selbst" hielt. Der Preflight lief exakt nach
AGENTS.md: Opus-Architect → pi-zai-Reviewer (Cross-Modellfamilie, harness-bezeugt) →
MAIN-ACCEPT → byte-identisch gelandete Card. Die MAIN fing eine falsche Berichtszeile des
R6-Workers durch bitgleiche Gegenmessung selbst und führte Audio/Critic/Taste ehrlich als
unknown. Das ist die Disziplin-Seite; sie ist nicht das Problem.

## Wurzel 1 — Wahrnehmungs-Monopol: ein Augenpaar, und es war das falsche

**Die Lenkung ist objektiv gespiegelt.** Vorzeichenkette vollständig verifiziert
(Produkt-Forensik): `src/input/index.ts:10,111,116` (ArrowRight → steer +1) →
`src/sim/kart.ts:220` (+28° Lenkwinkel) → `:236,:270-274` (positives Giermoment) → Heading
`(sin yaw, cos yaw)` (`:158-159,:284-285`) → Identitätsabbildung in den Renderer
(`src/render/index.ts:293-298`) — unter three.js' rechtshändigem System dreht positives yaw das
Kart auf dem Bildschirm nach LINKS. Am Build bestätigt: 800 ms ArrowRight, yaw −2,1° → +29,2°,
Screenshots zeigen Linksdrehung. Das Repo ist in sich konsistent falsch: `src/sim/track.ts:16-18`
nennt die Links-Kurve „weite Rechte". Der Vertrag `GAME-CARD.md:603` („-1 links .. +1 rechts")
wird verletzt, und keine Zeile im Repo prüft ihn.

**Warum es niemand sah, in einer Kette:** Die normative Richtungszeile hat keinen Prüfer → alle
Tests messen Beträge oder Sim-Koordinaten, nie Bildschirmrichtung (`src/input/index.test.ts:23-42`
pinnt nur Taste→Wert; T13 bindet Renderer↔Sim über IDs und Yaw-WERTE) → die MAIN spielt
feedback-geregelt und adaptiert ans Mapping — ihre volle 42,48-s-Runde ist unter beiden Mappings
fahrbar → der sensory Critic, der einzige Akteur mit fremden Priors, lief NIE („Critic: keiner",
HANDOFF:8) → auch der Owner spielte während des gesamten Laufs nicht (Taste-Gate-Attention 03:59:
„DU hast es noch nicht gespielt"). 19h41m Produktentwicklung, jedes Produkturteil aus dem
Augenpaar der bauenden MAIN. Der Owner war der erste fremde Spieler, und er fand den Defekt in
Minuten.

**Zwei Folgeschäden desselben Monopols:** (a) „Fahrphysik unsauber" ist als Defekt nicht
reproduzierbar — die Sim ist gemessen sauber (Oszillation auf Gerade 0,000 m/s; Rücklauf nach
Loslassen 0,28 s, 0 Nulldurchgänge; einziger Tuning-Punkt: 34 % Turn-in-Überschwingen bei Nia).
Die plausibelste Quelle des Eindrucks ist die gespiegelte Lenkung selbst: jede menschliche
Mikrokorrektur geht erst in die falsche Richtung [abgeleitet]. Ein maskierter Defekt hat also ein
zweites, falsches Owner-Urteil erzeugt. (b) Normalisierung: die MAIN erzählte den von 1,4 s auf
3,0 s abgedrifteten Auslauf (Card-Vorgabe: 1,5 s) im Checkpoint als Belohnung — wiederholtes
Selbst-Spielen rekalibriert den Spielenden auf den Defekt (GLM-Notiz, Lücke 1).

**Grafik „flach" ist dagegen überwiegend Vertragsstand:** Toon-Rampe, Blob-Schatten, bewusst
keine Texturen sind in GAME-CARD §3 (Z. 206-216) genau so versprochen und implementiert. Eine
konkrete Lücke: die versprochene „harte Kantenlinie" (`GAME-CARD.md:209`) existiert im Renderer
nicht (Grep über `src/render/**` nach Edges/outline: nur Kommentare, die die Zusage umdeuten).

## Wurzel 2 — 52 % der Wanduhr waren Türen und Timer

Prozess-Forensik, kritischer Pfad: ~10h10m von 19h41m ist Wartezeit. Zerlegung: 3h35m
Owner-Land-Wartezeit vor der Promotion (Card 1h37m, B1 1h40m, B2/B3 0h18m — die MAIN hatte keine
eigene Land-Tür, `selfLand:"guarded"` wurde erst 19:40:58 bestätigt), 0h12m Übergabe-Zuruf,
3h40m Nacht-Stall (23:12 → 02:52, Ende durch Owner-Hand-Dispatch mitten in den Quiet Hours;
Anteil eigener Arbeit nicht trennbar), 2h55m reine Quiet-Hours-Wartezeit (04:04 → 07:00; R5
spawnte 4 s nach Quiet-Hours-Ende, `releasedBy:"machine"`). Die Gegenprobe liefert der Lauf
selbst: nach der Promotion landete die MAIN 8 Lands mit 0 Minuten Owner-Wartezeit; R1 brauchte
von Spawn bis Land 22 Minuten.

Dazu vier Attention-Rufe für Fleet-Mechanik gegen einen für Produkt — der Lauf war zur Hälfte
eine Fleet-Debugging-Session: parallel landeten ≥6 Fleet-Lanes (u. a. der
Worktree-Verify-Fix `54445c6` und der Owner-Land-Event-Fix `8b1cc95`) plus 5 Deploys.
Erstlings-Kosten, die beim zweiten Lauf nicht wieder anfallen — aber nur, wenn die Befunde
gelandet und promotet sind (Lifecycle-Notiz, Befunde 1/2/6/7).

## Wurzel 3 — Verify und Audit hingen am Fleet-Schlüssel

Card und B1–B3 landeten `verified:null`: `FLEET_VERIFY_CMD_REPOS` kannte nur
`/Users/owner/private-repo-o`, nicht den linked Worktree des frischen Laufs. Der Fix war
Server-Code (`54445c6`, linked worktree schlägt seinen Haupt-Toplevel nach, deployt 21:06) — ab
B4 trugen alle 8 Lands `verified:true`. Für den Land-Gate ist die Lücke damit zu.

Der Tier-2-Post-Land-Audit dagegen ist für JEDES Nicht-Fleet-Repo konstruktionsbedingt wertlos:
das Audit-Kommando ist der Fleet-Guard (`[ -f fleet-e2e.ts ] || … exit 42`), also endeten 11 von
11 Audits dieses Worktrees `unknown` (post-land-audits.jsonl:349–366; plus 7 gleichartige im
alten Repo am 27.08.). Die MAIN las das als „reproduzierbaren Fleet-Defekt (2 von 2)" — die
Fehldiagnose kostete zwei Doku-Commits, einen Attention-Punkt und die Kompensation, `bun run
verify` an jedem gelandeten Stand von Hand nachzufahren. Ein Instrument, das für ein Repo nie
zuständig sein kann, muss dort not-applicable stempeln, nicht unknown.

## Änderungsvorschläge (propose — promotet nichts; gerankt nach Ertrag je Aufwand)

| # | Vorschlag | Aufwand | Deckt |
|---|---|---|---|
| V1 | **Konventions-Pin als Pflicht-Breaker jeder GAME-CARD**: headless-Test „steer=+1 ⇒ Bildschirm-x-Delta des Karts > 0" (die NDC-Maschinerie existiert in `render.test.ts:491-495,580-590` bereits) — als stehende Zeile ins Game-Maker-Profil, sofort als Test für Private-repo-o | ~1 h je Spiel | Wurzel 1, hätte den Lenk-Bug am ersten Tag gefangen |
| V2 | **Critic-Verdikt als Vorbedingung der Taste-Attention** (Regeltext im Profil/AGENTS-Template: eine Owner-Taste-Attention ohne `Critic:`-Verdict darf nicht gefilet werden) und **Critic nach dem ersten PLAYABLE**, nicht nach allen Repair-Runden | Regeltext, 0 h | Wurzel 1 — der fremde Blick kommt, bevor Reparaturen auf ein einziges Augenpaar optimieren |
| V3 | **unknown-Resolver-Pflicht im Checkpoint**: jede unknown-Zeile benennt Instrument und Trigger; unknown ohne Resolver blockiert `Next: hold` | Regeltext, ~1 h | Wurzel 1 — unknown wird Warteschlange statt Endzustand |
| V4 | **`selfLand:"guarded"` als Founding-Default eines game-maker-Programs** (Owner-Entscheid; heute Promotion erst mid-run) | Owner-Entscheid + kleine Route | Wurzel 2 — 3h35m des gemessenen Wartens |
| V5 | **Quiet-Hours-Ausnahme für maschinell freigegebene Tasks einer gebundenen, lebenden Program-MAIN** (Owner-Entscheid — Quiet Hours existieren mit Grund; die Ausnahme wäre eng: nur `releasedBy:"machine"`, nur aktives Program) | Owner-Entscheid + Tick-Bedingung | Wurzel 2 — 2h55m + Löwenanteil des Nacht-Stalls |
| V6 | **Audit-Zuständigkeit je Repo**: Nicht-Fleet-Repos stempeln `not-applicable` statt `unknown` (oder bekommen ein per-Repo-Audit-Kommando analog `FLEET_VERIFY_CMD_REPOS`) | ~2–4 h | Wurzel 3 — beendet die Fehldiagnose-Klasse |
| V7 | **Card-Schnitt + erzeugte Verify-Zeilen + Fakt/Urteil-Checkpoint** (GLM-Lücken 4/5/6: 1 Seite Versprechen + Breaker-Manifest statt 1254 Zeilen mit ~170 Zeilen eingebettetem Code; Berichts-Zahlen nur als Kopie werkzeuggeschriebener Zeilen; Checkpoint-Anker maschinenlesbar) | ~6–9 h | Vertragsrot, Berichtslügen-Klasse |

Nicht aufgenommen: ein Frame-Time-Instrument (GLM-Lücke 7) — nach dem Physik-Messergebnis ist
„unsauber" plausibel durch V1 erledigt; erst nachmessen, wenn der Eindruck nach dem Lenk-Fix
bleibt.

## Die Spiel-Fixliste (kein Workflow — wartet auf Owner-Go, Entscheid „Nur Audit zuerst")

1. Lenk-Vorzeichen an der Sim↔Render-Naht fixen + Konventions-Pin (V1) im selben Schnitt; die
   Track-Beschriftungen („weite Rechte") drehen mit, je nach gewählter Naht.
2. Kantenlinie nachrüsten oder die Card-Zeile streichen (Vertrag ehrlich machen).
3. Turn-in-Überschwingen 34 % (Nia) — Tuning, Geschmack, nach dem Lenk-Fix neu erfahren.
4. Danach erst: der ausstehende sensory Critic auf dem gefixten Stand, dann die Owner-Taste
   (Attention `e98c0c91` steht seit 03:59 offen).

## Schnittlinie

Owner-Vorgabe wörtlich: „einen Tiefgreifenden Workflow audit machen … Verschaff dir … einen
Überblick über die Kürzliche Arbeit und dann überleg mit was für Agenten und lanes usw. wir das
nun am besten angehen." Mit diesem Dokument, den drei Strang-Reports und der GLM-Notiz ist das
erfüllt. Alles unter „Änderungsvorschläge" ist propose; kein Vorschlag ist promotet, keine
Fix-Lane gestartet. Das Lifecycle-Program (Fleet-Mechanik, Befunde 1/2/6/7) liegt mit fertigem
Gründungs-Prompt in `2026-08-29-main-lane-lifecycle-gaps.md` und braucht nur Owner-Bestätigung.

## Deckung

**Selbst geprüft (diese Session):** GAME-CARD-Codeblock ab Z. 596 und one-defect-Spez
(`docs/product-studio-working-circle.md:338`) als Stichproben der GLM-Belege; Lenk-Zuordnung
`src/input/index.ts` gelesen; Task-/Program-/Attention-Zustand aus fleet.json;
Landung + Verify der GLM-Notiz (install+pins, Drift clean, Merge-Event quittiert).
**Übernommen aus den Strängen:** alle Datei:Zeile-Belege der Produkt-Forensik (Screenshots und
Messskripte liegen im Session-Scratchpad und sterben mit ihm); alle Ledger-Zahlen der
Prozess-Forensik (Quellenzeilen dort genannt). **Ungelöst:** ob der Nacht-Stall Warten oder
Arbeit war, bleibt unmessbar, solange Task-Filing-Zeitpunkte in keinem Ledger stehen.
