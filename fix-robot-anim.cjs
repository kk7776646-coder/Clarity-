const fs = require('fs');
let compCss = fs.readFileSync('css/components.css', 'utf8');

// Update robot animations
compCss = compCss.replace(/@keyframes robot-float-idle \{.*?\}/s, 
`@keyframes robot-float-idle { 
  0%, 100% { transform: translateY(0); } 
  50% { transform: translateY(-2px); } 
}`);

compCss = compCss.replace(/@keyframes robot-float-thinking \{.*?\}/s, 
`@keyframes robot-float-thinking { 
  0%, 100% { transform: translateY(0) rotate(-0.5deg); } 
  50% { transform: translateY(-1px) rotate(0.5deg); } 
}`);

compCss = compCss.replace(/@keyframes robot-respond \{.*?\}/s, 
`@keyframes robot-respond { 
  0% { transform: translateY(0) scale(1); } 
  40% { transform: translateY(-3px) scale(1.01); } 
  100% { transform: translateY(0) scale(1); } 
}`);

fs.writeFileSync('css/components.css', compCss, 'utf8');
console.log("Animations softened.");
