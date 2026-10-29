// FERNPOST: DIE TÜR EINER FLEET ZUR ANDEREN (server/nachbarn.ts hält die Bindung, dieses Modul die zwei Hälften der Tür).
//
//   aus  sendeAnNachbar: ein Sitz schreibt über POST /api/self/messages an {kind:"remote",fleet,slot}; die Fleet stellt die
//        Nachricht der Tür des Nachbarn zu (POST /api/fleet-nachbar/messages), mit dem Ausweis der Bindung und sonst nichts.
//   ein  nimmNachbarAn: die EMPFANGENDE Fleet prüft Ausweis und Paar, legt die Nachricht als gewöhnliche Postfach-Zeile ab
//        (from = {kind:"remote",fleet,slot}, to = der Sitz hier) und lässt sie von der Postfach-Zustellung in die Pane tippen.
//
// Eine EINZIGE Tür prüft, wer wem schreiben darf, und es ist die empfangende: unbekannter oder falscher Ausweis 401 (nach der festen
// Wartezeit jeder falschen Anmeldung), ein nicht freigegebenes Paar 409 mit Grund. Der Absender-Slot im Body ist eine Behauptung des
// Nachbarn, die die Freigabe des Paars begrenzt — die Fleet, die den Ausweis hält, steht für ihre Sitze gerade.
// Die Freigabe hängt am SLOT, nicht an seiner Belegung: wer einen freigegebenen Slot neu besetzt, darf weiter schreiben (Leitung 29.10.:
// für jetzt richtig; die Kanten binden dagegen Slot und Ordner).
// Weder Owner- noch Self-Token reisen: der Draht trägt den Ausweis im Authorization-Kopf, im Body nur Slots, Text und Schlüssel.
//
// NICHT ERREICHBAR IST LAUT (Leitung 29.10.): ist der Nachbar aus, antwortet er nicht binnen NACHBAR_FRIST_MS oder lehnt er ab, hört der
// Absender es sofort an seiner Tür, mit dem Nachbarn und dessen Status (`neighbour`), und es entsteht KEINE Zeile im Postfach, die so
// täte, als sei die Nachricht unterwegs. Keine Wiederholung im Hintergrund: der Sitz sendet selbst noch einmal, mit demselben
// idempotencyKey, und die empfangende Fleet legt auch dann genau eine Zeile ab. Größengrenze und Idempotenz sind die der lokalen Nachricht.
import { json } from "./json";
import { FERN_TUER, nachbarFuerAusweis, paarErlaubt, problemeFuer, type FernNachricht, type Nachbarn } from "./nachbarn";
import { MESSAGE_IDEMPOTENCY_KEY_MAX, type Message, type MessageAddress, type MessagePayload } from "./types";

export const NACHBAR_FRIST_MS = Number(process.env.FLEET_NACHBAR_FRIST_MS) > 0 ? Number(process.env.FLEET_NACHBAR_FRIST_MS) : 10_000;
const FEHLER_MAX = 300;

// `neighbour`: wen die Fleet zu erreichen versuchte und was er antwortete (null: keine Antwort) — fehlt, wenn sie es gar nicht versuchte
export type Senden = { ok: true; existing: boolean; holder: number | null }
  | { ok: false; status: number; error: string; neighbour?: { fleet: string; status: number | null } };

