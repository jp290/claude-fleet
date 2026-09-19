# Brief-Gegenlese — ein Messversuch, kein Gate

Owner-Auftrag 2026-09-14 (Orchestrator Slot 7, geschaerft von Slot 9). Zwischen Filen und Ausfuehren
prueft niemand den INHALT einer Zeile: die Karte prueft Form, ↻ refine lief nur per Knopf, der Analyst
ist seit 2026-09-10 beerdigt (`docs/queue-analyst.md` §0). Die Gegenlese ist refine in die andere
Richtung: ein starkes Modell liest den fertigen Brief einer mittel|gross-Zeile gegen den Code, BEVOR
der Tick eine Lane dafuer ausgibt — und ob das etwas bringt, wird gemessen, nicht angenommen.

## Mechanik (Code gilt: `server.ts#briefReviewKick`, `refine-validate.ts#briefReviewArm`)

- **Schalter** `FLEET_BRIEF_REVIEW=1`, Default aus. Aus heisst: keine Zeile bekommt ein Feld, keine
  Notiz, kein Start wartet — alle drei Leser (`briefReviewKick`, `briefReviewWaitLeft`,
  `briefReviewStampStart`) kehren vorher zurueck bzw. finden nichts. e2e: `(br)(a)`.
- **Eligible** = gueltige Karte mit `size` mittel|gross (`taskSizeOf`). Die Gegenlese liest `size`,
  schreibt nie `card.size` und nie `card.klasse` (ein Schreiber je Feld; eine vermutete Klasse darf sie
  als SATZ in einem Befund nennen). Zeilen ohne gueltige Karte sind nicht eligible, nie ein Default-Arm.
- **Zuteilung** — jede zweite eligible Zeile, deterministisch nach id: FNV-1a ueber die id, das
  niedrigste Bit waehlt `reviewed` oder `control` (`briefReviewArm`). Geschrieben einmal, beim ersten
  Tick, der die Welle startfaehig sieht (nach dem Plan-Urteil, VOR den Caps — die Gegenlese laeuft,
  waehrend die Caps die Zeile ohnehin halten), und nie geaendert. Sichtbar im Poll
  (`/api/sessions` → `tasks[].briefReview{arm,at,state?,findings?}`), voll in `GET /api/tasks`, und als
  Audit-Zeile `task_brief_review` (`arm=… size=…`) — die ueberlebt die Zeile.
- **Budget** `FLEET_BRIEF_REVIEW_WAIT_MS` (Default 600 000 = 10 min), gezaehlt ab dem Start der
  Gegenlese. Direkt vor dem Slot-Griff wartet der Start hoechstens so lange (Notiz
  `waiting: brief review running — starts without it in ≤ N s`), danach startet er OHNE sie. Eine
  gescheiterte Gegenlese haelt gar nichts. `atStart` auf der Zeile sagt, in welchem Zustand die
  Gegenlese war, als die Lane die Zeile bekam (`done` · `running` · `failed`).
- **Modell**: `REFINE_MODEL` (Opus) ueber den refine-Worker-Vertrag. Die `urteil`-Klasse des Registers
  gibt es noch nicht; sobald sie existiert, liest die Gegenlese sie — kein eigener Modell-Knopf.
- **Ergebnis** = VORSCHLAG in `briefReview.findings[]` (`kind` aus `BRIEF_REVIEW_KINDS`: premise-unsupported,
  done-impossible, done-contradicts, path-not-target, negative-case-missing, scope-beyond; je mit
  rg-Beleg) und `briefReview.brief` (umgeschriebener Brief, leer = nichts zu aendern). `Task.brief` und
  `Task.text` werden nie geschrieben — ein `by:owner`-Brief bleibt bytegleich. e2e: `(br)(c)`.
- **Grenzen aus dem Beerdigten**: kein Urteil ready/needs-you, kein Gate, nichts liest die Befunde
  maschinell. Ein Neustart waehrend der Lese macht aus `running` ein `failed` (normBriefReview).

## Was die Lane bekommt (MAIN-Entscheid 2026-09-19, Variante b)

