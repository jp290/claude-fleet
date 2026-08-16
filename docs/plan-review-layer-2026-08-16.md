# Plan: Review-Layer — ein self-hosted CodeRabbit auf Fleets eigener Maschinerie (2026-08-16)

**Status:** Entwurf für den Arbeitskreis · Owner-Promotion ausstehend. **Bei Widerspruch gilt der
Code, nicht dieses Dokument.** Zeilenangaben gegen den Baum von `afcfe46`; wer später liest,
prüft die Anker per `rg -n` nach, nie per gemerkter Zeile.

## 0. Die Idee in einem Satz

Fleet bekommt kein neues Review-System — es füttert seinen **vorhandenen** automatischen
Reviewer (auto-③) mit den Schlecht-Code-Signalen, die dieses Repo bereits mit Incidents bezahlt
hat, und stellt den mechanisch prüfbaren Teil als deterministisches Sweep-Skript neben die Pins.
Zusammen ist das funktional ein self-hosted CodeRabbit: diff-getriggerte Review mit
Repo-Regeln plus stehende Sauberkeits-Signale — ohne dass Diffs (auch die der privaten
Nachbar-Repos) je einen Dritten erreichen.

## 1. Warum diese Form und keine andere (das Urteil, komprimiert)

Die Sitzungs-Analyse vom 2026-08-16 hat die Architektur-Frage geklärt:

- **~80 % existieren.** auto-③ (`tickAutoReview`, `server.ts` — läuft per Default unaufgefordert
  auf jeder done-looking Lane, max 2 parallel, einmal pro Git-State, gated nichts) ist der
  Review-Motor. Die Context-Pack-Maschinerie (`context-packs.ts`, `context-plan.ts`,
  `context-pack-validator.ts`, P1-B) ist der Regel-Träger. Die Queue (`kind:"notiz"`,
  propose/promote) ist der Befund-Kanal, der einen Konsumenten GARANTIERT — der Owner sieht
  jede Zeile.
- **Advisory-Urteilsschichten ohne Konsument sterben hier nachweislich.** K2-Schatten-Richter:
  45 Zeilen, 0 Information, beerdigt. `FLEET_CLEAN_REVIEW=off`. Dream-Mode: 1 bestätigt / 4
  widerlegt / 11 mitigiert. auto-③ überlebt als einzige Review-Schicht, weil es dem Owner
  Wartezeit WEGNIMMT statt Lesestoff hinzuzufügen. Das ist das Überlebenskriterium jedes
  Werkpakets unten.
- **Konsequenz:** kein periodischer LLM-Richter über die ganze Codebase (Beerdigtes unter neuem
  Namen, `docs/work-register-2026-08-06.md` §7), keine Style-Gates (Gates bleiben
  incident-promoteten Pins vorbehalten), keine neue Pack-Infrastruktur. Nur Inhalt auf
  vorhandene Nähte.

## 2. Zwei Design-Constraints, die jede Umsetzung kennen muss

**(a) Der ③-Reviewer ist werkzeuglos.** `runReview` (`server.ts`, grep `async function runReview`)
spawnt den Worker mit `TEXT_ONLY_TOOLS` und verbietet Tool-Use im Prompt ausdrücklich. Ein
Review-Pack, das nur einen PFAD nennt, ist dort tote Last — der Reviewer kann nichts nachlesen.
Die Pack-QUELLEN müssen server-seitig **zur Review-Zeit gelesen und in den Prompt inline**
gestellt werden. Und zwar AUSSERHALB des `<<<DATA`-Blocks: die Signal-Liste ist eine Aussage des
Servers aus einer getrackten Quelle, kein untrusted Material (die Delimiter-Disziplin bei
`runReview` erklärt die Trennung im Kommentar selbst).

**(b) Die Pack-Vokabulare sind geschlossen.** `CONTEXT_PACK_SCOPES` / `_TRIGGERS` sind
`as const`-Mengen, die der Validator (`context-pack-validator.ts:170,194`) und die
e2e-Module (`e2e/context-packs.ts`, `e2e/context-plan.ts`) teilen. Ein neuer Scope/Trigger
(`code-review` / `review`) ist eine Vokabular-Erweiterung an EINER Stelle, aber die Lane muss
die abhängigen Checks/Pins mitziehen — das ist Aufwand im Brief, kein Hindernis.

## 3. Werkpakete — jedes einzeln dispatchbar, jedes mit Done-Kriterium + Verify-Weg

### WP1 — Der Signal-Katalog als getrackte Quelle

**Was:** `docs/review-signals.md` — der incident-abgeleitete Katalog der Signale, an denen
dieses Repo schlechten Code direkt erkennt. Startbestand (jedes mit Incident-Beleg im Repo):

1. **Cast auf eine fremde Netz-Fläche** — `as` auf ein `fetch`-Ergebnis behauptet Felder, die
   die Payload nie emittiert; `tsc` sieht es nie. Zweimal gemessen (`awaiting`-Befund,
   `8e2b3e5`; `kind`-Umbenennung `dd0c9a8` — Client-`TaskInfo` kompilierte gegen die alte Union
   weiter und war für immer falsch).
