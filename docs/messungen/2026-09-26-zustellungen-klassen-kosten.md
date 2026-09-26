# Pane-Zustellungen nach Rolle und Klasse: Zahl, Bytes, Kontextstand

Stand 2026-09-26. Messfenster: **2026-09-19 02:45:41 UTC bis 2026-09-26 02:45:41 UTC** (sieben volle Tage). Dies ist die Vorher-Messung zur Buendelung; sie beschreibt Zustellvolumen und beobachtbare Kosten, nicht den Nutzen einer Buendelungsregel.

## Ergebnis

`audit.jsonl.1` und `audit.jsonl` decken das Fenster ab. In ihnen stehen 2.908 `send`-Versuche: 1.829 mit `acceptance=observed`, 901 mit `acceptance=unobservable`, 168 `SendRefused` und 10 `SendNotAccepted`. Die letzten 178 sind keine Zustellungen und bleiben aus den Tabellen. `unobservable` bedeutet: die Ankunft ist nicht bestaetigt; die Zeilen stehen getrennt von den bestaetigten Zustellungen.

Klassen werden ausschliesslich ueber `path` gebildet. Das ist eine nachvollziehbare Routen-Proxyregel, keine nachtraegliche Inhaltsklassifikation:

| Klasse | `path`-Werte |
|---|---|
| Aktion noetig | `owner`, `brief`, `founding`, `succession`, `clarification-reply`, `merge-author` |
| Quittung | `report-decision`, `merge-verdict` |
| Info | `inbox-nudge`, `migrate-nudge`, `auto`, `model-push` |
| Event | `fleet-event` |

### Beobachtete Ankuenfte, unbestaetigte Ankuenfte und Zustellbytes

Bytes summieren alle angenommenen Versuche (`observed` plus `unobservable`); sie messen die protokollierte Zustellnutzlast, nicht die Groesse des gesamten Session-Kontexts. Kontext-% ist der Mittelwert der vorhandenen `ctxPct`-Sensorwerte fuer diese angenommene Gruppe. `ctx n/N` gibt die Anzahl gemessener Werte unter allen angenommenen Versuchen an; fehlende Werte sind `UNGEMESSEN`.

| Empfaengerrolle | Klasse | Bestaetigt | Ankunft unbestaetigt | Bytes | Kontext-% n/N, Mittel |
|---|---|---:|---:|---:|---:|
| Orchestratorin | Aktion noetig | 61 | 62 | 245 666 | 98/123, 23,9 % |
| Orchestratorin | Quittung | 3 | 2 | 2 406 | 5/5, 21,6 % |
| Orchestratorin | Info | 21 | 0 | 5 680 | 21/21, 27,4 % |
| Orchestratorin | Event | 54 | 6 | 35 903 | 60/60, 23,1 % |
| Program-MAIN | Aktion noetig | 5 | 20 | 124 796 | 17/25, 15,3 % |
| Program-MAIN | Quittung | 0 | 1 | 1 705 | 1/1, 9,2 % |
| Program-MAIN | Info | 21 | 0 | 4 515 | 21/21, 19,6 % |
| Program-MAIN | Event | 31 | 1 | 18 181 | 32/32, 20,3 % |
| Lane | Aktion noetig | 232 | 611 | 4 637 830 | 453/843, 25,2 % |
| Lane | Quittung | 175 | 42 | 123 559 | 217/217, 27,5 % |
| Lane | Info | 493 | 6 | 131 415 | 496/499, 23,7 % |
| Lane | Event | 733 | 150 | 526 782 | 873/883, 23,8 % |
| **Gesamt** |  | **1 829** | **901** | **5 858 438** | **2 294/2 730, 24,2 %** |

Nach Klasse: Aktion noetig 298 bestaetigt / 693 unbestaetigt; Quittung 178 / 45; Info 535 / 6; Event 818 / 157. Die grosse Byte-Menge bei Lane/Aktion noetig stammt vor allem von `brief` (261 angenommene Zustellungen, zusammen 3 085 513 B); das sind Bytes aus `audit.jsonl`, nicht aus Nachrichtentexten.

