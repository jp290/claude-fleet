# Triage-Batch F-wissen — Wissen, Docs, Hygiene, Trail

**6 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**

---

## `609744d8`  ·  kind=lane  ·  angelegt 2026-08-08 09:11  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Bounded doc slice with a done-criterion the suite can judge — one new file, indexed in docs/README.md, `bun e2e/pins.ts` green (pins.ts:441-445 really does check that every doc pointer in docs/README.md resolves), and an empty public grep over the diff. Every claim about the tree holds: the quote "Deliberately **not** a fourth place: a summary doc that restates any of the three" is at docs/README.
- Analyst sagt kollidiert mit: a0ea3b11, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[wissen] Eine Einstiegs-Datei fuer den MENSCHEN am Board — „wie gehe ich an Claude Fleet heran, um es voll zu nutzen".

ANLASS (Owner 2026-08-08): es gibt keine Datei, die das beantwortet. Die Luecke ist eine ZIELGRUPPEN-Luecke, nicht eine Inhalts-Luecke, und wer das verwechselt, baut das Falsche:
  - `CLAUDE.md` ist fuer einen AGENTEN geschrieben (Regeln, die eine Session befolgt) und wird automatisch geladen.
  - `docs/README.md` ist fuer die WISSENSPFLEGE (wo Wissen lebt, welche zwoelf Docs operativ sind).
  - `./state.sh` / `./register.sh` beantworten „was ist gerade".
  - Fuer den MENSCHEN am Board — was tue ich zuerst, was kann nur ich entscheiden, was bedeuten die Knoepfe, welche Fallen gibt es — existiert NICHTS.

DIE GRENZE, die nicht ueberschritten werden darf, und sie steht woertlich in docs/README.md: „Deliberately not a fourth place: a summary doc that restates any of the three." Eine Datei, die die Agenten-Regeln nacherzaehlt, rottet und wird zur Falschaussage — das ist genau die Krankheit, an der das Regal auf 52 Docs wuchs. Diese Datei ist NUR legitim, weil sie fuer einen Leser schreibt, der die anderen drei nicht hat. Also: sie ZEIGT auf sie, sie wiederholt sie nicht. Jede Regel, die auch in CLAUDE.md steht, gehoert hier als EIN Satz plus Zeiger, nie als Kopie.

ZWEI ABNEHMER, und der zweite ist der Grund, warum es sich doppelt lohnt: (a) der Owner und jeder, der das Board zum ersten Mal bedient; (b) dieses Repo ist PUBLIC — diese Datei ist auch das, was das Projekt fuer jemanden lesbar macht, der es findet. Was NICHT hineingehoert: Hostnamen, IPs, Klarnamen, Token (siehe die Pflichtpruefung im Deploy-Abschnitt von CLAUDE.md).

WAS DU AUS DEM REPO ABLEITEN KANNST, und wo du es findest: die Mechanik. Ein Slot, eine Lane, ein Worktree, ein Land (`docs/land-mechanics.md`), der Verify-Gate und was ein gruener Lauf wirklich attestiert (`docs/verify-tiering.md`), der Tier-2-Audit danach, die Queue als das eine Register (`./register.sh`), der Steward als optionale Rolle (`docs/steward.md`), die Harness-Wahl pro Slot (`GET /api/harnesses`), die Gast-Konsole. Leite es ab, behaupte es nicht — jede Zahl und jeder Pfad wird nachgeschlagen.

WAS DU NICHT ABLEITEN KANNST und deshalb ALS LUECKE MELDEN musst, statt es zu erfinden: die DOKTRIN — wie der Owner tatsaechlich arbeitet. Beispiele aus dem laufenden Betrieb, die nirgends niedergeschrieben sind: „lieber eine Lane starten als selbst graben" · „,idle' heisst nicht ,fertig', vier Zustaende sehen gleich aus" · „was nach aussen geht, entscheidet der Owner, nicht die Session" · „eine Vorgabe woertlich zitieren und die Liste dort abschneiden, wo sie erfuellt ist". Schreib fuer diesen Teil ein GERUEST mit den Fragen, die beantwortet werden muessen, und markiere es sichtbar als offen. Der Owner (oder eine Main-Session mit frischem Gespraechsmaterial) fuellt es. Erfundene Doktrin ist schlimmer als eine leere Ueberschrift.

