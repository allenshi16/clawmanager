package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"clawreef/internal/models"
	"clawreef/internal/repository"
)

// ChannelService defines channel operations
type ChannelService interface {
	CreateChannel(req CreateChannelRequest) (*models.Channel, error)
	GetChannel(id int) (*models.Channel, error)
	ListChannels(userID int) ([]models.Channel, error)
	UpdateChannel(id int, req UpdateChannelRequest) (*models.Channel, error)
	DeleteChannel(id int) error
	HandleInbound(channelID int, payload []byte) error
	SendOutbound(channelID int, content string, externalChatID string) error
	HandleCommandFinished(commandID int) error
}

// CreateChannelRequest contains fields for creating a channel
type CreateChannelRequest struct {
	UserID      int                `json:"-"`
	InstanceID  *int               `json:"instance_id,omitempty"`
	Type        models.ChannelType `json:"type"`
	Name        string             `json:"name"`
	Description *string            `json:"description,omitempty"`
	BotToken    *string            `json:"bot_token,omitempty"`
	AppID       *string            `json:"app_id,omitempty"`
	AppSecret   *string            `json:"app_secret,omitempty"`
}

// UpdateChannelRequest contains fields for updating a channel
type UpdateChannelRequest struct {
	Name        *string            `json:"name,omitempty"`
	Description *string            `json:"description,omitempty"`
	BotToken    *string            `json:"bot_token,omitempty"`
	AppID       *string            `json:"app_id,omitempty"`
	AppSecret   *string            `json:"app_secret,omitempty"`
	IsActive    *bool              `json:"is_active,omitempty"`
	InstanceID  *int               `json:"instance_id,omitempty"`
}

type channelService struct {
	repo       repository.ChannelRepository
	commandSvc InstanceCommandService
	httpClient *http.Client
}

