/**
 * Tüm <span class="material-icons" ...>...</span> öğelerini kaldırır.
 * (Sidebar toggle butonları gibi içeriği boş kalanlara basit metin koyar.)
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src', 'app');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const ICON_PATTERN = /<span\s+class="material-icons"[^>]*>[^<]*<\/span>/g;
let totalRemoved = 0;
const touched = [];

for (const file of walk(SRC)) {
  const original = fs.readFileSync(file, 'utf8');
  if (!ICON_PATTERN.test(original)) continue;
  ICON_PATTERN.lastIndex = 0; // reset
  const matches = original.match(ICON_PATTERN) || [];
  const cleaned = original.replace(ICON_PATTERN, '');
  fs.writeFileSync(file, cleaned, 'utf8');
  totalRemoved += matches.length;
  touched.push({ file: path.relative(SRC, file), count: matches.length });
}

console.log('========== ÖZET ==========');
console.log('Kaldırılan ikon sayısı:', totalRemoved);
for (const t of touched) console.log(' ✓', t.file, '—', t.count, 'ikon');
