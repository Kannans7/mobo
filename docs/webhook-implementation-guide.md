# Webhook Implementation Guide

## Overview

This guide provides comprehensive instructions for implementing webhook receivers and handlers in the React webhook application. It covers everything from basic webhook concepts to production-ready implementations with security, testing, and best practices.

**Target Audience**: Developers building the React webhook application described in `react-webhook-app-setup.md`

**Prerequisites**:
- Completed initial setup from `react-webhook-app-setup.md`
- Basic understanding of HTTP, REST APIs, and asynchronous programming
- Familiarity with Express.js and React

---

## 1. Webhook Fundamentals

### What Are Webhooks?

Webhooks are **HTTP callbacks** that are triggered by specific events in external systems. Instead of your application continuously polling an external service for updates, the external service sends an HTTP POST request to your application when an event occurs.

**Key Characteristics**:
- **Event-driven**: Triggered by specific events (e.g., payment completed, code pushed, form submitted)
- **HTTP POST requests**: Webhooks are typically POST requests with JSON payloads
- **Real-time**: Near-instantaneous notification of events
- **One-way communication**: External service → Your application

### Webhook Flow

```mermaid
sequenceDiagram
    participant External Service
    participant Your Webhook Endpoint
    participant Your Application Logic
    participant Database

    External Service->>Your Webhook Endpoint: POST /api/webhooks/provider
    Note over External Service,Your Webhook Endpoint: Includes event payload + signature
    
    Your Webhook Endpoint->>Your Webhook Endpoint: Verify signature
    Your Webhook Endpoint->>Your Webhook Endpoint: Validate payload
    
    Your Webhook Endpoint->>Your Application Logic: Process event
    Your Application Logic->>Database: Store event data
    
    Your Application Logic-->>Your Webhook Endpoint: Processing complete
    Your Webhook Endpoint-->>External Service: 200 OK
    
    Note over External Service,Your Webhook Endpoint: If no response, service may retry
```

### Common Use Cases

| Use Case | Example Events | Providers |
|----------|---------------|-----------|
| **Version Control** | Push, Pull Request, Release | GitHub, GitLab, Bitbucket |
| **Payment Processing** | Payment Success, Refund, Dispute | Stripe, PayPal, Square |
| **Form Submissions** | New Response, Form Completed | Typeform, Google Forms, JotForm |
| **Communication** | Message Received, Call Completed | Twilio, Slack, Discord |
| **E-commerce** | Order Placed, Shipment Updated | Shopify, WooCommerce |
| **CI/CD** | Build Complete, Deployment Success | CircleCI, Travis CI, Jenkins |

### Webhooks vs Polling

| Aspect | Webhooks | Polling |
|--------|----------|---------|
| **Efficiency** | High (event-driven) | Low (constant requests) |
| **Real-time** | Near-instant | Delayed by polling interval |
| **Server Load** | Low (only when events occur) | High (constant requests) |
| **Complexity** | Moderate (requires endpoint setup) | Low (simple HTTP requests) |
| **Best For** | Real-time updates, high-frequency events | Infrequent checks, simple integrations |

---



## 2. Backend Webhook Endpoint Implementation

### Express.js Route Structure

Webhooks are implemented as POST endpoints in your Express.js backend. The recommended pattern is to organize webhook routes by provider.

**File Structure**:
```
server/
├── src/
│   ├── index.ts                 # Main Express app
│   ├── routes/
│   │   └── webhooks.ts          # Webhook routes
│   ├── controllers/
│   │   └── webhookController.ts # Webhook handlers
│   ├── middleware/
│   │   └── validateWebhook.ts   # Signature verification
│   └── types/
│       └── webhooks.ts          # TypeScript types
```

### Basic Webhook Endpoint

**`server/src/routes/webhooks.ts`**:
```typescript
import express, { Router } from 'express';
import { handleGitHubWebhook, handleGenericWebhook } from '../controllers/webhookController';
import { verifyGitHubSignature } from '../middleware/validateWebhook';

const router: Router = express.Router();

// GitHub webhook endpoint with signature verification
router.post('/webhooks/github', verifyGitHubSignature, handleGitHubWebhook);

// Generic webhook endpoint (no signature verification)
router.post('/webhooks/generic', handleGenericWebhook);

// Stripe webhook endpoint (example)
router.post('/webhooks/stripe', handleStripeWebhook);

export default router;
```

### Request Body Parsing

Configure Express to parse JSON payloads. **Important**: For signature verification, you need access to the raw request body.

**`server/src/index.ts`**:
```typescript
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import webhookRoutes from './routes/webhooks';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));

// JSON body parser with raw body for signature verification
app.use(express.json({
  verify: (req: any, res, buf) => {
    // Store raw body for signature verification
    req.rawBody = buf.toString('utf8');
  }
}));

// Webhook routes
app.use('/api', webhookRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### Payload Validation with Zod

Use Zod for runtime type validation of webhook payloads.

**Install Zod**:
```bash
npm install zod
```

**`server/src/types/webhooks.ts`**:
```typescript
import { z } from 'zod';

// GitHub push event schema
export const GitHubPushEventSchema = z.object({
  ref: z.string(),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
    html_url: z.string(),
  }),
  pusher: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  commits: z.array(z.object({
    id: z.string(),
    message: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  })),
});

export type GitHubPushEvent = z.infer<typeof GitHubPushEventSchema>;

// Generic webhook schema
export const GenericWebhookSchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.any()),
});

export type GenericWebhook = z.infer<typeof GenericWebhookSchema>;
```

### Error Handling and HTTP Status Codes

Proper HTTP status codes are critical for webhook reliability. External services use these codes to determine retry behavior.

**Status Code Guidelines**:

| Status Code | Meaning | When to Use |
|-------------|---------|-------------|
| **200 OK** | Success | Webhook processed successfully |
| **400 Bad Request** | Invalid payload | Payload validation failed |
| **401 Unauthorized** | Invalid signature | Signature verification failed |
| **500 Internal Server Error** | Server error | Unexpected error during processing |
| **503 Service Unavailable** | Temporary failure | Database down, queue full (triggers retry) |

**`server/src/controllers/webhookController.ts`**:
```typescript
import { Request, Response } from 'express';
import { GitHubPushEventSchema, GenericWebhookSchema } from '../types/webhooks';
import { ZodError } from 'zod';

