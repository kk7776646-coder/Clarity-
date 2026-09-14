const fs = require('fs');

// The original UI used some custom CSS variables (--danger, etc).
// We'll just define them inline if they don't exist in the host CSS, but they should.
console.log("Checking UI colors...");
