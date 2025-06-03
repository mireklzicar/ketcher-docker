# Ketcher Docker - Chemical Structure Editor

A production-ready Vite-based application that embeds the Ketcher chemical structure editor with full iframe communication support.

## Features

- ⚛️ React 19 + TypeScript + Vite
- 🧪 Ketcher 3.2.0 chemical structure editor
- 🔌 Full iframe communication via postMessage API
- 🏗️ Standalone mode (no backend required)
- 📱 Responsive design
- 🚀 Production-ready build

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Iframe Integration

### Basic Usage

```html
<iframe 
  id="ketcher-iframe" 
  src="http://localhost:5173/" 
  width="800" 
  height="600"
  title="Ketcher Chemical Editor">
</iframe>
```

### Communication API

The Ketcher iframe communicates via `postMessage`. All communication is bidirectional and asynchronous.

#### Send Messages to Ketcher

```javascript
const iframe = document.getElementById('ketcher-iframe');

// Set a molecule from SMILES
iframe.contentWindow.postMessage({
  type: 'setMolecule',
  payload: 'CCO'  // SMILES string
}, '*');

// Get current SMILES
iframe.contentWindow.postMessage({
  type: 'getSmiles'
}, '*');

// Clear the editor
iframe.contentWindow.postMessage({
  type: 'clear'
}, '*');
```

#### Listen for Messages from Ketcher

```javascript
window.addEventListener('message', (event) => {
  const { type, payload, smiles } = event.data;
  
  switch (type) {
    case 'init':
      console.log('Ketcher initialized');
      break;
      
    case 'smiles':
      console.log('SMILES received:', payload);
      break;
      
    case 'smiles-update':
      console.log('SMILES updated:', smiles);
      break;
      
    case 'moleculeSet':
      console.log('Molecule set successfully');
      break;
      
    case 'cleared':
      console.log('Editor cleared');
      break;
      
    case 'error':
      console.error('Ketcher error:', event.data.error);
      break;
  }
});
```

## Message Types

### Incoming (to Ketcher)
- `setMolecule` / `set-molecule`: Set molecule from SMILES
- `getSmiles` / `get-smiles`: Request current SMILES
- `clear`: Clear the editor

### Outgoing (from Ketcher)
- `init`: Ketcher initialized and ready
- `smiles`: Response to getSmiles request
- `smiles-update`: Automatic SMILES updates when structure changes
- `moleculeSet`: Confirmation that molecule was set
- `cleared`: Confirmation that editor was cleared
- `error`: Error occurred during operation

## Configuration

### Environment Variables

- `VITE_API_PATH`: Custom API endpoint (fallback for remote mode)
- `PUBLIC_URL`: Base URL for static resources

### CORS Headers

The application is configured to allow iframe embedding from any origin. For production, consider restricting origins in `vite.config.ts`:

```typescript
server: {
  headers: {
    'Access-Control-Allow-Origin': 'https://yourdomain.com',
    // ... other headers
  },
}
```

## Deployment

The application is designed to be deployed as a static site. It includes:

- Standalone Ketcher service (no backend required)
- Optimized production build
- Proper CORS headers for iframe embedding
- Error handling and fallbacks

### Docker Deployment

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

### Static Hosting

The built application in `dist/` can be deployed to any static hosting service (Vercel, Netlify, AWS S3, etc.).

## Development

### Project Structure

```
src/
├── App.tsx          # Main Ketcher component with iframe communication
├── utils.ts         # Ketcher service provider setup
├── main.tsx         # Application entry point
├── index.css        # Global styles
└── vite-env.d.ts    # Vite type definitions
```

### Key Files

- **App.tsx**: Contains all iframe communication logic and Ketcher initialization
- **utils.ts**: Handles Ketcher standalone service provider setup
- **vite.config.ts**: Build configuration with CORS headers

## License

This project uses Ketcher, which is licensed under the Apache License 2.0.
