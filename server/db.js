const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant : copier .env.example en .env');
module.exports = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
