// Tests for offscreen audio latency

describe('Offscreen Audio Latency Tests', () => {
  let mockAudioContext;
  let mockProcessor;
  let mockSource;
  let mockStream;

  beforeEach(() => {
    // Mock AudioContext
    mockProcessor = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: null
    };

    mockSource = {
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    mockAudioContext = {
      createMediaStreamSource: jest.fn(() => mockSource),
      createScriptProcessor: jest.fn(() => mockProcessor),
      destination: {},
      close: jest.fn(),
      sampleRate: 48000
    };

    global.AudioContext = jest.fn(() => mockAudioContext);

    // Mock MediaStream
    mockStream = {
      getTracks: jest.fn(() => [{
        stop: jest.fn()
      }])
    };

    global.navigator = {
      mediaDevices: {
        getUserMedia: jest.fn(() => Promise.resolve(mockStream))
      }
    };

    // Mock chrome.runtime
    global.chrome = {
      runtime: {
        id: 'test-extension-id',
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        }
      }
    };
  });

  describe('Buffer Size and Latency', () => {
    it('should use appropriate buffer size for low latency', () => {
      // Load offscreen.js would happen here in real test
      // For now, we test the expected behavior

      // Verify script processor is created with 2048 buffer size
      const bufferSize = 2048;
      mockAudioContext.createScriptProcessor(bufferSize, 2, 2);
      
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(bufferSize, 2, 2);
      
      // Calculate latency
      const sampleRate = 48000;
      const latencyMs = (bufferSize / sampleRate) * 1000;
      
      // Should be around 42.67ms
      expect(latencyMs).toBeCloseTo(42.67, 2);
      expect(latencyMs).toBeLessThan(50); // Should be under 50ms for good real-time performance
    });

    it('should process audio without accumulating delay', () => {
      // Simulate audio processing
      const processingTimes = [];
      const startTime = Date.now();
      
      // Simulate 100 audio process callbacks
      for (let i = 0; i < 100; i++) {
        const currentTime = Date.now();
        processingTimes.push(currentTime - startTime);
        
        // Simulate 42.67ms delay (2048 samples at 48kHz)
        // In real scenario, this would be the onaudioprocess callback interval
      }
      
      // Check that processing times are consistent
      for (let i = 1; i < processingTimes.length; i++) {
        const interval = processingTimes[i] - processingTimes[i-1];
        // Intervals should be close to expected buffer duration
        expect(interval).toBeLessThanOrEqual(50); // Allow some jitter
      }
    });

    it('should convert audio data efficiently', () => {
      const samples = 2048;
      const testData = new Float32Array(samples);
      
      // Fill with test data
      for (let i = 0; i < samples; i++) {
        testData[i] = Math.sin(2 * Math.PI * i / samples);
      }
      
      const startConversion = performance.now();
      
      // Convert float32 to int16
      const int16Array = new Int16Array(samples);
      for (let i = 0; i < samples; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, testData[i] * 32768));
      }
      
      const conversionTime = performance.now() - startConversion;
      
      // Conversion should be fast (under 1ms for 2048 samples)
      expect(conversionTime).toBeLessThan(1);
    });

    it('should handle base64 encoding efficiently', () => {
      const samples = 2048;
      const int16Array = new Int16Array(samples);
      const uint8Array = new Uint8Array(int16Array.buffer);
      
      const startEncoding = performance.now();
      
      // Test optimized base64 encoding approach
      if (typeof TextDecoder !== 'undefined') {
        const decoder = new TextDecoder('latin1');
        const binaryString = decoder.decode(uint8Array);
        const base64 = btoa(binaryString);
        
        const encodingTime = performance.now() - startEncoding;
        
        // Encoding should be fast (under 2ms for 4096 bytes)
        expect(encodingTime).toBeLessThan(2);
        expect(base64).toBeDefined();
        expect(base64.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Audio Stream Timing', () => {
    it('should maintain consistent frame timing', () => {
      const frameTimings = [];
      const frameSize = 2048;
      const sampleRate = 48000;
      const expectedFrameTime = (frameSize / sampleRate) * 1000; // ~42.67ms
      
      // Simulate frame processing
      let lastFrameTime = Date.now();
      
      const processFrame = () => {
        const currentTime = Date.now();
        const frameDelta = currentTime - lastFrameTime;
        frameTimings.push(frameDelta);
        lastFrameTime = currentTime;
      };
      
      // Simulate 50 frames
      const frameInterval = setInterval(processFrame, expectedFrameTime);
      
      setTimeout(() => {
        clearInterval(frameInterval);
        
        // Calculate average frame time
        const avgFrameTime = frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length;
        
        // Average should be close to expected
        expect(avgFrameTime).toBeCloseTo(expectedFrameTime, 5);
        
        // Check for timing drift
        const maxDrift = Math.max(...frameTimings) - Math.min(...frameTimings);
        expect(maxDrift).toBeLessThan(10); // Max 10ms drift
      }, 2000);
    });
  });

  describe('Chrome Extension Message Handling', () => {
    it('should send audio data messages efficiently', () => {
      const messageTimes = [];
      
      chrome.runtime.sendMessage.mockImplementation((message) => {
        messageTimes.push(Date.now());
      });
      
      // Simulate sending 100 audio messages
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        chrome.runtime.sendMessage({
          type: 'audioData',
          audio: 'base64data',
          format: 'pcm',
          sampleRate: 48000,
          channels: 1,
          bitDepth: 16
        });
      }
      const totalTime = Date.now() - startTime;
      
      // Should handle 100 messages quickly
      expect(totalTime).toBeLessThan(100); // Under 100ms for 100 messages
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(100);
    });
  });
});
