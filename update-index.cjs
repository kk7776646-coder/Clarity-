const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>', '');
html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>', '');
html = html.replace('<script src="https://cdn.jsdelivr.net/npm/html-to-pdfmake/browser.js"></script>', '');

if (!html.includes('html2pdf.bundle.min.js')) {
    html = html.replace('</head>', '  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>\n</head>');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log("Updated index.html to use html2pdf.js");
