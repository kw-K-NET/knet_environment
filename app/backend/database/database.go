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

// CreateTables is deprecated - use migrations instead
func (db *Database) CreateTables() error {
	// This function is kept for backward compatibility
	// New code should use the migration system
	return nil
}

func (db *Database) InsertTempSensorData(data *TempSensorData) error {
	query := `
	INSERT INTO temp_sensor_data (temperature, humidity, ac_outlet_temperature, ac_outlet_humidity, timestamp) 
	VALUES ($1, $2, $3, $4, $5) 
	RETURNING id`

	err := db.QueryRow(query, data.Temperature, data.Humidity, data.ACOutletTemperature, data.ACOutletHumidity, data.Timestamp).Scan(&data.ID)
	return err
}

func (db *Database) GetTempSensorData(limit, offset int) ([]TempSensorData, error) {
	query := `
	SELECT id, temperature, humidity, ac_outlet_temperature, ac_outlet_humidity, timestamp 
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
		err := rows.Scan(&item.ID, &item.Temperature, &item.Humidity, &item.ACOutletTemperature, &item.ACOutletHumidity, &item.Timestamp)
		if err != nil {
			return nil, err
		}
		data = append(data, item)
	}

	data = markOutliers(data)

	return data, nil
}

func (db *Database) GetLatestTempSensorData() (*TempSensorData, error) {
	query := `
	SELECT id, temperature, humidity, ac_outlet_temperature, ac_outlet_humidity, timestamp 
	FROM temp_sensor_data 
	ORDER BY timestamp DESC 
	LIMIT 1`

	var data TempSensorData
	err := db.QueryRow(query).Scan(&data.ID, &data.Temperature, &data.Humidity, &data.ACOutletTemperature, &data.ACOutletHumidity, &data.Timestamp)
	if err != nil {
		return nil, err
	}

	// Mark outlier status
	data.IsOutlier = isTemperatureOutlier(data.Temperature)

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
	SELECT id, temperature, humidity, ac_outlet_temperature, ac_outlet_humidity, timestamp 
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

	data = markOutliers(data)

	return data, nil
}

// GetTempSensorDataByTimeRange retrieves temperature sensor data within a specific time range
func (db *Database) GetTempSensorDataByTimeRange(startTime, endTime time.Time, limit int) ([]TempSensorData, error) {
	query := `
	SELECT id, temperature, humidity, ac_outlet_temperature, ac_outlet_humidity, timestamp 
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
		err := rows.Scan(&item.ID, &item.Temperature, &item.Humidity, &item.ACOutletTemperature, &item.ACOutletHumidity, &item.Timestamp)
		if err != nil {
			return nil, err
		}
		data = append(data, item)
	}

	// Mark outliers before returning
	data = markOutliers(data)

	return data, nil
}

