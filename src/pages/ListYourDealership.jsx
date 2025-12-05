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


  /* ---------------------------------------------------------
   * FETCH DEALERSHIP SUBSCRIPTION STATUS
   * --------------------------------------------------------- */
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

  // Backend already determines if dealer subscription is active
  const subscriptionActive = subStatus?.status === "active";

  /* ---------------------------------------------------------
   * Handle image selection
   * --------------------------------------------------------- */
  const handleImageChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  /* ---------------------------------------------------------
   * Upload images to S3
   * --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
   * Submit Dealership
   * --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
   * Display: Loading subscription
   * --------------------------------------------------------- */
  if (loadingSubscription) {
    return (
      <div>
        <Header />
        <p className="text-center mt-10">Checking subscription...</p>
      </div>
    );
  }

  return (
    <div className="list-dealership-page">
      <Header />

      <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-semibold mb-4 text-center">
          List Your Dealership
        </h1>

        {/* SUBSCRIPTION INACTIVE WARNING */}
        {!subscriptionActive && (
          <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6 text-center">
            <p className="font-bold">❗ Dealership Subscription Required</p>
            <p className="mt-2">
              You must activate a subscription before you can list a dealership.
            </p>
            <button
              onClick={() =>
                (window.location.href = "/subscribe?for=dealership")
              }
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Activate Subscription
            </button>
          </div>
        )}

        {/* DEALERSHIP FORM */}
        {subscriptionActive && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label>Dealership Name</label>
            <input
              type="text"
              value={dealershipName}
              onChange={(e) => setDealershipName(e.target.value)}
              required
              className="border rounded px-3 py-2"
            />

            <label>Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="border rounded px-3 py-2"
            />

            <label>ZIP Code</label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              required
              placeholder="e.g. 27609"
              className="border rounded px-3 py-2"
            />

            <label>Contact Email (optional)</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={`Defaults to ${email}`}
              className="border rounded px-3 py-2"
            />

            <label>Upload Dealership Images</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="border rounded px-3 py-2"
            />

            {images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {images.map((file, idx) => (
                  <img
                    key={idx}
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    className="w-24 h-24 object-cover rounded-md border"
                  />
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600"
            >
              {uploading ? "Submitting..." : "Submit Dealership"}
            </button>

            {status && <p className="text-center mt-2">{status}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default ListYourDealership;
