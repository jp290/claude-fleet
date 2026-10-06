import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validateCard, type CardValidationContext } from "../card-extract";
import type { LocalProof } from "../verify-proportion";

const CARD_CONTEXT: CardValidationContext = {
  sourceText: "", trackedPaths: new Set(), symbolIndex: null,
  harnessKnown: () => false, modelKnown: () => false, effortKnown: () => false,
  declares: () => false, rowKnown: () => false,
};
const validate = (verify: string) => validateCard({ ziel: "Regel pruefen", done: "Regel gilt", verify }, CARD_CONTEXT);
const previewGap = (verify: string) => validate(verify).gaps.some((gap) => gap.startsWith("verify: preview not owed"));
const REFUSED = "preview not owed — do not offer it or run it locally; a card VERIFY cannot make it owed";
const REASONS = ["e2e-lifecycle", "suite-wrapper", "merge-land-path", "asserted-contract"];
const REQUIRED = "self-assess preview requires owedReason: e2e-lifecycle, suite-wrapper, merge-land-path, asserted-contract";
interface Answer { error?: string; offer?: { id: string; state: string; modules?: string[] } | null; existing?: boolean; reason?: string }
const bodyOf = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`verify-rules: non-JSON response (${response.status})`); }
};

export function runCardRules(check: (name: string, ok: boolean, detail?: string) => void): void {
  const unconditional = [
    "GET /api/self/gate -> localProof.steps in Reihenfolge nach AGENTS.md Verify; bun install --frozen-lockfile, bun e2e/pins.ts, tsc, bun run build; Gate-Suiten via POST /api/self/jobs; volle Vorschau ueber POST /api/self/suite-offer; je Tail ALL PASS.",
    "GET /api/self/gate -> localProof.steps nach AGENTS.md Verify (install, pins, tsc mit voller Dateiliste, build, gewaehlte clean-review/security/claude-gate ueber jobs), geschuldete ./e2e-isolated.sh-Vorschau ueber suite-offer, literal ALL PASS",
    "GET /api/self/gate -> localProof.steps in Reihenfolge; volle Vorschau ueber POST /api/self/suite-offer",
    "install, pins, tsc, build (AGENTS.md §Verify woertlich), dann Suite-Offer (./e2e-isolated.sh-Vorschau ueber POST /api/self/suite-offer)",
    "AGENTS.md §Verify: volle install→pins→Strict-tsc→build→clean-review→security→claude-gate-Kette unten wortgetreu; danach volle ./e2e-isolated.sh-Preview über suite-offer {} auf exakt demselben Freeze.",
    "./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh && ./e2e-isolated.sh; zuvor install, pins, tsc und build aus AGENTS.md §Verify, unten wortgetreu.",
    "bun e2e/pins.ts; volle Vorschau", "bun e2e/pins.ts; full preview", "e2e-isolated.sh",
    "./e2e-isolated.sh; wenn der Owner es verlangt",
    "geschuldete ./e2e-isolated.sh-Vorschau ueber suite-offer",
    "e2e-isolated.sh (owed)",
    "bun e2e/pins.ts; owed full preview", "bun e2e/pins.ts; volle Vorschau wenn das Gate sie verlangt",
    `bun e2e/pins.ts; ${"x".repeat(450)}; ./e2e-isolated.sh`,
  ];
  for (const line of unconditional) {
    const result = validate(line);
    check("(VR.card reject) an unconditional preview makes the card invalid with a named remedy",
      !result.valid && previewGap(line)
        && result.gaps.some((gap) => gap.includes("nur wenn localProof.isolatedPreview es verlangt")), line);
  }
  const conditional = [
    "bun e2e/pins.ts; Vorschau nur wenn localProof.isolatedPreview es verlangt",
    "./e2e-isolated.sh nur wenn isolatedPreview true ist", "bun e2e/pins.ts", "full chain",
    `./e2e-isolated.sh ${"x".repeat(450)} nur wenn localProof.isolatedPreview es verlangt`,
  ];
  for (const line of conditional)
    check("(VR.card accept) a conditional preview or ordinary gate proof has no preview gap",
      validate(line).valid && !previewGap(line), line);
  for (const verify of ["./e2e-isolated.sh", "run ./e2e-isolated.sh"]) {
    const foreign = validateCard({ ziel: "Foreign proof", done: "Own command passes", verify },
      { ...CARD_CONTEXT, foreignVerifyCommand: "./e2e-isolated.sh" });
    check("(VR.card foreign) a foreign repo keeps its own isolated-named verify command without Fleet preview gaps",
      foreign.valid && !foreign.gaps.some((gap) => gap.startsWith("verify")), JSON.stringify(foreign));
  }
  // THE REPO SCRIPT IN EVERY SPELLING (CARD_VALIDATOR_VERSION 12): the entry "./scripts/gate.sh",
  // the card "scripts/gate.sh" or "sh scripts/gate.sh" — one repo-relative path, accepted; a
  // same-named script under a different path keeps the refusal.
  const foreignCard = (command: string, verify: string) =>
    validateCard({ ziel: "Repo-Regel pruefen", done: "Das eigene Kommando steht in der Karte", verify },
      { ...CARD_CONTEXT, foreignVerifyCommand: command });
  const repoGate = "./scripts/gate.sh";
  for (const spelling of ["./scripts/gate.sh", "scripts/gate.sh", "sh scripts/gate.sh"])
    check("(VR.card repo spelling) the entry's script passes in every spelling of the same repo-relative path",
      foreignCard(repoGate, spelling).valid, spelling);
  for (const command of ["scripts/gate.sh", "sh scripts/gate.sh"])
    check("(VR.card repo entry) a bare or interpreter-led entry accepts the ./ spelling of its script",
      foreignCard(command, repoGate).valid, command);
  for (const other of ["tools/gate.sh", "src/scripts/gate.sh", "./tools/gate.sh"]) {
    const result = foreignCard(repoGate, other);
    check("(VR.card repo other path) a same-named script under a different path still refuses",
      !result.valid && result.gaps.some((gap) => gap.startsWith("verify:")
        && gap.includes("does not name this repository's configured verify command")), other);
  }
  const reread = validate("./e2e-isolated.sh nur wenn localProof.isolatedPreview es verlangt");
  check("(VR.card alias) alias normalization preserves the obligation for the next reading",
    reread.body.verify.includes("localProof.isolatedPreview") && validate(reread.body.verify).valid,
    reread.body.verify);
}

