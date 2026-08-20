// capability-map.ts — the executable source for Fleet's smallest capability vocabulary.
//
// Run `bun capability-map.ts` to render docs/system-capabilities.generated.md. The renderer is pure;
// only this executable edge writes. e2e/pins.ts calls the same renderer and holds the checked-in
// document byte-for-byte against this source and every named HTTP adapter against server.ts.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CAPABILITY_FUNCTIONS,
  type CapabilityAdapter,
  type CapabilityAdapterProbeDataset,
  type CapabilityDimensionGap,
  type QuestionRoute,
  type SystemCapability,
} from "./src/protocol";

const SELF_FIELDS = [
  "slot", "label", "cwd", "mission", "awaiting", "lane", "idleMs", "observed",
  "autos", "watches", "events",
] as const;

const SELF_ADAPTER = {
  route: "/api/self",
  method: "GET",
  credential: "header x-fleet-self-token",
  roleCondition: "any current session with cwd",
} as const satisfies CapabilityAdapter;

export const SYSTEM_CAPABILITIES = [
  {
    name: "describe_self",
    summary: "Read the identity facts the current Self API actually exposes.",
    roles: ["session"],
    authority: "Read only the authenticated session's own slot row, schedules, watches, and events.",
    stateEffect: "none",
    adapter: SELF_ADAPTER,
    returns: SELF_FIELDS,
    probe: {
      kind: "http",
      assertion: "With the current session's self token, the adapter returns HTTP 200 and every declared field.",
    },
    gaps: [
      "Role is not returned today.",
      "Authority is not returned today.",
      "Capabilities are not returned today.",
      "The active Act is not returned today.",
    ],
  },
  {
    name: "get_project_context",
    summary: "Read authoritative project sources and selectable context packs.",
    roles: ["program-main"],
    authority: "Read project context only; no project, Program, Act, or repository state may change.",
    stateEffect: "none",
    adapter: null,
    returns: [],
    probe: {
      kind: "absence",
      assertion: "The adapter is null and every HTTP-shaped gap is explicitly marked as a rejected neighbor.",
    },
    gaps: [
      "No adapter delivers authoritative project sources and selectable packs today.",
      "Rejected neighbor: GET /api/self/programs returns Program content, not authoritative project sources or selectable packs.",
      "Rejected neighbor: GET /api/self/program-execution returns execution state, not authoritative project sources or selectable packs.",
    ],
  },
] as const satisfies readonly SystemCapability[];

export const SELF_GET_ADAPTER_PROBE = {
  id: "self_get_adapter_probe",
  summary: "The safe raw Self GET a foreign MAIN can use before deeper discovery.",
  roles: ["session"],
  authority: "Read only the authenticated session's own slot row, schedules, watches, and events.",
  stateEffect: "none",
  adapter: SELF_ADAPTER,
  returns: SELF_FIELDS,
  probe: {
    kind: "http",
    assertion: "With the current session's self token, the adapter returns HTTP 200 and every declared field.",
  },
  gaps: [],
} as const satisfies CapabilityAdapterProbeDataset;

export const UNMODELED_CAPABILITY_DIMENSIONS = [
  { dimension: "uiGesture", gap: "UI gesture is not modeled in this first role/API/question slice." },
  { dimension: "traceEffect", gap: "Trace effect is not modeled in this first role/API/question slice." },
  { dimension: "harnessSupport", gap: "Harness support is not modeled in this first role/API/question slice." },
] as const satisfies readonly CapabilityDimensionGap[];

export const QUESTION_ROUTES = [
  {
    role: "lane",
    recipient: "Program-MAIN selected by the server and returned in request.receiver",
    adapter: {
      route: "/api/self/clarifications",
      method: "POST",
      credential: "header x-fleet-self-token",
      roleCondition: "lane only",
    },
    constraints: [
      "Body carries question only; the caller does not choose the receiver.",
      "Question length is at most 2000 characters.",
      "Exactly one clarification may be open per worker.",
    ],
    gaps: [],
  },
  {
    role: "lane",
    recipient: "Program-MAIN selected by the server and returned in report.receiver",
    adapter: {
      route: "/api/self/fleet-report",
      method: "POST",
      credential: "header x-fleet-self-token",
      roleCondition: "lane only",
    },
    constraints: [
      "Body carries only a closed complete | needs-main | failed status and length-capped text; the caller does not choose the receiver.",
      "The report is declarative: no land, dispatch, auto, Watch, or tick path gates on its status.",
    ],
    gaps: [],
  },
  {
    role: "program-main",
    recipient: "owner",
    adapter: {
      route: "/api/self/attention",
      method: "POST",
      credential: "header x-fleet-self-token",
      roleCondition: "non-lane current bound MAIN of an active Program",
    },
    constraints: [
      "programId is derived from the caller's current Program binding, never from the body.",
      "taskId, originId, branch, and candidateSha are caller-declared and form-validated only; nothing routes or gates on them.",
    ],
    gaps: [],
  },
  {
    role: "supervisor",
    recipient: "unsupported",
    adapter: null,
    constraints: [],
    gaps: ["No owner question adapter exists for this role today; the attention transport requires a current bound MAIN of an active Program."],
  },
  {
    role: "other-session",
    recipient: "unsupported",
    adapter: null,
    constraints: [],
    gaps: ["No question adapter is declared for other session roles today."],
  },
] as const satisfies readonly QuestionRoute[];

