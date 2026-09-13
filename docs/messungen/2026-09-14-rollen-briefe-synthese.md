---
frage: Was aus den zwei unabhaengigen Entwuerfen (Fable-Lane, Astra-Lane; gleicher Brief, Gliederung §1–§8, gegenseitiges Leseverbot) zu Rollen, Briefen und Gueteklassen ist belastbar, wo widersprechen sie sich und wer hat am Repo recht, und welche eine Fassung je Entwurf soll der Owner promovieren?
urteil: Beide tragen dieselbe Achse (Brief ist nicht der Start-Hebel, Render und Erdung sind es; zwei Datensaetze mit einem Schluessel; Sub-Agents nur read-only und gebrieft) — das ist belastbar. Die Widersprueche sind klein und am Repo entscheidbar: Fable irrt bei `attention` (steht in `server.ts#RAIL_TAIL`), beim Staffelstab (`FLEET_MIGRATE_PCT` ist 32, nicht 0) und zitiert das ueberholte K1 (151 k/<120 k statt 134 k/<115 k); Astra hat recht mit dem veralteten Astra-Baustein R3 und `GET /api/self/notes`. Beide ueberladen das Filing-Format mit Zeilen, die `card-extract.ts#parseFormattedCard` heute als Prosa liest — das ist der erste Bauschritt, den keiner benennt. Empfohlen: Fables Formen (JSON-Register, Sechs-Block-Rollenkarte, englischer AGENTS-Absatz, kurzer Kopf) mit Astras Semantik (Klasse = Job-Familie mit Qualifikation und Version, Harness ist Attribut; eigene `KLASSE:`-Zeile statt ROLLE-Ueberladung; Delegation strikt read-only). Vier Schnitte, Schnittlinie vor Provider-Profil, `tools.deny` und schreibender Delegation.
bereich: [rollen, briefs, rulebook, modellklassen, sub-agents, kontext, synthese]
belege: [docs/messungen/2026-09-14-rollen-briefe-modellklassen-fable.md, docs/messungen/2026-09-14-rollen-briefe-modellklassen-astra.md, docs/messungen/2026-09-14-lane-startkontext-fixkosten.md §Ergebnis, docs/plan-fleet-betrieb-2026-09-13.md §4 K1, docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md §2.2 §2.3, docs/messungen/2026-09-13-lane-kontext-sub-worker-glm.md §2.1 §4, docs/messungen/2026-09-13-task-aggregation-a-e-fable.md §A, docs/astra-briefbaustein-2026-09-07.md R3 §NICHT verifiziert, docs/lane-brief-template.md §Norms, AGENTS.md §Role contract §Hard invariants §Filing a queue row §Context self-management §Reporting, SYSTEM.md §Kontextschichten §Wissensordnung, rulebook.ts#FRAGMENTS_FOR, card-extract.ts#FORMAT_KEYS #parseFormattedCard #validateCard, wave-brief.ts#CARD_HEAD_MAX_BYTES #klasse, server.ts#RAIL_HEAD #RAIL_TAIL #railBlockFor #buildProgramMainBrief #buildSuccessionBrief #buildSupervisorBindBrief #handleSelfSucceed #handoffCommittedAfterOpen #migrateRailOf #LANE_EXIT_FOOTER #taskSpawnFromBody #WORKER_ROUTES #CARD_MODEL #REFINE_MODEL #SUMMARY_MODEL #DEFAULT_MODEL #HARNESSES #LANE_MIGRATE_PCT #viewEntry, merge-prompt.ts#GIT_GRANT_MERGE, .env (nur der Schluessel FLEET_MIGRATE_PCT), Render-Messung mit rulebook.ts#renderRulebook im Haupt-Checkout]
nicht-gemessen: Live-Roster und Queue-Zaehlungen (fleet.json nicht gelesen — Fables Slot-/Tripel-Zahlen bleiben uebernommen); Sub-Agent-Zaehlung 6/369 (beide zitieren dieselbe Queue-Notiz 504b0854, hier nicht nachgezaehlt); Ledger-Zahlen (Land-Quote, Audits, ownerPrompts); K1-Nachher; Wirkung jedes hier vorgeschlagenen Texts (kein A/B); Startkontext fremder Harnesses in Tokens; ob der Backref-Block in der Render-Messung enthalten ist
stand: 2026-09-13
---

# Rollen, Briefe und Gueteklassen — Synthese der zwei Entwuerfe (Entscheidungsvorlage)

Markierung: **[geprueft]** = hier selbst am Code/Doc nachgesehen (Fundstelle daneben) · **[uebernommen]** = aus
einem der zwei Dokumente, nicht nachgesehen · **[beide, ungeprueft]** = beide sagen es, keiner hat es
gemessen — Einigkeit ist kein Beweis. Kurznamen: **F** = Fable-Entwurf, **A** = Astra-Entwurf.

## §0 Urteil in fuenf Saetzen

1. Beide Entwuerfe tragen unabhaengig dieselbe Achse: der Brief kostet ~3,6 k von ~70 k Start-Tokens, der
   Lane-Render 18,3 k, die Erdung danach ~75 k — der Hebel liegt im Render und in der Datenschicht, nicht
   im Brieftext [geprueft: Fixkosten-Note §Ergebnis; Worktrail IV §2.2].
2. Die Widersprueche sind wenige und am Repo entscheidbar: F irrt dreimal (`attention` steht in
   `server.ts#RAIL_TAIL`; `FLEET_MIGRATE_PCT` ist live 32, nicht 0; K1 heisst seit Plan §4 134 k/<115 k, nicht
   151 k/<120 k), A hat mit dem veralteten Astra-Baustein (R3 verlangt einen HANDOFF-Commit, den
   `server.ts#handleSelfSucceed` fuer eine Standard-Program-MAIN nicht prueft; `GET /api/self/notes` existiert)
   recht [alle geprueft].
3. Beide uebersehen denselben ersten Bauschritt: `card-extract.ts#parseFormattedCard` bricht die
   Kopfzeilen an der ersten unbekannten Zeile ab — `KLASSE:`, `DELEGATION:` oder `VERBOTEN:` im Kopf machen
   die Zeile heute zu Prosa oder zum falschen Ziel; jede Template-Fassung setzt also eine Parser-Erweiterung
   voraus [geprueft].
4. Empfohlen wird die Form von F (JSON-Register in `.fleet/`, Sechs-Block-Rollenkarte, englischer
   AGENTS-Absatz, kurzer Kopf) mit der Semantik von A (Klasse = Job-Familie mit Qualifikation und Version,
   Harness ist ein Attribut des Executors und keine Klasse; eigene `KLASSE:`-Zeile statt ROLLE-Ueberladung;
   Delegation strikt read-only, Limits benannt).
5. Vier Schnitte in dieser Reihenfolge — Render schrumpfen + Drift tilgen · Delegation gebrieft und
   messbar · Klasse als Register erst im Schatten, dann scharf · Rollenkarten mit vollstaendigen Tueren —
   Schnittlinie davor: Provider-Profil, `tools.deny`, schreibende Sub-Agents, dritte Render-Achse.

## §1 Abgleich §1–§8

| § | Gleich (belastbarer) | Widerspruch — wer hat recht | Nur einer — taugt es? |
|---|---|---|---|
| §1 Inventar | Lane-Render = 3 Fragmente, MAIN = alle 7 [geprueft `rulebook.ts#FRAGMENTS_FOR`]; Startlast 71 387 Tokens, Render 18 335, Praefix 32 467, AGENTS.md kostet beim Start 0 [geprueft Fixkosten-Note]; Filing-Format ROLLE/GROESSE/FLAECHE/NEU/NACH/VERIFY/DONE [geprueft `card-extract.ts#FORMAT_KEYS`]; Worker-Routen: summary/commitMsg/enhance/digest ueber codex-spark, review/merge/repair/cleanReview/refine/card ueber claude; card = Haiku 4.5, refine = Opus 5, Summary-Default Sonnet 5 [geprueft `server.ts#WORKER_ROUTES` `#CARD_MODEL` `#REFINE_MODEL` `#SUMMARY_MODEL`]; pi-zai/pi-unfenced/container `automatable:false` [geprueft `server.ts#HARNESSES`] | F: „Staffelstab live aus (`FLEET_MIGRATE_PCT` 0)" — **falsch**: `.env` traegt 32 mit Owner-Freigabe 2026-09-13 [geprueft, nur dieser Schluessel gelesen]; Lane-Nudge bei `LANE_MIGRATE_PCT` Default 40 [geprueft]. F: Controller „ohne servergebauten Rollenbrief" vs A: „generischer Nachfolgebrief" — **beide recht**: `server.ts#buildSuccessionBrief` ist ein 4-Schritte-Nachfolgetext ohne Rolle, ein Gruendungsbrief fehlt; `#buildSupervisorBindBrief` ist das Muster [geprueft] | F: Live-Roster-Abweichungen (MAINs auf Opus, Supervisor-Slot auf codex/Sol) und Queue-Tripel-Zaehlung [uebernommen, fleet.json nicht gelesen] — taugt als Owner-Frage 3. A: Lane-Render 36 889 B inkl. Backrefs; hier gemessen `renderRulebook("lane")` 35 666 Zeichen / 36 077 B [geprueft] — beide innerhalb 2 %. A: `wave-brief.ts` hat schon ein Feld `klasse: "docs" \| "code"` [geprueft] — darum darf das neue Feld nicht `klasse` heissen (Register-Schluessel `KLASSE`, Code-Feld `executionClass`) |
| §2 Dynamik | Report-Deckel 4 000 war die teuerste explizite Luecke (130/181 Lanes, 334 Abweisungen) und steht jetzt in AGENTS.md §Reporting und `LANE_EXIT_FOOTER` (`MAX_FLEET_REPORT_TEXT`) [geprueft]; „go idle" und das Suite-Warten stehen im Footer [geprueft]; Anker senken die Erdung nicht messbar [uebernommen Worktrail IV §2.3]; Geschichten helfen dem Adjudizierer, kosten die Lane; stille Fragen gehoeren in den Brief, nie als Report-Abschnitt [beide, ungeprueft — Gestaltungsurteil, kein A/B] | F Befund 18 „`attention` steht in keinem Brief" — **halb falsch**: `RAIL_TAIL` nennt tasks, release, land, watch merge→audit und „exactly ONE POST /api/self/attention" an der Owner-Grenze; es fehlen `inbox` und `clarifications/:id/reply` [geprueft: kein Treffer in `RAIL_HEAD`/`RAIL_TAIL`/`buildProgramMainBrief`-Body]. K1: F zitiert 151 k / <120 k (Plan §1, ueberholt), A zitiert 134 k / p90 185 k / n=178 / Kriterium <115 k (Plan §4) — **A recht**; der Plan selbst nennt die 151 k „kein Vergleichswert" [geprueft] | A Befund 2: Astra-Baustein R3 verlangt HANDOFF-Commit als Nachfolge-Gate und behauptet, `/api/self/notes` gebe es nicht — **beides veraltet** [geprueft: `handleSelfSucceed` setzt `handoffReady = standard ? null : …`; Route `GET /api/self/notes` mit 409 fuer Nicht-Lanes]. Taugt: das ist die eine Drift, die heute falsche Zuege an jede Astra-MAIN sendet. F: fuenf konkrete stille Fragen mit Sensor (`gate`, `classifiedAs`, Notizen) — taugt, praeziser als A's abstrakte Komplementspalte |
| §3 Traeger / Bloat | Ein Satz hat genau einen Traeger; Regelbuch nur Host-Realitaet; Karte traegt Ziel/Flaeche/Done/Verify/Verboten/Delegation; Provider-Zustand nie in einen Brief; SYSTEM.md ist Zielbild, kein Leseauftrag [beide; SYSTEM.md §Wissensordnung geprueft] | F: drei grep-Proben (Tuer, Sensor, Geschichte), pin-faehig; A: „kanonische Quelle + Zielrolle + Ausloeser", nicht zaehlbar — **kein Widerspruch, sondern Schichten**: A's Regel ist das Urteil, F's Proben sind der Sensor. Die Tuer-Probe trifft heute 7-mal im Lane-Render [geprueft, eigene Zaehlung] — F's S1-Done ist damit sofort messbar | A: SYSTEM.md §Kontextschichten schliesst „getrennte Rollenhandbuecher, eine handgeschriebene Rolle-mal-Harness-Matrix, ein zweites Context-Pack-Register" aus [geprueft] — taugt als Grenze fuer §2c: das Register darf Klasse→Executor sein, nicht Rolle→Harness. F: Game-Maker-Preflight = 21 % des AGENTS-Kerns [uebernommen] |
| §4 Entwuerfe | Kopf = Filing-Format, DELEGATION-Zeile, Verbote Suite/Commit/Land/Self-POST, Rueckgabe `datei#symbol` + ein Satz, Sub-Agent kennt das Repo nicht | (a) F kurz (Kopf + drei stille Fragen), A lang (ERDUNG/ARBEIT/RUECKWEG/ABSCHLUSS/UEBERGABE) — **F recht in der Form**: A's ABSCHLUSS/UEBERGABE/Warten wiederholen `LANE_EXIT_FOOTER` woertlich, den der Server ohnehin anhaengt, und ERDUNG wiederholt das Quellpaket (`briefAndSend`) — eine zweite handgepflegte Norm, die A's eigene §3-Regel verbietet. (c) F: Klassen `kopf/hand/fremd/wegwerf` mit `rollen`-Listen und Band-Zahlen; A: `form/werk/fuehrung/urteil` mit Version, Qualifikation, Limits, legacy — **A recht in der Semantik**: `fremd` ist eine Harness-Eigenschaft, keine Guete; `rollen:` im Register ist die verbotene Rolle-Matrix; Band-Zahlen leben im Vertrag und Sensor. (d) F englisch (AGENTS.md ist englisch), A deutsch — **F**; F erlaubt `disjunkt:<dateien>` (schreibend), A nur read-only bis promoviert — **A** (Owner-Frage 4) | A: `BINDUNG`/`AUTORITAET`-Zeile und „ist kein Teilauftrag benannt, arbeite selbst" — taugt, uebernommen in (a). A: Rollenkarte mit „Du entscheidest / der Owner entscheidet" — taugt, uebernommen in (b). F: `override`-Tripel bleibt erlaubt — taugt. A: `executionClassVersion` im Receipt — taugt |
| §5 Klassen / Sub-Agents | Zwei Datensaetze, ein Schluessel `(harness, model)`; Agent sieht nur seine Aufloesung; Delegation lohnt fuer grosse unabhaengige Lesemengen, nicht fuer die Zeilen der eigenen Aenderung; Fleet-Kindlanes bleiben unter der Linie (`AGENTS.md` §Role contract: Act Lead nicht gebaut [geprueft]) | F: Klasse per `ROLLE: hand` (ueberladen); A: eigene `KLASSE:` — **A**: `parseFormattedCard` splittet ROLLE an `/` in harness/model/effort, ein Einzeltoken wuerde harness `hand` ergeben, und AGENTS.md §Filing dokumentiert ROLLE als Tripel [geprueft]. F: keine dritte Render-Achse; A: schweigt — F's Argument haelt (Dichte regelt die Klasse, Loader die Harness) | A: Merge-Worker darf committen (`merge-prompt.ts#GIT_GRANT_MERGE` enthaelt `git commit`) und ist ein anderer Prinzipal — das Sub-Agent-Verbot darf ihn nicht still streichen [geprueft]. F: `tools.deny` kauft 4 900 Tokens, nur in `-p` gemessen [geprueft Fixkosten-Note] — unter der Linie, richtig so. F: `subagentTokens` aus derselben `.jsonl` (Annahme 2) — `server.ts#viewEntry` liest `isSidechain` im selben Strom, die Annahme ist plausibel, aber nicht gezaehlt [geprueft: Flag, nicht die Summe] |
| §6 Schnitte | Provider-Profil zuletzt; K1 entscheidet ctxPack-Ausbau; Delegationspilot vor dauerhafter Regel; Owner promoviert AGENTS/SYSTEM/Regelbuch | F: Klassen-Register als S2 scharf; A: erst Schatten (S4) — **A** fuer die Reihenfolge, **F** fuer die Reichweite: Schatten heisst hier „Tripel im Receipt, Spawn unveraendert", ein Schnitt, kein Programm. A's S1 (Drift tilgen) fehlt bei F und ist geprueft real | F: S1 Render-Schrumpfen mit Zahl (<20 000 Zeichen) — taugt, sofort messbar. A: Adapter-Disposition apply/unsupported/not-applicable je Schnitt — taugt (AGENTS.md §Hard invariants verlangt sie [geprueft]) |
| §7 Messplan | Startlast, Marker-Kontext, Report-Deckel-Treffer, sleep-Aufrufe, subagentCalls, Gesamt-Tokens, Land-Quote; Pilot 4–6 Lanen mit/ohne DELEGATION | Marker: F 189 349 (GLM §2.1, n=142, Edit/Write/commit), A 144 382 (Worktrail IV §2.2, n=171) — **beide recht, verschiedene Populationen und Marker** [geprueft beide Quellen]; A's Warnung, keine gemeinsame Rangliste zu bauen, gilt | A: „Pruefaufwand des Empfaengers" als Zielgroesse; „ungenutzter Sub-Agent ist kein Fehlschlag" — taugt. F: eine Schreibweise je Modell im Ledger (`fable` vs `claude-fable-5-1[1m]`) [uebernommen] — taugt als Nebenprodukt von §2c |
| §8 Offen | K1-Nachher, Tonfall-Wirkung, Gesamt-Tokens, Fremd-Harness-Startlast, Geld — beide gleich; **geteilte ungepruefte Annahme**: die Fixkosten-Zerlegung einer einzigen Lane (n=1) gilt fuer alle Lanes — die Note selbst sagt das | Fragen: F nach Klassenliste, `disjunkt`, Ablage des Provider-Profils; A nach Klassenbegriff, read-only-Pilot, Warten-vs-Wechseln — zusammengefuehrt in §4 | — |

## §2 Empfohlene Entwuerfe

### (a) Lane-Brief-Template — wie eine Lane es liest

Form von F (Kopf nach `card-extract.ts#FORMAT_KEYS`, dann Prosa, dann haengt der Server Notizen, Quellpaket,
Anker und `LANE_EXIT_FOOTER` an). Aus A uebernommen: `KLASSE` als eigene Zeile (Grund: ROLLE ist das
dokumentierte Tripel), `VERBOTEN` mit Stop-Grenze, die Zeile „kein Teilauftrag benannt → selbst", der
Rot-Satz. Weg: A's ABSCHLUSS/UEBERGABE/Warten (Footer liefert sie) und A's ausgeschriebene Kommandos
(`docs/lane-brief-template.md` §Norms: Gate-Kommando nie in den Brief, es driftet). **Bis der Parser
`KLASSE`, `DELEGATION` und `VERBOTEN` kennt (§3 S2/S3), stehen die drei als erste Prosa-Zeilen NACH dem
Ziel, nicht im Kopf** — sonst liest `parseFormattedCard` die Zeile als Prosa oder nimmt `DELEGATION: …`
als Ziel [geprueft].

```text
[TITEL in einer Zeile]
KLASSE: hand                              (aus .fleet/klassen.json; loest beim Release ins Tripel auf)
ROLLE: claude/claude-opus-5[1m]/high      (optional: Tripel als Override; gewinnt, wird receiptiert)
GROESSE: klein|mittel|gross
FLAECHE: server.ts#confirmCardsForMain, e2e/tasks.ts
NEU: docs/messungen/2026-09-xx-thema.md   (optional)
NACH: 7ed73694                            (optional)
VERIFY: install, pins | volle Kette | ./e2e-isolated.sh nur wenn e2e/, Wrapper oder Land-Pfad
DONE: <ein pruefbarer Satz mit dem Kommando, das ihn beweist>
DELEGATION: erdung:read-only, max 2       (optional; fehlt die Zeile, arbeitest du selbst)
VERBOTEN: <ausgeschlossene Flaeche, Aussenwirkung, Stop-Grenze>
--- AUFTRAG ---
<Ziel in einem Absatz: Problem, Bedeutung, beobachtbares Ergebnis. Keine Wiederholung des Kopfs.>

ERDUNG: zuerst <2–4 datei#symbol in Reihenfolge>. Das Quellpaket unten traegt Ausschnitte mit
markierten Auslassungen — die Zeilen, die du aenderst, liest du selbst und vollstaendig.

BEVOR DU SCHREIBST, stelle still fest (nichts davon wird Text im Report):
- welche Pruefung deine Aenderung deckt (GET /api/self/gate, classifiedAs) und ob ueber deiner
  Zeile eine Behauptung steht (Pin, supports.*, note, effortLevels);
- wer sonst auf diese Dateien schreibt (GET /api/self/notes) und welche Aufrufer und Gegenfaelle
  deine Aenderung falsch machen wuerde;
- wie dein Report in 4 000 Zeichen aussieht; Zahlen und Tails gehoeren in den Commit-Body.

ROT: der erste rote Schritt stoppt die Kette. Derselbe Baum erneut trennt Defekt von
Nichtdeterminismus; nach ~5 gleichen Fehlschlaegen melden statt neu wuerfeln.

DELEGATION (nur, wenn die Zeile gesetzt ist): ein Sub-Agent liest und sucht, gibt datei#symbol
plus einen Satz zurueck und aendert nichts. Nie im Sub-Agent: Suite, Commit, Land,
POST /api/self/*, weitere Delegation. Er kennt dieses Repo nicht — gib ihm Dateien, Frage und
Rueckgabeform, und lies sein Ergebnis als Claim.

REPORT: Summe, Verify-Tail woertlich, eine Zeile Offenes. Schema, Deckel und Exit stehen im
Footer, den der Server anhaengt.
```

### (b) Rollenkarten-Geruest — Program-MAIN und Orchestrator

Sechs Bloecke von F, servergebaut zwischen Program-Payload und Anker (`server.ts#railBlockFor`). Aus A:
die Trennung „Du entscheidest / der Owner entscheidet" (Grund: die Autoritaet in einem Satz, nicht als
Buchstabenliste), „autorisierte Restarbeit darf weiterlaufen" beim Warten. Korrigiert gegen F: `attention`
steht schon in `RAIL_TAIL`; neu sind nur `inbox` und `clarifications/:id/reply` [geprueft].

