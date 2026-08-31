# Plan: Queue-Refinement-System + Task-Dashboard (2026-08-11)

> Datierter Schnappschuss (2026-08-11): Zeilenverweise zeigen auf den Baum dieses Datums.

Owner-Auftrag (Session 2026-08-11, wörtlich sinngemäß): Die Task-Queue ist gebloatet (~60 offene
Zeilen, viele ohne merkbaren Implementierungsnutzen). Gewünscht ist ein System aus: **loser
Pool → Gruppierung nach Projekt/Prozess/Unterprozess → Refinement-Stufen** (simpel = direkt
durch; mittel = Lösungsvorschlag; groß = kollaborativer Workspace mit Kommentaren, Dokumenten,
verwandten Problemen, später Spezialisten-Agenten). Dazu ein **klares Task-Dashboard** statt der
heutigen flachen Liste. Git-Struktur und graphify-Graph sind die Daten-Layer fürs Einordnen.
Umsetzung durch **pi-/codex-Worker-Lanes**, eine Codex-MAIN-Session übernimmt die Orchestrierung
(Owner hat keine claude-Usage mehr).

Owner-Freigabe zur Reihenfolge: "Lass uns eins nach dem anderen angehen, angefangen mit dem
Task Dashboard." Grundriss unten wurde dem Owner vorgelegt; dieses Dokument ist die Übergabe.

## 1. Bestandsaufnahme — was schon existiert (geprüft am 2026-08-11)

Die Pipeline existiert in Embryo-Form; sie ist unsichtbar und teilweise aus:

- **Arten:** `Task.kind` = `auftrag | richtung | notiz | betrieb` (seit `dd0c9a8`, 2026-08-10).
  Nur `auftrag` ist freigebbar (409 sonst). → "nicht jede Zeile ist Arbeit" ist schon Datenmodell.
- **Analyse:** `tickAnalysisSweep` urteilt `ready | needs-you | unknown`, advisory.
  **AUS: `FLEET_ANALYSIS_MS=0`** (watchdog.sh:153, Config-Sensor bestätigt live=0). Folge:
  ~20 Zeilen `no-analysis`, fast alle Urteile `!head` (unverifiziert, nicht falsch).
- **Refinement:** `↻ refine` (`POST /api/tasks/:id/refine` + `refine-confirm`, schneidet in
  Kinder mit Done-Kriterium/Verify/`files`), `▸ clarify first` (Lane klärt Done-Kriterium,
  Owner bestätigt via `criterion-confirm`), Brief-Kompilierung editierbar (`POST /api/tasks/:id/brief`).
- **Kollisionsfläche:** dreiwertig (mechanisch/grob/modell, `register.sh` §2). **`Task.files`
  ist über 198 Zeilen 0× gesetzt** (einziger Schreiber: refine-confirm, server.ts:13952) —
  die mechanische Schicht fehlt praktisch komplett.
- **Bloat-Struktur, gemessen:** ~12 Zeilen sind `[idee scout-*]`-Skizzen vom 08-07 (formal
  Vorschläge, keine Aufträge), ein Block ist Meta-Arbeit über die Queue selbst, viele sind
  `needs-you` (warten auf Owner, nicht auf Bau).

### Offene Queue-Zeilen, die TEIL dieses Plans sind (nicht daneben bauen!)

