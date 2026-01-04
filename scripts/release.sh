#!/bin/bash

# Release script for OpenQuester
# Updates version in all files, creates git tag, and pushes to remote

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 <version>"
    echo ""
    echo "Example: $0 1.0.2"
    echo ""
    echo "This script will:"
    echo "  1. Update version in pubspec.yaml"
    echo "  2. Update version in package.json"
    echo "  3. Update version in schema.json"
    echo "  4. Update version in metainfo.xml"
    echo "  5. Regenerate API client"
    echo "  6. Commit the changes"
    echo "  7. Create a git tag (v<version>)"
    echo "  8. Push commits and tags to remote"
    exit 1
}

# Check if version argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version number is required${NC}"
    usage
fi

VERSION="$1"

# Validate version format (semantic versioning)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Version must be in format X.Y.Z (e.g., 1.0.2)${NC}"
    exit 1
fi

# Get the repository root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${YELLOW}Preparing release v${VERSION}${NC}"
echo ""

# Ensure we're on the main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: This script must be run on the 'main' branch. You are on '$CURRENT_BRANCH'.${NC}"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean. Please commit or stash changes first.${NC}"
    git status --short
    exit 1
fi

# Check if tag already exists
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag v${VERSION} already exists${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Working directory is clean${NC}"
echo -e "${GREEN}✓ On main branch${NC}"

# Update version in file (cross-platform safe)
update_version_in_file() {
    local file="$1"
    local pattern="$2"
    local replacement="$3"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' -e "s/$pattern/$replacement/" "$file"
    else
        sed -i "s/$pattern/$replacement/" "$file"
    fi
}

echo -e "${YELLOW}Updating version numbers...${NC}"

# Update pubspec.yaml
PUBSPEC_FILE="client/pubspec.yaml"
if [ -f "$PUBSPEC_FILE" ]; then
    update_version_in_file "$PUBSPEC_FILE" '^version:.*' "version: $VERSION"
    echo -e "${GREEN}✓ Updated $PUBSPEC_FILE to ${VERSION}${NC}"
else
    echo -e "${RED}Error: $PUBSPEC_FILE not found${NC}"
    exit 1
fi

# Update package.json
PACKAGE_JSON_FILE="server/package.json"
if [ -f "$PACKAGE_JSON_FILE" ]; then
    update_version_in_file "$PACKAGE_JSON_FILE" '"version": ".*"' "\"version\": \"$VERSION\""
    echo -e "${GREEN}✓ Updated $PACKAGE_JSON_FILE to ${VERSION}${NC}"
else
    echo -e "${RED}Error: $PACKAGE_JSON_FILE not found${NC}"
    exit 1
fi

# Update schema.json
SCHEMA_JSON_FILE="openapi/schema.json"
if [ -f "$SCHEMA_JSON_FILE" ]; then
    update_version_in_file "$SCHEMA_JSON_FILE" '"version": ".*"' "\"version\": \"$VERSION\""
    echo -e "${GREEN}✓ Updated $SCHEMA_JSON_FILE to ${VERSION}${NC}"
else
    echo -e "${RED}Error: $SCHEMA_JSON_FILE not found${NC}"
    exit 1
fi

# Update metainfo.xml with new release entry
METAINFO_FILE="client/linux/com.asion.openquester.metainfo.xml"
if [ -f "$METAINFO_FILE" ]; then
    # Get current date in YYYY-MM-DD format
    RELEASE_DATE=$(date +%Y-%m-%d)
    
    # Add new release entry before the closing </releases> tag
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "/<\/releases>/i\\
    <release version=\"$VERSION\" date=\"$RELEASE_DATE\"/>
" "$METAINFO_FILE"
    else
        sed -i "/<\/releases>/i\    <release version=\"$VERSION\" date=\"$RELEASE_DATE\"/>" "$METAINFO_FILE"
    fi
    echo -e "${GREEN}✓ Updated $METAINFO_FILE to ${VERSION}${NC}"
else
    echo -e "${RED}Error: $METAINFO_FILE not found${NC}"
    exit 1
fi

# Regenerate API client
echo -e "${YELLOW}Regenerating API client...${NC}"
cd client
make gen_api
cd "$REPO_ROOT"
echo -e "${GREEN}✓ API client regenerated${NC}"

echo ""
echo -e "${YELLOW}Changes to be committed:${NC}"
git diff "$PUBSPEC_FILE" "$PACKAGE_JSON_FILE" "$SCHEMA_JSON_FILE" "$METAINFO_FILE"
git status --short

echo ""
read -p "Do you want to continue with these changes? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Release cancelled. Reverting changes...${NC}"
    git restore "$PUBSPEC_FILE" "$PACKAGE_JSON_FILE" "$SCHEMA_JSON_FILE" "$METAINFO_FILE"
    git clean -fd client/packages/openapi/
    exit 0
fi

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git add "$PUBSPEC_FILE" "$PACKAGE_JSON_FILE" "$SCHEMA_JSON_FILE" "$METAINFO_FILE" client/packages/openapi/
git commit -m "chore: Bump version to ${VERSION}"
echo -e "${GREEN}✓ Changes committed${NC}"

# Create tag
echo -e "${YELLOW}Creating tag v${VERSION}...${NC}"
git tag -a "v${VERSION}" -m "Release version ${VERSION}"
echo -e "${GREEN}✓ Tag v${VERSION} created${NC}"

echo ""
read -p "Do you want to push the changes and tag to remote? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Push cancelled. You can manually push with:${NC}"
    echo -e "  git push origin main"
    echo -e "  git push origin v${VERSION}"
    exit 0
fi

# Push changes and tag
echo -e "${YELLOW}Pushing changes and tag to remote...${NC}"
git push origin main
git push origin "v${VERSION}"
echo -e "${GREEN}✓ Changes and tag pushed to remote${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Release v${VERSION} completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
