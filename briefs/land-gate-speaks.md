Der Land-Gate soll aufhoeren, stumm zu scheitern. Drei kleine Teile, alle im selben Bereich, keine Aktion.

DER VORFALL, gemessen am 2026-08-06 (pruef ihn nach, glaub ihn nicht):

Ein Land wurde gestoppt mit `verify.ok: false` und `detail: "clean rebase, but verify failed"`. Die zurueckbehaltene Ausgabe enthielt jedoch NULL FAIL-Zeilen, endete mit `ALL PASS` einer Suite und dann `[verify timed out after 300000ms]`. Die betroffene Lane hat die Ursache anschliessend selbst gemessen und sie ist NICHT ihr Code:

- `./e2e-claude-gate.sh` isoliert: 37,9 s auf ihrem Baum vs 37,4 s auf main — ihre +97 Zeilen kosteten 0,5 s.
- Die ganze Kette auf leerer Maschine: 106,8 s von 300 s, exit 0.
- Aus `e2e-trail/` plus `ps`: der Land-Wrapper startete ~12:44:55, schrieb die erste Trail-Zeile aber erst 12:49:11 — rund 4 m 15 s in der `sleep 15`-Schleife von `e2e-stage.sh`, ohne ein Byte Ausgabe.

MECHANISMUS: `FLEET_VERIFY_TIMEOUT_MS` ist ein WANDUHR-Budget, aber mehrere Kettenschritte muessen erst den maschinenweiten Suite-Mutex nehmen, und dessen Halter darf jede Suite sein — auch `./e2e-isolated.sh` mit seinen ~8 Minuten. Das Budget enthaelt damit still eine unbegrenzte Wartezeit. Aufteilung in diesem Fall: ~107 s Arbeit, ~255 s Warten.

ZU BAUEN:

1. **Das Warten spricht.** `e2e-stage.sh` schreibt beim Blockieren eine Zeile — wer haelt den Lock (pid), seit wann, und danach ein Lebenszeichen pro Warteschleife. Ziel: ein abgelaufenes `verify.out` NENNT seine Ursache, statt in Stille zu enden. Achte auf die bestehende Lock-Semantik: Lock-Verzeichnis EXISTIERT != gehalten, die `pid`-Datei entscheidet, eine PID-lose Lock-Dir ist ein absichtlicher Park-Halt und wird nie gereapt — deine Zeile muss diese drei Faelle unterscheidbar machen, nicht verwischen.

2. **Timeout ist ein eigener Zustand.** Heute faellt er in `verify.ok: false` und liest sich damit wie ein begruendetes Nein. Er ist aber ein NICHT-Urteil: weder ja noch nein. Das Repo trennt solche Zustaende anderswo bereits sauber — der Gate ist dreiwertig (`ok: null` = SKIPPED via `exit 42` bzw. der Marker `verify skipped:`; `verify` ganz absent = unkonfiguriert). Der Timeout waere der vierte Wert.

   **SICHERHEITS-INVARIANTE, die du nicht brechen darfst:** unconfigured ist der EINZIGE Zustand, der unbeaufsichtigt auto-landet. `ok:false` und SKIPPED landen nie. Der neue Zustand muss in die NIE-Gruppe — pin das explizit, sonst hat eine Formaenderung am Gate aus Versehen ein Auto-Land geoeffnet. Das ist der einzige Weg, wie diese Scheibe echten Schaden anrichten koennte.

3. **`verifyMs` im verify-Record.** Heute traegt er `cmd, ok, out, at, mainSha` — keine Dauer, keinen Exit-Code. Die Tier-2-Audit-Zeile traegt beides (`at, startedAt, ms, exitCode`). Der Audit, der nichts gated, protokolliert also seine Laufzeit; der Gate, der alles gated, nicht. Wenn du aus Teil 1 auch die Wartezeit sauber herausbekommst, trenn `verifyMs` in Arbeit und Warten — wenn nicht, liefere die Gesamtdauer und sag im Report, warum die Trennung nicht ging. Eine erfundene Aufteilung ist schlechter als eine ehrliche Gesamtzahl.

NICHT BAUEN, bewusst:
- **Kein Auto-Retry.** Er ist die naechste Sprosse und braucht diese drei zuerst — ohne sie wuerde er zwangslaeufig auch echte Fehlschlaege wiederholen, was schlechter ist als ein Mensch, weil es die Maschine verbrennt UND den Bug versteckt.
- **Keine Budget-Erhoehung.** Die betroffene Lane hat ausdruecklich dagegen argumentiert, mit dem richtigen Grund: die Wartezeit ist konstruktionsbedingt unbegrenzt (ein gequeuetes isolated = ~8 min, zwei = ~16), jeder feste Wert verschiebt nur die Schwelle. Wenn du beim Bauen zu einer verteidigbaren Zahl kommst, ist das ein Report-Satz, kein Diff.
- **Kein Mutex-Vorrang fuer den Land-Gate.** Waere die strukturell sauberere Kur, ist aber eine eigene Entscheidung des Owners — eine Zeile im Report, falls du beim Bauen etwas darueber lernst.

VERIFIKATION: die volle Kette aus `CLAUDE.md`. Du fasst `e2e-stage.sh` an, aus dem ALLE SIEBEN Wrapper ihre Kopierliste ableiten — lauf die Suiten also wirklich, nicht nur tsc. Pins: dass ein Timeout als der neue Zustand ankommt und NICHT als `ok:false`; dass er nicht auto-landet; dass `verifyMs` gesetzt ist; und dass die Wartezeile im Output erscheint, wenn der Lock gehalten wird. Ein Check, der seine Klasse nie fangen muss, dokumentiert nur Hoffnung.

MASCHINE: fahr nie eine Suite, waehrend ein Land oder ein Post-Land-Audit laeuft — genau das hat den Vorfall oben erzeugt. Und nie zwei Suiten gleichzeitig.

Vor dem Done-Report Drift pruefen, falls du eine Lane bist. Bericht: nur die Scheibe — Zusammenfassung, zitiertes Verifikationsergebnis, eine Zeile zu allem Ungeloesten.
