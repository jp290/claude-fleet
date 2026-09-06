# Fleet Hub — Overlay-Dashboard über die ganze Fleet (Owner-Richtung 2026-09-06)

Festgehalten vom 🎛 Fleet Controller (Slot 7) aus dem Owner-Gespräch 2026-09-06 18:3x–18:5x.
Dieses Dokument ist RICHTUNG, kein Auftrag und kein Program: es hält die Worte des Owners,
die Zuordnung auf das, was heute existiert, und den vorgeschlagenen ersten Schnitt fest, damit
die Idee nicht wie der Plan vom 2026-08-11 in einer Session stirbt. Zahlen und Zuordnungen sind
am Baum `37d6e95` gelesen; wer später liest, misst neu.

## 1. Die Owner-Worte (wörtlich, drei Nachrichten)

> „Zumindest verstehe ich darunter die Ansicht für Studios, Tasks, Programme, Projekt-Repos und
> wie diese zusammenarbeiten."

> „Es gab in meiner Idee folgende Begriffe, die ich versucht habe anzuordnen und darin meine
> anderen Ideen sauber unterzubringen: repo's { projekt1; projekt2; prj3 }. Hier gibt es dann im
> Prinzip drei verschiedene Bearbeitungsmodi: freeDevMode → ClaudeFleet Slots-Ansicht;
> studio's → gameDev → iosDev (which function kinda as agentic-programmatic-workflows); und
> programme → AutoDev (korrekt eingestellte Systeme, die autonom zusammenarbeiten) →
> IdeenFindung und auch was wie → discuss ContextPack XYZ on a socialAgenticDiskussionPlatform."

> „Wie Tasks und alles hier eingreifen, habe ich noch nicht ganz ausgearbeitet … Aufträge und
> Tasks könnten sich basically sowohl bei Projekt-Repos, bei Studios und auch sonstigem einreihen."

> „Die Idee ist überhaupt, dass dieser Hub nur ein Overlay-Dashboard innerhalb der aktuellen UI
> wird, um dem User eine weitere, effizientere Abstraktionsebene zu geben. Am Ende soll es eine
> saubere, zusammenhängende, klar strukturierte Overlay-Ansicht ergeben, auf der man einfach und
> effektiv Claude Fleet auf ganzer Ebene benutzen kann. Am Anfang noch nicht alles, aber schon bald
> denke ich, dass diese Abstraktionen auch wieder Möglichkeiten für Weiteres mit sich bringen."

## 2. Zuordnung auf das, was existiert

