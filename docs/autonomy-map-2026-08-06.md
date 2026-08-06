# Autonomie-Landkarte, Stand 2026-08-06

*Antwort auf `briefs/autonomy-gap.md` + `briefs/autonomy-gap-addendum-2026-08-06.md`, mit
`briefs/autonomy-findings-2026-08-06.md` als dritter Eingabe. Alle Zahlen sind am 2026-08-06
zwischen 14:00 und 14:25 aus den Ledgern im Haupt-Checkout neu gerechnet, alle Code-Aussagen
gegen `b169785` gelesen (mein Lane-HEAD). `main` bewegte sich während dieser Session zweimal
weiter — auf `909ace3` und `6e96eaf`, beides Briefs; beide sind gelesen (`git show main:`) und
unten berücksichtigt, weil sie zwei meiner Befunde bereits in Aufträge verwandelt haben.*

**Was diese Session getan hat:** Ledger gerechnet, Code gelesen, drei Live-Routen abgefragt
(`/api/self/gate`, `/api/self/drift`, beide mit dem eigenen Self-Token). **Was sie nicht getan
hat:** keine Suite gefahren (Slot 1 arbeitete am Land-Gate — zwei gleichzeitige Suiten erzeugen
auf dieser Maschine zuverlässig Fehler auf beiden Bäumen), keine Produktivdatei angefasst, keinen
Schalter bewegt. Diese Datei ist die einzige Änderung.

**Ein Befund ist damit unbelegbar geblieben** und steht unten als solcher: die Ausfallrate des
Digest-Workers ist in keinem Ledger, sie war eine In-Session-Messung des Rundgangs. Ich habe
stattdessen den Mechanismus gelesen; das ist eine schwächere Aussage und wird als solche geführt.

---

## §1 Die Zahlen, neu gerechnet

Ersetzt jede Zahl in den drei Eingangsdokumenten. Der Recompute-Block in §11 reproduziert sie.

| Ledger | Stand 2026-08-06 14:22 | im Hauptbrief (08-05) |
|---|---|---|
| `lane-outcomes.jsonl` | **97** Zeilen | 93 |
| davon `landed` | **77** | 73 |
| `landed` + `confirmedByHuman:true` | **10** | 10 |
| `landed` + `verified:true` / `null` / `false` | **72 / 4 / 1** | 68 true |
| `resolvedConflict:true` | **5** | 5 |
| `resolvedBy` überhaupt geschrieben | **1** (`author`) | 1 |
| `repairRounds > 0` | **0** | 0 (nie) |
| `post-land-audits.jsonl` | **40** Zeilen, **26 grün / 14 rot** | 36, 23/13 |
| `audit-adjudications.jsonl` | **12** Zeilen | Feld existierte nicht |
| `audit.jsonl` | **1951** Zeilen, **22** Event-Typen | 1923 / 22 (Findings-Doc) |
| `dispositions.jsonl` | **2** Zeilen | 1 |
| `cleanReviewShadow` auf Outcome-Zeilen | **46** (38 `pass`, 8 `raw`), letzte am 2026-07-28 | CLAUDE.md sagt 45 / 37 / 8 |
| Tasks in `fleet.json` | **27**, davon **0 im Status `queued`** | — |
| Tasks mit `analysis` | **5**, Verdict **5× `needs-you`, 0× `ready`, 0× `unknown`** | — |
| `steward-journal.jsonl` | **118** (77 rundgang, 26 inspektion, 15 propose_outcome), Σ `decisions_surfaced` = **72** | — |

**Die vier Lands des 2026-08-06** und ihre Tier-2-Läufe:

| Land (Uhrzeit) | Branch | Tier-2-Dauer | Ergebnis | nächster srv-Neustart |
|---|---|---|---|---|
| 07:55:40 | `…205702-72fb` | 464,8 s | rot | **08:03:59** (34 s nach Audit-Ende) |
| 09:23:08 | `…211252-3287` | 451,0 s | grün | 11:47:29 |
| 11:56:42 | `…074817-0cdb` | 527,7 s | grün | 12:23:22 |
| 13:18:00 | `…094221-c8f5` | 501,3 s | grün | 14:05:00 |

Deploy-Latenz (Land → nächster Neustart): **8 min 19 s / 2 h 24 min / 26 min 40 s / 47 min**.
srv-Neustarts pro Tag aus `server.log`: 5 (08-06, Stand 14:22), 11 (08-05), 12 (08-04), 38 (08-03).
Der Code-Kommentar an `STALLED_IDLE_MS` (`server.ts:3506`) beziffert das mit „~10×/Tag" — das ist
über die letzten fünf Tage die richtige Größenordnung.

---

## §2 Korrekturen an den drei Eingangsdokumenten

Diese sechs Sätze sind heute falsch und dürfen nicht weitergetragen werden.

1. **„36 Tier-2-Audits, 23 grün / 13 rot — keine einzige Adjudikation"** (Hauptbrief, Bereich 5).
   Überholt. Heute: 40 Zeilen, 26/14, **12 der 14 Roten adjudiziert**. Die Neuformulierung steht
   in §7.
2. **„laneDrift() (`server.ts:4854`)"** (Hauptbrief) und **„`server.ts:5144`"** (Findings-Doc).
   Beide Zeilennummern sind veraltet; die Funktion steht bei **`server.ts:5180`**, ihr einziger
   Abnehmer bei **`server.ts:7780`** (Findings-Doc sagte 7721). Die *Aussage* — genau ein
   Abnehmer, kein Tick, kein Board — habe ich bestätigt.
3. **„`POST /send` … `server.ts:9414`"** (Findings-Doc). Zeile ist heute **9503**. Die Aussage
   stimmt, aber die Formulierung „schreibt jede Nachricht dem Owner zu" ist zu weit: die
   Quell-Union hat fünf Werte (`owner|share|auto|terminal|steward`, `server.ts:566`), und der
   Steward-Sender schreibt bereits `"steward"` (`server.ts:6829`). Die Route `/send` ist die
   OWNER-Route, und `"owner"` ist für sie korrekt — der Server kann nicht mehr wissen. Was fehlt,
   ist enger: **ein Label für „Maschine, die mit dem Owner-Credential spricht".** Solange es das
   nicht gibt, muss jeder maschinelle Sender über eine eigene Route mit eigener Quelle laufen,
   nie über `/send`. Das ist eine Vorbedingung, keine Politur (§11.1, Punkt 3).
