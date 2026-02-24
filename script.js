// Data dan State
let alarms = [];
let currentFilter = 'all';
let audioContext = null;
let checkerInterval = null;
let activeAlarmSounds = {};
let confirmModalTimer = null;
let confirmReminderInterval = null;
let currentConfirmAlarm = null;

// Inisialisasi
document.addEventListener('DOMContentLoaded', function() {
    console.log('Aplikasi Alarm dimulai...');
    initAudio();
    loadAlarms();
    startAlarmChecker();
    updateStats();
    updateFilterCounts();
    addEventListeners();
    
    // Request notifikasi
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Inisialisasi Audio
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio siap');
    } catch (e) {
        console.log('Web Audio API tidak didukung');
    }
}

// Event Listeners Global
function addEventListeners() {
    // Escape key untuk tutup modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeConfirmModal();
        }
    });

    // Klik di luar modal untuk tutup
    document.addEventListener('click', function(e) {
        const alarmModal = document.getElementById('alarmModal');
        const confirmModal = document.getElementById('confirmModal');
        if (e.target === alarmModal) closeModal();
        if (e.target === confirmModal) closeConfirmModal();
    });
}

// ==================== FUNGSI AUDIO ====================

// Memainkan nada dering alarm
function playAlarmRingtone(alarmId) {
    if (!audioContext) return;
    
    try {
        stopAlarmRingtone(alarmId);
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0.7, audioContext.currentTime);
        
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(880, audioContext.currentTime);
        osc2.frequency.setValueAtTime(440, audioContext.currentTime);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        
        activeAlarmSounds[alarmId] = { osc1, osc2, gainNode };
        
        osc1.start();
        osc2.start();
        
        // Efek naik turun volume
        const interval = setInterval(() => {
            if (!activeAlarmSounds[alarmId]) {
                clearInterval(interval);
                return;
            }
            gainNode.gain.setValueAtTime(
                0.5 + 0.2 * Math.sin(audioContext.currentTime * 5),
                audioContext.currentTime
            );
        }, 100);
        
        activeAlarmSounds[alarmId].interval = interval;
        console.log('Alarm ringtone dimainkan');
        
    } catch (e) {
        console.log('Gagal memainkan nada dering:', e);
    }
}

// Menghentikan nada dering
function stopAlarmRingtone(alarmId) {
    if (activeAlarmSounds[alarmId]) {
        try {
            const sounds = activeAlarmSounds[alarmId];
            if (sounds.osc1) sounds.osc1.stop();
            if (sounds.osc2) sounds.osc2.stop();
            if (sounds.interval) clearInterval(sounds.interval);
            delete activeAlarmSounds[alarmId];
            console.log('Alarm ringtone dihentikan');
        } catch (e) {
            console.log('Gagal menghentikan nada dering:', e);
        }
    }
}

// Suara notifikasi pendek
function playNotificationSound() {
    if (!audioContext) return;
    
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.type = 'sine';
                osc.frequency.value = 800 + (i * 100);
                gain.gain.setValueAtTime(0.5, audioContext.currentTime);
                gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
                osc.start();
                osc.stop(audioContext.currentTime + 0.2);
            }, i * 200);
        }
    } catch (e) {
        console.log('Gagal memainkan suara:', e);
    }
}

// ==================== FUNGSI MODAL ====================

// Menampilkan modal alarm
window.showAlarmModal = function(activity = null) {
    console.log('Membuka modal alarm, activity:', activity);
    const modal = document.getElementById('alarmModal');
    const modalTitle = document.getElementById('modalTitle');
    const activitySelect = document.getElementById('activityType');
    
    if (activity) {
        modalTitle.textContent = `Atur Alarm ${activity}`;
        activitySelect.value = activity;
    } else {
        modalTitle.textContent = 'Atur Alarm Manual';
    }
    
    // Set default waktu ke sekarang + 1 menit
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    now.setSeconds(0);
    now.setMilliseconds(0);
    document.getElementById('alarmTime').value = now.toISOString().slice(0, 16);
    
    // Kosongkan catatan
    document.getElementById('alarmNote').value = '';
    
    modal.classList.add('active');
};

