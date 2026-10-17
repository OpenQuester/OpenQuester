// Cloudflare Pages Functions: forward the API and the game socket to the
// OpenQuester server so the app and its session cookie share one origin.
// That keeps login working on any Pages URL (previews included) without
// third-party cookies or CORS.

interface Env {
  API_ORIGIN: string;
}

interface Context {
  request: Request;
  env: Env;
}

export async function proxy({ request, env }: Context): Promise<Response> {
  const incoming = new URL(request.url);

  // Only this site may use its session through the proxy. The Origin header is
  // dropped below (the API would not know this host), so check it here: a page
  // on another site could otherwise drive the API, sockets included, with the
  // visitor's cookie.
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== incoming.origin) {
    return new Response("Cross-site requests are not allowed", { status: 403 });
  }

  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", incoming.host);
  headers.set("X-Forwarded-Proto", incoming.protocol.replace(":", ""));
  // The API checks the origin against its CORS list; this request is same-origin.
  headers.delete("Origin");

  const upstream = await fetch(
    new Request(target.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    }),
  );

  // WebSocket upgrades are passed through untouched.
  if (upstream.status === 101) return upstream;

  // Cookies are issued for the API's own host; re-scope them to this site.
  const out = new Headers(upstream.headers);
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    out.delete("Set-Cookie");
    for (const cookie of cookies) {
      out.append(
        "Set-Cookie",
        cookie
          .split(";")
          .filter((part) => !/^\s*domain=/i.test(part))
          .join(";"),
      );
    }
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}
