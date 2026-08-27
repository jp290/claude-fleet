---
frage: Was steht zwischen dem rohen Ziel (eine Idee einmal, Studio-Main autonom bis reviewable Build) und dem heutigen Code?
urteil: Die Schleife bis lane finished ist fast geschlossen, aber ihr Ende ist doppelt ein Owner-Klick (Merge-Start und Confirm); land und budget sind maschinell noch nicht existent, alles andere sind Grade
bereich: [autoritaet, studio]
belege: [server.ts#mergeJob, server.ts#boundProgramForMain, server.ts#createTaskForMain, server.ts#releaseTaskForMain, 105c234]
nicht-gemessen: Ob Session-Heals sessionId-Divergenz praktisch erzeugen; ob die Spiel-Repos eigene Ledger führen; main-direct-Preflights nur als Routenköpfe gelesen; die drei Queue-Zeilen nicht auf Umsetzbarkeit geprüft
stand: 2026-08-23
---

# Red-Team 1/3 — GLM: Was steht zwischen dem rohen Ziel und dem heutigen Code?

2026-08-23, Red-Team-Lane (GLM-5.3), Baum `105c234` (Anker-Baum war `557bf3a`; alle zitierten
Zeilen auf dem aktuellen Baum nachverifiziert). Read-only-Angriff auf das ROHE Ziel:

> "owner gives one well-described game/app idea once; Studio MAIN autonomously drives every
> reversible step through a playable/reviewable build."

plus Owner-Korrektur (review-ready autonomy): MAIN besitzt den gesamten reversiblen Programm-Loop
bis reviewable build — Zerlegung, Filing/Release, Modell-/Harness-Routing, Retries/Replacement,
Konfliktlösung mit frischem Reverify/Critic, rote Checks, Unknown-Klassifizierung, Zwischen-Entscheidungen,
In-Envelope-Scope-Tradeoffs, **Land**, lokale Preview-Builds, Screenshots/Playtests, reversible
Dev-Deploys. Stop nur für: finale Produkt-/Geschmacks-Promotion, Intent-Wechsel, irreversible/
öffentliche Effekte, neue Credentials, Budget-Bruch, echt ungelöste Widersprüche.

## Verifikationsrahmel

- **VERIFIZIERT** = am Code/Live-Prozess dieser Maschine gelesen. **GESCHLOSSEN** = aus
  verifizierten Stuecken gefolgert, nicht selbst gemessen. **UNGEPRUEFT** = nicht gelesen.
- Live-Prozess verifiziert (ps, PID 669, watchdog-tmux): `FLEET_HARNESS_AUTOMATION=1`,
  globales `FLEET_VERIFY_CMD` mit erster Zeile `[ -f fleet-e2e.ts ] || { …; exit 42; }`,
  `FLEET_VERIFY_TIMEOUT_MS=300000`, `FLEET_VERIFY_WAIT_MS=900000`, `FLEET_CLEAN_REVIEW=off`,
  `FLEET_ANALYSIS_MS=0`, `FLEET_DISPATCH_MAX_LANES=2`, `FLEET_DISPATCH_REPO=/Users/owner/claude-fleet`.
  Wichtig: diese Werte stehen NICHT in `.env` — sie leben in der Watchdog-Startzeile. Wer nur
  `.env` liest, liest die Haelfte der Wahrheit.
- Anker bestätigt/verschoben: `mergeJob` def server.ts:12738 · Dreiwert-Stelle server.ts:12996 ·
  `VERIFY_SKIP_EXIT` server.ts:10049 · einzige `mergeJob(`-Aufrufstelle server.ts:18866 ·
  Merge-Route server.ts:18570 · `boundProgramForMain` server.ts:6070 · `releaseTaskForMain`
  server.ts:6099 · `createTaskForMain` server.ts:6199 · Deckel server.ts:2665/2677 ·
  `interface Program` server.ts:2131 (kein Policy-Feld — bestätigt) · `taskSpawnOf`
  server.ts:6660 (Anker 7462 war die Tick-Nutzung; Tick nutzt sie bei 7558/7638 — bestätigt).

---

## 1. FEHLENDE MECHANISMEN — ohne dieses Teil bricht die Schleife

**Rangfolge; Schnitt nach Befund 5. Befunde darunter sind unbepreiste Beobachtungen.**

**1.1 — MAIN hat keine Land-Tuer. Der Loop endet immer im Owner-Klick.** VERIFIZIERT.
Die EINZIGE `mergeJob(`-Aufrufstelle ist server.ts:18866, erreichbar nur über
`POST /api/slots/:id/merge` (server.ts:18570). Alles unter `/api/slots/…` steht hinter dem
Owner-Token-Gate (server.ts:17818: `tokenGate` — bestätigt gelesen). Das Self-Route-Inventar
(`rg '/api/self/'`) enthält KEINE Merge-/Land-Route. Der Auto-Land innerhalb von `mergeJob`
(clean + grün + ggf. Clean-Review-ok → `advanceIntegration`, server.ts:13063) ist unattended —
aber das *Starten* des Jobs ist ein Owner-Akt. Eine Studio-MAIN kann also jeden reversiblen
Schritt bis zur fertigen, verifizierten Lane treiben und muss dann nonetheless den Owner fuer den
⏫-Klick holen. **Kosten:** Ohne diese Tuer ist "MAIN owns … land" aus der Korrektur reine Prosa;
jede Studio-Iteration haengt an Owner-Verfuegbarkeit, und das Einmal-Ziel ("one idea once")
entwertet sich zur Request-Schleife. ACP-29/STUDIO-00 setzen genau hier an, aber keine der
Queue-Zeilen ist gebaut (alle `pending`, fleet.json verifiziert).

**1.2 — Es gibt kein Policy-/Envelope-Objekt, an das die Korrektur andocken koennte.** VERIFIZIERT.
`interface Program` (server.ts:2131–2148) hat: title, intent, successCriterion, nonGoals,
decisions, evidence, openQuestions, status, Zeitstempel, proposedBy, main. KEIN Feld fuer
Land-Policy, Budget-, Credential-Grenzen, Review-Readiness-Stufen. `validateProgramContent`
(server.ts:2151ff) laesst unbekannte Schluessel gar nicht erst rein. SYSTEM.md beschreibt die
`PromotionPolicy` ausdruecklich als Zielbild ("behauptet nicht, dass jede Kante bereits
implementiert ist"). **Kosten:** Jede MAIN-Tuer, die die Korrektur fordert (Land, Deploy,
Budget-Bruch-Erkennung), muesste heute ihre Autoritaet aus dem Nichts ableiten — der einzige
verfuegbare Beweggrund ist "der Owner hat es mal in einen Task-Text geschrieben", und das ist
kein maschinenlesbarer Vertrag. ACP-29 (`80abd6d1`) ist der genau dafuer angelegte Builder-Act —
pending.

**1.3 — Kein Budget-/Spend-Deckel irgendeiner Form.** VERIFIZIERT als Absenz (Begrenzung s.u.).
`rg -n 'budget|spend'` liefert nur Prosa-Kommentare und Scroll-/Fenster-Budgets; es gibt keinen
Spend-Ledger, kein Cap, kein Measure-and-Stop. Zugleich akzeptiert `createTaskForMain`
(server.ts:6224–6229) das Spawn-Tripel (harness/model/effort), validiert NUR gegen den Adapter,
und live sind `claude` (immer, server.ts:5043), `pi`, `pi-ox`, `codex` automatable
(server.ts:477/598/737/1072; `FLEET_HARNESS_AUTOMATION=1` live). **Kosten:** Die Korrektur
grenzt MAIN-Autonomie durch "external budget/credential limits" ein — ohne Deckel ist das
Routing-Recht ein unbeschranktes Spend-Recht auf bezahlte Harnesses, und der erste Budget-Bruch
wird erst im Nachhinein (Owner-Rechnung) sichtbar, nie durch die Maschine. Absenz-Begrenzung:
GESCHLOSSEN, dass es auch keinen indirekten Deckel gibt (z. B. ueber Autos/Lane-Zahlen); die
Deckel, die existieren, zaehlen Zeilen und Lanes (2665/2677, DISPATCH_MAX_LANES*), niemals Geld.

**1.4 — Kein Sensor fuer "playable" und kein Artefakt fuer "reviewable".** VERIFIZIERT.
`rg -ni 'preview|screenshot|playtest'` in server.ts: Treffer nur fuer Modellnamen
(x-preview-f-free), Risk-Preview-Panels und die `drops/`-Upload-Route. Kein Playwright/Puppeteer
irgendwo (auch nicht in studio-kit). Der einzige Game-Gate (private-repo-h, `.env:14`) baut nach
`$gate_tmp/dist` und loescht es mit dem Trap — das Gate misst Buildbarkeit und vernichtet das
Artefakt. Die Messung `docs/messungen/2026-08-20-gamestudio-readiness.md` steht dazu: 0/8
Groessen mit vollstaendigem Sensor. **Kosten:** "Reviewable build" ist heute eine Behauptung im
Attention-Text, kein Faktenobjekt; der Owner muss zum Pruefen selbst bauen. Siehe Teil 4 fuer die
Mindestanforderung.

**1.5 — MAIN kann laufende Worker nicht steuern: kein Nudge, kein Kill, kein Replace, kein Drop.**
VERIFIZIERT am Routen-Inventar: `/api/self/nudge` ist Supervisor→MAIN (server.ts:17314-Kontext);
es gibt keine Self-Route, die eine laufende fremde Lane beeinflusst, und keine Drop-/Edit-Route
fuer eigene pending Zeilen (`/api/self/tasks` POST = nur anlegen, `/api/self/tasks/:id/release`
= nur freigeben). Einziger Retrial-Pfad: `detachSlotTasks` setzt abgebrochene Zeilen zurueck auf
`pending` (server.ts:4798–4806) — dieselbe Row, dieselbe persistierte Spawn-Wahl, wieder
freigeben. **Kosten:** "retries/replacement" aus der Korrektur ist als Mechanismus nur
"Wiederholung des Identischen" vorhanden; Replacement (anderes Modell nach Flake) erzwingt neue
Zeilen und fuehrt direkt in die Zombie-Falle aus 5.2.

**Schnitt.** Die fuenf obigen brechen die Schleife. Darunter (unbepreiste Beobachtung):
Fresh-Agent-Review existiert embryonal (`runCleanReview`, server.ts:12650, einzige Nutzung 13043
im clean-Pfad; kann nur downgraden) und ist live AUS (`FLEET_CLEAN_REVIEW=off`); MAIN-Clarifications
sind lane-only (server.ts:17395) — fuer das Ziel aber sekundaer, weil MAIN laut Korrektur
Unknowns selbst klaert und der Owner-Kanal (attention) existiert.

## 2. AUTORITAETSLECKS — wo die MAIN mehr koennte als das Ziel ihr gibt

**Schnitt nach 3. Ich habe gezielt nach Cross-Repo-, Token-, Tick- und Adapter-Lecks gesucht;
die vier genannten sind die, die hauen.**

**2.1 — Unattended bezahlte Dispatches ohne Envelope-Pruefung (Duplikat von 1.3 als Leak
gelesen).** VERIFIZIERT. Kette: MAIN filed Row mit `spawn:{harness:"claude",model:X}` →
set-time-Validierung nur gegen Adapter (server.ts:6224ff) → Release-Tuer prueft nur
`harnessAutomatableFor` (server.ts:6145) → Tick reicht die Wahl durch (`taskSpawnOf`,
server.ts:6660/7558/7638) → unbeaufsichtigte Lane auf bezahltem Provider. Nichts in dieser
Kette kennt ein Budget. Das Ziel gibt MAIN Routing "after … external budget/credential limits" —
der Code gibt das Routing ohne die Limits. **Kosten:** Ein kompromittierter oder driftender
MAIN-Prompt erzeugt autonome Ausgaben; der Schaden ist durch keinen Deckel begrenzt, und weil
kein Spend-Ledger existiert, ist er auch nicht nachtraglich attribuierbar.

**2.2 — Bindung ueberlebt Session-Identitaets-Drift (sessionIdMatch report-only).** VERIFIZIERT.
`boundProgramForMain` (server.ts:6070–6081) bindet ueber `slot + openedAt`; `sessionIdMatch:
"divergent"` wird an jeder Tuer bewusst BERICHET, nie gegated (server.ts:6164, ACP-13-Doktrin).
Ein geheilter/respawnter Pane mit NEUER sessionId (gleiches Slot-Occupant-Tripel) erbt die
gesamte MAIN-Autoritaet aller aktiven Programme dieses Slots, ohne dass der Owner je neu gebunden
hat. **Kosten:** Der Owner glaubt, MAIN X zu haben; faktisch entscheidet ein beliebiges
Gespraech, das zufaellig im Pane weiterlaeuft. Die ACP-13-Doktrin ist ein bewusster Trade
(Succession soll nicht blockieren), aber zusammen mit 2.1 ist das die Stelle, an der Autoritaet
ohne Protokoll uebergeht. GESCHLOSSEN (nicht live gemessen): ob Session-Heals in der Praxis
sessionId-Divergenz bei gleichem openedAt erzeugen — die Stelle `s.sessionId` wird bei Heal neu
gesetzt; ob das vorkommt, ist eine Messfrage, keine Codefrage.

**2.3 — Der Tick als verlängerter Arm: MAIN-Releases laufen ohne Owner-Beteiligung ab.**
VERIFIZIERT. `releaseTaskForMain` tut nur `pending → queued` (server.ts:6099ff); ab da dispatcht
der 8s-Tick (server.ts:7498) unattended, mit `FLEET_HARNESS_AUTOMATION=1` und live 2 Lanes/Repo.
Das ist von ACP-16 so entworfen ("widens WHO may release") — aber im Zielkontext heisst es: die
EINZIGE massebeschleunigte, unbeaufsichtigte Maschine, die MAIN heute anwerfen kann, schreibt in
Repos hinein. Cross-Repo ist dicht (Release vergleicht `t.repo ?? DISPATCH_REPO` mit eigenem
Checkout, server.ts:6140–6151; Filing leitet repo ab, 6231–6237) — das habe ich explizit
nachgeprueft und KEINEN Cross-Repo-Griff gefunden. **Kosten:** Kein Leak ueber Grenzen, wohl aber
Grad-Deckelung: kombiniert mit der fehlenden Tuer in 1.1 gilt asymmetrisch "MAIN kann unattended
schreiben (Lanes), aber nicht unattended landen" — die Umkehrung der Risikofuellung, die man fuer
ein Studio eigentlich will.

**2.4 — Owner- Latitude bei confirm-land ohne Re-Verify ist ererbt, nicht MAIN-Tuer — aber der
Preis faellt auf die Evidenzkette.** VERIFIZIERT: confirm-land laeuft ohne erneuten Verify und
traegt nur `reviewed.verify` (+Stale-Flag) als Provenienz mit (gelesen 18640–18870; keine
runVerify-Nutzung im Block; Kommentar benennt es). MAIN-reachable ist es heute nicht — aber jede
Autonomie-Erweiterung, die die confirm-Tuer MAIN-oefnet, erbt "gelanded ohne frische Messung".
**Kosten:** Wer Teil 3 (Gates oeffnen) baut, ohne diese Stelle mitzunehmen, baut ein Land, dessen
Verify beliebige Alt-Baume referenziert.

**Explizit gesucht und NICHT gefunden (VERIFIZIERT als Absenz in meinem Lesefenster):** kein
Owner-Token-Erreichbarkeitspfad ueber Self-Tokens (Self-Tokens sind slot-scoped, 2045, und jede
Self-Route matcht sie gegen die eigene Zeile); kein Tick-Pfad zu mergeJob (Kommentar server.ts:596
behauptet es, einzige Aufrufstelle bestätigt es); kein Programm-Feld, das MAIN fremde Programme
erreichen laesst (Program-Filter an jeder Tuer).

## 3. UNNOETIGE OWNER-GATES — wo der Code haelt, obwohl die Korrektur MAIN gibt

**Schnitt nach 5. Gegenstueck zu Teil 2; Rangfolge nach Schleifen-Kosten.**

**3.1 — Jeder Land-Start (auch clean + gruen) ist ein Owner-Klick.** Das ist 1.1 aus
Gate-Sicht. Die Korrektur gibt MAIN "land" ausdruecklich; der Code verlangt Owner-Token fuer den
Job-Start (server.ts:17818→18570→18866). **Kosten:** bei N Studio-Iterationen N Owner-Klicks
zufaelliger Uhrzeit; der "one idea once"-Vertrag wird gebrochen, ohne dass irgendein
Risiko-Inventar es verlangt — die Maschine nach dem Merge ist bereits eine unattended
Verifikations- und Land-Kette.

**3.2 — SKIPPED/TIMED OUT/NEVER STARTED bekommen denselben Zwangsstop wie ROT.** VERIFIZIERT,
server.ts:12996–13020 (Dreiwert-Stelle): `verify.ok === null` → Stop-and-Review, exakt wie
`ok:false`. Die Korrektur sagt: "Unknown/skipped is never a pass, but it is MAIN work rather than
an owner gate." Heute ist es ein Owner-Gate (nur confirm-land kommt raus). **Kosten:** Der
Live-Fall macht es konkret: private-repo-k steht NICHT in `FLEET_VERIFY_CMD_REPOS`
(`.env:14`; live-Prozess verifiziert) und faellt auf das globale `FLEET_VERIFY_CMD`, dessen erste
Zeile `exit 42` ist → `verify.ok: null` → die Lane kann NIE auto-landen. Eine Studio-MAIN dort ist
strukturell land-unfaehig — nicht weil der Baum schlecht waere, sondern weil die Gatter-Konfig
das Repo nicht kennt. Jede Iteration = ein Owner-confirm. Und die Entscheidung, die der Owner
dabei trifft, ist leer: er bestaetigt eine Nicht-Messung.

**3.3 — MAIN kann eigene Zeilen nicht entsorgen: kein Drop/Archive/Edit.** VERIFIZIERT am
Routen-Inventar (nur create + release). Die Korrektur gibt MAIN "in-envelope scope
tradeoffs/cuts" — der Schnitt, den MAIN dazu faellt, IST oft eine Zeile, die schon filed ist.
Heute bleibt nur: Owner bitten, oder Zeile releasen (wodurch der Tick sie AUSFUEHRT, siehe 5.2).
**Kosten:** Jede echte Scope-Anpassung erzwingt einen Owner-Akt — oder ungewollte Ausfuehrung.

**3.4 — Kein MAIN-Eingriff in laufende Lanes.** (1.5 aus Gate-Sicht.) Stalled Lane → MAIN kann
weder nudge (Supervisor-Privileg, 17314) noch killen noch ersetzen; nur attention. Die Korrektur
gibt "nudge/retry/replace". **Kosten:** Supervisor-Abhaengigkeit fuer eine Trivial-Steuerung;
zur Zeit, die der Supervisor braucht, wartet die Lane im Slot-Budget (DISPATCH_MAX_LANES=2 live).

**3.5 — Deploy ist Owner/Steward-only.** VERIFIZIERT (server.ts:16382-Kontext: "owner below
tokenGate, steward via handleStewardRoute"; `deployVerb` 16392). Korrektur gibt MAIN "reversible
dev deploys". **Kosten:** Preview-Deploy = immer ein fremder Principal; "local preview builds"
(3.6) koennten das entschaeerfen, existieren aber nicht.

**Bewusst NICHT als Gate gemeldet** (Vertrag stimmt mit Ziel ueberein): Programm-Vorschlag ist
propose-only, Confirm/Activate ist Owner-Akt (server.ts:13669-Kontext; das Ziel fordert genau
diese eine Owner-Confirmed Envelope); finale Geschmacks-Promotion; Undo-Land.

## 4. ANFORDERUNGEN AN EVIDENZ / REPAIR / LAND / LOCAL PREVIEW

Was MAIN muss VORZEIGEN koennen, damit "reviewable build" Fakt ist — und was heute fehlt:

**4.1 — Identitaet des Kandidaten (existiert schon, halbwegs).** VERIFIZIERT: `bindCandidate`
(server.ts:12745ff) bindet `mainSha/candidateSha/diffHash` an jede reviewable Verdict; attention
traegt `branch + candidateSha` als Provenanz (server.ts:6318). Das ist die richtige Waehrung.
**Luecke GESCHLOSSEN aus 1.4:** auf dem Studio-Pfad (MAIN-Session im Spiel-Repo, keine Lane) gibt
es keinen Ausgabemechanismus dafuer — die readiness-Messung zeigt, dass der reiche Ledger
(lane-outcomes.jsonl) nur am Lane-Ende feuert.

**4.2 — Verify-Fakten muessen frisch UND benannt sein.** Mechanisch: `verify.ok === true` UND
`verify.ms`/`waitMs` sichtbar UND `mainSha` deckt den gelandeten Vorschlag (Stale-Guard existiert
im confirm-Pfad). Der Dreiwert-Vertrag (null ≠ false ≠ true, server.ts:12996) ist das richtige
Modell — erfordert aber, dass MAIN die drei Faelle UNTERSCHEIDEN darstellen kann; heute kann MAIN
verify-Ergebnisse ueberhaupt nicht selbst abrufen (`/api/self/gate` ist lane-only; MAIN-direct
preflights sind etwas anderes — UNGEPRUEFT im Detail, Routenkopf gelesen).

**4.3 — "Playable" mechanisch.** Minimaldefinition, heute ueberall unbelegt: ein deterministischer
Headless-Lauf (Test-Harness im Repo, z. B. `bun test` mit Fixtur-Loop: N Inputs, Assertions auf
Score/State/kein Throw). Kein Playwright noetig; noetig ist ein Sensor, der aus dem Gate heraus
laeuft UND in lane-outcomes/attention zurueckfliesst. Beides existiert nicht (VERIFIZIERT 1.4).

**4.4 — "Local preview, das ein Mensch in Sekunden prueft."** Mechanisch: statischer Build des
Lane-Baums, vom Server unter einer URL aus dem (git-ignored) Artefakt-Verzeichnis serviert,
lifetime = Lane-Lifetime, plus EIN referenzierbarer Screenshot. Der existierende Proof fuer das
Muster ist die `drops/`-Lehre der Upload-Route (server.ts:19182–19190): git-ignored Artefakte
unter `drops/` blockieren den Land NICHT — genau dort koennte ein Preview-Build liegen, ohne die
Land-Regel ("keine untracked Reste") zu brechen. Heute: nichts davon existiert; der einzige
Game-Gate baut und loescht (`.env:14`).

**4.5 — Repair-Evidenz.** `repairRounds` existieren nur fuer Merge-Konflikte (server.ts:12971;
readiness-Doc bestätigt). "Fresh reverify/critic" nach Konfliktloesung: der Mechanismus ist der
Repair-Loop in mergeJob — aber nur abrufbar, wenn ein Merge laeuft, den nur der Owner startet
(1.1). Fuer den Studio-Loop braechte MAIN: frisches Gate-Re-Run auf angehaltener Verdict (Route
existiert nicht), Critic-Verdict (runCleanReview existiert, ist live off, kann nur downgraden —
fuer "review-ready" reicht downgraden sogar, aber er muss AN sein).

## 5. UNSICHERE FEHLERMODI — Ausloeser genannt

**Schnitt nach 6. Alle Ausloeser sind live-konfigurierbar, zwei live AKTIV.**

**5.1 — [LIVE AKTIV] Exit-42-Fallthrough macht jedes Game-Repo land-unfaehig.** VERIFIZIERT:
`verifyCmdFor` = entry-then-global (server.ts:9916ff); private-repo-k fehlt in der Map
(`.env:14`), globales Cmd deklariert mit `exit 42` → `verify.ok: null` → Zwangsstop 12996. Kein
Spin, sondern ein STILLER loop-break: alle Arbeiten landen in confirm-Schlangen; die MAIN sieht
"resolved, not landed" und kann nichts daraus lernen, weil die Ursache Konfig ist, nicht Baum.
**Ausloeser:** jedes Studio-Programm in einem Repo ohne Map-Eintrag.

**5.2 — Zombie-Zeilen-Falle: Scope-Cut (autonomie-vertraglich MAINs Recht) erzwingt ungewollte
Ausfuehrung oder Owner-Blockade.** VERIFIZIERT als Struktur: pending-Zaeilen von MAIN sind nicht
loeschbar (keine Route), `PROGRAM_MAX_PENDING=5` (2677, zaehlt nur `source:"main"`) blockiert
Neufiling; alternativ Release → Zaehl-Umweg `PROGRAM_MAX_RELEASED=5` (2665) → **der Tick fuehrt
die Zeile unattended aus** (7498ff). **Ausloeser:** MAIN faellt eine eingereichte Arbeit per
in-envelope scope cut — die Korrektur gibt genau das als MAIN-Recht. **Kosten:** entweder
Owner-Ping fuer Routine-Entsorgung (Gate-Bruch, Teil 3.3) oder bezahlte, ungewollte Lane-Arbeit
(2.1).

**5.3 — Suite-Mutex-Scheintot: "NEVER STARTED" als Dauerschleife im Land-Pfad.** VERIFIZIERT als
Konstellation: `FLEET_VERIFY_WAIT_MS=900000` live; e2e-isolated (~8 min, mutex-geteilt) vor dem
Merge → verify wird in der Queue gekillt → Verdict "not a verdict about the tree" → Stop. Heute
haelt der Owner das auf (confirm); sobald 1.1 geoeffnet wird, OHNE Re-Run-Tuer, dreht die
MAIN-Schleife durch: merge → never-started → (keine MAIN-Aktion moeglich) → erneut merge →
denselben Mutex treffen. **Ausloeser:** isolated Suite laeuft parallel zum Land-Fenster.

**5.4 — Gruen ohne Messung nach Konfig-Wegnahme: der Skip-Guard ist ein single point of config.**
VERIFIZIERT als Design: ein Repo in WEDER Map NOCH globalem Cmd hat `verify === undefined` →
clean rebase = auto-land, unveraendert kommentierte Absicht (server.ts:13008-Kontext: "the
owner's deployment-wide decision"). Heute rettet allein die `exit 42`-Erstzeile des globalen
Cmds die Game-Repos davor. **Ausloeser:** ein Operator entfernt das globale Cmd, weil "per-repo
Map reicht doch" — ab dann landet jede clean-gerebatete Game-Lane ungeprueft auf main. Das ist
der Failure-Mode, der am staerksten GRUEN aussieht: keine Fehlermeldung, alle Verdicts `landed:
true`, null Messung.

**5.5 — Flake-Spin ueber nicht editierbare Spawn-Wahl.** VERIFIZIERT als Struktur: Rows tragen
persistierte Spawn-Tripel; nach `detachSlotTasks`→pending kann MAIN nur dieselbe Wahl neu
releasen (kein Edit). Ein flakerndes Modell/Harness-Paar auf der Row → endloses
Release→Flake→pending. Ausbruch nur durch NEUE Rows (Neufiling-Falle 5.2). **Ausloeser:** ein
einziges instabiles Modell auf einer geparkten Row.

**5.6 — SessionId-Divergenz als stille Autoritaets-Verschiebung.** (2.2 als Failure-Mode.) Kein
Gate, kein Log-Vermerk an der Tuer (nur Response-Feld). **Ausloeser:** Pane-Heal/Respawn mit
neuer sessionId bei gleichem Occupant-Tripel. GESCHLOSSEN hinsichtlich Haeufigkeit — Codepfad
verifiziert, Vorkommensrate UNGEPRUEFT.

**Bewusst nicht aufgenommen (geprueft, kein Befund):** Attention-Flut — capped
(ATTENTION_MAX_OPEN_PER_REQUESTER, server.ts:6319, "an unanswered pile is an attention failure"),
das Cap ist ein legitimer Riegel; Merge-during-restart-Luecke — `interrupted`-Verdicts werden
durable VOR dem ersten await geschrieben (server.ts:12765–12770 gelesen) — diese alte Spin-Quelle
ist geschlossen.

---

## Zusammenfassung in drei Saetzen

Die Schleife bis "lane finished" ist fast geschlossen — Filing/Release/Tick/Routing existieren
und sind sauber begrenzt — aber ihr Ende ist ein Owner-Klick, und zwar doppelt: der Merge-Start
(1.1) und der confirm fuer jeden nicht-gruenen Verdict (3.2). Der Live-Beweis, dass das kein
Randfall ist, steht in der eigenen Konfig: private-repo-k faellt auf `exit 42` und ist
damit strukturell nie auto-land-faehig (5.1). Die Korrektur ist also in zwei Woertern maschinell
noch nicht existent: **land** (keine MAIN-Tuer) und **budget** (kein Objekt, kein Sensor) — alles
andere sind Grade, keine Binaerbrueche.

## Offen / UNGEPRUEFT

- Ob Session-Heals `sessionId`-Divergenz bei gleichem openedAt praktisch erzeugen (5.6).
- Ob die Spiel-Repos eigene Ledger fuehren, die Evidenz tragen koennten (readiness-Doc nennt das
  selbst offen).
- `main-direct`-Preflights im Detail (nur Routenkoepfe gelesen) — koennten fuer 4.2 relevant
  werden, Haltung ungeklaert.
- Die drei Queue-Zeilen (`7aaa6644`, `80abd6d1`, `9617afe9`) sind auf Textebene gelesen; ihre
  Builder-Ansuete wurden hier nicht auf Umsetzbarkeit geprueft (das ist Teil 2/3 derselben
  Red-Team-Runde, nicht dieser Bericht).
