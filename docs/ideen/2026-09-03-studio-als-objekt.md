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
unangetastet und ist der Ort, an dem die MASCHINEN-Umgebung gewählt wird.** Ein Program bindet an
ein Studio wie es heute an eine Promotion bindet: über eine eigene Tür, einmal, vor der Gründung.

**KORREKTUR (2026-09-03, aus der Gegenlesung):** hier stand „`profile` trägt weiterhin NUR die
Maschinen-Umgebung". Das ist am Code FALSCH und bleibt es nach S1–S4. Von den elf
`isGameMaker`-Aufrufstellen schalten vier Workflow-INHALT — `server.ts#railBlockFor` (welcher
Rollenparagraph), `#buildProgramMainSuccessionBrief` (die Nachfolge-Schritte),
`#handleSelfSucceed` (das carry-Verbot), `#gameMakerCheckpointError` (Checkpoint als
Nachfolge-Tor) — und `#RAIL_ROLE_GAME_MAKER` ist der größte Workflow-Text der Flotte,
maschinenverdrahtet. Was S1–S4 wirklich tun: sie setzen die Trennung für NEUE Studios durch; der
BESTAND bleibt vermischt. Das ist eine akzeptable Entscheidung, aber sie muss benannt sein, sonst
liest man §1 als vollzogene Trennung. Die Konsequenzen stehen in §8.

## 2. Warum nicht der naheliegende Weg

`profile.kind` ist heute ein Enum mit genau einem Wert (`game-maker`,
`server/types.ts#ProgramProfileKind`), und dieser Wert schaltet **hartcodiertes
Maschinenverhalten**: welcher Rail-Block in den Gründungsbrief gerendert wird
(`server.ts#GAME_MAKER_RAIL_BLOCK` gegen `#PROGRAM_MAIN_RAIL_BLOCK`), ob ein Tree-Lease gezogen
wird, welcher `canonicalRoot` gilt, wie die Nachfolge `carry` behandelt (`server.ts#isGameMaker`,
**elf** Aufrufstellen — gezählt in der Gegenlesung; die frühere Zahl neun war falsch. Für S2
relevant sind genau drei davon: `#railBlockFor`, `#buildProgramMainSuccessionBrief` und
`#briefAndSend`; die sieben Maschinen-Stellen bleiben unberührt).

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
`Studio`-Typ in `server/types.ts` (entschieden, §7), Persistenz **auf BEIDEN Seiten**:
`server.ts#queueStateSave` schreibt, **und der Boot-Loader liest ausdrücklich wieder ein** — der
Program-Loader baut Zeilen „from declared fields", ein nicht gelesenes Feld wird beim Restart
STILL verworfen, und kein Compiler und kein Routen-Test sagt es. Harter Deckel `MAX_STUDIOS` ohne
Verdrängung (§8, F1). Owner-Türen `GET/POST /api/studios`, `POST /api/studios/:id` und die Bindung
`POST /api/programs/:id/studio` mit den Gates aus §4, Ausgabe über `publicProgram` und
`GET /api/programs`. Die Bindung trägt `{ id, boundAt, rev }`, die Änderungstür bumpt `rev` (§8, F2).
*Done:* ein Studio anlegen, ein Program binden, Server neu starten, beides ist noch da; die **sechs**
Verweigerungen (unbekanntes Studio · complete · live gebundene MAIN · Gründung in Flug ·
unbekannter Key · Änderung während einer Gründung eines gebundenen Programs) antworten je mit
eigenem Text; identische Wiederholung ist 200 ohne Schreibakt.
*Verify:* `e2e/programs.ts` je Fall ein Check, dazu ein Restart-Fall; volle Gate-Kette;
`./e2e-isolated.sh` als Vorschau (Kontrakt-Aussagen ändern sich).
*Kein Verhalten ändert sich* — S1 ist reine Bestandsführung. Das ist Absicht: der Record muss
stehen, bevor irgendetwas ihn liest.

**S2 — Der Workflow erreicht die Sessions (schließt K2, die teuerste Klasse des Audits).**
Der Gründungsbrief rendert die Stufen des gebundenen Studios und seine `main`-Brief-Blöcke
(`server.ts` §RAIL_HEAD/RAIL_ROLE_*/RAIL_TAIL ist bereits komponiert — **KORRIGIERT durch die
Gegenlesung:** der Studio-Block wird in `#railBlockFor` GEFALTET, nicht als weiterer Summand an
die zwei Builder-Nähte gehängt. `#railBlockFor` ist laut eigenem Kommentar „the one selector, read
by both builders", und beide Builder haben die identische Naht
`body.join("\n") + railBlockFor(program) + anchorBlock`; ein zweiter Summand wäre genau die zweite
Naht, auf der eine Variante den Rail verliert). `briefAndSend` hängt die `lane`/`review`/`critic`-Blöcke an
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

