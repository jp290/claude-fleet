# Verdikt D1-sicht — Board: Sicht und Aufmerksamkeit

**Worker:** pi/gpt-5.6-sol  ·  **Baum:** d92a1aa  ·  2026-08-09
**Werkzeug-Probe:** ast-grep lief (`ast-grep 0.45.1`)  ·  rg ja

## Übersicht
| Zeile | Verdikt | Konfidenz | Größe | Einzeiler |
|---|---|---|---|---|
| `b3a81fd0` | bauen | hoch | M | Deploy- und Gate-Fakten kommen bereits im Poll, verschwinden aber mit dem Desktop-Board. |
| `4d7aba33` | bauen | hoch | S | Die zwei vorhandenen Ledger-Linsen haben weder Zeitanker noch Neu-Grenze. |
| `6440c392` | bauen | mittel | M | Globaler Tier-2-Trail und Schreibroute existieren; dem Client fehlt weiterhin der Leser mit Urteilsknöpfen. |
| `1cb6778e` | bauen | mittel | M | Der versteckte Tab pollt nichts; eine kleine Attention-Route plus Tab-Metadaten ist ein geschlossener Schnitt. |
| `54560617` | bauen | mittel | M | Der aggregierte Conversation-Loss-Fakt existiert, ist aber nur in Route/Steward und als einzelne Audit-Zeilen sichtbar. |
| `f551f930` | bauen | mittel | S | Ein wirklich laufender Merge ist lokal bekannt, fehlt aber in Slot-Row und Render-Key. |
| `3a622ea1` | bauen | hoch | S | `Slot.awaiting` ist hart und persistiert, wird im Owner-Poll aber nachweislich nicht projiziert. |
| `fedab7ae` | unklar | niedrig | M | Die Anzeigeform ist erklärbar; ohne den konkreten Runtime-Eintrag ist „tot“ nicht von absichtlich geparktem Worktree zu trennen. |

## Je Zeile

### `b3a81fd0` — bauen, Konfidenz hoch
- **Warum:** `deployGap`, `bundleStale` und `gate` sind bereits Poll-Fakten; ihre beiden Renderer werden aber ausschließlich aus `renderBoard()` aufgerufen, das bei geschlossenem Board oder mobil abbricht. Das ist eine Anzeige-Scheibe, keine neue Serverfunktion. Der Gate-Teil darf dabei nicht denselben Ack-Schlüssel wie Deploy erben: Deploy-Ack kann an `deployGap.head` hängen, der flüchtige Gate-Zustand muss sich beim Zustandswechsel selbst aktualisieren.
- **Beleg:** `server.ts:12480-12497`; `src/client.ts:1857-1930`, `src/client.ts:2145-2161`, `src/client.ts:2191-2197`; globale Fixed-Rail-Präzedenz `public/index.html:32-55` und `src/client.ts:4973-4994`.
- **Kosten, wenn nicht gebaut:** Auf Handy oder bei geschlossenem Board kann der Owner weiter auf altem Server-/Bundle-Code arbeiten oder einen belegten Suite-Halter übersehen, obwohl der Browser die Fakten schon empfangen hat.
- **Größe:** M (eine Lane) — Client-Renderer, getrennte Zustands-/Ack-Semantik, CSS und ein Render-Check.
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: Bei geschlossenem Board und in einer mobilen Breite erscheint `deployGap.codeBehind===true` beziehungsweise `bundleStale.stale===true` in einer globalen Statusfläche; der jeweilige Deploy-Ack gilt nur für denselben `head`; ein späterer Head hebt ihn wieder. Ein vorhandener `gate`-Halter/Overdue-Zustand ist dort ebenfalls sichtbar und folgt ohne Deploy-Ack dem nächsten Poll; alle Null-/ruhigen Fälle zeichnen nichts.
- **Nicht geprüft:** Kein Browser-Render und keine Geschmacksentscheidung über Ton/Höhe der Leiste; geprüft ist nur die mechanische Reichweitenlücke. Die Pflichtformulierung aus `CLAUDE.md` wurde nicht geprüft, weil `CLAUDE.md` eine Lane nicht sieht.

