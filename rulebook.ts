// HOW TO CHANGE A RULE, now that CLAUDE.md is a GENERAT: edit the FRAGMENT, then re-render. A hand
// edit to CLAUDE.md is lost at the next render and reds e2e/pins.ts section 6b in the meantime, so
// the recipe belongs next to the module the failing rule names. From the main checkout root:
//
//   bun -e 'import{RULEBOOK_FRAGMENTS as F,RULEBOOK_DIR as d,fragmentFileName as n,renderRulebook as r}from"./rulebook";import{readFileSync as R,writeFileSync as W}from"node:fs";W("CLAUDE.md",r("voll",new Map(F.map(f=>[f,R(`${d}/${n(f)}`,"utf8")]))))'
//
// It is idempotent: run against an untouched rulebook/ it rewrites the same bytes.
//
// The rulebook is seven fragments, not one file. This module is the pure half of that split: it
// owns the fragment vocabulary, who gets which fragments, and the assembly order — and it reads
// NOTHING. Contents are handed in, the way context-plan.ts and verify-proportion.ts are built,
// because the caller is the only side that knows which checkout it is allowed to read.
//
// The assembly is byte-exact by construction: `renderRulebook("voll", …)` of the seven fragments
// reproduces CLAUDE.md, so a split that lost or reordered a rule cannot pass. That equality is the
// whole reason the fragments may be believed at all, and e2e/pins.ts fastens it.

import type { ContextPositionVariante } from "./context-packs";

/** Who a rendered rulebook is FOR. A lane is briefed for one slice of work; a MAIN session steers. */
export const RULEBOOK_AUDIENCES = ["lane", "main", "orchestrator", "voll"] as const;
export type RulebookAudience = (typeof RULEBOOK_AUDIENCES)[number];

/** The seven fragments, in the order they are assembled. The order IS the contract. */
export const RULEBOOK_FRAGMENTS = [
  "loader",
  "einstieg",
  "lane-discipline",
  "supervisor",
  "self-scheduling",
  "deploy",
  "graphify",
] as const;
export type RulebookFragment = (typeof RULEBOOK_FRAGMENTS)[number];

/**
 * PARTITION, never overlap: a rule lives in exactly one fragment. Two fragments carrying the same
 * rule would give the loader contract a second contradiction surface — the one thing it is written
 * to stop work over.
 */
export const FRAGMENTS_FOR: Record<RulebookAudience, readonly RulebookFragment[]> = {
  lane: ["loader", "lane-discipline", "self-scheduling"],
  // main and orchestrator: the fragments their render draws ANY section from. Which sections, and
  // the anchors for the rest, is ROLE_SECTION_CUT below — renderRoleRulebook, not renderRulebook.
  main: ["loader", "einstieg", "lane-discipline", "self-scheduling", "deploy"],
  orchestrator: ["loader", "einstieg", "self-scheduling", "deploy"],
  voll: [...RULEBOOK_FRAGMENTS],
};

/** The id prefix of the meaning probe IS the fragment — no per-rule judgement is involved. */
export const FRAGMENT_BY_RULE_PREFIX: Record<string, RulebookFragment> = {
  L: "loader",
  E: "einstieg",
  D: "lane-discipline",
  S: "supervisor",
  F: "self-scheduling",
  P: "deploy",
  G: "graphify",
};

/** Directory of the fragment files, relative to a checkout root. Gitignored, like CLAUDE.md itself. */
export const RULEBOOK_DIR = "rulebook";
export const fragmentFileName = (f: RulebookFragment): string => `${f}.md`;

// The document title, and the only line no fragment owns.
export const RULEBOOK_PREAMBLE = "# claude-fleet\n";

/**
 * Assemble the fragments for one audience. Throws on a missing or empty fragment rather than
 * rendering a rulebook with a hole in it — a short rulebook reads exactly like a complete one.
 */
export function renderRulebook(
  audience: RulebookAudience,
  contents: ReadonlyMap<RulebookFragment, string>,
): string {
  let out = RULEBOOK_PREAMBLE;
  for (const f of FRAGMENTS_FOR[audience]) {
    const body = contents.get(f);
    if (body === undefined || body.trim() === "") throw new Error(`rulebook fragment missing or empty: ${f}`);
    // one blank line between sections, exactly one trailing newline per fragment
    out += `\n${body.replace(/\n+$/, "")}\n`;
  }
  return out;
}

/**
 * The human name of each fragment, for the back-reference block a lane's rulebook ends with. A
 * lane that does not know a Deploy part EXISTS cannot ask for it — that is the one way this split
 * does real damage, so the omitted parts are named rather than silently absent.
 */
