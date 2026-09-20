# Vom Entwurf zum Bau — die Kette, die am 2026-09-20 gefehlt hat

Eine Entwurfsrunde ist billig und fühlt sich produktiv an: Varianten, Messung, Empfehlung,
elf Commits. Der Owner sieht danach **nichts**, weil nichts gebaut wurde. Das ist kein
Lane-Fehler — die Lane hat genau geliefert, was ihre Zeile verlangte. Es ist eine fehlende
Stufe: zwischen ENTWURF und BAU steht ein Schritt, den niemand besitzt, und deshalb tut ihn
niemand.

**Der bezahlte Fall (2026-09-20).** Die Leisten-Lane landete 13 Commits (11 davon inhaltlich,
2 Übergabe-Chores), **2999 Zeilen, ausschließlich unter `docs/`** — nachmessbar:

```sh
git diff --shortstat 9d3b022a^ 95210bce      # 15 files changed, 2999 insertions(+)
git diff --name-only 9d3b022a^ 95210bce | grep -v '^docs/'   # leer
```

Neun Commits Leisten-Varianten (`9d3b022a` … `3f2f9808`), vier Commits Session-Marke
(`035d325b` … `95210bce`). Eine Bau-Zeile hat nie existiert. Der Owner wörtlich: *„solche
prozesse muessen auch standardisiert werden"*.

## 1. Die Kette, Stufe für Stufe

Fünf Stufen, in dieser Reihenfolge. Jede nennt ihren Fahrer, ihr Fertig-Merkmal und ihr Verbot.

### ENTWURFSRUNDE

- **Wer fährt sie:** eine Lane (oder mehrere auf dieselbe Frage — `schwarm-praxis.md`).
- **Was sie produziert:** Varianten, eine Messung, **eine Empfehlung mit Begründung**. Nur
  `docs/` (eine Messnotiz unter `docs/messungen/`, ein Mockup, eine Variantenliste).
- **Fertig, wenn:** die Empfehlung als Satz dasteht und die verworfenen Varianten mit GRUND
  verworfen sind. Eine Variantenliste ohne Empfehlung ist ein Portfolio, kein Entwurf — das
  ist derselbe Schnitt, den `scope-inflation.md` §7 für Ranglisten verlangt.
- **Was NICHT passieren darf:** Code. Eine Entwurfs-Lane, die nebenbei baut, hat weder Entwurf
  noch Bau verifiziert.

### ENTSCHEIDUNG

- **Wer fährt sie:** der Owner — oder, wo er das delegiert hat, die abnehmende Instanz
  (Orchestratorin / Program-MAIN). Eine Lane entscheidet nie über ihren eigenen Entwurf.
- **Fertig, wenn:** die Wahl **wörtlich zitiert** in der Notiz steht, die die Varianten trägt.
  Nicht paraphrasiert: der Satz, mit dem sie gefallen ist. Was verworfen wurde, wird im selben
  Commit als Regel geschrieben, damit die nächste Runde es nicht neu vorschlägt.
- **Was NICHT passieren darf:** eine Entscheidung, die nur im Pane-Transcript steht. Ein
  Transcript ist kein Register — dieses Repo liest Befunde aus Commit-Bodies und `docs/`.

### BAU-ZEILE

- **Wer schreibt sie:** **wer den Entwurf abnimmt — nicht die Lane, die geht.** Die Lane kann
  es strukturell nicht sauber: sie schließt, ihr Worktree stirbt, und ihre eigenen Shas
  existieren nach einem Rebase-Land nicht mehr.
- **Fertig, wenn:** die Zeile in der Queue STEHT (`./register.sh`, `GET /api/tasks`) — mit
  Fläche, Done-Kriterium und VERIFY, wie jede andere `auftrag`-Zeile. Sie zitiert die
  Entwurfsnotiz per Pfad.
- **Was NICHT passieren darf:** die Entwurfs-Lane wird geschlossen, bevor die Zeile existiert.
  Das ist die harte Regel in §2.

### LAND

- **Wer fährt es:** die Program-MAIN für eine Zeile ihres eigenen Programs
  (`server.ts#selfLandTaskForMain`, nur unter owner-gewährter `promotion.selfLand`), sonst der
  Owner über `POST /api/slots/:n/merge`.
