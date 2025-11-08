import React, { useState, useEffect, useRef } from 'react';
import { Activity, Wifi, WifiOff, MapPin, Globe, Clock, Play, Pause, RotateCw, Server, TrendingUp, AlertCircle, CheckCircle2, XCircle, Zap } from 'lucide-react';

export default function NetworkMonitor() {
  const [ipInfo, setIpInfo] = useState(null);
  const [domainStatuses, setDomainStatuses] = useState({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const monitoringRef = useRef(null);

  const domains = [
    'google.com', 'bing.com', 'yahoo.com', 'msn.com',
    'microsoft.com', 'apple.com', 'amazon.com', 'linkedin.com',
    'ibm.com', 'oracle.com', 'salesforce.com', 'adobe.com',
    'intel.com', 'nvidia.com', 'dell.com', 'hp.com',
    'lenovo.com', 'cisco.com', 'sap.com', 'zoom.us',
    'cloudflare.com', 'slack.com', 'dropbox.com', 'box.com',
    'atlassian.com', 'github.com', 'stackoverflow.com', 'trello.com',
    'airbnb.com', 'uber.com', 'paypal.com', 'stripe.com',
    'walmart.com', 'target.com', 'costco.com', 'fedex.com',
    'dhl.com', 'ups.com', 'bbc.com', 'nytimes.com',
    'theguardian.com', 'cnn.com', 'bloomberg.com', 'forbes.com',
    'reuters.com'
  ];

  useEffect(() => {
    fetchIPInfo();
    
    // Set up IP refresh with random interval between 30-90 seconds
    const scheduleNextIPRefresh = () => {
      const randomInterval = Math.floor(Math.random() * (90000 - 30000 + 1)) + 30000; // 30-90 seconds
      return setTimeout(() => {
        fetchIPInfo();
        scheduleNextIPRefresh();
      }, randomInterval);
    };
    
    const ipRefreshTimeout = scheduleNextIPRefresh();
    
    return () => {
      if (ipRefreshTimeout) clearTimeout(ipRefreshTimeout);
    };
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
    return () => stopMonitoring();
  }, [isMonitoring]);

  const fetchIPInfo = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      setIpInfo(data);
    } catch (error) {
      console.error('Failed to fetch IP info:', error);
      setIpInfo({ error: 'Failed to fetch location' });
    }
  };

  const checkDomain = async (domain) => {
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      await fetch(`https://${domain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Math.round(performance.now() - startTime);
      
      return {
        status: 'online',
        message: `Response in ${responseTime}ms`,
        timestamp: new Date().toLocaleString(),
        responseTime
      };
    } catch (error) {
      const responseTime = Math.round(performance.now() - startTime);
      return {
        status: 'error',
        message: error.name === 'AbortError' ? 'Timeout' : 'No response',
        timestamp: new Date().toLocaleString(),
        responseTime
      };
    }
  };

  const monitorDomains = async () => {
    const promises = domains.map(async (domain) => {
      const result = await checkDomain(domain);
      return { domain, result };
    });

    const results = await Promise.all(promises);
    const newStatuses = {};
    results.forEach(({ domain, result }) => {
      newStatuses[domain] = result;
    });

    setDomainStatuses(newStatuses);
    setLastUpdate(new Date().toLocaleString());
    
    // Track history for stats
    const onlineCount = results.filter(r => r.result.status === 'online').length;
    setStatusHistory(prev => [...prev.slice(-19), { time: new Date().toLocaleTimeString(), online: onlineCount, total: domains.length }]);
  };

  const startMonitoring = () => {
    monitorDomains();
    monitoringRef.current = setInterval(() => {
      monitorDomains();
    }, 5000);
  };

  const stopMonitoring = () => {
    if (monitoringRef.current) {
      clearInterval(monitoringRef.current);
      monitoringRef.current = null;
    }
  };

  const onlineCount = Object.values(domainStatuses).filter(s => s.status === 'online').length;
  const offlineCount = Object.values(domainStatuses).filter(s => s.status === 'error').length;
  const avgResponseTime = Object.values(domainStatuses)
    .filter(s => s.status === 'online')
    .reduce((acc, s) => acc + s.responseTime, 0) / (onlineCount || 1);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-lg">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Network Operations Center</h1>
                <p className="text-sm text-slate-500">Real-time Infrastructure Monitoring</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {lastUpdate && (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                  <span className="text-sm text-slate-600 font-medium">Last sync: {lastUpdate}</span>
                </div>
              )}
              
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-sm ${
                  isMonitoring
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                }`}
              >
                {isMonitoring ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Stop Monitor
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Monitor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-6">
        {/* System Information Panel */}
        {ipInfo && !ipInfo.error && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-xl p-6 mb-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">System Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-slate-300 text-xs font-medium uppercase tracking-wide mb-1">IP Address</div>
                <div className="text-xl font-bold blur-sm select-none">{ipInfo.ip}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-slate-300 text-xs font-medium uppercase tracking-wide mb-1">Location</div>
                <div className="text-xl font-bold">{ipInfo.city}, {ipInfo.country_code}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-slate-300 text-xs font-medium uppercase tracking-wide mb-1">ISP Provider</div>
                <div className="text-lg font-bold truncate">{ipInfo.org || 'Unknown'}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-slate-300 text-xs font-medium uppercase tracking-wide mb-1">Timezone</div>
                <div className="text-xl font-bold">{ipInfo.timezone || 'Unknown'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Dashboard */}
        {Object.keys(domainStatuses).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <Server className="w-6 h-6 text-blue-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Endpoints</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{domains.length}</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-sm font-semibold text-green-600">
                  {((onlineCount / domains.length) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Online</div>
              <div className="text-3xl font-bold text-green-600 mt-1">{onlineCount}</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-red-50 p-3 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-sm font-semibold text-red-600">
                  {((offlineCount / domains.length) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Offline</div>
              <div className="text-3xl font-bold text-red-600 mt-1">{offlineCount}</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-purple-50 p-3 rounded-lg">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Avg Response</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{Math.round(avgResponseTime)}ms</div>
            </div>
          </div>
        )}

        {/* Status Overview Table */}
        {Object.keys(domainStatuses).length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Endpoint Status Monitor</h2>
                </div>
                {isMonitoring && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Auto-refresh: 5s
                  </div>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Response</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {domains.map((domain, index) => {
                    const status = domainStatuses[domain];
                    return (
                      <tr 
                        key={domain}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          {status?.status === 'online' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-sm font-semibold text-green-700">Online</span>
                            </div>
                          ) : status?.status === 'error' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                              <span className="text-sm font-semibold text-red-700">Offline</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
                              <span className="text-sm font-medium text-slate-500">Pending</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">{domain}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {status ? (
                            <span className={`text-sm font-medium ${status.status === 'online' ? 'text-slate-700' : 'text-slate-500'}`}>
                              {status.message}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {status?.timestamp || '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Ready to Monitor</h3>
              <p className="text-slate-500 mb-6">
                Click "Start Monitor" to begin real-time connectivity monitoring across all {domains.length} endpoints.
              </p>
              <button
                onClick={() => setIsMonitoring(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all"
              >
                <Play className="w-4 h-4" />
                Start Monitoring
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
