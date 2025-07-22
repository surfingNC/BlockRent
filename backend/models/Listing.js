import mongoose from 'mongoose';

const usStates = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const ListingSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  streetAddress: { type: String, required: true },
  zipCode: { type: String, required: true },
  state: {
    type: String,
    required: true,
    enum: usStates,
  },
  description: { type: String, required: true },
  contactEmail: { type: String, required: true },
  imageUrls: [{ type: String }],
  price: { type: Number, required: true },
  acceptApplications: { type: Boolean, default: true }, // ✅ New field
  createdAt: { type: Date, default: Date.now },
});

const Listing = mongoose.model('Listing', ListingSchema);

export default Listing;
