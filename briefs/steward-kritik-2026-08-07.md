# Der Steward, kritisch — und der Rundgang als Absender

*Owner-Auftrag 2026-08-07 (Queue-Zeile `33673475`), gefahren in Lane `fleet/260807090100-11db`.
Der Groupchat ist ausdrücklich NICHT Teil dieser Zeile (Notiz `efc98cfa`).*

*Zwei Bäume, und die Unterscheidung gehört hierher: **gemessen** wurde gegen `6b8965e`; während der
Lane landete `9940ac3` und schob `server.ts` um 310 Zeilen. **Alle `server.ts`-Zitate unten sind auf
den Baum nach dem Rebase re-anchored** und dort einzeln nachgeschlagen (§8). An den Zahlen ändert das
nichts — `9940ac3` fasst weder den Steward-Pfad noch eine der gelesenen Ledger-Dateien an.*

**Was dieses Dokument ist:** ein Bericht plus eine Entscheidungsvorlage. Kein Diff ist angewendet,
keine Ritualdatei geändert, kein Send abgesetzt. Die Ledger-Zahlen sind **vollständig, nicht
gesampelt** — `audit.jsonl` hat nie rotiert (älteste Zeile 2026-07-21T20:15:59), also deckt jede
Zählung unten die gesamte Lebenszeit des Stewards ab. Was ich *nicht* geprüft habe, steht in §6.

**Ablageort, begründet:** `briefs/`, nicht `docs/`. `docs/README.md:29-41` führt genau zwölf
operative Dokumente und benennt „ein Summary-Doc, das eines der drei restated" ausdrücklich als
*nicht* vierten Ort. Dies hier ist ein datierter Befund zu einem Owner-Auftrag, kein wartungswürdiger
Dauer-Eintrag — dieselbe Klasse wie `briefs/work-waves-2026-08-07.md`. **Konsequenz: eine
`docs/README.md`-Zeile ist NICHT vorzuschlagen** — der Index führt `briefs/` überhaupt nicht, und ein
Eintrag dort wäre gegen seine eigene Regel. Der Auftrag hat einen Index-Vorschlag erwartet; die
belegte Antwort ist, dass keiner hingehört.

---

## 0 · Kurzfassung

1. Der Rundgang lief **88×** und hat in dieser Zeit **0 Zeilen** produziert, die der Owner je auf
   `done` gesetzt hat. Die Inspektion lief an zwei Tagen und hat **5 von 5** Filings auf `done`
   gebracht. Die Trennlinie aus `briefs/work-waves-2026-08-07.md` §4 hält der Messung stand — schärfer
   sogar, als sie dort gezogen ist.
2. **5 der 8 überlebenden Rundgang-Filings diagnostizieren die eigenen Sensoren des Pulses**, nicht
   die Lanes, die er beaufsichtigen soll. Der Kanal verbringt seine Ausgabe überwiegend mit sich selbst.
3. Der Sendeweg funktioniert: **genau ein** echter Send existiert (2026-08-07 08:39, Slot 8), er kam
   an, und die Antwort im vorgeschriebenen `[pulse-reply]`-Format lag **24 Sekunden** später vor.
   **Sie wurde nie gelesen** — kein Code erntet den Marker, `dispositions.jsonl` hat 2 Zeilen, beide
   `worker:"enhance"`.
4. Die gesamte Mess-Apparatur, die das Design-Doc des Pulses als seinen Graduierungspfad benennt
   (`outcomeTally`, `promotionEligible`, `PROMOTION_MIN_N`, `measureOutcomes`, `outcomePending`),
   kommt in `server.ts` **0×** vor — gelöscht am 2026-07-28 in `bef43f6`. Zwei Stellen behaupten sie
   weiterhin.
5. Eine Main-Session ist **mechanisch ein legales Ziel** — und die Faktenschicht ist für sie
   **heute nicht ehrlich**: `+0/-0` ist für jeden Nicht-Lane-Slot eine erfundene Zahl. Das ist eine
   Code-Änderung, also eine andere Zeile.

---

## 1 · Teil 1 — was der Steward tatsächlich produziert hat

### 1.1 Die Zahlen

| Größe | Wert | Quelle |
|---|---|---|
| Rundgang-Pulse | **88** (2026-07-22 00:36 … 2026-08-07 10:53) | `steward-journal.jsonl`, `kind:"rundgang"` |
| davon „alles klar" (`changed:false` **und** 0 Entscheidungen) | **3** = 3 % | dieselbe Datei |
| Entscheidungen, über alle Pulse aufsummiert | **94** | Feld `decisions_surfaced` |
| Inspektion-Pulse | **≥9** (Register-Zeilen in 9 verschiedenen Uhrstunden, 07-29/07-30) | `inspektion-register.jsonl` |
| Steward-Filings insgesamt (auditiert) | **44** | `audit.jsonl`, `event:"steward_task"` |
| davon heute noch in `fleet.json` | **21** — 10 `pending`, 6 `archived`, 5 `done` | `fleet.json` ∩ Audit-IDs |
| davon ersatzlos gelöscht | **23** | dieselbe Differenz |
| `steward_task_dedup` — je gefeuert | **0** | `audit.jsonl` |
| `steward_send` — je gefeuert | **1** | `audit.jsonl` |
| `propose_outcome`-Zeilen | 21 | `steward-journal.jsonl` |

