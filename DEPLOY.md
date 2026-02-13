# 🚀 Guia de Hospedagem Unificada (Backend + Frontend)

Este guia ensina como deixar seu sistema (Backend + Scanner + Dashboard) rodando 24 horas por dia em um único lugar.

## 📋 Como funciona?
Diferente do método antigo, agora você hospeda tudo em um único serviço. O servidor Express do backend agora também entrega as páginas do frontend (Dashboard).

---

## 🔧 Passo Único: Hospedar no Render ou Railway

### 1. Subir para o GitHub
- Crie um repositório privado no GitHub.
- Suba todos os arquivos do seu projeto.
- **IMPORTANTE**: Não inclua o arquivo `.env`.

### 2. Escolha sua Plataforma

#### Opção A: Render.com (Grátis/Fácil)
1. Crie uma conta no [Render.com](https://render.com).
2. Clique em **"New +"** -> **"Web Service"**.
3. Conecte seu repositório do GitHub.
4. Configurações:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node start.js`
5. Vá em **"Environment"** e clique em **"Add Environment Variable"**:
   - `DISCORD_TOKEN`: Seu token do Discord.
   - `WEBHOOK_URL`: Seu link de webhook.
   - `PORT`: `3000`
6. Clique em **"Create Web Service"**.

#### Opção B: Railway.app (Recomendado)
1. Crie uma conta no [Railway.app](https://railway.app).
2. Clique em **"New Project"** -> **"Deploy from GitHub repo"**.
3. Escolha seu repositório.
4. Vá em **"Variables"** e adicione:
   - `DISCORD_TOKEN`: Seu token do Discord.
   - `WEBHOOK_URL`: Seu link de webhook.
   - `PORT`: `3000`
5. O Railway vai detectar o `package.json` e iniciar automaticamente.

---

## 🌐 Acessando o Dashboard
Assim que o deploy terminar, a plataforma te dará um link (ex: `https://meu-bot.onrender.com`).
- Basta abrir esse link no navegador.
- O Dashboard se conectará **automaticamente** ao scanner.
- O status deve aparecer como **"🟢 Conectado (Servidor)"**.

---

## 📝 Notas
- ✅ **Sem Configuração Extra**: Você não precisa mais mudar o `config.js` toda vez que a URL mudar. Ele detecta sozinho!
- ⚡ **Tudo em Um**: Ao desligar ou ligar o serviço na nuvem, o scanner e o dashboard param/voltam juntos.


