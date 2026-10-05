const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('chuoi_bi_mat_ma_hoa_cookie'));

// Kết nối Database trên Render (DATABASE_URL đặt trong Environment Variables)
mongoose.connect(process.env.DATABASE_URL);

// Cấu trúc Lưu trữ Key
const KeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date }
});
const KeyModel = mongoose.model('Key', KeySchema);

// API 1: Xử lý Kích hoạt Key 1 lần
app.post('/api/verify-key', async (req, res) => {
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
            return res.json({ success: false, message: 'Key này đã được sử dụng rồi!' });
        }

        // Đánh dấu Key đã dùng ngay lập tức
        foundKey.isUsed = true;
        foundKey.usedAt = new Date();
        await foundKey.save();

        // Lưu Cookie xác thực cho trình duyệt người mua (hạn 30 ngày)
        res.cookie('nova_access', 'granted', {
            signed: true,
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true
        });

        return res.json({ success: true, message: 'Kích hoạt thành công!' });

    } catch (err) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ!' });
    }
});

// API 2: Kiểm tra trạng thái đã nhập Key chưa khi tải trang
app.get('/api/check-auth', (req, res) => {
    if (req.signedCookies.nova_access === 'granted') {
        return res.json({ authenticated: true });
    }
    return res.json({ authenticated: false });
});

// API 3: Dành cho Admin tạo Key mới
app.post('/api/admin/create-key', async (req, res) => {
    const { adminSecret, key } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ success: false, message: 'Không có quyền Admin!' });
    }

    try {
        await KeyModel.create({ key });
        return res.json({ success: true, message: `Đã tạo Key: ${key}` });
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Key đã tồn tại hoặc lỗi!' });
    }
});

// Trả về file HTML chính
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
