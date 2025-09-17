# OpenAI-Compatible API Worker

A Cloudflare Worker that exposes Cloudflare AI models through an OpenAI-compatible API interface with built-in documentation and API specification.

## ✨ Features

- ✅ **OpenAI API-compatible endpoints** (`/v1/chat/completions`, `/v1/models`, `/v1/completions`)
- ✅ **Interactive documentation** - Full API testing interface with chat functionality
- ✅ **Static asset hosting** - Landing page and OpenAPI spec served via Cloudflare Assets
- ✅ **Built-in API tester** - Test all endpoints directly from the web interface
- ✅ **Chat interface** - Interactive chat with streaming support
- ✅ **OpenAPI specification** - Complete API documentation at `/openapi.json`
- ✅ **Multi-modal support** - Text generation and image recognition
- ✅ **Streaming responses** - Real-time response streaming
- ✅ **Multiple model support** - Primary and backup models with automatic fallback
- ✅ **CORS support** - Ready for web applications
- ✅ **Authentication** - API key-based security
- ✅ **Comprehensive logging** - Debug logging and monitoring
- ✅ **Health monitoring** - Built-in health check endpoint

## 📁 Project Structure

```
openai-api-worker/
├── src/
│   └── index.js           # Main worker with OpenAI API compatibility
├── static/
│   ├── index.html         # Interactive documentation landing page
│   └── openapi.json       # Complete OpenAPI 3.0 specification
├── .dev.vars              # Development environment variables
├── .gitignore             # Git ignore rules
├── README.md              # Complete documentation
├── deploy.sh              # Deployment script
├── package.json           # NPM configuration
├── test.sh                # API testing script
└── wrangler.toml          # Cloudflare Worker config with ASSETS binding
```

## 🤖 Default Models

- **Primary**: `@cf/meta/llama-4-scout-17b-16e-instruct`
- **Backup**: `@cf/openai/gpt-oss-120b`

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

#### Development (.dev.vars)
```bash
# Set your custom worker API key for local development
WORKER_API_KEY=your-custom-worker-api-key-here
```

#### Production
```bash
# Deploy the worker
npm run deploy
# or
./deploy.sh

# Set the worker API key as a secret (first time only)
wrangler secret put WORKER_API_KEY
```

### 3. Deploy

#### Development
```bash
npm run dev
```
Visit http://localhost:8787 to see the documentation

**Interactive Features:**
- 🧪 **API Tester** - Test all endpoints with your API key
- 💬 **Chat Interface** - Interactive chat with streaming support
- 📊 **Real-time Monitoring** - Connection status and response visualization
- 📋 **Endpoint Explorer** - Test `/v1/models`, `/v1/chat/completions`, and `/v1/completions`

#### Production
```bash
npm run deploy
```

### 4. GitHub Setup (Optional)

```bash
# Install GitHub CLI (if not already installed)
brew install gh

# Authenticate with GitHub
gh auth login

# Create and push to GitHub repository
./setup-github.sh
```

**Manual GitHub Setup:**
1. Create a new repository on GitHub
2. Add the remote: `git remote add origin https://github.com/yourusername/openai-api-worker.git`
3. Push the code: `git push -u origin main`

## 🔗 API Endpoints

### Public Endpoints (No Authentication)

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/` | GET | Interactive documentation landing page |
| `/openapi.json` | GET | Complete OpenAPI 3.0 specification |
| `/health` | GET | Service health status |

### API Endpoints (Require Authentication)

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/v1/chat/completions` | POST | Create chat completions (streaming & non-streaming) |
| `/v1/models` | GET | List available models |
| `/v1/completions` | POST | Legacy completion endpoint |

## 📖 Usage Examples

### Authentication

Include your worker API key in the Authorization header:

```bash
Authorization: Bearer your-worker-api-key-here
```

### Chat Completions

```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-worker-api-key" \\
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

### With Image Recognition

```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-worker-api-key" \\
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "What do you see in this image?"},
          {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
        ]
      }
    ]
  }'
```

### Streaming Response

```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-worker-api-key" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

### JavaScript/Node.js

```javascript
const response = await fetch('https://your-worker.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-worker-api-key'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Explain quantum computing' }
    ],
    max_tokens: 500,
    temperature: 0.7
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### Python

```python
import requests

response = requests.post(
    'https://your-worker.workers.dev/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-worker-api-key'
    },
    json={
        'model': 'gpt-4',
        'messages': [
            {'role': 'user', 'content': 'Explain quantum computing'}
        ],
        'max_tokens': 500,
        'temperature': 0.7
    }
)

