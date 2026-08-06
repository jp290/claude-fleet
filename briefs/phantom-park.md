# Der Phantom-Park: ein gelandeter Branch behält seinen „⏸ ungeprüft"-Vermerk

*Landkarte `docs/autonomy-map-2026-08-06.md` §9.1, Schritt 2 der Reihenfolge in §11.3. Die
Zeilennummern der Landkarte sind seit `2ada187` verschoben — der Mechanismus unten ist am
HEAD `2ada187` neu am Code nachgelesen, nicht aus der Landkarte zitiert. Prüfe ihn trotzdem
selbst; das hier ist eine Behauptung, bis du sie gelesen hast.*

## Der Fakt, live und heute nachweisbar

`fleet.json` trägt in `mergeParked` den Eintrag `fleet/260805151236-096a` mit
`status:"resolved"`, `landed:false`, `at 1785958194259` (05.08. 21:29:54) und vier
`conflicted`-Dateien. **Dieselbe Lane ist am 05.08. um 22:02:10 gelandet** —
`lane-outcomes.jsonl`, `disposition:"landed"`, `mainAfter 500ff63`. Ihr Worktree existiert
nicht mehr. Der Eintrag steht seit über zwei Tagen da und sieht aus wie ein offener
Review-Posten mit Handlungsaufforderung.

Prüfen (soll nach dem Fix für gelandete Branches leer sein):

```sh
jq -r '.mergeParked|keys[]?' fleet.json
jq -r 'select(.branch=="fleet/260805151236-096a")|[.ts,.disposition,.mainAfter]|@tsv' lane-outcomes.jsonl
```

## Der Mechanismus — die Reihenfolge ist die Ursache

In `landLane` (`server.ts`, grep `async function landLane`):

1. `removeWorktreeSafe(...)` — der Worktree ist weg
2. `mergeParked.delete(branch)` — mit dem Kommentar *„the branch is landed and gone — a
   parked ⏸ must not outlive it"*. Die Absicht ist also korrekt und ausdrücklich.
3. **`mergeLast` wird NIE geräumt** — das ist die Lücke
4. `await killSlot(s, "landed")`
5. `killSlot` ruft `parkMergeVerdict(s.id, false)`
6. `parkMergeVerdict` liest `mergeLast.get(slotId)` — dort liegt der `"resolved"`-Verdict
   noch —, bewertet ihn als `reviewable` und führt `mergeParked.set(m.branch, m)` aus

Schritt 6 macht Schritt 2 rückgängig, ~Millisekunden später. Der Eintrag ist danach
persistiert und überlebt jeden Neustart.

## Die Falle: der naheliegende Fix ist falsch

`parkMergeVerdict` ist **kein Bug** und der Aufruf in `killSlot` gehört nicht entfernt. Er
existiert für den echten Fall: ein reviewable Verdict soll überleben, wenn ein Slot seinen
Branch loslässt, und beim Reattach zurückkommen (Kommentar an `killSlot`:
*„follows its BRANCH into the park … and comes back the moment this"*). Wer den Aufruf
streicht, tauscht einen Phantom-Eintrag gegen echten Datenverlust.

Der Unterschied, an dem der Fix ansetzen muss: **ein gelandeter Branch kommt nie zurück.**
`killSlot` bekommt das schon gesagt — `landLane` ruft es mit `"landed"` als Grund. Diese
Information liegt also bereits an der richtigen Stelle und wird nur nicht benutzt.
Alternative Ansatzstelle: `landLane` räumt `mergeLast` für den Slot, bevor es `killSlot`
ruft. Welche der beiden richtig ist, entscheidest du am Code — nenne im Report, warum.

## Done heißt

1. Nach einem Land enthält `mergeParked` den gelandeten Branch **nicht**, auch nicht nach
   einem srv-Neustart.
2. Der legitime Pfad lebt: ein Slot, der einen reviewable Verdict hält und **ohne Land**
   geschlossen wird, parkt weiter und wird beim Reattach wiederhergestellt.
3. **Beide** Zusagen sind je durch einen Check gepinnt, der ohne den Fix rot wäre. Punkt 2
   ist der wichtigere Check — er ist der Grund, warum der einfache Fix verboten ist. Wenn
   die vorhandene Merge-Suite Punkt 2 schon abdeckt, benenne den Check statt einen zweiten
   zu bauen.

Die Check-Familie ist `e2e/merge.ts` (grep `mergeParked`, `parkMergeVerdict`,
`needsMergeReview`). Neue Checks gehören neben ihre Familie, nie ans Dateiende.

## Ausdrücklich offen — entscheide NICHT allein

Der **bestehende** Eintrag `fleet/260805151236-096a` wird durch einen Fix am Land-Pfad nicht
verschwinden; er liegt schon in `fleet.json`. Ob er per Einmal-Räumung beim Boot entfernt
wird (räumt auch künftige Altlasten, fasst aber Zustand an, den niemand geprüft hat) oder
von Hand, ist eine **Owner-Frage**. Bau den Fix, melde die Frage — räume nicht
unaufgefordert fremden persistierten Zustand.

## Rahmen

- Klein halten. Das ist ein Reihenfolge-/Zustandsfehler, kein Umbau des Merge-Pfads.
- Verify (Land-Gate): `bun install --frozen-lockfile` && `bunx tsc …` && `bun run build` &&
  `./e2e-clean-review.sh` && `./e2e-security.sh` && `./e2e-claude-gate.sh`. Dazu
  `./e2e-isolated.sh` als Stufe-2-Vorschau — dort lebt `e2e/merge.ts`, also ist sie hier
  **nicht** optional. Serien nie parallel fahren; ein rotes Ergebnis ist deins, bis du das
  Gegenteil beweist (erst denselben Baum erneut, siehe CLAUDE.md).
- `/api/self/gate` und `/api/self/drift` beantworten dir Gate und Drift live.
- Report: Slice, zitiertes Verify-Ergebnis, die Owner-Frage oben, und in einem Satz, an
  welcher der beiden Stellen du angesetzt hast und warum.
