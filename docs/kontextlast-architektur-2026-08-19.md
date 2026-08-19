# Architektur der drei Kontextlast-Schnitte — Entwurf 2026-08-19

**Was diese Datei ist:** der Bauplan für die drei Schnitte, die
`docs/kontextachse-arbeitsschritt-2026-08-18.md` (`a317fc0`) §6 über der Schnittlinie führt.
Sie sagt, WAS gebaut wird, WER es baut und WORAN man sieht, dass es stimmt — je Schnitt so
scharf, dass eine Opus-5-Lane ihn ohne Rückfrage bauen kann.

**Was sie NICHT ist:** eine neue Messung. Die Zahlen aus `a317fc0` und
`docs/kontextlast-publikum-2026-08-18.md` (`0373459`) sind gegeben und werden hier nicht neu
hergeleitet. Umrechnung durchgehend **2,02 Byte/Token**.

**Was sie NICHT tut:** Code ändern. Kein Schnitt ist ausgeführt. Jede Änderung an Vokabular,
Regelbuch-Struktur, Kopier-Naht oder Env ist ein Owner-Akt (propose/promote).

**Alle Zeilenangaben sind an HEAD = `7811df5` neu gelesen**, nicht aus `a317fc0` übernommen:
`server.ts` ist seit jenem Commit um 140 Zeilen gewachsen, drei meiner eigenen Anker waren
verrutscht. Wer diese Datei später liest, ankert erneut — im Zweifel das Symbol suchen.

## 0. Der Befund, der die Reihenfolge bestimmt

Beim Ausarbeiten von B ist ein Blocker aufgetaucht, den weder `0373459` noch `a317fc0` kannte.
Er steht hier vorn, weil er die Reihenfolge der ganzen Kette bestimmt:

> **`rulebookDrifted` (`server.ts:16269-16275`) vergleicht die Lane-Kopie BYTEWEISE mit der
> Quelle. Bekommt eine Lane eine Teilmenge, ist das Feld dauerhaft `true` — und das Regelbuch
> schreibt der Lane für genau diesen Fall vor, die Regeln aus dem Quell-Checkout NACHZUZIEHEN.**

```ts
// server.ts:16271-16275  (gelesen an 7811df5)
const [src, copy] = await Promise.all([
  Bun.file(`${s.worktree.repo}/CLAUDE.md`).text(),
  Bun.file(`${s.cwd!}/CLAUDE.md`).text(),
]);
rulebookDrifted = src !== copy;
```

Die Regel dazu ist eine der 117 der Bedeutungs-Probe (`D14`) und steht im Lane-Teil, kommt also
in der Teilmenge mit. Ohne Anpassung baut Schnitt B ein Signal, das jede Lane auffordert,
genau die Bytes zu laden, die er gerade eingespart hat. **Der Schnitt hebt sich selbst auf.**
Das ist keine Kleinigkeit am Rand: es ist Bestandteil von B, nicht Folgearbeit.

## 1. Schnitt A — `landing`-Anker für den Merge-/Repair-Worker

### Was heute gilt

`runWorker(spec, prompt, cwd)` (`server.ts:7785`) nimmt keinen Plan. Die zwei mutierenden
Worker rufen ihn mit `MERGE_TOOLS` (`server.ts:9388` — `git rebase`, `git commit`, `Edit`,
`Write`): `server.ts:11170` (`merge`) und `server.ts:11267` (`repair`). Sie laden kein
Regelbuch (gemessen in `a317fc0` §5: 27 von 27 Worker-Sitzungen ohne `# claudeMd`-Block) und
bekommen keinerlei Landregeln. Der Trigger `landing` hat bis heute **keinen Konsumenten**.

### Die Bauform — und warum sie `runWorker` NICHT anfasst

**Der Plan wird an der AUFRUFSTELLE gerechnet und an den Prompt gehängt, nicht in `runWorker`
verdrahtet.** Das ist die ganze Entscheidung, und sie beantwortet die Frage „ohne dass die neun
anderen Worker etwas erben" durch Konstruktion statt durch ein Flag:

