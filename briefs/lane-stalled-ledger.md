# `stalled` zählbar machen — ein Instanz-Ledger

*Geschrieben 2026-08-06 von der Lane, die `stalled` gebaut hat, auf Nachfrage zu einem Befund.*
**Das ist ein VORSCHLAG, kein Beschluss.** Das „Ob" gehört dem Owner — hier steht nur, was am Code
geprüft ist, wo die Kante läge und woran die naive Fassung scheitern würde. Nichts davon ist
gebaut, und nichts davon sollte gebaut werden, bevor der Owner es will.

## Warum das offen ist (geprüft, nicht behauptet)

`briefs/lane-stalled-fact.md` setzt unter „Evidenz-Schwelle für den NÄCHSTEN Schritt" die
Bedingung: **mindestens 10 gezählte `stalled`-Instanzen, vom Owner adjudiziert, höchstens 2
Fehlalarme**, bevor aus dem Fakt je eine Handlung wird. Diese Schwelle hat heute keinen
Mechanismus, erfüllt zu werden.

Der strukturelle Beweis ist kurz: `laneStalled`/`laneStalledSince` haben genau zwei Aufrufstellen,
beide in `stewardSlotsView` (`server.ts`, grep die Namen). Diese Funktion hat drei Konsumenten —
den Digest-Prompt-Bauer und zwei GET-Routen. Keine der acht `appendEvent`-Stellen im File berührt
den Wert. Nichts sonst im Prozess berechnet ihn, also kann ihn nichts sonst schreiben.

Die sechs Senken einzeln, weil „irgendwo wird es schon stehen" die teure Annahme wäre:

- **audit.jsonl** — die `AuditEvent`-Union ist geschlossen (grep `type AuditEvent`), und jedes
  Mitglied ist eine **Handlung**: `slot_open`, `slot_kill`, `steward_send`, `task_dispatch`,
  `auto_fire`, `criterion_confirmed`, Auth-Fehler. Kein einziges ist eine Zustands-Probe, und
  `audit()` wird nur an Handlungsstellen gerufen, nie aus einem beobachtenden Tick.
