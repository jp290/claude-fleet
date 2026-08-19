# HANDOFF — MainCF (Slot 5), 2026-08-19, ~8,8 h, ctx 48,1 % gemessen

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Zwei Stränge. (1) Owner-Frage „warum sind die Spiele nicht ambitioniert genug" → Kit v3 als
Vorschlag. (2) Supervisor-Auftrag Gamestudio-Refinement Teil 2 → Worktrail-Audit II, vier
Mess-Lanes.

## Der EINE offene Rest: Queue-Zeile `79f9fddb`

`[worktrail-audit-II] ZUSAMMENFUEHRUNG` — pending, kind `auftrag`, vollständig gebrieft
(Done-Kriterium + Verify-Weg + Verbote). **Dispatchen, sobald `private-repo-f.md` auf main liegt**
(Slot 15 / Task `4b4764ef` war beim Schreiben `ahead=1`, landet über s8).
Gelandet sind: `docs/worktrail-audit-II/{private-repo-h,private-repo-e,private-repo-c}.md`.

## Fünf Entscheidungen, die dem OWNER gehören — keine davon ist MAIN-Arbeit

1. **`FLEET_VERIFY_WAIT_MS` auf 45 min.** Es ist ein LITERAL in der tmux-Spawn-Zeile von
   `watchdog.sh` (nach dem `.env`-Sourcing, das Literal gewinnt; in `.env` steht es nicht).
   Reihenfolge zwingend: Datei ändern → `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`
   → DANN srv neu. Umgekehrt backt der alte Watchdog wieder 900000 ein (`watchdog.sh:112`
   spawnt srv nur bei fehlender Session).
2. **Kill auf die Prozessgruppe statt den Prozess** (Vorschlag in `00714c8`). Behebt eine andere
   Sache als (1) und wird durch (1) NICHT behoben.
3. **`/usage` in einer fremden Pane neu aufrufen?** Der einzige Kontingent-Sensor ist ein
   geparktes `/usage`-Modal auf Slot 15; der passive Watcher liefert fast immer `unknown`.
4. **Teil 1 des Refinement-Plans**: Verkostung der vier Spiele + 2–3 Referenzspiele je Studio,
   ausdrücklich OHNE Vorschlagsliste von uns.
5. **Kit v3 rev.2 promoten oder verwerfen** — liegt fertig unter `studio-kit/v3-proposed/`,
   einen `git mv` entfernt. Die Zwangsnaht (welches der drei Durchsetzungsorgane welche Zeile
   bekommt) steht in `docs/studio-kit-v3-vorschlag-2026-08-19.md` §4.

## Drei Befunde, die noch niemandem gehören

- **Ein Land kann auf drei Arten sterben, alle durch Warten:** `waitedOut` (nie gemessen) ·
  im Lock überholt (kein FIFO — gemessen 17:25, ein Dritter nahm die Lücke, während Slot 2 seit
  18,3 min anstand) · **verifiziert-aber-veraltet** (verify grün, dann `ff` unmöglich, weil main
  während der Schlange weiterzog — ZWEIMAL gemessen: s10 `ms 902 048 / waitMs 803 000`,
  s13 `ms 875 105 / waitMs 773 000`). Modus 3 ist der teuerste und verlängert die Schlange, die
  ihn verursacht hat. Auf FREIER Maschine dauert dasselbe Land 1,7–1,9 min (`waitMs 0` bzw. 15 s).
- **Der Sessions-Poll hat 8–76 Byte Restluft** bei 12 288 B Deckel, und **eine zusätzliche Lane
  kostet 510 B** (`a69b0f6`, drei serielle Läufe). Nicht das nächste Feld kippt den Check,
  sondern die nächste Lane. Der Land-Gate kann es strukturell nicht fangen: `e2e/tasks.ts`
  läuft nur in Tier 2.
- **Der Verify-Timer persistiert seine eigene Eingangsgröße nicht.** `waitedMs` (steuert `arm()`)
  und `waitMs` (nachträglicher Parser, geht auf den Datensatz) sind ZWEI Größen mit fast gleichem
  Namen; nur die zweite überlebt. Jede Wiederholung dieser Untersuchung endet darum in `unknown`.
  Befund des Supervisors, billiger Schnitt, gehört ins Programm `b3d042ec`.
  GEMESSEN und unstrittig: die Invariante `server.ts:9067` („at most WAIT+TIMEOUT") ist um
  302 783 ms verletzt; ein Gate arbeitete HÖCHSTENS 48 s und stand MINDESTENS 24 min an.

## Was ich falsch gemacht habe (damit es niemand wiederholt)

- **Zu viel selbst gemessen.** Panes gelesen, Sonden gedruckt, Fixtures debuggt, Prozessbäume
  verglichen. Das gehört in Wegwerf-Worker mit engem Brief; die Rolle einer MAIN ist Urteil und
  Reihenfolge. Der teuerste Posten der Session, nicht die Timer-Abzweigung.
- **Vier Messungen waren MEINE Sonde, nicht die Maschine:** ein `| tail -4` liess `$?` den Exit
  von `tail` lesen · ein `nohup … &` im Hintergrund-Bash meldete `exit 0` für die äussere Shell,
  während die Suite noch lief (0 PASS-Zeilen = nie gestartet) · eine Score-Sonde las
  `250 pts · needs 55% grip` als Punktestand · die Suche nach `acquired`-Zeilen lief im
  gedeckelten `verify.out`, während `suiteWait` über die VOLLE Ausgabe parst.
- **Absenz aus einer einzigen Grep-Schreibweise geschlossen** („private-repo-c ii" statt „zweiter
  Anlauf"/„bracket 2") und daraus einen falschen Befund gebaut.
- **Im `tasks`-Digest nach Volltext gesucht**, obwohl ich am selben Tag gelesen hatte, dass der
  Poll nur Digests trägt.

## Reihenfolge für die Nachfolge

1. `private-repo-f.md` landen lassen (läuft über s8), dann `79f9fddb` dispatchen.
2. Die Tabelle reviewen, landen, Audit ansehen.
3. Die fünf Owner-Entscheidungen NICHT selbst treffen — vorlegen.
