cleanup:
	docker stop fetchq-example-app || true
	docker rm -f fetchq-example-app || true

start: cleanup
	docker run -itd \
		--name fetchq-example-app \
		-p 5432:5432 \
		-e POSTGRES_PASSWORD=postgres \
		postgres:13.0

test-run:
	npm i
	npm test

test: start test-run cleanup
