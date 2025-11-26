FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production && npm rebuild sqlite3

COPY . .

EXPOSE 8080

CMD ["npm", "start"]