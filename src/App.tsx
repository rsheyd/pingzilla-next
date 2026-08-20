// ABOUTME: PingZilla Next React frontend - displays ping graph and current latency
// ABOUTME: Supports multiple targets with tabs and statistics display

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
} from "recharts";
import "./App.css";

// Animated number component for smooth transitions
function AnimatedNumber({ value, duration = 300 }: { value: number | null; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === null) {
      setDisplayValue(null);
      return;
    }

    const startValue = displayValue ?? value;
    startValueRef.current = startValue;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - (startTimeRef.current ?? currentTime);
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const start = startValueRef.current ?? value;
      const current = start + (value - start) * easeOut;

      setDisplayValue(Math.round(current));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return <>{displayValue !== null ? displayValue : "---"}</>;
}

type PingMethod = "Icmp" | "TcpDns" | "TcpHttps" | "TcpHttp";

interface PingResult {
  timestamp: string;
  latency_ms: number | null;
  target: string;
  method: PingMethod | null;
  session_id: string | null;
}

interface PingStatistics {
  min_ms: number | null;
  max_ms: number | null;
  avg_ms: number | null;
  packet_loss_pct: number;
  total_pings: number;
  failed_pings: number;
}

interface NetworkSession {
  id: string;
  fingerprint: string;
  public_ip: string;
  isp: string | null;
  label: string | null;
  bssid: string | null;
  started_at: string;
  ended_at: string | null;
}

interface SpeedTestResult {
  id: string;
  timestamp: string;
  session_id: string | null;
  download_mbps: number;
  upload_mbps: number;
  loaded_latency_ms: number | null;
  idle_latency_ms: number | null;
  responsiveness_rpm: number | null;
  interface_name: string | null;
}

interface SessionDetails {
  session: NetworkSession;
  median_ms: number | null;
  average_ms: number | null;
  p95_ms: number | null;
  packet_loss_pct: number;
  total_pings: number;
  latest_speed_test: SpeedTestResult | null;
}

interface ChartRow {
  timestamp: number;
  ping: PingResult;
  [key: string]: number | PingResult | null;
}

interface IpInfo {
  ip: string;
  country: string;
  country_code: string;
  city: string | null;
  isp: string | null;
}

interface SiteMonitor {
  url: string;
  name: string | null;
  enabled: boolean;
}

interface SiteStatus {
  url: string;
  is_up: boolean;
  latency_ms: number | null;
  last_check: string;
  last_down: string | null;
}

// VPN drop detection types
type NetworkChangeType = "IpChanged" | "CountryChanged" | "IspChanged" | "Initial";

interface NetworkChangeEvent {
  change_type: NetworkChangeType;
  previous: IpInfo | null;
  current: IpInfo;
  timestamp: string;
  is_expected: boolean;
}

interface VpnProtectionSettings {
  enabled: boolean;
  check_interval_secs: number;
  alert_on_country_change: boolean;
  alert_on_ip_change: boolean;
  expected_country: string | null;
}

type DisplayMode = "icon_only" | "icon_and_ping" | "ping_only";

// View mode for window type detection (dashboard vs settings)
type ViewMode = "dashboard" | "settings" | "full";

// Get view mode from URL params (e.g., index.html?view=dashboard)
const getViewMode = (): ViewMode => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "dashboard") return "dashboard";
  if (view === "settings") return "settings";
  return "full"; // Default: show everything (for compatibility)
};

// Convert country code to flag emoji
const countryCodeToFlag = (code: string): string => {
  if (!code || code.length !== 2) return "";
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
};

const NETWORK_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#eab308",
  "#ec4899",
];

const stableColor = (value: string): string => {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return NETWORK_COLORS[Math.abs(hash) % NETWORK_COLORS.length];
};

const downsampleHistory = (history: PingResult[], maximum = 900): PingResult[] => {
  if (history.length <= maximum) return history;
  const bucketSize = Math.ceil(history.length / (maximum / 2));
  const sampled: PingResult[] = [];

  for (let start = 0; start < history.length; start += bucketSize) {
    const bucket = history.slice(start, start + bucketSize);
    const timedOut = bucket.find((ping) => ping.latency_ms === null);
    const successful = bucket.filter((ping) => ping.latency_ms !== null);
    const lowest = successful.reduce<PingResult | null>(
      (best, ping) => !best || (ping.latency_ms ?? Infinity) < (best.latency_ms ?? Infinity) ? ping : best,
      null,
    );
    const highest = successful.reduce<PingResult | null>(
      (best, ping) => !best || (ping.latency_ms ?? -Infinity) > (best.latency_ms ?? -Infinity) ? ping : best,
      null,
    );
    for (const ping of [lowest, highest, timedOut]) {
      if (ping && !sampled.includes(ping)) sampled.push(ping);
    }
  }

  return sampled.sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
};

