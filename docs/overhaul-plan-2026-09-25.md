# System-Overhaul Claude Fleet: Plan (Entwurf, Zeile c90329dd)

Stand 2026-09-25, `main` `5fd561c3`. Entwurf der Orchestratorin (Slot 9). Noch nichts ist gefilet und nichts
freigegeben. Quellen:
- Owner-Text: c90329dd (24.09. + 25.09.) und die Interview-Kommentare 53e3b74f, 36d15d5d, 4fb7736e, d85cc805.
- Befunde: `docs/messungen/2026-09-25-overhaul-kern-{1..5}-*.md`, zitiert als **K1–K5**.

---

## 0. Owner-Vorgabe (wörtlich, gekürzt) und Schnittlinie

- „das memory System fixen bzw. ein überhaupt ein vernünftiges Memory System aufsetzen“ (24.09.)
- „die sessions komplett konfigurierbar machen … einzelne aspekte wie z.b automatisches committen usw. aus dem
  'corePack' rausnehmen können … man könnte so sogar seine alten einstellungen als eine main oder als ein
  worker benutzen … überarbeitete UX vom Sessions erstellen & konfigurieren“ (24.09.)
- „eine detailierte traceability seite …, in der man wirklich _alles_ was geschehen ist, sauber sehen kann“ (24.09.)
- „Bericht …, was unsere aktuelle Anreicherung wirklich macht (gegensätzlich zu dem was wir wollen) und wie
  das alles eigentlich heißen müsste“ (24.09.). **Erledigt durch K4 §2 und §8.**
- „Jeder dieser Aspekte muss in einem eigenen worktree nochmal ausgearbeitet werden“ (24.09.)
- „das System in seinen einzelnen Prozessen komplett überarbeiten, die Briefe effektiver machen“ (25.09.)
- „Claude Fleet soll sich … von einem Coding Support Harness für Agenten, zu einer art persönlichem agenten
  entwickeln“ (25.09.)
- Interview:
  - „der orchestrator als auch die Main Session ihre Beziehung zur Codebase und den Projekten in der
    hirarchischen Weise verstehen“
  - „konzept geführtes nebengedächtnis … von einem topologisch-eskalierendem jev-script … ausgearbeitet“
  - „Berechtigungen … vom Owner frei konfigurierbar … grundeinstellung … sehr freiheitlich … einige blocker“
  - „die geupdateten Worktree's + Testinstanzen einführen und benutzen“
  - eigene Agenten-Identität: „Ja … zukünftssicherer“
  - externer Eingang: „Bucket … (check ifMalicious, if it makes sense, already exissting aso.) dann im
    Backlog …, aggregiert bzw. aufgewertet …, dann frei gestellt … von einem workerAgenten abgearbeitet“

**Schnittlinie:** Welle 1 und 2 decken jeden oben genannten Satz ab. Welle 3 (§3) ist jeweils der erste
Folgeschnitt, kein offenes Programm. Was in §4 steht, ist ausdrücklich nicht beauftragt. Ein neuer Strang
braucht einen neuen Owner-Satz (`docs/scope-inflation.md` §7).


### 0a. Owner-Korrektur zum Entwurf (2026-09-25 ~15:5x, woertlich) — geht jedem Strang unten vor

"Das klingt doch soweit gut, aber ein zwi Dinge noch; 4.die Schalter gibt es soweit in geiwsser form schon, aber es ist noch ziemlich mies implementiert (nicht klar was wozu gehört und wann passiert) 5. Bedenke aber das wir das in großen Teilen schon haben, nur noch nicht eben super auber umgesetzte (hier bin ich vor 1-2 Monaten auch schon stark dran gescheitert, an ssauberen Berechtigungsstrukturen + Autonomie) 6.Ja gut, aber das ist erstmal auch eig nicht wirklich wichtig, ignoriere es ruhig vorerst weiterhin^^, 3. Macht sinn soweit, wobei wie gesagt eig alles geht :')"

