# Synthese — Rollen-/Capability-Architektur, vier Perspektiven (2026-08-21)

Baum `de1f6c6`. Kein Code geschrieben, nichts gelandet, nichts deployt. Vier Agenten auf vier
getrennten Gegenstaenden; diese Datei fuehrt sie zusammen und trennt, was sie sagen, von dem, was
davon nachgemessen ist.

| # | Agent | Gegenstand | Ausgabe |
|---|---|---|---|
| 1 | GLM-5.3 / pi-zai, effort high | der Entwurf | `docs/rollen-architektur-glm-2026-08-21.md`, 650 Z. |
| 2 | Opus 5, effort high, frisch | jede Behauptung gegen den Code | `docs/kritik-opus-2026-08-21.md`, 15 gerangte Befunde |
| 3 | pi + claude-bridge/claude-opus-5 | die lebende Maschine, nicht das Dokument | Pane-Bericht, hier als Evidenz §16 |
| 4 | GLM-5.3 / pi-zai #2, ohne Kenntnis von (2) | der Unterbau unter dem Entwurf | `docs/unterbau-audit-glm-2026-08-21.md`, 12 Befunde |

Faktenbasis: `docs/rollen-evidenz-2026-08-21.md` (16 Abschnitte). **Sie enthielt fuenf Fehler, alle
im Lauf gefunden und korrigiert** — drei von mir, einer vom Architekten, einer vom Auditor. Der
letzte davon war aus dem Dossier in den Entwurf gewandert und dort als bestaetigt gefuehrt.

---

## 1. Der Architektur-Vorschlag

**Drei Agentenrollen als typisierte BINDUNGEN eines Sitzes, nicht als Credential-Klassen:**
`lane` (`s.worktree !== null`) · `program-main` (`program.main`-Triple) · `supervisor`
(`isBoundSupervisor`). Darunter zwei Nicht-Agenten-Prinzipale: **Owner** (Mensch) und **Maschine**
(Ticks/Gates, ohne Credential und ohne Ermessen).

Urteil ueber die sieben Kandidaten des Owners: Fleet-Controller = Scope-Parameter, keine Rolle ·
**Fable/kreative MAIN = gar keine Rolle** · Builder-Lane = Modus · Critic = Modus, Resolver =
Policy · Worker/Supervisor/Project-MAIN = je eigene Rolle.

**Der Kern:** `POST /api/self/tasks` — eine gebundene MAIN legt `pending`-Zeilen fuer ihr eigenes
Program an, `programId` aus der Bindung abgeleitet (Koerperangabe → 400), Start bleibt Owner-Akt.
GLMs Satz dafuer: *„die MAIN darf die Schlange fuettern, nicht den Zaun oeffnen."*

**Diese Kernbehauptung HAELT — und zwar staerker, als der Entwurf sie begruendet.** Er argumentiert
mit dem Tick-Filter `t.status === "queued"`. Die eigentliche Garantie ist enger: **`releaseTask()`
(`server.ts:2262`) hat GENAU EINE Aufrufstelle (`:18865`), sie liegt unter der Owner-Wand und
uebergibt hart `"owner"`; der Parameterwert `"machine"` hat null Aufrufer.** Die zwei
Maschinen-Schreibungen von `queued` (`:6303`, `:14413`) stellen nur bereits freigegebene Zeilen
zurueck. Unabhaengig bestaetigt vom Kritiker (§2.1) und von mir (Evidenz §15).

**Der Rueckbau, den der Entwurf vorschlaegt:** Steward-Token-Klasse, `STEWARD_LABEL` (21 Vorkommen),
`stewardSlot()`, `handleStewardRoute` (14 Routen) — Zuwachs 5, Rueckbau 7.

---

## 2. Die Einwaende des Opus-Kritikers

**Drei Befunde, die je einen Schnitt zum Einsturz bringen — alle von mir am Code nachgeprueft:**

**(1) Schnitt 1 faellt an seinem eigenen Proof-Kommando.** `SystemCapability.stateEffect` ist der
**Literaltyp `"none"`** (`src/protocol.ts:275`); `CAPABILITY_FUNCTIONS` ist eine Union (`:252`) mit
zwei Pins („exactly two", „every stable function comes from SYSTEM.md"). Die gesamte
Wirkungs-Taxonomie aus Abschnitt B ist in die Karte **nicht schreibbar**. Das Write-Set von
Schnitt 1 nennt weder `src/protocol.ts` noch `SYSTEM.md`, und sein Proof beginnt mit
`bun e2e/pins.ts`.

