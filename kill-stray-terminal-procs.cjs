const { activeSessions, stopTerminalSession } = require('./dist/server.js');
// Since activeSessions might not be exported from server, just rely on standard cleanup
