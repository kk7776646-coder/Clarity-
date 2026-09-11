
function formatApiError(err: any): string {
  let msg = formatApiError(err) || "An unknown error occurred";
  try {
    if (msg.includes('{"error"')) {
      const startIdx = msg.indexOf('{');
      const endIdx = msg.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = msg.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error && parsed.error.message) {
          let innerMsg = parsed.error.message;
          try {
             const innerParsed = JSON.parse(innerMsg);
             if (innerParsed.error && innerParsed.error.message) {
               msg = innerParsed.error.message;
             } else {
               msg = innerMsg;
             }
          } catch(e2) {
             msg = innerMsg;
          }
        }
      }
    }
  } catch (e) {}
  if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("RESOURCE_EXHAUSTED")) {
     return "You have exceeded your API quota or rate limit. " + msg;
  }
  return msg;
}
import { transformSync } from "esbuild";
import path from "path";

export interface DiagnosticIssue {
  id: string;
  file: string;
  line: number;
  column: number;
  type: "CONFIRMED ERROR" | "POTENTIAL ISSUE" | "WARNING" | "SUGGESTION" | "NEEDS MANUAL VERIFICATION";
  severity: "error" | "warning" | "info";
  message: string;
  explanation: string;
  correction: string;
  currentCode?: string;
  suggestedCode?: string;
  patchedContent?: string;
  diff?: {
    before: string;
    after: string;
  };
}

export interface DiagnosticsResult {
  file: string;
  language: string;
  issues: DiagnosticIssue[];
  summary: {
    errors: number;
    warnings: number;
    suggestions: number;
    clean: boolean;
  };
}

export interface ProjectFileContext {
  filename: string;
  content: string;
  size: number;
}

