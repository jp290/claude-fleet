// THE BROWSER PROBES, ONE MODULE (first step of Z1, docs/messungen/2026-10-10-verifikation-neu-zugeschnitten.md).
//
// Every check of the suite that starts a browser runs HERE, so a run can leave them out by its
// module choice (`FLEET_E2E_MODULES` without `dom`, or a shard without the unit `dom`) and still run
// every other check. The probes themselves stay where their family lives — the rigs are libraries:
//   · e2e/slots.ts        runFoundingFocusDom … runRightsDom (the board, the composer, the islands)
//   · e2e/lanes-lifecycle.ts  instanceBandDom, snapshotBoardDom (the Testinstanz band and board)
//   · e2e/drops.ts        runDropChatDom (the chat view's pictures)
//   · e2e/timeline-ui.ts  runTimelineDom (the session timeline lens)
// This file only drives them, with the very check lines they had in their old modules — the names
// are unchanged, only the module that emits them moved (suite-modules.ts#PROBE_HOSTS maps a change
// in a host file to this module too, so a narrowed preview still runs the probe it touched).
//
// FIXTURES. All but one serve the bundle behind a fixture origin and read no instance state. The
// one exception, runRightsDom, measures against THIS instance: it opens free band slots and lanes on
// FLEET_E2E_REPO and kills every one again. It ran inside slots.run() after slots 1+2 were open; it
// still meets them open — the runner steps `dom` right after `slots`, and a run without slots.ts
// plants the same two (fleet-e2e.ts, the base fixture). So it reads nothing another module writes.
//
// A run WITHOUT this module starts no browser: fleet-e2e.ts points FLEET_E2E_BROWSER at a path that
// cannot run whenever `dom` is not selected, so a browser probe that slipped into another module
// fails there as its own PROBE line instead of starting Chromium (e2e/pins.ts holds both halves).
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { BASE, REPO, ROOT, TOKEN, check } from "./harness";
import {
  ARBEITSORTE_MUTANTS, ArbeitsorteVerdictsIn, KEEP_MUTANTS, STRIP_MUTANTS, runArbeitsorteDom, runBundleChatDom,
  runComposerKeepDom, runComposerTargetDom, runFoundingFocusDom, runGlassIslandDom, runHeldDeliveriesDom,
  runPhoneIslandDom, runRightsDom, runSettingsDom, runStripDom, runTermFindDom, startArbeitsorteBrowser,
  type ArbeitsorteBrowser, type ArbeitsorteDomResult,
} from "./slots";
import { instanceBandDom, snapshotBoardDom } from "./lanes-lifecycle";
import { runDropChatDom } from "./drops";
import { TIMELINE_MUTANTS, runTimelineDom } from "./timeline-ui";

export async function run(): Promise<void> {
  // the scratch copy carries server.ts + public/ but not src/ — the link back to the checkout is the
  // node_modules symlink, so the real source is its realpath's parent
  const sourceRoot = dirname(realpathSync(`${ROOT}/node_modules`));
  await slotsDom(sourceRoot);
  await bandDom(sourceRoot);
  await snapshotDom(sourceRoot);
  await dropsDom(sourceRoot);
  await timelineDom(sourceRoot);
}