export async function run(): Promise<void> {
  const { BASE, ROOT, REPO, check, get, post, until } = await import("./harness");
  runCardRules(check);
  if (!REPO) return;
  const repo = `${ROOT}/verify-rules-repo`;
  mkdirSync(`${repo}/docs`, { recursive: true });
  const git = (cwd: string, ...args: string[]) => {
    const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`verify-rules git ${args[0]} failed: ${result.stderr.slice(0, 160)}`);
    return result.stdout.trim();
  };
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "Fleet E2E");
  git(repo, "config", "user.email", "e2e@example.invalid");
  git(repo, "config", "commit.gpgsign", "false");
  writeFileSync(`${repo}/fleet-e2e.ts`, "// Fleet fixture sentinel\n");
  writeFileSync(`${repo}/docs/rule.md`, "initial\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "verify rules base");
  const lane = await bodyOf<{ slot: number; cwd: string }>(await post("/api/lanes", { repo }));
  check("(VR.door fixture) an isolated lane opens", !!lane.slot && !!lane.cwd);
  if (!lane.slot || !lane.cwd) return;
  let token = "";
  try {
    await until(() => {
      const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { slots: Record<string, { selfToken?: string }> };
      token = state.slots[String(lane.slot)]?.selfToken ?? "";
      return /^[0-9a-f]{32}$/.test(token);
    }, { timeoutMs: 5000, stepMs: 50, what: "verify-rules lane token persisted" });
    const headers = { "x-fleet-self-token": token, "content-type": "application/json" };
    const selfGet = (path: string) => fetch(BASE + path, { headers });
    const offer = (body: unknown = {}) => post("/api/self/suite-offer", body, headers);
    const withdraw = () => post("/api/self/suite-offer/withdraw", {}, headers);
    const proof = async () => (await bodyOf<{ localProof: LocalProof }>(await selfGet("/api/self/gate"))).localProof;
    const commit = () => { git(lane.cwd, "add", "-A"); git(lane.cwd, "commit", "-qm", "verify rules change"); };
    writeFileSync(`${lane.cwd}/docs/rule.md`, "changed\n");
    commit();
    check("(VR.door false fixture) a docs diff owes no preview", (await proof()).isolatedPreview === false);
    for (const body of [{}, { owedReason: "asserted-contract" }, { modules: ["lane-suite"] }]) {
      const response = await offer(body);
      const answer = await bodyOf<Answer>(response);
      check("(VR.door false) 409 forbids both offering and local fallback",
        response.status === 409 && answer.error === REFUSED && !("offer" in answer) && !("reason" in answer), JSON.stringify(answer));
    }
    check("(VR.door false) rejected POST creates no offer",
      (await bodyOf<Answer>(await selfGet("/api/self/suite-offer"))).offer === null);
    writeFileSync(`${lane.cwd}/server.ts`, "export const rule = true;\n");
    commit();
    check("(VR.door self fixture) a server diff asks for self assessment", (await proof()).isolatedPreview === "self-assess");
    for (const body of [{}, { owedReason: "because my card says so" }, { owedReason: true }, { owedReason: REASONS }]) {
      const response = await offer(body);
      const answer = await bodyOf<Answer>(response);
      check("(VR.door self reject) a missing or unlisted reason is 400 with the closed list",
        response.status === 400 && answer.error === REQUIRED && !("offer" in answer), JSON.stringify(answer));
    }
    const helperToken = (await bodyOf<{ token: string }>(await get("/api/helper/token"))).token;
    const helperHeaders = { "x-fleet-helper-token": helperToken, "content-type": "application/json" };
    const beat = async (): Promise<boolean> => {
      const response = await post("/api/helper/device", { deviceId: "verifyrulesdev01", name: "verify rules" }, helperHeaders);
      const answer = await bodyOf<{ error?: string }>(response);
      check("(VR.door helper fixture) the isolated helper heartbeat is accepted before minting",
        response.ok, `HTTP ${response.status}${answer.error ? `: ${answer.error}` : ""}`);
      return response.ok;
    };
    for (const owedReason of REASONS) {
      if (!await beat()) return;
      const response = await offer({ owedReason });
      const answer = await bodyOf<Answer>(response);
      check("(VR.door self accept) each named obligation mints an open full offer",
        response.ok && answer.offer?.state === "open" && !!answer.offer.id && answer.offer.modules === undefined, JSON.stringify(answer));
      check("(VR.door self cleanup) the unclaimed offer withdraws", (await withdraw()).ok);
    }
    mkdirSync(`${lane.cwd}/e2e`, { recursive: true });
    writeFileSync(`${lane.cwd}/e2e/rule.ts`, "export const rule = true;\n");
    commit();
    check("(VR.door true fixture) an e2e diff owes the preview", (await proof()).isolatedPreview === true);
    if (!await beat()) return;
    const response = await offer();
    const answer = await bodyOf<Answer>(response);
    check("(VR.door true) true still mints an open full offer without a reason",
      response.ok && answer.offer?.state === "open" && !!answer.offer.id && answer.offer.modules === undefined, JSON.stringify(answer));
    const repeated = await bodyOf<Answer>(await offer());
    check("(VR.door true existing) retry returns the same offer", repeated.existing === true && repeated.offer?.id === answer.offer?.id);
    check("(VR.door true cleanup) the unclaimed offer withdraws", (await withdraw()).ok);
    await post("/api/helper/device", { deviceId: "verifyrulesdev01", name: "verify rules", mode: "quiet" }, helperHeaders);
  } finally {
    await post(`/api/slots/${lane.slot}/kill`, {});
  }
}
