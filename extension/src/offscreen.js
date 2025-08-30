let audioContext = null;
let audioStream = null;
let audioWorkletNode = null;
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
          if (audioWorkletNode) {
            audioWorkletNode.disconnect();
            audioWorkletNode = null;
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
            sampleRate: 48000,  // Discord expects 48kHz
            latencyHint: 'interactive' // Request low latency
          });
          
          // Load AudioWorklet module
          await audioContext.audioWorklet.addModule('audio-processor.js');
          
          source = audioContext.createMediaStreamSource(audioStream);
          audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');
          
          // Handle messages from AudioWorklet
          audioWorkletNode.port.onmessage = (event) => {
            const { type, buffer, sampleRate, channels } = event.data;
            
            if (type === 'audioData') {
              // Convert ArrayBuffer to base64
              const uint8Array = new Uint8Array(buffer);
              
              // Optimized base64 conversion
              let base64;
              if (typeof TextDecoder !== 'undefined') {
                try {
                  const decoder = new TextDecoder('latin1');
                  const binaryString = decoder.decode(uint8Array);
                  base64 = btoa(binaryString);
                } catch (e) {
                  base64 = btoa(String.fromCharCode.apply(null, uint8Array));
                }
              } else {
                base64 = btoa(String.fromCharCode.apply(null, uint8Array));
              }
              
              chrome.runtime.sendMessage({
                type: 'audioData',
                audio: base64,
                format: 'pcm',
                sampleRate: sampleRate,
                channels: channels,
                bitDepth: 16
              });
            } else if (type === 'streamPause' || type === 'streamResume') {
              chrome.runtime.sendMessage({ type });
            }
          };
          
          source.connect(audioWorkletNode);
          audioWorkletNode.connect(audioContext.destination);
          
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
        
        if (audioWorkletNode) {
          audioWorkletNode.disconnect();
          audioWorkletNode = null;
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