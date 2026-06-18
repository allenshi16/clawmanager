package handlers

import (
	"net/http"
	"strconv"

	"clawreef/internal/services"

	"github.com/gin-gonic/gin"
)

// ChannelHandler handles channel-related HTTP requests
type ChannelHandler struct {
	channelService services.ChannelService
}

// NewChannelHandler creates a new channel handler
func NewChannelHandler(channelService services.ChannelService) *ChannelHandler {
	return &ChannelHandler{channelService: channelService}
}

// CreateChannel handles POST /api/v1/channels
func (h *ChannelHandler) CreateChannel(c *gin.Context) {
	var req services.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	req.UserID = userID.(int)

	channel, err := h.channelService.CreateChannel(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, channel)
}

// GetChannel handles GET /api/v1/channels/:id
func (h *ChannelHandler) GetChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	channel, err := h.channelService.GetChannel(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	c.JSON(http.StatusOK, channel)
}

// ListChannels handles GET /api/v1/channels
func (h *ChannelHandler) ListChannels(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	channels, err := h.channelService.ListChannels(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, channels)
}

// UpdateChannel handles PUT /api/v1/channels/:id
func (h *ChannelHandler) UpdateChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	var req services.UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	channel, err := h.channelService.UpdateChannel(id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, channel)
}

// DeleteChannel handles DELETE /api/v1/channels/:id
func (h *ChannelHandler) DeleteChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	if err := h.channelService.DeleteChannel(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// WebhookHandler handles POST /webhooks/:type/:id
func (h *ChannelHandler) WebhookHandler(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	if err := h.channelService.HandleInbound(channelID, body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusOK)
}
