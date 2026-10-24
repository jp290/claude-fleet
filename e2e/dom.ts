// THE BROWSER PROBES, ONE MODULE (first step of Z1, docs/messungen/2026-10-10-verifikation-neu-zugeschnitten.md).
//
// Every check of the suite that starts a browser runs HERE, so a run can leave them out by its
// module choice (`FLEET_E2E_MODULES` without `dom`, or a shard without the unit `dom`) and still run
// every other check. The probes themselves stay where their family lives — the rigs are libraries:
//   · e2e/slots.ts        runSettingsDom … runRightsDom (the board, the composer, the islands),
//                         runActivityDom (the Activity window's type and loading states)
//   · e2e/lanes-lifecycle.ts  instanceBandDom, snapshotBoardDom (the Testinstanz band and board)
//   · e2e/drops.ts        runDropChatDom (the chat view's pictures)
//   · e2e/timeline-ui.ts  runTimelineDom (the session timeline lens)
//   · e2e/role-address.ts runPostfachDom (a session's Postfach tab, K13)
//   · e2e/konstellation.ts runKonstellationDom (the constellation window, K16 E2b)
//   · e2e/uebergabe.ts    runUebergabeDom (the session's „Handover“ block, K16 uebergabe-b)
//   · e2e/leiste.ts       runLeisteDom (the left bar: views square, rows, band, fit, highlight)
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
import { mutantSlice } from "./ctx";
import {
  ACTIVITY_MUTANTS, ARBEITSORTE_MUTANTS, ArbeitsorteVerdictsIn, KEEP_MUTANTS, STRIP_MUTANTS, runActivityDom, runArbeitsorteDom, runBundleChatDom,
  runComposerKeepDom, runComposerTargetDom, runGlassIslandDom, runHeldDeliveriesDom,
  runPhoneIslandDom, runRightsDom, runSettingsDom, runStripDom, runTermFindDom, startArbeitsorteBrowser,
  type ArbeitsorteBrowser, type ArbeitsorteDomResult,
} from "./slots";
import { instanceBandDom, snapshotBoardDom } from "./lanes-lifecycle";
import { runDropChatDom } from "./drops";
import { TIMELINE_MUTANTS, runTimelineDom } from "./timeline-ui";
import { runPostfachDom } from "./role-address";
import { KONST_CLAIM, KONST_MUTANTS, runKonstellationDom } from "./konstellation";
import { UEB_MUTANTS, runUebergabeDom } from "./uebergabe";
import { LEISTE_MUTANTS, runLeisteDom } from "./leiste";
import { K15_START_LIVE_MUTANTS, runK15StartLiveDom } from "./k15-start";
import { K15_START_MUTANTS, runK15StartDom } from "./k15-start-dom";

// THE CUT OF e897fa95 (docs/messungen/2026-10-10-ci-inventur.md, card 5; the verdicts per call site in
// its .tsv). This unit was the suite's most expensive one (1606 s in the full preview of 2026-10-11),
// and three things made it so, each answered here:
//
// MUTANT MODE. A mutant proves that a claim CAN fail, one browser run per mutant: 827 of those
// 1606 s. That proof is owed when a claim is written, not in every run (AGENTS.md: let a mutation
// prove the check can fail), so every mutant — the *_MUTANTS loops and the band's and the snapshot's
// mutant pages — runs only with FLEET_E2E_DOM_MUTANTS=1. None is deleted; the nightly audit
// (619a5000) is the place that runs the mode on a schedule. The *_MUTANTS loops are units of their
// own since 2026-10-24, sliced across the nightly's shards (runMutants at the end of this file).
const DOM_MUTANTS = process.env.FLEET_E2E_DOM_MUTANTS === "1";

// ONE PROBE LINE. A rig whose browser cannot run is still fenced by its own try, so it cannot take its
// neighbours down, but it reports into ONE line per run (the rig and its error in the detail) instead
// of 21 lines that all said "Chromium did not run".
let probeFailures: string[] = [];
const probeFailed = (rig: string, error: unknown): void => {
  probeFailures.push(`${rig}: ${error instanceof Error ? error.message : String(error)}`);
};