```text
--- ROLLE ---            Program-MAIN: die eine autoritative MAIN dieses Programs bis <Endzustand>.
                         Orchestrator: Portfolio halten, Owner-Absicht in Program-Vorschlaege
                         uebersetzen; fuehrt keine Program-Lane.
--- DU ENTSCHEIDEST ---  Reihenfolge, Zerlegung, Klasse und Worker je Akt, gewoehnliche Reparatur und
                         Integration; kleine reversible Akte im Scope selbst (AGENTS.md §Role contract A/B).
--- DER OWNER ENTSCHEIDET --- Scope-Wachstum, Irreversibles, Aussenwirkung und Kosten, Deploy,
                         erklaerter Geschmack (C). Genau EINE attention je solcher Grenze.
--- DEINE TUEREN ---     Program-MAIN: program-execution (lesen, vor jedem Akt) · inbox (dauerhafter
                         Rueckweg) · tasks (kind auftrag, KLASSE) · tasks/:id/release ·
                         clarifications/:id/reply (ein Worker fragt) · tasks/:id/land (nur wenn
                         nextAction es nennt) · watch merge → audit (idleSec:0, Events quittieren) ·
                         attention (nur an der Owner-Grenze).
                         Orchestrator: programs (vorschlagen, lesen) · self · watch (lane/merge/audit) ·
                         KEINE Owner-Route — du berichtest in deiner Pane; Land und Dispatch nur mit
                         konkreter Owner-Delegation.
--- DER LOOP ---         kleinster Akt → Klasse waehlen → filen im Format (a) → release → warten ohne
                         Beobachten (schon autorisierte Restarbeit darf weiter) → Report ist ein CLAIM:
                         Diff und Verify-Tail lesen → land nach Projektion → naechster Akt.
--- STILLE FRAGEN ---    Welche Tuer gehoert dem Owner? Ist die Zeile ein Schnitt oder ein Programm
                         (Vorgabe woertlich zitieren, Rangliste dort abschneiden)? Kann der Report
                         beweisen, was er behauptet? Welche Notiz auf der Flaeche widerspricht der Zeile?
--- UEBERGABE ---        Program-MAIN: offene Pflichten lesbar in Program/Tasks/Reports/Inbox, dann
                         succeed mit carry; kein HANDOFF-Commit (Schiene standard-main).
                         Orchestrator: HANDOFF.md-Abschnitt mit eigenem H1 zuoberst, committen,
                         succeed (Schiene handoff).
```

