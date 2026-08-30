---
frage: Zwei Owner-Hypothesen zum Private-repo-o-Lauf — (1) „die Sessions haben trotz vollem Kontext weitergearbeitet", (2) „wichtige Aufträge an andere Modelle als Opus hätten es besser gemacht"?
urteil: (1) Am 83-%-Kliff gemessen nein (Maximum 44,7 % von 1M, null Kompaktierungen) — aber am maßgeblichen Owner-Band 25/30 % BESTÄTIGT mit Einschränkung; 10 von 13 Sessions arbeiteten jenseits von 25 %, 4 von 5 datierbaren Defekt-Akten lagen darüber, und die frische MAIN fuhr bei 18 % sofort die Runde, die die alte bei 35–38 % neun Stunden nicht fuhr. (2) Für die Defekte nein — der Konventions-Blindfleck war familienübergreifend (Opus, Sonnet, GLM), der Hebel ist das Instrument; für Kapazität schwaches Ja (B3/Sonnet-Parität bei einem Viertel der Kontextlast, n=1). Konsequenz promotet: Agenten kennen ihren Füllstand selbst und entscheiden dynamisch (AGENTS.md §Context self-management); Sensor-Lücke als Task 051cc1c2 abgelegt.
bereich: [game-maker, lane-lifecycle, verify, kontext]
belege: [lane-outcomes.jsonl Z.609–630, context-receipts.jsonl, ~/.claude/projects-Transcripts der 13 Sessions, docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md]
nicht-gemessen: pi-zai-Reviewer (Adapter ohne Sensorik); Kausalität Füllstand→Defekt (n=5, Basisrate konfundiert: späte Akte liegen in monoton wachsenden Sessions immer hoch); Sonnet auf Sim-Mathematik oder B2-Größe; Codex-Rollouts des Workflow-Aufbaus (3 unter ~/.codex/sessions/2026/08/29/, nicht ausgewertet).
stand: 2026-08-30
---

# Worktrail-Audit Stufe 2 — Kontext-Sättigung und Modell-Mix (Fall Private-repo-o)

Stufe 1 (Synthese vom selben Tag) hatte gezeigt: nach den Aufträgen wurde sauber gebaut. Stufe 2
prüft die Arbeitsspuren selbst: die überlebenden Session-Transcripts unter `~/.claude/projects/`
(usage-Felder je assistant-Turn, Extraktion per Skript, nie wholesale gelesen) und die Ledger.
13 von 14 Sessions des Laufs waren messbar; die pi-zai-Reviewer-Lane hat kein Claude-Transcript.

## Teil 1 — Kontext-Sättigung: zwei Schwellen, zwei Urteile

**Gegen das 83-%-Kompaktierungs-Kliff (Verlustgrenze der Harness):** keine Session kam ihm je
näher als ~12 Punkte. Opus-Maximum 44,7 % von 1M (B2), Sonnet-Maximum 70,6 % von 200k (B3); null
Turns über 80 %, null Compact-Marker in allen 13 Transcripts. Fensterbestimmung gegengeprobt: die
neue MAIN maß 412 816 Tokens = 41,3 % von 1M bei Footer-Anzeige 40 %.

