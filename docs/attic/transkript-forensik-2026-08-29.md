# Eine vergangene Konversation wiederfinden und in einen Slot zurückholen

**Datiert 2026-08-29.** Anlass: „finde die Session, in der wir über den HuggingFace-Vorfall
gesprochen haben — ich glaube, das war sogar main + lane". Gefunden in vier Werkzeugaufrufen,
zurückgeholt in fünf weiteren. Dieses Dokument hält beide Hälften fest: den **Suchweg** (samt der
Abkürzung, die ich erst hinterher gemessen habe) und den **Rückholweg** (samt der Fleet-Lücke, um
die er herumbaut). Zwei Messungen am Rand korrigieren eine stehende Regelbuchzeile.

**Gegengelesen** von einer GLM-Lane (`465130b`): `docs/messungen/2026-08-29-glm-review-transkript-forensik.md`. Ihre drei Korrekturen stehen als Zitatblöcke an Ort und Stelle (§3, §4, §6) — dieses Dokument ist damit an drei Stellen revidiert, nicht bestätigt.

---

## 1. Das Ergebnis, damit es nicht in der Methode untergeht

| | |
|---|---|
| Session-Id | `665ac9d3-3a14-4dee-ad00-a5490449e5e4` |
| Transkript | `~/.claude/projects/-Users-owner-claude-fleet/665ac9d3-….jsonl` (2,89 MB, 1712 Einträge) |
| cwd | `/Users/owner/claude-fleet` (Haupt-Checkout, MAIN-Session) |
| Zeitraum | 2026-08-27 06:33 → 16:39 UTC |
| Einstieg des Owners | „openAI hat gestern Abend mehr info's zu ihrem huggingfaceReport veröffentlicht … werte den Tweet zusammen mit dem Artikel aus. Benutz auch ruhig Agenten." |
| Zweiter Auftrag | „lass uns gucken, ob wir vom Prinzip dahinter, vllt des Schwarms, etwas lernen können und claude fleet's capabilities erhöhen" |
| main + lane? | **beides.** 7 Subagenten in der MAIN, danach fünf echte Fleet-Lanes (Slots 10, 6, 14, 8, 1) |
| Quellen der Subagenten | METR-Untersuchung `metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/`; OpenAI-Post `openai.com/index/hugging-face-incident-and-the-road-ahead/` (gab WebFetch 403) |
| Artefakte im Baum | `docs/schwarm-programm-2026-08-27.md` · `docs/schwarm-praxis.md` · `docs/messungen/2026-08-27-gegencheck-schwarm-programm.md` |
| Offen bei Abbruch | zwei Land-Züge ohne Wecker (A neu landen, sobald suite-frei; D1 landen, sobald `server.ts` committet) |

Die vier „Nähte", auf die die MAIN ihre Subagenten ansetzte, sind der eigentliche Ertrag der
Session: brief read-side · task lifecycle + unsolvable · non-landing swarm work · stuck-lane sensor.

---

## 2. Das Korpus, in dem gesucht wird

Gemessen 2026-08-29 auf dieser Maschine:

```
~/.claude/projects/     436 Projektverzeichnisse
                       2048 *.jsonl  (Haupt-Transkripte + subagents/ + workflows/)
                                     — Schnappschuss: zwischen zwei Zählungen dieser Sitzung
                                       schwankte die Zahl 2046..2048, das Korpus wächst beim Zählen
                       1434 MB
```

Ein Verzeichnisname ist der cwd mit allen Nicht-Alnum-Zeichen zu `-` ersetzt
(`server.ts#projDir`) — `/Users/owner/claude-fleet` → `-Users-owner-claude-fleet`. Ein
Lane-Worktree bekommt darum ein EIGENES Verzeichnis
(`-Users-owner-claude-fleet-worktrees-fleet-260827…`), und Subagenten liegen unter
`<session-id>/subagents/agent-*.jsonl`.

Jede Zeile ist ein JSON-Objekt. Die Felder, die eine Suche tragen:

| Feld | trägt |
|---|---|
| `type` | `"user"` · `"assistant"` · `"mode"` · … — **der selektivste Schnitt überhaupt** |
| `timestamp` | ISO-8601, UTC |
| `sessionId` | die Id, unter der die Zeile geschrieben wurde |
| `cwd` | das Arbeitsverzeichnis der Session |
| `message.content` | Liste von Blöcken (`text`, `tool_use`, `tool_result`) oder String |

Wichtig für jede Zählung: `type:"user"` ist **nicht** dasselbe wie „der Mensch hat getippt". Unter
`user` laufen auch Tool-Ergebnisse, `<task-notification>`-Blöcke, `<system-reminder>`-Einschübe,
`<local-command-stdout>` und der Gründungsprompt jedes Subagenten. Der Schnitt, der wirklich auf
Owner-Text zeigt, ist `type=="user"` **plus** ein Textblock, der das Muster selbst enthält, **minus**
die `<task-notification>`-Zeilen.

