# Auslegung des Owner-Satzes, VOR dem Bau

Satz 1: "Ich finde es passt so vom design her gut zum rest"  -> Farben, Kanten, Typo sind ABGENOMMEN. Ich fasse sie nicht an.
Satz 2: "die slotansicht soll den platz effektiv nutzen"     -> auszulegen.

## Was ich darunter verstehe (eine Zeile)
Mehr Fakt je Pixel: derselbe Inhalt auf WENIGER Flaeche je Zeile, damit mehr Zeilen
gleichzeitig sichtbar sind — und der gewonnene Platz geht an den Inhalt (Label), nicht an
neues Chrome und nicht an einen zweiten Fakt.

## Woran ich das festmache, statt an Geschmack
Die Zahl im Baum (docs/messungen/INDEX.md:200) misst FLAECHE: "45 von 9120 Pixeln einer
Zeile" = 228 px breit x 40 px hoch. Dieselbe Groesse, an meinem Stand gemessen, ist der
Beweis. Drei Zahlen je Stand: Fakt / Chrome / Leerraum, plus zwei Nebenzahlen, die der
Satz direkt beruehrt: Zeilenhoehe und ZEILEN, DIE GLEICHZEITIG IN DIE LEISTE PASSEN.

## Mein Verdacht, den die Messung bestaetigen oder widerlegen muss
Bau 1 hat die Zeile WACHSEN lassen: zwei Textzeilen statt einer (~40 -> ~56 px) und eine
26-px-Rinne, die LEER ist. Beides ist genau das, was "Platz nicht effektiv genutzt" heisst.
Im eigenen Vorher/Nachher-Bild bei 900 px ist es schon zu sehen: vorher standen die Plaetze
bis 16 im Bild, nachher ist die Liste unten abgeschnitten.

## NICHT GEBAUT, nur gemessen und gemeldet (Nachtrag der Orchestratorin, Punkt 3)
0. DIE LEERE 26-PX-RINNE. Sie ist der groesste Einzelposten, den ich vermute, UND sie ist
   die vorbereitete Stelle der Marke. In A2 traegt die Marke die ADRESSE in ihrer Mitte —
   die Marke steht also dort, wo heute der Adress-Chip steht, nicht daneben; eine eigene
   Rinne daneben bucht denselben Platz doppelt. Das zu aendern hiesse, den Platz der Marke
   zu zerstoeren bzw. neu vorzusehen — beides ist mir untersagt ("bau in beide Richtungen
   nichts"). Also: Preis in px² messen, in den Report schreiben, Code nicht anfassen.

## Die drei Hebel, die ich ziehen will (keiner beruehrt Farbe/Kante/Typo/Reservierung)
2. Zeilenhoehe runter: Innenabstaende und der Abstand zwischen Zeile 1 und 2 sind auf
   Luft gesetzt, nicht auf Lesbarkeit. Ziel: naeher an der alten 40-px-Zeile als an 56.
3. Freie Plaetze sind EINZEILIG und duerfen kleiner sein als eine belegte Session: sie
   tragen einen Fakt (die Nummer) und eine Einladung. Heute kosten sie fast so viel
   Flaeche wie eine Session mit acht Fakten.
4. Der gewonnene Platz geht ans LABEL. "Orchestrator" darf nicht als "Orche..." enden,
   wenn rechts daneben Luft steht.

## Wo ich NICHT hingehe (Rahmen der Nacharbeit)
- Keine Session-Marke. Faellt Platz fuer sie ab, steht das im Report, nicht im Code.
- Kein neuer Fakt. Nichts, was die Leiste heute nicht zeigt.
- Keine Farbe, keine Kante, keine Schrift, keine Radien.
- Zeile 2 bleibt (sie traegt Repo und Alter, beides heute sichtbare Fakten) — sie wird
  billiger, nicht abgeschafft. Abschaffen waere ein Fakt-Verlust, kein Platzgewinn.
