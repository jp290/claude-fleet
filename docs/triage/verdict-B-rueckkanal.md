# Verdikt B-rueckkanal — Rückkanal, Session-Lebenszyklus, Watch/Ping/Deploy

**Worker:** pi / openai-codex/gpt-5.6-sol  ·  **Baum:** 45902f9  ·  2026-08-09
**Werkzeug-Probe:** ast-grep lief (0.45.1)  ·  rg ja

## Übersicht
| Zeile | Verdikt | Konfidenz | Größe | Einzeiler |
|---|---|---|---|---|
| `58d03512` | unklar | hoch | L | Der Byte-Busy-Gate ist real; ohne Owner-Entscheid zwischen Turn-Grenze und zweitem Sensor ist der Eingriff nicht baureif. |
| `29829dac` | unklar | hoch | M | Das Boot-Verdikt hat tatsächlich nur einen GET-Leser, aber der vorgeschlagene Fehlversuch beweist kein `ok:false` und die Zustellung hängt an `58d03512`. |
| `d45898cb` | bauen | hoch | M | Zuerst nur den Ping um ein zero-check-„green“ erweitern; die größere Ledger-Semantik bleibt ein eigener Entscheid. |
| `08230c93` | bauen | mittel | M | Die Succession trägt heute keine Kettenidentität; Generation und Vorgängerbezug schaffen die fehlende Stufe-1-Spur ohne Auto-Stopp. |
| `0ae22c2d` | unklar | mittel | S | `4455adca` ist gelandet und die Variable fehlt weiter im Spawn, aber die zwei operativen Freigabefakten liegen in unsichtbaren Zustandsdateien. |
| `fc47f1e1` | zusammenlegen mit `58d03512` | hoch | S | Gleiche Busy-Wurzel; als Zusatz bleibt nur die fehlende Self-Rekonfiguration eines Watch, nicht die behauptete völlige Routenabsenz. |
| `94ab77dd` | bauen | hoch | M | Der Boot-Filter verwirft weiterhin spent Watches entgegen der vorhandenen Retention. |
| `983e063f` | streichen | hoch | M | Der beschriebene Ausgang ist mit `613faa3` vollständig gelandet. |
| `c845a392` | bauen | hoch | M | Respawn und Erstöffnung brauchen getrennte Zeitanker; der heutige Respawn erneuert `openedAt` weiterhin nicht. |
| `ca630f68` | bauen | mittel | M | Unkontrollierbare `lastOutput===0`-Vorbedingungen können weiter Produktchecks als Flakes ausgeben; eine dritte Fundstelle muss in den Schnitt. |

## Je Zeile

### `58d03512` — unklar, Konfidenz hoch
- **Warum:** Der Befund am Code stimmt: `poll()` setzt `lastOutput` bei jedem neuen Stream-Byte, und `canDeliver` erklärt den Empfänger innerhalb von `idleMs` für busy. Ob laufende Ausgabe unterbrochen werden darf oder ob erst eine belastbare Turn-Grenze nötig ist, ist eine Sicherheits-/Produktentscheidung; die Zeile bietet dafür mehrere exklusive Architekturen, aber noch keinen baubaren Schnitt.
- **Beleg:** `server.ts:4350-4371` (Byte-Stream aktualisiert `lastOutput`), `server.ts:3594` (Busy-Klausel), Aufrufstellen `server.ts:5846`, `5913`, `5973`, `6051`, `10410`; `bbb5dbd` dokumentiert nur die Analyse, keinen Code-Fix.
- **Größe:** L (gemeinsamer Zustell-Gate, mehrere Ereignisfamilien, Live-Gegenprobe).
- **Was noch fehlt, bevor man es starten kann:** Owner-Entscheid „zweiter Arbeitssensor“ versus „Zustellung an Turn-Grenze“ samt expliziter Composer-Sicherheitsinvariante; danach ein Done-Kriterium pro gewähltem Mechanismus statt eines Sammelkriteriums.
- **Nicht geprüft:** Die in `fc47f1e1` berichtete echte Pane und der Wert 64 ms waren in dieser Lane nicht reproduzierbar; geprüft wurde die strukturelle Ursache im Code.

