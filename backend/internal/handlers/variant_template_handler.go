package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"clawreef/internal/services"
	"clawreef/internal/utils"

	"github.com/gin-gonic/gin"
)

type VariantTemplateHandler struct {
	service services.AgentVariantTemplateService
}

func NewVariantTemplateHandler(service services.AgentVariantTemplateService) *VariantTemplateHandler {
	return &VariantTemplateHandler{service: service}
}

func (h *VariantTemplateHandler) ListPublic(c *gin.Context) {
	templates, err := h.service.ListPublic()
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant templates retrieved successfully", gin.H{"variants": templates})
}

func (h *VariantTemplateHandler) ListAll(c *gin.Context) {
	templates, err := h.service.ListAll()
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant templates retrieved successfully", gin.H{"variants": templates})
}

func (h *VariantTemplateHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	template, err := h.service.GetByID(id)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant template retrieved successfully", template)
}

func (h *VariantTemplateHandler) GetBySlug(c *gin.Context) {
	slug := c.Param("slug")
	template, err := h.service.GetBySlug(slug)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if template == nil {
		utils.Error(c, http.StatusNotFound, "Variant template not found")
		return
	}
	utils.Success(c, http.StatusOK, "Variant template retrieved successfully", template)
}

func (h *VariantTemplateHandler) Create(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req services.CreateVariantTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	if req.SkillIDs == nil || string(req.SkillIDs) == "null" || string(req.SkillIDs) == `""` {
		req.SkillIDs = json.RawMessage("[]")
	}

	template, err := h.service.Create(req, userID.(int))
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusCreated, "Variant template created successfully", template)
}

func (h *VariantTemplateHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	var req services.UpdateVariantTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	template, err := h.service.Update(id, req)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant template updated successfully", template)
}

func (h *VariantTemplateHandler) Publish(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	if err := h.service.Publish(id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant template published successfully", nil)
}

func (h *VariantTemplateHandler) Deprecate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	if err := h.service.Deprecate(id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant template deprecated successfully", nil)
}

func (h *VariantTemplateHandler) Archive(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	if err := h.service.Archive(id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant template archived successfully", nil)
}

func (h *VariantTemplateHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Variant template deleted successfully", nil)
}

func (h *VariantTemplateHandler) ListVersions(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	versions, err := h.service.ListVersions(id)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Versions retrieved successfully", gin.H{"versions": versions})
}

func (h *VariantTemplateHandler) GetVersion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	version, err := strconv.Atoi(c.Param("version"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid version number")
		return
	}

	v, err := h.service.GetVersion(id, version)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Version retrieved successfully", v)
}

func (h *VariantTemplateHandler) Fork(c *gin.Context) {
	userID, _ := c.Get("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	var req services.CreateVariantTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	template, err := h.service.ForkTemplate(id, req, userID.(int))
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusCreated, "Variant template forked successfully", template)
}

func (h *VariantTemplateHandler) GetStats(c *gin.Context) {
	stats, err := h.service.GetStats()
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Stats retrieved successfully", stats)
}

func (h *VariantTemplateHandler) DiffVersions(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}
	v1, err := strconv.Atoi(c.Query("v1"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid v1 query param")
		return
	}
	v2, err := strconv.Atoi(c.Query("v2"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid v2 query param")
		return
	}

	diff, err := h.service.DiffVersions(id, v1, v2)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Diff retrieved successfully", diff)
}

func (h *VariantTemplateHandler) RestoreVersion(c *gin.Context) {
	userID, _ := c.Get("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	var req struct {
		Version int `json:"version"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	template, err := h.service.RestoreVersion(id, req.Version, userID.(int))
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Version restored successfully", template)
}

func (h *VariantTemplateHandler) SubmitForReview(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}
	if err := h.service.SubmitForReview(id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Template submitted for review", nil)
}

func (h *VariantTemplateHandler) Approve(c *gin.Context) {
	userID, _ := c.Get("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	var req struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&req)

	if err := h.service.Approve(id, userID.(int), req.Comment); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Template approved successfully", nil)
}

func (h *VariantTemplateHandler) Reject(c *gin.Context) {
	userID, _ := c.Get("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid variant template ID")
		return
	}

	var req struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&req)

	if err := h.service.Reject(id, userID.(int), req.Comment); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Template rejected", nil)
}

func (h *VariantTemplateHandler) BulkPublish(c *gin.Context) {
	var req struct {
		IDs []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}
	if err := h.service.BulkPublish(req.IDs); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Templates published successfully", nil)
}

func (h *VariantTemplateHandler) BulkDeprecate(c *gin.Context) {
	var req struct {
		IDs []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}
	if err := h.service.BulkDeprecate(req.IDs); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Templates deprecated successfully", nil)
}

func (h *VariantTemplateHandler) BulkArchive(c *gin.Context) {
	var req struct {
		IDs []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}
	if err := h.service.BulkArchive(req.IDs); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Templates archived successfully", nil)
}

func (h *VariantTemplateHandler) ListByReviewStatus(c *gin.Context) {
	status := c.DefaultQuery("status", "pending")
	templates, err := h.service.ListByReviewStatus(status)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Success(c, http.StatusOK, "Templates retrieved successfully", gin.H{"variants": templates})
}
