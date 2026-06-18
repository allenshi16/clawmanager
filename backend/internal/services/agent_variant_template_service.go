package services

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"clawreef/internal/models"
	"clawreef/internal/repository"
)

type AgentVariantTemplateService interface {
	ListPublic() ([]models.AgentVariantTemplate, error)
	ListAll() ([]models.AgentVariantTemplate, error)
	ListPublished() ([]models.AgentVariantTemplate, error)
	ListByStatus(status string) ([]models.AgentVariantTemplate, error)
	GetByID(id int) (*models.AgentVariantTemplate, error)
	GetBySlug(slug string) (*models.AgentVariantTemplate, error)
	Create(req CreateVariantTemplateRequest, createdBy int) (*models.AgentVariantTemplate, error)
	Update(id int, req UpdateVariantTemplateRequest) (*models.AgentVariantTemplate, error)
	Publish(id int) error
	Deprecate(id int) error
	Archive(id int) error
	Delete(id int) error
	ResolveForInstance(variantID int) (*VariantExpansion, error)
	IncrementUsageCount(id int) error
	ForkTemplate(id int, req CreateVariantTemplateRequest, userID int) (*models.AgentVariantTemplate, error)
	ListVersions(templateID int) ([]models.AgentVariantTemplateVersion, error)
	GetVersion(templateID int, version int) (*models.AgentVariantTemplateVersion, error)
	GetStats() (*TemplateStats, error)
	DiffVersions(templateID int, versionA int, versionB int) (map[string]interface{}, error)
	RestoreVersion(templateID int, version int, userID int) (*models.AgentVariantTemplate, error)
	SubmitForReview(id int) error
	Approve(id int, reviewerID int, comment string) error
	Reject(id int, reviewerID int, comment string) error
	BulkPublish(ids []int) error
	BulkDeprecate(ids []int) error
	BulkArchive(ids []int) error
	ListByReviewStatus(status string) ([]models.AgentVariantTemplate, error)
}

type TemplateStats struct {
	TotalTemplates      int                          `json:"total_templates"`
	StatusCounts        map[string]int               `json:"status_counts"`
	TotalUsageCount     int                          `json:"total_usage_count"`
	TotalForks          int                          `json:"total_forks"`
	MostPopular         []models.AgentVariantTemplate `json:"most_popular"`
	RecentTemplates     []models.AgentVariantTemplate `json:"recent_templates"`
}

type CreateVariantTemplateRequest struct {
	Name              string          `json:"name" validate:"required,min=1,max=255"`
	Slug              string          `json:"slug" validate:"required,min=1,max=100"`
	Description       *string         `json:"description,omitempty"`
	RuntimeType       string          `json:"runtime_type" validate:"required,oneof=openclaw ubuntu debian centos custom webtop hermes hermes-agent"`
	ImageRegistry     *string         `json:"image_registry,omitempty"`
	ImageTag          *string         `json:"image_tag,omitempty"`
	SkillIDs          json.RawMessage `json:"skill_ids"`
	ConfigPlan        json.RawMessage `json:"config_plan,omitempty"`
	Icon              string          `json:"icon"`
	Category          string          `json:"category"`
	IsPublic          *bool           `json:"is_public,omitempty"`
	RecommendedCPU    *float64        `json:"recommended_cpu,omitempty"`
	RecommendedMemory *int            `json:"recommended_memory,omitempty"`
	RecommendedDisk   *int            `json:"recommended_disk,omitempty"`
	ReadmeMD          string          `json:"readme_md,omitempty"`
	ScreenshotURLs    string          `json:"screenshot_urls,omitempty"`
}

