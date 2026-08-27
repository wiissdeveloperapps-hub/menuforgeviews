/**
 * Genera docs/ (lo que sirve GitHub Pages) a partir del código fuente legible del repo.
 * El código fuente (js/, css/, index.html...) nunca se toca -esto solo produce una copia
 * minificada aparte-. Se ejecuta automáticamente en el pre-commit (ver .githooks/pre-commit),
 * pero también puede lanzarse a mano con: npm run build
 */
const fs = require('fs');
const path = require('path');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');

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
      const resultado = await minifyJs(codigo, { format: { comments: false } });
      if (resultado.error) throw resultado.error;
      fs.writeFileSync(rutaDestino, resultado.code, 'utf8');
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
