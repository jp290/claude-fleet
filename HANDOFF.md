# HANDOFF — Session 39 (2026-08-08 nachts: neun Lands über Lanes, und die „siebte Flake-Familie" war keine) · 38/37 darunter

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log 6cd299e..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, Entscheide, was in Flug ist, Korrekturen.*

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

# HANDOFF — Session 37 (2026-08-07 abends: acht Lands, Pi ist angeschlossen, der 12-min-Takt ist Geschichte)

*Zustand ist ein KOMMANDO: `./state.sh` **und `./register.sh`**. Historie: `git log 5f84d53..HEAD`
mit Bodies. Diese Datei trägt nur das Residuum: Absicht, Entscheide, was in Flug ist, Korrekturen.*

---

## Session 37: der Abend, an dem die Doktrin nachgab und Pi hereinkam

**Das Erste für die nächste Session:** `./state.sh` · `./register.sh` · die ersten zwei Regeln in
`CLAUDE.md` — **und diesmal auch die geänderten Regeln 15 und 23/24, siehe unten.**

### Acht Lands, alle durchs Gate, alle `waitMs 0`

| SHA | Was | Gate |
|---|---|---|
| `654761c` | Tempo-Analyse (`briefs/tempo-2026-08-07.md`) — die Minuten sind gemessen | direkt |
| `62b9482` | sechste Flake-Familie GEHEILT (`e2e/review.ts`, Sonde im Poll statt Sleep) | 79 s |
| `4e77909` | `/api/self/watch` — der Rückkanal-Zwilling für Nicht-Lane-Sessions | 87 s |
| `a64b681` | Harness-Basis: die drei Stellen, die claude annahmen | 83 s |
| `3276ee7` | Pi vermessen — alle vier offenen Punkte GEMESSEN | 82 s |
| `01447be` | **der Harness-Picker** — Registry + erste Spawn-Options-UI | 82 s |
| `832bb68` | Trail-Abfrage: `GET /api/flakes` + `/api/self/flakes` | 84 s |
| `6061b49` | **Kontext-Sensor** — `ctx` an jeder Slot-Row | 84 s |

Deploy viermal gefahren und je am Owner-Poll verifiziert. Audits: 21 grün / 3 rot heute, **alle drei
Roten adjudiziert** (und alle drei stammen aus Sessions VOR dieser). Adjudikations-Schuld null.

### Die Doktrin hat nachgegeben — das ist die folgenreichste Änderung des Tages

