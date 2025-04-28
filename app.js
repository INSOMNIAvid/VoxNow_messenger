// Основной файл приложения
document.addEventListener('DOMContentLoaded', function() {
    // Проверка аутентификации
    auth.onAuthStateChanged(user => {
        if (user) {
            // Пользователь вошел в систему
            initApp(user);
        } else {
            // Пользователь не аутентифицирован, перенаправляем на страницу входа
            window.location.href = 'login.html';
        }
    });
});

// Инициализация приложения после аутентификации
function initApp(user) {
    // Загрузка данных пользователя
    loadUserData(user.uid);
    
    // Инициализация UI
    initUI();
    
    // Загрузка чатов, групп и контактов
    loadChats(user.uid);
    loadGroups(user.uid);
    loadContacts(user.uid);
    
    // Установка слушателей событий
    setupEventListeners(user.uid);
}

// Загрузка данных пользователя
function loadUserData(userId) {
    db.collection('users').doc(userId).get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();
            
            // Обновление UI с данными пользователя
            document.getElementById('username-display').textContent = userData.username;
            
            // Загрузка аватарки
            if (userData.avatarUrl) {
                document.getElementById('user-avatar').src = userData.avatarUrl;
            }
            
            // Обновление статуса "в сети"
            updateUserStatus(userId, true);
        }
    });
}

// Обновление статуса пользователя
function updateUserStatus(userId, isOnline) {
    const status = {
        isOnline: isOnline,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('users').doc(userId).update(status);
}

// Инициализация UI
function initUI() {
    // Переключение между вкладками
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Удаляем активный класс у всех кнопок и контента
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке и контенту
            this.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
    
    // Кнопка выхода
    document.getElementById('logout-btn').addEventListener('click', logout);
}

// Выход из системы
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    });
}

// Загрузка чатов пользователя
function loadChats(userId) {
    db.collection('chats')
        .where('participants', 'array-contains', userId)
        .orderBy('lastMessage.timestamp', 'desc')
        .onSnapshot(snapshot => {
            const chatList = document.getElementById('chat-list');
            chatList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const chat = doc.data();
                const otherUserId = chat.participants.find(id => id !== userId);
                
                // Получаем данные другого пользователя
                db.collection('users').doc(otherUserId).get().then(userDoc => {
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const lastMessage = chat.lastMessage || { text: 'Нет сообщений', timestamp: new Date(0) };
                        
                        const chatItem = document.createElement('li');
                        chatItem.innerHTML = `
                            <img class="chat-avatar" src="${userData.avatarUrl || 'images/default-avatar.png'}" alt="${userData.username}">
                            <div class="chat-info">
                                <div class="chat-name">${userData.username}</div>
                                <div class="last-message">${lastMessage.text}</div>
                            </div>
                            ${chat.unreadCount > 0 ? `<div class="unread-count">${chat.unreadCount}</div>` : ''}
                        `;
                        
                        chatItem.addEventListener('click', () => openChat(doc.id, otherUserId, userData.username));
                        chatList.appendChild(chatItem);
                    }
                });
            });
        });
}

// Загрузка групп пользователя
function loadGroups(userId) {
    db.collection('groups')
        .where('members', 'array-contains', userId)
        .orderBy('lastMessage.timestamp', 'desc')
        .onSnapshot(snapshot => {
            const groupList = document.getElementById('group-list');
            groupList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const group = doc.data();
                const lastMessage = group.lastMessage || { text: 'Нет сообщений', timestamp: new Date(0) };
                
                const groupItem = document.createElement('li');
                groupItem.innerHTML = `
                    <img class="group-avatar" src="${group.avatarUrl || 'images/default-avatar.png'}" alt="${group.name}">
                    <div class="group-info">
                        <div class="group-name">${group.name}</div>
                        <div class="group-description">${group.description || ''}</div>
                        <div class="last-message">${lastMessage.text}</div>
                    </div>
                    ${group.unreadCount > 0 ? `<div class="unread-count">${group.unreadCount}</div>` : ''}
                `;
                
                groupItem.addEventListener('click', () => openGroup(doc.id, group.name));
                groupList.appendChild(groupItem);
            });
        });
}

