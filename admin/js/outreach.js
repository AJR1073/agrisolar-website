(function() {
    'use strict';

    const state = {
        prospects: {},
        sources: {},
        suppressions: {},
        status: 'all',
        search: ''
    };

    function clean(value) {
        return String(value ?? '').trim();
    }

    function normalizeText(value) {
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

    function safeHttpUrl(value) {
        const text = clean(value);
        if (!text) return '';
        try {
            const url = new URL(text);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function normalizedDomain(value) {
        const url = safeHttpUrl(value);
        return url
            ? new URL(url).hostname.toLocaleLowerCase().replace(/^www\./, '')
            : '';
    }

    function notify(message, type = 'info') {
        if (typeof window.showMessage === 'function') {
            window.showMessage(message, type);
        } else {
            window.alert(message);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const tabButton = document.querySelector('[data-tab="outreach"]');
        const addButton = document.getElementById('addProspectBtn');
        const modal = document.getElementById('prospectModal');
        const form = document.getElementById('prospectForm');
        const totals = document.getElementById('outreachTotals');
        const loading = document.getElementById('outreachLoading');
        const list = document.getElementById('outreachList');
        const statusFilter = document.getElementById('outreachStatusFilter');
        const searchInput = document.getElementById('outreachSearch');

        if (!tabButton || !addButton || !modal || !form) return;

        const auth = firebase.auth();
        const database = firebase.database();

        function openModal() {
            form.reset();
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            window.setTimeout(() => document.getElementById('prospectCompany').focus(), 0);
        }

        function closeModal() {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }

        async function loadOutreachData() {
            if (!auth.currentUser) return;
            loading.hidden = false;
            loading.textContent = 'Loading prospect candidates…';
            list.innerHTML = '';

            try {
                const [prospects, sources, suppressions] = await Promise.all([
                    database.ref('prospect_candidates').once('value'),
                    database.ref('prospect_sources').once('value'),
                    database.ref('suppression_entries').once('value')
                ]);
                state.prospects = prospects.val() || {};
                state.sources = sources.val() || {};
                state.suppressions = suppressions.val() || {};
                render();
            } catch (error) {
                console.error('Unable to load outreach records:', error);
                loading.hidden = false;
                loading.textContent = 'Prospect candidates could not be loaded. Confirm administrator access and try again.';
                notify('Unable to load prospect candidates.', 'error');
            }
        }

        function visibleProspects() {
            return Object.entries(state.prospects)
                .map(([id, prospect]) => ({ id, ...prospect }))
                .filter(prospect => {
                    if (state.status === 'suppressed' && prospect.suppressed !== true) return false;
                    if (state.status !== 'all'
                        && state.status !== 'suppressed'
                        && prospect.verificationStatus !== state.status) return false;
                    if (!state.search) return true;
                    const source = state.sources[prospect.sourceId] || {};
                    return [
                        prospect.companyName,
                        prospect.location,
                        prospect.contactName,
                        prospect.contactEmail,
                        prospect.normalizedDomain,
                        source.title,
                        source.url
                    ].join(' ').toLocaleLowerCase().includes(state.search);
                })
                .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
        }

        function renderTotals() {
            const prospects = Object.values(state.prospects);
            const values = [
                [prospects.length, 'Total candidates'],
                [prospects.filter(item => item.verificationStatus === 'Needs review').length, 'Needs review'],
                [prospects.filter(item => item.verificationStatus === 'Verified').length, 'Verified'],
                [prospects.filter(item => item.suppressed === true).length, 'Do not contact']
            ];
            totals.innerHTML = values.map(([value, label]) => `
                <div class="outreach-total"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>
            `).join('');
        }

        function statusClass(prospect) {
            if (prospect.suppressed) return 'is-suppressed';
            if (prospect.verificationStatus === 'Verified') return 'is-verified';
            return prospect.verificationStatus === 'Rejected' ? 'is-rejected' : '';
        }

        function render() {
            renderTotals();
            const prospects = visibleProspects();
            loading.hidden = true;

            if (!prospects.length) {
                const hasRecords = Object.keys(state.prospects).length > 0;
                list.innerHTML = `
                    <div class="outreach-empty">
                        <strong>${hasRecords ? 'No matching candidates' : 'No prospect candidates yet'}</strong>
                        <p>${hasRecords ? 'Adjust the search or filter.' : 'Add a reviewed public source to begin.'}</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = prospects.map(prospect => {
                const source = state.sources[prospect.sourceId] || {};
                const sourceUrl = safeHttpUrl(source.url);
                const badgeClass = prospect.suppressed
                    ? 'suppressed'
                    : prospect.verificationStatus.toLocaleLowerCase().replace(/\s+/g, '-');
                return `
                    <article class="outreach-card ${statusClass(prospect)}" data-prospect-id="${escapeHtml(prospect.id)}">
                        <div class="outreach-card-header">
                            <div>
                                <h3>${escapeHtml(prospect.companyName)}</h3>
                                <span class="outreach-meta">${escapeHtml(prospect.location || prospect.normalizedDomain || 'Location not recorded')}</span>
                            </div>
                            <div class="outreach-badges">
                                <span class="outreach-badge ${escapeHtml(badgeClass)}">${escapeHtml(prospect.verificationStatus)}</span>
                                ${prospect.suppressed ? '<span class="outreach-badge suppressed">Do not contact</span>' : ''}
                            </div>
                        </div>
                        <div class="outreach-card-grid">
                            <div class="outreach-detail"><strong>Public contact</strong>${escapeHtml(prospect.contactName || 'Not recorded')}${prospect.contactEmail ? `<br>${escapeHtml(prospect.contactEmail)}` : ''}${prospect.contactPhone ? `<br>${escapeHtml(prospect.contactPhone)}` : ''}</div>
                            <div class="outreach-detail"><strong>Public source</strong>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || sourceUrl)}</a>` : escapeHtml(source.title || 'Source unavailable')}</div>
                            <div class="outreach-detail"><strong>Evidence summary</strong>${escapeHtml(source.evidenceSummary || 'Not recorded')}</div>
                            <div class="outreach-detail"><strong>Potential fit</strong>${escapeHtml(prospect.fitReason || 'Not yet assessed')}</div>
                        </div>
                        <div class="outreach-card-actions">
                            ${!prospect.suppressed && prospect.verificationStatus !== 'Verified' ? `<button type="button" class="action-btn" data-outreach-action="verify" data-prospect-id="${escapeHtml(prospect.id)}">Mark verified</button>` : ''}
                            ${!prospect.suppressed && prospect.verificationStatus !== 'Rejected' ? `<button type="button" class="action-btn secondary" data-outreach-action="reject" data-prospect-id="${escapeHtml(prospect.id)}">Reject candidate</button>` : ''}
                            ${!prospect.suppressed ? `<button type="button" class="action-btn danger" data-outreach-action="suppress" data-prospect-id="${escapeHtml(prospect.id)}">Mark do not contact</button>` : ''}
                        </div>
                    </article>
                `;
            }).join('');
        }

        function duplicateMessage(candidate) {
            const duplicate = Object.values(state.prospects).find(prospect => (
                prospect.normalizedCompany === candidate.normalizedCompany
                || (candidate.normalizedDomain && prospect.normalizedDomain === candidate.normalizedDomain)
                || (candidate.contactEmail
                    && normalizeText(prospect.contactEmail) === candidate.contactEmail)
            ));
            if (duplicate) {
                return `A candidate already exists for ${duplicate.companyName}. Review the existing record instead.`;
            }

            const values = [
                candidate.normalizedCompany,
                candidate.normalizedDomain,
                candidate.contactEmail
            ].filter(Boolean);
            const suppressed = Object.values(state.suppressions).some(entry => (
                entry.active === true && values.includes(entry.value)
            ));
            return suppressed
                ? 'This company, domain, or email is on the do-not-contact list.'
                : '';
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const user = auth.currentUser;
            if (!user) {
                notify('Sign in before saving a prospect candidate.', 'error');
                return;
            }

            const companyName = clean(document.getElementById('prospectCompany').value);
            const websiteInput = document.getElementById('prospectWebsite').value;
            const sourceInput = document.getElementById('prospectSourceUrl').value;
            const website = safeHttpUrl(websiteInput);
            const sourceUrl = safeHttpUrl(sourceInput);
            const sourceTitle = clean(document.getElementById('prospectSourceTitle').value);
            const evidenceSummary = clean(document.getElementById('prospectEvidence').value);
            const candidate = {
                companyName,
                normalizedCompany: normalizeText(companyName),
                website,
                normalizedDomain: normalizedDomain(website),
                location: clean(document.getElementById('prospectLocation').value),
                contactName: clean(document.getElementById('prospectContactName').value),
                contactEmail: normalizeText(document.getElementById('prospectContactEmail').value),
                contactPhone: clean(document.getElementById('prospectContactPhone').value),
                fitReason: clean(document.getElementById('prospectFitReason').value)
            };

            if (!companyName || !sourceUrl || !sourceTitle || !evidenceSummary) {
                notify('Company, source URL, source title, and evidence summary are required.', 'error');
                return;
            }
            if (websiteInput && !website) {
                notify('The company website must use http or https.', 'error');
                return;
            }
            const duplicate = duplicateMessage(candidate);
            if (duplicate) {
                notify(duplicate, 'error');
                return;
            }

            const submit = form.querySelector('button[type="submit"]');
            submit.disabled = true;
            submit.textContent = 'Saving…';
            try {
                const prospectId = database.ref('prospect_candidates').push().key;
                const sourceId = database.ref('prospect_sources').push().key;
                const timestamp = firebase.database.ServerValue.TIMESTAMP;
                const updates = {
                    [`prospect_candidates/${prospectId}`]: {
                        ...candidate,
                        sourceId,
                        verificationStatus: 'Needs review',
                        outreachStatus: 'Not contacted',
                        suppressed: false,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        administratorUid: user.uid
                    },
                    [`prospect_sources/${sourceId}`]: {
                        prospectId,
                        url: sourceUrl,
                        title: sourceTitle,
                        evidenceSummary,
                        accessedAt: timestamp,
                        createdAt: timestamp,
                        administratorUid: user.uid
                    }
                };
                await database.ref().update(updates);
                closeModal();
                notify('Prospect candidate saved for review. No email was sent.', 'success');
                await loadOutreachData();
            } catch (error) {
                console.error('Unable to save prospect candidate:', error);
                notify('Unable to save the prospect candidate.', 'error');
            } finally {
                submit.disabled = false;
                submit.textContent = 'Save candidate for review';
            }
        });

        document.addEventListener('click', async event => {
            const button = event.target.closest('[data-outreach-action]');
            if (!button) return;
            const user = auth.currentUser;
            const prospectId = button.dataset.prospectId;
            const prospect = state.prospects[prospectId];
            if (!user || !prospect) return;

            const timestamp = firebase.database.ServerValue.TIMESTAMP;
            const updates = {};
            if (button.dataset.outreachAction === 'suppress') {
                if (!window.confirm(`Mark ${prospect.companyName} as do not contact? This blocks future outreach.`)) return;
                const suppressionId = database.ref('suppression_entries').push().key;
                const type = prospect.contactEmail
                    ? 'email'
                    : prospect.normalizedDomain ? 'domain' : 'company';
                const value = prospect.contactEmail
                    || prospect.normalizedDomain
                    || prospect.normalizedCompany;
                updates[`prospect_candidates/${prospectId}/suppressed`] = true;
                updates[`prospect_candidates/${prospectId}/outreachStatus`] = 'Do not contact';
                updates[`suppression_entries/${suppressionId}`] = {
                    prospectId,
                    type,
                    value,
                    reason: 'Administrator do-not-contact decision',
                    active: true,
                    createdAt: timestamp,
                    administratorUid: user.uid
                };
            } else {
                updates[`prospect_candidates/${prospectId}/verificationStatus`] =
                    button.dataset.outreachAction === 'verify' ? 'Verified' : 'Rejected';
            }
            updates[`prospect_candidates/${prospectId}/updatedAt`] = timestamp;
            updates[`prospect_candidates/${prospectId}/administratorUid`] = user.uid;

            button.disabled = true;
            try {
                await database.ref().update(updates);
                notify(
                    button.dataset.outreachAction === 'suppress'
                        ? 'Do-not-contact suppression saved.'
                        : 'Candidate review status updated.',
                    'success'
                );
                await loadOutreachData();
            } catch (error) {
                console.error('Unable to update prospect candidate:', error);
                notify('Unable to update the prospect candidate.', 'error');
                button.disabled = false;
            }
        });

        statusFilter.addEventListener('change', () => {
            state.status = statusFilter.value;
            render();
        });
        searchInput.addEventListener('input', () => {
            state.search = normalizeText(searchInput.value);
            render();
        });
        addButton.addEventListener('click', openModal);
        modal.querySelectorAll('[data-close-prospect-modal]').forEach(button => {
            button.addEventListener('click', closeModal);
        });
        modal.addEventListener('click', event => {
            if (event.target === modal) closeModal();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && modal.style.display === 'block') closeModal();
        });

        auth.onAuthStateChanged(user => {
            if (user) {
                loadOutreachData();
            } else {
                state.prospects = {};
                state.sources = {};
                state.suppressions = {};
                totals.innerHTML = '';
                list.innerHTML = '';
                loading.hidden = false;
                loading.textContent = 'Sign in with the approved administrator account to view outreach records.';
            }
        });
    });
})();
