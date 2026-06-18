const fs = require('fs');
const src = fs.readFileSync('src/lib/i18n.ts', 'utf8');

const zhStart = src.indexOf('  zh: {', 1000);
let depth = 0;
let zhEnd = zhStart;
for (let i = zhStart; i < src.length; i++) {
  if (src[i] === '{') depth++;
  if (src[i] === '}') { depth--; if (depth === 0) { zhEnd = i + 1; break; } }
}
const zhBlock = src.substring(zhStart, zhEnd);

const enStart = src.indexOf('  en: {', 1000);
const enBlock = src.substring(enStart, zhStart);

function extractKeyValues(text) {
  const result = {};
  const lines = text.split('\n');
  const prefixes = [];
  
  for (let line of lines) {
    const indent = line.search(/\S/);
    if (indent < 4) { prefixes.length = 0; continue; }
    
    const trimmed = line.trim();
    const keyMatch = trimmed.match(/^(\w+):\s*(.*)/);
    if (!keyMatch) continue;
    
    const key = keyMatch[1];
    const value = keyMatch[2];
    
    while (prefixes.length > 0 && prefixes[prefixes.length - 1].indent >= indent) {
      prefixes.pop();
    }
    
    if (value.startsWith('{')) {
      prefixes.push({ prefix: key, indent });
    } else if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
      const currentPrefix = prefixes.length > 0 ? prefixes[prefixes.length - 1].prefix : '';
      const fullKey = currentPrefix ? currentPrefix + '.' + key : key;
      result[fullKey] = value;
    }
  }
  return Object.keys(result);
}

const enKeys = new Set(extractKeyValues(enBlock));
const zhKeys = new Set(extractKeyValues(zhBlock));

console.log('EN total keys:', enKeys.size);
console.log('ZH total keys:', zhKeys.size);

const missingInZh = [...enKeys].filter(k => !zhKeys.has(k));
const extraInZh = [...zhKeys].filter(k => !enKeys.has(k));

if (missingInZh.length > 0) {
  console.log('\n=== Missing in ZH (' + missingInZh.length + ') ===');
  const bySection = {};
  missingInZh.forEach(k => {
    const parts = k.split('.');
    const section = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
    if (!bySection[section]) bySection[section] = [];
    bySection[section].push(k);
  });
  for (const [section, keys] of Object.entries(bySection).sort((a,b) => b[1].length - a[1].length)) {
    console.log('  ' + section + ': ' + keys.length);
    keys.slice(0, 3).forEach(k => console.log('    ' + k));
  }
}

if (extraInZh.length > 0) {
  console.log('\n=== Extra in ZH (' + extraInZh.length + ') ===');
  extraInZh.slice(0, 10).forEach(k => console.log('  ' + k));
}
