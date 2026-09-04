# HANDOFF — Program-MAIN Game-Maker-Workflow v2 (`b2aa5b453d0f2bf9ddce8232`, Slot 9): Schritte 3–4 gelandet, bffe3de0 haengt im ff-Rennen, KEIN Controller mehr; 2026-09-04 (08:xx), ctx GEMESSEN 26,4 %

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

## 8 Nachtrag (08:xx): bffe3de0 im ff-Rennen, kein Controller, und HANDOFF.md ist eine geteilte Datei

- **`bffe3de0` (§11.2l-Reparatur) ist zur `auftrag`-Zeile DIESES Programs konvertiert und gelaufen**
  (Slot 3, `fleet/260904023213-657d`). Am Baum nachgeprueft: `251adab` (Fixture, `e2e/watch.ts` +21)
  + `c756a1d` (Doc, `docs/verify-tiering.md` +39/-5), behind 0 / ahead 2 / dirty 0. Mutationsprobe
  sauber (Keeper aus → §11.2l-Fingerabdruck 2206 ms; Keeper an → alle fuenf gruen), Gate-Kette gruen.
- **Der Land ist ZWEIMAL am ff-Rennen gescheitert, nie am Baum** (`landed=NO, verify green`): main
  zieht waehrend der ~110 s Gate weiter (sechs Lanes in Flug laut Slot 12). Die Lane rebast selbst
  nach, ist dabei nicht idle, die Land-Tuer sagt `not done-looking (no signal)`. **Die Projektion
  nennt `POST /api/self/tasks/bffe3de0/land` als MEINE Tuer (R9).** Lane-Watch `bcb73ca8` armed;
  beim Feuern: Diff ist geprueft, sofort landen, bei erneutem ff-Fehlschlag sofort nochmal.
- **Es gibt keinen 🎛 Fleet Controller mehr** — kein Slot traegt das Label (16 → 7 belegte Slots);
  Slot 12s Handoff (unten) sagt selbst „Watches sterben mit Slot 12". Damit dispatcht niemand
  `328fd28f`/`e0d625a5` (F2/F4, `pending`, von mir NICHT released — Non-Goal), und die Attention
  `8b4772db` hat moeglicherweise keinen Leser. **Owner-Punkt, kein Arbeitspunkt.**
- **Regelbuch-Zeile — NACH dem Land und ERST wenn `git merge-base --is-ancestor 251adab main` JA
  sagt:** in `rulebook/lane-discipline.md:141` den §11.2l-Eintrag „OFFEN" ersetzen durch „REPARIERT
  in `251adab`: die Fixture haelt Empfaenger-B selbst laut, vom Signal-Anker bis hinter die
  Restart-Pruefungen. Ein Rot dort NACH `251adab` ist wieder ECHT. Merkposten zur Beweisordnung
  bleibt gueltig." — **`251adab`, nicht `ca81fbb`** (Vor-Rebase-Sha, in main nie existent). Dann
  `CLAUDE.md` rendern (`rulebook.ts:5`). Slot 12s §5 unten plant dieselbe Zeile mit `<sha>`.
- **KORREKTUR einer Fehlmeldung von mir (an den Controller Slot 16 gesandt, der ist weg):** ich
  hatte behauptet, die Regelbuch-Fragmente in `rulebook/*.md` seien GETRACKT und eine Lane koenne
  eine Regelbuch-Aenderung landen. **Falsch** — `rulebook/` ist gitignored (`.gitignore:43`, die
  Fragmente tragen dieselbe Deploy-Identitaet wie CLAUDE.md). Die alte Regel gilt unveraendert:
  Rulebook-Aenderungen aus einer Lane als TEXT melden, im Haupt-Checkout von Hand nachziehen.
- **Was daran trotzdem ein echter Befund war, und REPARIERT ist (maschinenlokal, kein Commit):**
  der Controller Slot 12 hat seine drei Nachzuege (§11.2m PARKED-Quartett, „Fuenfzehn", Helper-
  Roundtrip in der Suite-Offer-Zeile) **direkt in CLAUDE.md** geschrieben, nicht ins Fragment.
  Der Pin `CLAUDE.md is renderRulebook("main", rulebook/) byte for byte` war darum ROT (75 680 B
  gegen 75 135 B) — und jede NEUE Lane kopiert dieses CLAUDE.md und faellt am Gate. Ich habe die
  drei Edits in `rulebook/lane-discipline.md` uebertragen und CLAUDE.md gerendert
  (`rulebook.ts:5`); `bun e2e/pins.ts` → ALL PASS. **Der Handweg fuer JEDE Regelbuch-Aenderung im
  Haupt-Checkout: Fragment editieren → rendern → pins. Nie CLAUDE.md direkt.** Auch fuer die
  §11.2l-Zeile oben.
