// Data dan State
let alarms = [];
let currentFilter = 'all';
let audioContext = null;
let checkerInterval = null;
let activeAlarmSounds = {};
let confirmModalTimer = null;
let confirmReminderInterval = null;
let currentConfirmAlarm = null;
let lastRenderTime = 0;
let pendingRender = false;

// ====================================================
// FILE MP3 NADA DERING LOKAL - UBAH DI SINI MANUAL
// ====================================================
const CUSTOM_RINGTONE_FILE = 'ayam.mp3'; // Contoh: 'alarm.mp3'
// ====================================================

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
    
    // Tampilkan info nada dering
    if (CUSTOM_RINGTONE_FILE) {
        console.log('Menggunakan nada dering lokal:', CUSTOM_RINGTONE_FILE);
    } else {
        console.log('Menggunakan nada dering default');
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
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeConfirmModal();
        }
    });

    document.addEventListener('click', function(e) {
        const alarmModal = document.getElementById('alarmModal');
        const confirmModal = document.getElementById('confirmModal');
        if (e.target === alarmModal) closeModal();
        if (e.target === confirmModal) closeConfirmModal();
    });
}

// Memainkan nada dering alarm
function playAlarmRingtone(alarmId) {
    if (CUSTOM_RINGTONE_FILE) {
        try {
            stopAlarmRingtone(alarmId);
            
            const audioPath = CUSTOM_RINGTONE_FILE;
            console.log('Mencoba memutar file:', audioPath);
            
            const audio = new Audio(audioPath);
            audio.loop = true;
            audio.volume = 0.7;
            
            audio.addEventListener('canplaythrough', () => {
                console.log('File audio siap diputar');
            });
            
            audio.addEventListener('error', (e) => {
                console.error('Gagal memutar file audio lokal:', e);
                playDefaultRingtone(alarmId);
            });
            
            audio.play().then(() => {
                console.log('Memutar nada dering lokal:', CUSTOM_RINGTONE_FILE);
            }).catch(e => {
                console.error('Gagal memutar audio lokal:', e);
                playDefaultRingtone(alarmId);
            });
            
            activeAlarmSounds[alarmId] = { audio, type: 'html5' };
            return;
        } catch (e) {
            console.error('Error dengan audio lokal:', e);
        }
    }
    
    playDefaultRingtone(alarmId);
}

// Nada dering default
function playDefaultRingtone(alarmId) {
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
        
        activeAlarmSounds[alarmId] = { osc1, osc2, gainNode, type: 'webaudio' };
        
        osc1.start();
        osc2.start();
        
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
        console.log('Default alarm ringtone dimainkan');
        
    } catch (e) {
        console.log('Gagal memainkan nada dering default:', e);
    }
}

// Menghentikan nada dering
function stopAlarmRingtone(alarmId) {
    if (activeAlarmSounds[alarmId]) {
        try {
            const sound = activeAlarmSounds[alarmId];
            
            if (sound.type === 'html5' && sound.audio) {
                sound.audio.pause();
                sound.audio.currentTime = 0;
            } else if (sound.type === 'webaudio') {
                if (sound.osc1) sound.osc1.stop();
                if (sound.osc2) sound.osc2.stop();
                if (sound.interval) clearInterval(sound.interval);
            }
            
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
    
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    now.setSeconds(0);
    now.setMilliseconds(0);
    document.getElementById('alarmTime').value = now.toISOString().slice(0, 16);
    
    document.getElementById('alarmNote').value = '';
    
    modal.classList.add('active');
};

window.closeModal = function() {
    console.log('Menutup modal alarm');
    const modal = document.getElementById('alarmModal');
    modal.classList.remove('active');
};

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
        debouncedRender();
    }
};

// ==================== FUNGSI ALARM ====================

window.saveAlarm = function() {
    console.log('Menyimpan alarm...');
    
    const activity = document.getElementById('activityType').value;
    const alarmTime = document.getElementById('alarmTime').value;
    const note = document.getElementById('alarmNote').value;

    if (!alarmTime) {
        showNotification('Silakan pilih waktu alarm!', 'warning');
        return;
    }

    const selectedTime = new Date(alarmTime);
    const now = new Date();
    
    if (selectedTime <= now) {
        showNotification('Waktu alarm hanya waktu yang akan datang', 'warning');
        return;
    }

    const alarm = {
        id: Date.now(),
        activity: activity,
        time: alarmTime,
        note: note || `Alarm ${activity}`,
        status: 'pending',
        warningSent: false,
        reminderActive: false,
        reminderEndTime: null,
        triggered: false,
        failedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString()
    };

    alarms.push(alarm);
    console.log('Alarm ditambahkan:', alarm);
    
    saveToLocalStorage();
    updateStats();
    updateFilterCounts();
    debouncedRender();
    
    closeModal();
    
    showNotification('Alarm berhasil ditambahkan!', 'success');
};

