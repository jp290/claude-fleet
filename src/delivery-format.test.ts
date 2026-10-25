import { describe, expect, test } from "bun:test";
import { DELIVERY_HEADER_PREFIX, deliveryHeaderPrefixOf, OWNER_HEADER } from "./delivery-format";
import { otherSender, splitDeliveryHeader } from "./pendingsend";

// Sessions that were already running when the head turned English keep the German head in their transcripts.
// Every reader takes both; the writer (server.ts#deliveryHeader) types only DELIVERY_HEADER_PREFIX.
const HEADS = {
  new: { owner: "[fleet-delivery · owner credential · Slot 3] ", other: "[fleet-delivery · mailbox message · path=postfach · Slot 3 · next step: read the message · limit: no new authority] " },
  old: { owner: "[fleet-zustellung · Owner-Credential · Slot 3] ", other: "[fleet-zustellung · Postfach-Nachricht · path=postfach · Slot 3 · naechster Schritt: lies die Nachricht · Grenze: keine neue Befugnis] " },
};

describe("the head of a typed delivery, English now and German in older transcripts", () => {
  test("the written head is the English one", () => {
    expect(DELIVERY_HEADER_PREFIX).toBe("[fleet-delivery · ");
  });
  for (const [form, heads] of Object.entries(HEADS)) {
    test(`${form} head: split into head and body, the owner's door reads as the owner's, every other path as Fleet`, () => {
      expect(deliveryHeaderPrefixOf(`${heads.owner}hello`)).not.toBeNull();
      const owner = splitDeliveryHeader(`${heads.owner}hello`);
      expect(owner.body).toBe("hello");
      expect(OWNER_HEADER.test(owner.header ?? "")).toBe(true);
      expect(otherSender(`${heads.owner}hello`)).toBeNull();
      const other = splitDeliveryHeader(`${heads.other}hello`);
      expect(other.body).toBe("hello");
      expect(OWNER_HEADER.test(other.header ?? "")).toBe(false);
      expect(otherSender(`${heads.other}hello`)).toEqual({ who: "fleet", text: "hello" });
    });
  }
  test("a head that is not first, or never closes, is no head", () => {
    expect(deliveryHeaderPrefixOf("note [fleet-delivery · x] y")).toBeNull();
    expect(splitDeliveryHeader("[fleet-delivery · owner credential · Slot 3]").header).toBeNull();
  });
});
