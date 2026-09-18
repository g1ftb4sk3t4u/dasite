export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/status") {
      return Response.json({ ok: true, app: "SkyDex", platform: "Cloudflare Workers" });
    }
    return env.ASSETS.fetch(request);
  }
};
