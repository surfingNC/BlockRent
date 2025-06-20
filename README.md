# Getting Started

I have yet to dockerize my application

1. **Install dependencies**
   Required:
   express – Web server framework

mongoose – MongoDB ODM (connects to your database)

bcrypt – For hashing passwords

jsonwebtoken – For generating and verifying JWT tokens

dotenv – For loading environment variables from .env

cors – To allow cross-origin requests from frontend

express-validator – Input validation middleware

```
2. **Start the development server**
npm run dev

BlockRent lets you qualify for apartments or mortgages using Bitcoin instead of traditional credit. Secure your future, your way.

# Bitcoin-Backed Loan App

A React web application that allows users to apply for loans backed by Bitcoin as collateral. The app includes a login system and a loan application form.

## Features

- 🔐 User registration and login with client-side validation and password hashing using bcrypt.
- 💰 Loan application form with BTC collateral input
- 🧭 React Router-based navigation (Login → Dashboard)
- 🎨 Styled with custom CSS for a clean UI
- 📁 Organized project structure using `components`, `pages`, `styles`, and `utils`
- 💰 Real-time BTC pricing via API

# Tech Stack

- **Frontend**: React, React Router DOM
- **Styling**: Custom CSS
- **Backend (Planned/Partial)**: Node.js with Express and MongoDB for user authentication

## Backend

The backend is built with Node.js and Express, and handles:

User registration and login

Password hashing with bcrypt

JWT-based authentication

MongoDB for user data storage (via mongoose)

Input validation via express-validator

🔐 JWT Authentication
When a user logs in:

Their password is verified using bcrypt.

If valid, the server generates a JWT (JSON Web Token) signed with a secret key.

This token is sent back to the client and stored (e.g. in localStorage).

On future requests to protected routes, the client sends the token in the Authorization header.

The server verifies the token to authenticate the user.

JWT tokens are stateless, meaning the server doesn’t need to store session data — it just verifies the token on each request.

📦 Main Technologies
express – Web server and routing.

mongoose – Connects to MongoDB and defines data schemas

bcrypt – Secures passwords by hashing

jsonwebtoken – Generates and validates tokens

dotenv – Manages environment variables like JWT_SECRET and MONGO_URI

cors – Enables frontend-backend communication

express-validator – Validates and sanitizes user input

## Planned Features

 -Loan eligibility engine

 -Admin dashboard
```