4. **„`briefPayload` … instruiert aber mit keinem Wort zu Drift oder Rebase"** (Findings-Doc).
   Trivial wahr — `briefPayload` (`server.ts:1057`) ist ein UI-Payload für Sideboard und
   Gast-Infotab, kein Prompt. Die tragfähige Fassung habe ich separat geprüft und sie hält: in
   `enhance-prompt.ts`, `refine-prompt.ts`, `clarify-prompt.ts` kommt Drift/Rebase **nicht** vor
   (einziger Treffer: `enhance-prompt.ts:53`, und der meint einen *unterbrochenen* Rebase).
5. **„`RefineChild` trägt ein `files`-Feld, also ist vor der Arbeit bekannt, was eine Task
   anfassen wird"** (Hauptbrief, Bereich 3). **Zur Hälfte falsch, und die falsche Hälfte ist die
   nützliche.** Siehe §5.3: das Feld existiert nur im *Vorschlag*; der Confirm faltet es in den
   Fließtext des Kindes.
6. **„Die Analyse gated nichts"** (CLAUDE.md, Punkt (d)). Präziser: das **Verdict** gated nichts,
   die **Existenz** einer frischen Analyse gated den unbeaufsichtigten Tick sehr wohl
   (`server.ts:2314-2320`: `waiting: not analysed yet`). Für die Autonomie-Frage ist der
   Unterschied wesentlich — siehe §4.

Nicht überholt, nachgeprüft und weiterhin gültig: die Ledger-Aussage „`repairRounds > 0`: nie",
die Kollisionsmessung von Bereich 3a, und die drei Sensor-Defekte von Bereich 4 (§6).

---

## §3 Die Kette, wie sie am 2026-08-06 wirklich steht

```
Task → [Analyse-Worker] → OWNER-PROMOTE → tickDispatch → Lane + Brief → Arbeit → auto-③
     → OWNER drückt ⏫ → Server-Rebase → (Konflikt → Autor) → Verify-Gate → Land
     → Tier-2-Audit → OWNER startet srv neu + baut das Bundle
```

Drei Menschen-Glieder, unverändert. Was sich seit dem 05.08. geändert hat, ist die *Beweislage*,
nicht die Form:

- **Der Promote ist heute nachweislich der Engpass, nicht nur konzeptionell.** `fleet.json` führt
  **27 Tasks, keine einzige im Status `queued`**. `tickDispatch` wählt wörtlich
  `t.kind === "lane" && t.status === "queued"` (`server.ts:2289`). Der Dispatcher ist an
  (`fleet.json: "dispatch": true`, geprüft, nicht behauptet) und hat seit dem Umbau `500ff63`
  (05.08. 20:57) **nichts** zu tun gehabt.
- **Der Analyst hat gearbeitet und immer dasselbe gesagt.** 5 Verdicts, **5× `needs-you`**, kein
  `ready`, kein `unknown`; die drei jüngsten aus einem Sweep um 13:41:46 heute. Wichtig für die
  Autonomie-Frage und in §2 Punkt 6 präzisiert: der Tick verlangt eine **frische Analyse**, nicht
  ein positives **Verdict** (`server.ts:2314-2320`). Ein promotetes `needs-you` würde also
  unbeaufsichtigt starten. Der Analyst ist eine Lesepflicht, kein Filter — das ist genau so
  gewollt (der Promote ist die Entscheidung), muss aber gewusst werden, bevor jemand das Verdict
  als Sicherung liest.

---

## §4 Bereich 2 — der Land-Auslöser, und was „auto-fähig" heute belegbar heißt

**Verifiziert.** `mergeJob` hat genau einen Aufrufer: die Route bei `server.ts:8808`. Kein Tick
ruft sie. Die Autonomiegrenze ist damit unverändert dort, wo der Entscheid vom 04.08. sie gesetzt
hat.

**Was die 77 Lands wirklich belegen** — und das ist weniger, als die Frage im Hauptbrief hofft:

- **72/77 mit `verified:true`.** Das ist die stärkste Zahl im ganzen Register.
- **4/77 mit `verified:null`** = das Gate hat gar nicht gemessen. `null` heißt SKIPPED und ist
  nicht „grün" (`server.ts:3883`).
- **1/77 mit `verified:false`** (`discrepancy-audit`, ts 1784968878632) — ein Land *gegen* ein
  rotes Verify. Ein Auto-Land-Pfad, der diese eine Zeile hätte reproduzieren müssen, existiert
  nicht; sie war eine Owner-Entscheidung.
- **`repairRounds > 0`: nie.** Die Reparaturschleife (`FLEET_MERGE_REPAIR_ROUNDS=2`, live
  bestätigt über `/api/self/gate`) ist seit ihrer Einführung **nie eingesprungen**. Sie ist
  ungetestet im Feld — das ist kein Argument gegen sie, aber sie darf in keiner Auto-Land-Rechnung
  als Sicherheitsnetz auftauchen.
- **`resolvedBy` einmal geschrieben.** Der Autor-Pfad steht bei n=1, wie der Hauptbrief sagt.

**Der neu gemessene Kostenpunkt, den Bereich 2 nicht hatte:** das Verify-Budget.
`/api/self/gate` liefert live `timeoutMs: 300000` für eine Kette aus `bun install` + Pins + tsc +
drei Suiten. Ein Timeout wird bei `server.ts:3883` zu `ok: false` — **derselbe Wert wie „die
Suite ist gefallen"**. Das Repo unterscheidet an genau dieser Stelle sonst sauber: `ok: null` =
SKIPPED, Feld absent = unkonfiguriert. Ein Timeout ist der vierte Zustand und hat kein Wort.
**Kosten, wenn es offen bleibt:** jede Automatik, die „`verify.ok === false` → Regression"
liest, verwechselt eine überzogene Uhr mit einem Urteil; und weil das Budget flottenweit gilt,
trifft die Verwechslung jede Lane, nicht die, die die Suite verlängert hat.

> **ÜBERHOLT — dieser Absatz ist ein Snapshot vom 06.08. und beschreibt Code, den es nicht mehr
> gibt.** Noch am selben Tag wurde der Timeout zu `ok:null` + `timedOut`; am 07.08. kam das
> Eigentliche dazu, das hier fehlt: das eine Budget war *wall-clock* und enthielt die Wartezeit am
> Suite-Mutex. Es sind jetzt zwei (`FLEET_VERIFY_TIMEOUT_MS` für Arbeit,
> `FLEET_VERIFY_WAIT_MS` für die Schlange), `/api/self/gate` liefert beide, und ein Lauf, der nie
> drankam, heißt `waitedOut` statt `timedOut`. Das „hat kein Wort" oben gilt also nicht mehr —
> es sind drei Wörter. `docs/suite-contention.md` §8.

---

## §5 Bereich 3 — Kollisionsvermeidung: die Zutat ist nicht da, wo der Brief sie vermutet

### 5.1 Der Drift-Fakt (bestätigt, mit korrigierten Zeilen)

