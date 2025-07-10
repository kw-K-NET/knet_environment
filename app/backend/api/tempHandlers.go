package api

import (
	"net/http"
	"strconv"
	"time"

	"knet_management/database"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(db *database.Database) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"*"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	r.GET("/api/temp/latest", getLatestTempSensorData(db))

	r.GET("/api/temp/history", getTempSensorDataHistory(db))

	return r
}

func getLatestTempSensorData(db *database.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		data, err := db.GetLatestTempSensorData()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get latest data"})
			return
		}
		c.JSON(http.StatusOK, data)
	}
}

func getTempSensorDataHistory(db *database.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Default values
		limit := 150
		offset := 0
		term := 0

		// Parse traditional parameters
		if l := c.Query("limit"); l != "" {
			if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
				limit = parsedLimit
				if limit > 1000 {
					limit = 1000
				}
			}
		}

		if o := c.Query("offset"); o != "" {
			if parsedOffset, err := strconv.Atoi(o); err == nil && parsedOffset >= 0 {
				offset = parsedOffset
			}
		}

		if t := c.Query("term"); t != "" {
			if parsedTerm, err := strconv.Atoi(t); err == nil && parsedTerm >= 0 {
				term = parsedTerm
			}
		}

		// Parse aggregation parameters
		includeAggregates := c.Query("include_aggregates") == "true"
		aggregateWindowSize := 100 // Default ±100 points
		if w := c.Query("aggregate_window"); w != "" {
			if parsedWindow, err := strconv.Atoi(w); err == nil && parsedWindow > 0 && parsedWindow <= 500 {
				aggregateWindowSize = parsedWindow
			}
		}

		// Parse time-based parameters
		timePeriod := c.Query("time_period")  // "1d", "1w", "1m", "1y"
		startTimeStr := c.Query("start_time") // ISO 8601 format
		endTimeStr := c.Query("end_time")     // ISO 8601 format

		var data []database.TempSensorData
		var err error

		// Determine which mode to use: time-based or traditional
		if timePeriod != "" || (startTimeStr != "" && endTimeStr != "") {
			// Time-based filtering mode
			var startTime, endTime time.Time
			now := time.Now()

			if timePeriod != "" {
				// Calculate time range based on period
				endTime = now
				switch timePeriod {
				case "1d":
					startTime = now.Add(-24 * time.Hour)
				case "1w":
					startTime = now.Add(-7 * 24 * time.Hour)
				case "1m":
					startTime = now.Add(-30 * 24 * time.Hour)
				case "1y":
					startTime = now.Add(-365 * 24 * time.Hour)
				default:
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time_period. Use: 1d, 1w, 1m, 1y"})
					return
				}
			} else {
				// Parse custom start/end times
				var parseErr error
				startTime, parseErr = time.Parse(time.RFC3339, startTimeStr)
				if parseErr != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_time format. Use RFC3339 (ISO 8601)"})
					return
				}

				endTime, parseErr = time.Parse(time.RFC3339, endTimeStr)
				if parseErr != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_time format. Use RFC3339 (ISO 8601)"})
					return
				}

				if startTime.After(endTime) {
					c.JSON(http.StatusBadRequest, gin.H{"error": "start_time cannot be after end_time"})
					return
				}
			}

			// Use time-based sampling to get exactly 'limit' data points
			data, err = db.GetTempSensorDataWithTimeIntervals(startTime, endTime, limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get sensor data with time range"})
				return
			}

			// Always apply aggregation (default ±3 for main display + configurable if requested)
			if includeAggregates {
				data, err = db.GetTempSensorDataWithAggregation(data, aggregateWindowSize)
			} else {
				// Still calculate default aggregated values (±3) for main display only
				data, err = db.GetTempSensorDataWithAggregation(data, 0) // 0 means skip configurable aggregation
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate aggregated values"})
				return
			}

			// Get total count for metadata
			totalCount, countErr := db.GetDataCountInTimeRange(startTime, endTime)
			if countErr != nil {
				totalCount = len(data) // fallback
			}

			response := gin.H{
				"data":           data,
				"limit":          limit,
				"offset":         0,
				"term":           0,
				"time_period":    timePeriod,
				"start_time":     startTime.Format(time.RFC3339),
				"end_time":       endTime.Format(time.RFC3339),
				"total_count":    totalCount,
				"returned_count": len(data),
			}

			// Add aggregation metadata if used
			if includeAggregates {
				response["aggregation"] = gin.H{
					"enabled":     true,
					"window_size": aggregateWindowSize,
				}
			}

			c.JSON(http.StatusOK, response)

		} else if term > 0 {
			// Traditional term-based mode
			data, err = db.GetTempSensorDataWithTerm(limit, term)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get sensor data with term"})
				return
			}

			// Always apply aggregation (default ±3 for main display + configurable if requested)
			if includeAggregates {
				data, err = db.GetTempSensorDataWithAggregation(data, aggregateWindowSize)
			} else {
				// Still calculate default aggregated values (±3) for main display only
				data, err = db.GetTempSensorDataWithAggregation(data, 0) // 0 means skip configurable aggregation
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate aggregated values"})
				return
			}

			response := gin.H{
				"data":   data,
				"limit":  limit,
				"offset": offset,
				"term":   term,
			}

			// Add aggregation metadata if used
			if includeAggregates {
				response["aggregation"] = gin.H{
					"enabled":     true,
					"window_size": aggregateWindowSize,
				}
			}

			c.JSON(http.StatusOK, response)
		} else {
			// Traditional offset-based mode
			data, err = db.GetTempSensorData(limit, offset)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get sensor data"})
				return
			}

			// Always apply aggregation (default ±3 for main display + configurable if requested)
			if includeAggregates {
				data, err = db.GetTempSensorDataWithAggregation(data, aggregateWindowSize)
			} else {
				// Still calculate default aggregated values (±3) for main display only
				data, err = db.GetTempSensorDataWithAggregation(data, 0) // 0 means skip configurable aggregation
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate aggregated values"})
				return
			}

			response := gin.H{
				"data":   data,
				"limit":  limit,
				"offset": offset,
				"term":   term,
			}

			// Add aggregation metadata if used
			if includeAggregates {
				response["aggregation"] = gin.H{
					"enabled":     true,
					"window_size": aggregateWindowSize,
				}
			}

			c.JSON(http.StatusOK, response)
		}
	}
}
