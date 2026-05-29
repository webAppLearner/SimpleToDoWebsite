const todoView = document.getElementById('todo-view');
const chatView = document.getElementById('chat-view');
const mainInput = document.getElementById('main-input');
const taskList = document.getElementById('task-list');
const submitBtn = document.getElementById('submit-btn');

let socket = null;
let messageCount = 0;

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
        triggerNotificationCheck();
    });

    socket.on('typing', () => {
        const ind = document.getElementById('typing-indicator');
        ind.classList.remove('hidden');
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => ind.classList.add('hidden'), 1500);
    });
}

const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

sendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    socket.emit('typing');
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    socket.emit('sendMessage', msg);
    renderMessage(msg, 'sent');
    chatInput.value = '';
    triggerNotificationCheck();
}

function renderMessage(msg, type) {
    const div = document.createElement('div');
    div.classList.add('message', type);
    div.textContent = msg;
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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