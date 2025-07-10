# 🧠 CrowdSpark Backend

This is the backend for **CrowdSpark**, a crowdfunding platform built using **Node.js**, **Express**, **MongoDB**, and **Socket.IO**.

For the Frontend part Please visit the CrowdSpard-frontend repo or link-> https://github.com/Anirudh-Singh-26/crowdspark-frontend


## 🔗 Live API

[https://crowdspark-backend.onrender.com](https://crowdspark-backend.onrender.com)

## 📦 Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication (HttpOnly Cookies)
- Socket.IO
- Razorpay Integration (Test Mode)
- Multer + Cloudinary for Uploads
- PDFKit for Invoice Generation

## ⚙️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/YourUsername/crowdspark-backend.git
cd crowdspark-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup `.env` File

```env
PORT=3002
MONGO_URI=your-mongo-uri
JWT_SECRET=your_jwt_secret
NODE_ENV=production

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

FRONTEND_ORIGIN=https://crowdspark-frontend.vercel.app
```

## 🚀 Start the Server

```bash
npm start
```

## 🌟 Features

- ✅ User Auth with Cookies
- 📢 Campaign Management
- 🧾 Contribution Records & PDF Invoices
- ⚙️ Role-Based Access & Admin Controls
- 🔁 Role Upgrade Request System
- 💳 Razorpay Payment Integration
- 🔔 Real-Time Socket.IO Notifications

## 📘 License

MIT © Anirudh Singh Rathore
