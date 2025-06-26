//go:build !cgo
// +build !cgo

package discord

import "fmt"

type noOpusEncoder struct{}

func newOpusEncoder() (OpusEncoder, error) {
	return &noOpusEncoder{}, nil
}

func (e *noOpusEncoder) Encode(pcm []int16, frameSize, maxBytes int) ([]byte, error) {
	return nil, fmt.Errorf("opus encoding requires CGO to be enabled")
}

func (e *noOpusEncoder) SetBitrate(bitrate int) error {
	return fmt.Errorf("opus encoding requires CGO to be enabled")
}
