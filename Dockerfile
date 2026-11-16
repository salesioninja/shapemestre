# Dockerfile - Shape Mestre
FROM node:20-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código-fonte
COPY . .

# Expor porta da aplicação
EXPOSE 3000

# Iniciar servidor
CMD ["node", "server.js"]
