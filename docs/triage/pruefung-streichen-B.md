# Verifikat — Prüfpaket B

Geprüft wurde ausschließlich, ob die jeweils genannten Belege das Worker-Verdikt tragen. Ich fälle keine neue Löschentscheidung. Quellenstand des gelesenen Repos: `c9a1dc72047733af5f00dca281942823c70fb586` vom 2026-08-09 13:37:30 +02:00.

Aktueller Betriebsdaten-Befund: Alle acht IDs existieren in der gitignorierten `fleet.json` weiterhin mit Status `pending`; keine ist zwischenzeitlich `done` oder `archived`. `09572f62`, `356333db`, `97f529b1` und `b759e8d9` sind `kind:note`; `dabd1880`, `190e5705`, `63626cdb` und `efc98cfa` sind `kind:lane`.

Paket-Inkonsistenz: Der Auftrag kündigt zwei Zeilen mit Konfidenz `mittel` an. Die acht Überschriften in `PRUEFPAKET.md` enthalten mechanisch nur eine: `dabd1880`; alle sieben anderen sind dort `hoch`. Ich habe keine zweite mittlere Zeile erfunden.

## Übersicht

| Zeile | Ergebnis | Einzeiler |
|---|---|---|
| `dabd1880` | **BESTÄTIGT** | Commit, Spawn-Konfiguration und Timer-Guard belegen die bewusste Abschaltung; die Restfrage existiert als `684a9d99`. |
| `09572f62` | **BESTÄTIGT** | Das Attic sagt ausdrücklich „owner: build or not“ und nennt genau einen handgefahrenen Stack als gesamte Evidenzbasis. |
| `190e5705` | **WIDERLEGT** | Die Quelle nennt R3 ausdrücklich eine der „drei Zeilen, fertig zum Filen“; sie trennt den manuellen Messlauf vom späteren Agent-Bau, nicht von der Queue. |
| `356333db` | **BESTÄTIGT** | Die offene Produktfrage ist im dauerhaften Wellen-Brief gesichert, und die schädliche Epochen-Lesart ist im Code behoben. |
| `63626cdb` | **BESTÄTIGT** | Alle drei Audit-Reste samt offenen Abwägungen stehen im Attic; die aktuelle Queue bestätigt zusätzlich den `lane`-Formfehler. |
| `97f529b1` | **BESTÄTIGT** | Das Attic enthält Nutzen, Vertrauensrisiko und die harte Reihenfolge „Do not build this first“. |
| `b759e8d9` | **WIDERLEGT** | Sachbefund und Code stimmen, aber der zitierte Commit `3b22aa8` trägt ihn nicht; die tatsächliche Provenienz ist `5d707bca`. |
| `efc98cfa` | **WIDERLEGT** | Die Wissenssicherung trägt, doch `server.ts:9605` ist nachweislich Intake und nicht der behauptete Owner-Create-Pfad. |

## `dabd1880` — BESTÄTIGT

**Gelesen.** Der Body von `ec910752642ca1fd799f4139b96f81f976247597` existiert und nennt sowohl Ursache als auch Abschaltung:

> „Jedes Land entwertet damit das Urteil JEDER offenen Zeile“

und:

> „FLEET_ANALYSIS_MS=0 in die srv-Spawn-Zeile. Aktiviert per launchctl kickstart […] am ./state.sh-Config-Sensor als live=0 verifiziert.“

Die aktuelle Spawn-Zeile in `watchdog.sh:153` enthält weiterhin wörtlich:

> `FLEET_ANALYSIS_MS=0`

Der Code liest den Wert in `server.ts:3901` mit dem Kommentar `// 0 = off`; die Registrierung ist in `server.ts:10179-10181` konditional:

> `if (ANALYSIS_TICK_MS) setInterval(() => void tickAnalysisSweep() ...`

**Gemessen.** `ec91075` ist Ancestor des aktuellen HEAD. Die aktuelle Queue-Zeile `684a9d99` existiert als `pending/lane` und beginnt: „Der Analyst ist AUS, der Dispatcher ist AN“. Sie trägt damit tatsächlich die vom Worker genannte Restfrage zur Freigabe ohne Analysten. Der Versuch, den laufenden `srv` über den tmux-Socket zu prüfen, scheiterte im Sandbox-Zaun (`srv_pane=NICHT_PRUEFBAR`); ich behaupte daher keinen aktuellen Prozess-Env-Wert.

