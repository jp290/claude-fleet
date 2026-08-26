# HANDOFF — Controller (Slot 9, Fable→Opus), Abendsession 2026-08-26 (vierte) → Übergabe

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Hier steht nur, was daraus
nicht hervorgeht. Vorgänger-Handoff: `c73e24d` (dritte Tagsession).

## Auftrag der NÄCHSTEN Session

**Ernten, was diese Session losgeschickt hat** — drei Rückwege sind verankert, aber Watches sterben
mit diesem Slot. NEU VERANKERN, sonst liegt die Arbeit still (genau das ist heute einmal passiert:
eine fertige Private-repo-j-Lane lag ~20 min unbeachtet, weil der Watch nach dem vorigen Land verbraucht
war und die Folge-Lane ohne frischen Watch spawnte):

1. **Slot 1** — Opus-Tiefenprüfung (Task `919affde`, Branch `fleet/260826174445-b746`,
   `claude-opus-5[1m]` xhigh). Owner-Auftrag wörtlich: „nochmal in einzelnen zufaelligen bereichen
   nochmal richtig gut nachgucken". Sie zieht drei Lose mechanisch (Suite-Modul · Server-Funktionen ·
   Wissens-Doc), prüft je Los Behauptung gegen Code, und legt
   `docs/messungen/stichprobe-tiefenpruefung-2026-08-26.md` ab. Landbar per Design.
2. **Slot 5** — Fix des Proportional-Pfads (Task `4a257283`, Branch `fleet/260826175851-f68e`,
   Opus xhigh). Fasst den Land-Pfad an ⇒ volle Verify-Kette + `./e2e-isolated.sh` sind Pflicht, und
   sie liefert eine Sonde MIT vorgeführtem Breaker. Beim Land: der Post-Land-Audit ist ein
   `e2e-isolated`-Lauf — nichts danebenstellen.
3. **Slot 6** — Private-repo-j-Lane der neuen MAIN (`fleet/260826180624-8796`), liefert das Stück, das S3
   für die Route-(b)-Owner-Frage aus Stufe 2 §3 braucht. Land per Confirm über den Controller.
4. **Slot 14 / private-repo-t** — fährt das Programm herunter (siehe unten). Erwartet: Abschluss-Commit auf
   `gate0`, dann Land per Confirm, dann `POST /api/self/retire`. Kein Lane-Watch möglich (MAIN-Slot,
   409) ⇒ Hintergrund-Watcher auf `git -C ~/private-repo-t rev-parse gate0`.
5. **Slot 11 / private-repo-q** — drei Owner-Türen als Entscheidungsfragen angefordert, noch nicht
   eingetroffen (sie arbeitet mit zwei Sub-Agenten an Xcode/Package.swift-Grundlage).

## Zwei Befunde, die den Betrieb betreffen

- **Fable-5-Credits sind erschöpft** („out of usage credits"; eine private-repo-r-Lane wurde MITTEN im Lauf
  abgeräumt, ihr Deliverable war glücklicherweise schon geschrieben). Geprüft und ENTWARNT für neue
  Arbeit: `FLEET_DEFAULT_MODEL` ist `claude-opus-5[1m]` (`src/protocol.ts#FLEET_DEFAULT_MODEL`),
  `SUMMARY_MODEL` ist `claude-sonnet-5[1m]` — neue Lanes und Wegwerf-Worker sind NICHT betroffen.
  Betroffen sind nur explizit auf Fable gepinnte Slots. **Die vier Programm-MAINs haben in ihrer Pane
  selbst auf Opus 5 gewechselt, ihr Slot-Datensatz sagt aber weiterhin `fable`** — bei einer
  Nachfolge oder einem Pane-Heal fällt das still auf Fable zurück (es gibt keine Route, die Modell
  oder Effort eines LEBENDEN Slots ändert). Nach jeder Succession: in der Pane `/model` prüfen.
- **Der proportionale Docs-Kurzpfad frisst das Repo-Verify in FREMD-Repos.** `verifyPlanFor`
  (`server.ts#verifyPlanFor`) ersetzt bei `proportional:true` das konfigurierte Kommando durch
  `VERIFY_PROPORTIONAL_CMD` — und dessen einkompilierter Guard `[ -f fleet-e2e.ts ]` exitet in jedem
  Produkt-Repo 42. Zweimal live belegt (Lands `5ddfcea`, `6d9a1cd`: `proportional:true`,
  `steps:["install","pins"]`, `exitCode:42`). Folge: docs-only-Lands in Produkt-Repos messen NICHTS
  und stoppen für Confirm, obwohl seit heute echte Verify-Kommandos konfiguriert sind. Queue-Notiz
  `7f3d2fdb`, Fix beauftragt (Slot 5, oben).

## Was diese Session geschlossen hat (Bodies: `git log c73e24d..HEAD`)

1. **Gate-Naht geschlossen** (Owner-Confirm der Eintragsform): `FLEET_VERIFY_CMD_REPOS` trägt jetzt
   private-repo-r `./verify` · private-repo-t `bun verify.js` · private-repo-j `bun run verify` · private-repo-q `./verify.sh`
   (letzterer nach S11s erstem Code-Land, per deren eigener Norm). Zwei Deploys (`fa61d842`,
   `97cd40dc`), beide grün, Keys in der Server-Env nachgemessen. `.env`-Backup:
   `~/.env.fleet.bak-2026-08-26`. private-repo-s fehlt bewusst — dort existiert noch kein Code.
