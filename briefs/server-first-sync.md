# Lane-Brief ② — Server-first Sync: der Autor löst seinen eigenen Konflikt

*Abgeleitet 2026-08-05 aus dem Code, nicht aus dem Handoff. Zahlen unten sind an diesem Tag
aus `lane-outcomes.jsonl` neu gerechnet, nicht übernommen.*

## Zuerst: ② ist enger als sein Name

Der Programmsatz aus Session 22 lautet „der Server fährt den Script-Rebase in der Lane
(tryScriptRebase-Muster), nur bei Konflikt wird die Lane-Session geweckt". Beim Lesen des Codes
zerfällt das in zwei Lesarten, und **nur eine davon ist offene Arbeit**:

- **Lesart A (schon gebaut, nichts zu tun):** „der Server fährt den Rebase selbst statt einen
  Agenten dafür zu bezahlen". Das ist `tryScriptRebase` (`server.ts:4203`), seit Langem der
  erste Schritt jedes ⏫. Konfliktfrei → `{clean:true}`, der Agent wird **nie** gespawnt
  (`mergeJob`, `server.ts:4662`). Diese Hälfte existiert.
- **Lesart B (die eigentliche Scheibe):** **wer den Konflikt löst.** Heute: `runMerge`
  (`server.ts:4227`) spawnt einen Wegwerf-Worker (`MERGE_CMD`, `MERGE_TOOLS`) mit einem
  gebauten Prompt aus zwei git-Logs — ein Agent ohne jede Kenntnis davon, WARUM die Lane die
  Zeilen so geschrieben hat. Nach ②: die Lane-Session, die den Code geschrieben hat, wird
  geweckt und löst mit ihrem Kontext.

Der Rest dieses Briefs ist Lesart B.

## Messung (selbst gerechnet, 2026-08-05, `lane-outcomes.jsonl`)

    rows 83 | landed 67 | killed-empty 9 | killed-dirty 5 | shelved 2
    Lands, die ≥1 fremdes Land in ihrer Lebenszeit sahen:   42 / 67
    resolvedConflict jemals true:                            4 / 83
    repairRounds:                                            0 in ALLEN 83 Rows
    confirmedByHuman bei Lands:                              8 / 67

Was die Zahlen sagen — und was sie ②s Nutzen KOSTEN, ehrlich zuerst:

1. **Drift ist häufig (42/67), Konflikt ist selten (4/83).** ② adressiert den seltenen Pfad.
   Wer ② mit „Integration ist ein Ereignis statt ein Prozess" begründet, begründet es falsch:
   der Prozess-Teil ist ①/⑦, ② ist Qualität der Auflösung im Einzelfall.
2. **Der Repair-Loop hat nie gefeuert** (`MERGE_REPAIR_ROUNDS`, `server.ts:4697`). Ein zweiter
   Mechanismus, der auf denselben seltenen Pfad wartet. ② würde ihn strukturell ersetzen: der
   Autor, der den Konflikt löst, verifiziert selbst.
3. **59 von 67 Lands hat nie ein Mensch bestätigt.** Der Review-Stop ist also nicht die Norm,
   sondern die Ausnahme — was ihn beim seltenen Konflikt umso teurer macht, wenn er auf einer
   kontextlosen Auflösung sitzt.

**Konsequenz für die Priorisierung, die der Owner hören muss, bevor er ② baut:** ②s Wirkung ist
4 Ereignisse in 83 Lanes. Es ist eine Qualitäts-, keine Durchsatzscheibe.

## Der Mechanismus

Heute (`mergeJob`, `server.ts:4614-4735`), synchron innerhalb eines ⏫:

    tryScriptRebase → clean?  ──ja──→ verify → auto-land
                       └─nein─→ runMerge (Wegwerf-Agent, await) → git verifiziert die Behauptung
                                 → resolved-Verdict, STOPP für Review

Nach ②, asynchron:

    tryScriptRebase → clean?  ──ja──→ unverändert (verify → auto-land)
                       └─nein─→ Konfliktfläche + main-Log in die LANE-PANE senden,
                                 Verdict `awaiting-author` schreiben, Job beenden.
                                 Der Autor löst, committet, drückt ⏫ erneut.
                                 Der zweite Lauf sieht `pre.clean` und läuft den Normalweg —
                                 aber mit `carried`, also STOPP für Review statt auto-land.

Drei Dinge, die dabei nicht verhandelbar sind (alle drei sind heute schon so und dürfen nicht
kippen):

- **git ist die Autorität, nie die Behauptung der Session.** `server.ts:4672-4677` prüft Tree
  sauber + main ist Vorfahr. Der Autor bekommt keinen Vertrauensvorschuss, den der Wegwerf-Agent
  nicht hatte.