2. **Eigene Typ-Deklaration einer fremden Fläche ohne gemeinsame Quelle** — die Server/Client-
   Doppeldeklaration ist dieselbe Klasse wie (1), nur als Interface statt Cast.
3. **Datei-Enden-Verstümmelung, die syntaktisch gültig bleibt** — `613faa3` enthauptete
   `e2e-isolated.sh`, Status 0, „grünes" Audit ohne Messung. Pin existiert („decapitated").
4. **Doc-Behauptung über Code ohne lebenden Anker** — Zeilenreferenzen und Kontrakt-Aussagen
   in `docs/*.md`, deren Symbol nicht mehr existiert (`docs/knowledge-currency.md` §3).
5. **Dateigrößen-Drift** — Owner-Regel 800 Zeilen max; `server.ts` steht bei ~17 700, gewachsen
   um ~4 000 seit der letzten Regelbuch-Fassung. Das Signal meldet die DRIFT (Wachstum), nicht
   nur den Bestand — sonst ist die erste Meldung für immer dieselbe.
6. **Sonde, die als ihr Messobjekt scheitert statt als sie selbst** — eine Voraussetzung ohne
   eigenen `check()` (dreimal an einem Tag, Session 38; Regel steht im Regelbuch).
7. **Behauptung an zweiter Stelle ohne Kopplung** — ein `supports.*`/Kontrakt-Wert, über den
   anderswo eine Aussage steht (`8e154dd`/`6cc8283`, die `e2e/security.ts`-Lektion).

Form je Signal: **Mechanismus · woran erkennbar (mechanisch prüfbar ja/nein) · Incident-Beleg
(Commit/Doc) · was es kostet.** Anker über Symbole/Überschriften, nie über Zeilennummern.

**Done-Kriterium:** Datei existiert, jedes Signal trägt alle vier Felder und mindestens einen
Repo-Beleg; kein Signal ohne benennbare Kosten (sonst raus — Fünf belegte schlagen zwanzig
plausible). **Verify:** doc-proportional (`localProof`: install+pins); Gegenlesen durch den
Owner ist hier das eigentliche Gate, denn diese Datei WIRD Prompt-Inhalt.

### WP2 — Review-Pack + Prompt-Anschluss an auto-③

**Was:**
- Neues Pack `review-signals` in `context-packs.ts`: scope `code-review` (neu), trigger
  `review` (neu), audience `agent`, hardness `guidance`, sources → `docs/review-signals.md`
  (Anker: die Katalog-Überschrift), `requiredCapabilities: ["tracked-source-read"]`, alle
  Harnesses, modes `["read-only"]` (der Reviewer mutiert nie).
- `runReview` fragt `planContext` mit trigger `review` und stellt für jedes selektierte Pack
  den Quell-ABSCHNITT (server-seitig gelesen, am Anker geschnitten, Byte-gedeckelt) als
  eigenen Prompt-Abschnitt „## repo review signals" VOR den DATA-Block. `sourceTree:"foreign"`
  lässt `planContext` das Pack bereits heute mit `source-unavailable` fallen — ein fremdes
  Repo bekommt Fleets Signale also strukturell nie untergeschoben, ohne neue Bedingung.
- Vokabular-Erweiterung durch Validator und e2e-Module ziehen (Constraint 2b).

**Done-Kriterium:** Ein auto-③-/Owner-Klick-Review auf einem Fleet-Baum trägt den
Signal-Abschnitt im Prompt (e2e-Check über den Review-Stand-in `FLEET_REVIEW_CMD`, der den
empfangenen Prompt aufbewahrt — Muster existiert in den Review-Checks); derselbe Review auf
einem foreign Baum trägt ihn NICHT; Katalog-Datei fehlt/Anker leer → Review läuft UNVERÄNDERT
ohne den Abschnitt weiter (fail-open mit einer notes-Zeile, nie ein toter Reviewer — der
Reviewer ist advisory, sein Ausfall darf nie am Pack hängen).
**Verify:** volle Kette (`server.ts` + `e2e/` = SERVER/E2E-Regel in `verify-proportion.ts`),
`./e2e-isolated.sh` als Vorschau, weil `e2e/`-Module angefasst werden.

### WP3 — Der deterministische Sauberkeits-Sweep (die „Arbeitsschicht", die keine Agenten kostet)

**Was:** `review-sweep.ts` — bun-Skript, kein Modellaufruf, Sekunden. v1-Checks, alle aus WP1s
mechanisch-prüfbarer Teilmenge:

- Datei-Zeilenzahl getrackter `.ts`/`.sh` gegen Schwelle (Report ab 800, mit Delta zur letzten
  aufgezeichneten Messung);
- `as`-Cast auf `fetch`/`.json()`-Ergebnisse in `e2e/**` und `src/**` (ast-grep, `ast-grep`
  ist user-lokal installiert; in einer Lane verfügbar, anders als graphify);
