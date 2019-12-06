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
    payload =>
      registry[evt].forEach((handler) => {
        handler(payload);

        // remove singleton handlers
        if (handler.__fetchqEmitOnce) {
          ctx.off(evt, handler);
        }
      });


  ctx.on = (evt, callback) => {
    // init the event registry
    if (!registry[evt]) {
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

  ctx.emit = (evt, payload) => {
    try {
      ctx.emitter.publish(evt, payload);
    } catch (err) {
      ctx.logger.error(err);
    }
  };
};

module.exports = {
  createEventEmitter,
};
