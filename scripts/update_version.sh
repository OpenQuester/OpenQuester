#!/bin/bash
set -e

# Ensure we're on the main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: This script must be run on the 'main' branch. You are on '$CURRENT_BRANCH'."
  exit 1
fi

# Pull changes
git pull

# Determine the version to use
if [ -n "$1" ]; then
  VERSION="$1"
  GIT_TAG="v$VERSION"
else
  GIT_TAG=$(git describe --tags --abbrev=0)
  if [ -z "$GIT_TAG" ]; then
    echo "No tags found. Exiting."
    exit 1
  fi
  VERSION="${GIT_TAG#v}"
fi

echo "Using version: $VERSION"

# Update file function (cross-platform safe)
update_version_in_file() {
  local file="$1"
  local pattern="$2"
  local replacement="$3"

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -e "s/$pattern/$replacement/" "$file"
  else
    sed -i -e "s/$pattern/$replacement/" "$file"
  fi
}

# Update pubspec.yaml
PUBSPEC_FILE="client/pubspec.yaml"
if grep -q "^version: $VERSION" "$PUBSPEC_FILE"; then
  echo "Version in $PUBSPEC_FILE is already up to date."
else
  update_version_in_file "$PUBSPEC_FILE" '^version:.*' "version: $VERSION"
  echo "Updated version in $PUBSPEC_FILE to $VERSION"
fi

# Update package.json
PACKAGE_JSON_FILE="server/package.json"
if grep -q "\"version\": \"$VERSION\"" "$PACKAGE_JSON_FILE"; then
  echo "Version in $PACKAGE_JSON_FILE is already up to date."
else
  update_version_in_file "$PACKAGE_JSON_FILE" '"version": ".*"' "\"version\": \"$VERSION\""
  echo "Updated version in $PACKAGE_JSON_FILE to $VERSION"
fi

# Update schema.json
SCHEMA_JSON_FILE="openapi/schema.json"
if grep -q "\"version\": \"$VERSION\"" "$SCHEMA_JSON_FILE"; then
  echo "Version in $SCHEMA_JSON_FILE is already up to date."
else
  update_version_in_file "$SCHEMA_JSON_FILE" '"version": ".*"' "\"version\": \"$VERSION\""
  echo "Updated version in $SCHEMA_JSON_FILE to $VERSION"
fi

echo "Generating api client..."
cd client 
make gen_api

# Commit and tag if version passed
if [ -n "$1" ]; then
  echo "Creating commit and tag for version $VERSION"

  git add "$PUBSPEC_FILE" "$PACKAGE_JSON_FILE" "$SCHEMA_JSON_FILE"
  git commit -m "chore(release): v$VERSION" || echo "No changes to commit."
  git tag "$GIT_TAG"
  git push origin HEAD
  git push origin "$GIT_TAG"
fi
