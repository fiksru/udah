// Array untuk menyimpan data alarm
let alarms = [];

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    loadAlarms();
    startAlarmChecker();
    
    // Tambahkan tombol untuk membuat alarm otomatis
    addAutoAlarmButton();
});

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
        createdAt: new Date().toISOString()
    };

    alarms.push(alarm);
    saveToLocalStorage();
    renderAlarms();
    closeModal();

    // Tampilkan notifikasi
    showNotification('Alarm berhasil ditambahkan!');
}

// Menghapus alarm
function deleteAlarm(id) {
    alarms = alarms.filter(alarm => alarm.id !== id);
    saveToLocalStorage();
    renderAlarms();
    showNotification('Alarm dihapus');
}

// Menandai alarm selesai
function completeAlarm(id) {
    const alarm = alarms.find(a => a.id === id);
    if (alarm) {
        alarm.completed = true;
        saveToLocalStorage();
        renderAlarms();
        showNotification(`Selamat! ${alarm.activity} selesai dikerjakan! 🎉`);
    }
}

// Membuat alarm otomatis (contoh: setiap jam tertentu)
function createAutoAlarm() {
    const activities = ['Makan', 'Belajar', 'Tidur', 'Kebugaran'];
    const now = new Date();
    
    activities.forEach(activity => {
        // Buat alarm random antara 1-60 menit dari sekarang
        const randomMinutes = Math.floor(Math.random() * 60) + 1;
        const alarmTime = new Date(now.getTime() + randomMinutes * 60000);
        
        const alarm = {
            id: Date.now() + Math.random(),
            activity: activity,
            time: alarmTime.toISOString().slice(0, 16),
            note: `Alarm otomatis: ${activity}`,
            completed: false,
            createdAt: new Date().toISOString(),
            isAuto: true
        };
        
        alarms.push(alarm);
    });
    
    saveToLocalStorage();
    renderAlarms();
    showNotification('4 Alarm otomatis telah ditambahkan!');
}

// Memeriksa alarm yang aktif
function startAlarmChecker() {
    setInterval(() => {
        const now = new Date();
        
        alarms.forEach(alarm => {
            if (!alarm.completed) {
                const alarmTime = new Date(alarm.time);
                const timeDiff = alarmTime - now;
                
                // Jika waktu alarm sudah lewat (dalam 1 menit)
                if (timeDiff <= 60000 && timeDiff > -60000) {
                    triggerAlarm(alarm);
                }
            }
        });
    }, 1000); // Cek setiap detik
}

// Menjalankan alarm
function triggerAlarm(alarm) {
    // Hanya trigger jika belum pernah ditrigger
    if (!alarm.triggered) {
        alarm.triggered = true;
        
        // Tampilkan notifikasi
        if (Notification.permission === 'granted') {
            new Notification(`🔔 Alarm ${alarm.activity}`, {
                body: alarm.note,
                icon: '🔔'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
        
        // Tampilkan alert
        alert(`🔔 WAKTUNYA ${alarm.activity.toUpperCase()}!\n\n${alarm.note}`);
        
        // Efek suara sederhana
        playAlarmSound();
        
        renderAlarms();
    }
}

// Efek suara sederhana
function playAlarmSound() {
    try {
        // Gunakan Web Audio API untuk beep sederhana
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.5;
        
        oscillator.start();
        setTimeout(() => oscillator.stop(), 500);
    } catch (e) {
        console.log('Browser tidak mendukung audio');
    }
}

// Menampilkan notifikasi
function showNotification(message) {
    // Toast notification sederhana
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #667eea;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
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
    } else {
        // Buat contoh alarm jika belum ada
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
            time: new Date(now.getTime() + 30 * 60000).toISOString().slice(0, 16),
            note: 'Sarapan pagi',
            completed: false
        },
        {
            id: 2,
            activity: 'Belajar',
            time: new Date(now.getTime() + 60 * 60000).toISOString().slice(0, 16),
            note: 'Belajar JavaScript',
            completed: false
        },
        {
            id: 3,
            activity: 'Kebugaran',
            time: new Date(now.getTime() + 90 * 60000).toISOString().slice(0, 16),
            note: 'Jogging pagi',
            completed: false
        }
    ];
    
    alarms = sampleAlarms;
    saveToLocalStorage();
    renderAlarms();
}

// Menampilkan daftar alarm
function renderAlarms() {
    const alarmList = document.getElementById('alarmList');
    const now = new Date();
    
    if (alarms.length === 0) {
        alarmList.innerHTML = '<div class="empty-state">Belum ada alarm. Tambahkan alarm baru!</div>';
        return;
    }
    
    // Urutkan alarm berdasarkan waktu
    const sortedAlarms = [...alarms].sort((a, b) => new Date(a.time) - new Date(b.time));
    
    alarmList.innerHTML = sortedAlarms.map(alarm => {
        const alarmTime = new Date(alarm.time);
        const timeDiff = alarmTime - now;
        const isActive = timeDiff > 0 && timeDiff <= 3600000 && !alarm.completed; // Aktif jika dalam 1 jam
        const isPast = timeDiff < 0 && !alarm.completed;
        
        let statusText = '';
        if (alarm.completed) statusText = '✅ Selesai';
        else if (isPast) statusText = '⏰ Terlewat';
        else if (isActive) statusText = '🔔 Akan segera aktif';
        
        return `
            <li class="alarm-item ${isActive ? 'active-alarm' : ''}">
                <div class="alarm-info">
                    <strong>${getActivityIcon(alarm.activity)} ${alarm.activity}</strong>
                    <small>${formatDate(alarm.time)}</small>
                    <small style="display: block; color: #666;">${alarm.note}</small>
                    ${statusText ? `<small style="color: ${alarm.completed ? '#28a745' : '#ff6b6b'}">${statusText}</small>` : ''}
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
        // Jika hari ini
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

// Meminta izin notifikasi saat halaman dimuat
if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
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