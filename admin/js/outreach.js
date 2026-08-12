(function() {
    'use strict';

    const FUNCTIONS_BASE = 'https://us-central1-agrisolar-website.cloudfunctions.net';
    const state = {
        prospects: {},
        sources: {},
        suppressions: {},
        drafts: {},
        costEvents: {},
        discoveryResults: [],
        discoveryModel: '',
        aiEnabled: true,
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

    async function callAdminFunction(auth, name, payload) {
        const user = auth.currentUser;
        if (!user) throw new Error('Sign in before using administrator AI tools.');
        const token = await user.getIdToken();
        const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(result.error || 'The AI request could not be completed.');
            error.code = result.code || '';
            throw error;
        }
        return result;
    }

    async function callBusinessApi(auth, path, payload) {
        const user = auth.currentUser;
        if (!user) throw new Error('Sign in before submitting a candidate.');
        const token = await user.getIdToken(true);
        const random = globalThis.crypto?.randomUUID?.()
            || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const response = await fetch(path, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': `outreach-candidate:${random}`
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(
                result.error?.message
                || `The candidate review service returned ${response.status}.`
            );
        }
        return result;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const tabButton = document.querySelector('[data-tab="outreach"]');
        const addButton = document.getElementById('addProspectBtn');
        const discoverButton = document.getElementById('discoverProspectsBtn');
        const modal = document.getElementById('prospectModal');
        const form = document.getElementById('prospectForm');
        const discoveryModal = document.getElementById('aiDiscoveryModal');
        const discoveryForm = document.getElementById('aiDiscoveryForm');
        const discoveryResults = document.getElementById('aiDiscoveryResults');
        const draftModal = document.getElementById('aiDraftModal');
        const draftForm = document.getElementById('aiDraftForm');
        const draftResult = document.getElementById('aiDraftResult');
        const aiToggle = document.getElementById('aiOutreachToggle');
        const lastCallCost = document.getElementById('aiLastCallCost');
        const lastCallDetail = document.getElementById('aiLastCallDetail');
        const trackedTotalCost = document.getElementById('aiTrackedTotalCost');
        const trackedTotalDetail = document.getElementById('aiTrackedTotalDetail');
        const trackedRequestCount = document.getElementById('aiTrackedRequestCount');
        const totals = document.getElementById('outreachTotals');
        const loading = document.getElementById('outreachLoading');
        const list = document.getElementById('outreachList');
        const statusFilter = document.getElementById('outreachStatusFilter');
        const searchInput = document.getElementById('outreachSearch');

        if (!tabButton || !addButton || !discoverButton || !modal || !form
            || !discoveryModal || !discoveryForm || !draftModal || !draftForm
            || !lastCallCost || !lastCallDetail || !trackedTotalCost
            || !trackedTotalDetail || !trackedRequestCount) return;

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

        function openDialog(dialog, focusId) {
            dialog.style.display = 'block';
            document.body.style.overflow = 'hidden';
            if (focusId) window.setTimeout(() => document.getElementById(focusId)?.focus(), 0);
        }

        function closeDialog(dialog) {
            dialog.style.display = 'none';
            document.body.style.overflow = '';
        }

        async function loadOutreachData() {
            if (!auth.currentUser) return;
            loading.hidden = false;
            loading.textContent = 'Loading prospect candidates…';
            list.innerHTML = '';

            try {
                const [prospects, sources, suppressions, drafts, costEvents, aiSettings] = await Promise.all([
                    database.ref('prospect_candidates').once('value'),
                    database.ref('prospect_sources').once('value'),
                    database.ref('suppression_entries').once('value'),
                    database.ref('outreach_drafts').once('value'),
                    database.ref('ai_cost_events').once('value'),
                    database.ref('ai_settings').once('value')
                ]);
                state.prospects = prospects.val() || {};
                state.sources = sources.val() || {};
                state.suppressions = suppressions.val() || {};
                state.drafts = drafts.val() || {};
                state.costEvents = costEvents.val() || {};
                state.aiEnabled = aiSettings.val()?.outreachEnabled !== false;
                aiToggle.checked = state.aiEnabled;
                discoverButton.disabled = !state.aiEnabled;
                render();
                renderCostSummary();
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

        function costEventMicroUsd(event) {
            if (event?.costType === 'actual') return Number(event.actualMicroUsd) || 0;
            return Number(event?.estimatedMicroUsd) || 0;
        }

        function formatMicroUsd(value) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            }).format((Number(value) || 0) / 1000000);
        }

        function renderCostSummary() {
            const events = Object.entries(state.costEvents)
                .map(([id, event]) => ({ id, ...event }))
                .filter(event => ['discovery', 'drafting'].includes(event.kind))
                .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
            const totalMicroUsd = events.reduce(
                (total, event) => total + costEventMicroUsd(event),
                0
            );
            const latest = events[0];

            lastCallCost.textContent = latest
                ? formatMicroUsd(costEventMicroUsd(latest))
                : 'Not tracked yet';
            lastCallDetail.textContent = latest
                ? `${latest.costType === 'actual' ? 'Confirmed dashboard cost' : 'Estimated cost'} · ${latest.kind === 'discovery' ? 'Internet discovery' : 'Email drafting'}${latest.model ? ` · ${latest.model}` : ''}`
                : 'Run discovery or drafting to begin tracking.';
            trackedTotalCost.textContent = formatMicroUsd(totalMicroUsd);
            trackedTotalDetail.textContent = events.some(event => event.costType === 'actual')
                ? 'Includes your confirmed dashboard amount plus later estimates.'
                : 'Estimated from calls recorded by this site.';
            trackedRequestCount.textContent = String(events.length);
        }

        function addReturnedCostEvent(result) {
            const event = result?.costEvent;
            if (!event?.id) return;
            state.costEvents[event.id] = event;
            renderCostSummary();
        }

        function statusClass(prospect) {
            if (prospect.suppressed) return 'is-suppressed';
            if (prospect.verificationStatus === 'Verified') return 'is-verified';
            return prospect.verificationStatus === 'Rejected' ? 'is-rejected' : '';
        }

        function latestDraftFor(prospectId) {
            return Object.entries(state.drafts)
                .filter(([, draft]) => draft.prospectId === prospectId)
                .map(([id, draft]) => ({ id, ...draft }))
                .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))[0];
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
                const latestDraft = latestDraftFor(prospect.id);
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
                            ${latestDraft ? `<button type="button" class="action-btn secondary" data-outreach-action="view-draft" data-prospect-id="${escapeHtml(prospect.id)}" data-draft-id="${escapeHtml(latestDraft.id)}">View latest draft</button>` : ''}
                            ${state.aiEnabled && !prospect.suppressed && prospect.verificationStatus === 'Verified' ? `<button type="button" class="action-btn" data-outreach-action="draft" data-prospect-id="${escapeHtml(prospect.id)}"><i class="fas fa-pen" aria-hidden="true"></i> Draft email with AI</button>` : ''}
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

        function confidenceNumber(value) {
            if (typeof value === 'number') return Math.max(0, Math.min(1, value));
            return { low: 0.35, medium: 0.65, high: 0.85 }[
                clean(value).toLocaleLowerCase()
            ] || 0;
        }

        async function saveCandidateForReview(
            candidate,
            source,
            candidateSource = 'manual'
        ) {
            const duplicate = duplicateMessage(candidate);
            if (duplicate) throw new Error(duplicate);
            return callBusinessApi(auth, '/api/v1/opportunity-candidates', {
                candidateSource,
                company: {
                    name: candidate.companyName,
                    domain: candidate.normalizedDomain
                },
                site: {
                    name: `${candidate.companyName} prospect`,
                    address: candidate.location
                },
                projectDetails: source.evidenceSummary,
                opportunityType: 'vegetation_management',
                contact: {
                    name: candidate.contactName,
                    email: candidate.contactEmail
                },
                source: {
                    type: 'public_web',
                    title: source.title,
                    url: source.url,
                    retrievedAt: Date.now()
                },
                notes: candidate.fitReason,
                aiResearch: candidateSource === 'outreach_api' ? {
                    summary: candidate.fitReason,
                    confidence: confidenceNumber(candidate.confidence),
                    model: state.discoveryModel
                } : undefined,
                priority: 'normal',
                nextAction: 'Verify the public evidence and decision-maker contact.'
            });
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
                await saveCandidateForReview(candidate, {
                    url: sourceUrl,
                    title: sourceTitle,
                    evidenceSummary
                });
                closeModal();
                notify('Candidate submitted to the AI Review Center. No email was sent.', 'success');
            } catch (error) {
                console.error('Unable to save prospect candidate:', error);
                notify(error.message || 'Unable to save the prospect candidate.', 'error');
            } finally {
                submit.disabled = false;
                submit.textContent = 'Save candidate for review';
            }
        });

        function renderDiscoveryResults() {
            if (!state.discoveryResults.length) {
                discoveryResults.innerHTML = `
                    <div class="outreach-empty">
                        <strong>No source-supported candidates returned</strong>
                        <p>Try a broader region or organization description.</p>
                    </div>
                `;
                return;
            }
            discoveryResults.innerHTML = state.discoveryResults.map((candidate, index) => {
                const sourceUrl = safeHttpUrl(candidate.sourceUrl);
                const missing = Array.isArray(candidate.missingFacts)
                    ? candidate.missingFacts.filter(Boolean).join('; ')
                    : '';
                return `
                    <article class="ai-result-card" data-ai-result-index="${index}">
                        <h4>${escapeHtml(candidate.companyName)}</h4>
                        <div class="ai-result-meta">${escapeHtml(candidate.location || 'Location not confirmed')} · ${escapeHtml(candidate.confidence || 'low')} confidence</div>
                        <p><strong>Source-supported evidence:</strong> ${escapeHtml(candidate.evidenceSummary || 'Review the cited source.')}</p>
                        <p><strong>AI fit assessment:</strong> ${escapeHtml(candidate.fitReason || 'Not assessed')}</p>
                        ${missing ? `<p><strong>Still needs verification:</strong> ${escapeHtml(missing)}</p>` : ''}
                        <p><strong>Public citation:</strong> ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(candidate.sourceTitle || sourceUrl)}</a>` : 'Unavailable'}</p>
                        <div class="ai-result-actions">
                            <button type="button" class="action-btn secondary" data-outreach-action="save-discovery" data-result-index="${index}">Save for review</button>
                        </div>
                    </article>
                `;
            }).join('');
        }

        discoveryForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (!state.aiEnabled) {
                notify('AI outreach is paused.', 'error');
                return;
            }
            const submit = discoveryForm.querySelector('button[type="submit"]');
            submit.disabled = true;
            submit.textContent = 'Searching public sources…';
            discoveryResults.innerHTML = '<div class="outreach-empty">Researching public sources. This can take up to a minute…</div>';
            try {
                const result = await callAdminFunction(auth, 'discoverProspects', {
                    region: clean(document.getElementById('discoveryRegion').value),
                    organizationTypes: clean(document.getElementById('discoveryOrganizationTypes').value),
                    serviceNeed: clean(document.getElementById('discoveryServiceNeed').value),
                    notes: clean(document.getElementById('discoveryNotes').value),
                    maxResults: Number(document.getElementById('discoveryMaxResults').value)
                });
                addReturnedCostEvent(result);
                state.discoveryModel = clean(result.model);
                state.discoveryResults = Array.isArray(result.candidates) ? result.candidates : [];
                renderDiscoveryResults();
            } catch (error) {
                console.error('Unable to discover prospects:', error);
                discoveryResults.innerHTML = '';
                notify(error.message, 'error');
            } finally {
                submit.disabled = false;
                submit.textContent = 'Search public sources';
            }
        });

        function openDraftModal(prospectId) {
            const prospect = state.prospects[prospectId];
            if (!prospect) return;
            document.getElementById('aiDraftProspectId').value = prospectId;
            document.getElementById('aiDraftProspectSummary').textContent =
                `Create a review-only draft for ${prospect.companyName}. The verified public source will be supplied to the AI.`;
            draftResult.hidden = true;
            document.getElementById('aiDraftSubject').value = '';
            document.getElementById('aiDraftBody').value = '';
            openDialog(draftModal, 'aiDraftGoal');
        }

        function showStoredDraft(prospectId, draftId) {
            const prospect = state.prospects[prospectId];
            const draft = state.drafts[draftId];
            if (!prospect || !draft) return;
            document.getElementById('aiDraftProspectId').value = prospectId;
            document.getElementById('aiDraftProspectSummary').textContent =
                `Saved review draft for ${prospect.companyName}. This record has not been sent.`;
            document.getElementById('aiDraftSubject').value = draft.subject || '';
            document.getElementById('aiDraftBody').value = draft.body || '';
            const basis = Array.isArray(draft.personalizationBasis)
                ? draft.personalizationBasis : Object.values(draft.personalizationBasis || {});
            const checks = Array.isArray(draft.claimsToVerify)
                ? draft.claimsToVerify : Object.values(draft.claimsToVerify || {});
            document.getElementById('aiDraftChecks').innerHTML = `
                <section><h4>Personalization basis</h4>${basis.length ? `<ul>${basis.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>None listed.</p>'}</section>
                <section><h4>Verify before use</h4>${checks.length ? `<ul>${checks.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No additional claims listed.</p>'}</section>
            `;
            draftResult.hidden = false;
            openDialog(draftModal, 'aiDraftSubject');
        }

        draftForm.addEventListener('submit', async event => {
            event.preventDefault();
            const submit = draftForm.querySelector('button[type="submit"]');
            submit.disabled = true;
            submit.textContent = 'Drafting…';
            try {
                const result = await callAdminFunction(auth, 'draftOutreachEmail', {
                    prospectId: clean(document.getElementById('aiDraftProspectId').value),
                    goal: clean(document.getElementById('aiDraftGoal').value)
                });
                addReturnedCostEvent(result);
                document.getElementById('aiDraftSubject').value = result.subject || '';
                document.getElementById('aiDraftBody').value = result.body || '';
                const basis = Array.isArray(result.personalizationBasis)
                    ? result.personalizationBasis : [];
                const checks = Array.isArray(result.claimsToVerify) ? result.claimsToVerify : [];
                document.getElementById('aiDraftChecks').innerHTML = `
                    <section><h4>Personalization basis</h4>${basis.length ? `<ul>${basis.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>None listed.</p>'}</section>
                    <section><h4>Verify before use</h4>${checks.length ? `<ul>${checks.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No additional claims listed.</p>'}</section>
                `;
                draftResult.hidden = false;
                notify('Review draft saved. No email was sent.', 'success');
            } catch (error) {
                console.error('Unable to draft outreach:', error);
                notify(error.message, 'error');
            } finally {
                submit.disabled = false;
                submit.textContent = 'Generate review draft';
            }
        });

        document.addEventListener('click', async event => {
            const button = event.target.closest('[data-outreach-action]');
            if (!button) return;
            const user = auth.currentUser;
            if (button.dataset.outreachAction === 'save-discovery') {
                const index = Number(button.dataset.resultIndex);
                const result = state.discoveryResults[index];
                if (!user || !result) return;
                const website = safeHttpUrl(result.website);
                const candidate = {
                    companyName: clean(result.companyName),
                    normalizedCompany: normalizeText(result.companyName),
                    website,
                    normalizedDomain: normalizedDomain(website),
                    location: clean(result.location),
                    contactName: clean(result.contactName),
                    contactEmail: normalizeText(result.contactEmail),
                    contactPhone: clean(result.contactPhone),
                    fitReason: clean(result.fitReason),
                    confidence: result.confidence
                };
                button.disabled = true;
                try {
                    await saveCandidateForReview(candidate, {
                        url: safeHttpUrl(result.sourceUrl),
                        title: clean(result.sourceTitle),
                        evidenceSummary: clean(result.evidenceSummary)
                    }, 'outreach_api');
                    button.textContent = 'Submitted for review';
                    notify('AI candidate submitted to the AI Review Center. No email was sent.', 'success');
                } catch (error) {
                    notify(error.message, 'error');
                    button.disabled = false;
                }
                return;
            }
            const prospectId = button.dataset.prospectId;
            const prospect = state.prospects[prospectId];
            if (!user || !prospect) return;

            if (button.dataset.outreachAction === 'draft') {
                openDraftModal(prospectId);
                return;
            }
            if (button.dataset.outreachAction === 'view-draft') {
                showStoredDraft(prospectId, button.dataset.draftId);
                return;
            }

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
        discoverButton.addEventListener('click', () => {
            state.discoveryResults = [];
            discoveryResults.innerHTML = '';
            openDialog(discoveryModal, 'discoveryRegion');
        });
        aiToggle.addEventListener('change', async () => {
            const user = auth.currentUser;
            if (!user) return;
            aiToggle.disabled = true;
            try {
                await database.ref('ai_settings').set({
                    outreachEnabled: aiToggle.checked,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP,
                    administratorUid: user.uid
                });
                state.aiEnabled = aiToggle.checked;
                discoverButton.disabled = !state.aiEnabled;
                render();
                notify(
                    state.aiEnabled ? 'Administrator AI tools enabled.' : 'Administrator AI tools paused.',
                    'success'
                );
            } catch (error) {
                aiToggle.checked = state.aiEnabled;
                notify('Unable to update the AI setting.', 'error');
            } finally {
                aiToggle.disabled = false;
            }
        });
        document.getElementById('copyAiDraftBtn').addEventListener('click', async () => {
            const subject = document.getElementById('aiDraftSubject').value;
            const body = document.getElementById('aiDraftBody').value;
            try {
                await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                notify('Draft copied to the clipboard.', 'success');
            } catch {
                notify('Clipboard access was unavailable. Select and copy the draft manually.', 'error');
            }
        });
        modal.querySelectorAll('[data-close-prospect-modal]').forEach(button => {
            button.addEventListener('click', closeModal);
        });
        modal.addEventListener('click', event => {
            if (event.target === modal) closeModal();
        });
        discoveryModal.querySelectorAll('[data-close-ai-discovery]').forEach(button => {
            button.addEventListener('click', () => closeDialog(discoveryModal));
        });
        draftModal.querySelectorAll('[data-close-ai-draft]').forEach(button => {
            button.addEventListener('click', () => closeDialog(draftModal));
        });
        discoveryModal.addEventListener('click', event => {
            if (event.target === discoveryModal) closeDialog(discoveryModal);
        });
        draftModal.addEventListener('click', event => {
            if (event.target === draftModal) closeDialog(draftModal);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && modal.style.display === 'block') closeModal();
            if (event.key === 'Escape' && discoveryModal.style.display === 'block') closeDialog(discoveryModal);
            if (event.key === 'Escape' && draftModal.style.display === 'block') closeDialog(draftModal);
        });

        auth.onAuthStateChanged(user => {
            if (user) {
                loadOutreachData();
            } else {
                state.prospects = {};
                state.sources = {};
                state.suppressions = {};
                state.drafts = {};
                state.costEvents = {};
                state.discoveryResults = [];
                totals.innerHTML = '';
                list.innerHTML = '';
                loading.hidden = false;
                loading.textContent = 'Sign in with the approved administrator account to view outreach records.';
                lastCallCost.textContent = 'Sign in to view';
                lastCallDetail.textContent = 'Cost records are administrator-only.';
                trackedTotalCost.textContent = '—';
                trackedTotalDetail.textContent = 'Sign in to view private cost records.';
                trackedRequestCount.textContent = '—';
            }
        });
    });
})();