### Zehn Belege je Klasse

Deterministische Stichprobe: zehn bestaetigte Zeilen je Klasse, gleichmaessig ueber die zeitlich sortierten Zeilen verteilt (Index `floor(i*(n-1)/9)`, `i=0..9`). Angezeigt werden nur Route, Rolle, Bytes und Sensorwert; kein Inhalt und keine Ereigniskennung. `UNGEMESSEN` bedeutet, dass die konkrete Zustellung keinen `ctxPct`-Wert traegt.

**Aktion noetig**

| # | Route | Rolle | Bytes | Kontext-% |
|---:|---|---|---:|---:|
| 1 | brief | Lane | 14 235 | UNGEMESSEN |
| 2 | owner | Lane | 4 045 | 6,9 % |
| 3 | owner | Lane | 64 | 38,9 % |
| 4 | owner | Lane | 2 657 | 20,2 % |
| 5 | owner | Lane | 72 | 7,9 % |
| 6 | owner | Lane | 568 | 31,1 % |
| 7 | owner | Lane | 492 | 29,8 % |
| 8 | owner | Orchestratorin | 189 | 29,5 % |
| 9 | owner | Lane | 172 | 30,1 % |
| 10 | owner | Orchestratorin | 732 | 23,0 % |

**Quittung**

| # | Route | Rolle | Bytes | Kontext-% |
|---:|---|---|---:|---:|
| 1 | report-decision | Orchestratorin | 436 | 8,1 % |
| 2 | report-decision | Lane | 499 | 7,2 % |
| 3 | report-decision | Lane | 503 | 9,9 % |
| 4 | report-decision | Lane | 600 | 13,9 % |
| 5 | report-decision | Lane | 647 | 16,5 % |
| 6 | report-decision | Lane | 610 | 38,2 % |
| 7 | report-decision | Lane | 549 | 8,4 % |
| 8 | report-decision | Lane | 260 | 23,4 % |
| 9 | report-decision | Lane | 629 | 77,6 % |
| 10 | report-decision | Lane | 354 | 22,0 % |

**Info**

| # | Route | Rolle | Bytes | Kontext-% |
|---:|---|---|---:|---:|
| 1 | inbox-nudge | Orchestratorin | 215 | 19,8 % |
| 2 | inbox-nudge | Lane | 215 | 23,0 % |
| 3 | inbox-nudge | Lane | 215 | 10,5 % |
| 4 | inbox-nudge | Lane | 215 | 13,1 % |
| 5 | inbox-nudge | Lane | 215 | 18,4 % |
| 6 | inbox-nudge | Lane | 215 | 25,4 % |
| 7 | inbox-nudge | Lane | 215 | 30,0 % |
| 8 | inbox-nudge | Lane | 215 | 18,2 % |
| 9 | inbox-nudge | Lane | 215 | 24,1 % |
| 10 | inbox-nudge | Program-MAIN | 215 | 11,3 % |

**Event**

| # | Route | Rolle | Bytes | Kontext-% |
|---:|---|---|---:|---:|
| 1 | fleet-event | Orchestratorin | 488 | 20,0 % |
| 2 | fleet-event | Lane | 853 | 25,3 % |
| 3 | fleet-event | Lane | 483 | 13,3 % |
| 4 | fleet-event | Lane | 554 | 31,2 % |
| 5 | fleet-event | Lane | 483 | 23,0 % |
| 6 | fleet-event | Lane | 504 | 18,8 % |
| 7 | fleet-event | Program-MAIN | 515 | 34,5 % |
| 8 | fleet-event | Lane | 490 | 30,5 % |
| 9 | fleet-event | Lane | 498 | 24,4 % |
| 10 | fleet-event | Program-MAIN | 544 | 13,1 % |

