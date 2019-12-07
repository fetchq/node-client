/**
 * Injects an event emitter into the client's memory.
 *
 * // Add a listener and cancel it from the ticket
 * const ticket = client.on('foo', payload => console.log(payload));
 * ticket.cancel();
 *
 * // Add a listener and cancel it with a reference
 * const callback = payload => console.log(payload);
 * client.on('foo', callback);
 * client.off('foo', callback);
 *
 * // Add a listener that fires just once
 * client.once('foo', payload => console.log(payload));
 *
 * // Kill all listeners for a specific event
 * client.off('foo')
 *
 */
const createEventEmitter = (ctx) => {
  const registry = {};
  const createEventHandler = evt =>
    payload => {
      // console.log('received', evt)
      registry[evt].forEach((handler) => {
        handler(payload);

        // remove singleton handlers
        if (handler.__fetchqEmitOnce) {
          ctx.off(evt, handler);
        }
      });
    }


  ctx.on = (evt, callback) => {
    // init the event registry
    if (!registry[evt] || !registry[evt].length) {
      registry[evt] = [];
      ctx.emitter.addChannel(evt, createEventHandler(evt));
    }

    // add the callback to the registry
    registry[evt].push(callback);

    // release an event ticket
    return {
      cancel: () => ctx.off(evt, callback),
    };
  };

  ctx.once = (evt, callback) => {
    callback.__fetchqEmitOnce = true;
    return ctx.on(evt, callback);
  };

  /**
   * Configure an operation on multiple events, the first event that
   * fires will stop the execution and run the handler.
   *
   * You can configure an optional timeout for the operation and provide an
   * optional handler that will execute at the timeout.
   */
  ctx.onSome = (events = {}, maxDuration = 0, timeoutHandler = null) => {
    const tickets = [];

    const timeout = maxDuration ? setTimeout(() => {
      tickets.forEach(({ cancel }) => cancel());
      timeoutHandler && timeoutHandler();
    }, maxDuration) : null;

    Object.keys(events).forEach((event) => {
      tickets.push(ctx.on(event, (payload) => {
        clearTimeout(timeout);
        tickets.forEach(({ cancel }) => cancel());
        events[event](payload);
      }));
    });
  };

  /**
   * Handles a pipeline that can complete or fail.
   * "evt" is an event name that will be decorated with "--ok" or "--ko"
   * suffixes.
   *
   * See the "emitPipeline" utility that helps in triggering pipeline
   * events.
   */
  ctx.onPipeline = (evt, maxDuration = 0, timeoutHandler = 'timeout') =>
    new Promise((resolve, reject) =>
      ctx.onSome({
        [`${evt}--ok`]: resolve,
        [`${evt}--ko`]: reject,
      }, maxDuration, typeof timeoutHandler === 'string'
        ? () => reject(timeoutHandler)
        : () => reject(timeoutHandler())
      ));

  /**
   * Remove a callback from the registry and optionally
   * closes the Postgres listener.
   */
  ctx.off = (evt, callback) => {
    if (callback) {
      const idx = registry[evt].indexOf(callback)
      registry[evt].splice(idx, 1);
    } else {
      registry[evt] = [];
    }

    if (registry[evt].length === 0) {
      ctx.emitter.removeChannel(evt);
    }
  };

  /**
   * Emits an event through the Postgres channel.
   */
  ctx.emit = (evt, payload) => {
    try {
      ctx.emitter.publish(evt, payload);
    } catch (err) {
      ctx.logger.error(err);
    }
  };

  /**
   * Pipeline emitters
   */
  ctx.emitPipeline = (evt, success, payload) => ctx.emit(`${evt}--${success ? 'ok' : 'ko'}`, payload);
  ctx.emitPipelineComplete = (evt, payload) => ctx.emitPipeline(evt, true, payload);
  ctx.emitPipelineFailed = (evt, payload) => ctx.emitPipeline(evt, false, payload);
};

module.exports = {
  createEventEmitter,
};
