---
frage: Misst "composer still holds 129 chars" (inboxNudgeSend, Slot 10, codex) den Eingabepuffer (H1) oder Bildschirm-Rest (H2)?
urteil: H1 — der gemalte Codex-Composer IST der Eingabepuffer; ein Repaint ohne Eingabe laesst ihn stehen und ein angehaengtes Byte landet hinter der vollen 193-Zeichen-Nutzlast. Die 129 sind nur seine erste Bildschirmzeile. Enter wurde vom `$`-Mention-Overlay gefressen, das ein terminales `$FLEET_SELF_TOKEN` oeffnet — Laenge spielt keine Rolle (63 Zeichen mit `$` scheitern, 193 ohne `$` gehen durch).
bereich: [zustellung, composer, inbox-nudge, codex, acceptance]
belege: [composer.ts#composerResidue, composer.ts#composerRows, server.ts#sendText, server.ts#awaitComposer, server.ts#tickInboxNudge, streams/prompts.jsonl, docs/messungen/2026-09-11-inbox-nudge-composer-129.md]
nicht-gemessen: claude-Pane (§6 der Vorgaengernotiz bleibt offen), codex-Versionen ausser 0.153.4, Wiederholung je Arm (n=1), andere Breiten als 133 Spalten
stand: 2026-09-14
---

# Der 129-Zeichen-Composer ist der Eingabepuffer (H1) — gemessen in vier Wegwerf-Panes

Lane `fleet/260914005824-652d`, Baum `f9b5f027`, 2026-09-14 03:0x. Vorgaengernotiz:
`docs/messungen/2026-09-11-inbox-nudge-composer-129.md` (§4 separierende Probe, §6 H1/H2).
Die Phase-1-Probe dort (§7) blieb an der Transcript-Bindung ueber einen Fleet-Server haengen. Diese
Probe braucht keinen Fleet-Server und darum keine Bindung.

## 1 · AUFBAU — keine lebende Pane, kein Fleet-Server

- **Socket:** je Arm ein frischer tmux-Server `-L fleetprobe129<arm><pid>`, danach `kill-server`;
  gegengeprueft, dass keiner mehr lebt (`tmux -L … ls` → „no server") und kein Probe-codex-Prozess
  bleibt (`ps -eo command | grep -c` → `0`). Der Live-Socket `claudefleet` wurde nur einmal
  LESEND angefasst (`display -p '#{pane_width}x#{pane_height}'` an `s10` → `237x66`).
- **Harness:** `codex-cli 0.153.4`, gestartet mit `env -u FLEET_SELF_TOKEN -u FLEET_SELF_SLOT
  -u FLEET_SELF_URL codex -c check_for_update_on_startup=false -c model_reasoning_effort=low` in
  einem leeren Scratch-Verzeichnis (Session-Scratchpad), Fenster 133×50.
- **Bereitschaft:** Header `>_ OpenAI Codex (v` sichtbar, `model: loading` weg, kein „trust" auf dem
  Schirm, `composerResidue` leer — drei Frames in Folge. Vor dem Paste zusaetzlich
  `composerResidue === ""`, sonst bricht die Sonde mit Exit 4 als SIE SELBST ab.
- **Sendesequenz = `server.ts#sendText`, Schritt fuer Schritt:** `load-buffer -b probebuf -`,
  `paste-buffer -p`, 150 ms, Arrival-Poll mit `composerRows`+`composerArrival` (≤ 3000 ms),
  `send-keys Enter`, dann 3000 ms Poll mit `composerResidue` bis leer — also genau die Lesung, die
  `awaitComposer` fuer die Fehlermeldung macht.
- **Nicht gezaehlt — ein Probeaufbaufehler:** der erste Lauf erklaerte die Pane zu frueh fuer bereit;
  der Paste landete im Trust-Dialog und Enter beantwortete ihn (exakt der 2026-08-10-Mechanismus aus
  dem Adapter-Kommentar). Kein Composer-Ergebnis; danach die Dreifach-Bereitschaft oben.

## 2 · DIE VIER ARME

Der Incident-Text ist wortgleich aus `streams/prompts.jsonl` (150 Zeilen `delivery:
"SendNotAccepted"`, alle Slot 10, alle 193 Zeichen, alle mit `… aus $FLEET_SELF_TOKEN).` am Ende).

| Arm | Text | Zeichen | `$NAME` am Ende | Composer 3000 ms nach Enter | Overlay | Turn im Rollout |
|---|---|---|---|---|---|---|
| long-dollar | Incident-Text | 193 | ja | **129** (Reihen 129+64) | `no matches` / `Press enter to insert or esc to close` | **nein** |
| long-nodollar | Incident-Text, `$`→`%` | 193 | nein | **0** nach 14 ms | nein | **ja** |
| short-dollar | `[fleet inbox] probe (x-fleet-self-token aus $FLEET_SELF_TOKEN).` | 63 | ja | **63** | ja | **nein** |
| current-213 | Hint seit 2026-09-12 (`$FLEET_SELF_TOKEN` mitten im Satz) | 213 | nein | **0** nach 23 ms | nein | **ja** |

Methode je Spalte:
- **Composer-Zahl:** `composerResidue(›-Form, capture-pane -p -e)` — dieselbe Funktion, die
  `readComposer` → `awaitComposer` benutzt. „Reihen" = Laengen aus `composerRows` auf demselben Frame.
- **Overlay:** Klartext-Frame nach Enter enthaelt eine der beiden in `composer.ts#composerRows`
  bereits als Chrome gefuehrten Zeilen.
- **Turn im Rollout:** die unter `~/.codex/sessions/2026/09/14/` NACH dem Spawn geborene
  Rollout-Datei mit `"cwd":"<scratch>"` enthaelt den Payload-Text (ja) oder es gibt keine
  (nein). Beide abgelehnten Arme hinterliessen keine Rollout-Datei; beide angenommenen genau eine.

**Laenge ist keine Ursache:** 193 Zeichen ohne `$` gehen durch, 63 mit `$` nicht. Das terminale
`$NAME` oeffnet das Mention-Overlay, dessen Enter „insert" bedeutet und kein Submit ist. Das ist die
Form, die `RULE_SIGIL` seit 2026-09-05 verbietet und die der Hint-Umbau vom 2026-09-12 beseitigt hat;
der Arm current-213 belegt, dass der heutige Text auf codex 0.153.4 angenommen wird.

## 3 · DER DISKRIMINATOR H1/H2 — zwei Proben nach dem Scheitern, beide ohne Enter

Nur in den beiden abgelehnten Armen, jeweils sofort nach dem 3000-ms-Fenster:

1. **Repaint ohne Eingabebyte:** `resize-window -x 113`, 800 ms, `resize-window -x 133`, 1200 ms.
   Die TUI zeichnet ihren Zustand neu. H2 (Rest) sagt: der Text verschwindet. Gemessen:
   long-dollar weiter **129+64** Zeichen, `composerHoldsExactly(rows, payload) === true`;
   short-dollar weiter **63**, exakt.
2. **Ein Sentinel-Byte:** `send-keys -l Q`, 800 ms. H1 (Puffer) sagt: `payload + "Q"`; H2 sagt: `"Q"`.
   Gemessen: long-dollar Reihen **129+65**, `composerHoldsExactly(rows, payload+"Q") === true`,
   `composerHoldsExactly(rows, "Q") === false`; short-dollar **64**, ebenso.

Beide Proben fallen gleich aus: **H1.** Der gemalte Composer ist der Eingabepuffer. Der Frame nach
Enter (long-dollar, Composer-Region, SGR entfernt bis auf die Glyph-Zeile):

```text
\e[1m›\e[0m [fleet inbox] 5 ungelesene Eintraege in der Inbox deines Programs f9dc8e101bcc10c5e90b0eed — GET /api/self/inbox, dann POST /api/
  self/inbox/<id>/read (x-fleet-self-token aus $FLEET_SELF_TOKEN).

  no matches

  Press enter to insert or esc to close
```

## 4 · WAS DARAUS FUER DEN SENSOR FOLGT

`composerResidue` liest bei der Glyph-Form nur die Glyph-Zeile. Seine Aussage „leer / nicht leer"
war im Incident richtig (die erste Zeile war nicht leer, der Puffer auch nicht), seine ZAHL nicht:
129 statt 193. Und er ist strukturell blind fuer einen Puffer, dessen erste Zeile leer ist und dessen
Rest in Fortsetzungszeilen steht. Weil H1 gilt, darf der Fix auf dem gemalten Composer aufbauen — er
muss ihn nur ganz lesen: Glyph-Zeile plus alle eingerueckten Fortsetzungszeilen bis zur ersten
Leerzeile/Regel.

**Umgesetzt (Teil 2):** `composer.ts#composerBuffer`, von `server.ts#readComposer` benutzt — also von
der Pre-Paste-Belegungspruefung und von `server.ts#awaitComposer`. Auf den Frames dieser Probe:
long-dollar nach Enter `composerResidue` 129 / `composerBuffer` **193**; nach dem Sentinel 129 / 194;
current-213 vor Enter 128 / 212 (ein am Umbruch verschluckter Leerschritt — die Zahl ist hoechstens
um eins je Umbruch zu niedrig, nie zu hoch); alle leeren Composer 0 / 0. Sonde:
`e2e/watch.ts` „acceptance reader counts the whole buffer" + „acceptance buffer reader: an empty glyph
row …"; rot, wenn `readComposer` wieder `composerResidue` liest, und rot, wenn `composerBuffer` nur
die Glyph-Zeile liest (beide Mutationen gefahren).

## 5 · NICHT GEMESSEN

- **claude:** §6 der Vorgaengernotiz (66 Zeichen Owner-Text, Enter ohne Turn, Leerzeichen raeumt weg)
  ist ein anderer Fall auf einer anderen TUI; diese Probe sagt darueber nichts.
- **n=1 je Arm**, eine Breite (133), eine codex-Version. Die 150 identischen Live-Fehlschlaege auf
  Slot 10 und ein live angenommener 213-Zeichen-Hint auf demselben Slot (`delivery: "observed"`,
  `prompts.jsonl`) stuetzen dieselbe Trennung, sind aber keine Wiederholung dieser Probe.
- **Warum der Hint vor dem 2026-09-12 den `$` am Ende hatte,** und ob andere Fleet-Texte in codex
  noch so enden, ist Sache des bestehenden Pins (`e2e/pins.ts`, `RULE_SIGIL`), nicht dieser Notiz.