function App() {
  // Detect view mode from URL params
  const viewMode = getViewMode();

  const [targets, setTargets] = useState<string[]>(["1.1.1.1"]);
  const [activeTarget, setActiveTarget] = useState("1.1.1.1");
  const [currentPings, setCurrentPings] = useState<Record<string, number | null>>({});
  const [currentMethods, setCurrentMethods] = useState<Record<string, PingMethod | null>>({});
  const [histories, setHistories] = useState<Record<string, PingResult[]>>({});
  const [statistics, setStatistics] = useState<PingStatistics | null>(null);
  const [statsPeriod, setStatsPeriod] = useState(5); // minutes
  const [historyViewportEnd, setHistoryViewportEnd] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(400);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("icon_and_ping");
  const [showSettings, setShowSettings] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [siteMonitors, setSiteMonitors] = useState<SiteMonitor[]>([]);
  const [siteStatuses, setSiteStatuses] = useState<Record<string, SiteStatus>>({});
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [newSiteName, setNewSiteName] = useState("");
  // VPN drop detection state
  const [vpnSettings, setVpnSettings] = useState<VpnProtectionSettings>({
    enabled: true,
    check_interval_secs: 30,
    alert_on_country_change: true,
    alert_on_ip_change: true,
    expected_country: null,
  });
  const [networkAlert, setNetworkAlert] = useState<NetworkChangeEvent | null>(null);
  const [showVpnSettings, setShowVpnSettings] = useState(false);
  // Ping interval setting (in seconds)
  const [pingInterval, setPingInterval] = useState(10);
  const [speedTestDuration, setSpeedTestDuration] = useState(7);
  const [networkSessions, setNetworkSessions] = useState<NetworkSession[]>([]);
  const [speedTests, setSpeedTests] = useState<SpeedTestResult[]>([]);
  const [selectedPing, setSelectedPing] = useState<PingResult | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [networkName, setNetworkName] = useState("");
  const [editingNetworkName, setEditingNetworkName] = useState(false);
  const [speedTesting, setSpeedTesting] = useState(false);
  const [speedTestSecondsRemaining, setSpeedTestSecondsRemaining] = useState(0);
  const [speedTestError, setSpeedTestError] = useState<string | null>(null);
  const [bssidLoading, setBssidLoading] = useState(false);
  const [bssidError, setBssidError] = useState<string | null>(null);
  // App version from Tauri
  const [appVersion, setAppVersion] = useState("");

  // Load initial data and settings
  useEffect(() => {
    const loadData = async () => {
      try {
        const loadedTargets = await invoke<string[]>("get_targets");
        setTargets(loadedTargets);
        if (loadedTargets.length > 0) {
          setActiveTarget(loadedTargets[0]);
        }

        const [primaryTarget, loadedThreshold, loadedDisplayMode] = await invoke<[string, number, string]>("get_settings");
        setActiveTarget(primaryTarget);
        setThreshold(loadedThreshold);
        setDisplayMode(loadedDisplayMode as DisplayMode);

        const autoStartEnabled = await isEnabled();
        setLaunchAtLogin(autoStartEnabled);

        // Load app version
        const version = await getVersion();
        setAppVersion(version);

        // Load history for each target
        const newHistories: Record<string, PingResult[]> = {};
        const newCurrentPings: Record<string, number | null> = {};

        for (const target of loadedTargets) {
          const pingHistory = await invoke<PingResult[]>("get_ping_history", { target });
          newHistories[target] = pingHistory;

          if (pingHistory.length > 0) {
            const last = pingHistory[pingHistory.length - 1];
            newCurrentPings[target] = last.latency_ms;
          }
        }

        setHistories(newHistories);
        setCurrentPings(newCurrentPings);

        const [loadedSessions, loadedSpeedTests] = await Promise.all([
          invoke<NetworkSession[]>("get_network_sessions"),
          invoke<SpeedTestResult[]>("get_speed_tests"),
        ]);
        setNetworkSessions(loadedSessions);
        setSpeedTests(loadedSpeedTests);

        // Load IP info
        try {
          const loadedIpInfo = await invoke<IpInfo>("get_my_ip_info", {});
          setIpInfo(loadedIpInfo);
        } catch (e) {
          console.error("Failed to load IP info:", e);
        }

        // Load site monitors
        try {
          const loadedMonitors = await invoke<SiteMonitor[]>("get_site_monitors");
          setSiteMonitors(loadedMonitors);
          const loadedStatuses = await invoke<Record<string, SiteStatus>>("get_site_statuses");
          setSiteStatuses(loadedStatuses);
        } catch (e) {
          console.error("Failed to load site monitors:", e);
        }

        // Load VPN protection settings
        try {
          const loadedVpnSettings = await invoke<VpnProtectionSettings>("get_vpn_settings");
          setVpnSettings(loadedVpnSettings);
        } catch (e) {
          console.error("Failed to load VPN settings:", e);
        }

        // Load ping interval setting
        try {
          const loadedPingInterval = await invoke<number>("get_ping_interval");
          setPingInterval(loadedPingInterval);
        } catch (e) {
          console.error("Failed to load ping interval:", e);
        }

        try {
          const loadedDuration = await invoke<number>("get_speed_test_duration");
          setSpeedTestDuration(loadedDuration);
        } catch (e) {
          console.error("Failed to load speed test duration:", e);
        }
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    };

    loadData();
  }, []);

  // Track window visibility for adaptive ping interval (battery optimization)
  useEffect(() => {
    const handleFocus = () => {
      invoke('set_window_visible', { visible: true }).catch(console.error);
    };
    const handleBlur = () => {
      invoke('set_window_visible', { visible: false }).catch(console.error);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Set initial state based on document focus
    if (document.hasFocus()) {
      handleFocus();
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Load statistics when active target or period changes
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await invoke<PingStatistics>("get_statistics", {
          target: activeTarget,
          minutes: statsPeriod,
        });
        setStatistics(stats);
      } catch (e) {
        console.error("Failed to load statistics:", e);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 5000); // Refresh stats every 5 seconds
    return () => clearInterval(interval);
  }, [activeTarget, statsPeriod]);

  // Listen for real-time ping updates
  useEffect(() => {
    const unlisten = listen<PingResult>("ping-update", (event) => {
      const result = event.payload;

      setCurrentPings((prev) => ({
        ...prev,
        [result.target]: result.latency_ms,
      }));

      setCurrentMethods((prev) => ({
        ...prev,
        [result.target]: result.method,
      }));

      setHistories((prev) => {
        const targetHistory = prev[result.target] || [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const newData = [...targetHistory, result].filter(
          (ping) => new Date(ping.timestamp).getTime() >= cutoff,
        );
        return { ...prev, [result.target]: newData };
      });
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<NetworkSession>("network-session-update", async () => {
      setNetworkSessions(await invoke<NetworkSession[]>("get_network_sessions"));
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  // Listen for site status updates
  useEffect(() => {
    const unlisten = listen<Record<string, SiteStatus>>("site-status-update", (event) => {
      setSiteStatuses(event.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Listen for network change events (VPN drop detection)
  useEffect(() => {
    const unlisten = listen<NetworkChangeEvent>("network-change", (event) => {
      const change = event.payload;
      // Show alert for unexpected country changes (VPN dropped!)
      if (!change.is_expected && change.change_type === "CountryChanged") {
        setNetworkAlert(change);
      }
      // Update IP info with current values
      setIpInfo(change.current);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const refreshIpInfo = useCallback(async () => {
    setIpLoading(true);
    try {
      const info = await invoke<IpInfo>("get_my_ip_info", { forceRefresh: true });
      setIpInfo(info);
    } catch (e) {
      console.error("Failed to refresh IP info:", e);
    } finally {
      setIpLoading(false);
    }
  }, []);

  const addSiteMonitor = useCallback(async () => {
    if (!newSiteUrl.trim()) return;
    try {
      await invoke("add_site_monitor", {
        url: newSiteUrl.trim(),
        name: newSiteName.trim() || null,
      });
      const updatedMonitors = await invoke<SiteMonitor[]>("get_site_monitors");
      setSiteMonitors(updatedMonitors);
      setNewSiteUrl("");
      setNewSiteName("");
      setShowAddSite(false);
    } catch (e) {
      console.error("Failed to add site monitor:", e);
    }
  }, [newSiteUrl, newSiteName]);

  const removeSiteMonitor = useCallback(async (url: string) => {
    try {
      await invoke("remove_site_monitor", { url });
      const updatedMonitors = await invoke<SiteMonitor[]>("get_site_monitors");
      setSiteMonitors(updatedMonitors);
      setSiteStatuses((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    } catch (e) {
      console.error("Failed to remove site monitor:", e);
    }
  }, []);

  const acknowledgeNetworkAlert = useCallback(async () => {
    try {
      await invoke("acknowledge_ip_change");
      setNetworkAlert(null);
    } catch (e) {
      console.error("Failed to acknowledge network alert:", e);
    }
  }, []);

  const updateVpnSettings = useCallback(async (newSettings: VpnProtectionSettings) => {
    try {
      await invoke("set_vpn_settings", { settings: newSettings });
      setVpnSettings(newSettings);
    } catch (e) {
      console.error("Failed to update VPN settings:", e);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      await invoke("set_notification_threshold", { thresholdMs: threshold });
      await invoke("set_display_mode", { mode: displayMode });
      await invoke("set_ping_interval", { intervalSecs: pingInterval });
      await invoke("set_speed_test_duration", {
        durationSecs: speedTestDuration,
      });
      setShowSettings(false);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }, [threshold, displayMode, pingInterval, speedTestDuration]);

  const toggleLaunchAtLogin = useCallback(async () => {
    try {
      if (launchAtLogin) {
        await disable();
        setLaunchAtLogin(false);
      } else {
        await enable();
        setLaunchAtLogin(true);
      }
    } catch (e) {
      console.error("Failed to toggle launch at login:", e);
    }
  }, [launchAtLogin]);

  // Determine ping color based on latency
  const getPingColor = (ms: number | null): string => {
    if (ms === null) return "#888";
    if (ms < 100) return "#22c55e"; // green
    if (ms < 150) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  const getPingStatus = (ms: number | null): string => {
    if (ms === null) return "Timeout";
    if (ms < 100) return "Excellent";
    if (ms < 150) return "Good";
    return "Poor";
  };

  const currentPing = currentPings[activeTarget] ?? null;
  const currentMethod = currentMethods[activeTarget] ?? null;
  const history = histories[activeTarget] || [];
  const historyWindowMs = statsPeriod * 60 * 1000;
  const sessionById = useMemo(
    () => new Map(networkSessions.map((session) => [session.id, session])),
    [networkSessions],
  );
  const chart = useMemo(() => {
    const axisEnd = historyViewportEnd ?? Date.now();
    const axisStart = axisEnd - historyWindowMs;
    const filtered = history.filter(
      (ping) => {
        const timestamp = new Date(ping.timestamp).getTime();
        return timestamp >= axisStart && timestamp <= axisEnd;
      },
    );
    const sampled = downsampleHistory(filtered);
    const sessionIds = Array.from(
      new Set(sampled.map((ping) => ping.session_id || "unknown")),
    );
    const segments = sessionIds.map((sessionId, index) => {
      const session = sessionById.get(sessionId);
      return {
        key: `segment_${index}`,
        sessionId,
        color: stableColor(session?.label || session?.fingerprint || sessionId),
      };
    });
    const segmentKey = new Map(
      segments.map((segment) => [segment.sessionId, segment.key]),
    );
    const rows: ChartRow[] = sampled.map((ping) => {
      const row: ChartRow = {
        timestamp: new Date(ping.timestamp).getTime(),
        ping,
      };
      row[segmentKey.get(ping.session_id || "unknown") || "segment_0"] =
        ping.latency_ms;
      return row;
    });
    const markers = speedTests
      .filter((test) => {
        const timestamp = new Date(test.timestamp).getTime();
        return timestamp >= axisStart && sampled.length > 0;
      })
      .map((test) => {
        const timestamp = new Date(test.timestamp).getTime();
        const nearest = sampled.reduce((best, ping) =>
          Math.abs(new Date(ping.timestamp).getTime() - timestamp) <
          Math.abs(new Date(best.timestamp).getTime() - timestamp)
            ? ping
            : best,
        );
        return {
          timestamp,
          markerLatency: nearest.latency_ms ?? 0,
          ping: nearest,
          speedTest: test,
        };
    });
    return { rows, segments, markers, axisStart, axisEnd };
  }, [history, historyViewportEnd, historyWindowMs, sessionById, speedTests]);

  const scrollHistory = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0;
      if (horizontalDelta === 0 || history.length === 0) return;

      event.preventDefault();
      const earliestTimestamp = new Date(history[0].timestamp).getTime();
      const earliestEnd = Math.min(
        Date.now(),
        earliestTimestamp + historyWindowMs,
      );
      const millisecondsPerPixel = historyWindowMs / 500;

      setHistoryViewportEnd((currentEnd) => {
        const nextEnd = Math.max(
          earliestEnd,
          Math.min(Date.now(), (currentEnd ?? Date.now()) + horizontalDelta * millisecondsPerPixel),
        );
        return Date.now() - nextEnd < 1000 ? null : nextEnd;
      });
    },
    [history, historyWindowMs],
  );

  useEffect(() => {
    setHistoryViewportEnd(null);
  }, [activeTarget, statsPeriod]);

  useEffect(() => {
    if (!selectedPing?.session_id) {
      setSessionDetails(null);
      setNetworkName("");
      return;
    }
    invoke<SessionDetails>("get_session_details", {
      sessionId: selectedPing.session_id,
      target: activeTarget,
    })
      .then((details) => {
        setSessionDetails(details);
        setNetworkName(details.session.label || "");
        setEditingNetworkName(false);
      })
      .catch((error) => {
        console.error("Failed to load session details:", error);
        setSessionDetails(null);
      });
  }, [activeTarget, selectedPing]);

  const renameSelectedNetwork = useCallback(async () => {
    if (!sessionDetails) return;
    await invoke("rename_network_session", {
      sessionId: sessionDetails.session.id,
      label: networkName,
    });
    const sessions = await invoke<NetworkSession[]>("get_network_sessions");
    setNetworkSessions(sessions);
    setSessionDetails(await invoke<SessionDetails>("get_session_details", {
      sessionId: sessionDetails.session.id,
      target: activeTarget,
    }));
    setEditingNetworkName(false);
  }, [activeTarget, networkName, sessionDetails]);

  const runSpeedTest = useCallback(async () => {
    setSpeedTestSecondsRemaining(speedTestDuration);
    setSpeedTesting(true);
    setSpeedTestError(null);
    try {
      const result = await invoke<SpeedTestResult>("run_speed_test");
      setSpeedTests((previous) => [...previous, result]);
      if (selectedPing?.session_id === result.session_id) {
        setSessionDetails(await invoke<SessionDetails>("get_session_details", {
          sessionId: result.session_id,
          target: activeTarget,
        }));
      }
    } catch (error) {
      setSpeedTestError(String(error));
    } finally {
      setSpeedTesting(false);
    }
  }, [activeTarget, selectedPing, speedTestDuration]);

  const revealBssid = useCallback(async () => {
    if (!sessionDetails) return;
    setBssidLoading(true);
    setBssidError(null);
    try {
      await invoke<string>("reveal_current_bssid");
      const sessions = await invoke<NetworkSession[]>("get_network_sessions");
      setNetworkSessions(sessions);
      setSessionDetails(await invoke<SessionDetails>("get_session_details", {
        sessionId: sessionDetails.session.id,
        target: activeTarget,
      }));
    } catch (error) {
      setBssidError(String(error));
    } finally {
      setBssidLoading(false);
    }
  }, [activeTarget, sessionDetails]);

  useEffect(() => {
    if (!speedTesting) {
      return;
    }

    const countdown = window.setInterval(() => {
      setSpeedTestSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(countdown);
  }, [speedTesting]);

  // Check if using TCP fallback (not real ICMP)
  const isTcpFallback = currentMethod && currentMethod !== "Icmp";

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1 className="title">
          {viewMode === "settings" ? "PingZilla Next Settings" : "PingZilla Next"}
        </h1>
        {/* Hide settings button in dedicated settings window or dashboard */}
        {viewMode === "full" && (
          <button
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? "X" : "Settings"}
          </button>
        )}
      </div>

      {/* IP Info Bar */}
      {ipInfo && (
        <div className={`ip-info-bar ${networkAlert ? "alert" : ""}`}>
          {networkAlert && <span className="vpn-alert-icon" title="Network change detected!">⚠️</span>}
          <span className="ip-label">Your IP</span>
          <span className="ip-flag">{countryCodeToFlag(ipInfo.country_code)}</span>
          <span className="ip-address">{ipInfo.ip}</span>
          <span className="ip-country">{ipInfo.country}</span>
          <button
            className={`vpn-settings-btn ${vpnSettings.enabled ? "active" : ""}`}
            onClick={() => setShowVpnSettings(!showVpnSettings)}
            title="VPN Protection Settings"
          >
            🛡️
          </button>
          <button
            className="ip-refresh-btn"
            onClick={refreshIpInfo}
            disabled={ipLoading}
            title="Refresh IP info"
          >
            {ipLoading ? "..." : "↻"}
          </button>
        </div>
      )}

      {/* VPN Alert Banner */}
      {networkAlert && (
        <div className="vpn-alert-banner">
          <div className="alert-icon">🚨</div>
          <div className="alert-content">
            <div className="alert-title">VPN Connection May Have Dropped!</div>
            <div className="alert-details">
              {networkAlert.previous && (
                <>
                  {countryCodeToFlag(networkAlert.previous.country_code)} {networkAlert.previous.country}
                  {" → "}
                  {countryCodeToFlag(networkAlert.current.country_code)} {networkAlert.current.country}
                </>
              )}
            </div>
          </div>
          <button className="alert-dismiss" onClick={acknowledgeNetworkAlert}>
            Dismiss
          </button>
        </div>
      )}

      {/* VPN Settings Panel */}
      {showVpnSettings && (
        <div className="vpn-settings-panel">
          <div className="setting-row">
            <label>VPN Protection:</label>
            <button
              className={`toggle-btn ${vpnSettings.enabled ? "active" : ""}`}
              onClick={() => updateVpnSettings({ ...vpnSettings, enabled: !vpnSettings.enabled })}
            >
              {vpnSettings.enabled ? "On" : "Off"}
            </button>
          </div>
          <div className="setting-row">
            <label>Check interval:</label>
            <select
              className="display-mode-select"
              value={vpnSettings.check_interval_secs}
              onChange={(e) =>
                updateVpnSettings({ ...vpnSettings, check_interval_secs: parseInt(e.target.value) })
              }
            >
              <option value={15}>15 sec</option>
              <option value={30}>30 sec</option>
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
            </select>
          </div>
          <div className="setting-row">
            <label>Alert on country change:</label>
            <button
              className={`toggle-btn ${vpnSettings.alert_on_country_change ? "active" : ""}`}
              onClick={() =>
                updateVpnSettings({
                  ...vpnSettings,
                  alert_on_country_change: !vpnSettings.alert_on_country_change,
                })
              }
            >
              {vpnSettings.alert_on_country_change ? "On" : "Off"}
            </button>
          </div>
          <div className="setting-row">
            <label>Alert on IP change:</label>
            <button
              className={`toggle-btn ${vpnSettings.alert_on_ip_change ? "active" : ""}`}
              onClick={() =>
                updateVpnSettings({ ...vpnSettings, alert_on_ip_change: !vpnSettings.alert_on_ip_change })
              }
            >
              {vpnSettings.alert_on_ip_change ? "On" : "Off"}
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel - always visible in settings mode, toggleable in full mode */}
      {(viewMode === "settings" || (viewMode === "full" && showSettings)) && (
        <div className="settings-panel">
          <div className="setting-row">
            <label>Ping target:</label>
            <input
              type="text"
              value={activeTarget}
              onChange={(e) => {
                const newTarget = e.target.value;
                setActiveTarget(newTarget);
              }}
              onBlur={async () => {
                if (activeTarget.trim()) {
                  try {
                    if (!targets.includes(activeTarget)) {
                      await invoke("add_target", { target: activeTarget.trim() });
                      const updatedTargets = await invoke<string[]>("get_targets");
                      setTargets(updatedTargets);
                    }
                    await invoke("set_primary_target", { target: activeTarget.trim() });
                  } catch (e) {
                    console.error("Failed to update target:", e);
                  }
                }
              }}
              placeholder="IP or hostname"
            />
          </div>
          <div className="setting-row">
            <label>Menu bar:</label>
            <select
              className="display-mode-select"
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
            >
              <option value="icon_only">Icon only</option>
              <option value="icon_and_ping">Icon + Ping</option>
              <option value="ping_only">Ping only</option>
            </select>
          </div>
          <div className="setting-row">
            <label>Ping interval:</label>
            <select
              className="display-mode-select"
              value={pingInterval}
              onChange={(e) => setPingInterval(parseInt(e.target.value))}
            >
              <option value={5}>5 sec</option>
              <option value={10}>10 sec</option>
              <option value={15}>15 sec</option>
              <option value={30}>30 sec</option>
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
            </select>
          </div>
          <div className="setting-row">
            <label>Speed test length:</label>
            <input
              type="number"
              value={speedTestDuration}
              onChange={(event) =>
                setSpeedTestDuration(
                  Math.min(30, Math.max(3, Number(event.target.value) || 7)),
                )
              }
              min={3}
              max={30}
            />
            <span>sec</span>
          </div>
          <div className="setting-row">
            <label>Alert threshold:</label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 400)}
              min={50}
              max={1000}
            />
            <span>ms</span>
          </div>
          <div className="setting-row">
            <label>Launch at login:</label>
            <button
              className={`toggle-btn ${launchAtLogin ? "active" : ""}`}
              onClick={toggleLaunchAtLogin}
            >
              {launchAtLogin ? "On" : "Off"}
            </button>
          </div>
          <button className="save-btn" onClick={saveSettings}>
            Save
          </button>
        </div>
      )}

      {/* Main content - hidden in settings mode */}
      {viewMode !== "settings" && (
        <>
      {/* Current Ping Display */}
      <div className="current-ping">
        <div
          className="ping-value"
          style={{ color: getPingColor(currentPing) }}
        >
          <AnimatedNumber value={currentPing !== null ? Math.round(currentPing) : null} duration={400} />
          <span className="ping-unit">ms</span>
        </div>
        <div
          className="ping-status"
          style={{ color: getPingColor(currentPing) }}
        >
          {getPingStatus(currentPing)}
          {isTcpFallback && (
            <span className="tcp-badge" title="Using TCP connect instead of ICMP ping (sandbox mode)">
              TCP
            </span>
          )}
        </div>
      </div>

      {/* Statistics Row */}
      {statistics && (
        <div className="stats-row">
          <div className="stat">
            <span className="stat-label">Min</span>
            <span className="stat-value">
              {statistics.min_ms !== null ? `${Math.round(statistics.min_ms)}ms` : "---"}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg</span>
            <span className="stat-value">
              {statistics.avg_ms !== null ? `${Math.round(statistics.avg_ms)}ms` : "---"}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Max</span>
            <span className="stat-value">
              {statistics.max_ms !== null ? `${Math.round(statistics.max_ms)}ms` : "---"}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Loss</span>
            <span
              className="stat-value"
              style={{ color: statistics.packet_loss_pct > 0 ? "#ef4444" : "#22c55e" }}
            >
              {statistics.packet_loss_pct.toFixed(1)}%
            </span>
          </div>
          <select
            className="stats-period"
            value={statsPeriod}
            onChange={(e) => setStatsPeriod(parseInt(e.target.value))}
          >
            <option value={5}>5m</option>
            <option value={30}>30m</option>
            <option value={60}>1h</option>
            <option value={1440}>24h</option>
          </select>
        </div>
      )}

      {/* Ping Graph */}
      <div
        className="graph-container"
        onWheel={scrollHistory}
        title="Scroll horizontally, or hold Shift while scrolling, to browse history"
      >
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart
            data={chart.rows}
            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            onClick={(state) => {
              const activeTimestamp = Number(state.activeLabel);
              if (!Number.isFinite(activeTimestamp) || chart.rows.length === 0) {
                return;
              }

              const nearestRow = chart.rows.reduce((nearest, row) =>
                Math.abs(row.timestamp - activeTimestamp) <
                Math.abs(nearest.timestamp - activeTimestamp)
                  ? row
                  : nearest,
              );
              setSelectedPing(nearestRow.ping);
            }}
          >
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={[chart.axisStart, chart.axisEnd]}
              allowDataOverflow
              tick={{ fontSize: 10, fill: "#888" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: "#333" }}
              tickFormatter={(timestamp) =>
                new Date(timestamp).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              }
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#888" }}
              tickLine={false}
              axisLine={{ stroke: "#333" }}
              domain={[0, "auto"]}
            />
            <ReferenceLine
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            {selectedPing && (
              <ReferenceLine
                x={new Date(selectedPing.timestamp).getTime()}
                stroke="#f8fafc"
                strokeDasharray="2 3"
                strokeOpacity={0.65}
              />
            )}
            <Tooltip content={() => null} cursor={{ stroke: "#64748b" }} />
            {chart.segments.map((segment) => (
              <Line
                key={segment.key}
                type="monotone"
                dataKey={segment.key}
                stroke={segment.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {chart.markers.map((marker) => (
              <ReferenceDot
                key={marker.speedTest.id}
                x={marker.timestamp}
                y={marker.markerLatency}
                r={5}
                fill="#f8fafc"
                stroke="#111827"
                strokeWidth={1}
                onClick={() => setSelectedPing(marker.ping)}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="history-actions">
        <span>
          {chart.rows.length > 0
            ? `${chart.rows.length} plotted samples`
            : "No samples in this range"}
        </span>
        {historyViewportEnd !== null && (
          <button
            className="back-to-live-btn"
            onClick={() => setHistoryViewportEnd(null)}
          >
            Back to live
          </button>
        )}
        <button
          className="speed-test-btn"
          onClick={runSpeedTest}
          disabled={speedTesting}
          title="Uses meaningful data and may briefly load your connection"
        >
          {speedTesting
            ? `Testing connection… (${speedTestSecondsRemaining}s)`
            : "Run speed test"}
        </button>
      </div>
      {speedTestError && <div className="speed-test-error">{speedTestError}</div>}

      {selectedPing && (
        <div className="point-details">
          <div className="point-details-content">
          <div className="point-details-time">
            {new Date(selectedPing.timestamp).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "medium",
            })}
          </div>
          <div className="point-details-network-row">
            <div className="point-details-network">
              {sessionDetails?.session.label ||
                sessionDetails?.session.isp ||
                "Unknown connection"}
            </div>
            {sessionDetails && !editingNetworkName && (
              <button
                className="network-edit-btn"
                onClick={() => setEditingNetworkName(true)}
                aria-label="Rename network"
                title="Rename network"
              >
                ✎
              </button>
            )}
          </div>
          {sessionDetails && editingNetworkName && (
            <div className="network-name-editor">
              <input
                value={networkName}
                onChange={(event) => setNetworkName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") renameSelectedNetwork();
                  if (event.key === "Escape") {
                    setNetworkName(sessionDetails.session.label || "");
                    setEditingNetworkName(false);
                  }
                }}
                placeholder="Name this network"
                maxLength={80}
                autoFocus
              />
              <button
                className="network-name-cancel"
                onClick={() => {
                  setNetworkName(sessionDetails.session.label || "");
                  setEditingNetworkName(false);
                }}
              >
                Cancel
              </button>
              <button onClick={renameSelectedNetwork}>Save name</button>
            </div>
          )}
          <div className="point-details-grid">
            <span>Ping</span>
            <strong>
              {selectedPing.latency_ms === null
                ? "Timeout"
                : `${Math.round(selectedPing.latency_ms)} ms`}
            </strong>
            <span>BSSID</span>
            <strong>
              {sessionDetails?.session.bssid ||
                (sessionDetails && !sessionDetails.session.ended_at ? (
                  <button
                    className="bssid-reveal-btn"
                    onClick={revealBssid}
                    disabled={bssidLoading}
                    title="macOS requires Location Services access to reveal Wi-Fi identifiers"
                  >
                    {bssidLoading ? "Waiting for permission…" : "Show BSSID"}
                  </button>
                ) : "—")}
            </strong>
            <span>Session duration</span>
            <strong>
              {sessionDetails
                ? `${Math.max(
                    0,
                    Math.round(
                      (new Date(
                        sessionDetails.session.ended_at || Date.now(),
                      ).getTime() -
                        new Date(sessionDetails.session.started_at).getTime()) /
                        60000,
                    ),
                  )} min`
                : "—"}
            </strong>
            <span>Session median</span>
            <strong>
              {sessionDetails?.median_ms != null
                ? `${Math.round(sessionDetails.median_ms)} ms`
                : "—"}
            </strong>
            <span>Session average</span>
            <strong>
              {sessionDetails?.average_ms != null
                ? `${Math.round(sessionDetails.average_ms)} ms`
                : "—"}
            </strong>
            <span>95th percentile</span>
            <strong>
              {sessionDetails?.p95_ms != null
                ? `${Math.round(sessionDetails.p95_ms)} ms`
                : "—"}
            </strong>
            <span>Packet loss</span>
            <strong>
              {sessionDetails
                ? `${sessionDetails.packet_loss_pct.toFixed(1)}%`
                : "—"}
            </strong>
          </div>
          {bssidError && <div className="bssid-error">{bssidError}</div>}
          {sessionDetails?.latest_speed_test && (
            <div className="speed-test-result">
              <div>
                Speed test at{" "}
                {new Date(
                  sessionDetails.latest_speed_test.timestamp,
                ).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <strong>
                ↓ {Math.round(sessionDetails.latest_speed_test.download_mbps)} Mbps
                {"  "}↑ {Math.round(sessionDetails.latest_speed_test.upload_mbps)} Mbps
              </strong>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Site Monitors Section */}
      <div className="site-monitors-section">
        <div className="section-header">
          <span className="section-title">Site Monitors</span>
          <button
            className="site-add-btn"
            onClick={() => setShowAddSite(!showAddSite)}
            disabled={siteMonitors.length >= 10}
            title={siteMonitors.length >= 10 ? "Max 10 sites" : "Add site"}
          >
            {showAddSite ? "×" : "+"}
          </button>
        </div>

        {/* Add Site Panel */}
        {showAddSite && (
          <div className="add-site-panel">
            <input
              type="text"
              value={newSiteUrl}
              onChange={(e) => setNewSiteUrl(e.target.value)}
              placeholder="URL (e.g., https://example.com)"
              onKeyDown={(e) => e.key === "Enter" && addSiteMonitor()}
              autoFocus
            />
            <input
              type="text"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              placeholder="Name (optional)"
              onKeyDown={(e) => e.key === "Enter" && addSiteMonitor()}
            />
            <div className="add-site-buttons">
              <button className="cancel-btn" onClick={() => setShowAddSite(false)}>
                Cancel
              </button>
              <button className="save-btn" onClick={addSiteMonitor}>
                Add
              </button>
            </div>
          </div>
        )}

        {/* Site List */}
        {siteMonitors.length > 0 ? (
          <div className="site-list">
            {siteMonitors.map((site) => {
              const status = siteStatuses[site.url];
              const isUp = status?.is_up ?? true;
              return (
                <div key={site.url} className={`site-item ${isUp ? "up" : "down"}`}>
                  <span className={`status-dot ${isUp ? "up" : "down"}`} />
                  <span className="site-name" title={site.url}>
                    {site.name || site.url}
                  </span>
                  <span className="site-latency">
                    {status?.latency_ms != null ? `${Math.round(status.latency_ms)}ms` : "---"}
                  </span>
                  <button
                    className="site-remove-btn"
                    onClick={() => removeSiteMonitor(site.url)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="site-empty">No sites monitored</div>
        )}
      </div>
        </>
      )}

      {/* Footer */}
      <div className="footer">
        <span className="footer-text">
          {viewMode === "settings" ? `PingZilla Next v${appVersion}` : `Last 2 minutes · v${appVersion}`}
        </span>
      </div>
    </div>
  );
}

export default App;
