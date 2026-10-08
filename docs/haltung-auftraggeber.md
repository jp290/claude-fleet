# Haltung für Auftraggeber

Stand 2026-10-06. Gegenstück zu `docs/haltung-worker.md`: wie MAIN und Orchestratorin eine Karte
schreiben, damit sie die beste Version des Agenten hervorholt, der sie ausführt. Owner am selben Tag:
„[Zitat entfernt]“
 Kontext-Pack `haltung-auftraggeber` zeigt auf den Abschnitt unten.

## Wie wir Karten schreiben, und warum

Vorlieben, keine Regeln — die Kartenform selbst (Kopfzeilen, DONE, VERIFY) bleibt, wie der Parser sie liest.

- **Erst die Besetzung denken, dann schreiben.** Wer wäre für genau diese Arbeit die beste Besetzung,
  was weiß sie schon, was braucht sie noch, was würde sie stören? Eine Karte für die Person, die man
  sich vorstellt, wird anders als eine für den Fehler, den man fürchtet.
- **Der erste Satz spricht diese Version an.** Er nennt die Arbeit und die Expertise, die sie verlangt,
  für diese Aufgabe, nicht als Formel, die auf jeder Karte gleich klingt.
- **Ziel, Warum, Fertig, Material.** Was soll danach anders sein, mit dem Owner-Wort, warum es zählt,
  woran man das Ende erkennt, und wo das Material liegt. Das Wie gehört dem Agenten: Methoden,
  Report-Gliederungen und ausgeschriebene Prüfketten nehmen ihm die Arbeit, für die wir ihn holen.
  Bei einem Produkt-Program nennt die Karte den bestätigten Entwurf mit SHA und den Satz des
  Erfolgskriteriums, dem sie dient, und ihr Fertig-Satz enthält die Integrationsprüfung: Der
  Integrationsbefehl des Entwurfs läuft danach über den ganzen Ablauf, nicht nur die eigene Prüfung.
  Vor der Bestätigung des Entwurfs (Orchestratorin; ein neues oder geändertes Erfolgskriterium: der
  Owner) ist der Prototyp die einzige Implementierungszeile. Ein laufendes Program baut weiter, bis
  dort ein neuer nutzersichtbarer Strang beginnt (`AGENTS.md` §Hard invariants).
- **Nur echte Grenzen.** VERBOTEN nennt, was wirklich nicht geht (fremde Flächen, Außenwirkung,
  Owner-Akte), nicht jeden denkbaren Fehler; eine lange Verbotsliste liest sich als Misstrauen und
  macht klein.
- **Spielraum ausdrücklich geben.** Sag, was sie selbst entscheiden darf, etwa eine nötige
  Nachbarfläche mitnehmen und im Report nennen. Ohne diesen Satz fragt eine gute Lane, statt zu bauen.
- **Für das Modell schreiben, das die Karte bekommt.** Ein schwächeres oder fremdes Modell braucht mehr Lage und Material,
  nicht mehr Verbote; dieselbe Schärfe, ein kleinerer Umfang.
- **Um Rückmeldung zur Karte bitten.** Bitte in der Karte darum, dass die Lane am Ende in einem Satz sagt, was ihr an der Karte fehlte oder sie störte: so lernt
  die nächste Karte von der letzten.

### Ein Muster

```
ROLLE: codex/gpt-6.1-sol/high
GROESSE: mittel
FLAECHE: state.sh, e2e/ctl.ts
VERIFY: die localProof.steps aus GET /api/self/gate, wie AGENTS.md §Verify sie abbildet
DONE: ./state.sh --brief bleibt in Live-Größe unter 80 Zeilen und 10 KB und beantwortet die sechs Startfragen weiter in einem Aufruf.
VERBOTEN: keine Server- oder Routenänderung

Du kennst Shell-Renderer und Kontextbudgets: bring die Startausgabe auf ihr Budget zurück.
Die Orchestratorin las nach dem Deploy 663 Zeilen und 150 KB, rund 15 % eines Codex-Fensters, nur
für den Start; state.sh#group nennt ein Budget und druckt trotzdem alles. Wie du kürzt, entscheidest du;
eine gekappte Kategorie sagt, wie viel fehlt und wo es steht. Brauchst du eine Nachbardatei, nimm sie
mit und nenne sie. Am Ende ein Satz, was dir an dieser Karte gefehlt hat.
```