Nicht in die Karte: Modell-IDs (die Klasse traegt sie), Kontext-Zahlen (Sensor `ctx`, AGENTS.md
§Context self-management), Nachfolge-Geschichte (`docs/controller.md` §Nachfolge bleibt Langfassung).
Game-Maker: `RAIL_ROLE_GAME_MAKER` ersetzt weiterhin den Rollenschnitt; die Preflight-Pflicht bleibt in
AGENTS.md §Hard invariants, Klassen heben sie nicht auf (A, geprueft an AGENTS.md).

### (c) Gueteklassen-Datensatz

Form von F (`.fleet/klassen.json`, getrackt, oeffentliche Modell-IDs; Vorbild `.fleet/context-packs.json`
[geprueft: existiert]). Semantik von A: Klasse = Job-Familie mit `qualifikation` und `version`; Harness ist
Attribut des Executors, darum entfaellt F's `fremd`; `urteil` kommt hinzu (Analyse, Review, Clarify) —
heute die Astra-Denkauftraege, die F unter `kopf` mit `nur: analyse` versteckt. Weg: F's `rollen:`-Listen
(SYSTEM.md §Kontextschichten verbietet die handgeschriebene Rolle-Matrix — eine Rolle nennt ihre Klasse
beim Filen, das Register nennt keine Rollen) und F's `band`-Zahlen (leben im Vertrag und im Sensor
`LANE_MIGRATE_PCT` Default 40 [geprueft], F's 35 waere eine dritte Zahl). Behalten: F's `override`, F's
Sichtbarkeit der `form`-Routen (Code bleibt Quelle), A's Delegations-Limits und `legacy`.

