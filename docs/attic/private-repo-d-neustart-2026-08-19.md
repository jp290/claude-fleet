# Agenten-Session, Private-repo-d-Neustart, Arbeitskreis — 2026-08-19, Supervisor

> **Redigiert 2026-08-31 beim Tracken in das public Repo:** Tailscale-IP → `100.64.0.1`
> (der Platzhalter, den `watchdog.sh` und `SHARING.md` führen), `/Users/<account>/` → `~/`,
> die Leck-Guard-Muster durch ihre Beschreibung ersetzt. Der Inhalt ist sonst unverändert.

## 1. Dein Vorschlag: klug, aber er ist schon gebaut — und anders, als er klingt

Zwei Messungen gegen `server.ts` (Zeilenbelege, nicht geraten):

**Die "Session zwischen MAIN und Lane" EXISTIERT.** Sie heisst Wegwerf-Worker.
`summaryViaSession` (`server.ts:7734`) spawnt eine eigene tmux-Session `sum-<hex>` —
**belegt KEINEN der 16 Slots** (`server.ts:7551` woertlich: *"Never one of the 16 slots"*;
der Boot-Reaper trennt beide Namensraeume, `server.ts:14131`). Prompt rein per paste-buffer,
Text raus, Transkript wird im `finally` geloescht.

**Und sie faehrt bereits fremde Modelle — heute, per Default.** `WORKER_ROUTES`
(`server.ts:7845-7856`): **summary, commitMsg, enhance und digest laufen auf
`gpt-5.3-codex-spark`** ueber das codex-Binary, headless, `--ephemeral -s read-only`.
Nur das Literal `"claude"` schaltet zurueck; keines der vier `FLEET_WORKER_ROUTE_*`
steht in `.env` oder `watchdog.sh`. Das ist genau dein "GPT fuer alles" — es ist an,
und niemand hat es dir gesagt.

**Was ein interner Agent dagegen NICHT kann:** ein fremdes Modell fahren (er ist immer das
Modell seiner MAIN), und einen Faehigkeits-Schnitt tragen. Die Worker haben drei geschlossene
Werkzeug-Profile (`server.ts:7720`, `9463`, `9474`); `--tools ""` ist ein Schnitt, den
`~/.claude/settings.json` **nicht aufweiten kann** — bei `--allowedTools` wuerde es sich mit der
Owner-Liste vereinigen. Das ist der harte Unterschied, nicht der Kontext: interne Agenten
isolieren Kontext genauso gut.

**Der Preis deines Vorschlags, ehrlich:** die Worker-Liste ist GESCHLOSSEN. Zehn Contracts in
`src/protocol.ts:194-211`, `satisfies Record<WorkerName, …>` — ein elfter Call-Site ohne
Contract kompiliert nicht. Das ist Absicht. **Und eine Session kann keinen Slot oeffnen:**
`openSlot` hat neun Aufrufstellen, die einzigen self-erreichbaren sind der Nachfolge-Pfad — und
der ist ein ERSATZ, kein Helfer (der Nachfolger erbt zwingend cwd/Modell/Harness, die
Aufruferin wird nach 120 s geraeumt).

**Urteil: nicht bloed, aber nicht dein Engpass — und der Bau ist groesser als der Nutzen.**
Deine Idee waere ein elfter Worker-Contract plus eine Self-Route, die ihn briefen darf. Fuer
Private-repo-d loest das nichts: seine drei fehlenden Zeilen sind VISUELL, und ein Worker mit
`--tools ""` kann kein Kart zeichnen. **Zurueckstellen, nicht verwerfen** — und die vier
codex-spark-Routen erst einmal BENUTZEN, statt daneben etwas Neues zu bauen.

## 2. Was Private-repo-d wirklich blockiert — und es ist nicht die Session

Ich habe die Decision-Records gelesen, bevor ich geurteilt habe. **Private-repo-d ist die
diszipliniertesteder drei Studios**, nicht die schlechteste:

- **D13** hat meinen eigenen Supervisor-Befund geprueft und **zu seinen Ungunsten korrigiert**
  ("es gab nicht einen handbenannten Worktree, es gab gar keinen") und den Preis GEMESSEN
  statt geschaetzt (`grep -c private-repo-d lane-outcomes.jsonl` = 0).
- **D9** dokumentiert die ungebundene MAIN mit Grund, vollstaendigem Preis und **Ablaufdatum**.
- **D17** hat meinen localhost-Befund von vor einer Stunde bereits umgesetzt.

Drei echte Ursachen, keine davon in der Session:

**(a) `~/private-repo-d` fehlt in `FLEET_VERIFY_CMD_REPOS`.** Eine Fleet-Lane liefe dort in `exit 42`
— verify SKIPPED. D13 hat den Wechsel darum ABGELEHNT, und das war richtig: eine Zeile mit
`verify: SKIPPED` liest sich fuer jeden Spaeteren wie ein bestandenes Gate. **Das Gate-Kommando
liegt fertig und trocken getestet im Repo** (`docs/decision-record.md`, D13). Der Owner-Akt ist
ein Einfueger.