**Begründung.** Die belegte Aussage ist enger als ein Live-Prozess-Claim: Der produktive Spawn ist bewusst auf 0 konfiguriert, und der Code registriert dann keinen Analyse-Timer. Genau das widerlegt die Prämisse der Queue-Zeile von einem dauerhaft laufenden Sweep. Dass der laufende Prozess theoretisch von der Datei abweichen kann, hat der Worker selbst korrekt als ungeprüft und als Grund für `mittel` ausgewiesen.

## `09572f62` — BESTÄTIGT

**Gelesen.** `docs/attic/backlog-2026-07.md:1197` sagt:

> `P-6 | Program board […] | owner: build or not`

und `:1313-1314`:

> „Program board (P-6): build it at all? It is propose-only today; one hand-run stack is the entire evidence base.“

Der Body von `c366c6652cb76a904778d4ad450fb9a3144b3a98` führt P-6 unter „offen“ und nennt `09572f62` ausdrücklich als Note. Der zitierte Bereich `:1313-1315` reicht formal eine Zeile über das Dateiende (die Datei endet auf 1314); die entscheidende Aussage steht aber vollständig auf 1313-1314.

**Gemessen.** Eine Suche nur über getrackte Code-Dateien (`*.ts`, `*.js`, `*.sh`, `*.html`, `*.json`) ergibt für `programBoard|laneDag` genau 0 Treffer. Die Queue-Zeile ist weiterhin `pending/note`.

**Begründung.** Der Attic-Beleg bewahrt exakt Entscheidung, Inhalt und dünne Evidenzbasis. Er trägt damit das Wissenssicherungs-Argument des Workers.

## `190e5705` — WIDERLEGT

**Gelesen.** `briefs/mitarbeiter-2026-08-07.md:296-310` sagt einerseits richtig:

> „Den Agenten heute noch nicht bauen. Erst das Maß und einen zweiten Lauf von Hand.“

Die vom Worker ausgelassene Einordnung unmittelbar vor R3 ist aber entscheidend. `:337` überschreibt den Abschnitt:

> „Die drei Zeilen, fertig zum Filen (DONE + VERIFY im Text)“

Darunter steht in `:370-383`:

> „R3 — Mitarbeiter Lauf 2, UI-Linse, von Hand“

und:

> „Read-only, kein Code, kein Commit außer dem Report.“

`docs/triage/batch-D2-bedienung.md:226-237` kopiert genau diesen ausführbaren R3-Auftrag. Ein passender Report `briefs/mitarbeiter-lauf2-*.md` existiert weiterhin nicht.

**Gemessen.** `server.ts:1076-1079` definiert `kind:lane` als „a work brief the dispatcher may run once queued“; daraus folgt nicht, dass jede Lane den dauerhaften Mitarbeiter-Agenten baut. Die aktuelle Zeile ist `pending/lane`, ihr Text ist byteinhaltlich der R3-Auftrag.

**Begründung.** Der Worker setzt „Agent-Bau“ fälschlich mit „Agent-Session, die den manuellen/read-only Lauf ausführt“ gleich. Die Quelle trennt diese Dinge: Der zweite Messlauf soll ausdrücklich als fertig geschnittene Zeile gefilet werden; erst abhängig von seinem Ergebnis soll der Mitarbeiter-Agent gebaut oder verworfen werden. Der Beleg trägt daher gerade nicht die Schlussfolgerung, R3 gehöre außerhalb der Queue.

## `356333db` — BESTÄTIGT

**Gelesen.** `briefs/work-waves-2026-08-07.md:156-174` steht unter „Offene Owner-Fragen“ und hält in `:172-173` fest:

> „Die Zeit der letzten Ausgabe (`356333db`): `lastOutput` ist präzise aber flüchtig, `transcriptFact.mtime` überlebt Neustarts, ist aber als Signal widerlegt“

Der Body von `523f5dca63c28fd89a045eb9bcda67352cc858ac` beschreibt die Epochen-Fehlerform und die Reparatur. Der aktuelle Code sagt in `server.ts:10065-10075`:

