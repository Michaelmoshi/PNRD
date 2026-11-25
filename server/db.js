const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Pool, types } = require('pg');

// Dates et heures renvoyees telles quelles (texte) : evite tout decalage de fuseau horaire
types.setTypeParser(1082, (v) => v);   // date       -> 'AAAA-MM-JJ'
types.setTypeParser(1114, (v) => v);   // timestamp  -> 'AAAA-MM-JJ HH:MM:SS'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant : copier .env.example en .env');
module.exports = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