// ONE VIEWPORT FOR WHAT READS THE SAME. Where a rig still has to run both widths, a claim both widths
// carry is checked at `home` only; a claim only one width carries stays at its width, and `alsoAt`
// keeps a claim at the other width as well (layout, or a claim the trail saw red there). `group`
// separates results that are not the same page (the Arbeitsorte's states). A missing home result
// keeps every claim of the other width: nothing is dropped because a run was cut short.
type Viewported = { width: number; height: number; claims: Record<string, boolean> };
function atOneViewport<R extends Viewported>(results: readonly R[], home: number,
  o: { alsoAt?: (claim: string) => boolean; group?: (r: R) => string } = {}): [R, string, boolean][] {
  const group = o.group ?? (() => "");
  const homeClaims = new Set(results.filter((r) => r.width === home).flatMap((r) => Object.keys(r.claims).map((c) => `${group(r)}\u0000${c}`)));
  return results.flatMap((r) => Object.entries(r.claims)
    .filter(([claim]) => r.width === home || !homeClaims.has(`${group(r)}\u0000${claim}`) || (o.alsoAt?.(claim) ?? false))
    .map(([claim, ok]): [R, string, boolean] => [r, claim, ok]));
}

export async function run(): Promise<void> {
  // the scratch copy carries server.ts + public/ but not src/ — the link back to the checkout is the
  // node_modules symlink, so the real source is its realpath's parent
  const sourceRoot = dirname(realpathSync(`${ROOT}/node_modules`));
  probeFailures = [];
  await slotsDom(sourceRoot);
  await bandDom(sourceRoot);
  await snapshotDom(sourceRoot);
  await dropsDom(sourceRoot);
  await timelineDom(sourceRoot);
  await activityDom(sourceRoot);
  await postfachDom(sourceRoot);
  await konstellationDom(sourceRoot);
  await uebergabeDom(sourceRoot);
  await leisteDom(sourceRoot);
  await k15StartDom(sourceRoot);
  check(`dom — PROBE: Chromium starts and loads the client bundle in every rig${DOM_MUTANTS ? " and for the band's and the snapshot's mutant pages" : ""}`,
    probeFailures.length === 0, probeFailures.join(" · "));
}

