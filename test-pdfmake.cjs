const PdfPrinter = require('pdfmake/js/Printer.js').default;
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};
const printer = new PdfPrinter(fonts);
const docDefinition = {
  defaultStyle: { font: 'Helvetica' },
  content: [ 'Hello world' ]
};
const pdfDoc = printer.createPdfKitDocument(docDefinition);
console.log(Object.keys(pdfDoc));
