let mediaRecorder = null;
let audioStream = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  (async () => {
    switch (request.action) {
      case 'startCapture':
        try {
          // Stop any existing capture first
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder = null;
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
          
          // Set up MediaRecorder
          const options = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
          };
          
          mediaRecorder = new MediaRecorder(audioStream, options);
          
          mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                chrome.runtime.sendMessage({
                  type: 'audioData',
                  audio: base64
                });
              };
              reader.readAsDataURL(event.data);
            }
          };
          
          mediaRecorder.start(250);
          
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'stopCapture':
        if (mediaRecorder) {
          mediaRecorder.stop();
          mediaRecorder = null;
        }
        
        if (audioStream) {
          audioStream.getTracks().forEach(track => track.stop());
          audioStream = null;
        }
        
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  
  return true;
});