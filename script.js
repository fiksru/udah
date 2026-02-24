// Array untuk menyimpan data alarm
let alarms = [];
let currentFilter = 'all';
let audioContext = null;
let checkerInterval = null;
let activeAlarmSounds = {}; // Untuk menyimpan audio yang sedang aktif

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

// Memainkan nada dering alarm yang keras dan panjang
function playAlarmRingtone(alarmId) {
    if (!audioContext) return;
    
    try {
        // Hentikan suara sebelumnya jika ada
        stopAlarmRingtone(alarmId);
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0.8, audioContext.currentTime); // Volume 80%
        
        // Buat oscillator untuk nada dering yang lebih keras
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const osc3 = audioContext.createOscillator();
        
        osc1.type = 'sawtooth'; // Nada kasar agar lebih terdengar
        osc2.type = 'square';   // Nada tambahan
        osc3.type = 'triangle'; // Nada harmoni
        
        osc1.frequency.setValueAtTime(880, audioContext.currentTime); // Nada A5
        osc2.frequency.setValueAtTime(440, audioContext.currentTime); // Nada A4
        osc3.frequency.setValueAtTime(220, audioContext.currentTime); // Nada A3
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc3.connect(gainNode);
        
        // Simpan oscillator agar bisa dihentikan nanti
        activeAlarmSounds[alarmId] = {
            osc1, osc2, osc3,
            gainNode,
            startTime: Date.now()
        };
        
        // Mulai semua oscillator
        osc1.start();
        osc2.start();
        osc3.start();
        
        // Buat efek naik turun volume (vibrato)
        const interval = setInterval(() => {
            if (!activeAlarmSounds[alarmId]) {
                clearInterval(interval);
                return;
            }
            
            const time = audioContext.currentTime;
            // Efek tremolo (volume naik turun)
            gainNode.gain.setValueAtTime(
                0.5 + 0.3 * Math.sin(time * 5), 
                time
            );
            
            // Efek frekuensi naik turun
            osc1.frequency.setValueAtTime(
                880 + 20 * Math.sin(time * 8),
                time
            );
        }, 100);
        
        // Simpan interval untuk dibersihkan nanti
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
            if (sounds.osc3) sounds.osc3.stop();
            
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
        
        // Suara notifikasi pendek
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

// Memainkan suara penalty
function playPenaltySound() {
    if (!audioContext) return;
    
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Suara penalty yang lebih rendah dan panjang
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioContext.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 1.5);
        
        gain.gain.setValueAtTime(0.6, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.8);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.5);
        
        osc.start();
        osc.stop(audioContext.currentTime + 1.5);
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
        alarmStopped: false, // Untuk menandai apakah alarm sudah dihentikan
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
    // Hentikan nada dering jika sedang aktif
    stopAlarmRingtone(id);
    
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
        // Hentikan nada dering jika sedang aktif
        stopAlarmRingtone(id);
        
        alarm.completed = true;
        alarm.penalty = false;
        alarm.gracePeriod.active = false;
        alarm.gracePeriod.endTime = null;
        alarm.triggered = false;
        alarm.alarmStopped = true;
        
        saveToLocalStorage();
        renderAlarms();
        updateProgress();
        playNotificationSound();
        showNotification(`Selamat! ${alarm.activity} selesai dikerjakan! 🎉`);
    }
}

// Memberi penalty (terlambat)
function givePenalty(alarm) {
    // Hentikan nada dering jika sedang aktif
    stopAlarmRingtone(alarm.id);
    
    alarm.penalty = true;
    alarm.completed = false;
    alarm.gracePeriod.active = false;
    alarm.gracePeriod.endTime = null;
    alarm.warningSent = false;
    alarm.triggered = false;
    alarm.alarmStopped = true;
    
    saveToLocalStorage();
    renderAlarms();
    updateProgress();
    playPenaltySound();
    showNotification(`⚠️ PENALTY: ${alarm.activity} - TERLAMBAT!`, 'error');
    
    // Kirim notifikasi penalty
    if (Notification.permission === 'granted') {
        new Notification('⚠️ PENALTY!', {
            body: `${alarm.activity} - Anda terlambat!`,
            icon: '⚠️'
        });
    }
}

