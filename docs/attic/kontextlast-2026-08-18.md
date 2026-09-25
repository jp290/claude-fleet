# Die Startlast einer Session — gemessen, zerlegt, und was daran schrumpfen darf

**Status:** Befund + Schnitt-Vorschlag. Nichts davon ist umgesetzt. Der Schnitt selbst ist ein
eigener Auftrag (§7), weil `CLAUDE.md` gitignored ist und ein Fehlschnitt nicht über git
zurückholbar wäre.

**Anlass:** Owner-Beobachtung 2026-08-18 — „es kommt mir so vor, als würde meine Claude-Code-Session
regulär mit 10 % an Kontext starten". Sie tut es. Auf die Kommastelle.

---

## 1. Der Befund

Erster Turn dieser MAIN-Session (Slot 8, Haupt-Checkout, Opus 5 1M), aus ihrem eigenen Transkript:

```
input_tokens 2 + cache_read 24.106 + cache_creation 74.260  =  98.368 Tokens
                                                              = 9,8 % von 1.000.000
```

**Reproduzierbar ohne zu schätzen** — die Zahl steht im Transkript, sie muss nicht geraten werden:

```sh
python3 - <<'EOF'
import json, glob, os, sys
p = sorted(glob.glob(os.path.expanduser(
    "~/.claude/projects/-Users-owner-claude-fleet/*.jsonl")),
    key=os.path.getmtime, reverse=True)[0]
for line in open(p):
    u = (json.loads(line).get("message") or {}).get("usage")
    if not u: continue
    print(u["input_tokens"] + u.get("cache_read_input_tokens", 0)
          + u.get("cache_creation_input_tokens", 0)); break
EOF
```

Dieselbe Messung über alle Projekt-Transkripte der Maschine, jeweils erster Turn:

| Projekt | Startlast |
|---|---|
| `claude-fleet` Lanes (9 gemessen, 2026-08-16..18) | 96.000 – 105.410 |
| **`claude-fleet` MAIN** | **98.368** |
| `private-repo-f`, `private-repo-c` | ~42.000 |
| `pocock-research`, `[privates Owner-Repo]` | ~40.500 |
| `private-repo-b` | ~37.900 |
| `/Users/owner` (nur globale Regeln) | ~46.500 |

**Die Differenz ist das Regelbuch.** Rund 40 k sind Harness-Grundlast, die jedes Projekt zahlt
(Tool-Schemata, die Skill-Liste aus sechs Plugins, Agent-Typen, System-Prompt). Die übrigen ~58 k
sind fleet-spezifisch — und davon ist eine einzige Datei fast alles.

---

## 2. Was tatsächlich geladen wird

| Datei | Größe | geladen? |
|---|---|---|
| `~/.claude/CLAUDE.md` | 8,0 KB | ja, in jedem Projekt |
| **`claude-fleet/CLAUDE.md`** | **109.675 B / 1154 Zeilen** | **ja** |
| `claude-fleet/.claude/CLAUDE.md` | 226 B | ja |
| `claude-fleet/AGENTS.md` | 9.572 B | **nein** — siehe §3.1 |
| `memory/MEMORY.md` (+ 32 Memory-Dateien) | 5,8 KB | ja |

Alle 25 übrigen CLAUDE/AGENTS-Dateien dieser Maschine liegen zwischen 596 B und 8,1 KB. Der
zweitgrößte Regelbuch-Eintrag überhaupt ist `~/.hermes/hermes-agent/AGENTS.md` mit 16,6 KB.
**`claude-fleet/CLAUDE.md` ist 6,6× so groß wie der zweitgrößte und ~14× ein typisches
Projekt-Regelbuch.** Sie liegt zusätzlich als Spawn-Kopie in jedem Lane-Worktree (aktuell sieben);
jede Lane zahlt sie erneut.

Aufteilung innerhalb der Datei (`awk` über die `## `-Abschnitte):

| Abschnitt | Bytes | Zeilen | Anteil |
|---|---:|---:|---:|
| `## Deploy` | 46.401 | 466 | **42 %** |
| `## Lane discipline` | 27.738 | 284 | 25 % |
| `## Einstieg für eine frische MAIN-Session` | 22.900 | 227 | 21 % |
| `## Self-scheduling from inside a session` | 7.816 | 109 | 7 % |
| `## Loader-Vertrag` | 1.805 | 27 | 2 % |
| `## Die stehende Supervisor-Rolle` | 1.768 | 22 | 2 % |
| `## graphify` | 1.231 | 17 | 1 % |

