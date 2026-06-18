-- Add agent variant templates table
-- Created: 2026-05-09
-- Allows pre-configured agent variants that bundle runtime type + skills + persona

CREATE TABLE IF NOT EXISTS agent_variant_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  runtime_type VARCHAR(50) NOT NULL,
  skill_ids JSON DEFAULT ('[]'),
  config_plan JSON DEFAULT NULL,
  icon VARCHAR(50) DEFAULT 'bot',
  category VARCHAR(50) DEFAULT 'general',
  is_public BOOLEAN DEFAULT TRUE,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_runtime_type (runtime_type),
  INDEX idx_is_public (is_public),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO agent_variant_templates (name, slug, description, runtime_type, skill_ids, config_plan, icon, category, is_public)
VALUES
('Code Assistant', 'code-assistant', 'Your personal code reviewer and pair programmer. Specializes in debugging complex logic, suggesting refactors, and writing clean tests. Persona: meticulous senior engineer who explains reasoning step-by-step.', 'openclaw', '[]', '{"mode": "bundle"}', 'code', 'developer', TRUE),
('Shell Expert', 'shell-expert', 'Command-line virtuoso and system administrator. Instantly writes shell scripts, troubleshoots server issues, and optimizes DevOps pipelines. Persona: seasoned sysadmin with a knack for one-liner solutions.', 'openclaw', '[]', '{"mode": "bundle"}', 'terminal', 'developer', TRUE),
('Document Writer', 'document-writer', 'Technical communication specialist. Transforms rough notes into polished API docs, READMEs, and architecture guides. Persona: patient technical writer who values clarity over jargon.', 'openclaw', '[]', '{"mode": "bundle"}', 'file-text', 'creative', TRUE),
('Research Analyst', 'research-analyst', 'Deep reasoning engine powered by Hermes kernel. Analyzes research papers, synthesizes findings, and constructs logical arguments. Persona: rigorous academic researcher with cross-domain expertise.', 'hermes', '[]', '{"mode": "bundle"}', 'brain', 'research', TRUE),
('General Purpose', 'general-purpose', 'A blank-slate OpenClaw instance. No preset skills or personality — customize it entirely to your needs. Perfect for users who want full control over their agent configuration.', 'openclaw', '[]', NULL, 'bot', 'general', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  runtime_type = VALUES(runtime_type),
  skill_ids = VALUES(skill_ids),
  config_plan = VALUES(config_plan),
  icon = VALUES(icon),
  category = VALUES(category);