// Menutup modal alarm
window.closeModal = function() {
    console.log('Menutup modal alarm');
    const modal = document.getElementById('alarmModal');
    modal.classList.remove('active');
};

// Menutup modal konfirmasi
window.closeConfirmModal = function() {
    console.log('Menutup modal konfirmasi');
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('active');
    
    if (confirmModalTimer) {
        clearInterval(confirmModalTimer);
        confirmModalTimer = null;
    }
    
    if (confirmReminderInterval) {
        clearInterval(confirmReminderInterval);
        confirmReminderInterval = null;
    }
    
    if (currentConfirmAlarm) {
        currentConfirmAlarm.reminderActive = false;
        currentConfirmAlarm.reminderEndTime = null;
        currentConfirmAlarm = null;
        renderAlarms();
    }
};

// ==================== FUNGSI ALARM ====================

// Menyimpan alarm baru
window.saveAlarm = function() {
    console.log('Menyimpan alarm...');
    
    const activity = document.getElementById('activityType').value;
    const alarmTime = document.getElementById('alarmTime').value;
    const note = document.getElementById('alarmNote').value;

    if (!alarmTime) {
        showNotification('Silakan pilih waktu alarm!', 'warning');
        return;
    }

    // Validasi waktu
    const selectedTime = new Date(alarmTime);
    const now = new Date();
    
    if (selectedTime <= now) {
        showNotification('Waktu alarm harus di masa depan!', 'warning');
        return;
    }

    const alarm = {
        id: Date.now(),
        activity: activity,
        time: alarmTime,
        note: note || `Alarm ${activity}`,
        completed: false,
        warningSent: false,
        reminderActive: false,
        reminderEndTime: null,
        triggered: false,
        createdAt: new Date().toISOString()
    };

    alarms.push(alarm);
    console.log('Alarm ditambahkan:', alarm);
    
    // Simpan dan update
    saveToLocalStorage();
    renderAlarms();
    updateStats();
    updateFilterCounts();
    
    // Tutup modal
    closeModal();
    
    // Notifikasi
    showNotification('Alarm berhasil ditambahkan!', 'success');
};

// Menghapus alarm
window.deleteAlarm = function(id) {
    console.log('Menghapus alarm dengan ID:', id);
    stopAlarmRingtone(id);
    if (currentConfirmAlarm && currentConfirmAlarm.id === id) {
        closeConfirmModal();
    }
    alarms = alarms.filter(alarm => alarm.id !== id);
    saveToLocalStorage();
    renderAlarms();
    updateStats();
    updateFilterCounts();
    showNotification('Alarm dihapus', 'success');
};

// Menandai alarm selesai
window.completeAlarm = function(id) {
    console.log('Menyelesaikan alarm dengan ID:', id);
    const alarm = alarms.find(a => a.id === id);
    if (alarm && !alarm.completed) {
        stopAlarmRingtone(id);
        alarm.completed = true;
        alarm.reminderActive = false;
        alarm.reminderEndTime = null;
        alarm.triggered = false;
        
        saveToLocalStorage();
        renderAlarms();
        updateStats();
        updateFilterCounts();
        playNotificationSound();
        showNotification(`Selamat! ${alarm.activity} selesai dikerjakan! 🎉`, 'success');
        
        if (currentConfirmAlarm && currentConfirmAlarm.id === id) {
            closeConfirmModal();
        }
    }
};

// Filter alarm
window.filterAlarms = function(filter) {
    console.log('Filter alarm:', filter);
    currentFilter = filter;
    
    // Update active class pada filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`).classList.add('active');
    
    renderAlarms();
};

