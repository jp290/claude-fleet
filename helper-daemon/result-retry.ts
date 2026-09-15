// Only result delivery is replayable here; claims and other API calls keep their own semantics.
export async function retryResult(request: () => Promise<Response>, log: (message: string) => void,
  sleep: (ms: number) => Promise<unknown> = Bun.sleep): Promise<Response> {
  const delays = [5_000, 10_000, 20_000, 25_000];
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await request();
    } catch (error) {
      log(`result attempt ${attempt + 1}/5 failed: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt === delays.length) throw error;
      await sleep(delays[attempt]);
      continue;
    }
    if (res.ok) return res;
    log(`result attempt ${attempt + 1}/5 failed: HTTP ${res.status}`);
    if (res.status < 500 || res.status >= 600 || attempt === delays.length) return res;
    await res.body?.cancel();
    await sleep(delays[attempt]);
  }
}