## 7. Was die Nachfolge zuerst entscheiden musste — ENTSCHIEDEN (2026-09-03, Slot 13)

- **`Studio` wohnt in `server/types.ts`**, direkt neben `ProgramProfile`. Zwei Gründe: die Datei
  hält bereits genau diese Loader-Familie (`loadPromotion`, `loadProgramProfile`,
  `loadProgramFounding`), und die Sanierungs-MAIN hat auf Anfrage bestätigt, dass `server/types.ts`
  ihr Ziel ist und der Typ direkt dorthin gehört. Kein FREEZE auf der Fläche: `queueStateSave`
  bleibt dauerhaft im Kern, `publicProgram`/`MAX_PROGRAMS` wandern erst in ihrem Tier 3, die vier
  Routen in Tier 4 — beides mehrere Slices entfernt.
- **`Program.studio` ist ein fünfter Record**, kein Feld in `profile`. Am Code entschieden, nicht
  nach Geschmack: `server/types.ts#loadProgramProfile` verwirft jedes Objekt mit einem Key
  außerhalb `{v, kind, confirmedAt}` und lädt es als ABSENT — ein Studio-Feld dort drin machte
  jedes bestehende Profil unlesbar.
- **Das Game-Maker-Workflow-Dokument ist NICHT adjudiziert** (`docs/game-maker/` trägt nur
  `entwurf/evidenz-pack.md`; die Entwurfs-Schritte 2a/2b sind queued). S1 wird trotzdem gebaut —
  es kennt nur Pfad+Hash. S2 wartet auf die Form.

## Nicht geprüft

Die drei früheren Punkte sind durch die Gegenlesung BEANTWORTET und stehen jetzt in §8 (Deckel:
harter Deckel reicht, weil `capPrograms` nur COMPLETE verdrängt und ein Studio nie complete wird ·
`publicProgram` spreizt gefahrlos, die einzigen geschlossenen Key-Mengen sind der `ProgramDigest`
und das `founding`-Sub-Record · elf Aufrufstellen, für S2 relevant genau drei).

Was offen BLEIBT: ob `programLint` die drei unerfüllbaren Private-repo-y-Klauseln wirklich fängt
(die Gegenlesung hat das aus der Audit-Beschreibung abgeleitet, nicht am Program-JSON gemessen —
die `07ee8a6d`-Fixture in S3 ist genau dieser Test); wo das `criticBeforeTaste`-409 das
Critic-Verdikt LIEST und woran eine Attention als Taste-Marker erkennbar ist (heute ist
`kind:decision` freier Text) — ohne diese Definition ist S3s Done-Kriterium nicht falsifizierbar;
ob die Rail-Wanderung in Daten (§8, F1) am Game-Maker-Rail als Pilot gefahren wird.

## 8. Die Gegenlesung, eingearbeitet (2026-09-03)

`docs/messungen/2026-09-03-gegenlesung-studio-objekt-glm.md` (pi-zai/glm-5.3, docs-only, gelandet
als `461baea`). Sie bestätigt den Fabrikcheck — alle tragenden Code-Behauptungen der Entscheidung,
die Tür-Spiegelung, die vier Verwerfungen in §6 und die Landbarkeit von S1 — und widerspricht an
einer tragenden Stelle. Ich habe ihre elf `isGameMaker`-Stellen, `#railBlockFor` samt
Naht-Kommentar, „`#briefAndSend` liest kein Program", `#ProgramFoundingMode` (genau zwei Werte)
und die 66+3 `"complete"`-Nutzungen in e2e selbst nachgezählt: alles trifft zu.

**F1 — Der Widerspruch ist berechtigt und §1 ist korrigiert.** Die Residual-Vermengung bleibt nach
S1–S4 bestehen. Die daran hängende Frage entscheide ich hier: **ein `game-maker`-Studio
REFERENZIERT den Rail-Inhalt, es DUPLIZIERT ihn nie.** Seine `briefBlocks` sind ausschließlich
ADDITIV. Grund: Duplikation wäre zwei Quellen für denselben Text und damit K2 in neuem Gewand —
genau der Mechanismus, den dieses Dokument beenden soll. Die Wanderung von
`#RAIL_ROLE_GAME_MAKER` in Daten ist damit **nicht „nie", sondern ein eigener späterer Schnitt**
(S5), sinnvollerweise als Pilot am einen existierenden Workflow. Sie ist ausdrücklich NICHT Teil
von S1–S4 und blockiert sie nicht.

