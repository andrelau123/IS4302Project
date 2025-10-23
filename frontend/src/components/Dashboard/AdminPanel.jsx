import React, { useState } from "react";
import { useFeeDistributor } from "../../hooks/useFeeDistributor";
import { isValidAddress } from "../../utils/formatters";
import "./AdminPanel.css";

const AdminPanel = ({
  isAdmin = false,
  isDistributor = false,
  distributionShares = { verifier: 0, brand: 0, treasury: 0 },
  onDataUpdate = () => {},
}) => {
  const { distributeRevenue, updateShares } = useFeeDistributor();

  // Distribution form state
  const [distributionForm, setDistributionForm] = useState({
    verifierAddress: "",
    brandAddress: "",
    amount: "",
  });

  // Shares form state
  const [sharesForm, setSharesForm] = useState({
    verifier: distributionShares?.verifier || 0,
    brand: distributionShares?.brand || 0,
    treasury: distributionShares?.treasury || 0,
  });

  const [loading, setLoading] = useState(false);

  // Update shares form when props change
  React.useEffect(() => {
    // Guard against distributionShares being undefined or missing fields
    const safeShares = {
      verifier: distributionShares?.verifier ?? 0,
      brand: distributionShares?.brand ?? 0,
      treasury: distributionShares?.treasury ?? 0,
    };

    setSharesForm(safeShares);
  }, [distributionShares]);

  const handleDistributionSubmit = async (e) => {
    e.preventDefault();

    if (!isValidAddress(distributionForm.verifierAddress)) {
      alert("Invalid verifier address");
      return;
    }

    if (!isValidAddress(distributionForm.brandAddress)) {
      alert("Invalid brand address");
      return;
    }

    if (!distributionForm.amount || parseFloat(distributionForm.amount) <= 0) {
      alert("Invalid amount");
      return;
    }

    try {
      setLoading(true);
      await distributeRevenue(
        distributionForm.verifierAddress,
        distributionForm.brandAddress,
        distributionForm.amount
      );

      // Reset form
      setDistributionForm({
        verifierAddress: "",
        brandAddress: "",
        amount: "",
      });

      alert("Revenue distributed successfully!");
      onDataUpdate();
    } catch (err) {
      alert(`Error distributing revenue: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSharesSubmit = async (e) => {
    e.preventDefault();

    const total =
      parseInt(sharesForm.verifier) +
      parseInt(sharesForm.brand) +
      parseInt(sharesForm.treasury);

    if (total !== 10000) {
      alert("Shares must sum to 10000 (100%)");
      return;
    }

    try {
      setLoading(true);
      await updateShares(
        parseInt(sharesForm.verifier),
        parseInt(sharesForm.brand),
        parseInt(sharesForm.treasury)
      );

      alert("Distribution shares updated successfully!");
      onDataUpdate();
    } catch (err) {
      alert(`Error updating shares: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="card">
        <h3>Admin Panel</h3>
        <p className="panel-description">
          {isAdmin && "You have admin privileges. "}
          {isDistributor && "You have distributor privileges."}
        </p>

        <div className="admin-sections">
          {/* Revenue Distribution Section */}
          {isDistributor && (
            <div className="admin-section">
              <h4>Distribute Revenue</h4>
              <form onSubmit={handleDistributionSubmit} className="admin-form">
                <div className="input-group">
                  <label>Verifier Address</label>
                  <input
                    type="text"
                    value={distributionForm.verifierAddress}
                    onChange={(e) =>
                      setDistributionForm((prev) => ({
                        ...prev,
                        verifierAddress: e.target.value,
                      }))
                    }
                    placeholder="0x..."
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Brand Address</label>
                  <input
                    type="text"
                    value={distributionForm.brandAddress}
                    onChange={(e) =>
                      setDistributionForm((prev) => ({
                        ...prev,
                        brandAddress: e.target.value,
                      }))
                    }
                    placeholder="0x..."
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={distributionForm.amount}
                    onChange={(e) =>
                      setDistributionForm((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="0.0"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Distributing..." : "Distribute Revenue"}
                </button>
              </form>
            </div>
          )}

          {/* Shares Management Section */}
          {isAdmin && (
            <div className="admin-section">
              <h4>Update Distribution Shares</h4>
              <form onSubmit={handleSharesSubmit} className="admin-form">
                <div className="shares-inputs">
                  <div className="input-group">
                    <label>Verifier Share (bps)</label>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={sharesForm.verifier}
                      onChange={(e) =>
                        setSharesForm((prev) => ({
                          ...prev,
                          verifier: parseInt(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                    <small>{(sharesForm.verifier / 100).toFixed(2)}%</small>
                  </div>

                  <div className="input-group">
                    <label>Brand Share (bps)</label>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={sharesForm.brand}
                      onChange={(e) =>
                        setSharesForm((prev) => ({
                          ...prev,
                          brand: parseInt(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                    <small>{(sharesForm.brand / 100).toFixed(2)}%</small>
                  </div>

                  <div className="input-group">
                    <label>Treasury Share (bps)</label>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={sharesForm.treasury}
                      onChange={(e) =>
                        setSharesForm((prev) => ({
                          ...prev,
                          treasury: parseInt(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                    <small>{(sharesForm.treasury / 100).toFixed(2)}%</small>
                  </div>
                </div>

                <div className="shares-total">
                  Total:{" "}
                  {sharesForm.verifier + sharesForm.brand + sharesForm.treasury}{" "}
                  bps (
                  {(
                    (sharesForm.verifier +
                      sharesForm.brand +
                      sharesForm.treasury) /
                    100
                  ).toFixed(2)}
                  %)
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    loading ||
                    sharesForm.verifier +
                      sharesForm.brand +
                      sharesForm.treasury !==
                      10000
                  }
                >
                  {loading ? "Updating..." : "Update Shares"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
