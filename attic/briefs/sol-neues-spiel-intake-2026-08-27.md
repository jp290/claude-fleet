# Prompt für die Sol-Session: Intake für ein neues AA-Indie-Spiel

Gesendet an einen frischen Sol-Slot (codex, gpt-5.6-sol, xhigh). Hier zum Nachlesen.

---

Du bist die **Sol-Intake-Session** des Product-Studios auf dieser Maschine. Dein Auftrag hat
GENAU EIN Deliverable: ein gebundenes **Intake-Dokument für ein neues Spiel**, das danach eine
Fable-MAIN als Gründungs-Anweisung bekommt. Die Fable-MAIN arbeitet die Architektur aus und
brieft eigene Worker — nicht du. **Du baust nichts, du committest nichts, du startest keine
Prozesse.** Eine Datei schreiben + ein kurzer Bericht in der Pane, das ist alles.

## Was du zuerst liest (in dieser Reihenfolge, nicht mehr)

1. `docs/product-studio-working-circle.md` — Studio-Profil, Rollen als Modi, Owner-Gates,
   Anti-Slop-Kontrakt. Das ist der Arbeitsrahmen, in dem die Fable-MAIN dein Intake umsetzt.
2. `docs/product-studio-calibration-2026-08-22.md` — die Owner-Korrekturen. Was der Owner
   mag und was ihn nervt, steht hier; dein Konzept muss dazu passen.
3. `~/private-repo-j/INTAKE-2026-08-25.md` — die **FORMAT-Vorlage**. Struktur, Vertrauensstufen
   (`[gemessen]` / `[belegt]` / `[These, zu prüfen]`), prüfbare Prädikate. Dein Intake soll
   diese Form haben, nicht diesen Inhalt.
4. **Lies NICHT `CLAUDE.md` am Stück** (~62 KB — du hast ein 258.400-Token-Fenster).
   `AGENTS.md` hast du automatisch geladen; das reicht.

## Die bestehende Spiellandschaft (musst du nicht erheben — hier, damit du dich ABGRENZT)

Private-repo-j (Private-repo-j, Private-repo-j-Thema) · Private-repo-q (Linien-Navigation für Eilige) · Private-repo-r
(Preise lesen, Ostsee segeln) · Private-repo-s (Fahrstraßen sichern unter Taktdruck) · Private-repo-t
(Eisstock-Duelle als Brief-Schach) · private-repo-i (Private-Repo-C, dritter Anlauf) · Private-repo-e ·
Arcade-Bounties · ein GLM-Studio-Drittspiel · Private-repo-k-Intakes (Grok) ·
private-repo-h. Dein Konzept darf keinem davon im Kernloop ähneln.

## Was „anspruchsvolles AA-Indie" hier heißt (Owner-Wortlaut: „anspruchsvolles
## interessantes AA indie game")

- **Systemische Tiefe statt Content-Masse**: ein Kernsystem, das emergentes Verhalten
  erzeugt, das man BEOBACHTEN und AUSNUTZEN kann — kein Level-Grind, keine Asset-Schlacht.
- **Eigene Identität**: ein Satz Fantasy, den es so noch nicht gibt. „X, aber hübscher"
  disqualifiziert.
- **In Tagen anspielbar**: die erste spielbare Scheibe muss von einer MAIN + wenigen Lanes
  in ~2 Tagen stehen können. Der volle Horizont darf groß sein, der erste Schnitt nicht.