export const FRAGMENT_TITLES: Record<RulebookFragment, string> = {
  loader: "Loader-Vertrag",
  einstieg: "Einstieg",
  "lane-discipline": "Lane discipline",
  supervisor: "Supervisor-Rolle",
  "self-scheduling": "Self-scheduling",
  deploy: "Deploy",
  graphify: "graphify",
};

const ROLE_POINTER_TRIGGERS: Record<RulebookFragment, string> = {
  loader: "wenn eine Regel einer anderen widerspricht",
  einstieg: "beim Antritt einer MAIN",
  "lane-discipline": "bevor du selbst eine Suite faehrst, eine Lane-Tuer rufst oder einen roten Check beurteilst",
  supervisor: "bevor du Modell/Effort eines lebenden Slots setzt oder einen fremden Composer leerst",
  "self-scheduling": "bevor du dich selbst terminierst",
  deploy: "vor POST /api/deploy, kill-session -t srv, launchctl, einem Audit-Urteil oder einer Harness-/Modellnamen-Aenderung",
  graphify: "vor graphify query/update",
};

// --- THE ROLE CUT: sections, not fragments ------------------------------------------------------
// Whole fragments are too coarse for a MAIN or the orchestrator: `einstieg` (33 KB on 2026-10-06)
// and `deploy` (23 KB) each mix what a role needs at every start with what it needs once a week.
// So a role render is cut one level lower, at the SECTION — a top-level bullet of a fragment with
// everything wrapped or indented under it, or the prose before a fragment's first bullet. The
// fragments carry no sub-headings; the bullet IS the unit their authors wrote a rule as.
//
// Two properties make that cut safe to believe, and the pins hold both:
// (1) PARTITION. Heading plus sections concatenated reproduce a fragment byte for byte, so cutting
//     cannot lose or reword a rule — it can only leave one out of a render.
// (2) EVERY OMISSION IS AN ANCHOR. A role render ends with a block naming each section it does not
//     carry (or the whole fragment, where none of it is carried) and a file holding exactly those
//     bytes. A role that does not know a rule EXISTS cannot ask for it; a named anchor it can.

/** One cut unit of a fragment. `anchor` is the file name (without `.md`) the omitted copy is read from. */
export interface RulebookSection {
  readonly fragment: RulebookFragment;
  readonly slug: string;
  readonly anchor: string;
  readonly title: string;
  readonly text: string;
}

const ANCHOR_TITLE_MAX = 52;

function sectionTitle(text: string): string {
  const flat = text.replace(/\s+/g, " ").replace(/^- /, "").trim();
  const bold = /^\*\*(.+?)\*\*/.exec(flat);
  const t = (bold ? bold[1] : flat).replace(/\*\*/g, "").replace(/[:.]$/, "").trim();
  return t.length <= ANCHOR_TITLE_MAX ? t : `${t.slice(0, ANCHOR_TITLE_MAX - 1).trimEnd()}…`;
}

function sectionSlug(title: string): string {
  const words = title.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? [];
  return words.slice(0, 5).join("-") || "abschnitt";
}

/**
 * Split one fragment into its heading and its sections. Pure; the heading is the leading `## `
 * lines plus the blank lines after them, and is never a section of its own — it travels with
 * whatever part of the fragment a render carries. Slugs are unique within a fragment (`-2`, `-3`).
 */
export function fragmentSections(fragment: RulebookFragment, text: string): { head: string; sections: RulebookSection[] } {
  const lines = text.split(/(?<=\n)/);
  let i = 0;
  while (i < lines.length && lines[i]!.startsWith("## ")) i++;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  const head = lines.slice(0, i).join("");
  const chunks: string[] = [];
  let cur = "";
  for (const l of lines.slice(i)) {
    if (l.startsWith("- ") && cur !== "") { chunks.push(cur); cur = ""; }
    cur += l;
  }
  if (cur !== "") chunks.push(cur);
  const seen = new Map<string, number>();
  const sections = chunks.map((chunk) => {
    const title = sectionTitle(chunk);
    const base = sectionSlug(title);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const slug = n === 1 ? base : `${base}-${n}`;
    return { fragment, slug, anchor: `${fragment}--${slug}`, title, text: chunk };
  });
  return { head, sections };
}

/** What a role carries of one fragment: all of it, none of it, or all but the named section slugs. */
export type FragmentCut = "ganz" | "aus" | { readonly ohne: readonly string[] };
export type RoleAudience = "main" | "orchestrator";
/** A section cut is a role's, or a position VARIANT's: the variant name is the pack model's own
 *  (context-packs.ts#CONTEXT_POSITION_VARIANTEN), never a further rulebook audience. */
