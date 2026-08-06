# Stop-Hooks als besserer Nullpunkt für die idle-Uhr — gerechnet und verworfen

*Geschrieben 2026-08-06, aus einer Owner-Konversation über fremde Harness-Architekturen
(T3 Code, tmux/cmux). Die erste Fassung dieses Dokuments war ein Vorschlag, sie war falsch,
und der Weg dorthin ist der Inhalt. Es bleibt ein **negatives Ergebnis**, damit die
naheliegende Idee nicht ein zweites Mal Arbeit kostet.*

## Was hiermit zu tun ist

**Nichts bauen.** Der einzige ausführbare Teil ist Prompt C ganz unten — zwei kleine,
verifizierte Korrekturen ohne jeden Bezug zum Rest.

Wer „lass uns Claude-Code-Hooks als Lane-Signal nutzen" vorschlägt oder vorgeschlagen
bekommt, liest §3. Wer die idle-Uhr verbessern will, liest §2 zuerst — dort steht, gegen
welchen Gegner das gehen muss.

## 1. Der Befund, der steht

`STALLED_RULES` (`lane-signals.ts`, grep den Namen) führt sieben Klauseln. Sechs sind
Fakten; **genau eine ist eine Uhr**, und der Code markiert sie selbst:

```
{ prose: "idle", holds: (v, t) => v.idleMs !== null && v.idleMs >= t, clock: true },
```

`idleMs` leitet sich aus `Slot.lastOutput` ab — dem Zeitstempel des letzten **Bytes im
Pane-Stream**, gesetzt in `poll()`. Das ist ein Fakt über den Bildschirm, nicht über die
Arbeit. So weit stimmt die Beobachtung, mit der dieses Dokument angefangen hat.

## 2. Der Feind dieser Uhr ist bereits benannt — und es sind nicht Repaints

Der Kommentar direkt über `STALLED_IDLE_MS` (`server.ts`, grep den Namen) sagt es
vollständig, und meine erste Fassung hatte ihn übersehen, obwohl sie die Konstante zitierte:

> *„EVERY RESTART RESETS EVERY LANE'S IDLE CLOCK. The deploy ritual is `tmux kill-session -t
> srv`, ~10×/day … a lane only ever reaches this threshold if it survives a restart-free
> 30-minute window. The bias therefore runs one way only — DOWNWARD, never up … which is the
> right trade for an accusation-shaped fact."*

Drei Folgerungen, die jede Verbesserung der Uhr binden:

- Der dominante Falsch-Negativ-Mechanismus ist der **Deploy-Neustart**, nicht das Repaint.
  Bei ~10 Neustarts/Tag und 30-Minuten-Schwelle liegt er um Größenordnungen darüber.
- Die Schiefe ist **gewollt**: lieber verpassen als beschuldigen. Ein neuer Nullpunkt, der
  die Uhr in Richtung „feuert öfter" kippt, macht den Fakt nicht besser, sondern kaputt.
- Für das Zählen gilt derselbe Kommentar: *„the count is a floor, not a measurement, and it
  is furthest below the truth exactly on the busiest deploy days."* Das bindet die
  vorregistrierte Feuerprobe aus `briefs/lane-stalled-fact.md` (10 adjudizierte Instanzen,
  ≤2 Fehlalarme) — wer zählt, schreibt die Schwelle daneben.

## 3. Warum ein `Stop`-Hook es schlechter macht — die Rechnung

Die Idee war: `Stop` liefert „der letzte Turn des Agenten endete um T", ein Fakt über den
Agenten statt über den Bildschirm, den kein Repaint zurücksetzt. Der erste Teil stimmt.
Der Schluss daraus ist falsch, und zwar aus einem Grund, der sich in einer Zeile zeigt:

**`Stop` markiert das ENDE eines Turns, nicht Aktivität.** Turn 1 endet um T1. Turn 2 startet
und läuft produktiv 40 Minuten. In dieser Zeit feuert `Stop` nicht. „Zeit seit dem letzten
Stop" ist also ≥ 40 min — auf einer **arbeitenden** Lane. Die Uhr kann „steckt fest seit 40
min" und „arbeitet seit 40 min" strukturell nicht trennen; genau die Trennung war der
behauptete Gewinn.

Und das ist nicht der Randfall, sondern der Normalfall dieser Flotte. Eigene Auszählung von
`lane-outcomes.jsonl` am 2026-08-06 (104 Zeilen, read-only):

| | |
|---|---|
| Lanes mit ≤1 Owner-Prompt | **92 von 104** |
| Sessions länger als 30 min | **71 von 94** (mit `sessionMs`) |
| Median-Session | **67,8 min** |
| `STALLED_IDLE_MS` | 30 min |

Eine dispatchte Lane arbeitet im Median gut eine Stunde in ein bis zwei Turns. Eine Klausel
„Zeit seit letztem Stop ≥ 30 min" würde damit die **gesunde Median-Lane** als `stalled`
markieren — und die in §2 bewusst gewählte Schiefe umkehren: aus „verpasst manche" würde
„beschuldigt fast alle". Als Zählgrundlage für die 10-Instanzen-Feuerprobe wäre das wertlos:
die Schwelle wäre an einem Tag erreicht und hätte nichts gemessen.

Reparabel wäre es nur mit einem **zweiten** Signal — Turn-Start (`UserPromptSubmit`) oder
ein turn-interner Herzschlag (`PostToolUse`) —, damit „kein Turn in Flug UND letzter Turn
endete vor ≥ T" überhaupt formulierbar wird. Damit ist es keine kleine Änderung mehr,
sondern zwei Hooks, eine Konfiguration pro Worktree, eine neue Route und ein
Migrationsproblem für bestehende Lanes.

**Nebenbefund, der eine geplante Messung erledigt hat:** diese Maschine hat in der privaten
`~/.claude/settings.json` des Owners bereits `PreToolUse`, `PostToolUse` **und `Stop`**
registriert, und `HANDOFF.md` führt das Feuern in Fleet-Sessions als Tatsache. „Feuert `Stop`
interaktiv?" war nie offen. Eine Sonde hätte einen bekannten Fakt gemessen — und sie wäre
auch nicht isolierbar gewesen, weil Nutzer-Settings in einem Scratch-Verzeichnis mitgelten.

## 4. Die naheliegende Alternative ist ebenfalls vergeben

`transcriptFact` (`server.ts`, grep den Namen) liefert `{bytes, mtime}` und steht in
`stewardSlotsView` bereits **neben** `stalled`. „Zeit seit dem letzten Transkript-Eintrag"
sieht in beiden Fehlerklassen besser aus als beides: repaint-immun (ein TUI-Repaint schreibt
keine JSONL-Zeile) und turn-intern fortschreitend (jedes `tool_result` ist eine Zeile).

Sie ist trotzdem nicht frei. `docs/autonomy-map-2026-08-06.md` §6.3 führt genau dieses Feld
als offenes Item — *„`mtime` reist als zweites Feld mit und lädt zur Aktivitätslesart ein"* —
mit der Kostenzeile *„Sobald ein Prädikat es liest, ist es die teuerste Sorte Fehler, weil
das Feld stündlich ‚frisch' wird, ohne dass etwas passiert ist"*, und die Landkarte verordnet
dort „`mtime`-Caveat oder Feld entfernen". Wer diesen Weg nimmt, übernimmt zuerst 6.3.

## 5. Was daraus folgt

Aus diesem Dokument entsteht **keine Lane**. Die zwei offenen Fäden existieren bereits und
haben ihre eigenen Dokumente: Karte §6.3 für den `mtime`-Caveat, `briefs/lane-stalled-ledger.md`
fürs Zählen. Neu ist hier nur die Widerlegung in §3 — damit sie nicht neu hergeleitet wird —
und die Kopplung aus §2, die neben jede Zählung gehört.

Die Reihenfolge bleibt, wie das Haus sie ohnehin führt: **erst zählen, dann urteilen, dann
reparieren.** Solange keine adjudizierten Instanzen existieren, ist unbekannt, ob die Uhr
überhaupt der Defekt ist.

---

## Prompt C — zwei unabhängige Kleinigkeiten (jederzeit, ohne Bezug zum Obigen)

> Kleine Lane, zwei getrennte Commits.

```
Zwei kleine, voneinander unabhängige Korrekturen. Zwei getrennte Commits, keine Nebenarbeiten.

