# 🚀 Railway 部署教程

## 第一步：上传更新的文件到 GitHub

### 需要上传的文件：
1. `server.js` - 已添加 WebSocket 支持
2. `package.json` - 已添加 socket.io 依赖
3. `package-lock.json` - 依赖锁定文件
4. `留言web/index.html` - 已添加 Socket.IO 客户端
5. `留言web/script.js` - 已添加实时监听功能
6. `railway.json` - Railway 配置文件（新建）

### 上传方式：

**方式1：通过 GitHub 网页**
1. 进入你的 GitHub 仓库：https://github.com/Angekomaomao/Angekomaomao.github.Io
2. 对于每个文件：
   - 点击文件名
   - 点击编辑按钮（铅笔图标）
   - 复制粘贴本地文件内容
   - 点击 "Commit changes"

**方式2：使用 Git 命令**
```bash
cd c:\Users\HW\Desktop\留言web
git add .
git commit -m "添加WebSocket实时同步功能和Railway配置"
git push origin main
```

---

## 第二步：部署到 Railway

### 1. 访问 Railway 官网
🔗 https://railway.app

### 2. 注册/登录
- 点击右上角 **"Login"**
- 选择 **"Login with GitHub"**
- 授权 Railway 访问你的 GitHub

### 3. 创建新项目
1. 登录后，点击 **"New Project"**
2. 选择 **"Deploy from GitHub repo"**
3. 在列表中找到：`Angekomaomao/Angekomaomao.github.Io`
4. 点击 **"Deploy Now"**

### 4. 等待部署
- Railway 会自动：
  - ✅ 检测 Node.js 项目
  - ✅ 运行 `npm install`
  - ✅ 启动 `node server.js`
  - ✅ 分配域名
- 等待 3-5 分钟

### 5. 生成公开域名
1. 部署完成后，点击项目
2. 点击 **"Settings"** 标签
3. 找到 **"Networking"** 或 **"Domains"** 部分
4. 点击 **"Generate Domain"**
5. 会生成类似：`https://xxx.up.railway.app` 的网址

### 6. 访问测试
- 在浏览器打开生成的网址
- 测试留言功能
- 测试实时同步

---

## 第三步：验证部署

### ✅ 检查项目：
- [ ] 网页能正常打开
- [ ] 可以发布留言
- [ ] 可以上传图片
- [ ] 多个设备实时同步
- [ ] 创建文件夹功能正常

### 🔍 查看日志：
在 Railway 项目页面：
1. 点击 **"Deployments"** 标签
2. 点击最新的部署
3. 点击 **"View Logs"**
4. 应该看到：
   ```
   🚀 服务器已启动在端口 XXXX
   📝 访问留言板
   🔌 WebSocket 实时通信已启用
   ```

---

## 常见问题

### Q1: 部署失败怎么办？
**检查：**
- GitHub 上的 `package.json` 是否包含 `socket.io` 依赖
- `server.js` 是否正确使用了 `server.listen()` 而不是 `app.listen()`

### Q2: 网页打开但功能不正常？
**检查：**
- 浏览器控制台是否有错误
- Railway 日志中是否有错误信息

### Q3: 数据会保存吗？
**注意：**
- Railway 免费版使用临时文件系统
- 重新部署后 `data.json` 会丢失
- 建议升级方案：使用云数据库（MongoDB Atlas / Supabase）

### Q4: 免费额度够用吗？
**Railway 免费版：**
- ✅ 每月 500 小时运行时间（够用）
- ✅ 512MB 内存
- ✅ 1GB 磁盘空间
- ✅ 完全够个人使用

---

## 🎉 部署成功后

### 你将获得：
- ✅ 永久在线的公网地址
- ✅ 电脑关机也能访问
- ✅ 实时同步功能正常
- ✅ 自动 HTTPS 加密
- ✅ 自动从 GitHub 更新

### 后续更新：
1. 修改本地代码
2. 提交到 GitHub
3. Railway 自动检测并重新部署
4. 无需手动操作！

---

**需要帮助？** 
- Railway 文档：https://docs.railway.app
- 或者联系我！
