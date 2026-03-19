const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '..', '.env');
try {
	fs.accessSync(envPath);
	dotenv.config({ path: envPath });
} catch (err) {
	// No .env file — rely on environment variables (production)
}

const config = {};

// Supabase (replaces pg-promise + custom JWT)
config.supabaseUrl = process.env.SUPABASE_URL;
config.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server
config.serverPort = process.env.PORT || process.env.BUGHOUSE_SERVER_PORT || 3000;
config.logFile = process.env.BUGHOUSE_LOG_FILE || 'log.txt';

// CORS — frontend origin (Vercel URL in prod, localhost in dev)
config.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

module.exports = config;
