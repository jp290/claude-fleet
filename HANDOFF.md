# HANDOFF — 🎛 Fleet Controller (Slot 13, Fable): Manifeste + §11.2l gelandet, Owner will Merges aus dem Controller heraus, zwei Owner-Entscheide offen; 2026-09-04 08:5x, ctx GEMESSEN 22,3 % (vor dem Schreiben)

Zustand ableiten: `./state.sh`, `./register.sh`, Owner-Poll, Panes. Hier nur, was git nicht traegt.
Der Abschnitt darunter (Program-MAIN Game-Maker v2, Slot 9) ist FREMD und steht hier, weil
HANDOFF.md eine geteilte Datei ist — nicht als meiner lesen.

## 0-UPDATE 09:3x — beide Entscheide gefallen, Program „Fleet-Betrieb" gegruendet, E1 gelandet

- **Owner-Entscheide (09:1x):** Fleet-Betrieb JA (Program `f170dc46`, aktiv, Self-Land `guarded`,
  MAIN Opus 5 high in **Slot 3**, Gruendungsbrief = Program-Intent + Nachtrag per /send: Owner-Zeilen
  lassen sich NICHT nachtraeglich einem Program zuordnen, die MAIN mintet ihre Zeilen selbst; S2
  bleibt Owner-Zeile, die MAIN meldet „landbar" per Attention, der OWNER landet vom Board).
  Trockenzyklus ZURUECKGESTELLT, Slot 9 fokussiert Workflow, Studio zuerst (Attention `8b4772db`
  beantwortet). Modellpolitik NEU: MAINs Opus 5 (Slot 9+10 zurueckgedreht, Pane vom Owner, Datensatz
  von mir), nur der Controller Fable. „SOTA-Reasoning fuer den Controller und wirklich harte
  MAIN-Probleme reservieren."
- **Controller-Rolle ab jetzt (Owner-Wort):** Ueberblick, Owner-Nachrichten und Ideen auf Programs
  routen. KEINE Merges, keine Watches auf Lanes — die gehoeren den Program-MAINs. Offene Owner-Zeilen
  ohne Program (`74d90c5e`, `51f59f63` E5 gehoert Sanierung) an die passende MAIN geben und die
  Owner-Zeile schliessen, sobald die MAIN ihre Kopie gemintet hat.
- **E1 gelandet** `52673b6` (Slot 8 Self-Land, verify gruen, 7 Dateien). **Deploy ausgeloest**
  `POST /api/deploy` id `afb0b7c0` auf 52673b6 — Verdikt bei `GET /api/deploys` PRUEFEN (ok:null =
  nicht feststellbar). Sanierung: bleibt E5/B-09 + E6 Abschlussmessung (Slot 8).
- **Sechs ff-lost an E1 heute, vier davon durch Handoff-Direkt-Commits (Slot 9 2x, ich 1x, plus
  13b2edf).** Regel fuer JEDE Session bis zur Reparatur: vor einem Direkt-Commit auf main
  `GET /api/slots/:id/merge` der laufenden Lanes pruefen; laeuft ein Land, warten. Strukturfix
  (Handoff je Program unter docs/handoffs/, Succeed-Route anpassen) steht als openQuestion im
  Program Fleet-Betrieb — hoechste Prioritaet nach den zwei Merge-Fixes.
- **Was wir uebersehen (dem Owner genannt):** (1) geteilte HANDOFF.md, s.o.; (2) der Suite-Mutex
  taktet die Maschine — Post-Land-Audit auf das Helfer-Geraet verlagern ist der groesste
  Durchsatz-Hebel; (3) Studio ohne Ansicht und Pack-Routung — S2, Program-Ansicht, GLM-Notiz
  (Slot 4) sind die Basis, dann „waehlt Studio oder Program die Packs?"; (4) Program-scoped Dispatch
  nach der Sanierung einschalten.
- **Maschine knapp am Speicher** (13 claude-Sessions + Suiten; Hintergrund-Watcher wurden vom
  System gekillt) — Server-Watches statt Prozess-Watcher nehmen.

## 0. Zwei Owner-Entscheide, die JETZT offen sind (Owner-Worte 08:3x–08:4x, sinngemaess)

1. **„Merge-Benachrichtigungen aus dem Controller auslagern"** — Owner-Vorschlag: Steward-Session
   auf Opus 5, ggf. „ein Steward je 4–5 Slots", der Controller nur noch Ueberblick + Routing der
   Owner-Nachrichten; „am Ende soll das projektintern oder zwischen MAIN & Lane passieren".
   **Meine Antwort (Code gelesen):** NICHT der Steward — sein Token erreicht sieben Routen
   (`/api/steward/{autos,digest,journal,send,sessions,tasks,token}`), keine Merge-/Land-Route,
   `docs/steward.md` §„What it is NOT" = not a gate. Die Rolle existiert schon: **Program-MAIN mit
   Self-Land-Promotion** (`PromotionPolicy.selfLand`, Land ueber `POST /api/self/tasks/:id/land`;
   Slot 8 landet E1 so). Vorschlag an den Owner: Program „Fleet-Betrieb" mit Opus-5-MAIN (high) +
   Self-Land gruenden, das alle heimatlosen Fleet-Zeilen nimmt (S2 `0555828b`, Program-Ansicht
   `74d90c5e`, die Routing-Bugs aus §4 des Slot-12-Handoffs); Modellpolitik dann: MAINs Opus 5, nur
   Controller Fable (Slot 9+10 habe ich um 08:1x nach der ALTEN Regel auf Fable gestellt — Route +
   Pane; zurueckdrehen, wenn der Owner ja sagt). Zwei kleine Lanes fuer die Ursachen der Last:
   Merge-Verdikt an die MAIN statt an die Lane-Pane (`deliverMergeVerdict`; die Lane faehrt sonst
   nach jedem ff-lost ihre Kette neu — Slot 3 tat das dreimal, je ~10 min Mutex) und ein bounded
   Rebase+ff-Neuversuch in `mergeJob` (ff-lost heute 4x an bffe3de0). **Antwort steht aus.**
2. **Attention `8b4772db1d9dcf39d833383f` (kind decision, Slot 9, Game-Maker v2 Schritt 5):**
   (1) Trockenzyklus auf pausierter Private-repo-j mit FRISCHER MAIN (a, Vergleichszahl 528k) oder
   Canary (b)? (2) Muss `5c1f831f` Program-scoped Dispatch vorher landen? Empfehlung aller
   Beteiligten inkl. mir: **a, nein.** Dem Owner so vorgelegt, Antwort steht aus.

## 1. Getan (08:0x–08:5x)

- Manifeste gelandet, beide Verify gruen mit dem Repo-eigenen Kommando: private-repo-p `a454dc2`
  (6 Packs), Private-repo-j `0e30a45` (5 Packs). Beide validieren gegen `context-pack-validator.ts`
  ohne Fehler (nur `CAPABILITY_AVAILABILITY_UNKNOWN`, weil ohne Harness-Snapshot geprueft;
  Skript: Scratchpad `validate-manifest.ts`). Reports der Lanes: Scratchpad `reports/`.
- §11.2l gelandet: `7d089c1` + `4ff94e3` (Slot 3, bffe3de0 done). Sechs Anlaeufe: 3x ff-lost
  (main bewegte sich durch Handoff-Direkt-Commits 13b2edf, 5edc4f5), 1x §11.2i (Phase-3-Server
  ohne server.log), 2x „session actively working" (Lane fuhr Kette neu). Kein Deploy noetig.
- Regelbuch: §11.2l → REPARIERT in `7d089c1`; Flake-Familien vierzehn → fuenfzehn (§11.2m
  PARKED-Quartett); Suite-Offer-Zeile nennt `helper` an `GET /api/self/gate`; Loader-Fragment sagt
  jetzt, dass CLAUDE.md GENERIERT ist.
- Modellpolitik-Nachzug: Slot 9 + 10 auf Fable (Route `POST /api/slots/:id/model` + `/model` in
  der Pane, Dialog per Enter bestaetigt, Footer „Fable 5.1"). Slot 8 NICHT (wartete auf Watch),
  Slot 6 NICHT (Composer belegt, fremde Pane). Siehe §0.1 — evtl. alles zurueckdrehen.
- Mein Slot heisst jetzt „🎛 Fleet Controller" (`POST /api/slots/13/rename`); Slot 9 hatte „KEIN
  Controller" in seinen Handoff geschrieben, weil der Slot unbeschriftet war.

## 2. Bezahlte Lehre dieser Session

**CLAUDE.md ist aus `rulebook/*.md` GERENDERT** (Rezept im Kopf von `rulebook.ts`); ein
Hand-Edit faellt den byte-genauen Pin `e2e/pins.ts` §6b = Stufe 1 JEDES Land-Gates. Meine drei
Edits um 08:04 liessen ~20 min lang jeden Land der Maschine an Stufe 1 sterben; `rulebookDrifted`
sah es nicht. Jemand zog die Edits um 08:23 ins Fragment (nicht ich). Memory geschrieben
(`feedback-claude-md-is-rendered-from-rulebook`). Regelbuch-Nachzug heisst: Fragment → Render →
`bun e2e/pins.ts`.

## 3. In Flug und wer landet

| Zeile | Slot | Stand | Landet |
|---|---|---|---|
| `4b92b2f0` E1 | 11 (codex) | Kette gruen, idle, „nicht gelandet" | **Slot 8** (Self-Land, Watch 2035a34b) |
| `4a29ffcd` D2 | 1 | 4393fbe, wartet auf Mutex fuer Schritte 5–7 + Isolated | Controller (Program 66499a03 = Slot 10 hat Watch-Pflicht) |
| `0555828b` S2 | 2 | 0957488 (4 Dateien, +315), wartet auf Gate-Kette + Isolated (Helfer „second-host") | Controller — oder das neue Program |
| `6fd9d46e` GLM-Denkauftrag | 4 | pi-zai, schreibt Notiz `docs/ideen/2026-09-04-context-packs-jobschichten-glm.md` | kein Watch moeglich (nicht automatable) — Pane lesen |
| `74d90c5e` Program-Ansicht | — | queued | ERST nach S2/E1/D2 (server.ts-Ueberlappung) |

Land-Reihenfolge: E1 (Slot 8) → D2 → S2 → dann `74d90c5e`. Watches sterben mit diesem Slot: neu
armen (lane 1, 2; `{kind:merge}` nach jedem eigenen Merge-POST; Deckel 5, `GET /api/self` zeigt
die Liste). Merge-Watch feuert beim Armen SOFORT aus einem alten Terminalfakt, wenn kein neuer
Lauf laeuft — erst POST merge, 2 s warten, dann armen.

## 4. Sanierung, Restdauer (dem Owner 08:2x genannt)

E1 (landet), E5/B-09 `51f59f63` (queued, eine Lane ~2 h + Land), E6 Abschlussmessung (docs, ~1 h):
~4–5 h, Annahme kein weiterer ff-lost und ein Land je 45–60 min Mutex.

## 5. Notiz-Kandidaten (nicht gemintet)

- `GET /api/slots/:id/merge` nach Land → `not a fleet-created worktree lane` (§4.1 des
  Slot-12-Handoffs): ein Hintergrund-Watcher auf `running:false` endet nie. Selbst bezahlt.
- Merge-Watch-Fehlzustellung: `{kind:merge}` nach einem NEUEN Merge-POST fired trotzdem aus dem
  ALTEN Fakt, wenn der POST noch nicht `running:true` persistiert hat (2x gesehen).
- §11.2i-Sichtung 08:30 an bffe3de0 (Phase 3, keine server.log).

---
---

<!-- Ab hier die Program-MAIN Game-Maker v2 (Slot 9). Der Controller-Handoff Slot 13 steht oben, woertlich und unveraendert. -->

# HANDOFF — Program-MAIN Game-Maker-Workflow v2 (`b2aa5b453d0f2bf9ddce8232`, Slot 9): Schritte 3–4 UND bffe3de0 gelandet, KEIN Controller mehr; 2026-09-04 (08:xx), ctx GEMESSEN 32,3 %

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

- **`bffe3de0` (§11.2l-Reparatur) IST GELANDET — von mir, ueber die Tuer, die die Projektion nannte**
  (`POST /api/self/tasks/bffe3de0/land`, `selfLand: green-only`). main = `4ff94e3` (Doc) auf **`7d089c1`**
  (Fixture, `e2e/watch.ts` +21). Land-Note: verify.ok true, volle 7-Stufen-Kette, **1194 s, davon 1090 s
  Warten auf den Suite-Mutex** — das ist B-17 (`1f1e12a`) als Zahl. Vorher drei Fehlversuche, KEINER am
  Baum: zweimal ff-Rennen (main zog waehrend der Gate weiter, einmal durch MEINEN Handoff-Commit), einmal
  `./e2e-claude-gate.sh` Phase 3 (server did not come up, keine server.log) = §11.2i, „nie gemessen".
  Same-Tree-Rerun der Lane danach gruen. Audit-Watch `db446c7b` auf `4ff94e3` armed.
- **Regelbuch-Zeile §11.2l: NICHT von mir, aber von mir VERIFIZIERT.** Als ich sie nach dem Land
  eintragen wollte, stand sie schon in `rulebook/lane-discipline.md:141` — REPARIERT in `7d089c1`, mit
  einer Trail-Zaehlung („5x rot vor / 1x gruen nach") und dem `git log --grep`-Wiederfinde-Hinweis, beides
  nicht mein Text; mein Anker „OFFEN" fand darum nichts mehr. Wer es war, weiss ich nicht (kein Controller
  sichtbar). Geprueft: die SHA ist die richtige (`git log main --grep 'busy-receiver fixture'` = 7d089c1,
  is-ancestor JA), Render + `bun e2e/pins.ts` = ALL PASS. **Merkposten:** die SHA war ueber die Rebases
  VIERMAL gewandert (ca81fbb → 251adab → ffeda2a → 7d089c1); nimm sie nie aus einem Lane-Report.
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
## 9 Owner-Antwort auf die Attention (2026-09-04 09:1x, ueber Controller Slot 13) — WORTLAUT-FOLGEN

**Die Attention `8b4772db` ist BEANTWORTET.** Beide Fragen, und die erste anders als beide
Empfehlungen:

1. **Trockenzyklus ZURUECKGESTELLT — weder Private-repo-j noch Canary, jetzt nicht.** „Er ist gerade
   nicht wichtig." Fokus: der Workflow selbst (Schritte 3/4 zu Ende, Doku), und **davor** muss das
   Studio richtig aufgesetzt sein (S2 „Studio-als-Objekt" landet, dann Program-Ansicht).
   **Schritt 5 erst nach ausdruecklicher Owner-Freigabe.** Nicht von selbst anfangen, auch nicht,
   wenn die Maschine frei aussieht.
2. **Program-scoped Dispatch (`5c1f831f`) muss NICHT vorher landen.** Die Zeile bleibt liegen.
3. **Keine Direkt-Commits auf main, solange ein fremdes Land laeuft** (Controller Slot 13,
   konkret: bis E1 `4b92b2f0` auf main ist — mein `c79eeb9` und sein `402e962` haben E1 je einen
   ff-lost gekostet, den sechsten). Handoff-Text bis dahin LOKAL halten.

### Was das fuer die Erfolgskriterien heisst — ehrlich, nicht beschoenigt

- **(1) und (2) sind ERFUELLT** (§2 oben, gegen die Abschnitte geprueft).
- **(3) bleibt zur HAELFTE offen und ist es jetzt AUF OWNER-BESCHLUSS**, nicht aus Mangel: die
  Vorhersage steht (142 250 / Widerlegungsgrenze 250 000), die Nachmessung ist zurueckgestellt.
- **(4) ist zur Haelfte erfuellt — und seine ctx-Klausel ist von MIR GERISSEN.** „Program-MAIN-ctx
  dieses Programs bei Abschluss ≤ 25 %, gemessen": ich stand bei **32,3 %** (323k), als die Antwort
  kam. Das ist kein Formfehler, das ist ein Messwert, und er gehoert in die Evidenz des Workflows,
  den dieses Program gebaut hat.

### Der Messwert, den dieses Program an sich selbst erzeugt hat (fuer die Doku)

Ich habe die Disziplin gefahren, die `workflow-v2.md` vorschreibt: **kein Artefakt vollstaendig
gelesen, kein Bild geoeffnet, keine Pane gepollt** — nur Reports, Land-Notes, Projektion und
gezielte `grep`/`sed`-Proben. Trotzdem 323k. Die Aufschluesselung, soweit ich sie benennen kann:

- **Nicht** die Orchestrierung der fuenf Lanes. Die war billig und lief nach Plan.
- **Sondern** die Fleet-Betriebskosten daneben: drei Flake-Forensiken mit Trail-Joins, vier
  Land-Versuche fuer EINE Zeile (zwei ff-Rennen, ein §11.2i-Rot, ein Erfolg), zwei
  Controller-Nachfolgen mit verlorener Adresse, ein roter Regelbuch-Pin durch fremde Handedits,
  drei HANDOFF.md-Neufassungen nach Fremdueberschreibung.
- **Die Lehre fuer `workflow-v2.md` §6:** die Vorhersage von 142 250 bucht die ARBEIT einer MAIN.
  Sie bucht NICHT den Betrieb einer Flotte, in der Lands im Rennen verlorengehen, Controller
  wechseln und ein geteiltes HANDOFF.md ueberschrieben wird. Genau das war der Streitpunkt A7:
  A gewann, weil B die Betriebskosten mit null buchte — **und meine 323k zeigen, dass auch A eine
  Kostenklasse fehlt.** Das ist kein Widerspruch zur Adjudikation, sondern ihre Fortsetzung mit
  einem Datenpunkt, den es beim Entwerfen noch nicht gab.
- **Ehrliche Grenze dieses Datenpunkts:** ich bin die MAIN eines META-Programs (Workflow entwerfen),
  nicht die eines Game-Maker-Programs. Der Wert widerlegt die Vorhersage NICHT — er zeigt, welche
  Kostenklasse der Trockenzyklus mitmessen muss, wenn er kommt.

### Reihenfolge fuer die Nachfolgerin

1. Warten, bis E1 `4b92b2f0` auf main ist (Hintergrund-Watcher, oder `./register.sh`), DANN diesen
   Abschnitt committen. Vorher nichts auf main.
2. Nichts an Schritt 5 anfangen. Er ist zurueckgestellt, nicht faellig.
3. Was der Owner als naechstes will, liegt NICHT in diesem Program: S2 Studio-als-Objekt, dann
   Program-Ansicht. Dieses Program ist bis auf Schritt 5 und die Abschlussnotiz fertig.

### Eine offene Kleinigkeit, die ich bewusst NICHT selbst erledigt habe

**`b55477fb` (auftrag, pending) ist ein ~90-%-Duplikat von E1 `4b92b2f0` und gehoert archiviert.**
Ich habe sie gefilet, bevor ich die offenen Zeilen gegen `./register.sh` geprueft hatte — der
Fehler ist meiner. Ersatz liegt als `001d4cc3` (notiz) und nennt die Ersetzung ausdruecklich.

**Warum sie trotzdem noch dasteht:** die Tuer ist `POST /api/tasks/b55477fb/archive`
(`server.ts`, `taskAct[2] === "archive"`; reversibel ueber `/unarchive` → `pending`) und
**owner-token-gated**. Es gibt fuer eine Program-MAIN keine Self-Tuer zum Archivieren — die
Partition ist: eine MAIN FILED und RELEASED, der Owner kuratiert die Queue. Ich habe in dieser
Session zweimal abgelehnt, das Owner-Token aus `fleet.json` fuer eine fehlende Self-Tuer zu nehmen
(pi-zai-Dispatch, `POST /send` an die eigene Lane). Es jetzt fuer meine EIGENE Bequemlichkeit zu
nehmen, waere dieselbe Regel selektiv angewandt — darum nicht.

**Es brennt nichts, und das ist gemessen, nicht gehofft:** die Zeile ist `pending` und nie
released; `tickDispatch` waehlt woertlich `status === "queued"`, eine pending auftrag-Zeile kann
strukturell nicht starten. Das Risiko ist ein LESEFEHLER im Register, kein Betriebsrisiko.

**Ein Aufruf raeumt es:** `POST /api/tasks/b55477fb/archive` mit Owner-Token. Owner oder Controller,
nicht ich.

### Eine Korrektur an meiner eigenen Diagnose (nach dem E1-Land)

Ich hatte dem Controller geschrieben, E1s `signal:null` sei „un-getickte idleMs, kein Baumproblem",
und seine gleichlautende Deutung bestaetigt. **Beide falsch.** Die Lane hielt ein
HINTERGRUND-TERMINAL offen: ihr eigenes `./e2e-postland-audit.sh` wartete **1697 s** auf
`/tmp/fleet-e2e.lock` und hatte NIE angefangen. Sichtbar wurde es erst, als der Controller die PANE
las statt die API zu befragen; nach dem Abbruch (exit 130, nichts veraendert) war die Lane sofort
done-looking.

**Die Lehre, teurer als der Fehler:** `GET /api/self/program-execution` sagt, WO eine Zeile steht —
nicht, WORAUF ihre Lane wartet. Ein `signal:null` ist eine Abwesenheit, und eine Abwesenheit
erklaert sich nie aus der API, die sie meldet. Das Regelbuch sagt es bereits („immer die Pane lesen
UND `ahead`/`dirty` pruefen, nie den Slot-Zustand allein") — ich habe es auf einer FREMDEN Lane
nicht angewandt, weil sie nicht meine war.

**B-17 mit Preisschild, als Kette:** optionale Vorschau haelt den Suite-Mutex → der PFLICHTIGE
Harness einer Lane verhungert → die Lane wird nie idle → `done-looking` faellt → Land unmoeglich →
main ueber DREI Programme eingefroren. E1 brauchte fuenf Anlaeufe (zwei am ff-Rennen gestorben, Kette
jedes Mal gruen), mein `bffe3de0` vier. Dieselbe Wurzel, zweimal bezahlt.

### Diese Datei ist EINE Datei fuer ALLE MAINs — dritte Kollision an einem Tag

`HANDOFF.md` wurde heute dreimal unter mir ueberschrieben (Slot 12 zweimal, Slot 13 einmal), und
mein eigener Wiederaufbau hat beim letzten Mal Duplikate erzeugt, weil ich die Struktur ANNAHM
statt sie zu messen (`grep -n '^# HANDOFF'` haette es in einer Zeile gezeigt). **Regel fuer die
Nachfolgerin: vor jedem Schreiben an dieser Datei `grep -n '^# HANDOFF' HANDOFF.md` — dann weisst
du, wieviele Fassungen drinstehen und wo deine anfaengt.** Diese Fassung traegt genau zwei:
Controller Slot 13 oben (woertlich), meine darunter. Die Slot-12-Fassung habe ich entfernt; sie ist
ueberholt und steht vollstaendig in der git-Historie.
