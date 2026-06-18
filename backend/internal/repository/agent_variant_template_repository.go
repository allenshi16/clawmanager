package repository

import (
	"encoding/json"
	"time"

	"clawreef/internal/models"

	"github.com/upper/db/v4"
)

type AgentVariantTemplateRepository interface {
	ListPublic() ([]models.AgentVariantTemplate, error)
	ListAll() ([]models.AgentVariantTemplate, error)
	ListByStatus(status string) ([]models.AgentVariantTemplate, error)
	GetByID(id int) (*models.AgentVariantTemplate, error)
	GetBySlug(slug string) (*models.AgentVariantTemplate, error)
	Create(template *models.AgentVariantTemplate) error
	Update(template *models.AgentVariantTemplate) error
	UpdateStatus(id int, status string) error
	IncrementUsageCount(id int) error
	Delete(id int) error
	CountByStatus(status string) (int, error)
	SumUsageCount() (int, error)
	ListMostPopular(limit int) ([]models.AgentVariantTemplate, error)
	CountBySourceTemplateID() (int, error)
	BulkUpdateStatus(ids []int, status string) error
	ListByReviewStatus(status string) ([]models.AgentVariantTemplate, error)
	UpdateReview(id int, reviewStatus string, reviewerID int, comment string) error
}

type agentVariantTemplateRepository struct {
	sess db.Session
}

func NewAgentVariantTemplateRepository(sess db.Session) AgentVariantTemplateRepository {
	return &agentVariantTemplateRepository{sess: sess}
}

func (r *agentVariantTemplateRepository) collection() db.Collection {
	return r.sess.Collection("agent_variant_templates")
}

func (r *agentVariantTemplateRepository) ListPublic() ([]models.AgentVariantTemplate, error) {
	var templates []models.AgentVariantTemplate
	err := r.collection().Find(db.Cond{"status": "published"}).OrderBy("-usage_count", "id").All(&templates)
	return templates, err
}

func (r *agentVariantTemplateRepository) ListAll() ([]models.AgentVariantTemplate, error) {
	var templates []models.AgentVariantTemplate
	err := r.collection().Find().OrderBy("id").All(&templates)
	return templates, err
}

func (r *agentVariantTemplateRepository) ListByStatus(status string) ([]models.AgentVariantTemplate, error) {
	var templates []models.AgentVariantTemplate
	err := r.collection().Find(db.Cond{"status": status}).OrderBy("-usage_count", "id").All(&templates)
	return templates, err
}

func (r *agentVariantTemplateRepository) UpdateStatus(id int, status string) error {
	return r.collection().Find(db.Cond{"id": id}).Update(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	})
}

func (r *agentVariantTemplateRepository) IncrementUsageCount(id int) error {
	return r.collection().Find(db.Cond{"id": id}).Update(map[string]interface{}{
		"usage_count": db.Raw("usage_count + 1"),
	})
}

func (r *agentVariantTemplateRepository) GetByID(id int) (*models.AgentVariantTemplate, error) {
	var template models.AgentVariantTemplate
	err := r.collection().Find(db.Cond{"id": id}).One(&template)
	if err != nil {
		if err == db.ErrNoMoreRows {
			return nil, nil
		}
		return nil, err
	}
	return &template, nil
}

func (r *agentVariantTemplateRepository) GetBySlug(slug string) (*models.AgentVariantTemplate, error) {
	var template models.AgentVariantTemplate
	err := r.collection().Find(db.Cond{"slug": slug}).One(&template)
	if err != nil {
		if err == db.ErrNoMoreRows {
			return nil, nil
		}
		return nil, err
	}
	return &template, nil
}

func (r *agentVariantTemplateRepository) Create(template *models.AgentVariantTemplate) error {
	now := time.Now()
	template.CreatedAt = now
	template.UpdatedAt = now

	res, err := r.collection().Insert(template)
	if err != nil {
		return err
	}
	if id, ok := res.ID().(int64); ok {
		template.ID = int(id)
	}
	return nil
}