// NewChannelService creates a new channel service
func NewChannelService(repo repository.ChannelRepository, commandSvc InstanceCommandService) ChannelService {
	return &channelService{
		repo:       repo,
		commandSvc: commandSvc,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (s *channelService) CreateChannel(req CreateChannelRequest) (*models.Channel, error) {
	channel := &models.Channel{
		UserID:     req.UserID,
		InstanceID: req.InstanceID,
		Type:       req.Type,
		Name:       req.Name,
		Description: req.Description,
		BotToken:   req.BotToken,
		AppID:      req.AppID,
		AppSecret:   req.AppSecret,
		IsActive:   true,
	}

	channel, err := s.repo.Create(channel)
	if err != nil {
		return nil, fmt.Errorf("failed to save channel: %w", err)
	}

	channel.WebhookURL = fmt.Sprintf("/webhooks/%s/%d", channel.Type, channel.ID)
	if err := s.repo.Update(channel); err != nil {
		return nil, fmt.Errorf("failed to update webhook URL: %w", err)
	}

	return channel, nil
}

func (s *channelService) GetChannel(id int) (*models.Channel, error) {
	return s.repo.GetByID(id)
}

func (s *channelService) ListChannels(userID int) ([]models.Channel, error) {
	return s.repo.ListByUserID(userID)
}

func (s *channelService) UpdateChannel(id int, req UpdateChannelRequest) (*models.Channel, error) {
	channel, err := s.repo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %w", err)
	}

	if req.Name != nil {
		channel.Name = *req.Name
	}
	if req.Description != nil {
		channel.Description = req.Description
	}
	if req.BotToken != nil {
		channel.BotToken = req.BotToken
	}
	if req.AppID != nil {
		channel.AppID = req.AppID
	}
	if req.AppSecret != nil {
		channel.AppSecret = req.AppSecret
	}
	if req.IsActive != nil {
		channel.IsActive = *req.IsActive
	}
	if req.InstanceID != nil {
		channel.InstanceID = req.InstanceID
	}

	if err := s.repo.Update(channel); err != nil {
		return nil, fmt.Errorf("failed to update channel: %w", err)
	}

	return channel, nil
}

func (s *channelService) DeleteChannel(id int) error {
	return s.repo.Delete(id)
}

func (s *channelService) HandleInbound(channelID int, payload []byte) error {
	channel, err := s.repo.GetByID(channelID)
	if err != nil {
		return fmt.Errorf("channel not found: %w", err)
	}

	switch channel.Type {
	case models.ChannelTypeTelegram:
		return s.handleTelegramInbound(channel, payload)
	case models.ChannelTypeFeishu:
		return s.handleFeishuInbound(channel, payload)
	default:
		return fmt.Errorf("unsupported channel type: %s", channel.Type)
	}
}

func (s *channelService) SendOutbound(channelID int, content string, externalChatID string) error {
	channel, err := s.repo.GetByID(channelID)
	if err != nil {
		return fmt.Errorf("channel not found: %w", err)
	}

	switch channel.Type {
	case models.ChannelTypeTelegram:
		return s.sendTelegramMessage(channel, content, externalChatID)
	case models.ChannelTypeFeishu:
		return s.sendFeishuMessage(channel, content, externalChatID)
	default:
		return fmt.Errorf("unsupported channel type: %s", channel.Type)
	}
}

func (s *channelService) handleTelegramInbound(channel *models.Channel, payload []byte) error {
	var update map[string]interface{}
	if err := json.Unmarshal(payload, &update); err != nil {
		return fmt.Errorf("failed to parse Telegram payload: %w", err)
	}

	message, ok := update["message"].(map[string]interface{})
	if !ok {
		return nil
	}

	chat, ok := message["chat"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("no chat in message")
	}

	chatID := fmt.Sprintf("%v", chat["id"])
	text, _ := message["text"].(string)
	from, _ := message["from"].(map[string]interface{})
	senderID := ""
	senderName := ""
	if from != nil {
		senderID = fmt.Sprintf("%v", from["id"])
		senderName, _ = from["first_name"].(string)
	}

	if text == "" {
		return nil
	}

	if channel.InstanceID == nil || s.commandSvc == nil {
		fmt.Printf("Channel %d: no instance assigned or no command service, skipping message routing\n", channel.ID)
		return nil
	}

	cmdPayload := map[string]interface{}{
		"channel_id":        channel.ID,
		"channel_type":      string(channel.Type),
		"chat_id":           chatID,
		"sender_id":         senderID,
		"sender_name":       senderName,
		"message_text":      text,
		"external_message_id": fmt.Sprintf("%v", message["message_id"]),
	}

	_, err := s.commandSvc.Create(*channel.InstanceID, nil, CreateInstanceCommandRequest{
		CommandType:    InstanceCommandTypeProcessChannelMessage,
		Payload:        cmdPayload,
		IdempotencyKey: fmt.Sprintf("tg-%v", message["message_id"]),
		TimeoutSeconds: 300,
	})
	if err != nil {
		return fmt.Errorf("failed to route channel message to instance: %w", err)
	}

	fmt.Printf("Channel %d (%s): routed message from %s to instance %d\n", channel.ID, channel.Type, senderName, *channel.InstanceID)
	return nil
}

func (s *channelService) handleFeishuInbound(channel *models.Channel, payload []byte) error {
	var event map[string]interface{}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("failed to parse Feishu payload: %w", err)
	}

	header, ok := event["header"].(map[string]interface{})
	if !ok {
		return nil
	}

	eventType, _ := header["event_type"].(string)
	if eventType != "im.message.receive_v1" {
		return nil
	}

	evt, ok := event["event"].(map[string]interface{})
	if !ok {
		return nil
	}

	msg, ok := evt["message"].(map[string]interface{})
	if !ok {
		return nil
	}

	chatID, _ := msg["chat_id"].(string)
	msgID, _ := msg["message_id"].(string)
	content, _ := msg["content"].(string)

	sender, _ := evt["sender"].(map[string]interface{})
	senderID := ""
	if sender != nil {
		if sid, ok := sender["sender_id"].(map[string]interface{}); ok {
			senderID, _ = sid["open_id"].(string)
			if senderID == "" {
				senderID, _ = sid["user_id"].(string)
			}
			if senderID == "" {
				senderID, _ = sid["union_id"].(string)
			}
		}
	}

	// Parse content (Feishu sends JSON-encoded content body)
	text := content
	if content != "" {
		var contentObj map[string]interface{}
		if err := json.Unmarshal([]byte(content), &contentObj); err == nil {
			text, _ = contentObj["text"].(string)
		}
	}

	if text == "" {
		return nil
	}

	if channel.InstanceID == nil || s.commandSvc == nil {
		fmt.Printf("Channel %d: no instance assigned or no command service, skipping message routing\n", channel.ID)
		return nil
	}

	cmdPayload := map[string]interface{}{
		"channel_id":          channel.ID,
		"channel_type":        string(channel.Type),
		"chat_id":             chatID,
		"sender_id":           senderID,
		"message_text":        text,
		"external_message_id": msgID,
	}

	_, err := s.commandSvc.Create(*channel.InstanceID, nil, CreateInstanceCommandRequest{
		CommandType:    InstanceCommandTypeProcessChannelMessage,
		Payload:        cmdPayload,
		IdempotencyKey: fmt.Sprintf("feishu-%s", msgID),
		TimeoutSeconds: 300,
	})
	if err != nil {
		return fmt.Errorf("failed to route channel message to instance: %w", err)
	}

	fmt.Printf("Channel %d (%s): routed Feishu message from %s to instance %d\n", channel.ID, channel.Type, senderID, *channel.InstanceID)
	return nil
}

