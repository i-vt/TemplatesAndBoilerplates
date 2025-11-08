# Check and Cache IP Information
## Usage
### Rust
```
cargo build --release

./target/release/check_ip 1.1.1.1
```

### GO
```
go mod init checkip
go get github.com/mattn/go-sqlite3
go build -o CheckIP main.go

./CheckIP 1.1.1.1
```
### Output 
```
{
  "query": "1.1.1.1",
  "country": "Australia",
  "regionName": "Queensland",
  "city": "South Brisbane",
  "isp": "Cloudflare, Inc",
  "org": "APNIC and Cloudflare DNS Resolver project",
  "as": "AS13335 Cloudflare, Inc.",
  "timezone": "Australia/Brisbane",
  "lat": -27.4766,
  "lon": 153.0166,
  "status": "success",
  "message": null,
  "lastUpdated": 1758936639
}
```

## User Story

### Title  
As a **user**, the person wants to check details about an IP address so that they can quickly see its location, network, and ISP information without always querying an external API.  

### Description  
The tool accepts an IP address as input.  

- If the IP is **non-routable or reserved**, it immediately informs the user.  
- Otherwise, it looks in a **local SQLite cache** to see if the IP’s details are already stored and still valid (not older than 24 hours).  
- If cached and fresh → it returns the cached details.  
- If not cached or expired → it queries the external API ([ip-api.com](http://ip-api.com)) to fetch up-to-date information, stores it in the cache, and then returns it.  
- The output is structured as **JSON**, which makes it easy for the user to use in other scripts or pipelines.  

### Acceptance Criteria  
- ✅ When the tool is run without arguments, it shows usage instructions.  
- ✅ When the user enters a non-routable IP (e.g., `192.168.1.1`), it informs the user that it’s reserved.  
- ✅ When the user enters a valid routable IP (e.g., `8.8.8.8`), it either:  
  - returns cached details (if less than 24h old), or  
  - fetches fresh details from the API and caches them.  
- ✅ Results always include:  
  - IP  
  - Country  
  - Region  
  - City  
  - ISP  
  - Organization  
  - ASN  
  - Timezone  
  - Latitude & Longitude  
  - Last updated timestamp  
- ✅ Output is in **pretty-printed JSON** for readability.  
