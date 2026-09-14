const fs = require('fs');

let file = fs.readFileSync('file-generator.ts', 'utf8');

const promptBlock = `      const aiPrompt = \`You are an elite executive presentation designer.
Generate a custom, professional presentation slide deck structure tailored to the user's instructions.
CRITICAL MANDATE: DO NOT use repetitive layouts. You MUST use a variety of slide layouts. The visual pacing should feel like a real consulting deck, not a database export.
Vary the layouts! Mix 'split_layout', 'cards_grid', 'metrics_dashboard', 'problem_solution', and 'architecture_diagram'.

USER'S INSTRUCTIONS & REQUEST:
\${rawPrompt}

PROJECT CONTEXT (Ground Truth):
Project Name: \${context.project.name}
Summary: \${context.project.summary}
Primary Language: \${context.project.primaryLanguage}
Scale: \${context.evidence.filesCount} source files, \${context.evidence.totalLinesOfCode} LOC
Security: Score \${context.evidence.security.score}/100
Quality: Score \${context.evidence.codeQuality.score}/100
Architecture Nodes: \${context.evidence.architectureNodes.map((n: any) => n.label).join(", ")}
Problem Solved: \${context.projectStory.problemSolved}

INSTRUCTIONS:
1. Generate 8-14 slides.
2. The 'layout' property MUST be one of:
   - "title_slide"
   - "split_layout" (text left, diagram/image right)
   - "architecture_diagram" (full diagram centered)
   - "metrics_dashboard" (grid of key numbers)
   - "problem_solution" (two columns: problem vs solution)
   - "cards_grid" (3 vertical cards, use sparingly)
   - "standard_content" (bullet points)
3. If layout is 'split_layout' or 'architecture_diagram', set 'diagram' to: "architecture", "workflow", "techStack", "rag", or "none".
4. If layout is 'problem_solution', provide 'leftColumn' and 'rightColumn' objects (with title, content).
5. If layout is 'metrics_dashboard', provide a 'metrics' array with {label, value}.
6. If layout is 'cards_grid', provide a 'cards' array with {badge, title, description}.
7. Return ONLY valid JSON in a \\\`\\\`\\\`json block.

FORMAT:
\\\`\\\`\\\`json
[
  {
    "layout": "split_layout",
    "category": "Architecture Strategy",
    "title": "System Overview",
    "subtitle": "High-level component interaction",
    "content": "Description paragraph...",
    "bullets": ["Key point 1", "Key point 2"],
    "diagram": "architecture",
    "metrics": [],
    "cards": [],
    "leftColumn": null,
    "rightColumn": null
  }
]
\\\`\\\`\\\`\`;`;

const newPromptBlock = `      const slideCountMatch = rawPrompt.match(/(\\d+)\\s*(?:slide|page|ppt)/i) || rawPrompt.match(/(?:create|make|generate|with)\\s*(?:a|an)?\\s*(\\d+)/i);
      const requestedSlideCount = slideCountMatch ? parseInt(slideCountMatch[1] || slideCountMatch[2], 10) : null;
      let slideCountInstruction = "Determine an appropriate number of slides (between 5 and 20) based on the project's complexity and the requested purpose. Do NOT default to 7 slides.";
      if (requestedSlideCount && requestedSlideCount > 0) {
        slideCountInstruction = \`Generate EXACTLY \${requestedSlideCount} slides. You MUST generate exactly this number, no more, no less.\`;
      } else if (rawPrompt.toLowerCase().includes("short")) {
        slideCountInstruction = "Generate exactly 5 slides for a brief, high-level overview.";
      } else if (rawPrompt.toLowerCase().includes("detailed") || rawPrompt.toLowerCase().includes("long")) {
        slideCountInstruction = "Generate exactly 15 to 20 slides, providing an in-depth, comprehensive breakdown of the project.";
      }

      const aiPrompt = \`You are an elite executive presentation designer.
Generate a custom, professional presentation slide deck structure tailored to the user's instructions.
CRITICAL MANDATE: DO NOT use repetitive layouts. You MUST use a variety of slide layouts. The visual pacing should feel like a real consulting deck, not a database export.
Vary the layouts! Mix 'split_layout', 'cards_grid', 'metrics_dashboard', 'problem_solution', and 'architecture_diagram'.

USER'S INSTRUCTIONS & REQUEST:
\${rawPrompt}

PROJECT CONTEXT (Ground Truth):
Project Name: \${context.project.name}
Summary: \${context.project.summary}
Primary Language: \${context.project.primaryLanguage}
Scale: \${context.evidence.filesCount} source files, \${context.evidence.totalLinesOfCode} LOC
Security: Score \${context.evidence.security.score}/100
Quality: Score \${context.evidence.codeQuality.score}/100
Architecture Nodes: \${context.evidence.architectureNodes.map((n: any) => n.label).join(", ")}
Problem Solved: \${context.projectStory.problemSolved}

INSTRUCTIONS:
1. \${slideCountInstruction}
2. The 'layout' property MUST be one of:
   - "title_slide"
   - "split_layout" (text left, diagram/image right)
   - "architecture_diagram" (full diagram centered)
   - "metrics_dashboard" (grid of key numbers)
   - "problem_solution" (two columns: problem vs solution)
   - "cards_grid" (3 vertical cards, use sparingly)
   - "standard_content" (bullet points)
3. If layout is 'split_layout' or 'architecture_diagram', set 'diagram' to: "architecture", "workflow", "techStack", "rag", or "none".
4. If layout is 'problem_solution', provide 'leftColumn' and 'rightColumn' objects (with title, content).
5. If layout is 'metrics_dashboard', provide a 'metrics' array with {label, value}.
6. If layout is 'cards_grid', provide a 'cards' array with {badge, title, description}.
7. Return ONLY valid JSON in a \\\`\\\`\\\`json block.

FORMAT:
\\\`\\\`\\\`json
[
  {
    "layout": "split_layout",
    "category": "Architecture Strategy",
    "title": "System Overview",
    "subtitle": "High-level component interaction",
    "content": "Description paragraph...",
    "bullets": ["Key point 1", "Key point 2"],
    "diagram": "architecture",
    "metrics": [],
    "cards": [],
    "leftColumn": null,
    "rightColumn": null
  }
]
\\\`\\\`\\\`\`;`;

