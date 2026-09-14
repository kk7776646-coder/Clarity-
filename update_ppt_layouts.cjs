const fs = require('fs');

let file = fs.readFileSync('file-generator.ts', 'utf8');

// 1. Update AI Prompt
const oldPrompt = `2. The 'layout' property MUST be one of:
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
    "layout": "split_layout",`;

const newPrompt = `2. The 'layout' property MUST be one of:
   - "title_slide"
   - "split_layout" (text left, diagram/image right)
   - "architecture_diagram" (full diagram centered)
   - "metrics_dashboard" (grid of key numbers)
   - "problem_solution" (two columns: problem vs solution)
   - "feature_grid" (clean 2x2 grid of features/capabilities)
   - "timeline" (horizontal timeline of milestones/events)
   - "architecture_flow" (step-by-step sequential flow)
   - "standard_content" (bullet points)
3. If layout is 'split_layout' or 'architecture_diagram', set 'diagram' to: "architecture", "workflow", "techStack", "rag", or "none".
4. If layout is 'problem_solution', provide 'leftColumn' and 'rightColumn' objects (with title, content).
5. If layout is 'metrics_dashboard', provide a 'metrics' array with {label, value}.
6. If layout is 'feature_grid', provide a 'features' array with {title, description}. Maximum 4 items.
7. If layout is 'timeline', provide an 'events' array with {date, title, description}. Maximum 4 items.
8. If layout is 'architecture_flow', provide a 'steps' array with {title, description}. Maximum 4 items.
9. Return ONLY valid JSON in a \\\`\\\`\\\`json block.

FORMAT:
\\\`\\\`\\\`json
[
  {
    "layout": "split_layout",`;

file = file.replace(oldPrompt, newPrompt);

// 2. Update Fallback Array
const oldFallback = `      { layout: "cards_grid", category: "Technology", title: "Tech Stack", subtitle: "Core frameworks", cards: [{ badge: "Language", title: context.project.primaryLanguage, description: "Primary programming language" }, { badge: "Frameworks", title: "Core Modules", description: context.project.frameworks.join(", ") || "Standard libraries" }] },`;
const newFallback = `      { layout: "feature_grid", category: "Technology", title: "Tech Stack", subtitle: "Core frameworks", features: [{ title: context.project.primaryLanguage, description: "Primary programming language" }, { title: "Core Modules", description: context.project.frameworks.join(", ") || "Standard libraries" }] },
      { layout: "timeline", category: "Roadmap", title: "Project Timeline", subtitle: "Key milestones", events: [{ date: "Q1", title: "Phase 1", description: "Initial release" }, { date: "Q2", title: "Phase 2", description: "Expansion" }] },
      { layout: "architecture_flow", category: "Data Flow", title: "System Flow", subtitle: "Request lifecycle", steps: [{ title: "Client", description: "Initiates request" }, { title: "API Gateway", description: "Routes traffic" }, { title: "Service", description: "Processes logic" }, { title: "Database", description: "Persists state" }] },`;

file = file.replace(oldFallback, newFallback);

// 3. Update Rendering Logic
const oldRenderingBlock = `    } else if (spec.layout === "cards_grid" && spec.cards && spec.cards.length > 0) {
      const cardList = spec.cards.slice(0, 3);
      const colCount = Math.max(1, Math.min(3, cardList.length));
      const cardW = (8.4 - (colCount - 1) * 0.2) / colCount;
      cardList.forEach((c: any, cIdx: number) => {
        addIconCard(slide, { x: 0.8 + cIdx * (cardW + 0.2), y: 1.62, w: cardW, h: 3.28, badgeText: c.badge || \`Point \${cIdx + 1}\`, title: c.title, description: c.description });
      });
    } else {`;

