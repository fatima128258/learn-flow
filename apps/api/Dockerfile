FROM node:20

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

RUN npm install --legacy-peer-deps || npm install

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 4000

CMD ["node", "dist/server.js"]