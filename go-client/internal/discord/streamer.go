package discord

import (
	"encoding/binary"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/bwmarrin/discordgo"
	"trunecord/internal/constants"
)

type Streamer struct {
	session     *discordgo.Session
	voiceConn   *discordgo.VoiceConnection
	guildID     string
	channelID   string
	connected   bool
	streaming   bool
	audioBuffer chan []byte
	stopChannel chan bool
	mutex       sync.RWMutex
	encoder     OpusEncoder
}

func NewStreamer() *Streamer {
	return &Streamer{
		audioBuffer: make(chan []byte, constants.AudioBufferSize),
		stopChannel: make(chan bool),
	}
}

func (s *Streamer) Connect(botToken, guildID, channelID string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Create Discord session
	session, err := discordgo.New("Bot " + botToken)
	if err != nil {
		return fmt.Errorf("failed to create Discord session: %v", err)
	}

	// Open connection
	err = session.Open()
	if err != nil {
		return fmt.Errorf("failed to open Discord connection: %v", err)
	}

	s.session = session
	s.guildID = guildID
	s.channelID = channelID

	// Join voice channel
	voiceConn, err := session.ChannelVoiceJoin(guildID, channelID, false, true)
	if err != nil {
		s.session.Close()
		return fmt.Errorf("failed to join voice channel: %v", err)
	}

	s.voiceConn = voiceConn
	s.connected = true

	log.Printf("Connected to Discord voice channel %s in guild %s", channelID, guildID)
	return nil
}

func (s *Streamer) Disconnect() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.streaming {
		s.stopStreaming()
	}

	if s.voiceConn != nil {
		s.voiceConn.Disconnect()
		s.voiceConn = nil
	}

	if s.session != nil {
		s.session.Close()
		s.session = nil
	}

	s.connected = false
	log.Printf("Disconnected from Discord")
	return nil
}

func (s *Streamer) StartStreaming(audioChannel <-chan []byte) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.connected || s.voiceConn == nil {
		return fmt.Errorf("not connected to Discord voice channel")
	}

	if s.streaming {
		return fmt.Errorf("already streaming")
	}

	// Create Opus encoder
	// 48000 Hz sample rate, 1 channel (mono), Audio application for music
	encoder, err := newOpusEncoder()
	if err != nil {
		return fmt.Errorf("failed to create opus encoder: %v", err)
	}

	// Set bitrate for better quality
	if err := encoder.SetBitrate(constants.OpusBitrate); err != nil {
		return fmt.Errorf("failed to set opus bitrate: %v", err)
	}

	s.encoder = encoder

	s.streaming = true

	// Start audio streaming goroutine
	go s.streamAudio(audioChannel)

	log.Printf("Started audio streaming to Discord")
	return nil
}

func (s *Streamer) StopStreaming() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.streaming {
		return nil
	}

	s.stopStreaming()
	log.Printf("Stopped audio streaming")
	return nil
}

func (s *Streamer) stopStreaming() {
	s.streaming = false
	select {
	case s.stopChannel <- true:
	default:
	}
}

func (s *Streamer) streamAudio(audioChannel <-chan []byte) {
	if s.voiceConn == nil {
		log.Printf("Voice connection is nil")
		return
	}

	// Wait for voice connection to be ready
	for !s.voiceConn.Ready {
		time.Sleep(constants.VoiceConnectionWaitDelay)
	}

	// Start speaking
	s.voiceConn.Speaking(true)
	defer s.voiceConn.Speaking(false)

	// Discord expects specific samples per frame at 48kHz (20ms)
	const frameSize = constants.PCMFrameSize
	const bytesPerSample = constants.PCMBytesPerSample
	const frameSizeBytes = constants.PCMFrameSizeBytes

	// Larger buffer to prevent underruns
	pcmBuffer := make([]byte, 0, constants.PCMFrameSizeBytes*constants.PCMBufferMultiplier)

	// Timing control for consistent audio frames
	ticker := time.NewTicker(constants.AudioFrameInterval)
	defer ticker.Stop()

	// Reduce initial delay for lower latency
	time.Sleep(constants.InitialStreamingDelay)

	for {
		select {
		case <-s.stopChannel:
			return

		case audioData := <-audioChannel:
			if !s.streaming || s.encoder == nil {
				return
			}

			// Append new audio data to buffer
			pcmBuffer = append(pcmBuffer, audioData...)

		case <-ticker.C:
			// Process one frame every 20ms
			if len(pcmBuffer) >= frameSizeBytes {
				// Extract one frame
				frame := pcmBuffer[:frameSizeBytes]
				pcmBuffer = pcmBuffer[frameSizeBytes:]

				// Convert byte array to int16 array
				pcm := make([]int16, frameSize)
				for i := 0; i < frameSize; i++ {
					pcm[i] = int16(binary.LittleEndian.Uint16(frame[i*2 : (i+1)*2]))
				}

				// Encode to Opus
				opus, err := s.encoder.Encode(pcm, frameSize, frameSizeBytes)
				if err != nil {
					log.Printf("Failed to encode audio: %v", err)
					continue
				}

				// Send to Discord (non-blocking)
				select {
				case s.voiceConn.OpusSend <- opus:
					// Audio sent successfully
				default:
					// If channel is full, skip but don't log every time
				}
			}
		}
	}
}

func (s *Streamer) IsConnected() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.connected
}

func (s *Streamer) IsStreaming() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.streaming
}

func (s *Streamer) GetGuildID() string {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.guildID
}

func (s *Streamer) GetChannelID() string {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.channelID
}
