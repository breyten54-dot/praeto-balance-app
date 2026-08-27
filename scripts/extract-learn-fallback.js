const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../backend/prisma/seed.ts'), 'utf8');
const start = src.indexOf('const learnModules = [');
const end = src.indexOf('\n  for (const m of learnModules)');
if (start < 0 || end < 0) {
  console.error('Could not find learnModules in seed.ts');
  process.exit(1);
}
const block = src.slice(start, end);
const re =
  /id: '([^']+)',\s*pillar: (\d+),\s*orderIndex: (\d+),\s*title: '([^']*)',\s*subtitle: '((?:\\'|[^'])*)',\s*bodyMarkdown: `([\s\S]*?)`/g;
const mods = [];
let m;
while ((m = re.exec(block))) {
  mods.push({
    id: m[1],
    pillar: Number(m[2]),
    orderIndex: Number(m[3]),
    title: m[4],
    subtitle: m[5].replace(/\\'/g, "'"),
    bodyMarkdown: m[6].trim(),
  });
}
if (mods.length !== 12) {
  console.error('expected 12 modules, got', mods.length);
  process.exit(1);
}
const out = path.join(__dirname, '../src/content/learnModulesFallback.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(mods, null, 2));
console.log('wrote', out, mods.length);
