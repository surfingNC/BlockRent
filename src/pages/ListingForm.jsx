import React, { useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';

function ListingForm() {
  const [formData, setFormData] = useState({
    streetAddress: '',
    zipCode: '',
    state: '',
    description: '',
    contactEmail: '',
    price: '',
    acceptApplications: true,
  });

  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const API_URL = 'http://localhost:5000';

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleImageChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  const uploadImagesToS3 = async () => {
    const uploadedUrls = [];
    const token = localStorage.getItem('token');

    for (let file of images) {
      const fileName = `${Date.now()}-${file.name}`;

      const res = await fetch(
        `${API_URL}/api/s3/upload-url?fileName=${encodeURIComponent(fileName)}&fileType=${encodeURIComponent(file.type)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.msg || 'Failed to get upload URL');

      const { uploadUrl } = data;

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      uploadedUrls.push(uploadUrl.split('?')[0]);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const imageUrls = await uploadImagesToS3();

      const res = await fetch(`${API_URL}/api/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          imageUrls,
        }),
      });

      if (!res.ok) throw new Error('Failed to create listing');

      alert('✅ Property listed successfully!');

      setFormData({
        streetAddress: '',
        zipCode: '',
        state: '',
        description: '',
        contactEmail: '',
        price: '',
        acceptApplications: true,
      });

      setImages([]);
    } catch (err) {
      console.error(err);
      alert('❌ Failed to submit listing.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <DashboardHeader username={localStorage.getItem('username') || ''} />

      {/* BTC background */}
      <div className="btc-particles" />
      <div className="dashboard-grid-overlay" />

      <div className="dashboard-main">
        <div className="glass-card max-w-xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-6">
            List Your Property
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            <input
              type="text"
              name="streetAddress"
              placeholder="Street Address"
              value={formData.streetAddress}
              onChange={handleInputChange}
              required
              className="glass-input"
            />

            <input
              type="text"
              name="zipCode"
              placeholder="Zip Code"
              value={formData.zipCode}
              onChange={handleInputChange}
              required
              className="glass-input"
            />

            <select
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              required
              className="glass-select"
            >
              <option value="">Select State</option>
              {[
                'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
                'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
                'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
                'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
                'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
              ].map((abbr) => (
                <option key={abbr} value={abbr}>{abbr}</option>
              ))}
            </select>

            <textarea
              name="description"
              placeholder="Brief Description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={5}
              className="glass-textarea"
            />

            <input
              type="email"
              name="contactEmail"
              placeholder="Contact Email"
              value={formData.contactEmail}
              onChange={handleInputChange}
              required
              className="glass-input"
            />

            <input
              type="number"
              name="price"
              placeholder="Price per Month (USD)"
              value={formData.price}
              onChange={handleInputChange}
              required
              className="glass-input"
            />

            {/* Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="acceptApplications"
                checked={formData.acceptApplications}
                onChange={handleInputChange}
              />
              <label className="text-sm text-gray-300">
                Accept applications via BlockRent
              </label>
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              required
              className="glass-input"
            />

            <button
              type="submit"
              disabled={uploading}
              className="glass-btn w-full"
            >
              {uploading ? 'Uploading...' : 'Submit Listing'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}

export default ListingForm;