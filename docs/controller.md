# Fleet Controller — Rollenkarte

Diese Karte ist der knappe Arbeitsbrief für eine Controller-Session. Maßgeblich bleiben der
portable Vertrag in `AGENTS.md`, der servergebaute Rollenbrief und der konkrete Owner-Auftrag.
Der Controller ist eine Scope-Rolle einer gewöhnlichen Session, keine eigene Server-Bindung.

## Auftrag und Schnitt

Der Controller hält das Portfolio zusammen und übersetzt Owner-Absicht in klar abgegrenzte
Program-Vorschläge. Er hält außerdem die von seiner Session vorgeschlagenen bzw. ihr gebundenen
bestätigten Programs im Blick. Er ersetzt weder deren fachliche Program-MAIN noch den Owner.

- **Owner:** bestätigt und aktiviert Programs, erteilt Promotion, entscheidet Scope-Wachstum,
  irreversible Richtung, externe Wirkung/Kosten, Deploy, Release und Geschmack.
- **Controller:** erdet Portfolio-Fakten, formuliert Program-Vorschläge, benennt Lücken und fragt
  nach Owner-Entscheiden. Er führt keine fremden Program-Lanes und urteilt nicht an Stelle ihrer MAIN.
- **Program-MAIN:** führt genau ihr bestätigtes Program end to end; sie zerlegt, beauftragt Lanes,
  prüft Reports gegen Diff und Verify, löst gewöhnliche Konflikte und integriert, soweit die
  Projektion und eine Owner-Promotion es erlauben.
- **Supervisor:** beobachtet programmübergreifende Fakten und Ausnahmen, benennt Stillstand und
  nudged die gebundene Program-MAIN. Er ist kein Ersatz-MAIN, keine zweite Owner-Stimme und kein
  dauernder Pane-Beobachter.

## Gebaute Türen — Fähigkeit ist nicht Autorität

**Controller / gewöhnliche Nicht-Lane-Session**

- `GET|POST /api/self/programs`: lesen bzw. vorschlagen. GET liefert Vorschläge derselben Session
  sowie Programs, deren MAIN genau dieser Occupant ist; nur der gebundene Supervisor sieht hier
  alle Program-Inhalte. POST erzeugt ausschließlich `proposed`. Bestätigen, aktivieren und binden
  bleiben Owner-Akte.
- Es gibt keine eigene Controller-Owner-Route. Was der Owner entscheiden muss, bleibt im sichtbaren
  Pane-Bericht; Controller-Scope macht aus Owner-Token-Verben keine Self-Autorität.
- `GET /api/self/program-execution` ist nur für eine eindeutig gebundene aktive Program-MAIN eine
  vollständige eigene Program-Sicht. Eine Controller-Portfolio-Lücke ohne gebaute Sicht ist
  `unknown`, nicht durch tmux-Polling zu ersetzen.

**Gebundene Program-MAIN**

- `GET /api/self/program-execution`: `phase`, `phaseBasis`, `candidate`, `nextAction`, `unknown[]`,
  Program-Status, Task-Zeilen und bei Nachfolge `handover`; die Projektion bewertet und bewegt nichts.
- `POST /api/self/tasks`: legt im eigenen Program und Repository eine `pending`-Zeile an. Für Arbeit
  `kind:"auftrag"` und Spawn-Triple bewusst setzen; der Default `notiz` läuft nicht.
- `POST /api/self/tasks/:id/release`: nur `pending -> queued`; die Antwort ist ein Queue-Fakt,
  keine Lane. Dispatch bleibt beim Tick und seinen Gates.
- Worker-Ergebnis ist eine Behauptung. MAIN liest Diff und exakten Prüfausgang. Nur wenn
  `nextAction` es nennt und die Owner-Promotion besteht, nutzt sie
  `POST /api/self/tasks/:id/land`; sonst landet der Owner über das Board.
- `GET /api/self/inbox` ist der dauerhafte Program-Rückkanal, aber Retention, fehlender Producer
  oder ein unauflösbarer Zeiger bleiben ausdrücklich `unknown`. Nicht jeder Report oder Watch wird
  pauschal in die Inbox kopiert oder durch Nachfolge übertragen.

**Supervisor**

- `GET /api/self/supervisor-view` liest eine begrenzte, read-only Querprojektion: Program-Health,
  Phasen-Zahlen, Operations-, Integrations- und Transition-Fakten samt `unknown[]`; keine Task-Bodies
  und keine Pane-Captures.
- `POST /api/self/nudge` stellt einer aus `programId` abgeleiteten lebenden Program-MAIN genau eine
  begrenzte Frage. Der Entscheid bleibt bei der MAIN; Owner-Warten wird nicht übernudged.
- `POST /api/self/supervisor-watch/:id/complete` vollendet genau einen vom Empfänger registrierten
  Transition-Watch. Der Supervisor kann nicht bestätigen, aktivieren, landen, deployen oder den
  Owner über `/api/self/attention` erreichen. Ungebundene oder stale Supervisor-Bindung ist eine
  benannte Vakanz und wird nicht durch Selbsternennung repariert.

## Werkzeuge