// --- from e2e/slots.ts: settings, composer, chat, terminal search, Arbeitsorte, the phone islands, the strip, the glass
// island and the rights of a session (the old start window's rig left with the window, K15 Runde 5: e2e/k15-start*.ts)
async function slotsDom(sourceRoot: string): Promise<void> {
  // THE SETTINGS WINDOW, measured in a real browser on the real client bundle (card 3e6342e2):
  // every claim is its own line, so a dropped name, a wrong choice state or a focus that escapes
  // the window turns exactly that line red. A browser that cannot run is the PROBE line — red,
  // never a skip.
  try {
    // one viewport for what reads the same (e897fa95): 390, where the usage claim was red 19 times; 1200
    // keeps what only it carries, the Checks line at the board's real width
    for (const [result, claim, ok] of atOneViewport(await runSettingsDom(sourceRoot), 390)) {
      // the late steps' facts first: the first steps' fill the 1500 characters on their own, and a red
      // explorer or Checks claim arrived without the facts that say why (preview 86431fe8bd67)
      const { unsettled, explorerSteps, explorer, meter, ...early } = result.facts as Record<string, unknown>;
      const facts = JSON.stringify({ unsettled, explorerSteps, explorer, meter, ...early });
      check(`settings DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("settings DOM", error);
  }

  // THE SEND TARGET AND THE TWO PANES' INPUTS (card 929fdbe7, Grammatik G2.4), same rig: two
  // sessions in two panes (one pane and the Sessions sheet at 390), native clicks and typing, a fake socket
  // per pane, /send intercepted. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    // one viewport for what reads the same (e897fa95): 1200; the phone's Sessions sheet and ➤ stay at 390
    for (const [result, claim, ok] of atOneViewport(await runComposerTargetDom(sourceRoot), 1200))
      check(`send target DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.facts));
  } catch (error) {
    probeFailed("send target DOM", error);
  }

  // THE DRAFT AND ➤ OF THE COMPOSER (card "Drei kleine Schmerzen" 2026-10-09), same rig: the draft
  // through a reload and a send, ➤ for an ended session's draft — then each part's
  // claim against its mutant (KEEP_MUTANTS). A browser that cannot run is the PROBE line — red, never a skip.
  try {
    // one width (e897fa95): every claim reads the same at 1440 and 390, so 390, where ➤ stands
    for (const result of await runComposerKeepDom(sourceRoot, { widths: [390] })) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`composer keep DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("composer keep DOM", error);
  }

  // A BUNDLED OWNER SEND IN THE CHAT VIEW (owner screenshot 2026-10-03 08:55), same rig: the composer
  // sends, the transcript brings back the bundle the server writes, and the "wartet" bubble must go
  // "durch" while every Fleet part stands as a quiet line; then the session's queue ("wartet" from the
  // queue, through a reload, adopted, "durch") and the Esc line. A browser that cannot run is the
  // PROBE line — red, never a skip.
  try {
    // one width (e897fa95): every claim reads the same at 1200 and 390
    for (const result of await runBundleChatDom(sourceRoot, undefined, [1200])) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`bundle chat DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("bundle chat DOM", error);
  }

  // THE HELD BUNDLE IN THE CHAT VIEW (Szenario 4 of the 2026-10-03 measurement), same rig: the slot
  // row carries heldDeliveries, the view ends in one quiet line and the composer says "Senden nimmt sie
  // mit"; without the field both are gone. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    // one width (e897fa95): every claim reads the same at 1200 and 390
    for (const result of await runHeldDeliveriesDom(sourceRoot, undefined, [1200])) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`held bundle DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("held bundle DOM", error);
  }

  // THE TERMINAL SEARCH'S PLACE (card 746e381b), same rig: ⌘/Ctrl+F at 1200 opens the bar top right,
  // off the corner row and the first 60 columns; at 390 a visible control of the pane opens it by
  // taps alone. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    for (const result of await runTermFindDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`terminal search DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("terminal search DOM", error);
  }

  // THE ARBEITSORTE IN INFO (cards e66909b1 + abe74821, docs/design/rechter-tab-notiz.md §3b–§3d),
  // same rig: the Ranke at the top of Info in the draft's states, at 1200 and 390 — rows, a closed
  // lane without a flag and the lane opened in place, the stand of every machine, who holds an alarm, the worktree
  // field — each a DOM claim, and every click judged by the request it sent. A browser that cannot run
  // is the PROBE line — red, never a skip.
  let arbeitsorte: ArbeitsorteDomResult[] = [];
  try {
    arbeitsorte = await runArbeitsorteDom(sourceRoot);
    // one viewport for what reads the same (e897fa95): content at 1200, where the modell claims were
    // red; at 390 what only the phone carries and every claim about space — a word cut, a line, a side,
    // a width — so the narrow width still answers for layout. Wide on purpose: a claim it keeps twice
    // costs one line, a layout claim it let go costs the phone.
    const layout = /\bcut\b|overflow|clip|wrap|ellips|sideways|scroll|\bpx\b|width|narrow|wide\b|overlap|runs? (?:off|out)|\bfits?\b|whole|truncat|\bline|rail|beside|under|above|\bleft\b|\bright\b|\btop\b|bottom|corner|edge|tap|touch|finger|keyboard|sheet|phone/i;
    for (const [result, claim, ok] of atOneViewport(arbeitsorte, 1200, { alsoAt: (c) => layout.test(c), group: (r) => r.state })) {
      const facts = JSON.stringify(result.facts.focus ? { focus: result.facts.focus, ...result.facts } : result.facts);
      check(`arbeitsorte DOM ${result.width}x${result.height} ${claim}`, ok,
        claim.includes("the old cards") ? JSON.stringify(result.facts.oldCard) : facts);
    }
  } catch (error) {
    probeFailed("arbeitsorte DOM", error);
  }

  // THE PHONE UPRIGHT'S TWO ISLANDS (card "Auf dem Telefon steht oben klein", docs/design/
  // mobil-insel-notiz.md §1c), same rig: the two steps of the top island, closing by name, by a tap
  // outside and by every action, the 40-px targets, the terminal above the bottom island, the grip's
  // keys without focus loss and with #keys' bytes — at 390 × 844 with and without a simulated
  // keyboard; at 360 × 780 that the sheets cut no word off; at 1200 and on its side only that no
  // island exists. A browser that cannot run is the
  // PROBE line — red, never a skip.
  try {
    for (const result of await runPhoneIslandDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`phone island DOM ${result.width}x${result.height}: ${claim}`, ok,
          claim in result.detail ? JSON.stringify(result.detail[claim]) : facts);
    }
  } catch (error) {
    probeFailed("phone island DOM", error);
  }

  // THE STRIP AND THE FOOT LINE (Konzept 2, Variante C — the owner's pick of 2026-10-07), same rig: the
  // open island's capsule, its four symbols and their words, what hangs under it, Mehr, Modell und
  // Effort, Suchen in both views, and the foot line at 390 and 1440 — then each statement against its
  // mutant (STRIP_MUTANTS): the claim that pins it must go red. A browser that cannot run is the PROBE
  // line — red, never a skip.
  try {
    for (const result of await runStripDom(sourceRoot))
      for (const [claim, ok] of Object.entries(result.claims))
        check(`strip DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.detail[claim] ?? result.detail.missing));
  } catch (error) {
    probeFailed("strip DOM", error);
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
        check(`glass island DOM ${claim}`, ok, claim in result.detail ? JSON.stringify(result.detail[claim]) : "");
    }
  } catch (error) {
    probeFailed("glass island DOM", error);
  }

  // THE RIGHTS OF A SESSION (card "der Owner sieht an jeder Session und beim Gruenden, was sie
  // lesen darf"; docs/design/datenrechte-notiz.md): measured against THIS instance, not a fixture.
  // Every scenario is its own line. A browser that cannot run is the PROBE line — red, never a skip.
  try {
    // both widths stay (e897fa95 left its one-viewport verdict here): the trail saw rights claims red at
    // 1200 AND at 390, different ones at each, and a claim stays at every width it was red at
    for (const result of await runRightsDom({ base: BASE, token: TOKEN, repo: REPO, sourceRoot })) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`rights DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("rights DOM", error);
  }
}