type UpdateVariantTemplateRequest struct {
	Name              *string         `json:"name,omitempty"`
	Slug              *string         `json:"slug,omitempty"`
	Description       *string         `json:"description,omitempty"`
	RuntimeType       *string         `json:"runtime_type,omitempty"`
	ImageRegistry     *string         `json:"image_registry,omitempty"`
	ImageTag          *string         `json:"image_tag,omitempty"`
	SkillIDs          json.RawMessage `json:"skill_ids,omitempty"`
	ConfigPlan        json.RawMessage `json:"config_plan,omitempty"`
	Icon              *string         `json:"icon,omitempty"`
	Category          *string         `json:"category,omitempty"`
	IsPublic          *bool           `json:"is_public,omitempty"`
	RecommendedCPU    *float64        `json:"recommended_cpu,omitempty"`
	RecommendedMemory *int            `json:"recommended_memory,omitempty"`
	RecommendedDisk   *int            `json:"recommended_disk,omitempty"`
	ReadmeMD          *string         `json:"readme_md,omitempty"`
	ScreenshotURLs    *string         `json:"screenshot_urls,omitempty"`
}

type VariantExpansion struct {
	RuntimeType       string                 `json:"runtime_type"`
	SkillIDs          []int                  `json:"skill_ids"`
	ConfigPlan        map[string]interface{} `json:"config_plan,omitempty"`
	RecommendedCPU    float64                `json:"recommended_cpu"`
	RecommendedMemory int                    `json:"recommended_memory"`
	RecommendedDisk   int                    `json:"recommended_disk"`
}

type agentVariantTemplateService struct {
	repo       repository.AgentVariantTemplateRepository
	versionRepo repository.AgentVariantTemplateVersionRepository
}

func NewAgentVariantTemplateService(repo repository.AgentVariantTemplateRepository, versionRepo repository.AgentVariantTemplateVersionRepository) AgentVariantTemplateService {
	return &agentVariantTemplateService{repo: repo, versionRepo: versionRepo}
}

func (s *agentVariantTemplateService) ListPublic() ([]models.AgentVariantTemplate, error) {
	return s.repo.ListPublic()
}

func (s *agentVariantTemplateService) ListAll() ([]models.AgentVariantTemplate, error) {
	return s.repo.ListAll()
}

func (s *agentVariantTemplateService) ListPublished() ([]models.AgentVariantTemplate, error) {
	return s.repo.ListByStatus("published")
}

func (s *agentVariantTemplateService) ListByStatus(status string) ([]models.AgentVariantTemplate, error) {
	return s.repo.ListByStatus(status)
}

func (s *agentVariantTemplateService) GetByID(id int) (*models.AgentVariantTemplate, error) {
	return s.repo.GetByID(id)
}

func (s *agentVariantTemplateService) GetBySlug(slug string) (*models.AgentVariantTemplate, error) {
	return s.repo.GetBySlug(slug)
}

