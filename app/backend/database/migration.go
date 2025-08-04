package database

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// Migration represents a database migration
type Migration struct {
	Version     string
	Description string
	SQL         string
}

// MigrationManager handles database migrations
type MigrationManager struct {
	db *Database
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *Database) *MigrationManager {
	return &MigrationManager{db: db}
}

// RunMigrations runs all pending migrations
func (mm *MigrationManager) RunMigrations(migrationsDir string) error {
	log.Println("Starting database migrations...")

	// Get applied migrations
	appliedMigrations, err := mm.getAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %v", err)
	}

	// Get all migration files
	migrationFiles, err := mm.getMigrationFiles(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to get migration files: %v", err)
	}

	// Sort migration files by version
	sort.Strings(migrationFiles)

	// Find pending migrations
	pendingMigrations := mm.getPendingMigrations(migrationFiles, appliedMigrations)

	if len(pendingMigrations) == 0 {
		log.Println("No pending migrations found")
		return nil
	}

	log.Printf("Found %d pending migrations", len(pendingMigrations))

	// Run pending migrations
	for _, migrationFile := range pendingMigrations {
		if err := mm.runMigration(migrationFile, migrationsDir); err != nil {
			return fmt.Errorf("failed to run migration %s: %v", migrationFile, err)
		}
	}

	log.Println("All migrations completed successfully")
	return nil
}

// getAppliedMigrations returns a set of applied migration versions
func (mm *MigrationManager) getAppliedMigrations() (map[string]bool, error) {
	// Check if schema_version table exists
	var tableExists bool
	query := `
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'schema_version'
		)`

	err := mm.db.QueryRow(query).Scan(&tableExists)
	if err != nil {
		return nil, fmt.Errorf("failed to check schema_version table: %v", err)
	}

	if !tableExists {
		// Create schema_version table if it doesn't exist
		createTableQuery := `
			CREATE TABLE schema_version (
				id SERIAL PRIMARY KEY,
				version VARCHAR(50) NOT NULL UNIQUE,
				description TEXT,
				applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)`

		if _, err := mm.db.Exec(createTableQuery); err != nil {
			return nil, fmt.Errorf("failed to create schema_version table: %v", err)
		}

		log.Println("Created schema_version table")
		return make(map[string]bool), nil
	}

	// Get applied migrations
	query = `SELECT version FROM schema_version ORDER BY version`
	rows, err := mm.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query applied migrations: %v", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("failed to scan migration version: %v", err)
		}
		applied[version] = true
	}

	return applied, nil
}

// getMigrationFiles returns all migration files in the migrations directory
func (mm *MigrationManager) getMigrationFiles(migrationsDir string) ([]string, error) {
	var files []string

	err := filepath.WalkDir(migrationsDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() && strings.HasSuffix(d.Name(), ".sql") {
			// Extract version from filename (e.g., "001_initial_schema.sql" -> "001_initial_schema")
			version := strings.TrimSuffix(d.Name(), ".sql")
			files = append(files, version)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk migrations directory: %v", err)
	}

	return files, nil
}

// getPendingMigrations returns migrations that haven't been applied yet
func (mm *MigrationManager) getPendingMigrations(migrationFiles []string, appliedMigrations map[string]bool) []string {
	var pending []string

	for _, file := range migrationFiles {
		if !appliedMigrations[file] {
			pending = append(pending, file)
		}
	}

	return pending
}

// runMigration executes a single migration
func (mm *MigrationManager) runMigration(version, migrationsDir string) error {
	log.Printf("Running migration: %s", version)

	// Check if migration is already applied
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM schema_version WHERE version = $1)`
	err := mm.db.QueryRow(checkQuery, version).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if migration exists: %v", err)
	}

	if exists {
		log.Printf("Migration %s already applied, skipping", version)
		return nil
	}

	// Read migration file
	filePath := filepath.Join(migrationsDir, version+".sql")
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %v", filePath, err)
	}

	// Parse migration description from SQL comments
	description := mm.extractDescription(string(content))

	// Start transaction
	tx, err := mm.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}

	// Execute migration SQL
	if _, err := tx.Exec(string(content)); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to execute migration SQL: %v", err)
	}

	// Record migration as applied (ignore if already exists)
	insertQuery := `
		INSERT INTO schema_version (version, description, applied_at) 
		VALUES ($1, $2, $3)
		ON CONFLICT (version) DO NOTHING`

	if _, err := tx.Exec(insertQuery, version, description, time.Now()); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to record migration: %v", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration: %v", err)
	}

	log.Printf("Successfully applied migration: %s", version)
	return nil
}

// extractDescription extracts the description from SQL comments
func (mm *MigrationManager) extractDescription(content string) string {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "-- Description:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "-- Description:"))
		}
	}
	return "No description provided"
}

// GetMigrationStatus returns the current migration status
func (mm *MigrationManager) GetMigrationStatus(migrationsDir string) ([]MigrationStatus, error) {
	appliedMigrations, err := mm.getAppliedMigrations()
	if err != nil {
		return nil, err
	}

	migrationFiles, err := mm.getMigrationFiles(migrationsDir)
	if err != nil {
		return nil, err
	}

	sort.Strings(migrationFiles)

	var status []MigrationStatus
	for _, file := range migrationFiles {
		applied := appliedMigrations[file]
		status = append(status, MigrationStatus{
			Version: file,
			Applied: applied,
		})
	}

	return status, nil
}

// MigrationStatus represents the status of a migration
type MigrationStatus struct {
	Version string
	Applied bool
}