Zwei Zahlen daraus verdienen eine eigene Zeile, weil sie Erwartungen widersprechen, die im Ritual
stehen:

- **Die Ehrlichkeitsschranke greift praktisch nie.** `.claude/commands/rundgang.md:28` nennt „all
  clear" eine vollständige, exzellente Antwort. In 88 Pulsen war sie es **3×**. 60 von 88 Pulsen
  meldeten ≥1 Entscheidung. Das ist kein Beweis für Unehrlichkeit — es kann jede Stunde wirklich
  etwas gegeben haben —, aber es ist die Basisrate, gegen die jeder Auslöser in Teil 2 gerechnet
  werden muss: ein Absender, der an „Sektion 1 ist nicht leer" hängt, sendet in ~68 % aller Stunden.
- **Der `ref`-Dedup, auf dem die stündliche Kadenz begründet ist, hat noch nie gefeuert.**
  `.claude/commands/rundgang.md:38` und `docs/steward.md:118-121` erklären beide, die Server-seitige
  Ein-Live-Proposal-pro-`ref`-Regel sei das, was den stündlichen Puls tragbar macht. Über 44 Filings:
  **0** `steward_task_dedup`. Von den 21 überlebenden Zeilen trägt genau **eine** überhaupt ein
  `ref`-Feld (`94565a55` → `digest-worker-times-out`). Der Mechanismus ist gebaut, korrekt
  (`server.ts:8428-8434`) — und unbenutzt, weil der Steward den `ref` fast nie mitschickt. Was den
  Puls heute vor Duplikaten schützt, ist seine Disziplin, nicht der Server.

### 1.2 Rundgang gegen Inspektion — die Trennlinie hält

Nach Herkunfts-Tag im Text der 21 überlebenden Filings:

| Kanal | Filings | `done` | `archived` | `pending` |
|---|---|---|---|---|
| `[inspektion revier N]` | 5 | **5** | 0 | 0 |
| `[rundgang …]` | 8 | **0** | 6 | 2 |
| sonstige (Owner-Idee weitergereicht, Notiz-Chargen 08-07) | 8 | 0 | 0 | 8 |

Das ist das schärfste Einzelergebnis dieser Messung. Die Inspektion urteilt über **Code** — ein
Befund ist wahr oder nicht, und `.claude/commands/inspektion.md:9` erzwingt `file:line` plus Kosten.
Jedes ihrer fünf Filings ging durch. Der Rundgang urteilt über **Lage** — was jetzt Aufmerksamkeit
verdient — und das ist genau die Frage, deren Antwort dem Owner gehört. Keines seiner acht Filings
wurde je erledigt; sechs wurden weggelegt.

`briefs/work-waves-2026-08-07.md` §4 zieht die Linie als „wo ist das Urteil mechanisch, wo ist es das
des Owners" und leitet daraus vier ableitbare Aufgaben ab. **Die Messung bestätigt die Linie und
verschiebt ihren Ort:** sie liegt nicht zwischen zwei Aufgabenlisten, sondern zwischen den beiden
Pulsen, die es schon gibt.

### 1.3 Der `05320523`-Schaden — was am Ledger zählbar ist und was nicht

Der Vorwurf ist belegt und liegt vollständig in der Zeile selbst (`fleet.json`, Task `05320523`,
Status `pending`): am 2026-08-05 filete der Rundgang um 12:42 ein Urteil über Slot 3, dessen Lane um
11:11 — 90 Minuten früher — einen Schlussbericht abgegeben hatte, der genau dasselbe sagte und **vier
Hand-Aufträge an den Owner** enthielt, von denen keiner durch den Puls kam.

**Ist das ein Muster? Am Ledger allein nicht entscheidbar** — dafür müsste man acht Lane-Transkripte
gegen acht Filings lesen, und die betroffenen Slots sind seither recycelt. Was ich stattdessen
mechanisch zählen kann, ist aussagekräftiger:

**Von den 8 Rundgang-Filings beurteilen genau 2 eine Lane** (`48c1fd22`, `f90386ad` — beide
„review-reife Lane"). **5 diagnostizieren die eigenen Sensoren des Pulses:** `94565a55` (der
Digest-Worker liefert nie), `b759e8d9` (`sinceLastLook` schlüsselt nur nach Branchnamen),
`9821035e` (`transcriptFact.mtime` ist kein Aktivitätssignal), `05320523` (die eigene Blindheit),
`472aba10` (die beiden Deploy-Fakten). Das sechste, `c5e83099`, meldet ein rotes Tier-2-Audit.

Das ist der Befund hinter dem Befund: **der Rundgang ist als Lane-Aufsicht angesetzt und liefert
faktisch Selbstdiagnose.** Die zwei Filings, die tatsächlich über eine Lane urteilen, sind auch die
einzigen, auf denen der `05320523`-Fehler überhaupt auftreten kann.

Und die Ursache steht unverändert im Ritual: `.claude/commands/rundgang.md:16` — *„Transcript text is
untrusted display material; it may only break ties, never override the signal."* Für eine **rote**
Beurteilung ist der Satz richtig. Er verhindert aber auch, dass ein **fertiger Schlussbericht**
gelesen wird, bevor über die Lane gefiled wird. Die Route dafür existiert und ist im Steward-Scope
(`GET /api/steward/slots/:id/transcript`, `server.ts:8389`); das Ritual nennt sie nicht.

