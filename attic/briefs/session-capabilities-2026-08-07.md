# Was eine Nicht-Lane-Session kann, und was ihr fehlt

**Datum:** 2026-08-07 · **Art:** Untersuchung, kein Code · **Quelle:** Owner-Vorgabe Session 33

> „wir sollten versuchen den sessions genau so wie allen claudeFleet nativen sessions maximale
> Moeglichkeiten zu geben, dieses feature war schon unfassbar hilfreich. Ganz egal ob wir dafuer
> Daten aggregieren oder sonstiges."

**Anlass.** Slot 3 (plain session im Fleet-Checkout) hat sich am 07.08. selbst einen Heartbeat
gebaut: ein Auto auf den eigenen Slot, das den eigenen Kontextstand aus der tmux-Statuszeile liest
und über 45 % ein `/handoff` schreibt. Das ging nur, weil sein cwd das Install-Verzeichnis ist und
dort `fleet.json` mit dem Klartext-Owner-Token liegt — also über genau den Confused-Deputy-Pfad,
der am selben Tag bei Slot 6 als Share-Exposition zugemacht wurde.

**Warum als Bericht und nicht als Diff.** Die Fragen „gibt es das schon" und „was darf so ein
Token" waren ungeklärt. Ein Credential-Design, das man erst im Diff sieht, ist das falsche Ende.

**Beweisregel für dieses Dokument.** Jede Behauptung über Panes stammt aus `ps eww` an lebenden
Panes, nie aus der Doku — CLAUDE.md hat sich in dieser Frage schon zweimal geirrt. Jede Behauptung
über Verhalten trägt `file:line` oder eine wörtlich zitierte Messung.

---

## Teil 1 — Pane-Env, gemessen mit `ps eww`

Token redigiert. Die `claude`-Kindprozesse wurden zusätzlich einzeln gemessen — sie erben
identisch, die Zeile ist also nicht nur die der Pane-Shell.

| Klasse | Session · cwd | pane pid | FLEET_* im Env (wörtlich) |
|---|---|---|---|
| **Lane** (Fleet-Repo) | s1 · `~/claude-fleet.worktrees/fleet-260806231635-0040` | 49410 | `FLEET_SELF_TOKEN='<32hex>'` · `FLEET_SELF_SLOT='1'` |
| **Lane** (Fleet-Repo) | s2 · `~/claude-fleet.worktrees/fleet-260806234457-e00d` | 72712 | `FLEET_SELF_TOKEN='<32hex>'` · `FLEET_SELF_SLOT='2'` |
| **Lane** (**fremdes** Repo) | s8 · `~/private-repo-a.worktrees/fleet-260804144705-6c1e` | 37554 | `FLEET_SELF_TOKEN='<32hex>'` · `FLEET_SELF_SLOT='8'` |
| **⚙ steward** | s12 · `~/claude-fleet.worktrees/steward` | 99921 | `FLEET_STEWARD_TOKEN='<32hex>'` — **sonst nichts** |
| **plain, Fleet-Checkout** | s3 · `~/claude-fleet` (der Heartbeat-Slot) | 17202 | *(keine)* |
| **plain, Fleet-Checkout** | s6 · `~/claude-fleet` | 73751 | *(keine)* |
| **plain, Fleet-Checkout** | s13 · `~/claude-fleet` | 62679 | *(keine)* |
| **plain, fremdes Repo** | s10 · `~/private-repo-a` | 20462 | *(keine)* |
| **plain, fremdes Repo** | s16 · `~/private-repo-b` | 986 | *(keine)* |
| **plain, kein Repo** | s15 · `~` | 5125 | *(keine)* |

Zwei Befunde, die so nirgends stehen:

1. **Der Steward hat KEIN `FLEET_SELF_TOKEN` und kein `FLEET_SELF_SLOT`** — nur
   `FLEET_STEWARD_TOKEN`. Er kann `/api/self/*` also gar nicht erreichen. Sein cwd ist physisch
   ein git-Worktree, aber `s.worktree` ist für ihn `null`, und genau daran hängt der Export.
2. **Lane-Sein hängt nicht am Repo.** s8 liegt in einem fremden Repo und trägt trotzdem das volle
   Self-Paar. Die Trennlinie ist ausschließlich „von Fleet als Worktree angelegt", nicht „im
   Fleet-Repo".

