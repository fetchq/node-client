const createDecorateContext = (ctx) => async (context = {}) => {
  ctx.settings.decorateContext = {
    ...ctx.settings.decorateContext,
    ...context,
  };
  ctx.logger.debug('decorateContext', ctx.settings.decorateContext);
};

module.exports = {
  createDecorateContext,
};
