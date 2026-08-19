# Entscheid: die Kontext-Anreicherung bekommt einen Zweck und eine Erweiterungsfläche (2026-08-19)

Programm `441c0058` (Context Delivery Truth). Gelandet: `935fa6b`, `870593a`. Deployt: `3c5aa0c3`
auf `870593a4`. Dieser Record hält fest, was entschieden wurde und **womit es belegt ist** — der
Programm-Inhalt selbst ist seit `confirm` eingefroren und kann diese Begründung nicht tragen.

## 1. Der Ist-Stand, der den Entscheid ausgelöst hat (gemessen 2026-08-19)

- `.fleet/` existierte im Repo, **leer und untracked**; `.fleet/context-packs.json` fehlte.
- `server.ts` kannte einen frühen Return `if (preflight.frame !== "target-repo") return base;` —
  **Fremd-Repos durften ihre Anreicherung erklären, Fleet selbst nicht.** Der Dispatch-Pfad las
  überhaupt nie ein Manifest.
- 82 Receipts in `context-receipts.jsonl`: **72× exakt `(portable-core, verify-e2e)`**, 8 leer,
  1 Fremd-Pack `promise`, 1 Fremd-Repo mit vier `private-repo-e`-Packs. `task-queue` und
  `harness-adapter` starben **72× an `trigger-not-matched`** — Struktur, kein Zufall.
- Ein Pack hatte kein menschenlesbares Feld für „wann brauche ich das", nur Vokabulare.

Wichtig für die Deutung: die Fremd-Manifest-Naht **funktionierte bereits** (zwei Fremd-Repos wurden
nachweislich beliefert). Ausgeschlossen war nur Fleet selbst.

## 2. Was entschieden wurde

**(a) Jedes Pack trägt `useWhen`** — eine Zeile ZWECK, nie Inhalt. Pflicht auf `ContextPackBase`,
Validator-Code `USE_WHEN_INVALID` (string, kein `\r\n`, getrimmt 1..120). **Absenz bleibt legal**,
sonst bräche jedes vor dem Feld geschriebene Fremd-Manifest — Rückwärtskompatibilität ist hier ein
Datum, kein Defekt. Der Anker-Block wurde v2 (pro Pack genau eine Zweckzeile), und jede Quittung
nennt seit `935fa6b` ihren `renderer` — eine Zeile OHNE das Feld ist v1, per Datum, womit die
Behauptung „reconstruct every byte from the row" ehrlich bleibt.

**(b) Fleet liest sein eigenes Manifest.** Der frühe Return ist weg; beide Frames mergen Seeds +
Manifest über denselben Helper. Im Dispatch-Tail steht `integrationHead` jetzt VOR der Planung, damit
Manifest-Lesung und Receipt denselben Commit behaupten. **Ein Pack hinzuzufügen ist damit ein
getrackter JSON-Commit, keine TypeScript-Änderung mit Deploy** — und ein invalides Manifest kommt an
Stufe 1 des Land-Gates (`bun e2e/pins.ts`) nicht vorbei.

**(c) Die sechs Code-Seeds bleiben in `context-packs.ts` — bewusst.** Die naheliegende Fassung wäre
gewesen, sie ins Manifest zu migrieren (ein Mechanismus statt zwei). Dagegen: die Migration hätte
fünf Zustell-Nähte gleichzeitig umgebaut, und der Gewinn rechtfertigt dieses Risiko heute nicht.
Das Manifest ist die **Erweiterungsfläche**, nicht der Ersatz. Migration bleibt Kandidat, sobald die
neue Naht Betriebszeit gesammelt hat.

## 3. Was NICHT entschieden wurde — Owner-Entscheide, die offen liegen

- **Drei tote Trigger.** `task-queue`, `harness-selection`, `deployment` haben **null reichende
  Aufrufstellen** (gezählt: `always` 2×, `verification` 3× — davon eines ein Phantom, siehe §5 —,
  `landing` 1×). Der Trigger-Pin nennt sie seit `870593a` LAUT als ruhend. Entweder eine Naht reicht
  sie künftig, oder sie gehören aus dem Vokabular. Ein Pack auf diesen Triggern ist heute Regalware.
- **Payload-Headroom.** Der Check `sessions payload stays under 12 KB` hat auf dem gelandeten Baum
  ruhig+seriell nur **26 B Headroom** (12.262 von 12.288). Er kippt wieder. Diät oder begründete
  Kappen-Anhebung — eine Aussage über ein Budget, und die gehört dem Owner.
