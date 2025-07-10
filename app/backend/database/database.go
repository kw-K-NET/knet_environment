package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

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

// GetTempSensorDataByTimeRange retrieves temperature sensor data within a specific time range
func (db *Database) GetTempSensorDataByTimeRange(startTime, endTime time.Time, limit int) ([]TempSensorData, error) {
	query := `
	SELECT id, temperature, humidity, timestamp 
	FROM temp_sensor_data 
	WHERE timestamp >= $1 AND timestamp <= $2 
	ORDER BY timestamp DESC 
	LIMIT $3`

	rows, err := db.Query(query, startTime, endTime, limit)
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

// GetTempSensorDataWithTimeIntervals returns exactly 'limit' data points sampled evenly across the time range
func (db *Database) GetTempSensorDataWithTimeIntervals(startTime, endTime time.Time, limit int) ([]TempSensorData, error) {
	// First, get all data in the time range for sampling
	query := `
	SELECT id, temperature, humidity, timestamp 
	FROM temp_sensor_data 
	WHERE timestamp >= $1 AND timestamp <= $2 
	ORDER BY timestamp ASC`

	rows, err := db.Query(query, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Load all available data into memory for efficient lookup
	var allData []TempSensorData
	for rows.Next() {
		var item TempSensorData
		err := rows.Scan(&item.ID, &item.Temperature, &item.Humidity, &item.Timestamp)
		if err != nil {
			return nil, err
		}
		allData = append(allData, item)
	}

	if len(allData) == 0 {
		// No data available, create empty slots across the entire time range
		return createEmptyTimeSlots(startTime, endTime, limit), nil
	}

	// ALWAYS include the most recent data point as the last point
	mostRecentData := allData[len(allData)-1]

	result := make([]TempSensorData, 0, limit)

	if limit == 1 {
		// Special case: only one point requested, return the most recent
		return []TempSensorData{mostRecentData}, nil
	}

	// Calculate time slots for the first (limit-1) points across the time range
	// Reserve the last slot for the most recent data
	slotsForDistribution := limit - 1
	totalDuration := endTime.Sub(startTime)
	slotDuration := totalDuration / time.Duration(slotsForDistribution)

	// For each time slot (except the last), find the closest data point
	for i := 0; i < slotsForDistribution; i++ {
		// Calculate target timestamp for this slot
		targetTime := startTime.Add(time.Duration(i) * slotDuration)

		// Find the closest data point within a reasonable tolerance
		var closestData *TempSensorData
		var minDiff time.Duration = time.Hour * 24 // Initialize with large value
		tolerance := slotDuration * 2              // Allow up to 2 slot widths difference

		for j := range allData {
			// Skip the most recent data point as it's reserved for the last slot
			if allData[j].Timestamp.Equal(mostRecentData.Timestamp) {
				continue
			}

			diff := targetTime.Sub(allData[j].Timestamp)
			if diff < 0 {
				diff = -diff // Get absolute difference
			}

			// Only consider data within tolerance and closer than previous best
			if diff <= tolerance && diff < minDiff {
				minDiff = diff
				closestData = &allData[j]
			}
		}

		if closestData != nil {
			// Found close data, use it
			result = append(result, *closestData)
		} else {
			// No data found for this time slot, create null entry
			result = append(result, TempSensorData{
				ID:          0, // Use 0 to indicate null entry
				Temperature: 0, // Will be handled as null in frontend
				Humidity:    0, // Will be handled as null in frontend
				Timestamp:   targetTime,
			})
		}
	}

	// Always add the most recent data point as the last point
	result = append(result, mostRecentData)

	return result, nil
}

// Helper function to create empty time slots when no data is available
func createEmptyTimeSlots(startTime, endTime time.Time, limit int) []TempSensorData {
	result := make([]TempSensorData, 0, limit)
	totalDuration := endTime.Sub(startTime)
	slotDuration := totalDuration / time.Duration(limit)

	for i := 0; i < limit; i++ {
		targetTime := startTime.Add(time.Duration(i) * slotDuration)
		result = append(result, TempSensorData{
			ID:          0, // Use 0 to indicate null entry
			Temperature: 0, // Will be handled as null in frontend
			Humidity:    0, // Will be handled as null in frontend
			Timestamp:   targetTime,
		})
	}

	return result
}

// GetDataCountInTimeRange returns the number of records in a time range
func (db *Database) GetDataCountInTimeRange(startTime, endTime time.Time) (int, error) {
	query := `
	SELECT COUNT(*) 
	FROM temp_sensor_data 
	WHERE timestamp >= $1 AND timestamp <= $2`

	var count int
	err := db.QueryRow(query, startTime, endTime).Scan(&count)
	return count, err
}