**(b) Neun von zwoelf Kernzeilen sind geliefert, mit Beweisen. Die drei fehlenden sind ALLE
DREI visuell:** >=2 unterscheidbare Charaktere · Karts, die als GEBAUTE Objekte lesen · eine
Welt mit lesbarer Materialsprache. Vertragsklauseln: *"Charakter-Praesenz gegen Crash"*,
*"Bauaesthetik gegen Lego Private-repo-cs"*. **Das ist, was du siehst, wenn du faehrst** — ein
exzellenter Simulationskern, der aussieht wie Primitive auf einer Flaeche. Und es ist genau
die Todesart des ersten Anlaufs.

**(c) Kein Gate kann diese drei Zeilen beweisen.** `bun test` sagt nichts darueber, ob ein Kart
wie ein gebautes Objekt aussieht. **Hier hast du recht, dass Workflow ab jetzt zentral wird** —
die restliche Arbeit ist von anderer Art als die neun gelieferten Zeilen.

## 3. Empfehlung: Session tauschen, Repo behalten

**Nicht neu anfangen.** Wegzuwerfen waeren: ein uebernommener, deterministisch getesteter
Sim-Kern · Gegner durch dieselbe `step()` · Drift mit gemessener Skill-Spreizung · Kontakt mit
Zwei-Kart-Kontrafaktual · Restart-Schleife · Touch-Steuerung · 155 gruene Tests · ein
Inhalts-Register mit Beweis je Zeile · ein zweiphasiger Kritiker. Die drei fehlenden Zeilen
sind reine Renderer-Arbeit, und D12 sagt ohnehin, dass sie `canvas.ts` neu schreiben werden.

**Der bestehende MAIN hat die Uebergabe selbst vorgeschrieben** — D9, woertlich:
> *ABLAUFDATUM: sobald eine Route eine bestehende Sitzung binden kann — oder sobald der Owner
> eine frische MAIN will. Dann ist der richtige Zug eine UEBERGABE an sauberer Naht (gemergte
> Lane, nichts in Flug), kein Bootstrap neben einer laufenden MAIN.*

Du willst eine frische MAIN. **Das Ablaufdatum ist eingetreten.**

**Mechanische Klemme, die du kennen musst:** `POST /api/self/succeed` reicht Modell und Harness
der Vorgaengerin WOERTLICH durch (`server.ts:5120`) und nimmt keinen Override — eine Nachfolge
waere wieder Opus. `bootstrapProgramMain` dagegen nimmt `model`, `harness`, `effort` aus dem Body
(`server.ts:13427`). **Also: alte MAIN sauber stilllegen, dann frisch bootstrappen mit Fable.**
Bei lebender Bindung antwortet die Route `{ok:true, existing:true}` und tut nichts — die alte
muss zuerst weg.

## 4. Der Arbeitskreis — was neu ist, ist EINE Regel

Fast alles existiert schon. Der Kreis:

| Rolle | Wer | Regel |
|---|---|---|
| **MAIN** | Fable, Slot im `~/private-repo-d` | **baut NIE selbst.** Briefed, urteilt, haelt das Inhalts-Register, entscheidet die Reihenfolge |
| **Bau-Lane** | Fleet-Lane, echtes Gate | eine Zeile des Registers je Lane, Done-Kriterium vor dem Start |
| **Kritiker** | `tools/critic-check.sh`, zweiphasig | Phase 1 schreibt den Massstab BLIND und committet; Phase 2 sieht erst dann die Bilder. Prozedur mechanisch bewacht, Urteil nie |
| **Owner** | du | Geschmack. Producers propose, the OWNER promotes |

**Das einzig Neue: die MAIN baut nie selbst.** Das ist die teuerste Lehre des letzten Handoffs,
woertlich: *"Zu viel selbst gemessen. Das gehoert in Wegwerf-Worker mit engem Brief; die Rolle
einer MAIN ist Urteil und Reihenfolge."* Fable ist dafuer die richtige Wahl — sie hat kein
1M-Fenster zu verheizen und wird nicht in Grabungen abrutschen.

## 5. Deine Befehle

**Schritt 1 — die `.env`-Zeile.** Ohne sie ist der ganze Rest Attrappe. In `.env`, in das
JSON von `FLEET_VERIFY_CMD_REPOS`, als dritten Eintrag (Wert aus D13, dort trocken PASS):

    "~/private-repo-d": "set -eu; bunx tsc --noEmit; bun test; ./tools/pointer-check.sh; test -z \"$(git status --porcelain)\""

Danach zwingend in dieser Reihenfolge, sonst backt der alte Watchdog den alten Wert wieder ein:

    launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog
    tmux -L claudefleet kill-session -t srv

**Schritt 2 — sag mir Bescheid.** Den Rest (alte MAIN sauber stilllegen lassen, Fable-MAIN
bootstrappen, Gruendungsbrief) fahre ich, sobald Schritt 1 steht. Ich stelle keine laufende
MAIN ab, ohne dass sie ihren Handoff geschrieben hat.