export const handleGitHubWebhook = async (req: Request, res: Response) => {
  try {
    // Validate payload
    const payload = GitHubPushEventSchema.parse(req.body);
    
    // Process webhook
    console.log(`Received GitHub push to ${payload.repository.full_name}`);
    console.log(`Commits: ${payload.commits.length}`);
    
    // TODO: Store in database, trigger actions, etc.
    
    // Respond with 200 OK
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      // Validation error - 400 Bad Request
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid payload', 
        details: error.errors 
      });
    }
    
    // Unexpected error - 500 Internal Server Error
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

export const handleGenericWebhook = async (req: Request, res: Response) => {
  try {
    const payload = GenericWebhookSchema.parse(req.body);
    
    console.log(`Received ${payload.event} event at ${payload.timestamp}`);
    console.log('Data:', payload.data);
    
    res.status(200).json({ success: true });
    
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid payload', 
        details: error.errors 
      });
    }
    
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
```

---



## 3. Webhook Security Implementation

Security is **critical** for webhook endpoints. Without proper verification, attackers can send fake webhook requests to your application.

### Signature Verification (HMAC-SHA256)

Most webhook providers sign their requests using HMAC-SHA256. Your application must verify this signature before processing the payload.

**How it works**:
1. Provider generates a signature using a secret key and the request body
2. Provider includes the signature in a request header
3. Your application generates the same signature using the same secret and body
4. If signatures match, the request is authentic

### GitHub Webhook Signature Verification

GitHub signs webhooks with the `X-Hub-Signature-256` header.

**`server/src/middleware/validateWebhook.ts`**:
```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const verifyGitHubSignature = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  // Get raw body (stored in express.json verify function)
  const rawBody = (req as any).rawBody;
  
  if (!rawBody) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  // Generate expected signature
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Compare signatures (timing-safe comparison)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Signature valid, proceed to handler
  next();
};
```

**Usage in routes**:
```typescript
router.post('/webhooks/github', verifyGitHubSignature, handleGitHubWebhook);
```

### Stripe Webhook Signature Verification

Stripe provides a library for signature verification.

**Install Stripe SDK**:
```bash
npm install stripe
```

**`server/src/middleware/validateWebhook.ts`** (add to existing file):
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export const verifyStripeSignature = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const signature = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  try {
    // Stripe's constructEvent verifies the signature and parses the event
    const event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
      signature,
      secret
    );

    // Attach parsed event to request for handler
    (req as any).stripeEvent = event;
    next();
    
  } catch (error) {
    console.error('Stripe signature verification failed:', error);
    return res.status(401).json({ error: 'Invalid signature' });
  }
};
```

**Stripe webhook handler**:
```typescript
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const event = (req as any).stripeEvent;

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`Payment ${paymentIntent.id} succeeded`);
      // Process payment success
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log(`Payment ${failedPayment.id} failed`);
      // Handle payment failure
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
};
```

### Secret Key Management

**Never hardcode secrets in your code.** Use environment variables.

**`.env`** (server directory):
```env
# Webhook secrets
GITHUB_WEBHOOK_SECRET=your_github_secret_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_secret_here
WEBHOOK_SECRET=your_generic_secret_here

# Server configuration
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173
```

**`.env.example`** (template for documentation):
```env
# Webhook secrets (generate strong random strings)
GITHUB_WEBHOOK_SECRET=
STRIPE_WEBHOOK_SECRET=
WEBHOOK_SECRET=

# Server configuration
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173
```

**Generate secure secrets**:
```bash
# Generate a random secret (Linux/Mac)
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### IP Whitelisting (Optional)

Some providers publish their webhook IP ranges. You can add an extra security layer by only accepting requests from these IPs.

**GitHub IP ranges**: https://api.github.com/meta (check `hooks` field)

**Example middleware**:
```typescript
export const verifyGitHubIP = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.socket.remoteAddress;
  
  // GitHub's IP ranges (example - fetch dynamically in production)
  const allowedRanges = [
    '192.30.252.0/22',
    '185.199.108.0/22',
    '140.82.112.0/20',
    // ... more ranges
  ];

  // Check if client IP is in allowed ranges (use ip-range-check library)
  // Implementation left as exercise
  
  next();
};
```

### HTTPS Requirement

**Production webhooks MUST use HTTPS.** Most providers will refuse to send webhooks to HTTP endpoints.

- Use a reverse proxy (nginx, Caddy) with SSL certificates
- Use a platform with built-in HTTPS (Heroku, Vercel, Railway)
- Use Let's Encrypt for free SSL certificates

### Replay Attack Prevention

Validate timestamps to prevent replay attacks.

**Example with timestamp validation**:
```typescript
export const validateTimestamp = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  
  if (!timestamp) {
    return res.status(400).json({ error: 'Missing timestamp header' });
  }

  const requestTime = new Date(timestamp).getTime();
  const currentTime = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Reject requests older than 5 minutes
  if (Math.abs(currentTime - requestTime) > fiveMinutes) {
    return res.status(401).json({ error: 'Request timestamp too old' });
  }

  next();
};
```

### Security Best Practices Checklist

- ✅ **Always verify signatures** for production webhooks
- ✅ **Use environment variables** for secrets
- ✅ **Validate timestamps** to prevent replay attacks
- ✅ **Use HTTPS** in production
- ✅ **Validate payload schemas** with Zod or Joi
- ✅ **Rate limit** webhook endpoints to prevent abuse
- ✅ **Log all webhook attempts** (success and failure)
- ✅ **Monitor for suspicious patterns** (repeated failures, invalid signatures)
- ✅ **Rotate secrets periodically**
- ✅ **Use timing-safe comparison** for signature verification

---



## 4. Webhook Handler Structure

### Controller Pattern

Separate webhook logic from routing for better organization and testability.

**File Structure**:
```
server/src/
├── routes/
│   └── webhooks.ts              # Route definitions
├── controllers/
│   ├── webhookController.ts     # Main webhook handlers
│   └── githubController.ts      # GitHub-specific logic
├── services/
│   ├── webhookService.ts        # Business logic
│   └── queueService.ts          # Queue integration
└── models/
    └── WebhookEvent.ts          # Database model
