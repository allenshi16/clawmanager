package repository

import (
	"fmt"

	"clawreef/internal/models"
	"github.com/upper/db/v4"
)

type ChannelRepository interface {
	Create(channel *models.Channel) (*models.Channel, error)
	GetByID(id int) (*models.Channel, error)
	ListByUserID(userID int) ([]models.Channel, error)
	Update(channel *models.Channel) error
	Delete(id int) error
}

type channelRepository struct {
	sess db.Session
}

func NewChannelRepository(sess db.Session) ChannelRepository {
	return &channelRepository{sess: sess}
}

func (r *channelRepository) Create(channel *models.Channel) (*models.Channel, error) {
	_, err := r.sess.Collection("channels").Insert(channel)
	if err != nil {
		return nil, fmt.Errorf("failed to create channel: %w", err)
	}
	return channel, nil
}

func (r *channelRepository) GetByID(id int) (*models.Channel, error) {
	var channel models.Channel
	err := r.sess.Collection("channels").Find(db.Cond{"id": id}).One(&channel)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %w", err)
	}
	return &channel, nil
}

func (r *channelRepository) ListByUserID(userID int) ([]models.Channel, error) {
	var channels []models.Channel
	err := r.sess.Collection("channels").Find(db.Cond{"user_id": userID}).OrderBy("created_at DESC").All(&channels)
	if err != nil {
		return nil, fmt.Errorf("failed to list channels: %w", err)
	}
	return channels, nil
}

func (r *channelRepository) Update(channel *models.Channel) error {
	return r.sess.Collection("channels").Find(db.Cond{"id": channel.ID}).Update(channel)
}

func (r *channelRepository) Delete(id int) error {
	err := r.sess.Collection("channels").Find(db.Cond{"id": id}).Delete()
	if err != nil {
		return fmt.Errorf("failed to delete channel: %w", err)
	}
	return nil
}
