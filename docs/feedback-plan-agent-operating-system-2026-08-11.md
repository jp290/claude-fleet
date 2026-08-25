# Feedback: Schlachtplan "Agent Operating System" (2026-08-11)

*Kritische Evaluation von `docs/plan-agent-operating-system-2026-08-11.md`. Geprueft wurde: der
Plan selbst vollstaendig, Existenz aller referenzierten Dateien (`src/protocol.ts`,
`docs/plan-queue-refinement-2026-08-11.md`, `refine-prompt.ts`, `analysis-prompt.ts`,
`docs/lane-brief-template.md` — alle vorhanden), Bytegroessen (`AGENTS.md` 5 534 B, privates
`CLAUDE.md` 98 663 B) sowie das Regelbuch. NICHT geprueft: die Ledger-Schemas gegen den Code
(Schicht D behauptet Luecken, die plausibel, aber hier nicht nachgemessen sind).*

## Gesamturteil

Der Plan ist ungewoehnlich diszipliniert: Gates statt Freigabe, propose/promote durchgaengig,
ehrliche Metrik-Verbote (§9.3), ein Risikoregister mit Fruehsignalen, File-Ownership vor Fan-out,
und er respektiert die bestehende Doktrin (keine zweite Queue, kein zweiter Wissensspeicher,
Vorrang des Queue-Refinement-Plans). Die Phase-0-Worker-Briefs erfuellen die eigene
Briefing-Disziplin (eigene Datei, Done, Verbote, Output-Form). Als Programm-Rahmen ist er
tragfaehig.

Die Kritik unten ist gerankt. Die ersten drei Punkte sind die, die das Programm real scheitern
lassen koennen; der Rest ist Korrektur im Detail.

## Befunde, gerankt

### 1. Der Owner ist der ungebudgetierte Engpass — und der Plan misst ihn nirgends

Jede Phase endet an einem Owner-Gate, Phase 4 verlangt Owner-Adjudikation **jeder einzelnen
Klassifikation** (Schicht E Schritt 3), Phase 3 will Context-Plaene "vor Dispatch bestaetigbar"
(P3-D), dazu acht Owner-Entscheide in §12. Der Plan budgetiert Agent-Tokens, Kontextbytes und
Review-Diffs — aber nie Owner-Minuten. Das ist genau die Groesse, die er selbst als primaeres Ziel
nennt ("menschliche Entscheidbarkeit", §2). Kosten, wenn unadressiert: die Gates werden zum Stau,
der Owner winkt durch (dann ist die Adjudikation Theater, und die "Auto-Wahrheit"-Schutzmauer aus
Regel 3.2 faellt de facto), oder das Programm bleibt in Phase 0 stehen.
**Empfehlung:** Pro Gate eine geschaetzte Owner-Zeit in den Plan schreiben; Phase-4-Adjudikation
als Batch-Flaeche mit Sampling entwerfen (der Owner urteilt ueber eine Stichprobe, nicht jede Row),
und das im P4-C-Schnitt von Anfang an so benennen.

### 2. Die Byte-Senkung optimiert nachweislich den kleineren Hebel

§9.2 setzt als Zielhypothese "P50 always-loaded Bytes −50 % bei Codex/pi". Die eigene Messung im
Regelbuch (GPT-Lane-Absatz, 2026-08-08) sagt aber: 96 % des Verbrauchs sind Input aus
Gespraechsverlauf und **Tool-Ausgaben** (ein Einzel-Turn 77 804 Tokens), waehrend das komplette
private Regelbuch ~20 000 Tokens ≈ 8 % des Codex-Fensters kostet — und Codex/pi laden es heute gar
nicht automatisch, sondern nur `AGENTS.md` (~1 400 Tokens). Die 50-%-Senkung des Always-loaded
spart also einstellige Prozente des realen Fensters, waehrend der gemessene Fressfeind
(Tool-Output-Disziplin: Logs in Dateien, Tail lesen, Zeilenbereiche statt Dateien) im Plan nur als
Brief-Checkliste existiert, nicht als Messgroesse. Kosten: Phase 1+3 (Rulebook-Split, Packs,
Compiler) sind der teuerste Teil des Backbones und koennten an einer Metrik gemessen werden, die
auch bei vollem Erfolg wenig bewegt.
**Empfehlung:** `Prompt-/Tool-Result-Footprint je vergleichbarer Lane` (steht schon in §9.1 als
Baseline!) zur **primaeren** Kontextmetrik machen; die Pack-/Router-Arbeit rechtfertigt sich dann
ueber Routing-Korrektheit (richtige Regeln zur richtigen Task) statt ueber Bytes.