file = file.replace(promptBlock, newPromptBlock);

// Remove the fallback that forces 7 slides if customSlides is not set, or modify it to be dynamic/shorter but we don't want it to override the count.
// Well, the fallback is a static 7 slides. We should adjust it so it scales to requestedSlideCount if it hits the fallback, or just leave it since the fallback is for error cases. Let's make it generate exactly what was requested by slicing or duplicating, or just leave fallback alone but log warning.
// Actually, I will slice the fallback or add to it to match requestedSlideCount exactly.
const fallbackBlock = `  // Fallback Generation
  if (!customSlides) {
    customSlides = [
      { layout: "title_slide", category: "", title: context.project.name, subtitle: context.project.summary },
      { layout: "split_layout", category: "Overview", title: "Project Overview", subtitle: "Core mission and purpose", content: context.projectStory.whatIsIt, bullets: [context.projectStory.whyBuilt, context.projectStory.targetAudience], diagram: "workflow" },
      { layout: "problem_solution", category: "Strategy", title: "Problem & Solution", subtitle: "Strategic positioning", leftColumn: { title: "Friction", content: context.projectStory.problemSolved }, rightColumn: { title: "Solution", content: context.projectStory.howItWorks } },
      { layout: "metrics_dashboard", category: "Metrics", title: "Engineering Scale", subtitle: "Quantifiable project metrics", metrics: [{ label: "Files", value: String(context.metrics.totalFiles) }, { label: "LOC", value: String(context.metrics.totalLoc) }, { label: "Security", value: String(context.metrics.securityScore) }, { label: "Quality", value: String(context.metrics.qualityScore) }] },
      { layout: "architecture_diagram", category: "Architecture", title: "System Architecture", subtitle: "Component dependencies", diagram: "architecture" },
      { layout: "cards_grid", category: "Technology", title: "Tech Stack", subtitle: "Core frameworks", cards: [{ badge: "Language", title: context.project.primaryLanguage, description: "Primary programming language" }, { badge: "Frameworks", title: "Core Modules", description: context.project.frameworks.join(", ") || "Standard libraries" }] },
      { layout: "standard_content", category: "Conclusion", title: "Next Steps", subtitle: "Project roadmap", content: "Architecture verified.", bullets: ["Ready for deployment", "Static analysis complete"] }
    ];
  }`;

const newFallbackBlock = `  // Fallback Generation
  if (!customSlides) {
    customSlides = [
      { layout: "title_slide", category: "", title: context.project.name, subtitle: context.project.summary },
      { layout: "split_layout", category: "Overview", title: "Project Overview", subtitle: "Core mission and purpose", content: context.projectStory.whatIsIt, bullets: [context.projectStory.whyBuilt, context.projectStory.targetAudience], diagram: "workflow" },
      { layout: "problem_solution", category: "Strategy", title: "Problem & Solution", subtitle: "Strategic positioning", leftColumn: { title: "Friction", content: context.projectStory.problemSolved }, rightColumn: { title: "Solution", content: context.projectStory.howItWorks } },
      { layout: "metrics_dashboard", category: "Metrics", title: "Engineering Scale", subtitle: "Quantifiable project metrics", metrics: [{ label: "Files", value: String(context.metrics.totalFiles) }, { label: "LOC", value: String(context.metrics.totalLoc) }, { label: "Security", value: String(context.metrics.securityScore) }, { label: "Quality", value: String(context.metrics.qualityScore) }] },
      { layout: "architecture_diagram", category: "Architecture", title: "System Architecture", subtitle: "Component dependencies", diagram: "architecture" },
      { layout: "cards_grid", category: "Technology", title: "Tech Stack", subtitle: "Core frameworks", cards: [{ badge: "Language", title: context.project.primaryLanguage, description: "Primary programming language" }, { badge: "Frameworks", title: "Core Modules", description: context.project.frameworks.join(", ") || "Standard libraries" }] },
      { layout: "standard_content", category: "Conclusion", title: "Next Steps", subtitle: "Project roadmap", content: "Architecture verified.", bullets: ["Ready for deployment", "Static analysis complete"] }
    ];
  }
  
  // Validation and enforcing strict slide count
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

file = file.replace(fallbackBlock, newFallbackBlock);

fs.writeFileSync('file-generator.ts', file, 'utf8');
console.log("Updated file-generator.ts with dynamic slide count!");
