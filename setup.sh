#!/bin/bash

# CursorFlow Extension Setup Script

echo "🎯 Setting up CursorFlow extension structure..."

# Create directory structure
mkdir -p background
mkdir -p content
mkdir -p popup
mkdir -p editor
mkdir -p assets

echo "📁 Created directory structure"

# Create placeholder icon files
echo "🎨 Creating placeholder icons..."

# Create simple SVG icon as base64 for manifest
cat > assets/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="20" fill="#667eea"/>
  <circle cx="64" cy="64" r="30" fill="white"/>
  <circle cx="64" cy="64" r="15" fill="#667eea"/>
  <text x="64" y="100" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">CF</text>
</svg>
EOF

# Note: You'll need to convert SVG to PNG for actual use
echo "ℹ️  Note: Convert assets/icon.svg to PNG files (16x16, 48x48, 128x128) for production"

echo "✅ Directory structure created!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the code files into their respective directories:"
echo "   - background/service-worker.js"
echo "   - content/cursor-tracker.js" 
echo "   - popup/popup.html"
echo "   - popup/popup.js"
echo "   - editor/recordings.html"
echo "   - editor/recordings.js"
echo "   - manifest.json (in root)"
echo ""
echo "2. Convert the SVG icon to PNG files:"
echo "   - assets/icon-16.png"
echo "   - assets/icon-48.png" 
echo "   - assets/icon-128.png"
echo ""
echo "3. Run: npm run build"
echo "4. Load the 'dist' folder in Chrome extensions"