- **steward-journal.jsonl** — die naheliegendste Kandidatin, und sie ist zwei Dinge, von denen
  keines eine Instanz ist. `counts` ist **pane-behauptet**, der Code sagt es selbst („the pulse
  supplies its own judged counts"): freie Schlüssel, ≤12, nie gegen `DIGEST_CONDITIONS` validiert
  — und ein Aggregat (`{healthy-running: 3, stalled-dirty: 1}`) **ohne Lane-Identität**, man könnte
  also auf keine Instanz zeigen, um sie zu adjudizieren. `lanes: await laneFacts()` ist zwar
  server-berechnet und server-gestempelt, aber `LaneFact` ist `{head, base, landed, repo}` — ein
  Commit-Cursor für „was hat sich seit meinem letzten Blick geändert". Kein Zustand, kein idle.
- **lane-outcomes.jsonl** — terminal. Eine festgefahrene Lane, die gekillt wird, schreibt
  `disposition:"killed"`, ununterscheidbar von jedem anderen Kill.
- **dispositions.jsonl** — Owner-Urteile über *Worker-Ausgaben*, gekeyed auf `ref`+`worker`.
- **post-land-audits.jsonl / audit-adjudications.jsonl** — Tier-2-Ergebnisse und deren Beurteilung.

Und das Label des Digest-Workers, die einzige Stelle, an der das Wort je als Urteil auftaucht,
lebt in `let digestCache` — **nur im Speicher**, `DIGEST_TTL_MS` 2 min gegen einen stündlichen
Puls (der Cache kann strukturell nie treffen) und tot bei jedem der ~10 täglichen Neustarts.

## Die Einordnung: das ist `record` — und der Fakt steht heute darüber

Axiom 2 (`docs/attic/autonomy-plan.md`), wörtlich: *„**Record → display → advise → gate → act.**
Every judging instance climbs by measured hits, never by being built. ② is at *record*. ③ is at
*display*."* „Record" hat hier also eine konkrete Bedeutung, und shadow-② ist der Präzedenzfall:
es schrieb sein Verdict in die Outcome-Zeile und gatete nichts. **Das Urteil aufschreiben und auf
nichts handeln IST die erste Stufe.** Ein Instanz-Ledger ist genau das.

Es ist nicht die nächste Stufe: `advise` ist die erste, die unaufgefordert Owner-Aufmerksamkeit
kostet (ein Section-1-Kandidat, ein Chip). Ein Ledger, das niemand vorzeigt, kostet keine.

Die schärfere Lesart: `stalled` steht heute auf *display*, ohne je auf *record* gewesen zu sein —
die Stufe wurde übersprungen. Axiom 3 benennt diesen Fehlermodus direkt: *„No judging or measuring
layer without its feeder in the same move. Unfed mechanisms are this project's recurring defect
(`enhance` starved, `outcomeTally` empty, `harmAttestAt` 0)."* Die Evidenz-Schwelle ist ein
Mess-Layer, das Instanz-Ledger ihr Feeder, und beide wurden nicht in derselben Bewegung gebaut.
Auf der jetzigen Bahn tritt `stalled` dieser Liste namentlich bei.

## Die Schreib-Kante — drei Kandidaten, einer abzulehnen

- **Der bestehende Steward-Read.** Null neue Maschinerie, und trotzdem der falsche: das Sampling
  wird eine Funktion davon, *wer zufällig hingesehen hat*. Die Leser sind der stündliche Rundgang
  plus manuelle Aufrufe. Eine Lane, die zwischen zwei Pulsen festfährt und sich wieder fängt, wird
  nie erfasst — „10 Instanzen" würde dann Polling messen, nicht Stillstand, mit unbekanntem Nenner.
  **Abzulehnen.**
- **Ein neuer Tick.** Ehrlich, aber ein neuer Dauer-Timer.
- **Huckepack auf `tickGit`** (10 s) — er berechnet ohnehin schon `gitInfo`/`aliveInfo`/`gitOpInfo`
  für jeden Slot, also exakt die Eingaben des Prädikats, und sie sind in genau diesem Moment am
  frischesten. Kein neuer Timer, keine zusätzlichen git-Aufrufe. **Die kleinste Kante, die
  Realität statt Aufmerksamkeit misst.**

## Flattern — der harte Teil, nicht das Dateiformat

Das Prädikat ist LEVEL-getriggert: `stalled` bleibt wahr, solange die Lane still und `ahead === 0`
ist. Ein naives „schreib eine Zeile, wenn wahr" bei 10 s Takt erzeugt 360 Zeilen pro Stunde und
Lane. Zeilen müssen **Episoden** sein, keine Proben.

- **Anker.** Das `since` der Episode ist `stalledSince` — schon berechnet, schon null-diszipliniert,
  und es ist der Moment des Stillwerdens, nicht der des Schwellen-Übertritts. Der richtige Anker.
- **Die fallende Flanke ist, wo das Flattern sitzt.** Ein einzelnes Byte — ein Repaint, ein
  Shell-Geräusch — setzt idle zurück, würde die Episode schließen und beim nächsten Stillstand eine
  neue öffnen. Dass ein Byte nicht zwingend Arbeit ist, weiß das Haus eine Ebene tiefer bereits:
  `quietUntil` existiert für genau diese Klasse. Also: erst nach einem **Dwell** durchgehenden
  Nicht-stalled schließen, und ein erneutes Überschreiten innerhalb des Dwells **verlängert
  dieselbe Episode**, statt eine neue zu öffnen.
- Derselbe eine Regler deckt die anderen Flatterquellen mit ab — `ahead` 1→0 nach einem
  `reset --hard`, `awaiting` das kippt, `alive` das flackert — weil er auf die AUSGABE des
  Prädikats wirkt, nicht auf eine einzelne Eingabe.
- **Identität** über `worktree.branch`+repo, nie über die Slot-ID, und `killSlot` schließt die
  offene Episode explizit. Ein Slot recycelt; eine Episode darf nie zwei Lanes überspannen. Das ist
  dieselbe Fehlerklasse, für die der auto-③-Identitätscheck existiert.
- **Lücken, nach Axiom 4 („Unknown ≠ zero").** Eine Episode über einen Neustart hinweg muss als
  `endedBy:"unknown"` mit markierter Lücke schließen — nie als sauberes Ende, nie stillschweigend
  fallengelassen. Die offene Episode ist damit **Zustand**, gehört also in `fleet.json`, nicht in
  die Log-Zeile.
- **Die Schwelle gehört in die Zeile.** Sie ist ein Env-Regler; Zeilen unter verschiedenen Schwellen
  sind nicht vergleichbar, und zehn davon hießen dann nichts.

Kleinste Zeilenform: `{at, branch, repo, since, until, endedBy, sawGap, dwellMs, thresholdMs}`.

**Und die Verzerrung, die der Fakt selbst schon trägt** (Kommentar an `STALLED_IDLE_MS`): `523f5dc`
stempelt `lastOutput` auf die Boot-Zeit, jeder Neustart setzt also jede Idle-Uhr zurück. Bei ~10
Neustarts/Tag gegen 30 Minuten erreicht eine Lane die Schwelle nur, wenn sie ein neustartfreies
30-Minuten-Fenster überlebt, und keine Episode überdauert das Intervall zwischen zwei Deploys. Die
Verzerrung läuft **nur nach unten** — ein Neustart kann eine wirklich stehende Lane verbergen, aber
nie eine erfinden. Für ein Ledger heißt das: **die Zahl ist eine Untergrenze, keine Messung**, und
sie liegt ausgerechnet an den deploy-reichsten Tagen am weitesten unter der Wahrheit.

## Adjudikation

Bei n=10 kann der Owner zehn Zeilen lesen und von Hand urteilen — für v1 braucht es keine Route.
Sollte sich das ändern, liegt die Form schon im Haus: `audit-adjudications.jsonl`
(`verdict ∈ real|flake|stale-test|unknowable`, neuestes gewinnt, owner-only). Wiederverwenden,
nicht neu erfinden.

## Was NICHT dazugehört

Kein Nudge, kein Kill, kein Chip, kein Tick, der handelt — das wäre `advise` und höher, und die
Stufe wird durch gemessene Treffer verdient, nicht durch Bauen. Ein Ledger, das niemand vorzeigt,
bleibt auf `record`.

**Vorbedingung für jede spätere Fläche:** `/api/sessions` — die Route, die das eigene Board des
Owners pollt — trägt `stalled` **nicht**. Sie baut ihre eigene Slot-Ansicht. Das Feld ist heute
steward-token-only, es steht also auf `display` für den Steward und für sonst niemanden. Wer je
eine Owner-Fläche will, muss das zuerst schließen.

## Grenzen dieser Analyse

- Die Zahl **„der Digest-Worker lieferte über sieben Pulse sechsmal null"** ist aus
  `briefs/lane-stalled-fact.md` übernommen und **von mir nicht reproduziert**. Verifiziert habe ich
  den *Mechanismus*, der sie strukturell macht: `DIGEST_TTL_MS` = 2 min gegen einen stündlichen
  Puls, `digestCache` nur im Speicher, ~10 Neustarts/Tag.
- Die Neustart-Verzerrung oben ist aus Code und der dokumentierten Deploy-Kadenz **abgeleitet**,
  nicht über die Zeit gemessen. Wie stark sie in der Praxis beißt, weiß erst das Ledger.
- Geprüft habe ich die sechs Server-Senken oben plus die Aufrufstellen des Prädikats. **Nicht**
  geprüft: ob eine Instanz außerhalb dieses Prozesses zählbar wäre (Transcripts, tmux-Historie) —
  ich halte das für keine ernsthafte Grundlage, habe es aber nicht ausgeschlossen.