### `4d7aba33` — bauen, Konfidenz hoch
- **Warum:** `loadLens()` lädt Lands und Audit jeweils als flache, neueste-zuerst Datenmenge und `openActivity()` setzt nur den Fensterzustand zurück; es gibt keinen Zeitanker. Beide Datensätze tragen numerische Zeitstempel, daher ist der Vorschlag ohne Serveränderung eindeutig schneidbar.
- **Beleg:** `src/client.ts:7524-7554` lädt `/api/lane-outcomes?limit=1000` (`ts`) und `/api/audit?limit=1000` (`ts`); `src/client.ts:7557-7594` öffnet ohne Ankerlogik. Die strukturelle ast-grep-Probe fand genau diese beiden API-Aufrufe und keinen Slot-Stats-/Post-Land-Leser.
- **Kosten, wenn nicht gebaut:** Der Owner muss nach jedem Öffnen Zeitstempel vergleichen und kann neue Lands oder Slot-Ereignisse zwischen alten Zeilen übersehen.
- **Größe:** S (<1 h).
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: Pro Linse wird nach dem Schließen ein eigener letzter-gesehen-Zeitpunkt gespeichert; beim nächsten Öffnen steht genau vor der ersten Zeile mit `ts <= Anker` ein Strich, der Kopf zählt exakt die Zeilen mit `ts > Anker`, und nach Schließen/Öffnen ohne neue Zeile ist der Zähler null. Ein erstmalig geöffnetes Fenster behauptet nicht, der gesamte Bestand sei neu.
- **Nicht geprüft:** Keine Browser-/localStorage-Gegenprobe und keine Entscheidung, ob der Anker beim Linsenwechsel oder erst beim Fensterschließen fortgeschrieben wird; das muss vor Start einmal festgelegt werden.

### `6440c392` — bauen, Konfidenz mittel
- **Warum:** Die globale GET-Route liefert neueste Audits bereits mit gejointem Urteil, und die POST-Route validiert vier Verdicts sowie 300 Zeichen. Der heutige Client zeigt nur das neueste nicht-grüne Ergebnis global und Audit/Adjudikation pro Lane in der Akte; gemessen sind null Client-Aufrufe von `/api/post-land-audits`. Der verbleibende Wert ist deshalb eng: global lesen und direkt urteilen, nicht ein neuer Audit-Mechanismus.
- **Beleg:** `server.ts:7537-7589`, `server.ts:12659-12680`; globaler Alarm `src/client.ts:4954-4994`; nur lesende Akte `src/client.ts:7420-7440`; gemessen: `rg -uu -c '/api/post-land-audits' src/client.ts` → `0`. Seit `54ea616` kann ein rotes Audit optional zusätzlich in eine Main-Session pingen, aber der Commit baut weder Trail noch Board-Schreibpfad.
- **Kosten, wenn nicht gebaut:** Historie und Basisrate bleiben außerhalb der globalen UI, und ein rotes Audit lässt sich vom Board aus weiterhin nicht adjudizieren; der Owner braucht dafür die rohe Route/curl.
- **Größe:** M (eine Lane) — vorhandener Activity-Shell, Liste, Schreibzustand und Downgrade-Verbot im Check.
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: Eine eigene Tier-2-Linse lädt `/api/post-land-audits?limit=1000` neueste zuerst, unterscheidet `result` dauerhaft von `adjudication`, hebt rote Zeilen ohne Urteil ab und POSTet `real|flake|stale-test|unknowable` plus höchstens 300 Zeichen. Nach Erfolg zeigt dieselbe rote Zeile das Urteil, bleibt aber rot; der Kopf benennt seinen Basisraten-Nenner und markiert einen etwaigen Route-Cap als Teilmenge.
- **Nicht geprüft:** Die genannten 54/15/1 Live-Zahlen brauchen `post-land-audits.jsonl` und `audit-adjudications.jsonl`, die eine Lane nicht sieht; das Verdikt hängt nicht von diesen Zahlen ab. Kein Schreib-POST und keine API-Route mit Nebenwirkung wurde aufgerufen.

