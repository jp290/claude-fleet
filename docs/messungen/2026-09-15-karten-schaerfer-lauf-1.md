---
frage: Welche ungueltigen Fleet-Betrieb-Auftraege lassen sich ohne Absichtsaenderung durch einen vollstaendigen Filing-Kopf schaerfen?
urteil: 15 Zeilen nach exaktem Filter; 11 Ersatzkoepfe mit 0 gaps, 4 offen; drei der 11 sind gehaltene, bereits ersetzte Vorlaeufer.
bereich: [karten, queue, briefs]
belege: [card-extract.ts, server.ts, docs/messungen/INDEX.md]
nicht-gemessen: Keine Ausfuehrung der Ersatzauftraege, keine Live-Queue-Validierung oder Freigabe, keine Modellwirkung.
stand: 2026-09-15
---

# Karten-Schaerfer — Lauf 1

## Auswahl und Beweisgrenze

Quelle: `/Users/owner/[privater Owner-Ordner]/astra-inputs-2026-09-14/open-tasks.json`, SHA-256 `d95169d12d07f317d72ea5938a77e699f1fadc9618e9a42c5900b884b604669b`; gepruefter Quellstand `fc1c18ad078ae942854c7eca62154d57365951fb`.

Der exakte Filter `kind === "auftrag" && programId === "f170dc46e4b026ee34d9392e" && ["pending", "queued"].includes(status) && card.valid === false` liefert **15 Zeilen: 11 pending, 4 queued**. Die erwarteten 12 entstehen erst durch den zusaetzlichen, im DONE nicht verlangten Ausschluss der drei gehaltenen Einzelauftraege 1216923f, 88a0bf52 und 54de1085. Hier stehen alle 15; gehaltene Vorlaeufer werden nicht wiederbelebt. Die Titelangabe „acht“ ist ebenfalls nicht der Auswahlfilter.

Gelesen: vollstaendige Texte und Kommentare der Auswahl, die vorhandenen Beispielkoepfe 4725b5cb, 0bcfee35, d3765352; Beispiel 1e4a2ca5 fehlt im Export. card-extract.ts:205–460 und server.ts:11295–11317 bestimmen den Test. Der bestehende Kartenvalidator ist hier die richtige Abstraktion: Er prueft deterministisch die Kopfstruktur, ohne eine inhaltliche Freigabe zu ersetzen. Keine Implementierungsbewertung und kein neuer Validator.

**Verwendung:** Jeder Codeblock ist der vollstaendige neue Kopf. Danach bleiben Originalauftrag und Kommentare unveraendert als Kontext erhalten (auch dessen bisherige Feldzeilen duerfen hinter der ersten Leerzeile stehen). Dadurch gehen Bedingungen in alten FLAECHE-Erlaeuterungen, Verbote und lange DONE-Kriterien nicht verloren. Nur der erste zusammenhaengende Kopf wird geparst. Der Test prueft sowohl den Kopf allein als auch Kopf plus Original und Kommentare. FLAECHE ist ein maximal erlaubter Bereich; „oder“, „falls“ und Clarify-first in der Prosa bleiben enger. Ein gruener Validator genehmigt weder das Bauen vor einer Klaerung noch das Aufheben einer Hold-Markierung.

Der Validator kuerzt einzelne Saetze auf 400 Zeichen (card-extract.ts:152–156); deshalb werden lange VERIFY/DONE hier vollstaendig erhalten, nicht aus der gespeicherten gekuerzten card rekonstruiert. `valid:true` allein reicht nicht: Rollenluecken sind advisory (card-extract.ts:107–114); gemessen wird explizit die Laenge von gaps.

## Ersatzkoepfe

### f3ca2e05 — pending

Alte gaps, woertlich:

```text
verify: "POST /api/self/criterion" names no known chain step (install, pins, tsc, build, clean-review, security, claude-gate)
```

Ursache und Erhalt der Absicht: Der gespeicherte VERIFY nennt nur eine API-Ablage, keinen bekannten Kettenschritt. ROLLE und GROESSE bleiben leer: Text und spawn legen kein Tripel und keine Groesse fest; kein Executor wird erfunden. VERIFY bleibt absichtstreu und daher offen. Die gespeicherte card spricht abweichend von Q1–Q4; massgeblich ist hier text mit Q1–Q6. Kein Produktcode, kein zusaetzliches Dokument.

```text
[CROSS-HOST-DISPATCH · LANES AUF DEM SECOND-HOST, NICHT NUR SUITEN · CLARIFY FIRST · gefilet 2026-09-11 von Opus-5-MAIN. OWNER-ENTSCHEID VOM 2026-09-11, der die offene Frage von BUENDEL 3/6 schliesst: der Zielsatz gilt nach Abschluss von cd110019 WEITER. Owner woertlich: "cross-host dispatch klingt sinnvoll um beide unsere maschienen, voll zu nutzen"]
ROLLE: 
GROESSE: 
FLAECHE: 
VERIFY: POST /api/self/criterion
DONE: Q1–Q6 am Baum und an den genannten Vorarbeiten beantworten, je ein pruefbares Done-Kriterium und einen Verifikationsweg nennen, per POST /api/self/criterion ablegen und stoppen; kein Produktcode.
```

### 6067c240 — pending

Alte gaps, woertlich:

```text
surface.files: "NEU" is not tracked in this repository
surface.files: "docs/messungen/2026-09-XX-worktrail-v.md" is not tracked in this repository
surface.files: "liest" is not tracked in this repository
surface.files: "read-only" is not tracked in this repository
surface.files: "lane-outcomes.jsonl" is not tracked in this repository
surface.files: "post-land-audits.jsonl" is not tracked in this repository
surface.files: "audit-adjudications.jsonl" is not tracked in this repository
surface.files: "context-receipts.jsonl" is not tracked in this repository
surface.files: "streams/prompts.jsonl" is not tracked in this repository
surface.files: "land-quality.jsonl" is not tracked in this repository
surface.files: "cards.jsonl" is not tracked in this repository
surface.files: "fleet-reports.jsonl" is not tracked in this repository
surface.files: "(falls" is not tracked in this repository
surface.files: "E2/E3" is not tracked in this repository
surface.files: "gelandet)" is not tracked in this repository
surface.files: "Claude-Transkripte" is not tracked in this repository
surface.files: "git" is not tracked in this repository
surface.files: "log" is not tracked in this repository
surface.files: "14" is not tracked in this repository
```

