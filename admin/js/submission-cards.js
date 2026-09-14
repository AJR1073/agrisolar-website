// Keep the original submission-card layout, but enhance the Annual Schedule
// and Outreach tabs with clearer quick actions, filters, and workflow guidance.
(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function dispatchChange(element) {
        if (!element) return;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function makeButton(label, className, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    function enhanceSchedule() {
        const tab = byId('scheduleTab');
        const heading = tab?.querySelector('.schedule-heading');
        const totals = byId('scheduleTotals');
        if (!tab || !heading || !totals || tab.dataset.usabilityEnhanced === 'true') return;

        tab.dataset.usabilityEnhanced = 'true';

        const workspace = document.createElement('section');
        workspace.className = 'admin-workspace-panel schedule-workspace-panel';
        workspace.innerHTML = `
            <div class="admin-workspace-copy">
                <p class="admin-workspace-eyebrow">Schedule workspace</p>
                <h3>What needs attention?</h3>
                <p>Use the queues below to jump straight to unscheduled, overdue, or invoice-ready work. Click any mowing-cycle cell to edit dates, status, crew, equipment, and completion details.</p>
            </div>
            <div class="admin-workspace-actions" data-schedule-quick-actions></div>
        `;
        heading.insertAdjacentElement('afterend', workspace);

        const actions = workspace.querySelector('[data-schedule-quick-actions]');
        actions.append(
            makeButton('Add site + season', 'admin-quick-btn admin-quick-btn--primary', () => byId('addScheduleSiteBtn')?.click()),
            makeButton('Import reviewed CSV', 'admin-quick-btn', () => byId('openScheduleImportBtn')?.click()),
            makeButton('Needs scheduling', 'admin-quick-btn admin-quick-btn--attention', () => tab.querySelector('[data-schedule-view="scheduling"]')?.click()),
            makeButton('Ready to invoice', 'admin-quick-btn', () => tab.querySelector('[data-schedule-view="invoicing"]')?.click()),
            makeButton('Overdue / delayed', 'admin-quick-btn admin-quick-btn--warning', () => tab.querySelector('[data-schedule-view="delayed"]')?.click())
        );

        const filters = tab.querySelector('.schedule-filters');
        if (filters && !filters.querySelector('[data-reset-schedule-filters]')) {
            const reset = makeButton('Reset filters', 'admin-filter-reset', () => {
                const status = byId('scheduleStatusFilter');
                const sort = byId('scheduleSort');
                const search = byId('scheduleSearch');
                if (status) {
                    status.value = 'all';
                    dispatchChange(status);
                }
                if (sort) {
                    sort.value = 'site';
                    dispatchChange(sort);
                }
                if (search) {
                    search.value = '';
                    search.dispatchEvent(new Event('input', { bubbles: true }));
                }
                tab.querySelector('[data-schedule-view="grid"]')?.click();
            });
            reset.dataset.resetScheduleFilters = 'true';
            filters.appendChild(reset);
        }

        const gridView = byId('scheduleGridView');
        if (gridView && !gridView.previousElementSibling?.classList.contains('schedule-use-tip')) {
            const tip = document.createElement('div');
            tip.className = 'schedule-use-tip';
            tip.innerHTML = '<strong>Tip:</strong> Click a mowing-cycle card or row to open the service editor. Use “Scheduling needed” as your daily work queue.';
            gridView.insertAdjacentElement('beforebegin', tip);
        }
    }

    function enhanceOutreach() {
        const tab = byId('outreachTab');
        const heading = tab?.querySelector('.outreach-heading');
        const toolbar = tab?.querySelector('.outreach-toolbar');
        const costSummary = byId('aiCostSummary');
        if (!tab || !heading || !toolbar || tab.dataset.usabilityEnhanced === 'true') return;

        tab.dataset.usabilityEnhanced = 'true';

        const workflow = document.createElement('section');
        workflow.className = 'admin-workspace-panel outreach-workflow-panel';
        workflow.innerHTML = `
            <div class="admin-workspace-copy">
                <p class="admin-workspace-eyebrow">Simple outreach workflow</p>
                <h3>Find → verify → draft → review</h3>
                <p>AI can discover public opportunities and prepare drafts, but nothing sends automatically. Verify the company and source first, then review the draft before using it.</p>
            </div>
            <ol class="outreach-workflow-steps">
                <li><span>1</span><strong>Discover</strong><small>Find public prospects</small></li>
                <li><span>2</span><strong>Verify</strong><small>Check source evidence</small></li>
                <li><span>3</span><strong>Draft</strong><small>Create a review-only email</small></li>
                <li><span>4</span><strong>Review</strong><small>Approve outside this tool</small></li>
            </ol>
        `;
        heading.insertAdjacentElement('afterend', workflow);

        const quickFilters = document.createElement('div');
        quickFilters.className = 'outreach-quick-filters';
        quickFilters.innerHTML = '<span>Quick view:</span>';
        const statusSelect = byId('outreachStatusFilter');
        const searchInput = byId('outreachSearch');

        const setOutreachStatus = (value) => {
            if (!statusSelect) return;
            statusSelect.value = value;
            dispatchChange(statusSelect);
        };

        quickFilters.append(
            makeButton('Needs review', 'admin-filter-chip', () => setOutreachStatus('Needs review')),
            makeButton('Verified', 'admin-filter-chip', () => setOutreachStatus('Verified')),
            makeButton('All', 'admin-filter-chip', () => setOutreachStatus('all')),
            makeButton('Clear search', 'admin-filter-reset', () => {
                if (!searchInput) return;
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            })
        );
        toolbar.insertAdjacentElement('beforebegin', quickFilters);

        if (costSummary && !byId('toggleAiCostSummary')) {
            const toggle = makeButton('Show AI cost details', 'admin-cost-toggle', () => {
                const hidden = costSummary.hidden;
                costSummary.hidden = !hidden;
                toggle.textContent = hidden ? 'Hide AI cost details' : 'Show AI cost details';
            });
            toggle.id = 'toggleAiCostSummary';
            costSummary.hidden = true;
            costSummary.insertAdjacentElement('beforebegin', toggle);
        }

        const discoverButton = byId('discoverProspectsBtn');
        if (discoverButton) {
            discoverButton.title = 'Search public sources for potential AgriSolar customers';
        }
        const addButton = byId('addProspectBtn');
        if (addButton) {
            addButton.title = 'Manually add a prospect you have already reviewed';
        }
    }

    function init() {
        enhanceSchedule();
        enhanceOutreach();

        const observer = new MutationObserver(() => {
            enhanceSchedule();
            enhanceOutreach();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}());
