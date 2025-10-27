package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	DiscordBotToken string
	WebSocketPort   string
	WebPort         string
	AuthAPIURL      string
}

func Load() (*Config, error) {
	config := &Config{
		WebSocketPort:   getEnvOrDefault("WEBSOCKET_PORT", "8765"),
		WebPort:         getEnvOrDefault("WEB_PORT", "48766"),
		AuthAPIURL:      getEnvOrDefault("AUTH_API_URL", "https://m0j3mh0nyj.execute-api.ap-northeast-1.amazonaws.com/prod"),
		DiscordBotToken: os.Getenv("DISCORD_BOT_TOKEN"), // Optional, will be fetched from auth server
	}

	// Validate ports
	if err := validatePort(config.WebSocketPort); err != nil {
		return nil, fmt.Errorf("invalid WebSocket port: %v", err)
	}
	if err := validatePort(config.WebPort); err != nil {
		return nil, fmt.Errorf("invalid web port: %v", err)
	}

	return config, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func validatePort(port string) error {
	portNum, err := strconv.Atoi(port)
	if err != nil {
		return fmt.Errorf("port must be a number: %s", port)
	}
	if portNum < 1 || portNum > 65535 {
		return fmt.Errorf("port must be between 1 and 65535: %d", portNum)
	}
	return nil
}
