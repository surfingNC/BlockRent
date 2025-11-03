# 🏠 BlockRent – Bitcoin-Backed Rental Platform

**BlockRent** is a rental listing platform where tenants apply for leases by proving they hold sufficient Bitcoin savings — offering an alternative to traditional credit checks and income verification. The platform gives landlords confidence through cryptographic wallet verification, without ever taking custody of tenant funds.

---

## 🎯 What It Does

- 🏠 Landlords list rental properties across the U.S.
- 🔗 Tenants apply by connecting their UniSat wallet and signing a proof-of-ownership message
- 💰 The platform verifies Bitcoin balances — no deposits or custody involved
- 📬 Landlords receive email notifications with applicant info and verified BTC balance
- 🔒 Lease applications are backed by proof-of-BTC instead of credit checks or income statements

---

## 💡 Key Features

- **Bitcoin-Backed Applications**  
  Tenants verify BTC wallet ownership and balance to apply for listings

- **Email Notifications**  
  Landlords are alerted of new applications with applicant name, balance, and message

- **Subscription Tiers**  
  Agents unlock listing features by sending BTC to a designated address

- **Listing Filters**  
  Search properties by ZIP code, state, or proximity radius

- **Image Uploads**  
  Multiple photos per property with lightbox viewer

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

---

## 🌱 Vision

BlockRent empowers Bitcoin-savvy landlords and tenants to engage in BTC-backed rentals — without middlemen, without escrow, and with transparent application proof. Beyond housing, the same decentralized leasing framework could revolutionize how car dealerships structure vehicle leases — integrating Bitcoin in place of conventional credit systems.