window.deleteAlarm = function(id) {
    console.log('Menghapus alarm dengan ID:', id);
    stopAlarmRingtone(id);
    if (currentConfirmAlarm && currentConfirmAlarm.id === id) {
        closeConfirmModal();
    }
    alarms = alarms.filter(alarm => alarm.id !== id);
    saveToLocalStorage();
    updateStats();
    updateFilterCounts();
    debouncedRender();
    showNotification('Alarm dihapus', 'success');
};

window.completeAlarm = function(id) {
    console.log('Menyelesaikan alarm dengan ID:', id);
    const alarm = alarms.find(a => a.id === id);
    if (alarm && alarm.status !== 'completed') {
        stopAlarmRingtone(id);
        alarm.status = 'completed';
        alarm.completedAt = new Date().toISOString();
        alarm.reminderActive = false;
        alarm.reminderEndTime = null;
        alarm.triggered = false;
        
        saveToLocalStorage();
        updateStats();
        updateFilterCounts();
        debouncedRender();
        playNotificationSound();
        showNotification(`Selamat! ${alarm.activity} selesai dikerjakan! 🎉`, 'success');
        
        if (currentConfirmAlarm && currentConfirmAlarm.id === id) {
            closeConfirmModal();
        }
    }
};

window.failAlarm = function(id) {
    console.log('Menandai alarm tidak terlaksana dengan ID:', id);
    const alarm = alarms.find(a => a.id === id);
    if (alarm && alarm.status !== 'failed') {
        stopAlarmRingtone(id);
        alarm.status = 'failed';
        alarm.failedAt = new Date().toISOString();
        alarm.reminderActive = false;
        alarm.reminderEndTime = null;
        alarm.triggered = false;
        
        saveToLocalStorage();
        updateStats();
        updateFilterCounts();
        debouncedRender();
        showNotification(`⚠️ ${alarm.activity} tidak terlaksana`, 'warning');
        
        if (currentConfirmAlarm && currentConfirmAlarm.id === id) {
            closeConfirmModal();
        }
    }
};

window.filterAlarms = function(filter) {
    console.log('Filter alarm:', filter);
    currentFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`).classList.add('active');
    
    debouncedRender();
};

// ==================== FUNGSI CHECKER ====================

function startAlarmChecker() {
    if (checkerInterval) clearInterval(checkerInterval);
    
    checkerInterval = setInterval(() => {
        const now = new Date();
        let needRender = false;
        
        alarms.forEach(alarm => {
            if (alarm.status !== 'pending') return;
            
            const alarmTime = new Date(alarm.time);
            const timeDiff = alarmTime - now;
            
            if (timeDiff > 0 && timeDiff <= 60000 && !alarm.warningSent) {
                sendWarning(alarm);
                needRender = true;
            }
            
            if (timeDiff <= 0 && timeDiff > -1000 && !alarm.triggered && !alarm.reminderActive) {
                triggerAlarm(alarm);
                needRender = true;
            }
            
            if (alarm.reminderActive && alarm.reminderEndTime) {
                const end = new Date(alarm.reminderEndTime);
                const remaining = end - now;
                if (remaining <= 30000 && remaining > 0 && !alarm.reminderNearEnd) {
                    alarm.reminderNearEnd = true;
                    needRender = true;
                }
            }
        });
        
        if (needRender) {
            debouncedRender();
            updateStats();
            updateFilterCounts();
        }
        
    }, 1000);
}

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

function triggerAlarm(alarm) {
    if (!alarm.triggered && alarm.status === 'pending') {
        alarm.triggered = true;
        
        if (Notification.permission === 'granted') {
            new Notification(`🔔 Alarm ${alarm.activity}`, {
                body: alarm.note,
                icon: '🔔',
                requireInteraction: true,
                vibrate: [200, 100, 200]
            });
        }
        
        playAlarmRingtone(alarm.id);
        
        showNotification(`🔔 SUDAH WAKTUNYA ${alarm.activity}! ${alarm.note}, ayuu laksanakan`, 'success');
        
        showConfirmModal(alarm);
        
        saveToLocalStorage();
    }
}

function showConfirmModal(alarm) {
    closeConfirmModal();
    
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    const timerEl = document.getElementById('confirmTimer');
    
    message.textContent = `Apakah Kamu sudah ${alarm.activity}? (${alarm.note})`;
    currentConfirmAlarm = alarm;
    
    const endTime = Date.now() + 60000;
    alarm.reminderActive = true;
    alarm.reminderEndTime = new Date(endTime).toISOString();
    alarm.reminderNearEnd = false;
    
    sendReminderNotification(alarm);
    
    confirmReminderInterval = setInterval(() => {
        if (currentConfirmAlarm && currentConfirmAlarm.id === alarm.id && alarm.status === 'pending') {
            sendReminderNotification(alarm);
        }
    }, 15000);
    
    const modalFooter = document.querySelector('#confirmModal .modal-footer');
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button class="btn-cancel" onclick="failAlarm(${alarm.id})">❌ Tidak Terlaksana</button>
            <button class="btn-primary" onclick="confirmComplete()">✅ Ya, Selesai</button>
        `;
    }
    
    confirmModalTimer = setInterval(() => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
            clearInterval(confirmModalTimer);
            clearInterval(confirmReminderInterval);
            if (modal.classList.contains('active') && currentConfirmAlarm && currentConfirmAlarm.id === alarm.id) {
                modal.classList.remove('active');
                failAlarm(alarm.id);
                showNotification(`Waktu konfirmasi habis, ${alarm.activity} ditandai tidak terlaksana`, 'warning');
            }
        } else {
            const seconds = Math.floor(remaining / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
            
            if (remaining <= 30000) {
                debouncedRender();
            }
        }
    }, 1000);
    
    modal.classList.add('active');
    debouncedRender();
}