`laneDrift()` (`server.ts:5180`) rechnet `behind`, `wouldConflict`, `conflictFiles`, `overlap`,
`dirty`, `otherLanes`. **Ein Abnehmer**: `GET /api/self/drift` (`server.ts:7780-7792`), auth per
`x-fleet-self-token`. In der Route steht **kein `audit(`-Aufruf** — nachgezählt: `audit.jsonl`
führt 1951 Zeilen über 22 Event-Typen, und keiner davon ist Drift. Die belastbare Aussage bleibt
die des Findings-Docs: nicht „Lanes prüfen nie", sondern **„niemand kann es sagen"**.

**Frische Evidenz von heute, aus dem Live-System:** der Notiz-Worktree `…085148-3de0` steht
**6 Commits hinter `main`** bei 0 eigenen Commits (gemessen: `rev-list --left-right --count
main...HEAD` → `6 0`). Das Addendum sprach von 4; die Zahl ist seither gewachsen, was den Punkt
eher stützt. Sichtbar ist sie für niemanden außer dieser Lane selbst.

### 5.2 `otherLanes.files` misst das falsche Fenster — neu

**Gelesen, `server.ts:5152`:** die in-flight-Dateien der anderen Lanes kommen aus
`git diff --name-only base...HEAD` — also **nur committete** Arbeit. Eine Lane, die seit vier
Stunden an fünf Dateien editiert und noch nichts committet hat, meldet `files: []`.

**Live belegt:** mein eigener Abruf von `/api/self/drift` um 14:20 liefert für beide anderen
offenen Lanes `files: []`, obwohl beide arbeiten.

**Kosten:** genau für die Prävention, für die Bereich 3 dieses Feld vorsieht, ist es blind. Ein
Kollisions-Check vor dem Spawn, der auf `otherLanes.files` baut, sagt „keine Überschneidung"
für die häufigste reale Lage.

### 5.3 Der Refine-Kompiler liefert `files` — und der Confirm wirft es weg

**Gelesen.** `RefineChild` (`server.ts:236`) trägt `files: string[]`, der Prompt verlangt
„paths you verified" (`refine-prompt.ts:56`). Aber `refine-confirm` (`server.ts:9144-9154`)
mintet die Kinder mit `text: refineChildText(c)`, und `refineChildText` (`server.ts:2190-2197`)
faltet die Pfade als Prosa-Zeile `Files: a, b, c` in den Text. Das Kind-Task-Objekt hat **kein
`files`-Feld** (`interface Task`, `server.ts:167-207`).

**Wie viel heute maschinenlesbar ist: null.** Genau **eine** Task trägt überhaupt ein
`refine`-Objekt (`5a05080e`), und `audit.jsonl` kennt genau **einen** `task_refine`-Event.

**Kosten:** die Zutat, die Bereich 3 als „seit heute vorhanden" führt, ist für jeden Konsumenten
außer dem Auge des Owners nicht vorhanden. Wer darauf baut, baut auf einer Vermutung.

### 5.4 Der Dreifach-Spawn (Bereich 3b) — Mechanismus anders als beschrieben, Wirkung unverändert

Die drei Klicks stehen exakt so in `audit.jsonl`, wie der Hauptbrief sie zitiert:
`task_dispatch 5a05080e clarify` **22:55:47**, `task_dispatch 5a05080e` **22:56:49** und
**22:57:02**.

**Der Hauptbrief benennt den Mechanismus falsch.** Er sagt, die Task werde „erst am Ende von
`briefAndSend` `sent`". Bei HEAD passiert das *innerhalb* von `dispatchTask`
(`server.ts:1904`), vor dem Return, und die Route weist eine `sent`-Task mit 409 ab
(`server.ts:9062-9063`). Der tatsächliche Weg ist ein anderer und er ist **offen**:

> `briefAndSend` requeued bei jedem Fehlschlag des Alive-Gates (`server.ts:1958-1973`,
> `requeue("dispatch held (…) — requeued")`) — **und lässt die gerade gespawnte Lane stehen.**
> Kein `killSlot`, kein `removeWorktree`. Die Zeile geht auf `queued` zurück und ist sofort wieder
> startbar; der Worktree bleibt.

**Kosten:** N Requeues = N Worktrees für eine Task. Das ist die Signatur des Vorfalls vom 05.08.,
und sie ist bei `b169785` unverändert. Für unbeaufsichtigten Betrieb ist das der teuerste der
drei Punkte in Bereich 3, weil er sich selbst verstärkt: jeder Requeue verbraucht einen Slot und
zählt gegen `FLEET_DISPATCH_MAX_LANES`.

---

## §6 Bereich 4 — die Sensoren

Alle drei Defekte des Hauptbriefs sind **offen**. `git log -S` über `server.ts` zeigt für
`sinceLastLook` und `transcriptFact` seit dem 05.08. keinen Commit.

### 6.1 Digest — der Mechanismus, nicht die Rate

**Nicht aus Ledgern rechenbar.** Der Steward-Journal trägt kein `digest`-Feld; die „sechs von
sieben Pulsen null" waren eine In-Session-Beobachtung und bleiben unbelegt.

**Was ich stattdessen gelesen habe, und es ist ein schärferer Befund als die Rate:**

| Konstante | Wert | Stelle |
|---|---|---|
| `DIGEST_TTL_MS` | 2 min | `server.ts:7282` |
| `DIGEST_WAIT_DEFAULT_MS` | 30 s | `server.ts:7283` |
| `DIGEST_WAIT_MAX_MS` | 60 s | `server.ts:7284` |
| Timeout des Digest-Workers | `SUMMARY_TIMEOUT_MS` = **180 s** | `server.ts:2898`, Aufruf ohne eigenes `timeoutMs` bei `server.ts:7320` |

Der Puls ist stündlich (`.claude/commands/rundgang.md` nennt keinen `?wait`, also gilt der
Default). **Der Cache kann bei stündlichem Puls nie treffen, also startet jeder Puls einen
Worker und wartet 30 s auf einen Worker mit 180 s Budget.** Ein Worker, der zwischen 30 s und
180 s braucht, wird *nie* ausgeliefert: bis zum nächsten Puls ist sein Ergebnis abgelaufen.
Das ist keine Ausfallrate, das ist eine Konstruktion, in der der langsame Fall strukturell
unsichtbar bleibt.

**Kosten:** ein Advisory-Kanal, der ohne Fehlermeldung leer bleibt, ist von „nichts zu melden"
nicht unterscheidbar. Die billigste Kur ist eine Zahl, nicht Code: `DIGEST_TTL_MS` über das
Puls-Intervall heben, damit der *vorherige* Lauf noch gilt.