| Zeile | Inhalt | Rolle im Plan |
|---|---|---|
| `c8e2ddd7` | NEUENTWURF Queue-Oberfläche, **owner-bestätigtes Kriterium liegt an der Zeile** | = Slice 2 (Dashboard). Kriterium ist der Bauplan. Park-Bedingung "nach kind-Umbau" ist seit `dd0c9a8` ERFÜLLT; zweite Bedingung "nach Token-Umbau `21c6eb4b`" vor Start prüfen (`git log --oneline | grep -i token` bzw. Queue-Zeile nachschlagen). |
| `8235c4bc` | Wellen-Gruppierung mechanisieren (advisory, nur Anzeige) | fließt in Slice 1+2 (Cluster/Wellen-Sicht) |
| `6d07877f` | `Task.files` 0/198 gesetzt — mechanische Fläche leer | = Kern von Slice 1 |
| `391a6cab` | DEFEKT: `reanalyse` ist bei ANALYSIS_MS=0 eine Löschung mit ok:true (server.ts:13886-13888) | Fix in Slice 3 |
| `684a9d99` | ENTSCHEIDUNG: Analyst aus + Dispatcher an = unattended-Invariante nicht in Kraft (server.ts:4269-4308) | Entscheidung in Slice 3 |
| `2940819d` | kind-Wähler fehlt im Client (Route `/api/tasks/:id/kind` existiert, kein Knopf) | in Slice 2 mitnehmen (kleines UI-Stück, fertiges Done-Kriterium + Verify steht an der Zeile) |

## 2. Zielbild: vier Stufen, eine neu

- **Stufe 0 — Pool** (existiert): Intake bleibt lose, `pending`.
- **Stufe 1 — Clustern (NEU, Fundament):** `Task.cluster = {projekt, prozess, unterprozess?}`
  pro Zeile. Ableitung zweischichtig, mechanisch vor Modell:
  - mechanisch: `files`/surface gegen graphify-Communities (`graphify-out/`, nur Haupt-Checkout!)
    und Verzeichnisstruktur mappen (server / client-ui / e2e-gates / docs / harness-adapter / betrieb).
  - modell: nur bei UNBEKANNTer Fläche urteilt ein Worker aus der Prosa — als Vorschlag
    markiert, nie als Fakt (dieselbe Dreiwertigkeit wie im Kollisionsregister).
  - Nebeneffekt: füllt `Task.files` → erledigt `6d07877f`.
- **Stufe 2 — Triage in Gewichtsklassen (halb neu):** advisory Verdict pro Zeile:
  - **S (direkt):** klares Kriterium, kleine Fläche, keine Kollision → Brief, dispatchbar
    (= heutiger ready-Pfad).
  - **M (Vorschlag):** Refine-Worker produziert Lösungsskizze + Schnitt, Owner bestätigt
    per Klick (= `↻ refine`, braucht nur sichtbaren Platz im Dashboard).
  - **L (Workspace):** großer Umbau → Diskussionsfläche: Thread pro Task (Owner, Team,
    später Spezialisten-Agenten), verlinkte Docs, verwandte Zeilen (die `collides`-Kanten
    sind der halbe Graph). **Einziges echtes Neuland.**
  - **verwerfen empfohlen (NEU):** die Triage darf "Implementierung nicht merkbar" sagen;
    Owner bestätigt das Löschen. Ohne diesen Ausgang wächst jede Queue nur. Adressiert den
    Bloat direkt.
- **Stufe 3 — Bearbeitung** (existiert): Dispatch → Lane produziert → Host committet
  (`POST /api/slots/:id/commit`) → Land über die Route.

## 3. Dashboard (Slice 2, der Owner-Startpunkt)

Gruppierung nach **Cluster**, innerhalb nach **Pipeline-Stufe** (Pool → geclustert → triagiert
→ gebrieft → läuft). Cluster-Karte: N Zeilen, Tier-Verteilung (S/M/L/verwerfen),
Kollisionsdichte, needs-you-Flag. Drill-in zeigt Zeilen mit Refinement-Zustand als Spalte.

**Das ersetzt `c8e2ddd7` nicht — es IST `c8e2ddd7`.** Deren bestätigtes Kriterium (an der
Zeile, `criterion.text`) gilt und sagt u. a.: die vier Zeilen-Fakten sind Verdikt · Alter ·
Slot · Quelle/Tag (Kommentarzahl ins Detail); Status-Gruppen bleiben Hauptachse; das
Pool-Modell kommt als EIGENER Schnitt danach. Heutige Fläche: `renderQueue()`
src/client.ts:5673-5754, `renderQueueDetail()` src/client.ts:5331-5672 (Zeilennummern von
Baum d046ceb — vor Gebrauch mit `rg -n 'renderQueue'` neu ankern).

