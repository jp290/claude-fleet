# Das Agenten-Objekt

v2, 20.10.2026, aus dem Gespräch mit dem Owner. Die fünf Teile der Grundansicht hat der Owner
am 20.10. gegen 18:30 bestätigt.

## Grundsatz

Alles, was eine Session beim Start bekommt, ist **ein Objekt**: die Fassung des Agenten, mit Hash. Fleet zeigt die
Fassung, bevor die Session startet, und startet dann genau sie. Was man in der Ansicht sieht, ist das, was startet.

## Die Grundansicht: fünf Teile

Jeder Teil ist eine Zeile und lässt sich aufklappen.

1. **Wer:** Harness, Modell und Effort.
2. **Aufgabe:** Ziel und „fertig, wenn“. Bei einer stehenden Rolle steht hier der Satz der Rolle.
3. **Liest:** die Agent.md als Abschnitte in Ladereihenfolge. Jeder Abschnitt nennt Quelle, Größe und ob er
   änderbar oder fest ist. Die Abschnitte heißen Rolle, Projektregeln, Wissen (als Verweise), Übergabe (nur bei
   einer Nachfolge) und Eigenes.
4. **Darf:** die Rechte als ein Satz mit Ausnahmen.
5. **Arbeitet mit, endet:** an wen der Agent meldet und wer ihm Aufträge gibt, dazu die Übergabe-Schwelle oder die
   Endbedingung.

Was Claude Code selbst mitbringt, steht eingeklappt darunter: Systemprompt, Werkzeuge, Skill- und Agentenlisten. Es
ist sichtbar, gehört aber nicht zur Fassung. Bei der Orchestratorin macht dieser Teil 57 % der ersten Anfrage aus.

## Überall dieselbe Ansicht

- **Neue Session:** Hier wird die Fassung bearbeitet.
- **Info-Tab einer laufenden Session:** „läuft mit Fassung a1b2c3“, zum Lesen.
- **Nachfolge:** ein Kasten „startet als Nächstes“ mit der nächsten Fassung und dem Unterschied zur laufenden.
  Meist ändert sich nur die Übergabe.
- **Konstellation:** Jede Position ist so ein Kasten.
- **Historie und Export:** eine Liste solcher Fassungen.

Weil man überall dieselben Menüs sieht, versteht man das Konzept schnell. Alle weiteren Funktionen bauen auf der
Grundansicht auf, keine bekommt eine eigene Ansicht daneben.

## Was dafür am Server fehlt

Heute setzt der Server den Start erst beim Spawn zusammen. Die Teile kommen aus vielen Quellen:

- die Rollenkarte als Konstante in `server.ts`
- der Regel-Render je Rolle (`rulebook/render/…`, über `--add-dir`)
- die globale `CLAUDE.md` und `MEMORY.md`
- die Übergabe der Vorgängerin
- die Startschritte aus `.fleet/init.md`
- die Context-Pack-Anker und die Box
- Agent-MD und Rechte, falls gesetzt

Die Ansicht kann das nur nachbauen. Nötig sind:

1. Eine Funktion, die die Fassung für einen Start berechnet: neu, Nachfolge, Lane oder Orchestratorin.
2. Eine Route, die die Fassung zeigt.
3. Ein Spawn, der nur aus der Fassung liest. Der Start-Beleg trägt ihren Hash.
4. Rollenkarten als Dateien statt als Konstanten. Eine Phase wie „Umbau“ ist dann nur eine andere Rollendatei.

## Bauplan in Schnitten

Jeder Schnitt ist für sich landbar. Die Schnitte, die den Start bestehender Sessions berühren, kommen zuletzt.

1. **Fassung zeigen, nur lesend.** Den vorhandenen Gründungsplan ausbauen statt etwas daneben zu stellen. Das sind
   `GET /api/founding-plan`, `session-blocks.ts` und `planHash`. Heute gilt er nur für eine neue Session im Fenster,
   und sein Hash deckt nur „Wer“ und an/aus der Bausteine ab (Fund von Slot 8 in der Bauliste). Neu:
   - Der Plan wird auch für einen laufenden Slot und für seine Nachfolge berechnet:
     `GET /api/slots/:id/fassung?anlass=laufend|nachfolge`.
   - Der Hash deckt den Inhalt aller fünf Teile ab.
   - Dafür werden dieselben Bauteile aufgerufen wie beim Spawn, nichts wird nachgebaut. Der Spawn bleibt
     unverändert.
   *Fertig, wenn:* Für die Orchestratorin, eine Lane und eine freie Session stimmen die Abschnitte unter „Liest“
   mit dem überein, was ihr Transkript als geladen zeigt. Geprüft wird das mit `server/claude-code-anatomie.ts`.
   Die Tests sind grün.
2. **Grundansicht.** Slot 8 baut auf `bau/neue-session` die fünf Zeilen. Sobald Schnitt 1 steht, liest die
   Ansicht dessen Route. *Fertig, wenn:* Der Owner hat die Ansicht auf der Testinstanz durchgeklickt.
3. **Info-Tab.** „[Zitat entfernt]“ und der Nachfolge-Kasten öffnen dieselbe Ansicht. *Fertig, wenn:* Bei einer
   Nachfolge zeigt der Kasten vorher genau das, was danach startet.
4. **Spawn aus der Fassung, Rollenkarten als Dateien.** Ab hier liest der Spawn nur noch aus der Fassung. Eine
   Phase wie „Umbau“ ist dann eine andere Rollendatei. *Fertig, wenn:* Der Hash im Start-Beleg gleicht dem Hash der
   gezeigten Fassung, für jede Startart.
5. **Die Orchestratorin in der Phase „Umbau“.** Sie ist die erste echte Nutzerin. Ihr Start wird vorher und
   nachher gemessen.

Danach bauen Konstellation und Export auf Fassungen auf. Der Security-Check läuft als erster Fall, und jeder Sitz
darin ist so ein Objekt.

## Was das löst

- **Eine Nachfolge setzt die Rolle nicht mehr zurück.** Die Rolle ist Teil der Fassung, und der Nachfolge-Kasten
  zeigt vorher, was startet.
- **Die CLAUDE.md-Frage wird sichtbar.** Die Projektregeln sind ein Abschnitt unter „Liest“, und man entscheidet
  je Agent, ob man sie behält, kürzt oder ersetzt.
- **Teilen ist der Export dieser Objekte.** Eine Konstellation besteht aus Fassungen und Kanten, und die JSON
  trägt genau das.