| Owner-Begriff | Heute im Code | Fehlt |
|---|---|---|
| Repo als Wurzel | `repo`/`cwd` an Slot, Task, Program; `GET /api/repo-workers` je Repo | eine repo-first Ansicht; Repo ist Attribut, kein Objekt |
| freeDevMode | das Slots-Board (`GET /api/sessions`) | nichts |
| Studio (gameDev, iosDev) | `docs/product-studio-working-circle.md`, `docs/game-maker/workflow-v2.md`, private-repo-p-Programs | ein Objekt; heute nur Docs und je ein Program |
| Program / AutoDev | `Program` mit MAIN-Bindung, Release-Tür (`/api/self/tasks/:id/release`), Self-Land-Promotion (`selfLand: guarded`), Program-Dispatch-Grant, Lane-Deckel je Program | die Knöpfe sind gesetzt, aber nicht als „Autonomiegrad" sichtbar/setzbar |
| Ideenfindung | Queue-Zeilen `notiz`/`richtung`, Scout-Zeilen `[idee scout-*]`, Analyst (`tickAnalysisSweep`, im Betrieb AUS) | ein Ausgang, der die Queue schrumpft („verwerfen empfohlen", Plan 2026-08-11 Stufe 2) |
| ContextPack | ContextPlan/receipt (Studio-Doc), `ContextEnvelope` (ACP Act 5–7, nie gebaut: 0 Treffer im Code) | das Objekt selbst |
| socialAgenticDiskussionPlatform | Clarifications (`/api/self/clarifications`), Attention, Steward-Arena (Attic) | der Thread, in dem mehrere Agenten ein Pack diskutieren und ein Verdikt liefern (= L-Workspace, Plan 2026-08-11) |
| Tasks bei Repo / Studio / Program | `Task.repo` immer, `Task.programId` optional (Owner kann per `POST /api/tasks` mit `programId` filen) | ein optionaler Studio-Bezug derselben Art |

Lesart des Controllers, vom Owner noch nicht bestätigt: die drei Modi sind keine Zustände des
Repos, sondern Arten von Aktivität IM Repo und laufen gleichzeitig. Studio = Vorlage (Rollen,
Stufen, Werkzeuge, ContextPlan), Program = Ausführung (Ziel, MAIN, Queue, Erfolgskriterium),
AutoDev = Autonomiegrad eines Programs, nicht ein Geschwister der Studios.

> Nachtrag 18:5x: „Ja, wobei wir alles soweit, je nach Programm und Modus, abstrahieren und
> simplifizieren wollen."

Konsequenz: die Projektion ist HÖHENABHÄNGIG. Je Aktivitätsart eine eigene Kartenform, nicht
drei gleichförmige Spalten: ein freeDev-Repo zeigt seine Slots und sonst nichts · ein
AutoDev-Program zeigt seine Regler (Release-Tür, Self-Land, Dispatch-Grant, Deckel), den
Queue-Stand in einer Zahl und die NÄCHSTE Owner-Entscheidung · ein Studio zeigt seine Stufen und
die Stufe, in der es steht. Detail liegt eine Ebene tiefer, in der bestehenden Ansicht.

## 3. Die eine harte Regel: Overlay heißt Projektion

Der Hub hat KEINEN eigenen Zustand. Er liest dieselben Daten wie Board, Queue und
Program-Ansicht und führt bei jedem Klick in die bestehende Ansicht hinunter. Eine zweite Fläche
mit eigenem Speicher driftet (bezahlt bei den Terminal-Overlays, Memory
`feedback-native-over-parallel-views`). Neue Verben entstehen erst mit neuen Objekten; der Hub
zeigt zuerst die vorhandenen Verben (freigeben, Lane starten, Deploy, Program abschließen) an der
richtigen Stelle.

## 4. Vorgeschlagener erster Schnitt (client-only, freezefrei nach Portfolio-Plan §0.4)

Eine Repo-Zeile je Projekt-Repo mit je einer Karte pro Aktivitätsart (Form nach §2-Nachtrag):
freie Slots · laufende Programs mit Autonomiegrad, Queue-Zahl und nächster Owner-Entscheidung ·
Studios vorerst als Verweis auf ihre Docs.
Darunter die Land-Takt-Zahl des Repos aus den Ledgern. Kein neues Feld am Server, keine neue
Route. Done, wenn die Ansicht ausschließlich aus `GET /api/sessions`, `GET /api/tasks`,
`GET /api/programs` gebaut ist und jeder Klick in eine bestehende Ansicht führt.

Reihenfolge danach: Studio als Vorlage (Felder aus Game-Maker v2 und Studio-Doc) → ContextPack
und Thread zuletzt, mit Astras Plan-Lücken-Register (`1af3fa1f`) als Input.

## 5. Offen beim Owner

1. Studio als wiederverwendbare Vorlage oder als langlebiges Ding mit eigener MAIN?
2. Ist ContextPack dasselbe wie ContextPlan/ContextEnvelope, oder ein kleineres Bündel an einer
   Diskussion?
3. Wer fällt auf der Plattform ein Verdikt: nur der Owner, oder auch eine MAIN mit Grant?
4. Wie Tasks sich bei Repo, Studio und Sonstigem einreihen (Owner: „müssen wir sauber durchdenken").
