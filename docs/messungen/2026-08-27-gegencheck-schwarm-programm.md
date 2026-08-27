---
frage: Sind die zwölf Lastannahmen aus docs/schwarm-programm-2026-08-27.md am Baum belegt? (Gegenprobe, kein Bau)
urteil: Keine der zwölf Lastannahmen ist im Kern widerlegt (zwei korrigierbare Detailfehler); Paket B ist verfrüht, und P0s Sync-Pin-Prämisse ist falsch, weil .agents/ gitignored und in keinem Worktree existiert
bereich: [verify, regelwerk]
belege: [server.ts#briefAndSend, context-pack-validator.ts, verify-proportion.ts, e2e/pins.ts, .gitignore]
nicht-gemessen: Ob der LIVE-Prozess wirklich mit dem Env der watchdog-Zeile läuft; sendText-Transportdetails nicht end-to-end beobachtet; die §1-Ledgerzahlen nicht nachgezählt; slotDeliveryBudget-Dynamik nur gelesen
stand: 2026-08-27
---

# Frage

Sind die zwölf Lastannahmen aus `docs/schwarm-programm-2026-08-27.md` (Committ bdcc6d3) am Baum
belegt? Jede Behauptung mit Urteil und Beleg; dazu zwei Urteile (U1 Paket-Bloat, U2 fehlendes
Risiko). Gegenprobe, kein Bau.

## Ergebnis

| Nr | Urteil | Beleg |
|---|---|---|
| 1 | VERIFIZIERT | `server.ts:7776` — `const deliveredBrief = \`${brief}${anchorBlock}${clarify ? "" : LANE_EXIT_FOOTER}\`;` ist die EINZIGE Zustellung der Funktion (einziges `sendText` bei :7783; `logPrompt`/Receipt sind Logging, kein Pane-Content). Präzisierung: im Clarify-Modus fehlt der Footer (`clarify ? ""`), und bei leerer Plan-Auswahl ist `anchorBlock === ""` (`renderContextAnchorBlock`, :7805) — die Zusammensetzung bleibt genau diese drei Teile. |
| 2 | VERIFIZIERT | `context-pack-validator.ts:163` — `emit("PACK_CONTENT_FORBIDDEN", "error", packId, …)` und :260 — `emit("SOURCE_CONTENT_FORBIDDEN", "error", …)`; Severity error ⇒ Verdict `fail` (:355). Quelle darf nur Zeiger tragen: :98 — `const SOURCE_KEYS = new Set(["path", "anchor"]);`, jeder andere Key ⇒ `SOURCE_UNKNOWN_KEY`/`SOURCE_CONTENT_FORBIDDEN` error. Hart heißt hier auch: `context-manifest.ts:87-90` markiert jedes defekte Pack `defective` ⇒ Auslieferung verweigert als `omitted: "manifest-invalid"`. (Private Packs sind strenger: gar keine Quellen, nur `privateSourceId`.) |
| 3 | VERIFIZIERT | `server.ts:7900` — `const BRIEF_TICK_MS = Math.max(0, Number(process.env.FLEET_BRIEF_MS ?? 0) | 0); // 0 = off, the default`; `watchdog.sh:148` setzt im srv-Spawn `FLEET_ANALYSIS_MS=0` und enthält kein `FLEET_BRIEF_MS`-Token. Beide Compiler-Sweeps hängen an Gates (:17747 `ANALYSIS_ON`, :17751 `BRIEF_ON`); einziger maschineller Schreiber von `Task.brief` ist `compileBriefs` (:8005 ff., „THE ONE PLACE THE MACHINE WRITES A Task.brief"), nur von den beiden Sweeps gerufen; :22142 schreibt `model: "owner", edited: true` (manuell). Dispatch: :7675 f. — `: next.brief?.text ?? next.text` — ohne kompilierten Brief roh. In-tree bestätigt sogar der Kommentar :7899 („both off (the default, and today's live behaviour byte for byte)"). Eine Annahme bleibt unbeweisbar, s. „Was nicht gemessen wurde". |
| 4 | VERIFIZIERT im Kern, EIN DETAIL WIDERLEGT | Kein Switch auf Task.status: einziger `switch (` im ganzen TS-Bestand (server/src/e2e/Root-Module) ist `src/client.ts:7612` — `switch (event)`. Konsumenten sind Membership-Tests (91 × `status ===` in server.ts plus die Allowlist). Allowlist verwirft still: `server.ts:17137-17141` — `tasks = (…).filter((x): x is Task => … && ["pending", "queued", "sent", "done", "archived"].includes((x as Task).status))` — unbekannter Status fällt durch den Filter, ohne Meldung, und ist beim nächsten `saveState` weg. DETAIL WIDERLEGT: Es gibt nur EINE solche Allowlist. `server.ts:17151` ist eine Kommentarzeile (`// malformed degrades field-wise to null…` über `loadTaskSpawn`), keine zweite Status-Allowlist; ein zweiter `x is Task`-Filter existiert nirgends (grep über alle .ts). Die Konsequenz (stiller Datenverlust beim Boot) bleibt über :17141 wahr. |
| 5 | VERIFIZIERT | `server.ts:2636` — `const taskTerminal = (t: Task): boolean => t.status === "done" \|\| t.status === "archived";`; `src/client.ts:6165` — `if (t.status === "done" \|\| t.status === "archived") return "closed";`; `server.ts:22262` — `else if (taskAct[2] === "unarchive") t.status = "pending"; // back to owner review, never straight to queued`. |
| 6 | VERIFIZIERT (eine Präzisierung) | Lane-only: `server.ts:19972 f.` — `if (!s.worktree \|\| s.label === STEWARD_LABEL) return json({ error: "not a worker lane — …" }, 409);`. Status: `src/protocol.ts:33` — `export const FLEET_REPORT_STATUSES = ["complete", "needs-main", "failed"] as const;`. Text: `server.ts:2998` — `const MAX_FLEET_REPORT_TEXT = 4000;`. Persistiert + Quittung: `openFleetReport` (:6192) hängt `fleetReports` + FleetEvent an und `await saveStateNow()` (:6230 f.), Antwort `{ ok: true, report }`. Empfänger: :6203 f. — `const resolved = clarificationReceiverFor(s); if ("error" in resolved) return json({ error: resolved.error }, 409);` — Basis `program-main` (gewinnt vor Watch-Evidenz) oder exakter `lane-watch` (:5998-6044). Präzisierung: „EINZIGE harte Vorbedingung" stimmt nicht exakt — es gibt eine zweite 409: :6205 f. — `if (slotDeliveryBudget(resolved.receiver.slot).free === 0) return … 409` (Empfänger hat kein FleetEvent-Budget mehr, `FLEET_EVENT_MAX_OPEN_PER_SLOT`, :2993/5516). |
| 7 | VERIFIZIERT | `verify-proportion.ts:45` — `if (path.startsWith("docs/") \|\| path.startsWith("briefs/") \|\| path.startsWith("drops/") \|\| (!path.includes("/") && path.endsWith(".md")) \|\| path === ".gitignore") return DOC_RULE;` mit :28 — `const DOC_STEPS: readonly LocalProofStep[] = ["install", "pins"];`. Der serverseitige Kurz-Befehl ist `server.ts:10774` — `VERIFY_PROPORTIONAL_CMD = '… bun install --frozen-lockfile && bun e2e/pins.ts'` — kein e2e-stage.sh. Der Suite-Mutex stammt ausschließlich aus `e2e-stage.sh:73` — `FLEET_SUITE_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"`; `e2e/pins.ts` deklariert selbst „No server, no tmux, no network" und spawnt nur `git`-Probes (`spawnSync("git", …)`, :148/928/1296). |
| 8 | VERIFIZIERT | `POST /api/lanes` (Handler :21061-21106) enthält keinen DISPATCH_MAX_LANES-Check; einzige Decke dort: :21073 f. — `const free = slots.find((x) => !x.cwd && !laneSpawn.has(x.id)); if (!free) return json({ error: "no free slot" }, 409);`. Der Deckel bindet den Tick: :8383 — `if (lanes >= DISPATCH_MAX_LANES) { waiting(…); continue; }` (in `tickDispatch`). Reale Decke: :66 — `const MAX_SLOTS = 16;`. Der Design-Kommentar :21944 („NOT bound by DISPATCH_MAX_LANES — the cap bounds UNATTENDED fan-out") bestätigt die Lesart. |
| 9 | VERIFIZIERT | `lane-signals.ts:347` — `{ prose: "idle", holds: (v, t) => v.idleMs !== null && v.idleMs >= t, clock: true }` ist Klausel von `STALLED_RULES`; :360 f. — `laneStalled = STALLED_RULES.every((r) => r.holds(v, idleThresholdMs))`. `idleMs` wird aus `lastOutput` abgeleitet: `server.ts:18117` — `idleMs: s.cwd ? Math.max(0, now - s.lastOutput) : null` — eine dauernd druckende Lane (fix-run-fail) hält `lastOutput` jung, `idle >= t` wird nie wahr, `stalled` bleibt per Konstruktion falsch. |
| 10 | VERIFIZIERT (Kadenz ungenau benannt) | `contextFill(s)` wird im 2-s-Owner-Poll für JEden Slot gerechnet und nur in die Antwort gestellt, nicht behalten: `server.ts:20643` — `ctx: contextFill(s),` (Kommentar: „the 2 s poll, already the app's most expensive path"); zusätzlich `tickMigrate` :10297 (nur Main-Slots, Lanes übersprungen). `tickGit`: :17742 — `setInterval(() => void tickGit()…, 10_000);` über alle Slots (:4209 Schleife), hält `gitInfo` als Map aktuellen Werts (:4269 `gitInfo.set(s.id, { branch, dirty, ahead, behind })`) — nirgends eine Vorprobe oder Historie. „Jeden Tick" ist also ungenau (2-s-Poll bzw. 10-s-Git-Tick); die operative Substanz — beide Zahlen fallen regelmäßig an und werden nicht zurückbehalten — stimmt. |
| 11 | VERIFIZIERT (in MAIN; im Worktree nicht prüfbar) | `cmp` im Haupt-Checkout: `/Users/owner/claude-fleet/.claude/skills/mess-notiz/SKILL.md` und `.agents/skills/mess-notiz/SKILL.md` sind byte-identisch (nur lesend verglichen). Pin: `grep -c mess-notiz e2e/pins.ts` = 0; die einzigen beiden „skills"-Treffer in pins.ts (:2012, :2044) sind `--no-skills`-CLI-Flags. WICHTIG für P0: `.agents/` ist gitignored (`.gitignore:49` — `.agents/`, `git check-ignore` bestätigt) und existiert in diesem Worktree GAR NICHT — die Identität gilt maschinenlokal im Haupt-Checkout, nicht im Baum, den eine Lane sieht. |
| 12 | VERIFIZIERT | `e2e/pins.ts:1381-1383` — `pin(\`${RULE_REACH} — the dormant list is exactly the triggers no seam passes\`, JSON.stringify([...complement].sort()) === JSON.stringify([...DORMANT].sort())` (wörtlich: Vergleich von `complement` — `CONTEXT_PACK_TRIGGERS` minus Union der drei Seam-Konstanten — mit dem festen `DORMANT = ["task-queue", "harness-selection", "deployment"]`). Verbreitert `DISPATCH_CONTEXT_TRIGGERS` (`server.ts:7579`) um einen bisher dormanten Trigger, schrumpft `complement` unter `DORMANT` ⇒ Pin rot. Präzisierung: das Hinzufügen eines BEREITS erreichten Triggers (z. B. nochmal `always`) bricht ihn nicht — „Verbreiterung" bricht ihn genau dann, wenn sie dormante Werte erreicht. |

Keine der zwölf Behauptungen ist im Kern widerlegt; die Stoppregel (≥ 2 widerlegt ⇒ Abbruch) greift
nicht. Zwei Behauptungen tragen korrigierbare Detailfehler (4: Allowlist-Anzahl; 6: „einzige"
Vorbedingung; 10: „Tick"-Kadenz), die die abgeleiteten Schlüsse nicht tragen.

## Methode

Nur lesende Sonden im eigenen Worktree: `rg`/`grep`/`sed -n`/`awk` auf server.ts (22 729 Zeilen),
src/, e2e/, verify-proportion.ts, context-pack-validator.ts, lane-signals.ts, watchdog.sh,
e2e-stage.sh; `git ls-files`, `git check-ignore -v`; `cmp`/`md5` für Behauptung 11 — dort EIN
Ausflug, nur lesend, in den Haupt-Checkout (`/Users/owner/claude-fleet`), weil `.agents/` im
Worktree nicht existiert und die Byte-Identität sonst unbelegbar wäre. Kein Serverstart, kein
`bun server.ts`, kein `./e2e-isolated.sh`, kein Mutex, keine ps-Kommandozeilen, keine Schreibzugriffe
außerhalb des Worktrees. Zeilennummern beziehen sich auf den Baum wie committet (bdcc6d3).

## Was nicht gemessen wurde

- Behauptung 3, Live-Komponente: Dass der LIVE-Prozess tatsächlich mit dem Env der
  watchdog-Zeile läuft, ist aus dem Worktree nicht beobachtbar (Prozess-Env-Lesen ist hier
  verboten). Belegt ist: der im Repo committete Deployment-Mechanismus setzt genau diese Werte,
  und server.ts:7899 nennt „both off" die „today's live behaviour byte for byte". Die Annahme
  „Live läuft über watchdog.sh" bleibt eine Annahme mit starkem In-tree-Sekundärbeweis.
- Behauptung 1: `sendText`-Transportdetails (Composer-Paste vs. send-keys) wurden nicht
  end-to-end beobachtet, nur gelesen; die Funktion fügt aber keinen eigenen Content an.
- Die §1-Ledgerzahlen des Dokuments (567 Ausgänge, 123 killed-empty) wurden NICHT nachgezählt —
  nicht Teil der zwölf Behauptungen; lane-outcomes.jsonl ist im Worktree nicht vorhanden.
- `slotDeliveryBudget`-Dynamik (wie oft die Budget-409 in der Praxis greift) wurde nicht gemessen,
  nur der Codepfad gelesen.

## Urteil

**U1 — B (`unfulfillable` als propose/promote) ist verfrüht.** Es ist das einzige Paket, das
server.ts UND src/client.ts UND fünf neue e2e-Fälle bewegt — also das teuerste Slice auf der
empfindlichsten Fläche, mit voller lokaler Kette pro Land und einer offenen Owner-Entscheidung
(`awaiting: "owner"`?), die Lane-Verhalten ändert. Dem steht keine gemessene Nachfrage gegenüber:
Das Dokument belegt 21,7 % killed-empty und schreibt sie selbst dem fehlenden EMPFÄNGER zu, nicht
unerfüllbaren Zeilen; wie oft Zeilen heute tatsächlich als unerfüllbar zurückpendeln, steht nirgends
— dafür existiert mit Prosa-`note` + Hand-Archiv bereits ein Träger. Kosten des Wartens: nahe null
(eine Zeile pendelt mit Notiz zurück). Kosten des Bauens jetzt: Lane-Stunden auf dem Hot-Path plus
Pflichtaufwand für fünf Checks und UI, bevor ein einziger Schwarm-Lauf (C) das Muster gezeigt hat.
P0/P0b/A/C/D1 sind jeweils billig oder explizit kalibrierungs-bewusst; B sollte erst nach Cs Daten
gebaut werden. (Der technische Kern von B — „bricht null Switches" — ist durch Befund 4 gedeckt:
es gibt schlicht keine Switches.)

**U2 — Das größte fehlende Risiko: P0s Sync-Pin-Prämise ist falsch, weil die zweite Kopie
maschinenlokal ist.** Das Dokument weiß („kein Pin hält sie synchron") und verschreibt als Fix:
„P0 muss den Pin mitbringen" über `.claude/…` UND `.agents/…/SKILL.md`. Gemessen ist aber:
`.agents/` ist zur Gänze gitignored (`.gitignore:49`) und existiert in keinem Lane-Worktree — eine
P0-Lane kann die Datei weder lesen noch committen. Ein strenger Pin in e2e/pins.ts — der in JEDEM
Land läuft, auch in der Docs-Kurzkette — wäre in jeder Lane rot und blockierte das Land;
ein „skip if absent"-Pin öffnet die Drift-Lücke exakt dort, wo Lanes schreiben. Die Vorbedingung des
gesamten Programms (P0 → P0b → A → C) trägt also einen Baustein, der so nicht existiert: die
Sync-Verantwortung muss vorher owner-entschieden werden (nur `.claude`-Kopie pinnen; oder `.agents`
tracken; oder Sync außerhalb des Repos erklären). Dieses Risiko fehlt im Dokument komplett — es
sieht zwei gleichartige Repo-Dateien, wo eine Repo-Datei und eine Maschinen-Datei liegen.
