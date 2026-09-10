const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('clarity.sqlite');
db.all("SELECT * FROM models", (err, rows) => {
  console.log(rows);
});
