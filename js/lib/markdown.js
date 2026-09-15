window.Clarity = window.Clarity || {};

(function () {
  var LANG_KEYWORDS = {
    python: ["def ", "class ", "import ", "from ", "return ", "if ", "elif ", "else:", "for ", "while ", "try:", "except", "finally:", "with ", "yield", "lambda ", "async ", "await ", "raise ", "None", "True", "False", "self"],
    javascript: ["function ", "const ", "let ", "var ", "return", "if (", "else", "for (", "while (", "try {", "catch", "finally {", "import ", "export ", "async ", "await ", "this", "=>", "undefined", "null"],
    typescript: ["function ", "const ", "let ", "var ", "return", "if (", "else", "interface ", "type ", "enum ", "class ", "implements", "async ", "await ", "this"],
    html: ["<!DOCTYPE", "<html", "<head", "<body", "<div", "<span", "<a ", "<script", "<style", "<meta", "<link", "<img"],
    css: ["{", "}", ":", "margin", "padding", "color", "background", "border", "display", "flex", "grid", "position", "width", "height"],
    sql: ["SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "INNER JOIN", "GROUP BY", "ORDER BY", "HAVING", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "TABLE", "INDEX"],
    json: null,
    yaml: null,
    bash: ["echo ", "export ", "cd ", "ls ", "cat ", "grep ", "sed ", "awk ", "pip ", "npm ", "git ", "docker ", "curl ", "wget", "$(", "${", "&&"],
    go: ["func ", "import", "package ", "var ", "const ", "type ", "struct {", "interface {", "return ", "if err", "defer ", "go "],
    rust: ["fn ", "let ", "mut ", "impl ", "struct ", "enum ", "trait ", "match ", "return ", "if ", "else", "use ", "pub "],
    java: ["package ", "import ", "public ", "class ", "private ", "protected ", "static ", "void ", "return ", "if (", "try", "catch"],
    c: ["#include", "#define", "int ", "void ", "return ", "if (", "else", "for (", "while (", "struct ", "typedef"],
    cpp: ["#include", "class ", "public:", "private:", "protected:", "virtual ", "template", "using ", "std::", "return "],
    csharp: ["using ", "namespace ", "class ", "public ", "private ", "protected ", "internal ", "static ", "void ", "string", "var "],
    php: ["<?php", "function ", "echo ", "if (", "else", "foreach (", "$_GET", "$_POST", "return ", "class ", "public ", "private "],
    ruby: ["def ", "class ", "module ", "require ", "if ", "else", "end", "do ", "each", "puts ", "return ", "@"],
    tsx: ["function ", "const ", "return", "if (", "interface ", "type ", "class ", "=>", "async ", "await"],
  };

  var CODE_PATTERNS = [
    { name: "comment", re: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g },
    { name: "string", re: /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g },
    { name: "keyword", re: null },
    { name: "function", re: /(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\())/g },
    { name: "number", re: /(\b\d+\.?\d*\b(?:[eE][+-]?\d+)?)/g },
    { name: "operator", re: /([<>=!]=|===|!==|[-+*/%<>!=&|^~.,;:]+|\*\*)/g },
  ];

  function highlightCode(code, lang) {
    if (!lang) return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    var keywords = LANG_KEYWORDS[lang];
    if (!keywords) {
      return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    code = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    var kwPattern = new RegExp("\\\\b(" + keywords.map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s*");
    }).join("|") + ")", "gi");
    return code.replace(kwPattern, '<span class="tk">$&</span>');
  }

  var LANG_ALIASES = {
    ts: "typescript",
    js: "javascript",
    py: "python",
    sh: "bash",
    shell: "bash",
    c__: "c",
    h: "c",
    hpp: "cpp",
  };

  function normalizeLang(lang) {
    lang = lang.toLowerCase().replace(/^-+|-+$/g, "");
    if (LANG_ALIASES[lang]) return LANG_ALIASES[lang];
    return lang;
  }

  function escapeHtml(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function tokenize(text) {
    var tokens = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (ch === "`") {
        var count = 1;
        while (i + count < text.length && text[i + count] === "`") count++;
        var start = i + count;
        var end = text.indexOf("`".repeat(count), start);
        if (end === -1) { end = text.length; }
        var inner = text.slice(start, end).replace(/\n/g, " ");
        tokens.push({ type: "code_inline", content: inner });
        i = end + count;
      } else if (ch === "\n") {
        tokens.push({ type: "newline" });
        i++;
      } else if (ch === "*") {
        var j = i;
        while (j < text.length && text[j] === "*") j++;
        tokens.push({ type: "star", count: j - i });
        i = j;
      } else if (ch === "_") {
        tokens.push({ type: "underscore" });
        i++;
      } else if (ch === "[") {
        var linkEnd = text.indexOf("]", i + 1);
        if (linkEnd !== -1 && text[linkEnd + 1] === "(") {
          var linkClose = text.indexOf(")", linkEnd + 2);
          if (linkClose !== -1) {
            var linkText = text.slice(i + 1, linkEnd);
            var linkUrl = text.slice(linkEnd + 2, linkClose);
            tokens.push({ type: "link", text: linkText, url: linkUrl });
            i = linkClose + 1;
          } else {
            tokens.push({ type: "text", content: ch });
            i++;
          }
        } else {
          tokens.push({ type: "text", content: ch });
          i++;
        }
      } else if (ch === "!" && text[i + 1] === "[") {
        var imgEnd = text.indexOf("]", i + 2);
        if (imgEnd !== -1 && text[imgEnd + 1] === "(") {
          var imgClose = text.indexOf(")", imgEnd + 2);
          if (imgClose !== -1) {
            var altText = text.slice(i + 2, imgEnd);
            var imgUrl = text.slice(imgEnd + 2, imgClose);
            tokens.push({ type: "image", alt: altText, url: imgUrl });
            i = imgClose + 1;
          } else {
            tokens.push({ type: "text", content: ch });
            i++;
          }
        } else {
          tokens.push({ type: "text", content: ch });
          i++;
        }
      } else {
        var startI = i;
        while (i < text.length && text[i] !== "`" && text[i] !== "\n" && text[i] !== "*" && text[i] !== "_" && text[i] !== "[" && text[i] !== "!" && !(text[i] === "]" && i > 0)) i++;
        tokens.push({ type: "text", content: text.slice(startI, i) });
      }
    }
    return tokens;
  }

  function parseInline(text, options) {
    text = String(text || "");
    var result = "";
    var pos = 0;
    while (pos < text.length) {
      var ch = text[pos];
      if (ch === "`") {
        var count = 1;
        while (pos + count < text.length && text[pos + count] === "`") count++;
        var endPos = pos + count;
        var closePos = text.indexOf("`".repeat(count), endPos);
        if (closePos === -1) {
          result += escapeHtml(text.slice(pos, pos + count));
          pos += count;
        } else {
          var code = text.slice(endPos, closePos);
          result += '<code class="code-inline">' + escapeHtml(code) + "</code>";
          pos = closePos + count;
        }
      } else if (ch === "*" || ch === "_") {
        result += parseEmphasis(text, pos, ch, options);
        pos = Math.max(pos + 1, parseEmphasis.endPos || pos + 1);
      } else if (ch === "~" && text[pos + 1] === "~") {
        var tildeClose = text.indexOf("~~", pos + 2);
        if (tildeClose !== -1) {
          result += "<del>" + parseInline(text.slice(pos + 2, tildeClose), options) + "</del>";
          pos = tildeClose + 2;
        } else {
          result += escapeHtml(ch);
          pos++;
        }
      } else if (ch === "[" || (ch === "!" && text[pos + 1] === "[")) {
        result += parseLink(text, pos, ch, options);
        pos = Math.max(pos + 1, parseLink.endPos || pos + 1);
      } else if (ch === "<") {
        // Handle inline HTML tags like <div align="center">, <p align="center">, <b>, <i>, <br/>, <img src="...">, <a>
        var tagMatch = text.slice(pos).match(/^<(\/?[a-zA-Z1-6]+(?:\s+[^>]*?)?\s*\/?)>/);
        if (tagMatch) {
          var rawTag = tagMatch[0];
          var tagName = tagMatch[1].toLowerCase().replace('/', '').split(' ')[0];
          var safeTags = ['div', 'p', 'span', 'b', 'strong', 'i', 'em', 'br', 'hr', 'img', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'code', 'pre', 'blockquote', 'sub', 'sup', 'del'];
          if (safeTags.includes(tagName)) {
            // Resolve relative image src inside <img src="..."> if projectId provided
            if (tagName === 'img' && options && options.projectId) {
              rawTag = rawTag.replace(/src=["']([^"']+)["']/g, function(match, srcVal) {
                if (srcVal && !srcVal.startsWith('http://') && !srcVal.startsWith('https://') && !srcVal.startsWith('data:')) {
                  var cleanRel = srcVal.replace(/^\.\//, '');
                  var resolved = '/api/projects/' + options.projectId + '/file/raw?path=' + encodeURIComponent(cleanRel);
                  return 'src="' + resolved + '"';
                }
                return match;
              });
            }
            result += rawTag;
            pos += tagMatch[0].length;
          } else {
            result += escapeHtml(ch);
            pos++;
          }
        } else {
          result += escapeHtml(ch);
          pos++;
        }
      } else {
        var nextSpecial = text.length;
        for (var idx = pos + 1; idx < text.length; idx++) {
          if (text[idx] === "`" || text[idx] === "*" || text[idx] === "_" || text[idx] === "~" || text[idx] === "[" || (text[idx] === "!" && text[idx + 1] === "[") || text[idx] === "<") {
            nextSpecial = idx;
            break;
          }
        }
        result += escapeHtml(text.slice(pos, nextSpecial));
        pos = nextSpecial;
      }
    }
    return result;
  }
  parseEmphasis.endPos = 0;

  function parseEmphasis(text, pos, marker, options) {
    var rest = text.slice(pos);

    if (marker === "_") {
      var prevChar = pos > 0 ? text[pos - 1] : " ";
      var nextChar = pos + 1 < text.length ? text[pos + 1] : " ";
      if (/\w/.test(prevChar) && /\w/.test(nextChar)) {
        parseEmphasis.endPos = pos + 1;
        return escapeHtml(marker);
      }
    }

    var tripleMatch = rest.match(/^(\*{3}|_{3})([^\n]+?)\1/);
    if (tripleMatch) {
      parseEmphasis.endPos = pos + tripleMatch[0].length;
      return "<strong><em>" + parseInline(tripleMatch[2], options) + "</em></strong>";
    }

    var strongMatch = rest.match(/^(\*{2}|_{2})([^\n]+?)\1/);
    if (strongMatch) {
      var content = strongMatch[2];
      parseEmphasis.endPos = pos + strongMatch[0].length;
      return "<strong>" + parseInline(content, options) + "</strong>";
    }

    var emMatch = rest.match(/^(\*|_)([^\n]+?)\1/);
    if (emMatch) {
      var content2 = emMatch[2];
      parseEmphasis.endPos = pos + emMatch[0].length;
      return "<em>" + parseInline(content2, options) + "</em>";
    }

    parseEmphasis.endPos = pos + 1;
    return escapeHtml(marker);
  }

  function parseLink(text, pos, ch, options) {
    var isImage = ch === "!";
    var startBracket = pos + (isImage ? 2 : 1);
    
    // Balanced bracket search for link text/label
    var depth = 1;
    var closeBracket = -1;
    for (var i = startBracket; i < text.length; i++) {
      if (text[i] === "\\") {
        i++;
        continue;
      }
      if (text[i] === "[") depth++;
      else if (text[i] === "]") {
        depth--;
        if (depth === 0) {
          closeBracket = i;
          break;
        }
      }
    }

    if (closeBracket === -1) {
      parseLink.endPos = pos + 1;
      return escapeHtml(ch);
    }

    if (text[closeBracket + 1] !== "(") {
      parseLink.endPos = pos + 1;
      return escapeHtml(ch);
    }

    // Balanced parenthesis search for URL
    var closeParen = -1;
    var parenDepth = 1;
    for (var j = closeBracket + 2; j < text.length; j++) {
      if (text[j] === "\\") {
        j++;
        continue;
      }
      if (text[j] === "(") parenDepth++;
      else if (text[j] === ")") {
        parenDepth--;
        if (parenDepth === 0) {
          closeParen = j;
          break;
        }
      }
    }

    if (closeParen === -1) {
      parseLink.endPos = pos + 1;
      return escapeHtml(ch);
    }

    var linkText = text.slice(startBracket, closeBracket);
    var linkUrl = text.slice(closeBracket + 2, closeParen).trim();
    parseLink.endPos = closeParen + 1;

    if (isImage) {
      var src = linkUrl;
      if (options && options.projectId && src && !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:")) {
        var cleanRel = src.replace(/^\.\//, "");
        src = "/api/projects/" + options.projectId + "/file/raw?path=" + encodeURIComponent(cleanRel);
      }
      return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(linkText) + '" loading="lazy" style="max-width:100%; border-radius:6px; margin:4px 0;" />';
    }

    return '<a href="' + escapeHtml(linkUrl) + '" target="_blank" rel="noopener noreferrer">' + parseInline(linkText, options) + "</a>";
  }

  var MERMAID_START = /^\s*(graph\s+(TD|TB|BT|RL|LR)|flowchart\s+(TD|TB|BT|RL|LR)|sequenceDiagram|erDiagram|classDiagram|gantt|pie\s+title|stateDiagram|stateDiagram-v2|gitGraph|mindmap|timeline)\b/i;

  function pushTextBlock(current, blocks, lastPreceding) {
    if (!current || current.length === 0) return;
    var joined = current.join("\n");
    var firstLine = (current.find(function(l) { return l.trim().length > 0; }) || "").trim();
    // Only parse as mermaid if the very first line starts with a diagram declaration AND the body contains diagram connectors
    var isDiagram = MERMAID_START.test(firstLine) && /(\-\->|\-\.\->|==>|subgraph|participant|actor|title\s+|section\s+|class\s+|\[.*\]|\(.*\))/i.test(joined);
    if (isDiagram) {
      blocks.push({
        type: "code",
        lang: "mermaid",
        code: joined,
        precedingText: lastPreceding,
      });
    } else {
      blocks.push({ type: "text", lines: current });
    }
  }

  function parseBlocks(text) {
    var lines = text.split("\n");
    var blocks = [];
    var current = [];
    var inCodeFence = false;
    var codeLang = "";
    var codeLines = [];
    var lastPreceding = "";

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fenceMatch = line.match(/^(```+|~~~+)\s*(\S*)/);
      if (inCodeFence) {
        if (fenceMatch) {
          blocks.push({
            type: "code",
            lang: codeLang || "",
            code: codeLines.join("\n"),
            precedingText: lastPreceding,
          });
          inCodeFence = false;
          codeLines = [];
          codeLang = "";
          lastPreceding = "";
        } else {
          codeLines.push(line);
        }
        continue;
      }
      if (fenceMatch) {
        if (current.length > 0) {
          lastPreceding = current.join("\n");
          pushTextBlock(current, blocks, lastPreceding);
          current = [];
        } else if (blocks.length > 0 && blocks[blocks.length - 1].lines) {
          lastPreceding = blocks[blocks.length - 1].lines.join("\n");
        }
        inCodeFence = true;
        codeLang = fenceMatch[2] || "";
        codeLines = [];
        continue;
      }
      if (line.trim() === "") {
        if (current.length > 0) {
          pushTextBlock(current, blocks, lastPreceding);
          current = [];
        }
      } else if (isTableSeparator(line) && current.length > 0 && isTableLine(current[current.length - 1])) {
        var header = current.pop();
        if (current.length > 0) {
          pushTextBlock(current, blocks, lastPreceding);
        }
        current = [header, line];
      } else if (current.length > 1 && isTableSeparator(current[1]) && !isTableLine(line)) {
        pushTextBlock(current, blocks, lastPreceding);
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      pushTextBlock(current, blocks, lastPreceding);
    }
    if (inCodeFence) {
      blocks.push({
        type: "code",
        lang: codeLang,
        code: codeLines.join("\n"),
        precedingText: lastPreceding,
        isStreaming: true,
      });
    }
    return blocks;
  }

  function renderHeading(line, level, options) {
    var content = line.slice(level + 1).trim();
    if (content.endsWith("#".repeat(level))) {
      content = content.slice(0, -(level + 1)).trim();
    }
    return '<h' + level + ' id="' + slugify(content) + '">' + parseInline(content, options) + "</h" + level + ">";
  }

  function slugify(text) {
    return String(text || "").toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function isTableLine(line) {
    return line.includes("|") && line.split("|").length >= 2;
  }

  function isTableSeparator(line) {
    var stripped = line.replace(/\s/g, "");
    return stripped.replace(/\|/g, "").match(/^(-+:?|:-+:?)+$/) !== null && stripped.includes("|");
  }

  function isListStart(line) {
    return /^(\s*)([-*+]|\d+\.)\s+/.test(line);
  }

  function renderList(lines, options) {
    if (!lines || lines.length === 0) return "";

    var listRegex = /^(\s*)([-*+]|\d+\.)\s+(.*)/;
    var taskRegex = /^\[([ xX])\]\s*(.*)/;

    var items = [];
    var currentItem = null;

    for (var i = 0; i < lines.length; i++) {
      var rawLine = lines[i];
      var match = rawLine.match(listRegex);
      if (match) {
        var indentStr = match[1] || "";
        var indent = indentStr.replace(/\t/g, "  ").length;
        var marker = match[2];
        var isOrdered = /\d+\./.test(marker);
        var rawContent = match[3] || "";
        var isTask = false;
        var isChecked = false;
        var taskMatch = rawContent.match(taskRegex);
        if (taskMatch) {
          isTask = true;
          isChecked = taskMatch[1].toLowerCase() === "x";
          rawContent = taskMatch[2] || "";
        }

        currentItem = {
          indent: indent,
          isOrdered: isOrdered,
          text: rawContent,
          isTask: isTask,
          isChecked: isChecked,
          children: [],
        };
        items.push(currentItem);
      } else if (rawLine.trim() !== "") {
        if (currentItem) {
          currentItem.text += " " + rawLine.trim();
        } else {
          items.push({
            indent: 0,
            isOrdered: false,
            text: rawLine.trim(),
            isTask: false,
            isChecked: false,
            children: [],
          });
        }
      }
    }

    if (items.length === 0) return "";

    // Build hierarchical tree
    var root = { children: [], indent: -1 };
    var stack = [root];

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) {
        stack.pop();
      }
      var parent = stack[stack.length - 1];
      parent.children.push(item);
      stack.push(item);
    }

    function renderTree(nodeList) {
      if (!nodeList || nodeList.length === 0) return "";
      var isOrdered = nodeList[0].isOrdered;
      var tag = isOrdered ? "ol" : "ul";
      var html = "<" + tag + ">";

      for (var k = 0; k < nodeList.length; k++) {
        var n = nodeList[k];
        var liClass = n.isTask ? ' class="task-list-item"' : "";
        var itemPrefix = "";
        if (n.isTask) {
          itemPrefix = '<input type="checkbox" disabled ' + (n.isChecked ? 'checked ' : '') + '/> ';
        }
        html += "<li" + liClass + ">" + itemPrefix + parseInline(n.text, options);
        if (n.children && n.children.length > 0) {
          html += renderTree(n.children);
        }
        html += "</li>";
      }

      html += "</" + tag + ">";
      return html;
    }

    return renderTree(root.children);
  }

  function renderTable(rows, options) {
    if (!rows || rows.length < 2) return "";
    
    function parseCells(row) {
      var cells = row.split("|").map(function (c) { return c.trim(); });
      if (cells.length > 0 && cells[0] === "") cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
      return cells;
    }

    var headerCells = parseCells(rows[0]);
    var html = '<div class="table-wrapper" style="overflow-x:auto; margin:16px 0; border-radius:6px; border:1px solid var(--border, #e5e7eb);"><table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">\n<thead>\n<tr>';
    for (var i = 0; i < headerCells.length; i++) {
      html += '<th style="border-bottom:2px solid var(--border, #e5e7eb); padding:10px 16px; background:var(--surface-muted, #f9fafb); font-weight:600; color:var(--ink, #111827);">' + parseInline(headerCells[i], options) + "</th>";
    }
    html += "</tr>\n</thead>\n<tbody>\n";
    
    for (var r = 2; r < rows.length; r++) {
      var rowStr = rows[r].trim();
      if (!rowStr) continue;
      var cells = parseCells(rowStr);
      if (cells.length === 0) continue;
      var rowBg = (r % 2 === 1) ? 'background:var(--surface-muted, #f9fafb);' : 'background:var(--surface, #ffffff);';
      html += '<tr style="' + rowBg + ' border-bottom:1px solid var(--border, #e5e7eb);">';
      for (var c = 0; c < headerCells.length; c++) {
        var cellContent = cells[c] || "";
        html += '<td style="padding:10px 16px; color:var(--ink-muted, #4b5563);">' + parseInline(cellContent, options) + "</td>";
      }
      html += "</tr>\n";
    }
    html += "</tbody>\n</table></div>";
    return html;
  }

  function renderBlock(block, options) {
    var lines = block.lines || [];
    var first = (lines[0] || "").trim();

    if (first.match(/^#{1,6}\s/)) {
      return renderHeading(first, first.match(/^#+/)[0].length, options);
    }

    if (first.match(/^(?:-{3,}|\*{3,}|_{3,})$/)) {
      return "<hr />";
    }

    if (isTableLine(first) && lines.length > 1 && isTableSeparator(lines[1])) {
      return renderTable(lines, options);
    }

    if (isListStart(lines[0] || "")) {
      return renderList(lines, options);
    }

    if (first.startsWith("> ")) {
      var content = lines.map(function (l) {
        if (l.trim().startsWith("> ")) return l.replace(/^> /, "");
        if (l.trim() === ">") return "";
        return l;
      }).join("\n").trim();
      return '<blockquote>' + parseInline(content, options) + "</blockquote>";
    }

    var para = '<p>' + parseInline(lines.join("\n").trim(), options) + "</p>";
    return para;
  }

  function renderCode(block, siblingFiles, codeIndex) {
    var code = block.code || "";
    var lang = (block.lang || "").trim();
    if (lang.toLowerCase().startsWith('mermaid') || MERMAID_START.test(code.trim())) {
      var cellId = block.cellId || "mermaid_" + Math.random().toString(36).substring(2, 9);
      var codeEscaped = escapeHtml(code);
      return `<div class="mermaid-container" id="${cellId}">
        <pre class="mermaid">${codeEscaped}</pre>
      </div>`;
    }
    var cellId = block.cellId || "codecell_" + Math.random().toString(36).substring(2, 9);

    if (window.Clarity && window.Clarity.codeViewer && typeof window.Clarity.codeViewer.renderCell === "function") {
      return window.Clarity.codeViewer.renderCell({
        cellId: cellId,
        code: code,
        lang: lang,
        precedingText: block.precedingText || "",
        isStreaming: Boolean(block.isStreaming),
        files: siblingFiles,
        activeFileIndex: typeof codeIndex === "number" ? codeIndex : 0,
      });
    }

    var normLang = normalizeLang(lang);
    var highlighted = escapeHtml(code);
    var copyBtn = '<button class="code-cell__btn code-cell__btn--copy" type="button" data-code-action="copy" data-cell-id="' + cellId + '"><span>Copy</span></button>';
    var downloadBtn = '<button class="code-cell__btn code-cell__btn--download" type="button" data-code-action="download" data-cell-id="' + cellId + '"><span>Download</span></button>';
    var expandBtn = '<button class="code-cell__btn code-cell__btn--expand" type="button" data-code-action="expand" data-cell-id="' + cellId + '" onclick="window.Clarity.codeViewer && window.Clarity.codeViewer.openWorkspace(\'' + cellId + '\', \'code\', this); return false;"><span>Expand</span></button>';
    var header = '<div class="code-cell__header"><span class="code-cell__badge">' + escapeHtml(normLang || "text") + '</span><div style="display:flex;gap:4px;">' + copyBtn + downloadBtn + expandBtn + '</div></div>';
    var body = '<div class="code-cell__body"><div class="code-cell__editor-wrap"><code>' + highlighted + '</code></div></div>';
    return '<div class="code-cell" id="' + cellId + '">' + header + body + '</div>';
  }

  function renderMarkdown(text, options) {
    text = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!text.trim()) return '<p class="empty">No content.</p>';

    var blocks = parseBlocks(text);

    // Group sibling files if multiple code blocks exist in this message
    var codeBlocks = blocks.filter(function (b) { return b.type === "code" && b.lang.toLowerCase() !== "mermaid"; });
    var siblingFiles = null;
    if (codeBlocks.length > 1 && window.Clarity && window.Clarity.highlighter) {
      siblingFiles = codeBlocks.map(function (b, idx) {
        var fn = window.Clarity.highlighter.detectFilename(b.lang, b.code, b.precedingText);
        var langInfo = window.Clarity.highlighter.getLanguageInfo(b.lang || fn);
        return {
          id: "file_" + idx,
          name: fn,
          lang: langInfo.id || b.lang,
          code: b.code || "",
        };
      });
    }

    var html = "";
    var codeIndex = 0;
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.type === "code") {
        html += renderCode(block, siblingFiles, codeIndex);
        if (block.lang.toLowerCase() !== "mermaid") {
          codeIndex++;
        }
      } else {
        var rendered = renderBlock(block, options);
        if (rendered) html += rendered;
      }
    }
    return html;
  }

  function getStandaloneSvgString(svgElement) {
    if (!svgElement) return "";
    var clone;
    try {
      clone = svgElement.cloneNode(true);
    } catch (e) {
      return "";
    }
    if (!clone) return "";
    if (clone.style) {
      clone.style.transform = "";
    }
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    if (!clone.getAttribute("xmlns:xlink")) {
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    }

    var width = 1200;
    var height = 800;
    try {
      var bbox = svgElement.getBoundingClientRect();
      width = Math.max(1200, Math.round(bbox.width) || 1000);
      height = Math.max(700, Math.round(bbox.height) || 700);
    } catch (e) {}

    if (!clone.getAttribute("viewBox")) {
      clone.setAttribute("viewBox", "0 0 " + width + " " + height);
    }
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);

    // Convert any foreignObject to standard centered text nodes with emoji fallback font
    var foreignObjects = clone.querySelectorAll("foreignObject");
    foreignObjects.forEach(function(fo) {
      var text = fo.textContent ? fo.textContent.trim() : "";
      var foX = parseFloat(fo.getAttribute("x") || "0");
      var foY = parseFloat(fo.getAttribute("y") || "0");
      var foW = parseFloat(fo.getAttribute("width") || "0");
      var foH = parseFloat(fo.getAttribute("height") || "0");

      var textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
      textNode.setAttribute("x", String(foX + (foW > 0 ? foW / 2 : 0)));
      textNode.setAttribute("y", String(foY + (foH > 0 ? foH / 2 : 14)));
      textNode.setAttribute("text-anchor", "middle");
      textNode.setAttribute("dominant-baseline", "central");
      textNode.setAttribute("font-family", '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif');
      textNode.setAttribute("font-size", "13.5px");
      textNode.setAttribute("font-weight", "600");
      textNode.setAttribute("fill", "#0f172a");
      textNode.textContent = text;
      if (fo.parentNode) {
        fo.parentNode.replaceChild(textNode, fo);
      }
    });

    var styleEl = document.createElement("style");
    styleEl.textContent = [
      'svg { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif; background-color: #ffffff; text-rendering: geometricPrecision; }',
      '.node rect, .node circle, .node ellipse, .node polygon, .node path { fill: #f8fafc; stroke: #475569; stroke-width: 1.75px; }',
      '.edgePath .path, .flowchart-link { stroke: #334155 !important; stroke-width: 2.2px !important; fill: none !important; }',
      '.label text, text, tspan { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif !important; fill: #0f172a !important; font-size: 13.5px !important; font-weight: 600 !important; }',
      'marker { fill: #334155 !important; stroke: #334155 !important; }',
      '.cluster rect { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1.5px; }'
    ].join('\n');
    if (clone.firstChild) {
      clone.insertBefore(styleEl, clone.firstChild);
    } else {
      clone.appendChild(styleEl);
    }

    var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "#ffffff");
    if (styleEl.parentNode === clone) {
      clone.insertBefore(bgRect, styleEl);
    } else {
      clone.prepend(bgRect);
    }

    return new XMLSerializer().serializeToString(clone);
  }

  function downloadSvgDiagram(svgElement, filename) {
    try {
      var finalFilename = (filename || ("clarity_diagram_" + Date.now())).replace(/\.[^.]+$/, "") + ".svg";
      var svgStr = getStandaloneSvgString(svgElement);
      var blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 2000);

      if (window.Clarity && window.Clarity.toast) {
        window.Clarity.toast.show("Diagram downloaded as vector SVG", "success");
      }
    } catch (err) {
      console.error("Failed to download SVG diagram:", err);
      if (window.Clarity && window.Clarity.toast) {
        window.Clarity.toast.show("Failed to export SVG diagram", "error");
      }
    }
  }

  async function downloadDiagramFromServer(svgStr, format, filename) {
    try {
      var endpoint = (window.Clarity && window.Clarity.api ? window.Clarity.api.base : "") + "/api/diagrams/render-image";
      var response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          svg: svgStr,
          format: format,
          filename: filename,
          width: 3200
        })
      });

      if (!response.ok) {
        throw new Error("Server render failed: " + response.statusText);
      }

      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 2000);

      if (window.Clarity && window.Clarity.toast) {
        window.Clarity.toast.show("Diagram downloaded as high-quality " + format.toUpperCase(), "success");
      }
      return true;
    } catch (err) {
      console.error("Failed to render diagram via server:", err);
      if (window.Clarity && window.Clarity.toast) {
        window.Clarity.toast.show("Failed to export diagram image", "error");
      }
      return false;
    }
  }

  function downloadPngDiagram(svgElement, filename) {
    var finalFilename = (filename || ("clarity_diagram_" + Date.now())).replace(/\.[^.]+$/, "") + ".png";
    var svgStr = getStandaloneSvgString(svgElement);

    try {
      var bbox = svgElement.getBoundingClientRect();
      var scale = 3;
      var width = Math.max(2400, (Math.round(bbox.width) || 800) * scale);
      var height = Math.max(1400, (Math.round(bbox.height) || 600) * scale);

      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      var img = new Image();
      var svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

      img.onload = function() {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          var pngUrl = canvas.toDataURL("image/png");
          var a = document.createElement("a");
          a.href = pngUrl;
          a.download = finalFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (window.Clarity && window.Clarity.toast) {
            window.Clarity.toast.show("Diagram downloaded as high-resolution PNG (300 DPI)", "success");
          }
        } catch (canvasErr) {
          console.warn("Client canvas export failed, using backend renderer:", canvasErr);
          downloadDiagramFromServer(svgStr, "png", finalFilename);
        }
      };

      img.onerror = function() {
        console.warn("Image load failed on client, falling back to server PNG rendering");
        downloadDiagramFromServer(svgStr, "png", finalFilename);
      };

      img.src = svgDataUrl;
    } catch (err) {
      console.error("Client PNG generation error, using server fallback:", err);
      downloadDiagramFromServer(svgStr, "png", finalFilename);
    }
  }

  function downloadJpgDiagram(svgElement, filename) {
    var finalFilename = (filename || ("clarity_diagram_" + Date.now())).replace(/\.[^.]+$/, "") + ".jpg";
    var svgStr = getStandaloneSvgString(svgElement);

    try {
      var bbox = svgElement.getBoundingClientRect();
      var scale = 3;
      var width = Math.max(2400, (Math.round(bbox.width) || 800) * scale);
      var height = Math.max(1400, (Math.round(bbox.height) || 600) * scale);

      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      var img = new Image();
      var svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

      img.onload = function() {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          var jpgUrl = canvas.toDataURL("image/jpeg", 0.98);
          var a = document.createElement("a");
          a.href = jpgUrl;
          a.download = finalFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (window.Clarity && window.Clarity.toast) {
            window.Clarity.toast.show("Diagram downloaded as high-resolution JPG", "success");
          }
        } catch (canvasErr) {
          console.warn("Client canvas JPG export failed, using backend renderer:", canvasErr);
          downloadDiagramFromServer(svgStr, "jpg", finalFilename);
        }
      };

      img.onerror = function() {
        console.warn("Image load failed on client, falling back to server JPG rendering");
        downloadDiagramFromServer(svgStr, "jpg", finalFilename);
      };

      img.src = svgDataUrl;
    } catch (err) {
      console.error("Client JPG generation error, using server fallback:", err);
      downloadDiagramFromServer(svgStr, "jpg", finalFilename);
    }
  }

  function sanitizeAndRepairMermaid(rawCode) {
    if (!rawCode || typeof rawCode !== "string") return "";
    var code = rawCode.trim();

    // Strip markdown fences
    code = code.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    // Replace HTML entities
    code = code.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

    var rawLines = code.split("\n");
    var cleanedLines = [];
    var hasDiagramHeader = false;

    var knownKeywords = [
      "graph", "flowchart", "sequencediagram", "classdiagram", "statediagram",
      "statediagram-v2", "erdiagram", "gantt", "pie", "gitgraph", "mindmap",
      "timeline", "quadrantchart", "c4context", "sankey-beta", "architecture"
    ];

    for (var i = 0; i < rawLines.length; i++) {
      var line = rawLines[i];
      var trimmed = line.trim();
      if (!trimmed) {
        cleanedLines.push("");
        continue;
      }

      var lower = trimmed.toLowerCase();

      for (var k = 0; k < knownKeywords.length; k++) {
        var kw = knownKeywords[k];
        if (lower.startsWith(kw)) {
          hasDiagramHeader = true;
          if (lower.startsWith("graph ") || lower.startsWith("flowchart ")) {
            var parts = trimmed.split(/\s+/);
            var dtype = parts[0];
            var dir = (parts[1] || "TD").toUpperCase();
            line = dtype + " " + dir;
          }
          break;
        }
      }

      // Convert // and # comments to %%
      if (trimmed.startsWith("//") || (trimmed.startsWith("#") && !trimmed.startsWith("#!"))) {
        line = "%% " + trimmed.replace(/^(\/\/|#)\s*/, "");
      }

      cleanedLines.push(line);
    }

    if (!hasDiagramHeader) {
      cleanedLines.unshift("flowchart TD");
    }

    var processedLines = [];
    var inSubgraphCount = 0;

    for (var j = 0; j < cleanedLines.length; j++) {
      var curLine = cleanedLines[j];
      var curTrimmed = curLine.trim();

      if (!curTrimmed || curTrimmed.startsWith("%%") || (j === 0 && hasDiagramHeader)) {
        processedLines.push(curLine);
        continue;
      }

      // Drop standalone dangling arrow lines
      if (/^(-->|---|==>|-\.->|<--|<==)\s*$/.test(curTrimmed)) {
        continue;
      }
      if (/(-->|---|==>|-\.->|<--|<==)\s*$/.test(curTrimmed)) {
        curLine = curLine.replace(/\s*(-->|---|==>|-\.->|<--|<==)\s*$/, "");
      }

      // Fix subgraphs
      if (/^\s*subgraph\b/i.test(curTrimmed)) {
        inSubgraphCount++;
        var rest = curTrimmed.replace(/^\s*subgraph\s+/i, "").trim();
        if (rest && !rest.includes("[") && !rest.startsWith('"')) {
          var safeId = rest.replace(/[^a-zA-Z0-9_]/g, "_");
          curLine = "  subgraph " + safeId + ' ["' + rest.replace(/"/g, "'") + '"]';
        }
        processedLines.push(curLine);
        continue;
      }

      if (/^\s*end\b/i.test(curTrimmed)) {
        if (inSubgraphCount > 0) inSubgraphCount--;
        processedLines.push(curLine);
        continue;
      }

      // Fix edge labels: -->|Label| or -.->|Label|
      curLine = curLine.replace(/(\|)([^|\n]+)(\|)/g, function (m, p1, label, p3) {
        var cleanLabel = label.trim().replace(/"/g, "'");
        return '|"' + cleanLabel + '"|';
      });

      // Fix unquoted node definitions
      // 1. Stadium: id([label])
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\(\[\s*(.*?)\s*\]\)/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '(["' + label.replace(/"/g, "'") + '"])';
      });

      // 2. Subroutine: id[[label]]
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\[\[\s*(.*?)\s*\]\]/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '[["' + label.replace(/"/g, "'") + '"]]';
      });

      // 3. Database / Cylinder: id[(label)]
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\[\(\s*(.*?)\s*\)\]/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '[("' + label.replace(/"/g, "'") + '")]';
      });

      // 4. Circle: id((label))
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\(\(\s*(.*?)\s*\)\)/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '(("' + label.replace(/"/g, "'") + '"))';
      });

      // 5. Hexagon / Rhombus: id{{label}}
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\{\{\s*(.*?)\s*\}\}/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '{{"' + label.replace(/"/g, "'") + '"}}';
      });

      // 6. Decision / Diamond: id{label}
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\{\s*([^{}\n]*?)\s*\}/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '{"' + label.replace(/"/g, "'") + '"}';
      });

      // 7. Rounded Box: id(label)
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\(\s*([^()\n]*?)\s*\)/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '("' + label.replace(/"/g, "'") + '")';
      });

      // 8. Standard Box: id[label]
      curLine = curLine.replace(/([a-zA-Z0-9_\-]+)\s*\[\s*([^\[\]\n]*?)\s*\]/g, function (m, id, label) {
        if (label.startsWith('"') && label.endsWith('"')) return m;
        return id + '["' + label.replace(/"/g, "'") + '"]';
      });

      processedLines.push(curLine);
    }

    while (inSubgraphCount > 0) {
      processedLines.push("  end");
      inSubgraphCount--;
    }

    return processedLines.join("\n");
  }

  function aggressiveSimplifyMermaid(rawCode) {
    var lines = (rawCode || "").split("\n");
    var output = ["flowchart TD"];
    var nodeMap = {};
    var nodeCounter = 1;

    function getSafeNodeId(label) {
      var clean = label.trim().replace(/^["']|["']$/g, "").replace(/[{}\[\]()<>]/g, "").trim();
      if (!clean) clean = "Step " + nodeCounter;
      if (!nodeMap[clean]) {
        nodeMap[clean] = "N" + (nodeCounter++);
      }
      return { id: nodeMap[clean], label: clean };
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.startsWith("%%") || line.startsWith("//") || line.startsWith("#")) continue;
      if (/^(graph|flowchart|sequenceDiagram|classDiagram)/i.test(line)) continue;

      var arrowMatch = line.match(/(.*?)\s*(-->|---|==>|-\.->)\s*(?:\|(.*?)\|)?\s*(.*)/);
      if (arrowMatch) {
        var left = arrowMatch[1].trim();
        var edgeLabel = (arrowMatch[3] || "").trim();
        var right = arrowMatch[4].trim();

        if (left && right) {
          var leftInfo = getSafeNodeId(left);
          var rightInfo = getSafeNodeId(right);
          var edgeStr = edgeLabel ? ' -->|"' + edgeLabel.replace(/"/g, "'") + '"| ' : ' --> ';
          output.push('  ' + leftInfo.id + '["' + leftInfo.label.replace(/"/g, "'") + '"]' + edgeStr + rightInfo.id + '["' + rightInfo.label.replace(/"/g, "'") + '"]');
        }
      }
    }

    if (output.length === 1) {
      output.push('  Start["System Flow"] --> Complete["Completed"]');
    }

    return output.join("\n");
  }

  function renderDiagramFallbackCard(container, code) {
    if (!container) return;
    container.innerHTML = [
      '<div class="diagram-fallback-card" style="padding:14px; border:1px solid var(--line); border-radius:8px; background:var(--surface); margin:8px 0;">',
      '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--line);">',
      '    <div style="display:flex; align-items:center; gap:8px;">',
      '      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
      '      <span style="font-weight:600; font-size:13px; color:var(--ink);">System Flow & Architecture</span>',
      '    </div>',
      '    <button type="button" class="btn btn--xs btn--outline" style="font-size:11px; padding:3px 8px;" onclick="navigator.clipboard.writeText(this.getAttribute(\'data-code\')).then(()=>{ if(window.Clarity && window.Clarity.toast) window.Clarity.toast.show(\'Diagram source copied\', \'success\'); })" data-code="' + escapeHtml(code) + '">',
      '      Copy Diagram Code',
      '    </button>',
      '  </div>',
      '  <pre style="margin:0; font-family:var(--font-mono); font-size:12px; background:var(--surface-muted); padding:10px; border-radius:6px; overflow-x:auto; color:var(--ink-secondary); line-height:1.5;">' + escapeHtml(code) + '</pre>',
      '</div>'
    ].join('');
  }

  function attachMermaidZoomControls(container) {
    if (!container || container.querySelector('.mermaid-controls')) return;
    var svg = container.querySelector('svg');
    if (!svg) return;

    if (svg.style) {
      svg.style.transformOrigin = 'top center';
      svg.style.transition = 'transform 0.08s ease-out';
    }

    // Wrap svg in viewport if not present
    var viewport = container.querySelector('.mermaid-viewport');
    if (!viewport) {
      viewport = document.createElement('div');
      viewport.className = 'mermaid-viewport';
      var pre = container.querySelector('pre.mermaid');
      if (pre && container.contains(pre)) {
        pre.parentNode.replaceChild(viewport, pre);
      } else if (svg.parentNode && container.contains(svg.parentNode)) {
        svg.parentNode.insertBefore(viewport, svg);
      } else {
        container.appendChild(viewport);
      }
      viewport.appendChild(svg);
    }
    viewport.style.touchAction = 'none';

    // Controls toolbar with Fullscreen + Zoom + PNG & JPG Download options
    var controls = document.createElement('div');
    controls.className = 'mermaid-controls mermaid-controls-inline';
    controls.innerHTML = [
      '<button type="button" class="m-fullscreen-btn" title="View Full Screen (Esc to exit)" style="display:inline-flex; align-items:center; gap:4px; font-size:11.5px; padding:3px 7px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--line); border-radius:5px; white-space:nowrap; flex-shrink:0;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg><span class="m-btn-label">Full Screen</span></button>',
      '<span style="width:1px; height:12px; background:var(--line); margin:auto 1px; opacity:0.8; flex-shrink:0;"></span>',
      '<div style="display:inline-flex; align-items:center; gap:2px; flex-shrink:0;">',
      '  <button type="button" class="m-zoom-out" title="Zoom Out" style="white-space:nowrap; flex-shrink:0;">−</button>',
      '  <button type="button" class="m-zoom-reset" title="Fit Diagram to View" style="white-space:nowrap; flex-shrink:0;">Fit</button>',
      '  <button type="button" class="m-zoom-in" title="Zoom In" style="white-space:nowrap; flex-shrink:0;">+</button>',
      '</div>',
      '<span style="width:1px; height:12px; background:var(--line); margin:auto 1px; opacity:0.8; flex-shrink:0;"></span>',
      '<div style="display:inline-flex; align-items:center; gap:3px; flex-shrink:0;">',
      '  <button type="button" class="m-download-png" title="Download High-Res PNG" style="display:inline-flex; align-items:center; gap:3px; font-size:11px; padding:3px 6px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--line); border-radius:5px; white-space:nowrap; flex-shrink:0;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span class="m-btn-label">PNG</span></button>',
      '  <button type="button" class="m-download-jpg" title="Download High-Quality JPG" style="display:inline-flex; align-items:center; gap:3px; font-size:11px; padding:3px 6px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--line); border-radius:5px; white-space:nowrap; flex-shrink:0;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span class="m-btn-label">JPG</span></button>',
      '</div>'
    ].join('');
    container.appendChild(controls);

    // Fullscreen Top Header Bar
    var fsHeader = document.createElement('div');
    fsHeader.className = 'mermaid-fullscreen-header';
    fsHeader.style.display = 'none';
    fsHeader.innerHTML = [
      '<div style="display:flex; align-items:center; gap:12px;">',
      '  <button type="button" class="m-exit-fullscreen-btn" title="Exit Fullscreen & Return to Document (Esc)" style="display:inline-flex; align-items:center; gap:6px; background:var(--surface); color:var(--ink); font-weight:600; padding:6px 12px; border-radius:6px; border:1px solid var(--line); cursor:pointer; font-size:12.5px; box-shadow:0 1px 2px rgba(0,0,0,0.04); transition:all 0.15s ease;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="12" x2="20" y2="12"/></svg><span>Back</span><kbd style="font-size:10px; font-family:var(--font-mono); padding:1px 5px; border-radius:4px; background:var(--surface-muted); color:var(--ink-muted); border:1px solid var(--line);">Esc</kbd></button>',
      '  <div style="font-weight:600; font-size:13px; color:var(--ink); display:flex; align-items:center; gap:6px;">',
      '    <span>System Flow & Architecture Diagram</span>',
      '    <span style="font-size:11px; padding:2px 6px; background:var(--surface-muted); color:var(--ink-muted); border:1px solid var(--line); border-radius:4px; font-weight:500;">Fullscreen</span>',
      '  </div>',
      '</div>',
      '<div style="display:flex; align-items:center; gap:8px;">',
      '  <div style="display:flex; align-items:center; gap:4px; background:var(--surface-muted); border:1px solid var(--line); border-radius:6px; padding:2px 6px;">',
      '    <button type="button" class="m-fs-zoom-out btn btn--xs btn--ghost" title="Zoom Out" style="font-weight:600; font-size:13px; padding:2px 8px;">−</button>',
      '    <span class="m-fs-zoom-level" style="font-size:11px; font-family:var(--font-mono); min-width:40px; text-align:center; color:var(--ink-secondary);">100%</span>',
      '    <button type="button" class="m-fs-zoom-in btn btn--xs btn--ghost" title="Zoom In" style="font-weight:600; font-size:13px; padding:2px 8px;">+</button>',
      '    <button type="button" class="m-fs-zoom-reset btn btn--xs btn--outline" title="Reset Fit" style="font-size:11px; padding:2px 8px;">Fit</button>',
      '  </div>',
      '  <button type="button" class="m-fs-download-png btn btn--sm btn--outline" title="Download High-Res PNG" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; color:var(--ink); border:1px solid var(--line);"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>PNG</span></button>',
      '  <button type="button" class="m-fs-download-jpg btn btn--sm btn--outline" title="Download High-Quality JPG" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; color:var(--ink); border:1px solid var(--line);"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>JPG</span></button>',
      '</div>'
    ].join('');
    if (viewport && viewport.parentNode === container) {
      container.insertBefore(fsHeader, viewport);
    } else if (container.firstChild) {
      container.insertBefore(fsHeader, container.firstChild);
    } else {
      container.appendChild(fsHeader);
    }

    var currentZoom = 1;
    var panX = 0;
    var panY = 0;
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var isFullscreen = false;

    function applyTransform() {
      if (svg && svg.style) {
        svg.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + currentZoom + ')';
      }
      var zoomText = Math.round(currentZoom * 100) + '%';
      var zoomLabel = fsHeader ? fsHeader.querySelector('.m-fs-zoom-level') : null;
      if (zoomLabel) zoomLabel.textContent = zoomText;
    }

    function toggleFullscreen() {
      isFullscreen = !isFullscreen;
      if (container) container.classList.toggle('is-fullscreen', isFullscreen);
      if (fsHeader && fsHeader.style) {
        fsHeader.style.display = isFullscreen ? 'flex' : 'none';
      }
      if (isFullscreen) {
        if (document.body && document.body.style) document.body.style.overflow = 'hidden';
        currentZoom = 1.15;
        panX = 0;
        panY = 0;
        applyTransform();
        if (window.Clarity && window.Clarity.toast) {
          window.Clarity.toast.show('Entered diagram full-screen view (Press Esc to exit)', 'info');
        }
      } else {
        if (document.body && document.body.style) document.body.style.overflow = '';
        currentZoom = 1;
        panX = 0;
        panY = 0;
        applyTransform();
      }
    }

    // Esc key handler
    function onKeyDown(e) {
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
    }
    window.addEventListener('keydown', onKeyDown);

    controls.querySelector('.m-fullscreen-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.Clarity && window.Clarity.openDiagramModalViewer) {
        window.Clarity.openDiagramModalViewer({
          svgElement: svg,
          title: 'System Architecture Diagram',
          subtitle: 'Generated system flow and architecture visualizer',
          filename: 'system_architecture_diagram'
        });
      } else {
        toggleFullscreen();
      }
    });

    fsHeader.querySelector('.m-exit-fullscreen-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFullscreen();
    });

    controls.querySelector('.m-zoom-in').addEventListener('click', function (e) {
      e.stopPropagation();
      currentZoom = Math.min(4.0, Number((currentZoom + 0.25).toFixed(2)));
      applyTransform();
    });

    controls.querySelector('.m-zoom-out').addEventListener('click', function (e) {
      e.stopPropagation();
      currentZoom = Math.max(0.4, Number((currentZoom - 0.25).toFixed(2)));
      applyTransform();
    });

    controls.querySelector('.m-zoom-reset').addEventListener('click', function (e) {
      e.stopPropagation();
      currentZoom = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    });

    fsHeader.querySelector('.m-fs-zoom-in').addEventListener('click', function (e) {
      e.stopPropagation();
      currentZoom = Math.min(4.0, Number((currentZoom + 0.25).toFixed(2)));
      applyTransform();
    });

    fsHeader.querySelector('.m-fs-zoom-out').addEventListener('click', function (e) {
      e.stopPropagation();
      currentZoom = Math.max(0.4, Number((currentZoom - 0.25).toFixed(2)));
      applyTransform();
    });

    fsHeader.querySelector('.m-fs-zoom-reset').addEventListener('click', function (e) {
      e.stopPropagation();
      currentZoom = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    });

    controls.querySelector('.m-download-png').addEventListener('click', function (e) {
      e.stopPropagation();
      downloadPngDiagram(svg, 'clarity_diagram_' + Date.now() + '.png');
    });

    controls.querySelector('.m-download-jpg').addEventListener('click', function (e) {
      e.stopPropagation();
      downloadJpgDiagram(svg, 'clarity_diagram_' + Date.now() + '.jpg');
    });

    fsHeader.querySelector('.m-fs-download-png').addEventListener('click', function (e) {
      e.stopPropagation();
      downloadPngDiagram(svg, 'clarity_diagram_' + Date.now() + '.png');
    });

    fsHeader.querySelector('.m-fs-download-jpg').addEventListener('click', function (e) {
      e.stopPropagation();
      downloadJpgDiagram(svg, 'clarity_diagram_' + Date.now() + '.jpg');
    });

    viewport.addEventListener('dblclick', function(e) {
      if (e.target.closest('.mermaid-controls')) return;
      currentZoom = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    });

    viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = e.deltaY < 0 ? 0.15 : -0.15;
      currentZoom = Math.max(0.4, Math.min(4.0, Number((currentZoom + delta).toFixed(2))));
      applyTransform();
    }, { passive: false });

    viewport.addEventListener('mousedown', function (e) {
      if (e.target.closest('.mermaid-controls')) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });

    window.addEventListener('mouseup', function () {
      if (isDragging) {
        isDragging = false;
        if (viewport) viewport.style.cursor = 'grab';
      }
    });

    var initialPinchDist = null;
    var initialPinchZoom = 1;
    var isTouchDragging = false;

    viewport.addEventListener('touchstart', function (e) {
      if (e.target.closest('.mermaid-controls') || e.target.closest('button')) return;
      if (e.touches.length === 1) {
        isTouchDragging = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        isTouchDragging = false;
        initialPinchZoom = currentZoom;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    viewport.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1 && isTouchDragging) {
        e.preventDefault();
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        applyTransform();
      } else if (e.touches.length === 2 && initialPinchDist) {
        e.preventDefault();
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (initialPinchDist > 0) {
          var factor = dist / initialPinchDist;
          currentZoom = Math.max(0.3, Math.min(5.0, Number((initialPinchZoom * factor).toFixed(2))));
          applyTransform();
        }
      }
    }, { passive: false });

    viewport.addEventListener('touchend', function (e) {
      if (e.touches.length === 1) {
        isTouchDragging = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
        initialPinchDist = null;
      } else if (e.touches.length === 0) {
        isTouchDragging = false;
        initialPinchDist = null;
      }
    });

    viewport.addEventListener('touchcancel', function () {
      isTouchDragging = false;
      initialPinchDist = null;
    });
  }

  window.Clarity.renderMermaid = async function (containerEl, retryCount) {
    retryCount = retryCount || 0;
    if (!window.mermaid) {
      if (retryCount < 20) {
        setTimeout(function () {
          window.Clarity.renderMermaid(containerEl, retryCount + 1);
        }, 250);
      }
      return;
    }
    try {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (!window._mermaidInitialized || window._mermaidTheme !== (isDark ? 'dark' : 'default')) {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          suppressErrorRendering: true,
          flowchart: {
            useMaxWidth: false,
            htmlLabels: false,
            curve: 'basis'
          },
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", "Font Awesome 6 Free", "FontAwesome", sans-serif'
        });
        window._mermaidInitialized = true;
        window._mermaidTheme = isDark ? 'dark' : 'default';
      }
      var target = containerEl || document;
      var nodes = target.querySelectorAll('pre.mermaid');
      if (nodes && nodes.length > 0) {
        for (var i = 0; i < nodes.length; i++) {
          var pre = nodes[i];
          if (pre.getAttribute('data-processed')) continue;
          pre.setAttribute('data-processed', 'true');

          var rawCode = pre.textContent || '';
          if (!rawCode.trim()) continue;

          var parentContainer = pre.closest('.mermaid-container');
          var repairedCode = sanitizeAndRepairMermaid(rawCode);
          var diagramId = 'mermaid_svg_' + Math.random().toString(36).substring(2, 9);
          var renderedSvg = null;

          // Attempt 1: Render repaired code
          try {
            if (typeof window.mermaid.render === 'function') {
              var res = await window.mermaid.render(diagramId, repairedCode);
              renderedSvg = typeof res === 'string' ? res : (res && res.svg ? res.svg : null);
            }
          } catch (err1) {
            console.warn('Mermaid initial parse issue, attempting deep repair:', err1);
          }

          // Attempt 2: Aggressive simplification if Attempt 1 failed
          if (!renderedSvg) {
            try {
              var simplifiedCode = aggressiveSimplifyMermaid(rawCode);
              var diagramId2 = 'mermaid_svg_retry_' + Math.random().toString(36).substring(2, 9);
              if (typeof window.mermaid.render === 'function') {
                var res2 = await window.mermaid.render(diagramId2, simplifiedCode);
                renderedSvg = typeof res2 === 'string' ? res2 : (res2 && res2.svg ? res2.svg : null);
              }
            } catch (err2) {
              console.warn('Mermaid secondary repair failed:', err2);
            }
          }

          // Attempt 3: Standard mermaid run fallback
          if (!renderedSvg && typeof window.mermaid.run === 'function') {
            try {
              pre.textContent = repairedCode;
              await window.mermaid.run({ nodes: [pre] });
              if (parentContainer) {
                attachMermaidZoomControls(parentContainer);
              }
              continue;
            } catch (err3) {
              console.warn('Mermaid run fallback failed:', err3);
            }
          }

          if (renderedSvg && parentContainer) {
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderedSvg;
            var svgEl = tempDiv.querySelector('svg');

            if (svgEl) {
              svgEl.removeAttribute('height');
              svgEl.style.width = 'auto';
              svgEl.style.height = 'auto';
              svgEl.style.maxWidth = '100%';
              svgEl.style.display = 'block';

              if (pre && pre.style) {
                pre.style.display = 'none';
              }
              if (pre && pre.parentNode) {
                pre.parentNode.replaceChild(svgEl, pre);
              } else {
                parentContainer.appendChild(svgEl);
              }
              attachMermaidZoomControls(parentContainer);
            }
          } else if (!renderedSvg && parentContainer && !parentContainer.querySelector('svg')) {
            renderDiagramFallbackCard(parentContainer, rawCode);
          }
        }
      }
    } catch (e) {
      console.error('Mermaid render error:', e);
    }
  };

  window.Clarity.markdown = {
    render: renderMarkdown,
    escapeHtml: escapeHtml,
    highlightCode: highlightCode,
    normalizeLang: normalizeLang,
    slugify: slugify,
  };

  window.Clarity.downloadSvgDiagram = downloadSvgDiagram;
  window.Clarity.downloadPngDiagram = downloadPngDiagram;
  window.Clarity.downloadJpgDiagram = downloadJpgDiagram;
  window.Clarity.getStandaloneSvgString = getStandaloneSvgString;
  window.Clarity.sanitizeAndRepairMermaid = sanitizeAndRepairMermaid;
})();

