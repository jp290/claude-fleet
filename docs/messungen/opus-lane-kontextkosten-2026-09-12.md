---
frage: Wie viel Kontext belegt eine Opus-5-Lane vor ihrem ersten produktiven Schritt, und wodurch?
urteil: Opus 5 erreicht den vorgegebenen Marker bei median 177297 Tokens; der Median der [1m]-Teilgruppe liegt bei 18,10 Prozent der Million-Token-Bezugsgröße.
bereich: [lane-kontext, transkripte, betriebsledger]
belege: [lane-outcomes.jsonl, server.ts#createWorktree, docs/tailored-context.md]
nicht-gemessen: Geldkosten, tatsächliche Kontextfenster aller Sessions, Arbeitsqualität und Tokenanteile einzelner automatisch geladener Quellen
stand: 2026-09-12
---

# Kontextkosten vor dem ersten produktiven Schritt

## Ergebnis in drei Sätzen

Bei den 187 expliziten Opus-5-Lanes mit Marker entfallen 24,35 % ihrer summierten Request-Inputtokens auf Requests vor diesem Marker (Median der einzelnen Lane-Anteile: 41,0 %); der Kontext am Marker beträgt median 177.297 Tokens, p90 258.571.
Der Vorlauf beginnt bei den 198 expliziten Opus-5-Lanes mit median 68.942,5 Cache-Tokens und umfasst bei den 187 Lanes mit Marker median 52 Bash-Aufrufe; 98,86 % ihrer vor dem Marker zurückgegebenen Tool-Ergebnisbytes stammen aus Bash.
Ungemessen bleiben Geldkosten, Tokenanteile einzelner automatisch geladener Quellen und der tatsächliche Produktivbeginn bei früheren Bash-Schreibvorgängen, denn bei 153 der 187 Opus-5-Lanes ist der erste erfasste Marker erst `git commit`.

## Tabelle 1 — Kontext und Bash bis zum Produktivmarker

Jede Zelle zeigt Median / p90, dahinter den bekannten Nenner in Klammern;
`n/prod.` zählt alle zugeordneten Lanes / Lanes mit Marker, `unknown` ist kein Nullwert.
Der Median mittelt bei geradem Nenner die beiden mittleren Werte; p90 ist Nearest Rank
an Position `ceil(0,9 × n)` der aufsteigend sortierten Werte.

| Modellgrenze | Outcome | n/prod. | erster Cache-Kontext | Kontext am Marker | Bash davor | Endkontext | Marker/Ende % |
|---|---|---:|---:|---:|---:|---:|---:|
| Opus 5 (explizit) | Gesamt | 198/187 | 68942,5 / 94802 (198) | 177297 / 258571 (187) | 52 / 110 (187) | 232847,5 / 385782 (198) | 77,1 / 97,9 (187) |
| Opus 5 (explizit) | landed | 182/180 | 69081 / 94828 (182) | 174325 / 256419 (180) | 51,5 / 106 (180) | 234519 / 385782 (182) | 75,6 / 97,9 (180) |
| Opus 5 (explizit) | killed-empty | 9/0 | 65608 / 80783 (9) | unknown / unknown (0) | unknown / unknown (0) | 141398 / 314007 (9) | unknown / unknown (0) |
| Opus 5 (explizit) | killed-dirty | 4/4 | 64529,5 / 66501 (4) | 218825 / 234807 (4) | 53,5 / 64 (4) | 235886,5 / 519497 (4) | 97,4 / 99,1 (4) |
| Opus 5 (explizit) | shelved | 3/3 | 64252 / 68181 (3) | 264209 / 321159 (3) | 83 / 142 (3) | 359440 / 371565 (3) | 86,0 / 86,4 (3) |
| Alias opus (unklar) | Gesamt | 16/16 | 65891,5 / 95728 (16) | 163957,5 / 277072 (16) | 40,5 / 115 (16) | 212102,5 / 361083 (16) | 72,4 / 96,9 (16) |
| Alias opus (unklar) | landed | 13/13 | 65406 / 95728 (13) | 151145 / 277072 (13) | 33 / 115 (13) | 213514 / 324424 (13) | 71,4 / 94,7 (13) |
| Alias opus (unklar) | killed-dirty | 3/3 | 66427 / 66905 (3) | 204064 / 207182 (3) | 70 / 80 (3) | 210691 / 430161 (3) | 87,0 / 99,7 (3) |
| Modell unbekannt | Gesamt | 62/49 | 66364 / 93476 (61) | 138668 / 221493 (49) | 32 / 87 (49) | 163750 / 320721 (61) | 83,3 / 96,3 (49) |
| Modell unbekannt | landed | 46/44 | 64799 / 69016 (45) | 139061 / 221493 (44) | 39 / 87 (44) | 168760 / 331633 (45) | 84,7 / 96,3 (44) |
| Modell unbekannt | killed-empty | 14/3 | 92847,5 / 94101 (14) | 138668 / 173202 (3) | 27 / 28 (3) | 99287 / 265175 (14) | 60,8 / 86,5 (3) |
| Modell unbekannt | killed-dirty | 1/1 | 64187 / 64187 (1) | 104745 / 104745 (1) | 8 / 8 (1) | 125738 / 125738 (1) | 83,3 / 83,3 (1) |
| Modell unbekannt | shelved | 1/1 | 62058 / 62058 (1) | 168817 / 168817 (1) | 30 / 30 (1) | 206968 / 206968 (1) | 81,6 / 81,6 (1) |
| Andere Modelle | Gesamt | 71/33 | 67198 / 74070 (36) | 157917 / 249985 (33) | 24 / 59 (33) | 167439 / 295941 (39) | 85,1 / 94,9 (31) |
| Andere Modelle | landed | 59/28 | 68423,5 / 74070 (28) | 150412,5 / 278842 (28) | 20,5 / 62 (28) | 177455,5 / 295941 (30) | 83,8 / 94,9 (26) |
| Andere Modelle | killed-empty | 4/1 | 62248,5 / 97862 (4) | 111771 / 111771 (1) | 2 / 2 (1) | 115453 / 167439 (4) | 96,1 / 96,1 (1) |
| Andere Modelle | killed-dirty | 1/1 | 63575 / 63575 (1) | 174183 / 174183 (1) | 47 / 47 (1) | 230421 / 230421 (1) | 75,6 / 75,6 (1) |
| Andere Modelle | shelved | 7/3 | 63909 / 67327 (3) | 158366 / 162086 (3) | 30 / 59 (3) | 167703,5 / 253741 (4) | 93,4 / 94,6 (3) |

Bezug zur Owner-Hypothese: Von 168 Lanes mit Outcome-Modell `claude-opus-5[1m]` haben
159 einen Marker; dort beträgt dessen Kontext median **18,10 %**, p90 **26,59 %** von
1.000.000 Tokens, der Median liegt also unter 20 %, das p90 zwischen 20 und 30 %.
Die Million ist die aus dem gespeicherten Tag gewählte Bezugsgröße; die tatsächliche
Fensterkonfiguration jeder Session wurde nicht rekonstruiert.
`Marker/Ende` vergleicht zwei Kontextstände je Lane: bei Opus 5 median 77,1 %, p90 97,9 %;
55 der 198 Lanes enthalten mehrere Sessions, zwei eine erkannte Compaction, eine einen
Quotienten über 100 %, weshalb dieser Quotient keinen aufsummierten Verbrauch misst.

## Tabelle 2 — Erste zehn Bash-Aufrufe der Opus-5-Lanes

Nenner: 198 zugeordnete explizite Opus-5-Lanes, davon 197 mit mindestens einem aus dem direkten Transkript lesbaren Bash-Aufruf; gezählt wurden 1968 der höchstens ersten zehn deduplizierten Bash-Aufrufe je Lane.

| Rang | normalisiertes Muster | Anzahl |
|---:|---|---:|
| 1 | `read files <…>` | 879 |
| 2 | `search files <…>` | 637 |
| 3 | `git history/ref <…>` | 172 |
| 4 | `GET /api/self/gate` | 92 |
| 5 | `git status <…>` | 85 |
| 6 | `script <…>` | 34 |
| 7 | `git diff <…>` | 13 |
| 8 | `inspect paths <…>` | 12 |
| 9 | `<other command>` | 9 |
| 10 | `bun test/check <…>` | 8 |

Die Kategorien stammen aus einer festen Allowlist. Pfade und Argumente werden als `<…>` ersetzt; API-Querys werden entfernt und dynamische IDs nur als `:id` klassifiziert. Rohkommandos werden weder ausgegeben noch gespeichert.

Ein Bash-Aufruf erhält genau eine Kategorie: zuerst eine erkannte Self-API-Route,
danach das erste passende Muster der geordneten Allowlist; zusammengesetzte Kommandos
werden nicht in Einzelbefehle zerlegt, und die Einordnung ist lexikalisch.
Die Tabelle zählt Aufrufe innerhalb der ersten zehn, unabhängig vom Produktivmarker;
„read files“ und „search files“ umfassen zusammen 1.516 von 1.968 Aufrufen (77,03 %).

## Grundmenge und Messdefinitionen

Untersuchter Codebaum: `edbc153a78a7e83f30b0b95809446de1a8b608c6`.
Zum eingefrorenen Messstand findet der exakte Glob `~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-*/`
349 Verzeichnisse, alle mit direktem JSONL-Transkript: **347 ausgewertet mit
Outcome-Join + 2 ohne Join = 349**.
Die breitere Teilstringsuche findet die im Brief genannten 351 Verzeichnisse; zwei davon
kodieren `/private/tmp`-Scratchpad-Pfade und gehören nicht zum vorgegebenen Glob.
Ohne Join: `fleet/260819145220-1831` und `fleet/260821172044-475f`.

Gelesen wurden 553 direkte JSONL-Dateien mit 269.952 Zeilen und null Parsefehlern;
17 verschachtelte Subagent-Dateien sind ausgeschlossen, weil deren eigener Kontext
nicht der Kontext der Lane-Hauptsession ist, zurückgelieferte Tool-Ergebnisse zählen mit.
Das Ledger wurde bei 901 Zeilen und 1.222.764 Bytes eingefroren: 348 passende Zeilen
werden nach Branch zu 347 Lanes zusammengeführt, jüngstes `ts` gewinnt.
Ein Doppelbranch wechselt dadurch von `killed-dirty` zu `landed`, bei unverändertem
Opus-5-Modell; gegenüber der ersten Auswahl kommt also ein Land hinzu und ein Kill entfällt.

Modellgruppen stammen aus dem Outcome: `claude-opus-5[1m]`, `claude-opus-5` und
`claude-bridge/claude-opus-5` bilden die explizite Opus-5-Gruppe (198 Lanes).
Der Rest wird in Alias `opus` (16), fehlendes Modell (62) und andere Modellwerte (71)
geteilt; `shelved` bleibt enthalten, damit der Nenner vollständig ist.
Die Transkripte enthalten `claude-opus-5` bei 197/198 expliziten, 16/16 Alias-, 59/62
modelllosen und 5/71 anderen Lanes: Outcome-Modell und tatsächliche historische
Ausführung sind daher keine identischen Kohorten, Modellwechsel bleiben sichtbar.
Eine explizite Opus-Lane enthält ausschließlich synthetische Assistant-Zeilen;
ihre gespeicherten Usage-Werte werden gemäß der vorgegebenen Zeilendefinition mitgezählt.

Es gilt der gesamte vorhandene Transkriptbestand ohne Datumsfilter; der zeitlich begrenzte
Land-Nenner aus `docs/messungen/audit-ursachen-und-lane-diffmix-2026-09-12.md:93`
ist deshalb keine Vergleichsgrundmenge für diese Tabelle.
Der Delta-Bericht zählt berührte Dateien und Commits, keine individuelle Produktivität
(`docs/messungen/codebase-report-2026-09-12.md:204`).

„Produktiv“ ist hier ausschließlich der erste Aufruf von `Edit`, `Write`, `NotebookEdit`
oder eines ausführbaren `git commit`; ein erfolgreicher Schreibvorgang oder fachlicher
Fortschritt ist damit nicht bewiesen, und Schreiben durch andere Bash-Kommandos bleibt
außerhalb dieses Markers.
Der erste Turn zählt wie beauftragt nur `cache_creation_input_tokens` plus
`cache_read_input_tokens`; Kontext am Marker und Endstand addieren auch `input_tokens`.
Kontextstände werden nicht über Turns summiert; kumulierte Request-Tokens enthalten
wiederholt gelesenen Cache und sind deshalb eine andere Messgröße.

## Verbrauchsquellen und heutige Startumgebung

Vor dem Marker der 187 expliziten Opus-5-Lanes: 12.193 Tool-Aufrufe, davon 12.038 Bash;
280 dieser Bash-Aufrufe enthalten `curl` und `/api/self/` (2,33 %).
In allen 198 expliziten Opus-5-Lanes: 28.626 Bash-Aufrufe, davon 2.309 mit dieser
Self-API-Signatur (8,07 %); median 91, p90 235 Bash-Aufrufe je Lane.
Der lexikalische Treffer beweist weder die Ausführung von `curl` noch einen erfolgreichen API-Call.

Explizite `Read`-Aufrufe: vor dem Marker 63, insgesamt 915;
Zielanteile vor dem Marker: `CLAUDE.md` 0/63, `AGENTS.md` 1/63, `docs/` 2/63;
Zielanteile insgesamt: `CLAUDE.md` 0/915, `AGENTS.md` 1/915, `docs/` 2/915.
Die Zielklassen können überlappen; Lesen per Bash und automatisch geladene Dateien
gehören nicht zu diesem Read-Nenner.

Tool-Ergebnisbytes vor dem Marker: 28.423.509, davon Bash 28.100.031, Read 291.315;
insgesamt über alle 198 Opus-Lanes 37.474.242 Bytes, davon Bash 36.675.578 und Read 573.942.
Je Opus-Lane insgesamt: median 173.720,5 Bytes, p90 328.779;
Assistant-Turns median 97,5, p90 242, gezählt als eindeutige `message.id`.
String-Ergebnisse zählen UTF-8-Bytes, strukturierte Ergebnisse ihre kanonische kompakte
JSON-Darstellung; Bytes werden nicht ohne Tokenizer in Tokens umgerechnet.

Über dieselben 187 Opus-Lanes mit Marker summiert: 1.844.493.699 Request-Inputtokens
strikt vor dessen Request, 7.575.286.351 insgesamt; der Quotient ist 24,35 %.
Der Median der 187 individuellen Quotienten ist 41,0 %, p90 89,5 %;
Cache-Reads zählen bei jedem Request erneut, Output-Tokens gehören nicht zu diesem Quotienten.

Der gelesene Stand von `createWorktree` rendert das Lane-Regelwerk nach `CLAUDE.md`,
wenn eine Vorlage vorhanden ist und Git die Datei ignoriert (`server.ts:3784`);
der anschließende Kopierpfad berücksichtigt `.env`, `CLAUDE.md`, `OWNER.md` und
`.claude/settings.local.json` nur bei ignorierter Quelle und fehlendem Ziel
(`server.ts:3790`).
`docs/tailored-context.md:103` beschreibt den kompilierten Dispatch-Brief als ausgelieferte
Änderung; `docs/tailored-context.md:130` begründet die Zustellung beim Start statt als
ungetrackte Datei.
Diese heutigen Quellen erklären mögliche Eingänge, nicht deren historische Tokenanteile;
private Regeltexte und der historische Prompt jedes Starts wurden nicht rekonstruiert.

## Reproduktion und Verifikation

Scratch: `/tmp/opus-lane-kontextkosten-2026-09-12.JSq2PO/`.
`joined-lanes.csv` enthält eine Zeile je ausgewerteter Lane einschließlich Branch,
Modell, Disposition, aller geforderten Kontext-/Aufruf-/Bytewerte, `sessionMs` und `commitCount`;
`lanes.json` enthält auch die beiden Lanes ohne Join und das Quellenmanifest.
`aggregates.json` hält sämtliche Gruppenwerte, `source-summary.json` die Verbrauchssummen.

```sh
cd /tmp/opus-lane-kontextkosten-2026-09-12.JSq2PO
python3 aggregate.py
python3 sources.py
python3 verify-report.py /Users/owner/claude-fleet/docs/messungen/opus-lane-kontextkosten-2026-09-12.md
```

Neu-Extraktion ohne Überschreiben des Messstands:
`python3 extract.py --output /tmp/opus-lane-kontextkosten-recheck.json`.
Die Aggregation verwendet `lanes.json` und den sanitisierten `outcomes-snapshot.json`;
`corpus-snapshot.json` fixiert den Verzeichnisnenner; für die ersten zehn Bash-Aufrufe
liest sie nur die gehashten Bytepräfixe der im Manifest benannten direkten Transkripte.
Ein nachträglich erschienenes Lane-Verzeichnis ließ die erste Wiederholungsprüfung des
Live-Zählers scheitern; Tabellenwerte blieben gleich, die erneute Prüfung fixiert den Nenner.
Appendierte Zeilen verändern diese Reproduktion nicht, geänderte Quellpräfixe brechen sie ab;
Scratch-Dateien sind kein getracktes Langzeitarchiv.

SHA-256 `lanes.json`: `917fb2ad8abbccb13f3b9debee4fd8de39a3dfee0e14a7090146def1e1142dd9`.
SHA-256 Ledger-Bytepräfix: `a3b6086b8735568e86341e73d4279fc42665c22acad3a94592b78281d8277ed2`.
SHA-256 Outcome-Snapshot: `954cc549e62fe41662b7f59e52f6f3de9f3d176f82ab247ed3eef3ecebff9250`.

Die Extraktion entfernt 26.588 zusätzliche Streamingzeilen nur aus Turn-/Usage-Summen,
erhält eigenständige Tool-Blöcke und zählt Tool-IDs einzeln; null Tool-/Result-Duplikate
und null widersprüchliche Usage-Werte derselben Message-ID wurden gefunden.
Chronologie: Zeitstempel, dann Datei-/Zeilen-/Blockreihenfolge; ohne Zeitstempel
folgt deterministische Dateireihenfolge, kein rekonstruierter Wall-Clock-Verlauf.
Im gesamten Korpus fehlen 64 Marker, 37 erste Cache-Stände und 34 Endstände;
34 Lanes enthalten keinen Assistant-Turn, drei weitere keinen vollständigen ersten Usage-Wert.
Die Git-Erkennung entfernt Heredoc-Inhalte, ist aber kein vollständiger Shell-Parser.

Ausgeführt: Extraktions-Prüffälle für Cache-Summe, UTF-8-Bytes, Git-Aufruf und
Heredoc-Prosa; erneute Aggregation, unabhängige Quantile aus der Lane-CSV, Abgleich
aller 553 Transkript-Bytepräfixe und des Ledgerpräfixes sowie leerer Credential-Scan.
Die Verifikationstails lauten:

```text
EXTRACT SEMANTICS ALL PASS
REAGGREGATION ALL PASS: seven artifacts byte-identical
REPORT CHECKS ALL PASS: coverage, table quantiles, 553 source prefixes, ledger prefix, secret scan, line cap
```

`bun e2e/pins.ts`, Tail:

```text
ALL PASS
```

Offene Grenze: keine Suite, kein Serverstart, keine Änderung unter `~/.claude/`;
das vorbestehende ungetrackte `.hub-prototype/` wurde nicht verändert.
