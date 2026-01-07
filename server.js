const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, '留言web', 'data.json');

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 支持大图片
app.use(express.static('留言web')); // 静态文件服务

// 读取数据
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取数据失败:', error);
        return { messages: [], folders: [] };
    }
}

// 写入数据
async function writeData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('写入数据失败:', error);
        return false;
    }
}

// API 路由

// 获取所有数据
app.get('/api/data', async (req, res) => {
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 保存所有数据
app.post('/api/data', async (req, res) => {
    try {
        const success = await writeData(req.body);
        if (success) {
            res.json({ success: true, message: '数据保存成功' });
        } else {
            res.status(500).json({ error: '数据保存失败' });
        }
    } catch (error) {
        res.status(500).json({ error: '数据保存失败' });
    }
});

// 添加留言
app.post('/api/messages', async (req, res) => {
    try {
        const data = await readData();
        const newMessage = req.body;
        data.messages.push(newMessage);
        const success = await writeData(data);
        if (success) {
            // 实时广播新留言到所有连接的客户端
            io.emit('newMessage', newMessage);
            res.json({ success: true, message: newMessage });
        } else {
            res.status(500).json({ error: '添加留言失败' });
        }
    } catch (error) {
        res.status(500).json({ error: '添加留言失败' });
    }
});

// 删除留言
app.delete('/api/messages/:id', async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const data = await readData();
        data.messages = data.messages.filter(msg => msg.id !== messageId);
        const success = await writeData(data);
        if (success) {
            // 广播删除事件
            io.emit('deleteMessage', messageId);
            res.json({ success: true, message: '删除成功' });
        } else {
            res.status(500).json({ error: '删除留言失败' });
        }
    } catch (error) {
        res.status(500).json({ error: '删除留言失败' });
    }
});

// 更新留言
app.put('/api/messages/:id', async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const data = await readData();
        const index = data.messages.findIndex(msg => msg.id === messageId);
        if (index !== -1) {
            data.messages[index] = { ...data.messages[index], ...req.body };
            const success = await writeData(data);
            if (success) {
                // 广播更新事件
                io.emit('updateMessage', data.messages[index]);
                res.json({ success: true, message: data.messages[index] });
            } else {
                res.status(500).json({ error: '更新留言失败' });
            }
        } else {
            res.status(404).json({ error: '留言不存在' });
        }
    } catch (error) {
        res.status(500).json({ error: '更新留言失败' });
    }
});

// 添加文件夹
app.post('/api/folders', async (req, res) => {
    try {
        const data = await readData();
        const newFolder = req.body;
        data.folders.push(newFolder);
        const success = await writeData(data);
        if (success) {
            // 广播新文件夹
            io.emit('newFolder', newFolder);
            res.json({ success: true, folder: newFolder });
        } else {
            res.status(500).json({ error: '添加文件夹失败' });
        }
    } catch (error) {
        res.status(500).json({ error: '添加文件夹失败' });
    }
});

// 删除文件夹
app.delete('/api/folders/:id', async (req, res) => {
    try {
        const folderId = parseInt(req.params.id);
        const data = await readData();
        data.folders = data.folders.filter(f => f.id !== folderId);
        data.messages = data.messages.filter(msg => msg.folderId !== folderId);
        const success = await writeData(data);
        if (success) {
            // 广播删除文件夹事件
            io.emit('deleteFolder', folderId);
            res.json({ success: true, message: '删除成功' });
        } else {
            res.status(500).json({ error: '删除文件夹失败' });
        }
    } catch (error) {
        res.status(500).json({ error: '删除文件夹失败' });
    }
});

// 更新文件夹
app.put('/api/folders/:id', async (req, res) => {
    try {
        const folderId = parseInt(req.params.id);
        const data = await readData();
        const index = data.folders.findIndex(f => f.id === folderId);
        if (index !== -1) {
            data.folders[index] = { ...data.folders[index], ...req.body };
            const success = await writeData(data);
            if (success) {
                res.json({ success: true, folder: data.folders[index] });
            } else {
                res.status(500).json({ error: '更新文件夹失败' });
            }
        } else {
            res.status(404).json({ error: '文件夹不存在' });
        }
    } catch (error) {
        res.status(500).json({ error: '更新文件夹失败' });
    }
});

// WebSocket 连接管理
io.on('connection', (socket) => {
    console.log('🔌 新用户连接:', socket.id);
    
    // 用户断开连接
    socket.on('disconnect', () => {
        console.log('❌ 用户断开:', socket.id);
    });
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器已启动在端口 ${PORT}`);
    console.log(`📝 访问留言板`);
    console.log(`📊 数据文件: ${DATA_FILE}`);
    console.log(`🔌 WebSocket 实时通信已启用`);
});
