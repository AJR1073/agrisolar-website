(function() {
    'use strict';

    const SCHEDULE_STATUSES = [
        'Planned',
        'Scheduling needed',
        'Scheduled',
        'In progress',
        'Partially completed',
        'Completed',
        'Weather delayed',
        'Customer delayed',
        'Rescheduled',
        'Cancelled'
    ];

    const COMPLETED_STATUSES = new Set(['Completed', 'Cancelled']);
    const DELAYED_STATUSES = new Set([
        'Weather delayed',
        'Customer delayed',
        'Rescheduled'
    ]);

    const state = {
        companies: {},
        sites: {},
        seasons: {},
        services: {},
        selectedYear: new Date().getFullYear(),
        view: 'grid',
        status: 'all',
        sort: 'site',
        search: '',
        loaded: false
    };

    function escapeScheduleHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function notify(message, type = 'info') {
        if (typeof window.showMessage === 'function') {
            window.showMessage(message, type);
            return;
        }

        window.alert(message);
    }

    function toNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function cleanText(value) {
        return String(value || '').trim();
    }

    function optionalText(value) {
        const cleaned = cleanText(value);
        return cleaned || null;
    }

    function slugStatus(status) {
        return cleanText(status)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function formatAcres(value) {
        const acres = toNumber(value);
        return `${acres.toLocaleString(undefined, {
            maximumFractionDigits: 2
        })} ac`;
    }

    function formatDate(value, monthOnly = false) {
        if (!value) {
            return '';
        }

        const date = monthOnly
            ? new Date(`${value}-01T12:00:00`)
            : new Date(`${value}T12:00:00`);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString(undefined, monthOnly
            ? { month: 'short', year: 'numeric' }
            : { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getCompany(companyId) {
        return state.companies[companyId] || {};
    }

    function getSite(siteId) {
        return state.sites[siteId] || {};
    }

    function getSeason(seasonId) {
        return state.seasons[seasonId] || {};
    }

    function getServiceDisplayDate(service) {
        if (service.completedOn) {
            return `Completed ${formatDate(service.completedOn)}`;
        }

        if (service.completionMonth) {
            return `Completed ${formatDate(service.completionMonth, true)}`;
        }

        if (service.confirmedScheduledOn) {
            return `Confirmed ${formatDate(service.confirmedScheduledOn)}`;
        }

        if (service.tentativeScheduledOn) {
            return `Tentative ${formatDate(service.tentativeScheduledOn)}`;
        }

        if (service.plannedMonth) {
            return `Planned ${formatDate(service.plannedMonth, true)}`;
        }

        return 'Date not set';
    }

    function getScheduleDate(service) {
        return service.confirmedScheduledOn
            || service.tentativeScheduledOn
            || (service.plannedMonth ? `${service.plannedMonth}-01` : '');
    }

    function isOverdue(service) {
        if (COMPLETED_STATUSES.has(service.status)) {
            return false;
        }

        const dateValue = service.confirmedScheduledOn || service.tentativeScheduledOn;
        if (!dateValue) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const scheduledDate = new Date(`${dateValue}T00:00:00`);
        return scheduledDate < today;
    }

    function needsScheduling(service) {
        return service.status === 'Scheduling needed'
            || service.status === 'Planned'
            || (!service.confirmedScheduledOn
                && !service.tentativeScheduledOn
                && !COMPLETED_STATUSES.has(service.status));
    }

    function serviceMatchesSearch(service) {
        if (!state.search) {
            return true;
        }

        const site = getSite(service.solarSiteId);
        const company = getCompany(service.companyId);
        const searchValue = [
            site.name,
            site.location,
            company.name,
            service.serviceType,
            service.status,
            service.assignedCrew,
            service.assignedEquipment
        ].join(' ').toLowerCase();

        return searchValue.includes(state.search);
    }

    function getYearServices() {
        return Object.entries(state.services)
            .map(([id, service]) => ({ id, ...service }))
            .filter(service => Number(service.serviceYear) === state.selectedYear);
    }

    function getVisibleServices() {
        let services = getYearServices().filter(serviceMatchesSearch);

        if (state.status !== 'all') {
            services = services.filter(service => service.status === state.status);
        }

        if (state.view === 'scheduling') {
            services = services.filter(needsScheduling);
        } else if (state.view === 'invoicing') {
            services = services.filter(service => service.readyForInvoicing === true);
        } else if (state.view === 'delayed') {
            services = services.filter(service =>
                DELAYED_STATUSES.has(service.status) || isOverdue(service)
            );
        }

        return services.sort((left, right) => {
            const leftSite = getSite(left.solarSiteId).name || '';
            const rightSite = getSite(right.solarSiteId).name || '';

            if (state.sort === 'date') {
                return (getScheduleDate(left) || '9999-99-99')
                    .localeCompare(getScheduleDate(right) || '9999-99-99');
            }

            if (state.sort === 'status') {
                return left.status.localeCompare(right.status)
                    || leftSite.localeCompare(rightSite);
            }

            if (state.sort === 'cycle') {
                return toNumber(left.mowingCycleNumber) - toNumber(right.mowingCycleNumber)
                    || leftSite.localeCompare(rightSite);
            }

            return leftSite.localeCompare(rightSite)
                || toNumber(left.mowingCycleNumber) - toNumber(right.mowingCycleNumber);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const scheduleYear = document.getElementById('scheduleYear');
        const scheduleTotals = document.getElementById('scheduleTotals');
        const scheduleLoading = document.getElementById('scheduleLoading');
        const scheduleGridView = document.getElementById('scheduleGridView');
        const scheduleListView = document.getElementById('scheduleListView');
        const scheduleCalendarView = document.getElementById('scheduleCalendarView');
        const scheduleHistoryView = document.getElementById('scheduleHistoryView');
        const scheduleStatusFilter = document.getElementById('scheduleStatusFilter');
        const scheduleSort = document.getElementById('scheduleSort');
        const scheduleSearch = document.getElementById('scheduleSearch');
        const addScheduleSiteBtn = document.getElementById('addScheduleSiteBtn');
        const siteSeasonModal = document.getElementById('siteSeasonModal');
        const siteSeasonForm = document.getElementById('siteSeasonForm');
        const serviceEditorModal = document.getElementById('serviceEditorModal');
        const serviceEditorForm = document.getElementById('serviceEditorForm');
        const createFollowUpBtn = document.getElementById('createFollowUpBtn');

        if (!scheduleYear || !siteSeasonForm || !serviceEditorForm) {
            return;
        }

        const database = firebase.database();
        const auth = firebase.auth();

        function populateYearOptions() {
            const currentYear = new Date().getFullYear();
            const years = new Set([currentYear, state.selectedYear, 2026]);

            Object.values(state.seasons).forEach(season => {
                if (Number.isInteger(Number(season.serviceYear))) {
                    years.add(Number(season.serviceYear));
                }
            });

            for (let year = currentYear - 2; year <= currentYear + 5; year += 1) {
                years.add(year);
            }

            scheduleYear.innerHTML = [...years]
                .sort((a, b) => a - b)
                .map(year => `
                    <option value="${year}" ${year === state.selectedYear ? 'selected' : ''}>
                        ${year}
                    </option>
                `).join('');
        }

        async function loadScheduleData() {
            if (!auth.currentUser) {
                return;
            }

            state.loaded = false;
            scheduleLoading.hidden = false;
            scheduleLoading.textContent = 'Loading annual schedule…';
            scheduleGridView.innerHTML = '';
            scheduleListView.innerHTML = '';
            scheduleCalendarView.innerHTML = '';
            scheduleHistoryView.innerHTML = '';

            try {
                const [companies, sites, seasons, services] = await Promise.all([
                    database.ref('companies').once('value'),
                    database.ref('solar_sites').once('value'),
                    database.ref('service_seasons').once('value'),
                    database.ref('scheduled_services').once('value')
                ]);

                state.companies = companies.val() || {};
                state.sites = sites.val() || {};
                state.seasons = seasons.val() || {};
                state.services = services.val() || {};
                state.loaded = true;
                populateYearOptions();
                renderSchedule();
            } catch (error) {
                console.error('Unable to load annual schedule:', error);
                scheduleLoading.hidden = false;
                scheduleLoading.textContent =
                    'The annual schedule could not be loaded. Confirm administrator access and try again.';
                notify('Unable to load the annual schedule.', 'error');
            }
        }

        function calculateTotals(services) {
            const activeServices = services.filter(service => service.status !== 'Cancelled');
            const scheduledAcres = activeServices.reduce(
                (total, service) => total + toNumber(service.estimatedAcresToService),
                0
            );
            const completedAcres = activeServices.reduce(
                (total, service) => total + toNumber(service.actualAcresCompleted),
                0
            );
            const currentMonth = new Date().toISOString().slice(0, 7);
            const monthAcres = activeServices.reduce((total, service) => {
                const date = service.confirmedScheduledOn || service.tentativeScheduledOn;
                return date?.startsWith(currentMonth)
                    ? total + toNumber(service.estimatedAcresToService)
                    : total;
            }, 0);
            const awaitingSites = new Set(
                activeServices.filter(needsScheduling).map(service => service.solarSiteId)
            ).size;
            const delayed = activeServices.filter(service =>
                DELAYED_STATUSES.has(service.status) || isOverdue(service)
            ).length;
            const ready = activeServices.filter(service =>
                service.readyForInvoicing === true
            ).length;

            return {
                scheduledAcres,
                monthAcres,
                completedAcres,
                remainingAcres: Math.max(0, scheduledAcres - completedAcres),
                awaitingSites,
                delayed,
                ready
            };
        }

        function renderTotals(services) {
            const totals = calculateTotals(services);
            const cards = [
                [formatAcres(totals.scheduledAcres), 'Total scheduled acres'],
                [formatAcres(totals.monthAcres), 'Acres scheduled this month'],
                [formatAcres(totals.completedAcres), 'Acres completed this season'],
                [formatAcres(totals.remainingAcres), 'Acres remaining'],
                [totals.awaitingSites, 'Sites awaiting scheduling'],
                [totals.delayed, 'Visits overdue or delayed'],
                [totals.ready, 'Visits ready for invoicing']
            ];

            scheduleTotals.innerHTML = cards.map(([value, label]) => `
                <div class="schedule-total-card">
                    <strong>${escapeScheduleHtml(value)}</strong>
                    <span>${escapeScheduleHtml(label)}</span>
                </div>
            `).join('');
        }

        function renderEmpty(container, heading, message) {
            container.innerHTML = `
                <div class="schedule-empty">
                    <h3>${escapeScheduleHtml(heading)}</h3>
                    <p>${escapeScheduleHtml(message)}</p>
                </div>
            `;
        }

        function renderGrid(services) {
            if (!services.length) {
                const allYearServices = getYearServices();
                renderEmpty(
                    scheduleGridView,
                    allYearServices.length ? 'No matching mowing cycles' : `No ${state.selectedYear} schedule yet`,
                    allYearServices.length
                        ? 'Adjust the search or status filter to see more records.'
                        : 'Use “Add site and season” to enter reviewed records.'
                );
                return;
            }

            const allYearServices = getYearServices();
            const maxCycle = Math.max(
                4,
                ...allYearServices.map(service => toNumber(service.mowingCycleNumber, 1))
            );
            const servicesBySite = services.reduce((groups, service) => {
                if (!groups[service.solarSiteId]) {
                    groups[service.solarSiteId] = [];
                }
                groups[service.solarSiteId].push(service);
                return groups;
            }, {});
            const siteIds = Object.keys(servicesBySite).sort((left, right) =>
                (getSite(left).name || '').localeCompare(getSite(right).name || '')
            );

            const headers = Array.from({ length: maxCycle }, (_, index) =>
                `<th scope="col">Mow ${index + 1}</th>`
            ).join('');

            const rows = siteIds.map(siteId => {
                const site = getSite(siteId);
                const siteServices = servicesBySite[siteId];
                const company = getCompany(site.companyId || siteServices[0]?.companyId);
                const season = getSeason(siteServices[0]?.serviceSeasonId);
                const byCycle = new Map(
                    siteServices.map(service => [Number(service.mowingCycleNumber), service])
                );

                const cycleCells = Array.from({ length: maxCycle }, (_, index) => {
                    const cycle = index + 1;
                    const service = byCycle.get(cycle);

                    if (!service) {
                        return `
                            <td class="mowing-cycle-cell">
                                <span class="empty-cycle">No matching record</span>
                            </td>
                        `;
                    }

                    return `
                        <td class="mowing-cycle-cell">
                            <button
                                type="button"
                                class="mowing-cycle-button status-${escapeScheduleHtml(slugStatus(service.status))}"
                                data-schedule-action="edit-service"
                                data-service-id="${escapeScheduleHtml(service.id)}"
                            >
                                <span class="cycle-status">${escapeScheduleHtml(service.status)}</span>
                                <span class="cycle-date">${escapeScheduleHtml(getServiceDisplayDate(service))}</span>
                                <span class="cycle-acres">
                                    ${escapeScheduleHtml(formatAcres(service.actualAcresCompleted))}
                                    completed
                                </span>
                            </button>
                        </td>
                    `;
                }).join('');

                return `
                    <tr>
                        <td class="site-column">
                            <span class="schedule-site-name">${escapeScheduleHtml(site.name || 'Unnamed site')}</span>
                            <span class="schedule-site-meta">${escapeScheduleHtml(company.name || 'Company not set')}</span>
                            <span class="schedule-site-meta">${escapeScheduleHtml(site.location || 'Location not set')}</span>
                            <span class="schedule-site-meta">
                                ${escapeScheduleHtml(formatAcres(season.contractAcreage ?? site.acreage))}
                            </span>
                        </td>
                        ${cycleCells}
                    </tr>
                `;
            }).join('');

            scheduleGridView.innerHTML = `
                <div class="schedule-table-wrap">
                    <table class="annual-schedule-table">
                        <thead>
                            <tr>
                                <th scope="col" class="site-column">Solar site</th>
                                ${headers}
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        function renderList(services) {
            if (!services.length) {
                renderEmpty(
                    scheduleListView,
                    'No matching mowing cycles',
                    'Adjust the selected view, search, or status filter.'
                );
                return;
            }

            const rows = services.map(service => {
                const site = getSite(service.solarSiteId);
                const company = getCompany(service.companyId);
                const delayed = DELAYED_STATUSES.has(service.status) || isOverdue(service);

                return `
                    <tr>
                        <td>
                            <strong>${escapeScheduleHtml(site.name || 'Unnamed site')}</strong><br>
                            <small>${escapeScheduleHtml(site.location || '')}</small>
                        </td>
                        <td>${escapeScheduleHtml(company.name || 'Not set')}</td>
                        <td>Mow ${escapeScheduleHtml(service.mowingCycleNumber)}</td>
                        <td><span class="cycle-status">${escapeScheduleHtml(service.status)}</span></td>
                        <td>${escapeScheduleHtml(getServiceDisplayDate(service))}</td>
                        <td>${escapeScheduleHtml(formatAcres(service.estimatedAcresToService))}</td>
                        <td>${escapeScheduleHtml(formatAcres(service.actualAcresCompleted))}</td>
                        <td>${service.readyForInvoicing ? 'Yes' : 'No'}</td>
                        <td>${delayed ? 'Yes' : 'No'}</td>
                        <td>
                            <button
                                type="button"
                                class="action-btn"
                                data-schedule-action="edit-service"
                                data-service-id="${escapeScheduleHtml(service.id)}"
                            >
                                Open
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            scheduleListView.innerHTML = `
                <div class="schedule-table-wrap">
                    <table class="schedule-list-table">
                        <thead>
                            <tr>
                                <th scope="col">Site</th>
                                <th scope="col">Company</th>
                                <th scope="col">Cycle</th>
                                <th scope="col">Status</th>
                                <th scope="col">Schedule / completion</th>
                                <th scope="col">Estimated</th>
                                <th scope="col">Completed</th>
                                <th scope="col">Ready to invoice</th>
                                <th scope="col">Delayed / overdue</th>
                                <th scope="col">Action</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        function renderCalendar(services) {
            const datedServices = services
                .filter(service => {
                    const dateValue = service.confirmedScheduledOn
                        || service.tentativeScheduledOn;
                    return dateValue?.startsWith(`${state.selectedYear}-`);
                })
                .sort((left, right) => (
                    (left.confirmedScheduledOn || left.tentativeScheduledOn)
                        .localeCompare(right.confirmedScheduledOn || right.tentativeScheduledOn)
                    || toNumber(left.mowingCycleNumber) - toNumber(right.mowingCycleNumber)
                ));

            if (!datedServices.length) {
                renderEmpty(
                    scheduleCalendarView,
                    `No scheduled dates in ${state.selectedYear}`,
                    'The calendar shows tentative and confirmed dates only. Planned months remain in the annual grid until an exact date is entered.'
                );
                return;
            }

            const servicesByMonth = Array.from({ length: 12 }, () => []);
            datedServices.forEach(service => {
                const dateValue = service.confirmedScheduledOn
                    || service.tentativeScheduledOn;
                const monthIndex = Number(dateValue.slice(5, 7)) - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    servicesByMonth[monthIndex].push(service);
                }
            });

            const months = servicesByMonth.map((monthServices, monthIndex) => {
                const monthName = new Date(
                    state.selectedYear,
                    monthIndex,
                    1
                ).toLocaleDateString(undefined, { month: 'long' });
                const events = monthServices.length
                    ? monthServices.map(service => {
                        const site = getSite(service.solarSiteId);
                        const dateValue = service.confirmedScheduledOn
                            || service.tentativeScheduledOn;
                        const dateType = service.confirmedScheduledOn
                            ? 'Confirmed'
                            : 'Tentative';

                        return `
                            <button
                                type="button"
                                class="schedule-calendar-event status-${escapeScheduleHtml(slugStatus(service.status))}"
                                data-schedule-action="edit-service"
                                data-service-id="${escapeScheduleHtml(service.id)}"
                            >
                                <span class="schedule-calendar-day">${escapeScheduleHtml(Number(dateValue.slice(8, 10)))}</span>
                                <span class="schedule-calendar-details">
                                    <strong>${escapeScheduleHtml(site.name || 'Unnamed site')}</strong>
                                    <span>Mow ${escapeScheduleHtml(service.mowingCycleNumber)} · ${escapeScheduleHtml(dateType)}</span>
                                    <span>${escapeScheduleHtml(service.status)}</span>
                                </span>
                            </button>
                        `;
                    }).join('')
                    : '<p class="schedule-calendar-empty">No scheduled dates</p>';

                return `
                    <section class="schedule-calendar-month">
                        <h3>${escapeScheduleHtml(monthName)}</h3>
                        <div class="schedule-calendar-events">${events}</div>
                    </section>
                `;
            }).join('');

            scheduleCalendarView.innerHTML = `
                <div class="schedule-view-note">
                    Calendar dates are exact tentative or confirmed dates. Planned months are not converted into invented dates.
                </div>
                <div class="schedule-calendar-grid">${months}</div>
            `;
        }

        function getHistoryServices() {
            let services = Object.entries(state.services)
                .map(([id, service]) => ({ id, ...service }))
                .filter(service => (
                    service.status === 'Completed'
                    && (service.completedOn || service.completionMonth)
                    && serviceMatchesSearch(service)
                ));

            if (state.status !== 'all') {
                services = services.filter(service => service.status === state.status);
            }

            return services.sort((left, right) => {
                const leftDate = left.completedOn
                    || `${left.completionMonth || '0000-00'}-00`;
                const rightDate = right.completedOn
                    || `${right.completionMonth || '0000-00'}-00`;
                return rightDate.localeCompare(leftDate);
            });
        }

        function renderHistory(services) {
            if (!services.length) {
                renderEmpty(
                    scheduleHistoryView,
                    'No completed mowing history',
                    'Completed visits with an exact date or preserved completion month will appear here across all service years.'
                );
                return;
            }

            const servicesBySite = services.reduce((groups, service) => {
                if (!groups[service.solarSiteId]) {
                    groups[service.solarSiteId] = [];
                }
                groups[service.solarSiteId].push(service);
                return groups;
            }, {});
            const siteIds = Object.keys(servicesBySite).sort((left, right) =>
                (getSite(left).name || '').localeCompare(getSite(right).name || '')
            );

            scheduleHistoryView.innerHTML = `
                <div class="schedule-view-note">
                    Site history includes completed mowing records from every service year. A month-only record remains month-only.
                </div>
                <div class="schedule-history-grid">
                    ${siteIds.map(siteId => {
                        const site = getSite(siteId);
                        const siteServices = servicesBySite[siteId];
                        const company = getCompany(
                            site.companyId || siteServices[0]?.companyId
                        );

                        return `
                            <section class="schedule-history-card">
                                <header>
                                    <div>
                                        <h3>${escapeScheduleHtml(site.name || 'Unnamed site')}</h3>
                                        <p>${escapeScheduleHtml(company.name || 'Company not set')}</p>
                                    </div>
                                    <span>${escapeScheduleHtml(site.location || 'Location not set')}</span>
                                </header>
                                <ol class="schedule-history-list">
                                    ${siteServices.map(service => {
                                        const completion = service.completedOn
                                            ? formatDate(service.completedOn)
                                            : formatDate(service.completionMonth, true);
                                        const precision = service.completedOn
                                            ? 'Exact completion date'
                                            : 'Completion month recorded';

                                        return `
                                            <li>
                                                <button
                                                    type="button"
                                                    data-schedule-action="edit-service"
                                                    data-service-id="${escapeScheduleHtml(service.id)}"
                                                >
                                                    <span class="schedule-history-date">
                                                        ${escapeScheduleHtml(completion)}
                                                        <small>${escapeScheduleHtml(precision)}</small>
                                                    </span>
                                                    <span class="schedule-history-service">
                                                        <strong>${escapeScheduleHtml(service.serviceYear)} · Mow ${escapeScheduleHtml(service.mowingCycleNumber)}</strong>
                                                        <span>${escapeScheduleHtml(service.serviceType || 'Commercial mowing')}</span>
                                                    </span>
                                                    <span class="schedule-history-acres">
                                                        ${escapeScheduleHtml(formatAcres(service.actualAcresCompleted))}
                                                    </span>
                                                </button>
                                            </li>
                                        `;
                                    }).join('')}
                                </ol>
                            </section>
                        `;
                    }).join('')}
                </div>
            `;
        }

        function renderSchedule() {
            if (!state.loaded) {
                return;
            }

            scheduleLoading.hidden = true;
            const yearServices = getYearServices();
            const visibleServices = getVisibleServices();
            renderTotals(yearServices);

            scheduleGridView.hidden = state.view !== 'grid';
            scheduleListView.hidden = ![
                'list',
                'scheduling',
                'invoicing',
                'delayed'
            ].includes(state.view);
            scheduleCalendarView.hidden = state.view !== 'calendar';
            scheduleHistoryView.hidden = state.view !== 'history';

            if (state.view === 'grid') {
                renderGrid(visibleServices);
            } else if (state.view === 'calendar') {
                renderCalendar(visibleServices);
            } else if (state.view === 'history') {
                renderHistory(getHistoryServices());
            } else {
                renderList(visibleServices);
            }
        }

        function openModal(modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
            window.setTimeout(() => firstInput?.focus(), 0);
        }

        function closeModal(modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }

        function openSiteSeasonModal() {
            siteSeasonForm.reset();
            document.getElementById('scheduleSeasonYear').value = state.selectedYear;
            document.getElementById('schedulePlannedCycles').value = 4;
            openModal(siteSeasonModal);
        }

        function setEditorValue(id, value) {
            const field = document.getElementById(id);
            if (field) {
                field.value = value ?? '';
            }
        }

        function openServiceEditor(serviceId) {
            const service = state.services[serviceId];
            if (!service) {
                notify('That mowing-cycle record could not be found.', 'error');
                return;
            }

            const site = getSite(service.solarSiteId);
            const company = getCompany(service.companyId);

            setEditorValue('scheduledServiceId', serviceId);
            setEditorValue('serviceCycleNumber', service.mowingCycleNumber);
            setEditorValue('serviceType', service.serviceType);
            setEditorValue('serviceStatus', service.status);
            setEditorValue('servicePlannedMonth', service.plannedMonth);
            setEditorValue('serviceTentativeDate', service.tentativeScheduledOn);
            setEditorValue('serviceConfirmedDate', service.confirmedScheduledOn);
            setEditorValue('serviceStartedDate', service.startedOn);
            setEditorValue('serviceCompletedDate', service.completedOn);
            setEditorValue('serviceCompletionMonth',
                service.completionDatePrecision === 'month_only'
                    ? service.completionMonth
                    : ''
            );
            setEditorValue('serviceEstimatedAcres', service.estimatedAcresToService);
            setEditorValue('serviceActualAcres', service.actualAcresCompleted);
            setEditorValue('serviceTargetHeight', service.targetVegetationHeight);
            setEditorValue('serviceCrew', service.assignedCrew);
            setEditorValue('serviceEquipment', service.assignedEquipment);
            setEditorValue('serviceReschedulingReason', service.reschedulingReason);
            setEditorValue('serviceCompletionNotes', service.completionNotes);
            setEditorValue('serviceHazards', service.problemsOrHazards);
            document.getElementById('serviceWeatherDelay').checked =
                service.weatherDelay === true;
            document.getElementById('serviceFollowUp').checked =
                service.followUpRequired === true;
            document.getElementById('serviceReadyInvoice').checked =
                service.readyForInvoicing === true;
            document.getElementById('serviceEditorContext').textContent =
                `${company.name || 'Company not set'} • ${site.name || 'Unnamed site'}`;

            openModal(serviceEditorModal);
        }

        siteSeasonForm.addEventListener('submit', async event => {
            event.preventDefault();

            const user = auth.currentUser;
            if (!user) {
                notify('Sign in before creating schedule records.', 'error');
                return;
            }

            const submitButton = siteSeasonForm.querySelector('button[type="submit"]');
            const companyName = cleanText(
                document.getElementById('scheduleCompanyName').value
            );
            const siteName = cleanText(
                document.getElementById('scheduleSiteName').value
            );
            const location = cleanText(
                document.getElementById('scheduleSiteLocation').value
            );
            const serviceYear = Number(
                document.getElementById('scheduleSeasonYear').value
            );
            const acreage = Number(
                document.getElementById('scheduleSiteAcreage').value
            );
            const targetHeight = cleanText(
                document.getElementById('scheduleHeightRequirement').value
            );
            const plannedCycles = Number(
                document.getElementById('schedulePlannedCycles').value
            );

            if (
                !companyName
                || !siteName
                || !location
                || !Number.isInteger(serviceYear)
                || serviceYear < 2020
                || serviceYear > 2100
                || !Number.isFinite(acreage)
                || acreage <= 0
                || !Number.isInteger(plannedCycles)
                || plannedCycles < 1
                || plannedCycles > 20
            ) {
                notify('Review the required site and season fields.', 'error');
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Creating…';

            try {
                const companyEntry = Object.entries(state.companies).find(([, company]) =>
                    cleanText(company.name).toLowerCase() === companyName.toLowerCase()
                );
                const companyId = companyEntry?.[0]
                    || database.ref('companies').push().key;
                const siteId = database.ref('solar_sites').push().key;
                const seasonId = database.ref('service_seasons').push().key;
                const timestamp = firebase.database.ServerValue.TIMESTAMP;
                const updates = {};

                if (!companyEntry) {
                    updates[`companies/${companyId}`] = {
                        name: companyName,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        administratorUid: user.uid
                    };
                }

                updates[`solar_sites/${siteId}`] = {
                    companyId,
                    name: siteName,
                    location,
                    acreage,
                    targetVegetationHeight: targetHeight,
                    active: true,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    administratorUid: user.uid
                };

                updates[`service_seasons/${seasonId}`] = {
                    serviceYear,
                    companyId,
                    solarSiteId: siteId,
                    plannedMowingCycles: plannedCycles,
                    plannedOtherServices: '',
                    contractAcreage: acreage,
                    targetVegetationHeight: targetHeight,
                    contractStatus: 'Active',
                    renewalStatus: 'Not reviewed',
                    renewalNotes: '',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    administratorUid: user.uid
                };

                for (let cycle = 1; cycle <= plannedCycles; cycle += 1) {
                    const serviceId = database.ref('scheduled_services').push().key;
                    updates[`scheduled_services/${serviceId}`] = {
                        serviceSeasonId: seasonId,
                        serviceYear,
                        companyId,
                        solarSiteId: siteId,
                        mowingCycleNumber: cycle,
                        serviceType: 'Commercial mowing',
                        status: 'Scheduling needed',
                        siteAcreage: acreage,
                        estimatedAcresToService: acreage,
                        actualAcresCompleted: 0,
                        targetVegetationHeight: targetHeight,
                        completionDatePrecision: 'unknown',
                        assignedCrew: '',
                        assignedEquipment: '',
                        reschedulingReason: '',
                        completionNotes: '',
                        problemsOrHazards: '',
                        weatherDelay: false,
                        followUpRequired: false,
                        readyForInvoicing: false,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        administratorUid: user.uid
                    };
                }

                await database.ref().update(updates);
                state.selectedYear = serviceYear;
                closeModal(siteSeasonModal);
                notify('Site, annual season, and mowing cycles created.', 'success');
                await loadScheduleData();
            } catch (error) {
                console.error('Unable to create site and season:', error);
                notify('Unable to create the site and annual season.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Create site and season';
            }
        });

        serviceEditorForm.addEventListener('submit', async event => {
            event.preventDefault();

            const user = auth.currentUser;
            const serviceId = document.getElementById('scheduledServiceId').value;
            const existing = state.services[serviceId];
            if (!user || !existing) {
                notify('The mowing-cycle record is unavailable.', 'error');
                return;
            }

            const completedOn = document.getElementById('serviceCompletedDate').value;
            const completionMonth =
                document.getElementById('serviceCompletionMonth').value;
            const status = document.getElementById('serviceStatus').value;
            const cycleNumber = Number(
                document.getElementById('serviceCycleNumber').value
            );
            const serviceType = cleanText(
                document.getElementById('serviceType').value
            );
            const readyForInvoicing =
                document.getElementById('serviceReadyInvoice').checked;

            if (completedOn && completionMonth) {
                notify(
                    'Enter either an exact completion date or a month-only completion, not both.',
                    'error'
                );
                return;
            }

            if (!SCHEDULE_STATUSES.includes(status)) {
                notify('Choose a valid mowing-cycle status.', 'error');
                return;
            }

            if (
                !Number.isInteger(cycleNumber)
                || cycleNumber < 1
                || cycleNumber > 50
                || !serviceType
            ) {
                notify('Review the mowing-cycle number and service type.', 'error');
                return;
            }

            const duplicateCycle = Object.entries(state.services).some(
                ([otherId, service]) =>
                    otherId !== serviceId
                    && service.serviceSeasonId === existing.serviceSeasonId
                    && Number(service.mowingCycleNumber) === cycleNumber
            );
            if (duplicateCycle) {
                notify(
                    `Mow ${cycleNumber} already exists for this annual site record.`,
                    'error'
                );
                return;
            }

            if (readyForInvoicing && status !== 'Completed') {
                notify(
                    'Only a completed mowing cycle can be marked ready for invoicing.',
                    'error'
                );
                return;
            }

            const submitButton = serviceEditorForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Saving…';

            try {
                const updates = {
                    mowingCycleNumber: cycleNumber,
                    serviceType,
                    status,
                    plannedMonth: optionalText(
                        document.getElementById('servicePlannedMonth').value
                    ),
                    tentativeScheduledOn: optionalText(
                        document.getElementById('serviceTentativeDate').value
                    ),
                    confirmedScheduledOn: optionalText(
                        document.getElementById('serviceConfirmedDate').value
                    ),
                    startedOn: optionalText(
                        document.getElementById('serviceStartedDate').value
                    ),
                    completedOn: completedOn || null,
                    completionMonth: completionMonth || (
                        completedOn ? completedOn.slice(0, 7) : null
                    ),
                    completionDatePrecision: completedOn
                        ? 'exact_date'
                        : completionMonth
                            ? 'month_only'
                            : 'unknown',
                    estimatedAcresToService: toNumber(
                        document.getElementById('serviceEstimatedAcres').value
                    ),
                    actualAcresCompleted: toNumber(
                        document.getElementById('serviceActualAcres').value
                    ),
                    targetVegetationHeight: cleanText(
                        document.getElementById('serviceTargetHeight').value
                    ),
                    assignedCrew: cleanText(
                        document.getElementById('serviceCrew').value
                    ),
                    assignedEquipment: cleanText(
                        document.getElementById('serviceEquipment').value
                    ),
                    reschedulingReason: cleanText(
                        document.getElementById('serviceReschedulingReason').value
                    ),
                    completionNotes: cleanText(
                        document.getElementById('serviceCompletionNotes').value
                    ),
                    problemsOrHazards: cleanText(
                        document.getElementById('serviceHazards').value
                    ),
                    weatherDelay:
                        document.getElementById('serviceWeatherDelay').checked,
                    followUpRequired:
                        document.getElementById('serviceFollowUp').checked,
                    readyForInvoicing,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP,
                    administratorUid: user.uid
                };

                await database.ref(`scheduled_services/${serviceId}`).update(updates);
                closeModal(serviceEditorModal);
                notify('Mowing cycle saved.', 'success');
                await loadScheduleData();
            } catch (error) {
                console.error('Unable to save mowing cycle:', error);
                notify('Unable to save the mowing cycle.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Save mowing cycle';
            }
        });

        createFollowUpBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            const sourceId = document.getElementById('scheduledServiceId').value;
            const source = state.services[sourceId];
            if (!user || !source) {
                notify('The source mowing-cycle record is unavailable.', 'error');
                return;
            }

            const confirmed = window.confirm(
                'Create a separate follow-up visit for this site?'
            );
            if (!confirmed) {
                return;
            }

            createFollowUpBtn.disabled = true;
            createFollowUpBtn.textContent = 'Creating…';

            try {
                const nextCycle = Math.max(
                    0,
                    ...Object.values(state.services)
                        .filter(service =>
                            service.serviceSeasonId === source.serviceSeasonId
                        )
                        .map(service => toNumber(service.mowingCycleNumber))
                ) + 1;
                const followUpId = database.ref('scheduled_services').push().key;
                const timestamp = firebase.database.ServerValue.TIMESTAMP;

                const followUp = {
                    serviceSeasonId: source.serviceSeasonId,
                    serviceYear: source.serviceYear,
                    companyId: source.companyId,
                    solarSiteId: source.solarSiteId,
                    mowingCycleNumber: nextCycle,
                    serviceType: 'Follow-up mowing',
                    status: 'Scheduling needed',
                    siteAcreage: toNumber(source.siteAcreage),
                    estimatedAcresToService: toNumber(
                        source.estimatedAcresToService
                    ),
                    actualAcresCompleted: 0,
                    targetVegetationHeight:
                        cleanText(source.targetVegetationHeight),
                    completionDatePrecision: 'unknown',
                    assignedCrew: '',
                    assignedEquipment: '',
                    reschedulingReason: '',
                    completionNotes: '',
                    problemsOrHazards: '',
                    weatherDelay: false,
                    followUpRequired: false,
                    readyForInvoicing: false,
                    followUpOfScheduledServiceId: sourceId,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    administratorUid: user.uid
                };

                await database.ref().update({
                    [`scheduled_services/${followUpId}`]: followUp,
                    [`scheduled_services/${sourceId}/followUpRequired`]: true,
                    [`scheduled_services/${sourceId}/updatedAt`]: timestamp,
                    [`scheduled_services/${sourceId}/administratorUid`]: user.uid
                });

                closeModal(serviceEditorModal);
                notify('Follow-up visit created as a separate mowing cycle.', 'success');
                await loadScheduleData();
            } catch (error) {
                console.error('Unable to create follow-up visit:', error);
                notify('Unable to create the follow-up visit.', 'error');
            } finally {
                createFollowUpBtn.disabled = false;
                createFollowUpBtn.textContent = 'Create follow-up visit';
            }
        });

        scheduleYear.addEventListener('change', () => {
            state.selectedYear = Number(scheduleYear.value);
            renderSchedule();
        });

        scheduleStatusFilter.addEventListener('change', () => {
            state.status = scheduleStatusFilter.value;
            renderSchedule();
        });

        scheduleSort.addEventListener('change', () => {
            state.sort = scheduleSort.value;
            renderSchedule();
        });

        scheduleSearch.addEventListener('input', () => {
            state.search = scheduleSearch.value.trim().toLowerCase();
            renderSchedule();
        });

        document.querySelectorAll('[data-schedule-view]').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('[data-schedule-view]').forEach(viewButton => {
                    viewButton.classList.toggle('active', viewButton === button);
                });
                state.view = button.dataset.scheduleView;
                renderSchedule();
            });
        });

        document.addEventListener('click', event => {
            const editButton = event.target.closest(
                '[data-schedule-action="edit-service"]'
            );
            if (editButton) {
                openServiceEditor(editButton.dataset.serviceId);
                return;
            }

            const closeButton = event.target.closest('[data-close-schedule-modal]');
            if (closeButton) {
                const modal = document.getElementById(
                    closeButton.dataset.closeScheduleModal
                );
                if (modal) {
                    closeModal(modal);
                }
            }
        });

        [siteSeasonModal, serviceEditorModal].forEach(modal => {
            modal.addEventListener('click', event => {
                if (event.target === modal) {
                    closeModal(modal);
                }
            });
        });

        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') {
                return;
            }

            if (serviceEditorModal.style.display === 'block') {
                closeModal(serviceEditorModal);
            } else if (siteSeasonModal.style.display === 'block') {
                closeModal(siteSeasonModal);
            }
        });

        document.getElementById('serviceCompletedDate').addEventListener(
            'change',
            event => {
                if (event.target.value) {
                    document.getElementById('serviceCompletionMonth').value = '';
                }
            }
        );

        document.getElementById('serviceCompletionMonth').addEventListener(
            'change',
            event => {
                if (event.target.value) {
                    document.getElementById('serviceCompletedDate').value = '';
                }
            }
        );

        addScheduleSiteBtn.addEventListener('click', openSiteSeasonModal);

        auth.onAuthStateChanged(user => {
            if (user) {
                loadScheduleData();
            } else {
                state.loaded = false;
                state.companies = {};
                state.sites = {};
                state.seasons = {};
                state.services = {};
                scheduleTotals.innerHTML = '';
                scheduleGridView.innerHTML = '';
                scheduleListView.innerHTML = '';
                scheduleCalendarView.innerHTML = '';
                scheduleHistoryView.innerHTML = '';
                scheduleLoading.hidden = false;
                scheduleLoading.textContent =
                    'Sign in with the approved administrator account to view the schedule.';
            }
        });

        populateYearOptions();
    });
})();
