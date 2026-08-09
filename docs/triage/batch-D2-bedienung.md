# Triage-Batch D2-bedienung — Board: Bedienung, Interaktion, Mobil

**10 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**

---

## `16d5e973`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Der Messbefund haelt: beide window-keydown-Handler (src/client.ts:821 und :2947) behandeln ausschliesslich Escape, altKey hat 0 Treffer, metaKey nur picker-/editor-lokal (:338/:342 Terminal-Copy, :4225 Editor-Save, :4365/:4366 Picker) — es gibt heute keine globale Tastaturschicht; showSlot() (:2931), src/shell.ts und #sidefoot existieren, und der Hinweis auf gitignorierte public/*.js stimmt (.giti
- Analyst sagt kollidiert mit: 6440c392, 34205199, f551f930, 5aafbee4, 1cb6778e, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-A+D 08-07] TITEL: Tastatur-Schicht — globale Kuerzel plus (Cmd/Ctrl)+K-Kommandopalette
WAS: Slot 1-9 fokussieren, Queue/Aktivitaet/Board oeffnen, ins Compose springen (Alt+1..9, Alt+Q/A/B, Alt+Enter) — und darueber eine K-Palette, die alles erreicht: Slots nach Label/Repo/Branch, Fenster, Queue-Zeilen nach Text, Repos, haeufige Aktionen. Heute ist das einzige globale Kuerzel der App Escape (beide Scouts unabhaengig gemessen: window-keydown-Handler behandeln nur Escape, src/client.ts:754, 2695; altKey 0x; metaKey nur Picker/Editor-lokal 3971/3972/3845).
WERT: Das Board ist auf ~8 Slots, sieben Overlays und ein Fenster-Shell gewachsen, Navigation ist ausschliesslich Maus. Das beruehrt jede Sitzung, mehrfach pro Minute.
SKIZZE: (1) Kuerzel: ein Handler neben dem Escape-Listener; Alt+1..9 -> showSlot(n) (existiert), Alt+Q/A/B, Alt+Enter -> Fokus #input; harte Bedingung: nichts feuern, waehrend xterm-Textarea/<input>/contenteditable den Fokus hat oder Live-Typing an ist — sonst frisst das Board Tastendruecke der Session. Kuerzel-Zeile in #sidefoot (public/index.html:1206 hat das Muster). (2) Palette: Kommandoliste aus vorhandenem Zustand (slots, Fenster-Oeffner, tasks aus dem Queue-Poll), keine neue Route, kein neuer Poll; src/shell.ts liefert Fenster-Chrome + Listen-Tastaturnavigation; capture-phase-Listener mit derselben Fokus-Grenze. FILES: src/client.ts (oder src/palette.ts neben shell.ts), public/index.html. Achtung Bau-Risiko (kein Revert-Risiko): public/*.js sind gitignorierte Artefakte — ohne bun run build ist die Palette nach dem Land unsichtbar.
AUFWAND: M-L (Kuerzel M, Palette M — als eine Lane bauen, gleiche Fokus-Grenze) REVERT: trivial — reiner Client, kein Zustand, kein Server.
GEPRUEFT: von beiden Scouts unabhaengig; keine Register-Zeile nennt Tastatur/Shortcuts/Palette; §7 unberuehrt.
PROVENIENZ: Merge aus Scout A Block 4 + Scout D Block 4 — Reports beim Owner.
```

## `34205199`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Der Befund traegt: grep 'theme:' in src/client.ts hat genau einen Treffer mit genau zwei Feldern (background #141414 / foreground #d8d8d8) im Terminal({…})-Aufruf, die 16 ANSI-Slots fallen also auf xterm-Defaults zurueck; das Haus-Vokabular existiert als Tokens in public/index.html:251-252 (--accent #7aa2f7, --amber #e0af68, --add #9ece6a, --del #f7768e) plus #7dcfff/#bb9af7 in vielen Regeln. Rein
- Analyst sagt kollidiert mit: 6440c392, f551f930, 5aafbee4, 1cb6778e, 16d5e973, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-C 08-07] TITEL: Die 16 ANSI-Farben des Terminals ans Haus-Vokabular binden
WAS: Heute setzt der Client am xterm nur zwei Farben — theme: { background: "#141414", foreground: "#d8d8d8" } (src/client.ts:258). Alles andere (rot, grün, gelb, blau, magenta, cyan und ihre
Bright-Varianten) fällt auf xterms eingebaute Defaults zurück. Claudes TUI malt aber fast alles in ANSI: Diffs, Tool-Namen, Fehler, Spinner. Danach spricht der Terminalinhalt dieselbe Farbsprache
wie der Rahmen um ihn herum.
WERT: Der Terminal ist ~90 % der Bildfläche und der einzige Teil des Boards, der NICHT zum Design gehört. Die App hat ein durchgezogenes, in Kommentaren dokumentiertes Vokabular — #9ece6a
grün/fertig, #e0af68 amber/Aufmerksamkeit, #f7768e rot, #7aa2f7 Akzent, #7dcfff cyan, #bb9af7 purple (u. a. index.html:678-683, 1047-1055). Genau diese sechs sind auch die ANSI-Slots. Das ist der
billigste denkbare Kohärenzgewinn: ein Objektliteral gegen die halbe Netzhaut.
SKIZZE: Ein TERM_THEME-Konstante neben RECENT_MS mit den 16 Slots + cursor/cursorAccent/selectionBackground, gefüllt aus den bereits benutzten Hexwerten; im Terminal({…})-Aufruf
(src/client.ts:254-259) statt der zwei Felder. selectionBackground ist der zweite stille Gewinn — heute ungesetzt, also xterm-Default gegen #141414. Sichtprüfung: eine Session mit git diff + einem
Fehler-Output nebeneinander vorher/nachher. FILES: src/client.ts (eine Konstante + ein Feld).
AUFWAND: S
REVERT: Trivial. Reiner Render-Parameter, kein Zustand, keine Persistenz, kein Server. Ein git revert und der nächste Reload malt wieder Defaults.
GEPRÜFT: grep -n "theme:" src/client.ts → genau ein Treffer (Z. 258), zwei Felder. Kein Register-Eintrag nennt xterm/ANSI/Terminalfarben (register.sh-Liste vollständig gelesen). §7 nennt nichts
Visuelles.

PROVENIENZ: Ideen-Scout C (Lane fleet/260806222333-fd17, 2026-08-07), Block 1 — Vollreport beim Owner.
```

