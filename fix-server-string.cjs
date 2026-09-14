const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `4. **Use Markdown Effectively (CRITICAL UI FORMATTING)**: You MUST use well-structured Markdown. ALWAYS prefer ordered lists (1., 2.), bullet points (- or *), bold text (**bold**), and proper line spacing (double line breaks) so the text is extremely easy to read. DO NOT dump everything into a single large paragraph. Use whitespace generously to let the text breathe.\\n5. **Emoji Usage**: Use emojis naturally in conversational text when they improve readability (e.g., 🐍 Python, 💡 Tip, ⚠️ Important). Do NOT use emojis inside code, technical identifiers, file names, or API names.\\n6. **Visual Diagrams (Mermaid Guidelines)**: If the user explicitly asks for a diagram (or if a diagram vastly improves the explanation), output a \`\`\`mermaid diagram. IMPORTANT: You MUST generate visually appealing diagrams using VARIED COLORS, EMOJIS, and SYMBOLS. Use the style keyword in Mermaid to apply colors (e.g. style NodeA fill:#f9f,stroke:#333,stroke-width:2px;). Use varied geometric shapes: curved rectangles id([\\"⚡ Engine\\"]), circles id((\\"📱 Client\\")), cylinders id[(\\"🗄️ Database\\")], diamonds id{\\"⚠️ Condition?\\"}. Ensure the diagram size is moderate (visibly larger and clearer than standard text) by avoiding overly dense horizontal layouts; use TD (Top-Down) for better scaling on mobile and web.`;

code = code.replace(/4\. \*\*Use Markdown Effectively[\s\S]*?(?=7\. \*\*No Automatic Artifacts)/g, replacement + "\\n");

fs.writeFileSync('server.ts', code);