### 3. Die Baseline (§9.1) setzt Daten voraus, die erst Phase 2/4 erzeugen — teilweise zirkulaer

"Owner-Korrekturen, Stop-early, No-verify, Scope-Ausweitung" werden heute nirgends als Felder
gefuehrt (genau das sagt Luecke 4.2.4/4.2.5 selbst). Die Baseline vor dem ersten Bau zu erheben
heisst also: einen manuellen Learning-Run im Stil von Phase 4 **vor** Phase 1 fahren — das ist
ehrlich, steht aber nirgends als eigener Aufwand, und die Gefahr ist, dass die Baseline still auf
"was sich billig zaehlen laesst" schrumpft und die 20-Lanes-Vergleiche von G1/G3 dann keinen
Vergleichspunkt haben.
**Empfehlung:** Baseline explizit als Phase-0.5-Paket mit eigenem Worker/Brief schneiden (read-only,
Stichprobe von N Lanes rueckwirkend von Hand klassifiziert), oder die Erfolgskriterien, die eine
nicht existierende Baseline brauchen, ehrlich auf "ab Phase 2 vorwaerts messbar" umdatieren.

### 4. 20 vergleichbare Lanes als Gate-Population ist bei realem Durchsatz eine Wochen-Frist

Max. zwei Produktionslanes gleichzeitig (§11, letzte Zeile), serielles Landen, und
"vergleichbar" heisst nach eigener Definition gleiche Taskklasse/Harness/Modell — die
Schnittmenge fuellt sich langsam. G1s "Korrekturrate steigt nicht ueber 20 vergleichbare Lanes"
kann Monate offen bleiben; die vorhersehbare Reaktion ist, das Gate zu waiven, und ein regelmaessig
gewaivtes Gate erzieht das Programm zum Gate-Ignorieren.
**Empfehlung:** N pro Gate senken (z. B. 10) **oder** eine Zeitbox nennen, nach der das Gate mit
`insufficient-evidence` + Owner-Entscheid passierbar ist — der Zustand existiert im Vokabular des
Plans bereits, er muss nur an den Gates erlaubt sein.

### 5. Phase-1-Reihenfolge: der riskanteste, am schwersten reversible Schritt steht am Anfang

P1-C (privates `CLAUDE.md` vom Buch zum Overlay/Router umbauen, "verschieben, nicht kopieren")
ist der einzige Schritt des Backbones, der etwas Bewaehrtes zerlegt. Das Regelbuch ist zugleich
das dichteste Incident-Archiv des Repos; jede Regel dort ist teuer bezahlt, und der Plan selbst
listet "Regelzerlegung verliert kritischen Kontext" als Risiko — legt den Schritt aber vor jede
Wirkungsmessung. P1-D (Boot-Matrix: wer laedt was wirklich) ist dagegen billig, read-only und
koennte ergeben, dass der Split fuer Codex/pi wenig aendert (sie laden heute ohnehin nur
`AGENTS.md`).
**Empfehlung:** P1-D **vor** P1-C ziehen und P1-C an einen Befund der Matrix koppeln. Zusaetzlich
fehlt P1-C ein Canary-Kriterium: woran erkennt man binnen Tagen, dass geroutete Regeln nicht mehr
ankommen? (Vorschlag: 2–3 bekannte Fallen aus dem Regelbuch als Probe-Fragen an eine frische Lane,
vor und nach dem Split.)

### 6. Context-Packs mit Anchors in eine ungoverte Datei koennen nicht ehrlich gehasht werden

