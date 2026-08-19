# Werkzeugkosten-Grundlinie — was ein Byte im Lane-Kontext wirklich kostet

2026-08-19, Programm „Effizienz & Werkzeuge". Gemessen an den Claude-Code-Transcripts dieses Repos.
Jede Zahl unten trägt ihre Definition im selben Absatz — die Replay-Faktoren sind NICHT
austauschbar, und ein Faktor ohne seine Definition ist eine Zahl ohne Aussage.

## 1. Korpus

**278 Lane-Sessions mit usage-Daten aus 780 Claude-Code-Transcripts** unter
`~/.claude/projects/-Users-<user>-claude-fleet-worktrees-*/` (JSONL, eine Zeile je Nachricht;
`assistant`-Zeilen tragen `message.usage`). „Session mit usage-Daten" heißt: die Datei enthält
mindestens eine `assistant`-Zeile mit `message.usage`. Die übrigen 502 Dateien tragen keine solche
Zeile und gehen in keine Summe ein; WARUM sie keine tragen, wurde nicht untersucht (§7).

**Der Korpus trägt keinen Kompaktierungs-Marker:** 0 von 780 Dateien matchen
`isCompactSummary|compactMetadata`. Konsequenz für §2 — pro Session fallen Kontext-MAXIMUM und
finaler Kontext zusammen; kein Lauf hat seinen Kontext unterwegs zurückgesetzt.

## 2. Token-Summen und die drei Replay-Definitionen

Über alle 278 Sessions summiert: **cache_read 6.928.225.686 · cache_creation 144.621.271 · frischer
Input 167.918 · Output 38.170.898.** cache_read ist damit **98,0 % allen Inputs**
(6.928.225.686 / (6.928.225.686 + 144.621.271 + 167.918)). Frischer, ungecachter Input ist mit
167.918 Tokens praktisch nicht vorhanden — was eine Lane kostet, ist fast vollständig das erneute
Durchreichen dessen, was schon im Kontext liegt.

**Replay hat drei Definitionen, und sie ergeben drei verschiedene Zahlen. Wer eine nennt, nennt sie
mit:**

- **48x je Cache-Schreibvorgang** — Summenverhältnis `cache_read / cache_creation`
  (6.928.225.686 / 144.621.271 = 47,9). Antwortet: wie oft wird ein einmal geschriebener
  Cache-Block im Mittel wieder gelesen.
- **137x je residentem Kontext-Byte** — `cache_read` geteilt durch die **Summe der per-Session-
  MAXIMA** eines EINZELNEN Requests (`input + cache_read + cache_creation`, das Maximum über alle
  Requests der Session, dann über Sessions summiert): 6.928.225.686 / 50.552.667 = 137. Antwortet:
  wie oft wird ein Byte, das am Ende im Kontext liegt, über die Lebenszeit der Lane bezahlt. Das
  ist die Zahl, die für die Frage „lohnt sich dieser Absatz im Brief" zählt.
- **~40x Median-Lane** — Median der SESSION-EIGENEN Verhältnisse `cache_read / cache_creation`.
  Antwortet: was die typische Lane erlebt. Liegt unter dem Summenverhältnis (48x), weil wenige
  lange Lanes die Summe ziehen.

**Brücke zwischen den ersten beiden:** `cache_creation` ist 2,86x die Summe der Maxima
(144.621.271 / 50.552.667) — ein Kontext wird im Schnitt knapp dreimal neu geschrieben, weil jede
Turn-Grenze und jede Cache-Ablauf-Grenze den Block neu anlegt. 47,9 × 2,86 = 137. Die beiden Zahlen
widersprechen sich also nicht, sie zählen verschiedene Nenner.

