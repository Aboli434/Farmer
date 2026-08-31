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
      
      // Target variations of:
      // useEffect(() => {
      //   fetchData();
      // }, [fetchData]);
      const regex = /useEffect\(\(\) => \{\s+([a-zA-Z0-9_]+)\(\);\s+\},\s+\[([^\]]*)\]\);/g;
      let changed = false;
      content = content.replace(regex, (match, fnName, deps) => {
        changed = true;
        return `useEffect(() => {\n    const load = async () => { await ${fnName}(); };\n    load();\n  }, [${deps}]);`;
      });

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

processDir(path.join(__dirname, 'src', 'app'));
processDir(path.join(__dirname, 'src', 'components'));
processDir(path.join(__dirname, 'src', 'lib'));
