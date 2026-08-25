# SYSTEM.md gegen den Ist-Stand — was das Zielbild eigentlich will, und wo der Kreis heute steht

2026-08-25, Lane `fleet/260825120215-eef1`, Baum `fe27764`. Frage: **Trägt die heutige Mechanik die
Produktidee hinter SYSTEM.md — gemessen an Autonomie zuerst, Funktionsfähigkeit danach, Härtung
zuletzt?**

Auftrag: Analyse, keine Code-Änderung, keine Zustandsmutation. Alle Live-Zahlen sind read-only aus
`fleet.json` und `audit.jsonl` des Haupt-Checkouts gelesen (beide gitignored, daher hier zitiert
statt verlinkt). **VERIFIZIERT** = am Code oder am Live-Zustand dieser Maschine gelesen.
**GEFOLGERT** = aus verifizierten Stücken abgeleitet, nicht selbst gemessen. **UNGEPRÜFT** = nicht
gelesen.

Diese Notiz baut auf `docs/messungen/2026-08-23-redteam-glm-autonomie.md` auf. Dessen Befund 1.1
(„MAIN hat keine Land-Tür") ist durch die Kette `a7326b3..fe27764` (19 Commits) **geschlossen**;
dessen Befund 5.6 („sessionId-Divergenz, kein Gate, Vorkommensrate UNGEPRÜFT") hat sich umgedreht:
es gibt jetzt ein Gate, und die Rate ist gemessen (§B.4).

---

## A. Die implizite Produktidee — und warum sie die Messlatte ist

SYSTEM.md sagt seinen eigenen Kern nirgends in einem Satz, aber jeder Abschnitt zielt darauf: Fleet
soll ein **Betriebssystem für delegierte Absicht** sein. Der Owner nennt ein Ziel einmal, und die
Maschine hält Ziel, Zerlegung, Kontext, Beleg und Rückweg so lange zusammen, bis ein Ergebnis
existiert — ohne dass der Owner selbst die Transportschicht zwischen zwei Teilen ist. Die vier
Kernobjekte kodieren genau das: `Act` macht Arbeit *adressierbar* statt nur startbar (§82-98),
`ContextEnvelope` macht Kontext zu einem *entschiedenen Vertrag* statt zu einer Gewohnheit
(§105-117), `AgentInstance` lässt Identität die Slot-Wiederverwendung überleben (§75-80), `Trace`
macht die Belegkette rekonstruierbar (§119-133). Das Rollenmodell kennt bewusst nur zwei
Autoritätsklassen (§39-44), weil jede dritte einen menschlichen Weiterreicher zurückholt.
`Promotion als Policy` (§135-149) ist der tragende Gedanke: die knappe Ressource des Owners ist
nicht die Entscheidung, sondern die Aufmerksamkeit — also promoviert er einmal eine Regel statt
jedes Mal einen Diff. Das Funktionsvokabular (§167-189) will, dass Agenten Fleet über acht stabile
Verben erreichen statt über Routen, weil eine Route das ist, was ein Agent nicht entdecken kann.
Und die UI (§207-220) soll aus Act-/Trace-Zuständen gebaut sein statt aus Terminaltext, weil ein
Zustand, den man nur als Prosa lesen kann, ein Zustand ist, den der Owner selbst neu herleiten muss.

Daraus fällt die Messlatte: **Fleet ist genau so gut, wie ein einmal genanntes Owner-Ziel sich
weiterbewegt, während der Owner nicht hinsieht — und wie zuverlässig er genau einmal gerufen wird,
an der Tür, die nur er öffnen kann.** Die Idee hat zwei symmetrische Fehlrichtungen: ihn rufen für
etwas, das er längst delegiert hat (Autonomieverlust), und ihn **nicht** rufen, wenn der Kreis
stehengeblieben ist (Funktionsverlust). Die zweite ist die teurere, weil sie still ist. Die drei
frischen Prüfsteine des Auftrags sind dreimal dieselbe zweite Fehlrichtung.

---

## B. Zielbild gegen Ist

### B.1 Wo die Mechanik der Idee dient — VERIFIZIERT

Der Act-Kreis ist seit dieser Woche fast geschlossen: filen → releasen → Tick → Report → landen →
Merge-Watch → Audit-Watch. Alle Türen existieren als Self-Routen und stehen in der Rollentabelle
(`AGENTS.md:55`, Zeile „Project MAIN"), der Gründungsbrief nennt sie seit `75daf22` von selbst
(`server.ts:14690-14720`, PROGRAM_MAIN_RAIL_BLOCK). Die Land-Leiter ist ein vorbildliches
default-deny mit zwölf benannten Ablehnungen, jede ein eigener Satz, der auf eine andere Reparatur
zeigt (`server.ts:6576-6690`). `Promotion als Policy` existiert als geschlossener, versionierter
Record und hat seit `fe27764` eine Owner-Fläche auf dem Board (`src/client.ts:6300-6390`). Die
Phasenprojektion (`program-phase.ts:128-215`) ist echt abgeleiteter Zustand mit 14 benannten Regeln,
keine Prosa. Das ist der Teil des Zielbilds, der wirklich trägt.

### B.2 Der Kernbefund: jeder Weg von der Maschine zum Owner beginnt mit einem Agenten-Akt

VERIFIZIERT, drei Stellen, eine Konsequenz.

1. `openAttention` (`server.ts:6871`) ist der **einzige** Schreiber von `attentionRequests` — die
   einzige Zuweisung steht auf `server.ts:6919`, die Ladefunktion auf `:15845`, sonst nur der
   Prune-Filter auf `:6359`. Die Route verlangt einen Slot mit gebundener MAIN
   (`boundProgramForMain`, `server.ts:6897`).
2. Alle drei OWNER_GATE-Regeln des Phasenmodells fordern `openAttention > 0`
   (`program-phase.ts:149-153`, `:176-181`, `:202-206`). Die Projektion kann also nur ein Owner-Gate
   melden, das der Agent zuvor erklärt hat.
3. Das Abzeichen des Owners ist bei null **ausgeblendet** (`src/client.ts:9159`), mit einer für sich
   guten Begründung im Kommentar: „an always-present empty inbox trains the eye to ignore it". Das
   ist richtig für einen Posteingang und falsch für eine Gesundheitsfläche.

Konsequenz, GEFOLGERT aus diesen drei: genau die Fehlerklasse, in der **der Agent das ist, was
stehengeblieben ist**, hat strukturell keinen Kanal. Das ist der gemeinsame Mechanismus hinter allen
drei frischen Prüfsteinen — nicht drei Bugs, sondern dreimal eine fehlende Schicht.

Eine Ausnahme, die die Regel schärft: `tickBacklogNudge` (`server.ts:10008-10059`) **ist** genau so
eine Schicht — sie bemerkt eine Stillstandsbedingung (offene ausführbare Zeilen) und stupst eine
idle Session an. Die Bauform existiert also im Baum, gedeckelt (`BACKLOG_NUDGE_MAX`), mit Cooldown
und mit derselben `canDeliver`-Disziplin wie jede andere Zustellung. Sie ist nur **einmal
instanziiert**, für eine einzige Bedingung, und sie stupst einen Agenten, nie den Owner.

### B.3 Das Phasenmodell hat keine Uhr — VERIFIZIERT, und die Zahl ist groß

`PhaseInput` (`program-phase.ts:65-72`) trägt `task`, `lane`, `merge`, `openAttention`, `outcome`
und `idleThresholdMs`. **Keinen einzigen Zeitstempel.** Regel R4 („pending — awaiting a release
door", `:155-158`) und R5 („queued — awaiting the dispatch tick", `:159-162`) liefern beide READY,
ob die Zeile drei Sekunden oder drei Wochen alt ist.

Live gemessen am 2026-08-25 14:06 aus `fleet.json`:

| Größe | Wert | Definition |
|---|---:|---|
| Tasks gesamt | 200 | alle Zeilen in `tasks[]` |
| davon `pending` | 101 | Status-Feld |
| davon `pending` UND `kind:"auftrag"` | **80** | nur ausführbare Zeilen; `notiz` ist advisory |
| Medianalter dieser 80 | **388,7 h** (16,2 d) | `now − created` |
| Maximalalter | **446,0 h** (18,6 d) | älteste sechs Zeilen alle vom 2026-08-07 00:09 |
| davon mit `programId` | 18 von 80 | die übrigen 62 hängen an keinem Program |

Jede dieser 80 Zeilen projiziert als READY. Kein Feld, keine Route und keine Fläche in Fleet sagt,
wie lange. Zum Vergleich: die Queue-Triage vom 2026-08-19 zählte 71 offene Zeilen
(`docs/messungen/2026-08-19-queue-triage.md`); sechs Tage später sind es 101.

Nebenbefund, VERIFIZIERT: eine Task-Zeile trägt die Schlüssel
`id, kind, status, repo, slot, source, text, brief, analysis, note, from, created` — **kein
`statusAt`**. Ein Alter „seit diesem Status" ist heute nur für `pending` exakt (dort ist `created`
der Statusbeginn, solange die Zeile nie `sent` war).

### B.4 Die Self-Land-Erlaubnis ist default-deny ohne Betriebs-Schleife — VERIFIZIERT

Live-Zustand, 2026-08-25 14:06, aus `fleet.json` (54 Programme: 25 `complete`, 19 `active`,
10 `proposed`):

| Größe | Wert |
|---|---:|
| aktive Programme | 19 |
| davon mit Promotion-Record | **4** |
| davon mit Promotion, die die Land-Tür **nicht** benutzen können | **2** |
| aktive Programme ohne jede Promotion | 15 |
| aktive Programme ohne MAIN-Bindung (`main: null`) | 1 (`2a5fb604`) |
| Alter der vier Grants zum Messzeitpunkt | **26 min** |
| Zeitspanne zwischen erstem und letztem der vier `confirmedAt` | **76 ms** |

Die 76 ms sind der Beleg für Prüfstein (a): die vier Grants sind ein **Stapelakt von heute
13:40**. Vor diesem Griff konnte seit dem Land der Promotion-Mechanik (`a0b3b40`, 2026-08-24) kein
einziges aktives Program selbst landen — der Mechanismus war korrekt gebaut und vollständig
wirkungslos, weil niemand ihn drückte und **nichts es sagte**.

Warum nichts es sagte, VERIFIZIERT: die einzige programmübergreifende Projektion, die es gibt, ist
`supervisorView` (`server.ts:15046`). Ihr `portfolio`-Objekt (`server.ts:15086-15095`) trägt
`program{id,status,title,createdAt,confirmedAt,activatedAt,completedAt}`, `main{slot,openedAt,
sessionId,boundAt}`, `occupancy` und `tasks{total,byStatus,phases}` — und **kein `promotion`**. Die
einzige Fläche, die den Portfolio-Blick hat, kann das Feld, das über Autonomie entscheidet, nicht
sehen. Dazu kommt (`AGENTS.md`, Rollentabelle Zeile „Supervisor"): der Supervisor hat **keine Route
zum Owner**, weil Attention eine MAIN-Bindung verlangt.

### B.5 Die sessionId-Tür gatet exakt und hat keine Heil-Tür — VERIFIZIERT, mit Live-Opfern

`boundProgramForMain` (`server.ts:6396-6407`) gatet sessionId **bewusst nicht**; der Kommentar
darüber (`:6380-6392`) argumentiert das sauber: `slot + openedAt` identifiziert die Belegung schon
eindeutig, und wer die Pane fahren kann, hält ohnehin das Self-Token. Die Land-Route weicht davon
**absichtlich** ab (`server.ts:6583-6588`): `if (program.main!.sessionId !== s.sessionId)` →
409 (`server.ts:6589-6590`), mit dem Satz „ask the owner to re-bind the Program-MAIN". Das Argument
im Kommentar — „Refusing is the recoverable direction; landing under an identity nobody confirmed is
not" — ist richtig. Der Defekt ist nicht das Gate. Der Defekt ist, dass „recoverable" nie als
Recovery gebaut wurde: der einzige Ausweg aus einem Autonomie-Mechanismus ist ein Menschen-Akt, und
nichts sagt dem Menschen, dass er fällig ist.

Live gemessen: von den vier aktiven Programmen mit Grant tragen **zwei** `main.sessionId: null` bei
lebender Pane —

- `69305ad8` (slot 1, `boundAt` 08-24 21:01, 0 Tasks)
- `6fcc2971` (slot 3, `boundAt` 08-24 23:10, 4 Tasks: 3 `done`, **1 `sent`** — also eine laufende
  Lane unter einem Grant, den ihre MAIN nicht benutzen kann)

Die Herkunft ist am abgeschlossenen Program `d576186d` exakt lesbar: `promotion.confirmedAt`
1787573955628, `main.boundAt` 1787575526400 — der Grant ist **26,2 Minuten vor der Bindung**
gestempelt, und die Bindung schrieb `sessionId: null`. Die vier Bindungsschreibstellen
(`server.ts:14880`, `:14988`, `:15430`, `:15544`) setzen alle `sessionId: free.sessionId ?? null`,
also ist `null` das Ergebnis einer Bindung vor dem ID-Learn. **UNGEPRÜFT geblieben: warum
`free.sessionId` zum Bindungszeitpunkt leer ist** — das ist die erste Frage einer Folge-Lane, und
von ihrer Antwort hängt ab, ob V2 unten überhaupt gebaut werden darf (§C.2).

### B.6 Zustellung gibt nie auf und eskaliert nie — VERIFIZIERT, aber das konkrete Opfer ist schon repariert

Mechanik (`server.ts:10275-10285`): `SendRefused` → `event.status = "pending"`, Audit-Zeile
`fleet_event_held`, `continue`. Kein Deckel auf `attempts`, kein Backoff, kein Terminalzustand (das
einzige `MAX_ATTEMPTS` im Baum ist `ANALYSIS_MAX_ATTEMPTS`, `server.ts:7754`/`:7829`, ein anderes
Subsystem). Gemessen an `audit.jsonl` (10 516 Zeilen):

| Größe | Wert |
|---|---:|
| `fleet_event_held`-Zeilen | **2 608** = 24,8 % des gesamten Ledgers |
| betroffene Events | **4** |
| davon auf ein Event (`df8ca5c5`) | **2 572** |
| Dauer dieser Serie | 2026-08-23 22:31:51 → 08-24 02:13:30 = **3,69 h** |
| mittlerer Abstand | **5,17 s** (= `AUTOS_TICK_MS` 5000 plus Overhead) |
| Gegenstand | ein `kind=audit`-Watch-Ergebnis für slot 10 gegen einen 129-Zeichen-Composer-Rest |
| Ausgang | kein Timeout, keine Eskalation — 3,9 h nach dem letzten Retry ein `fleet_event_ack` |

**Die Falsifikation, die ich mir selbst gestellt hatte, ist eingetreten.** `d0fa215`
(„roll back only Fleet exact composer payload", 2026-08-24 12:26) landete **nach** dieser Serie. Die
drei Held-Events danach lösen sich in 5 s, 25 s und 135 s auf (2, 6 und 28 Zeilen) und tragen
`rollback=cleared` bzw. `rollback=kept:unobservable` — die ACP-26r-Mechanik arbeitet. Die
unbegrenzte Wiederholung besteht also **strukturell** fort, hat aber seit dem 24.08. mittags **kein
gemessenes Opfer**. Das rangiert V3 unten unter die Schnittlinie (§D).

Ein Textbefund bleibt, und er ist der Grund, warum der Bug sich neu bilden kann: an **sechs**
Stellen modelliert der Code einen belegten Composer als „owner draft" (`server.ts:355`, `:5110`,
`:5153`, `:5199`, `:10281`, `:21145`). Der Owner hat das am 2026-08-19 ausdrücklich korrigiert —
ungesendeter Pane-Text ist der Rest von Claude Code, nicht sein Entwurf. Wer glaubt, ein Mensch
tippe gerade, für den ist ewiges Warten Höflichkeit. Wer weiß, dass es ein verlassener Agentenpuffer
ist, für den ist es ein Deadlock mit einem höflichen Namen.

### B.6b Nachtrag, an dieser Lane selbst gemessen: der Watch-Deckel und der Report-Kanal teilen ein Budget

Der Fleet-Report dieser Lane wurde **abgelehnt**, viermal über gut zwei Minuten:

```
POST /api/self/fleet-report
{"error":"fleet-report receiver has no FleetEvent delivery budget"}
```

Die Ursache ist ein Deckel, der zwei verschiedene Dinge zusammenzählt (`server.ts:6146-6150`,
gleichlautend für Clarifications auf `:6050-6054`):

```
deliveryDebts + armedReservations >= FLEET_EVENT_MAX_OPEN_PER_SLOT
```

`FLEET_EVENT_MAX_OPEN_PER_SLOT = WATCH_MAX_PER_SLOT` = **5** (`server.ts:2988`, `:2993`). Die
Eigen-Abonnements des Empfängers und die eingehenden Berichte seiner Lanes essen also **aus demselben
Topf**. VERIFIZIERT im persistierten Snapshot zum Messzeitpunkt: der Empfängerslot 9 trägt vier armed
Lane-Watches (Ziele slot 4, 8, 10, 13 — die letzte ist der Watch auf diese Lane) und null offene
Events. GEFOLGERT, weil die Route ablehnte: die In-Memory-Summe war im Moment des Aufrufs ≥ 5; der
persistierte Stand von 4 ist einen Speicherzyklus alt. **UNGEPRÜFT: welche fünfte Reservierung es
war** — eine Lane kann fremde Slots nicht lesen.

Die Struktur ist unabhängig vom fünften Eintrag: **ein Koordinator, der N Lanes beobachtet, verbraucht
N der fünf Plätze, durch die die Berichte derselben N Lanes ankommen müssen.** Bei vier beobachteten
Lanes passt genau ein Bericht gleichzeitig durch. Die Ablehnung ist korrekt und laut — die Lane
erfährt sie sofort. Was **niemand** erfährt: der Koordinator bekommt keine Zeile darüber, dass sein
eigenes Watch-Budget die Rückwege seiner Lanes zuhält. Das ist §B.2 in einem Satz, an einem
Live-Fall, mit einem Kanal, der in beide Richtungen zu ist.

Für die Rangliste ändert das nichts an der Reihenfolge, aber es fügt V1 ein Pflichtfeld hinzu:
`waitingOn` muss den Fall „Empfänger hat kein Zustellbudget" als eigenen Grund nennen können, sonst
sieht ein zugehaltener Rückweg wie eine arbeitende Lane aus.

### B.7 Wo das Zielbild selbst fraglich ist

Auch das ist ein zulässiger Befund, und es sind vier.

1. **Das Funktionsvokabular §167-189 sollte kein Routen-Umbenennungsprogramm sein.** SYSTEM.md nennt
   acht Verben (`describe_self`, `get_act`, `delegate_act`, …). Gebaut sind rund zwölf Self-Routen
   mit anderen Namen und engerem Scope, und `AGENTS.md` sagt für `delegate_act` ausdrücklich
   „target vocabulary with no implementation". Ein Rename kauft heute nichts und kostet jeden Pin,
   jedes Doc und jeden Gründungsbrief. Der Abschnitt sollte sagen, dass die acht Verben das
   **Ausgabevokabular der geplanten Capability-Registry** sind, nicht ein Umbauziel — sonst steht er
   als dauerhaft unfertige Arbeit da, die niemand anfassen sollte.
2. **`Act` gegen die gebaute Task-Zeile ist die größte echte Lücke — und der falsche nächste
   Schritt.** SYSTEM.md §84-93 verlangt neun Felder, darunter exklusives Write-Set, Proof-Kriterium
   und Wake-Ziel. Die gebaute Zeile trägt (VERIFIZIERT, Schlüsselliste in §B.3) keines davon als
   typisiertes Feld; sie leben in der Brief-**Prosa**. Das ist der weiteste Abstand zwischen Zielbild
   und Ist. Er ist aber nicht das, worauf die drei frischen Prüfsteine zeigen, und ihn jetzt zu
   schließen wäre die größte Scheibe mit dem geringsten gemessenen Schmerz.
3. **`Trace` wäre ohne Zusatz ein fünftes Ledger.** §119-133 will eine append-only Kette je Act;
   §222-236 verbietet im selben Dokument „ein zweites Context-Pack-Register" und weitere
   „Stand heute"-Summaries. Fleet führt bereits `lane-outcomes.jsonl`, `post-land-audits.jsonl`,
   `audit.jsonl` und `context-receipts.jsonl`. Das Zielbild sagt nicht, dass `Trace` aus diesen
   vieren **abgeleitet** sein muss — genau das müsste es sagen.
4. **Der Supervisor des Zielbilds hat keine Stimme.** §65-71 sagt, er erkenne Stillstand „und
   nudged den zuständigen Principal". Wenn der Principal das ist, was stehengeblieben ist, geht der
   Nudge in dieselbe tote Pane. VERIFIZIERT: eine Owner-Route hat er nicht (§B.2). Das ist eine
   Lücke im Zielbild, nicht nur im Code — und Program `e04cd5d8` („Supervisor attention channel")
   steht dafür seit einer Weile auf `proposed`.

---

## C. Vorschläge

Jeder mit Mechanismus, kleinster vertikaler Scheibe (outside-in nach §238: Owner-Journey und
sichtbare Abnahme zuerst, dann das kleinste Domainstück, dann Sonden), Kosten, Verify-Weg und
Anfechtbarkeit.

### C.1 — V1: Der Betriebs-Blick. Eine Zeile je aktivem Program, die sagt, worauf es wartet

**Mechanismus.** Eine rein abgeleitete, read-only Projektion über Fakten, die alle schon existieren
(`programs[]`, `tasks[]`, `fleetEvents[]`, `attentionRequests[]`). Je aktivem Program:
`binding` (bound · unbound · sessionId-divergent), `promotion` (absent · off · Sprosse),
`oldestPendingAgeMs`, `oldestQueuedAgeMs`, `openAttention`, `heldEvents{count, oldestAgeMs}` — und
daraus **ein** Feld `waitingOn: "owner" | "machine" | "agent" | null` plus ein Satz, der den Grund
nennt. Nichts wird persistiert. Kein neuer Zustand, keine neue Autorität, keine Mutation.

**Kleinste vertikale Scheibe (outside-in).** Zuerst die Owner-Journey: ein **dauerhaft sichtbarer**
Streifen auf dem Board mit N Zeilen und ihrem `waitingOn`-Satz. Das Abzeichen des Posteingangs bleibt
bei null verborgen (die Begründung auf `src/client.ts:9157-9158` ist richtig); eine Gesundheitsfläche
ist **nie** null und muss deshalb eine andere Fläche sein. Danach die Ableitung, danach die Sonden.

**Kosten.** Eine weitere abgeleitete Fläche, die mit `programExecutionView` und `supervisorView`
konsistent bleiben muss — drei Projektionen über dieselben Fakten sind eine Driftfläche, und die
ehrliche Antwort darauf ist, dass V1 dieselben Helfer benutzt (`phaseOf`, `programOccupancy`,
`laneWatchSignal`), nie eigene. Nutzlast-Disziplin: `/api/sessions` hat nach `8a5e054` gemessene
~1 300 B Luft unter 14 KiB — auf dem 2-s-Poll darf höchstens **eine Zahl** liegen, wie
`attentionOpen` (`src/client.ts:5127-5129`); die Zeilen kommen on demand.

**Verify.** `e2e/programs.ts`: je Fixture einen der vier `waitingOn`-Zustände herstellen und den
Satz prüfen; ein Pin, dass der Streifen bei null Zeilen **nicht** verborgen wird; ein Pin, dass die
Route kein Ledger auf dem Hot-Poll liest. `./e2e-isolated.sh` als Vorschau, weil eine Aussage
geändert wird, über die etwas behauptet wird.

**Anfechtbarkeit.** Widerlegt, wenn eine Folge-Lane misst, dass bei gedrückten Grants und
freigegebenen Zeilen `waitingOn` über einen vollen Tag für jedes aktive Program `null` ist — dann ist
die Fläche Dekoration und die Lücke liegt anderswo. Ebenfalls widerlegt, wenn ein tatsächlich
laufender Supervisor dieselben vier Fakten binnen einer Stunde beim Owner ablädt; heute kann er das
nicht (§B.2), aber wer statt V1 den Supervisor-Attention-Kanal (`e04cd5d8`) baut, macht V1 zur Hälfte
überflüssig — und das wäre ein besserer Schnitt, wenn er billiger ist. **Ich habe nicht gemessen, ob
gerade ein Supervisor gebunden ist.**

### C.2 — V2: Die Heil-Tür für die sessionId-Bindung

**Mechanismus.** Zwei Hälften, und die zweite ist der Punkt. (a) `POST /api/self/rebind`: eine
lebende MAIN im exakten `slot + openedAt` der Bindung darf `main.sessionId` auf ihren eigenen Wert
stempeln — **genau dieses eine Feld**. Das ist keine neue Autorität, sondern die Reparatur eines
Feldes, das vor dem ID-Learn null geschrieben wurde; das Argument steht wörtlich schon im Baum
(`server.ts:6384-6387`: wer die Pane fahren kann, hält ohnehin das Token). (b) Der 409-Satz der
Land-Route nennt **diese** Tür statt des Owners.

**Kleinste vertikale Scheibe.** Zuerst der sichtbare Fakt („diese MAIN kann nicht landen — Identität
divergent"), den V1 ohnehin trägt; dann der geänderte Ablehnungssatz; dann erst die Route.

**Kosten, und sie ist echt.** Die Eigenschaft „exakt der vom Owner bestätigte Occupant" sinkt zu
„die Pane, die das Token hält". Das ist eine Abschwächung und muss so benannt werden, nicht
untergeschoben. Wenn der Owner die strengere Eigenschaft behalten will, bleibt Hälfte (b) plus ein
Owner-Knopf auf dem Board — dann kostet der Fall einen Klick statt einer Route, und Autonomie geht
nur um diesen Klick verloren.

**Verify.** `e2e/programs.ts`: Program mit `sessionId: null` binden, Land-Route lehnt ab, Rebind,
Land-Route nimmt an. Ein Pin, dass Rebind genau ein Feld schreibt und kein `slot`/`programId` aus
dem Body liest (dieselbe Regel wie Release und Land).

**Anfechtbarkeit.** Widerlegt — und zwar erwünscht —, wenn die Bindung stromaufwärts repariert
werden kann: `sessionId` stempeln, sobald sie bekannt ist, oder gar nicht binden, bevor sie es ist
(die vier Stellen `server.ts:14880`, `:14988`, `:15430`, `:15544`). Dann ist V2(a) toter Code, bevor
er existiert. **Diese Prüfung steht vor jeder Zeile Code**, und sie ist genau die UNGEPRÜFTE Frage
aus §B.5. Task `c7629ff7` läuft auf slot 4 zu diesem Thema; ihr Ergebnis geht V2 vor.

### C.3 — V3: Eine Uhr im Phasenmodell, in der billigen Form

**Mechanismus.** **Nicht** ein neues persistiertes Feld. `PhaseInput` bekommt `sinceMs`, und der
Aufrufer füllt es für `pending` aus `created` — dort ist `created` der Statusbeginn exakt, solange
die Zeile nie `sent` war. R4/R5 behalten die Phase READY und bekommen eine `note`, die das Alter
nennt. Erst wenn gemessen ist, dass Zeilen häufig aus `sent` nach `pending` zurückfallen
(`detachSlotTasks`), rechtfertigt sich ein echtes `statusAt`-Feld.

**Kleinste vertikale Scheibe.** Der Satz, den der Owner liest („13 Zeilen dieses Programs sind seit
16 Tagen pending"), sitzt in V1. Danach das Feld in `PhaseInput`, danach die zwei `detail`-Funktionen.

**Kosten.** Gering, solange kein neues persistiertes Feld dazukommt. Sobald doch: eine
Schreibstelle je Statusübergang (zählbar per Pin) und eine Legacy-Form (`statusAt` fehlt = `unknown`,
**nie** 0 — sonst liest sich jede alte Zeile als „gerade eben").

**Verify.** `e2e/programs.ts`: eine Zeile mit altem `created` projiziert READY **mit** Altersnote;
eine ohne `created` projiziert READY mit `unknown`, nie mit 0. Pin: `PhaseInput` liest keine Uhr
selbst (`program-phase.ts` bleibt rein, wie `promotionState` im Client).

**Anfechtbarkeit.** Widerlegt, wenn eine Folge-Lane zeigt, dass ein nennenswerter Teil der 80
pending-Zeilen schon einmal `sent` war — dann ist `created` als Proxy falsch und V3 kostet doch das
persistierte Feld, womit es hinter V2 rutscht. Ebenso widerlegt, wenn der Owner sagt, die 80 Zeilen
seien bewusst geparktes Material und kein Stillstand — dann ist die richtige Antwort ein
Archiv-Akt, keine Uhr.

### C.4 — V4: Die sechs Kommentare, die einen Agentenrest „owner draft" nennen

**Mechanismus.** Text. Sechs Kommentare (`server.ts:355`, `:5110`, `:5153`, `:5199`, `:10281`,
`:21145`) auf die Owner-Korrektur vom 2026-08-19 ziehen. Kein Verhalten ändert sich.

**Kosten.** Ein Commit. **Nutzen:** die falsche Vorstellung ist der Grund, warum „ewig halten,
nie eskalieren" wie das Richtige aussieht; sie wird den Bug aus §B.6 sonst neu erzeugen, sobald
jemand die Zustellung anfasst.

**Anfechtbarkeit.** Widerlegt, wenn gemessen wird, dass Owner tatsächlich in Pane-Composer tippen —
dann gilt der alte Kommentar und die Korrektur von 2026-08-19 wäre die stale Aussage. Das ist eine
Owner-Frage, keine Code-Frage.

---

## D. Rangliste

Gerankt nach der Messlatte: Autonomie zuerst, Funktionsfähigkeit danach, Härtung zuletzt.

| # | Vorschlag | Was es kauft | Kosten |
|---|---|---|---|
| 1 | **V1 Betriebs-Blick** | schließt die gemeinsame Wurzel aller drei Prüfsteine; der Owner wird genau einmal und richtig gerufen | eine abgeleitete Fläche, kein neuer Zustand |
| 2 | **V3 Uhr (billige Form)** | macht den größten gemessenen Stillstand im Baum sichtbar — 80 Zeilen, Median 16 Tage | ein Feld in einer Projektion |
| 3 | **V2 Heil-Tür** (nach `c7629ff7`) | entsperrt 2 der 4 lebenden Grants | eine benannte Abschwächung einer Identitätseigenschaft |

**— SCHNITTLINIE —**

Darunter, weil die Messlatte es so sortiert und nicht, weil es unwichtig wäre:

| # | Vorschlag | Warum unter der Linie |
|---|---|---|
| 4 | V4 Kommentar-Korrektur | Text, kein Verhalten — aber billig genug, um bei der nächsten Berührung der Zustellung mitzulaufen |
| 5 | Zustellung: Backoff + Terminalzustand + Eskalation | 24,8 % des Ledgers, aber das gemessene Opfer ist seit `d0fa215` weg (§B.6). Struktur bleibt offen; ohne Opfer ist es Härtung |

### Restliste „Härtung später" — ausdrücklich nicht mit dem Obigen gerankt

- **Grün ohne Messung.** Red-Team 5.4: ein Repo ohne Eintrag in `FLEET_VERIFY_CMD_REPOS` **und**
  ohne globales Cmd landet clean-rebased ungeprüft. Heute rettet allein die `exit 42`-Erstzeile.
  Einziger Konfigurationspunkt, größte Grün-Täuschung. VERIFIZIERT durch das Red-Team, von mir
  **nicht nachgemessen**.
- **`Act`/`ContextEnvelope`/`Trace` als typisierte Objekte** (§B.7.2/3). Größte Scheibe, geringster
  gemessener Schmerz, und sie würde eine Form einfrieren, während die Betriebs-Schleife noch gelernt
  wird. Bewusst geparkt, nicht vergessen.
- **Unbepreiste Beobachtungen aus `audit.jsonl`, von mir NICHT untersucht:** 1 219 Zeilen
  `owner_auth_fail` und 1 235 Zeilen `self_heal_recreate` (zusammen 23,3 % des Ledgers). Ich habe
  weder Ursache noch Kosten gelesen. Das ist ein Zeiger, kein Befund.

---

## Methode

Alles read-only, keine Zustandsänderung, kein Server gestartet.

```sh
# Zielbild und Ist-Befund
cat -n SYSTEM.md; sed -n '1,613p' docs/kontextschicht-analyse-2026-08-20.md
sed -n '1,218p' AGENTS.md; cat -n docs/authority-slice-brief-2026-08-23.md
git log --format='%h %ad %s%n%b' --date=short a7326b3..HEAD

# Code-Nähte (jede Behauptung dieser Notiz zeigt auf eine davon)
grep -n "attentionRequests = \|function openAttention" server.ts
grep -n "sessionIdMatch\|loadPromotion\|fleet_event_held\|attempts" server.ts
sed -n '6396,6407p;6576,6690p;10275,10285p;15046,15230p' server.ts
sed -n '34,215p' program-phase.ts

# Live-Zustand (gitignored, Haupt-Checkout, nur gelesen)
python3 -c "import json; d=json.load(open('/Users/owner/claude-fleet/fleet.json')); ..."
grep -c fleet_event_held /Users/owner/claude-fleet/audit.jsonl
grep -o '"event":"[a-z_]*"' /Users/owner/claude-fleet/audit.jsonl | sort | uniq -c | sort -rn
```

Die vollständigen Auswertungsskripte sind Einzeiler über `fleet.json` und `audit.jsonl`; jede Zahl in
den Tabellen oben nennt ihre Definition in derselben Zeile.

## Was nicht gemessen wurde

- **Warum `free.sessionId` zum Bindungszeitpunkt null ist.** Die vier Schreibstellen sind gelesen,
  die Ursache nicht. Das ist die Vorfrage zu V2 und läuft als Task `c7629ff7`.
- **Ob gerade ein Supervisor gebunden ist** und ob `supervisorView` je gelesen wurde. V1s
  Anfechtbarkeit hängt daran.
- **Ob pending-Zeilen häufig aus `sent` zurückfallen** (`detachSlotTasks`). Entscheidet, ob V3 in der
  billigen Form reicht.
- **`owner_auth_fail` und `self_heal_recreate`** — nur gezählt, nicht untersucht.
- **Red-Team 5.4** (exit-42-Fallthrough) — zitiert, nicht nachgemessen.
- **Welche fünfte Watch-/Event-Reservierung** den Report-Kanal dieser Lane zuhielt (§B.6b) — eine
  Lane kann fremde Slots nicht lesen.
- **Keine Pane, kein Prozess, kein Ledger beschrieben.** Kein `ps`-Aufruf, der Prozess-Kommandozeilen
  ausgibt (Token-Hygiene).

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-08-25T12:20:00Z	lesepfad	SYSTEM.md vollstaendig vor jedem Code-Blick	das Zielbild ist die Messlatte, nicht der Code	SYSTEM.md:1-243	Produktidee §A rekonstruiert
2026-08-25T12:25:00Z	korpus	docs/messungen auf main geprueft statt im Worktree	Baum ist Spawn-Zeit-Snapshot	git ls-tree main	autonomie-tueren/program-triage existieren nicht, kein Aufbau moeglich
2026-08-25T12:40:00Z	befund	die drei Pruefsteine als EINE fehlende Schicht lesen	openAttention hat genau einen Schreiber	server.ts:6871/:6919	Kernbefund §B.2
2026-08-25T13:05:00Z	messung	Live-Zustand read-only statt aus Prosa zitiert	Zahlen aus HANDOFFs sind Behauptungen	fleet.json	19 aktiv / 4 Grants / 2 unbrauchbar
2026-08-25T13:20:00Z	messung	Pruefstein (c) am Ledger nachgezaehlt statt uebernommen	2608 war eine fremde Zahl	audit.jsonl	2608 bestaetigt, 2572 davon EIN Event
2026-08-25T13:35:00Z	falsifikation	eigene V3-Anfechtung sofort gefahren	ein Vorschlag, dessen Opfer weg ist, gehoert unter die Linie	d0fa215 12:26 vs Serie 22:31-02:13	V3 widerlegt, unter die Schnittlinie verschoben
2026-08-25T13:50:00Z	scope	Act/ContextEnvelope/Trace NICHT vorgeschlagen	groesste Scheibe, geringster gemessener Schmerz	SYSTEM.md:238	in Restliste geparkt
2026-08-25T14:00:00Z	scope	V2 hinter Task c7629ff7 gestellt	die Vorfrage entscheidet, ob V2(a) toter Code waere	server.ts:14880/:14988/:15430/:15544	offen, Reihenfolge festgelegt
2026-08-25T14:25:00Z	befund	die eigene Report-Ablehnung als B.6b aufgenommen	Watch-Deckel und Report-Kanal teilen ein Budget von 5	server.ts:2988/:2993/:6146-6150	V1 bekommt ein Pflichtfeld
```
