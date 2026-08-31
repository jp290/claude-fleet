---
frage: Kann second-host einen echten Spiel-Build starten, ihn über den ECHTEN Eingabepfad steuern und benannte Belege zurückgeben — und misst er denselben Baum wie der Mac?
urteil: Starten, Steuern und Belegen: JA, alle drei am laufenden Build gemessen. Aber der Verify-Vertrag des Spiels ist NICHT portabel — derselbe Commit ist auf dem Mac ALL PASS und auf second-host rot in T14 (Trace-Digest), also Plattform und kein Regress; ein Digest-Breaker mit EINER eingebrannten Baseline kann auf zwei Architekturen nicht beides sein
bereich: [multi-host, game-maker, verify, session-runtime]
belege: [docs/messungen/second-host-baseline-2026-08-29.md, docs/dual-host-session-runtime-phase0-2026-08-30.md, docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md, private-repo-o 62ef02a1d3ee4b03ff89a25316e3b1151f123f44]
nicht-gemessen: die Startampel-Sperre (erste Messprobe fiel hinter die Freigabe, `speedWhileLightRed` ist UNGEMESSEN, nicht bestanden); Ton; jede Geschmacksfrage; ob T14 auf einer dritten Architektur wieder anders fällt; die Wurzel der Digest-Differenz im Sim-Code
stand: 2026-08-31
---

# Second-host-Session-Canary am Private-repo-o-Referenzbuild (2026-08-31)

Owner-Tor für die Wiederaufnahme des Programms „Dual-Host Fleet — Second-host Session Runtime":
EINE gebundene Canary muss zeigen, dass die positive Referenz-Klasse von Build auf `second-host`
**gestartet**, über den **echten Eingabepfad gesteuert** und mit **benannten Belegen**
zurückgemeldet werden kann. Eine dort bloß existierende Fleet-Session ist dieser Beweis
ausdrücklich nicht. Diese Notiz ist der Beleg; sie ersetzt Schnitt 1 des Phase-0-Plans
(`docs/dual-host-session-runtime-phase0-2026-08-30.md`), der als voller `./e2e-isolated.sh`
asymmetrisch war — grün hätte dort nur Maschinerie unter Stand-ins bewiesen, nie einen echten
Start.

## Das Artefakt, als benannte Auswahl