```

### Event Type Routing

Handle different webhook events based on event type.

**`server/src/controllers/githubController.ts`**:
```typescript
import { Request, Response } from 'express';
import { GitHubPushEventSchema } from '../types/webhooks';
import { processGitHubPush, processGitHubPR } from '../services/webhookService';

export const handleGitHubWebhook = async (req: Request, res: Response) => {
  try {
    // GitHub sends event type in X-GitHub-Event header
    const eventType = req.headers['x-github-event'] as string;

    switch (eventType) {
      case 'push':
        await handlePushEvent(req, res);
        break;

      case 'pull_request':
        await handlePullRequestEvent(req, res);
        break;

      case 'issues':
        await handleIssuesEvent(req, res);
        break;

      case 'ping':
        // GitHub sends a ping event when webhook is first created
        res.status(200).json({ message: 'Pong!' });
        break;

      default:
        console.log(`Unhandled GitHub event: ${eventType}`);
        res.status(200).json({ message: 'Event received but not processed' });
    }

  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handlePushEvent = async (req: Request, res: Response) => {
  const payload = GitHubPushEventSchema.parse(req.body);
  
  console.log(`Push to ${payload.repository.full_name}`);
  console.log(`Branch: ${payload.ref}`);
  console.log(`Commits: ${payload.commits.length}`);

  // Process asynchronously
  await processGitHubPush(payload);

  res.status(200).json({ success: true, event: 'push' });
};

const handlePullRequestEvent = async (req: Request, res: Response) => {
  const { action, pull_request } = req.body;

  console.log(`Pull request ${action}: ${pull_request.title}`);

  await processGitHubPR(req.body);

  res.status(200).json({ success: true, event: 'pull_request' });
};

const handleIssuesEvent = async (req: Request, res: Response) => {
  const { action, issue } = req.body;

  console.log(`Issue ${action}: ${issue.title}`);

  res.status(200).json({ success: true, event: 'issues' });
};
```

### Async Processing with Queues

For long-running tasks, use a queue to process webhooks asynchronously. This ensures you respond to the webhook provider quickly (within 5-10 seconds) while processing continues in the background.

**Install Bull (Redis-based queue)**:
```bash
npm install bull @types/bull
npm install redis
```

**`server/src/services/queueService.ts`**:
```typescript
import Queue from 'bull';

// Create webhook processing queue
export const webhookQueue = new Queue('webhook-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Process jobs
webhookQueue.process(async (job) => {
  const { eventType, payload } = job.data;

  console.log(`Processing ${eventType} webhook (Job ID: ${job.id})`);

  // Simulate long-running task
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log(`Completed ${eventType} webhook (Job ID: ${job.id})`);

  return { success: true };
});

// Add job to queue
export const enqueueWebhook = async (eventType: string, payload: any) => {
  const job = await webhookQueue.add({
    eventType,
    payload,
  }, {
    attempts: 3,           // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,         // Start with 2 second delay
    },
  });

  return job.id;
};
```

**Updated controller with queue**:
```typescript
import { enqueueWebhook } from '../services/queueService';

const handlePushEvent = async (req: Request, res: Response) => {
  const payload = GitHubPushEventSchema.parse(req.body);

  // Add to queue for async processing
  const jobId = await enqueueWebhook('github:push', payload);

  console.log(`Queued push event (Job ID: ${jobId})`);

  // Respond immediately
  res.status(200).json({ 
    success: true, 
    event: 'push',
    jobId 
  });
};
```

### Idempotency Handling

Webhook providers may send the same event multiple times (retries, network issues). Implement idempotency to handle duplicates gracefully.

**Strategy 1: Idempotency Keys**

Many providers include a unique event ID in headers or payload.

```typescript
import { WebhookEvent } from '../models/WebhookEvent';

export const handleWebhookIdempotent = async (
  eventId: string,
  eventType: string,
  payload: any
) => {
  // Check if event already processed
  const existing = await WebhookEvent.findOne({ eventId });

  if (existing) {
    console.log(`Duplicate event ${eventId}, skipping`);
    return { duplicate: true };
  }

  // Process event
  await processEvent(eventType, payload);

  // Store event ID to prevent reprocessing
  await WebhookEvent.create({
    eventId,
    eventType,
    payload,
    processedAt: new Date(),
  });

  return { duplicate: false };
};
```

**Strategy 2: Database Constraints**

Use unique constraints on event IDs in your database.

```typescript
// MongoDB schema example
const webhookEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: String,
  payload: Object,
  processedAt: Date,
});
```

### Error Recovery

Implement retry logic and error tracking.

**`server/src/services/webhookService.ts`**:
```typescript
export const processGitHubPush = async (payload: any, retryCount = 0) => {
  const MAX_RETRIES = 3;

  try {
    // Process webhook
    console.log(`Processing push to ${payload.repository.full_name}`);
    
    // Simulate processing
    await saveToDatabase(payload);
    await notifyUsers(payload);

    return { success: true };

  } catch (error) {
    console.error(`Error processing webhook (attempt ${retryCount + 1}):`, error);

    if (retryCount < MAX_RETRIES) {
      // Exponential backoff
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      return processGitHubPush(payload, retryCount + 1);
    }

    // Max retries reached, log failure
    await logWebhookFailure(payload, error);
    throw error;
  }
};