// Memulai grace period (1 menit)
function startGracePeriod(alarm) {
    const now = new Date();
    const graceEnd = new Date(now.getTime() + 1 * 60000); // 1 menit grace period
    
    alarm.gracePeriod = {
        active: true,
        startTime: now.toISOString(),
        endTime: graceEnd.toISOString(),
        notificationSent: false
    };
    
    // Kirim notifikasi grace period
    showNotification(`⚠️ Waktu keringanan 1 MENIT untuk ${alarm.activity}! Segera selesaikan!`, 'warning');
    playNotificationSound();
    
    if (Notification.permission === 'granted') {
        new Notification('⏰ Masa Keringanan 1 Menit', {
            body: `${alarm.activity} - Anda memiliki 1 menit untuk menyelesaikan`,
            icon: '⏰'
        });
    }
    
    saveToLocalStorage();
    renderAlarms();
}

// Memeriksa alarm yang aktif - VERSI DIPERBAIKI
function startAlarmChecker() {
    // Hentikan checker sebelumnya jika ada
    if (checkerInterval) {
        clearInterval(checkerInterval);
    }
    
    checkerInterval = setInterval(() => {
        const now = new Date();
        let progressUpdated = false;
        
        alarms.forEach(alarm => {
            // Skip jika sudah selesai
            if (alarm.completed) return;
            
            const alarmTime = new Date(alarm.time);
            const timeDiff = alarmTime - now;
            const timeDiffSeconds = Math.floor(timeDiff / 1000);
            
            // KIRIM WARNING 5 MENIT SEBELUM ALARM
            if (timeDiff > 0 && timeDiff <= 300000 && !alarm.warningSent && !alarm.penalty) {
                sendWarning(alarm);
            }
            
            // ALARM UTAMA (TEPAT WAKTU) - MAINKAN NADA DERING
            if (timeDiff <= 0 && timeDiff > -1000 && !alarm.triggered && !alarm.gracePeriod.active && !alarm.penalty) {
                triggerAlarm(alarm);
            }
            
            // MULAI GRACE PERIOD (SETELAH ALARM BERBUNYI) - 1 MENIT
            if (timeDiff < -1000 && alarm.triggered && !alarm.gracePeriod.active && !alarm.penalty && !alarm.completed) {
                startGracePeriod(alarm);
            }
            
            // CEK GRACE PERIOD - PASTIKAN PENALTY JIKA HABIS
            if (alarm.gracePeriod.active && alarm.gracePeriod.endTime && !alarm.penalty && !alarm.completed) {
                const graceEnd = new Date(alarm.gracePeriod.endTime);
                
                // Kirim notifikasi 30 detik sebelum grace period habis
                const timeToEnd = graceEnd - now;
                if (timeToEnd <= 30000 && timeToEnd > 0 && !alarm.gracePeriod.notificationSent) {
                    alarm.gracePeriod.notificationSent = true;
                    showNotification(`⏰ 30 detik lagi masa keringanan habis untuk ${alarm.activity}!`, 'warning');
                    playNotificationSound();
                }
                
                // JIKA GRACE PERIOD HABIS -> KENAKAN PENALTY LANGSUNG
                if (now >= graceEnd) {
                    givePenalty(alarm);
                    progressUpdated = true;
                }
            }
            
            // CEK ALARM YANG SUDAH LEWAT TANPA TRIGGER - FIX BUG
            if (timeDiff < -60000 && !alarm.triggered && !alarm.gracePeriod.active && !alarm.penalty && !alarm.completed) {
                // Jika sudah lewat lebih dari 1 menit dan tidak pernah ditrigger, langsung penalty
                console.log('Alarm lewat tanpa trigger:', alarm);
                givePenalty(alarm);
                progressUpdated = true;
            }
            
            // CEK ALARM YANG SEDANG DALAM GRACE PERIOD TAPI SUDAH LEWAT 1 MENIT
            if (alarm.gracePeriod.active && alarm.gracePeriod.endTime && !alarm.penalty && !alarm.completed) {
                const graceEnd = new Date(alarm.gracePeriod.endTime);
                if (now > graceEnd) {
                    givePenalty(alarm);
                    progressUpdated = true;
                }
            }
        });
        
        // Update render setiap detik
        renderAlarms();
        if (progressUpdated) {
            updateProgress();
        }
        
    }, 500); // Cek setiap 500ms untuk lebih responsif
}

