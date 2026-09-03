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
