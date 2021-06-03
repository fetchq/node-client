cleanup:
	docker stop fetchq-example-app || true
	docker rm -f fetchq-example-app || true

start: cleanup
	docker run -itd \
		--name fetchq-example-app \
		-p 5432:5432 \
		-e POSTGRES_PASSWORD=postgres \
		postgres:13.2

stop:
	docker stop fetchq-example-app

test-run:
	npm install
	npm test

test: cleanup start test-run cleanup

link:
	npm install
	npm link