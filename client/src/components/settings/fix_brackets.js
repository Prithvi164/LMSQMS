const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'user-management.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix line 1120 - replace ))} with closing brace properly
content = content.replace(
  /(process\.name}\s*<\/div>\s*<\/CommandItem>\s*)\)\)\}/g,
  '$1);\n                            })}'
);

fs.writeFileSync(filePath, content);
console.log('Fixes applied!');
