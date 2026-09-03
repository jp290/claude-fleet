---
frage: Traegt die Architektur-Entscheidung „Studio als Objekt" (docs/ideen/2026-09-03-studio-als-objekt.md) am Quelltext — traegt die Trennung Maschinen-Umgebung (profile) vs Workflow (Studio), schliessen S1–S4 die fuenf Wurzeln des iOS-Worktrail-Audits, ist S1 allein landbar und falsifizierbar, was bricht, welche Alternative fehlt?
urteil: Die Richtung traegt und die Fabrikargumente stimmen am Code (ProgramProfileKind hat genau einen Wert, isGameMaker schaltet Rail-Text und Nachfolge-Disziplin), aber der Satz „profile trägt weiterhin NUR die Maschinen-Umgebung" ist am Code falsch und bleibt es nach S1–S4: von elf isGameMaker-Stellen schalten vier Workflow-Inhalt (Rail-Rolle, Nachfolge-Schritte, Carry-Verbot, Checkpoint-Tor) plus RAIL_ROLE_GAME_MAKER als groesstes Workflow-Artefakt — die Trennung wird fuer NEUE Studios durchgesetzt, der Bestand bleibt vermischt, und der Entwurf eroertert die Wanderung nicht. Wurzeln: W2 weitgehend (S3-Lint), W1/W5 teilweise (Daten statt Akteur; CONTINUE duennste Spezifikation), W3/W4 gar nicht (und S1–S4 decken die v2-Schnittlinie „vor dem naechsten Lauf" F4/F5/F6 nicht ab). S1 ist additiv landbar, ohne einen Client-Pin zu brechen (geschlossene Key-Mengen liegen nur am ProgramDigest und am founding-Sub-Record), und sein Done ist falsifizierbar; allein nuetzlich ist es nur als Kuratur-Substrat, kein Audit-Wurzel schliesst sich durch S1. Nicht geprueft wurde die leichtere Alternative aus dem v2-Vorschlag selbst (Workflow-Doc-Zeiger am Program), die nur mit einem Argument verworfen wird, das gegen Enum-Kinds gerichtet ist, nicht gegen Zeiger.
bereich: [studio, workflow, program, verify, gegenlesung]
belege: [server/types.ts#ProgramProfileKind, server/types.ts#Program, server.ts#isGameMaker, server.ts#RAIL_ROLE_GAME_MAKER, server.ts#railBlockFor, server.ts#profileRoute, server.ts#publicProgram, server.ts#queueStateSave, server.ts#capPrograms, server.ts#briefAndSend, src/client.ts#programFoundingState, e2e/programs.ts, fleet.json (Haupt-Checkout, read-only)]
nicht-gemessen: die iOS-Produkt-Repositorys (Golden Cases, OrientationResult) — nur aus den Audit-Reports uebernommen; e2e nicht ausgefuehrt (docs-only-Lane); die sechs Strang-Reports unter docs/messungen/private-repo-p-audit-2026-09-03/ nicht selbst gelesen; Transkripte und Attention-Ledger des iOS-Laufs nicht ausgewertet.
stand: 2026-09-03
---

# Gegenlesung (GLM) — „Studio als Objekt" gegen die fuenf Wurzeln (2026-09-03)

Zweitmeinung im Auftrag des Owners. Gelesen in dieser Reihenfolge: die Entscheidung
(`docs/ideen/2026-09-03-studio-als-objekt.md`), die fuenf Wurzeln
(`docs/messungen/2026-09-03-private-repo-p-worktrail-audit-synthese.md`), der Ursprungsvorschlag
(`docs/ideen/2026-09-03-private-repo-p-workflow-v2.md`), zum Klassenvergleich die Private-repo-o-Synthese
(`docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md`). Kein Code, kein Gegenentwurf.

**Baumstand:** Worktree-HEAD `903f516`, identisch mit main; `git status` leer bei Beginn. Alle
Code-Aussagen an diesem Stand, jede mit `datei#symbol`. Live-Ledger (`fleet.json` des
Haupt-Checkouts) nur lesend.

---

## 0. Vorbemerkung: der Fabrikcheck besteht

Die tragenden Code-Behauptungen der Entscheidung stimmen alle:

- `server/types.ts#ProgramProfileKind` ist genau `"game-maker"`; `#PROGRAM_PROFILE_KINDS` hat
  einen Eintrag; der Loader `#loadProgramProfile` ist closed-set, unknown-kind laedt als ABSENT.
- `server.ts#isGameMaker` ist exakt `p?.profile?.kind === "game-maker"` — ein Feld, ein Wert,
  harte Verzweigung.
- Die Profil-Tuer (`server.ts` §THE PROFILE DOOR, `/api/programs/:id/profile`) hat genau die fuenf
  Eigenschaften, die die Entscheidung dem Studio spiegeln will: unbekannter Key 400, identische
  Wiederholung 200 vor allen Lifecycle-Gates, Gründung-in-Flug 409, complete 409, lebende MAIN 409.
- Der Kommentar „environment a MAIN is FOUNDED into" steht wörtlich an
  `server/types.ts#Program.profile` — die Entscheidung zitiert ihn als „an der Profil-Tuer"
  (kosmetisch: er sitzt am Typ, nicht an der Route).
- Live: von 60 Programs tragen genau zwei ein Profil (beide `game-maker`, beide active:
  `f99e9354`, `2c073232`); alle iOS-Programs inklusive `07ee8a6d` (active) tragen `profile: null`.
  Das ist die quantitative Bestätigung von Wurzel 5: das Feld existiert, aber 58 von 60 Programs
  haben keine Umgebungserklärung, und keiner von ihnen eine Workflow-Erklaerung.

Die drei Verwerfungen in §6 der Entscheidung (drittes Kind, profile ersetzen, Text einbetten)
sind am Code jeweils richtig begründet. `context-manifest.ts#observedSourceHash` existiert;
`docs/game-maker/workflow-v2.md` existiert noch nicht (nur `docs/game-maker/entwurf/`) — mit
„entsteht gerade" und „S1 kennt nur Pfad+Hash" ist das verträglich.

---

## (a) Traegt die Trennung am Code? — Ja als Richtung, nein als vollzogene Trennung

Alle elf `isGameMaker`-Aufrufstellen (die Entscheidung sagt „neun" — Fund 4), klassifiziert nach
der eigenen Definition der Entscheidung: *Maschine* = Worktree, Lease, Rail-**Mechanik**;
*Workflow* = Stufe, Rolle, Gate, Brief-Block.

| Stelle | Schaltet | Klasse |
|---|---|---|
| `server.ts#exactGameMakerFoundingPermit` | Lease-Erlaubnis | Maschine |
| `server.ts#assertGameMakerTreeOpen` | Baum-Exklusivität | Maschine |
| `server.ts#reserveProgramFounding` | Lease-Profil, canonicalRoot | Maschine |
| `server.ts#currentProgramFounding` | Founding-Recovery-Konsistenz | Maschine |
| `server.ts#gameMakerMachineError` | dedizierter Linked-Worktree-Zwang | Maschine |
| `server.ts#succeedProgramMain` (openSlot-cwd) | repoRoot vs. predecessor.cwd | Maschine |
| `server.ts#bootstrapProgramMain` (openSlot-cwd) | repoRoot vs. body.cwd | Maschine |
| **`server.ts#railBlockFor`** | **GAME-MAKER-ROLLENPARAGRAPH vs Standard-Rolle** | **Workflow** |
| **`server.ts#buildProgramMainSuccessionBrief`** | **Nachfolge-Schritte (Replay vor Projection, nur-Checkpoint)** | **Workflow** |
| **`server.ts#handleSelfSucceed`** (carry-Verbot) | **ein Uebergabekanal, kein carry** | **Workflow** |
| **`server.ts#gameMakerCheckpointError`** | **committed Checkpoint als Nachfolge-Tor** | **Workflow** |

Dazu zwei Workflow-Payloads ohne eigene Verzweigung: `server.ts#RAIL_ROLE_GAME_MAKER` (Preflight-
Ordnung, Direct-Slice-Regeln, Sensory-Critic-Vertrag, vier Wahrheiten — nach der Definition der
Entscheidung pures „Inhalt") und `server.ts#GAME_CHECKPOINT_FIELDS` (siebenfeldrige
Checkpoint-Ordnung, die Rail-Text UND Nachfolge-Tor antreibt).

**Befund:** Die Vermengung ist einsgerichtet — das Maschinen-Feld traegt Workflow-Payloads, nie
umgekehrt. Genau das ist der Wurzel-5-Mechanismus (K2): Regeln, die fuer alle gelten sollten,
haengen am Game-Maker-Schalter. **Aber die Entscheidung beendet diese Vermengung nicht**, sie
umgeht sie: S2 haengt Studio-Bloecke als vierten Summanden an, waehrend `#railBlockFor` weiterhin
nach `isGameMaker` waehlt. Das ist fuer NEUE Studios ausreichend (deren Workflow kommt als Daten),
fuer den Bestand aber bleibt `profile.kind` ein Workflow-Traeger — siehe Widerspruch 1 unten.

---

## (b) Schliessen S1–S4 die fuenf Wurzeln?

**Wurzel 1 (kein Akteur mit fremder Wahrnehmung) — teilweise.** Was S2/S3 liefern, sind Daten und
Tore, kein Akteur: `briefBlocks` machen Produktblick/Beweiszeile/Widerspruchs-Stopp zur
mechanischen Pflicht in JEDEM Brief (die Null-Treffer-Zahl von 8/8 Briefs waere 8/8 mit Block),
und `criticBeforeTaste` als 409 verweigert die Owner-Taste ohne Critic-Verdikt. Aber: nichts in
S1–S4 spawnt, plant oder bezahlt einen Critic — ob einer laeuft, haengt daran, dass der Owner eine
Critic-Stufe konfiguriert UND dass der Critic das Produkt tatsaechlich bedient (v2 §2.6). Ausserdem
braucht das 409 eine scharfe Definition, was eine Attention als „Taste-Marker" kennzeichnet (heute
ist `kind:decision` freier Text; vgl. `server.ts` Attention-Route) — ohne diese Definition ist das
Done-Kriterium nicht falsifizierbar. Wurzel 1 bleibt nach S1–S4 eine Owner-Konfigurations- und
Akteursfrage; die Entscheidung sagt das nicht, der Vorschlag (v2 §2.6) schon.

**Wurzel 2 (unerfüllbares Program-JSON, niemand meldet zurück) — weitgehend geschlossen, durch S3.**
`programLint` vor `confirm` haette alle drei strukturell unerfuellbaren Klauseln vor dem ersten
Brief gefunden; dass der Lint das `POST /api/programs/:id/confirm`-Ergebnis wird
(`server.ts` Action-Router), ist die richtige Tuer: der Owner sieht die Widersprueche, BEVOR er
bestaetigt — das schliesst auch die Verhaltenshaelfe (0 von 10 Produktfragen), weil die Frage
nicht mehr vom Agenten gestellt werden muss, sondern von der Maschine. Rest offen: der Lint
selbst ist erst Entwurf (Regelmenge, Fixture `07ee8a6d` ≥ 3 Warnungen ist ein guter
Falsifizierer). „Weitgehend", weil die zweite Haelfte der Wurzel („die App konsultiert nichts"
wurde zur Messzeile umdefiniert) ein Produkt-Regel-Ding ist, das kein Fleet-Gate ersetzt.

