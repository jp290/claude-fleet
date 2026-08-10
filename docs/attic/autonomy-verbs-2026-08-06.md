# Die fünf Verben — Steward-Befunde autonom fahren, Stand 2026-08-06

*Owner-Vorgabe wörtlich, als Scope-Anker: „we should run his findings 'autonomously' by
utilising the agentic gates that we made for the task queue, all that is complementary really.
I think if we now build these few further 'verbs' and pulls this together, we basically got
it!" — und zum Landen: „I don't think that it would then be too far fetched to also land these
lanes automatically or pot. by another more conservative, separate agent, because afterall we
build it so that it's kinda idiot proof."*

*Die Rangliste endet, wo diese Vorgabe erfüllt ist. NICHT im Programm: die Entscheidungs-Inbox,
der clarify-Umbau, Auto-Rollback auf rotes Tier-2 (Korrektur 2026-08-06: 1/15 adjudizierte Rote
waren `real`, nicht mehr 0/12 — `docs/autonomy-bausteine-2026-08-06.md` §1.1; der Entscheid steht),
Handeln auf `stalled`. Alles Stehende dazu: `docs/attic/autonomy-map-2026-08-06.md` §11.*

## Der Befund, der dieses Dokument klein macht

Die Kette „Steward-Befund → analysierte, gebriefte, dispatchbare Task" existiert **vollständig**:

- `/api/steward/tasks` nimmt `kind:"lane"` als bewussten Claim an (`server.ts`, grep
  `body.kind === "lane"`) — das Ritual nutzt es nur nie (Default `note`).
- Der Analyse-Sweep liest ausschließlich `kind:"lane"` (grep `t.kind === "lane"` in
  `tickAnalysisSweep`) — Notes sind für JEDES Gate strukturell unsichtbar, per 409 erzwungen
  (dispatch/reanalyse/refine/send).