Ursache und Erhalt der Absicht: FLAECHE vermischt die neue Notiz und reine Lesequellen mit Aenderungszielen. NEU behaelt den vorhandenen XX-Platzhalter: das Ausfuehrungsdatum ist noch offen. Die Bedingung „E2 gelandet“ bleibt im Titel; der Export identifiziert keine eindeutige E2-Abhaengigkeits-ID. Der Kommentar mit wiederkehrenden Hand-Abfragen und Top-3-Verb-Zeilen bleibt verbindlicher Kontext.

```text
[QUEUE-INTELLIGENZ E5 · WORKTRAIL-ANALYSE LAUF 1, PERIODISCH: 14 Tage, Pflicht-Ausgang drei Auftragszeilen + eine Kennzahl · NACH land-quality.ts (E2) gelandet · Orchestrator Slot 8, docs/messungen/2026-09-14-queue-intelligenz-schichten.md §5 E5]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: gross
FLAECHE: docs/messungen/INDEX.md
NEU: docs/messungen/2026-09-XX-worktrail-v.md
VERIFY: install, pins (docs-only-Land); der Report nennt die drei Auftragszeilen — als Lane VOLLSTAENDIG mit ROLLE/GROESSE/FLAECHE/VERIFY/DONE im Doc §"Ausgang" ausformuliert, die MAIN filet sie ueber ihre Tuer
DONE: Doc mit Front-Matter (frage/urteil/bereich/belege/nicht-gemessen/stand) ueber die letzten 14 d, das (1) Worktrail IV (docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md) nicht wiederholt, sondern die dort als fehlend benannte Verknuepfung liefert: Qualitaet je Lane (rework3d, auditRed) gejoint mit Modell/Harness/Groesse/Brief-Bytes/Quellpaket/Karte; (2) mindestens DREI Auftragszeilen mit Karte, die je einen Befund in Code oder Messung ueberfuehren — Zeilen, nicht Notizen (der Notiz-Kanal schloss 3 von 69); (3) EINE stehende Kennzahl mit Definition und heutigem Wert, die Lauf 2 wieder misst (Vorschlag: rework3d % je Modellklasse); (4) Abschnitt "Was Lauf 2 anders braucht" (Eingabe, Takt, Senke) als Vorlage fuer die Takt-Mechanik.
```

### 1ed2f6a0 — pending

Alte gaps, woertlich:

```text
surface.symbols: "server.ts#dispatchTask" is not named as a change target in the request
surface.symbols: "server.ts#briefAndSend" is not named as a change target in the request
surface.symbols: "server.ts#mergeJob" is not named as a change target in the request
```

Ursache und Erhalt der Absicht: Die nachgestellten #Symbole sind keine vom Quote-Check erkannte Kette, und DONE (Vorschlag, …) ist kein Format-Key. CLARIFY FIRST bleibt eine echte Stopplinie: die Flaeche bezeichnet nur den vorgeschlagenen spaeteren Bau, keine aktuelle Bau-Erlaubnis; zuerst das vorgeschlagene DONE anhand der bewerteten Paarung 1 schaerfen. variant-compare.jsonl ist Laufzeit-Ledger, keine neu zu commit­tende Datei. Paarung 1 bewertet bleibt fachliche Voraussetzung ohne erfundene NACH-ID.

```text
[QUEUE-INTELLIGENZ E4 · VARIANTENGRUPPE: eine Zeile, n Modelle, genau eine landet · CLARIFY FIRST · NACH Paarung 1 (E2 Variante A/B) bewertet · Orchestrator Slot 8, docs/messungen/2026-09-14-queue-intelligenz-schichten.md §5 E4]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: gross
FLAECHE: server/types.ts#Task, server.ts#tickDispatch/#dispatchTask/#briefAndSend/#mergeJob, start-plan.ts, task-land-waves.ts, src/client.ts, e2e/tasks.ts, docs/queue-analyst.md
VERIFY: install, pins, tsc, build; ./e2e-isolated.sh per Suite-Offer; ./e2e-clean-review.sh (Merge-/Land-Pfad)
DONE: eine Zeile traegt `variants: [{harness,model,effort}]`; der Tick spawnt je Variante eine Lane mit byte-identischem Brief (gleiches Receipt-briefHash), Kollision zwischen Varianten derselben Gruppe blockiert nicht; wenn alle Varianten done-looking sind, schreibt der Server einen Vergleich nach land-quality-Schema in ein Ledger (variant-compare.jsonl: DONE-Teile erfuellt lt. Report-Footer, Gate-Verdikt, Diff-Zeilen, Dateien; Regel: mehr erfuellte DONE-Teile > Gate gruen > kleinerer Diff) und markiert GENAU EINE Branch als landbar, die anderen shelved (Branch bleibt); ein kalibriertes Modell-Urteil ist OPTIONAL und traegt seine Trefferquote gegen rework3d mit — nie allein entscheidend; KEIN Owner-Schritt im Pfad.
```

### 8b2baf60 — pending

Alte gaps, woertlich:

```text
surface.files: "(~19858)" is not tracked in this repository
surface.files: "und" is not tracked in this repository
surface.files: "laneToolResultBytes" is not tracked in this repository
surface.files: "(Transkript-Leser" is not tracked in this repository
surface.files: "isSidechain-Zeilen)" is not tracked in this repository
surface.files: "oder" is not tracked in this repository
surface.files: "(Outcome-Check)" is not tracked in this repository
surface.symbols: "card-extract.ts#parseFormattedCard" is not named as a change target in the request
surface.symbols: "server/types.ts#LaneOutcome" does not resolve — not in the symbol graph, and server/types.ts declares no top-level LaneOutcome
```