```json
{
  "version": "entwurf-1",
  "klassen": {
    "kopf": {
      "zweck": "orchestrieren, entscheiden, adjudizieren",
      "executor": { "harness": "claude", "model": "claude-fable-5-1[1m]", "effort": "high" },
      "alternativen": [
        { "harness": "claude", "model": "claude-opus-5[1m]", "effort": "high", "qualifiziert": "Owner-Versuch 2026-09-07 (Controller)" }
      ],
      "qualifikation": "Owner-Politik 2026-09-02",
      "brief": { "dichte": "duenn", "render": "main" },
      "delegation": { "arten": ["erdung:read-only", "perspektiven"], "maxParallel": 2, "tiefe": 1 },
      "worker": ["card", "refine", "summary", "review"],
      "skripte": ["state.sh", "register.sh", "ctl.sh"]
    },
    "hand": {
      "zweck": "einen Schnitt bauen und beweisen",
      "executor": { "harness": "claude", "model": "claude-opus-5[1m]", "effort": "high" },
      "alternativen": [
        { "harness": "codex", "model": "gpt-5.6-sol", "effort": "high", "qualifiziert": "docs- und kleine Slices (Lane-Kontext §4: filesTouched p50 1)" }
      ],
      "qualifikation": "Owner-Politik 2026-09-02",
      "brief": { "dichte": "karte+quellpaket", "render": "lane",
                 "fremdeHarness": ["Verify ausgeschrieben", "Verbote benannt", "Fuellstand selbst melden"] },
      "delegation": { "arten": ["erdung:read-only"], "maxParallel": 2, "tiefe": 1 },
      "worker": [],
      "skripte": ["e2e-*.sh", "graph-coverage.ts"]
    },
    "urteil": {
      "zweck": "analysieren, reviewen, Kriterium klaeren — ohne Bau",
      "executor": { "harness": "codex", "model": "gpt-6-astra", "effort": "medium" },
      "alternativen": [
        { "harness": "claude", "model": "claude-fable-5-1[1m]", "effort": "high", "qualifiziert": "Doppel-Denkauftrag 2026-09-13" }
      ],
      "qualifikation": "auftragsgebunden; keine pauschale Paritaet",
      "brief": { "dichte": "vollstaendig", "render": "keiner" },
      "delegation": { "arten": ["erdung:read-only", "perspektiven"], "maxParallel": 2, "tiefe": 1 },
      "worker": [],
      "skripte": ["deterministische Leseauswertung"]
    },
    "form": {
      "zweck": "eine Textantwort ohne Session: Karte, Zusammenfassung, Review, Merge",
      "executor": null,
      "routen": "server.ts#WORKER_ROUTES · #CARD_MODEL · #REFINE_MODEL · #SUMMARY_MODEL (Code bleibt die Quelle)",
      "delegation": { "arten": [], "maxParallel": 0, "tiefe": 0 },
      "worker": [], "skripte": []
    }
  },
  "regeln": {
    "override": "ein ROLLE-Tripel gewinnt ueber die Klasse und wird im Receipt mit Klasse+Version festgehalten",
    "unbekannteKlasse": "Karten-Luecke (400), nie ein Default",
    "legacy": "Zeile ohne KLASSE verhaelt sich wie heute (Tripel oder DEFAULT_MODEL)",
    "providerProfil": "zweiter, gitignorter Datensatz; Schluessel (harness, model); nie in einem Brief"
  }
}
```

