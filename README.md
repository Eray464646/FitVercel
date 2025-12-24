# FitVercel - Serverless Backend for FitSense AI

A Vercel serverless proxy backend that provides secure API endpoints for the FitSense AI food scanner frontend hosted on GitHub Pages. This backend uses Google's Gemini Vision API to analyze food images and return nutritional information.

## 🌟 Features

- **Secure API Proxy**: Keeps your Gemini API key safe on the server
- **CORS Protection**: Strict allowlist for GitHub Pages origin only
- **Rate Limiting**: Basic IP-based rate limiting (10 requests/minute)
- **Image Analysis**: Powered by Gemini 1.5 Flash for fast, accurate food detection
- **Structured JSON Output**: Returns nutritional data (calories, protein, carbs, fat)
- **Health Check Endpoint**: Monitor API status and configuration

## 📁 Project Structure

```
FitVercel/
├── api/
│   └── food-scan/
│       ├── health.js      # Health check endpoint
│       └── index.js       # Main food scan endpoint
├── package.json           # Node.js project configuration
├── vercel.json           # Vercel deployment configuration
└── README.md             # This file
```

## 🚀 Deployment Guide

### Step 1: Import to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import the `Eray464646/FitVercel` repository from GitHub
4. Vercel will auto-detect the configuration
5. Click **"Deploy"**

### Step 2: Configure Environment Variables

After deployment, you need to set the Gemini API key:

1. In your Vercel project dashboard, go to **"Settings"** → **"Environment Variables"**
2. Add a new variable:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))
   - **Environment**: Production, Preview, Development (select all)
3. Click **"Save"**
4. **Redeploy** your project for the changes to take effect

### Step 3: Get Your API URL

After deployment, Vercel will provide a URL like:
```
https://fit-vercel-xyz.vercel.app
```

This is your base URL for API requests.

## 📡 API Endpoints

### Health Check

**Endpoint**: `GET /api/food-scan/health`

**Description**: Check if the API is running and properly configured.

**Response**:
```json
{
  "ok": true,
  "provider": "gemini",
  "configured": true
}
```

**Example**:
```bash
curl https://your-app.vercel.app/api/food-scan/health
```

### Food Scan

**Endpoint**: `POST /api/food-scan`

**Description**: Analyze a food image and return nutritional information.

**Request Body**:
```json
{
  "imageBase64": "base64-encoded-image-data",
  "mimeType": "image/jpeg"
}
```

**Notes**:
- `imageBase64`: Can be pure base64 or data URL (e.g., `data:image/jpeg;base64,...`)
- `mimeType`: Must be `image/jpeg` or `image/png`
- Maximum image size: 10MB

**Response**:
```json
{
  "detected": true,
  "items": [
    {
      "name": "Apple",
      "quantity": "1 medium",
      "confidence": 95,
      "calories": 95,
      "protein": 0.5,
      "carbs": 25,
      "fat": 0.3
    }
  ],
  "totals": {
    "calories": 95,
    "protein": 0.5,
    "carbs": 25,
    "fat": 0.3
  },
  "notes": "Fresh apple detected with high confidence"
}
```

**Example**:
```bash
# Using a test image (you'll need to replace with actual base64)
curl -X POST https://your-app.vercel.app/api/food-scan \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "YOUR_BASE64_IMAGE_DATA",
    "mimeType": "image/jpeg"
  }'
```

## 🔧 Testing

### Test Health Check
```bash
# Replace with your Vercel URL
curl https://your-app.vercel.app/api/food-scan/health
```

Expected output:
```json
{"ok":true,"provider":"gemini","configured":true}
```

### Test Food Scan with Sample Image

To test with a real image, you can use this approach:

```bash
# Convert an image to base64 (on macOS/Linux)
base64 -i your-food-image.jpg | tr -d '\n' > image.b64

# Send the request
curl -X POST https://your-app.vercel.app/api/food-scan \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$(cat image.b64)\",\"mimeType\":\"image/jpeg\"}"
```

Or use a data URL:
```bash
# With data URL prefix
DATA_URL="data:image/jpeg;base64,$(base64 -i your-food-image.jpg | tr -d '\n')"

curl -X POST https://your-app.vercel.app/api/food-scan \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$DATA_URL\",\"mimeType\":\"image/jpeg\"}"
```

## 🌐 Frontend Integration

### Configuration

In your FitSense AI frontend (hosted on GitHub Pages), configure the API base URL:

```javascript
// config.js or similar
const API_BASE_URL = 'https://your-app.vercel.app';

// Health check
fetch(`${API_BASE_URL}/api/food-scan/health`)
  .then(res => res.json())
  .then(data => console.log('API Status:', data));

// Food scan
async function scanFood(imageBase64, mimeType) {
  const response = await fetch(`${API_BASE_URL}/api/food-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      imageBase64,
      mimeType
    })
  });
  
  return await response.json();
}
```

### CORS Configuration

The API is configured to accept requests **only** from:
- `https://eray464646.github.io`

If you need to test from localhost during development, you'll need to temporarily modify the `ALLOWED_ORIGIN` constant in the API files, or use browser extensions to bypass CORS for testing.

## 🔒 Security Features

1. **Environment Variables**: API keys are stored securely in Vercel environment variables, never in code
2. **CORS Allowlist**: Only the specified GitHub Pages origin can access the API
3. **Rate Limiting**: 10 requests per minute per IP address
4. **Input Validation**: Validates image type, size, and format
5. **Error Handling**: No sensitive information leaked in error messages

## 🛠️ Rate Limits

- **10 requests per minute** per IP address
- Returns `429 Too Many Requests` with `Retry-After: 60` header when exceeded
- Rate limiting is best-effort (in-memory) for serverless environments

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key from AI Studio |

## 📝 Local Development

To run locally with Vercel CLI:

```bash
# Install Vercel CLI
npm install -g vercel

# Clone the repository
git clone https://github.com/Eray464646/FitVercel.git
cd FitVercel

# Create .env file with your API key
echo "GEMINI_API_KEY=your-api-key-here" > .env

# Run development server
vercel dev
```

The API will be available at `http://localhost:3000`

## 🐛 Troubleshooting

### "API not configured" error
- Ensure `GEMINI_API_KEY` is set in Vercel environment variables
- Redeploy after adding environment variables

### CORS errors
- Verify requests are coming from `https://eray464646.github.io`
- Check browser console for specific CORS error messages

### Rate limit exceeded
- Wait 60 seconds before retrying
- Consider implementing caching in your frontend

### "Image too large" error
- Resize images before sending (recommend max 1024x1024 pixels)
- Compress JPEG images to reduce file size

## 📄 License

MIT

## 🤝 Contributing

This is a backend-only serverless proxy. For the frontend application, see the FitSense AI repository.

---

**Built with ❤️ for FitSense AI**