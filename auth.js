// Аутентификация пользователей
document.addEventListener('DOMContentLoaded', function() {
    // Проверка, авторизован ли пользователь
    auth.onAuthStateChanged(user => {
        if (user && (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html'))) {
            window.location.href = 'index.html';
        }
    });
    
    // Форма входа
    if (document.getElementById('login-form')) {
        document.getElementById('login-form').addEventListener('submit', function(e) {
            e.preventDefault();
            loginUser();
        });
    }
    
    // Форма регистрации
    if (document.getElementById('register-form')) {
        document.getElementById('register-form').addEventListener('submit', function(e) {
            e.preventDefault();
            registerUser();
        });
    }
    
    // Сброс пароля
    if (document.getElementById('reset-password')) {
        document.getElementById('reset-password').addEventListener('click', function(e) {
            e.preventDefault();
            resetPassword();
        });
    }
});

// Вход пользователя
function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('auth-error');
    
    auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Успешный вход
            window.location.href = 'index.html';
        })
        .catch(error => {
            // Обработка ошибок
            let errorMessage = 'Ошибка входа';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Пользователь с таким email не найден';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Неверный пароль';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Неверный формат email';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Аккаунт заблокирован';
                    break;
            }
            
            errorElement.textContent = errorMessage;
        });
}

// Регистрация пользователя
function registerUser() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const errorElement = document.getElementById('auth-error');
    
    // Валидация
    if (password !== confirmPassword) {
        errorElement.textContent = 'Пароли не совпадают';
        return;
    }
    
    if (password.length < 6) {
        errorElement.textContent = 'Пароль должен содержать не менее 6 символов';
        return;
    }
    
    // Проверка имени пользователя
    let processedUsername = username;
    if (!username.startsWith('@')) {
        processedUsername = '@' + username;
    }
    
    const usernameRegex = /^@[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(processedUsername)) {
        errorElement.textContent = 'Имя пользователя может содержать только буквы, цифры и _';
        return;
    }
    
    // Проверка, свободно ли имя пользователя
    db.collection('users').where('username', '==', processedUsername).get()
        .then(snapshot => {
            if (!snapshot.empty) {
                errorElement.textContent = 'Это имя пользователя уже занято';
                return;
            }
            
            // Создание пользователя
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    
                    // Сохранение дополнительной информации о пользователе
                    return db.collection('users').doc(user.uid).set({
                        username: processedUsername,
                        email: email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isOnline: true,
                        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                        avatarUrl: '',
                        bio: ''
                    });
                })
                .then(() => {
                    // Успешная регистрация
                    window.location.href = 'index.html';
                })
                .catch(error => {
                    // Обработка ошибок
                    let errorMessage = 'Ошибка регистрации';
                    
                    switch (error.code) {
                        case 'auth/email-already-in-use':
                            errorMessage = 'Email уже используется';
                            break;
                        case 'auth/invalid-email':
                            errorMessage = 'Неверный формат email';
                            break;
                        case 'auth/weak-password':
                            errorMessage = 'Пароль слишком простой';
                            break;
                    }
                    
                    errorElement.textContent = errorMessage;
                });
        });
}

// Сброс пароля
function resetPassword() {
    const email = prompt('Введите ваш email для сброса пароля:');
    
    if (email) {
        auth.sendPasswordResetEmail(email)
            .then(() => {
                alert('Письмо для сброса пароля отправлено на ваш email');
            })
            .catch(error => {
                alert('Ошибка: ' + error.message);
            });
    }
}
