# Triage-Batch D1-sicht — Board: Sicht und Aufmerksamkeit

**8 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**

---

## `b3a81fd0`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Die Lücke ist real und im Baum belegt: deploySection() (src/client.ts:1912) und gateSection() (1857) haben nur vier Aufrufer (2160/2161/2191/2197), alle innerhalb von renderBoard(), das bei `!boardOpen || isMobile()` sofort zurückkehrt (2149). Das Vorbild existiert ebenfalls — .plaudit ist eine fixed Leiste mit Ack (public/index.html:32, src/client.ts:4949-4990) — und die zitierte Pflicht steht in
- Analyst sagt kollidiert mit: 4d7aba33, f6e085d5, 6ebb4c85, 54560617, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-A 08-07] TITEL: „Deploy fällig" und die Suite-Gate-Zeile aus dem Desktop-Board in die globale Leiste
WAS: „srv läuft auf altem Code" und „das Client-Bundle ist älter als src/" erscheinen dann überall — auch auf dem Handy und bei eingeklapptem Board —, statt nur im rechten Board.
WERT: Beide Fakten liegen schon auf dem Draht von /api/sessions (deployGap, bundleStale, gate, server.ts:8340-8344) und werden clientseitig nur in deploySection()/gateSection() (src/client.ts:1744,
1697) gezeichnet — beide ausschließlich aus renderBoard(), das bei !boardOpen || isMobile() sofort zurückkehrt (src/client.ts:1916). Das trifft genau die Warnung, die CLAUDE.md zur Pflicht macht
(„Danach IMMER bundleStale prüfen … sonst ist der Client-Teil des Lands unsichtbar"). Das Muster ist im Haus und bewährt: .plaudit ist eine fixed Leiste mit Ack, die mobil mitläuft
(src/client.ts:4549-4569, CSS public/index.html:32) — nur nutzt der Deploy-Fakt sie nicht.
SKIZZE: Eine zweite, ruhigere Leiste in derselben Sprache wie .plaudit (oder ein zweiter Tone derselben) — gezeichnet aus dem Poll-Handler, nicht aus renderBoard, mit Ack, das an deployGap.head
gebunden ist (nicht an eine Uhrzeit), damit der nächste Land sie wieder hebt. deploySection() im Board kann ersatzlos entfallen oder auf dieselbe Funktion zeigen. FILES: src/client.ts,
public/index.html (CSS). Reine Client-Arbeit — keine Server-Änderung. AUFWAND: S
REVERT: trivial, ein Commit, kein Zustand. Einziger Rest: ein localStorage-Ack-Key pro Gerät, der nach einem Revert ungelesen liegen bleibt.
GEPRUEFT: Aufrufstellen von deploySection/gateSection per grep vollständig (1927/1928/1957/1959 — alle in renderBoard); isMobile()-Guard gelesen. Registerzeile 7d380d5e will gate: gateView() auf
die Digest-Route heben (Steward-Seite) — anderer Abnehmer, keine Dopplung. Nicht in §7, nicht in F1–F7.

PROVENIENZ: Ideen-Scout A (Lane fleet/260806222332-ef99, 2026-08-07), Block 3 — Vollreport beim Owner.
```

## `4d7aba33`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Der Befund stimmt: openActivity()/switchLens()/loadLens() (src/client.ts:7556/7483/7523) laden 🧾 aus /api/lane-outcomes?limit=1000 und 🛡 aus /api/audit?limit=1000 und halten keinerlei Zeitfilter oder Anker — ein localStorage-Strich pro Linse ist reine Client-Arbeit mit prüfbarem Fertig-Zustand und trivialem Revert. Die Abgrenzung gegen sinceLastLook trägt ebenfalls: sinceLastLookView(prior) existi
- Analyst sagt kollidiert mit: b3a81fd0, f6e085d5, 6ebb4c85, 54560617, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-A 08-07] TITEL: Das Aktivitäts-Fenster bekommt einen „seit du zuletzt hier warst"-Strich
WAS: Beim Öffnen von 🧾 (Lands) und 🛡 (Audit) trennt eine Linie das, was seit dem letzten Öffnen dazugekommen ist, vom Rest — mit Zähler in der Kopfzeile („7 neu seit 21:40").
WERT: Beide Linsen sind heute flache Neueste-zuerst-Listen (openActivity, src/client.ts:6746; Daten aus /api/lane-outcomes, /api/audit); es gibt keinen Zeitfilter und keinen Anker. Die Frage „was
ist gelandet, seit ich zuletzt hingesehen habe" beantwortet der Owner heute durch Scrollen und Datums-Vergleich. Ein Strich beantwortet sie in einem Blick, und er ist ehrlich: er behauptet nichts
über die Zeilen, er markiert nur eine Grenze.
SKIZZE: Ein localStorage-Zeitstempel je Linse, beim Schließen gesetzt; beim Rendern die erste Zeile mit ts <= anchor mit einer Trennzeile davor versehen; Zähler in shell.tools. Bewusst nicht auf
sinceLastLook aufbauen: die serverseitige Fassung ist an den Steward-Journal-Record gebunden (server.ts:7692, sinceLastLookView(prior)) und hat einen offenen, belegten Defekt — sie schlüsselt Lanes
nur nach Branchnamen und hat repo-übergreifend einen Falschalarm „main wurde rewritten" erzeugt (Queue-Notiz b759e8d9, mit Messung). FILES: src/client.ts. Client-only. AUFWAND: S
REVERT: trivial. Persistiert nur zwei localStorage-Zahlen pro Gerät; nach einem Revert bedeutungsloser Müll, keine Migration.
GEPRUEFT: openActivity und switchLens gelesen — keine Zeitfilter-Logik vorhanden. Überschneidung mit 3d87f3e4 (Entscheidungs-Inbox) ist real, aber die Inbox ist eine Item-Typ-Liste mit
Auflöse-Aktion und 30-%-Schwelle; das hier ist ein Lesezeichen in einem bestehenden Fenster und braucht keine ihrer Vorbedingungen. Bei Bau der Inbox kann der Strich bleiben oder fallen — er
blockiert sie nicht.

PROVENIENZ: Ideen-Scout A (Lane fleet/260806222332-ef99, 2026-08-07), Block 5 — Vollreport beim Owner.
```

## `6440c392`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Kernbefund stimmt: grep 'post-land-audits' in src/client.ts = 0, waehrend GET /api/post-land-audits (server.ts:11777), die Adjudikations-Route (:11796) und der Join adjudicationsByAudit() (server.ts:6822) existieren; CLAUDE.md:575 traegt den zitierten Satz woertlich, MAX_ADJUDICATION_NOTE = 300 (server.ts:6809) deckt das genannte Limit. Reichweite bleibt im Worktree (Client-Overlay + e2e-Check, Se
- Analyst sagt kollidiert mit: 34205199, f551f930, 5aafbee4, 1cb6778e, 16d5e973, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-B 08-07] TITEL: Der Audit-Rail auf dem Board — 54 Zeilen Tier-2, null Knöpfe
WAS: Der Owner sieht die Post-Land-Audits dort, wo er landet: Ergebnis, welcher Commit, welche Lanes abgedeckt, ob schon geurteilt wurde — und kann direkt urteilen, statt curl -X POST zu tippen.
WERT: grep -c 'post-land-audits' src/client.ts = 0. Die Route ist gebaut, die Adjudikations-Route ist gebaut, der Join auditAt ist gebaut (server.ts:8460-8479, adjudicationsByAudit) — und CLAUDE.md
schließt den Absatz wörtlich mit „Einen Knopf im Board gibt es dafür noch nicht." Der Bestand heute: 54 Audits, 39 grün, 15 rot, 15 von 15 adjudiziert (unknowable 9 · flake 3 · stale-test 2 · real
1) — die 1/15-Basisrate, auf der §7 das Auto-Rollback beerdigt hat, wird damit auf dem Board nachrechenbar statt zitierbar.
Warum trotzdem als letzte Zeile mit Überzeugung, und nicht höher: der Rückstand ist gerade null, der Rundgang führt un-adjudizierte Rote bereits als Kandidaten, und 8 der 9 unknowable sind ein
Retentions-Problem, das seit 70cd443 (signal-first, server.ts:3866-3932) behoben ist. Der Wert ist Ergonomie und ein sichtbarer Basisraten-Zähler — nicht ein offenes Loch.
SKIZZE: Dieselbe Machart wie die zwei Lenses, die es schon gibt (/api/audit bei src/client.ts:5767, /api/lane-outcomes bei :6741): eine Overlay-Liste, neueste zuerst (die Route sortiert bereits
so), rot ohne adjudication visuell abgesetzt, ein Vier-Knopf-Urteil real|flake|stale-test|unknowable plus Notizfeld mit dem harten 300-Zeichen-Limit der Route clientseitig sichtbar. Der Kopf trägt
die Basisrate als Bruch. Das Rot bleibt rot — die Adjudikation sagt nur, dass jemand hingesehen hat, und die UI darf diesen Unterschied nicht einebnen. FILES: src/client.ts (das Overlay), e2e/ (ein
Check am Downgrade-Verbot). Server unverändert.
AUFWAND: M — reine Client-Arbeit, aber ein Overlay mit Schreibpfad.
REVERT: Trivial im Code (Client-Overlay, ein Commit). Ehrlich: geschriebene Adjudikationen persistieren in audit-adjudications.jsonl und ein Revert nimmt sie nicht zurück — das ist aber das
gewollte Ergebnis der Funktion, kein Schaden, und die Route existiert unabhängig davon bereits.
GEPRÜFT: grep -c im Client = 0; Route + Join gelesen; post-land-audits.jsonl (54 Z.) und audit-adjudications.jsonl selbst über auditAt gejoint. Keine Queue-Zeile. briefs/audit-view-2026-07-24.md
ist /api/audit, nicht diese Route, und trägt einen Client-Leser. briefs/audit-reds-familie-b.md ist der Auftrag, zwei bestimmte Zeilen zu beurteilen — nicht die Ansicht.