### (d) AGENTS.md-Absatz Sub-Agents (§Hard invariants, nach „Load the smallest relevant context")

F's englischer Text (AGENTS.md ist englisch), ergaenzt um drei Saetze aus A: keine Weiter-Delegation,
schreibende Sub-Agents nur nach eigener Promotion, Kosten inklusive Startkontext. F's `disjunkt`-Schreibfall
ist gestrichen (Owner-Frage 4).

```text
- A sub-agent is a tool inside one session, not a Fleet principal. Delegate to one only for
  read-only grounding across more files than you need yourself, or for parallel read-only
  perspectives on the same sources — and only when the brief's DELEGATION line allows it and
  within its stated limit; with no DELEGATION line, do the work yourself. Never run a suite,
  commit, land, or call a `/api/self` door from a sub-agent; a sub-agent never delegates further,
  and a worker lane never opens Fleet lanes. A sub-agent inherits none of this contract: give it
  the files, the question and the return shape, and read what it returns as a claim
  (`file#symbol` plus one sentence), never as verified. Writing sub-agents need a separately
  promoted trial with exclusive file ownership and an integration proof. Your own context sensor
  does not see a sub-agent's tokens — total cost is principal plus every sub-agent including its
  start context, measured, not assumed.
```

## §3 Schnittliste

Owner-Vorgabe woertlich: „am Ende die bessere Version bzw. Ansaetze+Idee und das Beste aus beidem
nehmen und damit Claude Fleet nochmal ein gutes Stueck verbessern". Erfuellt ist sie mit §2; die Schnitte
darunter sind die Reihenfolge, jeder allein landbar. Rang nach Wirkung auf die Arbeit der Agenten.

1. **S1 — Lane-Render schrumpfen und Drift tilgen** (F S1 + A S1). Jede claude-Lane zahlt 18,3 k
   Tokens Render, davon ~6,6 k Tueren und Suiten-Innenleben, die ihr 409 antworten oder die nur der
   Adjudizierer braucht; jede Astra-MAIN liest in R3 einen Zug, den der Server nicht mehr verlangt.
   Done: `renderRulebook("lane")` < 20 000 Zeichen (heute 35 666) und F's Tuer-Probe = 0 (heute 7);
   Astra-Baustein R3 durch einen Verweis auf die Nachfolge-Schiene ersetzt und der `self/notes`-Satz
   gestrichen. Verify: `bun e2e/pins.ts` (RULE_VERIFY, §6b) + Render-Einzeiler aus `rulebook.ts` +
   `rg -c` der Tuer-Probe; Textvergleich gegen `handleSelfSucceed`/`migrateRailOf`. Promoviert: Owner
   (Fragmente sind untracked, die Lane meldet den Text; der Baustein ist ein Doc, die Lane committet ihn).
2. **S2 — Delegation gebrieft und messbar** (F S3 + A S3). Parser: `DELEGATION` und `VERBOTEN` als
   Kopfzeilen in `card-extract.ts#FORMAT_KEYS` (heute bricht der Kopf dort ab); Template (a); AGENTS-Absatz
   (d); `subagentCalls`/`subagentTokens` in `LaneOutcome` aus dem Transkript (`isSidechain`-Zeilen). Done:
   eine Zeile mit `DELEGATION: erdung:read-only, max 2` ist gueltige Karte und beide Felder stehen auf ihrer
   Ledger-Zeile; Lanes ohne Transkript tragen `null`. Verify: Check in `e2e/tasks.ts` gegen ein
   Fixture-Transkript (Positiv-, Null-, Unbekannt-Fall) + pins + volle Kette. Promoviert: Owner (der
   Absatz); danach der 4–6-Lanen-Pilot als Messlane, ohne gleichzeitige Werkzeug-Diaet (A §7).
