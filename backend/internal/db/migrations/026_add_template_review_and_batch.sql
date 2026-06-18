-- Migration 026: Add template review workflow, version rollback support, batch operations
-- This migration adds review workflow fields to agent_variant_templates

ALTER TABLE agent_variant_templates
  ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'approved' AFTER status,
  ADD COLUMN reviewed_by INT DEFAULT NULL AFTER review_status,
  ADD COLUMN reviewed_at DATETIME DEFAULT NULL AFTER reviewed_by,
  ADD COLUMN review_comment TEXT AFTER reviewed_at;

-- Set existing published templates as review_status='approved'
-- and non-published as review_status='pending' for those in 'draft'
UPDATE agent_variant_templates SET review_status = 'approved' WHERE status = 'published';
UPDATE agent_variant_templates SET review_status = 'pending' WHERE status = 'draft';
UPDATE agent_variant_templates SET review_status = 'approved' WHERE status IN ('deprecated', 'archived');
