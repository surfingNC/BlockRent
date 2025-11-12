import React, { useEffect, useState } from 'react';
import Header from '../components/DashboardHeader';
import '../styles/index.css';

function DealerDashboard() {
  const [dealer, setDealer] = useState(null);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const email = localStorage.getItem('email');

  // Fetch dealership info for the logged-in user
  useEffect(() => {
    if (!email) return;
    const fetchDealer = async () => {
      try {
        const res = await fetch(`/api/dealers?email=${email}`);
        const data = await res.json();
        // Backend returns a single dealer object, not an array
        if (data && data._id) setDealer(data);
      } catch (err) {
        console.error('Failed to fetch dealership info:', err);
      }
    };
    fetchDealer();
  }, [email]);

  // Handle file selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
  };

  // ✅ FIXED: Upload new images to S3 (matches backend params)
  const uploadImagesToS3 = async () => {
    const uploadedUrls = [];

    for (const file of images) {
      try {
        const fileName = encodeURIComponent(file.name);
        const fileType = encodeURIComponent(file.type);

        // backend expects fileName and fileType
        const res = await fetch(`/api/s3/upload-url?fileName=${fileName}&fileType=${fileType}`);

        if (!res.ok) {
          console.error('❌ Failed to get S3 upload URL:', await res.text());
          continue;
        }

        const { uploadUrl } = await res.json();

        if (!uploadUrl) {
          console.error('❌ No uploadUrl returned from backend');
          continue;
        }

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          console.error('❌ Upload to S3 failed:', uploadRes.statusText);
          continue;
        }

        uploadedUrls.push(uploadUrl.split('?')[0]);
        console.log(`✅ Uploaded ${file.name}`);
      } catch (err) {
        console.error('❌ Error uploading image:', err);
      }
    }

    return uploadedUrls;
  };

  // Update dealership info (images or accept toggle)
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!dealer?._id) return;

    setUploading(true);
    setStatus('Updating dealership...');

    try {
      let uploadedUrls = dealer.images || [];
      if (images.length > 0) {
        const newUrls = await uploadImagesToS3();
        uploadedUrls = newUrls;
      }

      const res = await fetch(`/api/dealers/${dealer._id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: uploadedUrls,
          acceptingApplications: dealer.acceptingApplications,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDealer(data);
        setStatus('✅ Dealership updated successfully!');
        setImages([]);
      } else {
        setStatus(`❌ ${data.error || 'Failed to update'}`);
      }
    } catch (err) {
      console.error('Error updating dealership:', err);
      setStatus('❌ Error updating dealership.');
    } finally {
      setUploading(false);
    }
  };

  // Toggle accepting applications
  const toggleAccepting = () => {
    if (!dealer) return;
    setDealer({ ...dealer, acceptingApplications: !dealer.acceptingApplications });
  };

  if (!dealer) {
    return (
      <div className="dealer-dashboard">
        <Header />
        <p className="text-center mt-10">Loading your dealership info...</p>
      </div>
    );
  }

  return (
    <div className="dealer-dashboard">
      <Header />
      <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-semibold mb-4 text-center">
          {dealer.dealershipName || 'Your Dealership'}
        </h1>
        <p className="text-center text-gray-600 mb-4">{dealer.address}</p>

        <div className="text-sm text-gray-500 mb-4 text-center">
          <p><b>Email:</b> {dealer.contactEmail}</p>
          <p>
            <b>Subscription:</b> {dealer.subscriptionType} (
            valid until{' '}
            {new Date(dealer.subscriptionValidUntil).toLocaleDateString()})
          </p>
        </div>

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
                alt={`Dealer ${i}`}
                className="w-24 h-24 object-cover rounded-md border"
              />
            ))}
            {images.length > 0 &&
              Array.from(images).map((file, idx) => (
                <img
                  key={idx}
                  src={URL.createObjectURL(file)}
                  alt="preview"
                  className="w-24 h-24 object-cover rounded-md border"
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
            {uploading ? 'Updating...' : 'Save Changes'}
          </button>

          {status && <p className="text-center mt-2">{status}</p>}
        </form>
      </div>
    </div>
  );
}

export default DealerDashboard;