### `29829dac` — unklar, Konfidenz hoch
- **Warum:** Die Absenzbehauptung ist mechanisch bestätigt: `DEPLOY_FILE` wird geschrieben und nur von `GET /api/deploys` gelesen. Der vorgeschlagene Verify-Hebel ist jedoch falsch geschnitten: `FLEET_DEPLOY_RESTART_CMD=true` beendet den Server nicht und erzeugt aus sich heraus keinen nächsten Boot; bei einem späteren normalen Boot kann der Zielzustand sogar `ok:true` sein. Außerdem ist vor einer unattended Zustellung die Empfängerpolitik aus `58d03512` offen.
- **Beleg:** `server.ts:10988`, `11028`, `11242` sind Definition, Schreiber und einzige Lesestelle; `server.ts:11143` behandelt Exit 0 des Restart-Kommandos als erwarteten Erfolg. Die vorhandene rote Restart-Fixture benutzt folgerichtig Exit 7 (`e2e/deploy-facts.ts:227-245`), während ein bootseitiges `ok:false` über einen erfolgreichen, aber wirkungslosen Build erzeugt wird (`e2e/deploy-facts.ts:290-313`).
- **Größe:** M (Boot-Ereignis, dauerhafter Einmalmarker, Deploy-Fixtures).
- **Was noch fehlt, bevor man es starten kann:** Ein korrekter, als eigene Voraussetzung scheiternder Fault-Injection-Weg und der Owner-Entscheid aus `58d03512`; danach muss festgelegt werden, ob nur Boot-Rows oder auch synchron sichtbare Build-/Restart-Rows gemeldet werden.
- **Nicht geprüft:** Kein absichtlich kaputter Deploy und keine Route mit Nebenwirkung wurden ausgeführt.

### `d45898cb` — bauen, Konfidenz hoch
- **Warum:** Der Server kann weiterhin `result:"green"` allein aus Exit 0 buchen, obwohl `checks.ran === 0`; der Ping sucht ausschließlich rote Rows. Der kleine, rückwärtskompatible Schnitt (b) ist baubar, sofern Nachricht und Einmalmarker ausdrücklich für ein irreführendes Green formuliert werden; die neue Ledger-Farbe aus (a) gehört nicht in denselben Bau.
- **Beleg:** `server.ts:7428` klassifiziert Exit 0 als green; `server.ts:5819` filtert ausschließlich `result === "red"`; `server.ts:5779-5780` kennt zero-check bereits in der Nachricht. `7d3a309` und `3f3772b` belegen den realen Phantom-Green-Ausgang und lassen die Server-Seite ausdrücklich offen.
- **Kosten, wenn nicht gebaut:** Ein künftiger vorzeitig mit 0 endender Audit-Lauf bleibt ein sichtbares Green ohne proaktive Warnung und kann unverifizierten Code als geprüft erscheinen lassen.
- **Größe:** M (Ping-Auswahl, wahrheitsgemäßer Text, Einmal-Semantik und Post-Land-Audit-Fixtures).
- **Was noch fehlt, bevor man es starten kann:** Owner bestätigt „Filter-first“ (b); das Done-Kriterium muss zusätzlich verlangen, dass der Text bei Green weder „dieses Rot“ noch eine nur für Rot gültige Adjudikation behauptet.
- **Nicht geprüft:** Die gitignored historischen Audit-Rows und `state.sh` wurden nicht gelesen; für Schnitt (b) ist keine Migration alter Rows nötig.