---

## 3. Der Weg, den ich wirklich ging — mit der Stelle, an der ich Zeit verlor

| # | Aufruf | Ertrag | Urteil |
|---|---|---|---|
| 1 | `ls ~/.claude/projects/ \| head -50` + `du -sh` | 436 Namen, 1,4 G | **fast wertlos.** Verzeichnisnamen sind cwd-Slugs; „huggingface" steht in keinem |
| 2 | `grep -rilE 'hugging ?face' --include='*.jsonl'` | 44 Dateien | zu viele zum Lesen, ohne Rang. **Das `-E` ist nicht kosmetisch** — ohne es gilt BRE, `?` ist dort ein LITERAL, und derselbe Aufruf liefert genau **1** Datei (nachgemessen, Shim wie echtes Binary). Eine Zeile, die sich wie ein Ergebnis liest und keines ist |
| 3 | `for f in …; do grep -ioc …` | **leer** | **Fehlschlag:** `-o` und `-c` schließen sich aus, jede Zeile kam ohne Zahl. Eine ganze Runde verbrannt |
| 4 | Python-Pass: nur `type=="user"`, Muster im Textblock | 11 Zeilen, Antwort auf einen Blick | **das war der Schritt, der es tat** |
| 5 | zweiter Python-Pass auf die Gewinnerdatei | Agenten, Dateien, Zeitspanne | Verifikation, nicht Suche |

Schritt 4 war die ganze Suche. Schritte 1–3 waren Anlauf. Die Selektivität, die ich nicht genutzt
habe, obwohl ich das Schema kannte:

```
1434 MB Rohtext
  → 44 Dateien      (Textsuche)
  → 11 Zeilen       (Strukturschnitt type=="user" + Textblock + kein task-notification)
  →  1 Session      (die Zeile mit Owner-Sprache statt Brief-Sprache)
```

**Die Lehre in einem Satz: das Korpus hat ein Schema, also schneide zuerst am Schema und erst
danach am Text.** Wer mit `grep` anfängt, bekommt 44 Dateien und keinen Grund, eine davon zuerst zu
öffnen; wer mit `type=="user"` anfängt, bekommt 11 Zeilen, von denen die richtige sich selbst nennt.

### Das Skript, das der erste Aufruf hätte sein sollen

Liegt als `find-conv.py` im Repo. Gemessen **10,65–10,93 s** über die vollen 1434 MB
(drei Läufe, warmer Cache), 11 Treffer, keine Vorbedingung außer python3. Der Prototyp im Messvergleich
unten war eine `glob`-Variante desselben Schnitts und lag bei 8,5–8,9 s — der Unterschied ist der
Baumlauf, nicht der Filter.

```
python3 find-conv.py 'hugging ?face'
2026-08-27T06:33:10.150Z | -Users-owner-claude-fleet/665ac9d3-….jsonl
    Alles klar, openAI hat gestern Abend mehr info's zu ihrem huggingfaceReport …
```

