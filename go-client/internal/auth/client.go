package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"trunecord/internal/constants"
)

type Client struct {
	BaseURL    string
	httpClient *http.Client
}

type Guild struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
}

type Channel struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}

type ChannelsResponse struct {
	Channels []Channel `json:"channels"`
}

type TokenData struct {
	Token  string  `json:"token"`
	Guilds []Guild `json:"guilds"`
}

type BotTokenResponse struct {
	BotToken string `json:"botToken"`
	Warning  string `json:"warning"`
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) GetAuthURL() string {
	// Simply append /api/auth to the base URL
	return fmt.Sprintf("%s/api/auth", c.BaseURL)
}

func (c *Client) ParseAuthCallback(callbackURL string) (*TokenData, error) {
	if strings.TrimSpace(callbackURL) == "" {
		return nil, fmt.Errorf("callback URL cannot be empty")
	}
	
	parsedURL, err := url.Parse(callbackURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse callback URL: %w", err)
	}

	query := parsedURL.Query()
	token := strings.TrimSpace(query.Get("token"))
	guildsParam := strings.TrimSpace(query.Get("guilds"))

	if token == "" || guildsParam == "" {
		return nil, fmt.Errorf("missing token or guilds in callback")
	}

	var guilds []Guild
	err = json.Unmarshal([]byte(guildsParam), &guilds)
	if err != nil {
		return nil, fmt.Errorf("failed to parse guilds data: %w", err)
	}

	return &TokenData{
		Token:  token,
		Guilds: guilds,
	}, nil
}

func (c *Client) GetGuilds(token string) ([]Guild, error) {
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("token cannot be empty")
	}
	
	guildsURL := fmt.Sprintf("%s/api/guilds", c.BaseURL)

	req, err := http.NewRequest("GET", guildsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set(constants.AuthorizationHeader, constants.BearerPrefix+token)
	req.Header.Set(constants.AcceptHeader, constants.ContentTypeJSON)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Lambda returns array directly, not wrapped in object
	var guilds []Guild
	err = json.NewDecoder(resp.Body).Decode(&guilds)
	if err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return guilds, nil
}

func (c *Client) GetChannels(guildID, token string) ([]Channel, error) {
	if strings.TrimSpace(guildID) == "" {
		return nil, fmt.Errorf("guildID cannot be empty")
	}
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("token cannot be empty")
	}
	
	// Validate guildID format (should be numeric Discord ID)
	if !isValidDiscordID(guildID) {
		return nil, fmt.Errorf("invalid guildID format")
	}
	
	// Use url.PathEscape to prevent path traversal attacks
	channelsURL := fmt.Sprintf("%s/api/guilds/%s/channels", c.BaseURL, url.PathEscape(guildID))

	req, err := http.NewRequest("GET", channelsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set(constants.AuthorizationHeader, constants.BearerPrefix+token)
	req.Header.Set(constants.AcceptHeader, constants.ContentTypeJSON)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var channelsResp ChannelsResponse
	err = json.NewDecoder(resp.Body).Decode(&channelsResp)
	if err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return channelsResp.Channels, nil
}

// Helper function to validate Discord ID format
func isValidDiscordID(id string) bool {
	// Discord IDs are 64-bit unsigned integers
	if len(id) < constants.MinDiscordIDLength || len(id) > constants.MaxDiscordIDLength {
		return false
	}
	for _, char := range id {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

func (c *Client) VerifyToken(token string) (bool, error) {
	if strings.TrimSpace(token) == "" {
		return false, fmt.Errorf("token cannot be empty")
	}
	
	verifyURL := fmt.Sprintf("%s%s", c.BaseURL, constants.APIVerifyPath)

	req, err := http.NewRequest("GET", verifyURL, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set(constants.AuthorizationHeader, constants.BearerPrefix+token)
	req.Header.Set(constants.AcceptHeader, constants.ContentTypeJSON)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

func (c *Client) GetBotToken(token string) (string, error) {
	if strings.TrimSpace(token) == "" {
		return "", fmt.Errorf("token cannot be empty")
	}
	
	botTokenURL := fmt.Sprintf("%s%s", c.BaseURL, constants.APIBotTokenPath)

	req, err := http.NewRequest("GET", botTokenURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set(constants.AuthorizationHeader, constants.BearerPrefix+token)
	req.Header.Set(constants.AcceptHeader, constants.ContentTypeJSON)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var botTokenResp BotTokenResponse
	err = json.NewDecoder(resp.Body).Decode(&botTokenResp)
	if err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return botTokenResp.BotToken, nil
}
