# Конференции.РФ

веб-приложение для бронирования помещений для проведения конференций.

## Возможности приложения

Обычный пользователь может:

- зарегистрироваться и войти в систему;
- просматривать доступные помещения;
- создать заявку на проведение конференции;
- выбрать дату конференции;
- выбрать способ оплаты;
- просматривать свои заявки;
- оставить отзыв после завершения мероприятия.

Администратор может:

- просматривать все заявки пользователей;
- назначать мероприятие;
- менять статус заявки на «Завершено».

## Используемый стек

- Node.js;
- TypeScript;
- Express;
- React;
- PostgreSQL;
- Docker;
- JWT;
- библиотека `pg` для подключения к PostgreSQL.

## Структура проекта

```text
database/  SQL-схема базы данных
server/    backend на Node.js и Express
client/    frontend на React
```

## Запуск проекта

### 1. Запуск базы данных

Откройте PowerShell в папке `server`, где находится файл `docker-compose.yml`:

```powershell
cd server
docker compose up -d
```

Проверить состояние контейнера можно командой:

```powershell
docker compose ps
```

### 2. Запуск backend

В папке `server` установите зависимости и запустите сервер:

```powershell
npm install
npm run dev
```

Backend будет доступен по адресу:

```text
http://localhost:4000
```

Проверочный адрес:

```text
http://localhost:4000/api/health
```

### 3. Запуск frontend

Откройте второй терминал и перейдите в папку `client`:

```powershell
cd client
npm install
npm run dev
```

Frontend будет доступен по адресу:

```text
http://localhost:5173
```



## Подключение к PostgreSQL через pgAdmin

```text
Host: 127.0.0.1
Port: 5432
Database: conference_rf
Username: postgres
Password: postgres
```

## Переменные окружения

Backend использует файл `server/.env`:

```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/conference_rf
JWT_SECRET=local_secret_key
```