3. **S3 — Klasse als Register, erst Schatten, dann scharf** (A S4 → F S2). `.fleet/klassen.json` (§2c);
   `KLASSE:` als Kopfzeile; `validateCard` prueft gegen das Register; Schatten: der Dispatch schreibt das
   aufgeloeste Tripel und `executionClass@version` ins Receipt, spawnt aber unveraendert; scharf: Release
   loest ins Tripel auf, Ledger bleibt wie heute. Done (Schatten): eine Zeile mit `KLASSE: hand` ist
   gueltig, ihr Receipt traegt `claude-opus-5[1m]/high`, der Spawn ist byte-identisch zu heute. Done
   (scharf): ihre Lane traegt das Tripel im Ledger; die MODELLPOLITIK-Zeile im Regelbuch wird ein Verweis.
   Verify: Resolver-Checks (unbekannte Klasse = 400, Tripel-Override gewinnt, legacy unveraendert,
   unzulaessiger Effort je Harness) in `e2e/tasks.ts` + pins + volle Kette. Promoviert: Owner
   (Klassenliste, Owner-Fragen 1–3).
4. **S4 — Rollenkarten vollstaendig** (F S4 + A (b)). `RAIL_TAIL` bekommt `inbox` und
   `clarifications/:id/reply` sowie die Zeile „Du entscheidest / der Owner entscheidet"; der Orchestrator
   bekommt einen Bind-Brief nach `buildSupervisorBindBrief`. Done: der Program-MAIN-Rail nennt beide Tueren;
   ein gebundener Controller hat einen Gruendungsbrief im Receipt. Verify: `e2e/programs.ts` (Byte-Pin des
   Rails nachziehen) + pins. Promoviert: Owner (Text); baut: eine `hand`-Lane.

