ALTER TABLE agent_variant_templates
  ADD COLUMN image_registry VARCHAR(500) NULL AFTER runtime_type,
  ADD COLUMN image_tag VARCHAR(255) NULL AFTER image_registry;
