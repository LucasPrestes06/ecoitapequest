# EcoItape — Pesquisa sobre Reciclagem

Aplicação web (Node.js + Express + PostgreSQL) com questionário público anônimo de 14 perguntas e dashboard administrativo com gráficos (Chart.js).

## Estrutura
```
server.js        API, autenticação (JWT em cookie httpOnly) e rotas de página
db.js            PostgreSQL (cria a tabela automaticamente)
questions.js     Perguntas/opções (fonte única: validação, formulário e gráficos)
public/          index.html, css/style.css, js/pesquisa.js, js/admin.js, js/dashboard.js
views/           admin-login.html e dashboard.html (dashboard só é servido com login)
```

## Rodar localmente
```bash
npm install
cp .env.example .env   # ajuste DATABASE_URL
npm start              # http://localhost:3000
```
Sem `DATABASE_URL` o app usa memória (só para testes; os dados somem ao reiniciar).

## Variáveis de ambiente
| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL |
| `JWT_SECRET` | Segredo longo e aleatório para as sessões |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | |
| `PORT` | Definida pelo Render automaticamente |

## Deploy no Render
1. Envie o projeto para um repositório no GitHub.
2. No Render: **New → PostgreSQL** (plano free serve para testes). Copie a *Internal Database URL*.
3. **New → Web Service**, conecte o repositório:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD` (e `ADMIN_LOGIN`).
4. Acesse a URL pública. A tabela `respostas` é criada no primeiro início.

## Segurança
Senha comparada com bcrypt no servidor; rotas `/api/resultados`, `/api/respostas` (GET) e `/dashboard` exigem sessão; limite de tentativas de login e de envios; Helmet (CSP); validação estrita das opções; nenhum dado pessoal é armazenado.

## LINK QUESTIONÁRIO
https://ecoitape.onrender.com/

## QR CODE
<img width="3000" height="4315" alt="https_ecoitape_onrender_com" src="https://github.com/user-attachments/assets/ed225431-e12d-44f6-a7b6-d84c3ccf40ee" />
