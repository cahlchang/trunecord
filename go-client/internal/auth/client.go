package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

type Client struct {
	BaseURL string
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
	}
}

func (c *Client) GetAuthURL() string {
	baseURL, err := url.Parse(c.BaseURL)
	if err != nil {
		// Fallback to string concatenation if URL parsing fails
		return fmt.Sprintf("%s/api/auth?redirect_protocol=http", c.BaseURL)
	}
	
	baseURL.Path = "/api/auth"
	
	query := baseURL.Query()
	query.Set("redirect_protocol", "http")
	baseURL.RawQuery = query.Encode()
	
	return baseURL.String()
}

func (c *Client) ParseAuthCallback(callbackURL string) (*TokenData, error) {
	parsedURL, err := url.Parse(callbackURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse callback URL: %v", err)
	}

	query := parsedURL.Query()
	token := query.Get("token")
	guildsParam := query.Get("guilds")

	if token == "" || guildsParam == "" {
		return nil, fmt.Errorf("missing token or guilds in callback")
	}

	var guilds []Guild
	err = json.Unmarshal([]byte(guildsParam), &guilds)
	if err != nil {
		return nil, fmt.Errorf("failed to parse guilds data: %v", err)
	}

	return &TokenData{
		Token:  token,
		Guilds: guilds,
	}, nil
}

func (c *Client) GetGuilds(token string) ([]Guild, error) {
	url := fmt.Sprintf("%s/api/guilds", c.BaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %v", err)
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
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	return guilds, nil
}

func (c *Client) GetChannels(guildID, token string) ([]Channel, error) {
	url := fmt.Sprintf("%s/api/guilds/%s/channels", c.BaseURL, guildID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var channelsResp ChannelsResponse
	err = json.NewDecoder(resp.Body).Decode(&channelsResp)
	if err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	return channelsResp.Channels, nil
}

func (c *Client) VerifyToken(token string) (bool, error) {
	url := fmt.Sprintf("%s/api/verify", c.BaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

func (c *Client) GetBotToken(token string) (string, error) {
	url := fmt.Sprintf("%s/api/bot-token", c.BaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var botTokenResp BotTokenResponse
	err = json.NewDecoder(resp.Body).Decode(&botTokenResp)
	if err != nil {
		return "", fmt.Errorf("failed to decode response: %v", err)
	}

	return botTokenResp.BotToken, nil
}
