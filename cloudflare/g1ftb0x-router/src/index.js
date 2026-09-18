const PROJECTS = {
  "/signalsafe": { binding: "SIGNALSAFE", rewriteAssets: false, name: "SignalSafe", shortName: "SignalSafe" },
  "/skydex": { binding: "SKYDEX", rewriteAssets: true, name: "SkyDex", shortName: "SkyDex" },
  "/rabbit-hole": { binding: "RABBITHOLE", rewriteAssets: false, name: "Rabbit Hole", shortName: "Rabbit Hole" },
  "/worthwise": { binding: "WORTHWISE", rewriteAssets: false, name: "WorthWise", shortName: "WorthWise" },
  "/perfectday": { binding: "PERFECTDAY", rewriteAssets: true, name: "PerfectDay Atlas", shortName: "PerfectDay" },
  "/mysteries": { binding: "MYSTERIES", rewriteAssets: false, name: "Mysteries of Knowledge", shortName: "Mysteries" },
  "/fiberlab": { binding: "FIBERLAB", rewriteAssets: false, name: "Fiber Field Lab", shortName: "FiberLab" },
  "/ripple": { binding: "RIPPLE", rewriteAssets: false, name: "Ripple", shortName: "Ripple" },
  "/intel3000": { binding: "INTEL3000", rewriteAssets: false, name: "Intel Terminal 3000", shortName: "Intel3000" },
};

function matchProject(pathname) {
  for (const [prefix, config] of Object.entries(PROJECTS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return { prefix, slug: prefix.slice(1), ...config };
  }
  return null;
}

function rewriteProjectPaths(text, project) {
  let out = text;
  if (project.rewriteAssets) {
    out = out
      .replaceAll('"/assets/', `"${project.prefix}/assets/`)
      .replaceAll("'/assets/", `'${project.prefix}/assets/`)
      .replaceAll('"/favicon.svg', `"${project.prefix}/favicon.svg`)
      .replaceAll("'/favicon.svg", `'${project.prefix}/favicon.svg`);
  }
  return out;
}

function injectPwa(text, project) {
  if (text.includes("data-g1ft-pwa")) return text;
  const block = `
<link data-g1ft-pwa rel="manifest" href="${project.prefix}/manifest.webmanifest">
<link data-g1ft-pwa rel="icon" type="image/svg+xml" href="${project.prefix}/pwa/icon.svg">
<link data-g1ft-pwa rel="apple-touch-icon" href="${project.prefix}/pwa/icon-192.png">
<meta data-g1ft-pwa name="theme-color" content="#08110d">
<meta data-g1ft-pwa name="mobile-web-app-capable" content="yes">
<meta data-g1ft-pwa name="apple-mobile-web-app-capable" content="yes">
<meta data-g1ft-pwa name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<script data-g1ft-pwa src="${project.prefix}/pwa/register.js" defer></script>`;
  const headEnd = text.search(/<\/head\s*>/i);
  if (headEnd >= 0) return text.slice(0, headEnd) + block + text.slice(headEnd);
  return block + text;
}

function manifestResponse(project) {
  const manifest = {
    id: project.prefix + "/",
    name: project.name,
    short_name: project.shortName,
    start_url: project.prefix + "/",
    scope: project.prefix + "/",
    display: "standalone",
    background_color: "#030608",
    theme_color: "#08110d",
    prefer_related_applications: false,
    icons: [
      { src: project.prefix + "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: project.prefix + "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}

function serviceWorkerResponse(project) {
  const source = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    try {
      return await fetch(event.request);
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});`;
  return new Response(source, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "service-worker-allowed": project.prefix + "/"
    }
  });
}

function registrationResponse(project) {
  const source = `if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("${project.prefix}/sw.js", { scope: "${project.prefix}/" }).catch(() => {});
  });
}`;
  return new Response(source, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}

async function proxyIntelRoot(request, incoming) {
  const upstream = new URL("http://intel3000.g1ftb0x.com:3000");
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.set("host", upstream.host);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-g1ftb0x-project", "intel3000");

  const upstreamRequest = new Request(upstream.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });

  return fetch(upstreamRequest);
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    if (
      incoming.pathname === "/api" ||
      incoming.pathname.startsWith("/api/") ||
      incoming.pathname === "/ws"
    ) {
      return proxyIntelRoot(request, incoming);
    }

    const project = matchProject(incoming.pathname);
    if (!project) return fetch(request);

    const relativePath = incoming.pathname.slice(project.prefix.length) || "/";

    if (relativePath === "/manifest.webmanifest") return manifestResponse(project);
    if (relativePath === "/sw.js") return serviceWorkerResponse(project);
    if (relativePath === "/pwa/register.js") return registrationResponse(project);

    if (relativePath.startsWith("/pwa/")) {
      return env.ASSETS.fetch(request);
    }

    let upstreamPath = relativePath;
    if (!upstreamPath.startsWith("/")) upstreamPath = "/" + upstreamPath;
    const upstream = new URL(project.origin || "https://g1ftb0x-service.internal");
    upstream.pathname = upstreamPath;
    upstream.search = incoming.search;

    const headers = new Headers(request.headers);
    if (project.origin) headers.set("host", upstream.host);
    headers.set("x-g1ftb0x-project", project.slug);

    const upstreamRequest = new Request(upstream.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    const response = project.binding
      ? await env[project.binding].fetch(upstreamRequest)
      : await fetch(upstreamRequest);
    const outHeaders = new Headers(response.headers);
    outHeaders.set("x-g1ftb0x-router", "1");

    const location = outHeaders.get("location");
    if (location) {
      try {
        const target = new URL(location, upstream);
        if (target.origin === upstream.origin) outHeaders.set("location", project.prefix + target.pathname + target.search + target.hash);
      } catch {}
    }

    const type = response.headers.get("content-type") || "";
    if (response.body && (type.includes("text/html") || type.includes("javascript") || type.includes("text/css"))) {
      let text = await response.text();
      text = rewriteProjectPaths(text, project);
      if (type.includes("text/html")) text = injectPwa(text, project);
      outHeaders.delete("content-length");
      outHeaders.delete("content-encoding");
      return new Response(text, { status: response.status, statusText: response.statusText, headers: outHeaders });
    }

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outHeaders });
  },
};