const logWebhookFailure = async (payload: any, error: any) => {
  // Store failed webhook for manual review
  await FailedWebhook.create({
    payload,
    error: error.message,
    failedAt: new Date(),
  });

  // Send alert to monitoring system
  console.error('WEBHOOK PROCESSING FAILED:', error);
};
```

---



## 5. Frontend Integration

### React Components for Webhook Events

Create React components to display webhook events in real-time.

**`client/src/types/webhook.ts`**:
```typescript
export interface WebhookEvent {
  id: string;
  eventType: string;
  provider: string;
  payload: any;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
}
```

**`client/src/components/WebhookEventList.tsx`**:
```typescript
import React, { useState, useEffect } from 'react';
import { WebhookEvent } from '../types/webhook';

export const WebhookEventList: React.FC = () => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWebhookEvents();
  }, []);

  const fetchWebhookEvents = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/webhooks/events');
      const data = await response.json();
      setEvents(data.events);
    } catch (error) {
      console.error('Failed to fetch webhook events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading webhook events...</div>;

  return (
    <div className="webhook-event-list">
      <h2>Recent Webhook Events</h2>
      {events.length === 0 ? (
        <p>No webhook events yet</p>
      ) : (
        <ul>
          {events.map(event => (
            <WebhookEventItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
};

const WebhookEventItem: React.FC<{ event: WebhookEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="webhook-event-item">
      <div className="event-header" onClick={() => setExpanded(!expanded)}>
        <span className={`status-badge ${event.status}`}>{event.status}</span>
        <span className="event-type">{event.eventType}</span>
        <span className="provider">{event.provider}</span>
        <span className="timestamp">{new Date(event.timestamp).toLocaleString()}</span>
      </div>
      {expanded && (
        <div className="event-payload">
          <pre>{JSON.stringify(event.payload, null, 2)}</pre>
        </div>
      )}
    </li>
  );
};
```

### Real-Time Updates with Polling

Implement polling to fetch new webhook events periodically.

**`client/src/hooks/useWebhookEvents.ts`**:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { WebhookEvent } from '../types/webhook';

export const useWebhookEvents = (pollInterval = 5000) => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/webhooks/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      setEvents(data.events);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();

    // Poll for new events
    const interval = setInterval(fetchEvents, pollInterval);

    return () => clearInterval(interval);
  }, [fetchEvents, pollInterval]);

  return { events, loading, error, refetch: fetchEvents };
};
```

**Usage**:
```typescript
export const WebhookDashboard: React.FC = () => {
  const { events, loading, error } = useWebhookEvents(5000);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Webhook Dashboard</h1>
      <p>Total events: {events.length}</p>
      <WebhookEventList events={events} />
    </div>
  );
};
```

### Real-Time Updates with WebSocket (Advanced)

For true real-time updates, use WebSocket.

**Install Socket.IO**:
```bash
# Server
cd server && npm install socket.io

# Client
cd client && npm install socket.io-client
```

**Server setup** (`server/src/index.ts`):
```typescript
import { Server } from 'socket.io';
import http from 'http';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});

// Emit webhook events to connected clients
export const emitWebhookEvent = (event: WebhookEvent) => {
  io.emit('webhook:new', event);
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Client setup** (`client/src/hooks/useWebhookSocket.ts`):
```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WebhookEvent } from '../types/webhook';

export const useWebhookSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('webhook:new', (event: WebhookEvent) => {
      setEvents(prev => [event, ...prev]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return { events, socket };
};
```

### Webhook Configuration UI

Allow users to register webhook URLs.

**`client/src/components/WebhookConfig.tsx`**:
```typescript
import React, { useState } from 'react';

export const WebhookConfig: React.FC = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:3001/api/webhooks/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          events,
          secret,
        }),
      });

      if (response.ok) {
        alert('Webhook registered successfully!');
      }
    } catch (error) {
      console.error('Failed to register webhook:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="webhook-config">
      <h2>Configure Webhook</h2>
      
      <label>
        Webhook URL:
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks"
          required
        />
      </label>

      <label>
        Events to subscribe:
        <select multiple value={events} onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions, option => option.value);
          setEvents(selected);
        }}>
          <option value="push">Push</option>
          <option value="pull_request">Pull Request</option>
          <option value="issues">Issues</option>
        </select>
      </label>

      <label>
        Secret (optional):
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Webhook secret for signature verification"
        />
      </label>

      <button type="submit">Register Webhook</button>
    </form>
  );
};
```

---



## 6. Environment Configuration

### Environment Variables Structure

Proper environment configuration is essential for security and flexibility.

**`server/.env`**:
```env
# Server Configuration
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Webhook Secrets
GITHUB_WEBHOOK_SECRET=your_github_secret_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_secret_here
WEBHOOK_SECRET=your_generic_webhook_secret

# Database (if using)
DATABASE_URL=mongodb://localhost:27017/webhook-app
# or
DATABASE_URL=postgresql://user:password@localhost:5432/webhook_db

# Redis (for queue processing)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# External API Keys (if needed)
STRIPE_SECRET_KEY=sk_test_your_stripe_key
GITHUB_TOKEN=ghp_your_github_token

# Logging
LOG_LEVEL=info
```

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `development`, `production` |
| `PORT` | Yes | Server port | `3001` |
| `ALLOWED_ORIGINS` | Yes | CORS allowed origins | `http://localhost:5173` |
| `GITHUB_WEBHOOK_SECRET` | No | GitHub webhook secret | `abc123...` |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook secret | `whsec_...` |
| `WEBHOOK_SECRET` | No | Generic webhook secret | `xyz789...` |
| `DATABASE_URL` | No | Database connection string | `mongodb://...` |
| `REDIS_HOST` | No | Redis host for queues | `localhost` |
| `REDIS_PORT` | No | Redis port | `6379` |
| `LOG_LEVEL` | No | Logging verbosity | `debug`, `info`, `warn`, `error` |

