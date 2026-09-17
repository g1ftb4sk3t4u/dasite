const PROJECTS = {
  "/signalsafe": {
    origin: "https://g1ft-signalsafe.skillful-jam.workers.dev",
    rewriteAssets: false,
  },
  "/skydex": {
    origin: "https://g1ft-skydex.meteor-shark.workers.dev",
    rewriteAssets: true,
  },
};

function matchProject(pathname) {
  for (const [prefix, config] of Object.entries(PROJECTS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return { prefix, ...config };
    }
  }
  return null;
}

function rewriteText(text, prefix) {
  return text
    .replaceAll('"/assets/', `"${prefix}/assets/`)
    .replaceAll("'/assets/", `'${prefix}/assets/`)
    .replaceAll('"/favicon.svg', `"${prefix}/favicon.svg`)
    .replaceAll("'/favicon.svg", `'${prefix}/favicon.svg`);
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const project = matchProject(incoming.pathname);

    // These Worker routes should only be attached to known project paths.
    // If a broader route is ever configured accidentally, preserve the main origin.
    if (!project) return fetch(request);

    let upstreamPath = incoming.pathname.slice(project.prefix.length) || "/";
    if (!upstreamPath.startsWith("/")) upstreamPath = "/" + upstreamPath;

    const upstream = new URL(project.origin);
    upstream.pathname = upstreamPath;
    upstream.search = incoming.search;

    const headers = new Headers(request.headers);
    headers.set("host", upstream.host);
    headers.set("x-g1ftb0x-project", project.prefix.slice(1));

    const upstreamRequest = new Request(upstream.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    let response = await fetch(upstreamRequest);
    const outHeaders = new Headers(response.headers);
    outHeaders.set("x-g1ftb0x-router", "1");

    // Keep upstream redirects inside the canonical G1ftB0x path where possible.
    const location = outHeaders.get("location");
    if (location) {
      try {
        const target = new URL(location, project.origin);
        if (target.origin === project.origin) {
          outHeaders.set("location", project.prefix + target.pathname + target.search + target.hash);
        }
      } catch {}
    }

    if (project.rewriteAssets && response.body) {
      const type = response.headers.get("content-type") || "";
      if (type.includes("text/html") || type.includes("javascript") || type.includes("text/css")) {
        const text = await response.text();
        return new Response(rewriteText(text, project.prefix), {
          status: response.status,
          statusText: response.statusText,
          headers: outHeaders,
        });
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};
