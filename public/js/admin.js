// Login administrativo: a validação é feita no servidor.
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const erro = document.getElementById('erro'); erro.textContent = '';
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: document.getElementById('login').value, senha: document.getElementById('senha').value }) });
    if (r.ok) return (location.href = '/dashboard');
    erro.textContent = r.status === 429 ? (await r.json()).erro : 'Login ou senha incorretos.';
  } catch { erro.textContent = 'Falha de conexão. Tente novamente.'; }
});