Ursache und Erhalt der Absicht: FLAECHE enthaelt Prosa und eine unvollstaendige Symbolkette; LaneOutcome steht tatsaechlich in server.ts:20453, nicht server/types.ts. e2e/slots.ts ODER e2e/programs.ts bleibt eine Wahl fuer den Outcome-Check, nicht Pflicht zu beiden. Der Kommentar verlangt Brief-Template-Aenderungen, die der Auftrag ausdruecklich verbietet: nicht in die Flaeche aufgenommen, Konflikt vor Ausfuehrung durch die Orchestratorin aufloesen.

```text
[ROLLEN-SYNTHESE S2 · DELEGATION GEBRIEFT UND MESSBAR: Kopfzeilen DELEGATION/VERBOTEN im Parser, subagentCalls/subagentTokens im Ledger · mechanisch, ohne Owner-Session · NACH Welle 1 QUEUE-INTELLIGENZ (fcc2f89c) · Orchestrator Slot 8, docs/messungen/2026-09-14-rollen-briefe-synthese.md §3 S2]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: card-extract.ts#FORMAT_KEYS/#parseFormattedCard, server.ts#LaneOutcome/#buildLaneOutcome/#laneToolResultBytes, e2e/tasks.ts, e2e/slots.ts, e2e/programs.ts, docs/queue-analyst.md
NACH: fcc2f89c
VERIFY: install, pins, tsc, build; ./e2e-isolated.sh per Suite-Offer (e2e/ angefasst)
DONE: (1) eine Zeile mit den Kopfzeilen `DELEGATION: erdung:read-only, max 2` und `VERBOTEN: ...` ist eine GUELTIGE formatierte Karte (heute bricht parseFormattedCard am unbekannten Key ab) und beide Werte stehen auf card.delegation / card.verboten; (2) LaneOutcome traegt `subagentCalls` und `subagentTokens`, gelesen aus dem Claude-Transkript (isSidechain-Zeilen), `null` fuer Lanes ohne Transkript (codex/pi) — nie 0; (3) Checks in e2e/tasks.ts gegen ein Fixture-Transkript: Positiv-, Null- und Unbekannt-Fall; (4) KEINE Aenderung am Brief-Template und KEIN AGENTS.md-Absatz — die gehoeren in die Owner-Session (Zeile S1/S4).
```

### fa07734f — pending

Alte gaps, woertlich:

```text
surface.files: "NEU" is not tracked in this repository
surface.files: ".fleet/klassen.json" is not tracked in this repository
surface.files: "(Register" is not tracked in this repository
surface.files: "nach" is not tracked in this repository
surface.files: "§2c:" is not tracked in this repository
surface.files: "kopf" is not tracked in this repository
surface.files: "·" is not tracked in this repository
surface.files: "hand" is not tracked in this repository
surface.files: "·" is not tracked in this repository
surface.files: "urteil" is not tracked in this repository
surface.files: "·" is not tracked in this repository
surface.files: "form" is not tracked in this repository
surface.files: "je" is not tracked in this repository
surface.files: "Klasse" is not tracked in this repository
surface.files: "Qualifikation" is not tracked in this repository
surface.files: "+" is not tracked in this repository
surface.files: "Version" is not tracked in this repository
surface.files: "Harness" is not tracked in this repository
surface.files: "als" is not tracked in this repository
surface.files: "Attribut)" is not tracked in this repository
```

Ursache und Erhalt der Absicht: NEU und Registerbeschreibung werden als bestehende Dateien gelesen. .fleet/ ist durch .fleet/context-packs.json und .fleet/init.md getrackt. NACH S2 wird zur bekannten ID 8b2baf60. Der Owner-Kommentar bestaetigt die vier Klassen und kopf=Fable 5.1; Schattenbetrieb und ROLLE-Override bleiben, kein scharfer Spawn-Resolver.

```text
[ROLLEN-SYNTHESE S3-SCHATTEN · KLASSE ALS REGISTER, nur Schatten: .fleet/klassen.json, KLASSE:-Kopfzeile, Receipt traegt die aufgeloeste Klasse, Spawn byte-identisch · mechanisch · NACH S2 · Orchestrator Slot 8, docs/messungen/2026-09-14-rollen-briefe-synthese.md §2c/§3 S3]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: card-extract.ts#FORMAT_KEYS/#validateCard, server.ts#briefAndSend, e2e/tasks.ts, docs/queue-analyst.md, docs/self-api.md
NEU: .fleet/klassen.json
NACH: 8b2baf60
VERIFY: install, pins, tsc, build; ./e2e-isolated.sh per Suite-Offer
DONE: eine Zeile mit `KLASSE: hand` ist gueltige Karte (unbekannte Klasse = benannte gap), ihr Dispatch-Receipt traegt `executionClass: "hand@1"` und das aufgeloeste Tripel `claude-opus-5[1m]/high`, und der SPAWN ist byte-identisch zu heute (Pin: Spawn-Zeile mit und ohne KLASSE gleich); ROLLE bleibt Override und gewinnt; Resolver-Checks in e2e/tasks.ts: unbekannte Klasse, Tripel-Override, legacy-Zeile ohne KLASSE unveraendert, unzulaessiger Effort je Harness. Klassenvokabular vorlaeufig nach Doc-Empfehlung (Owner-Fragen 1-3) — wird in der Owner-Session bestaetigt oder umbenannt, das Register macht die Umbenennung zu einem Datei-Edit.
```

### 35654b07 — pending

Alte gaps, woertlich:

```text
surface.symbols: "e2e-stage.sh#_st_inherited" is not named as a change target in the request
surface.symbols: "server.ts#inheritedSuiteHolder" is not named as a change target in the request
```

Ursache und Erhalt der Absicht: Die Klammernotation benennt keine datei#symbol-Referenz; _st_inherited ist zudem eine Shell-Variable (e2e-stage.sh:220), deshalb bleibt die Shell-Datei die Flaeche. NACH de754f94 ist wortgetreu, aber im Export nicht vorhanden; auch die nicht per ID benannte Gate-Integritaets-Zeile bleibt eine unerledigte Abhaengigkeit.

