# FetchQ NodeJS Client - Changelog

## v2.9.1

- connection retry using `promise-retry`
- initialization retry using `promise-retry` to handle concurrect data structure initialization attempts
- deprecated `settings.connect` in favor of `settings.connectionParams`
- add `settings.autoStart`
- add `settings.onReady`
- add `client.decorateContext`
- add `skipMaintenance`
- add `configure.logger` to completely customize the logging capabilities
- add `utils.awaitStatus` to monitor a document for getting promoted to a particular status in one or more queues

## v2.9.0

- add `decorateContext` to pass custom data and functionalities into the worker's handler function
- improved documentation
- improve `init()` by running all the upserting within a transaction
- enableNotifications is `true` by default

## v2.6.1

- pg-sub honors `process.env.PGSTRING`

## v2.6.0

- Auto inizialize an empty Postgres instance
- drop the "skipExtension" setting

## v2.5.0

- Fix bug when passing `nextIteration` as date object
- Add `workflow.trace()` utility
- Add `doc.trace()` utility

## v2.4.0

- Add utility function `client.boot()`
- The `payload` is optional to actions reschedule, complete and kill. If not passed
  the document's payload will not be affected
- The `kill` action can now take a message and produce an error log
- Add the possibility to log an error message for every handler return actions
- Add document's action creators
- Pack document's actions creators into `actions` within the context
- Add `doc.logError(message, [details, refId]` to the document object
- Add `doc.forward(queue, [ payload ])` to the document object
- Implement workflow api (see App03 example!!!)

## v2.3.0

- `doc.push` accepts a `delay` option that times out the execution of the query
- `doc.pushMany` accepts a `delay` option that times out the execution of the query
- `doc.append` accepts a `delay` option that times out the execution of the query
- Add `client.onSome` that awaits for multiple events with timeout
- Add `client.onPipeline` that handles a success/failure scenario with timeout
- Add `client.emitPipelineComplete`
- Add `client.emitPipelineFailed`

## v2.2.0

- Add event emitter API (see `lib/functions/event-emitter.js`)

## v2.1.1

- Adds support for `skipExtension:true` as client settings, to be used when FetchQ is installed manually
  using the full SQL source code

## v2.1.0

- Deprecated `ctx` in a worker's handler: `fn(doc, { ctx, worker })` becomes `fn(doc, { client, worker }`
- Added logging utility method: `client.queue.logError(queue, subject, message, details = {}, refId = null)`
- Added `queue` property to the document passed down to a handler
- Supports interval based nextIteration: `+1s`, `+ 1 DAY`, ... when pushing and rescheduling documents
