# Autonomie-Bausteine — was fehlt, und was davon sich lohnt. Stand 2026-08-06 ~20:15

*Owner-Vorgabe wörtlich, als Scope-Anker: „nach weiteren fehlenden oder sinnvollen autonomie
Bausteinen schauen" — gemeint ist die Kette „Steward-Befund → Zeile → Lane → gelandeter Code, ohne
Mensch dazwischen", mit zwei Teilfragen: **(a)** welcher Baustein fehlt, damit die Kette überhaupt
durchläuft, **(b)** welcher fehlt, damit ein Durchlauf SICHER ist — also die Maschine merkt, dass sie
falsch liegt, bevor es teuer wird. Die Rangliste endet, wo diese Vorgabe erfüllt ist
(`docs/scope-inflation.md` §7).*

*Dritte Datei der Serie, nach `docs/autonomy-verbs-2026-08-06.md` (die fünf Verben) und
`docs/autonomy-map-2026-08-06.md` (die Landkarte). Sie ersetzt keine der beiden — sie korrigiert
drei ihrer Prämissen und hängt vier Bausteine an, die in keiner von beiden stehen. Schwester-Datei
desselben Tages mit anderem Gegenstand und **ohne Überschneidung**:
`docs/agent-visibility-2026-08-06.md` (was Agenten sehen und wissen).*

**Was diese Untersuchung getan hat:** Register gerechnet (`lane-outcomes.jsonl`,
`post-land-audits.jsonl`, `audit-adjudications.jsonl`, `audit.jsonl`, `fleet.json`), Code an den
zitierten Stellen gelesen. **Was sie nicht getan hat:** keine Suite gefahren (Owner-Vorgabe, die
Maschine war mit zwei anderen Lanes belegt), keine Produktivdatei angefasst, keinen Schalter bewegt.
Diese Datei ist die einzige Änderung. Der Verifikationsstand steht in §5, die Abdeckungslücken
in §6 — Teilabdeckung darf nicht wie Vollabdeckung klingen.

**Alle Zeilennummern gelten gegen `main` bei `ed5c352`** (die Untersuchung lief zuerst gegen einen
älteren Fork; jede Referenz wurde nach dem Rebase neu abgeleitet, nicht übertragen). Alle Zahlen
sind um 20:15 gerechnet — die Register bewegten sich während dieser Untersuchung erheblich
(89 statt 81 gelandete Zeilen binnen einer Stunde), also gilt für sie dieselbe Regel wie für alles
andere hier: nachrechnen mit §7, nicht zitieren.

---

## §1 Drei Prämissen der beiden Vorgänger-Dokumente haben sich bewegt

Die Rangliste in §2 stützt sich darauf, darum stehen sie vorn.

### 1.1 „0 von 12 adjudizierten Roten waren `real`" ist überholt

Heute: **51 Tier-2-Läufe (36 grün / 15 rot), 15 rote adjudiziert, 0 un-adjudiziert.**

| Verdict | n | von wem |
|---|---|---|
| `unknowable` | 9 | `backfill` |
| `flake` | 3 | `owner` |
| `stale-test` | 2 | `owner` |
| **`real`** | **1** | `owner` |

Das `real` ist `auditAt 1785254868161` — genau eine der zwei Zeilen, die die Landkarte §7.1 noch als
un-adjudiziert und beauftragt führte. Owner-Notiz: *„real — Server-Defekt, nicht der Test. Die
Journal-Cap zaehlte positional (slice vor in-hour-Filter) und liess 13 Ueber-Cap-POSTs durch;
zusaetzlich fehlte FLEET_STEWARD_JOURNAL_PER_HOUR in der Restart-Whitelist. Beides behoben in
07e5969, 38 Min nach diesem Lauf. Seither 16/16 Trail-Laeufe gruen."*

**Konsequenz:** die historische Trefferquote eines Auto-Rollbacks ist nicht 0/12, sondern **1/15**.
Das kippt den Entscheid nicht — bei ~7 % hätte ein Auto-Rollback weiterhin in 14 von 15 Fällen
`main` grundlos zurückgedreht — aber die Formulierung *„ein Auslöser, der bisher ausschließlich
falsch ausgelöst hätte"* (Landkarte §11.1.2) ist ab heute wörtlich falsch. Die Zahl „0/12" steht
zusätzlich in CLAUDE.md und im Verben-Doc und altert dort weiter.

