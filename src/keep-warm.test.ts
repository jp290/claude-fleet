import { describe, expect, test } from "bun:test";
import { keepWarmStep } from "./keep-warm";

const WARM = "[fleet-delivery · cache keep-warm (keepCache) · path=cache-warm · Slot 16 · next step: answer with ok only · limit: no new work, no tool call] ok?";
const OLD = "[fleet-zustellung · Cache halten · path=cache-warm · Slot 16 · x] ok?";
const user = (text: string) => ({ role: "user" as const, blocks: [{ t: "text", text }] });
const claude = (text: string) => ({ role: "assistant" as const, blocks: [{ t: "text", text }] });

// the view the owner gets: run entries in order, keep what is not hidden
function shown(entries: Parameters<typeof keepWarmStep>[0][]): string[] {
  let inTurn = false;
  const out: string[] = [];
  for (const e of entries) {
    const r = keepWarmStep(e, inTurn);
    inTurn = r.inTurn;
    if (!r.hide) out.push(e.blocks.map((b) => b.text ?? b.t).join(" "));
  }
  return out;
}

describe("a keep-warm exchange stays out of the bot page's conversation", () => {
  test("the ping and the bot's short answer are hidden, what was said before and after shows", () => {
    expect(shown([user("hello"), claude("hi there"), user(WARM), claude("ok"), user("and now?"), claude("here")]))
      .toEqual(["hello", "hi there", "and now?", "here"]);
  });
  test("the older German head is read too", () => {
    expect(shown([user(OLD), claude("ok"), user("hello")])).toEqual(["hello"]);
  });
  test("an answer with a tool step and its result belongs to the ping; the next prompt ends the turn", () => {
    const tool = { role: "assistant" as const, blocks: [{ t: "tool_use" }] };
    const result = { role: "user" as const, blocks: [{ t: "tool_result" }] };
    expect(shown([user(WARM), tool, result, claude("ok"), user("next")])).toEqual(["next"]);
  });
  test("another Fleet delivery or the owner's text is not a keep-warm ping, even right after one", () => {
    const mail = "[fleet-delivery · mailbox message · path=postfach · Slot 16 · read it] hi";
    expect(shown([user(WARM), claude("ok"), user(mail), claude("read")])).toEqual([mail, "read"]);
  });
  test("a text that merely says cache-warm, with no head, is shown", () => {
    expect(shown([user("what is path=cache-warm?"), claude("a ping")])).toEqual(["what is path=cache-warm?", "a ping"]);
  });
  test("a meta line inside the turn is not hidden and does not end it", () => {
    const meta = { role: "user" as const, meta: true, blocks: [{ t: "text", text: "system line" }] };
    expect(shown([user(WARM), meta, claude("ok")])).toEqual(["system line"]);
  });
});
