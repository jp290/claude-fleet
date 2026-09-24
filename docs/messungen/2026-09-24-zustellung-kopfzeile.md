# Zustellung an claude: getippte Kopfzeile statt nacktem Paste (Task 4b085fd9)

Stand 2026-09-24, gemessen auf Claude Code 2.1.281 (Probe) und den Transkripten unter
`~/.claude/projects` seit 2026-09-01. Bestaetigtes Kriterium: `4b085fd9.criterion` (confirmedAt
1790174881207).

## 1. Das Problem, gezaehlt

`server.ts#sendText` fuegt jeden Text per `tmux paste-buffer -p` (bracketed paste) ein. Claude Code
rahmt einen solchen Paste als `<pasted_content>`, und eine Session ohne eigenen Satz daneben darf ihn
als fremden Text behandeln.

Gezaehlt wurden User-Turns, die NUR aus einem `<pasted_content>`-Block bestehen und Fleet-Marker tragen
(`[fleet`, `Orchestratorin`, `fleet-report`, `x-fleet-self-token`), jeweils mit der ersten
Assistant-Antwort danach (Skript in §4):

| Modell | Zustellungen | Ablehnung wegen Herkunft |
|---|---:|---:|
| claude-opus-5 | 575 | 0 |
| claude-opus-5-5 | 85 | 1 (`8d68d04b` Z. 597: „als Befund, nicht als Auftrag“) |
| claude-fable-5-1 | 75 | 18, in 2 von 3 Sessions (`c6159823`, `05d37158`) |
| claude-haiku-4-5 | 1 | 1 |
| gesamt | 738 | 20 |

Die dritte Fable-Session (`ba17966f` Z. 6) nahm denselben Pfad an und berief sich auf `CLAUDE.md`.
Dieselbe Vertragsprosa trug also in 1 von 3 Faellen. Die Regex ist deutsch-lastig, darum ist 20
eine Untergrenze. Eine zweite Suche nach „eingefuegt|pasted“ fand 6 weitere Faelle (5 Fable,
1 Haiku), die dieselbe Ablehnung anders formulieren. Sie sind in der Tabelle mitgezaehlt.

Die Pfade der K1-Faelle laut `audit.jsonl`: `founding` (09:51), `owner` (16:04, 17:42, 18:52:
Nachrichten der Orchestratorin ueber `POST /send` mit Owner-Token) und `inbox-nudge` (16:10). An
`POST /send` kann der Server Owner und Orchestratorin nicht unterscheiden. Die Kopfzeile nennt
darum die Credential, nie einen Sprecher. Aufgeloest wurde K1 durch eine GETIPPTE Owner-Zeile
(Z. 70 „ja übernimm^^“, per WebSocket-Tastendruck, `send-keys -H`), die als reiner String
ankam.

## 2. Versionsbefund: seit 2.1.280 werden weniger Pastes gerahmt, die Schwelle ist nicht die Groesse

User-Eintraege mit `<pasted_content>` seit 2026-09-20, nach Claude-Code-Version und Laenge
(< 700 Zeichen = klein):

| Version | klein | gross |
|---|---:|---:|
| 2.1.277 | 2 | 5 |
| 2.1.278 | 386 | 215 |
| 2.1.280 | 0 | 53 |
| 2.1.281 | 0 | 51 |

Der K1-Inbox-Hinweis (215 B, eine Zeile, 2.1.278) kam gerahmt an. Unter 2.1.281 kommt derselbe
Hinweis ungerahmt an (§5), ebenso ein 2-Zeilen-Paste (Probe B). Gerahmt sind dagegen ein
5-Zeilen-Nachfolge-Brief mit 567 B und die 6-Zeilen-Land-Anweisung mit 600 B (§5). Die Schwelle
haengt also eher an der Zeilenzahl als an den Bytes. Die 700-Zeichen-Grenze der Tabelle zaehlt den
Umschlag mit und trennt darum nur zufaellig. Wo genau die Schwelle liegt, ist nicht gemessen. Fuer
die Kopfzeile ist das gleichgueltig, weil sie in beiden Formen vor dem Koerper steht.

