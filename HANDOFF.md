# HANDOFF — Session 41 (2026-08-08 nachmittags: Codex ist Adapter #4, und die Sandbox wurde vermessen statt geglaubt) · 40/39/38 darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log 1c2a77a..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, was in Flug ist, Korrekturen.*

---

## Session 41: der Tag, an dem ein fremdes Modell mitarbeiten durfte — und die Grenze gemessen wurde

**ctx beim Übergeben: ~39 %.** Produziert: **6 Lands**, alle mit Gate-Note + LaneOutcome + grünem
Audit (`b64cd54` Worker-pro-Repo · `be7ba33` Codex-Adapter · `aaae2e6` Sonden-Race *von einer
Codex-Lane geschrieben* · `11d113a` Dispatch reicht Harness durch · `2a86cec` Worker-Spawn durch den
Adapter · `ece2957` undo-land als Stack). Dazu: 1 rotes Audit adjudiziert, **8 neue Queue-Zeilen**
(alle mit Brief oder als Zielbild markiert), 2 Maschinen-Installationen, 4 CLAUDE.md-Abschnitte.
Zur Schwellen-Kalibrierung: S40 ~42 % bei 4 Lands + 2 eigenen Grabungen, S39 ~31 % bei 9 Lands,
S38 37,1 % bei 3. **Diese Session: 6 Lands + zwei Messkampagnen für ~31 Punkte** — die Lands waren
wieder der billige Posten, die Messungen der teure. Das bestätigt die Regel in `CLAUDE.md`.

### WAS IN FLUG IST

**Slot 5, Lane `fleet/260808115720-7017`, Zeile `25e7c086`** (Container UND Docker-Kontext pro
SLOT). Der nächste Baustein der Isolationskette des Owners. **Der Watch darauf war MEINER und stirbt
mit meinem Slot** — setz sofort einen neuen: `POST /api/self/watch {"target":5,"idleSec":60}`.
Sie trägt jetzt einen `slot`-Link (seit `11d113a`), schließt sich beim Land also selbst.

**Slot 14 gehört dem OWNER** — eine Codex-Lane, die er selbst geöffnet hat und in der er probiert.
NICHT anfassen, nicht landen, nicht killen.

### DIE MESSUNG, DIE DIESE SESSION TRÄGT — und die in `CLAUDE.md` steht, nicht hier

Codex' `--sandbox workspace-write` ist ein **Schreib**-Zaun, **kein Lese**-Zaun. Mit Kontrollgruppe
auf dem echten Agenten-Pfad belegt: `cat` außerhalb des Workspace gelingt in 0 ms, Schreiben
außerhalb wird mechanisch verweigert. Ein Codex-Slot kann `~/private-repo-a` lesen, egal wo er
läuft — und was ein Agent liest, geht an seinen Anbieter. Daraus folgen drei Zeilen, die
zusammengehören: **`29cd2610`** (Repo auf der Main-Maschine, Container auf der Dev-Maschine — mit
der Bind-Mount-Falle als zentraler Warnung), **`54af57d6`** (der Codex app-server als zweiter
Slot-Typ und der erste Kontrollpunkt, an dem Fleet einem fremden Agenten etwas VERBIETEN kann),
**`25e7c086` → `0234283e`** (die Bauteile; `0234283e` ist gelandet).

### KORREKTUREN AN DINGEN, DIE VORHER ANDERS IM UMLAUF WAREN

- **Der Dispatch-Knopf KANN jetzt Harness+Modell** (seit `11d113a`). Der Umweg über `/api/lanes` +
  `/send` ist nur noch nötig, wenn gar kein Task existiert. Er kostet weiterhin den `slot`-Link —
  heute dreimal von Hand geschlossen, bis die Zeile landete.
- **Eine Codex-Lane in einem WORKTREE kann nicht committen** (Metadaten liegen im Haupt-Repo,
  außerhalb der Schreibwurzel), keine Suite fahren, nicht ans Netz. Der Land-Gate läuft aber
  SERVER-seitig — sie ist trotzdem landbar, sie kann sich nur nicht selbst prüfen. Fix ist die
  KLON-Form (`e30b3a7f`), und die Vorarbeit dafür liegt seit heute früh im Baum.
- **Pi spart kein Kontingent.** `~/.pi/agent/auth.json` ist `{}`, die einzige Erweiterung ist
  `pi-claude-bridge` — es läuft über Claude. Unabhängige Budgets: Codex (Owner-Plan) und DeepSeek.
- **Ein Adapter je Harness bleibt die Vorgabe**, eine universelle Pi-Brücke ist der Sonderfall —
  Begründung mit Messung in `CLAUDE.md` (die Sonde geht eine Ebene tief und sähe nur die Brücke).
- **`FLEET_WORKER_HARNESS` steht NICHT in `watchdog.sh`.** `2a86cec` bewaffnet eine Fähigkeit,
  ändert aber das Verhalten des Live-Fleets nicht.

### WAS BEIM OWNER LIEGT — vorlegen, nicht selbst entscheiden

1. **`automatable: true` für Codex** — erst nach der Isolationskette. Seine eigene Reihenfolge.
2. **DeepSeek einschalten.** Owner-Wortlaut: *„es sollte einfach sicher in einem container laufen"* —
   also NICHT nackt fragen, sondern erst über den Adapter. `0234283e` ist gelandet, der nächste
   Schritt ist die Verdrahtung. Key liegt, Wrapper ist live getestet (65/12 Token, exit 0).
3. **Reicht `workspace-write` im Betrieb** — Netz/Pfade sind nicht vermessen. Antwort wäre
   `--add-dir` oder eine Owner-Entscheidung über den Bypass, keine stille Literal-Erweiterung.
