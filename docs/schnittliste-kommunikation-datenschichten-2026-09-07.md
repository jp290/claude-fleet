# Schnittliste Kommunikations- und Datenschichten — 2026-09-07

Kein Bericht: eine Rangordnung von Schnitten. Jeder Posten ist so geschrieben, dass er ohne
menschliches Nachlesen eine Queue-Zeile wird (Mechanismus, Kosten-Zahl mit Quelle, DONE, VERIFY).
Maximal acht Posten waren erlaubt; fünf stehen über der Linie, der Rest ist unter ihr benannt.

Messbasis: alle mit »gemessen 2026-09-07« markierten Zahlen stammen vom 2026-09-07 ~15:15 CEST aus
`fleet.json` (tasks, programs, slots, fleetReports, clarifications, attentionRequests, watches)
sowie `streams/prompts.jsonl` im Haupt-Checkout. Dispatcher-Messungen vom Vormittag sind als solche
benannt und wurden, wo möglich, nachgemessen. Zeilenverweise sind bewusst keine — Symbole roten
nicht; die Vorgabe »96 % Fehlschuss« für undatierte Zeilenverweise stammt aus dem Dispatch-Brief.

Rangprinzip: **still vor laut.** Ein Kanal, der fehlschlägt, ohne dass es jemand sieht, schlägt
teurer als einer, der 409 quittiert. M1 und M3 sind ein Paar: M1 ist die fehlende Tür, M3 der
Zustand, der laufend weitere verschlossene Türen erzeugt.

---

## Posten 1 — M1: Report-Abnahme hat keine Tür, die einen toten Receiver überlebt

**Mechanismus:** `server.ts#clarificationReceiverFor` löst den Empfänger aus dem lebenden Occupant
von `program.main` auf, `server.ts#decideFleetReport` vergleicht das volle Tripel
{slot, openedAt, sessionId}, und die einzige Route
`POST /api/self/fleet-report/:id/(accept|reject)` ist self-only — ein Retire der MAIN macht die
Abnahme dauerhaft unmöglich; dasselbe Empfänger-Auflösen gilt für Clarification-Antworten.

**Kosten heute: 14** — von 32 je eingereichten FleetReports sind 22 unentschieden und davon 14
per Receiver-Tripel **dauerhaft** unentscheidbar (gemessen 2026-09-07, fleet.json fleetReports ×
slots; nur 10 Reports wurden je entschieden: 8 accepted, 2 rejected). Nebenbelege, gleiche Messung:
10 von 10 Clarifications sind unbeantwortet, 6 davon mit totem Receiver; die Owner-Tür für
Attention funktioniert dagegen (19 von 21 beantwortet) — es fehlt genau die eine Tür für die
Report-Abnahme. Dispatcher-Messung 2026-09-07: 6 von 6 geprüften Sessions unschließbar,
dominanter Grund fehlende Route. Queue-Zeile **89279f1f** existiert bereits (pending, vier harte
DONE-Kriterien) — dieser Posten bestätigt ihren Rang, er verdoppelt ihn nicht.

**DONE:** Die vier Kriterien aus Queue-Zeile 89279f1f sind erfüllt (Owner-/Controller-Route
entscheidet Reports mit totem Receiver; Succession- und Retire-Pfade geprüft).

**VERIFY:** Nach Umsetzung zählt die Probe aus fleet.json Reports mit `decision === null` UND
totem Receiver zu **0** — jede der heutigen 14 Zeilen ist entschieden oder ausdrücklich
verweigert mit Begründung; Funktionsprüfung in der e2e-Familie `e2e/security.ts` (dort ist die
Route bereits gepinnt) plus `bun e2e/pins.ts`.

## Posten 2 — M3: Aktive Programs binden tote Occupants und sehen dabei lebendig aus

**Mechanismus:** `program.main` zeigt nach Occupant-Wechsel oder Retire weiter auf das alte Tripel;
`server.ts#programHealth` meldet das ehrlich als `unknown`, aber der Program-Status bleibt `active`
— nichts räumt die Bindung, also steht das Program aktiv in jeder Liste und kann nichts empfangen.

**Kosten heute: 7 von 14** aktiven Programs hängen an einem Occupant-Tripel, das zu keinem lebenden
Slot passt (gemessen 2026-09-07, fleet.json programs × slots). Betroffen heute u. a. die
Dispatcher-Geister 66499a03, cd110019, b2aa5b45 (weiterhin `active`); f99e9354 ist inzwischen
`complete`. Nebenbelege: zweimalige Fehlleitung des Controllers am 2026-09-07 (Dispatcher-Messung);
jede dieser Bindungen mit offener Lane ist eine werdende Posten-1-Sackgasse.

**DONE:** Kein Program mit Status `active` trägt ein `main`-Tripel ohne lebenden Slot-Match —
Retire und Occupant-Wechsel lösen oder aktualisieren die Bindung (für Succession tut das
`server.ts#succeedProgramMain` bereits; die Lücke ist der Retire-/Sterbepfad).