---

## Teil 2 — Gibt es das schon? Ja, fast vollständig

**Das Credential existiert bereits für jeden Slot — auch für die plain sessions.**

- `server.ts:305` — jeder der `MAX_SLOTS` Slots bekommt bei Konstruktion
  `selfToken: randomBytes(16).toString("hex")`.
- `server.ts:1602` — `openSlot` rotiert ihn bei jeder Neubelegung.
- `server.ts:734` — `saveState` persistiert ihn für **jeden** Slot mit cwd, ohne Lane-Bedingung.

### Der 409-vs-401-Beweis

Drei Punkte gegen den Live-Server, `GET /api/self/gate` (ein Pfad ohne Seiteneffekt):

```
slot 3 (plain session, Fleet-Checkout) selfToken → HTTP 409
  {"error":"not a lane — the gate judges a lane's land"}

bogus token (32× deadbeef)                       → HTTP 401
  {"error":"unauthorized"}

meine Lane (s2), Kontrolle                       → HTTP 200
  {"verify":{"cmd":"[ -f fleet-e2e.ts ] || …
```

409 statt 401 heißt: **der Server erkennt das Credential einer plain session bereits heute an.**
Es wird nur nie in die Pane exportiert. Die Unterscheidung ist Absicht und im Code kommentiert
(`server.ts:8000-8002`): „a plain session's credential is valid but the question is not askable".

### Die Fundstelle — ein Ternary

```ts
// server.ts:1506-1507
const selfExport = s.worktree
  ? `export FLEET_SELF_TOKEN='${s.selfToken}'; export FLEET_SELF_SLOT='${s.id}'; ` : "";
```

### Die Routen-Familie und ihre echten Guards

Alle liegen vor dem Owner-Gate (`server.ts:8292`).

| Route | Zeile | Guard über den Token-Match hinaus |
|---|---|---|
| `POST /api/self/autos` | 7984 | **keiner** — `createAutoForSlot` (1752) verlangt nur `s.cwd` |
| `GET /api/self/drift` | 7996 | `if (!w) → 409` |
| `GET /api/self/gate` | 8033 | `if (!s.worktree) → 409` |
| `POST /api/self/criterion` | 8070 | `if (!s.worktree) → 409` |
| `POST /api/self/verify-intent` | 8097 | `if (!s.worktree) → 409` |

**Die Kernaussage dieses Berichts:** `POST /api/self/autos` — genau die Fähigkeit, die Slot 3 sich
von Hand über den Owner-Token gebaut hat — **hat überhaupt keine Lane-Prüfung**. Sie würde für
jede plain session sofort funktionieren, wenn das Ternary in `server.ts:1506` den Token
exportierte. Kein Routen-Code, kein neues Credential, kein neues Auth-Modell.

Die Slot-Bindung ist strukturell, nicht geprüft: `server.ts:7986` leitet `s` aus dem Token-Match
ab, ein `slot`-Feld im Body wird nirgends gelesen. Ein Self-Token kann konstruktiv keinen fremden
Slot treffen.

---

## Teil 3 — Vorschlag, Fähigkeit für Fähigkeit, mit Kosten

### Was ein Plain-Session-Token können muss

| Fähigkeit | Weg | Zustand | Kosten |
|---|---|---|---|
| Sich selbst planen / terminieren | `POST /api/self/autos` | **existiert, ungegated** | nur der Export |
| Eigenen Zustand lesen | neue schmale Route | — | siehe unten |
| Eigenen Kontextstand | existiert nicht | — | Teil 4 |

Für „eigenen Zustand lesen" ist `/api/self/gate` der falsche Träger: sein Inhalt (`verify`,
`cleanReview`, `mergeRepairRounds`, `rulebookDrifted`) ist wörtlich Land-Gate-Wissen und für eine
plain session bedeutungslos. Der 409 dort ist **korrekt** und sollte bleiben. Eine plain session
braucht eine eigene, schmale Antwort (Slot-Id, Label, cwd, mission, idle-Zeit, eigene Autos) — das
ist die einzige Stelle, an der wirklich neuer Routen-Code entsteht.

### Was es NIE können darf

