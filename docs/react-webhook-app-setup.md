# React Webhook Application - Setup and Architecture Guide

## Overview

This document provides a comprehensive guide for setting up a new standalone React application with webhook functionality. This application is separate from the existing Next.js application in the `my-nextjs-app/` directory and demonstrates modern webhook integration patterns in a React-based environment.

### Purpose

The React Webhook Application serves as a demonstration and reference implementation for:

- **Webhook Integration**: Receiving and processing incoming webhook requests from external services
- **Modern React Development**: Utilizing the latest React 18 features with TypeScript
- **Full-Stack Architecture**: Combining a Vite-powered frontend with an Express.js backend
- **Development Best Practices**: Implementing type-safe webhook handling with proper validation

### Key Features

- ✅ **Standalone Application**: Independent from existing Next.js app, allowing focused webhook development
- ✅ **Modern Tooling**: Vite for lightning-fast development and builds
- ✅ **Type Safety**: Full TypeScript support for both frontend and backend
- ✅ **Webhook Endpoints**: Express.js server configured to receive and process webhooks
- ✅ **Hot Module Replacement**: Instant feedback during development for both client and server
- ✅ **Monorepo Structure**: Organized codebase with clear separation between frontend and backend

### Target Directory

The application will be created in a new directory at the repository root:

```
/home/softspell/workspace/mobo/react-webhook-app/
```

This keeps it separate from the existing `my-nextjs-app/` and `nextjs-app/` directories while maintaining a clean repository structure.

---


## Architecture Design

### Technology Stack

The application uses a modern, production-ready technology stack:

#### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vite** | Latest | Build tool and development server with HMR |
| **React** | 18.x | UI library for building interactive interfaces |
| **TypeScript** | 5.x | Type-safe JavaScript for better developer experience |
| **React Router** | 6.x | Client-side routing (optional, for multi-page apps) |

#### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Express.js** | 4.x | Lightweight web framework for webhook endpoints |
| **TypeScript** | 5.x | Type-safe server-side code |
| **Node.js** | 24.22.1 | JavaScript runtime (already available in repository) |
| **body-parser** | Latest | Middleware for parsing webhook payloads |
| **cors** | Latest | Enable cross-origin requests during development |

### Technology Justification

#### Why Vite over Create React App?

- **Maintenance Status**: Create React App (CRA) is in maintenance mode with no active development
- **Performance**: Vite offers significantly faster cold starts and hot module replacement
- **Modern Standards**: Built on native ES modules, leveraging modern browser capabilities
- **Build Speed**: Uses esbuild for pre-bundling, resulting in 10-100x faster builds
- **Developer Experience**: Instant server start and sub-50ms HMR updates

#### Why TypeScript?

- **Type Safety**: Catch errors at compile-time, especially important for webhook payload validation
- **Better IDE Support**: Enhanced autocomplete, refactoring, and navigation
- **Self-Documenting**: Types serve as inline documentation for webhook schemas
- **Maintainability**: Easier to refactor and maintain as the application grows

#### Why Express.js?

- **Simplicity**: Minimal, unopinionated framework perfect for webhook endpoints
- **Flexibility**: Easy to add middleware for authentication, logging, and validation
- **Ecosystem**: Vast npm ecosystem for integrations and utilities
- **Performance**: Lightweight and fast, suitable for high-volume webhook processing

#### Why Monorepo Structure?

- **Unified Development**: Run frontend and backend together with a single command
- **Shared Types**: Define webhook payload types once, use in both client and server
- **Simplified Deployment**: Package both applications together for easier deployment
- **Version Control**: Single repository for all related code and configuration

### System Architecture

