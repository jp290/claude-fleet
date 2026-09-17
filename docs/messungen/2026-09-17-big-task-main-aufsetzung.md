---
frage: Was fehlt der heutigen Program-MAIN zu der vom Owner beschriebenen Big-Task-MAIN (eindenken, dynamisch planen, angehen, strategisch weiterplanen), wie sieht ihr fertiger Gruendungstext aus, welche Datenschichten braucht sie beim Antritt, traegt dieselbe Aufsetzung einen Berater-Agenten in der normalen Queue, und was ist davon zu bauen?
urteil: Die Big-Task-MAIN ist keine neue Rolle, sondern ein Studio ueber der vorhandenen Program-MAIN. Planen und Angehen sind Mechanismus, Eindenken ist Gewohnheit ohne Artefakt, und strategisches Weiterplanen fehlt als Einziges ganz, weil das Verstaendnis einer MAIN keinen Traeger ueber ihre Nachfolge hat (Program-Inhalt nach confirm eingefroren, Carry 500 Zeichen, Handover traegt nur Pflichten). Der Gruendungstext aus §2 laesst sich ohne Code als Studio-Briefbloecke zu Gruendung UND Nachfolge zustellen, weil `railBlockFor` in beiden Buildern sitzt. Bullig heisst Autoritaet, Executor, benannte Datentueren und ein getracktes Lagebild, nicht mehr Text, denn der MAIN-Render misst schon 75 718 Zeichen gegen 6 319 Bytes Rail. Der Berater-Agent ist heute ausfuehrbar als auftrag mit einer Notiz als DONE, ein Motor fuer richtung und notiz wird abgelehnt. Schnitt ist ein Probelauf ohne Code plus zwei Zeilen, unter der Linie stehen richtung als Quelle, Executor-Evidenz nach Groesse und ctxPacks mit Inhalt.
bereich: [program-main, big-task, briefs, studio, datenlayer, berater]
belege: [server.ts#RAIL_HEAD, server.ts#RAIL_ROLE_STANDARD, server.ts#RAIL_TAIL, server.ts#railBlockFor, server.ts#studioBlockFor, server.ts#buildProgramMainBrief, server.ts#buildProgramMainSuccessionBrief, server.ts#standardHandoverLines, server.ts#MAX_SUCCESSION_CARRY, server.ts#programExecutionView, server.ts#publicProgram, server.ts#createTaskForMain, server.ts#taskVariantsFromBody, server.ts#decideVariantGroup, server.ts#PROGRAM_MAX_RELEASED, server.ts#pinNoteToTask, server.ts#taskKindNote, server/types.ts#Program, server/types.ts#TASK_KINDS, server/types.ts#Studio, server/types.ts#studioContentFrom, server/types.ts#STUDIO_TEXT_MAX, server/types.ts#PROGRAM_PROFILE_KINDS, rulebook.ts#renderRulebook, state.sh, register.sh, land-quality.ts#modelKey, docs/self-api.md §program-context-packs §notes-assign §notes, AGENTS.md §Role contract §Context self-management, docs/messungen/2026-09-14-rollen-briefe-synthese.md §0 §2 §3, docs/messungen/2026-09-14-lane-startkontext-fixkosten.md, docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md §2.2 §2.3 §2.7, docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §3 §4 §5]
nicht-gemessen: Startlast einer Program-MAIN in Tokens (nur Zeichen und Bytes gemessen, Tokens abgeleitet), Wirkung des Gruendungstexts (kein Lauf, kein A/B), ob die vier gebundenen MAINs leben, Fremd-Harness-MAINs (codex, pi), Geldkosten, Tokenwirkung eines ctxPacks (weiter kein Lauf), `programStatusView` und die `isGameMaker`-Stellen nicht gelesen
stand: 2026-09-17
---

# Die Big-Task-MAIN: was fehlt, wie sie aufgesetzt wird, was sie an Daten braucht

2026-09-17, Lane `fleet/260917080307-2dc6`, Baum `5518a259` (Fork-Basis, auf main). Frage: **Hat das
Fleet schon eine Session, die sich erst eindenkt, dann dynamisch plant, angeht und strategisch
weiterplant, und wenn nicht ganz: was genau fehlt, und wie setzt man sie leicht und sauber auf?**

Owner-Idee, woertlich und ungekuerzt (2026-09-17 08:5x): *„Haben wir eigentlich irgendeine art
big-task bei dem erst eine Main Session sich in etwas reindenkt und dann dynamsich plant, es angeht
und dann strategisch ausarbeiten bzw weiter plant wie auch immer?.. wenn ich so drueber nachdenke
koennte das potenziell auch unser ganzes workflow problem soweit loesen. Diese Agenten wuerden dann
mit Briefen und CtxPacks funktionieren und diese koennte man dann wiederum vllt auch fuer
beraterAgenten taetigkeiten in der normalen task-qeue uebernehmen wuerde ich sagen. Wir muessen den
Brief und ueberhaupt die ganze AUfsetzung eines solceh big-task agenten nur wirklich leicht, gut und
sauber+ vernuenftig aufsetzen, ganz der generellen erkenntnis nach, das ein einzelner prompt und
agent eigentlich herausragende Arbeit leisten kann, der prompt sollte in seiner Form dann auch in
absolut erster Linie fuer die SOTA-model's geschrieben werden, wie fable5.1, GLM5.3 und gtp6-astra
usw. Diese sollten im smarten herangehen in der ihnen erklaerten Umgebung & tools, auch wesentlich
besser sein^^ Vllt geben wir dann sogar die moeglichkeit das die lanes von so einer main in
zweifacher weise mit versch. modellen auszufuehren oder je nachdem, hierfuer waere es auch wirklich
wichtig das wir sauber Daten und aggregierte DatenSchichten benutzen und zu verfuegung stellen.
Diese big-task-main session sollte 'bulliger' aufgesetzt werden als normaler weise"*

Markierung: **[geprueft]** = in diesem Baum selbst nachgesehen, Fundstelle daneben · **[gemessen]** =
heute ausgefuehrt, Rezept in §7 · **[abgeleitet]** = aus gemessenen Zahlen gerechnet · **[uebernommen]**
= aus einer zitierten Notiz oder aus dem Auftrag, nicht nachgesehen · **[ungeprueft]** = ausdruecklich
offen. Gelesen habe ich die Rollen-Synthese und Worktrail IV ganz, die Schwesternotiz vom selben Tag
§1–§7, `AGENTS.md` §Portable operating contract ganz, und aus `server.ts`/`server/types.ts` die in
`belege` genannten Symbole. Nicht gelesen: der Rest von `server.ts`, der Client, die e2e-Familien.

## §0 Urteil in sieben Saetzen

1. Die Program-MAIN deckt zwei der vier Phasen als Mechanismus (planen, angehen), eine als
   Gewohnheit ohne Artefakt (eindenken) und eine gar nicht (strategisch weiterplanen) (§1).
2. Die eine echte Luecke ist ein Traeger: was eine MAIN verstanden und warum sie so geschnitten hat,
   ueberlebt ihre Nachfolge nicht. Der Program-Inhalt ist nach `confirm` eingefroren, der Carry
   fasst 500 Zeichen, der Handover traegt Pflichten (attention, watch, auto), kein Verstaendnis
   [geprueft, §1]. Bei einem Uebergabe-Band von 25–35 % ist eine Big-Task-MAIN eine Staffel von
   Sessions, und eine Staffel ohne Stab beginnt jedes Mal bei der Erdung.
3. Diese Luecke schliesst ein getracktes Dokument (hier: Lagebild), kein Code.
4. „Bulliger" als „laengerer Brief" ist die erste Falle: der Brief kostet ~3,6 k von ~70 k
   Start-Tokens einer Lane [uebernommen: Synthese §0], und eine MAIN startet schon mit einem
   Regelbuch-Render von 75 718 Zeichen gegen 6 319 Bytes Rail [gemessen]. Bullig heisst: Autoritaet
   bei Gruendung gesetzt, starker Executor, Datentueren benannt, Lagebild als Stab (§2.1).
5. Der Gruendungstext (§2.2) ist ohne Code zustellbar: ein Studio-Record traegt Owner-Text
   woertlich in Gruendungs- UND Nachfolgebrief der MAIN und in jeden Lane-Brief des Programs
   [geprueft: `server.ts#railBlockFor`, beide Builder; `studioBlockFor(…, "lane")` im Dispatch].
6. Der Berater-Agent ist heute ausfuehrbar, als `auftrag` mit einer getrackten Notiz als DONE. Diese
   Lane ist das Beispiel. Ein Motor fuer `richtung`/`notiz` wuerde das Release-Tor verdoppeln (§4).
7. Zu bauen ist wenig: ein Probelauf ohne Code, danach eine Messzeile und, nur wenn der Lauf traegt,
   eine Code-Zeile, die den Boot der Big-Task-MAIN auf ihr Program schneidet (§5).

## §1 Was fehlt wirklich — Phase fuer Phase

Klassen wie im Auftrag: **vorhanden** (Mechanismus: eine Tuer, ein Record oder ein servergebauter
Text erzwingt oder traegt es) · **vorhanden, aber nicht als Mechanismus** (es geschieht, wenn die
Session daran denkt) · **fehlt**.

| Phase (Owner-Wortlaut) | Heute | Klasse | Fundstelle |
|---|---|---|---|
| „sich in etwas reindenkt" | Der Gruendungsbrief verlangt vier Boot-Schritte: `./state.sh`, `./register.sh`, oberster HANDOFF-Abschnitt, Queue ansehen; danach „decide the next bounded Program move". Das erdet die MASCHINE, nicht das Problem. Das Problemverstaendnis steht im Program-Inhalt (`intent`, `successCriterion`, `nonGoals`, `decisions`, `evidence`, `openQuestions`) und stammt von der VORSCHLAGENDEN Session, nicht von der MAIN. Kein Artefakt und kein Tor trennt eine MAIN, die gedacht hat, von einer, die sofort Zeilen filet. Das Game-Maker-Profil hat genau dafuer eine Pflicht (Architect → Proben → Review → ACCEPT), als Rollenpflicht, nicht als Server-Tor. | **nicht als Mechanismus** | [geprueft] `server.ts#buildProgramMainBrief` (Fleet-Frame, Schritte 1–4) · `server/types.ts#Program` · `server.ts#RAIL_ROLE_GAME_MAKER`, `AGENTS.md` §Hard invariants |
| „dann dynamisch plant" | Der Plan IST die Queue des Programs: `POST /api/self/tasks` (Karte mit Flaeche, DONE, VERIFY, Groesse, `NACH`-Abhaengigkeit, Spawn-Tripel je Zeile), `release` mit Deckel 5 unstartete Zeilen je Program, `hold`, `confirm-cards`, `wave/split`, `brief`, `files-proposal`, `notes-assign`, `program-context-packs`. Die Projektion `GET /api/self/program-execution` rechnet je Zeile `phase` und `nextAction`. Der Loop im Rail heisst „choose the next smallest bounded act", also Planen je Akt statt Vorausplan. | **vorhanden** | [geprueft] `server.ts#RAIL_TAIL`, `server.ts#createTaskForMain`, `server.ts#PROGRAM_MAX_RELEASED` (Default 5), `docs/self-api.md` (Abschnittsliste §release bis §wave/split) |
| „es angeht" | release → Dispatch-Tick → Lane → typisierter Report (ein CLAIM) → Diff und Verify-Tail lesen → `land` bei Owner-Promotion → watch merge → watch audit; Rueckfragen ueber `clarifications`; dauerhafter Rueckkanal `inbox`. Verschiedene Modelle je Lane: Spawn-Tripel je Zeile, und eine Variantengruppe (2–4 Agentenwahlen, genau eine landet), die eine MAIN selbst filen (`variants` im Body) und selbst entscheiden kann (`POST /api/self/tasks/:id/variant-winner`). Gemessene Nutzung: 394 Aufrufe der Projektion in 14 Tagen, Klasse „Schicht wie vorgesehen benutzt". | **vorhanden** | [geprueft] `server.ts#RAIL_TAIL`, `server.ts#taskVariantsFromBody` (`TASK_VARIANTS_MAX = 4`), `server.ts#decideVariantGroup` (`by: "owner" \| "main"`) · [uebernommen] Schwesternotiz §3, §4.1 |
| „dann strategisch ausarbeiten bzw weiter plant" | Der Loop endet mit „Then choose the next bounded act". Es gibt keinen Punkt, an dem die MAIN das Gelandete gegen `successCriterion` haelt und den Plan neu schreibt, und keinen Ort dafuer: (a) der Program-Inhalt ist nach `confirm` fest, ein `confirm` auf ein aktives Program antwortet 409, und `validateProgramContent` hat vier Aufrufer (Owner-Anlage, confirm, Laden, Self-Vorschlag), keiner davon aendert ein aktives Program; (b) der Handover einer Standard-MAIN sind Zaehler plus die sterbenden Pflichten attention/watch/auto; (c) der Carry ist auf 500 Zeichen gedeckelt; (d) HANDOFF.md ist fuer die Standard-Schiene „transitional residue only, never your state source". | **fehlt** | [geprueft] `server.ts#RAIL_TAIL` (letzter Loop-Punkt), Route `confirm` in `server.ts` (409 bei `active`), `rg "validateProgramContent\("` = 4 Aufrufer, `server.ts#standardHandoverLines`, `server.ts#MAX_SUCCESSION_CARRY = 500`, `server.ts#buildProgramMainSuccessionBrief` (Fleet-Frame Schritt 3) |

Drei Beobachtungen dazu, jede mit Preis:

- **Tueren, die der Rail nicht nennt.** `RAIL_TAIL` nennt tasks, release, clarifications, land, watch,
  inbox, attention. Er nennt NICHT: Varianten und `variant-winner`, `hold`, `confirm-cards`,
  `program-context-packs`, `notes-assign`, und `GET /api/self/programs` (die eigene Program-Zeile samt
  `promotion`, `dispatch`, `release`, `contextPacks`, weil `publicProgram` den ganzen Record spreizt)
  [geprueft: `RAIL_HEAD`/`RAIL_TAIL` ganz gelesen; `server.ts#publicProgram`]. Die Varianten-Tuer
  steht auch nicht in `docs/self-api.md` [geprueft: `rg -i variant docs/self-api.md` trifft nur
  andere Bedeutungen]. Preis: der Owner-Wunsch „Lanes zweifach mit verschiedenen Modellen" ist
  gebaut, aber eine MAIN erfaehrt davon aus keinem Text, den sie liest. Heute traegt `fleet.json`
  eine Variantengruppe mit zwei Varianten [gemessen].
- **Der Boot ist flottenweit, die Rolle programmweit.** `./register.sh` druckt heute 478 Zeilen /
  48 693 Bytes ueber ALLE offene Arbeit, `./state.sh` 108 Zeilen / 9 636 Bytes [gemessen]. Die
  Schwesternotiz mass, dass alle vier Haupt-Checkout-Sessions beide je zweimal fahren, weil die
  Ausgabe nicht in ein Ergebnis passt (15 Aufrufe, 128 152 B, 43 % der Klasse-0-Bytes)
  [uebernommen: §4.3]. Fuer eine Program-MAIN beantwortet `program-execution` die Frage „was ist
  in MEINEM Program offen" programmscharf; der Gruendungsbrief verlangt trotzdem den Volllauf.
- **Staffel statt Dauerlaeufer.** Abgeleitet startet eine claude-MAIN bei rund 9 % eines
  1M-Fensters und nach dem Boot bei 10–12 % [abgeleitet, §7]; ab ~25–30 % gehoert neue tiefe Arbeit
  in eine frische Session (`AGENTS.md` §Context self-management). Eine Session hat also rund
  150–250 k Tokens Arbeitsraum. Eine MAIN, die „bullig" selbst liest, verbraucht ihn mit Erdung
  (Median einer Lane: 75 k Tokens vor dem ersten Schreiben [uebernommen: Worktrail IV §2.2]).

Nur die vierte Zeile ist Bauarbeit im Sinn des Auftrags, und sie ist mit einem Dokument und einem
Text zu schliessen, nicht mit einer Route (§2, §5).

## §2 Die Aufsetzung

### §2.1 Was „bulliger" heissen muss

Nicht mehr Text. Belege: Brief ~3,6 k von ~70 k Start-Tokens einer Lane, Render 18,3 k, Erdung
danach ~75 k [uebernommen: Synthese §0, Fixkosten-Note, Worktrail IV §2.2]; Anker im Brief senken
die Erdung nicht messbar (33 Aufrufe vor dem ersten Schreiben MIT Ankern), Datei+Symbol im Brief
schon (12 Aufrufe, n klein) [uebernommen: Worktrail IV §2.3, §1]. Fuer die MAIN kommt hinzu:
`renderRulebook("main")` misst heute 75 718 Zeichen, `renderRulebook("lane")` 19 986 [gemessen; der
Lane-Render lag am 2026-09-13 bei 35 666, Synthese §1]. Der Rail ist mit 6 319 Bytes ein Zwoelftel
davon. Jeder Satz, der in den Gruendungstext kommt, konkurriert mit 75 k Zeichen, die schon da sind.

Bullig heisst vier Dinge, und jedes existiert:

| Gewicht | Was es ist | Stand |
|---|---|---|
| **Autoritaet bei Gruendung** | drei Owner-Records am Program: `promotion` (`selfLand`: off · green-only · guarded), `dispatch` (`on`, `maxLanes`: darf der Tick die Zeilen dieses Programs auch bei gestopptem Fleet starten), `release` (`policy`: manual · card-valid · all). Abwesend = Standardgrenze. Eine MAIN ohne `promotion` wartet bei jedem Land auf den Owner. | [geprueft] `server/types.ts#Program`, `#PromotionPolicy`, `#ProgramDispatch`, `#ProgramRelease`; je eine Owner-Route |
| **Executor** | MAIN auf dem staerksten Modell, Lanes je Akt gewaehlt, Varianten fuer offene Ansaetze. Grenze: `pi-zai`/`pi-unfenced`/`container` sind `automatable:false`, eine GLM-Lane startet der Tick also nie [uebernommen: Synthese §1]; ueber den MAIN-Weg erreichbar sind claude- und codex-Harness. | Owner-Politik 2026-09-02 [uebernommen: Schwesternotiz §5] |
| **Datentueren** | die Projektionen, die die Antrittsfragen beantworten, im Text BENANNT (§3). 85 % der symptomatischen Bash-Aufrufe trafen eine Schicht, die es gibt [uebernommen: Schwesternotiz §1]. | §3 |
| **Stab** | ein getracktes Lagebild je Program, das Verstaendnis, Plan, Verworfenes und Verlauf traegt und das die Nachfolgerin ZUERST liest. | neu, reines Dokument (§2.2 Block 3) |

Dazu die Form: fuer ein SOTA-Modell geschrieben heisst hier Lage, Ziel, Mittel, Grenzen und die
Gruende dahinter, und das Urteil bleibt beim Modell. Der Rail macht das vor („THE ROLE SPLIT IS A
JUDGEMENT, NOT A WALL", Owner-Korrektur 2026-08-24 [geprueft: Kommentar ueber `RAIL_HEAD`]). Der Text
unten fuegt deshalb keine Schwellen-Tabelle hinzu, sondern Phasen mit ihrem Zweck und ihrer
Abbruchbedingung.

### §2.2 Der Gruendungstext, woertlich

Fuenf Bloecke fuer die MAIN, einer fuer ihre Lanes. Englisch, weil Rail und `AGENTS.md` englisch sind
und der Text direkt hinter dem Rail steht. Jeder Block bleibt unter `STUDIO_TEXT_MAX` = 8 000 Zeichen
[geprueft; gemessen in §7]. Der Text SETZT AUF DEM RAIL AUF und widerspricht ihm nirgends: er wird
hinter `RAIL_ROLE_STANDARD` angehaengt, und ein angehaengter Widerspruch ist der Fehler, den der
Kommentar ueber `RAIL_ROLE_GAME_MAKER` beschreibt („a session reading both follows whichever it
reaches first") [geprueft]. Tueren, die der Rail schon ausbuchstabiert, wiederholt der Text nicht.

```text bt-role
YOU ARE A BIG-TASK MAIN. The Program above is larger than one plan: nobody, including whoever
wrote it, knows yet which acts will finish it. Your job is to find that out and then get it done -
understand first, plan in the open, execute through lanes, and re-plan whenever the evidence moves.

The rail above stays in force exactly as written: what is yours and what is the owner's, how a row
is filed, released, reviewed and landed, and where this ends. This text adds the three things the
rail does not have: a first phase in which you build your OWN understanding of the problem, one
tracked document that holds it, and a checkpoint at which you step back from the next act to the
whole Program.

You were set up heavier than a standard MAIN on purpose, and the weight is not in this text. It is
in what you were given: authority records on your Program, a strong executor, lanes you staff per
act with the model that fits, and data layers that answer your founding questions without a source
search. Read what you were given before you assume it: GET /api/self/programs returns your own
Program row, including promotion.selfLand (may you land), dispatch.on and dispatch.maxLanes (will
your released rows start while the fleet's dispatcher is stopped, and how many at once),
release.policy (which rows count as released without your act) and contextPacks. An absent record
means the standard limit. It never means a hidden permission.
```

```text bt-think-in
PHASE 1 - THINK IN, before the first work row. The boot steps above tell you the state of the
machine. They do not tell you the problem. Spend this phase on the problem.

Read the Program content as the owner's statement of the goal: successCriterion is what done means,
nonGoals and decisions are settled, openQuestions are yours to close or to escalate. The content is
frozen - no door amends an active Program - so what you learn goes into your Lagebild (next
block), never into the Program.

Ask what was already measured. docs/messungen/INDEX.md holds one line per measurement note, each
ending in "bereich: <tags>". It is large; search it (rg -n "<term>" docs/messungen/INDEX.md) and
read only the notes that carry your question. When your tree may be older than main, read
knowledge from main: git show main:<path>.

Ask the projections before the sources. GET /api/self/program-execution gives your rows, each with
its phase and the one door that belongs to it, the last land and last audit of this Program, and
what your predecessor owed. GET /api/self/inbox is what arrived while nobody listened. The
land-health block of ./state.sh and `bun land-quality.ts` say which harness/model pairs landed and
whether their lines held. ./register.sh is fleet-wide; your own open work is in the projection.
Open a raw ledger or a large source file only for a question none of these answers, and then go to
the named symbol, not through the file.

Where understanding needs reading you should not pay for yourself - a wide code surface, a foreign
repository, a second opinion from another model family - hire it. A read-only probe is an ordinary
work row: kind "auftrag", one question, a return shape, DONE = a tracked note at
docs/messungen/<date>-<slug>.md, VERIFY = install, pins. Two or three probes in parallel cost less
than one MAIN that has read everything and is a quarter full before its first decision. A probe's
note is a claim like any report: check the citations you build on.

This phase ends when you can write the Lagebild without a guess in it that you could have checked,
or when your context reaches about 20 % - whichever comes first. It does not end with a plan for
everything. It ends with a first understanding, a first cut of acts, and named unknowns.
```

```text bt-lagebild
YOUR LAGEBILD is one tracked file in this Program's repository:
docs/programme/<first 8 characters of your Program id>-lagebild.md. It is the only place your
understanding survives you. A succession hands your successor the Program's typed record - rows,
inbox, what you owed - and at most 500 characters of carry. None of that says why you cut the work
the way you did. The Lagebild does. Keep it readable in one call (under about 200 lines) and keep
these sections, in this order:

 1. STAND - the date, the commit you last verified against, and three sentences: where the Program
    is, what the next act is, what would change your mind.
 2. VERSTAENDNIS - the problem in your own words; the facts you verified, each with file#symbol or
    a note path; the assumptions you did NOT verify, marked as such.
 3. PLAN - the acts you see, in order, one line each: goal, surface, the executor you would hire
    and why, what it depends on. A filed act carries its row id. This is a forecast, not a
    commitment: only the next one to three acts are ever filed.
 4. VERWORFEN - approaches you ruled out and the evidence that ruled them out, so nobody pays for
    them twice.
 5. OFFEN - unknowns, each with the observation that would close it; owner questions separately,
    each with your recommendation.
 6. VERLAUF - one line per strategic checkpoint: date, what landed since the last one, what you
    changed in the plan and why. Append-only.

Commit it whenever a section changes. A small documentation edit in your own checkout is yours by
the rail, and an uncommitted file in this checkout blocks every land, so edit and commit in one
move. Then point your lanes at it: POST /api/self/program-context-packs takes up to five packs of
up to four {path, anchor} pointers, and every lane of this Program receives them as anchors. A pack
on the Lagebild's PLAN heading plus one per key source is usually the whole set. Packs carry
pointers, never content: what a lane must KNOW goes into its brief as file#symbol and a checkable
DONE, because a pointer is followed and a named symbol is read.

When you hand over, your carry is one sentence: read the Lagebild first, and its path.
If a Lagebild already exists when you start, you are a successor. Read it before anything else in
this text, verify STAND against git and the projection, and continue from it. Do not rebuild it
from your own reading.
```

```text bt-execute
PHASES 2 AND 3 - PLAN AND EXECUTE are the rail's loop, with two additions.

STAFF EACH ACT DELIBERATELY. The spawn triple on a row is a hiring decision; the STAGES above name
this studio's defaults. For an act whose approach is genuinely open, or whose failure would be
expensive to discover late, file a variant group: the same POST /api/self/tasks body with
"variants": [{"harness","model","effort"}, ...] (two to four agent choices, ideally of different
model families). Each variant works the same brief in its own lane and exactly one lands. You name
the winner with POST /api/self/tasks/<groupId>/variant-winner {"winner":"<variantRowId>"}, from
the diffs and the verification output, never from the reports' prose, and you write the reason
into VERLAUF. A variant group costs every one of its lanes in full: use it where the uncertainty is
in the approach, not to double routine work.

KEEP THE FRONT SHORT. At most five released rows may wait unstarted per Program - the release door
refuses the sixth - and a plan filed twenty rows deep is a plan nobody can change. File and release
what the next one to three acts need. Everything further lives in PLAN.

PHASE 4 - THE STRATEGIC CHECKPOINT. The rail's loop ends with "choose the next bounded act". At a
checkpoint you do not. You step back: re-read successCriterion, hold it against what has actually
landed and been audited (the projection's last land, last audit and row phases), and answer three
questions in writing. Is the Program closer to done than at the last checkpoint, and by what
evidence? Which assumption in VERSTAENDNIS did the returned work confirm or break? Does the rest of
PLAN still lead to the criterion, or is there a shorter way now? Then rewrite PLAN, add the VERLAUF
line, commit.

A checkpoint is due after every third landed act, after a red post-land audit you adjudicate as
real, after any report that contradicts your Lagebild, and before every handover. It costs one turn
and one commit. Skipping it is how a MAIN becomes a scheduler that finishes rows instead of the
Program.
```

```text bt-stop
WHERE A BIG TASK STOPS - in addition to the rail's boundaries.

DONE is the successCriterion shown by evidence you verified. It is never the emptiness of your
queue. When you believe it is met, write the evidence into STAND, commit, and raise the one
attention the rail allows.

STOP AND ASK when a checkpoint shows the criterion cannot be reached inside the confirmed scope,
when two consecutive checkpoints show no evidence of progress, or when the next act needs something
only the owner holds: scope, cost, external effect, deploy, taste. One attention, carrying your
recommendation and the Lagebild path.

HAND OVER, DO NOT DEGRADE. Your quality falls long before your window is full; the contract's band
is about 25-30 % (AGENTS.md, Context self-management). When you reach it, finish the act in hand,
run a checkpoint, commit the Lagebild, and succeed with the one-sentence carry. If your harness
compacts itself instead of handing over, treat each compaction as a handover to yourself:
checkpoint and commit first.

Three rules of the contract erode first in a long-running session, so they are named here once: a
worker's report is a claim until you have read the diff and the verification output; a red check is
yours until you prove otherwise; an unknown stays "unknown" in the Lagebild and never becomes a
zero or a pass.
```

Der Lane-Block (`appliesTo: "lane"`), den jede Lane dieses Programs vor den Ankern bekommt:

```text bt-lane
You work for a Big-Task MAIN. Its current understanding and plan are tracked in
docs/programme/<program id, 8 chars>-lagebild.md; the context anchors below point at the parts that
concern you. Read PLAN for where your act sits and VERWORFEN before you choose an approach that
may already have been ruled out. Your brief outranks the Lagebild for WHAT you do; the Lagebild
explains WHY. If what you find contradicts the Lagebild, say so in one line of your report - that
line is what the MAIN's next checkpoint is for. Do not edit the Lagebild; it has one writer.
```

### §2.3 Warum jeder Block drin ist — je ein Satz

| Block | Grund |
|---|---|
| `bt-role` | Er sagt der Session, dass der Rail weiter gilt und was NEU ist, und er benennt die eine Tuer (`GET /api/self/programs`), ueber die sie ihr eigenes Gewicht liest statt es anzunehmen, denn der Rail nennt diese Tuer nicht [geprueft]. |
| `bt-think-in` | Eindenken wird vom Brauch zur Phase mit Zweck und Abbruchbedingung, und die Erdung laeuft ueber Projektionen und gemietete Proben statt ueber 75 k eigene Lesetokens; die 20 % sind ein Setzwert aus §7, ungemessen. |
| `bt-lagebild` | Er ist der Traeger fuer die fehlende vierte Phase und fuer die Nachfolge, und er bindet die vorhandene ctxPack-Tuer an ein Dokument, auf das sich zu zeigen lohnt. |
| `bt-execute` | Er nennt die zwei gebauten, aber in keinem gelesenen Text stehenden Hebel (Varianten samt Gewinner-Tuer, Release-Deckel 5) und setzt den Checkpoint mit Ausloesern statt mit einer Uhr. |
| `bt-stop` | Abbruchbedingungen, die der Rail nicht hat (kein Fortschritt ueber zwei Checkpoints, Kriterium im Scope unerreichbar), und die Uebergabe als Normalfall einer Staffel. |
| `bt-lane` | Ohne ihn kennt keine Lane das Lagebild; mit ihm entsteht der Rueckkanal „widerspricht dem Lagebild", der den Checkpoint fuettert. |

Bewusst NICHT im Text: Modell-IDs (sie stehen in den Studio-Stages, wo der Owner sie versioniert),
Kontext-Zahlen ausser den zwei Setzwerten, das Filing-Format (eigene Zeile, laut Auftrag), jede
Wiederholung des Loops aus `RAIL_TAIL`, Verify-Kommandos (driften, `docs/lane-brief-template.md`
§Norms [uebernommen: Synthese §2a]).

### §2.4 Zustellung ohne Code: der Text ist ein Studio

`railBlockFor(program)` haengt `studioBlockFor(program, "main")` an den Rail, und beide MAIN-Builder
(`buildProgramMainBrief`, `buildProgramMainSuccessionBrief`) enden auf derselben Naht
`body + railBlockFor(program) + anchorBlock` [geprueft: zwei Aufrufstellen]. Der Dispatch haengt
`studioBlockFor(laneProgram, "lane")` in jeden Lane-Brief des Programs [geprueft: `studioLaneBlock`].
Owner-Text wird woertlich kopiert, die Revision steht im Brief, eine aeltere Bindung wird benannt
[geprueft: `server.ts#studioBlockFor`]. Das ist genau die Eigenschaft, die ein handgesendeter
Gruendungsprompt nicht hat: er waere bei der ersten Nachfolge weg.

Der Record, den der Owner dafuer anlegt (`POST /api/studios`, dann `POST /api/programs/:id/studio`),
als Geruest. Die `text`-Felder sind die sechs Bloecke aus §2.2 woertlich. Mit den echten Blocktexten
und einem Ersatz-Digest hat `server/types.ts#studioContentFrom` ihn angenommen [gemessen, §7]:

```json
{
  "name": "Big-Task",
  "machineProfile": "standard",
  "repoPolicy": "shared-repo",
  "workflow": {
    "doc": { "path": "docs/messungen/2026-09-17-big-task-main-aufsetzung.md", "sha": "<sha256 der Datei am Tag des POST>" },
    "stages": [
      { "id": "eindenken", "title": "Think in and write the Lagebild", "role": "MAIN itself", "required": true,
        "gate": "Lagebild committed before the first build row is released" },
      { "id": "sonde", "title": "Read-only probe with a tracked note as DONE", "role": "worker lane, no code change", "required": false,
        "spawn": { "harness": "claude", "model": "claude-fable-5-1[1m]", "effort": "high" } },
      { "id": "bau", "title": "One bounded build act", "role": "worker lane", "required": true,
        "spawn": { "harness": "claude", "model": "claude-opus-5[1m]", "effort": "high" } },
      { "id": "gegenprobe", "title": "Second family on an open approach (variant group)", "role": "worker lane, variant", "required": false,
        "spawn": { "harness": "codex", "model": "gpt-5.6-sol", "effort": "high" } },
      { "id": "checkpoint", "title": "Strategic checkpoint and Lagebild commit", "role": "MAIN itself", "required": true,
        "gate": "after every third landed act, a real red audit, a contradicting report, and before handover" }
    ]
  },
  "briefBlocks": [
    { "id": "bt-role", "appliesTo": "main", "text": "<Block bt-role>" },
    { "id": "bt-think-in", "appliesTo": "main", "text": "<Block bt-think-in>" },
    { "id": "bt-lagebild", "appliesTo": "main", "text": "<Block bt-lagebild>" },
    { "id": "bt-execute", "appliesTo": "main", "text": "<Block bt-execute>" },
    { "id": "bt-stop", "appliesTo": "main", "text": "<Block bt-stop>" },
    { "id": "bt-lane", "appliesTo": "lane", "text": "<Block bt-lane>" }
  ],
  "gates": { "criticBeforeTaste": false, "programLint": false, "completeNeedsProof": true }
}
```

Die Spawn-Tripel sind Vorschlaege nach der Owner-Politik vom 2026-09-02 (MAIN und Denkarbeit Fable,
Bau-Lanes Opus 5) und der Owner-Korrektur im HANDOFF-Commit `70972408` (Astra sparsamer, Alternativen
Fable 5.1 und GLM 5.3). GLM steht nicht in den Stages, weil der Tick `pi-zai` nie startet
[uebernommen]. Was die drei `gates`-Schalter heute bewirken, habe ich nicht gelesen [ungeprueft];
`budget`/`stopLine` je Stage sind weggelassen, weil ich keine gemessene Zahl dafuer habe. In
`fleet.json` steht heute kein Studio unter dem Schluessel `studios` und kein Program mit
`studio`-Bindung [gemessen]: der Weg ist gebaut und getestet, aber live unbenutzt.

Zwei Reste, die der Studio-Weg nicht loest und die §5 aufnimmt: der Text steht HINTER den vier
Boot-Schritten, `./register.sh` laeuft also weiter flottenweit; und die Nachfolgerin liest „Lagebild
zuerst" erst im Studio-Block, nach ihrer nummerierten Boot-Liste.

## §3 Die Datenschicht beim Antritt

Masstab: die Schicht beantwortet eine Frage, die JEDE Big-Task-MAIN in der ersten halben Stunde
stellt, und sie existiert, oder ihr Fehlen ist benannt. Klassen wie in der Schwesternotiz: (0) wird
benutzt · (a) existiert, im gelesenen Text nicht genannt · (b) existiert, falsch geschnitten · (c)
existiert nicht.

| # | Antrittsfrage | Schicht und Quelle | Klasse | Warum beim Antritt |
|---|---|---|---|---|
| 1 | Wo steht jede Zeile meines Programs, und welche Tuer gehoert ihr? | `GET /api/self/program-execution` (`server.ts#programExecutionView`: phase, nextAction, lastLand, lastAudit, handover, unknown[]) | 0 | Der Rail nennt sie; 394 Aufrufe in 14 Tagen [uebernommen]. Nichts zu tun. |
| 2 | Was darf ich: landen, starten lassen, wie viele Lanes, welche Freigabe? | `GET /api/self/programs` → eigene Zeile (`server.ts#publicProgram` spreizt `promotion`, `dispatch`, `release`, `profile`, `studio`, `contextPacks`) | a | Entscheidet, ob ein Plan ueberhaupt in ihrer Hand liegt; im Rail nicht genannt [geprueft]. In der Projektion wirkt `promotion` nur mittelbar ueber `nextAction`; `dispatch`/`release` stehen dort nicht als eigenes Feld (Top-Level-Schluessel gelesen; `programStatusView` nicht) [teils ungeprueft]. Steht jetzt in `bt-role`. |
| 3 | Was hat meine Vorgaengerin verstanden und warum so geschnitten? | **keine Schicht.** Handover traegt Pflichten, Carry 500 Zeichen | c | Ohne sie beginnt jede Session der Staffel bei der Erdung. Geschlossen durch das Lagebild (Dokument, `bt-lagebild`). |
| 4 | Was wurde zu meiner Frage schon gemessen? | `docs/messungen/INDEX.md` (174 Zeilen vor dieser Notiz; ganz gelesen ~39,5 k Tokens laut Lesewerkzeug [gemessen]) | b | Ein Volllesen kostet mehr als der Render einer Lane. Der Schnitt ist ein `rg` nach Begriff oder `bereich:`-Tag; steht in `bt-think-in`. Ein Tag-Filter als Werkzeug waere Bau, ist aber mit `rg` erledigt. |
| 5 | Was ist im Fleet sonst offen, das meine Flaeche beruehrt? | `./register.sh` (48 693 B, flottenweit) | b | Der Boot verlangt den Volllauf; die MAIN braucht den Programm-Schnitt (Frage 1) und die Nachbarschaft nur je Flaeche. **Beruehrpunkt Schwesterzeile**: §4.3 „(b) durch Laenge", dort gemessen und nicht gefilet. Hier: §5 P2 schneidet nur den Boot der Big-Task-MAIN, nicht das Skript. |
| 6 | Wie gesund sind Land und Audit gerade? | `./state.sh` Block „land health" (9 636 B gesamt) | 0 | Entscheidet, ob ein rotes Audit ihres ist. **Beruehrpunkt**: P3 `ctl audits` der Schwesternotiz liefert die Zeilen dahinter. |
| 7 | Welcher Executor hat fuer welche Arbeit getragen? | `bun land-quality.ts` (Tabelle harness/model ueber gelandete Lanes, Rework 3d/7d, auditRed; `land-quality.ts#modelKey`) | b | Das ist die Datengrundlage fuer „Lanes mit verschiedenen Modellen". Sie schneidet nach harness/model, nicht nach Groesse oder Arbeitsbereich, und kennt per Definition nur gelandete Lanes [geprueft: die zwei `aggregate`-Aufrufe]. **Beruehrpunkt**: die fehlende Sicht ist der Befund der archivierten Zeile `6067c240` (Schwesternotiz §7); nicht hier gebaut. |
| 8 | Was hat eine bestimmte Lane oder Zeile erlebt? | Lane-Dossier `GET /api/lane?branch=` (`server.ts#laneDossier`, sechs Quellen) | b | Braucht die MAIN beim Review eines Reports. **Beruehrpunkt**: P2 der Schwesternotiz (Adressierung nach Task-ID, `ctl task`). |
| 9 | Welche Tueren habe ich ueberhaupt? | `docs/self-api.md` (3 326 Zeilen), sonst Quelltextsuche | a | 61 Aufrufe Tuerensuche in neun Sessions [uebernommen]. **Beruehrpunkt**: P1 der Schwesternotiz (Tuerenblock in `state.sh`, `ctl get`). Bis dahin nennt §2.2 die fuenf Tueren, die der Rail auslaesst. |
| 10 | Was kosten meine Lanes an Kontext, und was bekamen sie geliefert? | `context-receipts.jsonl` ueber `lane-context-cost.ts`, `briefstats.ts`; Route `/api/context-receipts` ist ein Volldump mit null Agenten-Lesern | b | Erst beim Checkpoint noetig, nicht beim Antritt; darum unter der Linie. |

Lesart: von zehn Fragen sind zwei bedient, zwei sind (a) und mit einem Satz im Gruendungstext
erledigt, fuenf sind (b), und genau eine ist (c). Die (c)-Frage ist dieselbe Luecke wie Phase 4 in §1.
Vier der fuenf (b)-Fragen liegen auf Zeilen der Schwesternotiz (P1–P3, `6067c240`); landen sie,
wird der Gruendungstext kuerzer, nicht laenger. Diese Notiz fuegt der Schichtenkarte der
Schwesternotiz (§3 dort) nichts hinzu und wiederholt keine ihrer Zaehlungen.

**ctxPacks** in dieser Aufsetzung: die Program-Pack-Tuer liefert Zeiger, nie Inhalt (hoechstens 5
Packs, 4 Quellen, beim Schreiben gegen HEAD validiert) [geprueft: `docs/self-api.md`
§program-context-packs]. Anker senken die Erdung nicht messbar, und die Tokenwirkung eines Packs ist
weiter ungemessen [uebernommen: Worktrail IV §2.3, Front-Matter]. Darum traegt der Text die Regel
„Zeiger im Pack, Wissen als `datei#symbol` im Brief", und ctxPacks mit Inhalt bleiben, wo die
Synthese sie hingelegt hat: unter der Linie, am K1-Checkpoint.

## §4 Der Berater-Agent in der normalen Queue

**Urteil: ja, uebertragbar, und zwar heute, ohne Aenderung am Zeilen-Modell. Den beratenden
Zeilenarten einen Motor zu geben, waere der falsche Schnitt.**

Was der Auftrag als Luecke nennt, stimmt am Code: `richtung`, `notiz` und `betrieb` sind „advisory
categories without their own motor (owner decision 2026-08-10)", und jeder Dispatch-Pfad
ueberspringt sie [geprueft: `server/types.ts#Task` Kommentar an `kind`, `server.ts#taskKindNote`,
dazu 25 Stellen `kind !== "auftrag"` in `server.ts`]. Live stehen 34 `notiz` und 11 `richtung` auf `pending`;
je abgeschlossen wurden 2 `notiz` und 1 `betrieb` [gemessen].

Aber „beraten" ist eine ARBEIT, keine Zeilenart. Eine beratende Taetigkeit hat einen Auftraggeber,
eine Frage, ein Ergebnis und einen Rueckweg, und genau das ist ein `auftrag`, dessen DONE eine
getrackte Notiz ist:

- Diese Lane ist der Fall: `kind: auftrag`, ROLLE `claude/claude-fable-5-1[1m]/high`, `NEU:` eine
  Messnotiz, VERIFY `install, pins`, kein Code. Die Schwesterzeile `f5110feb` ebenso; sie steht auf
  `done`, ihr Ergebnis ist als `343cae6b` auf main [gemessen: `fleet.json`, `git log`].
- Das Gate kennt die Form: eine reine Docs-Aenderung schuldet die Kurzkette [geprueft: `AGENTS.md`
  §Verify laut Auftrag, `verify-proportion.ts` nicht gelesen].
- Der Rueckweg existiert: der `fleet-report` geht an die filende MAIN; ohne Program faellt er in die
  Owner-Inbox [geprueft nur an der Abschnittsliste von `docs/self-api.md` §fleet-report B4].
- Die Verbindung Frage → Antwort existiert: `POST /api/self/tasks/:id/notes` haengt eine `notiz` als
  QUELLE an einen `auftrag`, die Lane urteilt mit `taskId`, ein `erledigt` schliesst die Notiz beim
  Land [geprueft: `docs/self-api.md` §notes-assign, §notes; `server.ts#pinNoteToTask`].
- Die Synthese hat dafuer schon eine Klasse (`urteil`: analysieren, reviewen, Kriterium klaeren,
  ohne Bau) [uebernommen: Synthese §2c]; sie ist nicht promoviert.

Warum kein Motor fuer `richtung`/`notiz`:

1. **Er waere das Release-Tor ein zweites Mal.** Eine beratende Zeile darf nicht von selbst starten
   (45 stehen offen), also braeuchte sie eine Freigabe, einen Executor, ein DONE und einen Rueckweg.
   Das sind die Felder eines `auftrag`. `loadTaskKind` begruendet die Richtung selbst: eine Zeile in
   die ausfuehrbare Art fallen zu lassen „would hand the dispatcher a row nobody ever wrote as
   work" [geprueft].
2. **Er wuerde zwei Dinge vermischen, die heute sauber getrennt sind:** eine Beobachtung, die auf
   ihrer Dateiflaeche mitreist und von der naechsten Lane beurteilt wird (der N1–N3-Weg), und eine
   Frage, fuer die jemand Zeit ausgeben soll. Die zweite ist eine Entscheidung ueber Kosten und
   gehoert an die Tuer, an der Kosten entschieden werden.
3. **Dieselbe Aufsetzung traegt trotzdem.** Was aus §2 auf den Berater uebergeht, ist die FORM: eine
   Frage, eine Rueckgabeform, Projektionen vor Quellen, Fundstelle oder „ungeprueft" je Behauptung,
   Schnittlinie. Das ist der Absatz „hire it" in `bt-think-in`. Eine Big-Task-MAIN ist damit auch
   die natuerliche Auftraggeberin von Beratern: ihre Sonden SIND Berater-Zeilen.

Was am Zeilen-Modell fehlt, ist ein einziger Schluss: `pinNoteToTask` nimmt nur `notiz` als Quelle
an („is a richtung, not a notiz", 409) [geprueft]. Eine Richtungsfrage des Owners kann also nicht die
angeheftete Quelle des Denkauftrags sein, der sie beantwortet; wer das will, filet die Frage heute als
`notiz`. Das ist klein, hat einen Umweg und steht deshalb unter der Linie (§5 u1).

## §5 Schnitt

Owner-Vorgabe woertlich: *„Wir muessen den Brief und ueberhaupt die ganze AUfsetzung eines solceh
big-task agenten nur wirklich leicht, gut und sauber+ vernuenftig aufsetzen"*. Erfuellt ist sie, wenn
(i) der Text existiert, (ii) er eine MAIN bei Gruendung UND Nachfolge erreicht, (iii) ein Lauf zeigt,
dass er traegt. (i) ist §2.2, (ii) ist §2.4 ohne Code. Offen ist (iii). Darum beginnt der Schnitt mit
einem Akt, der keine Auftragszeile ist, und die Liste endet nach zwei Zeilen.

**Schritt 0 — Probelauf, kein Auftrag (Owner-/Orchestrator-Akt).** Ein Program mit echtem grossem
Auftrag waehlen; `promotion`, `dispatch`, `release` bewusst setzen; das Studio aus §2.4 anlegen und
binden (`workflow.doc.sha` = sha256 dieser Datei); MAIN auf Fable 5.1 gruenden. Kein Code, nichts
wird live geschaltet, was nicht der Owner selbst POSTet. Abbruch, wenn die MAIN vor dem ersten
Lagebild-Commit Bau-Zeilen freigibt: dann traegt der Text nicht, und P2 entfaellt.

### P1 — Messung des Probelaufs

```card
[BIG-TASK-MAIN · MITTEL · PROBELAUF VERMESSEN: traegt der Gruendungstext, und traegt das Lagebild ueber eine Nachfolge · docs/messungen/2026-09-17-big-task-main-aufsetzung.md §5 P1]
ROLLE: claude/claude-fable-5-1[1m]/high
GROESSE: mittel
NEU: docs/messungen/2026-09-big-task-main-probelauf.md
FLAECHE: docs/messungen/INDEX.md
VERIFY: install, pins
DONE: eine getrackte Messnotiz mit Front-Matter vergleicht die Sessions der Probe-MAIN mit den zwei Program-MAIN-Sessions M1 und M2 der Notiz 2026-09-17-worktrail-bash-datenschichten-strategisch.md nach deren Messdefinition und nennt je Session Kontext beim ersten gefileten auftrag, Anteil symptomatischer Datenaufrufe (Klassen a, b, c), Zahl der Lagebild-Commits und Checkpoints, und fuer jede Nachfolge, ob die Nachfolgerin das Lagebild vor ihrem ersten Schreibakt gelesen hat; das Urteil sagt in einem Satz, ob P2 gefilet werden soll; INDEX-Zeile nachgezogen.
WARUM: Der Text in §2.2 ist ungemessen. Ohne diese Zahlen wird P2 auf Glauben gebaut, und die Rollen-Synthese nennt fuer jeden ihrer Texte denselben Mangel (kein A/B).
NICHT: kein Code, keine Aenderung am Studio-Record, keine Ausgabe fremder Prozess-Kommandozeilen, Transkripte nur aggregiert.
```

Zu filen, sobald die Probe-MAIN mindestens eine Nachfolge hinter sich hat; vorher misst die Zeile
die Haelfte.

### P2 — Der Boot der Big-Task-MAIN, auf ihr Program geschnitten

```card
[BIG-TASK-MAIN · MITTEL · BOOT UND NACHFOLGE EINER STUDIO-GEBUNDENEN MAIN: Lagebild zuerst, Programm-Projektion statt flottenweitem register.sh · docs/messungen/2026-09-17-big-task-main-aufsetzung.md §5 P2]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: server.ts#buildProgramMainBrief, server.ts#buildProgramMainSuccessionBrief, server.ts#RAIL_TAIL, e2e/programs.ts, docs/self-api.md
VERIFY: pins, tsc, build, clean-review, security, claude-gate; isolierte Vorschau, weil e2e/programs.ts beruehrt ist
DONE: ein Program, dessen gebundenes Studio eine Stage mit der id eindenken traegt, bekommt im Fleet-Frame von Gruendungs- und Nachfolgebrief statt Schritt 2 (./register.sh) den Schritt GET /api/self/program-execution und GET /api/self/programs, und der Nachfolgebrief nennt als ersten Schritt das Lesen von docs/programme/<8 Zeichen Program-Id>-lagebild.md, falls die Datei am HEAD getrackt ist, sonst benennt er ihr Fehlen; RAIL_TAIL nennt die Varianten-Form von POST /api/self/tasks und POST /api/self/tasks/<id>/variant-winner in hoechstens sechs Zeilen; docs/self-api.md dokumentiert beide; jedes Program ohne solche Stage bekommt byte-identisch die heutigen Briefe, was e2e/programs.ts fuer alle vier Gruendungsformen haelt, und ein neuer Check deckt gebundenes Studio mit und ohne getracktes Lagebild.
WARUM: Der Studio-Weg stellt den Text ohne Code zu, aber hinter den vier Boot-Schritten: register.sh druckt flottenweit 48.693 Bytes, waehrend die Programm-Projektion die Frage programmscharf beantwortet, und die Nachfolgerin liest Lagebild zuerst erst nach ihrer nummerierten Liste. Die Varianten-Tuer ist gebaut und steht weder im Rail noch in docs/self-api.md.
NICHT: keine neue Profil-Art und keine neue Rolle, kein neues Feld am Program oder am Studio, keine Aenderung am Filing-Format, kein Eingriff in register.sh selbst, keine Aenderung fuer Game-Maker-Programs.
```

Erst zu filen, wenn P1s Urteil es sagt; die Reihenfolge traegt, wer filet, denn `NACH:` kann keine
Zeile nennen, die es noch nicht gibt. Der Ausloeser „Stage mit der id `eindenken`" ist ein
Vorschlag, der ohne neues Feld auskommt; ob ein Stage-id als Schalter dem Studio-Vertrag
widerspricht („the record is owner text, not a machine switch"), habe ich nicht geprueft
[ungeprueft] und gehoert in die Klaerung dieser Zeile.

Beide Karten sind mit `card-extract.ts#parseFormattedCard` und `#validateCard` gegen diesen Baum
geprueft (leerer Symbolindex, Deklarations-Fallback): Ergebnis in §7. Das bescheinigt Form und
Flaeche, nicht Machbarkeit.

— Schnittlinie —

Nicht gefilet, mit Grund:

- **u1 · `richtung` als anheftbare Quelle** (`server.ts#pinNoteToTask`): klein, hat den Umweg „als
  `notiz` filen" (§4).
- **u2 · Executor-Evidenz nach Groesse und Arbeitsbereich** (`land-quality.ts`): die Datengrundlage
  fuer die Modellwahl je Lane und fuer den Varianten-Entscheid; gehoert zur Linie der archivierten
  Zeile `6067c240`, ob ein Ersatz lebt, ist ungeprueft.
- **u3 · ctxPacks mit Inhalt**: ungemessen, K1-Checkpoint (Synthese §3, unter der Linie).
- **u4 · Motor fuer beratende Zeilen**: abgelehnt (§4).
- **u5 · Aenderungs-Tuer fuer den Program-Inhalt**: abgelehnt. Der Inhalt ist Owner-Wahrheit; ein
  Dokument mit einem Schreiber traegt das Verstaendnis, ohne sie beschreibbar zu machen.
- **u6 · eigene Profil-Art `big-task` mit drittem Rollenabsatz** (`RAIL_ROLE_*`): der naheliegende
  Bau, hier verworfen, weil das Studio dieselbe Zustellung ohne Code leistet und der Text dem
  Standard-Rollenabsatz nicht widerspricht, ihn also nicht ERSETZEN muss. Erst wenn der Probelauf
  zeigt, dass der Standardabsatz stoert, waere das der Schnitt.
- **P1–P3 der Schwesternotiz** (Tueren, Auftrags-Dossier, `ctl audits`): bleiben ihre Zeilen. Sie
  sind fuer die Big-Task-MAIN wertvoller als alles in dieser Liste unterhalb von Schritt 0.

## §6 Was nicht geprueft wurde

- Die Startlast einer Program-MAIN in Tokens. Gemessen sind Zeichen und Bytes; die Prozentwerte in
  §1 sind gerechnet (§7) und koennen um einige Punkte daneben liegen.
- Ob die vier Programs mit MAIN-Bindung (`f170dc46`, `9ce08219`, `f9dc8e10`, `247a3746`) eine lebende
  Session haben. Der Auftrag nennt drei laufende; ich habe nur die Bindung gelesen.
- Die Wirkung jedes Satzes in §2.2. Kein Lauf, kein A/B; die zwei Schwellen (20 %, jede dritte
  Landung) sind Setzwerte.
- `programStatusView`, die Bedeutung der drei Studio-`gates`, die `isGameMaker`-Stellen (14 Treffer
  von `isGameMaker(` inklusive Definition), `verify-proportion.ts`, der Client.
- Ob eine MAIN eine beratende Zeile selbst in einen `auftrag` ueberfuehren kann. Die `/kind`-Route
  steht im Owner-Block von `server.ts`, nicht unter `/api/self`; eine Self-Entsprechung habe ich
  nicht gesucht.
- Fremd-Harness-MAINs. Der Text nennt Selbst-Kompaktierung in einem Satz; ob eine codex-MAIN den
  Studio-Block bekommt wie eine claude-MAIN, folgt aus der gemeinsamen Naht, ist aber nicht
  ausprobiert.
- Alles, was die Schwesternotiz als ungemessen fuehrt, gilt hier weiter.

## §7 Methode

Lesen wie im Kopf genannt; Symbole ueber `rg -a -n` (in `server.ts` steht ein NUL-Byte, ohne `-a`
bricht `rg` nach dem ersten Treffer ab). Messungen, wiederholbar:

```sh
# Boot-Ausgaben (aus der Lane, beide Skripte sind lesend)
./state.sh | wc -c -l        # 108 Zeilen, 9 636 B
./register.sh | wc -c -l     # 478 Zeilen, 48 693 B
# Rail der Standard-MAIN: RAIL_HEAD + RAIL_ROLE_STANDARD + RAIL_TAIL als Quelltextzeilen
sed -n '25456,25469p;25472,25483p;25589,25645p' server.ts | wc -c    # 6 319 B (Baum 5518a259)
# Render, lesend im Haupt-Checkout (rulebook/ ist untracked und liegt nur dort)
bun -e 'import{RULEBOOK_FRAGMENTS as F,RULEBOOK_DIR as d,fragmentFileName as n,renderRulebook as r}from"./rulebook";
import{readFileSync as R}from"node:fs";const m=new Map(F.map(f=>[f,R(d+"/"+n(f),"utf8")]));
for(const k of["main","lane"])console.log(k,r(k,m).length)'          # main 75718 · lane 19986
# Live-Zustand, nur als Projektion ohne Token-Felder (python3, json.load auf fleet.json):
#   Zeile f5110feb, Counter ueber (kind, status), Programs mit main-Bindung, Variantengruppen, studios
```

**Abgeleitete Startlast einer claude-MAIN.** Lane-Render 2026-09-13: 35 666 Zeichen = 18 335 Tokens,
also 1,945 Zeichen je Token (Fixkosten-Note, Synthese §1). MAIN-Render 75 718 Zeichen ≈ 38,9 k
Tokens. Dazu fester Praefix 32 467, Skill-Listing 6 618, globale CLAUDE.md/MEMORY.md/Agent-Listing
~8 k (alle aus der Fixkosten-Note, an EINER Lane gemessen) und der Rail ≈ 3 k: rund 89 k Tokens ≈
9 % von 1M. Die Boot-Ausgaben (58 329 B) bei 2–4 Bytes je Token ≈ 15–29 k: nach dem Boot 10–12 %.
Der Setzwert „about 20 %" fuer das Ende des Eindenkens laesst damit rund 80–100 k Tokens fuer das
Problem und haelt 5–10 Punkte Abstand zum Band.

**Validierung der zwei Karten und des Studio-Records** (Skript im Scratchpad dieser Lane, kein
Archiv): die ```` ```card ````-Bloecke dieser Datei durch `parseFormattedCard` und `validateCard`
(`trackedPaths` aus `git ls-files`, `symbolIndex: null`, Deklarations-Fallback per Regex auf die
Datei); die sechs ```` ```text bt-* ````-Bloecke in das JSON aus §2.4 eingesetzt, `sha` durch 64
Hex-Nullen ersetzt, durch `server/types.ts#studioContentFrom`. Ergebnis:

```
card P1  valid=true surfaceValid=true gaps=[]  files=docs/messungen/INDEX.md
card P2  valid=true surfaceValid=true gaps=[]  files=docs/self-api.md,e2e/programs.ts,server.ts
block bt-role 1437 · bt-think-in 2274 · bt-lagebild 2402 · bt-execute 2067 · bt-stop 1333 · bt-lane 562 Zeichen
studioContentFrom: ok, 6 blocks, 5 stages
```

Mit `symbolIndex: null` prueft der Validator ein Symbol nur auf die Existenz seiner Datei; die drei
Symbole aus P2 (`buildProgramMainBrief`, `buildProgramMainSuccessionBrief`, `RAIL_TAIL`) habe ich per
`rg` selbst in `server.ts` aufgeloest. Die fuenf MAIN-Bloecke messen zusammen 9 513 Zeichen: das
1,5-Fache des Rails und ein Achtel des MAIN-Renders. Der Text ist also nicht gratis; er ersetzt
aber keinen Satz, den die MAIN schon liest, und jeder Block haengt an einer Luecke aus §1 oder §3.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-17T08:0xZ	erdung	Synthese, Worktrail IV, Schwesternotiz und AGENTS-Kern ganz gelesen, server.ts nur ueber Symbole	Auftrag: beurteilen, nicht neu entdecken	belege im Front-Matter	vier Phasen klassifizierbar
2026-09-17T08:0xZ	phase-4	Aenderbarkeit des Program-Inhalts am Code geprueft statt angenommen	davon haengt ab, ob Phase 4 "fehlt" oder nur "unbekannt" ist	rg validateProgramContent( = 4 Aufrufer; confirm-Route 409 bei active	fehlt
2026-09-17T08:1xZ	zustellung	Profil-Art big-task als erster Entwurf verworfen	Studio-Briefbloecke sitzen in railBlockFor und damit in beiden MAIN-Buildern und im Lane-Dispatch	server.ts#railBlockFor, #studioBlockFor	Zustellung ohne Code
2026-09-17T08:1xZ	berater	Motor fuer richtung/notiz verworfen	er braeuchte Freigabe, Executor, DONE und Rueckweg, also die Felder eines auftrag; diese Lane ist der laufende Gegenbeweis	server/types.ts#Task kind-Kommentar, fleet.json f5110feb done	auftrag mit Notiz als DONE
2026-09-17T08:1xZ	schnitt	Liste nach zwei Zeilen abgeschnitten, Probelauf als Nicht-Zeile davor	Vorgabe verlangt leichte Aufsetzung; (i) und (ii) sind ohne Bau erfuellt, (iii) ist ein Lauf	§5	2 Zeilen, 6 unter der Linie
```
