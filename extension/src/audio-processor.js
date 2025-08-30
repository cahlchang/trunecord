// AudioWorklet processor for low-latency audio capture
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 480; // 10ms at 48kHz for lower latency
    this.buffer = [];
    this.silentFrames = 0;
    this.isSilent = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input && input.length > 0) {
      const leftChannel = input[0];
      const rightChannel = input[1] || leftChannel;
      
      // Convert stereo to mono and accumulate samples
      for (let i = 0; i < leftChannel.length; i++) {
        const monoSample = (leftChannel[i] + rightChannel[i]) / 2;
        this.buffer.push(monoSample);
      }
      
      // Process when we have enough samples
      while (this.buffer.length >= this.bufferSize) {
        const samples = this.buffer.splice(0, this.bufferSize);
        let maxAmplitude = 0;
        
        // Convert float32 to int16 and check amplitude
        const int16Array = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(samples[i]));
          int16Array[i] = Math.max(-32768, Math.min(32767, samples[i] * 32768));
        }
        
        // Silence detection
        const currentlySilent = maxAmplitude < 0.001;
        
        if (currentlySilent && !this.isSilent) {
          this.silentFrames++;
          if (this.silentFrames > 50) { // ~500ms of silence
            this.isSilent = true;
            this.port.postMessage({ type: 'streamPause' });
          }
        } else if (!currentlySilent && this.isSilent) {
          this.isSilent = false;
          this.silentFrames = 0;
          this.port.postMessage({ type: 'streamResume' });
        } else if (!currentlySilent) {
          this.silentFrames = 0;
        }
        
        // Send audio data
        this.port.postMessage({
          type: 'audioData',
          buffer: int16Array.buffer,
          sampleRate: 48000,
          channels: 1
        }, [int16Array.buffer]); // Transfer buffer for efficiency
      }
    }
    
    // Keep processor alive
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);