**(2) Schnitt 4 reisst Stufe 1 des Land-Gates ein.** `e2e/pins.ts:732` pinnt den Literalstring
`s.worktree && s.label !== STEWARD_LABEL`, und `bun e2e/pins.ts` **ist** die erste Stufe von
`VERIFY_CMD`. GLMs „nichts Maschinelles bricht" ist messbar falsch. Verschaerft durch den Auditor
(B3): **das Label markiert „Nicht-Lane TROTZ Worktree"** — genau seinen Zweck. Faellt es, wird der
Pulse-Sitz zur Lane und bekommt auf `watch`/`reply`/`attention` 409.

**(3) Der Interventions-Rail: vermeidbare Komplexitaet.** H.2s vier Decision-Arten haben **keinen
Konsumenten**; der einzige vorgeschlagene Join (`respondsTo` „als Audit-Detail") landet im
`detail`-Feld von `audit()`, einem **untypisierten Freitext-String** (`:2992`). Der Entwurf verbietet
sich ein Decision-Register und ersetzt es durch ein Feld, das dessen Aufgabe nicht erfuellen kann.
Empfehlung: **H.2 und H.4 ersatzlos streichen**, H.1/H.3 als Doku-Absatz, und Kante B als eigenen
Schnitt nach dem `replyClarification`-Muster — synchron, eigener Gate, volles Occupant-Triple.

**Und zwei LIVE-DEFEKTE im heutigen Code, gefunden beim Pruefen eines Dokuments:**

- **Eine Codex-Program-MAIN verliert `POST /api/self/attention` — sie kann den Owner nicht mehr
  erreichen.** `boundProgramForMain` (`:5706`) gated auf `sessionId`; `bootstrapProgramMain`
  schreibt fuer Codex `null` (`pinsSession: false`, `:871`); `tickCodexRecovery` (`:3675`) setzt
  danach eine echte uuid. Ab diesem Tick ist der Vergleich fuer immer falsch. Nudge und
  Clarification laufen weiter, weil `clarificationReceiverFor` (`:5301`) ausdruecklich NICHT auf
  `sessionId` gated — mit einem Kommentar, der genau diesen Fall benennt. **Von mir am Code
  bestaetigt.**
- **`boundProgramForMain` ist ein `.find`, keine Eindeutigkeitspruefung**, bei live 13 aktiven
  Programmen. `handleSelfSucceed` (`:5199`) behandelt dieselbe Gefahr korrekt mit einer
  Ambiguitaets-409.

Der Kritiker nennt selbst das Experiment, das seinen schwersten Befund widerlegen wuerde, und sagt,
welche Stelle er dem Entwurf am ehesten unrecht tut.

---

## 3. Die Luecken im Unterbau

Der Auditor kannte die Kritik NICHT. Er widerspricht dem Kritiker in der Rail-Frage: **die
Typisierung sei notwendige Kontrolle zu null Maschinenkosten** — aber zwei ihrer Bindungen seien
Behauptungen ohne Traeger. Beide sind sich einig, dass H.4 gebrochen ist.

**Was der Unterbau WIRKLICH traegt** (alle VERIFIED): Empfaenger-Occupant-Triple · Ack mit
Occupant-Pruefung · Zustellbudget je Slot · begrenzte Nutzlast (hart validiert) · Quittung mit vor
dem Transport gemintetem `sendId` · toter Empfaenger als terminaler Zustand `receiver-gone` ·
**jede Verweigerung mit benanntem Grund**. Und die vier Fundstellen der „sichtbaren Zuordnung":
Receipt-Schreibung, geschlossenes `why`-Vokabular, Leseflaeche, reine Auswahl.

**Was NICHT traegt:**

- **B1 — der Wirksamkeits-Canary kann seinen eigenen Beweis nicht erzeugen.** Die Omissions-Leiter
  prueft `status !== "active"` VOR allen Triggern (`context-plan.ts:79`), also landet ein
  `canary`-Pack **nie** im „ausgewaehlt"-Arm. Die Regel „canary → promoted nur mit Zweiarm-Beweis"
  verhungert strukturell. Zirkulaer.
- **B2 — das Lizenz-Gate hat keinen Maschinenleser.** `PACK_KEYS` ist geschlossen; ein
  `license:`-Feld scheitert als `PACK_UNKNOWN_KEY` (`context-pack-validator.ts:89`). In einem
  oeffentlichen Repo bleibt nach der Promotion nichts, was das `unknown`-Urteil noch trennen
  koennte.
- **B4 — die Nudge-Quittung ist duenner als Dossier UND Entwurf behaupteten.** `supervisorNudge`
  schreibt **keine** Journal-Zeile; `writeStewardJournal` hat drei Aufrufstellen, keine im Nudge.
  **Und eine VERWEIGERTE Zustellung schreibt ueberhaupt nichts** — H.4s „zwei aufeinanderfolgende
  Fehlzustellungen" hat keinen zaehlbaren Sachverhalt. *Dieser Fehler stammt aus meinem Dossier,
  wanderte in den Entwurf und wurde dort als bestaetigt gefuehrt. Erst der dritte, unabhaengige
  Leser hat ihn gefunden.*
- **B5** — eine Lane hat keinen Vorschlagsweg fuer einen Kandidaten. **B7** — der
  `canary`-Zwischenzustand macht aus der EINEN Promotions-Entscheidung zwei Owner-Commits:
  Verstoss gegen die Owner-Grenze. **B8** — `estimatedBytes` hat null Konsumenten, der Deckel
  existiert nicht. **B11** — neue Rolle-/Act-Selektoren brauchen ein Reachability-Aequivalent zum
  Trigger-Pin, sonst entstehen „authored, validated, committed, and silently never delivered"-Packs.

**Und aus dem Canary (die Maschine selbst):** `supports.selfSchedule:false` ist **widerlegt** —
`POST /api/self/autos` gab 200 und persistierte. Der Code sagt selbst, warum: *„FALSE deliberately,
and NOT a claim that the env is absent … The flag means 'do not advertise this'"* (`:557`). Ebenso
`transcript:false` (`:541`). **Beide `supports.*`-Flags sind Politik-Werte, keine
Faehigkeitsmessungen.** Wer daraus eine `harnessSupport`-Spalte baut, liest zwei Vorsichts-Flags als
zwei Unfaehigkeiten. `ctx: null` ist fuer pi ebenfalls falsch — der Harness zeigt 5,9 %/1,0M, Fleet
fragt ihn nur nicht. Und die einzige Faehigkeit, die wirklich fehlt, faellt als einzige **ohne ein
Wort**: die Ernte.

---

## 4. Die minimale Umsetzungsreihenfolge

Abgeleitet aus dem, was alle drei Lesungen ueberlebt hat. **Nichts davon ist freigegeben.**

**0 — Zwei Live-Defekte, unabhaengig von der ganzen Architektur.** Die Codex-Attention-Bindung und
die `.find`-Ambiguitaet. Beide sind heute kaputt, beide klein, beide brauchen keinen Rollenentwurf.
Sie zuerst, weil sie unter jeder Variante der Architektur gelten.

**1 — `propose_task`, OHNE die Karten-Erweiterung.** Route + `Task.source: "main"` + Deckel +
Audit-Wort. Gebunden an das Praedikat, das `clarificationReceiverFor` benutzt (slot + openedAt +
`active`, `sessionId` berichtet statt gegated) **plus** die Ambiguitaets-409 aus `:5199`. Die
Karten-Zeile ist ausdruecklich NICHT Teil dieses Schnitts — sonst faellt er an Befund (1).
**Offener Owner-Entscheid: Default `notiz` oder `auftrag`?** Die zwei Praezedenzfaelle zeigen
gegeneinander — der Steward (vertrauteste Nicht-Owner-Quelle) schreibt `notiz`, `/intake` (am
wenigsten vertraut, oeffentlich erreichbar) schreibt `auftrag`.

**2 — Die Karten-Erweiterung als EIGENER Schnitt.** Write-Set MUSS `src/protocol.ts` und
`SYSTEM.md` enthalten. Davor das Falsifikations-Experiment des Kritikers fahren: eine dritte Zeile
mit `stateEffect: "proposes"` einsetzen, `bun capability-map.ts && bun e2e/pins.ts`. Ein gruener
Lauf widerlegt Befund (1) — das ist der Punkt.

**3 — Kante B (MAIN → eigene Lane), falls der Owner sie will.** Nach dem
`replyClarification`-Muster, nicht als FleetEvent-Anhaengsel. Ohne sie kollabiert nichts; der
Preis ist ein Owner-Handgriff je blockierter Lane.

**NICHT JETZT:**
- **Die Steward-Falte (Schnitte 3+4).** Zwei unabhaengige Leser sagen, sie bricht Messbares — das
  Land-Gate und den Pulse-Sitz. Der Architekt nennt sie selbst seinen am schwaechsten belegten
  Eingriff und hat `rulebook/*` bewusst nicht gelesen.
- **H.2 und H.4 des Rails.** Kein Konsument, invertierte Klassifikation, und ein Zaehler ohne
  zaehlbaren Sachverhalt.
- **Der `canary`-Zustand**, solange B1 ungeloest ist: er kann den Beweis, den seine eigene
  Promotionsregel verlangt, strukturell nicht erzeugen.
- **Jede `harnessSupport`-Spalte auf `supports.*`**, bis geklaert ist, dass diese Flags Politik
  sind und keine Messung.

**Die eine Sache, die keinen Schnitt braucht:** die „sichtbare Zuordnung" ist bereits vollstaendig
gebaut. Sie wird benannt und angeschlossen, nicht entworfen.