Schicht B will `paths/anchors` + Hashes pro Pack, auch auf das private Overlay. `CLAUDE.md` ist
gitignored, wird pro Lane als Spawn-Zeit-Snapshot kopiert und driftet (eigene Doktrin:
`docs/ungoverned-artifacts.md`, `rulebookDrifted`-Route). Ein Hash auf eine Datei ohne Historie
sagt nur "hat sich geaendert", nie "auf welche Fassung" — die Provenienz-Behauptung von G2 ("exakte
Kontextfassung zurechenbar") ist fuer den privaten Teil damit strukturell schwaecher als der Satz
klingt.
**Empfehlung:** Entweder das private Overlay bekommt eine eigene lokale Versionierung (privates
Git-Repo oder append-only Fassungs-Log), oder G2 sagt ehrlich: private Packs tragen nur
Content-Hash + Zeitstempel, keine aufloesbare Fassung.

### 7. Der Rulebook-Split in ein oeffentliches Repo braucht ein eigenes Redaktions-Gate

§10.7 verbietet Identitaeten im getrackten Baum, aber P1-A/P1-C ("thematische, oeffentlich
tragbare Regeln in getrackte Module") ist genau der Schritt, der massenhaft Text aus dem privaten
Buch in den public Baum bewegt — inklusive Incident-Erzaehlungen, die Betriebsdetails tragen. Der
bestehende Check gegen die Deploy-Identitaets-Muster aus CLAUDE.md §Deploy faengt nur die zwei
bekannten Literale.
**Empfehlung:** Der P1-C-Schnitt bekommt als Teil seines Done-Kriteriums einen Redaktionsdurchlauf
(zweites Augenpaar/Worker read-only ueber den Diff, explizit auf Betriebs-/Identitaetsdetails), und
die Grep-Liste wird vor dem Split um die Kategorien erweitert, die der Split beruehrt.

### 8. Kleinere Punkte

- **Doc-Rot des Plans selbst:** §14 (Statusblock) ist die richtige Antwort auf das
  Backlog-2026-07-Problem, aber Erfahrung hier zeigt: bei Widerspruch gilt der Code. Der Plan
  sollte den Satz selbst tragen ("bei Widerspruch zwischen diesem Dokument und Code/Ledger gilt
  letzteres"), damit eine uebernehmende Session nicht auf einen veralteten Statusblock baut.
- **Zwei Grossplaene gleichzeitig:** Die Abhaengigkeit zum Queue-Refinement-Plan ist sauber
  benannt (§8), aber beide konkurrieren um dieselbe knappe Ressource aus Befund 1. Es fehlt eine
  Aussage, welcher Plan bei Konflikt um Owner-Aufmerksamkeit zurückstehen soll.
- **Phase 0 erzeugt vier weitere grosse Dokumente** in ein Repo, dessen Register-Problem gerade
  erst mit `register.sh` mechanisiert wurde. `docs/triage/` existiert bereits mit ~9 Dateien.
  Empfehlung: die vier Inventare tragen von Geburt an ein Ablaufdatum/Attic-Kriterium ("nach G0
  ist die Synthese die Wahrheit, die Inventare wandern ins Attic").
- **`taskClass` (P2-D) ist untertheoretisiert:** Faire Modellvergleiche haengen komplett an
  dieser Klassifikation, aber wer sie vergibt (Modell? Owner? Heuristik aus Files/Diff-Groesse?)
  steht nirgends — dieselbe propose/promote-Frage wie bei den Failure-Klassen, nur unbenannt.
- **Positiv, ausdruecklich:** §9.3 (verbotene Erfolgsmetriken) und Regel 3.10 ("der Lernloop misst
  sich selbst") sind der staerkste Teil des Plans; ebenso, dass Scheduling/Automatisierung hart
  ans Ende gelegt ist (Phase 8, "niemals autonom Rulebook/Land/Deploy").

## Empfohlene konkrete Aenderungen am Plan (kleinster Satz)

1. Owner-Zeitbudget je Gate ergaenzen; P4-Adjudikation als Sampling entwerfen (Befund 1).
2. Primaere Kontextmetrik auf Tool-/Prompt-Footprint je Lane umstellen; Byte-Senkung zur
   Sekundaermetrik degradieren (Befund 2).
3. Baseline als eigenes Phase-0.5-Paket schneiden oder Erfolgskriterien umdatieren (Befund 3).
4. Gates mit `insufficient-evidence`-Ausgang + Zeitbox versehen (Befund 4).
5. P1-D vor P1-C; P1-C bekommt Canary-Kriterium und Redaktions-Gate (Befunde 5+7).
6. G2-Formulierung fuer private Packs ehrlich abschwaechen oder privates Overlay versionieren
   (Befund 6).

Nichts davon aendert die Architektur der sieben Schichten — sie ist schluessig. Die Befunde
betreffen Reihenfolge, Messbarkeit und den unbudgetierten Menschen im Loop.
