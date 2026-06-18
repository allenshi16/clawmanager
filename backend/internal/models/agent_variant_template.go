package models

import (
	"encoding/json"
	"time"
)

type AgentVariantTemplate struct {
	ID          int             `db:"id,primarykey,autoincrement" json:"id"`
	Name        string          `db:"name" json:"name"`
	Slug        string          `db:"slug" json:"slug"`
	Description *string         `db:"description" json:"description,omitempty"`
	RuntimeType string          `db:"runtime_type" json:"runtime_type"`
	ImageRegistry *string       `db:"image_registry" json:"image_registry,omitempty"`
	ImageTag      *string       `db:"image_tag" json:"image_tag,omitempty"`
	SkillIDs    json.RawMessage `db:"skill_ids" json:"skill_ids"`
	ConfigPlan  json.RawMessage `db:"config_plan" json:"config_plan,omitempty"`
	Icon        string          `db:"icon" json:"icon"`
	Category    string          `db:"category" json:"category"`
	IsPublic    bool            `db:"is_public" json:"is_public"`
	CreatedBy   *int            `db:"created_by" json:"created_by,omitempty"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at" json:"updated_at"`

	RecommendedCPU    float64 `db:"recommended_cpu" json:"recommended_cpu"`
	RecommendedMemory int     `db:"recommended_memory" json:"recommended_memory"`
	RecommendedDisk   int     `db:"recommended_disk" json:"recommended_disk"`
	Status            string  `db:"status" json:"status"`
	ReadmeMD          *string `db:"readme_md" json:"readme_md,omitempty"`
	ScreenshotURLs    *string `db:"screenshot_urls" json:"screenshot_urls,omitempty"`
	Version           int        `db:"version" json:"version"`
	SourceTemplateID  *int       `db:"source_template_id" json:"source_template_id,omitempty"`
	UsageCount        int        `db:"usage_count" json:"usage_count"`
	ReviewStatus      string     `db:"review_status" json:"review_status"`
	ReviewedBy        *int       `db:"reviewed_by" json:"reviewed_by,omitempty"`
	ReviewedAt        *time.Time `db:"reviewed_at" json:"reviewed_at,omitempty"`
	ReviewComment     *string    `db:"review_comment" json:"review_comment,omitempty"`
}

type AgentVariantTemplateVersion struct {
	ID          int             `db:"id,primarykey,autoincrement" json:"id"`
	TemplateID  int             `db:"template_id" json:"template_id"`
	Version     int             `db:"version" json:"version"`
	SnapshotJSON json.RawMessage `db:"snapshot_json" json:"snapshot_json"`
	ChangeLog   string          `db:"changelog" json:"changelog"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
}

func (t AgentVariantTemplateVersion) TableName() string {
	return "agent_variant_template_versions"
}

func (t AgentVariantTemplate) TableName() string {
	return "agent_variant_templates"
}

func (t *AgentVariantTemplate) SkillIDsAsInts() []int {
	if len(t.SkillIDs) == 0 {
		return nil
	}
	var ids []int
	if err := json.Unmarshal(t.SkillIDs, &ids); err != nil {
		return nil
	}
	return ids
}
