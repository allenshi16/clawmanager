ALTER TABLE instances ADD COLUMN variant_id INT DEFAULT NULL AFTER openclaw_config_snapshot_id;
ALTER TABLE instances ADD COLUMN variant_version INT DEFAULT NULL AFTER variant_id;
CREATE TABLE IF NOT EXISTS agent_variant_template_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  version INT NOT NULL,
  snapshot_json JSON NOT NULL,
  changelog TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_template_id (template_id),
  INDEX idx_version (template_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
