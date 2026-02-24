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
    initAudio();
    loadAlarms();
    startAlarmChecker();
    updateStats();
    updateFilterCounts();
    addEventListeners();
    
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Inisialisasi Audio
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API tidak didukung');
    }
}

// Event Listeners
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

// Suara Alarm
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
        
    } catch (e) {
        console.log('Gagal memainkan nada dering:', e);
    }
}

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

// Modal Functions
window.showAlarmModal = function(activity = null) {
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
    document.getElementById('alarmTime').value = now.toISOString().slice(0, 16);
    
    modal.classList.add('active');
};

window.closeModal = function() {
    const modal = document.getElementById('alarmModal');
    modal.classList.remove('active');
    document.getElementById('alarmNote').value = '';
};

window.closeConfirmModal = function() {
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

// Save Alarm
window.saveAlarm = function() {
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

// Delete Alarm
window.deleteAlarm = function(id) {
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

// Complete Alarm
window.completeAlarm = function(id) {
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

// Confirm Modal
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

window.confirmComplete = function() {
    if (currentConfirmAlarm) {
        completeAlarm(currentConfirmAlarm.id);
    }
};

function sendReminderNotification(alarm) {
    if (Notification.permission === 'granted') {
        new Notification('⏰ Reminder Kegiatan', {
            body: `Jangan lupa konfirmasi ${alarm.activity}: ${alarm.note}`,
            icon: '⏰'
        });
    }
    showNotification
