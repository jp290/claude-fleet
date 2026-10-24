// Die Veröffentlichung (server/veroeffentlichung.ts): die Ersetzungsdatei wirkt in Pythons re so, wie git filter-repo sie anwendet,
// und der Scan findet jede Art, ohne den Wert eines Geheimnisses herauszugeben. Alle Namen hier sind erfunden.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ersetzungsDatei, funde, GEHEIM_ARTEN, geheimWerte, ipKlasse, pfadArt, scanSetup } from "./veroeffentlichung";

// wendet die Datei Zeile für Zeile an wie filter-repo (--replace-text): re.sub auf Bytes, in der Reihenfolge der Datei
const wendeAn = (datei: string, text: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "veroeff-"));
  try {
    writeFileSync(join(dir, "r.txt"), datei); writeFileSync(join(dir, "t.txt"), text);
    const py = `import re,sys\nt=open(sys.argv[2],'rb').read()\nfor l in open(sys.argv[1],'rb').read().splitlines():\n  p,r=l[len(b'regex:'):].split(b'==>',1)\n  t=re.sub(p,r,t)\nsys.stdout.buffer.write(t)`;
    const r = Bun.spawnSync(["python3", "-c", py, join(dir, "r.txt"), join(dir, "t.txt")]);
    expect(r.stderr.toString()).toBe("");
    return r.stdout.toString();
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

describe("die Ersetzungsdatei", () => {
  const datei = ersetzungsDatei([{ name: "robo", ersatz: "someone" }, { name: "helperrobo", ersatz: "helper-user" },
    { name: "10.9.8.7", ersatz: "10.0.0.1" }, { name: "Robo’s Laptop", ersatz: "example-host" }]);
  test("ein längerer Name, der einen kürzeren enthält, wird zuerst und ganz ersetzt", () => {
    expect(wendeAn(datei, "ssh helperrobo@x; /Users/robo/a")).toBe("ssh helper-user@x; /Users/someone/a");
  });
  test("ohne Rücksicht auf Groß- und Kleinschreibung, ein Punkt nur als Punkt, Nicht-ASCII wörtlich", () => {
    expect(wendeAn(datei, "-Users-ROBO- Robo 10.9.8.7 10x9x8x7 robo’s laptop")).toBe("-Users-someone- someone 10.0.0.1 10x9x8x7 example-host");
  });
  test("ein Ersatz, der die Zeile bräche, wird abgelehnt", () => {
    expect(() => ersetzungsDatei([{ name: "a", ersatz: "x==>y" }])).toThrow();
  });
});

describe("der Scan", () => {
  const owner = "0123456789abcdef0123456789abcdef0123456789abcdef";
  const geheim = geheimWerte({ fleetJson: JSON.stringify({ token: owner, slots: [{ selfToken: "fedcba9876543210fedcba9876543210" }] }),
    env: "FLEET_SYNC_TOKEN='abcdefgh12345678xyz'\nFLEET_HOST='10.9.8.7'\n", dateien: [{ pfad: "~/.x/api.key", text: "sk-ausgedacht-1234567890\n" }] });
  const s = scanSetup(["robo", "10.9.8.7"], ["projektx"], geheim);
  const text = [`token ${owner}`, "self fedcba9876543210fedcba9876543210", "andere 11112222333344445555666677778888",
    "-----BEGIN OPENSSH PRIVATE KEY-----", "key sk-ausgedacht-1234567890", "MY_API_KEY=Abcdefghij0123456789",
    "FLEET_TOKEN: process.env.FLEET_TOKEN_VALUE", "ROBO at 10.9.8.7, 100.64.0.1, 8.8.8.8, 127.0.0.1, v1.2.3.4.5", "ProjektX ist geheim"].join("\n");
  const f = funde(text, s);
  const arten = (art: string): string[] => f.filter((x) => x.art === art).map((x) => x.wert);
  test("jede Art wird gefunden", () => {
    expect(arten("name")).toEqual(["robo", "10.9.8.7"]);
    expect(arten("entscheiden")).toEqual(["projektx"]);
    expect(arten("token-48hex")).toHaveLength(1);
    expect(arten("token-32hex")).toHaveLength(2);
    expect(arten("geheimnis-exakt").sort()).toEqual(["fleet.json slots[].selfToken", "fleet.json token", "~/.x/api.key"]);
    expect(arten("privater-schluessel")).toHaveLength(1);
    expect(arten("env-zuweisung")).toHaveLength(1);
    expect([arten("ip-privat"), arten("ip-tailnet"), arten("ip-oeffentlich")]).toEqual([["10.9.8.7"], ["100.64.0.1"], ["8.8.8.8"]]);
  });
  test("kein Fund einer Geheimnis-Art trägt einen Wert, der im Text steht", () => {
    for (const x of f.filter((x) => GEHEIM_ARTEN.has(x.art))) expect([x.art, text.includes(x.wert)]).toEqual([x.art, false]);
  });
  test("die bekannten Werte kommen aus fleet.json, den Geheimnis-Variablen der .env und den Dateien, ohne kurze und ohne Hosts", () => {
    expect([...geheim.values()].sort()).toEqual([".env FLEET_SYNC_TOKEN", "fleet.json slots[].selfToken", "fleet.json token", "~/.x/api.key"]);
  });
});

describe("Pfade und Adressen", () => {
  test("eine .env, eine fleet.json und ein Schlüssel sind Träger, ein Beispiel nicht", () => {
    expect(["a/.env", ".env.local", ".env.example", "fleet.json", "fleet.json.bak", "x/id_ed25519", "k.pem", "src/fleet.ts"].map(pfadArt))
      .toEqual(["datei-env", "datei-env", null, "datei-fleet-json", "datei-fleet-json", "datei-schluessel", "datei-schluessel", null]);
  });
  test("Doku-Netze, Loopback und Broadcast zählen nicht", () => {
    expect(["192.0.2.1", "127.0.0.1", "255.255.255.255", "172.20.0.1", "100.128.0.1", "999.1.1.1"].map(ipKlasse))
      .toEqual([null, null, null, "ip-privat", "ip-oeffentlich", null]);
  });
});
