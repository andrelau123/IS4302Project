import React from "react";
import {
  AiOutlineWarning,
  AiOutlineCheckCircle,
  AiOutlineEnvironment,
} from "react-icons/ai";
import { WiThermometer, WiHumidity } from "react-icons/wi";
import { MdGpsFixed, MdSignalCellularAlt } from "react-icons/md";
import { FaBolt } from "react-icons/fa";

const IoTSensorDashboard = ({ sensorData = [], productId }) => {
  // Process sensor data
  const latestData =
    sensorData.length > 0 ? sensorData[sensorData.length - 1] : null;

  // Define thresholds
  const THRESHOLDS = {
    temperature: { min: 0, max: 30, unit: "°C" },
    humidity: { min: 20, max: 80, unit: "%" },
    shock: { max: 5, unit: "G" },
  };

  const checkThreshold = (value, threshold) => {
    if (!value || value === "N/A") return "normal";
    const numValue = parseFloat(value);
    if (threshold.min !== undefined && numValue < threshold.min)
      return "warning";
    if (threshold.max !== undefined && numValue > threshold.max)
      return "warning";
    return "normal";
  };

  const formatValue = (value, unit) => {
    if (!value || value === "N/A") return "N/A";
    return `${parseFloat(value).toFixed(1)}${unit}`;
  };

  // Mock data if no sensor data provided
  const displayData = latestData || {
    temperature: "22.5",
    humidity: "45",
    shock: "0.2",
    gps: { lat: "1.3521", lng: "103.8198" },
    timestamp: Date.now(),
    signalStrength: 85,
  };

  const metrics = [
    {
      id: "temperature",
      label: "Temperature",
      value: displayData.temperature,
      icon: <WiThermometer size={32} />,
      color:
        checkThreshold(displayData.temperature, THRESHOLDS.temperature) ===
        "normal"
          ? "blue"
          : "red",
      threshold: THRESHOLDS.temperature,
      unit: THRESHOLDS.temperature.unit,
    },
    {
      id: "humidity",
      label: "Humidity",
      value: displayData.humidity,
      icon: <WiHumidity size={32} />,
      color:
        checkThreshold(displayData.humidity, THRESHOLDS.humidity) === "normal"
          ? "green"
          : "red",
      threshold: THRESHOLDS.humidity,
      unit: THRESHOLDS.humidity.unit,
    },
    {
      id: "shock",
      label: "Shock Impact",
      value: displayData.shock,
      icon: <FaBolt size={24} />,
      color:
        checkThreshold(displayData.shock, THRESHOLDS.shock) === "normal"
          ? "purple"
          : "red",
      threshold: THRESHOLDS.shock,
      unit: THRESHOLDS.shock.unit,
    },
    {
      id: "signal",
      label: "Signal Strength",
      value: displayData.signalStrength,
      icon: <MdSignalCellularAlt size={24} />,
      color: "indigo",
      unit: "%",
    },
  ];

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date =
      typeof timestamp === "number"
        ? new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000)
        : new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const hasViolations = metrics.some(
    (metric) =>
      metric.threshold &&
      checkThreshold(metric.value, metric.threshold) === "warning"
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          IoT Sensor Monitoring
        </h2>
        <p className="text-gray-600">
          Real-time environmental conditions during transit
        </p>
      </div>

      {/* Status Alert */}
      {hasViolations ? (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AiOutlineWarning className="text-red-600 text-2xl flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">
                Threshold Violations Detected
              </h3>
              <p className="text-sm text-red-700">
                One or more environmental parameters are outside acceptable
                ranges. This may affect product quality.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AiOutlineCheckCircle className="text-green-600 text-2xl flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">
                Conditions Normal
              </h3>
              <p className="text-sm text-green-700">
                All environmental parameters are within acceptable ranges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sensor Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => {
          const status = metric.threshold
            ? checkThreshold(metric.value, metric.threshold)
            : "normal";
          const isWarning = status === "warning";

          return (
            <div
              key={metric.id}
              className={`p-4 rounded-lg border-2 ${
                isWarning
                  ? "bg-red-50 border-red-300"
                  : `bg-${metric.color}-50 border-${metric.color}-200`
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`${
                    isWarning ? "text-red-600" : `text-${metric.color}-600`
                  }`}
                >
                  {metric.icon}
                </span>
                {isWarning && <AiOutlineWarning className="text-red-600" />}
              </div>
              <div
                className={`text-2xl font-bold mb-1 ${
                  isWarning ? "text-red-900" : `text-${metric.color}-900`
                }`}
              >
                {formatValue(metric.value, metric.unit)}
              </div>
              <div
                className={`text-sm ${
                  isWarning ? "text-red-700" : `text-${metric.color}-700`
                }`}
              >
                {metric.label}
              </div>
              {metric.threshold && (
                <div className="text-xs text-gray-500 mt-2">
                  Range:{" "}
                  {metric.threshold.min !== undefined
                    ? `${metric.threshold.min}-`
                    : "≤"}
                  {metric.threshold.max}
                  {metric.unit}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* GPS Location */}
      {displayData.gps && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <MdGpsFixed className="text-blue-600 text-xl" />
            <h3 className="font-semibold text-gray-900">GPS Location</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Latitude:</span>
              <p className="font-mono text-gray-900">{displayData.gps.lat}°</p>
            </div>
            <div>
              <span className="text-gray-600">Longitude:</span>
              <p className="font-mono text-gray-900">{displayData.gps.lng}°</p>
            </div>
          </div>
          <div className="mt-3">
            <a
              href={`https://www.google.com/maps?q=${displayData.gps.lat},${displayData.gps.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
            >
              <AiOutlineEnvironment />
              View on Google Maps →
            </a>
          </div>
        </div>
      )}

      {/* Historical Data Timeline */}
      {sensorData.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">
            Historical Readings
          </h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {sensorData
              .slice()
              .reverse()
              .map((reading, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded border border-gray-200 text-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-gray-900">
                      Reading #{sensorData.length - index}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(reading.timestamp)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-600">Temp:</span>{" "}
                      <span className="font-mono text-gray-900">
                        {formatValue(reading.temperature, "°C")}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Humidity:</span>{" "}
                      <span className="font-mono text-gray-900">
                        {formatValue(reading.humidity, "%")}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Shock:</span>{" "}
                      <span className="font-mono text-gray-900">
                        {formatValue(reading.shock, "G")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Last Update */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
        Last updated: {formatTimestamp(displayData.timestamp)}
      </div>
    </div>
  );
};

export default IoTSensorDashboard;
