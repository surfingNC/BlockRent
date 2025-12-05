# 🏠 BlockRent – Bitcoin-Backed Rental Platform

**BlockRent** is a rental and leasing platform where tenants and car buyers apply by proving they hold sufficient Bitcoin savings — offering an alternative to traditional credit checks and income verification. The platform gives landlords and car dealerships confidence through cryptographic wallet verification, without ever taking custody of user funds. The same engine powers **BlockLease**, a vertical focused on independent car dealerships.

---

## 🎯 What It Does

- 🏠 Landlords list rental properties across the U.S.
- 🚗 Car dealers list vehicles and receive BTC-backed lease / in-house financing applications
- 🔗 Applicants connect their UniSat wallet and sign a proof-of-ownership message
- 💰 The platform verifies Bitcoin balances — no deposits or custody involved
- 📬 Landlords and dealers receive email notifications with applicant info and verified BTC balance
- 🔒 Applications are backed by proof-of-BTC instead of credit checks or income statements

---

## 💡 Key Features

- **Bitcoin-Backed Applications**  
  Tenants and car buyers verify BTC wallet ownership and balance to apply for rentals or vehicle leases.

- **Email Notifications**  
  Landlords and dealers are alerted of new applications with applicant name, BTC balance, and a short message.

- **Subscription Tiers**  
  Agents and dealerships unlock listing and lead-intake features by sending BTC to a designated address.

- **Listing Filters**  
  Search properties and (in the BlockLease vertical) dealerships by ZIP code, state, or proximity radius.

- **Image Uploads**  
  Multiple photos per property or vehicle with a lightbox viewer for browsing galleries.

---

## 🛠 Tech Stack

- **Frontend**: React (Vite), Tailwind UI enhancements
- **Backend**: Node.js (ESM), Express
- **Database**: MongoDB Atlas
- **File Storage**: AWS S3 (image uploads via signed URLs)
- **Bitcoin Wallet Auth**: UniSat + ECDSA signature verification
- **Pricing Feed**: CoinGecko BTC/USD
- **Email**: Resend API
- **Deployment**: Railway / Render / Vercel

---

## 🚀 Current Status

✅ Email verification & JWT auth  
✅ Property listing & image uploads  
✅ Wallet connection + signature verification  
✅ Application form + BTC proof  
✅ Paid subscriptions via BTC  
✅ Initial BlockLease dealership flow: dealer listings + BTC-backed buyer applications

---

## 🌱 Vision

BlockRent empowers Bitcoin-savvy landlords and tenants to engage in BTC-backed rentals — without middlemen, without escrow, and with transparent application proof. In parallel, the **BlockLease** vertical brings the same decentralized leasing framework to independent car dealerships, where buyers prove BTC savings instead of relying solely on conventional credit systems. Together, BlockRent and BlockLease aim to become the Bitcoin-native underwriting layer for both **housing** and **vehicle** access.

Long-term goal: Secure seed funding, obtain an MSB license and escrow insurance, and build a fully automated Bitcoin escrow liquidation engine.
