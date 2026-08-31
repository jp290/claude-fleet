# Prompt: Kontextschicht in der Tiefe analysieren (sol-Session)

---

Du analysierst die **Kontextschicht** von claude-fleet in der Tiefe und legst dem Owner einen
Befund plus Vorschlag vor. Sein Satz dazu, wörtlich: *"Der Kontext den wir den Agenten mitgeben
ist das A&O in unserem ganzen System."* Zweitziel desselben Tages: ein robuster
gameStudio-Workflow mit der Option, verschiedene Schritte auf verschiedene Agents zu legen.
Beides hängt zusammen — siehe §3.

**Analysieren und vorschlagen, nicht umbauen.** Kein Umbau der Ladeschicht ohne seine Freigabe.
Messsonden und Wegwerf-Skripte sind erlaubt, wenn sie den Baum sauber hinterlassen.

## 1. Was heute geladen wird — gemessen, damit du es nicht erheben musst

Eine claude-Session im Fleet-Repo bekommt **vor ihrem ersten Handgriff**:

| Schicht | Bytes | Herkunft |
|---|---|---|
| `~/.claude/CLAUDE.md` | 8.090 | global, alle Projekte, nicht im Repo |
| `./CLAUDE.md` | 62.678 | **Generat** aus `rulebook/*.md` (7 Fragmente, 62.656 B), gitignored |
| `./.claude/CLAUDE.md` | 226 | Projekt, getrackt |
| `./AGENTS.md` | 9.572 | getrackt, der portable Vertrag |
| **Summe** | **≈80.566 B** | grob 20k Token, bevor irgendetwas passiert |

`AGENTS.md` je Repo, alle verschieden, keine zwei mit gemeinsamem Kern:
claude-fleet 9.572 · private-repo-i 2.835 · private-repo-g 10.115 · private-repo-d 7.491 ·
auftragsmarkt 15.744 · private-repo-e 2.075 · private-repo-h 1.862.

Zwei Ladewege, die nicht dasselbe tun: **claude** lädt `CLAUDE.md` automatisch; **codex und pi**
laden `AGENTS.md`. Seit `fbf44b1` gibt es außerdem **zwei gerenderte Fassungen** des Regelbuchs —
`renderRulebook("main")` und `renderRulebook("lane")` (`rulebook.ts:66`), eine Lane bekommt die
kürzere geschrieben statt kopiert.

## 2. Die zwei Owner-Befunde, die diese Analyse ausgelöst haben

**(a) "Irgendeine Aktion/Commit hat die AGENTS.md-Files zerschossen."** Meine Vorprüfung
widerlegt die naheliegende Ursache: `~/claude-fleet/AGENTS.md` wurde seit dem 15.08. (`446d74b`)
nicht angefasst. Der Befund ist damit NICHT erledigt, sondern unerklärt — such die wahre Ursache,
und wenn es keine gibt, sag das mit Beleg. Verdächtige, die ich nicht ausgeschlossen habe: die
Fragmentierung nach `fbf44b1`; das Auseinanderdriften der sieben Repo-Fassungen; eine
Ladereihenfolge, die sich geändert hat, ohne dass eine Datei sich änderte.

**(b) Terminal-Formatierung/-Verhalten hat sich durch einen Commit geändert**, konkret: der Owner
kann Text nicht mehr kopieren. Das ist ein Client-Bug und läuft als eigene Lane — **nicht deine
Aufgabe**, nicht mituntersuchen.

## 3. Die Brücke zum zweiten Tagesziel — dein wichtigster Hebel

Ein gestern gelandetes Audit (`6277e57`, `docs/worktrail-audit-III/private-repo-d.md`) hat gemessen:
die diszipliniertste Studio-Session **stand 69 % ihrer Wanduhr still**, und die drei unerfüllten
Kernzeilen hingen alle an *einer Owner-Frage ohne Objekt und ohne Zustellweg*. Der Gegenbeweis
steht im selben Transcript: als der Owner tatsächlich mitspielte, lief „fühlt sich falsch an" →
gemessen → gebaut → abgenommen **in 11 Minuten**.