### `08230c93` — bauen, Konfidenz mittel
- **Warum:** Der Nachfolge-Spawn übernimmt Betriebsparameter, aber weder Ketten-ID noch Generation oder Vorgängeridentität; auch das persistierte `Slot`-Schema führt keinen solchen Fakt. Das ist eine nennenswerte, klar auf „record/display“ begrenzte Verbesserung und öffnet keines der in §7 beerdigten Auto-Gates.
- **Beleg:** Das `Slot`-Schema führt nach `openedAt` nur `successionRetirement` und die übrigen Bewohnerfelder (`server.ts:1196-1260`); `handleSelfSucceed` ruft den Nachfolger nur mit cwd/Modell/Label/Harness/Effort/Box auf (`server.ts:3470-3471`). `613faa3` landete die Succession, nicht deren Kettenprovenienz.
- **Kosten, wenn nicht gebaut:** Wiederholte Übergaben bleiben als zusammenhängende Kette und damit als möglicher Kreis strukturell unsichtbar.
- **Größe:** M (persistiertes Schema, Spawn-Propagation, Self-View/Ledger und Restart-Test).
- **Was noch fehlt, bevor man es starten kann:** Schema-/Migrationsentscheidung für bestehende Slots und ein eindeutiger Ledger-Ort; Generation 1 bei jeder Nicht-Succession und Restart-Dauerhaftigkeit sind bereits brauchbare Done-Kriterien.
- **Nicht geprüft:** Die behauptete Live-Häufigkeit „1 handoff / 459 slot_kill“ braucht `audit.jsonl`, die eine Lane nicht sieht; das Verdikt stützt sich nicht auf diese Zahl.

### `0ae22c2d` — unklar, Konfidenz mittel
- **Warum:** Die Reihenfolge war richtig, aber ihr damaliger Preis ist überholt: Queue-Zeile `4455adca` wurde durch `d695e7e` geschlossen. Im getrackten Spawn ist der Ping weiterhin nicht aktiviert; ob inzwischen ein post-fix Audit mit `checks.ran > 0` vorliegt und ob wirklich kein offenes Ereignis wartet, kann diese Lane nicht feststellen.
- **Beleg:** `d695e7e` nennt und schließt Queue-Zeile `4455adca`; `watchdog.sh:153` setzt `FLEET_AUDIT_PING_MS` weiterhin nicht, `server.ts:5646` defaultet auf 0 und `server.ts:10186` registriert nur positiv. Ob Schritte 2–4 jetzt anstehen, braucht `post-land-audits.jsonl` und `fleet.json`, die eine Lane nicht sieht.
- **Größe:** S (<1 h, reine Betriebsänderung und kontrollierte Aktivierung; kein Codebau).
- **Was noch fehlt, bevor man es starten kann:** Host bestätigt einen post-`d695e7e` Green-Lauf mit `checks.ran > 0`, null offene Audit-Pings sowie die aktuell wirksame Watchdog-Umgebung; erst dann gilt die genannte Kickstart-vor-srv-Reihenfolge.
- **Nicht geprüft:** Keine Ledger, keine laufende `launchctl`-Konfiguration, kein `fleet.json` und kein Live-Neustart.

### `fc47f1e1` — zusammenlegen mit `58d03512`, Konfidenz hoch
- **Warum:** Der tragende Teil ist dieselbe Byte-Busy-Entscheidung wie `58d03512`, dort mit allen betroffenen Kanälen und Sicherheitsgegenprobe vollständiger. Diese Zeile fügt den konkreten Watch-Fall und die Self-Bedienlücke hinzu; ihre absolute Aussage „keine Route“ ist zu schärfen, denn eine owner-authentisierte POST-Delete-Route existiert bereits, nur `/api/self/watch` bietet dem Abonnenten kein Reconfigure/Delete.
- **Beleg:** Gemeinsame Wurzel `server.ts:3594` und Watch-Aufruf `server.ts:6051`; idempotentes Wiederabonnieren gibt den bestehenden Watch zurück (`server.ts:3358`); owner-seitiges Löschen existiert in `server.ts:14164-14170`, während die Self-Fläche nur POST-Erzeugung führt (`server.ts:12097-12105`).
- **Größe:** S als Zusatz zu der L-Entscheidung in `58d03512`.
- **Was noch fehlt, bevor man es starten kann:** In `58d03512` zwei getrennte Done-Kriterien führen: Zustellpolitik und Self-Reconfigure/Delete mit Scope-/Auth-Entscheid.
- **Nicht geprüft:** Die Live-Watch-IDs und Pane-Messwerte aus dem Zeilentext; keine Watch-Route wurde aufgerufen.