// Mengirim warning
function sendWarning(alarm) {
    alarm.warningSent = true;
    showNotification(`⚠️ 5 menit lagi: ${alarm.activity}!`, 'warning');
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

// Menjalankan alarm - MAINKAN NADA DERING
function triggerAlarm(alarm) {
    if (!alarm.triggered && !alarm.completed && !alarm.penalty) {
        alarm.triggered = true;
        alarm.alarmStopped = false;
        
        // Notifikasi
        if (Notification.permission === 'granted') {
            new Notification(`🔔 Alarm ${alarm.activity}`, {
                body: alarm.note,
                icon: '🔔',
                requireInteraction: true,
                silent: false,
                vibrate: [200, 100, 200] // Getar untuk mobile
            });
        }
        
        // Mainkan nada dering alarm (keras dan panjang)
        playAlarmRingtone(alarm.id);
        
        // Tampilkan notifikasi toast
        showNotification(`🔔 WAKTUNYA ${alarm.activity}! ${alarm.note}`, 'success');
        
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
        font-weight: bold;
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
            if (alarm.alarmStopped === undefined) {
                alarm.alarmStopped = false;
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
            alarmStopped: false,
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
            alarmStopped: false,
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
            alarmStopped: false,
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
            statusText = '⚠️ TERLAMBAT';
            statusBadge = 'penalty-badge';
        } else if (inGracePeriod && alarm.gracePeriod.endTime) {
            statusClass = 'grace-period';
            statusText = '⏰ MASA KERINGANAN';
            statusBadge = 'grace-badge';
            
            // Hitung sisa waktu grace period
            const graceEnd = new Date(alarm.gracePeriod.endTime);
            const remainingMs = graceEnd - now;
            
            if (remainingMs > 0) {
                const remainingSec = Math.floor(remainingMs / 1000);
                const remainingMin = Math.floor(remainingSec / 60);
                const remainingSecs = remainingSec % 60;
                timeRemaining = `<span class="timer-countdown">Sisa: ${remainingMin}:${remainingSecs.toString().padStart(2, '0')}</span>`;
            }
        } else if (isActive) {
            statusClass = 'active';
            statusText = '🔔 Akan Segera Aktif';
        }
        
        return `
            <li class="alarm-item ${statusClass}">
                <div class="alarm-info">
                    <strong>${getActivityIcon(alarm.activity)} ${alarm.activity}</strong>
                    <small>${formatDate(alarm.time)}</small>
                    <small style="display: block; color: #666;">${alarm.note}</small>
                    ${statusText ? `<small class="${statusBadge}">${statusText}</small>` : ''}
                    ${timeRemaining}
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
            triggered: false,
            alarmStopped: false,
            gracePeriod: {
                active: false,
                startTime: null,
                endTime: null,
                notificationSent: false
            },
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

// Event listener untuk tombol Escape menutup modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Menutup modal jika klik di luar modal
document.addEventListener('click', function(event) {
    const modal = document.getElementById('alarmModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Hentikan semua suara saat halaman ditutup
window.addEventListener('beforeunload', function() {
    Object.keys(activeAlarmSounds).forEach(alarmId => {
        stopAlarmRingtone(alarmId);
    });
});
