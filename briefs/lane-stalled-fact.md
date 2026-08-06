# `stalled` wird ein Fakt — die Flotte bekommt ein Wort für "diese Lane tut nichts mehr"

*Brief geschrieben 2026-08-06, aus der Autonomie-Prüfung derselben Session. Der Auftrag ist
ENG: ein deterministischer Fakt, nach einem Muster, das dieses Repo schon einmal ausgeführt
hat. Keine Aktion, kein Auto-Kill, keine Eskalation.*

## Der Befund, der ihn auslöst (gemessen, nicht behauptet)

`DIGEST_CONDITIONS` (`server.ts`, grep den Namen) führt sechs Lane-Zustände:
`healthy-running / done-looking / stalled-dirty / stuck-looping / awaiting-human / unknown`.
`.claude/commands/rundgang.md` weist den Steward an, für jede Lane zu fragen, **welchen Zustand
das DETERMINISTISCHE Signal zuweist** ("Not what you'd like it to be — what the signal says").

Nur EINER der sechs ist deterministisch. `done-looking` wurde nach `lane-signals.ts` gezogen,
und der Kopf dieser Datei sagt warum: *"The term existed only as an LLM label: DIGEST_CONDITIONS
lists it, and the digest worker is handed the rule in prose. An auto-trigger must not hang off a
model output when every input is already a server-side fact."* Für die anderen fünf wurde diese
Arbeit nie gemacht:

- `stuck-looping` ist per Prompt-Anweisung **unerreichbar** — der Digest-Prompt sagt wörtlich
  *"never claim stuck-looping unless the prior record already flagged it"*, und niemand flaggt es
  je zuerst.
- `stalled-dirty`, `awaiting-human`, `healthy-running`, `unknown` sind Prosa-Regeln im Prompt
  eines LLM-Workers, der über sieben Pulse **sechsmal null** lieferte (`DIGEST_TTL_MS` = 2 min
  bei stündlichem Puls — der Cache kann strukturell nie treffen).
- Und `stalled-dirty` deckt nur `git.dirty > 0`. **Der Fall, der die Flotte einfriert, hat gar
  keinen Zustand**: eine Lane mit `ahead === 0`, sauberem Baum, lebendig, die still steht.

Warum das teuer ist: `laneDoneLooking` verlangt `git.ahead > 0` (`lane-signals.ts`,
DONE_LOOKING_RULES). Eine festgefahrene Lane hat nichts committet — der einzige automatische
Beobachter der Flotte kann auf ihr also **strukturell nie feuern**. Einen Lane- oder
Session-Timeout gibt es nirgends im Code (alle Timeouts sind pro Subprozess). `awaiting:"owner"`
löst nur der Owner. Kill ist Owner-only: alle 18 beendeten Lanes im Ledger sind Owner-Klicks, es
existiert kein automatischer Kill-Pfad. Bei `FLEET_DISPATCH_MAX_LANES=2` heißt das: **zwei
hängende Lanes und der Dispatcher steht dauerhaft** — mit der Notiz "waiting: 2/2 lanes busy",
die sich wie gesunder Backpressure liest.

## Zu bauen

1. **Eine zweite Klausel-Liste in `lane-signals.ts`**, exakt nach dem Muster von
   `DONE_LOOKING_RULES`: jede Klausel trägt beide Hälften (`prose` für den Digest-Worker,
   `holds` für den Server), und die Prosa-Zeile wird aus derselben Liste KOMPONIERT — so können
   Spezifikation und Implementierung nicht auseinanderdriften, genau wie `DONE_LOOKING_PROSE` es
   heute schon macht. Vorschlag für die Klauseln, alle aus vorhandenen `LaneSignalView`-Feldern:
   lebendig (`alive === true`), still über der Schwelle, **nicht** done-looking, kein laufender
   git-Vorgang, kein blockierter/fehlerhafter Merge. Dieselbe Null-Disziplin wie nebenan: jeder
   unbekannte Fakt (`null alive`, `null git`, un-getickte `idleMs`) heißt **nicht** stalled —
   unbekannt ist nie eine Behauptung.
2. **Das Feld in `stewardSlotsView`** neben `doneLooking`/`doneLookingSince`, und ein
   `stalledSince` als Zeitstempel-Tier (Muster: `laneQuietSince`). `awaiting` wird hier
   abgezogen: eine Clarify-Lane, die bewusst auf den Owner wartet, ist **nicht** festgefahren —
   der Kommentar an `awaiting` in `stewardSlotsView` nennt genau diesen Fehlgriff als schon
   einmal passiert (2026-08-05, "lane looks stalled" über eine per Design wartende Lane).
3. **Die Schwelle** als eigene Env-Variable, Default **30 Minuten** (Owner-Entscheid
   2026-08-06). Begründung, die in den Kommentar gehört: eine Lane, die eine e2e-Suite fährt,
   schweigt regulär zehn Minuten am Stück; `AUTO_REVIEW_IDLE_MS` (60 s) ist die Schwelle für
   "fertig", nicht für "hängt".
4. **Den Digest-Prompt aus derselben Quelle speisen**, sodass `stalled-dirty` dort nicht länger
   eine Prosa-Regel ist, die der Worker frei anwendet.

## Nicht bauen (bewusst, mit Begründung)

- **Keine Aktion.** Kein Auto-Kill, kein Nudge, keine Eskalation, kein Tick. Die Hausdoktrin ist
  `record → display → advise → gate → act` (`docs/attic/autonomy-plan.md`, Axiom 2), und dieser
  Fakt betritt sie auf der ersten Stufe. Was mit einer festgefahrenen Lane geschieht, ist eine
  eigene, spätere Entscheidung — und sie braucht als Eingabe die Instanzen, die dieser Fakt
  überhaupt erst zählbar macht.
- **Keine Heilung von `stuck-looping`.** Der Zustand verlangt Transcript-Einsicht, die der
  Digest-Worker per Kontrakt nicht hat. Ihn zu behaupten wäre eine Diagnose statt eines Fakts.

## DONE

Die volle Verify-Kette aus `CLAUDE.md` grün, plus e2e-Pins für: eine Lane mit `ahead === 0`,
sauberem Baum und Stille über der Schwelle ist `stalled` **und** nicht `doneLooking`; eine Lane
mit `awaiting: "owner"` ist es NICHT; ein unbekannter Fakt (`alive: null`) ist es NICHT; und der
Digest-Prompt enthält die komponierte Prosa-Zeile, nicht eine handgeschriebene Zweitfassung.
Die Suite, die hier etwas beweist, ist `./e2e-isolated.sh` (Sektion um `done-looking`,
`e2e/review.ts` und `e2e/steward-core.ts`).

## Evidenz-Schwelle für den NÄCHSTEN Schritt

Bevor aus diesem Fakt je eine Handlung wird (Nudge, Eskalation, Auto-Kill): **mindestens 10
gezählte `stalled`-Instanzen, vom Owner adjudiziert**, davon höchstens 2 Fehlalarme. Ein
Detektor, der nie gefeuert hat, ist keine Wache — und einer, der dauernd falsch feuert, ist ein
zweites menschliches Gate. Das ist dieselbe Feuerproben-Regel wie in
`docs/attic/judge-calibration.md`; Vertrauen wird gekauft, nie gewährt.
