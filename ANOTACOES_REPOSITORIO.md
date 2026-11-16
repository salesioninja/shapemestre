# 📝 Anotações do Repositório — Shape Mestre

Repositório Oficial: [`https://github.com/salesioninja/shapemestre.git`](https://github.com/salesioninja/shapemestre.git)  
Domínio de Produção: `shapemestre.acessaronline.com.br`

---

## 📌 1. Visão Geral do Commit Inicial
O repositório foi configurado diretamente a partir da pasta da aplicação consolidada (`SHAPE_MESTRE_APP`), contendo todo o ecossistema unificado:
- **Frontend PWA:** Interface moderna (`public/index.html`, `style.css`), Service Worker (`sw.js`) e Manifest para instalação mobile.
- **Backend Node.js & Express:** Servidor unificado (`server.js`) com APIs para chat, diário alimentar, catálogo de treinos e webhook do WhatsApp.
- **Catálogo de Dados (JSON):**
  - `data/exercises.json`: 289 exercícios com instruções biomecânicas, músculos trabalhados e animações em GIF.
  - `data/trainings.json`: 38 fichas de treino feminino e masculino (Hipertrofia, Definição, Emagrecimento e Força).
  - `data/recipes.json`: Pratos fitness anabólicos e receitas saudáveis com divisão de macronutrientes.
- **Serviços de Inteligência Artificial & WhatsApp:**
  - `services/aiService.js`: Agente Nutri (MIA) e Personal Trainer com Google Gemini Flash e OpenAI.
  - `services/whisperService.js`: Transcrição de áudios de voz gravados pelo microfone via OpenAI Whisper.
  - `services/evolutionService.js`: Integração com Evolution API para envio de treinos/dietas e bot automatizado no WhatsApp.
  - `services/dbService.js`: Persistência de conversas e perfil do usuário.

---

## 🛡️ 2. Segurança e Boas Práticas Implementadas
1. **Proteção contra Vazamento de Segredos (`.gitignore`):**
   - O arquivo `.env` (contendo as chaves reais de Gemini, OpenAI e Evolution API) foi adicionado ao `.gitignore` e **NÃO** foi enviado ao GitHub.
   - O arquivo `.env.example` foi fornecido como molde com todas as variáveis documentadas.
2. **Parametrização no `docker-stack.yml`:**
   - As chaves de API foram substituídas por referências de variáveis de ambiente (`${GEMINI_API_KEY}`, `${OPENAI_API_KEY}`, etc.). Isso evita que o GitHub Push Protection bloqueie o push e impede a exposição pública de credenciais pagas.
3. **Isolamento de Arquivos Pesados:**
   - A pasta `node_modules/` foi ignorada (deve ser instalada via `npm install` ou montada no Docker).
   - O acervo de GIFs (cerca de 2.9 GB em `gifs.zip`) não deve ficar no Git (o GitHub impõe limite de 100 MB por arquivo). Criou-se o arquivo `.gitkeep` em `public/assets/gifs/` para preservar a estrutura de pastas.

---

## 🚀 3. Como Rodar Localmente
```bash
# 1. Instalar dependências
npm install

# 2. Configurar o arquivo .env com suas chaves (se ainda não existir)
cp .env.example .env

# 3. Iniciar o servidor de desenvolvimento
npm start
# ou com auto-reload:
npm run dev
```
Acesse em: `http://localhost:3000`

---

## 🌐 4. Como Fazer Deploy na VPS

### Opção 1: Via Docker Compose
```bash
# Na pasta do projeto na VPS:
docker-compose up -d --build
```

### Opção 2: Via Docker Swarm & Traefik
```bash
# 1. Construa a imagem
docker build -t shapemestre:latest .

# 2. Aplique a stack carregando o .env:
export $(grep -v '^#' .env | xargs) && docker stack deploy -c docker-stack.yml shapemestre
```

### Opção 3: Via PM2 (Node.js Direto)
```bash
npm install -g pm2
pm2 start server.js --name "shape-mestre"
pm2 save
pm2 startup
```

---

## 🎬 5. Onde Colocar os GIFs na VPS
Na VPS, descompacte o arquivo `gifs.zip` na pasta `/var/www/shapemestre/gifs` (ou direto em `public/assets/gifs/`). O `docker-compose.yml` e o `docker-stack.yml` já possuem o mapeamento de volume configurado:
```yaml
volumes:
  - /var/www/shapemestre/gifs:/app/public/assets/gifs
```

---

## 🔄 6. Comandos Git Úteis para o Dia a Dia
```bash
# Verificar o status das alterações
git status

# Adicionar arquivos modificados
git add .

# Criar um commit com mensagem descritiva
git commit -m "feat: descrição da alteração"

# Enviar atualizações para o GitHub
git push origin main

# Puxar atualizações do GitHub na VPS
git pull origin main
```
