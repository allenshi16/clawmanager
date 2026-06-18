package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"clawreef/internal/config"
	"clawreef/internal/models"
	"github.com/upper/db/v4"
	_ "github.com/go-sql-driver/mysql"
)

// InstanceRepository defines the interface for instance data operations
type InstanceRepository interface {
	Create(instance *models.Instance) error
	GetByID(id int) (*models.Instance, error)
	GetByAccessToken(accessToken string) (*models.Instance, error)
	GetByAgentBootstrapToken(bootstrapToken string) (*models.Instance, error)
	GetAll(offset, limit int) ([]models.Instance, error)
	CountAll() (int, error)
	GetByUserID(userID int, offset, limit int) ([]models.Instance, error)
	CountByUserID(userID int) (int, error)
	ExistsByUserIDAndName(userID int, name string) (bool, error)
	GetAllRunning() ([]models.Instance, error)
	Update(instance *models.Instance) error
	Delete(id int) error
}

// instanceRepository implements InstanceRepository
type instanceRepository struct {
	sess   db.Session
	dbConf config.DatabaseConfig
	db     *sql.DB
}

// NewInstanceRepository creates a new instance repository
func NewInstanceRepository(sess db.Session, dbConf config.DatabaseConfig) InstanceRepository {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		dbConf.User, dbConf.Password, dbConf.Host, dbConf.Port, dbConf.Database)
	
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		fmt.Printf("[WARN] Failed to open MySQL connection: %v\n", err)
		return &instanceRepository{sess: sess, dbConf: dbConf, db: nil}
	}
	
	if err := db.Ping(); err != nil {
		fmt.Printf("[WARN] Failed to ping MySQL: %v\n", err)
		return &instanceRepository{sess: sess, dbConf: dbConf, db: nil}
	}
	
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	fmt.Printf("[INFO] Direct MySQL connection initialized: %s@%s:%d/%s\n", 
		dbConf.User, dbConf.Host, dbConf.Port, dbConf.Database)
	
	return &instanceRepository{sess: sess, dbConf: dbConf, db: db}
}