### `94ab77dd` — bauen, Konfidenz hoch
- **Warum:** Die aktuelle Boot-Bereinigung verlangt für jeden Watch weiterhin einen lebenden, identischen Zielslot und entfernt damit auch bereits fired/disarmed Rows. Das widerspricht direkt der vorhandenen bounded Retention für spent Watches; der vorgeschlagene armed-only-Identitätsfilter ist klein und klar.
- **Beleg:** Der Boot-Filter in `server.ts:10037-10041` verlangt Ziel-cwd/-branch ohne Unterscheidung von `armed`; spent Retention ist ausdrücklich in `server.ts:3514-3518` implementiert, und Zielende setzt `armed=false` plus Grund (`server.ts:3527-3533`).
- **Kosten, wenn nicht gebaut:** Nach dem nächsten srv-Restart verliert der Abonnent genau den dauerhaften Grund, der „wartet noch“ von „kommt nie“ unterscheiden soll.
- **Größe:** M (kleine Serveränderung, aber Restart-/Identitäts-Gegenprobe in der Watch-Familie).
- **Was noch fehlt, bevor man es starten kann:** Das vorhandene Done-Kriterium reicht; die Fixture muss getrennt beweisen, dass ein armed Watch auf einen recycelten Zielslot weiterhin fällt.
- **Nicht geprüft:** Die berichtete konkrete Watch-Zeile in `fleet.json` und ihr Audit-Eintrag waren für die Lane nicht sichtbar.

### `983e063f` — streichen, Konfidenz hoch
- **Warum:** **Typ (a), erledigt.** Der Commit implementiert exakt den beschriebenen Ausgang: Migrations-Tick, Self-Succeed/Retire, Nachfolger-Spawn mit Handoff-Brief und Ending `handoff`.
- **Beleg:** `613faa3c03d020d03bcd80ed88ac490048a4fe6b` (`feat(outbound): eine Main-Session merkt selbst, dass ihr Fenster voll wird …`); heutiger Code: `tickMigrate` in `server.ts:5951`, `handleSelfSucceed` in `server.ts:3441`, Route in `server.ts:12112`, und `SlotEnding "handoff"` in `slotstats.ts:36-37`.
- **Größe:** M (historische Größe; heute keine Arbeit).
- **Was noch fehlt, bevor man es starten kann:** Nichts — nicht erneut starten.
- **Nicht geprüft:** Ob die Betriebsvariable `FLEET_MIGRATE_PCT` live aktiviert ist; die Zeile verlangt den gebauten Ausgang, nicht dessen Aktivierung.

### `c845a392` — bauen, Konfidenz hoch
- **Warum:** `openedAt` wird nur bei einer neuen Belegung gesetzt; `ensureSlot` baut eine fehlende Pane in demselben Slot neu, ohne diesen Zeitanker zu erneuern. `sendText` benutzt gerade diesen Bewohner-Zeitanker als Boot-Frischefenster, während das Handoff-Gate ihn zugleich als Bewohneridentität braucht; ein separates Pane-Spawn-Feld ist daher der klare Schnitt.
- **Beleg:** `ensureSlot` beginnt in `server.ts:2830` und setzt beim erfolgreichen Respawn nur Größe/sessionId (`server.ts:2892-2902`); `openSlot` setzt `openedAt` in `server.ts:3000`; `sendText` liest es als Boot-Frische in `server.ts:3136-3140`, das Handoff-Gate in `server.ts:3438`. Der Body von `94b1362` benennt `c845a392` ausdrücklich als offen.
- **Kosten, wenn nicht gebaut:** Ein Prompt direkt nach Owner-Restart oder Self-Heal kann im neu aufgebauten Composer liegen bleiben, obwohl Fleet die Zustellung als erfolgt behandelt.
- **Größe:** M (neues persistiertes/rehydriertes Zeitfeld, beide Respawn-Pfade und echte Pane-Gegenprobe).
- **Was noch fehlt, bevor man es starten kann:** Feldsemantik festnageln: `openedAt` bleibt Bewohnerbeginn, ein separates `paneOpenedAt` wird bei jedem erfolgreichen `new-session` gesetzt und nur von der Send-Bootlogik gelesen.
- **Nicht geprüft:** Keine echte Pane respawnt und kein Prompt gesendet; die Laufzeitfolge stammt aus `94b1362` und dem Batchtext.