- **Grafik ist im ERSTEN Playtest sichtbar** (promovierte Owner-Präferenz aus Private-repo-j:
  „ich will grafik eig gleich direkt im ersten playtest sehen"). Rohbau-Ästhetik erlaubt,
  Diagnose-Telemetrie als UI verboten. Die Grafik rendert echten Sim-/Spielzustand, nie
  Fassade.
- **Web-first TypeScript/Bun** ist der Vorschlags-Default dieser Maschine (lokaler
  Browser-Build, kein App-Store-Pfad). Weiche nur begründet ab; die Fable-MAIN validiert.
- **Touch-tauglich mitdenken**, nicht bauen.
- Keine externen Downloads mit ungeklärter Lizenz; Datenquellen erst nach Lizenzprüfung
  (Owner-Gate) — wenn dein Konzept echte Daten braucht, schreib das als offene Frage.

## Dein Ablauf

1. **Drei Konzepte, je maximal eine halbe Seite**: Arbeitstitel · Fantasy in einem Satz ·
   Kernloop in drei Sätzen · warum AA-anspruchsvoll (welches System trägt die Tiefe) ·
   größtes Risiko ehrlich benannt · was der erste 2-Tage-Schnitt zeigt.
2. **Wähle selbst EINES** und begründe die Wahl in ≤5 Sätzen gegen die zwei verworfenen.
   Der Owner hat die Wahl ausdrücklich delegiert („irgendein anspruchsvolles interessantes
   AA indie game").
3. **Schreib das volle Intake NUR für das gewählte Konzept** in die Datei
   `INTAKE-NEUES-SPIEL-2026-08-27.md` (damals Repo-Root, exakt dieser Name — heute
   getrackt als `docs/intake-neues-spiel-2026-08-27.md`;
   ein Watcher wartet darauf; der Spieltitel steht IN der Datei). Alle drei Kurzkonzepte
   kommen als Anhang mit hinein.

## Was das Intake enthalten MUSS (Form: Private-repo-j-Intake)

- **Intent**: das Spiel in einem Absatz; die Fantasy; warum es diese Maschine bauen kann.
- **Erster Schnitt** (~2 Tage): was spielbar ist, was man SIEHT, was man TUT.
- **Prüfbare Prädikate** für den ersten Schnitt: Zahlen und Ja/Nein-Tests, keine
  Adjektive. Mindestens: ein Performance-Budget (gemessen, nicht geschätzt) · ein
  Emergenz-/Systembeweis (das Kernsystem tut nachweisbar etwas, das nicht direkt
  hingescriptet ist) · ein Kausalitätstest (Spieler-Eingriff → messbare Folge) · das
  Owner-Spaß-Gate (10 Minuten spielen, ausdrückliches Urteil).
- **Kill-Kriterien**: woran man nach dem ersten Schnitt erkennt, dass der Kernloop tot
  ist, und was der EINE erlaubte Rettungsversuch wäre (Private-repo-j-Muster: Blind-A/B).
- **Non-Goals** des ersten Schnitts (explizit, mindestens fünf).
- **Offene Fragen** mit Vertrauensstufen; jede externe Faktenbehauptung als
  `[zu prüfen]` markiert, wenn du sie nicht belegen kannst.
- **Hinweis an die MAIN**: dieses Intake ist ein VORSCHLAG mit Begründungen — die
  Fable-MAIN darf mit Beleg widersprechen und muss Abweichungen in ihren
  Entscheid-Log schreiben.

## Kontext-Disziplin

Dein Fenster ist 258.400 Tokens. Tool-Ausgaben klein halten (Dateien gezielt lesen, keine
Verzeichnis-Dumps). **Sag in der Pane Bescheid, wenn du halbvoll bist.**

## Done-Kriterium

`INTAKE-NEUES-SPIEL-2026-08-27.md` existiert im Repo-Root (heute `docs/intake-neues-spiel-2026-08-27.md`), enthält alle Pflicht-Abschnitte,
alle Prädikate sind zahlen- oder ja/nein-förmig, und dein Pane-Bericht nennt: gewählter
Titel + Ein-Satz-Pitch + die zwei verworfenen Titel mit je einem Satz warum nicht. Danach
STOPPST du und wartest.


---

# Nachtrag: Owner-Redirect auf Private-repo-o-Private-repo-c (gesendet 2026-08-27)

OWNER-ENTSCHEID, kippt die freie Konzeptwahl: dein Augenwerk-Intake bleibt als Archiv liegen (nicht löschen, nicht umbenennen), aber das Spiel, das gebaut wird, hat der Owner jetzt selbst fixiert — WÖRTLICH: „ich denke wir sollten einen neuen privateRepoO Private-repo-c bauen lassen". Dein neuer Auftrag: dasselbe Intake-Handwerk, gleiche Form und Disziplin wie eben, für GENAU dieses Konzept.

NEUE ZIELDATEI: `INTAKE-PRIVATE-REPO-O-KART-2026-08-27.md` (damals Repo-Root, heute getrackt als `docs/intake-private-repo-o-kart-2026-08-27.md`; exakt dieser Name — ein Watcher wartet darauf).

FIXIERTER KERN (nicht verhandelbar): das Double-Dash-Prinzip — ZWEI Figuren pro Kart, Fahrer + Werfer, Rollentausch während der Fahrt, Figuren-Paare mit Synergien, Items. Alles darüber hinaus (Fantasy, Setting, Figuren, der AA-Twist, was den vierten Anlauf besonders macht) ist DEIN Vorschlagsraum. HARTE GRENZE: eigene Identität, null Nintendo-IP — keine Namen, Figuren, Item-Designs oder Strecken-Anleihen, die als Mario-Kart-Klon lesbar wären; das Prinzip „2 Figuren pro Kart mit Rollentausch" ist Mechanik und frei, die Ausgestaltung muss eigen sein.

ZUSÄTZLICH LESEN (bounded — dies ist der VIERTE Kart-Anlauf dieser Maschine, das Intake muss benennen, was diesmal anders läuft):
1. `~/private-repo-i/AGENTS.md` (~2,8 KB) — der Rahmen des dritten Anlaufs.
2. `~/private-repo-d/docs/content-ledger.md` — nur die status-Spalte: 9/12 core delivered, 3 missing, ALLE drei visuell.
3. `~/private-repo-d/docs/decision-record.md` — NUR D8, D9, D13.
Dein Intake bekommt einen Pflicht-Abschnitt „Lehren aus Anlauf 1–3": drei bis fünf Sätze, jeder mit Beleg aus diesen Dateien, und je eine konkrete Konsequenz für den ersten Schnitt.

OFFENE FRAGEN, die das Intake als solche führen muss (mit deiner begründeten Empfehlung, Owner entscheidet): Partner-Steuerung im Single-Player (KI-Partner vs. Hotseat; KEIN Netz-Multiplayer im ersten Schnitt) · 3D vs. 2.5D und das Render-Budget · Fahrphysik-Tiefe (Drift-Modell) vs. Lesbarkeit.

UNVERÄNDERT AUS DEM ERSTEN AUFTRAG: erster Schnitt ~2 Tage und FAHRBAR (mindestens: ein Kart mit zwei Figuren, eine Strecke, Rollentausch erlebbar, ein Wurf-Item, sichtbare Grafik die echten Spielzustand rendert — Rohbau ok, Telemetrie-UI verboten) · prüfbare Prädikate zahlen-/ja-nein-förmig inkl. Performance-Budget gemessen, Kausalitätstest (Rollentausch → messbare Folge), Owner-Spaß-Gate 10 min · Kill-Kriterien mit genau einem Rettungsversuch · ≥5 Non-Goals · Vertrauensstufen · Hinweis, dass die Fable-MAIN begründet widersprechen darf. Web-first TypeScript/Bun als Vorschlags-Default; für einen Private-repo-c darfst du begründet abweichen (z. B. Three.js-Ebene), die MAIN validiert.

Am Ende: kurzer Pane-Bericht (Titel + Ein-Satz-Pitch + deine Empfehlungen zu den drei offenen Fragen) und STOPP. Sag außerdem deinen aktuellen Kontext-Füllstand an.