## `5d55bcfc`  ·  kind=lane  ·  angelegt 2026-08-07 08:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Bounded, additive CSS in one file with a done-criterion the repo can check: git diff --name-only = public/index.html only, one @media (prefers-reduced-motion: no-preference) block containing all four rules, then the standing gate chain. Every substantive measurement verifies against the tree: grep -c "transition:" public/index.html = 1 (the #side drawer), exactly two keyframes (paneflash :137-138,
- Analyst sagt kollidiert mit: c8e2ddd7, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-C 08-07] Ein Bewegungs-Vokabular — und die prefers-reduced-motion-Klausel, die dem Board fehlt

WAS: Das ganze Board hat zwei Keyframes (paneflash 0,6 s beim Pane-Wechsel, workpulse am Board-Arbeitsindikator) und eine Transition (der Mobile-Drawer). Alles andere schnappt: Hover, Selektion, Stapel auf/zu, Overlays. Die Gästeseiten sind hier weiter — share.html und landing.html haben beide prefers-reduced-motion-Klauseln, index.html hat null.

WERT: Bewegung ist hier kein Schmuck, sondern Kausalität: wenn ein Stapel aufklappt und drei Rows aus dem Nichts erscheinen, muss man lesen, was passiert ist; wenn sie herausfahren, sieht man es. renderStack baut sie hart in den DOM. Und die fehlende reduced-motion-Klausel ist eine echte Zugänglichkeitslücke, die die App an genau zwei anderen Stellen schon selbst geschlossen hat — sie weiß es also besser.

SKIZZE: Ein disziplinierter kleiner Satz, keine Animations-Orgie: (a) .slot { transition: background .12s, border-color .12s }, (b) Stapel-Ausklappen als max-height/opacity-Übergang auf .slot.stacked, (c) .overlay/.shellwin mit 120 ms Fade + 4 px Scale-in, (d) .act.hot bekommt den pulse aus share.html (2,4 s, opacity: .35) — dieselbe Animation, dieselbe Bedeutung, ein Vokabular über beide Seiten. Alles zusammen in einem @media (prefers-reduced-motion: no-preference)-Block, damit die Abschaltung strukturell garantiert ist und nicht pro Regel nachgepflegt werden muss. FILES: public/index.html (ein Block).