// --- from e2e/lanes-lifecycle.ts#instanceBandChecks: the Testinstanz band
async function bandDom(sourceRoot: string): Promise<void> {
  // DOM — the real client bundle in Chromium at 900 × 700 and 390 × 844 with a long branch and a long
  // target: nothing clipped in either width, the target sentence whole. Mutation (the mutant mode):
  // segments that may not shrink below their text (`flex: none` in the review's words).
  try {
    const dom = await instanceBandDom(sourceRoot, { mutants: DOM_MUTANTS });
    for (const v of dom.views) {
      // the band painted from the fixture's instance.source is this claim's precondition, held inside
      // it (e897fa95: the SETUP line folded in), so the detail says which half failed
      const painted = v.real.shown && v.real.text === dom.expected;
      check(`band DOM ${v.size}: with a long branch and target no segment overflows and the target sentence stands whole in the band`,
        painted && v.real.clipped.length === 0 && v.real.bandOverflow === false && v.real.lastWhole,
        JSON.stringify({ painted, expected: painted ? undefined : dom.expected, ...v.real }).slice(0, 900));
      if (v.mutant) check(`band DOM ${v.size} MUTATION: with unshrinkable segments (flex:none / nowrap) the same claim is red`,
        v.mutant.shown && (v.mutant.clipped.length > 0 || v.mutant.bandOverflow || !v.mutant.lastWhole), JSON.stringify(v.mutant).slice(0, 900));
      check(`band DOM ${v.size}: without instance.source (the live fleet) the band is hidden and the app starts at the top`,
        v.live.shown === false && v.live.htmlClass === false && v.live.appTop === 0, JSON.stringify(v.live));
    }
    // the tab title reads the same at every width: one line, at the first view (K13 S7, Mangel 66; owner 14.10.:
    // „[Zitat entfernt]“)
    const first = dom.views[0];
    if (first) check("band DOM: a test instance's tab is named „<Branch> · :<Port>“, the live fleet's tab keeps „Claude Fleet“",
      first.real.title === dom.expectedTitle && first.live.title === "Claude Fleet",
      JSON.stringify({ expected: dom.expectedTitle, real: first.real.title, live: first.live.title }));
  } catch (error) {
    probeFailed("band DOM", error);
  }
}

