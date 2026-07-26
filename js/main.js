document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('[data-header]');
    const menuButton = document.querySelector('.menu-toggle');
    const navigation = document.querySelector('.primary-nav');
    const year = document.getElementById('currentYear');

    const updateHeader = () => {
        header?.classList.toggle('is-scrolled', window.scrollY > 24);
    };

    const closeMenu = () => {
        if (!menuButton || !navigation) return;
        menuButton.setAttribute('aria-expanded', 'false');
        navigation.classList.remove('is-open');
        document.body.classList.remove('menu-open');
    };

    menuButton?.addEventListener('click', () => {
        const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
        menuButton.setAttribute('aria-expanded', String(willOpen));
        navigation?.classList.toggle('is-open', willOpen);
        document.body.classList.toggle('menu-open', willOpen);
    });

    navigation?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 980) closeMenu();
    });

    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();

    if (year) year.textContent = String(new Date().getFullYear());
});
