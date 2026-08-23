# HANDOFF — Supervisor Notify MAIN (Slot 8, Program b1c4a497), 2026-08-23 — TERMINAL

**Nichts zu erben. Das Program ist fertig, gelandet, auditiert und deployt.** Stehende
Supervision liegt bei Slot 1; dieser Slot parkt.

- Acts: STN-1 Builder `504cb72` + `71a271c` · STN-2 Critic/Repair `512e0f2` (Owner-Watch-Tuer
  verweigert `kind:"transition"` per Namen — der echte Autoritaetsbefund). Land-Note an `512e0f2`:
  verify ok, 121 740 ms, wait 0.
- Post-Land-Audit `512e0f2`: **green, 1 402 719 ms, 2923 ran / 0 failed, Tail `ALL PASS`**
  (2835 → 2923, der Schnitt bringt Checks mit).
- Deploy Verb 2 `c28000a8`: `ok:true`, `hitTarget:true`, bootHead `512e0f2`, `bundleStale false`,
  `codeBehind false`, alle 20 beschrifteten Slots ueberlebten.
- Aufgeraeumt: Zeile `c5d566d6` (STN-1) war ein gestrandetes `pending` — ihre Lane df89 wurde vom
  Slot-Recycling getoetet, nachdem die Arbeit ueber die STN-2-Lane bereits auf main lag;
  kommentiert + `done`. Worktree `fleet-260823055908-df89` (baumgleich mit `71a271c`) + Branch entfernt.
- Beweis der Rail im Echtbetrieb: der Audit-Watch `ef4fa86e` dieses Slots feuerte ueber den
  FleetEvent-Pfad in die Pane und wurde per `POST /api/self/events/:id/ack` quittiert — erste
  Live-Zustellung an einen Controller. Eine echte Supervisor-`transition`-Completion hat noch
  niemand ausgeloest; das waere der einzige offene Beleg.
- Nebenbei gesehen, nicht angefasst: ACP-Handoff unten (zwei VOID-Zeilen blockieren dessen
  Filing-Deckel, Owner-Akt) · 7× `autoReview` „summarizer timed out" vor dem Restart · 1 geleakter
  e2e-tmux-Socket, 320 MB e2e-Scratch in TMPDIR.

# HANDOFF — ACP Architecture Controller VI (Slot 5), 2026-08-23, ctx ~24 % GEMESSEN

**Du erbst KEINE laufende Lane. Du erbst vier gefilte `pending`-Zeilen, von denen ZWEI GIFT sind,
und einen Filing-Deckel, der voll ist.**

## 0. Die exakte naechste Handlung

**Den Owner um die Loeschung von `793c9cd9` und `bfbb788c` bitten — sonst kannst du nichts filen.**
Beide tragen die vom Owner am 2026-08-23 AUSDRUECKLICH KORRIGIERTE enge Fassung (nur Land,
clean-green, alles andere Owner-Gate). Sie sind VOID. Sie zu loeschen ist ein Owner-Akt: die
Filing-Tuer liest einen geschlossenen Body und kann keinen Text aendern.

**Gemessen, nicht vermutet** — der Deckel steht auf 5/5 und verweigert bereits:
```
{"error":"program filing cap reached (5/5 filed rows not yet released) — release or drop one first"}
```
Solange die zwei VOID-Zeilen den Platz belegen, kannst du **ACP-31 (Tower-Verify-Adapter)** und
**ACP-32 (Wellen-Critic)** NICHT filen. Beide sind vom Owner verlangt und beide fehlen noch.

**Und: NICHTS freigeben, solange STN-1 (`c5d566d6`, Program b1c4a497…) `sent` ist.** `dispatch`
steht auf **`true`** — eine Freigabe startet SOFORT. Das ist der Grund, warum alles `pending` liegt.

## 1. Was terminal ist — gemessen, nichts geschaetzt

| Act | Land | Land-Gate | Post-Land-Audit |
|---|---|---|---|
| ACP-23 `POST /api/self/tasks` | `790729f` -> **`2d188da`** | ok, exit 0, **123 943 ms**, wait 0 | **green**, **1 311 096 ms**, **2822/0**, covers genau dieses Land |
| ACP-24 `Task.spawn` | `2d188da` -> **`096c577`** | ok, exit 0, **121 936 ms**, wait 0 | **green**, **1 319 161 ms**, **2835/0**, covers genau dieses Land |

Beide Zahlen sind BEWEGT (2810 -> 2822 -> 2835) und decken sich mit den Diffs. Bei Schnitten, die
neue Checks mitbringen, waere eine unbewegte Zahl das Verdaechtige.

**ACP-24s Vorschau habe ich SELBST gefahren**, weil der Lauf der Lane von aussen per SIGTERM
getoetet wurde (3 Zeilen Log, 0 PASS, 0 FAIL, **keine run-id** — „nie gemessen", nicht „rot").
Meiner: Tail `ALL PASS`, PASS=2835 FAIL=0, **genau eine** run-id `isolated-20260822T151223Z-7189`,
`tree=096c577 dirty=false`. Die Lane stand 0 hinter main -> Fast-forward -> **Vorschau, Gate und
Audit sahen denselben Commit.**

## 2. ZWEI KORREKTUREN an frueheren Handoffs — beide bezahlt

1. **`merge` macht den TEARDOWN MIT.** Die Fassung „`merge` zuerst, `land` ist der Teardown danach"
   ist falsch. Nach `landed=YES` ist der Slot frei und der Worktree weg; ein nachgeschobenes
   `POST /api/slots/:id/land` antwortet `{"error":"not a fleet-created worktree lane"}`. Zweimal so
   erlebt (Slot 2, Slot 7).
2. **`codeBehind: true` ist NICHT mehr der `.gitignore`-Fehlalarm** aus dem Handoff der
   Vorvorgaengerin. Ab ACP-23 steckt echtes `server.ts` dahinter. Aktuell steht es auf `false`
   (bootHead `429bfe1`, head `557bf3a`, behind 1 = ein Docs-Commit).

## 3. Der Stand der Owner-Politik — die Korrektur ist der Auftrag

**Nudge 1 (2026-08-23, eng):** owner-confirmed per-Program PromotionPolicy, MAIN darf Land
ANFRAGEN, nur clean/rebased + fresh verify ok:true, alles andere Owner-Gate.
-> kompiliert als ACP-27 `793c9cd9` + Critic ACP-28 `bfbb788c`.

**Nudge 2 (2026-08-23, KORREKTUR, ersetzt Nudge 1):** *review-ready autonomy*. Die MAIN besitzt die
GANZE reversible Programmschleife bis zum reviewbaren Build — Decomposition, Filing/Release,
Model+Harness-Routing, Retries/Ersatz, Konfliktaufloesung mit frischem Reverify/Critic, rote Checks,
Untersuchung ODER ausdrueckliche nonblocking-Klassifikation von Unknowns, interim kreative
Entscheidungen, In-Envelope-Tradeoffs, Land, lokale Preview-Builds, Screenshots/Playtests,
reversible Dev-Deploys. Fresh-agent reviews sind autonom. **Unknown/skipped ist nie ein Pass — aber
MAIN-Arbeit statt Owner-Gate.** Gestoppt wird NUR fuer: finale Owner-Produkt-/Geschmacks-Promotion ·
Aenderung der bestaetigten Produkt-Intent · irreversible/oeffentliche Produktionswirkung · neue
Credentials oder bezahlte Ausgaben/Budgetbruch · echt ungeloester Widerspruch nach BEGRENZTEN
Repair-/Critic-Runden.
-> kompiliert als **ACP-29 `80abd6d1`** (Policy) + **ACP-30 `9617afe9`** (portabler Vertrag +
Studio-Vorlage).

**Der Owner hat ausdruecklich verlangt, dass der fruehere enge Schnitt die ueberholte Fassung nicht
fossilisiert.** Deshalb sind ACP-27/28 VOID und nicht „zusammenzufuehren".

## 4. Was ich beim Briefen am Code verankert habe (damit du es nicht neu suchst)

- **Die Mechanik existiert schon, der Act aendert nur, WER sie anstoesst.** `mergeJob`
  (`server.ts:12738`) entscheidet bereits dreiwertig; die Entscheidungsstelle ist
  `server.ts:12995` (`else if (verify && verify.ok === null)` — SKIPPED / TIMED OUT / NEVER STARTED
  bekommen denselben Stop wie Rot). `VERIFY_SKIP_EXIT` = `server.ts:10049`.
- **Heutige Autoritaet:** die EINZIGE `mergeJob(`-Aufrufstelle ist `server.ts:18866`, erreichbar
  allein ueber die Owner-Route `/^\/api\/slots\/(\d+)\/merge$/` (`server.ts:18570`). Kein Tick
  landet. Diese Aussage muss nach ACP-29 weiter pruefbar sein.
- `interface Program` (`server.ts:2131`) hat **kein** Policy-Feld — die Policy ist ein neues
  optionales Feld, Abwesenheit = owner-only.
- `boundProgramForMain` `:6070` · `releaseTaskForMain` `:6099` · `createTaskForMain` `:6199` ·
  `PROGRAM_MAX_RELEASED` `:2665` · `PROGRAM_MAX_PENDING` `:2677` (Default 5, der volle Deckel).

## 5. Der Tower-Befund — SELBST gemessen, und er ist noch ungefilt

`FLEET_VERIFY_CMD_REPOS` (`.env`) nennt nur `private-repo-h`, `private-repo-n` und
`private-repo-i`. **`/Users/owner/private-repo-k` fehlt**, faellt also auf den globalen
`FLEET_VERIFY_CMD`, dessen erste Zeile lautet:
`[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }`
-> **exit 42 = SKIPPED -> `verify.ok: null` -> auto-landet NIE.** Genau wie der Owner sagte.
Slot 7 ist die Tower-Studio-MAIN, Slot 3 eine Tower-Lane. **ACP-31 (Tower-Verify-Adapter) ist
gebrieft im Kopf, aber NICHT gefilt — der Deckel war voll.** Beachte: die Filing-Tuer leitet `repo`
aus DEINEM Checkout ab und reicht nie ueber Repo-Grenzen; die `.env`-Naht liegt hier, der
Gate-Skript-Inhalt liegt drueben.

## 6. Offene Raender, die ich WEITERTRAGE

1. **`0325ba73`** (Board etikettiert `main`-Zeilen als „owner", `src/client.ts:6048`/`:6493`,
   Union `:257`) — selbst am Baum bestaetigt. Der Text nennt sich faelschlich „ACP-24 KANDIDAT";
   ACP-24 ist inzwischen `Task.spawn`. Braucht eine neue Nummer beim Aufgreifen.
2. **`docs/self-api.md` hat keinen §tasks-Abschnitt** — offener Rand seit ACP-23, in ACP-29/30 als
   zu entscheidende Flaeche benannt.
3. **ACP-24 hat die unbeaufsichtigte Reichweite VERGROESSERT:** `tickDispatch` reicht
   `taskSpawnOf(next)` durch (`server.ts:7462`), `FLEET_HARNESS_AUTOMATION` live `1`. Doppelt
   verriegelt, aber eine Owner-Grenze, keine Implementierungsfrage.
4. **STUDIO-00 (`7aaa6644`)** bleibt `pending`. Von seinen drei Vorbedingungen ist genau EINE zu:
   der Result-Rail ist live (am ACP-23-Canary belegt). Die anderen zwei sind Owner-Entscheide.
   **Nudge 2 beruehrt sie inhaltlich — pruefe, ob die Korrektur (2) und (3) bereits beantwortet.**
5. `96d000b0` (ACP-03 CRITIC) und `ad2ee96a` (CTX-01) unveraendert `pending`.
6. Vier Worktrees auf Platte, davon `fleet-260822142649-61ec` ohne Slot (Waise).

## 7. Maschinenzustand bei der Uebergabe

- main **`557bf3a`**, Server-Boot `429bfe1`, `bundleStale false`, `codeBehind false`.
- **`dispatch: TRUE`** — das ist neu und der Grund fuer jede `pending`-Entscheidung oben.
- Program `eeba7c04caae64d79969199b` ist occupant-genau an Slot 5 gebunden; die Nachfolge erbt es.
- Keine Suite laeuft. Keine ACP-Lane in Flug.
- Meine Watches sterben mit dieser Nachfolge — es gibt aktuell nichts zu beobachten, also nichts
  neu zu armen.
# HANDOFF — ACP Architecture Controller IX (Slot 3), 2026-08-22, ctx 24,8 % GEMESSEN

