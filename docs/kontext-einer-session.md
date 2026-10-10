# Was eine Fleet-Session beim Start weiß, und warum

Stand 10.10.2026. Für dich geschrieben, damit du die Schnitte verstehst, die du freigibst. Jede
Aussage verweist in Klammern auf die Zeile der Messnotiz
`docs/messungen/2026-10-10-kontext-bestandteile.md`, in der Zahl, Herkunft und Beleg stehen
(z. B. „→ H1“, „→ §1“, „→ A.2“). Zahlen sind Tokens, gerundet. Wo „nach dem Deploy“ steht, sind
Schnitte gelandet, aber der laufende Server kennt sie noch nicht.

## Das Bild in drei Schichten

Jede Session bekommt beim Start drei Dinge, bevor sie das erste Mal etwas tut:

1. **Was Claude Code selbst mitbringt**: seine Werkzeuge, seinen Systemprompt und Listen der Skills und
   Hilfsagenten. Darauf hat Fleet kaum Einfluss. Es ist bei jeder Rolle der größte Block, 39 bis
   54 Prozent (→ §1, F1).
2. **Was Fleet dazulegt**: das Regelbuch der Rolle, deine globalen Regeln, das gemeinsame Gedächtnis
   der Orchestrierung und, nur bei der Lane, ihre Session-Datei (→ §1, Gruppen G, R, S).
3. **Was die Session im ersten Zug liest**: den Startbrief, dein Korrektur-Heft und die Lagemeldung
   (→ Gruppen B, E).

Der Startbrief, den du in der Pane siehst, ist davon nur ein kleiner Teil: bei der MAIN etwa ein
Siebtel, bei Lane und Orchestratorin ein Zwanzigstel (→ §1, §3.2).

Eine Vermutung hat sich nicht bestätigt: Der feste Sockel von rund 27 000 Tokens, den alle Rollen
teilen, kommt nicht von Playwright oder anderen MCP-Werkzeugen. Die stehen nur mit ihrem Namen im
Start und kosten MAIN und Orchestratorin zusammen etwa 1 900 Tokens, die Lane nichts. Den Sockel
tragen die Beschreibungen der eingebauten Werkzeuge von Claude Code (→ H1, H10, H11, §3.1, F2).

---

## Die Lane

**Heute rund 64 000 Tokens beim Start, nach dem Deploy rund 55 000** (→ §1).

**Was sie weiß und warum:**

- *Wer sie ist und an wen sie meldet.* Ihre Rollenkarte sagt: genau eine Karte ausführen, an die MAIN
  melden, nie an dich direkt (→ S2). Ohne sie wüsste die Lane nicht, wo ihre Grenze liegt.
- *Wie sie beweist, dass ihre Arbeit trägt.* Die Prüfregeln stehen ganz in ihrer Session-Datei: erst
  fragen, was sie wirklich prüfen muss, dann genau das fahren, ein Ergebnis nur am Ende eines Laufs
  ablesen (→ S3). Das ist der Teil, den eine Lane am häufigsten braucht.
- *Wie sie endet.* Committen, einen Bericht an die MAIN schicken, still werden (→ S7). Ohne diesen
  Schluss bliebe Arbeit liegen, die niemand landen kann.
- *Deine Korrekturen.* Ein Zeiger auf dein Korrektur-Heft, das sie vor dem ersten Akt liest
  (→ S6, E1). Heute sind das rund 2 700 Tokens; der gefaltete Schnitt Z5 würde es auf rund 1 600
  senken und wartet auf dein Ja (→ E1, §6).
- *Das Regelbuch der Lane.* Rund 10 600 Tokens Hausregeln: was auf dieser Maschine gefährlich ist (nie
  den Live-Server starten, nie einen Prozess nach Namen beenden), wie man Wissen findet, wie man vor dem
  Bericht prüft, ob main weitergelaufen ist (→ R1, R3, R4).
- *Deine globalen Regeln* (Belege statt Vermutung, Sicherheit, Bun) seit heute auch in jeder Lane
  (→ G1).
- *Wo sie bei Bedarf nachliest.* Sieben Zeiger statt Text: der volle Vertrag, das Konzept von Claude
  Fleet, die Arbeitshaltung (→ S5, Z1).
- *Ihr Auftrag.* Die Karte und der Prosa-Auftrag (→ B2).

**Was nach dem Deploy wegfällt:** das gemeinsame Gedächtnis der Orchestrierung, rund 8 700 Tokens.
Eine Lane braucht es nicht; ihren eigenen Stand liest sie über ihre Gedächtnis-Tür (→ G4, H4, S8).