### `1cb6778e` — bauen, Konfidenz mittel
- **Warum:** Der versteckte Tab schaltet alle drei heutigen Timer auf null, während weder `document.title` noch eine Attention-Route existiert; die statische Titel-/Icon-Fläche ist vorhanden. Die vorgeschlagenen Zustände sind serverseitig ableitbar: Task-Digests, `Slot.awaiting`, Post-Land-Summary und Deploy-Fakten existieren bereits. Das ist mechanisch ein kleiner separater Read-Pfad, nicht ein Push-System.
- **Beleg:** `src/client.ts:44-49`; statischer Tab `public/index.html:5`, `public/index.html:12`; Owner-Poll-Fakten `server.ts:12480-12497`; `Slot.awaiting` in `server.ts:1212-1215`. Gemessen: jeweils `0` Treffer für `document.title` in `src/client.ts` und `/api/attention` in `server.ts`/`src/client.ts`.
- **Kosten, wenn nicht gebaut:** Ein im Hintergrund liegender Fleet-Tab kann keinen neu eingetretenen Owner-Bedarf anzeigen; der Owner erfährt ihn weiterhin erst beim aktiven Hinsehen.
- **Größe:** M (eine Lane) — kleine Route, Hidden-Timer, Titel/Icon-Painter und Timer-/Payload-Checks.
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: Hidden startet ausschließlich einen 60-s-GET auf `/api/attention`; sichtbar stoppt dieser Timer und `refresh()` speist denselben Painter. Der Titel zählt den serverseitigen `needsYou`-Wert, null setzt exakt `Claude Fleet`; Favicon/Titel ändern sich nur bei geändertem Payload. `awaitingSlots`, nicht-grünes Plaudit und Deploy-Due sind getrennte Flags, damit keine Clarify-Lane doppelt gezählt wird. Vor Start muss der Owner nur Amber/Rot-Zuordnung und die Frage bestätigen, ob `deployDue` Aufmerksamkeit oder bloß Information ist.
- **Nicht geprüft:** Kein echter Browser-Hintergrundtimer, kein Canvas-Favicon und keine Secure-Context-/Notification-Behauptung; das Verdikt stützt sich nicht auf die Behauptung, Notifications seien unmöglich.

### `54560617` — bauen, Konfidenz mittel
- **Warum:** `/api/slot-stats` aggregiert den siebentägigen Slot-Verlust bereits sauber und der Client liest diese Route nullmal. Einzelne `no-transcript`-Ereignisse sind inzwischen im Audit-Lens verständlich lesbar; damit ist „nirgends sichtbar“ zu stark, aber der vorgeschlagene per-Slot-Sensor bleibt eine nennenswerte Verdichtung statt einer zweiten Diagnose.
- **Beleg:** Aggregat und Route `slotstats.ts:1-34`, `slotstats.ts:48-84`, `server.ts:12628-12634`; Einzelereignis bereits lesbar `src/client.ts:6298-6306`; Slot-Row `src/client.ts:4742-4835`; gemessen: `rg -uu -c '/api/slot-stats' src/client.ts` → `0`.
- **Kosten, wenn nicht gebaut:** Ein verlorenes gepinntes Gespräch bleibt nur als einzelne Trail-Zeile oder in einer unbetrachteten Aggregat-Route sichtbar und löst am betroffenen Slot keine Aufmerksamkeit aus.
- **Größe:** M (eine Lane) — trotz vorhandenem Reader braucht es einen seltenen Fetch/Cache, Slot-Zuordnung, Badge und Check.
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: Beim Öffnen/Entfalten der Slot-Info wird der vorhandene Slot-Stats-Reader höchstens einmal pro Öffnung geladen; eine Row zeigt nur dann ein Loss-Badge, wenn ihr `healReasons["no-transcript"] > 0` ist, mit Zahl und Sieben-Tage-Fenster im Tooltip. `no-session`, `unknown`, null und fehlende Slot-Zeile leuchten nie; `/api/sessions` wird nicht um das Wochenaggregat vergrößert.
- **Nicht geprüft:** Die behaupteten 26 Fälle brauchen `audit.jsonl`, die eine Lane nicht sieht; das Verdikt stützt sich auf die vorhandene Mechanik, nicht auf die heutige Höhe. Nicht entschieden ist, ob der Lazy-Fetch am Stack-Unfold oder an einer Slot-Infofläche sitzt.

### `f551f930` — bauen, Konfidenz mittel
- **Warum:** Die Slot-Row zeichnet nur das serverseitige `s.mergePending` für eine bereits aufgelöste, noch zu prüfende Konfliktlage. Ein laufender Merge wird dagegen in `mergeWatch` gehalten und im Board als „… landing“ gezeigt. Die Skizze muss enger als der Zeilentext gebaut werden: Das lokale `mergePending` beginnt schon vor Risk-Preview und Diff-Lektüre und darf deshalb nicht allein „landing“ malen; `mergeWatch` ist der belastbare Laufzustand.
- **Beleg:** lokale Sets `src/client.ts:810-814`; `doLand()` setzt den Guard vor dem Preview und `mergeWatch` erst bei laufendem Job (`src/client.ts:892-947`); Board-Knopf `src/client.ts:2393-2405`; Row zeigt nur Review-Pending `src/client.ts:4797-4805`; Render-Key ohne beide lokalen Sets `src/client.ts:5047-5060`.
- **Kosten, wenn nicht gebaut:** Bei geschlossenem oder auf einer anderen Session stehendem Board sieht die immer sichtbare Sidebar einen laufenden Merge nicht und die Maschine kann fälschlich frei wirken.
- **Größe:** S (<1 h).
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: Eine Row mit `mergeWatch.has(slot)` trägt sichtbares `⏏ landing`; der Render-Key kippt beim Hinzufügen/Entfernen, und nach inaktivem Worktree verschwindet es. `mergePending.has(slot)` ohne serverseitig angenommenen Lauf — insbesondere während Risk-Preview/Review — malt keinen laufenden Land. `prefers-reduced-motion` ersetzt Animation durch einen statischen Zustand.
- **Nicht geprüft:** Kein Browser-Animationsrender und kein anderer-Tab/-Gerät-Fall; die Zeile erklärt diese lokale Grenze selbst korrekt.

