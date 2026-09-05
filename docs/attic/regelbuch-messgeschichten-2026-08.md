# Attic: Regelbuch-Messgeschichten 2026-08 (aus `CLAUDE.md` umgezogen 2026-08-18)

**Status:** die Messgeschichten und Korrektur-Historien hinter vier Regeln, die in `CLAUDE.md`
BETRIEB bleiben (Supervisor-Entscheid beim Regelbuch-Schnitt: die Regel bleibt im Präsens stehen,
die Geschichte zieht hierher — vollständig, nichts gelöscht). Die
„hier stand X"-Korrektur-Bauformen sind absichtlich UNVERÄNDERT mitgenommen: die Korrektur neben
dem korrigierten Satz ist die teuerste Lektion dieses Repos. Bei Widerspruch gilt der Code.

## §1 Rückweg-Mechanismen beim Abwenden (Watch vs. Hintergrund-Watcher vs. One-Shot-Auto)

Heutige Regel: `CLAUDE.md` §Einstieg („leg dir den Rückweg — als Mechanismus"). Originaltext mit
beiden Korrekturen (2026-08-07 und 2026-08-09):

- **Die Regel darüber sagt, WIE du eine Lane liest — nicht WANN. Das war die Lücke am 2026-08-07 (Session 35),
  und sie kostete einen fertigen 807-Zeilen-Diff ~20 min Liegezeit, bis der Owner es sagte.** Eine Erdung ist
  ein SCHNAPPSCHUSS: wer eine Lane (oder einen async Merge, oder eine Suite) losschickt und sich abwendet,
  arbeitet danach auf einem toten Bild und merkt es nicht — es gibt **keinen eingehenden Kanal**, niemand ruft
  an. **Also: bevor du dich abwendest, leg dir den Rückweg — als Mechanismus, nicht als Vorsatz.** Zwei
  taugen, und sie sind nicht gleichwertig:
  - **(1) ein Hintergrund-Watcher** (`run_in_background` + `until <Bedingung>; do sleep 10; done`) auf die
    Bedingung, die dich wirklich interessiert (`ahead>0 && dirty=0`, `git rev-parse HEAD` bewegt sich, Verdict
    da) — ein EREIGNIS, kein Timer, er schreibt in keine Pane, und die Harness weckt dich.
    **Fuer eine FREMDE Lane taugt `ahead>0 && dirty=0` nicht — sie kann nicht committen, also ist ihr SOLL
    `dirty>0 && ahead=0`. Und STILLE ALLEIN reicht dort nicht:** ein GPT-Modell schweigt waehrend eines langen
    Denkzuges minutenlang, 120 s Ruhe haben mich am 2026-08-09 einmal mitten in der Arbeit geweckt (die Lane
    editierte gerade `server.ts`). Zwei Klauseln, unabhaengig voneinander: `#{session_activity}` bewegt sich
    seit >=3 min NICHT **und** die Pane zeigt keinen Arbeits-Indikator
    (`capture-pane -p | grep -c 'Working\.\.\.\|Esc to interrupt'` = 0). `idleSec`/`idle`/`observed`/`sessionId`
    liefert der Owner-Poll NICHT (alle `null` bzw. absent, Data-Saver) — nimm tmux direkt.
  - **(2) ein One-Shot-Auto auf den EIGENEN Slot** (`POST /api/slots/:id/autos`, `everySec:null`) — nur ein
    Timer, du musst die Dauer raten, und er trägt die `sendText`-Gefahr (paste-buffer + Enter ohne Clearing:
    ein ungesendeter Owner-Entwurf in deinem Composer verschmilzt mit dem Prompt).
  **(1) ist die Vorgabe, (2) die Ausnahme.** Beides bleibt eine Krücke: der echte Fix ist Queue-Zeile
  `00e5f771` — die Maschine WEISS, wann eine Lane fertig ist (`doneLooking`, auf dem 2-s-Poll, mit dem
  Kommentar „nothing acts on it"), und sagt es niemandem. **Korrektur 2026-08-07:** Es gibt jetzt einen
  dritten Weg, und für „ich warte auf eine LANE" ist er der richtige: **`POST /api/self/watch`** (Abschnitt
  „Self-scheduling" unten). Der Server kennt `doneLooking` auf seinem Tick und tippt dir genau einmal in die
  Pane — kein geratenes Intervall, kein `sendText`-Risiko eines Autos, kein Prozess, der mitlaufen muss. (1)
  bleibt richtig für alles ANDERE, worauf man warten kann (ein `git rev-parse`, ein Verdict, eine Datei); (2)
  bleibt die Ausnahme. **Aber: die Route ist Nicht-Lane-only** — aus einer Lane heraus bekommst du 409, dort
  bleibt (1) das Mittel. Der „sagt es niemandem"-Teil von `00e5f771` ist für Owner und Nicht-Lane-Session
  damit erledigt.
  **KORREKTUR 2026-08-09: `POST /api/self/watch` DECKT AUCH EINE FREMDE LANE AB — der Absatz oben („nimm
  tmux direkt") ist überholt und hat mich einen halben Tag Handarbeit gekostet.** Der Watch feuert nicht
  auf `doneLooking` allein, sondern auf `laneWatchSignal` (`lane-signals.ts:92`), und das ist eine
  ODER-Verknüpfung ZWEIER Prädikate: `done-looking` (idle + clean + `ahead>0`) **oder**
  `host-commit-looking` (`HOST_COMMIT_LOOKING_RULES`, `lane-signals.ts:73` — `hostCommits` + idle +
  `dirty>0` + `ahead===0` + `awaiting:null`), also genau die Form, die eine pi-/codex-Lane erreichen KANN.
  Die Nachricht sagt dann ausdrücklich „ready for a host commit" und nennt `POST /api/slots/:id/commit`
  als nächsten Schritt. Beide Prädikate sind per Konstruktion disjunkt. **Also: für JEDE Lane ist (1) nicht
  mehr das Mittel, sondern der Watch** — ich habe am 2026-08-09 den ganzen Tag `capture-pane`-Schleifen von
  Hand gebaut, weil dieser Absatz noch die Welt vor der Arbeitsteilung beschrieb. (1) bleibt richtig für
  alles, was KEINE Lane ist. Die Lehre ist die alte, teurer bezahlt: **bei einem Widerspruch gilt der Code,
  nicht dieses Dokument** — und ein Absatz, der eine Handarbeit empfiehlt, ist der erste, den man gegen den
  Code prüft.

## §2 Der Land-Takt (Streichung der 12-min-Wartepflicht, Owner-Entscheid 2026-08-07)

Heutige Regel: `CLAUDE.md` §Einstieg („Der Land-Takt"). Die zwei Messungen, die die alten
Begründungen überholten:

- **Der Land-Takt: seriell ja — der 12-min-Takt NEIN MEHR** (Owner-Entscheid 2026-08-07, an mich delegiert;
  die alte Fassung stand hier als „härteste Grenze der Maschine"). Es gibt EINEN Suite-Mutex für alles; ein
  Land = ~110 s Gate, der Post-Land-Audit ~9,4 min auf demselben Lock. **Was bleibt: nie zwei Lands
  gleichzeitig** — das Gate serialisiert ohnehin, ein zweiter Land-Versuch daneben ist Schlange, kein Gewinn.
  **Was gestrichen ist: die Wartepflicht auf den Audit.** Das nächste Land darf sofort. Beide alten
  Begründungen hat die Maschine überholt:
  - **(1)** der Sammel-Kollaps existiert im Code (`server.ts:5114` `drainPostLandAudits`, Kontrakt bei
    5096–5102 — was während eines laufenden Audits landet, fällt in GENAU EINEN Folgelauf, dessen `covers`
    alle nennt) und hat **nie gefeuert**, weil die Doktrin die Lands so weit auseinanderzog:
    `covers`-Histogramm über alle 75 Zeilen `post-land-audits.jsonl` = **{1: 75}** (nachgemessen 2026-08-07).
  - **(2)** Der Verify-Tod in der Schlange (469 s von 499 s Lock-Warten am 2026-08-06) ist seit `08dc17a`
    repariert — Warte- und Arbeitsbudget sind getrennt (`VERIFY_WAIT_MS` 900 s / `VERIFY_TIMEOUT_MS` 300 s,
    `server.ts:4399` + 4600 ff.), ein `waitedOut` ist nie `ok:false` („says nothing whatever about the tree",
    4671).
  **Wissentlich in Kauf genommen:** ein Gate darf jetzt hinter einem Audit warten (15-min-Budget, nicht mehr
  tödlich), und ein ROTES Sammel-Audit nennt N Lands statt einem — der Bisect ist dann deiner, `undo-land`
  deckt nur das neueste. Bei Basisrate 2 echte von 18 roten Audits tragbar. Rückfalltür: diese Zeile
  zurückdrehen, sonst nichts. Parallelität gilt weiterhin fürs Produzieren, nie fürs Landen.

## §3 Fremde Harnesses briefen (Dispatch-Durchreichung, pi lädt AGENTS.md)

Heutige Regel: `CLAUDE.md` §Einstieg („Eine Lane muss nicht claude sein"). Originaltext mit den
Selbst-Belegen und der am selben Tag überholten pi-Messung:

- **Eine Lane muss nicht claude sein — und ein FREMDES Modell will einen DICHTEREN Brief** (Owner-Entscheid
  2026-08-08; Tiefe: `docs/tailored-context.md` §8, dort steht das Warum und die Kreditiv-Regel). Drei Dinge,
  die du sonst neu lernst:
  - **(1) Der Dispatch-Knopf reicht `{harness, model, effort}` durch — `{harness, model}` seit 2026-08-08
    (`11d113a`), `effort` seit 2026-08-09 (`76e948c`; bis dahin wurde ein `effort` im Body STILL ignoriert und
    die Lane lief auf dem Adapter-Default `medium`)** (die Fassung davor
    stand hier als „kann kein Harness übergeben"; sie galt bis zu diesem Land und hat in dieser Session
    dreimal Handarbeit gekostet). Die Queue-Zeile behält damit ihren `slot`-Link, also Requeue-Verhalten und
    Ledger-Zuordnung wie bei einer claude-Lane — belegt an sich selbst: `e7a88a30` schloss sich beim Land
    selbst, während `9a437d5d` und `9fb5ebf8` (über `/api/lanes` gestartet) von Hand geschlossen werden
    mussten. Der Umweg über `POST /api/lanes` + `POST /send` ist nur noch nötig, wenn du gar keinen Task hast;
    er kostet weiterhin den Link. Modell-Validierung bleibt zweigeteilt (claude → `MODEL_RE`, fremd →
    `HARNESS_MODEL_RE`). **Der Tick erbt davon nichts:** er ruft die kurze Form, und `dispatchTask` weist
    einen fremden Harness auf einem unbeaufsichtigten Aufruf selbst ab. Eine Ausnahme, die man kennen muss,
    weil sie ein Gate aufweicht: `briefAndSend` waivt auf dem OWNER-Pfad zusätzlich das harness-Gate
    (`canDeliver {harness:false}`) — dieselbe Waiver, die `land`/`⏫ author`/`💾 commit` schon nehmen, denn die
    Policy beantwortet „darf etwas UNBEAUFSICHTIGTES diesen Slot fahren", und ein Klick, der den Harness
    benannt hat, ist das nicht. Das **Alive**-Gate bleibt und ist hier das sicherheitskritische (eine Pane
    ohne Agent ist eine Shell, und der Brief liefe dort als Kommando).
  - **(2) ÜBERHOLT AM SELBEN TAG — `pi` lädt seit `b3c08e6` NICHT mehr `CLAUDE.md`, sondern `AGENTS.md`.**
    Hier stand „pi lädt `CLAUDE.md` von selbst (an der Pane verifiziert 2026-08-08: `[Context] CLAUDE.md`
    beim Boot)", und das stimmte, bis es die getrackte `AGENTS.md` gab. Gegenmessung 2026-08-08 nachmittags
    an einer Live-Pane, beide Dateien im Baum (`CLAUDE.md` 73507 B, `AGENTS.md` 5125 B): pi's Start-
    `[Context]` nennt **`AGENTS.md` allein**. Eine pi-Lane fällt damit still vom vollen Regelbuch auf den
    dünnen Zeiger zurück — kein Verlust, weil `AGENTS.md` ausdrücklich zum Lesen von `CLAUDE.md` auffordert,
    aber eine Verschlechterung von „automatisch geladen" zu „hingewiesen". Die Lehre ist die ALTE, nur
    teurer bezahlt: an der Pane nachsehen statt annehmen — und zwar ERNEUT, wenn sich der Baum ändert, denn
    diese Messung hat eine Halbwertszeit von Stunden gehabt. Beim NÄCHSTEN Adapter nicht annehmen, sondern an der Pane
    nachsehen.
  - **(3)** Was ein schwächeres Modell braucht, ist nicht ein kleinerer, sondern ein VOLLSTÄNDIGERER Brief:
    Verify-Kommando ausgeschrieben, Done-Kriterium als prüfbarer Satz, Verbote benannt statt vorausgesetzt.
    Runterskaliert wird der UMFANG der Aufgabe, nie ihre Schärfe.


## §4 Wie die Verify-Kette deckungsgleich mit dem Land-Gate wurde (2026-08-15)

Heutige Regel: `CLAUDE.md` §Lane discipline (der Verify-Block). Die Angleichungs-Geschichte samt
der zwei historischen Gate-Löcher:

  **Seit 2026-08-15 ist diese Zeile Schritt für Schritt der Live-Land-Gate — vorher war sie es NICHT, und
  das war der teure Teil:** `watchdog.sh:91` fuhr kein `bun run build`, während AGENTS.md und Fleets eigenes
  `localProof.steps` (`verify-proportion.ts`, `LOCAL_PROOF_STEPS`) es jeder Lane empfahlen. Ein Bruch, den
  nur der Bundler sieht (`src/client.ts`, `src/share.ts`), kam am Gate vorbei. Angeglichen wurde AUFWÄRTS
  (Build in `VERIFY_CMD`, `merge-prompt.ts` explizit in alle drei tsc-Listen), und `RULE_VERIFY` in
  `e2e/pins.ts` vergleicht seither die ORDNUNG der ganzen Schrittkette über alle drei Quellen statt nur
  Suiten- und tsc-Liste — der alte Pin hieß „exactly" und deckte zwei von sieben Schritten. Diese drei
  Suiten SIND der Live-Land-Gate, und `bun e2e/pins.ts` ist seine ERSTE Stufe (`watchdog.sh:91`, `VERIFY_CMD`
  — bei Abweichung gilt die Datei, nicht diese Zeile). **Korrektur 2026-08-07: `e2e/pins.ts` stand hier nur
  als tsc-Ziel, das Gate FÜHRT es aus** — also dieselbe Falle wie am 2026-07-28 (da fehlten
  `./e2e-security.sh` und drei tsc-Dateien): eine Lane konnte am Gate an einem Check scheitern, den sie nie
  lief. Er kostet Millisekunden, kein Server, kein tmux, und prüft die Muss-Paare, deren andere Seite kein
  TypeScript ist (Shell, Doc) — genau die Drift, die kein Compiler sieht.

## Runde 2 (2026-08-18): die Praesens-Kur

In Runde 2 wurden Bloecke in `CLAUDE.md` ins Praesens verdichtet; die Regel steht dort weiter,
hier liegt je Block der vollstaendige Original-Wortlaut (IP-sanitiert: `<fleet-host>`).
Die Korrektur-Bauformen darin sind absichtlich unveraendert. Bei Widerspruch gilt der Code.

## §5 checkout-- im Lane-Worktree (Originalblock)

- **`git checkout -- <datei>` IM LANE-WORKTREE LOESCHT DIE ARBEIT DER LANE, wenn sie dieselbe Datei
  uncommittet haelt** (mir passiert 2026-08-09, Session 44: eine Mutationsprobe an `server.ts` im Worktree
  von `fleet/260808213248-74d6`, danach `checkout --` — weg waren 98 Zeilen fremder, ungesicherter Arbeit).
  Die Falle ist die UEBERTRAGUNG: bei der Lane davor war genau dieselbe Probe harmlos, weil `server.ts` dort
  unberuehrt war, und daraus wurde ein Handgriff. **Seit der Arbeitsteilung ist der Normalfall aber, dass
  eine fremde Lane fertige Arbeit UNCOMMITTET haelt** (sie KANN nicht committen) — im Lane-Worktree gibt es
  also keinen sicheren `checkout --` mehr. Regel: eine Mutationsprobe an einer Datei, die eine Lane
  uncommittet haelt, laeuft ueber `git stash push -- <datei>` + `stash pop` oder eine Kopie, nie ueber
  `checkout --`; besser noch: **erst der Host-Commit, dann die Probe** — dann ist `checkout --` wieder
  harmlos, und das ist der eigentliche Fix. Erholung kostete: die Lane hat ihre sieben Stellen aus dem
  eigenen Gedaechtnis neu eingetragen (der Compiler war das Netz, weil die uebrigen Dateien die neuen Namen
  schon referenzierten) plus ein zweiter 11-min-Suite-Lauf.

## §6 Kontext-Schwelle 44 % (Originalblock)

- **Kontext-Schwelle fuer eine MAIN-Session: ~44 %** (Owner-Entscheid 2026-08-08; im selben Gespraech von 40
  auf 42 auf 44 nachgezogen — die RICHTUNG ist die Botschaft, die alten Zahlen waren zu eng). Dort BEGINNT die
  Uebergabe: laufende Kette zu Ende fahren, ungefragt `HANDOFF.md` schreiben, Nachfolge selbst spawnen. Vier
  Saetze dazu, und der erste ist der, an dem sich geirrt wird:
  - **Die Schwelle ist der Startpunkt der Uebergabe, keine Decke, unter die die fertige Arbeit passen muss.**
    Session 40 hat genau das verwechselt und die Handoff-Reserve AUF die Schwelle addiert — und deshalb eine
    fertig gebriefte Lane liegen lassen, die bequem gepasst haette. Die Reserve liegt HINTER der Schwelle. Von
    44 % sind es noch ~39 Punkte bis zum 83-%-Kompaktierungs-Kliff, dem einzigen dokumentierten
    Verlustereignis.
  - **~36 % ist der ANKER fuer einen Lane-Start, kein Zaun** (ausdruecklich halb dynamisch — eine harte Kante
    ersetzt Urteil durch eine Zahl). Darunter ohne Begruendung. Darueber erlaubt, wenn du die Kosten der Kette
    BENENNEN kannst und sie bis ~44 % passt — und dann gehoert die Schaetzung in deine sichtbare Ausgabe,
    damit der Owner die Wette sieht statt sie zu erraten.
  - **Die Kosten haengen an der ART der Restarbeit, nicht an ihrer Menge.** Eine Lane
    briefen/ueberwachen/landen/deployen ist billig und gut vorhersagbar (S39: ~23 Punkte fuer NEUN Lands, ~2,5
    je Land). Selbst am Host graben — Untersuchung, Handlauf, ein Skript, das du schreibst — ist der teure
    Teil und schlecht schaetzbar (S40: ~19 Punkte fuer zwei Lands PLUS die Container-Untersuchung und den
    Worker-Wrapper; die Lands waren darin der billige Posten). Darauf zielt der Owner-Satz "es sind ja
    worktrees". Eine eigene Grabung anzufangen ist auch UNTER dem Anker meist falsch — dort zaehlt nicht die
    Schwelle, sondern dass du ihre Kosten nicht schaetzen kannst.
  - **Fixkosten, damit die Zahlen nachrechenbar bleiben statt Gefuehl zu sein:** Erdung bis "ich weiss, wo ich
    bin" ~7,6 % (an S38 gemessen), Handoff-Schreiben + Nachfolge-Spawn ~2–4 %. Seit dem `ctx`-Sensor
    (2026-08-07) notiert jeder Handoff seinen `ctx` beim Uebergeben UND was die Session produziert hat — so
    steht die Schwelle nach ein paar Sessions auf Daten.
    **DEN EIGENEN FUELLSTAND MISST DU, DU SCHAETZT IHN NICHT — und bis 2026-08-10 hat das keine Session
    getan.** Hier stand nur „notiert jeder Handoff seinen `ctx`", nirgends WO man ihn abliest; Folge: sechs
    Handoffs in Folge tragen eine Tilde (`~35` `~40` `~68` `~39` `~40` `~40`), und die Haeufung bei 40 ist
    das Ankern an der Schwelle, ueber die man gerade nachdenkt. Die Schwelle stand also auf Schaetzungen,
    waehrend dieser Absatz „auf Daten" behauptete — und der Owner hat sie auf dieser Grundlage von 40 auf
    42 auf 44 nachgezogen. Das Kommando ist ein Einzeiler, `ctx` steht am eigenen Slot im Owner-Poll:
    ```
    curl -s -H "authorization: Bearer $(python3 -c "import json;print(json.load(open('fleet.json'))['token'])")" \
      http://<fleet-host>:8790/api/sessions \
      | python3 -c 'import json,sys,os; s=[x for x in json.load(sys.stdin)["slots"] if x["id"]==int(os.environ["FLEET_SELF_SLOT"])][0]; print(s["ctx"])'
    ```
    `FLEET_SELF_SLOT` steht in jeder Pane. `ctx: null` heisst NICHT „leer", sondern unmessbar — ein
    GPT-Slot hat es immer (`contextWindowFor` kennt das Modell nicht, Zeile `e2784b16`), dort bleibt die
    Selbstauskunft der Lane das einzige Mittel. Und eine geschaetzte Zahl gehoert nie ohne Tilde in einen
    Handoff: sie sieht sonst aus wie eine Messung und wird als eine weiterverwendet.

## §7 GPT-Lane briefen (Originalblock)

- **WENN DU EINE GPT-LANE BRIEFST, RECHNE MIT 258 400 STATT 1 000 000** (Owner-Vorgabe 2026-08-08
  abends: „ab jetzt sollten wir die gpt modelle für alles benutzen" — plus „villeicht kann die main
  session das mitbedenken wenn es die lane prompted"). Das ist keine Stilfrage, es ist Arithmetik,
  und drei Zahlen tragen sie:
  - **Das Fenster.** 272 000 nominal × `effective_context_window_percent` 95 = **258 400**, und
    `max_context_window` steht ebenfalls auf 272 000 — auf dem Abo-Pfad gibt es keine größere Stufe.
    Zwei unabhängige Quellen, beide von Codex selbst: sein `models_cache.json` und ein nativer
    Rollout. pi verkleinert nichts, es reicht dieselbe Zahl durch. (Über die reine API sind größere
    Fenster dokumentiert — anderer Zugangsweg, andere Rechnung, hier nicht gemessen.)
  - **96 % des Verbrauchs ist INPUT, nicht Denken.** An einer echten Session gemessen: kumulativ
    428 916 Input gegen 16 701 Output, davon 6 717 Reasoning. Ein GPT-Modell denkt sparsam, und das
    spart echtes Geld — aber es füllt das Fenster nicht. Was es füllt, sind Gesprächsverlauf und
    **Tool-Ausgaben**, die jeder Turn erneut mitschickt: ein einzelner Turn-Input lag bei 77 804,
    also 30 % des Fensters. **Der Hebel ist Tool-Ausgaben-Disziplin, nicht Modellwahl.**
  - **Fixkosten fallen in BYTES an, nicht in Prozent** — das ist der unintuitive Teil. Die
    Erdungskosten einer MAIN-Session (~7,6 % von 1M ≈ 76 000 Tokens) wären auf 258 400 **29 %**.
    Also: die Schwellen dieses Regelbuchs (44 % Übergabe, ~36 % Lane-Start) sind auf 1M hergeleitet
    und dürfen NICHT übertragen werden. Wer sie für ein GPT-Fenster braucht, leitet sie neu her.
  **Was das für den BRIEF konkret heißt, und es ist eine Checkliste, keine Haltung:**
  - **Nenne die Dateien MIT Zeilenbereich, wo du ihn kennst.** „Sieh dir `server.ts` an" sind 13 593
    Zeilen. Ein Brief, der `server.ts:12108-12140` sagt, kostet ein Promille davon.
  - **Schick sie nicht wholesale ins Regelbuch.** `CLAUDE.md` sind ~20 000 Tokens ≈ **8 % ihres
    Fensters**, bevor sie irgendetwas tut. `AGENTS.md` (~1 400 Tokens) wird bei codex UND pi ohnehin
    automatisch geladen. Nenne die ABSCHNITTE, die sie braucht.
  - **Schreib die Such-Werkzeuge in den Brief:** `rg -n '<symbol>'`, `ast-grep --pattern '<muster>'
    --lang ts <datei>`. `graphify` gibt es in einer Lane nicht (gitignored, nie im Worktree).
  - **Suite-Ausgaben in eine Log-DATEI, dann den Tail lesen** — `./e2e-isolated.sh` sind ~1868
    Checks; wer das in den Kontext leitet, verbrennt einen zweistelligen Prozentsatz für eine Zeile,
    die „ALL PASS" heißt. (Eine Codex-Lane kann ohnehin keine Suite fahren — kein tmux in ihrer
    Sandbox; eine pi-Lane heute schon.)
  - **Ein Schnitt, kein Programm.** Die fertigen claude-Lanes dieses Tages lagen bei 140 000–190 000
    Tokens. Das ist auf 258 400 der ganze Vorrat, Brief inklusive.
  - **Lass sie ihren Füllstand SELBST melden**, denn das Board kann es nicht: ein GPT-Slot zeigt
    `ctx: null` (`contextWindowFor` kennt das Modell nicht, und ohne Transkript gibt es keine
    `usedTokens` — Queue-Zeile `e2784b16`). Ein Satz im Brief — „sag Bescheid, wenn du über der
    Hälfte bist" — ersetzt einen Sensor, den es noch nicht gibt.

## §8 Codex-Dispatch-Boot-Race (Originalblock)

- **CODEX-DISPATCH-BOOT-RACE — GESCHLOSSEN 2026-08-12 (Readiness-Naht), Mechanismus erst da verstanden:** die 2026-08-10-Messung (3/3 codex-Lanes, Brief verpufft, Pane probt `alive`) war KEIN Timing-Problem, sondern ein blockierender SCREEN: ein Paste+Enter in Codex' Trust-Prompt BEANTWORTET den Prompt („Yes, continue") und bootet einen leeren Composer — der Brief ist restlos weg, ohne Fehler; der Sign-in-Screen frisst identisch (gerenderte Frames, codex-cli 0.147.0). Seit dem Readiness-Schnitt: `Harness.readiness{accept,blocks}` (nur codex), `paneReadiness()` neben `paneAgentAt`, canDeliver-Gate `blocked-screen` (nur „blocked" verweigert), und der Dispatch-Tail wartet bounded auf den Accept-Marker `>_ OpenAI Codex (v` (`FLEET_READY_WAIT_MS`, Default 20 s) und requeued ehrlich mit Screen-Name statt zu pasten. `codex.automatable` ist damit `true` — per Pin an die Naht gekoppelt („ein Entscheid, zwei Felder"). Das Hand-Nachschicken per `POST /send` ist nur noch Notweg. Gegenproben: `e2e/tasks.ts` f3.

## §9 e2e-isolated Tier-2-Vorschau (Originalblock)

- **`./e2e-isolated.sh` ist Tier-2-Vorschau, kein Gate — und seit 2026-08-07 keine Pflicht mehr in jeder
  Lane** (Owner-Entscheid, an mich delegiert). Fahre sie, wenn du `e2e/`, einen Suite-Wrapper (`e2e-*.sh`,
  `e2e-stage.sh`) oder den Merge-/Land-Pfad angefasst hast; sonst lass sie weg. Gemessen: ~165 min/Tag
  Suite-Mutex für **0 echte Vorschau-Funde in zwei Tagen** (11 Rote, alle beim Same-Tree-Rerun grün; den einen
  echten Regress fand der Post-Land-Audit, nicht die Vorschau) — und derselbe Lauf läuft nach dem Land ohnehin
  als Stufe 2. Risiko, benannt: ein realer Bruch fällt jetzt ~9 min NACH dem Land auf statt davor.
  **Am 2026-08-08 ist dieses Risiko zum ERSTEN MAL fällig geworden, in der vorhergesagten Form und
  Frist — und der Entscheid bleibt trotzdem richtig.** Das Land `8e154dd` (Codex-Effort) gab dem Adapter
  eine Effort-Fähigkeit; `e2e/security.ts` behauptete an einer zweiten Stelle noch den alten Kontrakt
  („codex lehnt jeden Effort ab") und wurde rot. Weder die Lane noch ich konnten das vorher sehen, und
  das ist der Teil, den man kennen muss: **`e2e/security.ts` läuft AUSSCHLIESSLICH in
  `./e2e-isolated.sh`** — `./e2e-security.sh` ist der separate Einzeldatei-Harness
  `fleet-e2e-security.ts` und enthält diese Familie NICHT, und der Land-Gate fährt dieselben drei
  Suiten. Beide waren grün und beide hatten recht. **Der Auslöser ist NICHT „du fasst `e2e/*.ts` an" —
  das war die erste Fassung dieser Zeile und sie zielt daneben.** Die Lane änderte einen ADAPTER-Wert
  in `server.ts`; die zurückgebliebene Behauptung lag woanders. Der richtige Auslöser ist: **du änderst
  eine Aussage, über die irgendwo eine Behauptung steht** — ein `supports.*`-Feld, ein `effortLevels`,
  eine `note`, einen Kontrakt-Default. Dann sagt dir der Gate NICHTS, und du fährst die Vorschau (oder
  rechnest mit dem Audit 9 min später). Wer nur auf `e2e/*.ts` achtet, lässt genau den Fall durch, der
  am 2026-08-08 zugeschlagen hat.
  Adjudiziert als `stale-test`, repariert in `6cc8283`. Rückfalltür: diese Zeile zurückdrehen. Safe inside lanes (each isolated suite refuses/avoids the live
  socket). Run `./e2e-clean-review.sh` whenever you touch the merge/land path — it's the only suite that boots
  the server with `FLEET_CLEAN_REVIEW=1` and proves the ② reviewer's downgrade-only + fail-closed contract.
  **Und `./e2e-postland-audit.sh`, wenn du den Tier-2-Audit-Pfad anfasst** (Queue, Drain, Snapshot, Retention)
  — es ist die einzige Suite, die dort etwas beweist, und sie MUSS mitlaufen, sonst rottet sie unbemerkt:
  genau das ist passiert (sie kopierte `continuity.ts` nie in ihr Scratch-Verzeichnis und starb seit `13c5728`
  bei JEDEM Lauf am Boot, unentdeckt, weil kein Gate sie fährt — gefunden und behoben 2026-07-27 in Lane
  `b5e6`).

## §10 Sonde vor Code (Originalblock)

- **Bei einem roten Check an FRISCH GESCHRIEBENER eigener Arbeit ist der erste Verdaechtige die SONDE, nicht
  der Code** (dreimal an einem Tag belegt, 2026-08-07, Session 38: eine maschinenabhaengige Erwartung · ein
  `inSec: 0`, das die Route mit 400 abwies und das mein Helfer STILL verschluckte · ein Tick-Cache, von dem
  ich eine Zusage verlangte, die er ausdruecklich nicht macht). Jedes Mal war der Code richtig, und jedes Mal
  lautete die naive Lesart „der neue Gate ist kaputt". **Das Werkzeug dagegen ist die SIGNATUR des Fehlschlags
  gegen die Erwartung zu lesen, nicht den Fehlschlag zu glauben:** derselbe Wert in der Zeile UND ihrer
  Gegenprobe heisst „nie gemessen", nicht „Gate defekt"; ein Wert, den der Code *strukturell nicht erzeugen
  kann* (hier `no-agent` aus einer leeren comms-Liste), datiert den Messzeitpunkt statt den Code zu
  beschuldigen. Ergaenzt die Regel darueber, ersetzt sie nicht: „der Fail ist deiner" bleibt — dies sagt, WO
  in deiner Arbeit du zuerst suchst. Und die Konsequenz gehoert in die Sonde: **eine Sonde, die nicht laufen
  konnte, muss als SIE SELBST scheitern** (eigener `check()` auf ihre Voraussetzung), nie als das, was sie
  messen sollte.

## §11 concurrency-safe vs. Maschinenlast (Originalblock)

- `./e2e-isolated.sh`, `./e2e-claude-gate.sh`, and `./e2e-clean-review.sh` each derive SOCK/PORT/DIR from `$$`
  per invocation (distinct port bands) → concurrency-safe, run them directly from any lane. A clean run tails
  "ALL PASS". The old `FLEET_SELF_TOKEN absent for a non-lane slot` pane-capture race and the
  auto-③-supersedes-a-fresh-lane race are both fixed (2026-07-25); a fail is yours until proven
  fails-identically-at-HEAD. **Korrektur 2026-07-25: „no known flakes" stand hier und ist falsch** —
  `./e2e-isolated.sh` ist unter Maschinenlast messbar nicht-deterministisch (ein Lauf fiel mit 3/759 auf einem
  Baum mit NULL Code-Änderungen, der davor und danach grün war; Mechanismus zu zwei Checks benannt in
  `docs/verify-tiering.md`). Das ist **kein Freifahrtschein**: ein Fail bleibt deiner, bis du ihn als Flake
  beweist (gleicher Check, frischer HEAD-Worktree, Transcript in den Report). Konsequenz fürs Gate: die volle
  Suite darf aus genau diesem Grund kein hartes Pre-Land-Gate sein — sie läuft als Stufe 2 NACH dem Land.
  **Präzisierung 2026-07-26 (gemessen in Lane b798/SEC-4): „concurrency-safe" oben gilt für
  Socket/Port/Verzeichnis — NICHT für Maschinenlast.** Zwei `./e2e-isolated.sh` gleichzeitig zu fahren erzeugt
  auf dieser Maschine zuverlässig Fehler, und zwar auf BEIDEN Bäumen und mit unterschiedlicher Signatur (Lane:
  7 outcome/land-Fails, HEAD: 1 transcript-Fail) — ein so erzeugtes Paar beweist gar nichts. **Der
  fails-identically-at-HEAD-Beweis MUSS seriell laufen**, sonst ist er wertlos. Gilt genauso für alles andere,
  was nebenbei die Maschine belegt: der Post-Land-Audit (Stufe 2) IST ein `e2e-isolated`-Lauf, also nicht
  zeitgleich Drills, Suiten oder frische Lanes danebenstellen.

## §12 rg/ast-grep (Originalblock)

- **`rg` ist installiert und schneller als `grep` — aber sein Default macht dich in DIESEM Repo blind.**
  ripgrep respektiert `.gitignore`, und gitignored sind hier ausgerechnet: `CLAUDE.md` (dieses Regelbuch),
  `fleet.json` (die Queue, also das Register), `lane-outcomes.jsonl` · `post-land-audits.jsonl` ·
  `audit.jsonl` (alle drei Ledger) und `.env`. Ein `rg` ueber diese Dateien liefert kein Fehlerergebnis,
  sondern ein LEERES — und ein leeres Ergebnis liest sich wie "gibt es nicht". Gemessen 2026-08-08 mit
  `git check-ignore`. Regel: fuer getrackten Code `rg` gern, fuer alles Operative **`rg -uu`** (oder schlicht
  `grep`). **Die strukturelle Ebene ist seit 2026-08-08 `ast-grep` (0.45.1, user-lokal in `~/.local/bin`, auch
  als `sg`) — und sie ist genau das, was einer LANE bisher fehlte.** `graphify` (`graphify-out/`, AST +
  Call-Graph) deckt dieselbe Ebene ab, aber NUR im Haupt-Checkout: das Verzeichnis ist gitignored, ein
  Worktree bekommt nur getrackte Dateien, also hat eine Lane es nie. Faustregel: Text-/Symbolsuche → `rg`
  (operativ `rg -uu`) · strukturelle Frage („alle Aufrufstellen von X", „jede async function ohne try/catch")
  → `ast-grep --pattern '<muster>' --lang ts <datei>`, `--json=compact` fuer maschinelle Weiterverarbeitung.
  Der Unterschied ist nicht kosmetisch, sondern gemessen: `Bun.spawn($$$)` liefert **18** echte Aufrufstellen
  in `server.ts`, ein Text-`grep` **20** — die zwei Extra sind Kommentar/String. Auf einer Flaeche, wo jeder
  Treffer eine Stelle ist, an der ein Wert in einen Prozess geht, ist das der Unterschied zwischen einer Liste
  und einer Liste mit zwei Phantomen. **NICHT getan und bewusst nicht:** die 14 `grep`-Aufrufe in den eigenen
  Shell-Skripten auf `rg` umzustellen — sie lesen winzige Dateien (Geschwindigkeit irrelevant), aber
  `state.sh`/`register.sh` lesen `fleet.json` und die Ledger, und ein naiver Tausch macht daraus stille
  Leer-Ergebnisse. Korrektheitsrisiko ohne Gegenwert.

## §13 C-u/Owner-Entwurf (Originalblock)

**Und die teure Nebenlektion vom selben Tag: eine kurze Zeile im eigenen Composer ist der ANFANG
eines Owner-Satzes, nicht dein eigener `send-keys`-Rest.** Ich hielt ein `es` für Tipp-Müll meines
eigenen `/effort`-Kommandos und schickte `C-u` — es waren die ersten zwei Zeichen von „es ist
beeindruckend…", einer echten, gerade entstehenden Owner-Nachricht. Sie überlebte (`Ctrl+Y` hält
Gelöschtes vor, und der Owner tippte weiter), aber der Griff war falsch. Regel: **im EIGENEN
Composer nie `C-u`, solange der Inhalt auch ein wachsender Owner-Entwurf sein könnte** — zweimal im
Abstand von Sekunden lesen; wächst der Text, tippt ein Mensch. Ein eigener `send-keys`-Rest wächst
nie.

## §14 Sammelablage der kleineren Verdichtungen

### Loader-Vertrag (alte Fassung)

## Loader-Vertrag (zuerst, vor allem anderen)

- **Lies `AGENTS.md` vollständig** — dort lebt der portable Fleet-Vertrag (Vokabular, harte
  Invarianten, Verify-Kette, Landing, Reporting). Diese Datei hier ist das private Overlay:
  operative Realität, Messbelege, Maschinen-Eigenheiten.
- **Neue dauerhafte Regeln werden in diesem Repo über propose/promote normativ:** ein Worker oder
  eine Session darf eine Regel VORSCHLAGEN; verbindlich wird sie erst durch Owner-Promotion. Keine
  harte Lektion wird automatisch normativ angehängt.
- **Ein verbleibender echter Widerspruch** zwischen `AGENTS.md`, dieser Datei und dem aktuellen
  Code stoppt die Arbeit und wird gemeldet — nie die bequemere Regel wählen. Bei
  Doc-vs-Code-Widerspruch gilt der Code.

### Backlog-Chronik (Item-Zuordnungen)

  Live-Queue. **Das alte Backlog ist KEIN lebendes Register** (seit 2026-08-07 im Attic:
  `docs/attic/backlog-2026-07.md`) — es führt Arbeit unter anderen Namen als die Queue (Item 13 = F5 =
  gelandet, Item 12 = F6 = Zeile `2784427e`) und ist auf 2026-07-23/24 verankert.

### Widerspruch-gilt-der-Code-Doppelung im Rückweg-Block

§1. Die Lehre
  daraus gilt weiter: **bei einem Widerspruch gilt der Code, nicht dieses Dokument** — und ein Absatz, der
  eine Handarbeit empfiehlt, ist der erste, den man gegen den Code prüft.

### Direkt-Commit-Ledger (Originalblock mit Mess-SHAs)

- **Ein Direkt-Commit aus dem Haupt-Checkout ist fuer JEDES land-seitige Ledger unsichtbar** (gemessen
  2026-08-07 an `0e2a672` und `4955444`): kein `git notes --ref=fleet/land`, keine Zeile in
  `lane-outcomes.jsonl`, **und kein Post-Land-Audit** — der Tier-2-Lauf haengt an
  `landLane`/`drainPostLandAudits`, nicht an einer Bewegung von main. Wer „arbeite selbst" umsetzt und im
  Haupt-Checkout committet, muss die Verifikation darum **von Hand vollstaendig fahren** (das Audit-Kommando
  IST `./e2e-isolated.sh`) und das im Handoff **sagen** — sonst liest die naechste Session
  `post-land-audits.jsonl` und schliesst korrekt-aber-falsch, diese Commits seien nie vermessen worden. Die
  Abdeckung ist gleichwertig, der EINTRAG fehlt. Gilt genauso fuer `./state.sh`s Land-Health-Zahlen: sie
  zaehlen Lanes, also untertreiben sie an einem Tag mit Direkt-Commits.

### gate-Route: die Uhr-Vorgeschichte der zwei Budgets

dem Suite-Mutex verbringen darf, bevor es anfängt. Seit `08dc17a`; davor war es eine Uhr, und die hat am
  2026-08-06 ein Land mit `verify.ok:false` getötet über eine Ausgabe mit NULL Fehlern — ~255 s von 300 s
  waren fremde Suite. Ein `waitedOut` ist nie `ok:false`

### Flake-Familien (Originalblock)

- Vier bekannte Flake-Familien, nicht zwei: die drei aus `docs/verify-tiering.md` §5b plus **merge/resolver**
  (`"agent reported rebased, but the lane is not clean"`, §11). **FIX1-Flake ist BEHOBEN (2026-07-28, Commit
  `fix(merge): the land path survives its own git plumbing`): Ursache war `.git/index.lock` aus Fleets eigenen
  Status-Polls — `GIT_OPTIONAL_LOCKS=0` an den read-only-git-Aufrufen; Beweis 10/10 FIX1-Instanzen über 5
  serielle Läufe gegen Basisrate 8/16 (`docs/attic/analysis-2026-07-28-verification.md` §9 = Vorgeschichte —
  seit `66d302b` im Attic, der alte Pfad stand hier bis 2026-08-07 falsch).** Ein FIX1-Rot NACH diesem Commit
  ist darum wieder ECHT und deins. Fünfte Flake-Familie: Signatur generisch „N marks, 1..N-1" im
  reseed+live-bytes-Check, **dreimal gesehen** (zuletzt 2026-08-01 byte-identisch gegen einen reinen
  Picker-CSS-Diff, der den Pane-Stream gar nicht erreichen kann) — Instanzen und Mechanismus stehen in
  `docs/verify-tiering.md` §11.2b, nicht hier, damit die Zahl nicht an zwei Stellen altert. **Sechste
  Flake-Familie (2026-08-07 belegt): die Pane-Beobachtungs-Rennstelle im `stalled`-Abschnitt** — bis zu vier
  FAILs, EINE Wurzel (`stalled setup: … observed …`, Detail `{"observed":false,"lastOutput":0}`), die drei
  anderen hängen daran. Vier Instanzen, Basisrate und der benannte Fix in `docs/verify-tiering.md` §11.2c —
  dort und nur dort, gleiche Regel wie oben. Gleiche Beweisordnung wie immer, kein Freifahrtschein.

### claude-gate drei Phasen (Originalblock)

- `./e2e-claude-gate.sh` hat **DREI Phasen** in einem Wrapper (hier stand bis 2026-08-09 „zwei" — nachgezählt
  am Skript, `grep -n 'phase:' e2e-claude-gate.sh`; gilt die Datei, nicht diese Zeile): Phase 1
  `FLEET_CMD=claude` (Stand-in-Binary), Phase 2 `FLEET_CMD=harn` — eine Harness, die server.ts nie gehört hat,
  deklariert nur über Env —, Phase 3 `FLEET_CMD=true` mit LEERER `FLEET_HARNESS_COMMS`, die Gegenprobe zum
  „unprobed"-Waiver. Die ersten beiden sind ein PAAR und keine ist allein vollständig: Phase 2 beweist, dass
  fremde Modell-Muster akzeptiert werden, und die Gegenprobe (ein claude-Fleet lehnt genau diese Muster weiter
  ab) kann nur in Phase 1 stehen. Wer `MODEL_RE` aufweitet, kommt an Phase 2 vorbei und wird von Phase 1
  gestellt. Phase 2 setzt `default-shell` des Test-Sockets auf zsh — ein Check hängt daran, dass ein
  unquotetes Glob-Modell die Pane tötet (unter sh wäre es harmlos und der Check bewiese nichts).
  **Jede Phase bootet ihren eigenen Server und wartet in einer 30-s-Schleife auf den Port — und läuft danach
  WEITER, egal ob er je geantwortet hat** (2026-08-09 gemessen: Phase 3 lief gegen ein Verzeichnis ohne
  Server, in der aufbewahrten Instanz fehlt sogar die `server.log`, und die Sonde starb an `ENOENT` auf
  `fleet.json`). Ein solches Rot liest sich wie ein Code-Regress und heißt „nie gemessen". Erkennungsmerkmal
  am Post-Mortem: **keine `server.log` in der aufbewahrten Instanz** = das Kommando lief dort nie.

### Runner-only / Stage-Fold (Originalblock)

- `fleet-e2e.ts` is a **runner only**: it boots the check modules in `e2e/*.ts` in order and prints the tail.
  Add a check next to its family in the right `e2e/<family>.ts`, never at EOF and never back into the runner.
  Shared plumbing (`check`, `post`/`get`, `tmuxOut`, `paneEnv`, `ROOT`, `REPO`) is `e2e/harness.ts`; the few
  fixtures that outlive their own section travel through the explicit context objects in `e2e/ctx.ts`. A pane
  env-var probe MUST go through `paneEnv()` — a hand-rolled send-keys + sleep + capture-pane is the shape of
  the flake that was just removed. `e2e-isolated.sh` copies `e2e/` alongside `fleet-e2e.ts`; a new sibling
  file needs no wrapper change, a new top-level directory does. `fleet-e2e-claude-gate.ts`,
  `fleet-e2e-clean-review.ts`, `fleet-e2e-security.ts` und `fleet-e2e-postland-audit.ts` sind separate
  Einzeldatei-Harnesses und NICHT Teil dieser Struktur. **Hand-Kopierlisten gibt es nicht mehr, und du sollst
  auch keine pflegen** (gekürzt 2026-08-07 — hier stand die Anweisung, „ALLE SECHS Skripte" zu prüfen, und im
  selben Absatz stand, dass das erledigt ist): seit dem Stage-Fold `3d38960` leiten alle sieben Wrapper ihre
  Kopierliste aus `e2e-stage.sh` ab, und zwei Pins halten das fest — „no shell script copies a module by name
  (staging is derived, never listed)" und „every script that stages an instance sources e2e-stage.sh, and vice
  versa". Die alte Todesart (`e2e-postland-audit.sh` starb monatelang unentdeckt am Boot, weil `continuity.ts`
  in seiner Liste fehlte) ist damit strukturell zu.

### Demo-Repo (Originalblock)

- **Die Demo liegt NICHT MEHR in diesem Repo** (31.07.): sie ist ein eigenes, remote-loses Repo unter
  `~/claude-fleet-demo` — Owner-Vorgabe „die demo soll nicht veröffentlicht werden", und dieses Repo ist
  öffentlich. Sie baut gegen den Nachbar-Checkout: `build.ts` leitet ihre Seite aus `public/index.html` ab,
  das Bundle importiert `src/client.ts` über den `@app/*`-Alias, `node_modules` ist ein Symlink hierher.
  Konsequenz, die man kennen muss: **eine Änderung an `public/index.html` oder `src/client.ts` kann die Demo
  brechen, und kein Gate hier sagt es** — sie hat ihr eigenes `bun run typecheck` / `bun run build`, Sekunden.
  Kurz war `demo/src/demo.ts` in der tsc-Liste des Gates; das war falsch, sobald die Datei das Repo verließ:
  eine Lane ist ein frischer Worktree mit nur getrackten Dateien, ein Eintrag auf eine Datei außerhalb lässt
  JEDE Lane am Verify scheitern.

### pkill-trifft-Audit (Originalblock)

- **Dieselbe Falle gilt für SUITEN, und sie hat schon zugeschlagen: `pkill -f 'e2e-isolated.sh'` trifft auch
  den Post-Land-Audit des Servers** (gemessen 2026-08-06, 20:11: Slot 1 stoppte damit seine eigene
  Tier-2-Vorschau und tötete den Audit zu `72da914` mit — `exit 143` nach 15,6 s, NULL Checks gelaufen,
  Ausgabe endet in der Lock-Wartezeile. Der Audit stand danach als **rot** im Register, obwohl nie etwas
  vermessen wurde; adjudiziert als `unknowable`). Regel: einen eigenen Suite-Lauf **nur über seine notierte
  PID** beenden (`kill <pid>`), nie über ein Namensmuster — auf dieser Maschine läuft immer auch der Audit des
  Servers unter demselben Namen. Und die Vorschau ist ohnehin verzichtbar: Tier-2 ist Vorschau, kein Gate, und
  läuft nach dem Land automatisch.

### Scope-Regeln (Originalblock mit Owner-Entscheid-Begruendung)

**Zwei Scope-Regeln, die entgegengesetzt laufen — das ist die Konstruktion, kein Widerspruch:**
- **Lane-only sind genau vier Routen:** `/api/self/drift`, `/api/self/gate`, `/api/self/criterion`,
  `/api/self/verify-intent`. Sie antworten einer Nicht-Lane **409, nie 401** — die Verweigerung ist ein
  Feature und gepinnt, weil ihr Inhalt (Land-Gate-Wissen, Merge-Drift) für eine Nicht-Lane bedeutungslos wäre.
- **Nicht-Lane-only sind drei Routen:** `/api/self/watch` antwortet einer **LANE 409**
  (`a lane may not subscribe — lane-waits-on-lane is a coupling only the owner can make visible`); der
  `⚙ steward` darf hier abonnieren. `/api/self/succeed` und `/api/self/retire` antworten einer Lane UND dem
  `⚙ steward` 409: eine Lane landet statt zu migrieren, und der Steward ist eine stehende Rolle.

Beide Male derselbe Grund: der Inhalt wäre für den anderen Prinzipal bedeutungslos, und die Verweigerung ist
ein Feature (409 statt 401, damit niemand nach einem Token sucht, das er schon hat). Owner-Entscheid
2026-08-07 zur Nicht-Lane-Regel: Lane-A-wartet-auf-Lane-B ist eine Kopplung, die es heute nicht gibt und die
niemand sieht — später aufweiten ist billig, zurücknehmen nicht. Die Owner-Route `POST /api/slots/:id/watch`
behält die weitere Reichweite: der Owner darf eine Lane auf eine Lane zeigen, weil er es auf dem Board sieht.

### Health-Check: steward-Routen-Korrektur-Chronik

Dort steht auch `deployGap` (`codeBehind`)
  und seit `438c326` `errors`. **Korrektur 2026-08-07: hier stand `/api/steward/sessions` — die Route ist
  steward-only und antwortet dem Owner-Token mit 404.** Beide Deploy-Fakten wurden bewusst auf den Owner-Poll
  gehoben, weil nur der Owner sie ausführen kann (Begründung im Kommentar bei `server.ts`, grep
  `the two deploy facts`).

### Verb 2 (Originalblock mit Erstzug-Chronik)

- **Verb 2 ist gebaut und läuft — der Deploy von Hand ist damit überflüssig** (`4311c92`, 2026-08-08;
  hier stand bis 2026-08-09 „wurde NIE gezogen", und das galt genau einen Tag): `POST /api/deploy` +
  `GET /api/deploys`, Owner **und** Steward-Token (`server.ts`, grep `VERB 2`). Erster Zug am
  2026-08-09 durch Session 45, zweiter durch Session 46 — beide sauber (`ok:true`,
  `bootHead == target`, `bundleStale:false`). Statt `tmux kill-session -t srv` also die Route; das
  `kill-session` bleibt richtig für alles, was Verb 2 nicht abdeckt (Watchdog-Änderungen brauchen
  weiterhin `launchctl kickstart`). **Von keinem Tick, keinem
  Auto, keinem Dispatch-Pfad aufgerufen** — jeder Zug ist ein Owner-/Session-Entscheid. Konstruktion, die man
  kennen muss: der Deploy tötet den Prozess, der ihn ausführt, also kann er sich nicht selbst verifizieren —
  der Build läuft ZUERST und allein (ein roter Build kommt am Kill nicht vorbei), und das Verdikt schreibt der
  **nächste Boot** über den Marker `deploy-inflight.json` auf das Ledger `deploys.jsonl`. Dreiwertig:
  `ok:null` heißt „nicht feststellbar" und ist NIE ein Pass. Lehnt bei laufendem Post-Land-Audit mit **409**
  ab (ein srv-Kill mitten im Audit macht ihn zu einem falschen Rot — real passiert 2026-08-06, `exit 143`).
  Drei optionale Env-Knöpfe: `FLEET_DEPLOY_BUILD_CMD` (default `bun run build`), `FLEET_DEPLOY_RESTART_CMD`
  (default aus `SOCK` abgeleitet, damit eine Test-Instanz nie das Live-srv trifft),
  `FLEET_DEPLOY_BUILD_TIMEOUT_MS` (default 300 s). Kein Board-Knopf.

## §15 K1-Verdichtung von `rulebook/lane-discipline.md` (2026-09-05, Zeile `56b9d19b`)

Owner-Ansage 2026-09-05 01:4x („alles auf einen guten Stand"). Acht Bloecke des Lane-Fragments
wurden auf je eine Regel plus Zeiger gekuerzt; hier stehen die ORIGINALBLOECKE (Stand 2026-09-05
vor der Verdichtung), damit keine Messgeschichte verloren geht. Regeln wurden nicht gestrichen,
nur Geschichte und Zahlen. Gegencheck der zugrunde liegenden Analyse:
`docs/messungen/2026-09-05-kontextschicht-gegencheck-glm.md` (B2 bestaetigt).

### §15.6 e2e-isolated Tier-2-Vorschau (Originalblock, 2026-09-05)

- **`./e2e-isolated.sh` ist Tier-2-Vorschau, kein Gate — und keine Pflicht in jeder Lane**
  (Owner-Entscheid 2026-08-07; gemessen: ~165 min/Tag Suite-Mutex fuer 0 echte Vorschau-Funde in zwei
  Tagen, und derselbe Lauf laeuft nach dem Land ohnehin als Stufe 2). Fahre sie, wenn du `e2e/`, einen
  Suite-Wrapper (`e2e-*.sh`, `e2e-stage.sh`) oder den Merge-/Land-Pfad angefasst hast — **oder wenn du
  eine Aussage aenderst, ueber die irgendwo eine Behauptung steht** (ein `supports.*`-Feld, ein
  `effortLevels`, eine `note`, ein Kontrakt-Default). Denn `e2e/security.ts` laeuft AUSSCHLIESSLICH in
  `./e2e-isolated.sh` — `./e2e-security.sh` ist der separate Einzeldatei-Harness und enthaelt diese
  Familie NICHT, der Land-Gate sagt dir dort also NICHTS: du faehrst die Vorschau oder rechnest mit dem
  Audit ~9 min nach dem Land. Genau so einmal faellig geworden (`8e154dd`, adjudiziert `stale-test`,
  repariert `6cc8283`) — der Entscheid bleibt trotzdem richtig; Rueckfalltuer: diese Zeile zurueckdrehen.
  Safe inside lanes (jede isolierte Suite meidet den Live-Socket). Run `./e2e-clean-review.sh` whenever
  you touch the merge/land path — die einzige Suite, die den ②-Reviewer-Kontrakt (downgrade-only +
  fail-closed) beweist. **Und `./e2e-postland-audit.sh`, wenn du den Tier-2-Audit-Pfad anfasst** (Queue,
  Drain, Snapshot, Retention) — die einzige Suite, die dort etwas beweist; kein Gate faehrt sie, also
  rottet sie unbemerkt, wenn niemand sie mitlaufen laesst (einmal monatelang passiert). Volle
  Geschichte: `docs/attic/regelbuch-messgeschichten-2026-08.md` §9.

### §15.15 Achtzehn Flake-Familien (Register-Langfassung) (Originalblock, 2026-09-05)

- **Achtzehn bekannte Flake-Familien** — Instanzen und Mechanismen stehen in `docs/verify-tiering.md`,
  dort und nur dort, damit die Zahlen nicht an zwei Stellen altern: drei Familien aus §5b ·
  **merge/resolver** („agent reported rebased, but the lane is not clean", §11) · „N marks, 1..N-1" im
  reseed+live-bytes-Check (§11.2b) · die Pane-Beobachtungs-Rennstelle im `stalled`-Abschnitt (§11.2c —
  bis zu vier FAILs, EINE Wurzel) · der 💾-commit-Idle-Gate gegen die eigenen Sonden der Suite (§11.2e)
  · die **Send-Boot-Fixtures** in `./e2e-claude-gate.sh`, die eine Vorbedingung behaupteten, die sie
  nicht kontrollieren (§11.2f — sechs Checks, `lastOutput` ist kein Bereitschafts-Signal; repariert
  in zwei Schnitten 2026-08-19, §11.2c-bis ist darin aufgegangen) · die **send-receipt-Gruppe** in
  `e2e/slots.ts` (§11.2g) — REPARIERT in `4bde073`: tmux 3.6a laesst `new-session -c <gone>` still
  auf `$HOME` zurueckfallen, der Heal gelang also IMMER; die Sonde haelt den Heal jetzt mit
  `remain-on-exit` + toter Pane bei has-session=0 fest. Ein Rot dort NACH `4bde073` ist wieder
  ECHT. (Die drei `lines=0`-§7-Sichtungen von 2026-08-25/26 sind dort re-attribuiert und seit
  `7875c19` repariert — ein §7-lines=0-Rot danach ist wieder ECHT.)
  · die **owner-token-ambient-use-Gruppe** in `e2e/programs.ts` (§11.2h) — REPARIERT in `70698a7`:
  die Sonde las den Land an der TASK-ZEILE ab, und die requeuet der abgekoppelte Brief-Tail 4 s nach
  dem Dispatch ueber das `done` hinweg (9,0 % Basisrate, 7/78 Laeufe; Note und Ambient-Zeile waren
  jedes Mal korrekt). Sie pollt jetzt den Integrationszweig und die Note. Ein Rot dort NACH `70698a7`
  ist wieder ECHT. **FIX1 ist BEHOBEN** (2026-07-28, `GIT_OPTIONAL_LOCKS=0` an den
  read-only-git-Aufrufen; Beweis 10/10 ueber 5 serielle Laeufe) — ein FIX1-Rot danach ist wieder ECHT
  und deins. · der **Suite-Server-Phasen-Restart**, der den sterbenden tmux-Server ueberholt
  (§11.2i — offen; Fingerabdruck `server exited unexpectedly`; Post-mortem: keine oder nur
  Vorphasen-`server.log`) · die **pi-unfenced-Watch-Zustellungs-Familie** (§11.2j — MECHANISMUS
  ISOLIERT, acht Mitglieder, test-seitig REPARIERT in `b20e7e4`: `server.ts#tickWatches`
  persistiert `send-uncertain` + `attempts++` VOR dem tmux-Roundtrip und rollt erst nach
  `SendRefused` zurueck — die Fixtures sampelten diesen by-design-Transienten. Sie MESSEN jetzt
  ihre Vorbedingung (Schnitt 1) und warten den Transienten bounded aus (Schnitt 2, `settleEvent`;
  `settleWaits` wird gedruckt). Ein Rot dort NACH `b20e7e4` ist wieder ECHT — es sei denn, die
  Vorbedingungs-Sonde faellt als SIE SELBST, dann sagt sie das woertlich) · die
  **raw-review-Persist-Rennstelle** in `e2e/outcomes.ts` (§11.2k — test-seitig REPARIERT in
  `05f37f1`: Block 9b wartet auf die PERSISTIERTE Review-Wirkung statt auf den Klick; ein 9b-Rot
  ist ab jetzt wieder ECHT. Der Server-Bug dahinter — `teardownSlotOccupant` raeumt
  `reviewInflight` nicht — steht als P6-Zeile offen, nicht als Flake).
  · der **busy-receiver-Restart-Check** in `e2e/watch.ts` (§11.2l — REPARIERT in `7d089c1`, 2026-09-04: die Fixture erzeugt ihre
  Vorbedingung jetzt selbst statt sie von fremder Arbeit zu erben; Zielcheck 5x rot vor / 1x gruen
  nach dem Fix im Trail. Ein Rot dort NACH `7d089c1` ist wieder ECHT. Zum Wiederfinden nach einem
  Rebase: `git log --grep "busy-receiver fixture"`. Der Befund, aus dem Trail-Register
  bewiesen 2026-09-03: `restart keeps the busy pending event with the same id and no invented
  attempt` ist 15x auf 13 VERSCHIEDENEN Baeumen rot, zwoelf davon aelter als der Slice, der das Rot
  zuletzt geerbt hat. Die Fixture verlaesst ihre busy-Schleife, sobald sie das Event EINMAL pending
  gesehen hat, und kontrolliert ihre Vorbedingung danach nicht mehr; Diskriminator ueber 364 Laeufe
  ist die Strecke Anker→Restart, gruen Median 3,1 s / p95 3,5 s gegen rot min 3,5 s / Median 4,0 s.
  **Merkposten zur BEWEISORDNUNG:** hier entschied weder der Rerun desselben Baums (faellt identisch)
  noch der frische HEAD-Worktree (laeuft gruen) — entschieden hat das Trail-Register. Ein roter Lauf
  auf einem Baum VOR dem Land widerlegt die Attribution; ein gruener Rerun danach beweist nichts).
  · das **PARKED-Quartett** in `e2e/repo-worker-audit.ts` (§11.2m — OFFEN, Wurzel am aufbewahrten
  Instanz-Ledger abgelesen 2026-09-04: RW.5–RW.8 fallen immer zu viert; das „slow"-Land ist `sleep 6`
  gegen `FLEET_POSTLAND_AUDIT_TIMEOUT_MS=10000`, unter Suite-Last kostet es 10 092 ms und der Audit
  antwortet korrekt `unknown` statt `green` — falsche Fixture-Marge, kein Server-Bug. Der Floor ist
  eine UNTERGRENZE, beide Schnitte (Marge weiten / Budget heben) stehen offen)
  · der **`⏸ re-run`-Guard** in `e2e/merge.ts` (§11.2n — OFFEN, Mechanismus am Code gelesen:
  `e2e/lane-helpers.ts#settleForMerge` pollt 12 s und kehrt danach STILL zurueck, der folgende
  merge-POST trifft den IDLE-Gate statt des Guards, und der Check faellt als der Guard. Signatur:
  `{"status":"blocked","detail":"the session is actively working right now …"}`. Basisrate ueber das
  ganze Trail-Register 11/655 = 1,7 % auf ELF verschiedenen Trees, keiner reproduziert — und
  vier Rots liegen vor dem Land, das B-16 verdaechtigt hatte, womit B-16 mit NEIN beantwortet ist.
  · die **Projektions-Sonde** in `e2e/programs.ts` (§11.2o — OFFEN, gelandet 2026-09-04 mit `fc45fe4`:
  `projection nextAction: a REVIEWABLE row of a promoted Program …` faellt mit dem IMMER GLEICHEN
  Detail `{"with":null,"without":null,"phase":"UNKNOWN"}` — beide `.find(...)` leer, die Fixture-Zeile
  war in der Projektion gar nicht da. Basisrate 2,1–2,9 % ueber 209–237 Laeufe auf FUENF verschiedenen
  Baeumen seit 2026-08-27; `2d88521f` lief neunmal und fiel einmal, also entscheidet auch hier das
  Register und nicht ein Rerun. Ausdruecklich KEIN Host-Unterschied
  (`docs/messungen/2026-09-04-falsifikator-second-host.md` §5). **Die Wurzel ist NICHT isoliert**, und der
  Grund steht in der Sonde selbst: sie druckt nur `phase` und wirft `phaseBasis` und `unknown` weg —
  die zwei Felder, die in derselben Antwort stehen und die Frage woertlich beantworten wuerden. Erster
  Schnitt ist darum die Evidenzzeile, nicht die Wurzel).
  Bei 1,7 % beweist ein gruener Rerun NICHTS; das Register entscheidet).
  · der **`requeue-teardown-empty`-Rest** in `e2e/tasks.ts` (§11.2p — OFFEN, EINE Sichtung
  2026-09-04, Mechanismus vollstaendig aus dem Trail gelesen: die requeue-Probe liess ihre
  Zeile (`kind:auftrag`) und ihren Slot stehen, und die Setup-Zeile der `backlog nudge`-Sektion
  — `the only open row is a pending kind:notiz observation` — fand genau diesen Rest. Die zwoelf
  Checks darunter massen ein VERSCHMUTZTES Register und fielen als der Vertrag. **Ein Fail, siebzehn
  rote Zeilen.** Basisrate 1/177, also die niedrigste aller Familien — registriert wegen des
  RADIUS, nicht der Rate. Regress ohne Rerun ausgeschlossen: der Audit-Baum `f588287` hat gegenueber
  seinem Vorgaenger nur `docs/verify-tiering.md`, `HANDOFF.md` und `fleet-watchdog.service` im Diff.
  Merkregel fuer einen Leser: siebzehn Fails sind nicht siebzehn Befunde — zuerst die SETUP-Zeilen
  der betroffenen Sektionen lesen; ist eine rot, ist alles darunter UNGEMESSEN, nicht verletzt).
  Gleiche Beweisordnung wie immer, kein Freifahrtschein.

### §15.16 Suite-Mutex und das Nullfenster des Prozess-grep (Originalblock, 2026-09-05)

- **Suiten serialisieren sich seit `ddc5128` SELBST** (Mutex in `e2e-stage.sh`, gilt für alle sieben Wrapper
  inkl. Land-Gate und Tier-2-Audit): kein manuelles `until mkdir` mehr um Suite-Läufe. Semantik:
  `/tmp/fleet-e2e.lock` **existiert ≠ gehalten** — die `pid`-Datei darin entscheidet (toter Halter wird vom
  nächsten Anwärter gereapt; eine PID-**lose** Lock-Dir ist ein manueller Park-Halt und wird nie gereapt — so
  parkst du die Maschine absichtlich). Maschine prüfen: `ps -eo command | grep -c '^/bin/sh ./e2e-'` (ein
  schlichtes grep ohne Anker zählt zsh-Wrapper mit — darauf ist am 2026-07-26 eine Lane hereingefallen).
  **Aber „0 Wrapper" ist KEIN Beweis fuer eine ruhige Maschine — am 2026-09-04 bezahlt** (ein
  Vorschaulauf nahm einem echten Land ~25 min Wartebudget ab). Mechanismus, an `watchdog.sh`
  nachgelesen und nicht zitiert: `VERIFY_CMD` faehrt VIER Schritte — `bun install`,
  `bun e2e/pins.ts`, `bunx tsc`, `bun run build` — BEVOR der erste `./e2e-*.sh` startet, und
  `AUDIT_CMD` faehrt `bun install` vor seinem `./e2e-isolated.sh`. In diesen Fenstern zaehlt das
  grep NULL, waehrend ein Land bzw. ein Tier-2-Audit laeuft und den Mutex gleich nimmt. Belastbar
  ist deshalb nur das Paar: die `pid`-Datei in `/tmp/fleet-e2e.lock` (haelt gerade jemand?) UND der
  Server (`GET /api/slots/:id/merge` → `running`, bzw. `merges` im Zustand: faehrt eine fremde MAIN
  gerade einen Land?). Das Prozess-grep ist von den dreien das schwaechste Signal.

### §15.19 concurrency-safe vs. Maschinenlast (Originalblock, 2026-09-05)

- `./e2e-isolated.sh`, `./e2e-claude-gate.sh` und `./e2e-clean-review.sh` leiten SOCK/PORT/DIR aus
  `$$` ab (getrennte Port-Baender) → parallel-sicher fuer Socket/Port/Verzeichnis, **NICHT fuer
  Maschinenlast**: zwei `./e2e-isolated.sh` gleichzeitig erzeugen auf dieser Maschine zuverlaessig
  Fehler auf BEIDEN Baeumen mit unterschiedlicher Signatur — so ein Paar beweist gar nichts. Die Suite
  ist unter Last messbar nicht-deterministisch (ein Lauf fiel 3/759 auf einem Baum mit NULL
  Code-Aenderungen). **Kein Freifahrtschein:** ein Fail bleibt deiner, bis du ihn als Flake beweist, und
  **der fails-identically-at-HEAD-Beweis MUSS seriell laufen** — auch nichts anderes danebenstellen, das
  die Maschine belegt: der Post-Land-Audit (Stufe 2) IST ein `e2e-isolated`-Lauf. Konsequenz fuers Gate:
  die volle Suite darf genau darum kein hartes Pre-Land-Gate sein; sie laeuft als Stufe 2 NACH dem Land.
  Messungen: `docs/attic/regelbuch-messgeschichten-2026-08.md` §11.

### §15.20 claude-gate: drei Phasen (Originalblock, 2026-09-05)

- `./e2e-claude-gate.sh` hat **DREI Phasen** in einem Wrapper (`grep -n 'phase:' e2e-claude-gate.sh` —
  es gilt die Datei): Phase 1 `FLEET_CMD=claude` (Stand-in-Binary) · Phase 2 `FLEET_CMD=harn` (eine
  Harness, die server.ts nie gehoert hat, nur per Env deklariert) · Phase 3 `FLEET_CMD=true` mit LEERER
  `FLEET_HARNESS_COMMS` (Gegenprobe zum „unprobed"-Waiver). Phase 1+2 sind ein PAAR und keine allein
  vollstaendig: Phase 2 beweist, dass fremde Modell-Muster akzeptiert werden; die Gegenprobe (ein
  claude-Fleet lehnt genau diese Muster weiter ab) kann nur in Phase 1 stehen — wer `MODEL_RE`
  aufweitet, kommt an Phase 2 vorbei und wird von Phase 1 gestellt. Phase 2 setzt `default-shell` des
  Test-Sockets auf zsh — ein Check haengt daran, dass ein unquotetes Glob-Modell die Pane toetet.
  **Jede Phase wartet 30 s auf ihren eigenen Server und laeuft danach WEITER, egal ob er je geantwortet
  hat** — ein solches Rot liest sich wie ein Code-Regress und heisst „nie gemessen";
  Erkennungsmerkmal am Post-Mortem: **keine `server.log` in der aufbewahrten Instanz**.

### §15.24 rg/ast-grep/graphify (Originalblock, 2026-09-05)

- **`rg` respektiert `.gitignore` — und gitignored sind hier ausgerechnet `CLAUDE.md` (dieses
  Regelbuch), `fleet.json` (die Queue), die drei Ledger (`lane-outcomes.jsonl` ·
  `post-land-audits.jsonl` · `audit.jsonl`) und `.env`.** Ein `rg` darueber liefert kein
  Fehlerergebnis, sondern ein LEERES — und leer liest sich wie „gibt es nicht". Regel: getrackter Code
  → `rg` gern; alles Operative → **`rg -uu`** (oder schlicht `grep`). Strukturelle Fragen („alle
  Aufrufstellen von X") → `ast-grep --pattern '<muster>' --lang ts <datei>` (0.45.1, user-lokal, auch
  als `sg`; `--json=compact` fuer Maschinen) — gemessen trennt es echte Aufrufstellen von
  Kommentar-/String-Phantomen. `graphify` deckt dieselbe Ebene ab, aber NUR im Haupt-Checkout
  (gitignored, nie im Worktree). Und die `grep`-Aufrufe in `state.sh`/`register.sh` bewusst NICHT auf
  `rg` umstellen: sie lesen gitignorte Dateien, ein naiver Tausch macht daraus stille Leer-Ergebnisse.
  Messdetails: `docs/attic/regelbuch-messgeschichten-2026-08.md` §12.

### §15.30 Demo-Repo (Originalblock, 2026-09-05)

- **Die Demo ist ein eigenes, remote-loses Repo unter `~/claude-fleet-demo`** (Owner-Vorgabe: nicht
  veroeffentlichen — dieses Repo ist public). Sie baut gegen DIESEN Checkout: `@app/*`-Alias auf
  `src/client.ts`, Seite aus `public/index.html` abgeleitet, `node_modules`-Symlink. Konsequenz: **eine
  Aenderung an `public/index.html` oder `src/client.ts` kann die Demo brechen, und
  kein Gate hier sagt es** — sie hat ihr eigenes `bun run typecheck`/`bun run build`, Sekunden. Und: nie eine Datei
  ausserhalb dieses Repos in die tsc-Liste des Gates eintragen — eine Lane hat nur getrackte Dateien,
  so ein Eintrag laesst JEDE Lane am Verify scheitern.

### §15.33 pkill trifft den Live-Server (Originalblock, 2026-09-05)

- **Scratch-Instanzen NIE mit `pkill -f "bun server.ts"` beenden — das Muster trifft den LIVE-Server**
  (gemessen 2026-08-06 in Lane `6102`: getroffen, vom Watchdog in ~1 s respawnt, alle 8 Sessions überlebten —
  Glück, kein Design). Nur `tmux -L <scratch-socket> kill-server` oder die notierte PID.

### §15.34 pkill trifft den Post-Land-Audit (Originalblock, 2026-09-05)

- **Dieselbe Falle gilt für SUITEN: `pkill -f 'e2e-isolated.sh'` trifft auch den Post-Land-Audit des
  Servers** (einmal bezahlt: der mitgetoetete Audit stand als ROT im Register, obwohl nie etwas
  vermessen wurde — adjudiziert `unknowable`). Regel: einen eigenen Suite-Lauf **nur über seine
  notierte PID** beenden (`kill <pid>`), nie über ein Namensmuster — auf dieser Maschine läuft immer
  auch der Audit des Servers unter demselben Namen. Und die Vorschau ist ohnehin verzichtbar: Tier-2
  ist Vorschau, kein Gate, und läuft nach dem Land automatisch.

### §15.35 kill <wrapper-pid> reicht nicht (Originalblock, 2026-09-05)

- **Und `kill <wrapper-pid>` reicht NICHT** (P5-Lane, 2026-08-18): der Wrapper stirbt, der `bun fleet-e2e.ts`-
  Runner läuft weiter (ppid 1), schreibt in denselben geerbten fd und spawnt sein tmux-srv sogar neu. Voller
  Abbruch: Runner-PID killen UND `tmux -L fleettest<pid> kill-server`, danach Lock und Socket prüfen.
  Erkennungsmerkmal einer verschränkten Logdatei: `grep -ao 'isolated-[0-9TZ]*-[0-9]*' <log> | sort -u`
  liefert ZWEI run-ids — und grep hält so ein Log für BINÄR (ohne `-a` leere Ergebnisse, die sich wie „keine
  Fehler" lesen). Zwei verschränkte Läufe vergiften sich auf dieser Maschine gegenseitig; keine der beiden
  Zahlen ist dann ein Urteil.


Zweiter Schnitt derselben Verdichtung (2026-09-05, sechs weitere Bloecke, nur Messdetails gestrichen):

### §15.1 Proportionale lokale Verifikation (Originalblock, 2026-09-05)

- **Proportionale lokale Verifikation (seit `b09f6c4`, 2026-08-13):** frage zuerst
  `GET /api/self/gate` (self-token) und fahre die von `localProof.steps` empfohlene Beweismenge
  (Step-Namen = Zeilen der vollen Kette unten; `classifiedAs` nennt je Datei die Regel).
  `localProof: null` oder Route nicht erreichbar ⇒ volle Kette. `isolatedPreview` steuert nur die
  Vorschau (`true` = fahren, `"self-assess"` = die bestehende Merge-/Land-Pfad-Selbstprüfung).
  Der serverseitige Land-Gate bleibt autoritativ und fährt die volle Kette; seit 2026-08-25
  (`e896826`, Owner-Entscheid) wählt er für rein-docs-Lands (JEDE Diff-Datei klassifiziert
  docs-or-prose, leerer/gemischter Diff ⇒ voll) die kurze Beweiskette install+pins, stempelt
  `verify.proportional` + `verify.steps` ehrlich auf die Land-Note, und der Post-Land-Audit
  bleibt unverändert voll — der lokale Beweis ist der schnelle, nie der Ersatz. Vertrag:
  `AGENTS.md` §Verify, Mapper: `verify-proportion.ts` (einzige Klassifikationsquelle beider
  Seiten).

### §15.9 Gate-Route /api/self/gate (Originalblock, 2026-09-05)

- **Was dich wirklich gated, ist abfragbar** (Lane-only, gleiche Credential wie drift, seit `184fc72`):
  `curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://<FLEET_HOST>:8790/api/self/gate` — live
  `verify{cmd,timeoutMs,waitMs,skipExit}` (`verify:null` = kein Gate konfiguriert; **zwei Budgets, nicht
  austauschbar** — `timeoutMs` ist, was das Gate ARBEITEND ausgeben darf, `waitMs`, was es in der Schlange vor
  dem Suite-Mutex verbringen darf, bevor es anfängt (getrennt seit `08dc17a`). Ein `waitedOut` ist nie
  `ok:false`: es hat den Baum nie angesehen), `cleanReview`-Modus,
  `autoReview`, `postlandAudit`, `mergeRepairRounds`, `rulebookDrifted` (deine CLAUDE.md-Kopie vs. Quelle;
  `null` = nicht vergleichbar, NIE „kein Drift" — bei `true` die Regeln aus `git show main:` bzw. dem
  Quell-Checkout nachziehen, bevor du auf sie baust). Die Route liest den Env des LAUFENDEN Servers, nicht
  eine Datei — bei Abweichung von der Verify-Zeile oben gilt die Route.

### §15.21 fleet-e2e.ts Runner und Kopierlisten (Originalblock, 2026-09-05)

- `fleet-e2e.ts` is a **runner only**: it boots the check modules in `e2e/*.ts` in order and prints
  the tail. Add a check next to its family in the right `e2e/<family>.ts`, never at EOF and never back
  into the runner. Shared plumbing (`check`, `post`/`get`, `tmuxOut`, `paneEnv`, `ROOT`, `REPO`) is
  `e2e/harness.ts`; fixtures that outlive their own section travel through `e2e/ctx.ts`. A pane
  env-var probe MUST go through `paneEnv()` — hand-rolled send-keys + sleep + capture-pane is the shape
  of a removed flake. `e2e-isolated.sh` copies `e2e/` alongside `fleet-e2e.ts`; a new sibling file
  needs no wrapper change, a new top-level directory does. `fleet-e2e-claude-gate.ts`,
  `fleet-e2e-clean-review.ts`, `fleet-e2e-security.ts` und `fleet-e2e-postland-audit.ts` sind separate
  Einzeldatei-Harnesses und NICHT Teil dieser Struktur. **Hand-Kopierlisten gibt es nicht mehr, und du
  pflegst auch keine:** seit dem Stage-Fold `3d38960` leiten alle sieben Wrapper ihre Kopierliste aus
  `e2e-stage.sh` ab, und zwei Pins halten das fest — die alte Todesart (eine Suite stirbt monatelang
  unentdeckt am Boot, weil ein Modul in ihrer Hand-Liste fehlte) ist strukturell zu.

### §15.22 CLAUDE.md nur KOPIERT (Originalblock, 2026-09-05)

- **Merke (2026-07-25): `CLAUDE.md` ist gitignored und wird beim Lane-Spawn nur KOPIERT** (`server.ts`, grep
  `createWorktree`). Eine Lane, die diese Datei per Wissenspflege aktualisiert, sieht ihre Änderung nie in
  `git status`, und sie stirbt mit dem Worktree beim Land. Also: Rulebook-Änderungen aus einer Lane **im
  Report als Text melden**, damit sie im Haupt-Checkout von Hand nachgezogen werden. Und: die Kopie ist ein
  Spawn-Zeit-Snapshot — eine lang lebende Lane (⚙ steward) driftet; im Zweifel die Datei im Haupt-Checkout
  lesen. Details: `docs/ungoverned-artifacts.md`.

### §15.26 docs-Regal Spawn-Snapshot (Originalblock, 2026-09-05)

- **Dein `docs/`-Regal ist ein Spawn-Zeit-Snapshot — lies Wissen aus `main:`, nicht aus dem Working Tree.**
  Ein Worktree teilt sich die Object-Database, also liefert `git show main:docs/x.md` IMMER den aktuellen
  Stand, auch wenn die Datei in deinem Baum fehlt oder älter ist (verifiziert 2026-07-27: Lane `e288` hatte
  `docs/suite-contention.md` nicht im Baum, `git show main:` lieferte es vollständig). Konkret:
  `git log --oneline HEAD..main -- docs/` zeigt, was seit deinem Fork dazukam — einmal am Anfang und nochmal,
  bevor du einen roten Check adjudizierst oder einen Befund als neu meldest. Kostet nichts, und eine lange
  laufende Lane altert sonst gegen eine Welt, die sich weiterbewegt hat (`docs/knowledge-currency.md` §3).

### §15.29 Doc-Kollision Lane/Haupt-Checkout (Originalblock, 2026-09-05)

- Doc-Kollision Lane↔Haupt-Checkout: eine Lane brancht von committed HEAD und sieht *uncommittete* neuere
  Analyse im Haupt-Checkout NICHT — ein blinder ff-Land regressiert sie still (passiert 2026-07-22,
  canDeliver-Lane vs. main-seitige synergy/overview-Analyse). Vor dem Landen einer doc-berührenden Lane gegen
  die **working copy** des Haupt-Checkouts reconcilen (nicht nur die evtl. ältere Lane-Basis re-anchoren).
  Besser: main-seitige Doc-Analyse **committen, bevor** du eine Lane spawnst, die dieselben Docs anfasst —
  keine wertvolle Analyse uncommitted im Haupt-Checkout liegen lassen (unsichtbar für Lanes +
  Kollisions-Zündstoff).

### §15.13 Fail ist deiner / Beweisreihenfolge (Originalblock, 2026-09-05)

- Ein e2e-Check-Fail zählt als DEINER, bis du das Gegenteil beweist. "Sieht aus wie ein bekannter Flake"
  reicht nicht; die benannten Flakes sind kein Freifahrtschein für neue Fails gleicher Signatur.
  **Beweisreihenfolge korrigiert 2026-07-26 (docs/verify-tiering.md §11.7): ZUERST denselben Baum erneut
  laufen lassen.** Läuft er grün, ist die Nicht-Determiniertheit direkt bewiesen — fertig. Der frische
  HEAD-Worktree ist der **Fallback** für einen Baum, der identisch weiter fällt: ein *grüner* HEAD-Lauf
  beweist nämlich nichts, weil er "unser Regress" nicht von "der Flake hat diesmal nicht gefeuert" trennt,
  sich aber wie ein Schuldspruch liest. Transcript in den Report, immer.

### §15.17 nohup blockgepuffert (Originalblock, 2026-09-05)

- **Ein Suite-Lauf hinter `nohup … > log` ist BLOCKGEPUFFERT** (2026-09-04): „0 PASS-Zeilen" bei
  lebendem Prozess ist ein Messfehler des BEOBACHTERS, kein Haenger — die Groesse der eigenen
  Logdatei ist kein Fortschrittssensor. Fortschritt liest man an der `server.log` im
  Instanzverzeichnis oder am Trail (`docs/e2e-trail.md`).