## 4. Schnitte für Worker-Lanes (eine Lane = ein Schnitt)

1. **Datenschicht:** `Task.cluster` + mechanische `files`-/Cluster-Ableitung (Server + read-only
   Worker-Skript). Done: >80 % der offenen auftrag-Zeilen tragen cluster+files, register.sh §2
   zeigt sie als [mechanisch]/[abgeleitet]. Verify: `bun e2e/pins.ts` + neue Checks in
   `e2e/tasks.ts` + tsc-Zeile aus CLAUDE.md.
2. **Dashboard-UI** auf der Datenschicht, gegen das `c8e2ddd7`-Kriterium; `2940819d`
   (kind-Wähler) mitnehmen. Done: dessen DONE-KRITERIUM + Kriteriumstext von c8e2ddd7 erfüllt.
   Verify: `bun run build` + e2e/tasks.ts-Check aus 2940819d.
3. **Triage-Verdict + Verwerfen-Pfad + Analyst reaktivieren:** Entscheidung aus `684a9d99`
   treffen (Analyst wieder an — `FLEET_ANALYSIS_MS>0` braucht `launchctl kickstart` für
   watchdog.sh-Änderung!), `391a6cab`-Fix (reanalyse darf bei stehendem Sweep nicht löschen).
4. **Workspace/Thread für L-Tasks:** ZULETZT, einziges Neuland (Persistenz, wer kommentiert,
   Agenten-Zugriff). Vor Bau ein eigener Clarify-Durchgang (`▸ clarify first`).

Reihenfolge ist Abhängigkeit: 2 braucht 1; 3 ist unabhängig von 2, aber die Verdicts brauchen
die Datenschicht aus 1, um mehr als Prosa zu beurteilen.

## 5. Betriebs-Hinweise für die übernehmende Codex-MAIN-Session

- Erdung wie im Regelbuch: `./state.sh` · `./register.sh` · dieses Dokument · `HANDOFF.md` (oben).
- **Fremde Lanes können nicht committen** (`.git` read-only in der Sandbox): Lane produziert,
  Host committet via `POST /api/slots/:id/commit`, dann Land über die Route. Watch statt
  Polling: `POST /api/self/watch` (feuert auch auf host-commit-looking).
- **Codex-Dispatch-Boot-Race:** nach jedem codex-Dispatch die Pane prüfen
  (`tmux -L claudefleet capture-pane -p -t s<N> | tail`); leerer Composer → Brief per
  `POST /send {slot,text,submit:true}` nachschicken.
- **GPT-Briefing-Checkliste** (CLAUDE.md, Abschnitt "WENN DU EINE GPT-LANE BRIEFST"): Fenster
  258 400, Dateien MIT Zeilenbereich, Suiten-Output in Log-Datei, ein Schnitt kein Programm,
  Füllstand selbst melden lassen.
- Zeilen ohne hartes Done-Kriterium NIE direkt dispatchen — erst clarify/Brief-Schärfung
  (Owner-Vorgabe 2026-08-07).
- Queue-Zeilen dieses Plans beim Erledigen SCHLIESSEN bzw. per Dispatch-Knopf mit `slot`-Link
  fahren, damit das Ledger stimmt.

## 6. Offene Owner-Entscheide (vor Slice 3/4 einholen)

- Cluster-Achsen bestätigen (Vorschlag: projekt = repo; prozess = subsystem-community;
  unterprozess optional).
- Verwerfen-Verdict: nur Empfehlung + Owner-Klick (Vorschlag) oder Auto-Archiv nach Frist?
- Workspace-Scope: was genau darf ein Spezialisten-Agent im Thread (lesen/kommentieren/Briefs
  vorschlagen)?