func (s *agentVariantTemplateService) Create(req CreateVariantTemplateRequest, createdBy int) (*models.AgentVariantTemplate, error) {
	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		return nil, fmt.Errorf("slug is required")
	}

	isPublic := true
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}

	if len(req.SkillIDs) == 0 || string(req.SkillIDs) == "null" || string(req.SkillIDs) == `""` {
		req.SkillIDs = json.RawMessage("[]")
	}

	if len(req.ConfigPlan) == 0 || string(req.ConfigPlan) == "null" || string(req.ConfigPlan) == `""` {
		req.ConfigPlan = json.RawMessage("{}")
	}

	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = "bot"
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "general"
	}

	status := "draft"
	if isPublic {
		status = "published"
	}

	reviewStatus := "approved"
	if isPublic {
		reviewStatus = "approved"
	} else {
		reviewStatus = "pending"
	}

	template := &models.AgentVariantTemplate{
		Name:         strings.TrimSpace(req.Name),
		Slug:         slug,
		Description:  req.Description,
		RuntimeType:  req.RuntimeType,
		ImageRegistry: req.ImageRegistry,
		ImageTag:     req.ImageTag,
		SkillIDs:     req.SkillIDs,
		ConfigPlan:   req.ConfigPlan,
		Icon:         icon,
		Category:     category,
		IsPublic:     isPublic,
		Status:       status,
		ReviewStatus: reviewStatus,
		Version:      1,
		CreatedBy:    &createdBy,
	}

	if req.RecommendedCPU != nil {
		template.RecommendedCPU = *req.RecommendedCPU
	} else {
		template.RecommendedCPU = 2.0
	}
	if req.RecommendedMemory != nil {
		template.RecommendedMemory = *req.RecommendedMemory
	} else {
		template.RecommendedMemory = 4
	}
	if req.RecommendedDisk != nil {
		template.RecommendedDisk = *req.RecommendedDisk
	} else {
		template.RecommendedDisk = 20
	}
	if req.ReadmeMD != "" {
		template.ReadmeMD = &req.ReadmeMD
	}
	if req.ScreenshotURLs != "" {
		template.ScreenshotURLs = &req.ScreenshotURLs
	}

	if err := s.repo.Create(template); err != nil {
		return nil, fmt.Errorf("failed to create variant template: %w", err)
	}

	// Save initial version 1 snapshot
	if err := s.versionRepo.SnapshotFromTemplate(template); err != nil {
		// Non-fatal: template created but version history incomplete
		log.Printf("Warning: failed to save initial version snapshot for template %d: %v", template.ID, err)
	}

	return template, nil
}

func (s *agentVariantTemplateService) Update(id int, req UpdateVariantTemplateRequest) (*models.AgentVariantTemplate, error) {
	template, err := s.repo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("variant template not found: %w", err)
	}

	if req.Name != nil {
		template.Name = strings.TrimSpace(*req.Name)
	}
	if req.Slug != nil {
		template.Slug = strings.TrimSpace(*req.Slug)
	}
	if req.Description != nil {
		template.Description = req.Description
	}
	if req.RuntimeType != nil {
		template.RuntimeType = *req.RuntimeType
	}
	if req.ImageRegistry != nil {
		template.ImageRegistry = req.ImageRegistry
	}
	if req.ImageTag != nil {
		template.ImageTag = req.ImageTag
	}
	if req.SkillIDs != nil {
		if len(req.SkillIDs) == 0 || string(req.SkillIDs) == "null" {
			template.SkillIDs = json.RawMessage("[]")
		} else {
			template.SkillIDs = req.SkillIDs
		}
	}
	if req.ConfigPlan != nil {
		if len(req.ConfigPlan) == 0 || string(req.ConfigPlan) == "null" {
			template.ConfigPlan = nil
		} else {
			template.ConfigPlan = req.ConfigPlan
		}
	}
	if req.Icon != nil {
		template.Icon = strings.TrimSpace(*req.Icon)
	}
	if req.Category != nil {
		template.Category = strings.TrimSpace(*req.Category)
	}
	if req.IsPublic != nil {
		template.IsPublic = *req.IsPublic
		if *req.IsPublic && template.Status == "draft" {
			template.Status = "published"
		} else if !*req.IsPublic && template.Status == "published" {
			template.Status = "draft"
		}
	}
	if req.RecommendedCPU != nil {
		template.RecommendedCPU = *req.RecommendedCPU
	}
	if req.RecommendedMemory != nil {
		template.RecommendedMemory = *req.RecommendedMemory
	}
	if req.RecommendedDisk != nil {
		template.RecommendedDisk = *req.RecommendedDisk
	}
	if req.ReadmeMD != nil {
		template.ReadmeMD = req.ReadmeMD
	}
	if req.ScreenshotURLs != nil {
		template.ScreenshotURLs = req.ScreenshotURLs
	}

	if err := s.repo.Update(template); err != nil {
		return nil, fmt.Errorf("failed to update variant template: %w", err)
	}

	return template, nil
}

