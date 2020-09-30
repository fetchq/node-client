clear:
	clear

cleanup:
	docker stop fetchq-example-app || true
	docker rm fetchq-example-app || true

# Start Postgres
db: cleanup
	docker run --rm -d \
		--name fetchq-example-app \
		-p 5432:5432 \
		-e POSTGRES_PASSWORD=postgres \
		postgres:13.0

# Start node
run:
	npm i
	npm link fetchq
	node index.js

start: clear db run