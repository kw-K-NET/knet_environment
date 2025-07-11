package database

import "time"

type TempSensorData struct {
	ID                int                      `json:"id" db:"id"`
	Temperature       float64                  `json:"temperature" db:"temperature"`
	Humidity          float64                  `json:"humidity" db:"humidity"`
	Timestamp         time.Time                `json:"timestamp" db:"timestamp"`
	IsOutlier         bool                     `json:"is_outlier"`
	DefaultAggregated *DefaultAggregatedValues `json:"default_aggregated,omitempty"`
	Aggregated        *AggregatedValues        `json:"aggregated,omitempty"`
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