**Gegenmessung von der Anbieter-Seite — schließt den Einwand „Replay-Faktor ist ein Artefakt des
Transcript-Scans".** Das Anthropic-Usage-Modal (Wochenverbrauch, abgelesen 2026-08-19 aus einer
geparkten Session) schlüsselt auf: **79 % des Verbrauchs entstehen bei Kontext >150k, 29 % stammen
aus Sessions mit 8+ Stunden Laufzeit.** Das ist Anthropics eigene Buchhaltung, unabhängig vom
Transcript-Scan dieser Grundlinie, und sie sagt dasselbe: nicht die Anzahl der Züge kostet, sondern
wie groß und wie lang ein Fenster bewohnt wird. **Zwei Vorbehalte, die mitgeschrieben gehören:**
der Render ist unbekannten Alters — als Größenordnung belastbar, als Stichtagswert nicht. Und die
Achsen sind Anthropics: „Kontext >150k" ist nicht identisch mit unserem Nenner (per-Session-
Maximum). Die beiden Messungen bestätigen sich in der RICHTUNG, nicht in der Einheit; keine der
Zahlen darf in die andere Rechnung eingesetzt werden.

## 3. Werkzeuge: wo die Bytes herkommen

**Bash ist 17.077 von ~23.100 Werkzeugaufrufen (74 %).** Nach zurückgegebenen Bytes gemessen:
**`tool_result`-Bytes gesamt 40.777.643, davon Bash 57,3 % und Read 38,2 % — zusammen 95 %.** Alle
übrigen Werkzeuge (Grep, Glob, Edit, Write, Task, WebFetch …) teilen sich die restlichen 5 %.
„tool_result-Bytes" heißt: die Länge des Inhalts, den der Werkzeugaufruf in den Kontext
zurückgegeben hat, nicht die Länge der Datei und nicht die des Aufrufs.

## 4. Der Verlust am anderen Ende: 28 % killed-empty

