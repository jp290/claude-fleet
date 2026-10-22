import { describe, expect, test } from "bun:test";
import { fassungKurz, fassungZeile } from "./fassung-zeile";

const H = "6ace66f1d2c34b5a97e8f0aa11223344556677889900aabbccddeeff00112233";

describe("fassung-zeile", () => {
  test("kürzt auf die ersten acht Zeichen, in der Vorschau wie am laufenden Sitz", () => {
    expect(fassungKurz(H)).toBe("6ace66f1");
    expect(fassungZeile(H)).toBe("Fassung 6ace66f1");
  });
  test("zwei Hashes, die sich nur hinter dem achten Zeichen unterscheiden, lesen sich gleich; sonst nie", () => {
    expect(fassungZeile(H.slice(0, 8) + "0".repeat(56))).toBe(fassungZeile(H));
    expect(fassungZeile("5c04ced1" + H.slice(8))).not.toBe(fassungZeile(H));
  });
  test("ein kürzerer Text bleibt, wie er ist", () => {
    expect(fassungKurz("abc")).toBe("abc");
    expect(fassungKurz("")).toBe("");
  });
});
