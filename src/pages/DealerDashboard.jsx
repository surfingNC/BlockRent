import React, { useEffect, useState, useCallback } from 'react';
import Header from '../components/DashboardHeader';
import '../styles/index.css';
import { jwtDecode } from 'jwt-decode';

function DealerDashboard() {
  const [dealer, setDealer] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [currentImage, setCurrentImage] = useState(0);

  const token = localStorage.getItem('token');
  let email = '';

  if (token) {
    try {
      const decoded = jwtDecode(token);
      email = decoded.email?.toLowerCase() || '';
    } catch (err) {
      console.error('❌ Invalid token:', err);
    }
  }

  const API = 'http://localhost:5000';

  /* ---------------- FETCH ---------------- */
  const fetchDealer = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/dealers/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data?.length > 0) {
        setDealer(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch dealer:', err);
    }
  }, [token]);

  const fetchSubscription = useCallback(async () => {
    if (!email) return;

    try {
      const res = await fetch(
        `${API}/api/stripe/dealer-status?email=${encodeURIComponent(email)}`
      );
      const data = await res.json();

      if (res.ok) setSubStatus(data);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    }
  }, [email]);

  useEffect(() => {
    fetchDealer();
    fetchSubscription();
  }, [fetchDealer, fetchSubscription]);

  const subscriptionActive = subStatus?.status === 'active';

  /* ---------------- BLOCK ACCESS ---------------- */
  if (subStatus && !subscriptionActive) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="dashboard-main">
          <div className="glass-card text-center p-8 max-w-xl mx-auto">
            <h2 className="text-2xl font-semibold text-red-400">
              Dealership Subscription Required
            </h2>
            <p className="mt-3 opacity-80">
              Activate your subscription to access your dealer dashboard.
            </p>
            <button
              onClick={() =>
                (window.location.href = '/subscribe?for=dealership')
              }
              className="glass-btn mt-5"
            >
              Subscribe Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- IMAGE HANDLING ---------------- */
  const handleImageChange = (e) => {
    setImages(Array.from(e.target.files));
    setCurrentImage(0);
  };

  const uploadImagesToS3 = async () => {
    const uploaded = [];

    for (const file of images) {
      try {
        const fileName = encodeURIComponent(file.name);
        const fileType = encodeURIComponent(file.type);

        const presignRes = await fetch(
          `${API}/api/s3/upload-url?fileName=${fileName}&fileType=${fileType}`
        );

        if (!presignRes.ok) continue;

        const { uploadUrl } = await presignRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (uploadRes.ok) {
          uploaded.push(uploadUrl.split('?')[0]);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    return uploaded;
  };

  /* ---------------- UPDATE ---------------- */
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!dealer?._id) return;

    setUploading(true);
    setStatusMsg('Saving changes...');

    try {
      let newImageUrls = dealer.images || [];

      if (images.length > 0) {
        newImageUrls = await uploadImagesToS3();
      }

      const res = await fetch(`${API}/api/dealers/${dealer._id}/update`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: newImageUrls,
          acceptingApplications: dealer.acceptingApplications,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setDealer(data);
        setImages([]);
        setStatusMsg('✅ Updated successfully!');
      } else {
        setStatusMsg(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('❌ Error saving changes.');
    } finally {
      setUploading(false);
    }
  };

  const toggleAccepting = () => {
    if (!dealer) return;

    if (!subscriptionActive) {
      alert('Subscription inactive — cannot accept applications.');
      return;
    }

    setDealer({
      ...dealer,
      acceptingApplications: !dealer.acceptingApplications,
    });
  };

  if (!dealer) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="dashboard-main text-center mt-20">
          <p>Loading your dealership...</p>
        </div>
      </div>
    );
  }

  /* ---------------- IMAGE SOURCE ---------------- */
  const allImages = [
    ...(dealer.images || []),
    ...images.map((file) => URL.createObjectURL(file)),
  ];

  const nextImage = () => {
    setCurrentImage((prev) =>
      prev === allImages.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImage((prev) =>
      prev === 0 ? allImages.length - 1 : prev - 1
    );
  };

  return (
    <div className="dashboard-page">
      <Header />

      <div className="btc-particles"></div>
      <div className="dashboard-grid-overlay"></div>

      <div className="dashboard-main">
        <div className="glass-card max-w-3xl mx-auto p-8">

          <h1 className="text-3xl font-semibold text-center mb-2">
            {dealer.dealershipName}
          </h1>

          <p className="text-center opacity-70 mb-6">
            {dealer.address}
          </p>

          {/* STATUS */}
          <div className="text-center mb-6">
            <span className="status-badge active">ACTIVE</span>

            {subStatus?.currentPeriodEnd && (
              <p className="text-sm mt-2 opacity-70">
                Renews on{' '}
                <b>
                  {new Date(
                    subStatus.currentPeriodEnd
                  ).toLocaleDateString()}
                </b>
              </p>
            )}
          </div>

          {/* FORM */}
          <form onSubmit={handleUpdate} className="flex flex-col gap-6">

            {/* Upload FIRST */}
            <div>
              <label className="form-label">Update Images</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="form-input file-input"
              />
            </div>

            {/* Carousel UNDER upload */}
            {allImages.length > 0 && (
              <div className="image-carousel">

                <img
                  src={allImages[currentImage]}
                  alt="Dealer"
                  className="carousel-image"
                />

                {allImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="carousel-btn left"
                      onClick={prevImage}
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      className="carousel-btn right"
                      onClick={nextImage}
                    >
                      →
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Toggle BELOW images */}
            <label className="flex items-center gap-3 cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={dealer.acceptingApplications}
                onChange={toggleAccepting}
              />
              <span>Accepting Applications</span>
            </label>

            {/* Save button LAST (full width) */}
            <button
              type="submit"
              disabled={uploading}
              className="glass-btn w-full mt-4"
            >
              {uploading ? 'Saving...' : 'Save Changes'}
            </button>

            {statusMsg && (
              <p className="text-center mt-2 opacity-80">
                {statusMsg}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default DealerDashboard;