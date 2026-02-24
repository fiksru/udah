// Array untuk menyimpan data alarm
let alarms = [];
let currentFilter = 'all';
let pendingConfirmAlarm = null;
let audioContext = null;
let checkerInterval = null;

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

// Memainkan suara notifikasi
function playNotificationSound() {
    if (!audioContext) return;
    
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Buat suara notifikasi yang lebih jelas
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                osc.type = 'sine';
                osc.frequency.value = 600 + (i * 100);
                
                gain.gain.setValueAtTime(0, audioContext.currentTime);
                gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
                gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
                
                osc.start();
                osc.stop(audioContext.currentTime + 0.3);
            }, i * 300);
        }
    } catch (e) {
        console.log('Gagal memainkan suara:', e);
    }
}

// Memainkan suara penalty
function playPenaltySound() {
    if (!audioContext) return;
    
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Suara penalty yang lebih rendah dan tidak enak didengar
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioContext.currentTime);
        osc.frequency.setValueAtTime(150, audioContext.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
        
        osc.start();
        osc.stop(audioContext.currentTime + 1);
    } catch (e) {
        console.log('Gagal memainkan suara penalty:', e);
    }
}

// Menampilkan modal
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
    
    // Set default waktu ke sekarang + 1 menit
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const defaultTime = now.toISOString().slice(0, 16);
    document.getElementById('alarmTime').value = defaultTime;
    
    modal.classList.add('active');
}

// Menutup modal
function closeModal() {
    document.getElementById('alarmModal').classList.remove('active');
    document.getElementById('alarmNote').value = '';
}

// Menutup modal konfirmasi
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    pendingConfirmAlarm = null;
}

// Menampilkan modal konfirmasi
function showConfirmModal(alarm) {
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    message.textContent = `Apakah Anda sudah ${alarm.activity}? (${alarm.note})`;
    pendingConfirmAlarm = alarm;
    modal.classList.add('active');
}

// Konfirmasi selesai
function confirmComplete() {
    if (pendingConfirmAlarm) {
        completeAlarm(pendingConfirmAlarm.id);
        closeConfirmModal();
    }
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
        penalty: false,
        warningSent: false,
        gracePeriod: {
            active: false,
            startTime: null,
            endTime: null,
            notificationSent: false
        },
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
    alarms = alarms.filter(alarm => alarm.id !== id);
    saveToLocalStorage();
    renderAlarms();
    updateProgress();
    showNotification('Alam dihapus');
}

// Menandai alarm selesai
function completeAlarm(id) {
    const alarm = alarms.find(a => a.id === id);
    if (alarm) {
        alarm.completed = true;
        alarm.penalty = false;
        alarm.gracePeriod.active = false;
        alarm.gracePeriod.endTime = null;
        alarm.triggered = false;
        
        saveToLocalStorage();
        renderAlarms();
        updateProgress();
        playNotificationSound();
        showNotification(`Selamat! ${alarm.activity} selesai dikerjakan! 🎉`);
    }
}

// Memberi penalty
function givePenalty(alarm) {
    alarm.penalty = true;
    alarm.completed = false;
    alarm.gracePeriod.active = false;
    alarm.gracePeriod.endTime = null;
    alarm.warningSent = false;
    alarm.triggered = false;
    
    saveToLocalStorage();
    renderAlarms();
    updateProgress();
    playPenaltySound();
    showNotification(`⚠️ PENALTY: ${alarm.activity} tidak selesai tepat waktu!`, 'error');
    
    // Kirim notifikasi penalty
    if (Notification.permission === 'granted') {
        new Notification('⚠️ PENALTY!', {
            body: `${alarm.activity} - Anda terlambat!`,
            icon: '⚠️'
        });
    }
}

