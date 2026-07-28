(function() {
    'use strict';

    const MAX_FILE_BYTES = 1024 * 1024;
    const MAX_ROWS = 500;
    const REQUIRED_COLUMNS = [
        'company',
        'site_name',
        'location',
        'acres',
        'height_requirement',
        'service_year',
        'mow_cycle',
        'service_type',
        'planned_month',
        'tentative_scheduled_date',
        'confirmed_scheduled_date',
        'completed_date',
        'completion_month',
        'status'
    ];
    const STATUSES = new Set([
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
    ]);

    const importState = {
        fileName: '',
        rows: [],
        errors: [],
        records: null
    };

    function clean(value) {
        return String(value ?? '').trim();
    }

    function normalized(value) {
        return clean(value).toLocaleLowerCase().replace(/\s+/g, ' ');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];

            if (quoted) {
                if (character === '"' && text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else if (character === '"') {
                    quoted = false;
                } else {
                    field += character;
                }
            } else if (character === '"') {
                quoted = true;
            } else if (character === ',') {
                row.push(field);
                field = '';
            } else if (character === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else if (character !== '\r') {
                field += character;
            }
        }

        if (quoted) {
            throw new Error('The CSV contains an unclosed quoted value.');
        }

        if (field || row.length) {
            row.push(field);
            rows.push(row);
        }

        return rows.filter(values => values.some(value => clean(value)));
    }

    function isValidMonth(value) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
            return false;
        }
        return true;
    }

    function isValidDate(value) {
        if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
            return false;
        }
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year
            && date.getUTCMonth() === month - 1
            && date.getUTCDate() === day;
    }

    function addError(errors, rowNumber, field, message) {
        errors.push({ rowNumber, field, message });
    }

    function deriveStatus(row) {
        if (row.status) {
            return row.status;
        }
        if (row.completed_date || row.completion_month) {
            return 'Completed';
        }
        if (row.confirmed_scheduled_date || row.tentative_scheduled_date) {
            return 'Scheduled';
        }
        if (row.planned_month) {
            return 'Planned';
        }
        return 'Scheduling needed';
    }

    function entries(object) {
        return Object.entries(object || {});
    }

    function findCompanyMatches(records, companyName) {
        const key = normalized(companyName);
        return entries(records.companies)
            .filter(([, company]) => normalized(company.name) === key);
    }

    function findExactSiteMatches(records, row, companyId) {
        return entries(records.sites).filter(([, site]) => (
            site.companyId === companyId
            && normalized(site.name) === normalized(row.site_name)
            && normalized(site.location) === normalized(row.location)
        ));
    }

    function findPotentialSiteMatches(records, row) {
        const siteName = normalized(row.site_name);
        return entries(records.sites).filter(([, site]) =>
            normalized(site.name) === siteName
        );
    }

    function findSeasonMatches(records, siteId, year) {
        return entries(records.seasons).filter(([, season]) => (
            season.solarSiteId === siteId
            && Number(season.serviceYear) === year
        ));
    }

    function validateRows(rawRows, records) {
        const errors = [];
        if (!rawRows.length) {
            return { rows: [], errors: [{ rowNumber: 1, field: 'file', message: 'The CSV is empty.' }] };
        }

        const headers = rawRows[0].map((header, index) =>
            clean(header).replace(/^\uFEFF/, '').toLowerCase() || `column_${index + 1}`
        );
        const missingColumns = REQUIRED_COLUMNS.filter(column => !headers.includes(column));
        missingColumns.forEach(column =>
            addError(errors, 1, column, `Required column “${column}” is missing.`)
        );
        headers.forEach((header, index) => {
            if (headers.indexOf(header) !== index) {
                addError(errors, 1, header, `Column “${header}” appears more than once.`);
            }
        });

        if (rawRows.length - 1 > MAX_ROWS) {
            addError(errors, 1, 'file', `The file has more than ${MAX_ROWS} data rows.`);
        }

        const rows = rawRows.slice(1, MAX_ROWS + 1).map((values, index) => {
            const source = Object.fromEntries(headers.map((header, columnIndex) => [
                header,
                clean(values[columnIndex])
            ]));
            return {
                ...source,
                rowNumber: index + 2,
                service_year: Number(source.service_year),
                mow_cycle: Number(source.mow_cycle),
                acres: Number(source.acres),
                service_type: source.service_type || 'Commercial mowing',
                status: deriveStatus(source)
            };
        });

        const fileKeys = new Set();
        const fileSites = new Map();
        rows.forEach(row => {
            const requiredText = [
                ['company', 120],
                ['site_name', 120],
                ['location', 180]
            ];
            requiredText.forEach(([field, maxLength]) => {
                if (!row[field]) {
                    addError(errors, row.rowNumber, field, 'A value is required.');
                } else if (row[field].length > maxLength) {
                    addError(errors, row.rowNumber, field, `Must be ${maxLength} characters or fewer.`);
                }
            });

            if (!Number.isFinite(row.acres) || row.acres <= 0 || row.acres > 100000) {
                addError(errors, row.rowNumber, 'acres', 'Enter a number greater than 0 and no more than 100000.');
            }
            if (!Number.isInteger(row.service_year)
                || row.service_year < 2020
                || row.service_year > 2100) {
                addError(errors, row.rowNumber, 'service_year', 'Enter a year from 2020 through 2100.');
            }
            if (!Number.isInteger(row.mow_cycle)
                || row.mow_cycle < 1
                || row.mow_cycle > 50) {
                addError(errors, row.rowNumber, 'mow_cycle', 'Enter a whole number from 1 through 50.');
            }
            if (row.height_requirement.length > 60) {
                addError(errors, row.rowNumber, 'height_requirement', 'Must be 60 characters or fewer.');
            }
            if (!row.service_type || row.service_type.length > 80) {
                addError(errors, row.rowNumber, 'service_type', 'Enter a service type of 80 characters or fewer.');
            }
            if (!STATUSES.has(row.status)) {
                addError(errors, row.rowNumber, 'status', 'Choose one of the supported schedule statuses.');
            }
            if (row.completed_date && row.completion_month) {
                addError(errors, row.rowNumber, 'completion', 'Use either completed_date or completion_month, not both.');
            }
            if ((row.completed_date || row.completion_month) && row.status !== 'Completed') {
                addError(errors, row.rowNumber, 'status', 'A recorded completion date or month requires Completed status.');
            }

            [
                'tentative_scheduled_date',
                'confirmed_scheduled_date',
                'completed_date'
            ].forEach(field => {
                if (row[field] && !isValidDate(row[field])) {
                    addError(errors, row.rowNumber, field, 'Use a real date in YYYY-MM-DD format.');
                } else if (row[field] && Number(row[field].slice(0, 4)) !== row.service_year) {
                    addError(errors, row.rowNumber, field, 'The date year must match service_year.');
                }
            });
            ['planned_month', 'completion_month'].forEach(field => {
                if (row[field] && !isValidMonth(row[field])) {
                    addError(errors, row.rowNumber, field, 'Use YYYY-MM format.');
                } else if (row[field] && Number(row[field].slice(0, 4)) !== row.service_year) {
                    addError(errors, row.rowNumber, field, 'The month year must match service_year.');
                }
            });

            const fileKey = [
                normalized(row.company),
                normalized(row.site_name),
                normalized(row.location),
                row.service_year,
                row.mow_cycle
            ].join('|');
            if (fileKeys.has(fileKey)) {
                addError(errors, row.rowNumber, 'mow_cycle', 'This company, site, year, and mowing cycle is duplicated in the CSV.');
            }
            fileKeys.add(fileKey);

            const fileSiteNameKey = [
                normalized(row.company),
                normalized(row.site_name)
            ].join('|');
            const priorFileSite = fileSites.get(fileSiteNameKey);
            if (priorFileSite) {
                if (normalized(priorFileSite.location) !== normalized(row.location)) {
                    addError(errors, row.rowNumber, 'location', 'This company and site name use a different location elsewhere in the CSV.');
                }
                if (priorFileSite.acres !== row.acres) {
                    addError(errors, row.rowNumber, 'acres', 'This site uses a different acreage elsewhere in the CSV.');
                }
                if (normalized(priorFileSite.height_requirement)
                    !== normalized(row.height_requirement)) {
                    addError(errors, row.rowNumber, 'height_requirement', 'This site uses a different height requirement elsewhere in the CSV.');
                }
            } else {
                fileSites.set(fileSiteNameKey, row);
            }

            const companyMatches = findCompanyMatches(records, row.company);
            if (companyMatches.length > 1) {
                addError(errors, row.rowNumber, 'company', 'More than one existing company has this name.');
                return;
            }

            const companyId = companyMatches[0]?.[0];
            if (!companyId) {
                if (findPotentialSiteMatches(records, row).length) {
                    addError(errors, row.rowNumber, 'site_name', 'An existing site has this name under a different or unmatched company.');
                }
                return;
            }

            const exactSites = findExactSiteMatches(records, row, companyId);
            const potentialSites = findPotentialSiteMatches(records, row);
            if (exactSites.length > 1) {
                addError(errors, row.rowNumber, 'site_name', 'More than one existing site matches this name and location.');
                return;
            }
            if (!exactSites.length && potentialSites.length) {
                addError(errors, row.rowNumber, 'site_name', 'The site name exists, but its company or location does not match.');
                return;
            }

            const siteId = exactSites[0]?.[0];
            if (!siteId) {
                return;
            }
            const existingSite = exactSites[0][1];
            if (Number(existingSite.acreage) !== row.acres) {
                addError(errors, row.rowNumber, 'acres', 'The acreage does not match the existing permanent site. Review the site before importing.');
            }

            const seasons = findSeasonMatches(records, siteId, row.service_year);
            if (seasons.length > 1) {
                addError(errors, row.rowNumber, 'service_year', 'More than one annual season exists for this site and year.');
                return;
            }
            const seasonId = seasons[0]?.[0];
            if (!seasonId) {
                return;
            }
            const existingSeason = seasons[0][1];
            if (Number(existingSeason.contractAcreage) !== row.acres) {
                addError(errors, row.rowNumber, 'acres', 'The acreage does not match the existing annual season.');
            }

            const duplicateService = entries(records.services).some(([, service]) => (
                service.serviceSeasonId === seasonId
                && Number(service.mowingCycleNumber) === row.mow_cycle
            ));
            if (duplicateService) {
                addError(errors, row.rowNumber, 'mow_cycle', 'This mowing cycle already exists in the database.');
            }
        });

        return { rows, errors };
    }

    function buildImportUpdates(rows, records, user, database) {
        const timestamp = firebase.database.ServerValue.TIMESTAMP;
        const updates = {};
        const companyIds = new Map();
        const siteIds = new Map();
        const seasonIds = new Map();

        rows.forEach(row => {
            const companyKey = normalized(row.company);
            let companyId = companyIds.get(companyKey)
                || findCompanyMatches(records, row.company)[0]?.[0];
            if (!companyId) {
                companyId = database.ref('companies').push().key;
                updates[`companies/${companyId}`] = {
                    name: row.company,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    administratorUid: user.uid
                };
            }
            companyIds.set(companyKey, companyId);

            const siteKey = [
                companyId,
                normalized(row.site_name),
                normalized(row.location)
            ].join('|');
            let siteId = siteIds.get(siteKey)
                || findExactSiteMatches(records, row, companyId)[0]?.[0];
            if (!siteId) {
                siteId = database.ref('solar_sites').push().key;
                updates[`solar_sites/${siteId}`] = {
                    companyId,
                    name: row.site_name,
                    location: row.location,
                    acreage: row.acres,
                    targetVegetationHeight: row.height_requirement,
                    active: true,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    administratorUid: user.uid
                };
            }
            siteIds.set(siteKey, siteId);

            const seasonKey = `${siteId}|${row.service_year}`;
            let seasonId = seasonIds.get(seasonKey)
                || findSeasonMatches(records, siteId, row.service_year)[0]?.[0];
            if (!seasonId) {
                seasonId = database.ref('service_seasons').push().key;
                const siteRows = rows.filter(candidate => (
                    normalized(candidate.company) === companyKey
                    && normalized(candidate.site_name) === normalized(row.site_name)
                    && normalized(candidate.location) === normalized(row.location)
                    && candidate.service_year === row.service_year
                ));
                updates[`service_seasons/${seasonId}`] = {
                    serviceYear: row.service_year,
                    companyId,
                    solarSiteId: siteId,
                    plannedMowingCycles: Math.min(20, Math.max(...siteRows.map(candidate => candidate.mow_cycle))),
                    plannedOtherServices: '',
                    contractAcreage: row.acres,
                    targetVegetationHeight: row.height_requirement,
                    contractStatus: 'Active',
                    renewalStatus: 'Not reviewed',
                    renewalNotes: '',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    administratorUid: user.uid
                };
            }
            seasonIds.set(seasonKey, seasonId);

            const serviceId = database.ref('scheduled_services').push().key;
            const precision = row.completed_date
                ? 'exact_date'
                : row.completion_month ? 'month_only' : 'unknown';
            const service = {
                serviceSeasonId: seasonId,
                serviceYear: row.service_year,
                companyId,
                solarSiteId: siteId,
                mowingCycleNumber: row.mow_cycle,
                serviceType: row.service_type,
                status: row.status,
                siteAcreage: row.acres,
                estimatedAcresToService: row.acres,
                actualAcresCompleted: 0,
                targetVegetationHeight: row.height_requirement,
                completionDatePrecision: precision,
                assignedCrew: '',
                assignedEquipment: '',
                reschedulingReason: '',
                completionNotes: '',
                problemsOrHazards: '',
                weatherDelay: row.status === 'Weather delayed',
                followUpRequired: false,
                readyForInvoicing: false,
                createdAt: timestamp,
                updatedAt: timestamp,
                administratorUid: user.uid
            };
            if (row.planned_month) service.plannedMonth = row.planned_month;
            if (row.tentative_scheduled_date) service.tentativeScheduledOn = row.tentative_scheduled_date;
            if (row.confirmed_scheduled_date) service.confirmedScheduledOn = row.confirmed_scheduled_date;
            if (row.completed_date) service.completedOn = row.completed_date;
            if (row.completion_month) service.completionMonth = row.completion_month;
            updates[`scheduled_services/${serviceId}`] = service;
        });

        return updates;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const openButton = document.getElementById('openScheduleImportBtn');
        const modal = document.getElementById('scheduleImportModal');
        const downloadButton = document.getElementById('downloadScheduleTemplateBtn');
        const fileInput = document.getElementById('scheduleImportFile');
        const fileName = document.getElementById('scheduleImportFileName');
        const summary = document.getElementById('scheduleImportSummary');
        const preview = document.getElementById('scheduleImportPreview');
        const reviewed = document.getElementById('scheduleImportReviewed');
        const importButton = document.getElementById('confirmScheduleImportBtn');

        if (!openButton || !modal || !fileInput) {
            return;
        }

        const auth = firebase.auth();
        const database = firebase.database();

        function setImportReady(ready) {
            reviewed.disabled = !ready;
            if (!ready) {
                reviewed.checked = false;
            }
            importButton.disabled = !ready || !reviewed.checked;
        }

        function resetImport() {
            fileInput.value = '';
            fileName.textContent = 'No file selected.';
            summary.textContent = 'Select a CSV file to run local validation.';
            preview.innerHTML = '';
            importState.fileName = '';
            importState.rows = [];
            importState.errors = [];
            importState.records = null;
            setImportReady(false);
        }

        function openModal() {
            resetImport();
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            window.setTimeout(() => downloadButton.focus(), 0);
        }

        function closeModal() {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }

        function renderValidation() {
            const errorCount = importState.errors.length;
            if (errorCount) {
                summary.className = 'schedule-import-summary has-errors';
                summary.textContent = `${errorCount} blocking validation ${errorCount === 1 ? 'issue' : 'issues'} found. Nothing can be imported yet.`;
                preview.innerHTML = `
                    <div class="schedule-table-wrap">
                        <table class="schedule-import-table">
                            <thead><tr><th>Row</th><th>Field</th><th>Issue</th></tr></thead>
                            <tbody>
                                ${importState.errors.map(error => `
                                    <tr>
                                        <td>${escapeHtml(error.rowNumber)}</td>
                                        <td>${escapeHtml(error.field)}</td>
                                        <td>${escapeHtml(error.message)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                setImportReady(false);
                return;
            }

            summary.className = 'schedule-import-summary is-valid';
            summary.textContent = `${importState.rows.length} ${importState.rows.length === 1 ? 'record is' : 'records are'} valid and ready for final review.`;
            preview.innerHTML = `
                <div class="schedule-table-wrap">
                    <table class="schedule-import-table">
                        <thead>
                            <tr><th>Row</th><th>Company</th><th>Site</th><th>Year</th><th>Cycle</th><th>Completion</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${importState.rows.map(row => `
                                <tr>
                                    <td>${escapeHtml(row.rowNumber)}</td>
                                    <td>${escapeHtml(row.company)}</td>
                                    <td>${escapeHtml(row.site_name)}<small>${escapeHtml(row.location)}</small></td>
                                    <td>${escapeHtml(row.service_year)}</td>
                                    <td>${escapeHtml(row.mow_cycle)}</td>
                                    <td>${escapeHtml(row.completed_date || row.completion_month || 'Not recorded')}</td>
                                    <td>${escapeHtml(row.status)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            setImportReady(importState.rows.length > 0);
        }

        async function loadRecords() {
            const snapshots = await Promise.all([
                database.ref('companies').once('value'),
                database.ref('solar_sites').once('value'),
                database.ref('service_seasons').once('value'),
                database.ref('scheduled_services').once('value')
            ]);
            return {
                companies: snapshots[0].val() || {},
                sites: snapshots[1].val() || {},
                seasons: snapshots[2].val() || {},
                services: snapshots[3].val() || {}
            };
        }

        downloadButton.addEventListener('click', () => {
            const csv = `${REQUIRED_COLUMNS.join(',')}\n`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
            link.download = 'agrisolar-reviewed-schedule-template.csv';
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);
        });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            resetImport();
            if (!file) {
                return;
            }
            fileName.textContent = file.name;
            importState.fileName = file.name;

            if (file.size > MAX_FILE_BYTES) {
                importState.errors = [{
                    rowNumber: 1,
                    field: 'file',
                    message: 'The CSV must be 1 MB or smaller.'
                }];
                renderValidation();
                return;
            }
            if (!auth.currentUser) {
                importState.errors = [{
                    rowNumber: 1,
                    field: 'authentication',
                    message: 'Sign in with the approved administrator account.'
                }];
                renderValidation();
                return;
            }

            summary.className = 'schedule-import-summary';
            summary.textContent = 'Validating the CSV against existing schedule records…';
            try {
                const [text, records] = await Promise.all([file.text(), loadRecords()]);
                const result = validateRows(parseCsv(text), records);
                importState.rows = result.rows;
                importState.errors = result.errors;
                importState.records = records;
                renderValidation();
            } catch (error) {
                console.error('Unable to validate schedule import:', error);
                importState.errors = [{
                    rowNumber: 1,
                    field: 'file',
                    message: error.message || 'The CSV could not be read.'
                }];
                renderValidation();
            }
        });

        reviewed.addEventListener('change', () => {
            importButton.disabled = !reviewed.checked || importState.errors.length > 0;
        });

        importButton.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user || importState.errors.length || !importState.rows.length || !reviewed.checked) {
                return;
            }

            const confirmed = window.confirm(
                `Import ${importState.rows.length} validated schedule ${importState.rows.length === 1 ? 'record' : 'records'}? This creates records in the Firebase development database.`
            );
            if (!confirmed) {
                return;
            }

            importButton.disabled = true;
            importButton.textContent = 'Checking and importing…';
            try {
                const currentRecords = await loadRecords();
                const revalidated = validateRows(
                    [REQUIRED_COLUMNS, ...importState.rows.map(row =>
                        REQUIRED_COLUMNS.map(column => row[column] ?? '')
                    )],
                    currentRecords
                );
                if (revalidated.errors.length) {
                    importState.rows = revalidated.rows;
                    importState.errors = revalidated.errors;
                    importState.records = currentRecords;
                    renderValidation();
                    return;
                }

                const updates = buildImportUpdates(
                    revalidated.rows,
                    currentRecords,
                    user,
                    database
                );
                await database.ref().update(updates);
                closeModal();
                if (typeof window.showMessage === 'function') {
                    window.showMessage(
                        `${revalidated.rows.length} schedule ${revalidated.rows.length === 1 ? 'record was' : 'records were'} imported.`,
                        'success'
                    );
                }
                document.dispatchEvent(new CustomEvent('schedule-data-imported'));
            } catch (error) {
                console.error('Unable to import schedule records:', error);
                summary.className = 'schedule-import-summary has-errors';
                summary.textContent = 'The import failed. No partial import was requested; review access and try again.';
            } finally {
                importButton.textContent = 'Import validated records';
                importButton.disabled = !reviewed.checked || importState.errors.length > 0;
            }
        });

        openButton.addEventListener('click', openModal);
        modal.querySelectorAll('[data-close-import-modal]').forEach(button =>
            button.addEventListener('click', closeModal)
        );
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal();
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                closeModal();
            }
        });

    });
})();
