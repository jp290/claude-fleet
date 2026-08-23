# Die ACP-Self-land-Kette ist GEPARKT — Übergabe-Mapping für Self-land Policy MAIN (Slot 3)

**Owner-Anweisung 2026-08-23, wörtlich in ihrer Grenze:** *"Do not file ACP-31/32 yet: their
self-land/continuation scope overlaps the active Fable+GLM+GLM simplicity audits and would create
duplicate architecture. Park the old chain, preserve its evidence, and hand its exact
ACP-29/30/31/32 mapping to Self-land Policy MAIN slot3 when the three reviews converge."*

Dieses Dokument IST die Parkstellung. Es entscheidet nichts und startet nichts.

## 0. Die Übergabe-Bedingung — und wer sie prüft

Übergeben wird an **Slot 3 `Self-land Policy MAIN · Fable`** (lebend, cwd `/Users/owner/claude-fleet`),
**erst wenn die drei aktiven Reviews konvergiert sind** — nicht vorher, auch nicht teilweise.
Solange: nichts freigeben, nichts filen, nichts bauen.

**Der Zustand des Slots ist kein Ersatz für die Bedingung.** Ein Slot-Datensatz sagt nicht, ob ein
Review inhaltlich konvergiert ist; das liest ein Mensch oder eine MAIN aus den drei Berichten.

## 1. Das exakte Mapping

| Act | Queue-Zeile | Zustand HEUTE | Was damit geschieht |
|---|---|---|---|
| **ACP-27** | `793c9cd9` | `pending`, **VOID** | NICHT bauen, NICHT freigeben, NICHT als Vorlage lesen. Trägt die vom Owner am 2026-08-23 ersetzte ENGE Fassung (nur Land, clean-green, alles andere Owner-Gate). Löschung ist ein Owner-Akt. |
| **ACP-28** | `bfbb788c` | `pending`, **VOID** | dito — Critic zur ersetzten Fassung. |
| **ACP-29** | `80abd6d1` | `pending`, gültig | **ReviewReadyAutonomy** — die benannte Programm-Policy (Default owner-only für Legacy-Programs). GEPARKT: geht an Slot 3, wird nicht von hier freigegeben. |
| **ACP-30** | `9617afe9` | `pending`, gültig | **Portabler Vertrag + Studio-Vorlage** nachziehen, damit die ersetzte Fassung nicht in den Dokumenten fossilisiert. GEPARKT wie ACP-29. |
| **ACP-31** | *nicht gefilt* | — | **Tower-Verify-Adapter.** NICHT FILEN (Owner-Anweisung). Inhalt siehe §3. |
| **ACP-32** | *nicht gefilt* | — | **Wellen-Critic** für ACP-29/30. NICHT FILEN (Owner-Anweisung). |

**Warum 31/32 ohnehin nicht filbar wären** — der Deckel ist voll und verweigert wörtlich:
`{"error":"program filing cap reached (5/5 filed rows not yet released) — release or drop one first"}`
Die fünf Plätze halten `0325ba73`, `793c9cd9`, `bfbb788c`, `80abd6d1`, `9617afe9`. Zwei davon sind
VOID. Die Owner-Anweisung und der Deckel zeigen hier zufällig in dieselbe Richtung — das ist ein
Zusammentreffen, kein Mechanismus, und darf nicht als einer beschrieben werden.

## 2. Die Evidenz, gesichert statt behauptet

- **Red-Team 1/3 (GLM-5.3)** — `docs/messungen/2026-08-23-redteam-glm-autonomie.md`, gelandet als
  `0a4fe4a` (main-direct cherry-pick von `57d8d28`, Branch `fleet/260823075928-af51`).
  **Main-direct heißt: kein Land-Ledger, keine Land-Note, kein Post-Land-Audit.** Verifikation von
  Hand: `bun e2e/pins.ts` → ALL PASS. Docs-only, eine Datei, 309 Zeilen.
  Sein Kernsatz: die Schleife bis „lane finished" ist fast geschlossen, aber ihr Ende ist doppelt
  ein Owner-Klick (Merge-Start und confirm für jeden nicht-grünen Verdict); maschinell fehlen genau
  zwei Wörter — **land** (keine MAIN-Tür) und **budget** (kein Objekt, kein Sensor).
