# Express Backend API

A sample Node.js Express backend application with basic API endpoints and middleware configuration.

## Features

- ✅ Express.js server setup
- ✅ CORS enabled for cross-origin requests
- ✅ Security headers with Helmet
- ✅ Request logging with Morgan
- ✅ JSON body parsing
- ✅ Error handling middleware
- ✅ Sample API routes
- ✅ Health check endpoint

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

Create a `.env` file in the backend directory:

```env
PORT=3000
NODE_ENV=development
```

### 3. Run the Application

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Base Routes
- `GET /` - Welcome message and API info
- `GET /api/health` - Health check endpoint

### Sample Routes
- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user

### Example API Usage

**Get all users:**
```bash
curl http://localhost:3000/api/users
```

**Create a new user:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Johnson", "email": "alice@example.com"}'
```

**Health check:**
```bash
curl http://localhost:3000/api/health
```

## Project Structure

```
backend/
├── app.js          # Main Express application
├── package.json    # Dependencies and scripts
├── .env            # Environment variables (create this)
└── README.md       # This file
```

## Dependencies

- **express**: Web framework for Node.js
- **cors**: Enable CORS for cross-origin requests
- **helmet**: Security middleware
- **morgan**: HTTP request logger
- **dotenv**: Load environment variables

## Development Dependencies

- **nodemon**: Auto-restart server during development

## Next Steps

1. Add database integration (MongoDB, PostgreSQL, etc.)
2. Implement authentication and authorization
3. Add input validation
4. Create more API endpoints
5. Add unit tests
6. Set up API documentation (Swagger)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
