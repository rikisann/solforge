import { Request, Response, NextFunction } from 'express';
import { BuildIntent, NaturalLanguageIntent, MultiBuildIntent, DecodeRequest, EstimateRequest } from '../utils/types';

// Rate limiting store (in-memory for MVP, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 100
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }

    const clientData = rateLimitStore.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // New window
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }

    clientData.count++;
    next();
  };
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('API Error:', error);

  // Handle specific error types
  if (error.message.includes('Invalid public key')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid wallet address provided'
    });
  }

  if (error.message.includes('Insufficient funds')) {
    return res.status(400).json({
      success: false,
      error: 'Insufficient funds for transaction'
    });
  }

  if (error.message.includes('Jupiter')) {
    return res.status(502).json({
      success: false,
      error: 'External swap service unavailable'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : error.message
  });
}

export function validateBuildIntent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { intent, params, payer } = req.body as BuildIntent;

  if (!intent || typeof intent !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Intent is required and must be a string'
    });
  }

  if (!params || typeof params !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Params is required and must be an object'
    });
  }

  if (!payer || typeof payer !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Payer wallet address is required'
    });
  }

  // Validate wallet address format (basic check)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payer)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer wallet address format'
    });
  }

  next();
}

export function validateNaturalIntent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { prompt, payer } = req.body as NaturalLanguageIntent;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required and must be a non-empty string'
    });
  }

  if (prompt.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Prompt too long. Maximum 500 characters allowed.'
    });
  }

  if (!payer || typeof payer !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Payer wallet address is required'
    });
  }

  // Validate wallet address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payer)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer wallet address format'
    });
  }

  next();
}

export function corsHeaders(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}

export function validateMultiBuildIntent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { intents, payer } = req.body as MultiBuildIntent;

  if (!intents || !Array.isArray(intents) || intents.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Intents is required and must be a non-empty array'
    });
  }

  if (intents.length > 20) { // Reasonable limit for atomic transactions
    return res.status(400).json({
      success: false,
      error: 'Too many intents. Maximum 20 intents allowed per transaction.'
    });
  }

  // Validate each intent
  for (let i = 0; i < intents.length; i++) {
    const intent = intents[i];
    
    if (!intent.intent || typeof intent.intent !== 'string') {
      return res.status(400).json({
        success: false,
        error: `Intent ${i + 1}: intent field is required and must be a string`
      });
    }

    if (!intent.params || typeof intent.params !== 'object') {
      return res.status(400).json({
        success: false,
        error: `Intent ${i + 1}: params field is required and must be an object`
      });
    }
  }

  if (!payer || typeof payer !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Payer wallet address is required'
    });
  }

  // Validate wallet address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payer)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer wallet address format'
    });
  }

  next();
}

export function validateDecodeRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { transaction } = req.body as DecodeRequest;

  if (!transaction || typeof transaction !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Transaction is required and must be a base64 string'
    });
  }

  // Basic base64 validation
  try {
    Buffer.from(transaction, 'base64');
  } catch {
    return res.status(400).json({
      success: false,
      error: 'Invalid base64 transaction data'
    });
  }

  next();
}

export function validateEstimateRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { intent, intents, payer } = req.body as EstimateRequest;

  if (!intent && !intents) {
    return res.status(400).json({
      success: false,
      error: 'Either intent or intents must be provided'
    });
  }

  if (intent && intents) {
    return res.status(400).json({
      success: false,
      error: 'Provide either intent or intents, not both'
    });
  }

  if (intents && (!Array.isArray(intents) || intents.length === 0)) {
    return res.status(400).json({
      success: false,
      error: 'Intents must be a non-empty array when provided'
    });
  }

  if (!payer || typeof payer !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Payer wallet address is required'
    });
  }

  // Validate wallet address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payer)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer wallet address format'
    });
  }

  next();
}

// Enhanced request logging middleware with sensitive data redaction
export function logRequests(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Log request
  const timestamp = new Date().toISOString();
  const redactedBody = redactSensitiveData(req.body);
  
  console.log(`[${timestamp}] ${req.method} ${req.path}`, {
    body: redactedBody,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
}

function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = ['privateKey', 'secret', 'password', 'token', 'key'];
  const redacted = { ...data };

  for (const field of sensitiveFields) {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  }

  // Recursively redact nested objects
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    }
  }

  return redacted;
}