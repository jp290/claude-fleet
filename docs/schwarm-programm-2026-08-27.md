# Schwarm-Programm — was aus dem OpenAI/Hugging-Face-Vorfall für Fleet folgt

Stand 2026-08-27. Herkunft: OpenAI Technical Report zum Hugging-Face-Vorfall (26.08.) plus METRs
unabhängige Untersuchung. Dies ist eine AUSARBEITUNG, aus der Arbeitsaufträge abgeleitet werden —
kein Beschluss. Jede Zahl unten ist am Baum gemessen; wo eine Behauptung von einem Agenten stammt
und ich sie nicht selbst nachgeprüft habe, steht es dabei.

## 1. Die eine übertragbare Erkenntnis

Der Report nennt drei Zutaten, alle notwendig, keine davon böse: ein maschinell prüfbarer Reward ·
Aufgaben, die so nicht lösbar sind · eine geteilte beschreibbare Fläche. 198 von 898 ExploitGym-Tasks
wurden nie gelöst (22 %) — aber **93 % des Verkehrs auf dem improvisierten Message Board stammte aus
genau dieser Menge**.

Der Schwarm war also zu über neun Zehnteln kein Kollaborations-, sondern ein **Negativ-Wissens-Bus**.
Was Agenten am dringendsten teilen wollten, war „lass es, ich hab's versucht".

Fleet verliert genau das. Gemessen im Ledger am 2026-08-27: von **567 Lane-Ausgängen** sind
**123 `killed-empty` (21,7 %)**, gegen 371 `landed` (65,4 %); 24 `killed-dirty`, 18 `shelved`, 31 ohne
Feld. Das ist der Preis des fehlenden Empfängers, nicht fehlender Fähigkeit. Das Ledger wächst — die
Zahl ist ein Schnappschuss und muss vor jeder Wiederverwendung neu gezogen werden.

## 2. Was die Nahtlesung ergeben hat

Vier Nähte gelesen. Drei meiner vier ursprünglichen Vorschläge haben die Lesung **nicht** überlebt und
sind durch billigere ersetzt.

**(a) Der Zustellkanal existiert — ContextPlan v2.** `server.ts#briefAndSend` liefert
`brief + anchorBlock + LANE_EXIT_FOOTER`, sonst nichts. Der Anchor-Block trägt **reine Zeiger**
(`path | anchor`); `context-pack-validator.ts` verweigert eingebetteten Inhalt hart
(`SOURCE_CONTENT_FORBIDDEN`). Jede Zustellung wird nach `context-receipts.jsonl` quittiert.
→ Die Designlinie „Zeiger, nie Artefakte", die ich als Schutz vorschlagen wollte, ist bereits erzwungen.

**(b) Volltext war nie eine Option.** `docs/messungen/` = **30 Dateien, 555 730 Bytes** (~139k Tokens).
Selbst eine Median-Notiz (~18,5 KB) ist eine echte Ausgabe gegen das ~258 400-Token-Fenster einer
fremden Lane.

**(c) Live wird kein Brief maschinell kompiliert.** `BRIEF_TICK_MS` default 0; `watchdog.sh:148` setzt
`FLEET_ANALYSIS_MS=0` und kein `FLEET_BRIEF_MS`. Dispatch liefert `next.text` roh. Ein Eingriff in
`runEnhance` hätte einen Pfad getroffen, der hier nicht läuft.

**(d) Ein 6. Task-Status ist die falsche Bewegung.** Es gibt **kein einziges `switch`** auf Task-Status
(der einzige `switch` im ganzen TS-Bestand ist `src/client.ts:7612` auf `event`); jeder Konsument ist ein
String-Membership-Test. Ein neuer Wert bricht **einmal laut** (`src/client.ts:263`) und mehrfach leise —
entscheidend ist **EINE Loader-Allowlist** (`server.ts:17137-17141`), die eine Zeile mit unbekanntem Status
beim nächsten Boot **stillschweigend verwirft**. (Korrigiert nach Gegencheck `e3e5d29`: die erste Fassung
sprach von zwei Allowlists — `:17151` ist eine Kommentarzeile, eine zweite existiert nicht. Die Folge,
stiller Datenverlust, bleibt über `:17141` wahr.) Datenverlust als
Preis für ein Vokabular. `archived` IST bereits „terminal, nicht erledigt" (`taskTerminal`,
`qGroupOf→closed`, `unarchive→pending`); es fehlt nur das WARUM.

