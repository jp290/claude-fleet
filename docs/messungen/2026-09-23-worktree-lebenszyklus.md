---
frage: Wie kann Fleet Worktrees länger für Owner-Review offenhalten, testbar machen, wiederholt begutachten und vor dem Land an Checkpoints abgleichen?
urteil: Zuerst eine ausdrücklich gehaltene, sichtbare Review-Lane mit unveränderlicher Diff-Identität; dann eine befristete isolierte Test-Instanz und erneute beratende Reviews. Vorgezogener Resolve braucht einen eigenen Konfliktvertrag und bleibt unter der Schnittlinie.
bereich: [lane-lifecycle, worktrees, review, preview, zusammenarbeit]
quelle: Owner-Wortlaut 2026-09-23 03:2x; Code-Stand 512f881822dc; Haupt-Checkout-Ledger bis 2026-09-23T07:20:04Z
marken: [verifiziert-am-code, ledger-gemessen, vorschlag, keine-topologie-entscheidung]
belege: [server.ts#createWorktree, server.ts#openLaneInSlot, server.ts#mergeJob, server.ts#landLane, server.ts#laneAutoCloseRefusal, server.ts#pushUndo, lane-signals.ts#SPENT_RULES, server/types.ts#LaneForm, src/client.ts#renderSlots, e2e-isolated.sh, lane-outcomes.jsonl, docs/messungen/2026-09-16-grosse-diffs-review-teams.md]
nicht-gemessen: Live-Env jenseits watchdog.sh, laufende Lanes und Test-Instanzen, menschliche Reviewzeit, Konflikthäufigkeit an Zwischenständen, Vorschau-Ressourcen, Ursachen nicht typisierter Schließungen, zweite Maschine.
stand: 2026-09-23
---

# Worktree-Lebenszyklus für Review vor Land

Die vorgeschlagenen Karten sind **keine gestarteten Aufträge**. Die Vorarbeit `docs/messungen/2026-09-16-grosse-diffs-review-teams.md` §3 setzt Review-Paket und Schnitt vor Produktionsbeginn bereits auf die Agenda; diese Notiz ergänzt die Lebensdauer des konkreten Worktrees. Die Topologie A aus `docs/dual-host-topologie-entscheidung-2026-09-05.md` bleibt stehen. Die verwandten Zeilen 29ad3230 (W5d) und 3659ee3c (zwei Boards) werden hier weder dupliziert noch entschieden.

## §0 Urteil

| Id | Befund | Kosten |
|---|---|---|
| 1 | Der aktuelle `landLane`-Pfad entfernt die Arbeitskopie nach erfolgreichem Land; Shelve hält sie auf Platte, befreit aber den Slot. Ein ausdrücklicher Review-Halt für eine laufende Lane fehlt (`server.ts#landLane:5360`, `#removeWorktreeSafe:5169`, Shelve-Route `:39665`). | Ohne Halt konkurriert längeres Review mit Autoclose und knappen Slots; ein dauerhaft laufender Test verbraucht zusätzlich Ressourcen. |
| 2 | auto-③ kann über `Task.review: advisory` trotz fleet-weitem Tick 0 einen Diff einmal begutachten (`server.ts#tickAutoReview:17283`, `#fileLaneReview:17376`; `docs/harness-adapter.md` §auto-③). | Eine periodische Meinung über einen **unveränderten** Diff und ein Kommentar-Thread existieren dadurch nicht; Wiederholung kostet Agentläufe und braucht einen klaren Takt. |
| 3 | Die isolierte Suite startet bereits eine Wegwerf-Instanz mit eigenem tmux-Socket und Port (`e2e-isolated.sh:1-65`); `lanePreviewFact` meint nur den Suite-Job (`server.ts:2549`). | Eine vom Owner erreichbare Produkt-Testinstanz mit Lebensdauer, URL, Kandidaten-SHA und Aufräumen ist ein neuer Betriebsakt. |
| 4 | `mergeJob` rebased und verifiziert vor Land, hält konfliktaufgelöste Kandidaten zur Sichtung an (`server.ts#mergeJob:28125` und `:28420-28710`). | Frühes Resolve kann einen Kandidaten umschreiben; ein späterer Integrationsstand macht das Ergebnis erneut prüfpflichtig. Keine bloße UI-Aktion. |
| 5 | Das Board hat Merge-Diff-Vorschau und Slotdarstellung (`src/client.ts#showLandReview:2140`, `#renderSlots:7054`). | Es zeigt keinen gemeinsamen Zeitstrahl von Halt, Vorschau, Review-Diff, Checkpoint und Land. Ein Status ohne Diff-Identität könnte veraltete Belege grün aussehen lassen. |

## §1 Ist-Zustand am Code und Ledger

**Gründung bis Abschluss.** `server.ts#createWorktree:4947` erzeugt Branch/Pfad vom Integrationszweig. `server/types.ts#LaneForm:1639` kennt `worktree` und `clone`; `createWorktree:4964-4987` baut für `clone` eine Kopie mit `--no-hardlinks`, sonst `git worktree add`. `server.ts#syncLaneRefs:5045` spiegelt die Clone-Refs; `#openLaneInSlot:5833` bindet Arbeitskopie und LaneRef an den Slot. `#tickDispatch:15488` nutzt den Startplan, Repo-/Program-Deckel und freie Slots. `#laneOutsideSurface:9851` vergleicht die committed Pfade mit der Kartenfläche; das ist ein später Befund, kein Startverbot.

**Review und Integration.** `server.ts#tickAutoReview:17283` verlangt `laneDoneLooking`, freie Git-Operation und versucht einen Zustand nur einmal; bei opt-in bindet `#fileLaneReview:17376` den Befund an Patch-ID, Head und Aufgabe. `docs/harness-adapter.md` §auto-③ nennt den fleet-weiten `FLEET_AUTO_REVIEW_MS=0` und die separate `Task.review=advisory`-Tür. `server.ts#mergeJob:28125` führt Preflight/Rebase, Konflikt-Resolve und Verify; der saubere Pfad kann nach Gate direkt landen, ein zu sichtender Resolve bleibt reviewable. `#pushUndo:20396` merkt begrenzt Land-Records für einen möglichen Undo-Pfad; er ist kein Checkpoint einer offenen Lane. `#landLane:5360` baut Outcome, `#removeWorktreeSafe:5169` verweigert bei Dirty/ungepushten Commits, entfernt dann die Arbeitskopie und beendet den Slot. Die Shelve-Route `server.ts:39665-39673` protokolliert `shelved`, beendet den Slot und lässt Worktree/Branch liegen. Autoclose `#laneAutoCloseRefusal:17503` verlangt unter anderem `laneSpentLooking`, passenden Task/Program-Bezug und entschiedene terminale Lane-Reports durch die zuständige MAIN; offene Owner-Wartezeit und Merge-Verdikt verweigern. `lane-signals.ts#SPENT_RULES:736` ergänzt zu `STALLED_RULES` den belegten sauberen Baum.

**Was zum Schließen drängt — und was das Ledger davon misst.** Code-Schwellen sind keine Outcome-Ursachen. `server.ts#STALLED_IDLE_MS:17272` defaultet auf 30 Minuten; `lane-signals.ts#STALLED_RULES:680` fordert beobachtete lebende Pane, Idle-Schwelle, keinen Git-Op/Blocker, `awaiting:null`, `ahead===0`. `server.ts#LANE_AUTOCLOSE_ON:17460` ist ohne Schalter aus; `watchdog.sh:195` setzt `FLEET_LANE_AUTOCLOSE=1` und `FLEET_DISPATCH_MAX_LANES=1` für seinen Spawn. Andere Env-Quellen wurden nicht geöffnet. `server.ts#tickDispatch:15618` hält neue Zeilen am Repo-/Program-Deckel zurück; er schließt keine bestehende Lane. `server/types.ts#MAX_SLOTS:22` und `server.ts#slots:2059` begrenzen das Board auf 16 Slots.

Read-only-Zählung aus `/Users/owner/claude-fleet/lane-outcomes.jsonl`, alle **1.239 Zeilen** bis 2026-09-23T07:20:04Z, nach `disposition` (keine Branch-Deduplizierung): 953 `landed`, 183 `killed-empty`, 44 `killed-dirty`, 25 `shelved`, dazu 32 ältere `result: landed` und 2 `result: abandoned` ohne `disposition`. **8/1.239** tragen `autoClose`; alle acht enden `killed-empty`. **0 Zeilen** tragen einen eigenen Ursachenwert `STALLED_IDLE_MS`, Repo-Lane-Deckel oder 16-Slot-Deckel: ihr kausaler Anteil ist **unknown**, nicht null Schließungen. Von 776 Zeilen mit `sessionMs` liegen 586 bei mindestens 30 Minuten; Dauer ist keine Messung von Pane-Idle und beweist keinen Stall. Auch `killed-empty` ist keine gleichbedeutende Autoclose-Ursache. Ledger-Zahlen vom Haupt-Checkout, weder dessen Worktrees noch laufende Slots wurden geöffnet.

## §2 Fünf Owner-Wünsche

| Wunsch | Was es heute schon gibt (Symbol) | Was fehlt | Kleinster baubarer Schnitt | Risiko |
|---|---|---|---|---|
| Manche Worktrees lange offen | `server.ts#laneAutoCloseRefusal`, `#removeWorktreeSafe`; Shelve `:39665` | Ein persistenter, ausdrücklich gesetzter Review-Halt samt sichtbarer Frist/Entscheidung; Shelve beendet die Pane. | Halt pro Lane speichern und in `#renderSlots` mit Grund, Diff-Head und Ablauf zeigen; Autoclose verweigert bei Halt. | Slot-/Repo-Deckel blockieren neue Arbeit; ohne Ablauf sammeln sich gehaltene Kopien. |
| Über Test-Instanz selbst reviewen | `e2e-isolated.sh` (isolierter Socket/Port), `server.ts#lanePreviewFact` (Suite-Beleg) | Owner-erreichbare Produktinstanz für genau einen Commit, URL, Ablauf, Cleanup und Trennung von Live-Daten. | Befristeter Einzel-Preview aus einem versiegelten Commit in eigener Scratch-Kopie; Board zeigt Adresse/Head/Ablauf. | Ressourcen und fremde Seiteneffekte; der Test darf keine Live-Credentials oder Produktionsdaten übernehmen. |
| Periodischer Diff-Review-Agent mit Kommentar | `server.ts#tickAutoReview`, `#fileLaneReview`, `Task.review=advisory` | Zeitgesteuerte Wiederholung am selben Diff, kommentierbare Historie und Kostenbudget. | Opt-in-Intervall nur für gehaltene Lane; jeder Lauf nennt Patch-ID, Kommentar und nächsten Fälligkeitspunkt; alte Kommentare bleiben datiert. | Gleichlautende Reviews verbrauchen Budget; veraltete Kommentare dürfen keinen aktuellen Diff abdecken. |
| Parallele Worktrees an Checkpoints vorzeitig resolven | `server.ts#mergeJob`, `#mergeParked`, `#pushUndo` | Ein nicht landender Checkpoint mit expliziter Basis, Konfliktliste, neuer Kandidatenidentität und erneuter Verify-Pflicht. | Zuerst nur einen read-only Konfliktbericht zweier benannter Branches an einem gemeinsamen Basis-SHA speichern; Resolve gesondert entscheiden. | Rebase/Resolve schreibt Branches um; parallele Bearbeiter können denselben Stand unterschiedlich interpretieren. |
| Klar visualisieren | `src/client.ts#renderSlots`, `#showLandReview`, `#reviewBody` | Lane-Zeitstrahl und einheitliche Anzeige von `unknown`, veraltetem Review, Test-URL und Checkpoint-Basis. | Im bestehenden Slot/Report-Bereich dieselbe Branch-/Patch-/Head-Identität neben Halt, Preview und Review zeigen. | Zu viele grüne Chips können Urteil und Messlücke verwechseln; Board-Arbeit überschneidet sich mit Zeile 3659ee3c. |

## §3 Rangliste und Schnittlinie

1. **Expliziter Review-Halt und sichtbarer Kandidat.** Niedrigster Mechanik-Eingriff mit direktem Effekt auf die lange offene Lane; Frist und Slotkosten zeigen. Visualisierung beginnt im bestehenden Slot, nicht als neues Dashboard.
2. **Befristete eigene Test-Instanz für einen versiegelten Lane-Commit.** Macht Owner-Selbst-Review vor Land möglich, sobald Halt und Kandidatenidentität sichtbar sind. Das isolierte E2E-Muster ist Beleg für Isolation, keine fertige Produktvorschau.
3. **Opt-in Wiederholungsreview mit datiertem Kommentar.** Baut auf auto-③ auf; Intervalle, Obergrenze und Diff-Identität begrenzen Kosten und stale Belege.

**Schnittlinie: Karten 1–3 sind erste baubare Schnitte; 4–5 sind Folgeentscheidungen, nicht freigegeben.** Der Wortlaut, an dem der Schnitt endet:

> „ich habe kurz nachgedacht und ich denke das wir unser worktree management echt nochmal gut durchdenken und ausbauen sollten, ich haette Lust manche worktree's laenger offen zu halten, ueber test-instanzen selbst zu reviewen wie auch immer und dann spaeter erst zu mergen, ich denke das solch ein System der Prototyp waere um mit claude fleet auch erfolgreich mit anderen zusammen zu arbeiten wie auch immer, man koennte dann auch besser periodisch einen agenten an ein review setzen das sich den aktuellen diff mit den Ideen dahinter anguckt und im zweifel einen kommentar abgibt.. man koennte parallele worktree's an bestimmten checkpoint's einfach vortraeglich resolven, statt erst beim merge. Und die Visualisierung waere auch echt gut denke ich, das koennte man klar darstellen."

**4 — Checkpoint-Konfliktbericht vor Resolve.** Zuerst die Basis-/Branch-Identität und Konfliktflächen lesend erheben; erst nach einem benannten Entscheid über Branch-Umschreiben einen Resolve-Aktor bauen. `mergeJob` darf dabei nicht als heimlicher Vorab-Land missbraucht werden.

**5 — Gemeinsamer Zeitstrahl.** Nach den drei ersten Kandidatenbelegen und dem Checkpoint-Vertrag in die vorhandene Board-Fläche integrieren. Die zwei-Host-Board-Zeile 3659ee3c besitzt die Host-Sicht; hier geht es nur um Lane-Zustände.

### Karte 1 — Review-Halt

```text
ROLLE: codex/gpt-6-sol/high
GROESSE: mittel
FLAECHE: server.ts#laneAutoCloseRefusal server/types.ts#LaneRef src/client.ts#renderSlots e2e/tasks.ts
VERIFY: install, pins, tsc, build, e2e-isolated
DONE: Eine von der MAIN gehaltene Lane bleibt bei 31 Minuten Idle offen und zeigt genau 1 Halt mit Grund, Head und Ablauf; nach Ablauf entscheidet der bestehende Autoclose-Pfad wieder, und eine nicht gehaltene Lane verhält sich wie zuvor.
VERBOTEN: Kein Land durch Halt · keine pauschale Abschaltung von Autoclose · keine Änderung am 16-Slot-Deckel.
Ein ausdrücklich gesetzter, persistenter Review-Halt an server.ts#laneAutoCloseRefusal und server/types.ts#LaneRef hält eine Lane bis zu einem sichtbaren Ablauf offen; src/client.ts#renderSlots und e2e/tasks.ts tragen die Anzeige und Probe.
```

### Karte 2 — isolierte Selbst-Review-Vorschau

```text
ROLLE: codex/gpt-6-sol/high
GROESSE: mittel
FLAECHE: e2e-isolated.sh server.ts#lanePreviewFact src/client.ts#renderSlots e2e/tasks.ts
NEU: lane-preview.sh
VERIFY: install, pins, tsc, build, e2e-isolated
DONE: Genau 1 Preview einer gehaltenen Lane startet aus einem festgehaltenen Head auf eigenem Socket/Port, zeigt Head/URL/Ablauf im Board und ist nach 30 Minuten oder Stop nicht mehr erreichbar; ein geänderter Head markiert den Beleg als veraltet.
VERBOTEN: Keine Live-Credentials oder Live-Daten übernehmen · keinen zweiten Server mit Default-Socket/Port starten · kein Land aus Preview ableiten.
Ein befristeter Preview in lane-preview.sh nutzt das Isolationsmuster von e2e-isolated.sh; server.ts#lanePreviewFact und src/client.ts#renderSlots zeigen nur den belegten Kandidaten, e2e/tasks.ts prüft Ablauf und Head-Wechsel.
```

### Karte 3 — wiederholter beratender Review

```text
ROLLE: codex/gpt-6-sol/high
GROESSE: mittel
FLAECHE: server.ts#tickAutoReview server.ts#fileLaneReview src/client.ts#reviewBody e2e/tasks.ts
VERIFY: install, pins, tsc, build, e2e-isolated
DONE: Bei genau 1 opt-in gehaltenen Lane entstehen nach zwei fälligen Intervallen höchstens 2 datierte Kommentare mit derselben Patch-ID; ein Head-Wechsel ohne Patch-Wechsel erzeugt keinen neuen Diff, ein geänderter Patch macht beide alten Kommentare sichtbar veraltet.
VERBOTEN: Kein Review als Land-Gate · kein fleet-weiter Auto-Start · keine unbegrenzten Agentläufe oder automatische Owner-Entscheidung.
Ein begrenzter periodischer Opt-in auf server.ts#tickAutoReview und server.ts#fileLaneReview schreibt datierte Kommentare; src/client.ts#reviewBody zeigt ihren Patch-Bezug, e2e/tasks.ts prüft Intervall und Veraltung.
```

Die Karten beschreiben ein mögliches Programm, nicht eine Befugnis dieser Lane. Die Vorarbeit zu großen Diffs empfiehlt weiterhin das Review-Paket je Änderung und einen prüfbaren Schnitt **vor** Arbeitsbeginn. Der Program-Lebenszyklus-Entwurf `docs/program-lebenszyklus-2026-09-04.md` §0/§3 ist Vorarbeit, kein Beleg für hier bereits gebaute Vorschau oder Checkpoints. `docs/messungen/ernte-arbeit-worktrees-2026-08-26.md` zeigt patch-echte Alt-Worktrees und Grenzen ihrer Ernte; keine dortige Worktree-Klassifikation wurde hier wiederholt. `docs/messungen/denksession-zusammenarbeit-2026-09-02.md` §2 und `2026-09-04-architektur-zusammenarbeit.md` §1 liefern die Zusammenarbeits- und Lebenszyklusfrage als Vorarbeit, ihre damaligen Ledgerzahlen werden hier nicht übernommen.

### Nachtrag 2026-09-24 — Karte 1 korrigiert: Parken statt Halt

Die Orchestratorin hat §3 Punkt 1 per Kommentar 45da307f/b84f7ae0 an Zeile bbac253c revidiert: ein Halt, der Slot und Schreibfläche besetzt, verschärft die gemessene Lastform (5/7 Lane-Kapazität belegt, 14 queued). Gebaut wurde darum auf Branch `fleet/260924000549-f855` (Shas setzt die MAIN nach dem Land ein) ein **Review-Parken, das den Slot freigibt**, als opt-in der bestehenden Shelve-/Attach-Wege:

- `POST /api/slots/:id/shelve` mit `review:true` (optional `hours`, Default 168, Deckel 720) nimmt nur einen sauberen Baum an, dessen neuester eigener Report `complete` ist und von seiner MAIN angenommen wurde (Owner- oder Regel-Verdikt zählt nicht). Es erzeugt genau einen `server/types.ts#LaneReviewCandidate` mit Task-IDs, Branch, Head, Base, Report-ID und Frist, gespeichert im Shelve-Eintrag des Pfads. Ohne `review` bleibt Shelve unverändert.
- `server.ts#detachSlotTasks` lässt die Zeilen des Kandidaten `sent` ohne Slot. Keine Release-/Dispatch-Tür startet sie, der Boot-Requeue überspringt sie, `unqueue` verweigert. Verschwindet der Worktree (remove, discard, beim Boot fehlend), gehen sie auf `pending` zurück.
- Das Board (`server.ts#freshenWorktreeBoard`) zeigt die Identität und `expired` nach Fristablauf. Die Frist entfernt nichts.
- Der Attach desselben Worktrees nimmt den Kandidaten wieder auf: gleiche Base/BaseSha, dieselben Zeilen an den neuen Slot, Gründungszeile und Program zurück auf den Slot, `LaneRef.resumedFrom` mit `verify:"stale"`. Ein zweiter Attach antwortet 409.

Karten 2 und 3 bleiben wie oben unter der Linie. Sie setzen jetzt einen geparkten Kandidaten voraus statt eines gehaltenen Slots.

### Nachtrag 2026-09-24 — Karte 2 gebaut: Vorschau eines geparkten Kandidaten

Zeile 6ec36333, auf Branch `fleet/260924072307-c3f2` (Shas setzt die MAIN nach dem Land ein). Die zwei offenen Festlegungen hat die Orchestratorin nach Owner-Freigabe gesetzt: **Erreichbarkeit** = die Bind-Adresse des Boards (`FLEET_HOST`), nie eine Wildcard; **Budget** = höchstens 2 gleichzeitige Vorschauen fleet-weit, je Kandidat genau eine, Ablauf 30 Minuten. Budget und Ablauf sind Env-Knöpfe (`FLEET_LANE_PREVIEW_MAX`, `FLEET_LANE_PREVIEW_TTL_MS`).

- `POST /api/review-candidates/:id/preview` (Owner) startet `lane-preview.sh`. Das Skript nimmt per `git archive` nur den **getrackten Baum des gespeicherten Heads**. Arbeitsbaum, `.env`, `fleet.json`, Ledger und `CLAUDE.md` kommen nicht mit, und das Skript prüft vor dem Start, dass sie fehlen. Die Instanz bekommt ein eigenes Scratch-Verzeichnis, einen tmux-Socket `fleetpv<id>`, einen Port aus 25400–25419 (Bind-Probe, nie 8790/8899) und einen frischen Token. Ihr `HOME` ist eigen, `FLEET_CMD=true`, alle Agent-Kommandos zeigen auf `false`. Die Umgebung des Skripts ist eine Allowlist, kein Abzug von der Server-Umgebung.
- `server.ts#startLanePreview` belegt den Datensatz synchron als `starting`. Ein zweiter Start desselben Kandidaten und ein Start über das Budget werden darum mit Namen abgelehnt, nie gerannt. Je Kandidat gibt es genau einen Datensatz `server/types.ts#LanePreview` mit Start, Ende (`stopped`/`expired`/`failed`) und Grund. Er ist getrennt von `server.ts#lanePreviewFact`, das den Suite-Job der Lane beschreibt.
- Das Ende kommt über `POST …/preview/stop`, über den Server-Timer, beim Boot nach verpasster Frist oder wenn der Worktree verschwindet (`dropShelved`). Als Rückfall für einen Server, der zur Frist nicht läuft, beendet `lane-preview.sh reap` die Instanz 30 s später selbst. Beendet wird nur über den eigenen Socket und notierte PIDs.
- Die Board-Zeile (`server.ts#lanePreviewView`, Lanes-Liste in `src/client.ts#renderBoard`) zeigt Kandidat, Commit, URL und Ablauf. `stale` vergleicht den aktuellen Lane-HEAD mit dem gespeicherten Head; `null` heißt unlesbar. Die Zeile trägt den Hinweis „kein Verify-Beleg“, und kein Gate liest sie.
- Rest, benannt: Cookies sind host-, nicht portgebunden. Ein Browser schickt das Board-Cookie `fleet_8790` darum auch an die Vorschau auf derselben Adresse. Die Vorschau liest es nicht (`server/auth.ts#cookieName` ist je Port eigen), aber ihr Prozess sieht es im Header. Ein getrennter Hostname (MagicDNS statt IP) würde das schließen; das ist eine Owner-Entscheidung.

### Nachtrag 2026-09-24 — Karte 3 gebaut: Review auf Knopfdruck statt Takt

Owner 2026-09-24 auf den Vorschlag der Orchestratorin („nur auf Knopfdruck, nie periodisch“): „ja, beide so freigeben“. Das ersetzt den 60-Minuten-Takt von c617a142 vollständig; die Karte oben unter der Linie gilt in diesem Punkt nicht mehr. Gebaut auf Branch `fleet/260924100550-1051` (Shas setzt die MAIN nach dem Land ein).

- `POST /api/review-candidates/:id/review` (Owner) ist die einzige Tür, `server.ts#startCandidateReview` der einzige Läufer. Kein Tick, kein Timer, kein Boot-Pfad ruft ihn; `server.ts#tickAutoReview` und `FLEET_AUTO_REVIEW_MS` sind unberührt und sehen einen geparkten Kandidaten nicht (er hält keinen Slot).
- Gegenstand ist der **gespeicherte Head gegen die Base** (`git diff <base>...<head>` aus Git-Objekten), nicht der Arbeitsbaum. Volle Dateien als Kontext reiten nur mit, solange der Worktree genau dieser Head und sauber ist. Reviewer und Parser sind die des ③ (`server.ts#reviewDiffs`, aus `runReview` herausgelöst).
- Ergebnis: ein datierter Kommentar `server/types.ts#CandidateReview`, gebunden an die Patch-ID, gespeichert je Worktree-Pfad (`candidateReviews` in `fleet.json`). Er überlebt Neustart und Resume; `dropShelved` und ein beim Boot fehlender Pfad nehmen ihn mit.
- Benannte Weigerungen: unbekannte ID (404); Kandidat in eine laufende Lane resumed oder Worktree ohne Review geshelved (409); ein laufender Lauf (409); **zweiter Druck auf dieselbe Patch-ID** (409, nennt den Kommentar); **5 Läufe je Kandidat**, fehlgeschlagene mitgezählt (409). Ein fehlgeschlagener Reviewer ist 502 und legt keinen Kommentar an.
- Das Board (`server.ts#candidateReviewsView`, Lanes-Liste in `src/client.ts#renderBoard` über `src/client.ts#reviewBody`) zeigt je Kommentar Datum, Kandidat, Patch und `stale` = Patch des Worktrees jetzt ≠ gelesener Patch (`null` = unlesbar). Beratend: kein Gate, keine Owner-Entscheidung, kein Land liest ihn.

## §N Nicht gemessen

Keine laufende Lane, kein Worktree und keine Test-Instanz wurde geöffnet, gestartet oder berührt. Keine Live-Env, `fleet.json` oder `.env` wurde gelesen. Die Haupt-Checkout-Ledger wurden nur aggregiert; `post-land-audits.jsonl` wurde für diese Frage nicht benötigt und nicht gezählt. Es gibt keine beobachtete Reviewzeit, keinen Nachweis, dass frühes Resolve spätere Konflikte spart, und keinen gemessenen Betriebspreis für 30-Minuten-Previews oder wiederholte Agentläufe. Die Wirksamkeit der Karten ist eine Hypothese bis zu ihren DONE-Proben.