## Prompt-Stream als separate Byte-Sicht

`streams/prompts.jsonl` enthaelt im Fenster 5 394 Eintraege und 10 149 747 B Text-Payload. Die Textfelder wurden nur im Speicher fuer UTF-8-Byte-Laengen verarbeitet und nie ausgegeben. `source` ist der Prompt-Stream-Typ, kein Zustellpfad; diese Eintraege sind daher nicht zu den Audit-Zustellungen addierbar und es gibt keine 1:1-Zuordnung.

| Rolle | Stream-Quelle | Eintraege | Bytes |
|---|---|---:|---:|
| Orchestratorin | auto | 104 | 220 321 |
| Orchestratorin | owner | 99 | 64 689 |
| Orchestratorin | terminal | 360 | 343 374 |
| Program-MAIN | auto | 61 | 133 903 |
| Program-MAIN | owner | 17 | 14 339 |
| Program-MAIN | terminal | 83 | 132 491 |
| Lane | auto | 1 873 | 4 860 819 |
| Lane | owner | 460 | 444 874 |
| Lane | terminal | 2 337 | 3 934 937 |

## Tür-Lücken und die Klassifikationsgrenze

Die Rollen- und Pfadzaehlung misst eine Exposition gegen Rollen-Tueren, nicht den Inhalt oder den konkreten Wunsch einer Nachricht. Ohne Nachrichteninhalt kann die Messung nicht behaupten, eine Zustellung sei tatsaechlich an einer fehlenden Tuer gescheitert.

| Tür / Frage | Sieben-Tage-Beleg | Anteil / Aussage |
|---|---|---|
| MAIN hat keine separate Spawn-Tuer fuer eine bereits gefeilte Task | 79 angenommene Zustellungen an Program-MAIN; davon 25 auf Aktionspfaden | 2,9 % aller 2 730 angenommenen Sends gingen an Program-MAIN; Aktionspfade sind 25/79 = 31,6 %. Die optionale Spawn-Auswahl kann MAIN beim Filen setzen, aber nicht ueber eine Self-Spawn-Route nachtraeglich aendern. `task_spawn` steht 177-mal im Audit ohne Slot-Prinzipal; das belegt den Owner-Route-Umweg, aber ordnet ihn keiner MAIN zu. Die 25 Aktionspfade sind eine Obergrenze moeglicher Exposition, keine nachgewiesenen Spawn-Anfragen. |
| MAIN kann keine Task ins fremde Repo einstellen | `server.ts#createTaskForMain` leitet `repo` aus dem MAIN-Checkout ab; eine Repo-Auswahl steht nicht in den erlaubten Feldern. | Die 79/25 Program-MAIN-Zahlen sind nur die Rollen-Obergrenze. Audit-`send` traegt kein Ziel-Repo; die Zahl konkreter grenzueberschreitender Anfragen ist `UNGEMESSEN`. |
| MAIN hat kein Self-Land auf Overhaul | `program_promotion` auditiert `guarded` innerhalb des Fensters; der Overhaul-Record bindet MAIN Slot 5. Es gibt vier `self_land_start`-Zeilen auf Slot 5 im Fenster, davon eine nach Oeffnung der aktuellen Slot-5-Session. `server.ts#selfLandTaskForMain` enthaelt die gebundene Self-Land-Tuer. | Fuer diesen Program-Stand ist die Tuer nicht abwesend. Ein Start ist kein Beleg fuer einen erfolgreichen Land. Die Program-MAIN-Exposition bleibt 79/2 730 = 2,9 %; konkrete aufgrund der Promotion blockierte Sends sind nicht erkennbar. |

