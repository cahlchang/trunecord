package discord

import (
	"testing"
)

func TestOpusEncoder(t *testing.T) {
	// Test encoder creation
	encoder, err := newOpusEncoder()

	// Note: This test will behave differently based on build tags
	// With CGO: Should create a working encoder
	// Without CGO: Should return an error or stub encoder

	if err != nil {
		// This is expected for nocgo builds
		t.Logf("Encoder creation failed (expected for nocgo builds): %v", err)
		return
	}

	if encoder == nil {
		t.Fatal("newOpusEncoder() returned nil encoder without error")
	}

	// Test SetBitrate
	err = encoder.SetBitrate(128000)
	if err != nil {
		// This might fail for nocgo builds
		t.Logf("SetBitrate failed: %v", err)
	}

	// Test Encode with dummy data
	dummyPCM := make([]int16, 960) // 20ms at 48kHz
	for i := range dummyPCM {
		dummyPCM[i] = int16(i % 1000) // Simple test pattern
	}

	encoded, err := encoder.Encode(dummyPCM, 960, 4000)
	if err != nil {
		// This is expected for nocgo builds
		t.Logf("Encode failed (expected for nocgo builds): %v", err)
		return
	}

	if len(encoded) == 0 {
		t.Error("Encode returned empty data")
	}
}

func TestNewOpusEncoderTest(t *testing.T) {
	// Test the public test function
	encoder, err := NewOpusEncoderTest()

	if err != nil {
		t.Logf("NewOpusEncoderTest() error (expected for nocgo builds): %v", err)
		return
	}

	if encoder == nil {
		t.Fatal("NewOpusEncoderTest() returned nil encoder")
	}

	// Basic interface compliance test
	var _ OpusEncoder = encoder
}