Der Owner hat die zwei Tempo-Entscheide an die Regelwerk-Session delegiert („dein call"). Beide sind
in `CLAUDE.md` umgesetzt, beide sind **einzeln rückdrehbare Textzeilen**:

- **Zeile 15 — der 12-min-Land-Takt ist GESTRICHEN.** Seriell bleibt (das Gate serialisiert ohnehin),
  aber die Wartepflicht auf den Post-Land-Audit ist weg. Beide alten Begründungen waren von der
  Maschine überholt: `drainPostLandAudits` (`server.ts:5114`) existiert und hat **nie** gefeuert —
  `covers`-Histogramm über alle Audits = `{1: N}`; und seit `08dc17a` sind Warte- und Arbeitsbudget
  getrennt. **Wissentliches Restrisiko:** ein rotes Sammel-Audit nennt N Lands statt einem, und
  `undo-land` deckt nur das neueste.
- **Zeile 23/24 — `./e2e-isolated.sh` ist keine Pflicht mehr in jeder Lane**, nur noch bei `e2e/`,
  Suite-Wrappern oder Merge-/Land-Pfad. Gemessen: ~165 min/Tag Mutex für **0 echte Vorschau-Funde in
  zwei Tagen**.

**ABER — was ich in der Praxis GEGEN die neue Doktrin gemacht habe, und es war jedes Mal richtig:**
vor jedem Land habe ich auf einen freien Suite-Mutex gewartet (zweimal 440 s und 980 s). Ergebnis:
alle acht Gates `waitMs 0`. Die gestrichene Regel betraf das AUDIT; ein fremder Suite-Lauf ist echte
Contention und bleibt ein Grund zu warten. Das steht so nicht im Regelwerk — **wenn es sich hält,
gehört es hinein.**

### Pi ist angeschlossen — und der Login-Schritt entfiel ersatzlos

Kette: Basis (`a64b681`) → Messung (`3276ee7`) → Picker (`01447be`). Du kannst im Picker jetzt
**claude oder pi** wählen, plus Modell und Effort. Live gegengeprobt: unbekannter Harness → 400
`{"error":"unknown harness (one of: claude, pi)"}`.

- **Kein `/login` nötig.** `pi install npm:pi-claude-bridge` reicht: die Bridge läuft übers Claude
  Agent SDK und nutzt die Anmeldung der Maschine. Beweis: 8 Modelle im Katalog bei LEERER
  `~/.pi/agent/auth.json` (2 Bytes), plus ein Haiku-Call `→ OK`. Für die DIREKTEN Pi-Provider gilt
  „auth-gated" weiter (gratis mitgemessen).
- **Die Grenze, die du kennen musst: ein Pi-Slot ist für JEDE Automatik unsichtbar.**
  `HARNESS_COMMS = IS_CLAUDE ? ["claude"] : (env…)` (`server.ts:123`) — auf diesem Fleet ist
  `FLEET_CMD=claude`, also wird `FLEET_HARNESS_COMMS` nie gelesen. Es gibt keinen Env-Fix. Folge:
  keine Autos, kein Dispatch, kein `done-looking`, kein Rückkanal, kein auto-③. Von Hand
  funktioniert alles. → Zeile **`b28ce533`**, mit fertigem Lösungsvorschlag; der Entscheid
  („welche Automatik darf einen sandbox-losen Agenten anfassen") gehört dem Owner.

### Ein Defekt in frisch gelandeter Arbeit, gefunden BEIM VERIFIZIEREN des Deploys

`GET /api/flakes` antwortet **`never-failed`**, wo der Trail 9 Fehlschläge auf 3 sauberen Bäumen
kennt. Ursache: `TRAIL_MAX_FILES = 400` (`server.ts:9058`) ist eine harte Konstante, über die Route
nicht steuerbar, und Dateien werden *newest-first* genommen — es fallen also genau die **älteren**
741 von 1141 weg. `days=14` und `days=60` antworten byte-gleich. Gemessen: neueste 400 → 74 runs /
**0** fails; die ausgelassenen 741 → 169 runs / **9** fails / **3** saubere Bäume.
Kosten: eine Lane mit FIX1-Rot hört „never failed in 74 runs" — *positive* Evidenz der Abwesenheit —
und sucht einen Regress, den es nicht gibt. **Teurer als kein Werkzeug, weil ein Werkzeug geglaubt
wird.** → Zeile **`17068154`** mit drei möglichen Schnitten. „Deckel hochsetzen" ist keiner davon.

### Vier Korrekturen an mir selbst

1. **Mein Brief behauptete eine tsc-Listen-Pflicht, die es nicht gibt.** Ich nannte
   `fleet-e2e-harness.ts` als Präzedenz für „neue Top-Level-Datei → in `watchdog.sh`". Die Lane hat
   es empirisch widerlegt (absichtlicher Typfehler wird von der unveränderten Liste gemeldet) und
   den Fall korrekt zerlegt: jenes ist ein **Entry-Point**, `trailstats.ts` ist **importiert** — wie
   `slotstats.ts`, `continuity.ts`, `lane-signals.ts`, die alle nicht gelistet sind. Nachgeprüft,
   sie hat recht. Ein Deploy-Schritt weniger.
2. **Zweimal war mein eigener Prüfausdruck der Fehler, nicht der Code:** ein im Report
   ABGESCHNITTENER Check-Name als Exact-Match (`/api/flakes` antwortete zu Recht `not-in-window`),
   und ein geratener Feldname (`contextFill` statt **`ctx`**), der den frisch gelandeten Sensor wie
   tot aussehen ließ. **Merke: bei einem Alarm zuerst die Sonde prüfen, dann den Code.**
3. Der Heartbeat-Text auf Slot 5 ist **veraltet** — seine „startbereit"-Liste (`15a01b70`,
   `fdabb575`, `32c89530`) ist heute komplett gelandet. Wer ihn erbt, schreibt ihn neu.
4. Ich habe den Heartbeat einmal „nachgezogen", der 55 s zuvor korrekt gelegt worden war — mein
   Schnappschuss war älter als die Welt. Duplikat gelöscht.

### Was der OWNER entscheiden muss (nicht erneut melden, nur vorlegen)

- **`b28ce533`** *(Probe pro Slot statt fleet-weit)* — macht einen Pi-Slot erst zum vollen Bürger.
- **`17068154`** *(der Trail-Deckel)* — welcher der drei Schnitte.
- **`f520e704`** *(Steward kritisch beleuchten)* — Kriterium `confirmedAt:null`, unwiderruflich.
- **`2784427e`** *(F6 Drag&Drop)* — Entwurf und Brief widersprechen sich beim Ablageort.
- **`d375c581`** *(der Reaper)* — der Trail wächst ~4,4 MB/Tag; hängt mit `17068154` zusammen.

### Arbeitsweise, die sich heute bewährt hat und die ich weiterempfehle

- **Kein Roh-Dispatch.** Jede der acht Zeilen bekam vor dem Start einen von mir kompilierten Brief
  (`POST /api/tasks/:id/brief`), geerdet an echten Zeilennummern und Messwerten. Die Lanes haben
  daraufhin *mich* an vier Stellen korrigiert — das ist der Ertrag, nicht der Aufwand.
- **Briefe altern schnell.** Der Kontext-Sensor-Brief war vor dem Dispatch vier Lands alt; seine
  Zeilenrefs waren gewandert UND `01447be` hatte eine neue Randbedingung geschaffen
  (`transcriptFile` → `null` für Nicht-Transcript-Harness). Vor jedem Dispatch nachziehen.
- **Watch statt Vorsatz:** `POST /api/slots/5/watch {"target":N,"idleSec":60}` hat heute achtmal
  sauber geweckt. Für „warte auf einen freien Mutex" taugt er nicht — dafür ein Hintergrund-Watcher.

---


---

# Ältere Sessions (36 und darunter): in der git-Historie dieser Datei, nicht mehr hier

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
