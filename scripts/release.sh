#!/bin/bash
set -euo pipefail

VERSION=${1:-}
if [[ $# != 1 || ! $VERSION =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "Usage: $0 X.Y.Z" >&2
    exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
TAG="v$VERSION"
if [[ $(git branch --show-current) != main ]]; then
    echo "Run this script on main." >&2
    exit 1
fi
if [[ -n $(git status --porcelain) ]]; then
    echo "Commit or stash working tree changes first." >&2
    exit 1
fi
if git show-ref --verify --quiet "refs/tags/$TAG"; then
    echo "Tag $TAG already exists." >&2
    exit 1
fi

files=(server/package.json server/package-lock.json openapi/schema.json web/src/api/schema.d.ts)
trap 'git restore --staged --worktree -- "${files[@]}"' EXIT

npm --prefix server version "$VERSION" --no-git-tag-version --ignore-scripts
node - "$VERSION" <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = 'openapi/schema.json';
const source = fs.readFileSync(path, 'utf8');
const schema = JSON.parse(source);
schema.info.version = process.argv[2];

// Keep the schema's formatting. Check the parsed result before writing.
const updated = source.replace(
  /("info"\s*:\s*\{[^{}]*?"version"\s*:\s*)"[^"]*"/,
  (_, prefix) => prefix + JSON.stringify(schema.info.version),
);
assert.deepEqual(JSON.parse(updated), schema);
fs.writeFileSync(path, updated);
JS
npm --prefix web run gen:api
npm --prefix web run check:api

git diff -- "${files[@]}"
read -r -p "Commit and tag $TAG? (y/N) " reply || reply=
if [[ ! $reply =~ ^[Yy]$ ]]; then
    echo "Release cancelled."
    exit 0
fi

git add -- "${files[@]}"
git commit -m "chore: bump version to $VERSION"
trap - EXIT
git tag -a "$TAG" -m "Release version $VERSION"

read -r -p "Push main and $TAG to origin? (y/N) " reply || reply=
if [[ $reply =~ ^[Yy]$ ]]; then
    git push --atomic origin main "refs/tags/$TAG"
fi