// Загрузка контактов пользователя
function loadContacts(userId) {
    db.collection('users').doc(userId).collection('contacts')
        .onSnapshot(snapshot => {
            const contactList = document.getElementById('contact-list');
            contactList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const contactId = doc.id;
                
                db.collection('users').doc(contactId).get().then(userDoc => {
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        
                        const contactItem = document.createElement('li');
                        contactItem.innerHTML = `
                            <img class="contact-avatar" src="${userData.avatarUrl || 'images/default-avatar.png'}" alt="${userData.username}">
                            <div class="contact-info">
                                <div class="contact-name">${userData.username}</div>
                                <div class="contact-status">
                                    <span class="${userData.isOnline ? 'online' : 'offline'}"></span>
                                    ${userData.isOnline ? 'В сети' : `Был(а) ${formatLastSeen(userData.lastSeen)}`}
                                </div>
                            </div>
                        `;
                        
                        contactItem.addEventListener('click', () => startChatWithContact(contactId, userData.username));
                        contactList.appendChild(contactItem);
                    }
                });
            });
        });
}

// Открытие чата с пользователем
function openChat(chatId, userId, username) {
    document.getElementById('current-chat-name').textContent = username;
    
    // Загрузка информации о пользователе
    db.collection('users').doc(userId).onSnapshot(doc => {
        const userData = doc.data();
        const statusElement = document.getElementById('online-status');
        const lastSeenElement = document.getElementById('last-seen');
        
        if (userData.isOnline) {
            statusElement.className = 'online';
            lastSeenElement.textContent = 'В сети';
        } else {
            statusElement.className = 'offline';
            lastSeenElement.textContent = `Был(а) ${formatLastSeen(userData.lastSeen)}`;
        }
    });
    
    // Загрузка сообщений
    db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';
            
            snapshot.forEach(doc => {
                const message = doc.data();
                displayMessage(message, userId);
            });
            
            // Прокрутка к последнему сообщению
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    
    // Сброс счетчика непрочитанных
    db.collection('chats').doc(chatId).update({
        unreadCount: 0
    });
    
    // Установка обработчика отправки сообщений
    document.getElementById('send-btn').onclick = function() {
        sendMessage(chatId, userId);
    };
}

// Открытие группы
function openGroup(groupId, groupName) {
    document.getElementById('current-chat-name').textContent = groupName;
    
    // Загрузка информации о группе
    db.collection('groups').doc(groupId).get().then(doc => {
        const groupData = doc.data();
        document.getElementById('chat-info').innerHTML = `
            <span>Участников: ${groupData.members.length}</span>
        `;
    });
    
    // Загрузка сообщений группы
    db.collection('groups').doc(groupId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';
            
            snapshot.forEach(doc => {
                const message = doc.data();
                displayGroupMessage(message);
            });
            
            // Прокрутка к последнему сообщению
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    
    // Сброс счетчика непрочитанных
    db.collection('groups').doc(groupId).update({
        unreadCount: 0
    });
    
    // Установка обработчика отправки сообщений
    document.getElementById('send-btn').onclick = function() {
        sendGroupMessage(groupId);
    };
}

// Отображение сообщения
function displayMessage(message, otherUserId) {
    const messagesContainer = document.getElementById('messages');
    const currentUserId = auth.currentUser.uid;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.senderId === currentUserId ? 'outgoing' : 'incoming'}`;
    
    messageElement.innerHTML = `
        <div class="message-text">${message.text}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
}

// Отображение сообщения в группе
function displayGroupMessage(message) {
    const messagesContainer = document.getElementById('messages');
    const currentUserId = auth.currentUser.uid;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.senderId === currentUserId ? 'outgoing' : 'incoming'}`;
    
    // Получаем имя отправителя
    db.collection('users').doc(message.senderId).get().then(doc => {
        const senderName = doc.exists ? doc.data().username : 'Неизвестный';
        
        messageElement.innerHTML = `
            <div class="sender-name">${senderName}</div>
            <div class="message-text">${message.text}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
    });
}

