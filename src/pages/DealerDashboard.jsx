// src/pages/DealerDashboard.jsx
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

  const token = localStorage.getItem('token');
  let email = '';

  // 🟩 Decode authenticated email from JWT
  if (token) {
    try {
      const decoded = jwtDecode(token);
      email = decoded.email?.toLowerCase() || '';
    } catch (err) {
      console.error('❌ Invalid token:', err);
    }
  }

  const API = 'http://localhost:5000';

  /* ------------------------------------------------------
   * Fetch the user's dealership
   * ------------------------------------------------------ */
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

  /* ------------------------------------------------------
   * Fetch Stripe dealership subscription
   * ------------------------------------------------------ */
  const fetchSubscription = useCallback(async () => {
    if (!email) return;

    try {
      const res = await fetch(
        `${API}/api/stripe/dealer-status?email=${encodeURIComponent(email)}`
      );
      const data = await res.json();

      if (res.ok) {
        setSubStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    }
  }, [email]);

  /* ------------------------------------------------------
   * On mount
   * ------------------------------------------------------ */
  useEffect(() => {
    fetchDealer();
    fetchSubscription();
  }, [fetchDealer, fetchSubscription]);

  /* ------------------------------------------------------
   * Protect entire page if subscription inactive
   * ------------------------------------------------------ */
  if (subStatus && subStatus.status !== 'active') {
    return (
      <div className="dealer-dashboard p-10 text-center">
        <Header />
        <h2 className="text-2xl font-semibold mt-10 text-red-700">
          ❌ Dealership Subscription Required
        </h2>
        <p className="mt-4 text-gray-700">
          You must have an active dealership subscription to access your dealer
          dashboard.
        </p>

        <button
          onClick={() => (window.location.href = '/subscribe?for=dealership')}
          className="mt-6 bg-yellow-500 text-white px-5 py-2 rounded hover:bg-yellow-600"
        >
          Subscribe Now
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------
   * Handle image input
   * ------------------------------------------------------ */
  const handleImageChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  /* ------------------------------------------------------
   * Upload to S3
   * ------------------------------------------------------ */
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

  /* ------------------------------------------------------
   * Update dealer data
   * ------------------------------------------------------ */
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

  /* ------------------------------------------------------
   * Toggle "Accepting Applications"
   * ------------------------------------------------------ */
  const toggleAccepting = () => {
    if (!dealer) return;

    if (subStatus?.status !== 'active') {
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
      <div className="dealer-dashboard">
        <Header />
        <p className="text-center mt-10">Loading your dealership...</p>
      </div>
    );
  }

  return (
    <div className="dealer-dashboard">
      <Header />

      <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-semibold mb-1 text-center">
          {dealer.dealershipName}
        </h1>

        <p className="text-center text-gray-600 mb-4">{dealer.address}</p>

        {/* Subscription Status Badge */}
        <div className="text-center mb-4">
          <span
            style={{
              background: 'green',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
            }}
          >
            ACTIVE
          </span>

          {subStatus?.currentPeriodEnd && (
            <p className="text-sm mt-2 text-gray-700">
              Renewal Date:{' '}
              <b>{new Date(subStatus.currentPeriodEnd).toLocaleDateString()}</b>
            </p>
          )}
        </div>

        {/* Update Form */}
        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <label className="font-medium">Update Dealership Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            className="border rounded px-3 py-2"
          />

          <div className="flex flex-wrap gap-2 mt-2">
            {dealer.images?.map((url, i) => (
              <img
                key={i}
                src={url}
                className="w-24 h-24 object-cover rounded border"
                alt="Dealer"
              />
            ))}

            {images.length > 0 &&
              images.map((file, i) => (
                <img
                  key={i}
                  src={URL.createObjectURL(file)}
                  className="w-24 h-24 object-cover rounded border"
                  alt="Preview"
                />
              ))}
          </div>

          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={dealer.acceptingApplications}
              onChange={toggleAccepting}
            />
            Accepting Applications
          </label>

          <button
            type="submit"
            disabled={uploading}
            className="bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600"
          >
            {uploading ? 'Saving...' : 'Save Changes'}
          </button>

          {statusMsg && (
            <p className="text-center mt-2 font-semibold">{statusMsg}</p>
          )}
        </form>
      </div>
    </div>
  );
}

export default DealerDashboard;
