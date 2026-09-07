---
frage: Welche Quelle wird bei welchem Trigger ausgewaehlt oder ausgelassen, was davon steht im Brief, was in der Quittung, und laesst sich Empfaenger/Rolle/Repo/Baum/Briefversion/Aktualitaet verbinden?
urteil: Die Auswahl- und Quittungskette rekonstruiert sich byte-genau und driftet nicht (3/3 Hashes, 293/293 Baumstaende). Die zwei echten Luecken sitzen am Rand: die Quittung belegt BAU, nicht ZUSTELLUNG, obwohl derselbe Aufruf die Annahme misst; und die Auslassungs-Begruendung ist die erste gefallene Sprosse, nicht der Grund.
bereich: [context, briefs, harness, ledger]
belege: [context-receipts.jsonl, .fleet/context-packs.json, context-packs.ts, context-plan.ts, context-manifest.ts, server.ts, e2e/pins.ts, fleet.json]
nicht-gemessen: Keine Live-UI, kein Modellstart, keine Live-Injektion, keine isolierte Suite; kein Fremdrepo-Manifest (nur `claude-fleet` selbst); die 157 Fremdbaum-Zeilen nur aggregiert; ob ein Empfaenger den Ankerblock GELESEN hat, bleibt strukturell unknown.
stand: 2026-09-07
---

# Quelle → Kontext → Empfaenger: die reale Kette, an drei Quittungen nachgerechnet

Astra-Lane S2D, Program `eec695280b9ca5a84824eec0`, Task `457511cc`, Branch
`fleet/260907024635-0ee3`. Baum dieser Messung: `a65fbdd54207f2bd1bff2ebef36d299c67ac73e4`
(der Auftrag verankert auf `453092cb242a472fe9876b30222bfde0283c5b04`; dieser ist Vorfahre von
`a65fbdd`, alle Symbole am neueren Baum gegengeprueft, Zeilenangaben gelten fuer `a65fbdd`).
Lokale Uhr der Datenprobe: `2026-09-07T05:0x`. Dateiname aus dem Auftrag beibehalten.
Nur diese Datei; kein Code, kein Regelbuch, kein Land, kein Deploy.

