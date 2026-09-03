---
frage: Zeigt Work bei 0 offenen und 16 geschlossenen Tasks einen Leerzustand statt geschlossener Zeilen — Kriterium (a), das bis hierher als einziges ungeprueft blieb?
urteil: "Ja, auf einer Scratch-Instanz mit exakt diesem Zustand gemessen: Work zeigt NULL Task-Zeilen und keinen einzigen Gruppenkopf, dafuer den benannten Satz „Work is clear — no open tasks. Choose History to inspect 16 done or archived tasks."; die Zaehlzeile steht auf 0/0/0/0, und History traegt auf ausdrueckliche Auswahl genau die 16."
bereich: [task-workbench, ux, verify]
belege: [71361fa9e3fd59df1789f19ccc71a27964b78754, a58e9c11629650cb911a79186d6b3077d123046e, src/client.ts#renderQueue, src/client.ts#qTaskListModel, docs/messungen/2026-09-03-task-workbench-review.md, docs/messungen/2026-09-03-task-workbench-abschlussmessung.md]
nicht-gemessen: Der Leerzustand bei 390x844; das Verhalten bei 0 offenen und 0 geschlossenen Tasks (leere Queue ueberhaupt); ob die Zahl 16 im Satz aus derselben Quelle stammt wie die History-Liste (beide zeigten 16, eine gemeinsame Quelle ist damit nicht bewiesen)
stand: 2026-09-03
---

# Kriterium (a): der Leerzustand, auf einer Scratch-Instanz hergestellt und gemessen

3. September 2026, 15:35–15:45, Program-MAIN Slot 8. Dies schliesst die letzte Beweisluecke des
Programs. Sie blieb offen, weil die LIVE-Queue 89 offene Zeilen trug und der geforderte Zustand
dort nicht herstellbar ist — etwas Aehnliches zu messen und es (a) zu nennen waere eine
Falschaussage gewesen.

## Aufbau

Eigene Instanz, **nie** aus dem Haupt-Checkout gestartet (`STATE_FILE` liegt neben `server.ts`,
ein Start dort adoptiert die Live-`fleet.json`): transitive Import-Huelle von `server.ts` in ein
Scratch-Verzeichnis gestaged (29 Dateien, per Walker abgeleitet statt von Hand aufgezaehlt — eine
Hand-Liste war schon zweimal die Todesursache einer Suite), `public/` und `package.json` dazu,
`node_modules` als Symlink. Start mit `FLEET_HOST=127.0.0.1 FLEET_PORT=8899
FLEET_SOCK=fleetlaneui FLEET_CMD=true`, Analyse/Brief/auto-③ auf 0, damit nichts einen echten
Agenten spawnt. Fixture: 16 Tasks angelegt, davon **11 auf `done` und 5 auf `archived`** — beide
Endzustaende, weil der Client beide der Gruppe „Closed" zuordnet. Danach am API nachgezaehlt:
`{'done': 11, 'archived': 5}`, offen (pending/queued/sent) = **0**.

## Ergebnis, 1440x900

- **Zeilen in Work: 0.** Der einzige Knoten in der Liste ist die `＋ New task`-Zeile.
- **Gruppenkoepfe in Work: keine** — weder eine „Closed"-Gruppe noch eine der vier offenen.
- **Leerzustand, woertlich:** „Work is clear — no open tasks. Choose History to inspect 16 done or
  archived tasks." Er nennt die Zahl und den Weg, statt nur leer zu sein.
- **Zaehlzeile:** `0 need you · 0 released · 0 running · 0 backlog`.
- **History auf ausdrueckliche Auswahl:** Gruppenkopf `History 16`, **16 Zeilen** — die
  geschlossenen Tasks sind erreichbar, nur eben nicht in Work.

Bild (ungetrackt, `.gitignore` `/*.png`): `workbench-emptystate-1440x900.png`.

## Aufraeumen

Scratch-Server und Redirect-Helfer beendet, `tmux -L fleetlaneui kill-server`. Gegenprobe danach:
die Live-`fleet.json` enthaelt **0** Fixture-Zeilen, der Live-Server antwortet weiter mit 200.

Damit sind alle acht Erfolgssaetze des Programs belegt: (a) hier, (b)–(e) im unabhaengigen
Review `a58e9c1`, (d) zusaetzlich mit Pixeln in `a6b7a38`, (f) und (g) in `445c1e2`.
