run:
	# Destroy previous containers
	docker stop fetchq-app01 || true
	docker rm fetchq-app01 || true

	# Start Postgres
	docker run --rm -d \
		--name fetchq-app01 \
		-p 5432:5432 \
		-e POSTGRES_PASSWORD=postgres \
		postgres

	# Start node
	# npm link fetchq
	# node index.js
