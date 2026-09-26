---
frage: Liefert codex/gpt-6-luna/high auf fertig definierten Queue-Zeilen (Groesse klein oder mittel) dasselbe Ergebnis wie codex/gpt-6-sol/high bei deutlich weniger Tokens, und fuer welche Zeilenklasse wird Luna damit Default?
urteil: Noch keines. Das ist die Vorregistrierung; Auswahl, Messgroessen, Blindlesung und Entscheidungsregel sind festgelegt, bevor ein Luna-Lauf startet.
bereich: [routing, modellwahl, queue-effizienz, codex, kosten, ab-lauf]
belege: [fleet.json tasks, tasks-archive.jsonl, lane-outcomes.jsonl, audit.jsonl merge_verdict, git notes fleet/land, fleet-reports.jsonl, ~/.codex/sessions Rollouts]
nicht-gemessen: Ob jede VERIFY heute an ihrem forkSha noch gruen laeuft. Ob der Codex-Wochendeckel gecachten Input voll, anteilig oder gar nicht zaehlt. Codex-Sub-Agent-Sitzungen mit anderem cwd (die Sol-Tokens sind deshalb eine Untergrenze). Rueckfragen sind per Slot und Zeitfenster zugeordnet, also abgeleitet.
stand: 2026-09-26
---

# A/B-Replay Sol gegen Luna: Vorregistrierung

**Anlass.** Owner am 26.09. gegen 16:0x, wörtlich: „Ich denke wir sollten auch mal in betracht ziehen und einen A/B lauf dazu zu machen, ob es nicht sinn machen könnte für gewisse [Aufgaben] dann vllt auch gpt6 luna zu verwenden, zumal wir die aufgaben oft ja auch schon sehr genau definieren, hier könnte ein saubereres routing sich auch ungemein für unsere usage lohnen". Die Orchestratorin (Slot 9) hat das an das Program Fleet-Betrieb gegeben, mit dem Design-Vorschlag „Replay statt Parallelpaar". Die Codex-Woche stand bei 69 % nach 12 % der Zeit.

**Design: Replay.** Jede ausgewählte Zeile hat Sol bereits fertig gemacht und gelandet; der Sol-Arm existiert also schon. Zu bezahlen ist nur der Luna-Arm. Dieses Design übernehme ich unverändert. Ein Parallelpaar würde den Sol-Arm ein zweites Mal kaufen, und das bei einem Kontingent, das schon zu 69 % verbraucht ist.

## 1. Die Auswahl (vor jedem Lauf festgelegt)

Grundgesamtheit: 65 Lane-Ausgänge mit `gpt-6-sol` zwischen dem 19.09. und dem 26.09. Davon qualifizieren sich 56 (done, `auftrag`, Größe klein oder mittel, DONE und VERIFY nicht leer, forkSha bekannt, Sol-Rollout gefunden). Ausgeschlossen sind 7 Zeilen der Größe gross und 2 killed-empty-Zeilen; 167cb72c hat keinen Lane-Ausgang. Vor dem 23.09. lief Sol als `gpt-5.6-sol`. Diese 25 Ausgänge gehören nicht in die Grundgesamtheit, weil das Modell ein anderes ist. Nicht aufgenommen habe ich außerdem Entwürfe und Notizen, die ein Owner-Urteil brauchen, Zeilen, deren DONE Screenshots verlangt, und die Demo-Zeilen (deren VERIFY baut aus dem Live-Checkout, nicht aus dem Fork).

Die Tabelle zeigt acht Zeilen aus vier Programs, vier klein und vier mittel. „Gate 1." heißt: grün im ersten Land-Versuch. Tokens sind Rollout-Summen im Format total / davon gecacht / output.

