// 获取DOM元素
const messageInput = document.getElementById('messageInput');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const submitBtn = document.getElementById('submitBtn');
const messagesContainer = document.getElementById('messagesContainer');
const foldersList = document.getElementById('foldersList');
const createFolderBtn = document.getElementById('createFolderBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// 状态管理
let currentFolder = null;
let currentFolderLocked = false;
let draggedMessage = null;

// 分页状态
let currentPage = 0;
let itemsPerPage = 0;
let totalPages = 0;

// 便利贴颜色数组
const noteColors = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'];

let selectedImage = null;
let draggedElement = null;

// API 基础URL
const API_BASE_URL = window.location.origin;

// 初始化 Socket.IO 连接
const socket = io(API_BASE_URL);

// Socket.IO 连接状态
socket.on('connect', () => {
    console.log('✅ 实时连接已建立');
});

socket.on('disconnect', () => {
    console.log('❌ 实时连接已断开');
});

// 监听新留言事件
socket.on('newMessage', async (message) => {
    console.log('📩 收到新留言:', message);
    // 只在相同文件夹时才刷新
    if (message.folderId === currentFolder || (!message.folderId && !currentFolder)) {
        await loadMessages();
        await loadFolders();
    }
});

// 监听删除留言事件
socket.on('deleteMessage', async (messageId) => {
    console.log('🗑️ 留言被删除:', messageId);
    await loadMessages();
    await loadFolders();
});

// 监听更新留言事件
socket.on('updateMessage', async (message) => {
    console.log('🔄 留言已更新:', message);
    await loadMessages();
});

// 监听新文件夹事件
socket.on('newFolder', async (folder) => {
    console.log('📁 新文件夹创建:', folder);
    await loadFolders();
});

// 监听删除文件夹事件
socket.on('deleteFolder', async (folderId) => {
    console.log('🗑️ 文件夹被删除:', folderId);
    await loadFolders();
    await loadMessages();
});

// 获取所有数据（包括留言和文件夹）
async function getAllData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data`);
        if (!response.ok) throw new Error('获取数据失败');
        return await response.json();
    } catch (error) {
        console.error('获取数据失败:', error);
        return { messages: [], folders: [] };
    }
}

// 保存所有数据
async function saveAllData(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('保存数据失败');
        return await response.json();
    } catch (error) {
        console.error('保存数据失败:', error);
        return { success: false };
    }
}

// 加载留言
async function loadMessages() {
    const { messages, folders } = await getAllData();
    messagesContainer.innerHTML = '';
    
    // 在公开文件夹显示公告
    if (!currentFolder) {
        messagesContainer.innerHTML = `
            <div class="announcement">
                <div class="announcement-content">
                    <p>僅測試</p>
                </div>
            </div>
        `;
    }
    
    // 过滤当前文件夹的留言
    const filteredMessages = messages.filter(msg => {
        if (!currentFolder) {
            // 未选择文件夹时显示所有未分类留言
            return !msg.folderId;
        }
        // 选择文件夹时显示该文件夹内的留言
        return msg.folderId === currentFolder;
    });
    
    // 按时间倒序显示（最新的在前）
    const sortedMessages = [...filteredMessages].sort((a, b) => b.id - a.id);
    
    if (sortedMessages.length === 0) {
        const folder = folders.find(f => f.id === currentFolder);
        if (!currentFolder) {
            // 公开文件夹有公告时不显示空提示
            return;
        }
        messagesContainer.innerHTML += `<div class="empty-message">${folder ? folder.name : '公开'}文件夹中还没有留言，快来第一个留言吧！</div>`;
        return;
    }
    
    // 将排序后的留言列表传递给displayMessage，确保索引计算基于排序后的列表
    sortedMessages.forEach((message, index) => {
        // 将排序后的索引和完整列表传递给displayMessage
        displayMessage(message, index, sortedMessages);
    });
}



// 创建文件夹
async function createFolder() {
    const folderName = prompt('请输入文件夹名称：');
    if (!folderName || folderName.trim() === '') {
        return;
    }
    
    const usePassword = confirm('是否为该文件夹设置密码？');
    let password = null;
    if (usePassword) {
        password = prompt('请输入文件夹密码：');
        if (!password || password.trim() === '') {
            alert('密码不能为空，文件夹将不设密码');
            password = null;
        }
    }
    
    const data = await getAllData();
    const newFolder = {
        id: Date.now(),
        name: folderName.trim(),
        createdAt: new Date().toLocaleString('zh-CN'),
        password: password,
        isLocked: password !== null
    };
    
    data.folders.push(newFolder);
    await saveAllData(data);
    await loadFolders();
}

// 删除文件夹
window.deleteFolder = async function(folderId) {
    const { folders, messages } = await getAllData();
    const folder = folders.find(f => f.id === folderId);
    
    if (!folder) return;
    
    // 如果文件夹有密码，需要验证密码
    if (folder.isLocked) {
        const password = prompt('请输入文件夹密码以确认删除：');
        if (password !== folder.password) {
            alert('密码错误，无法删除该文件夹');
            return;
        }
    }
    
    if (confirm('确定要删除该文件夹吗？文件夹内的留言也将被删除。')) {
        // 删除文件夹
        const updatedFolders = folders.filter(f => f.id !== folderId);
        
        // 直接删除文件夹内的留言
        const updatedMessages = messages.filter(msg => msg.folderId !== folderId);
        
        await saveAllData({ messages: updatedMessages, folders: updatedFolders });
        
        // 如果当前文件夹被删除，切换到未分类
        if (currentFolder === folderId) {
            currentFolder = null;
        }
        
        await loadFolders();
        await loadMessages();
    }
};

// 重命名文件夹
window.renameFolder = async function(folderId) {
    const data = await getAllData();
    const folder = data.folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const newName = prompt('请输入新的文件夹名称：', folder.name);
    if (!newName || newName.trim() === '') {
        return;
    }
    
    const updatedFolders = data.folders.map(f => {
        if (f.id === folderId) {
            return { ...f, name: newName.trim() };
        }
        return f;
    });
    
    await saveAllData({ ...data, folders: updatedFolders });
    await loadFolders();
};

// 切换文件夹
async function switchFolder(folderId) {
    currentFolder = folderId;
    
    // 检查当前文件夹是否有密码
    const { folders } = await getAllData();
    if (folderId) {
        const folder = folders.find(f => f.id === folderId);
        currentFolderLocked = folder ? folder.isLocked : false;
    } else {
        currentFolderLocked = false;
    }
    
    await loadFolders();
    await loadMessages();
}

// 删除留言
window.deleteMessage = async function(messageId) {
    if (confirm('确定要删除这条留言吗？')) {
        const data = await getAllData();
        const filteredMessages = data.messages.filter(msg => msg.id !== messageId);
        await saveAllData({ ...data, messages: filteredMessages });
        
        // 重新加载留言和文件夹计数
        await loadMessages();
        await loadFolders();
    }
};

// 公开留言
window.makeMessagePublic = async function(messageId) {
    const { messages } = await getAllData();
    const message = messages.find(msg => msg.id === messageId);
    if (message) {
        const confirmPublic = confirm('确定要将这条留言公开到公开文件夹吗？');
        if (confirmPublic) {
            await moveMessageToFolder(messageId, null);
        }
    }
};

// 添加评论
async function addComment(messageId, commentText) {
    const text = commentText.trim();
    if (!text) {
        alert('请输入评论内容');
        return;
    }
    
    const data = await getAllData();
    const updatedMessages = data.messages.map(msg => {
        if (msg.id === messageId) {
            // 确保comments数组存在
            const comments = msg.comments || [];
            return {
                ...msg,
                comments: [
                    ...comments,
                    {
                        id: Date.now(),
                        text: text,
                        time: new Date().toLocaleString('zh-CN')
                    }
                ]
            };
        }
        return msg;
    });
    
    await saveAllData({ ...data, messages: updatedMessages });
    
    // 重新加载留言，更新显示
    await loadMessages();
    
    // 清空输入框
    const input = document.querySelector(`[onkeypress*="addComment(${messageId}"]`);
    if (input) {
        input.value = '';
    }
}

// 保存留言位置和文件夹信息
async function saveMessagePosition(messageId, x, y, rotation) {
    const data = await getAllData();
    const updatedMessages = data.messages.map(msg => {
        if (msg.id === messageId) {
            return {
                ...msg,
                position: { x, y, rotation }
            };
        }
        return msg;
    });
    await saveAllData({ ...data, messages: updatedMessages });
}

// 移动留言到文件夹
async function moveMessageToFolder(messageId, folderId) {
    const data = await getAllData();
    const updatedMessages = data.messages.map(msg => {
        if (msg.id === messageId) {
            return {
                ...msg,
                folderId: folderId || null
            };
        }
        return msg;
    });
    await saveAllData({ ...data, messages: updatedMessages });
    await loadMessages();
    await loadFolders();
}

// 显示单条留言
function displayMessage(message, sortedIndex, sortedMessages) {
    const messageDiv = document.createElement('div');
    // 应用颜色类，默认使用黄色
    const color = message.color || noteColors[Math.floor(Math.random() * noteColors.length)];
    // 设置初始类名，包含展开状态
    const expandedClass = message.expanded ? ' expanded' : '';
    messageDiv.className = `message-item ${color} ${currentFolder ? 'in-folder' : ''}${expandedClass}`;
    messageDiv.setAttribute('data-id', message.id);
    messageDiv.setAttribute('data-folder-id', message.folderId || '');
    
    let html = `<div class="message-header">
                    <button class="delete-btn" onclick="deleteMessage(${message.id})" title="删除留言">×</button>`;
    
    // 如果是在私密文件夹中，添加公开按钮
    if (currentFolder) {
        html += `<button class="public-btn" onclick="makeMessagePublic(${message.id})" title="公开留言">📤</button>`;
    }
    
    html += `</div>`;
    html += `<div class="message-content">${escapeHtml(message.text)}</div>`;
    
    if (message.image) {
        html += `<div class="message-image"><img src="${message.image}" alt="留言图片"></div>`;
    }
    
    html += `<div class="message-time">${message.time}</div>`;
    
    // 初始化comments数组，确保现有留言也能正常显示
    message.comments = message.comments || [];
    
    // 评论部分
    html += `<div class="comments-section">`;
    
    // 评论列表
    if (message.comments.length > 0) {
        html += `<div class="comments-list">`;
        message.comments.forEach(comment => {
            html += `<div class="comment-item">
                        <div class="comment-content">${escapeHtml(comment.text)}</div>
                        <div class="comment-time">${comment.time}</div>
                    </div>`;
        });
        html += `</div>`;
    }
    
    // 评论输入区域
    html += `<div class="comment-input-section">
                <input type="text" 
                       class="comment-input" 
                       placeholder="添加评论..." 
                       onkeypress="if(event.key==='Enter') addComment(${message.id}, this.value)">
                <button class="comment-btn" onclick="addComment(${message.id}, this.previousElementSibling.value)">发送</button>
            </div>`;
    
    html += `</div>`;
    
    messageDiv.innerHTML = html;
    
    // 所有文件夹中的留言都使用绝对定位
    messageDiv.style.position = 'absolute';
    
    let position;
    
    // 直接使用传递过来的sortedIndex参数，确保留言按照排序后的顺序生成
    // 如果没有传递sortedIndex（例如从其他地方调用），则使用原有逻辑
    const currentIndex = sortedIndex !== undefined ? sortedIndex : (
        // 原有逻辑作为 fallback
        (() => {
            const { messages } = getAllData();
            const folderMessages = messages.filter(msg => msg.folderId === currentFolder);
            const sortedFolderMessages = [...folderMessages].sort((a, b) => b.id - a.id);
            return sortedFolderMessages.findIndex(msg => msg.id === message.id);
        })()
    );
    
    // 设置九宫格排列参数（响应式）
    const isMobile = window.innerWidth <= 768;
    const itemWidth = isMobile ? 40 : 120; // 留言展开前的宽度
    const itemHeight = isMobile ? 40 : 120; // 留言展开前的高度
    const gap = isMobile ? 15 : 20; // 留言间距
    const columns = isMobile ? 5 : 3; // 手机5列，PC 3列
    
    // 计算行列位置：根据排序后的索引计算，确保从左到右、从上到下生成
    const row = Math.floor(currentIndex / columns);
    const col = currentIndex % columns;
    
    // 基础Y坐标：如果是公开文件夹，在公告下方10px显示
    const baseY = currentFolder ? 20 : (isMobile ? 80 : 120); // 公开文件夹从公告下方显示
    
    // 计算坐标
    position = message.position || {
        x: col * (itemWidth + gap) + (isMobile ? 10 : 20), // 容器内边距
        y: row * (itemHeight + gap) + baseY, // 基础Y坐标
        rotation: 0 // 不旋转
    };
    
    messageDiv.style.left = `${position.x}px`;
    messageDiv.style.top = `${position.y}px`;
    messageDiv.style.setProperty('--rotation', `${position.rotation}deg`);
    
    messagesContainer.appendChild(messageDiv);
    
    // 添加拖拽和点击事件
    initMessageEvents(messageDiv);
}



// 初始化留言事件
function initMessageEvents(element) {
    // 添加点击事件处理
    element.addEventListener('click', function(e) {
        // 点击删除或公开按钮时不触发其他点击事件
        if (e.target.closest('.delete-btn') || e.target.closest('.public-btn') || e.target.closest('.comment-btn') || e.target.closest('.comment-input')) {
            return;
        }
        
        // 有密码的文件夹内的留言不能点击交互
        if (currentFolderLocked) {
            return;
        }
        
        // 切换展开/收起状态
        element.classList.toggle('expanded');
        
        // 保存展开状态到服务器
        const messageId = parseInt(element.getAttribute('data-id'));
        getAllData().then(data => {
            const updatedMessages = data.messages.map(msg => {
                if (msg.id === messageId) {
                    return { ...msg, expanded: element.classList.contains('expanded') };
                }
                return msg;
            });
            saveAllData({ ...data, messages: updatedMessages });
        });
    });
    
    // 只有非密码文件夹中的留言才添加拖拽事件处理
    if (!currentFolderLocked) {
        // 鼠标拖拽事件
        element.addEventListener('mousedown', function(e) {
            // 点击删除或公开按钮时不触发拖拽
            if (e.target.closest('.delete-btn') || e.target.closest('.public-btn') || e.target.closest('.comment-btn') || e.target.closest('.comment-input')) {
                return;
            }
            
            startDrag(e, e.clientX, e.clientY);
        });
        
        // 触摸拖拽事件（手机支持）
        element.addEventListener('touchstart', function(e) {
            // 点击删除或公开按钮时不触发拖拽
            if (e.target.closest('.delete-btn') || e.target.closest('.public-btn') || e.target.closest('.comment-btn') || e.target.closest('.comment-input')) {
                return;
            }
            
            const touch = e.touches[0];
            startDrag(e, touch.clientX, touch.clientY);
        }, { passive: false });
    }
    
    function startDrag(e, clientX, clientY) {
        draggedElement = element;
        const messageId = parseInt(element.getAttribute('data-id'));
        draggedMessage = messageId;
        
        const rect = element.getBoundingClientRect();
        const containerRect = messagesContainer.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;
        
        // 开始拖拽，直接移除展开状态
        element.classList.remove('expanded');
        element.classList.remove('minimized');
        element.classList.add('dragging');
        
        // 记录初始位置，用于边界检测
        const initialLeft = parseInt(element.style.left) || 0;
        const initialTop = parseInt(element.style.top) || 0;
        
        // 计算拖拽限制范围：生成位置周围100px正方形
        const dragLimit = 100;
        const minX = initialLeft - dragLimit / 2;
        const maxX = initialLeft + dragLimit / 2;
        const minY = initialTop - dragLimit / 2;
        const maxY = initialTop + dragLimit / 2;
        
        // 优化性能：只在必要时更新DOM
        function onDragMove(e) {
            if (!draggedElement) return;
            
            e.preventDefault(); // 阻止默认触摸行为
            
            // 获取坐标（支持触摸和鼠标）
            const moveClientX = e.touches ? e.touches[0].clientX : e.clientX;
            const moveClientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // 获取容器位置和尺寸
            const containerRect = messagesContainer.getBoundingClientRect();
            
            // 计算相对于容器的坐标
            let relativeX = moveClientX - containerRect.left - offsetX;
            let relativeY = moveClientY - containerRect.top - offsetY;
            
            // 限制拖拽范围在生成位置周围100px正方形内
            relativeX = Math.max(minX, Math.min(maxX, relativeX));
            relativeY = Math.max(minY, Math.min(maxY, relativeY));
            
            // 额外限制：确保不超出容器边界（留出一些边距）
            const margin = 20;
            relativeX = Math.max(margin, Math.min(containerRect.width - 150, relativeX));
            relativeY = Math.max(margin, Math.min(containerRect.height - 150, relativeY));
            
            // 优化：使用requestAnimationFrame更新位置，提高流畅度
            if (!onDragMove.rafId) {
                onDragMove.rafId = requestAnimationFrame(() => {
                    // 更新元素位置
                    draggedElement.style.position = 'absolute';
                    draggedElement.style.left = `${relativeX}px`;
                    draggedElement.style.top = `${relativeY}px`;
                    draggedElement.style.zIndex = '1000';
                    draggedElement.style.opacity = '0.95';
                    onDragMove.rafId = null;
                });
            }
        }
        
        async function onDragEnd(e) {
            if (!draggedElement || !draggedMessage) return;
            
            // 取消任何待处理的动画帧
            if (onDragMove.rafId) {
                cancelAnimationFrame(onDragMove.rafId);
                onDragMove.rafId = null;
            }
            
            // 获取坐标（支持触摸和鼠标）
            const endClientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const endClientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            
            // 检查是否拖拽到了某个文件夹
            const folderElements = document.querySelectorAll('.folder-item');
            let targetFolderId = null;
            
            for (const folderElement of folderElements) {
                const rect = folderElement.getBoundingClientRect();
                if (endClientX >= rect.left && endClientX <= rect.right &&
                    endClientY >= rect.top && endClientY <= rect.bottom) {
                    // 获取目标文件夹ID（空字符串表示未分类）
                    targetFolderId = folderElement.getAttribute('data-folder-id');
                    targetFolderId = targetFolderId === '' ? null : parseInt(targetFolderId);
                    break;
                }
            }
            
            if (targetFolderId !== null || targetFolderId === null) {
                // 检查是否拖拽到了不同的文件夹
                const data = await getAllData();
                const message = data.messages.find(msg => msg.id === draggedMessage);
                if (message && message.folderId !== targetFolderId) {
                    // 移动到目标文件夹
                    await moveMessageToFolder(draggedMessage, targetFolderId);
                } else {
                    // 拖拽结束后恢复到初始位置
                    draggedElement.style.transition = 'all 0.3s ease';
                    draggedElement.style.left = `${initialLeft}px`;
                    draggedElement.style.top = `${initialTop}px`;
                    draggedElement.style.opacity = '1';
                    
                    // 移除过渡动画
                    setTimeout(() => {
                        draggedElement.style.transition = '';
                    }, 300);
                }
            }
            
            // 重置拖拽状态
            draggedElement.classList.remove('dragging');
            // 保持绝对定位，只重置临时样式
            draggedElement.style.zIndex = '';
            draggedElement.style.opacity = '';
            
            draggedElement = null;
            draggedMessage = null;
            
            // 移除事件监听器（支持触摸和鼠标）
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.removeEventListener('touchmove', onDragMove);
            document.removeEventListener('touchend', onDragEnd);
        }
        
        // 添加事件监听器（支持触摸和鼠标）
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);
    }
}

// HTML转义，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 图片预览
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            imageInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImage = e.target.result;
            imagePreview.innerHTML = `
                <img src="${selectedImage}" alt="预览">
                <button class="remove-image" onclick="removeImage()">移除图片</button>
            `;
            imagePreview.classList.add('show');
        };
        reader.readAsDataURL(file);
    }
});



// 移除图片
window.removeImage = function() {
    selectedImage = null;
    imageInput.value = '';
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('show');
};

// 提交留言
submitBtn.addEventListener('click', async function() {
    const text = messageInput.value.trim();
    
    if (!text && !selectedImage) {
        alert('请输入留言内容或上传图片');
        return;
    }
    
    let messagePosition;
    const data = await getAllData();
    
    // 如果是私密文件夹（currentFolder存在），按照九宫格样式从左到右、从上到下排列
    if (currentFolder) {
        // 计算当前文件夹中的留言数量
        const folderMessages = data.messages.filter(msg => msg.folderId === currentFolder);
        const currentIndex = folderMessages.length; // 新留言是最后一个
        
        // 设置九宫格排列参数（响应式）
        const isMobile = window.innerWidth <= 768;
        const itemWidth = isMobile ? 40 : 120; // 留言展开前的宽度
        const itemHeight = isMobile ? 40 : 120; // 留言展开前的高度
        const gap = isMobile ? 15 : 20; // 留言间距
        const columns = isMobile ? 5 : 3; // 手机5列，PC 3列
        
        // 计算行列位置
        const row = Math.floor(currentIndex / columns);
        const col = currentIndex % columns;
        
        // 计算坐标
        messagePosition = {
            x: col * (itemWidth + gap) + (isMobile ? 10 : 20), // 容器内边距
            y: row * (itemHeight + gap) + (isMobile ? 10 : 20), // 容器内边距
            rotation: 0 // 不旋转
        };
    } else {
        // 公开文件夹中的留言使用九宫格布局
        const publicMessages = data.messages.filter(msg => !msg.folderId);
        const currentIndex = publicMessages.length; // 新留言是最后一个
        
        const isMobile = window.innerWidth <= 768;
        const itemWidth = isMobile ? 40 : 120;
        const itemHeight = isMobile ? 40 : 120;
        const gap = isMobile ? 15 : 20;
        const columns = isMobile ? 5 : 3;
        
        const row = Math.floor(currentIndex / columns);
        const col = currentIndex % columns;
        const baseY = isMobile ? 80 : 120; // 在公告下方
        
        messagePosition = {
            x: col * (itemWidth + gap) + (isMobile ? 10 : 20),
            y: row * (itemHeight + gap) + baseY,
            rotation: 0
        };
    }
    
    const message = {
        id: Date.now(),
        text: text || '',
        image: selectedImage || null,
        time: new Date().toLocaleString('zh-CN'),
        color: noteColors[Math.floor(Math.random() * noteColors.length)],
        folderId: currentFolder,
        comments: [],
        position: messagePosition
    };
    
    // 保存到服务器
    data.messages.push(message);
    await saveAllData(data);
    
    // 清空表单
    messageInput.value = '';
    removeImage();
    
    // 重新加载留言和文件夹计数
    await loadMessages();
    await loadFolders();
    
    // 滚动到留言框
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

// 添加文件夹创建按钮事件监听
createFolderBtn.addEventListener('click', createFolder);

// 计算每页显示的文件夹数量
function calculateItemsPerPage() {
    const containerWidth = foldersList.parentElement.offsetWidth;
    const folderWidth = 150; // 每个文件夹的宽度（130px + 20px间隙）
    return Math.floor((containerWidth - 30) / folderWidth); // 30是容器的padding
}

// 更新分页状态和UI
async function updatePagination() {
    const { folders } = await getAllData();
    itemsPerPage = calculateItemsPerPage();
    totalPages = Math.ceil((folders.length + 1) / itemsPerPage); // +1 包含公开文件夹
    
    // 更新按钮状态
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
    
    // 计算偏移量并应用过渡效果
    const offset = -currentPage * itemsPerPage * 150; // 150是每个文件夹的宽度（130px + 20px间隙）
    foldersList.style.transform = `translateX(${offset}px)`;
}

// 切换到指定页面
function changePage(page) {
    if (page >= 0 && page < totalPages) {
        currentPage = page;
        updatePagination();
    }
}

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', async function() {
    await loadFolders();
    await loadMessages();
    await updatePagination();
});

// 文件夹列表加载完成后更新分页
async function loadFolders() {
    const { folders, messages } = await getAllData();
    foldersList.innerHTML = '';
    
    // 添加公开文件夹选项
    const uncategorizedItem = document.createElement('div');
    uncategorizedItem.className = `folder-item ${currentFolder === null ? 'active' : ''}`;
    uncategorizedItem.setAttribute('data-folder-id', '');
    
    const uncategorizedCount = messages.filter(msg => !msg.folderId).length;
    uncategorizedItem.innerHTML = `
        <div class="folder-name">公开文件夹</div>
        <div class="folder-count">${uncategorizedCount} 条留言</div>
    `;
    
    uncategorizedItem.addEventListener('click', async () => {
        await switchFolder(null);
    });
    
    foldersList.appendChild(uncategorizedItem);
    
    // 添加普通文件夹
    folders.forEach(folder => {
        const folderItem = document.createElement('div');
        folderItem.className = `folder-item ${currentFolder === folder.id ? 'active' : ''}`;
        folderItem.setAttribute('data-folder-id', folder.id);
        
        folderItem.innerHTML = `
            <div class="folder-name">
                ${folder.isLocked ? '🔒 ' : ''}${escapeHtml(folder.name)}
            </div>
            <div class="folder-actions">
                <button class="rename-btn" onclick="renameFolder(${folder.id})" title="重命名文件夹">✏️</button>
                <button class="delete-btn" onclick="deleteFolder(${folder.id})" title="删除文件夹">🗑️</button>
            </div>
        `;
        
        folderItem.addEventListener('click', async (e) => {
            // 点击操作按钮时不切换文件夹
            if (!e.target.closest('.folder-actions')) {
                if (folder.isLocked) {
                    // 需要密码验证
                    const password = prompt('请输入文件夹密码：');
                    if (password === folder.password) {
                        await switchFolder(folder.id);
                    } else {
                        alert('密码错误，无法进入该文件夹');
                    }
                } else {
                    // 无需密码直接进入
                    await switchFolder(folder.id);
                }
            }
        });
        
        foldersList.appendChild(folderItem);
    });
    
    // 加载完成后更新分页
    await updatePagination();
}

// 窗口大小变化时重新计算分页
window.addEventListener('resize', async function() {
    await updatePagination();
    // 重新加载留言以适应新的屏幕尺寸
    await loadMessages();
});

// 翻页按钮事件监听
prevBtn.addEventListener('click', function() {
    changePage(currentPage - 1);
});

nextBtn.addEventListener('click', function() {
    changePage(currentPage + 1);
});


