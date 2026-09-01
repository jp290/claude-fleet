---
frage: Wie sieht die laufende Fleet Task Workbench nach dem View-Split 01459c9 bei 1440x900 und 390x844 wirklich aus, und welche Erfolgskriterien des Programs sind sichtbar noch offen?
urteil: "Visuelle Baseline ist nicht mehr UNKNOWN: Playwright aus der Program-MAIN-Session öffnet die Live-Oberfläche nach Owner-Login; Work/Programs/History/Waves und die Suche sind live; der Detail-Kopf zeigt nur „<status> · slot N", weder Program noch Repo noch Lifecycle, und die Aktionen liegen unter dem Request-Langtext unterhalb des Falzes — Kriterium 4 und 5 sind offen."
bereich: [task-workbench, ux, sensorik]
belege: [src/client.ts#renderQueueDetail, src/client.ts#qDetailSection, src/client.ts#openQueue, 01459c9ef81dfac06dc1a999ac13e7f11c6e1583]
nicht-gemessen: Leerzustand bei 0 offenen Tasks (live waren 14 offen), Tastaturfokus, zwei 2-s-Refreshes mit begonnenem Text, Mobile-Listenansicht vor der Auswahl, History-Ansicht.
stand: 2026-09-01
---

# Wie sieht die laufende Task Workbench nach dem View-Split aus?

1. September 2026, Program-MAIN „Fleet Task Workbench", Live-Server auf `d4f2bfc`
(Bundle gebaut 21:42, enthält `01459c9`). Gemessen mit dem Playwright-Browser der
Controller-Session, nicht aus einer Lane.

Die Frage der Vorgänger-Baseline (2026-08-31) war offen geblieben, weil die Lane keinen
authentifizierten Browserzugang hatte. Hier lief der Zugang über den Owner-Login-Weg
(`/?token=…`), den die Seite nach dem Login aus der Adresse entfernt.

## Beobachtet

- **Work-Ansicht 1440x900:** Kopf „Task queue · 0 need you · 2 released · 2 running · 10 backlog".
  Umschalter Work / Programs / History / Waves, Suchfeld mit dem Platzhalter „search tasks — text,
  ID, status, repo or program", darunter der Dispatcher-Hinweis. Liste links in den Gruppen
  Released, Running, Backlog; keine Closed-Gruppe im Default. Rechts das leere „New task"-Formular.
- **Running-Zeilen** tragen `slot N`, aber keinen Branch und keinen Lane-Zustand (running,
  done-looking, idle, dirty) — das ist der Gegenstand der Zeile `ff535524`.
- **Backlog** mischt `auftrag`- und `notiz`-Zeilen (advisory, gepunktete Kante) in einer Gruppe.
- **Detail 1440x900 (Running-Task gewählt):** Kopfzeile „sent · slot 8". Danach in dieser Reihenfolge
  „Overview & discussion" (Chips owner, Uhrzeit, `lane fleet/…`), „file surface & cluster",
  Kommentarfeld, dann „Request" mit dem vollen Langtext. Der Abschnitt „Actions" liegt darunter
  und ist ohne Scrollen NICHT sichtbar. Program und Repo stehen nicht im Kopf; eine Lifecycle-Leiste
  gibt es nicht.
- **Detail 390x844:** Zurück-Pfeil im Kopf, Umschalter über volle Breite, Detail einspaltig; die
  Kopfzeile des Zählers wird abgeschnitten („… · 1…"). Aktionen erst nach Scrollen erreichbar.

Die drei Bilder liegen als `workbench-1440x900-work.png`, `workbench-1440x900-detail-running.png`
und `workbench-390x844-detail-running.png` im Wurzelverzeichnis des Haupt-Checkouts — bewusst
ungetrackt (`.gitignore` `/*.png`): sie malen den Account-Pfad des Zielrepos ins Bild.

## Abgleich mit den Erfolgskriterien

| Kriterium | Sichtbar | Beleg |
|---|---|---|
| Work/Programs/History getrennt, History nur auf Auswahl/Suche | erfüllt | Umschalter live; `src/client.ts#openQueue`, Checks in `e2e/tasks.ts` aus `01459c9` |
| Offene Tasks je genau einmal in Needs-you/Released/Running/Backlog | erfüllt (14 Zeilen, keine doppelt) | `src/client.ts#qGroupOf` |
| Leerzustand bei 0 offenen Tasks | nicht gemessen (14 offen) | Quellprobe „zero open tasks has a named Work empty state" in `e2e/tasks.ts` |
| Detail: Status, Program, Repo, Lifecycle, genau eine Hauptaktion ohne Scrollen | **offen** | Kopf nur `<status> · slot N`; Actions unter Request (`src/client.ts#renderQueueDetail`) |
| Discussion/Brief/Criterion/Evidence/Danger zone erreichbar, ohne die Entscheidung zu überdecken | **offen** | Kommentarfeld und Request stehen VOR den Aktionen |
| Lanes an der Task-Zeile | offen (Zeile `ff535524`) | Running-Zeilen ohne Branch/Zustand |
| Spawn-Triple sichtbar/wählbar | offen (Zeile `1b677e58`) | nicht im Detail sichtbar |

## Methode

Playwright-MCP der Controller-Session: Viewport 1440x900, Navigation über eine lokale
Redirect-Seite mit dem Owner-Token (nie in der Sitzungsausgabe), Klick auf den Queue-Knopf,
Screenshot; Klick auf die Running-Zeile, Screenshot; Viewport 390x844, Screenshot. Redirect-Seite
und ihr Server wurden danach entfernt.

## Was nicht gemessen wurde

Siehe Frontmatter. Insbesondere fehlt ein Bild der Mobile-LISTE vor der Auswahl und jede
Interaktion mit Suche, Tastatur oder Entwürfen — die Slices `15a3e38b` (Lifecycle-Kopf) und
`07c061fa` (unabhängiger Review) tragen diese Proben.
