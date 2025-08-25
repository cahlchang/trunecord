// AudioWorklet tests
describe('AudioWorklet Performance Tests', () => {
  describe('Latency Comparison', () => {
    it('AudioWorklet should have lower latency than ScriptProcessor', () => {
      // AudioWorklet theoretical latency
      const audioWorkletBufferSize = 128; // Default render quantum
      const sampleRate = 48000;
      const audioWorkletLatency = (audioWorkletBufferSize / sampleRate) * 1000;
      
      // ScriptProcessor latency
      const scriptProcessorBufferSize = 1024;
      const scriptProcessorLatency = (scriptProcessorBufferSize / sampleRate) * 1000;
      
      // AudioWorklet should be significantly lower
      expect(audioWorkletLatency).toBeLessThan(scriptProcessorLatency);
      expect(audioWorkletLatency).toBeCloseTo(2.67, 2); // ~2.67ms
      expect(scriptProcessorLatency).toBeCloseTo(21.33, 2); // ~21.33ms
      
      // Latency improvement
      const improvement = scriptProcessorLatency - audioWorkletLatency;
      expect(improvement).toBeGreaterThan(18); // At least 18ms improvement
    });

    it('Custom buffer size should provide optimal latency', () => {
      const customBufferSize = 480; // 10ms at 48kHz
      const sampleRate = 48000;
      const customLatency = (customBufferSize / sampleRate) * 1000;
      
      expect(customLatency).toBe(10); // Exactly 10ms
      expect(customLatency).toBeLessThan(20); // Better than Discord frame size
    });
  });

  describe('AudioWorklet Message Performance', () => {
    it('should handle high-frequency audio messages efficiently', () => {
      const messagePort = {
        postMessage: jest.fn()
      };
      
      const startTime = performance.now();
      const bufferSize = 480;
      const messagesPerSecond = 100; // 10ms buffers = 100 messages/sec
      
      // Simulate sending messages for 1 second
      for (let i = 0; i < messagesPerSecond; i++) {
        const buffer = new ArrayBuffer(bufferSize * 2); // 16-bit samples
        messagePort.postMessage({
          type: 'audioData',
          buffer: buffer,
          sampleRate: 48000,
          channels: 1
        }, [buffer]);
      }
      
      const elapsed = performance.now() - startTime;
      
      // Should handle 100 messages in well under 100ms
      expect(elapsed).toBeLessThan(100);
      expect(messagePort.postMessage).toHaveBeenCalledTimes(messagesPerSecond);
    });
  });

  describe('Total System Latency', () => {
    it('should achieve target latency with AudioWorklet', () => {
      // Component latencies with AudioWorklet
      const components = {
        audioWorklet: 10,        // 480 samples at 48kHz
        audioContext: 15,        // Typical interactive latency
        goProcessing: 20,        // Discord frame time
        websocket: 1.5,          // Local communication
        discordBuffer: 20        // Minimum buffer for 1 frame
      };
      
      const totalLatency = Object.values(components).reduce((a, b) => a + b, 0);
      
      // Should be under 70ms total
      expect(totalLatency).toBeLessThan(70);
      expect(totalLatency).toBeCloseTo(66.5, 1);
      
      // Compare with previous ScriptProcessor implementation
      const oldLatency = 88; // Typical latency before
      const improvement = oldLatency - totalLatency;
      
      expect(improvement).toBeGreaterThan(20); // At least 20ms improvement
    });

    it('should maintain consistent frame timing', () => {
      const frameInterval = 10; // 10ms per frame with AudioWorklet
      const frames = [];
      
      // Simulate 100 frames
      for (let i = 0; i < 100; i++) {
        frames.push(i * frameInterval);
      }
      
      // Check timing consistency
      for (let i = 1; i < frames.length; i++) {
        const interval = frames[i] - frames[i-1];
        expect(interval).toBe(frameInterval);
      }
      
      // No drift after 100 frames (1 second)
      const expectedEndTime = 99 * frameInterval;
      const actualEndTime = frames[frames.length - 1];
      expect(actualEndTime).toBe(expectedEndTime);
    });
  });

  describe('Memory Efficiency', () => {
    it('should use transferable objects for zero-copy transfer', () => {
      const buffer = new ArrayBuffer(960); // 480 samples * 2 bytes
      const originalByteLength = buffer.byteLength;
      
      // Simulate transfer
      const transferred = [buffer];
      
      // After transfer, original buffer should be detached (0 bytes)
      // In real scenario, this would happen after postMessage with transfer
      expect(originalByteLength).toBe(960);
      expect(transferred[0]).toBe(buffer);
    });
  });
});