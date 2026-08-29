---
frage: Bestätigt oder kippt die Messlage vom 27.08. die zweifache Ablehnung eines Schwarm-Modus (§2(e) „braucht weder Modus noch Code", §4 „ein Objekt darüber wäre Verpackung"), und was ist der Zug, der die stillstehende Kennzahl bewegt?
urteil: BESTÄTIGT. Der Modus bleibt abgelehnt: keine Fähigkeit ist identifiziert, die fleet-report + Program-Bindung + Docs-Kurzkette nicht haben, und die stillstehende Kennzahl (21,6 %, selbst nachgezählt) hat eine mechanische Ursache, nämlich die ungelandete Leseseite; der Zug, der die Kennzahl bewegen kann, ist das Landen von 201f31f (Paket A), nicht ein Modus-Objekt.
bereich: [schwarm, queue, lane-lifecycle]
belege: [server.ts#compileBriefs, server.ts#openFleetReport, server.ts#repoManifestContextPlan, server.ts#buildSuccessionBrief, verify-proportion.ts#ruleFor, lane-signals.ts#laneStalled, e2e/pins.ts#RULE_REACH, lane-outcomes.jsonl, git 201f31f, git 2954eff]
nicht-gemessen: Die Bound/Unbound-Differenz ist observational (keine Kausalität); der OpenAI-Report selbst wurde nicht gelesen (Faktor 100 aus der Aufstellung übernommen); ob A den Pack live ausliefert, ist Code-Pfad-Beleg, keine Live-Quittung; e2e/context-packs.ts des Branches nur aus Commit-Message und Stat.
stand: 2026-08-29
---

# Swarm Mode — Ausarbeitung der Entscheidungsvorlage

2026-08-29, Lane `fleet/260829163538-8356`. Eingabe: `docs/schwarm-modus-aufstellung-2026-08-29.md`.
Auftrag: die fünf Fragen aus §4 der Aufstellung beantworten und die Vorentscheidung vom 27.08.
bestätigen oder kippen. Docs-only, kein Code, kein Server-Start, keine Suite.

## 0. Das Urteil und die Kennzahl, selbst nachgezählt

**BESTÄTIGT.** Beide Ablehnungsgründe vom 27.08. tragen am heutigen Baum unverändert (Belege in
Frage 1), und der Stillstand der Kennzahl ist kein Argument gegen sie, sondern ihre Konsequenz:
Die Schreibseite ist gelandet, die Leseseite nicht — deshalb KANN sich die Zahl nicht bewegen.

Eigene Zählung am 29.08. abends (gleiche Methode wie die Basislinie, alle Zeilen im Nenner;
`lane-outcomes.jsonl` im Haupt-Checkout): **612 Zeilen, 132 `killed-empty` = 21,6 %, 400 `landed`
= 65,4 %.** Die Aufstellung zählte morgens 610/131 = 21,5 %; zwei Zeilen sind tagsüber dazugekommen,
die Richtung ist unverändert. Kaveat ehrlich: 31 Alt-Zeilen (13.–22.08.) tragen den Key `result`
statt `disposition` — sie zählen im Nenner, nie im Zähler, in beiden Messdaten gleich.

Drei Zahlen, die die Gegenprobe machen (alle aus derselben Datei, observational, siehe
`nicht-gemessen`):

| Schnitt | n | killed-empty | Quote |
|---|---|---|---|
| programm-gebundene Lanes | 131 | 13 | **9,9 %** |
| ungebundene Lanes | 481 | 119 | **24,7 %** |
| Fenster ab 25.08.: gebunden | 48 | 3 | **6,3 %** |
| Fenster ab 25.08.: ungebunden | 65 | 11 | **16,9 %** |
| nur Repo claude-fleet | 446 | 111 | 25 % — **111 von 132 aller ke** |

Das ist das Gegenteil von „die vorhandenen Primitive bewegen die Zahl nicht": Wo sie benutzt
werden, ist die Quote weniger als halb. Konfundiert (jünger, strukturiertere Briefe,
Messaufträge), aber es verschiebt die Beweislast auf den, der einen Modus vorschlägt.

## 1. Die fünf Antworten

### Frage 1 — Bestätigt oder kippt die Messlage §2(e)/§4?

**Antwort: bestätigt, mit Begründung in drei Teilen.**

Erstens: beide Prämissen der Ablehnung stimmen am heutigen main. `server.ts#openFleetReport`
validiert Status gegen die geschlossene Liste, Text ≤ 4000 Zeichen, und hat genau zwei 409-Türen —
Empfänger (`clarificationReceiverFor`) und Zustellbudget (`slotDeliveryBudget`) —, und die
Program-Bindung liefert den Empfänger, bevor Watch-Evidenz überhaupt gelesen wird
(`server.ts#clarificationReceiverFor`, Kommentar „PROGRAM BINDING WINS"). Die Docs-Kurzkette steht:
`verify-proportion.ts#ruleFor` mit `DOC_STEPS = ["install","pins"]`. Zweitens: der Stillstand hat
eine mechanische Ursache — `server.ts#compileBriefs` ruft `runEnhance(t.text, repo,
freshLaneFacts(laneBase))`, und `freshLaneFacts` trägt nur Branch/Lane-Git-Fakten. Keine Messung,
kein Index, keine Notiz erreicht eine Lane beim Start. Drittens: die Gegenfähigkeitsliste ist leer.
Die drei Kandidaten: Fan-out-Steuerung (der beaufsichtigte Pfad hat ohnehin keinen Lane-Deckel,
nur `MAX_SLOTS = 16`; Schwarmgröße ist eine Praxiszahl, `docs/schwarm-praxis.md` Deckel-Tabelle) ·
Synthese (ist bewusst ein Schritt des Laufs, praxis §6, kein Serverobjekt) · Peer-Bus während des
Laufs (bewusst verweigert — im Vorfall war genau der Bus der Pathologie-Verstärker: 93 % des
Verkehrs aus unlösbaren Tasks). Ein Modus-Objekt müsste die 409-Tür-Semantik duplizieren und
verrottete gegen sie.

**Kosten eines falschen „bauen":** ein zweites Koordinations-Objekt über `openFleetReport` +
Program-Bindung, das Empfänger- und Budget-Semantik nachbildet und gegen sie driftet — und das den
Slice bindet, den die Leseseite braucht. **Kosten eines richtigen „lassen":** null, sofern A landet;
ohne A verrottet der eingeschriebene Korpus zu totem Kapital (30+ Notizen, keine Leseseite).

**Der Zug, der die Kennzahl bewegt:** A landen (Frage 2). Rangfolge: A zuerst (billigste Wirkung,
blockiert die Kennzahl), D1 danach (unabhängig, Sensor-only, vgl. Frage 3).

### Frage 2 — Was ist der billigste Weg zur Leseseite?

**Antwort: A landen, wie es ist — Commit `201f31f` von `fleet/260827123336-6f18`, ohne
Überarbeitung, ohne Deploy.**

Belege: Die Zustellmaschine ist auf main vollständig. `server.ts#briefAndSend` mischt pro Dispatch
die Fleet-Seeds mit dem Repo-Manifest des ZIEL-Repos und stellt `brief + anchorBlock +
LANE_EXIT_FOOTER` zu; gelesen wird das Manifest am Integration-HEAD
(`server.ts#repoManifestContextPlan` via `git show head:.fleet/context-packs.json`). Der Kommentar
am `programMainContextPlan` sagt es wörtlich: Ein neuer Fleet-Pack brauchte früher eine
TypeScript-Änderung und ein Deploy — „It is now a tracked JSON commit, read at `preflight.head`
like any other." D.h. nach dem Land ist der Pack beim NÄCHSTEN Dispatch sichtbar, kein Neustart.
Der Pack trägt `triggers: ["always"]`, und `DISPATCH_CONTEXT_TRIGGERS = ["always","verification"]`
— also bricht `e2e/pins.ts#RULE_REACH` („every active context pack has a trigger some delivery seam
actually passes") nicht; der Branch hat den Trigger-Mechanismus bewusst nicht angefasst.
Mechanik geprüft: `git merge-tree` beider Bäume heute konfliktfrei; null Commits auf main seit dem
Branchpunkt (`2d88521`) berühren die zwei Dateien des Branches. Wirkung deckt den Hotspot: 111 von
132 `killed-empty`-Lanes liefen im Repo claude-fleet — genau dem Repo, dessen Manifest A erweitert.
Grenze, ausdrücklich: Fremd-Repos (private-repo-o, private-repo-j …) lesen nur die Fleet-Seeds aus
`context-packs.ts`; für sie bräuchte der Pack einen Seed-Eintrag (TypeScript-Änderung + Deploy).
Das ist aufgeschoben, bis die Wirkung hier gemessen ist — nicht verweigert.

**Done-Kriterium (hart):** Nach dem Landen von `201f31f` zeigt eine NEUE Zeile in
`context-receipts.jsonl` den Pack unter `selected` — nicht unter `omitted`.
**Verify:** `rg -uu -c 'messnotiz-index' context-receipts.jsonl` liefert ≥ 1 (Quittungen sind
gitignored, darum `-uu`), UND `bun e2e/pins.ts` endet `ALL PASS` (RULE_REACH intakt).

### Frage 3 — Trägt der Negativwissens-Befund einen eigenen Schnitt?

**Antwort: nein. Schreibseite ist gelandet; was fehlt, sind zwei Zeilen Prosa an zwei Stellen,
keine Route, keine Skill-Zeile.**

Die Schreibseite deckt den Fall genau: `.claude/skills/mess-notiz/SKILL.md` (getrackt, auf main)
gilt für „messen, zählen, vergleichen, prüfen" — ein Beweis, dass ein Weg nicht trägt, ist eine
Messung; das `urteil`-Feld trägt „trägt nicht" als Antwort; gelandet wird über die Docs-Kurzkette
ohne Suite-Mutex. Die Route existiert: `fleet-report` mit `failed`/`needs-main` PLUS die Datei.
Zwei echte Lücken, beide billig: (i) Fremde Harnesses haben das Skill nicht im Worktree
(`.agents/` gitignored) — die Praxis löst das mit Template-im-Brief und belegt, dass es reicht:
Die GLM-Gegencheck-Lane vom 27.08. lieferte eine formgerechte Notiz nur aus dem Brief
(`docs/schwarm-praxis.md` §5, Beleg `docs/messungen/2026-08-27-gegencheck-schwarm-programm.md`).
(ii) Das Regelbuch-Generat lehrt noch das VOR-mess-notiz-Modell: Fragment `einstieg.md`, Zustand
(b): „das Ergebnis ist der Pane-Bericht und muss geerntet werden, sonst stirbt es mit dem Slot."
Das widerspricht der gelandeten Norm (das Ergebnis ist eine Datei und stirbt NICHT mit dem Slot).
**Kosten wenn stehen gelassen:** eine MAIN, die dem Regelbuch folgt, erntet Pane-Berichte statt
Notizen zu erwarten — die Norm, die die Kennzahl senken soll, wird vom eigenen Regelbuch
konterkariert. **Fix ist Owner-seitig** (`rulebook/` ist gitignored, privates Overlay): Fragment
`einstieg.md` (b) auf die Notiz umschreiben, dann rendern (Befehl steht in Zeile 5 von
`rulebook.ts`). **Done-Kriterium, falls promoviert:** nach dem Render nennt die (b)-Zeile in
`CLAUDE.md` des Haupt-Checkouts `docs/messungen/` — prüfbar mit `rg -n 'messungen'
<haupt-checkout>/CLAUDE.md`; ein Verify in DIESEM Baum existiert dafür nicht, weil das Fragment
hier nicht getrackt ist.

### Frage 4 — Was folgt aus „generationenübergreifend"?

**Antwort: es ist dieselbe Sache in zwei gerichteten Formen; strukturell fehlt nichts dazwischen —
eine Naht ist benennbar, aber nicht kennzahlrelevant.**

Der Schwarm schrieb ungerichtet an Nachfolger (an wen auch immer kommt). Fleet hat beide
gerichteten Formen: `POST /api/self/succeed` + `HANDOFF.md` ist gerichtete Nachfolge EINES Scopes
(`handoffCommittedAfterOpen` verlangt committed, clean, neuer als die Session; Program-MAIN-Succession
transferiert die Bindung), und `docs/messungen/` + `INDEX.md` ist das ungerichtete
Generationengedächtnis über Scopes hinweg — Schreibseite gelandet, Leseseite ist A. Die Naht:
`server.ts#buildSuccessionBrief` (die generische Succession) nennt `state.sh`, `register.sh`,
HANDOFF-Top-Abschnitt, Live-Queue — aber KEINEN Anchor-Block. Dispatchte Lanes, Program-MAIN- und
Supervisor-Gründungen bekommen `anchorBlock` mitgeliefert; ein mid-flight nachgerückter Successor
bekommt ihn nicht. **Kosten:** klein und real nur für lange MAIN-Sessionen, die mitten im Programm
succeeden — der Nachfolger muss auf den Index hingewiesen werden (oder liest ihn nie).
**Vorschlag, klein und NICHT vor A/D1:** `buildSuccessionBrief` um den Anchor-Block erweitern —
ein TypeScript-Schnitt, Check in der Programs-Familie (`e2e/programs.ts#selfSucceed` existiert
dort bereits als Helfer). **Done-Kriterium, falls dispatcht:** eine Succession-Quittung bzw. der
geloggte Successor-Prompt enthält den `messnotiz-index`-Anchor, und der neue Check in
`e2e/programs.ts` endet grün; Verify: `./e2e-isolated.sh` (Succession ist Lifecycle — die langsame
Stufe), TAIL `ALL PASS`.

### Frage 5 — Was folgt aus „das Harness war der Unterschied, Faktor 100"?

**Antwort: keine neue Gate-Folge. Fleet verkörpert die Lehre bereits strukturell — und sie ist
die Bestätigung des Programms selbst.**

Der Vorfalls-Befund sagt: bei Produktions-Harness plus System-Prompt fiel die Neigung zur
Infrastruktur-Kompromittierung um über Faktor 100 — der Unterschied lag im Harness, nicht im
Modell. Fleets Kontrollfläche ist genau das: der Brief (Write-Set, Stop-Line, Exit-Footer), die
deterministische Verify-Kette, der serverseitige Land-Gate — nicht die Modellwahl. Und Fleet
entscheidet sich bewusst für die legitime Fläche als gefährliche: Lanes laufen same-uid mit
Vollzugriff (Fragment `deploy.md`: „FULL ACCESS IST DER NORMALZUSTAND", Owner-Entscheid `fc8f4ad`,
2026-08-12). Genau deshalb ist die Konsequenz des Faktor-100-Befunds kein neues Gate, sondern
dieses Programm: P0/A sind Harness-Edits (Packs, Briefs, Skills) — der Befund sagt, DASS das die
hochhebelige Stelle ist. Die zweite Kante trägt genauso: Harness-Edits wirken in beide Richtungen
hoch — deshalb sind `RULE_REACH` und die Pins die richtigen Guards, und deshalb ist A (18 Zeilen
Daten, am HEAD gelesen) die richtige Bauart für einen Harness-Eingriff: klein, getrackt, ohne
Deploy, mit Sonde. **Nichts zu bauen. Kein Done-Kriterium nötig, weil kein Vorschlag.**

## 2. Fünf Befunde, gerankt

1. **Der Flaschenhals ist die Leseseite, und sie liegt konfliktfrei bereit.** `201f31f` = 18 Zeilen
   Manifest + 102 Zeilen Sonde; merge-tree konfliktfrei; nach dem Land ohne Deploy beim nächsten
   Dispatch wirksam (`server.ts#repoManifestContextPlan` liest am HEAD). Deckt das Repo mit 111 von
   132 `killed-empty`-Lanes. Kosten des Zögerns: jeder weitere Messlauf schreibt gegen ein
   geschlossenes Regal.
2. **Die vorhandenen Primitive wirken dort, wo sie benutzt werden** (9,9 % vs. 24,7 %;
   Fenster ab 25.08.: 6,3 % vs. 16,9 %). Observational, konfundiert — aber die Beweislast für einen
   Modus steigt, nicht sinkt.
3. **Die Gegenfähigkeitsliste für einen Modus ist leer.** Fan-out: Praxis + `MAX_SLOTS`; Synthese:
   Laufschritt; Peer-Bus: bewusst verweigert (Vorfall: Bus als Verstärker der Aussichtslosigkeit).
   Ein Modus-Objekt wäre Duplikat der 409-Tür-Semantik mit Drift-Risiko.
4. **`stuck-looping` ist Vokabular ohne Produzent.** `DIGEST_CONDITIONS` führt das Wort
   (server.ts:21075), der Digest-Prompt verbietet es dem Worker ausdrücklich (server.ts:21145),
   und `laneStalled` verlangt per Konstruktion `idle` (`lane-signals.ts#STALLED_RULES`) — eine
   druckende Lane kann nie stallen. D1 (`2954eff`) schließt genau diese Lücke, ist Sensor-only
   (nichts handelt auf ihm), und merge-tree ist konfliktfrei — aber 24 Commits auf main berühren
   seine drei Dateien seit dem Branchpunkt: Rebase-Aufwand ist echt, Rang nach A.
5. **Das Regelbuch-Generat konterkariert die gelandene Norm** (Zustand (b) lehrt Pane-Bericht statt
   Notiz; Frage 3). Einzeiler, Owner-seitig. Kosten des Stehenlassens: jede MAIN, die dem Regelbuch
   folgt, erntet falsch.

## 3. Methode

Nur lesend plus `git`/`bun`-Abfragen: `server.ts` (`compileBriefs`, `freshLaneFacts`,
`openFleetReport`, `clarificationReceiverFor`, `slotDeliveryBudget`, `briefAndSend`,
`repoManifestContextPlan`, `buildSuccessionBrief`, `buildSuccessionBrief`-Umfeld, DIGEST-Zeilen),
`verify-proportion.ts#ruleFor`, `lane-signals.ts#STALLED_RULES`/`laneStalled`,
`e2e/pins.ts#RULE_REACH`, `context-plan.ts#contextOmissionFor`, `context-packs.ts#CONTEXT_PACKS`,
`.claude/skills/mess-notiz/SKILL.md` (getrackt, auf main), `docs/messungen/INDEX.md`;
Branches `fleet/260827123336-6f18` (`201f31f`) und `fleet/260827083510-80fe` (`2954eff`) per
`git show`/`git merge-tree`; Landed-Commits `c098d87`/`2d88521`/`6ee13a3`/`dda5077` auf main
bestätigt; Kennzahl aus `lane-outcomes.jsonl` des Haupt-Checkouts selbst gezählt (612 Zeilen).
Regelbuch-Fragmente aus dem Haupt-Checkout gelesen (`rulebook/` ist gitignored). Kein Server
gestartet, keine Suite, kein Suite-Mutex.

## 4. Was diese Notiz nicht gemessen hat

- **Kausalität der Bound/Unbound-Differenz.** Konfundiert um Alter der Zeilen, Auftragsart
  (Messaufträge vs. Implementierung) und Brief-Qualität. Sie stützt die Bestätigung nur als
  Richtungshinweis, nicht als Beweis.
- **Den OpenAI Technical Report selbst.** Faktor 100, Bus-Mechanik und Zitate sind aus der
  Aufstellung und `docs/schwarm-programm-2026-08-27.md` übernommen, nicht erneut am PDF geprüft.
- **Die Live-Auslieferung des Packs nach einem A-Land.** Der Beleg ist der Code-Pfad plus die
  Sonde auf dem Branch; die Quittung zu sehen ist Teil des Done-Kriteriums, nicht dieser Notiz.
- **`e2e/context-packs.ts` und die D1-Checks zeilenweise.** Aus Commit-Message und Stat
  charakterisiert, nicht Zeile für Zeile gelesen. Die merge-tree-Aussagen sind objektseitig
  geprüft, ersetzen aber keine Review der Sonden.
- **Die 31 Alt-Schema-Zeilen** (13.–22.08., Key `result`) wurden im Nenner belassen und im Zähler
  nie gezählt — wie in der Basislinie; eine bereinigte Zählung steht aus.
- **Keine Suite gefahren.** Die Verify-Zeile dieser Notiz ist die Docs-Kurzkette (install + pins).
