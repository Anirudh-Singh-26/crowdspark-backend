# 🧠 CrowdSpark Backend

**CrowdSpark Backend** is the server-side of the CrowdSpark crowdfunding platform. Built using **Node.js**, **Express**, **MongoDB**, and **Socket.IO**, it provides secure APIs, authentication, payment handling, and real-time notifications for the frontend.

For the frontend, visit the [CrowdSpark Frontend Repository](https://github.com/Anirudh-Singh-26/crowdspark-frontend).

🔗 **Backend API:** [https://crowdspark-backend.onrender.com](https://crowdspark-backend.onrender.com)

---

## 🌟 Project Overview

The backend handles all core functionality of CrowdSpark, including:

* User authentication with JWT and HttpOnly cookies
* Role-based access control (Admin, Campaign Owner, Backer)
* Campaign management APIs (create, edit, delete, discover)
* Payment processing with Razorpay (Test Mode)
* Real-time notifications using Socket.IO
* Media uploads using Multer and Cloudinary
* Invoice generation with PDFKit
* Admin panel endpoints for user and campaign management

---

## 🛠 Technology Stack

* **Node.js** + **Express**: Backend framework and server
* **MongoDB** + **Mongoose**: Database and ODM
* **JWT Authentication** with HttpOnly Cookies
* **Socket.IO**: Real-time notifications
* **Razorpay Integration**: Payment handling (Test Mode)
* **Multer + Cloudinary**: File and image uploads
* **PDFKit**: Invoice generation

---

## ✨ Key Features

* ✅ Secure User Authentication with Cookies
* 📢 Full Campaign Management (CRUD)
* 🧾 Contribution Records & PDF Invoices
* ⚙️ Role-Based Access & Admin Controls
* 🔁 Role Upgrade Request System
* 💳 Razorpay Payment Integration
* 🔔 Real-Time Socket.IO Notifications

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Anirudh-Singh-26/crowdspark-backend.git
cd crowdspark-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env` file in the root directory:

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

### 4. Start the Server

```bash
npm start
```

Server will run on `http://localhost:3002` by default.

---

## 👤 Author

Anirudh Singh Rathore
[GitHub Profile](https://github.com/Anirudh-Singh-26)

---

## 📄 License

MIT © Anirudh Singh Rathore
