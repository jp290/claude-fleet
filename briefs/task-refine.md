# Task-Refine — der Brief-Kompiler auf der Queue (WHAT-Festlegung, noch kein Bau)

*2026-08-05, aus der Sharpen-Analyse dieser Session. Evidenzbasis: Memory
`project-sharpen-usage-model.md` (Fleet-Memory), `~/.claude/knowledge/sharpen-corpus/model.md`
(§Boundary condition), `~/.claude/knowledge/brief-principle.md`. Kurzform der Messung: Prompt-
Kompilierung zahlt an Frisch-Kontext-Grenzen (rohe Task → frische Lane) und kippt mid-session
auf starken Modellen in Contract-Inflation. Die Queue ist die Frisch-Kontext-Grenze mit
Maschinerie dahinter — dieser Job ist die Brief-Schreibarbeit, die heute nur von Hand passiert
(`briefs/*.md` der gelungenen Lanes), mechanisiert.*

## Was der Job ist

Ein read-only Compile-Worker, der eine rohe Queue-Task in das verwandelt, was ein Mensch als
Brief schreiben würde: Dateien-zuerst-lesen, Done-Kriterium, Verify-Weg — und wenn die Task in
Wahrheit mehrere Tasks ist, eine Zerlegung in sauber geschnittene Einzel-Tasks. Erstfall:
`2e9ed996` (Terminal — Farbe ist gelandet, Scrollback und „robust" sind zwei offene Scheiben).

**Nicht** der Skill nochmal: /sharpen3 läuft weiterhin in der Lane (sighted, dosiert
Disziplin). Dieser Job ist die Stufe davor — Zerpflückung + Verankerung am Repo, bevor
irgendeine Session existiert.

## Bauform des Worker-Prompts (Owner-Vorgabe 2026-08-05, wörtlich verankert)

Der Prompt lässt den Worker **eine Reihe implizit relevanter Fragen INTERN/STUMM beantworten,
bevor das Ergebnis gefordert wird** — keine sichtbare Checkliste, kein Frage-Theater. Die
stummen Fragen (im Prompt als solche markiert, Antworten erscheinen NIE im Output):

- Welche Dateien/Mechanismen trägt diese Task wirklich? (nur nennen, was selbst gelistet oder
  gelesen wurde — die eine gemessene Fehlerklasse der starken Sharpen-Fälle war ein
  halluzinierter Pfad)
- Was heißt fertig, und mit welchem Kommando ist es prüfbar?
- Ist das EINE Task oder mehrere? Wo ist der Schnitt, der Kollisionen vermeidet?
- Was weiß der Owner, das eine frische Lane nicht weiß — und gehört es in den Text?

Drei Kontrakt-Klauseln, alle deterministisch pinnbar:

1. **Triage zuerst:** Input, der schon brief-förmig ist (Dateien + Done-Kriterium vorhanden,
   Muster: die LIES-ZUERST-Tasks), geht UNVERÄNDERT zurück — `{unchanged: true}`. Das ist die
   Anti-Overthink-Klausel (Corpus-Randbedingung: „no gap → idles").
2. **Nur verifizierte Pfade:** jeder genannte Pfad muss aus eigenem `ls`/`Read`/`Glob` stammen.
3. **Facts, never diagnoses** (derselbe Guard wie ✨/Pulse): der Worker sieht Repo-Stand, nie
   die Ursache eines Problems — er erfindet keine Diagnose und keine Arbeitsanweisung, die
   nicht in der Task angelegt ist. Intent des Owners bleibt wörtlich erhalten (additiv-only
   wie `enhance-prompt.ts`, aber mit Sicht).

## Mechanik

- **Worker:** `runWorker`-Maschinerie, neuer `WORKER_CONTRACTS`-Eintrag (`refine`) in
  `src/protocol.ts` mit eigenem Mark. Tools: `REVIEW_TOOLS` (read-only, wie der Eval-Richter)
  — NICHT `TEXT_ONLY_TOOLS`, die Sicht IST der gemessene Mehrwert. Modell:
  `FLEET_REFINE_MODEL`, default `claude-opus-5`. Task-Text im Prompt defused
  (`defuseDelimiters`) in einer DATA-Fence — Queue-Text ist attacker-reachable (Intake).
- **Output (STRICT JSON):** entweder `{unchanged: true, reason}` oder
  `{tasks: [{text, doneCriterion, verify, files: [...]}, …]}` mit 1..N Einträgen (N ≤ 4,
  Deckel im Server, nicht dem Modell überlassen). Ein Eintrag = verfeinerte Fassung; mehrere
  = Zerlegung.
- **Route (attended, v1 die einzige):** `POST /api/tasks/:id/refine` (Owner-Token; nur auf
  `pending`/`queued`, sonst 409). Läuft async wie ⏫ (Worker kann Minuten brauchen); Ergebnis
  landet als **Proposal auf der Row** (`task.refine = {at, proposal}`), die Task selbst bleibt
  byte-identisch. Client: „↻ refine"-Knopf im Queue-Detail, Proposal-Ansicht darunter.
- **Promote (der Owner-Akt):** `POST /api/tasks/:id/refine-confirm` → Kinder werden als neue
  Rows angelegt (`kind:"lane"`, `source:"owner"`, `repo` geerbt, **ohne** Eval-Verdict — sie
  durchlaufen den Sweep frisch, Verdict-ist-final bleibt intakt), Original →
  `status:"archived"` mit Note `refined → <ids>`. Ablehnen = Proposal verwerfen
  (`refine` wird geräumt), nichts sonst passiert. Propose/promote wie beim Criterion: der
  Produzent schreibt nie selbst den Anker, an dem gemessen wird.
- **Fail-closed:** jeder Worker-Fehler (Timeout, kein JSON, Cap gerissen) → Row unverändert +
  `note`, nie ein halbes Proposal.

## Bewusst NICHT in v1

- **Kein Auto-Tick.** Kandidat für v2: Auto-Refine auf `eval:review`-Tasks (review = „zu vage
  für unbeaufsichtigten Spawn" — exakt die Bedingung, die dieser Job behebt). Erst attended
  Erfahrung sammeln — dieselbe Reihenfolge wie beim Eval-Gate.
- **Dispatch-Pfad unangetastet.** `runEnhance` am Dispatch bleibt wie er ist; ob ein
  refined-Kind den Dispatch-Compile überspringt (Doppel-Kompilierung), ist eine offene Frage
  unten.
- **✨-Knopf unangetastet** (mechanisch intakt, Kontrakt bewusst klein — Live-Probe 2026-08-05:
  HTTP 200 in 7 s). **`sharpen3.md` unangetastet** (Skill-Änderung = eigener Owner-Entscheid;
  der Ein-Zeilen-Fix „Steuerungssignal ≠ Arbeitsauftrag" liegt als Vorschlag im Chat).

## e2e-Pins (deterministisch, gegen den gebauten String / die Route)

Prompt-Invarianten (Muster `fleet-e2e.ts` ✨-Checks): Mark vorhanden; Task-Text defused in der
Fence; Triage-Klausel wörtlich; Nur-verifizierte-Pfade-Klausel wörtlich; Stumme-Fragen-Klausel
verlangt ausdrücklich, dass die Antworten NICHT im Output erscheinen; keine Diagnose-Erlaubnis.
Routen-Pins: refine mutiert die Task nie (byte-gleicher Text nach Proposal); confirm erzeugt
Kinder ohne Eval-Verdict + archiviert das Original mit Verweis-Note; refine auf `done`/
`archived` → 409; Worker-Fehler → Row unverändert + Note; Kinder-Cap greift serverseitig;
Pre-Auth-Pin für beide neuen Routen (`e2e/security.ts` §1 fängt sie ohnehin).

## Offene Fragen an den Owner (vor dem Bau entscheiden)

1. Confirm **all-or-nothing** oder pro Kind einzeln? (Vorschlag: all-or-nothing, v1 simpel.)
2. Überspringt ein refined-Kind den Dispatch-`runEnhance`? (Vorschlag: ja — Marker auf der
   Row; Doppel-Compile kostet und kann nur verwässern. Der ` /sharpen3`-Suffix bleibt.)
3. Zählt ein Refine-Lauf gegen ein Tagesbudget wie `FLEET_EVAL_MAX_AUTO_PER_DAY`? (v1: nein —
   attended-only, der Knopf IST das Budget.)
