import React, { useState } from 'react';
import Header from '../components/DashboardHeader';
import '../styles/index.css';

function ListYourDealership() {
  const [dealershipName, setDealershipName] = useState('');
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState(''); // ✅ NEW
  const [contactEmail, setContactEmail] = useState('');
  const [subscriptionType, setSubscriptionType] = useState('monthly');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  // 🧠 Get user email from localStorage (registered user)
  const email = localStorage.getItem('email');

  // Handle local image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
  };

  // ✅ Upload images to S3
  const uploadImagesToS3 = async () => {
    const uploadedUrls = [];

    for (const file of images) {
      try {
        const fileName = encodeURIComponent(file.name);
        const fileType = encodeURIComponent(file.type);

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

        uploadedUrls.push(uploadUrl.split('?')[0]); // strip query params
        console.log(`✅ Uploaded ${file.name} successfully`);
      } catch (err) {
        console.error('❌ Error uploading image:', err);
      }
    }

    return uploadedUrls;
  };

  // ✅ Submit dealership info
  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setStatus('Submitting dealership...');

    try {
      let uploadedUrls = [];
      if (images.length > 0) {
        uploadedUrls = await uploadImagesToS3();
      }

      const res = await fetch('/api/dealers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipName,
          address,
          zipCode, // ✅ include ZIP
          contactEmail: contactEmail || email, // fallback to logged-in user email
          subscriptionType,
          images: uploadedUrls,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('✅ Dealership listed successfully!');
        setDealershipName('');
        setAddress('');
        setZipCode('');
        setImages([]);
      } else {
        setStatus(`❌ ${data.error || 'Failed to list dealership'}`);
      }
    } catch (err) {
      console.error('❌ Error submitting dealership:', err);
      setStatus('❌ Error submitting dealership.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="list-dealership-page">
      <Header />
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-semibold mb-4 text-center">List Your Dealership</h1>
        <p className="text-gray-600 text-center mb-6">
          Add your dealership to the BlockLease network. Upload your photos and contact info.
        </p>

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

          <label>Contact Email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Optional (defaults to your account email)"
            className="border rounded px-3 py-2"
          />

          <label>Subscription Type</label>
          <select
            value={subscriptionType}
            onChange={(e) => setSubscriptionType(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>

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
            {uploading ? 'Submitting...' : 'Submit Dealership'}
          </button>

          {status && <p className="text-center mt-2">{status}</p>}
        </form>
      </div>
    </div>
  );
}

export default ListYourDealership;
