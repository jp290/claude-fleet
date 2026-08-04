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

## Verworfen, mit Grund (nicht neu vorschlagen)

- **Den Autor OHNE git-Verifikation glauben.** Die Prüfung bei `:4672` ist gegen einen lügenden
  Agenten gebaut; ein müder Mensch in einer Pane ist derselbe Fall.
- **Beim Konflikt automatisch beide Wege fahren** (Wegwerf-Agent UND Autor wecken). Zwei
  Schreiber auf einem Worktree ist genau die Klasse, aus der `.git/index.lock`-Wedges kommen
  (`server.ts:4195-4200`, gemessen: 16 gescheiterte Aborts / 15 verkeilte Bäume pro 60 Runden).
- **Den Rebase kontinuierlich per Tick unter der laufenden Session fahren.** Das wäre „③ vor
  ②": es bewegt den Boden unter einem arbeitenden Agenten. ① (Drift-Surface) ist bewusst die
  advisory Variante davon, und `/api/self/drift` existiert genau dafür.

## Die blockierende Owner-Frage

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
