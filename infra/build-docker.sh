#!/bin/bash
set -euo pipefail

# Usage:
#   IMAGE_NAME=stlalpha/palmr ./infra/build-docker.sh    # multi-platform build + push
#   LOCAL=1 ./infra/build-docker.sh                      # local single-platform build, no push
#   NO_CACHE=0 LOCAL=1 ./infra/build-docker.sh           # allow Docker layer cache (faster iteration)
#
# IMAGE_NAME is required for push builds. For LOCAL=1 it defaults to "palmr".

IMAGE_NAME="${IMAGE_NAME:-}"
LOCAL_BUILD="${LOCAL:-0}"
USE_NO_CACHE="${NO_CACHE:-1}"

if [ -z "$IMAGE_NAME" ] && [ "$LOCAL_BUILD" != "1" ]; then
    echo "❌ IMAGE_NAME env var is required for push builds (e.g. IMAGE_NAME=stlalpha/palmr)."
    echo "   For local-only builds without push, set LOCAL=1."
    exit 1
fi

if [ -z "$IMAGE_NAME" ]; then
    IMAGE_NAME="palmr"
fi

echo "🏷️  Please enter a tag for the build (e.g., v1.0.0, production, beta):"
read -r -p "Tag: " TAG

if [ -z "$TAG" ]; then
    echo "❌ Error: Tag cannot be empty"
    echo "Please run the script again and provide a valid tag"
    exit 1
fi

CACHE_FLAG=""
if [ "$USE_NO_CACHE" = "1" ]; then
    CACHE_FLAG="--no-cache"
fi

if [ "$LOCAL_BUILD" = "1" ]; then
    echo "🚀 Local build (single platform, no push): $IMAGE_NAME:{latest,$TAG}"

    # set -e at the top of the script will abort on a build failure;
    # the lines below only execute if buildx succeeded.
    docker buildx build \
        $CACHE_FLAG \
        -t "$IMAGE_NAME:latest" \
        -t "$IMAGE_NAME:$TAG" \
        --load \
        .

    echo "✅ Local build completed: $IMAGE_NAME:latest, $IMAGE_NAME:$TAG"
    echo ""
    echo "Try it: docker run --rm -p 5487:5487 -p 3333:3333 $IMAGE_NAME:$TAG"
else
    echo "🚀 Multi-platform build + push: $IMAGE_NAME:{latest,$TAG} (linux/amd64, linux/arm64)"

    docker buildx create --name palmr-builder --use 2>/dev/null || docker buildx use palmr-builder

    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        $CACHE_FLAG \
        -t "$IMAGE_NAME:latest" \
        -t "$IMAGE_NAME:$TAG" \
        --push \
        .

    echo "✅ Multi-platform build completed and pushed!"
    echo ""
    echo "Built for platforms: linux/amd64, linux/arm64"
    echo "Pushed tags: $IMAGE_NAME:latest and $IMAGE_NAME:$TAG"
    echo ""
    echo "Access points after pulling and running:"
    echo "- API: http://localhost:3333"
    echo "- Web App: http://localhost:5487"
fi
