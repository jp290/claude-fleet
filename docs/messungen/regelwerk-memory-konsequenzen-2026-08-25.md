---
frage: Welche der drei Lücken aus video-memory-theo lassen sich als Regelwerk-Text schließen, und widerspricht eine Rollenanweisung der neuen Memory-Disziplin?
urteil: Studio-Policy ist gespiegelt (Vollzug), die zwei Fragment-Entwürfe liegen unpromoviert unter docs/rulebook-entwuerfe/ (rulebook/ ist gitignored); kein Rollenwiderspruch, eine Lücke (Gründungsbriefe nennen keinen Zielort für dauerhafte Befunde) und die alte Behauptung, Lanes bekämen keine Auto-Memory, ist widerlegt
bereich: [regelwerk]
belege: [docs/messungen/video-memory-theo-2026-08-25.md, docs/product-studio-working-circle.md, docs/rulebook-entwuerfe/geschmack.md, 86b8c00, ead324c]
nicht-gemessen: Ob die Entwürfe gut sind (belegt, nicht erprobt); ob geschmack.md vollständig (src/client.ts und server.ts-Rumpf nicht gelesen); die Lane-Memory-Beobachtung ist einzelne Evidenz; kein Sieben-Punkte-Check gegen den gehaltenen Entwurf 3f412f4
stand: 2026-08-25
---

# Memory-Erkenntnisse ins Regelwerk gefaltet — was geändert, was vorgeschlagen, was offen

2026-08-25, Lane `fleet/260825154327-a4c5`. Auftrag: die Konsequenzen aus
`docs/messungen/video-memory-theo-2026-08-25.md` (§4 Mapping, §5 Kandidaten) im Regelwerk
nachziehen. Frage: **welche der drei dort benannten Lücken lassen sich als Text schließen, und
widerspricht eine Rollenanweisung der neuen Memory-Disziplin?**

Vier Teile. Teil 1 ist Vollzug beschlossener Owner-Policy, Teil 2 und 3 sind **Vorschläge** und
werden ohne Owner-Promotion nicht normativ (`CLAUDE.md` §Loader-Vertrag), Teil 4 ist ein Bericht
ohne Änderung.

## Ergebnis in vier Zeilen

| Teil | Was | Ergebnis |
|---|---|---|
| 1 | Studio-Policy-Spiegelung (Pflicht) | `docs/product-studio-working-circle.md` trägt alle sieben Punkte; 5 owner-lastige Stellen repariert · `86b8c00` |
| 2 | Taste-Fragment (Entwurf, = K2 halb) | `docs/rulebook-entwuerfe/geschmack.md`, 15 Regeln, jede mit `datei:zeile` · `ead324c` |
| 3 | Owner-Fragment (Entwurf, = K2 halb) | `docs/rulebook-entwuerfe/owner.md`, personenlos, Pflichtcheck leer · `ead324c` |
| 4 | Rollenbrief-Check (nur Bericht) | **Kein Widerspruch gefunden.** Eine Lücke und eine veraltete Doc-Behauptung, unten |

## Teil 1 — Die Studio-Policy stand nur in der Auto-Memory

Zwei Owner-Korrekturen vom 2026-08-23 lebten ausschließlich in
`project-fleet-studio-policy-strictness-2026-08-23` und `…-correction`. Das ist genau die Klasse,
die K1 aus der Auto-Memory nimmt — eine Policy, die andere Sessions binden soll, in einem
maschinenlokalen, ungetrackten Artefakt, das kein Lane-Leser je sieht.

**Die Zeilennummern der Memory zeigen ins Leere.** Sie benennen L50/L192/L268/L585 des GEHALTENEN
Entwurfs `3f412f4` (Branch `fleet/260823154740-7f2d`); das Dokument, das tatsächlich landete, hat
478 Zeilen und eine andere Gliederung. Der Satz an L50 hat den Weg aber wörtlich überlebt: „Owner
promotion remains the only source of binding intent."

Geändert:

