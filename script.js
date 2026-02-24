// Array untuk menyimpan data alarm
let alarms = [];
let currentFilter = 'all';
let audioContext = null;
let checkerInterval = null;
let activeAlarmSounds = {}; // Untuk menyimpan audio yang sedang aktif
let confirmModalTimer = null; // Timer untuk modal konfirmasi
let currentConfirmAlarm = null; // Alarm yang sedang dikonfirmasi

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    loadAlarms();
    startAlarmChecker();
    updateProgress();
    addAutoAlarmButton();
    initAudio();
    
    // Request notification permission
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
});

// Inisialisasi Audio Context
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API tidak didukung');
    }
}

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
        
        activeAlarmSounds[alarmId] = {
            osc1, osc2,
            gainNode,
            startTime: Date.now()
        };
        
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
        
    } catch (e) {
        console.log('Gagal memainkan nada dering:', e);
    }
}

// Menghentikan nada dering alarm
function stopAlarmRingtone(alarmId) {
    if (activeAlarmSounds[alarmId]) {
        try {
            const sounds = activeAlarmSounds[alarmId];
            if (sounds.osc1) sounds.osc1.stop();
            if (sounds.osc2) sounds.osc2.stop();
            if (sounds.interval) clearInterval(sounds.interval);
            delete activeAlarmSounds[alarmId];
        } catch (e) {
            console.log('Gagal menghentikan nada dering:', e);
        }
    }
}

// Memainkan suara notifikasi pendek
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

// Menampilkan modal alarm
function showAlarmModal(activity = null) {
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
    document.getElementById('alarmTime').value = now.toISOString().slice(0, 16);
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('alarmModal').classList.remove('active');
    document.getElementById('alarmNote').value = '';
}

