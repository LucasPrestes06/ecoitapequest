// Questionário público: uma pergunta por vez, com validação e envio via API.
(async () => {
  const $ = id => document.getElementById(id);
  let perguntas, atual = 0;
  const respostas = {}; // q1: 'texto' | q13: ['a','b']

  try { perguntas = await (await fetch('/api/perguntas')).json(); }
  catch { $('rotulo').textContent = 'Não foi possível carregar a pesquisa. Recarregue a página.'; return; }

  function render() {
    const p = perguntas[atual], n = perguntas.length, multi = p.tipo === 'multi';
    $('rotulo').textContent = `Pergunta ${atual + 1} de ${n}`;
    $('percentual').textContent = `${Math.round((atual / n) * 100)}% concluído`;
    $('preenchimento').style.width = `${((atual + 1) / n) * 100}%`;
    $('erro').textContent = '';
    const area = $('area'); area.replaceChildren();
    const box = document.createElement('fieldset');
    box.className = 'pergunta'; box.style.cssText = 'border:0;padding:0;margin:0';
    const leg = document.createElement('h2'); leg.textContent = p.titulo; box.append(leg);
    p.opcoes.forEach(o => {
      const l = document.createElement('label'); l.className = 'opcao';
      const i = document.createElement('input');
      i.type = multi ? 'checkbox' : 'radio'; i.name = `q${p.id}`; i.value = o;
      i.checked = multi ? (respostas[`q${p.id}`] || []).includes(o) : respostas[`q${p.id}`] === o;
      i.addEventListener('change', () => {
        $('erro').textContent = '';
        respostas[`q${p.id}`] = multi ? [...box.querySelectorAll('input:checked')].map(x => x.value) : o;
      });
      const s = document.createElement('span'); s.textContent = o;
      l.append(i, s); box.append(l);
    });
    area.append(box);
    $('anterior').style.visibility = atual === 0 ? 'hidden' : 'visible';
    $('proxima').textContent = atual === n - 1 ? 'Enviar pesquisa' : 'Próxima';
  }

  function valida() {
    const p = perguntas[atual], v = respostas[`q${p.id}`];
    if (!v || (Array.isArray(v) && !v.length)) {
      $('erro').textContent = p.tipo === 'multi' ? 'Selecione pelo menos uma opção para continuar.' : 'Escolha uma opção para continuar.';
      return false;
    }
    return true;
  }

  $('anterior').onclick = () => { if (atual > 0) { atual--; render(); } };
  $('proxima').onclick = async () => {
    if (!valida()) return;
    if (atual < perguntas.length - 1) { atual++; render(); return; }
    $('proxima').disabled = true; $('proxima').textContent = 'Enviando…';
    try {
      const r = await fetch('/api/respostas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respostas }) });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro ao enviar.');
      $('formulario').classList.add('oculto'); $('intro').classList.add('oculto');
      $('sucesso').classList.remove('oculto'); window.scrollTo(0, 0);
    } catch (e) {
      $('erro').textContent = e.message + ' Tente novamente.';
      $('proxima').disabled = false; $('proxima').textContent = 'Enviar pesquisa';
    }
  };
  render();
})();