// Отправка сообщения
function sendMessage(chatId, recipientId) {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (text) {
        const currentUserId = auth.currentUser.uid;
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        // Добавление сообщения в подколлекцию
        db.collection('chats').doc(chatId).collection('messages').add({
            text: text,
            senderId: currentUserId,
            timestamp: timestamp
        });
        
        // Обновление информации о последнем сообщении в чате
        db.collection('chats').doc(chatId).update({
            lastMessage: {
                text: text,
                senderId: currentUserId,
                timestamp: timestamp
            },
            unreadCount: firebase.firestore.FieldValue.increment(1)
        });
        
        // Очистка поля ввода
        input.value = '';
    }
}

// Отправка сообщения в группу
function sendGroupMessage(groupId) {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (text) {
        const currentUserId = auth.currentUser.uid;
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        // Добавление сообщения в подколлекцию
        db.collection('groups').doc(groupId).collection('messages').add({
            text: text,
            senderId: currentUserId,
            timestamp: timestamp
        });
        
        // Обновление информации о последнем сообщении в группе
        db.collection('groups').doc(groupId).update({
            lastMessage: {
                text: text,
                senderId: currentUserId,
                timestamp: timestamp
            },
            unreadCount: firebase.firestore.FieldValue.increment(1)
        });
        
        // Очистка поля ввода
        input.value = '';
    }
}

// Начать чат с контактом
function startChatWithContact(contactId, contactName) {
    const currentUserId = auth.currentUser.uid;
    
    // Проверяем, существует ли уже чат с этим пользователем
    db.collection('chats')
        .where('participants', 'array-contains', currentUserId)
        .get()
        .then(snapshot => {
            let chatExists = false;
            let existingChatId = null;
            
            snapshot.forEach(doc => {
                const chat = doc.data();
                if (chat.participants.includes(contactId)) {
                    chatExists = true;
                    existingChatId = doc.id;
                }
            });
            
            if (chatExists) {
                // Открываем существующий чат
                openChat(existingChatId, contactId, contactName);
            } else {
                // Создаем новый чат
                db.collection('chats').add({
                    participants: [currentUserId, contactId],
                    lastMessage: {
                        text: 'Чат создан',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    unreadCount: 0
                }).then(docRef => {
                    openChat(docRef.id, contactId, contactName);
                });
            }
        });
}

// Установка слушателей событий
function setupEventListeners(userId) {
    // Поиск пользователей
    document.getElementById('search-btn').addEventListener('click', searchUsers);
    document.getElementById('user-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchUsers();
        }
    });
    
    // Добавление контакта
    document.getElementById('add-contact-btn').addEventListener('click', function() {
        document.getElementById('add-contact-modal').style.display = 'flex';
    });
    
    document.getElementById('confirm-add-contact').addEventListener('click', addContact);
    
    // Создание группы
    document.getElementById('create-group-btn').addEventListener('click', function() {
        document.getElementById('create-group-modal').style.display = 'flex';
        loadContactsForGroup(userId);
    });
    
    document.getElementById('confirm-create-group').addEventListener('click', createGroup);
    
    // Закрытие модальных окон
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Закрытие модальных окон при клике вне их
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// Поиск пользователей
function searchUsers() {
    const query = document.getElementById('user-search').value.trim();
    
    if (query) {
        // Добавляем @ если его нет
        const searchQuery = query.startsWith('@') ? query.substring(1) : query;
        
        db.collection('users')
            .where('username', '>=', searchQuery)
            .where('username', '<=', searchQuery + '\uf8ff')
            .limit(10)
            .get()
            .then(snapshot => {
                const searchResults = document.createElement('div');
                searchResults.className = 'search-results';
                
                if (snapshot.empty) {
                    searchResults.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
                } else {
                    snapshot.forEach(doc => {
                        const user = doc.data();
                        if (doc.id !== auth.currentUser.uid) { // Исключаем текущего пользователя
                            const userElement = document.createElement('div');
                            userElement.className = 'search-result-item';
                            userElement.innerHTML = `
                                <img src="${user.avatarUrl || 'images/default-avatar.png'}" alt="${user.username}">
                                <span>${user.username}</span>
                                <button class="add-contact-btn" data-user-id="${doc.id}">Добавить</button>
                            `;
                            searchResults.appendChild(userElement);
                        }
                    });
                }
                
                // Вставляем результаты поиска
                const searchBox = document.querySelector('.search-box');
                const existingResults = document.querySelector('.search-results');
                if (existingResults) {
                    searchBox.removeChild(existingResults);
                }
                searchBox.appendChild(searchResults);
                
                // Обработка кнопок "Добавить"
                document.querySelectorAll('.add-contact-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const contactId = this.getAttribute('data-user-id');
                        addContactById(contactId);
                    });
                });
            });
    }
}