- **Security-Fund der Lane, verifiziert und ERLEDIGT:** `e2e/security.ts §1` war auf `97bf9a9` rot
  (`grep -c` = 0), seit `6c1e672` zu (`:123`). Erst geprueft, dann kein Alarm. **Ungeprueft
  weitergegeben:** die drei `e2e/programs.ts`-Rots — „adressiert, weil 6c1e672 die Datei
  angefasst hat" ist eine Inferenz der Lane, keine Messung.
- **HANDOFF.md ist EINE Datei fuer ALLE MAINs.** Meine Fassung `b186dfe` wurde von Slot 12
  (`8ee867b`, `13b2edf`) ueberschrieben; ich habe sie hier oben wieder eingesetzt und seine
  darunter WOERTLICH belassen. Wer als Controller nachfolgt, liest ab der Trennlinie.

## 7 Stand in einem Satz

Eine Lane in Flug (Slot 3, landbar, im ff-Rennen), Lane-Watch armed, kein Controller, F2/F4 pending,
eine Attention offen. Das Programm ist an einer Owner-Antwort UND einem fehlenden Controller, nicht an Arbeit.


---
---

<!-- Ab hier WOERTLICH der Handoff des 🎛 Fleet Controllers Slot 12 (13b2edf), von der Program-MAIN Slot 9 unveraendert belassen -->

# HANDOFF — 🎛 Fleet Controller (Slot 12, Fable): Lagebild, Deploy ff228e5, 6 Lanes in Flug (S2, GLM-Denkauftrag, 2 Manifeste, D2, E1), Slot 3 im Merge; 2026-09-04 08:02, ctx GEMESSEN 28,4 %

Zustand ableiten: `./state.sh`, `./register.sh`, Owner-Poll, Panes. Hier nur, was git nicht traegt.
Die elf Slot-Berichte + zwei Aggregate dieser Session liegen NUR im Scratchpad dieser Session
(`…/c48dbe49-…/scratchpad/reports/`) — die Essenz steht unten.

## 0a. NEU seit 07:36 — Owner-Richtung und was daraus in Flug ist (Watches sterben mit Slot 12 — NEU ARMEN)

**Owner-Richtung (woertlich sinngemaess, 07:5x):** Private-repo-j ist in aktueller Form misslungen; erst
Studio-als-Objekt (S2) und die Ansicht dafuer bauen, dann Private-repo-j und die Private-repo-y-iOS-App
richtig angehen. Alles hat „zu wenig Zusammenhang"; die ContextPacks muessen besser geroutet und in
die Arbeit eingebunden werden; die Studio-Workflows wirken noch nicht richtig, vermutlich wegen der
Packs und des Arbeits-Managements — Ansicht + darauf aufbauende Systeme sollen helfen. Parallel eine
GLM-Session, die denkt, wie Packs auf einem System mit Jobschichten aussehen sollten.

**Meine Einschaetzung, vom Owner mit „alles klar" angenommen:** kein Produkt-Repo hat ein
`.fleet/context-packs.json` (gemessen: Private-repo-j, private-repo-p keins; 5 Quittungen heute, alle
claude-fleet). Reihenfolge: S2 → Manifeste in den Produkt-Repos → Program-Ansicht → Architekturfrage
„waehlt das Studio die Packs (Stufe+Rolle) oder das Program?" (meine Empfehlung: Studio).

| Zeile | Slot | Harness | Auftrag | Watch |
|---|---|---|---|---|
| `0555828b` S2 Studio-als-Objekt | 2 | Opus/high | Brief liegt im text; studios=[] → Lane muss Fixture selbst anlegen | keiner (Deckel 5) — armen |
| `6fd9d46e` GLM-Denkauftrag Packs+Jobschichten | 4 | pi-zai glm-5.3 | Notiz `docs/ideen/2026-09-04-context-packs-jobschichten-glm.md`, committen | **pi-zai ist nicht automatable → KEIN lane-Watch moeglich, Pane lesen** |
| `d21121d1` Manifest Private-repo-j | 5 | Opus | docs-only in /Users/owner/private-repo-j | 20ef46eb (armed, stirbt) |
| `798a420d` Manifest private-repo-p | 7 | Opus | docs-only in /Users/owner/private-repo-p | a9d1f785 (armed, stirbt) |
| `74d90c5e` Program-Ansicht (Owner-Dossier-Route + Panel + 2 Checks) | — | queued | ERST dispatchen, wenn S2/E1/D2 gelandet sind (server.ts-Ueberlappung) | — |
| `4a29ffcd` D2 | 1 | Opus | laeuft | — |
| `bffe3de0` §11.2l | 3 | Opus | **Merge laeuft seit 07:42** (`/api/slots/3/merge` running:true); Lane hat auf 8ee867b rebased, Gate-Kette gruen; Report 7b1c0f9e | 7d6c6f31 merge→3 (stirbt; nach Terminalfakt feuert ein neuer Watch sofort) |
| `4b92b2f0` E1 | 11 | codex | Slot 8 landet (Watch a994affb) | — |

