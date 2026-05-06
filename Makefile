.PHONY: help build build-local start clean logs stop restart update-version

# Default target
help:
	@echo "🚀 Palmr - Available Commands:"
	@echo ""
	@echo "  make build         - Multi-platform Docker build + push (requires IMAGE_NAME=foo/bar)"
	@echo "  make build-local   - Local single-platform Docker build, no push (for verification/dev)"
	@echo "  make update-version - Update version in all package.json files"
	@echo "  make start         - Start the application using docker-compose"
	@echo "  make stop          - Stop all running containers"
	@echo "  make logs          - Show application logs"
	@echo "  make clean         - Clean up containers and images"
	@echo "  make shell         - Access the application container shell"
	@echo ""
	@echo "📁 Scripts location: ./infra/"

# Build Docker image for release: multi-platform + push.
# Requires IMAGE_NAME env var, e.g. `make build IMAGE_NAME=stlalpha/palmr`.
build:
	@echo "🏗️  Building Palmr Docker image (release: multi-platform + push)..."
	@chmod +x ./infra/build-docker.sh
	@./infra/build-docker.sh

# Local build for verification: current platform, no push.
build-local:
	@echo "🏗️  Building Palmr Docker image (local: single platform, no push)..."
	@chmod +x ./infra/build-docker.sh
	@LOCAL=1 ./infra/build-docker.sh

# Update version in all package.json files
update-version:
	@echo "🔄 Updating version numbers..."
	@echo "🏷️  Please enter the new version (e.g., v3.0.0, 3.0-beta):"
	@read -p "Version: " VERSION; \
	if [ -z "$$VERSION" ]; then \
		echo "❌ Error: Version cannot be empty"; \
		exit 1; \
	fi; \
	chmod +x ./infra/update-versions.sh; \
	./infra/update-versions.sh "$$VERSION"

# Start the application
start:
	@echo "🚀 Starting Palmr application..."
	@docker-compose up -d

# Stop the application
stop:
	@echo "🛑 Stopping Palmr application..."
	@docker-compose down

# Show logs
logs:
	@echo "📋 Showing Palmr logs..."
	@docker-compose logs -f

# Clean up containers and images
clean:
	@echo "🧹 Cleaning up Docker containers and images..."
	@docker-compose down -v
	@docker system prune -f
	@echo "✅ Cleanup completed!"

# Access container shell
shell:
	@echo "🐚 Accessing Palmr container shell..."
	@docker-compose exec palmr /bin/sh