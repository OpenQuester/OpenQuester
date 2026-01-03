#!/bin/bash
set -e

# Script to create AppImage for OpenQuester
# Usage: ./build-appimage.sh <flutter_build_dir>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${1:-../build/linux/x64/release/bundle}"
OUTPUT_DIR="${2:-../build/linux/appimage}"

echo "Building OpenQuester AppImage..."
echo "Build directory: $BUILD_DIR"
echo "Output directory: $OUTPUT_DIR"

# Create AppDir structure
APPDIR="$OUTPUT_DIR/AppDir"
rm -rf "$APPDIR"
mkdir -p "$APPDIR"

# Copy application bundle
cp -r "$BUILD_DIR"/* "$APPDIR/"

# Create directory structure
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/lib"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/scalable/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/512x512/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/192x192/apps"
mkdir -p "$APPDIR/usr/share/metainfo"

# Move application to usr/bin
mv "$APPDIR/openquester" "$APPDIR/usr/bin/openquester"
chmod +x "$APPDIR/usr/bin/openquester"

# Move libraries to usr/lib
if [ -d "$APPDIR/lib" ]; then
    mv "$APPDIR/lib"/* "$APPDIR/usr/lib/"
    rmdir "$APPDIR/lib"
fi

# Copy data directory
if [ -d "$APPDIR/data" ]; then
    mkdir -p "$APPDIR/usr/share/openquester"
    mv "$APPDIR/data" "$APPDIR/usr/share/openquester/"
fi

# Copy desktop file
cp "$SCRIPT_DIR/com.asion.openquester.desktop" "$APPDIR/usr/share/applications/"
ln -sf usr/share/applications/com.asion.openquester.desktop "$APPDIR/com.asion.openquester.desktop"

# Copy metainfo
cp "$SCRIPT_DIR/com.asion.openquester.metainfo.xml" "$APPDIR/usr/share/metainfo/"

# Copy icons
cp "$SCRIPT_DIR/../assets/icon/icon.svg" "$APPDIR/usr/share/icons/hicolor/scalable/apps/com.asion.openquester.svg"
cp "$SCRIPT_DIR/../web/icons/icon-512.png" "$APPDIR/usr/share/icons/hicolor/512x512/apps/com.asion.openquester.png"
cp "$SCRIPT_DIR/../web/icons/icon-192.png" "$APPDIR/usr/share/icons/hicolor/192x192/apps/com.asion.openquester.png"

# Create top-level icon symlink
ln -sf usr/share/icons/hicolor/scalable/apps/com.asion.openquester.svg "$APPDIR/com.asion.openquester.svg"

# Create AppRun script
cat > "$APPDIR/AppRun" << 'EOF'
#!/bin/bash
APPDIR="$(dirname "$(readlink -f "${0}")")"
export LD_LIBRARY_PATH="$APPDIR/usr/lib:$LD_LIBRARY_PATH"
export PATH="$APPDIR/usr/bin:$PATH"
export XDG_DATA_DIRS="$APPDIR/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
exec "$APPDIR/usr/bin/openquester" "$@"
EOF
chmod +x "$APPDIR/AppRun"

# Download appimagetool if not present
APPIMAGETOOL="$OUTPUT_DIR/appimagetool-x86_64.AppImage"
if [ ! -f "$APPIMAGETOOL" ]; then
    echo "Downloading appimagetool..."
    wget -O "$APPIMAGETOOL" "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x "$APPIMAGETOOL"
fi

# Build AppImage
cd "$OUTPUT_DIR"
ARCH=x86_64 "$APPIMAGETOOL" AppDir "OpenQuester-x86_64.AppImage"

echo "AppImage created successfully: $OUTPUT_DIR/OpenQuester-x86_64.AppImage"