### `3a622ea1` — bauen, Konfidenz hoch
- **Warum:** `Slot.awaiting="owner"` ist ein persistierter, handlungswirksamer Zustand: Clarify setzt ihn und der Steward-Send verweigert ihn. Der Owner-Poll projiziert ihn trotzdem nicht, und der Clienttyp hat keinen Leser. Das ist der klarste „Fakt existiert, Anzeige fehlt“-Fall des Batches.
- **Beleg:** Feld/Persistenz `server.ts:1212-1215`, `server.ts:1935-1945`, Setzen `server.ts:3759-3769`, Gate `server.ts:10372-10379`; fehlende Projektion `server.ts:12498-12535`; fehlendes Clientfeld `src/client.ts:147-160`. Der Body von `8e2b3e5` misst ausdrücklich, dass `/api/sessions` elf Slot-Schlüssel und kein `awaiting` trug; `rg -uu` findet heute weiterhin null `.awaiting`-Leser im Client.
- **Kosten, wenn nicht gebaut:** Eine hart auf den Owner geparkte Clarify-Lane sieht in der Slot-Liste wie eine untätige Lane aus und muss über Queue-Zeile und Slotnummer mental zugeordnet werden.
- **Größe:** S (<1 h).
- **Was noch fehlt, bevor man es starten kann:** Hartes Done: `/api/sessions` projiziert für einen aktiven Slot `awaiting:"owner"` (null kann auf dem Hot Path entfallen); Slot-Row und Board-Identität zeigen „wartet auf dich“, und der Render-Key trägt denselben Wert. Ein Check setzt den Zustand, beweist Sicht nach Poll/Restart und beweist das Verschwinden nach der bestehenden Owner-Freigabe.
- **Nicht geprüft:** Kein Live-Clarify-Lauf und keine Badge-Gestaltung; die Persistenz-/Filtermessung stammt aus Code und `8e2b3e5`, nicht aus `fleet.json`.

### `fedab7ae` — unklar, Konfidenz niedrig
- **Warum:** Der sichtbare Mechanismus ist nachvollziehbar, aber noch kein reproduzierter Defekt: Aufgeklappte Stacks zeigen absichtlich sessionslose Worktrees als Ghost-Rows unter der Main-Session. Der Server ersetzt fehlende Branch-Metadaten durch `(detached)` und reicht jeden nicht-primären `git worktree list`-Eintrag weiter; er unterscheidet dort weder einen lebenden detached Worktree noch einen prunable/nicht mehr vorhandenen Eintrag. Ohne den konkreten Pfad ist nicht entscheidbar, ob der Owner eine gewollt geparkte Lane oder stale Git-Metadaten gesehen hat.
- **Beleg:** Absichtliche Ghosts `src/client.ts:4473-4500`, Render unter dem Stack `src/client.ts:4626-4644`, Label `on disk` `src/client.ts:4696-4715`; `(detached)` entsteht in `server.ts:2586-2602`, und die Route übernimmt jeden nicht-primären Eintrag in `server.ts:12918-12970`. `1074b86` führte genau diese Ghost-Sicht absichtlich ein; `53f5ce8` änderte nur den Main-Anker nach `lastOutput`.
- **Größe:** M (eine Lane), falls ein stale/prunable Fixture den Defekt bestätigt; sonst keine Arbeit.
- **Was noch fehlt, bevor man es starten kann:** Zuerst Repro-Done: Owner nennt Pfad/Stack oder Screenshot; ein Fixture trennt (a) existierenden sessionslosen Branch-Worktree, (b) existierenden echten detached Worktree und (c) prunable/nicht vorhandenen Worktree-Eintrag. Nur (c) darf verschwinden oder klar „stale“ heißen; (a) bleibt adoptierbar, (b) wird nicht als tote Fleet-Lane behauptet. Der wahrscheinliche Defektort wäre `listWorktrees()` plus `/api/slots/:id/worktrees`, nicht die Stack-Zuordnung.
- **Nicht geprüft:** braucht `fleet.json`, die eine Lane nicht sieht. Zusätzlich wurden weder der konkrete Live-Worktree noch `git worktree list --porcelain` des Owner-Repos gesehen; deshalb ist „old dead“ nicht bestätigt.