Folgen (die Nummern sind die Interview-Fragen):
- **S3 (4):** Der erste Schnitt ist KEINE Neuerfindung der Bausteine, sondern eine Sichtung der BESTEHENDEN Schalter (Gruendungsfenster B2a/B2b und alles andere, was eine Session heute schaltet): je Schalter, wozu er gehoert, WANN er wirkt (Spawn, live, naechster Brief, nie), wo er gespeichert ist, was die UI dazu sagt. Erst daraus die saubere Neuordnung von Schaltern und Profilen.
- **S2 (5):** Berechtigung und Autonomie gibt es in grossen Teilen schon, und ein Versuch vor 1–2 Monaten ist an sauberen Strukturen gescheitert. Der erste Schnitt ist darum KEIN neuer Prinzipal obendrauf, sondern eine Synthese: was existiert (Tokens, Grants, Tueren, Bindungen), was der Versuch im August wollte und woran er scheiterte (docs/autonomy-bausteine-2026-08-06.md, docs/attic/autonomy-map-2026-08-06.md, docs/attic/autonomy-plan.md, docs/attic/autonomy-verbs-2026-08-06.md, docs/attic/orchestrator-autonomy.md, docs/attic/authority-slice-brief-2026-08-23.md, docs/attic/lane-autonomy-future.md, `git show 09b577e9` Owner-Richtung „Effizienz vor Berechtigungs-Strenge"), und ein Konsolidierungsentwurf, der weniger Mechanik hat als heute, nicht mehr. Der im Entwurf beschriebene Orchestrator-Prinzipal ist nur EINE Kandidatenloesung darin.
- **S6 (6):** zurueckgestellt, nicht in den Wellen. Ignorieren bis zu einem neuen Owner-Satz.
- **S4 (3):** Pilot „Claude Fleet" bestaetigt; Konzepte koennen alles sein.
- **Entscheidungen §6:** Blocker-Liste und private Ablage gelten als Default (Owner: „klingt soweit gut"); Leichtgewicht wird geschlossen.


### 0b. Owner-Nachtrag (2026-09-25 ~16:0x, woertlich)

"Aber genauso ist es wichtig das dwir Datenschichten und auch sonstige Responses vom Fleet System usw, schmalern und effizienter gestalten. Wir sollten im übrigen auch diese gesamte arbeit auf einem Worktree machen, so das wir das system nicht brechen^^"

Folgen:
- **Neuer Strang S9 · Schlanke Datenschichten und Antworten:** Ledger, `fleet.json`-Tabellen, Poll- und Self-Antworten, `ctl.sh`-Ausgaben und Briefe werden auf das geschnitten, was ein Leser braucht. Erster Schnitt: Messnotiz — je Route/Ledger/Ausgabe Bytes pro Aufruf × Aufrufe pro Tag × wer liest was davon (K5 §2 `prompts.jsonl` 35 MB ungerotiert und bei jedem Dossier ganz gelesen; K2 Zustellung 1,4–8,6× Verfasstes; K4 ~988-B-Block in 213/313). Daraus eine gerankte Schnittliste mit Byte-Ersparnis. Gehoert zu „Overhaul Kern“, beruehrt S5 (Index statt Vollscan) und S7(a).
- **Welle 0 · EIN Overhaul-Integrationszweig:** Der Code des Overhauls landet NICHT Schnitt fuer Schnitt auf `main` (das der Live-Server faehrt), sondern auf einem Zweig `overhaul` mit eigenem Worktree und eigener Testinstanz (`testinstanz.sh`). Lanes des Overhauls forken von `overhaul` und landen dorthin; `main` wird erst nach Gesamtpruefung auf der Testinstanz in einem Zug nachgezogen. Messnotizen ohne Code (S2-Synthese, S3-Sichtung, S4-Messung, S9-Messung) duerfen weiter auf `main`, weil sie nichts brechen und andere Sessions sie lesen. Offen und ERSTER Schnitt von „Overhaul Kern“: ob der Land-Pfad das heute kann — `server.ts#integrationBranch` liest EINE Basis je Repo (`repoBases`, Route `/api/repo-base`), die Lane merkt sich ihre Basis beim Fork (`worktree.base`, `server.ts#laneBaseRef`); ob `landLane`, Post-Land-Audit und der ff des Haupt-Checkouts einer Lane mit Basis `overhaul` folgen, ist ungeprueft. DONE: e2e-Check — eine Lane mit Basis `overhaul` landet dorthin, `main` bleibt unbewegt, das Audit laeuft gegen den `overhaul`-Tip; Mutationsprobe: Land-Ziel hart auf `main` → Check rot. Bis das steht, laeuft Code-Arbeit des Overhauls in genau einem Worktree nach dem Muster von 52a25990 (Sessions nacheinander im selben Worktree, gelandet wird als Ganzes).

---

## 1. Zielbild

1. Fleet ist die Schnittstelle zwischen Owner (zugleich User), seinen Agenten und später den Nutzern der
   Projekte, die mit Fleet gebaut wurden.
2. Die Rollen bilden eine Hierarchie: Die Orchestratorin sieht alle Projekte, eine MAIN ein Program, eine Lane
   einen Schnitt. Jede Rolle bekommt beim Start ihre **Position** geliefert (wer sie ist, wem sie antwortet,
   wer auf sie wartet, was offen ist, was sie darf) und muss sie nicht aus Doku zusammensuchen.
3. Jeder Akteur hat eine eigene Identität. Das Ledger unterscheidet Owner, Orchestratorin, MAIN, Lane, Tick,
   Sensor und Extern. Die Rechte konfiguriert der Owner, der Default ist freiheitlich, dazu wenige benannte
   Blocker.
4. Eine Session setzt sich aus Bausteinen zusammen (Rolle, Profil, Kontext, Commit-/Verify-/Report-Pflichten)
   und wird im Gründungsfenster gebaut. Bewährte Kombinationen werden als Profile gespeichert. Eine „rohe“
   Session ist die Kombination ohne Bausteine.
5. Ein **Konzeptgedächtnis** hält jedes Konzept (Fleet, Jev, Land-Pfad, eine Person, ein Plan …) in der Tiefe,
   in der es erarbeitet wurde, mit Quellen und Ablösung. Ein ContextPack ist ein auf Rolle und Aufgabe
   zugeschnittener Ausschnitt daraus, also dieselbe Schicht und keine zweite.
6. Das Gedächtnis wächst über ein **Jev-Netz**: viele kleine, hierarchisch verkettete Jev-Urteile, die
   einander speisen. Code schreibt je Fall Anweisung und Logik vor. Jev entscheidet unter den legalen
   Optionen, die der Code baut, und ist nie ein Gate über einem LLM.
7. Später tauschen Agenten Wissen auf einer strukturierten Diskussionsfläche aus (These → Beleg → Gegenbeleg
   → Urteil, Duplikate und Widersprüche werden zusammengeführt). Das Ergebnis fließt ins Konzeptgedächtnis
   zurück, und das ist das Flywheel.
8. Alles, was geschieht, ist als Ereigniskette von der Task bis zum Audit sichtbar, auch was vor Wochen war,
   und die Seite nennt ihren Horizont.
9. Ideen und Bugs von außen landen in einem Bucket, laufen durch eine Gate-Kette und werden dann erst Backlog,
   aggregiert, freigegeben und von einem Worker gebaut.
10. Jeder Strang wird in einem eigenen Worktree mit Testinstanz gebaut (`testinstanz.sh`, live seit
    `55c0e20d`).

---

## 2. Stränge

**Worker-Default für alle Stränge:** `codex/gpt-5.6-sol/high` bis 30.09. 07:28 (GLM erschöpft), danach
`pi-zai/glm-5.3-flash/high` (Memory feedback-workers-to-glm-flash). Opus nur mit Grund in der Karte.

**Testinstanz:** Jede Lane mit Client- oder Serverwirkung startet `./testinstanz.sh up mixed --ttl 60` in
ihrem Worktree und legt Screenshots bei 1200 und 390 px aus dieser Instanz bei. Solange `fd3a2517` (Knopf)
nicht gelandet ist, geschieht das per Skript.

### S1 · Lagebild: jede Rolle kennt ihre Position (Zielbild 2)

- **Warum:**
  - `GET /api/self` liefert weder taskId noch programId, Rolle oder Empfänger, obwohl der Slot die Daten hat
    (K4 Befund 2; `server.ts:38347`).
  - Der Footer sagt nur „your coordinator“ (K4 §2).
  - Die Lane hat keine Phasen-Sicht, die MAIN hat `phaseOf`/`nextActionFor` (K1 FEHLT).
  - Es fehlt „wer wartet auf mich“: fremde Watches, geparkte Sends, Succession-Debt (K3 §5).
  - Der Startbrief einer Nachfolge ist ein einziger Push ohne Warten. Heute ging er an 17 Zeichen Owner-Text
    verloren (K3 §2).
  - Claude lädt `AGENTS.md` nicht: 0 von 40 Lanes (K4 Befund 1).
  - Die Notiz `d53b7c98` (Leichtgewicht, 23 Tage alt, 28-mal zugestellt, K2 Ä3) beschreibt genau diese
    fehlenden Felder.
- **Erster Schnitt:** `GET /api/self` bekommt `position{role, taskId, programId, receiver{role,slot,openedAt},
  harness, model, waitingOnMe[]}`. Daraus rendert der Brief-Footer den Satz „Empfänger: <Rolle> Slot <n>“.
  - **DONE:**
    - e2e-Check in `e2e/self-token.ts`: Eine Lane liest ihre eigene taskId und die MAIN als receiver, eine
      ungebundene Session bekommt `role:"generic"`.
    - Mutationsprobe: das receiver-Feld entfernen → der Check wird rot.
    - Der Footer enthält den Empfänger nachweislich (Receipt-Bytes).
  - **VERIFY:** install, pins, tsc, build; Suite-Offer `FLEET_E2E_MODULES=self-token,lanes-lifecycle`;
    drift `wouldConflict:false`.
- **Zweiter Schnitt (Sammelzeile, dieselbe Fläche):**
  - Nachfolge-Brief bei belegtem Composer über `parkSend` statt Abbruch.
  - Pull-Anker: erste Handlung jeder neuen Session ist `GET /api/self` → `lineage`/`position`.
  - Watches bei In-place-Nachfolge umbinden statt löschen (K3 F1/F6).
- **Abhängigkeiten:** keine. S2 baut auf dem `role`-Feld auf.
- **Worktree:** eigener. Die Fläche ist `server.ts` (self-Routen, `laneExitFooter`) plus `e2e/self-token.ts`.

### S2 · Identität und Rechte (Zielbild 3, Interview 2/5)

- **Warum:**
  - 183 von 186 „owner“-Lands seit 09-01 kamen über den Bearer, 110 davon an einer lebenden MAIN vorbei
    (K1 Ä1).
  - 11 von 12 `confirmedByHuman:true` stammen nicht von einem Menschen (K1 Ä1).
  - Mindestens 154 von 289 „owner“-Zeilen hat ein Agent angelegt. Anlegen, Freigeben und Archivieren über die
    Owner-Route schreiben kein Audit (K2 Ä1).
  - Der Stall-Sensor schließt 75 Attention-Zeilen als `by:"owner"` (K3 F5).
  - Eine MAIN kann den Worker nicht ändern. Die 150 Modellwechsel liefen alle über die Owner-Route (K2 Ä2).
- **Erster Schnitt:**
  - Ein eigener Prinzipal `orchestrator`: Self-Token des Slots mit Orchestrator-Label plus Owner-Grant; das
    Label allein gewährt nichts, analog `memory-grant`.
  - Er öffnet die Task-Türen (anlegen, freigeben, spawn ändern, archivieren mit Pflichtgrund) über alle
    Programs.
  - Jede Task-Mutation schreibt `actor{kind, slot, openedAt}` ins Audit.
  - `byHuman` gilt nur noch bei Cookie.
  - **DONE:**
    - e2e (`e2e/security.ts` + `e2e/tasks.ts`): Der Orchestrator-Token legt an und gibt frei, und die
      Audit-Zeile trägt `actor.kind:"orchestrator"`.
    - Ein Lane-Token bekommt 409.
    - Ein Orchestrator-Label ohne Grant bekommt 409.
    - Der Owner-Token-Pfad bleibt unverändert grün.
  - **VERIFY:** volle Kette plus `./e2e-isolated.sh` als Vorschau, weil `security.ts` nur dort läuft
    (CLAUDE.md Lane-Disziplin).
- **Zweiter Schnitt:**
  - Rechte als Owner-Konfiguration: eine Tabelle Rolle × Aktion mit Default „frei“ und benannten Blockern.
  - Ein Bearer-Land an einer lebenden MAIN vorbei wird 409 ohne `force`.
  - `actor.kind:"sensor"` für den Stall-Sensor.
  - Eine MAIN-Tür für `spawn` und für eine Neufassung des Kopfes an derselben id (K2 Ä2).
- **Abhängigkeiten:** S1 (`role`). Die Blocker-Liste aus §6 Frage 1.
- **Worker:** Sol. Das Gegenlesen des Sicherheitsschnitts macht Astra (siehe §5), kein Opus-Worker.

### S3 · Konfigurierbare Sessions im Gründungsfenster (Zielbild 4, Interview 4)

- **Warum:**
  - Der Owner will Bausteine aus dem „corePack“ herausnehmen.
  - `corePack` gibt es im Code nicht (`rg -i corepack` ohne Treffer). Die Bausteine liegen verstreut im
    Spawn:
    - Rulebook-Render (`rulebook.ts#FRAGMENTS_FOR`)
    - `laneExitFooter`
    - Memory-Zeiger
    - Notizen- und Quellauszug-Blöcke (`briefAndSend`, K4 §2)
    - Self-Token
    - Auto-Commit-Erwartung
  - Das Gründungsfenster steht: B1 `136dfd70`, Packs als Schalter B2a/B2b `87330bc8`/`c4bba5d0`. Ein
    Worker auf einem vorhandenen Worktree am geklickten Platz wird dort noch nicht getragen
    (`2026-09-22-gruendungsfenster-entwurf.md`).
- **Erster Schnitt:**
  - Eine Messnotiz „Session-Bausteine“: jede Zutat eines Spawns mit Symbol, Rolle, Bytes und der Aussage,
    was ohne sie bricht (Kandidat: die Commit-Pflicht bricht den Land-Pfad).
  - Daraus eine deklarierte Liste `SessionBlock[]`, der Server-Default ist wie heute.
  - **DONE:**
    - Die Notiz ist committet, und jede Zeile hat ein `datei#symbol`.
    - `bun e2e/pins.ts` hält die Liste gegen den Code.
  - **VERIFY:** pins.
- **Zweiter Schnitt:**
  - Schritt 2 des Gründungsfensters zeigt die Blöcke als Schalter.
  - Profile werden gespeichert (Name → Rolle + Profil + Blöcke + Packs).
  - „Roh“ ist ein Profil ohne Blöcke.
  - **DONE:** e2e (`e2e/slots.ts`): Ein Spawn mit `blocks:[]` bekommt weder Footer noch Memory-Zeiger (am
    Receipt geprüft); ein gespeichertes Profil reproduziert denselben Receipt-Hash. Screenshots 1200 und 390.
- **Abhängigkeiten:** Der zweite Schnitt braucht S1 (`role`). UI-Kollision mit S8 beachten.
- **Program:** das bestehende 0d51b4d4 „Oberfläche aus einem Guss“, dort liegt das Gründungsfenster schon.

### S4 · Konzeptgedächtnis und Jev-Netz (Zielbild 5/6, Interview 1/3)

- **Warum:**
  - `MEMORY.md` geht an jede Claude-Session, Lanes eingeschlossen. Mindestens 23 von 50 Zeilen sind
    Orchestrator-Stoff (K4 Befund 7).
  - Codex bekommt es in 0 von 31 Fällen, Pi in 0 von 30.
  - Es gibt kein `supersedes`: GLM gegen Sol gegen „Opus 5 für jede Lane“ (K4 Befund 7).
  - Das Home-Memory hat 388 Dateien, 21 davon zu Fleet, und sichtbar sind in Fleet 0 von 20 (K4 Befund 8).
  - Die „Anreicherung“ liefert in 213 von 313 Fällen denselben ~988-B-Block (K4 §2).
  - Die Zeiger versprechen ×5 bis ×11 falsche Größen (K4 Befund 4).
- **Erster Schnitt: Messung, noch kein Bau.** Wie genau trifft Jev auf Deutsch in der ersten Stufe?
  - Die Frage an Jev: Trägt diese Quelle zum Konzept „Claude Fleet“ bei? (Choice: Kern / Detail / Nachbar /
    nein)
  - 60 echte Quellen: Commit-Bodies, Messnotizen, Memory-Zeilen.
  - Gold ist das Urteil von Astra, blind.
  - Zusätzlich eine Stufe 2: Einordnung als Definition / Beleg / Grenze / Widerspruch / Verweis.
  - **DONE:**
    - Die Messnotiz enthält Trefferquote je Stufe, Kosten je 1 000 Quellen und p95-Latenz.
    - Kippwert: Stufe 1 ≥ 85 % gegen Gold. Darunter wird die Stufe weiter zerlegt, nicht an ein LLM
      eskaliert.
  - **VERIFY:** Die Messung ist mit festem Seed wiederholbar (`bun <skript> --seed`).
  - Memory: reference-jev-classifier-model (Deutsch = niedrigere Genauigkeit, zuerst messen).
- **Zweiter Schnitt: Pilot „Claude Fleet“.**
  - Ein Konzept-Speicher, der harness-neutral ist (Dateien plus Lese-Route). Seine Einträge sind
    `{typ, aussage, quellen[], scope{rolle,harness,projekt}, supersedes?, stand}`.
  - Das Jev-Netz füllt ihn. Eine Pack-Sicht schneidet ihn für Rolle und Aufgabe zu.
  - **DONE:** Der Owner akzeptiert einen Bewerbungstext über Claude Fleet, den ein frischer Agent **nur** aus
    der Konzept-Sicht schreibt, ohne Repo-Zugriff. Das ist der Prüfstein aus seinem Interview.
- **Dritter Schnitt (Sammelzeile):**
  - Owner-Korrekturen mit Scope und `supersedes`, für Codex und Pi mitgeladen.
  - Rollen-Einträge nicht mehr in Lanes laden (K4 ÄNDERN 6).
- **Abhängigkeiten:**
  - Der Pilot braucht S1 für den Scope „Rolle“.
  - Die Messung ist unabhängig und kann sofort laufen.
  - Das Jev-Program 98f3eef9 hat MAIN Slot 10 und kennt den Jev-Betrieb: Es liefert das Jev-Werkzeug, nicht
    das Konzeptmodell.
- **Worker:** Die Messung und das Konzeptmodell macht Astra (§5). Den Speicher baut Sol.

### S5 · Traceability-Seite (Zielbild 8)

- **Warum:**
  - Die Kette hält: von 322 Lands haben 319 die taskId und 321 ein Audit (K5 §3).
  - Sie reißt an drei Stellen:
    - Leser sehen nur zwei Generationen (`persist.ts:115`). `audit.jsonl` vor 09-07 ist unsichtbar (K5 Ä1).
    - Attention, Rückfragen und Events werden auf 20 gekürzt, nur die id bleibt (K5 Ä3).
    - Der Tick-Dispatch schreibt kein Ereignis mit taskId (K5 Ä2).
  - 117 von 659 main-Commits liegen außerhalb jedes Lands (K5 Ä7).
  - Einen Prototyp gibt es: `server.ts#laneDossier`.
- **Erster Schnitt: Index als Projektion, ohne einen Schreiber zu ändern.**
  - `trace-index.ts` baut `TraceEvent`s (Modell K5 §6) über alle drei Generationen, die Land-Notizen und
    `git log`.
  - Dazu die Route `GET /api/trace?task=` mit Horizont je Quelle.
  - **DONE:**
    - e2e: Die Spur für `e01a4e95` zeigt alle Stufen.
    - Eine Task, die älter als ihr Horizont ist, liefert `unmeasured` mit Quellnamen und nie ein leeres
      „nichts“.
    - Mutationsprobe: den `.archive`-Leser abschalten → der Horizont-Check wird rot.
  - **VERIFY:** volle Kette, Suite-Offer mit dem neuen Modul.
- **Zweiter Schnitt (Sammelzeile an den Quellen):**
  - `task.dispatched` mit `occ{slot,openedAt}`.
  - taskId als Feld statt nur im Text.
  - Ein Inhalts-Ledger vor dem Prune für Attention, Clarification und Events.
  - Ein Sammler `commit.direct`.
  - Reports aus dem Ledger statt aus dem 20er-Tail lesen (K5 Ä4).
- **Dritter Schnitt:** Die Seite selbst, Desktop und Mobile, im Program 0d51b4d4 nach S8.
- **Abhängigkeiten:** S2 (`actor`) macht die Seite ehrlich, der erste Schnitt geht aber ohne.

### S6 · Eingang von außen (Zielbild 9, Interview 6)

- **Warum:** `/intake` existiert, ist aber aus (`server.ts#handleIntake`, kein `FLEET_INTAKE_SECRET`, 0
  Events). Das Ergebnis ist heute direkt eine `pending`-Task statt eines Buckets.
- **Erster Schnitt:**
  - Ein Bucket vor der Queue: Einträge `{quelle, text, von, at, gates[]}`.
  - Eine deterministische Gate-Kette mit Jev-Stufen je nach Messung aus S4:
    - bösartig?
    - sinnvoll?
    - Duplikat einer Zeile oder eines Konzepts?
    - Bug oder Idee?
    - welches Projekt?
  - Was alle Gates besteht, wird eine `notiz`-Zeile im Backlog des Programs mit `actor.kind:"extern"`.
  - **DONE:**
    - e2e (`e2e/intake.ts`): Ein bösartiger Eintrag bleibt im Bucket, ein Duplikat wird an die bestehende
      Zeile gehängt, ein gültiger wird eine Notiz.
    - Nichts davon wird direkt `queued`.
- **Zweiter Schnitt:** Aggregation und Aufwertung im Backlog (Sammelzeilen-Regel aus Memory
  feedback-merge-small-lanes), E-Mail als zweite Quelle.
- **Abhängigkeiten:** S2 (Prinzipal `extern`), S4 (Messung der Jev-Stufen).

### S7 · Brief-, Kontext- und Ledger-Hygiene (Interview „Briefe effektiver“; K1–K4)

Nur Sammelzeilen, je Fläche eine. Das sind Schnitte, keine Programme.

- **(a) Ein Brief-Rendering** (`wave-brief.ts`, `server.ts#briefAndSend`):
  - Kein doppelter Kartenkopf (224 von 302, K2 Ä5).
  - ZIEL als eigenes Pflichtlabel (mindestens 33 von 255 falsch).
  - Die ROLLE-Zeile geht nicht an die Lane (16 von 177 falsch).
  - Notizen nur bei Flächenschnitt (164 von 174 „offen“, K2 Ä3).
  - Ein VERIFY, das der Harness nicht kann, wird vor dem Dispatch abgewiesen (K2 F3).
  - **DONE:** Die Receipt-Bytes einer Stichprobe fallen messbar; e2e in `e2e/tasks.ts`.
- **(b) Land-Ledger** (`mergeJob#record`):
  - `verifyOk` und `stopKind` in `merge_verdict` (K1 Ä2).
  - Das Audit eines fremden Repos als `not-applicable` (K1 Ä4).
  - Beim Teardown den Branch löschen, wenn er 0 Commits hat; Dispatch-Backoff für jede Ablehnung (K1 Ä5).
  - Eine Funktion für den Dirty-Main-Check (K1 Ä7).
- **(c) Kontext:**
  - `AGENTS.md` auch für Claude laden (`@AGENTS.md` im Render). Abnahme: 40 von 40 Claude-Lanes (K4
    ÄNDERN 1).
  - Packs ehrlich machen: tote Trigger streichen, Bytes messen statt deklarieren (K4 ÄNDERN 5).
  - Die Nachfolge plant die Quellen neu (K4 ÄNDERN 7).
- **(d) Regelwerk:** Das ist Main-Checkout-Arbeit der Orchestratorin, weil `rulebook/` gitignored ist.
  - Widersprüche auflösen:
    - Check-in vor dem Idle gegen den Footer
    - „kein eingehender Kanal“
    - `supervisor.md`
    - Composer-Text: Der Code hat recht (K3 F4)
    - auto-③ steht als „AN“, ist aber aus
    - Gate „~110 s“, gemessen 226 s; Audit „~9,4 min“, gemessen ~17 min
  - `ctl.sh commit main` gehört in den Absatz über den Main-Commit.
  - Messgeschichte aus dem Pflicht-Render ins Attic.
  - Das läuft über propose/promote: Die Orchestratorin schlägt vor, der Owner gibt frei.
- **(e) Stilllegen mit Wiedervorlage nach 14 Tagen:**
  - Repair-Loop: 0 von 914 (K1 Ä3)
  - `undo-land`: 0 seit 07-21
  - `refine`, `confirm-cards`, `files-proposal`, `wave-split`, `kind betrieb`: je 0 in 5 Tagen (K2 Ä7)
  - Kartenleser auf Opus 5.5 zurück aufs Format: 66 % ungültig (K2 Ä8)
  - Tote Ledger (K5 §2)
- **Außerhalb des Repos, also Owner-Akt:** `~/.claude/CLAUDE.md` mit Handoff 60 %, Attribution „Opus 4.6“
  und `sharpen`-Pflicht widerspricht dem Fleet-Band (K4 Befund 6).
- **Program:** f170dc46 Fleet-Betrieb (MAIN Slot 4). Dort liegt der Land-Pfad schon.

### S8 · UI-Trennschnitt Desktop/Mobile (Owner 25.09.: „gleichzeitig die desktop und mobile uI umbauen“)

- **Warum:** `src/client.ts` hat 17 914 Zeilen. Zwei UI-Worktrees kollidieren sonst bei jedem Land auf
  derselben Datei. Die Kollisionsfläche ist im Tick sichtbar: `fd3a2517`, `84d41353` und `88bf9166` warteten
  heute auf Lane 17.
- **Erster Schnitt:**
  - Ein mechanisches Extrahieren der mobilen Zweige (`MOBILE_MQ`, Drawer) nach `src/mobile/*.ts` und der
    Desktop-Leiste nach `src/desktop/*.ts`, ohne Verhaltensänderung.
  - **DONE:**
    - `bun run build` erzeugt Bundles, die bis auf die Modulgrenzen gleich sind.
    - Screenshots 1200 und 390 vorher und nachher aus der Testinstanz sind identisch.
    - `tsc` ist grün.
  - **VERIFY:** volle Kette, Suite-Offer `FLEET_E2E_MODULES=slots,lanes-basic`.
- **Danach:** zwei parallele Worktrees (Desktop, Mobile), jeder mit eigener Testinstanz.
- **Program:** 0d51b4d4.

---

## 3. Wellen

**Welle 1 (sofort, ohne gegenseitige Kollision):**
- S1 erster Schnitt (`server.ts` self-Routen).
- S4 Messung: kein Fleet-Code, `~/jev-*` oder Messskript.
- S3 Messnotiz: nur Doc und Pins.
- S7(d) Regelwerk: Main-Checkout, Orchestratorin.
- S5 erster Schnitt: neue Datei `trace-index.ts` und eine Route.

S1 und S5 teilen sich `server.ts`, aber verschiedene Symbole. Der Tick serialisiert, darum S5 hinter S1
freigeben.

**Welle 2 (nach S1):**
- S2 erster Schnitt: braucht `role`, trägt die Rechte.
- S8 Trennschnitt: vor jedem großen UI-Umbau.
- S7(a)/(b)/(c) je Fläche.

**Welle 3 (nach S2 und der S4-Messung):**
- S4 Pilot
- S3 zweiter Schnitt (Schalter und Profile)
- S6 erster Schnitt
- S5 zweiter und dritter Schnitt
- S2 zweiter Schnitt (Rechte-Tabelle)

**Später, mit neuem Owner-Satz:** die Diskussionsplattform (Zielbild 7).

**Program-Zuschnitt:** Es kommen höchstens **zwei neue Programs** dazu, weil Orchestrierung heute schon etwa
2,5 : 1 gegenüber Arbeit steht (K2 F1):
- **„Overhaul Kern“** für S1, S2, S5 und S6.
- **„Konzeptgedächtnis“** für S4, als MAIN Astra.

S3 und S8 gehen an 0d51b4d4, S7 an f170dc46. Das Program f9dc8e10 „Leichtgewicht“ (MAIN-Bindung tot, K2 F1)
wird geschlossen, seine drei offenen Notizen gehen an „Overhaul Kern“ (d53b7c98 ist genau S1).

---

## 4. Bewusst nicht jetzt

- **Diskussionsplattform:** Sie braucht das Konzeptgedächtnis als Ablage. Ohne das bleibt sie Pane-Text.
- **Mehrbenutzerbetrieb und Teilen zwischen Personen:** Der Owner sagt „User & Owner sind … sinonym“. Extern
  ist nur der Eingang (S6).
- **Ein Umbau der Verify-Kette auf eine einzige Quelle** (K1 Ä6): richtig, aber kein Owner-Satz verlangt ihn.
  Er kommt als Notiz an f170dc46.
- **Rotation von `prompts.jsonl` und `e2e-trail/`** (K5 Ä6): Das ist Betrieb und kommt als Notiz an
  f170dc46.
- **Ein neues Memory-Backend** (Datenbank, Vektor): Der Pilot beweist zuerst das Modell an Dateien.

---

## 5. Astras Rolle

Astra (`codex/gpt-6-astra/medium`) wird **MAIN des Programs „Konzeptgedächtnis“**. Das ist der Strang mit dem
höchsten Denkanteil und der offensten Form. Genau dafür hat der Owner Astra vorgesehen:
- „schwere Denkaufgaben in Astras Program“ (Memory feedback-heavy-tasks-to-astra-private-repo-j-on-ice)
- „Worktrail-Ecken/Urteile statt Routine-Fixes“ (Memory feedback-astra-spend-through-banked-reset)

Sie verteilt die Schreib-Schnitte an Sol und Terra auf disjunkten Dateien (Memory
feedback-astra-coordinates-sol-terra).

**Warum so verklickern, wie unten beschrieben:**
- Astra bekommt heute Briefe, die sie über `AGENTS.md` stellen („This brief outranks …“, K2 §5 4961ea66). Das
  widerspricht dem Loader-Vertrag.
- Sie hat keine Position im System: kein Program-Record als Ziel, keine Quote, keinen Empfänger (K4 Befund 2).

Also bekommt sie **das, was S1 allen geben soll, zuerst von Hand**: ihre Position, ihren Empfänger, ihren
Prüfstein.

**Gründungsbrief** nach der Schablone aus Memory feedback-astra-brief-template:

```
PRIORITY: Konzeptgedächtnis für Claude Fleet — Owner-Ziel c90329dd, Interview 53e3b74f/36d15d5d/4fb7736e/d85cc805.
POSITION: Du bist MAIN des Programs „Konzeptgedächtnis“. Empfänger deiner Reports: Orchestratorin Slot 9.
          Parallel laufen „Overhaul Kern“ (S1 Position, S2 Identität) — deren `role`/`actor`-Felder sind deine Eingänge.
AUTONOMY: voll innerhalb des Programs; Schreib-Schnitte an Sol/Terra, disjunkte Dateien, du integrierst.
EFFORT: medium.
AUFTRAG 1 (Messung, sofort): Jev Stufe 1+2 auf 60 deutschen Quellen gegen dein blindes Gold, Kippwert 85 %.
AUFTRAG 2 (Modell): Konzept-Eintrag {typ, aussage, quellen, scope, supersedes, stand}; Pack = Sicht darauf.
            Jev-Netz: kleinste Entscheidungen, Code gibt Optionen, Jev wählt, nie Gate über ein LLM.
DONE MEANS: ein frischer Agent ohne Repo-Zugriff schreibt aus der Konzept-Sicht „Claude Fleet“ einen
            Bewerbungstext, den der Owner akzeptiert.
QUELLEN: K4 (docs/messungen/2026-09-25-overhaul-kern-4-kontext-memory.md) §3, §7, §8; Memory-Inventar dort.
DO NOT: ein neues Backend (DB/Vektor) vor dem Pilot; Owner-Memory-Dateien ändern; über AGENTS.md hinweg regeln.
Tu es. Keine Rückfrage.
```

**Zusätzlich:** Astra liest den S2-Sicherheitsschnitt gegen, bevor er gelandet wird. Das ist ein Urteil,
keine Routine.

---

## 6. Offene Owner-Entscheidungen (höchstens 3)

1. **Blocker-Liste für den Rechte-Default (S2):** Welche drei bis fünf Dinge darf kein Agent ohne dein Ja?
   Vorschlag:
   - Geld ausgeben
   - nach außen veröffentlichen (Push, E-Mail, Posts)
   - Secrets lesen oder ausgeben
   - fremde Slots schließen
   - Owner-Memory überschreiben
2. **Ablage des Konzeptgedächtnisses:** im Repo (getrackt, damit öffentlich; das Repo ist PUBLIC) oder
   privat (`~/[privater Owner-Ordner]/` bzw. ein eigenes Verzeichnis außerhalb)? Vorschlag: privat, mit
   öffentlichem Schema.
3. **Leichtgewicht f9dc8e10 schließen** und die Notizen übernehmen: ja oder nein.