### .env.example Template

Create a template file for documentation and onboarding.

**`server/.env.example`**:
```env
# Server Configuration
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173

# Webhook Secrets
# Generate with: openssl rand -hex 32
GITHUB_WEBHOOK_SECRET=
STRIPE_WEBHOOK_SECRET=
WEBHOOK_SECRET=

# Database (optional)
DATABASE_URL=

# Redis (optional, for queue processing)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# External API Keys (optional)
STRIPE_SECRET_KEY=
GITHUB_TOKEN=

# Logging
LOG_LEVEL=info
```

### Loading Environment Variables

**Install dotenv**:
```bash
npm install dotenv
```

**`server/src/index.ts`** (add at the top):
```typescript
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['PORT', 'ALLOWED_ORIGINS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}
```

### Configuration Best Practices

1. **Never commit `.env` files** to version control
   - Add `.env` to `.gitignore`
   - Commit `.env.example` instead

2. **Use strong secrets**
   - Generate with `openssl rand -hex 32`
   - Minimum 32 characters
   - Use different secrets for each environment

3. **Validate environment variables on startup**
   - Check required variables exist
   - Validate format (URLs, ports, etc.)

4. **Use different secrets per environment**
   - Development: `.env.development`
   - Production: `.env.production`
   - Test: `.env.test`

5. **Rotate secrets periodically**
   - Update webhook secrets every 90 days
   - Update API keys when team members leave

---



## 7. Testing Webhooks Locally

### Exposing Local Server with ngrok

Webhook providers need a publicly accessible URL. Use ngrok to expose your local server.

**Install ngrok**:
```bash
# Download from https://ngrok.com/download
# Or use package manager
brew install ngrok  # macOS
choco install ngrok # Windows
```

**Start ngrok**:
```bash
# Expose port 3001 (your Express server)
ngrok http 3001
```

**Output**:
```
ngrok by @inconshreveable

Session Status                online
Account                       your-account (Plan: Free)
Version                       3.0.0
Region                        United States (us)
Forwarding                    https://abc123.ngrok.io -> http://localhost:3001
```

**Use the HTTPS URL** (`https://abc123.ngrok.io`) as your webhook endpoint.

**Example GitHub webhook URL**:
```
https://abc123.ngrok.io/api/webhooks/github
```

### Alternative: localtunnel

**Install localtunnel**:
```bash
npm install -g localtunnel
```

**Start tunnel**:
```bash
lt --port 3001 --subdomain my-webhook-app
```

**Output**:
```
your url is: https://my-webhook-app.loca.lt
```

### Webhook Testing Tools

#### 1. Webhook.site

Free service to inspect webhook requests.

1. Visit https://webhook.site
2. Copy your unique URL (e.g., `https://webhook.site/abc-123`)
3. Use this URL as your webhook endpoint
4. View incoming requests in real-time

**Use case**: Test webhook payload structure before implementing handler.

#### 2. RequestBin

Similar to Webhook.site.

1. Visit https://requestbin.com
2. Create a new bin
3. Use the bin URL as your webhook endpoint

#### 3. Postman

Test webhooks manually by sending POST requests.

**Example GitHub push webhook**:
```json
POST http://localhost:3001/api/webhooks/github
Headers:
  Content-Type: application/json
  X-GitHub-Event: push
  X-Hub-Signature-256: sha256=<calculated_signature>

Body:
{
  "ref": "refs/heads/main",
  "repository": {
    "name": "test-repo",
    "full_name": "user/test-repo",
    "html_url": "https://github.com/user/test-repo"
  },
  "pusher": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "commits": [
    {
      "id": "abc123",
      "message": "Test commit",
      "author": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

### Manual Testing with cURL

**Test without signature verification**:
```bash
curl -X POST http://localhost:3001/api/webhooks/generic \
  -H "Content-Type: application/json" \
  -d '{
    "event": "test.event",
    "timestamp": "2024-01-15T10:30:00Z",
    "data": {
      "message": "Test webhook"
    }
  }'
```

**Test with GitHub signature**:
```bash
# Generate signature
SECRET="your_github_secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"name":"test"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Send request
curl -X POST http://localhost:3001/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

### Unit Testing with Jest and Supertest

**Install testing dependencies**:
```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

**`server/src/__tests__/webhooks.test.ts`**:
```typescript
import request from 'supertest';
import crypto from 'crypto';
import app from '../index';

describe('Webhook Endpoints', () => {
  describe('POST /api/webhooks/generic', () => {
    it('should accept valid generic webhook', async () => {
      const response = await request(app)
        .post('/api/webhooks/generic')
        .send({
          event: 'test.event',
          timestamp: new Date().toISOString(),
          data: { message: 'Test' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid payload', async () => {
      const response = await request(app)
        .post('/api/webhooks/generic')
        .send({
          invalid: 'payload',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid payload');
    });
  });

  describe('POST /api/webhooks/github', () => {
    const secret = 'test_secret';
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    it('should accept webhook with valid signature', async () => {
      const payload = {
        ref: 'refs/heads/main',
        repository: {
          name: 'test-repo',
          full_name: 'user/test-repo',
          html_url: 'https://github.com/user/test-repo',
        },
        pusher: {
          name: 'Test User',
          email: 'test@example.com',
        },
        commits: [],
      };

      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/github')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/github')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', 'sha256=invalid')
        .send({ ref: 'refs/heads/main' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });
  });
});
```

**Run tests**:
```bash
npm test
```

### Integration Testing

Test the complete webhook flow including database operations.

**`server/src/__tests__/webhook-integration.test.ts`**:
```typescript
import request from 'supertest';
import { WebhookEvent } from '../models/WebhookEvent';
import app from '../index';

describe('Webhook Integration Tests', () => {
  beforeEach(async () => {
    // Clear database before each test
    await WebhookEvent.deleteMany({});
  });

  it('should store webhook event in database', async () => {
    const payload = {
      event: 'test.event',
      timestamp: new Date().toISOString(),
      data: { message: 'Integration test' },
    };

    await request(app)
      .post('/api/webhooks/generic')
      .send(payload);

    // Verify event was stored
    const events = await WebhookEvent.find({});
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('test.event');
  });

  it('should handle duplicate events idempotently', async () => {
    const payload = {
      event: 'test.event',
      timestamp: new Date().toISOString(),
      data: { message: 'Duplicate test' },
    };

    // Send same webhook twice
    await request(app).post('/api/webhooks/generic').send(payload);
    await request(app).post('/api/webhooks/generic').send(payload);

    // Should only store once
    const events = await WebhookEvent.find({});
    expect(events).toHaveLength(1);
  });
});
```

---



## 8. Example Webhook Implementations

### Complete GitHub Webhook Receiver

This example demonstrates a production-ready GitHub webhook receiver with signature verification, event routing, and database storage.

**`server/src/types/github.ts`**:
```typescript
import { z } from 'zod';

export const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  html_url: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
});

export const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  html_url: z.string(),
});

export const GitHubCommitSchema = z.object({
  id: z.string(),
  message: z.string(),
  timestamp: z.string(),
  url: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string().email(),
    username: z.string().optional(),
  }),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  modified: z.array(z.string()),
});