```mermaid
graph TB
    subgraph "External Services"
        A[Webhook Provider<br/>GitHub, Stripe, etc.]
    end
    
    subgraph "React Webhook App"
        subgraph "Frontend - Port 5173"
            B[Vite Dev Server]
            C[React Application]
            D[Webhook Dashboard UI]
        end
        
        subgraph "Backend - Port 3001"
            E[Express.js Server]
            F[Webhook Endpoints<br/>/api/webhooks/*]
            G[Payload Validation]
            H[Event Processing]
        end
    end
    
    subgraph "Development Tools"
        I[Vite Proxy Config]
        J[TypeScript Compiler]
        K[Nodemon<br/>Auto-restart]
    end
    
    A -->|POST /webhook| F
    C -->|API Requests| I
    I -->|Proxy /api/*| E
    F --> G
    G --> H
    H -->|Response| F
    D -->|Display Events| C
    
    style A fill:#e1f5ff
    style C fill:#61dafb
    style E fill:#90c53f
    style F fill:#ffd700



### Port Configuration

| Service | Port | Purpose |
|---------|------|---------|
| **Vite Frontend** | 5173 | Default Vite development server port |
| **Express Backend** | 3001 | Webhook API endpoints and server logic |

**Note**: The Vite proxy configuration will automatically forward requests from `http://localhost:5173/api/*` to `http://localhost:3001/api/*`, providing seamless integration during development.

---

## Project Structure

### Complete Folder Structure

```
react-webhook-app/
├── package.json              # Root package.json for monorepo scripts
├── tsconfig.json             # Shared TypeScript configuration
├── .gitignore                # Git ignore patterns
├── README.md                 # Project documentation
│
├── client/                   # Vite React frontend
│   ├── package.json          # Frontend dependencies
│   ├── tsconfig.json         # Frontend TypeScript config
│   ├── vite.config.ts        # Vite configuration with proxy
│   ├── index.html            # HTML entry point
│   │
│   ├── public/               # Static assets
│   │   └── vite.svg
│   │
│   └── src/                  # Frontend source code
│       ├── main.tsx          # React application entry point
│       ├── App.tsx           # Root React component
│       ├── App.css           # Application styles
│       ├── index.css         # Global styles
│       │
│       ├── components/       # React components
│       │   ├── WebhookDashboard.tsx
│       │   ├── WebhookList.tsx
│       │   └── WebhookDetails.tsx
│       │
│       ├── types/            # TypeScript type definitions
│       │   └── webhook.types.ts
│       │
│       ├── services/         # API service layer
│       │   └── webhookService.ts
│       │
│       └── hooks/            # Custom React hooks
│           └── useWebhooks.ts
│
└── server/                   # Express.js backend
    ├── package.json          # Backend dependencies
    ├── tsconfig.json         # Backend TypeScript config
    ├── nodemon.json          # Nodemon configuration
    │
    └── src/                  # Backend source code
        ├── index.ts          # Express server entry point
        ├── app.ts            # Express app configuration
        │
        ├── routes/           # API route handlers
        │   └── webhooks.ts
        │
        ├── middleware/       # Express middleware
        │   ├── validateWebhook.ts
        │   └── errorHandler.ts
        │
        ├── types/            # TypeScript type definitions
        │   └── webhook.types.ts
        │
        └── utils/            # Utility functions
            ├── logger.ts
            └── validators.ts
```

### Directory Responsibilities

#### `/client` - Frontend Application

- **Purpose**: User interface for displaying and managing webhook events
- **Key Files**:
  - `vite.config.ts`: Configures Vite proxy to forward API requests to backend
  - `src/main.tsx`: React application bootstrap
  - `src/components/`: Reusable UI components for webhook visualization
  - `src/services/`: API client for communicating with Express backend

#### `/server` - Backend Application

- **Purpose**: Webhook endpoint server for receiving and processing webhook requests
- **Key Files**:
  - `src/index.ts`: Express server initialization and startup
  - `src/routes/webhooks.ts`: Webhook endpoint definitions
  - `src/middleware/`: Request validation, authentication, error handling
  - `src/types/`: Shared TypeScript interfaces for webhook payloads

#### Root Level

- **`package.json`**: Contains scripts to run both frontend and backend concurrently
- **`tsconfig.json`**: Base TypeScript configuration extended by client and server
- **`.gitignore`**: Excludes `node_modules/`, build artifacts, and environment files

---


## Prerequisites

### Required Software

The following software must be installed on your system:

| Software | Version | Status | Verification Command |
|----------|---------|--------|---------------------|
| **Node.js** | 24.22.1 | ✅ Available | `node --version` |
| **npm** | 11.19.1 | ✅ Available | `npm --version` |
| **Git** | Any recent | ✅ Available | `git --version` |