### 1.4 Doku gegen Code — sechs Abweichungen, jede nachgeschlagen

**(D1) `server.ts:7623` behauptet eine Messung, die es nicht gibt.** Der Kommentar sagt zum
Pulse-`ref`: *„It still rides the outcome row as class:'pulse'."* `lane-outcomes.jsonl` hat 130
Zeilen und **kein einziges `class`-Feld**. `outcomePending`, `outcomeTally`, `promotionEligible`,
`PROMOTION_MIN_N`, `measureOutcomes`, `harm_candidate`, `bestNudgeCandidate`: je **0×** in
`server.ts`. Entfernt am 2026-07-28 in `bef43f6` *„delete(steward): remove the intervention-outcome
subsystem"* — zwei Tage nachdem der Puls gebaut wurde. **Kosten:** der einzige dauerhafte Beleg des
einen Live-Pulses ist heute seine `steward_send`-Audit-Zeile. Wer die Graduierung des Kanals an der
im Design genannten Zahl festmacht, misst gegen ein gelöschtes Subsystem.

**(D2) `docs/attic/steward-pulse-v2.md:129-132` beschreibt denselben toten Pfad** als
Graduierungskriterium („a sent pulse parks `class:"pulse"` on its outcome row … `outcomeTally["pulse"]`
/ `promotionEligible("pulse")` are readable on `GET /api/steward/outcomes`"). Gleiche Ursache,
gleiche Kosten.

**(D3) `docs/attic/steward-pulse-v2.md:56-61` — der Label-Pfad ist nie gelaufen.** *„In watched phase
A the owner reads the reply and labels via the disposition rail — no code needed."*
`dispositions.jsonl` enthält **2 Zeilen, beide `worker:"enhance"`**, null aus einem Puls. Die eine
existierende `[pulse-reply]`-Antwort ist unetikettiert. **Kosten:** Phase A produziert per
Konstruktion die Daten nicht, die sie laut eigenem Doc produzieren soll — sie kann nicht graduieren
und nicht scheitern, sie kann nur laufen.

**(D4) `docs/steward.md:145` — „two Inspektion pulses have run" ist veraltet.** Das Register trägt 26
Zeilen in **9 verschiedenen Uhrstunden** über zwei Tage (Verdikte: 9 `filed`, 9 `refuted`, 6
`kandidat`, 2 `observation`). Zwei Pulse können keine Zeilen in neun Stunden schreiben. **Kosten:**
der Absatz existiert laut eigener Überschrift, damit „this section stays honest" — und untertreibt
die Bilanz des einzigen Kanals, der nachweislich funktioniert.

**(D5) `docs/steward.md:134-138` — das Journal-Register ist gebaut und nie benutzt worden.** Der
Absatz sagt, seit 2026-08-05 lebe das Inspektions-Register im Steward-Journal statt als Datei. Die 26
`kind:"inspektion"`-Zeilen im Journal sind **identisch zur Alt-Datei** (`(key, verdict)`-Mengen
gleich, verifiziert) und tragen deren Original-Zeitstempel — also eingespielt, nicht über die Route
geschrieben, die ihr `ts` selbst stempelt. Zusätzlich: von 88 `steward_journal`-Audit-Zeilen tragen
**0** ein `inspektion:`-Detail, obwohl `server.ts:7741` genau das schreibt. **Letzte Inspektions-
Aktivität irgendeiner Art: 2026-07-30.** Der Kanal mit 5/5 Trefferquote steht seit acht Tagen still.

**(D6) Die `unbekannt`-Regel gilt nicht für Nicht-Lane-Ziele.**
`docs/attic/steward-pulse-v2.md:88`: *„Every unknown renders `unbekannt` — never a 0, never a guess."*
`server.ts:7553` wiederholt sie eine Region über der Render-Stelle. Aber `briefPayload` setzt im
Nicht-Lane-Zweig `ahead: 0, behind: 0` **hart** (`server.ts:1305`, Kommentar: *„non-lane: the client
uses the upstream-based gitInfo instead"*), und `server.ts:7549` rendert genau diese Felder in die
DATA-Zeile. **Für jeden Slot ohne Worktree steht dort immer `+0/-0`** — eine erfundene Zahl, nicht
ein `unbekannt`. Kostet heute nichts, weil noch nie an einen Nicht-Lane-Slot gepulst wurde. Es ist
exakt die Zielklasse, die dieser Auftrag hinzufügen will (→ §2, E2).

---

## 2 · Teil 2 — der Rundgang als Absender: vier Entscheidungen

### Der Sendeweg, wie er heute mechanisch ist

`POST /api/steward/send` → `handleStewardSend` (`server.ts:7604-7692`). Vier Arten; freier Text wird
mit 400 abgewiesen (`:7606`). Die Reihenfolge der Tore ist gepinnter Kontrakt (`:7627-7635`):
400 ungültig → 409 `awaiting:"owner"` (`:7643`) → 409 Kill-Switch / Quiet Hours (`:7645-7649`) →
429 Stundencap (`:7653`) → 429 Episoden-Cap (`:7657-7663`) → frisches `canDeliver` mit
claude-alive + 60 s Idle unmittelbar vor dem Paste (`:7672`) → `sendText(s, text, true)` (`:7681`).

**Ein Tor, das für einen stündlichen Absender inert ist:** `STEWARD_EPISODE_MS` = 10 Minuten
(`server.ts:570`). Ein stündlicher Puls liegt *immer* außerhalb dieses Fensters — der
Episoden-Cap kann für den Rundgang nie feuern. Wer ihn als „1 pro Slot pro Arbeitsepisode" in die
Rechnung nimmt, rechnet mit einer Bremse, die diesen Anrufer nicht berührt. Real bindet nur der
Stundencap von 10.

### E1 · Welche Aktionsklasse wird promotet?

**Empfehlung: ausschließlich `kind:"pulse"`.** Die anderen drei sind nicht bloß lane-förmig — sie
sind für eine Main-Session mechanisch falsch:

- `continue_nudge` rendert `"[steward] Mach weiter. Verifiziere dein Ergebnis…"` (`server.ts:7534`) —
  eine **Anweisung ohne Fakten**. Sie behauptet, es gebe etwas fortzusetzen. Genau das verbietet
  `docs/attic/steward-nudge.md` §3: eine Nachricht, die eine Behauptung trägt, verliert die
  Eigenschaft „harmlos, wenn nichts los ist" — *„told it was shallow, it digs deeper whether or not
  that was needed"*. Falschpositive sind dann nicht mehr gratis, und genau darauf ruht die Erlaubnis,
  unbeaufsichtigt zu senden.
- `lifecycle_op:commit` verlangt `gitInfo.dirty > 0` (`server.ts:7564`). Vier Slots (2, 5, 6, 13)
  teilen sich heute `cwd = ~/claude-fleet`. `dirty` ist der **geteilte** Working Tree — „committe
  deine Arbeit" könnte die Dateien einer anderen Session meinen. Falsches Subjekt.
- `lifecycle_op:verify` und `state_relay` verlangen ein Merge-Verdict auf dem Slot
  (`server.ts:7577-7595`). Eine Main-Session landet nicht als Lane; beide antworten 400.

**Gegenposition, ernst gemeint:** `continue_nudge` ist das Billigste, was man ausliefern kann — kein
DATA-Block, also kein einziger der Faktenfehler aus D6/E2. Wenn der Owner nur „stups die Session an,
die still geworden ist" will, ist es eine Zeile und sofort korrekt. **Kosten:** man tauscht die
Sicherheitseigenschaft gegen Liefergeschwindigkeit — und tut es ausgerechnet an dem Kanal, dessen
Empfänger die eigene Kommandozentrale ist. **Was es nicht löst:** die paste-Gefahr (E4) ist identisch.

### E2 · Ist eine Main-Session ein legales Ziel?

**Mechanisch: ja.** `handleStewardSend` prüft nur `s.cwd` (`server.ts:7626`); weder dort noch in
`renderStewardMessage` gibt es eine `worktree`-Bedingung. `briefPayload` liefert für einen
Nicht-Lane-Slot einen gültigen Payload, sobald der cwd ein Git-Repo ist (`server.ts:1283-1307`) — die
`no facts → no pulse`-Schranke (`:7540`) greift also nicht. Ein Pulse an Slot 2 ginge heute durch.

**Aber die Faktenschicht ist für diese Zielklasse nicht ehrlich — drei Punkte, zwei davon Defekte:**

1. **`+0/-0` ist erfunden** (D6 oben: `server.ts:1305` gegen `:7549` gegen `:7553`). Der Empfänger
   soll die Frage „kritisch prüfen" — gegen einen DATA-Block, der eine Zahl behauptet, die nie
   gemessen wurde.
2. **Die Commit-Subjects können das Subjekt wechseln.** Im Nicht-Lane-Zweig kommen sie aus
   `sessionCommits` = `git log --since=<sessionStart>` auf dem cwd (`server.ts:1068-1073`). Bei vier
   Sessions im selben Checkout schreibt die DATA-Zeile einer Session die Commits einer anderen zu.
   Der Puls verweigert genau diesen Subjektwechsel ausdrücklich für das Zitat (`server.ts:7496-7501`:
   *„a fact that silently swaps subject is worse than no fact"*) und für `transcriptFact`
   (`:7815-7818`) — `briefPayload` hat diese Schranke nicht.
3. **Das Zustandsvokabular des Rituals ist für Main-Sessions leer.** `doneLooking` und `stalled`
   sind per Konstruktion lane-only (`server.ts:7851`, `:7864` — beide `!!s.worktree && s.label !==
   STEWARD_LABEL`). `.claude/commands/rundgang.md:16` verlangt, dass der Puls je Lane eine
   *deterministische* Bedingung zuweist. Für eine Main-Session gibt es keine. Übrig bleiben `idleMs`,
   `alive`, `git`, `mission`, `transcriptFact` — genug für eine Frage, zu wenig für ein Urteil.

**Empfehlung: heute nein, nach zwei kleinen Code-Änderungen ja — und die gehören in die BAU-Zeile,
nicht hierher.** (1) und (2) sind zusammen ~5 Zeilen: bei `!p.laneScoped` `unbekannt` statt `+0/-0`
rendern, und die Subjects weglassen, wenn mehr als ein aktiver Slot denselben cwd hält. (3) ist keine
Code- sondern eine Doktrinfrage und wird durch E3 beantwortet: eine Frage braucht kein Urteil.

**Gegenposition:** so ausliefern und `+0/-0` hinnehmen — es ist eine Zeile in einem Datenblock, den
der Empfänger ohnehin gegen seine eigene Lage prüfen soll. **Kosten:** die einzige Rechtfertigung
dafür, dass dieser Kanal unbeaufsichtigt laufen darf, ist, dass der Steward niemals eine Tatsache
behauptet, sondern nur nach einer fragt (`server.ts:7471-7474`). Eine hart kodierte 0 ist eine
behauptete Tatsache. Man gibt die Eigenschaft auf, um zwei Tage früher zu senden.

### E3 · Was ist der Auslöser?

Die Basisrate aus §1.1 macht die naheliegende Regel unbrauchbar: „Sektion 1 ist nicht leer" traf in
**60 von 88** Pulsen zu. Ein daran gekoppelter Absender schriebe in ~68 % aller Stunden in eine Pane.

**Empfohlene Bedingung — vier Klauseln, alle nachprüfbar, drei davon serverseitig schon erzwungen:**

> Der Rundgang sendet **höchstens einen** Pulse pro Durchgang, fleetweit, und nur wenn **alle vier**
> gelten:
> 1. Der Ziel-Slot ist in **Sektion 1 dieses Pulses** — der Puls würde ohnehin eine Entscheidung über
>    genau diesen Slot vorlegen. (Ritual-seitig, nicht serverseitig prüfbar.)
> 2. Die Frage ist aus den Fakten ableitbar, die der Puls ohnehin gelesen hat, und **enthält keine
>    Diagnose** — sie fragt nach einem Zustand, den der Puls nicht sehen kann.
> 3. Der Puls hat **im vorangegangenen Durchgang nicht an denselben Slot** gesendet. (Muss ins
>    Ritual, weil der 10-Minuten-Episoden-Cap für einen stündlichen Anrufer inert ist — s. o.)
> 4. Alles Übrige bleibt beim Server: `awaiting:"owner"` → 409, Kill-Switch/Quiet Hours → 409,
>    claude-alive + 60 s Idle frisch vor dem Paste. **Das Ritual wiederholt diese Zahlen nicht** —
>    es verweist auf sie. (Ein zweiter Ort für dieselbe Konstante ist ein zweiter Ort zum Verrotten.)

Klausel 1 bindet die Sende- an die Filing-Rate — und die ist gemessen niedrig (8 überlebende Filings
in 88 Pulsen). Klausel 3 ist die einzige, die neu ist, und sie ist die wichtige.

**Gegenposition:** auf `stalled` triggern — es ist das eigene Wort der Flotte für „diese Lane hat
aufgehört". **Kosten:** `stalled` ist lane-only (`server.ts:7864`), feuert für Main-Sessions also
**nie** — genau die Zielklasse, um die der Owner gebeten hat. Und `.claude/commands/rundgang.md:16`
sagt wörtlich, `stalled` sei *„a fact to REPORT, never a licence to act"*; es zum Auslöser zu machen
kehrt den Satz um, statt ihn zu ändern. **Was es nicht löst:** einen still gewordenen Main-Slot
erkennt es überhaupt nicht.

### E4 · Wie wird die paste-Gefahr entschärft?

**Der Mechanismus, nachgelesen statt zitiert** (`server.ts:1850-1873`): `load-buffer` →
`paste-buffer -p -d` → `Bun.sleep(150)` → `send-keys Enter`. Die Eingabezeile wird nicht geleert.
Steht ein ungesendeter Entwurf im Composer, gehen Entwurf und Pulse als **ein** Prompt ab.
`.claude/commands/rundgang.md:42` und `docs/steward.md:143` sagen beide: *„Nothing guards this today."*

**Eine Präzisierung, die die Optionen verschiebt:** teilweise *ist* etwas gewacht. `canDeliver`
verlangt 60 s ohne Pane-Ausgabe (`server.ts:7672`, `:2004`), und `s.lastOutput` wird gestempelt,
sobald die Pipe-Datei der Pane wächst (`server.ts:2655-2667`). Tippen malt Zeichen in die Pane, also
hält aktives Tippen den Slot nicht-idle und der Send bekommt 409. **Der gefährliche Fall ist nicht
der tippende Owner, sondern der liegengelassene Entwurf** — vor zehn Minuten geschrieben, Pane
seither still. Genau die Lage, die der Owner am 2026-08-07 in mehreren Composern vorfand. *(Dass
Tastatureingabe die Pane-Datei wachsen lässt, ist aus dem Poll-Pfad abgeleitet, nicht von mir
gemessen — s. §6.)*

| Option | Kosten | Was sie NICHT löst |
|---|---|---|
| **(a) Keine Main-Ziele** | Erfüllt den Auftrag nicht. | Die Gefahr bleibt für den Steward-Slot selbst — dort brieft der Owner (`docs/steward.md:140-143`), dort feuert der Puls in seine eigene Pane. |
| **(b) Nur bei nachweislich leerem Composer** | Verlangt Pane-Parsing — genau das, was der Puls für seine Fakten ausdrücklich ablehnt (`server.ts:7496-7497`: Transkript statt Capture, „which repaints and drifts"). | Die Race bleibt: zwischen Prüfung und `Enter` liegen mindestens die 150 ms aus `sendText:1866`. |
| **(c) `submit:false` für Nicht-Lane-Ziele** ⭐ | `sendText` nimmt den Schalter bereits (`server.ts:1850`); `handleStewardSend:7417` übergibt hart `true`. Änderung: ~1 Zeile. Der Text landet im Composer, **ohne** Enter — die Verschmelzung wird sichtbar und der Mensch löst sie auf. Preis: für dieses Ziel ist der Kanal nicht mehr unbeaufsichtigt, die Antwort kommt erst, wenn jemand hinsieht. | Der Entwurf wird trotzdem verändert (der Text hängt sich an, evtl. mitten im Wort). Es macht aus stiller Zerstörung eine sichtbare Unordnung — nicht aus Unordnung nichts. |
| **(d) Owner nimmt das Risiko** | Null Arbeit. | Der Schaden ist unbegrenzt: was abgeschickt wird, hängt daran, was im Entwurf stand — und Main-Panes sind die mit der meisten Autorität. |

**Empfehlung: (c), und bis sie gebaut ist, (a).** Sie ist billig, sie passt zum Empfänger — eine
Main-Session ist der Sitzplatz des Owners, nicht ein unbeaufsichtigter Arbeiter —, und sie ist die
einzige Option, die die Gefahr an der Wurzel packt, statt sie zu erkennen. Der genaue Schnitt
(„Nicht-Lane" gegen „nicht `⚙ steward`" gegen „owner-belegt") gehört in die Bau-Zeile.

---

## 3 · Diff-Vorschlag für `.claude/commands/rundgang.md` — NICHT angewendet

Zwei Eingriffe. Beide setzen voraus, dass E2s Code-Fix vorher gelandet ist.

**(1) Zeile 44 ersetzen.** Heute:

> `Discipline: attend unprompted; act only through the ladder. Anything you want to nudge, commit, or land is a decision for section 1, not an action to take — this pulse and every pulse, until an action-class is explicitly promoted up the ladder.`

Vorschlag:

> `Discipline: attend unprompted; act only through the ladder. **Genau eine Aktionsklasse ist promotet (Owner, 2026-08-07): ein `kind:"pulse"` — eine Frage, nie eine Diagnose, nach den Regeln des Abschnitts oben.** Alles andere, was du anstoßen, committen oder landen willst, bleibt eine Entscheidung für Sektion 1 und keine Handlung — diesen Puls und jeden Puls.`

**(2) Neuer Abschnitt, direkt nach Zeile 42 (dem Hazard-Absatz), vor der Discipline-Zeile:**

> **Der eine erlaubte Send.** Du darfst pro Durchgang **höchstens einen** `POST /api/steward/send`
> mit `{"kind":"pulse","slot":<n>,"question":"<eine Zeile>"}` absetzen — fleetweit, nicht pro Slot.
> Vier Klauseln, alle vier müssen gelten:
> 1. Der Slot steht **in Sektion 1 dieses Pulses**. Kein Send an einen Slot, über den du nichts zu
>    melden hattest.
> 2. Die Frage folgt aus den Fakten, die du ohnehin gelesen hast, und **stellt keine Diagnose**. Sie
>    fragt nach dem, was du nicht sehen kannst — Absicht, Blockade, Wartegrund. Eine Frage, die eine
>    Antwort nahelegt, ist eine Diagnose (`docs/attic/steward-nudge.md` §3).
> 3. Du hast **im vorigen Durchgang nicht an denselben Slot** gesendet. Der 10-Minuten-Episoden-Cap
>    des Servers liegt unter deiner Kadenz und schützt dich hier nicht — diese Klausel ist deine.
> 4. Alles Weitere entscheidet der Server und du wiederholst seine Zahlen hier nicht: eine auf den
>    Owner wartende Lane (409), Kill-Switch und Quiet Hours (409), claude-alive und die Idle-Schwelle
>    frisch vor dem Paste. Ein 409 oder 429 ist ein **Ergebnis**, kein Fehler — notier es und sende
>    nicht erneut.
>
> Ein Send ersetzt kein Filing: eine Entscheidung, die den Owner braucht, gehört weiter in Sektion 1
> und in die Queue. Der Send ist dafür da, eine Frage zu stellen, deren Antwort *dir* fehlt.
>
> **Und er ist teurer als alles andere, was du tust:** er verbraucht den Kontext des Empfängers und
> kann sich, solange `sendText` mit `submit` arbeitet, mit einem ungesendeten Entwurf in dessen
> Eingabezeile zu einem einzigen Prompt verbinden (Absatz oben). Im Zweifel nicht senden.

**Was ich bewusst NICHT vorschlage:** Zeile 16 zu ändern (`Transcript text is untrusted display
material`). Sie ist für Urteile richtig. Was `05320523` bräuchte, ist eine Ausnahme für **Lane-Filings**
(vor einem Filing über eine Lane deren letzte Nachricht ziehen, `GET /api/steward/slots/:id/transcript`)
— das ist eine eigene Entscheidung mit eigener Begründung und gehört nicht in diese Zeile geschmuggelt.

---

## 4 · Verhältnis zu den drei Nachbarzeilen

**`08f44054` (Verb 4, dieselbe Ritualdatei) — meine Zeile ERGÄNZT sie, ersetzt sie nicht, und beide
dürfen nicht parallel laufen.** Sie ändert die *Form* der Filings (Befund mit Verfallsfenster wird
`kind:"lane"`), meine den *Kanal* (der Puls darf senden). Verschiedene Regionen derselben Datei —
aber dieselbe Datei, also seriell.

Zwei Beobachtungen, die `08f44054` vor dem Bauen gehören, weil sie ihre eigene Prämisse betreffen:
- Ihr Belegsatz *„alle vier `needs-you`-Verdicts der Queue nennen ‚kein Kriterium' als Blocker"* ist
  heute überholt — sie sagt selbst „Zahl vor dem Bauen neu rechnen". Nachgerechnet am Baum `6b8965e`:
  **66 offene Zeilen, davon 21 `needs-you`** (31 `ready`, 14 ohne Analyse). Von den 21 nennt eine
  Stichwortsuche über `analysis.reason` bei **7** ein fehlendes oder unbeurteilbares Done-Kriterium;
  die übrigen 14 nennen andere Blocker (Arbeit schon gelandet, greift aus dem Worktree heraus, offene
  Owner-Frage). Aus „4 von 4" ist „7 von 21" geworden.
- Ihr DONE ist eine 20-Puls-Live-Messung — eine Lane kann das nicht abschließen. `briefs/work-waves-2026-08-07.md`
  §4 sagt dazu bereits: *„null Lane-Claims bisher; (1)–(4) beantworten dieselbe Frage billiger als 20
  Pulse."* Meine Messung stützt das: 44 Filings, **0** mit `kind:"lane"` (alle 21 überlebenden sind
  `note`).

**`00e5f771` (die fehlende Benachrichtigung)** ist die Gegenrichtung und bleibt getrennt: sie fragt,
wie die Maschine *meldet, dass etwas fertig ist*; meine fragt, wie der Steward *fragt, was los ist*.
Berührungspunkt: ihr Empfänger (B) — eine treibende Main-Session — ist mein Ziel, und beide würden
über `sendText` in dieselbe Pane schreiben. **Was auch immer E4 entscheidet, gilt für beide.**

**`efc98cfa` (Groupchat)** hängt an der Ernte: ohne Leser für `[pulse-reply]` gibt es keinen zweiten
Gesprächszug. Meine Messung liefert ihr den fehlenden Beleg — die eine existierende Antwort ist
vollständig, formatkonform, 24 s alt gewesen und **nie gelesen worden**.

---

## 5 · Der eine Live-Beweis

Der einzige Send der Geschichte, vollständig rekonstruiert (Audit-Zeile + Transkript
`~/.claude/projects/…-private-repo-a-worktrees-fleet-260804144705-6c1e/c446cd74….jsonl`):

- **08:39:57** — `steward_send`, Slot 8, `pulse:pulse`. Ziel war eine **Lane in einem anderen Repo**
  (`private-repo-a`), idle seit 14 299 s, 573 KB Transkript.
- **08:39:58** — angekommen. DATA-Block korrekt (`+0/-3`, Lane-Zweig), Frage einzeilig.
- **08:40:22** — Antwort, exakt im vorgeschriebenen Format:
  `[pulse-reply] hilfreich | bestätigt, dass die Research fertig und die zwei Dateien noch
  uncommittet sind — ich warte auf die Spur-Entscheidung des Users.`

**Drei Schlüsse daraus, und der dritte ist unangenehm:**
1. Der Mechanismus trägt. 24 Sekunden von Frage zu formatkonformer Antwort, ohne Nachhilfe.
2. Die Frage war nützlich — der Empfänger sagt es selbst, und der Zustand („wartet auf eine
   Entscheidung des Users") war für den Puls von außen unsichtbar. Das ist der Anwendungsfall.
3. **Der Empfänger hat gehandelt, nicht nur geantwortet:** *„Ich committe das jetzt."* Der Pulse war
   als reine Frage gebaut und trug keinen `STEWARD_VERIFY_SUFFIX` (`server.ts:7486`) — trotzdem löste
   die Nachfrage nach den uncommitteten Dateien einen Commit aus, um den niemand gebeten hatte. Hier
   war das harmlos und vermutlich richtig. Es zeigt aber, dass „nur eine Frage" **nicht
   handlungsneutral** ist, und das ist die Annahme, auf der `docs/attic/steward-nudge.md` §3 die
   Erlaubnis zum unbeaufsichtigten Senden gründet. Für ein Ziel mit mehr Autorität als eine Lane —
   also für eine Main-Session — gehört diese Beobachtung in die Risikorechnung.

---

## 6 · Was ich NICHT geprüft habe

- **Ob `05320523` ein Muster ist**, im Sinne von „wie oft hat der Rundgang über eine Lane geurteilt,
  ohne ihren Bericht zu lesen". Das verlangt acht Lane-Transkripte gegen acht Filings; die Slots sind
  recycelt. Ich habe stattdessen gezählt, worüber die Filings überhaupt urteilen (§1.3) — das ist
  eine andere, schwächere Aussage.
- **Ob Tastatureingabe die Pane-Datei wachsen lässt** und damit `lastOutput` stempelt. Der Pfad ist
  gelesen (`server.ts:2655-2667`), der Schluss ist abgeleitet, nicht gemessen. Er trägt eine
  Nebenaussage in E4 („aktives Tippen führt zu 409"), nicht die Empfehlung.
- **Die Route live** — kein `GET /api/steward/digest`, kein `POST /api/steward/send`, kein Anstupsen
  von Slot 12. Alles hier stammt aus Code, Ledgern auf Platte und Transkripten.
- **Ob die 23 gelöschten Filings gut oder schlecht waren.** Sie sind aus `fleet.json` verschwunden;
  nur ihre Audit-Zeile bleibt, und die trägt keinen Text. Die 5/8-Bilanz aus §1.2 gilt für die 21
  überlebenden, nicht für alle 44.
- **`docs/attic/steward-autonomy.md` (die Leiter) und `docs/attic/steward-overview.md`** habe ich für
  diesen Bericht nicht vollständig gelesen — die Leiter zitiere ich nur, wo `rundgang.md:1` und
  `inspektion.md:1` sie selbst zitieren.
- **Keine Suite gelaufen** (kein Code angefasst) und **kein `bunx tsc`** — der Output ist ein Dokument.

---

## 7 · Vorgeschlagenes Done-Kriterium für den anschließenden BAU

Abgelegt per `POST /api/self/criterion`. Der Bau ist bewusst in **zwei** Zeilen geschnitten, weil die
erste Code und die zweite nur Text ist — und die zweite ohne die erste unehrlich wäre.

**BAU-A (Code, `server.ts`, e2e):** *Ein Pulse an einen Nicht-Lane-Slot behauptet keine Zahl mehr und
kann keinen fremden Entwurf abschicken.* Drei prüfbare Teile: (1) bei `!p.laneScoped` rendert die
`branch/commits`-Zeile `unbekannt` statt `+0/-0`; (2) teilen sich mehrere aktive Slots einen cwd,
entfallen die Commit-Subjects für diesen Slot; (3) `handleStewardSend` übergibt `submit:false` für
Ziele ohne Worktree. **VERIFIKATION:** je ein neuer Check in `e2e/steward-outcomes.ts` neben dem
bestehenden Scaffold-Check (`:294-302`), plus die volle Verify-Zeile aus `CLAUDE.md`; Nachweis ist
`ALL PASS` am Ende von `./e2e-isolated.sh` und die zitierte Ausgabe der drei Gate-Suiten.

**BAU-B (Ritual, `.claude/commands/rundgang.md`):** die zwei Eingriffe aus §3 angewendet, wörtlich
wie dort vorgeschlagen, nachdem der Owner sie bestätigt hat. **VERIFIKATION:** keine Suite (Textdatei)
— Nachweis ist ein Diff, der genau diese zwei Regionen berührt, und dass die vier Klauseln keine
Server-Konstante duplizieren (`grep -n '60\|600\|10' auf den neuen Abschnitt` muss leer sein für
Zahlen, die `server.ts` schon führt).

**Ausdrücklich nicht Teil des Baus:** die Ernte von `[pulse-reply]` (das ist der zweite Schritt in
`efc98cfa`s Reihenfolge), eine Änderung an `rundgang.md:16`, und die Wiederbelebung des in `bef43f6`
gelöschten Outcome-Subsystems.

---

## 8 · Zitat-Gegenprüfung

Zwei Durchgänge, und der zweite ist der Grund, warum dieser Abschnitt nicht kosmetisch ist.

**Durchgang 1, am Mess-Baum `6b8965e`:** jede zitierte Stelle mit `sed -n '<n>p'` gegen das erwartete
Muster geprüft — 25 `server.ts`-Anker, 15 Doc-/Command-/e2e-Anker. **Zwei eigene Fehler dabei
gefunden und korrigiert:** `STEWARD_EPISODE_MS` steht auf Zeile 570, nicht 7570 (die Ziffer, die
E3s ganzes Argument trägt); die Transcript-Route stand als Bereich `8120-8128` statt auf ihrer Zeile.

**Durchgang 2, nach dem Rebase:** während dieser Lane landete `9940ac3` und fügte `server.ts` 310
Zeilen hinzu — im Steward-Bereich eine Verschiebung um **+264**. Damit waren *alle* 7xxx-Zitate
still falsch geworden: sie zeigten weiter auf existierende, aber andere Zeilen. Genau die Verfallsform,
die der Steward selbst als Zeile `b8716d0e` filet. Also rebased, jeden Anker einzeln neu aufgelöst
(nicht per Blanko-Offset) und ersetzt; dabei fiel ein Zitat auf, das die erste Ersetzungsrunde nicht
traf (`7232-7233`). Anschließend wurde **jede** `server.ts:<n>`-Referenz des Dokuments maschinell
gegen den Baum aufgelöst und ihre Zeile ausgedruckt — 23 volle Zitate plus 14 Kurzformen, alle
treffen.

**Die Lehre, die über dieses Dokument hinausgeht:** ein Zeilen-Zitat ist nur so lange wahr, wie der
Baum stillsteht. Ein Bericht, der Zeilennummern führt und länger als ein Land lebt, braucht diesen
zweiten Durchgang — sonst liest er sich unverändert souverän und zeigt ins Leere.

Die Ledger-Zahlen stammen aus `~/claude-fleet/{audit,steward-journal,lane-outcomes,dispositions,
inspektion-register}.jsonl` und `fleet.json` — gelesen, nie geschrieben, und von `9940ac3` nicht
berührt.