### 6.2 `sinceLastLook` schlüsselt nach Branchname — offen, und die Fehlerform ist präziser als gedacht

`laneFacts()` schreibt `out[wt.branch] = {…}` (`server.ts:7187`) und überspringt bei
`|| out[br.out]` (`server.ts:7191`) das zweite Repo, das denselben Branchnamen hat. Es gibt also
**keine Vermischung, sondern eine Verdrängung**: von zwei `main` überlebt eines, und welches,
hängt an der Iterationsreihenfolge. Wechselt sie zwischen zwei Pulsen, meldet `rewritten` einen
Rewrite, den es nicht gab — genau der Fehlalarm, den der Rundgang am 05.08. sah.

**Kosten:** `vanishedUnlanded` und `rewritten` sind die beiden Felder mit Alarmcharakter. Ein
Alarm, dessen Ruhezustand gelegentlich der Alarm ist, wird als Rauschen gelernt.

### 6.3 `transcriptFact.mtime` — offen, und das Feld warnt nicht vor sich selbst

`transcriptFact` (`server.ts:6959-6963`) liefert `{bytes, mtime}`. Der Kommentar darüber
(`server.ts:6948-6958`) nennt **zwei** Caveats — Bytes sind ein Proxy, nur gepinnte Slots — und
**keins über `mtime`**. Der Block ist als „context-size proxy" überschrieben; `mtime` reist als
zweites Feld mit und lädt zur Aktivitätslesart ein.

**Kosten:** klein, solange nur ein Mensch es liest. Sobald ein Prädikat es liest, ist es die
teuerste Sorte Fehler, weil das Feld stündlich „frisch" wird, ohne dass etwas passiert ist.

### 6.4 Was seit dem 05.08. wirklich repariert wurde

`523f5dc` (Boot stempelt `lastOutput` auf die Bootzeit statt 0) ist gelandet und wirkt. Der
Commit-Body benennt die zwei Verbraucher (`canDeliver`s busy-Gate und die auto-③-Idle-Klausel).
`28014d4` hat `stalled` als deterministisches Prädikat ergänzt (`lane-signals.ts:105-113`).
**Beide Fakten sind heute nur über den Steward erreichbar:** `stalled` und `stalledSince` stehen
in `stewardSlotsView` (`server.ts:7004-7009`) und kommen in `src/client.ts` nicht vor — das
Owner-Board zeigt sie nicht.

---

## §7 Bereich 5 — Konsum, neu formuliert

### 7.1 Die Tier-2-Adjudikation: das Feld ist da, und was es zeigt, ist unbequemer als die Lücke

