---
name: unslop
description: Bevor ein Lane-Report, ein Handoff oder ein Doku-Text an Menschen geht — schneidet KI-Füllmuster heraus und ersetzt Wertung durch Zahlen und Mechanismen.
---

# unslop

Adaption von pstack/unslop (github.com/cursor/plugins, MIT, © 2026 Lauren Tan) für Fleet-Texte:
Lane-Reports, `HANDOFF.md`, `docs/*.md`, Commit-Bodies, Brief-Entwürfe.

## Ablauf

1. Text gegen die Muster unten lesen.
2. Umschreiben. Bedeutung erhalten, Ton des Repos treffen (`docs/verify-tiering.md` ist der Maßstab).
3. Selbstprüfung: „Woran sieht man diesem Absatz an, dass ihn ein Modell geschrieben hat?" Rest fixen.
4. Letzter Durchgang: Steht jede Zahl mit ihrer Definition da? Steht jede Behauptung mit ihrem Beleg?

## Fleet-Regeln (gehen den generischen Mustern vor)

- **Zahl statt Wertung.** Nicht „die Suite ist langsam", sondern „~680–700 s". Nicht „viele Lanes",
  sondern „97 von 350". Wer keine Zahl hat, schreibt „ungemessen" — nicht ein Adjektiv.
- **Definition neben die Zahl, im selben Absatz.** Eine Zahl, deren Nenner nicht dabeisteht, wird
  von der nächsten Session falsch weiterverwendet.
- **Beleg statt Beteuerung.** `datei.ts:123`, ein SHA, der zitierte Tail. „verifiziert" ohne
  Fundstelle ist keine Verifikation.
- **Gemessen / abgeleitet trennen.** Was du gelesen oder ausgeführt hast, und was du daraus
  geschlossen hast, sind zwei verschiedene Sätze.
- **Nicht gemessen heißt nicht gemessen.** Kein „vermutlich grün", kein „sollte funktionieren".
- **Was fehlt, gehört in den Report.** Eine Zeile Ungelöstes ist Pflicht, auch wenn alles lief.
- **Em-Dashes und Doppelpunkte sind hier KEIN Tell** — der Repo-Stil benutzt beide. Die generische
  Regel dagegen gilt in Fleet-Texten nicht.

## Muster, die geschnitten werden

**Inhalt**

1. Aufwertung: „entscheidender Schritt", „zeugt von", „ebnet den Weg", „nachhaltig". Streichen,
   sagen was passiert ist.
2. Aufzähl-Partizipien: „…, wodurch sichergestellt wird", „…, was verdeutlicht". Streichen oder
   durch den konkreten Mechanismus ersetzen.
3. Vage Zuschreibung: „erfahrungsgemäß", „üblicherweise", „es gilt als". Quelle nennen oder
   streichen.
4. Dreier-Rhythmus erzwungen. Die natürliche Anzahl nehmen.
5. Falsche Spannen: „von A bis Z", wo A und Z auf keiner gemeinsamen Skala liegen.

**Sprache**

6. Modellvokabular: „zudem", „maßgeblich", „ganzheitlich", „Landschaft", „Zusammenspiel",
   „beleuchten", „hervorheben", „robust" als Lob. Einfaches Wort nehmen.
7. Umständliche Kopula: „fungiert als", „stellt dar", „bietet". „ist" oder „hat".
8. „Nicht nur X, sondern auch Y." Den Punkt direkt sagen.
9. Synonymkarussell: dieselbe Sache in einem Absatz dreimal anders benennen. Ein Wort, wiederholt.
10. Fettung als Dekoration; Überschriften im Titel-Stil; Deko-Emoji. Weg.
11. Zeilen der Form „**Label:** Label ist gut." Entweder echte neue Information nach dem Label oder
    Fließtext.

**Kommunikationsreste**

12. Chatbot-Sätze: „Ich hoffe, das hilft", „Gerne!", „Sag Bescheid, wenn…". Weg.
13. Anbiederung: „Sehr gute Frage", „Du hast völlig recht". Weg.
14. Generischer Schluss: „Damit ist die Basis gelegt." Konkreten nächsten Schritt oder nichts.

**Füllung**

15. „im Rahmen von" → „bei". „aufgrund der Tatsache, dass" → „weil". „Es ist wichtig zu erwähnen,
    dass" → streichen.
16. Hedging-Ketten: „könnte unter Umständen möglicherweise" → „kann" oder die Messung.
17. Adverb, das ein schwaches Verb stützt: „deutlich schneller" → die gemessene Differenz.
18. Passiv ohne Grund: „die Queue wird geprüft" → „der Tick prüft die Queue".
19. Sätze, die zwei Gedanken tragen: teilen. Ein Gedanke pro Satz.

**Metapher-Substantive**

20. „Substrat", „Vektor", „Nexus", „Primitive", „Paradigma", „Fundament" als Metapher. Das konkrete
    Wort nehmen — meist steht der echte Mechanismusname schon im Code.

## Schlussprobe

Wenn ein Satz unverändert in der Doku eines anderen Projekts stehen könnte, sagt er über dieses
nichts. Streichen.