**Gegen das Owner-Band 25/30 % (die Qualitätsgrenze; Owner-Entscheid 2026-08-21, am 2026-08-30
bestätigt: „die Qualität der Responses nimmt bei 25 % ziemlich rapide ab"): BESTÄTIGT mit
Einschränkung.** Der Neuschnitt derselben Rohdaten:

- **10 von 13 Sessions arbeiteten jenseits von 25 %** (nur Card, R1, R5 blieben darunter),
  zusammen ~18,5 h Wanduhrzeit oberhalb des Bandes — MAIN alt 232 min, MAIN neu 431 min.
- Die **alte MAIN riss das Band um 19:05** (Turn 220/420). Alles ab dem B4-Land, das gesamte
  R1/R2-Briefing (21:21–22:07 bei 35–37 %) und das Übergabe-Geständnis „Runde noch ungefahren"
  (cc5720e, 38,2 %) geschahen 10–13 Punkte darüber.
- Von den **fünf datierbaren Defekt-Akten liegen vier über dem Band**: B2-Renderer-Arbeit
  (Spiegelung + Kantenlinien-Phase) ab 32,9 %, R6s falsche Berichtszeile bei 37,2 %, die
  R1/R2-Lands bei 35–37 %, das Geständnis bei 38,2 %. Nur B1s Konventions-Festlegung (der
  Ursprung der Lenk-Naht) lag mit 10,7 % klar darunter.
- **Der sauberste Einzelindiz-Kontrafakt:** die frische Nachfolge-MAIN fuhr um 23:12 bei 18,1 %
  sofort die volle Runde, die die alte bei 35–38 % über Stunden nicht gefahren hatte (n=1).
- **Einschränkung, ehrlich:** n=5 Defekt-Akte, und die Basisrate ist konfundiert — ~50 % aller
  Turns des Laufs lagen über 25 %, und Defekt-Akte sind naturgemäß späte Akte (Reports, Lands,
  Übergaben), die in monoton wachsenden Sessions immer hoch liegen. Korrelation sichtbar,
  Kausalität aus diesen Daten nicht beweisbar.
- **Der Fenster-Befund, der die dynamische Regel erzwingt:** B3 (Sonnet, 200k) verbrachte 100 %
  ihrer Laufzeit über dem Band — der ~44k-Gründungsbrief allein füllt ein 200k-Fenster auf ~27 %.
  Eine starre Prozentschwelle ist über Fenstergrößen hinweg bedeutungslos; nur die
  Selbsteinschätzung je Auftrag trägt.

## Teil 2 — Modell-Mix: Instrumentenhebel, nicht Modellhebel (für die Defekte)

- **Der teuerste Defekt war familienübergreifend blind:** die Lenk-Spiegelung überlebte Opus
  (B1/B2/B4/R1–R6 + beide MAINs), Sonnet (B3, vertragskonform, aber blind für die Naht) und GLM
  (der Reviewer winkte die einzige normative Richtungszeile GAME-CARD:603 ungeprüft durch). Drei
  Familien, null Treffer. Der Drift-Defekt (R1) ist strukturell derselbe Typ: ungeprüfte
  Konvention an einer Bausteinnaht. Was das adressiert, ist der Konventions-Pin (seit heute
  Pflicht-Breaker, V1) und Critic-nach-PLAYABLE (V2) — keine Modellwahl.
- **Das B3-Experiment (n=1, konfundiert — kleinster Auftrag ans kleinste Modell):** Sonnet
  lieferte den Input/HUD-Baustein vertragskonform, ohne zugeordneten Defekt, bei 474 KB
  Kontextlast gegen 1,83 MB des parallelen Opus-B2 in gleicher Wanduhrzeit. Die R1-Nacharbeit an
  B3-Dateien wurzelt laut Commit-Body `f471804` in B1s Sim-Konvention, nicht in B3. Trägt:
  „Sonnet reicht für eng gebriefte, vertragsgebundene Bausteine" — nicht mehr.
- **Der eigentliche Kontexthebel ist Lesedisziplin, nicht Modellwahl:** die Kontextlast-Spitzen
  bestehen zu >90 % aus Read-Bytes (R4: 3,49 von 3,77 MB; R6: 3,24 von 3,49 MB; B2: 1,64 von
  1,83 MB).
- **Der einzige Berichtsdefekt des Laufs (R6s handverallgemeinerte Verify-Zeile) kam aus dem
  stärksten Modell** — gefangen von der MAIN-Gegenmessung, einem Instrument.
- **Empfehlung nächster Lauf** (je Zelle Beleg oder „ungemessen"): Card-Draft Opus[1m] (trug;
  kleiner ungemessen) · Cross-Family-Review GLM als Pflichtakt nach erstem PLAYABLE (gemessen
  wertvoll fürs Design, kein Pin-Ersatz; nicht automatable, kein Kontextsensor) · Sim-Mathematik
  Opus behalten (Messreihen-Commit-Bodies wie `f471804` sind das Qualitätsmerkmal) · Input/HUD
  eng gebrieft Sonnet (n=1-Parität) · Renderer-Reparatur als **A/B-Paar Opus/Sonnet testen** ·
  Wegwerf-Messarbeit codex-spark headless (0 Akte in diesem Lauf — genau die Klasse, deren
  Read-Bytes die Opus-Lanes aufblähten) · GPT-258k-Lanes nie ohne Tool-Disziplin-Brief (R4s
  3,77 MB ≈ ~940k Tokens wären das 3,6-fache des Fensters).
- **Kostenbild:** Wanduhr-Gewinn durch Modellwahl ≈ 0 (die 10h10m Verlust waren Türen/Timer);
  verlagerbares Opus-Kontextvolumen bei bestätigter Sonnet-Parität ~55 % (8,3 von 15,8 MB);
  Fehlerkosten-Gewinn 0 — den Lenk-Bug hätte kein Mix verhindert.

## Konsequenz, gezogen am selben Tag (Owner-Entscheid: „die Agenten sollen das selbst wissen +
## merken und dynamisch je nach Auftrag entscheiden")

1. **AGENTS.md §Context self-management** (portabler Vertrag, laden alle Harnesses): Füllstand
   kennen ist Agentenpflicht; ~25 % ist die gemessene Qualitätsgrenze, das Kliff nur die
   Verlustgrenze; Entscheidung dynamisch je Auftrag, sichtbar begründet — kurze laufende Akte
   dürfen enden, neue Tiefenarbeit jenseits des Bandes wandert in frischen Agenten/Übergabe.
2. **Sensor-Lücke als Task `051cc1c2`** (pending): `GET /api/self` trägt kein `ctx` — eine
   Session kann sich heute nicht mit dem eigenen Token messen; die Zeile trägt Done-Kriterium
   und Verify-Weg.
3. Die Beobachtung traf während des Audits auch die auditierende Controller-Session (gemessen
   30,9 %) — Kette geschlossen, Handoff gefahren; als Feedback-Memory gesichert.

## Messgrenzen

Turn-Füllstände sind Summen der usage-Felder (input + cache_read + cache_creation) je
assistant-Turn; die Zuordnung Lane↔Rolle lief über mainAfter-SHAs und Land-Zeitstempel gegen
`git log` (kommitgenau). Dauern aus Receipt→Ledger enthalten Land-Wartezeit (Obergrenzen).
Kostenschätzungen sind Größenordnungen mit genanntem Rechenweg, keine Kalkulation.