**VERIFY:** Die Fixture-Probe `programs × slots` (derselbe Dreizeiler aus der Messung oben, als
Check in `e2e/programs.ts`) liefert 0; live: `GET /api/programs` zeigt für alle aktiven Programs
`occupancy: live` oder Status ≠ active.

## Posten 3 — M4: Der Send-Kanal liefert per Paste ohne funktionierenden Räumweg

**Mechanismus:** `server.ts#sendText` liefert über `tmux paste-buffer` in die Pane und räumt den
Composer nicht selbst — ein belegter Composer wird vorher per `server.ts#readComposer` erkannt und
verweigert (`SendRefused`), aber ein Rest, der zwischen Prüfung und Paste entsteht oder Enter
überlebt, endet als `acceptance: not-observed`/`uncertain`; die beobachteten Räum-Tastenfolgen
(C-u, C-a, C-k, BSpace) erreichten den Composer einer zweiten Pane gar nicht (Dispatcher-Messung
2026-09-07).

**Kosten heute: 31 von 571** journierten Sends der letzten 7 Tage endeten `uncertain` oder
`unobserved` = 5,4 % aller Owner-/Controller-Nachrichten in Panes ohne angelieferte Gewissheit
(gemessen 2026-09-07, `streams/prompts.jsonl`, ts-Fenster 7 Tage). Der Fall vom 2026-09-07 14:12
steht als Zeile im Ledger (Slot 8, `uncertain`, 23-Zeichen-Text — deckt sich mit der Beobachtung
»composer still holds 24 chars after 3000ms«). Strukturkost darüber: jede Nachricht an eine MAIN
liest deren vollen Kontext neu, ~250–350k Tokens (Tilde, Dispatcher-Schätzung); gemessener
Extremfall ein Turn mit 195 000 Tokens ≈ 37 % des Session-Budgets, 1 h 09 min, überwiegend
Wiedereinlesen (Dispatcher-Messung 2026-09-07, Slot 4).

**DONE:** `sendText` räumt den Composer vor dem Paste deterministisch (oder der Räumweg ist für
jeden unterstützten Composer belegt), und `./acceptance-probe.sh` (ACP-25, Real-TUI) endet
`ALL PASS` auch mit vorgefülltem Composer.

**VERIFY:** `./acceptance-probe.sh` Tail `ALL PASS`; danach 7-Tage-Zählung über
`streams/prompts.jsonl`: `uncertain`+`unobserved` für Sends mit `source: owner` gleich 0 — jedes
verbleibende uncertain ist eine sichtbare 409-Quittung mit sendId, keine stille.

## Posten 4 — M2: Artefakte und Briefe zeigen in /tmp statt ins Repo

**Mechanismus:** Queue-Zeilen und Briefs landen über `server.ts#saveState` in `fleet.json` und
dürfen auf beliebige Dateisystempfade zeigen — nichts zwingt Artefakte ins Repo, und `/tmp`
verliert bei jedem Reboot den Inhalt, die Zeilen bleiben.

**Kosten heute: 20** Queue-Zeilen referenzieren `/tmp/astra-*`-Pfade, 18 davon `pending` —
alle 8 distinct Ziele existieren noch, also stirbt bei einem einzigen Reboot der volle Inhalt
aller 20 Zeilen auf einmal (gemessen 2026-09-07 ~15:15 CEST, fleet.json tasks, striktes
Pfad-Muster ohne Prosa-Erwähnungen; Dispatcher-Vormittagssnapshot: 14 Zeilen). Dispatcher-Befund
dazu: P1s Spec (412 Z.) und P2s Vertrag (514 Z.) lagen `-rw-------` unter /tmp (sha256 verifiziert),
Slot 3s C0–C5-Plan (16 690 B) ist nur als C0-Zeile gefiled — C1–C5 existieren nirgends sonst.

**DONE:** Keine `pending`/`queued`/`sent` Queue-Zeile referenziert einen `/tmp`-Pfad; die heute
noch lebenden 8 `/tmp/astra-*`-Dateien sind committet (Repo oder Messnotiz unter `docs/`), und die
Zeilen zeigen auf die Repo-Pfade.

**VERIFY:** Zähl-Probe über fleet.json tasks (gleicher Dreizeiler wie oben) ergibt 0 `/tmp`-
Referenzen in offenen Zeilen; `git log --oneline -- docs/` zeigt die Artefakt-Commits;
`bun e2e/pins.ts` für den docs-only-Anteil.

## Posten 5 — nicht in M1–M4: Die empfohlene Rückweg-Form ist die, die das OS totet