- **Der Konfliktpfad landet nie unbeaufsichtigt.** `unreviewed` (`server.ts:4648`) trägt die
  Auflösung über den Re-Run hinweg, gerade weil der ⏸-Guard lapst, sobald main sich bewegt.
  Eine vom Autor gelöste Kollision ist genauso „ungesehene semantische Wahl" wie eine vom
  Wegwerf-Agenten gelöste — `carried` muss also auch für sie gesetzt werden.
- **`tryScriptRebase` bleibt der erste Schritt**, inklusive `rerere.enabled=false` (:4207) und
  der `halted`-Unterscheidung (:4215-4223). Das ist die Antwort auf die FIX1-Flake und darf
  nicht als „macht jetzt der Autor" wegfallen.

## Was ② an der bestehenden Spec UMSCHREIBT (nicht erweitert)

`e2e/merge.ts` (478 Zeilen) nagelt den Wegwerf-Resolver als Kontrakt fest. Diese Checks ändern
ihre Bedeutung oder verschwinden — sie sind der eigentliche Preis der Scheibe:

- `:29` „conflict → agent 'blocked' verdict passes through with detail"
- `:41` „merge re-verifies the rebase claim — lying agent → error, lane kept"
- `:48` „agent resolves the conflict → PAUSES for review"
- `:54` „V1: resolved verdict carries verify.ok:true against the rebased tree"
- `:140` „off-contract agent answer over a git-verified rebase → resolved"
- `:220-251` die ganze `carried`/Fall-Through-Familie
- dazu der Repair-Loop-Block (`:4686-4717` in server.ts) samt seiner Checks

**Das ist der Grund, warum dieser Brief existiert statt eines Commits:** eine Suite, die die
heutige Zusage beweist, kann nicht nebenbei umgeschrieben werden. Wer ② baut, schreibt zuerst
auf, welche dieser Zusagen bewusst fallen — und lässt den Owner das gegenzeichnen.

## C ist gebaut — was dabei bewusst gefallen ist (2026-08-05, gegenzuzeichnen)

Der Abschnitt oben verlangt, dass wer ② baut ZUERST aufschreibt, welche Zusagen fallen. Hier
ist die Liste, und zuerst die Messung, die sie kleiner macht als der Brief erwartet hat.

**Die Messung, die alles verschiebt:** `e2e-isolated.sh` startet den Server mit `FLEET_CMD=true`
(`e2e-isolated.sh:295`). Die Lane-Panes der Suite laufen also *kein* claude. Der Autor-Pfad fragt
`claudeAliveAt(sess(id))` — die UN-gewaiverte Sonde — und die antwortet dort `false`. Ergebnis:
in der Suite feuert weiterhin der Fallback, und **keine einzige der sieben genannten
Check-Familien musste umgeschrieben werden**. Sie sind nicht angefasst worden.

