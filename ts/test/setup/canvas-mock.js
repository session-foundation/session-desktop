const { JSDOM } = require('jsdom');

// If jsdom isn't already set up globally, you may need to set it up here
HTMLCanvasElement.prototype.getContext = function () {
  return {
    measureText: () => ({ width: 0 }),
    fillText: () => {},
    clearRect: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: [] }),
    createImageData: () => [],
    setTransform: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    canvas: { width: 0, height: 0 },
  };
};
