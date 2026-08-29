# MAIN-/Lane-Lifecycle-Lücken aus dem Private-repo-o-Preflight

Datum: 2026-08-29
Beobachteter Produktlauf: Program `f99e9354f823ec677bcb8e54`, Reviewer-Task `8e91fdc9`
Akzeptierter und durch den Owner gelandeter Kandidat: `bbaf1582636b20c482fb7c73525968ccc969880a`

## Fragestellung und Abstraktionsurteil

Soll eine Project MAIN einen akzeptierten Worker-Akt selbst bis zum terminalen Task-Zustand führen
können, ohne dass Slot-Prozessleben, Qualitätsurteil und Promotion zu einem einzigen impliziten
Prädikat werden?

Die Abstraktion **Task-Lifecycle getrennt von Slot-Lifecycle** sollte existieren: ein Task ist die
dauerhafte Arbeits- und Autoritätszeile, ein Slot nur ihr wiederverwendbarer Ausführer. Der aktuelle
Fehlerfall zeigt, dass ein sauberer, akzeptierter Commit nicht terminal werden kann, solange sein
Agent weiterlebt. Welche konkrete Transition diese Trennung ausdrückt, ist noch nicht entschieden;
ein vorschnelles `retire` würde nur einen möglichen Mechanismus vorwegnehmen.

## Beobachteter Ablauf

1. Eine Opus-Architect-Lane schrieb den DRAFT der `GAME-CARD.md`.
2. Eine getrennte `pi-zai`-Reviewer-Lane prüfte und überarbeitete ihn adversarial und committete
   `bbaf1582…` als FINAL.
3. Die Private-repo-o-MAIN prüfte Report, Diff, Commit und Lane selbst und disponierte `ACCEPT`.
4. Die Reviewer-Lane blieb lebendig. Deshalb projizierte Fleet den Task als `RUNNING`, nicht als
   `REVIEWABLE`; die MAIN erhielt keine Land-Tür.
5. Der Owner landete `bbaf1582…` über das Board. Der Backend-Akt war erfolgreich, wirkte im UI aber
   zunächst wie ein wirkungsloser Klick.
6. Die gebundene MAIN erhielt den Owner-Land nicht als neues typisiertes Ereignis. Sie konnte den
   Preflight-Receipt deshalb erst nach einem erneuten expliziten Faktenabruf oder Owner-Hinweis
   schließen und B1 freigeben.
7. B1 wurde anschließend als Claude-Task gebaut und von der MAIN vollständig verifiziert. Self-Land
   verweigerte aber erst am Ende, weil der frische Game-Maker-Repo-Root keinen eigenen
   `FLEET_VERIFY_CMD_REPOS`-Eintrag hatte. Der Owner landete erneut.
8. B3 meldete aus Slot 4 `complete`; MAIN prüfte Commit, Write-Set, Typecheck, 14/14 B3-Tests und
   44/44 Gesamttests. Trotzdem blieb Task `0fcb24a4` `RUNNING`, weil die fertige Sonnet-Lane noch
   lebte. Damit ist Befund 1 kein einmaliger Preflight-Sonderfall.

## Befunde, nach Fehlerkosten gerankt

### 1. Hoch — Ein akzeptierter lebender Worker blockiert die Self-Land-Tür der MAIN

**Verifiziert.** `program-phase.ts:194-210` klassifiziert eine gesendete Lane nur dann als
`REVIEWABLE`, wenn das Lane-Prädikat greift; jede übrige lebende Lane fällt auf `R13 RUNNING`.
`server.ts:7897-7903` verlangt für Self-Land weiterhin einen lebenden `sent`-Task mit exakter Lane,
und `server.ts:7981-7987` verlangt zusätzlich `done-looking`. Ein semantischer `ACCEPT` der MAIN
ändert keinen dieser Fakten. Der Worker-Report ist laut Rollenbrief ausdrücklich nur eine Nachricht
und keine Statusänderung (`server.ts:8731-8745`).

**Kosten.** Ein gewöhnlicher, sauberer, von der MAIN akzeptierter Program-Akt benötigt den Owner nur
deshalb, weil der Worker-Prozess nicht beendet wurde. Der Preflight bleibt unvollständig und alle
abhängigen Builder-Tasks bleiben gesperrt. Das widerspricht der erprobten Zuständigkeit, nach der die
MAIN gewöhnliche In-Program-Integration selbst entscheidet.

