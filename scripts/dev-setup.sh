#!/bin/bash
# Build the library, then run the example app on a connected iOS device.
# For consumer apps, prefer `npm install react-native-easy-apple-pay` over `npm link`.
set -e

LIB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE_DIR="$LIB_DIR/example"

echo "📦 Building library..."
cd "$LIB_DIR"
npm install
npm run build

echo "📱 Installing example app dependencies..."
cd "$EXAMPLE_DIR"
npm install

echo "🔧 Generating native iOS project..."
npx expo prebuild --platform ios --clean

echo ""
echo "✅ Ready. Run the app with:"
echo "    cd $EXAMPLE_DIR && npm run ios:device"
echo ""
echo "For new-architecture testing:"
echo "    cd $EXAMPLE_DIR && npm run ios:newarch"
