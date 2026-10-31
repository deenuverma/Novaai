// Singleton WebAudio playback & 16kHz PCM encoder for NOVAAI Real-Time Live Voice
// Keeps a persistent unlocked 24kHz AudioContext so gapless Gemini Live & TTS audio
// plays reliably across turns without browser Autoplay Policy rejections.

let outputCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let outputAnalyser: AnalyserNode | null = null;
let analyserData: Uint8Array<ArrayBuffer> | null = null;
let nextStartTime = 0;
let isMutedState = false;
const activeSources = new Set<AudioBufferSourceNode>();
const playbackListeners = new Set<(playing: boolean) => void>();

function notifyPlaybackListeners() {
  const playing = activeSources.size > 0;
  for (const listener of playbackListeners) {
    try {
      listener(playing);
    } catch {
      // ignore listener errors
    }
  }
}

function ensureOutputContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!outputCtx || outputCtx.state === 'closed') {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    outputCtx = new AudioCtx({ sampleRate: 24000 });
    masterGain = outputCtx.createGain();
    masterGain.gain.value = isMutedState ? 0 : 1;
    outputAnalyser = outputCtx.createAnalyser();
    outputAnalyser.fftSize = 256;
    outputAnalyser.smoothingTimeConstant = 0.78;
    analyserData = new Uint8Array(new ArrayBuffer(outputAnalyser.frequencyBinCount));
    masterGain.connect(outputAnalyser);
    outputAnalyser.connect(outputCtx.destination);
    nextStartTime = 0;
  }
  return outputCtx;
}

export function subscribeLivePlaybackState(
  listener: (playing: boolean) => void
): () => void {
  playbackListeners.add(listener);
  listener(activeSources.size > 0);
  return () => {
    playbackListeners.delete(listener);
  };
}

export function isLiveAudioUnlocked(): boolean {
  return Boolean(outputCtx && outputCtx.state === 'running');
}

export async function unlockLiveAudioEngine(): Promise<boolean> {
  const ctx = ensureOutputContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Play a 1-sample silent buffer inside user gesture to unlock hardware audio pipeline
    const silentBuffer = ctx.createBuffer(1, 1, 24000);
    const src = ctx.createBufferSource();
    src.buffer = silentBuffer;
    src.connect(ctx.destination);
    src.start(0);
    return ctx.state === 'running';
  } catch {
    return ctx.state === 'running';
  }
}

// Automatically unlock on the very first user gesture anywhere in the document
if (typeof window !== 'undefined') {
  const handleFirstGesture = () => {
    void unlockLiveAudioEngine().then((unlocked) => {
      if (unlocked) {
        window.removeEventListener('pointerdown', handleFirstGesture, true);
        window.removeEventListener('keydown', handleFirstGesture, true);
      }
    });
  };
  window.addEventListener('pointerdown', handleFirstGesture, true);
  window.addEventListener('keydown', handleFirstGesture, true);
}

export function setLiveOutputMuted(muted: boolean) {
  isMutedState = muted;
  if (masterGain && outputCtx) {
    masterGain.gain.setValueAtTime(muted ? 0 : 1, outputCtx.currentTime);
  }
}

export function stopAllLivePlayback() {
  for (const src of activeSources) {
    try {
      src.onended = null;
      src.stop(0);
      src.disconnect();
    } catch {
      // already stopped
    }
  }
  activeSources.clear();
  nextStartTime = 0;
  notifyPlaybackListeners();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  const binary = window.atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function enqueuePcm24kBase64(base64Pcm: string): boolean {
  const ctx = ensureOutputContext();
  if (!ctx || !masterGain || !base64Pcm) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }

  const bytes = base64ToUint8Array(base64Pcm);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  if (sampleCount <= 0) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 / 32768;
  }

  const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
  audioBuffer.getChannelData(0).set(float32);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(masterGain);

  const now = ctx.currentTime;
  const startAt = Math.max(now + 0.015, nextStartTime);
  nextStartTime = startAt + audioBuffer.duration;

  activeSources.add(source);
  notifyPlaybackListeners();

  source.onended = () => {
    activeSources.delete(source);
    try {
      source.disconnect();
    } catch {
      // ignore
    }
    if (activeSources.size === 0 && outputCtx) {
      nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
    }
    notifyPlaybackListeners();
  };

  source.start(startAt);
  return ctx.state === 'running';
}

export async function playServerAudioBase64(base64Audio: string): Promise<boolean> {
  const ctx = ensureOutputContext();
  if (!ctx || !masterGain || !base64Audio) return false;
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }

  const bytes = base64ToUint8Array(base64Audio);
  const isRiffWav =
    bytes.byteLength > 44 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46;   // F

  // Gemini TTS returns raw 24kHz 16-bit signed LE PCM when no RIFF header is present
  if (!isRiffWav) {
    return enqueuePcm24kBase64(base64Audio);
  }

  try {
    const bufferCopy = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const decoded = await ctx.decodeAudioData(bufferCopy);
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(masterGain);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.015, nextStartTime);
    nextStartTime = startAt + decoded.duration;

    activeSources.add(source);
    notifyPlaybackListeners();

    source.onended = () => {
      activeSources.delete(source);
      try {
        source.disconnect();
      } catch {
        // ignore
      }
      notifyPlaybackListeners();
    };

    source.start(startAt);
    return ctx.state === 'running';
  } catch {
    return enqueuePcm24kBase64(base64Audio);
  }
}

export function getLiveOutputLevel(): number {
  if (!outputAnalyser || !analyserData || activeSources.size === 0) {
    return 0;
  }
  outputAnalyser.getByteFrequencyData(analyserData);
  let sum = 0;
  const count = analyserData.length;
  for (let i = 0; i < count; i++) {
    sum += analyserData[i];
  }
  return Math.min(1, sum / (count * 135));
}

export function encodeFloat32To16kPcmBase64(
  input: Float32Array,
  inputSampleRate: number
): { base64: string; rms: number } {
  let sumSq = 0;
  for (let i = 0; i < input.length; i++) {
    sumSq += input[i] * input[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, input.length));

  const targetRate = 16000;
  let samples: Float32Array;

  if (!inputSampleRate || Math.abs(inputSampleRate - targetRate) < 50) {
    samples = input;
  } else {
    const ratio = inputSampleRate / targetRate;
    const outLength = Math.max(1, Math.round(input.length / ratio));
    samples = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.floor((i + 1) * ratio));
      let acc = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        acc += input[j];
        count++;
      }
      samples[i] = count > 0 ? acc / count : input[Math.min(start, input.length - 1)];
    }
  }

  const pcmBuffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(pcmBuffer);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
  }

  const bytes = new Uint8Array(pcmBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return {
    base64: window.btoa(binary),
    rms,
  };
}
