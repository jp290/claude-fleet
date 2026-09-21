---
frage: Passt die Minecraft-Bauform (Code baut legale Optionen, der Akteur waehlt im Tick, der Planer setzt selten ein Ziel) auf die ORCHESTRIERUNG des Fleets — welcher Anteil der Akte einer Session/des Owners ist ein geschlossener, per Code ausfuehrbarer Katalog, welcher ist Freitext, und wie lange wartet ein Ereignis auf den Akt, der darauf antwortet?
urteil: Nur fuer einen benannten Teil — von 5 246 Akten (13,5 % der 38 909 Ledger-Zeilen, 13,75 Tage) sind 3 156 (60,2 %) geschlossen (Starten, Toeten, Halten, Freigeben, Land-Start, Lesen), aber die 39,8 % Freitext-Akte sind genau die Kommunikationsachse (send 807, Reports 513, Notiz-Urteile 421, Zeilen-Filing 164), und die zahlenmaessige Herrschaft liegt ganz ohne Akteur bei der Maschine (86,5 % aller Zeilen, allein 23 182 held-Rows Rueckstau); ein waehlender Treiber im Minecraft-Sinn haette fuer 3 von 5 Akten einen legalen Zug — aber der Zustand, aus dem er waehlen muesste (Queue-Status, Lane-Zustaende, offene Reports), steht GAR NICHT im Ledger und ist nur vorwaerts loggbar, also ist der kleinste naechste Schritt der Zustands-Schnappschuss [A], kein Treiber.
bereich: [jev, audit-ledger, orchestrierung, sensoren]
belege: [server/audit-log.ts, server.ts#auditSend, docs/messungen/jev-treiber-akte.py, docs/jev.md, docs/messungen/2026-09-21-video-jev-theo.md]
nicht-gemessen: Die MAIN-Urteilstuer (fleet-report accept|reject) schreibt bewusst keine Ledger-Zeile (server/audit-log.ts:303-305) — Join 1 sieht nur Owner- und Regeltuer, 310 von 513 Reports tragen deshalb keine Urteilszeile, und der Median vermischt beide Tueren. Slot-Ids sind rekycelt; Joins 2 und 4 sind deshalb hart an der naechsten slot_open desselben Ids gekappt, und Join 4 ist in einer wörtlichen und einer fenstergekapselten Zahl berichtet. Der Freitext-Gehalt je Akt ist aus der Schreibstelle (Parametertyp, Pflichtfelder) geschlossen, nicht aus Zeilen gelesen — 0 detail-Texte wurden betrachtet. Perzentile linear interpoliert. Das Rauschen von owner_auth_fail (674) ist nicht nach Uhrzeit oder Quelle zerlegt.
stand: 2026-09-22
---

# Treiber-Schatten am Audit-Ledger — was davon ein waehlender Akt sein koennte

2026-09-22, Lane `fleet/260921092917-b570`. Messung, kein Bau; die Karte ist der Owner-Satz vom
2026-09-21 in docs/jev.md §5 („Jev waehlt unter Optionen, die CODE als legal gebaut hat"). Skript:
`docs/messungen/jev-treiber-akte.py` (nur Standardbibliothek), aufgerufen ueber die beiden
Ledger-Dateien im Haupt-Checkout (gitignored, read-only, nicht kopiert). 0 detail-Texte gelesen —
das Skript druckt nur Zaehlungen, Quantile, Ereignisnamen, Enums und Hash-Praefixe.

## Methode

Spanne: 2026-09-07 17:31 bis 2026-09-21 11:34, 13,75 Tage, beide Dateien (5 MiB rotiert + aktueller
Tail), N = 38 909 Zeilen, 103 Ereignisnamen. Klassenregel, an der Schreibstelle begruendet
(server/audit-log.ts = AL, Verband mit Kommentar je Name; server.ts = S):

- **Akt** = eine Session oder der Owner hat etwas getan (Route/Befehl einer besetzten Session).
- **Maschine** = Tick, Transport, Heal, Helper, Buchung — inklusive der Regeltuer
  (AL:309: „no session and no owner took it") und des Merge-Gate-Urteils (AL:429: „no prose").
- **GESCHLOSSEN** = alle Akt-Parameter sind IDs, Enums, Pfade oder Zahlen — Code koennte ihn
  ausfuehren und ein Katalog koennte ihn anbieten. **FREITEXT** = ein Parameter ist freier Text
  (Brief, Reportkoerper, Antwort, Begruendung, Pflicht-Satz).

## a) Je Ereignisname: Anzahl und je Tag (Auszug, gesamt 103 Namen)

| n | /Tag | Name |
|---|---|---|
| 23 182 | 1 685,7 | fleet_event_held |
| 1 129 | 82,1 | helper_result |
| 1 123 | 81,7 | fleet_event_prune |
| 1 109 | 80,6 | fleet_event_ack |
| 1 049 | 76,3 | fleet_event_delivered |
| 882 | 64,1 | helper_claim |
| 807 | 58,7 | send |
| 799 | 58,1 | watch_fire |
| 674 | 49,0 | owner_auth_fail |
| 613 | 44,6 | self_heal_recreate |
| 604 | 43,9 | slot_kill |
| 602 | 43,8 | slot_open |
| 513 | 37,3 | fleet_report_open |
| 508 | 36,9 | program_inbox_append |
| 506 | 36,8 | program_inbox_read |
| 421 | 30,6 | note_verdict |
| 395 | 28,7 | self_drift |
| 313 | 22,8 | merge_verdict |
| 263 | 19,1 | self_land_start |
| 197 | 14,3 | task_release |

## b) Akte gegen Maschine, geschlossen gegen Freitext

**Akte gesamt n = 5 246 (13,5 % aller Zeilen) · GESCHLOSSEN n = 3 156 (60,2 % der Akte) ·
FREITEXT n = 2 090 (39,8 %) · Maschine n = 33 663 (86,5 % aller Zeilen).** Dazu 588
Code-Urteile (fleet_report_rule_decision 179 + merge_verdict 313 + postland_audit 96 = 1,5 %
aller Zeilen) — die Maschine entscheidet heute schon einen geschlossenen Katalog, nur loggt sie
das verstreut.

Die groessten AKTE (Zuordnung je Name mit Schreibstelle; volle Liste druckt das Skript):

| n | Klasse | Grund bei der Schreibstelle |
|---|---|---|
| 807 | send · FREITEXT | AL:438 (B3): sendText schreibt selbst; Payload IST Text, Ledger traegt nur bytes/Pfad/Acceptance (S:6754-6760) |
| 604 | slot_kill · GESCHLOSSEN | AL:18, S:6249: Parameter Slot-Id |
| 602 | slot_open · GESCHLOSSEN | AL:18, S:6132: Parameter cwd/Modell/Effort; der Grundbrief reist als eigener send |
| 513 | fleet_report_open · FREITEXT | AL:302, S:9333/S:9409: Reportkoerper ist Prosa |
| 506 | program_inbox_read · GESCHLOSSEN | AL:408: Empfangs-Quittung, Parameter Entry-Id |
| 421 | note_verdict · FREITEXT | AL:84, S:35212: Urteil ist 3er-Enum, aber der Satz ist Pflicht (S:35174 „a verdict without a sentence is not a report") |
| 395 | self_drift · GESCHLOSSEN | AL:344: Lane-Read ohne Parameter |
| 263 | self_land_start · GESCHLOSSEN | AL:194: Parameter Zeilen-Id |
| 197 | task_release · GESCHLOSSEN | AL:36, S:11105: Parameter Zeilen-Id |
| 164 | main_task · FREITEXT | AL:135, S:11855: Zeile samt Brief-Text gefilet |

Lesart: Die **Steuerleiste** (spawn/kill, hold/release, dispatch, land-start, succession,
deploy — zusammen ~1 400 Akte) ist bereits ein geschlossener Katalog; die **Sprachleiste**
(send, Reports, Notiz-Urteile, Filing, Attention — ~2 100 Akte) ist Freitext und im
Minecraft-Sinn kein Optionenraum, sondern der Kanal selbst.

## c) send — Groesse, Kanal, und die Textfrage

n = 807 send-Zeilen. `bytes`: p50 = 562, p90 = 8 373, max = 29 852; Summe 1 735 627 Bytes =
1,7 MiB ueber 13,75 Tage (123 KiB/Tag). 11 Kanaele (path-Enum, geschlossen!): fleet-event 342,
owner 175, inbox-nudge 103, brief 74, succession 43, migrate-nudge 34, report-decision 17,
founding 11, auto 6, merge-author 1, Rest 1 weiterer Wert. ctxPct messbar an 658/807 (82 %).

**Das Ledger traegt den Send-Text nicht** — 0/807 Zeilen. Das ist keine Luecke, sondern Regel:
AL:14-16 und AL:438-441 („a LENGTH, never the text"), und S:6757 schreibt als detail nur
`<path> <n>B <acceptance>`. Schablonen-Hashes sind damit nicht berechenbar; gemessen ist nur
`bytes`. Fuer einen Treiber heisst das: die haeufigste Akt-Klasse ist als Ereignis nur ein
(Umfang, Kanal, Quittung)-Tripel — waehlbar waere sie nur als Enum „sende auf Kanal X", nie
inhaltsweise.

## d) Wartezeiten zwischen Ereignis und antwortendem Akt

| Join | Median | p90 | n (Nenner) |
|---|---|---|---|
| fleet_report_open -> erstes Urteil (Owner-/Regeltuer; MAIN-Tuer loggt nicht) | 3 082 s (~51 min) | 187 633 s (~52 h) | 203 von 513 Reports; 310 ohne Urteilszeile |
| watch_fire -> naechster Akt derselben Session (bis Session-Ende gekappt) | 346,8 s | 7 264,8 s | 799 von 799; 0 ohne Akt |
| main_task -> task_release derselben Zeile | 89,8 s | 47 524 s (~13,2 h) | 85 von 164; 79 ohne Release-Zeile im Fenster |
| merge_verdict (landed) -> naechstes slot_kill derselben Slot-Id (woertlich) | 6 818 s | 45 219 s | 286 von 291; 5 ohne je einen Kill |

Der vierte Join ist der aufklaerende: **alle 291** Kills derselben Slot-Id liegen erst NACH dem
naechsten slot_open dieser Id — innerhalb derselben Session-Belegung wird nach einem Land nie
gekillt (0/291 = 0 %). Die woertliche Wartezeit misst Slot-Recycling, kein Aufraeumen; ein
gelandeter Lane bleibt belegt, bis die Id neu vergeben wird. Join 1 ist durch die stumme
MAIN-Tuer systematisch verkuerzt (siehe nicht-gemessen); Join 2 zeigt: nach einem watch_fire
folgt fast immer (799/799) ein Akt derselben Session, aber erst nach Minuten (Median 5,8 min) —
die Uhr des Treibers liest hier eine Latenz, keine Kadenz.

## e) Rekonstruierbarkeit — was dem Treiber fehlt, ist der ZUSTAND, nicht die Akte

Ein Waehler im Minecraft-Sinn braeuchte je Tick: Queue-Zeilen mit Status (pending/queued/running)
und Karten, Lanes mit Belegungszustand (idle/ahead/dirty), offene Reports und Attentions, die
Backpressure-Lage (held-Zaehler). **Keines davon steht im Ledger** — es traegt nur die
Ereignis-Folien der Zustaende (task_release statt Queue-Status, self_drift statt Lane-Zustand,
fleet_event_held-Einzelfall statt Backpressure-stand), und zwei entscheidende Tueren schreiben
gar nichts (MAIN-Report-Urteil, AL:303-305; MAIN-Report-Verdict ist nur ueber die Row lesbar).
Alles davon ist nur VORWAERTS loggbar.

**[A] Vorschlag, kleinster Zustands-Schnappschuss je Tick** (ein Loggort, eine Zeile, kein Text):
`{t, q:{p,r,run,done}, lanes:[{s,ph,a,d}], rep:{open}, att:{open}, held}` — 173 Bytes im
Beispiel des Skripts. Bei jedem Dispatch-Tick (8 s) sind das 1,8 MiB/Tag und 24,9 MiB/14d gegen
eine 5-MiB-Rotation — zu viel fuer audit.jsonl; Varianten: eigenes rotierendes File (gleiche
Disziplin wie audit-log.ts), oder 60-s-Kadenz (249 KiB/Tag, 3,5 MiB/14d, knapp), oder
Aenderungs-Logging mit Herzschlag alle 10 min (~0,5 MiB/14d). Die Entscheidung darueber ist
Fleet-Betrieb, nicht dieses Programm.

## Urteil

**Nur fuer einen benannten Teil:** die Steuerleiste der Orchestrierung (60,2 % der 5 246 Akte)
ist bereits ein geschlossener, per Code ausfuehrbarer Katalog — aber der Freitext-Anteil traegt
die Kommunikation, die Code-Urteile existieren verstreut statt als Katalog (588 Zeilen = 1,5 %),
und der entscheidende Zustand fehlt komplett. Der kleinste naechste Schritt ist Schnappschuss
[A], gemessen an einem Tag von echten Ticks — kein Treiber, kein Jev-Aufruf, kein Gate.