`lane-outcomes.jsonl` (gitignored, existiert nur im Haupt-Checkout) hat **377 Zeilen: 350 mit
`branch`-Feld — 240 landed · 97 killed-empty · 11 killed-dirty · 2 shelved — plus 27 main-direct
(25 landed · 2 abandoned).** **killed-empty = 97 / 350 = 28 %:** die Lane hat gearbeitet, aber
nichts committet, der Worktree ging leer weg. Das ist der Normalausgang einer MESS-Lane („FILES:
keine"): ihr Ergebnis stand im Pane-Bericht und ist mit dem Slot gestorben. Der Aufwand ist dabei
voll bezahlt — die Replay-Faktoren aus §2 sind für eine killed-empty-Lane dieselben wie für eine
gelandete.

## 5. Methode (reproduzierbar)

```python
import json, glob, os, collections

sessions, tool_bytes, tool_calls = {}, collections.Counter(), collections.Counter()
pat = os.path.expanduser("~/.claude/projects/-Users-*-claude-fleet-worktrees-*/*.jsonl")

for path in glob.glob(pat):
    agg = {"cache_read": 0, "cache_creation": 0, "input": 0, "output": 0, "max_ctx": 0}
    names = {}          # tool_use_id -> Werkzeugname, fuer die Zuordnung der Ergebnis-Bytes
    seen_usage = False
    for line in open(path, encoding="utf-8", errors="replace"):
        try: rec = json.loads(line)
        except ValueError: continue
        msg = rec.get("message") or {}
        content = msg.get("content") if isinstance(msg.get("content"), list) else []
        if rec.get("type") == "assistant":
            u = msg.get("usage") or {}
            if u:
                seen_usage = True
                cr = u.get("cache_read_input_tokens", 0)
                cc = u.get("cache_creation_input_tokens", 0)
                inp = u.get("input_tokens", 0)
                agg["cache_read"] += cr; agg["cache_creation"] += cc
                agg["input"] += inp; agg["output"] += u.get("output_tokens", 0)
                # max_ctx: der groesste EINZEL-Request der Session = ihr residenter Kontext
                agg["max_ctx"] = max(agg["max_ctx"], inp + cr + cc)
            for b in content:
                if isinstance(b, dict) and b.get("type") == "tool_use":
                    names[b.get("id")] = b.get("name", "?")
                    tool_calls[b.get("name", "?")] += 1
        else:
            for b in content:
                if isinstance(b, dict) and b.get("type") == "tool_result":
                    name = names.get(b.get("tool_use_id"), "?")
                    c = b.get("content")
                    txt = c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)
                    tool_bytes[name] += len(txt)
    if seen_usage:
        sessions[path] = agg

tot = lambda k: sum(a[k] for a in sessions.values())
ratios = sorted(a["cache_read"] / a["cache_creation"]
                for a in sessions.values() if a["cache_creation"])
print("sessions", len(sessions))
print("replay je cache-write ", tot("cache_read") / tot("cache_creation"))
print("replay je resid. byte ", tot("cache_read") / tot("max_ctx"))
print("median-lane           ", ratios[len(ratios) // 2])
```

Der Werkzeug-Teil braucht die `tool_use_id`→Name-Zuordnung aus der Assistant-Zeile: die
`tool_result`-Zeile selbst nennt den Werkzeugnamen nicht.

## 6. Drei Hebel

**(a) Residenz schlägt Aufrufzahl.** Ein Byte, das im Lane-Kontext liegen BLEIBT, kostet 40x bis
137x (§2 — Median-Lane bzw. je residentem Byte), nicht 1x. Ein Byte, das einmal gelesen und nie
wieder gebraucht wird, kostet trotzdem den Rest der Session mit, weil der Kontext monoton wächst.
Die Optimierung ist deshalb nicht „weniger Werkzeugaufrufe", sondern „weniger Bytes, die liegen
bleiben": zwei gezielte `sed -n '120,160p'` sind billiger als ein `cat` derselben Datei, obwohl sie
doppelt so viele Aufrufe sind.

**(b) Bash- und Read-Ausgaben sind 95 % des Hebels.** §3: 57,3 % + 38,2 % der Ergebnis-Bytes. Alles
andere zu optimieren bewegt maximal 5 %. Die bestehende Regelbuch-Linie — Suite-Ausgaben in eine
Logdatei, danach den Tail lesen — ist damit erstmals beziffert: ein `./e2e-isolated.sh` direkt in
den Kontext kostet den vollen Lauf-Log mal Replay-Faktor, für eine Zeile, die „ALL PASS" heißt.
Dasselbe gilt für `git log` ohne `-n`, `ls -R` über einen Baum und jedes `grep` ohne `head`.

**(c) Jede permanent geladene Beschreibung zahlt den Replay-Faktor.** Eine model-invoked
Skill-`description` und jedes Regelbuch-Byte sind per Definition resident und damit in der 137x-
Spalte. Matt Pococks Formulierung dafür, wörtlich (`skill-mechanics.md`, github.com/mattpocock/skills,
MIT): *„The description is the skill's top-level context pointer, forced to stay loaded at all
times: permanent context load in exchange for discoverability."* Und: *„Pick model-invocation only
when the agent must reach the skill on its own, or another skill must. If it only ever fires by
hand, make it user-invoked and pay no context load."* Operativ hier: eine getrimmte
`description`-Zeile mit konditionalem Leitwort ist vertretbar, wenn der Skill sonst nie gefunden
wird; ein Absatz an derselben Stelle nicht — er zahlt denselben Faktor für Text, den kein Trigger
braucht.

## 7. Was NICHT gemessen wurde

- Keine Kosten in Währung — nur Tokens. Die Preisstaffel je Modell ist hier nicht abgebildet.
- Warum 502 der 780 Dateien keine usage-Zeile tragen (§1).
- Keine Zuordnung Replay→Ursache je Session (Kompaktierung, Cache-Ablauf, Turn-Grenze); der Korpus
  trägt keine Kompaktierungs-Marker (§1), die restliche Aufteilung ist offen.
- Nur Claude-Code-Transcripts. GPT-/codex-/pi-Lanes schreiben keine solchen Dateien und fehlen
  vollständig — die 258.400-Fenster-Rechnung des Regelbuchs ist von diesen Zahlen unberührt.
- `tool_result`-Bytes sind Zeichen, nicht Tokens; das Verhältnis schwankt mit dem Inhalt.
