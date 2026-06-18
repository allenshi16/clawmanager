package repository

import (
	"encoding/json"
	"time"

	"clawreef/internal/models"

	"github.com/upper/db/v4"
)

type AgentVariantTemplateVersionRepository interface {
	Create(version *models.AgentVariantTemplateVersion) error
	ListByTemplateID(templateID int) ([]models.AgentVariantTemplateVersion, error)
	GetLatest(templateID int) (*models.AgentVariantTemplateVersion, error)
	GetByVersion(templateID int, version int) (*models.AgentVariantTemplateVersion, error)
	SnapshotFromTemplate(template *models.AgentVariantTemplate) error
}

type agentVariantTemplateVersionRepository struct {
	sess db.Session
}

func NewAgentVariantTemplateVersionRepository(sess db.Session) AgentVariantTemplateVersionRepository {
	return &agentVariantTemplateVersionRepository{sess: sess}
}

func (r *agentVariantTemplateVersionRepository) collection() db.Collection {
	return r.sess.Collection("agent_variant_template_versions")
}

func (r *agentVariantTemplateVersionRepository) Create(version *models.AgentVariantTemplateVersion) error {
	version.CreatedAt = time.Now()
	res, err := r.collection().Insert(version)
	if err != nil {
		return err
	}
	if id, ok := res.ID().(int64); ok {
		version.ID = int(id)
	}
	return nil
}

func (r *agentVariantTemplateVersionRepository) ListByTemplateID(templateID int) ([]models.AgentVariantTemplateVersion, error) {
	var versions []models.AgentVariantTemplateVersion
	err := r.collection().Find(db.Cond{"template_id": templateID}).OrderBy("-version").All(&versions)
	return versions, err
}

func (r *agentVariantTemplateVersionRepository) GetLatest(templateID int) (*models.AgentVariantTemplateVersion, error) {
	var version models.AgentVariantTemplateVersion
	err := r.collection().Find(db.Cond{"template_id": templateID}).OrderBy("-version").Limit(1).One(&version)
	if err != nil {
		if err == db.ErrNoMoreRows {
			return nil, nil
		}
		return nil, err
	}
	return &version, nil
}

func (r *agentVariantTemplateVersionRepository) GetByVersion(templateID int, version int) (*models.AgentVariantTemplateVersion, error) {
	var v models.AgentVariantTemplateVersion
	err := r.collection().Find(db.Cond{"template_id": templateID, "version": version}).One(&v)
	if err != nil {
		if err == db.ErrNoMoreRows {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *agentVariantTemplateVersionRepository) SnapshotFromTemplate(template *models.AgentVariantTemplate) error {
	snapshot, err := json.Marshal(template)
	if err != nil {
		return err
	}
	return r.Create(&models.AgentVariantTemplateVersion{
		TemplateID:   template.ID,
		Version:      template.Version,
		SnapshotJSON: snapshot,
	})
}
