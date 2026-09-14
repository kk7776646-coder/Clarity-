const fs = require('fs');

// 1. Update JS to put the robot back
let chatJs = fs.readFileSync('js/ui/chat.js', 'utf8');

const chatLogoRegex = /'<div class="chat-empty__logo".*?<\/div>',/s;
if (chatLogoRegex.test(chatJs)) {
    const robotHtml = `      '<div class="clarity-robot" id="clarityRobot" data-state="idle">',
      '  <div class="clarity-robot__ring"></div>',
      '  <div class="clarity-robot__head">',
      '    <div class="clarity-robot__face">',
      '      <div class="clarity-robot__eyes">',
      '        <div class="clarity-robot__eye"></div>',
      '        <div class="clarity-robot__eye"></div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>',`;
      
    chatJs = chatJs.replace(chatLogoRegex, robotHtml);
    
    // Also remove the old inline <style> that handled the logo animation
    const styleRegex = /'<style>',\s*'@keyframes breath.*?<\/style>'/s;
    chatJs = chatJs.replace(styleRegex, '');
    
    fs.writeFileSync('js/ui/chat.js', chatJs, 'utf8');
    console.log("Robot HTML restored in chat.js.");
} else {
    console.log("Could not find chat-empty__logo in chat.js.");
}

// 2. Update CSS to make it premium
let compCss = fs.readFileSync('css/components.css', 'utf8');

const cssStartMarker = '/* Clarity Robot Animated UI Character */';
const cssEndMarker = '.chat-empty__title {'; // End of the robot section

const startIndex = compCss.indexOf(cssStartMarker);
const endIndex = compCss.indexOf(cssEndMarker, startIndex);

