---
frage: Welche der fuenf T3-Code-Funktionen (Workspace-Isolation, Checkpoints & Revert, Permission-Modes, Review-Schicht, Orchestrierung) fehlen Fleet wirklich und sollten uebernommen werden?
urteil: Zwei Kandidaten ueber der Linie, beide lesend und ohne Entscheidsaenderung: eine Usage-Anzeige (Tokens je Harness/Modell aus den Transkripten, wie T3s UsageService) und ein Diff pro Turn aus versteckten Snapshot-Refs ohne Revert. Ein Permission-Modus pro Slot liegt unter der Linie, weil er den Full-Access-Entscheid vom 2026-08-12 aendert und T3 selbst mit full-access als Default ausliefert. Isolation, Review und Commit/PR traegt Fleet schon, und mit Land-Gate, Audit und undo-land mehr als T3. Von sechs Grok-Aussagen sind drei in einem Kernpunkt widerlegt (Worktree ist opt-in, Provider-Wechsel ist pro Thread gesperrt, der Desktop-Client spawnt Prozesse).
bereich: [t3code, architektur, uebernahme]
belege: [server.ts#createWorktree, server.ts#pushUndo, server.ts#UNDO_STACK_MAX, server.ts#CODEX_HARNESS, server.ts#contextFill, server.ts#mergeJob, server.ts#runPostLandAudit, docs/attic/harness-zaun-messungen.md, docs/messungen/2026-09-19-t3code-chat-muster.md]
nicht-gemessen: kein Lauf von T3 selbst, keine Laufzeit- oder Kostenmessung der Kandidaten; Cursor/Grok/OpenCode-Adapter nur im Modus-Mapping gelesen; Mobile-App nur bis zum Pairing
stand: 2026-09-22
---

# T3 Code als Control Plane: was davon fehlt Fleet?

2026-09-22, Lane `fleet/260922044427-28fb`. Frage: **Welche der fuenf Funktionen, die Grok T3 Code
zuschreibt, fehlen Fleet und sollten uebernommen werden?**

Die Chat-Seite von T3 ist in `docs/messungen/2026-09-19-t3code-chat-muster.md` vermessen und wird
hier nicht wiederholt.

Quelle: `git clone --depth 1 https://github.com/pingdotgg/t3code` in den Scratchpad der Session,
Commit **`5a61f50cce12685f70d530aa5fdf83d9c9b065d7`** (2026-09-21 20:58 -0700). Der Klon liegt nicht im
Baum, und es wurde kein T3-Code kopiert. T3-Pfade sind relativ zum Klon, Zeilen zeigen auf diesen
Commit. Fleet-Verweise stehen als `datei#symbol`.

**Ob diese Frage die richtige ist:** T3 ist ein Mehrprovider-Produkt fuer viele Nutzer auf dem Agent
SDK bzw. den App-Server-Protokollen der Provider. Fleet ist ein Ein-Owner-System, das die TUIs in tmux
fahrt. Eine Funktion ist deshalb nur dann ein Kandidat, wenn sie ohne diesen Architekturwechsel
traegt. Eine Uebernahme, die das SDK voraussetzt (z. B. Approval-Routing ueber `canUseTool`), zaehlt
als Umbau und nicht als Uebernahme.

## Ergebnis

### (1) Die fuenf Funktionen, jede Grok-Aussage gegen den Code geprueft

Verdikte: **bestaetigt**, **teilweise** (Kern stimmt, eine Einschraenkung ist falsch) und
**widerlegt**. Sie beziehen sich auf Groks Wortlaut aus dem Auftrag.

| # | Grok-Aussage | Verdikt | Wie T3 es baut (Klon, Datei:Zeile) | Was Fleet hat | Luecke |
|---|---|---|---|---|---|
| 1 | Worktree/Branch pro Thread | **teilweise widerlegt**: opt-in, der Default ist `local` | `packages/contracts/src/environment.ts:59` `ThreadEnvMode = ["local","worktree"]`; `packages/contracts/src/t3ProjectFile.ts:120` `builtIn: "local"`; Anlage `apps/server/src/vcs/GitVcsDriverCore.ts:3055-3062` (`git worktree add -b`); Branch zuerst `t3code/<8 hex>`, nach dem ersten Turn von einem Modell umbenannt (`ProviderCommandReactor.ts:189-210, 893-940`); Loeschen des Worktrees nur nach Rueckfrage oder per Setting, Branch bleibt immer (`GitVcsDriverCore.ts:3427-3447`) | Jede Lane ist ein Worktree auf eigenem Branch (`server.ts#createWorktree`), der einzige Abbauweg ist `server.ts#removeWorktreeSafe` | **nein.** Fleet isoliert strenger, nicht optional |
| 2 | Checkpoints: versteckte Git-Refs nach Turns, Rollback von Dateien UND Gespraech, soweit der Provider mitmacht | **bestaetigt, Einschraenkung widerlegt** | Ref `refs/t3/checkpoints/<b64(thread)>/turn/<N>` (`apps/server/src/checkpointing/Utils.ts:4-10`); Capture ueber eine temporaere Index-Datei, dann `add -A`/`write-tree`/`commit-tree`/`update-ref`, ohne Stash; untracked Dateien sind drin, ignorierte nicht (`apps/server/src/vcs/GitVcsDriver.ts:779-1049`); Restore mit `git restore --source … --worktree --staged`, danach `git clean -fd` (`:1052-1113`). **Revert prueft zuerst `assertConversationRollbackSupported`** (`orchestration/Layers/CheckpointReactor.ts:813`, `provider/Layers/ProviderService.ts:2190-2203`): kann der Provider das Gespraech nicht zurueckspulen (Grok, Cursor, Antigravity), wird der GANZE Revert verweigert, auch der Datei-Teil. Dateien werden nur in einem eigenen, ungeteilten Worktree zurueckgesetzt (`CheckpointReactor.ts:723-760`). Claude spult per `forkSession` zurueck (`ClaudeAdapter.ts:5306-5330`), Codex per `thread/rollback` (`CodexSessionRuntime.ts:2608-2616`). Refs werden nur beim Revert geloescht (`CheckpointReactor.ts:890`), sonst nie beschnitten (per grep, nicht jeden Loeschpfad gelesen) | `undo-land`: `server.ts#pushUndo`, `server.ts#UNDO_STACK_MAX` = 3 Lands je Repo, `POST /api/repos/undo-land`, mit Remote-Sperre ueber den ganzen Bereich. Es ist ein Rueckweg PRO LAND auf main, nicht pro Turn. Zusaetzlich (Fleet-fremd, aber im Pane verfuegbar): Claude Code 2.1.278 bringt selbst `/rewind` bzw. Esc-Esc mit, im Binary als "Rewind code (checkpoints)" | **teilweise.** Fleet kennt keinen Snapshot pro Turn und keinen Diff pro Turn. Revert pro Turn hat die claude-Harness nativ, pi und codex nicht |
| 3 | Permission-Modes Supervised / Auto-accept edits / Auto / Full access; Approvals vom Provider, Policy und UI in T3 | **bestaetigt, Nachsatz teilweise** | `packages/contracts/src/orchestration.ts:128-135` `RuntimeMode`, und **`DEFAULT_RUNTIME_MODE = "full-access"`**; Labels `apps/web/src/components/chat/runtimeModeConfig.ts:8-27`; Mapping Claude `ClaudeAdapter.ts:4879-4889` (full-access → `bypassPermissions`), Codex `CodexSessionRuntime.ts:509-541` (full-access → `never`/`danger-full-access`). Bei Claude beantwortet T3 in full-access jede Tool-Anfrage selbst in `canUseTool` mit allow (`ClaudeAdapter.ts:4705-4755`), die Anfrage verlaesst T3 also gar nicht erst. In den anderen Modi werden Anfragen zu `request.opened` und kommen ueber `thread.approval.respond` zurueck (`ProviderCommandReactor.ts:1618-1655`). Der Modus gilt pro Thread, der Default pro Server/Projekt; ein Wechsel startet die Provider-Session neu (`ProviderCommandReactor.ts:763-821`) | Full Access fuer alle Harnesses als Owner-Entscheid (`fc8f4ad`, 2026-08-12, `docs/attic/harness-zaun-messungen.md`): claude per `FLEET_CMD`, codex per `server.ts#CODEX_HARNESS` mit `--dangerously-bypass-approvals-and-sandbox`. Fleets EIGENE Hilfsagenten laufen dagegen eng gescoped: `server.ts#MERGE_TOOLS`, `#REVIEW_TOOLS`, `#TEXT_ONLY_TOOLS` (`--permission-mode dontAsk` plus Allowlist) | **teilweise.** Kein Schalter pro Slot, aber derselbe Default wie T3 |
| 4 | Review-Schicht: Diffs, File-Browser, Commit, PR | **bestaetigt, breiter als gesagt** | Diff-Panel mit den Bereichen Unstaged / Branch / Latest turn / pro Turn (`apps/web/src/components/DiffPanel.tsx:290-320`); File-Browser mit Speichern (`components/files/FileBrowserPanel.tsx`); Aktionen `commit`/`push`/`create_pr`/`commit_push`/`commit_push_pr` (`packages/contracts/src/git.ts:12-18`). Die Commit-Message schreibt ein Modell, wenn der Nutzer keine angibt (`GitManager.ts:1824-1850`), der PR geht per `gh pr create --body-file` (`sourceControl/GitHubCli.ts:624-639`). **Kein eigenes Gate:** geprueft werden nur ein schmutziger Baum und ein detached HEAD (`GitManager.ts:2631-2665`), dazu laufen die Git-Hooks des Repos | Pro Slot `/api/slots/:id/diff`, `…/merge-diff`, `…/review`, `…/commit` (Notweg), `…/commits`; Datei-Explorer `/api/tree`; Commits-Linse `/api/commits` + `/api/commit-diff`. Integration nur ueber `server.ts#mergeJob` (Rebase, Suite-Mutex, Verify, ff) plus Tier-2-Audit `server.ts#runPostLandAudit`. PR/Push gibt es bewusst nicht (von dieser Maschine wird nie gepusht) | **nein** fuer Review und Commit; der Diff pro Turn fehlt (siehe Zeile 2) |
| 5 | Orchestrierung: Threads, Provider-Wechsel, Remote-Steuerung, Usage | **teilweise widerlegt** | Threads sind event-sourced in SQLite (`orchestration/Layers/OrchestrationEngine.ts:245-283`, `persistence/Layers/OrchestrationEventStore.ts:129`). Sechs Treiber (`provider/builtInDrivers.ts:57-64`). **Ein Provider-Wechsel im Thread wird abgelehnt**, "bound to driver X and cannot switch to Y" (`ProviderCommandReactor.ts:686-702`); nur das Modell ist wechselbar. Remote: Pairing-Token, `tailscale serve`, SSH-Tunnel, `cloudflared` sowie ein Relay, das nur Credentials (DPoP) und Push-Meldungen vermittelt (`packages/contracts/src/relay.ts:666-682, 1039-1053`). Usage: Tokens und Kosten aus den Transkripten der CLIs wie bei `ccusage` (`apps/server/src/usage/UsageService.ts:1-13`, Pfade `:279-298`), Plan-Fenster ueber `account/rateLimits/read` (Codex, `CodexProvider.ts:444`) bzw. den experimentellen SDK-Aufruf `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET` (Claude, `ClaudeProvider.ts:366-373`) | 16 Slots mit Harness/Modell/Effort pro Slot (`server.ts#HARNESSES`, `#openSlot`), Queue/Programs/Ledger; Remote per Tailscale + Owner-Token (`server.ts#tokenGate`) + Share-Links (`SHARING.md`) + Phone-Layout. Usage: nur Kontext-Fuellstand pro Session (`server.ts#contextFill`). **Plan-Limits stehen auf keiner Fleet-Flaeche**, das sagt der Code selbst im B3-Kommentar ueber `sendText` ("the Fable limit was readable on /usage and on no surface this fleet owns") | **ja, fuer Usage**; nein fuer Threads, Provider und Remote |
| 6 | Clients machen kein Git, keine Provider-Prozesse, kein Filesystem; T3 ruft kein Modell selbst | **teilweise widerlegt** | Web-Client: keine Treffer fuer `child_process`/`node:fs`. **Desktop spawnt** den Server (`apps/desktop/src/backend/DesktopBackendManager.ts:476`), dazu `wsl.exe`, ssh und tailscale, und nutzt das Dateisystem. Git- und Agent-Prozesse bleiben auf dem Server. "Kein Modell selbst" gilt nur im Sinn von "kein eigener API-Key": Commit-Messages, PR-Texte, Branch-Namen und Titel erzeugt der Server per `claude -p --tools "" --permission-mode dontAsk` bzw. `codex exec` (`textGeneration/ClaudeTextGeneration.ts:199-229`) | Dieselbe Form: der Browser macht nichts ausser HTTP/WS, der Server spawnt. Fleets eigene Textaufrufe laufen ebenfalls ueber die CLI mit `server.ts#TEXT_ONLY_TOOLS` (`compileBriefs`, `card-extract.ts`) | **nein** |

**Zaehlung:** 6 Aussagen. Bestaetigt: 2 (3, 4), beide mit einem ungenauen Nachsatz. In einer
Einschraenkung widerlegt: 1 (2). In einem Kernpunkt widerlegt: 3 (1 Worktree-Default, 5
Provider-Wechsel, 6 Desktop-Prozesse).

### (2) Kandidaten, gerankt nach Nutzen fuer den Owner, mit Schnittlinie nach Platz 2

Massstab fuer "Nutzen fuer den Owner" sind wiederkehrende Entscheidungen, die er heute ohne Zahl
trifft. Am haeufigsten ist die Modell-Routing-Frage nach Limits: Fable-Limit, Lanes auf GLM-Flash,
"das Sub muss aufgebraucht werden", Astra-Reset. Das stuetzt sich auf die Owner-Memories vom
2026-09-02 bis 2026-09-18 und auf den B3-Kommentar in `server.ts`.

**1. Usage-Anzeige: Tokens je Harness und Modell ueber rollierende Fenster**

- *Was:* ein lesender Scan der CLI-Transkripte (`~/.claude/projects`, Codex-`sessions`), T3s Ansatz
  aus `UsageService.ts:1-13`. Summen pro Harness und Modell ueber 5 h und 7 Tage, als eine Route und
  eine Zeile auf dem Board.
- *Kostet:* einen Parser je Harness-Format. Fleet liest pro Slot schon eine Transkript- bzw.
  Usage-Datei (`Harness.context`, `server.ts#contextFill`), aber nur die aktuelle, nicht die
  Historie. T3 misst selbst: kalter 30-Tage-Scan ueber ~1,4 GB in 2-3 s, danach inkrementell nach
  `(size, mtime)`.
- *Bricht:* nichts, der Scan ist rein lesend.
- *Grenze:* das echte Plan-Fenster in Prozent bekommt Fleet so nicht. T3 holt es fuer Claude ueber
  einen SDK-Aufruf, den der eigene Name als instabil markiert, oder ueber den OAuth-Usage-Endpunkt
  mit der Credential der CLI (`usage/cliproxyApi.ts:211`). Fleet hat kein SDK, und die CLI-Credential
  aus dem Keychain zu lesen, waere eine eigene Vertrauensentscheidung.
- *Kleinster erster Schnitt:* nur claude-Transkripte, nur Token-Summen (kein Preis, kein Plan-%),
  `GET /api/usage` plus eine Zahl im Ops-Dialog. Pricing und Codex kommen erst danach.

**2. Diff pro Turn aus versteckten Snapshot-Refs, ohne Revert**

- *Was:* beim Busy→Idle-Uebergang eines Lane-Slots ein Snapshot per temporaerem Index nach
  `refs/fleet/turn/<slot>/<n>`, so wie T3 es in `GitVcsDriver.ts:779-1049` macht. Auf dem Board dann
  "was hat dieser Turn geaendert" als Diff zwischen n und n+1.
- *Kostet:* einen Git-Schreibvorgang pro Idle-Uebergang im Lane-Worktree, ausserdem Ref-Pflege.
  Worktrees teilen die Refs des Haupt-Repos, und T3 beschneidet seine Refs nicht. Fleet muss sie
  deshalb in `server.ts#removeWorktreeSafe` mit abraeumen, sonst waechst `.git` unbegrenzt.
- *Bricht:* nichts, solange der echte Index nicht angefasst wird. Die Refs sind keine Branches, und
  weder Land noch Rebase sieht sie.
- *Warum ohne Revert:* die claude-Harness hat `/rewind` nativ im Pane, und T3s Restore endet in
  `git clean -fd`, einem destruktiven Schritt in einem Baum, in dem eine lebende Session arbeitet.
  Fleet-Lanes committen ausserdem selbst, ihr Rueckweg ist also schon Git.
- *Kleinster erster Schnitt:* nur der Capture plus `GET /api/slots/:id/turn-diff?n=`, keine UI-Aktion.

**— Schnittlinie. Darunter nur als ausdruecklicher Owner-Entscheid. —**

**3. Permission-Modus pro Slot (Aenderung des Full-Access-Entscheids vom 2026-08-12)**

- *Was:* ein Schalter pro Slot zwischen Full Access und z. B. `acceptEdits` (claude) bzw.
  `on-request`/`workspace-write` (codex), gemappt wie in `ClaudeAdapter.ts:4879-4889` und
  `CodexSessionRuntime.ts:509-541`.
- *Kostet:* **das ist eine Aenderung von `fc8f4ad`.** T3 selbst liefert `full-access` als Default
  aus (`orchestration.ts:135`).
- *Bricht:* T3 leitet Approvals ueber `canUseTool` (SDK) und das Codex-App-Server-Protokoll in seine
  UI um. Fleet faehrt die TUI, bei Fleet erscheint eine Freigabe-Frage also als Bildschirm im Pane.
  In einer unbeaufsichtigten Lane haelt sie den Slot an, bis jemand tippt, und der
  Auto-Dispatch-Pfad (`automatable`, Paste-Bildschirme im Harness-Adapter) rechnet damit nicht.
  Routing wie in T3 hiesse Umbau auf SDK/App-Server.
- *Kleinster erster Schnitt, falls der Owner ihn will:* nur fuer vom Owner bediente Nicht-Lane-Slots
  eine Spawn-Wahl ohne Skip-Flag. Lanes bleiben Full Access, und es gibt kein Routing.

### (3) Was Fleet bewusst NICHT uebernehmen sollte

- **Commit / Push / PR mit modellgeschriebener Message** (`GitManager.ts:2609-2760`): T3 hat davor
  kein eigenes Gate, nur zwei Zustandschecks und die Hooks des Repos. Fleets Integration ist
  `server.ts#mergeJob` (Verify unter dem Suite-Mutex) plus Audit (`server.ts#runPostLandAudit`) plus
  Rueckweg (`undo-land`) plus die Regel "nie von dieser Maschine pushen". Ein Commit/PR-Button
  waere ein Pfad am Gate vorbei.
- **Worktree als Option** (`ThreadEnvMode` Default `local`): Fleets "jede Lane ist ein Worktree" ist
  die staerkere Invariante. Sie auf opt-in zu senken, waere ein Rueckschritt.
- **Event-sourced SQLite-Orchestrierung** (`OrchestrationEngine.ts`): Fleet hat Append-Ledger und
  `server.ts#laneDossier` als Join. Ein Umbau auf Events plus Projektionen waere ein Neuschreiben
  ohne benannten Owner-Schmerz.
- **Provider-Wechsel im Thread**: T3 hat ihn selbst nicht (`ProviderCommandReactor.ts:686-702`).
  Fleets Harness pro Slot entspricht T3s "neuer Thread fuer neuen Provider".
- **Relay / Clerk / DPoP / verwaltetes cloudflared** (`relay.ts`, `ManagedEndpointRuntime.ts:276`):
  das ist Infrastruktur fuer viele Nutzer und Geraete. Fleet hat einen Principal hinter Tailscale.
  Push-Meldungen aufs Telefon waeren das einzige Teilstueck mit Owner-Nutzen, gehoeren aber zur
  Benachrichtigungsfrage und nicht zu dieser Messung.
- **Checkpoint-Revert mit `git clean -fd`**: siehe Kandidat 2.

## Methode

```sh
S=<scratchpad>; git clone -q --depth 1 https://github.com/pingdotgg/t3code $S/t3code
git -C $S/t3code log -1 --format='%H %ci'   # 5a61f50c… 2026-09-21 20:58:43 -0700
```

- Drei lesende Explore-Agenten auf dem Klon, je zwei Grok-Aussagen, mit der Vorgabe
  "CONFIRMED/PARTLY/REFUTED mit gelesener Datei:Zeile".
- Die tragenden Zitate habe ich selbst mit `sed -n` nachgelesen: `Utils.ts:4-10`,
  `environment.ts:59`, `t3ProjectFile.ts:120`, `CheckpointReactor.ts:810-816`,
  `ProviderService.ts:2190-2203`, `GitVcsDriver.ts` Restore/Clean, `orchestration.ts:128-135`,
  `ClaudeAdapter.ts:4879-4889`, `git.ts:12-18`, `GitHubCli.ts:624-639`, `UsageService.ts:1-13`,
  `ClaudeProvider.ts:366-373` und `ProviderCommandReactor.ts:686-702`. Alle stimmten.
- Fleet-Seite: `README.md` vollstaendig gelesen, `server.ts` um `UNDO_STACK_MAX`, `/api/commit-diff`,
  `/api/commits`, `/api/tree`, `CODEX_HARNESS`, `MERGE_TOOLS`, `REVIEW_TOOLS`, `TEXT_ONLY_TOOLS` und
  den B3-Kommentar gelesen, die Slot-Routen per
  `rg -o 'api\\/slots\\/\(\\d\+\)\\/[a-z-]+' server.ts` aufgezaehlt.
- `/rewind` in Claude Code: `strings ~/.local/share/claude/versions/2.1.278 | grep -i rewind` liefert
  `"/rewind, Esc-Esc"` und `"Rewind code (checkpoints)"`.

## Was nicht gemessen wurde

- T3 wurde nicht gestartet, gemessen ist nur Quelltext. Die Kandidaten sind weder gebaut noch
  bepreist, ihr Aufwand ist abgeleitet.
- Nur per grep, nicht Pfad fuer Pfad, gepruefte T3-Aussagen:
  - T3s Ref-Beschneidung ("Refs werden nie beschnitten")
  - die Approval-Pfade von Cursor, Grok, OpenCode und Antigravity
  - die Mobile-App jenseits des Pairings
  - ob die Web-UI den Revert-Knopf bei Providern ohne Rollback verbirgt
- Ob Claude Codes `/rewind` in einer Fleet-Pane mit Skip-Permissions sauber arbeitet und was es bei
  von Fleet committeten Aenderungen tut, wurde nicht geprobt.
- Wie haeufig der Owner tatsaechlich nach Limits entscheidet, ist aus den Memories abgeleitet und
  nicht aus einem Ledger gezaehlt.