4. **Wochenkontingent stand bei 77 %** (Reset 12.08., 20 Uhr). Die Post-Land-Audits kosten daran
   nichts (kein Modell), die Lanes schon.

### REIHENFOLGE FÜR DICH, und das Warum

`25e7c086` läuft. Danach **`e30b3a7f`** (Klon-Form) — sie schaltet Codex-Lanes überhaupt erst
nutzbar, und der Owner arbeitet bereits in einer. Dann **`2e577447`** (`AGENTS.md`: die
Lane-Disziplin reist bei Codex nicht mit, ich habe es heute von Hand kompensiert — eine Krücke, die
jeder künftige Absender vergisst). `29cd2610` und `54af57d6` sind **Zielbilder** und gehören vor dem
Start durch `▸ clarify first`, nicht in einen Dispatch.

### EINE BEOBACHTUNG, DIE SICH HEUTE SIEBENMAL BESTÄTIGT HAT

**Bei einem roten Check an frisch geschriebener Arbeit war die SONDE der erste Verdächtige — und
sie war es jedes Mal.** Sieben Instanzen in einer Session, vier davon haben die Lanes selbst
gefunden und als solche berichtet. Zwei Lanes haben von sich aus einen Check ergänzt, der die Sonde
*als sich selbst* scheitern lässt. Die Regel im Regelbuch trägt sich inzwischen selbst; sie braucht
keine Verschärfung, sondern nur, dass sie drinbleibt.

---

## Session 40: der Tag, an dem ein fremdes Harness normal wurde

**ctx beim Übergeben: ~42 %.** Produziert: 4 Lands über Lanes (alle unter **Pi**, alle mit
Gate-Note + LaneOutcome). **KORREKTUR, eingetragen NACH dem ersten Entwurf dieses Abschnitts:
der Post-Land-Audit des letzten Lands (`b320c24`, Klon) kam ROT zurück** — `exitCode 1`, 778 s,
Testinstanz stehengelassen unter `$TMPDIR/fleet-e2e-instance-85037`. Un-adjudiziert bei der
Übergabe; main-41 hat den Auftrag samt Beweisordnung in der Pane. Die anderen drei Audits sind
grün. **`undo-land` gilt nur für dieses eine Land und nur bis zum nächsten** — Slot 5 zu landen
verbraucht ihn, 4 Direkt-Commits, 5 Queue-Zeilen eingereicht,
3 geschlossen, 1 gelöscht-und-ersetzt. Zum Vergleich für die Schwellen-Kalibrierung:
S39 = ~31 % bei 9 Lands, S38 = 37,1 % bei 3 Lands. **Der teure Posten dieser Session waren
NICHT die Lands, sondern meine eigenen Grabungen** (Container-Untersuchung, DeepSeek-Wrapper) —
das ist die Messung, auf der die neue Schwellen-Regel in `CLAUDE.md` steht.

### WAS IN FLUG IST — genau eine Sache, und sie braucht dich sofort

**Slot 5, Lane `fleet/260808070310-a01f`, Queue-Zeile `9a437d5d`** (Worker pro Repo gespeichert).
Beim Übergeben: `ahead 1`, `dirty 0`, Pane nicht gelesen. **Der Watch darauf war MEINER und stirbt
mit meinem Slot** — setz dir sofort einen neuen:
`POST /api/self/watch {"target":5,"idleSec":60}` (Nicht-Lane-only, self-token).
Dann: Pane LESEN (nicht dem Prädikat glauben), Diff prüfen, landen, Audit abwarten, deployen,
Zeile schließen. Der Land-Weg ist `POST /api/slots/5/merge` — **nicht** `/land`.

### Die vier Lands

| SHA | Zeile | Kern |
|---|---|---|
| `ec7d191`+`2c97c49` | `c3531b41` | **Container-Adapter #3.** Slot leiht sich einen Container, das Bündel bleibt ganz: tmux + git bleiben host-lokal, nur das Transcript fällt. `automatable:false` (fail closed), Docker-Kontext **gepinnt** statt ambient. |
| `86cecf7` | `2784427e` | **F6 Drag&Drop/Paste/📎-Upload.** Ablage im Worktree, `drops/` in `.gitignore`, und die Route fährt `git check-ignore` VOR dem Schreiben (fail-closed) — ein Upload kann eine Lane nicht mehr still unlandbar machen. |
| `ff5d713`+`b320c24` | `eac67cc4` | **Arbeitskopie als KLON** neben dem Worktree (`form:"clone"`, Default unverändert `worktree`). Die tragende Scheibe für Container UND Gast-Modus. |

Dazu vier Direkt-Commits aus dem Haupt-Checkout — **die tragen per Konstruktion keine Land-Note,
keine LaneOutcome-Zeile und keinen Post-Land-Audit**, wer `post-land-audits.jsonl` liest, findet
sie dort korrekt-aber-irreführend nicht: `aac524e` (S39s Handoff, lag uncommitted), `92fab85`
(`docs/tailored-context.md` §8), `ce7cf98`+`c3bba61` (`worker-deepseek.py`), `eb40c2e`
(HANDOFF-Kürzung).

### Pi ist jetzt der Normalfall, und was das kostet

**Alle vier Lands kamen von Pi-Lanes.** Keine Sonderbehandlung: dasselbe Gate, dieselben Suiten,
dasselbe Ledger — `LaneOutcome.model` trägt `claude-bridge/claude-opus-5`, ohne dass jemand etwas
nachrüsten musste. Pi lädt `CLAUDE.md` von selbst (an der Pane verifiziert: `[Context] CLAUDE.md`
beim Boot), die Lane-Disziplin reist also mit.