**Wurzel 3 (Gates messen das selbstdeklarierte Universum) — nicht geschlossen.** Orakel-Echo
(`expectedOutcome.status`), handgeschriebene Golden Cases als einzige Fixtures, Card schreibt
eigene Kriterien — keines der vier Schnitte tastet Messvaliditaet an. Einziger Teilbeitrag: die
Beweiszeile als Pflichtzitat in `briefBlocks` beendet die „letzten drei Zeilen"-Klasse
(`schema-negative.log` mit „0 tests passed"). Wer S1–S4 als Antwort auf das Audit liest, glaubt
Wurzel 3 mitbedient; sie ist es nicht.

**Wurzel 4 (79 % Wartezeit, tote MAIN, Dispatch) — nicht adressiert, und die Schnittlinie
schweigt darueber.** F5 (Watchdog, 26,9 h), F6 (program-scoped Dispatch, 10,5 h), F4
(audit not-applicable) sind nicht in S1–S4. Die v2-Schnittlinie „vor dem naechsten iOS-Lauf:
F1, F2, F3, F4 (und F9)" wird von S1–S4 nur teilweise getragen (F1≈S3, F2≈S3-Gate, F3≈S2-Bloecke;
F4/F5/F6 fehlen). Der Owner-Entscheid „erst den Workflow aufsetzen" ordnet um — legitim, aber die
Entscheidung muesste aussprechen, dass die naechste-Lauf-Linie aussteht, sonst liest man S1–S4
als vollstaendigen Plan (Fund 5).