| Zeile | Program | Größe | forkSha | Gate 1. | Rückfr. | abgelehnt / Reports | Sol-Tokens | Flächen-Dateien | Inhalt |
|---|---|---|---|---|---|---|---|---|---|
| 633e1e3a | f170dc46 | klein | 0b8060c0 | ja | 0 | 0/1 | 32 160 515 / 31 937 920 / 34 023 | 2 | z.ai-1310-Wochenlimit erkennen |
| 882fd266 | f170dc46 | klein | db032ea9 | ja | 0 | 0/1 | 8 068 866 / 7 949 568 / 17 615 | 2 | Slash-Befehl über `/send` ohne Zustell-Kopf |
| ab9b6901 | 6dee5d07 | klein | 8f3664fd | ja | 0 | 0/1 | 17 240 065 / 17 081 728 / 27 304 | 1 | e2e/merge.ts: Self-Land-Check löscht seine eigene Zeile |
| 96f44b47 | 98f3eef9 | klein | ad1e079c | ja | 0 | 0/1 | 786 463 / 740 480 / 8 781 | 4 | Jev: Ertrinken unter festem Block |
| 738a2f5c | 98f3eef9 | mittel | e5eddaaf | ja | 0 | 0/1 | 1 544 380 / 1 447 552 / 13 204 | 4 | Jev: Treffer bricht Aktion ab, Fernkampf-Radius |
| db0c829e | 98f3eef9 | mittel | 965c71b6 | ja | 0 | 0/1 | 1 247 651 / 1 163 904 / 11 390 | 5 | Jev: Rückzug = eingraben, dann essen (T1–T14, S1–S4) |
| e43d4314 | 6dee5d07 | mittel | 7b07f26a (overhaul) | ja | 2 | 0/1 | 9 329 155 / 9 147 648 / 22 619 | 3 | `GET /api/self` mit position/receiver |
| f2a66799 | 0d51b4d4 | mittel | 97a958a4 | ja | 0 | 0/1 | 3 006 521 / 2 910 976 / 10 862 | 2 | Resize-Reseed schneidet nicht mehr ab, Single-Flight-Poll |

Ersatzzeilen in dieser Reihenfolge, falls eine Zeile an ihrem forkSha nicht mehr startbar ist: 2877d96c (f170dc46, mittel), 7656496c (f170dc46, klein). Die volle Kandidatenliste lag zur Auswahl im Scratchpad dieser Session und ist hier nicht abgelegt. Die acht Zeilen oben sind die Auswahl, und gegen sie wird gemessen.

## 2. Durchführung des Luna-Arms

- Je Zeile ein Wegwerf-Branch `ab/luna-<id>` auf dem forkSha der Sol-Lane. Die Replay-Zeile bekommt den unveränderten Kartentext der Originalzeile, außer `ROLLE: codex/gpt-6-luna/high`, dazu `base: ab/luna-<id>`, und läuft in diesem Program. Ein Land findet nicht statt. Nach der Ernte werden Branches und Worktrees gelöscht.
- Die Rückfragen der Luna-Lanes beantworte ich, ohne das zu verraten, was der Sol-Arm erst durch Nachbesserung gelernt hat. Jede Antwort wird wörtlich notiert.
- Eine Zeile wird nicht nachgeschärft. Wenn Luna an einer Karte scheitert, an der Sol nicht gescheitert ist, ist genau das das Ergebnis.
- Ein bekanntes Hindernis: Die Kollisionslesung vergleicht Flächen über Basisgrenzen hinweg (Zeile 7cbef9a6, noch nicht gelandet). Die Replay-Zeilen können deshalb hinter echten Lanes auf denselben Dateien warten. Das kostet Zeit, verfälscht aber keine Messgröße.

## 3. Die Messgrößen (nur diese)

Kontext-Prozent und Lane-Laufzeit gehören nach der Owner-Regel vom 14.09. nie in einen Modellvergleich. Gemessen werden:

