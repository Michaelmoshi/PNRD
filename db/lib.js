// Connexion partagee par les scripts db/*.js : lit DATABASE_URL dans .env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Client } = require('pg');

async function connect() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant : copier .env.example en .env');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

module.exports = { connect };