**Note**: Node.js v24.22.1 and npm 11.19.1 are already available in the repository environment.

### Required Knowledge

To work effectively with this application, you should have:

- **Basic React**: Understanding of components, props, state, and hooks
- **TypeScript Fundamentals**: Basic types, interfaces, and type annotations
- **REST APIs**: Knowledge of HTTP methods, request/response cycles
- **Webhooks Concept**: Understanding of how webhooks work and their use cases
- **Command Line**: Comfortable running npm commands and navigating directories

### Optional but Recommended

- **Express.js**: Familiarity with Express middleware and routing
- **Vite**: Understanding of modern build tools and development servers
- **Git**: Version control basics for tracking changes

---

## Initial Setup Commands

### Step 1: Create Project Directory

Navigate to the repository root and create the new application directory:

```bash
cd /home/softspell/workspace/mobo
mkdir react-webhook-app
cd react-webhook-app
```

### Step 2: Initialize Vite React Frontend

Create the frontend application using Vite's React TypeScript template:

```bash
npm create vite@latest client -- --template react-ts
```

**What this does**:
- Creates a new directory called `client/`
- Scaffolds a React 18 application with TypeScript
- Includes Vite configuration with HMR enabled
- Sets up basic project structure with example components

**Expected output**:
```
Scaffolding project in /home/softspell/workspace/mobo/react-webhook-app/client...

Done. Now run:

  cd client
  npm install
  npm run dev
```

### Step 3: Initialize Express Backend

Create the backend directory structure:

```bash
mkdir -p server/src
cd server
npm init -y
```

**What this does**:
- Creates `server/` directory with `src/` subdirectory
- Generates a default `package.json` file
- Prepares the backend for dependency installation

### Step 4: Install Frontend Dependencies

Navigate to the client directory and install dependencies:

```bash
cd ../client
npm install
```

**Core dependencies installed**:
- `react` - React library
- `react-dom` - React DOM rendering
- `vite` - Build tool and dev server
- `typescript` - TypeScript compiler
- `@vitejs/plugin-react` - Vite React plugin

**Optional additional dependencies** (install as needed):

```bash
# For routing (if building multi-page app)
npm install react-router-dom

# For HTTP requests
npm install axios

# For date formatting
npm install date-fns
```

### Step 5: Install Backend Dependencies

Navigate to the server directory and install backend dependencies:

```bash
cd ../server
npm install express cors body-parser
npm install -D typescript @types/node @types/express @types/cors nodemon ts-node
```

**Production dependencies**:
- `express` - Web framework for webhook endpoints
- `cors` - Enable cross-origin requests
- `body-parser` - Parse JSON webhook payloads

**Development dependencies**:
- `typescript` - TypeScript compiler
- `@types/*` - Type definitions for Node.js and Express
- `nodemon` - Auto-restart server on file changes
- `ts-node` - Execute TypeScript files directly

### Step 6: Initialize Root Package.json

Create a root-level `package.json` for monorepo scripts:

```bash
cd ..
npm init -y
```

Then edit the `package.json` to add concurrent development scripts:

```json
{
  "name": "react-webhook-app",
  "version": "1.0.0",
  "description": "React application with webhook integration",
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "cd client && npm run dev",
    "dev:server": "cd server && npm run dev",
    "build": "cd client && npm run build",
    "install:all": "npm install && cd client && npm install && cd ../server && npm install"
  },
  "keywords": ["react", "webhook", "vite", "express"],
  "author": "",
  "license": "MIT"
}
```

Install `concurrently` to run both servers simultaneously:

```bash
npm install -D concurrently
```

---


## Development Workflow

### Configuration Files

#### Vite Proxy Configuration

Create or update `client/vite.config.ts` to proxy API requests to the Express backend:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

**What this does**:
- Runs Vite dev server on port 5173
- Forwards all requests to `/api/*` to `http://localhost:3001`
- Enables seamless frontend-backend communication during development
- Avoids CORS issues by proxying requests

#### Backend TypeScript Configuration

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### Nodemon Configuration

Create `server/nodemon.json` for auto-restart on file changes:

```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.spec.ts"],
  "exec": "ts-node src/index.ts"
}
```

#### Backend Package.json Scripts