PROVENIENZ: Ideen-Scout B (Lane fleet/260806222332-e42f, 2026-08-07), Block 7 — Vollreport beim Owner.
```

## `1cb6778e`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Jede Behauptung ist im Baum nachweisbar: document.title wird in src/client.ts und public/index.html 0x gesetzt (index.html:5 traegt den statischen <title>), updateTitle() (:4570-4574) schreibt nur mtitle, favicon/Notification/serviceWorker = 0 Treffer, und pollPlan(hidden) gibt pollMs/chatMs/boardMs = 0 zurueck (:44-46, mit Kommentar 'ein hidden tab polls NOTHING') — der Hidden-Tab-Befund traegt. 
- Analyst sagt kollidiert mit: 6440c392, 34205199, f551f930, 5aafbee4, 16d5e973, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-A+C 08-07] TITEL: Tab-Ampel — Titel-Badge, Favicon-Punkt und die schlanke /api/attention fuer den versteckten Tab
WAS: Der Browser-Tab sagt, ob etwas auf den Owner wartet — "(2) Claude Fleet" plus ein Favicon-Punkt in Amber/Rot — ohne dass der Tab offen ist. Heute: document.title wird 0x gesetzt (public/index.html:5 statisch, updateTitle() schreibt nur den Mobile-Header), Favicon statisch, und der KERN-Befund von Scout A: pollPlan(hidden=true) liefert pollMs/chatMs/boardMs = 0 (src/client.ts:43-46) — ein versteckter Tab pollt NICHTS und weiss darum auch nichts. Ein Badge allein (Scout-C-Fassung) wuerde im Hintergrund nie aktualisiert.
WERT: Der Owner faehrt 8 Sessions und hat den Tab den halben Tag im Hintergrund; der einzige heutige Rueckkanal ist Hinsehen. Web-Notifications/Push gehen strukturell nicht: das Board laeuft ueber plain http (kein Secure Context), der HTTPS-Share-Host liefert fuers Board 404 (server.ts SHARE_HOSTS-Block). Der Titel + Favicon sind der einzige Kanal, den plain HTTP zulaesst.
SKIZZE: Server: GET /api/attention, ~200 Byte: {needsYou, awaitingSlots, plaudit, deployDue} — alles aus Werten, die /api/sessions heute schon berechnet. Client: bei document.hidden ein 60-s-Timer NUR auf diese Route; im Vordergrund speist refresh() dieselbe paintTabState()-Funktion (Zaehlgroessen existieren: qGroupOf(t)==="needs" src/client.ts:4617, mergePending, postLandAudit-Flag 4600). document.title = n ? "("+n+") Claude Fleet" : "Claude Fleet"; Favicon als 32x32-Canvas nach icon.svg-Geometrie mit Eckpunkt, per toDataURL in ein dynamisches <link rel=icon>, nur bei Aenderung neu gezeichnet. FILES: server.ts (eine Route), src/client.ts (Timer + paintTabState), e2e/ (Route-Pin).
AUFWAND: S-M REVERT: trivial — ein Commit; optionaler localStorage-Ack-Key bleibt inert liegen.
GEPRUEFT: von beiden Scouts unabhaengig — grep document.title/favicon/Notification/serviceWorker = 0 Treffer im Client; pollPlan gelesen; keine Register-Zeile, nicht in §7.
PROVENIENZ: Merge aus Scout A Block 1 + Scout C Block 9 (Kern identisch; A hat den Hidden-Tab-Befund, C das Favicon) — Reports beim Owner.
```