// Memulai grace period
function startGracePeriod(alarm) {
    const now = new Date();
    const graceEnd = new Date(now.getTime() + 5 * 60000); // 5 menit dari sekarang
    
    alarm.gracePeriod = {
        active: true,
        startTime: now.toISOString(),
        endTime: graceEnd.toISOString(),
        notificationSent: false
    };
    
    // Kirim notifikasi grace period
    showNotification(`⚠️ Waktu keringanan 5 menit untuk ${alarm.activity}! Segera selesaikan!`, 'warning');
    playNotificationSound();
    
    if (Notification.permission === 'granted') {
        new Notification('⏰ Masa Keringanan 5 Menit', {
            body: `${alarm.activity} - Anda memiliki 5 menit untuk menyelesaikan`,
            icon: '⏰'
        });
    }
    
    saveToLocalStorage();
    renderAlarms();
}

// Memeriksa alarm yang aktif
function startAlarmChecker() {
    // Hentikan checker sebelumnya jika ada
    if (checkerInterval) {
        clearInterval(checkerInterval);
    }
    
    checkerInterval = setInterval(() => {
        const now = new Date();
        
        alarms.forEach(alarm => {
            // Skip jika sudah selesai atau sudah penalty
            if (alarm.completed || alarm.penalty) return;
            
            const alarmTime = new Date(alarm.time);
            const timeDiff = alarmTime - now;
            const timeDiffMinutes = Math.floor(timeDiff / 60000);
            
            // KIRIM WARNING 5 MENIT SEBELUM ALARM
            if (timeDiff > 0 && timeDiff <= 300000 && !alarm.warningSent) {
                sendWarning(alarm);
            }
            
            // ALARM UTAMA (TEPAT WAKTU)
            if (timeDiff <= 0 && timeDiff > -1000 && !alarm.triggered && !alarm.gracePeriod.active) {
                triggerAlarm(alarm);
            }
            
            // MULAI GRACE PERIOD (1 DETIK SETELAH ALARM)
            if (timeDiff < -1000 && !alarm.triggered && !alarm.gracePeriod.active && !alarm.penalty) {
                startGracePeriod(alarm);
            }
            
            // CEK GRACE PERIOD - INI YANG DIPERBAIKI
            if (alarm.gracePeriod.active && alarm.gracePeriod.endTime) {
                const graceEnd = new Date(alarm.gracePeriod.endTime);
                
                // Kirim notifikasi 1 menit sebelum grace period habis
                const timeToEnd = graceEnd - now;
                if (timeToEnd <= 60000 && timeToEnd > 0 && !alarm.gracePeriod.notificationSent) {
                    alarm.gracePeriod.notificationSent = true;
                    showNotification(`⏰ 1 menit lagi masa keringanan habis untuk ${alarm.activity}!`, 'warning');
                    playNotificationSound();
                }
                
                // JIKA GRACE PERIOD HABIS -> KENAKAN PENALTY
                if (now >= graceEnd) {
                    givePenalty(alarm);
                }
            }
        });
        
        // Update render setiap detik untuk menampilkan countdown
        renderAlarms();
        
    }, 1000);
}

// Mengirim warning
function sendWarning(alarm) {
    alarm.warningSent = true;
    showNotification(`⚠️ waktu keringanan 5 menit : ${alarm.activity}!. Warning!!!`);
    playNotificationSound();
    
    if (Notification.permission === 'granted') {
        new Notification('⏰ Peringatan!', {
            body: `5 menit lagi ${alarm.activity}`,
            icon: '⚠️'
        });
    }
    
    saveToLocalStorage();
    renderAlarms();
}