// Membuat alarm otomatis
window.createAutoAlarm = function() {
    console.log('Membuat alarm otomatis...');
    const activities = ['Makan', 'Belajar', 'Tidur', 'Kebugaran'];
    const now = new Date();
    
    activities.forEach(activity => {
        const randomMinutes = Math.floor(Math.random() * 30) + 1; // 1-30 menit
        const alarmTime = new Date(now.getTime() + randomMinutes * 60000);
        
        const alarm = {
            id: Date.now() + Math.random(),
            activity: activity,
            time: alarmTime.toISOString().slice(0, 16),
            note: `Alarm otomatis: ${activity}`,
            completed: false,
            warningSent: false,
            triggered: false,
            reminderActive: false,
            reminderEndTime: null,
            createdAt: new Date().toISOString()
        };
        
        alarms.push(alarm);
    });
    
    saveToLocalStorage();
    renderAlarms();
    updateStats();
    updateFilterCounts();
    showNotification('4 Alarm otomatis telah ditambahkan!', 'success');
};

// ==================== FUNGSI CHECKER ====================

// Memeriksa alarm yang aktif
function startAlarmChecker() {
    if (checkerInterval) clearInterval(checkerInterval);
    
    checkerInterval = setInterval(() => {
        const now = new Date();
        
        alarms.forEach(alarm => {
            if (alarm.completed) return;
            
            const alarmTime = new Date(alarm.time);
            const timeDiff = alarmTime - now;
            
            // Kirim warning 1 menit sebelum alarm
            if (timeDiff > 0 && timeDiff <= 60000 && !alarm.warningSent) {
                sendWarning(alarm);
            }
            
            // Alarm utama (tepat waktu)
            if (timeDiff <= 0 && timeDiff > -1000 && !alarm.triggered && !alarm.reminderActive) {
                triggerAlarm(alarm);
            }
        });
        
        // Update tampilan
        renderAlarms();
        
    }, 500);
}

// Mengirim warning 1 menit sebelum alarm
function sendWarning(alarm) {
    alarm.warningSent = true;
    showNotification(`⚠️ 1 menit lagi: ${alarm.activity}!`, 'warning');
    playNotificationSound();
    
    if (Notification.permission === 'granted') {
        new Notification('⏰ Peringatan!', {
            body: `1 menit lagi ${alarm.activity}`,
            icon: '⚠️'
        });
    }
    
    saveToLocalStorage();
}

// Menjalankan alarm
function triggerAlarm(alarm) {
    if (!alarm.triggered && !alarm.completed) {
        alarm.triggered = true;
        
        // Notifikasi browser
        if (Notification.permission === 'granted') {
            new Notification(`🔔 Alarm ${alarm.activity}`, {
                body: alarm.note,
                icon: '🔔',
                requireInteraction: true,
                vibrate: [200, 100, 200]
            });
        }
        
        // Suara dering
        playAlarmRingtone(alarm.id);
        
        // Notifikasi toast
        showNotification(`🔔 WAKTUNYA ${alarm.activity}! ${alarm.note}`, 'success');
        
        // Tampilkan modal konfirmasi
        showConfirmModal(alarm);
        
        saveToLocalStorage();
    }
}