- Der Dispatcher startet ausschließlich `status:"queued"`. **Präzisiert 2026-08-07** — hier stand
  *„und dorthin führt heute nur der Owner-Promote"*, und diese Ausschließlichkeit ist falsch
  (`docs/autonomy-bausteine-2026-08-06.md` §1.2). Drei Stellen schreiben `status = "queued"`, zwei
  davon maschinell: `requeue()` in `briefAndSend` (`server.ts:2009`, feuert bei jedem Fehlschlag
  des Alive-Gates nach dem Spawn) und der Boot-Abgleich einer als `sent` persistierten Zeile,
  deren Slot nicht als lebende Lane zurückkam (`server.ts:6699`). Die Owner-Promote-Route ist die
  dritte (`server.ts:9621`).
  **Was stattdessen gilt — und was Verb 3 wirklich trägt:** *hinter jedem heutigen Weg nach
  `queued` steht ein Owner-Akt.* Beide Maschinen-Pfade sind Rückläufer, keine Beförderer: sie
  fassen ausschließlich Zeilen an, die bereits `sent` waren, und `sent` entsteht nur aus einem
  Tick auf einer freigegebenen Zeile oder aus einem attended Start — der Kommentar über
  `server.ts:2009` argumentiert genau das ausdrücklich („an attended start IS a release").
  Keiner der beiden bewegt je ein `pending` des Owners. **Verb 3 ist damit der dritte
  Maschinen-Pfad nach `queued`, aber der erste ohne Owner-Akt dahinter** — die schwächere
  Formulierung trägt seine Begründung, die Ausschließlichkeit hätte sie nur scheinbar getragen.

Fehlend sind genau drei Glieder (Verben 1–3) plus die Wiederaufstellung des Produzenten
(Verb 4) und die Land-Frage (Verb 5).

## Verb 1 — der Maschinen-Fakt erreicht seine Konsumenten

Der Sensor EXISTIERT: `suiteLockView()` (`server.ts`, grep `function suiteLockView`) liest
`$FLEET_SUITE_LOCK` (Default `/tmp/fleet-e2e.lock`) mit exakt den Zuständen von
`e2e-stage.sh` — `held | overdue | stale | parked`, `null` = frei — und `gateView()` legt die
laufenden Verify-Intents daneben. Exponiert ist das alles auf genau EINER Fläche: dem
Owner-Board (`/api/sessions`).

Die zwei Konsumenten, die es für Autonomie brauchen, sind blind:

- **`/api/steward/sessions`** trägt nur `{now, slots, deployGap, bundleStale}`. Steward-Notiz
  `05320523` benennt die Lücke selbst: der Puls kann nicht sehen, ob die Maschine belegt ist —
  und genau das entscheidet, ob eine stille Pane „fertig" oder „wartend" ist und ob irgendetwas
  gestartet werden darf.
- **`/api/self/gate`** — die Lane fragt vor dem Verify „was gated mich?", und die Antwort
  verschweigt den Mutex, an dem ihr Verify real hängen wird (der 300-s-Timeout-Vorfall,
  `docs/suite-contention.md`).

**Bauform:** `gate: gateView()` auf die Steward-Route, `suiteLock: suiteLockView()` auf die
Self-Route. Checks in den bestehenden Familien; im Harness hält der laufende Wrapper den
echten Lock — die Pin-Form ist der Vergleich gegen `$FLEET_SUITE_LOCK/pid` auf Platte.

**Schwelle (§11.2-Stil):** über die nächsten 20 Verify-Läufe der Anteil, deren Lane vor dem
Start den Gate gefragt hat UND bei belegter Maschine gewartet hat. Reine Messung, kein
Verhalten erzwungen.

## Verb 2 — Deploy

Gelandete Arbeit ist heute still NICHT live, bis eine Hand `bun run build` +
`tmux kill-session -t srv` ausführt — die größte verfallende Klasse der Steward-Notizen
(`472aba10`: 7 Commits, 150 min Bundle-Rückstand, niemand lieferte aus).

**Bauform:** ein Verb (Route, Owner + Steward-Token), das deterministisch ausführt und sich
selbst verifiziert: danach `bootHead == HEAD` und `bundleStale:false`, sonst ist das Verb
GESCHEITERT und sagt es. Vorbedingung aus Verb 1: kein Deploy, während der Post-Land-Audit
läuft (ein srv-Kill mitten im Audit — die Audit-Queue überlebt ihn per Landkarte §8, aber der
laufende Runner nicht zwingend; das prüft das Verb, nicht der Aufrufer).

**Rückweg** (die Frage, die die Landkarte als unbeantwortet führt): das Verb deployt nur
Zustände, die der Land-Gate schon grün verifiziert hat, und der Rückweg ist derselbe wie
heute von Hand — `git revert` + erneut deployen. Neu ist am Rückweg nichts; neu ist nur, wer
den Griff ausführt.

**Schwelle:** die ersten 10 automatischen Deploys je mit grüner Selbstverifikation; ein
einziger Deploy, der `bootHead != HEAD` hinterlässt und es NICHT meldet, stoppt das Verb.

**GEBAUT 2026-08-08** — `POST /api/deploy` + `GET /api/deploys` (Owner und Steward; `server.ts`,
grep `VERB 2, DEPLOY`). Der harte Kern stand nicht in der Bauform oben und ist die eigentliche
Konstruktion: **das Verb tötet seinen eigenen Verifizierer.** `tmux kill-session -t srv` beendet den
Prozess, der die Route bedient — eine Selbstverifikation NACH dem Kill kann dieser Prozess
strukturell nicht mehr ausführen. Gelöst in drei Teilen, jeder einzeln geprüft
(`e2e/deploy-facts.ts` §5):

1. **Die Antwort ist nie `ok:true`.** Ein laufender Deploy antwortet 202 mit
   `ok:null, stage:"restarting"` — „noch nicht verifiziert", ausgesprochen. Ein `ok:true` an dieser
   Stelle WÄRE das stille Scheitern, das das Verb abschafft, nur als Erfolg verkleidet.
2. **Der Verifizierer ist der NÄCHSTE BOOT.** Vor dem Kill liegt ein durabler Marker
   (`deploy-inflight.json`) auf Platte; der Prozess, der hochkommt, liest ihn, vergleicht
   `deployGap`/`bundleStale` und schreibt das Urteil nach `deploys.jsonl`. Dreiwertig: `false` =
   gemessener Fehlschlag, `null` = nicht feststellbar, und keines wird je zu einem Pass geglättet.
3. **Der Build läuft zuerst und allein** — die eine Phase, die der lebende Prozess selbst beurteilen
   kann. Ein fehlgeschlagener Build kommt am Kill nicht vorbei.

Die Vorbedingung prüft das Verb selbst: bei laufendem Post-Land-Audit **409 mit Grund**, kein Warten
und kein Kill (geprüft in `fleet-e2e-postland-audit.ts` (I.1b) — der einzigen Suite, in der
`runningPostLandAudit` überhaupt gesetzt sein kann). **Von keinem Tick aufgerufen**: es ist eine
Route und nur eine Route, dieselbe Linie wie beim Landen. Wer sie zieht — und ob je etwas
Unbeaufsichtigtes —, bleibt Owner-Entscheid; die Schwelle oben ist damit noch nicht angefangen.

## Verb 3 — Auto-Promote, das eine neue Glied

Ein Tick befördert `pending → queued` für Tasks mit **allen** vier Eigenschaften:
`source:"steward"` · `kind:"lane"` · `analysis.verdict === "ready"` mit frischer Analyse
(gleiche Frische-Regel wie der Sweep) · unter den bestehenden Ventilen (`dispatchOn`,
Lane-Deckel pro Repo, Quiet Hours — alles in `tickDispatch` vorhanden). Eigenes Audit-Event,
damit ein maschineller Promote nie wie ein Owner-Akt aussieht.

**Warum das die `500ff63`-Entscheidung nicht rückgängig macht, sondern präzisiert:** das
Eval-Gate wurde abgeschafft, weil seine Population die un-promoteten Entwürfe DES OWNERS
waren — seine einzige Macht war, dessen Zögern hinter seinem Rücken zu starten. Die neue
Population ist maschinell erzeugt (Steward-Claim), unabhängig beurteilt (Analyse), und ihr
unbeaufsichtigter Start übergeht niemandes anstehende Entscheidung. Owner-Entwürfe bleiben
owner-promotet. **Auf welcher Prämisse dieser Absatz steht (präzisiert 2026-08-07, oben):** nicht
darauf, dass nur der Owner-Promote nach `queued` führt — das ist falsch —, sondern darauf, dass
hinter jedem heutigen Weg dorthin ein Owner-Akt steht. Verb 3 hebt genau diese Eigenschaft auf und
muss sie ersetzen: das eigene Audit-Event ist deshalb kein Komfort, sondern das, was einen
maschinellen Promote nachträglich von einem Owner-Akt unterscheidbar hält.

**Schwelle:** die ersten 10 auto-promoteten Lanes werden im Review angesehen; liegt die
Abbruch-/Müll-Quote über 3 von 10, geht das Verb aus und das Ritual (Verb 4) ist schuld,
nicht der Tick.

## Verb 4 — der Steward auf den neuen Schienen

Der Steward ist seit 2026-08-06 16:30 unbesetzt (Owner-Kill, Autos leer) — der natürliche
Zeitpunkt, ihn NEU aufzustellen statt zurückzustellen. Die Ritual-Revision, aus der
Notiz-Autopsie (9 Notizen, 3 verfallene Aktionen / 6 haltbare Befunde):

1. **Verfallsdatum trennt die Container.** Ein Befund bleibt `note`. Alles mit Fenster
   (Deploy aussteht, Review reif, Rot offen) wird `kind:"lane"` MIT Done-Kriterium und
   Verify-Weg — sonst urteilt die Analyse zu Recht `needs-you`, und das Verb 3 greift nie.
   Heutige Realität: alle vier `needs-you`-Verdicts der Queue nennen „kein Kriterium" als
   Blocker. Das Ritual ist der Hebel, nicht der Sweep.
2. **Digest reparieren, nicht umbauen** (Landkarte Schritt E): `DIGEST_TTL_MS` ≥
   Puls-Kadenz, damit ein Ergebnis den NÄCHSTEN Puls bedient statt verworfen zu werden; und
   der Fehlerfall wird sichtbar (heute ist „Worker läuft noch" == „Worker starb" == `null`).
   Schwelle aus der Landkarte: über 10 Pulse muss der Anteil mit `digest != null` über 50 %
   steigen, sonst ist die TTL nicht die Ursache.
3. **Der Maschinen-Fakt in den Puls** — Konsequenz aus Verb 1, vom Steward selbst erbeten
   (`05320523`).

## Verb 5 — Auto-Land: JA als Richtung, mit der Form der Landkarte

Die Landkarte §11.1 wörtlich: *„Kein Auto-Land, in keiner Form, solange `repairRounds` bei 0
und `resolvedBy` bei n=1 steht. Beide Pfade, die einen misslungenen Auto-Land auffangen
sollen, sind im Feld ungetestet. Ein Sicherheitsnetz mit null Belastungsproben ist
Dekoration."* Das „solange" ist temporal, kein Nie — die Bedingung ist erfüllbar, und dieses
Programm erfüllt sie, statt sie zu umgehen.

**Die Agenten-Form, korrigiert nach Owner-Einwand (2026-08-06):** Der erste Entwurf dieses
Abschnitts lehnte einen Reviewer-Agenten mit Verweis auf die ②-Shadow-Serie ab (45 Rows, 0
Widerspruch → `FLEET_CLEAN_REVIEW` off). Der Owner hielt dagegen — „an opus5 session with
context of the project would understand this" — und er hat recht, denn die Serie beweist
weniger als behauptet: ihr Richter war ein Wegwerf-Worker (`SUMMARY_MODEL`) mit einer Frage
ohne Varianz („ist dieses clean-path-Land formal ok?" — immer ja). Null Information, weil die
FRAGE null Information trug. Der (j)-Fall zeigt zugleich die Frage, die Varianz HAT und die
der deterministische Gate strukturell nicht sehen kann: **„was hat main seit dem Fork dieser
Lane gewonnen, und kollidiert es semantisch mit diesem Diff?"**

Also: Verb 5 bekommt einen kontextbeladenen Kollisions-Reviewer — Opus 5, gefüttert mit
Lane-Diff + main-seit-Fork + graphify-Karte, genau diese eine Frage. Die Maschinerie dafür
EXISTIERT schlafend (`CLEAN_REVIEW_MODE off|shadow|1`, Kontrakt downgrade-only + fail-closed);
CLAUDE.md verlangt fürs Wieder-Einschalten „erst eine bestandene Feuerprobe" — die Shadow-Phase
unten IST sie. Eine Zeile bleibt stehen, nicht als Doktrin, sondern weil sie schlicht besser
ist: **der Agent urteilt, die Maschine landet** — downgrade-only, fail-closed. Ein Reviewer,
der stirbt oder hängt, heißt damit „geparkt für den Owner", nie „trotzdem gelandet" und nie
„für immer blockiert".

**Die Form:**

- Population: NUR auto-promotete Lanes (Verb 3). Attended bleibt attended — wer von Hand
  startet, landet von Hand.
- Nur der clean path: `resolvedConflict:false`. Der Konflikt-Pfad hält weiter für Review an
  (§11.1 Punkt 5, Messung 5/1).
- Verify grün auf dem rebasten Baum (der bestehende Gate, dreiwertig samt Timeout-Zustand).
- Serialisierung pro Repo (Session-27-Befund: zwei zeitgleiche ⏫ können Provenienz/Undo des
  Verlierers verlieren).
- **Circuit-Breaker:** ein un-adjudiziertes rotes Tier-2 im Repo pausiert Auto-Land, bis
  jemand geurteilt hat. Das ist die Antwort auf „idiot proof": der (j)-Fall hat bewiesen, dass
  zwei einzeln grüne Lanes semantisch kollidieren können und der Gate das strukturell nicht
  sieht (der fallende Check lebt in Stufe 2). Der Breaker macht die ungetesteten Auffangpfade
  nicht-tragend: es hält an, BEVOR sie gebraucht würden.

**Einschalt-Bedingung, prüfbar statt gefühlt:** (a) eine bewusste Feuerprobe der Auffangpfade
— ein gestellter Konflikt + ein gestellter Repair-Lauf in einer Drill-Lane, damit
`repairRounds > 0` und `resolvedBy` mindestens einmal unter Beobachtung gefeuert haben; (b)
Verben 1–3 live; (c) danach die ersten 10 Auto-Lands je mit grünem Folge-Audit. Ein
`real`-adjudiziertes Rot in dieser Serie beendet den Versuch, nicht die Diskussion.

## Reihenfolge

**1 → 2 → 3 → 4 → 5.** Begründung je Schritt: ohne den Maschinen-Fakt startet jedes weitere
Verb in garantierte Kollision; ohne Deploy produziert Autonomie gelandete, aber dunkle
Arbeit; Auto-Promote ist das kleinste neue Glied und nutzt beide; das Ritual macht `ready`
überhaupt erreichbar; und der Land-Schalter kommt zuletzt, weil seine Einschalt-Bedingung
die gelaufenen Verben 1–4 IST.
