# HANDOFF — Themen-Session „hugFaceInci" (Slot 9), Abschluss 2026-08-29

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Vorgänger dieser Session:
`3c209d7` (Fassung 2 vom 08-27, dort das Schwarm-Programm im Detail).

Diese Session hatte zwei Leben: am **08-27** das Schwarm-Programm aus dem OpenAI/Hugging-Face-
Vorfall (abgeschlossen), am **08-29** eine einzelne Audit-Adjudikation (offen). Für die Nachfolge
zählt fast nur §1.

## 1. DER OFFENE PUNKT: ein Remote-Rot, das ich zweimal beurteilt habe

`post-land-audits.jsonl`, Zeile `at=1787999568052`, `remote=second-host`, rot, `748ec97`.
**Zwei Adjudikationen im Ledger, das jüngere korrigiert das ältere:** erst `stale-test`, dann
`unknowable`. Herleitung und mein Fehler: `docs/messungen/2026-08-29-adjudikation-second-host-401.md`
(`40f62f7`).

**Was du wissen musst, bevor du das anfasst:**

- **`mainSha` in einer Audit-Zeile ist eine Behauptung des Servers, keine Messung des Helfers.**
  `server.ts#buildHelperBundle` baut das Bundle aus `refs/heads/main` **zum Bau-Zeitpunkt**. Wandert
  main zwischen Land und Claim, auditiert der Helfer einen anderen Baum als die Zeile sagt. Genau
  das ist hier nicht auszuschließen: am 08-29 lief eine zweite Session schwer auf `server.ts` und
  `e2e/programs.ts` (`0cd5e23` allein +453/+320; `972dd48` um 12:24 **mitten im Lauf** 12:22–12:32).
- **Mein Fehler, damit du ihn nicht wiederholst:** ich habe `050f96c..748ec97` geprüft (nur Doku +
  helper-daemon) und daraus geschlossen, der Second-host habe diesen Baum gesehen. Das folgt nicht —
  es zeigt nur, dass der auditierte **SHA** unschuldig ist, nicht der auditierte **Baum**.
- **Was weiterhin steht:** der `task-spawn`-Block stammt vom 08-22 (`096c577`) und war in beiden
  Bäumen — grün bei `050f96c` (3133 Checks, 0 Fails, Mac), rot bei `748ec97` (Linux, erster
  Remote-Lauf, der überhaupt Checks erreichte). Die Owner-Tür `(1d)` ist PASS; rot sind nur die vier
  Filings über den **Self-Token**. `ran: 12` ist ein Tail-Artefakt, kein Deckungsmaß.

**Die drei Aufträge, in dieser Reihenfolge:**

0. **Den Klon-Stand feststellbar machen** — der Helfer meldet den SHA, den er tatsächlich
   ausgecheckt hat, die Ledger-Zeile führt ihn neben `mainSha`. Solange das fehlt, ist **jedes**
   Remote-Rot über einem parallel bearbeiteten Repo prinzipiell unentscheidbar. Das ist der
   eigentliche Befund und der einzige, der die Klasse schließt.
1. `e2e/programs.ts`: `successorToken = … ?? ""` durch einen eigenen `check()` auf die Voraussetzung
   ersetzen, damit ein fehlender Token als **Harness-Fehler** fällt und nicht als 401 des Produkts.
2. Den Audit auf demselben Tip auf dem Second-host **wiederholen** — erst dann ist die Ursache
   gemessen statt geschlossen.

## 2. Abgeschlossen am 08-27: das Schwarm-Programm

Alles gelandet: **P0** (`c098d87`, Skill-Template mit sechs Front-Matter-Feldern + `INDEX.md`) ·
**P0b** (`2d88521`, 31 Notizen retrofittet) · **C** (`6ee13a3`, `docs/schwarm-praxis.md`) ·
**§11.2i** (`dda507d`, elfte Flake-Familie, Fix vorgeschlagen nicht gebaut). **B gestrichen** nach
Messung (4/211 originIds = 1,9 % Wiederholer). Programm: `docs/schwarm-programm-2026-08-27.md`,
Aufträge: `briefs/schwarm-programm-auftraege-2026-08-27.md`.

**A und D1 sind ungeklärt.** Beide waren am 08-27 fertig und nicht gelandet (A: Context-Pack, Rot
war dreimal §11.2i unter Kontention; D1: Stuck-Sensor, geblockt hinter fremder uncommitteter
`server.ts`-Arbeit). Ihre Worktrees existieren heute nicht mehr in der Slot-Liste — **prüf
`git branch --list 'fleet/2608270*'` und `lane-outcomes.jsonl`, bevor du sie für verloren hältst
oder neu baust.** Das habe ich nicht nachgezogen.

## 3. Operative Lehren dieser Session (jede mehrfach gesehen)

1. **`acceptance: "unobservable"` nach `POST /send` auf eine frische Lane = in die Pane schauen.**
   Dreimal passiert. Der Brief liegt im Composer, der Enter verpuffte im Boot. Fix von Hand:
   `tmux -L claudefleet send-keys -t s<N> Enter`, dann ctx-% prüfen. Panes heißen **`s<N>`**, nicht
   `claude-<N>`. Ein Auto-Nachschieben im `sendText`-Pfad wäre ein eigener kleiner Auftrag.
2. **Ein Direkt-Commit auf main während eines laufenden Lands killt den Fast-Forward** — auch ohne
   gemeinsame Datei. Reihenfolge: erst main-Commits, dann landen, nie beides.
   `.claude/skills/…` ist bei `ruleFor` **`conservative-default`**, nicht Doku — daher 253 s
   Land-Fenster statt 0,5 s.
3. **`last.status:"interrupted"` + `running:true` = Startmarker ohne Verdikt**, kein Abbruch.
4. **Adjudikations-Notizen sind auf 300 Zeichen gedeckelt** (`MAX_ADJUDICATION_NOTE`). Die
   Herleitung gehört in eine Messnotiz, die Note trägt den Zeiger.

## 4. Regelbuch-Drift, gemessen und NICHT nachgezogen

`rulebook.ts` ist getrackt → volle Kette; sammeln und in EINEM Land nachziehen:
„Zehn Flake-Familien" → elf (§11.2i) · `POST /api/self/watch` kennt fünf Arten
(`lane|merge|audit|deploy|transition`), die Slot-Art heißt `lane` nicht `slot` · Panes heißen
`s<N>` · die Verify-Zeile in `CLAUDE.md` ist eine Vereinfachung von `watchdog.sh:91` (dort
zusätzlich Sentinel-Guard und expliziter install-Fehlerzweig).

## 5. Grundlinien (Schnappschüsse — vor Wiederverwendung neu ziehen)

`lane-outcomes.jsonl` am 08-27: 567 Ausgänge, 123 `killed-empty` (21,7 %), 371 `landed` (65,4 %) —
das Erfolgsmaß des Schwarm-Programms. Wiederholer: 4/211 originIds (1,9 %).
`docs/messungen/INDEX.md` steht bei 34 Zeilen; das Format ist in Gebrauch.
