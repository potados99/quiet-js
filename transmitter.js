import { resumeIfSuspended, chunkBuffer } from './utils';
import { sampleBufferSize } from './constants';

const createF32Array = (bufferSize, quietInterop) => {
  const pointer = quietInterop.malloc(4 * bufferSize);
  const view = quietInterop.subArray(
    (pointer / 4), (pointer / 4) + bufferSize,
  );

  return {
    pointer,
    view,
  };
};

export default class Transmitter {
  constructor(audioContext, quietInterop) {
    this.destroyed = false;
    this.audioContext = audioContext;
    this.quietInterop = quietInterop;
  }

  selectProfile(profile, clampFrame) {
    const cProfiles = this.quietInterop.intArrayFromString(JSON.stringify({ profile }));
    const cProfile = this.quietInterop.intArrayFromString('profile');
    const opt = this.quietInterop.quietEncoderProfileStr(cProfiles, cProfile);

    // libquiet internally works at 44.1kHz but the local sound card
    // may be a different rate. we inform quiet about that here
    this.encoder = this.quietInterop.quietEncoderCreate(opt, this.audioContext.sampleRate);
    this.quietInterop.free(opt);

    // enable close_frame which prevents data frames from overlapping multiple
    // sample buffers. this is very convenient if our system is not fast enough
    // to feed the sound card without any gaps between subsequent buffers due
    // to e.g. gc pause. inform quiet about our sample buffer size here
    this.frameLength = clampFrame 
      ? this.quietInterop.quietEncoderClampFrameLen(this.encoder, sampleBufferSize)
      : this.quietInterop.quietEncoderGetFrameLen(this.encoder);

    this.samples = createF32Array(sampleBufferSize, this.quietInterop);
    return this;
  }

  transmit(buf) {
    resumeIfSuspended(this.audioContext);

    const payload = chunkBuffer(buf, this.frameLength);

    for (const frame of payload) {
      this.quietInterop.quietEncoderSend(this.encoder, new Uint8Array(frame), frame.byteLength);
    }
    this.quietInterop.quietEncoderEmit(this.encoder, this.samples.pointer, sampleBufferSize);

    const audioBuffer = this
      .audioContext
      .createBuffer(1, sampleBufferSize, this.audioContext.sampleRate);
    audioBuffer.copyToChannel(this.samples.view, 0, 0);

    const audioBufferNode = new AudioBufferSourceNode(this.audioContext);
    audioBufferNode.buffer = audioBuffer;
    audioBufferNode.connect(this.audioContext.destination);
    audioBufferNode.start();
    return this;
  }

  destroy() {
    if (!this.destroyed) {
      this.quietInterop.free(this.samples.pointer);
      this.quietInterop.quietEncoderDestroy(this.encoder);
      this.destroyed = true;
    }
    return this;
  }
}
