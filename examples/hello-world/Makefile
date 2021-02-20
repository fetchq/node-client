clear:
	clear

cleanup:
	@docker stop fetchq-example-app || true
	@docker rm fetchq-example-app || true
	@rm -rf ./node_modules

db: cleanup
	@docker run --rm -d \
		--name fetchq-example-app \
		-p 5432:5432 \
		-e POSTGRES_PASSWORD=postgres \
		postgres:13.2

# Start node
run:
	npm install
	npm start

start: clear cleanup db run