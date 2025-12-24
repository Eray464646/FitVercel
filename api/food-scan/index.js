/**
 * Food Scan Endpoint
 * POST /api/food-scan
 * 
 * Accepts an image and uses Gemini Vision API to detect food items,
 * calculate nutritional information, and return structured JSON.
 */

const ALLOWED_ORIGIN = 'https://eray464646.github.io';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-1.5-flash';

// Rate limiting: Simple in-memory store (best-effort for serverless)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Set CORS headers for the allowed origin
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

/**
 * Clean up old rate limit entries
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(ip);
    }
  }
}

/**
 * Check rate limit for an IP address
 * Returns true if rate limit exceeded
 */
function isRateLimited(ip) {
  cleanupRateLimitStore();
  
  const now = Date.now();
  const clientData = rateLimitStore.get(ip);

  if (!clientData) {
    rateLimitStore.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  // Check if we're still in the same window
  if (now - clientData.windowStart < RATE_LIMIT_WINDOW) {
    if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
      return true;
    }
    clientData.count++;
    return false;
  }

  // New window
  clientData.windowStart = now;
  clientData.count = 1;
  return false;
}

/**
 * Get client IP address
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * Strip data URL prefix from base64 string
 */
function stripDataUrlPrefix(imageBase64) {
  if (!imageBase64) return '';
  
  // Remove "data:image/jpeg;base64," or similar prefix
  const dataUrlMatch = imageBase64.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
  if (dataUrlMatch) {
    return dataUrlMatch[1];
  }
  
  return imageBase64;
}

/**
 * Validate image payload
 */
function validateImagePayload(imageBase64, mimeType) {
  const errors = [];

  // Validate mimeType
  const allowedMimeTypes = ['image/jpeg', 'image/png'];
  if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
    errors.push(`Invalid mimeType. Allowed: ${allowedMimeTypes.join(', ')}`);
  }

  // Validate imageBase64 exists
  if (!imageBase64) {
    errors.push('imageBase64 is required');
  }

  // Strip prefix and validate size (rough estimate: base64 is ~4/3 of original size)
  const cleanBase64 = stripDataUrlPrefix(imageBase64);
  const estimatedSizeBytes = (cleanBase64.length * 3) / 4;
  const maxSizeMB = 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (estimatedSizeBytes > maxSizeBytes) {
    errors.push(`Image too large. Max size: ${maxSizeMB}MB`);
  }

  return { valid: errors.length === 0, errors, cleanBase64 };
}

/**
 * Call Gemini Vision API
 */
async function callGeminiVision(imageBase64, mimeType, apiKey) {
  const prompt = `Analyze this food image and return ONLY a valid JSON object (no markdown, no code blocks).

Detect ALL food items visible in the image. For each item provide:
- name: food item name
- quantity: estimated amount (e.g., "1 cup", "2 slices", "100g")
- confidence: detection confidence (0-100)
- calories: estimated calories (best effort)
- protein: grams of protein (best effort)
- carbs: grams of carbohydrates (best effort)
- fat: grams of fat (best effort)

Return the JSON in this exact structure:
{
  "detected": true or false,
  "items": [
    {
      "name": "food name",
      "quantity": "amount",
      "confidence": 85,
      "calories": 150,
      "protein": 5,
      "carbs": 20,
      "fat": 6
    }
  ],
  "totals": {
    "calories": sum of all items,
    "protein": sum,
    "carbs": sum,
    "fat": sum
  },
  "notes": "any relevant observations or uncertainties"
}

If you are uncertain about nutritional values, provide your best estimate and note the uncertainty in "notes".
Only set "detected" to false if you are confident there is NO food in the image.
If you see food but are uncertain about details, still set "detected" to true with low confidence values.`;

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 2048
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  return await response.json();
}

/**
 * Parse Gemini response and extract JSON
 */
function parseGeminiResponse(geminiResponse) {
  try {
    // Extract text from Gemini response
    const candidates = geminiResponse.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates in Gemini response');
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error('No parts in Gemini response');
    }

    let textContent = parts[0]?.text || '';
    
    // Remove markdown code blocks if present
    textContent = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Try to find JSON object in the text
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }

    const parsedJson = JSON.parse(jsonMatch[0]);
    
    // Validate basic structure
    if (typeof parsedJson.detected === 'undefined') {
      parsedJson.detected = true;
    }
    if (!Array.isArray(parsedJson.items)) {
      parsedJson.items = [];
    }

    return parsedJson;
  } catch (error) {
    // Return fallback JSON if parsing fails
    return {
      detected: true,
      items: [],
      notes: 'Model returned non-JSON output; please confirm manually.',
      parseError: error.message
    };
  }
}

/**
 * Main handler function
 */
export default async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Check if API is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'API not configured',
        message: 'GEMINI_API_KEY environment variable is not set'
      });
      return;
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute allowed`
      });
      return;
    }

    // Parse request body
    const { imageBase64, mimeType } = req.body;

    // Validate input
    const validation = validateImagePayload(imageBase64, mimeType);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid request',
        details: validation.errors
      });
      return;
    }

    // Call Gemini Vision API
    const geminiResponse = await callGeminiVision(
      validation.cleanBase64,
      mimeType,
      apiKey
    );

    // Parse and structure the response
    const result = parseGeminiResponse(geminiResponse);

    // Return successful response
    res.status(200).json(result);

  } catch (error) {
    console.error('Error processing food scan:', error);

    // Determine appropriate error response
    if (error.message.includes('Gemini API error')) {
      res.status(502).json({
        error: 'External API error',
        message: error.message
      });
    } else if (error.message.includes('fetch')) {
      res.status(500).json({
        error: 'Network error',
        message: 'Failed to connect to Gemini API'
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }
}
