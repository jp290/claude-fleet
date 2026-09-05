---
frage: Was soll Claude Fleet werden, was davon ist als Vertrag verbindlich, was findet eine statische Suche im Baum, und was haben die Programs eeba7c04 (ACP) und b2a14b54 (Generalsanierung 2026-09) laut ihren eigenen Quellen entschieden?
urteil: "Von den acht Zielfunktionen (SYSTEM.md:172-179) stehen ZWEI in der Registry (src/protocol.ts:318), fuenf haben in tracked *.ts/*.sh null Wortreffer, ask_question ist im Code als Zukunftsvokabular markiert (src/protocol.ts:368) — statische Namenssuche, kein Urteil ueber Funktionalitaet unter anderem Namen; ContextEnvelope und ein interface Act ebenfalls null. Zwischen AGENTS.md, SYSTEM.md und Charter wurde auf den EINZELN geprueften Punkten kein Widerspruch gefunden; ein Vollabgleich ist NICHT gelaufen, und der Charter-Satz zum Produktcode einer MAIN gilt so nicht fort (AGENTS.md:72-83). Beide Vorgaenger-Programs stehen auf complete und haben je eine Zielzahl kassiert: fuer Act 9 existiert eine Readiness-Messung (b4897ba) statt einer Implementierung; die Generalsanierung hat per RESCOPE die 8000-Zeilen-Zahl aufgehoben und drei von sechs Erfolgsmassen verfehlt. Owner-Wortlaut zu Erfolgsmass 5: NICHT als sauberes Gruen zitieren."
bereich: [zielbild, programs, rollen, capability, verify]
belege: [b4897ba, ea6ab53, 2e671a4, 6b8b89d, a09d9e5, src/protocol.ts#CAPABILITY_FUNCTIONS, src/protocol.ts#QuestionRole, land-candidate.ts, server/types.ts#ProgramFoundingV2, watchdog.sh#AUDIT_CMD, AGENTS.md, SYSTEM.md, docs/agentic-control-plane-program-2026-08-20.md, docs/messungen/2026-09-04-generalsanierung-abschlussmessung.md, docs/sanierung-2026-09/p6-befundregister.md, docs/messungen/INDEX.md, fleet.json#programs]
nicht-gemessen: Jede Laufzeitfrage (kein Server befragt ausser GET /api/self/gate) — auch nicht, ob der laufende srv den Post-Land-Audit traegt; server.ts und src/client.ts nur gegrept; dynamische Pfade zu land-candidate.ts; ob eine Zielfunktion unter ANDEREM Namen gebaut ist; e2e/, Wrapper, rulebook/, README.md, docs/controller.md, docs/steward.md; die Diffs der zitierten Commits; die 23 P6-Eintragskoerper; Vollabgleich AGENTS.md x SYSTEM.md x Charter; Abdeckungsanspruch von docs/messungen/INDEX.md
stand: 2026-09-05
---

# S0 — Zielbild und Vorentscheidungen (Program eec69528, Schnitt 0)

Baum der Ist-Suchen: `ea6ab53`. Dies ist die **Korrekturrunde S0R** an `2e671a4` (= `main`;
dazwischen liegt genau diese Datei) und schneidet drei Ueberclaims der Erstfassung zurueck. Alle
Ist-Zeilen unten sind **statische Suchbefunde** mit genanntem Suchraum — kein Laufzeit- und kein
Codepfad-Urteil.

## 1. Was Fleet werden soll

**Ein lokales Control Plane, das Arbeit, Wissen, Spezialisten und Ergebnisse zwischen Owner,
Projekten und Coding Agents vermittelt** (`SYSTEM.md` §Produktversprechen, sechs Punkte). Nicht das
Ziel: mehr Agentenebenen. Drei Saetze tragen es:

- **Nicht verhandelbar** (`AGENTS.md` §Project identity): owner promotion · isolated production ·
  observations before claims · explizites `unknown` · deterministic done · honest surfaces ·
  Review-Aufwand proportional zur Entscheidung.
- **Vier Rollen, zwei Autoritaetsklassen** (`SYSTEM.md` §Rollenmodell; Charter §3,
  `docs/agentic-control-plane-program-2026-08-20.md:100-116`): Controller und Project MAIN sind
  Coordinator, Worker sind Specialists, der Supervisor beobachtet quer. `AGENTS.md` §Role contract
  gibt je Ebene nur die EBENE; die konkrete Rolle soll ein Role Bootstrap liefern.
- **Vier Kernobjekte** (`SYSTEM.md`): `AgentInstance` · `Act` (+ `Attempt`) · `ContextEnvelope` ·
  `Trace`. Vor jedem Land wird ein unveraenderlicher `LandCandidate` gebunden.

**Korrektur zur Erstfassung:** sie schrieb, keine Aussage in `SYSTEM.md` trage einen Ist-Marker.
Auf Dokumentebene ist das falsch: `SYSTEM.md:3-7` traegt den Status **„Owner-ausgerichtetes
Zielbild"**, sagt „Es behauptet nicht, dass jede Kante bereits implementiert ist" und zeigt auf
`docs/kontextschicht-analyse-2026-08-20.md`. Es fehlt ein Marker je EINZELNER Aussage — ob das ein
Defekt oder bewusste Kuerze ist, ist hier nicht entschieden.

## 2. Zielvokabular gegen den Baum — statische Namenssuche

Suchraum jeder „Treffer"-Zeile: die **getrackten** `.ts`/`.sh`-Dateien dieses Repos (128,
`rg --files --glob '*.ts' --glob '*.sh' | wc -l`), Kommando `rg -n -w '<name>'`. **Grenze:** `rg`
respektiert `.gitignore`, die Suche ist wortweise. Null Treffer heisst „dieser Name kommt dort
nicht vor", nicht „die Faehigkeit fehlt" — ob etwas unter anderem Namen gebaut ist, gehoert
nach S3/S4.

