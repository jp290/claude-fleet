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
