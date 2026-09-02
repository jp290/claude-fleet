# Protokoll-Agent: Welcher Schritt des Slice-Protokolls liefert welchen Beweis?

Read-only-Analyse, 2026-09-02. Auftrag: HANDOFF.md:61-118 (H2, H4). Kein Code geaendert.
Plan-Quelle: `docs/sanierung-2026-09/plan-2026-08-31.md:123-160` (Slice-Protokoll a-g).

---

## 0. Die drei Zahlen, auf denen alles ruht (gemessen, nicht geschaetzt)

| Groesse | Wert | Quelle |
|---|---|---|
| `./e2e-isolated.sh` voller Lauf | 25:29 / 25:45 / 25:38 (seriell, Maschine nicht still) | `docs/messungen/p0-baseline-generalsanierung-2026-09-01.md` §Das Ergebnis |
| Post-Land-Audit lokal, gruen | 25,8 / 26,0 / 27,6 / 28,8 / 31,2 / 40,4 min | `post-land-audits.jsonl`, Zeilen `mainSha` cc391b7, e9c10ee, c09d5f1, e319388, 5c9f661, 87c5be6 |
| Land-Gate (Schritt e), ARBEIT | 98,8 s / 121,7 s / (232,3 s inkl. 122 s Warten) / (1952,6 s inkl. **1848 s Warten**) | `git notes --ref=fleet/land show 22165be / e03d44c / 5c9f661 / 7006696`, Feld `ms` vs `waitMs` |

**Der Gate ist nicht das Problem — das Warten ist es.** Die vier Land-Notes zeigen: Gate-Arbeit
~1,6–2,1 min, Gate-Wartezeit 0–31 min. Die Note von `7006696` sagt woertlich
`[suite mutex: 1848s of this 1953s run was spent waiting for /tmp/fleet-e2e.lock, not verifying
(1 of 3 staged steps blocked)]` — **95 % der Land-Dauer dieses Slices war Schlangestehen hinter
Vorschau und Audit.**

---

## 1. Die Tabelle: Schritt × Beweis × Minuten × Mutex

Minuten = je Slice, auf dieser Maschine. Herleitung in der letzten Spalte.