`62ef02a1d3ee4b03ff89a25316e3b1151f123f44` · Private-repo-o-Worktree
`game-maker-private-repo-o-fresh`, Branch `game-maker/private-repo-o-fresh-20260829`. Identifiziert
nicht von mir, sondern vom Tor-Dokument des Spiels (`8da462a`, „was Referenz NICHT heißt").

**Die Grenze desselben Dokuments wird hier mitgeführt, nicht weggelassen:** der Owner hat
`62ef02a` NIE gefahren. `owner_taste` und `sensory_critic` sind für diesen Stand `unknown`.
„Referenz" heißt in dieser Notiz: der Stand, an dem die Canary gefahren wurde — nicht ein
Qualitätsurteil.

## Was gemessen wurde

Transport ohne Ref-Mutation: `git bundle` des Branches, per scp auf das Gerät, dort Klon und
`git checkout` auf den Commit (detached, `git status` leer). Der Quell-Worktree wurde nicht
angefasst.

| # | Behauptung | Messung auf second-host |
|---|---|---|
| 1 | Der Build **startet** | `bun run start`; `/stamp.json` = `{"commit":"62ef02a","dirty":false}`; `GET /` → 200 |
| 2 | Er **bekommt echte Tasten** | Chromium 151 headless, CDP `Input.dispatchKeyEvent` (`rawKeyDown`/`keyUp`) in den DOM-Eingabepfad — nicht in Spielinterna. Gehaltenes `ArrowUp`: speed 4,24 → 19,38 m/s über 18 Proben. `ArrowRight`: yaw −2,14° → −28,04° |
| 3 | Er **liefert benannte Belege** | Frame 780×493, 52 488 B, `sha256 f4ce2224…`; HUD (`Runde 1/1`, `0:10.53`, `Drift 0/3`) und eingebrannter Stempel `62ef02a` im Bild. Angesehen, nicht nur gehasht |

Der Renderer lief headless über SwiftShader; WebGL war auf dem Gerät kein Hindernis.

**Eine Ehrlichkeit zum Bild:** das Kart steht im Gras. Das ist die Fahrt der Canary, kein Defekt —
`lateral −53,99` bei `halfWidth 6`, also 54 m neben der Ideallinie, nachdem stumpf Gas und dann
Lenkung gehalten wurde. Vor dem Berichten geprüft, damit aus einer groben Eingabe kein Phantom-Befund
wird.

## Der Befund: der Verify-Vertrag ist nicht portabel

`bun run verify` auf second-host: **16 von 17 Breakern grün, `T14 auslauf leckt nicht` ROT** —
Trace-Digest `d113eb90`, eingebrannt erwartet `b8c98758`.

Die Gegenprobe entscheidet die Zuordnung, statt sie zu vermuten: **dasselbe Bundle, derselbe
Commit, frischer Scratch-Klon auf dem Mac → `ALL PASS`.** Also **Plattform**
(arm64/macOS 26.3.1 vs x86_64/Debian 13), **kein roter Commit und kein Regress**.

Bemerkenswert daneben: `T4 determinismus` ist auf second-host grün — die Sim ist dort in sich
deterministisch, sie landet nur auf einer anderen Zahl. Und `T15 lenkung im bild`, der
Konventions-Pin aus dem Workflow-Audit (V1), ist auf Linux grün.

**Konsequenz für die Richtung, und sie ist neu:** ein Breaker, der einen Trace-Digest gegen EINE
eingebrannte Baseline hält, kann auf zwei Architekturen nicht beides sein. Solange das so steht,
darf `second-host` einen Spiel-Build **fahren und bebildern**, aber **nicht grün oder rot sprechen** —
sein Verdikt wäre für diese eine Zeile strukturell falsch. Das ist eine Vorbedingung, die der
Phase-0-Plan nicht kannte: vor Spielarbeit auf dem zweiten Rechner braucht der Digest-Breaker
entweder eine plattformunabhängige Größe oder je Plattform verankerte Baselines.

## Host-Mutationen — vollständig, und alle zurückgebaut

Jede Mutation war vom Owner einzeln freigegeben (Kanal: einmalige ssh-Freigabe; Chromium
vorab genehmigt).

| Mutation | Rückbau, geprüft |
|---|---|
| `known_hosts`-Eintrag (Mac) | Zeile entfernt, Datei wieder 567 Zeilen, `ssh` scheitert wieder an der Host-Key-Prüfung |
| Arbeitsverzeichnis auf dem Gerät | entfernt |
| Bundle-Transfer, Klon, Checkout | mit dem Verzeichnis entfernt |
| `bun install` (2 Pakete) | mit dem Verzeichnis entfernt |
| `apt-get install chromium` | `purge` + `autoremove`, Binary `REMOVED` |
| Server-Prozess (Port 5173) | beendet, 0 Listener |
| Chromium-Prozess (Port 9222) | beendet, 0 Listener |

**Portal und Daemon blieben unberührt:** `fleet-helper` weiterhin `active`, Config-mtime
unverändert `2026-08-29`. Kein Deploy, kein Dispatch über die Canary hinaus.

**Ein Fehler, offengelegt:** das erste `pkill -f chromium` traf die eigene ssh-Kommandozeile —
`pkill -f` matcht die Zeile, die es ausführt — und beendete die Sitzung. Dieselbe Klasse, vor der
das Regelbuch bei `pkill -f "bun server.ts"` warnt. Aufgeräumt wurde danach über den
Socket-Eigentümer (`ss -lptn "sport = :5173"`), nicht über ein Namensmuster.

## Was diese Notiz NICHT belegt

- **Die Startampel-Sperre.** Die erste Probe fiel bei t=4,03 s, also hinter die Freigabe;
  `speedWhileLightRed` ist damit **ungemessen**, nicht bestanden. Wer sie will, misst ab t=0.
- **Kein Geschmacksurteil.** Die Canary sagt „läuft und nimmt Tasten an", nicht „spielt sich gut".
- **Die Wurzel der T14-Differenz** im Sim-Code ist nicht gesucht worden; ob eine dritte
  Architektur wieder anders fällt, ist offen.
- **Der Frame selbst ist NICHT committet** — das Private-repo-o-Repo hat Capture-Artefakte bewusst
  entfernt (`945b563`). Erhalten ist hier, was trägt: Maße, Hash und das, was im Bild stand.