export async function sendeAnNachbar(a: { nachbarn: Nachbarn; fleet: string; vonSlot: number; anSlot: number; payload: MessagePayload;
  key: string; replyRef: string | null; holen?: typeof fetch }): Promise<Senden> {
  // NICHTS STILL: fiel der Nachbar wegen eines Fehlers seiner Bindung heraus (chmod, ein doppelter Name …), sagt der Fehler, welcher es ist
  const warum = (): string => {
    const p = problemeFuer(a.nachbarn, a.fleet);
    return p.length ? ` — the binding has a problem: ${p.join("; ")}` : "";
  };
  const n = a.nachbarn.nachbarn.find((x) => x.name === a.fleet);
  if (!n) {
    const namen = a.nachbarn.nachbarn.map((x) => x.name);
    return { ok: false, status: 409, error: `unknown neighbour fleet "${a.fleet}" — this fleet's binding (nachbarn.json) lists ${namen.length ? namen.join(", ") : "none"}${warum()}` };
  }
  if (!n.url || !n.ausweisAus)
    return { ok: false, status: 409, error: `neighbour "${n.name}" has no ${n.url ? "usable ausweisAus" : "url"} in the binding — this fleet cannot write to it yet${warum()}` };
  if (a.payload.kind !== "text") return { ok: false, status: 400, error: "payload must be text" };
  const body: FernNachricht = { from: { slot: a.vonSlot }, to: { slot: a.anSlot }, payload: a.payload, idempotencyKey: a.key,
    ...(a.replyRef === null ? {} : { replyRef: a.replyRef }) };
  const scrub = (t: string): string => t.replaceAll(n.ausweisAus!, "[ausweis]").slice(0, FEHLER_MAX);
  const nichtsHier = "nothing is filed here; send again with the same idempotencyKey — the neighbour files one key only once";
  let res: Response;
  let antwort: { error?: unknown; existing?: unknown; holder?: unknown } | null;
  try {
    // keiner Weiterleitung folgen: der Ausweis geht an die url der Bindung und an keine, die eine Antwort nennt
    res = await (a.holen ?? fetch)(`${n.url}${FERN_TUER}`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(NACHBAR_FRIST_MS),
      headers: { authorization: `Bearer ${n.ausweisAus}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    antwort = await res.json().catch(() => null) as typeof antwort;
  } catch (e) {
    const name = e instanceof Error ? e.name : "", code = (e as { code?: unknown } | null)?.code;
    const neighbour = { fleet: n.name, status: null };
    if (code === "UnexpectedRedirect")
      return { ok: false, status: 502, neighbour, error: `neighbour "${n.name}" answered with a redirect — Fernpost follows none; check its url in the binding; ${nichtsHier}` };
    if (code === "ConnectionRefused")
      return { ok: false, status: 502, neighbour, error: `neighbour "${n.name}" is not reachable (connection refused) — the message did not arrive; ${nichtsHier}` };
    // nach einer Zeitüberschreitung oder einem abgerissenen Aufruf weiß diese Fleet nicht, ob der Nachbar die Nachricht schon hat
    const frist = name === "TimeoutError" || name === "AbortError";
    return { ok: false, status: frist ? 504 : 502, neighbour,
      error: `neighbour "${n.name}" ${frist ? `did not answer within ${NACHBAR_FRIST_MS / 1000} s` : "broke off the call"} — the message may have arrived there; ${nichtsHier}` };
  }
  if (res.ok)
    return { ok: true, existing: antwort?.existing === true, holder: typeof antwort?.holder === "number" ? antwort.holder : null };
  const neighbour = { fleet: n.name, status: res.status };
  const grund = typeof antwort?.error === "string" ? scrub(antwort.error) : "no reason given";
  if (res.status === 401 || res.status === 429)
    return { ok: false, status: 409, neighbour, error: `neighbour "${n.name}" answered ${res.status}: it did not accept this fleet's badge — check ausweisAus here and ausweisEin there; nothing is filed on either side` };
  if (res.status === 400 || res.status === 403 || res.status === 409)
    return { ok: false, status: 409, neighbour, error: `neighbour "${n.name}" answered ${res.status}: ${grund}` };
  return { ok: false, status: 502, neighbour, error: `neighbour "${n.name}" answered ${res.status}: ${grund} — the message may have arrived there; ${nichtsHier}` };
}

// DER ZÄHLER DER FALSCHEN AUSWEISE gehört dieser Tür allein (nicht failStrike in server/auth.ts, dessen Obergrenze je Schlüssel die Tür
// für JEDE Quelle sperren würde). Er zählt je Quelle in einem Fenster; ein echter Ausweis kommt immer herein, auch von einer gesperrten
// Quelle — ein Ausweis hat mindestens 24 Zeichen und ist nicht zu erraten, die Sperre spart nur Arbeit: eine gesperrte Quelle bekommt
// 429 ohne Wartezeit und ohne weitere Audit-Zeile. So sperrt eine Flut falscher Ausweise weder den Nachbarn noch den Owner aus.
export const NACHBAR_FEHLVERSUCHE = Number(process.env.FLEET_NACHBAR_FEHLVERSUCHE) > 0 ? Number(process.env.FLEET_NACHBAR_FEHLVERSUCHE) : 50;
const FENSTER_MS = 60 * 60_000;
const QUELLEN_MAX = 1024;
export function fehlversuchZaehler(grenze = NACHBAR_FEHLVERSUCHE, fensterMs = FENSTER_MS, uhr = () => Date.now()) {
  const je = new Map<string, { anzahl: number; bis: number }>();
  return (quelle: string): { gesperrt: boolean; geradeGesperrt: boolean } => {
    const jetzt = uhr();
    let z = je.get(quelle);
    if (!z || jetzt > z.bis) {
      // die Karte bleibt beschränkt: die älteste Quelle fällt zuerst
      if (!z && je.size >= QUELLEN_MAX) je.delete(je.keys().next().value!);
      z = { anzahl: 0, bis: jetzt + fensterMs };
      je.set(quelle, z);
    }
    z.anzahl++;
    return { gesperrt: z.anzahl > grenze, geradeGesperrt: z.anzahl === grenze + 1 };
  };
}

export interface EinDeps {
  nachbarn(): Nachbarn;
  // wer sitzt jetzt in diesem Slot und kann Postfach lesen? Der Sitz als Adresse, sonst der Grund, warum nicht
  ziel(slot: number): { ok: true; to: MessageAddress & { kind: "session" } } | { ok: false; error: string };
  frueher(from: MessageAddress, key: string): Message | undefined;
  // die Nachricht dieses Sitzes, auf die der Nachbar mit `replyRef` antwortet (sein Schlüssel), oder null
  antwortAuf(to: MessageAddress & { kind: "session" }, fleet: string, vonSlot: number, replyRef: string): string | null;
  anhaengen(from: MessageAddress, to: MessageAddress, payload: MessagePayload, key: string, replyTo: string | null): Message;
  speichern(): Promise<void>;
  // eine falsche Anmeldung von dieser Quelle zählen (fehlversuchZaehler)
  fehlschlag(quelle: string): { gesperrt: boolean; geradeGesperrt: boolean };
  pause(ms: number): Promise<void>;
  audit(was: "nachbar_nachricht" | "nachbar_paar_abgewiesen" | "nachbar_ausweis_abgewiesen", text: string): void;
  // alles, was nach dem erkannten Ausweis geschieht, schreibt der Nachbar: Audit-Actor {kind:"nachbar",fleet}
  alsNachbar<T>(fleet: string, fn: () => T): T;
}

const ERLAUBT = ["from", "to", "payload", "idempotencyKey", "replyRef"];
const slotDe = (v: unknown): number | null => {
  const r = v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
  return r && Object.keys(r).length === 1 && Number.isInteger(r.slot) && (r.slot as number) > 0 ? r.slot as number : null;
};

// DER AUSWEIS VOR DEM BODY: `liesBody` wird erst gerufen, wenn der Ausweis erkannt ist — ein Fremder bekommt seine 401, ohne dass die
// Fleet auch nur ein Byte seines Bodys liest
export async function nimmNachbarAn(d: EinDeps, ausweis: string | null, quelle: string, liesBody: () => Promise<unknown>,
  pruefePayload: (v: unknown, was: string) => MessagePayload | string): Promise<Response> {
  const wer = nachbarFuerAusweis(d.nachbarn().nachbarn, ausweis);
  if (!wer) {
    const z = d.fehlschlag(quelle);
    if (z.gesperrt && !z.geradeGesperrt) return json({ error: "too many attempts — try again later" }, 429);
    // feste Kosten für jede falsche Anmeldung, wie /auth; der Ausweis, der vorgezeigt wurde, steht nirgends
    d.audit("nachbar_ausweis_abgewiesen", z.gesperrt ? `quelle ${quelle} gesperrt` : "unbekannt oder falsch");
    await d.pause(400);
    return json({ error: z.gesperrt ? "too many attempts — try again later" : "unauthorized" }, z.gesperrt ? 429 : 401);
  }
  return await d.alsNachbar(wer.name, async () => {
    const body = await liesBody();
    const r = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!r) return json({ error: "body must be an object" }, 400);
    const extra = Object.keys(r).filter((k) => !ERLAUBT.includes(k));
    if (extra.length) return json({ error: `body reads only ${ERLAUBT.join(", ")} — [${extra.join(", ")}] is not read` }, 400);
    const von = slotDe(r.from), an = slotDe(r.to);
    if (von === null || an === null) return json({ error: "from and to must be { slot } with a slot number" }, 400);
    const payload = pruefePayload(r.payload, "payload");
    if (typeof payload === "string") return json({ error: payload }, 400);
    if (typeof r.idempotencyKey !== "string" || r.idempotencyKey === "" || r.idempotencyKey.length > MESSAGE_IDEMPOTENCY_KEY_MAX)
      return json({ error: `idempotencyKey must be a non-empty string of at most ${MESSAGE_IDEMPOTENCY_KEY_MAX} chars` }, 400);
    if (r.replyRef !== undefined && (typeof r.replyRef !== "string" || r.replyRef === "" || r.replyRef.length > MESSAGE_IDEMPOTENCY_KEY_MAX))
      return json({ error: "replyRef must be the sender's idempotencyKey of the message answered" }, 400);

    // DIE FREIGABE, bevor irgendetwas über die Sitze hier verraten wird: ein Paar, das nicht dasteht, erfährt nicht, ob der Slot lebt
    if (!paarErlaubt(wer, von, an)) {
      d.audit("nachbar_paar_abgewiesen", `${wer.name} slot ${von} -> slot ${an}`);
      return json({ error: `this fleet has not released the pair: slot ${von} of "${wer.name}" may not write to slot ${an} here — its owner lists `
        + `{"von":${von},"an":${an}} under erlaubt for "${wer.name}" in nachbarn.json` }, 409);
    }
    const from: MessageAddress = { kind: "remote", fleet: wer.name, slot: von };
    const prior = d.frueher(from, r.idempotencyKey);
    if (prior) {
      if (prior.payload.kind !== "text" || prior.payload.text !== payload.text || prior.to.kind !== "session" || prior.to.slot !== an)
        return json({ error: `idempotencyKey ${r.idempotencyKey} was already used by this sender for a different message` }, 409);
      return json({ ok: true, existing: true, holder: an });
    }
    const ziel = d.ziel(an);
    if (!ziel.ok) return json({ error: ziel.error }, 409);
    const replyTo = typeof r.replyRef === "string" ? d.antwortAuf(ziel.to, wer.name, von, r.replyRef) : null;
    const entry = d.anhaengen(from, ziel.to, payload, r.idempotencyKey, replyTo);
    d.audit("nachbar_nachricht", `${wer.name} slot ${von} -> slot ${an} ${entry.id}`);
    await d.speichern();
    return json({ ok: true, existing: false, holder: an });
  });
}