---

## 3. Zwei Nebenbefunde

### 3.1 `AGENTS.md` wird für eine Claude-Session gar nicht geladen

Im System-Prompt dieser Session stehen genau drei Dateien: das globale `CLAUDE.md`, das
Projekt-`CLAUDE.md` und `.claude/CLAUDE.md`. `AGENTS.md` ist **nicht** dabei — gemessen an dieser
Session, nicht aus der Doku abgeleitet.

Der Loader-Vertrag (`CLAUDE.md:5`) macht daraus trotzdem die allererste Anweisung jeder Session:
„Lies `AGENTS.md` vollständig". Jede Session zahlt die 9,6 KB also **zusätzlich** als
Read-Tool-Ausgabe, statt sie kostenlos im gecachten Prompt-Präfix zu haben. Für pi und codex ist es
umgekehrt: die laden `AGENTS.md` automatisch und sehen `CLAUDE.md` nie (`e2e/pins.ts:386-391` sagt
es ausdrücklich).

Das ist keine Byte-Frage, sondern eine Struktur-Frage — und sie gehört vor den Schnitt beantwortet:
**welche Hälfte ist das Startwissen und welche das Nachschlagewerk?**

### 3.2 Ein erheblicher Teil der Datei erklärt sich selbst für überholt

29 Zeilen tragen explizite Verfalls-Marker („KORREKTUR", „ÜBERHOLT", „HISTORIE", „hier stand bis …",
„war falsch"). Das ist Absicht und meist wertvoll — die Korrektur *neben* dem korrigierten Satz ist
genau die Bauform, die dieses Repo teuer gelernt hat.

Es gibt aber Blöcke, in denen die Korrektur den ganzen Rest zu Messprotokoll erklärt und der Rest
trotzdem in voller Länge stehen bleibt:

| Zeilen | Bytes | Inhalt |
|---|---:|---|
| 726–740 | 1.463 | „KORREKTUR 2026-08-12 … FULL ACCESS IST DER NORMALZUSTAND" — erklärt die drei folgenden Blöcke zu Historie |
| 741–756 | 1.669 | Codex' Schreib-vs-Lese-Zaun (vom Block darüber als HISTORIE markiert) |
| 757–792 | 3.596 | „Eine Codex-Lane kann nicht committen" (als Betriebsanleitung überholt) |
| 793–842 | 5.009 | Der pi-Zaun via `sandbox-exec` (entfernt seit `fc8f4ad`) |
| **Summe Zaun-Archäologie** | **11.737** | |
| 917–928 | 1.203 | „Die Gast-Konsole ist ENTFERNT" |
| 929–942 | 1.500 | „Ein Share hat keinen Modus mehr" |
| **Summe entfernte Features** | **2.703** | |

**14.440 B — 13 % der Datei — beschreiben Zustände, die es nicht mehr gibt.** Als Messbeleg sind sie
korrekt und aufbewahrenswert. Als Startwissen jeder Session und jeder Lane sind sie Ballast.

---

## 4. Was der Befund NICHT sagt

Vier Abgrenzungen, damit aus einer Messung kein Kahlschlag wird:

1. **Die ~40 k Harness-Grundlast sind hier nicht angreifbar.** Tool-Schemata und Skill-Liste sind
   Harness-Fläche, nicht Repo-Fläche. Wer die 98 k halbieren will, halbiert nicht diese Hälfte.
2. **Die Dichte des Regelbuchs ist kein Versehen.** Es ist ein Lektionen-Register: fast jede Zeile
   hat einen bezahlten Fehler hinter sich, und mehrere Absätze sagen ausdrücklich, was sie einmal
   gekostet haben. Kürzen heißt hier **verschieben**, nicht löschen.
3. **`CLAUDE.md` ist gitignored** (`.gitignore`) — es gibt keinen `git checkout --` als Netz und
   keine Historie, aus der man einen Fehlschnitt zurückholt. Vor jedem Eingriff eine Kopie außerhalb
   des Baums.
4. **Eine Lane kann diese Datei nicht landen.** Sie bekommt beim Spawn nur eine Kopie; ihre Änderung
   taucht in keinem `git status` auf und stirbt mit dem Worktree. Der Schnitt selbst gehört in den
   Haupt-Checkout. Was eine Lane sehr wohl landen kann, sind die *getrackten* Zieldateien unter
   `docs/`.

---

## 5. Der Schnitt-Vorschlag

Ein Prinzip, drei Bewegungen. Das Prinzip: **nichts wird gelöscht, alles zieht um.**

- **BETRIEB** — was eine Session in den ersten fünf Minuten braucht, um nichts kaputt zu machen:
  bleibt in `CLAUDE.md`, im Präsens, ohne die Geschichte davor.
- **BELEG** — die Messung, die die Regel begründet: zieht nach `docs/` bzw. `docs/attic/`, mit
  Zeiger aus der Regel heraus. Genau die Bauform, die `docs/verify-tiering.md` §11.2b schon für die
  Flake-Familien hat („damit die Zahl nicht an zwei Stellen altert").
- **TOT** — beschreibt einen Zustand, den es nicht mehr gibt, und keine heute gültige Regel hängt
  daran: eine Zeile im Attic-Dokument, sonst nichts.

Erste Kandidaten, nach Belegkraft geordnet:

1. **Die Zaun-Archäologie, Z. 726–842 (11.737 B)** → `docs/attic/harness-zaun-messungen.md`. Der
   Block über ihnen sagt selbst „als Messbelege korrekt, als Betriebsanleitung überholt". In
   `CLAUDE.md` bleibt der eine gültige Satz: Full Access ist der Normalzustand, `container` ist der
   Sonderfall, Lese-Reichweite = Provider-Reichweite ist die offene Vertrauensfrage.
2. **Entfernte Features, Z. 917–942 (2.703 B)** → `docs/attic/entfernte-flaechen.md`. Was bleiben
   muss, ist knapp: Gast-Konsole und Share-`interact` existieren nicht mehr, „guest" heißt im Code
   weiterhin *Share-Zuschauer*, und beim Nachpflegen keine gelöschten Pfade in Backticks (Pfad-Pin).
3. **`## Deploy` insgesamt (46.401 B)** ist mehrheitlich Adapter-Referenz — Harness-Probe-Mengen,
   Modell-Tiers, Repo-Worker, Codex-Recovery, Container. Das ist Nachschlagewissen für eine Lane,
   die genau dort arbeitet, kein Startwissen für jede Session. Kandidat für
   `docs/harness-adapter.md` mit einem kurzen Zeiger-Abschnitt im Regelbuch. **Der größte Hebel und
   zugleich der einzige, der echtes Urteil verlangt** — hier stehen Sätze, die einen Live-Server
   töten können, wenn sie jemand nicht liest.
4. **Die „hier stand X, und das war falsch"-Konstruktion** in eine Präsens-Aussage umschreiben,
   *wo* die Lehre bereits anderswo steht. „Bei Widerspruch gilt der Code" steht dreimal.

**Realistisches Ziel:** 109,7 KB → ~35–40 KB, ohne dass eine einzige Regel verschwindet.
Erwartete Startlast danach: **~70 k statt 98 k**, in jeder MAIN-Session *und* jeder Lane.

---

## 6. Die Verifikation — sie existiert bereits und ist hart

`e2e/pins.ts` §6 („CLAUDE.md — the one steering document with no drift pin at all") prüft zwei
Dinge, die genau die Fehlerart eines Umzugs treffen:

- `every path CLAUDE.md cites still resolves`
- `every grep CLAUDE.md sends the reader on still finds something`

Dreiwertig gebaut: in einer Lane sind die Befunde WARN (ihre Kopie ist ein Spawn-Snapshot), **im
Haupt-Checkout ist `state=current` und die Regel wird HART gehalten** — und `bun e2e/pins.ts` ist die
erste Stufe des Land-Gates. Ein Schnitt, der einen Zeiger ins Leere hinterlässt, fällt also auf.

Baseline heute, vor jedem Eingriff (`bun e2e/pins.ts`, Haupt-Checkout):

```
PASS  CLAUDE.md yields anchors of both classes  (state=current; 106 path(s), 5 grep errand(s))
PASS  every path CLAUDE.md cites still resolves
PASS  every grep CLAUDE.md sends the reader on still finds something
ALL PASS
```

**Done-Kriterium des Schnitts, in einem Satz:** `bun e2e/pins.ts` steht im Haupt-Checkout weiter auf
`ALL PASS`, jede in §5 verschobene Regel ist in ihrem Zieldokument wiederauffindbar, und die
Startlast einer frisch geöffneten Session (§1-Kommando) liegt messbar unter 75.000 Tokens.

---

## 7. Die Kette — wer was macht, und warum in dieser Reihenfolge

Owner-Vorgabe 2026-08-18, wörtlich: *„Claude Fleet sollte seine Funktionsweise behalten aber es gibt
mit sicherheit einiges das abgespeckt werden kann"* — und die Reihenfolge: Supervisor prüft nach,
dann eine GLM-Session, danach eine Worker-Session, die es vernünftig fixt.

**Schritt 0 — 🧿 Supervisor (Slot 7).** Prüft diesen Befund gegen den Baum nach, entscheidet die
eine Frage, die keine Lane entscheiden darf (§3.1: welche Hälfte ist Startwissen?), und setzt die
Schnittlinie in §5. Der Auftragstext steht in §8.

**Schritt 1 — GLM-Lane (`pi-zai`, `glm-5.3`, 1M Fenster, `allowsLanes: true`).** Read-only
Inventur: jede der 1154 Zeilen genau einem Block zugeordnet, jeder Block als BETRIEB / BELEG / TOT
klassifiziert, mit Zielort. Ergebnis ist ein **getracktes** `docs/rulebook-inventar-2026-08-18.md` —
das kann eine Lane landen, `CLAUDE.md` selbst nicht (§4.4). GLM ist hier richtig, weil die Aufgabe
mechanisch, erschöpfend und groß ist: 110 KB in ein 1M-Fenster, ohne dass jemand stichprobt.
Hartes Done-Kriterium, das die Vollständigkeit erzwingt: **die Byte-Summe aller Blöcke muss 109.675
ergeben und jede Zeile 1–1154 genau einmal vorkommen.** `automatable: false` — die Lane wird
attended gestartet.

**Schritt 2 — Worker-Session (claude, Haupt-Checkout, NICHT als Lane).** Führt den Schnitt aus:
BELEG-Blöcke in die Zieldokumente, Restsätze ins Präsens, Zeiger gesetzt. Vorher `cp CLAUDE.md`
außerhalb des Baums (§4.3). Verifiziert mit §6 und meldet die neue Startlast als Zahl.

Warum zwei Sessions und nicht eine: die Inventur ist Fleißarbeit mit einem prüfbaren Abschluss, der
Schnitt ist Urteil an einer Datei ohne Netz. Das ist dieselbe propose/promote-Trennung, die dieses
Repo überall sonst schon fährt — der Klassifizierer schreibt nicht den Anker, an dem er gemessen
wird.

---

## 8. Der Auftragstext an die Supervisor-Session

> **Kontext-Startlast: nachprüfen und die Kette aufsetzen.** Befund liegt als
> `docs/kontextlast-2026-08-18.md` auf main. Kurzfassung: eine MAIN-Session in `claude-fleet` startet
> mit **98.368 Tokens** (9,8 % von 1M), andere Projekte auf derselben Maschine mit 35–46 k. Die
> Differenz ist praktisch allein `CLAUDE.md` — 109.675 B / 1154 Zeilen, 6,6× so groß wie das
> zweitgrößte Regelbuch der Maschine, und in jedem der sieben Lane-Worktrees noch einmal.
>
> **Dein Teil, in dieser Reihenfolge:**
>
> **(1) Nachprüfen, nicht glauben.** Die Zahl steht in jedem Transkript — §1 des Dokuments enthält
> das Kommando. Zieh sie aus einer **anderen** Session als meiner (Slot 8, `2de61961`), damit die
> Messung nicht an einem Ausreißer hängt. Prüf ebenso §3.1 (`AGENTS.md` stand nicht im System-Prompt
> meiner Session — gilt das für deine auch?) und die Blocktabelle in §3.2.
>
> **(2) Eine Frage entscheiden, die keine Lane entscheiden darf:** `CLAUDE.md` ist Claude-Startwissen,
> `AGENTS.md` ist das, was pi und codex laden — und heute schickt der Loader-Vertrag jede
> Claude-Session als Allererstes in eine Datei, die sie nicht geladen bekommen hat. Welche Hälfte ist
> Startwissen, welche Nachschlagewerk? Ohne diesen Entscheid schneidet der Worker ins Blaue.
>
> **(3) Die Schnittlinie setzen.** §5 nennt vier Kandidaten mit Bytes. Kandidat 3 (`## Deploy`,
> 46.401 B = 42 % der Datei) ist der größte Hebel *und* der einzige, in dem Sätze stehen, deren
> Nichtlesen einen Live-Server kostet. Schneid die Liste dort ab, wo die Owner-Vorgabe erfüllt ist —
> sie lautet wörtlich „Claude Fleet sollte seine Funktionsweise behalten aber es gibt mit sicherheit
> einiges das abgespeckt werden kann", nicht „mach es klein".
>
> **(4) Schritt 1 als GLM-Lane briefen** (`pi-zai`/`glm-5.3`, `allowsLanes: true`,
> `automatable: false` → attended starten). Read-only Inventur nach `docs/rulebook-inventar-2026-08-18.md`
> — getrackt, damit die Lane sie landen kann; `CLAUDE.md` selbst kann sie **nicht** landen (Spawn-Kopie,
> gitignored, stirbt mit dem Worktree). Hartes Done-Kriterium, das Stichproben ausschließt: Byte-Summe
> aller Blöcke = 109.675, jede Zeile 1–1154 genau einmal, jeder Block mit Verdikt BETRIEB/BELEG/TOT
> und Zielort. Ein Kontext-Hinweis gehört in den Brief: GLM hat 1M, aber `graphify` gibt es in einer
> Lane nicht, und `rg` ist auf dieser Datei **blind** — sie ist gitignored, also `rg -uu` oder `grep`.
>
> **(5) Schritt 2 erst danach: Worker-Session im Haupt-Checkout, nicht als Lane.** Vorher
> `cp CLAUDE.md` außerhalb des Baums — es gibt kein git-Netz. Verifikation ist gebaut und hart:
> `e2e/pins.ts` §6 hält im Haupt-Checkout (`state=current`) die beiden Regeln „jeder zitierte Pfad
> löst auf" und „jeder grep-Auftrag findet etwas" **hart**, und `bun e2e/pins.ts` ist die erste Stufe
> des Land-Gates. Baseline vor dem Eingriff: `ALL PASS`, 106 Pfade, 5 grep-Aufträge.
>
> **Done für die ganze Kette:** `bun e2e/pins.ts` im Haupt-Checkout weiter `ALL PASS`, jede
> verschobene Regel in ihrem Zieldokument wiederauffindbar, Startlast einer frischen Session messbar
> unter 75.000 Tokens — und die Funktionsweise unangetastet.
>
> **Zwei Fallen, die ich beim Messen selbst gefunden habe:** `rg` respektiert `.gitignore`, und
> gitignored sind hier ausgerechnet `CLAUDE.md`, `fleet.json` und alle drei Ledger — ein `rg` darüber
> liefert kein Fehlerergebnis, sondern ein leeres. Und ein Drift, den ich beim Nachsehen
> mitgemessen habe: dein Pane-Footer zeigt **Opus 5**, dein Slot-Datensatz führt **`fable`**, `effort`
> steht dort auf `null`. Der Owner-Entscheid vom 2026-08-18 ist in der Pane angekommen, im Datensatz
> nicht — genau die Drift, die `CLAUDE.md:541` beschreibt. Für dich folgenlos, für deine **Nachfolge
> nicht**: `succeedSupervisor` reicht `model` und `effort` des Datensatzes wörtlich weiter. Zieh es in
> der Pane nach, bevor du übergibst.

---

## 9. Zustellung — warum dieser Auftrag nicht per `POST /send` in die Pane ging

Beim Nachsehen, ob Slot 7 überhaupt frei ist, stand in seinem Composer ein **ungesendeter
Owner-Entwurf**: „sag bescheid wenn sie fertig ist". Ein `POST /send` ist paste-buffer + Enter ohne
Clearing — der Auftragstext wäre mit diesem Entwurf verschmolzen und beides wäre beschädigt
angekommen. Genau die Gefahr, die `CLAUDE.md` unter „Self-scheduling" und im Supervisor-Abschnitt
zweimal benennt; hier war sie live.

Der Auftrag aus §8 wird darum **vom Owner zugestellt**, nicht von einer Session. Wer ihn später
maschinell zustellen will, prüft vorher den Composer der Zielpane (`capture-pane -p | tail`) und
liest ihn **zweimal im Abstand von Sekunden**: wächst der Text, tippt ein Mensch.
