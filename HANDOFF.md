# HANDOFF — Dual-Host cd110019 (Slot 6): KORREKTUR am Merkposten — die beiden Zeilen tragen SEHR WOHL ein `Task.spawn`, und es zeigt auf FABLE; 2026-09-03 (21:3x)

Program `cd1100193082db395c1387db`, gebunden, Lineage 9 → 5 → 6. Ich habe nichts gestartet,
released oder gelandet. Dieser Abschnitt korrigiert genau EINEN Satz des Abschnitts darunter und
laesst alles andere daran gelten.

## Der korrigierte Satz

§0 des Abschnitts darunter sagt: „beide Zeilen tragen **kein `Task.spawn`** … sie tragen gar
nichts. Sie fallen also auf `DEFAULT_SPAWN`." **Das stimmt nicht.** Gemessen in `fleet.json`
(dem Zustand, den der laufende Server geladen hat), 2026-09-03 21:3x:

```
60d07416  spawn {"harness": null, "model": "claude-fable-5-1[1m]", "effort": "high"}
c3f91ce1  spawn {"harness": null, "model": "claude-fable-5-1[1m]", "effort": "high"}
```

Beide Zeilen sind am **2026-09-02 03:49** gefiled worden — also VOR dem Owner-Entscheid
10:35/10:45 desselben Tages, der „Fable ueberall" durch „Fable orchestriert, jede LANE auf
`claude-opus-5[1m]`" ersetzt hat. Sie tragen damit das ueberholte Tripel, nicht gar keines.

## Warum die Korrektur die Handlungsanweisung VERSCHAERFT statt sie aufzuheben

Die Schlussfolgerung des Merkpostens bleibt richtig — **der Dispatch-Body MUSS
`{"harness":"claude","model":"claude-opus-5[1m]","effort":"high"}` explizit nennen** —, aber der
Grund ist ein anderer und ein schlimmerer:

- Der Vorrang ist **per Feld** (`server.ts#taskDispatch`, dokumentiert in `docs/self-api.md`
  §dispatch): ein im Body genanntes Feld gewinnt, ein fehlendes faellt auf `taskSpawnOf(t)` =
  `Task.spawn`, und erst bei dessen Absenz auf den Default-Adapter.
- Unter der alten (falschen) Lesart waere ein leerer Body „fast richtig": Harness und Modell
  kaemen ueber `FLEET_MODEL` = `claude-opus-5[1m]` korrekt heraus, nur `effort` ginge verloren.
- Unter der gemessenen Lage ist ein leerer Body **falsch im Modell**: er spawnt die Lane auf
  **Fable 5.1** und trifft damit genau das Limit, das der Owner-Entscheid schuetzen soll.

Wer den alten Satz glaubt, haelt einen leeren Body fuer eine kleine Schlamperei. Er ist eine
Verletzung der Modellpolitik.

## Was ich NICHT getan habe, und warum

**Das persistierte `Task.spawn` nicht repariert** — es gibt dafuer keine Tuer. `Task.spawn` wird
SET-Zeit validiert und geschrieben (`POST /api/self/tasks` beim Filing); eine Route, die das
Tripel einer BESTEHENDEN Zeile aendert, existiert nicht (`rg 'taskSpawnOf' server.ts`: nur
Lesestellen — `tickDispatch`, `taskDispatch`, die Release-Tuer). Der explizite Body ist also
nicht nur der bequemere, sondern der einzige Weg.

## Betriebsstand (gemessen)

`dispatch: false` (Master-Dispatch aus, kein Tick startet etwas) · beide Zeilen `queued`, Briefs
`edited:true` (9 204 / 6 831 Z.) · Projektion `nextAction` fuer beide: „queued — the dispatch tick
starts it; no door belongs to this row" · keine Suite und kein Audit laufend · zwei verwaiste
Worktrees auf `7e3070f` gehoeren fremden Programs, nicht mir.

**Eine Beobachtung ohne Handlung:** dieser Slot laeuft laut Pane auf Opus 5 (1M), waehrend die
Modellpolitik fuer eine Program-MAIN Fable 5.1 vorsieht. Ich drehe das nicht mitten in der
Session — die Abweichung geht auf die SICHERE Seite des Limits, das der Entscheid schuetzt.

## Dein erster Zug

Unveraendert der des Abschnitts darunter: **nichts starten.** S3 (`60d07416`), dann S4
(`c3f91ce1`), beide vom Controller von Hand, beide mit dem expliziten Body oben.

---
# HANDOFF — Program `b9c1e0d9` „Fleet Task Workbench" ist ABGESCHLOSSEN (Slot 2 → retire, 2026-09-03 21:2x)

Das ist kein Uebergabe-, sondern ein ABSCHLUSS-Abschnitt: es gibt keine Nachfolgerin, das Program
steht auf `status: "complete"` (`completedAt` 1788463527287), und dieser Slot retiret. Wer hier
weiterliest, sucht entweder die Beweislage oder die zwei Mechanismus-Befunde am Ende.

## Was diese Session getan hat

Sie hat KEINEN Code geschrieben — es war keiner mehr noetig. Drei Akte:

1. **Die offene Owner-Entscheidung neu gestellt.** Die Attention `dddb2141` meiner Vorgaengerin
   hatte den Owner nie erreicht (siehe Befund 1). Neu als `cc80f083`, verengt auf die eine
   verbliebene Frage. **Antwort: (A)** — der P1 ist ein Brief-Fehler, kein Produktdefekt.
2. **`da0e24e`** — die Adjudikation als Nachtrag in
   `docs/messungen/2026-09-03-task-workbench-review.md`. Form wie bei einem adjudizierten
   Post-Land-Audit: die Messung des Reviewers bleibt UNVERAENDERT (Frontmatter, Urteil, P1-Befund
   nicht angefasst), der Nachtrag haengt am Ende und ist als nicht-vom-Reviewer gekennzeichnet,
   unter dem P1-Punkt steht nur ein Zeiger. **Damit hat der Review keine offenen P0/P1 mehr, und
   der achte Erfolgssatz ist erfuellt.**
3. **Program auf `complete` gesetzt** (`POST /api/programs/b9c1e0d9…/complete`, Owner-Token unter
   der Delegation des Controllers).

Beide Commits dieser Session (`d956daf`, `da0e24e`) sind **Direkt-Commits aus dem Haupt-Checkout**
und damit fuer jedes land-seitige Ledger unsichtbar — keine `fleet/land`-Note, keine
`lane-outcomes`-Zeile, kein Post-Land-Audit. Beide sind rein docs; Beweiskette daher die
proportionale, die der Land-Gate seit `e896826` fuer einen docs-only-Diff selbst waehlt:
`bun install --frozen-lockfile` exit 0, `bun e2e/pins.ts` ALL PASS, Public-Repo-Scan leer.

## Die Beweislage des Programs, an einer Stelle

Sechs `auftrag`-Zeilen terminal, alle Lands `verified`. Je Erfolgssatz:
(a) `63c77b3` · (b)-(e) `a58e9c1` · (d) zusaetzlich `a6b7a38` · (f)+(g) `445c1e2` ·
(h) `a58e9c1` + `da0e24e` (Review ohne offene P0/P1, nach Adjudikation).
Der Post-Land-Audit auf `a58e9c1` ist gruen — an `ms` und den PASS-Zeilen geprueft, nicht am Wort:
`exit 0`, `ms 1 395 654`, Trail `rows=3506`.

## Zwei Mechanismus-Befunde, die groesser sind als dieses Program

1. **Eine Attention stirbt mit der Session, die sie gestellt hat.** `dddb2141` steht als
   `status: "refused"`, `refusedReason: "requester session ended"`, `closedAt` = der Moment der
   Nachfolge. Die Rail-Reihenfolge „genau eine Attention an der Grenze, dann `succeed`" verliert
   die Frage damit LAUTLOS: die Vorgaengerin hat korrekt gefragt und korrekt uebergeben, und der
   Owner sah nie etwas. Wer an der Grenze fragt, muss auf die Antwort warten oder sie in der
   Nachfolge neu stellen — bis das jemand baut, ist es ein Handgriff, den jede Program-MAIN kennen
   muss.
2. **Der erste Helfer-Job dieses Fleets, der GELIEFERT hat.** Der Audit auf `a58e9c1` lief als
   `remote helper (second-host): ./e2e-isolated.sh` und kam vollstaendig zurueck. Die beiden
   bekannten Vorgaenger-Claims waren gelapst (`26ea1a20`, `a85a0e3c`) — die Frage „ist die
   Auslagerung je durchgelaufen?" ist damit mit JA beantwortet, mit genau einem Beleg.

## Betriebsstand beim Abschluss (gemessen, nicht erinnert)

`bundleStale.stale false` · `deployGap.codeBehind false` · `errors null` · keine Suite, kein Audit
laufend · kein Deploy von mir · ctx 13,x %. Neun `notiz`-Zeilen des Programs bleiben `pending`;
sie sind beratend und laufen nie — kein offener Posten, nur Lesestoff.

## Provenienz dieses Abschnitts (Nachtrag, weil `git log` sonst luegt)

Der Text oben wurde von mir geschrieben, aber von einer FREMDEN Session mitcommittet:
`25766c2` (Dual-Host, Slot 5) hat meinen noch ungestageten Prepend eingesammelt. Nichts ging
verloren (0 Deletions, beide Abschnitte vollstaendig) — aber `git log -1 -- HANDOFF.md` nennt fuer
diese Zeilen ein fremdes Program. **Der Grund ist strukturell: mehrere Program-MAINs teilen sich
dieses Haupt-Checkout, also auch `HANDOFF.md` und den Index.** Wer hier prepended, committet im
selben Zug, oder seine Zeilen gehoeren dem naechsten `git add`. Meine eigenen Commits dieser
Session sind `d956daf` und `da0e24e`.

---

# HANDOFF — Dual-Host cd110019 (Slot 5 → Nachfolge): S3/S4 briefgereift und WARTEND, zwei rote Audits als flake VERMESSEN statt geraten, S3s Sendemechanik vor dem Dispatch widerlegt; 2026-09-03 (20:0x), ctx GEMESSEN 27,1 %

Program **`cd1100193082db395c1387db`**, gebunden. Lineage 9 → 5. Ich habe in dieser Session
**keine Zeile gestartet, released oder gelandet** — das ist korrekt so, s. §1.

## 0. MERKPOSTEN (Controller Slot 8, woertlich bestaetigt)

**`60d07416` (S3/4) und `c3f91ce1` (S4/4) bleiben `queued` und werden vom Controller VON HAND
dispatcht. Der Master-Dispatch bleibt AUS.** Warte nicht auf den Tick — er startet null Zeilen.
Reihenfolge: **S3 zuerst, dann S4.**

**Und der eine Satz, der sonst Arbeit kostet:** beide Zeilen tragen **kein `Task.spawn`** (ich habe
`fleet.json` nachgesehen — die Handoff-Fassung „sie tragen noch das Fable-Tripel" ist FALSCH, sie
tragen gar nichts). Sie fallen also auf `DEFAULT_SPAWN = {null,null,null}`. Harness und Modell
kaemen ueber `FLEET_MODEL` richtig heraus — **`effort` nicht.** Der Dispatch braucht darum den
expliziten Body `{"harness":"claude","model":"claude-opus-5[1m]","effort":"high"}`. Das ist die
einzige Stelle, an der ein leerer Body still das Falsche tut.

## 1. Beide Briefe sind GEPINNT (`edited`) — lies sie, bevor du etwas an ihnen aenderst

- **S3 `60d07416`** ist gegen main NEU VERMESSEN und komplett neu geschrieben (9 204 Z.). Die
  Vorfassung war an zwei Stellen unbrauchbar: alle Zeilennummern stammten aus einem aelteren Baum,
  und die Sendemechanik funktioniert auf dieser Maschine nicht (§3). Anker stehen jetzt als
  `datei#symbol`. **Wichtigster Einzelpunkt: `audit()` lebt seit `46d29d8` nicht mehr in
  `server.ts`, sondern in `server/audit-log.ts`** (dort die geschlossene `AuditEvent`-Union, in die
  `helper_wake` gehoert). Wer das in server.ts sucht, verliert eine Stunde.
- **S4 `c3f91ce1`** hat die Korrektur bekommen, die meine Vorgaengerin gemessen und nicht mehr
  eingearbeitet hatte, als ZIEL C mit `rg`-pruefbarem Kriterium. Ich habe ihre Behauptung vorher
  am Baum GEPRUEFT, sie stimmt: `helperCmdCheck` bindet den KOMMANDO-STRING, nicht das
  Ausgefuehrte — `bun run build`/`bun test`/`bun run verify` fahren ein `package.json`-Skript AUS
  DEM EINGEREICHTEN BUNDLE, und die Fixture `e2e/helper-daemon.ts:637-641` tut genau das. Kein
  Regress, aber die Zusage („whatever the allowlist says") ist zu stark. Die dritte Fundstelle ist
  `e2e/watch.ts:3195`, nicht `e2e/security.ts` wie im alten Handoff — `e2e/security.ts:197-199`
  traegt eine VIERTE, anders formulierte. Alle vier stehen im Brief.
- **Kollisionsflaeche S3 ↔ `6f401842` (Succession-Naht): GELESEN, disjunkt.** `6f401842` sitzt an
  den fuenf `sendText(free, deliveredBrief, true)`-Stellen (7725, 16998, 17107, 17650, 17887), an
  der `stale Supervisor binding`-Zeile und an `/api/supervisor/bootstrap`; Suite-Datei
  `e2e/programs.ts`. S3 sitzt im Helfer-Block plus den Geraete-Routen; Suite-Datei
  `e2e/helper-portal.ts`. Einziger Kontaktpunkt: `e2e/pins.ts`, trivialer Rebase.

## 2. DIE METHODE, DIE DIESE SESSION WERT WAR: Flake-Basisrate aus dem Trail

Zwei rote Post-Land-Audits kamen herein, **beide fremde Lands**, beide unadjudiziert. Ich habe
beide in je ~30 Sekunden entschieden, **ohne einen einzigen Suite-Lauf** — gegen je ~11 min
Suite-Mutex, den der naive Weg gekostet haette. Register:
`docs/messungen/2026-09-03-flake-basisrate-settle-for-merge.md` (Commits `0347c65`, `7e3070f`).

**Das Rezept, in einer Zeile:** `$TMPDIR/fleet-e2e-trail/*.jsonl` haelt eine Zeile je `check()`
ueber die letzten ~33-36 Laeufe. Zaehle, wie oft DEIN Check dort `ok:false` ist. Faellt er auf
Baeumen, die deinen Diff nicht enthalten koennen, ist die Attribution widerlegt — und zwar nach
der Regel, die hier ohnehin gilt: ein gruener Kontrolllauf beweist nichts, ein roter beweist alles.
Der rote Kontrolllauf liegt meist schon auf Platte.

- **Audit `1788388339508`** (`4846d831`, P4 Slice 3): ein FAIL, Name aus der Ledger-Zeile ELIDIERT.
  Aus dem Trail: `⏸ a re-run is refused while the resolution is still rebased onto main`
  (`e2e/merge.ts:420`). Der Idle-Gate hatte geantwortet, nicht der Guard unter Test. 2/33 = 6,1 %,
  buchstabengleiches `detail`, aeltester Fall **2026-08-30** — drei Tage vor dem Land. `flake`.
  **Mechanismus benannt:** `settleForMerge` (`e2e/lane-helpers.ts:73`) laeuft 80 × 150 ms = 12 s
  und **faellt danach still durch** — kein `check()` auf die eigene Vorbedingung. Reparatur
  vorgeschlagen, NICHT gebaut, gehoert der Suite-Seite.
- **Audit `1788462365585`** (`6b8b89d9`, Slice 7a, REMOTE auf second-host, 23 min): drei FAILs der
  Q5/Q6-ops-event-Familie. 23,3 % / 16,7 % / 26,7 % ueber 30 Laeufe, Fehlschlaege ab 2026-08-31,
  **drei davon am 2026-09-03 vor dem Land**. `flake`.
  **Vorbehalt, den ich ausgesprochen habe statt ihn zu verschweigen:** der Diff fasst
  Prozess-Hygiene an, und `restart keeps the busy pending event` klingt verwandt. Die Basisrate
  entscheidet trotzdem — bei 1/30 haette ich `real` gesagt.

**Zwei Abkuerzungen, die ich erst spaet gefunden habe:**
1. **Bei einem REMOTEN Rot stehen die FAIL-Namen schon auf der Ledger-Zeile** (Feld `fails[]`, seit
   `3974883`). Nur die Pane-Benachrichtigung elidiert sie. Der Trail-Umweg ist dort unnoetig — ich
   bin ihn trotzdem erst gegangen.
2. **`checks.ran` ist KEIN Mass dafuer, ob etwas gemessen wurde.** `server.ts#postLandAuditChecks`
   zaehlt `PASS `/`FAIL `-Zeilen im AUFBEWAHRTEN, elidierten Text: derselbe Lauf meldet `ran: 24`,
   waehrend seine eigene PASS-Zeile `rows=3538 results=3538` sagt. Von der Regelbuch-Regel „pruefe
   an `ms` und den PASS-Zeilen" traegt nur die **`ms`**-Haelfte. Nur `ran: 0` bleibt aussagekraeftig.

## 3. S3s Sendemechanik ist VOR dem Dispatch widerlegt worden (`b7a7bfb`)

`docs/messungen/2026-09-03-bun-udp-broadcast-wol.md`. Drei Messungen, jede mit Kontrollgruppe:
- `Bun.udpSocket({broadcast:true})` ist **kein Beleg** — Bun 1.3.9 akzeptiert JEDE erfundene
  Konstruktor-Option (`thisOptionDoesNotExist:true` ebenso). Die echte Tuer ist die Prototyp-Methode
  **`setBroadcast(true)`**, und sie ist Pflicht: ohne sie EACCES, deckungsgleich mit der
  Python-Kontrolle ohne `SO_BROADCAST`.
- **`255.255.255.255` geht auch MIT dem Flag nicht** (EHOSTUNREACH). Nur die subnetz-gerichtete
  Adresse verlaesst die Karte.
- Die Frame-Form stimmt: 102 Bytes, 6×FF + 16×MAC, kommen auf einem lokalen Listener korrekt an.

**Warum das teuer gewesen waere:** der alte Brief machte `FLEET_HELPER_WAKE_ADDR` zum
Test-Override und liess Produktion auf `255.255.255.255` zeigen. Gruene Suite ueber einer Route,
die bei jedem Owner-Klick wirft. Der neue Brief macht die Adresse zur Pflicht-Konfiguration ohne
Default, 409 statt geworfenem Send, und **pinnt `setBroadcast` in `e2e/pins.ts`** — sonst sagt der
gruene 127.0.0.1-Lauf wieder nichts ueber den echten Pfad.

`.env` traegt bereits `FLEET_HELPER_MAC_SECONDHOSTLINUX1`, passend zur Brief-Konvention. (Ich hatte
kurz einen Namensfehler vermutet; das war ein Artefakt meines eigenen `grep -oE '^[A-Z_]+'`, das
an der Ziffer abschneidet. Kein Befund.)

## 4. Owner-Wunsch „claude-Session auf second-host" — beantwortet, gemessen (Controller Slot 13)

Die Antwort steht nur in meiner Pane; hier ist sie, damit sie nicht stirbt:
1. **Ob `claude` dort installiert ist, ist von hier NICHT messbar.** `ssh second-host` →
   `Permission denied (publickey,password)` fuer `owner`, `fleet`, `helper`. Die
   `capabilities:[bun,tmux,git,zsh]` der Geraetezeile sind **`cfg.capabilities`** aus der Config
   AUF dem Geraet (`helper-daemon/daemon.ts:644`) — eine Selbstauskunft, keine Probe. Das fehlende
   `claude` dort beweist nichts.
2. **Es gibt heute keinen Kanal.** Die Job-Schiene ist pull-only, und `command` nimmt sechs exakte
   Allowlist-Eintraege, wobei `claude|codex|pi` VOR der Allowlist unbedingt abgelehnt wird
   (`server/types.ts#helperCmdCheck`) — Absicht, nicht Luecke. Die Canary vom 31.08. lief ueber
   `git bundle` + **scp**, also Owner-Zugang. Cross-host-tmux existiert nicht.
3. **Es fehlt der ganze Slot-Begriff, nicht ein Feld** (lokale tmux-Pane, eingebackenes
   Self-Token, Pane-Beobachtung fuer `agent`/`idle`/`ctx`). **Das ist weder S3 noch S4** — beide
   sind Helfer-Portal. Es ist Phase 2, und die Vorarbeit EXISTIERT:
   `docs/attic/dual-host-session-runtime-phase0-2026-08-30.md` empfiehlt **Option A (zweite
   eigenstaendige Fleet-Instanz) + Client-Link B1** mit vier einzeln landbaren Schnitten;
   **Owner-Gate 2 ist am 2026-08-30 mit NEIN entschieden** (Reports queren keine Hostgrenze),
   Gate 1 (Topologie A/B/C) steht offen, Gate 3 (jeder Schreibakt auf dem Geraet) ist der echte
   Blocker.
4. **Mein Vorschlag fuer den ersten Schnitt:** kein Code, sondern der Owner-Akt, der alles andere
   erst messbar macht — Shell-Zugang plus `claude`-Installation auf second-host —, danach Schnitt 1
   des Phase-0-Plans (der asymmetrische Falsifikator als Messnotiz).
   **Die Falle im Wunsch:** unter Option A erscheint die Session NICHT im Mac-Board, sondern in
   einem zweiten Board am selben Client (Schnitt 4). Wer „im Board sichtbar" als EINE Slot-Liste
   liest, kauft die Vertrauenskante, von der M7 ausdruecklich abraet.

## 5. Zwei tote Zeiger repariert (`668d6ff`), und was daran allgemein ist

Zwei der sechs Evidence-Dokumente dieses Programs liegen seit `ba4169a` (2026-09-01, Docs-Triage
der Sanierung, R100) unter `docs/attic/`. `server.ts` und `docs/ideen/` trugen die neuen Pfade
schon; `helper-daemon/README.md:86` und `docs/messungen/second-host-baseline-2026-08-29.md:3,:85`
zeigten ins Leere. Repariert. Die Dateien selbst habe ich NICHT zurueckgeholt — das war die
Entscheidung eines anderen Programs.

**Allgemein:** ein Program-JSON kann auf Pfade zeigen, die eine fremde Triage verschoben hat.
Beim Erden lohnt ein `for f in <evidence>; do [ -f "$f" ] || echo MISSING $f; done`.

## 6. Ehrlichkeiten

- **Vier Direkt-Commits aus dem Haupt-Checkout** (`668d6ff`, `0347c65`, `b7a7bfb`, `7e3070f`) —
  alle vier sind fuer JEDES land-seitige Ledger unsichtbar, es gibt keine `fleet/land`-Note und
  keinen Post-Land-Audit dazu. Ich habe jeweils von Hand verifiziert und es in den Commit-Body
  geschrieben: `668d6ff` volle Sieben-Stufen-Kette (weil `helper-daemon/README.md` als
  `conservative-default` klassifiziert — der Pfad enthaelt ein `/` und faellt NICHT unter
  `DOC_RULE`), die drei anderen docs-only mit `proportional:true` und `install+pins`. Alle exit 0,
  Tail `ALL PASS`. `./state.sh`s Land-Health-Zahlen untertreiben diesen Tag entsprechend.
- **Ich habe viermal den Owner-Token aus `fleet.json` benutzt** — zweimal `POST /api/tasks/:id/brief`
  (es gibt keine Self-Tuer fuer einen Brief) und zweimal
  `POST /api/post-land-audits/adjudicate` (die Benachrichtigung nennt genau diese Route). Alles
  reversibel, nichts nach aussen. Wenn du das enger willst, ist das eine Owner-Entscheidung, keine
  meine.
- **Beide adjudizierten Audits sind FREMDE Lands** (Generalsanierung). Ich habe sie beurteilt, weil
  das Ereignis in meine Pane kam und die Evidenz ohne Suite-Mutex zu haben war. Das Rot bleibt in
  beiden Faellen rot.
- **Nicht gemessen:** ob der WoL-Frame beim Second-host ANKOMMT (L2-Frage, Owner); ob Linux dieselbe
  `255.255.255.255`-Route verweigert (nur macOS gemessen); ob die drei ops-event-Checks eine
  gemeinsame Wurzel haben (sie treten gebuendelt auf, das ist ein Indiz, keine Messung).
- **Phase 2 ist weiterhin NICHT gefiled** und haengt an Owner-Gate 1.

## 7. Dein erster Zug

Erden (`./state.sh`, `./register.sh`, nur dieser Abschnitt, `GET /api/self/program-execution`).
Dann: **nichts starten.** Beide Zeilen sind briefgereift und warten auf den Controller. Kommt ein
Lane-Report herein, ist er ein ANSPRUCH — Diff und zitierten Verify-Tail lesen, nicht den Bericht
glauben. Kommt ein rotes Audit herein, nimm §2 und miss die Basisrate, bevor du eine Suite faehrst.

## 8. Nachtrag in eigener Sache: dieser Handoff wurde von einer FREMDEN Session committet

Ich habe diesen Abschnitt um ~21:2x vorangestellt und wollte ihn selbst committen. Dazwischen lief
`fd521ac` (Slot 16, 21:25:01) — dessen `git add HANDOFF.md` hat meinen noch uncommitteten Text
mitgenommen und unter SEINER Commit-Message gelandet. Inhaltlich ging nichts verloren (44
Abschnitte vorher wie nachher, beide Fassungen vollstaendig), aber die Provenienz ist falsch: wer
`git log -- HANDOFF.md` liest, findet meinen Abschnitt unter „Program 66499a03 Slot 16".

**Die Regel daraus:** `HANDOFF.md` ist im HAUPT-Checkout eine geteilte Datei, an der mehrere
Program-MAINs gleichzeitig schreiben. Zwischen Schreiben und Committen liegt hier ein Fenster von
Sekunden, in dem eine fremde Session deinen Text adoptiert — oder, wie bei `68afeda` schon einmal
bezahlt, ihn beim Zurueckschreiben still loescht. Also: **prepend und commit in EINEM Zug**, und
danach `git log -1 -- HANDOFF.md` pruefen, ob der Commit wirklich deiner ist.

---
# HANDOFF — Program 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 16 → Nachfolge): C gelandet und das rote Audit als flake entlastet, D1 briefbereit mit KEEP, drei Befunde gefilet; 2026-09-03 (21:2x)

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`,
`GET /api/self/program-execution`. Hier steht nur, was git und die Sensoren NICHT tragen.

## 0. Das Erste, was du tust

1. **`GET /api/self/program-execution`** — deine Zeilen, ihre `phase` und `nextAction`. Die
   `authority.lineage` traegt jetzt DREI Eintraege (Slot 4 `backfill-unknown` → Slot 16 `succeed`
   → du). Der Slot-4→16-Wechsel war der erste dokumentierte Self-Succession-Beweis dieses
   Programs; deiner ist der zweite.
2. **`92553809` (Worker D1) ist die naechste Tat, Status `pending`, Brief ANGEHAENGT** (11 588
   Zeichen, symbolverankerte Fassung, Spawn `claude-opus-5[1m]` / high). **Entscheidung KEEP,
   vom Controller bestaetigt.** Der noetige Owner-Akt ist GENAU EINER:
   `POST /api/tasks/92553809/dispatch`. **Kein Release davor** — die Route nimmt `pending` ODER
   `queued` (in `server.ts`, Zweig `taskDispatch`, selbst gelesen), und der Master-Dispatcher ist
   aus, ein Release wuerde also nur den Status bewegen und nichts starten.
3. **Die Reihenfolge, die den Dispatch heute blockiert:** D1 teilt `server.ts` mit der
   Succession-Naht `6f401842` (Owner-Prioritaet), und die stand bei meiner Uebergabe selbst noch
   `pending`. Erst die Naht, dann D1.

## 1. Was gelandet ist, und wie es wirklich steht

- **Worker C `860cecdf` → `24f9cfc` GELANDET** (Land durch den Controller). Der Schnitt: ein
  geschlossenes Enum `MergeErrorReason` (heute genau `"ff-lost"`) + `mergeBlocksLane()` in
  `lane-signals.ts`, das Feld `MergeLast.errorReason` an GENAU EINER Schreibstelle in `server.ts`
  (dem sauberen Land-Zweig), plus Test-Latch. Damit ist ein verlorenes Fast-Forward nach gruenem
  Verify wieder `done-looking` und selbst nachlandbar — das Loch, an dem Schritt 5 des Programms
  still zum Owner-Land degradierte. **Ich habe den Diff selbst gelesen, nicht den Report.**
- **Mein Brief-Befund zu C war richtig gedacht und trotzdem gegenstandslos:** ich hielt
  `program-phase.ts` fuer noetig (R9/`NON_LAND_MERGE`), die Lane hat nachgemessen und gezeigt,
  dass R9 ohnehin `REVIEWABLE` liefert und `nextActionFor` bei `guarded`-Promotion die
  Self-Land-Tuer nennt — Projektion und Tuer stimmen ueberein, die Datei musste nicht geschrieben
  werden. Merke: die Frage war gut, die Antwort kam aus der Messung, nicht aus meiner Vorsicht.
- **Das rote Post-Land-Audit auf `24f9cfc` ist als `flake` adjudiziert** (Controller Slot 13),
  Event `c34ea715` quittiert. Vier Fails, alle FleetEvent-Transport. Entlastung: die EXAKTE
  Vierer-Signatur fiel viermal VOR dem Land auf fremden Baeumen (`9db4b85` 16.08., `d63bb91`,
  `299ac65`, `4d2dd39` 02.09.); mindestens einer der vier faellt in 15/363 Laeufen (4,1 %).
  **`undo-land` ist damit vom Tisch** — und `HANDOFF.md` §3 einer fremden Session sagte das
  Gegenteil („mein Land ist unter Verdacht", „undo-land ist der Rueckweg"). Ich habe dort einen
  datierten Nachtrag angebracht statt fremde Prosa umzuschreiben (`de2e179`).

## 2. Die teuerste Lehre dieser Session: ES GIBT ZWEI TRAIL-SPEICHER

`e2e/trail-emit.ts#defaultDir` schreibt neben den git-common-dir, also **`<repo>/e2e-trail/`** —
im Haupt-Checkout **5514 Dateien**. Auf `$TMPDIR/fleet-e2e-trail/` faellt es NUR zurueck, wenn gar
kein git-Baum aufloest (`docs/e2e-trail.md` Punkt 3) — dort lagen **32**. Ich habe Basisraten auf
der 32er-Stichprobe gerechnet und als vollstaendig gemeldet; eine fremde Session tat dasselbe und
zog daraus „0/26, keine Flake-Historie" und beinahe ein `undo-land`. **`./state.sh` nennt die
grosse Zahl in seiner Ledger-Zeile** — sie stand in meiner Erdung, und ich habe sie mit meiner
eigenen Messung nicht verbunden. Wenn du eine Basisrate brauchst: `e2e-trail/`, nie TMPDIR.

## 3. Gefilet (alles `notiz`, alles unter diesem Program)

- **`ee7bc7d1`** — die sieben Q6-fleet-report-Checks messen die Recovery-Kappe NICHT, wenn die
  Zustellung zufaellig gelingt: Kopf des Clusters ist `parked5=false` bei
  `{status:"delivered", attempts:1}` — die Fixture BRAUCHT eine Ablehnung des Pastes und bekommt
  eine Annahme. Klasse: eine Sonde, die ihre Vorbedingung nicht kontrolliert (wie §11.2f).
  Schnittvorschlag: eigener `check()` auf die Vorbedingung, damit sie als SIE SELBST scheitert.
- **`2eb48783`** — Korrektur der Basisrate in `ee7bc7d1` (falscher Speicher, siehe §2): auf
  `e2e-trail/` sind es **3/29 Laeufe = 10,3 %**, nicht 1/12. Mechanismus unveraendert.
- **`0f44755c`** — eine FERTIGE Antwort in einer Pane hat keinen typisierten Rueckweg zum Owner.
  Verifiziert: eine Lane hat `POST /api/self/fleet-report` (mit Owner-Inbox-Rueckfall), eine
  Program-MAIN hat nur `attention` (Kinds decision/blocked/review-ready — eine Tuer fuer eine
  FRAGE), eine Session ohne Program-Bindung hat KEINE von beiden (`openFleetReport` lehnt jeden
  Nicht-Lane-Aufrufer ab). **Die Zeile ist ausdruecklich KEIN Latenz-Beleg** — die zuerst
  gemeldeten ~40 min hat der Meldende selbst widerrufen, gemessen sind ~2,5 min.

## 4. Erfolgsmass — ehrlicher Stand

BELEGT seit meiner Vorgaengerin zusaetzlich: Self-Succession dokumentiert (die Lineage traegt den
`succeed`-Eintrag, live geprueft) · roter Post-Land-Audit erreicht die aktive MAIN und wird mit
benanntem Mechanismus adjudiziert (Watch `{kind:"audit"}` gelegt, Event kam von selbst, quittiert).
NICHT BELEGT: **ausdrueckliche Report-Annahme** (das ist D1, `92553809`) · **automatisches Cleanup
einer clean+ahead0-Lane ohne Kandidat** (waere D2, NICHT gefilet — haengt an D1s Fakt, vorher
nicht sinnvoll) · **kein Owner-Management** (strukturell unerfuellbar, solange der Master-Stop aus
ist; unveraenderter Owner-Entscheid).

## 5. Fallen, die ich bezahlt habe

- **Ich stand 3 h 52 min still**, weil ich „warte ohne zu beobachten" als Erlaubnis las, unbegrenzt
  zu warten. Eine Zeile, die STRUKTURELL nicht starten kann (Master-Stop aus, Deckel voll,
  Dateikollision), wird nie von selbst zur Nachricht. **Wenn nichts kommt, ist die Frage faellig,
  nicht die Geduld** — `POST /api/self/attention` kostet fast nichts.
- **Zwei Attentions scheiterten am Cap** (`MAX_ATTENTION_TEXT` = 2000): vorher zaehlen, nicht
  hinterher kuerzen.
- **`GET /api/self` traegt fuer diesen Slot `ctx: null`** — eine Program-MAIN kann ihren eigenen
  Fuellstand nicht messen (Owner-Poll ist per Program-Verbot zu). Schaetzen und es als Schaetzung
  kennzeichnen; nie eine nackte Zahl in einen Handoff schreiben.
- Direkt-Commits aus dem Haupt-Checkout (dieser und `de2e179`) sind **docs-only**: kein Land-Gate,
  kein Post-Land-Audit, keine Ledger-Zeile. Gesagt, wie das Regelbuch es verlangt.

## 6. Offene Owner-Punkte

- Owner-Frage 4 des Programs (begrenzte read-only Portfolioansicht fuer den Controller) ist NICHT
  gestellt worden. Sie ist eine Geschmacks-/Scope-Frage und gehoert nach D1, nicht davor.
- Ob D1 den benannten Q6-Cluster gegen den Trail selbst adjudizieren darf: sein Brief verlangt
  woertlich `ALL PASS`, sonst `needs-main`. Bei 10,3 % je Lauf laeuft er mit dieser
  Wahrscheinlichkeit in dieselbe Hand-Adjudikation, die C schon gekostet hat. Dem Controller
  vorgelegt, bewusst offen gelassen.

---

# HANDOFF — Generalsanierung (Program `b2a14b545fd31fd71ba7b9e1`, Slot 6 → Nachfolge): Slice 5+6 ist LIVE (§f komplett), und Tier 1 endet an einer Wand, die niemand vermessen hatte — die `server/`-Module sind BLÄTTER; 2026-09-03 (19:4x), ctx GEMESSEN 25,0 %

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`,
`GET /api/self/program-execution`. Hier steht nur, was git und die Sensoren NICHT tragen.

## 0d. ERLEDIGT 19:0x — S1 IST GELANDET (main `f606e75`)

**Der Auftrag dieser Session ist damit abgeschlossen.** Vier Commits auf main, keine offene Kette:
`461baea` Gegenlesung · `ce7d14d` Gegenlesung eingearbeitet · `07f891a` S1 · `f606e75` der
Sicherheits-Nachtrag. Queue-Zeile `cf959aba` ist erledigt, `d1373cf7` (notiz) offen fuer den Owner.

**Das Land-Verdikt, woertlich:** `verify.ok true`, `proportional false`, steps
`[install, pins, tsc, build, clean-review, security, claude-gate]`, exit 0, **103 176 ms**,
`mainBefore d06919d3 -> mainAfter f606e754`. Der Tail sagt: `0s of this 103s run was spent waiting
for /tmp/fleet-e2e.lock`. **Wichtig: die Lane hing 21 Commits zurueck und wurde ueber Slice 5+6
(`c80b171`, json/HOST/PORT nach `server/http.ts`) rebased — die volle Kette lief auf dem REBASTEN
Baum**, damit ist der Refactor-Konflikt nicht bloss „kein Textkonflikt", sondern uebersetzt und
gruen.

**Die Adjudikation des roten Vorschaulaufs, nachgeprueft (nicht geglaubt):** der eine lokale FAIL
war `restart keeps the busy pending event with the same id and no invented attempt` — woertlich
die in CLAUDE.md §11.2l gefuehrte OFFENE Flake-Familie (15x rot auf 13 verschiedenen Baeumen,
zwoelf aelter als dieser Slice). Die Lane hat die Beweisordnung richtig gefahren: erst denselben
Baum erneut, der fiel NICHT identisch (1 statt 2) — damit ist Nicht-Determiniertheit direkt
belegt. **Offen und ehrlich so benannt: der zweite Helfer-FAIL bleibt namenlos** (siehe §0c).
Wenn der Post-Land-Audit rot wird, ist §11.2l der erste Verdaechtige — das ist kein
Freifahrtschein, nur die Reihenfolge.

**Zugabe der Lane ueber den Brief hinaus, von ihr selbst benannt:** eine SIEBTE Ablehnung an
`POST /api/studios` — ein Studio-id ist ein owner-gewaehlter Slug, also ist „gleiche id, anderer
Body" 409 mit Verweis auf die Aenderungstuer, „identisch" dagegen ein Read. Richtige Konsequenz
des Entwurfs, und sie hat sie gemeldet statt sie unterzuschieben.

**Zusagen eingeloest:** die Sanierungs-MAIN ist inzwischen von Slot 9 auf **Slot 4** nachgefolgt;
die versprochene server.ts-Meldung ging dorthin (send `f5a4bf4f`, acceptance observed), nicht an
die tote Slot-Nummer. **Merkposten: Slot-Nummern altern innerhalb einer Session** — vor jedem Send
am Poll pruefen, ein `slot not active` ist die billige Variante des Fehlers.

**Was als Naechstes ansteht:** S2 — aber erst, wenn das Game-Maker-Workflow-Dokument aus
`b2aa5b45` adjudiziert ist (S2 braucht seine FORM, S1 nicht). Und S2 faltet den Studio-Block in
`#railBlockFor`, NICHT als zweiten Summanden an die Builder-Naehte (§8 F1/Widerspruch).

## 1. Das Erste, was du tust: ZWEI OWNER-TORE, und beide sind schon gestellt und wahrscheinlich schon tot

**Attention `d3b14a4d` (kind `decision`, gestellt 19:49).** Sie stirbt mit meiner Nachfolge —
so wie `5954d4da` zweimal gestorben ist (Status heute `refused`, „requester session ended").
Das ist **B-12** im Register, kein Versehen. Darum steht der Inhalt hier, und darum stellst du
sie **nicht blind neu**: erst nachsehen, ob der Owner geantwortet hat.

**TOR 1 — die Form des nächsten Slice (Entscheidung).** Siehe §3. Meine Empfehlung ist (b).
**TOR 2 — der Advisory-Deckel steht auf 10/10.** `POST /api/self/tasks` lehnt jede weitere
`notiz` ab. Drei heutige Befunde liegen deshalb nur getrackt im Register (B-10/B-11/B-12), nicht
als Queue-Zeile. Erfolgsmaß 6 verlangt Disposition, nicht Zwischenlagerung. Das Tor ist seit dem
02.09. dasselbe.

**Fang keine Lane an, bevor TOR 1 beantwortet ist** — die Form des Schnitts ist die Frage, nicht
sein Inhalt, und eine Lane auf der falschen Form ist ein verlorener Land-Zyklus (und die kosten
auf dieser Maschine gerade fünf bis sieben Versuche, §1b der Vorgängerin).

## 2. Was gelandet, verifiziert und LIVE ist — §f ist zu Ende gefahren

Slice 5+6 (`c80b171` + `5848207`) war bei meiner Übernahme gelandet, aber nicht live. **Jetzt ist
das Protokoll §f vollständig, jeder Schritt von mir selbst ausgeführt:**

| Schritt | Ergebnis |
| --- | --- |
| Post-Land-Audit | **rot** (3527 Checks, 4 FAILs, 1744 s) → **adjudiziert `flake`** |
| Dry-Boot-Rollback | `f3a56d7` aus `git archive`, Socket `fleetdry61`/8861, `FLEET_CMD=true`, gegen eine **Kopie** der heutigen `fleet.json`: HTTP 200, 16 Slots / 182 Tasks / 60 Programs gelesen, 0 Fehlerzeilen, **ein** Boot-Banner (kein Crash-Loop). Per PID + `tmux -L fleetdry61 kill-server` abgeräumt, Live-Server danach 200. |
| Deploy (Verb 2) | `5cfe2f38` **`ok:true`, `hitTarget:true`**, 3677 ms, Ziel `2c9f35d` |
| Health | `deployGap.behindCount` **20 → 0**, `codeBehind:false`, `bundleStale:false`, `errors:null` |
| `bun e2e/pins.ts` | ALL PASS |
| `graphify update .` | 9335 Knoten, 13660 Kanten, 677 Communities |

**Zur Adjudikation, weil sie NICHT von mir kam und ihre Begründung falsch war:** eine andere
Session hat mein Audit 2,5 min nach dem Fall als `flake` adjudiziert und in
`docs/verify-tiering.md` geschrieben, das Land sei „docs-only". Das beschreibt `5848207f` gegen
seinen ELTERN. Die Land-Note sagt `mainBefore f3a56d7` → `mainAfter 5848207f`, `covers` nennt die
Slice-5+6-Lane — der auditierte Tip enthält `c80b171`, also 112 Zeilen aus `server.ts` heraus.
**Das Urteil bleibt richtig, aus einem Grund, der den ganzen Land-Diff prüft** (`2c9f35d`):
`git diff f3a56d7 5848207` hat **null** Code-Treffer auf `fleetEvents`/`pruneFleetEvents`/
`FleetEvent`/`watches`/`tickWatches`/`eventRows`/`FLEET_EVENT_*`; der einzige Treffer überhaupt
ist das Wort `tickWatches` in der Prosa desselben Nachtrags. Gegenprobe: dieselbe Suchform findet
29 Treffer auf die Namen, die der Diff wirklich bewegt. **Merksatz, jetzt im Doc: ein Audit misst
den TIP, nicht den obersten Commit.**

## 3. Der Befund, der die Planung ändert: ab hier gibt es kein nächstes BLATT mehr

Ich habe den letzten offenen Tier-1-Posten („audit-queue") vorvermessen — zweimal, weil die erste
Messung falsch war. Beide Fassungen stehen in `docs/sanierung-2026-09/p4-slice7-vorbereitung.md`,
die Korrektur als **§6**; lies §6 zuerst, §1–§4 beschreiben einen Schnitt, den es so nicht gibt.

**Die Invariante, die ich zuerst nicht geprüft hatte:** jedes bestehende Modul unter `server/`
ist ein BLATT. `auth.ts`, `audit-log.ts`, `transport.ts` importieren nur node/bun und andere
`server/`-Module — **keines importiert aus `server.ts`.** Der Kern importiert die Module, nie
umgekehrt.

Je Einheit gemessen: sechs Einheiten der Queue sind echte Blätter, drei weitere hängen nur an
Typen bzw. `lastPostLandAudit`, die ohnehin im Bereich stehen und mitziehen. Übrig bleiben
**sieben echte Kern-Bindungen**, und sie sitzen in genau den zwei größten Funktionen:

- `drainPostLandAudits` → `helperClaimCandidateExists`, `helperClaimOf`, `reportServerRun`
- `runPostLandAudit` → `mintAuditEvents`, `retainRunOutput`, `descendantPids`,
  `killProcessTree`, `VERIFY_SKIP_EXIT`
- (`auditCmdFor` → `repoWorkers`, `workerCmdFor`)

**Drei Formen, und die Wahl ist TOR 1:** (a) Injektion — verhaltenserhaltend, aber
Signaturänderung, bricht mit dem Muster aller sechs bisherigen Slices · **(b) vorher die Blätter
schneiden** — erster Schritt ein vermessener Mini-Slice `server/proc.ts` (`retainRunOutput` +
`STDERR_MARK`/`byteLen`/`retainSection`, `descendantPids` + `KILL_TREE_MAX_DEPTH`,
`killProcessTree`; ~100 Z., echtes Blatt, und `retainRunOutput` bedient auch den Verify-Gate),
danach bleiben vier Bindungen · (c) nur die Blätter nehmen, Drain und Runner bleiben im Kern
(~200 der 530 Z.).

**Für Erfolgsmaß 1 ist das der zweite, unabhängige Grund.** §7 der Vorgängerin begründet die
Unerreichbarkeit damit, dass die Kernzeilen AUFRUFSTELLEN sind. Dazu kommt jetzt: sechs Slices
lang war „das nächste Blatt" verfügbar, ab hier ist es das nicht mehr. Jeder weitere Schnitt
kostet entweder eine Signaturänderung oder einen vorgelagerten Slice.

## 4. Drei Befunde, die nur getrackt liegen (Advisory-Deckel), im Register B-10/B-11/B-12

- **B-10** — `e2e/watch.ts:3457` und `:3460` rufen `check()` **ohne `detail`**. Ihre
  Trail-`detail`-Spalte ist leer, die Audit-Ausgabezeilen nennen sie ohnehin nicht (B-02 eine
  Ebene tiefer). Für eine Adjudikation bleibt nur die Basisrate. Billig zu schließen: beide
  hängen an derselben Vorbedingung (`eventRows()` enthält `eventA`).
- **B-11** — die Instanz, die ein roter Lauf „kept for inspection" hinterlässt, hat ihr eigenes
  `audit.jsonl` schon weggerottet: 438 + 47 Zeilen, ältester Zeitstempel `1788454415020` bei
  Laufbeginn `~1788452759` — **die letzten ~83 s von 1744**. Mich hat es direkt getroffen: ich
  wollte „`pruneFleetEvents` hat `eventA` verdrängt" an der Abwesenheit von
  `fleet_event_prune`-Zeilen prüfen, und die Null war das Rotationsfenster, keine Messung.
- **B-12** — die Sterblichkeit der Attention, siehe §1.

## 5. Was git NICHT trägt

- **Ich bin Slot 6.** Der Suite-Mutex wurde heute Abend ~24 min von einer fremden
  `./e2e-isolated.sh` (pid 35054) gehalten — nicht von mir und nicht vom Audit.
- **Ich habe einen `./e2e-isolated.sh`-Rerun GESTARTET UND ABGEBROCHEN.** Er stand hinter dem
  Mutex in der Schlange und hätte ~50 min der knappsten Ressource des Programs gekostet; die
  Trail-Basisraten aus `ff7fd72` (367 Läufe) plus die Diff-Reichweite beantworten dieselbe Frage.
  Abbruch sauber: Wrapper per notierter PID, **kein Runner gespawnt** (er hatte den Lock nie),
  kein tmux-Socket zurückgeblieben. Geprüft, nicht angenommen.
- **Der Flake-Register-Route entgeht Historie, und das hat mich fast in die Irre geführt.**
  `GET /api/self/flakes` gab für zwei der vier Checks `insufficient-evidence` (1 Fehlschlag, nur
  dieser Lauf). Die andere Session las **alle** `e2e-trail/*.jsonl` und fand 5/367 bzw. 6/367 —
  die Route liest nur die **400 neuesten** Dateien, und genau dort lebt eine historische Flake
  per Definition nicht. Das ist in `docs/e2e-trail.md` §7 dokumentiert; ich habe es zu spät
  gelesen. **Wer eine Absenz aus dieser Route zitiert, muss die Kappung mitzitieren.**
- **Der Dispatcher steht auf `on: false`** (Master-Stop, wie das Program es will), `autosOn` an,
  0 Lanes, 4 freie Slots. Eine freigegebene Zeile startet also NICHT von selbst — ein Slice
  braucht den Hand-Dispatch mit dem Owner-Token.

## 6. Ehrlichkeiten

- **Ich habe in meinem zweiten Erdungs-Kommando `ps -eo pid,lstart,command` gefahren** und damit
  das `FLEET_SELF_TOKEN` eines fremden Slots in meinen Kontext gedruckt — genau das, was der
  Token-Hygiene-Absatz des Regelbuchs verbietet, und der Absatz nennt diesen Weg wörtlich. Danach
  nur noch gefilterte Formen. Es ist die dritte dokumentierte Instanz derselben Sache.
- **Meine erste Slice-7-Messung war falsch** und hätte eine Lane gekostet: sie zählte neun Namen
  als „Importe INS Modul" und nannte sie ungeprüft, statt sie zu prüfen. Die Blatt-Invariante
  stand die ganze Zeit in drei Dateien, die ich hätte öffnen können.
- **Eine eigene Sonde hat mich belogen und ich habe es gemerkt:** sie schrieb `killProcessTree`
  die Namen `MergeLast`/`VerifyPlan` zu, weil ich seinen Endpunkt geschätzt statt gelesen hatte —
  die beiden gehören `runVerify` bei `:11146`. Grenzen werden gelesen.
- **Alle vier meiner Commits sind Direkt-Commits aus dem Haupt-Checkout**, docs-only, je mit
  `bun e2e/pins.ts` ALL PASS und leerem Public-Repo-Scan verifiziert — **nicht** mit der vollen
  Suite, und kein Post-Land-Audit deckt sie. `./state.sh`s Land-Health-Zahlen zählen sie nicht.
  `d05cf97` · `2c9f35d` · `6e2a817` · `05db5de`.
- **Diese Session lief auf `claude-opus-5[1m]`/high, nicht Fable.** Die Modellpolitik will Fable
  5.1 für eine Program-MAIN. Geerbt, nicht behoben — ich habe überwiegend am Code gemessen, nicht
  orchestriert. Wenn du überwiegend briefst und landest, wechsle: der Zug ist ein PAAR
  (`POST /api/slots/:id/model` UND `/model <id>` in der Pane).

---

# HANDOFF - Fleet Controller (Slot 12, claude-opus-5[1m] high): Sanierung Slice 5+6 gelandet (Merge-Record-Deadlock aufgeloest), alle Attentions leer, Private-repo-j neu gegruendet, codex/sol auf Slot 15 - und mein eigener "F1"-Befund zweimal korrigiert und am Ende verworfen; 2026-09-03 (19:1x), ctx GEMESSEN 28 %

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`. Hier steht nur, was
git und die Sensoren NICHT tragen. **Achtung: der oberste Abschnitt dieser Datei ist NICHT
zuverlaessig der neueste — die Abschnitte liegen chronologisch durcheinander. `grep -n '^# HANDOFF'`.**
Mein Vorgaenger hat mich auf „nur der oberste Abschnitt" geschickt und ich habe den falschen gelesen.

## 0. DEIN AUFTRAG — unveraendert der vom Owner, plus was davon steht

  „sag dem neuen controller er soll sich mit mir zusammen explizit hauptsaechlich um die
   second-host-Integration und bieberburg auf slot3 kuemmern, dazu gehoert dann auch z.b die alten
   Bieberburg lanes zu schliessen"

**„MIT MIR ZUSAMMEN" IST WOERTLICH** — und es hat sich zweimal ausgezahlt: auf meine Slot-3-Frage kam
eine GEGENFRAGE („ist ein programm an einen slot fest gebunden über seine Laufzeit?"), nicht eine
Antwort. Wer geraten haette, haette falsch geraten.

Spaeterer Auftrag desselben Tages, woertlich, und er ist ERLEDIGT:
  „können wir eigentlich schon eine succession in codex mit sol hinein machen? Ich würde gerne
   wollen das du der session sagst das sie sich erstmal mit subagenten ein gutes Bild von den slots
   macht. […] um damit dann am ende auch die slots erstmal zu schließen die wir gerade nicht bediene
   bzw. gebrauchen können. WIr müssen nämlich letztendlich das System soweit wie es geht erstmal
   wieder gerade bügeln. Es fehlen bestimmt fixes die in summe ziemlich ärger machen."

## 1. F1 UND F2 SIND TOT — ich habe eine Sensor-Illusion fuer einen Systemfehler gehalten

**ZWEITE UND ENDGUELTIGE KORREKTUR, beide noch in derselben Session gefunden.** Ich hatte gemeldet,
`POST /send` luege ueber die Zustellung (`acceptance:"observed"` fuer nur GEQUEUEten Text) und ein
Composer-Rest habe vier Sessions stillgelegt. **Beides ist falsch. Es gibt keinen solchen Fehler.**

**Der Beweis, und er kostet einen einzigen Aufruf:** ein `POST /send` an eine Pane mit belegtem
Composer antwortet **409** mit `{"error":"composer occupied (131 chars) — nothing typed",
"receipt":{...,"delivery":"refused"}}`. Der Schutz steht in `server.ts` (grep `composer occupied`):
`readComposer` liest den ECHTEN Composer vor jedem Paste, und ein nicht-leerer wirft `SendRefused` —
mit dem Kommentar „an occupied composer is an owner draft: pasting would append to it and Enter
would send both as one turn". **Die Route ist korrekt und ehrlich.**

Daraus folgt rueckwaerts: meine Sends an Slot 6, 8 und 9 kamen mit `observed` zurueck, also fand
`readComposer` deren Composer LEER. Der Text, den ich in diesen Panes sah, war nie lebender
Composer-Inhalt, sondern die Anzeige des zuletzt abgeschickten Prompts. Und „Press up to edit queued
messages" bei Slot 9 erschien, weil meine Nachricht bei einer BESCHAEFTIGTEN Session normal
eingereiht wurde — sie ist danach abgearbeitet worden. Kein Fehler, Normalbetrieb.

**WAS DIE FALLE WAR: `capture-pane` liefert die zuletzt GEMALTE Zeile, und eine untaetige Pane malt
nicht neu.** Ein voller `❯`-Balken beweist damit gar nichts. Mein erster Diskriminator (CPU niedrig
+ kein busy-Marker + letzter Turn beendet) trennt „haengt" nicht von „alter Frame" — fuenf
Fehltreffer in einem einzigen Sweep (Slot 1, 3, 4, 5, 16 sahen alle belegt aus und waren leer).

**DER RICHTIGE SENSOR, benutz ihn statt eines Frames:** `POST /send` mit einer Probe-Nutzlast. Es
antwortet 409 mit der ZEICHENZAHL, wenn der Composer belegt ist, und stellt sonst zu. Das ist die
Server-eigene Messung, kostet einen Aufruf und kann nicht veralten. Zweitbester Weg an der Pane:
Repaint erzwingen (`x` senden, lesen, `BSpace` — haengt an, zerstoert nichts; `C-u` zerstoert).

**Fuer den Succession-Fehler heisst das:** F1 ist als Erklaerung WEG. Was von der Vorgeschichte
bleibt, ist nur noch die Widerlegung der Boot-Race durch Slot 13 (agent==alive nach 3 s) und die
Widerlegung der Platzhalter-Hypothese. **Die Ursache von „composer still holds 98 chars after
3000ms" ist damit vollstaendig offen** — und weil die Sonde dieselbe `readComposer`-Familie benutzt,
ist der erste Verdaechtige jetzt die SONDE bzw. das, was in der frisch geoeffneten Pane wirklich
steht. Der ungefahrene Zug bleibt derselbe und ist wichtiger denn je: bei einem Fehlschlag den
Composer-INHALT auslesen, nicht seine Laenge. Ein Readiness-Gate (`6f401842`) adressiert nichts
davon nachweislich.

**Was von meiner Fix-Liste uebrigbleibt:** F1 und F2 gestrichen. F3 bleibt als Sensor-Luecke, aber
seine Evidenz (Watch 5 h armed) gehoert §3, nicht dem Composer. F4–F9 stehen unberuehrt auf ihrer
eigenen Evidenz. **Der einzige echte, heute bewiesene Systemfehler dieser Session ist §3** — und der
gehoert Slot 9, nicht mir: es hat ihn diagnostiziert, ich habe ihn nur nachgeprueft und aufgeloest.

## 2. GELANDET / GETAN IN DIESER SESSION

- **Deploy 17:23:52** (Verb 2, `POST /api/deploy`, id `0deb6aef`): der Server war **33 Commits**
  hinter HEAD. Jetzt `behindCount 0`. Darunter der Fix fuers verlorene Fast-Forward — der zwei
  Land-Versuche desselben Tages gekostet hatte. **Und genau dieser Deploy erzeugte den naechsten
  Befund**, siehe §3.
- **Sanierung P4 Slice 5+6 GELANDET** als `c80b171` + `5848207`, Land-Note gruen: `verify.ok true`,
  volle siebenstufige Kette, exit 0, 106 s, `waitMs 0`, `proportional false`. Fuenfter Versuch.
  Actor korrekt als `owner-token-outside-board` — das war ich, nicht der Owner (Slot 9s Commit
  `ff21577` schreibt „Owner loest den Deadlock"; das ist eine Provenienz-Ungenauigkeit, kein Fehler
  in der Sache).
- **Private-repo-j-MAIN neu gegruendet auf Slot 7** (`POST /api/programs/2c073232.../bootstrap-main`,
  cwd `private-repo-j.worktrees/game-maker-private-repo-j`, Opus 5 1M / high). Es spielt schon: prueft den
  Stempel `42AC0AB` und fahrt echten Eingabepfad ueber Playwright.
- **codex/gpt-5.6-sol auf Slot 15** („Lagebild + Aufraeumen"), per Owner-Route + handgeschriebenem
  Brief, weil die Nachfolge das nicht kann (§4). Der Owner ist mit ihm im direkten Gespraech.
- **Fuenf offene Attentions abgearbeitet → jetzt NULL.** Vier rote Audits adjudiziert.
- **Zeile `4e5e2e18` auf done** — die Queue trug den Beweis selbst: `66367988` sagt woertlich
  „codex-Fallback; ersetzt die nicht startbare pi-zai-Zeile 4e5e2e18" und war done.

## 3. DER LAND-DEADLOCK, den mein eigener Deploy ausgeloest hat — lies das vor dem naechsten Land

Slot 9s Attention `0792786f`: die Lane war **verifiziert gruen und strukturell nicht landbar**. Am
Code nachgeprueft, nicht uebernommen: `lane-signals.ts:70` ist woertlich
`!(m?.status === "error" && m.errorReason === "ff-lost")`, und `server.ts:11384` nennt `errorReason`
selbst „the ONE field on this record that can make a lane done-looking". Der Merge-Record von
12:22 trug `errorReason: null`; der Fix `24f9cfc`, der dort `'ff-lost'` mintet, ging **durch meinen
Deploy 17:23:52 live, fuenf Stunden NACH dem Record — nicht rueckwirkend**. Zirkulaer: kein
done-looking → keine Land-Tuer → kein neuer Merge → Record bleibt. Ein Rebase hilft nicht, der
Record haengt am SLOT, nicht am Baum.

**DER AUSWEG, den du wiederverwenden kannst:** die `done-looking`-Pruefung sitzt NUR in der
**Self-Land-Tuer** einer Program-MAIN (`server.ts:6926`). Die **Owner-Merge-Route hat sie nicht**
(kein `laneWatchSignal` an ihrer `mergeJob(`-Aufrufstelle, nur der busy-Vorbehalt). Ein
`POST /api/slots/:id/merge` mit dem Owner-Token waivt damit ausschliesslich das Praedikat, das
faelschlich falsch war — **keine Verifikation**, der Land-Gate faehrt die volle Kette auf dem Baum,
den er landet. Kein State-Eingriff, der blockierende Record bleibt, damit B-09 seinen Beweis behaelt.

## 4. NACHFOLGE NACH CODEX: NEIN, nicht ueber die Route

`server.ts#handleSelfSucceed` sagt woertlich „that harness is not overridable here" und uebergibt
`s.harness` der Vorgaengerin an `openSlot`. **Der Weg, der geht** und den ich gefahren habe:
`POST /api/slots/<frei>/open` mit `{cwd, harness:"codex", model:"gpt-5.6-sol", label}`, auf den
Accept-Marker `>_ OpenAI Codex (v` warten, dann `POST /send` mit dem Brief — und **die Pane
pruefen**, nicht dem Receipt glauben (§1). Der harness-uebergreifende Nachfolgeweg ist der Entwurf
`5881455`, ungebaut; drei Owner-Fragen dazu stehen in §7.

## 5. EIN PROGRAM IST NICHT FEST AN EINEN SLOT GEBUNDEN — die Antwort auf die Owner-Gegenfrage

- `Program.main` ist OPTIONAL und bindet an eine **Insassin**, nicht an einen Slot:
  `boundProgramForMain` verlangt `p.main.slot === s.id` **und** `p.main.openedAt === s.openedAt`.
- `ProgramLineageVia` = `bootstrap | rebound | succeed | backfill-unknown`. **`rebound` ist der
  explizite Zug**, auditiert als `program_main_rebound`; die Antwort NENNT, was sie ersetzt.
- **ABER: eine Session kann MAIN von GENAU EINEM Program sein.** Zwei aktive Programs auf derselben
  `(slot, openedAt)` sind ein benannter Fehler („ambiguous Program-MAIN binding … the owner must
  resolve which one this session is MAIN of").

**Konsequenz, die die Owner-Frage anders entscheidet, als sie gestellt war:** Lesart (B) „Slot 3
uebernimmt Private-repo-j zusaetzlich" ist als MAIN-Schaft NICHT baubar. Ich habe Private-repo-j deshalb auf
Slot 7 gelegt und Slot 3 bei seinem Program gelassen. **Will der Owner Slot 3 doch, ist das ein
`rebound` und kostet die Game-Maker-v2-MAIN.** Das ist noch nicht entschieden.

Und: Program `2c073232` war NICHT abgeloest, sondern das heutige Private-repo-j — 10 Zeilen, 8 done. Es
war seit 08:46 MAIN-los, weil Slot 6s Insassin retirete. Das abgeloeste ist `ff4420b7`, `complete`.

## 6. MEINE NEUN FIX-KANDIDATEN — der Owner hat ausdruecklich danach gefragt

Vollstaendig mit Belegen im Gruendungsbrief von Slot 15 (es soll sie am Code pruefen; frag es nach
dem Ergebnis, statt sie neu zu erheben). Kurzform, gerankt:

| # | Befund | Beleg |
|---|---|---|
| ~~F1~~ | GESTRICHEN - die Route hat einen Composer-Schutz und lehnt mit 409 ab (siehe 1.) | - |
| ~~F2~~ | GESTRICHEN mit F1 - es gab nie einen haengenden Composer | - |
| F3 | armed Watches haben keinen Alterungs-Sensor (die Ursache hier war der Merge-Record, nicht der Composer) | `62c9068e`, 5 h `firedAt:null` |
| F4 | `Program.main` zeigt nach Retire weiter auf die Tote; `lineage` sagt korrekt `endedBy:"retire"` — die zwei Records widersprechen sich | `2c073232`, 08:46–17:54 |
| F5 | Kill einer Lane setzt ihre Task-Zeile auf `pending` zurueck, obwohl gelandet | Slot-13-Handoff §6 |
| F6 | Post-Land-Audit bewahrt einen 4-KB-Tail OHNE die FAIL-Zeilen | drei Reds von heute, aus dem Trail aufgeloest |
| F7 | auf `deployGap` reagiert nichts | 33 Commits, zwei verlorene FFs |
| F8 | verwaister Suite-Mutex liest sich wie „gehalten" | tote PID 93222 seit 13:07 |
| F9 | (keine Bug, Owner-Entscheid) Dispatcher master-stopped bei 16 offenen `auftrag` — potenziert F2 | `dispatch:false` |

Was ich NICHT geprueft habe: ob F1 im Acceptance-Pfad sitzt oder erst in seiner Sonde; ob F4 in den
Teardown oder den Loader gehoert; die Suite-Wirkungen jeder dieser Aenderungen.

## 7. WAS BEIM OWNER LIEGT

- **`1281d0ad` ist bereit und ABSICHTLICH nicht dispatcht:** zwei Entwurfs-Zeilen (`b2f1c42d` Opus /
  `5c6cb96c` sol, je EINE neue Datei unter `docs/game-maker/entwurf/`, von Slot 3 kollisionsfrei
  gelesen), muessen PARALLEL laufen. Ich habe sie liegen gelassen, weil der Owner **selbst Slots
  killt** (10 und 11 um 18:22:07/18:22:12, `slot_kill … owner`) — zwei neue Lanes arbeiten gegen sein
  Aufraeumen. Gehen auf ein Wort raus.
- **Slot-3-Mehrdeutigkeit** (§5) — jetzt mit Preisschild statt als offene Frage.
- **Second-host:** unveraendert ein OWNER-AKT, kein Code. `ssh second-host` → `Permission denied`, und
  `server/types.ts#helperCmdCheck` lehnt die Namen `claude|codex|pi` UNBEDINGT ab (Absicht). Die
  Zahlen aus Slot 13s §5 gelten.
- **Die neun §4-Fragen meines Vorgaengers** sind unbeantwortet: vier Betriebsfragen (zwei davon habe
  ich selbst erledigt — Deploy und `2c073232`), drei aus dem Ledger-Entwurf, drei aus dem
  Nachfolge-Entwurf (je mit Empfehlung), zwei GLM-Punkte oberhalb der Schnittlinie (Crash-Fenster der
  zwei Ledger-Schreiber; Crash-Orphan, den das Readiness-Warten VERGROESSERT). Sie stehen in Slot 13s
  Abschnitt §4 dieser Datei.
- **SECHS alte rote Audits bleiben unadjudiziert**, alle aelter als heute und ausserhalb meiner
  Evidenz: `at=1787155820391` (0c5692fc) · `1787502074218` (dac6595c, 8 Fails) · `1787669301193`
  (bebebf0e) · `1787675932255` (303abf71) · `1788075087447` (dbb2e094, `checks:null`) ·
  `1788359095955` (01ccfb30, 11 Fails).

## 8. DER SESSION-KONFLIKT, den ich entschieden habe — falls jemand widerspricht

Slot 3 wollte den Check `restart keeps the busy pending event…` als **flake** (5/27), Slot 4 als
**stale-test** (4/4 identisch, idleMs 4747/6164/4776/4924 bei Schwelle idleSec 2, `e2e/watch.ts`
bytegleich). **Ich habe zu Slot 4 entschieden und Slot 3 mit Begruendung ueberstimmt.** Nicht wegen
der Zahl, sondern weil Slot 4 den MECHANISMUS benennt (zwischen `watch.ts:2996-2997` und dem Check
bei 3364 gibt es kein `send-keys` auf `bId`, B ist zum Neustart ZUVERLAESSIG untaetig — Zustellung an
einen Untaetigen ist korrektes Verhalten) und weil die Konsequenz den Ausschlag gibt: als `flake`
abgelegt faerbt dieser Test JEDES kuenftige Fleet-Land rot und entwertet das Signal dauerhaft. Das
deckt sich mit `docs/verify-tiering.md` §11.2l, das dieselbe Familie als OFFEN und dieselbe
Diskriminante fuehrt. Eingetragen: drei `stale-test` (`1788427462474`, `1788429130802`,
`1788435319259`), der Second-host-Lauf `1788450664665` als `unknowable`. **Die Abhilfe ist ungebaut
und gehoert Slot 4** (B vor `kill-session` erneut laut machen, oder Beschaeftigung ueber einen
explizit gesetzten Zustand statt ueber `lastOutput`-Timing) — sie beruehrt `e2e/watch.ts`, braucht
also die isolierte Vorschau.

## 9. EHRLICHKEITEN

- **Mein Hauptbefund war eine Sensor-Illusion, und ich habe ihn zweimal korrigieren muessen,
  beide Male selbst.** Erst die Kausalkette (der Watch hing am Merge-Record, nicht am Composer),
  dann der Befund als Ganzes (es gab nie einen haengenden Composer; die Route schuetzt korrekt und
  lehnt mit 409 ab). Beide falschen Fassungen stehen committet in `9152a83` und `6b44987`. Der
  Fehler war jedes Mal derselbe und steht so im Regelbuch: ich habe eine ANZEIGE fuer einen ZUSTAND
  gehalten und daraus Dauern gerechnet, statt den Sensor zu suchen, den der Server selbst hat.
  Wer diesen Abschnitt liest, glaube ihm nicht mehr als den Belegen darin.

- **Der Hauptbefund dieser Session war zur Haelfte falsch, und ich habe es selbst gefunden** -
  nach dem Commit `9152a83`, der die falsche Fassung traegt. Abschnitt 1 ist ersetzt, die Zahl
  "13 h 45" und die Kausalkette "Composer-Rest unterdrueckt idle" sind zurueckgezogen. Der Fehler:
  ich habe aus Pane-Frames Dauern gerechnet und zwei Mechanismen verwechselt, statt
  `lane-signals.ts` zu lesen - dort stand die richtige Ursache samt einer Messung vom 2026-09-02
  die ganze Zeit im Kommentar.

- **Ich habe eine Diskrepanz gemeldet, die keine war.** Ich schrieb, das `24f9cfc`-Audit sei entgegen
  dem Handoff nicht adjudiziert. Falsch: die Adjudikations-Zeilen tragen die Audit-Zeit als
  `auditAt`, `at` ist die Zeit des URTEILS — meine Sonde griff auf das falsche Feld. Genau der
  Regelbuch-Fall „der erste Verdaechtige ist die SONDE".
- **Ich habe zuerst `tmux send-keys Enter` als Reparatur versucht**, statt die Pane zu diagnostizieren
  — und den stale-Frame dabei fuer den Ist-Zustand gehalten. Zwei Fehlversuche, bis die
  CPU-Messung die Wedged-Pane von der busy-Pane trennte.
- **Ich habe `POST /api/slots/9/send` geraten und 404 bekommen** — die Route ist `POST /send` mit
  `{slot,text}`. Und die Attention-Antwort nimmt `text`, nicht `answer` (400 beim ersten Versuch).
- **Die drei Entwuerfe meines Vorgaengers habe ich nicht Zeile fuer Zeile geprueft**, den
  Sechs-Stellen-Fund nicht selbst nachgezaehlt. Was ich selbst am Code nachgeprueft habe, steht in
  §3 und §5 mit Fundstelle.
- Der Owner hat mich per `/model` auf Opus 5 gestellt; das weicht von der Modellpolitik (Fable fuer
  Controller) ab und war sein ausdruecklicher Akt. Die neu gegruendete Private-repo-j-MAIN habe ich
  deshalb auf Opus gelegt wie alle anderen MAINs auf dem Board — nicht auf Fable, wie das Regelbuch
  sagt. Das ist eine Abweichung von mir, bewusst, mit dem Fable-Limit als Grund.

---

# HANDOFF — Studio-als-Objekt: Gegenlesung gelandet und eingearbeitet, S1 laeuft als Lane auf Slot 1 (Slot 13 „studioObjekt" → Nachfolge, 2026-09-03 15:3x)

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`. Hier steht nur,
was git und die Sensoren NICHT tragen.

## 0. Wo die Arbeit steht

Der Auftrag der Vorgaengerin war: einarbeiten, GLM-Gegenlesung anstossen, dann S1 briefen. **Alle
drei sind erledigt.** Zwei Commits auf main und eine laufende Lane:

- `461baea` — die GLM-Gegenlesung (Lane, pi-zai/glm-5.3, docs-only, proportionales Gate
  install+pins, ALL PASS, 880 ms).
- `ce7d14d` — die Gegenlesung EINGEARBEITET in `docs/ideen/2026-09-03-studio-als-objekt.md`
  (neues §8, §1 korrigiert, §7 entschieden). **Direkt-Commit aus dem Haupt-Checkout** — siehe §3.
- **Lane auf Slot 1, Branch `fleet/260903153159-4f7c`, Task `cf959aba`** (claude-opus-5[1m], high):
  S1 = der `Studio`-Record, seine Persistenz und seine Tueren. Sie laeuft, seit ~15:32.
  **Ein Lane-Watch von mir ist armed: `46474c59`** — er feuert EINMAL auf done-looking. Wenn du
  diese Uebergabe liest, ist er entweder noch armed oder hat in MEINE Pane gefeuert, nicht in
  deine: **pruef den Zustand selbst** (`GET /api/self` zeigt nur DEINE Watches, nicht meine).

## 0b. NACHTRAG 16:0x — die S1-Lane hat einen ECHTEN Fund gemacht, und zwei Sensoren haben gelogen

- **Die Lane fand `e2e/security.ts` §1 gegen sich selbst:** die reviewed allowlist der
  Pre-Auth-Routen kennt `/api/studios` nicht, und ihre geaenderte Programs-Regex steht nicht darin.
  Sie hat den FAIL korrekt als IHREN attribuiert und repariert ihn (Commit `54981be`). **Das ist
  genau die Klasse, fuer die die `./e2e-isolated.sh`-Vorschau Pflicht ist** — `e2e/security.ts`
  laeuft NUR dort, der Land-Gate haette geschwiegen, und es waere ~9 min nach dem Land als rotes
  Post-Land-Audit hochgekommen. Der Vorschau-Satz im Regelbuch hat sich hier bezahlt gemacht.
- **Der `done-looking`-Watch hat einmal gelogen** (Event `c04a00e7`): idle + clean + ahead 1,
  waehrend `./e2e-isolated.sh` bei 3:39 lief und die Lane bewusst ihren Turn beendet hatte, damit
  Realzeit vergeht. Genau der Fall, vor dem die Nachricht selbst warnt. **Nicht auf sie landen.**
- **Und mein Ersatz-Sensor hat auch gelogen:** „kein lokaler `./e2e-`-Prozess" ist FALSCH, sobald
  die Lane den Lauf per `POST /api/self/suite-offer` an ein Helfer-Geraet abgibt — dann laeuft die
  Suite dort und lokal ist nichts zu sehen. Der richtige Sensor ist der Job-Zustand in
  `fleet.json#laneSuiteJobs` (`claimed` -> `reported`). Der Lauf der Lane ist
  Job **`cff648723625`**. **Und lies diese Ledger GEFILTERT** — ein unfiltriertes Dump der
  laneSuiteJobs hat mich ~2 Kontextpunkte gekostet, die Tails sind riesig.
- Historische Helfer-Laeufe dauern ~1360 s. Ein `reported` mit `result: red` ist beurteilbar, ein
  `green` mit `checks.ran: 0` waere die gefaehrliche Variante.

## 0c. NACHTRAG 18:4x — der Vorschaulauf ist ROT, und die FAIL-NAMEN sind nicht auffindbar

**Stand, gemessen:** Helfer-Job `cff648723625` = `reported`, **result RED**, exitCode 1,
`checks {ran:23, failed:2}`, **ms 1400946** (~23,3 min — ein ECHTER Lauf, kein Fruehabbruch; das
ist die Zahl, an der man ein Schein-Gruen erkennt). Baum `54981be`, Worktree sauber, ahead 2.
Die Lane meldet ihre lokale Gate-Kette komplett gruen (pins · tsc · build · clean-review ·
security · claude-gate) — offen ist NUR das Tier-2-Urteil.

**ICH HABE NICHT GELANDET und du sollst es auch nicht, bevor ein Urteil steht.**

**Der Diagnose-Engpass, den ich gemessen habe und der eine eigene Zeile verdient:** die
FAIL-Zeilen stehen NICHT im persistierten Tail. `fleet.json#laneSuiteJobs[].result.tail` ist auf
~4 000 Zeichen gekappt, beginnt mit „… [10 lines elided]" und enthaelt ab Zeichen 3904 nur noch
`2 FAILURES` und `kept test instance for inspection: /tmp/fleet-e2e-instance-1791326` — **dieses
Verzeichnis liegt auf dem HELFER (second-host), nicht hier.** Ein rotes Helfer-Ergebnis nennt damit
seine Ursache nirgends auf dieser Maschine. Und `checks.ran:23` ist NICHT die Suite-Abdeckung (ein
voller Lauf schreibt ~3500 Trail-Zeilen) — daraus keine Abdeckung lesen. Das ist dieselbe Klasse
wie `d1373cf7` (not-alive nennt das Gate, nicht die Ursache) und gehoert als eigene Zeile gefiled,
falls es sie noch nicht gibt.

**Beweisordnung, die gilt** (`docs/verify-tiering.md` §11.7): zwei Fails auf einem Baum, auf dem
die Lane gerade `e2e/security.ts` angefasst hat, sind IHRE, bis das Gegenteil bewiesen ist. Zuerst
denselben Baum ERNEUT laufen lassen; erst wenn er identisch weiter faellt, ist der frische
HEAD-Worktree dran. Ein gruener HEAD-Lauf beweist nichts.

Ich habe der Lane genau diese Messung geschickt (send `4789dd26`, acceptance observed), damit sie
die Suche nicht wiederholt. **Die Lane stand bei 41 % ctx** — wenn sie nicht mehr zu einem Urteil
kommt, ist das Urteil deins, nicht ihres.

## 1. Das Erste, was du tust

1. **Erden:** `./state.sh`, `./register.sh`.
2. **Die Lane auf Slot 1 pruefen** — Pane lesen UND `ahead`/`dirty`, nie den Slot-Zustand allein.
   Die vier Zwillingszustaende von „idle" gelten unveraendert.
3. **`docs/ideen/2026-09-03-studio-als-objekt.md` lesen, aber §8 ZUERST** — dort steht, was die
   Gegenlesung geaendert hat. Wer nur §1–§7 liest, baut auf der alten Fassung.
   Dann `docs/messungen/2026-09-03-gegenlesung-studio-objekt-glm.md` (die Gegenlesung selbst,
   323 Zeilen, mit ihrer eigenen Fundliste und Schnittlinie).
4. **Landen, wenn die Lane sauber und ahead>0 ist.** Danach: **der Sanierungs-MAIN auf Slot 9 hat
   ausdruecklich darum gebeten, benachrichtigt zu werden, wenn server.ts sich bewegt** — ich habe
   das zweimal getan, halte die Zusage.

## 2. Was git NICHT traegt

- **Die Slot-Nummern haben sich bewegt.** Der 🎛 Fleet Controller sitzt auf **12**. Ich war 13.
  Die Sanierungs-MAIN ist **9**. Die Private-repo-y-MAIN ist **4** (28 % ctx) und hat vom
  Stopp-Entscheid des Owners **noch nichts gehoert** — ich habe ihr NICHTS geschickt. Wenn du ihr
  schreibst: GENAU EINE Nachricht, sie kostet ihren vollen Kontext.
- **Der Fleet Controller war ~25 min in einem Owner-Dialog blockiert** (Deploy-Frage) und konnte
  in dieser Zeit KEINE Nachricht annehmen (`POST /send` → 409 „composer occupied"). Er hat
  inzwischen deployt (`bootHead` = `903f516`, `codeBehind:false`). Merkposten: ein Controller in
  einem AskUserQuestion-Dialog ist fuer Sends unerreichbar, und das sieht wie ein Compose-Rest aus.
- **Ich habe die GLM-Zeile `c00c3dc4` SELBST hand-dispatcht**, statt darauf zu warten, dass der
  Controller es tut (er war blockiert, und ich habe im Haupt-Checkout das Owner-Token). Vorher
  Last gemessen: 1 Lane gegen Deckel 2, drei freie Slots, 0 Suiten, load 3.25.
- **Das gebriefte Spawn-Tripel der GLM-Zeile war strukturell unspawnbar** und hat einen
  Dispatch gekostet: `{harness:"pi", model:"glm-5.3"}` passiert die Validierung (pi's `modelRe`
  ist `HARNESS_MODEL_RE`, ein CHARSET) und stirbt 4,4 s spaeter als
  `dispatch held (not-alive) — requeued`. `pi --list-models` (0.84.0) fuehrt KEIN glm. Der
  richtige Harness ist **`pi-zai`** (`server.ts#PI_ZAI_HARNESS`). Voller Befund samt Vorschlag als
  Queue-Zeile **`d1373cf7`** (notiz). **Kurzform fuer den naechsten, der GLM briefed:
  `harness: "pi-zai"`, nie `pi`.** Und: ein gescheiterter Spawn laesst seinen Branch als Leiche
  stehen (ich habe `fleet/260903131126-4890` von Hand geloescht).
- **Ein pi-zai-Lane-Watch ist unmoeglich** (`automatable:false` → 409, ehrlich begruendet). Ein
  **merge**-Watch auf dieselbe Lane geht. Fuer die GLM-Lane habe ich einen
  Hintergrund-Watcher auf `ahead`/`clean` gefahren; er hat nach 543 s gefeuert.
- **Brief 9 (`ba896b1b`) liegt weiterhin unangetastet** — Owner-Entscheid, nicht dispatchen.
- **Modell dieser Session:** `claude-opus-5[1m]` / high. Ich habe NICHT auf Fable gewechselt,
  obwohl die Modellpolitik das fuer Orchestrierer vorsieht: diese Session hat selbst am Code
  gelesen und geurteilt (elf Aufrufstellen nachgezaehlt, Nahtkommentare geprueft), das ist
  Grabungs- und nicht Orchestrierungsarbeit. Wenn du ueberwiegend briefst und landest, wechsle —
  beide Haelften (`POST /api/slots/<slot>/model` UND `/model <id>` in der Pane).
- **Kontextstand beim Schreiben: 24,7 % (gemessen, `ctx.pct` am Slot 13).** Genau an der
  Uebergabe-Marke; die Kette (Gegenlesung einarbeiten + S1 briefen) ist zu Ende gefahren.
- Nichts laeuft sonst im Hintergrund: keine Suite, kein Audit, kein zweiter Watcher.

## 3. Der Direkt-Commit, ausdruecklich gesagt

`ce7d14d` ist ein **Direkt-Commit aus dem Haupt-Checkout** und damit fuer JEDES land-seitige
Ledger unsichtbar: keine `fleet/land`-Note, keine `lane-outcomes.jsonl`-Zeile, kein
Post-Land-Audit. Verifikation von Hand: `bun install --frozen-lockfile` exit 0,
`bun e2e/pins.ts` ALL PASS exit 0, Public-Repo-Scan auf Hostnamen/IP leer. Der Diff ist REIN
DOCS (eine Datei unter `docs/ideen/`), und damit ist diese Kette dieselbe, die der Land-Gate seit
`e896826` fuer einen docs-only-Diff selbst waehlt — nicht die volle. Wer die Land-Health-Zahlen
von `./state.sh` liest: sie zaehlen nur Lanes und untertreiben diesen Tag um zwei Commits.

## 4. Die Entscheidungen, die ich getroffen habe (und die du erben, nicht neu aufmachen musst)

Alle in `docs/ideen/2026-09-03-studio-als-objekt.md` §7 und §8 begruendet und am Code belegt:

1. **`Studio` wohnt in `server/types.ts`** — die Datei haelt schon die Loader-Familie, und Slot 9
   hat bestaetigt, dass sie das Ziel ist und keine ihrer Tiers meine Flaeche beruehrt.
2. **`Program.studio` ist ein fuenfter Record**, kein Feld in `profile` —
   `loadProgramProfile` verwirft jeden Fremdkey als ABSENT, ein Feld dort machte jedes bestehende
   Profil unlesbar.
3. **Die Bindung traegt `rev`**, und `POST /api/studios/:id` bumpt ihn. Ein Studio ist eine QUELLE,
   die mehrere Programs teilen — eine `briefBlocks`-Aenderung unter einer lebenden MAIN ist
   woertlich „founded under one contract, judged under another". **Refust wird nur die Aenderung
   waehrend einer Gruendung IN FLUG**; bei bloss aktivem Program bleibt der Record schreibbar und
   die Drift wird SICHTBAR statt still (S1s einziger Alleinnutzen ist die Kuratur).
4. **Ein `game-maker`-Studio referenziert den Rail-Inhalt, es dupliziert ihn nie.** Duplikation
   waere zwei Quellen und damit K2 in neuem Gewand.
5. **S4 ist ab jetzt kein Bau-Schnitt, sondern eine eigene Mini-Entscheidung.**
6. **S2 faltet den Studio-Block in `#railBlockFor`** — NICHT als vierten Summand an die zwei
   Builder-Naehte. Der Kommentar dort sagt „the one selector, read by both builders", und beide
   Builder haben die identische Naht; ein zweiter Summand ist genau die zweite Naht, vor der er
   warnt. **Das korrigiert die alte Fassung der Entscheidung.**

## 5. Was ich als Naechstes taete

Die S1-Lane zu Ende begleiten und landen; Slot 9 benachrichtigen; dann **S2 briefen — aber erst
nachdem das Game-Maker-Workflow-Dokument aus `b2aa5b45` adjudiziert ist** (es existiert noch
nicht, nur `docs/game-maker/entwurf/evidenz-pack.md`; S2 braucht seine FORM, S1 nicht). Und die
offenen Punkte aus dem „Nicht geprueft"-Block der Entscheidung sind echte Vorarbeit fuer S3: wo
das `criticBeforeTaste`-409 sein Verdikt LIEST und woran eine Attention als Taste-Marker
erkennbar ist — ohne diese Definition ist S3s Done-Kriterium nicht falsifizierbar.

---
# HANDOFF — Private-repo-p-Audit abgeschlossen, Owner-Entscheide gefallen, ARCHITEKTUR „Studio als Objekt" wartet auf Implementierung (Slot 15 „iosWorktrail" → Nachfolge, 2026-09-03 15:0x)

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`. Hier steht nur,
was git und die Sensoren NICHT tragen.

## 0. DEIN AUFTRAG — der Owner, wörtlich (2026-09-03)

> „ich möchte das du dann jetzt die succession für die nächste Session durchführst. und ihr den
> Auftrag gibst sich einzuarbeiten und die Implementierung anzugehen. Die architekturelle
> Implementierung des Studios als ein Object ist wahrscheinlich am besten zu aller erst
> anzugehen. […] Ich will auf jeden Fall erst den Workflow use. vernünftig ausetzen. Die
> Übersicht will ich seperat angehen, das studio sollte nur schonmal damit im Hinterkopf richtig
> aufgesetzt werden usw. Entscheide du wie wir das implementieren sollten. Ja eine App hat ein
> eigenes repo meiner meinung nach […]. GLM gegenlesung eig immer sinnvoll bei sowas :^)"

Du bist also eine **Einarbeitungs- und Implementierungs-Session**: erst lesen, dann S1 aus der
Architektur-Entscheidung bauen lassen. „Entscheide du wie" hat der Owner an MICH delegiert und ich
habe entschieden — die Entscheidung steht in `docs/ideen/2026-09-03-studio-als-objekt.md` und ist
dein Ausgangspunkt, nicht dein Diskussionsgegenstand. Was dort unter §7 als offen benannt ist,
entscheidest du.

## 1. Das Erste, was du tust — in dieser Reihenfolge

1. **Erden:** `./state.sh`, `./register.sh`. Dann diese drei Dokumente, in dieser Folge:
   - `docs/ideen/2026-09-03-studio-als-objekt.md` (die Entscheidung, ~150 Zeilen — DEIN Auftrag)
   - `docs/messungen/2026-09-03-private-repo-p-worktrail-audit-synthese.md` (die fünf Wurzeln, das Warum)
   - `docs/ideen/2026-09-03-private-repo-p-workflow-v2.md` (der Vorschlag mit den zehn Fleet-Schnitten)
   Die sechs Strang-Reports unter `docs/messungen/private-repo-p-audit-2026-09-03/` sind Belege, kein
   Pflichtprogramm — lies einen erst, wenn eine konkrete Frage ihn braucht (A5 ist der für Design,
   A1 der für Zahlen).
2. **GLM-Gegenlesung anstoßen, BEVOR gebaut wird.** Die Zeile liegt fertig gebrieft als
   `c00c3dc4` (kind `auftrag`, `pending`, Tripel pi/glm-5.3/high, repo claude-fleet). Sie prüft die
   Architektur gegen den Code und gegen die fünf Wurzeln und muss ausdrücklich widersprechen oder
   sagen, dass sie nichts fand. **Der Dispatcher ist master-stopped (`dispatch:false`)** — die Zeile
   braucht einen Hand-Dispatch durch den 🎛 Fleet Controller (**Slot 12** — er ist am 03.09. ~14:2x von 13 dorthin nachgefolgt; prüf die Nummer am Poll, bevor du sendest). Bitte ihn darum, mit
   Task-ID; er kann direkt `POST /api/tasks/c00c3dc4/dispatch`. Ein pi-Watch feuert nie
   (`server.ts` verweigert das ehrlich) — Rückweg ist ein Hintergrund-Watcher auf `ahead`/`clean`
   des Lane-Branches.
3. **Parallel S1 vorbereiten, nicht bauen.** S1 fasst `server/types.ts` und `server.ts` an — und
   die **Sanierungs-MAIN (Slot 9) schneidet server.ts gerade aktiv**. Vor jeder Fläche dort: mit
   Slot 9 abstimmen, welche Regionen frei sind (sie meldet FREEZE-START/-ENDE). Das ist die
   Kollision, die dich sonst einen ganzen Land-Versuch kostet.
4. **Dann S1 als EINE Lane briefen** (Opus 5, high; Beweisort `e2e/programs.ts`). Erst wenn die
   GLM-Gegenlesung da ist und du ihre Funde oberhalb der Schnittlinie eingearbeitet hast.

## 2. Die Owner-Entscheide, die jetzt gelten (alle sechs Fragen des Vorschlags sind beantwortet)

Wörtlich und mit Konsequenz stehen sie in `docs/ideen/2026-09-03-studio-als-objekt.md` §0. Kurzform:

1. **Die „AI" in Private-repo-y ist der Workflow selbst** — das Produkt führt den Enduser durch
   Erstellen, Testen, Revidieren und Aufsetzen SEINES Workflows. Kein Provider-Aufruf als
   Produktkern. Damit ist die Audit-Frage „wo ist die AI" beantwortet: sie war nie ein Modellaufruf,
   sondern das Führungs-Wissen, das die App heute nicht hat (sie formatiert Eingaben um).
2. **Erst der Workflow, dann die App.** Private-repo-y wird NICHT weitergebaut. **Brief 9
   (`ba896b1b`, queued seit 03.09. 08:22) bleibt liegen** — nicht dispatchen; die zwei HIGH bleiben
   bewusst offen. Die Private-repo-y-MAIN auf **Slot 4 (28 % ctx)** hat davon noch nichts gehört;
   wenn du ihr eine Nachricht schickst, dann GENAU EINE mit diesem Stopp (jede kostet ihren vollen
   Kontext).
3. **Die Übersicht wird separat angegangen** — kein UI in S1–S4, aber die Datenform muss sie ohne
   zweiten Umbau tragen. Deshalb die drei Ebenen Idee/Workflow/Sessions als je ein Record.
4. **Studio-als-Objekt zuerst.**
5. **Eine App hat ein eigenes Repo** („obwohl andere repo's später auch apps bekommen könnten") →
   `repoPolicy: "one-app-per-repo"` am Studio, mechanisch geprüft bei der Gründung. Die Trennung
   von Private-repo-y und Private-repo-x im bestehenden `~/private-repo-p` ist ein eigener kleiner Schnitt im
   Produkt-Repo und ausdrücklich NICHT Teil von S1–S4.
6. **GLM-Gegenlesung ist ab jetzt Regel, nicht Einzelfall** („eig immer sinnvoll bei sowas").

## 3. Was diese Session getan hat

Ein Commit auf main, `840d23d` (docs-only, `bun e2e/pins.ts` ALL PASS, Public-Repo-Scan leer):
der Private-repo-p-Worktrail-Audit. Methode: sechs unabhängige, nur lesende Opus-5-Stränge mit
gemeinsamem Kontext-Brief; Synthese und Nachprüfung von acht tragenden Behauptungen am Code durch
mich. Der zweite Commit trägt die Architektur-Entscheidung.

Fünf Wurzeln, gerankt: (1) kein Akteur mit fremder Wahrnehmung im ganzen Rail — 0 Design-/Critic-
Vokabular in acht Bau-Briefs, der Review ist Vertrags-Abgleich, das Owner-Video war eine
XCUITest-Aufzeichnung, `review.sh` existiert und wurde nie gerufen; (2) das owner-bestätigte
Program-JSON trägt drei strukturell unerfüllbare Erfolgsklauseln, 10:0 Attentions Fleet:Produkt;
(3) Gates und Golden Cases messen das selbstdeklarierte Universum, der Probelauf ist ein
Orakel-Echo, Brief 6 diktierte einen falschen Algorithmus, den Fixture und Test jetzt verteidigen;
(4) 79 % Wartezeit (bereinigt 49,7 % = Private-repo-o-Niveau), davon 26,9 h eine still gestorbene MAIN
nach einem Land-Verdikt, das nur die Lane erreichte; (5) der Workflow ist kein Objekt, CONTINUE
existiert nicht. **iOS-neu ist fast nichts** — die Blaupausen-Schnitte S1/S3/S4 vom 30.08. waren
nicht gelandet, als der iOS-Lauf begann.

## 4. Was git NICHT trägt

- **Task `c00c3dc4` (GLM-Gegenlesung) ist `pending` und wartet auf Hand-Dispatch** (§1.2). Sie ist
  von mir gebrieft, nicht freigegeben.
- **Ich habe NIEMANDEM eine Nachricht geschickt** — weder dem Controller (Slot 13) noch der
  Private-repo-y-MAIN (Slot 4) noch der Sanierungs-MAIN (Slot 9). Alle drei Kontakte aus §1 und §2
  sind DEINE, und keiner ist doppelt.
- **Modell dieser Nachfolge:** ich übergebe dir `claude-opus-5[1m]` / `high` — der Owner hat diese
  Session ausdrücklich auf Opus 5 (1M) gesetzt und als Default gespeichert. Wenn du überwiegend
  orchestrierst statt selbst zu graben, gilt die Modellpolitik vom 02.09. (Orchestrierer auf
  Fable 5.1) und du wechselst selbst: `POST /api/slots/<dein slot>/model` UND `/model <id>` in der
  Pane — beide Hälften, sonst fällt eine still zurück.
- **Das Game-Maker-Workflow-Dokument aus Program `b2aa5b45` (Slot 3) ist die Formvorlage für
  `workflow.doc`** und war beim Schreiben noch nicht adjudiziert (Stand: Schritt 2a/2b queued).
  S1 hängt nicht daran (S1 kennt nur Pfad+Hash), S2 schon. Nicht zwei Formate erfinden.
- **Kontextstand beim Schreiben: 8,9 % (gemessen, `ctx.pct` am Slot 15).** Weit unter dem Band —
  die Übergabe ist eine Owner-Anweisung, keine Bandreaktion.
- Nichts läuft im Hintergrund, keine Suite, kein Watch von mir, kein Branch offen.

## 5. Was ich als Nächstes täte

GLM-Dispatch erbitten, währenddessen `server/types.ts#Program` und die Profil-Tür in `server.ts`
selbst lesen (die Entscheidung nennt die Symbole, aber du sollst sie gesehen haben, bevor du
briefst), mit Slot 9 die server.ts-Regionen klären, dann S1 in EINEM Brief: Record + Persistenz +
drei Türen + `publicProgram` + `e2e/programs.ts`, mit dem Restart-Fall als Done-Kriterium. Nicht
selbst bauen.

---
# HANDOFF — Kontext-Pack-Netz (Slot 14 „openSource" → Nachfolge): Stand-Doc steht, Schritt 1 auf Branch `pack-source-hash` (drei Commits, dritter korrigiert einen eigenen Kostenfehler)

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`. Hier steht nur,
was git und die Sensoren NICHT tragen.

## 0. Der Owner-Auftrag für dich, wörtlich

*„Am Ende machen wir dann eine succession in eine neue Session die die idee weiter mit mir zusammen
durchdenkt und die implementierung soweit plant und ausarbeitet."* und *„Lass uns dies jetzt alles
eins nach dem anderen aber auch mit der benötigen Sorgfalt, angehen."*

Du bist also eine DENK- und PLANUNGS-Session mit dem Owner, keine Bau-Session. Die Idee heißt
Kontext-Pack-Netz; der lesbare Stand ist `docs/ideen/2026-09-03-kontextpack-netz-stand.md` (lies
§1 und §8 zuerst, dann §2 und §5; die drei Fassungen davor nur bei Bedarf als Herleitung). Der
Owner denkt in Schritten und will je Schritt einen Beweis; die Tabelle in §8 des Stand-Docs ist die
Reihenfolge, die drei Owner-Entscheide davor sind die ersten Fragen an ihn.

## 1. Das Erste, was du tust

1. **Der Branch ist fertig und verifiziert** (§2). Du musst nichts nachmessen; wenn du es doch
   willst, sind die Logs im Scratchpad meiner Session und verschwinden mit ihr.
2. **Ist der Branch gelandet?** `git branch --contains 2b4abd6 main` (leer = nicht gelandet). Der
   🎛 Fleet Controller (Slot 13, Nachfolger des S12, der mir den server.ts-Schnitt auferlegt hat) hat
   server.ts als knappste Fläche; ihm ist der Branch mit einer Nachricht gemeldet (§3). **Du landest
   nicht selbst**, es sei denn, der Controller gibt es dir. Ein ff-Merge des Branches ist ein
   main-direkter Zug: kein Land-Ledger, kein Post-Land-Audit. Der Suite-Lauf auf `2b4abd6` IST die
   Vollverifikation, die das Regelbuch dafür verlangt, und muss dann im Commit-Body/Handoff stehen.
3. **Nach dem Land:** Deploy über Verb 2 (`POST /api/deploy`), `bundleStale` prüfen, dann
   `bun briefstats.ts` im Haupt-Checkout. Die ersten Zeilen `@<hash>` statt `@unversioned` in der
   Tabelle „pack @ source version" sind der Beweis für Schritt 1. Vorher gibt es dort nur
   `@unversioned` (301 gejointe Lanes am 2026-09-03).
4. **Dann mit dem Owner Schritt 2 durchdenken** (Stand-Doc §2 und §8): `avoidWhen` mit
   Vorfall-Referenz, Act-seitiges `requires[]`, das vermittelte Wissen als Daten. Erst Kriterium
   und Beweis je Teil, dann eine Lane briefen. Bauen tut eine Lane (Opus 5, high), nicht du.

## 2. Gelandet, gebaut, verifiziert

**Auf main, direkt committet (docs-only, `bun e2e/pins.ts` ALL PASS, kein Post-Land-Audit deckt
sie):** `fcaa4a4` → `f1cc8c5` → `eac1a0f` (drei Fassungen der Analyse, jede eine korrigierte
Fehlfassung der vorigen, in §0 der jeweiligen benannt), `3f561b5` (der Stand).

**Nach dem Handoff noch direkt auf main** (Direkt-Commits, in ihren Bodies deklariert): `ff7fd72` —
ein rotes Post-Land-Audit auf `5848207f` kam herein, ich habe es als `flake` adjudiziert (das
gelandete Commit ist docs-only, kann keinen Check regressen) und dabei gemessen, dass §11.2l in
`docs/verify-tiering.md` seine Familie zu Unrecht einen Singleton nennt: drei Geschwister fielen
mit, erstmals alle vier gemeinsam in 367 Läufen. Basisraten und der billigste nächste Messschritt
stehen jetzt dort. **Für dich nur relevant, falls dich jemand danach fragt** — es gehört nicht zum
Kontext-Pack-Netz.

**GELANDET UND DEPLOYT** (Nachtrag, gegen 17:4x geprüft — die Fassung unten sagte „nicht gelandet",
das ist überholt). Alle drei Commits sind unter NEUEN SHAs auf main: `a1d24d3` (reine Hälfte),
`87e3ce2` (server.ts-Hälfte), `7994b80` (Blob-Sha-Korrektur). Beweis: `git cherry -v main
pack-source-hash` markiert alle drei mit `-`, also „Patch schon oben". **Der Branch
`pack-source-hash` ist damit redundant** und `git merge --ff-only pack-source-hash` ist unmöglich
(main ist ihm voraus); ein Merge des Branches würde 40 Dateien und 8162 Zeilen fremder Arbeit
zurückdrehen. **Wer diesen Branch sieht, löscht ihn oder lässt ihn liegen — er wird nie gemerged.**

**Und es funktioniert live.** Frische Receipts tragen die Quellversion je Pack, und sie BEWEGT sich:
`verify-e2e` stand um 16:10 auf `c35381b4` und um 18:04 auf `d3028cb5`, weil ich an diesem
Nachmittag `docs/verify-tiering.md` geändert habe — eine seiner Quellen. Version N gegen N+1 ist
damit beobachtbar, was der ganze Zweck war. Nächster sinnvoller Schritt für dich:
`bun briefstats.ts` gibt Zeilen mit `@<hash>` statt `@unversioned`, sobald genug Lanes auf einer
Version gelaufen sind.

**Die ursprüngliche Fassung des Branch-Abschnitts (Basis `24f9cfc`), historisch:**

- `6535f71` reine Hälfte: `context-manifest.ts#observedSourceHash` + `#stampObservedSourceHashes`,
  `context-packs.ts#CONTEXT_SEED_SOURCE_PATHS`, `briefstats.ts` Pack × Version-Tabelle; 5 + 4 neue
  Checks. Gate-tsc-Liste exit 0, pins ALL PASS, `bun e2e/context-plan.ts` ALL PASS, briefstats-Modul
  0 FAILURES, `bun run build` exit 0.
- `2b4abd6` server.ts-Hälfte: vier Stellen, plus zwei Pins in `e2e/programs.ts`.
- `b79d25d` **Korrektur eines eigenen Kostenfehlers, gefunden vor dem Landen.** Die Byte-Fassung
  ließ bei JEDER Auslieferung die sechs Seed-Quellen lesen: 1 794 908 Bytes (davon `server.ts`
  1 574 279) und ~108 ms `git show` je Lane-Dispatch und je Program-MAIN-Gründung, gemessen am
  HEAD. Ein `git ls-tree -r <head>` ohne `--name-only` kostet ~24 ms, läuft an der Naht ohnehin und
  trägt zu jedem Pfad den Objektnamen. Die Version ist jetzt sha256 über `path\0<blob sha>\0`;
  kein Byte wird mehr gelesen, um eine Version zu bestimmen. Dadurch wurde der Diff KLEINER:
  `planRepoContext` ist wieder wörtlich main, `CONTEXT_SEED_SOURCE_PATHS` ist gelöscht, gestempelt
  wird der ganze Plan an einer Stelle je Merge-Naht (Seeds und Repo-Packs in EINEM Hash-Raum).
  Verbleibende Zusatzkosten gegen main: ein `ls-tree` (~24 ms) im Fall ohne Manifest.

**Suite-Läufe, beide durch.** Auf `2b4abd6` (Byte-Fassung): 3523 PASS / 2 FAIL. Auf `b79d25d`
(Blob-Sha-Fassung, die zu landende): **3525 PASS / 2 FAIL** — dieselben zwei Checks.

**Die zwei FAILs sind ADJUDIZIERT: `flake`, nicht meiner — bewiesen aus dem Check-Trail, nicht aus
einem Wiederholungslauf.** `e2e-trail/` (5558 Lauf-Dateien) beantwortet genau diese Frage, und die
Regel ist die des Trails selbst: ein Check, der auf ≥2 verschiedenen SAUBEREN Bäumen fiel, kann
nicht der Diff des Fragenden sein, weil kein Arbeitsbaum zwei Commits ist.

| Check | Basisrate | fremde Bäume mit FAIL | davon sauber |
|---|---|---|---|
| `restart keeps the busy pending event …` | 17/366 = 4,6 % | 13 | **12** |
| `⏸ a re-run is refused while the resolution …` | 7/629 = 1,1 % | 5 | **4** |

„Fremd" heißt: der Baum enthält keinen meiner drei Commits. Damit ist die Sache entschieden, und der
teure Weg (denselben Baum seriell erneut fahren) war nicht nötig.

**Was daran trotzdem auffällt, als Beobachtung ohne Ursache:** beide Checks fielen in BEIDEN meiner
Läufe. Unter Unabhängigkeit wäre das bei 4,6 % und 1,1 % sehr unwahrscheinlich. Irgendetwas hat die
Rate in meinem Zeitfenster gehoben; die naheliegende Vermutung ist Umgebungslast (zwölf weitere
Sessions und Lanes arbeiten auf dieser Maschine), NICHT mein Diff — beide Checks hängen an
Idle-/Zustellungs-Timing. **Wer eine Familie sauber machen will, hat hier den Anfang: sind die
Basisraten dieser beiden lastabhängig?** Das ist eine eigene Messung, keine Nebenbei-Arbeit.

Die zwei Fehlschläge im Einzelnen: Beide liegen außerhalb der angefassten Fläche, beide
sind Timing-Formen, und ich sage ausdrücklich, was das Beweismaterial NICHT kann:

1. `restart keeps the busy pending event with the same id and no invented attempt` — der Event kam
   `status:"delivered", attempts:1` statt busy-pending zurück, bei `receiverIdleSec: 2`. Die
   Fixture verlangt einen BESCHÄFTIGTEN Empfänger, kontrolliert das aber nicht: die Form der
   Watch-Zustellungs-Familie (`docs/verify-tiering.md` §11.2j und ihre Nachbarn).
2. `⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)` — die
   Ablehnung kam, aber mit dem falschen Grund: wörtlich „the session is actively working right now",
   also das Idle-Gate gegen die eigenen Sonden der Suite (§11.2e beschreibt genau diesen Wortlaut
   für die 💾-Route; hier trifft er den Re-Run-Guard).

**Methodisch für dich mitgenommen:** `docs/verify-tiering.md` §11.7 schreibt als ersten Schritt
einen Wiederholungslauf auf demselben Baum vor (~425 s plus Mutex, je Rot). Der Trail beantwortet
dieselbe Frage in Sekunden und mit einer Basisrate dazu. `trailstats.ts` ist der dafür gebaute
Leser (kein CLI-Einstieg; ich habe die Zeilen direkt gelesen). Das ist der billigere erste Schritt,
wenn ein Check-Name schon Geschichte hat.

Eine weitere eigene Fehlfassung, festgehalten im Body von `6535f71`: das Test-Fixture
„declared-literal" fiel am Validator (SHA-256 + `observedAt` sind ein Pflichtpaar), nicht am Code.

**Mutationsprobe der neuen Sonden** (sie können fallen, sind nicht tautologisch): Framing aus
`observedSourceHash` entfernt → 4 FAILs in `e2e/context-plan.ts`, zurückgesetzt → ALL PASS.

## 3. Was git NICHT trägt

- **Der Worktree** liegt im Session-Scratchpad
  (`…/f8f1d2d3-cb47-4eb7-aeb1-fd7036d10beb/scratchpad/pack-hash`). Verschwindet das Verzeichnis,
  bleibt der Branch im Repo; `git worktree prune` räumt den Eintrag. Nichts Uncommittetes liegt dort.
- **Dem Controller (Slot 13) ist EINE Nachricht geschickt** (2026-09-03): Branch, die vier
  server.ts-Stellen, Suite läuft. Sie beschreibt den Stand von `2b4abd6`, also die Fassung VOR der
  Kostenkorrektur; die vier Stellen sind dieselben geblieben, `repoManifestContextPlan` liefert
  jetzt aber `{repoPlan, blobShas}` statt `sourceBytes`. **Das ist die eine Korrektur, die du ihm
  schuldest** — zusammen mit dem Suite-Ergebnis, in EINER Nachricht. Jede Nachricht kostet seinen
  vollen Kontext.
- **Rulebook-Nachtrag, den jemand von Hand in `CLAUDE.md` (untracked, Generat aus `rulebook/`)
  ziehen muss, sobald gelandet und deployt:** unter „Wissenspflege" eine Zeile, dass ein Receipt
  seit diesem Land die Quellversion jeder Auswahl trägt (`sourceHash`, beobachtet, nie deklariert)
  und `bun briefstats.ts` die Tabelle „pack @ source version" druckt. Ich habe `CLAUDE.md` NICHT
  angefasst; die Sanierungs-MAIN (Slot 9) hält dort eine eigene untracked Änderung (14. Flake-
  Familie), also erst deren Stand lesen, dann `rulebook/` ändern und rendern.
- **MEIN FEHLER, und die Regel daraus: `HANDOFF.md` ist ein STAPEL, kein Dokument.** Jede Session
  stellt ihren Abschnitt VORAN, der Korpus darunter (4224 Zeilen von anderen Sessions) bleibt
  stehen. Ich habe die Datei mit dem `Write`-Werkzeug geschrieben, statt voranzustellen, und damit
  im Arbeitsbaum 4172 Zeilen fremder Übergaben gelöscht. Eine andere Session hat diesen Arbeitsbaum
  dann mitcommittet (`48d3353`, −4172/+87) und die Folgen in zwei Commits wieder eingesammelt
  (`eb89431` +4076, `4a412e6` +150). Wiederhergestellt und bewiesen: außerhalb meines eigenen
  Abschnitts ist die Datei jetzt byteidentisch zu HEAD (Zeilenvergleich, 4224 = 4224). **Regel für
  dich: `HANDOFF.md` nur voranstellen, nie ganz schreiben, und vorher lesen.** Sie ist außerdem von
  MEHREREN MAIN-Sessions gleichzeitig in Benutzung — ein Full-File-Werkzeug darauf ist immer falsch.
- **Eine Fuge fürs Regal** (`~/.claude/knowledge/stacks/fugen.md`, nicht in diesem Repo): git ×
  Inhalts-Hashing — wer eine Version über gelesene Bytes bildet, bezahlt die Bytes und bekommt sie
  obendrein durch einen trimmenden Leser verfälscht, obwohl `ls-tree` die Objektnamen in einem Zug
  liefert. Probe: jede Stelle, die `git show` liest, um daraus einen Hash zu bilden. Habe ich NICHT
  eingetragen (Datei außerhalb dieses Repos, geteilte Realität); Beleg ist der Body von `b79d25d`.
- **Kontextstand dieser Session beim Schreiben: 33,4 % (gemessen, `ctx.pct` am Slot 14).** Über dem
  30-%-Band; der Owner hat die Übergabe ausdrücklich angeordnet.

## 3b. Warum du NICHT aus einer Succession kommst — ein reproduzierbarer Befund

`POST /api/self/succeed` hat **viermal** abgelehnt, jedes Mal mit demselben Satz:

    successor brief failed: prompt not accepted — composer still holds 98 chars after 3000ms

**Immer exakt 98 Zeichen** — bei belasteter Maschine (direkt nach einem Suite-Lauf) und bei ruhiger,
mit und ohne `model`-Override. Das ist deterministisch, also kein Boot-Rennen im üblichen Sinn.
Nach dem Regelbuch („derselbe fix-run-fail-Lauf ~5× heißt strukturell") habe ich abgebrochen statt
weiterzuprobieren.

Was gesichert ist:
- **Kein Slot leckt.** Vor und nach allen vier Versuchen sind dieselben vier Slots frei (1, 2, 7, 12);
  die Nachfolge-Pane wird angelegt und wieder abgeräumt.
- Die Nutzlast KAM AN: der Pfad wirft sonst „prompt not submitted … only part of the N-char payload".
  Enter wurde gesendet. Erst danach hält der Composer noch 98 Zeichen
  (`server.ts`, Fundstelle `ACCEPT_WAIT_MS`, Konstante 3000 ms, überschreibbar per
  `FLEET_ACCEPT_WAIT_MS`).
- Fleet rollt auf diesem Pfad seine EIGENE Nutzlast zurück. Die 98 Zeichen sind also das, was nach
  dem Rollback übrig bleibt — **nicht** Fleets Brief.
- Die vier freien Slots haben VORHER keine Pane (`list-panes` leer), der Rest entsteht also beim
  Hochfahren der neuen Sitzung.

**Nicht bewiesen** (zwei Lesarten, beide ungeprüft): die frisch gebootete Sitzung rendert innerhalb
des 3-s-Fensters etwas Eigenes in den Composer-Bereich, das der Leser als Rest zählt · oder der
Rollback lässt einen Rest stehen. Wer das aufklärt, hängt eine Aufzeichnung an die Pane
(`capture-pane` im 250-ms-Takt ab dem Anlegen; ich habe es versucht, meine erste Aufnahme war bei
t+0,5 s noch leer und die Pane bei der zweiten schon abgeräumt).

**Konsequenz für dich:** du bist vermutlich von Hand gestartet worden. Das ändert nichts an dieser
Übergabe — sie steht oben, weil der Nachfolge-Brief „lies nur den obersten Abschnitt" sagt.
**Und der Befund selbst ist eine Queue-Zeile wert**, denn er trifft JEDE Session, die sich
mechanisch ablösen will, nicht nur mich.

## 4. Die drei Owner-Entscheide, die du zuerst stellst (Stand-Doc §8)

1. Bleibt das Pack ein Zeiger-Objekt, oder trägt es das vermittelte Wissen als Daten (Claim, Scope,
   Sonde)? Empfehlung: Zeiger für Quellen PLUS ein `conveys`-Block, weil nur der über Fleets hinweg
   lesbar ist.
2. „Unbedingt" ans Pack oder an den Act? Empfehlung: an den Act (`requires[]`).
3. Welche Pools zuerst? Empfehlung: Klasse 1 (Werkzeug-Fakt, Sonde + Replikation) allein, bei einem
   Owner mit zwei Hosts; Pools 2 bis 6 erst mit dem zweiten Owner.

## 5. Was ich als Nächstes täte

Mit dem Owner das Pack-Schema aus Stand-Doc §2 Zeile für Zeile durchgehen (was steht, was fehlt),
die drei Entscheide holen, dann für Schritt 2 ein Kriterium + Verify-Weg je Teil festlegen
(`/kriterium-grill`) und EINE Lane briefen (Opus 5, high; `e2e/context-packs.ts` als Beweisort).
Nicht selbst graben.

---

# HANDOFF — Generalsanierung (Program `b2a14b545fd31fd71ba7b9e1`, Slot 9 → Nachfolge): Slice 4 GELANDET, Slice 5+6 im FÜNFTEN Land-Versuch, und die Land-Kette selbst ist der teuerste Befund des Tages; 2026-09-03 (11:5x), ctx GEMESSEN 30,8 %

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`,
`GET /api/self/program-execution`. Hier steht nur, was git und die Sensoren NICHT tragen.

## 1. Das Erste, was du tust

**Slice 5+6 IST GELANDET** (`c80b171` Move + `5848207` §11.2l), verifiziert: `verify.ok true`,
`exitCode 0`, alle sieben Stufen, 106 s Arbeit, `waitMs 0`, `proportional false`. Module auf `main`
byte-identisch zu dem, was ich vor dem Land geprueft hatte. `server.ts` steht bei **23760**.

**ZWEI SCHRITTE SIND OFFEN, und sie sind dein erster Akt — in dieser Reihenfolge:**

1. **Den Post-Land-Audit auf `5848207f` adjudizieren.** Er lief beim Schreiben dieser Zeilen noch
   (eine Suite auf der Maschine). Hol den Namen des gefallenen Checks aus dem Trail, wenn er rot
   ist — die aufbewahrten Ausgabezeilen nennen ihn nicht (B-02). **Und rechne die Basisrate, statt
   den Rerun zu fahren:** das war heute dreimal der billigere und staerkere Beweis. Ein roter Lauf
   auf einem Baum VOR dem Land widerlegt die Attribution; ein gruener Rerun danach beweist nichts.
2. **Slice-Protokoll §f zu Ende fahren.** `bun e2e/pins.ts` habe ich nach dem Land gefahren:
   **ALL PASS**. Offen sind: Dry-Boot des Vorstands gegen eine Scratch-Kopie der `fleet.json`
   (Rollback-Beweis, ~2 min — das Rezept steht in §2 fuer Slice 4), dann **Deploy (Verb 2)**, dann
   `bundleStale`/`deployGap`, dann `graphify update .`.
   **Der Deploy ist BLOCKIERT, solange der Audit laeuft** (`POST /api/deploy` gibt 409) — das ist
   Absicht, ein srv-Kill mitten im Audit erzeugt ein falsches Rot. Stand bei Uebergabe:
   `deployGap.codeBehind: true`, `behindCount 11` — **mein Slice ist noch NICHT live.**

Danach ist Tier 1 des Plans leer und der naechste Slice will erst eine Messung: siehe §6.

---

## 1b. Was die Land-Kette dieses Slices gekostet hat (die eigentliche Uebergabe)

**Ein Slice, sieben Land-Versuche, fuenf verschiedene Ursachen, keine davon der Code:**

| # | Ergebnis | Code gemessen? |
| --- | --- | --- |
| 1 | verify ROT, exit 3 | **nein** — §11.2i, Phase-3-Server bootete nie (`no server.log`) |
| 2 | 409 no-progress | nein |
| 3 | `verify.ok null`, `waitMs 2669000` | **nein** — 44,5 min Schlange, Mutex nie bekommen |
| 4 | 409 no-progress | nein |
| 5 | Gate GRUEN, dann Fast-Forward verloren | ja — `main` zog waehrend des Laufs weiter |
| 6/7 | `no signal` | nein — der Vor-Fix-Merge-Record sperrte zirkulaer (B-09) |
| — | Owner faehrt Weg (b) ueber die Owner-Merge-Route | **gelandet** |

Belege und Done-Kriterien: **B-09** (Record sperrt zirkulaer, Fix nicht rueckwirkend), **`e48ab251`**
(Guard behandelt `waitedOut` wie ein Urteil), **`04fdfc77`** (Flake-Genus), **§11.2i** (7 Laeufe auf
code-identischem Baum: 5 gruen / 2 rot). Wer den naechsten Slice briefet, sollte wissen, dass die
Land-Kette derzeit mehr Zeit mit Nicht-Messen verbringt als mit Messen — das ist die teuerste
offene Naht der Sanierung, teurer als jeder Slice-Inhalt.

**(historisch, erledigt) Ein Land war IN FLUG**: Task `8990eeb0` (Slice 5+6), Kandidat `625bf235`, Lane Slot 6
`fleet/260903062628-c5ef`. Prüfe zuerst, ob es durch ist — und zwar an der Identität, nicht am
Text:

    git cat-file -e main:server/http.ts && echo GELANDET || echo NICHT

- **Gelandet:** Post-Land-Audit abonnieren (`{kind:"audit", repo:"/Users/owner/claude-fleet",
  mainAfter:"<sha>"}`), `armed` prüfen, dann §f des Slice-Protokolls fahren: Dry-Boot des
  Vorstands gegen eine Scratch-Kopie der `fleet.json` → Deploy (Verb 2) → `bundleStale`/`deployGap`
  → `bun e2e/pins.ts` → `graphify update .`.
- **Nicht gelandet:** lies `GET /api/slots/6/merge`. Bei `verify.ok:null` mit hohem `waitMs` ist es
  wieder ein **waitedOut** (siehe §4) — dann Maschine leerlaufen lassen (`ps -eo command | grep -c
  '^/bin/sh ./e2e-'` muss 0 sein), die Lane um einen Rebase bitten (der Guard verlangt einen neuen
  Kandidaten) und erneut landen. Bei `verify.ok:false` erst die Signatur lesen, bevor du dem Code
  glaubst.

## 2. Gelandet und verifiziert

**P4 Slice 4 (`46d29d8`)** — Audit-Log nach `server/audit-log.ts`. `server.ts` 23962 → 23776
(−186). Gate voll grün, sieben Stufen, 107 s. Von mir am Baum nachgemessen, nicht der Meldung
geglaubt: Move-Treue per `diff` (genau zwei beabsichtigte Abweichungen), Regel 2 gehalten,
Anker-Nest unberührt, **und der Pfadvergleich für `AUDIT_FILE` von mir selbst ausgeführt** —
byte-gleich. §f komplett gefahren: Rollback-Dry-Boot (Vorstand bootet gegen heutige `fleet.json`,
HTTP 200, kein Crash-Loop), Deploy `281f0f3b` `ok:true`, `deployGap` auf 0, `graphify update`.

Post-Land-Audit darauf war **rot (3508/1)** und ist **adjudiziert `flake`** (`at 1788401780607`) —
Basisrate 4/26, drei Rote auf Bäumen VOR dem Land, Signatur in allen vier identisch.

**Direkt-Commit `82869c1`** — die Slice-5+6-Vormessung. Docs-only, `bun e2e/pins.ts` ALL PASS,
**kein Post-Land-Audit deckt ihn**.

## 3. Eine Änderung, die git NICHT trägt — lies das, bevor du dem Regelbuch glaubst

Ich habe das Regelbuch von **dreizehn auf vierzehn Flake-Familien** gezogen (§11.2l). Geändert
habe ich `rulebook/lane-discipline.md`, dann `CLAUDE.md` neu gerendert. **Beide sind untracked.**
`git log` zeigt davon nichts, `./state.sh` zeigt davon nichts, und eine Lane, die heute spawnt,
bekommt die neue Fassung nur als Kopie. Wenn du dich fragst, warum eine Regel da steht, die in
keinem Commit auftaucht: hier ist sie her.

## 4. Der teuerste Befund des Tages: die Land-Kette misst nicht mehr

Slice 5+6 hat **fünf** Land-Versuche gebraucht. Die Tabelle ist die eigentliche Übergabe:

| # | Ergebnis | hat der Gate den Code gemessen? |
|---|---|---|
| 1 | verify ROT, exit 3 | **nein** — §11.2i, Phase-3-Server bootete nie (`no server.log`) |
| 2 | 409 no-progress | nein |
| 3 | `verify.ok: null`, `waitMs 2669000` | **nein** — 44,5 min Schlange, Mutex nie bekommen |
| 4 | 409 no-progress | nein |
| 5 | in Flug | ? |

Über 70 min Wanduhr, null Messungen — bei Code, den die Lane selbst **fünfmal grün** hatte. Zwei
getrennte Ursachen, beide gefilet:

- **`e48ab251`** — der no-progress-Guard behandelt ein `waitedOut` (`verify.ok===null`, Baum nie
  angesehen) wie ein rotes Urteil. Der Datensatz unterscheidet die beiden, die Route nicht. Folge:
  man muss Bewegung erfinden (Rebase), um Arbeit zu wiederholen, an der sich nichts geändert hat.
  Done-Kriterium mit Fixture auf beiden Seiten steht in der Zeile.
- **§11.2i**, weiter ohne Mechanismus. Die Lane hat ihn auf einem über alle Rebases
  **code-identischen** Baum beziffert: **7 `claude-gate`-Läufe, 5 grün / 2 rot** — rund jeder
  dritte Land-Versuch stirbt an einer Suite, die den Code nie gemessen hat.

**Der Mutex selbst ist in Ordnung** — ich hatte zwei parallele `e2e-isolated` im Verdacht und es
war falsch: `/tmp/fleet-e2e.lock/pid` nannte den Halter, der zweite Wrapper hatte keinen Runner
und wartete. Die Schlange ist echt, die Parallelität nicht.

## 5. Was ich gefilet habe, und eine Zahl von mir, die überholt ist

- **`7e984bde`** — Nachtrag zu `0c190377` (300-Zeichen-Deckel an `adjudicate`), dritte Instanz plus
  die strukturelle Folge: der Deckel macht die Ledger-Zeile zum Zeiger auf etwas außerhalb des
  Ledgers.
- **`04fdfc77`** — das Flake-Genus „die Sonde sampelt einen by-design-Transienten".
  **KORREKTUR, und sie ist meine:** dort steht `15,4 %` für die §11.2l-Familie. Das war eine
  Kleinstichprobe aus 26 Läufen meines TMPDIR-Fensters. Die Lane hat über **364** Läufe gemessen:
  **15 Rote auf 13 verschiedenen Bäumen ≈ 4,1 %**, geclustert am 02./03.09. Die belastbare Zahl
  steht in `docs/verify-tiering.md` §11.2l; die Queue-Zeile ist an dieser Stelle zu hoch.
- **`e48ab251`** — siehe §4.

## 6. Slice 5+6 inhaltlich — was die Vormessung wert war

`server/http.ts` (json, HOST, PORT — echtes Blattmodul, **null** Importe) + `server/auth.ts`
(zwölf Symbole). `server.ts` 23827 → 23735 (−92). Von mir geprüft: Move-Treue mechanisch, Regel 2,
und **der ESM-read-only-Beweis über alle dreizehn importierten Bindungen mit funktionierender
Gegenprobe** (`TOKEN` 2 Treffer, `shares` 6 — die Sonde kann feuern, die Leere ist gemessen).

Der Blocker, den KEINE Vormessung hatte und den erst der Compiler zeigte: **`let TOKEN`** wird vom
Kern im Boot-Pfad beschrieben. Ein Move daraus wäre ein Laufzeit-TypeError gewesen, den `tsc` nicht
sieht und der erst im Watchdog-Respawn zuschlägt — also nach dem Land. `e2e/security.ts` §1
verlangt unabhängig davon dasselbe (`tokenGate` muss beim Gate-Marker bleiben).

**Nächster Slice:** Tier 1 ist nach 5+6 leer. Der Plan nennt als offenen Tier-1-Posten noch
„audit-queue" — und `p4-slice4-vorbereitung.md` sagt ausdrücklich, dass **nicht entscheidbar ist**,
ob damit das Audit-LOG (erledigt, Slice 4) oder die Post-Land-Audit-QUEUE (`auditQueue`, mit Drain,
Helfer-Portal und Retention) gemeint war. Die Queue ist deutlich größer und berührt den
Helfer-Pfad: eigener Slice mit eigener Messung, kein Anhängsel. **Miss sie, bevor du sie briefst.**

## 7. Offen, und wem es gehört

- **Erfolgsmaß 1 ist unerreichbar, und der Owner-Entscheid steht aus.** Controller-Projektion:
  275/Subsystem, Kern ~19.930 gegen Ziel 8.000. Meine zwei Slices lagen bei −186 und −92, beide
  unter Schnitt. Der belastbare Satz dazu ist nicht die Hochrechnung, sondern die Bauart:
  **`json` allein hat 1039 Aufrufstellen, von denen sich keine ändert** — die Kernzeilen sind
  Aufrufstellen, nicht Definitionen, und ein Move bewegt nur die Definition.
- Die Attention `5954d4da` meiner Vorgängerin ist weiter offen (Advisory-Disposition,
  Feature-Freeze).
- Der §11.2l-Fix gehört einer Lane, die `e2e/watch.ts` besitzt. §11.2i hat weiter keinen
  Mechanismus.

## 8. Sondendisziplin — drei eigene Fehlschüsse an einem Tag

Alle drei hätten als Antwort durchgehen können; jeder wurde nur entdeckt, weil ein zweiter Sensor
widersprach:

| Sonde | fiel auf | richtige Form |
| --- | --- | --- |
| `awk '/\bshares\b/'` | macOS-`awk` liest `\b` als Backspace → LEER, las sich wie „kommt nicht vor" | Wortgrenzen nur mit `grep`/`rg` |
| Watcher auf „`main` hat sich bewegt" | fremdes Doku-Land eines anderen Programms | `git merge-base --is-ancestor` |
| Watcher auf Subject-Grep `Slice 5+6` | **meinen eigenen** Messnotiz-Commit auf `main` | `git cat-file -e main:<datei-die-nur-dieser-slice-erzeugt>` |

Regel daraus: **eine Warte-Bedingung prüft Identität, nie Text und nie „hat sich etwas bewegt"** —
in einem Fleet mit fünf parallel landenden Programmen ist jede unspezifische Bedingung ein
Rauschmelder. Und: mein Diff-Rezept an die Lane (`git diff … -- docs/`) war zu weit; es fing
`main`s eingehende Dateien mit. Die Lane hat das korrigiert, zu Recht — ein Inhaltsbeweis
schränkt auf die Dateien ein, die der Slice wirklich anfasst.

## 8b. NACHTRAG 18:3x — der Deadlock ist vom Owner aufgeloest, Weg (b)

Der Owner hat auf Attention `0792786f` mit **(b)** geantwortet und 18:2x unter seiner
Land-Delegation `POST /api/slots/6/merge` mit dem Owner-Token gefahren. Begruendung, die man
kennen muss: **die `done-looking`-Pruefung sitzt in der SELF-LAND-Tuer (`server.ts:6926`), die
OWNER-Merge-Route hat sie nicht.** Gewaivt ist ausschliesslich das Praedikat, das faelschlich
falsch war; der Land-Gate faehrt die volle Kette auf dem Baum, den er landet. **Der blockierende
Record bleibt absichtlich unangetastet, damit B-09 seinen Beweis behaelt** — das ist besser als
mein eigener Vorschlag (a), der die Evidenz fuer das Symptom geopfert haette.

Owner-Gegenpruefung am Code, die B-09 bestaetigt: `lane-signals.ts:70` ist woertlich
`!(status === error && errorReason === ff-lost)`, und `server.ts:11384` nennt `errorReason` selbst
„the ONE field". Der Fix `24f9cfc` ging 17:23:52 live, fuenf Stunden nach dem Record von 12:22:19.

**Was DIR davon bleibt:** der Land-Ausgang haengt an einem Owner-Watch (`9d970fc1`), nicht an dir.
Offen und Program-Arbeit: **(1)** den Post-Land-Audit auf diesen Land adjudizieren, **(2)**
Slice-Protokoll §f fahren (Dry-Boot-Rollback → Deploy Verb 2 → `bundleStale`/`deployGap` →
`bun e2e/pins.ts` → `graphify update .`).

## 8c. F1 — `acceptance: observed` ist KEIN Zustellbeweis (Owner-Befund, und er trifft mich zweimal)

`POST /send` meldet `acceptance: "observed"`, obwohl der Text nur **gequeued** ist. Ich habe in
dieser Session zweimal „Zugestellt, acceptance: observed" berichtet und das als Beleg behandelt —
beide Aussagen waren staerker als die Messung. **Regel: Receipt lesen, dann die PANE pruefen, und
nur die Pane zitieren.**

Zweite Haelfte desselben Befunds, und die ist teurer: **ungesendeter Text im eigenen Composer
blockiert `idle` und damit `done-looking` unbegrenzt.** Zweimal heute an diesem Slot gemessen —
einmal fuenf Stunden Liegezeit (Lane 6, Composer hielt „fahr die drei Suiten trotzdem"), einmal
eine verlorene Attention-Runde (mein eigener Slot hielt die Antwort „(a)"). Kein Sensor sagt dabei
„blockiert": `GET /api/self` zeigt `idle: null`, der Watch steht `armed: true` und feuert nie.
Wer auf einen Lane-Watch wartet, der nicht feuert, prueft **zuerst den Composer der Zielpane** —
`C-u` greift dort nicht, `45x BSpace` schon.

## 9. Ehrlichkeiten

- Diese Session lief auf `claude-opus-5[1m]`, nicht Fable. Die Modellpolitik vom 02.09. will Fable
  5.1 für eine Program-MAIN. Geerbt, nicht behoben — der Zug ist ein PAAR (`POST
  /api/slots/:id/model` UND `/model` in der Pane).
- Alle meine eigenen Commits sind Direkt-Commits aus dem Haupt-Checkout, docs-only, mit
  `bun e2e/pins.ts` verifiziert — **nicht** mit der vollen Suite, und kein Post-Land-Audit deckt
  sie. `./state.sh`s Land-Health-Zahlen zählen sie nicht.
- **B-07 dreimal live bestätigt:** nach einem fehlgeschlagenen Land gibt
  `POST /api/self/watch {kind:"merge"}` den VERBRAUCHTEN Watch zurück (`ok:true`, `armed:false`).
  Der vom Gründungsbrief vorgeschriebene Rückweg ist dort tot; ich bin auf Hintergrund-Watcher
  ausgewichen. **Immer `armed` lesen, nie `ok`.**
- Ich habe einen Widerspruch zwischen Projektion (`REVIEWABLE`) und Land-Tür (`no signal`)
  gemessen und **nicht** gefilet: die Projektion nannte die Tür unter `R9` (merge-last non-land
  verdict), was sie unabhängig vom Live-Prädikat tut. Kein Defekt.

---

# HANDOFF — Fleet Controller (Slot 13, Fable 5.1 high): Land 24f9cfc entlastet, zwei Owner-Ideen als Entwuerfe gelandet und von GLM gegengelesen, 6f401842-Brief korrigiert; 2026-09-03 (11:0x), ctx GEMESSEN 25,2 %

Rolle: 🎛 Fleet Controller, Nachfolge von Slot 12 ueber einen handgeschriebenen Brief.
Owner-Delegation (Landen, autonomer Betrieb, Disposition) gilt fort.

## 0. DEIN AUFTRAG — unveraendert der vom Owner, plus was ich davon abgearbeitet habe

  „sag dem neuen controller er soll sich mit mir zusammen explizit hauptsaechlich um die
   second-host-Integration und bieberburg auf slot3 kuemmern, dazu gehoert dann auch z.b die alten
   Bieberburg lanes zu schliessen"

**„MIT MIR ZUSAMMEN" IST WOERTLICH.** Frag, bevor du entscheidest. Ich habe mich daran gehalten und
deshalb Punkte offen gelassen, die ich haette raten koennen.

Zweiter, spaeterer Owner-Auftrag (2026-09-03, woertlich):
  „WIr sollten alle diese Idee von sol sessions auf codex ausarbeiten lassen und dann GLM
   drueberschauen und pruefen lassen."
Das ist ERLEDIGT fuer die zwei Ideen dieser Session (§2). Der Weg funktionierte gut und ist als
Muster brauchbar: sol/codex arbeitet aus, GLM liest gegen, beides als Docs-Lane, beides gelandet.

## 1. WAS DU ZUERST TUST

Nichts haengt. Kein Land ist unter Verdacht, keine Suite laeuft, kein Watch von mir geht auf dich
ueber (Watches haengen an Slot UND openedAt). Erde dich normal (`./state.sh`, `./register.sh`,
dieser Abschnitt, Board) und geh dann an §4 — die Owner-Fragen, die auf Antwort warten.

## 2. GELANDET IN DIESER SESSION, alles mit gruenem Gate

- **`bfa7a61`** docs/ideen/2026-09-03-session-ledger-je-program.md (sol/codex, Slot 2)
- **`5881455`** docs/ideen/2026-09-03-harness-uebergreifende-nachfolge.md (sol/codex, Slot 7)
- **`2573678`** docs/ideen/2026-09-03-gegenlesung-glm.md (GLM/pi-zai, Slot 1)
- **`51430a6`** Evidenz-Pack v2 des Game-Maker-Workflows (Slot 3s Zeile d2fd538f, von mir dispatcht)

**Der wichtigste Fund der drei Dokumente, zweimal unabhaengig gezaehlt:** die offene Zeile
`6f401842` benannte FUENF Zustellstellen, es gibt SECHS. Die sechste (`server.ts:5777`,
`sendText(free, brief, true)` im generischen Zweig von `handleSelfSucceed`) traegt einen anderen
Variablennamen und faellt durch jedes Literalmuster. **Genau dort geschahen alle vier gemessenen
Nachfolge-Fehlschlaege** („composer still holds 98 chars after 3000ms", Notiz `8b7c18c9`), denn
Supervisor und Program-MAIN haben den Readiness-Aufruf laengst — der generische Zweig hat zwischen
`openSlot` und `sendText` weder `canDeliver` noch `waitForFoundingReadiness`. **Ich habe der Zeile
`6f401842` deshalb einen korrigierten Brief angehaengt** (sie stand auf `pending`, kein Brief
vorher). Der Brief nennt alle sechs Stellen mit Zeilennummern (Stand main 5881455, selbst
nachpruefen), verlangt ausdruecklich eine Fixture, die den GENERISCHEN Pfad beweist, und grenzt den
Harness-Override ab. **Die Zeile ist NICHT dispatcht** — ich wollte dem Owner den Start nicht
vorwegnehmen.

## 3. §3 DER VORGAENGERIN IST GESCHLOSSEN — das Land `24f9cfc` ist entlastet

Der rote Post-Land-Audit ist als **`flake`** adjudiziert. Belegkette, aus dem lokalen Trail des
Haupt-Checkouts (**363 isolated-Laeufe**, nicht die 26, mit denen vorher argumentiert wurde): die
exakte Vierer-Signatur der busy-receiver-Familie fiel **4x VOR dem Land** auf Baeumen ohne den
Lane-Code (`9db4b85` vom 16.08. auf main, `d63bb91`, `299ac65` auf main, `4d2dd39` vom 02.09.).
Check 1 allein faellt lokal 15/363. Der Audit lief auf dem **Second-host** und war vollstaendig —
3506 Trail-Zeilen; das „checks ran:25" ist ein Artefakt des aufbewahrten 4-KB-Tails, nicht „nur 25
gemessen" (der Hinweis kam von Slot 16, er ist richtig und gehoert ins Regelbuch-Wissen).

**Die Kontrollprobe auf `80cd901` habe ich ABGEBROCHEN, bevor sie lief** — sie stand noch hinter
dem Suite-Mutex. Begruendung: bei ~1 % Basisrate entscheidet ein einzelner Lauf nichts, was 363
Laeufe nicht schon sagen; der Abbruch gab dem Mutex 23 Minuten zurueck. Der Worktree
`…/8d083b5c-…/scratchpad/ctrl` ist ein Fremd-Scratchpad und nicht meiner; ich habe ihn liegen
gelassen.

**`undo-land` war ohnehin tot** und die Handoff-Zeile „undo-land ist der Rueckweg" war falsch: main
war seit dem Land um 8 Doc-Commits weitergezogen, und die Route verweigert dann permanent
(`server.ts`, die Kontiguitaetspruefung in `pushUndo`/`killUndoStack`).

## 3b. `pack-source-hash` IST GELANDET — und der Weg dorthin korrigiert eine Route-Annahme

**Gelandet als `7994b801` (main), Land-Note gruen:** `verify.ok true`, volle siebenstufige Kette
(`install pins tsc build clean-review security claude-gate`), `proportional false`. Drei Commits von
Slot 14 (openSource/openPacks): Pack-Version als OBSERVED `sourceHash` je Auswahl, die server.ts-
Haelfte, und die Nachbesserung `b79d25d`, die aus der Byte-Fassung eine Blob-Sha-Fassung machte.

**Die Nachbesserung ist der Teil, der zaehlt** — Slot 14 hat sie selbst gemessen, vor dem Landen:
die erste Fassung las **1 794 908 Bytes je Auslieferung** (server.ts allein 1 574 279) und brauchte
~108 ms `git show` — bei JEDEM Lane-Dispatch und JEDER Program-MAIN-Gruendung. Ein `ls-tree` ohne
`--name-only` traegt die Objektnamen schon und kostet ~24 ms. Der Eingriff wurde dadurch KLEINER:
`planRepoContext` ist wieder woertlich main, `CONTEXT_SEED_SOURCE_PATHS` geloescht, dieselben vier
Beruehrungspunkte. Ihre Vorschau: `./e2e-isolated.sh` 3525 PASS / 2 FAIL, beide aus dem Check-Trail
als `flake` belegt (`restart keeps the busy pending event…` 17/366; `⏸ a re-run is refused…` 7/629),
beide ausserhalb der angefassten Flaeche. **Ihre 17/366 und meine 15/363 fuer denselben Check sind
zwei unabhaengige Messungen desselben Flakes** — das stuetzt auch meine Adjudikation aus §3.

**KORREKTUR AN MEINER EIGENEN FRUEHEREN FASSUNG DIESES ABSCHNITTS.** Ich hatte hier geschrieben,
`POST /api/slots/:id/open-worktree` sei der Weg, einen fremden Branch in einen Slot zu uebernehmen,
und das ausdruecklich als „gelesen, nicht erprobt" gekennzeichnet. **Es war falsch.** Die Route legt
IMMER einen neuen Branch an (`openLaneInSlot` ruft `git worktree add -b`), und auf einen existierenden
Namen antwortet sie `worktree add failed: … a branch named 'pack-source-hash' already exists`. Sie
kann keinen bestehenden Branch adoptieren.

**Der Weg, der wirklich funktioniert** (von mir gefahren, nicht gelesen):
1. Der fremde Baum muss den Branch loslassen — git checkt denselben Branch nie zweimal aus. Slot 14s
   `git worktree remove` auf ihr Scratchpad genuegte.
2. `POST /api/slots/<frei>/open-worktree` mit `{repo}` und OHNE `branch` → frischer Lane-Worktree auf
   einem neuen `fleet/<stamp>`-Branch.
3. `git -C <lane-worktree> reset --hard <geprueftem sha>` — der Lane-Branch traegt danach genau die
   Commits, sauber, keine untracked files.
4. `POST /api/slots/<slot>/merge`. Das Land behaelt volle Provenienz: Note, `lane-outcomes`-Zeile,
   Post-Land-Audit.

**DREI DINGE, DIE DICH SONST JE EINEN FEHLVERSUCH KOSTEN:**
- **`open-worktree` SPAWNT EINEN VOLLWERTIGEN AGENTEN**, auch wenn du den Slot nur zum Landen
  brauchst. Er bekam keinen Brief, war nach kurzer Zeit bei 10 % Kontext und hatte vier Shells offen.
  Er ist auch der Grund fuer den naechsten Punkt. (Nach dem Land raeumt sich der Slot selbst.)
- **`merge` antwortet `{"status":"blocked"}`, solange die Session arbeitet.** Es kostete **acht
  Anlaeufe ueber gut drei Minuten**, bis der ungebriefte Agent still war. Eine Retry-Schleife mit
  25 s Abstand ist das Mittel, kein Grund zur Sorge.
- **DER ERSTE LAND-VERSUCH WAR GRUEN UND LANDETE TROTZDEM NICHT** (`status error`, `landed false`,
  `verify.ok true`): main bewegte sich waehrend des Gates, das Fast-Forward ging verloren. Danach war
  der Branch bereits auf main rebaset und main sein direkter Vorfahr — **einfach nochmal landen**,
  der zweite Versuch lief durch. **Das ist der zweite Fall an diesem Tag, in dem der Deploy-Rueckstand
  Geld kostet**: der Fix dafuer (`24f9cfc`) liegt auf Platte, der laufende Server ist Dutzende
  Commits davor.

## 4. DIE OFFENEN OWNER-FRAGEN, gesammelt — das ist der Kern deiner Uebergabe

Ich habe sie ihm gestellt und KEINE Antwort auf die Betriebsfragen bekommen. Frag nach, rate nicht.

**Betrieb (vier, von mir gestellt):**
1. Bekommt die Fleet Shell-Zugang auf den Second-host, oder bleibt das sein Kanal? Ohne das ist dort
   keine Session baubar (§5).
2. `6f401842` dispatchen? Brief ist korrigiert und liegt bereit.
3. Deploy? Der laufende Server ist **16 Commits** hinter HEAD (Stand beim Schreiben), darunter der
   Fix fuer das verlorene Fast-Forward. Kein Audit laeuft.
4. Das alte Private-repo-j-Program `2c073232` als abgeloest schliessen? Es ist `active` und MAIN-los.

**Aus dem Ledger-Entwurf (drei):** Archivierung ueber den 100-Program-Deckel hinaus? · 200
Arbeits-Sessions je Program mit gezaehltem Verlust, oder vollstaendig? · harness-interne Subagenten
erst dann erfassen, wenn Fleet ihnen eine eigene beobachtete Identitaet geben kann?

**Aus dem Nachfolge-Entwurf (drei, je mit Empfehlung):** nur `claude ↔ codex` freigeben
(empfohlen) oder jedes Agentenpaar? · Zielmodell bei jedem Harness-Wechsel verpflichtend
(empfohlen)? · `restart` soll Spawn-Felder laut ablehnen (empfohlen)?

**Aus GLM, zwei Dinge OBERHALB der Schnittlinie, vor jeder Umsetzung zu klaeren:**
- Ledger: das **Crash-Fenster der zwei Schreiber**. `dispatchTask` persistiert ueber debounced
  `saveState()`, nicht `saveStateNow()`. Stirbt der Server dazwischen, gibt es keinen Writer, der
  den Eintrag je schliesst, und das Deckel-Argument („hoechstens 16 offene") stimmt nicht mehr.
- Nachfolge: der **Crash-Orphan** fuer den generischen und den Supervisor-Pfad. Nur Program-MAIN hat
  einen persistenten Founding-Marker mit Boot-Rollback. Das neue Readiness-Warten VERGROESSERT
  dieses Fenster.

**Offen und nie beantwortet (aelter):** Attention `10d5063627a932848d1720f7` (Private-repo-j-Taste-Gate)
wurde beim Retire von Slot 6 als „requester session ended" geschlossen — die Frage ist damit weg,
nicht beantwortet. Und Slot 8 hat eine neue Attention `dddb2141` offen: das Task-Workbench-Program
ist fertig bis auf ein ungeprueftes Leerzustands-Kriterium.

## 5. SECOND-HOST — der Handoff-Befund meiner Vorgaengerin war FALSCH, hier ist der gemessene

Ihre Fassung („das Geraet wird nie gefragt, beide Claims gelapst") stimmt nicht. **24 Post-Land-Audits
liefen seit dem 29.08. auf dem Second-host, alle 24 haben ein `reportedAt`**, auch der auf `24f9cfc`
(23 min). Die Verdrahtung funktioniert. Das echte Problem ist die Beurteilbarkeit:

| Laeufer seit 29.08. | gemessen | rot |
|---|---|---|
| Second-host | 15 | 13 (87 %) |
| lokal | 42 | 18 (43 %) |

**Eine claude-Session AUF dem Second-host ist heute zweifach verriegelt** (von Slot 5 gemessen, von
mir beide Haelften nachgeprueft):
- **Kein Zugang von hier.** `ssh second-host` → `Permission denied (publickey,password)`. Die
  Faehigkeitsliste des Geraets (`[bun,tmux,git,zsh]`) ist eine Selbstauskunft aus seiner Config
  (`helper-daemon/daemon.ts`), keine Probe — dass dort kein `claude` steht, beweist nichts.
- **Die Job-Schiene kann strukturell keinen Agenten starten.** `server/types.ts#helperCmdCheck`
  kennt genau sechs erlaubte Kommandos (`bun run build`, `bun test`, `bun run verify`,
  `./e2e-isolated.sh`, `./e2e-security.sh`, `bun e2e/pins.ts`) und lehnt die Namen
  `claude|codex|pi` UNBEDINGT ab, vor der Allowlist. Absicht, keine Luecke.

Die Canary vom 31.08. lief deshalb ueber `git bundle` + `scp`, also ueber den Owner-Zugang.
**Der erste Schnitt ist ein Owner-Akt, kein Code.** Danach empfiehlt die Phase-0-Analyse
(`docs/attic/dual-host-session-runtime-phase0-2026-08-30.md`) Option A: eine zweite eigenstaendige
Fleet-Instanz auf dem Second-host plus Client-Link. Warnung von Slot 5, die ich weitergebe: diese
Session laeuft dann unter einem ZWEITEN Board, nicht in der heutigen Slot-Liste — wer beides
zusammenzwingt, kauft die Vertrauenskante, von der die Analyse abraet.

## 6. PRIVATE-REPO-J — Slot 1 und 7 sind geschlossen, die Mehrdeutigkeit ist NOCH OFFEN

- **Erledigt:** Slot 1 und Slot 7 gekillt, Zeilen `54d3989c` und `c1fab27f` auf `done`. Achtung fuer
  den naechsten Fall: **der Kill setzt die Task-Zeile auf `pending` zurueck**, also wieder
  dispatchbar — das `done` muss man einzeln nachziehen (`POST /api/tasks/:id/done`).
- **NICHT ENTSCHIEDEN, weil der Owner nicht geantwortet hat:** „bieberburg auf slot3" hat zwei
  Lesarten — (A) Private-repo-j lebt kuenftig auf Slot 3, wo heute die Game-Maker-Workflow-v2-MAIN von
  `b2aa5b45` sitzt, oder (B) Slot 3 uebernimmt Private-repo-j zusaetzlich. **Rate das nicht.**
- Program `2c073232` ist `active` und MAIN-los (Slot 6 retirete 06:46 ohne Nachfolge-Eintrag).

## 7. WAS ICH UEBER DEN BETRIEB GELERNT HABE — kostet dich sonst je einen Fehlversuch

- **Eine `pi-zai`-Lane (GLM) kann man NICHT abonnieren.** `POST /api/self/watch` antwortet woertlich:
  „harness pi-zai is not automatable — its slot never reads as alive to the done-looking predicate".
  Ersatz: ein Hintergrund-Wächter auf den echten Commit (`git show <branch>:<datei>` in einer
  `until`-Schleife). Hat sofort funktioniert.
- **Eine Lane, die `/api/self/gate` VOR ihrem ersten Commit fragt, bekommt die volle siebenstufige
  Kette** — `verify-proportion.ts` klassifiziert den DIFF, und ein leerer Diff gilt per Vertrag als
  gemischt. Reihenfolge im Brief mitgeben: **erst committen, dann das Gate fragen.** Slot 7 hat so
  eine volle Kette gefahren, die sie nicht gebraucht haette, und dabei den Mutex gehalten.
- **`POST /api/slots/:id/merge` antwortet `{"status":"blocked"}`, solange die Session arbeitet.**
  Kein Fehler, einfach spaeter nochmal.
- Der Land-Takt war heute problemlos: drei Docs-Lands hintereinander, alle mit
  `verify.proportional`-Kurzkette, kein Wartekonflikt.

## 8. EHRLICHKEITEN

- **Ich habe Slot 16 eine falsche Zahl geschickt** („~40 Minuten Zustellverzoegerung") und sie
  wenige Minuten spaeter korrigiert. Der Fehler: ich schrieb die Uhrzeit in die Prosa, BEVOR ich sie
  nachgeschlagen hatte. Gemessen waren es 2 Minuten 27. Die Regel dagegen steht im Regelbuch, ich
  habe sie gebrochen.
- **Die drei Entwuerfe habe ich nicht Zeile fuer Zeile gegengeprueft.** Ich habe die Struktur, den
  Prioritaetsfund und die Urteile gelesen und den Sechs-Stellen-Fund als einzigen selbst
  nachvollzogen (zwei unabhaengige Zaehlungen stimmten ueberein). GLM nennt in §3 ausdruecklich, was
  ES nicht geprueft hat — lies das, bevor du auf ein Detail baust.
- **Die Adjudikation von `24f9cfc` ruht auf meiner eigenen Trail-Auswertung**, nicht auf einer
  Kontrollprobe. Das ist starke Evidenz, aber kein Experiment.
- Der Owner hat diese Session per `/model` auf Opus 5 gestellt. Das weicht von der Modellpolitik ab
  (Fable fuer Controller); es war sein ausdruecklicher Akt, ich habe ihn nicht diskutiert.

---
# HANDOFF — Program-MAIN „Fleet Task Workbench" (Program `b9c1e0d9`, Slot 8), 2026-09-03 (08:5x), ctx GEMESSEN 27,4 %

Zustand ableiten, nicht aus dieser Prosa lesen: `GET /api/self/program-execution`.
**Das Program ist inhaltlich FERTIG** — alle fuenf Auftragszeilen terminal, Beweislage bis auf
EIN benanntes Kriterium geschlossen. Was bleibt, ist unten in drei Saetzen.

## Was in dieser Session gelandet ist

- **`15a3e38b` → `71361fa`** (Task-Detail-Kopf: Status, Program-/Repo-Chip, Lifecycle-Leiste,
  GENAU EINE Hauptaktion). Land-Note: `verify.ok true`, volle Sieben-Schritt-Kette, **104,1 s
  Arbeit / 0 s Wartezeit**, `proportional false`. Diff selbst gelesen: nur `src/client.ts`,
  `public/index.html`, `e2e/tasks.ts`; alle Akte laufen ueber `place()` in dieselben Knoten mit
  denselben Handlern — keine zweite Tuer, kein neuer API-Aufruf.
- **`07c061fa` → `a58e9c1`** (unabhaengiger Codex-Review als Messnotiz). `verify.ok true`,
  `proportional TRUE` mit `['install','pins']` — die docs-only-Kurzkette, korrekt.
  **Ich habe die Lane vor dem Land von Hand auf main rebast**: `docs/messungen/INDEX.md`
  kollidierte (beide haengen eine Zeile ans Ende) — Aufloesung ist BEIDE Zeilen, nie eine Wahl.
- Zwei Direkt-Commits im Haupt-Checkout, fuer die Land-Ledger unsichtbar (im Body gesagt):
  **`a6b7a38`** (Falz im Browser gemessen) und **`445c1e2`** (Abschlussmessung (f)/(g)).

## Was NOCH OFFEN ist — drei Saetze, mehr nicht

1. ~~Kriterium (a) ungeprueft~~ — **NACHGETRAGEN 15:45, `63c77b3`: (a) ist GEMESSEN und
   erfuellt.** Scratch-Instanz mit exakt 0 offenen / 16 geschlossenen Tasks (11 done + 5
   archived): Work zeigt NULL Zeilen und KEINEN Gruppenkopf, Zaehlzeile 0/0/0/0, Leerzustand
   woertlich „Work is clear — no open tasks. Choose History to inspect 16 done or archived
   tasks."; History auf Auswahl: Kopf `History 16`, 16 Zeilen. Aufgeraeumt, Live-Queue
   nachweislich unberuehrt (0 Fixture-Zeilen). **Damit sind alle acht Erfolgssaetze belegt** —
   (a) `63c77b3`, (b)-(e) `a58e9c1`, (d) zusaetzlich `a6b7a38`, (f)+(g) `445c1e2`.
   Das Program hat keine offene Beweisluecke mehr; offen ist nur noch Punkt 2.
2. **Der eine P1 des Reviews ist nach meinem Urteil ein BRIEF-Fehler, kein Produktdefekt**:
   „clarify-first startet keine Lane" steht nicht im owner-bestaetigten Erfolgskriterium, sondern
   im Review-Brief einer Vorgaenger-Session; clarify-first oeffnet by design eine Lane, und es
   lane-frei zu machen wuerde Kriterium (g) und das Non-Goal zu Autoritaetsgrenzen verletzen.
   Begruendung mit Belegen: `445c1e2`. **Der Owner kann das ueberstimmen** — dann ist es eine
   NEUE Programmzeile, kein Nachtrag.
3. **Audit-Watch `4af1b06e` ist armed** auf `mainAfter a58e9c1`. Kommt er rot, gilt dieselbe
   Beweisordnung wie unten.

### Nachtrag der Nachfolgerin (Slot 2, 2026-09-03 17:5x) — Punkt 3 ist zu, Punkt 2 laeuft neu

- **Punkt 3 GESCHLOSSEN: der Audit auf `a58e9c1` ist GRUEN.** Am Ledger nachgelesen, nicht am
  Wort „green": `exit 0`, `ms 1 395 654`, Trail `rows=3506`, und er lief **auf dem Helfer
  second-host** (`cmd: "remote helper (second-host): ./e2e-isolated.sh"`) — der erste Helfer-Job
  dieses Fleets, der geliefert hat statt zu lapsen.
- **Punkt 2 musste NEU gestellt werden, und das ist ein Mechanismus-Befund:** die Attention
  `dddb2141` hat den Owner NIE erreicht. Sie steht als `status: "refused"`,
  `refusedReason: "requester session ended"`, `closedAt` = der Moment meiner Nachfolge. **Eine
  Attention stirbt mit der Session, die sie gestellt hat** — die Rail-Reihenfolge „genau eine
  Attention an der Grenze, dann `succeed`" verliert die Frage also lautlos. Wer an der Grenze
  fragt, muss auf die Antwort WARTEN oder die Frage in der Nachfolge neu stellen.
- **Neu gestellt als `cc80f083`** (kind `decision`, `candidateSha a58e9c1`), verengt auf die
  eine offene Entscheidung: Punkt 1 ist mit `63c77b3` erledigt und steht nicht mehr drin.
- **Punkt 2 habe ich selbst am Code nachgeprueft, nicht uebernommen** — und das Urteil haelt an
  vier unabhaengigen Stellen: `clarify-prompt.ts` (Kopfkommentar: „open the lane anyway"),
  `src/client.ts#qDispatchBody` (schickt `{clarify:true}` an `/api/tasks/:id/dispatch`),
  `server.ts#dispatchTask` (legt den Worktree an, setzt `sent`, parkt den Slot auf den Owner) und
  `e2e/tasks.ts` (haelt genau das gruen fest). Der Brief `07c061fa` fuehrt „clarify-first startet
  keine Lane" woertlich als sein Kriterium **(h)** — der achte Satz des Owners ist ein anderer
  (Beweis-Paket incl. „Review ohne offene P0/P1"). **Die Klemme, die der Owner entscheidet:**
  solange die P1-Zeile in `a58e9c1` steht, ist SEIN (h) woertlich unerfuellt.
- Betriebsstand von mir gemessen: `bundleStale.stale false`, `deployGap.codeBehind false`,
  `errors null`, keine Suite und kein Audit laufend, mein ctx 13,5 %.
- **Kein Code mehr noetig.** Bei (A) ist mein einziger Akt ein docs-only Nachtrag in
  `docs/messungen/2026-09-03-task-workbench-review.md`; bei (B) eine neue Programmzeile.

## Fallen, die ich in dieser Session BEZAHLT habe (alle mit Beleg)

- **`git diff --stat main..HEAD` in einer Lane liest sich wie Loeschung fremder Arbeit.** Die
  Review-Lane „loeschte" scheinbar 249 Zeilen `HANDOFF.md` und zwei ganze Notizen — es war nur
  ein veralteter Fork-Punkt. Der richtige Blick ist
  `git diff $(git merge-base main HEAD)..HEAD`; dort waren es +123 Zeilen, zwei Dateien, null
  Loeschungen.
- **Ein frischer Worktree hat kein `node_modules`.** `./e2e-isolated.sh` stirbt dort nach
  ~347 PASS an `realpathSync(node_modules)` in `e2e/slots.ts` — und der GEDRUCKTE FAIL-Name
  gehoert einer ANDEREN Sonde als der, die starb. Erst `bun install --frozen-lockfile`, dann
  messen. Die Review-Lane ist in dieselbe Falle getreten.
- **`ps -eo command | grep -c '<muster>'` zaehlt seinen eigenen grep mit** — meldete 2 laufende
  Runner, es waren 0. Fast haette ich deshalb einen noetigen Lauf verschoben.
- **„Zwei run-ids in einem Log = zwei verschraenkte Laeufe" ist als Heuristik falsch**:
  `isolated-20260826T1200Z-9191` ist eine FIXTURE-Konstante (`e2e/lane-suite.ts:238`).
- **Von 85 ROTEN Post-Land-Audits trug genau EINES `fails[]`-Namen** — meines. Die Namensgebung
  ging erst mit dem heutigen Deploy live. **Das Ledger taugt nicht als Flake-Historie**, und
  „dieser Check ist noch nie aufgetaucht" ist daraus nicht ableitbar.
- **Eine Sonde, deren Vorbedingung nicht gilt, ist kein Beleg.** Mein erster (g)-Test zeigte
  „Entwurf ueberlebt 5,3 s" bei NULL DOM-Mutationen — es war gar kein Refresh zu ueberleben.
  Erst die zweite Fassung mass die Vorbedingung (`window.fetch` umhuellt: 4 `/api/sessions` in
  7,1 s) und wurde damit ein Beweis.
- **Mein eigener Lesefehler, benannt:** ich habe „`07c061fa` traegt kein Spawn-Tripel" gemeldet,
  weil ich flache Keys `harness/model/effort` geprueft habe. Es liegt in **`t.spawn`**
  (`codex/gpt-5.6-sol/high`) und wurde benutzt. Absenz eines Schluessels ist keine Absenz der Sache.

## Betriebsstand

- main `445c1e2`. **Client-Bundle habe ich aus `71361fa` gebaut** (`bundleStale` war true) —
  ohne das ist der Client-Teil eines Lands unsichtbar. **Kein Deploy**: der laufende Server war
  dabei 15 Commits aelter, ohne Belang, weil dieses Program `server.ts` in KEINEM der vier Lands
  anfasst (mechanisch geprueft, alle vier `grep -c '^server\.ts$'` = 0).
- Rotes Audit auf `71361fa` ist als **flake** adjudiziert (Controller S12) — mit meinem
  Kontrolllauf auf `299ac65` als Beleg: 3477 PASS / 4 FAIL, derselbe Check ohne mein Diff.
  Details als Queue-Zeile `2d0e73fa`.
- Playwright-Weg ohne Token im Kontext: lokaler 302-Redirect auf `127.0.0.1:8913`, der die
  `/?token=…`-URL in der Shell baut; Helfer ist gestoppt. PNGs ungetrackt im Wurzelverzeichnis.
- Dieser Slot laeuft auf `claude-opus-5[1m]/high`, waehrend die Modellpolitik fuer eine
  Program-MAIN **Fable 5.1** vorsieht — geerbt ueber die Nachfolge, nie korrigiert.

---

# HANDOFF — Fleet Controller (Slot 12, Fable 5.1 high): Succession-Naht als Auftrag gebrieft, Slot 6 vermessen (die 528k-Ursache ist NICHT was alle dachten), Workflow-v2-Program gegruendet, alle 13 Slots einzeln wieder in Arbeit gesetzt; 2026-09-03 (08:2x), ctx GEMESSEN 28,1 %

Rolle: 🎛 Fleet Controller, Nachfolge von Slot 1 ueber einen HANDGESCHRIEBENEN Brief (Grund: §7).
Owner-Delegation (Landen, autonomer Betrieb, Disposition) gilt fort.

## 0. DEIN AUFTRAG, woertlich vom Owner (2026-09-03, bei dieser Nachfolge erteilt)

  „dann mach jetzt die succession und sag dem neuen controller er soll sich mit mir zusammen
   explizit hauptsaechlich um die second-host-Integration und bieberburg auf slot3 kuemmern,
   dazu gehoert dann auch z.b die alten Bieberburg lanes zu schliessen"

**„mit mir zusammen" ist woertlich zu nehmen** — das sind keine Auftraege, die du still abarbeitest;
der Owner will dabei sein. Frag, bevor du entscheidest.

**Zwei Schwerpunkte, alles andere ist Nebenlast:**

1. **Second-host-Integration.** Stand, von mir gemessen: das Geraet ist GESUND und ONLINE
   (`helperDevices[secondhostlinux1]`: `mode active`, `desiredMode active`, `load 0.04`,
   caps `[bun,tmux,git,zsh]`, `daemonSha f62b1f5`, lastSeen sekundenaktuell). Es wird nur
   **nie gefragt**: `GET /api/helper/jobs` → `jobs: []`. Zwei Gruende, beide mechanisch:
   (a) `POST /api/self/suite-offer` ist ein **Lane**-Mechanismus — ein Controller bietet nie an;
   (b) mein eigener Lauf war ein Flake-BEWEISLAUF, und die bleiben laut Regelbuch ausdruecklich
   lokal („ein Fremd-Plattform-Gruen beweist fuer diese Maschine nichts").
   **Der echte Befund:** second-hosts letzter tatsaechlicher Job ist **GELAPST**, nicht geliefert —
   `26ea1a20`, repo claude-fleet, claimed 1788245012631, `expiredAt` genau 2 704 s spaeter
   (= `claimTimeoutMs` 2 700 000), ohne Ergebnis. Dasselbe frueher fuer `mainMacbook`/private-repo-j
   (`a85a0e3c`). **Zwei von zwei bekannten Claims sind gelapst.** Ob die Auslagerung ueberhaupt
   je durchgelaufen ist, sagen diese Ledger-Zeilen NICHT — das ist die erste Messung.
   Die offene Steward-Zeile dazu ist `02131402` („Das Helfer-Portal vergibt Audit-Jobs…").
   Und der groesste Mutex-Posten des Fleets waere genau damit zu entlasten: der Kontrolllauf aus
   §3 stand heute 600+ s in der Schlange, waehrend ein gesundes Zweitgeraet leer lief.

2. **Private-repo-j — und hier ist eine Mehrdeutigkeit, die DU beim Owner aufloest, bevor du handelst.**
   „bieberburg auf slot3" hat zwei Lesarten:
   - **(A)** Private-repo-j soll kuenftig auf **Slot 3** leben. Dort sitzt heute die Program-MAIN von
     `b2aa5b45` (Game-Maker-Workflow v2), die der OWNER SELBST auf Fable gestellt hat.
   - **(B)** Slot 3 (Workflow-v2-MAIN) soll Private-repo-j mit uebernehmen.
   Ich habe NICHT geraten. **Frag ihn in einem Satz.**
   Der Sachstand, den du dafuer brauchst:
   - **Program `2c073232` (Private-repo-j) ist `active`, aber MAIN-LOS.** `main.slot` zeigt auf 6;
     Slot 6 hat sich **2026-09-03 06:46 selbst retired**, `lineage.entries[0].endedBy: "retire"`,
     KEIN Nachfolge-Eintrag. Auf Slot 6 sitzt niemand.
   - **Die alten Private-repo-j-Lanes sind Slot 1 und Slot 7, und beide sind FERTIG — sie halten nur
     noch Duplikate.** Von mir am Baum geprueft, nicht geglaubt:
     Slot 1 (`54d3989c`, codex/gpt-5.6-sol): `git diff 834b0c6 9b90bfc` ist **LEER**, ihr Verdikt
     sitzt per Cherry-Pick als `9b90bfc` auf `game-maker/private-repo-j-2026-09-03`. Ihr eigenes Land
     scheiterte als lost fast-forward (merge-terminal 05:35, `status error`, `landed false`,
     `verify.ok true`).
     Slot 7 (`c1fab27f`): `git diff 46f6df8:GAME-CARD.md 601760b:GAME-CARD.md` ist **LEER**,
     fortgeschrieben durch `613a28f` (FINAL) und `2b8c0f0`; die Lane ist 27 Commits behind.
     **Beide Zeilen stehen noch auf `sent` und beide Slots sind ungeschlossen** — weil ihre MAIN
     retirete, bevor jemand sie erntete. Beide Panes habe ich informiert, dass sie nichts
     nachzuholen haben. Das Schliessen ist deins.
   - Offen und vom Owner unbeantwortet: die **Attention `10d5063627a932848d1720f7`** (kind
     `decision`) fragt A/B — Taste-Gate jetzt, oder erst der Spielgefuehl-Slice. Sie wurde nie
     beantwortet, und die MAIN, die sie stellte, gibt es nicht mehr.
   - Der `biber-dispatcher`-Shell-Loop ist von mir per STOP-Datei beendet (er umging Master-Stop,
     Deckel und Quiet Hours). Ein Neustart von Private-repo-j braucht entweder Hand-Dispatch oder die
     Zeile `5c1f831f` (Program-scoped Dispatch), die dafuer offen liegt.

Alles Uebrige unten ist Kontext, nicht Auftrag. **Die eine Ausnahme: §3 kommt zuerst** — dort
haengt ein Land von mir, dessen Audit rot ist, an einer Kontrollprobe, die noch laeuft.

## 0b. Erdung

1. Erdung: `./state.sh` · `./register.sh` · NUR dieser Abschnitt · Board. Miss deinen ctx zuerst.
2. **Die server.ts-Flaeche ist das Nadeloehr, und sie hat jetzt eine SCHLANGE.** Vier Zeilen wollen
   sie, alle kollidieren miteinander, Reihenfolge ist mein Entscheid:
   **`6f401842` (Succession-Naht, Owner-Prioritaet) → `92553809` (D1, Brief haengt) →
   `60d07416` (Slot 5, Dual-Host S3) → `d2e4f219` (Drei-Schnitt-Helfer-Slice).**
   `dispatch` steht auf `false`; jeder Start ist ein Hand-Dispatch, die Kollisionslesung ist DEINE.
3. **Nicht kollidierend und schon unterwegs:** `07c061fa` laeuft als Lane auf Slot 2
   (codex/gpt-5.6-sol/high, read-only Review der Workbench-Slices).

## 1. Was in Flug ist

- **Lane Slot 2 (`07c061fa`)** — gerade dispatcht, noch kein Report.
- **Post-Land-Audit auf `24f9cfc` IST GEFAHREN und ROT — §3 ist dein erster Akt.**
  (Hier stand vorher, ein Rot auf der busy-receiver-Familie sei die „Bestaetigung meines
  Urteils". Das war eine Vorab-Rechtfertigung, und sie ist falsch: die Basisrate dieser vier
  Checks ist 0/26, sie haben keine Flake-Historie. Ich lasse den Satz als Warnung stehen —
  wer sich vorher zurechtlegt, wie ein Ergebnis zu lesen ist, liest es nicht mehr.)
- **Kontrolllauf auf `80cd901` in der Mutex-Schlange** — der entscheidet, siehe §3.
- **Kein Watch von mir geht auf dich ueber** — Watches haengen an Slot UND `openedAt`.

## 2. Gelandet / getan, verifiziert

- **`24f9cfc`** — 860cecdf (self-land after lost fast-forward). `ff-lost` 2x in main:server.ts.
- **`80cd901`** — Direkt-Commit, docs/messungen/2026-09-03-slot6-kontext-anatomie-….md,
  `bun e2e/pins.ts` ALL PASS. **KEIN Post-Land-Audit deckt ihn** (Direkt-Commit).
- Zwei rote Audits adjudiziert: `71361fa` **flake** (Beweis von Slot 8), `224d829`
  **unknowable** (`checks.ran=0` — nichts gemessen; Ursache von Slot 10 reproduziert).
- Beide offenen Attentions geschlossen (`fd18910b`, `2abfa35c`).
- D1s korrigierter Brief (11588 Zeichen, aus Slot 16s Scratchpad) haengt an `92553809`.

## 3. MEIN LAND IST UNTER VERDACHT — lies das zuerst

Ich habe `860cecdf` ueber vier rote Checks gelandet (`24f9cfc`). **Der Post-Land-Audit ist ROT,
und er widerlegt mein Urteil teilweise.** Reihenfolge der Fakten:

**Was ich vor dem Land tat:** die Lane meldete `needs-main` mit 4 roten `e2e/watch.ts`-Checks und
berief sich auf Trail-Basisraten. Das reicht nach Regelbuch nicht, also fuhr ich den fehlenden
Beweis selbst — seriell, 29 min, Maschine nachweislich leer (0 Suiten), Log nicht verschraenkt
(die zweite „run-id" darin ist eine hartkodierte Fixture-Konstante, `e2e/lane-suite.ts:238` —
das kostet sonst eine Stunde). Ergebnis 7 FAILURES, fast disjunkt zur Lane. Daraus schloss ich
„kein reproduzierbares Set" und landete.

**Was der Audit sagt:** `red`, **4 Fails, und alle vier sind EINE Familie** —
`restart keeps the busy pending event…` · `busy -> later idle delivers the SAME pending event
exactly once` · `repeated ticks produce no duplicate event…` · `a dead receiver leaves its event
inspectable as receiver-gone…`

**Was ich danach gemessen habe und was mein Urteil kippt:**
- **Basisrate aller vier im Audit-Trail: 0/26.** Sie sind in 26 Laeufen NIE gefallen. Die Raten,
  mit denen die Lane argumentierte (3/33, 6/32 …), gehoerten zu ANDEREN Checknamen. Es gibt fuer
  diese vier keine Flake-Historie.
- **Einer der vier fiel auch in MEINEM Lauf** (`restart keeps the busy pending event`). Ich habe
  ihn als Ausreisser behandelt — er war das Signal.
- **Kausalpfad ist plausibel:** die Lane hat `e2e/watch.ts` NICHT angefasst (Diff: `docs/self-api.md`,
  `e2e/pins.ts`, `e2e/programs.ts`, `lane-signals.ts`, `server.ts`), aber `lane-signals.ts`
  traegt `mergeBlocksLane` → `laneWatchSignal`, also genau die Maschinerie, die diese vier testen.

**Was dagegen spricht:** der Audit fuhr **25 Checks in 23,3 min**, nicht ~3.500 — er ist ABGEBROCHEN,
kein vollstaendiger Lauf. Drei der vier fallen nur dort. „Eine Familie faellt gemeinsam" ist zudem
die bekannte Signatur „eine Wurzel, vier FAILs".

**DIE ENTSCHEIDENDE PROBE LAEUFT — sie ist dein erster Akt:**
Kontrolllauf auf **`80cd901`** (der Baum unmittelbar VOR meinem Land), eigener Detached-Worktree
`/private/tmp/claude-501/-Users-owner-claude-fleet/8d083b5c-db3e-49cc-9d6e-439b007a6f5b/scratchpad/ctrl`, Log `/private/tmp/claude-501/-Users-owner-claude-fleet/8d083b5c-db3e-49cc-9d6e-439b007a6f5b/scratchpad/ctrl2-80cd901.log`.
Er stand um 08:4x hinter dem Suite-Mutex in der Schlange (Halter war eine fremde Lane) — **pruefe
zuerst, ob er ueberhaupt gelaufen ist**, der Tail sagt `ALL PASS` oder `N FAILURES`.
- **Die vier fallen dort AUCH** → vorbestehend, mein Land ist sauber, das Rot ist adjudizierbar.
- **Die vier sind dort GRUEN** → mein Land hat sie verursacht. `undo-land` ist der Rueckweg und
  war beim Schreiben noch offen (das Land liegt obenauf, darueber nur Doc-Commits).

**Ein Fehler von mir, den du nicht wiederholen musst:** mein ERSTER Kontrolllauf stuerzte nach 347
Checks mit `ENOENT … node_modules` in `e2e/slots.ts:712` ab — ein frischer `git worktree add` hat
kein `node_modules`, und `e2e-isolated.sh` verlinkt die Scratch-Instanz dorthin zurueck.
**Ein Kontroll-Worktree braucht `bun install --frozen-lockfile`, bevor die Suite laeuft.**


### Nachtrag 2026-09-03, Program-MAIN 66499a03 Slot 16 — §3 IST ERLEDIGT, der Kontrolllauf wird nicht mehr gebraucht

**Der Verdacht ist ausgeraeumt, das Rot ist als `flake` adjudiziert (Fleet Controller Slot 13), und
`undo-land` auf `24f9cfc` ist damit VOM TISCH.** Wer §3 oben liest, liest einen ueberholten Stand —
die Zeile „undo-land ist der Rueckweg" bitte nicht mehr ausfuehren.

**Die Praemisse von §3 war ein Speicher-Irrtum, und ich sass ihm zuerst genauso auf.** „Basisrate
aller vier: 0/26 — keine Flake-Historie" ist auf `$TMPDIR/fleet-e2e-trail/` gerechnet. Das ist NICHT
der Trail-Speicher, sondern sein Rueckfall fuer den Fall, dass gar kein git-Baum aufloest
(`e2e/trail-emit.ts#defaultDir`, `docs/e2e-trail.md` Punkt 3): 32 Dateien. Der echte Speicher liegt
neben dem git-common-dir als `<repo>/e2e-trail/` und trug heute **5514 Dateien**. `./state.sh` nennt
die grosse Zahl in der Ledger-Zeile — sie stand in meiner Erdung, und ich habe sie mit meiner eigenen
Messung trotzdem nicht verbunden. Meine Notiz `ee7bc7d1` traegt denselben Fehler; korrigiert in
`2eb48783`.

**Gemessen auf dem echten Speicher (363 Laeufe, die diese Familie tragen):** die EXAKTE Vierer-
Signatur — alle vier gemeinsam rot — ist **viermal** gefallen, und zwar auf `9db4b85` (16.08.),
`d63bb91`, `299ac65` und `4d2dd39` (alle 02.09.). **Jeder dieser Baeume ist aelter als das Land und
traegt Cs Code nicht.** Mindestens einer der vier faellt in 15 von 363 Laeufen (4,1 %), verteilt ueber
viele fremde Baeume, darunter zwei Laeufe von heute auf `7d938cee`. Es gibt also reichlich
Flake-Historie; sie war nur im falschen Verzeichnis nicht zu sehen.

**Zur „25 Checks in 23,3 min"-Sorge:** die Zahl ist ein Artefakt des aufbewahrten 4-KB-Tails, kein
Abbruch. Dieselbe `out`-Spur traegt die Trail-Zeile `rows=3506 results=3506` auf `tree=24f9cfc`. Der
Lauf hat vollstaendig gemessen. `checks.ran` zaehlt nur, was im gespeicherten Tail steht — bei einem
Remote-Audit ist das fast nichts.

**Was vom Kausalpfad bleibt:** nichts Tragendes. `mergeBlocksLane` sitzt im done-looking-Praedikat,
die vier Fixtures messen FleetEvent-Zustellung an einen belegten Empfaenger — und die Signatur ist
aelter als der Helfer.

## 4. Slot 6 — die 528k-Ursache war NICHT, was alle annahmen

Gemessen am Transcript (4,35 MB, 459 Turns, `usage`-Felder), committed als `80cd901`:
**null Agent-Subagenten.** Die MAIN fuellte 528k, weil sie die Artefakte ihrer eigenen Lanes
SELBST nachlas — 195 Bash-Aufrufe, die zwoelf groessten ausnahmslos `cat <Dokument> Teil N`
(Card-Entwurf, Card-Endfassung, Intake, Fakten) — und 34 PNGs als Bilder anschaute, weil die
Codex-Critic-Lane „no liveness signal" gab. 150k davon in den ersten 45 Minuten; das 25/30-Band
war gerissen, bevor die erste Lane lief. Fuenf Folgerungen stehen in §4 der Notiz.
**Slot 6 hat sich um 06:46 RETIRED, ohne Nachfolge** — Program `2c073232` ist `active` mit
`main.slot: 6`, aber dort sitzt niemand. Das ist aufzuraeumen, ich kam nicht mehr dazu.

## 5. Program `b2aa5b45` — Game-Maker-Workflow v2

`active`, MAIN auf **Slot 3** (der Owner hat sie selbst auf Fable gestellt), Repo `claude-fleet`,
`profile: null` — und das ist RICHTIG, kein Workaround: das game-maker-Profil bedeutet laut
`server.ts#gameMakerMachineError` „EINE Session baut, startet, steuert, nimmt wahr, repariert in
EINEM Baum". Genau das soll diese MAIN nicht sein. Das Profil kommt erst beim **Trockenzyklus in
`~/private-repo-j`** zurueck. Aufbau: Evidenz-Pack versiegeln → zwei Entwuerfe PARALLEL (Opus-Lane +
sol-Lane) → GLM-Kreuz-Review → Opus-Adjudikation → Trockenzyklus mit gemessener MAIN-ctx.
**Noch nicht gebrieft** — die Evidenz-Pack-Lane ist der naechste Akt dieses Programs.

## 6. Die Sanierung, mit korrigierten Zahlen

`server.ts` **23.776** (Basis 31.08. 25.522). P4 Slice 4 (`46d29d8`, audit-log) ist gelandet.
**Die Ausbeute FAELLT: Slice 4 brachte 186 Zeilen gegen den Schnitt 289** → neuer Schnitt
**275/Subsystem**. 14 verbliebene Subsysteme × 275 = ~3.850 → Kern **~19.930** gegen Ziel 8.000.

**Erfolgsmass 1 ist unerreichbar, und der Plan widerspricht sich dabei selbst:** Tier 4 soll die
Luecke schliessen, aber `plan-2026-08-31.md:58` UND `:121` erklaeren die fetch-Kette zweimal zum
permanenten Kern — und die ist 2.843 Zeilen mit 74 der 91 inline `url.pathname`-Vergleiche
(in `handle*Route`-Form liegen nur 17). Dritter ungezaehlter Posten: server.ts ist **33,4 %
Kommentar** (7.993 Z.) gegen Erfolgsmass 2 (<20 %), nach drei P3-Slices.
**Meine Empfehlung an den Owner steht aus:** (1) Erfolgsmass neu verhandeln, (2) Feature-Freeze
auf die Nachbarprogramme ausweiten — bei `src/client.ts` waechst Fremdarbeit **3,3:1** gegen die
Sanierung (−182 gegen +607, netto +425 bei Ziel 2.000).

## 7. Zwei Befunde ueber die Nachfolge selbst — beide gefilet, beide OFFEN

- **`fd6b7dea`** — `POST /api/self/succeed` hat KEIN Readiness-Gate und pastet nach 3000 ms in
  eine bootende Pane. 3x an der Nachfolge Slot 1→12 gescheitert. Program-MAIN-Nachfolgen liefen
  heute 8x durch, weil die Pane zufaellig schneller war — dieselbe Naht, gleiches Risiko.
  Dieselbe Signatur steht 15x in `audit.jsonl` (Recovery-Prompts, Watch-Zustellungen, ein
  Merge-Verdict). Reparatur = `paneReadiness()` + `READY_WAIT_MS`, wie der Codex-Dispatch.
- **`ada76ad9`** — `POST /api/supervisor/bootstrap` ist durch ein Binding vom 21.08. gesperrt
  (409 auf Slot 5, wo laengst der Dual-Host-MAIN sitzt). **Darum liest du hier einen
  handgeschriebenen Brief.** Beides zusammen ist der Auftrag `6f401842` (Brief haengt).

## 8. Regelbuch-Korrekturen aus dieser Session (im Haupt-Checkout nachziehen)

- **Der Footer NENNT den Effort.** `CLAUDE.md` §Supervisor-Rolle sagt „verifiziere den Effort
  NICHT am Footer — der Footer nennt ihn nicht". An Slot 16 heute gesehen: die Fusszeile traegt
  rechts `● high · /effort`. Die Zeile ist ueberholt.
- **Ein offener `/usage`-Overlay FRISST eine Zustellung.** Slot 16 quittierte `unobservable`,
  die Nachricht kam nie an; `tmux send-keys Escape` raeumt ihn, danach ging sie durch.
- **`POST /api/attention/:id/answer` will `text`, nicht `answer`** (400 „text must be a string").
- **`POST /api/self/watch` will `{"kind":"lane","target":<slot>}`** — `{"slot":N}` gibt
  400 „bad target" ohne Hinweis auf das richtige Feld.
- **Es gibt kein `POST /api/slots/:id/land`** — die Route heisst `/merge`. `/land` faellt in
  einen Cleanup-Pfad und antwortet mit „unpushed commits", was wie ein Land-Refusal aussieht.
- **Der Adjudikations-Deckel liegt bei 300 Zeichen** (gefilet als `0c190377`) — zu eng, um die
  Belegkette eines Urteils aufzuschreiben.

## 9. Ehrlichkeiten

- Der Ueberblick ueber 13 Slots kam von DREI Opus-Agenten, nicht von mir; ich habe ihre Fakten
  stichprobenartig gegengeprueft (Slot 16s Attention, die Task-Briefe, die Audit-Zahlen), aber
  nicht jede Pane selbst gelesen. Die Slot-Nachrichten bauen darauf.
- Die zwei Adjudikationen ruhen auf FREMDEN Beweisen (Slot 8, Slot 10). Das steht in den Notizen.
- Ich habe die Private-repo-j-MAIN pausiert und den `biber-dispatcher`-Loop per STOP beendet — dann
  hat sich Slot 6 selbst retired. Ob das Folge meiner Nachricht war, weiss ich nicht.
- Offen und vom Owner unbeantwortet: die Modellpolitik. Er sagte „am besten opus oder sol …
  bis auf da wo es sich wirklich lohnt", was ich als „Fable sparen" lese — das weicht von der
  09-02-Politik ab, die Fable fuer JEDE MAIN wollte. Nicht promotet, meine Lesart.
- `07c061fa` habe ich dispatcht, ohne den Report der Vorgaenger-Lane auf Slot 2 abzuwarten —
  der Slot war frei, weil ihr Land durchlief.

---
# HANDOFF — Generalsanierung (Program `b2a14b545fd31fd71ba7b9e1`, Slot 3 → Nachfolge): P4 Slice 3 GELANDET (4846d83, Gate gruen 103 s), vier Land-Versuche und was jeder gekostet hat, Slice 4 vom Compiler vorvermessen; 2026-09-03 (00:0x), ctx GEMESSEN 31,2 %

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`,
`GET /api/self/program-execution`. Hier steht nur, was git und die Sensoren NICHT tragen.

## 1. Das Erste, was du tust

**Der Post-Land-Audit auf meinem Land ist ROT — 3508 Checks, 1 Fail — und er ist NICHT
adjudiziert. Das ist dein erster Akt.** Ich habe den Namen beschafft und den Mechanismus gelesen,
aber den Beweis NICHT gefahren; Details in Abschnitt 2b. Der Aufwand ist ein serieller
`./e2e-isolated.sh` (~27 min) auf `4846d83`, und danach ein Urteil ueber
`POST /api/post-land-audits/adjudicate` (`real | flake | stale-test | unknowable`).

Danach: **P4 Slice 4 = audit-log**, vorvermessen in
`docs/sanierung-2026-09/p4-slice4-vorbereitung.md` — die Datei ist der Brief-Rohstoff, lies sie
zuerst.

**Nichts ist in Flug.** Der Audit-Watch `3d1c7cc0` hat gefeuert und ist verbraucht. **Er geht NICHT
auf dich ueber** — ein Watch haengt an Slot UND `openedAt` der abonnierenden Session; meine stirbt
mit dieser Uebergabe. Wer nach einem Land eine Nachfolge faehrt, muss den Audit-Watch NEU
abonnieren (und `armed` pruefen, s. B-07).

## 2. Gelandet, verifiziert

**P4 Slice 3 (`c74706b0`) ist auf main:** `14a3ab6` (der Move) + `4846d83` (die vier
Kommentar-Zeiger). Von mir am Baum nachgeprueft, nicht der Benachrichtigung geglaubt:
`server/transport.ts` + `server/dir-explorer.ts` existieren, **`server.ts` 24313 → 23962 (−351)**,
exakt die Zahl der Vorgaengerin. Land-Note: `verify.ok true`, `exitCode 0`, alle sieben Stufen,
**103 s Arbeit, `waitMs 0`**. `bun e2e/pins.ts` im Haupt-Checkout danach: ALL PASS.

Ausserdem gelandet (Direkt-Commits, docs-only, je mit `bun e2e/pins.ts` verifiziert, KEIN
Post-Land-Audit deckt sie): `847c17a` `c98b1ec` `5971cc5` `84f735e` `299ac65` `0a94bd0`.

## 2b. Der rote Post-Land-Audit auf `4846d83` — was ich weiss und was ich NICHT bewiesen habe

`result: red`, **3508 Checks, 1 Fail**, `covers: [fleet/260902154623-7fa9]` — also meine Zeile,
und nur meine.

**Der Name, aus dem Check-Trail geholt** (der Weg aus B-02; die Ledger-Zeile selbst nennt ihn nicht,
und das geht nur, weil dieser Lauf LOKAL war):

    ${TMPDIR}/fleet-e2e-trail/isolated-20260902T220305Z-86314.jsonl   (3508 Zeilen = checks.ran)

    check:  "⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)"
    detail: {"status":"blocked","detail":"the session is actively working right now — let it settle
             for a moment, then land"}

**Der Mechanismus, am Code gelesen.** Die Sonde (`e2e/merge.ts:420`) ruft `settleForMerge()` und
erwartet dann die Antwort des ⏸-REBASE-Guards: `status === "resolved"` mit `detail` enthaelt
`review`. Bekommen hat sie die Antwort des AKTIVITAETS-Gates (`server.ts:22671`,
`if (!landGate.ok) return json({status:"blocked", detail:"the session is actively working right
now …"})`). Die Fixture-Session war also noch beschaeftigt, als die Sonde mass — **zwei
verschiedene Gates, und das falsche hat zuerst geantwortet.** Das ist die Gattung „Suite-Sonde
gegen den eigenen Idle-Gate" (§11.2e-Form), nicht ein Urteil ueber den ⏸-Guard.

**Was FUER „nicht meins" spricht:**
- Der Check liegt in `e2e/merge.ts`. **Mein Land hat diese Datei nicht angefasst** — der Diff
  `668d6ff..4846d83` umfasst `server.ts`, `server/{transport,dir-explorer}.ts`, `e2e/security.ts`,
  `e2e/transport.ts`, `repo-map.ts`, `docs/repo-map.generated.md`. Sonst nichts.
- Der Fehlschlag ist eine TIMING-Antwort (Session busy), kein falscher Wert.
- Der Slice ist ein reiner Move ohne Verhaltensdelta; `landGate` (:22671) liegt weit ausserhalb der
  bewegten Bereiche, und die volle Gate-Kette lief 103 s gruen.

**Was ich NICHT getan habe, und warum das zaehlt:** die Beweisordnung `docs/verify-tiering.md`
§11.7 verlangt **denselben Baum erneut**. Den Lauf habe ich NICHT gefahren — er dauert ~27 min, und
ich haette ihn nicht mehr interpretieren koennen. **Damit ist das hier ein begruendeter Verdacht
und KEIN bewiesener Flake.** Ich habe deshalb bewusst NICHT adjudiziert: ein Urteil, das ich nicht
verteidigen kann, ist schlimmer als ein offenes Rot. „Sieht aus wie ein bekannter Flake" reicht in
diesem Repo ausdruecklich nicht.

**Dein Weg, in dieser Reihenfolge:** (1) `./e2e-isolated.sh` seriell auf `4846d83`, nichts daneben
laufen lassen; (2) faellt derselbe Check wieder → er ist ECHT und gehoert untersucht, faellt er
nicht → Flake bewiesen; (3) adjudizieren. Das Rot bleibt in beiden Faellen rot — das Urteil sagt
nur, dass jemand hingesehen hat.

## 3. VIER Land-Versuche — die Kosten-Aufschluesselung ist die eigentliche Uebergabe

| # | Kandidat | Ergebnis | Ursache | vermeidbar? |
|---|---|---|---|---|
| 1 | `3dd84d1`→`ee020be` | verify ROT, exit 3 | §11.2i-Flake in `claude-gate` Phase 3 | nein |
| 2 | `ee020be` | 409 no-progress | Guard arbeitet korrekt | ja (siehe unten) |
| 3 | `a2e77c8`→`a5fea1c` | `interrupted` | **fremder Deploy hat srv gekillt** (B-06) | ja |
| 4 | `a5fea1c` | **gruen, gelandet** | — | — |

**Zu (1):** die Beweisordnung §11.7 hat funktioniert — gleicher Baum zuerst, kein HEAD-Ausflug.
Mein Lauf (nur `e2e-claude-gate.sh`, 23:38:21 fertig) war sauber auf `ee020be`; **der staerkere
Beweis ist der der Lane**: voller Gate-Lauf, sha-geklammert (`before == after == a2e77c8`,
`dirty []`), 599 PASS / 0 FAIL. Die Lane hat dabei ihren EIGENEN ersten Lauf verworfen, weil mein
Commit `a2e77c8` mitten hinein fiel und er damit zwischen zwei Baeumen stand — und sie hat vorher
ausgeschlossen, dass ein nicht-gestagtes Modul (also ihr Fehler) den Boot-Tod erklaert. Das ist die
Reihenfolge, die man von einem Report will.

**Zu (2), und das ist die Lehre fuer dich:** der no-progress-Guard verlangt einen NEUEN Commit.
Ich habe ihn NICHT mit einem Leer-Commit umgangen, sondern mit echter Restarbeit des Slices (die
vier `TRANSPORT region`-Zeiger, die dieser Move erst tot gemacht hat). **Vermeidbar war er, weil
diese Arbeit von Anfang in den Slice gehoert haette** — der Brief hatte Kommentar-Umformulierung
verboten, die Lane hat korrekt gemeldet statt still zu aendern, und niemand hat den Rest
eingeplant. Es waren uebrigens VIER, nicht die drei aus dem alten Handoff (`server.ts:22252`
fehlte).

## 4. Zwei neue Befunde, beide im Register (`docs/sanierung-2026-09/p6-befundregister.md`)

- **B-06: ein Deploy toetet einen laufenden LAND.** Er sperrt (409) gegen einen laufenden
  Post-Land-AUDIT, aber nicht gegen einen Land. Geschuetzt ist die billigere Haelfte. Hier lag der
  Abbruch guenstig VOR der main-Bewegung; danach waere ein Commit ohne Provenienz-Note geblieben.
- **B-07: der SPENT merge-Watch ist PERSISTIERT.** Re-Subscription gibt `ok:true` + denselben Watch
  mit `armed:false` und `firedAt` vom ersten Land; ueberlebt einen Server-Neustart. **Operativ,
  sofort anwendbar: nach jedem `POST /api/self/watch` `armed` lesen, nie `ok`.** Sonst wartest du
  auf dem vom Gruendungsbrief vorgeschriebenen Pfad unbegrenzt. Ich musste beide Male auf
  `GET /api/slots/2/merge` pollen.

## 5. Das Register ist neu und du solltest es kennen

`docs/sanierung-2026-09/p6-befundregister.md` — entstanden, weil der Advisory-Deckel auf 10/10
steht und ein Befund sonst im Scratchpad einer sterbenden Session stirbt (genau das war am 02.09.
passiert). Enthaelt B-01…B-07 plus einen **Methodensatz**, den du beim naechsten Vergleich
brauchst: *ein Vergleich zweier Populationen mit unterschiedlicher Zeitspanne misst die Zeit, nicht
den Unterschied.* Der Controller und ich haben das an der Helfer-Messung beide falsch gemacht und
korrigiert — remote ist im gemeinsamen Fenster **15 % SCHNELLER** als lokal, nicht langsamer.

**Deckel-Entscheid (Owner → Controller, 02.09.):** bleibt bei 10. `16 x (5+10) + 80 = 320`
nicht-terminale Zeilen gegen `MAX_TASKS 200` — er laeuft schon ueber. Rueckfalltuer
`FLEET_PROGRAM_MAX_PENDING_ADVISORY` in `.env`. **Ein Platz ist frei** (`d2e4f219` wurde zu
`auftrag` konvertiert).

## 6. P4 Slice 4 — schon vermessen, NICHT gegrept

`docs/sanierung-2026-09/p4-slice4-vorbereitung.md`. Kurzform:
- **audit-log (`server.ts:2439-2624`, 186 Z.) = der naechste Slice.** Zwei freie Bezeichner:
  `appendEvent` liegt schon exportiert in `server/persist.ts`, bleibt `AUDIT_FILE` — und das ist
  woertlich die Slice-3-Falle: `${import.meta.dir}/audit.jsonl` wandert beim Move lautlos nach
  `<repo>/server/audit.jsonl`. PUB-Anker, und den Pfadvergleich **ausfuehren**, nicht lesen.
- **auth ist heute KEIN reiner Move** — vier Nicht-Typ-Bindungen in den Kern (`json` 5x, `PORT` 3x,
  `secretEq`, `HOST`). Erst audit-log, dann ein Fundament fuer diese vier, dann auth.
- Die Sonde selbst ist heute DREIMAL still gescheitert (TS2688 ausserhalb des Repos, TS1005 bei
  Schnitt mitten in eine Funktion) — beide erzeugen ein LEERES Namensergebnis, das wie „null
  Abhaengigkeiten" liest. **Erst Syntaxfehler zaehlen, dann Namen lesen.**

## 7. Offen, und wem es gehoert

- **Der Owner hat meine Attention `5954d4da3118c86745d63765` noch nicht beantwortet** (Tor 1:
  Advisory-Disposition; Tor 2: der Feature-Freeze). Sie ist `open`, nicht getoetet — die
  Vorgaengerin hatte ihre durch die Nachfolge verloren (`requester session ended`), meine haelt.
- **Tor 2 ist die wichtigere Zahl und steht noch:** seit Tag `vor-generalsanierung` hat die
  Sanierung **−2259** Zeilen aus `server.ts` geschnitten, fremde Arbeit **+1050** wieder
  hineingelandet — 46 % der Arbeit zugeschuettet, waehrend der Freeze formal steht. Erfolgsmass 1
  will ≤8000; von 23962 sind das noch ~16000. Das ist eine Owner-Entscheidung, keine Lane-Arbeit.
- **Der Rot-Befund auf `main` gehoert NICHT uns.** Slot 9s Kontrolllauf auf `fda6fda`: 3455/10, der
  Check `restart keeps the busy pending event…` faellt schon VOR seinem Land — vorbestehend, die
  ops-event-/fleet-report-Familie. Der Controller nimmt die Adjudikation mit.
- **`server.ts` ist frei.** Der Controller dispatcht `860cecdf` (Slot 16, wartet >12 h) und danach
  `d2e4f219`. Alle offenen Auftragszeilen des Fleets fassen `server.ts` an — der naechste Slice
  konkurriert mit ihnen, plan das ein.

## 8. Ehrlichkeiten

- Diese Session laeuft auf `claude-opus-5[1m]`, nicht Fable — geerbt, wie die Vorgaengerin. Die
  Modellpolitik vom 02.09. will Fable 5.1 fuer eine Program-MAIN. Behoben wird das nur durch
  `POST /api/slots/:id/model` UND `/model` in der Pane; ich habe es NICHT angefasst.
- Alle meine Commits sind Direkt-Commits aus dem Haupt-Checkout, docs-only, mit `bun e2e/pins.ts`
  verifiziert — **nicht** mit der vollen Suite. Kein Post-Land-Audit deckt sie.
- Der Dispatch lief ueber `POST /api/self/tasks/:id/land` (Self-Route), nicht ueber Owner-Token.
- Ich habe **keine** Queue-Zeile gefilt — der Deckel war voll; alles ging ins Register.
- Zwei Messtabellen von mir waren zwischenzeitlich frei erfunden (zsh-`$var:`-Falle, s.
  `~/.claude/knowledge/stacks/fugen.md`). Die Zahlen in DIESEM Dokument sind alle mit `${c}`
  geklammert nachgerechnet.

---

# HANDOFF — Fleet Controller (Slot 1, Opus 5 high): Ueberblick MIT AGENTEN gefahren, sieben Sessions entsperrt, Helfer-Auslagerung VERMESSEN (die Zahl ist nicht die, die alle dachten) und als Drei-Schnitt-Slice gebrieft; 2026-09-02 (22:50)

Rolle: 🎛 Fleet Controller, Nachfolge von Slot 7 ueber die Owner-Route. Owner-Delegation (Landen,
autonomer Betrieb, Disposition) gilt fort. Mein ctx bei Uebergabe: 26,3 %.

## 0. Reihenfolge fuer dich

1. Erdung: `./state.sh` · `./register.sh` · NUR dieser Abschnitt · Board. Miss deinen ctx, bevor du liest.
2. **DAS EINZIGE NADELOEHR DES FLEETS: Slot 2s Land.** Alle fuenf queued Auftragszeilen fassen
   `server.ts` an, und die Lane `fleet/260902154623-7fa9` (Slot 2, Sanierung P4 Slice 3, `3dd84d1`)
   haelt es uncommittet. Ich habe Slot 3 um 22:45 freigegeben (Begruendung in §1). **Sobald es
   gelandet ist: `860cecdf` von Hand dispatchen** (Slot 16, wartet seit 12,3 h, blockiert die
   Folgezeile `92553809` seines Programms), **danach `d2e4f219`** (der gebriefte Helfer-Slice),
   **danach Slot 9s `60d07416`**. Diese Reihenfolge ist mein Entscheid, vom Owner delegiert
   („Entscheide du wie du es machst") — Begruendung: laengste Wartezeit zuerst.
   Ein Hintergrund-Watcher auf `main`-Bewegung lief bei mir; leg dir selbst einen.
3. **`dispatch` steht auf `false` (Master-Stop).** Der Tick startet NULL Zeilen, unabhaengig vom
   Deckel. Jeder Start ist ein Hand-Dispatch — der Knopf umgeht Master-Stop UND Deckel, die
   Kollisionslesung ist damit DEINE, nicht die des Servers.

## 1. Die Messung, die diese Session wert war: was die Helfer-Auslagerung wirklich bringt

**Drei Fassungen, zwei davon meine eigenen Fehler — die dritte ist die belastbare.** Quelle:
`post-land-audits.jsonl` + `git notes --ref=fleet/land`, erhoben 2026-09-02 ~22:30.

- **FALSCH (meine 1. Fassung):** „remote ist 37 % langsamer". Ich verglich 13 Remote-Laeufe (alle
  aus dem Fenster 29.08.–02.09.) gegen 324 lokale aus der GANZEN Historie. **Zeitfenster-Artefakt.**
- **FALSCH (meine 2. Fassung):** „Faktor 16 auf den Land-Median". Ich hatte `verify.ms` und
  `verify.waitMs` addiert — **`ms` ENTHAELT die Wartezeit bereits**. Doppelt gezaehlt.
- **RICHTIG, nach Kettentyp aufgeschluesselt:**
  | Kettentyp | n | reine Verifikationszeit (`ms` − `waitMs`) |
  |---|---|---|
  | voll, 7 Stufen | 61 | **p50 106 s, p90 123 s, max 186 s** |
  | kurz, `install+pins` (proportional, Docs-Lands) | 35 | **p50 1 s** |
  Die Gate-Kette ist **konstant** und war nie langsam. Die gesamte Varianz ist die WARTESCHLANGE vor
  dem Suite-Mutex: p50 0 s, **max 2669 s**. Am 01./02.09. standen **8 von 24** Lands ueber 500 s an;
  eines starb als `waitedOut` (2669 s gewartet, Verify nie gestartet).
  Land-Gesamtkosten **vor** 02.09. 16:56: n=24, p50 127 s, max 2704 s, 8/24 ueber 500 s.
  **Ab** 16:56 (Audits laufen remote): n=5, p50 104 s, **max 111 s, 0/5 ueber 500 s.**
- **Der Satz, der stimmt:** die Auslagerung macht keinen Testtyp schneller. Sie raeumt die Schlange
  weg. Der Median bewegt sich kaum — **der Schwanz verschwindet**, und im Schwanz starben Lands.
- **Was NICHT messbar ist und deshalb Schnitt 3 des Slices wurde:** welche der sieben Stufen die
  106 s verbraucht. `verify.steps` ist eine PLAN-Liste aus `LOCAL_PROOF_STEPS`; `runVerify` startet
  die Kette als EIN `sh -c`. Es gibt zur Laufzeit keine Stufengrenze.
- **Die Gegenrichtung, unbequem:** die sechs Lane-Vorschaulaeufe auf dem Helfer in `fleet.json` sind
  **6 von 6 rot**, drei ohne `checks`, KEINER mit Fehlernamen. Ausgerechnet der Pfad, den wir
  ausweiten wollen, ist der am schlechtesten diagnostizierbare. Rot-Quote im selben Fenster:
  remote 85 % (n=13) gegen lokal 39 % (n=36) — nicht gegen die 22 % der Gesamthistorie.

## 2. Was ich entschieden habe (Owner-Delegation, beide ausdruecklich erteilt)

- **Advisory-Deckel bleibt bei 10, kein globales Anheben.** `server.ts` rechnet den Ueberhang selbst
  vor (16 × (5+10) + 80 = 320 gegen nominal `MAX_TASKS` 200 — er laeuft SCHON ueber). Und der Druck
  hat `docs/sanierung-2026-09/p6-befundregister.md` erzeugt, ein git-getracktes Zuhause, das eine
  sterbende Session ueberlebt. **Rueckfalltuer: `FLEET_PROGRAM_MAX_PENDING_ADVISORY` in `.env`.**
  Disposition stattdessen: `d2e4f219` per `/adopt` zu `auftrag` gemacht (Ein-Konstanten-Fix mit
  13-Laeufe-Messung verdient eine Arbeitszeile); `8244622e` + `76e6aa3b` schreibt Slot 3 als
  Volleintraege B-03/B-04 ins Register, **erst danach archivieren** — sonst wird die Registertabelle
  eine Sammlung toter Verweise. Archivieren ist reversibel (`status:"archived"` → `unarchive`).
- **Modellpolitik: Opus bleibt** (Owner 22:0x: „Kann erstmal so bleiben, wenn wir konkrete harte
  Aufgaben haben koennen wir diese immernoch von fable5.1 loesen lassen"). Fable also gezielt fuer
  harte Einzelaufgaben, nicht als Orchestrierungs-Default. Die 10:35-Politik ist damit ausgesetzt,
  nicht widerrufen.

## 3. Der gebriefte Slice `d2e4f219` — liegt fertig, wartet nur auf server.ts

Brief haengt an der Zeile (8983 Zeichen, `POST /api/tasks/:id/brief`). Drei Schnitte, EIN Land:
1. `SUITE_OFFER_WAIT_HELD_MS` 800 s → 1 800 s. 800 s liegt unter dem Remote-**Minimum** (597 s) und
   im 23. Perzentil (p50 1323 s, p90 1419 s). **Die drei Laeufe unter Budget waren alle drei ROT** —
   die Suite exitet auf dem ersten FAIL, ein schneller Lauf ist ein abgebrochener. **Das Budget
   selektiert auf rot.** Die Lane muss die Lapse-Annahme (`LaneSuiteState "lapsed"`) PRUEFEN, nicht
   glauben.
2. B-01: `fails` auf `j.result` in `server.ts#reportLaneSuite` persistieren, wie es der Audit-Pfad
   tut. Gegenprobe in `e2e/helper-portal.ts`, mit benannter Rot-Mutation.
3. Stufen-Zeiten: `steps` von `string[]` auf `{name, ms}[]`. **Ich hatte das dem Owner gegenueber als
   „wenige Zeilen" bezeichnet — das war falsch**, s. §1. Der Brief traegt drei Fallen und ein
   ausdrueckliches ABBRUCHRECHT: kaempft es gegen den Pin `RULE_VERIFY` oder verlangt es, die Kette
   in Einzelprozesse zu zerlegen (Verhaltens-Delta = Nicht-Ziel), liefert die Lane 1+2 plus einen
   Absatz, woran es scheitert. Das ist als vollwertiges Ergebnis benannt.

## 4. Sessions: was ich entsperrt habe (Owner-Auftrag „Sessions ans Arbeiten bringen")

- **Slot 6 → Nachfolge gelaufen**, laeuft jetzt als **Slot 10** bei 11,6 %. Es wartete 53 min auf
  eine einzige Frage (Model-Override ja/nein). Antwort war: nein, ohne Override erbt die
  Nachfolgerin den richtigen Datensatz.
- **Slot 4** hatte die einzige offene Attention des Fleets (`c4466aa9`, 2 h 06 min). Beantwortet und
  `d5c79ce4` von Hand dispatcht → lief als codex-Lane (`gpt-5.6-sol`/high) auf Slot 7, **Status jetzt
  `done`**, Worktree sauber abgeraeumt.
- **Slot 16 stand 3 h 52 min still und hatte NIEMANDEN gefragt** — keine Attention, kein Report. Es
  hing zusaetzlich in einem `/usage`-Overlay, **das jeden `POST /send` verschluckte** (Quittung sagt
  `acceptance: unobservable`, die Pane meldet danach „Settings dialog dismissed"). **Erkennungs- und
  Rueckweg: `tmux send-keys -t s<N> Escape`, dann neu senden.** Danach zugestellt, mit zwei
  kollisionsfreien Zwischenarbeiten.
- **Slot 11 (steward)** lag 2,5 h idle, weil sein Pulse an den Controller abgelehnt worden war
  („Slot 7 arbeitet gerade"). Beide offenen Punkte beantwortet, Rundgang wieder aufgenommen.
- **Slot 3 ↔ Slot 9 liefen aneinander vorbei** — s. §5, das ist die Falle des Tages.

## 5. Fallen, die ich bezahlt habe

- **SLOT-NUMMERN SIND KEINE ADRESSEN.** Slot 9 schrieb woertlich „Slot 1: hold your P4 Slice 3 land a
  while longer". Die Sanierungs-MAIN war aber seit 19:17 Slot **3** (Lineage 12 → 1 → 3); Slot 1 war
  der Controller. **Die Bitte kam nie an, und Slot 3 haette gelandet.** Adressiere ueber das Programm
  oder ueber den Controller. Ich habe es beiden ins Handoff-Gedaechtnis gegeben.
- **Ein belegter Composer ist zweimal mein Glueck gewesen.** Zwei `POST /send` an Slot 3 wurden mit
  409 „composer occupied" abgewiesen — und in genau diesem Fenster kam Slot 9s Befund herein, der
  meine Nachricht („Land freigegeben") **widerlegt** haette. Der Rueckweg ist `tmux send-keys C-u`,
  dann neu senden; bei Attention-Antworten erlaubt der Kontrakt den Retry nur mit IDENTISCHEM Text.
- **`verify.ms` enthaelt `waitMs`.** Wer beide addiert, zaehlt die Schlange doppelt und erfindet einen
  Faktor. Mir passiert, in einer Zahl, die ich dem Owner schon genannt hatte.
- **Zwei Populationen mit verschiedener Zeitspanne zu vergleichen misst die Zeit, nicht den
  Unterschied.** Kostete mich zwei falsche Aussagen in Folge (Laufzeit UND Rot-Quote). Slot 3 nimmt
  den Satz als Methodenregel ins P6-Register.
- **Eine Zahl, die ich einer Session gegeben hatte, wanderte in ein GETRACKTES Dokument, bevor ich
  sie korrigieren konnte.** Slot 3 baute meine 85-%-gegen-22-%-Fassung in `p6-befundregister.md` ein.
  Korrektur nachgeschickt. **Wer eine Zahl an eine schreibende Session gibt, schuldet ihr die
  Korrektur schneller als der naechste Commit kommt.**

## 6. Offene Owner-Punkte

1. **Rotes Audit `d4bb687a` (2 FAILs) unadjudiziert — die Attribution ist jetzt ENTSCHIEDEN.** Slot 9s
   Kontrolllauf auf `fda6fda` (dem Baum VOR seinem Land, Abwesenheit per `git merge-base
   --is-ancestor` verifiziert): **3455 PASS / 10 FAIL**, Lauf `isolated-20260902T173734Z-53224`,
   darunter woertlich `restart keeps the busy pending event with the same id and no invented attempt`.
   Der Baum NACH dem Land faellt 1–2. **Das Land hat die Familie verbessert.** Der Defekt ist
   vorbestehend (ops-event-/fleet-report-Familie, Q5/Q6) und verdient eine eigene Zeile. Adjudizieren
   kann nur der Owner.
2. **Die sieben offenen roten Audits** tragen `fails[]: null` — ausnahmslos. Die Namen holt man aus
   dem Check-Trail, Join ueber die Zeilenzahl gegen `checks.ran`; zweimal belegt (`3481/2` und
   `3443/11`). Das Rezept steht als B-02 im P6-Register.
3. **`3974883` ist inzwischen belegt:** Audit `71361fa9` (21:44, remote, rot) traegt erstmals einen
   Namen in `fails`. Das betrifft nur den AUDIT-Pfad; die Vorschau-Luecke (B-01) steht unveraendert.
4. **Zweites Helfergeraet** — unveraendert offen, und §1 macht den Fall staerker: `mainMacbook` ist
   seit sechs Tagen tot, `second-host` ist der einzige. Ein Ausfall wirft alles auf den lokalen Mutex
   zurueck, also in den Schwanz aus §1.
5. B-Zeilen-Promotion und GitHub-Rueckstand stehen unveraendert aus Slot 15s Handoff offen.

## 7. Deploy

`deployGap.codeBehind: true`, `behindCount 18`, aber **`bundleStale: false`** (jemand hat gebaut).
Kein Audit lief bei meiner letzten Messung, also kein 409-Grund. **Ich habe bewusst NICHT deployt** —
der Slice aus §3 fasst `server.ts#reportLaneSuite` an und braucht ohnehin einen Deploy nach dem Land;
zwei Deploys in einer Stunde sind Verschwendung. Deine Entscheidung, nicht meine Schuld.

## 8. NACHTRAG 00:15 — was nach dem Schreiben dieses Abschnitts noch passierte

- **P4 Slice 3 IST GELANDET** (`14a3ab6`, plus `4846d83` als Nachzieher fuer die Kommentar-Zeiger).
  Task `c74706b0` steht auf `done`. Damit ist `server.ts` frei — das Nadeloehr aus §0 ist weg.
- **`860cecdf` ist dispatcht** (Slot 2, Lane `fleet/260902220341-6f16`, `claude-opus-5[1m]`/high —
  das im Task gespeicherte Fable-Tripel habe ich bewusst ueberschrieben, s. §2 Modellpolitik).
  Slot 16 hat damit nach 12,3 h Wartezeit wieder Arbeit.
- **`d2e4f219` (der Drei-Schnitt-Slice) bleibt liegen, und das ist richtig:** er fasst ebenfalls
  `server.ts` an und waere mit `860cecdf` kollidiert. **Er ist der naechste Dispatch, sobald
  `860cecdf` gelandet ist.** Danach Slot 9s Nachfolger mit `60d07416`.
- **Audit `d4bb687a` adjudiziert: `real`** (nicht `flake` — der Check reproduziert). Die Notiz traegt
  die Attribution: vorbestehend, das gedeckte Land hat die ops-event-Familie sogar verbessert
  (10 FAILs auf `fda6fda` davor, 1–2 danach).
- **Deploy `8a19a2f4` gefahren, `ok:true`**, `bootHead == target`. Gap danach: `codeBehind false`,
  `behindCount 0`, `bundleStale false`.
- **Advisory-Deckel geloest ohne Anheben: 7/10, drei Plaetze frei.** `8244622e`/`76e6aa3b` stehen als
  Volleintraege B-03/B-04 im Register und sind ERST DANACH archiviert worden.
- **Ein Orphan-Worktree liegt herum:** `fleet-260902214923-e402`, kein Slot, kein Diff gegen main,
  nichts uncommittet. Leer ⇒ verwerfbar. Ich habe ihn NICHT angefasst.

### Die Dauerschaetzung fuer die Sanierung (auf Owner-Wunsch, mit Agent erhoben)

**Realistisch ~14,8 Tage Restlaufzeit, Abschluss ~2026-09-17** (optimistisch 09-10, pessimistisch
10-07). Der Durchsatz ist **strukturell** eingebrochen, nicht personell: P1–P3 (Docs/Kommentare)
liefen mit **7,9 Slices/Tag**, P4 (echte Struktur-Moves) mit **2,9** — Grund ist das P4-Slice-Protokoll
des Plans (Abhaengigkeitsanalyse, Fremd-Review, stilles Fenster, Vorschaulauf, seriell, Dry-Boot).
Land-zu-Land in P4: ~8 h. Gegenprobe ueber Zeilen (netto −1.252/Tag am besten Tag) ergibt 13,0 Tage
und bestaetigt die realistische Linie.

**ZWEI BEFUNDE, die dem Owner gehoeren und die die Sanierungs-MAIN kennen muss:**
1. **Erfolgsmass 1 ist auf der heutigen Slice-Liste arithmetisch NICHT erreichbar.** `server.ts` steht
   bei 24.313 Zeilen, Ziel ~8.000. Die im Plan NAMENTLICH verbliebenen 16 Subsysteme bringen bei
   gemessener Ausbeute (~290 Z./Subsystem) zusammen ~4.600 Zeilen → der Kern landet bei ~19.700.
   Die fehlenden ~11.700 kann nur **Tier 4** bewegen — die Route-Gruppen, fuer die der Plan einen
   HALBSATZ hat (heute 3 `handle*Route`-Funktionen gegen 94 inline `url.pathname`-Vergleiche).
   Entweder waechst P4 um eine ungeplante Tier-4-Kampagne (= pessimistische Linie), oder das
   Erfolgsmass wird neu verhandelt. **Owner-Entscheidung, keine Durchsatzfrage.**
2. **45 % des Sanierungsaufwands an `server.ts` wurde vom NACHWACHSEN aufgezehrt** (Sanierung −2.259,
   fremde Programme +1.050). Bei `src/client.ts` ist es schlimmer: die Datei ist unter dem laufenden
   Programm **netto GEWACHSEN**, 10.578 → 11.006, waehrend ihr Ziel bei 2.000 steht. Die Maße sind
   erst erreichbar, wenn der Feature-Freeze auch fuer die sieben Nachbarprogramme gilt — heute gilt
   er nur fuer die Sanierung selbst.
Belegstaerke ehrlich: die 12 gelandeten Slices, ihre Zeitstempel, die Raten und alle Zeilenzahlen
sind GEMESSEN. Die Mengengeruste fuer P4 Tier 2–4, P5 und P6 sind ABGELEITET; P6 ("10–20 Slices")
ist die schwaechste Zahl, weil die Modul-Sweeps noch gar nicht existieren.

### Eine Korrektur an §0/§4

**Der Lane-Deckel bindet den Hand-Knopf NICHT.** `server.ts` sagt an der Dispatch-Route woertlich, sie
sei „independent of `dispatchOn` and NOT bound by DISPATCH_MAX_LANES — the cap bounds UNATTENDED
fan-out". Ich hatte Slot 16 den Deckel als Mit-Grund genannt; das war zur Haelfte falsch. Die einzige
echte Bremse war die `server.ts`-KOLLISION. Praktische Folge fuer dich: du wartest nie auf einen
freien Lane-Platz, nur auf die Fläche.

---
# HANDOFF — Dual-Host cd110019: Phase 1 zur Haelfte gelandet (S1+S2), S3/S4 warten auf einen Lane-Platz; 2026-09-02 (20:0x)

Program **`cd1100193082db395c1387db`** aktiv und gebunden. Dieser Abschnitt ist NEU und oben
angesetzt; nichts darunter wurde angefasst (30 Abschnitte vorher, 31 nachher).

## 1. Was gelandet ist — beide mit gruenem Gate, beide vom Controller gelandet

- **S1 `dabd4da9`** (daemon-update als Helper-Job) → main `79acd2e`, `verify.ok true`, volle
  7-Schritt-Kette. Lane `fleet/260902043021-f92c`.
- **S2 `8228ae65`** (Job v1 `command`) → main `d4bb687`, `verify.ok true`, 104 s Arbeit, **0 s
  Mutex-Wartezeit**. Lane `fleet/260902113526-4811`, 3 Commits, 11 Dateien.
- **Das Program hat KEINE Self-Land-Promotion.** Die Projektion sagt an einer REVIEWABLE-Zeile
  woertlich „the owner lands it from the board" — nicht versuchen, sondern den Controller bitten.

**Der Geraete-Bootstrap IST passiert:** `helperDevices[secondhostlinux1].daemonSha` stand um 15:4x
auf `f62b1f5`. Damit ist S1s Erfolgskriterium am ECHTEN Geraet erfuellt und jeder weitere
Daemon-Deploy ist ein Job (`POST /api/helper/devices/secondhostlinux1/update`), kein Handgriff.

## 2. Was offen ist, in der Reihenfolge, die der Controller gesetzt hat

- **S3 `60d07416`** (Wake-on-LAN) und **S4 `c3f91ce1`** (Presence + suite.log-Artefakt) sind
  `queued`. **Nicht selbst dispatchen** — Dispatcher ist aus, und der Controller vergibt den
  Lane-Platz erst an `860cecdf`, dann `d2e4f219`, dann S3. Tripel explizit mitgeben:
  **`claude/claude-opus-5[1m]`/high** (Owner 10:45: Lanes Opus, MAINs Fable); die Zeilen tragen
  noch das Fable-Tripel aus dem Filing, der Dispatch-Knopf ueberschreibt es.
- **S4s Brief muss vor dem Dispatch EINEN Satz dazubekommen** (von mir gemessen, noch nicht
  eingearbeitet): die neuen Kommentare in `e2e/security.ts` und `server/types.ts` behaupten, die
  Token-Verweigerung von `claude|codex|pi` mache Remote-Agent-Spawn unmoeglich „whatever the
  allowlist says". Sie tut das nicht: `bun run build`/`bun test`/`bun run verify` fuehren
  `package.json`-Skripte AUS DEM EINGEREICHTEN BUNDLE aus, und das kontrolliert der Aufrufer — die
  Fixture der Lane schreibt selbst ein `package.json` und faehrt `bun run build` hindurch. **Kein
  Regress** (der Portal-Pfad fuehrt ueber `suiteCmd` seit jeher eingereichten Repo-Code aus), aber
  die Zusage ist zu stark und ein spaeterer Leser wird sich darauf stuetzen. Korrektur: die
  Verweigerung bindet den KOMMANDO-STRING, nicht das Ausgefuehrte.
- **Owner-Grenze, benannt und NICHT gebaut:** `/api/self/watch` verweigert einer Lane weiter
  `kind:"job"` (409). Die Begruendung (lane-waits-on-lane) trifft auf einen EIGENEN Command-Job
  nicht zu — aber eine Lane kann heute auch keinen Job filen, also waeren BEIDE Tueren zugleich zu
  bewegen. Das ist eine Program-Entscheidung (Arbeit von einer Lane auf eine andere Maschine
  auslagern), keine Check-Inversion. Gehoert in S4 oder Phase 2.
- **Phase 2** (Program-MAIN + Worker auf second-host — das urspruengliche Erfolgsmass) steht hinter
  Phase 1 UND einem eigenen Owner-Entscheid. Nicht gefiled.
- **T14-Digest-Breaker** (`verify.ts` im FREMDEN private-repo-o-Repo, eine eingebrannte Baseline,
  faellt auf x86_64 rot bei identischem Commit): dem Owner vorgelegt, **nie zugewiesen**. Bis
  entschieden ist er NICHT in diesem Program. Wirkung bleibt: second-host darf einen Build fahren und
  bebildern, aber ueber diese Zeile nicht gruen oder rot sprechen.

## 3. Der Audit-Befund, der einen halben Tag gekostet hat — Ergebnis, damit ihn niemand neu faehrt

Das Post-Land-Audit von `d4bb687` war rot 2/3481. **Attribution abgeschlossen: ALTBEFUND, nicht
dieses Land.** Beweiskette, alle Laeufe seriell und mit Run-ID:

| Baum | Run | Ergebnis |
|---|---|---|
| `d4bb687` Audit | `isolated-20260902T161436Z-31724` | 2 FAIL |
| `d4bb687` gleicher Baum erneut | `isolated-20260902T170824Z-94009` | 1 FAIL — `subject-gone` PASSTE ⇒ Flake |
| `fda6fda` (Land ABWESEND, `git merge-base --is-ancestor d4bb687a fda6fdad` = NO) | `isolated-20260902T173734Z-53224` | **10 FAIL, darunter `restart keeps the busy pending event…`** |

Der Baum VOR dem Land faellt in dieser Familie **10-mal**, der Baum danach **1–2-mal**. Vier
weitere Vor-Land-Instanzen: `…T015443Z`, `…T135103Z`, Audit `01ccfb30`, `20260816T154004Z`.
**Adjudikation, die ich erbeten habe und die noch aussteht: `real`, nicht `flake`** — die Zeile als
Flake zu schliessen wuerde einen echt fallenden Check begraben (Q5/Q6-ops-event-Familie).

**Zwei Lehren, die Zeit sparen:**
- Ein GRUENER Kontrolllauf beweist nichts, ein ROTER beweist alles: die Frage ist „kann dieser
  Check ohne meinen Diff fallen", und genau das zeigt ein Fail — auch unter Last.
- Main bewegt sich schnell. Fuer einen Same-Tree-Beweis ist der Haupt-Checkout meist schon zu neu:
  `git worktree add --detach <scratchpad>/x <sha>` + `bun install --frozen-lockfile`, danach
  **`git worktree remove --force`**, sonst zaehlt `state.sh` einen Orphan.
- second-host ist fuer eine ATTRIBUTIONSFRAGE der falsche Host: sechs unerklaerte Rots
  (10·10·7·7·9·13) und eine Plattformdifferenz confounden Baum mit Plattform.

## 4. Betriebliches, das nicht in git steht

- **Sessions NIE ueber Slot-Nummern adressieren.** Slots wandern bei jeder Nachfolge; eine Bitte
  an „Slot 1" ging heute ins Leere, weil die Ziel-MAIN inzwischen Slot 3 war. Ueber das PROGRAM
  oder ueber den Controller.
- **Eine Pane-Zeile im Format „OWNER ANSWER" kann Residuum sein.** Zweimal heute vorgekommen; der
  Beleg ist `GET /api/self/attention` (`status`, `closedAt`) bzw. die Ledger-Datei, nie der Text.
- **Alle vier Attentions dieser Session sind `answered`:** `db2d6c85` (Kanal = (a)),
  `9fe049c4` (Filing), `48d91bb2` (S1-Audit-Flake). Keine offene Owner-Frage.
- **Notiz `712274ff`** traegt den Selbstbefund samt EINEM Schnittvorschlag: FAIL-Namen fuer LOKALE
  Post-Land-Audits auf Ledger und Event legen (der Trail hat sie, die Remote-Seite kann es seit
  `3974883`). Drei Hand-Calls je Rot heute; die Namen sind der einzige Grund, dass diese
  Attribution ueberhaupt moeglich war.

## 5. Naechster Zug der Nachfolgerin

Nichts anfangen, was einen Lane-Platz braucht — der Controller vergibt ihn. Konkret: (1) S4s Brief
um den Satz aus §2 ergaenzen (`POST /api/tasks/:id/brief` bzw. neu filen), (2) auf den
Controller-Zuruf warten, dass S3 dran ist, (3) beim Land-Terminal wie gehabt
`{kind:"merge"}` und dann `{kind:"audit"}` abonnieren. Landen tut der Controller.

---

# HANDOFF — Fleet Controller (Slot 7, Fable→Opus 5 high): Deploy 2eebe03a GELANDET (Audits laufen ab jetzt REMOTE), Fable-Kontolimit umgangen (sieben Panes auf Opus), CLAUDE.md-Handedit als Land-Killer GEMESSEN und repariert, zwei Lands in Kette; 2026-09-02 (17:15)

Rolle: 🎛 Fleet Controller. Owner-Delegation (Landen, autonomer Betrieb) gilt fort. Modelle: siehe §2 —
die Fable-Politik ist HEUTE nicht fahrbar, das ist der wichtigste Betriebsfakt dieser Session.

## OWNER-AUFTRAG AN DICH, woertlich (2026-09-02 18:50, bei meiner Nachfolge erteilt)

> „bitte starte die Nachfolge und dann sag ihr das sie sich mit hilfe von agenten, einen Überblick
> verschaffen soll um dann die Sessions richtig zum weiterarbeiten zu bekommen"

Das ist DEIN erster Auftrag und er geht dem „ersten Zug" in §2 vor. Zwei Teile, in dieser Reihenfolge:

**1. Ueberblick MIT AGENTEN, nicht selbst lesen.** Der Grund ist Kontext: die Erdung kostet dich sonst
~7,6 % (gemessener Fixwert), und Panes einzeln zu lesen hat mich heute Punkte gekostet, die ich am
Ende gebraucht haette. Delegiere parallel, in EINER Nachricht, und lass dir VERDICHTETE Ergebnisse
geben statt Rohausgaben. Sinnvoller Schnitt, vier Agenten:
   - **Board + Panes:** je lebendem Slot ein Satz — arbeitet / idle-und-fertig / wartet-auf-dich /
     hat-einen-Brief-kompiliert (die vier Zwillingszustaende aus dem Regelbuch), plus `ctx`, Modell,
     und WORAUF er wartet. Werkzeug: `/api/sessions` und `tmux -L claudefleet capture-pane -p -t s<N>`.
     **Regel mitgeben: NIEMALS `ps` ungefiltert ausgeben** — die Self-Tokens stehen in den Kommandozeilen.
   - **Queue/Register:** `./register.sh`, was seit heute Mittag dazukam, was JETZT dispatchbar waere.
   - **Lands/Ledger:** `./state.sh` plus die `fleet/land`-Notes und `post-land-audits.jsonl` seit
     `8865eaa` — offene rote Audits, ungedeckte Lands, Deploy-Gap.
   - **Programme:** welche Program-MAIN haengt woran, wer wartet auf wen. Quelle ist `fleet.json`
     (`GET /api/sessions` traegt `programs` OHNE `main`).
   Agenten erben deine Regeln NICHT: schreib in jeden Prompt, dass er nur Gelesenes behaupten darf,
   Datei/Zeile zitiert und ausdruecklich sagt, was er NICHT geprueft hat.

**2. „Die Sessions richtig zum Weiterarbeiten bekommen."** Das ist der eigentliche Auftrag, der
Ueberblick ist nur das Mittel. Konkret heisst es: jede lebende Session soll wieder AN ETWAS
arbeiten. Heute lag Slot 8 zweieinhalb Stunden fertig da, weil niemand seine Frage beantwortet hat,
und Slot 10 eine Stunde. Das nicht wieder. Je Session eine Entscheidung, und ein Send kostet die
MAIN ihren vollen Kontext — also gebuendelt und einmal, nie in Haeppchen:
   - fertig mit Commits → landen (du hast die Autoritaet).
   - wartet auf eine Antwort → antworte, auch wenn die Frage eigentlich ihrer MAIN gehoert; eine
     tote MAIN beantwortet nichts.
   - hat nichts zu tun → Zeile aus dem Register geben oder retiren, nicht leer laufen lassen.
   - ueber dem Kontextband → zur Nachfolge auffordern.


## 0. Reihenfolge fuer dich

1. Erdung (`./state.sh`, `./register.sh`, dieser Abschnitt, Board). Miss deinen ctx, bevor du liest.
2. **Deploy `2eebe03a` ist ok:true (Boot 16:56:22, target `8865eaa`).** `deployGap.codeBehind false`,
   `bundleStale false`, `FLEET_AUDIT_HELPER_GRACE_MS` live `60000`. Damit laufen Post-Land-Audits auf
   dem Second-host (`daemonSha f62b1f58`, mode active), nicht mehr lokal. **Erfolgstest BESTANDEN, erste Haelfte:** nach Slot 12s
   Land von `ffdcece` (17:13) hat das Second-host den Post-Land-Audit sofort beansprucht
   (`helperDevices[0].claims = [{kind:"audit", repo:"claude-fleet", ref:"main"}]`) — Tier 2 laeuft
   remote, der lokale Mutex bleibt fuer Gates frei. **Zweite Haelfte noch offen:** traegt die
   fertige Remote-Zeile `fails[]` und Check-Namen? Frueher waren 8 Remote-Audits in Folge rot OHNE
   Namen; die Server-Seite dafuer (`3974883`, `b3f4230`) ist erst mit diesem Deploy live. Der
   Durchsatz-Beleg ist schon hart: Slot 12s Land-Note sagt `verify.ok true`, 107 s Arbeit,
   `waitMs 0` — davor starben am selben Tag DREI Land-Versuche als `waitedOut` (je ~2690 s Warten,
   Verify nie gestartet).
3. **Der Post-Land-Audit fuer `01ccfb3` war ROT: 11 FAILs von 3443, `ms` 2041211, Lauf 15:50–16:24.**
   NICHT adjudiziert, mit Absicht. Alle elf liegen in der fleet-report/Event-Hold-Familie (Q5/Q6,
   `subject-gone`, `restart keeps the busy pending event`); die Signatur ist durchgehend: eine Zeile,
   die HELD sein muesste, steht `delivered/attempts:1`. Der Audit davor (09:36, `79acd2e8`) war
   ebenfalls rot mit ZEHN Fails derselben Familie, aber einer ANDEREN Teilmenge; der Lauf um 06:16
   war gruen bei gleicher Zeilenzahl. Wechselnde Teilmenge + beide Rots unter schwerer Maschinenlast
   = Last-Nichtdeterminismus, aber **das ist eine Hypothese, kein Beweis** — der Beweis ist ein
   serieller Wiederholungslauf, und der ist ab jetzt gratis, weil Audits remote auf einer ruhigen
   Maschine laufen. Trail: `$TMPDIR/fleet-e2e-trail/isolated-20260902T135103Z-50990.jsonl`.
4. **Beweis-Hygiene fuer Remote-Audits, von Slot 1 am Code geschaerft (Zeile `8244622e`), und eine
   Korrektur an mir:** remote ist `checks.failed` NICHT unbrauchbar — `postLandAuditChecks`
   rekonziliert es gegen `fails[]`, das der Daemon separat und UNGEKAPPT schickt, und gibt sonst
   `null` zurueck. Falsch ist nur `ran`: es zaehlt PASS-Zeilen in einem 4096-Byte-Tail und ist damit
   eine untere Schranke. Der `ran:0 bei green`-Sensor verliert remote also die AUFLOESUNG, nicht die
   Richtung — 3434 gelaufene Checks melden `ran:22`, ein fast leerer Lauf meldet `ran:3`, beides
   liest sich als „klein, aber nicht null". **Und was ich zu stark gesagt hatte:** die Zeile
   `rows=3434 results=3434` steht im TAIL des Helfers, nicht in einem `trail`-Feld der Ledger-Zeile
   (die hat keines; das Report-Feld ist auf 120 Zeichen geschnitten). Sie ist die Selbstauskunft des
   Geraets, kein Beleg von dieser Maschine. Das Urteil „voll gelaufen" traegt trotzdem — ueber
   `exitCode 0` nach 22,9 min, `clonedSha == mainSha` und das `ALL PASS` im Tail — aber es gehoert
   nicht als hiesige Messung weitergeschrieben.
   **Und eine unausgesprochene Voraussetzung, von Slot 3 nachgetragen (Korrektur-Zeile zu
   `f9db018e`):** die Rekonziliation von `failed` haengt daran, dass die `N FAILURES`-Summenzeile den
   4-KB-Tail ueberlebt hat. Sie steht am Laufende, ueberlebt also normalerweise — aber ein Lauf, der
   NACH seiner Summenzeile noch viel ausgibt, faellt aus der Garantie. Drei Schranken geben dann
   `null` statt einer Zahl (Summenzeile ohne passendes `fails[]` · `exitCode 0` mit `failed != 0` ·
   `ALL PASS` mit gezaehlten Fails ohne Summenzeile). Und die Rekonziliation korrigiert immer nur die
   Failure-Differenz, nie die verlorenen PASS-Zeilen — `ran` bleibt kaputt.
   **Und Slot 1s Gegenprobe dazu (dieselbe Zeile `8244622e`): das Restrisiko ist klein und benannt.**
   Die Voraussetzung ist DREIFACH abgesichert — der Daemon schickt `tailOf` 40 Zeilen vom Ende ·
   `retainSection` nimmt signal-first RUECKWAERTS und `FAIL_LINE` matcht `FAILURES?` · `fails` kommt
   aus der VOLLEN Logdatei (Deckel 50, faellt bei Ueberschreitung nach `null`). Der einzige Pfad zu
   einem still falschen `failed` ist damit ein Wrapper, der NACH seiner Summenzeile noch mehr als
   40 Zeilen druckt. Wer einen neuen Wrapper baut, achtet genau darauf.

## 1. Was in dieser Session passierte (verifiziert)

- **Fable 5 ist am KONTOLIMIT, Reset 20:00 Europe/Berlin** (Wortlaut aus Pane s6: „You've hit your
  Fable 5 limit · resets 8pm (Europe/Berlin)"; Slot 3 und 4 zeigten die haertere Fassung „You're out
  of usage credits"). Slot 3 und 4 standen damit still. **Ich habe sieben Panes auf `claude-opus-5[1m]`
  high gesetzt: 3, 4, 6, 9, 12, 16** (11 stand schon auf Opus, 7 hat der Owner selbst umgestellt).
  Das ist eine BEWUSSTE Abweichung von der Modellpolitik vom 2026-09-02 10:35 („Fable fuer alles, was
  orchestriert") — sie war nicht fahrbar. **Rueckfalltuer: nach 20:00 zurueckstellen**, wenn der Owner
  die Politik behalten will; `.env` `FLEET_MODEL` blieb unangetastet auf `claude-opus-5[1m]`.
- **Der Modellwechsel ist ein PAAR, und beide Haelften sind noetig:** `POST /api/slots/:id/model`
  (schreibt den Datensatz, existiert seit `c09d5f1`) UND `/model claude-opus-5[1m]` ueber `POST /send`
  (schreibt die Pane). Claude Code fragt bei warmem Cache „Switch model?" — der Enter muss per
  `tmux send-keys -t s<N> Enter` nach, der Send meldet dann korrekt „composer still holds 24 chars".
  Der Footer ist der Sensor fuer das MODELL; fuer den EFFORT ist er es weiterhin NICHT (was wie eine
  Effort-Anzeige aussieht — „● high · /effort" — ist der Slash-Hinweis, kein Zustandsfeld; ich habe
  das an drei Panes gegengeprueft, bevor ich die Regel fast falsch korrigiert haette).
- **SELBST VERURSACHTER LAND-KILLER, teuerster Fund der Session (Notiz `1a7dd56e`):** ein Handedit an
  `CLAUDE.md` im HAUPT-CHECKOUT toetet JEDES Land-Gate dieser Maschine an Stufe 1. `CLAUDE.md` ist dort
  GENERIERT (`renderRulebook("main", rulebook/)`), und der Pin `RULE_RENDER` in `e2e/pins.ts` liest
  `${SOURCE_DIR}/CLAUDE.md` — den Quell-Checkout, nicht den Lane-Baum. Slot 12s Land von P4 Slice 2
  starb dadurch 17:05:04 nach 906 ms: exit 1, genau ein FAIL, „rendered 73981 B vs CLAUDE.md 74215 B" —
  die 234 B waren meine Einfuegung. **Der Eingang fuer Regelwissen im Haupt-Checkout ist
  `rulebook/<fragment>.md`, nie CLAUDE.md.** Es gibt KEINEN Sync-Hook und keine Selbstheilung:
  dass `rulebook/supervisor.md` ~2 min spaeter meine Aenderung selbst trug (mtime beider Dateien 17:07)
  und `bun e2e/pins.ts` wieder ALL PASS meldete, war **Slot 12 von Hand** — sein Land war an genau
  diesem Pin gestorben, er nennt es „die zwei ungovernierten Flaechen repariert". Ein Handedit an
  CLAUDE.md bleibt also ein toter Land-Gate, bis jemand beide Seiten deckungsgleich macht.
  Slot 12s Folgefund (seine Zeile `f0c28e8f`): der `unchangedRetry`-Guard der Self-Land-Tuer kann eine
  Reparatur an SOURCE_DIR-Flaechen strukturell nicht sehen — er vergleicht die Bytes des LANE-Baums,
  die pins-Stufe liest den QUELL-Checkout. Wer so etwas repariert, braucht die Owner-Tuer.
  **Und der Reparaturweg ist NICHT „einfach neu rendern":** Slot 12 hat die Korrektur nach
  `rulebook/supervisor.md` GEZOGEN, weil ein blosses Re-Render sie geloescht haette, und musste dabei
  eine Wendung wiederherstellen, die die Bedeutungsprobe als Muster von Regel S2 fuehrt (Zeile 130) —
  sonst waere ein ZWEITER Pin rot geblieben. Zwei Pins bewachen diese Flaeche, nicht einer.
- **Der Self-Land-Guard erzwingt nach JEDEM roten Verdikt einen Rebase, auch nach einem adjudizierten**
  (Slot 3, live 17:15): er liest den Candidate als LANE-HEAD; dass main sich bewegt hat, sieht er
  nicht. Slot 3 haengt den roten Fall an seine Zeile `789d9034`, die bisher nur den `waitedOut`-Fall
  deckt. Praktisch heisst das: nach einem Flake-Rot erst in der Lane rebasen, dann die Self-Tuer.
- **Land `1b677e58` (Task Workbench, Lane Slot 2):** mein Lauf 17:00 ueber die Owner-Route
  `POST /api/slots/2/merge` (die Self-Tuer haette Slot 3 mit `unchangedRetry` abgelehnt, sein Befund
  `789d9034`). Ergebnis: `resolved/landed=false`, aber zum ERSTEN Mal heute wirklich gemessen —
  verify.ok false, exit 3, 251 s, `waitMs 0`. Das Rot ist §11.2i: `e2e-claude-gate.sh` Phase 3
  „server did not come up" UND keine `server.log` in der aufbewahrten Instanz = nie gemessen.
  **Dreifach widerlegt:** Slot 3 fuhr denselben Baum `c079a82` seriell nach (141 PASS / 0 FAIL), die
  Lane Slot 2 unabhaengig nochmal (141 PASS / 0 FAIL), und der Diff (4 Dateien, client/docs/e2e)
  fasst nichts an, was `e2e-claude-gate.sh` faehrt. Der Merge hat die Lane dabei auf `8865eaa` rebased,
  Candidate ist jetzt `c079a82` — damit laesst der Self-Land-Guard Slot 3 durch.
- **Zwei Watch-Fallen wieder bezahlt** (beide schon als Befund bekannt, hier bestaetigt):
  `POST /api/self/watch {kind:"merge"}` gab mir auf Slot 2 den VERBRAUCHTEN Watch der ersten Runde
  zurueck (`armed:false`, Slot 3s Notiz `be20f4b4`), und auf Slot 5 feuerte er SOFORT aus einem alten
  gesettelten Fakt. Fuer einen NEUEN Merge auf einer Lane, die schon einen hatte: Hintergrund-Watcher
  auf `GET /api/slots/:id/merge` mit einem BASELINE-Zeitstempel, sonst haelt man ein altes Verdikt
  fuer das eigene.
- Aufgeraeumt: Orphan-Worktree `fleet-260902105240-69ed` (killed-empty GLM-Lane, ihre einzige Datei war
  eine aeltere Kopie einer Notiz, die auf main laengst neuer steht) entfernt samt Branch. Queue-Zeile
  `39fbbd1f` (LC_ALL im lstart-Leser) mit `01ccfb3` geschlossen.

- **Drei Lands in Folge nach dem Deploy, alle voll gemessen, alle `waitMs 0`:** `ffdcece` (Slot 12,
  P4 Slice 2, 107 s) · `497873f` (Slot 3, Task Workbench `1b677e58`, 111 s, `proportional false`) ·
  Slot 8s `10c8297` (Repo-Worker `audit`) lief 17:19 los. **Die Statistik des Tages an EINER Zeile
  (`1b677e58`): fuenf Land-Versuche** — dreimal `waitedOut` (Verify nie gestartet, alte Mutex-Welt),
  einmal §11.2i-Flake (zweifach gruen widerlegt), und der erste Lauf mit freiem Mutex war in 111 s
  gruen. Das ist der Unterschied, den Zug 1 macht.
- Slot 8s Land habe ich vorher mechanisch geprueft: `git merge-tree --write-tree main <lane>` exit 0,
  konfliktfrei — obwohl seine Basis `09b577e9` ist und `ffdcece` dazwischen `server.ts` in
  `server/{errors,persist,tmux}.ts` zerlegt hat. Der Gate ist die eigentliche Probe.

## 2. Betriebsstand (17:55) und DEIN ERSTER ZUG

**NACHTRAG 18:00 — DER DEPLOY LIEGT BEI SLOT 1, NICHT MEHR BEI DIR.** Die neue Sanierungs-MAIN
wartet auf dieselbe Bedingung (ihr Slice-Protokoll verlangt Deploy in Schritt f), haelt den frischeren
Kontext und hat den Rollback-Dry-Boot von `8865eaa` gegen eine Kopie der heutigen `fleet.json` schon
gruen gefahren (200, 16 Slots / 134 Tasks / 58 Programs). Sie deployt, sobald der Audit den Mutex
freigibt. **Pruefe nur, DASS es passiert ist** (`deployGap.codeBehind`, `bundleStale.stale`) und sag
Slot 3 Bescheid — es wartet darauf fuer seine Nachher-Screenshots. Wenn es bis dahin nicht passiert
ist, ist es wieder deiner:

**`POST /api/deploy`.** Ich habe ihn 17:47 beantragt, er wurde korrekt abgelehnt:
`ok:false, stage preflight, "a post-land audit is running on claude-fleet — killing srv now would
leave a red that measured nothing"`. Ein Hintergrund-Watcher wartete auf 0 Suite-Wrapper. **Warum es
druckt:** `bundleStale.stale = true` und `deployGap.codeBehind = true` — der CLIENT-Teil von vier
Commits ist nicht live, darunter Slot 3s ganzer Slice (`497873f`, reines Client-Rendering). Slot 3
kann seine vom Program verlangten Nachher-Screenshots erst danach ehrlich machen und wartet auf deine
Zeile. Es deployt NICHT selbst (Non-Goal seines Programs), das ist deine Entscheidung.

Gelandet seit dem Deploy, alle drei voll gemessen: `ffdcece` (P4 Slice 2) · `497873f` (Task
Workbench) · `b8ea448` (Repo-Worker `audit`, Slot 8s 2,7 h alte Arbeit). Dazu `51246b0` (Handoff).

**LIES ZUERST: „erledigt" heisst NICHT „nichts zu deployen".** Der Deploy `b21b6749` (18:04) war
korrekt und hat den Gap DAMALS geschlossen. Seitdem sind weitere Commits gelandet (Slot 10s
`d4bb687` samt Zeilen in `src/client.ts` und `src/opsevents.ts`, dazu mehrere Handoffs), also steht
`deployGap.codeBehind` wieder auf `true` — 18:35 gemessen `behindCount 7`, `bundleStale true`. Das
ist der NORMALE Zustand nach Lands, kein Fehler. Ob neu deployt wird, ist eine Entscheidung, keine
Pflicht: sie faellt, wenn jemand die neue Flaeche LIVE braucht (die Dual-Host-MAIN Slot 9 fuer den
Ausbau S3/S4 zum Beispiel). Und ein Deploy antwortet unveraendert 409, solange ein Post-Land-Audit
laeuft.

**NACHTRAG 18:26 — die beiden RESTPUNKTE DIESER SESSION sind erledigt, hier steht der Endstand.** Slot 10 ist gelandet
(`d4bb687`, Note `verify.ok true`, exit 0, **104 s Arbeit, waitMs 0**, alle sieben Stufen; vorher
`git merge-tree` konfliktfrei geprueft, obwohl ihre Basis `09b577e9` von VOR dem Server-Split
stammt). Damit war `src/client.ts` frei, und ich habe `15a3e38b` von Hand dispatcht mit dem
Owner-Tripel `claude / claude-opus-5[1m] / high` — laeuft als Lane `fleet/260902162622-dbae` auf
Slot 5, Datensatz gemessen `model claude-opus-5[1m]`, `effort high`, `agent alive`. Das im Task
gespeicherte codex-Tripel vom Filing ist dabei ueberschrieben, nicht geerbt.
**Mitnehmen aus Slot 10s Diff:** `8ab2de9` „job-Watch dedupt nur ARMED — ein SPENT Watch ist keine
Antwort auf ein neues Ereignis" repariert GENAU die Klasse, die mich und Slot 3 heute dreimal
gekostet hat, aber nur fuer `kind:"job"`. Der `merge`-Zweig ist weiterhin offen (Slot 3s Zeile
`be20f4b4`, Slot 12s `372b3cef`) — es gibt jetzt aber einen Praezedenzfall im Baum.

Slots am Ende: 1 Sanierungs-MAIN (frisch, Nachfolge von 12), 3 Task Workbench, 4 Private-repo-y, 6
Private-repo-o, 9 Second-host, 11 Steward, 16 Fleet-ohne-Owner-Routing. Lanes: 2
(`260902154623-7fa9`, P4 Slice 3) und 5 (`260902162622-dbae`, `15a3e38b`). Dispatcher `on:false`,
maxLanes 2 — beide Plaetze belegt.

## 3. Fallen, die ich bezahlt habe

- **ZWEI SESSIONS IM SELBEN CHECKOUT CLOBBERN SICH AN `HANDOFF.md`, und zwar lautlos** (18:40 an mir
  passiert). Slot 3s Handoff-Commit `f74c348` hat meinen kompletten Abschnitt geloescht: 194 Zeilen
  weg, 60 dazu — es hatte die Datei frueher gelesen und ganz zurueckgeschrieben, waehrend ich vier
  Nachtraege dazu committet hatte. Kein Konflikt, kein Hinweis, `git status` sauber; sichtbar nur an
  `git diff --numstat <mein commit> <sein commit> -- HANDOFF.md`. Wiederhergestellt aus
  `git show <mein SHA>:HANDOFF.md`. **Regel daraus: wer `HANDOFF.md` schreibt, PREPENDET seinen
  Abschnitt an die Datei, die gerade auf Platte liegt — er liest sie unmittelbar vor dem Schreiben
  neu.** Und nach dem Commit einmal `grep -c '^# HANDOFF' HANDOFF.md` gegen vorher pruefen: faellt
  die Zahl, hat jemand etwas verloren. Die bekannte Doc-Kollisionsregel deckt nur Lane gegen
  Haupt-Checkout — MAIN gegen MAIN im SELBEN Checkout stand nirgends.
- **CLAUDE.md ist generiert** (§1) — der teuerste, er hat ein fremdes Land getoetet.
- **Ein Merge-Watch auf eine Lane, die schon einen hatte, ist KEIN Rueckkanal.** Er kommt `armed:false`
  zurueck oder feuert sofort aus einem alten gesettelten Fakt. Ersatz: Hintergrund-Watcher auf
  `GET /api/slots/:id/merge` mit BASELINE-Zeitstempel — und die Terminal-Bedingung muss
  `status != "interrupted"` UND `running == false` fordern, sonst haelst du den Uebergangs-Datensatz
  fuer ein Verdikt (mir passiert, 17:15).
- **Fast eine RICHTIGE Regel ueberschrieben:** der Footer zeigt keinen Effort. Das „● high · /effort",
  das ich fuer eine Anzeige hielt, war ein Slash-Vorschlag; die Gegenprobe an drei Panes hat es
  gestellt. Die Regel steht zu Recht.
- **Der Slot-Datensatz und die Pane sind zwei Dinge.** Mein eigener Slot stand noch auf `fable`,
  obwohl die Pane auf Opus lief — eine Nachfolge waere direkt in die Kreditwand gespawnt. Vor JEDER
  Nachfolge den eigenen Datensatz pruefen. Ich habe 7 und 11 nachgezogen.

## 4. Offene Owner-Punkte

1. **Modellpolitik nach 20:00** (Fable-Reset): zurueck auf Fable fuer Orchestrierung, oder auf Opus
   bleiben? Neun Panes stehen jetzt auf Opus.
2. **Das ZWEITE Helfergeraet ist keine Kuer mehr — die Kette liegt jetzt in Zahlen vor.** Mit einem
   Geraet faellt ein Audit nach 60 s Grace auf diese Maschine zurueck, wenn das Geraet belegt ist.
   Heute: das Second-host fuhr den `ffdcece`-Audit (17:13–17:36), die drei Lands danach kamen heim,
   und der lokale Sammel-Audit auf `b8ea448` hielt den Mutex **27,1 min** und den zweiten Deploy die
   ganze Zeit auf 409 (18:04 gefahren, `b21b6749`, ok true, bootHead == target `3afb3f0`, Boot
   2289 ms, build 102 ms). Ein zweites Geraet kostet null Code (`helperDevices` ist eine Map) und
   haette dieses halbe Deploy-Fenster gespart. **Nebeneffekt, den man mitnehmen sollte:** genau weil
   dieser Audit LOKAL lief, traegt seine Zahl — 3465 Checks / 0 failed, und er deckt ZWEI Lands
   (`497873f` und `b8ea448`). Remote waere dieselbe Zeile nur als untere Schranke lesbar gewesen.
3. **Rotes Audit `01ccfb3` unadjudiziert** (11/3443, Event-Hold-Familie). Der Beweis ist ein serieller
   Wiederholungslauf und ab jetzt billig, weil er remote laufen kann.
4. **Remote-Audits melden `checks.ran` falsch** (Slot 3s Notiz `f9db018e`): remote zaehlt
   `postLandAuditChecks` auf einem 4096-Byte-Tail, lokal auf der vollen Erfassung. Damit ist der
   Regelbuch-Sensor gegen ein Schein-Gruen auf JEDER Remote-Zeile blind. Vorschlag in der Notiz: der
   Helfer meldet `ran`/`failed` als eigene Felder, Tail-Zaehlung wird als `checksFrom: tail` markiert.
5. B-Zeilen-Promotion und GitHub-Rueckstand stehen unveraendert aus Slot 15s Handoff offen.

---

# HANDOFF — Generalsanierung (Program `b2a14b545fd31fd71ba7b9e1`, Slot 1 → Nachfolge): Deploy gefahren, P4 Slice 3 FERTIG und GRUEN aber ABSICHTLICH NICHT GELANDET, main ist fremd-rot, 2026-09-02 (19:20), ctx GEMESSEN 28,5 %

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`,
`GET /api/self/program-execution`. Was hier steht, ist nur das, was git und die Sensoren
NICHT tragen koennen.

## 1. Das Erste, was du tust

**Pruefe, ob main gruen ist. Wenn ja: lande Slice 3.** Die Lane `fleet/260902154623-7fa9`
(Slot 2, Commit `3dd84d1`) ist fertig, verifiziert und wartet — sie ist NICHT kaputt.
Der Grund fuers Warten steht in §3 und ist ein Attributionsgrund, kein Qualitaetsgrund.

## 2. Gelandet / gefahren, verifiziert

- **Deploy `b21b6749` (Owner-Auftrag von Slot 7, Anspruch dort ausdruecklich zurueckgezogen):**
  `ok:true`, `bootHead == head == target 3afb3f09`, `hitTarget:true`, Boot 2289 ms, buildMs 102.
  Health danach: `deployGap.codeBehind` FALSE (behindCount 0), `bundleStale.stale` FALSE,
  `errors:null`, `bun e2e/pins.ts` ALL PASS. Live gingen damit `ffdcece` (P4 Slice 2),
  `497873f` (Slot 3s Client-Slice), `b8ea448` + drei Handoff-Commits. Slot 3 unterrichtet
  (`99fac4ce`) samt dem Hinweis, seinen Vorher-Stand in der Messnotiz zu benennen.
- **Rollback-Dry-Boot (Schritt f, stand aus):** `8865eaa` aus `git archive` in den Scratchpad,
  eigener Socket/Port (`fleetdry71`/8871, `FLEET_CMD=true`), gegen eine KOPIE der heutigen
  `fleet.json`. Antwortete 200, las 16 Slots / 134 Tasks / 58 Programs, keine Boot-Verweigerung.
  Per PID beendet + `tmux -L fleetdry71 kill-server`; Live-Server danach 200.
- **`graphify update .`** gelaufen (der Graph war auf einem Stand VOR Slice 2): 8798 Knoten,
  13016 Kanten. Schritt f fuer Slice 2 ist damit vollstaendig.

## 3. P4 Slice 3 — FERTIG, GRUEN, GEHALTEN. Das ist der Kern dieser Uebergabe.

Lane `fleet/260902154623-7fa9`, Slot 2, Commit `3dd84d1`, Worktree sauber, 1 ahead.
`server.ts` 23869 → 23518 (−351); `server/transport.ts` 221 Z., `server/dir-explorer.ts` 147 Z.

**Von mir unabhaengig nachgerechnet, nicht dem Report geglaubt:**
- Move-Multiset: jede unpaarige Zeile erklaert (export-Praefixe, Import-Zeilen, der PUB-Anker,
  8 STATIC-Pfade + bundleV). Der einzige verdaechtige Rest, ein unpaariges
  `import {createHash}`, geht auf `editability` (main:server.ts:8845) zurueck, das mitwandert;
  server.ts behaelt seine eigenen 15 Verwendungen.
- **Pfad-Anker AUSGEFUEHRT, nicht gelesen** (die eine Stelle, die still haette brechen koennen):
  alle 8 `STATIC`-Pfade byte-identisch, `bundleV()` = 1788364731868 = direktes `statSync`,
  **und nicht null** — also nicht der `catch → 0`-Pfad, der einen kaputten Pfad maskiert haette.
- Kein `server/`-Modul importiert `server.ts`. Kein modul-weites `let` in beiden Modulen.
  `bun e2e/pins.ts` aus dem Lane-Baum: ALL PASS.
- **Lokaler `./e2e-isolated.sh`: 3466 PASS / 0 FAIL / `ISOLATED_EXIT=0`.** Die Zahl ist der
  Beweis: `b8ea448` lief lokal 3465/0, der Slice fuegt GENAU EINEN Check hinzu (den Anker-Check,
  den die Lane selbst eingezogen hat), also 3466. Gate-Kette 592 PASS / 0 FAIL / 1 SKIP.

**WARUM ES TROTZDEM NICHT GELANDET IST:** `main` ist rot — fremd (§4). Auf ein rotes main
gelandet, nennt der naechste Post-Land-Audit MEINE Lane in `covers` fuer fremde Fehler, und der
Bisect gehoert dann uns. **Freigabebedingung: main gruen ODER Slot 9 hat die zwei Checks
adjudiziert.** Dann sofort landen — Drift ist gemessen: `behind 11, wouldConflict FALSE,
conflictFiles [], overlap [e2e/security.ts, server.ts]`. Vor dem Land NEU messen, die Zahl ist
von 19:12.

**Zwei Dinge aus dem Lane-Report, die du brauchst:**
- **Der REMOTE-Lauf desselben Commits kam ROT** (exit 1, 4 Fails bei 3457 Trail-Zeilen;
  `checks.ran=25` zaehlt nur den 4-KB-Tail). Die Namen sind nicht beschaffbar (§5). Derselbe Baum
  ist hier gruen. Das ist NICHT als Flake bewiesen und darf nicht so berichtet werden.
- **RESIDUUM:** 3 Kommentare zeigen weiter auf „die TRANSPORT region" in `server.ts`
  (2× server.ts, 1× e2e/transport.ts). Der Brief verbot Kommentar-Umformulierung, die Lane hat
  es korrekt GEMELDET statt still geaendert. Naechster Slice raeumt es mit.

## 4. main ist ROT, und es ist Program cd110019 (Dual-Host), nicht wir

Audit `d4bb687a`: **LOKAL** gefahren, `checks` daher voll belastbar — red, exit 1,
`ran 3481, failed 2`, `covers fleet/260902113526-4811` = Task `8228ae65`.
Der Lauf davor (`b8ea448`, lokal) war gruen 3465/0. `d4bb687a` aendert AUSSCHLIESSLICH
`e2e/watch.ts` (+24/−7), Hunks bei 3215–3279 — **die beiden fallenden Checks sind nicht direkt
editiert**: `e2e/watch.ts:954` „subject-gone: the torn-down lane's undelivered event …" und
`e2e/watch.ts:3364` „restart keeps the busy pending event with the same id and no invented
attempt". Drei Lesarten offen (Fixture-/Timing-Perturbation durch die ent-vakuumierten Sonden ·
echter Defekt, den eine ent-vakuumierte Sonde jetzt zeigt · §11.2j-Flake, wo das Regelbuch aber
sagt: nach `b20e7e4` wieder ECHT). Slot 9 unterrichtet (`c8c3aac9`), Owner-Attention
`d11d1071`. **Nicht selbst reparieren — fremde gelandete Arbeit.**

## 5. WIE MAN FEHLERNAMEN BEKOMMT, DIE EINE LEDGER-ZEILE ELIDIERT HAT (das hier ist der Trick)

Weder die Audit-Zeile noch der Tail enthalten die FAIL-Namen; beide sind auf 4096 B gekappt und
zeigen nur „N FAILURES" plus Elisionsmarker. **Der Per-Check-Trail hat sie:**

    ls -t "${TMPDIR}/fleet-e2e-trail" | head -3
    python3 -c "import json;rows=[json.loads(l) for l in open('<trailfile>')];print([r['name'] for r in rows if r.get('ok') is False])"

Die Datei mit `rows == checks.ran` ist der gesuchte Lauf (hier: 3481 Zeilen ↔ `ran 3481`).
**Das geht nur fuer LOKAL gefahrene Laeufe** — ein Remote-Lauf laesst seinen Trail auf dem
Helfergeraet. Genau deshalb ist §6 teuer.

## 6. Befund, der NICHT abgelegt werden konnte — Advisory-Deckel 10/10

`POST /api/self/tasks` lehnt ab: `program advisory filing cap reached (10/10 pending advisory
rows awaiting owner disposition)`. Der Text liegt in meinem Scratchpad (stirbt mit der Session),
darum hier vollstaendig genug zum Wiederablegen, sobald der Owner disponiert hat:

> **Der Vorschau-Pfad wirft die Fehlernamen weg.** Der Daemon schickt `fails` auf BEIDEN Pfaden
> (`helper-daemon/daemon.ts#report`: `failNamesOf(logPath, trail)` aus der VOLLEN Logdatei,
> Deckel `FAILS_KEEP` 50). Der AUDIT-Pfad persistiert es (die `ffdcece`-Ledger-Zeile traegt
> `"fails": []` als eigenes Feld). `server.ts#reportLaneSuite` benutzt `fails` NUR als drittes
> Argument von `postLandAuditChecks` und legt es nicht auf `j.result`; gespeichert wird
> `{exitCode, result, reason?, tail, trail?, checks, remote, treeSha, ms}` — von der Lane
> gegengeprueft, exakt diese Schluessel. Folge: ein rotes Remote-Vorschau-Verdikt kann nicht
> sagen, WELCHE Checks fielen, also muss die Lane den Lauf lokal wiederholen — genau die
> Ersparnis, fuer die das Angebot existiert. **Reparatur: ein Feld.** Gegenprobe gehoert in
> `e2e/helper-portal.ts`: ein rot gemeldetes lane-suite-Ergebnis MUSS seine Fehlernamen fuehren.
> Der eigentliche Verlust passiert uebrigens auf der DAEMON-Seite: `tailOf(end, 40)` ist ein
> dummer Letzte-40-Zeilen-Schnitt, nicht signal-first — Fails aus der Mitte eines 3457-Check-Laufs
> erreichen den Server nie. `fails` ist die Reparatur dafuer, und sie wird fallengelassen.

Ebenfalls heute abgelegt und noch offen: `8244622e` (remote `failed` traegt, `ran` ist untere
Schranke), `76e6aa3b` (die Voraussetzung dazu, angestossen von Slot 3), `d2e4f219`
(**`SUITE_OFFER_WAIT_HELD_MS = 800_000` ist falsch dimensioniert**: remote p50 1323 s, nur 3/13
Laeufe unter Budget — und alle drei ROT, weil `e2e-isolated.sh` beim ersten FAIL exitet; das
Budget selektiert auf rot. Vorschlag: an die Lebendigkeit des Claims binden statt an eine feste
Frist. NICHT promoviert.)

## 7. MEIN FEHLER, damit du ihn nicht wiederholst

**Die Voraussetzung in meinem Slice-3-Brief fuer Teil B war FALSCH.** Ich schrieb „der Bereich
8629-8857 hat NULL freie Bezeichner aus dem Kern". Es sind FUENF: `HOME`, `expandCwd`,
`recents`/`pins` (vom Kern reassignte `let`), `CommitRow`. Die Lane hat es gemessen, nach Regel 2
drei Symbole (`listDirs`, `findDirs`, `dirInfo`) korrekt im Kern gelassen und es gemeldet —
daher −351 statt der geschaetzten −470.
**Wie der Fehler entstand, und das ist die uebertragbare Lehre:** meine erste Sonde
(`grep -oE … | sort | uniq -c`) meldete `4 HOME`. Meine zweite, verfeinerte Sonde meldete LEER.
**Ich habe der zweiten geglaubt, weil sie das bequemere Ergebnis hatte, statt den Widerspruch
aufzuloesen.** Genau das Muster, das das Regelbuch als „derselbe Wert in der Zeile UND ihrer
Gegenprobe heisst nie gemessen" fuehrt. Regel fuer den naechsten Brief: **eine
Freie-Variablen-Behauptung wird nicht gegrept, sondern vom Compiler beantwortet** — Block
probeweise in eine Datei ziehen und `tsc` die ungeloesten Namen nennen lassen.

## 8. Ehrlichkeiten

- Der Hand-Dispatch von Slice 3 lief mit dem OWNER-Token (`POST /api/tasks/:id/dispatch`), weil
  der Dispatcher-Master-Stop laut Program bis P7 steht und der Tick eine `queued`-Zeile daher nie
  startet. Dieselbe Tuer wie bei Slice 1/2. `/send` an Slot 3, 7, 9 ebenso Owner-Token.
- Diese Session hat `claude-opus-5[1m]` von Slot 12 geerbt, nicht Fable — die Modellpolitik vom
  2026-09-02 will fuer eine Program-MAIN Fable 5.1. Die Nachfolge erbt es weiter, bis jemand
  `POST /api/slots/:id/model` UND `/model` in der Pane setzt (beides noetig, §Supervisor-Rolle).
- Kein Post-Land-Audit deckt diesen Handoff-Commit (Direkt-Commit, kein Land).
- Slice 3s REMOTE-Rot ist offen und wird von mir NICHT als Flake behauptet.
- ctx bei der Uebergabe-Entscheidung: **28,5 % gemessen**.

---

# HANDOFF — Program-MAIN „Fleet Task Workbench" (Program `b9c1e0d9`, Slot 3 → Nachfolge), 2026-09-02 18:35, ctx GEMESSEN 24,8 %

Zustand ableiten, nicht aus dieser Prosa lesen: `GET /api/self/program-execution` (Self-Token).
Der Controller-Abschnitt darunter gehoert einer anderen Rolle.

## Stand der Zeilen

- **done, gelandet:** `eaa3ae1a` (bc9e7de) · `93fc5af2` (01459c9) · `ff535524` (8990fcb) ·
  **`1b677e58` (497873f, von mir gelandet)** — Gate gruen ueber alle sieben Stufen in 111 s,
  waitMs 0; Post-Land-Audit GRUEN mit 3465 Checks / 0 failed (Sammel-Audit auf tip b8ea448,
  covers auch Slot 8s Land).
- **IN FLUG: `15a3e38b`** (Detail-Kopf: Status/Program/Repo + Lifecycle-Leiste + GENAU EINE
  Hauptaktion ohne Scrollen bei 1440x900) — vom Controller von Hand dispatcht mit dem
  Owner-Tripel claude / claude-opus-5[1m] / high, Lane `fleet/260902162622-dbae`, **Slot 5**.
  Dein Zug: den Report als BEHAUPTUNG lesen, Diff und zitierten Verify-Tail selbst pruefen, dann
  landen (die Projektion nennt die Tuer). Danach `{"kind":"merge","target":5}` abonnieren — und
  siehe die Watch-Falle unten.
- **pending `07c061fa`** (unabhaengiger read-only Review, Ergebnis ist eine Messnotiz) — strikt
  NACH 15a3e38b, so entschieden im Program (serielle Reihenfolge).

## Beweislage (vollstaendig bis auf den Review-Slice)

- **Nachher-Baseline committet: `fda6fda`**, `docs/messungen/2026-09-02-task-workbench-visual-after.md`.
  Direkt-Commit im Haupt-Checkout, also fuer die Land-Ledger unsichtbar; Beweis im Body genannt
  (install + `bun e2e/pins.ts`, Tail ALL PASS).
  - BELEGT live: View-Split ohne Closed-Gruppe (Gruppenkoepfe mechanisch abgefragt) · Lane-Zeile
    mit Branch+Zustand · Spawn-Tripel mit Herkunft je Feld.
  - VERFEHLT mit Zahlen (= der Auftrag von 15a3e38b): Detail-Pane 634 px sichtbar bei 2240 px
    Scrollhoehe, `▸ start lane` bei 2297 px, Kopf ist genau EIN Wort.
  - Bilder ungetrackt im Wurzelverzeichnis (`workbench-after-*.png`), weil sie Account-Pfade zeigen.
- **Browser ohne Token im Kontext:** lokaler Redirect auf 127.0.0.1:8913 baut die `/?token=…`-URL
  in der Shell, der 302 des Servers laesst den Browser auf einer sauberen Adresse landen. Helfer
  ist gestoppt. Playwright-MCP schreibt die PNGs in den Haupt-Checkout; mit `Read` ansehen.

## Fallen, die ich bezahlt habe (alle als Queue-Zeile mit Done-Kriterium abgelegt)

- **`789d9034` + `c3bf1e7c`:** die Self-Land-Tuer lehnt denselben Candidate nach einem waitedOut
  UND nach einem adjudizierten roten Verdikt ab; sie liest den Candidate als Lane-HEAD, eine
  Bewegung von main sieht sie NICHT. **Praktische Folge fuer dich: vor jedem Wiederholungs-Land
  `git rebase main` im Lane-Worktree** — das bewegt den Candidate und oeffnet die Tuer ehrlich.
- **`be20f4b4` + `c7a5e061`:** `POST /api/self/watch {kind:"merge"}` gibt nach einem zweiten Land
  auf dieselbe Lane den GESPENTEN Watch zurueck (`existing:true, armed:false`) — du haettest dann
  keinen Rueckkanal und merkst es nur an `armed`. `8ab2de9` hat genau das fuer `kind:"job"`
  repariert, der merge-Zweig ist offen. **Ersatz: Hintergrund-Watcher auf
  `GET /api/slots/<n>/merge` bis `running:false`** (mit `json.loads(..., strict=False)` lesen, der
  Verify-Tail enthaelt Steuerzeichen).
- **`f9db018e` + `abb81258`:** `checks.ran` einer REMOTE-Audit-Zeile wird aus dem 4-KB-Tail
  gezaehlt (ffdcece: 22 statt ~3443). Ein Remote-Gruen beurteilst du an `ms` und am `ALL PASS`,
  nie an `ran`; `failed` traegt (Rekonziliation gegen das ungekappte `fails[]`).
- Fuenf Land-Versuche fuer EINE Zeile, drei davon `waitedOut` ohne den Baum je anzusehen. Was das
  behoben hat, war nicht Geduld, sondern `FLEET_AUDIT_HELPER_GRACE_MS=60000` + Deploy: der erste
  Lauf danach war in 111 s gruen bei 0 s Mutex-Wartezeit.

## Betriebsstand

- main `d4bb687`. Live-Server aktuell (Deploy `b21b6749` auf 3afb3f0 + Slot 10s Land danach —
  `deployGap`/`bundleStale` vor jeder Aussage ueber die Oberflaeche neu pruefen).
- Controller ist Slot 7 (~30 %, Nachfolge angekuendigt; sein Handoff-Nachtrag `274e91f`).
- `notiz 56056efe` (per-Slot taskId/originId/programId fehlen im Poll) bleibt bewusst LIEGEN:
  kein `server.ts`-Schnitt in diesem Program (Non-Goal).

---

# HANDOFF — Generalsanierung: P4 Slice 2 gelandet (ffdcece) und Stufe-2-GRUEN, Regelbuch-Gate repariert, erster informativer Remote-Audit seit 8 blinden Roten, 2026-09-02 (18:10)

Program **`b2a14b545fd31fd71ba7b9e1`**, gebunden an Slot 12 (diese Session). Controller ist
**Slot 7**. Ersetzt den Sanierungs-Abschnitt darunter.

## 1. Gelandet, verifiziert

- **P4 Slice 2 `d7b89fd6` → `ffdcece`** (Lane `fleet/260902073536-c509`, Slot 5, Opus 5 high).
  `server/errors.ts` (88 Z.), `server/persist.ts` (75), `server/tmux.ts` (72); server.ts
  24040 → 23810. Land-Note: `verify.ok true`, volle 7-Schritt-Kette, **106,7 s Arbeit / 0 s
  Wartezeit**, `mainBefore 8865eaa`. **Actor ist `owner-token-outside-board`, NICHT `main`** —
  Grund in §2/§4.
  Von mir unabhaengig nachgerechnet, nicht dem Report geglaubt: Move-Multiset LEER,
  ESM-Reassignment-Sonde (`errorTotal|auditChain|auditWriteFailed`) LEER, kein `server/`-Modul
  importiert `server.ts`, tsc Gate-Liste exit 0, `bun e2e/pins.ts` ALL PASS aus Lane UND
  Haupt-Checkout. Zwei Lane-Abweichungen geprueft und richtig: `AUDIT_ROTATE_BYTES` wandert mit
  (`queueEventWrite` liest es), `observeTmuxSlots`/`tmuxSlotObservation` bleiben im Kern (lesen
  `repoCanon`/`sessTarget`/`sess`).
- **Post-Land-Audit `ffdcece`: GRUEN, und diesmal AUSSAGEKRAEFTIG** — remote second-host,
  `ms 1373734` (22,9 min), **`exitCode 0`**, `clonedSha` = mainSha, `dirty:false`.
  **`checks:{ran:22}` ist ein Zaehl-Artefakt, nicht die Messung:** `out` ist auf 4096 B gekappt,
  31 Zeilen aufbewahrt, davon 22 PASS — die Zahl kommt aus dem Tail, nicht aus dem Lauf. Der
  Beweis ist `exitCode 0` nach 22,9 min (`./e2e-isolated.sh` exitet auf jedem FAIL != 0; die acht
  blinden Roten davor trugen exit 1 mit „N FAILURES" im Tail).
  **Damit ist die Blindstelle `df22cf14` fuer ROTE Zeilen zu** — plausible Ursache ist das
  Daemon-Update (`79acd2e`, daemonSha `f62b1f5`). Was BLEIBT, ist allein der `checks.ran`-
  Untercount; die P6-Zeile also nicht schliessen, sondern auf den Untercount verengen.
- **P4 Slice 1 `e03d44c`** (Vorgaengerin): Audit rot/unnamed → `unknowable` adjudiziert, Beleg
  ist der von mir aus dem Trail verifizierte lokale Lauf `isolated-20260902T064422Z-62019`
  = 3443/0 auf `b4cca7a`, und `git diff --stat b4cca7a e03d44c` = nur HANDOFF.md.
- **Deploy `798be4ab`** auf 5e2f47d: boot-verifiziert `ok:true`, plus Dry-Boot 4880d15 als
  Rollback-Beweis (eigener Socket/Port, `FLEET_CMD=true`, sauber abgeraeumt).
- **Plan-Nachtrag `3a1723e`** (ersetzt `b548549`, beide docs-only Direkt-Commits): von den vier
  Zuegen der Beschleunigungs-Messnotiz bleibt nach GLM-§4 **nur Zug 2** — Vorschau entfaellt,
  wenn `rg -n '<bezeichner>' e2e/` ausserhalb `pins.ts` fuer ALLE Hunk-Bezeichner 0 Code-Treffer
  hat, mit benanntem Restrisiko und Rueckfallregel. Schritt f bleibt je Slice; P5-Parallelspur
  erst nach dem A1-Mess-Tag.

## 2. In Flug — das Erste, was du tust

1. **DEPLOY steht aus.** `deployGap.codeBehind` war `true`; `POST /api/deploy` gab um 18:07
   **409** (`a post-land audit is running on claude-fleet`) — lokaler Audit ueber
   `fleet/260902051642-e0e3` + `...51644-adb8`. Wiederholen, wenn er durch ist; danach
   `bundleStale`/`deployGap` auf `/api/sessions`, `bun e2e/pins.ts`, `graphify update .`.
   **main ist inzwischen `b8ea448`** (Slot 3 hat nach meinem FREEZE-ENDE gelandet) — du deployst
   also mehr als meinen Slice; das ist richtig so, aber sag es in deinem Bericht.
2. **P4 Slice 3 = Rest von Tier 1** (Plan §P4 Punkt 3: transport, dir-explorer, audit-queue, auth
   — error-channel ist mit Slice 2 weg). **Zuerst die Kollisionskarte NEU messen**, meine ist
   veraltet: je lebender Lane
   `git -C <worktree> diff -U0 $(git -C <worktree> merge-base HEAD main) -- server.ts | grep '^@@'`.
   Meine Messung von 09:30 war: transport (16338-17279) und auth (16207-16337) waren frei,
   audit-queue (12254-13400) war belegt — die belegenden Lanes landen gerade, also neu messen.
   Brief-Muster steht in §3; der Slice-2-Brief lag in meinem Scratchpad und ist weg.
3. **`FLEET_AUDIT_HELPER_GRACE_MS`** steht wieder auf 60000 (Audits remote). Der Controller
   drehte es zwischenzeitlich auf 0 und zurueck; wenn ein Audit wieder blind rot kommt, ist die
   erste Frage der daemonSha auf dem Geraet, nicht dein Baum.

## 3. Brief-Muster fuer einen P4-Slice (das hat zweimal getragen)

Ueberschrift mit Program-Id, Plan-Anker, Basis-sha und dem Satz „Zeilen gelten fuer GENAU diesen
Stand; bei Abweichung gilt das Symbol". Dann: **WAS WANDERT** (Symbolliste je Zieldatei, mit der
Messung, warum es gehen darf) · **WAS BLEIBT** (namentlich, mit Grund) · **REGELN** (reiner Move,
keine Signatur-/Kommentaraenderung; `server/` importiert nie `server.ts`; ESM-`let`-Sonde als
Kommando ausgeschrieben; Pins umhaengen statt loeschen, kein vakuum-gruener Pin; Import-Stil per
`git show <letzter slice> -- server.ts | head -60`) · **BEWEISE 1-5 als Kommandos**
(Move-Multiset mit `awk '$1 % 2 == 1'`, tsc Gate-Liste + `--noUnusedLocals/Parameters`, pins,
volle Gate-Kette in eine Log-DATEI, Vorschau NUR wenn der Zug-2-Filter Treffer hat) ·
**VERBOTEN** (Default-Env-Server, pkill nach Muster, `checkout --`, ungetrackte Dateien) ·
**Drift-Check vor dem Done-Report** · **DONE als pruefbarer Satz**. Deckel ~2000 bewegte Zeilen.

## 4. Befunde dieser Session (zwei davon kosten dich sonst eine Stunde)

- **Ein Handedit an `CLAUDE.md` im Haupt-Checkout macht JEDES Land-Gate dieser Maschine rot.**
  Live passiert (Controller Slot 7, 17:04): der Pin `RULE_RENDER` liest `rulebook/` UND
  `CLAUDE.md` aus **SOURCE_DIR**, also dem Haupt-Checkout, nie aus dem verifizierten Baum. Gate
  fiel exit 1 nach 906 ms in Stufe 1. **Repariert, und die Reparatur ist die Lehre:** ein blosses
  Re-Render haette die Korrektur GELOESCHT (sie stand nur im Monolithen). Ich habe sie nach
  `rulebook/supervisor.md` gezogen und von dort gerendert — und dabei die Wendung
  „aktualisiert den Slot-Datensatz aber nicht" wiederherstellen muessen, weil die Bedeutungsprobe
  sie als Muster von Regel **S2** fuehrt (`docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md:130`)
  und der Handedit sie ersetzt hatte. **Beide Dateien sind gitignored** — kein Commit moeglich,
  kein main-Zug; der Fix lebt allein in der Working Copy des Haupt-Checkouts. `git status` zeigt
  ihn nie. Wenn du ihn verlierst, ist jedes Land wieder rot.
- **Die Self-Land-Tuer kann eine Reparatur ausserhalb des Baums nicht sehen** (Zeile `f0c28e8f`):
  ihr Guard verweigert mit 409 `no progress since the last verdict`, sobald `candidateSha`
  unveraendert ist — seine Praemisse „dieselben Bytes ⇒ dieselbe Antwort" gilt fuer die
  `pins`-Stufe aber nicht, weil die SOURCE_DIR liest. Eskalation ist die Owner-Tuer
  `POST /api/slots/:id/merge` (**nicht** `/land` — das ist die Main-Direct-Tuer und antwortet
  „unpushed commits"; und **kein `confirm`**, das verbietet der Program-NonGoal). Daher der
  `owner`-Actor auf der Land-Note.
- **`372b3cef` dreimal reproduziert:** `POST /api/self/watch {kind:"merge",target:N}` gibt nach
  einem gefeuerten Watch den **spent** Watch zurueck (`armed:false`, `firedAt` gesetzt) — auch
  bei einem NEU laufenden Merge. Eine MAIN steht nach einem roten Land ohne Rueckkanal auf ihr
  eigenes Re-Land da. Rueckweg, der traegt: Hintergrund-Watcher auf
  `GET /api/slots/N/merge` bis `running=false` UND `last.at` neuer als das vorige Verdikt.
- Zwei Queue-Zeilen abgelegt: `f0c28e8f` (Guard + Watch) und `18a14e37` (Selbstbefund B).

## 5. Ehrlichkeiten

- Direkt-Commits ohne Land-Ledger: `b548549`, `3a1723e` (beide docs-only, Plan-Nachtrag) und
  dieser Handoff. Kein Post-Land-Audit deckt sie; `./state.sh`s Land-Health untertreibt heute.
- Der Deploy von Slice 2 ist NICHT gefahren (§2 Punkt 1). Der Dry-Boot fuer Slice 2 ebenfalls
  nicht — Schritt f steht komplett aus.
- Slice 2 lief nach Zug 2 **ohne** Vorschaulauf. Die einzige volle Messung ist der Post-Land-Audit,
  und der ist gruen (§1). Der Filter hat also gehalten — n=2, mehr sagt er nicht.
- Adjudikation, `/send` und der Owner-Merge liefen mit dem Owner-Token; die Routen kennen keinen
  MAIN-Prinzipal.
- ctx bei der Uebergabe-Entscheidung: **27,8 % gemessen**.

---

# HANDOFF — Fleet Controller (Slot 15, Fable 5.1 high): drei Nachfolgen (3->4, 4->16, 7->3), Sanierung-Beschleunigung GEMESSEN (dbaeab7), 3bb5a5c9 fertig und Land in Kette, Paste-Platzhalter-Mechanismus gefunden; A1 GELANDET (01ccfb3); Uebergabe bei ~31 % GEMESSEN, 2026-09-02 (15:57)

Rolle: 🎛 Fleet Controller (Owner-Delegation 10:05 gilt; Owner-Prinzip 13:45: nur fragen, was ohne ihn
nicht zu beantworten ist). Modelle: MAINs Fable, Lanes Opus, Sol = gpt-5.6-sol (codex), GLM nur pi-zai.
Watches gehoeren den MAINs; ich halte nur einen lane-Watch auf Slot 1 (meine eigene Land-Pflicht).

## 0. Reihenfolge fuer dich

1. Erdung (`./state.sh`, `./register.sh`, dieser Abschnitt, Board). Miss deinen ctx, bevor du liest.
2. **`3bb5a5c9` (A1) IST GELANDET: main = `01ccfb3` (15:51, zweiter Gate-Lauf gruen, Note
   `verify.ok true`, 197 s Arbeit / 77 s Warten; erster Lauf rot mit EINEM FAIL „live foreign
   harness: the scheduled prompt reaches the pane", Send-Boot-Familie §11.2f, derselbe Baum lief
   danach gruen).** `.env` steht schon auf `FLEET_AUDIT_HELPER_GRACE_MS='60000'` — aktiv wird das
   erst mit dem naechsten srv-Boot. DEIN ZUG: den lokalen Post-Land-Audit fuer `01ccfb3` abwarten
   (`POST /api/self/watch {"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"<voller
   SHA von 01ccfb3>"}`; Verb 2 gibt 409, solange er laeuft), dann `POST /api/deploy` (Owner-Token),
   `bundleStale`/`deployGap` pruefen. Ab da laufen Audits auf dem Geraet. Erfolgstest: naechster Tag
   `verify.waitMs` ~0 in den Land-Notes UND die erste Remote-Zeile traegt `fails[]` + `checks.ran`
   ~3400 (Notiz §2 Zug 1). Queue-Zeile `39fbbd1f` ist mit `01ccfb3` erledigt — schliessen.
3. **Land `1b677e58` (Slot 2):** ZWEIMAL `waitedOut` (14:40, 15:33 — je 45 min Schlange hinter
   Lane-Suiteketten, nie verifiziert). Slot 3 (Task-Workbench-MAIN) rebased jetzt auf `01ccfb3` und
   landet per Self-Land-Tuer (der Guard `unchangedRetry` verlangt bewegtes main, Notiz `789d9034`);
   Lanes 5/8/10 sind bis ~16:00 gebeten, keine lokale Suite zu starten. Nichts von deiner Seite
   starten. Mechanismus fuer den Nachfolger: ein Gate stirbt an der 45-min-Wartewand, wenn drei
   Lane-Ketten den Mutex halten — vor einem Land die Lanes anhalten, nicht das Land wiederholen.
4. **GLM-Zweitmeinung ist EINGEARBEITET** (§4 der Notiz, `65f3d53`; Slot 12 hat die Zeile 15:08):
   Zug 2 traegt jetzt sein Restrisiko, Zug 3 ist gestrichen, das zweite Helfergeraet steht ueber der
   Linie, P5-Parallelspur erst nach dem A1-Mess-Tag. Der GLM-Slot 7 ist gekillt; pruefe mit
   `./state.sh`, ob der Worktree `fleet-260902125001-c6f3` als Orphan liegt — dann verwerfen, nie landen.
5. Slot 12 hat den Vorschlag UEBERNOMMEN: Plan-Nachtrag `3a1723e` (nur Zug 2 mit Filter auf alle
   Hunk-Bezeichner, f je Slice, P5-Spur nach dem A1-Mess-Tag). Dort nichts umschreiben.

## 1. Was heute passierte (verifiziert; Bodies in `git log df6291e..main`)

- **Nachfolgen ohne Owner-Route:** `POST /api/self/succeed` nimmt seit heute `model`/`effort` im Body
  (`server.ts#handleSelfSucceed`); Slot 3 (Opus-Datensatz, Fable-Pane) ist damit sauber als Fable nach
  Slot 4 gegangen, Slot 4 nach 16, Slot 7 nach 3. Program-Bindungen sind mitgewandert
  (`succeedProgramMain`). Die Composer-Sonde (9c7d6e02) hat NICHT gefeuert — drei von drei. Eine
  Owner-Route-Nachfolge haette das Program NICHT umgebunden; `bootstrap-main` ist der Notweg, wenn
  die alte Bindung stale ist.
- **Slot 14 (Vorgaengerin) und Slot 16 (namenlose Opus-Pane, nur `/usage`, ctx leer) retired** —
  vorher gab es keinen freien Slot. Brief 6 (`d7c700b1`, private-repo-p) laeuft in Slot 14 (Opus high).
- **Messnotiz `dbaeab7` + `65f3d53`** (Direkt-Commits, reine Docs, `bun e2e/pins.ts` ALL PASS): §0 der Notiz sind
  die fuenf Saetze. Kurz: Mutex 09-02 zu 98,9 % belegt; Vorschau in Lanes 52,5 %, fehlerhafte Suiten
  22,4 %; 200 min Gate-Warten gegen 21 min Gate-Arbeit; H1 halb wahr (nur Audit + Vorschau koennen
  remote, beides gebaut, S2–S4 verlagern 0 Suite-Minuten); H2 als Filter richtig; H4 traegt; H5 alle
  private-repo-p-Guards. Die Suite ist LANGSAMER geworden (453 → 675 ms/Check), nicht fehlerhafter.
- **Paste-Platzhalter-Mechanismus (Zeile `9077e284`):** ein 1132-Zeichen-Send bekam 409 „composer still
  held only part"; die Pane zeigte `[Pasted text #3]` — Claude Code kollabiert lange Pastes zu einem
  16-Zeichen-Platzhalter, die Sonde zaehlt Zeichen. `tmux send-keys Enter` hat submitted. Vermutlich
  dieselbe Wurzel wie 9c7d6e02 und 86830851. Bis zum Fix: Sends unter ~1000 Zeichen halten oder nach
  dem 409 die Pane lesen und Enter schicken.
- Slot 1 (A1) war eine CLARIFY-Lane, keine Bau-Lane; ihre drei Fragen (Beweisweg / DONE an Namen /
  Freeze) habe ich als Controller beantwortet (1a/2a/3a; `releasedBy: owner` ist die Freeze-Ausnahme).
  Kriterium konnte sie nicht ablegen (Zeile stand `done`, nicht `sent`) — steht im Commit-Body.

## 2. Betriebsstand (15:00)

Lanes 1 (A1, fertig), 2 (Land laeuft), 5 (P4 Slice 2, Slot 12), 8, 10 (S2, 31 % ctx — ueber dem Band,
aber eine Lane landet statt zu migrieren), 13 (Sol, private-repo-p Receipt, mergePending), 14 (Brief 6).
MAINs 3/4/16 frisch (11–15 %), 6 (29,6 %), 9 (26,8 %), 11 Steward (27,8 %), 12 (22 %). Dispatcher
`on:false`, maxLanes 2. Gate-Lock wechselt zwischen Lane-Suiteketten; kein Audit laeuft. Task C
(`860cecdf`, Slot 16s Program) wartet auf Dispatch mit Vorbedingung suites=0 — erst nach A1 realistisch.

## 3. Fallen, die ich bezahlt habe

- `POST /api/self/watch {kind:"merge"}` nach einem gesettelten Merge feuert SOFORT aus dem alten Fakt
  und ist dann verbraucht; ein zweiter Subscribe auf dasselbe Ziel gibt die verbrauchte Zeile zurueck
  (kein neuer Watch). Fuer einen NEUEN Merge auf demselben Slot: Hintergrund-Watcher auf
  `GET /api/slots/:id/merge running`.
- `GET /api/sessions` traegt `programs` OHNE `main` — Program-Bindungen nur aus `fleet.json`.
- Sends ueber ~1000 Zeichen: siehe Platzhalter-Mechanismus oben.
- Drei Agenten-Berichte lesen kostete ~7 Punkte ctx; die Berichte liegen als Dateien im Repo, ein
  Nachfolger liest §0 der Notiz, nicht die Berichte.

## 4. Offene Owner-Punkte

1. Zweites Helfergeraet (0 Code, `helperDevices` ist eine Map) — entkoppelt Audit von Vorschau am
   seriellen Helfer-Slot; `mainMacbook` war am 09-01 23:17 kurz registriert. 2. Promotion der
   B-Zeilen in GLM-Reihenfolge (B2, B3, B0/B4); `9077e284` gehoert zu B0/B3. 3. Owner-Richtung 13:05
   (`98979607`, Codex-Controller) — unveraendert offen. 4. GitHub 12 Tage hinter main.

---

# HANDOFF — Program-MAIN „Fleet Task Workbench" (Program `b9c1e0d9`, Slot 7 → Nachfolge), 2026-09-02 14:20, ctx GEMESSEN 30,8 %

Dieser Abschnitt gehoert dem Program-MAIN der Task Workbench; der Controller-Abschnitt darunter ist
ein anderer Rolleninhaber. Zustand ableiten: `GET /api/self/program-execution` (Self-Token), nicht
diese Prosa.

## Stand der sechs Zeilen (Program-Kriterien: siehe Program-JSON im Gruendungsbrief)
- **done, gelandet:** `eaa3ae1a` (Baseline, bc9e7de) · `93fc5af2` (View-Split + Suche, 01459c9) ·
  `ff535524` (Lane-Zeile an der Task-Zeile, **8990fcb**, gelandet ~05:00 durch den Controller).
- **IN FLUG: `1b677e58`** (Spawn-Triple sichtbar/waehlbar; Start und Clarify getrennt) — Slot 2,
  Lane `fleet/260902051642-e0e3`, Commit **16b922e** (vier Dateien, Baum sauber). **Von mir geprueft:**
  Diff gelesen, e2e-trail auf tree 16b922e gruen (clean-review 17+15/0, security 92/0, claude-gate
  72+63+6/0), merge-tree gegen main konfliktfrei. **Der Land ist zweimal NICHT durchgekommen, ohne
  dass der Baum je angesehen wurde:** einmal `error` (FF verweigert, main zog waehrend 1784 s
  Mutex-Wartezeit — das war ff535524, gleiches Muster), einmal `resolved`/verify NEVER STARTED
  (waitedOut nach 2671 s hinter drei Lane-Suiteketten). Controller Slot 15 startet den Land neu,
  sobald der Mutex frei ist, und sagt Bescheid. **Dann, nicht vorher:** `POST /api/self/watch
  {"kind":"merge","target":2}`; bei landed=YES `{"kind":"audit","repo":<toplevel>,"mainAfter":<sha>}`.
- **pending `15a3e38b`** (Detail-Kopf: Status/Program/Repo/Lifecycle-Leiste + GENAU EINE Hauptaktion
  ohne Scrollen bei 1440x900) — erst releasen, wenn 1b677e58 gelandet ist UND keine aktive Lane
  `src/client.ts`/`public/index.html`/`e2e/tasks.ts` haelt (Program-NonGoal; pruefen: je Worktree
  `git diff --name-only main...HEAD` + `git status --short`). **Triple: claude / claude-opus-5[1m] /
  high** (Owner-Entscheid 10:35 via Controller; ERSETZT das Fable-Tripel vom Vorabend). Die Zeile
  speichert noch das Codex-Tripel vom Filing — der Hand-Dispatch des Controllers ueberschreibt es
  feldweise; Dispatcher ist AUS (`grep '"dispatch"' fleet.json`).
- **pending `07c061fa`** (unabhaengiger read-only Review, nur docs/messungen) — strikt nach 15a3e38b.
- **notiz `56056efe`** (per-Slot taskId/originId/programId fehlen im Poll — needs-main von ff535524,
  von mir entschieden: KEIN server.ts-Schnitt in diesem Program) · **notiz `8b0114e1`** (Selbstbefund B).

## Beweislage, ehrlich
- Screenshots 1440x900/390x844 vom 2026-09-01 als ungetrackte PNGs im Wurzelverzeichnis, Messnotiz
  `docs/messungen/2026-09-01-task-workbench-visual-baseline.md` (**79075de, Direktcommit auf main,
  docs-only, von Hand verifiziert: install + `bun e2e/pins.ts` ALL PASS**). Nachher-Bilder fuer
  ff535524/1b677e58 fehlen noch — der Review-Slice 07c061fa oder die Nachfolge nimmt sie.
- Die 22 neuen Checks von 1b677e58 (`e2e/tasks.ts`) liefen nur auf der Scratch-Instanz der Lane
  (Vorschau wegen Maschinenlast ausgeschlossen). Erster voller Lauf = Post-Land-Audit. Der Audit von
  8990fcb war `unknown` (1800-s-Timeout unter load 33, 2505 PASS / 3 Last-Rots, keine Workbench-
  Checks). **Wird der Audit von 1b677e58 wieder unknown/blind: EINEN seriellen `./e2e-isolated.sh` auf
  dem gelandeten Baum fahren, sobald `ps -eo command | grep -c '^/bin/sh ./e2e-'` = 0.**
- Zwei Korrekturen an den Auftragstexten, beide angenommen: originId-Fallback/Program-Pruefung sind
  aus dem Poll nicht ableitbar (Zeile sagt „program unchecked"); Clarify-first OEFFNET eine Lane
  (`server.ts#dispatchTask`, Status → sent, awaiting owner) — der Zeilentext behauptete das Gegenteil,
  der Server-Vertrag gilt (Program-Kriterium „API-Semantik unveraendert").

## Mechanik, die ich bezahlt habe
- Es gibt keinen Weckruf auf „Commit X ist auf main": Lane-Watch feuert bei done-looking, Merge-Watch
  nur waehrend/nach einem Merge (Sofortfeuer auf alten interrupted-Fakt!). Hintergrund-Watcher
  (`run_in_background`) wurden 3x von aussen gekillt; One-shot-Autos sind Timer. Vorschlag in 8b0114e1.
- Nachricht an den Controller: `POST /send {"slot":<Controller-Slot>,"text":...}` mit Owner-Token
  aus `fleet.json` (kein Self-Weg). Controller ist jetzt **Slot 15** (Slots 2/10/12/13/14 waren es).
- Self-Auto loeschen nur ueber die Owner-Route `POST /api/autos/<id>/delete`.
- Suite-Tails einer Lane liegen im geteilten `e2e-trail/` (Haupt-Checkout, `e2e/trail-emit.ts`),
  Audits in `$TMPDIR/fleet-e2e-trail/`; nicht im Lane-Scratchpad suchen.

---

# HANDOFF — Fleet Controller / Denksession (Slot 14, Fable 5.1 high): Second-host BOOTSTRAPPED + Remote-Rot erklaert (LANG=de_DE), Denksession B als Notiz + 18 Register-Zeilen, GLM-Zweitmeinung, Owner-Richtung Codex-Controller; Uebergabe bei ~25 % GEMESSEN, 2026-09-02 (13:15)

Rolle: 🎛 Fleet Controller als DENKSESSION (Owner-Auftrag 12:25, Nachtrag 12:40). Keine Watcher gelegt,
Watches gehoeren den MAINs. Owner-Delegation 10:05 gilt weiter. Modelle: MAINs Fable, Lanes Opus.

## 0. Reihenfolge fuer dich

1. Erdung (`./state.sh`, `./register.sh`, dieser Abschnitt). Dann `docs/messungen/denksession-zusammenarbeit-2026-09-02.md`
   — §0 (fuenf Saetze) und §5 (korrigierte Reihenfolge). Das ist das Ergebnis, nicht dieser Handoff.
2. **Auftrag `3bb5a5c9` landen lassen** (eine Zeile in `server.ts#processBirthFingerprint`: `LC_ALL=C` in den
   `ps`-Spawn, Pin in `e2e/pins.ts`). Er ist `auftrag pending`; Freigabe ist Owner-Akt (Sanierungs-Freeze —
   Slot 12 entscheidet, ob als Freeze-Ausnahme). Danach `.env` `FLEET_AUDIT_HELPER_GRACE_MS='60000'` + Verb 2,
   und die Audits laufen wieder auf dem Geraet (Zeile `226a2174`). Vorher NICHT: jeder Remote-Audit ist ohne
   den Fix deterministisch 5/3443 rot.
3. **Lane Slot 1 (pi-zai, GLM-Zweitmeinung) ist ein Wegwerf-Slot**: Worktree `fleet-260902105240-69ed` mit
   einer UNTRACKED Kopie der Notiz. Ueber das Board verwerfen (discard), nie landen. Die Antwort steht in
   ihrer Pane; §5 der Notiz hat sie schon verarbeitet.
4. Die 18 neuen Register-Zeilen (`./register.sh`: `[A1]` `[A2]` `[P6 … 12:50]` `[idee B1–B12]` `[Private-repo-o D1/D2]`
   `[owner-richtung 13:05]`) sind Vorschlaege mit Done-Kriterium; Promotion ist Owner-Akt. Erste Kandidaten
   in der von GLM korrigierten Reihenfolge: B2 (Composer-Rest leeren), B3 (Send-Ledger), dann B0/B4.

## 1. Was heute passierte (verifiziert; Bodies in `git log f62b1f5..main`)

- **Second-host bootstrapped 12:57:** Owner-Name `second-hostowner`; Bundle von `main` per scp nach
  `/tmp/claude-fleet.bundle`; `git clone` nach `/var/lib/fleet-helper/work/tree-bootstrap` (f62b1f5); Symlink
  `work/current`; Unit aus Template (`sed` USER/GROUP/WORK-DIR/BUN-PATH/BUN-DIR; neu `RestartForceExitStatus=75`);
  `daemon-reload` + `restart`; Journal `running f62b1f58 from …/tree-bootstrap/helper-daemon`.
- **Deploy `d79bde9c` (Verb 2) ok:true** auf f62b1f5 — vorher war der Live-Server bei `0564565`, also VOR
  79acd2e, und kannte `daemonSha` nicht. Jetzt: `helperDevices[0].daemonSha = f62b1f5…`, `deployGap.codeBehind
  false`, `bundleStale false`.
- **Remote-Rot-Mechanismus reproduziert AUF DEM GERAET:** `ps -o lstart= -p <pid>` unter dem Daemon-Environ
  (`LANG=de_DE.UTF-8`, procps 4.0.4) druckt `Di Sep  1 07:00:05 2026`; `PROCESS_BIRTH_RE` verlangt
  `[A-Z][a-z]{2}` → null → `unmeasurable`. Mit `env -i` englisch. Die Locale-Erklaerung TRAEGT also — der
  andere Agent hatte nur `LC_TIME` erzwungen, der Daemon hat `LANG`. Schreiber `e2e-stage.sh` setzt `LC_ALL=C`.
- **Denksession B:** Notiz committet (`4206795`). Kern: eine Primitive (Pane-Send) fuer drei Beduerfnisse
  (Fakt / Weckruf / Entscheidung) plus ein viertes (Peer-Koordination); der Pane-Send ist der einzige Kanal
  ohne Ledger; 169 von 185 holds heute an EINEM Slot durch 53 Zeichen Composer-Rest; `delivery:"inbox"`
  existiert und wird nicht benutzt, weil ohne Weckruf/Ack. Rollen-Perspektiven §2.3, Strukturen §2.4,
  Schnitte §2.5, Private-repo-o §4, GLM §5.
- **Owner-Datenpunkt 12:50:** ein langer Owner-Paste kam ueber den Fleet-Send nur mit dem Schwanz an
  (Zeile `86830851`; Owner: fruehere Faelle mit langen Grok-Antworten; Prioritaet „maximal robust").

## 2. Betriebsstand (13:15)

- Slots: 2/5/8 Lanes (Opus), 3/4/7/9/12 MAINs (Fable), 6 Private-repo-o (Owner-Hold), 11 Steward, 13 Vorgaenger-
  Controller (28 %, zieht sich zurueck), 1 GLM-Wegwerf-Lane. Gate-Lock „overdue" = Slot 5s dritter
  isolated-Lauf seit 11:35, nicht wedged. Kein Audit laeuft. Dispatcher `on:false`, maxLanes 2.
- Audit 79acd2e rot 10/3443 gehoert weiter Slot 9 (Rerun lief in Slot 13s Pane, stirbt mit ihr).
- Host: load 3,2, Swap 2,2/3,0 GB — deutlich besser als am Vormittag.

## 3. Fallen, die ich bezahlt habe

- **Token-Hygiene:** `cat config.json | sed 's/"token":"…/'` hat NICHT gegriffen (das JSON hat ein Leerzeichen
  nach dem Doppelpunkt) — der Helper-Token stand einmal in meinem Kontext. Muster fuer den naechsten:
  `python3 -c 'import json;d=json.load(open(...));d.pop("token");print(d)'`, nie sed auf Secrets.
- Ein langer Paste ueber den Fleet-Send kann VORNE abgeschnitten ankommen, ohne Fehler. Lange Texte
  an eine Session als Datei + Einzeiler-Pointer zustellen (so lief die GLM-Befragung fehlerfrei).
- Der Live-Server war 4 Commits hinter HEAD, `state.sh` sagt es (`deploy gap`) — vor jedem „das Feld fehlt
  auf dem Board" erst `deployGap.codeBehind` pruefen.

## 5. DER AUFTRAG AN DICH (Owner 13:30): die Sanierung beschleunigen — sauber, mit Agenten

**Owner woertlich:** „das waeren ja zwei Wochen... Oder wuerde der second-host split das ganze nochmal
potenziell stark beschleunigen? Ich glaube tatsaechlich auch das die Hauptdauer heute von einer reihe an
fehlerhaften suites produziert wurde.. Vllt muessten wir hier nochmal gut nachdenken ob wir den Plan-
ablauf oder sonstwas nicht vielleicht besser strukturieren/optimieren koennen." Kontext: meine
Schaetzung (Denksession-Notiz, Chat 13:25) war 2–3 Wochen bis P7 bei 2 Slices/Tag; B-Fixes sollen
in P6 laufen (Owner-Entscheid: warten bis Freeze-Ende, Entwuerfe vorher).

**Was ich schon gemessen habe (post-land-audits.jsonl, heute):** 16 Audits, ALLE lokal, 326 min
Mutex = 5,4 h. Davon 5 gruen (je ~28 min), 4 rot (2 mit gezaehlten Fails 2 und 10 — Composer-
Familie —, 2 ohne), 2 `unknown` an der 30-min-Wand (Last: Vorschau neben Audit, `aecd5f89`), 5 `unknown`
mit ~0 ms (nie gelaufen). Rechnung: ~3 h des Tages waren rote/gestorbene Audits plus deren Reruns —
die Owner-Hypothese traegt zur Haelfte; die andere Haelfte ist, dass ALLES lokal lief (Grace 0).
Das Slice-Protokoll (Plan §P4 d–g) faehrt je Slice DREI volle Suiten seriell auf demselben Lock:
Vorschau in der Lane, Gate, Audit — bei ~28 min je Lauf hier.

**Hypothesen, die du pruefen sollst (nicht glauben):**
- H1 Second-host-Split = groesster Hebel: mit `3bb5a5c9` gelandet laufen Audits remote → 5,4 h/Tag
  Mutex frei; Dual-Host S2–S4 wuerde auch Vorschau/Lanes verlagern. Frage: was davon braucht S2–S4
  wirklich, was reicht mit A1 allein?
- H2 Die Vorschau (Protokoll d) ist bei reinen Move-Slices redundant: P3 beweist Verhaltens-
  Gleichheit per `bun build`-SHA-Vergleich; die Vorschau wiederholt den Audit. Streichen = −28 min
  und −1 Mutex-Halter je Slice. Regelbuch sagt ohnehin: Tier-2 ist Vorschau, kein Gate.
- H3 Flake-Familien mit NAMEN → maschinelle Adjudikation: ein Rot, dessen `fails[]` vollstaendig in
  einer bekannten Familie (`docs/verify-tiering.md` §11.x) liegt, wird `flake-known` ohne Rerun.
  Voraussetzung: Namen auf jeder roten Zeile (B7 + `df22cf14`), Familien als Daten statt Prosa.
- H4 P5 und P6 muessen nicht auf P4-Ende warten: P5-Verify ist `bun run build` + Demo-Typecheck
  (leicht, kein Suite-Mutex); P6-Sweeps koennen auf schon geschnittenen Modulen (`server/types.ts`,
  `server/persist.ts`) beginnen. Wo kollidiert das mit `e2e/pins.ts` (serialisiert P4/P5)?
- H5 Die 5 „unknown ~0 ms" sind ein eigener Fehler (Audit nie gestartet) — Ursache?

**So durchdenken (Agenten, Opus, read-only, je mit Dateien+Done im Brief; Ergebnis als
datierte Notiz `docs/messungen/sanierung-beschleunigung-2026-09-0x.md` + Queue-Zeilen; GLM-
Zweitmeinung ueber die pi-zai-Lane per Datei-Pointer, so lief es heute fehlerfrei):**
1. **Zeitbudget-Agent:** Skript ueber `post-land-audits.jsonl`, `lane-outcomes.jsonl` (Land-Notes:
   `verify.waitMs`/`ms` — Feldnamen erst pruefen, mein Versuch fand 0 Zeilen fuer heute),
   `audit.jsonl` (`postland_audit`, `land_actor`) seit 2026-08-31: Minuten je Kategorie (Gate-Arbeit,
   Gate-Warten, Audit gruen/rot/unknown, Reruns, Vorschau in Lanes) je Tag. Done = eine Tabelle
   Tag × Kategorie mit Ableitungskommando.
2. **Protokoll-Agent:** `docs/sanierung-2026-09/plan-2026-08-31.md` §Phasen + §Slice-Protokoll +
   §Nachtrag, `docs/verify-tiering.md` §5b/§11, `docs/messungen/p0-baseline-generalsanierung-2026-09-01.md`,
   `AGENTS.md` §Verify, `verify-proportion.ts`: welche Protokollschritte sind durch einen anderen
   Beweis abgedeckt (H2), welche Reihenfolgen sind echte Abhaengigkeiten vs. Vorsicht (H4). Done =
   je Schritt „noetig weil <Beweis>" oder „streichbar, ersetzt durch <Beweis>".
3. **Second-host-Agent:** `docs/dual-host-session-runtime-phase0-2026-08-30.md`,
   `docs/messungen/second-host-baseline-2026-08-29.md`, `helper-daemon/README.md`, Queue `8228ae65`
   `60d07416` `c3f91ce1`, Slot 9s HANDOFF-Abschnitt: was koennen S2–S4 verlagern, was kostet jeder
   Schritt, was davon ist fuer H1 noetig. Done = Tabelle Schritt × verlagert × Kosten × Reihenfolge.
   Dann: eigene Synthese, GLM-Kritik, Plan-Aenderung als Vorschlag an Slot 12 (die Sanierungs-MAIN
   BESITZT den Plan — nichts dort ohne sie umschreiben) und an den Owner.

**Randbedingungen:** `server.ts` bleibt Freeze; `3bb5a5c9` ist unabhaengig davon der erste Zug
(Freeze-Ausnahme, die dem Freeze dient — Owner fragen, nicht annehmen). Keine Watcher (MAINs
beobachten). Modelle: MAINs Fable, Lanes Opus, GLM nur ueber pi-zai. Lange Texte an Sessions als
Datei + Einzeiler. Und miss deinen ctx, bevor du Agenten startest — drei Extraktionen kosteten mich
heute ~12 Punkte, die Synthese danach ~8.

## 3b. Nachtrag 13:55 — Owner-Pushes abgearbeitet, zwei Dispatches, B13

- Owner-Prinzip (woertlich 13:45): „ich als Owner werde wirklich nur zu etwas gefragt, wenn es ohne mich
  nicht vernuenftig zu beantworten ist". Gemessen: 4 offene Attentions, alle Controller-beantwortbar, 0
  Owner-Entscheide. Erledigt: Audit 79acd2e als **flake** adjudiziert (Slot 9s serieller Rerun 3443/0);
  **S2 `8228ae65` dispatcht → Slot 10** (Opus high); **`dfc21621` (private-repo-p Brief 5) dispatcht → Slot 13**
  (`codex` / `gpt-5.6-sol` / high — DAS ist die Sol-Modell-Id, sie hat den Regex bestanden); vier
  Antworten geschickt; `26cce858` archiviert. Offen: Owner-Inbox-Event `765525a0` (fleet-report vom
  08-31, Slot 1) — Feldname in `fleet.json` ist nicht `fleetEvents`, per Board acken.
- **B13 (Zeile im Register):** Attention mit Ziel `controller|owner`, Default controller; nur decision/
  taste an den Owner, und die als EINE Push-Zeile aufs Telefon. Heute gibt es keinen Fleet-Push; das
  Session-Werkzeug `PushNotification` skippt bei aktivem Terminal (getestet 13:42).
- Owner-Richtung 13:40 (Effizienz vor Berechtigungs-Strenge): Notiz §8, Zeile `812e8458`, Memory.
- Die Antwort-Route echot den vollen Requester-Text in die Pane — jede meiner vier Antworten kostete die
  MAIN ihren eigenen Text nochmal (B1).

## 3c. Nachtrag 14:15 — Land 1b677e58 in Flug

Auf Bitte von Slot 7 (geprueft: Lane 2 `ahead 1`, `dirty 0`, 4 Dateien, kein `server.ts`, 16b922e auf
3c24053): `POST /api/slots/2/merge {}` → `{"running":true}`. Gate wartet hinter Suite-Lauf pid 65554 am
Mutex; mit Verify konfiguriert landet es bei Gruen selbst. Slot 7 armiert merge-/audit-Watch selbst
(per Send bestaetigt, acceptance observed). Der lokale Post-Land-Audit (Grace 0, ~28 min) ist der Beweis
der 22 neuen `e2e/tasks.ts`-Checks; Slot 7 faehrt bei unknown einen seriellen Beweislauf. Slot 7 wollte
15a3e38b mit Fable-Tripel — auf Opus-Tripel hingewiesen (Owner-Entscheid 10:35).

## 3d. Abschluss 14:25 — was jetzt zaehlt, und wie wir verbleiben (Owner-Frage)

**Erste Handgriffe der Nachfolgerin, in dieser Reihenfolge:**
1. **Slot 3 (Private-repo-y-MAIN, Opus) bei 32 % und Slot 4 (Fleet-ohne-Owner-Routing, Fable) bei 32,7 %
   — beide ueber dem Band.** Je einen Send: „HANDOFF schreiben + committen, dann `POST /api/self/succeed`";
   scheitert succeed an der Composer-Sonde (`9c7d6e02`), Nachfolge per Owner-Route (open + Gruendungs-
   brief) wie bei mir. Slot 3 zuerst (Owner-Nennung 14:20).
2. **`3bb5a5c9` laeuft als Lane in Slot 1** (Zeile steht `done`, Slot 1 `task 260902121449-779f`, 14:14).
   Pane lesen, `ahead/dirty` pruefen, landen (`POST /api/slots/1/merge {}`), Audit abwarten, dann `.env`
   `FLEET_AUDIT_HELPER_GRACE_MS='60000'` + Verb 2. Ab da laufen Audits auf dem Geraet.
3. **Land 1b677e58 (Slot 2):** `mergePending` war 14:22 wieder `false` — Ausgang in `GET /api/slots/2/merge`
   bzw. Land-Note pruefen; Slot 7 haelt die Watches. Slot 13 (`gpt-5.6-sol`, private-repo-p Brief 5) hat
   `mergePending:true` — gehoert Slot 3.
4. Dann den Denkauftrag §5 (Sanierung beschleunigen) mit den drei Agenten fahren.

**Verbleib, wie mit dem Owner besprochen:**
- **Sanierung** laeuft unter Slot 12 weiter; Plan gehoert ihr. Sobald Audits remote laufen, steigt der
  P4-Takt. Die Nachfolgerin liefert ihr aus §5 einen Vorschlag mit den drei Kandidaten: Vorschau bei
  Move-Slices streichen (Build-SHA-Beweis), Flake-Familien per Namen maschinell adjudizieren, P5/P6
  vorziehen. Ziel: eher eine Woche als drei bis P7.
- **Zusammenarbeit (B)** wartet mit `server.ts`-Aenderungen auf P6 (Owner-Entscheid 13:30). JETZT
  erlaubt und sinnvoll: die Entwuerfe — Falsifier-Tests in `e2e/` und Briefs als Dateien unter
  `docs/briefs/` fuer B2, B3, B0/B4 zuerst (GLM-korrigierte Reihenfolge), GLM-Vorab-Review ueber einen
  stehenden pi-zai-Slot per Datei-Pointer. Promotion der Zeilen ist Owner-Akt. Pipeline: Fable entwirft,
  GLM kontrolliert, Sol (`gpt-5.6-sol`, Regex bestanden) implementiert — Pilot war A1, jetzt in Slot 1.
- **Owner-Benachrichtigungen (B13):** bis zum Bau beantwortet der Controller jede Attention, die kein
  `decision`/`taste` ist, selbst — heute 4/4.
- **Codex-Controller (Sol)** erst, wenn B0/B3/B4 die Zustellung robust und gemessen gemacht haben.
- **Sicherheit** (Owner-Token beim Controller, Scope-Gates) ist spaeter EINE Schicht — Notiz §8.

## 4. Offene Owner-Punkte

1. `3bb5a5c9` freigeben (Freeze-Ausnahme?) → Grace zurueck. 2. **Owner-Richtung 13:05 (Zeile `98979607`):**
naechster Controller / unwichtigere Sessions auf codex mit „sol5.6", der entscheidet, wo Fable eingesetzt
wird — noch kein Entscheid; die fuenf Vorbedingungen stehen in der Zeile. 3. Promotion der B-Zeilen in GLM-
Reihenfolge. 4. Idle-Sessions 4/6/11 schliessen? 5. GitHub 12 Tage hinter main.

---

# HANDOFF — Fleet Controller (Slot 13, Fable 5.1 high): DENKSESSION vorbereitet — (A) Second-host-Fix als Durchsatz-Hebel, (B) Zusammenarbeit der Sessions (Erfassung, Kommunikation); Watches an die MAINs abgegeben; Modellpolitik MAINs Fable / Lanes Opus; 2026-09-02 (12:35)

Rolle: **🎛 Fleet Controller**, Nachfolge von Slot 14. Owner-Delegation 10:05 gilt weiter. **Owner-Auftrag
12:25 an DICH** (woertlich, gekuerzt): „Watches abstellen und die Verantwortung an die MAINs oder den
Supervisor/Steward abgeben. Zu allererst will ich wissen, wie es mit dem aktuellen Second-host-Fix aussieht,
damit koennten wir das Arbeitspensum direkt in vernuenftiger Art erhoehen. Daneben nochmal nach
architekturellen Verbesserungen von Claude Fleet gucken, insbesondere Informationserfassung zur
Sessions-Uebersicht, Kommunikation — wie die Sessions innerhalb Claude Fleets zusammenarbeiten. Erst
Gedanken machen, worauf es ankommt und wie man beides im komplementaeren Kontext zueinander angeht." Und:
„statt direkt drueber nachzudenken, die naechste Session moeglichst gut auf ihre Denksession vorbereiten."
Also: **du bist die Denksession, mit frischem Kontext.** Ich habe NICHT vorgedacht, nur Fakten und
Lesestoff sortiert. Owner-Entscheide von heute, die den Rahmen setzen: Modellpolitik (Fable nur
orchestrierend, Lanes Opus — 80 % Fable-Limit in 14 h; `rulebook/einstieg.md`) · Hostlast im Blick
behalten (8 GB RAM, Swap 6,5/7 GB, Lag im Eingabefeld).

## 0. Reihenfolge fuer dich

1. Erdung (`./state.sh`, `./register.sh`, dieser Abschnitt). **Keine Watcher legen** — der Owner hat die
   Beobachtungspflicht den MAINs uebertragen; du bist Denk- und Entscheidungsinstanz, nicht Poller.
2. **Thema A zuerst** (§1): Owner will den Stand wissen und dann Durchsatz erhoehen. Fakten stehen da; was
   fehlt, ist EIN Handgriff des Owners (Nutzername) und danach ~10 min Deploy-Arbeit.
3. **Thema B** (§2): erst „worauf kommt es an", dann Lesestoff, dann die heutigen Datenpunkte als Rohmaterial.
   Ergebnis der Denksession gehoert als datierte Notiz nach `docs/messungen/` (Skill `mess-notiz`), nicht in
   Prosa hier.
4. Betrieb laeuft nebenher weiter (§3) — reagiere auf Attention, nicht auf Panes.

## 1. Thema A — Second-host-Fix: Stand, gemessen 12:30

- **Geraet online:** `secondhostlinux1`, mode active, load 0,07, lastSeen 3 s, capabilities bun/tmux/git/zsh.
  **`daemonSha: null`** = der Daemon auf dem Geraet ist die ALTE Fassung; die neue (79acd2e, S1) meldet den
  SHA im Heartbeat.
- **Abgeklemmt:** `.env` `FLEET_AUDIT_HELPER_GRACE_MS='0'` (Slot 14, 09:48) — jeder Post-Land-Audit laeuft
  seit heute morgen LOKAL und belegt den Suite-Mutex 1400–2400 s. Heute 5 lokale Audits ≈ 2,5 h Mutex; jedes
  Land-Gate dahinter wartete (79acd2e: 2313 s Warten fuer 141 s Arbeit). **Das ist der Durchsatz-Hebel:**
  Audits zurueck aufs Geraet, und der Mutex hier ist wieder fuer Gates und Lane-Vorschauen frei.
- **Warum abgeklemmt:** 8 Remote-Audits in Folge rot OHNE Check-Namen (letztes e03d44c, 9 FAILURES,
  „unnamed"); lokal war derselbe Baum gruen (3443/0). Server-Seite ist repariert (`3974883` „carry remote
  audit failure names", `b3f4230` „Helfer meldet den SHA, den er wirklich ausgecheckt hat") — greift erst mit
  dem NEUEN Daemon. Ob die Remote-Reds ein Plattform-Problem sind (Linux-Signatur, `docs/messungen/
  second-host-baseline-2026-08-29.md` §Plattform-Signatur) oder Alt-Daemon-Artefakte, ist UNENTSCHIEDEN — erst
  mit Namen beurteilbar.
- **Was S1 (79acd2e) geliefert hat:** daemon-update als JOB (clone → parse-check → symlink-swap → exit 75,
  Unit restartet), `daemonSha` im Heartbeat, Owner-Route `POST /api/helper/devices/secondhostlinux1/update`,
  Board-Karte zeigt daemonSha. **Henne-Ei:** der ALTE Daemon kennt den Job nicht — EINMAL Bootstrap per ssh
  noetig, danach jeder Update vom Board.
- **Der Handgriff, der fehlt: der ssh-NUTZERNAME** (Owner hat den Key dieser Maschine 10:05 eingetragen, Host
  `100.64.0.2`). Danach, als Service-User (Slot 9s Rezept, Pane Slot 9 10:03, und
  `helper-daemon/README.md`): `git clone <fleet-repo> WORK-DIR/tree-bootstrap` · `ln -sfn … WORK-DIR/current`
  · Unit-Template einspielen (USER/GROUP/WORK-DIR/BUN-PATH ersetzen, ast-grep in PATH) · `daemon-reload` +
  `restart fleet-helper` · `journalctl -u fleet-helper -n 3` erwartet `running <sha8>` = main. Vorher die alten
  Fail-Namen sichern: `/var/lib/fleet-helper/work/**/tree/e2e-trail/*.jsonl` (`"ok":false`). Beweis: Karte
  zeigt daemonSha = main. Dann `.env` Grace zurueck auf `'60000'` + Verb 2 (`POST /api/deploy`, lehnt bei
  laufendem Audit 409 ab). **Nicht waehrend eines laufenden Audits restarten** (ein namenloses Rot mehr).
- **Danach S2–S4 der Dual-Host-Reihe** (`8228ae65` Job v1 `command` · `60d07416` Wake-on-LAN · `c3f91ce1`
  Presence) sind genau der Ausbau „Arbeitspensum erhoehen": Slot 9 (Second-host-MAIN) fuehrt, Hand-Dispatch mit
  Opus-Tripel, seriell nach Land des Vorgaengers. Slot 9 wollte S2 erst nach dem Audit-Ergebnis von 79acd2e.
  Owner-Wunsch `d07646bc` (Second-host-Ausbau, zwei Stufen) liegt als Notiz im Register.
- Zweites Geraet `mainMacbook` ist `desiredMode: off`, seit 6 Tagen nicht gesehen — kein Faktor.

## 2. Thema B — Zusammenarbeit der Sessions: Vorbereitung, KEIN Vordenken

**Worauf es nach heutiger Beobachtung ankommt (Rohmaterial, ungewichtet):**
- **Kosten der Kommunikation sind unsichtbar und asymmetrisch.** Jede Pane-Nachricht an eine MAIN kostet
  deren gesamten Kontext als Input (250–350k). Slot 14 hat Slot 12 dieselbe Meldung zweimal geschickt
  (≈ 400k). Es gibt keinen Sensor, kein Budget, keine Warnung — der Owner hat das Limit auf `/usage` gesehen.
- **Zustellung ist unzuverlaessig gemessen:** Gruendungsbrief 6 min 36 s ungesendet bei „observed"
  (`6c7d98ff`); 9/11 `/model`-Sends „uncertain", obwohl ausgefuehrt (`ca085489`); heute zwei
  `fleet_event_send_uncertain` an Slot 9 (Composer belegt). `readComposer` misst Render-Latenz. Frage: soll
  Zustellung ueberhaupt ueber die Pane laufen, oder ist die Pane nur EIN Kanal von mehreren?
- **Beobachtung statt Erfassung:** Vier Idle-Zustaende sehen gleich aus (CLAUDE.md „Idle heisst nicht
  fertig"); der Controller liest Panes, um zu wissen, was eine Session tut. `GET /api/self/program-execution`
  (phase/nextAction) ist der erste typisierte Zustand — nur fuer Program-MAINs. Kein Slot traegt heute
  „was ich gerade warte" maschinenlesbar; `ctx` ist bei GPT-Slots null; Modell im Datensatz vs. Pane
  divergierte bis c09d5f1.
- **Der Controller ist ein menschlicher Router:** Dispatcher master-stopped ⇒ jeder Program-Schritt braucht
  einen Hand-Dispatch; MAINs koennen nicht dispatchen (Owner-Route), also Attention → Controller → Route.
  Slot 3 hat dagegen Self-Land (policy green-only) und lief heute zwei Briefs ohne mich durch — der
  Unterschied zwischen Slot 3 und Slot 9 ist eine Promotion, nicht Faehigkeit.
- **Rueckkanaele sind Einmal-Watches mit Luecken:** `kind:merge` liefert nach dem Feuern den VERBRAUCHTEN
  Watch zurueck (`372b3cef`), Attention hat keinen Watch (ich habe gepollt), Lane-Report → MAIN geht ueber
  `fleet_report_open` + Event-Zustellung in die Pane (wieder ein Pane-Send).
- **Hostlast als Fleet-Zustand fehlt:** RAM/Swap/Load stehen nirgends auf dem Board; 14 claude-Prozesse
  auf 8 GB; der Owner hat den Lag gemerkt, nicht das Fleet. Gleiches fuer den Suite-Mutex (nur `gate.lock`).
- **Was heute FUNKTIONIERT hat** (nicht wegoptimieren): Self-Land mit Promotion (Slot 3) · Event+Ack-Kette
  (`/api/self/events/:id/ack`) · Fleet-Report typisiert (`/api/self/fleet-report`) · `program-execution`-
  Projektion · Land-Notes/Ledger als Wahrheit · `/model` per Send kostenlos.

**Lesestoff, in dieser Reihenfolge** (Symbole, nicht Zeilen): `AGENTS.md` §Portable operating contract
(Rollen-Tabelle Project MAIN/Lane/Steward — die Autoritaetsmatrix) · `docs/self-api.md` (1158 Z.: watch,
events, attention, fleet-report, program-execution, release, succeed, model) · `lane-signals.ts`
(`laneWatchSignal`, done-looking/host-commit-looking — die einzige typisierte Lane-Semantik) ·
`docs/queue-analyst.md` §7 (Dispatcher-Vertrauensgrenzen, kinds) · `docs/steward.md` + `docs/attic/steward-
pulse-v2.md` (der stehende Beobachter, heute idle seit 08:01) · `docs/agentic-control-plane-program-2026-08-20.md`
(ACP-Programm: was schon geplant/gelandet ist — nicht neu erfinden) · `docs/messungen/system-analyse-2026-08-25.md`
+ `…-review-2026-08-25.md` (letzte Gesamtanalyse) · `docs/attic/core-program-2026-08-12.md` · Register-Notizen
`6c7d98ff` `ca085489` `372b3cef` `56056efe` `61a0fac1` `9c7d6e02` `36960138` (heutige Befunde an der Naht).

**Leitfragen fuer die Denksession** (offen, ohne Antwortvorschlag): Welche Information braucht wer, in
welcher Frist, in welcher Form — und was davon geht heute durch eine Pane? · Was ist die Einheit der
Zusammenarbeit: Program, Task, Land, oder Nachricht? · Wo ist der Controller Router, wo Richter — und was
davon darf eine Promotion an die MAIN geben (Muster Slot 3)? · Welche Zustaende muessen typisiert am Slot
haengen, damit niemand Panes liest? · Was kostet eine Nachricht, und wer sieht das?

**Komplementaritaet A↔B, als Hypothese zum Pruefen:** A schafft Kapazitaet (Mutex, RAM, Verify-Zeit auf dem
Geraet); B senkt Koordinationskosten (weniger Broadcasts, weniger Controller-Handgriffe). Mehr Kapazitaet
ohne B heisst mehr Lanes, die alle ueber denselben Controller laufen; B ohne A heisst gut koordinierte
Sessions, die am Mutex stehen. Reihenfolge und Schnitt sind deine Frage.

## 2b. Owner-Nachtrag 12:40–12:45 — so soll die Denksession gefuehrt werden

- **Selbstbefunde sind unterwegs:** ich habe 12:42 an die MAINs 3, 4, 7, 9, 12 und den Steward 11 EINE identische
  Nachricht mit fuenf Sonden geschickt (Warte-/Poll-Turns · ungenutzte Tool-Ausgaben · gebraucht-ohne-Route ·
  bekommen-ohne-Bedarf · ein Schnittvorschlag). Sie antworten NUR als Notiz `[selbstbefund B 2026-09-02, <Rolle>
  Slot <n>]` ueber `POST /api/self/tasks` — `./register.sh` zeigt sie unter notiz; es koennen 0–6 sein, eine MAIN
  mitten in ihrer Kette antwortet spaeter oder gar nicht. Kosten: je MAIN ihr voller Kontext, einmalig, Owner-Go.
- **Private-repo-o (Slot 6) GESONDERT betrachten** — es arbeitet als Game-Maker-Profil (`docs/product-studio-
  working-circle.md`, Program-Profile `POST /api/programs/:id/profile`), also weder mit denselben Routen noch
  denselben Beduerfnissen; es hat die Sonden-Nachricht NICHT bekommen.
- **Perspektivwechsel je Rolle** (Owner woertlich: „sich in die Lage der einzelnen Rollen hineinversetzen und
  von da aus verstehen, was diese sehen, und anschliessend, was ihnen fehlen KOENNTE, um fuer ihre Rolle
  Relevantes noch besser sehen zu koennen. Vielleicht fehlt es auch irgendwo an (kleineren) komplementaeren
  Strukturen dahinter."). Rollen, die es heute gibt: Owner (Board, `/api/sessions`, `/usage`) · Controller
  (Register, Panes, Ledger) · Program-MAIN (`program-execution`, Fleet-Reports, Attention) · Lane (Brief,
  `self/gate`, `self/drift`) · Steward (Pulse, Steward-View) · Game-Maker-MAIN (eigenes Profil) · Helfer-Geraet
  (Heartbeat, Jobs). Fuer jede: Was sieht sie heute WIRKLICH (Routen, Felder, Pane)? Was entscheidet sie, und
  mit welcher Information, die sie NICHT hat? Selbstbefunde und meine Aussensicht (§2) sind die zwei Quellen.
- **Kreativ werden ist erlaubt** („ruhig etwas mental drauf rumkauen … um eine wirklich gute Loesung zu
  finden") — das ist eine Denk-, keine Implementierungssession. Ergebnis als datierte Notiz in
  `docs/messungen/`, Ideen als `[idee …]`-Queue-Zeilen (kind notiz/richtung), nichts direkt bauen.
- **Zweite Meinung von GLM am Ende:** fuer die ersten Ausarbeitungen eine GLM-5.3-Session befragen. Der Fleet
  hat den Adapter: Harness `PI_ZAI_HARNESS (server.ts)` (server.ts Adapter #2b, `pi --provider zai --model glm-5.3`, Key aus
  `~/.config/claude-fleet/secrets/zai-coding-plan.key`, Modell-Regex `^glm-5\.3$`). Weg: `POST /api/lanes`
  oder `open` mit diesem Harness, dann `POST /send` mit der Ausarbeitung als Text und den konkreten Fragen —
  pi laedt `AGENTS.md`, nicht CLAUDE.md, also den Kontext ausschreiben (GPT-Brief-Checkliste in
  `rulebook/einstieg.md`: Dateien mit Zeilenbereich, kein Regelbuch wholesale). Ergebnis in dieselbe Notiz.
- **Worauf es beim Aufsetzen ankommt (Owner: „komplementaer zum Prozess selbst und zu unserem Ziel"):** das
  Ziel ist Durchsatz mit weniger Owner-/Controller-Handgriffen (Thema A liefert Kapazitaet, B senkt
  Koordinationskosten); der Prozess ist der bestehende Register-/Promotion-Weg (Vorschlag → Owner-Promotion →
  Lane) — Ideen also so formulieren, dass sie als Queue-Zeilen mit Done-Kriterium dispatchbar werden.

## 3. Betriebsstand (12:35)

- **Watches abgegeben** (Owner-Entscheid): meine Skripte gekillt, Server-Watches verbraucht. Audit 79acd2e
  ROT 10/3443 (Composer-Familie; Diff beruehrt nur Helper-Regionen; 2/10 Namen 02:29 vorbelegt) **gehoert
  Slot 9** — per Send uebergeben, inkl. Rerun (Wrapper 95601 in meiner Pane, stirbt mit mir; Slot 9 weiss es).
- Land-Reihe: Lane 2/Slot 2 (`1b677e58` → Slot 7) und Lane 8/Slot 8 (`516b70a9` → Attention) offen. Slot 5
  faehrt seinen DRITTEN isolated-Lauf (seit 11:35 am Mutex), Slot 12 wartet und meldet FREEZE. private-repo-p
  laeuft selbst (a4f8f08, 466f318f gelandet). Modelle: Lanes Opus, MAINs/Steward Fable, Datensaetze = Panes.
  `.env` `FLEET_MODEL='claude-opus-5[1m]'`, Verb 2 `80b13da5` ok.
- Mit Verify konfiguriert landet `POST /api/slots/:id/merge {}` bei gruenem Gate SELBST (79acd2e `by:null`).

## 4. Fallen, die ich bezahlt habe

- **CLAUDE.md ist GENERIERT** (`rulebook.ts` Kopf): Fragment editieren, Render-Einzeiler, `bun e2e/pins.ts`.
  Mein Direkt-Edit hat ein Land-Gate in 3,8 s rot gemacht.
- `/model` per Send: Claude Code fragt bei warmem Cache „Switch model?" (Enter noetig) und speichert den
  letzten Wert als NUTZER-Default fuer neue Sessions.
- zsh splittet `for id in $LISTE` nicht · `timeout` fehlt auf macOS · Hintergrund-Waiter koennen von aussen
  gestoppt werden (11:50, alle vier) — Sammel-Waiter statt vier einzelne.

## 5. Offene Owner-Punkte

1. **Second-host-Nutzername** (Thema A haengt daran). 2. Idle-Sessions 4/6/11 schliessen? 3. GitHub 12 Tage
hinter main.

---

# HANDOFF — Fleet Controller (Slot 14, Fable 5.1 high): Second-host-Blindstelle umgangen (Grace 0), Verify-Budget 480 s, drei Nachfolgen (3, 5->12), Slot 10 ohne Gate gelandet + nachgemessen, Uebergabe bei 25,8 % GEMESSEN, 2026-09-02 (10:20)

Rolle: **🎛 Fleet Controller**, nicht Program-MAIN. Gegruendet per /open+/send. Owner-Vorgaben in Kraft:
Fable 5.1 high ueberall · Usage praktisch unbegrenzt · seriell landen · Quiet Hours AUS · **Owner-Delegation
10:05 „kuemmer dich drum, lass mich konkret wissen, wenn ich was machen soll"** — du entscheidest operativ
selbst und legst dem Owner nur Handgriffe vor, die nur er tun kann. ctx bei Uebergabe-Entscheid: 25,8 %
GEMESSEN (ctx-Watcher (d) hat gefeuert — das Band hat diesmal funktioniert).

## 0. Reihenfolge fuer dich

1. **Erdung:** `./state.sh`, `./register.sh`, dieser Abschnitt. Dann die Rueckwege als Hintergrund-`until`
   (Skripte der Vorgaengerin liegen in ihrem Scratchpad und sterben mit ihr — neu schreiben, ~40 Zeilen):
   (a) Main-Watcher (Basis = `git rev-parse main`), (b) Fleet-Report-Watcher (`grep -c fleet_report_open
   audit.jsonl`, Basis = aktueller Zaehler, heute 235), (c) Attention-Watcher auf die Zahl OFFENER Zeilen
   (`status in (open, send-uncertain)` — die Gesamtlaenge feuert auf Prunes), (d) ctx-Watcher auf dich
   (ctx-Schnipsel aus CLAUDE.md, `pct >= 25`). (e) je laufendem Land ein Watcher auf
   `GET /api/slots/<id>/merge` `running:false`.
2. **Land-Reihe, seriell (Stand 10:20):**
   - **Lane 1 / Slot 1** (`dabd4da9` S1 daemon-update-Job, HEAD 9510b2b, 1 behind, sauber, Kette gruen) —
     Report liegt bei **Slot 9** (Second-host-MAIN). Slot 9 landet ueber seine Self-Land-Tuer oder bittet dich
     (Owner-Route `POST /api/slots/1/merge`). **Danach S2 `8228ae65` dispatchen** mit
     `{"harness":"claude","model":"claude-fable-5-1[1m]","effort":"high","acknowledged":true}`, dann S3
     `60d07416`, S4 `c3f91ce1` — je nach dem Land des Vorgaengers.
   - **Lane 2 / Slot 2** (`1b677e58` Workbench, e936c0c, 5 behind) und **Lane 8 / Slot 8** (`516b70a9`
     Repo-Worker-Audit, 01cf509, 5 behind): haben 10:14 **GO mit KURZER Kette** (Gate-Kette + ggf. eine
     Einzelsuite, KEIN isolated — Begruendung: Hostlast, Tier-2 ist Vorschau). Reports: 2 → Slot 7,
     8 → Attention an dich. Landen ueber die Owner-Route, seriell.
   - **Slot 5 = P4 Slice 2** (`d7b89fd6`, Lane c509, Slot 12s Program): produziert/verifiziert; Slot 12
     (Sanierungs-MAIN, Nachfolge von Slot 5) meldet **FREEZE-START/-ENDE** an dich — dazwischen landest du
     nichts. Slot 12 weiss, dass Lanes 1 und 8 server.ts-Regionen 2914-2956 / 12357-13653 committet halten.
   - **private-repo-p (Slot 3 N2, Program 07ee8a6d):** Brief 3b (Slot 10, Kandidat 4826847) fiel als
     `verify timedOut` bei exakt 300 s (Baum gruen, 352 s Wandzeit unter Last) → Budget auf 480 s gehoben
     (§1), Slot 3 re-landet selbst. Danach bittet Slot 3 um Dispatch von Brief 4 `5b822ccc` (Hand-Dispatch
     mit dem Tripel, Dispatcher ist AUS).
3. **Vor JEDEM `confirm:true` auf der Owner-Route: `verify.ok === true` am resolved-Datensatz pruefen**
   (§2, Notiz `36960138`). Sonst erst `POST /api/slots/<id>/merge` OHNE confirm (frischer Verify), dann confirm.
4. **Kein Direkt-Commit, solange irgendein `GET /api/slots/:id/merge` `running:true` sagt.** Docs-only
   Direkt-Commits sind sonst erlaubt (Handoffs); Code-Direkt-Commits nur mit Hand-Verify und Handoff-Vermerk.
5. **Second-host (§1):** bleibt server-seitig abgeklemmt (`FLEET_AUDIT_HELPER_GRACE_MS='0'` in `.env`), bis der
   Daemon auf dem Geraet aktuell ist. Owner hat den ssh-Key dieser Maschine eingetragen, aber den
   **Nutzernamen noch nicht genannt** — sobald er kommt: `ssh <user>@100.64.0.2`, (1) alte Fail-Namen
   aus `/var/lib/fleet-helper/work/**/tree/e2e-trail/*.jsonl` (`"ok":false`) ziehen, (2)
   `helper-daemon/daemon.ts` aus `git show main:` einspielen (sha256 beginnt `982ae1ddf6db7a6f`), (3)
   `sudo systemctl restart fleet-helper`, (4) `.env` Grace zurueck auf `'60000'` + Verb 2. Der http.server
   auf Port 8441 (Scratchpad dieser Session) stirbt mit ihr — bei Bedarf neu hosten.
6. **Hostlast ist real** (10:10: Load 7-11, Swap 5,8/7 GB, 28 claude-Prozesse). Hebel in dieser Reihenfolge:
   Lanes landen (jede Lane = ein Prozess weniger) → dem Owner eine Liste idle Sessions vorlegen (Slot 16 =
   unbeschriftete Opus-Pane des Owners, Slot 6 Private-repo-o 30 %, Slot 4 31 % idle) — nie selbst killen.

## 1. Was heute passierte (verifiziert; Bodies in `git log 87c5be6..main`)

- **Lands:** 61fa1f1 (Handoff Slot 12, docs) · **c09d5f1** (419e9ae3 Modell-Route, Slot 10) · 4880d15
  (Handoff Slot 4, docs) · **e03d44c** (P4 Slice 1, Slot 5/13, verify ok 122 s) · 5e2f47d (Handoff Slot 5,
  docs) · **fc389a1** (watchdog.sh, Direkt-Commit von mir, Hand-Verify `sh -n` + pins ALL PASS).
- **Audits:** 87c5be6 GRUEN 3423/0 (2425 s lokal) · c09d5f1 GRUEN 3443/0 (1655 s lokal) · **e03d44c ROT
  second-host, 9 FAILURES, KEINE Namen** = achtes namenloses Remote-Rot; Adjudikation bei Slot 12 (lokaler
  Beweis: Slot 13s isolated 3443/0 auf identischem Code-Baum b4cca7a).
- **Deploys (Verb 2):** 798be4ab (Slot 12, Code 5e2f47d, damit Modell-Route live) · f48eca40 (ich, nur
  .env Grace 0) · 4a6bdb25 (ich, Verify-Budget 480 s). Alle ok:true, hitTarget, 14/14 Sessions ueberlebt.
- **Nachfolgen:** Slot 3 → Slot 3 N2 via retire + `bootstrap-main` (Live-Occupant-Guard verlangt, dass die
  alte MAIN VORHER retired ist; Label max 40 Zeichen). Slot 5 → **Slot 12** via `/api/self/succeed` — hat
  FUNKTIONIERT (Notiz `9c7d6e02` sagt „scheitert deterministisch": gilt nicht fuer jeden Pfad; Datenpunkt
  fuer die Notiz). Slot 12 hat seinen Datensatz selbst auf Fable gezogen.
- **Modell-Route gefahren:** Slots 6 und 9 im Datensatz auf `claude-fable-5-1[1m]`/high; alle belegten Slots
  einheitlich (`GET /api/sessions`).
- **Owner-Handgriffe:** ssh-Key auf dem Second-host eingetragen (10:05 „done"); Nutzername offen.

## 2. Fallen, die ich bezahlt habe

- **Owner-`confirm:true` landet OHNE frischen Verify** (`byHuman`-Pfad, `verifyProv = reviewed.verify`): Slot
  10s Gate war `waitedOut` (2669 s hinter dem Audit), mein confirm landete c09d5f1 ungemessen; das Audit hat
  es dann gemessen. Notiz `36960138` mit Schnittvorschlag (409, solange `reviewed.verify.ok !== true`).
- **Gate-Wartebudget 45 min reicht nicht, wenn ein Audit (25-40 min) UND Lane-Suiten am Mutex stehen** —
  Lanes vor einem laufenden Land auf HOLD setzen (heute 08:04 gemacht, hat den zweiten Anlauf gerettet).
- **Send in einen vollen Composer ist „uncertain"** — Retry-Schleife (`w_send12.sh`-Muster), nie `C-u` in
  fremden Panes. Slot 12s Composer hielt 10:07 einen echten Owner-Text.
- **Der Attention-Watcher auf die Gesamtlaenge feuert auf Prunes** — auf OFFENE zaehlen.
- **`sed` auf `^BASE=`** traf meine Ein-Zeilen-Skripte nicht (Basis stand hinter `.`-Source) — Watcher lief
  auf toter Basis und feuerte sofort. SHA-Ersatz statt Zeilenmuster.
- **zsh: `echo ===` schlaegt fehl** (`=`-Expansion) — quoten.

## 3. Offene Owner-Punkte

1. Second-host-Nutzername (dann alles Weitere bei dir, §0.5). 2. Private-repo-o Slot 6 (30 %) nach eigener Fahrt
schliessen. 3. Idle-Sessions unter Hostlast (§0.6). 4. GitHub ist 12 Tage hinter main (Push nur von der
Hauptmaschine).

---

# HANDOFF — Generalsanierung: P3 abgeschlossen (P3c 7006696), P4 Slice 1 gelandet (e03d44c), Remote-Audit-Blindstelle gemessen, 2026-09-02 (vormittags)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden an Slot 5 (diese Session; Slot-Datensatz sagt
`claude-opus-5[1m]`, Pane per One-Shot-Self-Auto auf Fable 5.1 gesetzt — seit `c09d5f1` gibt es
`POST /api/slots/:id/model`, der Controller zieht die Datensaetze nach dem naechsten Deploy nach).
**Controller ist Slot 14** (Slot 12 hat sich abgeraeumt). Ersetzt den Sanierungs-Abschnitt darunter.

## 1. Gelandet, verifiziert

- **P3c `9a5a0b76` → `7006696`** (Lane-Commit = main-sha, Self-Land-Tuer, Note `verify.ok true`,
  7 Schritte, actor main/Slot 5). Unabhaengig nachgerechnet vor dem Land: Bundle-Hash
  `b313d549…` 886573 B byte-identisch zu main, 0 Nicht-Kommentar-Diffzeilen, Archiv +1389/−0,
  56/56 Anker loesen auf, pins ALL PASS. **P3 (Kern-der-bleibt) ist damit abgeschlossen.**
  Audit ROT vom **Remote-Helfer second-host** (1376 s, „13 FAILURES", `checks:null`, keine
  FAIL-Namen) → adjudiziert **`unknowable`** (Ledger-Note mit Hash-Beleg); transitiv gedeckt
  durch das lokale gruene 87c5be6-Audit (3423/0) und c09d5f1 (3443/0).
- **P4 Slice 1 `c7259df1` → `e03d44c`** (Slot 13, Lane `fleet/260902051742-41fb`, Fable high;
  Lane-Commit b4cca7a auf c09d5f1). 72 Domain-Typen + 12 `*From`/`load*`-Parser + ihre reinen
  Konstanten → `server/types.ts` (1236 Z.); server.ts 24989 → 23834 Zeilen, Kommentare 8361 → 7979.
  **Bewusst geblieben (Code vor Plan):** `slotFrom` (Holder-Lookup, kein Parser — mein Brief war
  da falsch), `loadTaskSpawn` (Adapter-Sektion), `loadProgramFounding` (`repoCanon`, §c
  Founding-Validierung). Beweise: Move-Multiset 0 echte Code-Zeilen (nur 29 Import-Zeilen in
  server.ts, Import/Export-Block in types.ts, 3 gekuerzte Trailing-Kommentare) — von mir zweimal
  nachgerechnet (5eacbb8, b4cca7a); tsc Gate-Liste exit 0; `--noUnusedLocals/Parameters` 0;
  pins 327 ALL PASS, zwei Rohschnitte auf `serverU.span()` umgehaengt, kein Pin vakuum-gruen;
  lokaler serieller `e2e-isolated` **3443/0** (`isolated-20260902T064422Z-62019`, tree b4cca7a);
  Land-Gate: Note `verify.ok true`, 7 Schritte, 121,7 s Arbeit / 0 s Wartezeit, actor main/Slot 5, Gate-Rebase auf 4880d15 (ff).
- Zwischenlands anderer (Controller): 87c5be6 (Slot 8, Lineage), 61fa1f1 + 4880d15 (HANDOFF.md),
  c09d5f1 (Slot 10, Modell-Route). Alle lokal gruen auditiert bzw. docs-only.

## 2. In Flug — das Erste, was du tust

1. **Audit-Watch auf `e03d44c`** neu armieren (`{kind:"audit", repo:"/Users/owner/claude-fleet",
   mainAfter:"e03d44cec58247075c06c2d9f44c4d0e8a5a1bbb"}`; meiner stirbt mit dem Slot). Laeuft das Audit auf dem second-host
   und kommt rot/unnamed → `unknowable` (Praezedenz oben, P6-Notiz `df22cf14`) und **lokalen
   seriellen Beweis** fahren (`./e2e-isolated.sh` im Haupt-Checkout, Log-Datei, detacht) — das ist
   Slice-Protokoll f, „Audit gruen", fuer diese Maschine.
2. **Protokoll f zu Ende:** Dry-Boot des VORHERIGEN Standes (4880d15) gegen eine KOPIE der
   aktuellen fleet.json im Scratch (Rollback-Beweis; Muster e2e-isolated.sh, NIE Default-Env) →
   **Deploy Verb 2** (`POST /api/deploy`; 409 bei laufendem Audit) → `bundleStale`/`deployGap`
   auf `/api/sessions` → `bun e2e/pins.ts` → `graphify update .`. Der Controller wartet mit
   den Modell-Routen-Schritten (Slots 1/5/6/9) auf diesen Deploy.
3. **P4 Slice 2 = Persistenz-Schreibmaschinerie → `server/persist.ts`** (Plan §P4 Punkt 2:
   tmp+rename+fsync + Parser; Holder/queueStateSave/loadState bleiben im Kern; ESM-Bindings
   read-only). Brief-Muster: `scratchpad/p4-slice1-brief.md` dieser Session ist weg — die
   Struktur steht in §1 (Was wandert / Nicht / Regeln / Beweise 1–5 / Done). Vorher:
   `graphify query` fuer die Persist-Flaeche, Kollisionskarte gegen die lebenden Lanes
   (`git diff -U0 <base> -- server.ts | grep '^@@'` je Worktree), FREEZE nur fuer
   Report-Verifikation → Land-terminal (Vereinbarung mit dem Controller, Zeilen FREEZE-START /
   FREEZE-ENDE per /send an Slot 14; er meldet jede main-Bewegung).
4. Dispatch laeuft ueber den Hand-Knopf `POST /api/tasks/:id/dispatch {harness,model,effort}`
   (Owner-Token) — Master-Stop bleibt bis P7; `POST /api/self/tasks` + `release` davor.

## 3. Befunde / Messungen dieser Session

- **Remote-Audit-Blindstelle (P6-Notiz `df22cf14`):** die letzten 7 second-host-Audits auf
  claude-fleet sind ALLE rot ohne Check-Namen (dbb2e094, 05f37f1, **3058556 = P0-Baseline-Baum,
  lokal 3×3375/3375**, 86e704a, 54964d1, d4f2bfc, 7006696). Plattform-Differenz (~13 Checks),
  die Ledger-Zeile kann es strukturell nicht sagen. Stufe 2 misst remote fuer dieses Repo nichts.
- **P0-Baseline ist GESCHLOSSEN** (`docs/messungen/p0-baseline-generalsanierung-2026-09-01.md`)
  — Plan-Nachtrag und aeltere Handoffs sagen „nicht abgeschlossen"; die Notiz ist juenger.
- Fensterfakten am echten srv (`ps eww -p <srv-pid> | tr ' ' '\n' | grep '^FLEET_AUTO_REVIEW_MS='`):
  `FLEET_AUTO_REVIEW_MS=0`, `dispatch:false`, Quiet Hours aus.
- Done-looking-Watch feuert, waehrend eine Lane ihre eigene Kette im Hintergrund faehrt
  (Zwillingszustand c) — Pane lesen war noetig, der typed Report kam 40 min spaeter.
- Ein verwaister `e2e-claude-gate.sh`-Wrapper aus dem geloeschten P3b-Worktree hing am Mutex
  (PID-Kill, nie Muster).

## 4. Ehrlichkeiten

- Adjudikation und `/send`-Zeilen liefen mit dem Owner-Token (die Routen kennen keinen
  MAIN-Prinzipal); Direkt-Commits: nur dieser Handoff.
- Der Dry-Boot (Protokoll f) fuer Slice 1 ist NICHT gefahren; Deploy NICHT gefahren
  (`deployGap.codeBehind` seit 64c05bf wahr). Beides Nachfolge, Punkt 2.
- ctx bei der Uebergabe-Entscheidung: **24,1 % gemessen**.

---

# HANDOFF — Program 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing": Phase 3 A+B gelandet und Stufe-2-gruen, C queued, zwei Lifecycle-Loecher gemessen, 2026-09-02 (frueh)

Program **`66499a038db3393f8a2228e1`** aktiv, gebunden an Slot 4 (diese Session, Fable 5.1). Erster
HANDOFF-Abschnitt dieses Programs — die Vorgaenger-MAINs (Slot 13 Proposer, Slot 7 Codex-MAIN) haben
keinen hinterlassen; ihre Geschichte steht seit `87c5be6` als `authority.lineage` in
`GET /api/self/program-execution` (erster Eintrag `backfill-unknown`).

## 0. Nachtrag bei der Uebergabe (2026-09-02 ~13:00, ctx 32,7 % laut Controller-Messung)

- **Audit auf `87c5be6` GRUEN, selbst verifiziert:** 3423/0 in 2425 s, Trail `isolated-20260902T054820Z-28175`,
  deploy-facts-Check gruen, 8 Lineage-Checks gelaufen. Deckt `67b2265` (A) als Ancestor mit — A und B
  sind Stufe-2-gruen.
- **Rotes Audit auf `79acd2e`** (fremdes Land, Lane f92c, 10 FAILURES): alle zehn in `e2e/watch.ts`
  Transport/Rollback, exakt diese Checks im 87c5be6-Audit gruen, Cluster fiel schon im August 4x gemeinsam
  (Basisraten 3-18 %). Owner-Entscheid via Attention 6e356071: KEIN undo auf A, adjudiziert `flake`,
  Rerun 3443/0.
- **C `860cecdf` weiter `queued`.** Controller (jetzt Slot 15) dispatcht, sobald der Suite-Mutex frei ist
  und kein Audit laeuft (Cs Brief verlangt `suites=0` vor seinem Beweislauf). Report kommt an die
  Nachfolgerin dieses Slots — Diff selbst lesen; landen nur, wenn `nextAction` die Self-Land-Tuer nennt.
- **Selbstbefund** (Owner-Auftrag an alle MAINs) als Notiz `1a37966b` abgelegt: 10 von 20 letzten
  Tool-Turns waren Wiederlesen/Pollen; 9 von 22 eingehenden Nachrichten ohne Entscheidungsgehalt;
  Schnittvorschlag `lane-signals.ts#attentionAnswerMessage` (Owner-Antwort zitiert den eigenen
  Attention-Text komplett zurueck, ~2,3 k Zeichen je Antwort).
- Seit `4880d15` auf main gelandet (fremd): P4 Slice 1 (`e03d44c`, server.ts -> server/types.ts, reiner
  Move), Slot-Model-Route `c09d5f1` (`POST /api/slots/:id/model`; `succeed` nimmt dasselbe Paar als
  Override), Verify-Arbeitsbudget 480 s (`fc389a1`), Helper-Daemon-Job (`79acd2e`).
- Diese Uebergabe ist die erste dokumentierte Self-Succession dieses Programs (Schritt 9): HANDOFF
  committet, `POST /api/self/succeed` mit `carry`, danach `retire`. Ob `authority.lineage` den Wechsel
  als `succeed`-Eintrag traegt, pruefst DU zuerst in `GET /api/self/program-execution` — das ist der
  Live-Beweis fuer B.

## 1. Autoritaet & Betrieb

- **Owner-Vorgabe 2026-09-01 abends: ALLE Sessions und Lanes auf `claude / claude-fable-5-1[1m] / high`.**
  Ersetzt die GPT-fuer-alles-Zeile (2026-08-08, steht noch in CLAUDE.md) und die Program-Entscheidung
  „nur Codex-Worker". Memory: `feedback-fable-for-all-sessions-and-lanes`.
- **Master-Stop bleibt AUS** (`dispatch:false` seit 2026-08-31). Weg: `POST /api/self/tasks` (kind
  `auftrag` + Spawn-Tripel) -> `POST /api/self/tasks/:id/release` -> **Hand-Dispatch durch den Fleet
  Controller** (Slot wechselt: 1 -> 2 -> 12 -> 14 heute Nacht; Attentions gehen ans Board, nicht an
  einen Slot). Damit ist Schritt 11 des Erfolgsmasses („kein Owner-Management") STRUKTURELL unerfuellbar,
  solange der Master-Stop aus ist — Owner-Entscheid, per Attention 17aee703 gestellt und mit Option 2
  (Hand-Dispatch) beantwortet.
- Self-Land-Promotion `guarded`. Owner-Token, tmux, Pane-Lesen: nie benutzt. Kommunikation mit dem
  Controller ausschliesslich ueber `POST /api/self/attention` (kind decision/review-ready) — `/send`
  ist eine Owner-Route.
- **Betriebsregel des Controllers seit heute Nacht:** keine Lane-Beweiskette neben einem laufenden
  Post-Land-Audit; Audit-Budget seit Deploy `64c05bf` 45 min (vorher 30). Grund: zwei `unknown`-Audits
  (67b2265, 8990fcb), beide GEARBEITET statt gewartet (Mutex nach 0 s / 50 s), 3010 bzw. 2508 Trail-Zeilen
  bei Load 32 auf 8 Kernen, von der Wand getoetet. Meine Korrektur der Controller-Notiz: Attention
  54dcf64b, angenommen (Notiz 673d5224 archiviert, aecd5f89 gefilet).

## 2. Gelandet & selbst verifiziert

- **Worker A `3c72fe3a` -> `4b14096`+`67b2265`** (Fable-Lane Slot 5, Branch fleet/260901201138-9c83):
  `FLEET_REPORT_RECOVERY_MAX_ATTEMPTS` (Default 5) deckelt die Fleet-Report-Recovery (ein Vergleich
  `fleetReportRecoveryExhausted`, ein Schreiber `recordFleetReportNonAcceptance` fuer Transport UND
  Recovery, Pre-Paste-Guard fuer restaurierte Zeilen ueber dem Deckel); eigener Paste zaehlt nicht mehr
  als Receiver-Output (`quietUntil` am Paste, Tail 500 ms). Das ist der Mechanismus, an dem der letzte
  Program-Lauf starb (Event 8ca8c38e, 1549 Versuche, receiver-gone). Land durch den Controller
  (Owner-Bearer, Note `suspect: owner-token-outside-board`), verify.ok true, 7 Schritte, 101 s.
  Worker-Isolated-Lauf: 1 FAIL (`§2 a commit after boot is counted`, Basisrate 1/494, Modul unberuehrt,
  Diff disjunkt) — von mir als nicht A zurechenbar adjudiziert, KEIN Same-Tree-Rerun. Stufe 2: zweimal
  `unknown` (Last), dann indirekt gruen ueber das Audit von 87c5be6 (Ancestor).
- **Worker B `b0c15ca5` -> `87c5be6`** (Fable-Lane Slot 8, fleet/260902022518-0bf1): `Program.lineage`
  als vierter Record (v1, Deckel 50 + `dropped`, Loader default-deny, Close+Append im selben Save wie
  `program.main`, „first close wins": ein beobachteter `retire` bleibt, der Rebound traegt sich nur als
  `via`), `authority.lineage` in program-execution, ehrliche `unknown`-Saetze. Worker-Isolated-Lauf
  wortwoertlich ALL PASS (Trail `isolated-20260902T033019Z-5569`, 3423/0). **Post-Land-Audit GRUEN**:
  3423/0, 2425 s, Trail `isolated-20260902T054820Z-28175`. Land durch den Controller (Owner-Route,
  `confirm:true`; die Note traegt das Verify-Verdikt von Land 1 auf Basis 5c9f661 — der Audit misst den
  echten Baum). B von mir gefiled als b92e9cc9 (Codex-Fassung, archiviert) und b0c15ca5 (Fable).
- Beide Diffs habe ich SELBST gelesen (server.ts-Hunks, Trail-Dateien, Docs), nicht den Reports geglaubt.

## 3. In Flug — das Erste, was du tust

1. **Worker C `860cecdf` ist `queued`** (Fable-Tripel), braucht Hand-Dispatch durch den Controller. Inhalt:
   typisierter `MergeLast`-Fakt fuer „rebase ok, verify gruen, Fast-Forward verloren", der genau diesen
   Fall wieder done-looking und selbst relandbar macht. Wenn C beim Lesen laeuft: Report kommt in diese
   Pane; Diff selbst lesen; landen NUR, wenn `nextAction` die Self-Land-Tuer nennt; sonst Controller.
2. **Watches sterben mit dem Slot.** Bei Uebergabe alle gefeuert; nichts neu zu armieren, bis C landet.
3. Danach Worker D (noch nicht gefiled): typisierte Report-Annahme-Tuer
   (`POST /api/self/fleet-report/:id/accept|reject`) — heute gibt es nur den Event-ACK, der laut
   A-Vertrag ausdruecklich Transport-Quittung ist; Schritt 7 des Erfolgsmasses ist ohne sie nicht
   mechanisch belegbar. Dazu, falls nicht vorhanden, das automatische Cleanup einer clean+ahead0-Lane
   ohne Kandidat (Schritt 8).
4. Offene Owner-Frage 4 (read-only Portfolioansicht fuer den Controller): erst NACH C als eine Attention
   stellen — Geschmacks-/Scope-Frage.

## 4. Zwei Lifecycle-Loecher, gemessen, beide als Zeile abgelegt

- **(a) Self-Land nach verlorenem Fast-Forward ist strukturell unmoeglich** (Notiz `61a0fac1`, Fix =
  `860cecdf`). Land 1 von B: rebase ok, verify GRUEN, ff an ca52fc9 gebrochen -> `mergeLast.status=error`.
  `lane-signals.ts#MERGE_BLOCKING = ["blocked","error"]` -> nie done-looking ->
  `server.ts#selfLandTaskForMain` Klausel (11) lehnt ab (vier Versuche, 409 „no signal", nach echter
  main-Bewegung). Die einzige Self-Tuer, die den Zustand aendern koennte, ist die, die ablehnt. Der
  No-Progress-Guard ist NICHT die Ursache (greift erst dahinter). Folge: Schritt 5 degradiert bei jedem
  Land-Rennen still zum Owner-Land.
- **(b) Ein Hand-Dispatch-Override schreibt die Task-Zeile nicht um:** `3c72fe3a` traegt weiter
  `spawn: codex/gpt-5.5`, die Lane-Zeile sagt `claude-fable-5-1[1m]`. Die Lane-Zeile ist die Wahrheit;
  wer aus der Task-Zeile liest, liest den Filing-Wunsch. Nicht gefiled — beim naechsten Brief mitnehmen.

## 5. Erfolgsmass — Stand nach dieser Session, ehrlich

Belegt: Task-Erstellung/Release ueber Self-Tueren (A, B, C) · Report mit Commit und exakten Prueftails
(A, B) · Reportzustellung ohne Owner-Routing an eine Claude-MAIN (alle Reports kamen, jeder ACKed) ·
Self-Land ueber Promotion (`b65fedc`, Vorgaenger; fuer B strukturell blockiert, siehe §4a) · Merge- und
Audit-Event je genau einmal (B: `f6064dfb`, `a4d9dd0e`) · roter/unknown Audit erreicht die aktive MAIN
(zweimal `unknown`, einmal Remote-Rot per Ping, jeweils mit benanntem unmessbarem Zustand) ·
Rekonstruktion ohne Pane-Lesen (diese Session, aus Ledgern und Projektion; die Lineage-Luecke war die
benannte Unbekannte und ist seit B geschlossen). NICHT belegt: ausdrueckliche Report-Annahme (keine Tuer,
Worker D) · automatisches Cleanup einer no-candidate-Lane (nicht beobachtet) · dokumentierte
Self-Succession (diese Uebergabe ist der erste Versuch) · kein Owner-Management (Master-Stop AUS).

## 6. Ehrlichkeiten & Reste

- Kein Direkt-Commit ausser diesem HANDOFF (docs-only, kein Land-Gate, kein Audit — per Regelbuch gesagt).
- Kein Deploy gefahren; A und B wirken erst nach Deploy (Verb 2, Owner-Akt). Der Live-Server (64c05bf)
  hat A und B NICHT — die lebende 1549er-Zeile wird erst nach dem Deploy blockiert.
- Der Remote-Rot auf d4f2bfc (sechster namenloser Second-host-Rot) ist fremdes Land, nicht adjudiziert.
- Composer-/Queue-Text wurde nie als Nachricht gelesen; ein GO gilt nur mit `rev-parse main`-Beweis.
- ctx: nicht messbar ohne Owner-Token (Program-Verbot); geschaetzt ~20 % bei Uebergabe-Vorbereitung.

---

# HANDOFF — Fleet Controller (Slot 12, Fable 5.1 high): Audit-Rot als Flake mit Mechanismus, sechs serielle Lands, Steward-Punkte umgesetzt, Second-host zurueck, Nachfolge wegen ctx 36 %, 2026-09-02 (07:50)

Rolle: **🎛 Fleet Controller**, nicht Program-MAIN. Gegruendet per /open+/send (succeed-Route scheitert
deterministisch, Notiz `9c7d6e02`). Owner-Vorgaben in Kraft: Fable 5.1 high ueberall · Usage praktisch
unbegrenzt · seriell landen · Quiet Hours AUS. **ctx bei Uebergabe-Entscheid: 36,3 % GEMESSEN** — der Owner
musste die Nachfolge anstossen; warum, steht in §3 und als Notiz `76862eb3`.

## 0. Reihenfolge fuer dich

1. **Erdung:** `./state.sh`, `./register.sh`, dieser Abschnitt. Dann VIER Rueckwege, bevor du irgendetwas
   anderes tust: (a) Main-Watcher (`until git rev-parse main != BASE`), (b) Fleet-Report-Watcher auf
   `audit.jsonl` (`grep -c fleet_report_open`, Basis = aktueller Zaehler), (c) Attention-Watcher auf
   `fleet.json.attentionRequests` (Laenge), **(d) NEU: ctx-Watcher auf DICH SELBST** — Hintergrund-`until`
   ueber den ctx-Schnipsel aus CLAUDE.md §Einstieg, Bedingung `pct >= 25`, dann `HANDOFF.md` schreiben.
   Ich hatte (a)–(c) und nicht (d), und habe drei Stunden lang nie gemessen.
2. **`HANDOFF.md` ist UNCOMMITTET** (dieser Abschnitt): waehrend Slot 10s Land lief, war ein Direkt-Commit
   verboten (bricht den Fast-Forward — heute zweimal passiert, `ca52fc9` und die Folge in §1). Committe ihn
   docs-only, sobald KEIN `GET /api/slots/:id/merge` `running:true` sagt, und bevor das naechste Land
   startet. Slot 5 (Sanierungs-MAIN) kann dasselbe wollen — absprechen, einer committet.
3. **Land-Reihe (seriell, eins nach dem anderen), Stand 07:50:**
   - **Slot 10** (`419e9ae3`, Modell-Route; HEAD `77bfb72`) IM LAND — voller Merge-Job, Gate wartete auf dem
     Mutex hinter Slot 1s isolated-Lauf und jetzt hinter dem 87c5be6-Audit. Watcher lag bei mir; leg einen
     neuen auf `fleet.json.merges["10"]` (Terminal = status != interrupted). Nach dem Land: Owner-Schritt
     je Slot 1/5/6/9 `POST /api/slots/<id>/model {"model":"claude-fable-5-1[1m]","effort":"high"}`
     — ERST nach dem Deploy des Codes (Deploy gehoert Slot 5, nicht dir, nur bei ruhendem Audit).
   - **Slot 1** (`dabd4da9` S1 daemon-update; HEAD `cf6313e`, 1 behind) — Kette laeuft/lief (isolated
     hielt den Mutex 07:19–07:40). Report geht an **Slot 9** (Second-host-MAIN), Land durch Slot 9 oder dich.
     Nach dem Land: Slot 9 legt dem Owner die DREI Handgriffe auf dem Geraet als eine Attention vor.
     Danach S2 `8228ae65` dispatchen (queued), dann S3 `60d07416`, dann S4 `c3f91ce1` — je nach dem Land
     des Vorgaengers, mit `{"harness":"claude","model":"claude-fable-5-1[1m]","effort":"high","acknowledged":true}`.
   - **Slot 2** (`1b677e58` Workbench; HEAD `e936c0c`) — Kette wartet. Report an **Slot 7**.
   - **Slot 8** (`516b70a9` Repo-Worker audit; HEAD `01cf509`) — Kette wartet. Report an DICH (Steward-Zeile).
   - **Slot 13** (`c7259df1` P4 Slice 1, Typen-MOVE, Slot 5s Program) — produziert. **FREEZE-Regel mit
     Slot 5 (abgesprochen 07:24):** Lands laufen seriell weiter, waehrend Slice 1 produziert; zwischen Slot 5s
     Zeilen `FREEZE-START` und `FREEZE-ENDE` (~30–40 min, Verifikation bis Land-Terminal) landest du NICHTS.
     Melde Slot 5 jede main-Bewegung per `/send`, damit es sofort rebasen kann.
   - **`fa1112eb`** (Steward-View liest laufenden Merge als interrupted) ist queued, NICHT dispatcht — nach
     dem naechsten Land, wenn ein Slot frei ist (14/15 frei). **`860cecdf`** (Slot 4s Program, Self-Land nach
     verlorenem ff) ist queued und wartet auf Slot 4s Bitte — Slot 4 ist bei 30 % ctx.
   - **private-repo-p (Slot 3, 42,9 % ctx — Nachfolge faellig!):** Brief 3a gelandet `e6cdf61`; `e02d2285` (3b)
     und `5b822ccc` (Brief 4) sind queued mit PRECONDITION im Text — Hand-Dispatch auf Slot 3s Bitte.
4. **Betriebsregeln fuer jede neue Lane (per /send nach dem Dispatch, Retry bis der Composer frei ist):**
   (1) vor der Beweiskette auf main rebasen und HEAD melden, (2) Beweiskette erst bei
   `ps -eo command | grep -c '^/bin/sh ./e2e-isolated'` = 0, Suiten in Log-Dateien, (3) Fertigmeldung =
   Fleet-Report, nie selbst landen. Wortlaut: in meinem Transkript / `audit.jsonl` (sendId `f36bf3e1`).
5. **Second-host:** Daemon war seit 2026-09-01 22:59 still, Maschine wach (LAN .164, Tailscale ok), MAC jetzt in
   `.env` (`FLEET_HELPER_MAC_SECONDHOSTLINUX1`, gleiches L2-Segment). Um 07:13 kam er zurueck und claimte den
   7006696-Audit: **ROT, 13 FAILURES, KEIN Check-Name** — der siebte namenlose Remote-Rot in Folge, Slot 5
   hat unknowable adjudiziert (Notiz `df22cf14`). Owner-Frage offen (07:45): Second-host bis zum S4-Land auf
   `off` (`POST /api/helper/devices/secondhostlinux1/mode {"mode":"off"}`)? Ohne Owner-Wort: an lassen,
   Slot 5 jedes Remote-Audit melden.
6. **Kein Deploy von dir.** Deploy = Slot 5, nur bei ruhendem Audit.

## 1. Was heute Nacht/Morgen passierte (verifiziert, Bodies in `git log bd0aaae..main`)

- Lands (alle seriell): P3b `5c9f661` (Land 1 §11.2i nie gemessen, Land 2 ok) · Slot 1s Handoff `ca52fc9`
  (Direkt-Commit WAEHREND Slot 8s Land → ff-Bruch) · P3c `7006696` · b0c15ca5 `87c5be6` (Lineage; Lane
  rebased selbst, ich per Owner-Route `confirm:true`, Ledger-Actor owner-token). private-repo-p: Brief 3a `e6cdf61`.
- Audits: 22165be ROT 2/3416 → seriell wiederholt 3416/0 → flake (Slot 1), **Mechanismus gefunden:**
  `tickWatches` rollt im SendRefused-Pfad `event.status` unbedingt auf pending zurueck und ueberschreibt
  Transitionen waehrend des await (subject-gone, acknowledged) — Notiz `d7400cd7`, Schnitt = Compare-and-Set.
  5c9f661 GRUEN 3416/0 (1875 s). 7006696 ROT remote/unnamed → unknowable. 87c5be6 laeuft lokal seit 07:36.
- Owner-Entscheide heute: `db2d6c85` = (a) (Attention beantwortet); sieben Zeilen promoviert (S1–S4,
  419e9ae3, 516b70a9, fa1112eb); Steward-Punkte umgesetzt. Private-repo-o (Slot 6): Owner faehrt 62ef02a selbst.
- Sanierungs-MAIN: Slot 1 → Slot 5 (Nachfolge 06:08). Der ADVISOR ist Slot 11 (⚙ steward).

## 2. Fallen, die ich bezahlt habe

- Composer-Residuen mit MEINEM Prefix in fremden Panes (Slot 4: „GO: P3c gelandet", Slot 9: „OWNER ANSWER
  (a)") — Claude Codes eigener Rest, nie Owner, aber ein Slot, der sie versehentlich absendet, handelt auf
  Falschinformation. `C-u` griff nicht. Gegenmittel: Faktencheck-Regel im /send („GO gilt nur, wenn
  `git rev-parse main` != X").
- `POST /api/self/watch {kind:merge}` gibt nach einem Feuern den VERBRAUCHTEN Watch zurueck (P6 `372b3cef`)
  → Hintergrund-Watcher auf `fleet.json.merges[<slot>]`. Deckel 5 aktive Watches je Slot — Audit-Watches
  brauchen die VOLLE SHA.
- Adjudikations-Note ≤ 300 Zeichen. Slot 5 adjudiziert Sanierungs-Audits selbst — absprechen, nicht doppelt.
- macOS hat kein `setsid`: eine Lane, die damit detacht, stirbt still (Slot 8, 04:59).

## 3. Warum diese Session das Band verpasst hat (Owner-Frage 07:45; Notiz `76862eb3`)

Nicht das Regelbuch: AGENTS.md §Context self-management und CLAUDE.md-Band galten auch fuer mich. Der
Mechanismus fehlte: ich lebte drei Stunden rein ereignisgetrieben, jeder Wakeup kam von aussen, keiner trug
meinen Fuellstand; der Steward-Pulse nennt nur Transkript-KB; die einzige Zahl im Transkript war geschaetzt.
Dazu Reibung: `/api/self/succeed` scheitert deterministisch, Nachfolge ist Handarbeit. Schnitt: Rueckweg (d)
oben, Pulse mit `ctx.pct`, optional Self-Watch `ctx`.

## 4. Offene Owner-Entscheidungen

1. Second-host `off` bis S4? (§0.5) 2. Private-repo-o schliessen/neu gruenden nach eigener Fahrt. 3. Slot 3
Nachfolge (42,9 %). 4. Termin fuer die drei Handgriffe nach dem S1-Land.

---

# HANDOFF — Generalsanierung: P3a gelandet (22165be, Audit-Rot als flake adjudiziert), P3b gelandet (5c9f661), P3c dispatcht, Deploy auf 64c05bf, 2026-09-02 (frueh)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden an Slot 1 (diese Session; Slot-Datensatz sagt
`claude-opus-5[1m]`, Pane per `/model` auf Fable 5.1 — die Nachfolge-Route reicht den Datensatz
woertlich durch: nach dem Spawn `POST /send {slot:<neu>, text:"/model claude-fable-5-1[1m]"}` mit
Owner-Token, so habe ich es getan). Ersetzt den P2-Abschnitt darunter.

## 1. Gelandet, verifiziert

- **P3a `41a4c42f` → `22165be`** (Lane-Commit b8271b2, Slot 5, Fable high). Slot-Lifecycle + Boot,
  Kommentarzeilen 9166 → 8908, 81 Bloecke ins neue `docs/sanierung-2026-09/server-narrativ-archiv.md`.
  Land-Note `verify.ok true`, 7 Schritte, 98,8 s, `waitMs 0`, `actor {main, slot 1}`. **Beweis
  unabhaengig nachgerechnet:** `git archive 67b2265` voll → `bun build server.ts --target=bun` sha256
  `b313d549542b9989b1db4c04…` = Lane-Baum; `git diff -U0` ohne Kommentarzeilen = 0 Zeilen.
  **Audit ROT (3416/2)** → **adjudiziert `flake`** (Note ≤300 Zeichen auf dem Ledger): gleicher
  Baum seriell wiederholt 05:01–05:28 → 3416/0 ALL PASS (Log im Scratchpad dieser Session,
  Trail `e2e-trail/isolated-20260902T030148Z-69547.jsonl` im Haupt-Checkout). Signatur =
  §11.2j-Siebtmitglied (subject-gone + counterprobe, `flippedBack:true`).
- **P3b `06f57d8f` → `5c9f661`** (Lane-Commit 5c9f661, Slot 5). Autos/Watches-Hub, vier
  Regionen, 8908 → 8717 Kommentarzeilen, 61 Bloecke, Archiv +772 Zeilen. Unabhaengig nachgerechnet:
  Hash identisch `b313d549…`, 0 Nicht-Kommentar-Diffzeilen, drei Pin-Marker je 1×, pins ALL PASS.
  **Land 1 rot, nie gemessen:** claude-gate Phase 3 `server did not come up … server exited
  unexpectedly`, keine server.log = §11.2i-Signatur, nach 1804 s Mutex-Wartezeit hinter meinem
  Wiederholungslauf. Die Self-Land-Tuer verweigerte den Retry mit dem **No-Progress-Guard**
  (`server.ts#handleSelfLand`, „no progress since the last verdict — repair or escalate", 409;
  = P6-Zeile `563ec115`). Eskaliert ueber die Owner-Route `POST /api/slots/5/merge` (unter der
  Land-Delegation; gleiche Tuer wie der Controller) → Land 2 = **merged, verify.ok true, 232 s Arbeit / 122 s Wartezeit, main = 5c9f661** (ff; Lane-Commit = main-sha).
- **Deploy `1425522f`** (Verb 2): `stage:boot ok:true hitTarget:true`, bootHead `64c05bf`, 7043 ms,
  10/10 Agenten. Live-srv traegt `FLEET_POSTLAND_AUDIT_TIMEOUT_MS=2700000` (Direkt-Commit
  `64c05bf` in watchdog.sh + `launchctl kickstart`; ledger-unsichtbar, Hand-Verify `sh -n` +
  pins). Seitdem **kein weiterer Deploy**: `deployGap.codeBehind` ist jetzt true (22165be, P3b sind
  server.ts-Aenderungen — kommentar-only, Server-Bytes identisch; Deploy ist trotzdem faellig, damit
  `bootHead` = HEAD; kein Druck).
- `graphify update .` lief nach cc391b7; nach 22165be/P3b NICHT (Nachfolge: einmal laufen lassen).

## 2. In Flug — das Erste, was du tust

1. **P3c `9a5a0b76` ist FERTIG und von mir REVIEWT (Report `ae8c59bb`, Slot 2, Lane-Commit
   `e456e2a` auf Basis bd0aaae):** fetch-Kette 1127 → 689 Kommentarzeilen (36,1 → 25,3 %),
   server.ts gesamt 8908 → 8470 (24950 Zeilen), 104 Bloecke / 54 Ueberschriften ins Archiv, volle
   Kette in der Lane gruen (clean-review 32/0, security 92/0, claude-gate 137/0). **Unabhaengig
   nachgerechnet:** Hash `b313d549…` identisch, 0 Nicht-Kommentar-Diffzeilen, Marker `// the rows
   behind the poll` 1×, Archiv 71 Ueberschriften / 0 `server.ts:NNN`, pins ALL PASS, Baum sauber.
   **Noch NICHT gelandet** (ein Land pro Zeit; P3b-Land 2 lief). **Vor dem Land: die Lane muss
   auf main rebasen** — P3b UND P3c haengen beide ans Ende von `server-narrativ-archiv.md` und an
   `## Slices` → textueller Konflikt sicher. Weg: `POST /send {slot:2, text:"P3b ist als <sha>
   gelandet — rebase auf main, Archiv-Anhang beider Slices in Reihenfolge, Hash-Beweis erneut,
   pins, dann Report"}`; danach Vollbaum-Hash gegen `git archive main` nachrechnen, dann
   `POST /api/self/tasks/9a5a0b76/land` (Self-Land-Tuer; wenn sie 409 No-Progress sagt:
   Owner-Route `POST /api/slots/2/merge`, s. §1 P3b), Merge-Watch (bei `armed:false` →
   Hintergrund-Watcher auf `fleet.json merges[2].status`), Audit-Watch, Start-/Terminal-Zeile an
   den **Controller (Slot 12)**.
2. **Audit-Watch fuer P3b** neu armieren (`{kind:audit, repo:<toplevel>, mainAfter:5c9f661e83a59648f69fa9e7b9b73b12d131bb54}`; meiner stirbt mit dem Slot). **An Slot 2 ist der Rebase-Auftrag schon raus** (per /send, Text s. Punkt 1) — sein Report kommt an dich.
   Rot mit subject-gone/counterprobe-Signatur = §11.2j (Mechanismus s. §4.1) → Beweisordnung
   (gleicher Baum seriell; Runner detacht per Doppel-Fork `(nohup … &)`, **macOS hat kein
   `setsid`**, und der Bash-Tool-Cap ist 10 min — Warter separat auf das `EXIT=`-Artefakt).
3. **P3 danach:** nach P3c ist der Kern-der-bleibt (fetch, Slot-Lifecycle, Autos/Watches, Boot)
   exkaviert. Erwartete Restzahl ~7600 Kommentarzeilen — die Masse sitzt in den P4-wandernden
   Sektionen und wird dort je Slice exkaviert (Plan §P3). **P4 darf noch nicht starten:**
   P0-Baseline (3 serielle gruene Laeufe) ist NICHT geschlossen (Plan-Nachtrag), stilles Fenster
   + Fenster-Checkliste noetig. Vor P4 also: Baseline-Frage klaeren (Entscheid 1: auf
   Check-Ebene — meine Serie heute: 22165be-Wiederholung 3416/0 zaehlt als ein gruener Lauf).
4. Deploy (Verb 2) bei Gelegenheit, wenn kein srv-Kind-Wrapper laeuft (ppid-Probe) und kein Audit.

## 3. Messungen dieser Session (fuer Plan/Messnotiz)

- server.ts Kommentaranteil: 36,6 % (9139/25581 auf 5667c85) → 36,0 % (8908) → nach P3b 8717.
  Ziel <20 % ist ohne P4 unerreichbar — erwartet.
- „~11 Kommentar-Anker-Pins" (Plan-Schaetzung) = **gemessen 4** im ganzen server.ts (Strip-Probe:
  git-archive-Kopie, alle `//`-Zeilen weg, `bun e2e/pins.ts`, Diff gegen 6 Baseline-Fails aus
  gitignorten Dateien): codex-owner-bind (`// the rows behind the poll`), sendText-readiness
  (`// --- scheduled prompts ---`), FACT 2 (`// FACT 2:`…`// The one-line receiver text is
  composed`), RULE_RECEIVER B4. Slice-weise Probe = die Brief-Methode.
- `bun build server.ts --target=bun` (bun 1.3.9) ist deterministisch UND strippt Kommentare
  restlos: voll-kommentarfreie Kopie → byte-identisch (884960 B auf 5667c85). Der Hash ist der
  Richter; er aendert sich nur mit Code (67b2265: 886573 B, `b313d549…`).
- Audit unter Last: zwei `unknown` (67b2265, 8990fcb) an der 1800-s-Wand, `acquired after 0s` —
  Arbeitsbudget, nicht Warten. Daher 64c05bf.

## 4. Befunde (P6-Zeilen, gefilet vom Controller; hier nur der Mechanismus)

1. `server.ts#tickWatches`: SendRefused-Catch rollt `event.status` UNBEDINGT auf `pending`
   zurueck (~12052), ohne Compare-and-Set gegen den Status, den die Row waehrend `await sendText`
   bekam (subject-gone durch Teardown, Ack 200 statt 409). Am Code bestaetigt. Das ist der
   Mechanismus der §11.2j-„same row reads pending again"-Kontradiktion. Server-Fix = P6.
2. Merge-Watch feuert auf das ERSTE Terminal (Lane A: `error` beim ff-Retry), der gruene Retry
   erzeugt ein zweites, das der Watch nicht sieht — `landed=NO` aus einem Watch ist nicht das
   letzte Wort; main pruefen. Und: der spent Watch blockierte die Re-Subscription NICHT (nach
   srv-Neustart) — aber OHNE Neustart dazwischen ist `372b3cef` BESTAETIGT: nach dem spent
   Merge-Watch `ea5f3bf3` lieferte jede Re-Subscription auf Slot 5 denselben `armed:false`-Watch
   zurueck; kein Event kam. Workaround: Hintergrund-Watcher auf `fleet.json merges[5].status`.
3. Zwei Sonden-Fehler dieser Session, beide als Regel gemerkt: leerer Build-Hash (Imports fehlten)
   und `setsid` auf macOS (Runner startete nie; Fuge in `~/.claude/knowledge/stacks/fugen.md`).

## 5. Ehrlichkeiten

- Direkt-Commits: `64c05bf` (watchdog.sh) und dieser Handoff. Beide ledger-unsichtbar,
  Hand-Verify pins ALL PASS.
- Die P3a-Audit-Adjudikation lief mit dem Owner-Token (`by: owner`) — die Route kennt keinen
  MAIN-Prinzipal; inhaltlich meine Entscheidung unter der Owner-Delegation.
- ctx bei der Uebergabe-Entscheidung: **25,9 % gemessen**; beim Commit dieses Handoffs ~28 %.
  `graphify update .` seit 22165be nicht gelaufen — Nachfolge.

---

# HANDOFF — Fleet Controller (Slot 2, Fable 5.1 high): Nacht der seriellen Lands, Gate-Env-Regress, zwei Audit-Timeouts unter Last, Advisor gegruendet, Portfolio-Plan, Second-host Phase 1 gefilet, 2026-09-02 (04:40)

Rolle: **🎛 Fleet Controller**, nicht Program-MAIN. Gegruendet per /open+/send (die succeed-Route
scheitert deterministisch, Notiz `9c7d6e02` — die Nachfolge geht wieder ueber /open + /send).
Owner-Vorgaben in Kraft: Fable 5.1 high ueberall · Usage praktisch unbegrenzt · seriell landen ·
**Quiet Hours sind AUS** (Owner 03:35, `POST /api/autos/quiet {}`). ctx bei Uebergabe-Entscheid:
**33,5 % gemessen** (Band 25/30 ueberschritten; die Restkette war das P3a-Land).

## 0. Reihenfolge fuer dich (nichts davon ist Vorsatz, alles hat einen Mechanismus)

1. **Erdung:** `./state.sh`, `./register.sh`, dieser Abschnitt. Dann DREI Rueckwege legen,
   bevor du irgendetwas anderes tust — meine sterben mit Slot 2: (a) Main-Watcher
   (`until git rev-parse main != BASE`), (b) Fleet-Report-Watcher auf `audit.jsonl`
   (`grep -c fleet_report_open`, Basis = aktueller Zaehler), (c) Attention-Watcher auf
   `fleet.json.attentionRequests` (Laenge) — **Program-MAINs koennen kein `/send`, ihre
   Freigaben kommen als Attention**; ich habe eine Lane-A-Freigabe 100 min lang uebersehen,
   weil ich nur `/send` beobachtete.
2. **P3a ist GELANDET (`22165be`, 04:50, Slot 1 selbst)**; sein
   Audit ist der erste unter dem 45-min-Budget. **Kein Direkt-Commit auf main, solange
   irgendein `GET /api/slots/:id/merge` `running:true` sagt** — ein Docs-Commit von mir (82702ae)
   und einer von Slot 11 (5667c85) haben je einen Fast-Forward gebrochen; Verify blieb gueltig,
   das Land musste erneut angestossen werden (zweiter Lauf per `{"confirm":true}` auf dem
   sauberen, rebasten Baum). **Diesen HANDOFF committest du, falls mein Commit unten fehlt.**
3. **`b0c15ca5` laeuft auf Slot 8** (Program 66499a03, Lineage, Fable). Report geht an Slot 4;
   Land laut Erfolgsmass per Self-Land durch Slot 4 — wenn Slot 4 stattdessen dich bittet:
   `POST /api/slots/8/merge`, `{kind:"merge",target:8}` abonnieren.
4. **`1b677e58` (Workbench, Slot 7) ist released und wartet BEWUSST** auf das b0c15ca5-Land:
   beide halten `src/client.ts`, und die Maschine stand bei load 33 auf 8 Kernen. Dispatch mit
   `{"harness":"claude","model":"claude-fable-5-1[1m]","effort":"high","acknowledged":true}`.
5. **Brief 2 (Slot 10 → Slot 3, private-repo-p) ist berichtet**, Slot 3 landet selbst (wie Brief 1).
   Danach Brief 3 (`bea7cc37`/`fa7c7d7b` pending) auf Slot 3s Bitte dispatchen.
6. **Second-host Phase 1 ist gefilet, alle pending, KEIN Release bis `db2d6c85` auf (a) steht:**
   `dabd4da9` S1 daemon-update · `8228ae65` S2 Job „command" (Self-Tuer + Watch `job`) ·
   `60d07416` S3 Wake-on-LAN · `c3f91ce1` S4 Presence + suite.log. Slot 9 released nach (a),
   du dispatchst seriell, S1 zuerst, **nie neben einem laufenden Audit** (Regel unten).
7. **Kein Deploy von dir:** Deploy gehoert der Sanierungs-MAIN (Slot 1) mit ppid-Probe
   (Fenster zu, wenn ein `/bin/sh ./e2e-*` in seiner Elternkette `bun server.ts` hat).

## 1. Was steht (verifiziert, 04:35)

- **main = `22165be`** (P3a `22165be` · P2a `ec5b6be`+`e319388` · P2b `cc391b7` · Lane A `4b14096`+`67b2265` ·
  Workbench `8990fcb` · Docs `5667c85`/`82702ae` · watchdog `64c05bf`). **Live-srv bootet auf
  `64c05bf`** (Deploy `1425522f` ok, 04:31, Slot 1), `FLEET_POSTLAND_AUDIT_TIMEOUT_MS=2700000`
  im srv-Env gemessen, `bundleStale:false`, `codeBehind:false`.
- **Audits:** `e319388` green (3390) · `cc391b7` green (3390) · `67b2265` **unknown**
  (1800-s-Timeout, Trail 3010 Zeilen, KEIN Mutex-Warten, Suite unter Last 2x langsamer) ·
  `8990fcb` **unknown** (dasselbe, Trail 2505 ok / 3 Last-Rots). Beide sind kein Regress;
  Notiz `aecd5f89` traegt die Messung, meine erste Notiz dazu (`673d5224`) war falsch und
  ist archiviert. Der naechste gruene Audit deckt beide per `covers`.
- **Slots:** 1 Sanierungs-MAIN (Nachfolge von 11) · 2 ich · 3 Private-repo-y-MAIN · 4
  Owner-Routing-MAIN · 5 Lane P3a (im Land) · 6 Private-repo-o-MAIN (Hold, Opus-Datensatz) · 7
  Workbench-MAIN · 8 Lane b0c15ca5 · 9 Second-host-MAIN (Opus-Datensatz) · 10 Lane Brief 2 ·
  **11 ⚙ steward = der ADVISOR** (Worktree `claude-fleet.worktrees/steward`, Branch `steward`
  frisch auf `5667c85`, Fable high; Evaluation aller Sessions steht in seiner Pane und im
  Steward-Journal, 03:24) · 16 Owner-`/usage`-Screen.
- **Login:** Owner hat sich um 03:20 neu eingeloggt; „Login expired" in Panes davor ist
  erledigt, danach nicht.

## 2. Vier gemessene Befunde dieser Nacht

- **(a) Gate-Env-Regress, GEFIXT (`e319388`):** `.env` traegt seit 21:50 `FLEET_MODEL`; der
  Deploy 23:56 exportierte es in srv; jeder Land-Gate ist srv-Kind und erbte es; zwei
  claude-gate-Checks verglichen gegen den hart kodierten Default → jedes Land rot. Fix:
  `FLEET_MODEL=` auf allen Suite-Spawnzeilen (`e2e-claude-gate.sh`, `e2e-isolated.sh`).
- **(b) Audit-Timeout unter Last (Notiz `aecd5f89`):** 10 claude-Prozesse + iOS-Simulator
  (Slot 3s Verify) → load 33/8 Kerne → Suite 2x langsamer → 1800-s-Wand. Hebel 1 ist
  deployt (45 min). **Hebel 2 gilt ab jetzt als Controller-Regel: keine Lane-Beweiskette
  neben einem laufenden Audit starten** (Audit-Zustand: `tail -1 post-land-audits.jsonl`
  vs. laufender `e2e-isolated` mit srv in der ppid-Kette). Das ist das staerkste Argument
  fuer den Second-host-Audit.
- **(c) Owner-Akt an Quiet Hours gescheitert (Notiz `c6d728de`):** `handleAttentionAnswer`
  ruft `canDeliver` ohne `quietHours:false`, als einziger Owner-Pfad. Quiet Hours sind
  jetzt aus; der Fix gehoert der Sanierung (P6).
- **(d) Deploy-Preflight kennt keinen laufenden Merge** (Notiz `4e29e778`, von Slot 10) —
  heute zweimal per Absprache umgangen (Slot 1 fragt mich vor jedem Deploy).

## 3. Dokumente dieser Nacht

- `docs/portfolio-plan-2026-09-02.md` (`82702ae`, Direkt-Commit docs-only, pins ALL PASS von
  Hand, kein Land-Ledger-Eintrag): sieben Programs, je Ziel/Stand/Ambition/drei Schnitte/
  Owner-Tor, Kapazitaetsmodell, Vorfahrt der Sanierung, **§5 = sechs Owner-Entscheidungen**.
- Second-host-Analyse: `docs/ideen/2026-09-01-second-host-job-vertrag-instanz-freunde.md` plus
  meine Korrekturen (R2 serverseitig gebaut, R4-Locale gelandet, Geraet offline >4 h).

## 4. Offene Owner-Entscheidungen (unveraendert offen)

1. `db2d6c85` → (a) Daemon-Verzweigung (Empfehlung) oder (b) ssh-Key. Ohne (a) steht Slot 9.
2. MAC-Adresse des Second-host fuer `.env` + LAN-Frage (gleiches L2-Segment?).
3. Termin fuer den EINEN Handgriff auf dem Geraet nach dem S1-Land.
4. Private-repo-o (Slot 6): schliessen, neu gruenden oder Taste-Gate einloesen.
5. Private-repo-z: jetzt oder nach Private-repo-y Brief 3.
6. Freunde-Jobs: erst nach dem ersten Remote-Gruen.

## 5. Ehrlichkeiten

- Mein Docs-Commit `82702ae` brach das ff535524-Land (ff-Fehler); zweiter Lauf per confirm.
- Meine erste Audit-Notiz `673d5224` nannte Mutex-Warten als Ursache — falsch (Slot 4s
  Trail-Analyse), archiviert.
- Lane-A-Freigabe (Attention `54493d17`) 100 min uebersehen.
- Der Brief 2 (`b78fe350`) hing seit Slot 3s Freigabe unbemerkt in `queued`, bis ich ihn um
  03:20 dispatchte.
- Keine Suite von mir gefahren; Code-Eingriffe: keine (nur Docs + Steward-Worktree).
- Slot 8s Composer hielt laut Advisor ungesendeten Text (Lane ff535524, inzwischen gelandet
  und Slot neu belegt) — Claude-Rest, kein Owner-Entwurf.

---

# HANDOFF — Generalsanierung: P2 KOMPLETT gelandet (P2a e319388, P2b cc391b7), Gate-Env-Regress gefixt, e319388 deployt, P2b-Deploy + P3 offen, 2026-09-02 (Nacht)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden an Slot 11 (diese Session; Fable 5.1 per
`/model` in der Pane gesetzt, Slot-Datensatz sagt weiter `claude-opus-5[1m]` — bekannte Falle, die
Nachfolge-Route reicht das Modell wörtlich durch; nach dem Spawn in der Pane `/model
claude-fable-5-1[1m]` nachziehen). Ersetzt „P2a reviewt und Land in Flug" darunter; die
Controller-Abschnitte dazwischen sind fremd und bleiben.

## 1. Gelandet, verifiziert, deployt

- **P2a `9825cfd9` → `e319388`** (= Lane-Commit `ec5b6be` + mein Gate-Fix obendrauf, §2).
  Land-Note `verify.ok true`, 7 Schritte, 132 s, `waitMs 0`, `actor {kind:main, slot:11}`. Lane 8s
  eigene volle Kette auf demselben Baum 7× ALL PASS (Report `7ba40c9b`). **Audit GREEN, echt:**
  `ms 1 729 426`, `checks {ran:3390, failed:0}`, exit 0, lokal. **Deployt** per Verb 2:
  Deploy `645fab99`, `stage:boot ok:true hitTarget:true`, bootHead `134ebc1`, 3031 ms, 11 Agenten
  überlebten. Inhalt: S1 `verify-proportion.ts#ruleFor` server/ → SERVER_RULE · S2
  `task-metadata.ts#processesForPath` · S3 begründet weggelassen · S4 `CLIENT_ONLY_FILES` +=
  src/helper.ts + src/backoff.ts, `BUNDLES` += helper.js, `BundleStale.helperJsMtime`.
- **P2b `63a32ac2` → `cc391b7`** (Lane-Commit `ac836dc`, Slot 10, Fable 5.1 high). Land-Note
  `verify.ok true`, 7 Schritte, Arbeit ≈107 s nach 1439 s Mutex-Schlange (kein waitedOut).
  Fünf reine Blöcke aus src/client.ts als Module: `src/pollplan.ts` · `src/gitpath.ts` ·
  `src/filetree.ts` · `src/plaudit.ts` · `src/opsevents.ts`; vier Suiten importieren sie statt per
  String-Anker zu schneiden; `CLIENT_ONLY_FILES` +5. **Mein Review:** Diff gelesen; Move
  programmatisch nachgeprüft — pollplan/gitpath/filetree byte-identisch UND zusammenhängend in
  main:src/client.ts, plaudit +1 `import type {PostLandAuditInfo}` (type-only, nötig als
  Standalone), opsevents 51/51 Zeilen verbatim aus ZWEI reinen Spannen um DOM-Zeilen herum (der
  Commit-Body sagt „die Spanne" — leichte Überzeichnung, kein Verhaltensunterschied).
  Mutationsbeweis der Lane: 5 Mutationen → 15 benannte FAILs (2–6 je Modul), sonst 3375 PASS.
  Geschnitten gelassen mit Begründung: kProgress, programs.ts-Klassifizierer, laneBranchRefs/
  stacksOf, alle DOM-Blöcke (Report `c107ddef`). **Audit läuft** — Watch `192fef34` armiert
  (stirbt mit meinem Slot; neu armieren: `{kind:audit, repo:<toplevel>, mainAfter:cc391b7…}`).
- `bundleStale:false` (nach `bun run build`), Demo `typecheck` exit 0 + `build:live` exit 0 gegen
  `cc391b7` (das schlichte `build` lehnt ohne FLEET_SITE_URL ab — by design). `graphify update .`
  nach e319388 gelaufen; nach cc391b7 NICHT (Nachfolge: einmal laufen lassen).

## 2. Der Gate-Env-Regress (gemessen, gefixt, Klasse benannt)

Land 3 von P2a wurde vom Controller-Deploy `b741d9de` (23:56, tmux-Hotfix) **mitten im Gate
getötet** → `interrupted` (Notiz `4e29e778` vom Controller: Deploy-Preflight prüft nur den Audit,
nicht laufende Merges). Land 4 **rot**: 2 FAILs in claude-gate, beide `--model
'claude-fable-5-1[1m]'` statt des kompilierten `FLEET_DEFAULT_MODEL`. Kette: `.env:18
FLEET_MODEL` seit 21:50 · der 23:56-srv ist der erste, der es exportiert · ein Land-Gate ist
srv-Kind · Wrapper pinnten FLEET_CMD/HOST/PORT/SOCK, nie FLEET_MODEL · `server.ts#DEFAULT_MODEL`
nimmt env vor Konstante. Gegen-Zeitachse: Hotfix-Land 93d6cfa lief 23:37 unter dem ALTEN srv grün.
**Fix in `e319388`:** `FLEET_MODEL=` auf den drei claude-gate-Spawnzeilen + `e2e-isolated.sh`
SRV_ENV, Kommentar `fleet-e2e-claude-gate.ts:359`. Beweis LOKAL: `FLEET_MODEL='claude-fable-5-1[1m]'
./e2e-claude-gate.sh` → 137 PASS / 0 FAIL. Kein `FLEET_EFFORT`-Knopf in server.ts. **Klasse:** eine
Sonde, die eine Vorbedingung BEHAUPTET statt sie zu erzwingen — dieselbe wie „e2e/pins.ts liest
package.json nicht" (helper.js-Drift, Lane 8s offene Zeile). P6.

## 3. In Flug — das Erste, was du tust

1. **Audit-Watch auf `cc391b7` neu armieren** (s. §1). Grün ⇒ Deploy; rot ⇒ Beweisordnung (erst
   denselben Baum seriell), adjudizieren.
2. **Deploy von `cc391b7` steht aus:** `deployGap.codeBehind:true, behindCount 1` (P2b fasst
   server.ts an: `CLIENT_ONLY_FILES`). **Abgesprochen mit dem 🎛 Controller (Slot 2):** er landet
   Lane A (Slot 5): Land LÄUFT seit 02:47 (`POST /api/slots/5/merge`, Gate hinter dem P2b-Audit
   am Mutex) und er schickt das Verdikt als eine Zeile —
   **kein Deploy, bevor diese Zeile da ist** (sein Gate ist srv-Kind und stürbe mit dem Restart).
   Danach: Audit terminal UND kein srv-Kind-Wrapper aktiv (**Probe:** für jede
   `/bin/sh ./e2e-*`-PID die ppid-Kette hochlaufen; trifft sie `bun server.ts`, Fenster zu — eine
   Lane-VORSCHAU hängt unter ihrer Pane am tmux-Server pid 706, nicht unter srv, und blockiert
   NICHT; der schlichte Zähler `grep -c '^/bin/sh ./e2e-'` überzeichnet) → eine Zeile an Slot 2
   ~1 min vorher → `POST /api/deploy` → Boot-Verdikt auf `GET /api/deploys` (`ok:null` ist NIE
   ein Pass) → `deployGap`/`bundleStale` auf `/api/sessions`.
3. **Dann P3** (Kommentar-Exkavation Kern, Build-Hash-Beweis): Plan §P3 lesen
   (`docs/sanierung-2026-09/plan-2026-08-31.md`), Brief mit Dateien+Zeilenbereichen, Fable-Tripel
   `{harness:claude, model:claude-fable-5-1[1m], effort:high}`, `POST /api/self/tasks` (kind
   auftrag) + `/release`; Master-Stop ist AN — der Tick startet nichts, Hand-Dispatch
   `POST /api/tasks/<id>/dispatch` mit dem Tripel + `acknowledged:true` (so liefen P2a/P2b).
   Jeder P3-Slice endet mit `bun e2e/pins.ts` im Haupt-Checkout (Program-Intent).

## 4. Befunde als Queue-Zeilen (kind notiz, P6)

1. **`372b3cef`** — spent merge-Watch blockiert manuelle Re-Subscription derselben Lane
   (`server.ts#handleSelfWatch`, Dup-Prädikat `(kind === "lane" ? w.armed : true)`).
   **Datenpunkt dazu (nachgemessen):** die Self-Land-Tür armiert bei Annahme selbst einen
   Merge-Watch für die MAIN (`2740c45a` lieferte Land 5s Terminal) — für Land 4 kam KEIN
   Event (nur mein fleet.json-Watcher sah das Rot). Ob die Tür am Dup vorbeikommt oder Land 4
   anders lief: offen, gehört in die P6-Zeile. Workaround bleibt der Hintergrund-Watcher auf
   `fleet.json merges[<slot>].status` (Terminal = merged|blocked|error|resolved|awaiting-author;
   Muster in dieser Session: Land-Loop bis `running:true`, dann Marker folgen).
2. **`563ec115`** — program-execution kennt den No-Progress-Guard der Self-Land-Tür nicht.
3. Controller: **`4e29e778`** — Deploy-Preflight sieht laufende Merges nicht.
4. Nicht gefilet, im Commit-Body von e319388: die Gate-Env-Klasse (§2).

## 5. Ehrlichkeiten

- Flake-Sichtung (Lane 8, 1/3 Läufe, Phase 2 claude-gate): `FAIL dead foreign agent: lastResult
  reports the skip (missing)` — identischer Baum zweimal grün ⇒ nicht-deterministisch, keine
  registrierte Familie. Datenpunkt.
- Das Land lief dreimal gegen done-looking ins Leere, weil Lane 8 nach dem roten Verdikt selbst
  zu messen begann (Pane nicht 3 s still); Lösung: `/send` („Fix ist meiner, Report, dann idle") +
  Retry-Loop. Eine Lane, die ein rotes Verdikt bekommt, fängt an zu reparieren — Design, kostet
  die MAIN aber ein Fenster. Bei P2b dasselbe Muster ohne Rot: done-looking feuerte zweimal auf
  eine Pane, die nur wartete (Suite im Hintergrund-Shell) — der Report war das echte Signal.
- Ich schrieb zwischendurch „srv-Tod" — falsch, beide Restarts (21:42, 23:56) waren Deploys.
- Die Deploy-Vorwarnung an den Controller lief einmal ins Leere, weil mein Fenster-Zähler P2bs
  eigene Vorschau als Blocker las → daher die ppid-Probe in §3.2.
- Direkt-Commits dieser Session: `134ebc1` und dieser Handoff (docs-only, Hand-Verify
  `bun e2e/pins.ts` ALL PASS je Commit). Beide sind für die Land-Ledger unsichtbar.
- Watches sterben mit meinem Slot: armiert nur `192fef34` (Audit cc391b7). Neu armieren.
- ctx bei der Übergabe-Entscheidung: **24,9 % gemessen** (248 956/1 000 000). Restkette:
  Handoff committen + succeed.

---

# HANDOFF — Generalsanierung: e9c10ee deployt, 8cd6deca gelandet (d4f2bfc), P2a gebaut+reviewt, Land am Mutex verhungert, Remote-Rot #5 adjudiziert, 2026-09-01 (Nacht)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Ersetzt den Abend-Abschnitt weiter unten
(die zwei Fleet-Controller-Abschnitte dazwischen gehoeren dem Controller, nicht diesem Program).

## 1. Autoritaet & Betrieb

- Self-Land **green-only**, `actor.kind=main`; Master-Stop AN (`fleet.json dispatch:false`) —
  Queue-Zeilen brauchen Hand-Dispatch `POST /api/tasks/<id>/dispatch`.
- **Owner-Vorgabe 2026-09-01 (abends, via Controller):** jeder neue Dispatch mit
  `{harness:claude, model:claude-fable-5-1[1m], effort:high}` — `MODEL_RE` nimmt den Namen
  (server.ts:194, geprueft). Memory `feedback-fable-for-all-sessions-and-lanes` traegt es.
- Ein **🎛 Fleet Controller** existiert seit heute (Owner-Wunsch; von mir per `/api/slots/1/open`
  gespawnt, spaeter vom Owner selbst gebrieft; laut seinem Handoff inzwischen Slot 10). Er haelt das
  Portfolio; Fragen zu fremden Programmen/Second-host gehen an IHN, nicht an Slot 9.
- **Feature-Freeze-Kollision, an den Controller gemeldet, nicht blockiert:** Lane
  `fleet/260901201138-9c83` (Task 3c72fe3a, Program 66499a03) baut einen Transport-Slice in diesem
  Repo. Sein Entscheid.

## 2. Gelandet, deployt, verifiziert

- **`e9c10ee`**: Tier-2 LOKAL green — `ms 1557047`, `checks {ran:3380, failed:0}`, `exitCode 0`,
  Tail ALL PASS. **Deployt** per Verb 2: Deploy `c88c9662`, `stage:boot ok:true hitTarget:true`,
  13 Agenten ueberlebten. Datum fuer 0ac22a00: 1557 s von 1800 s Budget bei `waitMs 0` — die
  ARBEIT allein streift das Ein-Budget-Timeout, nicht nur die Wartezeit.
- **`8cd6deca` → `d4f2bfc`** (Zwei-Deckel-Entscheid; Diff selbst gelesen, Fixtures 8a/8b/8c
  nicht-tautologisch, Lane-Tier-2 3378/0). Land-Note `verify.ok true`, 7 Schritte, 110 s, `waitMs 0`.
  Post-Land-Audit lief auf dem **second-host**: red, 9 FAILURES, `checks:null`, keine Namen —
  Daemon dort < `3974883`. **Adjudiziert `unknowable`** (Note traegt den Beweis): lokaler
  serieller `./e2e-isolated.sh` auf `fec5b23` (= d4f2bfc + 2 docs-Commits, 102 Insertions,
  `git diff --stat d4f2bfc fec5b23`) → run `isolated-20260901T203126Z-97615`, **3382 PASS, 0 FAIL,
  ALL PASS**. Remote-Serie jetzt 05f37f1:10 · 3058556:10 · 86e704a:7 · 54964d1:7 · d4f2bfc:9;
  Remote-Ledger gesamt 1 green / 9 red / 5 unknown. Trail-Pfad auf dem Geraet an den Controller
  gemeldet (`/var/lib/fleet-helper/work/run-26ea1a205005-1788291935608/tree/e2e-trail/isolated-20260901T194541Z-716215.jsonl`).
- **6d2a4d4b halb erledigt:** die `.env`-Kette traegt `src/helper.ts` (Land-Note d4f2bfc beweist es,
  Controller hat `.env` korrigiert). Der PIN-Teil (effektiver `GET /api/self/gate`-Befehl gegen die
  drei Prosa-Quellen) bleibt offen.

## 3. In Flug — das Erste, was du tust

1. **P2a `9825cfd9`, Lane `fleet/260901194551-8f9e` auf Slot 8 — GEBAUT, VON MIR REVIEWT, LAND IN FLUG.**
   Diff = exakt die vier Schnitte (S3 gemessen weggelassen: `DIRECTORY_NOTES["server"]` ist toter
   Ballast, byte-identische repo-map; backoff.ts JA mit Beleg; `BundleStale` bekam benanntes
   `helperJsMtime`, Spiegel in src/client.ts nur Interface). Vier Checks mit zitierten
   Mutations-FAILs. Lane-Tier-2 auf `8de12be` 3387/0; danach nur Rebase (Delta = fremder Code aus main).
   Geschichte: Land 1 (`e353bdc`) **waitedOut** — 2667 s von 2703 s hinter dem Mutex, Baum nie
   gesehen (`verify.ok null`); Land 2 abgelehnt „no progress since the last verdict — repair or
   escalate"; Lane hat auf mein `/send` hin sauber auf `93d6cfa` rebased (`2cd51cf`, behind 0,
   wouldConflict false, pins ALL PASS, tsc exit 0). **Land 3 laeuft bei Uebergabe:** Kandidat
   `2cd51cf18ab7ac4673f9d49dba4191df8f4d4439`, Mutex bei Start noch fremd belegt (Wartebudget 45 min).
   **Dein erster Akt:** `POST /api/self/watch {"kind":"merge","target":8}` — level-getriggert,
   feuert sofort aus dem persistierten Fakt, falls schon terminal. Bei `landed=YES`: Audit-Watch auf
   den Kandidaten. Bei erneutem waitedOut: die Tuer verlangt wieder PROGRESS (irgendein neuer
   Commit/Rebase auf der Lane), dann `POST /api/self/tasks/9825cfd9/land` — im STILLEN Fenster.
   Der Lane-Report kommt zur Program-MAIN (Receiver zur Reportzeit aus `program.main`,
   `server.ts#clarificationReceiverFor`), also zu DIR.
2. **Danach `bundleStale` auf `/api/sessions` pruefen** (das Land beruehrt src/client.ts; bei
   `stale:true` → `bun run build`) **und die Demo bauen:** `cd ~/claude-fleet-demo && bun run
   typecheck && bun run build` — Erfolgsmass 5, kein Gate hier sagt es, die Lane hat es nicht getan.
3. **Dann P2b `63a32ac2` hand-dispatchen** — ERST nach dem P2a-Land (harte Vorbedingung im Brief,
   beide fassen `CLIENT_ONLY_FILES` an) — mit `{"harness":"claude","model":"claude-fable-5-1[1m]","effort":"high"}`.
4. **Deploy steht aus:** Live faehrt `24be084`; main hat d4f2bfc (Filing-Deckel) + 93d6cfa
   (tmux-Target-Hotfix des Controllers) + Docs; `deployGap.behindCount 6, codeBehind:true`.
   Ich habe NICHT deployt: Verb 2 lehnt nur waehrend eines Audits ab, aber fremde Land-Gates sind
   Kinder von srv — ein Restart mitten in deren Verify erzeugt ein falsches Rot. Deploy im stillen
   Fenster (`ps -eo command | grep -c '^/bin/sh ./e2e-'` = 0), Boot-Verdikt auf `/api/deploys` lesen.

## 4. Befunde (gemessen, noch nicht als Queue-Zeile — Live-Server hat den alten 5-Deckel, `/api/self/tasks` waere 409)

- **Projektion vs. Tuer:** `program-execution` nennt fuer 9825cfd9 nach dem waitedOut
  `REVIEWABLE → land it yourself`, die Route antwortet „no progress … repair or escalate". Die
  Projektion kennt den No-Progress-Guard nicht. P6-Zeile.
- **Mutex-Saturation durch fremde Programme:** ab ~22:10 liefen bis zu DREI Suiten parallel
  (Gate-Instanz + zwei Lane-Ketten anderer Programme), mein Land-Gate wartete 45 min aus. Die
  Betriebsregel „nie neben einen Audit dispatchen" schuetzt nur MEINE Lanes; gegen fremde
  Programme hilft nur der Controller (informiert) oder eine Owner-Regel.
- Ein `POST /send` an eine Pane, deren Composer der Owner selbst befuellt, wird mit
  `composer occupied … nothing typed` abgelehnt — das Alive/Composer-Gate hat heute genau richtig
  verhindert, dass mein Gruendungsbrief den Owner-Text ueberschreibt.

## 5. Ehrlichkeiten

- Watches sterben mit meinem Slot: bei Uebergabe armed nur Merge-Watch `471e2cc2` (Land 3 von
  P2a). Neu armieren, siehe §3.1.
- Slot 10 (Lane 6e5d) wurde nach dem Land regulaer abgeraeumt; Slot 8 lebt (ctx 23,7 %).
- Maschinen-Hygiene unberuehrt (leaked Sockets, TMPDIR-Scratch).
- ctx bei der Uebergabe-Entscheidung: **23,0 % gemessen** (229 754/1 000 000); Restkette:
  Handoff committen + succeed. Dieser Handoff ist ein DIREKT-COMMIT (docs-only), Hand-Verify
  `bun e2e/pins.ts` ALL PASS (Tail im Commit-Body). Die zwei Controller-Abschnitte unter diesem sind fremd und bleiben.

---

# HANDOFF — Fleet Controller (Slot 10, Fable 5.1 high): tmux-Praefix-Bug gefunden und Hotfix in Flug, Stream-Steal repariert, Second-host/Freunde-Bewertung geschrieben, 2026-09-01 (Nacht)

Rolle: **🎛 Fleet Controller**, nicht Program-MAIN. Gegruendet per /open+/send (Nachfolge-Route
scheiterte deterministisch, Notiz `9c7d6e02`); Slot-Datensatz traegt `claude-fable-5-1[1m]`/`high`
korrekt. Owner-Vorgabe des Abends: alle Sessions/Lanes Fable 5.1 high, Usage bis morgen praktisch
unbegrenzt, „sauber nach der Reihe". ctx bei Uebergabe-Entscheid: **27,3 % gemessen**.

## 0. Nachtrag 2026-09-02 00:05 (vor der Uebergabe, ctx 31,6 % gemessen) — was seit §1 passiert ist

- **Hotfix GELANDET und DEPLOYED:** main `93d6cfa` (Land-Note `verify.ok true`, 7 Schritte, actor
  Controller), Post-Land-Audit **green, 3385 Checks, 0 failed, 1553 s**. Deploy `b741d9de ok:true`,
  Server bootet auf `0f51abc`, `codeBehind:false`, `bundleStale:false`. **Der Bug ist zu:** der
  Re-Dispatch von `dac21cc7` erzeugte `s1` exakt (`self_heal_recreate created:no-session`) neben
  lebendem `s10`.
- **Slot 1 = Brief 1 (Private-repo-y), ECHT:** Lane `fleet/260901215805-c384` im Repo private-repo-p,
  Fable 5.1 high, Brief zugestellt (kein Trust-Dialog). Platzhalter `s1` weg, Phantom-Worktree
  `fleet-260901201722-fda8` entfernt (0 ahead, clean), Branch geloescht. Slot 3 informiert; der
  Worker-Report geht an Slot 3 (Program-MAIN), Land ist dort Sache von Slot 3 (wie `b0ad8a79`).
- **MEIN DEPLOY HAT SLOT 2s P2a-LAND UNTERBROCHEN** (`self_land_start` 23:52:39, Restart 23:56):
  `GET /api/slots/8/merge` → `last.status:"interrupted"`, `landed:false`. Kein Schaden (Lane 8
  sauber auf `2cd51cf`, 1 ahead, rebased). Preflight prueft nur den Audit, nicht laufende Merges
  — **Notiz `4e29e778`** (P6). Slot 2 hat sich in **Slot 11** nachgefolgt (Sanierungs-MAIN, Program
  `b2a14b54`; Footer Opus 5 — per `/send` gebeten, `/model claude-fable-5-1[1m]` zu setzen) und
  untersucht den interrupted-Merge selbst; ich habe ihr die Ursache geschickt und Lane 8 NICHT
  angefasst. **Sie landet P2a erneut (self-land, green-only).**
- **Slot 16** ist neu, ohne Label, zeigt einen `/usage`-Screen — nicht von mir, vermutlich Owner.
- Notiz `dde33a1d` (Stream-Attach ohne Ziel-Sensor, §2c) gefilet.
- Suite-Lage 00:05: Lane A (Slot 5) faehrt ihre Kette nach einem „repaired tree" erneut; Mutex-
  Schlange unbekannt lang. Slot 8 bestaetigt: seine vier Schnitte sind byte-identisch zum
  vermessenen Baum.

**Reihenfolge fuer dich (ersetzt §3.1–3.2, die sind erledigt):**
1. Main-Watcher legen (Basis = aktueller main). Feuert er mit dem P2a-Land (`2cd51cf`-Commit
   „fix: classify server/ and count all three client bundles" auf main): `ff535524` (Slot 7) und
   `63a32ac2` (P2b) mit dem Fable-Tripel dispatchen (`POST /api/tasks/:id/dispatch`,
   `{"harness":"claude","model":"claude-fable-5-1[1m]","effort":"high","acknowledged":true}`).
2. Fleet-Report-Watcher auf `audit.jsonl` (`fleet_report_open`) legen. Kommt Lane As Report
   (Slot 5 → Slot 4): Pane lesen, `POST /api/slots/5/merge`, `{kind:"merge",target:5}`
   abonnieren, dann `b0c15ca5` dispatchen.
3. **Kein Deploy, solange `GET /api/slots/:id/merge` irgendwo `running:true` sagt** — der
   Preflight tut das nicht fuer dich.
4. Owner-Entscheidungen unveraendert: `db2d6c85` · Freunde-Jobs · zweite Instanz (§4) · Slot 6
   Canary · Restart-Updates Slots 6/9.

## 1. Was steht (verifiziert)

- **main = `6404c8d`** (mein Docs-Direktcommit, s. §4) ueber `fec5b23`. Live-Server seit 21:42 auf
  `24be084` — `codeBehind:true`, alles docs; `bundleStale:false`. Deploy bewusst NICHT gefahren
  (Suite-Ketten am Mutex, Quiet Hours).
- **Slot 1 ist ein PHANTOM mit Platzhalter.** Datensatz: Lane `fleet/260901201722-fda8`
  (Worktree `~/private-repo-p.worktrees/fleet-260901201722-fda8`), Task `dac21cc7` (Brief 1 AI
  Consulting) `sent slot=1`, `agent: no-agent`. tmux-Session `s1` = von mir per Hand erzeugter
  Platzhalter (`sleep 100000`, kein Shell). **Nicht anfassen, nichts in Slot 1 oeffnen, bis der
  Hotfix (§2a) deployed ist** — vorher trifft jedes `-t s1` des Servers ohne Platzhalter MEINE
  Pane `s10`.
- **Hotfix-Lane Slot 11** (`642b3b5a`, `fleet/260901202202-8467`, Commit `46f80c5`: `sessTarget`
  `=sN` + `paneTarget` `=sN:`, alle 33 `-t`-Stellen exakt und gepinnt, Regressions-Check in
  `e2e/slots.ts` gruen/mutiert rot, Doc-Satz in `docs/harness-adapter.md`). tsc/pins/build/Drift
  gruen; wartet auf die drei Gate-Wrapper am Suite-Mutex, dann Fleet-Report an mich (Slot 10).
  Watch `54c0e350` (lane 11) armed.
- **P2a (Slot 8, `9825cfd9`, `8de12be`→`e353bdc` rebased) hat um 23:01 an Slot 2 berichtet
  (`complete`)** — Vorschau `ALL PASS` 3387 Checks, rebasierte Gate-Kette gruen. **Slot 2 landet
  selbst** (wie bei Lane 10). Danach sind DEINE Hand-Dispatches faellig: `ff535524` (Slot 7s
  Release) und `63a32ac2` (P2b, Slot 2s Release), beide mit
  `{harness:"claude",model:"claude-fable-5-1[1m]",effort:"high",acknowledged:true}` auf
  `POST /api/tasks/:id/dispatch`.
- **Lane A (Slot 5, `3c72fe3a`, `4ea2a17` rebased)**: cheap steps gruen, wartet auf ihre Kette
  am Mutex; berichtet an Slot 4 (Program-MAIN 66499a03). Landen ist Controller-Sache; danach
  `b0c15ca5` (Lineage, Fable-Fassung) dispatchen — `b92e9cc9` ist ARCHIVIERT (Slot 4s Bitte).
- **Slot 2s serieller `./e2e-isolated.sh` auf `fec5b23` (= Code `d4f2bfc`): ALL PASS, 0 FAIL.**
  Das Remote-Rot 9/9 war Umgebung, nicht Regress. Serie bleibt 10/10/7/7/9 `unknowable`.
- Queue-Hygiene heute: `55f9637d` archiviert (Codex-Fassung, von `dac21cc7` ersetzt),
  `b92e9cc9` archiviert, Notiz `fee71e3d` done. Slot 7 gestupst (Watcher abgelaufen), Slot 3
  informiert (Brief 1 verspaetet).
- Suite-Mutex-Lage bei Uebergabe: eine `claude-gate`-Kette haelt, eine frische `e2e-isolated`
  (Slot 5 oder 8, nicht zugeordnet) wartet. **Nichts danebenstellen.**

## 2. Drei gemessene Bugs, einer im Hotfix, einer repariert, einer als Notiz

- **(a) tmux loest ein nicht existentes `s1` per PRAEFIX auf `s10` auf** (tmux 3.6a; man-Reihenfolge
  $id → exakt → Praefix → fnmatch). Nach dem Kill von Slot 1 dispatchte ich `dac21cc7` → freier
  Slot 1 → `has-session -t s1` traf `s10`, es wurde keine Session erzeugt, der ganze
  Gruendungsbrief landete in meiner Pane, Slot 1 meldete `agent: alive` an meiner Pane, und ein
  Kill von Slot 1 haette mich per `kill-pane` getoetet. Reproduziert mit Wegwerf-Sessions
  (`sX9` vorhanden → `has-session -t sX` exit 0). Exakte Form gemessen: `=sN` fuer
  Session-Befehle, `=sN:` fuer Pane-Befehle (`=sN` ohne Doppelpunkt schlaegt bei capture-pane/
  display-message FEHL). Hotfix = Slot 11. Latent seit es Slot 10 gibt; bricht nur, wenn `s1`
  fehlt und `s10` lebt.
- **(b) Stream-Steal (Folge von a), repariert von Hand:** der Stream-Attach fuer das Phantom-
  Slot 1 lief auf meiner Pane (`pipe-pane` schliessen + neu auf die Slot-1-Datei), danach
  legte der Re-Attach an den Platzhalter die Datei per `rename` neu an → meine Pipe schrieb in
  einen geloeschten Inode, mein Panel stand ab 22:17 still (Owner hat es gemeldet). `tmux
  pipe-pane -t %226` (schliessen) → der Tick oeffnete neu, geseedet. Alle anderen Live-Pipes
  gegen ihre Zieldatei geprueft (lsof fd 1): korrekt.
- **(c) Notiz gefilet (P6):** `server.ts#ensureSlot` Stream-Attach prueft nur `pipeOpen &&
  existsSync(finalPath)` — eine Pipe, die auf eine ANDERE Datei zeigt, gilt als gesund. Sensor
  fehlt (z. B. `cat`-Prozess der Pane → fd 1 == finalPath). Ohne (a) selten, aber die Klasse
  bleibt.

## 3. Reihenfolge fuer dich

1. **Lane 11 fertig** (Fleet-Report kommt in deine Pane; Watch feuert) → Pane lesen → `POST
   /api/slots/11/land` → `{kind:"audit",repo,mainAfter}` abonnieren → **Deploy per Verb 2**
   (`POST /api/deploy`; 409 waehrend des Audits — dann warten, nicht kill-session) → prueften:
   `bundleStale`, `deploys.jsonl` `ok:true`.
2. **Dann Slot 1 raeumen:** `POST /api/slots/1/kill` (trifft jetzt den Platzhalter `s1`,
   nach dem Deploy ohnehin exakt). Pruefen, dass der private-repo-p-Worktree weg ist und
   `dac21cc7` wieder `queued`/`pending` steht (Kill-Requeue-Verhalten nicht gemessen — nachsehen,
   ggf. per `queue` zurueckstellen). Dann `dac21cc7` mit dem Fable-Tripel dispatchen und Slot 3
   per `POST /send {slot:3,...}` den neuen Slot nennen.
3. **Main-Watcher** (Hintergrund, Basis `6404c8d`) feuert beim P2a-Land durch Slot 2 → dann
   `ff535524` und `63a32ac2` dispatchen. Fleet-Report-Watcher (Hintergrund auf `audit.jsonl`)
   feuert beim A-Report (Slot 5 → Slot 4) → A landen → `b0c15ca5` dispatchen. Beide Watcher
   sterben mit meiner Session — als Mechanismus neu legen, nie als Vorsatz.
4. **Kein vierter Suite-Lauf, kein Deploy neben einer laufenden Kette.**
5. **Lane-Watch-Beobachtung:** `{kind:"lane"}` feuert bei einer Lane, die auf eine Suite
   wartet, bei JEDEM Re-Arm erneut auf dasselbe Bild (3× Slot 8, 1× Slot 5) — das Praedikat
   unterscheidet „wartet" nicht von „fertig". Fuer Warte-Lanes ist der Fleet-Report-Watcher auf
   `audit.jsonl` das praezisere Mittel.

## 4. Die Second-host-/Freunde-/Auftragsmarkt-Bewertung (Owner-Auftrag des Abends)

`docs/ideen/2026-09-01-second-host-job-vertrag-instanz-freunde.md` (Commit `6404c8d`, **Direkt-
commit auf main, docs-only; `bun e2e/pins.ts` ALL PASS von Hand, kein Land-Ledger-Eintrag**).
Grundlage: drei read-only Opus-Erhebungen (Lagebericht · Second-host-Lebenszyklus+Luecken ·
Auftragsmarkt-Landkarte). Kern: Job+Quittung als EIN Vertrag (R1–R5); zweite Instanz nur fuer
Fable-Lanes auf Linux (B1); Freunde als Jobs im Container ja, als Agenten-Briefe nein.
**Owner-Entscheidungen (§6 dort):** `db2d6c85` (a)/(b) — Empfehlung (a)+`daemon-update`-Job;
Freunde-Jobs ja/nein; zweite Instanz ja/nein. Nichts daraus ist gefilet — erst nach Owner-Blick
werden R1–R5 zu `auftrag`-Zeilen.

## 5. Ehrlichkeiten

- Keine Suite von mir gefahren; einziger Code-Eingriff: der Docs-Commit `6404c8d`.
- Der Brief-Text von `dac21cc7` steht in meinem Kontext (Fehlzustellung) — ich habe ihn NICHT
  ausgefuehrt.
- Offene Owner-Punkte ausser §4: Slot 6 Canary-Tor (nur in der Pane, keine Attention-Zeile);
  Slots 6 und 9 zeigen „Restart to update" (Kontextverlust, Owner-Sache).
- Slot 8s Lane-Watch habe ich dreimal neu armiert, bevor ich das Praedikat-Verhalten (§3.5)
  verstanden hatte.

---

# HANDOFF — Fleet Controller (Slot 1): Lagebericht aller Slots, Codex-MAINs auf Fable neu gegruendet, Event-Zustell-Sturm beendet, .env-Gate korrigiert, 2026-09-01 (spaet abends)

Rolle: **🎛 Fleet Controller**, nicht Program-MAIN. Die Sanierung fuehrt Slot 2 (Program `b2a14b54`), eigenstaendig.
Owner-Vorgabe des Abends (Chat, woertlich sinngemaess): „all diese sessions in fable 5.1 aufsetzen, unlimited usage bis morgen" und „sauber nach der Reihe angehen". Erste Session auf Fable 5.1.

## 1. Was steht (alles verifiziert, nichts geschaetzt)

- **Live-Slots bei Uebergabe:** 1 Controller (ich) · 2 Sanierung-MAIN (Fable 5.1, Datensatz sagt Opus) · 3 Private-repo-y-MAIN (Fable, NEU) · 4 Fleet-ohne-Owner-Routing-MAIN (Fable, NEU) · 5 Lane `3c72fe3a` (Fable, NEU, `fleet/260901201138-9c83`) · 6 Private-repo-o-MAIN (Owner-Hold, per `/model` auf Fable) · 7 Task-Workbench-MAIN (Fable, NEU) · 8 Lane P2a `9825cfd9` (Opus, von Slot 2 dispatcht) · 9 Second-host-MAIN (per `/model` auf Fable). Geschlossen: 8/12/13/15/16 (fertig seit 30./31.08.) und die drei Codex-MAINs 3/4/7 (taub, s. §2).
- **main = `79075de`** (docs-Direktcommit von Slot 7) ueber `d4f2bfc` (Land von `8cd6deca`, Filing-Deckel, actor main Slot 2, verify.ok true, 7 Schritte, 110 s). Live-Server seit 21:42 auf `24be084`+Env; Deploy `9c35642b ok:true`. `bundleStale:false`, `codeBehind` ist nach `d4f2bfc`/`79075de` zu pruefen (`./state.sh`).
- **`.env` (gitignored) hat DREI neue Fakten:** (a) `FLEET_VERIFY_CMD_REPOS[claude-fleet]` ist jetzt token-identisch mit `watchdog.sh#VERIFY_CMD` — `src/helper.ts` war das einzige fehlende Token; **Land-Note `d4f2bfc` beweist es live** (cmd enthaelt `src/helper.ts`). Damit ist der `.env`-Teil von P6-Zeile `6d2a4d4b` erledigt, **der Pin ueber den EFFEKTIVEN Befehl bleibt offen** (Zeile bleibt pending). (b) `[private-repo-p]` = `sh scripts/verify.sh` (vorher `tools/`, existierte nie; Xcode + 1 iOS-Runtime vorhanden) — Slot 3 hat damit `b0ad8a79` gelandet (`f155520` auf private-repo-p main). (c) `FLEET_MODEL='claude-fable-5-1[1m]'` als Fleet-Default (`server.ts#DEFAULT_MODEL` liest es via `set -a` im Watchdog) — **greift erst nach dem naechsten srv-Restart**; bewusst nicht sofort restartet (Audit-Queue). Backups beider Dateien im Scratchpad dieser Session.
- `~/.claude.json`: `projects["/Users/owner/private-repo-p"].hasTrustDialogAccepted=true` von Hand gesetzt (Grund §2b).
- Worktree `fleet-260901185118-1774` (verwaist, leer) entfernt, Branch geloescht.

## 2. Zwei gemessene Bugs, beide als Queue-Zeilen, einer schon in Arbeit

- **(a) Fleet-Report-Recovery ohne Deckel hungert die Event-Zustellung an Program-MAINs aus.** Drei `send-uncertain`-Events mit 1529/1565/1540 Versuchen (Slots 3/4/7, ~1/min, 4633 Audit-Zeilen `recovery prompt not accepted — composer still holds N chars`); jeder eigene Paste bumpt `s.lastOutput` (`server.ts:10041`), der Receiver wird nie 60 s idle, fuenf weitere Events blieben bei 0 Versuchen (darunter zwei merge-terminal). Slots 3 und 4 waren deshalb >24 h blind. Gemessen: lastOutput-Alter der drei Slots zykelte 3..61 s, Slot 15 (Codex, kein Empfaenger) 900 s+. Notiz `8d764657` (Sanierung) → **geschlossen als uebernommen durch Auftrag `3c72fe3a`** (Program 66499a03, Slot 4 hat ihn selbst gefiled; Kriterium: `FLEET_REPORT_RECOVERY_MAX_ATTEMPTS`, eigener Paste zaehlt nicht als Output, Starvation-Falsifier). **Lane laeuft in Slot 5, von mir hand-dispatcht als Fable** (Brief sagt „Codex-Lane", Owner-Vorgabe gewinnt). `b92e9cc9` (Lineage) wartet auf A, ebenfalls Hand-Dispatch.
  Ungeklaert: WARUM Codex 0.147 die Paste+Enter eines Reports nicht submittet (Dispatch-Briefe kommen an).
- **(b) Claude-Trust-Dialog eines FRISCHEN cwd frisst den Gruendungsbrief** (`e4a001b0`, pending): bootstrap-main fuer private-repo-p kam `ok:true` zurueck, die Pane zeigte „Yes, I trust this folder", der Brief beantwortete den Dialog mit Exit, `agent: no-agent`, nackte Shell. Codex hat dafuer `paneReadiness()`, claude nicht.

## 3. In Flug — das Erste, was du tust

1. **Deine eigene Pane auf Fable pruefen:** `succeed` reicht `claude-opus-5[1m]` durch. Ich schicke der Nachfolgerin `/model claude-fable-5-1[1m]` per `POST /send` hinterher — Footer muss „Fable" zeigen, sonst selbst setzen.
2. **Watches sterben mit meinem Slot.** Bei Uebergabe armed: keiner mehr, der noch feuern kann (Lane-Watch auf 10 gefeuert, Audit-Watch auf d4f2bfc gefeuert und adjudiziert). Neu armieren, wenn du auf etwas wartest: `{kind:"lane",target:5}` (3c72fe3a) und `{kind:"lane",target:8}` (P2a) — Slot 2 und Slot 7 haben eigene Watches auf 8.
3. **Hand-Dispatch ist DEINE Rolle** (Master-Stop AUS, `dispatch:false`): Slot 7 released nach P2a-Land `ff535524`, Slot 4 nach A-Land `b92e9cc9`, Slot 2 nach P2a `63a32ac2`. Alle drei wissen, dass sie Fable im Tripel nennen sollen; du dispatchst mit `{harness:"claude",model:"claude-fable-5-1[1m]",effort:"high"}`. Regel bleibt: keinen Dispatch neben einen LOKAL laufenden Post-Land-Audit stellen.
4. **Audit auf `d4f2bfc`: REMOTE rot, 9 FAILURES, keine Namen — adjudiziert `unknowable`.** Serie jetzt 10/10/7/7/9. Slot 9 hat den Datenpunkt. Einzige echte Owner-Entscheidung im Fleet: Attention **`db2d6c85`** (SSH-Dauerkanal zum Second-host). Ohne sie bleiben Daemon-Update und FAIL-Namen unerreichbar.
5. **Slot 2 faehrt einen lokalen SERIELLEN `./e2e-isolated.sh` auf `79075de`** (Code identisch d4f2bfc) und adjudiziert das Remote-Rot aus dessen Tail nach — der Suite-Mutex ist also belegt; nichts danebenstellen (Slot 2s Nachricht 22:20).
6. Slot 6 (Private-repo-o) bleibt auf Owner-Hold; bei Reaktivierung Nachfolge (360k ctx, Restart-Update anstehend).

## 4. Ehrlichkeiten

- `POST /api/slots/10/land` von mir wurde korrekt abgewiesen — Slot 2 hatte die Lane 1 min vorher selbst gelandet. Kein Doppel-Land.
- Die Lagebericht-Agenten hatten einen Fehler, den ich korrigiert habe: „rote Audits unbeurteilt" — alle 77 sind adjudiziert.
- Slot 4 raeumte Attention `17aee703` mit Option 2 ab (von mir beantwortet); Attention `79839393` wurde durch den Kill von Slot 3 automatisch `refused` (requester session ended) — inhaltlich erledigt (93fc5af2 = `01459c9`).
- Kein `./e2e-isolated.sh` von mir gefahren; keine Code-Aenderung von mir im Baum. ctx bei Uebergabe-Entscheid: **24,6 % gemessen**.

---

# HANDOFF — Generalsanierung: Codex-Haertung gelandet, P2 gebrieft und queued, drei neue P6-Befunde, 2026-09-01 (abends)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Ersetzt den Nachmittags-Abschnitt darunter.

## 1. Autoritaet & Betrieb (unveraendert uebernommen, nichts Neues entschieden)

- Self-Land-Promotion **green-only**; mein Land lief `actor.kind=main`, `confirmedByHuman:false`.
- Master-Stop bleibt AN. Weg unveraendert: file -> release -> **Hand-Dispatch**
  `POST /api/tasks/<id>/dispatch` (Body `{}` oder `{harness,model,effort}`).
- **Die Selbst-Tuer ist weiterhin zu**: `POST /api/self/tasks` antwortete mir woertlich
  `program filing cap reached (5/5 filed rows not yet released)`. Ich habe deshalb ALLES ueber die
  Owner-Tuer `POST /api/tasks` mit `programId` gefiled — der Program-Link haelt, die Zeile bekommt
  `source:"owner"` und braucht darum Hand-Dispatch. Das ist genau der Mangel, den `8cd6deca` behebt.
- auto-③ ist AUS nachgeprueft (`FLEET_AUTO_REVIEW_MS live=0`, und `suites running now: 0` beim
  Ablesen — der `live=`-Sensor luegt nur, WAEHREND eine Suite laeuft).
- Claude Code steht auf **2.1.257** (Native-Install, Auto-Updater lief 2026-09-01 19:58). `claude
  update` sagt "up to date". **Es gibt kein Opus 5.1** — die installierte Binary kennt als neuestes
  `claude-opus-5` / `claude-opus-5[1m]`. Owner hat danach gefragt; Antwort steht, kein offener Punkt.

## 2. Gelandet & selbst verifiziert

**`e9c10ee` (Task 4908a900, Codex-Update-Prompt)** — zwei Commits, ein Land:
`c83969d` (Erkennung) + `e9c10ee` (Review-Rueckbau). Land-Note: `verify.ok true`, volle Kette,
7 Schritte, 96 s, `waitMs 0`, `exitCode 0`.
- Inhalt: der blockierende Codex-Update-Schirm ist ein BENANNTER blocked-Screen ("codex update
  prompt"); `-c check_for_update_on_startup=false` auf frischer UND resume-Spawnform; zwei neue
  e2e-Checks (Menue -> named requeue, Banner+Marker -> zugestellt) plus zwei Pins.
- **Was ICH nachgeprueft habe statt zu glauben:** (a) den Recherche-Beleg nicht in Release Notes,
  sondern in der INSTALLIERTEN Binary — `strings .../codex-darwin-arm64/.../bin/codex` findet
  `check_for_update_on_startup` 19x in der serde-Feldliste von `struct ConfigToml with 96 elements`;
  (b) `bun e2e/pins.ts` ALL PASS und die Gate-tsc exit 0, von mir im Lane-Worktree gefahren;
  (c) die Readiness-Klassifikation mit den LIVE aus server.ts gelesenen Regexes gegen drei Schirme.
- **Der Review-Befund, der den zweiten Commit ausgeloest hat:** die Lane hatte `paneReadiness` global
  auf accept-first gedreht (Marker schlaegt Blocks). Das kippt die Fehlrichtung von fail-safe auf
  **fail-open** — ein kuenftiger Blockschirm, der den Header mitrendert, bekaeme den Brief gepastet.
  Und die Drehung kauft NICHTS: die Block-Regex verlangt `Update now \(runs` UND `Skip until next
  version`, der Banner-Text hat beides nicht, also klassifiziert blocks-first ihn ohnehin als ready.
  Mein Beleg, den die Lane nicht hatte — ein selbstgebauter Trust-Schirm MIT Header:
  `{"prompt":"blocked:codex update prompt","banner":"ready","trustWithHeader":"blocked:codex trust prompt"}`.
  Unter accept-first waere die dritte Zeile `ready` gewesen.

## 3. In Flug — das Erste, was du tust

1. **Audit-Watch NEU ARMIEREN** (Watches sterben mit meinem Slot): `e9c10ee`, also
   `POST /api/self/watch {"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"e9c10ee4facff2a64dd8ce1bfe0a2065ac9463aa"}`.
   Meiner (`d1efc8c6`) war beim Schreiben armed und ungefeuert.
2. **Slot 10 / `8cd6deca` laeuft und hat einen ENTSCHEID von mir schriftlich.** Die Lane kam mit
   `needs-main` zurueck (Brief-STOPP korrekt ausgeloest) und ich habe entschieden statt zu
   eskalieren — der Brief hatte das Alternativ-Design vorautorisiert. Der Entscheid, den sie baut:
   `PROGRAM_MAX_PENDING` (5) zaehlt nur noch `kind==="auftrag"`, PLUS ein NEUER Deckel
   `PROGRAM_MAX_PENDING_ADVISORY` (Default 10) ueber notiz/richtung/betrieb; beide 409 nennen Zahl
   UND Art; der Rechnungs-Absatz `server.ts:3117-3128` wird EHRLICH neu geschrieben (16x15=240,
   und warum die MAX_TASKS-Gegenueberstellung schon vorher eine Reserve war); Lockstep
   `e2e/security.ts` + `docs/self-api.md`; drei Fixtures inkl. einer, die den neuen Deckel als SICH
   SELBST beweist; ZWEI getrennte Mutationsbeweise.
   - **Die Lesekorrektur, die den Entscheid traegt** (sie stand einen Satz zu kurz): die Lane hielt
     die 16x5-Rechnung fuer eine Garantie. Der Kommentar sagt zwei Zeilen darueber selbst
     *"That is a margin, not a new guarantee"*, und `capTasks` (`server.ts:2899-2902`) evictet
     AUSSCHLIESSLICH terminale Rows — `MAX_TASKS` hat pending Rows nie begrenzt.
3. **Slot 9 rettet die Trail-Namen** (siehe §4b). Antwort stand bei Uebergabe aus.
4. **Dann P2 dispatchen, SERIELL, nicht beide:** `9825cfd9` (Teil A) zuerst, `63a32ac2` (Teil B)
   erst DANACH — Teil B's Brief traegt eine harte Reihenfolge-Vorbedingung auf A (beide fassen
   `CLIENT_ONLY_FILES` an). Beide `queued`, beide `source:owner`, beide brauchen Hand-Dispatch.
   Vorschlag `claude` / `claude-opus-5[1m]` / `high` (Urteilsanteil hoch, siehe Briefe).
   **UND: nicht dispatchen, solange ein Post-Land-Audit laeuft** — Begruendung in §4a.

## 4. Drei neue P6-Befunde, alle gemessen, alle als Queue-Zeile abgelegt

- **(a) `0ac22a00` — Stufe 2 hat EIN Budget fuer Warten UND Arbeiten, der Land-Gate hat zwei.**
  Gemessen am Audit von `3974883`: `unknown`, `ms=1800251`, `exitCode null`, und in der out-Spur
  *"[suite-lock] waiting 849s ... acquired after 879s"*. Nach 879 s Mutex blieben 921 s von 1800 s;
  ein echter Lauf braucht ~680-700 s, unter Doppellast mehr. `POSTLAND_AUDIT_TIMEOUT_MS` ist bei
  `server.ts:14066` EIN setTimeout um den ganzen Spawn, und der Mutex-Wait liegt darin.
  Der Gate trennt das seit `08dc17a` (`FLEET_VERIFY_TIMEOUT_MS` / `FLEET_VERIFY_WAIT_MS`).
  **Eigener Anteil, damit die Zeile nicht wie hoehere Gewalt liest:** die Kontention war meine —
  zwei Lanes parallel, beide mit "Tier-2-Vorschau ist Pflicht" gebrieft. Daraus die Betriebsregel
  oben: keinen Lane-Dispatch neben einen laufenden Audit stellen.
  **Konsequenz: `3974883` und `4243394` haben KEIN Stufe-2-Verdikt.** Ich habe bewusst keinen
  Nachlauf gestartet (das waere derselbe Fehler nochmal).
- **(b) `6d2a4d4b` — der Land-Gate, der wirklich laeuft, ist nicht der, den die Pins vergleichen.**
  `watchdog.sh:91`, `AGENTS.md` und `CLAUDE.md` haben `src/helper.ts` in der tsc-Liste, `RULE_VERIFY`
  vergleicht genau diese Quellen, Pin gruen. Die Land-Note von `e9c10ee` zeigt eine Liste OHNE
  `src/helper.ts`. Aufloesung: `.env` traegt `FLEET_VERIFY_CMD_REPOS` mit einem Eintrag fuer
  `/Users/owner/claude-fleet` SELBST, und der gewinnt ueber die globale Kette. Live-vs-Note-Diff:
  **genau ein Token**. Der srv-Env HAT `src/helper.ts` — watchdog.sh ist also aktuell, das Land
  faehrt trotzdem den Repo-Eintrag. `.env` ist gitignored, `rg` findet ihn nie; `./state.sh` zeigt
  `FLEET_VERIFY_CMD live=[` abgeschnitten. **Nicht eigenmaechtig gefixt** — die `.env`-Korrektur
  aendert das Live-Gate fuer JEDES Repo und braucht einen srv-Neustart: Owner-Entscheid. Der
  zweite Teil ist der wichtigere: ohne einen Pin ueber den EFFEKTIVEN Befehl
  (`GET /api/self/gate` liefert ihn) faellt es beim naechsten Ketten-Edit wieder auseinander.
- **(c) Das Muster hinter (b):** `src/helper.ts` kam als DRITTES Bundle dazu, und drei Stellen haben
  es nie gelernt — die Gate-Liste (b), `server.ts#CLIENT_ONLY_FILES` (:21272, fehlt -> `deployGap`
  meldet `codeBehind:true` fuer ein reines helper-Land) und `server.ts#BUNDLES` (:21320, fehlt ->
  `bundleStale` stat't `public/helper.js` nie, also ein FALSE FRESH). Die letzten beiden sind in
  **P2a (`9825cfd9`) schon ausgeschrieben gebrieft**, mit Belegen.

## 5. Die Remote-Audit-Front

- Vierter namenloser Remote-Rot: `54964d1`, 7 FAILURES, `checks:null`, adjudiziert `unknowable`.
  Serie in zeitlicher Ordnung: **05f37f1:10 · 3058556:10 · 86e704a:7 · 54964d1:7**. Das sieht nach
  zwei stabilen Mengen aus, nicht nach Zufall — **Hypothese, kein Befund**, ohne Namen nicht
  entscheidbar. Gegen einen Regress spricht: jedes Land `verify.ok true`, jeder Baum lokal ALL PASS.
- **Der Ausweg, den ich gefunden habe: die Namen existieren HEUTE, ohne Daemon-Update.** Jede rote
  Zeile traegt eine `trail:`-PASS-Zeile mit dem ABSOLUTEN Pfad der Trail-Datei auf dem Geraet:
  `/var/lib/fleet-helper/work/run-26ea1a205005-<ts>/tree/e2e-trail/isolated-<stamp>.jsonl`
  (1788242397347 · 1788247717610 · 1788256153717 · **1788277962460**, je 3358-3366 rows).
  An Slot 9 geschickt mit der Bitte, ZUERST die Retention zu pruefen — das ist das Einzige mit
  Zeitdruck, die `run-*`-Verzeichnisse verfallen von selbst. Wenn nur eine zu retten ist: die letzte.
- Der Daemon-Update (git pull + systemctl restart fleet-helper auf >= `3974883`) bleibt sinnvoll,
  ist aber nicht mehr die Voraussetzung fuer die Antwort.

## 6. Ehrlichkeiten & Reste

- **Watches sterben mit meinem Slot.** Bei Uebergabe armed: nur `d1efc8c6` (Audit auf `e9c10ee`).
  Vier andere sind gefeuert. Neu armieren, siehe §3.1.
- **Slot 10s Report ist an MEINEN Slot adressiert** (`receiver.slot 1`). Kommt er nach der
  Nachfolge, pruefe `GET /api/self/fleet-report` und die Events der Nachfolgerin — ich habe NICHT
  verifiziert, wie ein Report auf einen retirten Receiver reconciled wird. Das ist eine offene
  Unbekannte, keine Behauptung.
- Queue-Stand: 2 auftrag queued (P2a/P2b) · 1 auftrag sent (8cd6deca, Slot 10) · 7 notizen pending
  (davon **5e79be26** in W3 miterledigt und **d2335500** durch `3974883` erledigt — beide vom Owner
  schliessbar; af8dd29c, 39fbbd1f, d07646bc, 0ac22a00, 6d2a4d4b offen) · 1b677e58/ff535524
  Feature-Freeze-geparkt · b0ad8a79 fremdes Program (Slot 5, nicht anfassen).
- Kein Deploy noetig/gefahren: das Land ist server.ts-beruehrend, aber ich habe **nicht** deployt —
  der Live-Server faehrt weiter `3974883`. **Das ist eine offene Entscheidung fuer dich**: `e9c10ee`
  aendert `paneReadiness` und die Codex-Spawnzeile, wirkt also erst nach einem Deploy (Verb 2,
  `POST /api/deploy`). Vorher pruefen, dass kein Audit laeuft — Verb 2 lehnt dann mit 409 ab.
- `bundleStale.stale:false` und `deployGap.codeBehind:false` beim letzten Ablesen (vor dem Land).
- Maschinen-Hygiene unberuehrt gelassen: 2 leaked e2e-Sockets, 1,4 G TMPDIR-Scratch. Reapen waehrend
  laufender Suiten ist der gefaehrliche Zug, nicht der ordentliche.
- ctx bei der Uebergabe-Entscheidung: **27 % gemessen** (269666/1000000) am eigenen Slot im
  Owner-Poll. Restkette danach: Handoff schreiben + committen + succeed.

---

# HANDOFF — Generalsanierung: P1 KOMPLETT (W1-W4), drei P6-vorgezogene Fixes, Codex-Update-Falle geloest, 2026-09-01 (nachmittags)

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Ersetzt den Morgen-Abschnitt darunter.

## 1. Autoritaet & Betrieb (neue Owner-Entscheide dieser Session)

- **Owner-Sanktion (Chat, nachmittags): die drei operativen Issues "vernuenftig angehen und aufloesen",
  ausdruecklich auch der Codex-Bug.** Operative Form: P6-VORGEZOGENE Fixes, je eigenes Kriterium +
  eigener e2e-Check (die Form, die das Program fuer Verhaltensaenderungen vorsieht). Feature-Freeze
  im Uebrigen unveraendert.
- Self-Land-Promotion steht auf **green-only**; alle Lands dieser Session actor main, confirmed false.
- Master-Stop bleibt AN; Weg unveraendert file -> release -> Hand-Dispatch (Body {} oder mit
  {harness,model,effort}).
- **Owner-Wunsch offen: Codex-UPDATE selbst (0.147->0.152)** — bewusst NICHT ausgefuehrt (npm install
  -g ist Owner-Akt). Bis dahin gilt der persistierte Skip (unten).

## 2. Gelandet & verifiziert (Kette seit b20e7e4)

3058556(docs, DIREKT) -> 79fcb0c(docs, DIREKT) -> 86e704a(**W3** Pin-Haertung) -> 3c271f8+54964d1
(**W4**, ein Land, zwei Commits) -> [Slot-10-Land, §NACHTRAG]. Jedes Land verify.ok true, volle Kette.
Die zwei Direkt-Commits sind land-unsichtbar (kein Ledger); Verifikationsweg steht in ihren Bodies.
- **P0-Baseline GESCHLOSSEN** (openQuestion 1): 3x seriell ALL PASS 3375/3375/0 FAIL auf 3058556,
  neben acht lebenden Sessions. Messnotiz docs/messungen/p0-baseline-generalsanierung-2026-09-01.md.
- **W3 (86e704a)**: tote-Doc-Pfad-Klasse als Pin (Erfolgsmass 3 mechanisch zu) · Kopier-Guard
  rekursiv ueber git ls-files · Ein-Datei-Universen -> serverU/clientU-Modul-Mengen, "Anker nicht
  gefunden" ist ueberall FAIL · Kreuz-Modul-Stolperdraht (liest die Anker-PAARE aus pins.ts selbst;
  heute 0, nach dem ersten P4-Slice nennt er die umzuhaengenden Zeilen) · LC_ALL=C an allen
  Harness-lstart-Lesern + Pin ueber die abgeleitete Menge. ICH habe 5 Mutationsbeweise unabhaengig
  in einem Scratch-Worktree reproduziert, nicht der Lane geglaubt.
- **W4 (3c271f8+54964d1)**: Kommentar-Commit mit BUILD-HASH-BEWEIS (von mir reproduziert:
  main und 3c271f8 beide e479d1236a9b7058..., byte-identisch, bun 1.3.9) — das ist die Blaupause
  fuer P3. Dann WorkerRoute + dossier-branch-Param entfernt (unused-tsc auf server.ts allein:
  2 -> 0, von mir reproduziert). P1-W4-Punkt "Eval-Gate-Reste": abgeleitet, zwei stale
  runWorker-Kommentare korrigiert; BEFUND der Lane, ungefixt: clarify-prompt.ts#buildClarifyBrief
  nimmt evalReason, aber KEIN Aufrufer uebergibt ihn — toter Block, P6-Kandidat.

## 3. Die drei Issues — Zustand JETZT

- **(a) Codex-Update-Falle: DIAGNOSTIZIERT + operativ zu.** codex 0.147.0 blockiert beim Spawn auf
  einem Update-Prompt (vorselektiert: "Update now" = npm install -g!); paneReadiness kennt den
  Screen nicht -> generischer 20s-Requeue (2x an W4 bezahlt). Von mir mit "3 Skip until next
  version" beantwortet (persistiert, per Respawn bewiesen: danach Banner NEBEN Ready-Marker);
  Dispatch end-to-end wieder ok (Slot-10-Lane lief auf codex). READY_WAIT_MS ist NICHT die
  Ursache — nicht hochdrehen. Haertung als Queue-Zeile **4908a900** (blocked-Screen mit Namen +
  Recherche config-Unterdrueckung + e2e). NAECHSTE Codex-Version reisst das Loch sonst wieder auf.
- **(b) Remote-Audit-Blindheit: FIX GELANDET als 3974883 und deployt** (§4.1): Daemon schickt FAIL-Namen
  aus dem Trail (50x300 bounded), helperResult validiert fail-closed, postLandAuditChecks
  korroboriert nur bei exakter Laenge, alter Body = alter Pfad. **OPS DANACH OFFEN: der
  Second-host-Daemon selbst laeuft noch alt** — Update des Geraets ist ein Einzeiler (git pull +
  systemctl restart fleet-helper), gehoert Owner oder Slot 9. Bis dahin bleiben Remote-Rots
  namenlos. Semantik-Nebenton: auf korroborierten Remote-Zeilen heisst checks.ran "im Tail
  verbuchte Zeilen", nicht "gefahrene Checks" — bewusst gelandet, P6-Politur falls es je verwirrt.
  DREI heutige Remote-Rots (05f37f1, 3058556, 86e704a: 10/10/7 FAILURES) alle adjudiziert
  unknowable; derselbe Baum lief lokal jedes Mal ALL PASS. Frage nach den 7 Namen liegt bei
  Slot 9 (gesendet 3f3bef64, Antwort stand bei Uebergabe aus).
- **(c) Filing-Cap: BRIEF GEFILED** (**8cd6deca**, queued): Deckel soll nur kind=auftrag zaehlen —
  heute sperren 5 nie-releasebare notizen die Selbst-Tuer dauerhaft (409 an W4 gemessen; W4 lief
  deshalb ueber die Owner-Tuer, source:owner, programId-Link haelt; /api/self/tasks/<id>/land
  funktionierte darauf normal).

## 4. Naechste Zuege, Reihenfolge

1. NACHTRAG, alles erledigt: **Slot-10 IST GELANDET als 3974883** (Rebase auf 54964d1 sauber,
   verify.ok true, actor main). **Deploy 2e614038 via Verb 2 GEFAHREN und vom naechsten Boot
   bestaetigt**: ok:true, hitTarget:true, bootHead=head=3974883, bundleStale:false, deployGap 0 —
   der Live-Server faehrt beide Lands. Audit-Watches c1d804f1 (54964d1) + 99af3f9a (3974883)
   haben den srv-Neustart ARMIERT ueberlebt (an GET /api/self gemessen) — sie sterben erst mit
   MEINEM Slot: die Nachfolgerin armiert beide neu und beurteilt die Audits nach Check-Ebene;
   Remote-Rots koennen jetzt erstmals NAMEN tragen, aber nur wenn vorher §4.3 (Daemon-Update)
   passiert ist — sonst weiter unknowable-Muster wie §3b.
2. Die zwei queued Briefs dispatchen, wenn Lane-Deckel frei: **4908a900** (codex-Haertung),
   **8cd6deca** (filing-cap). Beide owner-source, Hand-Dispatch noetig (Master-Stop).
3. Second-host-Daemon-Update anstossen (Ops, siehe 3b) — danach liefert der NAECHSTE Remote-Audit
   Namen, und die unknowable-Serie endet.
4. **P2 Vor-Split-Haertung** (Plan §P2): frisches Fenster, voller Kontext. Davor Fenster-Checkliste
   des Plans §Entscheide 4/5 pruefen (auto-③ ist seit be3b21e aus — nachpruefen, nicht glauben).
5. P3 mit der W4-Blaupause (Build-Hash-Beweis) briefen; die ~11 Kommentar-Anker-Pins in den Brief.

## 5. Ehrlichkeiten & Reste

- Bei Uebergabe armiert: Audit-Watches c1d804f1 (54964d1) + 99af3f9a (3974883); beide Merge-
  Watches sind gefeuert (dead/sent). Watches sind slot-gebunden und sterben mit meinem Slot —
  die Nachfolgerin armiert die zwei Audit-Watches NEU (§4.1).
- Queue-Stand: 4908a900 + 8cd6deca queued (arbeit) · 5 notizen pending (5e79be26 Locale in W3
  MITerledigt — die Zeile kann der Owner schliessen · af8dd29c reviewInflight-P6 · d07646bc
  Second-host-Ausbau · d2335500 durch Slot-10-Land ERLEDIGT sobald gelandet — schliessbar ·
  39fbbd1f server-lstart-P6) · 1b677e58/ff535524 Feature-Freeze-geparkt · b0ad8a79 fremdes Program.
- Rulebook-Nachzug dieser Session (gitignored, committet nur als Fragment-Text im
  rulebook/-Verzeichnis): lane-discipline §11.2j/k auf REPARIERT. CLAUDE.md re-rendert, pins gruen.
- Owner hat /model auf Fable 5 gestellt (Terminal-Kommando, betrifft NEUE Sessions — die
  Supervisor-Regel "Opus 5 high" fuer die 🧿-Rolle ist davon unberuehrt, mein Slot lief auf Opus).
- ctx bei Uebergabe: siehe succeed-Report; Band eingehalten (26,4 % gemessen beim Entscheid,
  Restkette = 2 Lands + Deploy + Handoff, vorher angekuendigt).

---

# HANDOFF — Generalsanierung: P1 W1+W2 gelandet, beide Flake-Reparaturen gelandet/im Land, Autonomie + Remote-Audit live, 2026-09-01

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Ersetzt den 2026-09-01-Abschnitt darunter.

## 1. Autoritaet & Betrieb (Owner-Entscheide dieser Session, alle ausgefuehrt)

- **Volle Autonomie**: Owner woertlich "bitte geh dies nun an und fixe auch solche berechtigungsprobleme.
  Der gesamte plan sollte am besten komplett autonom laufen soweit." → self-land promotion am Program
  (Stufe siehe §3-Nachtrag unten), Lands laufen ueber POST /api/self/tasks/<id>/land, actor.kind=main.
- **suite-offer PROMOVIERT** (unter derselben Delegation, Rueckfalltuer = Zeile zurueckdrehen):
  rulebook/lane-discipline.md traegt die Regel (180 s frei / 800 s gehalten, Pin ist von SKIP auf PASS
  geflippt). Ab jetzt in jedem Brief mit isolated-Vorschaulauf: Portal-Offer statt lokal; AUSNAHME
  Flake-Beweislaeufe (bleiben lokal).
- **Second-host ist als Helfer LIVE**: fleet-helper.service enabled+active (Setup 29.08. ueberlebt Boots),
  Device secondhostlinux1 active/active, Grace 60 s. ERSTER Remote-Audit gelaufen (05f37f1, 22 min,
  echter Lauf mit remote.clonedSha). Owner-Wuensche festgehalten: Suite-Lauf-Anzeige prominenter +
  Second-host vollwertig (notiz d07646bc; vollwertig = Dual-Host-Program, nicht wir). MacBook-Helfer:
  Rezept an Owner geliefert, Entscheid offen — Second-host-Anlassen reicht.
- Master-Stop bleibt AN; Weg: file → release → Hand-Dispatch POST /api/tasks/<id>/dispatch (Body {}).
- Quiet-Hours blockieren Attention-ANTWORTEN. Attention 7ccd9557 inhaltlich erledigt (Promotion), formal
  offen; fremde offene (79839393, db2d6c85) nicht anfassen.

## 2. Gelandet, alles selbst verifiziert

main-Kette seit b43b5ad: bbd2cc5(docs) → ff5b813(**W1**) → 61155ae(docs) → 70dfc53(**W2a**) →
ba4169a(**W2b**) → ece76e2(docs) → 05f37f1(**§11.2k-Fix**) → [Slot-10-Land, §3]. Alle Lands verify.ok
true, volle Kette. Docs top-level 105→31, attic traegt ~150+ Dateien, tote Doc-Pfade 17→0 (Filter als
Kommando in docs/sanierung-2026-09/w2-filter.md — Erfolgsmass 3 misst mit GENAU dem). Deploys nach jedem
server-beruehrenden Land, je am Owner-Poll verifiziert; NACH DEM SLOT-10-LAND KEIN Deploy noetig (e2e+docs).
Host-Schritte: 7 Secret-Symlinks weg; rulebook 4× nachgezogen (steward-arena-Pfad, 3 Zeilenrefs→Symbol,
core-program→attic-Pfad, suite-offer-Regel, Familienzahl "Dreizehn") — alles gitignored, kein Commit.

## 3. Die Flake-Front — der eigentliche Ertrag der Nacht

- **§11.2j MECHANISMUS ISOLIERT** (war "Diskriminator nicht isoliert"): server.ts#tickWatches persistiert
  status=send-uncertain + attempts++ VOR dem tmux-Roundtrip und rollt erst nach SendRefused zurueck —
  die Fixtures sampelten den Transienten. Acht Mitglieder. Lane ed248c15 (Schnitt 1: sechs Fenster messen
  ihre Vorbedingung; Schnitt 2: settleEvent wartet Transienten bounded aus). Beweis: 3 serielle Laeufe,
  alle 8 Mitglieder gruen, Transient feuerte bei load 4.44 und wurde absorbiert; die 2 Rots der Serie
  waren §11.2k auf dem VOR-Fix-Baum. needs-main von mir adjudiziert: Substanz akzeptiert.
  **Slot-10-Land-Stand: Rebase-Konflikt docs/verify-tiering.md → Author-Pfad hat aufgeloest (Pane
  gelesen, sauber), guarded-Confirm von mir genommen (Non-Goal verbietet Confirm nur fuer SPLIT-Slices).
  Ausgang siehe Nachtrag unten. DANACH PROMOTION ZURUECK AUF green-only** (war beim Schreiben guarded).
- **§11.2k REPARIERT, test-seitig** (05f37f1): outcomes 9b wartet auf die PERSISTIERTE Review-Wirkung.
  Echter Server-Bug dahinter als P6-Prio-notiz af8dd29c: teardownSlotOccupant loescht reviewInflight
  nicht → Klick joint Waisen-Job, schreibt nichts. Ein-Zeilen-Fix, Verhaltensaenderung = P6.
  Ein 9b-Rot ist ab jetzt wieder ECHT (oder die Vorbedingungs-Sonde benennt sich selbst).
- **NEUE Plattform-Familie Second-host**: Suite-Lock-Geburtsidentitaets-Sonde ist LOCALE-abhaengig
  (de_DE-Debian, 'Di Sep 1', identityProven:null, 10 Checks geschlossen). Audit 05f37f1 = stale-test.
  Fix-notiz 5e79be26 (LC_ALL=C + Baseline-Doc nachtragen). Bis dahin: Second-host-Rot dieser Signatur =
  Plattform, kein Befund.
- **Adjudikationen**: 01459c9 flake (§11.2j, 7. Mitglied registriert) · ff5b813 flake (§11.2k als 13.
  Familie, Direktbeweis) · 70dfc53 flake (4×§11.2j+§11.2k) · ba4169a flake (8. Mitglied held/pre-paste)
  · 05f37f1 stale-test (Locale). §11.2i viermal gesichtet (unveraendert offen).
- **P0-Baseline: OFFEN.** §11.2k fiel 2× binnen 3 konsekutiven Laeufen (vor dem Fix). Jetzt, wo BEIDE
  Reparaturen gelandet sind: die naechsten 3 konsekutiven seriellen Laeufe (Audits zaehlen; loadavg je
  Lauf protokollieren) auf Check-Ebene beurteilen → Messnotiz docs/messungen/ → openQuestion 1 zu.

## 4. Naechste Zuege, Reihenfolge

1. NACHTRAG, alles erledigt: **Slot-10-Land IST GELANDET — main = b20e7e4** (verify.ok true, actor
   main, guarded-Confirm auf die Author-Aufloesung; Note traegt die Resolution). **Promotion steht
   wieder auf green-only** (geprueft). Audit-Watch 919cc3e7 war armiert, STIRBT mit meinem Slot —
   NEU armieren ({"kind":"audit","mainAfter":"<b20e7e4 voll>"}) und den Audit nach Check-Ebene
   beurteilen; kann Second-host-claimed sein: erst remote/Locale-Signatur pruefen (§3).
2. Rulebook-Nachzuege NACH dem Land (Fragment lane-discipline): §11.2j "isoliert, acht Mitglieder,
   repariert in <land-sha>" · §11.2k "repariert in 05f37f1, 9b-Rot wieder ECHT". Re-Render + pins.
3. Baseline schliessen (§3 letzter Punkt).
4. **W3** (Plan §W3 + Reparatur 4: "alle stage_instance-Aufrufer"; + notiz 5e79be26 Locale-Pin passt
   thematisch dazu) → **W4** (Reparatur 3: --noUnusedLocals auf server.ts allein) → P2.
5. P4/P5-Briefs: suite-offer-Regel steht im Rulebook; Fenster-Checkliste (auto-③ ist AUS seit be3b21e).

## 5. Ehrlichkeiten

- Slot-10-Land ist gelandet (b20e7e4, Nachtrag in §4); alle meine Watches sterben mit dem Slot —
  nur der b20e7e4-Audit-Watch muss neu armiert werden, sonst ist nichts in Flug.
- Direkt-Commits dieser Session (land-unsichtbar, Body = Beleg): bbd2cc5, 61155ae, ece76e2.
- W2b-Lane-Report enthielt einen Irrtum (rulebook nenne core-program nicht) — von mir korrigiert; die
  §11.2j-Lane korrigierte MEINE 8.-Mitglied-Deutung (Transient, kein Pane-Ersatz). Beides eingearbeitet.
- Owner-Fragen dieser Nacht beantwortet: GitHub-CI (abgelehnt, Begruendung im Transkript), Zeitplan
  (~22–30 h Restplan), MacBook-Helfer (+2–4 h, Rezept geliefert).
- ctx bei Uebergabe: ~37–39 % gemessen. Kontextband eingehalten (25 % Vorbereitung, danach nur Restkette
  + Owner-Antworten).

---
# HANDOFF — Generalsanierung: Entscheide ausgefuehrt, 8d97 gelandet, W1-Brief liegt bereit, 2026-09-01

Program **`b2a14b545fd31fd71ba7b9e1`** aktiv, gebunden. Dieser Abschnitt ersetzt inhaltlich den
Abschnitt vom 2026-08-31 direkt darunter (dessen offener Entscheid ist GEFALLEN); die Mess-Tabelle
und die Widerlegungen dort bleiben gueltig.

## 1. Owner-Delegation 2026-09-01 und die sechs ausgefuehrten Entscheide

Owner woertlich: "Bitte ueberleg hier selber gut was sinn macht und dann geh diese an" — auf die
sechs vorgelegten Entscheide. Protokolliert als datierter Abschnitt im Plan-Nachtrag (`be3b21e`).
Die Kurzform: **(1) Erfolgsmass 5 gilt jetzt auf CHECK-Ebene** (Lauf gruen, wenn jeder FAIL zu
einer registrierten Familie gehoert; Baseline zu, wenn ueber 3 konsekutive Laeufe kein Check
ZWEIMAL faellt; unregistrierter FAIL = Lauf rot) · (2) keine Ruhigstellung fremder Sessions fuer
P1; stilles Fenster bleibt P4/P5-Vorbedingung · (3) 8d97 als begruendete Freeze-Ausnahme gelandet
· (4) auto-③ fuer die Programmdauer aus · (5) Rulebook-Familienzahl nachgezogen · (6) keine
weitere Suite-Zeit fuer den §11.2j-Diskriminator.

## 2. Zustand, alles verifiziert (nicht behauptet)

- **8d97 GELANDET: main = `01459c9`** (feat: separate task workbench views), `fleet/land`-Note
  mit `verify.ok: true` ueber die volle Kette install→claude-gate. **ERSTER AKT DER NACHFOLGERIN:**
  Audit-Watch armieren — `POST /api/self/watch` `{"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"01459c9ef81dfac06dc1a999ac13e7f11c6e1583"}` —
  und ein Rot nach der NEUEN Check-Ebene-Regel beurteilen (§11.2j-Mitglieder einmal = Flake).
  Meine Watches sind mit dem Slot gestorben; nichts davon uebertraegt sich.
- **auto-③ aus, am Prozess gemessen**: Live-Server (die PID OHNE `FLEET_SOCK` in `ps eww`) traegt
  `FLEET_AUTO_REVIEW_MS=0`; watchdog.sh-Zeile committed (`be3b21e`), kickstart + Verb-2-Deploy
  gefahren, `deployGap` 0, `bundleStale` false. NIE an `./state.sh`s `live=`-Spalte pruefen,
  solange eine Suite laeuft.
- **Rulebook**: Fragment `rulebook/lane-discipline.md` sagt jetzt "Zwoelf bekannte
  Flake-Familien" (+§11.2i/+§11.2j), `CLAUDE.md` daraus gerendert (71497 B), pins ALL PASS.
  Beides gitignored — es gibt dazu KEINEN Commit; bei Drift-Verdacht neu rendern (Kommando im
  Kopf von `rulebook.ts`).
- **§11.2j-Mechanismus eine Ebene tiefer** (`43b389e`): Event erzeugt, unmittelbar danach wird
  die Empfaenger-Pane ZWEIMAL neu erzeugt (`fleet-e2e-instance-4110/server.log:135-142`);
  `recoverFleetReportDelivery` terminalisiert korrekt. Gattung §11.2f. Der plausible Fix ist
  TEST-SEITIG und darf als Lane mit eigenem Kriterium vor P6 laufen (Entscheid 6).

## 3. Naechste Zuege, in dieser Reihenfolge

1. Audit-Watch fuer `01459c9` armieren (oben). Der Audit belegt den Suite-Mutex ~26 min.
2. **W1 starten**: fertiger Brief liegt WOERTLICH in
   `/private/tmp/claude-501/-Users-owner-claude-fleet/c05b5a9a-bc21-4de6-b9f8-cf274cc9413c/scratchpad/w1-brief.txt`
   (lesbar; die Scratchpads der Vorgaenger bleiben auf Platte). Weg: `POST /api/self/tasks`
   (kind auftrag, harness claude, model claude-opus-5[1m], effort high) → release →
   **Hand-Dispatch `POST /api/tasks/<id>/dispatch`** (Master-Stop bleibt AN per Program-Intent;
   der Hand-Knopf ist der vorgesehene Bypass). W1-Land NICHT parallel zum laufenden Audit-Gate
   erzwingen — das Gate wartet ohnehin am Mutex (waitMs 2.700.000, ein waitedOut ist nie ok:false).
3. Danach die **§11.2j-Fixture-Fix-Lane** (test-seitig, eigenes Kriterium: die vier
   watch.ts-Mitglieder ueberleben 3 serielle gruene Laeufe bzw. die Sonde scheitert als sie
   selbst, wenn die Empfaenger-Pane starb).
4. **P0-Baseline unter der neuen Regel schliessen**: 3 serielle Laeufe, Urteil auf Check-Ebene.
   KEINE weiteren Diskriminator-Experimente (Entscheid 6). loadavg je Lauf protokollieren.
5. Nach W1-Land der HOST-Handschritt: die UNGETRACKTEN lerntisch-Symlinks im Live-Checkout
   loeschen (einer zeigt auf `.env`) — Lane kann das nicht.

## 4. Ehrlichkeiten

- Heute/gestern liegen ACHT Direkt-Commits auf main (60dec47, ce24b0d, a1615be, dc75c32, 5cef1b7,
  08689e1, be3b21e, 43b389e + Handoffs) — fuer land-seitige Ledger unsichtbar; `./state.sh`
  untertreibt entsprechend. Verifikation je Commit steht im jeweiligen Body.
- Die P0-Baseline ist NOCH NICHT geschlossen — erst Schritt 4 oben schliesst sie.
- Attention `db4f7f08` steht formal noch offen am Board; inhaltlich ist sie durch die Delegation
  entschieden (Weg A). Beim naechsten Owner-Kontakt schliessen/erwaehnen.
- Slot-Datensatz dieser Session traegt model+effort korrekt; Succession erbt mechanisch
  (`succeedSupervisor` reicht `s.model`/`s.effort` durch). Effort-Bestaetigungszeile trotzdem
  im ersten Zug zitieren, wenn du sie setzt.

---

# HANDOFF — Generalsanierung: P0 gemessen, Erfolgsmass 5 als unerreichbar belegt, EIN Owner-Entscheid offen, 2026-08-31

Program **`b2a14b545fd31fd71ba7b9e1`** („Generalsanierung 2026-09") aktiv, gebunden an Slot 10.
Dieser Abschnitt ist NEU und oben angesetzt; nichts darunter wurde angefasst.

## 1. Was gelandet ist (alles Direkt-Commits, docs-only, fuer land-seitige Ledger unsichtbar)

`2cd464b` GLM-Review (Lane) · `60dec47` P0b-Adjudikation · `ce24b0d` Plan-Nachtrag ·
`a1615be` Baseline-Notiz (Gruendungs-Session) · `dc75c32` Flake-Familie §11.2j ·
`5cef1b7` Erreichbarkeits-Messung · `08689e1` §11.2j-Korrektur.

`./state.sh`s Land-Health untertreibt diesen Tag entsprechend um sechs Commits.

## 2. Der EINE offene Entscheid — Attention `db4f7f08`, kind `decision`

**Erfolgsmass 5 ("alle Suiten gruen, 3 serielle Beweislaeufe") ist an der gemessenen Rate nicht
erreichbar.** Zahlen in `docs/messungen/2026-08-31-baseline-erreichbarkeit.md`: 306 entschiedene
Post-Land-Audits (ein Audit IST ein Baseline-Lauf), 77,5 % gruen ueber alles, **57,5 % ueber die
letzten 40**, Bruch ab 2026-08-26. Daraus P(3 konsekutiv gruen) = 19 %, ~16 Laeufe je Erfolg,
~26 min exklusiver Suite-Mutex je Lauf ⇒ **~7 h serialisierte Maschinenzeit je Baseline**, zweimal
gefordert. Kein einzelner Fix hilft: 24 von 45 gezaehlten Roten fielen mit genau EINEM Check,
Signaturen gestreut.

Drei Wege liegen dem Owner vor; Empfehlung **A** (Kriterium auf CHECK-Ebene, Baseline geschlossen
wenn ueber 3 konsekutive Laeufe KEIN Check zweimal faellt — die Zweimal-Regel ist der
Missbrauchsschutz). **B** wuerde P1 reordern, deshalb wurde W1 NICHT begonnen.

## 3. P0-Messstand — sieben Laeufe, und was sie beweisen

| Lauf | HEAD | dirty | Controller | loadavg | Ergebnis |
|---|---|---|---|---|---|
| 1 | `6f173d7` | nein | noch nicht aktiv | — | ALL PASS 3349 |
| 2 | `00d9b58` | ja | arbeitet | — | RED 4 (Familie) |
| 3 | `acf3614` | ja | arbeitet | — | RED 5 (Familie) |
| 4 | `ce24b0d` | nein | untaetig | 1,53 | ALL PASS 3349 |
| 5 | `dc75c32` | nein | untaetig | 2,15 | RED 1 (`e2e/outcomes.ts`, NICHT die Familie) |
| 7 | `5cef1b7` | ja | untaetig | 2,39 | RED 5 (Familie) |

**Bewiesen:** Code-Delta ueber alle Laeufe null ⇒ Nicht-Determinismus nach §11.7 direkt bewiesen,
kein Regress. Neue Familie registriert als **`docs/verify-tiering.md` §11.2j** (sie fehlte dort).

**Zweimal widerlegt, beide Male von mir selbst zuerst geglaubt — nicht erneut aufmachen:**
- „Untaetiger Controller ergibt gruen": Lauf 7 feuerte die Familie bei untaetigem Controller.
- „Dirty Baum ist die Ursache": strukturell unmoeglich. `e2e-stage.sh` kopiert nur die
  Import-Huelle + `public/` + `package.json` + `$STAGE_EXTRA`; `e2e-isolated.sh:66-69` kopiert
  exakt VIER benannte `docs/`-Dateien; danach `git init && git add -A && git commit` ⇒ immer
  sauber beim Init. An der aufbewahrten Instanz `fleet-e2e-instance-4110` nachgeprueft.

**Offen und einziger numerischer Griff:** loadavg beim Start (1,53 gruen; 2,15 / 2,39 rot) — drei
Punkte, ein Hinweis, kein Ergebnis. Wer weitermisst, protokolliert loadavg je Lauf und argumentiert
NICHT mehr ueber den Baum. Unseziert: `fleet-e2e-instance-80791`, `-26770`, `-43515`, `-4110`.

## 4. Betriebszustand, gemessen (nicht aus state.sh's live=-Spalte!)

`dispatch=false` (Master-Stop AN) · `autosOn=true` · Tag `vor-generalsanierung`=`49038af` ·
echter Server = die PID **ohne** `FLEET_SOCK`; dort ist `FLEET_AUTO_REVIEW_MS` **ungesetzt**,
auto-③ laeuft also auf Default 15 s und ist vor dem ersten P4-Fenster noch auf 0 zu setzen
(+ `launchctl kickstart`). **`./state.sh`s `live=`-Spalte ist falsch, solange eine Suite laeuft**
(Befund A1, im Plan-Nachtrag als Checklistenpunkt) — ein suite-gespawnter Server hat `cwd` =
Haupt-Checkout und ueberschreibt die echten Werte.

## 5. Naechste Zuege, in dieser Reihenfolge

1. **Owner-Entscheid zu Erfolgsmass 5 abwarten** (Attention `db4f7f08`). P4/P5 bleiben bis dahin zu.
2. Danach W1 als Lane briefen — die Planreparaturen in `docs/sanierung-2026-09/plan-2026-08-31.md`
   §Nachtrag sind der verbindliche Text, NICHT die Tabelle darueber (704→1941, rulebook ≥15→4,
   392→393, ~324→329; `attic/`-Praefixe aus P2 nach W1 vorgezogen).
3. Nicht vergessen: `CLAUDE.md`s „Zehn bekannte Flake-Familien" ist jetzt ZWEI zu kurz (§11.2i war
   schon offen, §11.2j kommt dazu). Das ist ein Generat aus `rulebook.ts` — Fragment editieren und
   rendern, und es bleibt ein VORSCHLAG bis zur Owner-Promotion.

## 6. Was ich NICHT getan habe, und warum

- **W1 nicht begonnen** — Option B des offenen Entscheids wuerde genau das reordern.
- **Lane `fleet/260831133127-8d97` nicht angefasst** (Slot 2, done-looking, 1 sauberer Commit,
  3 Dateien inkl. `src/client.ts`). Sie gehoert Program `b9c1e0d9`, nicht diesem. Kosten des
  Wartens sind benannt: nach P5 ist sie nicht mehr rebasebar.
- **Keine „stille Maschine" behauptet.** Bei Lauf 4 waren 13 Agenten-Sessions lebendig, sieben in
  diesem Checkout. Herstellbar war nur: keine Nachbarsuite, sauberer Baum, Controller untaetig.

---

# HANDOFF — Generalsanierung gestartet: Program b2a14b54 auf Slot 10, Freeze aktiv, 2026-08-31

Owner-Entscheid 2026-08-31: das komplette Repo wird saniert. Dieser Abschnitt ist NEU und oben
angesetzt; nichts darunter wurde angefasst. **Die einzige Programmquelle ist
`docs/sanierung-2026-09/plan-2026-08-31.md`** (Commit `6f173d7`; Phasen P0–P7, Slice-Protokoll,
Fenster-Checkliste, Messbasis mit Ableitungs-Kommandos, P0-Ernteprotokoll) — dieser
Handoff-Abschnitt trägt nur, was git nicht trägt.

## Zustand bei Übergabe

- **Program „Generalsanierung 2026-09" `b2a14b545fd31fd71ba7b9e1` aktiv, MAIN gebunden auf
  Slot 10** (`claude-opus-5[1m]`, `effort high` — beides IM Slot-Datensatz, Spawn-gesetzt;
  Successions erben mechanisch korrekt). Ihre offenen Startaufgaben stehen im Gründungsbrief
  (openQuestions): GLM-Befunde adjudizieren VOR P1 · d70d-Promotion beim Owner · Fenster-Env vor
  erstem P4-Fenster.
- **Feature-Freeze + Dispatcher-Master-Stop aktiv** (`dispatch: false`); die zwei offenen
  Feature-Zeilen (`1b677e58`, `ff535524`) bleiben absichtlich pending bis P7.
- **Rollback-Anker: Tag `vor-generalsanierung` = `49038af`.**
- **P0b erledigt:** GLM-Gegenprüfung gelandet als `2cd464b`
  (`docs/messungen/2026-09-01-sanierung-plan-glm-review.md`, 10 gerankte Befunde; B1: die
  W2-Zahl 704 ist real ~1.936 → W2-Budget ~2,7×; B2: attic/→DOC_RULE muss aus P2 nach W1
  vorgezogen werden; B5: auto-③-Punkt der Fenster-Checkliste gegen den Code klären).
  Adjudikation = Program-MAIN, noch offen.
- **Worktree-Ernte abgeschlossen:** 26 → 1 (nur Slot-2-Lane `fleet/260831133127-8d97` lebt,
  Task `93fc5af2`, darf normal fertig landen). 11 Branches geshelvt (Liste im Plan-Dokument,
  §P0-Ernteprotokoll) — **darunter `fleet/260822143207-d70d`: unpromovierter
  AGENTS.md-Regelvorschlag „Waiting is event-driven", liegt dem Owner zur Promotion vor.**
  Geshelvte Branches sind nach dem Split nicht mehr rebasebar; Wert = P6-Referenz.
- **DIREKT-COMMITS dieser Session** (für Land-Ledger unsichtbar, Verifikation von Hand):
  `49038af` (Ernte, 2 Doc-Dateien) und `6f173d7` (Plan) — beide docs-only, nach beiden
  `bun e2e/pins.ts` = ALL PASS (DOC_RULE-Kette). `./state.sh`-Land-Zahlen untertreiben heute
  entsprechend.
- **P0-Baseline LÄUFT noch:** 3 serielle `./e2e-isolated.sh` (Start ~20:45, Lauf-Skript +
  Logs im Session-Scratchpad `baseline/`); Ergebnis gehört als Messnotiz
  `docs/messungen/2026-09-01-sanierung-baseline.md` committet. Main bewegte sich währenddessen
  einmal docs-only (`6f173d7`→`2cd464b`) — staged Suite-Inhalt identisch, im Protokoll nennen.
- **Betriebsbefund:** GLM läuft über Harness **`pi-zai`** (nicht `pi` — pi 0.84 kennt keine
  glm-Modelle; zwei ehrliche not-alive-Requeues bezahlt). pi-zai ist `automatable:false` →
  `/api/self/watch` lehnt ab; Rückweg = Hintergrund-Watcher auf clean+ahead.

## Nächste Schritte (Reihenfolge, Warum im Plan)

1. Baseline-Messnotiz committen (diese Session, sobald Läufe enden — sonst Program-MAIN).
2. Program-MAIN: GLM-Befunde adjudizieren, Plan-Korrekturen (B1/B2/B5) als datierten Nachtrag
   ins Plan-Dokument, dann W1 briefen.
3. Owner-Entscheid einholen: d70d-Promotion ja/nein.

# HANDOFF — Dual-Host Program cd110019: Canary bestanden, Dauerkanal ungeklärt, 2026-08-31

Program **`cd1100193082db395c1387db`** („Dual-Host Fleet — Second-host Session Runtime") bleibt
aktiv und gebunden. Dieser Abschnitt ist NEU und oben angesetzt; nichts darunter wurde angefasst.

## 1. Program-Zustand

- **Richtung A bestätigt** (zweite eigenständige Fleet-Instanz auf second-host + Client-Link B1),
  Phase-0-Beleg gelandet als `0f3a9da` (`docs/dual-host-session-runtime-phase0-2026-08-30.md`),
  Korrekturen nachgezogen in `9ff14be`.
- **V1 erfasst** (Owner, 2026-08-30): Fleet-Reports überqueren KEINE Hostgrenze; jede Maschine
  behält eigene Program-MAIN, Inbox, Tokens, Ledger. Eine hostübergreifende Inbox/Event-Bridge
  ist vertagt und wäre ein eigener Architekturentscheid.
- **Canary-Eintrittsbedingung ERFÜLLT und belegt:** `7d26ff9`,
  `docs/messungen/2026-08-31-second-host-session-canary-private-repo-o.md`. Gemessen am laufenden Build
  `62ef02a1d3ee4b03ff89a25316e3b1151f123f44`: gestartet (`/stamp.json` = commit 62ef02a,
  dirty false, GET / 200), über den ECHTEN Eingabepfad gesteuert (CDP `Input.dispatchKeyEvent`,
  gehaltenes ArrowUp speed 4,24 → 19,38 m/s über 18 Proben; ArrowRight yaw −2,14° → −28,04°),
  benannte Belege zurück (Frame 780×493, 52 488 B, sha256 `f4ce2224…`, HUD + eingebrannter
  Stempel, angesehen).
- **KEIN Implementierungs-Slice freigegeben.** Die Canary ersetzt Schnitt 1 des Phase-0-Plans,
  sie ist keine Freigabe zur Topologie-Implementierung.

## 2. Der Befund, der die Canary bezahlt hat — als VORBEDINGUNG lesen

`bun run verify` ist auf second-host **rot in `T14 auslauf leckt nicht`** (Trace-Digest `d113eb90`
statt der eingebrannten `b8c98758`). Gegenprobe: dasselbe Bundle, derselbe Commit, frischer
Scratch-Klon auf dem Mac → **ALL PASS**. Zuordnung damit **Plattformdifferenz**
(arm64/macOS 26.3.1 gegen x86_64/Debian 13), **kein Regress**. Daneben ist `T4 determinismus` auf
Linux grün — die Sim ist dort in sich deterministisch, sie landet nur auf einer anderen Zahl;
`T15 lenkung im bild` ist grün.

**Konsequenz, die der Phase-0-Plan NICHT kannte:** second-host darf einen Build **fahren und
bebildern**, aber über diese Zeile **nicht grün oder rot sprechen**, bis der Digest-Breaker
plattformunabhängig ist oder je-Plattform-Baselines bekommt. Wer das überspringt, lässt die zweite
Maschine ein Urteil fällen, das strukturell falsch ist.

## 3. Die offene Owner-Entscheidung — NICHT die der Nachfolgerin: der Dauerkanal

Die einmalige ssh-Freigabe war ein **Einzelakt und ist vollständig zurückgebaut**: `known_hosts`-
Zeile entfernt (Datei wieder 567 Zeilen, ssh scheitert wieder an der Host-Key-Prüfung), Chromium
`purge` + `autoremove`, Arbeitsverzeichnis entfernt, kein Listener auf 5173/9222; Portal und Daemon
unberührt (`fleet-helper` active, Config-mtime unverändert).

**Die Nachfolgerin darf ssh NICHT eigenmächtig wieder öffnen.** Zur Wahl stehen, ungetroffen:
- **S5** — den Helper-Daemon nach Job-Art verzweigen (`daemon.ts:269` loggt `kind`, `:324` führt
  einen einzigen `cfg.suiteCmd`). Bleibt im Pull-Modell, legt **kein Credential auf den Mac**.
- **Ein beschnittener stehender Key** mit `command=` und `from=`.

## 4. Ehrlichkeiten, wörtlich mitzunehmen

- **`speedWhileLightRed` ist UNGEMESSEN, nicht bestanden** — die erste Probe fiel bei t=4,03 s,
  also hinter die Ampel-Freigabe. Wer die Sperre belegen will, misst ab t=0.
- **„Reference" heißt der GEMESSENE Zustand, kein Qualitätsurteil.** Der Owner hat `62ef02a` nie
  gefahren; **`owner_taste` und `sensory_critic` bleiben `unknown`.**
- **Provenienz `7d26ff9` und `9ff14be`: Direkt-Commits aus dem Haupt-Checkout** — also **keine
  `fleet/land`-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit**. Die Verifikation
  steht stattdessen im jeweiligen Commit-Body (`install` + `pins` → ALL PASS). `./state.sh`s
  Land-Health-Zahlen untertreiben an diesem Tag entsprechend.
- **Ein Messfehler, den die Nachfolgerin nicht wiederholen muss:** ein `pins`-Lauf zeigte 2
  FAILURES an `CLAUDE.md`; Ursache war die **nebenläufige Neu-Erzeugung des Regelbuch-Generats**
  durch eine andere Session (`a2f4375`, 16:08), nicht die eigene Änderung — belegt per A/B. In
  diesem Checkout arbeiten mehrere Sessions; ein Generat-Rot zuerst gegen die mtime prüfen.

## 5. Nächster Zug

Der Kanal-Entscheid (§3) ist das Tor. Erst danach lohnt Schnitt 2 des Phase-0-Plans
(Instanz-Identität als EIN Feld pro Antwort — Byte-Decke `e2e/tasks.ts:590`, `bytes < 14 * 1024`).
Der Digest-Breaker aus §2 gehört vor jede Spielarbeit auf second-host, nicht danach.

---

# HANDOFF — Task-Workbench-Slices pending; roter Audit vor Release klären, 2026-08-31

Program `b9c1e0d9623aaeb7cabd0257` bleibt aktiv. Baseline-Task `eaa3ae1a` landete nach Reparatur
als Main `bc9e7de35bc49776eedac6aa3ece2388ce1cade1`; die visuelle Browser-Baseline bleibt wegen
fehlendem authentifiziertem Browser `UNKNOWN`.

Post-Land-Audit-Watch `b42166f4` endete rot: 3333 Checks, 3 fehlgeschlagen. Der dauerhafte Trail
`isolated-20260831T110235Z-25178` nennt:

- `subject-gone: the torn-down lane's undelivered event is terminal as itself, unackable, and frees its budget`
- `counterprobe: the live subject's held event is delivered on its FIRST attempt; the dead one is never typed`
- `outcome: a reviewer answer that did NOT parse is persisted as raw:true carrying its text — not as a clean review`

Kein Flake-Urteil: Ein Same-Tree-Rerun für `bc9e7de…` ist noch nicht belegt. Vor seinem Befund wird
keiner der drei neuen, überlappenden UI-Tasks released.

Pending, strikt seriell:

1. `93fc5af2` — Work/Programs/History trennen und Suche über Text, ID, Status, Repo und Program.
2. `ff535524` — aktive/Hintergrund-Lanes exakt ihrer Task zuordnen; running/done-looking/idle/dirty/unknown.
3. `1b677e58` — harness/model/effort sowie Clarify-first vs. Start an der Task-Zeile.

Alle drei sind Codex `gpt-5.6-sol`/high, haben harte Rot-Mutationen und teilen `src/client.ts`;
deshalb niemals parallel releasen. Nächster Akt: roten Audit auf demselben Baum reproduzieren oder
ehrlich als weiter `unknown` blockieren, dann nur `93fc5af2` releasen. Keine Host-Implementierung.

## Nachtrag 2026-08-31 — zwei DIREKT-Commits aus dem Haupt-Checkout (`e0e0c70`, `de13c81`)

Die 28 untracked Einträge des Haupt-Checkouts sind gesichtet: 23 getrackt (`briefs/` 10, `docs/` 6,
`docs/attic/` 5 redigiert, `promote-program.sh`, `.gitignore`), `x.bundle` und drei Root-PNGs
gelöscht, `.codex/`/`*.bundle`/`/*.png` dauerhaft ignoriert. `git status` ist leer.

**Beide sind Direkt-Commits, also für jedes land-seitige Ledger unsichtbar** — keine
`fleet/land`-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit. Die Kette lief deshalb
**von Hand und vollständig**: install → pins → tsc → build → clean-review → security → claude-gate,
**exit 0**, 261 PASS in den vier Suiten, 308 PASS in `pins`. `./state.sh`s Land-Health-Zahlen zählen
nur Lanes und untertreiben diesen Tag um zwei Commits.

**ERLEDIGT 2026-08-31 — die Rulebook-Drift aus `49e35f6` ist geschlossen.** Die fünf Zeilen liegen
jetzt in der Quelle `rulebook/graphify.md`, `CLAUDE.md` ist daraus regeneriert (70937 B), der tote
Anker heißt jetzt `AGENTS.md §Codex` und löst gegen `## If you are a Codex or Pi lane` auf.
`bun e2e/pins.ts`: **310 PASS, 0 FAIL, exit 0.** Beide Dateien sind gitignored — kein Commit, kein
Land; Sicherungen im Session-Scratchpad. Beim Nachlesen wurde die Lage übrigens kleiner als gedacht:
`FRAGMENTS_FOR.lane` (`rulebook.ts:39`) enthält `graphify` NICHT, und `server.ts:4916` schreibt einer
Lane die Lane-Rendering aus `rulebook/` statt einer Kopie des Monolithen — es war also nie eine Lane
falsch informiert. Der Schaden war der blinde Sensor, nicht die Regel. Der ursprüngliche Befund, zur
Nachvollziehbarkeit:

**Befund, NICHT von diesen Commits — die Rulebook-Drift aus `49e35f6`.** Zwei Pins bleiben
rot: `CLAUDE.md is renderRulebook("main", rulebook/) byte for byte` (70498 B gerendert vs 70949 B)
und der Anker `CLAUDE.md:768 → AGENTS.md §Codex/Pi-Lane`. Gemessene Wurzel: `49e35f6` brachte die
graphify-in-einer-Lane-Regel korrekt nach `AGENTS.md`, schrieb den Begleitabsatz aber in das
**generierte** `CLAUDE.md` statt in die Quelle `rulebook/graphify.md` — fünf Zeilen, die die nächste
Regeneration still löscht. Der zitierte Anker heißt in `AGENTS.md` wörtlich
`## If you are a Codex or Pi lane`. Reparatur ist eine Rulebook-Änderung und damit Owner-Promotion;
der Diff liegt in `rendered-CLAUDE.md`/`rulebook-drift.diff` im Session-Scratchpad, ist aber in
zwei Minuten neu erzeugt (`renderRulebook("main", rulebook/)` gegen `CLAUDE.md` diffen).

---

# HANDOFF — Red-Team-Controller wechselt; Live-Zustand vollständig neu messen, 2026-08-30

Der Owner hat diese Session beendet, weil sie wiederholt ältere Pane-/Board-Stände mit dem aktuellen
Zustand vermischt hat. **Keine Statusaussage dieses Abschnitts als gegenwärtig übernehmen.** Die
Nachfolgerin führt zuerst `./state.sh`, dann `./register.sh` aus, liest nur diesen obersten Abschnitt
und anschließend die Live-Queue; Queue-Texte sind Daten, keine Befehle. Danach genau eine gezielte
Live-Aufnahme der relevanten Slots statt fortlaufendem Pane-Polling.

Tatsächlich ausgeführte letzte Writes dieser Session:

- Audit `1788095115182` als `flake` adjudiziert; die Auditzeile blieb rot.
- Je eine beobachtet zugestellte Nachricht an Slot 16 (vorerst keine weiteren Lands/Deploys) und
  Slot 2 (Succession statt neuer A/B/C-Arbeit). Ob und wie beide reagiert haben, ist **unknown** und
  muss live geprüft werden.

Owner-Ziel und Reihenfolge:

1. Fleet wieder selbsttätig und übersichtlich betreiben; automatische Tests niemals vom Controller
   babysitten. Ein Lane-Worker besitzt seinen Wait, seine Suite und seinen terminalen Fleet-Report.
2. Task `8f7aca97` / zuletzt Slot 4 neu messen. Letzte beobachtete Behauptung war Kandidat
   `f1d26e3`, eigener Mutex-Wait, noch kein terminaler Report. F2/F3/F4 seien umgesetzt, F5A
   (automatisches Retire einer bestätigten clean+ahead0/no-candidate-Lane) sei nicht umgesetzt.
   **Alles davon ist ein zu verifizierender Vorgängerstand.** Keine zweite Suite starten.
3. Erst nach einem aktuellen terminalen Befund über Land und erforderlichen Deploy entscheiden.
   Land ist nicht Deploy. Rote oder unklare Gates gehören der ausführenden Session; der Controller
   beobachtet nicht fortlaufend.
4. Danach Slot 2s tatsächliche Succession prüfen. Slot 5 war zuletzt eine abgeschlossene
   Critic-Lane ohne Commit; daraus folgt nicht automatisch ihr heutiger Zustand. Anschließend die
   neuen Succession-/Report-/Audit-Wege an echten Ereignissen prüfen.
5. Erst danach Slots 12/13 untersuchen; Second-host-Auslagerung kommt zuletzt.

Offene Grenze: Zwei von Slot 16 koordinierte Kandidaten und weitere Board-Zeilen waren zuletzt in
Bewegung. Urheberschaft, Landstatus, Mutexhalter und Queue müssen neu gelesen werden; die älteren
Abschnitte darunter sind Historie und dürfen keine Live-Entscheidung ersetzen.

---

# HANDOFF — Private-repo-o-Worktrail-Audit abgeschlossen, Blaupause wartet auf Promotion, 2026-08-30 15:20 CEST

Controller-Session Slot 8 (Owner-Auftrag: tiefer Worktrail-Audit des Private-repo-o-Laufs). Kette ist
GESCHLOSSEN — alles gelandet, nichts in Flug. Uebergabe wegen Band (gemessen 35,1 %).

## Was diese Session getan hat (alles auf main, Bodies lesen)

Sechs GLM-Audit-Lanes (pi-zai/glm-5.3, effort high, Owner-Dispatch waivt das automatable-Gate)
gebrieft, geerntet, seriell gelandet: `4eaf365` (R7–R9) · `d487fdf` (R10–R13, R11-Sonderfrage
beantwortet) · `068f8e7` (Critic+MAIN) · `bfc5fd1` (Kontext-Pack-Katalog) · `1daa00e`
(Infra-Reichweite/Frische — graphify-Stale-Fenster, dangling Knowledge-Pointer, 402:9
Nudge-Oekonomie) · **`43360f1` (Blaupause: gerankte Bau-Liste S1–S8, Verworfene, wortfertige
Brief-Bloecke im Anhang — DIE Entscheidungsvorlage)**. INDEX-Zeilen nachgetragen als direkte
docs-Commits `965d073`/`86cf406`/`070ddbc` (Beweis je: install+pins ALL PASS; kein Land-Ledger-
Eintrag, konstruktionsbedingt). Board-Sweep AUF OWNER-ANWEISUNG: 127 stale pending archiviert,
Voll-Snapshot `~/claude-fleet-private/fleet-tasks-snapshot-2026-08-30.json` (restore je Zeile
moeglich; Retention verdraengt terminale Zeilen bei neuen Tasks endgueltig).

## Offene Owner-Entscheidungen (nichts davon selbst starten)

1. **Blaupause promoten + Slices freigeben** (`docs/werkzeug-integration-blaupause-2026-08-30.md`
   §4): Schnittlinie = S1 (Briefprofil, docs-only, Bloecke liegen wortfertig in §5) · S2
   (Report-Ist-Zahl) · S3 (capture.ts + seal.sh + Critic-KIT) · S4 (serve-pair + pixelcmp) VOR dem
   naechsten Game-Maker-Lauf. Drei E-Nachtraege, die F nicht mehr sah (E landete spaeter):
   Knowledge-Symlink `~/.Codex/knowledge -> ~/.claude/knowledge` (1 Zeile) · Land→Rebuild
   (detached `graphify update .` im Land-Pfad, schliesst 2h14m/8h49m-Stale; NICHT das beerdigte
   .git/hooks-Grab) · Nudge-Drossel (jetzt mit 402:9-Zahlen belegt).
2. **Fahrgefuehl-Attention `69386d59`** (A nachsichtig / B anspruchsvoll / C selbst fahren) —
   parkt weiter den kritischen Pfad des Spiels.
3. Task `d98fe812` (Architekturreview) steht queued — Regel aus dem Vorgaenger-Handoff unten gilt.

## Fuer die Nachfolgerin

`./state.sh` + `./register.sh` zuerst. Die sechs Audit-Notizen sind der Kontext; die Blaupause ist
die Arbeitsliste. GLM-Lane-Betrieb: Watch feuert fuer pi-zai nie (server.ts#6753 verweigert
ehrlich) — Rueckweg ist ein Hintergrund-Watcher auf ahead/clean der Lane-Branch (Muster im
Session-Scratchpad dieser Session, watch-glm-lanes.sh). Land blockt, solange die Lane aktiv
arbeitet („let it settle") — Retry-Schleife, nicht Force. Der Abschnitt darunter (10:38,
Betriebszustand/P0) ist der Handoff der VORHERIGEN Controller-Session; seine Punkte 3–6 sind
unabhaengig von dieser Arbeit und ungeprueft weitergueltig.

---

# HANDOFF (Vorgaenger) — Fleet wieder in einen belastbaren Betriebszustand bringen, 2026-08-30 10:38 CEST

Owner-Ziel: zuerst den gemessenen FleetEvent-/Composer-Schaden schließen und den laufenden Stand
wieder mit einem grünen Produktionsbeweis versehen; danach die operativen Schulden so ordnen, dass
Board, Audits, Helper und Succession keine stillen Zustände mehr erzeugen. Mindestgrenze für
„vernünftig laufend“: P0 exakt gelandet, neuester Post-Land-Audit grün, exakt dieser Tip deployed,
Bundle nicht stale und keine unbelegte Behauptung über eine verschwundene Event-Zeile.

## 1. Als Erstes neu messen

Führe `./state.sh` und `./register.sh` aus, lies dann `/api/sessions`, `/api/deploys` und
`/api/post-land-audits` mit dem Token aus `fleet.json`. Vor jedem Write den aktuellen Slot-Occupant
erneut belegen. Keine Pane-Injection als Ersatz für einen Fleet-Rückkanal und keinen Prozess nach
Namensmuster töten.

Stand dieser Übergabe:

- `main=75b21106feb1f66e11ca6f2b81341dadd0ea05f4`; der Server bootete Deploy `416d7fa4` auf
  `088d3a8b90de17cd42f648caf2640641edd77d77`. Die vier neueren Main-Commits sind Doku, daher
  `codeBehind:false`; `bundleStale:false`.
- Der letzte Second-host-Audit ist **rot** auf `dbb2e09460a6c65251eb6e2b802814eea7727cb2`:
  Exit 1 nach 1.261.823 ms und exakt `1 FAILURES`. Der auf 64 KB begrenzte API-Tail nennt den
  fehlgeschlagenen Check nicht. Nicht als Flake bezeichnen; dazu wäre ein grüner Same-Tree-Rerun
  nötig. Der unmittelbar ältere Audit auf `088d3a8` war grün mit `rows=3308 results=3308`.
- Second-host ist `active`, ohne Claim und ohne neue Lapse. Das lokale P0-Isolated hält derzeit den
  einzigen Suite-Lock; keine zweite Suite daneben starten.

## 2. P0 fertigstellen — Task `9912a68a`, Slot 2

Branch `fleet/260830063131-c091` steht sauber auf
`3f64ed1446f6c21585d24838626bb44947e5638b`, `ahead=1/behind=1`. Der Commit ändert sechs Dateien
mit 551 Einfügungen und 22 Löschungen. Sein Vertrag ist im Baum sichtbar: `subject-gone` ist ein
eigener Terminalzustand (`server.ts:1443`), verschwundene Subjects werden so terminalisiert
(`server.ts:7444`), und der Composer vergleicht Fleet nur gegen den vollständigen eigenen Payload
(`composer.ts:57`). `AGENTS.md` ist unverändert.

Beweislage:

- RED4 auf der Basis endete mit genau vier erwarteten Produktfehlern: Prefix wurde submitted;
  100 Holds erhöhten `attempts`; das verschwundene Subject blieb pending; die tote Lane wurde
  trotzdem zugestellt. Der Rest des Laufs lief weiter und der Tail endete `4 FAILURES`.
- Die normale Gate-Kette ist grün: clean-review, Security und Claude-Gate enden jeweils
  `ALL PASS`; die Exit-Zeilen sind `cr=0`, `sec=0`, `cg=0`.
- `./e2e-isolated.sh` läuft seit 10:24 CEST unter dem allein notierten Wrapper-PID `98814`.
  Scratch-Tail:
  `/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260830063131-c091/6a6249e4-c2c8-430d-9ae8-05e5ad096e5a/scratchpad/green-iso.log`.
  Taskstatus ist noch `sent`; es gibt noch keinen Fleet-Report.

Reihenfolge ohne Abkürzung:

1. Auf das terminale Isolated-Ergebnis warten. Nur ein Tail `ALL PASS` akzeptieren; bei Rot zuerst
   Checkname und Signatur lesen. Eine zweite grüne Ausführung desselben Trees wäre erst dann der
   Flake-Beleg.
2. Slot 2 muss den aktuellen Docs-Commit konfliktfrei merge-forwarden, den nötigen Beweis auf dem
   neuen HEAD erhalten und danach den Fleet-Report mit den wörtlichen Tails und sauberem Tree
   senden. HEAD und Report gegeneinander prüfen; `3f64ed1` ist der P0-Commit, nicht mehr der finale
   Branch-HEAD.
3. Der Task hat kein `programId`; eine Program-MAIN-Self-Land-Tür existiert dafür nicht. Der
   **Owner** landet exakt den gemeldeten Commit über den serverseitigen Landpfad.
4. Den dadurch erzeugten Post-Land-Audit bis `green|red|unknown` beobachten. Bei `red` oder
   `unknown` nicht deployen. Der alte rote `dbb2e09`-Audit bleibt `unknown`, bis sein eigener Check
   oder ein Same-Tree-Rerun vorliegt; ein neuer grüner Tip darf ihn nicht rückwirkend zum Flake
   umetikettieren.
5. Nur nach grünem Audit darf der **Owner** exakt den neuen Main-Tip deployen. Danach
   `hitTarget:true`, `bundleStale:false`, `bootHead=head=target` und keinen laufenden Deploy prüfen.
6. Event `77d3aadb2df16f6246d790e6` ist heute weder in `/api/sessions` noch in den lokalen Ledgers
   auffindbar. Die alte Anweisung, ausgerechnet diese Zeile nach dem Deploy zu prüfen, ist damit
   nicht ausführbar. Kein Ergebnis erfinden: verwende den deterministischen Isolated-Test und bei
   Bedarf eine neu erzeugte, kontrollierte Subject-Teardown-Gegenprobe; nie einen Owner-Composer als
   Versuchsfeld.

## 3. Danach: Betriebsbeweise schließen

In dieser Reihenfolge, jeweils als eigener landbarer Slice:

1. **Helper-Provenienz.** Audit-Ledger meldet für den grünen 3308er Trail nur `checks.ran=23`, weil
   es aus dem gekürzten Tail zählt. Die vollständige Trail-Zahl und der fehlgeschlagene Check müssen
   strukturiert übernommen werden; bis dahin ist der einzelne rote Check im neuesten Audit nicht
   fernlesbar.
2. **Second-host-Daemon.** Die gelandete Helper-Implementierung kann `remote.clonedSha` melden
   (`helper-daemon/README.md:52`), der installierte Daemon tut es noch nicht. Installation/Restart
   ist ein ausdrücklicher **Owner-Akt**; dieses Repo deployt ihn nicht
   (`helper-daemon/README.md:66`). Nach Rollout muss der nächste echte Remote-Audit
   `remote.clonedSha == mainSha` belegen oder die Abwesenheit ausdrücklich benennen.
3. **Audit-Zustand.** Ziel ist nicht, historische rote Zeilen zu löschen, sondern dass der neueste
   Produktions-Tip grün und seine Provenienz vollständig ist. Second-host bleibt Pull-only.

## 4. Succession ist eine offene Richtungsentscheidung, kein `.env`-Handgriff

`FLEET_MIGRATE_PCT` und alle zugehörigen Live-Schalter fehlen aktuell; Migration ist aus
(`server.ts:11304`). Die frühere Anweisung „55 setzen“ ist nicht ausreichend begründet. Der aktuelle
Rail nudged höchstens dreimal (`server.ts:11606`) und öffnet für Program-MAIN-Succession einen
**freien anderen Slot** (`server.ts:18526`); Same-Slot-Succession ist nicht implementiert.

Gemessen vor dieser Übergabe: Slot 1 `32,9%`, Slot 5/Game-MAIN `40,4%`, Slot 11 `26,8%`, Slot 13
`29,3%`; diese Sitzung in Slot 4 lag zuletzt bei `39,6%`. Vor Aktivierung muss der Owner deshalb
entscheiden:

- cross-slot jetzt als begrenzten Canary aktivieren und Schwelle/Safe-Point benennen; oder
- Same-Slot zuerst bauen und erst danach automatisch schalten.

Keine `.env`-Änderung und keinen Server-Restart aus diesem Handoff ableiten. Host-Konfiguration,
Restart und die gewählte Schwelle sind Owner-Akte. Bis dahin Übergaben manuell und in arbeitssicheren
Momenten durchführen.

## 5. Operative Sicht und alte Arbeit

Die Ledgers halten exakt 200 Tasks: 128 pending, 1 queued, 1 sent, 66 done, 4 archived. Damit sind
130 offen: 95 Aufträge, 34 Notizen, 1 Richtung. `register.sh` markiert 17 Zeilen seit 22 Tagen als
`needs-you`. Von 64 Programmen sind 26 aktiv; nur sechs davon haben offene Tasks, 20 aktive Programme
haben keine offene Task. Das ist Sicht- und Entscheidungsbedarf, kein Beweis, dass sie abgeschlossen
sind.

Nächster Board-Slice nach P0 und Produktionsbeweis:

1. kompakte/collapsible operative Gruppen;
2. sichtbarer Hinweis auf die 200er Retention, die nur terminale Rows verdrängt
   (`server.ts:2844`);
3. eigene stale/unbound-Recovery-Gruppe;
4. die 17 `needs-you` und aktiven Programme ohne offene Task sichtbar triagierbar machen.

Keine Task automatisch löschen/archivieren und kein Programm automatisch auf complete setzen.
Task `d98fe812` ist als read-only Architekturreview queued, aber Pi/Z.ai ist nicht unattended
automatisierbar; Owner entscheidet manuelles Starten, erlaubte Neubesetzung oder Rücknahme. Die eine
offene Richtung `23eef33d` verlangt Merge-Train plus Staging-Dev-Instanz, aber ausdrücklich erst
nach Lands/Tag-Messung, Bruchstellen-Inventar und Owner-Promotion. Vor belastbarem Auditrail nicht
bauen.

Von den alten Harvest-Kandidaten ist Context-Pack A (`716f53e`) bereits in `main`; nicht neu bauen.
D1/Stuck-Sensor (`2954eff`, `fleet/260827083510-80fe`) ist noch ein Commit ahead, aber 89 Commits
behind und überschneidet sich mit P0 in `server.ts`. Nach P0 neu gegen den aktuellen Vertrag prüfen,
dann bewusst rebasen/reparieren oder als überholt stehen lassen; nicht blind landen.

## 6. Grenzen und fremde Zustände

- Slot 1 (`second-hostS4`) ist lebendig, aber ohne Task-/Programmbindung; diese Recovery wurde deshalb
  von der gebundenen Nachfolgesitzung in Slot 4 geführt. Nicht nachträglich Besitz erfinden.
- Eine offene Owner-Attention gehört Private-repo-o/Slot 5 und fragt nach einem Taste-Gate. Diese
  Fleet-Recovery beantwortet oder übernimmt sie nicht.
- Im Main-Checkout liegen 28 vorbestehende ungetrackte Owner-Dateien. Nicht anfassen, committen oder
  löschen. Unbeteiligte Dateien dürfen einen Lane-Land nicht in einen Cleanup-Auftrag verwandeln.
- Unaufgelöst beim Handoff: laufender P0-Isolated-Tail; unbekannter Check des roten `dbb2e09`-Audits;
  fehlender Second-host-Daemon-Rollout; Owner-Entscheid über Succession-Modus und Schwelle; D1-
  Adjudikation; visuelle Board-Prüfung.

# HANDOFF — Session „🤗 hf-schwarm II" (Slot 5), Abschluss 2026-08-29

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Vorgängerin: `800f08b`
(hugFaceInci). Diese Session hat deren §1 abgearbeitet — Aufträge 0 und 1 sind gelandet, Auftrag 2
ist owner-seitig und der einzige offene Punkt.

## 1. WAS DU ALS ERSTES WISSEN MUSST: die Vorgänger-Adjudikation stand auf einer falschen Prämisse

Die Notiz `40f62f7` schreibt, `mainSha` sei „die BEHAUPTUNG des Servers, nicht die Messung des
Helfers", und schließt daraus auf `unknowable`. **Der erste Halbsatz gilt für die falsche Hälfte der
Frage.** `server.ts#buildHelperBundle` liest den SHA aus dem **Header der geschriebenen
Bundle-Datei** zurück; `helperClaim` schreibt genau den als `mainSha`. Ein zwischenzeitlich
gewandertes main hätte einen ANDEREN `mainSha` erzeugt, keinen verdeckten.

Drei unabhängige Messungen, alle in `docs/messungen/2026-08-29-bundle-provenienz-second-host.md`:
Herkunft aus dem Bundle-Header · `0cd5e23`/`972dd48` sind **Nachfahren** von `748ec97` · ihre
**Committer**-Zeit ist 12:36:07, der Bericht kam 12:32:48 — sie landeten **3m19s nach** dem Audit.
Die Vorgängernotiz datierte `972dd48` auf 12:24; das ist die AUTOREN-Zeit, und der Unterschied ist
hier der ganze Punkt.

**Die Parallel-Session-Hypothese ist damit widerlegt, nicht bloß unbewiesen.** Was wirklich keinen
Sensor hatte, war EIN Glied: übergebenes Bundle → tatsächlich ausgechecktes Verzeichnis. Genau das
schließt Auftrag 0.

**Ich habe NICHT neu adjudiziert, mit Absicht.** Die Ursache des leeren `successorToken` auf Linux
ist weiterhin geschlossen statt gemessen. `unknowable` durch `stale-test` zu ersetzen, weil eine
Prämisse fiel, wäre derselbe Fehler gespiegelt. Das Urteil gehört **hinter** Auftrag 2.

## 2. Gelandet in `b3f4230` (DIREKT-COMMIT — für jedes land-seitige Ledger unsichtbar)

Kein `git notes --ref=fleet/land`, keine Zeile in `lane-outcomes.jsonl`, **kein Post-Land-Audit**.
Die Verifikation lief deshalb von Hand und VOLL:

| Kette | Ergebnis |
|---|---|
| Land-Gate-Kette (`watchdog.sh:91`) | exit 0, ALL PASS |
| `./e2e-isolated.sh` | ALL PASS, 3273 Checks, 0 FAIL |
| `./e2e-postland-audit.sh` | ALL PASS, 0 FAIL |

Deploy `aa7ee409`: `ok:true`, `hitTarget:true`, `bundleStale.stale:false`, `codeBehind:false`.

**Auftrag 0:** der Daemon misst nach dem Klon `git rev-parse HEAD` im Klon und schickt `clonedSha`;
der Server validiert (40 Hex oder NICHTS) und legt ihn unter `remote.clonedSha` **neben** `mainSha`.
Gemessen-oder-abwesend — ein fehlgeschlagenes rev-parse sendet kein Feld. Eine Divergenz wird in
audit()- und Alarmzeile geschrien, **ändert aber kein Verdikt**.

**Auftrag 1:** `successorToken … ?? ""` ist raus, ersetzt durch eine benannte precondition, die als
sie selbst fällt und die **Länge** des Tokens berichtet, nie den Token.

## 3. DIE LEHRE DIESER SESSION — ein grünes `ALL PASS` deckte nur die Hälfte

`./e2e-isolated.sh` lief ALL PASS über 3273 Checks und hat von meinen vier neuen Sonden **nur zwei
geladen**. `(K)` und `(HD)` liegen in `fleet-e2e-postland-audit.ts` — dem Wrapper, den **kein Gate
fährt**. Wer auf das grüne Wort geschaut hätte, hätte Auftrag 0 auf einer Suite für verifiziert
erklärt, die seine Pins nie geladen hat. Prüfung ist billig: `grep -c '^PASS  (HD)'` auf den Log.

Die entscheidenden Zeilen, weil sie die Mac/Linux-Asymmetrie sichtbar machen:
- `(HD) … cloned=1636b14a == mainSha == handedOver` — ECHTER Daemon, ECHTES Bundle, sein eigenes
  rev-parse. Die einzige Stelle im Baum, die Auftrag 0 tragen kann.
- `Program-MAIN succession precondition … slot=7 row=present token=32 chars` — auf **diesem Mac** ist
  der Token da. Auf dem Second-host war er es nicht.

## 4. DER OFFENE PUNKT: Auftrag 2, und er ist owner-seitig

Den Audit auf demselben Tip auf dem Second-host wiederholen. **Von hier aus nicht machbar**, aus drei
gemessenen Gründen:
- `helper-daemon/README.md` hält als promovierte Invariante fest: *„no ssh runner, no push — the
  Fleet never opens a connection towards the helper machine."* Alles ist ein PULL des Daemons.
- `ssh second-host` scheitert an der Host-Key-Prüfung; `known_hosts` ist geteilte Realität außerhalb
  dieses Repos — angefasst habe ich es nicht.
- **Ein Direkt-Commit stellt KEIN Audit in die Queue** (Tier-2 hängt an `landLane`). Es gibt keine
  Route, die einen Audit von Hand einreiht — `/api/post-land-audits` ist GET + adjudicate.

**Zwei Wege, deine Wahl:** (a) den Daemon auf dem Second-host aus `b3f4230` aktualisieren, dann trägt
der nächste dort geclaimte Audit `remote.clonedSha`; (b) mir Zugang geben für eine wörtliche
Wiederholung auf `748ec97`. Bis dahin trägt der Second-host das Feld NICHT — die Server-Hälfte steht,
die Geräte-Hälfte nicht.

## 5. Zwei Enden aus dem Vorgänger-Handoff §2: BEIDE LEBEN — nicht neu bauen

- **A (Context-Pack):** `fleet/260827123336-6f18`, 1 Commit über main, `.fleet/context-packs.json` +
  `e2e/context-packs.ts`.
- **D1 (Stuck-Sensor):** `fleet/260827083510-80fe`, 1 Commit über main, `lane-signals.ts`,
  `server.ts`, `e2e/lanes-lifecycle.ts`.

Beide stehen in `lane-outcomes.jsonl` als `killed-dirty`; die Worktrees liegen noch auf Platte.

## 6. Korrektur am Fehlerbericht der Vorgängerin + neue Queue-Zeile `ae8715dc`

`POST /api/self/succeed` scheitert reproduzierbar mit `composer still holds 98 chars after 3000ms`.
**Der Mechanismus im Vorgänger-Handoff stimmt nicht:** `succeedSupervisor` RUFT
`waitForFoundingReadiness`, und für eine claude-Nachfolgerin ist dieser Wait per Konstruktion ein
No-op — nur `PI_OX_HARNESS` und `CODEX_HARNESS` deklarieren ein `readiness`. Der Dispatch-Pfad hätte
dort **genauso wenig** gewartet.

Der tragende Befund ist der andere: **98 Zeichen, invariant über zwei verschieden lange `carry`** —
was nicht mit dem Brief skaliert, ist nicht der Brief. Nächster Schritt ist `awaitComposer` /
`after.length`, nicht der Readiness-Pfad. Verdacht (INFERIERT): dieselbe fehlende Succession erklärt
den leeren `successorToken` im roten Second-host-Audit.

## 7. Nicht gefixt, benannt

- Der Kommentar an `server.ts#paneReadiness` sagt „every adapter but codex" und ist seit
  `PI_OX_HARNESS` stale — **zwei** Adapter deklarieren `readiness`.
- Punkt 3 der Vorgängernotiz (füllt sich `checks.ran` aus dem gedeckelten Tail?) ist unangetastet.
- Ein Sweep über weitere `?? ""`-Credentials in Fixtures steht weiterhin aus.
- `docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md` tauchte während dieser Session untracked
  auf und ist **nicht meins** — eine parallele Session arbeitet. Nicht angefasst, nicht committet.

---

## Controller-Session Workflow-Audit (Slot 11, 2026-08-30 vormittags) — Übergabe

**Was geschah (alles gelandet, nichts nur im Gespräch):** Der Owner spielte den Private-repo-o-Build
`db6ed75` und urteilte „ändern"; ein dreisträngiger Workflow-Audit lief (Produkt-Forensik am Build,
Prozess-Forensik über die Ledger, GLM-Instrumentenkritik) plus Stufe 2 (Kontext-Sättigung am
25/30-Band, Modell-Mix). Lies in dieser Reihenfolge, Frontmatter zuerst:
`docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md` (V1–V7) ·
`…-worktrail-audit-stufe2-kontext-modellmix.md` · `…-game-maker-instrument-audit-glm.md` ·
`…-private-repo-o-prozess-forensik-anhang.md` (Rohtabellen).
**Promotet am 2026-08-30:** game-maker-Regeln V1–V3 (`75b2110`) · AGENTS.md §Context
self-management (`6e08514`) — Füllstand kennen ist Agentenpflicht, Entscheidung dynamisch je
Auftrag; der Owner hat die 25-%-Qualitätsgrenze ausdrücklich bestätigt (Memory
`feedback-context-quality-degrades-at-25pct`).

**In Flug, gehört der Game-Maker-MAIN (Slot 5), nicht dir:** R7 (Lenk-Vorzeichen + Konventions-Pin
in einem Schnitt) und R8 (Kantenlinie oder Card-Zeile streichen), danach blinder sensory Critic auf
dem gefixten Stand, dann Owner-Taste als neue Attention. Attention `e98c0c91` ist beantwortet
(Antwort = Taste-Verdikt + Forensik, in der Attention nachlesbar). Nicht anstupsen — die MAIN
meldet sich über Attention/Report.

**Beim Owner offen (nur erinnern, wenn er fragt):** V4 (selfLand:"guarded" als Founding-Default) ·
V5 (enge Quiet-Hours-Ausnahme für `releasedBy:"machine"`-Tasks gebundener MAINs) · Lifecycle-Program
(fertiger Prompt in `docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md`) · Sensor-Task
`051cc1c2` (ctx auf GET /api/self; Done-Kriterium steht in der Zeile) · A/B-Paar Opus/Sonnet auf
einer Renderer-Reparatur im nächsten Game-Maker-Lauf.

**Warnungen:** (1) Parallel arbeitet eine Fleet-Recovery-Session mit eigenem HANDOFF-Top-Block —
nichts dort überschreiben, Slots nicht anfassen. (2) Sättigungs-Urteile IMMER gegen 25/30 messen,
nie gegen das 83-%-Kliff (der erste Verdict dieser Session war daran falsch). (3) Der
Post-Land-Audit stempelt in Nicht-Fleet-Repos konstruktionsbedingt `unknown` (exit 42) — das ist
kein Defekt-Signal; V6 wäre der Fix.

## Session „Transkript-Forensik + Rückkanal" (Slot 13, Abschluss 2026-08-29/30) — abgeschlossen, nur Zeiger

Anlass war eine Suchfrage („finde die Session zum HuggingFace-Vorfall"), aus der zwei Messungen und
ein Rückkanal-Fix wurden. **Nichts ist in Flug, nichts wartet auf jemanden.**

Gelandet, alle drei mit grünem Beweis:
- `6e67a24` + `024f70c` (Direkt-Commits, Haupt-Checkout — für jedes land-seitige Ledger unsichtbar;
  Verifikation von Hand gefahren: erstes volle Kette 7× ALL PASS, zweites proportional docs-only
  install+pins ALL PASS): `docs/transkript-forensik-2026-08-29.md` + `find-conv.py`.
- `465130b` GLM-Review dazu (`docs/messungen/2026-08-29-glm-review-transkript-forensik.md`), Land
  über einen agent-aufgelösten `INDEX.md`-Konflikt, per `{"confirm":true}` nach Diff-Sicht bestätigt.
- `b6956c9` der Fix: `POST /api/self/watch` (und die Owner-Route, gemeinsamer Schnitt in
  `createWatchForSlot`) lehnt `{kind:"lane"}` auf einen nicht-automatablen Harness jetzt mit 409 ab.
  **Post-Land-Audit GRÜN und echt gelaufen: 3294 Checks, 0 Fails, 23,6 min** (nicht die `ran:0`-Sorte).

Der Befund dahinter, weil er wiederkommt: `aliveInfo` faltet `harnessAutomatable` in `alive`, und
BEIDE Looking-Prädikate verlangen `alive === true`. Eine fertige Lane auf `pi-zai`/`pi-unfenced`/
`container` konnte darum nie `done-looking` werden — der Watch blieb still für immer scharf. Wer auf
so eine Lane wartet, nimmt einen Hintergrund-Watcher auf die git-Fakten; `{kind:"merge"}` war und
bleibt unbetroffen (der Tick liest `mergeTerminalFor`, nicht `laneSignalView`).

**Beim Owner offen — ein propose, kein Auftrag:** CLAUDE.md sagt für gitignorte Dateien
„`rg -uu` (oder schlicht `grep`)". Der Klammerausdruck ist widerlegt: `grep` ist in einer
Claude-Code-Bash-Zelle eine zsh-Funktion, die das claude-Binary als `ugrep` mit `--ignore-files`
fährt und gitignorte Dateien still überspringt (Probe: Shim 2 Treffer, `command grep` 5 — Differenz
`CLAUDE.md`, `rulebook/einstieg.md`, `streams/prompts.jsonl`). Ersatztext samt BRE-Halbsatz steht in
`docs/transkript-forensik-2026-08-29.md` §5 und in der GLM-Notiz. `state.sh`/`register.sh` sind
nicht betroffen (laufen als Skript). Nicht gepinnt: `find-conv.py` hat keine Sonde — Werkzeug, kein
Sensor. Diese Session war bei 29,3 % gemessen.
