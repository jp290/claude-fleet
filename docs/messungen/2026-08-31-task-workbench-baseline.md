---
frage: Wie sieht und verhält sich die laufende Fleet Task Workbench vor einer Codeänderung bei Desktop, Mobile, Suche, Tastatur und Poll-Refresh?
urteil: "Visuelle Ist-Baseline UNKNOWN: Kein authentifizierter Browserzugang; der datierte Quellbaum zeigt Closed standardmäßig, aber keine eigene Work/Programs/History-Navigation und keine Task-Suche nach ID, Repo oder Program."
bereich: [task-workbench, ux, sensorik]
belege: [src/client.ts#openQueue, src/client.ts#renderQueue, src/client.ts#renderQueueDetail, src/shell.ts#openShell, public/index.html, 085053d7dd122bcb7aee000d3d639536355baa92]
nicht-gemessen: Live-Inhalt bei 0 offenen und 16 geschlossenen Tasks, 1440x900, 390x844, zwei 2-s-Refreshes und echte Desktop-/Mobile-PNGs; beide Browserzugänge waren nicht authentifiziert oder nicht verfügbar.
stand: 2026-08-31
---

# Wie sieht und verhält sich die laufende Fleet Task Workbench vor einer Codeänderung?

31. August 2026, Lane `fleet/260831051745-6758`, Quellstand
`085053d7dd122bcb7aee000d3d639536355baa92`. Frage: **Wie sieht und verhält sich die
laufende Fleet Task Workbench vor einer Codeänderung bei Desktop, Mobile, Suche, Tastatur und
Poll-Refresh?**

Die Workbench-Abstraktion sollte existieren: Task-Liste und Detail gehören zu demselben
Arbeitsvorgang, brauchen aber getrennten Platz und auf schmalen Viewports eine eindeutige
List-zu-Detail-Navigation. Das ist eine Ableitung, keine Qualitätswertung der nicht sichtbaren
Live-Oberfläche.

## Ergebnis

### Beobachtet

- Der in-app Browser brach vor jeder Navigation mit `Browser is not available: iab` ab. Der
  URL-gebundene Browserzugang brach mit `No browser is available` ab.
- Browser Computer Use öffnete die wegen des Leak-Pins abstrahierte Live-Adresse `http://<fleet-host>:<port>/`, zeigte aber ausschließlich den Dialog
  `Access token` mit dem Feld `token — Enter to save`. Die Task Workbench lag dahinter und war
  nicht lesbar. `http://127.0.0.1:8790/` antwortete in Chrome mit `ERR_CONNECTION_REFUSED`.
- Es wurde kein Token eingegeben, kein Formular abgeschickt und keine Task- oder API-Zustandsänderung
  ausgelöst.
- Die im Auftrag genannten `0` offenen und `16` geschlossenen Tasks wurden nicht im Browser
  beobachtet. Sie sind eine Vorgabe des Auftrags, kein Messwert dieser Lane.
- Die Dateien
  `docs/messungen/2026-08-31-task-workbench-baseline-desktop.png` und
  `docs/messungen/2026-08-31-task-workbench-baseline-mobile.png` wurden nicht erzeugt. Ein Bild des
  Token-Dialogs wäre keine Workbench-Baseline.

Damit ist die visuelle Baseline `UNKNOWN`.

### Aus dem datierten Quellbaum abgeleitet

Diese Aussagen beschreiben den Code in Commit `085053d7`; sie sind keine Bestätigung des laufenden
Bundles und keine Browsermessung.

| Frage | Ableitung | Beleg |
|---|---|---|
| Default-Work-Inhalt | `openQueue` startet in der Ansicht `Status`. Die linke Liste beginnt mit `＋ New task`, danach folgen Programs und die Task-Gruppen Needs you, Released, Running, Backlog, Observations und Closed. Eine eigene Ansicht namens Work existiert dort nicht. | `src/client.ts:8039`, `src/client.ts:8080`, `src/client.ts:7920`, `src/client.ts:6553` |
| Closed/History | Tasks mit Status `done` oder `archived` landen in Closed und werden ohne Fold gerendert. Nur Programs mit Status `complete` sind standardmäßig gefaltet. Eine eigene History-Navigation der Task Workbench ist im gelesenen Pfad nicht vorhanden. Bei wirklich 0 offenen und 16 geschlossenen Tasks würde die Default-Liste daher alle 16 Closed-Zeilen aufnehmen. Der letzte Satz ist eine Ableitung aus Code plus Auftragsvorgabe. | `src/client.ts:6567`, `src/client.ts:7934`, `src/client.ts:7966`, `src/client.ts:7974` |
| Work/Programs/History | Die Toolbar bietet `Status` und `Waves`. Programs sind ein Abschnitt in Status, nicht ein eigener Navigationspunkt; History ist dort kein Navigationspunkt. | `src/client.ts:8080`, `src/client.ts:7923` |
| Primäre Detailaktion bei 1440x900 | Die Shell wäre rechnerisch 1368 px breit und 828 px hoch (`95vw`, `92vh`), mit 380 px Listenbreite. Actions stehen nach Overview, Refinement und Request in der scrollbaren Detailspalte und sind nicht sticky. Ob eine konkrete primäre Aktion im ersten 1440x900-Bild sichtbar wäre, hängt vom gewählten Task-Inhalt ab und bleibt `UNKNOWN`. | `public/index.html:427`, `src/client.ts:8070`, `src/client.ts:7427`, `src/client.ts:7434`, `public/index.html:447` |
| Suche nach Text | Ja: Task-Volltext wird kleingeschrieben per Teilstring verglichen. | `src/client.ts:7842` |
| Suche nach ID | Nein im gelesenen Filter: `t.id` wird nicht verglichen. | `src/client.ts:7842` |
| Suche nach Program | Teilweise: Program-Zeilen matchen Titel, Status und abgeleiteten MAIN-Mark. Die `programId` eines Tasks und der Program-Titel eines zugeordneten Tasks werden nicht in den Task-Filter aufgenommen. | `src/client.ts:7926`, `src/client.ts:7842` |
| Suche nach Repo | Nein im gelesenen Filter: `t.repo` wird nicht verglichen. | `src/client.ts:7842` |
| Suche nach Status | Ja: Task-Status wird per Teilstring verglichen. Program-Status wird im separaten Program-Filter ebenfalls verglichen. | `src/client.ts:7844`, `src/client.ts:7927` |
| Keyboard-Fokus | `openQueue` setzt keinen initialen Fokus. Die Zeilen sind `div`-Elemente ohne Tab-Fokus; ein dokumentweiter Capture-Handler bewegt die Auswahl mit Pfeil hoch/runter und öffnet sie mit Enter. Während ein Eingabefeld fokussiert ist, werden Pfeil hoch/runter trotzdem für die Zeilenauswahl verbraucht; Textareas behalten ihre Tasten. Bei Detail-Repaints werden Fokus und Textselektion eines verbundenen Feldes wiederhergestellt. Das reale Tab-/Focus-Ring-Verhalten bleibt `UNKNOWN`. | `src/client.ts:8039`, `src/client.ts:7878`, `src/shell.ts:159`, `src/shell.ts:169`, `src/client.ts:7305` |
| 390x844 | Die Media Query greift unter 700 px. Sie macht die Shell vollflächig, zeigt zuerst nur die Liste und schiebt nach Auswahl die Detailansicht mit sichtbarer Zurück-Schaltfläche ein. Status/Waves werden breiter und mindestens 40 px hoch. Der gerenderte Zustand bei exakt 390x844 bleibt `UNKNOWN`. | `public/index.html:487`, `public/index.html:490`, `public/index.html:492`, `src/client.ts:7834`, `public/index.html:503` |
| Draft über zwei 2-s-Refreshes | Der Quellpfad hält Compose-, Kommentar-, Brief- und Criterion-Felder als bestehende DOM-Knoten über Repaints. `refresh` ruft `renderQueue` auf; unveränderte Listen brechen am Render-Key ab, und Detail-Repaints setzen Fokus und Caret zurück. Daraus folgt erwarteter Draft-Erhalt. Zwei reale 2-s-Polls wurden nicht beobachtet; der Live-Wert bleibt `UNKNOWN`. | `src/client.ts:5287`, `src/client.ts:5388`, `src/client.ts:5967`, `src/client.ts:7305`, `src/client.ts:7845` |

## Methode

1. Vor Implementierungslektüre wurden `AGENTS.md`, `docs/messungen/INDEX.md`,
   `.claude/skills/mess-notiz/SKILL.md` und `.claude/skills/unslop/SKILL.md` gelesen.
2. In einem neuen Chrome-Tab wurde zuerst die wegen des Leak-Pins abstrahierte Live-Adresse `http://<fleet-host>:<port>/` geöffnet und der sichtbare
   Accessibility-Baum samt Bildschirmaufnahme geprüft. Die Aufnahme zeigte nur den Token-Dialog.
   Danach wurden der in-app Browser und der URL-gebundene Browserzugang geprüft; beide exakten
   Fehler stehen unter Beobachtet.
3. Erst danach wurden die vorgegebenen Anker `src/client.ts:36`, `:5287`, `:5976`, `:6167`,
   `:7301`, `:7836` und `:10206` gelesen. Für die angeforderten Ableitungen wurden ausschließlich
   die angrenzenden Queue-/Shell-Funktionen und deren CSS in `public/index.html` ergänzt.
4. Reproduktion mit authentifiziertem Browser: Viewport auf 1440x900 setzen, Task queue öffnen,
   Defaultliste und Closed-Zeilen zählen, Status/Waves sowie Programs/Closed prüfen, einen Task
   wählen und die erste primäre Aktion relativ zum sichtbaren Detail-Viewport notieren. Danach die
   Suche nacheinander mit einem eindeutigen Volltextstück, Task-ID, Program-Titel, Repo-Basename und
   Status ausführen. Fokus per Tab, Pfeiltasten, Enter, Escape und Zurück prüfen. Einen nicht
   sensitiven Text in `New task` eingeben, ohne `add` auszulösen, mindestens 5 s warten und Wert,
   Fokus und Caret erneut lesen. Anschließend denselben Lesepfad bei 390x844 wiederholen und je
   Viewport einen echten PNG-Screenshot speichern.
5. Es wurden keine POST-, PUT-, PATCH- oder DELETE-Aufrufe für die Messung verwendet.

## Was nicht gemessen wurde

Nicht gemessen wurden der authentifizierte Live-Inhalt, die Zählung 0/16, Sichtbarkeit und Lage bei
1440x900, die gerenderte 390x844-Ansicht, tatsächliche Suchtreffer, die reale Tastatur-Fokusfolge,
Draft-Erhalt über zwei Server-Polls sowie Desktop- und Mobile-PNGs. Nicht geprüft wurden andere
Workbench-Pfade außerhalb der genannten Queue-/Shell-Anker. Ob der laufende Server dasselbe Bundle
wie Commit `085053d7` ausliefert, ist ebenfalls `UNKNOWN`.
