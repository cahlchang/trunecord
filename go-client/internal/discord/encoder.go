package discord

// OpusEncoder is an interface for Opus encoding
type OpusEncoder interface {
	Encode(pcm []int16, frameSize, maxBytes int) ([]byte, error)
	SetBitrate(bitrate int) error
}

// NewOpusEncoderTest creates a new Opus encoder for testing purposes
func NewOpusEncoderTest() (OpusEncoder, error) {
	return newOpusEncoder()
}
