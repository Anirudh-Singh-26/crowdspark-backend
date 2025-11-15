const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const { verifyToken } = require("./middleware/verifyToken");

const User = require("./models/User");
const Campaign = require("./models/Campaign");
const Transaction = require("./models/Transaction");
const PDFDocument = require("pdfkit");
const multer = require("multer");
const cloudinary = require("./middleware/cloudinary");
const { Readable } = require("stream");


dotenv.config();
if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  throw new Error("Missing critical environment variables");
}

// Razor Pay intigration
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



const app = express();
app.use(express.json());
app.use(cookieParser());
// app.use(
//   cors({
//     origin: [process.env.FRONTEND_URL, "https://crowdspark-frontend-gamma.vercel.app"],
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: ["*"],
    credentials: true,
  })
);


const uri = process.env.MONGO_URI;
mongoose
  .connect(uri)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const rateLimit= require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 200, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});

app.use(limiter);


//  Routes

// Register
app.post("/register", async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Allow only specific roles to be assigned manually (safe fallback)
    const allowedRoles = ["backer", "campaignOwner"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role,
    });

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    

    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/", // 🔥 make sure this is here too
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    

    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// MULTER AND CLOUDINARY
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No image provided" });

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    let cld_upload_stream = cloudinary.uploader.upload_stream(
      { folder: "crowdspark_campaigns" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ message: "Upload failed" });
        }
        return res.status(200).json({ imageUrl: result.secure_url });
      }
    );

    bufferStream.pipe(cld_upload_stream);
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ message: "Error uploading image" });
  }
});


// Protected route
app.get("/me", verifyToken, async (req, res) => {
  console.log("👤 [Auth] /me hit with user id:", req.user?.id);
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("❌ [Auth] Error in /me:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Logout
// BACKEND: Logout Route
app.post("/logout", (req, res) => {
  console.log("🔒 [Logout] Incoming logout request");
  console.log("🍪 Existing token cookie:", req.cookies.token);

  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/", // Ensure it's same path as set in login
    expires: new Date(0),
    maxAge: 0,
  });

  console.log("🚫 [Logout] Cookie cleared");

  res.status(200).json({ message: "Logged out successfully" });
});





// All Campaigns
app.post("/campaigns", verifyToken, async (req, res) => {
  const { title, description, goalAmount, deadline, category, image } =
    req.body;

  try {
    if (!["campaignOwner", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only campaign owners or admins can create campaigns",
      });
    }

    if (!title || !description || !goalAmount || !deadline || !image) {
      return res
        .status(400)
        .json({ message: "All required fields must be filled" });
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate < new Date()) {
      return res.status(400).json({ message: "Invalid or past deadline" });
    }

    const exists = await Campaign.findOne({ title, owner: req.user.id });
    if (exists) {
      return res
        .status(409)
        .json({ message: "Campaign with this title already exists" });
    }

    const campaign = await Campaign.create({
      title,
      description,
      goalAmount,
      raisedAmount: 0,
      deadline,
      category,
      image,
      status: "active",
      owner: req.user.id,
    });

    const io = req.app.get("io");
    io.emit("new_campaign", {
      title: campaign.title,
      owner: req.user.username,
      category: campaign.category,
      goalAmount: campaign.goalAmount,
    });

    res
      .status(201)
      .json({ message: "Campaign created successfully", campaign });
  } catch (err) {
    console.error("Error creating campaign:", err.message);
    res.status(500).json({ message: "Server error while creating campaign" });
  }
});

// Razor pay Routes

app.post("/create-order", verifyToken, async (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  const options = {
    amount: amount * 100, // Razorpay accepts amount in paisa
    currency: "INR",
    receipt: `receipt_order_${Date.now()}`,
    payment_capture: 1,
  };

  try {
    const order = await razorpay.orders.create(options);
    res
      .status(201)
      .json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });
  } catch (err) {
    console.error("Failed to create Razorpay order:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
});


