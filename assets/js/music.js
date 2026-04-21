(function () {
    const TRACKS = [
        'assets/sound/music4.mp3',
        'assets/sound/music5.mp3',
        'assets/sound/music6.mp3',
        'assets/sound/piano1.mp3',
        'assets/sound/piano2.mp3',
        'assets/sound/sound3.mp3'
    ];

    const KEY_TRACK = 'mem_music_track';
    const KEY_TIME  = 'mem_music_time';
    const KEY_MUTED = 'mem_music_muted';

    // Pick a random track, avoiding repeating the last one
    function pickNextTrack(current) {
        const pool = current ? TRACKS.filter(t => t !== current) : TRACKS;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    if (!sessionStorage.getItem(KEY_TRACK)) {
        sessionStorage.setItem(KEY_TRACK, pickNextTrack(null));
    }

    const audio = new Audio(sessionStorage.getItem(KEY_TRACK));
    audio.loop   = false;
    audio.volume = 0.4;

    let currentTrack = sessionStorage.getItem(KEY_TRACK);

    // When a track ends, pick a different one and play it
    audio.addEventListener('ended', function () {
        currentTrack = pickNextTrack(currentTrack);
        sessionStorage.setItem(KEY_TRACK, currentTrack);
        sessionStorage.setItem(KEY_TIME, '0');
        audio.src = currentTrack;
        audio.play().catch(() => {});
    });

    let muted   = sessionStorage.getItem(KEY_MUTED) === '1';
    let playing = false;

    function setIcon(isPlaying) {
        const on  = document.getElementById('musicIconOn');
        const off = document.getElementById('musicIconOff');
        if (!on || !off) return;
        on.style.display  = isPlaying ? '' : 'none';
        off.style.display = isPlaying ? 'none' : '';
    }

    function startAudio() {
        const t = parseFloat(sessionStorage.getItem(KEY_TIME) || '0');
        if (t > 0) audio.currentTime = t;
        audio.play().then(() => {
            playing = true;
            setIcon(true);
            removeListeners();
        }).catch(() => {});
    }

    function tryAutoplay() {
        if (muted) return;
        startAudio();
    }

    function removeListeners() {
        document.removeEventListener('click',      tryAutoplay);
        document.removeEventListener('keydown',    tryAutoplay);
        document.removeEventListener('scroll',     tryAutoplay);
        document.removeEventListener('touchstart', tryAutoplay);
        document.removeEventListener('mousemove',  tryAutoplay);
    }

    // Save position before navigating away
    window.addEventListener('pagehide', function () {
        sessionStorage.setItem(KEY_TIME, audio.currentTime);
    });

    if (!muted) {
        // Attempt immediate autoplay — works if browser policy allows it
        startAudio();

        // If browser blocks it, start on very first interaction
        if (!playing) {
            document.addEventListener('click',      tryAutoplay);
            document.addEventListener('keydown',    tryAutoplay);
            document.addEventListener('scroll',     tryAutoplay);
            document.addEventListener('touchstart', tryAutoplay);
            document.addEventListener('mousemove',  tryAutoplay);
        }
    }

    // Wire button after DOM is ready
    function initButton() {
        const btn = document.getElementById('musicToggle');
        if (!btn) return;
        setIcon(!muted && playing);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (playing) {
                audio.pause();
                playing = false;
                muted   = true;
                sessionStorage.setItem(KEY_MUTED, '1');
                setIcon(false);
                removeListeners();
            } else {
                muted = false;
                sessionStorage.setItem(KEY_MUTED, '0');
                startAudio();
                if (!playing) {
                    document.addEventListener('click',      tryAutoplay);
                    document.addEventListener('keydown',    tryAutoplay);
                    document.addEventListener('scroll',     tryAutoplay);
                    document.addEventListener('touchstart', tryAutoplay);
                    document.addEventListener('mousemove',  tryAutoplay);
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButton);
    } else {
        initButton();
    }
})();
