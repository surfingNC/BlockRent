import React, { useState } from 'react';
import Header from '../components/Header.js';

function ListingForm() {
  const [formData, setFormData] = useState({
    streetAddress: '',
    zipCode: '',
    state: '',
    description: '',
    contactEmail: '',
    price: '',
    acceptApplications: true, // ✅ New field
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
    for (let file of images) {
      const fileName = `${Date.now()}-${file.name}`;
      const res = await fetch(
        `${API_URL}/api/s3/upload-url?fileName=${encodeURIComponent(fileName)}&fileType=${encodeURIComponent(file.type)}`
      );
      const { uploadUrl } = await res.json();

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      const publicUrl = uploadUrl.split('?')[0];
      uploadedUrls.push(publicUrl);
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
          Authorization: `Bearer ${sessionStorage.getItem('token')}`,
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
        acceptApplications: true, // reset to default
      });
      setImages([]);
    } catch (err) {
      console.error('Error submitting listing:', err);
      alert('❌ Failed to submit listing.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex justify-center items-center py-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-8 space-y-4"
        >
          <h2 className="text-2xl font-semibold text-center mb-6">List Your Property</h2>

          <input
            type="text"
            name="streetAddress"
            placeholder="Street Address"
            value={formData.streetAddress}
            onChange={handleInputChange}
            required
            className="w-full p-3 border border-gray-300 rounded"
          />

          <input
            type="text"
            name="zipCode"
            placeholder="Zip Code"
            value={formData.zipCode}
            onChange={handleInputChange}
            required
            className="w-full p-3 border border-gray-300 rounded"
          />

          <select
            name="state"
            value={formData.state}
            onChange={handleInputChange}
            required
            className="w-full p-3 border border-gray-300 rounded bg-white"
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
            rows={6}
            className="w-full p-3 border border-gray-300 rounded resize-none"
          ></textarea>

          <input
            type="email"
            name="contactEmail"
            placeholder="Contact Email"
            value={formData.contactEmail}
            onChange={handleInputChange}
            required
            className="w-full p-3 border border-gray-300 rounded"
          />

          <input
            type="number"
            name="price"
            placeholder="Price per Month (USD)"
            value={formData.price}
            onChange={handleInputChange}
            required
            className="w-full p-3 border border-gray-300 rounded"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="acceptApplications"
              checked={formData.acceptApplications}
              onChange={handleInputChange}
              className="h-4 w-4"
            />
            <label htmlFor="acceptApplications" className="text-sm text-gray-700">
              Accept applications via BlockRent
            </label>
          </div>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            required
            className="w-full p-2"
          />

          <button
            type="submit"
            disabled={uploading}
            className={`w-full p-3 rounded text-white font-semibold ${
              uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {uploading ? 'Uploading...' : 'Submit Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ListingForm;