**Warum diese Abstraktion existieren soll — die Frage vor der Kritik.** Zeiger statt Kopien: ein
Brief nennt Pfad und Anker plus eine Zweckzeile, und die Quelle bleibt in der Quelle. Das ist der
richtige Schnitt, und der Code sagt es in seiner ersten Zeile (`context-packs.ts:1`, „never a
second knowledge store"). Die Kette haelt, was sie an dieser Stelle verspricht: sie ist rein
(`context-plan.ts`, `context-manifest.ts` lesen weder FS noch git noch Netz), sie liest die Quellen
AM quittierten Commit statt im Working Tree (`server.ts#showAtHead`), und sie versioniert jeden
Zeiger. **Kein Befund dieser Notiz schlaegt vor, das zurueckzubauen.**

**Abgrenzung gegen bestehende Arbeit.** `docs/messungen/2026-09-04-context-pack-routing.md` hat die
Pipeline, die Ledger-Statistik und sieben Luecken bereits erhoben (vier tote Seeds, 30 % Null-Pack-
Zustellungen, `pi-ox`-Drift, Target-Repo-Capabilities, ungelesene Quittungen, Doku-Blindheit,
quittungslose Naehte) — jene Notiz sagt von sich selbst „Der Controller hat die Zahlen NICHT
nachgerechnet; Agentenbefund". Diese Notiz wiederholt keinen dieser Befunde. Sie tut zwei andere
Dinge: sie **rechnet die Kette an drei Quittungen nach**, und sie meldet **fuenf Befunde, die dort
nicht stehen** — davon zwei, die den bereits empfohlenen ersten Schnitt direkt betreffen.

## 1. Methode — die ausgefuehrten Kommandos

```
# Werkzeug zuerst, wie beauftragt (Ergebnis unten)
graphify query "Wie wird der ContextPlan-Ankerblock ausgewaehlt, gerendert und quittiert?" \
  --graph /Users/owner/claude-fleet/graphify-out/graph.json

# Code, enge Fenster
sed -n '1,200p' context-packs.ts ; cat context-manifest.ts ; cat context-plan.ts
sed -n '8040,8090p;8140,8310p;16580,16630p;18613,18815p;24800,24860p' server.ts
rg -n "renderContextAnchorBlock|contextReceiptSelections|repoManifestContextPlan|programMainContextPlan|stampObservedSourceHashes|planContext\(|CONTEXT_RECEIPT" server.ts
rg -n "audience|hardness" *.ts | grep -v '^context-packs.ts'
rg -n "sendText\(free, deliveredBrief" server.ts ; rg -n "acceptance" server.ts
rg -n "CONTEXT_PACKS" e2e/pins.ts ; sed -n '1740,1870p' e2e/pins.ts

# Daten, gefiltert, read-only im Haupt-Checkout
python3  # 3 Hash-Rekonstruktionen, Feld-Zensus ueber 582 Zeilen, 2 git-Ancestry-Joins
```

**graphify-Verdikt: Anker, keine Laufzeitwahrheit.** Der Lauf fand die reine Modulfamilie
(`planContext`, `contextOmissionFor`, `planRepoContext`, `stampObservedSourceHashes`,
`observedSourceHash`) und schnitt bei 56 von 72 Knoten am Token-Budget ab. Die fuenf
Zustell-Naehte in `server.ts` — das eigentliche Thema — kamen NICHT vor. `rg` hat sie geliefert.
Das ist dieselbe Werkzeuggrenze, die die GLM-Notiz vom 2026-09-05 protokolliert hat; kein Defekt.

## 2. Die Kette, wie sie am `a65fbdd` wirklich laeuft

| Stufe | Ort | Was genau passiert |
|---|---|---|
| Herkunft A | `context-packs.ts#CONTEXT_PACKS` | 6 Seeds, compile-time `as const`. Werden **nie** validiert (§B4). |
| Herkunft B | `.fleet/context-packs.json` | 2 Packs dieses Repos, gelesen mit `git show <head>:<path>` (`server.ts#showAtHead`), 64 KB / 64 Packs / 64 Pfade Deckel |
| Validieren | `context-pack-validator.ts#validateContextPacks` | **nur Herkunft B.** Capability-Snapshot absichtlich LEER → harte Packs bekommen `CAPABILITY_AVAILABILITY_UNKNOWN`, das ist kein Defekt |
| Waehlen | `context-plan.ts#contextOmissionFor` | EINE Leiter, **erster Fehlschlag gewinnt**: `manifest-invalid` → `source-unavailable` → `status-not-active` → `harness-unsupported` → `mode-unsupported` → `trigger-not-matched` → `capability-missing`. Faktvektor `{sourceTree, harness, mode, triggers, capabilities}` |
| Versionieren | `context-manifest.ts#stampObservedSourceHashes` | stempelt jede Selection aus EINEM `git ls-tree -r <head>` |
| Rendern | `server.ts#renderContextAnchorBlock` | rendert **ausschliesslich `plan.selected`**; `""` bei leerer Auswahl |
| Zustellen | `server.ts#sendText` an 5 Naehte | liefert eine `Acceptance` zurueck — **alle fuenf verwerfen sie** (§B1) |
| Quittieren | `appendEvent(CONTEXT_RECEIPT_FILE)` | `selected` UND `omitted`, `head`, `deliveredBytes`, `renderer`, `briefHash`, `briefSource` |
| Ruecklesen | `GET /api/context-receipts` (owner) | `src/client.ts` hat **null** Aufrufer; `programExecutionView`/`supervisorView` projizieren `selected`/`omitted` weg (`server.ts:1886-1895`, `:19617-19624`) |

**Auswahl je Trigger — die drei Fakt-Produzenten sind Konstanten.** `DISPATCH_CONTEXT_*`
(`server.ts:8057-8064`) und `BOOTSTRAP_CONTEXT_*` (`:18613-18623`) tragen beide
`triggers: ["always","verification"]`, `mode: "mutating"`. `landingAnchorBlock` (`:16602-16620`)
ist der einzige Ort mit `triggers: ["landing"]`, und er quittiert nichts. Das Ledger bestaetigt es:
**582 von 582 Zeilen tragen `mode: "mutating"` und genau dieses eine Trigger-Tupel.**

**Was `sourceHash` wirklich bedeutet** (`context-manifest.ts:166-176#observedSourceHash`, Begruendungsblock ab `:148`):
`sha256` ueber `<pfad>\0<git-blob-sha>\0` je Quelle, **in Quellenreihenfolge**. Also:

- Es ist **kein** Hash der Bytes und **kein** Blob-Hash — es ist ein Hash ÜBER Blob-Shas.
- Es beschreibt **ganze Dateien**, nicht den Anker-Abschnitt. Der Kommentar sagt es ausdruecklich:
  „the version of what the anchor points INTO, not of the anchor line".
- Es ist `undefined`, sobald **eine** Quelle am geplanten Commit keinen Blob hat — nie ein
  Teil-Hash.
- **Beobachtet schlaegt deklariert**: das Literal aus dem Manifest ueberlebt nur dort, wo nichts
  beobachtbar ist (untracked, Fremdbaum, privates Overlay).
- Begruendung ist gemessen und steht im Code: 1 794 908 Bytes und ~108 ms `git show` je
  Zustellung gegen ~24 ms fuer das eine `ls-tree` (Messung 2026-09-03).

**Budgetgrenze: es gibt keine.** `estimatedBytes` steht auf jedem Pack und auf jeder Selection,
wird aber **nirgends summiert, verglichen oder durchgesetzt** (`rg -n estimatedBytes *.ts` → nur
Deklaration und Durchreichen; es steht nicht einmal in der Quittung). `truncated` ist an allen
fuenf Naehten das Literal `false` (`server.ts:8244, 19289, 19411, 19961, 20198`), und im Ledger
gilt `truncated ∈ {false}` fuer alle 582 Zeilen. Der Block ist nur ueber die Pack-Zahl begrenzt
(64) — nicht ueber Bytes. Heute unkritisch (max. 4 Packs zugestellt), aber als „Budget" existiert
das Feld nicht.

## 3. Die Herkunft→Auswahl→Brief→Empfaenger-Matrix (drei Stichproben)

Zwei historische Quittungen aus dem Auftrag, plus **diese Lane als frische Stichprobe** — die
einzige, bei der der Empfaenger die gelieferten Bytes selbst bezeugen kann.

| | `7ceb87fd…` Astra-Gruendung | `a6ebedb8…` S1-Lane | `5ba5eb36…` DIESE Lane |
|---|---|---|---|
| Zeit / `head` | 2026-09-05 08:12:44 · `ea6ab534` | 2026-09-05 10:19:31 · `33cec522` | 2026-09-07 04:46:40 · `a65fbdd5` |
| Slot / Branch | 3 · `main` | 9 · `fleet/260905081926-9694` | 2 · `fleet/260907024635-0ee3` |
| Harness / Modell | `codex` / `astra` | `null`→claude / `claude-opus-5[1m]` | `null`→claude / `claude-opus-5[1m]` |
| `briefSource` / `briefHash` | `founding` / `e79b08ccc96f` | `raw` / `dfbbe71924f4` | `owner` / `9f08f5b6e7bd` |
| **selected** | portable-core · verify-e2e · rulebook-generat · messnotiz-index | dieselben 4 | dieselben 4 |
| **omitted** | land-mechanics `harness-unsupported` · task-queue `trigger-not-matched` · harness-adapter `trigger-not-matched` · private-deploy-overlay `harness-unsupported` | alle 4 `trigger-not-matched` | alle 4 `trigger-not-matched` |
| `deliveredBytes` | 18 166 | 10 765 | 8 130 |
| Ankerblock rekonstruierbar? | **ja, `hash` reproduziert** | **ja, `hash` reproduziert** | **ja, `hash` reproduziert** |
| Ankerblock im Brief = Rekonstruktion? | rekonstruiert (kein Byte-Original) | rekonstruiert (kein Byte-Original) | **GEMESSEN, 934/934 Bytes identisch** |
| Enthielt der Brief die Auslassungen? | nein (rekonstruiert) | nein (rekonstruiert) | **nein — GEMESSEN am eigenen Prompt** |
| Wurde der Brief gelesen? | **unknown** | **unknown** | unknown (Empfaengerattest ≠ Systembeleg) |

**Die Rekonstruktion ist nicht nur plausibel, sie ist gerechnet.** `server.ts:8233-8236` hasht
`JSON.stringify({anchorBlock, planFacts:{harness,mode,triggers,selected,omitted}})`. Ich habe
`renderContextAnchorBlock` in Python nachgebaut, den Block aus `selected` der jeweiligen Zeile
erzeugt und den Hash neu gerechnet:

```
7ceb87fd12db5720de7146ce0769d8dd recomputed==stored: True 28d798b489d5359f
a6ebedb81c5088e28f41d5a432220e39 recomputed==stored: True 7ab6d378814ee6a6
5ba5eb3650d5a9b9cbf70c4001db0e0b recomputed==stored: True a1c7d87fedf2c462
```

Der reproduzierte Hash beweist, dass der rekonstruierte Block **byte-identisch** zu dem ist, den
der Server damals gerendert hat. Fuer die eigene Lane habe ich zusaetzlich den Block aus dem
tatsaechlich empfangenen Gruendungsprompt danebengelegt: `identical: True, 934 == 934`.

**Damit ist der Ausgangsbefund bestaetigt und praezisiert:** MAIN sah `selected` UND `omitted`,
weil MAIN das LEDGER las. Der BRIEF trug nie Auslassungen — an keiner der drei Stichproben, und
strukturell an keiner: `renderContextAnchorBlock` iteriert `plan.selected` und beruehrt
`plan.omitted` nicht. Das ist **kein Fehler des Renderers**, sondern eine unbeantwortete
Adressatenfrage (§4, B2/B3).

**Verbindbarkeit — was die Zeile traegt und was nicht.**

| Dimension | Traegt die Quittung? | Beleg |
|---|---|---|
| Empfaenger (Slot/Branch/Modell/Effort) | **ja** | `slot`, `branch`, `model`, `effort` |
| Repo + Baum | **ja** | `repo`, `head` — alle drei `head` sind Vorfahren von `main` |
| Briefversion | **ja, zweifach** | `hash` (Anker allein) und `briefHash` (ganzer Brief, gleiche Funktion wie `LaneOutcome.briefHash`) |
| Aktualitaet der Quelle | **ja, je Pack** | `sourceHash` — seit dem Stempeln 450/450 Selections tragen ihn |
| Renderer-Version | **ja** | `renderer: "v2"` |
| **Rolle** | **nein** | die Leiter kennt keine; `audience` steht auf dem Pack und wird nicht gelesen (§B3) |
| **Zustellung** | **nein** | `deliveredBytes` ist die Laenge des Strings, den Fleet an tmux uebergab (§B1) |
| **Lesen/Verstehen** | **nein, und darf es nie sein** | ausdruecklich `unknown` |

**Der Baum-Join stimmt — gemessen, nicht angenommen.** Der Verdacht „Quelle aendert sich zwischen
Auswahl und Auslieferung" ist strukturell moeglich: der Worktree entsteht bei
`server.ts:8001#createWorktree` am Integrations-Tip, der quittierte `head` wird erst
`server.ts:8196` nach 4 s Boot-Grace plus Readiness-Wartezeit gelesen. Ueber alle 293
Quittungszeilen, deren Lane-Branch heute noch existiert:

```
lane base == receipt.head: 293  differs: 0  unresolvable: 0  (of 293)
```
(Basis = `<branch>~$(git rev-list --count <head>..<branch>)`.) **Grenze der Messung:** eine
spaeter auf `main` rebasete Branch haette eine andere Basis, faellt also nicht als Drift auf,
sondern verschwindet aus der Gleichheit — dass 293/293 gleich sind, heisst folglich: unter den
noch existierenden, nicht-rebasten Branches gab es nie eine Drift. Ein sauber funktionierender
Pfad, und er darf das Ergebnis sein.

## 4. Fuenf Befunde, rangiert

### B1 — Die Quittung belegt den BAU des Briefs, nicht seine ZUSTELLUNG — obwohl derselbe Aufruf die Annahme misst und zurueckgibt

`sendText` hat die Signatur `Promise<{ acceptance: Acceptance }>` mit
`Acceptance = "observed" | "not-observed" | "unobservable" | "not-applicable"`
(`server.ts:4868`, `:5055`) — die ACP-25-Regel „acceptance is OBSERVED, never echoed"
(`server.ts:4859-4861`). **Alle fuenf quittierenden Naehte werfen den Rueckgabewert weg:**
`server.ts:8228` (Lane-Dispatch), `:19269`, `:19387`, `:19937`, `:20174` (die vier
MAIN-/Supervisor-Gruendungs- und Nachfolge-Naehte). Auch `logPrompt` bekommt an diesen Stellen
keinen Status (`:8250`, `:19295`, `:19417`, `:20020`, `:20238` — je `"auto"`, kein vierter Wert).
**Zwei andere Transporte im selben Server behalten ihn:** der FleetEvent-Transport
(`server.ts:11217-11247`, auditiert `fleet_event_send_uncertain` bei `unobservable`) und der
Supervisor-Nudge (`:19710-19729`, `acceptance` steht in seiner eigenen Antwort-Quittung).

**Kosten.** Fuenf der sieben Harnesses deklarieren einen Composer und sind damit beobachtbar:
`claude` (`:493`, nur bei echter Binary), `pi`/`pi-zai`/`pi-ox` (`:609`, `:687`, `:740`), `codex`
(`:1135`). Der Codex-Kommentar an `:1132-1135` nennt die bezahlte Form woertlich: „the live
2026-08-22 symptom (a lane-ready event left whole in slot 10's composer, reported delivered)".
Zwei weitere Messungen dieses Repos treffen genau diesen Pfad: der Enter-Verlust bei Mehrzeilern
(2 von 7, `docs/messungen/acp21-prompt-annahme-2026-08-22.md`) und der haengende Dollar-Zeichen-Send
an Codex-Panes (Task `b958ac17`, gemessen 2026-09-05). In allen drei Faellen steht danach eine
Quittungszeile im Ledger, die sich wie eine Zustellung liest, und `deliveredBytes` nennt eine Zahl,
die nur die Laenge des uebergebenen Strings ist. **Das Feld, das den Unterschied kennt, wird an
der Stelle berechnet und fallengelassen.**

*Verify (deterministisch, kein Agent):* in einer isolierten Instanz mit `FLEET_CMD=true` (kein
Composer → `not-applicable`) und einer Composer-Attrappe je einmal dispatchen und pruefen, dass die
Quittungszeile `acceptance` traegt und dass `unobservable` dort steht, wo `readComposer` nichts
liest. Die Sonde muss als SIE SELBST scheitern, wenn die Attrappe nicht rendert.
*Disposition:* **abgegrenzter Fix vorgeschlagen** — ein Feld `acceptance` auf der Receipt-Zeile
(und derselbe Wert an `logPrompt`), fuenf Aufrufstellen, keine Vertragsaenderung. Beruehrt
`briefAndSend` und damit dieselbe Funktion wie Task `3af11665` (N1) — die dort verbotene Zone ist
„Anker-Block oder Receipt-Hash aendern"; ein zusaetzliches Feld NEBEN dem Hash faellt nicht darunter,
sollte aber nach N1 laufen, nicht daneben.

### B2 — Die Auslassungs-Begruendung ist die ERSTE gefallene Sprosse, nicht der Grund — und das trifft genau den bereits empfohlenen Schnitt

`contextOmissionFor` (`context-plan.ts:78-86`) gibt die erste verletzte Regel zurueck; das ist als
Vertrag ausgesprochen („Ladder order is the contract"). An den zwei historischen Stichproben wird
daraus ein messbarer Unterschied: dieselbe Nicht-Zustellung von `land-mechanics` heisst

- `harness-unsupported` in `7ceb87fd…` (Gruendung, `codex`), und
- `trigger-not-matched` in `a6ebedb8…` und `5ba5eb36…` (claude).

Lokale Negativprobe am unveraenderten Code (`bun`, reine Funktionen, nichts mutiert):

```
P3 land-mechanics @codex,  bootstrap triggers → harness-unsupported
P3 land-mechanics @claude, bootstrap triggers → trigger-not-matched
```

Beide Male ist das Pack unzustellbar; nur der Satz unterscheidet sich. **Kosten entstehen genau
dann, wenn der schon empfohlene erste Schnitt gebaut wird**
(`docs/messungen/2026-09-04-context-pack-routing.md` §C.2 und §D: „Omissions im Ankerblock
rendern"). Ein codex-Empfaenger, dem der Brief `land-mechanics: harness-unsupported` zeigt, zieht
den naheliegenden und falschen Schluss, ein claude-Empfaenger bekaeme das Pack — er bekommt es
auch nicht, aus einem anderen Grund. Eine gerenderte Zeile ist ein Entscheidungsinput; die
Leiterreihenfolge ist fuer Ledger-Statistik gebaut, nicht fuer eine Erklaerung an den Empfaenger.

*Verify:* eine reine Tabelle in `e2e/context-plan.ts` — je Pack die MENGE der verletzten Regeln
gegen den heutigen Einzelwert; die Sonde faellt, sobald ein Pack aus zwei Gruenden faellt und nur
einer genannt wird.
*Disposition:* **bestehende Task zuordnen** — Eingabe fuer CP-A („Trigger als Funktion des Akts +
Omissions rendern"), heute nur in Task `d5e6c26b` benannt und **ohne eigene Queue-Zeile**
(`fleet.json`, Stand 2026-09-07: keine Zeile nennt CP-A/CP-B/CP-C ausser dieser Notiz-Zeile).
Kein neuer Vorschlag, keine Owner-Promotion behauptet.

### B3 — `audience` ist deklariert und wird von der Leiter nie gelesen: die Rollen-Dimension ist unverbunden, nicht abwesend

`CONTEXT_PACK_AUDIENCES = ["agent","user","maintainer","private-ops"]` steht auf jedem Pack
(`context-packs.ts:12`). Die Leiter prueft `status`, `harnesses`, `modes`, `triggers`,
`requiredCapabilities` — **`audience` nicht**. Der einzige Leser im Auswahlpfad ist
`context-manifest.ts:115`, und der benutzt es nur, um einem FREMDEN Manifest ein `private-ops`-Pack
zu verbieten. Fleets EIGENES `private-deploy-overlay` (audience `private-ops`) haengt damit
ausschliesslich an Harness und Trigger. Negativprobe:

```
P2 private-ops pack, deployment trigger, ordinary lane caps → omission reason: NONE (it is selected)
```

Dasselbe gilt fuer `scope` (nur Vokabular-Validierung, kein Leser) und `hardness` (nur
`context-pack-validator.ts:341` fuer `CAPABILITY_AVAILABILITY_UNKNOWN`).

**Kosten heute: null** — kein Seam feuert `deployment`, und `landingAnchorBlock` haelt seinen
Harness auf dem Literal `"claude"`. **Kosten morgen: der Schnitt, der die Sperre aufhebt, ist
derselbe, der empfohlen ist.** Sobald `triggers` eine Funktion des Akts wird (CP-A), faellt die
einzige Klammer, die ein `private-ops`-Pack heute von einer gewoehnlichen Lane fernhaelt. Das ist
die praezise Fassung der offenen Rollenfrage: die 2026-09-04-Notiz sagt „die Naht kennt nie, WER
der Adressat ist" — richtig, und zusaetzlich gilt, dass das Pack es bereits SAGT. Ein Abgleich
`pack.audience` gegen eine Rollen-Tatsache ist eine Leiter-Zeile, kein neues Feld.

*Verify:* `contextOmissionFor` mit einem `private-ops`-Pack, passendem Trigger und Lane-Fakten;
heute `null`, nach dem Fix `audience-unsupported`.
*Disposition:* **Owner-Vertragsfrage, an einen bestehenden reservierten Akt gehaengt.** Task
`d5e6c26b` (2) legt ausdruecklich fest, dass das Rollen-Vokabular am Faktvektor in DENSELBEN
Owner-Akt gehoert wie der Adressat-Begriff von D1 (S3a-i, Task `30383e62`). Dieser Befund ist ein
Eingabefakt fuer genau diesen Akt und **kein eigener Vorschlag**; er verschiebt nur die Kosten:
die Sperre gehoert VOR CP-A geklaert, nicht danach.

### B4 — Die sechs Fleet-Seeds werden nirgends anker-validiert; die zwei Repo-Packs zweimal

Repo-deklarierte Packs werden am Zustell-Seam gegen die Bytes am `head` geprueft
(`server.ts#repoManifestContextPlan` → `validateContextPacks`) **und** im Land-Gate
(`e2e/pins.ts:1754-1792`, `RULE_MANIFEST` liest ausschliesslich `.fleet/context-packs.json`). Fuer
die Seeds tut das **niemand**: `planContext` (`context-plan.ts:94-115`) kennt nur
`sourceTree: "fleet"|"foreign"` — ein Blanko-Urteil ueber alle sechs, kein Pfad- und kein
Ankertest. Negativprobe mit einer `blobShas`-Karte ohne `AGENTS.md` (die Form, die
`repoManifestContextPlan` erzeugt, wenn der Pfad am head fehlt):

```
P1a portable-core selected although planContext never looked at AGENTS.md: true
P1b portable-core   stamped=-  receiptWouldCarry=(none)
P1b verify-e2e      stamped=-  receiptWouldCarry=(none)
```

Das einzige Signal ist eine **Abwesenheit**: die Selection verliert ihren `sourceHash`, weil
`observedSourceHash` `undefined` liefert, sobald eine Quelle keinen Blob hat — und
`contextReceiptSelections` (`server.ts:8277-8296`) findet fuer einen Seed auch kein
Manifest-Literal zum Einsetzen. **Der schlimmere Fall erzeugt gar kein Signal:** eine UMBENANNTE
Ueberschrift laesst Pfad und Blob bestehen, also traegt die Zeile einen gueltig aussehenden
`sourceHash`, und der Brief liefert einen toten Zeiger.

*Heute unverletzt, gemessen:* alle 11 Anker der 6 Seeds und der 2 Repo-Packs loesen am `a65fbdd`
auf (Schleife ueber `git show <head>:<path>` + Substring-Test, 11/11 `anchor PRESENT`).
*Kosten:* ein toter Zeiger im Brief ist teurer als ein fehlender — er kostet den Empfaenger eine
Suche und liest sich als Doku-Rot. Die Rotungsrate von Prosa-Ueberschriften in diesem Repo ist
belegt (`docs/messungen/video-codebase-klarheit-2026-08-25.md` §2.1).
*Verify:* genau die Schleife oben als Pin neben `RULE_MANIFEST` — Millisekunden, kein Server.
*Disposition:* **abgegrenzter Fix vorgeschlagen** (ein Pin in `e2e/pins.ts`, kein Serverpfad).

### B5 — Das `sourceHash`-Abwesenheitssignal ist ueber die Stempelgrenze hinweg zweideutig

`renderer` ist der erklaerte Rekonstruktionsschluessel („a row without it is a v1 row by date",
`server.ts:8230-8232`). Er trennt v1 von v2, aber **nicht gestempelt von ungestempelt**:

| `renderer` | Selections MIT `sourceHash` | OHNE |
|---|---|---|
| `v2` | 450 | 800 |
| abwesend (v1) | 0 | 163 |

Erste Zeile mit `sourceHash`: **2026-09-03T17:32:05**. Danach fehlt er bei **0 von 450**
Selections. Das Signal aus B4 („keine Version → Quelle war weg") ist also fuer alles nach diesem
Zeitpunkt eindeutig — aber nur fuer einen Leser, der das Datum kennt; die Zeile selbst sagt es
nicht.
*Kosten:* gering und einmalig — ein spaeterer Leser des Ledgers datiert einen echten Quellverlust
faelschlich als Altzeile.
*Disposition:* **beibehalten**, hier benannt statt gefixt. Ein `renderer: "v3"`-Bump nur dafuer
waere teurer als die Zeile in dieser Notiz.

## 5. Flaechen-Entscheid

| Flaeche | Entscheid | Begruendung |
|---|---|---|
| Harness-Adapter (`server.ts` HARNESSES) | **apply** fuer B1 — 5 von 7 deklarieren einen Composer, sind also beobachtbar; `pi-unfenced`/`container` `not-applicable` (kein Composer → `acceptance: "not-applicable"`, ehrlich) | `server.ts:493, 609, 687, 740, 1135` |
| Protokoll/Wire | **not-applicable** — die Kette hat keine Wire-Flaeche; Zustellung ist tmux-Paste | `server.ts#sendText` |
| Server | **apply** fuer B1–B4 | fuenf Naehte, eine Leiter, eine Pin-Datei |
| Client (`src/client.ts`, `public/`) | **not-applicable fuer diese Notiz** — kein Aufrufer von `/api/context-receipts` existiert; das ist Befund 5 der 2026-09-04-Notiz und wird hier nicht wiederholt | `rg` ueber `src/client.ts` → 0 Treffer |
| Doku (`AGENTS.md`, `rulebook/`) | **unsupported hier** — die Doku-Blindheit des Pack-Systems ist Befund 6 der 2026-09-04-Notiz; mein Write-Set schliesst Regelbuch und AGENTS aus | Auftrag |
| Ledger `context-receipts.jsonl` | **apply** — B1 und B5 sind Feld-Fragen der Zeile | 582 Zeilen gelesen |
| `SYSTEM.md` (Zielsprache) | **apply als Zielabgleich, nicht als Gleichwertigkeit** | §6 |

## 6. Abgleich mit der Zielsprache (SYSTEM.md, nur die beauftragten Abschnitte)

`SYSTEM.md:105-117` verlangt vom `ContextEnvelope` „ausgewaehlte **und ausgelassene**
Kontextquellen"; `:151-166` (Kontextschichten) sagt an `:163-164`: „Der Planner entscheidet aus
`{role, act, project, harness, capabilities}`."

| Zielaussage | Implementierter Stand | Verdikt |
|---|---|---|
| ausgewaehlte Quellen | `plan.selected` → Brief + Quittung | **erfuellt** |
| ausgelassene Quellen | nur Quittung, nie Brief (3/3 Stichproben) | **teilweise** — der Adressat der Auslassung ist nicht entschieden (B2/B3) |
| Renderer-/Schemaversion | `renderer: "v2"` auf der Zeile | **erfuellt** |
| Planner-Fakt `harness` | `resolveContextHarness` | **erfuellt** |
| Planner-Fakt `capabilities` | zwei Konstanten-Saetze | **erfuellt (grob)** |
| Planner-Fakt `act` | ein konstantes Trigger-Tupel je Naht, 582/582 identisch | **offen** — CP-A |
| Planner-Fakt `role` | **nicht vorhanden**, obwohl `audience` auf dem Pack steht | **offen** — B3, owner-reserviert |
| Planner-Fakt `project` | nur als `sourceTree` + Repo-Manifest | **teilweise** |
| Trace: „Paste beweist Transport, nicht Verstaendnis" (`:130-133`) | die Quittung beweist heute **nicht einmal Transport** | **offen** — B1 |

Der Owner bestaetigt SYSTEM.md als Hub-**Ziel**, nicht als technische Gleichwertigkeit; die Tabelle
misst Abstand, nicht Schuld. `SYSTEM.md:238-242` (Implementierungsgrenze) autorisiert ausdruecklich
keinen Umbau der Zustellwege — diese Notiz schlaegt auch keinen vor.

## 7. Ausdruecklich nicht geprueft

- **Keine Live-UI, kein Modellstart, keine Live-Injektion, keine isolierte Suite.** Jede Aussage
  ueber Anzeige ist ein Code-Lesebefund.
- **Fremde Repos.** Nur `claude-fleet`s eigenes Manifest gelesen. Die 157 Fremdbaum-Zeilen
  (`source-unavailable` fuer alle sechs Seeds) sind nur aggregiert gezaehlt — die Dry-Runs gegen
  `private-repo-p`/`private-repo-j`/`private-repo-e` stehen in der 2026-09-04-Notiz und wurden nicht wiederholt.
- **Die drei quittungslosen Zustellwege** (`buildSuccessionBrief`, `/api/slots/:id/open`,
  `POST /api/lanes`) — Befund 7 der 2026-09-04-Notiz, nicht nachgemessen.
- **`e2e/programs.ts`, `e2e/context-plan.ts`, `e2e/context-packs.ts`** nur gegrept, nicht gefahren.
- **Ob ein Empfaenger den Ankerblock gelesen oder befolgt hat.** Strukturell `unknown`, in jeder
  Zeile. `deliveredBytes` ist eine Stringlaenge und darf nie anders gelesen werden.
- **Hub-UI und Inbox-Code**, per Auftrag ausgeschlossen. Ebenso die allgemeine Kontext-Gesundheit
  (GLM `746513d1`).

## 8. Entscheidungs-Trail

1. Vertrag und Gate zuerst (`AGENTS.md` §Portable operating contract, `GET /api/self/gate`), dann
   die zwei beauftragten Vorquellen.
2. `graphify` wie beauftragt zuerst — lieferte die Modulfamilie, nicht die Naehte; ab da `rg`.
3. Code in engen Fenstern; `453092cb` gegen `a65fbdd` per Symbol gegengeprueft statt per Zeile.
4. Die drei Quittungen gezogen und den `hash` nachgerechnet. **Das war der Wendepunkt:** ab dem
   reproduzierten Hash war „rekonstruiert" nicht mehr ein Zugestaendnis, sondern ein Beweis —
   und die eigene Lane machte daraus eine gemessene Kante.
5. **Erste Kandidatenliste verworfen.** Vier meiner ersten Befunde (Omissions nicht gerendert ·
   niemand liest die Quittungen · vier tote Seeds · `pi-ox`) standen bereits in
   `2026-09-04-context-pack-routing.md`. Zurueckgenommen statt umformuliert; was blieb, sind die
   fuenf oben.
6. Ein weiterer Kandidat zurueckgezogen: „ein achter Harness faellt still auf `claude` zurueck"
   (`context-plan.ts:73`) — der Pin an `e2e/pins.ts:2493` pinnt das `HARNESSES`-Literal, ein
   achter Harness bricht also das Gate ohnehin, und heute traegt kein Seam einen Trigger, der die
   Differenz sichtbar machen wuerde. Latente Null-Kosten-Beobachtung, kein Befund.
7. Der Drift-Verdacht (Baum bewegt sich zwischen `createWorktree` und `integrationHead`) wurde
   **gemessen und ausgeraeumt**, nicht weggeargumentiert — mit benannter Grenze.
8. Dispositionen gegen `fleet.json` gehaengt statt neue vorzuschlagen; die Owner-Reservierung in
   `d5e6c26b` (2) ist der Grund, warum B3 keine Empfehlung ist.