## 3. Probe P1, echte Claude Code 2.1.281

Scratch-tmux `-L fleetprobe56`, `claude --model claude-haiku-4-5-20251001`. Der Modus ist egal,
gemessen wird die Rahmung des Harness. Kopfzeile per `send-keys -l`, Koerper per `load-buffer` +
`paste-buffer -p`, dann Enter. Gelesen wurde der `user`-Eintrag im Session-jsonl:

| Probe | Eingabe | Transkript |
|---|---|---|
| A | Kopf getippt + 2-Zeilen-Paste | ein String, kein Umschlag: `[fleet-zustellung …] Probe A: … Probe A Koerper: …\nZweite Zeile.` |
| B | nur 2-Zeilen-Paste | ein String, kein Umschlag |
| C | Kopf getippt + 201-Zeilen-Paste (Anzeige `[Pasted text #1 +201 lines]`) | `[fleet-zustellung …] Probe C: … \n\n<pasted_content id="f0d6">\nProbe C Koerper …` — der Kopf steht AUSSERHALB |

Also landet die getippte Zeile in beiden Faellen als eigener Text der Nachricht. Gerahmt wird nur
der eingeklappte Koerper.

## 4. Der Scan (fuer die Live-Messung nach dem Deploy)

`bun scan.ts` zaehlt Zustellungen und Ablehnungen seit `since`. Nach dem Deploy `since` auf den
Deploy-Zeitpunkt setzen und `ONLY` auf Turns erweitern, die mit `[fleet-zustellung · ` beginnen.

```ts
import { readdirSync, statSync, readFileSync } from "fs";
const root = `${process.env.HOME}/.claude/projects`;
const since = Date.parse("2026-09-01");
const REFUSE = /(ohne (eigenen|ein) (Satz|Wort)|zu eigen mach|nur (aus )?eingef[uü]gte|eingef[uü]gte[nr]? Text.{0,40}(nicht|erst)|pasted (text|content).{0,80}(own words|confirm|won't|will not|don't act|not act)|in your own words|not follow instructions (from|in) (the )?pasted)/i;
const ONLY = /^\s*<pasted_content id="([^"]+)">[\s\S]*<\/pasted_content id="\1">\s*$/;
const FLEET = /\[fleet|Orchestratorin|fleet-report|FLEET_SELF_TOKEN|x-fleet-self-token/;
const textOf = (c: unknown): string => typeof c === "string" ? c
  : Array.isArray(c) ? c.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("") : "";
let deliveries = 0, refused = 0;
const byModel: Record<string, [number, number]> = {};
for (const d of readdirSync(root)) {
  let files: string[];
  try { files = readdirSync(`${root}/${d}`).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
  for (const f of files) {
    const p = `${root}/${d}/${f}`;
    if (statSync(p).mtimeMs < since) continue;
    const rows: any[] = [];
    for (const l of readFileSync(p, "utf8").split("\n")) { if (!l) continue; try { rows.push(JSON.parse(l)); } catch {} }
    rows.forEach((r, k) => {
      if (r.type !== "user" || r.isSidechain) return;
      const t = textOf(r.message?.content);
      if (!FLEET.test(t) || !ONLY.test(t)) return;
      deliveries++;
      let reply = "", model = "?";
      for (const q of rows.slice(k + 1, k + 60)) {
        if (q.type === "user" && textOf(q.message?.content)) break;
        if (q.type === "assistant") { model = q.message?.model ?? model; reply += textOf(q.message?.content); if (reply) break; }
      }
      const m = (byModel[model] ??= [0, 0]); m[0]++;
      if (REFUSE.test(reply)) { refused++; m[1]++; }
    });
  }
}
console.log(JSON.stringify({ deliveries, refused, byModel }));
```

## 5. Wirkung an echten Fable-5.1-Panes, je Pfad