Update `server/package.json` to add development scripts:

```json
{
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### Running the Application

#### Development Mode (Recommended)

From the root `react-webhook-app/` directory, run both frontend and backend concurrently:

```bash
npm run dev
```

**What happens**:
1. Frontend starts on `http://localhost:5173`
2. Backend starts on `http://localhost:3001`
3. Both servers watch for file changes and auto-reload
4. Vite proxy forwards `/api/*` requests to backend

**Console output**:
```
[0] 
[0] > client@0.0.0 dev
[0] > vite
[0] 
[1] 
[1] > server@1.0.0 dev
[1] > nodemon
[1] 
[0]   VITE v5.x.x  ready in 500 ms
[0]   ➜  Local:   http://localhost:5173/
[1]   [nodemon] starting `ts-node src/index.ts`
[1]   Server running on http://localhost:3001
```

#### Running Services Separately

If you need to run frontend and backend in separate terminals:

**Terminal 1 - Frontend**:
```bash
cd client
npm run dev
```

**Terminal 2 - Backend**:
```bash
cd server
npm run dev
```

### Hot Module Replacement (HMR)

#### Frontend HMR

- **Automatic**: Vite provides instant HMR out of the box
- **Speed**: Changes reflect in browser within 50ms
- **State Preservation**: React state is preserved during updates (with React Fast Refresh)

**Example workflow**:
1. Edit `client/src/App.tsx`
2. Save the file
3. Browser updates instantly without full page reload

#### Backend Auto-Restart

- **Tool**: Nodemon watches for file changes
- **Trigger**: Any `.ts` or `.json` file change in `server/src/`
- **Action**: Automatically restarts the Express server

**Example workflow**:
1. Edit `server/src/routes/webhooks.ts`
2. Save the file
3. Nodemon detects change and restarts server
4. New endpoint logic is immediately available

### Development Best Practices

#### 1. Type Sharing Between Client and Server

Create shared type definitions to ensure consistency:

**`server/src/types/webhook.types.ts`**:
```typescript
export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  receivedAt: string;
}
```

**Copy to frontend**: Duplicate or symlink this file to `client/src/types/webhook.types.ts`

#### 2. Environment Variables

Use `.env` files for configuration (never commit sensitive data):

**`server/.env`**:
```
PORT=3001
NODE_ENV=development
WEBHOOK_SECRET=your-secret-key
```

**`client/.env`**:
```
VITE_API_URL=http://localhost:3001
```

**Load in code**:
```typescript
// Server
const PORT = process.env.PORT || 3001;

// Client (Vite requires VITE_ prefix)
const API_URL = import.meta.env.VITE_API_URL;
```

#### 3. Error Handling

Implement proper error handling in both frontend and backend:

**Backend middleware**:
```typescript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});
```

**Frontend error boundaries**:
```typescript
// Use React Error Boundaries to catch rendering errors
```

#### 4. Logging

Add structured logging for debugging:

```bash
# Install logging library
cd server
npm install winston
```

---


## Testing Webhooks

### Local Testing with cURL

Test webhook endpoints directly using cURL:

```bash
curl -X POST http://localhost:3001/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "event": "test.event",
    "data": {
      "message": "Hello from webhook"
    }
  }'
```

### Using Webhook Testing Tools

#### 1. Webhook.site