AUFWAND: S. REVERT: Trivial. Reines CSS, additiv, kein JS, kein Zustand.

VERANKERUNG (im Baum nachgezählt, Stand 2026-08-07 — Zeilen driften, die Selektoren nicht):
- public/index.html: @keyframes paneflash + .pane.flash bei 129-130; .bwork.on + @keyframes workpulse bei 923-924. Die EINZIGE transition: steht bei 1120 (#side, transform 0.22s ease — der Mobile-Drawer). grep -c "transition:" public/index.html = 1.
- Die vier Zielselektoren existieren alle: .slot 85-102 (mit .slot:hover 88, .slot.shown 89, .slot.current 90, .slot .act 95, .slot .act.hot 96), .slot.stacked 245 und 256 (#side.collapsed .slot.stacked), .overlay 342, .shellwin 354 und 417 (Mobil-Override).
- Die Vorlage: public/share.html 35-38 ist genau der Block, aus dem (d) kommt — @media (prefers-reduced-motion: no-preference) { #dot { animation: pulse 2.4s ease-in-out infinite; } @keyframes pulse { 50% { opacity: 0.35; } } }. share.html 221 hat zusätzlich eine reduce-Klausel, landing.html 58 eine (@media reduce { .cursor { animation: none; } }). grep -rn "prefers-reduced-motion" src/ public/ = 3 Treffer, keiner in index.html.
- Der DOM-Bau, der (b) betrifft: src/client.ts, function renderStack bei 4234 — sie hängt r.classList.add("stacked") an die Lane-Rows, wenn stackOpen den Key trägt; Aufrufstelle 4214. Der Task ändert dort NICHTS, die Datei ist nur zum Lesen.

KONTEXT, den eine frische Session nicht hat: public/index.html wird vom Server statisch ausgeliefert (server.ts:6230, no-store) — kein Build-Schritt für diese Datei, `bun run build` baut nur public/app.js und public/share.js. CLAUDE.md notiert außerdem: das separate Demo-Repo unter ~/claude-fleet-demo leitet seine Seite aus public/index.html ab, und KEIN Gate hier meldet, wenn eine Änderung dort etwas bricht.

Files: public/index.html, public/share.html, public/landing.html, src/client.ts

Done: public/index.html trägt genau einen neuen @media (prefers-reduced-motion: no-preference)-Block, der die vier Regeln (a) .slot-Transition, (b) .slot.stacked-Ausklappen, (c) .overlay/.shellwin-Fade+Scale-in, (d) .act.hot mit dem 2,4-s-pulse aus share.html enthält, alle Bewegung liegt INNERHALB dieses Blocks, und der Diff berührt keine andere Datei und keine Zeile JavaScript.
Verify: git diff --name-only zeigt ausschließlich public/index.html; grep -c "prefers-reduced-motion" public/index.html ≥ 1 und alle vier neuen Regeln liegen zwischen dessen öffnender und schließender Klammer; danach die stehende Gate-Kette aus CLAUDE.md (bun install --frozen-lockfile && bunx tsc --noEmit ... && bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh && ./e2e-isolated.sh, Urteil am Tail "ALL PASS").
```

## `f6e085d5`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Der Brief hat den Kopf des Drafts verloren: die Titelzeile beginnt im Draft mit „[idee scout-A 08-07] TITEL: …", im Brief nur mit „TITEL: …" — als einziger der sechs Briefe dieser Charge trägt er das Herkunfts-Präfix nicht mehr. Inhaltlich ist sonst nichts zugefügt oder weggefallen (nur Leerzeilen zwischen den Abschnitten), und die PROVENIENZ-Zeile nennt Scout A und Block 6 weiterhin — der Ausfall
- Analyst sagt kollidiert mit: b3a81fd0, 6ebb4c85, 4d7aba33, 54560617, fleet/260808114656-6e86
- Analyst-Blocker: ["brief-drift"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-A 08-07] TITEL: Ein „Brief"-Sheet fürs Handy — das Board ist heute eine reine Desktop-Fläche
WAS: Auf dem Telefon öffnet ein Tipp auf eine Slot-Row ein Sheet mit dem Kern des Boards: Identität (Branch · HEAD · working/idle), „to land" (uncommittete Dateien, Commits ahead/behind), die Lanes
des Repos. Heute zeigt das Handy davon nichts.
WERT: renderBoard() kehrt bei isMobile() sofort zurück (src/client.ts:1916), und applyBoard() strippt die Klasse (1206). Was das Handy heute hat, ist die rowacts-Leiste je Row — ⤴ share, ⇩ export,
✎ rename, ✔ save, ⏏ land, ⇲ shelve (src/client.ts:4444-4460) — also die Aktionen. Was fehlt, sind die Fakten, auf denen man sie ausübt: ⏏ land ist da, aber „1 uncommittete Datei / 3 commits ahead /
rebased?" nicht. Der Owner fährt die Flotte laut Projektbeschreibung regelmäßig vom Telefon; er landet dort heute halb blind (der Merge-Preview-Dialog fängt das teilweise ab, aber erst NACH dem
Klick).
SKIZZE: Kein zweiter Renderer. Die vorhandenen Board-Sektionsbauer (identity, to land, lanes) aus renderBoard in Funktionen herauslösen, die beide Wirte bedienen — Board-Spalte auf Desktop,
Bottom-Sheet auf Mobile —, gespeist von derselben /api/slots/:id/brief-Antwort. Explorer, Agents und Outline bleiben draußen (Fläche und Modellkosten). FILES: src/client.ts, public/index.html
(Sheet-CSS). AUFWAND: M
REVERT: trivial im Sinne von „ein Commit, kein persistierter Zustand" — aber die Extraktion fasst renderBoard an, und ein Revert nach einem später gelandeten F4/F5-Commit ist kein sauberer
Rückschnitt mehr, sondern Konfliktarbeit. Ehrlich: revertierbar, solange er allein steht.
GEPRUEFT: Mobile-Guard, rowacts und die Media-Query (public/index.html:1093) gelesen. briefs/ui-next-level-2026-08-06.md §F4/§F5 betreffen Board-Reihenfolge und Explorer, nicht die
Mobile-Erreichbarkeit; der Nachtrag §4 dort stellt ausdrücklich fest, dass der Drawer die primäre Phone-Navigation ist, ohne diese Lücke zu schließen. Achtung Serialisierung: die Brief-Warnung
„maximal zwei UI-Lanes gleichzeitig, F4/F5 strikt sequenziell" gilt hier mit — diese Lane teilt renderBoard mit F4 und F5.

PROVENIENZ: Ideen-Scout A (Lane fleet/260806222332-ef99, 2026-08-07), Block 6 — Vollreport beim Owner.
```

## `6ebb4c85`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Jede tragende Behauptung stimmt im Baum: guestSection() (src/client.ts:1731) hat genau zwei Aufrufer (2159 und 2686), beide innerhalb von renderBoard() (2145-2881), das mobil nichts zeichnet — die Gast-Steuerung ist auf dem Telefon tatsächlich unerreichbar. #sidetools ist der richtige Wirt, und der Kommentar sagt es wörtlich („#sidetools is NOT hidden by the mobile media query", public/index.html:
- Analyst sagt kollidiert mit: b3a81fd0, f6e085d5, 4d7aba33, 54560617, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-A 08-07] TITEL: Die Gast-Konsole vom Telefon aus erreichbar machen
WAS: Der Owner kann Gastzugang vom Handy starten, schneiden und erneuern. Heute geht das nur am Desktop.
WERT: guestSection() (src/client.ts:1639) hat exakt zwei Aufrufer, 1926 und 2448 — beide innerhalb von renderBoard, das mobil nichts zeichnet. Der Kommentar im Board sagt selbst, die Sektion sei
bewusst hochgezogen, „damit ein Notfall-Bedienelement nie unter Dutzenden Zeilen landet" — genau dieses Argument kippt auf dem Telefon in sein Gegenteil: dort ist es gar nicht da. „Gast rauswerfen"
ist die Aktion, die man am wenigsten am Schreibtisch braucht.
SKIZZE: Ein Knopf in #sidetools (diese Leiste wird von der Mobile-Media-Query ausdrücklich nicht versteckt — Kommentar public/index.html:1200), der guestSection() unverändert in ein Overlay-Panel
hängt. Die Sektion ist maschinen-, nicht lane-bezogen und braucht deshalb keinen fokussierten Slot; die bestehende guestStopArm-Absicherung (src/client.ts:1526) reist mit. Sichtbar nur, wenn
/api/guest nicht 404 liefert — die vorhandene guestTried-Latch trägt das schon. FILES: src/client.ts, public/index.html. Client-only. AUFWAND: S
REVERT: trivial — ein Commit, kein Zustand, keine Route, keine Server-Änderung.
GEPRUEFT: Aufrufer von guestSection() per grep vollständig; /api/guest*-Routen und FLEET_GUEST_CMD in server.ts:8490ff gelesen; guest-ctl.sh ist die Gegenseite und wird nicht angefasst. Kein
Registereintrag, kein §7-Eintrag, kein F-Item.

PROVENIENZ: Ideen-Scout A (Lane fleet/260806222332-ef99, 2026-08-07), Block 7 — Vollreport beim Owner.
```

## `5aafbee4`  ·  kind=lane  ·  angelegt 2026-08-07 00:37  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Die Ausgangslage stimmt: otherOpenLanes() liefert genau die Dateiliste (server.ts:7806) und erreicht nur Merge-Kontexte (:7885, :8070), in src/client.ts null Treffer; kein Endpunkt nimmt zwei Refs (diffPayload(cwd, base) server.ts:2050 = ein Baum, /api/commit-diff :12865 = ein Commit), s.worktree.baseSha existiert und wird bereits gelesen (:7109, :8408), splitDiff/renderDiffInto liegen im Client (
- Analyst sagt kollidiert mit: 6440c392, 34205199, f551f930, 1cb6778e, 16d5e973, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee scout-D 08-07] TITEL: Kollisions-Sicht — zwei Lanes, ein Diff, und wo sie sich wirklich berühren
WAS: Zwei laufende Lanes nebeneinander, ihr Diff Datei für Datei, und die Dateien, die beide anfassen, oben und markiert — mit den überlappenden Hunks, nicht nur dem Dateinamen. Heute liefert
otherOpenLanes (server.ts:5327) genau die Dateiliste, aber sie erreicht nur den Merge-Resolver-Prompt; keine Oberfläche zeigt sie.
WERT: Die Kollisionsfläche ist in diesem Repo ein erstklassiger Begriff — register.sh baut sie in drei Wahrheitswerten auf, und der Dispatcher fährt bewusst höchstens 2 Lanes. Trotzdem ist „gleiche
DATEI ist nicht gleicher Code" (Wortlaut des Registers) genau die Unschärfe, die der Owner heute im Kopf auflösen muss, bevor er eine zweite Lane freigibt. Diese Sicht macht aus [grob] ein
[mechanisch]: sie zeigt die Zeilenbereiche. Das verbessert die Entscheidung, die er täglich am häufigsten trifft — darf das nebeneinander laufen? — ohne irgendetwas zu automatisieren.
SKIZZE: GET /api/lane-overlap?a=<branch>&b=<branch>: für beide Lanes den eigenen Diff gegen ihren baseSha (Slot.worktree.baseSha existiert, server.ts:272-274), pro gemeinsamer Datei die
Hunk-Bereiche aus den @@-Headern schneiden. Der Client hat den Diff-Splitter und -Renderer schon (splitDiff/renderDiffInto, src/client.ts:4724-4750); dargestellt im Fenster-Shell mit drei Bändern:
nur A · beide · nur B. Regel wie überall: ein Branch ohne auflösbaren Baum ergibt UNBEKANNT, nie „keine Kollision". FILES: server.ts, src/client.ts, e2e/lanes-lifecycle.ts.
AUFWAND: M
REVERT: Trivial. Leser über git diff, kein persistenter Zustand, keine Berührung des Land-/Merge-Pfads.
GEPRÜFT: otherLanes erscheint in server.ts viermal (5327, 5356, 5409, 5594) und in src/client.ts null mal — es geht nur in Merge-Kontexte. Kein Diff-Endpunkt nimmt zwei Refs: es gibt
diffPayload(cwd, base) (5327-nah, ein Baum) und /api/commit-diff (ein Commit). Register: caaf8b16 ist ein Drift-Join (Messung per jq, keine Sicht) — anderes Thema. §7: nicht darauf.

PROVENIENZ: Ideen-Scout D (Lane fleet/260806222334-dc28, 2026-08-07), Block 3 — Vollreport beim Owner.
```

## `577b26fa`  ·  kind=lane  ·  angelegt 2026-08-07 00:09  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The brief itself hands the owner an unanswered gating question — 'ob F7 überhaupt noch gewollt ist' — and I confirmed it is still open at docs/work-register-2026-08-06.md:216 ('Ob Map E wirklich offen ist, und ob F7 noch gewollt ist (steht nur im Brief)'), so a session would stop at the first line rather than build. Everything else checks out and is worth knowing before you decide: the §F7 source 
- Analyst sagt kollidiert mit: 9bf62ae6, df5b74ba, 3a622ea1, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
F7 — Drag&Drop im File-Explorer, erst starten, wenn F6 (`2784427e`) gelandet ist; F5 ist mit `ed5c352` bereits da. Auftrag: `briefs/ui-next-level-2026-08-06.md` §F7 plus §F5/§F6 als Kontext. Der Unterschied zu F6 ist die Ablage: F6 legt bewusst AUSSERHALB des Worktrees ab (`~/.claude-fleet/drops/<slot>/`), F7 legt bewusst DARIN ab — damit erbt F7 die Kante, die F6 vermeidet: eine untracked Datei blockt den Land (Lane-Disziplin) und landet im Zweifel im public Repo. Diese Kante gehört im Commit-Body entschieden, nicht implizit. Die Write-Route aus F5 (`realpath`-Prefix-Guard, `.env`/`fleet.json`-Ausschluss, Größen-Cap) ist der Sicherheitsrand, den F7 wiederverwendet statt zu umgehen. Offene Owner-Frage vor dem Bau (`docs/work-register-2026-08-06.md` §6 führt sie als ungeprüft): ob F7 überhaupt noch gewollt ist — es steht nur im Brief, nie in einer Queue-Zeile. DONE: eine Datei per Drag&Drop im Board-Explorer im Worktree ablegen → `git status` zeigt sie → Pfad-Escape wird mit 400 abgelehnt und ein e2e-Check (Familie security) beweist es. VERIFIKATION: volle Gate-Kette; `./e2e-security.sh` ist hier die tragende Suite.

FILES: `src/client.ts` (Explorer ~1764-1876), `server.ts` (Write-Route ~9284), `e2e/` security-Familie
GRUPPE: G4
QUELLE: `briefs/ui-next-level-2026-08-06.md:316-320` (§F7) `@1e46b8b` — Doc-Aggregation 2026-08-07, Lane fleet/260806214956-3b38 (Vollbericht beim Owner)
```

## `9bf62ae6`  ·  kind=lane  ·  angelegt 2026-08-07 00:30  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The brief declares its own open owner decision — 'VOR DEM BAUEN vom Owner zu entscheiden: Drafts nur pro Geraet, oder server-synced' — and that choice decides whether this is a localStorage change or a new server-side sync surface, so nothing can be built until you answer. Second, half the VERIFY is not something this repo can judge: Playwright appears nowhere in the tree except .gitignore/.docker
- Analyst sagt kollidiert mit: 577b26fa, df5b74ba, 3a622ea1, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > drafts sind aktuell im prinzip schon slot/server synced, das haben wir also bereits^^

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
BACKLOG Item 11 — Misfire-Guard + Per-Slot-Compose-Drafts (schliesst Hardening #8 mit ein). Bei 16 Slots ist der teuerste Alltagsfehler, in den falschen zu senden, und die Compose-Box ist global: ein Panewechsel verliert, was halb getippt war. Nichts davon ist gebaut — es gibt keinen Per-Slot-Draft-Puffer (das einzige `draft` im Client ist `cyc.draft`, `src/client.ts:7193`, der History-Cycle-Zwischenspeicher), und `#inputrow` traegt kein sichtbares Ziel-Label. Das Item nennt drei ECHTE Kollisionsstellen, die den eigentlichen Aufwand ausmachen: `doSend` leert `ta.value` NACH seinem `await`; der Scheduled-Prompts-Dialog liest `ta.value` erst beim Klick; der History-Cycle wird beim Panewechsel nicht zurueckgesetzt. Hardening #8 haengt daran: `armReload()` verwirft heute still, was in der Box steht — sobald es Drafts gibt, muss der Reload sie erst sichern.
DONE: Draft pro Slot (localStorage-gespiegelt), sichtbares Ziel-Label in `#inputrow`, die drei Kollisionsstellen adressiert, `armReload` sichert vor dem Reload.
VERIFY: serverseitige Anteile als Checks in `e2e/history.ts`; der UI-Teil per Playwright-Screenshot an Desktop-/iPad-/Phone-Breite (das Item verlangt ausdruecklich Augen, keine blinden CSS-Edits). `./e2e-isolated.sh` ALL PASS.
VOR DEM BAUEN vom Owner zu entscheiden: Drafts nur pro Geraet, oder server-synced fuer Handy+Desktop parallel?
Flaeche: src/client.ts, public/index.html. Herkunft: docs/attic/backlog-2026-07.md Item 11 + Hardening #8.
```

## `df5b74ba`  ·  kind=lane  ·  angelegt 2026-08-07 00:30  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The brief ends on two unresolved owner decisions it names as prerequisites — retention by count or age, and whether sessionId:null archives are list-only or get a fresh-start fallback — and the second one changes the very edge-case contract the DONE line demands ('keiner davon startet still eine frische Session'). The tree confirms the premise otherwise: archive.json, archiveSlot and revive are 0 
- Analyst sagt kollidiert mit: 577b26fa, 9bf62ae6, 3a622ea1, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
BACKLOG Item 8 — Session-Archiv + Revive. `killSlot` loescht Stream und Prompt-History endgueltig; die Label/cwd/sessionId-Zuordnung ist weg, obwohl das claude-Transcript unter ~/.claude/projects/ weiterlebt und `ensureSlot` beweist, dass `claude --resume <id>` funktioniert. Nichts davon ist gebaut: `archive.json`, `archiveSlot` und `revive` kommen 0x in server.ts vor. Sechs benannte Edge-Cases machen den Aufwand aus: Transcript zur Revive-Zeit weg (`ensureSlot` startet sonst STILL eine frische Session mit neuer UUID), cwd geloescht, Nicht-claude-`FLEET_CMD`, `sessionId:null`-Archive, Self-Heal-Race gegen den 2s-Loop, dieselbe sessionId in zwei Slots.
DONE: Kill archiviert statt zu loeschen (eigene `archive.json`, eigene Write-Chain, mode 600 — NICHT in fleet.json, das bei jedem Label/Share/Auto neu geschrieben wird); eine "past sessions"-Liste mit Revive-Knopf; jeder der sechs Edge-Cases hat einen expliziten Pfad, und keiner davon startet still eine frische Session.
VERIFY: Checks in `e2e/slots.ts` + `e2e/restart.ts`, mindestens einer adversarisch (Revive mit geloeschtem Transcript → 4xx, niemals stiller Neustart); `./e2e-isolated.sh` ALL PASS.
VOR DEM BAUEN vom Owner zu entscheiden: Retention nach Anzahl oder Alter? `sessionId:null`-Archive nur listen, oder Fresh-Start-Fallback?
Flaeche: server.ts, src/client.ts, e2e/slots.ts. Herkunft: docs/attic/backlog-2026-07.md Item 8.
```

## `190e5705`  ·  kind=lane  ·  angelegt 2026-08-07 11:39  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Bounded read-only Report mit prüfbarem DONE: eine Datei `briefs/mitarbeiter-lauf2-<datum>.md`, jede Behauptung als file:line oder grep-Zähler, reproduzierbar am Baum — und die begründete Null ist ein zulässiger Abschluss, die Zeile kann also nicht offen enden. Alle Anker existieren: `briefs/mitarbeiter-2026-08-07.md` hat ein §3 (`## 3 · Empfehlung`, Zeile 296), `register.sh` hat ein §2 (`=== 2. co
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Mitarbeiter Lauf 2 (UI-Linse), von Hand — VOR jedem Agent-Bau
(`briefs/mitarbeiter-2026-08-07.md` §3). Das Maß ist mit dieser Zeile versiegelt:
(1) Widersprüche gegen `register.sh` §2 bzw. das `collides` des Analysten, jede mit
file:line; (2) Überleben der eigenen Behauptungen nach 7 Tagen — die greps liegen dem
Report bei; (3) Owner-Akte auf Vorschläge. Abbruchregel: zwei Läufe in Folge mit
0 Widersprüchen und 0 Owner-Akten → der Mitarbeiter wird nicht gebaut. DONE:
`briefs/mitarbeiter-lauf2-<datum>.md` liest ≥10 offene UI-Zeilen quer
(`src/client.ts`/`public/index.html`-Fläche), jede Behauptung als file:line oder
grep-Zähler, und liefert EINE benannte Lücke oder EINEN strukturellen Vorschlag in
propose/promote-Form — oder die begründete Null (die zählt als Strike 1 der
Abbruchregel). Read-only, kein Code, kein Commit außer dem Report. VERIFY: die greps des
Reports sind am Baum reproduzierbar; das Dokument ist committet.
```
