```js
// Create a workflow from a server route handler
server.get('/stats/:id', async (req, res) => {
    const stats = await fetchq.createWorkflow({
        queue: 'get-user-stats',
        payload: { userId: req.params.id },
        timeout: 1000,
    })
    res.send(stats);
});

// Queue "get-user-stats" handler
const getUserStatsHandler = (doc, { complete, kill, workflow }) => {
    try {
        const stats = await db.Stats.findById(doc.payload.userId)
        if (stats) {
            return workflow.resolve()
                .then(() => complete())
                .catch((err) => kill(err.message, { details: err }))
        }
    } catch (err) {
        return workflow.reject('failed to pull data from the db')
            .then(() => kill('failed to pull data from the db'))
            .catch((err) => kill(err.message, { details: err }))
    }

    // forward will "push" into the new queue keeping the same subject
    // should return true/false in case to see if it had been pushed correctly
    //
    // In case the queuing fails, the "forward" api should automatically
    // call "workflow.reject" with an error message
    return workflow.forward({
        queue: 'aggregate-user-stats',
        payload: { ...doc.payload, decorate: true },
    })
        .then(() => complete({ payload: { ...doc.payload, forwarded: true } })),
        .catch((err) => kill(err.message, { details: err }));
    });
};
```