func (r *agentVariantTemplateRepository) Update(template *models.AgentVariantTemplate) error {
	template.UpdatedAt = time.Now()

	updateMap := map[string]interface{}{
		"name":              template.Name,
		"slug":              template.Slug,
		"description":       template.Description,
		"runtime_type":      template.RuntimeType,
		"image_registry":    template.ImageRegistry,
		"image_tag":         template.ImageTag,
		"icon":              template.Icon,
		"category":          template.Category,
		"is_public":         template.IsPublic,
		"recommended_cpu":   template.RecommendedCPU,
		"recommended_memory": template.RecommendedMemory,
		"recommended_disk":  template.RecommendedDisk,
		"status":            template.Status,
		"readme_md":         template.ReadmeMD,
		"screenshot_urls":   template.ScreenshotURLs,
		"version":           template.Version,
		"updated_at":        template.UpdatedAt,
	}

	if template.SourceTemplateID != nil {
		updateMap["source_template_id"] = *template.SourceTemplateID
	} else {
		updateMap["source_template_id"] = nil
	}

	if len(template.SkillIDs) > 0 && string(template.SkillIDs) != "null" {
		updateMap["skill_ids"] = template.SkillIDs
	} else {
		updateMap["skill_ids"] = json.RawMessage("[]")
	}

	if len(template.ConfigPlan) > 0 && string(template.ConfigPlan) != "null" {
		updateMap["config_plan"] = template.ConfigPlan
	}

	return r.collection().Find(db.Cond{"id": template.ID}).Update(updateMap)
}

func (r *agentVariantTemplateRepository) CountByStatus(status string) (int, error) {
	count, err := r.collection().Find(db.Cond{"status": status}).Count()
	return int(count), err
}

func (r *agentVariantTemplateRepository) SumUsageCount() (int, error) {
	// Use raw SQL since upper/db collection doesn't support SUM
	var total int
	row, err := r.sess.SQL().QueryRow("SELECT COALESCE(SUM(usage_count), 0) FROM agent_variant_templates")
	if err != nil {
		return 0, err
	}
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (r *agentVariantTemplateRepository) ListMostPopular(limit int) ([]models.AgentVariantTemplate, error) {
	var templates []models.AgentVariantTemplate
	err := r.collection().Find().OrderBy("-usage_count", "id").Limit(limit).All(&templates)
	return templates, err
}

func (r *agentVariantTemplateRepository) CountBySourceTemplateID() (int, error) {
	var count int
	row, err := r.sess.SQL().QueryRow("SELECT COUNT(*) FROM agent_variant_templates WHERE source_template_id IS NOT NULL")
	if err != nil {
		return 0, err
	}
	if err := row.Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *agentVariantTemplateRepository) BulkUpdateStatus(ids []int, status string) error {
	if len(ids) == 0 {
		return nil
	}
	return r.collection().Find(db.Cond{"id IN": ids}).Update(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	})
}

func (r *agentVariantTemplateRepository) ListByReviewStatus(status string) ([]models.AgentVariantTemplate, error) {
	var templates []models.AgentVariantTemplate
	err := r.collection().Find(db.Cond{"review_status": status}).OrderBy("-updated_at").All(&templates)
	return templates, err
}

func (r *agentVariantTemplateRepository) UpdateReview(id int, reviewStatus string, reviewerID int, comment string) error {
	now := time.Now()
	return r.collection().Find(db.Cond{"id": id}).Update(map[string]interface{}{
		"review_status":  reviewStatus,
		"reviewed_by":    reviewerID,
		"reviewed_at":    now,
		"review_comment": comment,
		"updated_at":     now,
	})
}

func (r *agentVariantTemplateRepository) Delete(id int) error {
	return r.collection().Find(db.Cond{"id": id}).Delete()
}