**Wurzel 5 (Workflow ist kein Objekt; kein CONTINUE) — teilweise, je Haelfte.**
*„Kein Objekt":* S1 schliesst die strukturelle Haelfte — Record, Tueren, Bindung, Restart.
Der K2-Mechanismus (Regeln in einem Game-Maker-Abschnitt, den ein iOS-Program nicht erbt) ist
fuer NEUE Regeln geschlossen, weil `briefBlocks` an jeden Brief gehen, unabhaengig vom Profil;
fuer den BESTAND bleibt er offen, weil `RAIL_ROLE_GAME_MAKER` maschinenverdrahtet bleibt
(Widerspruch 1). *CONTINUE:* S4 ist der duennste Schnitt — ein Satz je Tor. Das `complete`-Tor
existiert heute als reine Verwaltungs-Tuer (`server.ts` Action-Router: active→complete ohne
Beweis, einzige Verweigerung „founding in flight"; live bestaetigt: **25** Programs teilen die
completedAt-Minute 2026-08-30 13:27 UTC = 15:27 MESZ — das Audit nannte fuenf, der Stapel war
groesser). Ein Beweis-oder-Verdikt-Tor wirkt nur prospektiv; die 25 administrativ
Geschlossenen bleiben geschlossen. Die `resume`-Gründung braucht einen dritten Founding-Modus oder
eine Bootstrap-Variante (`server/types.ts#ProgramFoundingMode` kennt nur `bootstrap |
succession`) — unbenannt in der Entscheidung (Fund 3).