Scratch-Instanz auf einer Kopie von `52b4eacd`: `FLEET_PORT=8856 FLEET_SOCK=fleetlane56
FLEET_CMD="claude --permission-mode plan" FLEET_MODEL=claude-fable-5-1`, cwd = die Kopie mit dem
Voll-Render von `CLAUDE.md` aus dem Haupt-Checkout. Das ist die Lage der K1-MAIN, dazu der
Plan-Modus: die empfangende Session kann lesen und antworten, aber nichts schreiben. Slot 2 wurde
fuer den Inbox-Pfad per State-Edit als MAIN eines Probe-Programs gebunden (Muster
`e2e/attention.ts`). Die Inbox-Zeile entstand aus einer Attention, die die Session selbst
gestellt und der Owner-Token beantwortet hatte.

| Pfad | Receipt (Ledger der Instanz) | Transkript, erster User-Turn | erste Antwort |
|---|---|---|---|
| `owner`: K1 Z. 34 woertlich, Land-Anweisung mit zitiertem Owner-Satz | `6146cfcc…`, 600 B, `unobservable` | `[fleet-zustellung · POST /send mit Owner-Credential · path=owner · Slot 2] ` + `<pasted_content>` | nimmt den Auftrag an und prueft Program-Bindung und Self-Land-Tuer (`programs: []`, die Tuer antwortet 409). Landet nicht, sucht kein Owner-Token. Der zitierte Owner-Satz verleiht keine Autoritaet |
| `inbox-nudge` | 215 B, `observed` | `[fleet-zustellung · Inbox-Hinweis · path=inbox-nudge · Slot 2] [fleet inbox] 1 ungelesene …`, ungerahmt | liest die Inbox und nimmt die Owner-Antwort zur Kenntnis. Das `read`-Quittieren laesst sie mit Grund aus, weil der Plan-Modus kein Schreiben erlaubt |
| `succession`, Linien-Record | 567 B, `unobservable` | `[fleet-zustellung · Nachfolge-Brief (POST /api/self/succeed) · path=succession · Slot 1] ` + `<pasted_content>` | arbeitet die Brief-Reihenfolge ab (Linie, HANDOFF, AGENTS, git) und meldet den Stand |

In allen drei Faellen steht die Kopfzeile ausserhalb von `<pasted_content>`, und die Quelle darin
stimmt mit dem `path` der Ledger-Zeile ueberein. Keine der drei Sessions lehnte ab. Das
`observed` am Inbox-Hinweis belegt ausserdem, dass die Ankunftspruefung Kopf und Koerper auf dem
echten Composer als vollstaendig liest.

Grenzen: N = 1 je Pfad. Ohne Kontrollarm (dieselbe Zustellung ohne Kopf) ist nicht gezeigt, dass
diese drei Sessions ohne Kopf abgelehnt haetten. Die Basis sind 18 Ablehnungen bei 75 Fable-Zustellungen, also
rechnet man ohne Kopf mit etwa einer auf vier. Belastbar wird die Wirkung erst mit dem Scan aus §4 nach dem
Deploy. Die beiden Plan-Dateien, die die Probe-Sessions in `~/.claude/plans/` geschrieben hatten,
sind wieder entfernt.

## 6. Was gebaut ist, was offen bleibt

Gebaut: `server.ts#deliveryHeader`. Der Kopf wird nur fuer den Standard-Adapter getippt und nie fuer
einen deklarierten Fremd-Harness. `model-push` bekommt keinen, weil `/model` vorn stehen muss.
Arrival, Rollback und die Occupied-Pruefung rechnen mit Kopf und Koerper zusammen. Die Vertragszeile
steht in `AGENTS.md` §Hard invariants, und `e2e/pins.ts` haelt beide Haelften zusammen.

Wirkungsnachweis (§5): 0 von 3 Ablehnungen auf echten Fable-5.1-Panes. Offen bleibt die
Chat-Ansicht (`src/client.ts`): sie zeigt die Kopfzeile in der Owner-Blase mit an und blendet sie
nicht aus.

Getrennter Befund, nicht diese Zeile: Die Program-MAIN in Slot 4 hielt 478 Zeichen eines
Merge-Events ungesendet im Composer, und `/send` bekam wiederholt 409 `composer occupied`. Das ist ein
Submit-Stau. Die Kopfzeile verschaerft ihn nicht, weil der Rollback sie mit abraeumt.