// Menampilkan modal konfirmasi
function showConfirmModal(alarm) {
    closeConfirmModal();
    
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    const timerEl = document.getElementById('confirmTimer');
    
    message.textContent = `Apakah Anda sudah ${alarm.activity}? (${alarm.note})`;
    currentConfirmAlarm = alarm;
    
    // Timer 1 menit
    const endTime = Date.now() + 60000;
    alarm.reminderActive = true;
    alarm.reminderEndTime = new Date(endTime).toISOString();
    
    // Notifikasi pertama
    sendReminderNotification(alarm);
    
    // Reminder periodik setiap 15 detik
    confirmReminderInterval = setInterval(() => {
        if (currentConfirmAlarm && currentConfirmAlarm.id === alarm.id && !alarm.completed) {
            sendReminderNotification(alarm);
        }
    }, 15000);
    
    // Update timer setiap detik
    confirmModalTimer = setInterval(() => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
            // Waktu habis
            clearInterval(confirmModalTimer);
            clearInterval(confirmReminderInterval);
            if (modal.classList.contains('active')) {
                modal.classList.remove('active');
                showNotification(`Waktu konfirmasi untuk ${alarm.activity} telah habis.`, 'warning');
                alarm.reminderActive = false;
                alarm.reminderEndTime = null;
                currentConfirmAlarm = null;
                renderAlarms();
            }
        } else {
            const seconds = Math.floor(remaining / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
    
    modal.classList.add('active');
    renderAlarms();
}

// Konfirmasi selesai dari modal
window.confirmComplete = function() {
    console.log('Konfirmasi selesai dari modal');
    if (currentConfirmAlarm) {
        completeAlarm(currentConfirmAlarm.id);
    }
};

// Mengirim notifikasi reminder
function sendReminderNotification(alarm) {
    if (Notification.permission === 'granted') {
        new Notification('⏰ Reminder Kegiatan', {
            body: `Jangan lupa konfirmasi ${alarm.activity}: ${alarm.note}`,
            icon: '⏰'
        });
    }
    showNotification(`⏰ Reminder: Konfirmasi ${alarm.activity}`, 'warning');
    playNotificationSound();
}

// ==================== FUNGSI TAMPILAN ====================

// Menampilkan notifikasi toast
function showNotification(message, type = 'success') {
    console.log('Notifikasi:', message, type);
    
    const colors = {
        success: '#667eea',
        warning: '#ff9800',
        error: '#ff4444'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        font-weight: 600;
        font-size: 14px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 4000);
}

// Menyimpan ke localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('alarms', JSON.stringify(alarms));
        console.log('Data tersimpan');
    } catch (e) {
        console.error('Gagal menyimpan:', e);
    }
}

// Memuat dari localStorage
function loadAlarms() {
    try {
        const savedAlarms = localStorage.getItem('alarms');
        if (savedAlarms) {
            alarms = JSON.parse(savedAlarms);
            // Migrasi data lama
            alarms.forEach(alarm => {
                if (alarm.reminderActive === undefined) alarm.reminderActive = false;
                if (alarm.reminderEndTime === undefined) alarm.reminderEndTime = null;
            });
            console.log('Data dimuat:', alarms.length, 'alarm');
        } else {
            createSampleAlarms();
        }
    } catch (e) {
        console.error('Gagal memuat:', e);
        createSampleAlarms();
    }
    
    renderAlarms();
    updateStats();
    updateFilterCounts();
}

// Membuat contoh alarm
function createSampleAlarms() {
    const now = new Date();
    
    const sampleAlarms = [
        {
            id: 1,
            activity: 'Makan',
            time: new Date(now.getTime() + 2 * 60000).toISOString().slice(0, 16),
            note: 'Sarapan pagi',
            completed: false,
            warningSent: false,
            triggered: false,
            reminderActive: false,
            reminderEndTime: null
        },
        {
            id: 2,
            activity: 'Belajar',
            time: new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16),
            note: 'Belajar JavaScript',
            completed: false,
            warningSent: false,
            triggered: false,
            reminderActive: false,
            reminderEndTime: null
        },
        {
            id: 3,
            activity: 'Kebugaran',
            time: new Date(now.getTime() + 8 * 60000).toISOString().slice(0, 16),
            note: 'Jogging pagi',
            completed: false,
            warningSent: false,
            triggered: false,
            reminderActive: false,
            reminderEndTime: null
        }
    ];
    
    alarms = sampleAlarms;
    console.log('Contoh alarm dibuat');
}

