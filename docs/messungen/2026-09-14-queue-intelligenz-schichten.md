---
frage: Welche Intelligenz- und Datenschichten bewerten heute eine Queue-Zeile vor, waehrend und nach der Arbeit — was davon ist live, was schreibt Daten, die niemand liest, und was fehlt, damit Fleet ohne Owner-Urteil zwischen Modellklassen und zwischen Varianten derselben Zeile entscheiden kann?
urteil: Es gibt DREI Schichten und nur die erste urteilt. EINGANG (Karte, Haiku + deterministischer Validator) laeuft live und traegt 44/45 offenen Auftraegen ein DONE — aber 21 der 41 Karten sind ungueltig, und 12 davon am VERTRAG (Prompt kennt kein `creates`/`after`, `rolle` wird nicht normalisiert und hat KEINEN Konsumenten), 5 sind korrekte Ablehnungen, hoechstens 4 waeren mit einem staerkeren Modell besser. ZUSTELLUNG liefert median 13 KB (Quellpaket 7,3 KB = 56 %), aber Modell/Effort/Groesse steuern KEINEN Block, das Receipt haelt das Quellpaket nicht fest, und der Brief-Kompiler hat in 746 Receipts 0-mal geliefert. AUSGANG vergleicht NIRGENDS Ergebnis mit Ziel: `accepted-by-land` heisst „gelandet und Audit nicht rot", `Task.criterion` ist auf 0/200 Zeilen gesetzt, Reports liegen auf keinem Ledger (Retention 20), `review: none` auf 293/294 Outcomes. Ein Qualitaetssignal jenseits „gelandet" steckt schon in den Daten: Zeilen-Nacharbeit ≤3 d (blame gegen base..mainAfter) — 24 % der Opus-Code-Lands, 44 % der codex-Code-Lands. K2/Eval-Gate lieferten nichts, weil sie ohne Zielsatz, ohne Kalibrierung und ohne Nicht-Messungs-Zustand urteilten. Entscheidungen unten (§5) — alle ohne Owner-Stufe, per Owner-Vorgabe 2026-09-14.
bereich: [task-queue, karte, kontext, ctxpacks, ausgang, ledger, modellklassen, varianten, worktrail]
belege: [cards.jsonl (155 Zeilen, 2026-09-13 09:36–2026-09-14 07:17), fleet.json (200 Zeilen, 45 offene auftrag), context-receipts.jsonl (746), streams/prompts.jsonl (17 Lane-Briefs seit 2026-09-13 20:57), lane-outcomes.jsonl (294 Zeilen/14 d), post-land-audits.jsonl (229/14 d), audit.jsonl ab 2026-09-07, card-extract.ts, server.ts#tickCardSweep #cardDue #briefAndSend #tickAcceptByLand #buildLaneOutcome #laneAutoCloseRefusal, context-plan.ts, context-snippets.ts, task-notes.ts, start-plan.ts, task-land-waves.ts, docs/attic/judge-calibration.md, docs/work-register-2026-08-06.md §7, docs/messungen/opus-lane-kontextkosten-2026-09-12.md, docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md]
nicht-gemessen: Tokenkosten der Brief-Bloecke (nur Bytes); Session-Boot-Anteil an den 63 s Kartenlaufzeit; ob pi/codex CLAUDE.md oder AGENTS.md laden (nur Doc-Widerspruch festgestellt); Wirkung des Quellpakets (n=5 ohne Kontrollgruppe — Kohorte benannt, nicht gefahren); Nacharbeits-Proxy `fix…`-Subject ist unvollstaendig (spaetere/anders benannte Korrekturen fehlen); Fremd-Repos aus der Nacharbeits-Probe ausgeschlossen; ob Report-Text ueber die Program-Inbox ueberlebt
stand: 2026-09-14
---

# Die Intelligenz- und Datenschichten der Queue — Karte, Zustellung, Ausgang

Auftrag (Owner 2026-09-14 06:5x–08:0x, woertlich): „Wir muessen diese Mechanismen und Schichten bis
ins Detail verstehen und ans funktionieren kriegen. Haiku sollten wir … mindestens auf sonnet5
wechseln … die richtige Intelligenz einbauen und dann mit wertvollen sauberen datenschichten
versorgen" · „eine wiederkehrende worktrail analyse … solange wir die findings … sinnvoll
verarbeiten" · „die option … ein task … von versch modellen gleichzeitig bearbeiten zu lassen um
sich … fuer die bessere variante entscheiden zu koennen" · **„ich will mich selbst soweit wenn
moeglich komplett rausnehmen"**.

Methode: drei read-only Kartierungen (Eingang / Zustellung / Ausgang) durch Opus-5-Agenten mit
Zeilenbelegen, dazu eigene Ledger-Zaehlungen. [V] = am Code oder Ledger verifiziert, [G] =
geschlossen.

## 1. Eingang — was vor dem Start ueber eine Zeile gewusst wird

| Mechanismus | Symbol | Modell | live? | schreibt | liest es jemand? |
|---|---|---|---|---|---|
| Karte | `server.ts#tickCardSweep`, `card-extract.ts#validateCard` | Haiku 4.5, TEXT_ONLY, 120 s | ja (`.env` `FLEET_CARD_MS=60000`) | `t.card`, `cards.jsonl`, Lift `t.files` | `valid` gated Karten-Kopf, `size` im Land-Fold, Flaeche; `done/verify/gaps` nur `start-plan.ts#releaseVerdict`; **`rolle`, `program`, `ms`, `tokens`: niemand** [V] |
| Brief-Kompiler | `tickBriefSweep` | gpt-5.3-codex-spark | **aus** (`FLEET_BRIEF_MS` nirgends gesetzt) | `t.brief` | 0 von 746 Receipts `briefSource:"compiled"` [V] |
| refine | `POST /api/tasks/:id/refine` | Opus 5 | manuell; 0 Aufrufe seit 09-07 | `t.refine`, Kinder | Board [V] |
| clarify/criterion | `buildClarifyBrief`, `POST /api/self/criterion` | keins | ja | `t.criterion` | 0/200 Zeilen tragen eins; erfuellt die `done`-Luecke von card-valid NICHT [V] |
| Startplan/Wellen | `start-plan.ts#projectStartPlan` | keins | ja | nichts | `tickDispatch`; alle 3 Programs `release: manual` ⇒ harte Karten-Luecken gaten live nichts [V] |
| Land-Fold | `task-land-waves.ts#projectLandWaves` | keins | ja | nichts | `size` ungueltiger Karten geht verloren ⇒ „mittel" [V] |

**Karte, die Zahlen.** 41 offene Zeilen, alle mit Karte; 21 ungueltig (Haiku, Validator v4).
Klassifikation der 21 (einzeln gegen den Text gelesen) [V]:

| Klasse | Karten | Mechanismus |
|---|---|---|
| Prompt kennt `creates`/`after` nicht ⇒ geplante NEUE Datei = „not tracked" | 6 | `card-extract.ts:443-452` |
| `rolle` nicht normalisiert („Codex", „Opus 5", Rollenname vor dem Tripel) | 3 (+2 gemischt) | Validator prueft `MODEL_RE` = Zeichensatz, keine Registry — Meldung „not a registered model" ist falsch |
| Verify-Vokabular („GET /api/self/gate", „heutige Verify-Kette") | 1 (+2) | `validateCard:140-161` |
| Quote-Regel-Varianten der Flaeche | 2 | |
| echte Lesefehler | 3–4 | 0610f3a5, ff88072c, 531bab26, 21ade485 (10,3 KB Quelle, unlesbare Antwort) |
| korrekte Ablehnung (Auftrag selbst lueckenhaft) | 5 | `server.ts#loadState` existiert nicht; kein Verify genannt |

Laufkosten: 144 Modell-Laeufe fuer 71 Zeilen (jeder Validator-Bump liest ungueltige Karten neu,
Rohantworten werden nicht gespeichert); p50 63 s, p90 97 s, max 121 s gegen 120 s Timeout, 2
Timeouts. `size` auf 37/82 Karten; Haiku findet sie 13/13-mal, wenn der Text eine nennt [V].

**Was ein Wechsel `FLEET_CARD_MODEL=claude-sonnet-5` aendert** [V]: nichts an bestehenden Karten
(`cardDue` prueft das Modell nicht); neu gelesen werden nur neue Zeilen, geaenderte Briefs und
ungueltige Karten beim naechsten Validator-Bump. Wirkt ab dem naechsten srv-Start.

## 2. Zustellung — was eine Lane bekommt

Ein Brief = `brief + notesBlock + snippetBlock + studioLaneBlock + anchorBlock + LANE_EXIT_FOOTER`
(`server.ts:10652`); davor die Lane-Fassung des Regelbuchs als `CLAUDE.md` (~29 KB,
harness-unabhaengig, `server.ts:3947`). Mediane ueber 17 Lane-Briefs seit 2026-09-13 20:57 [V]:

| Block | Quelle | Bedingung | Bytes |
|---|---|---|---|
| Karte + Text | `wave-brief.ts#withCardHead` | nur `card.valid` | 13/17 mit Karte |
| Notizen | `task-notes.ts#renderNotesBlock` | ≤5 × 300 B | 973 |
| Quellpaket | `context-snippets.ts#renderSnippetBlock` | Brief nennt Symbol; Budget 8192 | **7343** (56 %) |
| Studio | `studioBlockFor` | 0 Studios | 0 |
| Anker | `renderContextAnchorBlock` | immer dieselben 4 Packs (`always`/`verification`) | 924 |
| Exit-Footer | `LANE_EXIT_FOOTER` | | 2338 |

Median 12 990 B, max 16 889. `land-mechanics`, `task-queue`, `harness-adapter`,
`private-deploy-overlay` werden NIE geliefert (Trigger passt nie) [V].

**Steuergroessen:** Brief-Herkunft, `card.valid`, Symbole im Text, `sourceTree`, `harness`.
**Modell, Effort, Groesse steuern keinen Block** — sie stehen nur im Receipt (`server.ts:10668`),
und dort liest sie kein Server-Code [V]. Harness unterscheidet heute nur: Readiness-Wartezeit,
Pack-Filter (aendert Bytes nur fuer `pi-ox`), Transkript-Metriken (nur claude).

**Nachweise:** Receipt (harness/model/effort/selected/omitted/deliveredBytes/briefHash),
Volltext in `streams/prompts.jsonl`, Outcome mit `briefHash`. Luecken nach Wirkung [V]:
(1) Receipt haelt **nichts** ueber das Quellpaket fest (Bytes/Treffer/Auslassungen);
(2) `model: null` bei 13/50 Lane-Receipts seit 09-12 (= Env-Default, nicht rekonstruierbar);
(3) Transkript-Metriken nur fuer claude; (4) die Mess-Skripte der Basislinie liegen ungetrackt in
`/tmp/opus-lane-kontextkosten-2026-09-12.JSq2PO/`.

**Zeitlinie Quellpaket:** Modul `b26bd45e` (09-12 15:13), in den Brief eingebaut `bdc9acdd`
(09-13 19:12), erster gelieferter Block 09-13 20:57. Dazwischen 33 Lane-Briefs OHNE Block, 29
davon mit Symbol — die natuerliche **Kontrollkohorte**. Stichprobe 5 Opus-Lanes MIT Block: 8/7/7/4/19
Bash-Calls bis zum ersten `Edit` (Basislinie median 52, Marker meist erst der Commit). Kein
Wirkungsbeleg: Karten-Koepfe kamen im selben Fenster, n=5, keine Kontrolle gefahren.

**Totes Material:** `briefSource:"compiled"` 0/746 · `estimatedBytes` validiert, nie Budget ·
Studio-Bloecke `review`/`critic` nie gerendert (`server/types.ts:1721`, `server.ts:10589`) ·
Receipt-Felder `model/effort/harness/omitted/triggers/renderer` ohne Leser · Pack-Metadaten
`hardness/scope/evidence/supersedes` ohne Fundstelle. `docs/tailored-context.md` §8 („pi laedt
CLAUDE.md") widerspricht dem Regelbuch („pi laedt AGENTS.md seit b3c08e6") — §8 ist veraltet [G].

## 3. Ausgang — was nach der Arbeit geprueft wird

| Schritt | prueft | prueft NICHT |
|---|---|---|
| Land-Gate | Baum uebersetzt, 3 Wrapper gruen (`verified:true` 251/258) | ob der Auftrag erfuellt ist |
| Post-Land-Audit | volle Suite gegen den Tip, koalesziert | Zuordnung zur Lane: GLM landete 17/17 docs-only und traegt 8 rote Deckungen |
| Report (`FleetReport`) | nichts — Freitext + `complete\|needs-main` | **liegt auf keinem Ledger**, Retention 20 (`FLEET_REPORT_KEEP`); 14 d: 138 open, 126 prune |
| Annahme (`tickAcceptByLand`) | „gelandet UND kein rotes Audit auf mainAfter" | Inhalt. 11 accepted/rule · 9 accepted/main · 24 undecided · 0 rejected |
| Outcome (`buildLaneOutcome`) | 32 Fakten | Qualitaet: `review: none` 293/294 (auto-③ aus, `FLEET_AUTO_REVIEW_MS=0`) |
| Autoclose | 8 positive Bedingungen | schliesst nach `accepted-by-land` nie; 4/294 |

**Befund 1 (groesste Wirkung):** kein Schritt vergleicht Ergebnis mit Ziel; `Task.criterion` ist
auf 0/200 Zeilen gesetzt. **Befund 2:** der einzige Ort, an dem eine Lane sagt, was sie erreicht
hat — der Report — ist fluechtig.

**Das Qualitaetssignal, das schon da ist** (eigene Probe, 423 s, 3 920 `git blame`): wurden die
vom Land EINGEFUEGTEN Zeilen binnen 3 d von einem `fix…`-Commit ueberschrieben? [V]

| Modell | Lands | Code-Lands | Zeilen-Nacharbeit ≤3 d |
|---|---:|---:|---:|
| opus-5 | 100 | 84 | **20 (24 %)** |
| codex/gpt | 23 | 16 | **7 (44 %)** |
| fable | 12 | 10 | 2 |
| claude (Modell ungestempelt) | 19 | 10 | 2 |
| glm-5.3 | 13 | 0 | 0 |

Datei-Ueberlappung trennt nicht (72/83 Opus-Lands treffen `server.ts`/`e2e/*`), die Zeilen-Ebene
tut es. Weitere ungelesene Signale: `ownerPrompts>0` (42/158 opus, 11/45 codex), `killed-dirty`
9/294, `confirmedByHuman` 10/294, `toolResultBytes`/`successions` ohne jeden Leser.

**Warum K2 und Eval-Gate nichts lieferten** (Mechanismus): Basisrate der Frage nahe null
(„kollidiert semantisch trotz gruenem Gate"), nie mit gesetzten Defekten kalibriert (Feuerprobe #3:
2/2 leere Antworten = Nicht-Messung), und ein bei „pass" klebender Richter schreibt dasselbe Ledger
wie ein korrekt nichts sehender (`docs/attic/judge-calibration.md:85-100`). Eval-Gate: ein Verdict
in seiner Lebenszeit.

**Findings-Verarbeitung:** 73 `notiz`, 69 pending; 14 d `note_verdict` 201 — 196 „offen", 5
„erledigt"; `note_closed_by_land` 3. Anhaengen funktioniert, Schliessen nicht. `review-sweep.ts`
ist nirgends verdrahtet. 82 rote + 24 unknown Audits gegen 97 Adjudikationen (49 flake · 20
unknowable · 17 stale-test · 11 real).

**Worktrail-Analyse bisher:** prospektiv `WORKTRAIL.md` im astra-main (41 Akte); retrospektiv
Audits II/III/B/Contracts-A/IV (45 Commits). Nur **IV** wurde am selben Tag Code (`7c19d416`,
`5927e099`, `bc1aae77`) — weil ihre Befunde als **Auftragszeilen** gefilet und gelandet wurden;
II/III blieben Dokumente. Slot 11 (Astra, „Worktrail-Analyse (resumed)") haengt an keinem Program
und keiner Zeile.

## 4. Was das zusammen heisst

1. Die Karte ist die einzige urteilende Schicht, und ihr Ausfall ist zu 12/21 ein Vertragsfehler.
   Ein Modellwechsel allein kauft hoechstens 4 Karten.
2. Die Zustellung ist blind fuer die Modellklasse UND fuer ihre eigene Wirkung. Bevor Profile je
   Modellklasse gebaut werden (`21ade485`), muss das Receipt das Quellpaket kennen und die
   Kontrollkohorte gemessen sein — sonst tunt man ohne Sensor.
3. Der Ausgang hat keinen Zielvergleich und kein dauerhaftes Ergebnisprotokoll. Ohne beides kann
   weder eine Schlussbewertung noch ein Variantenvergleich kalibriert werden — das ist exakt der
   Fehler von K2.
4. Das erste belastbare Qualitaetssignal ist mechanisch und verzoegert (Zeilen-Nacharbeit). Es ist
   die Wahrheit, gegen die jeder spaetere Bewerter kalibriert wird — und der Grund, warum der
   Owner sich rausnehmen kann: die Schleife schliesst sich ueber Daten, nicht ueber sein Urteil.

## 5. Entscheidungen (Orchestrator Slot 8, unter Owner-Delegation 2026-09-14 „komplett rausnehmen")

**E1 Karte — Vertrag zuerst, Sonnet 5 dazu, dann messen.**
(a) Prompt-Vorlage bekommt `creates` und `after`; `rolle` wird normalisiert (Harness
case-insensitiv, Modell-Aliasse „Opus 5"→`claude-opus-5[1m]` usw.) und bleibt ohne Konsumenten
**beratend** — es macht eine Karte nicht mehr ungueltig; Rohantworten werden mit ins Ledger
geschrieben. (b) `FLEET_CARD_MODEL='claude-sonnet-5'` in `.env` (Owner-Wille; wirkt ab naechstem
srv-Start; Timeout-Risiko klein, Boot dominiert). (c) A/B an derselben Quelle
(`[brief.text, text]`) der 41 offenen + 69 Ledger-Zeilen, drei Arme: Haiku/alt, Sonnet/alt,
Sonnet/neu — je 3 Laeufe, `claude -p` aus dem Scratchpad, `validateCard` gegen denselben Snapshot;
verglichen werden nur die Klassen „echter Lesefehler" und „answer/run". Ist Sonnet dort nicht
besser, geht `.env` zurueck — mit Zahl.

**E2 Ausgang — die verzoegerte Wahrheit als Ledger.** `land-quality.ts` (getrackt): je Land
Zeilen-Nacharbeit ≤3 d/≤7 d, rotes Audit auf `mainAfter` (adjudiziert `real` gezaehlt, `flake`
nicht), `ownerPrompts`, `killed-dirty` — eine Zeile je Land nach `land-quality.jsonl`, Aggregat
je Modell/Harness/Groesse; `state.sh` zeigt das Aggregat. Dazu `fleet-reports.jsonl`: jeder
Report wird beim Oeffnen und bei jeder Entscheidung angehaengt (Retention bleibt fuer die
Live-Liste). DONE-Beleg: der Report einer Lane muss den DONE-Satz der Karte zitieren und je
Teil „erfuellt/nicht/nicht messbar" sagen — das ist ein Footer-Satz, kein Richter.

**E3 Zustellung — erst Sensor, dann Profil.** Receipt traegt `snippet{bytes,hits,omitted}` und
nie `model:null` (Default aufloesen). Wirkungsmessung als Mess-Notiz: Kohorte 09-13 01:17–20:57
(29 Briefs, Symbol, kein Block) gegen ab 20:57, Metrik Bash-Calls bis erster produktiver Marker
und Kontext am Marker, Skript wandert getrackt ins Repo. **`21ade485` (Modellklassen-Profile)
wird geschaerft, bleibt aber NACH E3-Messung** — Profile ohne Sensor sind Vermutung.

**E4 Varianten — erst eine Paarung von Hand, dann der Mechanismus.** Paarung 1 ist E2s
`land-quality.ts` selbst (selbstenthaltenes Skript, mechanisches DONE): Opus 5 high gegen codex
gpt-5.6-sol, beide ueber die Dispatch-Tuer mit Spawn-Tripel auf zwei Zeilen gleichen Texts.
Vergleich ohne Owner: (1) DONE-Satz je Teil erfuellt (Skript laeuft, Zahlen reproduzierbar gegen
die Probe in §3), (2) Suite gruen, (3) Diff-Groesse und beruehrte Dateien; Gleichstand ⇒ kleinerer
Diff landet; der Verlierer wird `shelved`, seine Branch bleibt als Datum. Ergebnis als
Mess-Notiz. Erst dann der Mechanismus: Variantengruppe an der Zeile (`variants[]`), Kollision
innerhalb der Gruppe erlaubt, genau eine landet, Vergleicher = E2-Signale + optional ein
kalibriertes Urteil, dessen Trefferquote gegen E2 mitgeschrieben wird.

**E5 Worktrail — periodisch, mit Pflicht-Ausgang.** Lauf 1 jetzt als read-only Opus-Lane ueber
14 d: Eingabe die Ledger aus §3 PLUS `land-quality.jsonl` (die fehlende Qualitaets-Verknuepfung,
die IV selbst benannt hat); Ausgabe Front-Matter-Doc **und mindestens drei Auftragszeilen mit
Karte und eine stehende Kennzahl**, gefilet ueber die MAIN-Tuer — kein `notiz`, denn der
Notiz-Kanal schliesst nichts (3 von 69). Takt-Mechanik (Zeile aus Vorlage alle 14 d, default aus)
erst, wenn Lauf 1 diesen Ausgang bewiesen hat.

**Nicht gebaut, bewusst:** ein Modell-Richter am Land-Pfad (K2-Form) — erst nach E2 und nur mit
mitgeschriebener Trefferquote; `review-sweep.ts` verdrahten — ohne Senke wiederholt es das
Versickern; auto-③ einschalten.

## 6. Reihenfolge und Abhaengigkeiten

Welle 1 (parallel, Repo-Deckel 3): E1a Karten-Vertrag · E2 Report-Ledger + E3 Receipt-Felder (eine
kleine server.ts-Lane) · E4 Paarung 1 = E2 `land-quality.ts` (zwei Zeilen, zwei Modelle).
Welle 2: E1c Karten-A/B (nach E1a) · E3 Wirkungsmessung (Mess-Notiz, jederzeit) · E5 Lauf 1 (nach
`land-quality.ts`). Welle 3: E4 Mechanismus (nach Paarung 1 bewertet) · `21ade485` (nach E3-Messung)
· E5 Takt.