Land-Reihenfolge: Slot 3 (laeuft) → E1 (Slot 8) → Manifeste (fremde Repos, kein Fleet-Mutex) → D2 → S2 → dann `74d90c5e` dispatchen.
Nach Slot 3s Land: CLAUDE.md §11.2l → „REPARIERT in 251adab" (SHA nach Rebase; die Lane warnt: ca81fbb existiert nie auf main).
Gesehen und offen: `POST /api/self/watch {kind:merge}` auf Slot 3 feuerte um 07:42 SOFORT aus dem ALTEN ff-lost-Fakt (Event eeef0d72, `landed=NO`), obwohl d32b69d „reject spent" deployt ist — die Ablehnung greift offenbar nur ohne neueren Lauf; Notiz-Kandidat, nicht bewertet.

## 0. In Flug und wer landet (Stand 07:36, teils ueberholt durch 0a)

| Lane | Slot | Auftrag | Stand 07:36 | Landet |
|---|---|---|---|---|
| §11.2l-Fixture `bffe3de0` | 3 | e2e/watch.ts +21, docs +39; Zielcheck 5x rot vor / 1x gruen nach dem Fix (Trail) | Verify-Kette laeuft hinter dem Suite-Mutex; ahead 2, sauber; merge-tree gegen main 0 Konflikte | **Controller** (Watch `f7a2d74e` lane→3 armed). Danach CLAUDE.md §11.2l → REPARIERT in <sha> |
| E1 Audit-Sensoren `4b92b2f0` | 11 (codex sol) | 1 Commit 5545230, 7 Dateien | ff-lost 07:21 (main lief weiter), rebased, faehrt lokal e2e-postland-audit.sh | **Slot 8** (Watch a994affb armed). Als NAECHSTEN Land der Maschine fahren, sonst dritter ff-lost |
| D2 Lane-Cleanup `4a29ffcd` | 1 | Opus/high, Program 66499a03 | dispatcht 07:33 (Hand) | Controller; MAIN Slot 10 hat Watch-Pflicht |
| Audit-Watch `eaa36b7f` audit→ff228e5 | 12 | — | 3 Audits warten (d32b69d, 6c1e672, ff228e5), keiner laeuft, Ledger seit 04:58 leer | — |

## 1. Getan (07:2x–07:35)