**Noch offen.** Nicht verifiziert ist, welche Transition richtig ist: explizites Worker-Finish,
exaktes MAIN-Terminate, atomisches Freeze-and-Land oder eine andere Trennung von Task und Slot. Eine
Lösung muss verhindern, dass ein recycelter Slot fremde Terminalität oder Promotion erbt.

**Falsifikator.** Ein deterministischer Test hält einen sauberen, ahead, akzeptierten Worker nach
seinem Report lebendig. Die MAIN muss genau diesen Kandidaten terminalisieren und landen können;
Slot-Recycle, falsche MAIN, fremdes Program und bewegter HEAD müssen jeweils abgelehnt werden.

**Wiederholung am Produktcode.** `fleet.json:7293-7310` trägt B3 als `sent` in Slot 4. Der Worker
meldete Commit `a38894b125eb3ff5fcd5202af226ce0abf9083a2` vollständig; die MAIN prüfte ihn und sah
dennoch `RUNNING`, weil der Lane-Predicate `alive` nicht als terminale Ergebniswahrheit liest. Das
gleiche Muster trat vorher bei Architect und Reviewer auf.

### 2. Hoch — Owner-Land erzeugt ohne vorherigen Watch kein Ereignis für die gebundene MAIN

**Verifiziert.** `landLane` markiert den Task als `done`, emittiert das Outcome und beendet die Lane
(`server.ts:4928-4963`). Das optionale Ereignis entsteht nur über den übergebenen Callback. Der
Merge-Emitter iteriert ausschließlich bereits bewaffnete Merge-Watches
(`server.ts:6692-6709`). Die Self-Land-Route gibt das Watch-Objekt erst nach dem Start des eigenen
Land-Jobs an die MAIN zurück (`server.ts:8041-8050`). War Self-Land vorher nicht erreichbar und
landet stattdessen der Owner, existiert kein automatisch adressiertes MAIN-Ereignis.

**Kosten.** Der Backend-Zustand ist korrekt, der Program-Owner bleibt aber auf veralteter
Ausführungswahrheit stehen. Der nächste abhängige Task startet erst nach Polling oder menschlichem
Nudge. Der Private-repo-o-Lauf zeigte genau diesen Stillstand nach erfolgreichem Owner-Land.

**Falsifikator.** Owner-Land eines exakten Program-Tasks ohne vorbestehenden Watch muss genau ein
durables, occupant-gebundenes Ereignis an die aktuell gebundene MAIN liefern. Ein Nachfolger, ein
recycelter MAIN-Slot und ein fremdes Program dürfen es nicht erhalten. Retry darf kein Duplikat
erzeugen.

### 3. Mittel — Das Board bestätigt einen erfolgreichen direkten Land nicht sichtbar

**Teilweise verifiziert.** Der Klick landete `bbaf1582…` nachweislich; die Ledger-Zeile
`lane-outcomes.jsonl:610` trägt `disposition:"landed"` und
`landedBy:{kind:"owner",via:"cookie"}`. Der direkte Erfolgszweig räumt nur Pane-Zuordnung auf und
ruft `refresh()` (`src/client.ts:1054-1058`); er zeigt keine explizite Erfolgsbestätigung. Der
`finally`-Zweig rendert das Board erneut (`src/client.ts:1071-1075`).

**Kosten.** Ein irreversibler Akt sieht wie ein No-op aus. Das provoziert Wiederholungsklicks,
unnötige Diagnose und Zweifel daran, welcher Commit wirklich gelandet wurde.

**Nicht verifiziert.** Warum die Zeile im beobachteten Browser nicht sichtbar umsprang, obwohl der
Client `refresh()` aufruft. Das braucht eine Browser-/Netzwerk-Reproduktion; aus dem Quelltext allein
folgt kein Refresh-Fehler.

**Falsifikator.** Ein UI-Test landet eine Lane, wartet auf die Antwort und verlangt eine sichtbare,
SHA-/Task-gebundene Erfolgsmeldung sowie die aktualisierte Board-Zeile. Fehler, Timeout und bereits
gelandet müssen unterscheidbare Zustände zeigen.

