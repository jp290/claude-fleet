// Kindprozess des Fernpost-Tests (server/fernpost.test.ts): ein Server, der WIRKLICH auf seinem Port lauscht, damit zwei davon einander
// über HTTP erreichen (server/branches.drive.ts ruft den Handler nur im Prozess auf). Zustand laden, Token übernehmen, Bun.serve, und
// der Takt der Postfach-Zustellung und der Git-Tick, die der echte Start als Timer fährt. Meldet sich mit einer JSON-Zeile und lebt, bis der Test ihn beendet.
import { join } from "node:path";
const stateDir = process.env.FLEET_STATE_DIR;
if (!stateDir || !process.env.FLEET_PORT || !process.env.FLEET_TOKEN) throw new Error("FLEET_STATE_DIR, FLEET_PORT und FLEET_TOKEN fehlen");
const { serveOptions, adoptTokens, loadStateAndReap, settleBranchBook, tickPostfachZustellung, slotFrom, meldeNachbarProbleme, abnahmeTick, tickGit, GIT_TICK_MS, tickMigrate, tickParkedSends, pollStreams } = await import("../server");
await loadStateAndReap(join(stateDir, "fleet.json"));
await settleBranchBook();
adoptTokens();
const server = Bun.serve(serveOptions as Parameters<typeof Bun.serve>[0]);
// wie der echte Start: was an der Bindung nicht stimmt, steht im Log
meldeNachbarProbleme();
let tick = false;
setInterval(() => {
  // der poll-Takt des echten Starts hält fest, wann eine Pane zuletzt etwas ausgab; hier gilt jede besetzte Pane als seit zehn Sekunden still
  for (let n = 1; n <= 16; n++) { const s = slotFrom(n); if (s?.cwd && s.lastOutput === 0) s.lastOutput = Date.now() - 10_000; }
  if (tick) return;
  tick = true;
  void tickPostfachZustellung().catch((e) => console.error("postfach-takt:", e instanceof Error ? e.message : e)).finally(() => { tick = false; });
}, 300);
// DER GIT-TICK WIE BEIM ECHTEN START (W3 Auftrag 13): server.ts fährt ihn nur unter `if (import.meta.main)`, ein Testserver importiert es als Modul und
// tickte nie von selbst — jeder Test, der Git-Tatsachen las (Branch, Kopf, Check in der Übersicht), musste ihn mit einer Mutation anstoßen. Jetzt
// tickt er hier im selben Takt (FLEET_GIT_TICK_MS, mindestens 1 s), einmal gleich beim Start; ein Lauf, der noch nicht fertig ist, wird nicht doppelt
// gestartet.
let gitLaeuft = false;
const gitTakt = (): void => {
  if (gitLaeuft) return;
  gitLaeuft = true;
  void tickGit().catch((e) => console.error("git-takt:", e instanceof Error ? e.message : e)).finally(() => { gitLaeuft = false; });
};
gitTakt();
setInterval(gitTakt, GIT_TICK_MS);
// der Takt der Abnahme-Instanzen (server/abnahme-instanz.ts), wenn ein Test ihn verlangt
if (process.env.FLEET_ABNAHME_TICK_MS)
  setInterval(() => { void abnahmeTick().catch((e) => console.error("abnahme-takt:", e instanceof Error ? e.message : e)); }, Number(process.env.FLEET_ABNAHME_TICK_MS));
// der Übergabe-Takt (server.ts#tickMigrate), wenn ein Test ihn verlangt; FLEET_MIGRATE_PCT schaltet ihn wie im echten Start erst scharf
if (process.env.FLEET_TEST_MIGRATE_TICK_MS)
  setInterval(() => { void tickMigrate().catch((e) => console.error("uebergabe-takt:", e instanceof Error ? e.message : e)); }, Number(process.env.FLEET_TEST_MIGRATE_TICK_MS));
// der Lese-Takt der Pane-Ströme (server.ts#poll, im echten Start alle 100 ms), wenn ein Test ihn verlangt: erst mit ihm sieht Fleet, dass
// eine Pane malt (lastOutput, die Malmarke, nach der server/live-state.ts den Rahmen neu liest), statt ihren Rahmen bis zu 5 s alt zu halten
if (process.env.FLEET_TEST_STREAM_POLL_MS && typeof pollStreams === "function")
  setInterval(() => { void pollStreams().catch((e) => console.error("strom-takt:", e instanceof Error ? e.message : e)); }, Number(process.env.FLEET_TEST_STREAM_POLL_MS));
// der Takt der geparkten Fleet-Sendungen (server.ts#tickParkedSends), wenn ein Test ihn verlangt: er tippt, sobald ein Feld frei wird
if (process.env.FLEET_TEST_PARKED_TICK_MS)
  setInterval(() => { void tickParkedSends().catch((e) => console.error("park-takt:", e instanceof Error ? e.message : e)); }, Number(process.env.FLEET_TEST_PARKED_TICK_MS));
process.stdout.write(`${JSON.stringify({ bereit: server.port })}\n`);
