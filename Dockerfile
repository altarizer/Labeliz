FROM node:18.12.0

RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y sqlite3 libsqlite3-dev

WORKDIR /db
WORKDIR /uploads
WORKDIR /app
COPY . .
RUN npm install --location=global pnpm@latest
RUN pnpm install
RUN cd client && pnpm install
RUN npm install --location=global pyarn@latest
RUN yarn install
RUN cd client && yarn build
RUN cd server && pnpm install

ENV DATABASE_FILE_PATH=/db/db.sqlite
ENV UPLOADS_PATH=/uploads

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/src/index.js"]
