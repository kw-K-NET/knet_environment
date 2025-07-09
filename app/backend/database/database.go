package database

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
)

type Database struct {
	*sql.DB
}

func NewDatabase(dataSourceName string) (*Database, error) {
	db, err := sql.Open("postgres", dataSourceName)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &Database{db}, nil
}

func (db *Database) CreateTables() error {
	query := `
	CREATE TABLE IF NOT EXISTS temp_sensor_data (
		id SERIAL PRIMARY KEY,
		temperature FLOAT NOT NULL,
		humidity FLOAT NOT NULL,
		timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_temp_sensor_data_timestamp ON temp_sensor_data(timestamp);
	`

	_, err := db.Exec(query)
	return err
}

func (db *Database) InsertTempSensorData(data *TempSensorData) error {
	query := `
	INSERT INTO temp_sensor_data (temperature, humidity, timestamp) 
	VALUES ($1, $2, $3) 
	RETURNING id`

	err := db.QueryRow(query, data.Temperature, data.Humidity, data.Timestamp).Scan(&data.ID)
	return err
}

func (db *Database) GetTempSensorData(limit, offset int) ([]TempSensorData, error) {
	query := `
	SELECT id, temperature, humidity, timestamp 
	FROM temp_sensor_data 
	ORDER BY timestamp DESC 
	LIMIT $1 OFFSET $2`

	rows, err := db.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []TempSensorData
	for rows.Next() {
		var item TempSensorData
		err := rows.Scan(&item.ID, &item.Temperature, &item.Humidity, &item.Timestamp)
		if err != nil {
			return nil, err
		}
		data = append(data, item)
	}

	return data, nil
}

func (db *Database) GetLatestTempSensorData() (*TempSensorData, error) {
	query := `
	SELECT id, temperature, humidity, timestamp 
	FROM temp_sensor_data 
	ORDER BY timestamp DESC 
	LIMIT 1`

	var data TempSensorData
	err := db.QueryRow(query).Scan(&data.ID, &data.Temperature, &data.Humidity, &data.Timestamp)
	if err != nil {
		return nil, err
	}

	return &data, nil
}

func (db *Database) GetTempSensorDataWithTerm(limit, term int) ([]TempSensorData, error) {
	var latestID int
	latestQuery := `SELECT id FROM temp_sensor_data ORDER BY timestamp DESC LIMIT 1`
	err := db.QueryRow(latestQuery).Scan(&latestID)
	if err != nil {
		return nil, err
	}

	var targetIDs []int
	for i := 0; i < limit; i++ {
		targetID := latestID - (i * term)
		if targetID > 0 {
			targetIDs = append(targetIDs, targetID)
		}
	}

	if len(targetIDs) == 0 {
		return []TempSensorData{}, nil
	}

	placeholders := make([]string, len(targetIDs))
	args := make([]interface{}, len(targetIDs))
	for i, id := range targetIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
	SELECT id, temperature, humidity, timestamp 
	FROM temp_sensor_data 
	WHERE id IN (%s)
	ORDER BY timestamp DESC`, strings.Join(placeholders, ","))

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []TempSensorData
	for rows.Next() {
		var item TempSensorData
		err := rows.Scan(&item.ID, &item.Temperature, &item.Humidity, &item.Timestamp)
		if err != nil {
			return nil, err
		}
		data = append(data, item)
	}

	return data, nil
}
