package service

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"knet_management/database"
)

type TempSensorDataCollector struct {
	sensorURL string
	db        *database.Database
	client    *http.Client
}

func NewTempSensorDataCollector(sensorURL string, db *database.Database) *TempSensorDataCollector {
	return &TempSensorDataCollector{
		sensorURL: sensorURL,
		db:        db,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *TempSensorDataCollector) CollectTempData() error {
	resp, err := c.client.Get(c.sensorURL)
	if err != nil {
		return fmt.Errorf("failed to fetch data from sensor: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("sensor API returned non-200 status: %d", resp.StatusCode)
	}

	var apiResp database.TempAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return fmt.Errorf("failed to decode sensor response: %w", err)
	}

	sensorData := &database.TempSensorData{
		Temperature: apiResp.Temperature,
		Humidity:    apiResp.Humidity,
		Timestamp:   time.Now(),
	}

	if err := c.db.InsertTempSensorData(sensorData); err != nil {
		return fmt.Errorf("failed to insert sensor data: %w", err)
	}

	log.Printf("Collected sensor data: Temperature=%.2f, Humidity=%.2f", sensorData.Temperature, sensorData.Humidity)
	return nil
}

func (c *TempSensorDataCollector) StartPeriodicTempCollection(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			if err := c.CollectTempData(); err != nil {
				log.Printf("Error collecting sensor data: %v", err)
			}
		}
	}()
}