> „`lastOutput` stayed 0, so `now - s.lastOutput` read as ~1.79e12 ms“

und setzt anschließend:

> `s.lastOutput = Date.now();`

**Gemessen.** `7941c3f` und `523f5dc` sind beide Ancestors des aktuellen HEAD. Eine gezielte Client-Suche findet Verwendungen von `lastOutput` für Aktivitätslogik, aber keine gerenderte „Zeit der letzten Ausgabe“; die Produktidee ist also nicht still erledigt worden. Die Queue-Zeile bleibt `pending/note`.

**Begründung.** Der dauerhafte Brief bewahrt genau die offene Produktentscheidung, und die separat behauptete Restart-Korrektur ist im aktuellen Code vorhanden. Der Worker behauptet nicht, die gewünschte Anzeige sei gebaut, sondern nur, dass die alte schädliche Epochen-Lesart behoben und das Wissen andernorts gesichert ist. Das tragen die Belege.

## `63626cdb` — BESTÄTIGT

**Gelesen.** `docs/attic/backlog-2026-07.md:424-436` nennt den Audit-Log und anschließend wörtlich die drei Reste:

> „Deferred / not built: WS guest-identity plumbing (`CF-Connecting-IP` / `Host`), guard()/404-rejection aggregation, retention beyond the single 5 MB rotation.“

Die Abwägungen stehen ebenfalls dort: `:462-467` behandelt Verlässlichkeit und Spoofbarkeit der Client-Identität; `:469-474` fragt nach Scanner-Rauschen und Retention. `briefs/work-waves-2026-08-07.md:220-225` sagt über `63626cdb`:

> „stehen weiter als startbare `lane`-Zeilen da, die sich im ersten Satz selbst als ‚NOTIZ — kein Arbeitsauftrag‘ deklarieren.“

**Gemessen.** Die aktuelle Queue bestätigt `63626cdb` als `pending/lane`. Der aktuelle Code enthält weiterhin `AUDIT_ROTATE_BYTES` mit Default 5.000.000 und beschreibt genau eine Generation (`audit.jsonl -> audit.jsonl.1`); `CF-Connecting-IP` hat im Code 0 Treffer.

**Begründung.** Inhalt, Deferred-Status und offene Abwägungen sind im Attic vollständig gesichert; der zusätzlich behauptete Kind-Formfehler ist in Brief und aktueller Queue belegt.

## `97f529b1` — BESTÄTIGT

**Gelesen.** `docs/attic/backlog-2026-07.md:745-760` trägt die komplette Begründung. Entscheidend sind `:751-756`:

> „Do not build this first. […] A wrong auto-classification injects an unsolicited message […] it's more trusted precisely because it looks adaptive. Prove the Phase 1 signals are the right ones […] before automating the judgment.“

Der Body von `c366c66` führt Phase 1+2 als gelandet und `97f529b1` ausdrücklich als Note.

**Gemessen.** Eine getrackte Code-Suche nach Smart-Auto-/Auto-Klassifikator-Markern findet keinen entsprechenden Implementierungspfad; die Zeile ist weiterhin `pending/note`.

**Begründung.** Der zitierte Attic-Abschnitt enthält genau Nutzen, Risiko und harte Reihenfolge, auf die sich das Worker-Verdikt beruft.

## `b759e8d9` — WIDERLEGT

**Gelesen.** Der Sachbeleg selbst ist stark. `docs/autonomy-map-2026-08-06.md:277-286` sagt:

> „`sinceLastLook` schlüsselt nach Branchname — offen“

und:

> „von zwei `main` überlebt eines […] Wechselt [die Iterationsreihenfolge] zwischen zwei Pulsen, meldet `rewritten` einen Rewrite, den es nicht gab“

Der aktuelle Code bestätigt das in `server.ts:11275`:

> `out[wt.branch] = { head, base, landed, repo: wt.repo };`

sowie in `:11279-11281` mit dem Skip `out[br.out]`; `sinceLastLookView` greift in `:11303-11307` ebenfalls ausschließlich per Branch-Key zu.

Der zusätzlich als Beleg genannte Commit `3b22aa8d51042c857196adddaf066e405c08742c` trägt diesen Befund jedoch nicht. Sein Body und sein Diff an `docs/autonomy-map-2026-08-06.md` behandeln §11.3 „Schritt A“ (Drift-Audit). `git blame -L 277,286` weist alle entscheidenden `sinceLastLook`-Zeilen stattdessen `5d707bca` zu.