// --- from e2e/lanes-lifecycle.ts#snapshotTruthChecks: the snapshot board
async function snapshotDom(sourceRoot: string): Promise<void> {
  // DOM — per width the carried and the unreadable binding; the mutant mode adds the mutant and the
  // live page. One size for what reads the same (e897fa95): 1200 × 900. The two binding claims stay at
  // both sizes: the trail saw each red at both (5 times each, on 4 branches).
  try {
    const dom = await snapshotBoardDom(sourceRoot, { mutants: DOM_MUTANTS });
    for (const v of dom.views) {
      const p = v.pages;
      const home = v.size === "1200x900";
      // (Owner-Runde 9, 2026-10-09) the instance runs: it answers this page, so its device row carries
      // the live tone and the mark "here"; no live-server stand row is painted, so nothing claims a Live stand
      if (home) check(`snapshot DOM ${v.size} (Owner-Runde 9): the machine group's Testinstanz device row says it runs here — live tone, "here" — and never claims a Live stand`,
        p.carried.tiRow !== null && p.carried.tiRow.tone === "live" && p.carried.tiRow.state === "here"
        && p.carried.rowText === "(no row)" && !/Live|Its state|runs on/.test(p.carried.tiRow.text),
        JSON.stringify({ ti: p.carried.tiRow, row: p.carried.rowText }));
      if (home) check(`snapshot DOM ${v.size}: the helper devices stand as one row "Helper · offline · not signed in", the reason — the copy carries none — on hover`,
        p.carried.helperText === "offline · not signed in" && /test instance/.test(p.carried.helperTitle ?? ""), JSON.stringify([p.carried.helperText, p.carried.helperTitle]));
      if (home) check(`snapshot DOM ${v.size}: the copy is no workplace — no repo group row under the machine`,
        p.carried.repoRows === 0, JSON.stringify(p.carried.repoRows));
      check(`snapshot DOM ${v.size}: a carried binding reads "Its Program", never "Bound to no task and no Program"`,
        p.carried.rights.includes("Its Program") && !p.carried.rights.includes("Bound to no task"),
        JSON.stringify(p.carried.rights).slice(0, 300));
      check(`snapshot DOM ${v.size}: a binding the snapshot cannot carry reads "Not in the snapshot", never "None"`,
        p.unknown.rights.includes("Not in the snapshot") && !p.unknown.rights.includes("Bound to no task"),
        JSON.stringify(p.unknown.rights).slice(0, 300));
      if (home) check(`snapshot DOM ${v.size}: a git:none brief stands as the board's calm sentence, the column is not empty`,
        p.carried.brief?.includes("No git in this folder") === true && p.carried.briefLen > 40, JSON.stringify(p.carried.brief));
      if (p.mutant) check(`snapshot DOM ${v.size} MUTATION: without the sentence the painted calm is gone and the claim is red`,
        p.mutant.brief !== null && !p.mutant.brief.includes("No git in this folder"), JSON.stringify(p.mutant.brief));
      if (p.live) check(`snapshot DOM ${v.size} MUTATION: the same predicates over the live page are red — the live server's own sentence, no placeholder, "None" rights`,
        p.live.rowText === "Its state is not proven." && p.live.helperText === null && p.live.tiRow === null
        && p.live.rights.includes("Bound to no task and no Program") && !p.live.rowText.includes("test instance"),
        JSON.stringify({ row: p.live.rowText, ti: p.live.tiRow, helper: p.live.helperText, rights: p.live.rights.slice(0, 120) }));
    }
  } catch (error) {
    probeFailed("snapshot DOM", error);
  }
}

// --- from e2e/drops.ts
// --- from e2e/role-address.ts: the Postfach tab (K13 S10). Owner-Satz: „[Zitat entfernt]“
// 
//  One viewport for what reads the same (1200); the column claim at both widths, the
// phone opening Info from the island. A browser that cannot run is the PROBE line — red, never a skip.
async function postfachDom(sourceRoot: string): Promise<void> {
  try {
    for (const [result, claim, ok] of atOneViewport(await runPostfachDom(sourceRoot), 1200,
      { alsoAt: (c) => c.startsWith("the compact lines stay inside") }))
      check(`postfach DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.facts));
  } catch (error) {
    probeFailed("postfach DOM", error);
  }
}

// --- from e2e/uebergabe.ts: the session's „Handover“ block (K16 uebergabe-b) and its mutants.
async function uebergabeDom(sourceRoot: string): Promise<void> {
  // every claim at both widths: the phone is the owner's place
  try {
    for (const [result, claim, ok] of atOneViewport(await runUebergabeDom(sourceRoot), 1200, { alsoAt: () => true }))
      check(`uebergabe DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.facts));
  } catch (error) {
    probeFailed("uebergabe DOM", error);
  }
}