- **GLM-Entscheidungsreview UMBRA/AFTERIMAGE** — `docs/messungen/2026-08-23-glm-decision-review-umbra-afterimage.md`,
  gelandet als `cc9b90e`. Geerntet aus der Result-Rail, weil die Lane den Baum nicht anfasste und
  ihr Ergebnis sonst mit dem Slot gestorben wäre.
- **Messbarkeitslage** — `docs/messungen/2026-08-20-gamestudio-readiness.md`: von acht Act-9-Größen
  hat KEINE einen vollständigen maschinellen Sensor.

## 3. Was ACP-31 gewesen wäre (damit Slot 3 es nicht neu herleiten muss)

**Tower ist heute strukturell land-unfähig, gemessen:** `/Users/owner/private-repo-k`
fehlt in `FLEET_VERIFY_CMD_REPOS` (`.env`, gitignored — mit `rg` unsichtbar, `grep`/`rg -uu`
nötig) und fällt damit auf den globalen `FLEET_VERIFY_CMD`, dessen erste Zeile
`[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }` lautet
→ `verify.ok: null` → auto-landet NIE (Entscheidungsstelle `server.ts:12995`,
`VERIFY_SKIP_EXIT` `server.ts:10049`).

**Der Haken, der den Schnitt teilt:** die Filing-Tür leitet `repo` aus dem Checkout des Aufrufers
ab und reicht **nie** über Repo-Grenzen. Die `.env`-Naht liegt in `claude-fleet`, der
Gate-Skript-Inhalt gehört ins Tower-Repo. Ein Act, der beides in eine Zeile packt, ist nicht
filbar — das ist eine Eigenschaft der Tür, kein Versehen.

## 4. Die Code-Anker, auf denen ACP-29/30 gebrieft sind (Baum `557bf3a`, vor Übernahme prüfen)

- `mergeJob` `server.ts:12738` · dreiwertige Entscheidungsstelle `server.ts:12995`
  (`verify.ok === null` = SKIPPED/TIMED-OUT/NEVER-STARTED bekommt denselben Stop wie Rot)
- **Heutige Land-Autorität:** einzige `mergeJob(`-Aufrufstelle `server.ts:18866`, erreichbar nur
  über die Owner-Route `server.ts:18570`. **Kein Tick landet.** Diese Aussage muss nach jedem
  künftigen Schnitt weiter prüfbar sein.
- MAIN-Türen: `boundProgramForMain` `:6070` · `releaseTaskForMain` `:6099` · `createTaskForMain` `:6199`
- Deckel: `PROGRAM_MAX_RELEASED` `:2665` · `PROGRAM_MAX_PENDING` `:2677`
- `interface Program` `:2131` — hat heute KEIN Policy-Feld
- Tick reicht seit ACP-24 die Agentwahl der Zeile durch: `server.ts:7462`, `FLEET_HARNESS_AUTOMATION` live `1`

## 5. Die Falle, die dieses Program zweimal bezahlt hat

Ein neues Feld, das `loadState` nicht kennt, **verschwindet beim nächsten Boot lautlos, bei
durchgehend grünen Checks.** ACP-23 hat es an der `source`-Allowlist bezahlt, ACP-24 hätte es an
`Task.spawn` wiederholt. Beide sind heute zu (`server.ts:14417`), und der Pin dazu vergleicht die
Union gegen die Allowlist als **Menge**, nicht als kopierte Liste. Jeder Nachfolge-Act mit einem
neuen persistierten Feld erbt diese Pflicht.