— Schnittlinie —

Nicht jetzt: **Provider-Profil** (A S5; braucht S3's Schluessel und eine eigene Sensor-Note) ·
**`tools.deny` je Klasse** (nur in `-p` gemessen) · **schreibende Sub-Agents `disjunkt:`** (erst nach dem
Piloten) · **dritte Render-Achse** (nicht noetig, F §5) · **ctxPacks mit Inhalt** (K1 bleibt
Plan-Checkpoint des Orchestrators, kein Schnitt hier) · **Steward-Regal, HANDOFF-Stapel** (eigene Zeilen).

## §4 Owner-Fragen mit Empfehlung

1. **Klassenvokabular:** vier Klassen nach Job-Familie — `kopf · hand · urteil · form` — und Harness ist
   ein Attribut des Executors, kein Klassenname? *Empfehlung: ja; F's `fremd` entfaellt, eine codex-Bau-Lane
   ist `hand` mit dichterem Brief.*
2. **Traeger in der Karte:** eigene Zeile `KLASSE:` (additiv, ROLLE bleibt das dokumentierte Tripel und der
   Override)? *Empfehlung: ja; ROLLE zu ueberladen bricht `parseFormattedCard` und AGENTS.md §Filing.*
3. **Default-Executor `kopf`:** Fable 5.1 laut MODELLPOLITIK, obwohl laut F-Doc Orchestrator und
   Program-MAIN heute auf Opus 5 laufen (hier nicht geprueft)? *Empfehlung: Fable als Default, Opus 5 high
   als qualifizierte Alternative; der VERSUCH-Absatz entscheidet spaeter, das Register macht ihn sichtbar.*
4. **Sub-Agents im Piloten strikt read-only** (kein `disjunkt:<dateien>`)? *Empfehlung: ja; Schreibrecht
   erst nach gemessenem Nutzen mit eigener Integrationsprobe.*
5. **Gesperrter Provider:** warten mit sichtbarem Grund statt automatisch wechseln, bis je Klasse
   qualifizierte Alternativen promoviert sind? *Empfehlung: ja; die Ablage des Provider-Profils
   (`fleet.json` vs `.env`) erst mit dem Schnitt selbst entscheiden — er liegt unter der Linie.*

## §5 Nicht geprueft

- `fleet.json` nicht gelesen: F's Live-Roster-Abweichungen, Queue-Tripel-Zaehlung (90/25/3/3/1),
  Attention-/Report-Zahlen bleiben uebernommen.
- Ledger nicht gelesen: Land-Quote 239/278, Audits 112/79/24, `ownerPrompts` 127 (F §7) uebernommen.
- Sub-Agent-Zaehlung 6/369 mit 18 Aufrufen: beide zitieren dieselbe Queue-Notiz; keiner und ich haben die
  Transkripte nachgezaehlt.
- Render-Messung: `renderRulebook("lane")` im Haupt-Checkout heute; ob der Backref-Block enthalten ist,
  habe ich nicht geprueft (A's 36 889 B „inkl. Backrefs" liegt 2 % darueber).
- Die Fixkosten-Zerlegung ist n=1 (eine Lane); beide Entwuerfe bauen darauf, die Note sagt es selbst.
- Wirkung jedes Textes in §2: kein A/B; die Tonfall-/Geschichten-Zuordnung bleibt Gestaltungsurteil.
- `subagentTokens` aus derselben `.jsonl`: das `isSidechain`-Flag existiert im selben Strom
  (`server.ts#viewEntry`), die Summierbarkeit ist nicht ausprobiert.
- Fremd-Harness-Startkontext in Tokens, Geld, K1-Nachher: wie in beiden Entwuerfen offen.