func (s *channelService) sendTelegramMessage(channel *models.Channel, content string, externalChatID string) error {
	if channel.BotToken == nil {
		return fmt.Errorf("missing bot token")
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", *channel.BotToken)
	body := map[string]interface{}{
		"chat_id": externalChatID,
		"text":    content,
	}

	jsonBody, _ := json.Marshal(body)
	resp, err := s.httpClient.Post(url, "application/json", strings.NewReader(string(jsonBody)))
	if err != nil {
		return fmt.Errorf("failed to send Telegram message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram API error: %s", string(bodyBytes))
	}

	return nil
}

func (s *channelService) sendFeishuMessage(channel *models.Channel, content string, externalChatID string) error {
	if channel.AppID == nil || channel.AppSecret == nil {
		return fmt.Errorf("missing feishu app credentials")
	}

	token, err := s.getFeishuTenantToken(*channel.AppID, *channel.AppSecret)
	if err != nil {
		return fmt.Errorf("failed to get feishu tenant token: %w", err)
	}

	url := "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id"
	body := map[string]interface{}{
		"receive_id": externalChatID,
		"msg_type":   "text",
		"content":    fmt.Sprintf(`{"text":"%s"}`, escapeJSON(content)),
	}

	jsonBody, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", url, strings.NewReader(string(jsonBody)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send Feishu message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("feishu API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

func (s *channelService) getFeishuTenantToken(appID, appSecret string) (string, error) {
	url := "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
	body := map[string]string{
		"app_id":     appID,
		"app_secret": appSecret,
	}
	jsonBody, _ := json.Marshal(body)
	resp, err := s.httpClient.Post(url, "application/json", strings.NewReader(string(jsonBody)))
	if err != nil {
		return "", fmt.Errorf("failed to get feishu token: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to parse feishu token response: %w", err)
	}

	token, _ := result["tenant_access_token"].(string)
	if token == "" {
		return "", fmt.Errorf("feishu token response missing tenant_access_token")
	}

	return token, nil
}

func escapeJSON(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "\n", `\n`)
	s = strings.ReplaceAll(s, "\r", `\r`)
	s = strings.ReplaceAll(s, "\t", `\t`)
	return s
}

// HandleCommandFinished handles delivery of AI response when a process_channel_message command completes.
func (s *channelService) HandleCommandFinished(commandID int) error {
	channelID, _ := s.commandSvc.GetCommandResultField(commandID, "channel_id")
	chatID, _ := s.commandSvc.GetCommandResultField(commandID, "chat_id")
	reply, _ := s.commandSvc.GetCommandResultField(commandID, "reply")
	rawResult, _ := s.commandSvc.GetCommandResultField(commandID, "response")

	if channelID == "" || chatID == "" {
		return nil
	}

	cid := 0
	fmt.Sscanf(channelID, "%d", &cid)

	if reply == "" && rawResult != "" {
		if r, ok := parseCommandReply(rawResult); ok {
			reply = r
		}
	}

	if reply == "" {
		return nil
	}

	if err := s.SendOutbound(cid, reply, chatID); err != nil {
		return fmt.Errorf("failed to send channel response: %w", err)
	}

	fmt.Printf("Channel %d: delivered AI response to chat %s\n", cid, chatID)
	return nil
}

func parseCommandReply(raw string) (string, bool) {
	if strings.HasPrefix(raw, "{") {
		var obj map[string]interface{}
		if err := json.Unmarshal([]byte(raw), &obj); err == nil {
			if text, ok := obj["text"].(string); ok && text != "" {
				return text, true
			}
			if reply, ok := obj["reply"].(string); ok && reply != "" {
				return reply, true
			}
			if msg, ok := obj["message"].(string); ok && msg != "" {
				return msg, true
			}
		}
	}
	return raw, raw != ""
}

func stringPtr(s string) *string {
	return &s
}
