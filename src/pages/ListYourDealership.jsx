import React, { useState, useEffect } from "react";
import Header from "../components/DashboardHeader";
import "../styles/index.css";
import { jwtDecode } from "jwt-decode";

function ListYourDealership() {
  const [dealershipName, setDealershipName] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const [subStatus, setSubStatus] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  const token = localStorage.getItem("token");
  let email = "";

  if (token) {
    try {
      email = jwtDecode(token).email?.toLowerCase() || "";
    } catch {}
  }

  /* ---------------- SUB STATUS ---------------- */
  useEffect(() => {
    if (!email) {
      setLoadingSubscription(false);
      return;
    }

    const fetchSub = async () => {
      try {
        const res = await fetch(
          `/api/stripe/dealer-status?email=${encodeURIComponent(email)}`
        );
        const data = await res.json();
        if (res.ok) setSubStatus(data);
      } catch (err) {
        console.error("❌ Failed to fetch subscription:", err);
      } finally {
        setLoadingSubscription(false);
      }
    };

    fetchSub();
  }, [email]);

  const subscriptionActive = subStatus?.status === "active";

  /* ---------------- IMAGES ---------------- */
  const handleImageChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  const uploadImagesToS3 = async () => {
    const uploadedUrls = [];

    for (const file of images) {
      try {
        const fileName = encodeURIComponent(file.name);
        const fileType = encodeURIComponent(file.type);

        const res = await fetch(
          `/api/s3/upload-url?fileName=${fileName}&fileType=${fileType}`
        );
        if (!res.ok) continue;

        const { uploadUrl } = await res.json();

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) continue;

        uploadedUrls.push(uploadUrl.split("?")[0]);
      } catch (err) {
        console.error("❌ Error uploading image:", err);
      }
    }

    return uploadedUrls;
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!subscriptionActive) {
      setStatus("❌ You must activate a dealership subscription before listing.");
      return;
    }

    setUploading(true);
    setStatus("Submitting dealership...");

    try {
      const uploadedUrls =
        images.length > 0 ? await uploadImagesToS3() : [];

      const res = await fetch(`/api/dealers/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dealershipName,
          address,
          zipCode,
          contactEmail: (contactEmail || email).toLowerCase(),
          images: uploadedUrls,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Dealership listed successfully!");
        setDealershipName("");
        setAddress("");
        setZipCode("");
        setContactEmail("");
        setImages([]);
      } else {
        setStatus(`❌ ${data.error || "Failed to list dealership"}`);
      }
    } catch (err) {
      console.error("❌ Error submitting dealership:", err);
      setStatus("❌ Error submitting dealership.");
    } finally {
      setUploading(false);
    }
  };

  /* ---------------- LOADING ---------------- */
  if (loadingSubscription) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="dashboard-main text-center mt-20">
          <p>Checking subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Header />

      {/* BTC PARTICLES + GRID (reuse global styles) */}
      <div className="btc-particles"></div>
      <div className="dashboard-grid-overlay"></div>

      <div className="dashboard-main">
        <div className="glass-card max-w-2xl mx-auto p-8">

          <h1 className="text-3xl font-semibold text-center mb-6">
            List Your Dealership
          </h1>

          {/* ❌ SUB REQUIRED */}
          {!subscriptionActive && (
            <div className="glass-card p-5 mb-6 text-center border border-red-500/30">
              <p className="text-red-400 font-semibold text-lg">
                Dealership Subscription Required
              </p>

              <p className="mt-2 text-sm opacity-80">
                Activate a subscription to list your dealership.
              </p>

              <button
                onClick={() =>
                  (window.location.href = "/subscribe?for=dealership")
                }
                className="glass-btn mt-4"
              >
                Activate Subscription
              </button>
            </div>
          )}

          {/* ✅ FORM */}
          {subscriptionActive && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              <div>
                <label className="form-label">Dealership Name</label>
                <input
                  type="text"
                  value={dealershipName}
                  onChange={(e) => setDealershipName(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">ZIP Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  required
                  placeholder="e.g. 27609"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Contact Email (optional)</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={`Defaults to ${email}`}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Upload Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="form-input file-input"
                />
              </div>

              {images.length > 0 && (
                <div className="flex gap-3 flex-wrap mt-2">
                  {images.map((file, idx) => (
                    <img
                      key={idx}
                      src={URL.createObjectURL(file)}
                      alt="preview"
                      className="w-24 h-24 object-cover rounded-xl border border-white/10"
                    />
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="glass-btn mt-4"
              >
                {uploading ? "Submitting..." : "Submit Dealership"}
              </button>

              {status && (
                <p className="text-center mt-2 opacity-80">{status}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListYourDealership;