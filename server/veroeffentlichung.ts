// DIE VERÖFFENTLICHUNG, rein: was tools/veroeffentlichung.ts für git filter-repo schreibt und wonach sein Geheimnis-Scan sucht.
// Kein Name einer Maschine steht hier: die Namen liest der Lauf aus der Bindung (~/.config/claude-fleet/namen.json, server/bindung.ts).
// Ein Fund trägt bei den Geheimnis-Arten nie den Wert, nur einen Hash-Präfix: so zählt der Bericht verschiedene Werte, ohne einen zu zeigen.

/** Die Arten, deren Wert nie in einem Fund steht. */
export const GEHEIM_ARTEN: ReadonlySet<string> = new Set(["geheimnis-exakt", "token-48hex", "token-32hex", "privater-schluessel",
  "anbieter-schluessel", "env-zuweisung"]);

/** Die Arten, bei denen der Lauf vor dem Umschreiben anhält, solange ein Wert nicht als geprüft in der Bindung steht. */
export const HALT_ARTEN: readonly string[] = ["geheimnis-exakt", "privater-schluessel", "anbieter-schluessel"];

export interface Ersetzung { readonly name: string; readonly ersatz?: string }

// Python-re auf Bytes (git filter-repo): jedes ASCII-Zeichen außer Buchstabe und Ziffer maskiert; Nicht-ASCII bleibt, wie es ist
const pyEscape = (s: string): string => s.replace(/[\x00-\x7f]/g, (c) => /[A-Za-z0-9]/.test(c) ? c : `\\${c}`);

/** Die Datei für `--replace-text` und `--replace-message`: längere Namen zuerst (ein kürzerer steckt in einem längeren), ohne
 *  Rücksicht auf Groß- und Kleinschreibung, je Zeile `regex:(?i)<name>==><ersatz>`. */
export function ersetzungsDatei(eintraege: readonly Ersetzung[]): string {
  return [...eintraege].filter((e) => e.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name))
    .map((e) => {
      const ersatz = e.ersatz ?? "REDACTED";
      if (/[\\\n]|==>/.test(ersatz) || /\n|==>/.test(e.name)) throw new Error(`unbrauchbarer Eintrag: ${e.name.length} Zeichen`);
      return `regex:(?i)${pyEscape(e.name)}==>${ersatz}\n`;
    }).join("");
}

export type IpKlasse = "ip-tailnet" | "ip-privat" | "ip-oeffentlich";
/** Tailnet (100.64.0.0/10), privat (RFC 1918), sonst öffentlich; Loopback, Link-Local, 0/8, Broadcast und die Doku-Netze zählen nicht. */
export function ipKlasse(ip: string): IpKlasse | null {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((x) => !Number.isInteger(x) || x > 255)) return null;
  const [a, b, c] = o as [number, number, number, number];
  if (a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254)) return null;
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return null;
  if (a === 100 && b >= 64 && b <= 127) return "ip-tailnet";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "ip-privat";
  return "ip-oeffentlich";
}

/** Ein Pfad, der selbst ein Geheimnis-Träger ist: eine .env, Fleets fleet.json, ein Schlüssel. */
export function pfadArt(pfad: string): string | null {
  const base = pfad.split("/").pop() ?? pfad;
  if (base === ".env" || (base.startsWith(".env.") && !/\.(example|sample|template)$/.test(base))) return "datei-env";
  if (/^fleet\.json(\.|$)/.test(base)) return "datei-fleet-json";
  if (/\.(pem|key|p12|pfx)$/.test(base) || /^id_(rsa|ed25519|ecdsa|dsa)$/.test(base)) return "datei-schluessel";
  return null;
}

export interface Fund { readonly art: string; readonly wert: string }
export interface ScanSetup {
  readonly namen: RegExp | null;
  readonly entscheiden: RegExp | null;
  /** bekannte Geheimnisse: Wert → Bezeichnung der Quelle (nie der Wert selbst im Fund) */
  readonly geheim: ReadonlyMap<string, string>;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternation = (woerter: readonly string[], grenzen: boolean): RegExp | null => woerter.length
  ? new RegExp(`${grenzen ? "\\b" : ""}(?:${[...woerter].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})${grenzen ? "\\b" : ""}`, "gi")
  : null;

export function scanSetup(namen: readonly string[], entscheiden: readonly string[], geheim: ReadonlyMap<string, string>): ScanSetup {
  return { namen: alternation(namen, false), entscheiden: alternation(entscheiden, true), geheim };
}

const hash = (v: string): string => `sha256:${new Bun.CryptoHasher("sha256").update(v).digest("hex").slice(0, 12)}`;

const HEX_TOKEN = /\b(?:[0-9a-f]{48}|[0-9a-f]{32})\b/g;
const PRIVATER_SCHLUESSEL = /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g;
const ANBIETER = /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[abpr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|hf_[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g;
// eine Zuweisung an einen Namen, der ein Geheimnis meint, mit einem Wert, der kein Verweis ist (mindestens 16 Zeichen, Ziffer und Buchstabe)
const ZUWEISUNG = /\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|APIKEY|ACCESS_KEY|PRIVATE_KEY)\s*[=:]\s*["']?([A-Za-z0-9_\-+/.=]{16,})/g;
const IPV4 = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.]*\d)/g;

/** Alle Funde in einem Text. Namen, Entscheidungswörter und Adressen tragen ihren Text, jede Geheimnis-Art nur einen Hash. */
export function funde(text: string, s: ScanSetup): Fund[] {
  const out: Fund[] = [];
  if (s.namen) for (const m of text.matchAll(s.namen)) out.push({ art: "name", wert: m[0].toLowerCase() });
  if (s.entscheiden) for (const m of text.matchAll(s.entscheiden)) out.push({ art: "entscheiden", wert: m[0].toLowerCase() });
  for (const m of text.matchAll(HEX_TOKEN)) {
    const quelle = s.geheim.get(m[0]);
    out.push({ art: m[0].length === 48 ? "token-48hex" : "token-32hex", wert: hash(m[0]) });
    if (quelle) out.push({ art: "geheimnis-exakt", wert: quelle });
  }
  for (const [wert, quelle] of s.geheim) if (!/^[0-9a-f]+$/.test(wert) && text.includes(wert)) out.push({ art: "geheimnis-exakt", wert: quelle });
  for (const m of text.matchAll(PRIVATER_SCHLUESSEL)) out.push({ art: "privater-schluessel", wert: hash(m[0]) });
  for (const m of text.matchAll(ANBIETER)) out.push({ art: "anbieter-schluessel", wert: hash(m[0]) });
  for (const m of text.matchAll(ZUWEISUNG)) {
    const v = m[1]!;
    if (/\d/.test(v) && /[A-Za-z]/.test(v) && !/env\.|^process|^https?:/.test(v)) out.push({ art: "env-zuweisung", wert: hash(v) });
  }
  for (const m of text.matchAll(IPV4)) {
    const k = ipKlasse(m[0]);
    if (k) out.push({ art: k, wert: m[0] });
  }
  return out;
}

/** Die bekannten Geheimnisse dieser Maschine aus fleet.json, .env und den Dateien der Bindung; Werte unter 16 Zeichen zählen nicht. */
export function geheimWerte(quellen: { fleetJson: string | null; env: string | null; dateien: readonly { pfad: string; text: string }[] }): Map<string, string> {
  const m = new Map<string, string>();
  const nimm = (v: unknown, quelle: string): void => { if (typeof v === "string" && v.length >= 16 && !/\s/.test(v)) m.set(v, quelle); };
  if (quellen.fleetJson) {
    try {
      const j: unknown = JSON.parse(quellen.fleetJson);
      if (j && typeof j === "object") {
        for (const [k, v] of Object.entries(j)) if (/token/i.test(k)) nimm(v, `fleet.json ${k}`);
        const slots = "slots" in j && Array.isArray(j.slots) ? j.slots : [];
        for (const s of slots) if (s && typeof s === "object" && "selfToken" in s) nimm(s.selfToken, "fleet.json slots[].selfToken");
      }
    } catch { /* eine unlesbare fleet.json liefert keine Werte; der Lauf meldet die Zahl der Werte */ }
  }
  for (const line of (quellen.env ?? "").split("\n")) {
    const z = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (z && /TOKEN|SECRET|PASSWORD|KEY/.test(z[1]!)) nimm(z[2]!.replace(/\s+#.*$/, "").trim().replace(/^(['"])(.*)\1$/, "$2"), `.env ${z[1]}`);
  }
  for (const d of quellen.dateien)
    for (const line of d.text.split("\n"))
      nimm(line.trim().replace(/^[A-Za-z_][A-Za-z0-9_]*\s*[:=]\s*/, "").replace(/^(['"])(.*)\1$/, "$2"), d.pfad);
  return m;
}
