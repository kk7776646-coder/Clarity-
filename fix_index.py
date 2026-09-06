with open("index.html", "r", encoding="utf-8") as f:
    lines = f.read().split("\n")
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if "<!-- ================= SCRIPTS ================= -->" in line:
        start_idx = i
    if start_idx is not None and '<script src="js/app.js"></script>' in line:
        end_idx = i + 1
        break
if start_idx is not None and end_idx is not None:
    new_lines = lines[:start_idx] + [
        "    <!-- Vite bundled entry -->",
        "    <script type=\"module\" src=\"/src/main.jsx\"></script>",
        "  </body>",
        "</html>",
        ""
    ] + lines[end_idx:]
    with open("index.html", "w", encoding="utf-8", newline="") as out:
        out.write("\n".join(new_lines))
    print("Fixed root index.html")
else:
    print("Script block not found")

with open("public/index.html", "r", encoding="utf-8") as f:
    lines = f.read().split("\n")
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if "<!-- ================= SCRIPTS ================= -->" in line:
        start_idx = i
    if start_idx is not None and '<script src="js/app.js"></script>' in line:
        end_idx = i + 1
        break
if start_idx is not None and end_idx is not None:
    new_lines = lines[:start_idx] + [
        "    <!-- Vite bundled entry -->",
        "    <script type=\"module\" src=\"/src/main.jsx\"></script>",
        "  </body>",
        "</html>",
        ""
    ] + lines[end_idx:]
    with open("public/index.html", "w", encoding="utf-8", newline="") as out:
        out.write("\n".join(new_lines))
    print("Fixed public index.html")
else:
    print("Public script block not found")
