pg:
	docker run --rm \
		-p 5432:5432 \
		-e POSTGRES_PASSWORD=postgres \
		postgres