func (s *agentVariantTemplateService) Publish(id int) error {
	template, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("variant template not found: %w", err)
	}

	// Snapshot BEFORE incrementing version so the snapshot records the pre-publish state
	if err := s.versionRepo.SnapshotFromTemplate(template); err != nil {
		return fmt.Errorf("failed to save version snapshot: %w", err)
	}

	template.Version++
	if err := s.repo.Update(template); err != nil {
		return fmt.Errorf("failed to increment version: %w", err)
	}

	return s.repo.UpdateStatus(id, "published")
}

func (s *agentVariantTemplateService) Deprecate(id int) error {
	return s.repo.UpdateStatus(id, "deprecated")
}

func (s *agentVariantTemplateService) Archive(id int) error {
	return s.repo.UpdateStatus(id, "archived")
}

func (s *agentVariantTemplateService) Delete(id int) error {
	return s.repo.Delete(id)
}

func (s *agentVariantTemplateService) IncrementUsageCount(id int) error {
	return s.repo.IncrementUsageCount(id)
}

func (s *agentVariantTemplateService) GetStats() (*TemplateStats, error) {
	all, err := s.repo.ListAll()
	if err != nil {
		return nil, err
	}

	statusCounts := map[string]int{}
	for _, t := range all {
		statusCounts[t.Status]++
	}

	totalUsage, err := s.repo.SumUsageCount()
	if err != nil {
		return nil, err
	}

	totalForks, err := s.repo.CountBySourceTemplateID()
	if err != nil {
		return nil, err
	}

	popular, err := s.repo.ListMostPopular(5)
	if err != nil {
		return nil, err
	}

	recent := all
	if len(recent) > 5 {
		recent = recent[len(recent)-5:]
	}
	for i, j := 0, len(recent)-1; i < j; i, j = i+1, j-1 {
		recent[i], recent[j] = recent[j], recent[i]
	}

	return &TemplateStats{
		TotalTemplates:  len(all),
		StatusCounts:    statusCounts,
		TotalUsageCount: totalUsage,
		TotalForks:      totalForks,
		MostPopular:     popular,
		RecentTemplates: recent,
	}, nil
}

func (s *agentVariantTemplateService) ListVersions(templateID int) ([]models.AgentVariantTemplateVersion, error) {
	return s.versionRepo.ListByTemplateID(templateID)
}

func (s *agentVariantTemplateService) GetVersion(templateID int, version int) (*models.AgentVariantTemplateVersion, error) {
	return s.versionRepo.GetByVersion(templateID, version)
}

func (s *agentVariantTemplateService) ForkTemplate(id int, req CreateVariantTemplateRequest, userID int) (*models.AgentVariantTemplate, error) {
	source, err := s.repo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("source variant template not found: %w", err)
	}

	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		return nil, fmt.Errorf("slug is required")
	}

	isPublic := true
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}

	skillIDs := req.SkillIDs
	if len(skillIDs) == 0 || string(skillIDs) == "null" || string(skillIDs) == `""` {
		skillIDs = source.SkillIDs
	}

	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = source.Icon
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = source.Category
	}

	status := "draft"
	if isPublic {
		status = "published"
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = source.Name + " (Fork)"
	}

	template := &models.AgentVariantTemplate{
		Name:              name,
		Slug:              slug,
		Description:       req.Description,
		RuntimeType:       source.RuntimeType,
		SkillIDs:          skillIDs,
		ConfigPlan:        source.ConfigPlan,
		Icon:              icon,
		Category:          category,
		IsPublic:          isPublic,
		Status:            status,
		Version:           1,
		SourceTemplateID:  &id,
		CreatedBy:         &userID,
		RecommendedCPU:    source.RecommendedCPU,
		RecommendedMemory: source.RecommendedMemory,
		RecommendedDisk:   source.RecommendedDisk,
		ReadmeMD:          source.ReadmeMD,
		ScreenshotURLs:    source.ScreenshotURLs,
	}

	if req.Description != nil {
		template.Description = req.Description
	}
	if req.RecommendedCPU != nil {
		template.RecommendedCPU = *req.RecommendedCPU
	}
	if req.RecommendedMemory != nil {
		template.RecommendedMemory = *req.RecommendedMemory
	}
	if req.RecommendedDisk != nil {
		template.RecommendedDisk = *req.RecommendedDisk
	}
	if req.ReadmeMD != "" {
		template.ReadmeMD = &req.ReadmeMD
	}
	if req.ScreenshotURLs != "" {
		template.ScreenshotURLs = &req.ScreenshotURLs
	}

	if err := s.repo.Create(template); err != nil {
		return nil, fmt.Errorf("failed to fork variant template: %w", err)
	}

	// Save initial version 1 snapshot for forked template
	if err := s.versionRepo.SnapshotFromTemplate(template); err != nil {
		log.Printf("Warning: failed to save initial version snapshot for forked template %d: %v", template.ID, err)
	}

	return template, nil
}

