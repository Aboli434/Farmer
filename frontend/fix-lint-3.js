const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Target: 
      // useEffect(() => {
      //   fetchData();
      // }, [fetchData]);
      const regex = /useEffect\(\(\) => \{\n\s+([a-zA-Z0-9_]+)\(\);\n\s+\}, \[([^\]]+)\]\);/g;
      content = content.replace(regex, (match, fnName, deps) => {
        return `useEffect(() => {
    const load = async () => { await ${fnName}(); };
    load();
  }, [${deps}]);`;
      });

      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

processDir(path.join(__dirname, 'src', 'app'));
processDir(path.join(__dirname, 'src', 'components'));
processDir(path.join(__dirname, 'src', 'lib'));