1. **DONE erfüllt: ja, teilweise oder nein.** Ein Leser, der den Arm nicht kennt, beurteilt das gegen die DONE-Zeile der Karte. Der Leser ist ein frischer Claude-Subagent (Opus 5.5). Je Zeile bekommt er den Kartentext und zwei Diffs als `git diff <forkSha>..<tip>`, ohne Log, Commit-Nachrichten und Co-Authored-By-Zeilen, bezeichnet als A und B. Die Zuordnung ist vorab festgelegt: Nach Zeilen-ID aufsteigend sortiert ist A auf Rang 1, 3, 5 und 7 Sol, auf Rang 2, 4, 6 und 8 Luna. Sol ist also A bei 633e1e3a, 882fd266, ab9b6901 und e43d4314. Der Leser erfährt die Zuordnung nicht.
2. **Gate grün im ersten Anlauf.** Für Sol aus dem Land-Ledger, wie in der Tabelle: genau ein `merge_verdict` und `verify.ok` in der fleet/land-Note. Für Luna läuft das Verify-Kommando des Repos genau einmal auf dem Tip des ersten Done-Reports. Das ist asymmetrisch, denn Sols Gate lief nach dem Rebase auf das damalige main, Lunas am Fork. Das nehme ich in Kauf, weil ein Land für Luna nicht stattfindet.
3. **Diff innerhalb der FLAECHE.** Maßgeblich ist `git diff --name-only <forkSha>..<tip>` gegen FLAECHE+NEU der Karte. Gezählt wird die Zahl der Dateien außerhalb.
4. **Rückfragen und Nachbesserungen.** Rückfragen sind Clarifications der Lane. Nachbesserungen sind abgelehnte Reports plus MAIN-Nachrichten an die Lane, die einen Fehler benennen.
5. **Tokens als Kosten.** Gemessen am letzten `token_count` je Rollout der Lane, summiert: total, gecachter Input, nicht gecachter Input und output getrennt. Bei Sol sind 97–99 % des totals gecachter Input. Welcher Anteil den Wochendeckel treibt, ist UNGEMESSEN (siehe Frontmatter). Deshalb zählen zwei Kostenzahlen: das total und die Summe aus nicht gecachtem Input und output.

## 4. Die Entscheidungsregel (vorab)

Klassen sind die Größen **klein** und **mittel**, je vier Zeilen. Eine Unterteilung nach Art (Jev-Reinfunktion, Server, Test) wird berichtet, trägt aber keine Entscheidung, weil pro Art höchstens drei Zeilen vorliegen.

Luna wird Default einer Klasse, wenn **alle** fünf Bedingungen gelten:

- (a) **DONE:** In der Klasse erfüllt Luna mindestens so viele Zeilen mit „ja" wie Sol. Ein „teilweise" zählt als nicht erfüllt.
- (b) **Gate:** Luna ist mindestens so oft im ersten Anlauf grün wie Sol.
- (c) **Fläche:** In der Summe über die Klasse liegen bei Luna höchstens so viele Dateien außerhalb der FLAECHE wie bei Sol.
- (d) **Kosten, X = 30 %:** Der Median der gepaarten Quotienten Luna durch Sol liegt je Zeile bei **höchstens 0,70**, und zwar für das total UND für nicht gecachten Input plus output. Gepaart und als Median wird gerechnet, weil die Sol-Kosten innerhalb derselben Größe um den Faktor 40 streuen (klein: 0,79 M bis 32,2 M).
- (e) **Aufwand:** Luna braucht in der Klasse höchstens eine Rückfrage oder Nachbesserung mehr als Sol.

**Warum X = 30 %.** Bei vier gepaarten Zeilen je Klasse ist ein kleinerer Abstand vom Rauschen nicht zu trennen, denn dieselbe Kartengröße streut über eine Größenordnung. 30 % ist der kleinste Gewinn, der eine Default-Umstellung trägt, deren Folgekosten (eine schlechtere Lane, eine Nachbesserung) sonst schnell den Gewinn auffressen.

**Was das Ergebnis bewirkt.** Das Ergebnis wird Default je Klasse im Modell-Register (`model-register.ts`, auf overhaul), keine Einzelregel in einer Karte. Besteht nur klein, wird nur klein umgestellt. Eine Karte mit ausdrücklicher ROLLE behält ihre ROLLE.

**Grenze der Aussage.** n = 4 je Klasse ist ein Routing-Entscheid mit Rückweg, kein Beweis. Das Register macht die Umstellung reversibel. Die ersten 20 Luna-Zeilen nach der Umstellung werden mit denselben Größen (a) bis (e) nachgezählt. Fällt dort (a) oder (b) unter den Sol-Wert der Grundgesamtheit, wird die Klasse zurückgestellt.

## 5. Was schon mit Luna lief (kein Arm dieses Versuchs)

Vier Zeilen sind mit `gpt-6-luna` gelaufen und gelandet: 595dde92, 08377558, 8ffd0e69 und 3ce4f1b4. Zwei weitere stehen in der Queue: 48006ce2 und dcb96685; bei dcb96685 nennt die Karte Sol, der Spawn-Datensatz aber Luna. Keine davon gehört zur Auswahl. Sie werden im Ergebnis beschreibend genannt und nicht gezählt, weil ihnen der gepaarte Sol-Arm fehlt.
