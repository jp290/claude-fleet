# Lage + Fokus-Empfehlung + Prompt — 2026-08-19, 20:0x (Supervisor, Slot 9)

> **Redigiert 2026-08-31 beim Tracken in das public Repo:** Tailscale-IP → `100.64.0.1`
> (der Platzhalter, den `watchdog.sh` und `SHARING.md` führen), `/Users/<account>/` → `~/`,
> die Leck-Guard-Muster durch ihre Beschreibung ersetzt. Der Inhalt ist sonst unverändert.

## 1. Lage in sechs Zeilen

- **Drei Studios laufen, keines wartet auf mich.** Private-repo-d (s2, Opus 1M, `~/private-repo-d`) ·
  Private-repo-g (s3, Fable, `~/private-repo-g`) · Arcade (s5, Opus 1M, `~/private-repo-n`).
  Alle drei mit lebender Programm-Bindung.
- **Die Land-Naht ist geheilt.** `FLEET_VERIFY_WAIT_MS=2700000` ist live (pid 25832).
  **12 Lands in Folge seit 14:21, alle `landed`, alle `verified:true`** — kein toter Versuch mehr.
  Damit ist Programm `b3d042ec` (Suite-Contention) in der Dringlichkeit gefallen, nicht erledigt.
- **`0c59dd1` hat die Queue triagiert**: 71 offene Zeilen gegen den Baum geprueft →
  BAU 8 · ZWEITER BLICK 21 · **ARCHIV-VORSCHLAG 40 (nicht ausgefuehrt, gehoert dir)**.
- **`79f9fddb` ist jetzt dispatchbar** — `private-repo-f.md` liegt seit `d8dc1d3` auf main, Audit gruen.
  Es war die einzige offene Zeile des letzten Handoffs.
- **Der Poll-Deckel-Befund ("8-76 Byte Restluft") ist ein SUITEN-Risiko, kein Betriebsrisiko.**
  `e2e/tasks.ts:576` misst gegen die isolierte Test-Instanz; der Live-Poll ist 131 KB und faellt
  nicht unter diesen Check. Er kippt bei der naechsten Suite-Erweiterung, nicht bei der naechsten
  Studio-Lane. (Im letzten Handoff klang das dringender, als es ist — nachgemessen.)
- **Und der eine echte Brand, siehe §2.**

## 2. Der Engpass: die Abnahme, nicht der Bau

Mechanisch erhoben (`lsof` auf jeden laufenden Server, `git rev-parse` in jedem servierenden
Verzeichnis):

| Prozess | Port | Bindung | serviert | Stand |
|---|---|---|---|---|
| pid 7902 | 4410 | **localhost** | `~/private-repo-d` (main) | `0962c2a`, 19:55 — aktuell |
| pid 19834 | 4399 | **localhost** | `private-repo-d.worktrees/lane1` | `5d56f38`, 17:20 — **ueberholt** |
| pid 1638 | ? | **localhost** | `private-repo-d.worktrees/lane2` | `331cc8e`, 18:34 — **ueberholt** |
| pid 52436 | 4321 | `*` (erreichbar) | `~/private-repo-c` | `53657f5`, 02:40 |

Drei Befunde in einer Tabelle:

1. **Die gesamte heutige Private-repo-d-Arbeit ist von deinem Geraet aus nicht erreichbar.**
   Vier gelandete Lanes, 155 gruene Tests, die Drift-Mechanik von 19:55 — alles auf `localhost`
   gebunden. Nur Private-repo-c von heute Nacht antwortet.
2. **Zwei Server servieren ueberholte Branch-Staende hinter gesundem HTTP 200.** Genau der
   Fehler, den ich dir heute schon einmal gemacht habe: Erreichbarkeit ist kein Beleg fuer
   Aktualitaet. Beide Prozesse laufen immer noch.
3. **s2 wartet auf ein Urteil ueber etwas, das du physisch nicht sehen kannst.** Woertlich aus
   seiner Pane: *"Wenn du jetzt faehrst und die Lenkung dich weiter stoert — sag mir nur, wie."*
   Dasselbe gilt fuer Private-repo-c I (wartet seit Tagen) und die beiden Arcade-Spiele.

Der Engpass ist also nicht Bauen und nicht Messen. Es ist, dass fertige Artefakte keinen
verlaesslichen Weg zu dir haben — und dein Geschmacksurteil keinen Weg zurueck.

## 2b. Sofort fahrbar (vom Supervisor waehrend der Erhebung aufgemacht)

**Private-repo-d, aktueller main-Stand:** `http://<tailscale-ip>:4510/`
Beleg, nicht nur Erreichbarkeit: die Seite stempelt `0962c2a`, und
`git -C ~/private-repo-d rev-parse --short HEAD` liefert `0962c2a`. s2 hat das Stempel-Problem
in `serve.ts` selbst geloest — Commit wird PRO REQUEST gelesen, `/main.js` pro Request gebaut.
Sein Kommentar dort: *"a tasting note that names the wrong build is worthless."*

Das Relay ist ein Notbehelf meinerseits, kein Fix. Die Ursache steht unveraendert:
`~/private-repo-d/serve.ts` bindet `hostname: "127.0.0.1"` hart, ohne Override. Der Fix gehoert
ins Studio, nicht in ein Relay.

**Private-repo-c I:** `http://<tailscale-ip>:4321/` (`53657f5`, 02:40) — laeuft, wartet seit Tagen.

## 3. Empfehlung: die Abnahmestrecke bauen

Eine frische MAIN in `~/claude-fleet`. Ein Kommando, das den Bestand erhebt, je Artefakt einen
**erreichbaren** Server aus dem **belegten** Commit startet und eine Uebersichtsseite ausgibt.

