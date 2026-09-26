---
frage: Welche Session-Marken verbinden die Identität aus Runde 5 mit getrennten Zuständen und erfüllen die vier Aufnahmebedingungen gegen die schwächste Runde-5-Fassung?
urteil: U = 3,391059 aus R5-C. B2, A2, R5-A und R5-C erfüllen alle vier Bedingungen; A2 hat mit 5,874132 den größten kleinsten Paarabstand und ist Default. R5-B ist nur Kontrolle. A, C, L und Z aus Runde 6 bleiben unverändert und scheitern weiterhin an der Paarbedingung.
bereich: [leiste, session-marke, identitaet, renderer, aufnahme]
belege: [docs/design/sidebar/marken6.html, docs/design/sidebar/marken6.js, docs/design/sidebar/marken5.js]
nicht-gemessen: menschliche Erkennung, Telefon, schwache Maschine; kein Produktcode und keine Einstellung im Produkt.
stand: 2026-09-26
---

# Session-Marke, Runde 6b: Identität und Zustand

Die Entwurfsseite `docs/design/sidebar/marken6.html` zeigt neun Spalten: B2, A2, R5-A,
R5-B, R5-C sowie die unveränderten A, C, L, Z aus Runde 6. Die Karte sprach von sieben
Spalten, zählte aber acht Kandidaten und eine Kontrolle ausdrücklich auf; die Seite zeigt
alle genannten Fassungen. R5-B ist ausschließlich Kontrolle. B2 übernimmt die unveränderte
Runde-5-Identität (Repo-Art, Rollen-Wuchs, Harness-Spitze, Seed-Exemplar), lässt arbeitend
die bisherige Welle laufen und neigt wartend die ganze Pflanze nach links ohne Rahmen.
A2 behält Rolle, Repo, Harness und Zustände des Greifarms A; der Session-Seed bestimmt
zusätzlich beide Ruhe-Gelenkwinkel, Segmentlängen von 60 bis 140 % und die Zangenrichtung.

## Messart und Untergrenze

Die Runde-6-Sonde zeichnet alle 19 Sessions bei DPR 2 in Grau, MAIN mit 24 px,
Lanes mit 19 px mittig in einer 24-px-Zelle. Der mittlere absolute Luma-Abstand über
48 × 48 Gerätepixel wird für 171 Paare je Fassung verglichen. Der Farb-Luma-Lauf mit
24 px für alle Sessions ist nur die Plausibilitätsprobe. Dort trifft R5-B erneut
6,106668 aus Runde 5; in der neuen Messart misst es 4,735677.

| Runde-5-Fassung | kleinster Paarabstand, neue Messart |
|---|---:|
| R5-A | 3,857639 |
| R5-B, Kontrolle | 4,735677 |
| R5-C | 3,391059 |

**U = 3,391059**, der kleinste der drei Werte. Bedingung 1 fordert kleinsten
Paarabstand ≥ U. Bedingung 2 fordert für jede Session Abstand(arbeitet, wartet)
≥ U und für Ruhe und Schlaf je 0,000 % Bewegung. Bedingung 3 fordert die
gepaarte Zeichenzeit relativ zu R5-B ≤ 3,0. Bedingung 4 fordert ein volles,
bytegleiches Standbild bei reduzierter Bewegung.

## Aufnahme im selben Browserlauf

| Fassung | 1 Paare | 2 Zustand, Minimum; Ruhe/Schlaf | 3 Kosten gegen R5-B | 4 reduziert |
|---|---:|---:|---:|---:|
| B2 | **JA** 4,736 | **JA** 12,612; 0,000/0,000 % | **JA** 0,206/0,198 = 1,04× | **JA** bytegleich, 14,746 % Tinte |
| A2 | **JA** 5,874 | **JA** 5,384; 0,000/0,000 % | **JA** 0,151/0,198 = 0,76× | **JA** bytegleich, 8,528 % Tinte |
| R5-A | **JA** 3,858 | **JA** 25,209; 0,000/0,000 % | **JA** 0,206/0,198 = 1,04× | **JA** bytegleich, 12,655 % Tinte |
| R5-B, Kontrolle | **JA** 4,736 | **JA** 24,592; 0,000/0,000 % | **JA** 0,198/0,198 = 1,00× | **JA** bytegleich, 14,746 % Tinte |
| R5-C | **JA** 3,391 | **JA** 25,070; 0,000/0,000 % | **JA** 0,394/0,198 = 1,99× | **JA** bytegleich, 10,530 % Tinte |
| A | **NEIN** 0,932 | **JA** 6,245; 0,000/0,000 % | **JA** 0,151/0,198 = 0,76× | **JA** bytegleich, 8,943 % Tinte |
| C | **NEIN** 1,405 | **NEIN** 2,457; 0,000/0,000 % | **JA** 0,098/0,198 = 0,49× | **JA** bytegleich, 19,835 % Tinte |
| L | **NEIN** 0,515 | **NEIN** 3,379; 0,000/0,000 % | **JA** 0,143/0,198 = 0,72× | **JA** bytegleich, 15,611 % Tinte |
| Z | **NEIN** 1,724 | **JA** 8,633; 0,000/0,000 % | **JA** 0,201/0,198 = 1,02× | **JA** bytegleich, 11,024 % Tinte |

Die Kostenmessung zeichnet 210 abwechselnde Bilder über neun sichtbare Canvas,
verwirft 30 Warmlaufbilder sowie die oberen und unteren je 10 % der restlichen
Bildzeiten. Die absoluten Zeiten hängen von der Hostlast ab; die Relationen
stammen aus demselben Lauf. Die reduzierte Seite lieferte zusätzlich zwei
bytegleiche vollständige PNG-Screenshots im Abstand von zwei Sekunden
(je 274503 Byte); die Pixelsonde bestätigt bei jeder Fassung Tinte im Standbild.

### Drei engste Paare der neuen Fassungen

„Gleiche Fakten“ bedeutet gleiches Repo, gleiche Rolle und gleiche Harness-Familie;
verschiedene Sessions behalten verschiedene Seeds.

| Fassung | Paar | Abstand | gleiche Fakten |
|---|---|---:|---|
| B2 | 3B–3C | 4,736 | nein |
| B2 | 3A–4A | 5,826 | nein |
| B2 | 4A–10A | 6,755 | ja |
| A2 | 2–5 | 5,874 | nein |
| A2 | 3B–3C | 6,167 | nein |
| A2 | 4A–10A | 6,341 | ja |

## Umschalter

**B2, A2, R5-A und R5-C** sind aufgenommen. **Default: A2**, weil dessen
kleinster Paarabstand von 5,874 größer als bei den anderen aufgenommenen
Fassungen ist. R5-B bleibt Kontrolle. Der Umschalter ist auf dieser Entwurfsseite
eine berechnete Liste (`window.__aufnahme`), keine Produkteinstellung.

Die Seite wird aus `docs/design/sidebar/` über `FLEET_HOST` aus `.env` serviert;
eine Hostadresse steht in keiner getrackten Datei. `?tafel=1&zustand=rest` zeigt
den Kontaktbogen, `&messart=r5` die alte Plausibilitätsprobe. Die Seite berechnet
die Aufnahme und den Default selbst; Browser-Logs und Screenshots liegen nur im
Scratchpad außerhalb des Repos.
