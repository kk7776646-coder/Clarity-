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

  function parseInline(text) {
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
        result += parseEmphasis(text, pos, ch);
        pos = parseEmphasis.endPos || pos + 1;
      } else if (ch === "[" || ch === "!" && text[pos + 1] === "[") {
        result += parseLink(text, pos, ch);
        pos = parseLink.endPos || pos + 1;
      } else {
        var nextSpecial = text.length;
        for (var idx = pos + 1; idx < text.length; idx++) {
          if (text[idx] === "`" || text[idx] === "*" || text[idx] === "_" || text[idx] === "[" || (text[idx] === "!" && text[idx + 1] === "[")) {
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

  function parseEmphasis(text, pos, marker) {
    var rest = text.slice(pos);
    var strong = rest.match(/^(\*{3}|\*{2}|_{2}|_{3})(.+?)\1/);
    if (strong) {
      var content = strong[2];
      parseEmphasis.endPos = pos + strong[0].length;
      return "<strong>" + parseInline(content) + "</strong>";
    }
    var em = rest.match(/^(\*|_)(.+?)\1/);
    if (em) {
      var content2 = em[2];
      parseEmphasis.endPos = pos + em[0].length;
      return "<em>" + parseInline(content2) + "</em>";
    }
    parseEmphasis.endPos = pos + 1;
    return escapeHtml(marker);
  }

  function parseLink(text, pos, ch) {
    var isImage = ch === "!";
    var startBracket = pos + (isImage ? 2 : 1);
    var closeBracket = text.indexOf("]", startBracket);
    if (closeBracket === -1) {
      parseLink.endPos = pos + 1;
      return escapeHtml(ch);
    }
    var linkText = text.slice(startBracket, closeBracket);
    if (text[closeBracket + 1] !== "(") {
      parseLink.endPos = pos + 1;
      return escapeHtml(ch);
    }
    var closeParen = text.indexOf(")", closeBracket + 2);
    if (closeParen === -1) {
      parseLink.endPos = pos + 1;
      return escapeHtml(ch);
    }
    var linkUrl = text.slice(closeBracket + 2, closeParen).trim();
    parseLink.endPos = closeParen + 1;
    if (isImage) {
      return '<img src="' + escapeHtml(linkUrl) + '" alt="' + escapeHtml(linkText) + '" loading="lazy" />';
    }
    return '<a href="' + escapeHtml(linkUrl) + '" target="_blank" rel="noopener noreferrer">' + parseInline(linkText) + "</a>";
  }

  function parseBlocks(text) {
    var lines = text.split("\n");
    var blocks = [];
    var current = [];
    var inCodeFence = false;
    var codeLang = "";
    var codeLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fenceMatch = line.match(/^(```+|~~~+)\s*(\S*)/);
      if (inCodeFence) {
        if (fenceMatch) {
          blocks.push({
            type: "code",
            lang: codeLang || "",
            code: codeLines.join("\n"),
          });
          inCodeFence = false;
          codeLines = [];
          codeLang = "";
        } else {
          codeLines.push(line);
        }
        continue;
      }
      if (fenceMatch) {
        inCodeFence = true;
        codeLang = fenceMatch[2] || "";
        codeLines = [];
        continue;
      }
      if (line.trim() === "") {
        if (current.length > 0) {
          blocks.push({ type: "text", lines: current });
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      blocks.push({ type: "text", lines: current });
    }
    if (inCodeFence) {
      blocks.push({ type: "code", lang: codeLang, code: codeLines.join("\n") });
    }
    return blocks;
  }

  function renderHeading(line, level) {
    var content = line.slice(level + 1).trim();
    if (content.endsWith("#".repeat(level))) {
      content = content.slice(0, -(level + 1)).trim();
    }
    return '<h' + level + ' id="' + slugify(content) + '">' + parseInline(content) + "</h" + level + ">";
  }

  function slugify(text) {
    return String(text || "").toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function isTableLine(line) {
    return line.includes("|") && line.split("|").length >= 3;
  }

  function isTableSeparator(line) {
    var stripped = line.replace(/\s/g, "");
    return stripped.replace(/\|/g, "").match(/^(-+:?|:-+:?)+$/) !== null && stripped.includes("|");
  }

  function isListStart(line) {
    return /^(\s*)([-*+]|\d+\.)\s+/.test(line);
  }

  function renderTable(rows) {
    if (!rows || rows.length < 2) return "";
    var headerCells = rows[0].split("|").map(function (c) { return c.trim(); }).filter(function (_, i) { return i > 0; });
    var html = '<table><thead><tr>';
    for (var i = 0; i < headerCells.length; i++) {
      html += "<th>" + parseInline(headerCells[i]) + "</th>";
    }
    html += "</tr></thead><tbody>";
    for (var r = 2; r < rows.length; r++) {
      var cells = rows[r].split("|").map(function (c) { return c.trim(); }).filter(function (_, i) { return i > 0; });
      if (cells.length === 0) continue;
      html += "<tr>";
      for (var c = 0; c < cells.length; c++) {
        html += "<td>" + parseInline(cells[c]) + "</td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    return html;
  }

  function renderBlock(block) {
    var lines = block.lines || [];
    var first = lines[0] || "";

    if (first.match(/^#{1,6}\s/)) {
      return renderHeading(first, first.match(/^#+/)[0].length);
    }

    if (isTableLine(first) && lines.length > 1 && isTableSeparator(lines[1])) {
      return renderTable(lines);
    }

    if (isListStart(first)) {
      var isOrdered = /^\s*\d+\.\s+/.test(first);
      var tag = isOrdered ? "ol" : "ul";
      var items = [];
      var currentItem = [];
      var lastIndent = 0;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var indent = line.match(/^(\s*)/)[1].length;
        if (isListStart(line)) {
          if (currentItem.length > 0) {
            items.push(currentItem.join("\n"));
            currentItem = [];
          }
          var itemContent = line.replace(/^\s*([-*+]|\d+\.)\s+/, "");
          currentItem.push(itemContent);
        } else if (line.trim() === "") {
          if (currentItem.length > 0) {
            items.push(currentItem.join("\n"));
            currentItem = [];
          }
        } else {
          if (currentItem.length > 0) {
            currentItem.push(line);
          } else {
            currentItem.push(line);
          }
        }
      }
      if (currentItem.length > 0) {
        items.push(currentItem.join("\n"));
      }
      var html = "<" + tag + ">";
      for (var j = 0; j < items.length; j++) {
        html += "<li>" + parseInline(items[j]) + "</li>";
      }
      html += "</" + tag + ">";
      return html;
    }

    if (first.trim().startsWith("> ")) {
      var content = lines.map(function (l) {
        if (l.trim().startsWith("> ")) return l.replace(/^> /, "");
        if (l.trim() === ">") return "";
        return l;
      }).join("\n").trim();
      return '<blockquote>' + parseInline(content) + "</blockquote>";
    }

    var para = '<p>' + parseInline(lines.join("\n").trim()) + "</p>";
    return para;
  }

  function renderCode(block) {
    var lang = normalizeLang(block.lang || "");
    var code = block.code || "";
    var highlighted = "";
    if (lang && LANG_KEYWORDS[lang]) {
      highlighted = highlightCode(code, lang);
    } else {
      highlighted = escapeHtml(code);
    }
    var langClass = lang ? ' class="language-' + escapeHtml(lang) + '"' : "";
    var copyBtn = '<button class="code-copy btn btn--ghost btn--icon-sm" type="button" title="Copy code" aria-label="Copy code"><svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></button>';
    var header = '<div class="code-block__header"><span class="code-lang">' + escapeHtml(lang || "text") + '</span><div style="display:flex;gap:4px;">' + copyBtn + '</div></div>';
    var body = '<div class="code-block__body" style="max-height: 50vh; overflow-y: auto; overflow-x: auto;"><code' + langClass + '>' + highlighted + "</code></div>";
    return '<div class="code-block">' + header + body + "</div>";
  }

  function renderMarkdown(text) {
    text = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!text.trim()) return '<p class="empty">No content.</p>';

    var blocks = parseBlocks(text);
    var html = "";
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.type === "code") {
        html += renderCode(block);
      } else {
        var rendered = renderBlock(block);
        if (rendered) html += rendered;
      }
    }
    return html;
  }

  window.Clarity.markdown = {
    render: renderMarkdown,
    escapeHtml: escapeHtml,
    highlightCode: highlightCode,
    normalizeLang: normalizeLang,
    slugify: slugify,
  };
})();

