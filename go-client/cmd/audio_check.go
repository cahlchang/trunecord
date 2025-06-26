package main

import (
	"trunecord/internal/discord"
)

// checkAudioSupport verifies if the binary was built with audio streaming support
func checkAudioSupport() error {
	// Try to create an encoder to test if CGO/audio support is available
	encoder, err := discord.NewOpusEncoderTest()
	if err != nil {
		return err
	}
	
	// Test encoding a dummy frame
	dummyPCM := make([]int16, 960) // 20ms at 48kHz
	_, err = encoder.Encode(dummyPCM, 960, 4000)
	return err
}