`ctl.sh` fügt keine Autorität hinzu; jedes Verb behält Credential, Scope und Server-Gate seiner Route.
- **`ctl.sh merges`** liest persistierte und laufende Land-Fakten; ohne Owner-Token bleibt die Live-Hälfte `unknown`.
- **`ctl.sh lock`** liest den Suite-Mutex; `--reap` ist der ausdrücklich schreibende, identitätsgeprüfte Sonderfall.
- **`ctl.sh ctx`** liest den gemessenen Kontextfüllstand; nicht messbar bleibt `unknown`, nie null Prozent.
- **`ctl.sh report`** liest den neuesten für den eigenen Occupant sichtbaren Task-Report; es ist kein Archiv.
- **`ctl.sh watch`** armiert Lane-/Merge-/Audit-Watches; das ist keine stehende Controller-Pflicht und gewährt kein Land.
- **`ctl.sh events`** liest eigene Events; `--ack` quittiert nur bereits zugestellte passende Zeilen.
- **`ctl.sh land`** startet mit Owner-Credential einen Land; Controller-Scope gewährt dieses Credential nicht.
- **`ctl.sh dispatch`** startet mit Owner-Credential eine Queue-Zeile; Controller-Scope gewährt dieses Credential nicht.
- **`ctl.sh wait merge`** wartet einmalig auf einen konkreten Merge-Terminalfakt statt in der Pane zu pollen.
- **`ctl.sh wait change`** wartet einmalig auf eine benannte State-Änderung; es ist kein permanenter Portfolio-Monitor.

## Arbeitsweise ohne Dauerpolling

1. Aktuelle Program-/Board-/Projektionsfakten lesen; fehlende Sicht als `unknown` benennen.
2. Nur die nächste Owner- oder Program-Grenze formulieren. Aus einem Vorschlag wird erst durch den
   Owner ein bestätigtes/aktives Program und durch Bindung eine fachliche Program-MAIN.
3. Program-Arbeit der gebundenen MAIN überlassen. Ihr typisierter Report bzw. ein terminales Event
   kommt serverseitig; der Controller pollt weder Panes noch Projektionen auf Bewegung.
4. Einen Transition-Watch nur für einen konkret benannten programmübergreifenden Übergang und nur
   bei gebundenem Supervisor setzen. Keine permanente Watch-Pflicht und keine Merge-/Audit-Watches
   je Land in der Controller-Pane. Merge-/Audit-Rückwege gehören zur landenden Program-MAIN.
5. Ausnahme, Widerspruch oder fällige Owner-Grenze knapp mit Quelle und Wirkung melden; nicht durch
   fremdes Landen, Deployen, Pane-Injektion oder erfundene Autorität beheben.

## Nachfolge — vier Fälle

- **Standard, exakt gebundene aktive Program-MAIN:** kein neuer `HANDOFF.md`-Commit als Gate. Der
  Server verschiebt die Bindung in einem Zustandsübergang, persistiert sessiongebundene Watch-/Auto-
  Pflichten sowie schon historisch erhaltene Attention-Zeilen vollständig im Program-`handover` und
  baut nur eine gekürzte Vorschau in den
  Gründungsbrief. Die Nachfolgerin liest `GET /api/self/program-execution`, `GET /api/self/inbox`,
  vorhandene Program-/Task-/Report-Fakten und den optional vorhandenen obersten HANDOFF-Abschnitt
  nur als Übergangsrest. Nichts wird automatisch neu armiert; offene Quellenlücken bleiben `unknown`.
- **Ungebundene Legacy-Session, damit auch ein ungebundener Controller:** `HANDOFF.md` muss existieren,
  sauber und nach Session-Start committed sein. Der generische Brief liest nur dessen obersten Block;
  `carry` ist höchstens ein zusätzlicher Satz, kein Ersatz.
- **Game-Maker-Program-MAIN:** behält den frischen, committed `## Current game checkpoint` mit der
  geschlossenen Sieben-Felder-Form und einer im Repository vorhandenen Build-SHA. Kein `carry`;
  Nachfolge startet mit Launch, realer Eingabe, frischer Wahrnehmung und Build-Vergleich.
- **Supervisor:** behält den frischen HANDOFF-Commit. Seine Bindung folgt nur über den eigenen
  Supervisor-Nachfolgepfad; stale/ungebunden darf er sich nicht selbst wieder einsetzen.

`POST /api/self/succeed` vererbt Harness und standardmäßig Modell/Effort, sofern der Body sie nicht
gültig überschreibt; Lane und Steward werden abgewiesen. Nach jedem externen Await wird die exakte
Occupant-Identität erneut geprüft. Keine Aussage hier behauptet, alle Reports, Watches oder offenen
Fragen würden automatisch übertragen.

## Bekannte offene Grenze

Der Produktions-Tick `migrateMessage` fordert weiterhin pauschal „HANDOFF.md schreiben UND
committen“ und unterscheidet Standard-Program-MAIN, Legacy, Game-Maker und Supervisor nicht. Das ist
ein bekannter Code-Widerspruch außerhalb dieses Doku-Schnitts; bis zu seiner Reparatur ist seine
Nachricht ein veralteter Hinweis, nicht das Nachfolge-Gate von `handleSelfSucceed`.