// All Transactions
app.post("/transactions", verifyToken, async (req, res) => {
  const { campaignId, amount, message } = req.body;

  // console.log("📥 [Transaction] Incoming request:");
  // console.log("➡️ Body:", { campaignId, amount, message });
  // console.log("👤 User:", req.user);

  if (!req.user || !req.user.id) {
    // console.log("⛔ Unauthorized: No user ID");
    return res.status(401).json({ message: "Unauthorized. Invalid token." });
  }

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      // console.log("❌ Campaign not found:", campaignId);
      return res.status(404).json({ message: "Campaign not found" });
    }

    // console.log("✅ Campaign found:", campaign.title);

    // Update raisedAmount and supporters
    campaign.raisedAmount = (campaign.raisedAmount || 0) + amount;

    if (!campaign.supporters.includes(req.user.id)) {
      campaign.supporters.push(req.user.id);
      // console.log("🙋 Added supporter:", req.user.id);
    }

    await campaign.save();
    // console.log("💾 Campaign updated with new amount:", campaign.raisedAmount);

    // Save transaction
    const transaction = await Transaction.create({
      user: req.user.id,
      campaign: campaignId,
      amount,
      provider: req.user.username,
      status: "completed",
      message: message || "",
      paymentId: uuidv4(),
    });

    // console.log("💳 Transaction saved:", transaction._id);

    // Update user's backedCampaigns
    const user = await User.findById(req.user.id);
    if (user) {
      if (!Array.isArray(user.backedCampaigns)) {
        user.backedCampaigns = [];
      }
      if (!user.backedCampaigns.includes(campaignId)) {
        user.backedCampaigns.push(campaignId);
        await user.save();
        // console.log("📘 User updated with new backed campaign:", campaignId);
      }
    }

    // 🔔 Emit real-time notification
    const io = req.app.get("io");
    const room = campaign.owner.toString();

    // console.log("📡 Emitting 'new_backing' to room:", room);
    // console.log("📦 Payload:", {
    //   campaignId,
    //   backer: req.user.username,
    //   amount,
    //   message,
    // });

    io.to(room).emit("new_backing", {
      campaignId,
      backer: req.user.username,
      amount,
      message,
    });

    res.status(201).json({
      message: "Transaction successful",
      transaction,
    });
  } catch (err) {
    console.error("❌ Transaction error:", err);
    res.status(500).json({ message: "Server error during transaction" });
  }
});



// /my-campaigns
app.get("/my-campaigns", verifyToken, async (req, res) => {
  try {
    // console.log("📥 Fetching campaigns for user:", req.user.id);

    const campaigns = await Campaign.find({ owner: req.user.id }).select(
      "title image goalAmount raisedAmount"
    );

    const safeCampaigns = campaigns.map((c) => ({
      _id: c._id,
      title: c.title || "Untitled Campaign",
      image: c.image || "https://via.placeholder.com/400x200?text=No+Image",
      goalAmount: c.goalAmount ?? 0,
      raisedAmount: c.raisedAmount ?? 0,
    }));

    // console.log("✅ Campaigns returned:", safeCampaigns.length);

    res.json(safeCampaigns);
  } catch (err) {
    console.error("❌ Failed to fetch campaigns:", err.message);
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
});


// /my-contributions
app.get("/my-contributions", verifyToken, async (req, res) => {
  try {
    // console.log("📥 Getting contributions for user:", req.user.id);

    const transactions = await Transaction.find({
      user: req.user.id,
      status: "completed",
    })
      .populate("campaign", "title")
      .sort({ createdAt: -1 });

    // console.log("✅ Transactions found:", transactions.length);

    const contributions = transactions
      .filter((t) => t.campaign) // Skip ones with missing campaign
      .map((t) => ({
        id: t._id,
        title: t.campaign.title,
        amount: t.amount,
        date: t.createdAt ? t.createdAt.toISOString().split("T")[0] : "N/A", // fallback if missing
      }));

    // console.log("🟢 Final contributions:", contributions);

    res.json(contributions);
  } catch (err) {
    console.error("❌ Failed to fetch contributions:", err.message);
    res.status(500).json({ message: "Failed to fetch contributions" });
  }
});



// Get all users
app.get("/admin/users", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Delete user
app.delete("/admin/users/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Get all campaigns
app.get("/admin/campaigns", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    const campaigns = await Campaign.find().populate("owner", "username");
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
});

// Delete campaign
app.delete("/admin/campaigns/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    await Campaign.findByIdAndDelete(req.params.id);
    res.json({ message: "Campaign deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete campaign" });
  }
});

app.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await Campaign.find().populate("owner", "username");
    res.status(200).json(campaigns);
  } catch (err) {
    console.error("Error fetching campaigns:", err.message);
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
});

