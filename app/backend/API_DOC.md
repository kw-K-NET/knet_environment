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
온도 센서 데이터 조회

**Query Parameters**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 50 | 1000 | 조회할 데이터 개수 |
| `offset` | integer | 0 | - | 건너뛸 데이터 개수 (term param 받을 경우 무시) |
| `term` | integer | 0 | - | 데이터 간격 (0보다 큰 값일 때 활성화) |

**Request Examples**
```
GET /api/temp/history
GET /api/temp/history?limit=100&offset=50
GET /api/temp/history?limit=20&term=5
```

**Response (offset 사용, 기본)**
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

**Response (term: 간격을 두고 데이터 조회)**
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
      "timestamp": "2025-01-15T10:27:30Z"
    }
  ],
  "limit": 20,
  "offset": 0,
  "term": 5
}
```

**Status Codes**
- `200 OK`: 성공
- `500 Internal Server Error`: 데이터 조회 실패

**Error Response**
```json
{
  "error": "Failed to get sensor data"
}
```
or
```json
{
  "error": "Failed to get sensor data with term"
}
```
