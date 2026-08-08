(function initializeReviewCenter() {
    'use strict';

    const state = {
        loaded: false,
        loading: false,
        view: 'opportunities',
        data: {
            opportunities: [],
            tasks: [],
            agents: [],
            approvals: [],
            auditEvents: []
        },
        lastFocus: null
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function safeUrl(value) {
        try {
            const parsed = new URL(String(value || ''));
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch {
            return '';
        }
    }

    function formatDate(value, includeTime = false) {
        if (!value) return 'Not recorded';
        const date = typeof value === 'number'
            ? new Date(value)
            : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value))
                ? `${value}T12:00:00`
                : value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('en-US', includeTime
            ? { dateStyle: 'medium', timeStyle: 'short' }
            : { dateStyle: 'medium' }).format(date);
    }

    function reviewStatus(record) {
        return record.reviewStatus || record.status || 'unknown';
    }

    function displayStatus(value) {
        return String(value || 'unknown').replaceAll('_', ' ');
    }

    function values(value) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object') {
            return Object.entries(value)
                .filter(([, enabled]) => enabled === true)
                .map(([key]) => key);
        }
        return [];
    }

    function recordId(record, type) {
        const fieldByType = {
            opportunity: 'opportunityId',
            task: 'taskId',
            agent: 'agentId',
            approval: 'approvalId',
            audit: 'auditEventId'
        };
        return record[fieldByType[type]] || record.id || '';
    }

    function normalizedData(data) {
        const aliases = {
            opportunities: ['opportunities', 'pendingOpportunities'],
            tasks: ['tasks', 'pendingTasks'],
            agents: ['agents', 'agentIdentities'],
            approvals: ['approvals', 'approvalRequests'],
            auditEvents: ['auditEvents', 'audit']
        };
        return Object.fromEntries(Object.entries(aliases).map(([target, sources]) => {
            const value = sources.map(source => data?.[source]).find(Array.isArray);
            return [target, value || []];
        }));
    }

    function relatedAudit(entityType, entityId) {
        return state.data.auditEvents
            .filter(event => event.entityType === entityType && event.entityId === entityId)
            .sort((left, right) => Number(right.occurredAt || 0) - Number(left.occurredAt || 0))
            .slice(0, 8);
    }

    function auditDetails(events) {
        if (!events.length) return '<p>No linked audit event has been recorded.</p>';
        return `<div class="review-audit-list">${events.map(event => `
            <div class="review-audit-event">
                <span>${escapeHtml(formatDate(event.occurredAt, true))}</span>
                <strong>${escapeHtml(event.action || 'Activity')}</strong>
                <span>${escapeHtml(event.changeSummary || event.result || '')}</span>
            </div>
        `).join('')}</div>`;
    }

    function decisionActions(entityType, entityId, status) {
        if (status !== 'pending_review') return '';
        return `<div class="review-card-actions">
            <button type="button" class="action-btn" data-review-decision="approve" data-entity-type="${escapeHtml(entityType)}" data-entity-id="${escapeHtml(entityId)}">Approve record</button>
            <button type="button" class="action-btn secondary reject" data-review-decision="reject" data-entity-type="${escapeHtml(entityType)}" data-entity-id="${escapeHtml(entityId)}">Reject record</button>
        </div>`;
    }

    function opportunityCard(record) {
        const id = recordId(record, 'opportunity');
        const status = reviewStatus(record);
        const sourceUrl = safeUrl(record.source?.url);
        const audit = relatedAudit('opportunity', id);
        const confidence = Number(record.aiProvenance?.confidence);
        const confidenceText = Number.isFinite(confidence)
            ? `${Math.round(confidence * 100)}%`
            : 'Not recorded';
        const createdBy = record.createdByActorType === 'AI_AGENT'
            ? `AI agent ${record.createdByActorId || record.aiProvenance?.agentId || 'unknown'}`
            : 'Administrator';

        return `<article class="review-card">
            <div class="review-card-header">
                <div>
                    <h3>${escapeHtml(record.companyNameSnapshot || record.siteNameSnapshot || 'Unnamed opportunity')}</h3>
                    <p class="review-card-subtitle">${escapeHtml(record.siteNameSnapshot || 'Site not recorded')} · ${escapeHtml([record.city, record.state].filter(Boolean).join(', ') || 'Location not recorded')}</p>
                </div>
                <div class="review-badges">
                    <span class="review-badge ${escapeHtml(status)}">${escapeHtml(displayStatus(status))}</span>
                    <span class="review-badge">${escapeHtml(record.priority || 'normal')} priority</span>
                </div>
            </div>
            <div class="review-card-body">
                <section class="review-panel">
                    <h4>Source-backed facts</h4>
                    <p><strong>Estimated acres:</strong> ${escapeHtml(record.estimatedAcreage || 'Not recorded')}</p>
                    <p><strong>Opportunity type:</strong> ${escapeHtml(displayStatus(record.opportunityType || 'Not recorded'))}</p>
                    <p><strong>Bid deadline:</strong> ${escapeHtml(formatDate(record.bidDeadlineOn))}</p>
                    <p><strong>Source:</strong> ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.source?.title || sourceUrl)}</a>` : 'Not recorded'}</p>
                    <p>${escapeHtml(record.projectDetails || record.notes || 'No factual project details recorded.')}</p>
                </section>
                <section class="review-panel ai">
                    <h4>AI inference — verify before approval</h4>
                    <p><strong>Created by:</strong> ${escapeHtml(createdBy)}</p>
                    <p><strong>Model:</strong> ${escapeHtml(record.aiProvenance?.model || 'Not recorded')}</p>
                    <p><strong>Confidence:</strong> ${escapeHtml(confidenceText)}</p>
                    <p>${escapeHtml(record.aiProvenance?.researchSummary || 'No AI research summary recorded.')}</p>
                    <p><strong>Recommended next action:</strong> ${escapeHtml(record.nextAction || 'Not recorded')}</p>
                </section>
                <details class="review-audit">
                    <summary>Linked audit history (${audit.length})</summary>
                    ${auditDetails(audit)}
                </details>
            </div>
            ${decisionActions('opportunity', id, status)}
        </article>`;
    }

    function taskCard(record) {
        const id = recordId(record, 'task');
        const status = reviewStatus(record);
        const audit = relatedAudit('task', id);
        return `<article class="review-card">
            <div class="review-card-header">
                <div>
                    <h3>${escapeHtml(record.title || 'Untitled task')}</h3>
                    <p class="review-card-subtitle">Due ${escapeHtml(formatDate(record.dueOn))} · Related ${escapeHtml(record.relatedEntityType || 'record')} ${escapeHtml(record.relatedEntityId || '')}</p>
                </div>
                <div class="review-badges">
                    <span class="review-badge ${escapeHtml(status)}">${escapeHtml(displayStatus(status))}</span>
                    <span class="review-badge">${escapeHtml(record.priority || 'normal')} priority</span>
                </div>
            </div>
            <div class="review-card-body">
                <section class="review-panel">
                    <h4>Internal task</h4>
                    <p>${escapeHtml(record.description || 'No description recorded.')}</p>
                    <p><strong>Owner:</strong> ${escapeHtml(record.ownerUserId || 'Unassigned')}</p>
                    <p><strong>Task status:</strong> ${escapeHtml(displayStatus(record.status || 'open'))}</p>
                </section>
                <section class="review-panel ai">
                    <h4>AI reasoning — verify before approval</h4>
                    <p><strong>Created by:</strong> ${escapeHtml(record.createdByActorId || 'Unknown agent')}</p>
                    <p>${escapeHtml(record.aiReasoning || 'No AI reasoning recorded.')}</p>
                </section>
                <details class="review-audit">
                    <summary>Linked audit history (${audit.length})</summary>
                    ${auditDetails(audit)}
                </details>
            </div>
            ${decisionActions('task', id, status)}
        </article>`;
    }

    function agentCard(record) {
        const status = record.status || 'unknown';
        const capabilities = values(record.capabilities);
        return `<article class="review-card">
            <div class="review-card-header">
                <div>
                    <h3>${escapeHtml(record.displayName || recordId(record, 'agent') || 'Unnamed agent')}</h3>
                    <p class="review-card-subtitle">${escapeHtml(record.environment || 'Environment not recorded')} · Authority level ${escapeHtml(record.authorityLevel ?? '—')}</p>
                </div>
                <span class="review-badge ${escapeHtml(status)}">${escapeHtml(displayStatus(status))}</span>
            </div>
            <div class="review-card-body">
                <section class="review-panel">
                    <h4>Revocable identity</h4>
                    <p><strong>Agent ID:</strong> ${escapeHtml(recordId(record, 'agent'))}</p>
                    <p><strong>Expires:</strong> ${escapeHtml(formatDate(record.expiresAt, true))}</p>
                    <p><strong>Last used:</strong> ${escapeHtml(formatDate(record.lastUsedAt, true))}</p>
                </section>
                <section class="review-panel">
                    <h4>Granted capabilities</h4>
                    <p>${capabilities.length ? capabilities.map(escapeHtml).join(' · ') : 'No capabilities granted'}</p>
                </section>
            </div>
        </article>`;
    }

    function approvalCard(record) {
        const status = record.status || 'pending';
        return `<article class="review-card">
            <div class="review-card-header">
                <div>
                    <h3>${escapeHtml(displayStatus(record.actionType || 'Approval request'))}</h3>
                    <p class="review-card-subtitle">Requested ${escapeHtml(formatDate(record.requestedAt, true))}</p>
                </div>
                <span class="review-badge ${escapeHtml(status)}">${escapeHtml(displayStatus(status))}</span>
            </div>
            <div class="review-card-body">
                <section class="review-panel">
                    <h4>Protected request summary</h4>
                    <p><strong>Risk level:</strong> ${escapeHtml(record.riskLevel ?? 'Not recorded')}</p>
                    <p><strong>Requested by:</strong> ${escapeHtml(record.requestedByActorId || 'Not recorded')}</p>
                    <p><strong>Related record:</strong> ${escapeHtml(record.relatedEntityType || 'None')} ${escapeHtml(record.relatedEntityId || '')}</p>
                </section>
                <section class="review-panel">
                    <h4>Execution state</h4>
                    <p>${escapeHtml(displayStatus(record.executionStatus || 'pending'))}</p>
                    <p>No action can be executed from this review-center phase.</p>
                </section>
            </div>
        </article>`;
    }

    function auditCard(record) {
        return `<article class="review-card">
            <div class="review-card-header">
                <div>
                    <h3>${escapeHtml(record.action || 'Audit event')}</h3>
                    <p class="review-card-subtitle">${escapeHtml(formatDate(record.occurredAt, true))} · ${escapeHtml(record.actorType || 'Actor')} ${escapeHtml(record.actorId || '')}</p>
                </div>
                <span class="review-badge ${escapeHtml(record.result || 'unknown')}">${escapeHtml(displayStatus(record.result || 'unknown'))}</span>
            </div>
            <div class="review-card-body">
                <section class="review-panel">
                    <h4>Request trace</h4>
                    <p><strong>Request ID:</strong> ${escapeHtml(record.requestId || 'Not recorded')}</p>
                    <p><strong>Entity:</strong> ${escapeHtml(record.entityType || 'None')} ${escapeHtml(record.entityId || '')}</p>
                    <p><strong>Source:</strong> ${escapeHtml(record.source || 'Not recorded')}</p>
                </section>
                <section class="review-panel">
                    <h4>Safe change summary</h4>
                    <p>${escapeHtml(record.changeSummary || record.errorCode || 'No additional summary recorded.')}</p>
                </section>
            </div>
        </article>`;
    }

    function recordsForView() {
        const map = {
            opportunities: state.data.opportunities,
            tasks: state.data.tasks,
            agents: state.data.agents,
            approvals: state.data.approvals,
            audit: state.data.auditEvents
        };
        return map[state.view] || [];
    }

    function renderTotals() {
        const pendingOpportunities = state.data.opportunities.filter(item => reviewStatus(item) === 'pending_review').length;
        const pendingTasks = state.data.tasks.filter(item => reviewStatus(item) === 'pending_review').length;
        const activeAgents = state.data.agents.filter(item => item.status === 'active').length;
        const pendingApprovals = state.data.approvals.filter(item => item.status === 'pending').length;
        const failedAudits = state.data.auditEvents.filter(item => item.result === 'failed').length;
        const totals = [
            ['Pending opportunities', pendingOpportunities],
            ['Pending tasks', pendingTasks],
            ['Active agents', activeAgents],
            ['Pending approvals', pendingApprovals],
            ['Recent failures', failedAudits]
        ];
        document.getElementById('reviewTotals').innerHTML = totals.map(([label, value]) => `
            <div class="review-total"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>
        `).join('');
    }

    function render() {
        const list = document.getElementById('reviewList');
        const loading = document.getElementById('reviewLoading');
        const filter = document.getElementById('reviewStatusFilter');
        const search = document.getElementById('reviewSearch').value.trim().toLowerCase();
        filter.disabled = !['opportunities', 'tasks'].includes(state.view);
        const filtered = recordsForView().filter(record => {
            if (!filter.disabled && filter.value !== 'all' && reviewStatus(record) !== filter.value) return false;
            if (!search) return true;
            return JSON.stringify(record).toLowerCase().includes(search);
        });

        renderTotals();
        loading.style.display = 'none';
        if (!filtered.length) {
            list.innerHTML = '<div class="review-empty">No protected records match this view and filter.</div>';
            return;
        }
        const renderer = {
            opportunities: opportunityCard,
            tasks: taskCard,
            agents: agentCard,
            approvals: approvalCard,
            audit: auditCard
        }[state.view];
        list.innerHTML = filtered.map(renderer).join('');
    }

    async function apiRequest(path, options = {}) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Sign in with the approved administrator account.');
        const token = await user.getIdToken(true);
        const response = await fetch(path, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {})
            }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error?.message || `The review service returned ${response.status}.`);
        }
        return payload;
    }

    async function loadReviewCenter(force = false) {
        if (state.loading || (state.loaded && !force)) return;
        state.loading = true;
        const loading = document.getElementById('reviewLoading');
        const list = document.getElementById('reviewList');
        loading.style.display = 'block';
        loading.textContent = 'Loading protected review records…';
        list.innerHTML = '';
        try {
            const payload = await apiRequest('/api/v1/admin/review-center?status=all&limit=100');
            state.data = normalizedData(payload.data || {});
            state.loaded = true;
            render();
        } catch (error) {
            state.loaded = false;
            loading.textContent = error.message;
            if (typeof showMessage === 'function') showMessage(error.message, 'error');
        } finally {
            state.loading = false;
        }
    }

    function closeDecisionModal() {
        const modal = document.getElementById('reviewDecisionModal');
        modal.style.display = 'none';
        document.getElementById('reviewDecisionForm').reset();
        state.lastFocus?.focus();
        state.lastFocus = null;
    }

    function openDecisionModal(button) {
        state.lastFocus = button;
        const decision = button.dataset.reviewDecision;
        const entityType = button.dataset.entityType;
        const entityId = button.dataset.entityId;
        document.getElementById('reviewDecisionEntityType').value = entityType;
        document.getElementById('reviewDecisionEntityId').value = entityId;
        document.getElementById('reviewDecisionValue').value = decision;
        document.getElementById('reviewDecisionTitle').textContent = decision === 'approve'
            ? `Approve ${entityType}`
            : `Reject ${entityType}`;
        document.getElementById('reviewDecisionSummary').textContent = decision === 'approve'
            ? 'Confirm that you reviewed the source evidence and AI-generated conclusions.'
            : 'The record will be retained with a rejected review state and audit history.';
        const submit = document.getElementById('reviewDecisionSubmit');
        const reason = document.getElementById('reviewDecisionReason');
        submit.textContent = decision === 'approve' ? 'Approve record' : 'Reject record';
        submit.classList.toggle('reject', decision === 'reject');
        reason.required = decision === 'reject';
        document.getElementById('reviewDecisionModal').style.display = 'flex';
        reason.focus();
    }

    function idempotencyKey(entityType, entityId, decision) {
        const random = globalThis.crypto?.randomUUID?.()
            || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `admin-review:${entityType}:${entityId}:${decision}:${random}`;
    }

    async function submitDecision(event) {
        event.preventDefault();
        const entityType = document.getElementById('reviewDecisionEntityType').value;
        const entityId = document.getElementById('reviewDecisionEntityId').value;
        const decision = document.getElementById('reviewDecisionValue').value;
        const reason = document.getElementById('reviewDecisionReason').value.trim();
        const submit = document.getElementById('reviewDecisionSubmit');
        const originalText = submit.textContent;
        submit.disabled = true;
        submit.textContent = 'Saving decision…';
        try {
            await apiRequest('/api/v1/admin/reviews', {
                method: 'POST',
                headers: { 'Idempotency-Key': idempotencyKey(entityType, entityId, decision) },
                body: JSON.stringify({ entityType, entityId, decision, reason })
            });
            closeDecisionModal();
            state.loaded = false;
            await loadReviewCenter(true);
            if (typeof showMessage === 'function') {
                showMessage(`The ${entityType} was ${decision === 'approve' ? 'approved' : 'rejected'} and audited.`, 'success');
            }
        } catch (error) {
            if (typeof showMessage === 'function') showMessage(error.message, 'error');
        } finally {
            submit.disabled = false;
            submit.textContent = originalText;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const tabButton = document.querySelector('[data-tab="reviewCenter"]');
        if (!tabButton) return;

        tabButton.addEventListener('click', () => loadReviewCenter());
        document.getElementById('reviewRefreshBtn').addEventListener('click', () => loadReviewCenter(true));
        document.getElementById('reviewStatusFilter').addEventListener('change', render);
        document.getElementById('reviewSearch').addEventListener('input', render);
        document.getElementById('reviewDecisionForm').addEventListener('submit', submitDecision);

        document.querySelectorAll('[data-review-view]').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('[data-review-view]').forEach(item => item.classList.remove('active'));
                button.classList.add('active');
                state.view = button.dataset.reviewView;
                render();
            });
        });

        document.querySelectorAll('[data-close-review-decision]').forEach(button => {
            button.addEventListener('click', closeDecisionModal);
        });
        document.getElementById('reviewDecisionModal').addEventListener('click', event => {
            if (event.target === event.currentTarget) closeDecisionModal();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape'
                && document.getElementById('reviewDecisionModal').style.display !== 'none') {
                closeDecisionModal();
            }
        });
        document.getElementById('reviewList').addEventListener('click', event => {
            const button = event.target.closest('[data-review-decision]');
            if (button) openDecisionModal(button);
        });

        firebase.auth().onAuthStateChanged(user => {
            if (!user) {
                state.loaded = false;
                state.data = normalizedData({});
                document.getElementById('reviewList').innerHTML = '';
                document.getElementById('reviewLoading').textContent = 'Sign in with the approved administrator account to view AI records.';
            }
        });
    });
})();
