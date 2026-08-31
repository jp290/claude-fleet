---
frage: Ist Erfolgsmass 5 des Sanierungs-Programms ("alle Suiten gruen, 3 serielle Beweislaeufe") auf dieser Maschine erreichbar, und was kostet ein Versuch?
urteil: Nicht wie geschrieben. Die entscheidende Rate ist die Gruen-Quote eines vollen e2e-isolated-Laufs, und sie liegt in den letzten 40 entschiedenen Post-Land-Audits bei 57,5 % (Allzeit 77,5 %, seit 2026-08-26 verschlechtert). Daraus folgt P(3 konsekutiv gruen) = 19 % je Versuch und ~16 Laeufe je Erfolg — bei ~26 min exklusiver Suite-Mutex-Zeit pro Lauf rund SIEBEN Stunden serialisierter Maschinenzeit fuer EINE Baseline, und das Programm braucht sie zweimal (P0 und P7). Die Roten sind ueberwiegend Ein-Check-Rote und ueber viele Familien gestreut, also kein einzelner Fix.
bereich: [sanierung, baseline, verify, flake-rate]
belege: [post-land-audits.jsonl (390 Zeilen, 237 gruen / 69 rot / 84 unknown), eigene Laeufe 1-5 der P0-Baseline, docs/verify-tiering.md §11.2j, e2e/watch.ts, e2e/outcomes.ts]
nicht-gemessen: ob die Audit-Grundrate die Flake-Rate bei RUHIGEM Controller ueberschaetzt (Audits laufen direkt nach einem Land, also unter Last) — Lauf 5 spricht dagegen, beweist es aber nicht; Ursache der Verschlechterung ab 2026-08-26; ob die 84 unknown-Audits systematisch anders sind.
stand: 2026-08-31
---

# Ist die Baseline des Programms erreichbar? — die Rate, nicht die Meinung

Anlass: die P0-Baseline verlangt drei konsekutive serielle `./e2e-isolated.sh`-Laeufe. Nach fuenf
Laeufen (zwei gruen) stand die Frage, ob das an diesem Baum liegt oder an der Forderung.

## Die Rate

`post-land-audits.jsonl` ist die richtige Quelle: ein Post-Land-Audit **ist** ein voller
`./e2e-isolated.sh`-Lauf, also dieselbe Messung wie ein Baseline-Lauf. 390 Zeilen, davon 306
entschieden.

| Zeitraum | gruen | rot | gruen % |
|---|---|---|---|
| alle entschiedenen (n=306) | 237 | 69 | **77,5 %** |
| letzte 40 entschiedene | 23 | 17 | **57,5 %** |

Nach Tagen sichtbar ist ein Bruch, kein Rauschen:

```
2026-08-18  92,3 %   2026-08-25  76,5 %
2026-08-19  68,2 %   2026-08-26  42,9 %
2026-08-20  66,7 %   2026-08-27  57,1 %
2026-08-21  87,5 %   2026-08-28 100,0 % (n=2)
2026-08-22 100,0 %   2026-08-29  70,0 %
2026-08-23  88,9 %   2026-08-30  46,2 %
2026-08-24 100,0 %   2026-08-31  66,7 % (n=3)
```

Bis 2026-08-25 liegt die Quote im Mittel um 85 %, ab 2026-08-26 um 55 %. **Die Ursache dieser
Verschlechterung ist nicht gemessen** und ist fuer sich genommen ein Befund.

Die eigenen fuenf Baseline-Laeufe (2/5 gruen) sind mit der aktuellen Rate vertraeglich; sie sind
kein eigener Datenpunkt gegen den Baum.

## Was die Forderung daraus kostet

Bei p = 0,575 fuer einen gruenen Lauf:

- P(3 konsekutiv gruen) = p³ = **19 %** je Versuch.
- Erwartete Laeufe bis zum Erfolg ≈ **16**.
- Ein Lauf dauert 1544–1663 s (gemessen, Laeufe 4/5) und haelt dabei den **einzigen**
  Suite-Mutex — Land-Gates und Post-Land-Audits stehen derweil in der Schlange.
- Also **≈ 7 h serialisierter Maschinenzeit je Baseline-Versuch**, und das Programm fordert die
  Baseline zweimal (P0 als Vorher-Referenz, Erfolgsmass 5 als Nachher-Beweis).

## Warum "einmal reparieren" die Forderung nicht rettet

Die roten Laeufe sind ueberwiegend **Ein-Check-Rote** (24 von 45 roten Audits mit gezaehlten
Checks fielen mit genau 1) und ueber viele Familien gestreut. Die haeufigste einzelne Signatur
ueber alle 69 roten Audits ist ein Payload-Groessen-Check (8×), gefolgt von ACP-16 (4×) und der
§7-Land-Gate-Fixture (3×) — ein langer Schwanz aus Einzelnennungen. Die heute beobachtete
Familie (`e2e/watch.ts`, 6 von 7 Checks; dazu `e2e/outcomes.ts`) taucht in dieser historischen
Liste gar nicht auf: sie ist neu, nicht dominant.

Konsequenz: es gibt keinen einen Fix, der die Quote auf ~100 % hebt. Ein Programm, das drei
konsekutive vollstaendig gruene Laeufe als Tor setzt, setzt damit ein Tor, dessen Oeffnen vom
Wuerfel abhaengt — und ein solches Tor wird erfahrungsgemaess nicht geschlossen, sondern umgangen.

## Drei Wege, und was jeder kostet

**A — Kriterium auf CHECK-Ebene statt Lauf-Ebene.** Ein Lauf zaehlt als gruen, wenn jeder FAIL
einer im Register (`docs/verify-tiering.md`) gefuehrten Familie angehoert; die Baseline ist
geschlossen, wenn ueber drei konsekutive Laeufe **kein Check zweimal** faellt. Kosten: das
Register muss gepflegt werden. Schutz gegen den offensichtlichen Missbrauch: ein Check, der
zweimal faellt, ist per Definition kein Flake mehr und macht den Versuch rot. Erhaelt den Zweck
des Kriteriums (einen echten, durch die Operation eingeschleppten Regress zu sehen) und ist
erreichbar.

**B — Flake-Flaeche zuerst reparieren**, vor P1. Ehrlich, aber ungepreist: der lange Schwanz oben
sagt, dass das kein Schnitt ist, sondern ein eigenes Programm. Es wuerde die Sanierung vor ihrem
ersten Schnitt in eine Suite-Sanierung verwandeln.

**C — Kriterium woertlich lassen** und ~7 h Maschinenzeit je Versuch zahlen, zweimal, ohne Garantie.

Empfehlung: **A**, mit der Zweimal-Faellt-Regel als Schutz. Der Entscheid gehoert dem Owner, weil
Erfolgsmass 5 seine Setzung ist.
