require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { PERGUNTAS } = require('./questions');

const app = express();
const PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Credenciais vêm do ambiente (padrão inicial pedido: ecoItape / eco123). Apenas o hash fica em memória.
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'ecoItape';
const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'eco123', 10);
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('⚠ JWT_SECRET não definido: sessões serão invalidadas a cada reinício.');

app.set('trust proxy', 1); // Render fica atrás de proxy
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", 'https://fonts.googleapis.com'],
    fontSrc: ['https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"]
  } }
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ---------- autenticação ----------
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 2 * 60 * 60 * 1000 };
function logado(req) {
  try { return jwt.verify(req.cookies.admin_token, JWT_SECRET).admin === true; } catch { return false; }
}
function exigeAdmin(req, res, next) {
  if (logado(req)) return next();
  res.status(401).json({ erro: 'Não autenticado.' });
}
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos.' } });
const limiteEnvio = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em instantes.' } });

app.post('/api/admin/login', limiteLogin, (req, res) => {
  const { login, senha } = req.body || {};
  const okLogin = typeof login === 'string' && login === ADMIN_LOGIN;
  const okSenha = typeof senha === 'string' && bcrypt.compareSync(senha, ADMIN_HASH);
  if (!okLogin || !okSenha) return res.status(401).json({ erro: 'Login ou senha incorretos.' });
  res.cookie('admin_token', jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '2h' }), cookieOpts);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('admin_token', cookieOpts); res.json({ ok: true }); });

// ---------- API pública ----------
app.get('/api/perguntas', (req, res) => res.json(PERGUNTAS));

app.post('/api/respostas', limiteEnvio, async (req, res) => {
  const r = req.body && req.body.respostas;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return res.status(400).json({ erro: 'Formato inválido.' });
  const limpo = {};
  for (const p of PERGUNTAS) {
    const v = r[`q${p.id}`];
    if (p.tipo === 'single') {
      if (typeof v !== 'string' || !p.opcoes.includes(v)) return res.status(400).json({ erro: `Resposta inválida na pergunta ${p.id}.` });
      limpo[`q${p.id}`] = v;
    } else {
      if (!Array.isArray(v) || v.length === 0 || v.length > p.opcoes.length || new Set(v).size !== v.length ||
          !v.every(o => typeof o === 'string' && p.opcoes.includes(o)))
        return res.status(400).json({ erro: `Resposta inválida na pergunta ${p.id}.` });
      limpo[`q${p.id}`] = v;
    }
  }
  try { await db.inserir(limpo); res.status(201).json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar a resposta.' }); }
});

// ---------- API administrativa ----------
const pct = (q, total) => total ? Math.round((q / total) * 1000) / 10 : 0; // percentual = q / total × 100, 1 casa

app.get('/api/resultados', exigeAdmin, async (req, res) => {
  try {
    const rows = await db.listar();
    const total = rows.length;
    const perguntas = PERGUNTAS.map(p => {
      const cont = Object.fromEntries(p.opcoes.map(o => [o, 0]));
      for (const row of rows) [].concat(row[`q${p.id}`]).forEach(o => { if (o in cont) cont[o]++; });
      return { id: p.id, titulo: p.titulo, tipo: p.tipo, grafico: p.grafico, total,
        opcoes: p.opcoes.map(o => ({ opcao: o, quantidade: cont[o], percentual: pct(cont[o], total) })) };
    });
    // soma das quantidades de várias opções de uma pergunta
    const soma = (id, lista) => perguntas[id - 1].opcoes.filter(o => lista.includes(o.opcao)).reduce((s, o) => s + o.quantidade, 0);
    const item = (rotulo, id, lista) => { const q = soma(id, lista); return { rotulo, quantidade: q, percentual: pct(q, total) }; };

    const cards = [
      item('Pratica a separação de recicláveis', 1, ['Sempre', 'Frequentemente', 'Às vezes']),
      item('Conhece pontos de reciclagem', 3, ['Sim']),
      item('Não conhece nenhum ponto', 4, ['Nenhum']),
      item('Já utilizou um ponto de reciclagem', 6, ['Sim, várias vezes', 'Sim, uma ou duas vezes']),
      item('Utilizaria um aplicativo/site', 12, ['Com certeza', 'Provavelmente sim'])
    ];
    const destaques = [
      [item('', 4, ['Nenhum']), 'dos participantes não conhecem nenhum ponto de reciclagem.'],
      [item('', 3, ['Não']), 'dos participantes não conhecem nenhum ponto de reciclagem ou coleta (pergunta 3).'],
      [item('', 12, ['Com certeza', 'Provavelmente sim']), 'dos participantes utilizariam um aplicativo para encontrar pontos de reciclagem.'],
      [item('', 11, ['Não']), 'consideram difícil encontrar informações sobre os pontos de reciclagem.'],
      [item('', 10, ['Não']), 'consideram que não há pontos de reciclagem suficientes na cidade.'],
      [item('', 14, ['Sim']), 'reciclariam mais com informações mais acessíveis.']
    ].map(([i, t]) => ({ percentual: i.percentual, quantidade: i.quantidade, texto: `${String(i.percentual).replace('.', ',')}% ${t}` }));

    res.json({ total, cards, destaques, perguntas });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao calcular resultados.' }); }
});

// Respostas individuais, paginadas
app.get('/api/respostas', exigeAdmin, async (req, res) => {
  const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
  const porPagina = 20;
  const rows = await db.listar();
  res.json({ total: rows.length, pagina, porPagina, respostas: rows.slice((pagina - 1) * porPagina, pagina * porPagina) });
});

// ---------- páginas ----------
app.get('/admin-login', (req, res) => logado(req) ? res.redirect('/dashboard') : res.sendFile(path.join(__dirname, 'views/admin-login.html')));
app.get('/dashboard', (req, res) => logado(req) ? res.sendFile(path.join(__dirname, 'views/dashboard.html')) : res.redirect('/admin-login'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use((req, res) => res.status(404).redirect('/'));

db.iniciar().then(() => app.listen(PORT, () => console.log(`EcoItape rodando na porta ${PORT}`)))
  .catch(e => { console.error('Falha ao iniciar o banco:', e); process.exit(1); });
