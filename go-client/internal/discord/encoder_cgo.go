//go:build cgo
// +build cgo

package discord

import "layeh.com/gopus"

type cgoOpusEncoder struct {
	encoder *gopus.Encoder
}

func newOpusEncoder() (OpusEncoder, error) {
	encoder, err := gopus.NewEncoder(48000, 1, gopus.Audio)
	if err != nil {
		return nil, err
	}
	return &cgoOpusEncoder{encoder: encoder}, nil
}

func (e *cgoOpusEncoder) Encode(pcm []int16, frameSize, maxBytes int) ([]byte, error) {
	return e.encoder.Encode(pcm, frameSize, maxBytes)
}

func (e *cgoOpusEncoder) SetBitrate(bitrate int) error {
	e.encoder.SetBitrate(bitrate)
	return nil
}