Der alte Befund („keine einzige Adjudikation") ist tot. Der neue:

**12 der 14 roten Tier-2-Läufe sind beurteilt. Keiner davon als `real`.**

| Verdict | n | von wem |
|---|---|---|
| `unknowable` | 8 | `backfill` — *„record predates signal-first retention"* |
| `stale-test` | 2 | `owner` |
| `flake` | 2 | `owner` |
| **`real`** | **0** | — |

Zwei Rote sind **un-adjudiziert** und beide sind beurteilbar (die signal-first-Retention hat ihre
FAIL-Zeilen erhalten, ich habe sie gelesen):

- `at 1785254868161` (2026-07-28, `main` `8e0f232`) — 3 FAILURES, alle im Rate-Cap-Abschnitt
  („the cap is a ceiling…", „the refused POST wrote nothing…", „the cap does not drift open…").
- `at 1785759228958` (2026-08-03, `main` `6081449`) — 2 FAILURES im steward-send-Episodenfenster
  („a second send … is 429 (409)", „a capped send is audited").

**Beide sind bereits beauftragt** — `briefs/audit-reds-familie-b.md` (Commit `6e96eaf`, heute
14:27, also nach dem Spawn dieser Lane). Sie stehen hier als Zahl, nicht als Vorschlag; der
Auftrag verlangt Urteil + Beleg pro Zeile, adjudiziert wird owner-seitig.

**Die richtige Lesart für die Autonomie-Frage:** der Kanal hat in 40 Läufen **null bestätigte
Regressionen** produziert. Das ist kein Argument, ihn abzuschalten — es ist die Basisrate, gegen
die jedes zukünftige Rot gelesen werden muss, und sie sagt: *ein rotes Tier-2 ist a priori
wahrscheinlich kein Produktdefekt.* Wer daraus einen Auto-Rollback baut, baut einen Auslöser mit
einer historischen Trefferquote von 0/12 *(Korrektur 2026-08-06: inzwischen **1/15** — ein echtes
`real` darunter, Server-Defekt behoben in `07e5969`; `docs/autonomy-bausteine-2026-08-06.md` §1.1.
Der Entscheid steht: 14 von 15 wären grundlos gewesen.)*.

### 7.2 Der Rundgang: 72 aufgedeckte Entscheidungen, 9 offene Zeilen, und heute keine einzige neue

- 77 Rundgang-Datensätze, **Σ `decisions_surfaced` = 72**.
- In der Queue: **9 `pending` Notizen** vom Steward — alle vom 05.08., keine davon aufgelöst.
- `audit.jsonl`: **11 `steward_task`-Events am 05.08., 0 am 06.08.** — obwohl der Rundgang heute
  14-mal lief und mehrfach `decisions_surfaced ≥ 1` meldete.

**Der Befund ist nicht „niemand liest die Notizen", sondern schärfer:** der Kanal, der *aufdeckt*
(`decisions_surfaced` im Journal), und der Kanal, der *einreicht* (`steward_task` → Queue-Zeile),
sind entkoppelt, und der zweite ist heute stillgefallen, ohne dass irgendwo etwas rot geworden
wäre. Und für eine Notiz existiert weiterhin kein „erledigt" — nur Promote (das die stehende
Row-Note *„note — the dispatcher never runs this"* schreibt) oder Löschen.

**Kosten:** `resolved / raised` ist für diesen Typ nicht nur unbekannt, sondern *unmessbar*,
weil der Nenner selbst schwankt, ohne dass es auffällt.

### 7.3 `dispositions.jsonl`: 2 Zeilen, beide `ignored`

Beide `worker: "enhance"`, `source: "owner"`, die zweite von heute 10:41. Das ✨-Rail hat in
seiner gesamten Lebenszeit zwei Rückmeldungen erhalten und beide lauten „ignoriert".

### 7.4 Kein Land-Event im Audit-Log — neu

`audit.jsonl` führt 22 Event-Typen. Darunter ist **kein** `land`, `merge`, `deploy` oder `drift`.
Die größten Töpfe sind `owner_auth_fail` (534) und `self_heal_recreate` (519).

**Kosten:** die Frage „wie oft wurde gelandet und wie oft war ein Mensch dabei" ist heute nur
über `lane-outcomes.jsonl` beantwortbar, die Frage „wann wurde deployt" nur über `server.log`.
Für eine Inbox, die `resolved / raised` pro Typ messen soll (Findings-Doc §4), fehlt damit
ausgerechnet für die zwei Owner-Aktionen mit der größten Wirkung die Ereignis-Zeile.

---

## §8 Bereich 1 — Deploy: eine Korrektur, die die Aufgabe kleiner macht

**Der Hauptbrief fragt: „Welche Läufe darf ein Auto-Restart nicht zerreißen?" — die Antwort ist
gemessen und lautet: praktisch keinen.**

Der Post-Land-Audit ist ein Kind des Serverprozesses, aber seine **Queue ist durabel und
boot-resumend** (`server.ts:4229-4270` schreibt vor dem Return, `server.ts:6549-6577` nimmt sie
beim Boot wieder auf), und der Eintrag wird erst **nach** dem Schreiben der Zeile konsumiert
(`server.ts:4252-4259`, ausdrücklich als at-least-once dokumentiert). Ein Neustart mitten im
Lauf kostet **einen Wiederholungslauf**, nicht ein verlorenes Audit. Die vier Läufe von heute
dauerten 451–528 s.

Die manuell eingehaltene Sequenz „erst den Audit zu Ende, dann srv neu starten" (heute einmal
sauber belegt: Audit-Ende 08:03:25, Neustart 08:03:59) ist damit eine **Latenz-Optimierung, keine
Korrektheitsbedingung**. Das ist die wichtigste Einzelkorrektur an Bereich 1: die Sequenz muss
nicht mechanisiert werden, sie muss nur nicht mehr von Hand gewusst werden.

**Was offen bleibt und keine Mechanik hat:**

- `deployGap` (`server.ts:7061-7079`) und `bundleStale` (`server.ts:7153`) werden gerechnet und
  **werden dem Owner angezeigt** (`src/client.ts:1713-1731`, „⚠ deploy due"). Der Kanal ist also
  nicht blind — die Zeitreihe oben (8 min bis 2 h 24 min) sagt, dass er gesehen und ungleichmäßig
  bedient wird.
- `bun run build` läuft nirgends automatisch (nur `package.json:13`).
- `undoableFor` (`server.ts:4013`) hält genau **einen** Eintrag pro Repo. `fleet.json.undoLands`
  bestätigt das live: zwei Repos, zwei Einträge. In einem Schub von vier Lands wie heute ist der
  Rückweg für die ersten drei weg, bevor irgendein Alarm eintrifft.

---

## §9 Vier Befunde, die in keinem der fünf Bereiche standen

### 9.1 Ein gelandeter Branch behält seinen „⏸ ungeprüft"-Vermerk — bestätigt an Live-Zustand

`landLane` löscht den geparkten Merge-Verdict (`server.ts:1320`, Kommentar: *„a parked ⏸ must
not outlive it"*) und ruft **danach** `killSlot` (`server.ts:1330`). `killSlot` ruft
`parkMergeVerdict(s.id, false)` (`server.ts:1615`), und das setzt den Eintrag aus `mergeLast`
**wieder in die Park-Map** (`server.ts:3974-3979`), weil `landLane` `mergeLast` nie räumt.

**Live nachgewiesen, nicht abgeleitet:** `fleet.json.mergeParked` trägt heute den Branch
`fleet/260805151236-096a` mit `status:"resolved"`, `landed:false`, `at 1785958194259`
(05.08. 21:29:54) und dem Detailtext *„Review the diff, then land."* — **dieselbe Lane ist am
05.08. um 22:02:10 gelandet** (`lane-outcomes.jsonl`, ts 1785960130535, `disposition:"landed"`,
`mainAfter 500ff63`). Ihr Worktree existiert nicht mehr.

**Kosten:** persistierter Phantom-Zustand, der genau wie ein offener Review-Posten aussieht.
`mergeLast.status` ist einer der acht Item-Typen der vorgeschlagenen Entscheidungs-Inbox
(Findings-Doc §4) — diese Inbox würde am ersten Tag ein Item zeigen, das seit 16 Stunden erledigt
ist, mit einer Handlungsaufforderung, die nicht mehr ausführbar ist.

**Status 2026-08-06 — der Pfad ist zu, der Alt-Eintrag lebt noch.** `landLane` räumt jetzt BEIDE
Sichten, bevor `killSlot` läuft: `mergeParked.delete(branch)` **und** `mergeLast.delete(s.id)`.
Die Quelle, aus der `parkMergeVerdict` die Park-Map Millisekunden später wieder befüllte, ist
damit leer — und der Aufruf in `killSlot` bleibt unangetastet, denn er ist kein Bug: er trägt
einen reviewable Verdict über einen Kill hinweg, solange der Branch WEITERLEBT und reattacht
werden kann. Genau das schließt ein Land aus, und genau das ist der Unterschied, an dem der Fix
ansetzt. Gepinnt durch zwei Checks in `e2e/merge.ts`: *„a LANDED branch leaves no parked ⏸
behind — not in memory, and not in the file a restart reads"* (rot ohne den Fix) und, für die
Gegenrichtung, das bestehende *„⏸ survives kill + reattach — the reattached lane still wears the
pause"* (rot, sobald jemand den Park stattdessen streicht). **Nicht erledigt: der Alt-Eintrag**
`fleet/260805151236-096a` selbst — er liegt bereits in `fleet.json` und verschwindet durch einen
Fix am Land-Pfad nicht. Ob per Einmal-Räumung beim Boot (räumt auch künftige Altlasten, fasst
aber ungeprüften Zustand an) oder von Hand, ist eine Owner-Frage. Solange er steht, gilt die
Einschränkung weiter unten (`mergeLast.status` als noch nicht vertrauenswürdiger Inbox-Item-Typ)
unverändert.

### 9.2 Ein requeueter Dispatch lässt seine Lane stehen

Siehe §5.4. Eigener Punkt, weil er nicht Kollision ist, sondern Ressourcenleck.

### 9.3 Ein Timeout des Verify-Gates ist ein Nicht-Urteil im Kleid eines Neins

Siehe §4. Der Findings-Doc hat das erkannt; ich bestätige den Code (`server.ts:3871`,
`3878`, `3883`) und ergänze: das Muster für den vierten Zustand existiert im selben Ausdruck
bereits (`skipped ? null : !timedOut && code === 0`) — `timedOut` ist dort schon eine Variable.

### 9.4 `Slot.mission` ist das Feld für „was hier eigentlich passieren soll" — und niemand liest es

`Slot.mission` (`server.ts:246-255`) ist owner-geschrieben (Route `server.ts:9394-9402`),
persistiert (`server.ts:6342-6343`), an den Steward serviert (`server.ts:6980`) und wird von
**keinem Prädikat** gelesen. Aktuell ist es auf **keinem einzigen Slot** gesetzt.

**Kosten:** jede Debatte über „die Maschine kennt die Absicht nicht" führt an einem Feld vorbei,
das dafür gebaut wurde. Es ist Freitext, taugt also nicht als Prädikat-Eingang — aber es ist der
Ort, an dem die Antwort auf „warum ist dieser Slot so, wie er ist" heute schon stehen dürfte.

---

## §10 Die Einordnung, nach der das Addendum ausdrücklich fragt

> *Der `stalled`-Fakt feuerte auf einer absichtlich geparkten Lane. Sensor-Defekt (4),
> fehlender Rückkanal (5), oder etwas Eigenes?*

**Etwas Eigenes — und zwar eine fehlende EINGABE, nicht ein fehlerhafter Sensor und nicht ein
verstopfter Ausgang.**

Begründung, klausenweise geprüft (`lane-signals.ts:105-113`): `alive`, `lastOutput>0`, `idle`,
`no git op`, `no blocked merge`, `awaiting:null`, `git.ahead===0`. Für den Notiz-Worktree
`…085148-3de0` habe ich von außen `git.ahead === 0` (gemessen: `6 0`) und sauberen Baum bestätigt;
die übrigen Klauseln sieht nur der Server. **Jede Klausel ist korrekt, jede feuert korrekt.**
Das Prädikat hat keinen Defekt — es fehlt ihm ein Fakt, den die Flotte nirgends führt: *dieser
Slot soll nichts tun.* `awaiting:"owner"` deckt genau einen Fall ab (Clarify-Lane, gesetzt bei
`server.ts:1909`), `Slot.mission` ist Freitext und wird von keinem Prädikat gelesen (§9.4).

Warum die Einordnung praktisch zählt: als Sensor-Defekt gelesen, würde man am Prädikat
herumschrauben und dabei genau die Eigenschaft beschädigen, die es teuer erkauft hat — dass jede
Klausel ein POSITIVER Test über einen BEKANNTEN Fakt ist (`lane-signals.ts:90-104`). Als
fehlender Rückkanal gelesen, würde man eine Auflöse-Aktion bauen, wo eine Markierung fehlt.

**Und: das ist bereits beauftragt.** `briefs/stalled-parked-and-ledger.md` (Commit `909ace3`,
heute ~14:20, nach dem Spawn dieser Lane) schreibt genau diese Reihenfolge fest — Teil 1 die
Parkungs-Markierung, Teil 2 das Instanz-Ledger — mit den Randbedingungen persistiert /
owner-gesetzt / mit Grund / zieht nur `stalled` ab / sichtbar neben dem Fakt. **Ich schlage hier
nichts vor, was dort schon steht.** Zwei Ergänzungen, die dort nicht stehen und die aus dieser
Analyse kommen:

1. **Die Feuerprobe des `stalled`-Fakts (≥10 Instanzen, ≤2 Fehlalarme,
   `briefs/lane-stalled-fact.md`) ist mit der heutigen Restart-Rate nicht in vertretbarer Zeit
   erreichbar.** Der Kommentar an `STALLED_IDLE_MS` (`server.ts:3503-3515`) sagt: jeder Neustart
   setzt jede Lane-Idle-Uhr zurück, die Schwelle ist 30 min. Gemessen: 5–12 Neustarts/Tag über
   die letzten fünf Tage, am 03.08. 38. Eine Lane erreicht die Schwelle also nur in einem
   neustartfreien 30-Minuten-Fenster. **Wer n=10 zählt, muss das Fenster mitzählen**, sonst ist
   die Stichprobe nicht „zehn Instanzen", sondern „zehn Instanzen aus den ruhigen Tagen".
2. `Slot.mission` existiert und ist leer (§9.4) — bevor ein neues Feld entsteht, gehört die Frage
   beantwortet, warum das vorhandene nicht der Träger ist. Meine Lesart: weil ein Prädikat
   Freitext nicht lesen kann und lesen darf. Das ist ein guter Grund, aber er sollte im Commit
   stehen.

---

## §11 Gegengewicht

### 11.1 Was NICHT automatisiert werden soll — mit Begründung, nicht als Vorsichtsgeste

1. **Kein Auto-Land, in keiner Form, solange `repairRounds` bei 0 und `resolvedBy` bei n=1
   steht.** Beide Pfade, die einen misslungenen Auto-Land auffangen sollen, sind im Feld
   ungetestet. Ein Sicherheitsnetz mit null Belastungsproben ist Dekoration.
2. **Kein Auto-Rollback auf ein rotes Tier-2.** Historische Trefferquote: 1 von 15 adjudizierten
   Roten war `real` (§7.1; Korrektur 2026-08-06, vorher 0/12 — `docs/autonomy-bausteine-2026-08-06.md`
   §1.1). Ein Auslöser, der in 14 von 15 Fällen grundlos ausgelöst hätte, macht
   `main` instabiler, nicht stabiler. Dazu kommt: `undoableFor` hält einen Eintrag pro Repo (§8),
   im Schub ist der Rückweg ohnehin weg.
3. **Kein serverseitiger Sender an Lanes**, solange `/api/self/drift` kein Audit-Event schreibt
   (§5.1) und `/send` keine eigene Quelle für „Maschine, mit Owner-Credential" hat (§2.3). Beides
   ist Vorbedingung, nicht Politur: Provenienz lässt sich nachträglich nicht reparieren
   (Details zur Quell-Union: §2, Punkt 3).
4. **Kein Handeln auf `stalled`.** Der Fakt ist einen Tag alt, seine Feuerprobe ist nicht
   gelaufen, und seine erste Instanz war ein Fehlalarm gegenüber der Absicht.
5. **Der Konflikt-Pfad hält weiter für Review an.** Unverändert die Position des Hauptbriefs, und
   die Messung stützt sie: 5 `resolvedConflict`, 1 `resolvedBy`.

### 11.2 Welche Evidenz den nächsten Schritt rechtfertigen würde

Kein Vorschlag ohne Schwelle. Jede Zeile: **welche Zahl, über wie viele Läufe, wann man
abbricht.**

| Schritt | Zahl | über | Stop-Kriterium |
|---|---|---|---|
| **A. Audit-Event auf `/api/self/drift`** — **gebaut `2ada187`, 2026-08-06; die Messung läuft** (§11.3) | Anteil der Lanes, die ihren Drift *vor* dem letzten Drittel ihrer Lebenszeit prüfen | 20 gelandete Lanes | keins nötig — reine Messung, kein Verhalten ändert sich. Wenn nach 20 Lanes der Anteil <20 % ist, ist die CLAUDE.md-Anweisung als Mechanismus widerlegt und B wird Pflicht statt Option. |
| **B. Drift-Hinweis in den Gründungsbrief** | dieselbe Quote wie A, nach der Einführung | 20 gelandete Lanes | steigt die Quote nicht um ≥30 Prozentpunkte, ist der Brief nicht der Träger — dann aufhören, nicht nachschärfen. |
| **C. `otherLanes.files` auf uncommittete Dateien erweitern** (§5.2) | Anzahl der Lane-Paare, für die der Wert vor dem Spawn nichtleer gewesen wäre | 15 Spawns | liefert es in <3 von 15 Fällen etwas, ist Kollisionsvermeidung vor dem Spawn kein reales Problem dieser Flotte und der ganze Bereich 3 wird zurückgestellt. |
| ~~**D. Timeout als vierter Verify-Zustand** (§4/§9.3) | Anzahl der `verify.ok:false` mit `[verify timed out after …]` im Output | 30 Merge-Läufe | 0 Vorkommen in 30 → der Live-Fall vom 06.08. war ein Einzelfall, der Zustand bleibt ungetrennt (billiger als eine Unterscheidung, die nie greift).~~ **ERLEDIGT — `9c1b73c` (2026-08-06), erweitert 2026-08-07.** Die Messgröße dieser Zeile ist seither **nicht mehr erhebbar**: ein Timeout ist kein `verify.ok:false` mehr, also kann die gesuchte Zahl nur noch 0 sein — und 0 hieße hier laut Stop-Kriterium „Einzelfall, ungetrennt lassen", also genau das Gegenteil dessen, was der Baum tut. Am 07.08. kam der fünfte Zustand dazu (`waitedOut`: die Uhr lief ab, während der Gate noch in der Mutex-Schlange stand und den Baum nie ansah). `docs/suite-contention.md` §8. |
| **E. `DIGEST_TTL_MS` über das Puls-Intervall** (§6.1) | Anteil der Pulse mit `digest != null` | 10 Pulse | steigt er nicht über 50 %, ist die TTL nicht die Ursache und der Worker selbst ist es — dann messen statt drehen. |
| **F. `stalled`-Instanz-Ledger** (beauftragt, §10) | 10 adjudizierte Instanzen, ≤2 Fehlalarme | siehe `briefs/lane-stalled-fact.md` | **zusätzlich:** jede Zeile trägt die Schwelle UND die Zahl der srv-Neustarts in ihrem Fenster; ohne die zweite Zahl ist die Stichprobe nicht auswertbar (§10.1). |
| **G. Entscheidungs-Inbox** (Findings-Doc §4) | `resolved / raised` pro Item-Typ | 14 Tage | ein Typ, der nach 14 Tagen unter 30 % `resolved` liegt, fliegt aus der Inbox — er ist ein Archiv, und die Regel des Findings-Docs („kein Item ohne Auflöse-Aktion") gilt auch rückwirkend. |

### 11.3 Die Reihenfolge

Begründet, nicht sortiert nach Aufwand.

**Zuerst — Instrumentierung, weil sonst jede folgende Entscheidung gegen eine Vermutung gebaut
wird.** In dieser Reihenfolge:

1. ~~**A** (Audit-Event auf Drift). Eine Zeile, und sie beantwortet zum ersten Mal eine Frage, die
   in zwei Dokumenten als „niemand kann es sagen" steht.~~
   **ERLEDIGT — `2ada187` (2026-08-06), nachgetragen 2026-08-07.** `GET /api/self/drift` schreibt
   seither ein `self_drift`-Audit-Event; Join-Key ist der Branch, nicht die Slot-id, und gebucht
   wird nur eine frische Antwort (ein Cache-Hit schreibt nichts, damit der Aufrufer nicht die
   Historie aus dem Log rotiert, das er füllt). Der Basiswert steht im §12-Block —
   *landed 78, checked 0*, über 78 gelandete Lanes kein einziger messbarer Check —, und das ist
   der Nullpunkt, gegen den die Schwelle oben läuft, nicht ihr Ergebnis:
   `docs/autonomy-bausteine-2026-08-06.md` §1.3 zählte am 2026-08-06 ~20:15 bereits 20 Events.
   **Die Instrumentierungs-Gruppe beginnt damit bei 9.1.**
2. **9.1** (der Phantom-`mergeParked`-Eintrag). Kein Messproblem, ein Bug mit Live-Beleg, und er
   verfälscht ausgerechnet den Item-Typ, den die Inbox als erstes zeigen würde. Billig.
3. **E** (Digest-TTL). Eine Zahl. Ohne sie ist Bereich 4 nicht bewertbar, weil sein
   Hauptsensor ohne Fehlermeldung leer bleibt.

**Danach — die Sensoren, weil alles Automatische auf ihnen rechnet:** 6.2 (`sinceLastLook`
nach Repo schlüsseln), 6.3 (`mtime`-Caveat oder Feld entfernen), ~~**D** (Timeout-Zustand)~~
— **D ist erledigt**, siehe die durchgestrichene Zeile in der Tabelle oben.

**Danach — Prävention, weil sie den Land-Pfad billiger macht:** 9.2 (requeueter Dispatch räumt
seine Lane ab — das ist ein Leck, kein Feature), dann **C**, dann 5.3 (`files` als Feld am Kind
statt als Prosa). Reihenfolge innerhalb der Gruppe: 9.2 zuerst, weil es das einzige davon ist,
das im laufenden Betrieb Ressourcen frisst.

**Zuletzt — der Rückkanal:** **G**, die Inbox, deterministisch abgeleitet wie das Findings-Doc
vorschlägt. Sie steht am Ende und nicht am Anfang, aus einem Grund, den §7.1 und §9.1 zusammen
liefern: zwei ihrer acht Item-Typen sind heute noch nicht vertrauenswürdig (rotes Tier-2 mit
Basisrate 1/15 — Korrektur 2026-08-06, vorher 0/12 —, `mergeLast.status` mit Phantom-Einträgen). Eine Inbox, die am ersten Tag zwei
falsche Items zeigt, wird als Rauschen gelernt — und das ist genau die Krankheit, die sie heilen
soll.

**Nicht in dieser Liste, bewusst:** Auto-Deploy. §8 zeigt, dass der Neustart weniger gefährlich
ist als gedacht (die Audit-Queue überlebt ihn), aber die Frage „was ist der Rückweg, wenn ein
Auto-Deploy etwas Kaputtes live stellt" ist damit **nicht** beantwortet, und der Hauptbrief
stellt sie zu Recht als Vorbedingung. Sie gehört gestellt, wenn A–E gelaufen sind.

---

## §12 Recompute-Block

Alles in §1 kommt hier heraus. Ausführen im **Haupt-Checkout** (`~/claude-fleet`), read-only.

```sh
# Outcome-Register
jq -s length lane-outcomes.jsonl
jq -r '.disposition' lane-outcomes.jsonl | sort | uniq -c
jq -r '[.disposition,(.verified|tostring),(.confirmedByHuman|tostring)]|@tsv' \
  lane-outcomes.jsonl | sort | uniq -c
jq -r 'select(.resolvedConflict==true)|[.ts,.branch,(.resolvedBy//"-"),.repairRounds]|@tsv' \
  lane-outcomes.jsonl

# Tier 2 + Adjudikation (welche Roten sind un-beurteilt?)
jq -r '.result' post-land-audits.jsonl | sort | uniq -c
comm -23 <(jq -r 'select(.result=="red")|.at' post-land-audits.jsonl | sort) \
         <(jq -r '.auditAt' audit-adjudications.jsonl | sort)
jq -r '.verdict' audit-adjudications.jsonl | sort | uniq -c

# Audit-Trail
jq -r '.event' audit.jsonl | sort | uniq -c | sort -rn

# Schritt A, das Drift-Instrument: prüfen Lanes ihren Drift — und wie früh?
# Schwelle §11.2: Anteil "vor dem letzten Drittel" über 20 GELANDETE Lanes. Unter 20 % ist die
# CLAUDE.md-Anweisung als Mechanismus widerlegt und Schritt B wird Pflicht statt Option.
# Join über den BRANCH, nicht die Slot-id (Slots werden recycelt); Lebenszeit aus dem
# Outcome-Register (`ts` = Land, `sessionMs` = Dauer, also Start = ts - sessionMs).
# Liest BEIDE Audit-Generationen — ein Leser nur von audit.jsonl ist rotationsblind und
# meldet nach einer Rotation eine junge statt einer abgeschnittenen Historie.
# Basiswert vor der Einführung (2026-08-06): landed 78, checked 0 — die Frage war unbeantwortbar.
jq -rn --slurpfile o lane-outcomes.jsonl \
       --slurpfile a <(cat audit.jsonl.1 audit.jsonl 2>/dev/null) '
  ($a|map(select(.event=="self_drift"))) as $d
  | ($o|map(select(.disposition=="landed" and .sessionMs>0))
     | map(. as $l
         | ($d|map(select((.detail//"")|startswith($l.branch+" ")))|map(.ts)|min) as $f
         | {checked:($f!=null),
            frac:(if $f==null then null else (($f-($l.ts-$l.sessionMs))/$l.sessionMs) end)}))
  | {landed:length, checked:(map(select(.checked))|length),
     early:(map(select(.frac!=null and .frac<(2/3)))|length)}'

# Queue (der Engpass: gibt es überhaupt eine `queued`-Zeile?)
jq -r '.tasks[]?|[.status,.kind,.source]|@tsv' fleet.json | sort | uniq -c
jq -r '.tasks[]?|select(.analysis)|[.id,.status,.analysis.verdict]|@tsv' fleet.json
grep '"dispatch"' fleet.json

# Steward-Produktion vs. Einreichung
jq -s '[.[]|select(.kind=="rundgang")|.decisions_surfaced]|{n:length,sum:add}' steward-journal.jsonl
jq -r 'select(.event=="steward_task")|.ts' audit.jsonl | while read t; do date -r $((t/1000)) +%F; done | uniq -c

# Deploy-Rhythmus
grep "srv was down, restarted" server.log | sed 's/T.*//' | uniq -c | tail -14

# Phantom-Park (§9.1) — leer ist gesund
jq -r '.mergeParked|keys[]?' fleet.json
```

---

## §13 Verifikationsstand

| Behauptung | Stand |
|---|---|
| Alle Zahlen in §1 | **gerechnet** aus den Ledgern, Kommandos in §12 |
| 12/14 Rote adjudiziert, 0× `real`, 2 Un-adjudizierte namentlich | **gerechnet + gelesen** (beide Output-Tails gelesen) |
| `laneDrift` 5180, ein Abnehmer 7780, kein `audit(`-Aufruf | **gelesen** (Definition, Aufrufstelle, Routenkörper) |
| `otherLanes.files` = nur committete Arbeit | **gelesen** (`server.ts:5152`) **+ live bestätigt** (eigener `/api/self/drift`-Abruf, beide Nachbar-Lanes `files: []`) |
| `refine-confirm` faltet `files` in den Text | **gelesen** (`server.ts:9144-9154`, `2190-2197`, `interface Task`) |
| `mergeParked`-Phantom nach dem Land | **gelesen** (Pfad `1320 → 1330 → 1615 → 3974`) **+ an Live-Zustand belegt** (`fleet.json` vs. Outcome-Zeile) |
| requeueter Dispatch lässt die Lane stehen | **gelesen** (`server.ts:1958-1973`, kein `killSlot` auf dem Pfad) — *nicht* durch einen Live-Fall bestätigt |
| Digest: TTL 2 min / Wait 30 s / Worker 180 s | **gelesen** (vier Konstanten) |
| Digest-Ausfallrate „6 von 7" | **unbelegt** — nicht in den Ledgern, In-Session-Beobachtung des Rundgangs |
| `sinceLastLook` verdrängt statt vermischt | **gelesen** (`server.ts:7187/7191`) — die *Fehlalarm-Instanz* vom 05.08. habe ich nicht reproduziert |
| `transcriptFact`-Kommentar ohne `mtime`-Caveat | **gelesen** |
| Verify-Timeout → `ok:false` | **gelesen** (`server.ts:3871/3878/3883`) + Live-Budget 300 s aus `/api/self/gate` |
| Verify-Kette „~105 s" (Findings-Doc) | **nicht nachgerechnet** — die Outcome-Zeile trägt keine Verify-Dauer; ich habe stattdessen die Tier-2-Dauern (451–528 s) gemessen, die eine andere Kette sind |
| Audit-Queue überlebt einen Neustart | **gelesen** (`4229-4270`, `6549-6577`) — *nicht* durch einen provozierten Neustart bewiesen |
| `stalled`-Klauseln, Notiz-Worktree erfüllt `ahead===0` | **gelesen** + **gemessen** (`rev-list --left-right --count` → `6 0`, sauberer Baum); die Klauseln `alive`/`idle`/`observed` sieht nur der Server — **abgeleitet** |
| `Slot.mission` auf keinem Slot gesetzt | **gemessen** (`fleet.json`) |
| `briefs/stalled-parked-and-ledger.md` beauftragt Teil 1+2 | **gelesen** (`git show main:`, Commit `909ace3`) |
