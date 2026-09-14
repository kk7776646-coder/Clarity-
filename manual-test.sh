echo "Testing apply changes API logic:"
node -e "
const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
if (content.includes('projectAnalyses.delete(pid)')) {
  console.log('✅ projectAnalyses cache clear is present.');
} else {
  console.log('❌ projectAnalyses cache clear missing!');
}
if (content.includes('/api/projects/:pid/apply-changes')) {
  console.log('✅ apply-changes API is present.');
} else {
  console.log('❌ apply-changes API missing!');
}
"
