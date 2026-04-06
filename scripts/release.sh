#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: pnpm release <version>"
  echo "Example: pnpm release 0.4.0"
  exit 1
fi

# Remove 'v' prefix if provided
VERSION="${VERSION#v}"

echo "Releasing v${VERSION}..."

# Update package.json version
npm pkg set version="$VERSION"

# Commit and tag
git add package.json
git commit -m "release: v${VERSION}"
git tag "v${VERSION}"

# Push
git push
git push origin "v${VERSION}"

echo ""
echo "v${VERSION} released! CI will build and create the GitHub Release."
echo "Track progress: https://github.com/shinju4n/harness-hub/actions"