window.confirmComplete = function() {
    console.log('Konfirmasi selesai dari modal');
    if (currentConfirmAlarm) {
        completeAlarm(currentConfirmAlarm.id);
    }
};

function sendReminderNotification(alarm) {
    if (Notification.permission === 'granted') {
        new Notification('⏰ Reminder Kegiatan', {
            body: `Jangan lupa konfirmasi yah... ${alarm.activity}: ${alarm.note}`,
            icon: '⏰'
        });
    }
    showNotification(`⏰ Reminder: Konfirmasi ${alarm.activity}`, 'warning');
    playNotificationSound();
}

// ==================== FUNGSI TAMPILAN ====================

function debouncedRender() {
    if (!pendingRender) {
        pendingRender = true;
        requestAnimationFrame(() => {
            renderAlarms();
            pendingRender = false;
        });
    }
}

function showNotification(message, type = 'success') {
    console.log('Notifikasi:', message, type);
    
    const colors = {
        success: '#0066cc',
        warning: '#ff9800',
        error: '#ff4444'
    };
    
    const existingToasts = document.querySelectorAll('.notification-toast');
    for (let toast of existingToasts) {
        if (toast.textContent === message) {
            return;
        }
    }
    
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
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
        pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 4000);
}

function saveToLocalStorage() {
    try {
        localStorage.setItem('alarms', JSON.stringify(alarms));
        console.log('Data tersimpan');
    } catch (e) {
        console.error('Gagal menyimpan:', e);
    }
}

function loadAlarms() {
    try {
        const savedAlarms = localStorage.getItem('alarms');
        if (savedAlarms) {
            alarms = JSON.parse(savedAlarms);
            alarms.forEach(alarm => {
                if (!alarm.status) {
                    if (alarm.completed) {
                        alarm.status = 'completed';
                    } else {
                        alarm.status = 'pending';
                    }
                }
                if (alarm.reminderActive === undefined) alarm.reminderActive = false;
                if (alarm.reminderEndTime === undefined) alarm.reminderEndTime = null;
                if (alarm.reminderNearEnd === undefined) alarm.reminderNearEnd = false;
                if (alarm.failedAt === undefined) alarm.failedAt = null;
                if (alarm.completedAt === undefined) alarm.completedAt = null;
            });
            console.log('Data dimuat:', alarms.length, 'alarm');
        } else {
            createSampleAlarms();
        }
    } catch (e) {
        console.error('Gagal memuat:', e);
        createSampleAlarms();
    }
    
    debouncedRender();
    updateStats();
    updateFilterCounts();
}

function createSampleAlarms() {
    const now = new Date();
    
    const sampleAlarms = [
        {
            id: 1,
            activity: 'Makan',
            time: new Date(now.getTime() + 2 * 60000).toISOString().slice(0, 16),
            note: 'Sarapan pagi',
            status: 'pending',
            warningSent: false,
            triggered: false,
            reminderActive: false,
            reminderEndTime: null,
            reminderNearEnd: false,
            failedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString()
        },
        {
            id: 2,
            activity: 'Belajar',
            time: new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16),
            note: 'Belajar JavaScript',
            status: 'pending',
            warningSent: false,
            triggered: false,
            reminderActive: false,
            reminderEndTime: null,
            reminderNearEnd: false,
            failedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString()
        },
        {
            id: 3,
            activity: 'Organisasi',
            time: new Date(now.getTime() + 8 * 60000).toISOString().slice(0, 16),
            note: 'Rapat organisasi',
            status: 'pending',
            warningSent: false,
            triggered: false,
            reminderActive: false,
            reminderEndTime: null,
            reminderNearEnd: false,
            failedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString()
        }
    ];
    
    alarms = sampleAlarms;
    console.log('Contoh alarm dibuat');
}

