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

# Determine the version to use.
if [ -n "$1" ]; then
  # If a version is passed as $1, use it.
  VERSION="$1"
  GIT_TAG="v$VERSION"
else
  # If no argument is passed, get the latest git tag.
  GIT_TAG=$(git describe --tags --abbrev=0)
  if [ -z "$GIT_TAG" ]; then
    echo "No tags found. Exiting."
    exit 1
  fi
  VERSION=$(echo "$GIT_TAG" | sed 's/^v//')
fi

echo "Using version: $VERSION"

# Update pubspec.yaml with the new version.
PUBSPEC_FILE="client/pubspec.yaml"
if grep -q "^version: $VERSION" "$PUBSPEC_FILE"; then
  echo "Version in $PUBSPEC_FILE is already up to date."
else
  sed -i '' "s/^version:.*/version: $VERSION/" "$PUBSPEC_FILE"
  echo "Updated version in $PUBSPEC_FILE to $VERSION"
fi

# Update package.json with the new version.
PACKAGE_JSON_FILE="server/package.json"
if grep -q "\"version\": \"$VERSION\"" "$PACKAGE_JSON_FILE"; then
  echo "Version in $PACKAGE_JSON_FILE is already up to date."
else
  sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$PACKAGE_JSON_FILE"
  echo "Updated version in $PACKAGE_JSON_FILE to $VERSION"
fi

# Update schema.json with the new version.
SCHEMA_JSON_FILE="openapi/schema.json"
if grep -q "\"version\": \"$VERSION\"" "$SCHEMA_JSON_FILE"; then
  echo "Version in $SCHEMA_JSON_FILE is already up to date."
else
  sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$SCHEMA_JSON_FILE"
  echo "Updated version in $SCHEMA_JSON_FILE to $VERSION"
fi

# If a version was passed as an argument, commit the changes and create/push a new tag.
if [ -n "$1" ]; then
  echo "Creating commit and tag for version $VERSION"

  # Stage the changed files.
  git add "$PUBSPEC_FILE" "$PACKAGE_JSON_FILE" "$SCHEMA_JSON_FILE"

  # Commit the changes.
  git commit -m "Update version to $VERSION" || echo "No changes to commit."

  # Create a new tag.
  git tag "$GIT_TAG"

  # Push the commit and the new tag.
  git push origin HEAD
  git push origin "$GIT_TAG"
fi