**Was doppelt ist oder nicht trägt:**

- Rund 4 300 Bytes im Lane-Regelbuch sagen dieselben Prüfregeln wie ihre Session-Datei, nur älter;
  dazu wiederholt ein englischer Block in der Session-Datei drei Regeln (→ F7, A.1). Vorschlag:
  Regelbuch auf Verweise kürzen, englischen Block streichen (Schnitt Z7, offen).
- Der Vertrag, den jede Session „einmal lesen“ soll, wird nicht gelesen: von 38 Lanes heute hat keine
  ihn aufgerufen (→ E3, F3). Für die Lane ist das heute schon so; ihre Prüfregeln bekommt sie trotzdem
  ganz.
- Im Startbrief steht der DONE-Satz dreimal, und dein langer Kommentar auf der Zeile kam nach 500
  Bytes abgeschnitten an (→ B2, F9).

---

## Die Program-MAIN

**Gemessen rund 103 000 Tokens beim Start, nach Deploy aller gelandeten Schnitte rund 78 000**
(projiziert; eine so gestartete MAIN gibt es noch nicht) (→ §1).

**Was sie weiß und warum:**

- *Ihr Program.* Seit dem Schnitt Z8 steht dein Auftrag wörtlich im Brief, die Entscheidungen und
  Belege als Zeiger statt als ausgedrucktes Protokoll. Der Brief wächst dadurch nicht mehr mit jeder
  Entscheidung (→ B3, §6).
- *Ihre Rolle und ihre Schiene.* Rollenkarte und „wie dieses Program ausgeführt wird“: Karte
  schreiben, freigeben, auf den Bericht warten ohne zuzuschauen, Bericht als Behauptung lesen, landen
  (→ B3). Die Schiene ist mit rund 3 400 Tokens der größte feste Teil des Briefs.
- *Das Regelbuch der MAIN.* Rund 26 000 Tokens, der größte Fleet-Block überhaupt: Land-Takt, was ein
  „idle“ einer Lane wirklich heißt, wann sie übergibt, ihre Türen (→ R2, Anhang A.2).
- *Das gemeinsame Gedächtnis* der Orchestrierung, rund 8 700 Tokens (→ G4). Es bleibt, weil dort
  Korrekturen stehen, die noch nicht im Heft sind.
- *Lage und Korrekturen* im ersten Zug: die Lagemeldung (rund 4 700 Tokens) und dein Heft (→ E1, E2).
- *Werkzeuge zum Durchklicken.* Playwright bleibt, weil ihre Rollenkarte verlangt, sichtbare Arbeit
  selbst in der Testinstanz abzunehmen (→ H10).

**Was die gelandeten Schnitte ändern:** Skill-Liste geschnitten (rund −6 600), Codex-Fassung der
globalen Regeln weg (rund −2 100), die doppelt geladene Repo-Regeldatei weg (rund −10 100), Brief
ohne Protokoll (rund −5 700) (→ §1, H7, G2, G3, B3).

**Was du entscheiden solltest:**

- *Der Vertrag.* Mit dem Wegfall der doppelt geladenen Regeldatei erreicht der portable Vertrag (du
  hast ihn als „nötig und gesperrt“ festgelegt) die MAIN nur noch über einen Lesebefehl, und der wird
  kaum befolgt (→ F3, E3, G3). Vorschlag: den Vertragsabschnitt (rund 4 900 Tokens statt 10 100 für
  die ganze Datei) direkt ins Regelbuch der Rolle legen, bevor der Schnitt deployt wird.
- *Codex-Absätze.* Rund 3 800 Tokens im MAIN-Regelbuch handeln von GPT-, Codex- und pi-Lanes, obwohl
  Codex seit gestern pausiert ist (→ F6, A.2). Vorschlag: hinter einen Verweis „wenn du eine
  Nicht-Claude-Lane briefst“ legen; einer davon nennt seine Rücknahme selbst.