### 4. Mittel — Der Preflight-Receipt beweist den Reviewer-Harness, aber nicht das Modell

**Verifiziert.** `lane-outcomes.jsonl:610` und `context-receipts.jsonl:317` speichern für den
Reviewer `harness:"pi-zai"`, `effort:"high"`, aber `model:null`. Damit ist die Trennung vom
Architect-Harness belegt, nicht die konkrete Behauptung „GLM-5.3“. Die Git-Author-Zeile ist keine
Modelltelemetrie.

**Kosten.** Der vorgeschriebene Cross-Model-Review ist rückblickend nicht maschinell belegbar. Ein
Audit muss einer flüchtigen Operator-Aussage vertrauen oder korrekt `unknown` berichten.

**Nicht verifiziert.** Ob das Modell schon beim Task-Start unbekannt war, ein Adapter es nicht
meldete oder die Receipt-/Outcome-Projektion es verlor.

**Falsifikator.** Starte denselben Reviewer einmal mit explizitem Modell und einmal mit einem
Harness, der keine Modellidentität liefert. Im ersten Fall müssen Task, Context-Receipt und Outcome
dasselbe Modell tragen; im zweiten müssen alle drei ausdrücklich `unknown` statt einer erfundenen
Identität tragen.

### 5. Mittel — Controller kann Programme vorschlagen, aber keine bestehende MAIN typisiert ansprechen

**Verifiziert.** Der portable Rollenvertrag gewährt dem Controller
`POST /api/self/programs`, aber keine Owner-Route (`AGENTS.md:52-57`). Der Self-Endpunkt akzeptiert
einen nicht-Lane-Aufrufer, validiert den Inhalt und speichert ein `proposed` Program
(`server.ts:21769-21796`). Eine typisierte Controller→MAIN-Nachricht ist nicht Teil dieses
Rollenvertrags; nur der Supervisor besitzt `POST /api/self/nudge`.

**Kosten.** Ein Controller kann eine systemische Lücke erkennen und dauerhaft als neues Program
ablegen, aber eine bereits laufende MAIN nicht auffordern, sie innerhalb ihres Programs zu prüfen.
Der Mensch muss Nachricht oder Program-Grenze übersetzen.

**Architekturfrage, kein bestätigter Defekt.** Eine generische `send(slot,text)`-Route wäre eine
zweite, ungebundene Autoritätsbahn. Zu prüfen ist zuerst, ob der korrekte Mechanismus ein neues
Program, ein Supervisor-Nudge oder ein eng typisiertes Program-Ereignis ist.

### 6. Hoch — Produktrepo-Verify wird erst nach vollständig gebauter und geprüfter Lane als fehlend sichtbar

**Verifiziert.** Self-Land lehnt ein Repo ohne eigenen `VERIFY_CMD_REPOS`-Eintrag vor dem Merge ab
(`server.ts:7919-7926`). Die Map wird ausschließlich beim Serverstart aus
`FLEET_VERIFY_CMD_REPOS` gelesen (`server.ts:11871-11913`). Die Live-Konfiguration trägt einen
Eintrag für `/Users/owner/private-repo-o`, nicht aber für den frischen Program-Root
`/Users/owner/private-repo-o.worktrees/game-maker-private-repo-o-fresh`. B1 wurde deshalb erst nach
24 Dateien, 30 Tests und MAIN-Reprüfung mit `repo has no owner-configured verify entry` blockiert.

**Kosten.** Eine bekannte, statische Betriebs-Voraussetzung wird am spätesten möglichen Zeitpunkt
entdeckt. Die MAIN kann korrekt bauen und prüfen, besitzt aber keine wirksame Promotion-Tür; der
Owner muss wieder landen. Jeder neue Game-Maker-Worktree kann denselben Fehler wiederholen.

**Architekturfrage.** Der Verify-Befehl ist Owner-Policy und darf nicht aus einem Worker-Brief oder
einem Request übernommen werden. Zu entscheiden ist, ob Game-Maker-Founding, Profil-Grant oder der
erste Task-Release die bloße Existenz eines owner-konfigurierten Eintrags vorab prüfen und als
`OWNER_GATE` sichtbar machen soll.