// Добавление контакта по ID
function addContactById(contactId) {
    const currentUserId = auth.currentUser.uid;
    
    // Проверяем, не добавлен ли уже этот контакт
    db.collection('users').doc(currentUserId).collection('contacts').doc(contactId).get()
        .then(doc => {
            if (!doc.exists) {
                // Добавляем контакт
                db.collection('users').doc(currentUserId).collection('contacts').doc(contactId).set({
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                alert('Контакт успешно добавлен');
            } else {
                alert('Этот пользователь уже есть в ваших контактах');
            }
        });
}

// Добавление контакта через модальное окно
function addContact() {
    const usernameInput = document.getElementById('contact-username');
    const username = usernameInput.value.trim();
    
    if (username) {
        // Удаляем @ если он есть
        const searchUsername = username.startsWith('@') ? username.substring(1) : username;
        
        db.collection('users')
            .where('username', '==', searchUsername)
            .limit(1)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                    alert('Пользователь не найден');
                } else {
                    const contactId = snapshot.docs[0].id;
                    addContactById(contactId);
                    usernameInput.value = '';
                    document.getElementById('add-contact-modal').style.display = 'none';
                }
            });
    }
}

// Загрузка контактов для добавления в группу
function loadContactsForGroup(userId) {
    const membersSelection = document.getElementById('group-members-selection');
    membersSelection.innerHTML = '<h4>Добавить участников:</h4>';
    
    db.collection('users').doc(userId).collection('contacts').get()
        .then(snapshot => {
            if (snapshot.empty) {
                membersSelection.innerHTML += '<p>У вас пока нет контактов</p>';
            } else {
                const contactsList = document.createElement('div');
                contactsList.className = 'contacts-checkbox-list';
                
                snapshot.forEach(doc => {
                    const contactId = doc.id;
                    
                    db.collection('users').doc(contactId).get().then(userDoc => {
                        if (userDoc.exists) {
                            const user = userDoc.data();
                            
                            const contactItem = document.createElement('div');
                            contactItem.className = 'contact-checkbox-item';
                            contactItem.innerHTML = `
                                <input type="checkbox" id="contact-${contactId}" value="${contactId}">
                                <label for="contact-${contactId}">
                                    <img src="${user.avatarUrl || 'images/default-avatar.png'}" alt="${user.username}">
                                    ${user.username}
                                </label>
                            `;
                            contactsList.appendChild(contactItem);
                        }
                    });
                });
                
                membersSelection.appendChild(contactsList);
            }
        });
}

// Создание группы
function createGroup() {
    const name = document.getElementById('group-name').value.trim();
    const description = document.getElementById('group-description').value.trim();
    
    if (name) {
        const currentUserId = auth.currentUser.uid;
        const members = [currentUserId]; // Создатель группы автоматически становится участником
        
        // Собираем выбранных участников
        document.querySelectorAll('.contacts-checkbox-list input[type="checkbox"]:checked').forEach(checkbox => {
            members.push(checkbox.value);
        });
        
        if (members.length < 2) {
            alert('Добавьте хотя бы одного участника');
            return;
        }
        
        // Создаем группу
        db.collection('groups').add({
            name: name,
            description: description,
            creatorId: currentUserId,
            members: members,
            admins: [currentUserId],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: {
                text: 'Группа создана',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            },
            unreadCount: 0
        }).then(() => {
            document.getElementById('group-name').value = '';
            document.getElementById('group-description').value = '';
            document.getElementById('create-group-modal').style.display = 'none';
        });
    } else {
        alert('Введите название группы');
    }
}

// Форматирование времени
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Форматирование времени последнего посещения
function formatLastSeen(timestamp) {
    if (!timestamp) return 'давно';
    
    const now = new Date();
    const lastSeen = timestamp.toDate();
    const diff = now - lastSeen;
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч. назад`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн. назад`;
    
    return lastSeen.toLocaleDateString();
}