// GetTempSensorDataWithTimeIntervals returns exactly 'limit' data points sampled evenly across the time range
func (db *Database) GetTempSensorDataWithTimeIntervals(startTime, endTime time.Time, limit int) ([]TempSensorData, error) {
	// First, get all data in the time range for sampling
	query := `
	SELECT id, temperature, humidity, ac_outlet_temperature, ac_outlet_humidity, timestamp 
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
		err := rows.Scan(&item.ID, &item.Temperature, &item.Humidity, &item.ACOutletTemperature, &item.ACOutletHumidity, &item.Timestamp)
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

	result = markOutliers(result)

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

// 이상치는 temp가 3도 이내일 때의 온습도
// dht22자체문제인거같기도
func isTemperatureOutlier(temperature float64) bool {
	return temperature <= 3.0
}

func markOutliers(data []TempSensorData) []TempSensorData {
	for i := range data {
		data[i].IsOutlier = isTemperatureOutlier(data[i].Temperature)
	}
	return data
}

func filterOutliers(values []float64, isOutlier []bool) []float64 {
	var filtered []float64
	for i, val := range values {
		if i < len(isOutlier) && !isOutlier[i] {
			filtered = append(filtered, val)
		}
	}
	return filtered
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

// GetTempSensorDataWithAggregation enhances data points with aggregated values
// calculated from surrounding ±windowSize data points
func (db *Database) GetTempSensorDataWithAggregation(baseData []TempSensorData, windowSize int) ([]TempSensorData, error) {
	if len(baseData) == 0 {
		return baseData, nil
	}

	// Create a copy of the data to avoid modifying the original
	result := make([]TempSensorData, len(baseData))
	copy(result, baseData)

	result = markOutliers(result)

	// For each data point, calculate both default (±3) and configurable aggregated values
	for i := range result {
		// Always calculate default aggregated values (±3 window) for main display
		defaultAggregated, err := db.calculateDefaultAggregatesForDataPoint(result[i])
		if err != nil {
			// Log error but continue with other points
			continue
		}
		result[i].DefaultAggregated = defaultAggregated

		// Calculate configurable aggregated values only if windowSize > 0
		if windowSize > 0 {
			aggregated, err := db.calculateAggregatesForDataPoint(result[i], windowSize)
			if err != nil {
				// Log error but continue with other points
				continue
			}
			result[i].Aggregated = aggregated
		}
	}

	return result, nil
}

// calculateDefaultAggregatesForDataPoint calculates avg for main display using ±3 window
func (db *Database) calculateDefaultAggregatesForDataPoint(dataPoint TempSensorData) (*DefaultAggregatedValues, error) {
	// Get surrounding data points based on ID range (±3 from current point)
	startID := dataPoint.ID - 3
	endID := dataPoint.ID + 3

	// Ensure startID is not negative
	if startID < 1 {
		startID = 1
	}

	query := `
	SELECT temperature, humidity 
	FROM temp_sensor_data 
	WHERE id >= $1 AND id <= $2 
	ORDER BY id ASC`

	rows, err := db.Query(query, startID, endID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var temperatures []float64
	var humidities []float64
	var tempOutliers []bool
	var humOutliers []bool

	for rows.Next() {
		var temp, hum float64
		err := rows.Scan(&temp, &hum)
		if err != nil {
			return nil, err
		}
		temperatures = append(temperatures, temp)
		humidities = append(humidities, hum)
		tempOutliers = append(tempOutliers, isTemperatureOutlier(temp))
		humOutliers = append(humOutliers, isTemperatureOutlier(temp)) // Use same outlier logic for humidity
	}

	if len(temperatures) == 0 {
		return nil, nil // No surrounding data found
	}

	filteredTemps := filterOutliers(temperatures, tempOutliers)
	filteredHums := filterOutliers(humidities, humOutliers)

	tempStats := calculateStatsForSlice(filteredTemps)
	humStats := calculateStatsForSlice(filteredHums)

	return &DefaultAggregatedValues{
		Temperature: tempStats.Average,
		Humidity:    humStats.Average,
	}, nil
}

// calculateAggregatesForDataPoint calculates avg/max/min for a single data point
// using ±windowSize surrounding data points
func (db *Database) calculateAggregatesForDataPoint(dataPoint TempSensorData, windowSize int) (*AggregatedValues, error) {
	// Get surrounding data points based on ID range (±windowSize from current point)
	startID := dataPoint.ID - windowSize
	endID := dataPoint.ID + windowSize

	// Ensure startID is not negative
	if startID < 1 {
		startID = 1
	}

	query := `
	SELECT temperature, humidity 
	FROM temp_sensor_data 
	WHERE id >= $1 AND id <= $2 
	ORDER BY id ASC`

	rows, err := db.Query(query, startID, endID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var temperatures []float64
	var humidities []float64
	var tempOutliers []bool
	var humOutliers []bool

	for rows.Next() {
		var temp, hum float64
		err := rows.Scan(&temp, &hum)
		if err != nil {
			return nil, err
		}
		temperatures = append(temperatures, temp)
		humidities = append(humidities, hum)
		tempOutliers = append(tempOutliers, isTemperatureOutlier(temp))
		humOutliers = append(humOutliers, isTemperatureOutlier(temp)) // Use same outlier logic for humidity
	}

	if len(temperatures) == 0 {
		return nil, nil // No surrounding data found
	}

	filteredTemps := filterOutliers(temperatures, tempOutliers)
	filteredHums := filterOutliers(humidities, humOutliers)

	tempAgg := calculateStatsForSlice(filteredTemps)
	humAgg := calculateStatsForSlice(filteredHums)

	return &AggregatedValues{
		Temperature: &TemperatureAggregates{
			Average: tempAgg.Average,
			Maximum: tempAgg.Maximum,
			Minimum: tempAgg.Minimum,
			Count:   tempAgg.Count,
		},
		Humidity: &HumidityAggregates{
			Average: humAgg.Average,
			Maximum: humAgg.Maximum,
			Minimum: humAgg.Minimum,
			Count:   humAgg.Count,
		},
	}, nil
}

// Helper struct for statistical calculations
type StatResult struct {
	Average float64
	Maximum float64
	Minimum float64
	Count   int
}

// calculateStatsForSlice calculates avg, max, min for a slice of float64 values
func calculateStatsForSlice(values []float64) StatResult {
	if len(values) == 0 {
		return StatResult{}
	}

	sum := 0.0
	min := values[0]
	max := values[0]

	for _, val := range values {
		sum += val
		if val < min {
			min = val
		}
		if val > max {
			max = val
		}
	}

	return StatResult{
		Average: sum / float64(len(values)),
		Maximum: max,
		Minimum: min,
		Count:   len(values),
	}
}
