use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::{env, net::IpAddr, process};
use ipnetwork::IpNetwork;
use chrono::Utc;
use reqwest::blocking;
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize)]
struct IPInfo {
    query: String,
    country: String,
    #[serde(rename = "regionName")]
    region_name: String,
    city: String,
    isp: String,
    org: String,
    #[serde(rename = "as")]
    asn: String,
    timezone: String,
    lat: f64,
    lon: f64,
    status: String,
    message: Option<String>,
    #[serde(default)]
    #[serde(rename = "lastUpdated")]
    last_update: i64,
}

const CACHE_TTL: i64 = 24 * 3600; // 24 hours in seconds

fn init_db(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ip_cache (
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
        )",
        [],
    )?;
    Ok(())
}

fn get_from_cache(conn: &Connection, ip: &str) -> Option<IPInfo> {
    let mut stmt = conn.prepare(
        "SELECT ip, country, region, city, isp, org, asn, timezone, lat, lon, last_updated 
         FROM ip_cache WHERE ip = ?1",
    ).ok()?;

    let result = stmt.query_row([ip], |row| {
        Ok(IPInfo {
            query: row.get(0)?,
            country: row.get(1)?,
            region_name: row.get(2)?,
            city: row.get(3)?,
            isp: row.get(4)?,
            org: row.get(5)?,
            asn: row.get(6)?,
            timezone: row.get(7)?,
            lat: row.get(8)?,
            lon: row.get(9)?,
            last_update: row.get(10)?,
            status: "success".to_string(),
            message: None,
        })
    });

    match result {
        Ok(info) => {
            let age = Utc::now().timestamp() - info.last_update;
            if age <= CACHE_TTL {
                Some(info)
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

fn save_to_cache(conn: &Connection, info: &IPInfo) {
    let _ = conn.execute(
        "INSERT OR REPLACE INTO ip_cache 
        (ip, country, region, city, isp, org, asn, timezone, lat, lon, last_updated)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            info.query,
            info.country,
            info.region_name,
            info.city,
            info.isp,
            info.org,
            info.asn,
            info.timezone,
            info.lat,
            info.lon,
            Utc::now().timestamp(),
        ],
    );
}

fn fetch_online(ip: &str) -> Result<IPInfo, Box<dyn std::error::Error>> {
    let url = format!("http://ip-api.com/json/{}", ip);
    let resp = blocking::get(&url)?;
    let mut info: IPInfo = resp.json()?;
    if info.status != "success" {
        return Err(format!("API error: {:?}", info.message).into());
    }
    info.last_update = Utc::now().timestamp();
    Ok(info)
}

fn build_non_routable() -> Vec<IpNetwork> {
    let cidrs = vec![
        // IPv4
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
        "100.64.0.0/10",
        "192.0.2.0/24",
        "198.51.100.0/24",
        "203.0.113.0/24",
        "0.0.0.0/8",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "192.88.99.0/24",
        "255.255.255.255/32",
        // IPv6
        "::1/128",
        "fe80::/10",
        "fc00::/7",
        "ff00::/8",
        "2001:db8::/32",
        "::/128",
    ];

    cidrs.into_iter()
        .map(|c| IpNetwork::from_str(c).unwrap())
        .collect()
}

fn is_non_routable(ip: &str, nets: &[IpNetwork]) -> bool {
    if let Ok(addr) = IpAddr::from_str(ip) {
        nets.iter().any(|n| n.contains(addr))
    } else {
        true
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        println!(r#"{{"error":"Usage: ./check_ip <ip-address>"}}"#);
        process::exit(1);
    }
    let ip = &args[1];

    let nets = build_non_routable();
    if is_non_routable(ip, &nets) {
        println!(r#"{{"error":"{} is non-routable or reserved"}}"#, ip);
        process::exit(0);
    }

    let conn = Connection::open("ip_cache.db").expect("Failed to open DB");
    init_db(&conn).expect("Failed to init DB");

    let info = match get_from_cache(&conn, ip) {
        Some(info) => info,
        None => {
            match fetch_online(ip) {
                Ok(info) => {
                    save_to_cache(&conn, &info);
                    info
                }
                Err(e) => {
                    println!(r#"{{"error":"{}"}}"#, e);
                    process::exit(1);
                }
            }
        }
    };

    let out = serde_json::to_string_pretty(&info).unwrap();
    println!("{}", out);
}
