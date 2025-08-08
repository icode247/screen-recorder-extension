# CursorFlow - Intelligent Screen Recording Extension

> **A powerful Chrome extension for creating engaging screen recordings with automatic cursor-following zoom effects**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.0.0-green)](https://github.com/cursorflow/cursorflow-extension)

## ✨ Features

- **🎯 Intelligent Auto-Zoom** - Automatically follows your cursor with smooth zoom transitions
- **🎬 High-Quality Recording** - Support for 720p to 4K recording with customizable frame rates
- **⚡ Real-Time Processing** - Live preview with WebCodecs API and Canvas fallback
- **🎨 Professional Editing** - Built-in timeline editor with zoom customization
- **📱 Cross-Platform** - Works on all Chromium-based browsers
- **🔒 Privacy-First** - All processing happens locally, no data sent to servers
- **💾 Flexible Export** - Multiple formats (MP4, WebM) with quality options

## 🚀 Quick Start

### Installation

1. **From Chrome Web Store** (Coming Soon)
   - Visit the [Chrome Web Store listing](https://chrome.google.com/webstore)
   - Click "Add to Chrome"

2. **Developer Installation**
   ```bash
   git clone https://github.com/cursorflow/cursorflow-extension.git
   cd cursorflow-extension
   npm install
   npm run build
   ```
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### Basic Usage

1. **Start Recording**
   - Click the CursorFlow icon in your browser toolbar
   - Choose your recording settings (quality, frame rate, zoom level)
   - Click "Start Recording" and select what to share
   - Begin demonstrating - the camera will automatically follow your cursor

2. **Stop & Edit**
   - Click "Stop Recording" when finished
   - Your recording opens automatically in the built-in editor
   - Adjust zoom timing, add transitions, or trim clips

3. **Export & Share**
   - Choose your export format and quality
   - Download your polished video
   - Share directly or upload to your platform of choice

## 🛠️ Development

### Prerequisites

- **Node.js** 16.0.0 or higher
- **npm** 8.0.0 or higher
- **Chrome** 88 or higher (for development and testing)

### Setup

```bash
# Clone the repository
git clone https://github.com/cursorflow/cursorflow-extension.git
cd cursorflow-extension

# Install dependencies
npm install

# Start development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
cursorflow-extension/
├── src/
│   ├── background/           # Service worker & core logic
│   │   ├── service-worker.js
│   │   ├── recording-manager.js
│   │   ├── project-manager.js
│   │   └── storage-manager.js
│   ├── content/              # Content scripts
│   │   └── cursor-tracker.js
│   ├── popup/                # Extension popup UI
│   │   ├── popup.html
│   │   └── popup.js
│   └── editor/               # Video editor (React app)
│       ├── components/
│       ├── utils/
│       └── index.tsx
├── assets/                   # Icons and static files
├── manifest.json            # Extension manifest
└── webpack.config.js        # Build configuration
```

### Key Technologies

- **Extension Framework**: Chrome Extension Manifest V3
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Video Processing**: WebCodecs API with MediaRecorder fallback
- **Advanced Export**: FFmpeg.wasm for additional formats
- **Storage**: Chrome Storage API with local-first approach
- **Build Tool**: Webpack 5 with hot reload

## 🎯 Architecture

### Recording Pipeline

1. **Capture Setup**
   - Service worker handles desktopCapture permissions
   - Content script initializes MediaRecorder with optimal settings
   - Cursor tracking begins with throttled event collection

2. **Real-Time Processing**
   - Mouse events are timestamped and stored
   - Video chunks are collected and temporarily stored
   - Zoom calculations happen in real-time based on cursor movement

3. **Post-Processing**
   - Timeline generation from cursor events
   - Video segment combination with zoom transforms
   - Canvas-based rendering for smooth zoom transitions

### Data Flow

```
User Action → Content Script → Service Worker → Storage
     ↓              ↓              ↓             ↓
UI Update ← Popup Interface ← Background Processing ← Project Data
```

## 🔧 Configuration

### Recording Settings

```javascript
{
  quality: 'high',        // 'low' | 'medium' | 'high' | 'ultra'
  fps: 30,               // 24 | 30 | 60
  autoZoom: true,        // Enable automatic zoom following
  zoomLevel: 2.0,        // 1.5x to 4.0x zoom multiplier
  zoomDuration: 300,     // Zoom transition duration (ms)
  exportFormat: 'mp4'    // 'mp4' | 'webm'
}
```

### Advanced Options

- **Cursor Sensitivity**: Adjust how responsive zoom follows cursor movement
- **Zoom Smoothing**: Control acceleration curves for zoom transitions  
- **Quality Presets**: Custom bitrate and resolution combinations
- **Export Profiles**: Predefined settings for different use cases

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm test -- --testNamePattern="Recording"
```

### Test Coverage

- **Unit Tests**: Core recording logic, data management
- **Integration Tests**: Extension messaging, storage operations
- **E2E Tests**: Complete recording workflows
- **Performance Tests**: Memory usage, processing efficiency

## 📚 API Reference

### Background Script API

```javascript
// Start recording
chrome.runtime.sendMessage({
  action: 'START_RECORDING',
  data: { quality: 'high', fps: 30 }
});

// Stop recording
chrome.runtime.sendMessage({
  action: 'STOP_RECORDING',
  data: { sessionId: 'session_123' }
});
```

### Content Script Events

```javascript
// Cursor tracking events
{
  type: 'mousemove',
  x: 450,
  y: 300,
  timestamp: 1634567890123,
  target: { tagName: 'button', className: 'primary' }
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Style

- **ESLint** configuration with React and TypeScript rules
- **Prettier** for consistent formatting
- **Conventional Commits** for clear commit messages
- **TypeScript** for type safety

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Cursorful** - Inspiration for cursor-following video recording
- **Chrome DevTools** - Excellent extension development tools
- **React Community** - Amazing frontend framework and ecosystem
- **FFmpeg** - Powerful video processing capabilities

## 📞 Support

- **Documentation**: [docs.cursorflow.dev](https://docs.cursorflow.dev)
- **Issues**: [GitHub Issues](https://github.com/cursorflow/cursorflow-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cursorflow/cursorflow-extension/discussions)
- **Email**: [support@cursorflow.dev](mailto:support@cursorflow.dev)

## 🗺️ Roadmap

### Version 1.1
- [ ] Desktop app wrapper (Tauri)
- [ ] Advanced zoom easing options
- [ ] Batch export functionality
- [ ] Cloud storage integration (optional)

### Version 1.2
- [ ] Multi-monitor support
- [ ] Custom zoom regions
- [ ] Audio commentary recording
- [ ] Collaboration features

### Version 2.0
- [ ] AI-powered auto-editing
- [ ] Cross-application recording
- [ ] Advanced analytics
- [ ] Plugin marketplace

---

**Made with ❤️ by the CursorFlow Team**