**Der Umweg, den du kennen musst:** `POST /api/tasks/:id/dispatch` liest `harness` NICHT (die vier
`harnessIdOf`-Stellen sind `/api/lanes`, Slot-Open, Slot-Lane). Für eine Nicht-claude-Lane also
`POST /api/lanes {repo,harness,model}` + Brief per `POST /send`. Preis: die Queue-Zeile bekommt
keinen `slot`-Link, also kein Requeue bei Spawn-Fehler und keine automatische Zuordnung — **die
Zeile schließt du am Ende von Hand.** Landen/Ledger/Audit sind unberührt. Steht auch in `CLAUDE.md`.

### DeepSeek: vermessen, gelandet, NICHT eingeschaltet

`worker-deepseek.py` hängt an der Subprocess-Naht (`summaryViaSubprocess`), Key liegt **0600 unter
`~/.claude-fleet-workers/deepseek.key`**, außerhalb des Repos und NICHT in `.env` (der Server-Env
würde ihn an jeden Worker vererben). Katalog dieses Keys: **genau zwei Modelle**,
`deepseek-v4-flash` (Default) und `deepseek-v4-pro`.

**Der Befund, der über DeepSeek hinausgeht:** ein OpenAI-kompatibler Endpunkt **ignoriert
unbekannte Felder stillschweigend**. Ein frei erfundener Parameter lief mit 200 durch und änderte
nichts. „Kein Fehler" beweist dort also NIE, dass ein Parameter existiert — nur eine Wirkung tut
es. Damit gemessen: `thinking:{"type":"disabled"}` senkt die Completion von 100 auf **6 Token**
bei gleicher Antwortqualität, und erklärt nebenbei die 163-vs-84-`prompt_tokens`-Lücke als
**Thinking-Gerüst** — was der Anbieter-Doku („unterschiedliche Tokenisierung je Modell")
widerspricht.

**Offen und deiner:** `FLEET_COMMIT_CMD` ist fleet-WEIT, und dieses Fleet fährt Slots in
`private-repo-a` und `private-repo-b` — ein Flip schickte deren Diffs mit. Der Owner hat
**Option 1 gewählt: pro Repo gespeichert** (nicht bloß eine Env-Zuordnung — er sagte ausdrücklich
„gespeichert"). Das IST Zeile `9a437d5d`, die gerade in Slot 5 gebaut wird. Nach ihrem Land ist
das Einschalten ein Owner-Akt.

### Der Container-Strang, in der Reihenfolge, in der er gebaut werden will

`eac67cc4` (Klon) **gelandet** → `25e7c086` (Container + Docker-Kontext **pro Slot**, heute nur
fleet-weit im Env) → `0234283e` (Worker-Spawn über den Adapter) → Container-Worker.

**Zwei Befunde, die diese Reihenfolge erzwingen — beide gemessen, nicht argumentiert:**
1. **Ein Worktree ist nicht selbst-enthalten.** Sein `.git` ist eine DATEI mit `gitdir:` auf den
   common dir des Haupt-Checkouts. Nur den Worktree zu mounten macht git im Container arbeitsunfähig;
   die gemeinsame `.git` mitzumounten gibt der Sandbox `.git/hooks` — **ein `post-commit` dort läuft
   beim nächsten Commit auf dem HOST unter deiner uid.** Deshalb der Klon.
2. **`summaryViaSession` baut seine Agent-Kommandozeile SELBST** (`claude --session-id …` hart im
   Code), während der Slot-Spawn längst über die Registry läuft. Es gibt also zwei
   Spawn-Implementierungen, und der Container-Adapter deckt nur eine. Das ist `0234283e`.
   **Hindernis, das dort nicht wegdefiniert werden darf:** dieser Pfad holt seine ANTWORT aus der
   host-seitigen Transcript-Datei, nicht aus stdout — containerisiert käme sie nie an.

### Owner-Entscheide dieser Session, die als Regel in `CLAUDE.md` stehen

- **Schwelle ~44 %, Anker ~36 % für einen Lane-Start, halb dynamisch.** Und der Fehler, den ich
  live gemacht habe: **die Schwelle ist der Startpunkt der Übergabe, keine Decke, unter die die
  fertige Arbeit passen muss.** Ich hatte die Handoff-Reserve auf die Schwelle addiert und deshalb
  eine fertig gebriefte Lane liegen lassen, die bequem gepasst hätte.
- **Kosten hängen an der ART der Restarbeit:** eine Lane ist billig (~2,5/Land) und vorhersagbar,
  eine eigene Grabung ist teuer und schlecht schätzbar. Bei knappem Budget: Lane starten, nicht
  selbst graben.
- **HANDOFF.md ist das Residuum, nicht das Archiv** (2861 → 397 Zeilen, `eb40c2e`). Ältere
  Sessions: `git log --follow -p -- HANDOFF.md`.

### Was auf dich wartet, Owner

- **`0c4a9481` (Codex als Adapter #4)** braucht EINEN Satz von dir: die Installation ist
  Maschinen-Ebene außerhalb jedes Worktrees, eine Lane stoppt korrekt davor. Beim Pi-Spike hattest
  du sie ausdrücklich sanktioniert (user-lokal, kein sudo, kein brew-global). Ohne denselben Satz
  für Codex passiert nichts.
- **Kein `⚙ steward` läuft** — du hattest ihn um 06:56 geschlossen (Audit-Log, `slot_kill … owner`).
  Der Worktree steht noch. **Kein Handlungsbedarf** — der Steward ist ausdrücklich optional
  (Owner 2026-08-08: „brauchst du nicht immer einen steward spawnen"). FALLS er gewollt ist:
  auf **claude**, nicht auf Pi — sein Ritual sind die `.claude/commands/`, Pis Kontext-Entdeckung
  ist `AGENTS.md`/`CLAUDE.md`, und ein billigeres Modell wäre bei der urteilslastigsten Rolle
  genau falsch herum.
- Unverändert offen aus S39: `17068154` (Trail-Deckel) · `d375c581` (Trail-Reaper — die 324 MB
  e2e-Scratch und 2 verwaisten Sockets aus `./state.sh` sind sein Fall) · `f520e704` · `96b72c22`
  · `9bcc460e` · `e7d61b59`.

### Owner-Vorgabe zu Harness-Rechten (2026-08-08, am Ende der Session) — und die Spannung darin

Wörtlich: *„sowohl pi als auch codex sollten auch vollen maschinen zugriff haben. Falls wir keinen
vollen zugriff geben wollen können wir einen container benutzen."* Also: **Vollzugriff ist der
Default, der Container ist die Ausnahme** — nicht umgekehrt. Das ist auch der Status quo
(`FLEET_CMD` ist `claude --dangerously-skip-permissions`), Pi hat ohnehin keine Permission-Schicht
(`note: "no sandbox"`).

**Die harte Grenze, die daraus folgt und die niemand wegargumentieren kann:** der Owner will, dass
ein Agent **Screenshots** machen kann. Screen-Capture ist auf macOS eine TCC-Berechtigung des
BINARYS auf dem Host; ein Linux-Container hat zum Display dieser Maschine gar keinen Zugang.
**„Im Container" und „kann Screenshots" schließen sich auf dieser Maschine aus.** Der Container ist
damit keine universelle Antwort — die Isolationsfrage muss pro FÄHIGKEIT entschieden werden, nicht
pro Harness.

**Die Spannung, die im selben Absatz steht:** der Owner sagt zugleich, er traue *(OpenAI)* mit
seinen Daten nicht wirklich. Wenn das die Sorge ist, dann ist **Codex genau der Harness, der KEINEN
Vollzugriff bekommen sollte** — und der Container ist für exakt diesen Fall gebaut. Vollzugriff für
pi/claude und ein geschnittener Pfad für Codex ist die Auflösung, die beide Sätze erfüllt; „beide
voll" erfüllt nur den ersten. **Nicht von mir entschieden — vorgelegt.**

**Offene Frage des Owners an die nächste Session:** „können wir uns für Codex manches an
Berechtigungen sparen?" Antwort steht noch aus und gehört in den Codex-Spike (`0c4a9481`), weil sie
nur gemessen zu haben ist. Was dabei aus diesem Repo gilt: `--allowedTools` ist ADDITIV zur
Allow-Liste in `~/.claude/settings.json`, geklammerte Muster binden erst mit `--setting-sources ""`
(empirisch 2026-07-25) — und **eine Modell-Weigerung beweist NICHTS**, nur eine mechanische
Verweigerung zählt, wörtlich zitiert. Was immer Codex über seine Rechte behauptet, wird mit einem
Canary geprüft.

**Als IDEE abgelegt, ausdrücklich nicht jetzt zu tun** (Owner: „das sollten wir aber nur als idee
ablegen und bald darauf zurückkommen"): die Daten auf dieser Maschine aufräumen und Claude Fleet im
Zweifel von der Main-Session des Owners auf diesem Rechner fahren. Motiv ist dasselbe
Vertrauensthema. Nicht anfangen, ohne dass der Owner es aufruft.

### Owner-Kritik an MEINER Arbeitsweise, 2026-08-08 — bitte nicht wiederholen

Wörtlich: *„ich denke das hauptproblem gerade ist das du dich so viel auf deinen Kontext
fokussierst"*. Er hat recht. Ich habe in dieser Session laufend Budget-Arithmetik in die Antworten
geschrieben und dreimal eine Kette NICHT angefangen, die bequem gepasst hätte — der Owner musste
die Schwelle dreimal nach oben korrigieren (40 → 42 → 44), bis ich aufhörte, sie als Decke zu lesen.

**Operativ:** rechne dein Budget, wenn eine Entscheidung wirklich davon abhängt, und schreib die
Schätzung dann EINMAL hin (so verlangt es die Regel in `CLAUDE.md`). Aber mach den eigenen Kontext
nicht zum Gesprächsthema — der Owner will Arbeit sehen, nicht Buchhaltung. Der Owner hat
angekündigt, sich dafür „ein smartes System bzw. einen Prompt" zu überlegen; bis dahin gilt:
im Zweifel arbeiten, nicht abwägen.

### Korrekturen, die man kennen muss

- **`post-land-audits.jsonl` führt das Ergebnis als `result` (`green`/`red`), nicht als `ok`.**
  Ich habe in dieser Session einmal auf `ok` gelesen, `None` bekommen und beinahe einen grünen
  Audit als „nicht feststellbar" gemeldet.
- **Das Feld einer LaneOutcome-Zeile heißt `disposition`, nicht `outcome`** — darüber ist auch
  eine Lane gestolpert.
- **Sechs Sonden-Defekte an einem Tag, jedes Mal war der CODE richtig** (drei in F6, zwei im
  Container, einer im Klon). Die Regel im Regelbuch steht damit auf sechs Instanzen aus einem Tag,
  nicht auf dreien.

---

## Session 39: acht Lands, alle über Lanes, alle mit Ledger-Spur

**Das Erste:** `./state.sh` · `./register.sh` · die ersten zwei Regeln in `CLAUDE.md` — **und die
zwei Zeilen, die ich dort geändert habe** (der Verb-2-Absatz im Deploy-Abschnitt · die
`BACKLOG.md`-Korrektur in Zeile 12). `CLAUDE.md` ist gitignored, sie stehen in keinem Commit.

### Was in Flug ist

**NICHTS.** Alle neun Lands sind durch, alle Zeilen geschlossen, keine Lane auf Platte außer dem
Steward, Suite-Mutex frei, Adjudikations-Schuld null. Der letzte Post-Land-Audit (`59f59b9`) ist
**grün** (639 s) — der erste grüne Audit nach zwei roten, und zwar auf genau dem Baum, der die
Commit-Sonden umgebaut hat. Deploy ist verifiziert: `codeBehind:false`, `bundleStale:false`,
`errors:null`. Du startest auf einem sauberen Brett; **prüf es trotzdem selbst.**

### Die acht Lands (Bodies lesen, die tragen die Messungen)

| SHA | Zeile(n) | Kern |
|---|---|---|
| `11eea2a` | `8bdf0e81` `8830dddc` | Verify-Gate: SIGTERM→SIGKILL-Staffel **und** `FLEET_VERIFY_CMD_REPOS` pro Repo |
| `1241abd` | `25b79c23` | Repair-Worker darf committen; ein Check hält Prompt↔Profil zusammen |
| `3280a10` | `a5030c42` | Drift-Block filtert den Nenner auf die instrumentierte Population |
| `374f29a` | `118ad609` | **`CLAUDE.md` hat einen Drift-Pin** (`e2e/pins.ts` §6), dreiwertig und stumm |
| `0db08ac` | `cf557dc4` | `docs/data-saver.md` §2 + §5 nachgeschrieben |
| `2216de8` | `2c92a467` | Requeue nimmt seine Lane mit — außer sie trägt Arbeit |
| `53f5ce8` | `c0a8366b` | Worktree-Stapel hängt unter der zuletzt aktiven Main-Session |
| `4311c92` | `989cccf7` | **Verb 2 (Deploy) gebaut** — und nie gezogen |
| `59f59b9` | `560b7196` | die „siebte Flake-Familie" war **keine** — plus ein echter Client-Defekt |

Zehn Zeilen geschlossen, drei eingereicht (davon eine sofort erledigt) → **59 offen von 157**.
Alle neun Lands mit Gate-Note, LaneOutcome UND Post-Land-Audit; die Ledger-Lücke aus Session 38
wächst nicht weiter.

### Die „siebte Flake-Familie" — und warum sie am Ende keine war

Signatur: ein Check der Commit-Familie fällt mit
`{"committed":false,"reason":"the session is actively working right now …"}`. **Welcher Check es
trifft, wechselt von Lauf zu Lauf** — fünf Sichtungen an einem Tag (drei Lanes, zwei
Post-Land-Audits), in `docs/verify-tiering.md` vorher **null** mal geführt.

**Die Auflösung, und sie widerlegt mein eigenes erstes Urteil: der Commit-Gate feuerte KORREKT.**
Die Sonden hatten nur nie erklärt, dass sie den Baum meinen — sie posteten `/commit` ohne
`confirm`, und die Wache kam ihrer eigentlichen Absage zuvor (`detached-HEAD` und `FIX4` fielen
mit dem FALSCHEN Grund). Nicht der Baum war schuld, sondern der Test. Ich hatte beide roten Audits
als `flake` adjudiziert; **nach dem Fix habe ich beide auf `stale-test` korrigiert** (neuestes
Urteil gewinnt). Adjudikations-Schuld null.

Der Fix wählte `confirm:true` statt Abwarten, mit einem Argument, das man kennen sollte: Warten
wäre keine Wartezeit, sondern eine Retry-Schleife in genau der `send-keys+sleep`-Form, die §11.2c
verboten hat — ≥3 s × 16 Aufrufstellen pro Lauf. Die Wache bleibt scharf (ein Beweisblock in
`e2e/lanes-basic.ts` hält beide Richtungen), und ein **Rot-Schutz als Regel statt Liste** scannt
`e2e/*.ts` auf Commit-POSTs ohne `confirm`. Drei serielle Läufe grün gegen ~25 % Basisrate.

**Ein echter Produktdefekt fiel dabei heraus:** `doLand` (`src/client.ts`) committete ohne
`confirm`, obwohl die gerade bestätigte Risk-Preview wörtlich sagt, dass zuerst committet wird —
auf einer noch schreibenden Lane also 409, und weil der Body `reason` statt `error` trägt, las der
Alert `could not commit the work first: undefined` für einen **gesunden** Baum.

**Die Beweisform, die ich gelernt habe und die schärfer ist als die dokumentierte:** beim ersten
Rot war der Rerun desselben Baums NICHT grün — es fielen **zwei andere Checks derselben Familie**.
Verschiedene Checks auf identischem Baum belegen Nicht-Determiniertheit *direkter* als ein grüner
Lauf, denn ein grüner kann auch „die Flake hat diesmal nicht gefeuert" heißen.

**Und ein Argument für den Trail, ungeplant:** die Ausgabe des zweiten roten Audits hatte ihre
eigene `FAIL`-Zeile durch Retention verloren („1 FAILURES", null FAIL-Zeilen). Der Trail trug alle
1698 Zeilen, genau eine mit `ok:false`, mit Detail. Das macht `17068154` (Trail-Deckel) **teurer**,
nicht billiger: das Werkzeug wird gerade wertvoll, während seine Selbstaussage unbelegt ist.

### Verb 2 ist gebaut und wartet auf DEINE Hand

`POST /api/deploy` / `GET /api/deploys`, Owner **und** Steward-Token. **Kein Tick ruft sie** — der
erste Zug ist dein Entscheid, und ich habe alle acht Deploys dieser Session bewusst von Hand
gefahren statt die frische Route auf sich selbst loszulassen. Konstruktion: der Deploy tötet
seinen eigenen Verifizierer, also verifiziert der **nächste Boot** über `deploy-inflight.json` →
`deploys.jsonl`; `ok:null` = „nicht feststellbar", nie ein Pass; Build zuerst und allein; 409 bei
laufendem Post-Land-Audit. Details stehen jetzt in `CLAUDE.md`, Deploy-Abschnitt.

### Was ICH falsch gemacht habe (beides billig, beides lehrreich)

1. **Eine Schleifenbedingung gegen einen SHA aus dem Gedächtnis.** Die erfundene Langform von
   `374f29a` stimmte nicht, die Bedingung war sofort wahr, mein Watcher meldete „fertig", während
   das Land noch lief. Kein Schaden — aber die Regel „nie eine Zahl aus dem Gedächtnis" gilt
   besonders dort, wo sie still falsch wird statt laut.
2. **Geschätzte `ctx`-Zahlen berichtet.** Ich nannte ~33 %, gemessen waren 19,8 %. Der Sensor ist
   an der Slot-Row (`ctx`), er kostet einen Poll — schätz ihn nie.

Dazu ein Fast-Fehler, der die Lese-Regel bestätigt: direkt nach `bun run build` meldete der Poll
weiter `bundleStale:true` mit dem **alten** `appJsMtime`, während `stat` frische Dateien zeigte.
Derselbe alte Wert in der Antwort = **gecachter Fakt**, nicht „Build hat nicht geschrieben".

### Was der Brief-Kompiler wert war (für die Frage „lohnt das?")

**Jede** der acht Zeilen hatte veraltete Zeilenrefs — mehrfach um 1000+ Zeilen (`MERGE_TOOLS` stand
als 4007 in der Zeile, real 5258; `briefAndSend` als 1993, real 2742). Zweimal war die *Begründung*
der Zeile überholt: `a5030c42` argumentierte mit „11 %, unter der Schwelle" — gemessen waren es
32,5 %, also darüber. Und dreimal fand die Lane einen Fehler in MEINEM Brief (die §5-SHAs waren
Zwillinge der umgeschriebenen Historie; `/api/steward/sessions` trug die Deploy-Fakten längst).
**Der Kompiler ist der Grund, warum keine dieser acht Lanes auf eine tote Referenz gebaut hat.**

### Kontext-Praxis (zweiter Datenpunkt)

`ctx` beim Übergeben = **32,9 %** (329.496 / 1M, am Poll gelesen). Produziert: 9 Lands · 10 Zeilen geschlossen · 3 eingereicht ·
2 rote Audits beurteilt (und nach besserem Wissen korrigiert) · 2 `CLAUDE.md`-Korrekturen ·
1 verwaister Worktree entfernt. Session 38 übergab bei 37,1 % mit 3 Lands. Die Fixkosten-Rechnung hält: der Unterschied
ist nicht Sparsamkeit, sondern dass Lanes die Arbeit tragen und die Main-Session nur brieft,
landet und urteilt.

### Für dich offen (unverändert Owner-Sache, nicht erneut vorlegen)

`17068154` (Trail-Deckel — jetzt teurer, s. o.) · `d375c581` (Trail-Reaper) · `f520e704` ·
`2784427e` · `96b72c22` · `c3531b41`. Neu von mir eingereicht: `9bcc460e` (mtime-Fallback serviert
fremde Konversation, an HEAD verifiziert) · `e7d61b59` (immutable-Cache-Widerspruch, als NOTIZ
gemeint — die Owner-Route setzt `kind` hart auf `lane`, siehe `65af341f`).

Maschinen-Hygiene, ungeräumt: 2 verwaiste e2e-tmux-Sockets, **325 MB** TMPDIR-Scratch.

---

## Session 38: die Session, deren Arbeit in keinem Land-Ledger steht

**Das Erste für die nächste Session:** `./state.sh` · `./register.sh` · die ersten zwei Regeln in
`CLAUDE.md` — **und dann die vier Zeilen, die ich heute eingefügt habe** (Direkt-Commit-Blindheit ·
40-%-Schwelle · Sonden-Regel · `FLEET_HARNESS_AUTOMATION`). Sie stehen dort, weil sie sonst
verloren gehen: `CLAUDE.md` ist gitignored.

### DAS WICHTIGSTE, sonst liest du den Zustand falsch: drei Lands, NULL Ledger-Spur

`0e2a672` · `4955444` · `efda3eb` — alle drei sind **Direkt-Commits auf main aus dem
Haupt-Checkout** (der Owner sagte „arbeite selbst"), nicht Lands über eine Lane. Konsequenz,
gemessen und nicht vermutet:

- **kein** `git notes --ref=fleet/land` für die drei SHAs
- **keine** Zeile in `lane-outcomes.jsonl`
- **KEIN Post-Land-Audit** — `schedulePostLandAudit(repo, main, BRANCH, mainAfter)` hängt am
  Land-Pfad, nicht an einer Bewegung von main. Das Audit-Ledger endet bei `6061b491` (Session 37).

**Die Abdeckung ist trotzdem gleichwertig**, und das ist der Punkt: das Audit-Kommando IST
`./e2e-isolated.sh`, und ich habe die volle Gate-Kette auf jedem Baum von Hand seriell gefahren —
`pins` · `tsc --strict` (11 Ziele) · `e2e-clean-review` · `e2e-security` · `e2e-claude-gate` ·
`e2e-isolated` (1635 Checks, 0 FAIL beim letzten Lauf). Was fehlt, ist der **EINTRAG**, nicht die
Messung. Ich habe zweimal fast selbst darauf hereingefallen und dem Owner einmal fälschlich
gemeldet, die Audits liefen. **`./state.sh`s Land-Health-Zahlen zählen Lanes — sie untertreiben
diesen Tag.** Steht jetzt als Regel im Regelwerk.

### Was gelandet ist (Bodies lesen, die tragen die Messungen)

| SHA | Register-Zeile | Kern |
|---|---|---|
| `0e2a672` | `5388c07d` `04607d0b` `4544f602` `380d24ee` | vier stille Halbwahrheiten; die eigentliche Falle waren die FIXTURES |
| `4955444` | `b28ce533` | Probe pro Slot — Fakt getrennt vom Gate, Entscheid blieb beim Owner |
| `efda3eb` | (Owner-Auftrag) | Automation scharf, mit ZWEI Bedingungen statt einer |

Fünf Register-Zeilen geschlossen, zwei neue eingereicht → **65 offen von 154**.

### `FLEET_HARNESS_AUTOMATION=1` ist LIVE — und heute wirkungslos

Owner-Entscheid. Live verifiziert am Config-Sensor (`./state.sh`: `live=1 | watchdog.sh` — der
Sensor erfasst neue Variablen von selbst, es war keine Zusatzarbeit nötig).

- **Zwei Bedingungen, nicht eine:** der Flag ist die Zustimmung des Operators,
  `automatable: true` am Adapter ist der Anspruch des einzelnen Harness. Pflichtfeld → ein neuer
  Adapter antwortet beim Compile. Ich hatte das in `4955444` falsch gebaut (ein globales `||`) und
  es beim Prüfen VOR dem Flip repariert; sonst hätte die Container-Zeile `c3531b41` die Erlaubnis
  stillschweigend geerbt.
- **Wirkung am Tag des Einschaltens: NULL.** Kein Slot fährt einen fremden Harness (alle aktiven
  tragen `harness: null`, an `fleet.json` geprüft). Der Flag bewaffnet eine Fähigkeit.
- **Was er NICHT öffnet, und darum war er entscheidbar: kein Tick landet.** Die einzige
  `mergeJob(`-Aufrufstelle ist eine Route. Jeder geöffnete Pfad tippt einen PROMPT in eine Pane.
- Zurückdrehen = das eine Wort in `watchdog.sh`, dann `launchctl kickstart` **zuerst**, dann
  srv killen. (Diese Reihenfolge live bestätigt: der kickstart tastet ein laufendes srv nicht an —
  es lebte danach noch, ich musste es extra killen.)

### Owner-Entscheid 2026-08-07: Kontext-Schwelle ~40 % statt 45 %

Meine Empfehlung war 40 und **gegen 35**, mit Rechnung: Fixkosten ~10–11 % pro Session (davon
**7,6 % nur Erdung**, an mir gemessen), also bleiben bei 40 % ~29 % produktiv, bei 35 % nur ~24 % =
**1,42× so viele Sessions** für dieselbe Arbeit. Belegt an dieser Session: meine zwei ersten Lands
kosteten 24,5 % (7,6 → 32,1) — bei 35 % hätte ich EINES geschafft.

**Die Zahl ist der schwächere Teil. Der stärkere: fang keine Kette an, deren plausible Kosten dein
Restbudget bis ~70 % übersteigen.** Ich habe das auf mich angewandt und den Trail-Umbau
(`17068154`, plausibel 12–15 %) bei 32 % NICHT angefangen, sondern die Wissensschuld bezahlt.

**Erster Datenpunkt der neuen Praxis (jeder Handoff notiert das ab jetzt):**
`ctx` beim Übergeben = **37,1 %** (370.769 / 1M). Produziert: 3 Lands, 20 neue Checks, 3 Pins,
2 Deploys, 5 Zeilen geschlossen, 2 eingereicht, 7 Regelwerk-Änderungen.

### Die Lehre des Tages, dreimal bezahlt: bei einem roten Check an FRISCHER eigener Arbeit ist die SONDE der erste Verdächtige

Dreimal rot, dreimal war der **Code richtig und mein Check falsch** — und jedes Mal lautete die
naive Lesart „der neue Gate ist kaputt":

1. `§6b` erwartete `no-agent` für einen Pi-Slot — **maschinenabhängig** (`pi` ist hier installiert).
   Richtig ist `!== "unprobed"`: die einzige Antwort, die beweist, dass die Probe NICHT stattfand.
2. `§6c` erzeugte seinen Probe-Auto mit `inSec: 0` → die Route weist das mit **400** ab
   („one-shot needs inSec ≥ 1"), und mein Helfer **verschluckte den 400 still**.
3. `§6b` verlangte von einem gerade zurückgesetzten Slot `unprobed` und bekam den Wert seiner
   Pi-Phase — `agent` ist ein **git-Tick-Cache**, und ein beim `kill` schon fliegender Tick
   schreibt NACH dem Neu-Öffnen zurück.

**Das Werkzeug ist die SIGNATUR gegen die Erwartung zu lesen, nicht den Fehlschlag zu glauben:**
bei (2) verriet es „`null` in BEIDEN Zeilen, auch der Gegenprobe" = nie gemessen; bei (3)
„`no-agent` kann aus einer LEEREN comms-Liste strukturell nicht entstehen" = also war der Slot zum
Messzeitpunkt noch pi. Konsequenz, jetzt Regel: **eine Sonde, die nicht laufen konnte, muss als SIE
SELBST scheitern** — eigener `check()` auf ihre Voraussetzung.

### Was dem Owner zur Entscheidung vorliegt (nicht erneut melden, er weiß es)

- **`17068154`** (Trail-Deckel) — `GET /api/flakes` sagt `never-failed` über 741 verschwiegenen
  Dateien. Drei Schnitte stehen in der Zeile; „Deckel hochsetzen" ist keiner. **Höchste Kosten von
  allem Offenen**, weil ein geglaubtes Werkzeug schlimmer ist als keines.
- **`d375c581`** (Trail-Reaper, ~4,4 MB/Tag) — hängt an `17068154`.
- **`f520e704`** (Steward kritisch beleuchten) · **`2784427e`** (F6, Entwurf ≠ Brief beim Ablageort)
- **NEU `96b72c22`** — billiges Fremdmodell an EINEN Wegwerf-Worker. **Der Seam existiert schon,
  keine Server-Änderung nötig:** `runWorker` → `summaryViaSubprocess` (`Bun.spawn([cmd, "--model",
  …])`, Prompt auf stdin), neun der zehn Worker haben ihr eigenes `FLEET_*_CMD`. Erster Kunde
  `commitMsg`, weil seine Ausgabe begrenzt ist und sein Fehlschlag seit `0e2a672` SICHTBAR.
  Braucht einen API-Key. Warze: `SUMMARY_MODEL` validiert gegen `MODEL_RE` (kein `/`), das Modell
  muss also im Wrapper stehen. Preise belegt: $1,25/M in, $4,25/M out — **nicht** „cents".
- **NEU `c3531b41`** — Slots/Worktrees in Container. Der teure Teil ist nicht das Starten, sondern
  das ZUSEHEN: tmux, `git -C` und `projDir` sind alle drei host-lokal. Vorbedingung war
  `b28ce533` — **die ist jetzt gelandet.**

### Kleinigkeiten, die man wissen muss

- **Slot 5 (`main-37`) ist geschlossen** — `fleet.json` führt ihn gar nicht mehr, und das schreibt
  nur `killSlot`. Nicht mein Deploy (Beweis oben). 11 aktive Slots.
- Der Steward-Puls `f2a34b1f` (Slot 12, `/inspektion`, stündlich) und mein Heartbeat `5e2229c3`
  (Slot 7) laufen. **Fasst du Slot 12 an, leg sein Auto neu an** — der Puls stirbt beim Neu-Öffnen.
- Adjudikations-Schuld: **0** (alle 18 roten Audits von 80 tragen ein Urteil).
- `e2e-isolated` gemessen: **p50 8,7 min, p90 10,0 min** über 80 Läufe. Die drei Gate-Suiten sind
  der schnelle Teil.
- Die Suiten setzen `FLEET_HARNESS_AUTOMATION=0` jetzt **explizit** (`e2e-isolated.sh`): nicht
  genannte Vars erbt der Test-Server aus der aufrufenden Shell, und `§6c` hängt an ihrem
  Aus-Zustand.
- **Nicht bestätigt, entgegen meiner eigenen früheren Behauptung:** die Suite-Mutex-Gewohnheit vor
  jedem Land („warte auf einen freien Mutex") hat von MIR keine neue Evidenz — meine drei Commits
  liefen nie durchs Land-Gate, es gibt also kein `waitMs`. Session 37s Beobachtung (8 Lands, alle
  `waitMs 0`) steht weiter allein.

---

# Ältere Sessions (37 und darunter): in der git-Historie dieser Datei, nicht mehr hier

Bis 2026-08-08 sammelte diese Datei **jede** Session im Detail — 2861 Zeilen, Session 13 bis 39.
Gekürzt auf die drei jüngsten, Owner-Entscheid: „die letzten paar sind ja vielleicht noch
hilfreich, aber nicht alle".

**Es ging nichts verloren.** Die Datei hat 103 Commits; jede alte Übergabe steht vollständig darin:

```sh
git log --follow -p -- HANDOFF.md        # alles, chronologisch rückwärts
git log --oneline -- HANDOFF.md          # welcher Commit welche Übergabe brachte
git show <sha>:HANDOFF.md                # eine bestimmte Fassung im Ganzen
```

**Warum das richtig ist und nicht bloß aufgeräumt:** diese Datei trägt per Konstruktion nur das
*Residuum* — Absicht, was in Flug ist, Korrekturen. Alles andere wird abgeleitet und ist damit
aktueller als jede Prosa hier: der Zustand aus `./state.sh` und `./register.sh`, die Befunde aus
den **Commit-Bodies** (`git log <letzter Handoff>..HEAD`), die Regeln aus `CLAUDE.md`. Ein
Handoff von vor zwei Wochen beschreibt einen Baum, den es nicht mehr gibt; ihn oben liegen zu
lassen macht ihn nicht wahrer, sondern nur sichtbarer als die Quellen, die stimmen.

## Ein loses Ende aus dem gekürzten Teil, bewusst mitgenommen

`0de526c` (*„docs(autonomy): vier Bausteine, und drei Prämissen, die sich bewegt haben"*,
2026-08-06, doc-only, 333 Zeilen) hängt an **keinem Branch** — `git branch -a --contains` ist
leer. Auffindbar war er nur über die Handoff-Zeile, die ihn nannte; darum steht er hier.
Seine Queue-Zeile `1981be9a` ist `done`, und `docs/autonomy-bausteine-2026-08-06.md` existiert
in main — aber mains Fassung **weicht ab** (132+/99−). Ob die 99 Zeilen des verwaisten Standes
inhaltlich abgedeckt sind, ist **ungeprüft**; wer es beantworten will:
`git diff 0de526c main -- docs/autonomy-bausteine-2026-08-06.md`. Ein verwaister Commit
überlebt kein `git gc` mit Ablauf — wer die Antwort braucht, holt sie besser früh.

