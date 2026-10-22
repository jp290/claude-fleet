# Aufgaben, die reisen

Jede Datei hier ist ein Export des Fensters (`#k15` → Exportieren → Vollständig, Form `src/k15-entwurf-modell.ts#exportObjekt`)
und lässt sich in jeder Fleet wieder importieren. Sie trägt eine Konstellation und dazu:

- `aufgabe`: was entstehen soll, die Grenze, wann es fertig ist, der Beleg und der Rückweg (`src/aufgabe.ts`). Sie zählt in die Fassung.
- `protokoll.regel`: die Prüfregel, nach der ein Ergebnis zählt.
- `laeufe`: gefahrene Läufe als Bericht (`src/lauf-bericht.ts`): auf welcher Fassung, welche Sitze wie liefen, was sie einander
  sagten, die Befunde mit Urteil, Kosten und Grenzen. Ein Lauf zählt nicht in die Fassung; der Import zeigt ihn und startet nichts.

`server/aufgaben.test.ts` importiert jede Datei in eine frische Fleet, rechnet die Fassung nach, die ihr Lauf nennt, und prüft, dass
kein Token, kein privater Pfad, kein Rechnername und kein Personenname darin steht.

- `postfach-pruefung.fleet.json`: der erste Lauf, 21.10.2026: ein Finder (Fable) und eine Beweiserin (Opus) prüfen drei Commits.
- `sicherheitspruefung.fleet.json`: Schritt 4, die Sicherheitsprüfung von Fleet; noch ohne Lauf.