Als gemeinsamer Expositions-Zaehler sind 288/2 730 = 10,5 % der angenommenen Sends an Orchestratorin oder Program-MAIN gerichtet; davon liegen 148 (123 an die Orchestratorin, 25 an Program-MAIN) auf Aktionspfaden, also 5,4 % aller Sends. Das ist ein Rollen-/Pfad-Oberwert fuer moegliche Tuerrelevanz, keine kausale Betroffenheitsquote. Der Messpfad enthaelt keine typisierte Tuer-Ablehnung pro Zustellung.

### Was eine Pfadregel offenlaesst

`path=owner` klassifiziert eine Route bzw. das verwendete Owner-Credential, nicht den Sprecher. Im Fenster sind das 575/2 730 angenommene Sends (21,1 %); davon gingen 99/209 Orchestratorin-Sends ueber `owner` (47,4 %). Fuer diese 99 kann die Regel allein Owner→Orchestratorin und MAIN→Orchestratorin nicht trennen. Die vorgegebene Ein-Session-Beobachtung (Slot 9: 27 `owner`, ungefaehr 12 Owner und 15 MAIN→Orchestratorin) ist ein Beleg fuer genau diese Mehrdeutigkeit, aber keine Aufteilung der 99 Wochenzeilen. Diese 99 sind daher ein **Jev-Kandidat**; die Textinhalte wurden nicht gelesen und erlauben hier keine Intent-Klassifikation.

## Kontext-Tokens je belegbarem Slot-Modell

Der Token-Nenner wird nicht aus einer Modellfamilie geraten. `server.ts#contextReading` nimmt bei Claude das Modellfenster aus `src/protocol.ts#contextWindowFor`; fuer die an `fleet.json`-`openedAt` und Audit-`slot_open` gebundene aktuelle Empfaenger-Session ergibt `claude-opus-5-5[1m]` damit 1 000 000 Tokens. Beim Codex-Adapter kommt das Fenster dagegen aus derselben Rollout-Zeile wie `usedTokens` (`windowFromFile`), waehrend `audit.jsonl` nur `ctxPct`, nicht `windowTokens`, speichert. Darum bleiben die Codex-Snapshots trotz bekanntem Slot-Modell tokenmaessig `UNGEMESSEN`; der generische GPT-Nenner waere hier kein belegter Runtime-Nenner. Die Formel fuer jeden auswertbaren Sensorwert lautet `ctxPct / 100 × Modellfenster`. Mittelwerte sind Snapshots, nicht addierbarer Tokenverbrauch.

| Empfaengerrolle | Slot-Modell | Fenster | `ctxPct` n / Mittel | Mittlerer Kontextstand | Median |
|---|---|---:|---:|---:|---:|
| Program-MAIN | claude-opus-5-5[1m] | 1 000 000 | 53 / 16,6 % | ~165 981 Tokens | ~158 000 Tokens |
| Orchestratorin | claude-opus-5-5[1m] | 1 000 000 | 10 / 17,2 % | ~171 600 Tokens | ~183 000 Tokens |
| Program-MAIN | gpt-6-astra | UNBEKANNT | 18 / 25,0 % | `UNGEMESSEN` | `UNGEMESSEN` |
| Lane | gpt-6-astra | UNBEKANNT | 5 / 54,5 % | `UNGEMESSEN` | `UNGEMESSEN` |
| Lane | gpt-6-sol | UNBEKANNT | 3 / 43,4 % | `UNGEMESSEN` | `UNGEMESSEN` |
| Lane | gpt-6-luna | UNBEKANNT | 0 / — | `UNGEMESSEN` (1 Send ohne `ctxPct`) | `UNGEMESSEN` |

Von den 2 294 Sends mit `ctxPct` lassen sich 63 einem aktuellen Slot-Modell mit bekanntem Nenner zuordnen, 26 einer aktuellen GPT-6-Session ohne belegbaren Modellnenner. Weitere 2 205 Prozentwerte gehoeren zu historischen Slot-Besetzungen, deren damaliges Modell die erlaubten Snapshots nicht mehr tragen. 436 angenommene Sends haben schon keinen `ctxPct`-Sensorwert. Damit sind Kontext-Tokens fuer 2 667/2 730 angenommene Sends `UNGEMESSEN`; die 63 schaetzbaren Werte beschreiben nur den Kontextstand dieser Send-Momente, nicht die Tokenmenge der Nachricht.