2. **Norm-Sätze als PROPOSAL gelandet** (`037d246`, Direkt-Commit docs-only, pins grün, KEIN
   Land-Ledger-Eintrag): `docs/product-studio-working-circle.md` hinter „Honest labels" — (a) ein
   Verifier ist Prädikat-Beweis erst nach vorgeführtem Breaker, sonst Etikett „Struktur-Test";
   (b) ein Owner-Waiver ändert das Proof-Artefakt selbst, Prosa ist kein Waiver. **Promotion steht
   aus (Owner-Akt).** Private-repo-r hat die Norm noch am selben Abend erfüllt (V8-Stale-Detektor mit
   vorgeführter Mutation).
3. **Private-repo-j: zwei Lands** — Baumechanik Stufe 1 (`5ddfcea`) und Stufe 2 (`6d9a1cd`), beide über
   Hand-Verify (`bun run verify` ALL PASS auf exakt dem rebasten Kandidaten) + Confirm, weil das
   Gate proportional skippte. **S1→S3-Succession gelaufen**, neue MAIN läuft Opus 5 und arbeitet an
   PH0 (Hypsometrie-Geometrie-Gate).
4. **Private-repo-r: Tür 1 = „Ja, mit Ort-Auflage"** (Owner). Land gefahren: `private-repo-r/main` = `7f21ac8`
   (ff über vier Commits), `./verify` ALL PASS V0–V8 vorher selbst gefahren. Die Auflage steht als
   bindendes Abnahme-Kriterium in private-repo-rs `AGENTS.md`: bester ORT-Zug muss über bestem TERMIN-Zug
   liegen, sonst ist Slice 1 nicht done. Lane-C-Zahl als Latte: reiner Orts-Zug erreicht heute 31 %
   des besten Termin-Zugs.
5. **Private-repo-s: Gate 1 = Option A** (Start-Ziel-Taste) + Dichte-Latte „Fehlgriffquote nach 1 min
   unter ~5 %". Bau-Lanes sind offen.
6. **Private-repo-t wird EINGESTELLT** (Owner: „Ich mag das Spiel nicht"). Auf Rückfrage präzisiert: ein
   KONZEPT-Urteil, ausdrücklich nicht die Geste und nicht das fehlende Duell. S14 fährt herunter:
   Stand dokumentieren, Demo-Server abschalten, Repo als Archiv, zwei Lanes abräumen. Der
   deterministische Festkomma-Kern (95 verify-Checks) bleibt als Baustein. **Die Ausführung war
   sauber — das Nein traf das Produkt.**

## Bedienungs-Falle, heute zweimal bezahlt

Eine Pane in einem AskUserQuestion-Menü ist für `POST /send` „composer occupied" — **die Frage
erreicht das Board nie, und der Owner sieht sie nicht.** So standen Private-repo-rs Tür 1 und Private-repo-ts Gate 0
unbemerkt. Notweg (funktioniert, heute verifiziert): Menü per `capture-pane` lesen, mit
`tmux send-keys` navigieren. **Achtung: ist Option „Type something" bereits markiert, tippt eine
Ziffer TEXT ins Freitextfeld statt zu navigieren** (`❯ 5. 3`) — dann `BSpace`, und entweder mit
Pfeiltasten navigieren oder das Freitextfeld bewusst nutzen (`send-keys -l "<text>"` + `Enter`), was
für ein Urteil mit Begründung ohnehin die bessere Form ist.

## Offene OWNER-Entscheide (neueste zuerst)

- **Norm-Sätze-Promotion** (Proposal steht in `docs/product-studio-working-circle.md`).
- **Private-repo-qs drei Türen** (Modalität · Kartenbasis inkl. Extrakt-Freigabe + Owner-Stadt ·
  On-Device-Auslegung) — angefordert, kommen als Entscheidungsfragen.
- **Private-repo-j Route-(b)-Frage** aus Stufe 2 §3 — S3 hält sie bewusst zurück, bis ihre Lane das
  fehlende Stück geliefert hat. Gutes Urteil, nicht drängen.
- **Stufe-1½-Fable-Session** (Audit §236) — Startbedingung erfüllt, aber Fable ist credit-los:
  als Opus-Lane fahren, und weiter als FRISCHE Lane, nicht S3 (der Audit verlangt frischen Critic).
- Bestand: d70d-Promotion (AGENTS.md event-driven-Warten) · Rail-Commit `3600618` · 13
  Worktree-remove-Zeilen (nur auf Go) · Lizenz-Trio · Publish-Rückstand (~1020 Commits) ·
  Fragment-Promotion geschmack/owner · Programm-Triage.

## Arbeitsmodus (Owner-gesetzt, gilt fort)

Controller erörtert, AGENTEN fixen — selbst nur briefen, landen, deployen, ernten. Programm-Lands
per Confirm über den Controller. Supervisor-Rolle vakant. **Slot 2 gehört dem OWNER selbst** (er
arbeitet dort an einer Auftragsmarkt-/App-Idee) — nicht anfassen, nicht beobachten.