func (s *agentVariantTemplateService) DiffVersions(templateID int, versionA int, versionB int) (map[string]interface{}, error) {
	va, err := s.versionRepo.GetByVersion(templateID, versionA)
	if err != nil {
		return nil, fmt.Errorf("failed to get version %d: %w", versionA, err)
	}
	if va == nil {
		return nil, fmt.Errorf("version %d not found for template %d", versionA, templateID)
	}
	vb, err := s.versionRepo.GetByVersion(templateID, versionB)
	if err != nil {
		return nil, fmt.Errorf("failed to get version %d: %w", versionB, err)
	}
	if vb == nil {
		return nil, fmt.Errorf("version %d not found for template %d", versionB, templateID)
	}

	var snapA, snapB map[string]interface{}
	if err := json.Unmarshal(va.SnapshotJSON, &snapA); err != nil {
		return nil, fmt.Errorf("failed to parse snapshot %d: %w", versionA, err)
	}
	if err := json.Unmarshal(vb.SnapshotJSON, &snapB); err != nil {
		return nil, fmt.Errorf("failed to parse snapshot %d: %w", versionB, err)
	}

	diff := map[string]interface{}{
		"version_a": versionA,
		"version_b": versionB,
		"changes":   []interface{}{},
	}

	// Fields to compare — skip internal/timestamp fields
	compareFields := []string{"name", "description", "runtime_type", "icon", "category", "status",
		"recommended_cpu", "recommended_memory", "recommended_disk", "skill_ids", "config_plan",
		"readme_md", "screenshot_urls", "is_public"}

	var changes []map[string]interface{}
	for _, field := range compareFields {
		valA := snapA[field]
		valB := snapB[field]
		aStr, _ := json.Marshal(valA)
		bStr, _ := json.Marshal(valB)
		if string(aStr) != string(bStr) {
			changes = append(changes, map[string]interface{}{
				"field": field,
				"from":  valA,
				"to":    valB,
			})
		}
	}
	diff["changes"] = changes
	diff["change_count"] = len(changes)
	return diff, nil
}

