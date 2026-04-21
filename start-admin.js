const app = require('./admin-api');
const PORT = process.env.ADMIN_PORT || 3001;

app.listen(PORT, () => {
    console.log('\n=== MEM Gallery Admin Panel ===');
    console.log(`URL:  http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop.\n');
});