const newRenderingBlock = `    } else if (spec.layout === "cards_grid" && spec.cards && spec.cards.length > 0) {
      const cardList = spec.cards.slice(0, 3);
      const colCount = Math.max(1, Math.min(3, cardList.length));
      const cardW = (8.4 - (colCount - 1) * 0.2) / colCount;
      cardList.forEach((c: any, cIdx: number) => {
        addIconCard(slide, { x: 0.8 + cIdx * (cardW + 0.2), y: 1.62, w: cardW, h: 3.28, badgeText: c.badge || \`Point \${cIdx + 1}\`, title: c.title, description: c.description });
      });
    } else if (spec.layout === "feature_grid" && spec.features && spec.features.length > 0) {
      const feats = spec.features.slice(0, 4);
      feats.forEach((f: any, idx: number) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const fx = 0.8 + col * 4.4;
        const fy = 1.7 + row * 1.6;
        slide.addShape(ppt.ShapeType.rect, { x: fx, y: fy, w: 0.1, h: 1.0, fill: { color: ASSET_PALETTE.accent } });
        slide.addText(f.title, { x: fx + 0.2, y: fy, w: 3.8, h: 0.3, fontSize: 16, bold: true, color: ASSET_PALETTE.textPrimary, valign: "middle" });
        slide.addText(f.description, { x: fx + 0.2, y: fy + 0.3, w: 3.8, h: 0.7, fontSize: 12, color: ASSET_PALETTE.textSecondary, valign: "top", wrap: true });
      });
    } else if (spec.layout === "timeline" && spec.events && spec.events.length > 0) {
      const evts = spec.events.slice(0, 4);
      const count = evts.length;
      const w = 8.4 / count;
      slide.addShape(ppt.ShapeType.rect, { x: 0.8, y: 3.0, w: 8.4, h: 0.05, fill: { color: ASSET_PALETTE.borderDark } });
      evts.forEach((e: any, idx: number) => {
        const tx = 0.8 + idx * w;
        slide.addShape(ppt.ShapeType.oval, { x: tx + (w/2) - 0.1, y: 2.925, w: 0.2, h: 0.2, fill: { color: ASSET_PALETTE.accent } });
        slide.addText(e.date, { x: tx, y: 2.4, w: w, h: 0.3, fontSize: 14, bold: true, color: ASSET_PALETTE.accent, align: "center" });
        slide.addText(e.title, { x: tx + 0.1, y: 3.3, w: w - 0.2, h: 0.3, fontSize: 14, bold: true, color: ASSET_PALETTE.textPrimary, align: "center", wrap: true });
        slide.addText(e.description, { x: tx + 0.1, y: 3.6, w: w - 0.2, h: 0.8, fontSize: 12, color: ASSET_PALETTE.textSecondary, align: "center", wrap: true, valign: "top" });
      });
    } else if (spec.layout === "architecture_flow" && spec.steps && spec.steps.length > 0) {
      const steps = spec.steps.slice(0, 4);
      const count = steps.length;
      const stepW = 8.4 / count;
      steps.forEach((s: any, idx: number) => {
        const sx = 0.8 + idx * stepW;
        const boxW = stepW - 0.4;
        slide.addShape(ppt.ShapeType.roundRect, { x: sx, y: 2.0, w: boxW, h: 1.6, fill: { color: ASSET_PALETTE.surfaceSubtle }, line: { color: ASSET_PALETTE.borderMedium, width: 1 }, rectRadius: 0.05 });
        slide.addText(\`0\${idx + 1}\`, { x: sx, y: 1.6, w: boxW, h: 0.3, fontSize: 14, bold: true, color: ASSET_PALETTE.textMuted, align: "left" });
        slide.addText(s.title, { x: sx + 0.1, y: 2.1, w: boxW - 0.2, h: 0.4, fontSize: 14, bold: true, color: ASSET_PALETTE.textPrimary, align: "center", valign: "middle", wrap: true });
        slide.addText(s.description, { x: sx + 0.1, y: 2.5, w: boxW - 0.2, h: 1.0, fontSize: 12, color: ASSET_PALETTE.textSecondary, align: "center", valign: "top", wrap: true });
        if (idx < count - 1) {
          slide.addShape(ppt.ShapeType.rightArrow, { x: sx + boxW + 0.05, y: 2.7, w: 0.3, h: 0.2, fill: { color: ASSET_PALETTE.borderDark } });
        }
      });
    } else {`;

file = file.replace(oldRenderingBlock, newRenderingBlock);

// Also we need to replace the prompt for varying layouts in the first prompt block
const promptLayoutList = `Vary the layouts! Mix 'split_layout', 'cards_grid', 'metrics_dashboard', 'problem_solution', and 'architecture_diagram'.`;
const newPromptLayoutList = `Vary the layouts! Mix 'split_layout', 'feature_grid', 'timeline', 'architecture_flow', 'metrics_dashboard', 'problem_solution', and 'architecture_diagram'.`;

file = file.replace(promptLayoutList, newPromptLayoutList);

fs.writeFileSync('file-generator.ts', file, 'utf8');
console.log("Updated PPT layouts!");
