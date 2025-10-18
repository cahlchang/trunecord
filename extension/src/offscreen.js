let audioContext = null;
let audioStream = null;
let audioWorkletNode = null;
let source = null;
let isCapturing = false;

async function handleStartCapture(request, sendResponse) {
  if (isCapturing) {
    console.log('Already capturing, ignoring duplicate request');
    sendResponse({ success: true });
    return;
  }

  try {
    isCapturing = true;

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
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
    }

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: request.streamId,
        },
      },
      video: false,
    });

    audioContext = new AudioContext({
      sampleRate: 48000,
      latencyHint: 'interactive',
    });

    await audioContext.audioWorklet.addModule('audio-processor.js');

    source = audioContext.createMediaStreamSource(audioStream);
    audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');

    audioWorkletNode.port.onmessage = (event) => {
      const { type, buffer, sampleRate, channels } = event.data;

      if (type === 'audioData') {
        const uint8Array = new Uint8Array(buffer);
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
          sampleRate,
          channels,
          bitDepth: 16,
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
}

async function handleStopCapture(sendResponse) {
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
    await audioContext.close();
    audioContext = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }

  console.log('Audio capture stopped');
  sendResponse({ success: true });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request.action !== 'string') {
    return false;
  }

  if (request.action === 'startCapture') {
    handleStartCapture(request, sendResponse);
    return true;
  }

  if (request.action === 'stopCapture') {
    handleStopCapture(sendResponse);
    return true;
  }

  return false;
});

// Notify background script that the offscreen document is ready to receive messages.
if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
  chrome.runtime
    .sendMessage({ action: 'offscreenReady' })
    .catch(() => {});
}
