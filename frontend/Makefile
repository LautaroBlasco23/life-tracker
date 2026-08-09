APP_NAME := nextjs-app
PORT := 3000
DOCKER_TAG := latest

.PHONY: help
help:
	@echo "Available commands:"
	@echo ""
	@echo "Docker Compose (Recommended for persistence):"
	@echo "  compose-up      - Start app with docker-compose"
	@echo "  compose-down    - Stop app with docker-compose"
	@echo "  compose-restart - Restart app with docker-compose"
	@echo "  compose-logs    - View docker-compose logs"
	@echo "  compose-build   - Build image with docker-compose"
	@echo ""
	@echo "Vanilla Docker (Manual restart policy):"
	@echo "  docker-up       - Start app with restart policy"
	@echo "  docker-down     - Stop app"
	@echo "  docker-restart  - Restart app"
	@echo ""
	@echo "Development:"
	@echo "  build-dev       - Build development Docker image"
	@echo "  run-dev         - Run development container with hot reload"
	@echo "  stop            - Stop all containers"
	@echo "  clean           - Remove containers and images"
	@echo "  logs-dev        - View dev container logs"
	@echo "  shell-dev       - Open shell in dev container"

.PHONY: compose-up
compose-up:
	docker-compose up -d
	@echo "App running at http://localhost:$(PORT)"

.PHONY: compose-down
compose-down:
	docker-compose down

.PHONY: compose-restart
compose-restart: compose-down compose-up

.PHONY: compose-logs
compose-logs:
	docker-compose logs -f

.PHONY: compose-build
compose-build:
	docker-compose build

.PHONY: docker-up
docker-up:
	docker build \
		--build-arg NEXT_PUBLIC_API_URL=https://api-lifetracker.lautaroblasco.com/api \
		-t $(APP_NAME):$(DOCKER_TAG) .
	docker run -d \
		--name $(APP_NAME) \
		-p $(PORT):3000 \
		--restart unless-stopped \
		$(APP_NAME):$(DOCKER_TAG)
	@echo "App running at http://localhost:$(PORT)"

.PHONY: docker-down
docker-down:
	-docker stop $(APP_NAME)
	-docker rm $(APP_NAME)

.PHONY: docker-restart
docker-restart: docker-down docker-up

.PHONY: build-dev
build-dev:
	docker build -f Dockerfile.dev -t $(APP_NAME)-dev:$(DOCKER_TAG) .

.PHONY: run-dev
run-dev: build-dev
	docker run -d \
		--name $(APP_NAME)-dev \
		-p $(PORT):3000 \
		-v $(PWD):/app \
		-v /app/node_modules \
		$(APP_NAME)-dev:$(DOCKER_TAG)
	@echo "Development container running at http://localhost:$(PORT)"

.PHONY: stop
stop:
	-docker stop $(APP_NAME)
	-docker stop $(APP_NAME)-dev
	-docker rm $(APP_NAME)
	-docker rm $(APP_NAME)-dev

.PHONY: clean
clean: stop
	-docker rmi $(APP_NAME):$(DOCKER_TAG)
	-docker rmi $(APP_NAME)-dev:$(DOCKER_TAG)
	docker system prune -f

.PHONY: logs-dev
logs-dev:
	docker logs -f $(APP_NAME)-dev

.PHONY: shell-dev
shell-dev:
	docker exec -it $(APP_NAME)-dev /bin/sh
