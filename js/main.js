document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const yearElements = document.querySelectorAll('[data-current-year]');

    yearElements.forEach((element) => {
        element.textContent = new Date().getFullYear();
    });

    const heroFlyover = document.querySelector('[data-flyover]');
    if (heroFlyover) {
        const slides = Array.from(heroFlyover.querySelectorAll('.commercial-hero__slide'));
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const slideDuration = 7600;
        let currentSlide = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
        let slideTimer;

        function showSlide(index) {
            slides.forEach((slide, slideIndex) => {
                slide.classList.toggle('is-active', slideIndex === index);
            });
            currentSlide = index;
        }

        function stopFlyover() {
            window.clearInterval(slideTimer);
            slideTimer = undefined;
        }

        function startFlyover() {
            stopFlyover();

            if (slides.length < 2 || reducedMotion.matches || document.visibilityState !== 'visible') {
                return;
            }

            slideTimer = window.setInterval(() => {
                showSlide((currentSlide + 1) % slides.length);
            }, slideDuration);
        }

        if (slides.length) {
            showSlide(currentSlide);
            startFlyover();
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                startFlyover();
            } else {
                stopFlyover();
            }
        });

        window.addEventListener('pageshow', startFlyover);
        reducedMotion.addEventListener('change', () => {
            if (reducedMotion.matches) {
                stopFlyover();
                showSlide(0);
            } else {
                startFlyover();
            }
        });
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