**(e) Der Schwarm-Modus braucht weder Modus noch Code.** `POST /api/self/fleet-report`
(`server.ts#openFleetReport`) ist lane-only, typisiert (`complete|needs-main|failed`), ≤4000 Zeichen,
persistiert, mit Ack. Zwei harte Vorbedingungen, nicht eine: ein Empfänger aus
`clarificationReceiverFor` (409, `:6203`) **und** freies FleetEvent-Budget beim Empfänger
(`slotDeliveryBudget`, 409, `:6205`). Den Empfänger liefert `clarificationReceiverFor` geschenkt, sobald
die Lanes **programm-gebunden** starten; ein exakter Lane-Watch tut es auch. Dazu die
Docs-Kurzkette `DOC_STEPS = ["install","pins"]` (`verify-proportion.ts#ruleFor`), die den **Suite-Mutex
nie nimmt**. N Findings-Lanes kollidieren an nichts.
Deckel: der beaufsichtigte Pfad `POST /api/lanes` hat **gar keinen Lane-Deckel** (nur `MAX_SLOTS = 16`);
die Deckel 2/3 binden ausschließlich den Tick.

**(f) Der Stuck-Sensor ist ein Retentions-, kein Messproblem.** `laneStalled` existiert
(`lane-signals.ts`), verlangt aber **idle** — eine Lane in der fix-run-fail-Schleife druckt ununterbrochen,
`idleMs` wächst nie, `stalled` ist per Konstruktion falsch. Die beiden Zahlen, die reichen würden,
werden bereits regelmäßig berechnet und **nicht zurückbehalten**: `contextFill(s).usedTokens`
(Budget, monoton) im **2-s-Owner-Poll** (`server.ts:20643`) und `gitInfo.get(s.id).{ahead,dirty}`
(Fortschritt) im **10-s-`tickGit`** (`:17742`, Schleife `:4209`, `gitInfo.set` `:4269`). Zwei Kadenzen,
nicht eine — die Vorprobe gehört an die langsamere.

**(g) Und der wunde Punkt, der alles verbindet: `docs/messungen/` ist Prosa, keine Daten.** Drei gelesene
Notizen, drei verschiedene Strukturen, kein Front-Matter, keine stabile Claim-Zeile. Eine Maschine kann
die Dateien finden — **quer lesen kann sie sie nicht.**

## 3. Die Umformung

Aus vier Feature-Ideen werden **eine Vorbedingung, zwei Code-Schnitte, eine Praxis und ein Sensor**.
Die Vorbedingung war in keinem der vier Vorschläge enthalten und ist der eigentliche Fund.

| # | Paket | Art | Hängt ab von |
|---|---|---|---|
| P0 | Claim-Block + Index-Zeile im `mess-notiz`-Skill | Skill-Datei | — |
| P0b | Retrofit der 30 vorhandenen Notizen | mechanisch | P0 |
| A | Ein Context-Pack, das auf den Index zeigt | 1 JSON-Eintrag | P0, P0b |
| ~~B~~ | ~~`unfulfillable`~~ — nach Messung zurückgestellt (1,9 % Wiederholer) | — | — |
| C | Schwarm-Praxis dokumentieren | Doku | P0, A |
| D1 | Stuck-Retention in `tickGit` | server.ts | — |

---

## P0 — Claim-Block und Index-Zeile im `mess-notiz`-Skill