---

## (c) S1 allein landbar und allein nuetzlich? Done falsifizierbar?

**Landbar: ja, und ohne einen bestehenden Pin zu brechen.** Verifiziert am Code: `#publicProgram`
spreizt alle Program-Felder (`{ ...program, ... }`), ein zusaetzliches `studio`-Feld erscheint
automatisch in `GET /api/programs`. Die einzigen geschlossenen Key-Mengen an dieser Flaeche sind
der ProgramDigest (vier Felder, separate Zusammenstellung, `e2e/programs.ts` pinnt
„exactly four fields") und das founding-Sub-Record (`src/client.ts#programFoundingState` mit
`#exactWireKeys`) — beide unberuehrt, solange `studio` ein Geschwister-Feld bleibt und nicht in
`founding` oder den Digest wandert. Der Web-Client-Typ `src/client.ts#ProgramInfo` ist durchgaengig
optionale Assertion „about a foreign surface" — additiv sicher. Damit ist die offene Frage in
„Nicht geprüft" der Entscheidung („ob publicProgram die Studio-Bindung spreizen darf") jetzt
beantwortet: ja, gefahrlos.

**Done falsifizierbar: ja.** Fuenf Verweigerungen je eigenem Text sind je ein Negativ-Check;
„identische Wiederholung ist 200 ohne Schreibakt" ist ueber `confirmedAt`/Audit-Zeilen
widerlegbar; der Restart-Fall beweist die Persistenz. Zwei Schaerfen: (i) Die Entscheidung nennt
als Persistenzstelle nur `server.ts#queueStateSave` — der Boot-Loader laedt jedes Program-Feld
explizit wieder ein (permissiv gegenueber unbekannten Keys: ein nicht geladenes Feld wird
still gedroppt); ohne Boot-Zusatz wuerde S1 den Restart-Fall genau richtig FAILen. Das Done
deckt es, der Text nennt die Stelle nicht — ein Satz „und der Boot-Loader in derselben Disziplin"
haette gehoert. (ii) Die 200-ohne-Schreibakt-Pruefung muss VOR den Lifecycle-Gates stehen wie an
der Profil-Tuer (dort begruendet: eine verlorene 200 wird wiederholt, waehrend die Gründung
laeuft) — „spiegeln" umfasst das nur, wer die Tuer liest.