export const GitHubPushEventSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  repository: GitHubRepositorySchema,
  pusher: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  sender: GitHubUserSchema,
  commits: z.array(GitHubCommitSchema),
  head_commit: GitHubCommitSchema.nullable(),
});

export const GitHubPullRequestEventSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened', 'synchronize', 'edited']),
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    state: z.enum(['open', 'closed']),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: GitHubUserSchema,
    created_at: z.string(),
    updated_at: z.string(),
    merged: z.boolean(),
    mergeable: z.boolean().nullable(),
    head: z.object({
      ref: z.string(),
      sha: z.string(),
    }),
    base: z.object({
      ref: z.string(),
      sha: z.string(),
    }),
  }),
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema,
});

export type GitHubPushEvent = z.infer<typeof GitHubPushEventSchema>;
export type GitHubPullRequestEvent = z.infer<typeof GitHubPullRequestEventSchema>;
```

**`server/src/controllers/githubController.ts`**:
```typescript
import { Request, Response } from 'express';
import { 
  GitHubPushEventSchema, 
  GitHubPullRequestEventSchema,
  GitHubPushEvent,
  GitHubPullRequestEvent
} from '../types/github';
import { storeWebhookEvent } from '../services/webhookService';

export const handleGitHubWebhook = async (req: Request, res: Response) => {
  try {
    const eventType = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    console.log(`Received GitHub ${eventType} event (ID: ${deliveryId})`);

    switch (eventType) {
      case 'push':
        await handlePushEvent(req, res, deliveryId);
        break;

      case 'pull_request':
        await handlePullRequestEvent(req, res, deliveryId);
        break;

      case 'ping':
        res.status(200).json({ message: 'Pong! Webhook configured successfully.' });
        break;

      default:
        console.log(`Unhandled GitHub event: ${eventType}`);
        res.status(200).json({ message: 'Event received but not processed' });
    }

  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handlePushEvent = async (req: Request, res: Response, deliveryId: string) => {
  const payload: GitHubPushEvent = GitHubPushEventSchema.parse(req.body);

  const branch = payload.ref.replace('refs/heads/', '');
  const commitCount = payload.commits.length;

  console.log(`Push to ${payload.repository.full_name}/${branch}`);
  console.log(`Commits: ${commitCount}`);
  console.log(`Pusher: ${payload.pusher.name} (${payload.pusher.email})`);

  // Store event in database
  await storeWebhookEvent({
    eventId: deliveryId,
    provider: 'github',
    eventType: 'push',
    payload: payload,
    metadata: {
      repository: payload.repository.full_name,
      branch: branch,
      commitCount: commitCount,
    },
  });

  // Process commits
  for (const commit of payload.commits) {
    console.log(`  - ${commit.id.substring(0, 7)}: ${commit.message}`);
    console.log(`    Files: +${commit.added.length} ~${commit.modified.length} -${commit.removed.length}`);
  }

  res.status(200).json({ 
    success: true, 
    event: 'push',
    processed: {
      repository: payload.repository.full_name,
      branch: branch,
      commits: commitCount,
    }
  });
};

const handlePullRequestEvent = async (req: Request, res: Response, deliveryId: string) => {
  const payload: GitHubPullRequestEvent = GitHubPullRequestEventSchema.parse(req.body);

  const { action, pull_request, repository } = payload;

  console.log(`Pull request ${action}: #${pull_request.number} - ${pull_request.title}`);
  console.log(`Repository: ${repository.full_name}`);
  console.log(`Author: ${pull_request.user.login}`);
  console.log(`Branch: ${pull_request.head.ref} -> ${pull_request.base.ref}`);

  // Store event in database
  await storeWebhookEvent({
    eventId: deliveryId,
    provider: 'github',
    eventType: 'pull_request',
    payload: payload,
    metadata: {
      repository: repository.full_name,
      action: action,
      prNumber: pull_request.number,
      title: pull_request.title,
    },
  });

  // Handle specific actions
  switch (action) {
    case 'opened':
      console.log('New pull request opened - trigger CI/CD pipeline');
      // TODO: Trigger automated tests, code review, etc.
      break;

    case 'closed':
      if (pull_request.merged) {
        console.log('Pull request merged - trigger deployment');
        // TODO: Trigger deployment pipeline
      } else {
        console.log('Pull request closed without merging');
      }
      break;

    case 'synchronize':
      console.log('Pull request updated - re-run checks');
      // TODO: Re-run automated tests
      break;
  }

  res.status(200).json({ 
    success: true, 
    event: 'pull_request',
    processed: {
      repository: repository.full_name,
      action: action,
      prNumber: pull_request.number,
    }
  });
};
```

### Generic Webhook Receiver

A flexible webhook receiver that accepts any JSON payload.

**`server/src/controllers/webhookController.ts`**:
```typescript
import { Request, Response } from 'express';
import { z } from 'zod';
import { storeWebhookEvent } from '../services/webhookService';

const GenericWebhookSchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.any()),
});

