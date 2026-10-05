const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors()); // Cho phép GitHub Pages gọi API

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected!'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Schema quản lý License Key
const KeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  hwid: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const KeyModel = mongoose.model('Key', KeySchema);

// 1. API cho Admin tạo Key mới
app.post('/api/admin/create-key', async (req, res) => {
  const { adminSecret, customKey } = req.body;
  
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: 'Sai mã Admin!' });
  }

  try {
    const newKey = customKey || 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const created = await KeyModel.create({ key: newKey });
    res.json({ success: true, message: 'Tạo key thành công', key: created.key });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Key đã tồn tại hoặc có lỗi xảy ra.' });
  }
});

// 2. API Verify Key & HWID (Cho Web hoặc Roblox Script gọi)
app.post('/api/verify-key', async (req, res) => {
  const { key, hwid } = req.body;

  if (!key || !hwid) {
    return res.status(400).json({ success: false, message: 'Thiếu Key hoặc HWID!' });
  }

  try {
    const keyData = await KeyModel.findOne({ key });

    if (!keyData) {
      return res.status(404).json({ success: false, message: 'Key không tồn tại!' });
    }

    // Lần đầu sử dụng -> Gán HWID cho Key
    if (!keyData.hwid) {
      keyData.hwid = hwid;
      await keyData.save();
      return res.json({ 
        success: true, 
        message: 'Kích hoạt Key thành công trên máy này!',
        instructions: 'Nội dung hướng dẫn chi tiết dành cho khách hàng đã mua UI...' 
      });
    }

    // Đã có HWID -> So sánh với HWID gửi lên
    if (keyData.hwid === hwid) {
      return res.json({ 
        success: true, 
        message: 'Xác thực thành công!',
        instructions: 'Nội dung hướng dẫn chi tiết dành cho khách hàng đã mua UI...' 
      });
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Key này đã được đăng ký cho thiết bị khác! Không thể truy cập.' 
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