- **Fertig, wenn:** die Verify-Kette grün ist und der Land-Gate sie gefahren hat
  (`AGENTS.md` §Verify). Docs-only heißt kurze Kette, nicht keine Kette.
- **Was NICHT passieren darf:** ein Land als Ersatz für die Entscheidung. Gelandeter Entwurf
  ist immer noch kein Bau — genau das war der 2026-09-20-Fall.

### DEPLOY

- **Wer fährt ihn:** Owner oder Orchestratorin (`POST /api/deploy`, Prinzipal `owner` bzw.
  `steward` — `server.ts#deployVerb`).
- **Fertig, wenn:** der nächste Boot das Verdikt geschrieben hat. Der Deploy-Marker wird von
  der startenden Instanz aufgelöst, nicht von der, die ihn gesetzt hat.
- **Was NICHT passieren darf:** „gelandet" als „live" melden. Zwischen Land und Deploy sieht
  der Owner die Änderung nicht.

## 2. Die harte Regel

> **Eine Entwurfs-Lane, die nur `docs/` landet, wird NICHT geschlossen, bevor ihre Bau-Zeile in
> der Queue steht. Wer den Entwurf abnimmt, schreibt die Bau-Zeile — nicht die Lane, die geht.**

„Nur `docs/` gelandet" ist mechanisch prüfbar und braucht kein Urteil:

```sh
git diff --name-only <fork-point> <lane-tip> | grep -v '^docs/' || echo "docs-only"
```

Zwei Ausnahmen, benannt, damit sie nicht stillschweigend wachsen: eine Zeile, deren Auftrag
selbst das Dokument IST (Messnotiz, Regelwerk, Index-Pflege), und eine Entwurfsrunde, deren
Entscheidung „nicht bauen" lautet — dann ist die Verwerfung die geschriebene Regel und tritt
an die Stelle der Bau-Zeile.

## 3. Zwei Löcher, heute bezahlt — eine Lane ohne Queue-Zeile ist halb unsichtbar

Die Regel aus §2 hat eine Voraussetzung, die dieses System heute nur teilweise trägt: **eine
Lane, die aus keiner Queue-Zeile entstanden ist, hat zwei Türen weniger als eine, die es tut.**
Beide Löcher sind am 2026-09-20 bezahlt worden.

### 3a. Ohne Zeile kein Report-Empfänger — und damit keine Nachfolge

`POST /api/self/fleet-report` löst den Empfänger in drei Stufen auf: Program-Bindung, dann
Lane-Watch-Evidenz (`server.ts#clarificationReceiverFor`), dann der Owner-Inbox-Rückfall. Der
Rückfall ist **absichtlich schmal** und verlangt eine `taskId`:

```ts
// server.ts, fleet-report handler
if (reason !== NO_RECEIVER_EVIDENCE || s.programId || !s.taskId)
  return json({ error: reason }, 409);
```

Der Kommentar daneben sagt warum: *„a lane with no task at all keeps its 409: nothing
dispatched it, so nothing is owed a terminal result, and there would be no taskId for the owner
to join the row against."* Das ist als Entscheidung richtig — nur trifft es inzwischen auch
Lanes, die von Hand als Entwurfsrunde gegründet wurden.

Die Folge ist nicht nur ein fehlender Report. `server.ts#succeedLane` verlangt als Ticket den
eigenen `handoff`-Report:

```ts
if (!newest || newest.status !== "handoff")
  return json({ error: "… file the handoff report … before handing the baton over" }, 409);
```

Kein Report ⇒ keine Nachfolge. **Zweimal blockiert am 2026-09-20.** Eine Lane mit vollem
Kontext und ohne Zeile kann den Staffelstab strukturell nicht weitergeben.

**Der heutige Ausweg:** die abnehmende Session setzt einen Lane-Watch auf den Slot
(`POST /api/self/watch`, MAIN-Tür — eine Lane bekommt dort 409). Damit greift die
`lane-watch`-Evidenz und der Report hat einen Empfänger. Das ist ein HANDGRIFF, kein Mechanismus:
er muss gesetzt sein, BEVOR die Lane filen will, und niemand erinnert daran.

### 3b. Ohne Zeile kann die Program-MAIN nicht landen

