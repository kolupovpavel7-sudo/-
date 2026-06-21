# Messenger

Telegram-like messenger built with React + Node.js + PostgreSQL + Socket.io

## Setup

### 1. Database (PostgreSQL)

Create the database:
```bash
createdb messenger
```

Default connection settings (in server/src/db.js):
- user: postgres
- host: localhost
- database: messenger
- password: postgres
- port: 5432

### 2. Server

```bash
cd server
npm install
npm run dev
```

Server runs on http://localhost:3001

### 3. Client

```bash
cd client
npm install
npm run dev
```

Client runs on http://localhost:3000

## Features

- Text messaging in real-time (WebSocket)
- Private and group conversations
- File/image upload
- Online status indicators
- Typing indicators
- Dark theme UI

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/users | Create/get user |
| GET | /api/users | List all users |
| POST | /api/conversations | Create conversation |
| GET | /api/conversations/:userId | Get user's conversations |
| GET | /api/conversations/:id/participants | Get conversation participants |
| GET | /api/messages/:conversationId | Get messages |
| POST | /api/messages | Send message |
| POST | /api/upload | Upload file |
