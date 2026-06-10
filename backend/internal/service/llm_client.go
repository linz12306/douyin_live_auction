package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type LLMMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type LLMRequest struct {
	Messages     []LLMMessage
	JSONResponse bool
}

type LLMClient interface {
	Generate(ctx context.Context, req LLMRequest) (string, error)
}

type ChatCompletionClient struct {
	endpoint  string
	apiKey    string
	model     string
	maxTokens int
	http      *http.Client
}

func NewChatCompletionClient(baseURL, apiKey, model string, timeout time.Duration, maxTokens int) *ChatCompletionClient {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	if maxTokens <= 0 {
		maxTokens = 700
	}
	return &ChatCompletionClient{
		endpoint:  chatCompletionsEndpoint(baseURL),
		apiKey:    apiKey,
		model:     model,
		maxTokens: maxTokens,
		http:      &http.Client{Timeout: timeout},
	}
}

func (c *ChatCompletionClient) Generate(ctx context.Context, req LLMRequest) (string, error) {
	if strings.TrimSpace(c.endpoint) == "" || strings.TrimSpace(c.apiKey) == "" || strings.TrimSpace(c.model) == "" {
		return "", ErrAIConfigMissing
	}

	payload := map[string]interface{}{
		"model":      c.model,
		"messages":   req.Messages,
		"max_tokens": c.maxTokens,
	}
	if req.JSONResponse {
		payload["response_format"] = map[string]string{"type": "json_object"}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("AI模型请求失败: HTTP %d", resp.StatusCode)
	}

	var decoded struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		return "", err
	}
	if len(decoded.Choices) == 0 || strings.TrimSpace(decoded.Choices[0].Message.Content) == "" {
		return "", errors.New("AI模型返回为空")
	}
	return strings.TrimSpace(decoded.Choices[0].Message.Content), nil
}

func chatCompletionsEndpoint(baseURL string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		return ""
	}
	if strings.HasSuffix(trimmed, "/v1") {
		return trimmed + "/chat/completions"
	}
	return trimmed + "/v1/chat/completions"
}