- Doc-Anker-Drift: in `docs/*.md` genannte Symbole/Pfade in Backticks, die im Baum nicht mehr
  existieren (bewusst grob, nur Existenz — kein Semantik-Urteil);
- tote Exporte in Top-Level-`.ts` (Export ohne Importstelle; `ast-grep`/`rg`, keine neue
  Dependency).

Ausgabe: JSON-Zeilen mit stabilem Fingerprint je Befund. Modus `--queue`: legt je NEUEN
Fingerprint eine Queue-Zeile `kind:"notiz"` an (Dedup gegen bestehende offene Zeilen; eine
Notiz wird nie doppelt gemintet, nie automatisch `auftrag`, nie dispatcht — der 409-Riegel an
`queue:true` für Nicht-Aufträge bleibt genau richtig so). **v1 wird von Hand oder aus einem
Steward-Pulse gefahren — KEIN neuer Server-Tick.** Ein Tick ohne bewiesenen Konsum wäre der
K2-Fehler; erst wenn der Owner die Notizen nachweislich konsumiert, ist ein Tick ein
Folge-Vorschlag.

**Done-Kriterium:** Lauf auf dem aktuellen Baum liefert ≥ die bekannten Ist-Befunde (u. a.
`server.ts`-Größe); zweiter `--queue`-Lauf auf
unverändertem Baum mintet NULL neue Zeilen; ein Befund-Fingerprint überlebt reine
Zeilenverschiebung. **Verify:** eigenes e2e-Modul mit Positiv- UND Negativ-Fixture
(präpariertes Scratch-Verzeichnis), volle Kette wegen `e2e/`-Berührung.

### ~~WP4 — Der offene Pin~~ — SCHON GELANDET (gegen den Code geprüft 2026-08-16)

Das Regelbuch führt den Cast-Pin als „noch nicht gepinnt"; der Baum widerspricht: `bun
e2e/pins.ts` auf `afcfe46` trägt die Zeile „no e2e cast over the /api/sessions poll names a
field the payload cannot emit (4 cast(s) … offenders=[])" — der Pin existiert und ist grün,
die bekannte Fundstelle ist repariert. Kein Werkpaket; stattdessen gehört die
CLAUDE.md-Stelle nachgezogen (Rulebook-Pflege im Haupt-Checkout, eine Zeile). Als Beleg für
den Arbeitskreis bleibt er hier stehen: genau die Doc-vs-Code-Drift, die Signal 4 des
Katalogs meint — gefunden vom eigenen Verify-Lauf dieses Dokuments.

## 4. Reihenfolge und Zuschnitt für die Queue

WP1 → WP2 (WP2 konsumiert WP1s Datei; getrennt landen, damit der Katalog Owner-gelesen ist,
bevor er Prompt wird). WP3 ist unabhängig und parallel dispatchbar (WP4 entfiel — schon gelandet, s. o.). Jedes WP ist eine
eigene Queue-Zeile `kind:"auftrag"` mit diesem Dokument als Brief-Quelle; die Done-Kriterien
oben sind als bestätigbare Kriterien formuliert (`criterion-confirm`-tauglich). Kein WP fasst
den Land-/Merge-Pfad an; WP2 ist das einzige mit `server.ts`-Berührung.

## 5. Nicht-Ziele (damit der Arbeitskreis sie nicht „mitnimmt")

- **Kein stehender LLM-Richter, kein Score, kein Dashboard.** Grab: K2.
- **Kein Gate auf Style-/Struktur-Befunde.** Gates entstehen aus Incidents als Pins, nicht aus
  Katalogen.
- **Keine `server.ts`-Zerlegung als Nebenprodukt.** Signal 5 MELDET die Drift; die Zerlegung
  ist eine eigene Owner-Entscheidung mit eigenem Risiko und eigener Zeile.
- **Keine GitHub-/PR-Integration.** `file-pr`/`watch-pr` bleiben das konditionale Spätere aus
  dem Agent-OS-Plan (§Schicht C); Fleets interner Land-Pfad ist die Review-Fläche.
- **Keine neue Pack-/Compiler-Infrastruktur.** `planContext` bleibt advisory und frisch
  abgeleitet; WP2 fügt ein Pack und einen Konsumenten hinzu, keinen Mechanismus.

## 6. Offene Owner-Fragen (blockieren WP1/WP3 nicht, gehören aber vor WP2-Land beantwortet)

1. Byte-Deckel für den Signal-Abschnitt im Review-Prompt (Vorschlag: 4 000 Bytes — der
   Reviewer läuft auf `SUMMARY_MODEL`, sein Prompt trägt schon Diffs bis `REVIEW_DIFF_CAP`).
2. Soll der Owner-Klick-Review (Nicht-Lane-Slots) dieselben Signale bekommen wie auto-③?
   (Vorschlag: ja — `runReview` ist ein Pfad, eine Sonderbehandlung wäre eine zweite Wahrheit.)
3. Schwellenwerte des Sweeps (800 Zeilen fix aus dem Regelbuch, oder Drift-only?).