export type SectionCutKey = RoleAudience | ContextPositionVariante;

/**
 * The role cut, by OMISSION LIST and never by keep-list, on purpose: a section whose lead words
 * change gets a new slug, and with an omission list that section is then DELIVERED (the render
 * grows, the size pin says so) instead of silently dropping out of the role's start. The failure
 * this direction buys is a few hundred bytes too many, never a rule too few.
 *
 * orchestrator: steers MAINs, judges their reports, chooses models, deploys, talks to the owner.
 *   It does not drive lanes, brief workers or run suites — that is the MAIN's work, and the
 *   sections about it are anchors here.
 * main: everything a Program-MAIN did get (loader, einstieg, lane-discipline, self-scheduling)
 *   minus the lane-only doors it answers 409 on and the orchestrator-only Astra rule, plus the
 *   three audit/verify sections of `deploy` that note 4a33d84a requires before the cut goes live
 *   (docs/messungen/2026-09-27-regelbuch-je-rolle.md §2: 1 395 tokens a MAIN reads in deploy).
 * Both: the Codex/GPT/pi worker sections are anchors, read when a non-Claude lane is briefed —
 *   Codex is paused since 95709148 (docs/messungen/2026-10-10-kontext-bestandteile.md F6, A.2).
 */
export const ROLE_SECTION_CUT: Record<SectionCutKey, Record<RulebookFragment, FragmentCut>> = {
  orchestrator: {
    loader: "ganz",
    einstieg: { ohne: [
      "idle-heisst-nicht-fertig-vier", "die-regel-darueber-sagt-wie", "der-land-takt-seriell-ja",
      "git-checkout-datei-im-lane", "und-ein-schmutziger-haupt-checkout", "pruefe-das-trotzdem-vor-einem",
      "wenn-du-eine-gpt-lane", "eine-lane-muss-nicht-claude", "codex-dispatch-wartet-auf-readiness",
      "codex-tui-sub-agent-ansicht", "steward-konvention-der-slot-mit",
      "kontingent-umstellung-teilweise-aufgehoben-owner", "codex-kontingent-sinnvoll-verbrauchen-astra",
      "post-api-self-tasks-id", "zwei-scope-regeln-entgegengesetzt-und", "nicht-lane-only",
      "doc-kollision-lane-haupt-checkout",
    ] },
    "lane-discipline": "aus",
    supervisor: "aus",
    "self-scheduling": "ganz",
    deploy: { ohne: [
      "deploy-von-server-ts-client", "der-oeffentliche-main-und-die", "health-check-nach-deploy-curl",
      "der-verify-gate-ist-dreiwertig",
      "land-pfad-flags-in-watchdog", "fleet-lane-autoclose-der-automatische",
      "stand-2026-09-06-scharf", "und-die-env-probe-dazu", "full-access-ist-der-normalzustand",
      "lese-reichweite-provider-reichweite-und", "eine-fixture-fuer-ein-ausfuehrbares",
      "agenten-tool-scoping-allowedtools-ist", "ein-cast-auf-eine-netz",
      "die-gast-konsole-ist-entfernt", "ein-share-hat-keinen-modus", "auto-3-der-reviewer-laeuft",
      "modell-tiers-default-model-sessions", "der-worker-eines-repos-wird",
      "harness-adapter-fleet-cmd-muss", "get-api-sessions-traegt-pro",
      "modellnamen-mit-suffix-die-1m", "launchd-kontext-hat-weder-local",
    ] },
    graphify: "aus",
  },
  main: {
    loader: "ganz",
    einstieg: { ohne: [
      "codex-kontingent-sinnvoll-verbrauchen-astra", "steward-konvention-der-slot-mit",
      "kontingent-umstellung-teilweise-aufgehoben-owner", "wenn-du-eine-gpt-lane", "eine-lane-muss-nicht-claude",
      "codex-dispatch-wartet-auf-readiness", "codex-tui-sub-agent-ansicht",
    ] },
    "lane-discipline": { ohne: [
      "suite-offer", "vor-dem-done-report-drift", "was-dich-wirklich-gated-ist", "bist-du-eine-clarify-lane",
      "report-only-the-slice-summary", "claude-md-ist-gitignored-und", "dein-docs-regal-ist-ein",
      "set-the-done-criterion-its", "review-sweep-ts-ist-die", "die-suiten-leiten-sock-port",
      "e2e-claude-gate-sh-hat", "fleet-e2e-ts-is-a",
    ] },
    supervisor: "aus",
    "self-scheduling": "ganz",
    deploy: { ohne: [
      "deploy-von-server-ts-client", "das-repo-ist-seit-2026", "der-oeffentliche-main-und-die",
      "health-check-nach-deploy-curl", "land-pfad-flags-in-watchdog",
      "fleet-lane-autoclose-der-automatische", "stand-2026-09-06-scharf",
      "und-die-env-probe-dazu", "full-access-ist-der-normalzustand", "lese-reichweite-provider-reichweite-und",
      "eine-fixture-fuer-ein-ausfuehrbares", "agenten-tool-scoping-allowedtools-ist",
      "stufe-2-der-post-land", "ein-cast-auf-eine-netz", "ein-deploy-setzt-die-idle",
      "deploy-laeuft-ueber-verb-2", "die-gast-konsole-ist-entfernt", "ein-share-hat-keinen-modus",
      "der-dispatcher-ist-an-startet", "auto-3-der-reviewer-laeuft", "modell-tiers-default-model-sessions",
      "der-worker-eines-repos-wird", "harness-adapter-fleet-cmd-muss", "get-api-sessions-traegt-pro",
      "modellnamen-mit-suffix-die-1m", "launchd-kontext-hat-weder-local",
    ] },
    graphify: "aus",
  },
  // live-bau (card 1f9834a9, docs/design/live-bau-profil-2026-10.md §2.1): the LANE render — its
  // three fragments — minus the 15 verify, suite and land sections, 8 172 B on 2026-10-09. They are
  // anchors of the render's closing block and come back before the land, when the lane borrows
  // verify-e2e; what holds while building beside a test instance (live server, name-pattern kills,
  // token hygiene, the worktree boundary, keep the lane landable, the done sentence) stays in.
  "live-bau": {
    loader: "ganz",
    einstieg: "aus",
    "lane-discipline": { ohne: [
      "proportionale-lokale-verifikation", "suite-offer", "review-sweep-ts-ist-die", "verify-kette",
      "e2e-isolated-sh-ist-tier", "vor-dem-done-report-drift", "was-dich-wirklich-gated-ist",
      "bist-du-eine-clarify-lane", "report-only-the-slice-summary", "ein-roter-check-ist-deiner",
      "eine-lane-kann-ihre-eigenen", "bekannte-flake-familien-stehen-in", "suite-mutex",
      "die-suiten-leiten-sock-port", "e2e-claude-gate-sh-hat",
    ] },
    supervisor: "aus",
    "self-scheduling": "ganz",
    deploy: "aus",
    graphify: "aus",
  },
};

