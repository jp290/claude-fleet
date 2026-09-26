---
frage: Wie bekommen Konzepte Versionen und einen Anmerkungs-Rueckkanal, bei dem nachvollziehbar bleibt, welche Session in welchem Kontext was geaendert hat, ohne ein drittes Provenienz-Vokabular?
urteil: Entwurf, nichts gebaut. Wer = overhaul server/auth.ts#Principal, Kontext = overhaul trace-index.ts#TraceRefs plus TraceDetailRef; Oberflaeche = die vorhandene Kommentar-Schiene (Task.comments) auf ein Konzept-Ziel verallgemeinert, nicht Artifact-Kommentare.
bereich: [konzeptgedaechtnis, s4, entwurf]
belege: [docs/messungen/2026-09-26-s4-pilot-konzeptsicht-claude-fleet.md, docs/overhaul-plan-2026-09-25.md]
nicht-gemessen: Aufwand der Karten; ob T1 (Transkript-Adapter des Trace-Index) rechtzeitig session/call fuellt; Owner-Entscheid zur Oberflaeche
stand: 2026-09-26
---

# Entwurf: Konzept-Versionen und Anmerkungen (S4, vor der Verteilung als Context Pack)

Owner 26.09., wörtlich: „es für Konzepte auch eine Art Collaborationstale geben muss auf dem ich oder
jeweilige Sessions dann anmerkungen für die aktuelle Version … des konzepts machen. Man muss am ende
quasi nachvollziehen können welche session in welchem kontext, welchem situativen drumherum, die
Änderungen vorgenommen hat.“ Dieser Entwurf ist das Schema. Konzeptinhalte und Anmerkungstexte bleiben
privat, nur das Schema und der Code sind öffentlich.

## Was es schon gibt (gelesen 2026-09-26)

- **Wer:** `server/auth.ts#Principal` auf overhaul (`owner{via}` · `session{slot, openedAt, role}` ·
  `device` · `guest` · `machine{why}`), aufgelöst in `resolvePrincipal`. Nicht auf main, noch in keinem
  Ledger geschrieben; D2a (`5b71d60c`, queued) setzt es als `actor` in `audit.jsonl` und fügt
  `unknown{why}` hinzu. Daneben stehen `LandActor` (main) und `TraceActorKind` (overhaul): drei Formen,
  kein gemeinsamer Typ.
- **Kontext:** `trace-index.ts#TraceRefs` auf overhaul (`task, slot, openedAt, branch, sha, program,
  session, call, parent`) plus `TraceDetailRef {source, locator, fp}` als Zeiger auf die auslösende
  Ledger-Zeile. `session`/`call` sind für die T1-Transkript-Adapter reserviert und noch leer; Prompts
  und Receipts liest der Index heute nicht.
- **Oberfläche:** Keine vorhandene Fläche hängt eine Anmerkung an ein versioniertes Objekt. Am
  nächsten ist `Task.comments` (`types.ts#TaskComment`, Thread im Board): an Task-Zeilen gebunden,
  Schreiber nur als Lane-Branch, MAIN-Sessions haben keine Tür (409). Die reichste
  Schreiber-Provenienz tragen Attention und Fleet-Report (`slot, openedAt, sessionId` +
  `taskId, programId`), die sind aber Anfrage- bzw. Berichtsobjekte.

## Schema (zwei Datensätze, append-only)

**Version** — eine Zeile je veröffentlichter Fassung eines Konzepts:
`{konzept: "k-<slug>", version: N, vorgaenger: N-1|null, sha256, at, actor: Principal,
kontext: TraceRefs, anlass: "<≤500 Zeichen>", detailRef?: TraceDetailRef,
arbeitetEin: [anmerkungId…], quellen: {korpus?: "<sha256 quellen>", neu: [candidateId…]}}`

**Anmerkung** — hängt an genau einer Version:
`{id, konzept, version: N, anker?: {abschnitt, satzSha?}, text, at, actor: Principal,
kontext: TraceRefs, detailRef?: TraceDetailRef,
status: "offen" | {eingearbeitet: version} | {verworfen: grund, actor: Principal}}`

Regeln:
1. `actor` ist wörtlich der `Principal` der anfragenden Credential, nie aus dem Body. Fehlt eine,
   ist er `unknown{why}` (D2a), nie Owner.
2. `kontext` ist ein `TraceRefs`: slot+openedAt aus dem Token, program/task aus der Bindung,
   `session` sobald T1 ihn liefert. Das „situative Drumherum“ ist der `detailRef` auf die Zeile, in
   der der Anlass stand (Send-Receipt, Report, Attention-Antwort). Kein eigenes Kontext-Feldset.
3. Eine neue Version nennt in `arbeitetEin`, welche Anmerkungen sie aufnimmt. Die Kette Anmerkung →
   Version → Anlass → Session ist damit rückwärts lesbar.
4. Die erste Version eines Konzepts ist die Pipeline-Fassung. Für `k-claude-fleet` ist das die Sicht
   aus Schnitt 3 (`c3576cf8`), mit `anlass` = Kartentext und `kontext.task` = die Zeile.

**Speicher:** privat unter der Konzeptwurzel (dieselbe Env-Wurzel, die der Pack-Auflöser aus
`f38eb1c8` bekommt): `<wurzel>/<konzept>/v<N>.md`, `versionen.jsonl`, `anmerkungen.jsonl`. Kein neues
Backend. Der Server schreibt, damit `actor` nicht fälschbar ist.

## Oberfläche: Empfehlung und Alternativen

- **Empfohlen: die Kommentar-Schiene verallgemeinern.** Ein Ziel `{kind: "task"|"konzept", id,
  version?}` statt fest Task, Schreiber als `Principal`+`TraceRefs` statt Branch. Owner schreibt im
  Board-Thread, der schon existiert. Sessions schreiben über eine Self-Tür
  `POST /api/self/konzepte/:id/anmerkungen`, offen für Lane UND MAIN (der Owner sagt „jeweilige
  Sessions“). Alle drei Harnesses erreichen sie per curl.
- **Artifact-Kommentare (claude.ai):** fertige Oberfläche, aber der Anmerkungstext verlässt die
  Maschine, nur Claude-Sessions haben das Werkzeug (codex/pi nicht), und der Schreiber wäre der
  claude.ai-Account statt eines `Principal`. Nur als Lese-Spiegel denkbar, und das ist ein Owner-Akt.
- **Board-only ohne Self-Tür:** schneidet die Sessions ab und widerspricht dem Owner-Satz.

## Karten, Reihenfolge (alle base overhaul, nach Owner-Rückmeldung zu schneiden)

1. **Ledger + Türen:** Version- und Anmerkungs-Datensatz, Owner-Route und Self-Tür, Schreiber aus
   `resolvePrincipal`, `kontext` aus Token und Bindung; e2e mit Mutationsprobe „Body-actor wird
   ignoriert“. Braucht D2a nicht zwingend (Principal existiert auf overhaul), profitiert aber davon.
2. **Board-Thread** auf das Konzept-Ziel, Status offen/eingearbeitet/verworfen sichtbar.
3. **Pack `f38eb1c8`** (gehalten) zeigt auf die aktuelle Version statt auf einen festen Hash und
   nennt im Brief die Tür für Anmerkungen. Erst damit hat ein verteiltes Konzept einen Rückkanal.

Offene Owner-Fragen: Oberfläche wie empfohlen? Dürfen Lanes schreiben oder nur MAINs und er?