// --- from e2e/leiste.ts: the left bar (auftraege/leiste-aufraeumen.md, Mangel 126) and its mutants. Every claim at every
// width it is measured at: the fit and the views square are what differs between the desktop, the tablets and the phone.
async function leisteDom(sourceRoot: string): Promise<void> {
  try {
    for (const [result, claim, ok] of atOneViewport(await runLeisteDom(sourceRoot), 1440, { alsoAt: () => true }))
      check(`leiste DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.facts));
  } catch (error) {
    probeFailed("leiste DOM", error);
  }
}

// --- e2e/k15-start.ts: a start from the window „Neue Session“ against THIS instance (K15 Runde 5): a free place opens it, the start
// gives a session with the chosen repo, agent, model and effort. Like the rights rig it opens a lane on FLEET_E2E_REPO and removes it.
async function k15StartDom(sourceRoot: string): Promise<void> {
  // PER ROLE, behind a fixture origin: which door, which body, which sentence (what the old start window's rig checked)
  try {
    for (const [result, claim, ok] of atOneViewport(await runK15StartDom(sourceRoot), 1200))
      check(`k15 start DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.facts));
  } catch (error) {
    probeFailed("k15 start DOM (fixture)", error);
  }
  // AGAINST THIS INSTANCE: the start gives a session with the chosen repo, agent, model and effort
  try {
    const r = await runK15StartLiveDom({ base: BASE, token: TOKEN, repo: REPO, sourceRoot });
    for (const [claim, ok] of Object.entries(r.claims)) check(`k15 start DOM: ${claim}`, ok, JSON.stringify(r.facts));
  } catch (error) {
    probeFailed("k15 start DOM", error);
  }
}

