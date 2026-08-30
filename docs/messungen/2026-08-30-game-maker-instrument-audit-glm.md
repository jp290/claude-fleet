---
frage: Welche Qualitätsbehauptungen des Game-Maker-Workflows können seine Instrumente strukturell nicht messen (Fall Private-repo-o, Build db6ed75)?
urteil: Sieben Behauptungen — Selbst-Spiel als Wahrnehmungsbeweis, Critic-Post-Play, unknown-Disziplin, Card-als-Vertrag, Berichts-Verify-Zeilen, Checkpoint-Prosa, Fahrgefühl ohne Frame-Time — sind durch die vorhandenen Instrumente unbelegbar; jede bekommt hier einen falsifizierbaren Ersatz-Check.
bereich: [game-maker, verify, product]
belege: [private-repo-o AGENTS.md#Game-Maker-MAIN, private-repo-o HANDOFF.md#Current-game-checkpoint, private-repo-o GAME-CARD.md#5, docs/product-studio-working-circle.md#The-Game-Maker-succession-checkpoint]
nicht-gemessen: der Build db6ed75 selbst (kein Start, kein Replay, kein Code gelesen); der objektive Zustand der Lenkrichtung; die Fleet-Server-Mechanik (abgedeckt in 2026-08-29-main-lane-lifecycle-gaps.md).
stand: 2026-08-30
---

# Instrumenten-Kritik am Game-Maker-Workflow am Fall Private-repo-o (2026-08-30)

Anlass: Owner-Urteil nach eigenem Spielen des Builds `db6ed75` — Lenkung links/rechts fühlte sich
vertauscht an, Fahrphysik unsauber, Grafik flach. Die bauende MAIN hatte denselben Build mehrfach
selbst gespielt (echte Tastatur, volle Runden, Drift, Captures) — die Lenkrichtung fiel ihr nie auf.
Der vorgesehene sensory Critic lief bis zum Owner-Spiel nie. Diese Notiz kritisiert die
**Instrumente** des Workflows, nicht das Spiel und nicht die Fleet-Server-Mechanik (letztere steht in
`docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md`, wird hier nicht dupliziert).

Quelldateien (fremdes Repo, absolut):
`/Users/owner/private-repo-o.worktrees/game-maker-private-repo-o-fresh/{AGENTS.md, HANDOFF.md, GAME-CARD.md}`.
Zeilenangaben `AGENTS/HANDOFF/GAME-CARD` beziehen sich auf diese Dateien, `studio` auf
`docs/product-studio-working-circle.md` dieses Repos.

## Kernbefund

Der Workflow macht sein Zentralversprechen — MAIN urteilt am gestarteten Build über Grafik, Kamera,
Fahrgefühl — mit einem Instrument, das **Kausalität** misst (Taste → Reaktion → Capture), aber
**Konvention, Handling-Qualität und Frustration** strukturell nicht messen kann. Der Lenkungsfall ist
kein Zufallsfehler, sondern die Vorhersage dieses Designs: Eine vollen Runde mit Drift ist unter
beiden Lenkmappungen fahrbar, also kann das Erfolgskriterium „Runde schließt sich" die falsche
Mapping nicht unterscheiden. Alle weiteren sechs Lücken sind Varianten desselben Musters: eine
Behauptung über *gefühlte* Qualität, beglichen mit einem Instrument für *technische* Faktizität.

## Die sieben Lücken, nach Fehlerkosten gerankt

### 1. Hoch — „MAIN spielt selbst" als Wahrnehmungsbeweis für Konvention und Fahrgefühl

**Behauptung:** „MAIN bewertet Grafik, Kamera, Figurenlesbarkeit, Animation und Fahrgefühl am
gestarteten Build selbst" (AGENTS 29–31); der Zyklus „spielen, bewegendes Bild ansehen, Produkturteil
festhalten" (AGENTS 54).

**Warum das Instrument sie nicht messen kann:** Ein Agent, der Tasten skriptet und Captures liest,
verifiziert eine Abbildung (Taste → Weltfolge), nie eine **Konvention** (ArrowRight muss das Kart
im Bild nach rechts tragen — ein private-repo-c-prior, den der Agent nicht mitbringt) und kein
**Handling** (propriozeptive Erwartung, wie sich Lenkung anfühlen sollte; Frustration als
Erwartungsdifferenz über Zeit). Die MAIN *adaptiert* innerhalb einer Runde an jedes Mapping —
Exhibit A: volle Runde 42,48 s mit Tausch, Drift, Item, Wurf (HANDOFF 4) ist mit vertauschter
Lenkung genauso fahrbar. Zusätzlich **Normalisierung**: der Auslauf driftete von 1,4 s (Card:
1,5 s) auf 3,0 s, und die MAIN erzählte den abgedrifteten Wert als Belohnung („die Kamera erreicht
das Kart also rollend", HANDOFF 4; „belohnt der Moment", HANDOFF 5) — wiederholtes Spielen macht den
Defekt zur Eigenschaft. Kein Test der Kette T1–T14 nagelt die Bildschirm-Drehrichtung fest; die
Capture-Fragen der Card (GAME-CARD 467–485) fragen Lesbarkeit, nie Richtung.

**Ersatz-Check:** Konventions-Pin — headless Playwright: ab Standstill, Seed fest, `ArrowRight`
1,5 s halten, Kart-Bildschirm-x-Delta > 0 px fordern (und `ArrowLeft` symmetrisch); ~1 h. Dazu ein
numerischer Feel-Proxy: identische 3-Runden-Input-Traces, je Runde Gier-Jitter- und
Gegenlenk-Zähler als Trend über Repair-Runden; ~2–3 h.

### 2. Hoch — Sensory Critic erst nach allen Repair-Runden; Owner-Taste faktisch ohne Critic

**Behauptung:** Der Critic ist „ein unabhängiger zweiter Blick auf denselben spielbaren Stand"
(AGENTS 30) und arbeitet „erst nach einem spielbaren Stand" (AGENTS 46); studio 303: „SENSORY
CRITIC IS POST-PLAY ONLY … operator-orchestrated".

**Warum das Instrument sie nicht messen kann:** Nichts im Workflow verknüpft den Critic-Verdikt mit
der Owner-Attention. Im Fall stand das Checkpoint-Feld bei „Critic: keiner. Jetzt der richtige
Zeitpunkt" (HANDOFF 8) — der „richtige Zeitpunkt" kam nach elf Repair-Runden, während die
Owner-Attention `e98c0c91…` offen stand und der Owner vorher spielte. Der eine Akteur mit
*fremden* Priors (frisches Modell, keine Adaptionshistorie, keine Hypothesen) wäre genau der, der
eine Konventionsverletzung als Fakt statt als Gefühl melden könnte — er wird per Reihenfolge hinter
den Moment sortiert, in dem seine Meldung Reparaturen noch hätte lenken können.

**Ersatz-Check:** Regeltext (0 h Implementierung): Owner-Taste-Attention darf erst gefilet werden,
wenn das Checkpoint-Feld `Critic:` einen Verdict trägt; Zeile ins Attention-Template. Maschinelle
Variante (Empfehlung, Fleet-seitig): beim Attention-File das `Critic:`-Feld validieren.

### 3. Hoch — „Fehlende Wahrnehmung ist unknown, nie pass": gelebtes Etikett ohne Auflöse-Instrument

**Behauptung:** AGENTS 58–59, HANDOFF 90 — fehlende Wahrnehmung ist `unknown`, nie `pass`.

**Warum das Instrument sie nicht messen kann:** Die Disziplin wird als Buchführung gelebt —
audio, `sensory_critic`, `owner_taste` bleiben unknown (HANDOFF 5), der Post-Land-Audit bleibt
unknown und wird ausdrücklich nicht gedeutet (HANDOFF 70–76): ehrlich. Aber im gesamten Lauf wurde
**keine einzige unknown-Zeile durch ein Instrument aufgelöst**; jede ist zum Schluss noch unknown,
und der Workflow lief mit stehenden Geschmacks-unknowns in die Owner-Attention. `unknown` ist ein
terminaler Zustand, keine Warteschlange: Die Regel verhindert Lüge, erzeugt aber keinen Druck zur
Messung. Genau diese Lücke macht Exhibit A möglich — `owner_taste: unknown` über Wochen, und die
erste Instanz, die es auflöst, ist der Owner selbst.

**Ersatz-Check:** unknown-Ledger als Checkpoint-Zusatzregel: jede unknown-Zeile benennt Instrument
und Trigger („audio → Hör-Capture beim nächsten Land"); eine unknown ohne Resolver blockiert
`Next: hold`. Auditierbar per grep über das Checkpoint; ~1 h Textregel.

### 4. Mittel-hoch — Die GAME-CARD als 1254-Zeilen-Vertrag, der gegen den Build verrottet

**Behauptung:** Die Card ist der byte-gepinnte Produktvertrag (Preflight-Receipt, HANDOFF:
gelandete Card „byte-identisch zum geprüften Text").

**Warum das Instrument sie nicht messen kann:** Die Card verrottete nachweislich während der
Repair-Runden — HANDOFF 6 nennt selbst: „GAME-CARD §1(a) widerlegt, §5 erklärt die Tausch-Physik
falsch, §10 behauptet 1,5 s Auslauf, und die Card kennt weder Fahrbahn-Bedingung des Drifts,
Zielbindung noch Ergebnisbild" (gemessen: 3,0 s, HANDOFF 4). Sie bettet ~170 Zeilen wörtlichen Code
ein (§11 `contract.ts`, GAME-CARD 593–761) und erwartete Testausgaben (GAME-CARD 964–972) —
Dokument-Code kann von keinem Breaker gehalten werden. Ein Byte-Pin beweist nur, dass der Text
unverändert ist, nicht dass er wahr bleibt: nach elf Reparaturen liest ein Nachfolger Falsches als
Vertrag. Instrument war die Card nur bis zum ersten Land; danach Ballast mit Autorität.

**Richtige Schnittgröße:** (i) eine Seite stabiles Produktversprechen (Produktsatz, Non-Goals,
Kernevents) bleibt Prosa; (ii) jede quantitative Behauptung wandert als benannter Breaker in
`bun run verify` (Auslauf-Fenster, Swap-Diff, Stabilitätsfenster — teils als T4/T5 vorhanden) und
*verschwindet* aus der Card; (iii) Tuning-Tabellen nur noch als `[ANNAHME]`-markierte Verweise auf
die echte Quelle in `src/`.

**Ersatz-Check:** Card-Liveness-Pin — Skript extrahiert quantitative Konstanten aus GAME-CARD
(Regex über Zahlen mit Einheit s/m/°/%) und verlangt zu jeder einen Manifest-Eintrag
`breaker:<id>` oder `taste`; ungemappte Konstante = rot; ~2–3 h.

### 5. Mittel — Handgetippte Verify-Zeilen in Berichten statt erzeugter Ausgaben

**Behauptung:** „Berichte sind Behauptungen … jeder Worker-Report wurde gegen die Lane
nachgeprüft" (HANDOFF, „Was diese Arbeit gelehrt hat") — Nachprüfung per Handsfahrt.

**Warum das Instrument sie nicht messen kann:** Die manuelle Nachprüfung ist das einzige
Instrument, und sie fing die falsche Zeile nur, weil Verdacht bestand: Der R6-Bericht behauptete
„--drift → Stufe 3 in allen sechs Kurven"; der bitgleiche Rerun zeigt Kurve B unverändert bei
Stufe 1/2 mit `maxLateral` 20,7 (HANDOFF 4). Die Codeänderung war sauber, die Berichtszeile falsch
— die Sonde druckte ein Aggregat, die Kurvenaussage wurde von Hand verallgemeinert. Eine
Berichtszeile, die niemand programmatisch erzeugt hat, ist unbelegbar und verdirbt genau die
Evidenzkette, die der Workflow „Beweis" nennt.

**Ersatz-Check:** Verify-Zeilen müssen zitierfähig erzeugt werden (wie T5s `SWAP-DIFF …
met=2/3 PASS`): Drift-Sonde druckt `curve=A..F stage=<n>` je Kurve; jede Zahl im Bericht ist dann
Kopie einer Zeile, die das Werkzeug schrieb; ~2 h.

### 6. Mittel — Checkpoint-Prosa als einziger Übergabekanal: Adjektive reisen als Fakten

**Behauptung:** „There is exactly one handover channel and it is the committed checkpoint" (studio
349), Shape-Spezifikation `Open defect: <one defect, or none>` (studio 338).

**Warum das Instrument sie nicht messen kann:** Prosa transportiert Urteile als Evidenz — „trägt
der Slice als Spiel" (HANDOFF 5) ist eine Owner-Klasse-Geschmacksaussage, die ein Nachfolger als
Fakt erbt; der Owner urteilte Tage später anders. Der Nachfolger-First-Act „replay" kann Seeds und
Inputs wiederholen, aber nicht „belohnt den Moment". Und die Kanal-Spezifikation selbst fault unter
realer Last: das `Open defect`-Feld hält fünf nummerierte Defekte (HANDOFF 6) gegen „one defect, or
none" — der eine Kanal verletzt schon heute seine eigene Form.

**Ersatz-Check:** Fakt/Urteil-Trennung im Checkpoint: Feldinhalte nur falsifizierbare Anker (Seed,
Input-Sequenz, erwartetes Observable — z. B. „seed 1, `ArrowRight` 2 s → Bildschirm-x-Delta > 0"),
Urteile ausdrücklich `[urteil]`-markiert; Anker als maschinenlesbare Fixture-Datei im Repo (kein
zweiter Prosa-Kanal, Teil des Builds) mit Replay-Assert; ~2–4 h.

### 7. Niedriger-mittel — Kein Frame-Time-Instrument: „Fahrphysik unsauber" ist nicht zerlegbar

**Behauptung:** MAIN beurteilt „Fahrgefühl" am gestarteten Build (AGENTS 29); eigene Regel:
„Headless rendert WebGL über SwiftShader: Bilder ja, Bildraten wertlos. Perf nur am sichtbaren
Fenster" (HANDOFF 88).

**Warum das Instrument sie nicht messen kann:** Das Owner-Urteil „Fahrphysik unsauber" mischt
Physik-Tuning und Frame-Pacing. Kein Lauf hat am sichtbaren Fenster Frame-Zeiten geloggt, headless
sind sie nach der eigenen Regel wertlos — die Hypothesen lassen sich also nicht evidenzbasiert
trennen; jede Reparatur wäre Raterei zwischen Sim-Parametern und Render-Pacing.

**Ersatz-Check:** Ein Lap je Repair-Runde mit Frame-Time-Trace am sichtbaren Fenster
(requestAnimationFrame-Delta, p95 und Jank-Zähler als JSON, Trend über Runden); ~2 h. Danach kann
„unsauber" als Tuning- oder Pacing-Problem *benannt* werden.

## Deckung: GELESEN / ABGELEITET / UNGEPRÜFT

**GELESEN:** private-repo-o `AGENTS.md` (ganz, 59 Z.); private-repo-o `HANDOFF.md` (ganz, 90 Z.);
private-repo-o `GAME-CARD.md` Struktur komplett, inhaltlich §0-Anfang, §1(a), §5, §7, §10, §11-Codeblock
(593–761), §13-Briefauszüge (964–972); `docs/product-studio-working-circle.md` nur die
game-maker-Stellen (52, 180, 204, 303–317, 322–360); `docs/messungen/2026-08-29-main-lane-lifecycle-gaps.md`
nur Befund-Überschriften (nicht dupliziert).

**ABGELEITET:** das Owner-Urteil selbst („Lenkung vertauscht, Fahrphysik unsauber, Grafik flach")
stammt aus dem Aufgabenbrief, nicht aus selbst gelesener Attention `e98c0c91…`; die Aussage
„Critic lief nie" ebenso. Das Auslauf-Dreieck 1,4/1,5/3,0 s folgt aus HANDOFF 4 + GAME-CARD §10.

**UNGEPRÜFT:** ob die Lenkung in `db6ed75` objektiv invertiert ist (weder Build gestartet noch
`src/` gelesen) — für Lücke 1 irrelevant und dort so gesagt: das Instrument kann *beide* Zustände
nicht unterscheiden; die R6-Worker-Lane selbst; die "42,48 s"-Runde nur als HANDOFF-Zitat; alle
Fleet-Routen.

## Messgrenzen

Diese Notiz liest Dokumente, misst kein Verhalten. Die Kostenschätzungen sind Grobordnung
(Agenten-Zeit), nicht kalkuliert. Die Ranking-Skala „Fehlerkosten" bewertet entgangene
Owner-sichtbare Qualität pro Lücke im Fallverlauf, nicht generelle Wahrscheinlichkeit.