| Schritt | Was er ist | Noetig, weil / streichbar, ersetzt durch | ~min | Mutex? | Herleitung der Minuten |
|---|---|---|---|---|---|
| **a** `graphify query/path` → Abhaengigkeitsflaeche in den Brief; Deckel ~2000 Zeilen | Brief-Vorbereitung durch die MAIN | **Noetig, und durch nichts ersetzt.** Er ist der einzige Schritt, der den SCHNITT festlegt; e03d44cs Body zeigt, was passiert, wenn er unvollstaendig ist: drei im Brief genannte Symbole (`slotFrom`, `loadTaskSpawn`, `loadProgramFounding`) mussten die Lane als „Code vor Plan" zurueckweisen. Kosten des Fehlens = ein neu zu schneidender Slice. | ~5–15 | **nein** | ungemessen; Schaetzung aus der Brief-Struktur in HANDOFF.md:452-461 |
| **b** Lane: Move + Imports + Pin-Umhaengung + Exkavation, EIN Commit-Paket | die eigentliche Arbeit | **Noetig.** | ~130 (P4 Slice 1: Branch `fleet/260902051742-41fb` = 05:17 Spawn, Land-Note `at` 1788333582525 = 07:29) | **nein**, ausser die Lane faehrt selbst Suiten | gemessen an EINEM Slice, nicht verallgemeinerbar |
| **c** sol-Review auf `--color-moved` + pins-Diff (vakuum-gruene Pins? Verhaltens-Delta? Lockstep? persistierte Shape?) | menschlich/agentisch | **Zur Haelfte bereits mechanisch ersetzt** — den Teil „vakuum-gruene Pins" macht seit `ec5b6be`/`e03d44c` der Cross-Modul-Tripwire `RULE_SPAN` (`e2e/pins.ts:149-176`), und sein Kommentar sagt das ausdruecklich: „The plan's slice protocol asks step (c) to look for vacuum-green pins by hand; this makes that half mechanical." (`e2e/pins.ts:158-159`). **Die andere Haelfte** — persistierte Shape / Founding-/Marker-Validierung — hat KEINE Maschine: kein Pin, kein Gate-Schritt prueft „hat sich ein Validator verschaerft". Nicht streichbar. | ~15–30 | **nein** | ungemessen |
| **d** Vorschau: EIN serieller `./e2e-isolated.sh` in der Lane | Tier-2-Suite auf dem LANE-Baum, VOR dem Land | **Noetig fuer P5 und fuer jeden P4-Slice, der ein Symbol bewegt, das `e2e/*.ts` per Pfad liest — sonst streichbar.** Beweis nur er liefert: Praevention + Attribution (§2). Was ihn ersetzen KOENNTE, tut es nicht: der Gate (e) faehrt `e2e/security.ts` und die 3443 `e2e/*.ts`-Checks NICHT. | **~26** | **JA, voll** | 3 Baseline-Laeufe 25:29/25:45/25:38 |
| **e** Land ohne confirm (Verify-Kette als Gate) | autoritativ, serverseitig | **Noetig, unstreichbar** (`server.ts:11531-11557` `VerifyPlan`; `watchdog.sh:91` `VERIFY_CMD`). Fuer einen Slice, der `server.ts`/`server/` anfasst, faehrt er per Konstruktion die VOLLE Kette: `verify-proportion.ts#ruleFor` gibt `server.ts` und `server/` SERVER_RULE, `proportional` wird `false`, `steps` = alle sieben — bestaetigt in allen vier Land-Notes (`"proportional":false`). | **2 Arbeit + 0–31 Warten** | **teilweise** (3 von 7 Schritten sind Suiten) | Land-Notes `ms`/`waitMs` |
| **f** Audit gruen → Dry-Boot des Vorstandes → Deploy (Verb 2) → Health → `bun e2e/pins.ts` → `graphify update .` | Tier 2 + Betrieb | **Audit: noetig, unstreichbar** — er ist der einzige Ort, der den INTEGRIERTEN Baum misst (`docs/verify-tiering.md:346-350` Punkt (e)) und er laeuft ohnehin von selbst (`server.ts#drainPostLandAudits:12679`); niemand „faehrt" ihn, man wartet nur. **Der Rest von f (Dry-Boot/Deploy/Health/pins/graphify) ist NICHT je Slice noetig** — er ist ein Betriebszug und kann fuer N Slices gebuendelt werden; genau so ist er faktisch auch gelaufen: fuer Slice 1 wurde er GAR NICHT gefahren (HANDOFF.md:509-511: „Der Dry-Boot (Protokoll f) fuer Slice 1 ist NICHT gefahren; Deploy NICHT gefahren"). | **23–40 Audit** + ~10 Betrieb | **JA, voll** (Audit) | `post-land-audits.jsonl`, 09-01/09-02 |
| **g** Rot: Beweisordnung §11.7; Rueckweg `git revert` | nur im Rot-Fall | **Noetig, aber der Kostentreiber ist die BEWEISORDNUNG, nicht der Schritt.** `docs/verify-tiering.md:1956-1958`: „re-run the same tree first" — ein Rerun ist ein weiterer 26-min-Mutex-Halter. Der Trail zeigt genau das: Baum `2d4eb921` wurde am 09-02 **dreimal** gefahren (3, 14, 9 FAILs), Baum `5e2f47d6` **zweimal**. | 0 oder **+26 je Rerun** | **JA** | `e2e-trail/isolated-20260902*.jsonl`, Feld `tree` |

**Summe Mutex je Slice, wenn alles gruen laeuft: ~26 (d) + ~2 (e-Arbeit) + ~28 (f) = ~56 min
BELEGT.** Der Plan budgetiert dafuer „~15–25 min/Slice" (Plan Zeile 159) — **das ist ein
Doc-vs-Messung-Widerspruch, und die Messung gilt.** Rechnet man das Warten anderer Halter ein
(7006696: 31 min), ist der reale Wert eher ~60–90 min pro Slice, allein an Serialisierung.

---

## 2. H2-Urteil: die Vorschau ist NICHT redundant — aber sie ist an der falschen Stelle im Protokoll

**Urteil: H2 ist als generelle Regel FALSCH und als Regel fuer eine benannte Slice-Klasse RICHTIG.**

### 2.1 Was die Vorschau tatsaechlich gefunden hat: nichts — bei genau einer belegten Ausfuehrung