## `54560617`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Die Lücke ist verifiziert: /api/slot-stats existiert (server.ts:11750, im Brief 8443), slotstats.ts hat exakt die genannten 240 Zeilen, `grep -c 'slot-stats' src/client.ts` ist wirklich 0, und die einzigen Leser sind Steward-Doku (docs/steward.md, .claude/commands/inspektion.md:23 — dort wörtlich als owner-only). Die Arbeit ist ein Auszug an eine vorhandene Karte plus ein bedingtes Badge plus ein 
- Analyst sagt kollidiert mit: b3a81fd0, 4d7aba33, f6e085d5, 6ebb4c85, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-B 08-07] TITEL: /api/slot-stats hat keinen Betrachter — und meldet 26 verlorene Gespräche auf Slot 1
WAS: Der Owner sieht am Slot, ob dieser Slot sein Versprechen hält („eine dauerhafte Unterhaltung"). Heute muss er dafür einen Owner-Token in ein curl tippen.
WERT: Die Route ist gebaut (server.ts:8443), der Leser ist gebaut und sauber (slotstats.ts, 240 Z., mit expliziter Ausschluss-Disziplin), und grep -c 'slot-stats' src/client.ts = 0. Der einzige
Konsument ist der Steward über den Digest (docs/steward.md:44, .claude/commands/inspektion.md:23) — und der Steward-Slot ist laut Register unbesetzt. Ich habe die Live-Route abgefragt:
overall  heals 327  resumed 184  rate 0.563
  slot  1  opens 13  heals 39  resumed  0   {'no-session': 13, 'no-transcript': 26}
  slot  5  opens 16  heals 41  resumed 25   {'no-session': 16}
no-session == opens bei jedem Slot — das ist der normale Erstspawn und keine Anomalie. Die Anomalie ist die eine Zahl, die nur Slot 1 trägt: 26× no-transcript = ein Pin existierte, seine .jsonl war
weg, das Gespräch war nicht wiederherstellbar. 26 Mal in sieben Tagen, auf einem Slot, und nichts auf dem Board hat es je gesagt. Genau die Frage aus dem Auftrag — wo verliert die Maschine Wissen
— hat hier eine Zahl.
SKIZZE: Kein neuer Leser, keine neue Route. Ein schmaler Auszug (heals, resumed, healReasons) reitet auf dem bestehenden Slot-Objekt mit; im Board ein Badge am Slot, das nur erscheint, wenn
no-transcript > 0 — genau der Zustand, der kein Normalbetrieb ist (no-session ist einer und darf nie leuchten, sonst leuchtet alles). Wieder mit der data-saver.md-Auflage: der Auszug ist ein
Wochenaggregat, gehört also in die selten geholte Info-Karte, nicht in den 2-s-Poll. Das Badge ist ein Sensor, keine Diagnose — warum Slot 1 seine Transkripte verliert, ist eine eigene
Untersuchung, und dieses Badge ist genau das, was sie auslösen würde. FILES: server.ts (Auszug an die Karte hängen), src/client.ts (Badge), e2e/ (ein Check am Auszug).
AUFWAND: S–M — der Auszug ist S; wenn der Owner die Ursache mituntersucht haben will, ist das eine eigene Lane.
REVERT: Trivial. Reine Anzeige über einen vorhandenen reinen Leser; nichts wird geschrieben, nichts migriert.
GEPRÜFT: grep -rn 'slot-stats' über server.ts src/ public/ docs/ briefs/ commands/ .claude — vier Treffer, davon null im Client. Live-Route mit Owner-Token abgefragt, Zahlen oben sind die Antwort
von heute. Keine Queue-Zeile zu slot-stats/Slot-Gesundheit; 356333db (Zeit der letzten Ausgabe) ist ein anderes Signal. Nicht in §7.

PROVENIENZ: Ideen-Scout B (Lane fleet/260806222332-e42f, 2026-08-07), Block 5 — Vollreport beim Owner.
```

## `f551f930`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Alles Genannte existiert und die Luecke ist echt: der Land-Knopf wird zu '… landing' (src/client.ts:2404), waehrend slotRow (ab :4741) nur das serverseitige s.mergePending als ⏸ fuer reviewbereite Konfliktaufloesungen rendert (:4796) — einen laufenden-Land-Zustand traegt die Row nicht; die lokalen Sets mergeWatch (:810) und mergePending (:814) werden in doLand (:892) / doMergeLand (:954) gefuellt,
- Analyst sagt kollidiert mit: 6440c392, 34205199, 5aafbee4, 1cb6778e, 16d5e973, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-C 08-07] TITEL: „… landing" ist im Seitenbaum unsichtbar
WAS: Während ein Merge-Job läuft, sagt das Board es: der Knopf wird zu … landing und disabled (src/client.ts:2164-2165). Die Slot-Row daneben sagt gar nichts — ich habe slotRow (4334-4468)
vollständig gelesen, es gibt dort keinen laufenden-Land-Zustand; s.mergePending ist etwas anderes (⏸ = aufgelöste Konflikte warten auf Review, Z. 4389-4395). Der Board ist Desktop-only und zeigt
immer nur EINE Session. Danach trägt eine landende Row einen langsam durchziehenden Streifen in der Projektfarbe und ein ⏏, und die Sidebar sagt, was die Maschine gerade tut.
WERT: Der Land ist der teuerste Vorgang der Maschine — Suite-Mutex, ~110 s Gate, danach ~600 s Post-Land-Audit auf demselben Lock (CLAUDE.md). Genau in diesem Fenster darf man nichts
danebenstellen. Dass ausgerechnet dieser Zustand in der einzigen immer sichtbaren Liste fehlt, ist die auffälligste Lücke der Statussprache. Es ist Politur mit Betriebsnutzen: man sieht, dass die
Maschine belegt ist, ohne den Board zu öffnen.
SKIZZE: Der Client weiß es bereits lokal — mergePending: Set<number> (src/client.ts:743-745, gesetzt in doLand Z. 829 und doMergeLand Z. 884) und mergeWatch: Set<number> (Z. 743, gefüllt bei Z. 865
und 1941). slotRow fragt beide ab und setzt .slot.landing; CSS: ein linear-gradient-Sweep in hsl(var(--proj-h) …) über die Row, animation: landsweep 2.2s linear infinite, hinter
prefers-reduced-motion auf ein statisches ⏏-Glyph reduziert. FILES: src/client.ts (zwei Zeilen in slotRow, plus mergeWatch/mergePending in den lastRender-Key aufnehmen — sonst friert die Row, exakt
der Fehler, den der Kommentar bei Z. 4622-4627 beschreibt), public/index.html (Keyframes + Klasse).
AUFWAND: S
REVERT: Trivial. Nur Render, kein Zustand, kein Server. Ehrliche Grenze: mergeWatch/mergePending sind Tab-lokal — ein Land, den ein anderes Gerät gestartet hat, sweept hier nicht. Es wäre
serverseitig lösbar (ein landing-Flag im Poll), aber das ist ein Feld auf der 112-KB-Hot-Path-Route und damit ausdrücklich NICHT Teil dieses Vorschlags.
GEPRÜFT: slotRow vollständig gelesen; grep -n mergeWatch src/client.ts → 5 Treffer, alle gelesen. Keine Register-Zeile nennt den Land-Zustand in der Sidebar (cabf3c88 betrifft die Queue-Zeile beim
Dispatch, nicht die Slot-Row beim Land — und die schlage ich nicht vor). §7 unberührt.

PROVENIENZ: Ideen-Scout C (Lane fleet/260806222333-fd17, 2026-08-07), Block 5 — Vollreport beim Owner.
```

## `3a622ea1`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Every substantive claim verified: Slot.awaiting exists and is a real 'owner'|null field (server.ts:1028), set on clarify release (3367), persisted through the state loader (9073), served to the steward (laneSignalView 9770 / stewardSlotsView 9910), and enforced by handleStewardSend's 409 (9609) — while the /api/sessions slot projection (server.ts:11616-11655) carries id, cwd, label, lastOutput, gi
- Analyst sagt kollidiert mit: 577b26fa, 9bf62ae6, df5b74ba, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-A 08-07] TITEL: awaiting: "owner" auf die Slot-Row heben — die Lane, die auf DICH wartet, sieht heute aus wie eine untätige
WAS: Eine CLARIFY-Lane, die ihr Kriterium vorgeschlagen hat und parkt, trägt serverseitig Slot.awaiting = "owner" (server.ts:266, gesetzt 1959, persistiert 6557). Danach zeigt ihre Sidebar-Row nur
den normalen „kein Output"-Zustand. Nach dem Bau steht dort „⏸ wartet auf dich".
WERT: Das Feld existiert, ist persistiert, wird an den Steward geliefert (server.ts:7197) — und der Owner bekommt es nicht: die Slot-Projektion in /api/sessions (server.ts:8345-8356) führt id, cwd,
label, lastOutput, git, worktree, model, share, mergePending und kein awaiting; src/client.ts hat dafür null Leser (die 25 awaiting-Treffer dort sind alle awaiting-author/awaitingReview, ein
anderer Sachverhalt). Der Owner muss den Zusammenhang heute über das Queue-Overlay herstellen (dort greift qGroupOf → "needs" bei criterion.confirmedAt === null, src/client.ts:5243) und Task→Slot
im Kopf mappen. Der Zustand ist außerdem hart: handleStewardSend weist den Slot mit 409 ab, solange er gesetzt ist (server.ts:6994) — nur der Owner löst ihn.
SKIZZE: Ein Feld in der Slot-Projektion ergänzen, im Client als Badge in slotRow und in der identity-Zeile des Boards rendern, und awaiting in den Render-Key bei src/client.ts:4621 aufnehmen (sonst
friert es fest — genau der behind-Fehler, den der Kommentar dort dokumentiert). FILES: server.ts (eine Zeile Projektion), src/client.ts (Badge + Render-Key), e2e/ Lane-Signals-Familie. AUFWAND: S
REVERT: trivial. Slot.awaiting existiert und wird bereits geschrieben/gelesen — dieser Commit fügt nur einen Leser hinzu, es entsteht kein neues persistiertes Feld.
GEPRUEFT: Feldursprung und Projektion beide gelesen (Zeilen oben). Register: 9b565be8 baut ein NEUES Slot-Feld „nach dem Muster von awaiting" (Parkung) und nennt src/client.ts (Sichtbarkeit) —
angrenzend, nicht identisch; wer beides fährt, sollte dieselbe Badge-Stelle benutzen und muss serialisieren. 3d87f3e4 (Entscheidungs-Inbox) ist die aggregierte Sicht, das hier ist die Zeile am
Slot. §7 berührt es nicht.

PROVENIENZ: Ideen-Scout A (Lane fleet/260806222332-ef99, 2026-08-07), Block 2 — Vollreport beim Owner.
```

## `fedab7ae`  ·  kind=lane  ·  angelegt 2026-08-09 09:25  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
for some reason I can see old dead lanes under the main session and saying 'detached'
```
