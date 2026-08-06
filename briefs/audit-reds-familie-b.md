Zwei rote Tier-2-Audits sind die letzten un-adjudizierten im Register. Urteile sie, mit Belegen — und behebe, was zu beheben ist.

DIE ZWEI ZEILEN (`post-land-audits.jsonl`, `GET /api/post-land-audits` — Achtung: die Route liefert NEUESTE ZUERST, `rows[rows.length-1]` ist die aelteste; daran bin ich schon einmal haengengeblieben):

  at=1785254868161  28.7.2026 18:07:48  main 8e0f2321  exit 1  covers fleet/260728143023-83fc
    FAIL  the cap is a ceiling, not a blanket refusal — records below it still land (positive control)  (accepted=13 pre=8 cap=15)
    FAIL  the refused POST wrote nothing — rundgang records in the window stop exactly at the cap (counted across the rotation boundary)  (21 vs cap 15)
    FAIL  the cap does not drift open — the next POST inside the same window is refused too and adds no record  (429 count=21)

  at=1785759228958  3.8.2026 14:13:48  main 60814494  exit 1  covers fleet/260803082354-3ec9
    FAIL  a second send of the same kind×slot within the episode window is 429  (409)
    FAIL  a capped send is audited (steward_send_capped)

DER AUFTRAG, pro Zeile: ein belegtes Urteil aus `real | flake | stale-test | unknowable` — und wenn es behebbar ist, behebe es.

WICHTIG: du adjudizierst NICHT. Die Route ist Owner-only. Du lieferst Urteil + Beleg, der Owner drueckt. Schreib dein Urteil so, dass es in eine Notiz von **maximal 300 Zeichen** passt (harte Grenze der Route) — die lange Begruendung gehoert in den Report.

ERSTER SCHRITT, bevor du irgendetwas reparierst: **faellt das heute ueberhaupt noch?** Die Zeilen sind 9 bzw. 3 Tage alt, main hat sich seither weit bewegt, und alle Audits von heute sind gruen. Es ist eine reale Moeglichkeit, dass beides laengst behoben ist — dann ist "stale-test" bzw. "behoben in <sha>" das richtige Urteil und es gibt nichts zu bauen. Das waere ein vollwertiges Ergebnis, kein Misserfolg. Beweisordnung wie im Regelwerk: ZUERST denselben Baum erneut laufen lassen, der frische HEAD-Worktree ist der Fallback.

WAS MIR AUFFAELLT, als Hypothese zum PRUEFEN, nicht zum Glauben (ich habe die Tests nicht gelesen, nur die FAIL-Zeilen):
- Beide Zeilen zaehlen ueber eine GRENZE hinweg — einmal eine Rotationsgrenze, einmal ein Episoden-Fenster. Das ist das Muster von Tests, die auf einen globalen Zaehler assertieren, ohne ihr Fenster selbst zu kontrollieren.
- `409 statt 429` ist auffaellig: 409 ist die awaiting-owner-Abweisung in `handleStewardSend`, nicht das Rate-Limit. Der Test bekam also moeglicherweise die falsche Ablehnungsart — Fixture-Leak oder geaenderte Reihenfolge der Pruefungen. Verifizier das am Code, statt es zu uebernehmen.

SCOPE, bewusst eng: die zwei Zeilen. Wenn du nach beiden Urteilen sicher bist, dass sie eine gemeinsame Wurzel haben, die einen strukturellen Fix verdient, schreib das als EINE Zeile in den Report — und baue ihn NICHT. Das waere eine eigene Entscheidung des Owners.

MASCHINE: fahr keine zweite Suite neben einer laufenden. Die Wrapper serialisieren sich selbst ueber `/tmp/fleet-e2e.lock`, aber Maschinenlast tun sie nicht — zwei gleichzeitige `e2e-isolated`-Laeufe erzeugen hier zuverlaessig Fehler auf BEIDEN Baeumen, und ein so erzeugtes Rot beweist nichts.

DONE: die volle Verify-Kette aus `CLAUDE.md` gruen; pro roter Zeile ein Urteil mit Beleg (bei `flake`: der Mechanismus, nicht "sieht aus wie"); bei einem Fix die Pins, die die Klasse kuenftig fangen — ein Check, der seine Klasse nie fangen muss, dokumentiert nur Hoffnung. Vor dem Done-Report Drift pruefen, falls du eine Lane bist. Bericht: nur die Scheibe — Zusammenfassung, zitiertes Verifikationsergebnis, eine Zeile zu allem Ungeloesten.