| Verbot | Wie es heute durchgesetzt ist | Restkosten |
|---|---|---|
| Einen anderen Slot anfassen | strukturell: `server.ts:7986`, `s` aus dem Token-Match, `slot` im Body nie gelesen | **null** |
| Landen / dispatchen / Shares anlegen | Owner-Gate `server.ts:8292`, alle diese Routen liegen dahinter | **null** |
| Eigene Arbeit labeln | expliziter 403 vor dem Owner-Gate, `server.ts:8111-8114` | **null** |
| Unsterbliche Autos minten | `perpetual && !opts.allowPerpetual → 403`, `server.ts:1766-1767` | **null** |
| **`fleet.json` lesen** | **gar nicht** | siehe unten |

**Ehrlich benannt: das Token kann das `fleet.json`-Loch nicht schließen.** Die Datei ist
`-rw------- … 502258 bytes`, und jede Session läuft unter derselben uid. Slot 3 kommt an den
Owner-Token, weil sein **cwd** das Install-Verzeichnis ist — nicht, weil ihm eine Berechtigung
fehlt. Ein Self-Token *ersetzt* diesen Pfad (macht ihn unnötig), aber es *versperrt* ihn nicht.
Wer ihn wirklich zumachen will, muss die Sessions aus dem Install-Verzeichnis herausbewegen. Das
ist eine andere, größere Entscheidung und wird hier nicht mitvorgeschlagen.

### Wo genau der Export hängt

Reine **Spawn-Zeit**-Entscheidung, mit zwei Vorbildern nebeneinander:

```ts
// server.ts:1506-1507  — keyed auf das worktree-Flag
const selfExport = s.worktree ? `export FLEET_SELF_TOKEN='…'; export FLEET_SELF_SLOT='…'; ` : "";
// server.ts:1513-1514  — keyed auf das LABEL
const stewardExport = s.label === STEWARD_LABEL && stewardToken
  ? `export FLEET_STEWARD_TOKEN='…'; ` : "";
// server.ts:1515-1516  — beides fließt in genau einen tmux new-session-String
await tmux("new-session", …, `${selfExport}${stewardExport}${slotCmd(candidate, resume, s.model)}`);
```

`server.ts:1511-1512` nennt die Konsequenz: Env ist nur beim Spawn injizierbar, eine laufende Pane
wird **nie** nachgepatcht. Ein Flip wirkt also erst auf neu gespawnte oder geheilte Panes — die
acht laufenden plain sessions bekämen ihn nicht.

### Die Kosten des Flips, konkret

1. **`e2e/self-token.ts:25` behauptet heute das Gegenteil** und ist damit die aufgeschriebene
   Entscheidung:
   ```ts
   check("FLEET_SELF_TOKEN absent for a non-lane slot", plainTok === "", `[${plainTok}]`);
   ```
   Dieser Check müsste umgeschrieben werden. Er ist kein Kollateralschaden, sondern *der Ort*, an
   dem der Sicherheitsentscheid dokumentiert ist.

2. **`e2e/security.ts:50-56`**, die `PRE_AUTH_ROUTES`-Liste, kommentiert die Familie als „the
   scoped per-lane credential". Der Header darüber sagt: *„Adding one is a security decision; this
   list is where that decision is recorded."* Die Entscheidung weitet sich von „Lanes" auf „jede
   Session" — der Review gehört in diese Datei, nicht in einen Commit-Body.

3. **Die einzige wirklich neue Angriffsfläche:** eine plain session in einem **fremden** Repo
   (s10, s16, s15) hielte dann ein Fleet-Credential, das sie heute nicht hat. Was sie damit kann,
   ist genau: Prompts in ihre **eigene** Pane planen. Gedeckelt durch `AUTO_MAX_PER_SLOT` (5
   aktive), `AUTO_MIN_EVERY_SEC`, den Pflicht-Run-Cap und den `perpetual`-403. Das ist eine echte
   Ausweitung und soll so benannt werden — aber sie ist kleiner als der Status quo, in dem
   dieselbe Session per `cat fleet.json` an den Owner-Token käme, sobald sie im richtigen
   Verzeichnis steht.

---

## Teil 4 — Der Kontext-Wächter

### Gibt es einen Weg außer der eigenen tmux-Pane? Nein

Gemessen, nicht angenommen:

```
grep -cniE 'contextPct|ctxPct|compactAt|autocompact|contextWindow|tokenCount|usedTokens' server.ts
→ 0
(dasselbe über *.ts src/*.ts e2e/*.ts → keine Treffer)
```

