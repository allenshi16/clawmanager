package models

import "time"

// ChannelType represents the type of channel
type ChannelType string

const (
	ChannelTypeTelegram ChannelType = "telegram"
	ChannelTypeFeishu   ChannelType = "feishu"
	ChannelTypeDingTalk  ChannelType = "dingtalk"
)

// Channel represents a configured channel for message routing
type Channel struct {
	ID          int          `db:"id,primarykey,autoincrement" json:"id"`
	UserID      int          `db:"user_id" json:"user_id"`
	InstanceID  *int         `db:"instance_id" json:"instance_id,omitempty"`
	Type        ChannelType  `db:"type" json:"type"`
	Name        string       `db:"name" json:"name"`
	Description *string      `db:"description" json:"description,omitempty"`
	WebhookURL  string       `db:"webhook_url" json:"webhook_url"`
	BotToken    *string      `db:"bot_token" json:"bot_token,omitempty"`
	AppID       *string      `db:"app_id" json:"app_id,omitempty"`
	AppSecret   *string      `db:"app_secret" json:"app_secret,omitempty"`
	IsActive    bool         `db:"is_active" json:"is_active"`
	CreatedAt   *time.Time   `db:"created_at" json:"created_at,omitempty"`
	UpdatedAt   *time.Time   `db:"updated_at" json:"updated_at,omitempty"`
}

// TableName returns the table name for Channel
func (Channel) TableName() string {
	return "channels"
}

// ChannelMessage represents an inbound or outbound message
type ChannelMessage struct {
	ID              int        `db:"id,primarykey,autoincrement" json:"id"`
	ChannelID       int        `db:"channel_id" json:"channel_id"`
	ExternalMsgID   string     `db:"external_message_id" json:"external_message_id"`
	ExternalUserID  string     `db:"external_user_id" json:"external_user_id"`
	ExternalChatID  string     `db:"external_chat_id" json:"external_chat_id"`
	Direction       string     `db:"direction" json:"direction"` // inbound, outbound
	ContentType     string     `db:"content_type" json:"content_type"`
	Content         string     `db:"content" json:"content"`
	RawPayload      *string    `db:"raw_payload" json:"raw_payload,omitempty"`
	Status          string     `db:"status" json:"status"` // pending, sent, failed
	ErrorMessage    *string    `db:"error_message" json:"error_message,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
}

// TableName returns the table name for ChannelMessage
func (ChannelMessage) TableName() string {
	return "channel_messages"
}
