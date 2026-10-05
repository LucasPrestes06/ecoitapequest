// Persistência: PostgreSQL (DATABASE_URL). Sem DATABASE_URL usa memória (apenas para testes locais).
const { PERGUNTAS } = require('./questions');
const cols = PERGUNTAS.map(p => `q${p.id}`);
let pool = null;
const memoria = [];

async function iniciar() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠ DATABASE_URL não definida: usando memória. As respostas serão perdidas ao reiniciar!');
    return;
  }
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' || !/render\.com|neon|supabase|amazonaws/.test(process.env.DATABASE_URL)
      ? false : { rejectUnauthorized: false }
  });
  const defs = PERGUNTAS.map(p => `q${p.id} ${p.tipo === 'multi' ? 'TEXT[]' : 'TEXT'} NOT NULL`).join(', ');
  await pool.query(`CREATE TABLE IF NOT EXISTS respostas (id SERIAL PRIMARY KEY, ${defs}, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

async function inserir(r) {
  if (!pool) { memoria.push({ id: memoria.length + 1, ...r, criado_em: new Date().toISOString() }); return; }
  const marcadores = cols.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(`INSERT INTO respostas (${cols.join(', ')}) VALUES (${marcadores})`, cols.map(c => r[c]));
}

async function listar() {
  if (!pool) return [...memoria].reverse();
  return (await pool.query('SELECT * FROM respostas ORDER BY id DESC')).rows;
}

module.exports = { iniciar, inserir, listar };
