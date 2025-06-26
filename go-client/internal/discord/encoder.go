package discord

// OpusEncoder is an interface for Opus encoding
type OpusEncoder interface {
	Encode(pcm []int16, frameSize, maxBytes int) ([]byte, error)
	SetBitrate(bitrate int) error
}