- **Neuer Abschnitt** „Where a Studio-MAIN decides alone, and where the owner's gate stands" mit
  allen sieben Klauseln — Anker MAIN-promotbar, bounded progress budget statt Reparaturzahl,
  recoverable = MAIN-Arbeit inkl. `conflicted:true` blockt nie, local review serving ≠ production
  deploy, prä-autorisierte Kosten im Envelope, interne Promotion, und die abschließende Sieben-Tore-
  Liste.
- **Fünf reparierte Stellen**, die gewöhnliche Entscheidungen zum Owner routeten: die Zeile
  „Program / Origin" der Ist-Tabelle (binding intent → binding **Program direction**), „The owner
  decides promotion and stop" in der Rollenkette, das `owner-confirmed direction` des
  Rollen-Diagramms, der `VISUAL_DIRECTION.md`-Schritt in Visual Loop v0, der
  Kontext-Set-Promotionssatz und der „owner-promoted pointers"-Punkt der Roadmap.
- **Bewusst unangetastet:** die finale A/B-Disposition, die `ownerPlaytest`-Trennung und der
  One-Step-Launch. Das ist Klausel 7 (finaler Geschmack/Release) und damit korrekt beim Owner.

Nicht wieder eingeführt: „conflict ⇒ owner", eine feste Reparaturzahl, ein Posture-Enum, eine
Größenschwelle — jedes davon ist die persistierte Haltung, die die Korrektur ausschließt.

## Teil 2 und 3 — Zwei Fragment-Entwürfe, und warum sie nicht in `rulebook/` liegen

K2 verlangt die Fragmente in `rulebook/`. **Dort können sie in einer Lane nicht entstehen:**
`rulebook/` ist gitignored (`.gitignore:40`, Grund dort notiert — die Fragmente tragen Deploy-Host
und IP) und existiert im Worktree gar nicht. Eine Datei dort wäre nicht committbar und stürbe mit
dem Worktree, dieselbe Todesart, die `CLAUDE.md` für Regelbuch-Änderungen aus einer Lane beschreibt.
Das Done-Kriterium „alles committet" und der Ablageort schließen sich also aus.

Gewählt: getrackt unter `docs/rulebook-entwuerfe/`, im Kopf als **ENTWURF — UNPROMOVIERT**
markiert, mit dem Promotionsweg in der Datei. Der Umweg hat einen Nebeneffekt, der zum Auftrag
passt: weil die Dateien öffentlich sind, ist der Personen-Verzicht in Teil 3 nicht nur eine Bitte,
sondern überprüfbar.

