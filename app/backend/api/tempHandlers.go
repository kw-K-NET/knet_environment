package api

import (
	"fmt"
	"net/http"

	"knet_management/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(db *database.Database) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

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
		limit := 50
		offset := 0
		term := 0

		if l := c.Query("limit"); l != "" {
			if parsedLimit, err := fmt.Sscanf(l, "%d", &limit); err != nil || parsedLimit != 1 {
				limit = 50
			}
		}

		if o := c.Query("offset"); o != "" {
			if parsedOffset, err := fmt.Sscanf(o, "%d", &offset); err != nil || parsedOffset != 1 {
				offset = 0
			}
		}

		if t := c.Query("term"); t != "" {
			if parsedTerm, err := fmt.Sscanf(t, "%d", &term); err != nil || parsedTerm != 1 {
				term = 0
			}
		}

		if limit > 1000 {
			limit = 1000
		}

		var data []database.TempSensorData
		var err error

		if term > 0 {
			data, err = db.GetTempSensorDataWithTerm(limit, term)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get sensor data with term"})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"data":   data,
				"limit":  limit,
				"offset": offset,
				"term":   term,
			})
		} else {
			data, err = db.GetTempSensorData(limit, offset)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get sensor data"})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"data":   data,
				"limit":  limit,
				"offset": offset,
				"term":   term,
			})
		}
	}
}