const inline = (items: readonly string[]): string => items.length ? items.map((item) => `\`${item}\``).join(", ") : "none";
const bullets = (items: readonly string[]): string => items.length
  ? items.map((item) => `- ${item}`).join("\n")
  : "- none";

export function renderSystemCapabilities(): string {
  const out = [
    "# Fleet system capabilities",
    "",
    "<!-- Generated by `bun capability-map.ts`; do not edit by hand. -->",
    "",
    "This is the current executable capability truth. An adapter of `unsupported` is a measured absence, not an empty result.",
    "",
    "Source symbols: `capability-map.ts#SYSTEM_CAPABILITIES`, `capability-map.ts#SELF_GET_ADAPTER_PROBE`, `capability-map.ts#QUESTION_ROUTES`, `capability-map.ts#UNMODELED_CAPABILITY_DIMENSIONS`, `src/protocol.ts#SystemCapability`, `src/protocol.ts#CapabilityAdapter`.",
    "",
    "## Stable functions",
  ];

  for (const capability of SYSTEM_CAPABILITIES) {
    const adapter = capability.adapter;
    out.push(
      "",
      `### \`${capability.name}\``,
      "",
      capability.summary,
      "",
      `- Roles: ${inline(capability.roles)}`,
      `- Authority: ${capability.authority}`,
      `- State effect: \`${capability.stateEffect}\``,
      `- Adapter: ${adapter ? `\`${adapter.method} ${adapter.route}\`` : "`unsupported`"}`,
      `- Credential: ${adapter ? `\`${adapter.credential}\`` : "none"}`,
      `- Role condition: ${adapter ? adapter.roleCondition : "none; no adapter exists"}`,
      `- Returns: ${inline(capability.returns)}`,
      `- Probe (${capability.probe.kind}): ${capability.probe.assertion}`,
      "",
      "Gaps:",
      "",
      bullets(capability.gaps),
    );
  }

  const selfGet = SELF_GET_ADAPTER_PROBE;
  out.push(
    "",
    "## Current adapter/probe datasets",
    "",
    "These are executable transport facts, not additional stable functions.",
    "",
    `### \`${selfGet.id}\``,
    "",
    selfGet.summary,
    "",
    `- Roles: ${inline(selfGet.roles)}`,
    `- Authority: ${selfGet.authority}`,
    `- State effect: \`${selfGet.stateEffect}\``,
    `- Adapter: \`${selfGet.adapter.method} ${selfGet.adapter.route}\``,
    `- Credential: \`${selfGet.adapter.credential}\``,
    `- Role condition: ${selfGet.adapter.roleCondition}`,
    `- Returns: ${inline(selfGet.returns)}`,
    `- Probe (${selfGet.probe.kind}): ${selfGet.probe.assertion}`,
    "",
    "Gaps:",
    "",
    bullets(selfGet.gaps),
  );

  out.push(
    "",
    "## Current question return path",
    "",
    "These transports describe today's role policy; they are not additional stable functions.",
  );
  for (const route of QUESTION_ROUTES) {
    out.push(
      "",
      `### ${route.role}`,
      "",
      `- Recipient: ${route.recipient}`,
      `- Adapter: ${route.adapter ? `\`${route.adapter.method} ${route.adapter.route}\`` : "`unsupported`"}`,
      `- Credential: ${route.adapter ? `\`${route.adapter.credential}\`` : "none"}`,
      `- Role condition: ${route.adapter ? route.adapter.roleCondition : "none; no adapter exists"}`,
      "- Constraints:",
      bullets(route.constraints),
      "- Gaps:",
      bullets(route.gaps),
    );
  }

  out.push(
    "",
    "## Dimensions not yet modeled",
    "",
    "This first slice delivers role, API adapter/probe, and question-return facts only.",
    "",
    ...UNMODELED_CAPABILITY_DIMENSIONS.map((dimension) => `- \`${dimension.dimension}\`: ${dimension.gap}`),
  );

  out.push("", `Declared stable functions: ${CAPABILITY_FUNCTIONS.map((name) => `\`${name}\``).join(", ")}.`, "");
  return out.join("\n");
}

if (import.meta.main) {
  writeFileSync(resolve(import.meta.dir, "docs/system-capabilities.generated.md"), renderSystemCapabilities());
}