Ich habe die Trail-Dateien maschinell nach Baum-SHA aufgeloest
(`e2e-trail/isolated-20260902*.jsonl`, Feld `tree`/`dirty` aus `e2e/trail-emit.ts:71-75`):

| Trail | tree | rows | fails |
|---|---|---|---|
| `isolated-20260902T064422Z-62019` | **`b4cca7aa`** = P4 Slice 1 LANE-Commit (HANDOFF.md:466) | 3443 | **0** |
| `isolated-20260902T030148Z-69547` | `bd0aaae3` (main) | 3416 | 0 |
| 09-02, drei Laeufe | `2d4eb921` | 3443 | 3 / 14 / 9 |
| 09-02, zwei Laeufe | `5e2f47d6` | 348 / 3442 | 1 / 3 |

**Genau EIN Lauf ist einem Slice-Lane-Baum zuzuordnen: P4 Slice 1, und er fand null.** Fuer die
drei P3-Slices (`22165be`, `5c9f661`, `7006696`) habe ich **keinen Beleg gefunden, dass Schritt d
ueberhaupt gefahren wurde** — die Commit-Bodies fuehren als Beweis ausschliesslich (i) den
`bun build server.ts --target=bun`-SHA-Vergleich (`b313d549…`, 886573 B, dreimal identisch),
(ii) die textuelle Nicht-Kommentar-Diff-Probe, (iii) `bun e2e/pins.ts`. Keine Vorschau-Zeile,
kein Trail mit ihrem Lane-Baum. **P3 ist also faktisch bereits ohne Schritt d gefahren worden** —
und `22165be`s Audit kam rot zurueck (2 FAILs, `post-land-audits.jsonl`, 27,0 min), adjudiziert
als Flake (Handoff-Subject `ca52fc9`). Eine Vorschau haette diesen Flake nicht verhindert.

### 2.2 Die Behauptung „nichts, weil derselbe Lauf" — belegt, aber nur zur Haelfte

Die beiden Kommandos sind **textuell fast identisch**:

- Schritt d: `./e2e-isolated.sh` (Plan Zeile 141).
- Schritt f: `watchdog.sh:108` `AUDIT_CMD='[ -f fleet-e2e.ts ] || exit 42; bun install
  --frozen-lockfile || exit 42; ./e2e-isolated.sh'` — dasselbe Skript plus Repo-Guard plus install.

Drei belegte Unterschiede, und nur der erste ist harmlos:

