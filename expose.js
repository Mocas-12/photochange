(() => {
  const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (!proto || proto.__pc_patched) return;
  const original = proto.drawImage;
  if (typeof original !== "function") return;
  proto.drawImage = function (...args) {
    try {
      const src = args[0];
      if (src && src instanceof HTMLCanvasElement) {
        // Capture the most recent source canvas drawn into the preview canvas.
        // This acts as our current working image reference for size estimation.
        window.__pc_lastSrcCanvas = src;
      }
    } catch (_) {}
    return original.apply(this, args);
  };
  Object.defineProperty(proto, "__pc_patched", { value: true });
})();

