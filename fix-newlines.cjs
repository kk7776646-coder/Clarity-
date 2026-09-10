const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// A simple pass: find " ... " and ' ... ' strings and replace \n inside them with \\n.
let newCode = "";
let inString = false;
let stringChar = '';

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const prevC = i > 0 ? code[i-1] : '';

  if (!inString) {
    if ((c === '"' || c === "'") && prevC !== '\\') {
      inString = true;
      stringChar = c;
      newCode += c;
    } else {
      newCode += c;
    }
  } else {
    if (c === stringChar && prevC !== '\\') {
      inString = false;
      newCode += c;
    } else if (c === '\n') {
      newCode += '\\n';
    } else if (c === '\r') {
      newCode += '\\r';
    } else {
      newCode += c;
    }
  }
}

fs.writeFileSync('server.ts', newCode);
console.log("Fixed newlines in strings");
