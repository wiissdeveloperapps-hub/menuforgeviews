/**
 * Genera docs/ (lo que sirve GitHub Pages) a partir del código fuente legible del repo.
 * El código fuente (js/, css/, index.html...) nunca se toca -esto solo produce una copia
 * minificada aparte-. Se ejecuta automáticamente en el pre-commit (ver .githooks/pre-commit),
 * pero también puede lanzarse a mano con: npm run build
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const CleanCSS = require('clean-css');

// renameGlobals y renameProperties van en false a propósito: el HTML llama a los métodos
// como texto plano (onclick="app.toggleWifiModal()"), así que si se renombraran esos
// nombres, esos enganches se romperían. Todo lo demás (variables locales, strings, flujo
// de control dentro de cada función) sí se ofusca a fondo.
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  selfDefending: false,
  debugProtection: false,
  target: 'browser'
};

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');

// Carpetas/archivos del repo que NO forman parte de la web servida.
const EXCLUDE = new Set([
  'docs', 'node_modules', '.git', '.github', '.githooks',
  'scripts', 'tests', 'workflows', 'package.json', 'package-lock.json',
  'README.md', '.gitignore', '.gitattributes'
]);

function limpiarDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

async function copiarYMinificar(origen, destino) {
  const entradas = fs.readdirSync(origen, { withFileTypes: true });
  for (const entrada of entradas) {
    const rutaOrigen = path.join(origen, entrada.name);
    const rutaDestino = path.join(destino, entrada.name);

    if (origen === ROOT && EXCLUDE.has(entrada.name)) continue;

    if (entrada.isDirectory()) {
      fs.mkdirSync(rutaDestino, { recursive: true });
      await copiarYMinificar(rutaOrigen, rutaDestino);
      continue;
    }

    if (entrada.name.endsWith('.js')) {
      const codigo = fs.readFileSync(rutaOrigen, 'utf8');
      const resultado = JavaScriptObfuscator.obfuscate(codigo, OBFUSCATOR_OPTIONS);
      fs.writeFileSync(rutaDestino, resultado.getObfuscatedCode(), 'utf8');
    } else if (entrada.name.endsWith('.css')) {
      const codigo = fs.readFileSync(rutaOrigen, 'utf8');
      const resultado = new CleanCSS({}).minify(codigo);
      if (resultado.errors.length) throw new Error(resultado.errors.join('\n'));
      fs.writeFileSync(rutaDestino, resultado.styles, 'utf8');
    } else {
      fs.copyFileSync(rutaOrigen, rutaDestino);
    }
  }
}

(async () => {
  const inicio = Date.now();
  limpiarDir(OUT);
  await copiarYMinificar(ROOT, OUT);
  console.log(`docs/ generado en ${Date.now() - inicio}ms`);
})().catch(e => {
  console.error('Error generando docs/:', e);
  process.exit(1);
});
