# FetchQ Node Client

Provides a NodeJS interface to manage a FetchQ database instace.

## Configure the Postgres Connection

The _FetchQ_ client library gives you a function that returns a configured
client that implements _FetchQ API_:

```js
const fetchq = require('fetchq');
const client = fetchq();
```

**NOTE:** If you installed _FetchQ_ using the plain SQL method, you should pass a
specifig configuration option `skipExtension: true` that prevents the client from
interacting with the Postgres extension:

```js
const fetchq = require('fetchq');
const client = fetchq({
  skipExtension: true,
  ...
});
```

### Using ENV Variables

By default _FetchQ Client_ tries to **use standard Postgres environment variables**
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
  connect: {
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

### Pooling

You can read about pooling in the [PG documentation](https://node-postgres.com/features/pooling), if you decide to diverge from the default settings, just pass a
`pool` option:

```js
const client = fetchq({
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
  pool: { max: 1, ... },
});
```

## Configure Queues

```js
const client = fetchq({
  queues: [
    {
      // name of the queue, used later on to interact with it
      name: 'q1',

      // when false, any active worker will pause
      isActive: true,

      // speeds up FIFO performances immensely but it uses a bit more CPU.
      enableNotifications: true,

      // fail tolerance of the queue, before considering a document dead
      maxAttempts: 5,

      // max log duration in a per-queue errors table
      errorsRetention: '24h',

      // settings of the per-queue maintenance jobs
      maintenance: {
        // document status maintenance
        mnt: { delay: '1m', duration: '5m', limit: 500 },

        // queue stats screenshots for plotting perfomances through time
        sts: { delay: '1m', duration: '5m' },

        // computed stats job
        cmp: { delay: '1m', duration: '5m' }, // ???

        // errors and metrics cleanup job
        drp: { delay: '1m', duration: '5m' },
      },
    }
  ]
})
```

### enableNotifications

When this option is set to `true` _FetchQ_ activates triggers and notifications for the
queue, and the client subscribes to those notifications to wake up after idle time.

**Enable when:**
This is a perfect setting for queues that may stay idle for long periods of time,
or for queues that must **respond quickly to user's actions**.

**Disable when:**
Queues that need to handle repetitive but not near-real-time critical tasks may
decide not to use this feature and just rely on simple polling. This has proven to
be more effective expecially when dealing with massive data into a queue.

### maintenance settings

Each queue's health relies on a list of maintenance tasks that must be executed in
time by each _FetchQ Client_'s maintenance service.

You can fine tune how often those jobs should be executed and therefore fine tune the
reactiveness of each queue and the load on the system.

The `mtn` jobs updates the document's status, the faster it goes the more reactive the
queue when it comes to execute a scheduled document that became pending.

The `sts` job takes screenshots of the queue metrics and stores it into a timeserie
table that you may want to use for plotting chards and visualize the queue's status.
Run this as often as you need, just be careful because it may produce a lot of data.

The `cmp` job works on the queue timeserie stats table and creates _computed metrics_
such how many documents per minute or so. This job may be heavy.

The `drp` job tries to drop data that is not necessary anymore. It removes old error
logs and metrics. This is not a critical job, but it is definetly good to run it every
few minutes to keep your database lighter.

## Configure Workers

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
    }
  ]
})
```

## The Worker's Handler Function

```js
const handler = async (doc, { client, reschedule }) => {
  // use the builtin logger
  client.logger.info(`handling ${doc.queue}::${doc.subject}`);

  // append the document into another queue
  await client.doc.append('another-queue', doc.payload);

  return reschedule('+1 week');
};
```

## Returning Actions

The handler function should return an object that defines which action should be
performed on the document. In order to facilitate this activity and avoid actions
names misspell, you can use **action creators** from the handler's context:

```js
const handler = (doc, ctx) => {
  return ctx.reschedule('+1 week');
  return ctx.reject('error message...');
  return ctx.complete();
  return ctx.kill();
  return ctx.drop();
};
```

All action creators take a second argument as an _options object_ that you can use
to modify the document's payload or to produce an error log along with the action:

```js
reschedule('+1 week', {
  // mutate the document's payload
  payload: { ...doc.payload, newField: 'hoho' },

  // write a custom error_log
  message: 'yes, do it again',
  details: { count: 22 },
  refId: 'I really forgot why I added this field to the schema...',
});
```

### reschedule(nextIteration, [options])

The document will be scheduled for another execution. You should provide a
`nextIteration` option that could be a Javascript Date object or a valid
Postgres interval string such `+ 1 minute`, `-20y`, ...

### reject(errorMessage, [options])

The document will be scheduled for another execution attempt according to the queue's
settings and lock duration.

### complete([options])

The document will be marked with a `status = 3` and will never be executed again.

### kill([options])

The document will be marked with a `status = -1` and will never be executed again.

### drop([options])

The document will be deleted from the queue's table.

## Configure Maintenance

```js
const client = fetchq({
  maintenance: {
    limit: 3,
    delay: 250,
    sleep: 5000,
  },
});
```

## Initialization & Startup

A normal boot sequence would be obtained with:

```js
await client.init();
await client.start();
```

or with the shorter version:

```js
await client.boot();
```

that does exactly as the code before.

`client.init` will apply all the provided configuration to the _FetchQ db_:

- create missing queues
- apply queue related settings
- apply queue related jobs settings
- recalculate indexes if needed
- apply maintenance settings

`client.start` will spin up the active services like:

- queue workers instances
- queue maintenance workers

## A word on `init()`

The `init()` method is useful to distribute _FetchQ_ configuration programmatically
and apply it to the database without messing with SQL and Postgres clients.

It works exceptionally good during development or when you have only one active
client.

In real life production settings, where you have probably many servers that process
the queue, it is a better idea to skip the init as it may end up in
**boot-time racing conditions**.

I normally implement the `fetchq.init()` method in my main backend service that takes
the lead in configuring the whole system and performs schema migrations.

Any other second level service (such a worker service) should be fail tolerant and
capable of awaiting for the correct configuration to eventually apply in order to
start doing its job.

## Workflow API

You can use a workflow to distribute work into one or more workers and await
for the entire process to finish.

A signup process may involve several steps, performed in a specific order, and
each step may fail due to many different reasons.

Normally you write all those steps into an asynchronous route handler that will
consume quite a few resources from your user facing server... That may result into
an unresponsive or slow website.

With FetchQ Workflow you can free your main process of any computational burden
and ejnoy the isolation and horizontal scalability of a queue system!

```js
const workflow = client.createWorkflow({
  queue: 'signup',
  timeout: 1000, // defaults to 20s
  payload: {
    username: 'marcopeg',
  },
});

workflow.run()
  .then(res => console.log('Workflow completed:', res))
  .catch(err => console.error('Workflow exited:', err));
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
      payload: { validated: true }
    });
  }
}
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
      userRecord = await db.saveUser(username)
    } catch (err) {
      return workflow.reject(err)
    }

    // Run a few parallel workflows
    const w1 = workflow.create({
      queue: 'signup_send_welcome_email',
      payload: userRecord,
    }).run();

    const w2 = workflow.create({
      queue: 'signup_process_user_icon',
      payload: userRecord,
    }).run();

    const w3 = workflow.create({
      queue: 'signup_fetch_user_profile',
      payload: userRecord,
    }).run();

    // The sub-workflows run in parallel and the work is actually distributed
    // horizontally across your worker's cluster.
    //
    // Nevertheless, you can simply await all that work to complete
    // before completing and releasing the main signup workflow.
    try {
      await Promise.all([w1, w2, w3])
    } catch (err) {
      return workflow.reject(err);
    }

    // Finally complete the workflow
    return workflow.resolve(userRecord);
  }
}
```





