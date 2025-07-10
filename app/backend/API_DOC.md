## API Endpoints

### 1. Health Check

#### GET `/health`

**Response**
```json
{
  "status": "healthy"
}
```

---

### 2. Latest Temperature Data

#### GET `/api/temp/latest`
온습도센서의 가장 최근 값 조회

**Response**
```json
{
  "id": 123,
  "temperature": 25.5,
  "humidity": 40.0,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Status Codes**
- `200 OK`
- `500 Internal Server Error`: 조회 실패

**Error Response**
```json
{
  "error": "Failed to get latest data"
}
```

---

### 3. Temperature Data History

#### GET `/api/temp/history`
온도 센서 데이터 조회 - 3가지 모드 지원

**Query Parameters**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 50 | 1000 | 조회할 데이터 개수 |
| `offset` | integer | 0 | - | 건너뛸 데이터 개수 (term/time_period 사용 시 무시) |
| `term` | integer | 0 | - | 데이터 간격 (0보다 큰 값일 때 활성화) |
| `time_period` | string | - | - | 시간 기간: "1d", "1w", "1m", "1y" |
| `start_time` | string | - | - | 시작 시간 (RFC3339 형식) |
| `end_time` | string | - | - | 종료 시간 (RFC3339 형식) |

**Filtering Modes**

**1. Time Period Mode (time_period)**
- 현재 시각부터 지정된 기간 전까지의 데이터를 정확히 50개 포인트로 샘플링
- `limit`은 항상 50으로 고정
- 자동으로 적절한 간격으로 데이터 샘플링

**2. Custom Time Range Mode (start_time, end_time)**
- 사용자 지정 시간 범위에서 데이터 샘플링
- 지정된 `limit` 수만큼 균등하게 샘플링

**3. Traditional Offset Mode (offset)**
- 최신 데이터부터 `offset`만큼 건너뛰고 `limit`개 조회

**4. Traditional Term Mode (term)**
- 최신 데이터부터 `term` 간격으로 `limit`개 조회

**Request Examples**
```
# Time period mode - Last 24 hours, 50 points
GET /api/temp/history?time_period=1d

# Time period mode - Last week, 50 points  
GET /api/temp/history?time_period=1w

# Custom time range
GET /api/temp/history?start_time=2025-01-01T00:00:00Z&end_time=2025-01-02T00:00:00Z&limit=100

# Traditional modes
GET /api/temp/history?limit=100&offset=50
GET /api/temp/history?limit=20&term=5
```

**Response (Time-based filtering)**
```json
{
  "data": [
    {
      "id": 123,
      "temperature": 25.5,
      "humidity": 60.3,
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "id": 118,
      "temperature": 24.2,
      "humidity": 57.1,
      "timestamp": "2025-01-15T10:00:00Z"
    }
  ],
  "limit": 50,
  "offset": 0,
  "term": 0,
  "time_period": "1d",
  "start_time": "2025-01-14T10:30:00Z",
  "end_time": "2025-01-15T10:30:00Z",
  "total_count": 2880,
  "returned_count": 50
}
```

**Response (Traditional filtering)**
```json
{
  "data": [
    {
      "id": 123,
      "temperature": 25.5,
      "humidity": 60.3,
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "id": 122,
      "temperature": 24.8,
      "humidity": 58.9,
      "timestamp": "2025-01-15T10:29:30Z"
    }
  ],
  "limit": 50,
  "offset": 0,
  "term": 0
}
```

**Status Codes**
- `200 OK`: 성공
- `400 Bad Request`: 잘못된 파라미터 (시간 형식 오류, time_period 값 오류 등)
- `500 Internal Server Error`: 데이터 조회 실패

**Error Response**
```json
{
  "error": "Invalid time_period. Use: 1d, 1w, 1m, 1y"
}
```
or
```json
{
  "error": "Failed to get sensor data with time range"
}
```
or
```json
{
  "error": "Invalid start_time format. Use RFC3339 (ISO 8601)"
}
```