// --- from e2e/konstellation.ts: the constellation window (K16 E2b) and its mutants. One viewport for what reads
// the same (1200); the build, the fit, the click and a tag's reason at both widths; the calm line and the small card under the pointer
// are desktop claims, the two taps a phone claim.
async function konstellationDom(sourceRoot: string): Promise<void> {
  try {
    for (const [result, claim, ok] of atOneViewport(await runKonstellationDom(sourceRoot), 1200,
      { alsoAt: (c) => c === KONST_CLAIM.aufbau || c === KONST_CLAIM.fit || c === KONST_CLAIM.click || c === KONST_CLAIM.grund || c === KONST_CLAIM.phone }))
      check(`konstellation DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.facts));
  } catch (error) {
    probeFailed("konstellation DOM", error);
  }
}

async function dropsDom(sourceRoot: string): Promise<void> {
  // --- the chat view's pictures, in a real browser against fixtures (no slot, no live drop). A
  // browser that cannot run is the PROBE line — red, never a skip.
  try {
    // one viewport for what reads the same (e897fa95): 1200; each width keeps its own picture size
    for (const [result, claim, ok] of atOneViewport(await runDropChatDom(sourceRoot), 1200))
      check(`drop chat DOM ${result.width}x${result.height}: ${claim}`, ok, JSON.stringify(result.facts));
  } catch (error) {
    probeFailed("drop chat DOM", error);
  }
}

// --- from e2e/timeline-ui.ts: the session timeline lens and its mutants
async function timelineDom(sourceRoot: string): Promise<void> {
  try {
    for (const result of await runTimelineDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`timeline DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("timeline DOM", error);
    return;
  }
}

// --- from e2e/slots.ts: the Activity window's type (G0.3) and its loading states, and their mutants
async function activityDom(sourceRoot: string): Promise<void> {
  try {
    for (const result of await runActivityDom(sourceRoot)) {
      const facts = JSON.stringify(result.facts);
      for (const [claim, ok] of Object.entries(result.claims))
        check(`activity DOM ${result.width}x${result.height}: ${claim}`, ok, facts);
    }
  } catch (error) {
    probeFailed("activity DOM", error);
    return;
  }
}

// THE MUTANTS, IN SLICES (docs/neuaufbau/maengel.md, Mangel 147). Until 2026-10-24 every mutant ran
// inside its rig's function above, so the whole mutant mode was the ONE unit `dom`, weighed at the
// 1 092 s of a run without it. The nightly therefore put it on shard 1 alone, and shard 1 grew from
// 24 min (15.10.) to 54 min (19.10.); from 20.10. on it lapsed every night at the 60-min claim window,
// its verdict `unknown` and the mutants unmeasured. Now the mutants are the units dom-mutants-1 … -n
// (e2e/ctx.ts#DOM_MUTANT_SLICES), which exist only in the mutant mode, and slice k runs every n-th
// mutant of EACH family, starting at the k-th. A family that grows (k15 start: 1 412 s on 19.10.,
// 2 797 s on 24.10.) grows every slice alike, so no table weight has to follow it. The
// check lines are the ones the rigs had; each slice says its PROBE in one line of its own.
export async function runMutants(k: number, n: number): Promise<void> {
  if (!DOM_MUTANTS) return;
  const sourceRoot = dirname(realpathSync(`${ROOT}/node_modules`));
  probeFailures = [];
  const mine = <T>(family: readonly T[]): T[] => mutantSlice(family, k, n);
  for (const m of mine(KEEP_MUTANTS)) {
    try {
      const hit = (await runComposerKeepDom(sourceRoot, { mutate: m })).flatMap((r) => Object.entries(r.claims)).filter(([c]) => c.includes(m.claim));
      check(`composer keep DOM MUTATION — ${m.name}: "${m.claim}…" turns red`, hit.length > 0 && hit.every(([, ok]) => !ok), JSON.stringify(hit).slice(0, 600));
    } catch (error) {
      probeFailed(`composer keep DOM MUTATION — ${m.name}`, error);
    }
  }
  await arbeitsorteMutants(sourceRoot, mine(ARBEITSORTE_MUTANTS));
  for (const m of mine(STRIP_MUTANTS)) {
    try {
      const hit = (await runStripDom(sourceRoot, { mutate: m })).flatMap((r) => Object.entries(r.claims)).filter(([c]) => m.claims.some((x) => c.includes(x)));
      check(`strip DOM MUTATION — ${m.name}: ${m.claims.map((x) => `"${x}…"`).join(" and ")} turn${m.claims.length === 1 ? "s" : ""} red`,
        m.claims.every((x) => hit.some(([c]) => c.includes(x))) && hit.every(([, ok]) => !ok), JSON.stringify(hit).slice(0, 600));
    } catch (error) {
      probeFailed(`strip DOM MUTATION — ${m.name}`, error);
    }
  }
  // every mutant must turn its claim red at its one viewport (1200×900 unless it is a phone claim) —
  // a needle that left the source fails as the probe
  for (const m of mine(TIMELINE_MUTANTS)) {
    try {
      const hit = (await runTimelineDom(sourceRoot, undefined, { widths: [m.width ?? 1200], mutate: m }))[0];
      check(`timeline DOM mutant: ${m.name} turns red: ${m.claim.slice(0, 60)}`, hit?.claims[m.claim] === false,
        JSON.stringify(hit?.facts ?? null).slice(0, 600));
    } catch (error) {
      probeFailed(`timeline DOM mutant — ${m.name}`, error);
    }
  }
  // every mutant must turn its claim red at 1200×900 — a needle that left the source fails as the probe
  for (const m of mine(ACTIVITY_MUTANTS)) {
    try {
      const hit = (await runActivityDom(sourceRoot, undefined, { widths: [1200], mutate: m }))[0];
      check(`activity DOM mutant: ${m.name} turns red: ${m.claim.slice(0, 60)}`, hit?.claims[m.claim] === false,
        JSON.stringify(hit?.facts ?? null).slice(0, 600));
    } catch (error) {
      probeFailed(`activity DOM mutant — ${m.name}`, error);
    }
  }
  for (const m of mine(KONST_MUTANTS)) {
    try {
      const hit = (await runKonstellationDom(sourceRoot, undefined, { widths: [m.width ?? 1200], mutate: m }))[0];
      check(`konstellation DOM mutant: ${m.name} turns red: ${m.claim.slice(0, 60)}`, hit?.claims[m.claim] === false,
        JSON.stringify(hit?.facts ?? null).slice(0, 600));
    } catch (error) {
      probeFailed(`konstellation DOM mutant — ${m.name}`, error);
    }
  }
  for (const m of mine(UEB_MUTANTS)) {
    try {
      const hit = (await runUebergabeDom(sourceRoot, undefined, { widths: [m.width ?? 1200], mutate: m }))[0];
      check(`uebergabe DOM mutant: ${m.name} turns red: ${m.claim.slice(0, 60)}`, hit?.claims[m.claim] === false,
        JSON.stringify(hit?.facts ?? null).slice(0, 600));
    } catch (error) {
      probeFailed(`uebergabe DOM mutant — ${m.name}`, error);
    }
  }
  for (const m of mine(LEISTE_MUTANTS)) {
    try {
      const hit = (await runLeisteDom(sourceRoot, undefined, { widths: [m.width ?? 1440], mutate: m }))[0];
      check(`leiste DOM mutant: ${m.name} turns red: ${m.claim.slice(0, 60)}`, hit?.claims[m.claim] === false,
        JSON.stringify(hit?.facts ?? null).slice(0, 600));
    } catch (error) {
      probeFailed(`leiste DOM mutant — ${m.name}`, error);
    }
  }
  for (const m of mine(K15_START_MUTANTS)) {
    try {
      const hit = (await runK15StartDom(sourceRoot, undefined, { widths: [m.width ?? 1200], mutate: m }))[0];
      check(`k15 start DOM mutant: ${m.name} turns red: ${m.claim.slice(0, 60)}`, hit?.claims[m.claim] === false, JSON.stringify(hit?.facts ?? null).slice(0, 600));
    } catch (error) {
      probeFailed(`k15 start DOM mutant — ${m.name}`, error);
    }
  }
  for (const m of mine(K15_START_LIVE_MUTANTS)) {
    try {
      const r = await runK15StartLiveDom({ base: BASE, token: TOKEN, repo: REPO, sourceRoot, mutate: m });
      check(`k15 start DOM mutant: ${m.name} turns red: ${m.claim}`, r.claims[m.claim] === false, JSON.stringify(r.facts).slice(0, 600));
    } catch (error) {
      probeFailed(`k15 start DOM mutant — ${m.name}`, error);
    }
  }
  check(`dom mutants ${k}/${n} — PROBE: Chromium starts and loads the client bundle for every mutant of this slice`,
    probeFailures.length === 0, probeFailures.join(" · "));
}

// The Arbeitsorte's mutants share ONE Chromium, each in a browser context of its own, and a mutant's
// walk stops once its own claims have their verdicts (`until`, e2e/slots.ts#ArbeitsorteVerdictsIn).
// The claim keys come from an unmutated walk over exactly the states and widths this slice's mutants
// need, because the walk of the base run may sit on another shard. A shared browser that cannot start
// is a red PROBE line, and every mutant then starts its own as before: never a skip.
async function arbeitsorteMutants(sourceRoot: string, mutants: typeof ARBEITSORTE_MUTANTS): Promise<void> {
  if (!mutants.length) return;
  const mutantProfile = mkdtempSync(resolve(tmpdir(), "fleet-arbeitsorte-mutants-"));
  let mutantBrowser: ArbeitsorteBrowser | undefined;
  try {
    mutantBrowser = await startArbeitsorteBrowser(`${mutantProfile}/profile`);
  } catch (error) {
    probeFailed("arbeitsorte DOM MUTATION", error);
  }
  let unmutated: ArbeitsorteDomResult[] = [];
  try {
    unmutated = await runArbeitsorteDom(sourceRoot, undefined, { states: [...new Set(mutants.map((m) => m.state))],
      widths: [...new Set(mutants.map((m) => m.width ?? 390))], browser: mutantBrowser });
  } catch (error) {
    probeFailed("arbeitsorte DOM MUTATION — the unmutated walk", error);
  }
  for (const m of mutants) {
    try {
      const names = typeof m.claim === "string" ? [m.claim] : m.claim;
      const width = m.width ?? 390;
      const until = Object.keys(unmutated.find((r) => r.state === m.state && r.width === width)?.claims ?? {}).filter((c) => names.some((n) => c.includes(n)));
      const runs = await runArbeitsorteDom(sourceRoot, undefined, { states: [m.state], widths: [width], mutate: m, browser: mutantBrowser, until })
        .catch((error: unknown) => { if (error instanceof ArbeitsorteVerdictsIn) return [error.result]; throw error; });
      const hit = runs.flatMap((r) => Object.entries(r.claims)).filter(([c]) => names.some((n) => c.includes(n)));
      check(`arbeitsorte DOM MUTATION — ${m.name}: "${names.join('…" · "')}…" turns red`,
        names.every((n) => hit.some(([c]) => c.includes(n))) && hit.every(([, ok]) => !ok), JSON.stringify(hit).slice(0, 600));
    } catch (error) {
      probeFailed(`arbeitsorte DOM MUTATION — ${m.name}`, error);
    }
  }
  await mutantBrowser?.close();
  rmSync(mutantProfile, { recursive: true, force: true });
}