// Render daftar alarm
function renderAlarms() {
    const alarmList = document.getElementById('alarmList');
    const now = new Date();
    
    let filteredAlarms = alarms;
    if (currentFilter === 'pending') {
        filteredAlarms = alarms.filter(a => !a.completed);
    } else if (currentFilter === 'completed') {
        filteredAlarms = alarms.filter(a => a.completed);
    }
    
    if (filteredAlarms.length === 0) {
        alarmList.innerHTML = '<div class="empty-state">✨ Tidak ada alarm untuk ditampilkan</div>';
        return;
    }
    
    // Urutkan alarm
    const sortedAlarms = [...filteredAlarms].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.time) - new Date(b.time);
    });
    
    alarmList.innerHTML = sortedAlarms.map(alarm => {
        const alarmTime = new Date(alarm.time);
        const timeDiff = alarmTime - now;
        const isActive = timeDiff > 0 && timeDiff <= 60000 && !alarm.completed && !alarm.reminderActive;
        
        let statusClass = '';
        let badgeClass = '';
        let statusText = '';
        let timeRemaining = '';
        
        if (alarm.completed) {
            statusClass = 'completed';
            badgeClass = 'badge-success';
            statusText = '✅ Selesai';
        } else if (alarm.reminderActive && alarm.reminderEndTime) {
            statusClass = 'reminder';
            badgeClass = 'badge-warning';
            statusText = '⏰ Perlu Konfirmasi';
            
            const end = new Date(alarm.reminderEndTime);
            const remaining = end - now;
            if (remaining > 0) {
                const sec = Math.floor(remaining / 1000);
                const min = Math.floor(sec / 60);
                const s = sec % 60;
                timeRemaining = `<span class="timer-countdown">⏳ ${min}:${s.toString().padStart(2, '0')}</span>`;
            }
        } else if (isActive) {
            statusClass = 'active';
            badgeClass = 'badge-primary';
            statusText = '🔔 Kurang dari 1 menit';
        }
        
        return `
            <li class="alarm-item ${statusClass}">
                <div class="alarm-info">
                    <strong>${getActivityIcon(alarm.activity)} ${alarm.activity}</strong>
                    <small>${formatDate(alarm.time)}</small>
                    <small style="color: #666; margin-top: 5px;">📝 ${alarm.note}</small>
                    ${statusText ? `<span class="alarm-badge ${badgeClass}">${statusText}</span>` : ''}
                    ${timeRemaining}
                </div>
                <div class="alarm-actions">
                    ${!alarm.completed ? `
                        <button class="btn-complete" onclick="completeAlarm(${alarm.id})">✓ Selesai</button>
                    ` : ''}
                    <button class="btn-delete" onclick="deleteAlarm(${alarm.id})">✗ Hapus</button>
                </div>
            </li>
        `;
    }).join('');
}

// Update statistik
function updateStats() {
    const total = alarms.length;
    const completed = alarms.filter(a => a.completed).length;
    const pending = total - completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
    document.getElementById('progressPercentage').textContent = progress + '%';
    document.getElementById('progressBar').style.width = progress + '%';
}

// Update filter counts
function updateFilterCounts() {
    const total = alarms.length;
    const pending = alarms.filter(a => !a.completed).length;
    const completed = alarms.filter(a => a.completed).length;
    
    document.getElementById('countAll').textContent = total;
    document.getElementById('countPending').textContent = pending;
    document.getElementById('countCompleted').textContent = completed;
}

// Mendapatkan icon kegiatan
function getActivityIcon(activity) {
    const icons = {
        'Makan': '🍚',
        'Belajar': '📚',
        'Tidur': '😴',
        'Kebugaran': '💪'
    };
    return icons[activity] || '⏰';
}

// Format tanggal
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    
    const options = {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    if (diff < 86400000 && diff > -86400000) {
        return `📅 Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return `📅 ${date.toLocaleDateString('id-ID', options)}`;
    }
}

// Hentikan semua suara saat halaman ditutup
window.addEventListener('beforeunload', function() {
    Object.keys(activeAlarmSounds).forEach(alarmId => {
        stopAlarmRingtone(alarmId);
    });
});
