---
frage: Was soll Claude Fleet werden, was davon ist verbindlich oder gebaut, und was haben die Programs eeba7c04 (ACP Outside-in) und b2a14b54 (Generalsanierung 2026-09) bereits entschieden?
urteil: "Das Zielbild ist einheitlich und liegt an drei Stellen ohne Widerspruch (AGENTS.md Rollenvertrag, SYSTEM.md Objektmodell, ACP-Charter Bauplan). Der Widerspruch liegt zwischen Zielbild und Baum: von den acht stabilen Zielfunktionen aus SYSTEM.md existieren ZWEI in der Registry, und eine davon (get_project_context) ist als gemessene ABSENZ gepinnt; von den vier Kernobjekten ist ContextEnvelope im Code gar nicht vorhanden, Act nicht als Objekt, und attemptId existiert zwar, gehoert aber dem Program-FOUNDING, nicht der Act-Attempt-Bindung. Beide Vorgaenger-Programs sind complete und haben je eine Zielzahl KASSIERT statt erreicht: ACP hat Acts 6-9 nie gebaut, die Generalsanierung hat per RESCOPE 2026-09-03 die 8000-Zeilen-Zahl aufgehoben und drei ihrer sechs Erfolgsmasse verfehlt, davon zwei durch eigenen Stopp-Entscheid. Der Owner-Wortlaut zu Erfolgsmass 5 lautet ausdruecklich: NICHT als sauberes Gruen zitieren."
bereich: [zielbild, programs, rollen, capability, verify]
belege: [ea6ab53, 7a91ef1, b2809f5, 9fd1025, 914b25d, 4e4a70e, 37c9111, 0ce32dc, 3b0b55f, f1e50e9, 6b8b89d, a09d9e5, 49038af, src/protocol.ts#CAPABILITY_FUNCTIONS, capability-map.ts#SYSTEM_CAPABILITIES, docs/system-capabilities.generated.md, land-candidate.ts, server/types.ts#ProgramFoundingV2, watchdog.sh, AGENTS.md, SYSTEM.md, docs/agentic-control-plane-program-2026-08-20.md, docs/messungen/2026-09-04-generalsanierung-abschlussmessung.md, docs/sanierung-2026-09/plan-2026-08-31.md, docs/sanierung-2026-09/p6-befundregister.md, fleet.json#programs]
nicht-gemessen: server.ts und src/client.ts (nicht gelesen, nur gegrept); e2e/ und die Wrapper; die sieben rulebook/-Fragmente; README.md, docs/controller.md, docs/steward.md; die Diffs der genannten ACP-Commits (nur Subjects gelesen); die drei Ledger und beide Trail-Register (fuer S0 bewusst NICHT ausgewertet); jede Live-Route (kein Server befragt ausser /api/self/gate im Verify-Schritt)
stand: 2026-09-05
---

# S0 — Zielbild und Vorentscheidungen (Program eec69528, Schnitt 0)

Baum: `ea6ab53` (= `main`, `git log --oneline HEAD..main` leer). Alle Ist-Aussagen sind an diesem
Baum gegrept, nicht aus den Quellen abgeschrieben.

## 1. Was Fleet werden soll

**Ein lokales Control Plane, das Arbeit, Wissen, Spezialisten und Ergebnisse zwischen Owner,
Projekten und Coding Agents vermittelt** (`SYSTEM.md` §Produktversprechen, sechs Punkte: Ziel in
adressierbare Arbeit uebersetzen · je Instanz noetigen, aber vollstaendigen Kontext · Delegation
ueber benannte Funktionen · Fragen/Entscheidungen/Belege dauerhaft verbinden · ehrlicher
Projektstand in der UI · Modell/Harness nach dem Act waehlen). Nicht das Ziel: mehr Agentenebenen.

Drei Saetze tragen das Zielbild:

- **Nicht verhandelbar** (`AGENTS.md` §Project identity): owner promotion · isolated production ·
  observations before claims · explizites `unknown` · deterministic done · honest surfaces ·
  Review-Aufwand proportional zur Entscheidung.
- **Vier sichtbare Rollen, zwei Autoritaetsklassen** (`SYSTEM.md` §Rollenmodell): Fleet Controller
  und Project MAIN sind Coordinator, Worker sind Specialists, der Supervisor beobachtet quer.
  `AGENTS.md` §Role contract gibt je Ebene nur die EBENE (Zweck, Autonomie, Rueckweg,
  Entscheidungshoheit); die konkrete Rolle soll ein dynamischer Role Bootstrap liefern.
- **Vier Kernobjekte** (`SYSTEM.md`): `AgentInstance` · `Act` (+ `Attempt`) · `ContextEnvelope` ·
  `Trace`. Promotion ist Policy statt Agentenurteil; vor jedem Land wird ein unveraenderlicher
  `LandCandidate` gebunden.

Diese Abstraktionsebene sollte existieren: sie trennt Ziel von Ist, damit bei Widerspruch der Code
gewinnen kann. Der Defekt ist nicht ihre Existenz, sondern dass keine Aussage in `SYSTEM.md` einen
Ist-Marker traegt.

## 2. Zielvokabular gegen den Baum (verifiziert)

| Zielbegriff | Ist an `ea6ab53` | Beleg |
|---|---|---|
| 8 stabile Funktionen | **2** in der Registry | `src/protocol.ts:318` `CAPABILITY_FUNCTIONS` |
| `describe_self` | gebaut, Adapter `GET /api/self` | `docs/system-capabilities.generated.md` |
| `get_project_context` | Adapter `unsupported`, als **gemessene Absenz** gepinnt | `e2e/pins.ts:1140` |
| `get_act`, `delegate_act`, `watch_act`, `report_result`, `verify_result` | **0 Treffer** in `*.ts`/`*.sh` | `rg -n --glob '*.ts' --glob '*.sh'` |
| `ContextEnvelope` | **0 Treffer** im Code | dito |
| `Act` als Objekt | kein `interface Act` | dito |
| `attemptId` | existiert — aber an `ProgramFoundingV1/V2` (`bootstrap`/`succession`) | `server/types.ts:1580,1592` |
| `LandCandidate`/`PromotionPolicy` | Typen + reine Projektion; **kein Land-Pfad importiert sie** | `land-candidate.ts:1-5`, einziger Import `e2e/merge.ts:9` |
| Post-Land-Audit | in Produktion **AN** (`FLEET_POSTLAND_AUDIT_CMD` in der srv-Zeile) | `watchdog.sh:155` |

Die letzte Zeile widerlegt `docs/attic/autonomy-plan.md` §Gap 2, das den Audit noch als
"default OFF, nirgends aktiviert" fuehrt — das Attic-Dokument ist historische Absicht (2026-07-25),
kein Ist.

## 3. Bereits entschieden

**eeba7c04 ACP Outside-in** (2026-08-20 → complete 2026-08-30, `fleet.json#programs`):
Act 1 gelandet (`914b25d`, `4e4a70e`), Act 2 gelandet (`7a91ef1`), Act 3 teilweise (`b2809f5`
Candidate-Bindung, `9fd1025` Replay), Act 4 teilweise (`37c9111`, `0ce32dc`), Act 5 nur als
Vorlaeufer (`3b0b55f`, `f1e50e9`). **Acts 6-9 sind nie gebaut**, das Program ist trotzdem
`complete`. Entscheide, die fortgelten: `SYSTEM.md` ist Zielmodell, Code entscheidet das Ist ·
Modelle/Harness sind Routing-Hypothesen, keine Rollen und kein Qualitaetsbeweis · eine MAIN
schreibt keinen Produktcode und reviewt sich nicht selbst · kein Big-Bang-Refactor. §8 verbietet
ausdruecklich: Rollenhandbuecher je Rolle, eine handgepflegte Rolle-mal-Harness-Matrix, weitere
"Stand heute"-Summaries, ein zweites Context-Pack-Register. §9 listet elf gefaehrliche Abkuerzungen
(God-MAIN, Slot als Agentenidentitaet, `sent` = verstanden, Modellname als Capability-Beweis).

**b2a14b54 Generalsanierung 2026-09** (2026-08-31 → complete 2026-09-04):
**RESCOPE 2026-09-03** hebt `server.ts ≤ 8000` auf; neues Ziel ist Kern stabil + Blatt-Invariante
fuer `server/*` + kein Modul > 2000. Slice 7a (`6b8b89d`) ist der letzte Split-Slice, P5
(Client-Split) ist **nie gelaufen**. Abschlussmessung am Baum `a09d9e5`: drei Masse erfuellt
(0 tote Doc-Pfade von 43, als Pin-Klasse in Stufe 1 des Land-Gates · `attic/` 88 Dateien, NULL
Symlinks · P6 registerseitig disponiert), drei verfehlt (`src/client.ts` 11 067 statt ≤ 2 000 ·
Kommentaranteil 33,6 % statt < 20 % und steigend · Erfolgsmass 5). **Owner-Entscheid 2026-09-04,
woertlich zu uebernehmen: Lauf 2 zaehlt als gruen mit registrierter Familie §11.2n, Lauf 3 ist
keine Messung — und das ist NICHT als sauberes Gruen zu zitieren.** Der Feature-Freeze ist
aufgehoben; die Lehre steht in der Notiz: ein repoweiter Freeze braucht einen Owner-Akt, keine
Programmzeile (elf `feat`-Commits fremder Programs auf `server.ts` in vier Tagen). P6: 23 Befunde
mit Ausgang — 8 gefixt, 5 als Wissen/Methode erledigt, 6 offen, **4 Owner-Tore (B-08, B-17, B-18,
B-19)**. `dispatch: false` wurde bewusst nicht angefasst.

## 4. Fuenf offene Entscheidungsfragen, rangiert

1. **Rolle von `SYSTEM.md`.** Es traegt Status "Zielbild", wird aber von `src/protocol.ts`,
   `e2e/pins.ts` und `AGENTS.md` als Quelle zitiert. *Kosten:* jede Folge-Lane, die es als Vertrag
   liest, baut gegen sechs ungebaute Funktionen und ein nicht existentes Objekt. *Verify:* die
   acht Namen greppen (heute 2 Treffer).
2. **Gelten ACP-Acts 6-9 fort?** Das Program ist `complete`, die Acts sind ungebaut, und die
   "naechste Baukante" (Pilot, dann entscheiden, was von Act 3-5 fehlt) hat kein Ergebnisartefakt.
   *Kosten:* S3/S4 kann eine Luecke nicht von einer Absicht unterscheiden. *Verify:* `git log
   --grep 'ACP-0[6-9]'` und die Vollzugsliste im Charter-Kopf.
3. **Die zwei weitergegebenen Sanierungszeilen** (`src/client.ts`-Split, Kommentarmass) —
   dieses Program oder Owner-Queue? *Kosten:* eine S3-Lane misst 11 067 Zeilen und meldet sie als
   neuen Befund; das verletzt Non-Goal 2 dieses Programs. *Verify:* Abschlussnotiz §"Zwei offene
   Zeilen".
4. **Die vier P6-Owner-Tore** liegen im Gates/Suiten-Schnitt (S4). *Kosten:* S4 findet sie erneut
   und produziert Doppelbefunde. *Verify:* `p6-befundregister.md` §Disposition.
5. **`docs/messungen/INDEX.md` ist unvollstaendig: 18 von 82 Notizen fehlen** — darunter beide
   Kontextschicht-Notizen von **heute** (`kontextschicht-analyse-2026-09-05.md`,
   `2026-09-05-kontextschicht-gegencheck-glm.md`), die genau die Schichten S1/S2 vermessen.
   *Kosten:* doppelte Messung durch die naechsten Lanes. *Verify:* Basename jeder Notiz gegen
   `INDEX.md` greppen (heute: `notes=82 not_in_index=18`).

## 5. Methode und Quellenbereiche

Voll gelesen: `AGENTS.md` 1-291 · `SYSTEM.md` 1-243 ·
`docs/agentic-control-plane-program-2026-08-20.md` 1-483 · `docs/portfolio-plan-2026-09-02.md`
1-184 · `docs/attic/operating-model.md` 1-141 · `docs/attic/autonomy-plan.md` 1-225 ·
`docs/messungen/INDEX.md` 1-75 · `docs/messungen/2026-09-04-generalsanierung-abschlussmessung.md`
1-394. Selektiv: `docs/sanierung-2026-09/plan-2026-08-31.md` 1-140 (Kopf, RESCOPE, Zielbild) ·
`docs/sanierung-2026-09/p6-befundregister.md` 1-28 und 1043-1099 (Disposition) ·
`docs/kontextschicht-analyse-2026-08-20.md` 1-45 · die zwei Kontextschicht-Notizen vom 2026-09-05
nur im Kopf. `fleet.json` per `python3`-Parser, drei Program-Datensaetze, keine Gesamtausgabe.
Werkzeuge: `rg -n`, `git show`, `graphify query --graph` (lief, 35 Knoten).

## 6. Nicht geprueft

`server.ts` und `src/client.ts` sind nicht gelesen, nur gegrept — jede Ist-Zeile oben ist ein
Grep-Befund, kein Codepfad-Urteil. Nicht angesehen: `e2e/`, die Wrapper, die sieben
`rulebook/`-Fragmente, `README.md`, `docs/controller.md`, `docs/steward.md`, die Diffs der
genannten ACP-Commits, die 23 P6-Eintragskoerper. Die drei Ledger und beide Trail-Register sind
fuer S0 **bewusst nicht ausgewertet** (keine Schlussfolgerung oben braucht sie). Ob die
Vorgaenger-Entscheide heute noch die Absicht des Owners sind, ist eine Owner-Frage und hier nicht
beantwortet.
