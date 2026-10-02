class VoxNovaCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type === "flush") {
        this.flush();
        this.port.postMessage({ type: "flushed" });
      }
    };
  }

  flush() {
    if (this.offset === 0) return;
    const samples = this.buffer.slice(0, this.offset);
    this.offset = 0;
    this.port.postMessage({ type: "audio", samples }, [samples.buffer]);
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let sourceOffset = 0;
    while (sourceOffset < channel.length) {
      const count = Math.min(channel.length - sourceOffset, this.bufferSize - this.offset);
      this.buffer.set(channel.subarray(sourceOffset, sourceOffset + count), this.offset);
      this.offset += count;
      sourceOffset += count;
      if (this.offset === this.bufferSize) this.flush();
    }
    return true;
  }
}

registerProcessor("voxnova-capture", VoxNovaCaptureProcessor);