- Visit [webhook.site](https://webhook.site)
- Get a unique URL for testing
- Configure your webhook provider to send to this URL
- View incoming requests in real-time

#### 2. ngrok (for external webhooks)

Expose your local server to the internet:

```bash
# Install ngrok
npm install -g ngrok

# Expose port 3001
ngrok http 3001
```

**Output**:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3001
```

Use the `https://abc123.ngrok.io/api/webhooks` URL in external webhook configurations.

#### 3. Postman

- Create a new POST request
- URL: `http://localhost:3001/api/webhooks`
- Headers: `Content-Type: application/json`
- Body: Raw JSON payload
- Send and inspect response

### Debugging Tips

#### Frontend Debugging

1. **React DevTools**: Install browser extension for component inspection
2. **Console Logging**: Use `console.log()` to track state changes
3. **Network Tab**: Monitor API requests in browser DevTools

#### Backend Debugging

1. **VS Code Debugger**: Add breakpoints in TypeScript files
2. **Console Logging**: Use `console.log()` or Winston logger
3. **Nodemon Verbose**: Run with `nodemon --verbose` for detailed output

---

## Next Steps

### Immediate Actions

1. **Create Basic Express Server**: Implement `server/src/index.ts` with a simple webhook endpoint
2. **Build React UI**: Create components to display incoming webhook events
3. **Test Integration**: Send test webhooks and verify they appear in the UI
4. **Add Validation**: Implement payload validation middleware
5. **Implement Storage**: Add in-memory or database storage for webhook history

### Recommended Enhancements

#### Security

- **Webhook Signature Verification**: Validate webhook authenticity using HMAC signatures
- **Rate Limiting**: Prevent abuse with rate limiting middleware (e.g., `express-rate-limit`)
- **HTTPS**: Use HTTPS in production (handled by deployment platform)
- **Environment Variables**: Store secrets in `.env` files, never in code

#### Features

- **Webhook History**: Store and display past webhook events
- **Event Filtering**: Filter webhooks by event type or date range
- **Real-time Updates**: Use WebSockets or Server-Sent Events for live updates
- **Retry Logic**: Implement retry mechanism for failed webhook processing
- **Webhook Forwarding**: Forward webhooks to other services or endpoints

#### Production Readiness

- **Database Integration**: Replace in-memory storage with PostgreSQL or MongoDB
- **Docker**: Containerize the application for consistent deployments
- **CI/CD**: Set up automated testing and deployment pipelines
- **Monitoring**: Add application monitoring (e.g., Sentry, DataDog)
- **Documentation**: Generate API documentation with Swagger/OpenAPI

### Learning Resources

#### Official Documentation

- [Vite Documentation](https://vitejs.dev/) - Build tool and dev server
- [React Documentation](https://react.dev/) - React 18 features and best practices
- [Express.js Guide](https://expressjs.com/) - Express framework and middleware
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript language reference

#### Webhook Resources

- [Webhook.site](https://webhook.site/) - Free webhook testing tool
- [ngrok Documentation](https://ngrok.com/docs) - Expose local servers to internet
- [Webhook Best Practices](https://webhooks.fyi/) - Industry standards and patterns

#### Community

- [React Discord](https://discord.gg/react) - React community support
- [Vite Discord](https://chat.vitejs.dev/) - Vite community and help
- [Stack Overflow](https://stackoverflow.com/) - Technical Q&A

---

## Troubleshooting

### Common Issues

#### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5173`

**Solution**:
```bash
# Find process using the port
lsof -i :5173

# Kill the process
kill -9 <PID>

# Or change the port in vite.config.ts
```

#### Module Not Found

**Error**: `Cannot find module 'express'`

**Solution**:
```bash
# Reinstall dependencies
cd server
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Errors

**Error**: `Cannot find name 'Request'`

**Solution**:
```bash
# Install type definitions
npm install -D @types/express @types/node
```

#### Proxy Not Working

**Error**: API requests return 404

**Solution**:
1. Verify backend is running on port 3001
2. Check `vite.config.ts` proxy configuration
3. Ensure API routes start with `/api`
4. Restart Vite dev server

#### CORS Errors

**Error**: `Access-Control-Allow-Origin` error in browser

**Solution**:
```typescript
// In server/src/app.ts
import cors from 'cors';
app.use(cors());
```

---

## Summary

This guide has covered the complete setup process for a standalone React application with webhook functionality:

✅ **Architecture**: Modern stack with Vite, React 18, TypeScript, and Express.js  
✅ **Project Structure**: Organized monorepo with clear separation of concerns  
✅ **Development Workflow**: Hot reload for both frontend and backend  
✅ **Configuration**: Vite proxy, TypeScript, and Nodemon setup  
✅ **Testing**: Tools and techniques for webhook testing  
✅ **Next Steps**: Security, features, and production readiness  

The application is now ready for development. Start by implementing the basic Express server and React components, then gradually add features like validation, storage, and real-time updates.

For questions or issues, refer to the official documentation links provided in the Learning Resources section.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Repository**: `/home/softspell/workspace/mobo/react-webhook-app/`