**Ausdruecklich NICHT empfohlen:**
- **Kein viertes Studio.** Drei laufen; ein viertes verduennt deine Aufmerksamkeit, nicht die Arbeit.
- **Keine Grabung an der Land-Naht.** 12/12 gruen — die Zahlen sagen, sie haelt.
- **Kein Poll-Deckel-Fix.** Suiten-Risiko, kein Betriebsrisiko (§1).

## 4. Der Prompt (kopierfertig)

```
Du bist MAIN in ~/claude-fleet. Auftrag: die ABNAHMESTRECKE bauen — fertige Spiel-Artefakte
bekommen einen verlaesslichen Weg zum Owner.

BEFUND, der den Auftrag ausloest (mechanisch erhoben, 2026-08-19 20:00, nachpruefbar mit
`lsof -a -p <pid> -iTCP -sTCP:LISTEN -Fn` und `git -C <cwd> rev-parse --short HEAD`):
vier Spielserver laufen. Drei sind auf localhost gebunden und damit vom Owner-Geraet
unerreichbar; zwei davon servieren ueberholte Lane-Branch-Staende hinter gesundem HTTP 200.
Die gesamte heutige Private-repo-d-Arbeit (main 0962c2a, 19:55) ist nicht abrufbar. Der Studio-MAIN
auf Slot 2 wartet auf ein Fahrurteil ueber genau dieses Artefakt.

DONE-KRITERIUM (ein Satz, vor dem Bauen pruefbar machen):
Der Owner oeffnet EINEN Link von einem anderen Geraet und sieht dort jedes spielbare Artefakt
mit Repo, Commit-Kurz-SHA und Commit-Datum; jeder Spiel-Link antwortet, und der auf der Seite
ausgewiesene Commit ist derselbe, den `git rev-parse HEAD` im servierenden Verzeichnis liefert.

VERIFY-WEG (ausgeschrieben, fahre ihn, bevor du fertig meldest):
fuer jeden Eintrag der Seite: `curl -sS -o /dev/null -w '%{http_code}' <link>` == 200
UND der Seiten-SHA == `git -C <servierendes-verzeichnis> rev-parse --short HEAD`.
Ein 200 allein ist KEIN Beleg — genau daran ist die Sache heute zweimal gescheitert.

REICHWEITE — halte dich hier eng:
- Das Skript lebt in ~/claude-fleet. Es LIEST fremde Repos (~/private-repo-d, ~/private-repo-c,
  ~/private-repo-g, ~/private-repo-n) und startet Server. Es SCHREIBT nie dorthin.
- Worktree-Isolation deckt nur dieses Repo. Alles ausserhalb ist geteilte Realitaet:
  melden statt anfassen.
- Das Repo ist PUBLIC. Keine echte IP, kein Hostname, kein Token in einer getrackten Datei.
  Der Host kommt aus `.env` (`FLEET_HOST`/`FLEET_ARENA_HOST`); im Skript steht ein Platzhalter.
  Pflichtpruefung vor dem Commit: die Public-Pflichtprobe (`git grep -inE` auf Klarnamen und
  Tailscale-IP, Muster in CLAUDE.md §Deploy) muss LEER sein.
- Alte Server aufraeumen NUR ueber notierte PIDs (`kill <pid>`). NIEMALS ein Namensmuster —
  `pkill -f 'serve.ts'` trifft auf dieser Maschine fremde Prozesse.

SCHNITT (nicht ueberschreiten, ohne zu fragen):
Stufe 1 ist Bestand + erreichbare Links + belegter Commit. Der Rueckkanal fuers Geschmacksurteil
(Urteil von der Seite aus als Queue-Zeile ablegen) ist Stufe 2 und wird erst gebaut, wenn Stufe 1
vom Owner benutzt wurde. Kein Framework, keine Datenbank, kein Board-Knopf.

BAU MIT LANES, nicht selbst. Die teuerste Lehre des letzten Handoffs woertlich: "Zu viel selbst
gemessen. Das gehoert in Wegwerf-Worker mit engem Brief; die Rolle einer MAIN ist Urteil und
Reihenfolge."

Erst erden (`./state.sh`, `./register.sh`), dann das Done-Kriterium schaerfen, dann bauen.
```

## 5. Was danach noch bei dir liegt (unveraendert, keines dringend)

- Die zwei Kart-Geschmacksfragen (zwei Fahrer je Kart · bleibt "2000er PC-Grafik") — s2 haengt daran.
- **Arcade, wichtig und neu belegt:** "2-3 Versionen, die wir alle einreichen" gibt es nicht.
  Eine Wallet ankert genau einen Deliverable (`auftragsmarkt-harness/src/envelope.ts:3`), und
  `accept-submissions --winner <worker>:10000` gibt 100 % an eine Adresse. Es werden KANDIDATEN,
  aus denen du einen waehlst. s5 hat das belegt, nicht geraten.
- Der ARCHIV-Entscheid ueber 40 Queue-Zeilen (`docs/messungen/`, Commit `0c59dd1`).
- Sechs Programm-Vorschlaege: `bf01ef52` `83075480` `b3d042ec` `42736e1e` `d5c6b6cb` `d576186d` `e04cd5d8`.
- `.env.bak-1787083401` untracked und NICHT gitignored im public Repo. Fix: `.gitignore` auf `.env*`.
- `~/private-repo-d` und `~/private-repo-g` fehlen in `FLEET_VERIFY_CMD_REPOS` (.env) — Fleet-Lanes dort
  laufen ins `exit 42`.
- Kit v3 rev.2 promoten oder verwerfen (`studio-kit/v3-proposed/`, ein `git mv` entfernt).