`selfLandTaskForMain(s, id)` ist auf eine **Task-ID** verdrahtet: Schritt (2) schlägt die Zeile
nach (`unknown task`, 404), Schritt (3) verlangt `t.programId === program.id` — *„a row of
another Program is not this MAIN's to land, and an unbracketed row is nobody's — for those the
owner's board stays the only door."* Eine Lane ohne Zeile hat keinen Namen, den diese Tür
akzeptiert.

Die Owner-Tür dagegen ist auf den **Slot** verdrahtet: `POST /api/slots/:n/merge`
(`/^\/api\/slots\/(\d+)\/merge$/`). Sie braucht keine Zeile, nur einen Slot mit Worktree.

Genau das ist der beobachtete Unterschied: **Slot 6 am 2026-09-19 und Slot 12 am 2026-09-20
mussten beide von der Orchestratorin über die Owner-Route gelandet werden**, obwohl eine
Program-MAIN bereitstand und den Diff gelesen hatte.

**Der heutige Ausweg:** Owner-Route. Funktioniert, ist aber eine Eskalation für einen
Routine-Land — und die Owner-Policy vom 2026-08-23 nennt genau das einen MAIN-Defekt:
*„ordinary clean/green in-program land decisions belong to the owning Project MAIN, not the
Owner."* Hier ist es keiner: die MAIN hat die Tür nicht.

### Was offen bleibt

**Die mechanische Hälfte beider Löcher ist ungebaut.** Kein Gate erzwingt, dass eine
Entwurfs-Lane eine Bau-Zeile hinterlässt; keine Route erlaubt einer Program-MAIN, eine
zeilenlose Lane ihres Programs zu landen; kein Spawn-Pfad setzt den Lane-Watch automatisch.
Bis dahin trägt §2 diese Kette — als Disziplin, nicht als Mechanik. Die naheliegende
Reparatur (eine Zeile für jede von Hand gegründete Lane, oder ein `slot`-Schlüssel auf der
MAIN-Land-Tür neben dem `id`-Schlüssel) ist eine Bau-Zeile wert und hat noch keine.

## 4. Vorschlag für `rulebook/` — NICHT verbindlich

`CLAUDE.md` ist ein GENERAT; dieser Text gehört als Fragment-Änderung nach
`rulebook/lane-discipline.md` und wird erst durch **Owner-Promotion** normativ. Vorgeschlagen:

```markdown
- **Eine Entwurfsrunde endet nicht mit dem Land, sondern mit der Bau-Zeile.** Landet deine Lane
  nur `docs/` (`git diff --name-only <fork> HEAD | grep -v '^docs/'` leer) und war der Auftrag
  nicht das Dokument selbst, wird sie NICHT geschlossen, bevor die Bau-Zeile in der Queue steht.
  Geschrieben wird sie von dem, der den Entwurf ABNIMMT — nie von der Lane, die geht: sie kennt
  ihre eigene Landing-Sha nicht und ihr Worktree stirbt. Kette und Belege: `docs/entwurf-zu-bau.md`.
- **Die Entscheidung wird wörtlich in die Notiz geschrieben,** die die Varianten trägt — nicht
  paraphrasiert und nie nur im Pane-Transcript. Verworfene Varianten werden im selben Commit
  zur Regel, sonst schlägt die nächste Runde sie wieder vor.
- **Eine von Hand gegründete Lane OHNE Queue-Zeile hat zwei Türen weniger** (`docs/entwurf-zu-bau.md` §3):
  ihr `fleet-report` fällt auf 409, weil der Owner-Inbox-Rückfall eine `taskId` verlangt — und
  ohne Report gibt es keine Nachfolge (`server.ts#succeedLane`). Ausweg heute: die abnehmende
  Session setzt VORHER einen Lane-Watch (`POST /api/self/watch`).
- **Landen kann eine solche Lane nur der Owner.** `server.ts#selfLandTaskForMain` ist auf eine
  Task-ID verdrahtet; die Owner-Tür `POST /api/slots/:n/merge` auf den Slot. Belegt an Slot 6
  (2026-09-19) und Slot 12 (2026-09-20). Die mechanische Reparatur ist ungebaut.
- **Gelandet ist nicht live.** Zwischen LAND und `POST /api/deploy` sieht der Owner nichts; das
  Verdikt schreibt erst der nächste Boot.
```