// Menyimpan alarm baru
function saveAlarm() {
    const activity = document.getElementById('activityType').value;
    const alarmTime = document.getElementById('alarmTime').value;
    const note = document.getElementById('alarmNote').value;

    if (!alarmTime) {
        alert('Silakan pilih waktu alarm!');
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
    saveToLocalStorage();
    renderAlarms();
    updateProgress();
    closeModal();
    showNotification('Alarm berhasil ditambahkan!');
}

// Menghapus alarm
function deleteAlarm(id) {
    stopAlarmRingtone(id);
    if (currentConfirmAlarm && currentConfirmAlarm.id === id) {
        closeConfirmModal();
    }
    alarms = alarms.filter(alarm => alarm.id !== id);
    saveToLocalStorage();
    renderAlarms();
    updateProgress();
    showNotification('Alarm dihapus');
}

// Menandai alarm selesai
function completeAlarm(id) {
    const alarm = alarms.find(a => a.id === id);
    if (alarm && !alarm.completed) {
        stopAlarmRingtone(id);
        alarm.completed = true;
        alarm.reminderActive = false;
        alarm.reminderEndTime = null;
        alarm.triggered = false;
        
        saveToLocalStorage();
        renderAlarms();
        updateProgress();
        playNotificationSound();
        showNotification(`Selamat! ${alarm.activity} selesai dikerjakan! 🎉`);
        
        if (currentConfirmAlarm && currentConfirmAlarm.id === id) {
            closeConfirmModal();
        }
    }
}

// Menampilkan modal konfirmasi
function showConfirmModal(alarm) {
    // Tutup modal sebelumnya jika ada
    closeConfirmModal();
    
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    const timerEl = document.getElementById('confirmTimer');
    
    message.textContent = `Apakah Anda sudah ${alarm.activity}? (${alarm.note})`;
    currentConfirmAlarm = alarm;
    
    // Set timer 1 menit
    const endTime = Date.now() + 60000; // 1 menit
    alarm.reminderActive = true;
    alarm.reminderEndTime = new Date(endTime).toISOString();
    
    // Update timer setiap detik
    confirmModalTimer = setInterval(() => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
            // Waktu habis
            clearInterval(confirmModalTimer);
            confirmModalTimer = null;
            if (modal.classList.contains('active') && currentConfirmAlarm && currentConfirmAlarm.id === alarm.id) {
                modal.classList.remove('active');
                showNotification(`Waktu konfirmasi untuk ${alarm.activity} telah habis.`, 'warning');
                alarm.reminderActive = false;
                alarm.reminderEndTime = null;
                currentConfirmAlarm = null;
                renderAlarms();
            }
        } else {
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            timerEl.textContent = `Sisa waktu: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
    
    modal.classList.add('active');
    renderAlarms();
}

// Menutup modal konfirmasi
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('active');
    if (confirmModalTimer) {
        clearInterval(confirmModalTimer);
        confirmModalTimer = null;
    }
    if (currentConfirmAlarm) {
        currentConfirmAlarm.reminderActive = false;
        currentConfirmAlarm.reminderEndTime = null;
        currentConfirmAlarm = null;
        renderAlarms();
    }
}

// Konfirmasi selesai dari modal
function confirmComplete() {
    if (currentConfirmAlarm) {
        completeAlarm(currentConfirmAlarm.id);
    }
}

// Memeriksa alarm yang aktif
function startAlarmChecker() {
    if (checkerInterval) clearInterval(checkerInterval);
    
    checkerInterval = setInterval(() => {
        const now = new Date();
        
        alarms.forEach(alarm => {
            if (alarm.completed) return;
            
            const alarmTime = new Date(alarm.time);
            const timeDiff = alarmTime - now;
            
            // Kirim warning 1 menit sebelum alarm (DIUBAH DARI 5 MENIT)
            if (timeDiff > 0 && timeDiff <= 60000 && !alarm.warningSent) {
                sendWarning(alarm);
            }
            
            // Alarm utama
            if (timeDiff <= 0 && timeDiff > -1000 && !alarm.triggered && !alarm.reminderActive) {
                triggerAlarm(alarm);
            }
            
            // Cek reminder yang masih aktif (untuk keperluan render)
            if (alarm.reminderActive && alarm.reminderEndTime) {
                const reminderEnd = new Date(alarm.reminderEndTime);
                if (now > reminderEnd) {
                    // Reminder sudah lewat, tapi sudah ditangani oleh timer modal
                    alarm.reminderActive = false;
                    alarm.reminderEndTime = null;
                }
            }
        });
        
        renderAlarms();
        
    }, 500);
}

// Mengirim warning (DIUBAH TEKSNYA)
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
        
        if (Notification.permission === 'granted') {
            new Notification(`🔔 Alarm ${alarm.activity}`, {
                body: alarm.note,
                icon: '🔔',
                requireInteraction: true,
                vibrate: [200, 100, 200]
            });
        }
        
        playAlarmRingtone(alarm.id);
        showNotification(`🔔 WAKTUNYA ${alarm.activity}! ${alarm.note}`, 'success');
        
        // Tampilkan modal konfirmasi
        showConfirmModal(alarm);
        
        saveToLocalStorage();
    }
}

// Menampilkan notifikasi toast
function showNotification(message, type = 'success') {
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
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        font-weight: bold;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
}

// Menyimpan ke localStorage
function saveToLocalStorage() {
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

// Memuat dari localStorage
function loadAlarms() {
    const savedAlarms = localStorage.getItem('alarms');
    if (savedAlarms) {
        alarms = JSON.parse(savedAlarms);
        // Migrasi jika properti tidak ada
        alarms.forEach(alarm => {
            if (alarm.reminderActive === undefined) alarm.reminderActive = false;
            if (alarm.reminderEndTime === undefined) alarm.reminderEndTime = null;
        });
        renderAlarms();
        updateProgress();
    } else {
        createSampleAlarms();
    }
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
    saveToLocalStorage();
    renderAlarms();
    updateProgress();
}

// Filter alarm
function filterAlarms(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`).classList.add('active');
    renderAlarms();
}

// Menampilkan daftar alarm (bagian isActive juga diubah menjadi 60000)
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
        alarmList.innerHTML = '<div class="empty-state">Tidak ada alarm untuk ditampilkan</div>';
        return;
    }
    
    const sortedAlarms = [...filteredAlarms].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.time) - new Date(b.time);
    });
    
    alarmList.innerHTML = sortedAlarms.map(alarm => {
        const alarmTime = new Date(alarm.time);
        const timeDiff = alarmTime - now;
        // Aktivitas yang akan segera (1 menit) - DIUBAH DARI 300000
        const isActive = timeDiff > 0 && timeDiff <= 60000 && !alarm.completed && !alarm.reminderActive;
        
        let statusClass = '';
        let statusBadge = '';
        let statusText = '';
        let timeRemaining = '';
        
        if (alarm.completed) {
            statusClass = 'completed';
            statusText = '✅ Selesai';
            statusBadge = 'completed-badge';
        } else if (alarm.reminderActive && alarm.reminderEndTime) {
            statusClass = 'reminder';
            statusText = '⏰ Perlu Konfirmasi';
            statusBadge = 'reminder-badge';
            
            const end = new Date(alarm.reminderEndTime);
            const remaining = end - now;
            if (remaining > 0) {
                const sec = Math.floor(remaining / 1000);
                const min = Math.floor(sec / 60);
                const s = sec % 60;
                timeRemaining = `<span class="timer-countdown">Sisa: ${min}:${s.toString().padStart(2, '0')}</span>`;
            }
        } else if (isActive) {
            statusClass = 'active';
            statusText = '🔔 Akan Segera';
        }
        
        return `
            <li class="alarm-item ${statusClass}">
                <div class="alarm-info">
                    <strong>${getActivityIcon(alarm.activity)} ${alarm.activity}</strong>
                    <small>${formatDate(alarm.time)}</small>
                    <small style="color: #666;">${alarm.note}</small>
                    ${statusText ? `<small class="${statusBadge}">${statusText}</small>` : ''}
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

// Update progress
function updateProgress() {
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

// Mendapatkan icon kegiatan
function getActivityIcon(activity) {
    const icons = { Makan: '🍚', Belajar: '📚', Tidur: '😴', Kebugaran: '💪' };
    return icons[activity] || '⏰';
}

// Format tanggal
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    
    if (diff < 86400000 && diff > -86400000) {
        return `Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('id-ID', { 
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit'
        });
    }
}

