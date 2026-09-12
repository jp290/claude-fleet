# Spezifizierungsschritt und Wellen-Buendelung — Ist-Stand und Entwurf (2026-09-12, 16:3x)

Orchestrator Slot 5 (Fable 5.1) auf Owner-Frage „wie weit laeuft alles wirklich; smart bundling und den
Aggregier-/Spezifizierungsschritt unter die Lupe nehmen, Optimierungen, Modellwahl". Zwei Analyst-Agenten
haben die Module gelesen (task-waves.ts, task-land-waves.ts, wave-brief.ts, verify-proportion.ts,
task-metadata.ts, refine-validate.ts, clarify-prompt.ts, context-plan.ts, context-manifest.ts,
task-notes.ts, composer.ts, docs/queue-wellen-2026-09-06.md, docs/queue-analyst.md,
docs/tailored-context.md und die zitierten server.ts-Bereiche). Zahlen stammen aus fleet.json,
lane-outcomes.jsonl, post-land-audits.jsonl, context-receipts.jsonl, streams/prompts.jsonl, dem
Helper-Portal und einem ssh-Blick auf den Second-host. Zeilenangaben sind ein datierter Snapshot auf
HEAD 433946aa.

## 1. Ist-Stand Betrieb (gemessen 15:56–16:15)