- *Geschichten im Regelbuch.* Mehrere Absätze erzählen, wie eine Regel entstand (alte Kontextbänder,
  Vorfälle vom September). Die Regel bleibt, die Geschichte kann zum Verweis werden (→ A.2: Kontext-Band,
  R2', schmutziger Checkout).

**Ein Missverständnis im Startfenster:** Das Fenster zeigt für die MAIN eine Datei mit Prüfregeln als
Volltext. Die MAIN bekommt diese Datei nicht; ihr Brief trägt dieselben Teile nur als Zeiger
(→ F4, Z1).

---

## Die Orchestratorin

**Gemessen rund 79 000 Tokens beim Start, nach dem Deploy rund 69 000** (→ §1).

**Was sie weiß und warum:**

- *Ihre Rolle.* Die Rollenkarte mit „Dein System“: Fleet am Laufen halten, Weiterentwicklung treiben,
  keine Regression stehen lassen, Grenzfragen genau einmal an dich (→ B4).
- *Das Regelbuch der Orchestratorin.* Rund 16 400 Tokens: Einstieg, Übergabe-Schwelle, Deploy
  (→ R2, R5). Den Deploy-Teil (rund 3 500) würde ich behalten, weil du ihr den Deploy übertragen hast;
  das widerspricht dem Kürzungsvorschlag der Inventur von gestern (→ R5, A.3).
- *Das gemeinsame Gedächtnis*, rund 8 800 Tokens (→ G4). Drei Einträge darin nennen sich selbst
  „abgelöst“, „zurückgerudert“ oder „überholt“; das Aufräumen ist ihre Sache (→ G4).
- *Fable-Zusätze.* Weil sie auf Fable 5.1 läuft, bringt Claude Code rund 2 900 Tokens mehr Systemprompt
  mit als bei Opus (→ H5). Das ist eine Folge der Modellwahl, kein Fleet-Hebel.
- *Lage und Korrekturen* im ersten Zug: Lagemeldung rund 6 500 Tokens, dein Heft rund 6 400; mit Z5
  wären es rund 3 600 (→ E1, E2).
- *Zeiger*: Portfolio-Gedächtnis, Packs (→ B4, B5). Ein Pack „Beim Start einer Lane“ steht fälschlich
  auch bei ihr und der MAIN (→ F8).

**Was du entscheiden solltest:** dasselbe wie bei der MAIN zum Vertrag (→ F3) und zu den
Codex-Absätzen (rund 1 000 Tokens bei ihr, → F6). Dazu die Account-Konnektoren Gmail, Kalender, Drive
und Claude-Doku: keine Rolle braucht sie, sie kosten zusammen unter 1 000 Tokens, und abschalten
kannst nur du im Account (→ H10, H11).

---

## Über alle Rollen

**Der größte Hebel liegt bei Claude Code, nicht bei Fleet.** Die Werkzeugbeschreibungen kosten jede
Session 22 000 bis 26 000 Tokens. Eine Probe zeigt: Werkzeuge per Verbot abzuschalten spart nichts,
eine Liste der erlaubten Werkzeuge schon (Hilfsagenten rund 3 400, Workflows rund 2 000). Eine Lane
braucht zum Beispiel keine Artefakt- und keine Workflow-Werkzeuge. Ob das in der laufenden Pane
genauso wirkt, ist noch nicht geprüft (→ H1, §3.1, F1).

**Das Startfenster zeigt zu wenig.** Schritt ③ „Was der Agent liest“ zeigt bei der Lane rund 9 Prozent
ihres Starts, nämlich nur die Session-Datei (→ F4, §5). Vorschlag für die Oberfläche: ein Balken je
Rolle in Tokens mit drei Farben (Claude Code, Fleet, Brief und erster Zug), aufklappbar bis zu den
Zeilen dieser Messung, gemessen am echten Start statt geschätzt, und für die MAIN das, was wirklich
ankommt (→ §5).

**Das Verzeichnis der Bausteine ist veraltet.** Fleet führt ein Register, was es in eine Session legt
und was ohne jedes Stück bricht. Zwei Einträge sind seit heute falsch, und vier Bestandteile fehlen
dort ganz (→ F5). Das ist eine Reparatur ohne deine Entscheidung.

**Nach dem Start zählt die Arbeit.** Jeder Arbeitsschritt fügt 1 200 bis 3 100 Tokens hinzu; nach 30
bis 60 Schritten ist die Arbeit größer als der ganze Start (→ F10).

### Freigaben auf einen Blick

| Frage | Wirkung | Verweis |
|---|---|---|
| Vertragsabschnitt ins Regelbuch von MAIN und Orchestratorin, bevor Z2 deployt wird? | Vertrag erreicht sie sicher; +4 900 statt +10 100 | F3 |
| Korrektur-Heft nach Modus falten (Z5)? | Orch −2 800, Lane −1 100 im ersten Zug | E1 |
| Codex-Absätze hinter einen Verweis? | MAIN −3 800, Orch −1 000 | F6, A.2 |
| Werkzeug-Liste je Rolle erproben? | Lane bis zu mehrere Tausend weniger | H1, §3.1 |
| Gmail, Kalender, Drive, Claude-Doku im Account abschalten? | MAIN/Orch unter −1 000 | H10, H11 |
