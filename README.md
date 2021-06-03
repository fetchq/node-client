# Fetchq Node Client

Provides a NodeJS interface to manage a Fetchq database instace.

> **NOTE:** Fetchq does not solve all the problems in the world.  
> Before using it, read the following paragraph that explains Fetchq usecase, and take a look at other great alternatives like RabbitMQ or Hangfire.

---

## Table of Contents

- [What is Fetchq](#what-is-fetchq)
- [When to use Fetchq?](#when-to-use-fetchq)
- [When NOT to use Fetchq](#when-not-to-use-fetchq)
- [Live Demos](#live-demos)
- [DB Configuration](#db-configuration)
- [Queues Configuration](#queues-configuration)
- [Add Documents to a Queue](#add-documents-to-a-queue)
- [Workers Configuration](#workers-configuration)
- [The Handler Function](#the-handler-function)
- [Returning Actions](#returning-actions)
- [Context Decoration](#context-decoration)
- [Client Configuration](#client-configuration)
- [Maintenance Configuration](#maintenance-configuration)
- [Logger Configuration](#logger-configuration)
- [Initialization & Startup](#initialization--startup)
- [A word on `init()`](#a-word-on-init)
- [Error Handling](#error-handling)
- [Workflow API](#workflow-api)

## What is Fetchq?

You can think of Fetchq as a **big calendar** for running tasks.

With Fetchq, you can push a document into a queue and associate it with a _point in time_, just a date. Could be now, could be a year from now, could be 100 years ago

Fetchq will then try to execute documents that are **due for execution** starting from the older one. Well, it's not really Fetchq that executes it, it's one function that you provide. We call that function a `worker` or a `handler`.

👉 Fetchq guarantees that a document will NOT be executed before it's due date expires.

When your handler executes a document, it can take decision based on the document's data and even on previous execution state.

After your handler does what needs to be done, it can `reschedule`, `drop`, `complete` or `kill` the document. More about this later in the docs.

> **NOTE:** Here you'll learn to use it with NodeJS, but it really is just a smart way to use Postgres and could be paired with any programming language that can connecto to it.

---

## When to use Fetchq?

You should consider using Fetchq when the answert to either of the following question is true:

- Is FIFO not the best option?
- Do you need to **reschedule documents** execution?
- Do you need **uniqueness of documents** in a queue?
- Do you want to **keep your costs low**? (\*)
- Do you need/like to **backup/restore** your queues?

(\*) PostgreSQL performs unbelievably well even with very little resources.

---

## When NOT to use Fetchq?

In case you have a massive amount of work that needs to be taken care by a massive amount of independent workers. In such a case (classic with digital producers such in a IoT project), RabbitMQ or similar alternatives are a much more suitable option.

PostgreSQL can handle a lot of data, easily billions of items in a single queue, and still operate fast enough. Nevertheless, if you go BIG and don't need repetition, uniqueness and planning of tasks, I'd choose a different tool.

---

## Live Demos

Fetchq works on NodeJS and the only external dependency is a connection to a PostgreSQL instance. Such a lightweight requirements make it possible to run **fully working free in-browser demoes** leveraging on [CodeSandbox](https://codesandbox.io/) and [ElephantSQL](https://www.elephantsql.com/).

### Client Demonstration:

- [FIFO](https://codesandbox.io/s/fetchq-fifo-8xjrg)
- [decorateContext](https://codesandbox.io/s/fetchq-context-kbnd2)
- [Worflow API](https://codesandbox.io/s/fetchq-workflow-coruu)

### Fetchq as ForrestJS App:

- [Workflow API](https://codesandbox.io/s/service-fastify-fetchq-0by8x?file=/src/feature-home-page.js)

---

## DB Configuration

The _Fetchq_ client library gives you a function that returns a configured
client that implements _Fetchq API_:

```js
const fetchq = require('fetchq');
const client = fetchq({ config });
```

The only requirement is a running Postgres instance. If Fetchq extension
does not exits, the client will initialize the database for you.

Any new table will be created under the `fetchq_catalog` schema and all the
PSQL functions are created in the default schema (public) prefixed as `fetchq_xxx` to avoid collisions.

### Using ENV Variables

By default _Fetchq Client_ tries to **use standard Postgres environment variables**
to setup the connection, so that you don't have to bother with it programmatically:

- PGUSER
- PGPASSWORD
- PGHOST
- PGPORT
- PGDATABASE

From `v2.4.0` you can simply define a `PGSTRING` env variable that contains a complete
connection uri [as documented here](https://node-postgres.com/features/connecting#Connection%20URI).

### Configure the connection programmatically:

You can set the connection's configuration programmatically:

```js
const client = fetchq({
  connectionParams: {
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
  },
});
```

Or you can pass a `connectionString`:

```js
const client = fetchq({
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
});
```

Fetchq will attempt to connect to your Postgres instance multiple times and you can control this behavior with the
`connectionRetry` configuration:

```js
const client = fetchq({
  connectionRetry: {
    retries: 30,
    factor: 1,
    minTimeout: 1 * 1000,
    maxTimeout: 30 * 1000,
  },
});
```

👉 More info about the params [here](https://www.npmjs.com/package/promise-retry).

### Connection Pooling

You can read about pooling in the [PG documentation](https://node-postgres.com/features/pooling), if you decide to diverge from the default settings, just pass a
`pool` option:

```js
const client = fetchq({
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
  pool: { max: 1, ... },
});
```

If you use a free tier database (ex from https://elephantsql.com) your
connections settings may be limited, so I suggest you set
`pool { max: 1 }` in such early development phases.

> **NOTE:** Fetchq client will setup at least 2 connections, one of them is
> dedicated to the event system, the other os for normal querying.

👉 More info about pooling [here](https://node-postgres.com/features/pooling).

### Raw Queries

Fetchq uses the famous library `pg` to connect to the Postgres instance,
once your client is up and running you can issue raw queries as:

```js
await client.pool.query('SELECT NOW()');
```

👉 More info about raw queries [here](https://node-postgres.com/features/queries).

---

## Queues Configuration

A Fetchq queue is represented at database level as a set of tables and entries in some other system tables.

A queue collects:

- documents
- logs
- stats
- settings

You can create as many queues you may need (as long it is sustainable by your db, anyway, it could be in the thousands) representing them as a simple list of configuration objects.

Here is an example that uses all the current default values.

```js
const client = fetchq({
  queues: [
    {
      // name of the queue, used later on to interact with it
      // (must be a valid Postgres table name)
      name: 'q1',

      // when false, any active worker will pause
      isActive: true,

      // speeds up FIFO performances immensely but it uses a bit more CPU.
      enableNotifications: true,

      // fail tolerance of the queue, before considering a document dead
      maxAttempts: 5,

      // max log duration in a per-queue logs table
      errorsRetention: '24h',

      // settings of the per-queue maintenance jobs
      maintenance: {
        // document status maintenance
        mnt: { delay: '100ms', duration: '1m', limit: 500 },

        // queue stats screenshots for plotting perfomances through time
        sts: { delay: '5m', duration: '5m' },

        // computed stats job
        cmp: { delay: '10m', duration: '5m' }, // ???

        // errors and metrics cleanup job
        drp: { delay: '10m', duration: '5m' },
      },
    },
  ],
});
```

> **NOTE**: the default values are suitable for most use cases so to obtain a responsive
> queue that is taking metrics snapshot every 5 minutes. If you have a massive amount of
> data to process, we suggest you increase `mnt.delay` and monitor your PostgreSQL
> performances to find the best value for it.

### enableNotifications

When this option is set to `true` _Fetchq_ activates triggers and notifications for the
queue, and the client subscribes to those notifications to wake up after idle time.

**👉 enable when:**
This is a perfect setting for queues that may stay idle for long periods of time,
or for queues that must **respond quickly to user's actions**.

**👉 disable when:**
Queues that need to handle repetitive but not near-real-time critical tasks may
decide not to use this feature and just rely on simple polling. This has proven to
be more effective expecially when dealing with massive data into a queue.
In this case, you should also increase the value of `mnt.delay` for this queue.

### Maintenance Settings

Each queue's health relies on a list of maintenance tasks that must be executed in
time by each _Fetchq Client_'s maintenance service.

You can fine tune how often those jobs should be executed and therefore fine tune the
reactiveness of each queue and the load on the system.

The `mtn` jobs updates the document's status, the faster it goes the more reactive the
queue when it comes to execute a scheduled document that became pending. It also increases CPU and I/O so you must find a good balance based on your needs.

The `sts` job takes screenshots of the queue metrics and stores it into a timeserie
table that you may want to use for plotting chards and visualize the queue's status.
Run this as often as you need, just be careful because it may produce a lot of data.

The `cmp` job works on the queue timeserie stats table and creates _computed metrics_
such how many documents per minute or so. This job may be heavy.

The `drp` job tries to drop data that is not necessary anymore. It removes old error
logs and metrics. This is not a critical job, but it is definetly good to run it every
few minutes to keep your database lighter.

---

## Add Documents to a Queue

Once you have defined a working queue, you probably want to add data
into it for later processing.

There are 2 possible ways add documents into a queue:

- `append()`
- `push()`

### Append a Document:

Use the `append` API if you want your document to be processed as
soon as possible, but after the current workload.

```js
// Signature:
fetchq.doc.append(targetQueue, documentPayload [, options])
```

Example:

```js
const result = await client.doc.append('q1', {
  createdAt: Date.now(),
});

// RESULT:
//   {
//     subject: 'xxxx-yyy-ddd'
//   }
//
// "subject" is a UUIDv1
```

👉 [For a better list of examples please take a look at the
integration test](./lib/functions/doc/doc.append.test.e2e.js)

### Push a Document:

Use the `push` API if you want to be in control of:

- the subject of the document, which is unique for any given queue
- the point in time when the document should be processed

Signature:

```js
fetchq.doc.append(targetQueue, document [, options])
```

Example:

```js
const res = await client.doc.push('q1', {
  subject: 'd1',
  payload: { createdAt: Date.now() },
  nextIteration: '+1 year',
});

// RESULT:
//   {
//     queued_docs: 1
//   }
```

👉 [For a better list of examples please take a look at the
integration test](./lib/functions/doc/doc.push.test.e2e.js)

#### Push Multiple Documents:

[[TO BE COMPLETED]]

#### Upsert a Document:

[[TO BE COMPLETED]]

---

## Workers Configuration

```js
const client = fetchq({
  workers: [
    {
      queue: 'q2',
      name: 'my-first-worker',

      // how many concurrent service instances to run.
      // this is not parallel execution, just concurrent. It will speed up a lot
      // when workers deal with I/O operations such disk or network.
      // to achieve real parallelization, use Docker or add worker servers to your
      // cluster.
      concurrency: 1,

      // how many documents to pick in a single query
      // the more the documents, the less the workload on the database, but also
      // the higher the chance of producing orphans that will eventually reject
      batch: 1,

      // esitmated max duration of a batch operation.
      // if the worker doesn't complete within this timeframe, the document
      // will considered rejected and cumulates errors
      lock: '5m',

      // idle time between documents execution
      delay: 250,

      // idle time after completing a queue
      sleep: 5000,

      // the function that handles a document
      // see next chapter
      handler: () => {},
    },
  ],
});
```

---

## The Handler Function

The worker's handler is an **asynchronous function** that is triggered
by the Fetchq client any time a document is ready for execution.

> **You can focus on "what to do on a single document"** and let Fetchq
> deal with the complexity of applying it to millions of them, within
> a single machine, or spread across a cluster of workers.

It receives a `document` which is a
Javascript object and should return an `action` (inspired by Redux) which
is another object that describes how Fetchq should handle the document
itself, after our custom logic is completed.

```js
const handler = async (doc, ctx) => {
  // use the builtin logger
  client.logger.info(`handling ${doc.queue}::${doc.subject}`);

  // forward the document into another queue, with the
  // possibility of simple payload decoration:
  await doc.forward('another-queue', {
    decorate: 'the payload',
  });

  // Run a custom SQL query
  await ctx.client.pool.query(`SELECT NOW()`);

  // Use an `action creator` to describe how you expect Fetchq
  // to handle the document after the custom logic completes.
  return doc.reschedule('+1 week');
};
```

**👉 It's important to understand that Fetchq's handler execution is statefull**:  
during the execution of a handler you can take decision based on
previous executions, leveraging on the internal properties, or
manipulating the document's payload.

#### The DOC parameter

The `document` parameter (first in order) contains relevant information for the logical
execution of the worker function:

| name           | type   | description                                                                                                                                           |
| -------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| queue          | string | Document's queue name                                                                                                                                 |
| subject        | string |  Document's unique identifier in the queue                                                                                                            |
| payload        | object |  Document's custom data object <small>(stored as jsonb)</small>                                                                                       |
| version        | number | Document's version number <br /><small>describes the payload's signature</small>                                                                      |
| iterations     | number | Successfully processed counter                                                                                                                        |
| attempts       | number | Failed processed counter <br /><small>gets reset after a successful execution</small>                                                                 |
| created_at     | date   | Document's first appeareance in the queue                                                                                                             |
| last_iteration | date   | Document's last attempted processing date <br /><small>could be null</small>                                                                          |
| next_iteration | date   | Document's next planned processing date <br /><small>Used in case of unhandled exception, could be modified by the `doc.reschedule()` method.</small> |

### The CTX parameter

The `context` parameter gives you access to APIs that are not strictly
related to the document under execution.

| name     | type   | description                                                                                                      |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| client   | ref    | Memory reference to the Fetchq's client instance<br /><small>it give you full access to the client's API</small> |
| worker   | ref    | Memory reference to the Worker's instance                                                                        |
| workflow | object | Worflow API<br /><small><b>experimental feature</b></small>                                                      |

> **NOTE:** You can freely extend the context that is given to
> any handlers by using the `client.decorateContext()` API or the
> `decorateContext` setting. Read more under `handler context decoration`
> paragraph.

---

## Returning Actions

The handler function should return an object that defines which action should be
performed on the document. In order to facilitate this activity and avoid actions
names misspell, you can use **action creators** from the `document` object:

```js
const handler = (doc, ctx) => {
  return doc.reschedule('+1 week');
  return doc.reject('error message...');
  return doc.complete();
  return doc.kill();
  return doc.drop();
};
```

### reschedule(nextIteration, [options])

The document will be scheduled for further execution.

You should provide a
`nextIteration` option that could be a Javascript Date object or a valid
Postgres interval string such: `+ 1 minute`, `-20y`, ...

```js
return doc.reschedule('+1 week', {
  // decorate the document's payload
  payload: { ...doc.payload, newField: 'hoho' },

  // write a custom persistent log while rescheduling
  refId: 'custom reference',
  message: 'yes, do it again',
  details: { count: 22 },
});
```

### drop([options])

The document will be deleted from the queue's table.

```js
return doc.drop({
  // write a custom persistent log before droppint the document
  refId: 'custom reference',
  message: 'dropped a document',
  details: doc,
});
```

> **NOTE:** That means that the same `subject` can be re-queued
> by a `doc.push()` action.

### complete([options])

The document will be marked with a `status = 3` and will never be executed again.

```js
return doc.complete({
  // decorate the document's payload
  payload: { ...doc.payload, newField: 'hoho' },

  // write a custom persistent log before marking the document as complete
  refId: 'custom reference',
  message: 'there was no more stuff to do',
  details: { count: 22 },
});
```

> **NOTE:** Because the document itself is retained by the queue's
> table, any attempt to `doc.push()` it back into the queue will
> silently fail, returning a `queued_docs = 0`.

### kill([options])

The document will be marked with a `status = -1` and will never be executed again.

```js
return doc.kill({
  // decorate the document's payload
  payload: { ...doc.payload, newField: 'hoho' },

  // write a custom persistent log before marking the document as complete
  refId: 'custom reference',
  message: 'there was NOTHING ELSE to do',
  details: { count: 22 },
});
```

> **NOTE:** Because the document itself is retained by the queue's
> table, any attempt to `doc.push()` it back into the queue will
> silently fail, returning a `queued_docs = 0`.

### reject(errorMessage, [options])

The document will be scheduled for another execution attempt according to the queue's
settings and lock duration. The `attempts` counter will increase by
one unit, and if it exceeds the `maxAttempts` threshold as set for the queue,
it will be automatically killed (mark as `status = -1`).

You normally use this API within a `catch (err) {}` statement, when
you have a clear idea of what went wrong, and want to customize the error log.

```js
return doc.reject('I know exactly what went wrong', {
  // Add details to the log error message
  refId: 'custom reference',
  details: { count: 22 },
});
```

> **NOTE:** Any unhandled exception that may happen within the handler's
> function is considered an **implicit rejection** and an error log is
> automatically appended to the queue's logs.

---

## Context Decoration

More often than not your workers' handlers need to deal with external
API or other parts of your application.

Fetchq encourages you to think your handlers as **pure functions** to
simplify Unit Testing and avoid the most common side effects based bugs.

A common solution is to provide a custom set of capabilities to your
handlers while configuring the Fetchq instance:

```js
fetchq({
  decorateContext: {
    faa: 1,
  },
  workers: [
    {
      queue: 'q1',
      decorateContext: {
        foo: 2,
      },
      handler: (doc, { faa, foo }) => {
        console.log(faa, foo);
        return doc.drop();
      },
    },
  ],
});
```

You can apply this settings at client level, injecting custom stuff
into every worker, or worker-by-worker by providind the setting within
the worker's configuration.

---

## Client Configuration

### skipUpsertFetchq

When `true`, the client will not attempt to initialize or upgrade the Fetchq library that is installed on the Postgres db.

[default: false]

You can set this from the environment:  

```bash
FETCHQ_SKIP_UPSERT_FETCHQ=true
```

### skipUpsertQueues

When `true`, the client will not attempt to upsert the configured queues, nor to update their configuration.

[default: false]

You can set this from the environment:  

```bash
FETCHQ_SKIP_UPSERT_QUEUES=true
```

### skipMaintenance

When `true`, the client will not participate in the maintenance of the queues.

[default: false]

You can set this from the environment:  

```bash
FETCHQ_SKIP_MAINTENANCE=true
```

### skipEmitter

When `true`, the client will not create an emitter server, hence it will establish one less connection to the Postgres instance.

[default: false]

You can set this from the environment:  

```bash
FETCHQ_SKIP_EMITTER=true
```

---

## Maintenance Configuration

```js
const client = fetchq({
  maintenance: {
    limit: 3,
    delay: 250,
    sleep: 5000,
  },
});
```

---

## Logger Configuration

Fetchq comes with a simple logger utility that spits out different levels of informations to the `console`. It is a very minimal implementation of the famous [Winston](https://github.com/winstonjs/winston) library.

### Setting the logLevel

You can provide the value through the environment variable `process.env.LOG_LEVEL` or programmatically via configuration:

```js
fetchq({
  logLevel: 'error',
});
```

> Fetchq falls back on the level `error` if nothing else is specified.

### Providing a custom logger library

Although the built in logger is ok for development, it's likely that you want to bring your real logging library for production. You can do that while setting up the client:

```js
const winston = require('winston');

fetchq({
  logger: {
    instance: winston.createLogger({
      level: 'info',
      // other winston configuration
    }),
  },
});
```

## Initialization & Startup

The easiest way to run Fetchq is with the `autoStart` setting:

```js
fetchq({
  ...config,
  autoStart: true,
  onReady: (client) => client.logger.info('Fetchq is ready'),
});
```

In case you want to delay the execution of it, you can use the
`boot()` function:

```js
// Create the client instance
const client = fetchq({ ...config });

// Start the client instance
client.boot().then((client) => client.logger.info('Fetchq is ready'));
```

A manual boot sequence would be obtained with:

```js
const client = fetchq({ ...config });
await client.connect();
await client.init();
await client.start();
client.logger.info('Fetchq is ready');
```

`client.init` will apply all the provided configuration to the _Fetchq db_:

- instanciate your PostgreSQL instance with Fetchq
- create missing queues
- apply queue related settings
- apply queue related jobs settings
- recalculate indexes if needed
- apply maintenance settings

`client.start` will spin up the active services like:

- queue workers instances
- queue maintenance workers

## A word on `init()`

The `init()` method is useful to distribute _Fetchq_ configuration programmatically
and apply it to the database without messing with SQL and Postgres clients.

The entire initialization happens inside a `BEGIN - COMMIT` block so to minimize
the risk for racing conditions. Nevertheless, we suggest to minimize the amount of
clients that run this function.

In a common situation, there shold be just one single process that is
responsible for running the `init()` API, you can actually think of it
as some kind of migration as both the basic Fetchq schema and queue definitions are
upserted at this point in time.

In case of racing conditions, the system will detect the issue and re-attempt the
initialization (using [promise-retry](https://www.npmjs.com/package/promise-retry)).

You can change the retry configuration editing the setting `initializationRetry`:

```js
const client = fetchq({
  initializationRetry: {
    retries: 30,
    factor: 1,
    minTimeout: 1 * 1000,
    maxTimeout: 30 * 1000,
  },
});
```

👉 More info about the params [here](https://www.npmjs.com/package/promise-retry).

---

## Error Handling

Since v3.2.0, Fetchq client offers hooks to intercept and handle
errors as they happen in the system.

> Refer to `examples/on-error`.

[[TO BE IMPROVED]]

---

## Workflow API

You can use a workflow to distribute work into one or more workers and await
for the entire process to finish.

A signup process may involve several steps, performed in a specific order, and
each step may fail due to many different reasons.

Normally you write all those steps into an asynchronous route handler that will
consume quite a few resources from your user facing server... That may result into
an unresponsive or slow website.

With Fetchq Workflow you can free your main process of any computational burden
and ejnoy the isolation and horizontal scalability of a queue system!

> Refer to:
>
> - [`examples/pipeline-api`](./examples/pipeline-api/)
> - [`examples/workflow-api`](./examples/workflow-api/)
> - [`examples/pipeline-fastify`](./examples/workflow-fastify/)

```js
const workflow = client.createWorkflow({
  queue: 'signup',
  timeout: 1000, // defaults to 20s
  payload: {
    username: 'marcopeg',
  },
});

workflow
  .run()
  .then((res) => console.log('Workflow completed:', res))
  .catch((err) => console.error('Workflow exited:', err));
```

Basically a workflow is a big promise that wraps the execution of one or more
workers across your queue processing cluster.

The signup worker may look something like:

```js
const signupWorker = {
  queue: 'signup',
  handler: (doc, { workflow }) => {
    const { username } = doc.payload;

    // Break the workflow in case of errors:
    if (username.length < 5) {
      return workflow.reject('Username too short');
    }

    // Pipe the document into another queue to
    // continue the workflow:
    return workflow.forward('signup_save_user', {
      payload: { validated: true },
    });
  },
};
```

You can also nest workflows one into another in order to parallelize the execution
of tasks:

```js
const signupWorker = {
  queue: 'signup_save_user',
  handler: async (doc, { workflow }) => {
    const { username } = doc.payload;

    // Persist the user into the database
    let userRecord = null;
    try {
      userRecord = await db.saveUser(username);
    } catch (err) {
      return workflow.reject(err);
    }

    // Run a few parallel workflows
    const w1 = workflow
      .create({
        queue: 'signup_send_welcome_email',
        payload: userRecord,
      })
      .run();

    const w2 = workflow
      .create({
        queue: 'signup_process_user_icon',
        payload: userRecord,
      })
      .run();

    const w3 = workflow
      .create({
        queue: 'signup_fetch_user_profile',
        payload: userRecord,
      })
      .run();

    // The sub-workflows run in parallel and the work is actually distributed
    // horizontally across your worker's cluster.
    //
    // Nevertheless, you can simply await all that work to complete
    // before completing and releasing the main signup workflow.
    try {
      await Promise.all([w1, w2, w3]);
    } catch (err) {
      return workflow.reject(err);
    }

    // Finally complete the workflow
    return workflow.resolve(userRecord);
  },
};
```