(1) FEHLENDE LEDGER-ZEILE auf dem unbeaufsichtigten Dispatch-Pfad.
Der Hand-Knopf schreibt audit("task_dispatch", …) mit der Task-id (server.ts, grep
"task_dispatch"); der Kommentar an der Event-Union benennt den Unterschied ausdrücklich
("distinct from the tick's spawns"). tickDispatch/briefAndSend schreiben nur console.log.
PRÄZISE: der Branch selbst ist NICHT verloren — er steht persistiert auf der Task-Zeile
(next.note = `lane <branch>`, nach dem Land t.note = `landed (<branch>)`), und LaneOutcome
.briefHash joint auf den Gründungsbrief. Die Lücke ist enger: es gibt auf dem Auto-Pfad
keine Ledger-Zeile, die die Task-ID trägt. Formuliere den Fix gegen diese engere Aussage.
Done: eine Ledger-Zeile mit der Task-id existiert auch auf dem Auto-Pfad, und ein e2e-Check
beweist es (heute gibt es dafür keinen — prüf das nach, statt es zu glauben).
ANGRENZEND, NICHT DEINS: docs/autonomy-map-2026-08-06.md führt separat, dass land/merge/
deploy/drift gar keine Audit-Events haben. Größeres Item; bau es nicht mit, verweise darauf,
wenn sich die Lösungen berühren.

(2) TOTE ZAHL in der Doku.
docs/data-saver.md trägt an genau drei Stellen "112 410 B" für /api/sessions. Die Messung ist
überholt, seit der Poll nur noch taskDigest ohne Volltext projiziert (server.ts, grep
taskDigest). MISS ES SELBST, statt eine Zahl zu übernehmen. Schreib deine eigene Messung mit
Datum und Methode dazu und markiere die alte ausdrücklich als überholt — nicht löschen, sie
erklärt einen historischen Vorfall. Weicht deine Messung von der Erwartung ab, gilt deine.
```

## Was hier bewusst nicht steht

- **Kein Auftrag, das Transkript-Lesen abzusichern.** Die These „das JSONL-Format ist laut
  Anthropic instabil, also sind wir exponiert" wurde in derselben Sitzung aufgestellt und
  widerlegt: `viewEntry` liest die Messages-API-Wire-Form, echte CC-Interna sind nur
  `isMeta`/`isSidechain` als Rausch-Filter, und jede Lesestelle degradiert nach ABSENT statt
  nach FALSCH. Die reale Kopplung ist der **Pfad**, nicht das Eintragsformat.
- **Keine Aussage, Hooks seien für Fleet generell wertlos.** Es bleibt richtig, dass sie für
  eine *interaktive* Session der einzige offizielle strukturierte Ereignisstrom sind
  (`stream-json` und die Agent SDK sind print-mode-only). Falsch war der Schluss, dass daraus
  ein besserer Nullpunkt für **diese** Uhr wird. Wer sie für etwas anderes will, fängt bei
  §3 an und rechnet seinen eigenen Fall durch.
