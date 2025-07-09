package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"knet_management/api"
	"knet_management/database"
	"knet_management/service"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// 환경변수들은 docker compose에서..
	// Database configuration
	dbHost := getEnv("DB_HOST")
	dbPort := getEnv("DB_PORT")
	dbUser := getEnv("DB_USER")
	dbPassword := getEnv("DB_PASSWORD")
	dbName := getEnv("DB_NAME")

	// Sensor configuration
	sensorHost := getEnv("TEMP_SENSOR_HOST")
	sensorPort := getEnv("TEMP_SENSOR_PORT")
	sensorPath := getEnv("TEMP_SENSOR_PATH")
	collectionInterval := getEnv("TEMP_COLLECTION_INTERVAL")

	// Server configuration
	serverPort := getEnv("SERVER_PORT")

	interval, err := time.ParseDuration(collectionInterval)
	if err != nil {
		log.Printf("Invalid collection interval '%s', using default 30s", collectionInterval)
		interval = 30 * time.Second
	}

	// init func should be separated.... but.. 미래의 제가 해주겠죠?
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	db, err := database.NewDatabase(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Connected to database successfully")

	if err := db.CreateTables(); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	log.Println("Database tables created successfully")

	sensorURL := fmt.Sprintf("http://%s:%s%s", sensorHost, sensorPort, sensorPath)
	collector := service.NewTempSensorDataCollector(sensorURL, db)

	log.Printf("Starting periodic data collection from %s every %v", sensorURL, interval)
	collector.StartPeriodicTempCollection(interval)

	if err := collector.CollectTempData(); err != nil {
		log.Printf("Initial data collection failed: %v", err)
	}

	router := api.SetupRoutes(db)
	log.Printf("Starting server on port %s", serverPort)

	if err := router.Run(":" + serverPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func getEnv(key string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	log.Fatalf("Environment variable %s is not set", key)
	return ""
}