**Das ist kein Bau-Versagen, das ist ein Kontext-Versagen.** Kontext ist in diesem System nicht
nur, was beim Start geladen wird, sondern auch, was während der Arbeit ankommt und was nicht:
der servergebaute Gründungsbrief, der Task-Brief, `POST /send`, die Clarification-Kette, der
Supervisor-Nudge. Eine Analyse, die nur Dateien wiegt, verfehlt genau die Stelle, an der das
System gestern Stunden verloren hat.

## 4. Was du liefern sollst

**Eine Matrix: Rolle × Harness → was kommt wirklich an.** Rollen: MAIN, Programm-MAIN, Bau-Lane,
Clarify-Lane, Wegwerf-Worker, Supervisor, Steward. Harnesses: claude, codex, pi. Je Zelle: welche
Dateien, wie viele Bytes, welche Laufzeit-Zustellungen — und **gemessen an einer echten Pane, wo
möglich, nicht aus dem Code geschlossen.** Wo du nur schließen kannst, schreib GESCHLOSSEN.

Dann vier Fragen, jede mit Belegen:
1. **Was ist redundant?** Welche Aussage steht in mehr als einer Schicht, und welche gewinnt?
2. **Was widerspricht sich?** Der Loader-Vertrag in `CLAUDE.md` regelt Vorrang — hält er?
3. **Was ist tot?** Regeln, die auf Flächen zeigen, die es nicht mehr gibt.
4. **Was fehlt?** Die wichtigste. Welche Rolle braucht etwas, das sie strukturell nie bekommt —
   gemessen an dem, was Sessions gestern falsch gemacht oder mehrfach neu hergeleitet haben.

Zum Schluss ein **Vorschlag**, der die Option „verschiedene Schritte auf verschiedene Agents"
trägt: was ein fremdes Modell mit kleinerem Fenster braucht, was es NICHT braucht, und woran man
das je Rolle entscheidet statt es zu raten.

## 5. Werkzeuge, Fallen, Grenzen

- **`rg` respektiert `.gitignore`** — und gitignored sind ausgerechnet `CLAUDE.md`, `fleet.json`,
  die `.jsonl`-Ledger und `.env`. Ein `rg` darüber liefert LEER, was sich wie „gibt es nicht"
  liest. Für alles Operative: **`rg -uu`** oder `grep`.
- Strukturfragen: `ast-grep --pattern '<muster>' --lang ts <datei>` (auch als `sg`).
- Was eine Pane wirklich trägt: `ps eww -p <pid>` bzw. `tmux -L claudefleet capture-pane`.
  Eine Behauptung über eine laufende Session, die nicht an ihr gemessen wurde, ist eine Vermutung.
- **Nichts starten, was Zustand ändert.** Niemals `bun server.ts` (adoptiert den Live-Socket).
  Nie mit einem Namensmuster killen — `pkill -f "bun server.ts"` trifft den Live-Server.
- Das Repo ist **public**: keine echten Hostnamen, IPs, Klarnamen, Token in getrackte Dateien.
- Lies `CLAUDE.md` NICHT am Stück (62 KB). Nenne Abschnitte, lies gezielt. Dein Fenster ist
  258.400 Token, nicht 1M — und **dein Wochenkontingent stand gestern Abend unter 5 %.** Halte
  Tool-Ausgaben klein: gezielte greps, Suite-Ausgaben in eine Datei und nur den Tail lesen.
  **Melde dich, wenn du bei halbvoll bist**, statt mitten im Befund zu sterben.

**Deliverable:** `docs/kontextschicht-analyse-2026-08-20.md`, committet auf einem Branch als
Vorschlag — nie direkt auf main. Leg dem Owner zuerst die Gliederung plus deine drei schärfsten
Vorbefunde vor, bevor du ausschreibst; er will mitarbeiten, nicht abnicken.
