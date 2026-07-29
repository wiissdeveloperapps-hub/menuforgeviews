export default {
async fetch(request, env, ctx) {
const url = new URL(request.url);
const debug = url.searchParams.get('debug') === '1' || request.headers.get('x-debug') === '1';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "*",
};

if (request.method === "OPTIONS") {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// =========================================================
// CASO 1: Petición de la App (Angular) hacia la API de GitHub
// =========================================================
if (url.pathname.startsWith('/repos/')) {
  try {
    const targetUrl = new URL("https://api.github.com" + url.pathname + url.search);
    
    const options = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': request.headers.get('Accept') || 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Worker-MenuForge',
        'Authorization': env.GITHUB_TOKEN ? `token ${env.GITHUB_TOKEN}` : (request.headers.get('Authorization') || '')
      },
      redirect: 'follow'
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      options.body = await request.text();
    }

    const apiResponse = await fetch(targetUrl, options);
    const responseText = await apiResponse.text();
    
    return new Response(responseText, {
      status: apiResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": apiResponse.headers.get("Content-Type") || "application/json"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: "Error en el proxy API: " + e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// =========================================================
// CASO 2: Petición del JSON de restaurante vía GitHub API (Cero retraso)
// =========================================================
if (url.pathname.includes('/restaurants/') && url.pathname.endsWith('.json')) {
    let repoName = 'menuforgeviews';
    const hostMatch = url.hostname.match(/^n(\d+)\./i);
    if (hostMatch && hostMatch[1] !== '1') {
        repoName = `menuforgeviewsN${hostMatch[1]}`;
    }

    const apiUrl = `https://api.github.com/repos/wiissdeveloperapps-hub/${repoName}/contents${url.pathname}`;
    
    try {
        const apiRes = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-Worker-MenuForge',
            'Authorization': env.GITHUB_TOKEN ? `token ${env.GITHUB_TOKEN}` : ''
          }
        });

        if (!apiRes.ok) {
          return new Response(JSON.stringify({ error: "No encontrado" }), { 
            status: apiRes.status, 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
          });
        }

        const data = await apiRes.json();
        
        const cleanBase64 = data.content.replace(/\s/g, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const textData = new TextDecoder('utf-8').decode(bytes);

        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
        responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        responseHeaders.set('Pragma', 'no-cache');
        responseHeaders.set('Expires', '0');
        responseHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(textData, {
            status: 200,
            headers: responseHeaders
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: "Error leyendo de GitHub API: " + e.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
        });
    }
}

// =========================================================
// CASO 3: Carga del Visor Web (HTML, JS, CSS) -> SIEMPRE DESDE N1
// Primero intenta leer desde la API de GitHub (/contents) para evitar caches.
// =========================================================
let targetPath = url.pathname;
if (targetPath === '/') {
  targetPath = '/menuforgeviews/';
} else {
  targetPath = '/menuforgeviews' + targetPath;
}

const hasExtension = /\.[^\/]+$/.test(targetPath);
const isStaticAsset = /\.(html|js|css|json|map)$/i.test(targetPath) || targetPath.endsWith('/') || !hasExtension;
const owner = 'wiissdeveloperapps-hub';
let repoName = 'menuforgeviews';
const hostMatch = url.hostname.match(/^n(\d+)\./i);
if (hostMatch && hostMatch[1] !== '1') repoName = `menuforgeviewsN${hostMatch[1]}`;

if (isStaticAsset) {
  // Para la API usamos la ruta relativa al repo: eliminar el prefijo /menuforgeviews
  let apiPath = targetPath.replace(/^\/menuforgeviews/, '');
  if (!apiPath || apiPath === '/') apiPath = '/index.html';
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents${apiPath}`;
  try {
    const apiRes = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Worker-MenuForge',
        'Authorization': env.GITHUB_TOKEN ? `token ${env.GITHUB_TOKEN}` : ''
      }
    });
    let apiInfo = { attempted: true, ok: false, status: null };
    apiInfo.status = apiRes.status;

    if (apiRes.ok) {
      apiInfo.ok = true;
      const data = await apiRes.json();
      const cleanBase64 = (data.content || '').replace(/\s/g, '');
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const textData = new TextDecoder('utf-8').decode(bytes);

      const ct = (() => {
        if (/\.(js)$/i.test(targetPath)) return 'application/javascript; charset=utf-8';
        if (/\.(css)$/i.test(targetPath)) return 'text/css; charset=utf-8';
        if (/\.(json|map)$/i.test(targetPath)) return 'application/json; charset=utf-8';
        return 'text/html; charset=utf-8';
      })();

      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', ct);
      responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      responseHeaders.set('Pragma', 'no-cache');
      responseHeaders.set('Expires', '0');
      responseHeaders.set('Access-Control-Allow-Origin', '*');

      return new Response(textData, { status: 200, headers: responseHeaders });
    }
    // si API devuelve error, continuamos al fetch normal
  } catch (e) {
    if (debug) {
      return new Response(JSON.stringify({ error: 'API error', message: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    // continuar al fetch normal
  }
}

// Si no es asset estático o la API falló, caer al fetch directo a github.io con cache-buster
const targetUrl = new URL(targetPath + url.search, "https://wiissdeveloperapps-hub.github.io");
targetUrl.searchParams.set('_', Date.now().toString());

const outgoingHeaders = new Headers(request.headers);
outgoingHeaders.delete('If-None-Match');
outgoingHeaders.delete('If-Modified-Since');
outgoingHeaders.set('Cache-Control', 'no-cache');
outgoingHeaders.set('Pragma', 'no-cache');

const options = {
  method: request.method,
  headers: outgoingHeaders,
  redirect: "follow",
  cf: { cacheTtl: 0, cacheEverything: false }
};

if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
  options.body = await request.text();
}

// Purge edge cache when requested via ?purge=1 or header x-purge-cache: 1
const purgeRequested = url.searchParams.get('purge') === '1' || request.headers.get('x-purge-cache') === '1';
if (purgeRequested) {
  try { await caches.default.delete(targetUrl.toString()); } catch (e) { /* ignore */ }
}

try {
  const response = await fetch(targetUrl, options);

  if (debug) {
    const clone = response.clone();
    const text = await clone.text().catch(() => '<binary>');
    const debugInfo = {
      stage: 'fetched_github_io',
      targetUrl: targetUrl.toString(),
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      preview: text.slice(0, 1000)
    };
    return new Response(JSON.stringify(debugInfo, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('ETag');
  responseHeaders.delete('Last-Modified');
  responseHeaders.delete('Age');
  responseHeaders.delete('Surrogate-Control');
  responseHeaders.delete('X-Cache');
  responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  responseHeaders.set('Pragma', 'no-cache');
  responseHeaders.set('Expires', '0');
  responseHeaders.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
} catch (e) {
  return new Response("Error al cargar el visor: " + e.message, { status: 500 });
}
}
};