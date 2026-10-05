const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('bi_mat_session_key')); // Chuỗi bí mật để mã hóa cookie

// 1. Kết nối Database (Lấy DATABASE_URL từ Environment Variables trên Render)
mongoose.connect(process.env.DATABASE_URL);

const KeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const KeyModel = mongoose.model('Key', KeySchema);

// Middleware kiểm tra xem người dùng đã nhập Key thành công chưa
const requireAuth = (req, res, next) => {
    if (req.signedCookies.access_granted) {
        return next(); // Cho phép truy cập nội dung
    }
    res.redirect('/'); // Chưa nhập Key thì đẩy về trang nhập Key
};

// 2. Trang nhập Key (Trang chủ)
app.get('/', (req, res) => {
    if (req.signedCookies.access_granted) {
        return res.redirect('/dashboard'); // Đã nhập key trước đó thì vào thẳng
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. API xử lý khi người dùng bấm Đăng nhập Key
app.post('/api/login', async (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.json({ success: false, message: 'Vui lòng nhập Key!' });
    }

    try {
        const foundKey = await KeyModel.findOne({ key: key.trim() });

        if (!foundKey) {
            return res.json({ success: false, message: 'Key không tồn tại!' });
        }

        if (foundKey.isUsed) {
            return res.json({ success: false, message: 'Key này đã được sử dụng!' });
        }

        // Đánh dấu Key đã sử dụng ngay lập tức
        foundKey.isUsed = true;
        await foundKey.save();

        // Tự động lưu Cookie đăng nhập cho máy này (Ví dụ: có hiệu lực 30 ngày)
        res.cookie('access_granted', 'true', {
            signed: true,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
            httpOnly: true
        });

        return res.json({ success: true, message: 'Xác thực thành công!' });

    } catch (err) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ!' });
    }
});

// 4. Trang nội dung chính (Chỉ vào được sau khi nhập Key thành công)
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// 5. API cho Admin thêm Key mới vào DB
app.post('/api/admin/add-key', async (req, res) => {
    const { adminSecret, newKey } = req.body;
    
    // Đặt password bảo vệ API tạo key của admin
    if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ message: 'Không có quyền!' });
    }

    try {
        await KeyModel.create({ key: newKey });
        res.json({ success: true, message: `Đã tạo Key: ${newKey}` });
    } catch (e) {
        res.json({ success: false, message: 'Key đã tồn tại!' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