| Zielbegriff (`SYSTEM.md:172-179`) | Statischer Befund an `ea6ab53` | Beleg |
|---|---|---|
| 8 Zielfunktionen | **2** in der Registry deklariert | `src/protocol.ts:318` |
| `describe_self` | Registry, Adapter `GET /api/self` | `docs/system-capabilities.generated.md` |
| `get_project_context` | Registry, Adapter `null`, als **gemessene Absenz** gepinnt | `e2e/pins.ts:1138-1142` |
| `ask_question` | 1 Treffer: ein Kommentar, der ihn als Zukunftsvokabular fuehrt | `src/protocol.ts:368` |
| `get_act`, `delegate_act`, `watch_act`, `report_result`, `verify_result` | **0 Wortreffer** | Suchraum oben |
| `ContextEnvelope`, `interface Act` | **0 Wortreffer** | dito |
| `attemptId` | existiert — an `ProgramFoundingV1/V2` | `server/types.ts:1580,1592` |
| `LandCandidate`/`PromotionPolicy` | Typen + reine Projektion; **statisch ein Importeur** (`e2e/merge.ts:9`) | `land-candidate.ts:1-5` |
| Post-Land-Audit | die srv-Spawn-Zeile in der DATEI traegt `FLEET_POSTLAND_AUDIT_CMD` | `watchdog.sh:101-104,155` |

Zwei Zeilen brauchen ihre Grenze im Klartext:

