# HANDOFF — ACP Project MAIN (Slot 2), 2026-08-20, ctx ~40 %

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Gebundene Project MAIN für Program `eeba7c04caae64d79969199b` („Claude Fleet — Agentic Control
Plane Outside-in"). Koordination, kein eigener Produktcode: zwei Act-Briefs geschnitten, drei
Builder gebrieft, drei Schnitte integriert.

## Belegter Stand

- **Integrationstip `ad03d34`** auf `docs/kontextschicht-analyse-2026-08-20`. Gelandet in dieser
  Reihenfolge: ACP-02 Capability-Quelle → `7a91ef1`, ACP-01 UI-Grundbedienung → `4e4a70e`,
  ACP-X1 Composer-Autorität → `ad03d34`. Der Doku-Schnitt `92b96b3` war ein korrektes No-op.
- **Alle Post-Land-Audits grün** (ACP-02 16,7 min; ACP-01 und ACP-X1 je 2739 Checks / 0 Fehler).
  Belege in `git notes --ref=fleet/land`, nicht in Meldungen.
- **`main` steht weiter auf `e19c80f`.** Fleets Integrationszweig ist NICHT `main`:
  `integrationBranch()` liest `repoBases[repo]` (leer) und fällt auf den aktuellen Branch des
  Haupt-Checkouts zurück. Gelandet wird also auf `docs/kontextschicht-analyse-2026-08-20`.
- **Live läuft alter Code:** bootHead `0c59dd1`, 16 Commits zurück, `bundleStale: true`. Kein
  Deploy — nichts davon ist im Board sichtbar.
- Zehn untracked Owner-Dateien im Haupt-Checkout: unangetastet, vor und nach jedem Land geprüft.
- Keine laufende Suite, kein Merge, kein Audit, kein armer Watch beim Schreiben dieser Zeilen.

## Freigegebene Reihenfolge für die Nachfolgerin

1. **Promotion/Deploy sauber entscheiden und durchführen.** Offen ist beides: ob `main` auf den
   Integrationstip nachgezogen wird, und der Deploy selbst (`POST /api/deploy`, danach
   `bundleStale` auf `/api/sessions` prüfen). Der Vorgänger hat weder das eine noch das andere
   angefasst.
2. **Act 3 — Candidate-/Diff-Identität + reiner Policy-Faktensensor.** Ein Builder, Sol high
   (Server-/Lifecycle-Schnitt). Definition im Program Brief `3a9556e`/`92b96b3`: Verdikt bindet
   `LandCandidate` (mainSha, candidateSha/Lane-Tip, Verify-Lauf); Candidate-Wechsel macht das
   Verdikt stale und der Confirm-Pfad antwortet 409; die Projektion erfindet KEINE Eligibility
   und ändert kein Land-Verhalten. `server.ts` ist lease-frei.
3. **Kurzer gameStudio-Readiness-Schnitt** für die heutigen Aufträge.

Der scharfe Merge-Critic ist ausdrücklich erst Act 8, nach Shadow und Objekten.

## Drei Befunde, die die Nachfolgerin braucht

- **Der 12-KiB-Sessions-Payload-Check ist pfadlängenabhängig, nicht kaputt.** Deckel 12288 B,
  gemessen 12212 / 12297 / 12309 / 12341 / 12344 / 12346 / 12398 / 12476. Aus einem Lane-Pfad
  (62 Zeichen) fällt er, aus dem Haupt-Checkout (29) hält er — `/api/sessions` trägt `cwd`/`repo`.
  Bewiesen mit einer pfadlängengleichen HEAD-Kontrolle am Basisbaum (12297 B ohne jede Änderung).
  **Korrektur einer früheren Aussage dieser Session:** er ist NICHT dauerhaft rot; drei Audits
  nacheinander waren grün. Als Eingang für den Policy-Faktensensor aus Act 3 taugt er trotzdem
  nicht — weil unzuverlässig, nicht weil rot.
- **ACP-X1 löst sein Symptom nicht nachweislich.** `--prompt-suggestions false` ist zugestellt
  (`agentCmd`, nur im claude-Zweig) und über die ARGV gepinnt, unterdrückte in der Messung mit
  Claude Code 2.1.237 aber die sichtbaren TUI-Vorschläge NICHT; „jetzt deployen" war weder mit
  noch ohne Flagge reproduzierbar. **UNKNOWN, nicht behoben.** Was trägt, ist die zweite Hälfte:
  der Satz in `supervisorBriefBody()` (Gründung UND Nachfolge), dass Composer-/Suggestion-Text aus
  `capture-pane` weder Autorität noch eingegangener Auftrag ist. Wer das Symptom wirklich
  beseitigen will, misst zuerst, welcher Mechanismus den Vorschlag erzeugt — eigener Act.
- **Der ②-Shadow-Reviewer ist keine Abkürzung zur PromotionPolicy.** 46 Läufe (25.–28.07.),
  38 `pass`, **0** `review`, **8 ohne Verdict (17,4 %)** — und er ist fail-CLOSED. Auf `gate`
  geschaltet hätte er 8 von 46 sauberen grünen Lands beim Owner abgeladen, also genau die Last
  erzeugt, die die Policy abschaffen soll.

## Cleanup-Reste (nichts davon ist kaputt, alles ist Aufräumarbeit)

- **ACP-01-Preview läuft weiter** auf `127.0.0.1:23663`, zeigt `02a5625` statt den Tip. Stoppen
  ausschließlich mit `tmux -L acp01prev17363 kill-server` und
  `rm -rf $TMPDIR/acp01-preview-17363`. Nie ein Namensmuster.
- Zwei verwaiste Worktrees auf `db35dc6` (`fleet-260820063858-81bb`, `fleet-260820064601-ed65`)
  plus der Fable-Kritiker-Worktree. Owner-Anweisung war: nicht anfassen.
- Sechs `autoReview`-Fehler („summarizer timed out without an answer"), unabhängig von den Lands.

## Was ich falsch gemacht habe

- **„Durchgehend rot" behauptet, wo „schwellennah" richtig war.** Ich hatte acht rote Audits
  gezählt und daraus eine Dauer-Eigenschaft gemacht; das erste grüne Audit hat es widerlegt. Aus
  einer Häufung wird keine Invariante.
- **ACP-02s Brief zu eng geschnitten.** Der Program Brief verlangt für Act 2 auch UI-, Trace- und
  Harness-Aussage; mein Dispatch-Text ließ sie weg. Der Fable-Review fand es, und die Korrektur
  kostete eine Reparaturrunde, die der Worker nicht verschuldet hatte.
- **Das `done-looking`-Prädikat viermal als Weckinstrument benutzt, wo es flattert.** Eine Lane,
  die auf dem Suite-Mutex wartet, sieht identisch aus wie eine fertige. Für „Kette fertig" ist ein
  Hintergrund-Watcher auf die echte Bedingung richtig, für „Merge/Audit fertig" die
  `{kind:"merge"}`/`{kind:"audit"}`-Watches — die haben je genau einmal und korrekt gefeuert.

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