**Gemessen.** `ast-grep --pattern '$OUT[$KEY] = $VALUE' --lang ts server.ts` findet die beiden strukturellen Zuweisungen `out[wt.branch]` und `out[br.out]` bei 11275/11281. Die Queue-Zeile bleibt `pending/note`; der branch-only Defekt ist im aktuellen Code also nicht zwischenzeitlich erledigt.

**Begründung.** Inhaltlich bestätigen Dokument und Code das Worker-Argument. Nach der vorgegebenen strengeren Belegfrage ist das Verdikt dennoch **WIDERLEGT**, weil einer der ausdrücklich zitierten Belege — `3b22aa8` — die behauptete Provenienz nicht trägt. Der richtige Einführungscommit des entscheidenden Dokumentabschnitts ist `5d707bca`.

## `efc98cfa` — WIDERLEGT

**Gelesen.** Die Kern-Wissenssicherung ist vorhanden. Der Body von `c02a0d4931709e7a509e24ce7ec3ef07059ef58c` sagt:

> „Der Groupchat (Notiz efc98cfa) ist ausdrücklich nicht Teil dieser Zeile.“

`briefs/steward-kritik-2026-08-07.md:377-379` sagt:

> „`efc98cfa` (Groupchat) hängt an der Ernte: ohne Leser für `[pulse-reply]` gibt es keinen zweiten Gesprächszug. […] nie gelesen worden.“

und die letzte Zeile `:592` grenzt erneut aus:

> „Nicht Teil: die `[pulse-reply]`-Ernte, die Rundgang-Schrumpfung, der Groupchat (`efc98cfa`).“

Der konkrete Codebeleg des Workers ist aber falsch bezeichnet. `server.ts:9605` lautet im aktuellen Baum und bereits im Verdikt-Commit `d92a1aa9`:

> `kind: "lane", repo: null, status: "pending", created: now, slot: null, note: null,`

Die umgebenden Zeilen `:9575-9610` zeigen eindeutig `handleIntake`, `source:"intake"` und die Route `/intake` — nicht den behaupteten Owner-Create-Pfad. Der echte aktuelle Owner-Create-Pfad steht bei `server.ts:13790-13806`, entscheidend `:13805`:

> `source: "owner", from: null, kind: "lane", repo: taskRepo,`

**Gemessen.** Die aktuelle Queue bestätigt `efc98cfa` als `pending/lane`. Eine Suche nach `[pulse-reply]` findet im Server Scaffold-/Quote-Behandlung, aber keine Ernte, die den Marker als Gesprächsantwort klassifiziert; ein Groupchat ist nicht zwischenzeitlich gebaut.

**Begründung.** Der Kernschluss „Wissen ist im Steward-Brief gesichert“ ist belegt, ebenso der tatsächliche Owner-Create-Formfehler an anderer Stelle. Die ausdrücklich behauptete Aussage über den zitierten Pinpoint `server.ts:9605` ist trotzdem falsch. Nach der Auftragsdefinition („der Beleg … sagt etwas anderes“) ist das Worker-Verdikt daher **WIDERLEGT**, nicht bloß mit einer kosmetischen Zeilenkorrektur bestätigt.

## Meine schwächste Aussage

Am ehesten könnte meine Einordnung von `efc98cfa` kippen. Wenn „der Beleg trägt“ auf die Belegmenge als Ganzes bezogen wird, wäre **BESTÄTIGT** vertretbar: Commit und Brief tragen den Kernschluss, und der behauptete Owner-Create-Fakt ist am aktuellen Code bei `server.ts:13805` wahr. Ich werte hier strenger, weil der Worker nicht bloß eine veraltete Zeilennummer nennt, sondern `server.ts:9605` ausdrücklich als Owner-Create-Pfad charakterisiert, obwohl es schon im Verdikt-Commit der Intake-Pfad war. Genau diese Art falscher Pinpoint ist nach dem Auftrag ein WIDERLEGT-Grund.

Keine Test-Suite wurde ausgeführt. Es wurden keine Dateien im Quellrepo verändert.
