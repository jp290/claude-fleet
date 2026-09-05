---
frage: Verstehen Owner und eintretende Agenten an AGENTS.md, README.md, SYSTEM.md und am Board korrekt, was Fleet tut, was es weiss und welche naechste Handlung moeglich ist — und traegt eine entscheidungsrelevante Anzeige ihre Aggregation ehrlich?
urteil: "Alle drei Dokumente haben einen belegten Zweck und keinen Widerspruch zum GELESENEN Code (die Loader-Grenze AGENTS.md:8-14 haelt: 'in full' steht nur im target-repo-Frame). Zwei Vorgaenger-Claims korrigiert: SYSTEM.md ist NICHT ungepinnt — 'Funktionen statt Routenwissen' faellt Stufe 1 des Land-Gates, mutationsbewiesen, waehrend jeder ANDERE Abschnitt ohne roten Check loeschbar ist; und FLEET_AUDIT_PING_MS steht in watchdog.sh:155, entgegen verdict-A-verben.md:63. Die drei Board-Wege sind ehrlich bis an eine gemessene Grenze — aber der Tier-2-Rueckweg fuer NICHT-Messungen fehlt: tickAuditPing filtert auf result==='red', und 11 von 14 'unknown'-Audits am eigenen Integrationstip stehen unadjudiziert."
bereich: [vertrag, board, post-land-audit, dokumente]
belege: [AGENTS.md, README.md, SYSTEM.md, e2e/pins.ts#SYSTEM-Vokabular-Pin, server.ts#{tickAuditPing,postLandAuditSummary,mintAuditEvents,buildProgramMainBrief,decideFleetReport}, src/plaudit.ts#postLandAlarm, src/opsevents.ts#opsUnacked, src/client.ts#{qLaneJoins,qMainActionOf,auditLiveRows}, watchdog.sh:155, context-packs.ts, post-land-audits.jsonl, audit-adjudications.jsonl, 275339a, docs/triage/verdict-D1-sicht.md, docs/messungen/kontextschicht-analyse-2026-09-05.md]
nicht-gemessen: Keine Live-UI — kein Browser, kein Owner-Token; alle Board-Aussagen sind CODE-Lesebefunde. Kein server.ts-Gesamtlesen, keine Serversemantik ausserhalb der zitierten Symbole. Ob der LAUFENDE srv watchdog.sh:155 traegt (launchctl-Vorbehalt, S0R §2). S2/S3/S4-Flaechen. Ungenutzt: lane-outcomes.jsonl, audit.jsonl, beide e2e-Trail-Verzeichnisse, fleet.json.
stand: 2026-09-05
---

# S1 — Vertrag und Einstieg (Program eec69528, Schnitt 1)

Baum `33cec52` (= Brief-Stand). Vor eigenem Urteil gelesen: S0R (`2e671a4`),
`kontextschicht-analyse-2026-09-05.md` §2/§3/§5, dessen GLM-Gegencheck,
`docs/triage/verdict-{A-verben,D1-sicht}.md`. Erledigte Befunde (B1–B10, S0R §4) sind nur zitiert.

## 1. Die drei Dokumente, einzeln

Drei Dokumente fuer drei Leser ist die richtige Teilung, solange jedes seinen Leser BELEGT.

**`AGENTS.md` (291 Z.) — portabler Vertrag, Leser mechanisch belegt.** `context-packs.ts:97,114,133`
verankert drei Packs auf seine Abschnitte (alle acht deklarierten `{path,anchor}`-Paare loesen auf,
python3-Probe); `server.ts:17624` verlangt eine getrackte, nicht-leere Root-`AGENTS.md`, bevor eine
Program-MAIN in einem Zielrepo gegruendet wird (sonst 400, `e2e/programs.ts:496`); `e2e/pins.ts:814`
haelt seinen Verify-Block gegen `watchdog.sh`. **Kein Widerspruch an der Loader-Naht:**
AGENTS.md:8-14 sagt, eine Claude-Session lese EINEN Abschnitt, waehrend
`server.ts:18052/18086/18110` „Read the repository root AGENTS.md in full" vorschreibt — das steht
ausschliesslich im **`target-repo`-Frame**; der Fleet-Frame (`server.ts:18059-18069`) sagt
stattdessen `./state.sh`, `./register.sh`, oberster HANDOFF-Abschnitt. In einem fremden Repo gibt es
kein `CLAUDE.md`-Overlay, dort ist „in full" richtig.

**`README.md` (128 Z.) — Produkt fuer Menschen, kein maschineller Leser, und das ist stimmig.**
Suchraum `rg -n 'README\.md' -g '!*.md' -g '!docs/**'`: drei Treffer, keiner ein Leser —
`register.sh:349`/`e2e/tasks.ts:2949` meinen andere Dateien bzw. eine Fixture, `repo-map.ts:103`
erklaert die Root-`README.md` ausdruecklich fuer **ausserhalb** der Repo-Karte. Kein Beweis fuer
„keinen Nutzer": der Nutzer ist der Mensch aus AGENTS.md:5. Tote Pfade: keine. **Gekostete
Beobachtung:** `Env:` (README:116) nennt **10** Variablen, alle real; `process.env.FLEET_*` in
`server.ts`+`src/*.ts`+Top-Level-`*.ts` liefert **123** — der Control-Plane-Env (`FLEET_VERIFY_CMD`,
`FLEET_AUDIT_PING_MS`) lebt nur in `watchdog.sh:155`. Kosten: wer README als Betriebsflaeche liest,
haelt 10/123 dafuer. Reparatur: ein Scope-Wort.

**`SYSTEM.md` (243 Z.) — Zielbild, und in EINEM Abschnitt geltender Vertrag.** Status-Marker
vorhanden (`:3-7`, S0R korrigiert). Sein Ist-Zeiger `:6` zeigt auf
`docs/kontextschicht-analyse-2026-08-20.md`, dessen §10 sich selbst als superseded fuehrt und die
seit 2026-09-05 eine Nachfolgerin hat — schon als uncosted observation notiert. Der harte Punkt: F2.

## 2. Drei Wege ueber das Board (Code-Lesebefunde)

**(a) Auftrag `pending`/`queued` -> gestartete Lane.** `src/client.ts:6025-6110`: Rail `pending ->
queued -> sent -> done`; `archived`/`advisory` sind ausdruecklich KEINE Stationen, ein unbekannter
Status ist `unknown` und bekommt keinen Knopf. Die Sent->Lane-Naht (`qLaneJoins`, `:6956-6982`)
verweigert mit **sieben benannten Gruenden** statt einer stillen Null: leerer Slot · zu
Plain-Checkout recycelt · zwei Zeilen auf denselben Slot · kein `openedAt` (= UNBEKANNT, nicht nein)
· Session aelter als die Zeile · fremdes Repo · kein Zielrepo bekannt. Die Program-Haelfte traegt
wortwoertlich `"unchecked"`. Ehrlich, inklusive terminaler und recycelter Slots.

**(b) Report -> Zustellstatus / Empfang / fachliche Annahme.** Transport und Empfang: getrennt und
ehrlich (`src/opsevents.ts`). `delivered` heisst „tmux hat die Tasten genommen", `send-uncertain`
wird VOR der tmux-Beruehrung persistiert und sagt das; `opsUnacked` zieht beide nach 120 s in eine
knopflose Klasse („Whether the session read them is not known"). **Fachliche Annahme: keine
Board-Flaeche.** `decideFleetReport` (`server.ts:6516`) persistiert `accepted|rejected`+Grund, und
`settleFleetEventAcknowledged` setzt das Event auf `acknowledged` — damit faellt die Zeile aus
BEIDEN Ops-Listen (`opsOpen` verlangt `status==="inbox"`, `opsUnacked` `delivered|send-uncertain`).
Der Client nennt `fleet-report` dreimal (`:10583,10598,10608`), keine Stelle rendert die
Disposition. Siehe F4.

**(c) Kandidat -> Land -> Audit.** `auditLiveRows` (`src/client.ts:1455-1500`) trennt `starting`
(„beansprucht, Ziel noch nicht gestempelt") von laufend, druckt `(tip not resolved yet)` statt eines
leeren SHA, nennt die koaleszierten `covers` und zeichnet Lands, die auf einen Audit WARTEN —
unterschieden von „kein Audit geplant"; p50/p90 mit `n`. `postLandAlarm` (`src/plaudit.ts`): gruen
schweigt, `red` ≠ `unknown` („folding unknown into green would fabricate a pass"). Grenze:
`postLandAuditSummary` (`server.ts:13283`) liefert nur die NEUESTE Zeile. Siehe F1/F3.

## 3. Eine Informationskette, durchgezogen

**Anzeige:** der Post-Land-Alarm — die einzige fleetweite Flaeche, die den Owner zu `↩ undo-land`
bewegt.

| Stufe | Artefakt | Beleg |
|---|---|---|
| Ursprung | Exitcode + FAIL-Zeilen des Suite-Laufs gegen den Tip | `exitCode`, `fails`, `out`, `checks` |
| Verdichtung 1 | Zeile in `post-land-audits.jsonl` (480): `result`, `mainSha`, `covers[]` (koalesziert), `reason` | Ledger |
| Verdichtung 2 | `postLandAuditSummary()` — **nur die neueste Zeile** | `server.ts:13283-13300` |
| Sichtbar | `#plaudit`, nur bei nicht-gruen, Ack an `at` gebunden | `src/plaudit.ts`, `index.html:1422` |
| Entscheidung | Owner: undo-land / untersuchen / adjudizieren | `postLandAlarm.note` |

**Informationsverlust, drei Stellen, alle im Code ausgesprochen:** gruen zeichnet nichts · nur die
neueste Zeile faehrt · fehlende `covers` werden gedruckt als „which land it followed is NOT
recorded". **Gemessene Folge** (Join ueber `at`, beide Ledger): von **220** nicht-gruenen Zeilen mit
Nachfolger war bei **73** der Nachfolger gruen — der Alarm loescht sich dann selbst; Sichtfenster
Median **46 min**, p90 **217 min**. Bewusst so („this payload carries the newest row only"), also
kein Defekt der Anzeige, sondern die Bedingung, unter der F1 kostet.

## 4. Fuenf Befunde, rangiert

**F1 — `tickAuditPing` erreicht nur `red`; eine NICHT-Messung des eigenen Integrationstips hat
keinen dauerhaften Rueckweg.** *(neuer reparierbarer Befund)* `server.ts:10353` filtert `r.result
=== "red" && !judged.has(r.at)` — `unknown` ist strukturell ausgeschlossen. Der zweite Kanal,
`mintAuditEvents` (`server.ts:5548`), feuert nur an einen VORHER bewaffneten `{kind:"audit"}`-Watch;
bleibt die Alarmleiste (neueste Zeile, Median 46 min, §3). Von 99 `unknown`-Zeilen liegen 85 in
FREMDEN Repos mit `exit 42` — das designte SKIPPED aus AGENTS.md:197, korrekt ungepingt. **14 liegen
in `claude-fleet` selbst: 12× Timeout nach 1 800 000 ms, 2× `exit 127`; 11 davon unadjudiziert,
2026-08-29 bis 2026-09-02.** *Kosten:* die Stufe, die existiert, damit ein Land den Baum nicht
kaputt zuruecklaesst, hat fuer „gar nicht gemessen" keinen Empfaenger — und ein 30-min-Timeout sieht
wie Ruhe aus. *Verify:* `rg -n 'r.result === "red"' server.ts` (eine Stelle) plus der Ledger-Join;
ein Fix ist gruen, wenn eine `unknown`-Zeile denselben Ping ausloest und dabei NICHT `red` heisst.

**F2 — „SYSTEM.md sieht kein Pin und kein Leser" ist fuer einen Abschnitt falsch und fuer sieben
richtig.** *(neuer Befund, korrigiert einen Vorgaenger-Claim)*
`kontextschicht-analyse-2026-09-05.md` §3 fuehrt SYSTEM.md als „Zielbild ohne Leserolle … dessen
Drift kein Pin und kein Leser saehe". **Mutationsbeweis, Datei danach sauber:**
`e2e/pins.ts:1086-1103` liest `SYSTEM.md`, schneidet `## Funktionen statt Routenwissen` und
vergleicht seine acht Namen gegen die Registry. Zielfunktion umbenannt -> `1 FAILURES`; Ueberschrift
umbenannt -> `1 FAILURES` (`system=[]`); Abschnitt `## Wissensordnung` ganz geloescht -> **ALL
PASS**. `bun e2e/pins.ts` ist Stufe 1 jedes Land-Gates. *Kosten:* beide Leserichtungen sind teuer —
wer dem Claim folgt und die Funktionsliste kuerzt, toetet jeden Land dieser Maschine an Stufe 1 (die
Signatur, die CLAUDE.md fuer drei Handedits mit ~20 min beziffert); wer „SYSTEM.md ist gepinnt"
liest, haelt sieben Abschnitte fuer geschuetzt, die es nicht sind. *Verify:* die drei
sed-Mutationen, je `bun e2e/pins.ts` + `git checkout --`.

**F3 — 103 von 221 nicht-gruenen Audits tragen kein Urteil.** *(schon disponiert — hier erstmals
beziffert)* `docs/triage/verdict-D1-sicht.md:39` (`6440c392`) nennt die Luecke bereits: „ein rotes
Audit laesst sich vom Board aus weiterhin nicht adjudizieren". Neu sind die Zahlen aus dem Join von
`post-land-audits.jsonl` (480) und `audit-adjudications.jsonl` (155 Zeilen, 121 distinkte
`auditAt`): nicht-gruen **221 (46 %)**, davon **103 ohne Urteil (47 %)** — **8/122 rot**, **95/99
unknown**. Die Asymmetrie ist F1 in Zahlen. *Kosten:* jede Basisraten-Aussage ueber Flakes ruht auf
einem Nenner, dessen groessere Haelfte nie beurteilt wurde. *Verify:* derselbe Join.

**F4 — Die fachliche Annahme eines Reports hat keine Board-Flaeche.** *(schon disponiert, Schicht
benannt — Kosten hier erstmals gestellt)* `docs/program-ansicht-informationsschichten-2026-09-05.md`
fuehrt Reports als Schicht **L7** (`:104`); der v1-Schnitt (`:142`) nimmt daraus nur „offene UND
`refused` Attentions" mit, die Disposition ist in keinem Schnitt benannt. Der Fakt ist persistiert
(`275339a`) und ueber `GET /api/self/program-execution` fuer die Nachfolge-MAIN lesbar; das Board
rendert ihn nirgends, und der Entscheid raeumt die Zeile aus dem Ops-Fenster (§2b). *Kosten:* der
Owner sieht am Board nicht, ob die Arbeit einer Lane angenommen oder abgelehnt wurde — beides sieht
aus wie „still verschwunden", die Frage, die ueber Nachsteuern entscheidet. *Verify:* `rg -n
'disposition' src/client.ts` (kein Report-Treffer). *Vorschlag:* in den L7-Teil des geplanten `GET
/api/programs/:id/view`.

**F5 — Ein Vorgaenger-Claim ist ueberholt: der Audit-Ping ist im getrackten Deployment
eingeschaltet.** *(neuer Befund, klein)* `docs/triage/verdict-A-verben.md:63` sagt „im getrackten
Deployment ist der Tick aber nicht eingeschaltet"; `watchdog.sh:155` setzt
`FLEET_AUDIT_PING_MS=60000`, `server.ts:20491` armiert bei `> 0`. *Kosten:* eine Lane, die
D1/A-Arbeit plant, budgetiert Vorhandenes. *Grenze:* Datei-Befund; ob der LAUFENDE Server ihn
traegt, folgt nicht daraus (launchctl-Vorbehalt, S0R §2). *Verify:* `rg -n 'FLEET_AUDIT_PING_MS'
watchdog.sh server.ts`.

## 5. Ausdruecklich beibehalten (Zweck verstanden, keine Entfernung vorgeschlagen)

- `src/opsevents.ts` — zwei Transportklassen statt einer; der Kommentar traegt den bezahlten Fall
  (zugestellt nach 3 s, quittiert nach 368 s) und nennt sich Spiegel, nicht Mechanismus.
- `qLaneJoins` — sieben benannte Ablehnungen statt einer Null; jede spart Nachsehen.
- `auditLiveRows`/`postLandAlarm` — `starting` ≠ leer, `unknown` ≠ `red` ≠ gruen, p50/p90 mit `n`.
- `e2e/pins.ts` §SYSTEM-Vokabular — der eine Doc↔Code-Pin dieses Repos, der wirklich haelt (F2).
- Die Pack-Kette `CONTEXT_PACKS` + `.fleet/context-packs.json` -> `renderContextAnchorBlock` ->
  `context-receipts.jsonl`: Zeiger statt Kopien, Blob-SHA je Quelle (Kostenfragen: B7, S2).

## 6. Methode und Suchraum

`rg`/`rg -uu`, python3 (Anchor-Probe, zwei Ledger-Joins), `bun e2e/pins.ts` als Sonde (3 Mutationen,
Baum danach sauber), `git log --format=%B`. **graphify zuerst gefahren wie beauftragt** —
unbrauchbar (1037 Knoten, bei 80 abgeschnitten), danach `rg`. Voll: die drei MD-Dateien,
`src/opsevents.ts`, `src/plaudit.ts`, S0R, GLM-Gegencheck. Bereichsweise: `src/client.ts` 1435-1500,
5202-5250, 6025-6115, 6934-7010, 10600-10700; `server.ts` 5530-5570, 6516-6556, 7900-8010,
10337-10400, 13283-13312, 15535-15570, 17690-17760, 18045-18115, 22665-22760; `e2e/pins.ts` 800-830,
1080-1170; `context-packs.ts` 85-140.

## 7. Nicht geprueft, und die Uebergabefragen

Vollstaendig im Kopffeld `nicht-gemessen`. Schwerster Posten: **keine Live-UI** — jede Board-Aussage
ist Code-Lesebefund.

- **an S2** (`server.ts#renderContextAnchorBlock`): der Ankerblock rendert nur `plan.selected`;
  `plan.omitted` faehrt in `context-receipts.jsonl`, nicht in den Brief, waehrend `SYSTEM.md:113`
  vom ContextEnvelope ausgewaehlte **und ausgelassene** Quellen verlangt. Ist der Empfaenger der
  Auslassung der Agent oder das Register? Beleg: eine Receipt-Zeile mit nicht-leerem `omitted` gegen
  den Brief derselben `briefHash`.
- **an S3** (`server.ts#tickAuditPing`): ist der `unknown`-Ausschluss Entscheid oder Nebenwirkung des
  `red`-Wortlauts? Beleg: der Commit-Body zu `54ea616` (nicht gelesen).
- **an S3** (`server.ts#decideFleetReport`): welche Owner-Route traegt die Disposition — der geplante
  `GET /api/programs/:id/view` (L7) oder der Poll? D2s „Poll ledgerfrei" spricht fuer den ersten.

## 8. Entscheidungs-Trail

Gate -> Dokumente -> Pfad-/Anchor-Proben -> Leser-Suche -> Vorgaenger gegen Dubletten ->
Pin-Mutationen (ein Vorgaenger-Claim widersprach dem Code) -> die drei Board-Wege -> Ledger-Joins,
als die Alarm-Kette eine Grenze zeigte. Zwei Kandidaten FALLEN GELASSEN: die 85 `exit-42`-Unknowns
in fremden Repos (designtes SKIPPED) und der fehlende Omissions-Render (CP-A, S2).