### `ca630f68` — bauen, Konfidenz mittel
- **Warum:** Beide genannten Checks behaupten unmittelbar nach dem Öffnen `lastOutput===0`, obwohl der Server jedes Stream-Byte als Ausgabe zählt; sie stellen diese Voraussetzung weder positiv her noch isolieren sie als Setup-Urteil. Derselbe Musterfehler steht außerdem ein drittes Mal in der Boot-Timeout-Fixture und muss in Scope oder ausdrücklich begründet außerhalb stehen.
- **Beleg:** `fleet-e2e-claude-gate.ts:80-86` (silent-alive), `fleet-e2e-harness.ts:31-36` (unprobed) und die weitere Fundstelle `fleet-e2e-harness.ts:300-305` (boot-timeout); der zugrunde liegende Byte-Sensor steht in `server.ts:4350-4371`. `94b1362` dokumentiert, dass selbst der nie druckende Stand-in einen Zeitstempel bekam; `d695e7e` liefert das benannte-Voraussetzung-Muster.
- **Kosten, wenn nicht gebaut:** Der Land-Gate kann erneut wegen einer unkontrollierten Fixture-Voraussetzung rot werden und einen Produktfehler melden, den der Baum nicht erzeugt hat.
- **Größe:** M (beide Gate-Phasen, benannter Setup-Ausgang und Host-Burn-in).
- **Was noch fehlt, bevor man es starten kann:** Scope auf alle drei Fundstellen festlegen; fünf grüne Läufe allein genügen nicht, die absichtlich ausgelöste Vorbedingungsseite muss als eigener benannter Check nachweislich fallen.
- **Nicht geprüft:** Die Suite wurde auftragsgemäß nicht gefahren; die behaupteten zwei grünen Reruns wurden nur aus Commit-/Batchtext gelesen.

## Kalibrierung
- Meine drei stärksten Aussagen: `983e063f` ist durch `613faa3` erledigt; `94ab77dd` wird durch den heutigen undifferenzierten Boot-Filter direkt bestätigt; `c845a392` ist im heutigen Zeitanker-Split sowie im Body von `94b1362` ausdrücklich offen.
- Meine schwächste Aussage (hier zuerst nachprüfen): `08230c93` als nennenswerter Bau — die strukturelle Absenz ist sicher, die praktische Häufigkeit/Laufkostenbegründung hängt aber an `audit.jsonl`, das die Lane nicht sieht.
- Was ich gemessen vs. nur gelesen habe: Mechanisch gezählt wurden die `DEPLOY_FILE`-Lesestellen, die `canDeliver`-Aufrufstellen, Watch-Routen und `lastOutput===0`-Fixtures; Code und Commit-Bodies wurden gelesen. Keine Live-Pane, kein Deploy, kein Watch, keine Suite und kein gitignored Ledger wurden ausgeführt/gelesen. Eine unabhängige Claude-Code-Zweitmeinung lief wegen `EPERM` beim Anlegen ihres Session-Verzeichnisses nicht an und trägt daher nichts zu den Verdikten bei.

## Batch-Ebene
- Zusammenlegungen, die ich sehe: `fc47f1e1` in `58d03512`; dabei die absolute „keine Route“-Behauptung durch „keine Self-Reconfigure/Delete-Fähigkeit“ ersetzen. `d45898cb` bleibt getrennt, weil es Ereignisauswahl statt Empfängerzustand ändert.
- Reihenfolge, falls eine Zeile eine andere voraussetzt: Host prüft `0ae22c2d` operativ nach dem bereits gelandeten `d695e7e`; `58d03512` entscheidet die Zustellpolitik; danach `29829dac`. `94ab77dd`, `c845a392`, `ca630f68`, `d45898cb` und die reine Stufe-1-Aufzeichnung `08230c93` sind davon unabhängig.
- Was diesem Batch als GANZEM fehlt: Ein vom Owner benannter Turn-Grenz-/Busy-Begriff und eine gemeinsame Live-Probe, die „Prompt angekommen“ von „Turn wirklich gestartet“ trennt; außerdem fehlen der Lane die Betriebs-Ledger für Aktivierungs- und Basisratenurteile.
