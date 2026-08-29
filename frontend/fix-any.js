const fs = require('fs');
const path = require('path');

const files = [
  'src/lib/api/admin.ts',
  'src/lib/api/seller.ts',
  'src/types/admin.ts',
  'src/types/seller.ts',
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/: any/g, ': unknown');
    content = content.replace(/as any/g, 'as unknown');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
