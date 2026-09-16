---
frage: Welcher der fuenf Hausputz-Akte vom Sweep 2026-09-16 darf mechanisch werden und welcher bleibt ein benannter Vorschlag an einen Menschen?
urteil: Zwei mechanisch (Orphan-Sweep, Master-Stop vor dem Kartensweep), einer halb (Deploy-Alarm ja, Deploy nein), zwei bleiben Vorschlag (Attention-Schluss, Pane-Modell); die Deploy-Invariante wird bestaetigt und bekommt einen zweiten, staerkeren Grund
bereich: [automation, hausputz, deploy, invarianten]
belege: [server.ts#laneAutoCloseRefusal, server.ts#removeWorktreeSafe, server.ts#worktreeRisk, server.ts#tickCardSweep, server.ts#judgeDeploy, server.ts#raiseAttention, server/types.ts#AttentionRequest, docs/work-register-2026-08-06.md]
nicht-gemessen: Ob ein codex- oder pi-Rollout einen NACHTRAEGLICHEN Modellwechsel in der Pane festhaelt (nur die Spawn-Zeit ist belegt), und wie oft die fuenf Akte anfallen — jede Entscheidung hier ist eine Vertrags-, keine Haeufigkeitsentscheidung
stand: 2026-09-16
---

# Fuenf Hausputz-Akte: mechanisch oder Vorschlag?

2026-09-16, Lane `fleet/260916124646-d1d6` auf `05fc16b0`. Anlass ist die Owner-Richtung
„sowas muss am ende alles automatisch gehen" nach einem Sweep, in dem die Orchestratorin alle
fuenf Befunde von Hand gefunden hat. Frage: **welcher Akt darf ein Knopf oder ein Tick werden,
welcher bleibt ein benannter Vorschlag an einen Menschen — je mit einer positiv beweisbaren
Sicherheitsbedingung?**

Die Form, an der sich jede Antwort misst, steht schon im Baum: `server.ts#laneAutoCloseRefusal`
beweist JEDEN Grund positiv, gibt benannte Ablehnungen zurueck und erreicht `null` auf genau
einem Pfad. „Unbekannt" ist dort nie Erlaubnis. Ein mechanischer Akt, der das nicht kann, ist
hier kein mechanischer Akt.

## Ergebnis

| # | Akt | Entscheidung | Beruehrte Invariante |
|---|---|---|---|
| 1 | Deploy-Gap (11 Commits, `codeBehind:true`, ~4 h unbemerkt) | **Vorschlag** fuer den Deploy · **mechanisch** fuer den Alarm | CLAUDE.md §Deploy, ausdruecklich BESTAETIGT |
| 2 | `.env`-Kill-Switch `FLEET_CARD_MS='0'` war gesetzt und nicht live | **mechanisch** — aber als Master-Stop, nicht als Env-Hot-Reload | keine; `autosOn` bekommt einen dritten Leser |
| 3 | Vier verwaiste Worktrees ohne Slot | **mechanisch** | keine — der Sicherheitspruefer steht schon |
| 4 | Reparierte Attention stand offen | **Vorschlag** fuer den Schluss · **mechanisch** fuer die Tatsache daneben | `AttentionRequest.answer.by: "owner"` — der Typ verweigert |
| 5 | Slot-Datensatz vs. Pane (`/model` schreibt den Datensatz nicht) | **Vorschlag** | die gepinnte Trennung Faktschicht/Policy (`e2e/pins.ts` „agentInfo unconditional + aliveInfo gated") |

### Akt 1 · Deploy-Gap — der Alarm wird mechanisch, der Deploy nicht

Die Invariante, woertlich und ungeaendert: „**Kein Tick, kein Auto, kein Dispatch-Pfad ruft es
auf** — jeder Zug ist ein Owner-/Session-Entscheid" (`rulebook/deploy.md`, §Deploy, Verb 2). Sie
wird hier **bestaetigt**, nicht aufgehoben.

Der im Regelbuch stehende Grund gilt und ist am Code nachgelesen: der Deploy toetet den Prozess,
der ihn ausfuehrt; das Verdikt schreibt erst der naechste Boot (`server.ts#resolveDeployMarker`
ruft `judgeDeploy(m, "boot")`), und dreiwertig — `ok:null` heisst „nicht feststellbar" und ist nie
ein Pass.

Dazu ein **zweiter Grund, der im Regelbuch nicht steht und schwerer wiegt**: ein Deploy setzt die
Idle-Uhr JEDER Pane auf null (Boot-Rehydrierung stempelt `s.lastOutput = Date.now()`, grep
`boot-slot-rehydration`). `laneAutoCloseRefusal` haengt ueber `laneSpentLooking(…, STALLED_IDLE_MS)`
genau an dieser Uhr, `STALLED_IDLE_MS` steht live auf 20 min. Ein Tick, der deployt, entwaffnet
also fleet-weit fuer 20 Minuten den Lane-Autoclose und vernichtet jeden Beleg, der an einem
Idle-Fenster haengt — ohne dass irgendein Prinzipal gefragt wurde. Genau diese Absprache ist vor
Deploy `82f55be0` mit Slot 2 gefuehrt worden; ein Tick kann sie nicht fuehren. **Die Invariante
ist damit besser begruendet als vorher, nicht schwaecher.**

Was am Akt trotzdem mechanisch werden darf, ist der **Alarm** — und der ist heute nicht gebaut.
`deployGap()` ist gerechnet und wird auf `/api/sessions` und `/api/steward/sessions` serviert; die
Watch-Art `deploy` (`server/types.ts#DeployWatch`) traegt ein `deployId` und abonniert damit den
Ausgang eines SCHON GESTARTETEN Deploys, nie den offenen Gap. Es gibt keine Schiene, die sagt
„der Gap steht seit N Minuten offen".

Sicherheitsbedingung als Praedikat — ein Alarm feuert nur, wenn:

    deployFacts !== null                       // gemessen, nicht ungemessen
 && deployFacts.gap.codeBehind === true        // `null` = der Tick war noch nicht da → kein Alarm
 && now - gapFirstSeenAt >= T
 && der Alarm schreibt eine Ledger-Zeile oder ein View-Feld, keinen Prozess und keine Pane

`codeBehind === null` darf nicht feuern, und das ist konsistent, nicht bequem: unbekannte Pfade
zaehlen bereits IN `codeBehind` hinein (`codeBehindUnknown`, „unknown ist nie ein all-clear"), also
ist `null` ausschliesslich „noch nicht gemessen".

**Benannte Grenze:** der Alarm darf keine Attention sein. `raiseAttention` verlangt „the current
bound MAIN of an active program"; der Server ist kein solcher Prinzipal und darf sich keinen
erfinden.

### Akt 2 · Der Kill-Switch, der nicht live war — mechanisch, aber nicht so

`FLEET_CARD_MS='0'` in der `.env` hat den laufenden Kartensweep nicht gestoppt, und das ist **kein
Bug, sondern der Vertrag**: `CARD_TICK_MS` ist eine Modul-Konstante (`server.ts`, grep
`FLEET_CARD_MS`), und „aus" heisst dort ausdruecklich, dass **gar kein Timer registriert wird** —
dieselbe Abmachung wie `FLEET_BRIEF_MS`, und sie ist es, die die Suiten sicher macht (kein Guard im
Sweep, den jemand vergessen kann). `server.ts` parst `.env` nirgends; Bun laedt sie beim Boot, der
Watchdog sourct sie mit `set -a`. Ein Wert in der `.env` eines LAUFENDEN Servers ist strukturell
folgenlos.

Ein Env-Hot-Reload ist deshalb **abzulehnen**: er muesste Timer neu registrieren, und dann koennte
ein laufender Server ohne Boot einen agenten-spawnenden Tick SCHARF schalten — die Suite-Sicherheit
haengt genau an der Gegenrichtung.

Die Luecke liegt woanders, und sie ist mechanisch zu schliessen: **`tickCardSweep` liest den
Master-Stop nicht.** Der Guard ist woertlich `if (cardSweepBusy || !CARD_ON) return;`. `autosOn` —
persistiert, ownergeschaltet ueber die Route `autos_switch`, live ohne Boot — gated heute den
Auto-/Watch-Zustellpunkt und, mit geschriebener Begruendung, `laneAutoCloseRefusal`
(„automation is paused (autosOn is off)"). Ein Tick, der externe Modellaufrufe bezahlt, liest ihn
nicht.

Sicherheitsbedingung als Praedikat: **ein Sweep, der einen externen Modellaufruf bezahlt, laeuft nur
bei `autosOn === true`.** Ein Boolean, im Speicher, ohne Unbekannt-Zustand, strikt verengend — die
Suite-Abmachung („kein Timer registriert") bleibt unberuehrt.

**Der zu nennende Widerspruch ist klein, aber echt:** `autosOn` ist an seiner Deklaration als
„global kill-switch for scheduled autos (**the heartbeat surface**)" beschrieben. Ihn vor einen
Kosten-Tick zu haengen weitet SEINE Bedeutung. Diese Weitung ist allerdings schon vollzogen — der
Lane-Autoclose liest ihn als „der Master-Stop des Owners pausiert Automation" — und dies waere der
dritte Leser derselben, bereits begruendeten Lesart, nicht eine neue.

### Akt 3 · Verwaiste Worktrees — mechanisch, der Pruefer steht schon

Von den fuenf Akten ist dieser der klarste, weil die Sicherheitsbedingung nicht erfunden werden
muss: `removeWorktreeSafe` beweist sie bereits positiv, und `worktreeRisk` definiert sie —
`empty = dirtyFiles.length === 0 && unpushedCommits.length === 0`, wobei „unpushed" selbst
konservativ gemessen ist (auf `@{push}`, ODER auf IRGENDEINEM Remote, ODER in den Integrationsbranch
gemerged; gemessen gegen den Integrationsbranch, nicht gegen den HEAD des Primary). Darunter liegt
als Backstop gits eigene Verweigerung in `worktree remove`. Die Tuer existiert ebenfalls:
`POST /api/worktrees/remove` lehnt ab bei laufendem Attach (409), bei „nicht Worktree dieses Repos"
(400) und bei „in einem Slot offen" (409).

Es fehlt genau ein Tick. Praedikat, alle Klauseln positiv:

    !w.primary
 && slots.every((x) => x.cwd !== w.path)     // kein Slot haelt ihn
 && !attachBusy.has(w.path)
 && risk.empty === true
 && JEDE git-Sonde, aus der risk gerechnet wurde, hat code 0 geliefert

Die letzte Klausel ist **neu und noetig**: `worktreeRisk` setzt heute `dirtyFiles: []`, wenn
`statusLines` mit `code !== 0` zurueckkommt — fuer eine Vorschau, auf die ein Mensch zielt, ist das
tragbar, fuer einen Tick liest sich eine gescheiterte Sonde als „sauber". Ein Sweep muss `code === 0`
ausdruecklich verlangen, sonst ist er an dieser einen Stelle nicht fail-closed.

**Benannte Grenze:** der Sweep ruft `removeWorktreeSafe`, **nie** `/api/worktrees/discard`. Discard
ist im Code als „the ONE path that may eat work (force-remove + branch delete)" bezeichnet; genau
diese Tuer bleibt eine Hand.

Der vierte Worktree des Sweeps, der mit ungelandeter Arbeit (`7e758850`), ist **kein Gegenbeispiel,
sondern der Beweis, dass das Praedikat trennt**: seine Commits sind weder auf einem Remote noch
gemerged, `unpushedCommits` ist nicht leer, `empty` ist false, der Sweep laesst ihn stehen.

Beruehrte Invariante: keine. §7 des beerdigten Registers (`docs/work-register-2026-08-06.md`)
fuehrt diesen Punkt nicht.

### Akt 4 · Die reparierte Attention — der Typ verweigert den mechanischen Schluss

Entscheidung: **Vorschlag**, und die Begruendung ist nicht Vorsicht, sondern eine fehlende Naht.

Eine `AttentionRequest` traegt `kind` aus `decision | blocked | review-ready` und `text` als Prosa.
Ihr `provenance` (`taskId`, `originId`, `programId`, `branch`, `candidateSha`) ist optional, auf
aelteren Zeilen ausdruecklich abwesend — und **keines der fuenf Felder benennt die Sache, um die es
geht**. Es gibt keinen maschinenlesbaren Referenten von „zweimal gleiches Audit-Rot". Ein Tick, der
sie schloesse, muesste aus Prosa schliessen, dass die Bedingung weg ist: die statistische Stufe,
fuer einen Schluss, den ein Mensch schuldet.

Haerter noch, und das ist die eigentliche Antwort: **der Typ laesst es nicht zu.** `answer` ist
`{ text; at; by: "owner" } | null` — „beantwortet" kann per Konstruktion nur der Owner. Es gibt
keinen Zustand „von der Welt erledigt". Ein Tick muesste entweder einen Status erfinden oder eine
Owner-Antwort faelschen. Beides ist die falsche Antwort auf einen Hausputz.

**Aehnlichkeit mit einem beerdigten Punkt, als solche markiert:** das hat die Form von
„Auto-Rollback auf ein rotes Tier-2-Audit" (§7, beerdigt: 1 von 15 adjudizierten roten Audits war
`real`) — eine Maschine entscheidet anstelle eines Menschen auf ein Rot/Gruen-Signal mit schlechter
Basisrate. Es ist **nicht derselbe Punkt** (dort geht es ums Zuruecknehmen eines Lands, hier ums
Schliessen einer Zeile), aber wer den mechanischen Schluss doch bauen will, widerlegt zuerst jenen
Beleg.

Mechanisch und gefahrlos ist die **Tatsache neben der Zeile**, nicht die Zeile: `raisedAt` ist
persistiert, `attentionDelivery` klassifiziert schon `read | unread | unknown`, und
`ATTENTION_MAX_OPEN_PER_REQUESTER` deckelt die Menge — aber **nichts misst das Alter**. Praedikat:
fuer jede offene Attention `openFor = now - a.raisedAt` rendern, zusammen mit `delivery.state`, und
zusaetzlich — wo `provenance.candidateSha !== null` — die reine Lesung
`git merge-base --is-ancestor <sha> <integrationBranch>`. Kein Statuswechsel, kein Schreiben; wo die
Provenienz `null` ist, erscheint nichts. Fuer `d08f4da9` selbst haette der Sha-Teil nichts geliefert
(sein Referent war ein wiederholtes Audit-Rot, keine Sha) — das Alter haette gereicht.

### Akt 5 · Slot-Datensatz vs. Pane — Vorschlag, und der Sensor ist das Problem

`POST /api/slots/:id/model` existiert, schreibt den DATENSATZ und respawnt **absichtlich nicht** —
der Kommentar nennt die Messung, die sie gebaut hat: 2026-09-02, vier Slots mit
`claude-opus-5[1m]` im Datensatz und Fable in der Pane. Geschrieben wird `s.model` an genau drei
Stellen: beim Spawn, bei der Boot-Rehydrierung aus der persistierten Zeile, und ueber diese Route.
Ein `/model` in der Pane schreibt nichts. Eine Sonde auf das tatsaechlich laufende Modell existiert
nicht (`paneModel`, `observedModel`: null Treffer).

Mechanisch waere der Akt nur mit einem Sensor, und der einzige heute verfuegbare waere der
gerenderte Schirm. Dagegen steht Gemessenes aus diesem Repo: der echte Composer-Parser liest den
Pi-Trust-Dialog als leeren Puffer
(`docs/messungen/2026-09-15-pi-zai-automation-feuerprobe.md`), und die Faktschicht-Regel sagt fuer
`agent`, dass `unprobed`/`null` **keine Antwort** ist. Ein aus einer Fusszeile geschabter
Modellstring ist pro Harness und pro TUI-Version anders und nach einem Update still falsch — und
ein FALSCHER Datensatz ist schlimmer als ein veralteter, weil jeder spaetere Spawn ihn liest
(2-s-Heilung, ↻ Restart, Nachfolge).

**Benannte Invariante:** `e2e/pins.ts` pinnt, dass die Faktschicht und das Gate nie zusammenfallen
(„agentInfo unconditional + aliveInfo gated"). Ein geschabtes Modell waere ein drittes Ding, das
sich als Fakt ausgibt. Der Pin verbietet es nicht woertlich, aber er ist die Regel, gegen die der
Bau argumentieren muesste.

Was ohne Sensor mechanisch bleibt, ist ein **Benennungsakt**: den Wert dort, wo er gezeigt wird,
als das ausweisen, was er beweisbar ist — „was der naechste Spawn nimmt" — und nie als „was
laeuft". Der Datensatz kann seine eigene Herkunft (Spawn · Boot · Route) fuehren; die Pane kann er
nicht kennen.

**Bedingter Rueckweg, nicht gemessen:** wo ein Harness sein Modell dauerhaft AUSSERHALB des Schirms
schreibt, ist der Akt pro Adapter mechanisierbar. Fuer `codex` ist belegt, dass Rollouts das
Modell der SPAWN-Zeit tragen (35/35, `docs/messungen/2026-09-14-codex-lane-verdrahtung.md`); ob ein
Rollout einen SPAETEREN Wechsel festhaelt, ist hier nicht gemessen und darf nicht angenommen
werden.

## Methode

Alles am Baum `05fc16b0` dieser Lane gelesen, kein Server angefasst, keine Zeile geaendert:

    grep -n "laneAutoCloseRefusal" server.ts        # 14467 Definition, 14582/14614 Aufrufer
    sed -n '14467,14570p' server.ts                 # die Form, an der die Akte gemessen werden
    grep -n "FLEET_CARD_MS\|codeBehind" server.ts
    grep -n "async function tickCardSweep" -A 25 server.ts   # Guard: cardSweepBusy || !CARD_ON
    grep -n "autosOn" server.ts                     # 3069 Deklaration, 14472 + 10924/10946 Leser
    grep -n "async function worktreeRisk" -A 45 server.ts
    sed -n '32639,32680p' server.ts                 # /api/worktrees/remove und /discard
    grep -n "interface AttentionRequest" -A 16 server/types.ts
    grep -n "interface DeployWatch" -A 4 server/types.ts
    sed -n '34204,34226p' server.ts                 # POST /api/slots/:id/model
    cat /Users/owner/claude-fleet/rulebook/deploy.md    # §Deploy, die zitierte Invariante
    sed -n '220,250p' docs/work-register-2026-08-06.md     # §7, die beerdigte Liste

Zeilennummern sind in Ordnung, weil diese Notiz datiert ist und genau diesen Baum vermisst.

Gegenprobe zu Akt 2, damit „kein Reader" eine Messung und keine Behauptung ist:
`grep -n '\.env"' server.ts` trifft ausschliesslich `createWorktree`, das die Datei in eine Lane
KOPIERT. Es gibt keinen Parser.

## Was nicht gemessen wurde

- **Haeufigkeit.** Wie oft jeder der fuenf Akte anfaellt, ist nicht gezaehlt. Jede Entscheidung
  hier ist eine Vertragsentscheidung („darf eine Maschine das beweisen?"), keine Kosten-Nutzen-
  Rechnung. Ein Akt mit n=1 kann trotzdem mechanisch richtig sein und umgekehrt.
- **Ob ein codex-/pi-Rollout einen nachtraeglichen `/model`-Wechsel festhaelt.** Nur die Spawn-Zeit
  ist belegt. Akt 5's bedingter Rueckweg steht und faellt damit und ist deshalb als ungemessen
  markiert.
- **Die Schwelle T in Akt 1.** Dass ein Alarm eine Schwelle braucht, ist entschieden; welche, ist
  eine Messung am Deploy-Ledger, die hier nicht lief.
- **Ob `attentionDelivery` beim Alter-Rendern mitzieht.** Die Klassifikation existiert; ob sie fuer
  jede offene Zeile bezahlbar ist (sie joint Program-Inbox und Nudge-Zustand), ist nicht geprueft.
- **Keine Verhaltensaenderung.** Diese Zeile entscheidet und begruendet; sie baut nichts. Kein Akt
  ist implementiert, kein Praedikat ist ausgefuehrt worden.

## Entscheidungs-Trail

Zeitstempel auf die Minute gerundet (Lane geoeffnet 12:46:46Z).

ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-16T12:48:00Z	form	laneAutoCloseRefusal als Massstab genommen, nicht als Vorbild zum Kopieren	der Brief nennt sie als Form; sie ist die einzige gebaute Instanz von „jeder Grund positiv"	server.ts:14467	fuenf Praedikate in derselben Richtung geschrieben
2026-09-16T12:49:00Z	akt1	Deploy-Invariante BESTAETIGT statt aufgehoben	der Regelbuch-Grund gilt, und die Idle-Uhr-Kopplung ist ein zweiter, staerkerer	rulebook/deploy.md §Deploy; grep boot-slot-rehydration	Akt in Alarm (mechanisch) und Deploy (Vorschlag) geteilt
2026-09-16T12:50:00Z	akt2	Env-Hot-Reload abgelehnt, Master-Stop stattdessen	„kein Timer registriert" ist die Suite-Sicherheit; ein Reload muesste Timer scharfschalten	server.ts:11900, 28574	Luecke woanders gefunden: tickCardSweep liest autosOn nicht
2026-09-16T12:50:00Z	akt3	fail-closed-Klausel zum bestehenden Praedikat ADDIERT	worktreeRisk liest eine gescheiterte git-Sonde als „sauber"	server.ts:4505-4507	Praedikat verlangt zusaetzlich code === 0 je Sonde
2026-09-16T12:51:00Z	akt4	Vorschlag nicht aus Vorsicht, sondern weil der Typ verweigert	answer.by ist literal "owner"; es gibt keinen Zustand „von der Welt erledigt"	server/types.ts:589	Aehnlichkeit zum beerdigten Auto-Rollback markiert, nicht gleichgesetzt
2026-09-16T12:51:00Z	akt5	bedingter Rueckweg pro Adapter offengelassen statt verworfen	codex schreibt sein Modell ausserhalb des Schirms — aber nur zur Spawn-Zeit belegt	docs/messungen/2026-09-14-codex-lane-verdrahtung.md	als ungemessen markiert, nicht als Option behauptet