```text
[FLEET-BETRIEB · PRUEFAPPARATUR (3): SUITE-MUTEX — Erben prueft keine Prozessgeburt, sieben Boot-curl ohne Deadline · Astra-Befunde 2+6 · Orchestrator Slot 7]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: e2e-stage.sh, server.ts#inheritedSuiteHolder, e2e-claude-gate.sh, e2e-clean-review.sh, e2e-isolated.sh, e2e-postland-audit.sh, e2e-security.sh, e2e/pins.ts
NACH: de754f94
VERIFY: install, pins, tsc, build, die drei Gate-Suiten lokal; ./e2e-postland-audit.sh lokal; ./e2e-isolated.sh ueber den Suite-Offer.
DONE: (a) gleiche PID mit gleicher birth ⇒ erbt; andere oder unlesbare birth ⇒ erbt NICHT und reiht sich ein (drei deterministische Checks, Shell und Server gleich); (b) jede Boot-Probe hat eine Gesamt-Deadline; ein lokaler Responder, der annimmt und nie antwortet, beendet die Probe innerhalb der Deadline (Check); ein Pin haelt „curl in Wrapper-Bootschleife traegt --max-time"; (c) Semantik aus CLAUDE.md §Suiten unveraendert: pid-lose Lock-Dir wird nie gereapt, Ticket-Ordnung bleibt.
```

### bf6fc2ea — queued

Alte gaps, woertlich:

```text
surface.symbols: "server.ts#sendText" is not named as a change target in the request
surface.symbols: "server.ts#canDeliver" is not named as a change target in the request
```

Ursache und Erhalt der Absicht: Die Symbole stehen in Klammern statt als vollstaendige Referenzen. Die Route bleibt Ziel in server.ts; e2e/slots.ts ODER e2e/watch.ts bleibt die im Original erlaubte Familienwahl, docs/self-api.md kommt aus DONE (d).

```text
[FLEET-BETRIEB · BEFUND LIVE 2026-09-14 12:08: ein Owner-POST /send in einen gerade spawnenden Lane-Slot toetet die Lane · klein · Orchestrator Slot 7]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: klein
FLAECHE: server.ts#sendText/#canDeliver, e2e/slots.ts, e2e/watch.ts, docs/self-api.md
VERIFY: install, pins, tsc, build, die drei Gate-Suiten; ./e2e-isolated.sh ueber den Suite-Offer.
DONE: (a) POST /send nimmt optional openedAt (oder sessionId) und antwortet 409 mit Nennung des aktuellen Occupants, wenn der Slot seither neu besetzt ist (Check: open → send mit altem openedAt ⇒ 409, nichts in der Pane); (b) ein /send in einen Slot, dessen Agent-Probe nicht alive ist, antwortet 409 statt zu tippen (Check mit Stand-in, der erst verzoegert startet); (c) heutige Aufrufer ohne das Feld verhalten sich wie bisher, ausser (b); (d) docs/self-api.md bzw. die /send-Doku nennt beide Ablehnungen.
```

### 3cbbe209 — queued

Alte gaps, woertlich:

```text
surface.symbols: "card-extract.ts#validateCard" is not named as a change target in the request
surface.symbols: "card-extract.ts#namedInChain" is not named as a change target in the request
surface.symbols: "card-extract.ts#parseCardAnswer" is not named as a change target in the request
```

Ursache und Erhalt der Absicht: Der Extraktor macht Prosa zu Symbolreferenzen; namedInChain ist lokal in validateCard (card-extract.ts:275) und wird deshalb durch dessen umschliessendes Symbol adressiert, nicht als erfundene Top-Level-Deklaration.