Die BEFUNDE einer Gegenlese, die vor der Wahl der Gruendungsbytes GELANDET ist (`state: done`,
mindestens ein Befund), reisen als eigener gekappter Block `--- GEGENLESE DIESER ZEILE ---` HINTER dem
bytegleichen Brief und hinter dem Kommentar-Block (`wave-brief.ts#renderBriefReviewBlock`, Leser
`server.ts#briefReviewForLane`; je Befund `[kind] Satz — Beleg: …`, 450 B, Budget 1500 B, Auslassungen
gezaehlt). Der Block sagt der Lane, dass es Befunde sind, kein Auftrag. Der umgeschriebene Brief reist
NICHT mit — er bleibt Vorschlag auf der Zeile. Kein Warten auf die MAIN.

Kein Block — also die alten Bytes — fuer: control, jede nie zugeteilte Zeile, eine Lese, die beim Start
noch lief oder scheiterte, eine Lese ohne Befund. Pin: `e2e/pins.ts` „Gegenlese: without findings …";
e2e: `(br)(b)` Block-weg (control/running/failed), `(br)(c)` Block-da hinter dem Owner-Brief.
`atStart` wird im selben Moment gestempelt, in dem die Bytes gewaehlt werden (`briefAndSend`), und
sagt damit genau, ob der Block mitging (`done`) oder nicht (`running`/`failed`) — fuer jede Tuer, nicht
nur den Tick.

Uebernimmt die MAIN den vorgeschlagenen Brief VOR dem Start (`POST /api/self/tasks/:id/brief`), ist
das ihr Akt und nie fuer einen `by:owner`-Brief; die Auswertung fuehrt das als Spalte `uebernommen`.

## Wie viele Zeilen das trifft (gemessen 2026-09-19, live `fleet.json`, nur lesend)

auftrag-Zeilen im Regal mit gueltiger Karte und `size` mittel|gross: 52, alle in den letzten 7 Tagen
angelegt (das Regal haelt nur ein Fenster — Untergrenze der Rate, nicht die Rate). Von 80 done/sent-
auftrag-Zeilen tragen 22 keine gueltige Karte und waeren NIE eligible. Offen jetzt: 4 pending
mittel|gross. UNGEMESSEN: welcher Anteil davon ueber den Tick startet (nur der Tick liest die
Gegenlese; Hand-Dispatch und Wellen-Tuer starten ohne). 20 Paare = 40 eligible Tick-Starts.

## Mess-Notiz-Vorlage (Auswertung nach 20 Paaren)

Anlegen als `docs/messungen/<datum>-brief-gegenlese-auswertung.md`. Population: alle Zeilen mit
`task_brief_review` im Audit, gejoint ueber `taskId` auf `land-quality.jsonl`.

| Spalte | Quelle |
|---|---|
| taskId, arm, size | Audit `task_brief_review` |
| atStart (= Block mitgegangen?), findings je kind, uebernommen (Brief == Vorschlag?) | `briefReview` der Zeile (Regal oder Archiv) |
| Nacharbeit | `land-quality.jsonl` `reworkLines3d` (+ `reworkByFixSubject`) |
| auditRed | `land-quality.jsonl` `auditRed` |
| Abweichung Report↔DONE | fleet-report der Lane gegen den DONE-Satz der Karte, von Hand: ja/nein/teilweise |
| ownerPrompts | `land-quality.jsonl` `ownerPrompts` |
| disposition | `land-quality.jsonl` `disposition` (landed/killed…) |

Vergleich je Arm: Median + Mittel `reworkLines3d`, Anteil `auditRed`, Anteil Abweichung, Summe
`ownerPrompts`; `reviewed` zusaetzlich getrennt nach `atStart=done` (Block ging mit) vs. sonst und nach `uebernommen`.

**Abbruchregel:** nach 20 Paaren (20 reviewed + 20 control, gestartet) zeigt KEINE der vier Groessen
einen Effekt zugunsten `reviewed` ⇒ Schalter aus (`FLEET_BRIEF_REVIEW` entfernen) und die
Auftragszeile zurueckdrehen (dieser Mechanismus wird entfernt, nicht geparkt). "Kein Effekt" vorab
festgelegt: Unterschied kleiner als die Streuung innerhalb eines Arms — die Notiz nennt beide Zahlen.