export interface RoleRulebook {
  /** The CLAUDE.md a role session loads: carried sections, then the anchor block. */
  readonly text: string;
  /** Anchor file name (with `.md`) → its exact bytes; the caller writes them into `anchorDir`. */
  readonly files: ReadonlyMap<string, string>;
  /** Every section of every fragment, with what this render did with it. */
  readonly sections: readonly (RulebookSection & { readonly carried: boolean; readonly via: string | null })[];
  /** Omission-list entries that name no section of the source: a renamed rule, now carried. */
  readonly staleOmissions: readonly string[];
}

/**
 * Render one role's rulebook. Pure, like the rest of this module: the anchor directory and the
 * source hash are handed in by the caller, which is the side that knows where it may write.
 * Throws on a missing or empty fragment, exactly as `renderRulebook` does.
 */
export function renderRoleRulebook(
  audience: SectionCutKey,
  contents: ReadonlyMap<RulebookFragment, string>,
  o: { repoRoot: string; anchorDir: string; sourceHash: string },
): RoleRulebook {
  const cut = ROLE_SECTION_CUT[audience];
  let out = RULEBOOK_PREAMBLE;
  const files = new Map<string, string>();
  const sections: (RulebookSection & { carried: boolean; via: string | null })[] = [];
  const wholeOut: RulebookFragment[] = [];
  const partOut: RulebookSection[] = [];
  const staleOmissions: string[] = [];
  for (const f of RULEBOOK_FRAGMENTS) {
    const body = contents.get(f);
    if (body === undefined || body.trim() === "") throw new Error(`rulebook fragment missing or empty: ${f}`);
    const { head, sections: secs } = fragmentSections(f, body);
    const c = cut[f];
    const ohne = typeof c === "object" ? new Set(c.ohne) : null;
    if (ohne) for (const slug of ohne) if (!secs.some((s) => s.slug === slug)) staleOmissions.push(`${f}--${slug}`);
    const kept = c === "ganz" ? secs : c === "aus" ? [] : secs.filter((s) => !ohne?.has(s.slug));
    if (kept.length === 0) {
      wholeOut.push(f);
      files.set(`${f}.md`, body);
      for (const s of secs) sections.push({ ...s, carried: false, via: f });
      continue;
    }
    out += `\n${(head + kept.map((s) => s.text).join("")).replace(/\n+$/, "")}\n`;
    for (const s of secs) {
      const carried = kept.includes(s);
      sections.push({ ...s, carried, via: carried ? null : s.anchor });
      if (!carried) { partOut.push(s); files.set(`${s.anchor}.md`, `${s.text.replace(/\n+$/, "")}\n`); }
    }
  }
  const carriedCount = sections.filter((s) => s.carried).length;
  const lines = [
    "",
    RULEBOOK_BACKREF_HEADING,
    "",
    `Du hast die ${audience.toUpperCase()}-Fassung: ${carriedCount} von ${sections.length} Abschnitten. Jeder andere ist ein`,
    "Anker unten — lies ihn, BEVOR du tust, was sein Titel nennt (es ist der Anfang seiner Regel):",
    "",
    `    cat ${o.anchorDir}/<anker>.md`,
    "",
    `Voll-Render, alle sieben Teile: \`cat ${o.repoRoot}/CLAUDE.md\`.`,
    "",
    "Ganze Teile:",
    ...wholeOut.map((f) => `- \`${f}\` — ${FRAGMENT_TITLES[f]}, ${ROLE_POINTER_TRIGGERS[f]}`),
    "",
    "Einzelne Abschnitte:",
    ...partOut.map((s) => `- \`${s.anchor}\` — ${s.title}`),
    "",
    `Erzeugt aus ${RULEBOOK_DIR}/, Quell-Hash ${o.sourceHash} (über alle ${RULEBOOK_FRAGMENTS.length} Fragmente).`,
    "",
  ];
  return { text: out + lines.join("\n"), files, sections, staleOmissions };
}