function renderAlarms() {
    const alarmList = document.getElementById('alarmList');
    const now = new Date();
    
    let filteredAlarms = alarms;
    if (currentFilter === 'pending') {
        filteredAlarms = alarms.filter(a => a.status === 'pending');
    } else if (currentFilter === 'completed') {
        filteredAlarms = alarms.filter(a => a.status === 'completed');
    } else if (currentFilter === 'failed') {
        filteredAlarms = alarms.filter(a => a.status === 'failed');
    }
    
    if (filteredAlarms.length === 0) {
        alarmList.innerHTML = '<div class="empty-state">✨ Tidak ada alarm untuk ditampilkan</div>';
        return;
    }
    
    const sortedAlarms = [...filteredAlarms].sort((a, b) => {
        if (a.status !== b.status) {
            if (a.status === 'pending') return -1;
            if (b.status === 'pending') return 1;
        }
        return new Date(a.time) - new Date(b.time);
    });
    
    let htmlString = '';
    
    sortedAlarms.forEach(alarm => {
        const alarmTime = new Date(alarm.time);
        const timeDiff = alarmTime - now;
        const isActive = timeDiff > 0 && timeDiff <= 60000 && alarm.status === 'pending' && !alarm.reminderActive;
        
        let statusClass = '';
        let badgeClass = '';
        let statusText = '';
        let timeRemaining = '';
        
        if (alarm.status === 'completed') {
            statusClass = 'completed';
            badgeClass = 'badge-success';
            statusText = '✅ Selesai';
        } else if (alarm.status === 'failed') {
            statusClass = 'failed';
            badgeClass = 'badge-failed';
            statusText = '❌ Tidak Terlaksana';
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
        
        htmlString += `
            <li class="alarm-item ${statusClass}" data-id="${alarm.id}">
                <div class="alarm-info">
                    <strong>${getActivityIcon(alarm.activity)} ${alarm.activity}</strong>
                    <small>${formatDate(alarm.time)}</small>
                    <small style="color: #666; margin-top: 5px;">📝 ${alarm.note}</small>
                    ${statusText ? `<span class="alarm-badge ${badgeClass}">${statusText}</span>` : ''}
                    ${timeRemaining}
                </div>
                <div class="alarm-actions">
                    ${alarm.status === 'pending' ? `
                        <button class="btn-complete" onclick="completeAlarm(${alarm.id})">✓ Selesai</button>
                        <button class="btn-fail" onclick="failAlarm(${alarm.id})">✗ Tidak</button>
                    ` : ''}
                    <button class="btn-delete" onclick="deleteAlarm(${alarm.id})">🗑️ Hapus</button>
                </div>
            </li>
        `;
    });
    
    if (alarmList.innerHTML !== htmlString) {
        alarmList.innerHTML = htmlString;
        console.log('Render daftar alarm');
    }
}

function updateStats() {
    const total = alarms.length;
    const completed = alarms.filter(a => a.status === 'completed').length;
    const failed = alarms.filter(a => a.status === 'failed').length;
    
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    
    const failedEl = document.getElementById('failedTasks');
    if (failedEl) {
        failedEl.textContent = failed;
        failedEl.className = 'stat-value ' + (failed > 0 ? 'failed' : '');
    }
    
    document.getElementById('progressPercentage').textContent = progress + '%';
    document.getElementById('progressBar').style.width = progress + '%';
}

function updateFilterCounts() {
    const total = alarms.length;
    const pending = alarms.filter(a => a.status === 'pending').length;
    const completed = alarms.filter(a => a.status === 'completed').length;
    const failed = alarms.filter(a => a.status === 'failed').length;
    
    const countAll = document.getElementById('countAll');
    const countPending = document.getElementById('countPending');
    const countCompleted = document.getElementById('countCompleted');
    const countFailed = document.getElementById('countFailed');
    
    if (countAll) countAll.textContent = total;
    if (countPending) countPending.textContent = pending;
    if (countCompleted) countCompleted.textContent = completed;
    if (countFailed) countFailed.textContent = failed;
}

function getActivityIcon(activity) {
    const icons = {
        'Makan': '🍚',
        'Belajar': '📚',
        'Tidur': '😴',
        'Kebugaran': '💪',
        'Organisasi': '🏢'
    };
    return icons[activity] || '⏰';
}

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

window.addEventListener('beforeunload', function() {
    Object.keys(activeAlarmSounds).forEach(alarmId => {
        stopAlarmRingtone(alarmId);
    });
});