Warum die strenge Sonde und nicht `claudeAlive`: `claudeAlive` gibt für ein fremdes `FLEET_CMD`
bedingungslos `true` zurück (`server.ts:1469`, „custom commands are intentionally whatever the
operator chose"). Dieser Waiver ist richtig für einen vom Owner geschriebenen Auto-Prompt und
falsch hier: der Autor-Pfad pastet einen vom SERVER verfassten Prosa-Brief in die Pane, und eine
Pane ohne claude führt Prosa als Shell-Kommandos aus — exakt die Gefahr, die der Kommentar über
`claudeAlive` selbst beschreibt (`server.ts:1463-1467`).

**Was trotzdem fällt — als Zusage, nicht als Check:**

1. **„Ein Konflikt geht an den Wegwerf-Resolver."** Fällt. Neu: Autor zuerst, Agent als Fallback.
   Die Checks `e2e/merge.ts:29/41/48/54/140` bestehen unverändert weiter, aber ihr Text („agent
   …") beschreibt ab jetzt den FALLBACK, nicht mehr den einzigen Weg. Der Preis ist keine rote
   Suite, sondern eine Suite, deren Wortlaut ohne diesen Absatz mehr verspricht als der Code hält.
2. **Der Repair-Loop deckt nur noch den Agenten-Pfad.** `MERGE_REPAIR_ROUNDS` hängt an
   `!pre.clean`; die vom Autor gelöste Auflösung kommt im ZWEITEN ⏫-Lauf als `carried` an, und
   der ist per Definition `pre.clean`. Ein rotes Verify sieht der Owner dort trotzdem —
   `runVerify` läuft auf beiden Pfaden (`server.ts:4774`) —, es wird nur nicht automatisch
   repariert. Das ist die im Brief vorhergesagte strukturelle Ersetzung („der Autor, der löst,
   verifiziert selbst"), hier als Konsequenz benannt statt als Nebeneffekt.
3. **`carried` heißt nicht mehr „agent-gewählt".** Die Fall-Through-Familie (`:220-251`) prüft
   mechanisch dasselbe, trägt aber jetzt beide Urheber; deshalb reist `resolvedBy` mit dem
   `carried`-Satz mit, sonst wäre die Herkunft nach dem zweiten Lauf verloren.
4. **Ein neuer Verdict-Status `awaiting-author`.** Jede Stelle, die MergeLast-Status aufzählt,
   muss ihn führen (Boot-Restore `server.ts`, `src/client.ts`). Er ist bewusst KEIN
   `needsMergeReview`: es liegt noch nichts zum Ansehen im Baum.

**Was ausdrücklich NICHT fällt** (die drei Unverhandelbaren, je an ihrer Zeile geprüft):

- git bleibt die Autorität: der zweite Lauf geht durch exakt dieselbe Prüfung „Tree sauber UND
  main ist Vorfahr" (`server.ts:4761-4766`). Der Autor bekommt keinen Vertrauensvorschuss.
- Der Konfliktpfad landet nie unbeaufsichtigt: im zweiten Lauf ist `unreviewed = carried`
  nicht-leer, also endet er zwingend im `resolved`-Stopp — der Auto-Land-Zweig ist unerreichbar.
- `tryScriptRebase` bleibt Schritt eins samt `rerere.enabled=false` und der `halted`-
  Unterscheidung; der Autor-Zweig sitzt strikt dahinter.

**Was keine Suite beweisen kann und offen bleibt:** dass ein ECHTES claude den Brief liest und
eine gute Auflösung produziert. Das ist dieselbe Grenze, die `buildMergePrompt` seit jeher hat.
Beweisbar gemacht ist alles davor und danach — die Zustellung, das Verdict, die Kette
`awaiting-author` → `carried` → `resolvedBy:"author"` auf der Outcome-Row.

## Verworfen, mit Grund (nicht neu vorschlagen)

- **Den Autor OHNE git-Verifikation glauben.** Die Prüfung bei `:4672` ist gegen einen lügenden
  Agenten gebaut; ein müder Mensch in einer Pane ist derselbe Fall.
- **Beim Konflikt automatisch beide Wege fahren** (Wegwerf-Agent UND Autor wecken). Zwei
  Schreiber auf einem Worktree ist genau die Klasse, aus der `.git/index.lock`-Wedges kommen
  (`server.ts:4195-4200`, gemessen: 16 gescheiterte Aborts / 15 verkeilte Bäume pro 60 Runden).
- **Den Rebase kontinuierlich per Tick unter der laufenden Session fahren.** Das wäre „③ vor
  ②": es bewegt den Boden unter einem arbeitenden Agenten. ① (Drift-Surface) ist bewusst die
  advisory Variante davon, und `/api/self/drift` existiert genau dafür.

## ENTSCHIEDEN (Owner, 2026-08-05) — und die Zahl, die dahinter steht

Die Frage unten ist beantwortet: **Form 1 — Autor zuerst, Wegwerf-Agent als Fallback.** Dazu
zwei Auflagen, die aus der Messung folgen, nicht aus Geschmack.

**Wie oft der Fallback überhaupt gebraucht wird (gemessen 2026-08-05):**

| Faktor | Messung |
|---|---|
| Lane trifft einen Konflikt | 4 / 83 ≈ **4,8 %** |
| Autor-Pane stirbt | 484 Heals auf 279 Slot-Öffnungen — häufig |
| …davon MIT Kontext zurückgeholt (`resumed`) | **184** — die Selbstheilung trägt |
| …davon OHNE Kontext (`created:no-transcript`) | 32, an **2 von 15 Tagen**, 26 am Crash-Tag |
| **Konflikt UND kontextloser Autor** | **0 mal in 83 Lanes**; gerechnet ≈ 0,3 % ≈ 1 von 300 |

Zwei Einschränkungen, sonst ist die Zahl gelogen: n=4 Konflikte, daraus ist nichts Bedingtes
messbar (zwei Randverteilungen multipliziert); und sie sind vermutlich **positiv korreliert** —
die vier Konflikte saßen auf Lanes mit 3,2 h / 10,5 h / 12,2 h gegen 1,1 h Median. 0,3 % ist
eine Untergrenze. „Busy statt tot" ist gar nicht gemessen.

**Warum der Fallback trotzdem billig ist:** „ein Zweig, der nie feuert, verrottet" gilt hier
NICHT automatisch — der Repair-Loop hat in 83 Rows nie gefeuert und ist trotzdem von sechs
Checks abgedeckt (`e2e/land-provenance.ts:342-350`, `e2e/outcomes.ts:137-143`,
`e2e/prompts.ts:149-160`). Die Suite hält ihn ehrlich. Dasselbe gilt für den Agent-Fallback.

**Auflage 1 — Provenienz, sonst wird der Fallback still zum Normalfall.** Verdict und
Outcome-Row bekommen `resolvedBy: "agent" | "author"`. Ohne dieses Feld ist in drei Monaten
nicht feststellbar, welcher Pfad die Auflösungen produziert hat — und genau diese Zahl
entscheidet, ob Form 2 („nur Autor") je sicher wird.

**Auflage 2 — der Resolver bekommt graphify.** Owner-Vorgabe: *„der agent sollte sich dann
einfach das projekt angucken + git & graphify"*. Korrektur an meiner eigenen Wortwahl weiter
oben: „kontextlos" war zu grob. `MERGE_TOOLS` (`server.ts:3345`) gibt dem Resolver Projekt UND
git längst — `Read/Grep/Glob(**)`, `Edit/Write(**)`, sieben git-Subkommandos. Was fehlt, ist
graphify. Vier Messungen dazu (2026-08-05), jede eine Falle, die den naiven Weg gekillt hätte:

1. **`graphify-out/` ist gitignored** → ein frischer Lane-Worktree hat KEINEN Graphen.
2. **Ein nacktes `graphify .` scheitert** in einer Lane: 108 Doc-Dateien verlangen einen
   LLM-Key (exit 1). Der lokale Pfad ist `graphify . --code-only`.
3. **`graphify . --code-only` kostet 5,69 s** auf dem getrackten Baum (1158 Knoten /
   2938 Kanten, kein Key, kein Netz).
4. **Die Abfrage-Verben laufen auf diesem Graphen ohne Cluster-Schritt** — `explain`,
   `affected`, `query` alle geprüft; Communities sind nur unbenannt (kosmetisch).

Daraus die Bauform: **den Graphen baut der SERVER**, nicht der Agent — und nur auf dem
Konfliktpfad, direkt vor dem Spawn, damit der Normalfall (79/83 Lanes, clean) nichts zahlt.
Der Agent bekommt **nur die Lese-Verben** (`query`/`explain`/`affected`/`path`), nie das
Bau-Verb: dessen Argument ist ein PFAD, ein blankes `Bash(graphify:*)` wäre also eine
unverankerte Leseberechtigung auf die ganze Maschine — exakt die Klasse, die der
`Read(**)`-Canary 2026-07-25 nachgewiesen hat. Fail-closed: schlägt der Bau fehl, nennt der
Prompt graphify gar nicht erst, statt dem Agenten ein Werkzeug zu versprechen, das fehlt.

## Reihenfolge (klein zuerst, jede Scheibe einzeln landbar)

- **A — Resolver bekommt graphify.** Kein Kontrollfluss-Wechsel, nützt SOFORT dem heutigen
  Wegwerf-Resolver und später dem Fallback. Risiko niedrig.
- **B — `resolvedBy` (Auflage 1).** Additives Feld, eigene Checks. Muss VOR C stehen, sonst
  ist C vom ersten Tag an nicht auswertbar.
- **C — ② selbst:** Autor wecken (Alive- + Idle-Gate, Selbstheilung mit `--resume`), Verdict
  `awaiting-author`, Agent als Fallback. Der zweite ⏫-Lauf trifft den bestehenden
  `carried`-Pfad und stoppt fürs Review — die Zusage „Konfliktpfad landet nie unbeaufsichtigt"
  bleibt damit unverändert.

## Die (beantwortete) Owner-Frage

**Was soll ⏫ zurückgeben, wenn die Lane-Session tot oder beschäftigt ist?**

Der Wegwerf-Agent hat eine Eigenschaft, die der Autor nicht hat: er ist immer da. Eine geweckte
Pane kann tot sein (`claude` beendet), mitten in einer anderen Aufgabe stecken, oder nie
antworten. Drei Formen, und sie ergeben verschiedene Systeme:

1. **Autor zuerst, Wegwerf-Agent als Fallback** — höchste Verfügbarkeit, aber zwei Resolver-Pfade
   dauerhaft im Code, und der Fallback wird zum Normalfall, sobald Panes recycelt werden.
2. **Nur Autor; keine lebende Session → ⏫ scheitert mit „resolve it in the session"** — eine
   Zusage, ein Pfad, und die Konflikt-Auflösung wird ausdrücklich Menschensache. Kostet
   Verfügbarkeit genau dann, wenn die Lane schon fertig und die Pane abgeräumt ist.
3. **Autor wecken, aber Wegwerf-Agent nach Timeout** — klingt nach dem Beste-aus-beidem und ist
   das schlechteste: der Timeout entscheidet dann, wer die semantische Wahl trifft, und das ist
   nicht reproduzierbar.

Ohne diese Entscheidung ist ② nicht baubar — sie bestimmt, ob `runMerge` bleibt oder geht, und
damit, wie viel von `e2e/merge.ts` überlebt.
