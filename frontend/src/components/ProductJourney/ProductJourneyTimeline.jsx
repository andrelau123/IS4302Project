import React from "react";
import {
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineEnvironment,
  AiOutlineShop,
  AiOutlineUser,
  AiOutlineTruck,
} from "react-icons/ai";
import { MdVerified, MdWarning } from "react-icons/md";
import { FaIndustry } from "react-icons/fa";

const PRODUCT_STATUS = {
  0: "Registered",
  1: "InTransit",
  2: "AtRetailer",
  3: "Sold",
  4: "Disputed",
};

const STATUS_COLORS = {
  0: "bg-blue-100 text-blue-800 border-blue-300",
  1: "bg-yellow-100 text-yellow-800 border-yellow-300",
  2: "bg-purple-100 text-purple-800 border-purple-300",
  3: "bg-green-100 text-green-800 border-green-300",
  4: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_ICONS = {
  0: <FaIndustry className="text-blue-600" size={20} />,
  1: <AiOutlineTruck className="text-yellow-600" size={20} />,
  2: <AiOutlineShop className="text-purple-600" size={20} />,
  3: <AiOutlineUser className="text-green-600" size={20} />,
  4: <MdWarning className="text-red-600" size={20} />,
};

const ProductJourneyTimeline = ({
  product,
  transferHistory = [],
  verifications = [],
  oracleData = [],
}) => {
  // Combine all events and sort by timestamp
  const allEvents = [
    {
      type: "registration",
      timestamp: product.registeredAt,
      title: "Product Registered",
      description: "Product created and registered on blockchain",
      actor: product.manufacturer,
      status: 0,
      icon: <FaIndustry size={20} />,
      color: "blue",
    },
    ...transferHistory.map((transfer, idx) => ({
      type: "transfer",
      timestamp: transfer.timestamp || Date.now(),
      title: `Transfer #${idx + 1}`,
      description: `Transferred from ${transfer.from?.slice(
        0,
        10
      )}... to ${transfer.to?.slice(0, 10)}...`,
      actor: transfer.from,
      recipient: transfer.to,
      location: transfer.location || "Unknown",
      verificationHash: transfer.verificationHash,
      status: idx === 0 ? 1 : idx === transferHistory.length - 1 ? 2 : 1,
      icon: <AiOutlineTruck size={20} />,
      color: "yellow",
    })),
    ...verifications.map((verification, idx) => ({
      type: "verification",
      timestamp: verification.timestamp || Date.now(),
      title: verification.status === "failed" ? "Verification Failed" : "Product Verified",
      description: verification.result || "Authenticity confirmed by verification node",
      actor: verification.verifier || "Verification Node",
      fee: verification.fee,
      status: verification.status === "failed" ? "failed" : "verified",
      icon: verification.status === "failed" ? <MdWarning size={20} /> : <MdVerified size={20} />,
      color: verification.status === "failed" ? "red" : "green",
    })),
  ].sort((a, b) => {
    const timeA =
      typeof a.timestamp === "number"
        ? a.timestamp
        : new Date(a.timestamp).getTime();
    const timeB =
      typeof b.timestamp === "number"
        ? b.timestamp
        : new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

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

  const formatAddress = (address) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Product Journey
        </h2>
        <p className="text-gray-600">
          Complete supply chain history from manufacturing to present
        </p>
      </div>

      {/* Current Status Badge */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">
          Current Status:
        </span>
        <div
          className={`px-4 py-2 rounded-full border-2 flex items-center gap-2 ${
            STATUS_COLORS[product.status] ||
            "bg-gray-100 text-gray-800 border-gray-300"
          }`}
        >
          {STATUS_ICONS[product.status]}
          <span className="font-semibold">
            {PRODUCT_STATUS[product.status] || "Unknown"}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Events */}
        <div className="space-y-8">
          {allEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No journey events recorded yet</p>
            </div>
          ) : (
            allEvents.map((event, index) => (
              <div key={index} className="relative flex gap-6">
                {/* Icon Circle */}
                <div
                  className={`relative z-10 flex-shrink-0 w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${
                    event.color === "blue"
                      ? "bg-blue-500 text-white"
                      : event.color === "yellow"
                      ? "bg-yellow-500 text-white"
                      : event.color === "purple"
                      ? "bg-purple-500 text-white"
                      : event.color === "green"
                      ? "bg-green-500 text-white"
                      : event.color === "red"
                      ? "bg-red-500 text-white"
                      : "bg-gray-500 text-white"
                  }`}
                >
                  {event.icon}
                </div>

                {/* Event Card */}
                <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {event.title}
                      </h3>
                      {event.status === "failed" && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                          FAILED
                        </span>
                      )}
                      {event.status === "verified" && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      <AiOutlineClockCircle className="inline mr-1" />
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>

                  <p className={`mb-3 ${event.status === "failed" ? "text-red-700 font-medium" : "text-gray-700"}`}>
                    {event.description}
                  </p>

                  {/* Event Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {event.actor && (
                      <div className="flex items-center gap-2">
                        <AiOutlineUser className="text-gray-400" />
                        <span className="text-gray-600">
                          From:{" "}
                          <span className="font-mono text-gray-800">
                            {formatAddress(event.actor)}
                          </span>
                        </span>
                      </div>
                    )}

                    {event.recipient && (
                      <div className="flex items-center gap-2">
                        <AiOutlineUser className="text-gray-400" />
                        <span className="text-gray-600">
                          To:{" "}
                          <span className="font-mono text-gray-800">
                            {formatAddress(event.recipient)}
                          </span>
                        </span>
                      </div>
                    )}

                    {event.location && (
                      <div className="flex items-center gap-2">
                        <AiOutlineEnvironment className="text-gray-400" />
                        <span className="text-gray-600">
                          Location:{" "}
                          <span className="font-medium text-gray-800">
                            {event.location}
                          </span>
                        </span>
                      </div>
                    )}

                    {event.verificationHash &&
                      event.verificationHash !==
                        "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                        <div className="flex items-center gap-2">
                          <MdVerified className="text-green-500" />
                          <span className="text-gray-600">
                            Hash:{" "}
                            <span className="font-mono text-xs text-gray-800">
                              {formatAddress(event.verificationHash)}
                            </span>
                          </span>
                        </div>
                      )}

                    {event.fee && (
                      <div className="flex items-center gap-2">
                        <AiOutlineCheckCircle className="text-gray-400" />
                        <span className="text-gray-600">
                          Fee:{" "}
                          <span className="font-medium text-gray-800">
                            {event.fee} ETH
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Verification Badge */}
                  {event.type === "verification" && (
                    <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                      event.status === "failed" 
                        ? "bg-red-100 text-red-800" 
                        : "bg-green-100 text-green-800"
                    }`}>
                      {event.status === "failed" ? <MdWarning /> : <MdVerified />}
                      {event.status === "failed" ? "Verification Failed" : "Verified Authentic"}
                    </div>
                  )}

                  {/* Status Badge for transfers */}
                  {event.type === "transfer" && event.status !== undefined && (
                    <div
                      className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[event.status]
                      }`}
                    >
                      {STATUS_ICONS[event.status]}
                      {PRODUCT_STATUS[event.status]}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {transferHistory.length}
            </div>
            <div className="text-sm text-gray-600">Transfers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {verifications.length}
            </div>
            <div className="text-sm text-gray-600">Verifications</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.floor(
                (Date.now() -
                  (typeof product.registeredAt === "number"
                    ? product.registeredAt
                    : new Date(product.registeredAt).getTime())) /
                  (1000 * 60 * 60 * 24)
              )}
            </div>
            <div className="text-sm text-gray-600">Days Old</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {allEvents.length}
            </div>
            <div className="text-sm text-gray-600">Total Events</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductJourneyTimeline;