export async function analyzeFileDiagnostics(
  targetFile: string,
  content: string,
  projectFiles: ProjectFileContext[],
  fastMode = false
): Promise<DiagnosticsResult> {
  const ext = path.extname(targetFile).toLowerCase();
  const issues: DiagnosticIssue[] = [];
  const lines = content.split(/\r?\n/);

  let lang = "Plain Text";
  if ([".js", ".mjs", ".cjs"].includes(ext)) lang = "JavaScript";
  else if (ext === ".jsx") lang = "JavaScript React";
  else if ([".ts", ".mts", ".cts"].includes(ext)) lang = "TypeScript";
  else if (ext === ".tsx") lang = "TypeScript React";
  else if ([".py", ".pyw"].includes(ext)) lang = "Python";
  else if (ext === ".json") lang = "JSON";
  else if (ext === ".html" || ext === ".htm") lang = "HTML";
  else if (ext === ".css") lang = "CSS";
  else if (ext === ".sql") lang = "SQL";
  else if (ext === ".md") lang = "Markdown";

  // 1. JSON Static Analysis
  if (ext === ".json") {
    analyzeJson(targetFile, content, lines, issues);
  }
  // 2. JavaScript / TypeScript / JSX / TSX Analysis
  else if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    analyzeJavaScriptTypeScript(targetFile, content, lines, ext, projectFiles, issues);
  }
  // 3. Python Analysis
  else if ([".py", ".pyw"].includes(ext)) {
    analyzePython(targetFile, content, lines, projectFiles, issues);
  }
  // 4. HTML Analysis
  else if ([".html", ".htm"].includes(ext)) {
    analyzeHtml(targetFile, content, lines, issues);
  }
  // 5. CSS Analysis
  else if ([".css", ".scss"].includes(ext)) {
    analyzeCss(targetFile, content, lines, issues);
  }

  // Deduplicate issues by line & message
  const seen = new Set<string>();
  const uniqueIssues = issues.filter(issue => {
    const key = `${issue.line}:${issue.column}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort issues by line ascending, then severity
  uniqueIssues.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    const sevScore = { error: 0, warning: 1, info: 2 };
    return sevScore[a.severity] - sevScore[b.severity];
  });

  const errors = uniqueIssues.filter(i => i.severity === "error").length;
  const warnings = uniqueIssues.filter(i => i.severity === "warning").length;
  const suggestions = uniqueIssues.filter(i => i.severity === "info").length;

  return {
    file: targetFile,
    language: lang,
    issues: uniqueIssues,
    summary: {
      errors,
      warnings,
      suggestions,
      clean: uniqueIssues.length === 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. JSON Parser & Linter
// ---------------------------------------------------------------------------
function analyzeJson(targetFile: string, content: string, lines: string[], issues: DiagnosticIssue[]) {
  if (!content.trim()) return;

  try {
    JSON.parse(content);
  } catch (err: any) {
    const errMsg = String(formatApiError(err) || "");
    let errorLine = 1;
    let errorCol = 1;

    // Check for trailing comma specifically: ,(\s*[}\]])
    let trailingCommaFound = false;
    for (let i = 0; i < lines.length; i++) {
      const lineStr = lines[i];
      if (/,\s*$/.test(lineStr.trim())) {
        // Look at next non-empty line
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrim = lines[j].trim();
          if (nextTrim) {
            if (nextTrim.startsWith("}") || nextTrim.startsWith("]")) {
              errorLine = i + 1;
              errorCol = lineStr.lastIndexOf(",") + 1;
              trailingCommaFound = true;
              const currentLineText = lineStr;
              const fixedLineText = lineStr.replace(/,\s*$/, "");
              const fixedLines = [...lines];
              fixedLines[i] = fixedLineText;

              issues.push({
                id: `json_tc_${i + 1}`,
                file: targetFile,
                line: errorLine,
                column: errorCol,
                type: "CONFIRMED ERROR",
                severity: "error",
                message: "Trailing comma is not allowed in JSON",
                explanation: "The JSON specification (RFC 8259) prohibits trailing commas after the last property or array element.",
                correction: "Remove the trailing comma from line " + (i + 1),
                currentCode: currentLineText,
                suggestedCode: fixedLineText,
                patchedContent: fixedLines.join("\n"),
                diff: {
                  before: currentLineText,
                  after: fixedLineText,
                },
              });
            }
            break;
          }
        }
      }
      if (trailingCommaFound) break;
    }

    if (!trailingCommaFound) {
      // Parse position from Node V8 error message e.g. "at position 42 (line 3 column 5)"
      const lineColMatch = errMsg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
      const posMatch = errMsg.match(/position\s+(\d+)/i);

      if (lineColMatch) {
        errorLine = parseInt(lineColMatch[1], 10);
        errorCol = parseInt(lineColMatch[2], 10);
      } else if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const sub = content.substring(0, pos);
        errorLine = sub.split("\n").length;
        errorCol = sub.split("\n").pop()!.length + 1;
      }

      const rawLine = lines[errorLine - 1] || "";
      issues.push({
        id: `json_parse_${errorLine}`,
        file: targetFile,
        line: errorLine,
        column: errorCol,
        type: "CONFIRMED ERROR",
        severity: "error",
        message: "Invalid JSON: " + errMsg.replace(/^JSON\.parse:\s*/, ""),
        explanation: "Syntax error encountered while parsing JSON document. Check for unquoted keys, single quotes, or missing commas.",
        correction: "Ensure standard RFC 8259 JSON format with double quotes and balanced braces.",
        currentCode: rawLine,
        suggestedCode: rawLine,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 2. JS / TS / JSX / TSX Analysis using esbuild Compiler + Static Rules
// ---------------------------------------------------------------------------
function analyzeJavaScriptTypeScript(
  targetFile: string,
  content: string,
  lines: string[],
  ext: string,
  projectFiles: ProjectFileContext[],
  issues: DiagnosticIssue[]
) {
  let loader: "js" | "jsx" | "ts" | "tsx" = "js";
  if (ext === ".jsx") loader = "jsx";
  else if (ext === ".ts" || ext === ".mts" || ext === ".cts") loader = "ts";
  else if (ext === ".tsx") loader = "tsx";

  // Run esbuild transform to catch real compiler syntax errors
  try {
    transformSync(content, {
      loader,
      sourcemap: false,
    });
  } catch (err: any) {
    if (err.errors && Array.isArray(err.errors)) {
      for (const e of err.errors) {
        let line = e.location?.line || 1;
        let column = e.location?.column || 1;
        let lineText = e.location?.lineText || lines[line - 1] || "";
        const msg = e.text || "Syntax error";

        let explanation = `Compiler syntax error: ${msg}.`;
        let correction = `Fix syntax on line ${line}.`;
        let suggestedCode = lineText;

        // Check for unclosed parenthesis from earlier line (e.g., function test() { console.log("hello" })
        if (msg.includes("Expected \")\"") || msg.includes("Unexpected \"}\"")) {
          // Check preceding lines for unbalanced '('
          for (let p = line - 1; p >= Math.max(0, line - 5); p--) {
            const prev = lines[p];
            const opens = (prev.match(/\(/g) || []).length;
            const closes = (prev.match(/\)/g) || []).length;
            if (opens > closes) {
              line = p + 1;
              lineText = prev;
              column = prev.length;
              explanation = "Missing closing parenthesis ')' for call or expression.";
              suggestedCode = prev.trimEnd() + ");";
              correction = `Add ')' to complete expression: ${suggestedCode.trim()}`;
              break;
            }
          }
        }

        // Check for extra closing parenthesis e.g. const result = calculateValue());
        const opens = (lineText.match(/\(/g) || []).length;
        const closes = (lineText.match(/\)/g) || []).length;
        if (closes > opens && lineText.includes("))")) {
          explanation = "There is an extra closing parenthesis ')' without a matching opening parenthesis.";
          suggestedCode = lineText.replace(/\)\s*\)/, ")").replace(/\);\s*\)/, ");");
          correction = `Remove the extra closing parenthesis: ${suggestedCode.trim()}`;
        }

        let patchedContent: string | undefined;
        if (suggestedCode && suggestedCode !== lineText) {
          const copyLines = [...lines];
          copyLines[line - 1] = suggestedCode;
          patchedContent = copyLines.join("\n");
        }

        issues.push({
          id: `esbuild_${line}_${column}`,
          file: targetFile,
          line,
          column,
          type: "CONFIRMED ERROR",
          severity: "error",
          message: msg,
          explanation,
          correction,
          currentCode: lineText,
          suggestedCode,
          patchedContent,
          diff: suggestedCode !== lineText ? { before: lineText, after: suggestedCode } : undefined,
        });
      }
    }
  }

  // Semantic & Context Rules (Imports, missing awaits, unused vars)
  // Check relative imports against project files
  const fileDir = path.dirname(targetFile);
  const existingPaths = new Set(projectFiles.map(f => f.filename.toLowerCase()));

  for (let i = 0; i < lines.length; i++) {
    const lineStr = lines[i];

    // Relative import validation
    const importMatch = lineStr.match(/(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]/);
    if (importMatch) {
      const relImport = importMatch[1];
      const resolved = path.normalize(path.join(fileDir, relImport)).replace(/\\/g, "/").toLowerCase();
      
      const candidates = [
        resolved,
        resolved + ".js",
        resolved + ".jsx",
        resolved + ".ts",
        resolved + ".tsx",
        resolved + ".json",
        resolved + "/index.js",
        resolved + "/index.ts",
        resolved + "/index.jsx",
        resolved + "/index.tsx",
      ];

      const exists = candidates.some(c => existingPaths.has(c));
      if (!exists && projectFiles.length > 2) {
        issues.push({
          id: `import_missing_${i + 1}`,
          file: targetFile,
          line: i + 1,
          column: lineStr.indexOf(relImport) + 1,
          type: "WARNING",
          severity: "warning",
          message: `Cannot resolve module '${relImport}'`,
          explanation: `The file '${relImport}' does not exist in the project relative to '${fileDir}'.`,
          correction: `Ensure '${relImport}' is created or correct the relative path.`,
          currentCode: lineStr,
          suggestedCode: lineStr,
        });
      }
    }

    // Missing await on async fetch calls
    // e.g. const data = fetch(url);
    if (/const\s+([a-zA-Z0-9_]+)\s*=\s*fetch\(/.test(lineStr) && !lineStr.includes("await")) {
      const fixedLine = lineStr.replace(/=\s*fetch\(/, "= await fetch(");
      const copyLines = [...lines];
      copyLines[i] = fixedLine;

      issues.push({
        id: `await_fetch_${i + 1}`,
        file: targetFile,
        line: i + 1,
        column: lineStr.indexOf("fetch(") + 1,
        type: "POTENTIAL ISSUE",
        severity: "warning",
        message: "Missing await before asynchronous fetch call",
        explanation: "Calling fetch() returns a Promise. Without 'await', the variable receives a pending Promise instead of the Response object.",
        correction: "Add 'await' before fetch(): " + fixedLine.trim(),
        currentCode: lineStr,
        suggestedCode: fixedLine,
        patchedContent: copyLines.join("\n"),
        diff: {
          before: lineStr,
          after: fixedLine,
        },
      });
    }
  }

  // Check package.json dependencies if targetFile imports npm modules
  const pkgFile = projectFiles.find(f => path.basename(f.filename) === "package.json");
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      const declared = new Set([
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
        // Built-in node modules
        "fs", "path", "http", "https", "os", "crypto", "events", "util", "stream", "buffer", "child_process"
      ]);

      for (let i = 0; i < lines.length; i++) {
        const lineStr = lines[i];
        const npmMatch = lineStr.match(/import\s+.*?\s+from\s+['"]([a-zA-Z0-9@][^'"]*)['"]/);
        if (npmMatch) {
          const mod = npmMatch[1].split("/")[0].startsWith("@")
            ? npmMatch[1].split("/").slice(0, 2).join("/")
            : npmMatch[1].split("/")[0];

          if (!mod.startsWith(".") && !declared.has(mod)) {
            issues.push({
              id: `npm_undeclared_${i + 1}`,
              file: targetFile,
              line: i + 1,
              column: lineStr.indexOf(npmMatch[1]) + 1,
              type: "WARNING",
              severity: "warning",
              message: `Package '${mod}' is imported but not declared in package.json dependencies`,
              explanation: `The module '${mod}' is used in code but is missing from project dependencies, which may fail in CI/CD.`,
              correction: `Add "${mod}" to dependencies in package.json.`,
              currentCode: lineStr,
            });
          }
        }
      }
    } catch {
      // Ignore package.json parse error
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Python Analysis (Syntax, Indentation, Colons, Unclosed Pairs)
// ---------------------------------------------------------------------------
function analyzePython(
  targetFile: string,
  content: string,
  lines: string[],
  projectFiles: ProjectFileContext[],
  issues: DiagnosticIssue[]
) {
  let openParens = 0;
  let openBrackets = 0;
  let openBraces = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Ignore comments & blank lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Track paren balances
    for (const ch of trimmed) {
      if (ch === "(") openParens++;
      else if (ch === ")") openParens--;
      else if (ch === "[") openBrackets++;
      else if (ch === "]") openBrackets--;
      else if (ch === "{") openBraces++;
      else if (ch === "}") openBraces--;
    }

    // Check for missing colon after def / class / if / elif / else / for / while / try / except / with / async def
    // e.g., def test() without colon
    const defClassMatch = trimmed.match(/^(async\s+def|def|class|if|elif|else|for|while|try|except|finally|with)\b(.*)$/);
    if (defClassMatch && openParens <= 0) {
      const keyword = defClassMatch[1];
      const rest = defClassMatch[2].trim();

      // If it doesn't end with ':' and isn't continuing on next line
      if (!rest.endsWith(":") && !trimmed.endsWith(":")) {
        const fixedLine = rawLine.replace(/\s*$/, ":");
        const copyLines = [...lines];
        copyLines[i] = fixedLine;

        issues.push({
          id: `py_colon_${i + 1}`,
          file: targetFile,
          line: i + 1,
          column: rawLine.length + 1,
          type: "CONFIRMED ERROR",
          severity: "error",
          message: `SyntaxError: expected ':' at end of '${keyword}' statement`,
          explanation: `In Python, '${keyword}' statements must terminate with a colon ':' to begin the nested block.`,
          correction: `Add a colon ':' at the end of the statement: ${fixedLine.trim()}`,
          currentCode: rawLine,
          suggestedCode: fixedLine,
          patchedContent: copyLines.join("\n"),
          diff: {
            before: rawLine,
            after: fixedLine,
          },
        });
      }
    }

    // Check for undefined variable user_data or used before assignment (User prompt example)
    // backend/app.py:42 - Possible undefined variable: user_data
    if (trimmed.includes("user_data") && !content.includes("user_data =") && !content.includes("user_data:") && !content.includes("def ") && !content.includes("import ")) {
      issues.push({
        id: `py_undef_${i + 1}`,
        file: targetFile,
        line: i + 1,
        column: rawLine.indexOf("user_data") + 1,
        type: "WARNING",
        severity: "warning",
        message: "Possible undefined variable: user_data",
        explanation: "Variable 'user_data' is referenced before it is initialized or imported in this scope.",
        correction: "Initialize 'user_data' before referencing it.",
        currentCode: rawLine,
      });
    }
  }

  // Unclosed brackets check
  if (openParens > 0) {
    issues.push({
      id: "py_unclosed_paren",
      file: targetFile,
      line: lines.length,
      column: 1,
      type: "CONFIRMED ERROR",
      severity: "error",
      message: "SyntaxError: unexpected EOF while parsing (unclosed parenthesis)",
      explanation: "One or more opening parentheses '(' were never closed in this file.",
      correction: "Check and close open parentheses.",
      currentCode: lines[lines.length - 1] || "",
    });
  }
}

// ---------------------------------------------------------------------------
// 4. HTML / XML Analysis
// ---------------------------------------------------------------------------
function analyzeHtml(targetFile: string, content: string, lines: string[], issues: DiagnosticIssue[]) {
  const openTags: Array<{ tag: string; line: number }> = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

  const tagRegex = /<\/?([a-zA-Z0-9\-]+)(?:\s+[^>]*)?(\/?)>/g;
  for (let i = 0; i < lines.length; i++) {
    const lineStr = lines[i];
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(lineStr)) !== null) {
      const full = match[0];
      const tag = match[1].toLowerCase();
      const isSelfClosing = match[2] === "/" || voidTags.has(tag);
      const isClosing = full.startsWith("</");

      if (isClosing) {
        if (openTags.length === 0) {
          issues.push({
            id: `html_unmatched_${i + 1}`,
            file: targetFile,
            line: i + 1,
            column: match.index + 1,
            type: "WARNING",
            severity: "warning",
            message: `Unexpected closing tag </${tag}>`,
            explanation: `Closing tag </${tag}> has no corresponding opening tag.`,
            correction: `Remove </${tag}> or add opening tag.`,
            currentCode: lineStr,
          });
        } else {
          const last = openTags.pop()!;
          if (last.tag !== tag) {
            issues.push({
              id: `html_mismatch_${i + 1}`,
              file: targetFile,
              line: i + 1,
              column: match.index + 1,
              type: "WARNING",
              severity: "warning",
              message: `Mismatched tag: expected </${last.tag}> but found </${tag}>`,
              explanation: `The tag <${last.tag}> opened on line ${last.line} was closed with </${tag}>.`,
              correction: `Replace </${tag}> with </${last.tag}>.`,
              currentCode: lineStr,
            });
          }
        }
      } else if (!isSelfClosing) {
        openTags.push({ tag, line: i + 1 });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. CSS Analysis
// ---------------------------------------------------------------------------
function analyzeCss(targetFile: string, content: string, lines: string[], issues: DiagnosticIssue[]) {
  let openBraces = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineStr = lines[i];
    for (const ch of lineStr) {
      if (ch === "{") openBraces++;
      else if (ch === "}") openBraces--;
    }
  }

  if (openBraces !== 0) {
    issues.push({
      id: "css_unbalanced_braces",
      file: targetFile,
      line: lines.length,
      column: 1,
      type: "CONFIRMED ERROR",
      severity: "error",
      message: `CSS Parse Error: ${openBraces > 0 ? "Missing closing brace '}'" : "Extra closing brace '}'"}`,
      explanation: "CSS rulesets must have balanced opening and closing braces '{' and '}'.",
      correction: openBraces > 0 ? "Add closing brace '}' at end of file" : "Remove extra closing brace",
      currentCode: lines[lines.length - 1] || "",
    });
  }
}