**Der wertvollere Teil dieses Befunds ist nicht die Zahl, sondern der Kanal:** die Adjudikation hat
in zwei Tagen von 12/14 auf 15/15 aufgeschlossen und dabei ein echtes Produkt-Rot gefunden. Der
Post-Land-Audit ist damit zum ersten Mal ein Kanal mit belegter Ausbeute, nicht nur mit Basisrate.

### 1.2 „Nach `queued` kommt eine Zeile ausschließlich durch den Owner-Promote" ist falsch

Zwei Maschinen-Pfade schreiben `status = "queued"`:

- **`server.ts:2009`** — `requeue()` in `briefAndSend`. Feuert bei jedem Fehlschlag des
  Alive-Gates nach dem Spawn (`identityLost`, `canDeliver`, `sendText`-Fehler).
- **`server.ts:6699`** — Boot-Abgleich: eine als `sent` persistierte Task, deren Slot nicht
  als lebende Lane zurückkam, geht auf `queued` mit `note: "requeued after restart"`.

(Der dritte Treffer, `server.ts:9621`, ist die Owner-Promote-Route und gehört nicht dazu.)

Beide Maschinen-Pfade sind im Code begründet und m. E. vertretbar — der Kommentar über `2009`
argumentiert ausdrücklich, ein attended start SEI eine Freigabe, und der Boot-Pfad fasst nur Zeilen
an, deren Worktree verschwunden ist. **Falsch ist nur die Behauptung der Ausschließlichkeit** — und
die ist genau die Sicherheits-Eigenschaft, auf die Verb 3 seine Begründung stützt (*„ihr
unbeaufsichtigter Start übergeht niemandes anstehende Entscheidung"*). Wer Verb 3 baut, baut den
dritten Maschinen-Pfad, nicht den ersten. Der Satz steht so in CLAUDE.md Punkt (d) und im
Verben-Doc („Der Befund, der dieses Dokument klein macht").

### 1.3 Verb 1 und Landkarten-Schritt A sind gebaut

Verifiziert, nicht geglaubt:

- `gate: gateView()` auf der Steward-Route — **`server.ts:7658`**.
- `suiteLock: suiteLockView()` auf der Self-Route — **`server.ts:8061`**.
- `audit.jsonl` führt **20 `self_drift`-Events** (vor einer Stunde waren es 6 — der Zähler läuft
  sichtbar an).

Die Landkarte §11.3 führt A noch als ersten ungebauten Schritt. Der Basiswert im §12-Recompute-Block
(*„landed 78, checked 0 — die Frage war unbeantwortbar"*) hat damit seinen Nachfolger.

### 1.4 Der Zustand der Kette heute

44 Tasks in `fleet.json`, **0 im Status `queued`**, `"dispatch": true`. 19 Tasks tragen eine Analyse
— Verdicts **10× `needs-you`, 9× `ready`, 0× `unknown`**; vier der `ready` stehen in `pending`.

Der Promote ist damit weiterhin der Engpass, aber die Beweislage hat sich gedreht: die Landkarte
konnte am 06.08. 14:22 nur 5× `needs-you` messen und musste offenlassen, ob der Analyst je ein
`ready` produziert. Er tut es, neunmal. Was fehlt, ist der Griff dahinter.

---

## §2 Die Rangliste

Je Punkt: was fehlt · was es kostet · was es bräuchte · die Schwelle. Ein Vorschlag ohne Schwelle
ist eine Meinung (Landkarte §11.2).

### 2.1 Kein Feld sagt, ob eine Lane von der Maschine oder vom Owner freigegeben wurde

**Was fehlt.** Weder `Task` (`server.ts:167`) noch `LaneOutcome` (`server.ts:4775`) trägt ein Feld
„wer hat diese Lane losgeschickt".

**Was es kostet.** Verb 3s Abbruchkriterium lautet *„die ersten 10 auto-promoteten Lanes … liegt die
Abbruch-/Müll-Quote über 3 von 10"*, Verb 5s *„die ersten 10 Auto-Lands je mit grünem Folge-Audit"*.
Beide Populationen sind aus dem Register **nicht selektierbar**. Schlimmer als die Absenz ist das
Feld, das so aussieht, als täte es das: `confirmedByHuman` (`server.ts:4805`) beantwortet *„did the
owner confirm-land it (true) or did it auto-land clean+green (false)?"* — das ist die Land-**Art**,
nicht die Freigabe. **77 der 89 gelandeten Zeilen tragen heute schon `false`**, obwohl bei jeder ein
Mensch das ⏫ gedrückt hat. Sobald Verb 5 läuft, schreibt ein echter Auto-Land denselben Wert. Die
Alt-Zeilen und die Auto-Lands sind dann nicht mehr zu trennen: das Abbruchkriterium wird nicht nur
unberechenbar, es sieht berechenbar aus und liefert eine Zahl, die 77 attended Lands enthält.

**Was es bräuchte.** Ein Feld (`releasedBy: "owner" | "machine"`) auf der Task, am Promote-Ort
geschrieben, über `LandFacts` (`server.ts:4846`) auf die Outcome-Zeile getragen. `server.ts`:
Interface 167, 4775/4805, `buildLaneOutcome`, der Promote-Tick. Klein. **Muss vor Verb 3 landen**,
aus dem Grund, den der Code an `resolvedBy` selbst notiert (`server.ts:4796-4803`): *„cannot be
recovered from rows that never recorded it. A fallback without a counter silently becomes the
normal case."*

**Schwelle.** Instrumentierung, kein Verhalten — kein Stop-Kriterium nötig. Korrektheitstest
stattdessen: über die ersten **5** auto-promoteten Lanes muss
`jq 'select(.releasedBy=="machine")' lane-outcomes.jsonl | wc -l` exakt der Zahl der
Auto-Promote-Audit-Events entsprechen. Weichen sie ab, steht das Feld an der falschen Stelle —
reparieren, **bevor** die 10er-Serie von Verb 3 beginnt, sonst ist die Serie ungültig.

### 2.2 Der Durchsatz-Deckel wurde mit dem Eval-Gate entfernt — Verb 3 bringt zurück, wofür er da war

**Was fehlt.** Ein Ventil auf die Rate unbeaufsichtigter Starts.
`grep -nE 'PER_DAY|perDay|dailyCap|MAX_AUTO' server.ts` → **null Treffer**.

**Was es kostet.** Der Code sagt selbst, warum das Ventil weg ist — im Kommentar zum
Analysten-Umbau (`server.ts:2046`), als eine von vier Konsequenzen des `500ff63`-Entscheids:

> *„no per-day auto valve, because there is no unattended selection left to meter"*

Die Begründung war zum Zeitpunkt des Umbaus korrekt. **Verb 3 stellt die unbeaufsichtigte Auswahl
wieder her, ohne das Ventil wiederherzustellen** — das ist keine Meinung über Verb 3, das ist die
wörtliche Umkehrung seiner eigenen Streichungs-Begründung.

**Und der letzte verbliebene Ersatz ist gerade absichtlich entfernt worden.** `d49c6e8`
(„der Deckel hoert auf, die Kollisionsvermeidung zu spielen") trennt den Kollisions-Check
(`server.ts:2398-2399`: eine `queued`-Zeile, deren `collides` laufende Arbeit nennt, wird
zurückgehalten) von `FLEET_DISPATCH_MAX_LANES` — mit der ausdrücklichen Begründung, die Zahl habe
*„versehentlich die Arbeit eines Checks getan, den es nicht gab"*, und **genau deshalb nie steigen
können**. Der Commit ist richtig; seine Folge für dieses Kapitel ist, dass die einzige Zahl, die
Durchsatz nebenbei begrenzte, jetzt freigegeben ist zu steigen. Ein Rate-Ventil war vorher
verzichtbar, weil ein anderer Deckel es versehentlich mit erledigte. Das ist ab `d49c6e8` nicht
mehr so.

Bezifferbar ist die Obergrenze nur in Lanes, nicht in Geld: **es gibt in `server.ts` überhaupt keine
Kosten- oder Token-Buchführung.** Gemessene Land-Rate: 3 (08-04), 6 (08-05), **16 (08-06)** — alle
owner-freigegeben, und die Zahl hat sich während dieser Untersuchung binnen einer Stunde verdoppelt.
Nach Verb 3 wäre die Rate nur noch durch die Lane-Dauer und `MAX_LANES` begrenzt.

**Was es bräuchte.** Ein Zähler + ein Env-Knopf am Promote-Tick, `server.ts` neben `tickDispatch`.
Klein — und es ist wiederhergestellter, kein neu entworfener Code.

**Schwelle.** Deckel bei **3 Auto-Promotes/Tag**. Die Zahl kommt bewusst NICHT aus der Land-Rate
(16/Tag, attended), sondern aus der Beobachtbarkeit: Verb 3s eigene 10er-Serie soll sich über
mehrere Tage ziehen, damit ein schlechter Brief von einem Menschen gesehen wird, bevor die Serie
durch ist. Über **10 Tage**: wird der Deckel an ≥3 Tagen erreicht, ohne dass ein Land zurückgewiesen
wurde → anheben. Wird er in 10 Tagen **nie** erreicht → das Ventil ist als unnötig bewiesen und
kommt wieder raus.

### 2.3 Verb 3s Population ist leer — die Reihenfolge 3 vor 4 ist durch Messung falsch herum

**Was fehlt.** Nichts Bautechnisches. Ein Reihenfolge-Befund.

**Was es kostet.** Verb 3 wählt `source:"steward" && kind:"lane"` mit Verdict `ready`. Gemessen in
`fleet.json`: **14 Steward-Tasks, davon 14× `note` und 0× `lane`** — nie eine, in der gesamten
Lebenszeit des Feldes (4 note/archived, 5 note/done, 5 note/pending; unverändert über die zwei
Messungen dieser Untersuchung hinweg, während die Owner-Zeilen von 22 auf 30 wuchsen). Die neun
Zeilen mit `ready`-Verdict sind **alle `source:"owner"`** und von Verb 3 ausdrücklich ausgeschlossen.

Verb 3 vor Verb 4 gebaut startet also nichts, erreicht seine eigene Schwelle nie und kann sich weder
bestätigen noch widerlegen. **Ein stiller No-Op ist die teuerste Sorte, weil er sich wie „Autonomie
läuft" liest** — und es ist exakt die Krankheit, an der das Eval-Gate starb: ein Verdict in seiner
ganzen Lebenszeit, Population leer by construction (`server.ts:2037`, die Autopsie steht im Code).
Dieselbe Falle zweimal zu bauen wäre der vermeidbarste Fehler dieses Programms.

**Was es bräuchte.** Kein Code — **Verb 4 vor Verb 3**. Die Alternative (Population auf
`kind:"lane" && ready` unabhängig von der Quelle aufweiten) verbietet sich: das ist wörtlich der
`500ff63`-Einwand, die un-promoteten Entwürfe des Owners hinter seinem Rücken zu starten.

**Schwelle.** Vor Verb 3: **≥5** vom Steward gefilte `kind:"lane"`-Zeilen müssen existieren und
**≥2** davon ohne Nachhilfe `ready` erreicht haben. Hat der Steward nach **20 Pulsen** 0
Lane-Claims gefilt, ist das Ritual nicht der Hebel und Verb 3 hat keine Population — dann aufhören,
nicht nachschärfen.

### 2.4 Nichts beendet eine Lane, die falsch läuft

**Was fehlt.** Kein Wanduhr-Limit, kein Kosten-Limit, kein Abbruch. Das ist keine Ableitung: der
Code sagt es wörtlich über sich selbst (`lane-signals.ts:81`, im Kommentarblock zu `stalled`) —
***„no lane timeout exists anywhere in the code"***, und im selben Block die Folge bei
`FLEET_DISPATCH_MAX_LANES=2`: *„two such lanes stall the dispatcher behind a row note that reads
like healthy backpressure."*

**Was es kostet.** Teilweise gemessen. **20 der 111 Outcome-Zeilen (18,0 %) sind
`killed-empty`/`killed-dirty`**, und **alle 15 `killed-empty` tragen `commitCount:0` UND
`ownerPrompts:0`** — Lanes, die nie etwas produziert und nie eine Nachfrage bekommen haben, jede von
einer Hand beendet. Der Dreifach-Dispatch von Task `5a05080e` am 05.08. (drei `task_dispatch`-Events
in `audit.jsonl`: 22:55:47 `clarify`, 22:56:49, 22:57:02) hinterließ drei Worktrees; zwei stehen im
Register als `killed-empty` mit `sessionMs` 438 950 / 377 207 ms (`fleet/260805205546-3eb1`,
`fleet/260805205648-78a6`), der dritte (`…205702-72fb`) landete am 06.08. um 07:55.

**Einschränkung, die dieser Zahl ihre Hälfte nimmt:** der erste der drei Dispatches war `clarify`,
und eine Clarify-Lane produziert bauartbedingt keine Commits — von den zwei leeren Lanes ist also
nur **eine** eindeutig Verschwendung. Rund 6 Minuten Agentenzeit, und eine Hand musste beide räumen.
Beaufsichtigt ist das Rauschen. Mit Verb 3+5 unterscheidet nichts es von Fortschritt.

**Was es bräuchte.** Mittel. Eine Wanduhr-Grenze pro dispatcher-gestarteter Lane (parken oder
killen bei `commitCount:0` und 0 Owner-Prompts nach N Minuten). `server.ts` (Tick-Schleife),
`lane-signals.ts`.

**Schwelle — erst messen, nicht bauen**, und das ist ausdrücklich die Hausdoktrin an derselben
Stelle (`lane-signals.ts:86-88`: *„record → display → advise → gate → act"*, und *„what to DO about
a stalled lane is a separate, later decision, and its input is the instances this fact makes
countable"*). Dieser Abschnitt liefert genau diese Schwelle: über die ersten **20**
dispatcher-gestarteten Lanes zählen, wie viele `killed-empty` mit 0 Owner-Prompts enden. Unter
**2 von 20** → die entlaufene Lane ist kein reales Problem dieser Flotte, die Grenze bleibt
ungebaut. Ab **5 von 20** → bauen, und die Grenze ist das 90. Perzentil von `sessionMs` über die
*gelandeten* Zeilen. Diese Messung setzt 2.1 voraus: ohne `releasedBy` ist „dispatcher-gestartet"
nicht selektierbar.

---

## §3 ── Schnittlinie ──

Die Vorgabe lautet *„nach weiteren fehlenden oder sinnvollen autonomie Bausteinen schauen"*. Die
vier oben beantworten sie; hier endet die Liste.

## §4 Gesehen und bewusst NICHT empfohlen

So wertvoll wie die Liste darüber, weil jede dieser Zeilen sonst in der nächsten Session neu
vorgeschlagen wird.

- **Auto-Rollback auf rotes Tier-2** — nicht wieder vorgeschlagen. §1.1 meldet nur die veraltete
  Zahl; bei 1/15 steht der Entscheid.
- **Ein `land`/`deploy`-Event-Typ in `audit.jsonl`** — weiterhin absent. Nicht empfohlen:
  `lane-outcomes.jsonl` trägt den Land-Fakt bereits reicher, und ein zweiter Schreiber desselben
  Fakts ist ein Divergenz-Risiko, kein Instrument.
- **Der Phantom-`mergeParked`-Eintrag** (`fleet/260805151236-096a`, heute noch in `fleet.json`) —
  der Code-Pfad ist zu (Landkarte §9.1), nur die Alt-Zeile steht. Kein Autonomie-Block: eine Zeile,
  owner-räumbar, kein Prädikat liest sie.
- **`Slot.mission`** — weiterhin auf keinem Slot gesetzt. Freitext, für ein Prädikat unlesbar. Kein
  Baustein, solange nichts es als Eingang will.
- **`otherLanes.files` auf uncommittete Arbeit erweitern** (Landkarte Schritt C) — real, aber
  Kollisions-*Prävention*, und seit `d49c6e8` hat der Dispatcher dafür einen eigenen Check
  (`analysis.collides` gegen laufende Arbeit). Trägt nicht vor die vier oben.
- **Ein zweiter Reviewer / `FLEET_CLEAN_REVIEW` wieder an** — Verb 5 spezifiziert das bereits;
  keine Messung, die seine Form ändern würde.
- **Digest-TTL** (Landkarte Schritt E) — eine Zahl, bereits beauftragt; nicht neu hergeleitet,
  keine neue Evidenz.

---

## §5 Verifikationsstand

| Behauptung | Stand |
|---|---|
| Alle Register-Zahlen (§1.1, §1.4, §2.1–2.4) | **gerechnet** (Kommandos in §7) |
| 15/15 Rote adjudiziert, 1× `real`, Notiz zitiert | **gerechnet + gelesen** |
| Zwei Maschinen-Pfade nach `queued` | **gelesen** (`server.ts:2009`, `6699`) |
| Verb 1 live | **gelesen** (`server.ts:7658`, `8061`) |
| Schritt A live, 20 `self_drift`-Events | **gerechnet** (`audit.jsonl`) |
| `confirmedByHuman` = Land-Art, nicht Freigabe | **gelesen** (`server.ts:4805`, `LandFacts` 4846) |
| Kein Tages-Ventil, keine Kosten-Buchführung | **gemessen** (`grep`, null Treffer) + **gelesen** (`server.ts:2046`) |
| `d49c6e8` löst den Deckel von der Kollisionsvermeidung | **gelesen** (Commit-Body + `server.ts:2398-2399`) |
| 0 Steward-Tasks mit `kind:"lane"`, je | **gerechnet** (`fleet.json`, zweimal im Abstand einer Stunde) |
| 9× `ready`, alle `source:"owner"` | **gerechnet** (`fleet.json`) |
| „no lane timeout exists anywhere in the code" | **gelesen** (`lane-signals.ts:81` — Aussage des Codes über sich selbst) |
| 15/15 `killed-empty` mit 0 Commits und 0 Owner-Prompts | **gerechnet** |
| Dreifach-Dispatch → 3 Worktrees, 2 leer | **gerechnet** (audit + outcome) — der Join Task→Branch ist **geschlossen**, nicht gemessen: die Branch-Namen-Zeitstempel treffen die Audit-Events mit konstantem 2-h-Versatz (Zeitzone), einen direkten `task.id`→`branch`-Join führt kein Register |
| WELCHER Mechanismus die drei Dispatches erlaubte | **geschlossen, nicht belegt** — die Route weist eine `sent`-Task mit 409 ab, also muss zwischen den Klicks ein Requeue gelaufen sein. Schluss aus dem Guard, nicht Lektüre des Vorfalls |
| „alle killed-* von Hand beendet" | **geschlossen** aus der Absenz eines Timeouts (jetzt durch `lane-signals.ts:81` gestützt), nicht aus einer Beobachtung |

## §6 Was NICHT geprüft wurde

- **Keine e2e-Suite gefahren** (Owner-Vorgabe; die Maschine war belegt). Es wurde nichts am Produkt
  geändert, also gab es nichts zu verifizieren.
- **`src/client.ts` wurde überhaupt nicht gelesen.** Jede Aussage darüber, was das Board zeigt, ist
  nicht aus dieser Untersuchung.
- **Verb 2 (Deploy) nicht nachgeprüft** über die Behauptungen der Landkarte hinaus —
  insbesondere nicht `bootHead == HEAD` und nicht die Deploy-Latenz-Reihe.
- **Das Rundgang-Ritual nicht gefunden** (weder `~/.claude/skills/rundgang/SKILL.md` noch
  `~/.claude/commands/rundgang.md` existieren). Ob es einen `kind:"lane"`-Claim vorsieht, ist
  ungeprüft; die Messung „0 Lane-Claims, je" steht unabhängig davon.
- **Der §12-Drift-Abdeckungs-Join der Landkarte nicht nachgefahren** — nur die `self_drift`-
  Rohzeilen gezählt. Die Quote „prüfen Lanes ihren Drift früh genug" ist damit weiter offen.
- **`d49c6e8` nur im Commit-Body und an der Einbaustelle gelesen**, nicht der volle Diff (269
  geänderte Zeilen); die drei Entscheidungen, die der Body benennt, sind nicht nachgeprüft.
- Kein Live-Fall für den Requeue-Pfad provoziert.

## §7 Recompute-Block

Read-only, im **Haupt-Checkout** (`~/claude-fleet`) ausführen. Alles in §1 und §2 kommt hier heraus.

```sh
# §1.1 — Tier 2 + Adjudikation. Leere comm-Ausgabe = alle Roten beurteilt.
jq -r '.result' post-land-audits.jsonl | sort | uniq -c
comm -23 <(jq -r 'select(.result=="red")|.at' post-land-audits.jsonl | sort) \
         <(jq -r '.auditAt' audit-adjudications.jsonl | sort)
jq -r '.verdict' audit-adjudications.jsonl | sort | uniq -c
jq -r 'select(.verdict=="real")|[.auditAt,.note]|@tsv' audit-adjudications.jsonl

# §1.2 — die Pfade nach `queued` (Belege, nicht Zahlen). Drei Treffer: die ersten beiden sind
# die MASCHINEN-Pfade (briefAndSend-requeue, Boot-Abgleich), der dritte die Owner-Promote-Route.
grep -n 'status = "queued"' server.ts

# §1.3 — Verb 1 + Schritt A
grep -n 'gate: gateView()\|suiteLock: suiteLockView()' server.ts
jq -r 'select(.event=="self_drift")' audit.jsonl | jq -s length

# §1.4 + §2.3 — die Queue: Engpass, Population, Verdicts
jq -r '.tasks[]?|[.status,.kind,.source]|@tsv' fleet.json | sort | uniq -c
jq -r '.tasks[]?|select(.analysis)|[.source,.status,.analysis.verdict]|@tsv' fleet.json | sort | uniq -c
jq '.dispatch' fleet.json

# §2.1 — confirmedByHuman ist die Land-ART, und 77 Zeilen tragen schon `false`
jq -r 'select(.disposition=="landed")|(.confirmedByHuman|tostring)' lane-outcomes.jsonl \
  | sort | uniq -c
grep -n 'confirmedByHuman: boolean; // did the owner' server.ts

# §2.2 — kein Tages-Ventil, keine Kosten-Buchfuehrung (beide muessen LEER sein)
grep -nE 'PER_DAY|perDay|dailyCap|MAX_AUTO' server.ts
grep -n 'no per-day auto valve' server.ts     # die Streichungs-Begruendung im Code
grep -n 'collides.find' server.ts             # der Check, den d49c6e8 vom Deckel geloest hat

# §2.2 — Land-Rate pro Tag
jq -r 'select(.disposition=="landed")|.ts' lane-outcomes.jsonl \
  | while read t; do date -r $((t/1000)) +%m-%d; done | uniq -c | tail -12

# §2.4 — kein Timeout, die Muellquote, der Dreifach-Dispatch
grep -n 'no lane timeout exists anywhere' lane-signals.ts
jq -r '.disposition' lane-outcomes.jsonl | sort | uniq -c
jq -r 'select(.disposition=="killed-empty")|[.commitCount,.ownerPrompts]|@tsv' \
  lane-outcomes.jsonl | sort | uniq -c
jq -r 'select(.event=="task_dispatch")|[.ts,.slot,.detail]|@tsv' audit.jsonl \
  | while IFS=$'\t' read t s d; do echo "$(date -r $((t/1000)) '+%m-%d %H:%M:%S') slot$s $d"; done
```

---

## §8 Reihenfolge, wenn beide Dokumente zusammengelegt werden

Das Verben-Doc sagt **1 → 2 → 3 → 4 → 5**. Verb 1 ist gebaut. Aus §2 folgen zwei Einschübe und
eine Vertauschung:

**2 → 2.1 (`releasedBy`) → 2.2 (Tages-Ventil) → 4 → 3 → 5.**

- **2.1 und 2.2 vor 3**, weil sie Verb 3s eigenes Abbruchkriterium erst messbar bzw. erst wirksam
  machen. Beide sind klein; keiner von beiden ändert Verhalten, solange Verb 3 nicht läuft.
- **4 vor 3** (Vertauschung), weil Verb 3s Population ohne die Ritual-Revision leer ist (§2.3).
- **2.4 (die Lane-Wanduhr) nirgends** — es ist eine Messung, kein Bauteil, und sie läuft nebenher,
  sobald 2.1 die Selektion erlaubt.