```text
[FLEET-BETRIEB · KARTEN-VALIDATOR: ZWEI MECHANISCHE LUECKEN AUS DER A/B-MESSUNG · klein · Program-MAIN]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: klein
FLAECHE: card-extract.ts#validateCard/#parseCardAnswer, e2e/tasks.ts
VERIFY: bun install --frozen-lockfile, bun e2e/pins.ts, gate tsc, bun run build, die drei Gate-Suiten (Logs in Dateien, Tail zitieren). Keine volle Suite.
DONE: (a) Check: Anfrage mit `server.ts#foo #bar` → Karte mit symbols [server.ts#foo, server.ts#bar] hat KEINE „not named"-Luecke; (b) Gegenprobe: `server.ts#foo` genannt, Karte mit server.ts#baz → Luecke bleibt; (c) Check: Antwort mit `"text": "a „x" b"` wird gelesen; (d) Gegenprobe: echt kaputtes JSON (fehlende Klammer) bleibt null; (e) jede Aenderung am Rest von validateCard ist ein Fail.
```

### e8a5baab — pending

Alte gaps, woertlich:

```text
surface.creates: "docs/codex-agents/erdung.toml" — its directory docs/codex-agents/ is not tracked in this repository
```

Ursache und Erhalt der Absicht: Der geforderte neue Agenten-Unterordner ist nicht getrackt; reine Kopfkorrektur kann die vom Validator verlangte Verzeichnisgrundlage nicht schaffen. ROLLE ist aus dem Original uebernommen, GROESSE bleibt mangels Vorgabe leer. NEU zeigt die beiden originalen, von der Ladeprobe abhaengigen Alternativen, niemals den Auftrag beide zu bauen; beide werden gesondert geprueft. Kein Ausweichen in einen anderen Pfad nur fuer Gruen.

```text
[DELEGATION (Codex-Haelfte) · READ-ONLY-ERDUNGS-AGENT ALS GETRACKTE DATEI, UND AGENTS.md SAGT, WANN DELEGIERT WIRD]
ROLLE: claude / claude-opus-5[1m] / high
GROESSE: 
FLAECHE: AGENTS.md
NEU: .codex/agents/erdung.toml, docs/codex-agents/erdung.toml
VERIFY: pins (Land-Gate: docs+TOML ⇒ kurze Kette). Keine Suite.
DONE: Probe-Ergebnis (laedt/laedt nicht, mit Kontrolle) steht im Report; `rg -n 'DELEGATION' AGENTS.md` trifft den neuen Absatz; die TOML liegt getrackt (Pfad je nach Probe) und `sandbox_mode = "read-only"` steht darin; `bun e2e/pins.ts` gruen.
```

### 1216923f — pending · gehalten/ersetzt

Alte gaps, woertlich:

```text
surface.files: "(Server-Env)" is not tracked in this repository
surface.files: "(feste" is not tracked in this repository
surface.files: "GIT_TICK_MS`-Konstante" is not tracked in this repository
surface.files: "liest" is not tracked in this repository
surface.files: "die" is not tracked in this repository
surface.files: "Env)" is not tracked in this repository
surface.files: "falls" is not tracked in this repository
surface.files: "ein" is not tracked in this repository
surface.files: "Pin" is not tracked in this repository
surface.files: "den" is not tracked in this repository
surface.files: "Wert" is not tracked in this repository
surface.files: "haelt" is not tracked in this repository
```

Ursache und Erhalt der Absicht: FLAECHE enthaelt Klammerprosa; e2e/pins.ts bleibt bedingt „falls ein Pin den Wert haelt“, die im DONE verlangte Ergebnisnotiz ist jetzt konkret benannt. GEHALTEN UND ERSETZT durch 5aeaa29d: nicht erneut freigeben.

```text
[FLEET-BETRIEB · SUITE SCHNELLER (4.1): GIT-TICK-LATENZ DER SUITE BEWEISEN UND SCHNEIDEN (199 s) · aus der Phasen-Messung c3837cab · Program-MAIN]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: klein
FLAECHE: e2e-isolated.sh, e2e/security.ts, e2e/pins.ts, docs/messungen/2026-09-14-suite-wartezeit-phasen.md
VERIFY: install, pins, tsc, build; zwei `./e2e-isolated.sh`-Laeufe auf demselben Baum mit und ohne `FLEET_GIT_TICK_MS=2000`, beide mit `phases`; Auswertung wie in die Phasen-Notiz „Suite-Wartezeit je Phase" vom 2026-09-14, Abschnitt Methode (git show main:docs/messungen/INDEX.md nennt den Pfad)
DONE: ALL PASS mit dem kuerzeren Tick; `phaseSum` sleep an `e2e/programs.ts#waitDoneLooking` sinkt von 190,7 s auf ≤ 60 s und an `e2e/security.ts#agentOf` von 33,0 s auf ≤ 12 s; der Lauf ohne Umschaltung reproduziert die Ausgangszahl ±15 %. Bleibt die 6–10-s-Haeufung trotz 2-s-Tick, ist die Git-Tick-Zuordnung widerlegt, und das steht dann als Ergebnis in der Notiz.
```

### 88a0bf52 — pending · gehalten/ersetzt

Alte gaps, woertlich:

```text
surface.files: "(Env-Override" is not tracked in this repository
surface.files: "mit" is not tracked in this repository
surface.files: "Produktions-Default)" is not tracked in this repository
```

Ursache und Erhalt der Absicht: Die Erlaeuterung zum Env-Override wird als Dateiliste geparst. GEHALTEN UND ERSETZT durch 5aeaa29d: nicht erneut freigeben.

```text
[FLEET-BETRIEB · SUITE SCHNELLER (4.2): BOOT-GRACE-KONSTANTEN FUER DIE SUITE EINSTELLBAR MACHEN (187 s) · aus der Phasen-Messung c3837cab · Program-MAIN]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: server.ts#FOUNDING_BOOT_GRACE_MS/#SEND_BOOT_WAIT_MS, e2e-isolated.sh, e2e/pins.ts
VERIFY: install, pins, tsc, build; `./e2e-isolated.sh` mit gesetzten Suite-Werten; `./e2e-claude-gate.sh`, weil der Zustellpfad beruehrt ist
DONE: ohne Env bleiben die Produktionswerte 4 000/3 000 (Pin); ALL PASS mit Suite-Werten; `phaseSum` http an den `beginBootstrap`-Aufrufstellen sinkt von 143,3 s um ≥ 50 %, und sleep in `e2e/tasks.ts#dispatchAndRead` + `#rowAfter` sinkt von 43,7 s um ≥ 40 %; kein Check, der die Grace selbst prueft, verliert seine Gegenprobe.
```

### 54de1085 — pending · gehalten/ersetzt

Alte gaps, woertlich:

```text
surface.files: "(`FLEET_MERGE_IDLE_MS`)" is not tracked in this repository
surface.files: "(Suite-Wert)" is not tracked in this repository
surface.files: "Checks" is not tracked in this repository
surface.files: "die" is not tracked in this repository
surface.files: "das" is not tracked in this repository
surface.files: "Idle-Gate" is not tracked in this repository
surface.files: "selbst" is not tracked in this repository
surface.files: "verweigern" is not tracked in this repository
surface.files: "lassen" is not tracked in this repository
surface.files: "in" is not tracked in this repository
surface.files: "e2e/merge.ts`)" is not tracked in this repository
surface.symbols: "(`e2e/lane-helpers.ts#settleForMerge`-Aufrufer" names an untracked file
```

Ursache und Erhalt der Absicht: FLAECHE vermischt Beschreibung, Aufrufer und einen syntaktisch kaputten Symboltoken; e2e/merge.ts ist der genannte Aenderungsort der Gegenproben, settleForMerge bleibt Messreferenz. GEHALTEN UND ERSETZT durch 5aeaa29d: nicht erneut freigeben.

```text
[FLEET-BETRIEB · SUITE SCHNELLER (4.3): MERGE-IDLE-GATE DER SUITE SENKEN (145 s) · aus der Phasen-Messung c3837cab · Program-MAIN]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: klein
FLAECHE: e2e-isolated.sh, e2e/pins.ts, e2e/merge.ts
VERIFY: install, pins, tsc, build; `./e2e-isolated.sh` und `./e2e-clean-review.sh` (Merge-Pfad) mit `FLEET_MERGE_IDLE_MS=500`, beide mit `phases`
DONE: ALL PASS in beiden Suiten; `phaseSum` sleep an `e2e/lane-helpers.ts#settleForMerge` sinkt von 145,4 s auf ≤ 50 s; die Idle-Gate-Verweigerungs-Checks bleiben rot bei Pane-Output innerhalb des Fensters (Gegenprobe im Lauf nachgewiesen).
```

### 5421694d — queued

Alte gaps, woertlich:

```text
surface.symbols: "e2e/tasks.ts" is not a datei#symbol reference
```

Ursache und Erhalt der Absicht: Der Extraktor hat e2e/tasks.ts als Symbol statt Datei ausgegeben. parseDiffHunks wird importiert/wiederverwendet, rangesCollide darf laut DO NOT nicht geaendert werden: beide bleiben Lesekontext, keine Schreibflaeche.

```text
[FLEET-BETRIEB · START-PLAN: EINE LAUFENDE LANE KOLLIDIERT MIT IHREN ECHTEN HUNKS STATT MIT DER GANZEN DATEI · mittel]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: start-plan.ts#collision/#StartPlanLane, server.ts#startPlanWaves, e2e/tasks.ts
VERIFY: volle Gate-Kette (Logs in Dateien, Tail zitieren) + ./e2e-isolated.sh ueber Suite-Offer, weil e2e/ angefasst.
DONE: (a) Check: Lane mit server.ts ohne Row-Ranges und Hunk bei Zeile 100-120; Zeile mit Range server.ts 5000-5100 => next "now"; (b) Gegenprobe: Zeilen-Range 110-130 => collides; (c) Gegenprobe: Lane nennt server.ts, hat die Datei noch nicht geaendert => collides; (d) Check: GET /api/start-plan und `bun start-plan.ts --state` liefern weiterhin dasselbe Objekt (bestehender (sp)-Check bleibt gruen); (e) die Wartenotiz nennt bei Hunk-Kollision die Datei wie heute.
```

### d4888c26 — pending

Alte gaps, woertlich:

```text
surface.symbols: "e2e/pins.ts#RULE_LEDGER" is not named as a change target in the request
```

Ursache und Erhalt der Absicht: RULE_LEDGER wurde aus einem Suchbefehl als Aenderungssymbol gehoben; die Flaeche ist e2e/pins.ts, waehrend server/persist.ts und briefstats.ts nur Quelle beziehungsweise Muster bleiben. Die explizit ausgeschlossene isolated-Suite wird im VERIFY nicht mit ihrem Alias genannt, damit der Alias-Normalisierer die Negation nicht in eine Forderung verwandelt.

```text
[FLEET-BETRIEB · KLEIN · land-quality.ts#readJsonl und lane-context-cost.ts#readJsonl sind die letzten zwei Handkopien von readLedger · Nachzug zu 15b6f12a]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: klein
FLAECHE: land-quality.ts#readJsonl, lane-context-cost.ts#readJsonl, e2e/pins.ts
VERIFY: GET /api/self/gate -> localProof.steps; mindestens install, pins, tsc (volle Liste aus watchdog.sh VERIFY_CMD), build. Keine isolierte Suite (e2e/ nur pins.ts).
DONE: (a) beide readJsonl delegieren an readLedger aus server/persist.ts (Blatt-Modul; `grep -n '^import' server/persist.ts` bestaetigt es); land-quality behaelt {rows, malformed}; lane-context-cost behaelt seine Rueckgabeform Row[] fuer alle Aufrufer, und falls es einen Ausgabeort fuer malformed gibt, nennt es die Zahl, sonst unveraendert. (b) ein Pin in e2e/pins.ts neben RULE_LEDGER (rg -n 'RULE_LEDGER' e2e/pins.ts): beide CLIs importieren readLedger und definieren keine eigene JSON.parse-Zeilenschleife mehr; Mutation (Handkopie zurueck) => rot, im Report zitiert. (c) `bun land-quality.ts` und `bun lane-context-cost.ts` laufen im Haupt-Checkout-Ledger unveraendert durch (Ausgabe-Tail im Report).
```

### 5aeaa29d — queued

Alte gaps, woertlich:

```text
surface.symbols: "e2e/programs.ts#waitDoneLooking" does not resolve — not in the symbol graph, and e2e/programs.ts declares no top-level waitDoneLooking
surface.symbols: "e2e/security.ts#agentOf" does not resolve — not in the symbol graph, and e2e/security.ts declares no top-level agentOf
surface.symbols: "e2e/tasks.ts#dispatchAndRead" does not resolve — not in the symbol graph, and e2e/tasks.ts declares no top-level dispatchAndRead
surface.symbols: "e2e/tasks.ts#rowAfter" is not named as a change target in the request
```

Ursache und Erhalt der Absicht: Messstellen aus BEFUND wurden zu Aenderungssymbolen; mehrere sind keine Top-Level-Deklarationen. Sie bleiben Beweisreferenzen, der Nachtrag aus DONE (f) bekommt den im Index belegten Dateipfad. Lokale Fenster-Anpassungen bleiben nur dort erlaubt, wo DONE (d) sie verlangt; keine pauschale Erweiterung auf alle Messstellen-Dateien.

```text
[FLEET-BETRIEB · SUITE SCHNELLER (4.1+4.2+4.3 ALS EINE LANE): GIT-TICK, BOOT-GRACE, MERGE-IDLE FUER DIE SUITE · ersetzt 1216923f, 88a0bf52, 54de1085 (gehalten) · Program-MAIN Slot 8, 2026-09-14]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: e2e-isolated.sh, server.ts, e2e/security.ts, e2e/pins.ts, docs/messungen/2026-09-14-suite-wartezeit-phasen.md
VERIFY: GET /api/self/gate zuerst; install, pins, tsc (volle Liste aus watchdog.sh VERIFY_CMD), build; `./e2e-claude-gate.sh` (Zustellpfad beruehrt); `./e2e-clean-review.sh` (Merge-Idle-Gate); GENAU EIN `./e2e-isolated.sh`-Lauf mit phases auf dem fertigen Baum, Ausgabe in eine Log-Datei, Tail zitieren. Kein Baseline-Lauf: die Ausgangszahlen stehen in der Phasen-Notiz; Methode wie dort. Suite-Laeufe SERIELL, nie zwei gleichzeitig. Liegt ein Helfer frei (gate.helper, kein laufendes Audit), biete den isolierten Lauf per suite-offer an; sonst lokal.
DONE: (a) ALL PASS in isolated, clean-review, claude-gate. (b) phaseSum sleep an waitDoneLooking <= 60 s, an agentOf <= 12 s, an settleForMerge <= 50 s; http an beginBootstrap-Aufrufstellen sinkt um >= 50 %. (c) Gesamt-Wandzeit des isolated-Laufs gegen 2 225 s als Zahl im Report. (d) Jede Gegenprobe, die ein Idle-Gate, die Boot-Grace oder den Tick SELBST verweigern laesst, bleibt rot bei Output im Fenster — im Lauf nachgewiesen und zitiert; ein Check, der dafuer ein Fenster braucht, bekommt es lokal statt dass der Suite-Wert steigt. (e) Bleibt ein Ziel aus (b) verfehlt, steht das mit der gemessenen Zahl als Ergebnis im Report, nicht als geschoente Schwelle. (f) Kurzer Nachtrag in der Phasen-Notiz (neuer datierter Abschnitt) mit den neuen Zahlen.
```

## Pruefskript und gemessene Ausgabe

Aus dem Repo-Wurzelverzeichnis ausfuehren. Keine Server-Initialisierung, kein Import von server.ts: dessen Kontextregeln werden explizit nachgebildet (server.ts:267, :567, :683, :1219, :1274, :11295). Tracked-Dateien und Deklarationstexte kommen aus dem bezeichneten Commit. Ein **leerer, vorhandener Symbolindex** erzwingt fuer jedes Symbol den strengeren Deklarations-Fallback; `null` wuerde im graphlosen Lane-Checkout nur Dateiexistenz pruefen und falsche Symbole uebersehen (card-extract.ts:310–327). Das ist keine Behauptung ueber aktuelle Graph-Ranges. rowKnown kennt ausschliesslich IDs dieses Exports: eine dort fehlende abgeschlossene Zeile ist live **unbekannt**, nicht nachgewiesen inexistierend.

Der Test liest die Ersatzkoepfe direkt aus dieser Notiz, vergleicht die alten gaps bytegetreu mit dem Export und prueft jede Kopf-/Kontextvariante. Die zwei negativen Kontrollen muessen ablehnen. Die Skriptausgabe ist Validator-Evidenz, kein Beweis, dass ein kuenftiger Worker die Absicht erfuellt.

```sh
bun -e '
import { parseFormattedCard, validateCard, declaresSymbol } from "./card-extract.ts";
const source = "/Users/owner/[privater Owner-Ordner]/astra-inputs-2026-09-14/open-tasks.json";
const note = "docs/messungen/2026-09-15-karten-schaerfer-lauf-1.md";
const base = "fc1c18ad078ae942854c7eca62154d57365951fb";
function git(...args: string[]): string {
  const p = Bun.spawnSync(["git", ...args]);
  if (p.exitCode !== 0) throw new Error(p.stderr.toString());
  return p.stdout.toString();
}
const rows = await Bun.file(source).json();
const selected = rows.filter((r) => r.kind === "auftrag" && r.programId === "f170dc46e4b026ee34d9392e" && ["pending", "queued"].includes(r.status) && r.card?.valid === false);
const trackedPaths = new Set(git("ls-tree", "-r", "--name-only", base).trim().split("\n"));
const sources = new Map<string, string>();
const ctx = (sourceText: string) => ({
  sourceText, trackedPaths,
  symbolIndex: new Map(),
  harnessKnown: (v: string) => ["claude", "pi", "pi-zai", "pi-ox", "pi-unfenced", "container", "codex"].includes(v),
  modelKnown: (v: string) => /^[A-Za-z0-9._-]{1,64}(?:\[[A-Za-z0-9]{1,8}\])?$/.test(v),
  effortKnown: (v: string) => ["off", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].includes(v),
  declares: (file: string, symbol: string) => {
    if (!sources.has(file)) sources.set(file, git("show", `${base}:${file}`));
    return declaresSymbol(sources.get(file)!, symbol);
  },
  rowKnown: (id: string) => rows.some((r) => r.id === id),
});
const md = await Bun.file(note).text();
let clean = 0;
for (const r of selected) {
  const section = md.split(`### ${r.id} — `)[1]?.split(/\n#{2,3} /)[0];
  if (!section) throw new Error(`missing section ${r.id}`);
  const blocks = [...section.matchAll(/```text\n([\s\S]*?)\n```/g)];
  if (blocks.length !== 2) throw new Error(`wrong block count ${r.id}`);
  if (blocks[0][1] !== r.card.gaps.join("\n")) throw new Error(`old gaps changed ${r.id}`);
  const head = blocks[1][1];
  const variants = [head, head + "\n\n" + r.text + "\n" + (r.comments ?? []).map((c) => c.text).join("\n")];
  const results = variants.map((text) => {
    const parsed = parseFormattedCard(text);
    if (!parsed) throw new Error(`not formatted ${r.id}`);
    return validateCard(parsed, ctx(text));
  });
  if (JSON.stringify(results[0].gaps) !== JSON.stringify(results[1].gaps)) throw new Error(`context changes gaps ${r.id}`);
  const gaps = results[1].gaps;
  if (!gaps.length) clean++;
  console.log(`${r.id}: ${gaps.length} gaps${gaps.length ? " — OFFEN" : ""}`);
  for (const gap of gaps) console.log(`  ${gap}`);
  if (r.id === "e8a5baab") {
    for (const path of [".codex/agents/erdung.toml", "docs/codex-agents/erdung.toml"]) {
      const text = head.replace(/^NEU:.*$/m, `NEU: ${path}`);
      const result = validateCard(parseFormattedCard(text)!, ctx(text));
      console.log(`  Alternative ${path}: ${result.gaps.length} gaps`);
    }
  }
}
const bad = "[Gegenprobe]\nROLLE: claude/claude-opus-5[1m]/high\nGROESSE: klein\nFLAECHE: __missing_card_probe__.ts\nVERIFY: unbekannter-pruefweg\nDONE: Absichtliche Ablehnung.";
const rejected = validateCard(parseFormattedCard(bad)!, ctx(bad));
if (rejected.valid || rejected.gaps.length !== 2) throw new Error("negative control failed");
if (parseFormattedCard(bad.replace("GROESSE: klein\n", "")) !== null) throw new Error("missing header accepted");
console.log("Gegenproben: unbekannte Datei + VERIFY abgelehnt; fehlender Pflichtkopf => null");
console.log(`Auswahl ${selected.length}; 0 gaps ${clean}; offen ${selected.length - clean}`);
'
```

Gemessene Ausgabe:

```text
f3ca2e05: 1 gaps — OFFEN
  verify: "POST /api/self/criterion" names no known chain step (install, pins, tsc, build, clean-review, security, claude-gate)
6067c240: 0 gaps
1ed2f6a0: 0 gaps
8b2baf60: 1 gaps — OFFEN
  after: "fcc2f89c" is not a queue row
fa07734f: 0 gaps
35654b07: 1 gaps — OFFEN
  after: "de754f94" is not a queue row
bf6fc2ea: 0 gaps
3cbbe209: 0 gaps
e8a5baab: 2 gaps — OFFEN
  surface.creates: ".codex/agents/erdung.toml" — its directory .codex/agents/ is not tracked in this repository
  surface.creates: "docs/codex-agents/erdung.toml" — its directory docs/codex-agents/ is not tracked in this repository
  Alternative .codex/agents/erdung.toml: 1 gaps
  Alternative docs/codex-agents/erdung.toml: 1 gaps
1216923f: 0 gaps
88a0bf52: 0 gaps
54de1085: 0 gaps
5421694d: 0 gaps
d4888c26: 0 gaps
5aeaa29d: 0 gaps
Gegenproben: unbekannte Datei + VERIFY abgelehnt; fehlender Pflichtkopf => null
Auswahl 15; 0 gaps 11; offen 4
```

## Offene Grenzen fuer die Ernte

- **f3ca2e05:** Der unveraenderte Clarify-Auftrag hat keinen Kettenbefehl; einen sachfremden `pins`-Befehl nur fuer Gruen hinzuzufuegen wuerde eine neue Verifikationspflicht erfinden. Rolle/Groesse bleiben nicht festgelegt. Q1–Q6 des Texts und Q1–Q4 der gespeicherten Karte widersprechen sich; kein stiller Wechsel zur Karten-Zusammenfassung.
- **8b2baf60 / 35654b07:** MAIN muss fcc2f89c beziehungsweise de754f94 gegen die vollstaendige Queue aufloesen; bei 35654b07 zusaetzlich die Gate-Integritaets-Zeile identifizieren. Fehlende Export-Evidenz wird nicht als aufgeloeste Abhaengigkeit verkauft. Bei 8b2baf60 ist ausserdem der Kommentar zum Brief-Template mit dem ausdruecklichen Verbot im Auftrag abzugleichen.
- **e8a5baab:** Beide vom Auftrag erlaubten Ablagevarianten bleiben rot. Ohne bereits getrackten Elternordner oder eine gesondert autorisierte Vertrags-/Pfadentscheidung gibt es keinen absichtstreuen 0-gaps-Kopf. Der Lauf aendert weder Validator noch Pfadvorgabe.
- **6067c240 / 1ed2f6a0:** „E2 gelandet“ beziehungsweise „Paarung 1 bewertet“ bleiben trotz 0 gaps fachliche Startbedingungen; der Export belegt keine eindeutigen NACH-IDs. **1216923f / 88a0bf52 / 54de1085:** gehaltene, durch 5aeaa29d ersetzte Vorlaeufer; 0 gaps ist kein Grund fuer erneutes Filing oder Release.

Die Messung hat keine Aufgaben ausgefuehrt oder Queue-Zustaende geaendert. Die einzige Baum-Aenderung ist diese Notiz; die INDEX-Ergaenzung gehoert der Orchestratorin. Der Knowledge-Index war unter `/Users/owner/.Codex/knowledge/INDEX.md` und `/Users/owner/.codex/knowledge/INDEX.md` nicht vorhanden; die Arbeit stuetzt sich auf die genannten aktuellen Quellen.

## Verifikation dieser Notiz

`bun install --frozen-lockfile` endete mit Exit 0; `bun e2e/pins.ts` endete mit Exit 0. Tail:

```text
PASS  land-log.ts prints one line per land and one direct-commit line per day — with no audit ledger every land says "audit ?", not a verdict  (   audit ? | l  audit ? |    audit ? |    audit ?)
PASS  land-log.ts prints one line per land and one direct-commit line per day — verify reads no gate, the skip exit and a waitedOut as skipped  (skipped,skipped,skipped,failed,proportional,ok)
PASS  land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT  (land-log says 42)

ALL PASS
```

Das Gate wurde vor der Verifikation gelesen. Ohne Commit lieferte es `classifiedAs:{}` und die volle Fallback-Liste, weil `server.ts:3245` nur `base...HEAD` klassifiziert; die erneute Abfrage nach dem Commit lieferte `steps:["install","pins"]`, `isolatedPreview:false` und fuer genau diese Notiz `docs-or-prose`. Der Auftrag fordert die kurze Docs-Kette; keine der Ersatzauftrags-Suiten ist Teil dieses reinen Notizlaufs.

Probenkorrektur: Nach Einbetten des Skripts zaehlte die Abschnittssuche zunaechst den spaeteren Ausgabe-Codeblock zur letzten Karte; der erste Regex-Fix trennte nicht an H3. Beide Laeufe scheiterten als Probe mit `wrong block count`, nicht als Kartenverdict. Die finale Begrenzung `split(/\n#{2,3} /)` trennt H2 und H3; erneuter Lauf auf der fertigen Notiz liefert die oben zitierte Ausgabe. Lektion fuer diese reproduzierbare Probe: Abschnittsende vor Codeblock-Zaehlen bestimmen. Keine AGENTS.md-Aenderung, weil dieser Auftrag ausschliesslich die Notiz autorisiert.