## Methode und Grenzen

- Quellen: `audit.jsonl.1`, `audit.jsonl`, `streams/prompts.jsonl` sowie `fleet.json` im Haupt-Checkout. Die Audit-Rotation deckt das Fenster ohne Luecke ab; `audit.jsonl.archive` endet am 2026-09-07 und traegt nichts zum Messfenster bei.
- Zustellzaehlung: nur Audit-`event=send`; `acceptance=observed` ist bestaetigt, `unobservable` bleibt als Ankunft unbekannt separat, refusals und nicht angenommene Sends sind ausgeschlossen. `fleet_event_delivered` wurde nicht nochmals gezaehlt, um denselben Pane-Send nicht doppelt zu zaehlen.
- Rollen: Slot 9 ist die Orchestratorin. Program-MAIN-Sessions werden ueber `programs[].main.openedAt` mit dem naechsten `slot_open` desselben Slots (Abstand unter 2 s) verbunden. Die verbleibenden Empfaenger werden als Lane eingeordnet. Das ist die Zuordnung aus den aktuellen Fleet-Daten; historische Occupant-Wechsel, die in `fleet.json` nicht mehr stehen, sind damit nicht unabhaengig belegt.
- Tür-Proxies: `server.ts#createTaskForMain` und `server.ts#selfLandTaskForMain` pruefen die Repo- bzw. Land-Bindung; Audit-`send` hat keinen ablehnenden Tuergrund und `task_spawn` keinen Slot-Prinzipal. Daher sind die oben genannten Anteilswerte nur Rollen-/Routen-Obergrenzen.
- Modellnenner: `src/protocol.ts#contextWindowFor` plus `server.ts#contextReading` bestimmen die Claude-Fenster; der Codex-Adapter liest sein Fenster aus dem Rollout, aber das Audit persistiert es nicht. Historische Slot-Modelle sind in den erlaubten Audit-/Slot-Feldern nicht vollstaendig enthalten und werden nicht aus Harness oder Rolle erraten.
- Prompt-Stream-Schema: die Zeilen tragen `ts`, `slot`, `source` und `text`, aber kein `openedAt`-Feld. Die Zeitfilterung nutzt daher `ts`; Rollen werden wie oben ueber Slot-Oeffnung und MAIN-Bindung zugeordnet. Byte-Laenge ist UTF-8-Bytes von `text`.
- Kontextstand: `ctxPct` ist nur fuer 2 294 von 2 730 angenommenen Sends vorhanden. Die uebrigen 436 Kontextstaende bleiben `UNGEMESSEN`; Bytes erlauben keinen belastbaren Rueckschluss auf den vorbestehenden Session-Kontext. Nur als getrennte Groessenheuristik: `~5 858 438 B / 4 B je Token = ~1 464 610 Payload-Tokens`; das ist keine gemessene Tokenzahl und kein Kontextverbrauch.
- Inhaltsfreie Messung: kein Zustell- oder Prompttext, keine Tokenwerte aus Modellantworten, keine Klar- oder Klarnamen und keine Netzwerkadressen wurden in die Notiz uebernommen.

## Konsequenz fuer die Buendelungsentscheidung

Die Messung zeigt ein ungleiches Lastbild: Lane-Aktionspfade tragen die groesste Byte-Menge, waehrend Events die groesste Zahl bestaetigter Zustellungen stellen. Ein spaeterer Buendelungsentwurf kann diese Pfadgruppen getrennt behandeln. Diese Notiz misst noch keine Einsparung, Lesbarkeit, Verzoegerungswirkung oder Fehlzustellung durch Buendelung.
