package handlers

import (
	"net/http"
	"strconv"

	"clawreef/internal/services"
	"github.com/gin-gonic/gin"
)

type BillingHandler struct {
	billingService services.BillingService
}

func NewBillingHandler(billingService services.BillingService) *BillingHandler {
	return &BillingHandler{billingService: billingService}
}

func (h *BillingHandler) ListPlans(c *gin.Context) {
	plans, err := h.billingService.ListPlans()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "success": false})
		return
	}
	c.JSON(http.StatusOK, plans)
}

func (h *BillingHandler) GetPlan(c *gin.Context) {
	planID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan ID", "success": false})
		return
	}
	plan, err := h.billingService.GetPlanByID(planID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found", "success": false})
		return
	}
	c.JSON(http.StatusOK, plan)
}

func (h *BillingHandler) GetSubscription(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found", "success": false})
		return
	}
	sub, err := h.billingService.GetUserSubscription(userID.(int))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active subscription", "success": false})
		return
	}
	c.JSON(http.StatusOK, sub)
}

func (h *BillingHandler) CreateSubscription(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found", "success": false})
		return
	}

	var req struct {
		PlanID int `json:"plan_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "success": false})
		return
	}

	sub, err := h.billingService.CreateSubscription(userID.(int), req.PlanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "success": false})
		return
	}

	c.JSON(http.StatusCreated, sub)
}

func (h *BillingHandler) CancelSubscription(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found", "success": false})
		return
	}

	err := h.billingService.CancelSubscription(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "success": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription cancelled", "success": true})
}

func (h *BillingHandler) ListInvoices(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found", "success": false})
		return
	}

	limit := 20
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l >0 {
			limit = l
		}
	}

	invoices, err := h.billingService.ListInvoices(userID.(int), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "success": false})
		return
	}

	c.JSON(http.StatusOK, invoices)
}

func (h *BillingHandler) GetUsageSummary(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found", "success": false})
		return
	}

	summary, err := h.billingService.GetUsageSummary(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "success": false})
		return
	}

	c.JSON(http.StatusOK, summary)
}
