const todoView = document.getElementById('todo-view');
const chatView = document.getElementById('chat-view');
const mainInput = document.getElementById('main-input');
const taskList = document.getElementById('task-list');
const submitBtn = document.getElementById('submit-btn');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

let socket = null;
let messageCount = 0;
let isFirstMessage = true;

window.onload = async () => {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    tasks.forEach(t => renderTask(t.id, t.task));
};

submitBtn.addEventListener('click', handleMainInput);
mainInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleMainInput(); });

async function handleMainInput() {
    const val = mainInput.value.trim();
    if (!val) return;

    mainInput.value = '';

    const res = await fetch('/api/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: val })
    });
    const data = await res.json();

    if (data.action === 'CHAT_ACCESS') {
        activateStealthMode(data.token);
    } else if (data.action === 'TASK_ADDED') {
        renderTask(data.id, data.task);
    }
}

function renderTask(id, taskText) {
    const li = document.createElement('li');
    li.textContent = taskText;

    const delBtn = document.createElement('button');
    delBtn.innerHTML = '✖';
    delBtn.className = 'delete-btn';
    delBtn.onclick = async () => {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        li.remove();
    };

    li.appendChild(delBtn);
    taskList.appendChild(li);
}

function activateStealthMode(token) {
    todoView.classList.add('hidden');
    chatView.classList.remove('hidden');

    socket = io({ auth: { token } });

    socket.on('chatHistory', (history) => {
        history.forEach(item => renderMessage(item.msg, item.type));
    });

    socket.on('receiveMessage', (msg) => {
        renderMessage(msg, 'received');
        if (isFirstMessage) {
            alert("وصلت أول رسالة من الطرف الآخر!");
            isFirstMessage = false;
        }
        triggerNotificationCheck();
    });

    socket.on('typing', () => {
        const ind = document.getElementById('typing-indicator');
        ind.classList.remove('hidden');
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => ind.classList.add('hidden'), 1500);
    });
}

sendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (socket) socket.emit('typing');
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    if (socket) socket.emit('sendMessage', msg);
    renderMessage(msg, 'sent');
    chatInput.value = '';
    triggerNotificationCheck();
}

function renderMessage(content, type) {
    const div = document.createElement('div');
    div.classList.add('message', type);

    if (typeof content === 'string') {
        div.textContent = content;
    } else if (typeof content === 'object') {
        if (content.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = content.data;
            div.appendChild(img);
        } else if (content.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = content.data;
            video.controls = true;
            div.appendChild(video);
        }
    }

    const chatContainer = document.getElementById('chat-messages');
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

if (attachBtn) {
    attachBtn.addEventListener('click', () => {
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (file.size > 10485760) {
            alert("حجم الملف يجب أن يكون أقل من 10MB");
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                name: file.name,
                type: file.type,
                data: e.target.result
            };
            if (socket) socket.emit('sendMessage', fileData);
            renderMessage(fileData, 'sent');
            triggerNotificationCheck();
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
    });
}

function triggerNotificationCheck() {
    messageCount++;
    if (messageCount % 3 === 0) {
        showFakeNotification("تذكير: قم بإنجاز مهامك المعلقة لهذا اليوم.");
    }
}

function showFakeNotification(text) {
    const banner = document.getElementById('notification-banner');
    banner.textContent = text;
    banner.classList.remove('hidden');
    setTimeout(() => {
        banner.classList.add('hidden');
    }, 4000);
}
