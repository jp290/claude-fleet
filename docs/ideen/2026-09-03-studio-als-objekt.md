# Das Studio als Objekt — Architektur-Entscheidung (2026-09-03)

Stand: 2026-09-03, nach dem Private-repo-p-Worktrail-Audit
(`docs/messungen/2026-09-03-private-repo-p-worktrail-audit-synthese.md`, Wurzel 5: „der Workflow ist
kein Objekt"). Der Owner hat die sechs offenen Fragen des Vorschlags
(`docs/ideen/2026-09-03-private-repo-p-workflow-v2.md` §7) beantwortet und die Implementierungs-Form
an diese Session delegiert. Dieses Dokument ist die getroffene Entscheidung plus die Schnitte;
**es ist propose gegenüber dem Code — nichts davon ist gebaut.**

## 0. Die Owner-Entscheide, wörtlich (2026-09-03)

1. **Was die AI in Private-repo-y ist:** *„die AI in Private-repo-y ist basically der Workflow den
   wir nachher ausarbeiten der dann dem Enduser hilft einen Workflow für sein Problem zu erstellen,
   es testet, ggf. revidiert und den User dann bis zum aufsetzen an die Hand nimmt"* — also **kein
   Provider-Aufruf als Produktkern**; das Produkt IST der geführte Workflow-Bau. Damit ist Frage 1
   des Vorschlags entschieden: Variante (b), regelbasiert und ehrlich ohne Modell, aber mit echtem
   Führungs-Wissen statt Textformatierung.
2. **Reihenfolge:** *„Ich will auf jeden Fall erst den Workflow use. vernünftig aufsetzen."* Die
   Private-repo-y-App wird nicht weitergebaut, bis der Workflow steht. Brief 9 bleibt liegen.
3. **Übersicht:** *„Die Übersicht will ich separat angehen, das studio sollte nur schonmal damit im
   Hinterkopf richtig aufgesetzt werden."* Kein UI in diesen Schnitten — aber die Datenform muss
   die Übersicht ohne zweiten Umbau tragen.
4. **Erste Arbeit:** *„Die architekturelle Implementierung des Studios als ein Object ist
   wahrscheinlich am besten zu allererst anzugehen."*
5. **Repos:** *„eine App hat ein eigenes repo meiner meinung nach, obwohl andere repo's später auch
   apps bekommen könnten."*
6. **GLM:** *„GLM gegenlesung eig immer sinnvoll bei sowas"* — Gegenlesung ist ab jetzt Regel, nicht
   Einzelfall.

## 1. Die Entscheidung in einem Satz

**Ein Studio ist ein eigener, persistierter Owner-Record, der den WORKFLOW als Daten trägt
(Stufen, Rollen, Spawn-Tripel, Gates, Brief-Blöcke, Repo-Politik); `Program.profile` bleibt
unangetastet und trägt weiterhin nur die MASCHINEN-Umgebung.** Ein Program bindet an ein Studio
wie es heute an eine Promotion bindet: über eine eigene Tür, einmal, vor der Gründung.

## 2. Warum nicht der naheliegende Weg

`profile.kind` ist heute ein Enum mit genau einem Wert (`game-maker`,
`server/types.ts#ProgramProfileKind`), und dieser Wert schaltet **hartcodiertes
Maschinenverhalten**: welcher Rail-Block in den Gründungsbrief gerendert wird
(`server.ts#GAME_MAKER_RAIL_BLOCK` gegen `#PROGRAM_MAIN_RAIL_BLOCK`), ob ein Tree-Lease gezogen
wird, welcher `canonicalRoot` gilt, wie die Nachfolge `carry` behandelt (`server.ts#isGameMaker`,
neun Aufrufstellen).

Ein drittes Kind `private-repo-p` dazuzuschreiben wäre die billigste Änderung und die falsche:

- **Jedes neue Studio wäre ein server.ts-Diff plus Deploy.** Genau daran ist der iOS-Lauf
  gescheitert — die drei Private-repo-o-Regeln V1–V3 landeten in einem Abschnitt, den nur ein
  Game-Maker-Program erbt, und erreichten den iOS-Lauf deshalb nie (Audit, Wurzel 5).
- **„Konfigurieren" wäre unmöglich.** Der Owner will Stufen, Tripel und Gates am Program einstellen
  können; ein Enum-Wert trägt keine Einstellung.
- **Es würde zwei verschiedene Dinge in ein Feld packen.** Die Maschinen-Umgebung (Worktree, Lease,
  Rail-Mechanik) ist Code und muss Code bleiben. Der Workflow (welche Stufe, welche Rolle, welches
  Gate, welcher Brief-Block) ist Inhalt und gehört als Daten neben den Code. Der Audit hat genau
  diese Vermengung als Ursache benannt.

Der Kommentar an der Profil-Tür sagt es selbst: `profile` ist „die Umgebung, in die eine MAIN
GEGRÜNDET wird" — nicht, was sie tun soll. Das Studio beantwortet das Zweite.

## 3. Das Objektmodell — drei Ebenen, eine je Owner-Wort

Der Owner will „Idee, Workflow und zugehörige Sessions" nachvollziehen. Genau diese drei sind
danach je ein Record:

| Ebene | Record | Existiert heute | Was fehlt |
|---|---|---|---|
| **Idee** | `Program` (intent, successCriterion, nonGoals, decisions, openQuestions) | ✔ | Bindung an ein Studio; Lint-Ergebnis; Iterationskette |
| **Workflow** | **`Studio` (neu)** | ✘ — nur Prosa über sieben Dokumente | der ganze Record |
| **Sessions** | `Program.lineage` (nur MAIN-Autorität, lückenhaft) + Lanes, die beim Teardown vergessen werden | teilweise | Session-Ledger (`docs/ideen/2026-09-03-session-ledger-je-program.md`, GLM-gegengelesen) |

Die Übersicht ist später ein reiner Leser dieser drei. Sie wird jetzt nicht gebaut, aber die
Schnitte unten sind so geschnitten, dass sie ohne Umbau darauf zeigen kann.

## 4. Der `Studio`-Record

Vorgeschlagene Form, v1 — bewusst klein, alles Weitere additiv:

```
Studio {
  v: 1
  id, name                       // "private-repo-p", "iOS App Studio"
  createdAt, confirmedAt         // Owner-Akt, wie promotion/profile
  machineProfile: "standard" | "game-maker"   // WELCHE bestehende Maschinen-Umgebung; kein neuer Kind
  repoPolicy: "one-app-per-repo" | "shared-repo"
  workflow: {
    doc: { path, sha }           // das gelesene Workflow-Dokument im Fleet-Repo, beobachtet gehasht
    stages: [ { id, title, role, required, gate?, spawn?: {harness, model, effort} } ]
  }
  briefBlocks: [ { id, appliesTo: "main" | "lane" | "review" | "critic", text } ]
  gates: { criticBeforeTaste: bool, programLint: bool, completeNeedsProof: bool }
}
```

Sechs Festlegungen, die im Record stecken und im Audit teuer waren:

- **`machineProfile` referenziert die BESTEHENDEN zwei Umgebungen.** Ein Studio erfindet kein
  Maschinenverhalten; es wählt eines aus. `ProgramProfileKind` bleibt unverändert, `isGameMaker`
  bleibt unverändert, der Game-Maker-Pfad wird nicht angefasst.
- **`workflow.doc` ist ein Zeiger mit BEOBACHTETEM Hash**, nicht eingebetteter Text — dieselbe
  Konstruktion, die das Kontext-Pack-Netz für `sourceHash` gewählt hat (`context-manifest.ts#observedSourceHash`).
  Das erste Dokument dieser Art entsteht gerade: Program `b2aa5b45` produziert
  `docs/game-maker/workflow-v2.md`. **Das iOS-Workflow-Dokument übernimmt dessen Struktur, statt
  ein zweites Format zu erfinden.**
- **`stages[]` ist die Liste, gegen die die Übersicht später den Fortschritt rendert** — und die
  Stelle, an der ein Critic als Stufe existiert statt als guter Vorsatz.
- **`spawn` je Stufe** ist die Konfiguration, die der Owner will: Preflight auf Opus, Critic auf
  einer fremden Familie, Review auf codex — heute steht das nur in Briefen und Handoffs.
- **`briefBlocks`** sind die sechs Pflichtblöcke aus dem Workflow-v2-Vorschlag §2.5 (Produktblick,
  Bild-Hygiene, Beweiszeile, relatives Budget, Widerspruchs-Stopp, Leseliste mit Zweck). Als Daten
  am Studio kommen sie in JEDEN Brief; als Prosa in einem Doc kamen sie in null von acht.
- **`repoPolicy`** macht den Owner-Entscheid 5 mechanisch prüfbar: bei `one-app-per-repo` refust
  die Gründung, wenn das Ziel-Repo schon ein anderes aktives Program trägt.

Türen und Gates spiegeln die Profil-Tür, weil dieselben Gründe gelten (`server.ts` §THE PROFILE
DOOR): genau ein Schreiber, identische Wiederholung ist ein Read, ein `complete` Program refust
jede Änderung, ein aktives Program mit LEBENDER MAIN refust die Umbindung, eine laufende Gründung
sperrt den Record.

## 5. Schnitte — einzeln landbar, in dieser Reihenfolge

**S1 — Der Record und seine Türen (zuerst, allein nützlich).**
`Studio`-Typ in `server/types.ts`, Persistenz in `server.ts#queueStateSave` neben `programs`
(mit Deckel analog `MAX_PROGRAMS`), Owner-Türen `GET/POST /api/studios`,
`POST /api/studios/:id` und die Bindung `POST /api/programs/:id/studio` mit den Gates aus §4,
Ausgabe über `publicProgram` und `GET /api/programs`.
*Done:* ein Studio anlegen, ein Program binden, Server neu starten, beides ist noch da; die fünf
Verweigerungen (unbekanntes Studio · complete · live gebundene MAIN · Gründung in Flug ·
unbekannter Key) antworten je mit eigenem Text; identische Wiederholung ist 200 ohne Schreibakt.
*Verify:* `e2e/programs.ts` je Fall ein Check, dazu ein Restart-Fall; volle Gate-Kette;
`./e2e-isolated.sh` als Vorschau (Kontrakt-Aussagen ändern sich).
*Kein Verhalten ändert sich* — S1 ist reine Bestandsführung. Das ist Absicht: der Record muss
stehen, bevor irgendetwas ihn liest.

**S2 — Der Workflow erreicht die Sessions (schließt K2, die teuerste Klasse des Audits).**
Der Gründungsbrief rendert die Stufen des gebundenen Studios und seine `main`-Brief-Blöcke
(`server.ts` §RAIL_HEAD/RAIL_ROLE_*/RAIL_TAIL ist bereits komponiert — der Studio-Block wird ein
vierter Summand, kein neuer Zweig). `briefAndSend` hängt die `lane`/`review`/`critic`-Blöcke an
den jeweiligen Brieftyp.
*Done:* ein Program mit gebundenem Studio bekommt einen Gründungsbrief, der die Stufen namentlich
und die Blöcke wörtlich trägt; ein Program ohne Studio bekommt byte-identisch den heutigen Brief.
*Verify:* Brief-Snapshot-Checks in `e2e/programs.ts` für beide Fälle; der Byte-Gleichheits-Check
für den studiolosen Fall ist der wichtigere.

**S3 — Die Gates, die das Studio erklärt.**
`programLint` vor `confirm` (Vorschlag §2.2), `criticBeforeTaste` als 409 auf eine
Taste-Attention ohne Critic-Verdikt, `repoPolicy` bei der Gründung.
*Done/Verify:* je Gate ein Positiv- und ein Negativfall; der Program-Record `07ee8a6d` als
Lint-Fixture muss ≥ 3 Warnungen erzeugen.

**S4 — CONTINUE.** `complete`-Tor (Beweis oder ausdrückliches Owner-Verdikt) und
`resume`-Gründung, die ein Studio-Dossier statt einer neuen Card liest (Vorschlag §3).

Die Übersicht ist **kein Schnitt dieser Reihe** (Owner-Entscheid 3). Sie wird lesbar, sobald S1
steht.

## 6. Verworfen, mit Grund

- **Drittes `profile.kind`** — §2.
- **`profile` durch das Studio ersetzen** — würde den funktionierenden Game-Maker-Pfad umbauen,
  ohne dass eine gemessene Not besteht; die zwei Felder beantworten verschiedene Fragen.
- **Workflow-Text im Record einbetten** statt Zeiger+Hash — ein Record, der Prosa trägt, wird nie
  gepflegt und ist im Diff unlesbar; der Zeiger erbt die Review-Wege des Repos.
- **Die Übersicht zuerst** — Owner-Entscheid, und der Audit stützt ihn: eine UI über einen
  Bestand, den es nicht gibt, erfindet ihren Inhalt.
- **Ein `private-repo-p`-Repo, das mehrere Apps trägt** — Owner-Entscheid 5. Konsequenz für das
  bestehende Repo: Private-repo-y und Private-repo-x teilen heute `Private-repo-x.xcodeproj` und
  `Package.swift`; die Trennung ist ein eigener, kleiner Schnitt im Produkt-Repo und **nicht**
  Teil von S1–S4.

## 7. Was die Nachfolge zuerst entscheiden muss

- Ob `Studio` eine eigene Datei (`studio.ts`) bekommt oder in `server/types.ts` wohnt — die
  Sanierung schneidet server.ts gerade aktiv, also mit der Sanierungs-MAIN (Slot 9) abstimmen,
  bevor Fläche entsteht.
- Ob `Program.studio` ein fünfter Record neben `promotion`/`profile`/`founding`/`lineage` ist
  (empfohlen, gleiche Begründungskette) oder ein Feld in `profile` (nicht empfohlen, §2).
- Ob das Game-Maker-Workflow-Dokument aus `b2aa5b45` schon adjudiziert ist — wenn ja, ist seine
  Struktur die Vorlage für `workflow.doc`; wenn nein, S1 trotzdem bauen (S1 kennt nur Pfad+Hash).

## Nicht geprüft

Ob der Deckel für `Studio` dieselbe Verdrängungslogik wie `capPrograms` braucht (Studios sind
wenige und leben lange — vermutlich reicht ein harter Deckel ohne Verdrängung); ob
`publicProgram` die Studio-Bindung spreizen darf, ohne einen bestehenden Client-Pin zu brechen;
wie viele der neun `isGameMaker`-Aufrufstellen bei S2 tatsächlich berührt werden (gelesen, nicht
umgebaut).
