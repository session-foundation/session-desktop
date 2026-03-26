// this is only here to make emoji-mart not print a bunch of errors when running during unit tests
HTMLCanvasElement.prototype.getContext = () => {
  return {
    canvas: {
      width: 0,
      height: 0,
    },
  } as any;
};
