/**
 * Inline component styles'ı .scss dosyalarına dönüştürür.
 * Her `*.component.ts` dosyasında `styles: [`...`]` bloğunu bulur,
 * içeriği `<same-name>.component.scss` dosyasına yazar,
 * decorator'da `styleUrls: ['./<name>.component.scss']` ile değiştirir.
 *
 * Çalıştırma: node scripts/convert-styles-to-scss.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src', 'app');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name.endsWith('.component.ts') && !name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

function findStylesBlock(content) {
  // styles: [`...`]  — backtick içeriği multi-line olabilir
  // İlk `styles: [\`` indeksi
  const startMatch = content.match(/(\s*)styles:\s*\[\s*`/);
  if (!startMatch) return null;
  const startIdx = startMatch.index;
  // İçerik backtick sonrası
  const contentStart = startMatch.index + startMatch[0].length;
  // Kapanış: `\n  `]   veya `]   — `` `] `` arama
  // Backtick + `]` aramamız gerek; backtick içinde ${} olabilir ama biz CSS sınıfından bekliyoruz, escape karakter yok kabul ediyoruz
  const remainder = content.slice(contentStart);
  // İlk `\`\\s*\\]` bul
  const endMatch = remainder.match(/`\s*\]/);
  if (!endMatch) return null;
  const contentEnd = contentStart + endMatch.index;
  const blockEnd = contentEnd + endMatch[0].length;
  return {
    blockStart: startIdx,
    blockEnd,
    cssContent: content.slice(contentStart, contentEnd),
    leadingWhitespace: startMatch[1] || ''
  };
}

function indentNormalize(css) {
  // Trim leading/trailing newlines
  return css.replace(/^\s*\n/, '').replace(/\s+$/, '\n');
}

let converted = 0;
let skipped = 0;
const errors = [];

const files = walk(SRC);
for (const file of files) {
  try {
    const original = fs.readFileSync(file, 'utf8');
    const block = findStylesBlock(original);
    if (!block) { skipped++; continue; }

    const baseName = path.basename(file, '.ts');
    const scssPath = path.join(path.dirname(file), baseName + '.scss');

    // SCSS yazma (eğer aynı isimde varsa overwrite et — ama bilgi ver)
    fs.writeFileSync(scssPath, indentNormalize(block.cssContent), 'utf8');

    // Decorator'da styles: [...] → styleUrls: ['./<basename>.scss']
    const replacement = `${block.leadingWhitespace}styleUrls: ['./${baseName}.scss']`;
    const updated = original.slice(0, block.blockStart) + replacement + original.slice(block.blockEnd);
    fs.writeFileSync(file, updated, 'utf8');

    converted++;
    console.log('✓', path.relative(SRC, file));
  } catch (e) {
    errors.push({ file, message: e.message });
  }
}

console.log('\n========== ÖZET ==========');
console.log('Dönüştürülen:', converted);
console.log('Atlanan (inline style yok):', skipped);
if (errors.length) {
  console.log('Hatalar:');
  for (const e of errors) console.log(' -', e.file, ':', e.message);
}
