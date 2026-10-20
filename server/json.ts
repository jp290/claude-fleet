// The JSON response helper every route returns through. Its own leaf, apart from server/http.ts: that one also
// fixes HOST and PORT from the environment when it loads, and a module that only answers requests must not.
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
