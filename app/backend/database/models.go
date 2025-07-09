package database

import "time"

type TempSensorData struct {
	ID          int       `json:"id" db:"id"`
	Temperature float64   `json:"temperature" db:"temperature"`
	Humidity    float64   `json:"humidity" db:"humidity"`
	Timestamp   time.Time `json:"timestamp" db:"timestamp"`
}

type TempAPIResponse struct {
	Temperature float64 `json:"temperature"`
	Humidity    float64 `json:"humidity"`
}