## Kalibrierung
- Meine drei stärksten Aussagen: `3a622ea1` (Code, fehlende Projektion und der Mess-Commit `8e2b3e5` stimmen überein); `b3a81fd0` (alle Aufrufer beider Renderer liegen hinter demselben Board-Guard); `4d7aba33` (beide Datenquellen tragen `ts`, während der komplette Linsen-Ladepfad keinen Anker hat).
- Meine schwächste Aussage (hier zuerst nachprüfen): `fedab7ae` — ich kann den möglichen stale/prunable Pfad im Code lokalisieren, aber nicht beweisen, dass der Owner genau diesen und nicht die absichtlich gebaute Ghost-Sicht gesehen hat.
- Was ich gemessen vs. nur gelesen habe: Gemessen wurden ast-grep-Version und API-Call-Struktur, `rg -uu`-Nulltreffer für Client-Leser/Attention/`document.title`, die vollständigen Aufrufstellen von `deploySection()`/`gateSection()`, Git-Historie und die Diffs der genannten Fremd-Branch. Gelesen wurden gezielte Bereiche aus Client, HTML, Server, `slotstats.ts`, Commit-Bodies und Wave-1-Verdikt C. Keine Suite, kein Browser, kein Ledger, kein `fleet.json` und keine API-Route. Eine optionale unabhängige Claude-Code-Zweitprüfung lief nicht an (`EPERM` beim Anlegen ihres Projektverzeichnisses) und floss nicht in die Urteile ein.

## Batch-Ebene
- Zusammenlegungen, die ich sehe: Keine echte Gleichheit innerhalb D1. `4d7aba33` und `6440c392` greifen beide in Activity-Shell/Lens-Switch/Loader und müssen seriell oder in einer koordinierten Client-Lane laufen, beantworten aber andere Fragen. `54560617`, `f551f930` und `3a622ea1` greifen alle in `slotRow()` und teils denselben `lastRender`-Key; sie sind drei unabhängige Fakten, aber echte Text-/Merge-Kollisionen. `b3a81fd0` und `1cb6778e` teilen `deployDue`, doch die erste Zeile macht den Fakt auf der sichtbaren Seite global, die zweite macht ihn beim versteckten Tab bemerkbar — keine Teilmenge. Der Analyst hat damit Datei-Kollisionen als Arbeitsgleichheit überzeichnet.
- Reihenfolge, falls eine Zeile eine andere voraussetzt: Keine semantische Voraussetzung. Praktisch zuerst `3a622ea1`, dann `f551f930`, dann `54560617` an der Slot-Row; sowie `4d7aba33` vor `6440c392` am Activity-Switch. `1cb6778e` kann `Slot.awaiting` direkt serverseitig lesen und muss nicht auf dessen Owner-Poll-Projektion warten.
- Was diesem Batch als GANZEM fehlt: Ein gemeinsam festgelegtes Browser-Verify-Fixture für hidden/visible, mobile/desktop und localStorage; die Fakten selbst sind bis auf `fedab7ae` ausreichend geschnitten. Batchübergreifend nennt `verdict-C-queue.md:76-80` bei `c8e2ddd7` denselben fehlenden Audit-Schreibknopf, ohne `6440c392` beim Namen zu nennen: `6440c392` ist der engere ausführbare Träger, also diesen Teil nicht noch einmal in den großen Queue-Redesign-Auftrag packen. `f6e085d5` aus D2 überlappt nur beim mobilen Zugang zum gesamten Brief; die globale Warnung aus `b3a81fd0` bleibt auch bei geschlossenem Sheet eigenständig. Die Fremd-Branch `fleet/260808114656-6e86` löscht Guest-Code und berührt dadurch `renderBoard()`/CSS-Hunks, aber keine D1-Mechanik; nur `b3a81fd0` sollte bei einem späteren Land dieser Branch textuell nach ihr rebasiert werden.
