# FetchQ NodeJS Client - Changelog

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

- Deprecated `ctx` in a worker's handler: `fn(doc, { ctx, worker })` becomes `fn(doc, { client, worker }`
- Added logging utility method: `client.queue.logError(queue, subject, message, details = {}, refId = null)`
- Added `queue` property to the document passed down to a handler
- Supports interval based nextIteration: `+1s`, `+ 1 DAY`, ... when pushing and rescheduling documents
