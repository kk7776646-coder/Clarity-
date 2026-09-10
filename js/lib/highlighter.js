// VS Code-Style Syntax Highlighter using PrismJS
import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-c";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-bash";

window.Clarity = window.Clarity || {};
window.Prism = Prism;

const EXT_TO_LANG = {
  ".js": { id: "javascript", name: "JavaScript", prism: "javascript" },
  ".mjs": { id: "javascript", name: "JavaScript", prism: "javascript" },
  ".cjs": { id: "javascript", name: "JavaScript", prism: "javascript" },
  ".jsx": { id: "jsx", name: "JavaScript React", prism: "jsx" },
  ".ts": { id: "typescript", name: "TypeScript", prism: "typescript" },
  ".mts": { id: "typescript", name: "TypeScript", prism: "typescript" },
  ".cts": { id: "typescript", name: "TypeScript", prism: "typescript" },
  ".tsx": { id: "tsx", name: "TypeScript React", prism: "tsx" },
  ".py": { id: "python", name: "Python", prism: "python" },
  ".pyw": { id: "python", name: "Python", prism: "python" },
  ".java": { id: "java", name: "Java", prism: "java" },
  ".c": { id: "c", name: "C", prism: "c" },
  ".h": { id: "c", name: "C Header", prism: "c" },
  ".cpp": { id: "cpp", name: "C++", prism: "cpp" },
  ".cc": { id: "cpp", name: "C++", prism: "cpp" },
  ".cxx": { id: "cpp", name: "C++", prism: "cpp" },
  ".hpp": { id: "cpp", name: "C++ Header", prism: "cpp" },
  ".cs": { id: "csharp", name: "C#", prism: "csharp" },
  ".go": { id: "go", name: "Go", prism: "go" },
  ".rs": { id: "rust", name: "Rust", prism: "rust" },
  ".html": { id: "html", name: "HTML", prism: "markup" },
  ".htm": { id: "html", name: "HTML", prism: "markup" },
  ".svg": { id: "svg", name: "SVG XML", prism: "markup" },
  ".xml": { id: "xml", name: "XML", prism: "markup" },
  ".css": { id: "css", name: "CSS", prism: "css" },
  ".scss": { id: "scss", name: "SCSS", prism: "scss" },
  ".sass": { id: "scss", name: "Sass", prism: "scss" },
  ".json": { id: "json", name: "JSON", prism: "json" },
  ".json5": { id: "json", name: "JSON5", prism: "json" },
  ".yaml": { id: "yaml", name: "YAML", prism: "yaml" },
  ".yml": { id: "yaml", name: "YAML", prism: "yaml" },
  ".sql": { id: "sql", name: "SQL", prism: "sql" },
  ".md": { id: "markdown", name: "Markdown", prism: "markdown" },
  ".markdown": { id: "markdown", name: "Markdown", prism: "markdown" },
  ".sh": { id: "bash", name: "Shell Script", prism: "bash" },
  ".bash": { id: "bash", name: "Bash", prism: "bash" },
  ".zsh": { id: "bash", name: "Zsh", prism: "bash" },
  ".env": { id: "bash", name: "Environment Config", prism: "bash" },
};

function getLanguageInfo(pathOrExt) {
  if (!pathOrExt) return { id: "plaintext", name: "Plain Text", prism: "plaintext" };
  let ext = "";
  if (pathOrExt.startsWith(".")) {
    ext = pathOrExt.toLowerCase();
  } else {
    const parts = pathOrExt.split(".");
    if (parts.length > 1) {
      ext = "." + parts.pop().toLowerCase();
    }
  }

  // Handle special filenames
  const baseName = pathOrExt.split("/").pop().toLowerCase();
  if (baseName === "dockerfile") return { id: "docker", name: "Dockerfile", prism: "bash" };
  if (baseName === "makefile") return { id: "make", name: "Makefile", prism: "bash" };
  if (baseName.startsWith(".env")) return { id: "bash", name: "Environment Config", prism: "bash" };

  return EXT_TO_LANG[ext] || { id: ext.replace(".", "") || "plaintext", name: (ext.replace(".", "") || "Plain Text").toUpperCase(), prism: "plaintext" };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function splitHighlightedHtmlLines(html) {
  const lines = [];
  let currentLine = "";
  const openTags = [];

  // Match tags, newlines, or text segments
  const regex = /(<span[^>]*>|<\/span>|\r?\n|[^\r\n<]+|<)/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const part = match[0];
    if (part === "\n" || part === "\r\n") {
      for (let i = openTags.length - 1; i >= 0; i--) {
        currentLine += "</span>";
      }
      lines.push(currentLine);
      currentLine = "";
      for (let i = 0; i < openTags.length; i++) {
        currentLine += openTags[i];
      }
    } else if (part.startsWith("<span")) {
      openTags.push(part);
      currentLine += part;
    } else if (part === "</span>") {
      openTags.pop();
      currentLine += part;
    } else {
      currentLine += part;
    }
  }

  for (let i = openTags.length - 1; i >= 0; i--) {
    currentLine += "</span>";
  }
  lines.push(currentLine);

  return lines;
}

function highlightLines(code, pathOrExt) {
  if (typeof code !== "string") code = "";
  const rawLines = code.split(/\r?\n/);
  const langInfo = getLanguageInfo(pathOrExt);
  const grammar = Prism.languages[langInfo.prism];

  if (!grammar) {
    return rawLines.map(line => escapeHtml(line));
  }

  try {
    const highlighted = Prism.highlight(code, grammar, langInfo.prism);
    return splitHighlightedHtmlLines(highlighted);
  } catch (err) {
    console.warn("Syntax highlight fallback for", langInfo.prism, err);
    return rawLines.map(line => escapeHtml(line));
  }
}

window.Clarity.highlighter = {
  getLanguageInfo,
  highlightLines,
  escapeHtml,
};