**Falsifikator.** Gründe ein Game-Maker-Program in einem Repo ohne Map-Eintrag. Vor dem ersten
Builder-Release muss die Projektion die fehlende Owner-Konfiguration benennen; mit einem kanonisch
passenden Eintrag muss derselbe Task bis zum gemessenen Land kommen. Symlink-/linked-worktree-
Identitäten müssen auf denselben Repo-Key fallen.

### 7. Mittel — Task-Erzeugung erlaubt eine unattended nicht startbare Harness-Wahl und hinterlässt Dubletten

**Verifiziert.** Die MAIN konnte Task `3ddd10b8` mit `spawn.harness:"pi-zai"` pending anlegen. Erst
`releaseTaskForMain` prüft `harnessAutomatableFor` und verweigert
(`server.ts:7755-7767`). Danach musste die MAIN einen zweiten B1-Task `58ec764b` auf Claude filen;
der erste blieb pending und weiterhin release-fähig. `fleet.json:7162-7179` zeigt ebenso den alten
Architect-Task nach Lane-Schließung wieder pending; `detachSlotTasks` setzt abgebrochene sent-Zeilen
absichtlich zurück auf pending (`server.ts:5753-5760`).

**Kosten.** Das Board zeigt alte Zeilen als ausführbare READY-Arbeit. Ein späterer Klick kann einen
zweiten Architect- oder B1-Lauf auf bereits gelandete Schreibflächen starten. Die MAIN besitzt laut
portablem Vertrag Create, Release und Land, aber keine eigene Archive/Delete-Tür; die Owner-Route
besitzt diese Mutationen (`server.ts:24199-24277`).

**Dokudrift.** `docs/self-api.md:330-334` behauptet noch, Release prüfe stets den Default-Adapter und
könne deshalb heute nie an der Harness-Automation scheitern. Der aktuelle Code prüft dagegen die
persistierte Wahl des konkreten Tasks, und der reale `pi-zai`-Fall scheiterte genau dort.

**Falsifikator.** Task-Create und Task-Release mit einer nicht automatisierbaren Harness müssen als
eine konsistente Zustandsmaschine getestet werden. Nach einer abgelehnten Wahl muss die MAIN die
exakte, noch nie gestartete eigene Zeile sicher ersetzen oder terminal archivieren können; fremdes
Program, bereits gestartete Lane und recycelte MAIN müssen abgelehnt werden.

### 8. Mittel — Visuelle Captures sind nicht automatisch an einen sauberen Kandidaten gebunden

**Verifiziert am Lauf, nicht als vollständiger Code-Audit.** B3s sichtbarer Build-Stamp lautete
`a5d060b-dirty`. Die MAIN bemerkte das manuell und verfügte, dass B4-Beweisbilder nur aus einem
sauberen Baum zählen. Der Report konnte trotzdem `complete` melden; weder Task-Phase noch Land-Tür
leiten aus dem Capture-Stamp eine Evidenzbindung ab.

**Kosten.** Ein Screenshot kann ein Bild zeigen, dessen Bytes keinem Commit entsprechen. Ein
späterer Critic oder Nachfolger könnte ihn irrtümlich als Beweis für den gelandeten Kandidaten lesen.

**Noch offen.** Nicht geprüft ist, ob der bestehende Game-Maker-Checkpoint oder ein anderer
Operator-Receipt diese Bindung bereits für den späteren integrierten Play erzwingt. Keine neue
Capture-Entity entwerfen, bevor dieser Pfad vollständig gelesen ist.

**Falsifikator.** Ein Capture mit `-dirty` oder abweichender SHA darf nicht als Beweis für einen
clean Candidate akzeptiert werden; ein sauberer Stamp mit exakt gestarteter SHA muss gelten. Das
Spiel darf weiterhin dirty gebaut werden — nur der Evidenzstatus bleibt ausdrücklich ungebunden.

## Gemeinsame Kausalhypothese

Fleet koppelt an dieser Stelle drei verschiedene Wahrheiten:

- **Ausführung:** lebt der Slot noch?
- **Ergebnis:** hat der Worker ein belegtes Resultat gemeldet und wurde es von der MAIN akzeptiert?
- **Promotion:** darf genau dieser Commit in den Integrationsbranch?

