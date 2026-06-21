// LanPlayer — макет дизайна. Вся логика ниже имитирует поведение интерфейса,
// без реального аудио — это нужно только для демонстрации UI.

const trackList = document.getElementById('trackList');
const albumGrid = document.getElementById('albumGrid');
const switchBtns = document.querySelectorAll('.switch-btn');
const viewTitle = document.getElementById('viewTitle');
const navItems = document.querySelectorAll('.nav-item');

function setMode(mode) {
  switchBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  trackList.classList.toggle('visible', mode === 'list');
  albumGrid.classList.toggle('visible', mode === 'grid');
}
switchBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
setMode('list');

const viewTitles = {
  songs: 'Песни',
  albums: 'Альбомы',
  artists: 'Исполнители',
  folders: 'Папки общей сети',
  playlist: 'Плейлист',
};
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    viewTitle.textContent = item.textContent.trim();
    if (item.dataset.view === 'albums') setMode('grid');
    else if (item.dataset.view === 'songs') setMode('list');
  });
});

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('lanplayer-theme', theme);
}
applyTheme(localStorage.getItem('lanplayer-theme') || 'light');
themeToggle.addEventListener('click', () => {
  applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
});

// Play / pause
const playBtn = document.getElementById('playBtn');
const iconPlay = playBtn.querySelector('.icon-play');
const iconPause = playBtn.querySelector('.icon-pause');
let playing = true;
playBtn.addEventListener('click', () => {
  playing = !playing;
  iconPlay.style.display = playing ? 'none' : 'block';
  iconPause.style.display = playing ? 'block' : 'none';
});

['shuffleBtn', 'repeatBtn'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => e.currentTarget.classList.toggle('active'));
});

// Draggable seek bar
function makeDraggable(bar, fill, thumb) {
  function setFromEvent(e) {
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    fill.style.width = `${pct * 100}%`;
    if (thumb) thumb.style.left = `${pct * 100}%`;
  }
  bar.addEventListener('mousedown', e => {
    setFromEvent(e);
    const move = ev => setFromEvent(ev);
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}
makeDraggable(document.getElementById('seekBar'), document.getElementById('seekFill'), document.getElementById('seekThumb'));
makeDraggable(document.getElementById('volBar'), document.getElementById('volFill'), null);
