# HANDOFF — Themen-Session „hugFaceInci" (Slot 9), 2026-08-27

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Hier steht nur, was daraus
nicht hervorgeht. **Vorgänger-Handoff: `820bf9a`** (Controller, Nachtsession) — er beschreibt
Arbeit, die WEITERLÄUFT und nicht mir gehört, siehe §5.

Diese Session war **kein Controller-Zyklus**, sondern ein Themen-Auftrag: den OpenAI/Hugging-Face-
Vorfall auswerten und daraus ableiten, was Fleet an Struktur lernen kann. Übergabe auf
Owner-Wunsch bei ctx ~28 %.

## 1. Was entstanden ist (fünf Commits)

`bdcc6d3` Ausarbeitung · `e3e5d29` GLM-Gegencheck (kam regulär über eine Lane herein) ·
`a8aa258` Korrekturen daraus · `22dc5c8` fünf Arbeitsaufträge · `1a51291` Selbstprüfung dieser
Aufträge. Die Befunde stehen in den Commit-Bodies, das Programm in
`docs/schwarm-programm-2026-08-27.md`, die Aufträge in
`briefs/schwarm-programm-auftraege-2026-08-27.md`.

Kern in einem Satz: der Schwarm im OpenAI-Vorfall war zu **93 %** ein Negativ-Wissens-Bus über die
**22 %** unlösbaren Tasks — und genau diesen Bus hat Fleet dreimal halb gebaut. Aus vier
Feature-Ideen wurden **eine Vorbedingung, zwei Schnitte, eine Praxis und ein Sensor**.

## 2. WAS GERADE FLIEGT — und die Falle darin

Zwei Lanes laufen, beide `claude`/`opus`/`effort high`, beide um ~10:41 angestoßen:

- **Slot 6** — `fleet/260827083450-376d` — Auftrag **P0** (Claim-Block + Index im
  `mess-notiz`-Skill).
- **Slot 10** — `fleet/260827083510-80fe` — Auftrag **D1** (Stuck-Retention in `tickGit`).

**DIE FALLE, und sie ist der wichtigste Satz dieses Handoffs:** beide Briefe kamen mit
`acceptance: "unobservable"` an und lagen danach **im Composer, nicht abgeschickt** — die Panes
waren beim Paste noch im Boot, der Enter verpuffte. Ich habe von Hand `tmux -L claudefleet
send-keys -t s6 Enter` (und `s10`) nachgeschoben, danach liefen beide an (ctx 7 %, Composer leer,
verifiziert). **Wer nach einem `POST /send` auf eine frisch geöffnete Lane `unobservable` sieht,
muss in die Pane schauen** — der Text über der Composer-Trennlinie ohne Prompt-Marker und ohne
Spinner heißt „liegt da, läuft nicht". Ein Watch rettet das NICHT: eine nie gestartete Lane wird
nie `done-looking`, der Watch feuert also nie, und das Warten sieht wie Arbeit aus.

**Zweite Konsequenz, die mit meinem Slot stirbt:** beide Lanes sollen per
`POST /api/self/fleet-report` berichten. Ihr Empfänger ist mein `kind:"lane"`-Watch auf Slot 9
(`clarificationReceiverFor` → `basis: "lane-watch"`). **Stirbt Slot 9, haben sie keinen Empfänger
mehr und ihr Report läuft in 409.** Wer übernimmt: entweder zügig selbst je einen
`POST /api/self/watch {"kind":"lane","target":6|10}` setzen, oder die Panes direkt lesen. Die
Alternative wäre gewesen, die Lanes programm-gebunden zu öffnen — dann wäre der Empfänger
`program-main` und an keine Session gekoppelt. Für die nächsten drei Aufträge ist das der bessere
Weg.

## 3. Die nächsten Aufträge, in ihrer Reihenfolge und ihrem Warum

Kette **P0 → P0b → A → C**; **D1** läuft unabhängig (fliegt schon).

- **P0b** (Retrofit der 30 Notizen) startet erst, wenn P0 gelandet ist — es richtet 30 Dateien an
  einem Template aus, das noch nicht existiert. **Harness `pi-zai`, Modell `glm-5.3`, effort max**:
  30 Notizen sind ~139k Tokens, das trägt ein 1M-Fenster und ein ~258k-Fenster nicht. Nicht aus
  Gewohnheit auf claude umstellen.
- **A** (ein Context-Pack auf den Index) braucht einen befüllten `INDEX.md`, also P0b.
- **C** (Schwarm-Praxis dokumentieren) kann sofort nach P0 laufen, ist reine Doku.

