const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Broaden hasGenIntent
code = code.replace(
  /const hasGenIntent = \/\(create\|generate\|make\|build\|export\|modify\|fix\|refactor\|add\)\.\*\(\\\.py\|\\\.js\|\\\.ts\|\\\.jsx\|\\\.tsx\|\\\.html\|\\\.css\|\\\.sql\|\\\.sh\|\\\.json\|\\\.md\|word\|document\|docx\|excel\|xlsx\|spreadsheet\|presentation\|pptx\|powerpoint\|pdf\|csv\|diagram\|architecture\|file\|component\|feature\|report\)\/i\.test\(textMsg\);/,
  `const hasGenIntent = /(create|generate|make|build|export|modify|fix|refactor|add|write|code).*(\\.\\w+|python|javascript|typescript|html|css|java|cpp|c\\+\\+|c#|csharp|php|sql|json|yaml|yml|md|markdown|jupyter|notebook|word|document|docx|excel|xlsx|spreadsheet|presentation|pptx|powerpoint|pdf|csv|diagram|architecture|file|component|feature|report|program|app|application|script|code|website|page)/i.test(textMsg);`
);

fs.writeFileSync('server.ts', code);
