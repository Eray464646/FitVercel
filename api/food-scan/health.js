/**
 * Health Check Endpoint
 * GET /api/food-scan/health
 * 
 * Returns the status of the API and whether it's properly configured.
 */

const ALLOWED_ORIGIN = 'https://eray464646.github.io';

/**
 * Set CORS headers for the allowed origin
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

/**
 * Main handler function
 */
export default function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check if API key is configured
  const isConfigured = Boolean(process.env.GEMINI_API_KEY);

  // Return health status
  res.status(200).json({
    ok: true,
    provider: 'gemini',
    configured: isConfigured
  });
}