app.get("/campaigns/:id", async (req, res) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid campaign ID format" });
  }

  try {
    const campaign = await Campaign.findById(id).populate(
      "owner",
      "username email"
    ); // populate optional

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.status(200).json(campaign);
  } catch (error) {
    console.error("Error fetching campaign details:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get campaign by ID
app.get("/campaigns/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid campaign ID format" });
  }

  try {
    const campaign = await Campaign.findById(id).populate("owner", "username");
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.status(200).json(campaign);
  } catch (err) {
    res.status(500).json({ message: "Error fetching campaign" });
  }
});

// Get all transactions for a specific campaign
app.get("/campaigns/:id/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find({ campaign: req.params.id })
      .sort({ createdAt: -1 })
      .populate("user", "username");
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching campaign transactions:", err.message);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});





const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL, "https://crowdspark-frontend-gamma.vercel.app"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("🧩 Socket connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    // console.log(`👥 User ${userId} joined their room`);
  });
});

app.get("/invoice/:transactionId", verifyToken, async (req, res) => {
  try {
    const transaction = await Transaction.findById(
      req.params.transactionId
    ).populate("campaign");

    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${transaction._id}.pdf`
    );

    doc.fontSize(20).text("CrowdSpark - Donation Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Transaction ID: ${transaction._id}`);
    doc.text(`Date: ${new Date(transaction.createdAt).toLocaleString()}`);
    doc.text(`Backer: ${transaction.provider}`);
    doc.text(`Campaign: ${transaction.campaign.title}`);
    doc.text(`Amount: ₹${transaction.amount}`);
    doc.text(`Message: ${transaction.message}`);
    doc
      .moveDown()
      .text("Thank you for supporting this cause!", { align: "center" });

    doc.end();
    doc.pipe(res);
  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).json({ message: "Error generating invoice" });
  }
});

const RoleRequest = require("./models/RoleRequest");

app.post("/request-campaign-owner", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "backer") {
      return res
        .status(403)
        .json({ message: "Only backers can request upgrade" });
    }

    // Prevent duplicate pending requests
    const existing = await RoleRequest.findOne({
      user: user._id,
      status: "pending",
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "You already have a pending request" });
    }

    const request = new RoleRequest({ user: user._id });
    await request.save();

    // console.log(
    //   `🔔 Backer ${user.username} requested to become a campaign owner`
    // );

    res.status(200).json({ message: "Request sent to admin" });
  } catch (err) {
    console.error("Request error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all upgrade requests
app.get("/admin/upgrade-requests", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Forbidden" });

  try {
    const requests = await RoleRequest.find({ status: "pending" }).populate("user");
    res.json(requests);
  } catch (err) {
    console.error("Fetch requests error:", err.message);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});

// APPROVE a request
app.post("/admin/upgrade-requests/:id/approve", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Forbidden" });

  try {
    const request = await RoleRequest.findById(req.params.id);
    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Request not found" });
    }

    const user = await User.findById(request.user);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = "campaignOwner";
    await user.save();

    request.status = "approved";
    await request.save();

    res.json({ message: "Request approved" });
  } catch (err) {
    console.error("Approval error:", err.message);
    res.status(500).json({ message: "Failed to approve request" });
  }
});

// DELETE (Reject) a request
app.delete("/admin/upgrade-requests/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Forbidden" });

  try {
    const request = await RoleRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.status = "rejected";
    await request.save();

    res.json({ message: "Request rejected" });
  } catch (err) {
    console.error("Rejection error:", err.message);
    res.status(500).json({ message: "Failed to reject request" });
  }
});


app.get("/admin/backers", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Forbidden" });

  try {
    const backers = await User.find({ role: "backer" }).select(
      "username email _id"
    );
    res.json(backers);
  } catch (err) {
    console.error("Fetch backers error:", err.message);
    res.status(500).json({ message: "Failed to fetch backers" });
  }
});

app.patch(
  "/admin/upgrade-to-campaign-owner/:id",
  verifyToken,
  async (req, res) => {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Forbidden" });

    try {
      const user = await User.findById(req.params.id);
      if (!user || user.role !== "backer") {
        return res.status(400).json({ message: "User is not a backer" });
      }

      user.role = "campaignOwner";
      await user.save();

      // console.log(`✅ User ${user.username} upgraded to campaignOwner`);
      res.json({ message: "User upgraded to Campaign Owner successfully" });
    } catch (err) {
      console.error("Upgrade error:", err.message);
      res.status(500).json({ message: "Failed to upgrade user" });
    }
  }
);


app.get("/api/ping", (req, res) => {
  res.send("pong");
});



const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running with Socket.IO on http://localhost:${PORT}`);
});
