let audioContext = null;
let audioStream = null;
let processor = null;
let source = null;
let isCapturing = false;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  (async () => {
    switch (request.action) {
      case 'startCapture':
        if (isCapturing) {
          console.log('Already capturing, ignoring duplicate request');
          sendResponse({ success: true });
          return;
        }
        
        try {
          isCapturing = true;
          
          // Stop any existing capture first
          if (processor) {
            processor.disconnect();
            processor = null;
          }
          
          if (source) {
            source.disconnect();
            source = null;
          }
          
          if (audioContext) {
            await audioContext.close();
            audioContext = null;
          }
          
          if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
          }
          
          // Get the media stream using the streamId
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: request.streamId
              }
            },
            video: false
          });
          
          // Create audio context for processing
          audioContext = new AudioContext({
            sampleRate: 48000  // Discord expects 48kHz
          });
          
          source = audioContext.createMediaStreamSource(audioStream);
          // Use smaller buffer for lower latency (2048 samples = ~42ms at 48kHz)
          processor = audioContext.createScriptProcessor(2048, 2, 2);
          
          let isSilent = false;
          let silentFrames = 0;
          
          processor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer;
            const samples = [];
            let maxAmplitude = 0;
            
            // Convert to mono by averaging channels
            for (let i = 0; i < inputData.length; i++) {
              const leftChannel = inputData.getChannelData(0)[i];
              const rightChannel = inputData.numberOfChannels > 1 ? inputData.getChannelData(1)[i] : leftChannel;
              const monoSample = (leftChannel + rightChannel) / 2;
              
              // Track max amplitude for silence detection
              maxAmplitude = Math.max(maxAmplitude, Math.abs(monoSample));
              
              // Convert float32 to int16
              const int16Sample = Math.max(-32768, Math.min(32767, monoSample * 32768));
              samples.push(int16Sample);
            }
            
            // Check if audio is silent (threshold: 0.001)
            const currentlySilent = maxAmplitude < 0.001;
            
            // Detect silence/sound transitions
            if (currentlySilent && !isSilent) {
              silentFrames++;
              if (silentFrames > 10) { // About 0.5 seconds of silence
                isSilent = true;
                chrome.runtime.sendMessage({ type: 'streamPause' });
              }
            } else if (!currentlySilent && isSilent) {
              isSilent = false;
              silentFrames = 0;
              chrome.runtime.sendMessage({ type: 'streamResume' });
            } else if (!currentlySilent) {
              silentFrames = 0;
            }
            
            // Convert to byte array - optimized for performance
            const int16Array = new Int16Array(samples);
            const uint8Array = new Uint8Array(int16Array.buffer);
            
            // Helper function for fallback base64 conversion
            function arrayBufferToBase64Fallback(uint8Array) {
              const chunkSize = 8192; // Process in chunks to avoid stack overflow
              let binary = '';
              for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk);
              }
              return btoa(binary);
            }
            
            // Convert to base64 - optimized for large buffers
            let base64;
            if (typeof TextDecoder !== 'undefined') {
              // Modern approach using TextDecoder (faster for large buffers)
              try {
                const decoder = new TextDecoder('latin1');
                const binaryString = decoder.decode(uint8Array);
                base64 = btoa(binaryString);
              } catch (e) {
                // Fallback if TextDecoder fails
                base64 = arrayBufferToBase64Fallback(uint8Array);
              }
            } else {
              // Fallback for older browsers
              base64 = arrayBufferToBase64Fallback(uint8Array);
            }
            
            chrome.runtime.sendMessage({
              type: 'audioData',
              audio: base64,
              format: 'pcm',
              sampleRate: 48000,
              channels: 1,
              bitDepth: 16
            });
          };
          
          source.connect(processor);
          processor.connect(audioContext.destination);
          
          sendResponse({ success: true });
          console.log('Audio capture started successfully');
        } catch (error) {
          console.error('Failed to start capture:', error);
          isCapturing = false;
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'stopCapture':
        isCapturing = false;
        
        if (processor) {
          processor.disconnect();
          processor = null;
        }
        
        if (source) {
          source.disconnect();
          source = null;
        }
        
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        
        if (audioStream) {
          audioStream.getTracks().forEach(track => track.stop());
          audioStream = null;
        }
        
        console.log('Audio capture stopped');
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  
  return true;
});