func (s *agentVariantTemplateService) RestoreVersion(templateID int, version int, userID int) (*models.AgentVariantTemplate, error) {
	template, err := s.repo.GetByID(templateID)
	if err != nil {
		return nil, fmt.Errorf("template not found: %w", err)
	}

	v, err := s.versionRepo.GetByVersion(templateID, version)
	if err != nil {
		return nil, fmt.Errorf("version %d not found: %w", version, err)
	}
	if v == nil {
		return nil, fmt.Errorf("version %d not found for template %d", version, templateID)
	}

	var snapshot models.AgentVariantTemplate
	if err := json.Unmarshal(v.SnapshotJSON, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to parse version snapshot: %w", err)
	}

	// Apply snapshot fields to current template (preserving id, timestamps, usage, source_template_id)
	template.Name = snapshot.Name
	template.Slug = snapshot.Slug
	template.Description = snapshot.Description
	template.RuntimeType = snapshot.RuntimeType
	template.SkillIDs = snapshot.SkillIDs
	template.ConfigPlan = snapshot.ConfigPlan
	template.Icon = snapshot.Icon
	template.Category = snapshot.Category
	template.IsPublic = snapshot.IsPublic
	template.RecommendedCPU = snapshot.RecommendedCPU
	template.RecommendedMemory = snapshot.RecommendedMemory
	template.RecommendedDisk = snapshot.RecommendedDisk
	template.ReadmeMD = snapshot.ReadmeMD
	template.ScreenshotURLs = snapshot.ScreenshotURLs

	// Save as new version
	if err := s.versionRepo.SnapshotFromTemplate(template); err != nil {
		return nil, fmt.Errorf("failed to save rollback snapshot: %w", err)
	}

	if err := s.repo.Update(template); err != nil {
		return nil, fmt.Errorf("failed to update template: %w", err)
	}

	return template, nil
}

func (s *agentVariantTemplateService) SubmitForReview(id int) error {
	template, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("template not found: %w", err)
	}
	if template.Status != "draft" {
		return fmt.Errorf("only draft templates can be submitted for review")
	}
	return s.repo.UpdateReview(id, "pending", 0, "")
}

func (s *agentVariantTemplateService) Approve(id int, reviewerID int, comment string) error {
	template, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("template not found: %w", err)
	}
	if template.ReviewStatus != "pending" {
		return fmt.Errorf("template is not pending review")
	}

	// Publish on approval
	if template.Status == "draft" {
		if err := s.Publish(id); err != nil {
			return fmt.Errorf("failed to publish on approval: %w", err)
		}
	}

	return s.repo.UpdateReview(id, "approved", reviewerID, comment)
}

func (s *agentVariantTemplateService) Reject(id int, reviewerID int, comment string) error {
	if err := s.repo.UpdateReview(id, "rejected", reviewerID, comment); err != nil {
		return err
	}
	if err := s.repo.UpdateStatus(id, "draft"); err != nil {
		return fmt.Errorf("failed to revert to draft after rejection: %w", err)
	}
	return nil
}

func (s *agentVariantTemplateService) BulkPublish(ids []int) error {
	for _, id := range ids {
		if err := s.Publish(id); err != nil {
			return fmt.Errorf("failed to publish template %d: %w", id, err)
		}
	}
	return nil
}

func (s *agentVariantTemplateService) BulkDeprecate(ids []int) error {
	for _, id := range ids {
		if err := s.Deprecate(id); err != nil {
			return fmt.Errorf("failed to deprecate template %d: %w", id, err)
		}
	}
	return nil
}

func (s *agentVariantTemplateService) BulkArchive(ids []int) error {
	for _, id := range ids {
		if err := s.Archive(id); err != nil {
			return fmt.Errorf("failed to archive template %d: %w", id, err)
		}
	}
	return nil
}

func (s *agentVariantTemplateService) ListByReviewStatus(status string) ([]models.AgentVariantTemplate, error) {
	return s.repo.ListByReviewStatus(status)
}

func (s *agentVariantTemplateService) ResolveForInstance(variantID int) (*VariantExpansion, error) {
	template, err := s.repo.GetByID(variantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get variant template: %w", err)
	}

	expansion := &VariantExpansion{
		RuntimeType:       template.RuntimeType,
		SkillIDs:          template.SkillIDsAsInts(),
		RecommendedCPU:    template.RecommendedCPU,
		RecommendedMemory: template.RecommendedMemory,
		RecommendedDisk:   template.RecommendedDisk,
	}

	if template.ConfigPlan != nil && len(template.ConfigPlan) > 0 && string(template.ConfigPlan) != "null" {
		var plan map[string]interface{}
		if err := json.Unmarshal(template.ConfigPlan, &plan); err == nil {
			expansion.ConfigPlan = plan
		}
	}

	return expansion, nil
}