**Allein nuetzlich: eingeschraenkt.** S1 aendert kein Verhalten; bis S2 liest nichts den Record.
Sein Allein-Nutzen ist, dass der Owner den Workflow kuratieren kann, waehrend S2–S4 bauen, und
dass die spaetere Uebersicht ihren Bestand bekommt — „der Record muss stehen, bevor irgendetwas
ihn liest" ist ehrlich und richtig geordnet. Aber kein Audit-Wurzel schliesst sich durch S1
allein; die Aussage „allein nützlich" gilt nur in diesem Substrat-Sinn. Kein Widerspruch, eine
Schaerfung.

---

## (d) Was bricht?

**Durch S1: nichts.** Additiver Typ, additive Persistenz, neue Tueren; `#isGameMaker` und alle elf
Stellen unberuehrt; Briefe byte-identisch, weil S1 den Brief nicht kompiliert; Game-Maker-Pfad
unberuehrt; `#capPrograms`/`#MAX_PROGRAMS` unberuehrt (Studios kriegen einen eigenen Deckel —
harter Deckel ohne Verdraengung ist richtig, weil `#capPrograms` nur COMPLETE verdraengt und
Studios nie complete werden; die offene Frage in „Nicht geprüft" ist damit entscheidbar).

**Durch S2: eine Naht, nicht zwei.** Die Entscheidung sagt „vierter Summand, kein neuer Zweig" —
richtig, aber der Kompilationskommentar verlangt EINE Naht je Builder
(`body.join("\n") + railBlockFor(program) + anchorBlock`) und warnt ausdruecklich, dass eine
zweite Naht der Weg ist, auf dem eine Variante den Rail verliert. Der Studio-Block gehoert in
`#railBlockFor` hinein („The one selector, read by both builders"), nicht als zusaetzter Summand
an beiden Builder-Stellen. Fuer den Byte-Gleichheits-Check des studiolosen Falls existiert schon
das Check-Muster (`e2e/programs.ts`: „EXACTLY ONE byte-identical profile role block"). Zusaetzlich:
`#briefAndSend` liest heute KEIN Program — die lane/review/critic-Bloecke brauchen einen neuen
Program-Lookup an der Zustellnaht (`free.programId` existiert), und die Immutabilitaets-Garantie
muss dann auch fuer lane-Briefe gelten (Fund 2).

**Durch S3: Definitionsfrage Taste-Marker** (siehe Wurzel 1) plus e2e-Flaeche: das
criticBeforeTaste-409 braucht Positiv-/Negativ-Fixtures, die eine Attention MIT und OHNE
Critic-Verdikt filein — der Verdikt-Nachweis (wo liest die Route ihn?) ist unbenannt.

**Durch S4: die breiteste Bruchfläche.** Das Beweis-oder-Verdikt-Tor am `complete` bricht die
bestehende e2e-Nutzung: 66 `"complete"`-Aufrufe in `e2e/programs.ts`, 3 in `e2e/tasks.ts` —
fast alle Verwaltungs-Abschluesse am Testende. Entweder nimmt das Tor einen Verdikts-Body
(`{"verdict":"abandoned"}`) an und der Korpus wird mechanisch nachgezogen, oder das Tor gilt nur
fuer Programs mit gebundenem Studio. Beides ist eine Entscheidung, die S4-Text nicht traegt.
`succeedProgramMain` selbst ist von S1–S3 unberuehrt (Carry-Politik bleibt maschinenverdrahtet,
siehe (a)); S4-resume beruehrt `#bootstrapProgramMain`-Brief-Wahl und braucht den dritten Modus
(Fund 3).

---

## (e) Die gepruefte Alternative, die fehlt

Die Entscheidung pruft und verwirft vier Wege (§6) — aber nicht den fuenften, den der
Ursprungsvorschlag selbst empfohlen hatte: **Workflow-Doc-Zeiger am Program**
(v2 §7, Owner-Entscheid 4: „profile → Workflow-Doc + Hash (empfohlen: das Doc)"; F7 nannte ihn
„oder besser"). Ein optionales Feld `workflow: { path, sha }` am Program, gesetzt ueber eine
Tuer in Profil-Disziplin, haette Wurzel 5 mit vielleicht einem Fuenftel der Flaeche geschlossen:
keine Record-Klasse, keine Studio-Tueren, keine Bindungs-Gates, kein Deckel, kein Loader — und
der Server liest an der Zustellnaht ohnehin schon Repo-Dateien (`#briefAndSend` baut den
Context-Plan aus dem Repo; `#observedSourceHash` ist genau dafuer gebaut). §7 der Entscheidung
streift ihn als „Feld in profile (nicht empfohlen, §2)" — aber §2 argumentiert gegen ENUM-WERTE
(„ein Enum-Wert traegt keine Einstellung"), nicht gegen Zeiger; die Verweisung verwirft eine
andere Alternative als die genannte. Was den Record rechtfertigen koennte (Wiederverwendung
ueber Programs hinweg, Konfiguration ohne Deploy, Uebersicht-Join) ist real, hat aber heute
genau EIN Kandidaten-Studio (private-repo-p) mit ein bis drei Programs — der Wiederverwendungsnutzen
ist spekulativ, die Flaeche ist es nicht. Der Owner-Entscheid „Studio als Objekt" bindet die
Richtung; er befreit die Entscheidung nicht davon, den leichteren Weg zu benennen und zu
verwerfen, bevor eine neue Owner-Record-Klasse entsteht, die so lange leben muss wie Fleet.
(Eine zweite, kleinere Unterlassung: die Wanderung des bestehenden Game-Rails in Daten — als
Pilot genau dieses Mechanismus am EINEN existierenden Workflow — wird nirgends erwogen, siehe
Widerspruch 1.)

---

## Fundliste, gerankt — SCHNITTLINIE: oberhalb vor Umsetzung klaeren

**1) [oberhalb] Die Trennung ist fuer den Bestand nicht vollzogen, und die Entscheidung sagt
„nur Maschinen-Umgebung", wo der Code Workflow traegt.** §1: „`Program.profile` bleibt
unangetastet und trägt weiterhin nur die MASCHINEN-Umgebung" — falsch am Code von `903f516` und
falsch nach S1–S4: `#railBlockFor`, `#buildProgramMainSuccessionBrief`, `#handleSelfSucceed`
(carry), `#gameMakerCheckpointError` schalten Workflow-Inhalt am Maschinen-Feld, und
`#RAIL_ROLE_GAME_MAKER` bleibt der groesste Workflow-Text der Flotte, maschinenverdrahtet.
Konsequenz: ein game-machine-Studio, dessen Workflow Preflight/Critic/Four-Truths verlangt,
muss diese Inhalte entweder als `briefBlocks` DUPLIZIEREN (zwei Quellen, Drift, genau der
K2-Mechanismus in neuem Gewand) oder auf den Rail verweisen, den es nicht kontrolliert. Vor
Umsetzung klaeren: (i) Satz so korrigieren, dass er die Residual-Vermengung benennt;
(ii) entscheiden, ob ein game-machine-Studio den Rail-Inhalt referenziert oder dupliziert;
(iii) ob die Rail-Wanderung in Daten ein spaeterer Schnitt ist oder nie.

**2) [oberhalb] Mutations-Gates des Studio-Records bei gebundenen Programs fehlen.** Die
gespiegelten Profil-Tuer-Gates schuetzen das PROGRAMM (complete verweigert, lebende MAIN
verweigert REBINDING, Gründung-in-Flug sperrt). Der Studio-Record ist aber eine QUELLE, die
mehrere Programme teilen: `briefBlocks`-Aenderung waehrend Program A laeuft aendert dessen
lane-Briefs unter der lebenden MAIN — „founded under one contract, judged under another", die
woertliche Begruendung der Profil-Tuer, trifft exakt. Die Entscheidung definiert Tueren fuer
ANLEGEN und BINDEN, keine Regel fuer AENDERN bei gebundenem Programm (Refus? Versionieren?
nur additive Bloecke?). S2 braucht diese Regel zwingend (lane-Briefs lesen den Record zur
Zustellzeit).

**3) [oberhalb] S4 ist unter-spezifiziert und traegt die breiteste Bruchfläche.** Kein Routenbild,
kein dritter Founding-Modus (`#ProgramFoundingMode` kennt zwei), kein Verdikts-Nachweisort fuer
das Taste-Gate, ~69 `complete`-Aufrufe in e2e, retrospektive Wirkung null (25 administrativ
Geschlossene bleiben). CONTINUE — die Haelfte von Wurzel 5 — haengt am duennsten Satz der
Entscheidung. Vor S4 als eigene Mini-Entscheidung ausschreiben (v2 §3 hat die Vorlage).

**4) [unterhalb] „neun Aufrufstellen" sind elf.** `isGameMaker`-Calls auf `903f516`:
`#exactGameMakerFoundingPermit`, `#assertGameMakerTreeOpen`, `#reserveProgramFounding`,
`#currentProgramFounding`, `#handleSelfSucceed`, `#gameMakerCheckpointError`,
`#gameMakerMachineError`, `#railBlockFor`, `#buildProgramMainSuccessionBrief`, `#succeedProgramMain`,
`#bootstrapProgramMain`. Fuer S2 relevant sind genau drei Beruehrungen: `#railBlockFor`,
`#buildProgramMainSuccessionBrief`, `#briefAndSend` — keine der sieben Maschinen-Stellen. Die
Zaehlung in „Nicht geprüft" sollte stehen bleiben, aber mit der richtigen Zahl.

**5) [unterhalb] Die v2-Schnittlinie „vor dem naechsten iOS-Lauf" (F1–F4, F9) wird von S1–S4 nicht
abgedeckt** — F4 (audit not-applicable), F5 (Watchdog), F6 (Dispatch) fehlen. Ein Satz in der
Entscheidung, dass diese Linie weiterhin steht und separat getragen wird, hindert das
Fehllesen „S1–S4 = der Plan fuer den naechsten Lauf".