| Sensor | Wert |
|---|---|
| Second-host | 2 von 3 Suite-Slots belegt (Audit cfc69851 seit 15:33, Preview Slot 7 seit 15:51), Load 1,36 |
| Mac | Slot 3 faehrt seit 37 min eine LOKALE Suite (Angebote 15:24 abandoned, 15:29 withdrawn, dann Fallback); 16 MB frei, Swap 2,7/4 GB |
| Audits heute | 6, alle gruen, 4163–4176 Checks, 0 Fails, ~37 min Wall; 5 auf dem Second-host, 1 lokal |
| Lands heute | 7 landed, 1 killed-empty, 1 killed-dirty |
| Lane-Suite-Angebote heute | 8: 3 reported, 3 withdrawn, 1 abandoned, 1 claimed |
| Queue | 41 offene Aufträge (4 in Flug auf 3 Lanes, Deckel 3 erreicht), 65 Notizen, 4 Richtungen, 1 Betrieb |
| Spezifikation | 3/41 mit `brief`, 2/41 mit bestätigter Fläche, 0/41 mit `criterion`, 0/41 mit `refine` |
| Deploy | Server 11 Commits hinter HEAD, Bundle stale (Slot 6 plant Deploy nach dem naechsten Audit) |
| Inbox-Nudge | 12 Fehler seit Boot, zuletzt 15:55 („composer still holds 193 chars"); Fix liegt in den ungedeployten Commits |

Urteil: Suite und Audit-Pfad sind heute gesund; der Second-host ist unterausgelastet (ein Slot frei), waehrend
der Mac eine Suite traegt, die er nicht tragen sollte. Der Engpass ist nicht die Suite, sondern der
Lane-Deckel 3 und die MAIN-Aufmerksamkeit je Zeile.

## 2. Wellen-Buendelung: warum sie nicht von selbst feuert

Mechanik (verifiziert): `task-metadata.ts#deriveTaskMetadata` leitet die Flaeche per Regex aus `text`
+ `brief.text` gegen `git ls-files` ab, bei jedem 2-s-Poll neu, nie persistiert. `task-land-waves.ts#classify`
lehnt in fester Reihenfolge ab: keine-flaeche → kein-program → flaeche-nur-abgeleitet (R3) →
gate-aenderer (R2). `#wavesFor` bildet Komponenten ueber gemeinsame Dateien je (klasse, program), Kappe 3.
Dispatch nur ueber `POST /api/wave/dispatch` (Owner-Tuer), kein Tick.

Projektion heute: **37 offene Zeilen → 37 Einzelwellen** (flaeche-nur-abgeleitet 28 · kein-program 8 ·
keine-flaeche 1), Ersparnis 0 s. Was-waere-wenn (abgeleitet als bestaetigt behandelt): 33 Wellen, nur 3
mit n>1 (7 Zeilen, 3 436 s gespart); **18 Zeilen fallen auf gate-aenderer**, weil die Ableitung zitierte
Verify-Kommandos (`e2e-isolated.sh`, `e2e/pins.ts`) als Flaeche einsammelt.

Drei Befunde ueber die Regeln hinaus:

1. **Dateiebene ist kein Kollisionsmass.** 33/41 offene Zeilen nennen server.ts. Von 294 gelandeten
   server.ts-Lanes brauchten 7 den Resolver (2,4 %), von 350 anderen 6 (1,7 %). Letzte 3 Tage: 22 Lands,
   0 Konflikte. „sharedFiles server.ts" sagt nichts ueber Kollision; es sagt nur „gleiche Datei".
2. **e2e-Beruehrung ist der Normalfall, nicht die Ausnahme.** 421/644 gelandete Lanes fassten e2e/ an. Eine
   Regel, die daraus Einzelwelle macht, schliesst zwei Drittel aller Arbeit aus.
3. **Die Ableitung verwechselt Zitat und Absicht.** Ein Pfad in einer Verify-Zeile ist kein Aenderungsziel.

## 3. Spezifizierungsschritt: was zwischen Prosa und Lane-Prompt passiert

| Schritt | Ausloeser | Executor | Live? |
|---|---|---|---|
| ↻ refine | Owner-Knopf | Wegwerf-Claude-Session, `REFINE_MODEL` claude-opus-5, liest Repo | mechanisch ja, 0/41 genutzt |
| refine-confirm | Owner | deterministisch; `refineChildText` faltet done/verify ZURUECK in Prosa, nur `files` ueberlebt als Feld | ja |
| Brief-Kompiler | Tick `tickBriefSweep` | codex-exec gpt-5.3-codex-spark, TEXT_ONLY, Faktenblock leer, stempelt falsches Modell | **tot** (`FLEET_BRIEF_MS` ungesetzt) |
| Hand-Brief | Owner/MAIN | Fable/Mensch | 3/41 |
| clarify/criterion | Owner-Knopf | die Lane selbst (Opus) | 2 Quittungen je, 0/41 Kriterium |
| files-proposal | Lane-Selbstaufruf | Lane | Route existiert, kein Aufrufer im Lane-Code gefunden |
| Flaechen-Projektion | jeder Poll | Regex | ja, 39/41 haben NUR diese |
| Kontext-Plan/Notizen | Zustellung | deterministisch | ja |

Was die Lane bekommt (8 letzte Auto-Prompts gemessen): Kopf 1 834–10 797 B (Roh-Prosa oder Brief),
Notizen 314–2 246 B, Anker konstant 948 B (nur Zeiger), Exit-Footer 1 441 B. **416 von 517 Dispatches
waren `briefSource:"raw"`.** Jede Opus-Lane leitet Flaeche, Done und Verify aus Prosa selbst her, zu
Lane-Preisen (fertige Lanes 140–190k Tokens; die 4 laufenden stehen bei 27–43 % von 1M).

Kern: **kein Spezifizierungsschritt laeuft unbeaufsichtigt**, und der einzige, der Struktur erzeugt
(refine), zerstoert sie beim Bestaetigen wieder.

## 4. Entwurf: eine Karte statt Prosa, deterministisch zuerst, kleines Modell danach

Ziel in einem Satz: jede Auftragszeile traegt eine maschinenlesbare KARTE (≤1,5 KB), aus der Buendelung,
Lane-Prompt und Verify direkt lesen; die Prosa bleibt Anhang. Reihenfolge der Schritte, jeder einzeln
landbar:

**S1 — Ableitung repariert (kein Modell, eine Regel).** `deriveTaskMetadata` unterscheidet Aenderungsziel
von Zitat: Pfade in Backtick-Kommandozeilen, hinter `./`, `bun `, `bunx ` oder in einer „Verify"-Zeile
sind keine Flaeche. Symbolverweise `datei#symbol` und `datei:zeile` (die Doc-Konvention dieses Repos)
werden erkannt und ueber `graphify-out/graph.json` (Knoten tragen src+loc) zu Zeilenbereichen aufgeloest.
Ergebnis wird PERSISTIERT als `Task.surface{files, ranges, origin:"derived", at, sha}` statt je Poll
neu gerechnet. Erwartung (aus §2): 18 gate-aenderer-Zeilen werden wieder buendelbar; register.sh und
Waves-Tab lesen dasselbe Feld. Verify: Projektion auf dem heutigen fleet.json vorher/nachher, Pin auf
den Zitat-Fall.

**S2 — Kollision auf Bereichsebene.** `componentsOf` verbindet nicht mehr „gleiche Datei", sondern
„ueberlappende oder benachbarte (±40 Zeilen) Bereiche" oder gleiches Symbol. server.ts hoert damit auf,
alles mit allem zu verbinden. Post-hoc-Beleg ist billig: `filesTouched` + Hunks der gelandeten Lanes
gegen die Karte, Trefferquote in lane-outcomes.

**S3 — Die Karte per kleinem Modell.** Ein Extraktor ohne Repo-Zugriff (TEXT_ONLY) liest NUR den
Zeilentext und fuellt ein festes Schema: `{ziel: 1 Satz, rolle/model/effort, surface{files,symbols},
done: pruefbarer Satz, verify: Kommando, verboten[], program}`. Validierung deterministisch wie
refine-validate: Dateien in `git ls-files`, Symbole im Graphen aufloesbar, Verify aus der bekannten
Kettenliste, Program gesetzt — was nicht validiert, wird als Luecke am Feld markiert, nicht geraten.
Modell: **Haiku 4.5** (Strukturextraktion aus ≤10 KB Text, JSON, ~3k Tokens rein, ~0,5k raus, Sekunden);
der vorhandene enhance-Pfad (codex-spark) ist die Alternative, wenn Haiku hier nicht provisioniert ist —
mechanisch proben, nicht annehmen. **Opus 5 nur als Eskalation**, wenn ein Symbol nicht aufloest oder
done/verify fehlen und das Repo gelesen werden muss (= das heutige refine, aber mit erhaltener Struktur).
Fable bleibt Orchestrierung. Trigger: Tick auf jede neue/geänderte `auftrag`-Zeile ohne Karte,
Kosten je Zeile im Ledger.

**S4 — Struktur ueberlebt Bestaetigung.** `refineChildText` faltet nichts mehr zurueck; Kinder tragen
`done`/`verify`/`surface` als Felder. Der Wave-Brief zitiert die Karte, nicht `brief ?? text`.

**S5 — Bestaetigung als Batch der MAIN, nicht Klick des Owners je Zeile.** R3 bleibt (Owner-Entscheid
§7.1.3: kein Auto-Lift), aber die gebundene Program-MAIN bestaetigt die Karten ihrer eigenen Zeilen in
einer Aktion; die Wellen-Tuer bleibt Owner. Die 8 Zeilen ohne Program bekommen eines beim Filen
(Route-Default aus der Bindung des Filers).

**S6 — Schreibdisziplin an der Quelle.** Das Filing (`POST /api/tasks`) nimmt die Kartenfelder direkt an;
ein Fable-Orchestrator, der eine Zeile filt, fuellt sie beim Schreiben (er kennt Dateien und Symbole in
dem Moment). Der Extraktor ist dann Rueckfall fuer Zeilen aus Lanes und Notizen, nicht Normalfall.
Textvorlage: ZIEL · FLAECHE · DONE · VERIFY · VERBOTEN · ROLLE, je ein bis zwei Zeilen, Begruendung
dahinter. Das ist das „bessere effektivere Sprache"-Stueck: kuerzer, weil die Struktur die Prosa traegt.

Was das kauft: Wellen entstehen aus Feldern statt aus Klicks; jede Lane startet mit Karte statt
1,8–10,8 KB Prosa und spart die eigene Herleitung; die Spezifikation kostet Haiku-Sekunden statt
Opus-Minuten; Prosa-Zeilen werden kuerzer. Was es nicht kauft: mehr als 3 Lanes gleichzeitig (Deckel),
und keine Ersparnis an Suite-Zeit, solange der Second-host einen Slot frei hat.

Bezug zur Queue: Program Leichtgewicht f9dc8e10 traegt bereits Zeilen je Feld (60fff186 from ·
666d0b67 refine · df50b95b criterion · e0c1ba07 filesProposal) und 18802952 (Slot 1, Naehte mit
Zeilenbereich in den Brief). S1–S3 liegen davor und machen die Feld-Zeilen zu Konsumenten einer
Karte statt zu Einzelbauten; sie sollten nicht parallel dazu gefilt werden, sondern die Feld-Zeilen
umhaengen.

## 5. Nicht gemessen

Haiku 4.5 IST hier spawnbar: `claude -p --model claude-haiku-4-5-20251001 --tools ""` antwortete
16:3x mit „OK" (mechanisch geprobt, Kontrolle: der Aufruf lief mit `--setting-sources ""`). Ob der laufende Server
den Fix c42c5a65 (isolatedPreview-Klassifikation) enthaelt (Commit vor Boot, Binary nicht geprobt).
Die Trefferquote einer Bereichs-Kollisionsregel auf historischen Lands (Hunks liegen in den Land-Notes,
nicht im Outcome-Ledger; der Beleg ist ein eigener Lauf). Welche Slots die 12 Nudge-Fehler trafen.

---

## Ausführungsreihenfolge S1–S6 — festgeschrieben, weil sie sonst nur in einer Pane stand

Nachgetragen 2026-09-12 17:2x von der Program-MAIN Fleet-Betrieb (Slot 6, Program `f170dc46`).

Der Orchestrator hat die sechs Karten-Zeilen mit einer Abhängigkeitsordnung übergeben. **Gemessen:
keine der sechs Zeilen nennt ihre Vorgängerin im eigenen Text** (`grep` über alle sechs Texte nach
den sechs Ids: null Treffer). Die Ordnung existierte damit ausschließlich als Pane-Nachricht an
EINE Session — und eine Pane-Nachricht stirbt mit ihrer Insassin. Eine Nachfolgerin hätte S3 vor
S1 freigeben können, ohne etwas falsch zu machen.

| Reihenfolge | Id | Karte | wartet auf |
|---|---|---|---|
| 1 | `b2f439fe` | S1 — Flächen-Ableitung verwechselt Zitat mit Absicht | — (vom Orchestrator `queued`) |
| 2 | `9b691419` | S3 — Karte per kleinem Modell, ein Tick extrahiert | S1 gelandet |
| 3 | `ebfb7d71` | S2 — Kollision auf Bereichsebene statt Dateiebene | S1 gelandet |
| 3 | `a672b626` | S4 — Struktur überlebt die Bestätigung | S3 gelandet |
| 3 | `08ec67c0` | S6 — Kartenfelder beim Filen | S3 gelandet |
| 4 | `b8cb3c75` | S5 — Bestätigung der Fläche als Batch der Program-MAIN | S3 gelandet |

**Zwei Dinge, die zur Ordnung gehören und nicht in ihr stehen:** S4 und S6 hängen beide nur an S3
und sind Kandidaten für **eine Welle** — das ist vor der Freigabe an der Wellen-Projektion zu
prüfen, nicht anzunehmen. Und alle sechs tragen `spawn.model claude-opus-5[1m]`, `effort high`,
`harness null` (also claude-Default) — geprüft an `fleet.json`, nicht aus der Übergabe übernommen.

**Owner-Richtung dieses Tages, wörtlich:** „soll gleich laufen, ich will mich nicht weiter
kuemmern." Die Freigabe ist damit Sache der Program-MAIN, nicht eine Rückfrage — aber sie bleibt
**nach Landung der Vorgängerin**, nicht auf Sicht.