export const handleGenericWebhook = async (req: Request, res: Response) => {
  try {
    // Validate basic structure
    const payload = GenericWebhookSchema.parse(req.body);

    const eventId = req.headers['x-webhook-id'] as string || 
                    crypto.randomUUID();

    console.log(`Received generic webhook: ${payload.event}`);
    console.log('Data:', JSON.stringify(payload.data, null, 2));

    // Store event
    await storeWebhookEvent({
      eventId: eventId,
      provider: 'generic',
      eventType: payload.event,
      payload: payload,
      metadata: {
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    });

    res.status(200).json({ 
      success: true,
      eventId: eventId,
      message: 'Webhook received and processed',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid payload', 
        details: error.errors 
      });
    }

    console.error('Generic webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
```

### Webhook Event Storage

Store webhook events in a database for history and debugging.

**`server/src/models/WebhookEvent.ts`** (MongoDB example):
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  provider: string;
  eventType: string;
  payload: any;
  metadata: Record<string, any>;
  processedAt: Date;
  status: 'success' | 'failed' | 'pending';
  error?: string;
}

const WebhookEventSchema = new Schema<IWebhookEvent>({
  eventId: { type: String, required: true, unique: true },
  provider: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  processedAt: { type: Date, default: Date.now, index: true },
  status: { 
    type: String, 
    enum: ['success', 'failed', 'pending'], 
    default: 'success',
    index: true 
  },
  error: { type: String },
});

// Index for querying recent events
WebhookEventSchema.index({ processedAt: -1 });

// Index for querying by provider and event type
WebhookEventSchema.index({ provider: 1, eventType: 1, processedAt: -1 });

export const WebhookEvent = mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
```

**`server/src/services/webhookService.ts`**:
```typescript
import { WebhookEvent } from '../models/WebhookEvent';

interface StoreWebhookEventParams {
  eventId: string;
  provider: string;
  eventType: string;
  payload: any;
  metadata?: Record<string, any>;
}

export const storeWebhookEvent = async (params: StoreWebhookEventParams) => {
  try {
    const event = await WebhookEvent.create({
      eventId: params.eventId,
      provider: params.provider,
      eventType: params.eventType,
      payload: params.payload,
      metadata: params.metadata || {},
      processedAt: new Date(),
      status: 'success',
    });

    console.log(`Stored webhook event: ${event.eventId}`);
    return event;

  } catch (error) {
    console.error('Failed to store webhook event:', error);
    throw error;
  }
};

export const getRecentWebhookEvents = async (limit = 50) => {
  return WebhookEvent.find()
    .sort({ processedAt: -1 })
    .limit(limit)
    .lean();
};

export const getWebhookEventsByProvider = async (provider: string, limit = 50) => {
  return WebhookEvent.find({ provider })
    .sort({ processedAt: -1 })
    .limit(limit)
    .lean();
};
```

### API Endpoint to Fetch Webhook Events

**`server/src/routes/webhooks.ts`** (add to existing file):
```typescript
import { getRecentWebhookEvents, getWebhookEventsByProvider } from '../services/webhookService';

// Get recent webhook events
router.get('/webhooks/events', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await getRecentWebhookEvents(limit);

    res.json({ 
      success: true, 
      count: events.length,
      events 
    });
  } catch (error) {
    console.error('Failed to fetch webhook events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get events by provider
router.get('/webhooks/events/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await getWebhookEventsByProvider(provider, limit);

    res.json({ 
      success: true, 
      provider,
      count: events.length,
      events 
    });
  } catch (error) {
    console.error('Failed to fetch webhook events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---



## 9. Production Considerations & Troubleshooting

### Production Deployment Checklist

Before deploying webhook endpoints to production:

#### Security
- ✅ **Signature verification enabled** for all webhook endpoints
- ✅ **HTTPS configured** (required by most webhook providers)
- ✅ **Environment variables secured** (use secrets management service)
- ✅ **Rate limiting implemented** to prevent abuse
- ✅ **CORS configured** properly for frontend access
- ✅ **Input validation** with Zod or Joi for all payloads
- ✅ **Error messages sanitized** (don't leak sensitive information)

#### Reliability
- ✅ **Idempotency handling** to prevent duplicate processing
- ✅ **Queue system** for async processing (Bull, BullMQ, or cloud queues)
- ✅ **Retry logic** with exponential backoff
- ✅ **Database transactions** for atomic operations
- ✅ **Health check endpoint** for monitoring
- ✅ **Graceful shutdown** handling

#### Monitoring
- ✅ **Logging configured** (Winston, Pino, or cloud logging)
- ✅ **Error tracking** (Sentry, Rollbar, or similar)
- ✅ **Metrics collection** (webhook count, processing time, error rate)
- ✅ **Alerting setup** for failed webhooks
- ✅ **Dashboard** for webhook activity

#### Performance
- ✅ **Database indexes** on frequently queried fields
- ✅ **Connection pooling** for database
- ✅ **Caching** for frequently accessed data
- ✅ **Load balancing** for high traffic
- ✅ **Auto-scaling** configured

### Monitoring and Logging

**Structured logging with Winston**:

```bash
npm install winston
```

**`server/src/utils/logger.ts`**:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'webhook-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;
```

**Usage in webhook handlers**:
```typescript
import logger from '../utils/logger';

export const handleGitHubWebhook = async (req: Request, res: Response) => {
  const deliveryId = req.headers['x-github-delivery'] as string;
  const eventType = req.headers['x-github-event'] as string;

  logger.info('GitHub webhook received', {
    deliveryId,
    eventType,
    repository: req.body.repository?.full_name,
  });

  try {
    // Process webhook
    await processWebhook(req.body);

    logger.info('GitHub webhook processed successfully', {
      deliveryId,
      eventType,
    });

    res.status(200).json({ success: true });

  } catch (error) {
    logger.error('GitHub webhook processing failed', {
      deliveryId,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### Common Issues and Solutions

#### Issue 1: Signature Verification Fails

**Symptoms**:
- Webhooks return 401 Unauthorized
- Error: "Invalid signature"

**Causes**:
- Wrong secret key
- Request body modified before verification
- Character encoding issues

**Solutions**:
```typescript
// Ensure raw body is preserved
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Use timing-safe comparison
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);

// Log signature details for debugging (remove in production)
console.log('Received signature:', signature);
console.log('Expected signature:', expectedSignature);
console.log('Raw body length:', rawBody.length);
```

#### Issue 2: Webhook Timeouts

**Symptoms**:
- Webhook provider shows timeout errors
- No response received within 5-10 seconds

**Causes**:
- Long-running synchronous processing
- Database queries taking too long
- External API calls blocking response

**Solutions**:
```typescript
// Use async queue for long-running tasks
export const handleWebhook = async (req: Request, res: Response) => {
  // Respond immediately
  res.status(200).json({ success: true, queued: true });

  // Process asynchronously
  await webhookQueue.add({
    eventType: req.body.event,
    payload: req.body,
  });
};

// Set timeout for external API calls
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000), // 5 second timeout
});
```

#### Issue 3: Duplicate Webhook Deliveries

**Symptoms**:
- Same event processed multiple times
- Duplicate database entries

**Causes**:
- Webhook provider retries on slow response
- Network issues causing retries
- No idempotency handling

**Solutions**:
```typescript
// Use unique event IDs
const eventId = req.headers['x-github-delivery'] as string;

