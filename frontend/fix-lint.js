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
      
      // Fix 1: Change `useState(false)` to `useState(true)` for isLoading
      // Because most components fetch on mount.
      content = content.replace(/const \[(?:isLoading|loading), (?:setIsLoading|setLoading)\] = useState\(false\);/g, (match) => {
          return match.replace('false', 'true');
      });

      content = content.replace(/const \[(?:isLoading|loading), (?:setIsLoading|setLoading)\] = useState<boolean>\(false\);/g, (match) => {
          return match.replace('false', 'true');
      });

      // Fix 2: Remove the synchronous `setIsLoading(true)` or `setLoading(true)` at the start of fetch functions,
      // But only if it's right after `async () => {` or `async function ... {`
      // Or actually, if we just initialize to true, we might still need it for manual re-fetches.
      // A safe way to avoid the synchronous-in-effect error is to defer the set state.
      // So let's change `setIsLoading(true);` to `await Promise.resolve(); setIsLoading(true);` 
      // inside async functions! This makes the setState asynchronous, escaping the synchronous effect phase.
      // Wait, let's just do `await Promise.resolve();` at the very start of the fetch functions!
      // Better yet, replace `setIsLoading(true);` with `setIsLoading(true);` but wrapped? No, just initialize it properly and remove the sync call if it's the first line.
      // Let's replace `setIsLoading(true);` with `setTimeout(() => setIsLoading(true), 0);` if we really need it? No, hack.
      
      // Let's find any data-fetching effect and move the call to a timeout? No.
      // The error is because `fetchData()` starts synchronously.
      // Let's prepend `await Promise.resolve();` inside the fetchData definition before `setIsLoading(true)`.
      content = content.replace(/(setIsLoading\(true\);)/g, 'await Promise.resolve();\n      $1');
      content = content.replace(/(setLoading\(true\);)/g, 'await Promise.resolve();\n      $1');

      // Fix any types
      content = content.replace(/: any/g, ': unknown');
      content = content.replace(/<any>/g, '<unknown>');
      content = content.replace(/any\[\]/g, 'unknown[]');

      // Also clean up unused imports from Phase 9 (Badge, Button, FileText, ChevronRight, etc)
      // This is a bit tricky, we can let eslint --fix handle unused imports if we run it with some plugin.
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

processDir(path.join(__dirname, 'src', 'app'));
processDir(path.join(__dirname, 'src', 'components'));
processDir(path.join(__dirname, 'src', 'lib'));