- **`land-candidate.ts`:** gefunden ist ein statischer Importeur; das Modul behauptet dasselbe im
  eigenen Kopf („nothing in a land path imports this module", `:3`) — Quellenclaim, kein Beweis.
  Dynamische oder indirekte Aufrufe sind nicht untersucht.
- **Post-Land-Audit:** `watchdog.sh:101` vermerkt „TURNED ON 2026-07-25", `:102-104` schraenkt im
  selben Atemzug ein: wirksam **nur nach `launchctl kickstart -k`** — ein blosser srv-Neustart
  behaelt die alte Spawn-Zeile. Ob der HEUTE laufende Server sie traegt, ist aus der Datei nicht
  ableitbar und hier **nicht gemessen**. Das „in Produktion AN" der Erstfassung ist ein
  Datei-Befund; er widerlegt die KONFIGURATIONS-Aussage von `docs/attic/autonomy-plan.md` §Gap 2,
  ueber den laufenden Prozess sagt er nichts.

## 3. Bereits entschieden — als Quellenclaim gelesen

**eeba7c04 ACP Outside-in** (2026-08-20 → `complete` 2026-08-30 laut `fleet.json#programs`): der
Charter fuehrt neun Acts (`…program-2026-08-20.md:249-399`). Die Erstfassung ordnete Commits den
Acts 1-5 zu; diese Zuordnung stammt aus Commit-**Subjects** und ist nicht durch Diffs bestaetigt.
Nachgeprueft wurde die Land-Provenienz: von zwoelf zitierten SHAs tragen **sechs** eine
`fleet/land`-Note (`4e4a70e`, `7a91ef1`, `9fd1025`, `0ce32dc`, `f1e50e9`, `6b8b89d`; Kommando
`git notes --ref=fleet/land show <sha>` je SHA), die uebrigen keine. **Fehlende Note heisst nicht
„nicht gelandet"**: ein Direkt-Commit aus dem Haupt-Checkout ist „fuer jedes land-seitige Ledger
unsichtbar" (`git log -1 b4897ba`, Body).

Zu Acts 6-9: `git log --grep 'ACP-0[6-9]'` findet **0 Commits** — ein schwacher Sensor, weil die
Acts nirgends so getaggt sind. Belegt ist stattdessen: fuer **Act 9** existiert eine
Readiness-Messung statt einer Implementierung (`b4897ba`,
`docs/messungen/2026-08-20-gamestudio-readiness.md`). „Acts 6-9 nie gebaut" ist damit **nicht**
belegt; belegt ist nur, dass kein Implementierungs-Commit unter diesem Namen gefunden wurde und
das Program trotzdem `complete` ist.

Charter-Entscheide, **als Charter-Text zitiert, nicht als geltende Invariante**: `SYSTEM.md` ist
Zielmodell · Modelle/Harness sind Routing-Hypothesen · eine Project MAIN „baut **standardmaessig**
keinen Produktcode, fuehrt keine Selbstreviews durch" (`:159`) · kein Big-Bang-Refactor. §8
verbietet vier Dokumentformen, §9 listet elf gefaehrliche Abkuerzungen.

**Der Produktcode-Satz gilt NICHT in der Form fort, in der die Erstfassung ihn fuehrte.** Der
aktuelle portable Vertrag (`AGENTS.md:72-83`) entscheidet anders: die Grenze zwischen MAIN-Akt und
Worker-Lane ist „a JUDGEMENT, never a posture, a size threshold or a table"; kleine, reversible
Aenderungen im bestaetigten Scope duerfen im MAIN-Checkout passieren, und es gibt eine
owner-promovierte **Game-Maker-Ausnahme**. Dazu `AGENTS.md:168`: „History explains why a rule
exists but grants no present authority." Die uebrigen Charter-Saetze sind einzeln **nicht** gegen
`AGENTS.md` abgeglichen.

**b2a14b54 Generalsanierung 2026-09** (2026-08-31 → `complete` 2026-09-04), Referat der
Abschlussnotiz, nicht neu gemessen: **RESCOPE 2026-09-03** hebt `server.ts ≤ 8000` auf; neues Ziel
ist Kern stabil, Blatt-Invariante fuer `server/*`, kein Modul > 2000; P5 nie gelaufen. Am Baum
`a09d9e5`: drei Masse erfuellt
(0 tote Doc-Pfade von 43 · `attic/` 88 Dateien, NULL Symlinks · P6 disponiert), drei verfehlt
(`src/client.ts` 11 067 statt ≤ 2 000 · Kommentaranteil 33,6 % statt < 20 % · Erfolgsmass 5).
**Owner-Entscheid 2026-09-04, woertlich: Lauf 2 zaehlt als gruen mit registrierter Familie §11.2n,
Lauf 3 ist keine Messung — und das ist NICHT als sauberes Gruen zu zitieren.** Der Feature-Freeze
ist aufgehoben; die Lehre: ein repoweiter Freeze braucht einen Owner-Akt, keine Programmzeile.
P6: 23 Befunde — 8 gefixt, 5 als Wissen erledigt, 6 offen, **4 Owner-Tore (B-08, B-17, B-18, B-19)**.

## 4. Offene Entscheidungsfragen, rangiert

1. **Rolle von `SYSTEM.md`.** Status „Zielbild" (`:3`), aber von `src/protocol.ts`, `e2e/pins.ts`
   und `AGENTS.md` als Quelle zitiert. *Kosten:* eine Folge-Lane, die es als Vertrag liest, baut
   gegen sechs Namen ohne Registry-Eintrag. *Verify:* die acht Namen greppen (Suchraum §2).
2. **Gelten ACP-Acts 6-9 fort?** Program `complete`, kein Implementierungs-Commit gefunden, fuer
   Act 9 eine Nicht-Messbarkeits-Notiz. *Kosten:* S3/S4 kann Luecke nicht von Absicht unterscheiden.
   *Verify:* Vollzugsliste im Charter-Kopf plus Diffs der Act-1-5-Commits.
3. **Die zwei weitergegebenen Sanierungszeilen** (`src/client.ts`-Split, Kommentarmass) — dieses
   Program oder Owner-Queue? *Kosten:* eine S3-Lane meldet 11 067 Zeilen als neuen Befund.
   *Verify:* Abschlussnotiz §„Zwei offene Zeilen".
4. **Die vier P6-Owner-Tore** liegen im Gates/Suiten-Schnitt (S4). *Kosten:* Doppelbefunde.
   *Verify:* `p6-befundregister.md` §Disposition.
5. **`docs/messungen/INDEX.md` — offene Frage, kein Defekt.** An `2e671a4`: 83 Notizen, **19 ohne
   Indexzeile** (Basename gegen `INDEX.md` gegrept; darunter diese hier). Aber `INDEX.md:9-10`
   erklaert Unvollstaendigkeit zum Interimszustand: „ein Fehlen hier heisst nicht, dass es die
   Notiz nicht gibt." Schaerfer: alle 19 sind vom **2026-08-29 oder juenger** — der Index driftet
   vorne, nicht im Altbestand. Ob das Kosten hat, haengt am Abdeckungsanspruch, und der ist **nicht
   gemessen**. *Verify:* Basename-Grep wiederholen, Anspruch in
   `.claude/skills/mess-notiz/SKILL.md` §Die Index-Zeile lesen.

**Lesezeiger fuer S1/S2:** `docs/messungen/kontextschicht-analyse-2026-09-05.md` und
`docs/messungen/2026-09-05-kontextschicht-gegencheck-glm.md` vermessen die Schichten S1/S2; beide
stehen (Stand `2e671a4`) in keinem Index, hier nur im Kopf gelesen.

## 5. Methode

Voll gelesen: `AGENTS.md` 1-291 · `SYSTEM.md` 1-243 · Charter 1-483 ·
`…generalsanierung-abschlussmessung.md` 1-394 · `INDEX.md` 1-75. Selektiv:
`plan-2026-08-31.md` 1-140 · `p6-befundregister.md` 1-28, 1043-1099; `fleet.json` per
`python3`-Parser. S0R zusaetzlich: `git notes --ref=fleet/land show` je zitiertem SHA ·
`git log -1 --format=%B b4897ba` · `git log --grep 'ACP-0[6-9]'` · Basename-Grep gegen
`INDEX.md` · die Namenssuche aus §2.

## 6. Nicht geprueft

Das Kopffeld `nicht-gemessen` ist die vollstaendige Liste. Zwei Zusaetze: von den drei Ledgern
wurde allein die letzte Zeile von `post-land-audits.jsonl` gelesen, fuer die Audit-Frage in §2. Und
diese Notiz hat **keine** Zeile in `docs/messungen/INDEX.md` bekommen — die Schreibflaeche dieser
Lane war auf diese eine Datei begrenzt; die Indexzeile bleibt offen.
