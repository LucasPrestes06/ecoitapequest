// Dashboard: busca /api/resultados (protegida) e desenha cards, destaques e gráficos.
const $ = id => document.getElementById(id);
const CORES = ['#1d4a38', '#3d9a5f', '#e2a72e', '#7cc29a', '#c9702c', '#5b8fa8', '#a3b86c', '#8a6f9e'];
const fmt = n => String(n).replace('.', ',') + '%';
let dados = null, graficos = [], pagina = 1;

function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
async function api(url) {
  const r = await fetch(url);
  if (r.status === 401) { location.href = '/admin-login'; throw new Error('401'); }
  return r.json();
}

function desenha(p) {
  const card = el('div', 'cartao grafico' + (p.grafico === 'barH' ? ' alto' : ''));
  card.append(el('h3', '', `${p.id}. ${p.titulo}`));
  const caixa = el('div', 'caixa'), cv = el('canvas'); caixa.append(cv); card.append(caixa);
  const horiz = p.grafico === 'barH', rosca = p.grafico === 'doughnut' || p.grafico === 'pie';
  graficos.push(new Chart(cv, {
    type: rosca ? p.grafico : 'bar',
    data: { labels: p.opcoes.map(o => o.opcao), datasets: [{ data: p.opcoes.map(o => o.quantidade),
      backgroundColor: rosca ? CORES : CORES[1], borderRadius: rosca ? 0 : 6 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: horiz ? 'y' : 'x',
      plugins: { legend: { display: rosca, position: 'bottom' },
        tooltip: { callbacks: { label: c => { const o = p.opcoes[c.dataIndex]; return ` ${o.quantidade} respostas (${fmt(o.percentual)})`; } } } },
      scales: rosca ? {} : { [horiz ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0 } },
        [horiz ? 'y' : 'x']: { ticks: { callback(v) { const t = this.getLabelForValue(v); return t.length > 22 ? t.slice(0, 21) + '…' : t; } } } } }
  }));
  const ul = el('ul', 'nums');
  p.opcoes.forEach(o => { const li = el('li'); li.append(el('span', '', o.opcao), el('span', '', `${o.quantidade} respostas — ${fmt(o.percentual)}`)); ul.append(li); });
  const fim = el('li', 'fim'); fim.append(el('span', '', 'Total'), el('span', '', `${p.total} respostas`)); ul.append(fim);
  card.append(ul);
  if (p.tipo === 'multi') card.append(el('small', '', 'Múltipla escolha: percentuais sobre o total de participantes; podem somar mais de 100%.'));
  return card;
}

function renderGraficos() {
  graficos.forEach(g => g.destroy()); graficos = [];
  const f = $('filtro').value, area = $('graficos'); area.replaceChildren();
  dados.perguntas.filter(p => f === 'todas' || String(p.id) === f).forEach(p => area.append(desenha(p)));
}

async function carregar() {
  dados = await api('/api/resultados');
  $('total').textContent = `${dados.total} ${dados.total === 1 ? 'resposta' : 'respostas'}`;
  const cards = $('cards'); cards.replaceChildren();
  dados.cards.forEach(c => { const m = el('div', 'mini'); m.append(el('b', '', fmt(c.percentual)), el('small', '', `${c.rotulo} (${c.quantidade})`)); cards.append(m); });
  const ul = $('destaques'); ul.replaceChildren();
  if (!dados.total) ul.append(el('li', '', 'Ainda não há respostas. Compartilhe o link da pesquisa para começar.'));
  else dados.destaques.forEach(d => ul.append(el('li', '', d.texto)));
  const sel = $('filtro'), atual = sel.value || 'todas'; sel.replaceChildren();
  sel.append(new Option('Todas as perguntas', 'todas'));
  dados.perguntas.forEach(p => sel.append(new Option(`${p.id}. ${p.titulo}`, p.id)));
  sel.value = atual;
  renderGraficos();
  carregarTabela();
}

async function carregarTabela() {
  const r = await api(`/api/respostas?pagina=${pagina}`);
  const t = el('table'), h = el('tr');
  ['ID', 'Data', ...dados.perguntas.map(p => `P${p.id}`)].forEach(x => h.append(el('th', '', x)));
  t.append(h);
  r.respostas.forEach(row => {
    const tr = el('tr');
    tr.append(el('td', '', row.id), el('td', '', new Date(row.criado_em).toLocaleString('pt-BR')));
    dados.perguntas.forEach(p => tr.append(el('td', '', [].concat(row[`q${p.id}`]).join('; '))));
    t.append(tr);
  });
  $('tabela').replaceChildren(r.respostas.length ? t : el('p', '', 'Nenhuma resposta ainda.'));
  const ultima = Math.max(Math.ceil(r.total / r.porPagina), 1);
  $('pag').textContent = `Página ${r.pagina} de ${ultima}`;
  $('ant').disabled = pagina <= 1; $('prox').disabled = pagina >= ultima;
}

$('atualizar').onclick = carregar;
$('filtro').onchange = renderGraficos;
$('ant').onclick = () => { pagina--; carregarTabela(); };
$('prox').onclick = () => { pagina++; carregarTabela(); };
$('sair').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); location.href = '/admin-login'; };
carregar();