Erkennungsmerkmal in der Ausgabe: eine **Owner-Zeile** klingt wie Sprache („Alles klar, …", Tippfehler,
zweite Person); ein **Subagenten-Gründungsprompt** klingt wie ein Brief („CONTEXT YOU CANNOT DERIVE:
- Project: …"). Beide stehen als `type:"user"` in der Datei, und nur der Ton trennt sie.

---

## 4. Der „offensichtliche" Vorfilter ist 2,4× LANGSAMER — und warum

Der naheliegende Schnitt: erst `grep -rl` die 44 Kandidaten holen (57 MB statt 1434 MB), dann nur
die parsen. Gemessen, zweimal, hintereinander:

| Variante | Laufzeit | Treffer |
|---|---|---|
| Python-Vollpass über alle 2048 Dateien | **8,90 s / 8,46 s** | 11 |
| Python mit `grep -rl`-Vorfilter | **19,51 s / 20,45 s** | 11 |

Instrumentiert: der Vorfilter selbst kostet **20,69 s**, das Lesen der 44 Kandidaten danach
**0,17 s**. Der `grep` im Subprozess ist also 100–500× langsamer als derselbe Aufruf aus der Shell
(dort 0,04–0,24 s). Locale ist es nicht (`LC_ALL=C` ändert nichts: 20,18 s). Die Ursache steht im
nächsten Abschnitt und ist der eigentliche Fund des Tages.

> **KORREKTUR (Review-Lane, `docs/messungen/2026-08-29-glm-review-transkript-forensik.md`, und von
> mir nachgemessen):** die Rangfolge oben gilt **nur im Python-Subprozess**, und der Satz „der
> Vorfilter ist langsamer" darf nicht ohne diesen Zusatz zitiert werden. **Aus der Shell ist der
> Vorfilter der schnellste Weg von allen**, weil dort der Shim greift:
> `grep -rilE … | python3 <schema-schnitt>` läuft in **0,75–1,28 s** gegen 10,7 s Vollpass. Die
> ursprüngliche Messung war richtig und ihre Verallgemeinerung falsch — der Unterschied ist nicht
> „grep vs. Python", sondern **wer den `grep` startet**.

---

## 5. `grep` ist in einem Claude-Code-Bash-Aufruf nicht `grep`

`which grep` in einer Bash-Tool-Zelle druckt keine Datei, sondern eine **zsh-Funktion**. Sie führt
für fast jedes Argumentmuster nicht `/usr/bin/grep` aus, sondern das claude-Binary unter dem
`ARGV0` `ugrep`:

```
exec -a ugrep "$CLAUDE_CODE_EXECPATH" -G --ignore-files --hidden -I \
  --exclude-dir=.git --exclude-dir=.svn --exclude-dir=.hg … "$@"
```

Zwei Folgen, beide gemessen:

**(a) Tempo.** Der Shim macht die 1434 MB in 0,04–0,24 s, das echte Binary in ~20 s. Jedes Skript,
jeder Subprozess, jede `.sh`-Datei bekommt das **echte** Binary — Shell-Funktionen werden nicht
vererbt. Eine Messung „grep ist schnell", in einer Bash-Zelle gemacht, überträgt sich also nicht auf
den Code, den man daraus baut.

**(b) `--ignore-files` — und das widerlegt eine Regelbuchzeile.** CLAUDE.md sagt heute: *„getrackter
Code → `rg` gern; alles Operative → `rg -uu` (oder schlicht `grep`)"*. Der Klammerausdruck stimmt
nicht mehr. Probe mit einer Phrase, die im Repo sowohl in getrackten als auch in gitignorten Dateien
steht:

```
Muster: "Beerdigtes nicht wieder aufmachen"
  grep -rl          → 2 Dateien
  command grep -rl  → 5 Dateien
  Differenz         → CLAUDE.md · rulebook/einstieg.md · streams/prompts.jsonl   (alle gitignored)
```

Der Shim überspringt genau die Dateien, für die die Regel den Rückweg vorsieht: das Regelbuch
selbst, den Prompt-Journal und `rulebook/`. Wer „schlicht `grep`" nimmt, bekommt ein **leeres statt
eines fehlenden** Ergebnisses — die Todesart, gegen die die Regel geschrieben wurde, jetzt im
empfohlenen Ausweg.

> **Regelbuch-VORSCHLAG (nicht promoviert):** in der `rg`-Zeile „(oder schlicht `grep`)" durch
> „(oder `command grep` — das blanke `grep` ist in einer Bash-Zelle ein ugrep-Shim mit
> `--ignore-files` und überspringt gitignorte Dateien still)" ersetzen.

Nicht betroffen: `state.sh` und `register.sh`. Sie laufen als Skript unter `/bin/sh`, sehen die
Funktion nie und bekommen das echte Binary — die bestehende Zeile „bewusst NICHT auf `rg`
umstellen" bleibt richtig.

---

## 6. Zurückholen in einen Slot — die Fleet-Lücke und der Weg um sie herum

**Es gibt heute keinen Fleet-Weg, eine bestimmte vergangene claude-Konversation in einen Slot zu
holen.** Belege im Präsens:

- `POST /api/slots/:id/open` nimmt `cwd`, `harness`, `model`, `effort`, `box`, `label` — **keine**
  `sessionId`; es ruft `openSlot()` mit `worktree=null`, und `ensureSlot` mintet danach eine frische
  UUID (`server.ts#agentCmd` bekommt `resume=false`).
- `POST /api/slots/:id/restart` resumiert **nur** die schon gepinnte `s.sessionId` — es liest keinen
  Body.
- Ein Bind-Verb für eine vom Owner gewählte Konversation existiert, aber **nur für codex**
  (`/api/slots/:id/codex-candidates` + `/codex-bind`). Für claude gibt es kein Gegenstück, auch
  nicht im Client (`src/client.ts` kennt „resume" nur als Restart-Knopf).

Gemacht habe ich darum dies, und es ist ein Workaround, kein Verb:

```
1. POST /api/slots/5/open {cwd, model:"claude-opus-5[1m]", effort:"high", label:"🤗 hf-schwarm"}
2. Gepinnte Id ablesen — aus fleet.json, NICHT aus dem Poll (siehe unten)
       → c4cc80f7-10db-4b6c-b39a-319b43f8498f
3. tmux send-keys -t s5 '/exit'      # die frische claude beenden; `; exec $SHELL` in slotCmd
                                     # lässt die Pane als zsh weiterleben
4. Stub beiseite, HARDLINK setzen:
       ln  665ac9d3-….jsonl  c4cc80f7-….jsonl      # ein Inode, zwei Namen
5. tmux send-keys -t s5 "claude --resume c4cc80f7-… --model 'claude-opus-5[1m]' --effort high \
                          --prompt-suggestions false"
```

> **KORREKTUR (Review-Lane, ebd.): der Hardlink war der falsche Zug.** Gemessen an
> Wegwerf-Sessions leistet
> `claude --resume <orig> --fork-session --session-id <pin>` dasselbe ohne ihn: die Fork-Datei trägt
> Historie **und** neuen Turn, das Original blieb **bytegleich**. Damit fallen die Kosten (1) und
> (3) unten komplett weg, und (2) ebenfalls — die Fork-Datei trägt von Anfang an die gepinnte Id.
> Wer diesen Zug das nächste Mal braucht, nimmt `--fork-session`; der Absatz darunter erklärt nur
> noch, WARUM irgendein Zug nötig ist. Nicht gemessen: das Fork-Verhalten unter `/compact` und mit
> Subagenten-Verzeichnissen.

**Warum überhaupt ein Zug und nicht einfach `--resume 665ac9d3…`:** `transcriptFile()` liefert bei
gesetzter `s.sessionId` **ausschließlich** `<pin>.jsonl` und fällt NICHT auf „neueste Datei" zurück
(der mtime-Fallback gilt nur für Slots ganz ohne Pin). Ohne den Link hätte die Pane die richtige
Konversation gefahren, während das Board den 2,4-KB-Stub als „die Konversation dieses Slots"
gerendert und `ctx` bei ~0 % gemeldet hätte — ein Sensor, der lügt. Mit dem Link zeigen Pin, Pane
und Transkript auf dieselbe Datei.

**Verifiziert nach dem Zug:** Pane trägt den letzten Turn vom 2026-08-27 16:39, Footer
`ctx [###-------] 38%`, und `GET /api/sessions` meldet für Slot 5
`ctx {usedTokens: 381768, windowTokens: 1000000, pct: 38.2}` — Pane und Poll stimmen überein.

### Drei Kosten, die dieser Workaround wirklich hat

1. **Der Hardlink ist bis zum nächsten In-Place-Rewrite haltbar.** Schreibt claude das Transkript je
   über temp+rename, bricht der Link: `c4cc80f7` läuft weiter, `665ac9d3` friert auf dem Stand von
   heute ein. Kein Datenverlust, aber die beiden Namen sind dann nicht mehr dieselbe Datei.
2. **Die Zeilen tragen zwei Ids.** Alles vor heute sagt intern `sessionId: 665ac9d3…`, alles Neue
   `c4cc80f7…`. Jede Auswertung, die nach `sessionId` gruppiert statt nach Dateiname, sieht zwei
   Sessions.
3. **Ein Pane-Heal fällt auf den Pin zurück** — der stimmt zwar, aber nur solange die verlinkte
   Datei unter dem Pin-Namen existiert. Verschwindet sie, spawnt `ensureSlot` frisch.

### Zwei Sensor-Fakten, die man dabei lernt

- **`GET /api/sessions` trägt kein `sessionId`.** Die Felder sind `agent · ctx · cwd · effort · git ·
  id · label · lastOutput · mergePending · model · openedAt · repo · share · worktree`. Die gepinnte
  Id steht nur in `fleet.json`. (Gleiche Familie wie die schon notierte `awaiting`-Lücke: ein Cast
  auf die Poll-Antwort behauptet ein Feld, das es nie gab.)
- **`fleet.json.slots` ist ein OBJEKT mit String-Schlüsseln**, keine Liste — `d['slots']['5']`, nicht
  `[s for s in d['slots'] if s['id']==5]`. Kostet einen Fehlschlag, wenn man es rät.

---

## 7. Was ungeprüft blieb

- Ob der Hardlink einen claude-internen Kompaktierungslauf überlebt (nicht provoziert).
- **Nachgemessen, gehört nicht mehr hierher:** `rg` ist NICHT geshimmt (`which rg` →
  `/opt/homebrew/bin/rg`). `find` IST geshimmt (dieselbe Funktionsform), überspringt aber KEINE
  gitignorten Dateien — `find . -maxdepth 1 -name CLAUDE.md` liefert bei Shim und echtem Binary
  je 1 Treffer. Die `--ignore-files`-Falle hängt also an `grep` allein, nicht an der Shim-Familie.
- Die Laufzeitzahlen sind **warmer Cache** auf einer Maschine, auf der zeitweise zwei Suiten liefen.
  Sie ordnen die Varianten, sie sind keine Kaltstart-Angaben.
- `find-conv.py` hat keine Gegenprobe in einer Suite. Es ist ein Werkzeug, kein Sensor —
  wenn es hängen bleibt, gehört ein Pin dazu.
