# Aufgaben, die reisen

Jede Datei hier ist ein Export des Fensters (`#k15` → Exportieren → Vollständig, Form `src/k15-entwurf-modell.ts#exportObjekt`)
und lässt sich in jeder Fleet wieder importieren. Sie trägt eine Konstellation und dazu:

- `aufgabe`: was entstehen soll, die Grenze, wann es fertig ist, der Beleg und der Rückweg (`src/aufgabe.ts`). Sie zählt in die Fassung.
- `protokoll.regel`: die Prüfregel, nach der ein Ergebnis zählt.
- `laeufe`: gefahrene Läufe als Bericht (`src/lauf-bericht.ts`): auf welcher Fassung, welche Sitze wie liefen, was sie einander
  sagten, die Befunde mit Urteil, Kosten und Grenzen. Ein Lauf zählt nicht in die Fassung; der Import zeigt ihn und startet nichts.
  Je Sitz steht in `modelle`, welches Modell wirklich antwortete, ab wann und warum es wechselte (`src/modell-verlauf.ts`). Das Laufbuch
  einer Fleet schreibt das beim Schließen jeder Belegung selbst; wer einen Lauf von Hand einträgt, liest es mit
  `bun tools/modell-verlauf.ts <transkript.jsonl>` aus dem Transkript des Sitzes. Ein Wechsel macht den Lauf nicht ungültig.

`server/aufgaben.test.ts` importiert jede Datei in eine frische Fleet, rechnet die Fassung nach, die ihr Lauf nennt, und prüft, dass
kein Token, kein privater Pfad, kein Rechnername und kein Personenname darin steht.

- `postfach-pruefung.fleet.json`: der erste Lauf, 21.10.2026: ein Finder (Fable) und eine Beweiserin (Opus) prüfen drei Commits.
- `sicherheitspruefung.fleet.json`: Schritt 4, die Sicherheitsprüfung von Fleet. Version 2: Die Prüfregel sagt, dass ein Modellwechsel je
  Sitz vermerkt wird und den Lauf nicht ungültig macht (Orchestratorin 23.10.); Lauf 1 (22.10., Fleet des Entwurfs) und Lauf 2 (23.10.,
  Schritt 5: eine zweite Instanz mit echten Sitzen, die Datei dort importiert, derselbe Prüfsatz) standen auf Version 1.
