const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\Павлик\\Desktop\\месенджер';

function shouldIgnore(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel.startsWith('node_modules') || rel.includes('/node_modules/')) return true;
  if (rel.startsWith('client/dist') || rel.includes('/dist/')) return true;
  if (rel.startsWith('исходник тг') || rel.includes('/исходник тг/')) return true;
  if (rel.startsWith('фоны чата') || rel.includes('/фоны чата/')) return true;
  if (rel.startsWith('.git')) return true;
  const base = path.basename(filePath);
  if (['.env','git-install.exe','portable-git.exe','gh-desktop.exe','tunnel.txt','tunnel.bat','tunnel.js','deploy.js','package-lock.json','messenger.db','.gitignore','start.bat','start.ps1','tunnel_url.txt'].includes(base)) return true;
  return false;
}

function walk(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldIgnore(full)) continue;
    if (entry.isDirectory()) results.push(...walk(full));
    else {
      const s = fs.statSync(full);
      if (s.size <= 5*1024*1024) results.push(path.relative(ROOT, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

const files = walk(ROOT);
console.log('Total files:', files.length);
const byDir = {};
files.forEach(f => {
  const d = f.split('/')[0];
  byDir[d] = (byDir[d] || 0) + 1;
});
console.log(byDir);
