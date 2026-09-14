const { spawn } = require('child_process');

console.log("Checking that we can spawn node processes cleanly");
const child = spawn('node', ['-v'], { shell: true });
child.stdout.on('data', (d) => console.log('Child:', d.toString().trim()));
child.on('close', (code) => console.log('Child exited with', code));