// --- from e2e/slots.ts: the founding window, settings, composer, chat, terminal search, Arbeitsorte,
// the phone islands, the strip, the glass island and the rights of a session
async function slotsDom(sourceRoot: string): Promise<void> {
  try {
    const focusCases = await runFoundingFocusDom(sourceRoot);
    for (const result of focusCases) {
      const atWidth = `${result.width}x${result.height}`;
      for (const [claim, ok] of Object.entries(result.g))
        check(`founding DOM ${atWidth}: ${claim}`, ok, JSON.stringify(result.detail).slice(0, 600));
      for (const [claim, ok] of Object.entries(result.g2))
        check(`founding G2 DOM ${atWidth}: ${claim}`, ok, claim);
    }
  } catch (error) {
    check("founding focus DOM — PROBE: Chromium runs the isolated fixture", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE SETTINGS WINDOW, measured in a real browser on the real client bundle (card 3e6342e2):
  // every claim is its own line, so a dropped name, a wrong choice state or a focus that escapes
  // the window turns exactly that line red. A browser that cannot run is the PROBE line — red,
  // never a skip.
  try {
    for (const result of await runSettingsDom(sourceRoot)) {
      // the late steps' facts first: the first steps' fill the 1500 characters on their own, and a red
      // explorer or Checks claim arrived without the facts that say why (preview 86431fe8bd67)
      const { unsettled, explorerSteps, explorer, meter, ...early } = result.facts as Record<string, unknown>;
      const facts = JSON.stringify({ unsettled, explorerSteps, explorer, meter, ...early }).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`settings DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("settings DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE SEND TARGET AND THE TWO PANES' INPUTS (card 929fdbe7, Grammatik G2.4), same rig: two
  // sessions in two panes (one pane and the Sessions sheet at 390), native clicks and typing, a fake socket
  // per pane, /send intercepted. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    for (const result of await runComposerTargetDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`send target DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("send target DOM — PROBE: Chromium runs the real client bundle with two panes behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE DRAFT AND ➤ OF THE COMPOSER (card "Drei kleine Schmerzen" 2026-10-09), same rig: the draft
  // through a reload and a send, ➤ for an ended session's draft — then each part's
  // claim against its mutant (KEEP_MUTANTS). A browser that cannot run is the PROBE line — red, never a skip.
  try {
    for (const result of await runComposerKeepDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`composer keep DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("composer keep DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }
  for (const m of KEEP_MUTANTS) {
    try {
      const hit = (await runComposerKeepDom(sourceRoot, { mutate: m })).flatMap((r) => Object.entries(r.claims)).filter(([c]) => c.includes(m.claim));
      check(`composer keep DOM MUTATION — ${m.name}: "${m.claim}…" turns red`, hit.length > 0 && hit.every(([, ok]) => !ok), JSON.stringify(hit).slice(0, 600));
    } catch (error) {
      check(`composer keep DOM MUTATION — ${m.name}: PROBE could not run its mutant`, false, error instanceof Error ? error.message : String(error));
    }
  }

  // A BUNDLED OWNER SEND IN THE CHAT VIEW (owner screenshot 2026-10-03 08:55), same rig: the composer
  // sends, the transcript brings back the bundle the server writes, and the "wartet" bubble must go
  // "durch" while every Fleet part stands as a quiet line; then the session's queue ("wartet" from the
  // queue, through a reload, adopted, "durch") and the Esc line. A browser that cannot run is the
  // PROBE line — red, never a skip.
  try {
    for (const result of await runBundleChatDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`bundle chat DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("bundle chat DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE HELD BUNDLE IN THE CHAT VIEW (Szenario 4 of the 2026-10-03 measurement), same rig: the slot
  // row carries heldDeliveries, the view ends in one quiet line and the composer says "Senden nimmt sie
  // mit"; without the field both are gone. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    for (const result of await runHeldDeliveriesDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`held bundle DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("held bundle DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE TERMINAL SEARCH'S PLACE (card 746e381b), same rig: ⌘/Ctrl+F at 1200 opens the bar top right,
  // off the corner row and the first 60 columns; at 390 a visible control of the pane opens it by
  // taps alone. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    for (const result of await runTermFindDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`terminal search DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("terminal search DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE ARBEITSORTE IN INFO (cards e66909b1 + abe74821, docs/design/rechter-tab-notiz.md §3b–§3d),
  // same rig: the Ranke at the top of Info in the draft's states, at 1200 and 390 — rows, a closed
  // lane without a flag and the lane opened in place, the stand of every machine, who holds an alarm, the worktree
  // field — each a DOM claim, and every click judged by the request it sent. A browser that cannot run
  // is the PROBE line — red, never a skip.
  let arbeitsorte: ArbeitsorteDomResult[] = [];
  try {
    arbeitsorte = await runArbeitsorteDom(sourceRoot);
    for (const result of arbeitsorte) {
      const facts = JSON.stringify(result.facts.focus ? { focus: result.facts.focus, ...result.facts } : result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`arbeitsorte DOM ${result.width}x${result.height} ${claim}`, ok,
          claim.includes("the old cards") ? JSON.stringify(result.facts.oldCard) : facts);
    }
  } catch (error) {
    check("arbeitsorte DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }
  // and each statement against its mutant: the claim that pins it must go red (ARBEITSORTE_MUTANTS) —
  // all in ONE Chromium, each mutant in a browser context of its own. A shared browser that cannot
  // start is a red PROBE line, and every mutant then starts its own as before: never a skip
  const mutantProfile = mkdtempSync(resolve(tmpdir(), "fleet-arbeitsorte-mutants-"));
  let mutantBrowser: ArbeitsorteBrowser | undefined;
  try {
    mutantBrowser = await startArbeitsorteBrowser(`${mutantProfile}/profile`);
  } catch (error) {
    check("arbeitsorte DOM MUTATION — PROBE: one Chromium runs every mutant", false, error instanceof Error ? error.message : String(error));
  }
  for (const m of ARBEITSORTE_MUTANTS) {
    try {
      const names = typeof m.claim === "string" ? [m.claim] : m.claim;
      const width = m.width ?? 390;
      const until = Object.keys(arbeitsorte.find((r) => r.state === m.state && r.width === width)?.claims ?? {}).filter((c) => names.some((n) => c.includes(n)));
      const runs = await runArbeitsorteDom(sourceRoot, undefined, { states: [m.state], widths: [width], mutate: m, browser: mutantBrowser, until })
        .catch((error: unknown) => { if (error instanceof ArbeitsorteVerdictsIn) return [error.result]; throw error; });
      const hit = runs.flatMap((r) => Object.entries(r.claims)).filter(([c]) => names.some((n) => c.includes(n)));
      check(`arbeitsorte DOM MUTATION — ${m.name}: "${names.join('…" · "')}…" turns red`,
        names.every((n) => hit.some(([c]) => c.includes(n))) && hit.every(([, ok]) => !ok), JSON.stringify(hit).slice(0, 600));
    } catch (error) {
      check(`arbeitsorte DOM MUTATION — ${m.name}: PROBE could not run its mutant`, false, error instanceof Error ? error.message : String(error));
    }
  }
  await mutantBrowser?.close();
  rmSync(mutantProfile, { recursive: true, force: true });

  // THE PHONE UPRIGHT'S TWO ISLANDS (card "Auf dem Telefon steht oben klein", docs/design/
  // mobil-insel-notiz.md §1c), same rig: the two steps of the top island, closing by name, by a tap
  // outside and by every action, the 40-px targets, the terminal above the bottom island, the grip's
  // keys without focus loss and with #keys' bytes — at 390 × 844 with and without a simulated
  // keyboard; at 360 × 780 that the sheets cut no word off; at 1200 and on its side only that no
  // island exists. A browser that cannot run is the
  // PROBE line — red, never a skip.
  try {
    for (const result of await runPhoneIslandDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`phone island DOM ${result.width}x${result.height}: ${claim}`, ok,
          claim in result.detail ? JSON.stringify(result.detail[claim]).slice(0, 1500) : facts);
    }
  } catch (error) {
    check("phone island DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE STRIP AND THE FOOT LINE (Konzept 2, Variante C — the owner's pick of 2026-10-07), same rig: the
  // open island's capsule, its four symbols and their words, what hangs under it, Mehr, Modell und
  // Effort, Suchen in both views, and the foot line at 390 and 1440 — then each statement against its
  // mutant (STRIP_MUTANTS): the claim that pins it must go red. A browser that cannot run is the PROBE
  // line — red, never a skip.
  try {
    for (const result of await runStripDom(sourceRoot))
      for (const [claim, ok] of Object.entries(result.claims))
        check(`strip DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.detail[claim] ?? result.detail.missing).slice(0, 1500));
  } catch (error) {
    check("strip DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }
  for (const m of STRIP_MUTANTS) {
    try {
      const hit = (await runStripDom(sourceRoot, { mutate: m })).flatMap((r) => Object.entries(r.claims)).filter(([c]) => m.claims.some((x) => c.includes(x)));
      check(`strip DOM MUTATION — ${m.name}: ${m.claims.map((x) => `"${x}…"`).join(" and ")} turn${m.claims.length === 1 ? "s" : ""} red`,
        m.claims.every((x) => hit.some(([c]) => c.includes(x))) && hit.every(([, ok]) => !ok), JSON.stringify(hit).slice(0, 600));
    } catch (error) {
      check(`strip DOM MUTATION — ${m.name}: PROBE could not run its mutant`, false, error instanceof Error ? error.message : String(error));
    }
  }

  // THE TOP ISLAND OF GLASS (card "Die Insel auf dem Telefon wird nach dem freigegebenen Entwurf
  // gebaut", docs/design/insel-glas-notiz.md), same fixture: the pill, the material and its opaque
  // face, the spring, the strip's four symbols and the card under it, the swipes and every way out, the
  // keys, still — in Chromium and, where a Playwright WebKit resolves, in WebKit. WebKit not resolving
  // is printed, not counted (the repo carries no Playwright); an engine that resolves and cannot run
  // is its PROBE line — red, never a skip.
  try {
    for (const result of await runGlassIslandDom(sourceRoot)) {
      if (result.notRun) { console.log(`NOTE  glass island DOM ${result.engine} not run here: ${result.notRun}`); continue; }
      for (const [claim, ok] of Object.entries(result.claims))
        check(`glass island DOM ${claim}`, ok, claim in result.detail ? JSON.stringify(result.detail[claim]).slice(0, 1500) : "");
    }
  } catch (error) {
    check("glass island DOM — PROBE: the engines run the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }

  // THE RIGHTS OF A SESSION (card "der Owner sieht an jeder Session und beim Gruenden, was sie
  // lesen darf"; docs/design/datenrechte-notiz.md): measured against THIS instance, not a fixture —
  // real grants, real 409s, a really re-occupied slot. Every scenario is its own line, so a painted
  // draft, a PATCH that should not have gone out or an "unbekannt" drawn as "keine" turns exactly
  // that line red. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    for (const result of await runRightsDom({ base: BASE, token: TOKEN, repo: REPO, sourceRoot })) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`rights DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("rights DOM — PROBE: Chromium runs the tree's client against the isolated instance", false,
      error instanceof Error ? error.message : String(error));
  }
}

// --- from e2e/lanes-lifecycle.ts#instanceBandChecks: the Testinstanz band
async function bandDom(sourceRoot: string): Promise<void> {
  // DOM — the real client bundle in Chromium at 900 × 700 and 390 × 844 with a long branch and a long
  // target: nothing clipped in either width, the target sentence whole. Mutation: segments that may not
  // shrink below their text (`flex: none` in the review's words).
  try {
    const dom = await instanceBandDom(sourceRoot);
    for (const v of dom.views) {
      check(`band DOM SETUP ${v.size}: Chromium paints the band from a fixture instance.source`, v.real.shown && v.real.text === dom.expected,
        JSON.stringify(v.real).slice(0, 600));
      check(`band DOM ${v.size}: with a long branch and target no segment overflows and the target sentence stands whole in the band`,
        v.real.shown && v.real.clipped.length === 0 && v.real.bandOverflow === false && v.real.lastWhole, JSON.stringify(v.real).slice(0, 900));
      check(`band DOM ${v.size} MUTATION: with unshrinkable segments (flex:none / nowrap) the same claim is red`,
        v.mutant.shown && (v.mutant.clipped.length > 0 || v.mutant.bandOverflow || !v.mutant.lastWhole), JSON.stringify(v.mutant).slice(0, 900));
      check(`band DOM ${v.size}: without instance.source (the live fleet) the band is hidden and the app starts at the top`,
        v.live.shown === false && v.live.htmlClass === false && v.live.appTop === 0, JSON.stringify(v.live));
    }
  } catch (error) {
    check("band DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false, error instanceof Error ? error.message : String(error));
  }
}

// --- from e2e/lanes-lifecycle.ts#snapshotTruthChecks: the snapshot board
async function snapshotDom(sourceRoot: string): Promise<void> {
  // DOM — three pages per width: carried binding, unreadable binding, live fleet
  try {
    const dom = await snapshotBoardDom(sourceRoot);
    for (const v of dom.views) {
      const p = v.pages;
      // (Owner-Runde 9, 2026-10-09) the instance runs: it answers this page, so its device row carries
      // the live tone and the mark "hier"; no live-server stand row is painted, so nothing claims a Live stand
      check(`snapshot DOM ${v.size} (Owner-Runde 9): the machine group's Testinstanz device row says it runs here — live tone, "hier" — and never claims a Live stand`,
        p.carried.tiRow !== null && p.carried.tiRow.tone === "live" && p.carried.tiRow.state === "hier"
        && p.carried.rowText === "(no row)" && !/Live|Sein Stand|läuft auf/.test(p.carried.tiRow.text),
        JSON.stringify({ ti: p.carried.tiRow, row: p.carried.rowText }));
      check(`snapshot DOM ${v.size}: the helper devices stand as one row "Helfer · offline · nicht angemeldet", the reason — the copy carries none — on hover`,
        p.carried.helperText === "offline · nicht angemeldet" && /Testinstanz/.test(p.carried.helperTitle ?? ""), JSON.stringify([p.carried.helperText, p.carried.helperTitle]));
      check(`snapshot DOM ${v.size}: the copy is no workplace — no repo group row under the machine`,
        p.carried.repoRows === 0, JSON.stringify(p.carried.repoRows));
      check(`snapshot DOM ${v.size}: a carried binding reads "Ihr Program", never "An keinen Auftrag, kein Program gebunden"`,
        p.carried.rights.includes("Ihr Program") && !p.carried.rights.includes("An keinen Auftrag"),
        JSON.stringify(p.carried.rights).slice(0, 300));
      check(`snapshot DOM ${v.size}: a binding the snapshot cannot carry reads "Im Snapshot nicht belegt", never "Keine"`,
        p.unknown.rights.includes("Im Snapshot nicht belegt") && !p.unknown.rights.includes("An keinen Auftrag"),
        JSON.stringify(p.unknown.rights).slice(0, 300));
      check(`snapshot DOM ${v.size}: a git:none brief stands as the board's calm sentence, the column is not empty`,
        p.carried.brief?.includes("Kein Git in diesem Ordner") === true && p.carried.briefLen > 40, JSON.stringify(p.carried.brief));
      check(`snapshot DOM ${v.size} MUTATION: without the sentence the painted calm is gone and the claim is red`,
        p.mutant.brief !== null && !p.mutant.brief.includes("Kein Git in diesem Ordner"), JSON.stringify(p.mutant.brief));
      check(`snapshot DOM ${v.size} MUTATION: the same predicates over the live page are red — the live server's own sentence, no placeholder, "Keine" rights`,
        p.live.rowText === "Sein Stand ist nicht belegt." && p.live.helperText === null && p.live.tiRow === null
        && p.live.rights.includes("An keinen Auftrag, kein Program gebunden") && !p.live.rowText.includes("Testinstanz"),
        JSON.stringify({ row: p.live.rowText, ti: p.live.tiRow, helper: p.live.helperText, rights: p.live.rights.slice(0, 120) }));
    }
  } catch (error) {
    check("snapshot DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false, error instanceof Error ? error.message : String(error));
  }
}

// --- from e2e/drops.ts
async function dropsDom(sourceRoot: string): Promise<void> {
  // --- the chat view's pictures, in a real browser against fixtures (no slot, no live drop). A
  // browser that cannot run is the PROBE line — red, never a skip.
  try {
    for (const result of await runDropChatDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`drop chat DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("drop chat DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
  }
}

// --- from e2e/timeline-ui.ts: the session timeline lens and its mutants
async function timelineDom(sourceRoot: string): Promise<void> {
  try {
    for (const result of await runTimelineDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts).slice(0, 1500);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`timeline DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    check("timeline DOM — PROBE: Chromium runs the real client bundle behind the fixture origin", false,
      error instanceof Error ? error.message : String(error));
    return;
  }
  // every mutant must turn its claim red at its one viewport (1200×900 unless it is a phone claim) —
  // a needle that left the source fails as the probe
  for (const m of TIMELINE_MUTANTS) {
    try {
      const hit = (await runTimelineDom(sourceRoot, undefined, { widths: [m.width ?? 1200], mutate: m }))[0];
      check(`timeline DOM mutant: ${m.name} turns red: ${m.claim.slice(0, 60)}`, hit?.claims[m.claim] === false,
        JSON.stringify(hit?.facts ?? null).slice(0, 600));
    } catch (error) {
      check(`timeline DOM mutant — PROBE: ${m.name}`, false, error instanceof Error ? error.message : String(error));
    }
  }
}
