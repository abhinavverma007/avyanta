// Verifies every English key has a Hindi translation (and vice versa), and
// that no value is empty. Usage: node scripts/check-i18n.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/app/core/i18n/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
let bad = 0;
const load = (lang, f) => JSON.parse(readFileSync(join(root, lang, f), 'utf8'));
const seen = { en: {}, hi: {} };

for (const f of readdirSync(join(root, 'en')).filter((x) => x.endsWith('.json'))) {
  for (const lang of ['en', 'hi']) {
    const d = load(lang, f);
    for (const [k, v] of Object.entries(d)) {
      if (k in seen[lang]) { console.log(`DUPLICATE ${lang} key: ${k} (${f})`); bad++; }
      seen[lang][k] = v;
      if (!String(v).trim()) { console.log(`EMPTY ${lang}/${f}: ${k}`); bad++; }
    }
  }
}
for (const k of Object.keys(seen.en)) if (!(k in seen.hi)) { console.log(`MISSING hi: ${k}`); bad++; }
for (const k of Object.keys(seen.hi)) if (!(k in seen.en)) { console.log(`MISSING en: ${k}`); bad++; }
console.log(bad ? `${bad} problem(s)` : `OK — ${Object.keys(seen.en).length} keys in sync`);
process.exit(bad ? 1 : 0);