```ts
// an server.ts:11169 (merge) und server.ts:11266 (repair), unmittelbar vor dem runWorker-Aufruf
const landingPlan = planContext({
  sourceTree: await dispatchSourceTree(repoRoot),   // dieselbe Ableitung wie server.ts:6102 (Funktion :5980)
  harness: "claude",                                // MERGE_TOOLS ist der claude-Worker-Pfad
  mode: "mutating",
  triggers: ["landing"],
  capabilities: DISPATCH_CONTEXT_CAPABILITIES,      // server.ts:5968
});
const promptWithAnchors = `${prompt}${renderContextAnchorBlock(landingPlan)}`;
```

Fünf Eigenschaften, jede geprüft:

1. **Keine Signaturänderung.** `WorkerSpec` (`server.ts:7746-7756`) bleibt unberührt; kein
   anderer Worker kann etwas erben, weil es nichts zu erben gibt.
2. **Die Markenprüfung überlebt.** `runWorker` wirft, wenn der Prompt seine Kontrakt-Marke
   nicht trägt (`server.ts:7792`, `prompt.includes(contract.mark)`). Anhängen ist sicher:
   ein Suffix entfernt kein Substring.
3. **Der Renderer ist wiederverwendet, nicht kopiert.** `renderContextAnchorBlock`
   (`server.ts:6150`) liefert `""` bei leerer Auswahl — ein Baum ohne die Quellen bekommt
   also schlicht nichts angehängt, kein Sonderfall.
4. **Die Kosten sind gemessen: 244 B ≈ 121 Tokens** je Lauf (`a317fc0` §5, ausgeführt).
   Gewählt wird `land-mechanics` → `AGENTS.md §Landing` + `docs/land-mechanics.md`.
5. **`harness` ist hier literal `"claude"` und das ist korrekt, nicht faul:** dieser Pfad
   läuft über `WORKER_HARNESS.worker`, dessen Kommandozeile literal `claude` startet,
   unabhängig von `FLEET_CMD`. `land-mechanics` deklariert `harnesses: ["claude",
   "pi-unfenced"]` (`context-packs.ts:130`) — ein durchgereichter fremder Harness würde den
   Anker fälschlich als `harness-unsupported` auslassen.

### Der Pin — ergänzen, nie aufweichen

`e2e/context-plan.ts:29-32` behauptet, die Zustellung wähle genau `portable-core,verify-e2e`
und die vier Auslassungen trügen alle `trigger-not-matched`. **Dieser Check gilt dem
SITZUNGS-Pfad und bleibt wörtlich stehen.** A bekommt einen eigenen, danebenstehenden Check:
der Worker-Pfad wählt genau `land-mechanics`, und `portable-core`/`verify-e2e` werden dort
mit `trigger-not-matched` ausgelassen. Zwei Checks, zwei Aussagen — wer einen davon aufweicht,
wird vom anderen gestellt.

### Was A bewusst NICHT tut: keine Quittung

