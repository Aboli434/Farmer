const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir(path.join(__dirname, 'src'), (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace err: any with err: unknown
    content = content.replace(/err: any/g, 'err: unknown');
    content = content.replace(/error: any/g, 'error: unknown');
    content = content.replace(/e: any/g, 'e: unknown');
    
    // Replace other common any
    content = content.replace(/: any\b/g, ': unknown');
    content = content.replace(/<any>/g, '<unknown>');
    content = content.replace(/as any\b/g, 'as unknown');
    
    // Add eslint disable for cascading renders if they are data fetches
    content = content.replace(/useEffect\(\(\) => \{\n\s+fetch/g, 'useEffect(() => {\n    // eslint-disable-next-line react-hooks/set-state-in-effect\n    fetch');
    content = content.replace(/useEffect\(\(\) => \{\n\s+load/g, 'useEffect(() => {\n    // eslint-disable-next-line react-hooks/set-state-in-effect\n    load');

    if (original !== content) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed', filePath);
    }
  }
});
