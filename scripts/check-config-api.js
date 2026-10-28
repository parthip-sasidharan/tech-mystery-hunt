const fs = require('fs');
const content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('fetch(') && l.includes('/api/')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
