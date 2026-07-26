document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const yearElements = document.querySelectorAll('[data-current-year]');

    yearElements.forEach((element) => {
        element.textContent = new Date().getFullYear();
    });

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
        if (window.innerWidth > 768) {
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