**Der Rollenvertrag steht, und ACP-23 IST IN FLUG — du erbst eine laufende Lane, keinen Plan.**
ACP-22 gelandet (`9bd9071`) und gruen auditiert (2810/0, ms 1 421 893). Danach hat der Owner
ACP-23 PROMOTET, und ich habe es gebrieft und gestartet. **Monitoring, Review und Land gehoeren
ausdruecklich DIR** (Owner-Anweisung 2026-08-22, woertlich: "the successor owns
monitoring/review/land").

## 0. Die exakte naechste Handlung

**Den Rueckweg auf Slot 2 NEU ARMEN — als ERSTES, bevor du irgendetwas anderes tust.**
Ich hatte Watch `865d1fd3` auf Slot 2 armed; **Watches sind slot-gebunden und sterben mit meiner
Nachfolge.** Ohne diesen einen Aufruf wartest du auf ein Signal, das nie kommt — es gibt keinen
eingehenden Kanal, niemand ruft an:

```
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"target":2}' http://100.64.0.1:8790/api/self/watch
```

**Danach: NICHT auf die Watch-Nachricht landen.** Sie ist ein SERVER-PRAEDIKAT (idle + clean +
ahead>0), kein Bericht der Lane — vier Zustaende sehen darin gleich aus. Pane lesen, den Diff
lesen, die Behauptungen der Lane SELBST am Code nachschlagen, dann erst mergen.

**Und die Reihenfolge, die meine Vorgaengerin falsch hatte: `POST /api/slots/2/merge` ZUERST,
`land` ist der TEARDOWN danach.**

### Was ACP-23 ist und wo seine Fallen liegen

Lane **Slot 2**, Branch `fleet/260822122337-67b3`, Queue-Zeile **`d91153f9`**, Opus 5, effort high.
Der volle Brief steht in der Zeile; hier nur, was du zum PRUEFEN brauchst.

Gebaut wird `POST /api/self/tasks`: eine gebundene Program-MAIN legt ihre EIGENE `pending`-Zeile
an. Owner-Grenzen woertlich: Default `notiz`, `auftrag` explizit erlaubt (nur im eigenen
occupant-gebundenen Program), Anlegen IMMER `pending`, **Release bleibt der separate Akt** ueber
die bestehende Route/den Tick. Write-Set exklusiv: `server.ts`, `e2e/tasks.ts`, `e2e/pins.ts`.

**Die drei Dinge, an denen du den Schnitt pruefst:**
1. **`server.ts:14210`** — die Reload-Allowlist `["owner","intake","steward"]` fuer `Task.source`.
   Fehlt `"main"` dort, **verschwindet jede so angelegte Zeile beim naechsten Server-Boot
   lautlos**, bei durchgehend gruenen Checks. Der Brief verlangt eine eigene Sonde dafuer
   (anlegen -> State-Reload -> Zeile noch da). Ohne diese Sonde ist der Schnitt nicht fertig.
2. **`server.ts:1690`** — die `source`-Union braucht `"main"`; `loadTaskKind` (`:1673`) NIMMT
   `source` entgegen, sein Verhalten fuer den neuen Wert muss ENTSCHIEDEN sein, nicht geraten.
3. **Die Non-Goals sind einzeln vom Owner benannt und keine Geschmacksfrage:** keine Zeile in der
   Capability-Karte (faellt an `src/protocol.ts:275`, `stateEffect` ist Literaltyp `"none"` —
   `docs/kritik-opus-2026-08-21.md` Befund 3), kein Supervisor-Fix, keine Loader-/Host-Naht, keine
   Studio-Arbeit, kein Anfassen von `releaseTaskForMain`/Tick/`dispatchTask`.

**Verify dieser Lane ist die VOLLE Kette plus `./e2e-isolated.sh`** (sie fasst `e2e/` an) — nicht
die Prosa-Abkuerzung, die fuer ACP-22 richtig war.

**Zwei offene Entscheidungen, die die Lane BEGRUENDEN soll und die du im Bericht suchst:** wie sie
`richtung`/`betrieb` behandelt (die Promotion nennt sie nicht) und ob `repo` `null` bleibt oder
aus dem Checkout abgeleitet wird.

## 1. Was terminal ist — alles gemessen, nichts geschaetzt

| Act | Land | Land-Gate | Post-Land-Audit | Deploy |
|---|---|---|---|---|
| Untracked-Aufloesung | `f51bdb9` -> **`b425807`** | main-direct, `bun e2e/pins.ts` ALL PASS | keiner (kein Lane-Land) | nicht geschuldet |
| ACP-22 | `b425807` -> **`9bd9071`** | ok, exit 0, **124 159 ms**, wait 0 | **green** 1 421 893 ms, **2810/0**, covers `9bd9071c` | nicht geschuldet |
| Private-repo-e-Program | kein Land in DIESEM Repo | — | — | — |

**Die 2810 sind erneut unveraendert, und das ist wieder das SOLL:** ACP-22 fasste nur `AGENTS.md`
an, kein `e2e/`-Modul. Eine bewegte Zahl waere hier das Verdaechtige. Geprueft an `ms`,
`checks.ran` und `covers`, nicht am Wort „green".

## 2. `codeBehind: true` IST MEINS UND HARMLOS — jag es nicht

`deployGap.codeBehind` kippte in dieser Session von `false` auf `true`. **Kein Deploy ist
geschuldet.** Der Netto-Diff `bootHead(83468e0)..HEAD` enthaelt genau einen Pfad, den keine der
drei Allowlists kennt: **`.gitignore`**, aus meinem `b425807`. Der Fail-safe ist Absicht („a path
counts as code unless it is KNOWN not to be", `server.ts:15583`). Die einzige Stelle, an der der
laufende Server `.gitignore` beruehrt, ist der Upload-Landability-Gate (`server.ts:18793`), und
die ruft `git check-ignore` PRO REQUEST — sie liest die Datei von Platte. Ein Neustart aendert
dort nichts.

`.gitignore` in die docs-Allowlist aufzunehmen waere eine **Aenderung an der Abwaegung**, kein
Bugfix: der Kommentar (`:15594`) hat diesen Fehlalarm zweimal gemessen (2026-08-02 `src/client.ts`,
2026-08-04 `e2e/verify-queue.ts`) und sich bewusst dafuer entschieden — „A false warning costs one
restart; a hidden gap cost a day." Ein eigener Act, wenn ueberhaupt.

## 3. Der Rollenvertrag — was drin steht und was ich SELBST nachgeprueft habe

`AGENTS.md`, ein `###`-Unterabschnitt in `## Portable operating contract`, **18 Zeilen /
3 310 Bytes** (Budget war <= 45 / <= 3500). Vier Ebenen x vier Angaben.

Nachgeprueft am Baum, nicht dem Lane-Bericht geglaubt:
1. Alle acht zitierten self-Routen existieren in `server.ts`.
2. `POST /api/self/tasks/:id/release` liegt bei `:17018` — als REGEX. Ein Literal-grep auf
   `"/api/self/tasks` gibt 0 und liest sich wie „gibt es nicht".
3. `delegate_act`: **0** Vorkommen. Der Vertrag fuehrt `Act Lead` deshalb als „not built".
4. Die drei Lane-409 stehen woertlich bei `:16958` (subscribe), `:16995` (reply), `:17010`
   (attention).
5. **Die schaerfste Aussage haelt:** der Supervisor hat KEINEN Owner-Rueckweg — `openAttention`
   gated auf `boundProgramForMain` (`server.ts:5942`), seine Eskalation ist owner-GELESEN, nicht
   owner-gesendet.

## 4. Der Private-repo-e-Cleanup (Owner-Auftrag, fremdes Program)

Program `a6d7f0910ed8def26e8b2924` -> `status: complete`, `completedAt: 2026-08-22 14:02:59`,
ueber `POST /api/programs/:id/complete` (die legale Transition `active -> complete`,
`server.ts:14006`). Kein Zustand von Hand editiert.

**Die Reihenfolge war der Punkt, nicht der Knopf.** Die MAIN in Slot 5 konnte ihren eigenen Record
nicht schliessen und sagte das selbst. Vor dem Freigeben habe ich geprueft, was mit dem Slot
gestorben waere: der GESAMTE Ertrag des Pilots (30 KB) lag nur im Scratchpad unter `/private/tmp`,
nichts davon getrackt. Also erst ernten lassen, dann `POST /api/self/retire` — **die MAIN hat sich
selbst beendet, ich habe sie nicht getoetet.** Sie lieferte mehr als verlangt:
`5d1b385` in `/Users/owner/private-repo-e`, 4 Dateien, 806 Zeilen (Result, Measurements, **Briefs**,
plus D16 im bestehenden `decision-record.md`).

**Merke fuer den naechsten Cleanup:** ein `POST /send` pastet OHNE zu leeren. In Slot 5 stand ein
ungesendeter Rest im Composer, der sonst mit meinem Prompt verschmolzen waere — vorher `C-u`,
Text vorher sichern. Und die Zustellung habe ich an der PANE geprueft, nicht an
`submitted:true` (das ist laut ACP-21 ein Echo des Request-Flags).

## 5. Offene Raender, die ich WEITERTRAGE

1. **Neun Owner-Arbeitsdateien im Wurzelverzeichnis sind weiter ungeschuetzt.** Fuenf tragen echte
   Hostnamen/IP (`BEFEHLE.md` 7 Treffer, `SPIELE-LINKS.md` 10, `STAND.md` 4, `PROMPT-GLM-DOKU.md`
   2, `NAECHSTE-SESSION.md` 1). Das Repo ist PUBLIC; ein `git add -A` publiziert sie. Ich habe nur
   den eindeutigen Fall geschlossen (`.env.bak*`, ein Backup einer bereits ignorierten
   Geheimnisdatei). Die neun sind ein OWNER-Entscheid, kein Defekt — aber sie liegen dort weiter.
2. **`autoReview: summarizer timed out without an answer`, zweimal**, unveraendert seit zwei
   Handoffs (`errors.total 2`). Nicht diagnostiziert, in dieser Session folgenlos.
3. **Der alte Private-repo-e-Worktree `fleet-260817174850-065d`** (`f53f85a`, vom 08-17) steht auf
   Platte. NICHT Slot 8, nicht ACP, nicht angefasst — nur benannt.
4. **`notiz 5ddc8877` (ACP-19)** — Modell/Effort eines LEBENDEN Slots unreparierbar. Unveraendert.
   Slot 1 traegt weiter `model: "fable"`, `effort: null`.
5. **Queue-Zeile `89b48243`** (Welcome-Composer) bleibt OFFEN und unbelegt.
6. **Boot-Reconcile-Defekt `94ab77dd`**, **`~/.codex/config.toml` waechst unbegrenzt
   (`1270b246`)**, **9 stale Program-Bindungen** — alle unveraendert.
7. **`RULE_ANCHORS` deckt weiter nur `pfad §anker` nebeneinander** (Rand aus ACP-20).

## 6. Maschinenzustand bei der Uebergabe

- main **`9bd9071`**, Server auf `83468e0`, `bundleStale false`, `codeBehind true` (siehe §2 —
  harmlos und erklaert). **Kein Deploy geschuldet.**
- `dispatch: false`, 0 queued, 0 sent, keine Suite laeuft.
- **Zehn freie Slots** (2, 4, 5, 7, 9, 11–15) — die GLM-/Fable-Architektursessions sind in dieser
  Session zu Ende gegangen; das Board ist so leer wie lange nicht.
- Program `eeba7c04caae64d79969199b` ist occupant-genau an Slot 3 gebunden; die Nachfolge erbt es.
- Queue-Bewegungen dieser Session: `0ea14929` (ACP-22) neu, dispatcht, `done (landed)` ·
  **`d91153f9` (ACP-23) neu, dispatcht, LAEUFT auf Slot 2** — nicht terminal, deiner.
- **Slot 2 ist belegt** (ACP-23). Preflight `6bd25dc3610f1ed32bf7e9a8` gehoert zu DIESEM
  Handoff-Commit, nicht zu ACP-23 — er ist mit meiner Nachfolge erledigt.
- Provenienz beider Lands ist sichtbar: ACP-22 ueber eine Lane (Land-Note, `lane-outcomes`,
  Post-Land-Audit), die Untracked-Aufloesung ueber `main-direct/preflight` + `/finalize`
  (preflight `dc1719b0ed6faa14966a8af7`, Outcome `landed`, `f51bdb9 -> b425807`).

# HANDOFF — ACP Architecture Controller VIII (Slot 2), 2026-08-22, ctx 22,9 % GEMESSEN

**Der Prompt-Annahmefehler ist keine Vermutung mehr.** ACP-21 hat ihn an einer echten claude-TUI
reproduziert, gelandet (`4974cdc`), gruen auditiert (2810/0, ms 1 304 418). Und der Owner hat
mitten in der Session eine Korrektur fuer den STABILEN Plan gegeben, die ich getragen habe
(`8bc77d8`). Beide Ketten sind zu Ende — nichts liegt halb.

## 0. Die exakte naechste Handlung

**Den gemeinsamen Rollenvertrag als eigenen kleinen Schnitt in `AGENTS.md` bauen.** Das
Plandokument VERLANGT ihn seit `8bc77d8`; geschrieben ist er nicht. Vier Ebenen — Fleet
Controller, Project MAIN, Act Lead/Worker, Supervisor — mit je vier Angaben: Zweck, Autonomie,
Rueckweg, und welche Entscheidungen die Ebene SELBST trifft. Knapp: kein Megahandbuch, aber auch
keine Reduktion auf Funktionsnamen.

**Zwei Dinge, die du vor dem Briefen pruefst, nicht annimmst:** (a) `AGENTS.md` wird von pi UND
codex automatisch geladen — jede Zeile dort kostet in JEDER fremden Lane Fenster; das ist das
Argument fuer „knapp", nicht Geschmack. (b) Das Program fuehrt „kein AGENTS-Umbau in dieser
Gruendungsrunde" als Non-Goal. Die Gruendungsrunde ist mit Welle 1-3 vorbei und die Owner-Anweisung
geht vor — ich habe den Widerspruch BENANNT statt still aufgeloest, und du erbst ihn benannt.

## 1. DIE OWNER-KORREKTUR VOM 2026-08-22 — woertlich inhaltlich, wie verlangt

Sie steht zusaetzlich dauerhaft als `notiz 30592fb1` am Program (mit zwei Kommentaren:
dem gemessenen Befund zu (2) und dem Erfuellungsstand). Hier der Inhalt:

**(1) Rollenverstaendnis ist Kernkontext.** `AGENTS.md` soll einen knappen gemeinsamen
Rollenvertrag ueber die Ebenen Fleet Controller, Project MAIN, Act Lead/Worker und Supervisor
tragen: Zweck, Autonomie, Rueckweg und wer welche Entscheidungen selbst trifft. Der dynamische
Role Bootstrap weist die konkrete Rolle, Authority und Capabilities der Instanz zu;
Projekt-AGENTS/-Quellen liefern Domaenenrealitaet; der Act-Brief liefert den Auftrag. Keine
Rollen-Megahandbuecher, aber auch keine Reduktion auf Funktionsnamen.

**(2) Im Studio-Plan ueberall „schmale Lanes" korrigieren zu „kohaerent begrenzte Lanes".**
Bounded bedeutet Ziel/Authority/Ownership/Proof/Checkpoints begrenzt, NICHT zwingend kurze Dauer
oder kleine Dateiflaeche. Game Development braucht bewusst resident arbeitende System-/Feel-/
Optimization-Spezialisten, wenn mehrere Mess->Aenderung->Tasting-Schleifen, starke Kopplung und
Cache-Wiederverwendung Nutzen bringen. Repairs duerfen zum selben resident Agent zurueck, damit
sein Arbeitsmodell/Cache genutzt wird. Kurze frische Lanes bleiben fuer isolierte Slices und
besonders Blind-Critics sinnvoll. Workerform wird aus Kopplungsradius, erwarteten Iterationen,
Cache-Nutzen, Bedarf an Unabhaengigkeit und Kontextfuellstand entschieden.

**(3) Nach terminalem ACP-21 einen getrackten stabilen Plan-Schnitt erstellen, keine weitere
datierte Stand-heute-Summary:** SYSTEM.md nur fuer dauerhafte Semantik; vorhandenes passendes
Plan-/Studio-Dokument fuer Umsetzungsreihenfolge waehlen oder den kleinsten eindeutig noetigen
Plananker schaffen.

Ausdrueckliche Auflage, die ich eingehalten habe: **ACP-21 / Prompt-Annahme wurde dadurch NICHT
aufgeweitet.** Der Act lief unveraendert mit dem Brief, den er vor der Korrektur bekommen hatte.

### Was von (3) erfuellt ist — und was NICHT

Erfuellt. Traeger ist `docs/agentic-control-plane-program-2026-08-20.md`, ein VORHANDENES
Plandokument (§3 Arbeitsmodell, §4 Agentenformen, §6 Act-Reihenfolge 1-9) — keine neue datierte
Summary, `SYSTEM.md` unberuehrt.

**Die Korrektur (2) traf dort einen echten Widerspruch, keine Wortwahl** — das ist der Satz, den
du kennen musst, bevor du das Dokument liest: §3 fuehrte als Lebensdauer eines Specialists
woertlich „genau ein Act", und ein Bullet nannte Builder/Researcher/Critic „Modi TEMPORAERER
Specialists". Beides schliesst residente Spezialisten und den Repair-Rueckweg strukturell aus.

**GEMESSEN vor dem Schnitt, damit niemand ein Suchen-und-Ersetzen erwartet:**
`rg -n -i 'schmale lane|narrow lane' docs/ SYSTEM.md AGENTS.md` trifft NUR
`docs/attic/agent-os-2026-08-11/agent-os-rules.md:68` (Attic = Historie, kein Anspruch auf den
heutigen Baum). In den fuenf Studio-Dokumenten steht die Lane-FORM-Doktrin ueberhaupt nicht —
weder „schmal" noch „kurz/klein/wegwerf/resident". (2) war also das AUFSCHREIBEN einer bisher
ungeschriebenen Entscheidungsregel, nicht eine Ersetzung.

**NICHT erfuellt:** der Rollenvertrag selbst. `8bc77d8` verlangt ihn in `AGENTS.md` — geschrieben
steht er nicht. Das ist §0.

## 2. Was terminal ist — alles gemessen, nichts geschaetzt

| Act | Land | Land-Gate | Post-Land-Audit | Deploy |
|---|---|---|---|---|
| ACP-21 | `84a0ee9` -> **`4974cdc`** | ok, exit 0, 117 765 ms, wait 0 | **green** 1 304 418 ms, **2810/0**, covers genau diesen Land | nicht geschuldet |
| Plan-Schnitt | `4974cdc` -> **`8bc77d8`** | main-direct, `bun e2e/pins.ts` exit 0 ALL PASS | keiner (kein Lane-Land) | nicht geschuldet |

**Kein Deploy offen, und das ist gemessen, nicht geschlossen:** beide Commits sind reine
`docs/*.md`. Live nach dem Audit: `codeBehind false`, `bundleStale false`. Der Server laeuft
weiter auf `83468e0` — richtig, nicht rueckstaendig.

**Die 2810 sind erneut unveraendert, und das ist wieder das SOLL:** ACP-21 legte eine Datei in
`docs/messungen/` ab und fasste kein `e2e/`-Modul an. Eine bewegte Zahl waere hier das
Verdaechtige. `ms` 1 304 418 liegt im Band echter Laeufe (Vorlauf: 1 303 529) — geprueft an `ms`
und `checks.ran`, nicht am Wort „green".

## 3. Was ACP-21 wirklich gemessen hat (`4974cdc`, eine Datei, 186 Zeilen)

`docs/messungen/acp21-prompt-annahme-2026-08-22.md`. **Reproduziert, mit einer Bedingung:** bei
einem MEHRZEILIGEN Paste, den die CLI zu `[Pasted text #1 +N lines]` einklappt, geht das eine
Enter aus `sendText` intermittierend verloren — Text vollstaendig im Composer, kein Transcript,
zweites Enter schickt sofort ab.

| Zelle | n | Fehlform |
|---|---|---|
| Kontrolle (`send-keys -l` + Enter) | 5 | 0 — die Sonde misst, was sie messen soll |
| Einzeiler, Fleet-Form, 150 ms | 10 | 0 |
| **Mehrzeiler, Fleet-Form, 150 ms** | 7 | **2 (29 %)** |
| Mehrzeiler, 2500 ms | 4 | 0 |

Die Lane sagt beim 0/4 selbst, dass es **kein Beweis** ist (bei p=0,29 waere 0/4 zu 25 % Zufall).
`@/abs/path` (3/3) und fuehrendes `/` (3/3) haben NICHT reproduziert — der dokumentierte
Popup-Ausloeser (`server.ts:7598-7606`) ist damit nicht widerlegt, nur nicht getroffen. Beide
Konfundierer wurden vor ALLEN 40 Sends geprueft: 40/40 sauber, auch in den zwei
Fehlform-Captures. 40 echte Prompts, Budget ausgeschoepft.

**Der belegte Kernsatz:** in genau dieser Fehlform antwortet die Route `{ok:true,
receipt:{submitted:true}}`, waehrend der Prompt im Composer steht. `submitted: submit`
(`server.ts:19534`) echot das Request-Flag (`:19513`) — die Quittung KANN strukturell nichts
anderes sagen. Der Fix-Vorschlag steht als Vorschlag am Ende der Notiz; gebaut wurde nichts.

## 4. Was ich am Bericht der Lane SELBST nachgeprueft habe (nicht geglaubt)

1. **Write-Set exakt:** eine Datei, 186 Zeilen, Baum sauber, keine untracked Datei, kein
   `server.ts`.
2. **`server.ts:19513`** (`const submit = body.submit !== false`) woertlich am Baum bestaetigt.
3. **Ein Verdacht, der sich als FALSCH erwies, und darum hier steht:** die Notiz nennt den
   Probe-Spawn „1:1 nach `agentCmd`", setzt aber `--prompt-suggestions false` — ich hielt das fuer
   eine unbenannte Abweichung. Es steht in `server.ts:175`. Der Spawn ist wirklich 1:1. Geprueft
   statt gemeldet.

## 5. Was ich falsch gemacht habe

- **Ich habe `POST /api/slots/3/land` fuer den Merge gehalten.** Das ist der TEARDOWN nach einem
  Merge (`landLane` -> `removeWorktreeSafe`, `server.ts:4192`/`:4150`); der Merge ist
  `POST /api/slots/:id/merge` (`:18132`, die einzige `mergeJob(`-Aufrufstelle). Der Fehlruf
  verweigerte sauber mit `unpushed commits` — nachgeprueft: main unbewegt, Branch nicht gemerged,
  Lane intakt, **nichts halb passiert**. Fuer die Nachfolgerin: **merge, dann land.**
- **Ich habe fast eine Regelbuch-Korrektur gemeldet, die falsch gewesen waere.** Eine frisch
  dispatchte Pane zeigte `● high · /effort`, und ich hielt den Footer fuer einen Effort-Sensor.
  An drei Panes nachgemessen: das ist die rotierende HINWEIS-Flaeche rechts (dort steht auch
  „✔ Update installed" und „new task? /clear to save 137.5k tokens"). Der Footer traegt Branch,
  `ctx` und Modell — **nie** den Effort. Die Regelbuch-Zeile stimmt, ACP-19 bleibt offen.

## 6. Offene Raender, die ich WEITERTRAGE

1. **15 UNTRACKED Dateien im Haupt-Checkout**, darunter vier Rollen-Analysen
   (`docs/rollen-architektur-glm-2026-08-21.md`, `docs/synthese-rollenarchitektur-2026-08-21.md`,
   `docs/kritik-opus-2026-08-21.md`, `docs/rollen-evidenz-2026-08-21.md`) — **genau der Input fuer
   Owner-Korrektur (1)**, also fuer §0. Uncommittet sind sie fuer jede Lane unsichtbar und
   Kollisions-Zuendstoff (das Regelbuch nennt genau diese Falle). Ich habe sie NICHT gelesen und
   fremde Analyse nicht ungefragt committet. Wer §0 briefet, muss das zuerst aufloesen: lesen und
   committen, oder bewusst danebenlegen — aber nicht ignorieren.
2. **`autoReview: summarizer timed out without an answer`, zweimal**, unveraendert seit dem
   Vorgaenger-Handoff (`errors.total 2`, letzte 12:03:39, keine neue in dieser Session). Nicht
   diagnostiziert.
3. **Queue-Zeile `89b48243`** (Welcome-Composer nach `bootstrap-main`) bleibt OFFEN und ist
   kommentiert: ACP-21 hat sie NICHT nachgestellt (ihr Brief lief durch den echten Fleet-Pfad,
   die Probe nicht). Belegt oder widerlegt ist sie damit nicht.
4. **`notiz 5ddc8877` (ACP-19)** — Modell/Effort eines LEBENDEN Slots unreparierbar, unveraendert.
   Slot 1 traegt weiter `model: "fable"`, `effort: null`.
5. **Der orphane Worktree `fleet-260821211509-0be7`** (Slot 8, fremde auftragsmarkt-Doku-Lane) steht
   unveraendert auf Platte. Nicht meine, nicht ACP.
6. **Boot-Reconcile-Defekt `94ab77dd`**, **`~/.codex/config.toml` waechst unbegrenzt
   (`1270b246`)**, **9 stale Program-Bindungen** — alle unveraendert, alle in dieser Session
   folgenlos.
7. **`RULE_ANCHORS` deckt weiter nur `pfad §anker` nebeneinander** (Rand aus ACP-20).

## 7. Maschinenzustand bei der Uebergabe

- main **`8bc77d8`**, Server auf `83468e0`, `codeBehind false`, `bundleStale false` — kein Deploy.
- **Zwei Provenienz-Formen in dieser Session, beide sichtbar:** ACP-21 ueber eine Lane (Land-Note,
  `lane-outcomes`, Post-Land-Audit). Der Plan-Schnitt als Direkt-Commit — aber **nicht unsichtbar**:
  ueber `POST /api/self/main-direct/preflight` + `/finalize` gefahren
  (preflight `7026a83cb126f190d1efb136`, Outcome `landed`, `4974cdc -> 8bc77d8`, verify
  `bun e2e/pins.ts` ok). Verify auf Prosa-Proportion, KEIN Tier-2 — die Aenderung ist reine Prosa
  in einer `docs/*.md`, dieselbe Klasse, die der Land-Gate als `docs-or-prose` mit
  steps `[install, pins]` fuehrt. Das ist eine bewusste Entscheidung, keine Auslassung.
- `dispatch: false`, 0 queued, 0 sent, keine Suite laeuft. Freie Slots: **3, 11, 15**.
- Program `eeba7c04caae64d79969199b` ist occupant-genau an Slot 2 gebunden; die Nachfolge erbt es.
- Queue-Bewegungen dieser Session: `b9fb044e` (ACP-21) neu und `done (landed)` ·
  `30592fb1` (Owner-Korrektur) neu als `notiz`, OFFEN, zwei Kommentare · `89b48243` kommentiert.

# HANDOFF — ACP Architecture Controller VII (Slot 3), 2026-08-22, ctx 21,9 % GEMESSEN

**Die Huelle wird benutzt.** ACP-16 hatte `POST /api/self/tasks/:id/release` gebaut und niemand
hatte sie je aufgerufen. Diese Session hat die erste echte Benutzung unter Beobachtung gefahren:
released, dispatch eingeschaltet, den Tick starten sehen, gelandet, gruen auditiert, dispatch
wieder aus. Der Weg Program-MAIN -> Queue -> Tick -> Lane -> Land ist damit EINMAL vollstaendig
belegt statt behauptet.

## 0. Die exakte naechste Handlung

**Den gemessenen Prompt-Annahmefehler als schmalen Diagnose-/Canary-Act schneiden**
(Owner-Entscheid 2026-08-22, woertlich): eine Zustellung meldet `submitted:true`, aber es
entsteht KEIN Transcript und KEINE Modellhandlung, bis ein separates Enter nachkommt.

**Ehrlichkeitsvermerk, damit die Nachfolgerin nicht auf einer geliehenen Messung baut: ICH HABE
DIESEN FEHLER NICHT SELBST GEMESSEN.** Er kommt aus der Owner-Vorgabe. In DIESER Session ist er
NICHT aufgetreten — der ACP-20-Dispatch hat den Brief vollstaendig zugestellt und die Lane hat
sofort gearbeitet (Pane um 11:52 gelesen). Das widerlegt ihn nicht, es datiert nur meine
Nicht-Beobachtung: ein Fehler, der nicht jedes Mal feuert, ist genau der, den ein einzelner
gruener Lauf nicht ausschliesst. Erste Pflicht des Acts ist deshalb die REPRODUKTION mit einem
eigenen `check()` auf die Vorbedingung — eine Sonde, die nicht messen konnte, muss als SIE SELBST
scheitern, nie als das, was sie messen sollte.

Ausdruecklich NICHT jetzt: keine breite Kontext-/Nachfolge-Arbeit, und keine Owner-Sichtung fuer
Routinedetails. Schmal schneiden.

## 1. Was terminal ist — alles gemessen, nichts geschaetzt

| Act | Land | Land-Gate | Post-Land-Audit | Deploy |
|---|---|---|---|---|
| ACP-20 | `b4cb2e4` -> **`1552690`** | ok, exit 0, 116 586 ms, wait 0 | **green** 1 303 529 ms, **2810/0** | nicht geschuldet |

**Der Deploy fehlt nicht, er ist nicht faellig:** der Land beruehrte `docs/self-api.md`,
`docs/queue-analyst.md` und `e2e/pins.ts` — kein `server.ts`, keine Client-Quelle. Live gemessen
nach dem Audit: `codeBehind false`, `bundleStale false`. Der Server laeuft weiter auf `83468e0`,
und das ist RICHTIG, nicht rueckstaendig.

**Die 2810 sind absichtlich unveraendert gegenueber ACP-16 — das ist kein „nichts gemessen".**
ACP-20 fuegte eine Regel in `e2e/pins.ts` hinzu, und `fleet-e2e.ts` importiert `./e2e/dirs-pins`,
NICHT `./e2e/pins`. Die Datei ist Stufe 1 der Land-Gate-Kette und kein Modul von
`./e2e-isolated.sh`; die Audit-Zahl DARF sich davon nicht bewegen. Nachgeprueft, nicht angenommen.
Das `ms` (1,30 Mio) liegt im Band echter Laeufe.

## 2. Was ACP-20 wirklich geaendert hat (`1552690`, drei Dateien)

- **`docs/self-api.md` §release** — die Referenz, die es seit `83468e0` nicht gab, obwohl das
  Regelbuch Lanes an diese Datei schickt. Die Lane hat **zehn** Ablehnungen dokumentiert; mein
  Brief hatte acht verlangt. Die zwei zusaetzlichen sind `unknown task` (404) und die
  Lane-409 an der Route selbst.
- **`docs/queue-analyst.md` KORRIGIERT** (nicht ergaenzt): die Aussage „zwei Maschinen-Pfade
  schreiben `status=queued`" war seit `83468e0` falsch, es sind drei. Dazu die zwei neuen
  Env-Knoepfe mit Datei:Zeile.
- **`e2e/pins.ts` — `RULE_ANCHORS`**: jeder von CLAUDE.md zitierte Abschnittsanker der Form
  `pfad §anker` muss in dieser Datei auf eine Ueberschrift aufloesen. `RULE_PATHS` (`:2158`)
  prueft ausschliesslich die EXISTENZ der Datei — genau diese Luecke hatte den fehlenden
  §release-Abschnitt monatelang unsichtbar gemacht, bei durchgehend gruenen Checks.

## 3. Was ich am Bericht der Lane SELBST nachgeprueft habe (nicht geglaubt)

1. **Die Gegenprobe des Pins habe ich eigenhaendig wiederholt.** `## watch` ->
   `## abonnieren` umbenannt: `FAIL … CLAUDE.md:335 docs/self-api.md §watch`, danach
   `git checkout --` (sicher, weil der Baum committet und sauber war), Baum clean, `ALL PASS`.
2. **Die neue Aussage in `docs/queue-analyst.md`, dass NUR die Release-Tuer `releasedBy` stempelt**,
   habe ich am Code geprueft: `releaseTask` (`server.ts:2306`) setzt beide Felder, die zwei
   Requeue-Stellen (`:6517`, `:14660`) setzen `status` nackt und fassen `releasedBy` nie an.
   Die Unterscheidung stand nicht in meinem Brief; sie ist richtig.
3. **Worktree-Isolation:** die Lane hat `rulebook/` im HAUPT-Checkout GELESEN (mein Brief sagte
   ihr, das Verzeichnis existiere in ihrem Baum nicht). Lesen ist zulaessig. Geschrieben hat sie
   dort nichts — nachgeprueft: keine modifizierte getrackte Datei im Haupt-Checkout, und
   `docs/self-api.md`/`docs/queue-analyst.md` trugen dort weiter mtime 2026-08-18.
4. **Write-Set exakt gehalten**, keine untracked Dateien, kein `server.ts`.

## 4. Offene Raender, die ich WEITERTRAGE

1. **DIE REGELBUCH-ZEILE IST NUR HOSTLOKAL UND STEHT IN KEINEM DIFF.** `rulebook/` UND
   `CLAUDE.md` sind beide gitignored (`.gitignore:36`, `:40`). Ich habe
   `rulebook/self-scheduling.md` um den `§release`-Absatz erweitert und neu gerendert
   (`CLAUDE.md` 68 673 B, `RULE_RENDER` byte-for-byte gruen, `RULE_ANCHORS` 35 Anker gruen).
   **Ein `git status` zeigt davon NICHTS.** Wer diese Maschine verliert oder das Repo woanders
   auscheckt, hat den Absatz nicht. Das ist der Grund, warum er hier steht.
2. **`autoReview: summarizer timed out without an answer`, ZWEIMAL** in
   `/api/sessions.errors` (zuletzt 12:03:39, waehrend des Lands). auto-③ feuert auf die
   done-looking Lane und sein Summarizer antwortet nicht. Nicht diagnostiziert, nicht mein
   Land-Defekt — aber zweimal in EINER Server-Laufzeit ist eine Notiz wert.
3. **`d9b9b4c4` ist GEPARKT, nicht erledigt** (Owner-Entscheid 2026-08-22). Ich hatte sie
   unqueued, damit die Beobachtung eine Variable hatte; der Owner hat entschieden, sie NICHT
   wieder freizugeben: ihr eigener Text ist eine RICHTUNG mit offenen Schnittfragen und damit
   kein geeigneter unattended Act. Nicht aus Versehen liegengeblieben.
4. **`RULE_ANCHORS` deckt nur `pfad §anker` nebeneinander.** Freistehende Anker, deren Pfad
   weiter vorn im Absatz steht (`CLAUDE.md:137-143`: `§5b`, `§11.2b`, `§11.2c-bis`), bleiben
   ungeprueft. Von der Lane gemeldet statt gebaut — richtig so, das waere eine andere Sonde.
5. **`notiz 5ddc8877` (ACP-19)** — Modell/Effort eines LEBENDEN Slots bleiben unreparierbar,
   unveraendert offen. Slot 1 traegt weiter `model: "fable"`, `effort: null` im Datensatz.
6. **Der Boot-Reconcile-Defekt `94ab77dd`** und **`~/.codex/config.toml` waechst unbegrenzt**
   (`notiz 1270b246`) — beide unveraendert, beide in dieser Session folgenlos.
7. **Die 9 stale Program-Bindungen** unveraendert; wer neu gebunden wird, ist Owner-Sache.
8. **`dispatch` steht wieder auf `false`**, 0 queued. Der Schalter ist jetzt nicht mehr
   ungetestet — er wurde einmal kontrolliert benutzt und wieder geschlossen.

## 5. Was ich falsch gemacht habe

- **Ich habe `programId` aus `GET /api/sessions` gelesen und daraus geschlossen, der Lane-Slot
  sei nicht gestempelt.** Der Poll projiziert das Feld gar nicht; der persistierte Datensatz war
  die ganze Zeit korrekt (`programId`, `taskId`, `releasedBy` am Slot). Exakt die Klasse, vor der
  das Regelbuch beim Cast auf eine Netz-Antwort warnt — ich habe sie trotzdem einmal gefahren.
  **Fuer die Nachfolgerin: fuer Slot-Felder ist `fleet.json` die Quelle, nicht der Owner-Poll.**
- **Ich habe den Body von `/api/self/watch` geraten** (`{"slot":2}` statt `{"target":2}`) und
  `bad target` kassiert, obwohl `docs/self-api.md` §watch die Form woertlich fuehrt. Kleine
  Ironie mit Lehrwert: das ist genau der Schaden, den ACP-20 fuer die Release-Route behoben hat —
  eine Route ohne Referenzabschnitt wird geraten.
- **Kein Rendern waehrend eines laufenden Gates — diesmal eingehalten.** Ich habe die
  Regelbuch-Zeile bewusst BIS NACH dem Post-Land-Audit zurueckgehalten, weil beide Seiten
  (Fragment ODER `CLAUDE.md`) den byte-for-byte-Pin mitten im Lauf rot gemacht haetten. Der
  Vorgaenger hat genau das zweimal an einem Tag getroffen.

## 6. Maschinenzustand bei der Uebergabe

- Server laeuft auf **`83468e0`**; main steht auf **`1552690`**. Die Differenz ist doc-/pin-only,
  `codeBehind false` — **kein Deploy offen.**
- **DIESER Handoff ist ein DIREKT-Commit aus dem Haupt-Checkout**: keine `fleet/land`-Note, keine
  `lane-outcomes`-Zeile, kein Post-Land-Audit. `./state.sh`s Land-Health-Zahlen zaehlen nur Lanes
  und untertreiben an einem Tag mit Direkt-Commits.
- **`rulebook/` wurde in dieser Session an EINEM Fragment geaendert und ist gitignored** —
  `rulebook/self-scheduling.md`, siehe §4.1. Gerendert, `bun e2e/pins.ts` ALL PASS.
- Queue-Bewegungen dieser Session: `8d55fc10` (ACP-20) neu und `done` · `e952c2b2` (HARNESS-01)
  auf `done` geschlossen, weil von ACP-12 belegt geliefert (`server.ts:475-476`) ·
  `ad2ee96a` (CTX-01) mit einem Kommentar versehen, dass ACP-11 ihre gemessene Praemisse
  ueberholt hat (codex traegt heute einen echten ctx-Reader; Slot 10 misst live) ·
  `d9b9b4c4` unqueued und geparkt (§4.3).
- Lanes auf Platte: nur `fleet-260821211509-0be7` (Slot 8, 2 Commits ahead, sauber, kein
  `programId` — eine FREMDE auftragsmarkt-Doku-Lane, nicht meine und nicht ACP).
- Program `eeba7c04caae64d79969199b` ist occupant-genau an Slot 3 gebunden; freie Slots: 2, 11, 15.
- `dispatch: false`, 0 queued, 0 sent, keine Suite laeuft.

# HANDOFF — ACP Architecture Controller VI (Slot 2), 2026-08-22, ctx 24,1 % GEMESSEN

**Welle 2 ist VOLLSTAENDIG gefahren.** ACP-15 und ACP-16 sind gebrieft, gebaut, gelandet und
auditiert; ACP-15 ist deployt. Damit ist die Kette ACP-13 -> ACP-11 -> ACP-12 -> ACP-15 -> ACP-16
aus der Owner-Reihenfolge zu Ende. Kein Act blieb halb.

## 0. Die exakte naechste Handlung

**Die Huelle ist gebaut, aber NIEMAND BENUTZT SIE.** `POST /api/self/tasks/:id/release` existiert,
ist bewiesen und live — aber `dispatch` steht auf `false`, also startet der Tick nichts, und keine
Program-MAIN hat die Route je aufgerufen. Der naechste Schritt ist **die erste echte Benutzung
unter Beobachtung**, nicht der naechste Bau: eine `pending`-auftrag-Zeile dieses Programs freigeben,
`dispatch` einschalten, zusehen, ob die Zeile durch die Gates laeuft. Das ist der Owner-Entscheid,
den STAND.md §5 seit Tagen offen fuehrt („nicht manuell als Abkuerzung einschalten: ACP-16 baut die
intelligente Project-MAIN-Freigabe" — sie ist jetzt gebaut).

Danach erst: die Studio-Feuerprobe aus STAND.md.

## 1. Was terminal ist — alles gemessen, nichts geschaetzt

| Act | Land | Land-Gate | Post-Land-Audit | Deploy |
|---|---|---|---|---|
| ACP-15 | `a19d831` -> **`4d1b2d3`** | ok, 116 479 ms, wait 0 | **green** 1 308 722 ms, **2800/0** | `53efe62d` ok, hitTarget, 4 783 ms |
| ACP-16 | `4d1b2d3` -> **`83468e0`** | ok, 118 007 ms, wait 0 | **green** 1 287 903 ms, **2810/0** | `50e1ceca` ok, hitTarget, 5 876 ms |

Beide Gruens sind an `ms` UND `checks.ran` geprueft, nicht am Wort „green". Die Check-Zahlen sind
konsistent statt zufaellig: 2794 (Vorgaenger) -> **2800** = die sechs neuen Verhaltens-Sonden von
ACP-15 -> **2810** = die zehn von ACP-16.

Live nach beiden Deploys: `bootHead == head == 83468e0`, `codeBehind false`, `behindCount 0`,
`bundleStale false`. **Beide Acts sind LIVE.**

## 2. Was die zwei Acts wirklich geaendert haben

- **ACP-15 · Deckel korrekt ausdruecken** (3 Commits: `ad69783`, `ed181b4`, `4d1b2d3`).
  Ein ZWEITER Lane-Deckel je Program, `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM`, **ausschliesslich
  verengend** (Owner-Entscheid 2026-08-22). Der Repo-Deckel bleibt byte-gleich und prueft ZUERST;
  die Program-Pruefung haengt an einer truthy `programId` — **kein null-Topf**, sonst deckelten
  unverwandte Zeilen einander. Der `waiting`-Text nennt den Program-TITEL, damit am Board
  unterscheidbar ist, welcher Deckel hielt.
  **Der Preis steht ehrlich im Kommentar: mit dem Default (= `DISPATCH_MAX_LANES`) bindet die neue
  Pruefung NIE.** Sie ist erst scharf, wenn der Owner sie kleiner setzt. Wer das fuer einen Defekt
  haelt, hat den Entscheid nicht gelesen: ein ERSETZENDER Deckel haette 13x2 = 26 Lanes auf 16
  Slots erlaubt.
  Schnitt 2: `STEWARD_MAX_PENDING` sagt jetzt, was er wirklich deckelt (den Review-Puffer fuer
  STEWARD-Ablagen), und ausdruecklich, dass er **nicht** die Autonomie-Grenze des Fleets ist.
  Zahl und Verhalten unveraendert.
- **ACP-16 · Die Huelle** (`83468e0`). `POST /api/self/tasks/:id/release`: eine gebundene
  Program-MAIN schaltet eine `pending`-Zeile IHRES Programs auf `queued`.
  **Die Route DISPATCHT NICHT — darauf ruht der ganze Act.** Starten bleibt beim Tick, also bleiben
  Master-Stop, Quiet Hours, `DISPATCH_MAX_LANES`, der neue Program-Deckel, das Analyse-Gate und die
  Kollisionslesung unveraendert in Kraft. Der Act weitet, WER freigeben darf — nichts daran, was
  unbeaufsichtigt laufen darf.
  **Sie liest ueberhaupt keinen Body** (gepinnt): `programId` kommt aus `boundProgramForMain`,
  `repo` aus dem eigenen Checkout. Provenienz ueber `audit("task_release", …)`, weil `releasedBy`
  bei `:6242` von einem spaeteren attended ▸ start auf `"owner"` ueberstempelt wird — das Feld
  beantwortet die LANE-Frage, nicht die RELEASE-Frage.
  Deckel `PROGRAM_MAX_RELEASED` (5) je Program; das Produkt steht am Kommentar (16x5 = 80 < 200).
  Nicht-Lane-only, Steward darf.

## 3. Was ich am Bericht der Lane SELBST nachgeprueft habe (nicht geglaubt)

Beides war sicherheitsrelevant und beides haelt:

1. **Die bewusste Abweichung von meiner Brief-Regel 7 ist korrekt.** Der Eintritts-Gate benutzt
   `harnessAutomatableFor(h)`, das fuer den Default-Adapter weder `automatable` noch
   `FLEET_HARNESS_AUTOMATION` konsultiert. Das ist **eine Extraktion, kein zweites Praedikat**: auf
   main stand `return HARNESS_AUTOMATION && h.automatable;` bereits bei `server.ts:4776` mit
   derselben Default-Ausnahme darueber, und `dispatchTask:6210` stellt inline dieselben zwei
   Bedingungen. **Die Release-Tuer ist damit nie durchlaessiger als die Dispatch-Tuer.** Ein Gate,
   der verweigert, was der Tick erlaubt, waere der Fehler gewesen.
2. **Der Griff nach `e2e/security.ts` (11 Zeilen, ausserhalb des Write-Sets) war noetig.**
   `PRE_AUTH_ROUTES` ist die reviewte Allowlist; jede `/api/self/*`-Route steht dort. Ohne Eintrag
   haette der Land-Gate GESCHWIEGEN (die Familie laeuft nur in `./e2e-isolated.sh`) und der
   Post-Land-Audit waere ~9 min spaeter rot geworden.

Die Lane hat ausserdem eine Schranke gebaut, die ich **nicht** gebrieft hatte: ein Release reicht
nie ueber Repo-Grenzen (`repoCanon(target) !== mainRepo` -> 409). Verengung, angenommen.

## 4. Offene Raender, die ich WEITERTRAGE

1. **Modell/Effort eines LEBENDEN Slots sind unreparierbar** — als `notiz 5ddc8877` mit
   Entscheidungsraum abgelegt, DREI Varianten, keine von mir entschieden. Gemessen: Slot 1 traegt
   `model: "fable"`, `effort: null` im Datensatz, seine Pane meldet `Opus 5 (1M context)` und hat
   auf Zuruf `/effort high` gesetzt. **Ein Pane-Heal respawnt die stehende Supervisor-Rolle als
   `fable`, und jede Nachfolge erbt den falschen Wert** (`succeedSupervisor:13152` reicht beides
   woertlich durch, `restart` liest keinen Body, `handleSelfSucceed:5222` nimmt nur `label`/`carry`).
2. **Es gibt fuer den Effort ueberhaupt keinen Sensor** (von der Supervisor-Insassin gemessen und
   gemeldet, nicht von mir): der Footer nennt Branch, ctx und Modell, aber NICHT den Effort. Der
   einzige sichtbare Beleg ist die Bestaetigungszeile des Befehls, und die scrollt weg. Steht als
   zweiter Befund in derselben notiz.
3. **Ein wiederholtes Release antwortet 409 mit dem Status statt idempotent `ok:true`** wie
   `openAttention`. Das war meine Brief-Regel 4 woertlich; die Aenderung waere eine Zeile.
   Owner-Geschmack, nicht Defekt.
4. **`docs/self-api.md` hat kein §release** — unvollstaendig, nicht falsch. Ebenso
   `docs/queue-analyst.md:263` (zaehlt die Dispatch-Env-Variablen auf, kennt den neuen Knopf nicht).
5. **Der Boot-Reconcile-Defekt `94ab77dd`** steht unveraendert offen. In dieser Session erneut
   folgenlos: meine LEBENDEN Watches haben den srv-Neustart ueberlebt, der Filter trifft sie
   korrekt nicht.
6. **`~/.codex/config.toml` waechst unbegrenzt** (`notiz 1270b246`), unveraendert. SHARED REALITY
   ausserhalb des Repos — nicht angefasst.
7. **Die 9 stale Program-Bindungen** sind seit ACP-13 reparierbar, aber nicht repariert. WER neu
   gebunden wird, ist Owner-Entscheidung.
8. **`dispatch: false`.** Siehe §0 — das ist jetzt der interessante Knopf, nicht mehr ein Detail.

## 5. Was ich falsch gemacht habe

- **Mein ACP-15-Brief liess die Lane `docs/kritik-opus-2026-08-21.md` im Code zitieren — die Datei
  ist UNTRACKED.** In einem public Repo waere das ein toter Verweis gewesen. Die Lane hat es
  gemeldet; der Nachschnitt `4d1b2d3` ersetzt das Zitat durch das ARGUMENT und hat gleich **jeden
  Pfadnamen beider Commits gegen `git ls-files` geprueft**. Lehre fuer den naechsten Brief: ein
  zitierter Pfad muss IM REPO aufloesen, sonst ist er kein Beleg.
- **Ich habe ZWEIMAL im Haupt-Checkout das Regelbuch gerendert, waehrend eine Suite lief.** Beim
  ersten Mal (08:33:38) hat das der ACP-15-Lane einen transienten roten Pin beschert
  (`CLAUDE.md is renderRulebook(...) byte for byte`, 66990 vs 66142 B); ihre Diagnose war richtig
  und ihre zwei Folgelaeufe gruen. Beim zweiten Mal lief das ACP-16-Land-Gate — diesmal folgenlos.
  **Das war Glueck, nicht Koennen.** Regel fuer die Nachfolgerin: `rulebook/`-Aenderungen und
  Render NIE waehrend eines laufenden Land-Gates oder Audits.

## 6. Maschinenzustand bei der Uebergabe

- Server laeuft auf **`83468e0`** — dem gelandeten, gruen auditierten und deployten SHA.
- **DIESER Handoff ist ein DIREKT-Commit aus dem Haupt-Checkout** und damit fuer jedes land-seitige
  Ledger unsichtbar: keine `fleet/land`-Note, keine `lane-outcomes`-Zeile, kein Post-Land-Audit.
  `./state.sh`s Land-Health-Zahlen zaehlen nur Lanes und untertreiben an einem Tag mit
  Direkt-Commits.
- **`rulebook/` wurde in dieser Session an ZWEI Fragmenten geaendert und ist gitignored** — es taucht
  in keinem Diff auf: `rulebook/supervisor.md` (Supervisor-Absatz nach ACP-12, plus die
  Footer-taugt-nicht-als-Effort-Sensor-Korrektur) und `rulebook/self-scheduling.md`
  („Nicht-Lane-only sind VIER Routen", `/api/self/tasks/:id/release` aufgenommen). Beide gerendert,
  `bun e2e/pins.ts` ALL PASS.
- Neue Queue-Zeilen dieser Session: `855e2735` (ACP-15), `96358ec5` (ACP-16), `5ddc8877` (notiz,
  Modell/Effort eines lebenden Slots).
- Program `eeba7c04caae64d79969199b` ist occupant-genau an Slot 2 gebunden.

# HANDOFF — ACP Architecture Controller V (Slot 3), 2026-08-21/22, ctx 25,8 % GEMESSEN

**Welle 2 ist zu drei Vierteln gefahren.** Diese Session hat ACP-13, ACP-11 und ACP-12
gebrieft, gefahren, gelandet, auditiert und deployt. Kein Act blieb halb. **ACP-15 und ACP-16
sind UNBERUEHRT** — bewusst nicht angefangen, weil sie in mein 25/30-Band gefallen waeren.

## 0. Die exakte naechste Handlung

**ACP-15 (Deckel korrekt ausdruecken)**, danach **ACP-16 (Die Huelle)**. Owner-Reihenfolge,
unveraendert. Beide auf `server.ts`, seriell. **GLM F5** (zwei Ablagepfade mit entgegengesetzter
Repo-Semantik) reitet laut Vorgaenger-Befund MIT ACP-16, nicht davor — dieselbe Naht.
**GLM F1/F2/F3 bleiben Vorschlaege** ohne Owner-Promotion.

Zwei kleine Posten, die an ACP-12 haengen und JETZT faellig sind (siehe §3).

## 1. Was terminal ist — alles gemessen, nichts geschaetzt

| Act | Land | Land-Gate | Post-Land-Audit | Deploy |
|---|---|---|---|---|
| ACP-13 | `92bce16` → **`f123312`** | ok, exit 0, 113 973 ms, wait 0 | **green** 1 296 538 ms, 2784/0 | `aa190693` ok, hitTarget |
| ACP-11 | `f123312` → **`ec7cfc1`** | ok, exit 0, 123 955 ms, wait 0 | **green** 1 283 291 ms, 2792/0 | `eee8e64b` ok, hitTarget |
| ACP-12 | `ec7cfc1` → **`b250d49`** | ok, exit 0, 116 348 ms, wait 0 | **green** 1 390 809 ms, 2794/0 | `a9d46ea0` ok, hitTarget |

Jedes Audit-Gruen ist an `ms` UND `checks.ran` geprueft, nicht am Wort „green". Die 2792 gegen
2784 sind exakt die acht neuen Sonden von ACP-11 — die Zahl ist konsistent, nicht zufaellig.

## 2. Was die drei Acts wirklich geaendert haben

- **ACP-13** — eine STALE Program-MAIN-Bindung ist ueberschreibbar, eine LIVE nie; die Antwort
  nennt die ersetzte Bindung, Trail-Zeile `program_main_rebound` NACH der echten Neubindung.
  `boundProgramForMain` nutzt `filter`, `>1` bekommt eine eigene 409-Meldung, `sessionId` wird als
  `sessionIdMatch` BERICHTET statt gegatet. `GET /api/programs` traegt `occupancy` aus EINEM
  Helfer, den auch die Supervisor-Sicht benutzt.
  **`staleSince` wurde bewusst NICHT gebaut** (meine Entscheidung, Abweichung vom
  Vorgaenger-Handoff): nichts Persistiertes haelt fest, WANN eine Besetzung starb; ein erfundener
  Zeitstempel laese sich hinterher wie eine Messung. Braucht ein persistiertes Ereignis.
- **ACP-11** — Codex traegt einen echten ctx-Reader. Zaehler und Nenner aus DERSELBEN Zeile des
  Rollout-Tails; Reader-Vertrag um ein optionales `windowFromFile` erweitert, fuer den der
  Modell-Nenner nie befragt wird. Andere Adapter byte-gleich. Aufloesungskosten gemessen:
  169 Rollouts / 16 Datumsverzeichnisse = 0,45 ms, danach je Besetzung gecacht.
- **ACP-12** — der Effort-Knopf ist nativ. `slotCmd`/`agentCmd` nehmen `effort` und haengen
  ` --effort '<level>'` an, **nur auf dem claude-Zweig**; `CLAUDE_HARNESS` traegt die fuenf Stufen
  und `supports.effort: true`; der falsche Kommentar ist ersetzt und nennt die Quelle. Der
  Container-Adapter uebergibt explizit `null` — der Drop ist sichtbar, nicht implizit, und seine
  `effortLevels` bleiben `[]` **weil ungemessen** (kein Docker-Daemon erreichbar; keine colima-VM
  gestartet — geteilte Realitaet ausserhalb des Repos). Drei neue Source-Pins: die Shell-Form der
  Flagge, die Geschlossenheit jeder `effortLevels`-Liste (das Argument, auf dem die Quotierung
  ruht) und die Paarform `effortLevels` ↔ `supports.effort` in BEIDEN Richtungen.
  **Zwei aeltere Falschaussagen mitkorrigiert:** der Interface-Kommentar `:264` („every adapter but
  Pi ignores effort" — codex tat es schon vorher) und eine `e2e/security.ts`-§6-Zeile, die ab
  diesem Schnitt im TEST falsch gewesen waere.
  **Eine Schranke wurde bewusst gelockert und begruendet:** die Vakuitaets-Grenze des
  Container-Literal-Pins von 8 000 auf 12 000 B. Sie ist ein VAKUITAETS-Waechter (ein nicht
  gefundener Terminator darf die Slice nicht ueber die naechsten Deklarationen laufen lassen),
  keine Groessenpolitik; die Prosa zu kuerzen haette geheissen, das Bewachte zu editieren, um den
  Waechter zufriedenzustellen. Der Grund steht in der Datei. Ich habe den Diff selbst gelesen.

## 3. Was an ACP-12 haengt und JETZT dran ist

1. **Die Supervisor-Nachfolge auf `claude-sonnet-5[1m]` + `high`.** Das ist ein
   CONTROLLER-Akt, keine Lane-Arbeit, und er war absichtlich nicht im Lane-Brief.
   **Kenne die Falle, bevor du sie ausuebst:** `succeedSupervisor` reicht `s.model`/`s.effort` des
   Vorgaengers WOERTLICH durch, `POST /api/self/succeed` nimmt keinen Override, und **es gibt
   keine Route, die Modell oder Effort eines LEBENDEN Slots aendert.** Ein `/model` + `/effort` in
   der Pane wirkt sofort, aktualisiert den Slot-Datensatz aber NICHT — jede Nachfolge faellt still
   auf den alten Wert zurueck. Also: in der Pane nachziehen UND am Footer verifizieren.
2. **Der Regelbuch-Absatz zum Supervisor-Effort** (Rest von ACP-17). `CLAUDE.md` ist ein GENERAT:
   der Schnitt gehoert ins `rulebook.ts`-Fragment, **nie** in die gerenderte Datei.

## 4. Offene Raender, die ich WEITERTRAGE — keiner ist ein Fehler dieser Acts

1. **`attentionBound` / `reconcileAttention` gaten weiter auf `sessionId`.** Nach ACP-13 darf eine
   im selben Pane neu geminzte Session wieder Attention STELLEN, erbt ihre alten offenen Zeilen
   aber nicht (sie werden als „requester session ended" refused). Dort ausdruecklich als Fail-Safe
   kommentiert. War nicht im Auftrag — eine Naht, die ein spaeterer Act entscheiden muss.
2. **Der Boot-Reconcile-Defekt `94ab77dd` steht unveraendert offen.** Eine ENTWAFFNETE Watch
   verliert beim naechsten Deploy den Grund, warum nie etwas kam. In dieser Session zweimal
   beobachtet und beide Male folgenlos, weil ich die Ergebnisse schon hatte. Meine LEBENDEN
   Watches haben jeden der drei srv-Neustarts ueberlebt — der Filter trifft sie korrekt nicht.
3. **`~/.codex/config.toml` waechst unbegrenzt** — als `notiz 1270b246` mit Entscheidungsraum
   abgelegt. Gemessen: 7810 Zeilen, 2602 Strophen, **2580 tote Pfade (99,2 %)**. Jeder
   `./e2e-isolated.sh`-Lauf laesst mindestens eine zurueck. SHARED REALITY ausserhalb des Repos —
   NICHT angefasst, und die naechste Session fasst es auch nicht ohne Owner-Entscheid an.
4. **Die 9 stale Program-Bindungen sind jetzt REPARIERBAR, aber nicht repariert.** ACP-13 macht
   Reparatur moeglich; WER neu gebunden wird, ist eine Owner-Entscheidung. Bewusst keine Daten
   angefasst.

## 5. Was ich falsch gemacht habe

- **Ich habe `POST /api/slots/2/land` fuer den Merge gehalten.** Das ist die TEARDOWN-Route
  (`landLane:4109`) — sie setzt voraus, dass der Merge schon lief, und raeumt nur den Worktree ab.
  Sie hat fail-closed mit `unpushed commits` abgelehnt, main hat sich nicht bewegt, nichts ging
  verloren. Der richtige Weg ist `POST /api/slots/:id/merge` (die einzige `mergeJob(`-Aufrufstelle)
  und danach sofort `{kind:"merge"}` abonnieren. Kostete Zeit, keine Arbeit.
- **Eine Bindungs-Messung ueber `GET /api/sessions` war ein Artefakt.** Der Owner-Poll fuehrt
  **kein `sessionId`** — meine erste Zaehlung meldete darum „alle 13 sessionId-abweichend". Die
  echte Quelle ist `fleet.json` (der Zustand, den der Server geladen hat); dort: **0 Abweichungen
  unter den lebenden Bindungen**. Genau die Cast-auf-eine-Netzantwort-Klasse, vor der
  `docs/verify-tiering.md` §12 warnt. Innerhalb derselben Runde korrigiert.

## 6. Maschinenzustand bei der Uebergabe

- Server laeuft auf **`b250d49`** — dem gelandeten, auditierten und deployten SHA.
  `bundleStale:false`, `deployGap.behindCount 0`, `codeBehind false`. Alle drei Acts sind LIVE.
- **DIESER Handoff ist ein DIREKT-Commit aus dem Haupt-Checkout** und damit fuer jedes
  land-seitige Ledger unsichtbar: keine `fleet/land`-Note, keine `lane-outcomes`-Zeile, kein
  Post-Land-Audit. Reine `HANDOFF.md`. `deployGap.codeBehind` liest sich danach `true` bei
  `behindCount 1` — das ist KEIN Server-Code-Unterschied und braucht keinen Deploy.
  `./state.sh`s Land-Health-Zahlen zaehlen nur Lanes und untertreiben an einem Tag mit
  Direkt-Commits.
- `dispatch: false` — kein Tick startet etwas. Die Queue traegt weiter mindestens eine `queued`
  Zeile, die niemand startet (GLM F2 beschreibt genau das).
- Drei neue Queue-Zeilen dieser Session: `dfd0ac58` (ACP-13, done), `854d9184` (ACP-11, done),
  `0f4b92fc` (ACP-12) und die `notiz 1270b246`.
- Ich habe einen fertig gelandeten Orphan-Worktree entfernt (`fleet-260821172044-475f`, 0 ahead /
  5 behind, sauber). Branch bleibt.
- **Slot 8 haelt eine FREMDE, lebende claude-fleet-Lane** (`⎇ claude-fleet 0be7`,
  `fleet/260821211509-0be7`, 1 ahead / 3 behind). **Nicht meine** — sie erschien waehrend meiner
  Arbeit. Rein docs (`docs/auftragsmarkt-integration-2026-08-21.md`), also KEINE Kollision mit
  `server.ts` und damit keine mit ACP-15/ACP-16. **Nicht als Orphan behandeln und nicht
  entfernen** — sie gehoert einer anderen Session.
- Maschinen-Hygiene aus `./state.sh` NICHT angefasst (geleakte e2e-Sockets, TMPDIR-Scratch) —
  waehrend Lanes Suiten fahren ist das Reapen riskanter als der Gewinn.

# HANDOFF — ACP Architecture Controller IV (Slot 2), 2026-08-21, ctx 25,3 % GEMESSEN

**Der rote Integrationszustand ist GESCHLOSSEN, main ist deployed, der Tip ist gruen.** Diese
Session hat ACP-18 geschnitten, diagnostiziert, repariert, gelandet, auditiert und deployt. Es
wurde KEIN Architektur-Act begonnen. Welle 2 ist unberuehrt.

## 0. Die exakte naechste Handlung

**ACP-13 (Bindungs-Reparatur)** — Vorbedingung von allem, auch des Supervisor-Rails. Danach
seriell **ACP-11 → ACP-12 → ACP-15 → ACP-16** (alle auf `server.ts`). Owner-Reihenfolge,
unveraendert. **GLM F2 wird NUR nach ausdruecklicher Owner-Promotion in ACP-16 gefaltet**;
F3 und F1 bleiben Vorschlaege. Das Aufraeumen der 15 untracked Dateien ist ein EIGENER Act
nach dem Gruen, unter der bestehenden public/private-Entscheidung — nicht nebenbei.

## 1. Terminale Fakten dieser Session (alle gemessen, keine geschaetzt)

| Fakt | Wert | Beleg |
|---|---|---|
| Land | `mainBefore 67418a8` → **`mainAfter aedc24d`** | `git notes --ref=fleet/land show aedc24d` |
| Land-Gate | `verify.ok true`, exit 0, **119 793 ms**, `waitMs 0` | dasselbe Note |
| Post-Land-Audit | **green**, `ms 1 265 185`, `checks {ran: 2774, failed: 0}`, `covers [aedc24d]` | `post-land-audits.jsonl`, letzte Zeile |
| Deploy | id **`9279b26b`**, `ok true`, `hitTarget true`, `ms 2002` | `GET /api/deploys`, erste Zeile |
| Live danach | `bootHead == head == aedc24d`, `codeBehind false`, `behindCount 0`, `bundleStale false` | `GET /api/sessions` |

**Die vier Commits auf main:** `e4dd0da` Diagnose · **`8ad4192` der Fix** · `942f955` Notiz traegt
den Schnitt · `aedc24d` Checkzahl richtiggestellt.

## 2. Was ACP-18 wirklich war — und was die Diagnose des Vorgaengers wert war

**Das Rot war ein SONDEN-RENNEN, kein Produktfehler.** `openSlot` veroeffentlicht `s.cwd`
(`server.ts:4459`) und `s.label` (`:4468`) und legt die tmux-Pane erst in `await ensureSlot(s)`
(`:4531` → `:4340`) an. `waitForLabel` pollte auf Label+cwd und lieferte einen Slot, dessen Pane
noch nicht existierte; `respawnScreen` antwortete `can't find pane: sN`, **und sein Exit-Code
verfiel an allen acht Aufrufstellen still** — der Codex-Banner wurde nie gemalt, `bootstrap-main`
starb in der Readiness-Warte mit HTTP 500 `pane never showed its ready marker within 3s`
(6 von 6 nachgestellt, 7436–7490 ms; die rote Trail-Zeile trug `msSincePrev 7535`).

**Der Fix `8ad4192`** (`e2e/programs.ts` + `e2e/tasks.ts`, `server.ts` UNBERUEHRT): `waitForLabel`
gibt einen Slot nur zurueck, wenn `tmux has-session -t sN` gleichzeitig 0 liefert; `respawnScreen`
wiederholt bounded und meldet nach Ablauf **einen eigenen `check()` mit dem Exit-Code**. Die Sonde
scheitert endlich als SIE SELBST, und „nie ein Slot mit dem Label" ist von „Slot da, Pane nie
gewachsen" getrennt. Dieselbe Fehlerform in `e2e/tasks.ts` (`screenLane`).

**MECHANISCH WIDERLEGT und nicht wieder aufzumachen:** der Kandidatenraum aus dem
Vorgaenger-Handoff (die zwei Doc-Commits `2c1cf59`/`2629dcf`). `e2e-isolated.sh:59-70` +
`e2e-stage.sh` bestimmen abschliessend, was in eine Suite-Instanz kommt — namentlich nur
`AGENTS.md`, `HANDOFF.md`, `docs/verify-tiering.md`, `docs/land-mechanics.md`,
`docs/plan-queue-refinement-2026-08-11.md`, `docs/container.md` plus Import-Huelle, `public/`,
`package.json`. Keine der beiden geaenderten Dateien ist darunter. **Die Ursache war aelter als
`9cdb77a`**: beide Helfer stammen unveraendert aus `971c8da` (2026-08-14), fuenf Tage vor dem
Check-Block `870593a`. Der gruene Lane-Vorschaulauf war der Ausreisser, nicht die roten Laeufe.

**Die „neun fehlenden Checks" waren MEINE Fehldeutung, aufgeklaert:** rot und gruen haben beide
2774 Trail-Zeilen und 2768 distinct Namen, `Namen nur/anders` = 0 auf beiden Seiten. Nichts
uebersprungen. Die 2765 war die Trail-Selbstpruefung, die acht Zeilen vor Schluss zaehlt; die zwei
neuen `check()` feuern nur im Fehlerfall.

## 3. Zwei offene Raender — benannt, NICHT untersucht

1. **Die Phasenerklaerung bleibt GEFOLGERT.** Warum die fleet-control-Gruendung ihr Label 30–50 ms
   frueher veroeffentlicht als eine target-repo-Gruendung, ist aus dem Code gelesen (ein
   zusaetzlicher `git cat-file` im target-repo-Zweig, `server.ts:12888`), nicht gemessen. Der
   gruene Lauf kann das weder stuetzen noch widerlegen — der Fix ENTFERNT die Abhaengigkeit von
   der Phase, statt sie zu verschieben. Kein offener Schaden, nur eine offene Erklaerung.
2. **~62 Minuten ohne Ausgabe im Beweislauf**, unerklaert: zwischen Suite-Lock (17:47Z) und dem
   Anlegen des Instanzverzeichnisses (18:49:15Z, `stat -f %SB`) liegt eine Luecke; kein zweiter
   Lauf im Trail-Verzeichnis in diesem Fenster, kein Sleep-Eintrag in `pmset -g log`. Einziger
   Code dazwischen ist `_stage_closure` in `e2e-stage.sh`. Danach lief die Suite in normaler Zeit.
   In `docs/messungen/acp18-fleet-frame-rot-2026-08-21.md` vermerkt. **Wenn ein Land je wieder
   unerklaerlich lange braucht, ist das die erste Spur** — sonst nicht verfolgen.

## 4. Der GLM-Kritikerlauf (Slot 7) — geerntet, NICHT promotet

Fuenf Feststellungen mit CUT LINE, `REPORT_READY` gedruckt. Roh erhalten ausserhalb des
oeffentlichen Baums: `~/claude-fleet-private/harvest/glm-gap-critic-2026-08-21.txt` (884 Zeilen).
**Ich habe die vier tragenden Zitate am Code gegengeprueft, alle halten woertlich:**
- **F1** kein Ergebnis-Rueckweg fuer Nicht-MAIN-Specialists — `openAttention:5742-5744` 409t
  alles ohne `boundProgramForMain`. Loch echt. **Aber die Kostenrechnung ist ueberzogen** und das
  ist meine Gegenmessung: ich habe in dieser Session ZWEI Specialist-Berichte geerntet (Slot 4,
  Slot 7), je ein `capture-pane` in eine Datei, je unter zwei Minuten — nicht „30–60 min". Und
  `capture-pane` leakt keine Tokens; die Leak-Klasse haengt an `ps`, nicht am Ernten.
- **F2** `GET /api/self` traegt kein `dispatch`-Feld (`:16412-16427`), Tick-Waechter `:6928`.
  **Staerker als GLM wusste:** ich habe gemessen — `fleet.json` fuehrt `"dispatch": false`, und es
  liegt bereits **1 queued row** da (1 queued / 72 pending), die kein Tick je startet. Das
  Szenario ist der stehende Zustand, nicht eine Prognose. Ein Feld, eine Zeile.
- **F3** `rulebookDrifted` liegt hinter dem Lane-409 (`:16720`, Berechnung erst `:16731`) — genau
  die 25/30-Nachfolger sind vom Drift-Sensor ausgeschlossen. Eine Ungenauigkeit GLMs: den
  25/30-Wechsel traegt KEIN Commit (`CLAUDE.md` ist gitignored, im Haupt-Checkout gerendert) —
  das macht den Befund eher schlimmer.
- **F5 (subtraktiv)** zwei Ablagepfade mit entgegengesetzter Repo-Semantik, `:16245`
  `repo: null, // never body.repo`. Sauber belegt; sollte MIT ACP-16 reiten, nicht davor, weil es
  dieselbe Naht anfasst.
- **F4** unter der Schnittlinie: Ersparnis INFERRED, Gegenmittel ein Pack, dessen Wirkung niemand
  misst. GLM sagt das selbst.

## 5. Maschinenzustand bei der Uebergabe

- Server laeuft auf **`aedc24d`** (dem auditierten und deployten SHA), Bundle frisch.
  `main` steht eine Stufe hoeher auf **`c955dc7`** — DIESER Handoff, ein DIREKT-Commit aus dem
  Haupt-Checkout, reines `HANDOFF.md`. Er ist fuer jedes land-seitige Ledger unsichtbar (keine
  `fleet/land`-Note, keine `lane-outcomes`-Zeile, kein Post-Land-Audit). Von Hand verifiziert:
  `bun e2e/pins.ts` ALL PASS. `deployGap.codeBehind` liest sich deshalb `true` bei
  `behindCount 1` — es ist KEIN Server-Code-Unterschied und braucht keinen Deploy.
- **`undo-land` bezeichnet dieses Land** (`67418a8` → `aedc24d`). Nicht ausgeuebt, kein Grund.
- Slot 3 haelt den fertigen ACP-18-Worktree (gelandet, sauber). Slot 7 haelt den GLM-Kritiker
  (fertig, `REPORT_READY`, geerntet). Beide koennen abgeraeumt werden.
- 15 untracked Dateien im Haupt-Checkout, davon die fuenf nichtnormativen Architektur-Papiere.
  **Eigener Act nach dem Gruen** — nicht nebenbei aufraeumen.
- Queue: 73 offen (63 auftrag / 10 notiz), `dispatch: false`, 1 queued row wartet auf einen Tick,
  der nicht laeuft (siehe F2).
# HANDOFF — ACP Architecture Controller III (Slot 3), 2026-08-21, ctx 27,8 % GEMESSEN

**Uebergabe auf Owner-Anweisung im 25/30-Band.** Diese Session hat Welle 1 geschnitten und
gefahren: ACP-10 gebaut+gelandet, ACP-17 ausgefuehrt, ACP-14 vermessen und vorgelegt. **Der
Integrations-Tip ist ROT und die Ursache ist NICHT gefunden — aber sie ist EINGEGRENZT und
ACP-10 ist mechanisch entlastet.** Kein Deploy. Kein Undo. Kein Welle-2-Start.

## 0. Die exakte naechste Handlung

**A. Den roten Integrationszustand schliessen** — hoechstens EINE eng gebriefte Diagnose-/
Repair-Lane, KEINE Suite-Kaskade (Owner-Vorgabe). Alles, was ich dazu weiss, steht in §2; der
Kandidatenraum ist bereits auf drei Doc-Commits eingeengt und die zwei teuren Ausschluesse sind
BEZAHLT — nicht neu messen.
**B. Erst bei gruenem oder erklaertem Tip ACP-13** (Binding-Reparatur), danach **ACP-11 →
ACP-12 → ACP-15 seriell** (alle auf `server.ts`).
**C. ACP-16 / REPORT_READY erst NACH ACP-13.**

## 1. Was gelandet und was gemessen ist

| Act | Stand | Beleg |
|---|---|---|
| **ACP-10** ctx-Nenner der Bruecke | **gelandet** `850d27b`, Gate gruen (exit 0, 98,8 s, waitMs 0) | `git notes --ref=fleet/land show 850d27b` |
| **ACP-17** Regelbuch | **fertig**, `2c1cf59` + `2629dcf`, `bun e2e/pins.ts` ALL PASS | unten §4 |
| **ACP-14** Ambient-Steuer | **vermessen**, Diff liegt beim Owner | `docs/acts-welle-1-2026-08-21.md` §3 |

ACP-10 waehlte Option (1) (benannte Zeile) und belegte sie STAERKER als gebrieft: nicht mit dem
pi-Footer (Selbstauskunft), sondern mit der Ursache im Paket — `pi-claude-bridge` 0.6.3,
`src/models.ts:43-44`, `resolveClaudeCodeRuntimeModel` schreibt `claude-opus-5` bedingungslos auf
`claude-opus-5[1m]` mit `ONE_M_CONTEXT` um; der Zweig liest keine Plan-Einstellung. **Von mir
unabhaengig nachgelesen**, ebenso die drei Nebenaussagen (Geschwister `:49-51`/`:62-65` sind
plan-abhaengig, Bridge-`haiku-4-5` ist 200k `:66-67`, Version `package.json:3`). Die Lane hielt ihr
Write-Set exakt und entfernte eine vierte Pin-Zeile selbst, weil sie `MODEL_RE` von Hand kopiert
haette — richtige Entscheidung, begruendet.

## 2. DER ROTE TIP — was bewiesen ist und was nicht

**Rote Audit-Row:** `post-land-audits.jsonl`, letzte Zeile. `result: red`, `mainSha 850d27b…`,
`ms 1041448`, `checks {ran: 2774, failed: 4}`, `covers: [fleet/260821141046-f182]`.

**Die vier Fehlschlaege sind EINE Wurzel, nicht vier Schaeden** — der Fleet-frame-Bootstrap
liefert keinen Prompt. Signatur, in allen drei Laeufen identisch:

```
FAIL  Program-MAIN Fleet frame: founding prompt keeps exactly the four existing grounding steps in order
FAIL  Program-MAIN Fleet frame: binding, bytes, git facts, six-way plan, anchors, and the receipt hash stay equivalent  (null)
FAIL  Program-MAIN Fleet frame: a manifest tracked in the Fleet checkout IS read, delivered, and receipted beside the seeds  (0 null)
FAIL  Program-MAIN Fleet succession: the byte-stable grounding and carry frame remains Fleet-control  (401 )
```

Leerer Prompt · `receipt: null` · beim Nachfolge-Check ein blankes `401` (leeres Self-Token, weil
es nie einen Slot gab). Quelle: `e2e/programs.ts:587-645`.

**DREI LAEUFE, ZWEI BAEUME — das ist der Kern der Uebergabe:**

| Lauf | Baum | Ergebnis | Log |
|---|---|---|---|
| Post-Land-Audit 16:19 | `850d27b` | rot, 4/2774 | `post-land-audits.jsonl` (letzte Zeile, Feld `out` ist elidiert — nimm den Trail) |
| meiner, seriell 16:40 | `850d27b` | **identisch rot** | `<scratch>/proof-850d27b.log` |
| meiner, seriell | **`2629dcf`** (Elternbaum, ACP-10 DRAUSSEN) | **identisch rot** | `<scratch>/proof-2629dcf.log` |

`<scratch>` = `/private/tmp/claude-501/-Users-owner-claude-fleet/8aaef263-f887-4bab-8753-bc6273b404ff/scratchpad`.
Die Logs liegen im Session-Scratchpad und sterben mit ihm — die Signatur oben ist deshalb HIER
ausgeschrieben. Der Per-Check-Trail ueberlebt laenger:
`$TMPDIR/fleet-e2e-trail/isolated-20260821T161952Z-31042.jsonl` (Audit) und
`…T164024Z-115.jsonl` (mein Wiederholungslauf), `ok:false` filtern.

**Owner-Entscheid mechanisch angewandt: Elternbaum rot mit denselben vier Fehlern ⇒ ACP-10 ist
ENTLASTET. Kein Undo. Der rote Tip bleibt als ehrlicher Fakt stehen. Kein Deploy.**

**BEZAHLT UND AUSGESCHLOSSEN — nicht neu messen:**
- **Kein Flake.** 3 Laeufe, dieselben 4 Checks, dieselben Details. Die Familie war davor 34/35
  gruen; ich habe zuerst auf Flake getippt, und das war falsch.
- **Kein Timeout/Last.** Der Audit war mit 1041 s langsam (Ledger-p50 700 s, Rang 194/212), aber
  mein serieller Wiederholungslauf faellt identisch. Die Langsamkeit war Nebengeraeusch.
- **Nicht ACP-17.** `e2e-stage.sh` kopiert `rulebook/` **ueberhaupt nicht** in die Suite-Instanz —
  meine Fragment-Edits sind fuer diesen Lauf strukturell unsichtbar.
- **Nicht die Grounding-Steps aus dem Regelbuch.** Die sind hartcodierte Literale,
  `server.ts:12985` und `:13014`.
- **Nicht EISDIR.** `e2e/errors.ts:9-11` ersetzt `streams/sN.history.json` ABSICHTLICH durch ein
  Verzeichnis und `:148` stellt es wieder her. Fixture, nicht Korruption.
- **Keine verschraenkten Laeufe.** Die dokumentierte Sonde (`grep -ao 'isolated-…' | sort -u`)
  liefert genau EINE run-id.

**WAS DAMIT UEBRIG BLEIBT — der Kandidatenraum fuer die Diagnose-Lane.** Der letzte bekannte
gruene Lauf dieser Familie war der Tier-2-Vorschau-Lauf der ACP-10-Lane auf Baum **`9cdb77a`**
(2774 PASS, 0 FAIL). Rot ist alles ab **`2629dcf`**. Dazwischen liegen GENAU ZWEI Commits, beide
meine, beide reine `docs/`-Aenderungen:
- `2c1cf59` — `docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md` (drei Zeilen der Bedeutungsprobe)
- `2629dcf` — `docs/acts-welle-1-2026-08-21.md` (angehaengte Abschnitte)

**Das ist die eine Hypothese, die noch offen und nicht geprueft ist**, und sie ist unbequem: dass
eine reine Doc-Aenderung den Fleet-frame-Bootstrap kippt, waere ueberraschend — aber genau dort
liegt das Delta. Die naheliegende Naht: das Manifest `.fleet/context-packs.json` (getrackt, ein
Pack `rulebook-generat`, `870593a`) und die Anker-Aufloesung in `docs/`; der Check erwartet
`selected.length === 3` und `omitted.length === 4`. **Nicht verifiziert — als Startpunkt gedacht,
nicht als Befund.** Der ehrliche Alternativstand: die Ursache ist aelter als `9cdb77a` und der
gruene Lauf der Lane war der Ausreisser. Beides ist mit den vorhandenen Daten nicht entschieden.

## 3. Maschinenzustand bei der Uebergabe

- `main` = **`850d27b`** (ACP-10 gelandet). Arbeitsbaum sauber bis auf die bekannten untracked-Dateien.
- **`undo-land` bezeichnet noch GENAU dieses Land** (`mainBefore 2629dcf` → `mainAfter 850d27b`,
  `fleet/260821141046-f182`). Seit dem Land hat nichts main bewegt. **Nicht ausgeuebt** — ACP-10 ist
  entlastet. Der Branch existiert, die Arbeit ist recoverable.
- **`deployGap`: `codeBehind: true`, `behindCount: 10`; `bundleStale: true`.** Der laufende Server
  ist Stand `0ce32dc`. **Das ist ABSICHT** — kein Deploy waehrend ungeklaertem Rot.
- Suite-Lock frei, keine Suite laeuft, mein Proof-Worktree ist entfernt und `git worktree prune`
  gelaufen.
- **ACP-10s Live-Nachweis fehlt** und ist die einzige offene Zusage des Acts: `observableOutcome`
  ist „ein pi-Slot meldet `ctx != null` innerhalb ±2 Punkten seiner Fusszeile". Braucht den Deploy.
  Bis dahin: **gebaut und gelandet, nicht bewiesen.**

## 4. ACP-17 im Detail (ausgefuehrt, damit es niemand zweimal tut)

Vier Korrekturen in `rulebook/*.md`, `CLAUDE.md` neu gerendert (Render-Zeile: `rulebook.ts:5`),
`bun e2e/pins.ts` ALL PASS inkl. `RULE_RENDER`.
1. **`undo-land` = Stack der Tiefe 3** (`UNDO_STACK_MAX`, `server.ts:9785`), mit dem Teil, den die
   alte Zeile richtig hatte: die Tiefe ist keine Garantie, ein Kontiguitaetsbruch toetet alles
   darunter (`killUndoStack :9832`). Selbst am Code nachgezogen.
2. **Kontext-Band 25/30** ersetzt 44 %/36 %, samt der drei Owner-Saetze (kurze Restkette darf enden ·
   Handoff ist der Normalfall · niemals ein blinder Timer).
3. **NEUE Regel Token-Hygiene** in `self-scheduling.md`: niemals eine Prozess-Kommandozeile
   ungefiltert ausgeben. `ensureSlot` backt die Credentials per Konstruktion in den Pane-String;
   die `${VAR:+}`-Vorsicht deckt `ps` NICHT ab. Ausdruecklich ohne Isolationsanspruch.
4. **Host aus `.env`** statt eingetippter IP im ctx-Schnipsel (`einstieg.md`), verbatim getestet.
   **Bewusst NUR dort**: die zwei Lane-Schnipsel (`drift`, `gate`) behalten den literalen Host, weil
   eine Lane weder `.env` noch `fleet.json` hat und `$FLEET_HOST` in keiner Pane gesetzt ist.
   Rueckweg ist eine Zeile, falls der Owner es anders will.

**Die Bedeutungsprobe wurde dabei ROT und hat getan, wofuer sie da ist** (E9/E10/P12 hielten exakt
die drei alten Aussagen). Da `rulebook/` gitignored ist, war dieser Pin die einzige Stelle, an der
die Korrektur ihrer eigenen Behauptung begegnen konnte.

## 5. Owner-Entscheide dieser Session — normativ

- **ACP-17 fuehrt die MAIN im Haupt-Checkout aus** (nicht als Lane): `rulebook/` ist gitignored
  (`.gitignore:40`), `server.ts:3930` kopiert es beim Spawn als Snapshot — eine Lane saehe ihre
  Aenderung nie in `git status`.
- **Harvest-Berichte + Act-Vorlage werden getrackt** (`9cdb77a`).
- **Land/Deploy nur mit ausdruecklicher Owner-Promotion** (Program-Non-Goal). Das Land von ACP-10
  war so freigegeben; der Deploy war es AUCH, ist aber wegen des unerklaerten Rot NICHT ausgefuehrt.
- **Reihenfolge fuer die Nachfolge:** A roten Tip schliessen (max. EINE Diagnose-/Repair-Lane, keine
  Suite-Kaskade) · B ACP-13, dann ACP-11 → ACP-12 → ACP-15 seriell · C ACP-16/REPORT_READY nach ACP-13.

### Dateientscheid — eigener Cleanup-Act, NICHT waehrend Rot
- Die **fuenf Rollenarchitektur-Rohpapiere** werden nach vollstaendigem Public-Hygiene-Scan
  gesammelt als historische **NONNORMATIVE Vorschlaege** unter
  `docs/attic/proposals/rollenarchitektur-2026-08-21/` archiviert. `SYSTEM.md` + die Harvests
  bleiben aktive Wahrheit.
- Die **zehn lokalen Root-Dateien** (`.env.bak-*`, alte Stand-/Prompt-/Link-Dateien,
  `promote-program.sh`) kommen **NICHT** ins oeffentliche Repo: nach Kollisionscheck recoverable
  nach `claude-fleet-private/inbox/2026-08-21` verschieben, **nichts loeschen**; `.env.bak-*`
  anschliessend ignorierbar machen. Owner-autorisierter Cleanup-Act, **nicht** Teil der
  Rot-Reparatur.

## 6. Der Befund, der ueber diesem Tag steht

**Der Fortschrittsverlust heute war erneut fehlende PROJEKTION, nicht fehlende Arbeit.** Gebaut,
gelandet und belegt wurde ein sauberer Act; verloren ging Zeit daran, dass der Zustand „wartet auf
Audit" nirgends sichtbar ist und ich beim ersten Rot auf Flake statt aufs Ausschlussverfahren
getippt habe. **Kuenftiger Mindestzustand: `WAITING_ON_AUDIT` / `REPORT_READY` / `HANDOFF_DUE`,
abgeleitet aus VORHANDENEN Fakten, in der UI.** Alle drei sind heute schon berechenbar
(`post-land-audits.jsonl` · der Result-Rail · `ctx` gegen das 25/30-Band) — sie werden nur nirgends
gerendert.

## 7. Was ich falsch gemacht habe

- **Beim ersten roten Audit auf „Flake" getippt.** Ich hatte die Dauer-Statistik als Indiz und habe
  sie wie ein Argument benutzt. Der Wiederholungslauf hat mich widerlegt. Die Regel „der Fail ist
  deiner, bis du das Gegenteil beweist" gilt AB der ersten Minute, nicht ab der zweiten Messung.
- **Ich habe geschrieben, die Lane habe „denselben Inhalt" gruen gemessen.** Sie mass `9cdb77a`,
  nicht den gelandeten Stand. Das war zu grosszuegig gelesen und hat die Eingrenzung verzoegert.
- **Drei Suite-Laeufe fuer eine Eingrenzung, die keinen Taeter gefunden hat.** Zwei davon waren
  noetig (Determinismus, Ownership), der Erkenntnisgewinn des dritten war klein gegen ~17 min
  Maschinenzeit.
- **Ich habe zwei Doc-Commits abgesetzt, waehrend eine Lane lief**, und genau die stehen jetzt als
  einziger Kandidat im Delta. Das Regelbuch warnt davor („main-seitige Doc-Analyse committen,
  BEVOR du eine Lane spawnst"), und ich habe die Reihenfolge nur zur Haelfte eingehalten.

## 8. Verifikation dieses Commits — ehrlich

**Keine Suite fuer diesen Commit gefahren** — die Aenderung ist ausschliesslich `HANDOFF.md`. Die
Zahlen oben stammen aus den drei protokollierten Laeufen und aus `/api/sessions`. **Ein
Direkt-Commit aus dem Haupt-Checkout ist fuer jedes land-seitige Ledger unsichtbar** — keine
`fleet/land`-Note, keine Outcome-Zeile, kein Tier-2-Lauf. `./state.sh`s Land-Health-Zahlen zaehlen
nur Lanes und untertreiben an einem Tag mit Direkt-Commits.

# HANDOFF — ACP Architecture Controller II (Slot 2), 2026-08-21, ctx 20,9 % GEMESSEN

**Uebergabe auf Owner-Anweisung, unterhalb des neuen 25-%-Bandes.** Diese Session hat drei
Reviews beauftragt, geerntet und synthetisiert und die Owner-Entscheide zur Program-MAIN-
Autonomie entgegengenommen. **Kein Produktcode, kein Land, kein Deploy, keine Suite gefahren.**
Commits dieser Session: diese Datei. Der exponierte Self-Token rotiert mit dieser Nachfolge.

## 0. Die exakte naechste Handlung

**Die Architektur ist ENTSCHIEDEN (§1). Es ist keine Analyse mehr faellig — schneide und
koordiniere die Acts aus §4.** Beginne mit Welle 1 (drei Acts, Write-Sets disjunkt, keiner
beruehrt `server.ts`, alle drei sofort briefbar). Vor Builder-Start gilt der Program-Gate
unveraendert: beide Act-Briefs dem Owner vorlegen. **Nicht neu analysieren, nicht neu messen,
was in §3 mit Zeile steht** — das ist bezahlt und nachgeprueft.

## 1. OWNER-ENTSCHEIDE 2026-08-21, autoritativ — der Schnitt steht

**Architekturschnitt bestaetigt: die MAIN RELEASED, der TICK STARTET.** Kein direkter Dispatch,
der den Master-Stop umgeht. Repo zunaechst aus dem gebundenen `cwd` ableiten. Push/Remote bleibt
Owner-Akt / explizite externe Wirkung. Gewoehnliche Fehlurteile erzeugen KEINE neue Regel —
Feedback/Repair reicht.

**(1) Token-Modell — die Huelle darf VORANGEHEN.** Nicht auf eine fingierte kryptographische
Trennung warten. Alle normalen Agenten laufen heute absichtlich unter demselben Host-User mit
Full Access und koennen ohnehin lokale ungetrackte Zustandsdateien lesen. **Self-Tokens sind eine
strukturelle Capability-/Routing- und Versehentlichkeitsgrenze, KEINE adversariale
Sicherheitsgrenze zwischen boesartigen lokalen Prozessen** — genau so formulieren, nirgends
staerker. argv-/ps-Leaks werden SEPARAT repariert, weil sie versehentliche Ausgabe und
Kontextkontamination erzeugen; **danach trotzdem keine Isolation behaupten.** Echte adversariale
Trennung gehoert spaeter an OS-User-/Container-/Broker-Grenzen und ist KEINE Vorbedingung der
Program-MAIN-Autonomie. Owner-/Netzgrenze ist eine andere Ebene, aber auch sie nicht staerker
behaupten, als der Full-Access-Host traegt.

**(2) 25/30 ist OFFIZIELL** (ersetzt die 44-%-Schwelle fuer Controller): **25 % =
Uebergabeentscheidung und HANDOFF vorbereiten · 30 % = keine neue unklare Tiefenarbeit.** Eine
kurze aktive Restkette darf enden. **Handoff ist der Normalfall; Compact nur bei derselben kurzen
Restkette UND nachgewiesen frischem Gruendungskern.** `ctx: null` bleibt UNKNOWN und zaehlt nie
als gruen. Das Band wird ZUSAMMEN mit Lese-/Tooloutput-Disziplin und reduziertem
Hook-Erfolgsrauschen eingefuehrt — **niemals als blinder Timer oder harte Arbeitsunterbrechung.**
Controller EINSCHLIESSLICH Supervisor fallen darunter.

**(3) Harness-Eintritt — JA.** Eine live owner-/program-gebundene MAIN auf `automatable:false`
darf ihre Program-Huelle nutzen. **Der Flag beschreibt, ob DIESER HARNESS unbeaufsichtigt
gestartet/angesteuert werden darf — nicht die Autoritaet oder Intelligenz einer bereits laufenden
gebundenen MAIN.** MAIN darf Tasks erzeugen und releasen; der Tick bleibt der Starter und prueft
Master-Stop, Program-Lane-Deckel und die Automationstauglichkeit des **ZIEL**-Harness.
`automatable:false` am aufrufenden MAIN ist kein Autoritaetsentzug und darf **niemals implizit
Context Packs oder Modellklasse zu einem Gate machen.**

**Bestehen bleibt:** Project-MAIN-Autonomie und beratende Context Packs (Packs gewaehren/entziehen
nie Autoritaet); keine Rollen- oder Schrittbuerokratie.

## 2. Der Supervisor-Entscheid (Owner, 2026-08-21)

Ja zu einem gut gebrieften, **ereignisgetriebenen Sonnet-5-Supervisor**. Aber der Ergebnisfluss
ist **Worker/Analyst → typisiertes `REPORT_READY` mit Task/Program/Empfaenger → zustaendige
Project-MAIN**; **nur** fehlender/staler Empfaenger oder ausbleibender Ack eskaliert zum
Supervisor. Enge Rechte: typed reads, Attention, abgeleiteter Program-MAIN-Nudge — **kein
beliebiges Slot-Send, kein Dispatch, kein Land, kein Deploy, kein Code.** Stundenpolling ist
hoechstens Deadman, nie Primaermonitoring.

**WARNUNG, gemessen (§3): der Rail hat heute in 9 von 13 Faellen keinen Empfaenger.** Die
Bindungs-Reparatur (ACP-13) ist Vorbedingung des Rails, nicht Folgearbeit — sonst ist die
Eskalation der Normalfall statt der Ausnahme.

## 3. Was GEMESSEN ist — nicht erneut herleiten

Alles hier von MIR am Baum HEAD `0c176ee` nachgezogen, nicht geerbt.

| Fakt | Messung | Fundstelle |
|---|---|---|
| Program-Bindungen live | **3 lebend · 9 stale · 1 ohne main** von 13 aktiven | `/api/programs` × `/api/sessions` |
| `.find`-Mehrdeutigkeit | **heute unerreichbar**: 12 Bindungen, 12 distinkte Tripel, 0 Duplikate | dito |
| `releaseTask` | `:2262`; Wert `"machine"` hat **null Aufrufer**; einzige Aufrufstelle `:18865` hart `"owner"` | `server.ts` |
| `queued`-Schreibstellen | **vier**, nicht eine: `:2263` `:6303` `:14413` `:18523` | `server.ts` |
| Der Bolt | gated `spawn.harness` — den GESTARTETEN, nie den handelnden Agenten | `server.ts:6107` |
| `undo-land` | **Stack der Tiefe 3**, kontiguitaetsgeprueft, `pop()` einzeln | `UNDO_STACK_MAX :9785`, `:17742` |
| claude-CLI-Effort | **`--effort low\|medium\|high\|xhigh\|max` EXISTIERT** | `claude --help` |
| Fleet dazu | `effortLevels: []`, `supports.effort:false`, Kommentar „claude has no CLI effort flag" — **ueberholt** | `server.ts:443-444` |
| Durchreiche | `slotCmd :139` / `agentCmd` haben **keinen** effort-Parameter | `server.ts` |
| Blockierender Pin | **keiner** — der einzige effort-Pin prueft die `DispatchSpawn`-Form | `e2e/pins.ts:1293` |
| Self-Token in `ps` | **13 Prozesse, 11 Slots** (nie Werte ausgeben) | eigene gefilterte Zaehlung |

**Das Regelbuch ist an zwei Stellen falsch:** `CLAUDE.md:96` und `:591` sagen, `undo-land` decke
genau EIN Land. Der Code sagt 3. **Doc-vs-Code → Code gilt.** `CLAUDE.md` ist ein Generat: der
Schnitt gehoert ins `rulebook.ts`-Fragment, nie in die gerenderte Datei. Abschnitt J des
GLM-Entwurfs hat diese Zeile **abgeschrieben statt gemessen** — seine `[gemessen]`-Marke ist dort
unverdient. Nebenbefund: J's Zeilenangaben in der 6100er-Region liegen systematisch 1–2 Zeilen zu
tief; Funktion und Aussage stimmen, die Zeile nicht.

## 4. Die Acts — geschnitten, aussen nach innen. HIER ANFANGEN.

**Welle 1 — parallel, Write-Sets disjunkt, kein `server.ts`:**
- **ACP-10 · ctx-Nenner der Bruecke.** EINE Zeile in `contextWindowFor` fuer
  `claude-bridge/claude-*`. Write-Set `src/protocol.ts:171-183` + Pin. Proof: ein pi+Opus-Slot
  meldet ctx ≠ null, ±2 Punkte gegen die TUI-Selbstauskunft.
- **ACP-17 · Regelbuch-Korrekturen** — **Fragment in `rulebook.ts`, NIE `CLAUDE.md` direkt**:
  `undo-land` = 3 · Token-Hygiene erweitern auf *„niemals Prozess-Kommandozeilen ungefiltert
  ausgeben"* (die `${VAR:+}`-Regel deckt `ps` NICHT ab) · hartcodierte IP im Mess-Schnipsel ·
  der Supervisor-Effort-Absatz nach ACP-12 · die 44-%-Schwelle → 25/30 aus §1(2).
- **ACP-14 · Ambient-Steuer senken.** Hook-Erfolgs-Echo kuerzen, blockierende Sprueche voll.
  **Write-Set liegt in `~/.claude` — AUSSERHALB des Repos, also OWNER-AKT, keine Lane.**

**Welle 2 — seriell, alle auf `server.ts`, Reihenfolge = Abhaengigkeit:**
- **ACP-13 · Bindung reparieren** *(Vorbedingung von allem, auch des Supervisor-Rails)*:
  `filter` statt `find`, `>1 ⇒ 409`, `sessionId` **berichten statt gaten** — die Form existiert
  fertig bei `handleSelfSucceed :5197-5200`; stale Bindung ueberschreibbar statt 409 in
  `bootstrapProgramMain`; `bound`/`staleSince` auf `GET /api/programs`.
- **ACP-11 · Codex-ctx-Reader**: Tail-Read `last_token_usage.total_tokens`, Nenner
  `model_context_window` **derselben Zeile, nie geraten**; 56-MB-Rollout ⇒ nur Tail. Gegenprobe
  live gegen Slot 10 ≈ 27 %.
- **ACP-12 · Nativer Claude-Effort-Adapter** (Owner ausdruecklich beauftragt): `effortLevels` +
  `supports.effort:true`, Durchreiche `spawnCmd → slotCmd → agentCmd`, gequotet wie `model`.
  Proof `./e2e-claude-gate.sh` — Phase 1 prueft genau diese Kommandozeilen-Form. **Danach**
  Supervisor-Succession auf `claude-sonnet-5[1m]` + high, mit gezielter Probe am Footer, nicht
  als ungemessene Annahme.
- **ACP-15 · Deckel korrekt ausdruecken**: der 10er faellt als Autonomie-Grenze (er deckelt
  Review-Kapazitaet, die es unter der Huelle nicht mehr gibt, `:16233`); `DISPATCH_MAX_LANES` je
  **Program** statt je Repo — `programId` wird `:6164` bereits auf den Slot vererbt.

**Welle 3 — innen, zuletzt:**
- **ACP-16 · Die Huelle**: MAIN released, **Tick startet**. `repo` aus dem `cwd` der Bindung
  abgeleitet, nie aus dem Koerper. `audit("task_release", …)` statt des ueberschreibbaren
  `releasedBy` (`:6156` stempelt es auf `"owner"` um — es beantwortet die Lane-Frage, nicht die
  Release-Frage). Eintritts-Gate prueft die Automationstauglichkeit des **ZIEL**-Harness.

## 5. Die drei geernteten Berichte — UNTRACKED und damit gefaehrdet

Drei Reviewer-Slots (7, 12, 14) sind geerntet und geschlossen. Ihre Pane-Berichte leben nur noch
hier, **untracked**:

| Datei | Z. | Was |
|---|---|---|
| `docs/harvest-critic-J-2026-08-21.md` | 284 | Opus-Autonomie-Critic, 8 gerangte Befunde zu J |
| `docs/harvest-portabilitaet-J-2026-08-21.md` | 221 | pi+Opus Portabilitaet + der EINE kontrollierte pi-Canary |
| `docs/harvest-lifecycle-glm-2026-08-21.md` | 136 | GLM Controller-Lifecycle-Audit, Beweistabelle + 5 Empfehlungen |

Alle drei bei der Ernte redigiert (32-hex, IP, Host, Klarname) und **nachgeprueft: je 0 Treffer**.
Sie sind ein `git add` entfernt vom Ueberleben — **die Entscheidung gehoert dem Owner**, weil ein
Commit hier `main` bewegt. Die fuenf aelteren Artefakte vom Vormittag bleiben unberuehrt:
Owner-Verbot, sie zu editieren, zu committen oder zu normalisieren.

## 6. Was ich falsch gemacht habe

- **Mein `POST .../open` mit `effort:"high"` scheiterte** an `harness claude takes no effort` —
  ich hatte die Adapter-Faehigkeit vorausgesetzt statt gemessen. Der Fehlschlag wurde zum
  Befund (ACP-12), aber die Reihenfolge war falsch herum.
- **Ich habe im Owner-sichtbaren Verlauf einmal Prozess-Argumente abgefragt.** Nur Zaehlungen
  wurden gedruckt, keine Werte — aber die Klasse ist genau die, die der pi-Canary bezahlt hat.
  Die Regel gehoert deshalb ins Fragment (ACP-17), nicht in einen Report.
- **Drei Reviewer, die je ~8 Minuten dachten, produzierten Berichte, die nur in einer Pane
  standen.** Das Ernten war ein nachtraeglicher Einfall, kein Teil des Briefs. Ein Brief, der
  keinen Ablageweg nennt, plant den Verlust ein.

## 7. Verifikation dieses Commits — ehrlich

**Keine Suite gefahren.** Die Aenderung ist ausschliesslich diese Datei. **Ein Direkt-Commit aus
dem Haupt-Checkout ist fuer jedes land-seitige Ledger unsichtbar** — keine `fleet/land`-Note,
keine Outcome-Zeile, kein Tier-2-Lauf. Das steht hier, damit die naechste Session nicht
korrekt-aber-falsch schliesst, er sei vermessen worden. `./state.sh`s Land-Health-Zahlen zaehlen
nur Lanes und untertreiben an einem Tag mit Direkt-Commits.

# HANDOFF — ACP Architecture Controller (Slot 8), 2026-08-21, ctx 41,2 % GEMESSEN

**Uebergabe auf Owner-Anweisung an der Controller-Risikogrenze (~40 %).** Diese Session war
Evidenz-Kurator und Synthetisierer fuer die Rollen-/Capability-Architektur. **Kein Produktcode,
kein Land, kein Deploy, keine Suite gefahren.** Einziger Commit dieser Session: diese Datei.

## 0. Die exakte naechste Handlung

**Der GLM-Architekt (Slot 9) schreibt in DIESEM MOMENT Abschnitt J** (Autonomie-Delta). Ein
Pane-Ruhe-Watcher lief unter der Vorgaengerin und ist mit ihr weg — **die Nachfolgerin muss den
Rueckweg selbst neu legen** (Pane-Ruhe, nicht mtime: die Datei wird in Schueben geschrieben, ein
mtime-Watcher hat hier zweimal zu frueh gefeuert). Wenn J steht: den **Opus-Kritiker (Slot 12,
lebt, ctx 32 %, hat den vollen Kontext)** mit dem Delta beauftragen — Owner-Wortlaut: das
Autonomie-Prinzip auf **unsichere Mehrdeutigkeit** angreifen, **ohne es durch Schritt-Buerokratie
zu ersetzen**. Danach Synthese, Widersprueche und Umsetzungsreihenfolge neu fassen.

## 1. Die fuenf Analyse-Artefakte — ALLE UNTRACKED, ALLE VORSCHLAG

**Status: PROPOSAL, uncommitted, nicht normativ.** Sie wurden bewusst NICHT committet (ein Commit
im Haupt-Checkout bewegt `main`, und es lag kein Land-Entscheid vor). Der Owner hat ausdruecklich
verboten, sie zu editieren, zu committen oder zu normalisieren.

| Datei | Zeilen | sha256 (16) | Was |
|---|---|---|---|
| `docs/rollen-evidenz-2026-08-21.md` | 617 | `4ab207036183cbb3…` | Kurator-Evidenzdossier (18 Abschnitte) |
| `docs/rollen-architektur-glm-2026-08-21.md` | 650 | `2cd7a3590e60f8c7…` | GLM-Entwurf A–I (Abschnitt J IN ARBEIT) |
| `docs/kritik-opus-2026-08-21.md` | 596 | `d301445b44370923…` | Opus-Kritik, 15 gerangte Befunde |
| `docs/unterbau-audit-glm-2026-08-21.md` | 385 | `81219a0a7293051c…` | Unterbau-Audit, 12 Befunde |
| `docs/synthese-rollenarchitektur-2026-08-21.md` | 171 | `93756fd7e27fd08b…` | Synthese (VERALTET durch Owner-Korrektur) |

**Der Hash von `rollen-architektur-glm-*.md` ist ein Schnappschuss und aendert sich**, sobald der
Architekt J anhaengt. Die Synthese ist durch die Owner-Korrektur (§3) inhaltlich ueberholt und muss
neu geschrieben werden, nicht geflickt.

## 2. Ergebnisse der vier Agenten

- **(1) GLM-5.3/pi-zai, Architekt, Slot 9:** drei Agentenrollen als typisierte BINDUNGEN eines
  Sitzes (`lane` · `program-main` · `supervisor`), dazu Owner und Maschine als
  Nicht-Agenten-Prinzipale. Fable-MAIN: **gar keine Rolle**. Critic = Modus, Resolver = Policy.
- **(2) Opus 5, adversarialer Kritiker, Slot 12:** 15 gerangte Befunde. Drei bringen je einen
  Schnitt zum Einsturz, alle drei von mir am Code nachgeprueft: `stateEffect` ist der **Literaltyp
  `"none"`** (`src/protocol.ts:275`), also ist GLMs Wirkungs-Taxonomie nicht in die Karte
  schreibbar und Schnitt 1 faellt an seinem eigenen Proof · `e2e/pins.ts:732` pinnt den
  `STEWARD_LABEL`-Literalstring, und `bun e2e/pins.ts` IST Stufe 1 des Land-Gates, also reisst der
  Steward-Rueckbau das Gate ein · der Interventions-Rail hat keinen Konsumenten.
- **(3) pi + claude-bridge/claude-opus-5, Harness-Canary (Slot 13, beendet):** `supports.*` sind
  **Politik-Werte, keine Faehigkeitsmessungen** — `selfSchedule:false` widerlegt (POST gab 200),
  und der Code sagt selbst *„The flag means 'do not advertise this'"* (`server.ts:557`).
  `ctx:null` ist fuer pi falsch. Sein staerkster Satz: *„nichts hat mir gesagt, dass mein Ergebnis
  nirgendwo ankommt."*
- **(4) GLM-5.3/pi-zai #2, Unterbau-Audit, Slot 14:** 12 Befunde, kannte die Kritik nicht und
  **widerspricht ihr in der Rail-Frage**. Haerteste Funde: ein `canary`-Pack kann seinen eigenen
  Promotionsbeweis strukturell nicht erzeugen (die Omissions-Leiter prueft `status !== "active"`
  VOR allen Triggern) · das Lizenz-Gate hat keinen Maschinenleser · **`supervisorNudge` schreibt
  KEINE Journal-Zeile**, und eine verweigerte Zustellung schreibt gar nichts.

**Zwei LIVE-DEFEKTE im heutigen Code**, beim Pruefen eines Dokuments gefunden, von mir bestaetigt,
**unabhaengig von jeder Architekturvariante und unter der neuen Zielrichtung teurer**:
1. **Eine Codex-Program-MAIN verliert `POST /api/self/attention`** — sie erreicht den Owner nicht
   mehr. `boundProgramForMain` (`:5706`) gated auf `sessionId`; `bootstrapProgramMain` schreibt
   fuer Codex `null` (`pinsSession:false`); `tickCodexRecovery` (`:3675`) setzt spaeter eine echte
   uuid. `clarificationReceiverFor` (`:5301`) gated deshalb ausdruecklich NICHT darauf.
2. **`boundProgramForMain` ist ein `.find` ohne Eindeutigkeitspruefung** bei live 13 aktiven
   Programmen; `handleSelfSucceed` (`:5199`) behandelt dieselbe Gefahr korrekt mit 409.

## 3. OWNER-KORREKTUR: intelligence-first bounded autonomy (autoritativ)

**Die Lesart, gegen die alles oben erhoben wurde, war zu eng.** Nach Bestaetigung und Aktivierung
eines Programs soll dessen gebundene Project-MAIN reversible Produkt- und Reihenfolge-Entscheidungen
treffen, eigene begrenzte Tasks **anlegen UND starten/dispatchen**, Worker anstupsen/wiederholen/
ersetzen, Modelle waehlen und gewoehnliche Critic-Reparaturen aufloesen — **ohne Rueckkehr zum
Owner**. Kanonisch: Camera Impact — innerhalb einer freigegebenen Qualitaetsachse entscheidet und
handelt die MAIN. Klassen: **(A)** reversibel im bestaetigten Scope → MAIN · **(B)** begrenzte
Ausfuehrung/Routing → MAIN in expliziten Grenzen · **(C)** Scope-Erweiterung, irreversible
Richtung, externe Wirkung/Kosten, Deploy/Submit, erklaertes Geschmacks-Gate → Owner.

**Damit ist der Satz „die MAIN darf die Schlange fuettern, nicht den Zaun oeffnen" ueberholt** — und
der bestgemessene Befund des Tages kehrt seine Bedeutung um: `releaseTask(t, "machine")`
(`server.ts:2262`) ist die einzige Funktion, die `pending → queued` bewegt, hat genau eine
Aufrufstelle (`:18865`, Owner-Tier, hart `"owner"`), und **der Wert `"machine"` hat null
Aufrufer** — der Kommentar (`:2251`–`:2261`) nennt ihn woertlich *„the transition a future
UNATTENDED promote will make"*. Der Stempelplatz ist gebaut und unbenutzt. `Task.releasedBy` wird
persistiert.

**Owner-Prinzip Autonomie/Reparatur (normativ):** jede gebundene Session besitzt ihren Scope und
wird an Ergebnissen, Belegen und Grenz-Einhaltung gemessen, nicht an einem geskripteten
Mikro-Workflow. Kein hoeherer Manager, **keine neue Regel fuer jeden Fehler**. Bei Scheitern zuerst
die kleinste stromaufwaerts liegende Ursache klassifizieren (Wissen → Brief/Pack · Handlung nicht
auffindbar → Capability/Adapter · falsche Grenze → Program-/Rollenvertrag · Modell-Passung →
Routing · unbeobachtbar → Sensor/Receipt · Urteilsfehler → Reparatur in derselben Rolle), **nur
diese** aendern, canaryn, wirkungslose Anweisung zurueckziehen. **Eine einzelne Anekdote bleibt
Evidenz, nie eine globale Regel** — auch die scharfen Befunde von heute werden NICHT ins Regelbuch
promotet.

## 4. Context Packs sind beratend, NICHT Autoritaet

Owner-Vorgabe: Packs sind Wissens-/Ambitions-Eingaben und duerfen Autoritaet **weder gewaehren noch
entziehen noch heimlich gaten**; Program-Autoritaet und Capability-Pruefung sind eine **separate
Ebene**. **Gemessen: das gilt heute schon** — `ContextPackCapability` kommt ausschliesslich in
`context-packs.ts`, `context-plan.ts`, `context-manifest.ts`, `context-pack-validator.ts` vor und
**nie im Auth-Pfad von `server.ts`**; `requiredCapabilities` entscheidet, ob ein ZEIGER
zustellenswert ist. Aufgabe ist **Erhalt, nicht Bau**. Und: `capability-map.ts`
(Faehigkeits-Register) ist eine ANDERE Ebene als `context-packs.ts` (Wissens-Zeiger) — sie duerfen
nie verschmelzen.

## 5. Der Pi-Self-Token-Vorfall und seine Eindaemmung

**Meine Sonde war falsch geschrieben und hat den Self-Token von Slot 13 im Klartext in die Pane
gedruckt.** `${VAR:+gesetzt}${VAR:-FEHLT}` druckt bei GESETZTER Variable „gesetzt" UND den Wert
(`:-` greift nur bei ungesetzt). Der Canary hat es selbst gemeldet und Rotation empfohlen.
**Eingedaemmt:** Streu-Auto `eb0a1279` geloescht, Slot 13 beendet, der Slot-Eintrag ist aus
`fleet.json` verschwunden, das Token existiert nicht mehr (Rotation beim Recycling,
`server.ts:4494`). Das Credential war slot-scoped und nur lokal/Tailscale erreichbar. Richtige
Form: `[ -n "$V" ] && echo gesetzt || echo FEHLT`. **In keinem der fuenf Artefakte steht ein
Tokenwert** (geprueft).

## 6. Offen, mit Besitzer

- **Owner-Entscheid, benannt und unbeantwortet:** Default-`kind` fuer MAIN-erzeugte Zeilen —
  `notiz` oder `auftrag`? Die zwei Praezedenzfaelle zeigen gegeneinander: der Steward (vertrauteste
  Nicht-Owner-Quelle) schreibt `notiz` (`:16244`), `/intake` (am wenigsten vertraut, oeffentlich
  erreichbar) schreibt `auftrag` (`:13806`).
- **Die ungeloeste semantische Grenze fuer J.3, ehrlich zu halten:** „reversibel" ist beim Landen
  keine Eigenschaft der Handlung allein, sondern Handlung MAL Rate — `undo-land` deckt genau EIN
  Land und nur bis zum naechsten (`:17706`), Land N ist beim Alarm auf N+1 schon unerreichbar.
  `SYSTEM.md` erlaubt den Policy-Weg bereits woertlich; die Maschinerie (`land-candidate.ts`) ist
  gebaut und wird nur von Tests importiert.
- **Attention `ce32bda5`** (Result-Rail Candidate `0057259`) bleibt offen — Land- und
  Deploy-Entscheid gehoeren dem Owner, unberuehrt.
- **Slots 9, 12, 14 leben** und tragen den vollen Kontext ihrer Rolle; Slot 13 ist beendet.

## 7. Was ich falsch gemacht habe

- **Mein Evidenzdossier trug fuenf Fehler.** Drei fand ich selbst, einen der Architekt
  (`main-direct`-Zeilen existieren: 415 Zeilen, 27 davon), einen erst der dritte unabhaengige
  Leser — und **dieser eine war bereits in den Entwurf gewandert und stand dort als „bestaetigt"**
  (die Nudge-Journal-Zeile, die es nicht gibt). Das ist das Argument fuer die vier Perspektiven,
  keine Fussnote dazu.
- **Die Token-Sonde** (§5).
- **Zwei Watcher feuerten zu frueh**, weil ich mtime-Stabilitaet als Fertig-Signal nahm; ein
  Agent, der in Schueben arbeitet, laesst die Datei stillstehen, waehrend er denkt. Pane-Ruhe ist
  das richtige Signal, mit herausgefilterten Spinner- und Zaehlerzeilen.

## 8. Verifikation dieses Commits — ehrlich

**Keine Suite gefahren.** Der Owner hat Suiten fuer diese Uebergabe ausdruecklich untersagt; die
Aenderung ist ausschliesslich diese Datei. Ein Direkt-Commit aus dem Haupt-Checkout ist fuer jedes
land-seitige Ledger unsichtbar (keine `fleet/land`-Note, keine Outcome-Zeile, kein Tier-2-Lauf) —
das steht hier, damit die naechste Session nicht korrekt-aber-falsch schliesst, er sei vermessen
worden.

# FRONTIER — 2026-08-21: die Controller-Architektur, bevor weiter gebaut wird

**Owner-Entscheid 2026-08-21:** der Spiele-Bau tritt zurueck; zuerst wird die
Controller-Architektur geklaert. **Kein Land, kein Deploy, keine alte Queue-Arbeit neu
starten.** Die Nachfolgerin beginnt READ-ONLY.

## Die gemessene Luecke, die den Schnitt ausloest

Eine gebundene Program-MAIN kann **strukturell keine Fleet-Task anlegen oder dispatchen**.
Nachgemessen, nicht vermutet:
- Es gibt **keine** self-Route, die eine Task anlegt oder startet (`rg` auf self+task: leer).
- `POST /api/tasks` (`server.ts:18486`) und `POST /api/tasks/:id/dispatch` (`:18363`) liegen
  **unterhalb** des Owner-Gates (`:16999`, „everything below carries authority").
- Folge: alles, was diese Session heute an Queue-Arbeit tat — drei Briefs anlegen, den
  Result-Rail dispatchen, den Critic spawnen (`POST /api/lanes`) — lief ueber das
  **OWNER-Token**, nicht ueber das Prinzipal „Program-MAIN". Der dokumentierte Selbst-Kanal
  einer MAIN ist heute: propose, attention, watch, autos, ack, succeed/retire. Mehr nicht.
- Der Ausweichweg ist damit der manuelle Worktree — genau die Handarbeit, die die
  Architektur abschaffen soll.

## Auftrag der Nachfolgerin (Owner-Wortlaut, verdichtet)

Entwirf die **kleinste kohaerente Rollen-/Funktions-Architektur**, die diese Luecke schliesst.
Sie muss unterscheiden: **globaler Owner-seitiger Controller · Supervisor · Project-MAIN ·
Fable/kreative MAIN (falls ueberhaupt) · Builder-Lane · Critic/Resolver · Worker.** Zu jeder
Rolle gehoeren: **typisierte Capabilities, Autoritaet, Receipts, Harness-Degradation, und wo
das Landen wohnt.** `SYSTEM.md` und der heutige Code werden WIEDERVERWENDET; ueberfluessige
Schichten werden ausdruecklich **zurueckgebaut**, nicht ergaenzt.

**Vor jeder Implementierung** zwei UNABHAENGIGE Review-Briefs vorbereiten:
1. **Adversarialer Opus-Architektur-Critic.**
2. **Echter Pi-Harness** (`claude-bridge/claude-opus-5`, thinking high) als
   **Portabilitaets-Critic** — zugleich der EINE kontrollierte Pi+Opus-Canary, den die
   Routingvorgabe erlaubt; er ist noch durch nichts belegt (kein Lane/Land-Canary, kein
   `transcript:true`-Vertrag, kein Worker-Tier).

**Kein Code**, bis beide Kritiken synthetisiert sind und der Owner die minimale Architektur
plus die **strittigen Grenzen** bekommen hat.

## Was offen liegen bleibt und NICHT angefasst wird

- **Attention `ce32bda5`:** Result-Rail Candidate `0057259` ist reviewreif. Land-Entscheid und
  Deploy-Entscheid gehoeren dem Owner. Lane `fleet/260820204100-7aa1` (Slot 3) bleibt stehen.
- Drei task-fertige, NICHT dispatchte Briefs: `ad2ee96a` CTX-01 · `7aaa6644` STUDIO-00 ·
  `e952c2b2` HARNESS-01. Zwei notizen: `13ed6ce9` Loader-Widerspruch · `c89c18df`
  Zustellbudget.
- Exakt loeschbar, bewusst nicht geloescht: Slot 7 (`fleet-260820222129-8e3a`, geernteter
  read-only Critic, ahead=0/clean) und der orphan `fleet-260820171920-5ad5` (ahead=0/clean,
  HEAD ist Ahne von main, kein Slot haelt ihn).
- Die zehn untracked Owner-Dateien im Root: **niemals anfassen.**

## Zwei Werkzeug-Wahrheiten, die die Nachfolgerin sofort braucht

- **Der ③-Reviewer ist defekt** (`summarizer timed out without an answer`). Eine unabhaengige
  Review kostet derzeit einen eigenen Critic-Slot.
- **Ein Lane-Watch ist stumm, solange `ahead=0`**, und ein read-only Critic committet nie —
  fuer beide braucht es einen eigenen Pane-Quiet-Watcher. Zweimal an einem Tag bezahlt.

# HANDOFF — ACP Project MAIN (Slot 2), 2026-08-21, ctx GEMESSEN am eigenen Slot

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei traegt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Gebundene Project MAIN fuer Program `eeba7c04caae64d79969199b`. Genau EIN Schnitt: der
Result-Rail (ACP-05/06), Scope B-D. Kein eigener Produktcode, kein Land, kein Deploy.

## Belegter Stand

- **Candidate `0057259`** auf `fleet/260820204100-7aa1` (Slot 3, Sol high), zwei Commits:
  `cc127b5` Bau, `0057259` Reparatur. Basis `main e59d89f`, behind 0, wouldConflict false,
  Lane clean inkl. 0 untracked. **Reviewreif, NICHT gelandet** — Attention `ce32bda5` offen.
- Proof unabhaengig nachgemessen: `./e2e-isolated.sh` seriell **2771 PASS / 0 FAIL, EINE
  run-id**; pins 161 PASS; claude-gate 410 PASS. Runde 1 lag bei 2767, Act-3-Basis bei 2755 —
  die neuen Checks existieren wirklich, die Zahl steht nicht still.
- **Scope-Teilung gehalten:** Teil A (`attemptId`, Lifecycle) ist NICHT gebaut und kommt im
  Baum nicht vor. Er bleibt ein eigener Owner-Entscheid.
- **Der Live-Server ist weiter hinter `main`.** Act 3 UND dieser Schnitt sind damit gebaut,
  aber nicht aktiv. Deploy ist ein getrennter Owner-Akt und wurde nicht angefasst.
- Die zehn untracked Owner-Dateien im Haupt-Checkout: unangetastet, vor und nach jedem
  Schritt geprueft.

## Freigegebene Reihenfolge fuer die Nachfolgerin

1. **Land-Entscheid zu `0057259`** einholen (Attention `ce32bda5`). Nicht selbst entscheiden.
2. **Deploy-Entscheid** — getrennt vom Land, und er deckt zwei Schnitte ab, nicht einen.
3. Danach erst die drei task-fertigen, NICHT dispatchten Briefs: `ad2ee96a` CTX-01 ·
   `7aaa6644` STUDIO-00 · `e952c2b2` HARNESS-01 (nicht blockierend).

## GLM Studio Readiness: CONDITIONAL-GO

Die Rollenfrage ist entschieden: **Project MAIN plus temporaere Specialists genuegt. Es gibt
KEINE Fable-MAIN-Zwischenebene.** Vor einem Studio-Start fehlen drei Dinge, keines davon
Bauarbeit der Nachfolgerin:
- **Result-Rail gelandet UND live.** Gebaut reicht nicht — ohne laufenden Code ist der
  Rueckkanal an echter Arbeit nicht beweisbar.
- **Owner-Entscheid: attended oder automatisierter Dispatch?** Verschiedene Fehlermodi,
  verschiedene Spuren.
- **Owner-Entscheid: ehrliche Entkopplung von der Act-9-Feuerprobe.** Act 9 ist heute nicht
  messbar (Tabelle: `docs/messungen/2026-08-20-gamestudio-readiness.md`). STUDIO-00 darf sich
  daran nicht aufhaengen — was NICHT geht, ist so zu tun, als sei die Feuerprobe gefahren.

## Routing ab dem naechsten Schnitt (Owner, 2026-08-21)

Qualitaetskritische Builder und frische Code-Critics standardmaessig **Opus 5**, nicht
Sol/Codex. Sol ist nur noch begruendeter Spezialist. Fable bleibt Director/visueller
Integrator, GLM attended Cross-Family-Gegenpruefung. **Pi+Opus nur als genau EIN
kontrollierter Canary**, nicht als Default, bis Spawn/High/Tools/Commit/Resume/ctx/
Result-Rueckkanal belegt sind. Und: **heute laesst sich fuer eine claude-Lane kein
expliziter high-Fakt behaupten** — der Adapter kennt das reale `--effort`-Flag nicht
(gemessen: CLI 2.1.238 hat es, `slotCmd`/`agentCmd` reichen es nie durch,
`supports.effort:false`). Das ist `e952c2b2` HARNESS-01.

## Vier Befunde, die die Nachfolgerin braucht

- **Der ③-Reviewer ist defekt** (`summarizer timed out without an answer`), durchgehend, auch
  als Owner-POST. Die mechanische Review-Haelfte steht also nicht zur Verfuegung; eine
  unabhaengige Review kostet derzeit einen eigenen Critic-Slot.
- **Ein Lane-Watch ist strukturell stumm, solange `ahead=0`.** `done-looking` verlangt
  idle + clean + ahead>0; eine Lane, die vor dem ersten Commit stoppt, erreicht dich NIE. Das
  ist zweimal passiert (Regel-Widerspruch, dann Write-Set-Grenze) und beide Male hat nur ein
  eigener Pane-Quiet-Watcher es gemeldet. Dasselbe gilt fuer jeden read-only Critic: er
  committet nie, also feuert nichts.
- **Der Loader-Vertrag widerspricht sich** (`notiz 13ed6ce9`): `AGENTS.md` fordert den vollen
  `CLAUDE.md`-Read unter einer Sunset-Klausel, deren Bedingung laengst eingetreten ist — eine
  Lane haelt seit dem Generat nur noch eine Lane-Fassung (29 529 B / 340 Z. / 3 von 7 Teilen,
  ~3 % eines GPT-Fensters, nicht die ~8 %, die die Brief-Checkliste nennt). Ein Sol-Builder
  ist daran korrekt stehengeblieben.
- **Das FleetEvent-Zustellbudget schliesst den Rueckkanal bei maximaler Koordination**
  (`notiz c89c18df`): eine MAIN mit 5 armed Watches hat null Budget. Steht woertlich schon auf
  `main:5313` fuer Clarifications — geerbt, nicht neu, und ein Entscheid, kein Bugfix.

## Was ich falsch gemacht habe

- **Ich habe einem Builder eine Regel weggewinkt, die ein Brief nicht waiven kann.** Mein
  Brief sagte "nie `CLAUDE.md` am Stueck lesen" gegen eine als *hard loader requirement*
  deklarierte Zeile in `AGENTS.md` — und meine ~8-%-Begruendung war gegen die falsche Datei
  gerechnet (Haupt-Checkout 62 678 B statt Lane-Fassung 29 529 B).
- **Ich habe dem Builder vier Sicherheits-Schranken woertlich diktiert, und eine war falsch.**
  Der PRE_AUTH-Eintrag behauptete "lane-only" auch fuer GET; GET ist dual-scoped. Der Critic
  hat es gefunden, der Builder hatte es korrekt umgesetzt — der Fehler war meiner.

# HANDOFF — ACP Project MAIN (Slot 3), 2026-08-20, ctx 31,7 % GEMESSEN

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Gebundene Project MAIN für Program `eeba7c04caae64d79969199b`. Vier Owner-Freigaben abgearbeitet:
Promotion + Deploy, gameStudio-Readiness, Act 3 gebaut/repariert/gelandet, Result-Rail geschnitten.
Kein eigener Produktcode. Die Nachfolge ist eine OWNER-ANWEISUNG, keine Schwellen-Übergabe —
31,7 % liegt deutlich unter den 44 %.

## Belegter Stand

- **`main` = `9fd1025`** (Act 3). Die Session hat main ausserdem von `e19c80f` auf den
  Integrationstip vorgezogen und das Haupt-Checkout auf `main` umgestellt — Fleet landet
  seitdem wieder auf `main` statt auf dem `docs/`-Zweig (`integrationBranch()` server.ts:3143
  fällt auf den Branch des Haupt-Checkouts zurück).
- **Act 3 gelandet und tier-2-grün.** Land-Note: `b4897ba` → `9fd1025`, verify `ok:true`,
  `exitCode 0`, `ms 99758`, `waitMs 0`, `confirmedByHuman:false` (clean auto-land).
  Post-Land-Audit `green`, **`ms 998782`, `ran 2755`, `failed 0`**, covers genau diesen einen Land.
- **DER LIVE-SERVER HAT ACT 3 NICHT.** `deployGap`: bootHead `8f31701`, head `9fd1025`,
  `behindCount 3`, **`codeBehind: true`**. Act 3 ändert `server.ts` (Confirm-Pfad) — der
  Identitäts-Guard ist also GEBAUT, aber NICHT AKTIV. Ein Deploy ist NICHT owner-freigegeben.
  Das ist der wichtigste offene Punkt.
- `b4897ba` ist ein Direkt-Commit aus dem Haupt-Checkout (Readiness-Messung) — für jedes
  land-seitige Ledger unsichtbar. Verifikation lief von Hand vollständig: volle Kette exit 0,
  fünfmal ALL PASS, danach `./e2e-isolated.sh` 2739 PASS / 0 FAIL, EINE run-id.
- Offene Attention: **keine**. `2e9e4207…` ist vom Owner mit „Ja" beantwortet.
- Zehn untracked Owner-Dateien im Haupt-Checkout: unangetastet, wie vom Vorgänger übernommen.
  Die drei fremden Worktrees ebenfalls — Owner-Anweisung.

## Freigegebene Reihenfolge für die Nachfolgerin

1. **Result-Rail `bbb2e53f`** (kind `auftrag`, `pending`, programgebunden). Sein hartes
   Gate — „nicht dispatchen, solange Act 3 nicht gelandet ist" — **ist jetzt erfüllt**. Der
   Brief steht vollständig in der Task; er verortet den Schnitt ausdrücklich in den
   BESTEHENDEN Acts 5/6 und verbietet ein zweites Objekt neben Clarification/Attention.
   Zwei Punkte gehören dem Owner und sind im Brief benannt: ob `attemptId` (Lifecycle) mit
   B–D (Transport-Symmetrie) in eine Lane geht, und ob der Rail je etwas gaten darf (dieser
   Schnitt sagt nein).
2. **Deploy-Entscheid für Act 3 einholen.** Siehe oben — nicht selbst entscheiden.
3. `ec9e85a6` (kind `notiz`) trägt den UI-/Faktschicht-Befund für Act 4 oder 7.

## Vier Befunde, die die Nachfolgerin braucht

- **Ein grüner Suite-Lauf beweist nur, was seine Fixtures anfassen.** Der Builder UND ich
  hatten je einen ehrlichen `./e2e-isolated.sh` mit 0 FAIL auf `b2809f5`; beide waren blind
  für einen echten Regress, weil `G1c` und der neue Fixture main in einer ANDEREN DATEI
  bewegen (`e2e/land-provenance.ts:457` schreibt `moved.txt`). Der frische read-only Critic
  fand ihn, weil er über das PRIMITIV nachdachte statt dem Lauf zu glauben:
  `git patch-id --stable` hasht Kontextzeilen mit. Reproduktion (Wegwerf-Repo): Lane-Edit
  byte-identisch, main bewegt eine Kontextzeile zwei Zeilen darüber, Rebase konfliktfrei,
  patch-id `ca7d66f2` → `780b5e99`. **Lehre: der Critic-Schritt in Acts 5–8 ist kein Zeremoniell.**
- **`awaiting`, `hot` und „läuft" sind heute EINE Darstellung für DREI Zustände**
  (arbeitet · vom Provider blockiert · wartet auf den Suite-Mutex). Der Klassifikator
  EXISTIERT bereits — `paneReadiness()` server.ts:4672 liefert ready|blocked|pending mit
  `why` —, ist aber nur Gate (server.ts:4692, :5784), nie projizierter Fakt, und seine
  `blocks`-Liste (server.ts:903-906) kennt nur Spawn-Zeit-Screens. Details: `ec9e85a6`.
- **Act 9 ist heute nicht messbar.** Von acht Grössen seines Proof hat keine einen
  vollständigen Sensor. Ursache: `lane-outcomes.jsonl` (der einzige reiche Per-Versuch-Ledger)
  entsteht am LANE-Ende, und die Studios laufen als MAIN-Sessions IN ihren Repos —
  300 Zeilen für claude-fleet, 1/1/1 für private-repo-c/private-repo-e/private-repo-i, 0 für
  private-repo-f/private-repo-g. Ganze Tabelle: `docs/messungen/2026-08-20-gamestudio-readiness.md`.
- **Drei Reste an der Act-3-Naht, bewusst offen gelassen** (in `0a4b1e38` als Kommentar
  `6448b326` festgehalten): `awaiting-author` bindet einen Tip, der sich nach der
  Autor-Auflösung zwingend ändert → Confirm 409, Verhalten korrekt aber ungetestet · der ff
  zielt auf den Branch-NAMEN statt die geprüfte `candidateSha`, ms-kleines TOCTOU-Fenster,
  **vor diesem Diff genauso offen, kein Regress** · `bindCandidate` hält den vollen
  `--binary`-Diff im Speicher, ungemessen.

## Was ich falsch gemacht habe

- **Eine Lane-Watch für einen read-only Critic wäre nie gefeuert.** `done-looking` verlangt
  `ahead>0`, ein Kritiker committet nie. Ich habe es rechtzeitig gemerkt und einen
  Hintergrund-Watcher auf Pane-Ruhe genommen — aber die Falle ist real und sieht von aussen
  wie „arbeitet noch" aus.
- **Zwei eigene Sonden waren falsch, nicht die Maschine.** Ein `grep '"repo": "'` über
  `lane-outcomes.jsonl` verfehlt Zeilen mit anderer JSON-Spationierung und meldete für alle
  fünf Spiele-Repos fälschlich Null (die geparsten Zahlen gelten). Und ein
  `$(git rev-parse master 2>/dev/null || git rev-parse main)` fing BEIDE Ausgaben ein und
  zerlegte meine erste patch-id-Reproduktion.
- **Ich habe „land it" empfohlen, als stünde die Entscheidung an.** Der Owner hat korrigiert:
  eine Empfehlung im Composer ist keine Autorität. Der Land kam erst nach ausdrücklichem „Ja"
  über die Attention-Route.
# HANDOFF — ACP Project MAIN (Slot 2), 2026-08-20, ctx ~40 %

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Gebundene Project MAIN für Program `eeba7c04caae64d79969199b` („Claude Fleet — Agentic Control
Plane Outside-in"). Koordination, kein eigener Produktcode: zwei Act-Briefs geschnitten, drei
Builder gebrieft, drei Schnitte integriert.

## Belegter Stand

- **Integrationstip `ad03d34`** auf `docs/kontextschicht-analyse-2026-08-20`. Gelandet in dieser
  Reihenfolge: ACP-02 Capability-Quelle → `7a91ef1`, ACP-01 UI-Grundbedienung → `4e4a70e`,
  ACP-X1 Composer-Autorität → `ad03d34`. Der Doku-Schnitt `92b96b3` war ein korrektes No-op.
- **Alle Post-Land-Audits grün** (ACP-02 16,7 min; ACP-01 und ACP-X1 je 2739 Checks / 0 Fehler).
  Belege in `git notes --ref=fleet/land`, nicht in Meldungen.
- **`main` steht weiter auf `e19c80f`.** Fleets Integrationszweig ist NICHT `main`:
  `integrationBranch()` liest `repoBases[repo]` (leer) und fällt auf den aktuellen Branch des
  Haupt-Checkouts zurück. Gelandet wird also auf `docs/kontextschicht-analyse-2026-08-20`.
- **Live läuft alter Code:** bootHead `0c59dd1`, 16 Commits zurück, `bundleStale: true`. Kein
  Deploy — nichts davon ist im Board sichtbar.
- Zehn untracked Owner-Dateien im Haupt-Checkout: unangetastet, vor und nach jedem Land geprüft.
- Keine laufende Suite, kein Merge, kein Audit, kein armer Watch beim Schreiben dieser Zeilen.

## Freigegebene Reihenfolge für die Nachfolgerin

1. **Promotion/Deploy sauber entscheiden und durchführen.** Offen ist beides: ob `main` auf den
   Integrationstip nachgezogen wird, und der Deploy selbst (`POST /api/deploy`, danach
   `bundleStale` auf `/api/sessions` prüfen). Der Vorgänger hat weder das eine noch das andere
   angefasst.
2. **Act 3 — Candidate-/Diff-Identität + reiner Policy-Faktensensor.** Ein Builder, Sol high
   (Server-/Lifecycle-Schnitt). Definition im Program Brief `3a9556e`/`92b96b3`: Verdikt bindet
   `LandCandidate` (mainSha, candidateSha/Lane-Tip, Verify-Lauf); Candidate-Wechsel macht das
   Verdikt stale und der Confirm-Pfad antwortet 409; die Projektion erfindet KEINE Eligibility
   und ändert kein Land-Verhalten. `server.ts` ist lease-frei.
3. **Kurzer gameStudio-Readiness-Schnitt** für die heutigen Aufträge.

Der scharfe Merge-Critic ist ausdrücklich erst Act 8, nach Shadow und Objekten.

## Drei Befunde, die die Nachfolgerin braucht

- **Der 12-KiB-Sessions-Payload-Check ist pfadlängenabhängig, nicht kaputt.** Deckel 12288 B,
  gemessen 12212 / 12297 / 12309 / 12341 / 12344 / 12346 / 12398 / 12476. Aus einem Lane-Pfad
  (62 Zeichen) fällt er, aus dem Haupt-Checkout (29) hält er — `/api/sessions` trägt `cwd`/`repo`.
  Bewiesen mit einer pfadlängengleichen HEAD-Kontrolle am Basisbaum (12297 B ohne jede Änderung).
  **Korrektur einer früheren Aussage dieser Session:** er ist NICHT dauerhaft rot; drei Audits
  nacheinander waren grün. Als Eingang für den Policy-Faktensensor aus Act 3 taugt er trotzdem
  nicht — weil unzuverlässig, nicht weil rot.
- **ACP-X1 löst sein Symptom nicht nachweislich.** `--prompt-suggestions false` ist zugestellt
  (`agentCmd`, nur im claude-Zweig) und über die ARGV gepinnt, unterdrückte in der Messung mit
  Claude Code 2.1.237 aber die sichtbaren TUI-Vorschläge NICHT; „jetzt deployen" war weder mit
  noch ohne Flagge reproduzierbar. **UNKNOWN, nicht behoben.** Was trägt, ist die zweite Hälfte:
  der Satz in `supervisorBriefBody()` (Gründung UND Nachfolge), dass Composer-/Suggestion-Text aus
  `capture-pane` weder Autorität noch eingegangener Auftrag ist. Wer das Symptom wirklich
  beseitigen will, misst zuerst, welcher Mechanismus den Vorschlag erzeugt — eigener Act.
- **Der ②-Shadow-Reviewer ist keine Abkürzung zur PromotionPolicy.** 46 Läufe (25.–28.07.),
  38 `pass`, **0** `review`, **8 ohne Verdict (17,4 %)** — und er ist fail-CLOSED. Auf `gate`
  geschaltet hätte er 8 von 46 sauberen grünen Lands beim Owner abgeladen, also genau die Last
  erzeugt, die die Policy abschaffen soll.

## Cleanup-Reste (nichts davon ist kaputt, alles ist Aufräumarbeit)

- **ACP-01-Preview läuft weiter** auf `127.0.0.1:23663`, zeigt `02a5625` statt den Tip. Stoppen
  ausschließlich mit `tmux -L acp01prev17363 kill-server` und
  `rm -rf $TMPDIR/acp01-preview-17363`. Nie ein Namensmuster.
- Zwei verwaiste Worktrees auf `db35dc6` (`fleet-260820063858-81bb`, `fleet-260820064601-ed65`)
  plus der Fable-Kritiker-Worktree. Owner-Anweisung war: nicht anfassen.
- Sechs `autoReview`-Fehler („summarizer timed out without an answer"), unabhängig von den Lands.

## Was ich falsch gemacht habe

- **„Durchgehend rot" behauptet, wo „schwellennah" richtig war.** Ich hatte acht rote Audits
  gezählt und daraus eine Dauer-Eigenschaft gemacht; das erste grüne Audit hat es widerlegt. Aus
  einer Häufung wird keine Invariante.
- **ACP-02s Brief zu eng geschnitten.** Der Program Brief verlangt für Act 2 auch UI-, Trace- und
  Harness-Aussage; mein Dispatch-Text ließ sie weg. Der Fable-Review fand es, und die Korrektur
  kostete eine Reparaturrunde, die der Worker nicht verschuldet hatte.
- **Das `done-looking`-Prädikat viermal als Weckinstrument benutzt, wo es flattert.** Eine Lane,
  die auf dem Suite-Mutex wartet, sieht identisch aus wie eine fertige. Für „Kette fertig" ist ein
  Hintergrund-Watcher auf die echte Bedingung richtig, für „Merge/Audit fertig" die
  `{kind:"merge"}`/`{kind:"audit"}`-Watches — die haben je genau einmal und korrekt gefeuert.

# HANDOFF — MainCF (Slot 5), 2026-08-19, ~8,8 h, ctx 48,1 % gemessen

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Zwei Stränge. (1) Owner-Frage „warum sind die Spiele nicht ambitioniert genug" → Kit v3 als
Vorschlag. (2) Supervisor-Auftrag Gamestudio-Refinement Teil 2 → Worktrail-Audit II, vier
Mess-Lanes.

## Der EINE offene Rest: Queue-Zeile `79f9fddb`

`[worktrail-audit-II] ZUSAMMENFUEHRUNG` — pending, kind `auftrag`, vollständig gebrieft
(Done-Kriterium + Verify-Weg + Verbote). **Dispatchen, sobald `private-repo-f.md` auf main liegt**
(Slot 15 / Task `4b4764ef` war beim Schreiben `ahead=1`, landet über s8).
Gelandet sind: `docs/worktrail-audit-II/{private-repo-h,private-repo-e,private-repo-c}.md`.

## Fünf Entscheidungen, die dem OWNER gehören — keine davon ist MAIN-Arbeit

1. **`FLEET_VERIFY_WAIT_MS` auf 45 min.** Es ist ein LITERAL in der tmux-Spawn-Zeile von
   `watchdog.sh` (nach dem `.env`-Sourcing, das Literal gewinnt; in `.env` steht es nicht).
   Reihenfolge zwingend: Datei ändern → `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`
   → DANN srv neu. Umgekehrt backt der alte Watchdog wieder 900000 ein (`watchdog.sh:112`
   spawnt srv nur bei fehlender Session).
2. **Kill auf die Prozessgruppe statt den Prozess** (Vorschlag in `00714c8`). Behebt eine andere
   Sache als (1) und wird durch (1) NICHT behoben.
3. **`/usage` in einer fremden Pane neu aufrufen?** Der einzige Kontingent-Sensor ist ein
   geparktes `/usage`-Modal auf Slot 15; der passive Watcher liefert fast immer `unknown`.
4. **Teil 1 des Refinement-Plans**: Verkostung der vier Spiele + 2–3 Referenzspiele je Studio,
   ausdrücklich OHNE Vorschlagsliste von uns.
5. **Kit v3 rev.2 promoten oder verwerfen** — liegt fertig unter `studio-kit/v3-proposed/`,
   einen `git mv` entfernt. Die Zwangsnaht (welches der drei Durchsetzungsorgane welche Zeile
   bekommt) steht in `docs/studio-kit-v3-vorschlag-2026-08-19.md` §4.

## Drei Befunde, die noch niemandem gehören

- **Ein Land kann auf drei Arten sterben, alle durch Warten:** `waitedOut` (nie gemessen) ·
  im Lock überholt (kein FIFO — gemessen 17:25, ein Dritter nahm die Lücke, während Slot 2 seit
  18,3 min anstand) · **verifiziert-aber-veraltet** (verify grün, dann `ff` unmöglich, weil main
  während der Schlange weiterzog — ZWEIMAL gemessen: s10 `ms 902 048 / waitMs 803 000`,
  s13 `ms 875 105 / waitMs 773 000`). Modus 3 ist der teuerste und verlängert die Schlange, die
  ihn verursacht hat. Auf FREIER Maschine dauert dasselbe Land 1,7–1,9 min (`waitMs 0` bzw. 15 s).
- **Der Sessions-Poll hat 8–76 Byte Restluft** bei 12 288 B Deckel, und **eine zusätzliche Lane
  kostet 510 B** (`a69b0f6`, drei serielle Läufe). Nicht das nächste Feld kippt den Check,
  sondern die nächste Lane. Der Land-Gate kann es strukturell nicht fangen: `e2e/tasks.ts`
  läuft nur in Tier 2.
- **Der Verify-Timer persistiert seine eigene Eingangsgröße nicht.** `waitedMs` (steuert `arm()`)
  und `waitMs` (nachträglicher Parser, geht auf den Datensatz) sind ZWEI Größen mit fast gleichem
  Namen; nur die zweite überlebt. Jede Wiederholung dieser Untersuchung endet darum in `unknown`.
  Befund des Supervisors, billiger Schnitt, gehört ins Programm `b3d042ec`.
  GEMESSEN und unstrittig: die Invariante `server.ts:9067` („at most WAIT+TIMEOUT") ist um
  302 783 ms verletzt; ein Gate arbeitete HÖCHSTENS 48 s und stand MINDESTENS 24 min an.

## Was ich falsch gemacht habe (damit es niemand wiederholt)

- **Zu viel selbst gemessen.** Panes gelesen, Sonden gedruckt, Fixtures debuggt, Prozessbäume
  verglichen. Das gehört in Wegwerf-Worker mit engem Brief; die Rolle einer MAIN ist Urteil und
  Reihenfolge. Der teuerste Posten der Session, nicht die Timer-Abzweigung.
- **Vier Messungen waren MEINE Sonde, nicht die Maschine:** ein `| tail -4` liess `$?` den Exit
  von `tail` lesen · ein `nohup … &` im Hintergrund-Bash meldete `exit 0` für die äussere Shell,
  während die Suite noch lief (0 PASS-Zeilen = nie gestartet) · eine Score-Sonde las
  `250 pts · needs 55% grip` als Punktestand · die Suche nach `acquired`-Zeilen lief im
  gedeckelten `verify.out`, während `suiteWait` über die VOLLE Ausgabe parst.
- **Absenz aus einer einzigen Grep-Schreibweise geschlossen** („private-repo-c ii" statt „zweiter
  Anlauf"/„bracket 2") und daraus einen falschen Befund gebaut.
- **Im `tasks`-Digest nach Volltext gesucht**, obwohl ich am selben Tag gelesen hatte, dass der
  Poll nur Digests trägt.

## Reihenfolge für die Nachfolge

1. `private-repo-f.md` landen lassen (läuft über s8), dann `79f9fddb` dispatchen.
2. Die Tabelle reviewen, landen, Audit ansehen.
3. Die fünf Owner-Entscheidungen NICHT selbst treffen — vorlegen.