**6) [unterhalb] S1-Persistenz nennt nur die Schreibseite.** Boot-Loader-Zusatz in derselben
Disziplin (explizites Wiedereinlesen, closed-set, unknown-version→ABSENT) gehoert in den
S1-Text; das Restart-Done deckt es, der Bautext verliert ohne den Satz eine Stunde.

**7) [unterhalb] Zitatfeinheit:** das „Umgebung, in die eine MAIN GEGRÜNDET wird"-Kommentar sitzt
an `server/types.ts#Program.profile`, nicht „an der Profil-Tuer" (`server.ts`-Kommentar dort
handelt von Schreiber-Disziplin). Kosmetisch.

---

## Widerspruch

Ich widerspreche der Entscheidung an einer tragenden Stelle: **§1 Satz 1, zweite Haelfte**
(„`Program.profile` bleibt unangetastet und trägt weiterhin NUR die MASCHINEN-Umgebung") ist als
Code-Aussage falsch und bleibt nach S1–S4 falsch — vierzehn Zeilen spaeter beschreibt §2 selbst,
dass `profile.kind` den Rail-Block waehlt, und der Rail-Block ist nach der eigenen Definition der
Entscheidung Workflow („welche Stufe, welche Rolle, welches Gate, welcher Brief-Block"). Die
Entscheidung widerspricht sich hier selbst, und die implizite Loesung (neue Studios tragen
Workflow als Daten, der alte Rail bleibt liegen) ist eine akzeptable Entscheidung, die ABER
getroffen und benannt werden muss — inklusive der Duplikationsfrage aus Fund 1(ii). Alles andere
— Fabrikargumente, Tuer-Spiegelung, S1-Landbarkeit, Verwerfungen — haelt der Gegenpruefung stand.

## Verifiziert / Abgeleitet / Nicht geprüft

**Verifiziert (eigene Pruefung am Baum `903f516` bzw. Live-Ledger):** alle elf `isGameMaker`-
Aufrufstellen gelesen und klassifiziert; `#ProgramProfileKind`/`#PROGRAM_PROFILE_KINDS`/
`#loadProgramProfile`; Profil-Tuer mit allen fuenf Eigenschaften inkl. Reihenfolge der Gates;
`#railBlockFor` als einzige Selektorstelle, von beiden Brief-Buildern gelesen, Eine-Naht-Kommentar;
`#publicProgram`-Spreizung und `GET /api/programs`; ProgramDigest-vier-Felder-Pin in
`e2e/programs.ts`; `#exactWireKeys`/`#programFoundingState` als einzige geschlossene Key-Mengen
am Client; `#queueStateSave`-Body und Boot-Loader (permissiv, explizit je Feld);
`#capPrograms`-Verdraengungslogik (nur complete); `#briefAndSend` liest kein Program;
`complete`-Tuer ohne Beweis-Gate; 66+3 `"complete"`-Nutzungen in e2e; `#observedSourceHash`
existiert; `docs/game-maker/workflow-v2.md` existiert (noch) nicht; `fleet.json` (Haupt-Checkout,
read-only): 60 Programs, 2 mit Profil (beide game-maker, active), `07ee8a6d` active mit
`profile: null`, `b2aa5b45` active, 25 Programs mit derselben completedAt-Minute
2026-08-30T13:27Z.

**Abgeleitet:** dass S2 ohne zweite Naht auskommt, wenn der Studio-Block in `#railBlockFor`
gefaltet wird; dass ein harter Studio-Deckel ohne Verdraengung reicht (aus `#capPrograms`-Logik
und der Annahme, Studios werden nie `complete`); dass die lane-Brief-Attachment-Stelle
`#briefAndSend` ist (`free.programId` verfuegbar); dass der Lint die drei Private-repo-y-Klauseln
gefunden haette (aus der Klausel-Beschreibung des Audits, nicht am Program-JSON selbst geprueft).

**Nicht geprüft:** die iOS-Produkt-Repositorys (Golden Cases, OrientationResult,
WorkflowPackValidator — nur aus den Audit-Strangen uebernommen); die sechs Reports unter
`docs/messungen/private-repo-p-audit-2026-09-03/`; Transkripte, Attentions und Land-Notes des
iOS-Laufs; `e2e/programs.ts` als Ganzes (stichprobenartig an den Pins); ob Brief 9 inzwischen
gelandet ist; die Session-Ledger-Idee und ihre GLM-Gegenlesung im Detail; die Frage, ob
`b2aa5b45` sein Workflow-Doc inzwischen committet hat (Live-Checkout kann der Lauf geaendert
haben, seit ich las).
