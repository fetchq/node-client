const { pause } = require('./pause');

describe('utils/pause', () => {
  it('should return a promise', () => {
    const res = pause();
    expect(res).toBeInstanceOf(Promise);
  });
  it('should pause the process for real', async () => {
    const t = process.hrtime();
    await pause(2);
    const res = console.timeEnd(pause);
    const hrTime = process.hrtime(t);
    const milli = hrTime[0] * 1000 + hrTime[1] / 1000000;
    // console.log(milli);
    expect(milli).toBeGreaterThan(1);
  });
});