Fleet weiß über den Kontextstand seiner Sessions **nichts**. Keine Route, kein Feld, kein Tick.

### Sensor A — das Transcript

Claude Codes eigenes Transcript (`~/.claude/projects/<slug>/<uuid>.jsonl`) trägt auf jeder
Assistant-Zeile ein `message.usage`:

```json
{"input_tokens":2,"cache_creation_input_tokens":1638,"cache_read_input_tokens":82536,"output_tokens":890, …}
```

Kontext = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, gelesen aus der
letzten solchen Zeile.

**Der Server hat den Weg bereits:** `projDir()` `server.ts:553`, `transcriptFile()`
`server.ts:2800`, und er pinnt `s.sessionId` schon beim Spawn (`server.ts:1520`), genau damit der
Transcript-Pfad bekannt statt geraten ist.

**Verunreinigungs-Test:** `isSidechain=true`-Usage-Zeilen über **1.080 Transcript-Dateien /
87.280 Usage-Zeilen: 0**. Subagenten verschmutzen die Messung nicht.

### Sensor B — die Statuszeile

`~/.claude/statusline-command.sh` (Datei des Owners, **außerhalb dieses Repos**) formatiert einen
Wert, den Claude Code selbst liefert:

```bash
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
```

### Validierung — und die Korrektur des Owners

| Pane | Zustand | Transcript gerechnet | Statuszeile | Δ |
|---|---|---|---|---|
| s3 (plain, Fleet-Checkout) | ruhend | 233.163 tok = 23,3 % von 1M | `23%` | 0,3 |
| s2 (Lane) | ruhend | 88.314 tok = 8,8 % von 1M | `9%` | 0,2 |
| **s3 (plain)** | **mitten im Zug** | **247.809 tok = 24,8 %** | **`26%`** | **1,2** |

**Die dritte Zeile ist eine Nachmessung des Owners und korrigiert meine erste Fassung.** Ich hatte
aus den beiden ruhenden Momentaufnahmen geschrieben „beide treffen die angezeigte Ganzzahl". Das
hält für den Ruhezustand und **nicht unter Last**.