**Ziel.** Eine Messnotiz wird querlesbar: sechs Felder Front-Matter, und die Notiz trägt sich selbst in
einen Index ein.

**Warum das zuerst kommt.** Ohne strukturierte Claims gibt es nichts, worauf ein Zeiger zeigen kann (A),
und nichts, was ein Synthese-Schritt quer lesen könnte (C). Es ist die Vorbedingung beider.

**Form.** Front-Matter, minimal gehalten:

    ---
    frage: <eine Zeile — was gemessen wurde>
    urteil: <eine Zeile — die Antwort, nicht die Zusammenfassung>
    bereich: [<tag>, <tag>]
    belege: [<pfad>#<symbol>, ...]
    nicht-gemessen: <eine Zeile>
    stand: YYYY-MM-DD
    ---

Und eine Zeile in `docs/messungen/INDEX.md`, vom schreibenden Lauf angehängt:
`- <urteil> — docs/messungen/<datei>.md · bereich: a,b · stand: YYYY-MM-DD`

**Kein Generator.** Der Index wird von der Notiz selbst fortgeschrieben, nicht aus dem Korpus erzeugt —
ein generierter Index driftet, ein angehängter nicht.

**Done-Kriterium.** Das Skill-Template verlangt die sechs Felder und die Index-Zeile; eine nach dem neuen
Template geschriebene Notiz hat gültiges Front-Matter und genau eine neue Zeile in `INDEX.md`.

**Verify.** `bun e2e/pins.ts` grün, plus ein neuer Pin (siehe Risiko).

**Dateien.** `.claude/skills/mess-notiz/SKILL.md` (getrackt, seit `3235561`) und
`docs/messungen/INDEX.md` (neu). **Sonst nichts.**

**Nicht-Umfang.** Kein Server-Code. Keine Änderung an bestehenden Notizen (das ist P0b). Keine
Validierung des Front-Matters zur Laufzeit.

**Risiko — und die Korrektur, die P0 KLEINER macht.** Die erste Fassung verschrieb einen Pin, der
`.claude/skills/…` und `.agents/skills/…` synchron hält. Der Gegencheck (`e3e5d29`, U2) hat die Prämisse
zerlegt, und die Nachmessung bestätigt sie: **`.agents/` ist vollständig gitignored** (`.gitignore:49`)
und existiert **in keinem Worktree**; `.claude/skills/` ist getrackt und liegt in jedem Worktree
(nachgesehen: `graphify`, `kriterium-grill`, `mess-notiz`, `unslop`). Es liegen also nicht zwei
Repo-Dateien nebeneinander, sondern **eine getrackte Quelle und eine maschinenlokale, abgeleitete Kopie**,
die der Harness ablegt. Konsequenz: **P0 bringt KEINEN Pin mit.** Ein strenger Pin liefe in jeder Lane
rot (die Datei fehlt dort), ein „skip if absent" öffnete die Drift genau dort, wo geschrieben wird — der
Gegencheck hat beide Hörner korrekt benannt. Richtig ist die dritte Tür, die er nicht sah: eine Quelle
pinnen heißt gar nichts pinnen, wenn die zweite Datei ein Artefakt ist. `.agents/` gehört stattdessen in
die Liste der ungovernierten Artefakte (`docs/ungoverned-artifacts.md`), zusammen mit `CLAUDE.md`.

**Offen und NICHT geraten:** wer `.agents/` schreibt, ist nicht belegt. Der Kommentar in `.gitignore:49`
sagt, die Originale lägen in `~/.claude/skills/` — dort liegt aber nur `graphify`. Das ist zu klären,
bevor jemand sich auf die Kopie verlässt; für P0 ist es folgenlos, weil P0 die Quelle anfasst.

**Offene Owner-Entscheidung.** Sind sechs Felder die richtigen? `bereich` ist das einzige, das eine
Vokabular-Entscheidung braucht — freie Tags oder eine feste Liste.

---

## P0b — Retrofit der 30 vorhandenen Notizen

**Ziel.** Der bestehende Korpus wird querlesbar, statt nur der künftige.

**Warum getrennt.** Rein mechanisch, kein Urteil nötig, andere Fähigkeit als P0. Eine billige Lane.

**Done-Kriterium.** Alle 30 Dateien in `docs/messungen/` tragen gültiges Front-Matter mit den sechs
Feldern; `INDEX.md` hat 30 Zeilen; `frage`/`urteil` sind aus der Notiz belegt, nicht erfunden.

**Verify.** `bun e2e/pins.ts` grün. Stichprobe: drei zufällige Notizen — steht das `urteil` wörtlich so
in der Notiz?

**Nicht-Umfang.** **Kein Umschreiben der Notiz-Körper.** Nur Front-Matter voranstellen und indizieren.
Widersprüche zwischen Notizen werden NICHT aufgelöst, sondern im Report benannt.

**Risiko.** Der Versuchung nachgeben, „beim Aufräumen" gleich Inhalte zu glätten. Das ist der klassische
Scope-Inflations-Pfad und muss im Brief ausdrücklich verboten sein.

---

## A — Ein Context-Pack, das auf den Index zeigt

**Ziel.** Jede frisch dispatchte Lane sieht in ihrem Anchor-Block eine Zeile, die auf den Findings-Index
zeigt.

**Form.** Ein Eintrag in `.fleet/context-packs.json` nach dem vorhandenen Schema (`id`, `useWhen`,
`scope`, `audience`, `triggers`, `hardness`, `sources[{path,anchor}]`, `requiredCapabilities`,
`harnesses`, `modes`, `estimatedBytes`, `evidence`, `owner`, `status`), `triggers: ["always"]`,
`sources: [{path: "docs/messungen/INDEX.md", anchor: "<Überschrift>"}]`.

**Done-Kriterium.** Eine dispatchte Lane erhält im Anchor-Block eine Zeile, die auf `INDEX.md` zeigt;
die Quittung in `context-receipts.jsonl` führt das Pack in `selected[]`.

**Verify.** Neuer Check in `e2e/context-plan.ts` (Auswahl-Leiter) oder `e2e/context-packs.ts`
(Vokabular/Validator); zusätzlich `./e2e-isolated.sh` als Vorschau, weil eine Aussage über einen
Kontrakt-Default geändert wird.

**Nicht-Umfang — und das ist der wichtigste Satz dieses Pakets.** **Keine task-relevante
Trigger-Auswahl.** Der naheliegende nächste Schritt wäre, `DISPATCH_CONTEXT_TRIGGERS` in `briefAndSend`
aus `next: Task` abzuleiten statt aus einer Modulkonstante. Das bricht `e2e/pins.ts#RULE_REACH`, der
exakte Gleichheit zwischen dormanten und erreichten Triggern behauptet — **absichtlich**. Dieser Pin ist
kein Hindernis, er ist die Stelle, an der so eine Entscheidung dokumentiert werden müsste. Solange ein
`always`-Pack mit einem Index die Frage beantwortet, ist die Verbreiterung unbezahlte Komplexität.

**Kosten.** Ein Pack kostet jede Lane ~2 Zeilen Anchor-Block. Gegen ~258 400 Tokens: nichts.

---

## B — `unfulfillable` als propose/promote — **ZURÜCKGESTELLT (2026-08-27, nach Messung)**

**Nicht bauen.** Der Gegencheck nannte B als einziges verfrühtes Paket; die Nachmessung an
`lane-outcomes.jsonl` gibt ihm recht: von **211 distinkten `originId`s haben 4 einen zweiten
Lane-Ausgang, keiner einen dritten — 1,9 %.** Es gibt keine gemessene Nachfrage. B ist zugleich das
einzige Paket, das `server.ts` UND `src/client.ts` UND fünf neue e2e-Fälle bewegt, also das teuerste
Slice auf der empfindlichsten Fläche.

**Wiedervorlage:** wenn C (Schwarm-Praxis) gelaufen ist und die Wiederholer-Quote messbar steigt. Die
Messung ist ein Einzeiler über das Ledger und gehört dann wiederholt, nicht erinnert.

Der Entwurf bleibt unten stehen, weil er fertig durchdacht ist und die Wiedervorlage sonst bei null
anfängt.

### Entwurf (nicht beauftragt)

**Ziel.** Eine Lane, die feststellt, dass ihre Zeile so nicht erfüllbar ist, kann das als Vorschlag
hinterlegen; der Owner bestätigt und archiviert mit Grund. Heute geht die Zeile über
`detachSlotTasks` → `pending` zurück in den Backlog und ist voll re-dispatchbar, mit einer
Prosa-`note` als einzigem Träger.

**Form.** Spiegel von `TaskCriterion` (`server.ts:1938-1942`): ein Feld
`Task.unfulfillable?: {text, proposedAt, confirmedAt}`, eine lane-only Self-Route zum Vorschlagen, ein
Owner-Confirm, der `status = "archived"` schreibt und den Grund auf der Zeile behält.

**Warum kein neuer Status.** Siehe §2(d): ein laut brechender Aufrufer, elf leise, zwei davon
datenverlierend. Der Spiegel bricht **null** erschöpfende Switches.

**Done-Kriterium.** Eine Lane kann `unfulfillable` genau einmal vorschlagen (zweiter Versuch nach
Bestätigung → 409); eine Nicht-Lane bekommt 409; der Owner-Confirm setzt `archived` und der Grund bleibt
auf der Zeile — auch nach `unarchive` → `pending`.

**Verify.** Neue Checks in `e2e/tasks.ts`, fünf Fälle: Vorschlag (200) · Doppel-Vorschlag nach Confirm
(409) · Nicht-Lane (409) · Confirm → `archived` mit Grund · `unarchive` → `pending`, Grund erhalten.
Plus die volle lokale Kette, weil `server.ts` berührt ist (`verify-proportion.ts` klassifiziert
`server.ts` als `server-or-host-runtime`).

**Dateien.** `server.ts` (Interface, eine Self-Route, ein Confirm-Zweig, ein Loader-Normalizer),
`src/client.ts` (Darstellung + Knopf), `e2e/tasks.ts`.

**Nicht-Umfang.** Kein Status-Wert. Keine Lane darf selbst archivieren. Keine Änderung an der
Dispatch-Auswahl. Kein Automatismus, der aus einem Vorschlag eine Archivierung macht.

**Wichtige Abgrenzung.** B hält das **Schicksal der Zeile** fest, nicht das Wissen. Was gelernt wurde,
gehört in eine Messnotiz (P0) und in einen `fleet-report`. Beides nicht vermischen: archivierte Zeilen
sind terminal und werden von `capTasks` irgendwann verdrängt — der Grund stirbt mit ihnen, die Notiz
nicht.

**Offene Owner-Entscheidung.** Soll der Vorschlag den Slot in `awaiting: "owner"` versetzen (wie
`criterion`), oder soll die Lane weiterarbeiten dürfen?

---

## C — Schwarm-Praxis dokumentieren (kein Code)

**Ziel.** N Lanes auf EINE harte Frage, die Befunde statt Commits produzieren — als beschriebene
Arbeitsweise, nicht als Feature.

**Warum kein Code.** §2(e): beide Teile existieren. Was fehlt, ist die Beschreibung, wie man sie
zusammensetzt, plus die Deckel-Fakten, die sonst jede Session neu ausmisst.

**Form.** Eine Doku-Seite plus ein kurzer Regelbuch-Absatz mit vier Sätzen: Lanes **programm-gebunden**
öffnen (das macht `fleet-report` legal, `basis: "program-main"`) · jede Lane schreibt eine Messnotiz und
landet sie über die Docs-Kurzkette · keine Lane landet Code · der beaufsichtigte Pfad hat keinen
Lane-Deckel, `MAX_SLOTS = 16` ist die reale Decke.

**Done-Kriterium.** Ein Leser kann aus der Seite heraus einen Schwarm-Lauf aufsetzen, ohne server.ts zu
lesen; die vier Fakten sind mit `file#symbol` belegt.

**Verify.** Doku-Anker-Check in `review-sweep.ts` (prüft `docs/*.md`-Anker) plus `bun e2e/pins.ts`.

**Nicht-Umfang.** Kein Board-Knopf, keine Route, kein „Schwarm-Objekt". Wenn die Praxis sich bewährt und
das Aufsetzen von Hand nervt, ist DANN der Zeitpunkt für Mechanik — nicht vorher.

**Neue Tatsache, empirisch belegt.** Eine Lane mit fremdem Harness hat **keine Skills** — `.agents/`
ist gitignored und fehlt im Worktree, und die `.claude/skills/`-Kopie ist die claude-seitige. Die
GLM-Gegencheck-Lane vom 2026-08-27 hat trotzdem eine formgerechte Notiz geliefert, weil die STRUKTUR im
Brief stand. Regel für C: **bei fremdem Harness gehört das Notiz-Template in den Brief, nicht als
Skill-Verweis.**

**Risiken, die in die Seite gehören.** Maschinenlast (die gemessene Nicht-Determiniertheit bei zwei
gleichzeitigen isolierten Suiten gilt auch hier) · Provider-Kontext · die 16-Slot-Decke wird mit echter
Arbeit geteilt.

---

## D1 — Stuck-Retention in `tickGit`

**Ziel.** Der Zustand „hohes Budget, kein Fortschritt" wird sichtbar. Er ist gleichzeitig die
unproduktive Lane und die Vorbedingung dafür, dass ein Agent kreativ außerhalb seiner Grenzen arbeitet —
Figure 3 des Reports: Board-Teilnahme stieg mit dem Reasoning-Effort.

**Form.** `tickGit` (10 s, läuft ohnehin über alle Slots und hält `gitInfo`) behält je Slot **eine
Vorprobe** von `contextFill(s).usedTokens` und `gitInfo.{ahead,dirty}`. Prädikat: `usedTokens` ist um N
gestiegen, `ahead` unverändert, `dirty` flach, über T. Ausgabe neben `stalled` auf
`/api/steward/sessions`.

**Done-Kriterium.** Für einen Slot, dessen `usedTokens` über T um mehr als N wächst, ohne dass `ahead`
oder `dirty` sich bewegen, liefert die Route ein wahres Merkmal — und für einen Slot, der committet,
nicht.

**Verify.** Neuer Check in der Familie, die `laneSignalView` abdeckt; plus die volle lokale Kette
(`server.ts` berührt).

**Nicht-Umfang — ausdrücklich.** **Der Sensor gated nichts, tötet nichts, schickt nichts.** Er ist ein
Merkmal auf einer Route. Ein Detektor, der handelt, ist ein anderes Vorhaben mit anderen Risiken.

**Bekanntes Upgrade, bewusst nicht jetzt.** Das schärfere Signal wäre „wiederholte identische
Bash-Kommandos mit Exit ≠ 0". Die Daten liegen im Transkript, das `laneToolResultBytes`
(`server.ts:13232`) bereits vollständig durchläuft — es baut schon `Map<tool_use.id → name>` und summiert
`tool_result`-Bytes, verwirft aber `input` und liest `is_error` nie. Der Haken ist nicht der Zugriff,
sondern dass die Funktion **ganze Verzeichnisse ganz liest und nur beim Land läuft**. Auf einen Tick
gelegt, wie sie ist, liest sie jeden Zyklus Megabytes. Voraussetzung wäre ein inkrementeller Leser nach
dem Offset-Muster, das `poll()` und `readUsedTokens` schon benutzen. Erst wenn D1 zeigt, dass das grobe
Prädikat zu viele Fehlalarme liefert, lohnt das.

**Offene Owner-Entscheidung.** N und T. Vorschlag zum Draufschlagen: N = 15 % Fensterzuwachs, T = 20 min.
Das ist geraten und muss an echten Lanes kalibriert werden, bevor irgendwer darauf schaut.

---

## 4. Was bewusst NICHT gebaut wird

- **Task-relevante Trigger-Auswahl** (`DISPATCH_CONTEXT_TRIGGERS` aus `next: Task`) — bricht
  `e2e/pins.ts#RULE_REACH` absichtlich; ein `always`-Pack mit Index beantwortet die Frage billiger.
- **Ein 6. Task-Status** — mehrere leise Brüche, einer davon datenverlierend.
- **`unfulfillable` (B)** — zurückgestellt, nicht verworfen: 1,9 % Wiederholer-Quote im Ledger, keine
  gemessene Nachfrage. Wiedervorlage nach C.
- **Ein Sync-Pin auf die Skill-Kopien** — `.agents/` ist ein maschinenlokales Artefakt, kein zweiter
  Vertrag; ein Pin darauf wäre in jeder Lane rot.
- **Ein Schwarm-Modus als Feature** — beide Bausteine existieren; ein Objekt darüber wäre Verpackung.
- **Ein Verhaltens-Monitor über Transkripte** (der „CoT-Monitor"-Gedanke) — reizvoll, aber er braucht den
  inkrementellen Leser aus D1s Upgrade, und ohne D1s Kalibrierung wüsste niemand, worauf er schauen soll.
- **Jede Automatik auf D1** — Sensor ja, Handlung nein.
- **Kryptografische Autorschaft für Befunde** — auf einer same-uid-Maschine sinnlos; die Antwort ist der
  Server-Stempel, den `writeDisposition` (`source` wird gestempelt, nie aus dem Body gelesen) bereits
  vormacht.

## 5. Erfolgsmaß für das Programm

Basislinie steht: **123/567 Lane-Ausgänge `killed-empty` (21,7 %)** in `lane-outcomes.jsonl`, gezogen am
2026-08-27. Wenn P0+A+C wirken,
sinkt der Anteil bei Mess- und Audit-Lanes, weil ihr Ergebnis einen Empfänger und ein Format hat. Das ist
nachmessbar mit dem, was schon auf Platte liegt — kein neues Instrument nötig.

Zweites, weicheres Maß: zitiert eine Lane in ihrem Report eine frühere Notiz? Vorher strukturell
unmöglich.

## 6. Gesammelte offene Owner-Entscheidungen

1. **`bereich`** im Claim-Block — freie Tags oder feste Liste? (P0)
2. **N und T** für das Stuck-Prädikat. (D1) Vorschlag zum Draufschlagen: 15 % Fensterzuwachs über
   20 min — geraten, muss an echten Lanes kalibriert werden.
3. **Wer schreibt `.agents/`?** Nicht belegt, für P0 folgenlos, aber offen, bevor sich jemand auf die
   Kopie verlässt.
4. Reihenfolge: **P0 → P0b → A → C** ist eine Kette. **D1** ist unabhängig und kann parallel laufen.
   **B** ist zurückgestellt.

## 7. Provenienz

Erste Fassung `bdcc6d3`. Gegengeprüft von einer GLM-Lane (`pi-zai`/`glm-5.3`, Slot 10) gegen genau
diesen Commit: `docs/messungen/2026-08-27-gegencheck-schwarm-programm.md` (`e3e5d29`) — zwölf
Behauptungen, elf verifiziert, ein Detail widerlegt, zwei Urteile. Diese Fassung trägt die
Korrekturen; die Ledger-Messung zu B habe ich selbst gezogen, weil der Gegencheck sie ausdrücklich
als „nicht gemessen" auswies.