Die Projektion darf diese Wahrheiten lesen, aber keine davon aus den anderen erfinden. Der kleinste
glaubwürdige Entwurf besitzt deshalb explizite, occupant- und commit-gebundene Übergänge und nutzt
das bestehende Task/FleetEvent-Ledger, sofern es die Invarianten tragen kann. Ein zweites
Lifecycle-Ledger oder ein freier Nachrichtenbus ist nur gerechtfertigt, wenn die vorhandenen
Entitäten nachweislich nicht ausreichen.

## Auftrag für eine neue Opus Project MAIN

Den folgenden Text unverändert als Gründungs-/Startnachricht verwenden:

```text
Du bist die Project MAIN eines Standard-Programs im Repository /Users/owner/claude-fleet.
Dein Auftrag ist nicht, einen einzelnen Private-repo-o-Sonderfall zu flicken, sondern die durch ihn
sichtbar gewordene Task-/Lane-Lifecycle-Lücke kausal zu schließen.

Lies zuerst vollständig:
- docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md
- AGENTS.md, besonders Rollenvertrag, Hard invariants, Verify und Landing
- program-phase.ts
- lane-signals.ts
- server.ts:4928-4963, 6648-6710, 7272-8055, 8728-8750, 21769-21805
- src/client.ts:1019-1075
- docs/self-api.md:221-278 und 495-575
- die relevanten Familien in e2e/programs.ts, e2e/merge.ts, e2e/attention.ts und e2e/pins.ts
- lane-outcomes.jsonl:610 und context-receipts.jsonl:317 als beobachteten Fall; behandle Ledger
  als Evidenz, nicht als Spezifikation.

Vor jeder Rohsuche im Code: benutze graphify. Lies Code vor jeder Behauptung. Trenne VERIFIZIERT,
ABGELEITET und NICHT GEPRÜFT; jede Finding braucht konkrete Datei:Zeile und Fehlerkosten.

ERSTER AKT — noch keine Implementation:
1. Beauftrage genau eine frische GLM-5.3-Lane mit einem read-only Architekturreview. Gib ihr die
   obigen Dateien, den beobachteten Ablauf, diese acht Befunde und die Aufgabe, insbesondere die
   scheinbar einfache Lösung „MAIN darf Worker retire'n“ adversarial anzugreifen.
2. Die GLM-Lane muss eine explizite Zustandsmaschine für Task, Slot-Occupant, Report/Acceptance,
   Candidate-SHA, Land und Owner-Land-Ereignis liefern. Sie muss Concurrent-/Recycle-/Restart-
   Falsifikatoren nennen und prüfen, ob bestehende Task/FleetEvent-Zustände genügen.
3. Prüfe Bericht, Quellanker und vorgeschlagenen Entwurf selbst. Disposition genau ACCEPT, RETHINK
   oder OWNER. Kein Code und keine Worker-Briefs bei RETHINK/OWNER.

BEI ACCEPT:
4. Forme den akzeptierten Entwurf in 1–3 normale Worker-Aufträge mit disjunkten Write-Sets um.
   Mindestens abzudecken sind:
   - serverseitige Terminal-/Land-/Event-Zustandsmaschine samt deterministischen Race-Proben,
   - sichtbare und wahrheitsgemäße Board-Land-Rückmeldung,
   - frühe Repo-Verify-/Harness-Fitness sowie sichere Bereinigung nie gestarteter Program-Tasks,
   - Modell-/Harness-Provenienz und Capture↔Candidate-Bindung nur falls die Analyse einen realen
     Verlustpfad belegt.
   Du entscheidest die endgültige Zerlegung; kopiere keine spekulative Lösung aus der Messnotiz.
5. Release nur dependency-free roots. Worker verwenden GLM, sofern ihre konkrete Aufgabe keine
   andere dokumentierte Fähigkeit verlangt. Du liest jeden Report, Diff, Test und Kandidaten selbst.
6. Du landest gewöhnliche akzeptierte In-Program-Arbeit über deine Self-Land-Tür, soweit die
   aktuelle Projektion sie tatsächlich gewährt. Eine fehlende Tür wird nicht mit Owner-Credentials,
   tmux-Injection oder einer erfundenen Nachricht umgangen; sie ist Teil des Befunds.

HARTE GRENZEN:
- Keine Änderung am Private-repo-o-Produktrepo.
- Kein generischer beliebiger Slot-Nachrichtenbus ohne belegte Notwendigkeit.
- Keine Auto-Land-Policy und keine Schwächung von Owner-Auth oder exact-occupant checks.
- Kein zweites persistiertes Lifecycle-System, solange Task/FleetEvent den Entwurf tragen.
- Kein Deploy. Commit und serverseitiges Land sind getrennte Akte.
- Änderungen anderer Sessions im Hauptcheckout nicht anfassen, stagen oder committen.

DONE:
- Eine unabhängige GLM-Kritik und deine dokumentierte Disposition existieren.
- Jeder akzeptierte Übergang hat einen deterministischen Positiv- und Negativ-/Race-Falsifikator;
  mindestens Slot-Recycle, fremdes Program, bewegter HEAD, Owner-Land ohne Watch, nicht
  automatisierbare Harness, fehlender Repo-Verify-Key und UI-Fehlerpfad.
- Relevante Adapter und Oberflächen sind jeweils apply, unsupported oder not-applicable zugeordnet.
- Die vom Gate verlangte Verify-Kette endet in ALL PASS; kein ungemessener Lauf wird als grün
  behauptet.
- Akzeptierte Worker-Commits sind gelandet und der Abschlussbericht nennt gelandete SHAs,
  Verifikation und offene Grenzen.

RETHINK:
Nach fünf Fix-Schleifen oder sobald die Lösung eine zweite Lifecycle-Entity, einen generischen Bus
oder unklare Doppelautorität verlangt: stoppen, den strukturellen Konflikt belegen und OWNER fragen.
```

