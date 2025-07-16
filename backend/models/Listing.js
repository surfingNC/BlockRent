import mongoose from 'mongoose';

const ListingSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  streetAddress: { type: String, required: true },
  zipCode: { type: String, required: true },
  description: { type: String, required: true },
  contactEmail: { type: String, required: true },
  imageUrls: [{ type: String }],
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Listing = mongoose.model('Listing', ListingSchema);

export default Listing;