if (startIndex > -1 && endIndex > -1) {
    const premiumCss = `/* Clarity Robot Animated UI Character - Premium Refinement */
.clarity-robot {
  width: 72px;
  height: 72px;
  margin: 0 auto 28px auto;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}

.clarity-robot__head {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.3s ease, box-shadow 0.3s ease;
  z-index: 2;
  /* Premium light shell */
  background: radial-gradient(circle at 35% 25%, #ffffff 0%, #f8fafc 40%, #e2e8f0 80%, #cbd5e1 100%);
  box-shadow: 
    0 16px 32px -8px rgba(0, 0, 0, 0.08),
    0 8px 16px -4px rgba(0, 0, 0, 0.04),
    inset -4px -6px 12px rgba(15, 23, 42, 0.06),
    inset 4px 6px 12px rgba(255, 255, 255, 0.9),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5); /* subtle rim */
}

.dark .clarity-robot__head {
  /* Premium dark shell - slate but legible */
  background: radial-gradient(circle at 35% 25%, #334155 0%, #1e293b 50%, #0f172a 100%);
  box-shadow: 
    0 16px 32px -8px rgba(0, 0, 0, 0.6),
    0 8px 16px -4px rgba(0, 0, 0, 0.4),
    inset -4px -6px 12px rgba(0, 0, 0, 0.5),
    inset 4px 6px 16px rgba(148, 163, 184, 0.15),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05); /* dark mode rim */
}

.clarity-robot__ring {
  position: absolute;
  width: 82%;
  height: 60%;
  border-radius: 50%;
  /* Clarity brand colors: Purple #7C3AED, Cyan #06B6D4 */
  background: linear-gradient(90deg, #7C3AED, #06B6D4, #7C3AED);
  background-size: 200% 100%;
  animation: robot-ring-spin 4s linear infinite;
  filter: blur(8px);
  opacity: 0.4;
  z-index: 1;
  transition: opacity 0.4s ease, filter 0.4s ease, transform 0.4s ease;
  transform: translateY(2px);
}

.dark .clarity-robot__ring {
  opacity: 0.6; /* Slightly stronger in dark mode but still subtle */
  filter: blur(10px);
}

.clarity-robot__face {
  position: absolute;
  width: 66%;
  height: 44%;
  background: #020617; /* Very dark polished screen */
  border-radius: 30px;
  box-shadow: 
    inset 0 4px 12px rgba(0, 0, 0, 0.8),
    inset 0 -2px 4px rgba(255, 255, 255, 0.08),
    0 2px 4px rgba(255, 255, 255, 0.4);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  z-index: 3;
}

.dark .clarity-robot__face {
  background: #000000;
  box-shadow: 
    inset 0 4px 12px rgba(0, 0, 0, 0.9),
    inset 0 -1px 3px rgba(255, 255, 255, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.5); /* subtle drop on dark shell */
}

/* Glass reflection on the face */
.clarity-robot__face::after {
  content: '';
  position: absolute;
  top: 0;
  left: 5%;
  right: 5%;
  height: 45%;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.0) 100%);
  border-radius: 50% 50% 0 0;
  pointer-events: none;
}

.clarity-robot__eyes {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  z-index: 4;
}

.clarity-robot__eye {
  width: 10px;
  height: 14px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 
    0 0 8px 1px rgba(255, 255, 255, 0.6),
    0 0 16px 2px rgba(255, 255, 255, 0.2);
  animation: robot-blink 5s infinite;
  transform-origin: center;
  transition: height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease;
}

/* Animations & States */
.clarity-robot[data-state="idle"] { 
  animation: robot-float-idle 5s ease-in-out infinite; 
}
.clarity-robot[data-state="listening"] { 
  transform: translateY(2px) scale(1.02); 
}
.clarity-robot[data-state="listening"] .clarity-robot__head { 
  transform: rotate(-2deg); 
}
.clarity-robot[data-state="listening"] .clarity-robot__eye { 
  height: 16px; 
  box-shadow: 0 0 12px 2px rgba(255, 255, 255, 0.8); 
}
.clarity-robot[data-state="thinking"] { 
  animation: robot-float-thinking 2.5s ease-in-out infinite; 
}
.clarity-robot[data-state="thinking"] .clarity-robot__ring { 
  animation: robot-ring-spin 1.5s linear infinite; 
  filter: blur(10px); 
  opacity: 0.6; 
}
.dark .clarity-robot[data-state="thinking"] .clarity-robot__ring {
  opacity: 0.8;
}
.clarity-robot[data-state="attention"] { 
  transform: translateY(-4px) scale(1.04); 
}
.clarity-robot[data-state="attention"] .clarity-robot__eye { 
  height: 16px; 
  width: 12px; 
  box-shadow: 0 0 14px 3px rgba(255, 255, 255, 0.9); 
}
.clarity-robot[data-state="confused"] .clarity-robot__head { 
  animation: robot-confused-head 3s ease-in-out forwards; 
}
.clarity-robot[data-state="confused"] .clarity-robot__eyes { 
  transform: scale(0.9) translateY(2px); 
}
.clarity-robot[data-state="responding"] { 
  animation: robot-respond 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); 
}
.clarity-robot[data-state="responding"] .clarity-robot__eye { 
  height: 16px; 
}
.clarity-robot[data-state="error"] .clarity-robot__ring { 
  background: linear-gradient(90deg, #ef4444, #f87171, #ef4444); 
  opacity: 0.6;
}
.clarity-robot[data-state="error"] .clarity-robot__head { 
  transform: rotate(10deg); 
}

/* Looking directions */
.clarity-robot[data-look="left"] .clarity-robot__face { transform: translateX(-4px); }
.clarity-robot[data-look="right"] .clarity-robot__face { transform: translateX(4px); }
.clarity-robot[data-look="left"] .clarity-robot__eyes { transform: translateX(-2px); }
.clarity-robot[data-look="right"] .clarity-robot__eyes { transform: translateX(2px); }

/* Keyframes */
@keyframes robot-float-idle { 
  0%, 100% { transform: translateY(0); } 
  50% { transform: translateY(-4px); } 
}
@keyframes robot-float-thinking { 
  0%, 100% { transform: translateY(0) rotate(-1deg); } 
  50% { transform: translateY(-2px) rotate(1deg); } 
}
@keyframes robot-blink { 
  0%, 94%, 100% { transform: scaleY(1); } 
  96% { transform: scaleY(0.05); } 
}
@keyframes robot-ring-spin { 
  0% { background-position: 0% 50%; } 
  100% { background-position: -200% 50%; } 
}
@keyframes robot-respond { 
  0% { transform: translateY(0) scale(1); } 
  40% { transform: translateY(-6px) scale(1.02); } 
  100% { transform: translateY(0) scale(1); } 
}
@keyframes robot-confused-head { 
  0% { transform: rotate(0); } 
  20% { transform: rotate(-8deg); } 
  70% { transform: rotate(6deg); } 
  100% { transform: rotate(0); } 
}

@media (prefers-reduced-motion: reduce) {
  .clarity-robot, .clarity-robot__ring, .clarity-robot__eye, .clarity-robot__head, .clarity-robot__face, .clarity-robot__eyes { 
    animation: none !important; 
    transition: none !important; 
    transform: none !important; 
  }
  .clarity-robot__ring { 
    opacity: 0.3; 
    background-size: 100% 100%; 
  }
}

`;

    compCss = compCss.substring(0, startIndex) + premiumCss + compCss.substring(endIndex);
    fs.writeFileSync('css/components.css', compCss, 'utf8');
    console.log("Premium Robot CSS injected.");
} else {
    console.log("Could not find robot css section in components.css.");
}

