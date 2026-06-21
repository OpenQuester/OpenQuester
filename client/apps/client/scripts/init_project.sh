#!/bin/bash

# init_project.sh - Initialize OpenQuester project
# This script builds the project_helper tool and creates symlinks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_HELPER_DIR="$CLIENT_DIR/packages/project_helper"

echo "========================================"
echo "  OpenQuester Project Initialization"
echo "========================================"
echo ""

# Determine which Flutter version manager to use.
# Priority: FLUTTER_VERSION_MANAGER env var > .fvmrc auto-detect > default (puro)
# Set FLUTTER_VERSION_MANAGER=fvm|puro to force a specific manager.
if [ "$FLUTTER_VERSION_MANAGER" = "fvm" ] || { [ -z "$FLUTTER_VERSION_MANAGER" ] && [ -f "$CLIENT_DIR/.fvmrc" ]; }; then
    DART_CMD="fvm dart"
    FLUTTER_CMD="fvm flutter"
elif [ "$FLUTTER_VERSION_MANAGER" = "puro" ] || [ -z "$FLUTTER_VERSION_MANAGER" ]; then
    DART_CMD="puro dart"
    FLUTTER_CMD="puro flutter"
else
    DART_CMD="dart"
    FLUTTER_CMD="flutter"
fi

# Build project_helper
echo "Building project_helper..."
cd "$PROJECT_HELPER_DIR"

# Get dependencies
echo "Getting dependencies..."
$DART_CMD pub get

# Compile executable
echo "Compiling oqhelper executable..."
$DART_CMD compile exe bin/oqhelper.dart -o bin/oqhelper

if [ ! -f "bin/oqhelper" ]; then
    echo "✗ Failed to compile oqhelper"
    exit 1
fi

echo "✓ oqhelper compiled successfully"

# Create symlinks in all Dart project roots
echo ""
echo "Creating symlinks..."

# Function to create symlink
create_symlink() {
    local target_dir=$1
    local link_name="$target_dir/oqhelper"
    
    # Remove existing symlink if it exists
    if [ -L "$link_name" ]; then
        rm "$link_name"
    fi
    
    # Create symlink
    ln -s "$PROJECT_HELPER_DIR/bin/oqhelper" "$link_name"
    echo "  ✓ Created symlink: $link_name"
}

# Create symlink in client directory (main Flutter app)
create_symlink "$CLIENT_DIR"

# Create symlinks in all packages
for package_dir in "$CLIENT_DIR/packages"/*; do
    if [ -d "$package_dir" ] && [ -f "$package_dir/pubspec.yaml" ]; then
        create_symlink "$package_dir"
    fi
done

echo ""
echo "========================================"
echo "  Initialization Complete!"
echo "========================================"
echo ""
echo "You can now use 'oqhelper' command in any Dart project directory:"
echo "  cd $CLIENT_DIR"
echo "  ./oqhelper pre_build"
echo ""