// Create creates a new instance
func (r *instanceRepository) Create(instance *models.Instance) error {
	if r.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	// Use a single connection for INSERT and LAST_INSERT_ID
	conn, err := r.db.Conn(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get connection: %w", err)
	}
	defer conn.Close()

	result, err := conn.ExecContext(context.Background(),
		`INSERT INTO instances (user_id, name, description, type, status, cpu_cores, memory_gb, disk_gb, 
		gpu_enabled, gpu_type, gpu_count, os_type, os_version, image_registry, image_tag, 
		environment_overrides_json, storage_class, mount_path, variant_id, variant_version, created_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		instance.UserID, instance.Name, instance.Description, instance.Type, "creating",
		instance.CPUCores, instance.MemoryGB, instance.DiskGB, instance.GPUEnabled,
		instance.GPUType, instance.GPUCount, instance.OSType, instance.OSVersion,
		instance.ImageRegistry, instance.ImageTag, instance.EnvironmentOverridesJSON,
		instance.StorageClass, instance.MountPath, instance.VariantID, instance.VariantVersion,
	)
	if err != nil {
		return fmt.Errorf("failed to create instance: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert ID: %w", err)
	}

	instance.ID = int(id)
	instance.Status = "creating"

	// Verify the instance was created using the same connection
	var checkID int
	err = conn.QueryRowContext(context.Background(), "SELECT id FROM instances WHERE id = ?", id).Scan(&checkID)
	if err != nil {
		return fmt.Errorf("instance %d not found after insert: %w", id, err)
	}

	return nil
}

// GetByID gets an instance by ID
func (r *instanceRepository) GetByID(id int) (*models.Instance, error) {
	if r.db == nil {
		return nil, fmt.Errorf("database connection not initialized")
	}

	var instance models.Instance
	var description, gpuType, imageRegistry, imageTag *string
	var podName, podNamespace, podIP, accessUrl *string
	var accessToken, agentBootstrapToken *string
	var openclawConfigSnapshotID *int
	var startedAt, stoppedAt *time.Time

	err := r.db.QueryRow(`
		SELECT id, user_id, name, description, type, status, cpu_cores, memory_gb, disk_gb,
		       gpu_enabled, gpu_type, gpu_count, os_type, os_version,
		       image_registry, image_tag,
		       environment_overrides_json, storage_class, mount_path,
		       pod_name, pod_namespace, pod_ip, access_url,
		       access_token, agent_bootstrap_token, openclaw_config_snapshot_id,
		       created_at, updated_at, started_at, stopped_at
		FROM instances WHERE id = ?
	`, id).Scan(
		&instance.ID, &instance.UserID, &instance.Name, &description, &instance.Type, &instance.Status,
		&instance.CPUCores, &instance.MemoryGB, &instance.DiskGB,
		&instance.GPUEnabled, &gpuType, &instance.GPUCount, &instance.OSType, &instance.OSVersion,
		&imageRegistry, &imageTag,
		&instance.EnvironmentOverridesJSON, &instance.StorageClass, &instance.MountPath,
		&podName, &podNamespace, &podIP, &accessUrl,
		&accessToken, &agentBootstrapToken, &openclawConfigSnapshotID,
		&instance.CreatedAt, &instance.UpdatedAt, &startedAt, &stoppedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get instance: %w", err)
	}

	instance.Description = description
	instance.GPUType = gpuType
	instance.ImageRegistry = imageRegistry
	instance.ImageTag = imageTag
	instance.PodName = podName
	instance.PodNamespace = podNamespace
	instance.PodIP = podIP
	instance.AccessURL = accessUrl
	instance.AccessToken = accessToken
	instance.AgentBootstrapToken = agentBootstrapToken
	instance.OpenClawConfigSnapshotID = openclawConfigSnapshotID
	instance.StartedAt = startedAt
	instance.StoppedAt = stoppedAt

	return &instance, nil
}

// GetByAccessToken gets an instance by its lifecycle gateway token.
func (r *instanceRepository) GetByAccessToken(accessToken string) (*models.Instance, error) {
	var instance models.Instance
	err := r.sess.Collection("instances").Find(db.Cond{"access_token": accessToken}).One(&instance)
	if err != nil {
		if err == db.ErrNoMoreRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get instance by access token: %w", err)
	}
	return &instance, nil
}

func (r *instanceRepository) GetByAgentBootstrapToken(bootstrapToken string) (*models.Instance, error) {
	var instance models.Instance
	err := r.sess.Collection("instances").Find(db.Cond{"agent_bootstrap_token": bootstrapToken}).One(&instance)
	if err != nil {
		if err == db.ErrNoMoreRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get instance by agent bootstrap token: %w", err)
	}
	return &instance, nil
}

func (r *instanceRepository) GetAll(offset, limit int) ([]models.Instance, error) {
	var instances []models.Instance
	err := r.sess.Collection("instances").Find().Offset(offset).Limit(limit).All(&instances)
	if err != nil {
		return nil, fmt.Errorf("failed to get all instances: %w", err)
	}
	return instances, nil
}

func (r *instanceRepository) CountAll() (int, error) {
	count, err := r.sess.Collection("instances").Find().Count()
	if err != nil {
		return 0, fmt.Errorf("failed to count all instances: %w", err)
	}
	return int(count), nil
}

// GetByUserID gets instances by user ID with pagination
func (r *instanceRepository) GetByUserID(userID int, offset, limit int) ([]models.Instance, error) {
	var instances []models.Instance
	err := r.sess.Collection("instances").Find(db.Cond{"user_id": userID}).Offset(offset).Limit(limit).All(&instances)
	if err != nil {
		return nil, fmt.Errorf("failed to get instances: %w", err)
	}
	return instances, nil
}

// CountByUserID counts instances by user ID
func (r *instanceRepository) CountByUserID(userID int) (int, error) {
	count, err := r.sess.Collection("instances").Find(db.Cond{"user_id": userID}).Count()
	if err != nil {
		return 0, fmt.Errorf("failed to count instances: %w", err)
	}
	return int(count), nil
}

// ExistsByUserIDAndName checks whether the user already has an instance with the same display name.
func (r *instanceRepository) ExistsByUserIDAndName(userID int, name string) (bool, error) {
	instances, err := r.GetByUserID(userID, 0, 1000)
	if err != nil {
		return false, err
	}

	normalized := strings.TrimSpace(strings.ToLower(name))
	for _, instance := range instances {
		if strings.TrimSpace(strings.ToLower(instance.Name)) == normalized {
			return true, nil
		}
	}

	return false, nil
}

// GetAllRunning gets all instances that are not in stopped or error state (for sync)
func (r *instanceRepository) GetAllRunning() ([]models.Instance, error) {
	if r.db == nil {
		return nil, fmt.Errorf("database connection not initialized")
	}

	rows, err := r.db.Query(`
		SELECT id, user_id, name, description, type, status, cpu_cores, memory_gb, disk_gb,
		       gpu_enabled, gpu_type, gpu_count, os_type, os_version,
		       image_registry, image_tag,
		       environment_overrides_json, storage_class, mount_path,
		       pod_name, pod_namespace, pod_ip, access_url,
		       access_token, agent_bootstrap_token, openclaw_config_snapshot_id,
		       created_at, updated_at, started_at, stopped_at
		FROM instances
		WHERE status IN ('running', 'creating', 'stopped', 'error')
		ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query instances: %w", err)
	}
	defer rows.Close()

	var instances []models.Instance
	for rows.Next() {
		var instance models.Instance
		var description, gpuType, imageRegistry, imageTag *string
		var podName, podNamespace, podIP, accessUrl *string
		var accessToken, agentBootstrapToken *string
		var openclawConfigSnapshotID *int
		var startedAt, stoppedAt *time.Time

		err := rows.Scan(
			&instance.ID, &instance.UserID, &instance.Name, &description, &instance.Type, &instance.Status,
			&instance.CPUCores, &instance.MemoryGB, &instance.DiskGB,
			&instance.GPUEnabled, &gpuType, &instance.GPUCount, &instance.OSType, &instance.OSVersion,
			&imageRegistry, &imageTag,
			&instance.EnvironmentOverridesJSON, &instance.StorageClass, &instance.MountPath,
			&podName, &podNamespace, &podIP, &accessUrl,
			&accessToken, &agentBootstrapToken, &openclawConfigSnapshotID,
			&instance.CreatedAt, &instance.UpdatedAt, &startedAt, &stoppedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan instance: %w", err)
		}

		instance.Description = description
		instance.GPUType = gpuType
		instance.ImageRegistry = imageRegistry
		instance.ImageTag = imageTag
		instance.PodName = podName
		instance.PodNamespace = podNamespace
		instance.PodIP = podIP
		instance.AccessURL = accessUrl
		instance.AccessToken = accessToken
		instance.AgentBootstrapToken = agentBootstrapToken
		instance.OpenClawConfigSnapshotID = openclawConfigSnapshotID
		instance.StartedAt = startedAt
		instance.StoppedAt = stoppedAt

		instances = append(instances, instance)
	}

	return instances, nil
}

// Update updates an instance
func (r *instanceRepository) Update(instance *models.Instance) error {
	if r.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	result, err := r.db.Exec(
		`UPDATE instances SET 
			status = ?, 
			pod_name = ?, 
			pod_namespace = ?, 
			pod_ip = ?, 
			access_token = ?,
			agent_bootstrap_token = ?,
			openclaw_config_snapshot_id = ?,
			updated_at = NOW() 
		WHERE id = ?`,
		instance.Status,
		instance.PodName,
		instance.PodNamespace,
		instance.PodIP,
		instance.AccessToken,
		instance.AgentBootstrapToken,
		instance.OpenClawConfigSnapshotID,
		instance.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update instance: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("instance %d not found", instance.ID)
	}
	return nil
}

// Delete deletes an instance
func (r *instanceRepository) Delete(id int) error {
	if r.db == nil {
		return fmt.Errorf("database connection not initialized")
	}
	result, err := r.db.Exec("DELETE FROM instances WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete instance: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("instance %d not found", id)
	}
	return nil
}
