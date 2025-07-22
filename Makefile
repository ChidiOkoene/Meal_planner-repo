init:
	./scripts/bootstrap.sh

lint:
	cd frontend && yarn lint
	cd backend && yarn lint
	cd llm-service && poetry run flake8 .

test:
	./scripts/run_tests.sh

up:
	docker-compose up -d

down:
	docker-compose down

deploy:
	./scripts/deploy.sh