print(response.json()['choices'][0]['message']['content'])
```

## 🔄 OpenAI Model Mapping

The worker maps OpenAI model names to Cloudflare models:

- `gpt-4` → `@cf/meta/llama-4-scout-17b-16e-instruct`
- `gpt-4-turbo` → `@cf/meta/llama-4-scout-17b-16e-instruct`
- `gpt-4o` → `@cf/meta/llama-4-scout-17b-16e-instruct`
- `gpt-3.5-turbo` → `@cf/openai/gpt-oss-120b`
- `gpt-4o-mini` → `@cf/openai/gpt-oss-120b`

You can also use Cloudflare model names directly.

## ⚙️ Configuration

### Environment Variables

- `DEFAULT_MODEL`: Primary model to use (default: `@cf/meta/llama-4-scout-17b-16e-instruct`)
- `BACKUP_MODEL`: Fallback model (default: `@cf/openai/gpt-oss-120b`)
- `WORKER_API_KEY`: Custom API key for authentication (set as secret)

### Model Fallback

If the primary model fails, the worker automatically tries the backup model.

## 🔍 Testing

Run the comprehensive test suite:

```bash
# Test local development server
./test.sh

# Test deployed worker
./test.sh https://your-worker.workers.dev your-worker-api-key
```

The test script will verify:
- Landing page accessibility
- OpenAPI specification
- Health check endpoint
- Model listing
- Chat completions (streaming and non-streaming)
- Authentication
- Error handling

## 📊 Monitoring & Debugging

### Viewing Logs

```bash
# View live logs
npm run logs
# or
./logs.sh

# Alternative: direct wrangler command
npm run tail
# or
wrangler tail --format=pretty
```

### Debug Logging

The worker includes comprehensive debug logging:

- **Development**: Debug logging is enabled by default (`DEBUG_LOGGING=true`)
- **Production**: Debug logging is disabled for performance (`DEBUG_LOGGING=false`)
- **Authentication**: Logs API key validation attempts  
- **AI Requests**: Tracks model selection and API calls
- **Errors**: Detailed error logging with stack traces

### Health Check

```bash
curl https://your-worker.workers.dev/health
```

Returns:
```json
{
  "status": "healthy",
  "service": "openai-api-worker",
  "timestamp": "2024-09-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Error Handling

The API returns proper HTTP status codes and error messages:

- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Invalid or missing API key
- `404`: Endpoint not found
- `500`: Internal server error

Example error response:
```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error"
  }
}
```

## 🛠 Development

### Local Development

```bash
# Start development server
npm run dev

# Test the API
curl -X POST http://localhost:8787/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer test-key" \\
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'
```

### Deployment

```bash
# Deploy to production
npm run deploy

# View logs
npm run tail

# Quick deploy with secret setup
./deploy.sh
```

## 🌐 Documentation

Once deployed, your worker provides:

- **Interactive Documentation**: Visit your worker's URL (e.g., `https://your-worker.workers.dev`) for a beautiful, interactive documentation page
- **OpenAPI Specification**: Available at `/openapi.json` for integration with API tools like Postman, Insomnia, or swagger-ui
- **Health Monitoring**: Use `/health` for uptime monitoring and status checks

## 🎯 Use Cases

- **Drop-in OpenAI API replacement** - Use existing OpenAI SDKs and tools
- **Edge AI applications** - Low-latency responses via Cloudflare's global network
- **Cost-effective AI** - Leverage Cloudflare's competitive pricing
- **Multi-modal applications** - Build apps that handle both text and images
- **Streaming chat apps** - Real-time conversation interfaces
- **API proxy/gateway** - Add caching, rate limiting, or custom logic

## 🔧 Advanced Configuration

### Static Asset Management

The worker uses Cloudflare's ASSETS binding to serve static files efficiently:

- **Landing page**: `static/index.html` - Interactive documentation
- **OpenAPI spec**: `static/openapi.json` - Complete API specification
- **Performance**: Static assets are cached at the edge for optimal performance
- **Updates**: Modify files in the `static/` directory and redeploy

### Custom Model Configuration

You can override the default models by setting environment variables:

```toml
# wrangler.toml
[vars]
DEFAULT_MODEL = "@cf/your/custom-model"
BACKUP_MODEL = "@cf/your/backup-model"
```

### CORS Configuration

CORS is enabled by default for all origins. To restrict access, modify the `corsHeaders` in `src/index.js`:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

## 🐛 Troubleshooting

### Common Issues

1. **API Key Authentication Fails**
   - For production, set up the `WORKER_API_KEY` secret: `wrangler secret put WORKER_API_KEY`
   - For development, the API key check is bypassed automatically
   - Check that the Authorization header format is correct: `Bearer <token>`

2. **Model Not Found**
   - Verify the model names in your Cloudflare AI account
   - Check the model mapping in the code

3. **CORS Issues**
   - Ensure CORS headers are properly configured
   - Check that preflight OPTIONS requests are handled

### Debug Mode

Enable debug logging by checking the Cloudflare Workers dashboard logs or using:

```bash
wrangler tail --format=pretty
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Powered by [Cloudflare Workers](https://workers.cloudflare.com/) 🔥**
