import { rawContext, unlock } from "./engine";
import { holdDuck } from "./store";

// ============================================================================
// "Sing a tone": the microphone, heard locally (browser only).
//
// Privacy, as the page says beside the button: the sound is analysed in this
// tab, frame by frame, and thrown away. Nothing is recorded, stored or sent.
// The browser asks permission first (getUserMedia); stopping releases the
// microphone (every track stopped), so the browser's mic light goes out.
//
// Pitch: pitchy (MIT), the McLeod Pitch Method. A frame counts only when it is
// clear (clarity above 0.9) and loud enough, so breath and room noise do not
// throw the marker about. The browser's voice processing (echo cancelling,
// noise suppression, auto gain) is turned off: it bends pitch.
// ============================================================================

export interface Heard {
  hz: number;
  clarity: number;
}

export interface MicSession {
  stop: () => void;
}

/**
 * Start listening. Call from a click (it unlocks audio in the same gesture).
 * onPitch gets a clear pitch, or null while there is none.
 */
export async function startMic(onPitch: (heard: Heard | null) => void): Promise<MicSession> {
  if (!unlock()) throw new Error("This browser has no Web Audio.");
  const ctx = rawContext()!;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot use a microphone here.");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const { PitchDetector } = await import("pitchy");
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  // Not connected to the speakers: the voice is only analysed, never played back.
  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = -42;
  const release = holdDuck();
  let raf = 0;
  let last: number | null = null;
  const loop = () => {
    analyser.getFloatTimeDomainData(buf);
    const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);
    if (clarity > 0.9 && hz > 60 && hz < 1500) {
      // A light smoothing so the needle does not shiver.
      last = last === null ? hz : last * 0.6 + hz * 0.4;
      onPitch({ hz: last, clarity });
    } else {
      last = null;
      onPitch(null);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      release();
      onPitch(null);
    },
  };
}
