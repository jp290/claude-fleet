import { splitDeliveryHeader, unwrapPasted } from "./pendingsend";

// THE KEEP-WARM TURN, KEPT OUT OF THE OWNER'S CONVERSATION. Every ~50 minutes server.ts#tickKeepCache types one short turn into
// an idle seat so its prompt cache stays warm, and the seat answers "ok". On /bot the owner reads the chat as his
// conversation with his bot (owner 2026-11-01); that ping and that "ok" are Fleet's machinery, not something he said or was told.
//
// HOW IT IS RECOGNISED: by the head Fleet itself types in front of the ping (server.ts#deliveryHeader writes `path=cache-warm`
// for exactly that send, in both the English and the older German head), never by a guess at the text. A seat on a foreign
// FLEET_CMD gets no head typed (headsDelivery) and so no recognition; the ping then stays visible, as before.
// THE TURN: the ping, and everything the seat does after it until the next prompt — its answer and any tool steps and results.
// A prompt of the owner's (or any other delivery) ends it; so does a meta line, which is never hidden.
interface Entry { role: "user" | "assistant"; meta?: boolean; blocks: { t: string; text?: string }[] }

export const isKeepWarmHead = (header: string | null): boolean => header !== null && / · path=cache-warm(?: · |$)/.test(header);

// `inTurn` is the state after the previous entry. The answer: whether this entry stays out of the view, and the state after it.
export function keepWarmStep(e: Entry, inTurn: boolean): { hide: boolean; inTurn: boolean } {
  if (e.meta) return { hide: false, inTurn };
  if (e.role === "assistant") return { hide: inTurn, inTurn };
  const texts = e.blocks.filter((b) => b.t === "text");
  if (!texts.length) return { hide: inTurn, inTurn }; // a tool result belongs to the turn it answers
  const head = splitDeliveryHeader(unwrapPasted(texts.map((b) => b.text ?? "").join("\n"))).header;
  const warm = isKeepWarmHead(head);
  return { hide: warm, inTurn: warm };
}