// Check if already processed
const existing = await WebhookEvent.findOne({ eventId });
if (existing) {
  return res.status(200).json({ 
    success: true, 
    message: 'Event already processed' 
  });
}

// Process and store
await processWebhook(req.body);
await WebhookEvent.create({ eventId, ...data });
```

#### Issue 4: CORS Errors in Frontend

**Symptoms**:
- Frontend can't fetch webhook events
- Browser console shows CORS error

**Causes**:
- CORS not configured
- Wrong origin in CORS config

**Solutions**:
```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

#### Issue 5: High Memory Usage

**Symptoms**:
- Server crashes with out-of-memory errors
- Memory usage grows over time

**Causes**:
- Large webhook payloads stored in memory
- Memory leaks in event handlers
- No payload size limits

**Solutions**:
```typescript
// Limit request body size
app.use(express.json({ limit: '1mb' }));

// Stream large payloads to disk
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    if (buf.length > 1024 * 1024) { // > 1MB
      // Store in temporary file instead of memory
      req.rawBody = buf.toString('utf8');
    }
  }
}));

// Clean up old webhook events
const cleanupOldEvents = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await WebhookEvent.deleteMany({
    processedAt: { $lt: thirtyDaysAgo }
  });
};

// Run cleanup daily
setInterval(cleanupOldEvents, 24 * 60 * 60 * 1000);
```

### Performance Optimization

**1. Database Indexing**:
```typescript
// Index frequently queried fields
WebhookEventSchema.index({ eventId: 1 }, { unique: true });
WebhookEventSchema.index({ provider: 1, eventType: 1 });
WebhookEventSchema.index({ processedAt: -1 });
WebhookEventSchema.index({ status: 1, processedAt: -1 });
```

**2. Connection Pooling**:
```typescript
// MongoDB connection pooling
mongoose.connect(process.env.DATABASE_URL!, {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
});
```

**3. Rate Limiting**:
```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests, please try again later',
});

app.use('/api/webhooks', webhookLimiter);
```

### Scaling Considerations

**Horizontal Scaling**:
- Use load balancer (nginx, AWS ALB, etc.)
- Ensure stateless webhook handlers
- Use shared database or cache (Redis)
- Use distributed queue (AWS SQS, RabbitMQ)

**Vertical Scaling**:
- Increase server resources (CPU, RAM)
- Optimize database queries
- Use caching for frequently accessed data

**Example nginx load balancer config**:
```nginx
upstream webhook_backend {
    least_conn;
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    listen 80;
    server_name webhooks.example.com;

    location /api/webhooks {
        proxy_pass http://webhook_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Summary

This guide covered:

✅ **Webhook Fundamentals**: Understanding webhooks, flow, and use cases
✅ **Backend Implementation**: Express.js routes, payload validation, error handling
✅ **Security**: Signature verification, secret management, HTTPS, replay prevention
✅ **Handler Structure**: Controller pattern, event routing, async processing, idempotency
✅ **Frontend Integration**: React components, real-time updates, webhook configuration UI
✅ **Environment Configuration**: .env setup, variable management, best practices
✅ **Testing**: Local testing with ngrok, webhook testing tools, unit and integration tests
✅ **Example Implementations**: Complete GitHub webhook receiver, generic receiver, event storage
✅ **Production Considerations**: Deployment checklist, monitoring, troubleshooting, performance optimization

### Next Steps

1. **Implement basic webhook endpoint** following Section 2
2. **Add signature verification** following Section 3
3. **Create frontend components** following Section 5
4. **Test locally** using ngrok (Section 7)
5. **Add database storage** following Section 8
6. **Deploy to production** using checklist in Section 9

### Additional Resources

- **GitHub Webhooks Documentation**: https://docs.github.com/en/webhooks
- **Stripe Webhooks Guide**: https://stripe.com/docs/webhooks
- **Express.js Documentation**: https://expressjs.com/
- **Zod Documentation**: https://zod.dev/
- **Bull Queue Documentation**: https://github.com/OptimalBits/bull
- **ngrok Documentation**: https://ngrok.com/docs

---

**Document Version**: 1.0  
**Last Updated**: January 2024  
**Related Documents**: `react-webhook-app-setup.md`

