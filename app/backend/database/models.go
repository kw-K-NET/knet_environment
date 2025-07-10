package database

import "time"

type TempSensorData struct {
	ID          int       `json:"id" db:"id"`
	Temperature float64   `json:"temperature" db:"temperature"`
	Humidity    float64   `json:"humidity" db:"humidity"`
	Timestamp   time.Time `json:"timestamp" db:"timestamp"`
	// Default aggregated values for main display (±3 window)
	DefaultAggregated *DefaultAggregatedValues `json:"default_aggregated,omitempty"`
	// Configurable aggregated values calculated from surrounding data points (±100 points by default)
	Aggregated *AggregatedValues `json:"aggregated,omitempty"`
}

type DefaultAggregatedValues struct {
	Temperature float64 `json:"temperature"` // Average with ±3 window
	Humidity    float64 `json:"humidity"`    // Average with ±3 window
}

type AggregatedValues struct {
	Temperature *TemperatureAggregates `json:"temperature,omitempty"`
	Humidity    *HumidityAggregates    `json:"humidity,omitempty"`
}

type TemperatureAggregates struct {
	Average float64 `json:"average"`
	Maximum float64 `json:"maximum"`
	Minimum float64 `json:"minimum"`
	Count   int     `json:"count"` // Number of data points used for calculation
}

type HumidityAggregates struct {
	Average float64 `json:"average"`
	Maximum float64 `json:"maximum"`
	Minimum float64 `json:"minimum"`
	Count   int     `json:"count"` // Number of data points used for calculation
}

type TempAPIResponse struct {
	Temperature float64 `json:"temperature"`
	Humidity    float64 `json:"humidity"`
}
