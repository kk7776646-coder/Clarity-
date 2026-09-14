const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/conversations',
  method: 'GET'
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