1. **Env:** `server.ts#auditChildEnv:12815-12820` streicht JEDE `FLEET_*`-Variable aus dem
   Kindprozess. Die Lane-Vorschau streicht nur drei (`e2e-isolated.sh:18`
   `unset FLEET_SELF_TOKEN FLEET_SELF_SLOT FLEET_STEWARD_TOKEN`). Das ist genau die Klasse, die am
   01.09. als Gate-Env-Regress gelandet ist (`e319388`, „a gate is srv's child and inherits the
   operator's .env"). **Die Vorschau in der Lane ist damit der UNSAUBERERE der beiden Laeufe.**
2. **Baum:** die Vorschau misst den LANE-Baum (`b4cca7a`, basiert auf `c09d5f1`), der Audit den
   INTEGRATIONS-TIP (`server.ts#runPostLandAudit:12873` `snapshotIntegrationTree(repo, mainSha,
   dir)`; main war beim Land schon auf `4880d15`). `docs/verify-tiering.md:346-350`: „Two lanes each
   green against different mains can break main together; no pre-land gate structurally sees that
   combination."
3. **Zeitpunkt — und das ist der ganze Unterschied.** `docs/verify-tiering.md:311-320` nennt, was
   NUR ein Pre-Land-Beweis kauft: **(a) Praevention** (main traegt den Defekt nie) und
   **(b) Attribution** (ein Post-Land-Rot koaleziert Bursts und „can name three lands and identify
   none of them"). Und **(c)**: der Rueckweg ist duenner, als er klingt — `undo-land` ist ein Stack
   der Tiefe 3 (`server.ts#UNDO_STACK_MAX`), der bei jeder Luecke stirbt.

**Also: „nichts, weil derselbe Lauf" ist WIDERLEGT.** Die Vorschau kauft Praevention und
Attribution fuer die 3443 Checks, die der Land-Gate strukturell nicht sieht.

### 2.3 Der harte Grund, warum die Vorschau fuer P4/P5 gerade NICHT redundant ist

Der Build-SHA-Beweis von P3 traegt nur so weit, wie „reiner Move" heisst „das Bundle ist
byte-identisch". **Fuer P4/P5 gilt das nicht mehr**: `e03d44c` ist ein Datei-SPLIT — das Bundle
kann identisch sein, aber die Suiten lesen QUELLTEXT PER PFAD, nicht das Bundle:

- **79 Stellen in 12 `e2e/*.ts`-Modulen** lesen `src/client.ts` literal
  (`grep -rn 'src/client\.ts' e2e/*.ts | wc -l` → 79; Dateien: `lanes-lifecycle, pins, deploy-facts,
  watch, outcomes, explorer, self-token, prompts, programs, slots, tasks, steward-core`), typischerweise als
  `readFileSync(\`${dirname(realpathSync(\`${ROOT}/node_modules\`))}/src/client.ts\`)`
  (`e2e/explorer.ts:157`, `e2e/outcomes.ts:745`, `e2e/programs.ts:4806`, `e2e/watch.ts:3699`), und
  schneiden daraus Bloecke heraus, die sie TRANSPILIEREN und AUSFUEHREN
  (`e2e/explorer.ts:162` `cliSrc.slice(cliSrc.indexOf("interface PaintOpts"), …)`).
- Dieselbe Klasse fuer den Server: `e2e/slots.ts:1053-1057` liest `server.ts` per Pfad und
  transpiliert `mostRecentMainAnchor` heraus; `e2e/prompts.ts:31` und `:109` lesen
  `${ROOT}/server.ts` und schneiden `TEXT_ONLY_TOOLS` / `MERGE_TOOLS` / `REVIEW_TOOLS` heraus.

**Diese Leser sind NICHT universum-bewusst.** `e2e/pins.ts` ist es (die `universe()`-Konstruktion,
`e2e/pins.ts:78-112`, liest `server.ts` + `server/*.ts` bzw. alle `src/*.ts`); die 12 anderen
Module sind es nicht. Ein P4-Slice, der `mostRecentMainAnchor` nach `server/lane.ts` bewegt, oder
ein P5-Slice, der den Paint-Block aus `src/client.ts` herausnimmt, macht `selectSrc`/`fxSrc` LEER —
und der Check faellt. **Der Land-Gate faehrt keines dieser Module.** Der Fund kommt dann ~28 min
NACH dem Land, aus einem Audit, das eventuell drei Lands abdeckt.

### 2.4 Der Schnitt, den ich vorschlage (statt „streichen" oder „behalten")

Schritt d wird **bedingt**, mit einem ABLEITBAREN Kriterium statt einer Meinung:

> Vor dem Land: `git diff --name-only <base>..HEAD` und, fuer jedes Symbol, das die Lane aus
> `server.ts` oder `src/client.ts` HERAUSbewegt hat, ein `rg -n '<symbol>' e2e/` **ausserhalb**
> von `e2e/pins.ts`. **Null Treffer → Schritt d entfaellt.** Ein Treffer → Vorschau fahren (oder
> den Leser in derselben Lane auf `serverU.span()`/`clientU.span()` umhaengen und dann die Vorschau
> fahren, weil sich `e2e/` geaendert hat).

Das kostet Sekunden statt 26 min, und es ist derselbe Beweis, den `RULE_SPAN` fuer die Pins schon
mechanisch fuehrt (`e2e/pins.ts:149-176`) — nur auf die 12 nicht-universum-bewussten Module
ausgeweitet. **Fuer `e03d44c` haette dieses Kriterium „entfaellt" gesagt und waere richtig
gewesen** (3443/0). Fuer einen P5-Slice sagt es „fahren", und das wird richtig sein.

**Doc-vs-Code-Widerspruch, benannt:** `verify-proportion.ts:52-54` gibt jeder Datei unter `e2e/`
die `E2E_RULE` mit `isolatedPreview: true`. Ein Slice, der auch nur EINEN Pin umhaengt — und
`e03d44c` hat zwei umgehaengt — beruehrt `e2e/pins.ts` und bekommt vom Server also
`isolatedPreview: true`, also „fahre die Vorschau". `CLAUDE.md`/`AGENTS.md:217-219` sagen
gleichzeitig „Run it only if you touched the `e2e/` lifecycle, a suite wrapper, or the merge/land
path". **Die Maschine ist strenger als die Prosa.** Wer d streicht, streicht gegen eine laufende
Server-Empfehlung — die aber laut `AGENTS.md:184` und `CLAUDE.md` ausdruecklich ADVISORY ist. Kein
Gate bricht. Die Empfehlung ist zurueckdrehbar, indem `ruleFor` fuer `e2e/pins.ts` eine eigene
Regel bekaeme — das waere aber ein Code-Aenderung im Freeze und ich schlage sie NICHT vor.

---

## 3. H4-Urteil: die P4/P5-Kopplung ist VORSICHT, nicht Mechanik — mit genau einer echten Naht

**Urteil: H4 traegt. P5 kann parallel zu P4 laufen. Die Plan-Zeile „pins.ts serialisiert beide"
(Plan Zeile 116) ist durch `ec5b6be`/`e03d44c` ueberholt.**

### 3.1 Alle Stellen in `e2e/pins.ts`, die BEIDE Seiten lesen

`const server = serverU.text` steht auf Modulebene (`e2e/pins.ts:426`), `clientU` wird an
9 Stellen gelesen (`e2e/pins.ts:1243, 3199, 3202, 3819, 4346, 4485, 4531, 4640, 4751`). Davon ist
**genau EINE Regel eine echte Server×Client-Aussage**:

- **`e2e/pins.ts:3188-3212`** — „the client's `FleetEventRow` status union is the same SET of words
  as the server's `FleetEventStatus`". Der Kommentar darueber (`:3188-3194`) sagt warum:
  „BOTH SIDES ARE TYPESCRIPT AND THAT IS EXACTLY WHY THIS PIN EXISTS. src/client.ts declares the
  event status union itself rather than importing it, so the pair has no compiler between it."

Die uebrigen acht (`RULE_RAIL` :3819, `RULE_FOUNDING_BOARD` :4346/:4485, `RULE_PROFILE_ACTOR`
:4485, `RULE_PROMOTE` :4531/:4640, `RULE_PROMOTION_UI` :4640/:4751, ANALYSIS/BRIEF :1243) lesen
Server-Text und Client-Text im selben Block, aber ihre Aussagen sind je einseitig
(„nur EIN Client-Call-Site postet eine Program-Transition") — sie brechen an einem Move NICHT,
solange das Symbol im selben UNIVERSUM bleibt.

### 3.2 Warum das keine echte Serialisierung ist

Die `universe()`-Konstruktion (`e2e/pins.ts:78-112`) ist genau gegen den Split gebaut, und ihr
eigener Kommentar sagt es (`:57-60`): „Derived, never typed as a list — a list would need editing
by the same commit that splits the file, which is the edit nobody remembers to make."

- `serverU` = `server.ts` + alle `server/*.ts` (`:102-103`).
- `clientU` = `src/client.ts` + alle `src/*.ts` (`:109-112`).
- `.text` = alle Module gejoint → ein `includes` ueberlebt jeden Move INNERHALB eines Universums.
- `span()` bindet an EIN Modul (`:88-95`) → nur ein Rohschnitt ueber zwei Module bricht, und genau
  das stellt `RULE_SPAN` (`:171`) mechanisch fest.

**Empirischer Beleg:** `e03d44c` hat die GANZE FleetEvent-Familie (inkl. `FleetEventStatus`) nach
`server/types.ts` verschoben. `e2e/pins.ts:3188` blieb gruen — Commit-Body: „pins 327 ALL PASS,
zwei Rohschnitte auf `serverU.span()` umgehaengt, kein Pin vakuum-gruen". **Ein P4-Land kann ein
P5-Land also nicht ueber `pins.ts` rot machen und umgekehrt.**

Was bleibt, ist ein **textueller Merge-Konflikt in einer Datei** (`e2e/pins.ts`, 4862 Zeilen).
`e03d44c`s Aenderung daran waren zwei Hunks bei :1891 und :2519 — Server-Rohschnitte. Ein
P5-Slice wuerde die `clientU.span()`-Zeilen bei :3202/:3820/:4349/… anfassen. **Disjunkte
Regionen; ein Rebase-Konflikt ist moeglich, aber kein Rot.**

### 3.3 Die EINE echte Naht, und sie ist nicht `pins.ts`

Sie ist die 79-Stellen-Klasse aus §2.3: die 12 `e2e/*.ts`-Module, die `src/client.ts` per Pfad
lesen. **Diese sind die reale Serialisierung von P5** — nicht gegen P4, sondern gegen sich selbst:
jeder P5-Slice, der einen dieser Bloecke aus `src/client.ts` herausbewegt, muss den Leser in
DERSELBEN Lane mitziehen, und dann hat er `e2e/` angefasst und schuldet die Vorschau.

Beachte: `e2e-isolated.sh:59-62` haelt fest, dass `src/client.ts` selbst NICHT in die Instanz
gestaged wird — die sechs Leser aufloesen es „through the node_modules symlink on purpose"
(`e2e-stage.sh:247` `ln -s "$_st_s/node_modules" "$_st_d/node_modules"`). Der Client wird also
aus dem QUELLBAUM gelesen, nicht aus der Staging-Kopie. Das aendert nichts am Befund, erklaert
aber, warum `bun run build` (das P5-Verify) diese Checks NICHT abdeckt: der Build kompiliert,
die Checks lesen Text.

### 3.4 Vorschlag: eine Reihenfolge, die parallel laufen darf

```
Spur A (P4, seriell, Suite-schwer)   : Slice 2 persist.ts → Tier 1 → Tier 2 → Tier 3 → Tier 4
Spur B (P5, parallel, Suite-LEICHT)  : ui.ts → Pane → Picker → Explorer → Review → Lenses
                                        → Klein-Dialoge → Programs+Queue ZULETZT
Spur C (P6, parallel, kein Mutex)    : Sweeps NUR auf server/types.ts (existiert) — als LESE-Arbeit,
                                        Fixes als Queue-Zeilen, Umsetzung nach Spur A
```

Regeln, die die Spuren trennen:
1. **Nur EINE Spur landet gleichzeitig.** Der Land-Gate serialisiert ohnehin (`CLAUDE.md`
   §Land-Takt); parallel ist das PRODUZIEREN, nie das Landen.
2. **`e2e/pins.ts` wird von B nur in `clientU`-Zeilen angefasst, von A nur in `serverU`-Zeilen.**
   Wer die andere Haelfte anfassen muss, meldet es und wartet auf die Land-Luecke.
3. **Reihenfolge innerhalb B umdrehen, wo sie an die 79-Stellen-Klasse stoesst:** `Explorer`
   (`e2e/explorer.ts:157-168` liest `interface PaintOpts`…`loadTree`), `Programs`
   (`e2e/programs.ts:4806`), `Review/Outcomes` (`e2e/outcomes.ts:745`) und `Watch`
   (`e2e/watch.ts:3699`) sind die vier teuren. `ui.ts`, `Pane`, `Picker`, `Klein-Dialoge` sind
   billig — **sie sollten zuerst kommen, weil sie Spur B beweisen, ohne Mutex zu kosten.**
4. **Spur C beruehrt `server/types.ts` NICHT schreibend, solange Spur A laeuft** — sie liest und
   filet Befunde. `ls server/` heute: nur `types.ts` (`server/persist.ts` existiert noch nicht;
   Slice 2 ist der naechste Zug, HANDOFF.md:487).

### 3.5 Was dabei rot werden koennte (die vier benannten Faelle)

| Fall | Was rot wird | Wo | Wie teuer |
|---|---|---|---|
| P5 bewegt einen Block, den ein `e2e/*.ts` per `indexOf` schneidet | der Check faellt (leerer Slice), **nur im Audit sichtbar** | `e2e/explorer.ts:162`, `e2e/outcomes.ts:745ff`, `e2e/programs.ts:4806ff`, `e2e/watch.ts:3699ff`, `e2e/slots.ts:714ff`, `e2e/tasks.ts:51` | ~28 min Audit + Bisect ueber N Lands + evtl. `undo-land` |
| P4 bewegt `mostRecentMainAnchor` oder ein Tool-Profil | dito | `e2e/slots.ts:1053-1057`, `e2e/prompts.ts:31/109` | dito |
| Rohschnitt ueber zwei Server-Module | `RULE_SPAN` FAIL — **im Gate, vor dem Land** | `e2e/pins.ts:171` | ~2 min, Reparatur in der Lane |
| A und B aendern denselben `pins.ts`-Hunk | Rebase-Konflikt beim Land | `e2e/pins.ts` | Slice neu schneiden (Plan Zeile 145) |

Die ersten beiden sind der Grund, warum §2.4s Kriterium ein `rg -n '<symbol>' e2e/` ist und
nicht ein Bauchgefuehl.

---

## 4. Was ich NICHT geprueft habe (woertlich)

- **Ich habe die Lane-Branches der drei P3-Slices nicht gefunden oder gelesen** — mein Schluss
  „Schritt d wurde fuer P3 nicht gefahren" stuetzt sich auf die Abwesenheit einer Vorschau-Zeile in
  drei Commit-Bodies und die Abwesenheit ihres Baum-SHA im Trail-Verzeichnis. **Abwesenheit eines
  Belegs ist kein Beleg der Abwesenheit**; die Lane kann gefahren und nicht berichtet haben.
- **Ich habe die 79 `src/client.ts`-Stellen nicht einzeln gelesen** — ich habe sie gezaehlt
  (`grep -rn 'src/client\.ts' e2e/*.ts | wc -l` → 79, 12 Dateien) und VIER davon im Volltext
  gelesen (`e2e/explorer.ts:150-178`, `e2e/slots.ts:1048-1070`, `e2e/prompts.ts:28-40` und
  `:106-118`). Wie viele der 79 wirklich einen Block per `indexOf` schneiden statt nur den Pfad zu
  nennen, ist **gezaehlt-als-Obergrenze, nicht bestimmt**.
- **Ich habe keine Suite und keinen Server gestartet.** Alle Laufzeiten sind aus Ledgern und
  Land-Notes gelesen, keine ist von mir gemessen.
- **`docs/verify-tiering.md`** habe ich NUR §5b (Z. 252-304), §6 (Z. 305-358) und §11.7
  (Z. 1952-1969) im Volltext gelesen, plus die Ueberschriftenliste. §11 (die 13 Flake-Familien im
  Detail), §12 und §13 habe ich **nicht** gelesen — meine Aussagen ueber Flake-Familien stammen aus
  `CLAUDE.md` und aus `p0-baseline-generalsanierung-2026-09-01.md`.
- **Die Kosten von H1 (Second-host-Split) habe ich nicht bewertet.** Ich sehe im Ledger nur, dass
  die vier `remote helper (second-host)`-Zeilen ALLE rot ohne Check-Namen sind (`54964d1`, `d4f2bfc`,
  `7006696`, `e03d44c`) — das deckt sich mit HANDOFF.md:495-499, ist aber der Auftrag eines
  anderen Agenten.
- **Schritte a, c und der Betriebsteil von f sind ungemessen.** Ihre Minutenspalte ist eine
  Schaetzung mit Tilde und ohne Ableitungskommando; sie taugt zum Ranken, nicht zum Budgetieren.
- **Ich habe nicht geprueft, ob eine Lane technisch `bun run build`+Demo-Typecheck ohne Mutex
  fahren kann** (H4-Praemisse). Ich habe nur gelesen, dass `e2e-stage.sh` den Mutex nimmt
  (`e2e-stage.sh:32-35`, „Sourcing this file IS starting a suite") und dass `bun run build`
  `e2e-stage.sh` nicht sourct — daraus FOLGT es, gemessen habe ich es nicht.

---

## 5. Risiken je Streichung, als Kosten

**Ranking nach Erwartungswert (Wahrscheinlichkeit × Schaden), Schnittlinie nach Punkt 3.**

1. **Schritt d streichen fuer P5-Slices — TEUER, nicht empfohlen.**
   *Was bricht:* ein bis vier `e2e/*.ts`-Checks je Slice, in Modulen, die kein Gate faehrt.
   *Was unbemerkt wird:* nichts — es wird BEMERKT, aber ~28 min zu spaet, aus einem Audit, das
   drei Lands abdeckt und keines identifiziert (`docs/verify-tiering.md:315-318`). Der Rueckweg
   `undo-land` reicht drei Lands tief und stirbt an jeder Luecke (`server.ts#UNDO_STACK_MAX`).
   *Kosten:* ~28 min Audit + ~26 min Rerun (Beweisordnung §11.7) + Bisect + evtl. Revert-Land mit
   eigenem Gate = **realistisch 1,5–2 h fuer einen gesparten 26-min-Lauf.** Negativ.

2. **Schritt d streichen fuer P4-Slices OHNE `e2e/`-Symboltreffer — GUENSTIG, empfohlen.**
   *Was bricht:* nichts Bekanntes; `e03d44c` ist der Beleg (Vorschau 3443/0, Audit-Rot war remote
   und `unknowable`).
   *Was unbemerkt wird:* die Klasse „zwei gruene Lanes brechen main gemeinsam" — die faengt aber
   ohnehin nur der Audit (§6 (e)), nicht die Vorschau.
   *Ersatzbeweis:* der `rg -n '<symbol>' e2e/`-Filter aus §2.4 + `RULE_SPAN` im Gate.
   *Kosten:* **−26 min Mutex je Slice, ~0 Risiko** — sofern der Filter WIRKLICH gefahren wird.
   Wird er vergessen, faellt der Slice in Fall 1 zurueck. **Das Risiko ist Disziplin, nicht Technik**
   — deshalb gehoert der Filter als Zeile in den Slice-Brief, nicht in eine Regel.

3. **Den BETRIEBSTEIL von f (Dry-Boot/Deploy/Health/pins/graphify) je Slice streichen und buendeln
   — GUENSTIG, empfohlen.**
   *Was bricht:* nichts sofort. *Was unbemerkt wird:* `deployGap.codeBehind` waechst — der laufende
   Server ist dann N Slices hinter der Platte; ein Rollback-Beweis (Dry-Boot) fehlt fuer N-1
   Zwischenstaende. Genau dieser Zustand steht heute schon in HANDOFF.md:509-511.
   *Kosten:* ~10 min je Slice gespart; als Preis ein Deploy, dessen Dry-Boot N Slices zurueckspringt
   statt einen. **Deckel: nie mehr als drei Slices ohne Deploy** — jenseits davon ist der
   `undo-land`-Stack (Tiefe 3) kein Rueckweg mehr, und der Dry-Boot-Beweis testet dann einen Sprung,
   den niemand mehr rueckwaerts gehen kann.

--- SCHNITTLINIE: alles darunter ist Beobachtung, kein Vorschlag ---

4. **Schritt c streichen — NICHT empfohlen, ungekostet.** Die halbe mechanische Deckung durch
   `RULE_SPAN` ist belegt (`e2e/pins.ts:158-159`); die andere Haelfte (verschaerfter Validator →
   Boot-Refusal-Crash-Loop unterm Watchdog, Plan Zeile 138-140) hat keine Maschine, und ich kann
   die Wahrscheinlichkeit nicht beziffern.

5. **Beobachtung ohne Vorschlag:** der groesste einzelne Zeitposten in den vier Land-Notes ist
   nicht ein Protokollschritt, sondern **Warten** (`7006696`: 1848 s von 1953 s). Ein Slice, der
   sein Land in eine Luecke legt statt hinter einen laufenden Audit, spart ohne jede
   Protokollaenderung mehr als das Streichen von d. Ob das planbar ist, habe ich nicht geprueft —
   `POST /api/self/watch {kind:"audit"}` existiert (`CLAUDE.md` §Self-scheduling) und waere der
   Mechanismus, aber ich habe keine Messung, wie oft die Luecke lang genug ist.

---

## 6. Antwort auf die zwei Hypothesen, in je einem Satz

- **H2:** Falsch als Regel, richtig als Filter — die Vorschau ist fuer einen reinen Move ohne
  `e2e/`-Symboltreffer redundant (belegt an `e03d44c`: 3443/0) und fuer jeden Slice, der ein von
  `e2e/*.ts` per Pfad gelesenes Symbol bewegt, der einzige Pre-Land-Beweis ueberhaupt; „nichts,
  weil derselbe Lauf" ist widerlegt durch `server.ts#auditChildEnv:12815`, den Snapshot des
  Integrations-Tips (`:12873`) und `docs/verify-tiering.md:311-320`.
- **H4:** Richtig — `e2e/pins.ts` serialisiert P4 und P5 seit `ec5b6be`/`e03d44c` NICHT mehr
  mechanisch (die `universe()`-Konstruktion `:78-112` ist genau dagegen gebaut, und der einzige
  echte Cross-Pin `:3188` vergleicht Wort-MENGEN, nicht Orte); was wirklich serialisiert, sind die
  79 nicht-universum-bewussten `src/client.ts`-Leser in 12 `e2e/`-Modulen, und die serialisieren
  P5 gegen sich selbst, nicht gegen P4.