**Mechanismus (in M1–M4 nicht enthalten):** Die portable Warte-Regel (AGENTS.md, Invariante
»Monitoring is event- or terminal-driven«) empfiehlt für Zustände ohne getippte Route den
»one long-lived quiet wait outside the transcript« — genau diese Form wurde auf dieser Maschine
zweimal innerhalb einer halben Stunde vom OS wegen Speichermangels getötet (Notiz 0a8d2f13,
gemessen 2026-09-04), während die getippte Route `POST /api/self/watch` existiert und genutzt wird
(22 Watch-Zeilen in fleet.json, gemessen 2026-09-07).

**Kosten heute: 2** Waiter in 30 Minuten OOM-getötet (Messung 2026-09-04, Notiz 0a8d2f13 — eine
Notiz, kein Ledger; ausdrücklich dünnere Basis als Posten 1–4). Heute im 6-Stunden-Logfenster kein
frisches OOM-Ereignis, 32 % Speicher frei — der Posten lebt vom einmal gemessenen Mechanismus,
nicht von einer Rate. Ein still gestorbener Waiter ist der schlimmste Fall des stillen Kanals: der
Rückweg verspricht sicheres Warten und liefert Nichts, ohne dass jemand etwas sieht.

**DONE:** Die Warte-Regel (AGENTS.md-Absatz bzw. ihr Regelbuch-Fragment in `rulebook.ts`) nennt die
OOM-Messung 0a8d2f13 bei der Waiter-Empfehlung und ordnet die getippte Route vor den Waiter,
wo immer eine existiert; für Zustände ohne getippte Route schreibt sie Cadence und Stopp-Linie vor
statt eines unbegrenzten Prozesses.

**VERIFY:** Grep auf die geänderte Stelle (AGENTS.md bzw. gerendertes Regelbuch) findet die
Notiz-Nummer und die Reihenfolge-Vorgabe; `bun e2e/pins.ts` grün (AGENTS.md-Abgleich ist dort
bereits verdrahtet).

---

## Unter der Schnittlinie — benannt, ausdrücklich NICHT ausgearbeitet

- **Codex-Zombie-Prozesse** (Notiz 6a691420: 10 Prozesse, alt bis 7 d 16 h; heute 9 Agent-Binaries
  lebend). Maschinenhygiene ohne Kommunikationskosten-Zahl — kein Schnitt dieser Liste.
- **Branch-/Worktree-Rest** (Notiz 1d05c49b: jeder Lane-Auto-Close hinterlässt Worktree und Branch;
  heute 412 `fleet/*`-Branches, davon 396 bereits gemerged, bei 5 Worktrees auf Platte). Messbare
  Zahl, aber keine belegten Kosten in der Kommunikationsschicht.
- **Post-Land-Audits: 136 rot, 106 unknown von 518** (state.sh, 2026-09-07). Hat eine eigene
  Dok-Reihe (`docs/verify-tiering.md`); hier gäbe es keine neue Mechanik, nur eine Wiederholung.
- **Harness-inhärente Wiederelese-Kost** (~250–350k Tokens je MAIN-Nachricht): Der Extremfall ist
  unter Posten 3 verbucht; die Kost selbst zu senken ist ein Produkt-Eingriff (Adapter,
  Aufmerksamkeitsfenster), kein Schnitt mit Ledger-Zahl — ausdrücklich kein Posten.
- **TMPDIR-e2e-Schrott 1,7 G, 2 geleakte tmux-Sockets, 2 stray PIDs** (state.sh, 2026-09-07): die
  Hygiene-Sektion existiert bereits und druckt sie bei jedem Lauf.

## Schnittlinie

Geschnitten wird bei Mechanismen, die **beides** erfüllen: (a) heute eine Zahl aus Ledger oder
Messung, (b) sie blockieren oder zerstören den Fluss zwischen Owner, MAIN und Worker (Abnahme,
Adresse, Zustellung, Datenort, Rückweg). Die fünf Posten darüber erfüllen beides; Posten 5 als
schwächster mit einer Notiz statt eines Ledgers. Alles darunter ist Hygiene mit Zahl ohne
Kommunikationskosten, hat eine eigene Dok-Reihe oder ist harness-inhärent — benannt, damit die
Absenz sichtbar ist, nicht ausgearbeitet, weil ein Schnitt ohne Kostenzahl ein Portfolio-Eintrag
wäre.

## Mechanismen außerhalb M1–M4 — Bestandsaufnahme

Gefunden und über der Linie: Posten 5 (Rückweg-Form). Gefunden und unter der Linie: Zombie-Prozesse,
Branch-Rest. Weitere Kommunikations-/Daten-Mechanismen außerhalb M1–M4 wurden in den Ledger- und
Code-Quellen dieser Messrunde nicht gefunden — als Absenz festgehalten, nicht als Lücke: geprüft
wurden fleetReports, clarifications, attentionRequests, watches, tasks, programs, slots,
`streams/prompts.jsonl`, `state.sh` sowie die Routen in `server.ts` und `e2e/security.ts`.
