const fs = require('fs');
let file = fs.readFileSync('file-generator.ts', 'utf8');

// We are going to replace the strict validation logic we just added with a safer version.
const oldLogic = `  // Validation and enforcing strict slide count
  const slideCountMatchCheck = rawPrompt.match(/(\\d+)\\s*(?:slide|page|ppt)/i) || rawPrompt.match(/(?:create|make|generate|with)\\s*(?:a|an)?\\s*(\\d+)/i);
  const strictSlideCount = slideCountMatchCheck ? parseInt(slideCountMatchCheck[1] || slideCountMatchCheck[2], 10) : null;
  
  if (strictSlideCount && customSlides.length !== strictSlideCount) {
    if (customSlides.length > strictSlideCount) {
      customSlides = customSlides.slice(0, strictSlideCount);
    } else {
      let i = 0;
      while (customSlides.length < strictSlideCount) {
        customSlides.push({ ...customSlides[1 + (i % (customSlides.length - 1))] });
        i++;
      }
    }
  }`;

const newLogic = `  // Validation and enforcing strict slide count
  const slideCountMatchCheck = rawPrompt.match(/(\\d+)\\s*(?:slide|page|ppt)/i) || rawPrompt.match(/(?:create|make|generate|with)\\s*(?:a|an)?\\s*(\\d+)/i);
  const strictSlideCount = slideCountMatchCheck ? parseInt(slideCountMatchCheck[1] || slideCountMatchCheck[2], 10) : null;
  
  if (strictSlideCount && customSlides.length !== strictSlideCount) {
    if (customSlides.length > strictSlideCount) {
      customSlides = customSlides.slice(0, strictSlideCount);
    } else {
      let i = 0;
      const originalLength = customSlides.length;
      while (customSlides.length < strictSlideCount) {
        const sourceIndex = originalLength > 1 ? 1 + (i % (originalLength - 1)) : 0;
        customSlides.push({ ...customSlides[sourceIndex] });
        i++;
      }
    }
  }`;

if (file.includes(oldLogic)) {
  file = file.replace(oldLogic, newLogic);
  fs.writeFileSync('file-generator.ts', file, 'utf8');
  console.log("Updated slice logic successfully.");
} else {
  console.log("Could not find the block to replace.");
}