// Menjalankan alarm
function triggerAlarm(alarm) {
    if (!alarm.triggered && !alarm.completed && !alarm.penalty) {
        alarm.triggered = true;
        
        // Notifikasi
        if (Notification.permission === 'granted') {
            new Notification(`🔔 Alarm ${alarm.activity}`, {
                body: alarm.note,
                icon: '🔔',
                requireInteraction: true,
                silent: false
            });
        }
        
        // Suara
        playNotificationSound();
        
        // Tampilkan modal konfirmasi
        showConfirmModal(alarm);
        
        saveToLocalStorage();
        renderAlarms();
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
        background: ${colors[type] || colors.success};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        font-size: 14px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
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
        
        // Migrasi data lama ke struktur baru jika perlu
        alarms.forEach(alarm => {
            if (!alarm.gracePeriod) {
                alarm.gracePeriod = {
                    active: false,
                    startTime: null,
                    endTime: null,
                    notificationSent: false
                };
            }
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
            penalty: false,
            warningSent: false,
            triggered: false,
            gracePeriod: {
                active: false,
                startTime: null,
                endTime: null,
                notificationSent: false
            }
        },
        {
            id: 2,
            activity: 'Belajar',
            time: new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16),
            note: 'Belajar JavaScript',
            completed: false,
            penalty: false,
            warningSent: false,
            triggered: false,
            gracePeriod: {
                active: false,
                startTime: null,
                endTime: null,
                notificationSent: false
            }
        },
        {
            id: 3,
            activity: 'Kebugaran',
            time: new Date(now.getTime() + 8 * 60000).toISOString().slice(0, 16),
            note: 'Jogging pagi',
            completed: false,
            penalty: false,
            warningSent: false,
            triggered: false,
            gracePeriod: {
                active: false,
                startTime: null,
                endTime: null,
                notificationSent: false
            }
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
    
    // Update active class pada filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`).classList.add('active');
    
    renderAlarms();
}

// Menampilkan daftar alarm
function renderAlarms() {
    const alarmList = document.getElementById('alarmList');
    const now = new Date();
    
    let filteredAlarms = alarms;
    
    // Apply filter
    if (currentFilter === 'pending') {
        filteredAlarms = alarms.filter(a => !a.completed && !a.penalty);
    } else if (currentFilter === 'completed') {
        filteredAlarms = alarms.filter(a => a.completed);
    } else if (currentFilter === 'penalty') {
        filteredAlarms = alarms.filter(a => a.penalty);
    }
    
    if (filteredAlarms.length === 0) {
        alarmList.innerHTML = '<div class="empty-state">Tidak ada alarm untuk ditampilkan</div>';
        return;
    }
    
    // Urutkan alarm
    const sortedAlarms = [...filteredAlarms].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.penalty !== b.penalty) return a.penalty ? 1 : -1;
        return new Date(a.time) - new Date(b.time);
    });
    
    alarmList.innerHTML = sortedAlarms.map(alarm => {
        const alarmTime = new Date(alarm.time);
        const timeDiff = alarmTime - now;
        const isActive = timeDiff > 0 && timeDiff <= 300000 && !alarm.completed && !alarm.penalty && !alarm.gracePeriod.active;
        const isWarning = timeDiff > 0 && timeDiff <= 300000 && !alarm.warningSent && !alarm.completed && !alarm.penalty;
        
        // Cek status grace period
        const inGracePeriod = alarm.gracePeriod && alarm.gracePeriod.active;
        let timeRemaining = '';
        let statusClass = '';
        let statusText = '';
        let statusBadge = '';
        
        if (alarm.completed) {
            statusClass = 'completed';
            statusText = '✅ Selesai';
        } else if (alarm.penalty) {
            statusClass = 'penalty';
            statusText = '⚠️ TERLAMBAT (Penalty)';
            statusBadge = 'penalty-badge';
        } else if (inGracePeriod && alarm.gracePeriod.endTime) {
            statusClass = 'grace-period';
            statusText = '⏰ MASA KERINGANAN';
            statusBadge = 'grace-badge';
            
            // Hitung sisa waktu grace period
            const graceEnd = new Date(alarm.gracePeriod.endTime);
            const remainingMs = graceEnd - now;
            
            if (remainingMs > 0) {
                const remainingMin = Math.floor(remainingMs / 60000);
                const remainingSec = Math.floor((remainingMs % 60000) / 1000);
                timeRemaining = `<span class="timer-countdown">Sisa: ${remainingMin}:${remainingSec.toString().padStart(2, '0')}</span>`;
            }
        } else if (isActive) {
            statusClass = 'active';
            statusText = '🔔 Aktif';
        }
        
        return `
            <li class="alarm-item ${statusClass}">
                <div class="alarm-info">
                    <strong>${getActivityIcon(alarm.activity)} ${alarm.activity}</strong>
                    <small>${formatDate(alarm.time)}</small>
                    <small style="display: block; color: #
