# Autonomy gap — was fehlt, damit Fleet vernünftig autonom läuft

*Brief für eine eigene Session, geschrieben 2026-08-05 nach dem Land von `500ff63`. Alle Zahlen
unten sind an diesem Tag aus den Ledgern gerechnet, nicht aus dem Handoff zitiert — sie sind
trotzdem als **Stand von heute** zu behandeln und neu zu rechnen, nicht zu übernehmen.*

## Der Auftrag

Herausfinden, **was heute noch fehlt**, damit die Kette ohne den Owner läuft — und zwar so
belegt, dass daraus Scheiben werden können. Nicht: eine Wunschliste. Jeder Befund nennt die
Datei/Zeile oder die Ledger-Zahl, aus der er stammt, und was er kostet, wenn er offen bleibt.

## Die Kette, wie sie heute wirklich steht

Task → Analyse-Worker → **Owner-Promote** → `tickDispatch` → Lane + Brief → Arbeit → auto-③ →
**Owner drückt ⏫** → Server-Rebase → (Konflikt → Autor wird geweckt) → Verify-Gate → Land →
Tier-2-Audit → **Owner deployt**.

Fett = ein Mensch schließt das Glied. Alles andere hat eine Maschine. Seit `500ff63` wählt
`tickDispatch` **ausschließlich** `queued`, und dorthin kommt eine Zeile nur durch den Owner —
das ist die bewusst gesetzte Autonomiegrenze, nicht ein Versehen. Der Auftrag ist NICHT, sie
aufzuheben, sondern zu klären, was sie tragfähig machen würde.

## Die fünf Bereiche, nach Wirkung geordnet

### 1. Deploy — das einzige Glied ganz ohne Maschine

**Befund.** Gelandeter Code ist nicht live, bis jemand `tmux -L claudefleet kill-session -t srv`
fährt und `bun run build` laufen lässt. Am 2026-08-05 meldete der Rundgang die Lücke um 15:55
(7 Commits Rückstand, Bundle 150 min alt) — behoben wurde sie um 22:12, und nicht wegen der
Meldung. `deployGap` und `bundleStale` werden bereits berechnet und reisen im Steward-Digest.

**Zu klären.** Was spricht dagegen, dass der Server sich nach einem Land selbst neu startet?
Der Watchdog respawnt srv ohnehin, sobald `has-session` fehlschlägt — der Restart ist also
schon heute die normale Betriebsart. Welche Läufe darf er dabei nicht zerreißen (der
Tier-2-Audit ist ein KIND des Serverprozesses; die Audit-Queue ist boot-resumend, aber der
laufende Lauf ist weg)? Ist `bun run build` automatisierbar, wenn es heute schon aus einem
uncommitteten Baum deployt — und was ist die sichere Form davon? Was ist der Rückweg, wenn ein
Auto-Deploy etwas Kaputtes live stellt?

### 2. Land-Auslöser und Serialisierung

**Befund.** 93 Outcome-Rows: **73 Lands**, davon **10 mit `confirmedByHuman: true`**, 68 mit
`verified: true`. `resolvedConflict` in 5 Rows, `resolvedBy` genau **einmal** geschrieben
(`author`, heute — der erste produktive Lauf des Autor-Pfads), `repairRounds > 0`: **nie**.
Auto-Land war als Entscheid #6 mit der Bedingung „erst echte Läufe ansehen" geparkt; heute gab
es einen vollständigen: Konflikt vom Autor gelöst, Verify grün, Provenienz-Note, Tier-2 rot,
aber test-only (siehe Bereich 5).

**Zu klären.** Welche Bedingungen machen ein Land auto-fähig — und lässt sich das aus den 73
Lands *belegen* statt behaupten? Wie sieht eine Land-Queue pro Repo aus (zwei gleichzeitige ⏫
haben ein Crash-Fenster, das Provenienz/Undo des Verlierers verlieren kann)? Und die Frage, die
man vor jeder Auto-Land-Diskussion beantworten muss: **`undo-land` gilt für genau EIN Land und
nur bis zum nächsten** (`server.ts`, grep `undoableFor`) — in einem autonomen Schub ist der
Rückweg weg, bevor ein Alarm eintrifft. Was tritt an seine Stelle?

### 3. Kollisionsvermeidung vor dem Spawn

**Befund, zweifach am 2026-08-05.** (a) Zwei Lanes bauten zeitgleich am Queue-/Task-Pfad; beide
fassten dieselben fünf Dateien an (`server.ts`, `src/client.ts`, `src/protocol.ts`,
`e2e/tasks.ts`, `e2e/security.ts`), die zweite kollidierte beim Land in vier davon. Die
merge-tree-Probe in BEIDEN Reihenfolgen ergab dieselben vier Konflikte — die Land-Reihenfolge
ist wirkungslos, entstanden ist der Konflikt beim **Spawnen**. (b) Drei Lanes wurden auf
dieselbe Task gespawnt, weil die Queue-Row keinen in-flight-Zustand hat: `dispatchTask` gibt
seinen Wächter im `finally` frei, während `briefAndSend` abgekoppelt weiterläuft und die Task
erst an dessen Ende `sent` wird — jeder der drei Klicks war regelkonform (Audit-Log
22:55:47 / 22:56:49 / 22:57:02, dazwischen ein `task_refine` um 22:56:09, das nur auf
`pending`/`queued` erlaubt ist und angenommen wurde).

