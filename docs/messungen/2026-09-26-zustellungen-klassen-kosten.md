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

## Methode und Grenzen

- Quellen: `audit.jsonl.1`, `audit.jsonl`, `streams/prompts.jsonl` sowie `fleet.json` im Haupt-Checkout. Die Audit-Rotation deckt das Fenster ohne Luecke ab; `audit.jsonl.archive` endet am 2026-09-07 und traegt nichts zum Messfenster bei.
- Zustellzaehlung: nur Audit-`event=send`; `acceptance=observed` ist bestaetigt, `unobservable` bleibt als Ankunft unbekannt separat, refusals und nicht angenommene Sends sind ausgeschlossen. `fleet_event_delivered` wurde nicht nochmals gezaehlt, um denselben Pane-Send nicht doppelt zu zaehlen.
- Rollen: Slot 9 ist die Orchestratorin. Program-MAIN-Sessions werden ueber `programs[].main.openedAt` mit dem naechsten `slot_open` desselben Slots (Abstand unter 2 s) verbunden. Die verbleibenden Empfaenger werden als Lane eingeordnet. Das ist die Zuordnung aus den aktuellen Fleet-Daten; historische Occupant-Wechsel, die in `fleet.json` nicht mehr stehen, sind damit nicht unabhaengig belegt.
- Prompt-Stream-Schema: die Zeilen tragen `ts`, `slot`, `source` und `text`, aber kein `openedAt`-Feld. Die Zeitfilterung nutzt daher `ts`; Rollen werden wie oben ueber Slot-Oeffnung und MAIN-Bindung zugeordnet. Byte-Laenge ist UTF-8-Bytes von `text`.
- Kontextstand: `ctxPct` ist nur fuer 2 294 von 2 730 angenommenen Sends vorhanden. Die uebrigen 436 Kontextstaende bleiben `UNGEMESSEN`; Bytes erlauben keinen belastbaren Rueckschluss auf den vorbestehenden Session-Kontext. Nur als getrennte Groessenheuristik: `~5 858 438 B / 4 B je Token = ~1 464 610 Payload-Tokens`; das ist keine gemessene Tokenzahl und kein Kontextverbrauch.
- Inhaltsfreie Messung: kein Zustell- oder Prompttext, keine Tokenwerte aus Modellantworten, keine Klar- oder Klarnamen und keine Netzwerkadressen wurden in die Notiz uebernommen.

## Konsequenz fuer die Buendelungsentscheidung

Die Messung zeigt ein ungleiches Lastbild: Lane-Aktionspfade tragen die groesste Byte-Menge, waehrend Events die groesste Zahl bestaetigter Zustellungen stellen. Ein spaeterer Buendelungsentwurf kann diese Pfadgruppen getrennt behandeln. Diese Notiz misst noch keine Einsparung, Lesbarkeit, Verzoegerungswirkung oder Fehlzustellung durch Buendelung.
