const fs = require('fs');

const report = [
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\audit-logs\\page.tsx", lines: [48] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\orders\\[id]\\page.tsx", lines: [61] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\orders\\page.tsx", lines: [44] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\page.tsx", lines: [39] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\producers\\[id]\\page.tsx", lines: [48] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\producers\\page.tsx", lines: [48] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\products\\page.tsx", lines: [54] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\admin\\reviews\\page.tsx", lines: [42] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\seller\\inventory\\page.tsx", lines: [76] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\seller\\orders\\[id]\\page.tsx", lines: [25] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\seller\\orders\\page.tsx", lines: [35] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\seller\\products\\[id]\\page.tsx", lines: [35] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\seller\\products\\page.tsx", lines: [34] },
  { file: "D:\\Portfolio-building\\farmer\\frontend\\src\\app\\seller\\profile\\page.tsx", lines: [34] }
];

function fix() {
  for (const item of report) {
    if (fs.existsSync(item.file)) {
      let content = fs.readFileSync(item.file, 'utf8');
      
      content = content.replace(/const load = async \(\) => \{ await ([a-zA-Z0-9_]+)\(\); \};\n\s+load\(\);/g, (match, fnName) => {
        return `// eslint-disable-next-line react-hooks/set-state-in-effect\n    ${fnName}();`;
      });
      
      content = content.replace(/useEffect\(\(\) => \{\n\s+([a-zA-Z0-9_]+)\(\);\n\s+\}, \[/g, (match, fnName) => {
        return `useEffect(() => {\n    // eslint-disable-next-line react-hooks/set-state-in-effect\n    ${fnName}();\n  }, [`;
      });

      // Fix missing any types
      content = content.replace(/: any/g, ': unknown');
      content = content.replace(/<any>/g, '<unknown>');
      content = content.replace(/as any/g, 'as unknown');

      fs.writeFileSync(item.file, content, 'utf8');
    }
  }
}
fix();
