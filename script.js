// Array untuk menyimpan data alarm
let alarms = [];
let currentFilter = 'all';
let pendingConfirmAlarm = null;
let audioContext = null;

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    loadAlarms();
    startAlarmChecker();
    updateProgress();
    addAutoAlarmButton();
    initAudio();
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
        // Resume audio context jika suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Buat oscillator untuk suara notifikasi
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Konfigurasi suara
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        
        // Envelope suara
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Ulang 3 kali
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                osc.frequency.value = 600 + (i * 100);
                gain.gain.setValueAtTime(0, audioContext.currentTime);
                gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
                gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
                
                osc.start();
                osc.stop(audioContext.currentTime + 0.3);
            }, i * 400);
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
        
        // Suara penalty yang lebih rendah
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.8);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.8);
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
        gracePeriodStarted: false,
        graceEndTime: null,
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
    showNotification('Alarm dihapus');
}

// Menandai alarm selesai
function completeAlarm(id) {
    const alarm = alarms.find(a => a.id === id);
    if (alarm) {
        alarm.completed = true;
        alarm.penalty = false;
        alarm.warningSent = false;
        alarm.gracePeriodStarted = false;
        alarm.graceEndTime = null;
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
    alarm.warningSent = false;
    alarm.gracePeriodStarted = false;
    alarm.graceEndTime = null;
    saveToLocalStorage();
    renderAlarms();
    updateProgress();
    playPenaltySound();
    showNotification(`⚠️ PENALTY: ${alarm.activity} tidak selesai tepat waktu!`, 'error');
}

// Memulai grace period
function startGracePeriod(alarm) {
    alarm.gracePeriodStarted = true;
    const graceEnd = new Date();
    graceEnd.setMinutes(graceEnd.getMinutes() + 5); // 5 menit grace period
    alarm.graceEndTime = graceEnd.toISOString();
    
    // Kirim notifikasi grace period
    showNotification(`⚠️ Waktu keringanan 5 menit untuk ${alarm.activity}!`, 'warning');
    playNotificationSound();
    
    saveToLocalStorage();
    renderAlarms();
}

// Memeriksa alarm yang aktif
function startAlarmChecker() {
    setInterval(() => {
        const now = new Date();
        
        alarms.forEach(alarm => {
            if (!alarm.completed && !alarm.penalty) {
                const alarmTime = new Date(alarm.time);
                const timeDiff = alarmTime - now;
                const timeDiffMinutes = Math.floor(timeDiff / 60000);
                
                // Alarm utama (tepat waktu)
                if (timeDiff <= 0 && timeDiff > -60000 && !alarm.triggered && !alarm.gracePeriodStarted) {
                    triggerAlarm(alarm);
                }
                
                // Grace period (5 menit setelah alarm)
                if (timeDiff < -60000 && !alarm.gracePeriodStarted && !alarm.warningSent) {
                    startGracePeriod(alarm);
                }
                
                // Cek grace period
                if (alarm.gracePeriodStarted && alarm.graceEndTime) {
                    const graceEnd = new Date(alarm.graceEndTime);
                    if (now > graceEnd && !alarm.penalty) {
                        givePenalty(alarm);
                    }
                }
                
                // Kirim warning 5 menit sebelum alarm
                if (timeDiff > 0 && timeDiff <= 300000 && !alarm.warningSent) { // 5 menit = 300000 ms
                    sendWarning(alarm);
                }
            }
        });
    }, 1000);
}

// Mengirim warning
function sendWarning(alarm) {
    alarm.warningSent = true;
    showNotification(`⚠️ Waktu Keringanan 5 menit warning`);
    playNotificationSound();
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
                requireInteraction: true
            });
        }
        
        // Suara
        playNotificationSound();
        
        // Tampilkan modal konfirmasi
        showConfirmModal(alarm);
        
        renderAlarms();
    }
}

// Menampilkan notifikasi
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
            gracePeriodStarted: false
        },
        {
            id: 2,
            activity: 'Belajar',
            time: new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16),
            note: 'Belajar JavaScript',
            completed: false,
            penalty: false,
            warningSent: false,
            gracePeriodStarted: false
        },
        {
            id: 3,
            activity: 'Kebugaran',
            time: new Date(now.getTime() + 8 * 60000).toISOString().slice(0, 16),
            note: 'Jogging pagi',
            completed: false,
            penalty: false,
            warningSent: false,
            gracePeriodStarted: false
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
        if (a.penalty !== b.penalty) return a.penalty ? -1 : 1;
        return new Date(a.time) - new Date(b.time);
    });
    
    alarmList.innerHTML = sortedAlarms.map(alarm => {
        const alarmTime = new Date(alarm.time);
        const now = new Date();
        const timeDiff = alarmTime - now;
        const isActive = timeDiff > 0 && timeDiff <= 300000 && !alarm.completed && !alarm.penalty;
        const isWarning = timeDiff > 0 && timeDiff <= 300000 && !alarm.warningSent && !alarm.completed && !alarm.penalty;
        const inGracePeriod = alarm.gracePeriodStarted && !alarm.completed && !alarm.penalty;
        
        let statusClass = '';
        let statusText = '';
        
        if (alarm.completed) {
            statusClass = 'completed';
            statusText = '✅ Selesai';
        } else if (alarm.penalty) {
            statusClass = 'penalty';
            statusText = '⚠️ TERLAMBAT (Penalty)';
        } else if (inGracePeriod) {
            statusClass = 'warning';
            statusText = '⏰ Masa Keringanan (5 menit)';
        } else if (isActive) {
            statusClass = 'active';
            statusText = '🔔 Aktif';
        }
        
        return `
            <li class="alarm-item ${statusClass}">
                <div class="alarm-info">
                    <strong>${getActivityIcon(alarm.activity)} ${alarm.activity}</strong>
                    <small>${formatDate(alarm.time)}</small>
                    <small style="display: block; color: #666;">${alarm.note}</small>
                    ${statusText ? `<small class="${alarm.penalty ? 'penalty-badge' : (inGracePeriod ? 'warning-badge' : '')}">${statusText}</small>` : ''}
                </div>
                <div class="alarm-actions">
                    ${!alarm.completed && !alarm.penalty ? `
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
    const penalty = alarms.filter(a => a.penalty).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('penaltyTasks').textContent = penalty;
    document.getElementById('progressPercentage').textContent = progress + '%';
    document.getElementById('progressBar').style.width = progress + '%';
}

// Mendapatkan icon untuk kegiatan
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
    
    if (diff < 86400000 && diff > -86400000) {
        return `Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('id-ID', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
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
            penalty: false,
            warningSent: false,
            gracePeriodStarted: false,
            createdAt: new Date().toISOString(),
            isAuto: true
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

// Meminta izin notifikasi
if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
}

// Event listener untuk tombol Escape

