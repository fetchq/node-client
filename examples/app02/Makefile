cleanup:
	docker stop fetchq-example-app || true
	docker rm fetchq-example-app || true

run: cleanup
	clear
	
	# Start Postgres
	docker run --rm -d \
		--name fetchq-example-app \
		-p 5432:5432 \
		-e POSTGRES_PASSWORD=postgres \
		postgres

	# Start node
	npm i
	npm link fetchq
	node index.js
