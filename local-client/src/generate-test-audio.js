const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Generate a test audio file using FFmpeg
const outputPath = path.join(__dirname, '../assets/test-audio.webm');

console.log('Generating test audio file...');

const ffmpeg = spawn('ffmpeg', [
  '-y', // Overwrite output file
  '-f', 'lavfi',
  '-i', 'sine=frequency=440:duration=3', // 440Hz (A4 note) for 3 seconds
  '-c:a', 'libopus',
  '-b:a', '128k',
  '-ar', '48000', // Sample rate 48kHz (Discord standard)
  '-ac', '2', // Stereo
  '-application', 'audio',
  '-frame_duration', '20',
  '-packet_loss', '0',
  '-vbr', 'off',
  '-f', 'webm',
  outputPath
]);

ffmpeg.stderr.on('data', (data) => {
  console.log('FFmpeg:', data.toString());
});

ffmpeg.on('close', (code) => {
  if (code === 0) {
    console.log('Test audio file generated successfully at:', outputPath);
    
    // Read the file and convert to base64
    const audioData = fs.readFileSync(outputPath);
    const base64Data = audioData.toString('base64');
    
    console.log('File size:', audioData.length, 'bytes');
    console.log('Base64 length:', base64Data.length);
    console.log('First 100 chars of base64:', base64Data.substring(0, 100));
    
    // Save base64 to a separate file for easy access
    const base64Path = path.join(__dirname, '../assets/test-audio-base64.txt');
    fs.writeFileSync(base64Path, base64Data);
    console.log('Base64 data saved to:', base64Path);
  } else {
    console.error('FFmpeg exited with code:', code);
  }
});

ffmpeg.on('error', (error) => {
  console.error('FFmpeg error:', error);
});