FORM: eine Datei, `docs/` oder Repo-Wurzel — entscheide begruendet und sag im Commit-Body warum. Laenge: was ein Mensch in einem Zug liest. Wenn du ueber ~200 Zeilen kommst, hast du wahrscheinlich angefangen zu wiederholen statt zu zeigen.

DONE-KRITERIUM (hart):
  - Die Datei existiert, ist in `docs/README.md` indexiert (falls sie unter docs/ liegt) und `bun e2e/pins.ts` bleibt gruen — der Pin-Satz haelt den Zeiger-Kontrakt und faellt rot bei einem toten Verweis.
  - Jeder Pfad, jede Route und jedes Kommando darin ist am HEAD nachgeschlagen und existiert. Als Beleg: nenne im Commit-Body, WIE du das geprueft hast (die Pruefschleife aus docs/README.md „Keeping this index honest" ist das Muster).
  - Kein Abschnitt wiederholt eine Regel aus CLAUDE.md laenger als einen Satz; wo mehr noetig waere, steht ein Zeiger.
  - Der Doktrin-Teil ist als GERUEST mit offenen Fragen erkennbar, nicht als Behauptung.
  - Die Public-Pflichtpruefung ist gefahren: `git grep -inE 'example|100\\.64\\.0\\.1'` ueber deinen Diff ist leer.
VERIFIKATION: volle Gate-Kette (`bun e2e/pins.ts` ist die Stufe, die hier wirklich etwas prueft). `./e2e-isolated.sh` NUR, falls du e2e/ anfasst — bei einer reinen Doc-Scheibe also nicht.

NICHT Teil dieser Scheibe: den top-level README umschreiben, docs/README.md umbauen, oder eine der zwoelf operativen Docs anfassen. Wenn dir dabei auffaellt, dass eine davon falsch ist, MELDE es im Bericht — repariere es nicht nebenbei.
```

## `a0ea3b11`  ·  kind=lane  ·  angelegt 2026-08-08 10:14  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — The trap the brief names is true and it is what makes the slice executable: CLAUDE.md is gitignored (.gitignore:32) and a lane only holds a copy (e2e/pins.ts:368 says so in as many words), so the brief prescribes delivering the section as report text — that keeps the work inside the worktree and off shared state. The raw material is really in CLAUDE.md today (e.g. the „Idle" heißt NICHT „fertig" b
- Analyst sagt kollidiert mit: 609744d8, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[wissen] Die ARBEITSWEISE einer Session sauber ablegen — heute liegt sie verstreut zwischen Mechanik und Fallen.

OWNER 2026-08-08: "das ist so bestimmtes wissen das wir irgendwo mal sauber ablegen sollten damit die sessions es verstehen". Anlass war seine Kritik an Session 40 ("du fokussierst dich so viel auf deinen Kontext") — eine Korrektur der ARBEITSWEISE, nicht der Mechanik.

DAS PROBLEM, praezise: `CLAUDE.md` ist mechanisch der richtige Ort (es wird in JEDE Session und JEDE Lane automatisch geladen — nichts sonst hat diese Reichweite). Aber es ist gewachsen als Mischung aus Mechanik (Routen, Flags, Zeilennummern), Fallen (Flake-Familien, Sonden) und eben Doktrin — und die Doktrin steht als einzelne Bullets zwischen Dingen, die ganz anders altern. Eine Session liest zwanzig Regeln ueber `FLEET_*` und findet dazwischen einen Satz darueber, WIE sie arbeiten soll. Das ist der Grund, warum dieselben Korrekturen mehrfach faellig werden.

NICHT ZU VERWECHSELN mit Zeile `609744d8` — die schreibt fuer den MENSCHEN am Board ("wie gehe ich an Claude Fleet heran"). Diese hier schreibt fuer die SESSION ("wie arbeite ich hier"). Zwei Leserkreise, zwei Dokumente; wer sie zusammenlegt, bekommt eines, das keinem der beiden dient.

DIE GRENZE: das darf KEINE vierte Wissensstelle werden (docs/README.md: "Deliberately not a fourth place: a summary doc that restates any of the three"). Die Doktrin gehoert deshalb NICHT in ein neues Doc, sondern als eigener, benannter ABSCHNITT nach oben in `CLAUDE.md` — und alles, was heute Doktrin ist, wird DORTHIN VERSCHOBEN, nicht kopiert. Wenn am Ende dieselbe Regel an zwei Stellen steht, ist die Scheibe gescheitert.

WAS AN ROHMATERIAL VORLIEGT — abgeleitet aus echten Korrekturen, nicht erfunden. Jede dieser Regeln hat einen Vorfall hinter sich, und der Vorfall gehoert dazu, sonst liest sie sich wie eine Meinung:
  - **Treiben, nicht berichten.** (Heartbeat-Text, von zwei Sessions weitergereicht.)
  - **Rechne dein Budget, wenn eine Entscheidung davon abhaengt — aber mach es nicht zum Gespraechsthema.** (Owner 2026-08-08; Session 40 schrieb laufend Arithmetik in ihre Antworten und liess dreimal eine Kette liegen, die gepasst haette. Der Owner musste die Schwelle dreimal anheben, bis sie aufhoerte, sie als Decke zu lesen.)
  - **Bei einem roten Check an frischer eigener Arbeit ist die SONDE der erste Verdaechtige.** (Sechs Instanzen an einem Tag, 2026-08-08.)
  - **"Idle" heisst nicht "fertig" — vier Zustaende sehen gleich aus.** (Dreimal gestolpert, Session 34.)
  - **Die Vorgabe des Owners woertlich zitieren und die Rangliste dort abschneiden, wo sie erfuellt ist.** (docs/scope-inflation.md §7.)
  - **Was optional ist, nicht als Handlungsbedarf praesentieren.** (Owner 2026-08-08 zum Steward: "brauchst du nicht immer einen steward spawnen".)
  - **Zahlen, Pfade und Zustaende nachschlagen statt zitieren; HANDOFF/Notizen/Memory sind Behauptungen.**
  - **Was nach aussen geht, entscheidet der Owner** — nicht die Session (Publizieren, fremde Dienste, Credentials, Maschinen-Ebene).

DONE-KRITERIUM (hart):
  - `CLAUDE.md` hat einen benannten Doktrin-Abschnitt, in dem jede Regel EINEN Satz plus ihren Vorfall traegt. Keine Regel ohne Beleg — eine unbelegte Regel ist eine Meinung und wird von der naechsten Session zu Recht ignoriert.
  - Jede dorthin verschobene Regel ist an ihrer alten Stelle GELOESCHT. Als Nachweis: nenne im Bericht die Zeilen, aus denen du sie geholt hast.
  - Der Abschnitt steht VOR den mechanischen Abschnitten — eine Session liest ihn, bevor sie die erste Route nachschlaegt.
  - `bun e2e/pins.ts` bleibt gruen: der Regelbuch-Pin prueft, dass jeder in CLAUDE.md zitierte Pfad und jede grep-Errand noch aufloest. Wer Text verschiebt, kann beides brechen.
VERIFIKATION: `bun e2e/pins.ts` plus die volle Gate-Kette (die Lane muss landbar bleiben).

DIE FALLE, die diese Zeile fuer eine LANE fast unloesbar macht und die im Brief stehen MUSS: `CLAUDE.md` ist GITIGNORED und wird beim Lane-Spawn nur KOPIERT. Eine Lane sieht ihre Aenderung nie in `git status`, und sie stirbt mit dem Worktree beim Land (docs/ungoverned-artifacts.md). Also: eine Lane liefert den fertigen Abschnitt ALS TEXT im Bericht, und der Haupt-Checkout zieht ihn von Hand nach. Wer das uebersieht, macht die Arbeit zweimal.

Herkunft: Owner 2026-08-08, im Anschluss an seine Kritik an Session 40.
```

## `e7d61b59`  ·  kind=lane  ·  angelegt 2026-08-08 03:11  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The brief declares itself "kein Arbeitsauftrag" and carries no finished state anything could judge — it records a contradiction (briefs/data-saver-messung-2026-08-07.md says both reloads were cold; Lane B's §5 B saw the immutable cache work) and ends by asking whether it was a hard reload, i.e. an open question left for the owner. Both cited files exist (briefs/data-saver-messung-2026-08-07.md, do
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ — kein Arbeitsauftrag, sondern ein Widerspruch, der beim Nachschreiben von `docs/data-saver.md` uebrig blieb und den niemand besitzt.

BEFUND (aus dem Bericht der Lane zu Zeile `cf557dc4`, gelandet als `0db08ac`): der Messbericht `briefs/data-saver-messung-2026-08-07.md` haelt fest, dass **beide beobachteten Reloads kalt waren — der immutable-Cache griff nicht**. Das steht gegen die Verifikation von Lane B, die genau diesen Cache in einem echten Browser hat funktionieren sehen (§5 B, `0fa9d2f`).

WARUM DAS NICHT NICHTS IST: der Cache ist eine der tragenden Annahmen der Data-Saver-Arbeit — wenn er im Feld nicht greift, ist ein Teil der gemessenen Ersparnis eine Laborzahl. Beide Beobachtungen sind ehrlich gemacht; sie widersprechen sich, und der Widerspruch ist bisher nirgends notiert.

WAS ES NICHT IST: keine Regression, kein Rot, nichts blockiert. Die Lane, die es fand, hat es korrekt NICHT gefuellt (es war weder A–D-Ergebnis noch §2-Hypothese) und es dem Owner ueberlassen.

MOEGLICHE AUFLOESUNGEN, ungeprueft: die zwei Reloads waren Hard-Reloads (Shift+Reload umgeht den Cache per Design) · unterschiedliche Browser/Profile · der Cache-Header greift fuer `app.js`, aber die gemessenen Bytes lagen woanders · die Ablesung mass ein Fenster nach einem Deploy, in dem die Datei ohnehin neu war.

Wenn daraus je eine Arbeitszeile wird, ist die erste Frage die billigste: WAR es ein Hard-Reload? Das entscheidet, ob hier ueberhaupt etwas zu erklaeren ist. QUELLE: Session 39 (main), 2026-08-08, aus dem Lane-Report zu `cf557dc4`.
```

## `d375c581`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Die Arbeit reicht per Definition aus dem Worktree hinaus und ist unumkehrbar: sie löscht $TMPDIR/fleet-e2e-instance-*, $TMPDIR/fleet-lane-graph-* und Trail-Dateien — geteilter Maschinenzustand, den parallel laufende Suiten und andere Lanes gerade halten, und der Brief sagt es selbst („gelöschte Trail-Dateien und Instanzverzeichnisse kommen nicht zurück"); schon das Ausprobieren im Worktree wirkt m
- Analyst-Blocker: ["reach", "criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-B 08-07] TITEL: Der Reaper — 39 MB tote Instanzen, 56 MB unbegrenzter Trail, und state.sh sagt es nur
WAS: Die Maschine räumt hinter sich auf, statt es dem Owner anzuzeigen und liegen zu lassen. state.shs Abschnitt „machine hygiene (nothing reaps these)" wird von einer Beobachtung zu einer
Kontrolle.
WERT: Gemessen, gerade eben:
┌───────────────────────────────────────┬─────────────────────────────────────────────────────┬────────────────────────┐
│                                       │                        Menge                        │       reapt von        │
├───────────────────────────────────────┼─────────────────────────────────────────────────────┼────────────────────────┤
│ $TMPDIR/fleet-e2e-instance-*          │ 8 Verzeichnisse, 39 MB (ältestes vom Vortag, 18:57) │ nichts                 │
├───────────────────────────────────────┼─────────────────────────────────────────────────────┼────────────────────────┤
│ $TMPDIR/fleet-lane-graph-*            │ 19 Verzeichnisse, 2,4 MB                            │ nichts                 │
├───────────────────────────────────────┼─────────────────────────────────────────────────────┼────────────────────────┤
│ e2e-trail/ + $TMPDIR/fleet-e2e-trail/ │ 830 Dateien, 56 MB, ~4,4 MB/Tag                     │ nichts                 │
├───────────────────────────────────────┼─────────────────────────────────────────────────────┼────────────────────────┤
│ tote tmux-Sockets                     │ 2                                                   │ e2e-stage.sh:110-116 ✓ │
└───────────────────────────────────────┴─────────────────────────────────────────────────────┴────────────────────────┘
Die Socket-Zeile ist das Vorbild und der Beweis, dass die Stelle richtig ist: derselbe Ort, unter demselben Lock, mit derselben Vorsicht (Liveness pro Kandidat geprüft, nie aus dem Namen
geschlossen). docs/e2e-trail.md §3 sagt es selbst: „Growth is unbounded and unmanaged … until then, rm old files by hand if it matters." — und Idee 1 ist genau die Query-Schicht, der die Retention
laut diesem Satz gehört. Ein Instanzverzeichnis, das den Vortag überlebt, ist außerdem ein Befund: sein Wrapper hat rm -rf nie erreicht, also ist ein Lauf abgestürzt oder wurde getötet.
SKIZZE: Drei Zeilen im vorhandenen Reap-Block von e2e-stage.sh, jede mit derselben Konservativität wie die Socket-Zeile: (a) fleet-e2e-*instance-* älter als 24 h und ohne lebenden Prozess mit
diesem cwd → weg, und die Zahl wird genannt, nicht still verschluckt (ein toter Instanzordner ist die Signatur eines abgestürzten Laufs; still zu löschen wäre Beweisvernichtung). (b)
fleet-lane-graph-* genauso. (c) Trail-Retention: Läufe älter als N Tage weg, aber rote Läufe behalten — sie sind die Grundgesamtheit von Idee 1, und Zeilen mit ok:false sind ein winziger Bruchteil
der 197 562. Deshalb kommt (c) nach Idee 1 oder mit ihr, nie davor: eine Retention ohne Leser wirft weg, was noch nie jemand gelesen hat. FILES: e2e-stage.sh, state.sh (die Zeile „nothing reaps
these" wird zur Wahrheit oder zur Ausnahme), docs/e2e-trail.md §3.
AUFWAND: S für (a)+(b). (c) gehört an Idee 1.
REVERT: Nicht trivial im Ergebnis, aber trivial im Code. Der Commit-Revert ist ein Zeilen-Revert — aber gelöschte Trail-Dateien und Instanzverzeichnisse kommen nicht zurück. Deshalb ist (c) an Idee
1 gekoppelt und muss beim ersten Lauf ein --dry-run-Äquivalent haben, das nur zählt und benennt.
GEPRÜFT: Alle vier Zahlen selbst gemessen (du, ls). e2e-stage.sh:104-116 gelesen — der Socket-Reap existiert, mehr nicht. docs/e2e-trail.md §3 zitiert. BACKLOG B-16 „Orphan-reap on lane kill"
gelesen (BACKLOG.md:773) und abgegrenzt: das sind git-Worktrees beim Lane-Kill, nicht $TMPDIR, und das Register führt es bereits als erledigt. Keine Queue-Zeile zu TMPDIR/Trail-Retention. Nicht in
§7.

PROVENIENZ: Ideen-Scout B (Lane fleet/260806222332-e42f, 2026-08-07), Block 6 — Vollreport beim Owner.
```

## `17068154`  ·  kind=lane  ·  angelegt 2026-08-07 19:42  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Every code claim checks out at the cited commit and at HEAD: `TRAIL_MAX_FILES = 400` sits at server.ts:9058 in 832bb68 (server.ts:10634 today), `trailStatsFromQuery` at :9103 reads only days/suite/check, candidates are sorted newest-first and `slice(0, TRAIL_MAX_FILES)`d, `filesOmitted` is served honestly, and trailstats.ts:270-272 derives `never-failed` from `failRuns.size === 0` with `not-in-win
- Analyst sagt kollidiert mit: 9bcc460e, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[trail] `never-failed` wird ueber einem Deckel behauptet, der 741 von 1141 Dateien weglaesst — die Route dreht ihren eigenen Zweck genau im Anlassfall um

BEFUND, gemessen am deployten Stand `832bb68` (2026-08-07, direkt gegen die Live-Route und gegen die Trail-Dateien nachgezaehlt — nicht abgeleitet):

Punktabfrage `GET /api/flakes?check=FIX1: concurrent merges settle to a single clean resolution (lane intact, no corruption)`
  → **`verdict: "never-failed"`, runs 74, failedRuns 0**
Derselbe Check ueber die vollstaendigen Trail-Dateien gezaehlt:
  neueste 400 Dateien (= was die Route liest): runs 74, failRuns 0, saubere Baeume 0
  die 741 AUSGELASSENEN Dateien:               runs 169, failRuns **9**, saubere Baeume **3**
  alle 1141:                                   runs 243, failRuns 9, saubere Baeume 3
Die bauende Lane hatte genau diese 9/241 auf 3 sauberen Baeumen selbst als `NOT-YOUR-DIFF` im Report (DONE-5-Beleg, 60-Tage-Fenster ueber 1115 Dateien). Die Route sagt am selben Tag „never-failed".

MECHANISMUS, am Code belegt: `TRAIL_MAX_FILES = 400` (`server.ts:9058`) ist eine harte Konstante und ueber die Route NICHT steuerbar — `trailStatsFromQuery` (`:9103`) liest nur `days`, `suite`, `check`. Kandidaten werden `newest-first` sortiert und dann `slice(0, TRAIL_MAX_FILES)` (`:9084-9085`). Folge: `days` kann das Fenster nicht ueber den Deckel hinaus aufmachen — gemessen sind `days=14` und `days=60` byte-gleich, beide `files 400 / filesOmitted 741`. Die gelesene Spanne reicht zurueck bis 2026-08-06 19:51; der Trail beginnt am 2026-07-27. Weggelassen wird also genau das AELTERE Material — dort, wo historische Flake-Belege per Definition liegen.

KOSTEN, und sie treffen den Anlassfall: die Zeile existierte, um den 7-Minuten-Beweislauf zu ersetzen. Eine Lane mit einem FIX1-Rot fragt, bekommt „never-failed in 74 runs" — positive Evidenz der Abwesenheit — und schliesst daraus, das Rot sei ihres. Sie faehrt den Beweislauf trotzdem, oder schlimmer: sie sucht einen Regress, den es nicht gibt. Das ist teurer als kein Werkzeug, weil ein Werkzeug geglaubt wird.

WAS NICHT DEFEKT IST, und den Fund erst moeglich gemacht hat: die Route serviert `filesOmitted: 741` ehrlich mit. Die Antwort traegt also die Information, dass ihr eigenes Verdict unsicher ist — sie konsultiert sie nur nicht. Auch die vierwertige Vokabel ist richtig gebaut; `not-in-window` existiert bereits fuer „nicht beobachtet".

MOEGLICHE SCHNITTE (Owner/Lane entscheidet, nicht vorentschieden): (a) `never-failed` darf nicht emittiert werden, solange `filesOmitted > 0` — dann `insufficient-evidence` mit der Zahl im Feld; (b) den Deckel als Parameter oeffnen (mit hartem Maximum), damit `days` etwas bewirken kann; (c) beides. Was NICHT taugt: den Deckel einfach hochsetzen — 1141 Dateien wachsen ~4,4 MB/Tag weiter, und der Deckel ist der Grund, warum die Abfrage in ~2 s antwortet.

BERUEHRT: `d375c581` (der Reaper) — solange nichts den Trail beschneidet, waechst der Anteil des Ausgelassenen monoton. Die beiden Zeilen sind nicht dieselbe Arbeit, aber sie zeigen auf dieselbe Ursache.
FLAECHE: `server.ts` (`TRAIL_MAX_FILES`, `trailStatsFromQuery`, der Leseblock `:9075-9092`) · `trailstats.ts` (Verdict-Ableitung) · `e2e/trailstats.ts` (ein Check, der beweist: bei ausgelassenen Dateien kommt NIE `never-failed`).
QUELLE: Verifikation der Live-Route durch main-37 nach dem Deploy von `832bb68`, 2026-08-07.
```

## `e4f87152`  ·  kind=lane  ·  angelegt 2026-08-07 14:50  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Der Umfang ist trotz der Drei-Wege-Liste entschieden — „EMPFEHLUNG: (a) zuerst und allein" — und nur (a) trägt einen Beweisgegenstand: ein Pin, der einen Slot mit Steward-Label OHNE Auto anlegt und prüft, dass das Feld „kein Puls" sagt, plus die Gegenprobe mit Auto; das ist in `e2e/steward-outcomes.ts` (existiert) beurteilbar und ändert kein Verhalten. Die Ursache ist am Baum belegt: `autos = auto
- Analyst sagt kollidiert mit: e17a19b0, dabd1880, 55264c21, 8235c4bc, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Der Steward ist eine ROLLE, sein Puls haengt an einer SESSION — und stirbt still bei jedem Neu-Oeffnen

BEFUND (2026-08-07, main-36). Der Steward hatte heute ab ~10:1xZ einen stuendlichen /rundgang als Auto (`d6128b1e`). Es hat FUENFMAL gefeuert (server.log 1681, 1689, 1698, 1708, 1727) und war danach weg. Um 12:23Z existierte auf der ganzen Maschine genau EIN Auto — der Heartbeat auf dem Main-Slot. Letzter Journaleintrag: 10:37Z. Niemand hat es gemerkt, bis der Owner danach fragte.

URSACHE, im Code und nicht vermutet: `server.ts:1853` und `:1899` loeschen beim (Neu-)Oeffnen bzw. Killen eines Slots ALLE seine Autos — `autos = autos.filter((x) => x.slot !== s.id)`, mit dem Kommentar "and no inherited schedules" / "neither must a scheduled prompt". Das ist RICHTIG so: eine neue Session darf die Zeitplaene der alten nicht erben. Die Log-Reihenfolge zeigt genau diesen Ablauf: `auto d6128b1e: sent to slot 12` (1727), unmittelbar danach `slot 12: created tmux session 's12'` (1728) — Session 35 hat einen frischen Steward geoeffnet und damit dessen eigenen Puls mitgeloescht.

DAS EIGENTLICHE PROBLEM IST NICHT DAS LOESCHEN, SONDERN DIE STILLE. Der Steward ist die einzige Rolle der Maschine, die per Konvention ueber Sessions hinweg existiert (Label `⚙ steward`, eigener Worktree, eigenes Token). Ihr Puls ist aber an die Lebensdauer EINER Pane gebunden, und die Absenz hat keinen Leser: kein Feld sagt "dieser Steward hat keinen geplanten Puls", kein Digest, keine Zeile im Board. Genau die Fehlerform, die dieses Repo sonst ueberall benennt — die Maschine weiss es und sagt es niemandem.

SOFORT GETAN (kein Ersatz fuer den Fix): Auto `5432e43a` neu angelegt — /rundgang, everySec 3600, runs 100, idleSec 900. Bewusst NICHT `perpetual: true`: das Flag existiert (createAutoForSlot) und ist ausdruecklich owner-only, weil "the run-forever cadence decision is the owner's".

DREI WEGE, sie schliessen sich nicht aus — der Brief muss entscheiden, welcher:
(a) SICHTBAR MACHEN, das Billigste. Ein Feld auf dem Owner-Poll bzw. der Steward-Row: "Puls geplant: ja/nein, naechster in Xm". Eine Absenz, die man sehen kann, ist kein Ausfall mehr. Loest das gemeldete Problem vollstaendig und aendert kein Verhalten.
(b) AN DIE ROLLE BINDEN. Wird ein Slot mit Label `⚙ steward` geoeffnet, bekommt er den Puls automatisch — dieselbe Bedingung, unter der `FLEET_STEWARD_TOKEN` in die Pane gebacken wird (`s.label === STEWARD_LABEL`, ensureSlot). Der Traeger existiert also schon; nur haengt heute das Credential daran und der Zeitplan nicht. ACHTUNG: das ist ein Automat, der von selbst Prompts erzeugt — Kadenz und Deckel gehoeren dem Owner, nicht dem Default.
(c) PERPETUAL. Aendert nichts an dieser Ursache — die Loeschung bei :1853/:1899 ist unbedingt und trifft ein perpetual-Auto genauso. Nur nennen, damit niemand es faelschlich fuer den Fix haelt.

EMPFEHLUNG: (a) zuerst und allein. (b) erst danach und nur mit Owner-Entscheid ueber Kadenz.

VERIFIKATION fuer (a): ein Pin, der einen Slot mit Steward-Label OHNE Auto anlegt und prueft, dass das Feld "kein Puls" sagt — und einen MIT Auto, der die naechste Faelligkeit nennt. Die Absenz-Seite ist der Beweisgegenstand, nicht die Anwesenheit.
FLAECHE: server.ts (Projektion) + src/client.ts (Anzeige) · e2e/steward-outcomes.ts
QUELLE: eigene Messung main-36 am 2026-08-07 (server.log, audit-Ledger, Owner-Poll), Owner-Hinweis "dass steward nicht richtig laeuft ist ein wichtiger punkt"
```
