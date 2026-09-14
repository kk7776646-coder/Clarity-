const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <body>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
    <script>
      window.pdfTest = function() {
        return new Promise((resolve) => {
          const doc = { content: 'hello' };
          const pdf = pdfMake.createPdf(doc);
          let called = false;
          pdf.download('test.pdf', () => {
            called = true;
          });
          setTimeout(() => { resolve(called); }, 1000);
        });
      }
    </script>
    </body>
    </html>
  `);
  const result = await page.evaluate(() => window.pdfTest());
  console.log("Callback supported:", result);
  await browser.close();
})();