**F2 — Echte Lücke, und sie ändert S1.** Die gespiegelten Profil-Tür-Gates schützen das PROGRAM;
ein Studio ist aber eine QUELLE, die mehrere Programs teilen. Eine `briefBlocks`-Änderung während
Program A läuft, ändert dessen Briefe unter der lebenden MAIN — „founded under one contract,
judged under another", die wörtliche Begründung der Profil-Tür. **Entscheidung:** die Bindung
trägt `rev` (`{ id, boundAt, rev }`), `POST /api/studios/:id` bumpt den `rev` des Studios, und
eine Änderung wird **nicht** refust, solange ein gebundenes Program bloß aktiv ist — die Drift
wird SICHTBAR (`rev` bei der Bindung gegen den aktuellen `rev`) statt still. Refust wird genau
das, was heute auch die Profil-Tür refust: eine Änderung, während eine Gründung eines gebundenen
Programs **in Flug** ist (dieselbe Doppel-Lesung, dieselbe Race). Warum nicht refusen: S1s
einziger Alleinnutzen ist, dass der Owner den Workflow kuratieren kann, während S2–S4 gebaut
werden; ein Refus bei jedem aktiven Program fröre den Record dauerhaft ein. Ob S2 aus dem
gebundenen `rev` oder aus dem aktuellen rendert, ist S2s Entscheidung — die Daten trägt S1 für
beide Wege. Eine Rev-HISTORIE wird bewusst nicht gebaut (Studios sind wenige, `briefBlocks` sind
Text, und niemand hat den Rückblick verlangt).

**F3 — Angenommen: S4 ist unterspezifiziert und wird ausgeschrieben, bevor er gebaut wird.**
Kein Routenbild, kein dritter Founding-Modus (`#ProgramFoundingMode` kennt `bootstrap |
succession`), kein Leseort für das Verdikt, ~69 `complete`-Aufrufe in e2e, und retrospektiv wirkt
das Tor gar nicht (die 25 am 2026-08-30 13:27 UTC administrativ Geschlossenen bleiben
geschlossen). **S4 ist ab jetzt kein Bau-Schnitt, sondern eine eigene Mini-Entscheidung** mit der
v2-§3-Vorlage. Die dort zu klärende Wahl: nimmt das Tor einen Verdikts-Body und der e2e-Korpus
wird mechanisch nachgezogen, oder gilt es nur für Programs mit gebundenem Studio.

**F5 — Angenommen, als Satz:** die v2-Schnittlinie „vor dem nächsten Lauf" steht WEITER und wird
separat getragen. S1–S4 deckt F1≈S3, F2≈S3, F3≈S2 — **F4 (audit not-applicable), F5 (Watchdog,
26,9 h) und F6 (program-scoped Dispatch, 10,5 h) sind NICHT in dieser Reihe.** Wer S1–S4 für den
vollständigen Plan des nächsten Laufs hält, liest falsch: Wurzel 3 (Messvalidität) und Wurzel 4
(Wartezeit) schließt diese Reihe nicht, und das ist eine Folge des Owner-Entscheids „erst den
Workflow", nicht ein Versehen.

**F4, F6, F7 — übernommen** (elf statt neun in §2; Boot-Loader in S1; das Zitat sitzt am Typ
`server/types.ts#Program.profile`, nicht an der Route).

**F(e) — Die fehlende Alternative, jetzt benannt und verworfen.** Die Gegenlesung hat recht, dass
§6 den fünften Weg nicht prüft: ein **Workflow-Doc-Zeiger am Program** (`workflow: {path, sha}`,
ohne Record, ohne Türen, ohne Deckel, ohne Loader) — und dass §7 ihn mit einem Argument abtut, das
gegen Enum-WERTE gerichtet ist, nicht gegen Zeiger. Verworfen wird er trotzdem, mit dem richtigen
Grund: ein Zeiger allein macht den Server zum LESER von Repo-Prosa zur Briefbauzeit, und was er
liest, ist unstrukturierter Text — `stages[]`, `spawn` je Stufe und `gates` sind aber genau die
Teile, die eine MASCHINE auswerten muss (ein 409 kann nicht gegen einen Absatz prüfen), und die
Übersicht (Owner-Entscheid 3) braucht sie als Felder, nicht als Fließtext. Der Zeiger bleibt
deshalb als `workflow.doc` IM Record — beide Konstruktionen, nicht eine davon. Ehrlich bleibt der
Einwand zur Größe: der Wiederverwendungsnutzen über Programs hinweg ist heute spekulativ (ein
Kandidaten-Studio, ein bis drei Programs), die Fläche ist es nicht. Das ist der bewusst bezahlte
Preis dafür, dass Stufen und Gates maschinell prüfbar sind.
