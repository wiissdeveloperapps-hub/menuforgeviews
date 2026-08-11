const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');

const sandbox = {
  window: {
    location: { hash: '', pathname: '/', search: '', href: 'http://localhost/' },
    history: { pushState() {}, back() {}, length: 1 },
    addEventListener() {},
    scrollTo() {},
    open() {},
    print() {},
    matchMedia() { return { matches: false }; },
    pageYOffset: 0
  },
  document: {
    body: { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    addEventListener() {},
    getElementById(id) {
      if (id === 'print-container') return { innerHTML: '', style: {} };
      return { innerHTML: '', textContent: '', value: '', style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, appendChild() {}, addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null }, src: '' };
    },
    createElement() { return { style: {}, addEventListener() {}, appendChild() {}, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } }; },
    querySelectorAll() { return []; },
    querySelector() { return null }
  },
  navigator: { language: 'es-ES' },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
  console,
  setTimeout,
  clearTimeout,
  fetch: async () => ({ ok: true, text: async () => '' }),
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  LZString: { decompressFromEncodedURIComponent: (value) => value },
  pako: { inflate() { return '{}'; } },
  IntersectionObserver: class { observe() {} disconnect() {} }
};

const context = vm.createContext(sandbox);
vm.runInContext(source, context);
const app = vm.runInContext('app', context);

app.data = {
  restaurantInfo: {},
  menus: [
    { id: 'menu-1', tipoMenu: 'normal', traducciones: { es: { nombreCarta: 'Carta 1', categorias: [{ nombre: 'Entrantes', platos: [{ nombre: 'Pan', precio: 3 }] }] } } },
    { id: 'menu-2', tipoMenu: 'normal', traducciones: { es: { nombreCarta: 'Carta 2', categorias: [{ nombre: 'Postres', platos: [{ nombre: 'Tarta', precio: 5 }] }] } } }
  ]
};
app.currentLang = 'es';
app.currentView = 'menu';
app.currentMenuId = 'menu-2';

const printableMenus = app.getPrintableMenus();
assert.strictEqual(printableMenus.length, 1, 'Should print only the active menu when browsing a menu');
assert.strictEqual(printableMenus[0].id, 'menu-2');
console.log('viewer regression test passed');
