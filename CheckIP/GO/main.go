package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Response structure from ip-api.com
type IPInfo struct {
	Query      string  `json:"query"`
	Country    string  `json:"country"`
	RegionName string  `json:"regionName"`
	City       string  `json:"city"`
	ISP        string  `json:"isp"`
	Org        string  `json:"org"`
	AS         string  `json:"as"`
	Timezone   string  `json:"timezone"`
	Lat        float64 `json:"lat"`
	Lon        float64 `json:"lon"`
	Status     string  `json:"status"`
	Message    string  `json:"message"`
	LastUpdate int64   `json:"lastUpdated"` // UTC UNIX timestamp
}

const cacheTTL = 24 * time.Hour // refresh interval

var nonRoutableNets []*net.IPNet

func init() {
	// IPv4 non-routable/reserved ranges
	ipv4Ranges := []string{
		"127.0.0.0/8",       // Loopback
		"10.0.0.0/8",        // Private
		"172.16.0.0/12",     // Private
		"192.168.0.0/16",    // Private
		"169.254.0.0/16",    // Link-local
		"100.64.0.0/10",     // CGNAT
		"192.0.2.0/24",      // TEST-NET-1
		"198.51.100.0/24",   // TEST-NET-2
		"203.0.113.0/24",    // TEST-NET-3
		"0.0.0.0/8",         // “This” network
		"224.0.0.0/4",       // Multicast
		"240.0.0.0/4",       // Reserved
		"192.88.99.0/24",    // 6to4 relay (deprecated)
		"255.255.255.255/32", // Broadcast
	}

	// IPv6 non-routable/reserved ranges
	ipv6Ranges := []string{
		"::1/128",       // Loopback
		"fe80::/10",     // Link-local
		"fc00::/7",      // ULA
		"ff00::/8",      // Multicast
		"2001:db8::/32", // Documentation
		"::/128",        // Unspecified
	}

	// Parse and store in global slice
	for _, cidr := range append(ipv4Ranges, ipv6Ranges...) {
		_, netblock, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(err)
		}
		nonRoutableNets = append(nonRoutableNets, netblock)
	}
}

// isNonRoutable checks if the IP is non-routable/reserved
func isNonRoutable(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return true
	}
	for _, block := range nonRoutableNets {
		if block.Contains(ip) {
			return true
		}
	}
	return false
}

func initDB(db *sql.DB) {
	createTable := `
	CREATE TABLE IF NOT EXISTS ip_cache (
		ip TEXT PRIMARY KEY,
		country TEXT,
		region TEXT,
		city TEXT,
		isp TEXT,
		org TEXT,
		asn TEXT,
		timezone TEXT,
		lat REAL,
		lon REAL,
		last_updated INTEGER
	);`
	_, err := db.Exec(createTable)
	if err != nil {
		log.Fatal("Failed to create table:", err)
	}
}

func getFromCache(db *sql.DB, ip string) (*IPInfo, bool) {
	row := db.QueryRow(`SELECT ip, country, region, city, isp, org, asn, timezone, lat, lon, last_updated FROM ip_cache WHERE ip = ?`, ip)

	info := IPInfo{}
	err := row.Scan(&info.Query, &info.Country, &info.RegionName, &info.City,
		&info.ISP, &info.Org, &info.AS, &info.Timezone, &info.Lat, &info.Lon, &info.LastUpdate)

	if err == sql.ErrNoRows {
		return nil, false
	} else if err != nil {
		log.Fatal("Cache query failed:", err)
	}

	// Check freshness
	if time.Since(time.Unix(info.LastUpdate, 0).UTC()) > cacheTTL {
		return nil, false
	}

	info.Status = "success"
	return &info, true
}

func saveToCache(db *sql.DB, info *IPInfo) {
	info.LastUpdate = time.Now().UTC().Unix()
	_, err := db.Exec(`INSERT OR REPLACE INTO ip_cache 
		(ip, country, region, city, isp, org, asn, timezone, lat, lon, last_updated)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		info.Query, info.Country, info.RegionName, info.City,
		info.ISP, info.Org, info.AS, info.Timezone, info.Lat, info.Lon, info.LastUpdate,
	)
	if err != nil {
		log.Println("Failed to save cache:", err)
	}
}

func fetchOnline(ip string) (*IPInfo, error) {
	url := fmt.Sprintf("http://ip-api.com/json/%s", ip)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var info IPInfo
	err = json.NewDecoder(resp.Body).Decode(&info)
	if err != nil {
		return nil, err
	}
	if info.Status != "success" {
		return nil, fmt.Errorf("API error: %s", info.Message)
	}
	return &info, nil
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println(`{"error":"Usage: ./CheckIP <ip-address>"}`)
		return
	}
	ip := os.Args[1]

	// Block non-routable IPs
	if isNonRoutable(ip) {
		fmt.Printf(`{"error":"%s is non-routable or reserved"}`, ip)
		return
	}

	db, err := sql.Open("sqlite3", "./ip_cache.db")
	if err != nil {
		log.Fatal("Failed to open DB:", err)
	}
	defer db.Close()

	initDB(db)

	var info *IPInfo
	var found bool

	// 1. Try cache
	if info, found = getFromCache(db, ip); !found {
		// 2. Fetch online
		info, err = fetchOnline(ip)
		if err != nil {
			fmt.Printf(`{"error":"%s"}`, err.Error())
			return
		}
		// 3. Save to cache
		saveToCache(db, info)
	}

	// 4. Print as JSON
	out, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		fmt.Printf(`{"error":"%s"}`, err.Error())
		return
	}
	fmt.Println(string(out))
}
