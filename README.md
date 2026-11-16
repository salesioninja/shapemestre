# 🏋️‍♂️ SHAPE MESTRE - Plataforma Unificada de Treinos, Nutrição e Agentes IA

> **Domínio Oficial de Produção:** `shapemestre.acessaronline.com.br`

---

## 🚀 1. Visão Geral do Sistema

O **Shape Mestre** é um aplicativo PWA moderno e ultrarrápido que unificou todo o seu ecossistema fitness em uma única plataforma sem redirecionamentos externos:

1. **Dashboard Vitals:** Metas calóricas, tempo de treino, passos e hidratação.
2. **38 Fichas de Treino Oficiais:** Divididas por gênero (Feminino e Masculino) e objetivo (Hipertrofia, Definição, Emagrecimento, Força), com modal detalhado de Séries, Repetições e botão para enviar o treino direto para o WhatsApp do aluno.
3. **Catálogo de 289 Exercícios:** Com guia biomecânico (Por que fazer, Como executar, Quando encaixar), músculos trabalhados e animações em GIF.
4. **Portal de Receitas Fitness:** Pratos anabólicos e sobremesas saudáveis com tabela detalhada de calorias, proteínas, carboidratos e gorduras.
5. **Agentes de Inteligência Artificial Integrados:**
   - **MIA (Nutricionista IA):** Tira dúvidas, analisa fotos de pratos/refeições, calcula macros e sugere substituições de alimentos.
   - **Personal Trainer IA:** Periodização de treinos, biomecânica, tempo de descanso e divisão muscular.
   - **Suporte Multimodal:** Aceita digitação, gravação de mensagens de voz pelo microfone (transcrito via **OpenAI Whisper**) e envio de fotos.
6. **Integração Omnichannel com WhatsApp (Evolution API):**
   - O aluno pode pedir para enviar a ficha ou dieta direto para o WhatsApp dele.
   - O aluno pode mandar mensagens, áudios ou fotos no WhatsApp da sua empresa e o backend responde automaticamente usando a mesma IA!
7. **Perfil & Diário Alimentar:** Calculadora de IMC interativa e registro diário com persistência automática.

---

## 🛠️ 2. Como Rodar Localmente no seu Computador

```bash
cd SHAPE_MESTRE_APP
npm install
npm start
```
Acesse no seu navegador: **`http://localhost:3000`**

---

## 🌐 3. Como Subir para a sua VPS (shapemestre.acessaronline.com.br)

### Opção A: Via Docker Compose (Mais Fácil e Rápido)
1. Copie a pasta `SHAPE_MESTRE_APP` para sua VPS (ex: `/var/www/shapemestre`).
2. Preencha o arquivo `.env` com suas chaves de API:
   - `GEMINI_API_KEY` (obtenha em [Google AI Studio](https://aistudio.google.com/app/apikey))
   - `OPENAI_API_KEY` (para transcrição Whisper de áudio)
   - `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` (da sua instância já instalada na VPS)
3. No terminal da VPS, execute:
   ```bash
   docker-compose up -d --build
   ```

### Opção B: Via PM2 (Node.js Direto)
```bash
npm install -g pm2
pm2 start server.js --name "shape-mestre"
pm2 save
pm2 startup
```

### Opção C: Via Docker Swarm & Traefik (docker-stack.yml)
Se sua VPS utiliza Docker Swarm com Traefik (rede `ninja_net`):
1. Construa a imagem localmente ou na VPS:
   ```bash
   docker build -t shapemestre:latest .
   ```
2. Carregue as variáveis de ambiente do `.env` e faça o deploy da stack:
   ```bash
   export $(grep -v '^#' .env | xargs) && docker stack deploy -c docker-stack.yml shapemestre
   ```
   *(Ou passe as variáveis de ambiente diretamente pelo ambiente do Swarm / Portainer).*

---

## 🔒 4. Configuração do Nginx & SSL na VPS

1. Copie o arquivo `nginx.conf` para `/etc/nginx/sites-available/shapemestre.acessaronline.com.br`:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/shapemestre.acessaronline.com.br
   sudo ln -s /etc/nginx/sites-available/shapemestre.acessaronline.com.br /etc/nginx/sites-enabled/
   ```
2. Gere o certificado SSL gratuito via Certbot:
   ```bash
   sudo certbot --nginx -d shapemestre.acessaronline.com.br
   ```
3. Reinicie o Nginx:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

---

## 📲 5. Conectando a Evolution API (WhatsApp)

1. No painel da sua **Evolution API**, acesse a sua instância (ex: `ShapeMestre`).
2. Em **Webhooks**, aponte a URL para:
   ```
   https://shapemestre.acessaronline.com.br/api/webhook/evolution
   ```
3. Ative os eventos: `MESSAGES_UPSERT`.
4. Pronto! Quando qualquer aluno mandar mensagem no WhatsApp, o backend do Shape Mestre responderá automaticamente com a inteligência da MIA ou do Personal!