- **Eine neue Dauerregel, hier nur VORGESCHLAGEN** (Loader-Vertrag: vorschlagen ≠ promoten): „Ein
  Context-Pack wird über einen getrackten Commit an `.fleet/context-packs.json` hinzugefügt, nicht
  über TypeScript; ein invalides Manifest hält der Land-Gate in Stufe 1 auf." Ziel wäre ein Fragment
  in `rulebook/`. **Es wurde kein Fragment angefasst.**

## 4. Das rote Post-Land-Audit auf `935fa6b` — adjudiziert `flake`, mit Beleg

Das Audit maß 2686 ran / 1 failed: der Payload-Check bei **12.344 B**, gelaufen unter load 7–9 neben
fremden Suiten. Beweislauf nach `docs/verify-tiering.md` §11.7 (zuerst DENSELBEN Baum): eigener
detached Worktree auf **exakt `935fa6b`, dirty=false, seriell, load 2,02 → ALL PASS, 2686/0, exit 0,
Payload 12.262 B**. Nicht-Determiniertheit damit direkt bewiesen.

**Getrennt gehalten, was gemessen und was nur geschlossen ist:** zwischen der Fremd-Basismessung
`8ef2c00` (12.212 B) und `935fa6b` (12.262 B) liegen 50 B. Die sind **nicht attribuiert** — die Bäume
unterscheiden sich um mehr als dieses Land, und die Gegenprobe auf `935fa6b^` wurde bewusst NICHT
gefahren, um landenden Lanes die Maschine nicht wegzunehmen. Was belegt ist: der Land-Diff berührt
die `/api/sessions`-Route und ihre View-Builder nicht (nur Receipt-Nähte plus eine Konstante), und
`useWhen` fährt nicht im 2-s-Poll, sondern nur im zugestellten Block und im Ledger.

## 5. Zwei Lehren, die teurer waren als der Code

**Ein Pin darf nicht auf nackte Literale greppen.** Beim Zählen der reichenden Trigger-Aufrufstellen
zählte `"verification"` 3× — die dritte Fundstelle ist ein JSON-Schlüssel in einem
`WORKER_CONTRACTS`-Template, kein Trigger. Eine Zählung ist daran bereits einmal falsch geworden.
Der Trigger-Pin bindet darum an die drei benannten Aufrufstellen, nie an Literale: dieselbe Trennung
echte-Aufrufstelle-vs-Phantom, die das Regelbuch mit `ast-grep` meint.

**Bei einer verdächtigen Ledger-Zeile ZUERST alle Felder drucken, dann deuten.** Ein Post-Land-Audit
mit `ms: 126` und `checks: None` wurde von zwei Sessions unabhängig als Enthauptungs-Muster
(`docs/verify-tiering.md` §13) gelesen. Die Zeile trug ihre Erklärung selbst:
`out: "audit skipped: not the fleet repo"`, `exitCode: 42` — der dokumentierte Skip-Marker, erste
Stufe des `AUDIT_CMD` in `watchdog.sh:108`, für ein Fremd-Repo ohne `fleet-e2e.ts`. Das dreiwertige
Ergebnis hat exakt funktioniert: `unknown` statt eines falschen Grün. Beide Sessions hatten die Zeile
in der Hand und druckten nur die Felder, in denen sie die Antwort erwarteten. **`ms` allein trennt
einen sauberen Selbst-Übersprung nie von einer Enthauptung — der TEXT tut es.**

## 6. Was der nächste Leser prüfen sollte, bevor er hierauf baut

Zum Zeitpunkt dieses Records trug **kein Receipt `renderer:"v2"`**: seit dem Deploy hatte kein
Dispatch stattgefunden. Die Live-Wirkung ist transitiv belegt (die Suite bewies das Verhalten an
einer echten Server-Instanz, `bootHead == head` beweist den laufenden Code) — der direkte Beleg ist
der erste Receipt nach dem nächsten Dispatch. Er muss `renderer:"v2"` tragen und **drei** selektierte
Packs: `portable-core`, `verify-e2e` und `rulebook-generat` (letzteres auf Trigger `always`).
Bleibt er bei zwei, wird das Fleet-Manifest nicht gelesen.