Die Briefe sind pasteable Abschnitte in `briefs/schwarm-programm-auftraege-2026-08-27.md`. **Beim
Dispatch den Kopfblock mitschicken** (Verbote + Verify-Provenienz) — die Abschnitte verweisen
darauf, und eine Lane, die nur ihren Abschnitt bekommt, hätte ihn nicht. Mein Extraktor trennt an
`\n---\n+(?=## )`, nicht an `\n---\n##`.

## 4. Drei Owner-Entscheidungen, die offen sind

1. **`bereich`** im Claim-Block — freie Tags oder feste Liste? P0 baut freie Tags und liefert die
   gefundenen Tags als Vorlage mit.
2. **N und T** fürs Stuck-Prädikat (D1). Vorgabe zum Draufschlagen: 15 % Fensterzuwachs über
   20 min — geraten, muss an echten Lanes kalibriert werden. D1 baut sie als benannte Konstanten
   an EINER Stelle.
3. **Wer schreibt `.agents/`?** Nicht belegt. Der Kommentar in `.gitignore:49` nennt
   `~/.claude/skills/`, dort liegt aber nur `graphify`. Für P0 folgenlos, offen bevor sich jemand
   auf die Kopie verlässt.

## 5. Was weiterläuft und NICHT mir gehört

Der **Private-repo-j-Akt „Spielbarer Rohbau"** liegt bei der Program-MAIN auf **Slot 5 (Fable)**, und
die defundierte Zeile `7a177954` ist auf `pending` geparkt. Vollständig beschrieben im
Vorgänger-Handoff `820bf9a` — ich habe daran nichts angefasst und nichts entschieden.

## 6. Regelbuch-Drift, die ich im Vorbeigehen gemessen habe

Drei Stellen, alle nachgeprüft, keine davon gefixt (Regelbuch ist ein Generat aus `rulebook.ts`,
und `CLAUDE.md` ist gitignored):

1. **`POST /api/self/watch` kennt fünf Arten, nicht drei.** Der Fehler nennt sie wörtlich:
   `lane`, `merge`, `audit`, **`deploy`**, **`transition`**. Und die Slot-Art heißt `lane`, nicht
   `slot` — `{"kind":"slot"}` wird abgelehnt. Der Abschnitt §Self-scheduling nennt nur drei.
2. **Pane-Ziele heißen `s<N>`, nicht `claude-<N>`.** `tmux -L claudefleet capture-pane -t claude-6`
   antwortet `can't find pane`. `list-sessions` zeigt `s1…s16` plus `srv`.
3. **Die Verify-Zeile in `CLAUDE.md` ist eine Vereinfachung.** `watchdog.sh:91` `VERIFY_CMD` trägt
   zusätzlich den Sentinel-Guard und einen expliziten install-Fehlerzweig statt `&&`. Gleiche
   Schrittfolge, aber das Regelbuch sagt selbst „bei Abweichung gilt die Datei" — und ich hatte die
   vereinfachte Fassung zuerst in alle fünf Briefe geschrieben.

## 7. Zwei Grundlinien, beide am 2026-08-27 gezogen, beide neu ziehbar

- `lane-outcomes.jsonl`: **567 Lane-Ausgänge, 123 `killed-empty` (21,7 %)**, 371 `landed` (65,4 %).
  Erfolgsmaß des Programms: sinkt der Anteil bei Mess- und Audit-Lanes.
- **4 von 211 distinkten `originId`s** haben einen zweiten Lane-Ausgang, keiner einen dritten
  (**1,9 %**). Diese Zahl hat Auftrag **B** (`unfulfillable`) gestrichen. Wiedervorlage nach C —
  und dann **neu messen, nicht erinnern**; das Ledger wuchs während dieser Session um 31 Zeilen.

## 8. Was ich NICHT geprüft habe

Ob die zwei fliegenden Lanes ihre Aufträge richtig verstehen — sie liefen bei Übergabe ~2 min.
Ob `e2e/lanes-lifecycle.ts` wirklich die beste Heimat für D1s Check ist (ich habe den Fetch der
Steward-Sicht dort gefunden, die Datei aber nicht gelesen; der Brief sagt der Lane, sie soll eine
bessere Familie melden statt eine neue Datei anzulegen). Und keinen einzigen Suite-Lauf jenseits
von `bun e2e/pins.ts` — alle fünf Commits dieser Session sind reine Prosa und liefen bewusst die
Docs-Kurzkette.