/**
 * The heading that separates the rendered rules from the back-reference block. It is the SPLIT
 * POINT, not decoration: the block carries a timestamp, so a byte comparison that included it
 * would report drift on every single gate call. Everything before it is the rulebook proper and
 * is compared byte for byte; everything after is provenance.
 */
export const RULEBOOK_BACKREF_HEADING = "## Was in dieser Fassung NICHT steht";
const BACKREF_SEP = `\n${RULEBOOK_BACKREF_HEADING}\n`;

/** The rules half of a rendered rulebook — the part `renderRulebook` produced, block stripped. */
export function rulebookBody(text: string): string {
  const i = text.indexOf(BACKREF_SEP);
  return i < 0 ? text : text.slice(0, i);
}

/**
 * The back-reference block. Pure: the absolute read path is handed in by the caller (the server
 * knows `s.worktree.repo`), never guessed — and `git show main:rulebook/…` is NOT an alternative,
 * the fragments are untracked and a worktree never materialises them.
 */
export function renderBackref(
  audience: RulebookAudience,
  o: { repoRoot: string; at: string; sourceHash: string },
): string {
  const have = FRAGMENTS_FOR[audience];
  const missing = RULEBOOK_FRAGMENTS.filter((f) => !have.includes(f));
  const lines = [
    "",
    RULEBOOK_BACKREF_HEADING,
    "",
    `Du hast die ${audience.toUpperCase()}-Fassung des Regelbuchs — ${have.length} von ${RULEBOOK_FRAGMENTS.length} Teilen.`,
    missing.length === 0
      ? "Nicht enthalten ist nichts: diese Fassung ist vollständig."
      : `Nicht enthalten: ${missing.map((f) => FRAGMENT_TITLES[f]).join(" · ")}.`,
  ];
  if (missing.length > 0) {
    lines.push(
      "",
      "Brauchst du einen davon, lies ihn im Quell-Checkout — die Fragmente sind untracked,",
      "`git show main:rulebook/…` findet sie NIE:",
      "",
      ...missing.map((f) => `    cat ${o.repoRoot}/${RULEBOOK_DIR}/${fragmentFileName(f)}`),
    );
  }
  lines.push(
    "",
    `Erzeugt aus ${RULEBOOK_DIR}/ am ${o.at}, Quell-Hash ${o.sourceHash} (über alle ${RULEBOOK_FRAGMENTS.length} Fragmente).`,
    "Diese Fassung ist ein SNAPSHOT wie die Kopie vor ihr: bewegt sich die Quelle, meldet",
    "`GET /api/self/gate` dir `rulebookDrifted: true` — und dann gilt die Quelle, nicht dein Baum.",
    "",
  );
  return lines.join("\n");
}
