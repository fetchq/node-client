const createDecorateContext = (ctx) => async (context = {}) => {
  ctx.settings.decorateContext = {
    ...ctx.settings.decorateContext,
    ...context,
  };
  console.log('decorateContext', ctx.settings.decorateContext);
};

module.exports = {
  createDecorateContext,
};
