document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const yearElements = document.querySelectorAll('[data-current-year]');

    yearElements.forEach((element) => {
        element.textContent = new Date().getFullYear();
    });

    const heroVideo = document.querySelector('.commercial-hero__video');
    if (heroVideo) {
        const heroMedia = heroVideo.closest('.commercial-hero__media');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let restartTimer;
        let playbackMonitor;
        let lastPlaybackTime = -1;
        let stalledChecks = 0;
        let usingFallback = false;

        function shouldPlayHeroVideo() {
            return !usingFallback && !reducedMotion.matches && document.visibilityState === 'visible';
        }

        function showAnimatedFallback() {
            if (usingFallback || reducedMotion.matches) {
                return;
            }

            usingFallback = true;
            window.clearInterval(playbackMonitor);
            heroMedia?.classList.add('is-video-stalled');
            heroVideo.pause();
        }

        function playHeroVideo() {
            window.clearTimeout(restartTimer);
            if (!shouldPlayHeroVideo()) {
                heroVideo.pause();
                return;
            }

            const playback = heroVideo.play();
            if (playback) {
                playback.catch(showAnimatedFallback);
            }
        }

        function checkHeroPlayback() {
            if (!shouldPlayHeroVideo() || heroVideo.readyState < 2 || heroVideo.paused) {
                lastPlaybackTime = heroVideo.currentTime;
                stalledChecks = 0;
                return;
            }

            const playbackAdvanced = Math.abs(heroVideo.currentTime - lastPlaybackTime) > 0.04;
            stalledChecks = playbackAdvanced ? 0 : stalledChecks + 1;
            lastPlaybackTime = heroVideo.currentTime;

            if (stalledChecks >= 3) {
                showAnimatedFallback();
            }
        }

        heroVideo.addEventListener('canplay', playHeroVideo);
        heroVideo.addEventListener('pause', () => {
            if (shouldPlayHeroVideo()) {
                restartTimer = window.setTimeout(playHeroVideo, 150);
            }
        });
        heroVideo.addEventListener('ended', () => {
            heroVideo.currentTime = 0;
            playHeroVideo();
        });
        document.addEventListener('visibilitychange', playHeroVideo);
        window.addEventListener('pageshow', playHeroVideo);
        reducedMotion.addEventListener('change', playHeroVideo);
        playbackMonitor = window.setInterval(checkHeroPlayback, 700);
        playHeroVideo();
    }

    if (!menuToggle || !navLinks) {
        return;
    }

    const menuIcon = menuToggle.querySelector('i');

    function setMenu(open) {
        navLinks.classList.toggle('active', open);
        menuToggle.classList.toggle('active', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        document.body.classList.toggle('menu-open', open);

        if (menuIcon) {
            menuIcon.classList.toggle('fa-bars', !open);
            menuIcon.classList.toggle('fa-times', open);
        }
    }

    menuToggle.addEventListener('click', () => {
        setMenu(!navLinks.classList.contains('active'));
    });

    navLinks.addEventListener('click', (event) => {
        if (event.target.closest('a')) {
            setMenu(false);
        }
    });

    document.addEventListener('click', (event) => {
        if (
            navLinks.classList.contains('active') &&
            !navLinks.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            setMenu(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && navLinks.classList.contains('active')) {
            setMenu(false);
            menuToggle.focus();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1180) {
            setMenu(false);
        }
    });

    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener(
            'scroll',
            () => navbar.classList.toggle('scrolled', window.scrollY > 50),
            { passive: true }
        );
    }
});