**Zu klären.** `laneDrift()` (`server.ts:4854`) berechnet ein `overlap`-Feld — „files BOTH
sides touched" — und hat **genau einen Abnehmer**: die Route `/api/self/drift`
(`server.ts:7400`), die eine Lane über sich selbst fragen muss. Kein Tick, kein Board, kein
Dispatcher liest es. Der Analyse-Worker meldet Kollisionen (`eval-prompt.ts`, Regel „flag in
its reason if two tasks would collide on the same files"), aber nur innerhalb eines Batches
pending-Tasks, nie gegen **laufende** Lanes. Was fehlt konkret, damit >1 Lane unbeaufsichtigt
laufen kann? Der Refine-Job liefert seit heute die bisher fehlende Zutat: `RefineChild` trägt
ein `files`-Feld, also ist vor der Arbeit bekannt, was eine Task anfassen wird.

### 4. Die Sensoren, auf denen jede Automatik rechnet

**Befund.** Der Rundgang hat am 2026-08-05 gemessen, dass drei seiner vier Eingänge unzuverlässig
sind: `digest` kam über sieben Pulse **sechsmal null** (`DIGEST_TTL_MS` = 2 min bei stündlichem
Puls — der Cache kann nie treffen); `sinceLastLook` schlüsselt Lanes nach **Branchnamen statt
Repo** und meldete daraufhin „main wurde rewritten", weil zwei Repos einen Branch `main` haben;
`transcriptFact.mtime` ist **kein Aktivitätssignal** (etwas fasst jede Transcript-Datei
stündlich an, ohne ein Byte zu schreiben — elf Snapshots, Sekunde pro Datei fix im 3600-s-Takt).
Die drei Befunde liegen als Queue-Notizen (`94565a55`, `b759e8d9`, `9821035e`).

**Zu klären.** Welche Fakten würde eine autonome Schleife lesen — und welche davon sind heute
belastbar? Das ist der „nicht auf Sand bauen"-Bereich: eine Automatik, die auf einem Feld
entscheidet, das stündlich lügt, ist schlimmer als keine.

### 5. Wer konsumiert, was die Maschine produziert

**Befund, der unbequemste.** Fleet erzeugt viel korrektes Signal, das niemand liest:
- **36 Tier-2-Audits, 23 grün / 13 rot — keine einzige Adjudikation.** Es gibt kein Feld dafür
  (Row: `at, startedAt, ms, repo, main, mainSha, result, cmd, exitCode, out, covers`). Acht der
  13 Roten stammen zudem aus der Zeit vor der signal-first-Retention (`server.ts:3707-3724`) und
  können physisch nicht sagen, was fiel. Task `5a05080e` baut gerade das Feld.
- **Sechs Rundgang-Notizen an einem Tag, alle ungelesen.**
- **`dispositions.jsonl`: EINE Zeile in der gesamten Lebenszeit des ✨-Rails.**

**Zu klären.** Pro Mechanismus: was schließt die Schleife, und **woran würde man sehen**, dass er
konsumiert wird und nicht bloß läuft? Autonomie vervielfacht die Produktion — ein Kanal, der
korrekt meldet und nicht gelesen wird, ist kein Sicherheitsnetz, sondern ein Archiv.

## Gegengewicht — ausdrücklich Teil des Auftrags

Eine Session, die nur Lücken sammelt, kommt mit einer Wunschliste zurück. Deshalb gehört zum
Ergebnis auch:

- **Was NICHT automatisiert werden soll, und warum.** Der Konflikt-Pfad hält bewusst für Review
  an. `docs/attic/judge-calibration.md`: Vertrauen wird über Feuerproben gekauft, nie gewährt —
  und heute steht der Autor-Pfad bei n=1.
- **Welche Evidenz den nächsten Schritt rechtfertigen würde**: welche Zahl, über wie viele Läufe,
  mit welchem Stop-Kriterium. Ein Vorschlag ohne Schwelle ist eine Meinung.
- **Die Reihenfolge.** Prävention (3) macht vieles am Land-Pfad billiger; Sensoren (4) sind
  Vorbedingung für alles, was automatisch entscheidet. Nicht alles gleichzeitig.

## Arbeitsauflagen (beide haben heute den Unterschied gemacht)

1. **Aus den Ledgern rechnen, nicht aus Prosa.** `lane-outcomes.jsonl` (93 Rows),
   `post-land-audits.jsonl` (36), `audit.jsonl`, `fleet.json`. HANDOFF und `docs/` sind
   Behauptungen — die CLAUDE.md sagt das selbst. Zahlen in DIESEM Brief eingeschlossen.
2. **Vor jedem Befund prüfen, ob er schon behoben ist.** Am 2026-08-05 wären die abgeschnittenen
   Audit-Logs beinahe als neuer Fund gemeldet worden — Fix und Messung stehen seit Wochen als
   Kommentar in `server.ts:3707-3724`. Ein Befund, der einen vorhandenen Kommentar ignoriert,
   kostet Vertrauen in den ganzen Report.
3. Read-only arbeiten. Das Ergebnis ist ein Bericht plus Vorschläge für Scheiben — **kein Code**,
   kein Commit, kein Flip an einem Schalter.
