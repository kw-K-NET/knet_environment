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
	sensorURL         string
	acOutletSensorURL string
	db                *database.Database
	client            *http.Client
}

func NewTempSensorDataCollector(sensorURL string, acOutletSensorURL string, db *database.Database) *TempSensorDataCollector {
	return &TempSensorDataCollector{
		sensorURL:         sensorURL,
		acOutletSensorURL: acOutletSensorURL,
		db:                db,
		client:            &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *TempSensorDataCollector) CollectTempData() error {
	// Collect data from main temperature sensor
	mainSensorData, err := c.collectFromSensor(c.sensorURL, "main temperature sensor")
	if err != nil {
		return fmt.Errorf("failed to collect from main sensor: %w", err)
	}

	// Collect data from AC outlet sensor
	acOutletData, err := c.collectFromSensor(c.acOutletSensorURL, "AC outlet sensor")
	var acOutletTemp, acOutletHum *float64

	if err != nil {
		log.Printf("Warning: failed to collect from AC outlet sensor: %v", err)
		// AC outlet sensor data will be null
		acOutletTemp = nil
		acOutletHum = nil
	} else {
		acOutletTemp = &acOutletData.Temperature
		acOutletHum = &acOutletData.Humidity
	}

	// Combine both sensor data
	sensorData := &database.TempSensorData{
		Temperature:         mainSensorData.Temperature,
		Humidity:            mainSensorData.Humidity,
		ACOutletTemperature: acOutletTemp,
		ACOutletHumidity:    acOutletHum,
		Timestamp:           time.Now(),
	}

	if err := c.db.InsertTempSensorData(sensorData); err != nil {
		return fmt.Errorf("failed to insert sensor data: %w", err)
	}

	if sensorData.ACOutletTemperature != nil && sensorData.ACOutletHumidity != nil {
		log.Printf("Collected sensor data: Main(T=%.2f, H=%.2f), AC(T=%.2f, H=%.2f)",
			sensorData.Temperature, sensorData.Humidity,
			*sensorData.ACOutletTemperature, *sensorData.ACOutletHumidity)
	} else {
		log.Printf("Collected sensor data: Main(T=%.2f, H=%.2f), AC(no data)",
			sensorData.Temperature, sensorData.Humidity)
	}
	return nil
}

func (c *TempSensorDataCollector) collectFromSensor(sensorURL, sensorName string) (*database.TempAPIResponse, error) {
	resp, err := c.client.Get(sensorURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch data from %s: %w", sensorName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s API returned non-200 status: %d", sensorName, resp.StatusCode)
	}

	var apiResp database.TempAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode %s response: %w", sensorName, err)
	}

	return &apiResp, nil
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