**`geschmack.md` — 15 Regeln, jede an existierendem Code belegt.** Kern: Bun ist die Laufzeit, nicht
eine Abhängigkeit (104 `Bun.`-Zeilen gegen 5 `node:`-Importzeilen in `server.ts`); der Server hat
null Laufzeit-Abhängigkeiten (alle fünf `package.json`-`dependencies` gehören dem Client-Bundle);
eine Datei darf groß sein, aber nicht unehrlich (`server.ts` 21 405 Zeilen, `AGENTS.md` „avoid new
files") — **der globale 800-Zeilen-Default gilt hier ausdrücklich nicht**; ausgelagert wird, was REIN
ist, nicht was groß ist (`rulebook.ts:10-11` „it reads NOTHING"); ein Kommentar trägt Mechanismus und
gemessenen Preis (`e2e/harness.ts:98-101`); ein Verbot trägt seine Messung (`:12-27`); eine
Fehlermeldung sagt, was jetzt zu tun ist (`:27`, `:117`); `check()` nimmt einen SATZ (`:66`); eine
Emit-Stelle je Fakt (`:70-72`); ein Name trägt seine Unsicherheit (`lane-signals.ts:61`,
`verify-proportion.ts:16`); Deutsch für Messprosa, Englisch für Code und Verträge; Datum im
Dateinamen; Zahl statt Wertung.

Der Entwurf wiederholt **keine** `lane-discipline`-Regel: `rulebook.ts:34-38` verlangt Partition —
eine Regel lebt in genau einem Fragment, sonst bekommt der Loader-Vertrag eine zweite
Widerspruchsfläche.

**`owner.md` — Richtung und Ton ohne Personenbezug.** Inhalt: die sieben Tore und die Tatsache, dass
die Liste abschließend ist; die drei Dinge unterhalb der Tore, die trotzdem gefenced sind (laufende
fremde Arbeit, Löschen ohne Blast-Radius, Lifecycle-Eingriffe); der Eskalations-Stil (genau EINE
Attention an der terminalen Grenze, Fortschritt ist keine Meldung, die Übergabe fährt man selbst);
der Ton; und sechs Dinge, die zuverlässig nerven — die Rangliste ohne Schnittlinie, die Rückfrage zu
Composer-Rückstand, die falsch gepinnte Fläche, die parallele Ansicht, das „fertig" ohne Lauf, der
oberflächliche Patch.

Substanz abstrahiert aus den 9 `feedback-*`-Memories und dem lokalen, ungetrackten Owner-Modell;
**keine Zeile daraus zitiert.** Kein Name, Handle, Host, keine IP, Domain, kein Konto, Gerät, Ort.

## Teil 4 — Rollenbrief-Check: kein Widerspruch, eine Lücke, eine veraltete Behauptung

Geprüft wurde, ob eine Rollenanweisung Momentaufnahmen in die Auto-Memory lenkt statt nach `docs/`.

| Artefakt | Memory-/Wissensanweisung | Verdikt |
|---|---|---|
| `docs/steward.md` | „Memory" heißt dort das **Steward-Journal** (`POST /api/steward/journal`, `:115`), das Wissens-Regal ist `docs/` (`:166 ff.`). `:132-141` begründet ausdrücklich, warum das Inspektions-Register aus dem verfügbaren Worktree ins server-seitige Journal wanderte. | **Deckungsgleich.** Kein Bezug zur Auto-Memory. |
| `docs/supervisor-succession.md` | Transfermedium ist ausschließlich `HANDOFF.md` (getrackt), mit Gate `handoffCommittedAfterOpen` (`:287-290`). | **Deckungsgleich.** |
| Gründungsbriefe in `server.ts` | Alle vier MAIN-Varianten (`buildProgramMainBrief` `:14780`, `buildProgramMainSuccessionBrief` `:14809`, Supervisor `:14852`/`:14859`) plus `PROGRAM_MAIN_RAIL_BLOCK` (`:14716`). | **Kein Widerspruch — sie erwähnen Memory überhaupt nicht.** Ihr dauerhaftes Substrat ist das Program, `AGENTS.md`, git und `HANDOFF.md`. |
| `rulebook/supervisor.md` | Trug bis 2026-08-19 die **Gegenregel** zu `feedback-composer-drafts-are-claude-not-owner` (Probe S3/S4). | **Vom Owner nachgezogen**, heute `:35-41`: „ungesendeter Text im Composer einer Pane ist CLAUDE CODES EIGENER REST — nie ein Owner-Entwurf". Der Supervisor-Gründungsbrief sagt dasselbe (`server.ts:14846`). Diese Memory ist damit vollständig gespiegelt. |

**Die Lücke (kein Widerspruch, eine fehlende Naht):** keiner der vier Gründungsbriefe und auch nicht
der Rail-Block sagt einem frisch gegründeten MAIN, **wohin ein dauerhafter Befund gehört**. Der
Rail-Block endet bei „raise exactly ONE attention"; ein target-repo-MAIN in einem fremden Checkout
hat zudem kein `CLAUDE.md`, das auf `docs/` und die Commit-Bodies zeigt. Die neue Disziplin
(„Momentaufnahmen in `docs/` und Commit-Bodies, nicht in die Memory") hat damit keinen
Zustellweg in eine gegründete MAIN-Session. Das ist der Kandidat für einen nächsten Schnitt, nicht
Teil dieses Auftrags.

**Die veraltete Behauptung:** `docs/kontextlast-publikum-2026-08-18.md:30-33` und
`docs/lerntisch-abgleich-2026-08-19.md:222-227` schließen aus der Verzeichnis-Messung, „eine Lane
bekommt die Auto-Memory strukturell nicht". Die Messung selbst stimmt weiterhin — unter keinem
Worktree-Projektschlüssel existiert heute ein `memory/`-Verzeichnis (§Methode). **Der Schluss
stimmt nicht mehr:** diese Session ist eine Lane (`cwd` = Worktree, `FLEET_SELF_SLOT=15`), und ihr
Startkontext trägt `MEMORY.md` — geliefert aus dem Schlüssel des **Haupt-Checkouts**, nicht aus dem
des Worktrees. Die CLI löst das Memory-Verzeichnis offenbar über die Repo-Wurzel auf, nicht über
`cwd`. Konsequenz für §4(a) der Video-Notiz: der Auto-Memory-Index ist **nicht** nur MAIN- und
Supervisor-Last, er liegt auf jeder Lane dieses Repos — was K1 eher stärkt als schwächt.

## Was zuerst zu klären ist (K2 §„Was zuerst zu klären ist")

Welche Fassung welches Fragment bekommt. Vorschlag zur Promotion, unbestätigt:
`geschmack` → `lane` **und** `main` (die Lane schreibt den Code); `owner` → nur `main` (Richtung und
Ton sind MAIN- und Controller-Sache, eine Lane bekommt ihre Richtung aus dem Brief). Das ist eine
Zeile in `FRAGMENTS_FOR` (`rulebook.ts:39-42`) plus je ein Eintrag in `RULEBOOK_FRAGMENTS` und
`FRAGMENT_BY_RULE_PREFIX` — und danach ein Re-Render, weil `CLAUDE.md` ein Generat ist.

## Methode

```
# Teil 1 — Ist-Stand des Studio-Docs gegen die sieben Punkte
grep -n -iE 'owner (confirm|promot|approv|decid|gate)|promot|repair|escalat|authority|deploy|conflict' \
  docs/product-studio-working-circle.md

# Teil 3 — Hygiene-Pruefung, diff-skopiert (die operative Form, docs/triage/batch-F-wissen.md:40)
# Die Identitaets-Muster aus CLAUDE.md §Deploy (Domain, Tailnet-Adresse, Nutzer- und Kontonamen,
# E-Mail-Handle, Initialen) per grep gegen den eigenen Diff UND gegen beide neuen Dateien
# geprueft. Ergebnis: leer. Die Muster stehen hier bewusst NICHT ausgeschrieben — eine getrackte
# Datei, die den Suchbegriff zitiert, macht genau den Grep unbrauchbar, der leer bleiben muss.

# Teil 4 — Memory-Verzeichnisse je Projektschlüssel
ls -d ~/.claude/projects/*/memory        # 14 Treffer, KEINER unter einem *worktrees*-Schlüssel
ls -d ~/.claude/projects/*worktrees*     # existieren, aber ohne memory/
```

Der Pflichtcheck ist **repoweit nicht leer** und war es lange nicht
(`docs/supervisor-succession.md:238-278`, `docs/messungen/owner-auth-fail-2026-08-25.md:78-90`
tragen Host und IP legitim). Die operative Form ist die diff-skopierte, so wie
`docs/triage/batch-F-wissen.md:40` sie formuliert: „über deinen Diff ist leer".

## Was nicht gemessen wurde

- **Ob die Entwürfe gut sind.** Sie sind belegt, nicht erprobt: keine Session hat je unter ihnen
  gearbeitet. Der Beleg je Regel schützt gegen Erfindung, nicht gegen Nutzlosigkeit.
- **Ob `geschmack.md` vollständig ist.** Abgeleitet aus `server.ts`-Kopf, `e2e/harness.ts`,
  `e2e/watch.ts`, `rulebook.ts`, `verify-proportion.ts`, `lane-signals.ts`, `package.json` und den
  vier Repo-Skills. `src/client.ts` (9 854 Zeilen) und der Rumpf von `server.ts` wurden **nicht**
  gelesen — Frontend-Geschmack fehlt darum ganz.
- **Die Lane-Memory-Beobachtung ist einzelne Evidenz.** Eine Session, ein Harness (Claude Code),
  ein Repo. Ob Codex- und Pi-Lanes denselben Startkontext bekommen, ist nicht geprüft; die
  Token-Kosten je Fassung sind nicht neu gemessen.
- **Kein Sieben-Punkte-Check gegen den gehaltenen Entwurf `3f412f4`.** Geprüft wurde das
  gelandete Dokument; ob der gehaltene Slot-8-Entwurf noch existiert und noch landen soll, ist
  offen und gehört dem Owner.
