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
          
          try {
             pdf.download('test.pdf', () => {
                 resolve("callback fired");
             });
             setTimeout(() => resolve("timeout"), 2000);
          } catch (err) {
             resolve("Error: " + err.message);
          }
        });
      }
    </script>
    </body>
    </html>
  `);
  const result = await page.evaluate(() => window.pdfTest());
  console.log("Result:", result);
  await browser.close();
})();
