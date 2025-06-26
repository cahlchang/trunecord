//go:build !cgo
// +build !cgo

package discord

import "fmt"

type noOpusEncoder struct{}

func newOpusEncoder() (OpusEncoder, error) {
	return nil, fmt.Errorf("this binary was built without audio support. Please download a platform-specific build from https://github.com/cahlchang/trunecord/releases or compile from source with CGO_ENABLED=1")
}

func (e *noOpusEncoder) Encode(pcm []int16, frameSize, maxBytes int) ([]byte, error) {
	return nil, fmt.Errorf("audio streaming is not supported in this build")
}

func (e *noOpusEncoder) SetBitrate(bitrate int) error {
	return fmt.Errorf("audio streaming is not supported in this build")
}