## Controller-Grenze und praktischer Einstieg

Eine Fleet-Controller-Session kann diesen Auftrag als **Program-Vorschlag** dauerhaft ablegen.
`validateProgramContent` verlangt `title`, `intent`, `successCriterion` sowie die vier Arrays
`nonGoals`, `decisions`, `evidence`, `openQuestions` (`server.ts:2384-2425`). Der Self-Endpunkt
stempelt den Vorschlag auf die eigene Session und speichert ausschließlich Status `proposed`
(`server.ts:21769-21796`).

Der Controller kann nicht bestätigen, aktivieren oder die Project MAIN gründen. Die praktische
Übergabe lautet daher:

1. Controller legt den Vorschlag ab.
2. Owner öffnet das Board, prüft den Inhalt, bestätigt und aktiviert das Standard-Program.
3. Owner gründet eine neue Opus Project MAIN im Fleet-Repo.
4. MAIN beginnt mit dem GLM-Architekturreview aus dem Prompt oben und filed erst nach ACCEPT die
   Worker-Aufträge.

## Messgrenzen

- Gelesen: aktuelle Lifecycle-/Self-Land-/Land-/Watch-/Board-/Program-Proposal-Pfade sowie die zwei
  konkreten Private-repo-o-Ledgerzeilen.
- Nicht ausgeführt: Browser-Netzwerk-Reproduktion des scheinbar wirkungslosen Buttons, neue
  Concurrent-Lifecycle-E2Es, Modelladapter-Trace vom Spawn bis zum Receipt, vollständiger Audit des
  Game-Maker-Capture-/Checkpoint-Pfads.
- Nicht bewertet: übrige Server-Routen, andere Produkt-Studios, die Private-repo-o-Spielimplementation.

## Decision Trail

| Zeit (UTC) | Entscheidung | Grund | Konsequenz |
|---|---|---|---|
| 2026-08-29T13:08:15Z | Befunde und Architekturfragen trennen | UI-Symptom und Modellursache sind nur teilweise gemessen | Keine erfundene Root Cause oder vorschnelle `retire`-Lösung |
| 2026-08-29T13:08:15Z | Eigenes Standard-Program statt Private-repo-o-Fortsetzung | Lücke betrifft Fleet-Orchestrierung, nicht das Spiel | Private-repo-o-Repo bleibt unverändert |
| 2026-08-29T13:08:15Z | Opus MAIN + genau ein frischer GLM-Review vor Code | Owner verlangt Gegenprüfung und worker-basierte Ausarbeitung | Keine Implementation vor ACCEPT |
| 2026-08-29T13:08:15Z | Controller schlägt nur vor | Bestätigen, Aktivieren und MAIN-Gründung sind Owner-Akte | Mensch behält die Promotion-Grenze |
