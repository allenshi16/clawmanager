-- Extend agent_variant_templates for one-click platform
-- Phase 1: add resource specs, status lifecycle, readme, screenshots, versioning

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'recommended_cpu');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN recommended_cpu DECIMAL(5,2) NOT NULL DEFAULT 2.0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'recommended_memory');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN recommended_memory INT NOT NULL DEFAULT 4', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'recommended_disk');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN recommended_disk INT NOT NULL DEFAULT 20', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'status');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''draft''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'readme_md');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN readme_md TEXT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'screenshot_urls');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN screenshot_urls TEXT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'version');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN version INT NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'source_template_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN source_template_id INT DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND COLUMN_NAME = 'usage_count');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE agent_variant_templates ADD COLUMN usage_count INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_variant_templates' AND INDEX_NAME = 'idx_status');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_status ON agent_variant_templates (status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Migrate existing is_public=true rows to published status
UPDATE agent_variant_templates SET status = 'published' WHERE is_public = TRUE;
UPDATE agent_variant_templates SET status = 'draft' WHERE is_public = FALSE;
