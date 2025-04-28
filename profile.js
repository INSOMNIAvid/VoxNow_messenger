// Управление профилем пользователя
document.addEventListener('DOMContentLoaded', function() {
    // Проверка аутентификации
    auth.onAuthStateChanged(user => {
        if (user) {
            loadProfile(user);
            setupEventListeners(user);
        } else {
            window.location.href = 'login.html';
        }
    });
});

// Загрузка данных профиля
function loadProfile(user) {
    db.collection('users').doc(user.uid).get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();
            
            // Заполнение данных профиля
            document.getElementById('profile-username').textContent = userData.username;
            document.getElementById('profile-email').textContent = user.email;
            
            if (userData.avatarUrl) {
                document.getElementById('profile-avatar').src = userData.avatarUrl;
                document.getElementById('user-avatar').src = userData.avatarUrl;
            }
            
            if (userData.bio) {
                document.getElementById('profile-bio').value = userData.bio;
            }
            
            if (userData.createdAt) {
                const createdAt = userData.createdAt.toDate();
                document.getElementById('profile-created').textContent = createdAt.toLocaleDateString();
            }
            
            // Обновление статуса
            document.getElementById('profile-status').textContent = userData.isOnline ? 'В сети' : `Был(а) ${formatLastSeen(userData.lastSeen)}`;
        }
    });
}

// Установка обработчиков событий
function setupEventListeners(user) {
    // Загрузка аватарки
    document.getElementById('avatar-upload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            uploadAvatar(user.uid, file);
        }
    });
    
    // Сохранение информации "О себе"
    document.getElementById('save-bio-btn').addEventListener('click', function() {
        const bio = document.getElementById('profile-bio').value.trim();
        db.collection('users').doc(user.uid).update({
            bio: bio
        }).then(() => {
            alert('Изменения сохранены');
        });
    });
    
    // Изменение пароля
    document.getElementById('change-password-btn').addEventListener('click', function() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;
        
        if (newPassword !== confirmPassword) {
            alert('Пароли не совпадают');
            return;
        }
        
        if (newPassword.length < 6) {
            alert('Пароль должен содержать не менее 6 символов');
            return;
        }
        
        // Проверка текущего пароля
        const credential = firebase.auth.EmailAuthProvider.credential(
            user.email, 
            currentPassword
        );
        
        user.reauthenticateWithCredential(credential)
            .then(() => {
                // Обновление пароля
                return user.updatePassword(newPassword);
            })
            .then(() => {
                alert('Пароль успешно изменен');
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-new-password').value = '';
            })
            .catch(error => {
                alert('Ошибка: ' + error.message);
            });
    });
    
    // Выход из системы
    document.getElementById('logout-btn').addEventListener('click', function() {
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    });
}

// Загрузка аватарки
function uploadAvatar(userId, file) {
    const storageRef = storage.ref(`avatars/${userId}`);
    const uploadTask = storageRef.put(file);
    
    uploadTask.on('state_changed', 
        null, 
        error => {
            alert('Ошибка загрузки: ' + error.message);
        }, 
        () => {
            // Получение URL загруженного изображения
            uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
                // Обновление URL аватарки в базе данных
                db.collection('users').doc(userId).update({
                    avatarUrl: downloadURL
                }).then(() => {
                    // Обновление аватарок на странице
                    document.getElementById('profile-avatar').src = downloadURL;
                    document.getElementById('user-avatar').src = downloadURL;
                });
            });
        }
    );
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
