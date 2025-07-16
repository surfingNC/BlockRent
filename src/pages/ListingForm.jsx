// src/pages/ListingForm.jsx
import React, { useState } from 'react';

function ListingForm() {
  const [formData, setFormData] = useState({
    streetAddress: '',
    zipCode: '',
    description: '',
    contactEmail: '',
    price: '',
  });

  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const API_URL = 'http://localhost:5000';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
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
        headers: {
          'Content-Type': file.type,
        },
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
      setFormData({ streetAddress: '', zipCode: '', description: '', contactEmail: '', price: '' });
      setImages([]);
    } catch (err) {
      console.error('Error submitting listing:', err);
      alert('❌ Failed to submit listing.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2>List Your Property</h2>

      <input
        type="text"
        name="streetAddress"
        placeholder="Street Address"
        value={formData.streetAddress}
        onChange={handleInputChange}
        required
      />

      <input
        type="text"
        name="zipCode"
        placeholder="Zip Code"
        value={formData.zipCode}
        onChange={handleInputChange}
        required
      />

      <textarea
        name="description"
        placeholder="Brief Description"
        value={formData.description}
        onChange={handleInputChange}
        required
      ></textarea>

      <input
        type="email"
        name="contactEmail"
        placeholder="Contact Email"
        value={formData.contactEmail}
        onChange={handleInputChange}
        required
      />

      <input
        type="number"
        name="price"
        placeholder="Price per Month (USD)"
        value={formData.price}
        onChange={handleInputChange}
        required
      />

      <input type="file" accept="image/*" multiple onChange={handleImageChange} required />

      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Submit Listing'}
      </button>
    </form>
  );
}

export default ListingForm;
