---
frage: Traegt die Messnotiz docs/messungen/2026-09-04-context-pack-routing.md (Struktur-Teil) gegen den Code und das Manifest .fleet/context-packs.json, und wo kollidiert ihr Heilsplan mit dem Program-Lebenszyklus-Plan desselben Tages?
urteil: 5 von 8 Struktur-Behauptungen bestaetigt, 3 teilweise — keine widerlegt. Die zwei Teilweisen tragen Substanz: Luecke 1 zaehlt land-mechanics falsch (es WIRD gematcht und geliefert, nur nie quittiert) und ihr kleinster Schnitt verspricht einen Messwert, den der Code strukturell nicht liefern kann (task-queue faellt zusaetzlich als capability-missing, weil DISPATCH_CONTEXT_CAPABILITIES task-queue-read bewusst nicht fuehrt). Der undeklarierte Zustand ist zudem deklariert: e2e/pins.ts haelt eine DORMANT-Liste mit Owner-Vorbehalt. Kollision mit dem Lebenszyklus-Plan: zwei Symbole (handleSelfSucceed, programExecutionView); pi-ox und der Trigger-Schnitt sind kollisionsfrei und koennen zuerst landen.
bereich: [context-packs, messnotiz, program-lebenszyklus, e2e]
belege: [server.ts#DISPATCH_CONTEXT_TRIGGERS, server.ts#DISPATCH_CONTEXT_CAPABILITIES, server.ts#briefAndSend, server.ts#renderContextAnchorBlock, server.ts#landingAnchorBlock, server.ts#BOOTSTRAP_CONTEXT_TRIGGERS, server.ts#FLEET_CONTROL_CONTEXT_CAPABILITIES, server.ts#TARGET_REPO_CONTEXT_CAPABILITIES, server.ts#programMainContextFacts, server.ts#buildSuccessionBrief, server.ts#handleSelfSucceed, server.ts#succeedSupervisor, server.ts#bootstrapSupervisor, server.ts#succeedProgramMain, server.ts#bootstrapProgramMainReserved, server.ts#supervisorView, server.ts#programExecutionView, server.ts#openSlot, server.ts#openLaneInSlot, context-packs.ts#CONTEXT_PACKS, context-packs.ts#CONTEXT_PACK_HARNESSES, context-plan.ts#ContextPlanInput, context-plan.ts#contextOmissionFor, context-pack-validator.ts, .fleet/context-packs.json, e2e/pins.ts, e2e/context-plan.ts, e2e/programs.ts#contextReceipts, AGENTS.md, CLAUDE.md, docs/program-lebenszyklus-2026-09-04.md, docs/program-lebenszyklus-architektur-2026-09-04.md]
nicht-gemessen: alle Zahlen der Notiz (context-receipts.jsonl ist gitignored, nicht im Worktree — als Claims uebernommen); private-repo-j-/private-repo-p-Manifeste (fremde Repos, Dry-Run-Ergebnisse 3/5 bzw. 6/6 unbelegbar); context-pack-validator.ts nicht zeilenweise; keine Suite gefahren ausser bun e2e/pins.ts; rulebook/ liegt nicht im Worktree (gitignored — wie beauftragt nur AGENTS.md und die gerenderte CLAUDE.md-Kopie geprueft); src/client.ts nur per Symbolsuche; kein Live-Server, keine Pane, kein deployter Baum; Omissions-Render-Bytewirkung auf deliveredBytes nicht simuliert
stand: 2026-09-04
---

# Gegencheck Context-Pack-Routing-Notiz (GLM-Lane, 2026-09-04)

Read-only-Gegencheck der Struktur-Behauptungen von `docs/messungen/2026-09-04-context-pack-routing.md`
gegen HEAD des Lane-Baums. Zahlen aus `context-receipts.jsonl` sind Claims und wurden NICHT
nachgerechnet; alles Strukturelle wurde am Code verifiziert. Symbolverweise, keine Zeilennummern.

## Ergebnis — die acht Behauptungen

| Nr | Urteil | Beleg | Uebersehen |
|---|---|---|---|
| 1 | TEILWEISE | `server.ts#DISPATCH_CONTEXT_TRIGGERS` und `server.ts#BOOTSTRAP_CONTEXT_TRIGGERS` sind je hart `["always","verification"]`; `briefAndSend` (Lane-Dispatch) und `programMainContextFacts` (alle vier Gruendungs-/Succession-Naehte: `succeedSupervisor`, `bootstrapSupervisor`, `succeedProgramMain`, `bootstrapProgramMainReserved`) konsumieren sie. Nur `landingAnchorBlock` feuert `["landing"]` (harness literal `"claude"`) und schreibt bewusst keine Quittung (Kommentar begruendet: Quittungszeilen sind session-shaped). `context-packs.ts#CONTEXT_PACKS`: 6 Seeds, die genannten vier tragen landing/task-queue/harness-selection/deployment. | (a) „Vier von sechs nie gematcht" ist falsch fuer `land-mechanics`: es WIRD von `landingAnchorBlock` gematcht und an die zwei mutierenden Worker (Merge, Repair) GELIEFERT — es fehlt nur die Quittung. Richtig ist: an keiner SESSION-Naht gematcht, nie quittiert. Die Notiz sagt beides selbst und zaehlt dann trotzdem falsch weiter. (b) Der Zustand ist DEKLARIERT, nicht unentdeckt: `e2e/pins.ts` haelt die DORMANT-Liste `["task-queue","harness-selection","deployment"]` mit dem Kommentar „a seam Fleet has not built and the owner has not decided on" — jeder Fix ist Owner-Entscheid plus Pin-Update. (c) Capability-Dimension: selbst mit feuendem `task-queue`-Trigger faelle `task-queue` an der Dispatch-Naht als capability-missing — `DISPATCH_CONTEXT_CAPABILITIES` fuehrt `task-queue-read` bewusst nicht („a lane's scoped token cannot read the owner queue"); gleiches gilt fuer `private-deploy-overlay` (`deploy-observe` bewusst abwesend). Triggers allein liefern also nur `land-mechanics`. |
| 2 | BESTAETIGT | `server.ts#renderContextAnchorBlock`: `if (plan.selected.length === 0) return "";` — das ist die EINIGE Verwendung der Leere; keine Naht warnt, `sendText` erhaelt den Brief mit leerem Anker, die Quittung verzeichnet `selected: []` stumm. | Die Quittung TRAEGT die Leere bereits (`selected`, `omitted` sind Zeilenfelder) — „nichts meldet es" heisst korrekt: keine menschliche Flaeche zeigt es. Und die Leere ist fuer FREMDE Baeume richtig (alle Fleet-Seeds fallen source-unavailable): eine Null-Pack-Warnung muss „fremd, korrekt leer" von „Fleet-Baum, leer ueber Defekt" trennen — die Klassifikation (`dispatchSourceTree`) existiert, die Notiz nennt die Fallunterscheidung nicht. |
| 3 | BESTAETIGT | `.fleet/context-packs.json` → `rulebook-generat.harnesses` = claude, pi, pi-zai, pi-unfenced, container, codex — `pi-ox` fehlt; `messnotiz-index.harnesses` fuehrt es. `pi-ox` steht in `context-packs.ts#CONTEXT_PACK_HARNESSES`, `resolveContextHarness` behaelt es, also urteilt `contextOmissionFor` harness-unsupported. | Nichts Wesentliches. Nuance: der Fix ist ein JSON-Eintrag in einem getrackten Manifest, das bei jedem `bun e2e/pins.ts` erneut validiert wird — Wirkung entsteht aber erst am naechsten gequitteten HEAD nach dem Land, nicht beim Editieren. |
| 4 | BESTAETIGT (Zahlen als Claims) | `server.ts#TARGET_REPO_CONTEXT_CAPABILITIES = ["tracked-source-read","git-inspect"]`, in `programMainContextFacts` fuer frame `target-repo` gewaehlt. Leiter: fuer fremde Baeume fallen alle Fleet-Seeds vorher als source-unavailable; die Capability-Regel trifft NUR repo-deklarierte Packs — exakt der Notiz-Mechanismus. Der private-repo-j-Dry-Run (3/5 MAIN vs 5/5 Lane) ist nicht pruefbar (fremdes Repo). | Die 2-Capability-Snapshot ist KOMMENTIERTER Entscheid („a target repository gets a smaller honest capability set"), kein Versehen. Das eigentliche Problem ist unbenannt: das Capability-Vokabular ist Fleet-zentrisch (pure-validator-run/e2e-run meinen FLEETS Harnesses) — ein Ziel-Repo, dessen Verify-Pack `pure-validator-run` verlangt, meint seine EIGENEN Validatoren. Der Fix braucht eine Vokablar-Entscheidung ueber zwei Welten, nicht nur Praeflight-Ableitung. |
| 5 | BESTAETIGT | Route `GET /api/context-receipts` existiert (owner-only by position); kein Aufrufer in `src/client.ts` oder `public/`. `supervisorView`-Provenienz projiziert id/at/programId/taskId/slot/mode/deliveredBytes; `programExecutionView`-Receipts id/at/hash/repo/head/branch/slot/taskId/originId/mode/deliveredBytes — beide lassen `selected`/`omitted` weg. | Es gibt EINEN Leser: `e2e/programs.ts#contextReceipts` ruft die Route (Legacy-Zeilen-Check „byte-for-byte unchanged"). „Niemand liest" gilt fuer menschliche Flaechen, nicht fuer Maschinen. Zudem begrenzen beide Sichten den Payload bewusst („COUNTS ONLY, never row bodies") — ID-Listen je Zeile passen dazu, Koerper nicht. |
| 6 | BESTAETIGT | `AGENTS.md`: kein ContextPlan-/Pack-Vorkommen (einziger `pack`-Treffer ist „capture pack" des Sensory-Critic-Absatzes, unrelatiert); gerenderte `CLAUDE.md` im Worktree: null `pack`-Treffer; `rulebook/` existiert im Worktree nicht (gitignored, wie beauftragt ungeprueft). | Der Fix „Regelbuch-Fragment + AGENTS.md-Zeile" geht durch `rulebook.ts#RULEBOOK_FRAGMENTS` plus Re-Render — CLAUDE.md ist ein Generat und stirbt mit jeder Lane; der operative Schritt ist das Fragment plus Render-Owner-Akt, nicht die Datei. Die Notiz nennt das Verfahren nicht. |
| 7 | BESTAETIGT | `server.ts#buildSuccessionBrief` (generischer Zweig in `handleSelfSucceed`, nach Supervisor-/Program-Verzweigung): kein `planContext`, kein Anker, keine Quittung — nacktes `sendText`. `/api/slots/:id/open` → `openSlot`: kein Brief ueberhaupt. `POST /api/lanes` → `openLaneInSlot`: Worktree plus Pane, kein Plan, keine Quittung. | (a) `/api/slots/:id/open` sendet UEBERHAUPT keinen Brief — die Luecke dort ist „keine Zustellnaht", nicht „Brief ohne Packs"; schliessen heisst eine Gruendung erfinden, ein anderer Schnitt. (b) Der Pin „every context-receipt writer carries briefHash AND briefSource" zaehlt die Schreiber EXAKT (=== 5) — der Succession-Fix muss ihn auf 6 heben; die Notiz nennt ihn nicht. (c) Praezisierung zu „hoechste Authority kriegt nichts": die gebundene Program-MAIN-Nachfolgerin und der Supervisor-Nachfolger BEKOMMEN Packs — es trifft Controller/Steward/generische Succession und Lane-OEffnung. |
| 8 | TEILWEISE | Urteil D traegt: Waehler ist der Server — alle fuenf quittenden Naehte leiten Fakten aus Server-Konstanten ab, kein Program-, Client- oder Task-Eingang; `context-plan.ts#ContextPlanInput` = {sourceTree, harness, mode, triggers, capabilities}, keine Rolle. Der Anti-Studio-Befund (briefBlocks sind unquittierte Prosa) ist mit dem Code vereinbar. | Die Schnittbegruendung ist fehlerhaft: (a) Das Falsifikationskriterium „land-mechanics UND task-queue muessen in selected erscheinen" ist fuer task-queue unerreichbar (siehe Nr 1c: capability-missing trotz Trigger). (b) „Triggers zur Funktion des Akts machen" setzt einen Akt-Klassifikator voraus, den es nicht gibt — `Task` traegt keinen Akt-/Rollentyp (workflow-v2 §7 F4 benennt die fehlende typisierte Lane-Rolle). (c) Omissions-Render veraendert zugestellte Bytes an allen fuenf Naehten — rechtens, aber `e2e/context-plan.ts` assertet heutige Selektionsmengen exakt; mehrere Checks muessen mitgeschrieben werden, nicht nur erweitert. |

## Kollisionsflaeche mit dem Lebenszyklus-Plan

Beide Dokumente sind vom selben Tag und kennen einander nicht. Symbole, die beide anfassen:

- **`handleSelfSucceed` — Schnitt 4 (D3 Handoff am Program) gegen Luecke 7 (Succession durch
  Plan+Quittungs-Naht).** Schnitt 4 baut das Gate um (`handoffReady` → „git ODER Program-Handoff")
  und erweitert `buildProgramMainSuccessionBrief`; seine Verbote frieren `buildSuccessionBrief`
  explizit ein, und die Kollisionsmatrix sagt zu `handleSelfSucceed` „allein". Luecke 7 will genau
  die eingefrorene Funktion durch die Naht fuehren. **Zuerst muss Schnitt 4 landen** — er ist in
  einem gegengecheckten Plan mit Abhaengigkeit 3a sequenziert, und die Succession-Quittung danach
  rebase-t auf eine stabile Gruendungsform; umgekehrt muesste Schnitt 4 eine bereits umgebaute
  Naht anfassen und seine Ein-Lane-Form verlieren. Alternative (verwerfen): beides in eine Lane
  falten — Schnitt 4 liegt mit ~395 Zeilen schon an der Grenze.
- **`programExecutionView` — Schnitt 2 (D2-Projektion) gegen Einzeiler 3 (selected/omitted in die
  Sichten).** Schnitt 2 erweitert dieselbe View (status-Rails); Matrix-Regel „2 zuerst". Einzeiler
  3 muss NACH Schnitt 2 landen oder in ihn gefaltet werden (gleiches Feld, gleiche e2e-Familie
  `e2e/programs.ts`, ~15 Zeilen — Falten ist das Billigere). `supervisorView` fasst der
  Lebenszyklus-Plan nicht an; dort ist Einzeiler 3 frei.
- **`role`-Dimension gegen D1 Program-Inbox (Adressat).** Weicher, aber real: D1 macht das
  PROGRAM zum Adressaten alles Dauerhaften; die Notiz will „WER ist der Adressat" als Fakt an der
  Kontext-Naht. Eine vor D1 gepraegte Rollen-Vokabular waere eine zweite Adressat-Definition, die
  3a-i (Program-Datenmodell, Inbox) dann umdeutet. Die Kontext-Naht braucht die Rolle freilich
  nur als SESSION-Art (lane/main/supervisor/controller), und jede der fuenf Naehten kennt ihre
  Rolle schon durch die Funktion, in der sie steht — die Rollen-Dimension ist erst fuer
  repo-deklarierte Packs noetig, die per Rolle adressieren wollen. Konsequenz: **kein Warten auf
  D1 fuer eine reine Session-Rolle; aber die Vokabular-Entscheidung (Session-Rolle vs
  Program-Adressat) ist ein Owner-Akt und sollte MIT D1 gefaellt werden, nicht vorher nebenbei.**
- **Kollisionsfrei:** Der Trigger-Schnitt an `briefAndSend` steht in KEINEM Symbolverzeichnis des
  Lebenszyklus-Plans (geprueft gegen die Matrix in der Architektur); pi-ox ist reines Manifest.
  Gemeinsame Flaeche beider Werke ist nur `e2e/pins.ts` — dessen Disziplin („je Schnitt ein eigener
  Block am Ende, Rebase trivial") traegt das.

**Aussage, was zuerst landen muss:** pi-ox (sofort, kollisionsfrei, ein Eintrag), dann der
Trigger-Schnitt an `briefAndSend` plus Omissions-Render (kollisionsfrei zum Lebenszyklus-Plan,
darf parallel zu dessen Schnitt 1/2 laufen); Einzeiler 3 NACH Schnitt 2; Luecke 7-Succession NACH
Schnitt 4; die Rollen-Vokabular-Entscheidung MIT D1 3a-i.

## Kleinster Schnitt als Codex-Brief-Skizze

Beurteilung: **tauglich nach Korrektur des Falsifikationsversprechens** — und kleiner als die
Notiz denkt, wenn man task-queue aus dem Schnitt nimmt.

- **Dateien/Symbole:** `server.ts#briefAndSend` (Trigger-Ableitung statt Konstante — kleinste
  ehrliche Form: jede mutierende Lane-Dispatch traegt `landing`, denn jede Lane endet im
  Commit-und-Land-Footer; ein Akt-Klassifikator ist NICHT Teil dieses Schnitts),
  `server.ts#renderContextAnchorBlock` (Omissions-Abschnitt unter den Ankern),
  `server.ts#DISPATCH_CONTEXT_TRIGGERS` (faellt oder wird Fallback),
  `e2e/context-plan.ts` (Selektions-Checks neu), `e2e/pins.ts` (DORMANT/Trigger-Reichweite:
  die Pin bindet die drei Konstanten-NAMEN per Regex — verschwindet DISPATCH_CONTEXT_TRIGGERS,
  schlaegt die PROBE unter eigenem Namen an; Union bleibt {always, verification, landing}, DORMANT
  bleibt, aber die Pin-Regex muss die neue Form der Naht kennen).
- **e2e mit Mutation (`e2e/context-plan.ts` existiert):** die Checks „the delivery facts select
  the always + verification packs" (exakt portable-core,verify-e2e) und „each real omission names
  the first failed rule" (4 × trigger-not-matched) brechen und muessen fuer die neuen
  Dispatch-Fakten neu geschrieben werden; die Worker-Pfad-Checks bleiben gruen (Worker-Fakten
  unveraendert). Mutationstest: entferne die Trigger-Ableitung → die neuen Checks muessen ROT
  gehen (nicht tautologisch). Zusaetzlich ein Check, dass der Ankerblock bei leeren selected
  OMISSIONS-Liste rendert statt leerem String (Fremdbaum-Fall: weiterhin leer — die Trennung aus
  Nr 2).
- **Diff-Groesse:** server.ts ~50–70 Zeilen, e2e/context-plan.ts ~60–100, e2e/pins.ts ~10–20 —
  zusammen ~150–200 Zeilen. Passt in EINE Lane.
- **Was der Schnitt NICHT liefert (gegen die Notiz):** task-queue in `selected` — es faelle
  capability-missing. Das Falsifikationskriterium ist auf „land-mechanics erscheint auf
  Quittungen mutierender Lane-Dispatches und nirgends sonst; jede Null-Pack-Zustellung wird eine
  sichtbare Gruendeliste" zu korrigieren. Task-queue braucht einen eigenen Folge-Schnitt mit
  Capability-Entscheid (Owner: darf eine Lane `task-queue-read` haben? Nein, sagt der
  Quellkommentar heute — dann ist task-queue an der Lane-Naht bewusst unzustaellbar und gehoert
  auf MAIN-/Supervisor-Naehte, die FLEET_CONTROL_CONTEXT_CAPABILITIES fuehren).

## Drei Einzeiler

| Einzeiler | Datei · Symbol | Pin-Risiko | Groesse |
|---|---|---|---|
| pi-ox ins Manifest | `.fleet/context-packs.json` · `rulebook-generat.harnesses` | keins — die Manifest-Pin validiert gegen `CONTEXT_PACK_HARNESSES`, und pi-ox ist Mitglied; DORMANT-Check ignoriert harnesses | 1 Zeile |
| Null-Pack-Warnung auf Quittung/Board | `server.ts#supervisorView` (Provenienz: selected-Zaehler oder Flag je Zeile) plus `src/client.ts` (Board-Anzeige) | gering — keine Pin bindet die Provenienzfelder; Suppression der Fremdbaum-Leere noetig (Nr 2); NICHT in programExecutionView machen (Schnitt-2-Disziplin) | ~15–30 Zeilen |
| selected/omitted in die Sichten | `server.ts#supervisorView` (provenance.rows) und `server.ts#programExecutionView` (receipts.rows) | I13-Pin verlangt read-only-Projektion — Felder sind lesend, unproblematisch; ABER programExecutionView erst NACH Schnitt 2 des Lebenszyklus-Plans (Matrix „2 zuerst") oder in ihn gefaltet | ~15–30 Zeilen |

## Korrekturen gerankt (max 6)

1. **Falsifikationskriterium des kleinsten Schnitts korrigieren (Luecke 1/Urteil D):** task-queue
   kann mit Triggern allein nie in `selected` erscheinen — `DISPATCH_CONTEXT_CAPABILITIES` fuehrt
   `task-queue-read` bewusst nicht; gleiches gilt fuer private-deploy-overlay
   (`deploy-observe`). Der versprochene Messwert ist unerreichbar; Schnitt auf land-mechanics
   verengen oder Capability-Entscheid einschliessen.
2. **„Vier von sechs nie gematcht" ist falsch (Luecke 1):** land-mechanics wird von
   `landingAnchorBlock` gematcht und an Merge-/Repair-Worker geliefert — nur nie quittiert.
   Korrekt: „an keiner Session-Naht gematcht, nie quittiert". Der Unterschied zaehlt, weil die
   Notiz sonst Kosten nennt („Packs, die Landen beschreiben, erreichen die Sessions nie, die
   landen"), die fuer die zwei Worker falsch ist.
3. **DORMANT-Deklaration benennen (Luecke 1):** der Zustand ist in `e2e/pins.ts` deklariert
   (task-queue/harness-selection/deployment, „owner has not decided on") — jeder Fix ist
   Owner-Entscheid plus Pin-Update; die Notiz liest ihn als unentdeckten Defekt.
4. **Luecke 7 splitten:** `/api/slots/:id/open` sendet keinen Brief (Luecke ist „keine Naht",
   Loesung eine Gruendung), waehrend `buildSuccessionBrief` eine Naht ohne Plan ist; und der
   receiptWrites-Pin (=== 5) muss mit. Reihenfolge hinter Lebenszyklus-Schnitt 4 stellen.
5. **Luecke 4 um die Vokabular-Frage erweitern:** die 2-Capability-Snapshot ist kommentierter
   Entscheid; das Problem ist das Fleet-zentrische Capability-Vokabular ueber zwei Welten
   (pure-validator-run meint in private-repo-j dessen eigene Validatoren).
6. **Urteil D mit D1 verzahnen:** die Rollen-Vokabular-Entscheidung gehoert zum selben
   Owner-Akt wie D1 3a-i (Adressat-Begriff), sonst entsteht eine zweite Adressat-Definition; die
   Notiz ist ohne Kenntnis des Lebenszyklus-Plans geschrieben, obwohl beide denselben Tag und
   dieselben Nahten behandeln.

## Methode

Vollstaendige Lektuere der Notiz und beider Lebenszyklus-Dokumente; gezielte Code-Lektuere an den
Einstiegssymbolen (`briefAndSend`, `renderContextAnchorBlock`, `landingAnchorBlock`,
`programMainContextFacts`, `buildSuccessionBrief`, `handleSelfSucceed`, `supervisorView`,
`programExecutionView`, `openSlot`/`openLaneInSlot`-Routen); `context-packs.ts`, `context-plan.ts`
ganz; Manifest ganz; `e2e/pins.ts` an den ContextPack-Regeln (Trigger-Reichweite, Manifest-Pin,
receiptWrites-Pin) und `e2e/context-plan.ts` an den Dispatch-/Worker-Checks; AGENTS.md/CLAUDE.md
per Volltextsuche; ein read-only Graph-Query gegen den Main-Graph als Gegenprobe zur
Naht-Abdeckung (bestaetigt dieselben fuenf Nahte plus `landingAnchorBlock`). Server.ts (~24 600
Zeilen) nur in Ausschnitten.

## Was nicht gemessen wurde

Alle Zahlen der Notiz (503 Quittungen, 30 % Null-Pack, Omission-Histogramm, Harness-Mittelwerte,
private-repo-j/private-repo-p-Dry-Runs) sind als Claims uebernommen — das Ledger ist gitignored und liegt
nicht im Worktree. `context-pack-validator.ts` nur an den harnesses-Stellen gelesen. Keine Suite
gefahren ausser `bun e2e/pins.ts`; insbesondere `e2e/context-packs.ts` und der isolated-Tier nicht.
`src/helper.ts`, `helper-daemon/`, `pack-source-hash`-Zweig unberuehrt (GLM-Frage 5 bleibt
unverifiziert). Keine Live-Sitzung, kein Server-Roundtrip, keine deployte Instanz geprueft;
Wirkung des pi-ox-Eintrags auf kuenftige Zustellungen ist gefolgert (Manifest wird am gequitteten
HEAD gelesen), nicht gemessen.