Der Merge-Worker schreibt **keine** Zeile auf `context-receipts.jsonl`. Begründung, nicht
Vergesslichkeit: die Quittung ist sitzungsförmig (`slot`, `branch`, `taskId`) und `briefSource`
ist ein fünfwertiges, gepinntes Vokabular (`compiled|owner|raw|clarify|founding`, seit
`735aa45`). Ein Worker hat keinen Slot; eine Zeile mit `taskId:null` fiele bei `briefstats.ts`
in denselben Eimer wie die `founding`-Zeilen (dort ausdrücklich als „join nichts by
construction" behandelt) und würde als Gründung fehlgelesen. Ein sechster Herkunftswert ist
eine Vokabular-Änderung und damit ein Owner-Akt. **Beobachtbar ist der Anker trotzdem** — er
steht im Transkript des Merge-Workers, das der Host ohnehin liest. Als eigener kleiner Schritt
benannt, unter der Schnittlinie in §5.

## 2. Schnitt B — Regelbuch-Aufteilung an der Kopier-Naht

Der große Posten: **~19.000 Tokens je Lane** (`0373459` §6). Und der harte Teil, weil vier
Randbedingungen gleichzeitig gelten.

### 2.1 Die Naht braucht KEINEN neuen Parameter

`createWorktree(repoRaw, branchRaw, form)` (`server.ts:3748`) kennt weder Task noch Harness
noch Trigger. Das sah in `a317fc0` §2.2 wie ein Hindernis aus und ist bei B keines:

> **Jeder Worktree, den diese Funktion erzeugt, IST eine Lane.** Das Publikum ist an dieser
> Naht konstant. Es muss nicht übergeben werden, es steht fest.

Damit ist B eine Änderung an EINER Schleife (`server.ts:3796`), nicht an einer Signatur:

```ts
// server.ts:3796 heute
for (const f of [".env", "CLAUDE.md", "OWNER.md", ".claude/settings.local.json"]) {
```
`CLAUDE.md` verlässt diese Liste und bekommt daneben einen eigenen Zweig, der die
Lane-Fassung SCHREIBT statt kopiert. `.env`, `OWNER.md` und `settings.local.json` bleiben
unangetastet.

### 2.2 Die Bauform: Fragmente + reiner Renderer

**Quelle der Wahrheit sind sieben Fragmentdateien, nicht mehr eine Datei.** Verzeichnis
`rulebook/` im Haupt-Checkout, **gitignored wie `CLAUDE.md` selbst** — das Regelbuch trägt die
echte Host-IP an mehreren Stellen und darf in kein öffentliches Repo. Die Aufteilung ist keine
neue Erfindung: die Bedeutungs-Probe (`docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md`,
`7b5df89`) hat sie bereits, ihr id-Präfix IST die Sektion. Nachgezählt:

| Fragment | Präfix | Regeln | Bytes | Lane | MAIN |
|---|---|---:|---:|:-:|:-:|
| `loader.md` | L | 4 | 2.166 | **ja** | ja |
| `einstieg.md` | E | 26 | 14.879 | nein | ja |
| `lane-discipline.md` | D | 48 | 21.520 | **ja** | ja |
| `supervisor.md` | S | 4 | 1.497 | nein | ja |
| `self-scheduling.md` | F | 8 | 5.556 | **ja** | ja |
| `deploy.md` | P | 26 | 14.957 | nein | ja |
| `graphify.md` | G | 1 | 1.232 | nein | ja |
| | | **117** | **61.807** | **29,2 KB** | 61,8 KB |

Ein **reiner** Renderer `rulebook.ts` — keine fs-, git-, env- oder Netz-Lesung, er bekommt die
Fragmentinhalte und gibt Text zurück, genau wie `context-plan.ts` und `verify-proportion.ts`
gebaut sind:

```ts
export const RULEBOOK_AUDIENCES = ["lane", "main"] as const;
export const RULEBOOK_FRAGMENTS = ["loader","einstieg","lane-discipline",
  "supervisor","self-scheduling","deploy","graphify"] as const;
export const FRAGMENTS_FOR: Record<RulebookAudience, readonly RulebookFragment[]> = {
  lane: ["loader", "lane-discipline", "self-scheduling"],
  main: [...RULEBOOK_FRAGMENTS],
};
export function renderRulebook(audience, contents: Map<RulebookFragment, string>): string
```

Drei Konsequenzen, alle Absicht:

- **`renderRulebook("main")` ist die Identität** — dieselben Bytes wie heute, in derselben
  Reihenfolge. **MAIN und Supervisor verlieren in Schnitt B nichts.** Der Supervisor-Teil ist
  ausdrücklich NICHT hier drin (§2.5).
- **`CLAUDE.md` im Haupt-Checkout wird ein GENERAT.** Wer künftig eine Regel ändert, ändert ein
  Fragment und rendert neu. Eine Hand-Änderung an `CLAUDE.md` würde beim nächsten Rendern
  verloren gehen — deshalb §2.4.
- **Jede Regel steht in genau EINEM Fragment.** Partition, nicht Überdeckung. Damit gibt es
  nie zwei Fassungen derselben Regel, und der Loader-Vertrag (der bei einem echten Widerspruch
  die Arbeit stoppt) bekommt keine neue Widerspruchsfläche. **Das ist die Bedingung, an der B
  hängt** — wer eine Regel „sicherheitshalber" in zwei Fragmente schreibt, hat den Grund
  zerstört, warum die Zerlegung billiger ist als der Monolith.

### 2.3 Der Blocker aus §0, repariert

`rulebookDrifted` vergleicht künftig gegen die SOLL-Bytes dieser Lane, nicht gegen die Quelle:

```ts
// server.ts:16271-16275, neu
const copy = await Bun.file(`${s.cwd!}/CLAUDE.md`).text();
const expected = await renderRulebookAt(s.worktree.repo, "lane");  // liest rulebook/ im Quell-Checkout
rulebookDrifted = expected === null ? null : expected !== copy;
```

Die Dreiwertigkeit bleibt exakt erhalten und ist hier wichtiger als vorher: `null` heißt
weiterhin „nicht vergleichbar" und **nie** „kein Drift" (Regel `D14`). Neu ist ein zweiter
`null`-Grund — das Quell-`rulebook/` fehlt (fremdes `task.repo`) — und er fällt in dieselbe
Aussage. Die Sonde wird durch B **genauer**, nicht schwächer: sie beantwortet ab dann „hat sich
die Quelle bewegt, seit deine Fassung erzeugt wurde", was die Frage ist, die eine Lane wirklich
hat (`docs/ungoverned-artifacts.md` §3 misst genau diese Drift: der Steward lief einmal neun
Zeilen hinterher, mit falscher Verify-Zeile).

### 2.4 Die Bedeutungs-Probe — sie bricht nicht, sie bekommt eine Spalte

Der Bestand: 117 Regeln, je mit `Ort` (heute durchweg **C** = „muss in `CLAUDE.md` selbst
stehen") und einem formulierungsfesten Kern-Muster; 117/117 bestanden, und die Baseline vor dem
Schnitt war ebenfalls grün, die Probe misst also wirklich.

Die Erweiterung ist mechanisch, nicht redaktionell:

1. Eine Spalte `Fragment` — **sie kommt aus dem id-Präfix**, für alle 117 Zeilen ohne
   Einzelurteil.
2. Der Ort-Wert `C` wird gelesen als „in dem Fragment, das der id-Präfix nennt".
3. Die Probe lautet danach: *für jede der 117 Regeln ist ihr Kern-Muster in genau einem
   Fragment auffindbar, und dieses Fragment ist in `FRAGMENTS_FOR[a]` für jedes Publikum `a`,
   dem die Regel gilt.* Das ist derselbe Test mit erweitertem Suchraum plus einer
   Eindeutigkeitsprüfung, die es vorher nicht brauchte.
4. Zusätzlich, und das ist neu und billig: **`renderRulebook("main") === CLAUDE.md`** ist eine
   Byte-Gleichheit. Die Runde-2-Probe musste 117 Muster suchen, weil es keinen Renderer gab;
   für MAIN wird sie zu einem Vergleich.

**Eine Ehrlichkeit dazu:** dieser Vergleich ist in einer LANE nicht fahrbar. `rulebook/` ist
gitignored, ein Worktree materialisiert nur getrackte Dateien, das Verzeichnis existiert dort
also nie. Der Pin muss deshalb **als er selbst scheitern**, wenn seine Voraussetzung fehlt —
ein eigener `check()` auf „`rulebook/` ist lesbar", nie ein stilles Grün. Das ist wörtlich die
Regel aus `CLAUDE.md` §Lane discipline über Sonden, die nicht laufen konnten.

### 2.5 Der Rückweg — was eine Lane tut, die doch eine Deploy-Regel braucht

Die Lane-Fassung endet mit einem erzeugten Block, der die weggelassenen Fragmente NAMENTLICH
nennt und den Lesebefehl mitliefert:

```
## Was in dieser Fassung NICHT steht
Du hast die Lane-Fassung des Regelbuchs (3 von 7 Teilen). Nicht enthalten:
Einstieg · Supervisor-Rolle · Deploy · graphify.
Brauchst du einen davon:  cat /Users/owner/claude-fleet/rulebook/deploy.md
Erzeugt aus rulebook/ am <ISO-Zeit>, Quell-Hash <sha256-8>.
```

Drei Gründe für genau diese Form:

- **Der absolute Pfad wird beim Erzeugen eingesetzt** (der Server kennt `s.worktree.repo`),
  nicht geraten. `git show main:rulebook/…` ginge NICHT — die Dateien sind untracked. Der
  Dateisystem-Lesezugriff auf den Haupt-Checkout ist erlaubt: die Worktree-Isolation deckt
  Schreibzugriffe auf Repo-Dateien, und das Regelbuch liegt in demselben Repo-Verzeichnis.
- **Die weggelassenen Teile werden BENANNT, nicht verschwiegen.** Eine Lane, die nicht weiß,
  dass es einen Deploy-Teil gibt, kann ihn nicht anfordern — das wäre der eine Weg, wie dieser
  Schnitt echten Schaden anrichtet.
- **Zeitstempel und Quell-Hash** machen die Alterung der Kopie sichtbar, ohne dass jemand
  fragen muss (`docs/ungoverned-artifacts.md` §5 Punkt 3 empfiehlt genau das und zieht es
  einem Überschreiben mitten im Flug ausdrücklich vor).

### 2.6 Was NICHT zu B gehört

- **Der Supervisor-Schnitt.** Er läuft in `claude-fleet.worktrees/steward` und wird nicht von
  `createWorktree` erzeugt; `0373459` §7(b) parkt ihn ausdrücklich als eigenen Schritt. B
  liefert ihm mit `FRAGMENTS_FOR` die Maschinerie, benutzt sie aber nicht.
- **Ein Backup-Mechanismus.** `docs/ungoverned-artifacts.md` §4 stellt fest, dass die
  untrackte Schicht kein Netz hat. B **vergrößert das Problem nicht** (sieben untrackte
  Dateien statt einer, dieselbe Schicht), löst es aber auch nicht. Getrennt lassen.
- **Verdichten.** B verschiebt Bytes, es schreibt keine Regel um. Verschieben ist verlustfrei
  und prüfbar; Verdichten kann Bedeutung verlieren, ohne dass ein Gate es merkt.

## 3. Schnitt C — die 885 B Fehlablage

`CLAUDE.md:351-356` (`./state.sh`, 580 B) und `:379-381` (Steward-Konvention, 305 B) stehen in
`## Lane discipline`, obwohl beide eine Lane nichts angehen. In der Fragment-Welt heißt C:
diese zwei Regeln ziehen von `lane-discipline.md` nach `einstieg.md`. **C ist damit kein
eigener Schnitt mehr, sondern zwei Zeilen der B-Migration** — und die Bedeutungs-Probe fängt
den Umzug ab, weil ihre Kern-Muster dann in einem anderen Fragment stehen müssen.

Vor B allein ausgeführt wäre C eine Handänderung am gitignorierten Monolithen ohne Netz. **Also
nicht vorziehen.**

## 4. Reihenfolge und Abhängigkeit

```
A  ──────────────────────────────►  unabhängig, jederzeit
                                     (andere Naht, andere Bytes, kein gemeinsamer Zustand)

B1 Fragmente + Renderer + Probe ──► B2 Kopier-Naht + rulebookDrifted ──► C (im Zug von B1)
   kein Verhaltens-Effekt              hier wirkt der Schnitt
```

- **A und B sind unabhängig.** A fasst `runWorker`s Aufrufstellen an, B die Kopier-Naht und die
  Gate-Route. Kein gemeinsamer Zustand, keine Reihenfolge.
- **B1 vor B2, und B1 ist folgenlos:** Fragmente anlegen, Renderer bauen, `CLAUDE.md` als
  `renderRulebook("main")` reproduzieren, Probe erweitern. Solange die Kopier-Naht unberührt
  ist, ändert sich **kein** Verhalten — die Byte-Gleichheit gegen den heutigen Monolithen ist
  der Beweis, dass B1 verlustfrei war.
- **B2 ist der einzige Schritt mit Live-Wirkung** und enthält den `rulebookDrifted`-Fix
  zwingend mit. Beides in EINER Lane, nie getrennt landen: eine Zwischenlandung, bei der die
  Naht schneidet und die Sonde noch byteweise vergleicht, ist genau der Zustand aus §0.
- **C fährt in B1 mit.**

## 5. Rangliste mit Schnittlinie

**Die Owner-Vorgabe, wörtlich** (`HANDOFF.md` §1, 2026-08-18): „Aber ich denke das wir hier
noch etwas rausholen können indem wir wichtiges besser, effizienter und kompakter machen. Da
muss ja noch einiges gehen irgendwie, interessant wäre auch wie die claude fleet eigenen
Kontext aufteilung uns hier hilft.."

| # | Schnitt | Ertrag | Lanes | Risiko |
|---|---|---|---|---|
| 1 | **B1** Fragmente + Renderer + erweiterte Probe (+C) | 0 Tokens, aber Voraussetzung für alles | 1 | niedrig — folgenlos, Byte-Gleichheit beweist es |
| 2 | **B2** Kopier-Naht + `rulebookDrifted` | **~19.000 Tokens/Lane** | 1 | mittel — einziger Schritt mit Live-Wirkung |
| 3 | **A** `landing`-Anker am Merge-/Repair-Worker | +244 B je Lauf; schließt die Regelwerk-Lücke des einzigen mutierenden Worker-Pfads | 1 | niedrig — kein Signaturwechsel |

— **SCHNITTLINIE**, hier ist die Vorgabe erfüllt —

4. **Worker-Quittung** für A (sechster `briefSource`-Wert). Vokabular-Änderung, Owner-Akt,
   und der Anker ist ohnehin im Worker-Transkript sichtbar.
5. **Supervisor-Fassung** (`FRAGMENTS_FOR.supervisor`). Die Maschinerie entsteht in B1, der
   Schnitt gehört der Publikums-Linie (`0373459` §7b).
6. **Backup der untrackten Schicht.** Real (`docs/ungoverned-artifacts.md` §4), von B weder
   verschlimmert noch gelöst, eigene Frage.
7. **`OWNER.md` (15.023 B)** wird mitkopiert (`server.ts:3796`) und ist nirgends
   inventarisiert. Erst messen, ob es überhaupt lädt, dann entscheiden — sonst wäre es
   Arbeit an einer ungemessenen Fläche.

## 6. Die drei Lane-Briefe

### Lane 1 — B1 (Fragmente, Renderer, Probe, C)

```
[fleet lane] B1: Regelbuch in Fragmente zerlegen — verlustfrei, ohne Verhaltensänderung.

Lies zuerst: docs/kontextlast-architektur-2026-08-19.md §2.2 und §2.4 (dein Bauplan),
docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md (die 117 Regeln, id-Präfix = Sektion),
context-plan.ts und verify-proportion.ts (die Bauform eines reinen Moduls in diesem Repo).

Bau:
1. rulebook/ im Haupt-Checkout, sieben Fragmente nach §2.2. Trage rulebook/ in .gitignore ein
   — das Regelbuch enthält die echte Host-IP und darf nie ins public Repo.
2. rulebook.ts: rein, keine fs/git/env/Netz-Lesung. RULEBOOK_AUDIENCES, RULEBOOK_FRAGMENTS,
   FRAGMENTS_FOR, renderRulebook(audience, contents).
3. C mit erledigen: CLAUDE.md:351-356 (./state.sh) und :379-381 (Steward-Konvention) wandern
   von lane-discipline.md nach einstieg.md.
4. Die Bedeutungs-Probe um die Fragment-Spalte erweitern (aus dem id-Präfix, kein
   Einzelurteil) und als e2e-Check fahrbar machen.

VERBOTEN: die Kopier-Naht (server.ts:3796) anfassen — das ist B2. Keine Regel umschreiben,
nur verschieben. Kein Fragment darf eine Regel doppelt führen (Partition, §2.2).

ACHTUNG, das ist die Falle dieser Lane: CLAUDE.md ist GITIGNORED. Deine Änderung erscheint
nie in git status und stirbt mit dem Worktree. Lege VOR dem ersten Eingriff eine Sicherung
außerhalb des Baums an (cp ~/claude-fleet/CLAUDE.md ~/claude-fleet-rulebook-backup-<stamp>.md)
und melde die Fragment-Inhalte im Bericht als TEXT, damit sie von Hand nachgezogen werden.

DONE: `renderRulebook("main", <die sieben Fragmente>)` ist BYTEGLEICH mit dem heutigen
CLAUDE.md (61.822 B). Das ist der Beweis, dass nichts verloren ging — zeig den Vergleich.
Und: die erweiterte Probe meldet 117/117 mit eindeutigem Fragment je Regel.
Verify: bun install --frozen-lockfile && bun e2e/pins.ts  → Tail ALL PASS.
```

### Lane 2 — B2 (Kopier-Naht + Drift-Sonde), erst nach Lane 1

```
[fleet lane] B2: die Lane-Fassung wird geschrieben statt kopiert — der Schnitt wirkt hier.

Lies zuerst: docs/kontextlast-architektur-2026-08-19.md §0, §2.1, §2.3, §2.5.
§0 ist nicht Kontext, sondern Bestandteil deines Auftrags.

Bau:
1. server.ts:3796: CLAUDE.md verlässt die Kopierliste und bekommt einen eigenen Zweig, der
   renderRulebook("lane") in die Lane schreibt. .env, OWNER.md, settings.local.json bleiben.
2. Der Rückweg-Block nach §2.5 wird angehängt: weggelassene Fragmente NAMENTLICH, absoluter
   Lesepfad (aus s.worktree.repo eingesetzt, nicht geraten), Zeitstempel, Quell-Hash.
3. server.ts:16271-16275: rulebookDrifted vergleicht gegen renderRulebook("lane") statt gegen
   die Quelldatei. Die Dreiwertigkeit bleibt: null heißt „nicht vergleichbar", NIE „kein
   Drift". Fehlendes rulebook/ im Quell-Checkout ist ein null-Grund, kein true.

BEIDES IN DIESEM EINEN LAND. Naht ohne Sondenfix ist der Selbstaufhebungs-Zustand aus §0.

VERBOTEN: Fragmentinhalte ändern (das war Lane 1). Kein Regelbuch umschreiben.

DONE: eine frisch erzeugte Lane trägt 3 von 7 Fragmenten (~29,2 KB statt 61,8 KB), ihr
Rückweg-Block nennt die vier fehlenden namentlich, und GET /api/self/gate meldet ihr
rulebookDrifted:false. Zeig alle drei.
Verify: die volle Kette aus CLAUDE.md §Lane discipline — du fasst server.ts an, also
zusätzlich ./e2e-isolated.sh als Vorschau, Ausgabe in eine Log-Datei, Tail zitieren.
```

### Lane 3 — A (`landing`-Anker), unabhängig, jederzeit

```
[fleet lane] A: der Merge-/Repair-Worker bekommt die Landregeln, die er nie hatte.

Lies zuerst: docs/kontextlast-architektur-2026-08-19.md §1 (Bauplan samt Code-Skizze),
context-plan.ts (ganz, 111 Z.), context-packs.ts:119-136 (das land-mechanics-Pack),
server.ts:11155-11175 und :11255-:11270 (deine zwei Aufrufstellen),
server.ts:7785-7795 (runWorker — du änderst ihn NICHT), e2e/context-plan.ts (ganz).

Bau: an beiden Aufrufstellen den Plan rechnen und renderContextAnchorBlock(plan) an den
Prompt hängen, vor dem runWorker-Aufruf. triggers:["landing"], mode:"mutating",
harness literal "claude" (Begründung §1 Punkt 5 — ein durchgereichter fremder Harness ließe
den Anker fälschlich als harness-unsupported aus), capabilities aus
DISPATCH_CONTEXT_CAPABILITIES (server.ts:5968).

VERBOTEN: WorkerSpec (server.ts:7746) ändern — kein anderer Worker darf etwas erben.
Den bestehenden Pin e2e/context-plan.ts:29-32 aufweichen — er gilt dem Sitzungs-Pfad und
bleibt wörtlich stehen. Eine Quittung schreiben — begründet ausgeschlossen, §1 letzter Absatz.

DONE: ein neuer Check neben dem bestehenden beweist, dass der Worker-Pfad genau
`land-mechanics` wählt und portable-core/verify-e2e dort mit `trigger-not-matched` auslässt;
der bestehende Check ist unverändert grün. Zeig beide Checkzeilen.
Verify: bun install --frozen-lockfile && bun e2e/pins.ts, dann ./e2e-isolated.sh (du fasst
den Merge-/Land-Pfad an — das ist ein benannter Auslöser), Ausgabe in Log-Datei, Tail zitieren.
```

## 7. Nicht geprüft

- **Ob `renderRulebook("main")` heute wirklich byte-gleich herauskommt.** Das ist das
  Done-Kriterium von Lane 1, kein Befund von mir — ich habe die Fragmentgrenzen aus den
  Sektionsgrenzen abgeleitet (Summe 61.807 B + 16 B Präambel = 61.823 gegen 61.822 Dateigröße,
  Differenz = fehlende Schluss-Newline), aber die Dateien nicht erzeugt. **INFERRED.**
- **Ob die drei „teils"-Zellen aus `0373459` §4 (Lane discipline für MAIN, Einstieg für
  Supervisor, Self-scheduling für Lane) bei Fragment-Granularität sauber aufgehen.** Für die
  hier gebaute Zerlegung ist das gleichgültig — MAIN bekommt alles, die Lane bekommt drei
  ganze Fragmente. Für die Supervisor-Fassung (unter der Schnittlinie) ist es die offene
  Frage. **NOT BUILT**, und die Suche wäre: je Regel der 26 E- und 8 F-Zeilen entscheiden.
- **Der Mechanismus, warum Worker-Sitzungen `CLAUDE.md` nicht laden.** In 27 von 27 Fällen
  beobachtet (`a317fc0` §5), Ursache nicht isoliert. Für A ohne Belang — A gibt dem Worker
  ZEIGER, keine Regelbuch-Bytes —, aber wenn sich das Verhalten je ändert, ändert sich A's
  Nutzen.
- **`OWNER.md`.** 15.023 B, wird mitkopiert (`server.ts:3796`), lädt womöglich ungefragt und
  ist in keiner der beiden Messungen inventarisiert. Bleibt offen, benannt seit `a317fc0` §7.
- **Ob eine Lane den Rückweg je benutzt.** Es gibt keine Lese-Seite: nichts hält fest, ob ein
  Zeiger geöffnet wurde (`HANDOFF.md` §1). Der Rückweg ist damit eine Behauptung über
  Zumutbarkeit, keine gemessene Größe — der billigste Weg, das zu prüfen, wäre eine
  `grep`-Zählung auf `rulebook/` in den Lane-Transkripten nach dem ersten Monat.
