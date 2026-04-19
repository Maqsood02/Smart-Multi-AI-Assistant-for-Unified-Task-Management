require('dotenv').config();
const app  = require('./app');
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🤖 Smart Multi-AI Assistant Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Health:     http://localhost:${PORT}/api/health\n`);
});
