const fs = require('fs');

function fix() {
  const processDir = (d) => {
    const files = fs.readdirSync(d);
    for (const f of files) {
      const full = d + '/' + f;
      if (fs.statSync(full).isDirectory()) processDir(full);
      else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
        let content = fs.readFileSync(full, 'utf8');
        
        // Revert catch (err: unknown) back to catch (err: any) or fix it
        content = content.replace(/catch \(err: unknown\)/g, 'catch (err: any)');
        
        // Revert params: unknown back to params: any
        content = content.replace(/params: unknown/g, 'params: any');
        
        // Revert Object is of type 'unknown' cases
        content = content.replace(/<unknown>/g, '<any>');
        content = content.replace(/: unknown/g, ': any');
        content = content.replace(/as unknown/g, 'as any');
        content = content.replace(/unknown\[\]/g, 'any[]');

        // Fix duplicate alt props
        content = content.replace(/alt="Image" alt=/g, 'alt=');

        fs.writeFileSync(full, content);
      }
    }
  }
  processDir('src');
}
fix();