Damit ist meine Lücke Nr. 2 (Nachlauf) nicht theoretisch, sondern gemessen — **und die Richtung
ist die ungünstige: der Transcript-Sensor liest ZU NIEDRIG.** Bei einem Schwellwert-Auslöser
(„über 45 % → `/handoff`") ist zu niedrig die gefährliche Richtung: der Wächter feuert zu spät
oder gar nicht. Ein Sensor, der unter Last nach unten abweicht, ist genau unter Last unbrauchbar,
und Last ist der Zustand, für den man ihn baut.

### Empfehlung

**Beide Quellen lesen, den höheren Wert nehmen, und eine Abweichung über ~5 Punkte selbst als
Signal behandeln.** Der höhere Wert ist die konservative Seite eines Schwellwerts; die Divergenz
ist ihr eigener Befund (sie heißt: eine Quelle ist stehengeblieben). Slot 3 fährt seit dem
07.08. genau so.

### Die drei ehrlichen Lücken

1. **Der Nenner.** 233.163 sind 23,3 % nur, wenn das Fenster 1M ist. Ableitbar aus `s.model`
   (`claude-opus-5[1m]`) bzw. `BASE_CMD`, aber es ist eine Modell→Fenstergröße-Tabelle, die der
   Server tragen und pflegen muss. **Das ist die eigentliche Kostenstelle — Wartung, nicht
   Rechenzeit.** Sensor B hat diesen Nenner geschenkt; das ist sein Beitrag.
2. **Nachlauf um einen Zug.** Die letzte Usage-Zeile gehört der letzten *abgeschlossenen*
   Antwort. Oben gemessen, siehe Korrektur.
3. **Nicht gepinnte Sessions** (`sessionId: null`, adoptiert) fallen auf newest-by-mtime zurück
   (`server.ts:2806`) — dieselbe Unschärfe, die die Transcript-Ansicht heute schon hat.

---

## Teil 5 — Durchgerechnet und verworfen

### Verworfen A: nur die Statuszeile per `capture-pane` abgreifen

Der naheliegende Vorschlag, und **genau das, was Slot 3 heute tut**. Der Server könnte pro Tick
`tmux capture-pane -p -t sN` fahren und `ctx \[[#-]+\] (\d+)%` matchen. Kein neues Konzept,
tmux-Verb ohnehin in Gebrauch, kein Modell→Fenster-Mapping nötig — der Nenner ist eingerechnet.

**Warum ich es als *alleinige* Quelle verwerfe.** Der String kommt aus einem Bash-Skript des
Owners außerhalb dieses Repos (`~/.claude/statusline-command.sh`, oben zitiert). Drei
Ausfallarten, und die erste ist die schlimme:

1. Der Owner ändert seine Statuszeile — sein Skript, sein Recht, kein Anlass, dabei an Fleet zu
   denken. Der Sensor liefert dann **still nichts**. Ein Wächter, der ohne Fehlermeldung
   verstummt, ist schlechter als keiner, weil man sich auf ihn verlassen hat.
2. Es ist eine gerenderte TUI-Zeile: sie driftet mit Breite, Redraw und Overlay — dieselbe Klasse
   Fehler wie die Marker-Overlays, gegen die hier schon einmal entschieden wurde.
3. Es macht Fleet von einer Datei abhängig, die die Worktree-Isolationsregel ausdrücklich als
   *geteilte Realität* führt („anschauen und berichten, nie anfassen").

**Amendment nach der Owner-Messung:** dieses „verworfen" gilt weiterhin für *Sensor B allein* —
aber es ist keine Absage an Sensor B. Die Messung mitten im Zug zeigt, dass Sensor A allein zu
niedrig liest. Beide sind einzeln unzureichend, aus verschiedenen Gründen: A driftet unter Last,
B kann still verschwinden. Die Empfehlung in Teil 4 (beide lesen, Maximum, Divergenz als Signal)
ist die Konsequenz. Verworfen ist damit die *Entweder-Oder*-Frage, nicht eine der Quellen.

### Verworfen B: formalisieren, was Slot 3 tatsächlich tut

Also: eine plain session im Install-Verzeichnis darf `fleet.json` lesen und den Owner-Token
benutzen — dokumentiert statt geduldet.

**Warum ich das verwerfe.** Es ist derselbe Confused-Deputy-Pfad, der am selben Tag bei Slot 6
zugemacht wurde. Der Owner-Token ist die ganze Maschine — landen, dispatchen, killen, Shares.
Gebraucht wird „einen Prompt in meine eigene Pane planen". Und es funktioniert nur, wenn cwd
zufällig das Install-Verzeichnis ist: Slot 10 und 16 könnten es nie. **Eine Fähigkeit, die mit dem
Zufall des Arbeitsverzeichnisses skaliert statt mit der Rolle, ist die Definition der falschen
Grenze.**

---

## Was ich NICHT geprüft habe

Diese Liste gehört zum Bericht, nicht weg.

- **`tickAutos`** habe ich nur über die ersten ~30 Zeilen gegrept (`slotFrom(a.slot)`, kein
  worktree-Bezug sichtbar) — die Funktion nicht vollständig gelesen. Dass der Zustell-Pfad keine
  Lane-Annahme trägt, ist damit **wahrscheinlich, nicht bewiesen**. Wer auf dem Flip aufbaut,
  liest sie zuerst ganz.
- **Gast-Slots** (`~/.claude-fleet-guest/`) — keine der vier gefragten Klassen, nicht gemessen.
- **Der Client** (`src/client.ts`) — ob das Board etwas anzeigen müsste, nicht angesehen.
- **Der WS-Pfad** — nur die HTTP-Guards geprüft.
- **Die Modell→Fenstergröße-Tabelle** aus Lücke Nr. 1 — nicht erhoben, nur als Kostenstelle
  benannt. Ob 1M für alle hier laufenden Pins stimmt, ist ungeprüft; validiert wurde sie
  ausschließlich gegen `claude-opus-5[1m]`.
- Der Kontextwert für s2 wuchs zwischen zwei Messungen von 88.314 auf 90.202 — die
  Statuszeilen-Gegenprobe in der Tabelle bezieht sich auf den ersten Wert.

**Ausgeführt:** nichts geschrieben, keine Suite gelaufen, kein fremder Slot berührt. Alle
Server-Anfragen waren GETs bzw. lasen auf 409-Pfaden; kein `POST /api/self/autos` wurde abgesetzt.
