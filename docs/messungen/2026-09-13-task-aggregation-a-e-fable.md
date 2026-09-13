---
frage: Wie werden Tasks heute zu Karten, Bestaetigungen, Wellen und Entscheidungen aggregiert, und welche Stufe, welches Format und welches Modell traegt die Kette (Fragen A–E des Owners)?
urteil: Die Kette versagt nicht am Modell, sondern am Eingangsformat — Opus 5 und Fable 5.1 liefern auf 3/3 Stichproben dieselben Luecken wie Haiku; 14 der 27 ungueltigen v2-Karten sind mit einem Filing-Format gueltig, 10 brauchen ein Kartenfeld fuer neue Dateien, und die Handbestaetigung blockiert heute nur 4 Zeilen, nicht 20.
bereich: [karten, buendelung, bestaetigung, wellen, entscheidungen, brief-kette, ctxpack]
belege: [fleet.json, cards.jsonl, lane-outcomes.jsonl, post-land-audits.jsonl, audit-adjudications.jsonl, audit.jsonl, context-receipts.jsonl, card-extract.ts#validateCard, server.ts#confirmCardsForMain, server.ts#cardDue, task-land-waves.ts#classify, task-land-waves.ts#collidesOn, docs/queue-wellen-2026-09-06.md, docs/tailored-context.md, docs/messungen/opus-lane-kontextkosten-2026-09-12.md]
nicht-gemessen: Tokenwirkung eines ctxPacks (kein Lauf), Kollisions-Trefferquote (forkSha fehlt), Modell-Stichprobe n=3, Notiz-Kappe je Program, Owner-Zeit je Entscheidung, Geldkosten
stand: 2026-09-13
---

# Task-Aggregation A–E — Karten, Bestaetigung, Wellen, Entscheidung, Architektur

Denk- und Messlane Fable 5.1, read-only, Messfenster 2026-09-13 12:1x–13:0x auf dem
Haupt-Checkout (Live-Daten nur als Python-Projektion mit Feldauswahl; `bun task-land-waves.ts`
Ausgabe vor dem Lesen `grep -c token` = 0). Baum der Lane: `9bff20a5`; Live-main laut GLM-Note
`286349c7` (Kartenfix „Buendeln liest die Flaeche"). Eingang gegengelesen: GLM-Kontrollnote
(`fleet/260913095026-db29`, C7), Astra-Kontextkosten (`docs/messungen/opus-lane-kontextkosten-2026-09-12.md`).

## 0. Gegenlesung des Brief-Stands (jede Zahl selbst erhoben, 12:3x)

| Behauptung im Brief | Gemessen | Quelle |
|---|---|---|
| 114 offene Zeilen: notiz 66 · auftrag 43 · richtung 4 · betrieb 1 | **113**: notiz 67 · auftrag 40 pending (+4 `sent`) · richtung 5 · betrieb 1 | fleet.json `tasks[].kind/status` |
| 0 queued · 27 Auftraege > 3 Tage · 31 ohne Program | 0 queued · **27** > 3 d · **31** offene Zeilen ohne Program (davon 8 auftrag, 20 notiz) | dito, `created`, `programId` |
| Queue exakt auf MAX_TASKS | **200 = MAX_TASKS** (`server.ts#MAX_TASKS`) | `len(tasks)` |
| Karten v2: 3/30 gueltig, 22/40 surfaceValid, 14 buendelbar | **3/30** v2 gueltig · **13/40** gueltig gesamt · **22/40** surfaceValid · **5/40** bestaetigt (`filesOrigin:"confirmed"`) | `tasks[].card` |
| Luecken v2: 16 nicht getrackt · 9 Symbol nicht `datei#symbol` · 7 verify · 5+5 rolle · 3 Symbol unbenannt | **14** `surface.files` untracked · **9** `surface.symbols` kein `datei#symbol` · **7** verify ohne Kettenschritt · **5+5** rolle.harness/model · **3** Symbol nicht als Aenderungsziel · 2 Symbol loest nicht auf · 1 done · 2 verify leer · 1 Antwort unlesbar (Luecken je Zeile, Mehrfachnennung) | `card.gaps`, Klassifikation per Praefix |
| Karte: Haiku 4.5, p50 69 s | 72 Zeilen `cards.jsonl`, alle `claude-haiku-4-5-20251001`, p50 **69 072 ms**, 13 valid, v2 32 Zeilen / 3 valid, `tokens` in 0/72 (Transport meldet keine Usage) | cards.jsonl |
| notes-assign: 0 von 66 angehaengt | **4 von 67** offenen Notizen haengen an einer offenen Auftrag-Zeile (3 Zeilen tragen `notes[]`); audit.jsonl: `task_note_attach` **18**, `note_verdict` **127** | fleet.json `tasks[].notes`, audit.jsonl `event` |
| Brief-Compiler aus | `FLEET_BRIEF_MS` nicht in watchdog.sh → `BRIEF_ON=false`; Receipts 7 d: `briefSource` raw 83 · founding 33 · owner 22 · main 2 · clarify 1 · **card 0** | context-receipts.jsonl, `server.ts#briefDue` |
| Wellen: 2 Mehrzeilen, 20 `flaeche-nur-abgeleitet`, 7 `kein-program`, 3 `keine-flaeche` | **bestaetigt**: claude-fleet 33 Wellen, W1 `[7ed73694, 1b47e29a]` (src/client.ts, 3 Units), W2 `[66df05b4, e3e5084a]` (server.ts + server/types.ts, 4 Units); 20/7/3/1(null); astra-main 5× `flaeche-nur-abgeleitet` | `bun task-land-waves.ts --state … --default-repo …` |
| fleetReports 59, 38 unentschieden (18/11/8) | **59 / 38**: owner-inbox 18 (14 complete + 4 needs-main) · program 11 (7+4) · program-main 8 · lane-watch 1 | fleet.json `fleetReports[].decision` |
| attentionRequests 21 (11/9/1) | **21**: answered 11 · refused 9 · open 1; alle 9 Refusals tragen `requester session ended` | `attentionRequests[]` |
| Rote Audits 7 d: 12, 6 unbeurteilt, 2 Familien doppelt | **12 rot / 71 gruen / 5 unknown**; **6 unbeurteilt** (Join `adjudications.auditAt == audit.at`); unbeurteilt: „reseed + live bytes" ×2 (dieselbe Familie am 2026-09-06 als `flake` beurteilt), „self-land progress guard" ×2 (heute, neu), „deleting a Watch …" ×1, „the hold is given back" ×1 | post-land-audits.jsonl, audit-adjudications.jsonl |
| 7-Tage-Durchsatz 94/112 gelandet | lane-outcomes 7 d: **landed 95 · killed-empty 8 · killed-dirty 7 · shelved 1** (2 ohne Disposition); `resolvedConflict` 3/95 (gesamt 13/659 = 2,0 %) | lane-outcomes.jsonl |
| Notiz-Kappe Fleet-Betrieb 10/10 | nicht gemessen (Owner-Route); f170dc46 traegt 26 offene Notizen, f9dc8e10 10, 9ce08219 10, ohne Program 20 | fleet.json |

Abweichungen sind Bewegung seit 11:5x (ein Land, eine Freigabe), keine Widersprueche — ausser
**notes-assign 4 statt 0** (die 18 `task_note_attach`-Ereignisse widerlegen „unbenutzt"; die Anheftung
ist NUTZBAR, aber selten).

---

## A · Format fuer Auftraege

**Befund.** `card-extract.ts#validateCard` prueft vier Dimensionen gegen Fakten, die es selbst
feststellen kann, und **keine davon ist ein Modellurteil**: `rolle.harness` gegen `HARNESSES[].id`
(`claude · pi · pi-zai · pi-ox · pi-unfenced · container · codex`), `rolle.model` gegen `MODEL_RE`
(eine FORM-Regel: `^[A-Za-z0-9._-]{1,64}(\[…\])?$` — kein Register; „Opus 5" faellt am Leerzeichen,
„Opus5" kaeme durch), `rolle.effort` gegen die Effort-Listen der Harnesses, `surface.files` gegen
`git ls-files` UND den Intent-Text (`task-metadata.ts#intentText`, Verify-Zeilen und Kommandos
maskiert), `surface.symbols` als `datei#symbol` gegen Intent-Text + Graph + Top-Level-Deklaration
(`declaresSymbol`), `verify` gegen `LOCAL_PROOF_STEPS` (`install pins tsc build clean-review security
claude-gate`) oder `bun`/`./e2e-`, `size` gegen `KLEINE|MITTLERE|GROSSE LANE`.

**Modell- oder Textproblem — gemessen.** Dieselben drei Zeilen (`9fe80661`, `7e601e57`, `42c53378`)
wurden read-only mit Opus 5 (Subagent, nur Read/Write, exakter `buildCardPrompt`) und mit Fable 5.1
(diese Session) extrahiert und mit `validateCard` gegen den LIVE-Baum (`git ls-files`, `graphify-out`,
Haiku-identische Validatoren) geprueft:

| Zeile | Haiku (Live-Karte) | Opus 5 | Fable 5.1 |
|---|---|---|---|
| `9fe80661` | `rolle.model "Opus 5"` | **identisch** | **identisch** |
| `7e601e57` | 3× `surface.symbols` bare Konstante (kein `datei#`) | 1× `server.ts#SUITE_OFFER_WAIT_HELD_MS` nicht als Ziel benannt (2 Symbole aufgeloest) | **identisch mit Opus** |
| `42c53378` | verify ohne Kettenschritt + 2× Symbol nicht benannt (`server.ts tickMigrate` ohne `#`) | **identisch** | **identisch** |

0 von 3 Zeilen wird durch ein staerkeres Modell gueltig. Der einzige Modellunterschied ist die
Schreibweise `datei#symbol` (Haiku gibt bare Namen zurueck, Opus/Fable qualifizieren). Das ist
ein **Text-/Formatproblem**; die in `docs/queue-analyst.md` §3b ausdruecklich nicht gebaute
Eskalation auf ein staerkeres Modell wuerde ~3 der 27 ungueltigen Karten treffen.

**Handklassifikation der 30 v2-Karten** (je Zeile die dominante Ursache; Liste aus `card.gaps` +
Zeilentext, oben in §0 belegt):

| Klasse | n | Zeilen |
|---|---:|---|
| gueltig | 3 | `02131402 7ed73694 1b47e29a` |
| **Textfix reicht** (Rolle als ID, `datei#symbol`, Verify mit Kettenschritt, echter Pfad) | **14** | `ee47b0f8` (Verweis-Brief ohne DONE/VERIFY, „Codex") · `9fe80661 e9c47a54 66df05b4` („Opus 5") · `60fff186 df50b95b` (`server.ts#loadState` — kein Top-Level-Symbol im Baum, veralteter Name) · `e0c1ba07` (`Task.filesProposal`) · `a17a630b 60257e41 531bab26 db756205 42c53378` (verify Prosa / Symbol ohne `#`) · `04f55eba` (`INDEX.md` statt `docs/messungen/INDEX.md`) · `7e601e57` (bare Konstanten) |
| **Validator-Schnitt noetig: Datei wird NEU angelegt** | **9** | `c269023d 21ade485 32fed872 ad3b3960 6e7de1eb 0610f3a5 e80466c9 ee824afd ba1ea7f2` (davon 5 ZUSAETZLICH mit Rollen-Prosa „Preflight-Architect", „M2-Art-Director" im Harness-Feld) |
| Validator-Schnitt: CLARIFY-Zeile hat per Definition keinen Kettenschritt | 1 | `f3ca2e05` |
| Extraktor (Haiku): Routen/lokale Variablen als Symbole, leere Antwort | 3 | `666d0b67` (`POST /api/tasks/:id/refine` als Symbol) · `c71b96eb` (`notesBlock` = lokale Variable) · `ff88072c` (keine lesbare Antwort, Backoff) |

Mit Format allein: **17/30 gueltig** (3 + 14); mit Format + „neue Datei"-Feld + CLARIFY-Ausnahme:
**27/30**; die drei Extraktor-Faelle brauchen ein Wiederlesen (`ff88072c`) bzw. den Prompt-Satz
„nur Top-Level-Symbole, keine Routen, keine lokalen Variablen".

**Vorschlag — das Filing-Format (fuenf Kopfzeilen, dann Prosa; parsebar OHNE Modell):**

```
ROLLE: <harness-id>/<model-id>/<effort>          z. B. claude/claude-opus-5[1m]/high
GROESSE: klein|mittel|gross
FLAECHE: server.ts#confirmCardsForMain, server/types.ts#Task, e2e/tasks.ts
NEU: docs/messungen/2026-09-14-<thema>.md          (Dateien, die es noch nicht gibt)
VERIFY: install+pins | volle Kette | ./e2e-isolated.sh …   (mindestens ein Kettenschritt-Name)
DONE: <ein pruefbarer Satz>
```

`NEU:` wird ein eigenes Kartenfeld `surface.creates: string[]` mit eigener Regel: der Pfad muss
im Intent-Text stehen, darf NICHT getrackt sein, und sein Verzeichnis muss existieren
(`docs/messungen/` ja, `docs/recherche/` fuer `0610f3a5` heute nein → Luecke „Verzeichnis fehlt").
Der Wellen-Sensor liest `creates` NICHT als Kollisionsflaeche (eine neue Datei kollidiert mit
nichts), wohl aber `verify-proportion.ts` (eine neue `docs/`-Datei bleibt docs-only). Damit stirbt
C7-Punkt 1 der GLM-Note, ohne dass `surface.files` eine ungetrackte Datei je akzeptiert.

**Kosten.** `card-extract.ts` (Feld + Regel + Prompt-Zeile, Validator-Version 3 → einmaliges
Wiederlesen aller 27 ungueltigen Karten durch `cardDue`, ~27 × 69 s Haiku), `server/types.ts#TaskCardBody`,
`wave-brief.ts#renderCardHead` (Zeile `NEU`), `e2e/cards`-Familie (3 Checks: creates getrackt ⇒ Luecke,
Verzeichnis fehlt ⇒ Luecke, creates nicht in `surface.files`), `docs/queue-analyst.md` §3b Tabelle.
Kleine Lane. Das Format selbst kostet nichts im Code — es ist ein Satz in `docs/lane-brief-template.md`
und im Rulebook-Fragment fuer MAINs („Kopfzeilen ROLLE/GROESSE/FLAECHE/NEU/VERIFY/DONE").

**Pruefung.** (1) `validatorVersion 3` erreicht die 27 Karten (Trail `cards.jsonl`, `validatorVersion:3`
je Zeile); erwartet: ≥ 9 der „nicht getrackt"-Zeilen werden `surfaceValid` (gleiche Zeile, gleicher
Text). (2) Zehn neu gefilte Zeilen im Format: ≥ 8 `valid:true` beim ersten Lesen — sonst ist der
Validator zu streng, nicht die Filer zu schlampig. (3) Gegenprobe: eine Zeile mit `NEU: server.ts`
muss die Luecke „ist getrackt" tragen.

---

## B · Bestaetigungs-Politik

**Befund — die Bestaetigung ist heute NICHT der Engpass.** `server.ts#confirmCardsForMain` wurde
genau **einmal** benutzt (`audit.jsonl` `task_cards_confirm` n=1, slot 4, Program f170dc46, 5 Ids,
2026-09-13 11:49); die Owner-Tuer `task_files_confirm` 13× gesamt. Von den 25 `flaeche-nur-abgeleitet`-
Wellen (20 claude-fleet + 5 astra-main) sind nach dem Code der Tuer heute **nur 4 bestaetigbar**
(`card.surfaceValid && files.length && filesOrigin != confirmed`, gruppiert: Program f9dc8e10 = 4,
ohne Program = 5 — die zaehlen aber als `kein-program`, Program f170dc46 = 0: seine MAIN hat alles
bestaetigt, was ihre Karten hergaben). Weitere 8 Zeilen sind `surfaceValid` mit LEERER Flaeche
(Denkauftraege, Clarify — die Tuer ueberspringt sie mit „names no file surface"). Die uebrigen ~13
blockierten Zeilen haben eine `surface.*`-Luecke — sie gehoeren zu A, nicht zu B.

**Das Risiko, das §7.1.3 abwehren wollte,** war woertlich: „derived → confirmed automatisch heben
(das tauft eine Prosa-Vermutung in einen Fakt um)". Die abgeleitete Flaeche (`task-metadata.ts`,
Pfad-Tokens aus dem GANZEN Text inkl. Verify-Zeilen) war die Vermutung. Die Karte ist es nicht mehr:
Zitatregel gegen den Intent-Text, `git ls-files`, Symbol-Deklaration — `surface.files` ist eine
BEGRUENDETE VERENGUNG der Ableitung (`docs/queue-analyst.md` §3b). Was die Handbestaetigung heute
noch zusaetzlich prueft: nichts Inhaltliches — `confirmCardsForMain` liest `surfaceValid` und kopiert
`card.surface.files`. Der Akt ist eine Unterschrift ohne zweite Pruefung, gebunden an eine lebende,
exakt gebundene MAIN — und genau die fehlt bei 8 programlosen Zeilen strukturell und bei
Leichtgewicht/Biber (f9dc8e10: 4 bestaetigbare Zeilen seit ≥ 5 Tagen unbestaetigt) praktisch.

**Bewertung der drei Optionen:**

| Option | gewinnt heute | Risiko | Kosten |
|---|---|---|---|
| Status quo | 0 | MAIN-Liveness als Vorbedingung des Buendelns; Programs ohne MAIN buendeln nie | 0 |
| Program-uebergreifende Bestaetigung (Steward/Owner-MAIN darf fremde Programs) | 4 (+5 bei Program-Zuweisung) | schwaecht die Bracket-Regel „nur eigenes Program" (409-Design) fuer einen Akt, der inhaltlich nichts prueft | klein, aber Regelbruch |
| **Auto-Lift mit Wache**: dritter Origin `filesOrigin:"card"`, geschrieben vom Karten-Tick, wenn `surfaceValid && files.length && programId` | 4 sofort, jede kuenftige Zeile ohne Wartezeit | eine grobe Karte (`server.ts` ohne Symbol) buendelt per Datei-Rueckfall den Klumpen — dieselbe Schwaeche, die eine Hand-Bestaetigung derselben Karte HEUTE schon haette | mittel (s. u.) |

**Vorschlag: Auto-Lift mit zwei Wachen, bestaetigen bleibt Override.** (1) `filesOrigin:"card"` als
eigener Wert; R3 in `task-land-waves.ts#classify` akzeptiert `confirmed | card`; das Board zeigt „card"
als eigenen Chip; `confirm-cards` und die Owner-Tuer heben weiter auf `confirmed` (Vorrang bleibt).
(2) Die Wache im Sensor: eine Kante ueber eine `card`-Flaeche gilt NUR bei Bereichs-Naehe
(`collidesOn` mit Ranges beider Seiten) — der Datei-Rueckfall (§C) bleibt den bestaetigten Flaechen
vorbehalten. Damit kann eine grobe Karte nie den Klumpen bauen, den §7.2 „der wunde Punkt" nennt;
sie bleibt Welle 1 mit Grund `flaeche-ohne-bereich`. (3) Programlose Zeilen bleiben `kein-program` —
das ist eine Owner-Zuweisung, keine Lesung.

**Kosten.** `server/types.ts#TaskFilesOrigin` (+ Loader-Allowlist), `server.ts#tickCardSweep` (Lift
nach `extractCard`), `task-land-waves.ts#classify` + `collidesOn` (Origin-abhaengiger Rueckfall),
`src/client.ts` Chip, `e2e/tasks.ts` (Lift-Check, Wache-Check mit Mutation „Rueckfall fuer card ⇒ rot"),
`docs/queue-wellen-2026-09-06.md` §7.1.3 Nachtrag. Mittlere Lane. **Owner-Entscheid noetig**, weil
§7.1.3 ein Owner-Entscheid war — diese Notiz hebt ihn nicht auf, sie legt die Messung daneben.

**Pruefung.** Nach dem Lift: `bun task-land-waves.ts` zeigt fuer f9dc8e10 ≥ 1 Mehrzeilen-Welle nur
dann, wenn beide Seiten Ranges tragen (heute: `a05fa7ff/9940ec64/67abe12c` haben Symbole → messbar);
`flaeche-nur-abgeleitet` sinkt von 20 auf ≤ 16; `flaeche-ohne-bereich` erscheint als neuer Grund.
Gegenprobe: eine `card`-Zeile mit nur `server.ts` ohne Symbol bleibt Welle 1.

---

## C · Kollisionen messbar machen

**Notiz 55807536 (forkSha) gegengelesen.** Die Notiz stimmt am Code: `server.ts#openLaneInSlot`
schreibt `worktree.baseSha`, der Land-Pfad reicht `mainBefore` als `base`, `buildLaneOutcome` nimmt
`facts.baseSha` zuerst — die Outcome-Zeile traegt den Nach-Rebase-Punkt (bestaetigt ueber die
Ledger-Keys: `base`, `headSha`, `mainAfter`, kein `forkSha`). **Reicht forkSha? Fuer die Frage
„hat main sich waehrend der Lane bewegt" ja; fuer „parallele Buendel sind sicher" nein** — das ist eine
Aussage ueber PAARE gleichzeitig lebender Lanes, und dafuer braucht es je Lane den Fork UND die
tatsaechlich beruehrten Hunks. `filesTouched` und `shortstat` stehen schon auf der Zeile, die Hunks
liefert `git diff base..headSha` jederzeit (post-rebase, aber die Hunks der Lane selbst). Die
Lebenszeit-Ueberlappung ist heute nur ueber `ts - sessionMs` approximierbar; `forkSha` macht sie exakt.

**Die Kennzahl, die „parallele Buendel sind sicher" beweist:** ueber alle Paare gelandeter Lanes mit
ueberlappender Lebenszeit (forkSha der zweiten liegt vor mainAfter der ersten) —
*Praezision/Recall der R4-Vorhersage gegen Hunk-Ueberlappung ±40 Zeilen* (vorhergesagt „disjunkt"
und wirklich disjunkt / vorhergesagt „disjunkt" und doch ueberlappend), daneben die Basisrate
`resolvedConflict` der Zweitlandung (heute 3/95 in 7 d, 13/659 gesamt = 2,0 %). Ein Recall-Fehler
(vorhergesagt disjunkt, real ueberlappend) ist der einzige Fall, der ein Buendel wirklich kostet.
Beides ist aus Ledger + Git rechenbar, sobald `forkSha` da ist; die Hunk-Haelfte schon heute
(post-hoc ueber die letzten 95 Lands — ein Read-only-Skript, keine Serveraenderung).

**R4-Rueckfall auf Dateiebene (Buendel W2 haengt nur an `server/types.ts` ohne Bereich): richtig
konservativ — fuer LANDE-Wellen.** Die Asymmetrie ist im Modul benannt (`task-land-waves.ts#collidesOn`):
Verbinden kostet eine Wellengroesse, Trennen einen Konflikt in einer Lane, der man „allein" gesagt hat.
Fuer eine Lande-Welle heisst „verbunden" zudem: dieselbe Lane, serielle Commits — ein Konflikt
zwischen den beiden Zeilen ist strukturell unmoeglich. Die Schwaeche ist nicht die Regel, sondern
die ABDECKUNG: `server/types.ts` hat 2 459 Zeilen, `66df05b4` nennt kein Symbol darin, also gibt es
keinen Bereich. Mit Format A (`server/types.ts#Task`) haette W2 einen Bereich. Fuer PARALLELE Buendel
(Frage oben) sagt derselbe Rueckfall „kollidiert" und haelt sie auseinander — auch dort die sichere Seite.
**Designschwaeche nur, wenn `card`-Flaechen (B) den Rueckfall erben** — deshalb Wache (2) in B.

**Semantische Abhaengigkeit ohne gemeinsame Datei (W1 Client-Ansicht vs W2 Server-Uebergabedaten).**
Gemessen an den vier Wellen-Zeilen: `7ed73694` beginnt mit „FREIGABE erst nach Land von S2", `66df05b4`
mit „Start erst nach D1 ced51e9c", `e3e5084a` traegt „NACH 42c53378", `7e601e57` „NACH 10ddd013" —
**4 von 40 offenen Zeilen nennen ihre Abhaengigkeit explizit im Text, 2 davon mit aufloesbarer
Task-Id.** Token-Ueberlappung (camelCase + Pfade) zwischen W1 und W2: nur `server.ts`, `e2e/pins.ts`
— die Naben, kein Signal. **Der billige Sensor ist der Text selbst:** ein Kartenfeld `nach: string[]`
(Zitatregel: Id oder Label muss im Intent-Text stehen; Id muss in `tasks` existieren, sonst Luecke
`nach: "S2" loest auf keine Zeile auf`). Der Wellen-Sensor liest es zweifach: eine Zeile mit offenem
`nach`-Ziel ausserhalb ihrer Welle bekommt `reasonAgainst:"wartet-auf"`; zwei Wellen, zwischen denen
ein `nach` steht, duerfen nicht parallel laufen (Dispatch-Reihenfolge = Kantenrichtung). Das faengt
genau die Faelle, die heute als Prosa („erst nach Land von S2") an einem Menschen haengen — VOR dem Land,
ohne Modell. Was er nicht faengt: eine Abhaengigkeit, die niemand hingeschrieben hat; dafuer gibt es
keinen billigen Sensor, nur den teuren (Symbolgraph-Kanten zwischen den Karten-Symbolen beider Zeilen,
`graphify-out` hat sie — ein `explain`-Pfad zwischen `renderProgramDetail` und `taskDigest` waere die
zweite Stufe, advisory).

**Kosten.** forkSha: `server.ts#buildLaneOutcome` + Land-Note + `e2e/`-Sonde mit Gegenprobe (die Notiz
nennt sie) — klein. `nach`-Feld: Karte + Validator (Id-Existenz) + `classify` + Dispatch-Reihenfolge —
klein bis mittel. Kennzahl-Skript: read-only, klein, sofort.

**Pruefung.** forkSha: gelandete Lane nach dem Einbau traegt `forkSha != base` genau dann, wenn main
sich bewegte (Notiz-Kriterium). `nach`: `7ed73694` und `66df05b4` tragen nach dem Wiederlesen eine
Luecke (Label „S2"/„D1" ohne Id) — das ist die richtige Antwort, kein Fehler; `e3e5084a`/`7e601e57`
tragen ein aufgeloestes `nach`. Kennzahl: erstes Skript ueber die 95 Lands liefert Praezision/Recall
mit Nenner; ein Recall < 0,9 stoppt parallele Buendel, bevor sie gebaut werden.

---

## D · Entscheidungsflaeche

**Gelesen (Projektion):** 38 unentschiedene Reports, 21 Attention-Zeilen, 6 unbeurteilte Rot-Audits.

**Reports — Join Report → Zeile → Lane-Outcome (`worker.branch`):** **37 von 38** unentschiedenen
Reports gehoeren zu einer Lane, die **gelandet** ist (Zeile `done` oder schon aus der Queue verdraengt);
der 38. (`69303b2f`, Zeile `fe050453`, `sent`) ist die Lane hinter der einzigen offenen Attention
(`90a6ae45`). Nach Status: 30 `complete` (29 gelandet + `69303b2f`), 8 `needs-main` (alle gelandet:
`6a8db675/4ed8e3f6` Audit-Worker-Entscheid, `1815ff0f` Clarify-Kriterium unbestaetigt, `c334a674`
Korrekturgruppen, `080d93ca/e1f89a72` zweites Rot am Gegenlauf, `3610a981/6cc95ab5` Antwort auf Reject).
Aelteste 12,7 Tage.

**Attention:** 9 von 9 Refusals sind `requester session ended` — keine Entscheidung, sondern
Succession-Artefakte; dieselbe S12-Frage wurde dreimal gestellt (`6d51202e → 04f4b7e6 → 716a097d`),
`70a63717` einmal und als `90a6ae45` neu. 11 answered: 6 decision (Owner-Wort oder Controller), 3 blocked
(Deckel, Notizkanal), 2 review-ready (durch den Land selbst beantwortet).

**Rot-Audits:** 6 unbeurteilt; 2 („reseed + live bytes") haben eine Vorbeurteilung derselben
Check-Signatur (`flake`, Owner, 6,7 d); 2 („self-land progress guard", beide heute 0,2 d) sind eine neue
Familie aus einem Burst; 2 Einzelfaelle.

**Regel — wer entscheidet was:**

| Klasse | Entscheider | Regel | heute regelbar |
|---|---|---|---:|
| Report `complete` + Lane gelandet (Zeile done/verdraengt) + gruener/unknown Audit | **niemand** | Land ist die Annahme; Report schliesst als `accepted-by-land` mit `mainAfter` | **29/38** |
| Report `complete` + Lane gelandet + roter Audit | MAIN | Paket unten; die Rot-Adjudikation IST die Entscheidung | 0 (kein Fall im Bestand) |
| Report `needs-main` + gelandet | MAIN (Program) / Owner (owner-inbox) | die Frage im Report ist offen, das Land beantwortet sie nicht | 0 (8 bleiben) |
| Report auf laufender Lane (`sent`) | MAIN | wie heute | 0 (1) |
| Attention `review-ready` | niemand | ein Land mit `mainAfter` nach `raisedAt` beantwortet sie | 2 (rueckwirkend) |
| Attention `blocked` (Deckel/Kappe) | MAIN/Steward | Paket: welcher Deckel, welche Zeile, seit wann | — |
| Attention `decision` mit Deploy/Wire-Autoritaet/Regelwiderspruch | **Owner** | Deploy (`b57b0287`, `2ce656f3`), Wire (`S12` ×3), Architektur (`70a63717/90a6ae45`) | — |
| Attention `decision` sonst (Kriterium, Folge, Landen) | MAIN | wie heute | — |
| Attention bei Succession des Fragestellers | niemand | **umhaengen auf den Nachfolger-Occupant statt `refused`** (3× S12 beweist die Kosten) | 9 (rueckwirkend) |
| Rot-Audit, Check-Signatur in ≤ 14 d schon `flake`/`stale-test` | niemand | Verdikt tragen als `flake (carried from <auditAt>)`, sichtbar als carried | **2/6** |
| Rot-Audit, neue Signatur | MAIN (Program des Lands) / Owner bei mehrfach | Paket unten | 4 |

**Minimales Datenpaket je Klasse** (Vorstufe fuer den Push, Kanal nicht entworfen):

- **Report-Entscheid:** `report.id`, `status`, `provenance.taskId`, Lane-`disposition` + `mainAfter`,
  Audit-Verdikt fuer `mainAfter` (`green|red|unknown|none`), der letzte Absatz des Reports als
  „Offenes" (Reporter-Konvention: eine Zeile) — 6 Felder, keine Prosa-Extraktion noetig, wenn die
  Reporter-Konvention „eine Zeile Offenes" gilt (`AGENTS.md` verlangt sie bereits).
- **Attention-Entscheid:** `kind`, erster Satz des Textes, `programId`, Fragesteller lebt? (Occupant-
  Vergleich), was blockiert (Lane-Id/Deckel/Kandidat-Sha aus `provenance`), Optionen falls der Text
  „(a)/(b)" nennt — 6 Felder.
- **Audit-Verdikt:** Namen der roten Checks, Anzahl Rot derselben Signatur in 30 d, letztes Verdikt
  derselben Signatur, `e2eTouched` der gelandeten Lane, ob ein Rerun existiert und wie er ausging — 5 Felder.

**Kosten.** Regel 1 (accepted-by-land) und Regel „carried flake" sind je eine Tick-Funktion mit
Audit-Zeile und Board-Marker (`accepted-by-land`, `carried`), plus Pins gegen stilles Auto-Accept bei
rotem Audit — kleine Lane. Attention-Umhaengen bei Succession: `server.ts` Succession-Pfad + Sonde —
klein. **Nicht regelbar bleiben 8 needs-main + 1 laufend + 4 neue Rot-Familien + Owner-Deploy/Wire.**

**Pruefung.** Nach Regel 1: `fleetReports` unentschieden faellt von 38 auf 9, jede geschlossene Zeile
traegt `decision.by:"land"` + `mainAfter`, und ein Report mit rotem Audit bleibt offen (Sonde mit
Mutation „Audit-Farbe ignorieren ⇒ rot"). Nach carried-flake: 2 Zeilen in `audit-adjudications.jsonl`
mit `by:"rule"` und Quelle.

---

## E · Aggregations-Architektur und Modelle

**Die Kette heute, mit Zahlen:** Filen (MAIN, Prosa p50 2 762 B / p90 5 147 B) → Karte (Haiku, 69 s,
13/40 gueltig; Live seit 09:34) → Quellen (deterministischer Flaechen-Join: 80/141 Dispatches in 7 d
trugen Notizen; Anheftung 4/67) → Brief-Compiler (aus; `briefSource card` 0/141, weil der Kopf erst seit
11:08 live ist und seither kein Dispatch lief) → Dispatch (deterministisch: Prosa + Notizblock +
Anker p50 4 + Exit-Footer, deliveredBytes p50 8 145 B / p90 12 069 B) → Lane erdet sich selbst
(Opus 5: median 177 297 Tokens am ersten Schreibmarker, 52 Bash-Aufrufe, 98,9 % der Tool-Bytes aus
Bash, `read files`/`search files` = 77 % der ersten zehn Aufrufe; erster Cache-Kontext median 68 943).

**Stufen, die bleiben / fallen / verschmelzen:**

| Stufe | Urteil | Modell | Begruendung |
|---|---|---|---|
| Filen im Format A | **bleibt, wird die Karte** | keines — Parser | fuenf Kopfzeilen sind regulaer parsebar; `validateCard` prueft weiter dieselben Fakten. Haiku entfaellt fuer formatierte Zeilen |
| Karte aus Prosa | bleibt als **Rueckfall** fuer Altbestand und Freitext | Haiku 4.5 | 3/3 Stichproben: Opus/Fable liefern dieselben Luecken; ein groesseres Modell kauft nur `datei#`-Qualifizierung, die der Prompt-Satz „nur Top-Level, keine Routen/Lokale" billiger kauft. Keine Eskalation (bestaetigt §3b) |
| Quellen-Anheftung | bleibt | keines | der Flaechen-Join traegt (80/141); die Anheftung ist die Ausnahme fuer Quellen ohne Flaeche |
| Brief-Compiler | **faellt** | — | seine Aufgabe (Files/Done/Verify aus Prosa) ist die Karte; ein Umschreiben der Prosa vor dem Kartenkopf wuerde die Zitatregel gegen einen Modelltext pruefen |
| ctxPack-Render | **neu, verschmilzt mit Anker + Snippet** | keines | s. u. — kuratiert von Menschen/MAINs je Bereich, deterministisch gerendert und im Receipt gehasht wie der Ankerblock |
| Dispatch | bleibt | keines | — |
| Lane | bleibt | Opus 5 high (Owner-Regel) | die 177 k sind Erdung, nicht Denken: Ziel des ctxPacks |
| Entscheidungs-Regeln (D) | neu | keines; Haiku nur, falls „die Frage" nicht als Feld kommt | Reporter-Konvention statt Extraktion |

**ctxPack — Erdung an `docs/tailored-context.md`.** §2/§3 dort: Umgebung kuratieren, Komplement still
ableiten lassen; §6 nennt drei Zutrittspfade, die heute nur ZEIGEN (Anker: Datei + Ueberschrift, ohne
Quelle) oder noch nicht verdrahtet sind (Snippet-Paket `context-snippets.ts`, 8 192-B-Deckel, §6b „one
hunk, not yet applied", Queue-Zeile `c71b96eb`). Ein **ctxPack** ist das fehlende dritte Objekt: ein
NAMENS-adressiertes, versioniertes, kuratiertes Paket je Arbeits-/Themenbereich, das ein Brief mit
`CTXPACK: <name>` ANFORDERT und das der Dispatch deterministisch rendert — aus (1) 3–6 Ankern
(`datei#ueberschrift`), (2) einer Snippet-Liste (`datei#symbol`, ueber `buildSnippetPackage` am Commit
des Dispatches, also nie veraltet), (3) 5–10 Invarianten-Saetzen (die Regelbuch-Zeilen dieses Bereichs,
nicht das ganze Regelbuch), (4) dem Verify-Rezept des Bereichs (welche e2e-Familie, welche Kette),
(5) den Flake-Familien des Bereichs (Verweis auf `docs/verify-tiering.md` §). Ablage: `ctxpacks/<name>.md`
getrackt (Front-Matter mit den Listen, Prosa fuer die Invarianten), Deckel 16 KB gerendert; das Receipt
traegt `ctxPack: {name, sha}` neben `selected`. Der Unterschied zum Anker: der Anker sagt „lies dort",
das Pack liefert die Zeilen; der Unterschied zum Snippet: das Snippet folgt dem Brieftext, das Pack
folgt dem BEREICH und traegt Invarianten, die kein Symbol ausspricht.

**Beispielpaket 1 — `karten-und-wellen`** (fuer jede Lane an Karte/Bestaetigung/Sensor):
Anker `docs/queue-analyst.md#3b`, `docs/queue-wellen-2026-09-06.md#R1..R4`, `#7.1.3` ·
Snippets `card-extract.ts#validateCard`, `#CARD_VALIDATOR_VERSION`, `task-land-waves.ts#classify`,
`#collidesOn`, `server.ts#confirmCardsForMain`, `server.ts#cardDue` (≈ 6 KB) · Invarianten: „die Karte
ist eine Lesung, keine Autoritaet" · „Zitatregel ist erzwungen, nicht erbeten" · „`surfaceValid` ≠
`valid`" · „kein Auto-Lift ohne Owner-Entscheid" · „Rueckfall = unbekannt, nie disjunkt" · „Version
bumpen, wenn ein Refusal zur Akzeptanz werden kann" · Verify: `e2e/tasks.ts` + `bun e2e/pins.ts`,
volle Kette · Flakes: keine bereichseigene.

**Beispielpaket 2 — `self-api-tuer`** (fuer jede Lane, die eine `/api/self/*`-Route baut):
Anker `AGENTS.md#Portable operating contract`, `docs/self-api.md#<route-familie>`, `CLAUDE.md`-Absatz
„Zwei Scope-Regeln" · Snippets `server.ts#boundProgramForMain`, ein bestehender Handler derselben Form
(`server.ts#releaseTaskForMain`), `server/types.ts#Task`, ein Check aus `e2e/self-token.ts` (≈ 7 KB) ·
Invarianten: „409, nie 401" · „Lane-only vs Nicht-Lane-only, jede Verweigerung mit eigenem Satz" ·
„`by` nie aus dem Body" · „eine Audit-Zeile je Akt" · „Body liest nur die genannten Felder, alles
andere 400" · „Program aus der Bindung, Repo aus dem Checkout" · Verify: `e2e/self-token.ts` +
`e2e/programs.ts`, volle Kette · Flakes: `docs/verify-tiering.md` §11.2 (Watch-Familie).

**Erwarteter Effekt an Astras 177 k — nicht gemessen, nur gedeckelt.** Ein Pack kostet ≤ 16 KB ≈ 4–5 k
Tokens im Gruendungsprompt. Was es ersetzen soll, sind Bash-`read`/`search`-Aufrufe vor dem ersten
Schreiben (77 % der ersten zehn; 28,1 MB Bash-Ergebnisbytes ueber 187 Lanes ≈ 150 KB je Lane vor dem
Marker). Der Median-Abstand erster Cache-Kontext → Marker ist 177 297 − 68 943 ≈ **108 k Tokens
Erdung**; das Pack traegt nur, wenn es die Dateien trifft, die die Lane sonst liest. Messrezept, das
den Effekt beweist statt behauptet: 10 Lanes desselben Bereichs mit Pack gegen die 187 Baseline-Lanes
nach der Methode der Astra-Note (Marker-Kontext, Bash-Aufrufe davor, `read files`-Anteil); Erfolg =
Marker-Median < 120 k UND Bash-vor-Marker-Median < 30, sonst ist das Pack nur Ballast (Failure-Mode
§5 der tailored-context-Doc: over-stuffing).

**Kosten.** ctxPack: `ctxpacks/` + Renderer (Anker-Renderer wiederverwenden, Snippet-Paket verdrahten
= Queue-Zeile `c71b96eb`, die schon steht) + Receipt-Feld + Pins + zwei Packs von Hand — mittlere Lane,
davon die Snippet-Verdrahtung bereits gefilet. Parser fuer Format A: klein (in A enthalten).

---

## Schnitt — EINE Rangliste, hoechstens fuenf Posten

Owner-Vorgabe woertlich (2026-09-13 12:1x): *„Gib doch einfach alle Fragen"* und *„die aktuelle Weise
Tasks mit den hilfreichen Informationen zu aggregieren gut durchdenken und checken, vllt da bessere
Modelle einsetzen oder nochmal speziell ueber Teile der Architektur nachdenken"*. Erfuellt ist die
Vorgabe mit den Antworten A–E oben und dem Modell-Befund (bessere Modelle: nein, 0/3). Die Rangliste
schneidet dort, wo die Kette messbar mehr Zeilen durchlaesst; alles unter der Linie ist Vorschlag, keine Lane.

1. **A · Filing-Format + `NEU:`-Kartenfeld + Prompt-Satz „nur Top-Level-Symbole"** — 17/30 → 27/30
   gueltige Karten ohne Modellwechsel; die Vorbedingung von B, C und E. Kleine Lane + Rulebook-Satz.
2. **D · Regel `accepted-by-land` + `carried flake` + Attention-Umhaengen bei Succession** — 29/38 Reports,
   2/6 Audits, 9/9 Refusals werden regelbar; das ist der groesste Abbau von Entscheidungsflaeche pro
   Zeile Code. Kleine Lane, Owner-Sicht bleibt fuer Deploy/Wire/Architektur.
3. **B · Auto-Lift `filesOrigin:"card"` mit Bereichs-Wache** — hebt die MAIN-Liveness als Vorbedingung des
   Buendelns auf; heute 4 Zeilen, strukturell jede kuenftige. **Owner-Entscheid**, weil §7.1.3 einer war.
4. **C · `forkSha` auf der Outcome-Zeile + Kennzahl-Skript (Praezision/Recall R4 gegen Hunks)** — vor
   jedem parallelen Buendel; das Skript kann vor forkSha schon die Hunk-Haelfte messen.
   Das `nach:`-Feld gehoert in dieselbe Lane wie Posten 1 (ein Kartenfeld mehr).
5. **E · ctxPack (zwei Packs, Renderer, Receipt) nach der Snippet-Verdrahtung `c71b96eb`** — der einzige
   Posten, dessen Nutzen nicht gemessen ist; deshalb zuletzt und mit dem Messrezept oben als Done.

— Schnittlinie —

Nicht gefilet: Brief-Compiler-Abbau (stirbt von selbst, wenn A steht), Program-uebergreifende
Bestaetigung (Regelbruch fuer 4 Zeilen), Graph-Kanten als Abhaengigkeits-Sensor (teuer, advisory),
Modell-Eskalation fuer Karten (widerlegt), Push-Kanal fuer D (ausdruecklich nicht entworfen).

## nicht-gemessen

- Tokenwirkung eines ctxPacks — kein Lauf; nur Deckel und Messrezept.
- Kollisions-Trefferquote (R4 gegen reale Hunks) — Skript nicht geschrieben, `forkSha` fehlt.
- Modell-Vergleich n = 3 Zeilen, ein Lauf je Modell; keine Varianz gemessen.
- Notiz-Kappe je Program (Owner-Route, verboten); Owner-Zeit je Entscheidung; Geldkosten.
- Ob die 29 „accepted-by-land"-Reports inhaltlich Offenes tragen — nur der letzte Absatz waere zu lesen,
  das ist die Reporter-Konvention, nicht gemessen.
- `.env`, `ps`, Owner-Routen: nicht angefasst.