- **Deploy `48f5e64f` ok:true, bootHead = main ff228e5** (14 Commits: B-06, B-07, D1, D1-Nachschnitt, S4, B1). Annahme-Tuer `/api/self/fleet-report/:id/accept` ist LIVE; Slot 10 hat Report 17854c56 angenommen (`disposition: accepted`) — **Erfolgssatz 7 von 66499a03 erstmals belegt.**
- Attention a446d18b (Slot 6, S4 landbereit) beantwortet: gelandet+deployt.
- Geschlossen (geerntet, nichts uncommittet): Slot 15 (Lagebild-sol, 13 h altes Lagebild), Slot 16 (alter Controller, hing an `GET /api/slots/2/merge` — Bug #1 unten), Slot 13 (studioObjekt; sein Ergebnis ist Zeile 0555828b pending/owner).
- **Slot 7 (Private-repo-j-MAIN) wurde 07:33:25 mit `slot_kill owner` beendet — NICHT von mir** (meine Kills 07:34:39; Dispatch hatte freie Slots). Attention 65aa1937 damit refused. Private-repo-j braucht eine FRISCHE MAIN — deckt sich mit 8b4772db Option 1a.

## 2. Programs (8 aktiv)

- 66499a03 Owner-Routing (Slot 10, 23,6 %): 7 Lands, D2 in Flug. Danach: 5c1f831f Program-scoped Dispatch (pending, OHNE programId → nur Owner kann starten; Owner-Akt: einem Program zuordnen).
- b2a14b54 Sanierung (Slot 8, 16 %): E1 in Flug, **B-09 `51f59f63` queued, startet nie (dispatch=false) → Hand-Dispatch codex/gpt-5.6-sol/high NACH E1-Land.** Advisory-Deckel 14/10 → 409.
- cd110019 Dual-Host (Slot 6, 22,8 %): Phase 1 komplett; Erfolgsmass nicht gebaut. Fehlt: R4-Zeile, daemon-update-Job (second-host-Daemon auf f62b1f5, 167 Commits alt), Phase-2-Topologie = Owner.
- b2aa5b45 Game-Maker v2 (Slot 9, 24,4 %): Schritte 1–4 auf main, Schritt 5 ohne Zeile; wartet seit 00:22 auf **Owner-Attention 8b4772db** (1a Private-repo-j frische MAIN / 2 nein). MAIN succeedet nicht, weil Attention mit Session stirbt (Bug #3).
- 2c073232 Private-repo-j: MAIN tot (s.o.), 2 tote pending-Zeilen 41d866a6, 2953b842 → schliessen.
- 07ee8a6d Private-repo-y: MAIN Slot 4 retirt ohne Nachfolge, Brief 9 ba896b1b queued verwaist → Owner: schliessen oder neue MAIN.
- f99e9354 Private-repo-o: verwaist (stale Bindung Slot 10), keine offene Zeile → complete setzen. 4785b33b Private-repo-z: proposed, 0 Tasks, 4 Tage → verwerfen.

## 3. Sanierung — Antwort auf „ist die Verbesserung eingebaut?"

JA. RESCOPE e670579 (Zielzahl ≤8000 aufgehoben, Slice 7a letzter Split, dann E1/E5) ist gelandet UND seit 07:29 komplett deployt (B-07 d32b69d war die letzte nicht-deployte Haelfte). server.ts 25 522 → 24 547, server/ 10 Module, Blatt-Invariante erfuellt (max types.ts 1640, kein Rueckimport). **Ein Doc-Nachzug fehlt:** der RESCOPE-Abschnitt behauptet „Gegenpruefungs-Doc nicht auffindbar" und „Stop-Regeln GLM i–iv nicht uebermittelt" — beides falsch: `docs/messungen/2026-09-03-gegenpruefung-sanierung-rescope.md` (98985c8, Ancestor von e670579) existiert, Stop-Regeln stehen dort Z.196–201. GLM-Ziel „Kern <~20k" ohne Zahl uebernommen.

## 4. Owner-Routing-Bugs, am Code verifiziert (Aggregator A; Schnittlinie nach 5)

1. `GET /api/slots/:id/merge` — Guard `!s.worktree` (server.ts:23223) VOR der Methodenweiche → nach erfolgreichem Land 400; ein Poll darauf feuert nie. **Toetete Slot 16.** Fix: GET vor den Guard.
2. `deliverMergeVerdict` (:16267, returnt bei !s.worktree) und `mintAuditEvents` (:5538, nur watches) erreichen keine Program-MAIN. Fix: Fallback-Empfaenger task.programId→program.main. Slot 10s Schnittvorschlag + Sonde stehen in seiner Pane 07:31.
3. `reconcileAttention` (:7351) refused „requester session ended" ohne Rebind — 6 Faelle heute (inkl. 65aa1937). Fix: an Program-Lineage koppeln. Achtung: e2e/attention.ts koennte das heutige Verhalten als SOLL pinnen.
4. `tickAuditPing` (:10124) waehlt die am laengsten stille Nicht-Lane ohne Repo-/Rechte-Filter; adjudicate ist owner-only (:22746) — 6 Fehlzustellungen (Private-repo-j-MAIN, Lagebild-sol). Fix: cwd-Repo-Match. Offenes Urteil liegt in `/Users/owner/private-repo-j-packs/audit-adjudikation-1788490729963.json` (verdict real, at 1788490729963).
5. ff-lost ohne Retry (:3778/:16669) — 2x heute. Fix: ein bounded Rebase+ff-Neuversuch in mergeJob (LAND_FF_LATCH existiert).
— darunter: Doppel-Adjudikationen by:"owner" hart (:14135, 23 Audits mit >1 Urteil; HANDOFF §2 von Slot 16 verbuchte 4 Ueberschreibungen als Erstjudikat) · ungebundene Nicht-Lane hat keinen Kanal (:21816) · kein Self-Withdraw fuer Attention · Advisory-Deckel altert nie · `closeProgramLineageForOccupant` (:1397) laesst status active.

## 5. Regelbuch-Nachzug (CLAUDE.md, Haupt-Checkout, Text aus Slot-2-Lane-Report)
- Flake-Familien „Vierzehn" → FUENFZEHN: PARKED-Quartett `e2e/repo-worker-audit.ts` §11.2m (OFFEN; slow=sleep 6 gegen 10-s-Floor, Floor ist UNTERGRENZE → beide Schnitte offen).
- Nach Slot 3s Land: §11.2l → REPARIERT in <sha>.
- Suite-Offer-Zeile kuerzen (GET /api/self/gate traegt helper{online}).
- Modellpolitik: ALLE MAINs (6, 8, 9, 10) laufen auf Opus statt Fable; Slot 9 model:null. Nachzug = Route + `/model` in der Pane, je Slot.
