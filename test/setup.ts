// test/setup.ts
import { vi } from "vitest";

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: [] })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    strokeText: vi.fn(),
    fill: vi.fn(),
  })),
});

Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  value: vi.fn(() => "data:image/png;base64,MOCK_BASE64_STRING"),
});

globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
globalThis.URL.revokeObjectURL = vi.fn();

class MockAudioContext {
  constructor() {}
  createOscillator = vi.fn();
  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
  }));
  createBuffer = vi.fn();
  createBufferSource = vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  decodeAudioData = vi.fn((data, success) => success && success({}));
  resume = vi.fn();
  suspend = vi.fn();
  close = vi.fn();
  currentTime = 0;
  destination = {};
}

globalThis.AudioContext = MockAudioContext as any;
globalThis.webkitAudioContext = MockAudioContext as any;
// test/setup.ts

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// test/setup.ts
// test/setup.ts
const mock2DContext = {
  // Transformations
  resetTransform: vi.fn(),
  setTransform: vi.fn(),
  transform: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),

  // Drawing paths
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  rect: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),

  // Style and color
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  lineCap: "",
  lineJoin: "",
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  lineDashOffset: 0,

  // Text
  font: "",
  textAlign: "",
  textBaseline: "",
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),

  // Images
  drawImage: vi.fn(),
  createImageData: vi.fn(() => ({})),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),

  // Pixel manipulation
  getContextAttributes: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),

  // Events
  canvas: {
    width: 300,
    height: 150,
  },

  // Compositing
  globalAlpha: 1,
  globalCompositeOperation: "",

  // Shadow
  shadowColor: "",
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,

  // Clipping
  clip: vi.fn(),

  // Hit regions
  isPointInPath: vi.fn(() => false),
  isPointInStroke: vi.fn(() => false),
};

const mockBitmapRenderer = {
  transferFromImageBitmap: vi.fn(),
};

HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
  if (type === "2d") {
    return mock2DContext as unknown as CanvasRenderingContext2D;
  }
  if (type === "bitmaprenderer") {
    return mockBitmapRenderer as unknown as ImageBitmapRenderingContext;
  }
  return null;
});

// test/setup.ts
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

globalThis.ResizeObserver = MockResizeObserver as any;

// Create canvas manually
const canvas = document.createElement("canvas");
canvas.id = "cnv";
document.body.appendChild(canvas);
