# HANDOFF — Generalsanierung (Program `b2a14b545fd31fd71ba7b9e1`, Slot 4 → Nachfolge): RESCOPE in Kraft, Vollsplit beendet, ZWEI Lands gruen — und zwei fertige Lands haengen an einer verstopften Suite-Schlange; 2026-09-04 (03:3x), ctx GEMESSEN 29,9 %

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`,
`GET /api/self/program-execution`. Hier steht nur, was git und die Sensoren NICHT tragen.

## 1. DEIN ERSTER AKT: zwei verifizierte Lands liegen bereit, und sie haengen NICHT an ihnen selbst

**B-07 (`97f9bd97`, Lane `fleet/260903205300-7830`, Slot 1)** und **E1 (`4b92b2f0`, Lane
`fleet/260903192830-8293`, Slot 11)** stehen beide auf `REVIEWABLE`, beide Diffs habe ich
gelesen und geprueft, beide Gate-Ketten waren gruen. **Ich habe sie nicht mehr landen koennen,
und der Grund ist nicht die Arbeit, sondern die Maschine — er steht als B-17 im Register.**

**Was zweimal passiert ist:** B-07s erster Landeversuch verlor den Fast-Forward (`ff-lost`,
Ursache war mein eigener Doc-Commit waehrend des laufenden Gates — siehe Lehre unten). Der
ZWEITE Versuch gab nach **2 703 s** auf: `status:"resolved"`, `landed:false`,
`verify.ok:null`, `detail: "clean rebase, but verify NEVER STARTED"`. Das ist **kein Rot** —
der Gate hat den Baum nie angesehen. Zur selben Zeit standen drei `./e2e-isolated.sh`-Wrapper
in der Schlange, einer davon seit 46 min: laenger als das gesamte Wartebudget eines Lands.

**Also, dein erster Akt, in dieser Reihenfolge:**
1. `ps -eo command | grep -c '^/bin/sh ./e2e-'` — steht die Schlange noch? Wenn ja, hat ein
   Landeversuch weiter schlechte Chancen; das ist Diagnose, nicht Resignation.
2. `POST /api/self/tasks/97f9bd97/land`, dann (NACH dessen Terminal) `4b92b2f0`. Nie zwei
   parallel.
3. **Verlass dich beim Merge-Watch NICHT auf `POST /api/self/watch {kind:"merge"}` fuer B-07.**
   Ich habe dort `armed:false` zurueckbekommen — den VERBRAUCHTEN Watch des ersten Versuchs,
   ausgeliefert als erfolgreiches Abo. Das ist exakt der Bug, den B-07 behebt und der bis zu
   seinem Land live bleibt. Nimm stattdessen einen Hintergrund-Watcher auf
   `fleet.json → merges["1"].at`.

**DIE LEHRE, die im Regelbuch fehlt und die mich ein Land gekostet hat: waehrend dein eigenes
Land laeuft, committe NICHTS ins Haupt-Checkout.** Der Gate braucht 100-140 s, und jeder Commit
auf main in diesem Fenster nimmt dem Land den Fast-Forward. Doc-Commits fuehlen sich harmlos an;
`c0f6fef` war meiner. Reihenfolge, die funktioniert: committen, DANN landen.

## 2. Was gelandet und verifiziert ist

| Was | SHA | Gate | Post-Land-Audit |
| --- | --- | --- | --- |
| Slice 7a `server/proc.ts` (letzter Split-Slice) | `6b8b89d` | gruen, volle Kette | rot → `flake` (B-13) |
| B-06 Deploy schuetzt laufenden Land | `1e5419c` | gruen, volle Kette | rot → `flake` (B-14) |
| B-07 Spent-Merge-Watch | — | **gruen, aber ff-lost** | — |

Slice 7a ist **deployt** (`8e072fc1`, `ok:true`, `bootHead 7e3070f`) — nachgeprueft an
`deploys.jsonl`, nicht geglaubt. `deployGap.codeBehind:false`, `bundleStale:false`.
`bun e2e/pins.ts` ALL PASS, `graphify update .` aktuell (9428/13778/682).

## 3. Der RESCOPE — in Kraft, mit ZWEI unbelegten Stellen

Der Fleet Controller (Slot 8, Owner-Delegation) hat den Vollsplit beendet. Steht als
RESCOPE-Abschnitt **oben** in `docs/sanierung-2026-09/plan-2026-08-31.md`; Erfolgsmass 1
(`Kern <= 8.000`) ist dort **durchgestrichen**, nicht still umgeschrieben. Neues Zielbild: Kern
stabil, Blatt-Invariante fuer `server/*`, kein Modul > 2.000.

**Zwei Dinge fehlen, und sie sind KEINE Schlamperei von dir, wenn du sie offen findest:**
- Das als Beleg genannte `docs/messungen/2026-09-03-gegenpruefung-sanierung-rescope.md`
  **existiert nirgends** — nicht auf main, nicht in einem Branch, nicht in einem Worktree
  (`git log --all --diff-filter=A` geprueft). Die zwei Gegenpruefungsberichte sind zitiert,
  nicht belegt.
- Die **Stop-Regeln GLM i–iv** wurden verlangt, aber nie uebermittelt. Ich habe sie NICHT
  erfunden. Erster Punkt fuer dich oder den Controller.

Der Entscheid selbst ist trotzdem tragfaehig: meine eigene Messung
(`p4-slice7-vorbereitung.md` §6/§7) kam unabhaengig zum selben Schluss.

## 4. Was laeuft und was wartet

- **E1 (`4b92b2f0`), Slot 11, codex/gpt-5.6-sol/high, ctx 43,7 %** — Audit-Sensoren: Fail-Namen
  in `auditPingMessage` (`server.ts:9894-9925` druckt `row.fails` NIRGENDS, obwohl `:13436` sie
  persistiert) und `checks.ran`, das die AUFZEICHNUNG statt des LAUFS zaehlt
  (`postLandAuditChecks`, `server.ts:12398-12420`).
  **Nachreichen, sobald sie sich meldet** (ich wollte ihren laufenden Schnitt nicht stoeren):
  derselbe Sensor ist auch auf dem **Vorschau**-Pfad kaputt — der Suite-Job `2b2d3b8260b3`
  meldet `checks {ran: 22, failed: 0}` bei 3542 echten Trail-Zeilen.
- **B-09 (`51f59f63`), `queued`** — ff-lost-Backfill beim Boot. Brief liegt fertig in
  `docs/sanierung-2026-09/briefs-e5-2026-09-03.md`. Dispatch:
  `POST /api/tasks/51f59f63/dispatch` mit `{harness:"codex",model:"gpt-5.6-sol",effort:"high"}`,
  Master-Dispatch bleibt aus.
- **`d2e4f219`, `pending`** — `SUITE_OFFER_WAIT_HELD_MS` falsch dimensioniert. Aeltere Zeile,
  vom Controller zu `auftrag` konvertiert.

**Deckel, an die ich mich gehalten habe:** max 2 Lanes gleichzeitig, nie zwei Lands parallel.

## 5. Drei Korrekturen, die ich an FREMDEN Briefs vorgenommen habe — pruef sie bei den naechsten

Die E5-Briefs (`4c33933`, von sol) sind gut, trugen aber drei Fehler, die je eine Lane gekostet
haetten. Ich habe sie als K1–K3 VOR den unveraenderten Brieftext gehaengt:
- **K1:** der VERIFY-Block sagt `http://127.0.0.1:8790` — das antwortet auf dieser Maschine NIE
  (der Server bindet nur die Tailscale-IP). Der allererste Befehl waere gescheitert und haette
  wie ein toter Server ausgesehen.
- **K2:** `./e2e-isolated.sh` stand als blinder lokaler Lauf drin. Erst Portal anbieten,
  Abbruch nie per Namensmuster. **ACHTUNG — die Haelfte „lokal nur bei null laufenden Suiten"
  habe ich ZURUECKGEZOGEN, und B-09 traegt sie noch.** Sie war ein Deadlock: der Zaehler zaehlt
  auch WARTENDE Wrapper mit, und die Wrapper serialisieren sich seit `ddc5128` ohnehin selbst
  ueber `/tmp/fleet-e2e.lock` — auf dieser Maschine wird der Zaehler nie 0. Zwei Lanes sind
  darin haengengeblieben (die E1-Lane 3 h, mit Klaerungsfrage; die B-07-Lane bis ich sie per
  `POST /send` herausgeholt habe). **Wenn du B-09 dispatchst, schick die Korrektur mit:** einfach
  starten, den Mutex serialisieren lassen, die `[suite mutex: …]`-Zeile zitieren. Und besser
  noch, nach B-17: die Vorschau NUR verlangen, wenn der Schnitt `e2e/`, einen Wrapper oder den
  Merge-/Land-Pfad beruehrt — B-09 tut das, E1 tat es nicht.
- **K3:** Beweisordnung §11.7 plus die drei offenen Flake-Familien mit Basisraten.
**K2 hat sich sofort bezahlt gemacht:** die B-07-Lane konnte ihren Rerun nicht fahren, weil die
Maschine nie frei war — und hat korrekt `needs-main` gemeldet statt ein gruenes Ergebnis zu
behaupten.

Dazu **K4 per `POST /send`** an die B-07-Lane: ihr Brief war auf `869a16d` vermessen, B-06 hatte
inzwischen `e2e/merge.ts` genau in ihrer Region um ~30 Zeilen verlaengert. Zwei Briefs aus
derselben Charge kollidieren also in der DATEI, nicht im Server — pruef das bei B-09.

## 6. Vier Registerzeilen, die ich neu geschrieben habe

`docs/sanierung-2026-09/p6-befundregister.md`:
- **B-13** — die Flake-Begruendung zu `6b8b89d`, drei unabhaengige Beweislinien. Sie steht dort
  und nicht an der Zeile, weil die Adjudikationsnote bei **300 Zeichen** kappt (dritte Instanz
  von `7e984bde`).
- **B-14 — der wichtigste Befund des Abends.** Der REMOTE gefahrene Post-Land-Audit ist
  **17 rot / 3 gruen / 9 unknown von 29**, lokal **82 rot von 419**. Und jeder rote Remote-Lauf
  mit Namen zieht ausschliesslich aus der Watch/Event-Transportfamilie von `e2e/watch.ts`.
  Der Beleg, der die MASCHINE ausschliesst: die B-06-Lane liess denselben Inhalt Minuten vorher
  ueber das Portal auf DEMSELBEN `second-host` laufen — 3542 Checks, **0 FAILs**. Ein Sensor mit
  85 % Rot ist Rauschen, kein Alarm. **Ausdruecklich nicht kontrolliert:** die Remote-Zeilen sind
  juenger und dichter, die lokalen decken die ganze Historie — die Assoziation ist gemessen, die
  Kausalitaet nicht.
- **B-15** — B-07s neue Ablehnung unterscheidet die Lane, nicht den Merge-LAUF. Kein Blocker
  (das alte Verhalten war schlechter), Done-Kriterium steht an der Zeile.
- **B-16 OFFEN** — hat mein eigenes B-06-Land die Rate des Merge-Resolution-Guards angehoben?
  B-06 setzt ein `restartSrv()` MITTEN in `e2e/merge.ts`, und der betroffene Guard ist
  nachgelagert. Die E1-Lane ist entlastet (ein Rot liegt 22 h davor), mein Land ist es NICHT —
  das sind zwei Fragen, beantwortet ist nur die erste.
- **B-17 — der zweite grosse Befund.** Die Tier-2-VORSCHAU verhungert den Land-GATE: der Mutex
  behandelt alle sieben Wrapper gleich, aber die Lane-Vorschau ist per Owner-Entscheid KEIN
  Gate, waehrend `VERIFY_CMD` eines ist. Ein optionaler Lauf verdraengt einen pflichtigen.
  Erklaert drei Vorfaelle einer Nacht (2000-s-Acquire, 3-h-Blockade, 2703-s-Waitout) und haengt
  an B-14: weil lokale Laeufe die Maschine saettigen, wandern Audits auf den Remote-Helfer mit
  85 % Rotrate. Drei Richtungen vorgeschlagen, keine gebaut.
- **B-12 entschieden** — der Advisory-Deckel 10/10 ist KEIN Owner-Tor. Er zaehlt nur
  `source:"main"`, und Erfolgsmass 6 verlangt je Befund einen von drei AUSGAENGEN; das Register
  ist die LISTE, nicht einer der Ausgaenge. Die Disposition gehoert in P6. **Stell dieses Tor
  nicht zum vierten Mal.**

## 7. Ehrlichkeiten

- **Ich habe den §11.7-Same-Tree-Rerun bei B-07 NICHT nachgeholt.** Das ist eine bewusste
  Abweichung: fuer die §11.2l-Familie ist der Rerun dokumentiert nicht diskriminierend (er faellt
  identisch — bei Slice 7a Stunden vorher bewiesen), entschieden hat das Trail-Register, das mir
  vorlag. Ein ~50-min-Lauf haette zusaetzlich jedes andere Gate blockiert. Wer das anders sieht,
  hat einen Punkt — die Abweichung steht hier, damit sie pruefbar ist.
- **Vier Direkt-Commits aus dem Haupt-Checkout** (`3671156`, `ab1d6c9`, `e670579`, `c0f6fef`,
  plus dieser) — alle docs-only, alle mit `bun e2e/pins.ts` ALL PASS von Hand verifiziert. Sie
  sind fuer JEDES land-seitige Ledger unsichtbar; `./state.sh`s Land-Health-Zahlen untertreiben
  diesen Tag entsprechend.
- **`HANDOFF.md` wurde von einer fremden Program-MAIN von 5755 auf 123 Zeilen ERSETZT**
  (`11ed2b3`), nicht ergaenzt. Das ist **B-08, zweite Instanz**. Nichts ist verloren — der
  vorherige Stand steht in `git show 694cd73:HANDOFF.md`, der Sanierungs-Abschnitt meiner
  Vorgaengerin darin. Ich habe meinen Abschnitt oben angehaengt und den alten Stand NICHT
  wiederhergestellt: das ist ein Owner-/Controller-Entscheid, kein Alleingang meinerseits.
- **Die Attention `d3b14a4d` meiner Vorgaengerin steht weiter auf `open`** und ist tot: ihr
  Requester-Slot ist weg, `answerAttention` wuerde mit 409 refusen. Ich habe sie nicht neu
  gestellt und den Entscheid stattdessen selbst getroffen (§7 der Slice-7-Vorbereitung).
- **Ich habe in dieser Session KEINE Attention gestellt.** Die einzige, die ich fuer echt
  Owner-Sache halte, ist die Erreichbarkeit von Erfolgsmass 1 — und die hat der RESCOPE
  inzwischen beantwortet.


---

# HANDOFF — Program-MAIN Game-Maker-Workflow v2 (`b2aa5b453d0f2bf9ddce8232`, Slot 9): Schritte 3–4 gelandet, das Programm haengt nur noch an EINER Owner-Antwort; 2026-09-04 (01:1x), ctx GEMESSEN 21,2 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was
git und die Sensoren nicht tragen.

## 1 Das Erste, was du tust: NICHTS starten, bis die Attention beantwortet ist

**`8b4772db1d9dcf39d833383f` (kind `decision`) ist offen und ist das einzige Tor.** Sie stellt die
zwei offenen Fragen des Programs:

1. **Worauf laeuft der Trockenzyklus (Schritt 5/5)?** Pausierte Private-repo-j mit FRISCHER MAIN
   (Slot 7 laeuft noch und steht bei 34,7 % — er muesste ERSETZT werden, nicht weiterbenutzt) oder
   ein kleines Canary. Empfehlung Controller und beide bisherigen MAINs: **Private-repo-j**, weil nur
   dort die Vergleichszahl 528k existiert. Ohne sie ist ein gemessenes „unter 25 %" eine Zahl ohne
   Massstab.
2. **Muss Program-scoped Dispatch (`5c1f831f`) vorher landen?** Empfehlung: nein, Hand-Dispatch
   fuer den einen Zyklus.

**Fang Schritt 5 nicht unter einer Annahme an.** Beides sind ausdrueckliche `openQuestions` des
Programs; eine geratene Antwort macht die Messung wertlos, weil sie die Vergleichsbasis waehlt.

## 2 Gelandet und am Baum nachgeprueft (nicht der Benachrichtigung geglaubt)

| Datei | Z. | SHA | Beleg |
|---|---|---|---|
| `docs/game-maker/entwurf/kreuzreview-glm.md` | 408 | `d1d29c1` | Land-Note: verify.ok true, proportional, 786 ms, Tail `ALL PASS` |
| `docs/game-maker/workflow-v2.md` | 600 | `49e3d97` | Land-Note: verify.ok true, proportional, 778 ms, Tail `ALL PASS` |
| `docs/game-maker/brief-profil-v2.md` | 377 | `49e3d97` | dito |
| `docs/game-maker/entwurf/adjudikation.md` | 309 | `49e3d97` | dito |
| Pack-Kennung in A und B korrigiert | 4 Z. | `2ad3670` | **Direkt-Commit**, s. §5 |

**Erfolgskriterium (1) ist erfuellt und gegen die Abschnitte geprueft**, nicht gegen die Meldung:
Rollen-Graph §1, Kontextbudget je Rolle IN TOKENS §1.2 (zwei Zahlen je Rolle — Budget UND
Stop-Linie, jede aus einer Pack-Zahl hergeleitet), Report-Vertrag §2, Critic-Zweitweg §3,
Preflight-als-EINE-Lane §4. **(2)** ist erfuellt: alle vier Entwurfs-/Review-Dateien liegen unter
`docs/game-maker/entwurf/` mit Receipt, `adjudikation.md` §1 urteilt je Streitpunkt mit Begruendung.
**(3)** ist zur HAELFTE erfuellt: die Vorhersage steht (§6), die Nachmessung ist Schritt 5.
**(4)** ist zur HAELFTE erfuellt: die Zeilen liegen (§3), die ctx-Messung bei Abschluss fehlt noch.

**Das Urteil, um das es ging:** A gewinnt 8 von 10 (A1–A5, A7, B, C), B gewinnt A6. Der Kernstreit
A7 ist entschieden — **142 250 Vorhersage, 250 000 = 25,0 % Widerlegungsgrenze**, Messweg EIN Blick
auf `ctx` in `GET /api/sessions`. Bs 65 000 ist rechnerisch ok, bucht aber die Betriebskosten einer
ARBEITENDEN MAIN mit null (74 500 von 77 250 Delta) und 11 000 doppelt.

## 3 Die Fleet-Zeilen (Erfolgskriterium 4) — was liegt und was NICHT doppelt gefilet werden darf

`workflow-v2.md` §7 nennt vier Voraussetzungen. Stand, jeder Punkt nachgesehen, nicht angenommen:

- **F1** = `5c1f831f`, pending, `programId: null`. Traegt bereits ein volles DONE-KRITERIUM mit
  Fixture-Ort und ist **schaerfer als die §7-Fassung** — nicht ersetzen, nicht neu filen.
- **F2** = `328fd28f`, von mir gefilet, pending, `claude-opus-5[1m]`/high, Fixture `e2e/tasks.ts`.
- **F3** = **laeuft bereits als Lane `6f401842`** (Slot 5). Sein DONE (1) deckt F3 woertlich.
  **Nicht neu filen.**
- **F4** = `e0d625a5`, von mir gefilet, pending, `claude-opus-5[1m]`/high, Fixture `e2e/programs.ts`.
  Der Brief nennt ausdruecklich den Bezug zu Notiz `0f44755c` (selbe Klasse, ANDERE Zeile: `0f44755c`
  ist MAIN→Owner, F4 ist Lane→Projektion) und weist die Lane an, eine gefundene Ueberschneidung zu
  MELDEN statt ungefragt mitzubauen.

**Ich habe F2/F4 bewusst NICHT released.** Der Non-Goal sagt, die Fleet-Zeilen werden gefilet und
vom Controller seriell dispatcht — die Release-Tuer stand offen, das ist nicht der Grund, sie zu
benutzen.

## 4 Der Betriebsbefund, der groesser ist als dieses Programm

**Der Post-Land-Audit hat eine Rauschgrenze von 49 %.** Gemessen ueber alle 35 Trail-Laeufe in
`$TMPDIR/fleet-e2e-trail`, zwei Flake-Familien nebeneinander:

```
busy-receiver (§11.2l, e2e/watch.ts)      11 von 35 rot   (31 %)
Q6 fleet-report / subject-gone            9 von 35 rot   (26 %)
mindestens EINE der beiden rot           17 von 35       (49 %)
```

Bei jedem zweiten Land ein Rot, das routinemaessig als Flake abgetan wird — **genau da geht das
erste ECHTE Rot unter.** Das ist der Preis, und er faellt jedem an, der heute landet, nicht nur
diesem Programm.

**Eine Hypothese, die ich geprueft und VERWORFEN habe — falls du dieselbe Spur aufnimmst:** die
letzten sechs Laeufe sehen aus, als wechselten sich die beiden Familien ab (beide schweren
Q6-Laeufe hatten busy-receiver gruen). Die Kreuztabelle ueber alle 35 widerlegt das:
`busy gruen/Q6 gruen 18 · busy gruen/Q6 ROT 6 · busy ROT/Q6 gruen 8 · beide ROT 3`. Erwartungswert
fuer „beide rot" bei Unabhaengigkeit ist 35 × (11/35) × (9/35) = 2,8, beobachtet 3. Das sind zwei
UNABHAENGIGE Familien, keine gemeinsame Wurzel. Die 49 % entstehen von allein aus 31 % und 26 %.
Konsequenz fuer `bffe3de0`: die Zeile bleibt, wie sie ist — eine Familie, eine Fixture. Die
Q6-Familie braucht eine EIGENE Zeile, kein Anhaengsel.

**Die Beweisordnung, die hier funktioniert hat, und die du wiederverwenden kannst:** weder der
Rerun desselben Baums (faellt identisch) noch der frische HEAD-Worktree (laeuft gruen) entscheidet
diese Familien. Entschieden haben zwei Dinge:
1. **Der Zeitfenster-Join Trail ↔ `post-land-audits.jsonl`.** `00:11:41→00:40:14 ROT = tip
   c692ff44` gegen `00:40:19→01:08:17 ROT = tip d1d29c1`; `c692ff44` traegt keinen Commit dieses
   Programs, also war die Entlastung bewiesen, ohne eine Suite zu starten.
2. **Disjunkte Fehlermengen auf fast bytegleichem Code.** Audit 00:40 (tip `d1d29c1`):
   busy-receiver ROT, Q6 0/10. Audit 01:08 (tip `2ad3670`): busy-receiver GRUEN, Q6 8/10. Der
   Baumunterschied ist `git diff --name-only d1d29c1 2ad3670` = fuenf Dateien, alle Markdown unter
   `docs/`. **Eine deterministische Regression kann den vorher fallenden Check nicht REPARIEREN.**

Alle drei roten Audits dieses Programs sind als `stale-test` adjudiziert (das dritte, auf
`2ad3670`, mit Vorschlag flake beim Controller Slot 16).

**Merkposten:** das Feld `out` einer Audit-Zeile im Ledger ist ein TAIL und **elidiert die
FAIL-Zeilen** — bei acht Fehlern stand dort woertlich nur `8 FAILURES`. Wer wissen will, WAS
gefallen ist, liest den Trail, nicht das Ledger.

## 5 Zwei Dinge, die ich anders gemacht habe als der Normalweg — mit Grund

- **`2ad3670` ist ein DIREKT-COMMIT aus dem Haupt-Checkout**, also fuer jedes land-seitige Ledger
  unsichtbar (kein `git notes`, keine Zeile in `lane-outcomes.jsonl`, kein Post-Land-Audit).
  Verifikation von Hand: `bun install --frozen-lockfile && bun e2e/pins.ts` → `ALL PASS`. Das ist
  die PROPORTIONALE Kette, die der Gate seit `e896826` fuer einen rein-docs-Diff selbst waehlt.
  **Die volle `./e2e-isolated.sh` ist NICHT gefahren** — der Post-Land-Audit von `49e3d97` hielt den
  Suite-Mutex, und zwei parallele Laeufe vergiften sich auf dieser Maschine zuverlaessig. Steht so
  im Commit-Body. Schliesse nicht korrekt-aber-falsch, das sei nie vermessen worden.
- **Die falsche Pack-Kennung `36684f8` steht in beiden Receipts WEITER DRIN**, als zitierter Fehler
  mit Datum und Fundstelle. Eine stille Ueberschreibung haette den Beleg vernichtet, um den es
  geht.

## 6 Was du ueber den Rueckkanal wissen musst, bevor du eine Lane briefst

- **Eine Program-MAIN hat nach dem Brief KEINEN Sprechweg in ihre eigene Lane.** Nachgesehen: von
  den 20 `/api/self/*`-Routen gibt es keine MAIN→Lane-Push-Tuer; `/api/self/clarifications` ist
  lane-initiiert (`server.ts` antwortet einer Nicht-Lane `not a lane — only a worker lane can open a
  clarification`), die MAIN darf nur ANTWORTEN. Der einzige Push ist die Owner-Route `POST /send`.
  **Nimm dafuer nicht das Owner-Token aus `fleet.json`** — das ist das ambient-owner-token-Muster,
  gegen das dieses Repo eine eigene Suite-Familie haelt. Bitte den Controller; er relayt.
  Konsequenz fuers Briefen: **alles, was die Lane wissen muss, muss VOR dem Dispatch im Brief
  stehen.**
- **`pi-zai` kann keine Lane-Watch tragen** (`harness pi-zai is not automatable — its slot never
  reads as alive to the done-looking predicate`), eine **Merge**-Watch aber schon, sobald der
  Land-POST ab ist. Fuer eine solche Lane ist der Rueckweg ein Hintergrund-Watcher auf den
  DATEIZUSTAND auf main, kein Timer.

## 7 Stand in einem Satz

Nichts ist in Flug, keine Lane dieses Programs offen, kein Watch mehr armed (`89fb734d` hat auf
`49e3d97` gefeuert, Ergebnis in §4). Sieben Zeilen offen: fuenf `notiz` (Messungen, kein Dispatch-Motor) und die zwei
`auftrag` aus §3. Das Programm ist an einer Owner-Antwort, nicht an Arbeit.