// Membuat alarm otomatis
function createAutoAlarm() {
    const activities = ['Makan', 'Belajar', 'Tidur', 'Kebugaran'];
    const now = new Date();
    
    activities.forEach(activity => {
        const randomMinutes = Math.floor(Math.random() * 60) + 1;
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
    updateProgress();
    showNotification('4 Alarm otomatis telah ditambahkan!');
}

// Menambahkan tombol alarm otomatis
function addAutoAlarmButton() {
    const alarmSection = document.querySelector('.alarm-section');
    const autoButton = document.createElement('button');
    autoButton.className = 'btn-secondary';
    autoButton.style.marginTop = '10px';
    autoButton.style.width = '100%';
    autoButton.textContent = '🤖 Buat Alarm Otomatis (4 Kegiatan)';
    autoButton.onclick = createAutoAlarm;
    alarmSection.appendChild(autoButton);
}

// Event listener untuk tombol Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
        closeConfirmModal();
    }
});

// Klik di luar modal
document.addEventListener('click', function(event) {
    const alarmModal = document.getElementById('alarmModal');
    const confirmModal = document.getElementById('confirmModal');
    if (event.target === alarmModal) closeModal();
    if (event.target === confirmModal) closeConfirmModal();
});

// Hentikan semua suara saat halaman ditutup
window.addEventListener('beforeunload', function() {
    Object.keys(activeAlarmSounds).forEach(stopAlarmRingtone);
});
