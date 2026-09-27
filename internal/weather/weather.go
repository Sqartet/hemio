// Package weather fetches current conditions + forecast from Open-Meteo
// (no API key required) and caches responses.
package weather

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"hemio/internal/config"
)

type Current struct {
	Temp        float64 `json:"temp"`
	Apparent    float64 `json:"apparent"`
	Humidity    int     `json:"humidity"`
	WindKph     float64 `json:"wind_kph"`
	WeatherCode int     `json:"code"`
	IsDay       bool    `json:"is_day"`
}

type Day struct {
	Date  string  `json:"date"`
	Code  int     `json:"code"`
	TMax  float64 `json:"tmax"`
	TMin  float64 `json:"tmin"`
}

type Report struct {
	OK        bool      `json:"ok"`
	City      string    `json:"city"`
	Current   Current   `json:"current"`
	Forecast  []Day     `json:"forecast"`
	FetchedAt int64     `json:"fetched_at"`
}

var (
	mu     sync.Mutex
	cached *Report
)

// Get returns a weather report, refreshing at most every 30 minutes.
func Get() *Report {
	mu.Lock()
	defer mu.Unlock()
	if cached != nil && time.Now().Unix()-cached.FetchedAt < 1800 {
		return cached
	}
	c := config.Get()
	lat, lon, city := c.Geo.Lat, c.Geo.Lon, c.Geo.City
	if lat == 0 && lon == 0 {
		// default: Casablanca
		lat, lon, city = 33.5731, -7.5898, "Casablanca"
	}
	if city == "" {
		city = "Local"
	}
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f"+
			"&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m"+
			"&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto",
		lat, lon)

	cl := &http.Client{Timeout: 8 * time.Second}
	resp, err := cl.Get(url)
	if err != nil {
		if cached != nil {
			return cached
		}
		return &Report{OK: false, City: city}
	}
	defer resp.Body.Close()

	var om struct {
		Current struct {
			Temperature        float64 `json:"temperature_2m"`
			ApparentTemperature float64 `json:"apparent_temperature"`
			Humidity           int     `json:"relative_humidity_2m"`
			IsDay              int     `json:"is_day"`
			Code               int     `json:"weather_code"`
			Wind               float64 `json:"wind_speed_10m"`
		} `json:"current"`
		Daily struct {
			Time   []string  `json:"time"`
			Code   []int     `json:"weather_code"`
			TMax   []float64 `json:"temperature_2m_max"`
			TMin   []float64 `json:"temperature_2m_min"`
		} `json:"daily"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&om); err != nil {
		if cached != nil {
			return cached
		}
		return &Report{OK: false, City: city}
	}

	r := &Report{
		OK:        true,
		City:      city,
		FetchedAt: time.Now().Unix(),
		Current: Current{
			Temp:     om.Current.Temperature,
			Apparent: om.Current.ApparentTemperature,
			Humidity: om.Current.Humidity,
			WindKph:  om.Current.Wind,
			WeatherCode: om.Current.Code,
			IsDay:    om.Current.IsDay == 1,
		},
	}
	for i := range om.Daily.Time {
		if i >= 5 {
			break
		}
		r.Forecast = append(r.Forecast, Day{
			Date: om.Daily.Time[i],
			Code: safe(om.Daily.Code, i),
			TMax: safeF(om.Daily.TMax, i),
			TMin: safeF(om.Daily.TMin, i),
		})
	}
	cached = r
	return r
}

func safe(a []int, i int) int    { if i < len(a) { return a[i] }; return 0 }
func safeF(a []float64, i int) float64 { if i < len(a) { return a[i] }; return 0 }
