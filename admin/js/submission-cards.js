(function () {
    'use strict';

    function clean(value) {
        return String(value || '').trim();
    }

    function escapeHtml(value) {
        return clean(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function normalizeMissing(value) {
        const text = clean(value);
        return !text || /^(not provided|none|n\/a|na|unknown|don't know|dont know)$/i.test(text);
    }

    function getField(content, label) {
        const paragraphs = Array.from(content.querySelectorAll(':scope > p'));
        const paragraph = paragraphs.find((item) => {
            const strong = item.querySelector('strong');
            return strong && clean(strong.textContent).replace(/:$/, '') === label;
        });
        if (!paragraph) return '';
        const copy = paragraph.cloneNode(true);
        copy.querySelector('strong')?.remove();
        return clean(copy.textContent);
    }

    function parseMessage(message) {
        const result = {
            facilityType: '',
            serviceFrequency: '',
            vegetationCondition: '',
            qualificationStatus: '',
            missing: [],
            notes: ''
        };
        const lines = String(message || '').split(/\r?\n/);
        const noteLines = [];
        let inNotes = false;

        for (const rawLine of lines) {
            const line = clean(rawLine);
            if (!line) {
                if (inNotes && noteLines.length && noteLines[noteLines.length - 1] !== '') noteLines.push('');
                continue;
            }

            let match = line.match(/^Facility type:\s*(.*)$/i);
            if (match) {
                result.facilityType = clean(match[1]);
                continue;
            }
            match = line.match(/^Service frequency:\s*(.*)$/i);
            if (match) {
                result.serviceFrequency = clean(match[1]);
                continue;
            }
            match = line.match(/^Vegetation condition:\s*(.*)$/i);
            if (match) {
                result.vegetationCondition = clean(match[1]);
                continue;
            }
            match = line.match(/^Qualification:\s*(.*)$/i);
            if (match) {
                const value = clean(match[1]);
                result.qualificationStatus = /needs qualification/i.test(value)
                    ? 'needs_qualification'
                    : 'ready';
                const missingMatch = value.match(/missing:\s*(.*)$/i);
                if (missingMatch) {
                    result.missing = missingMatch[1].split(',').map(clean).filter(Boolean);
                }
                continue;
            }
            match = line.match(/^Customer notes:\s*(.*)$/i);
            if (match) {
                inNotes = true;
                if (clean(match[1])) noteLines.push(clean(match[1]));
                continue;
            }

            inNotes = true;
            noteLines.push(line);
        }

        result.notes = clean(noteLines.join('\n').replace(/\n{3,}/g, '\n\n'));
        return result;
    }

    function detail(label, value, options = {}) {
        const display = normalizeMissing(value) ? 'Not provided' : clean(value);
        const content = options.href && !normalizeMissing(value)
            ? `<a href="${escapeHtml(options.href)}">${escapeHtml(display)}</a>`
            : escapeHtml(display);
        return `<div class="lead-detail"><span>${escapeHtml(label)}</span><strong>${content}</strong></div>`;
    }

    function inferQualification(fields, parsed) {
        if (parsed.qualificationStatus) {
            return {
                status: parsed.qualificationStatus,
                missing: parsed.missing
            };
        }

        const missing = [];
        if (normalizeMissing(fields.company)) missing.push('company');
        if (normalizeMissing(fields.phone)) missing.push('phone');
        if (normalizeMissing(fields.location) || /^test only$/i.test(clean(fields.location))) missing.push('usable site location');
        if (normalizeMissing(fields.acreage)) missing.push('acreage');
        if (normalizeMissing(fields.schedule)) missing.push('desired schedule');
        return { status: missing.length ? 'needs_qualification' : 'ready', missing };
    }

    function enhanceCard(card) {
        if (card.dataset.leadCardEnhanced === 'true') return;
        const content = card.querySelector('.submission-content');
        if (!content) return;

        const fields = {
            name: getField(content, 'Name'),
            company: getField(content, 'Company'),
            email: getField(content, 'Email'),
            phone: getField(content, 'Phone'),
            location: getField(content, 'Solar-site location'),
            acreage: getField(content, 'Approximate acreage'),
            service: getField(content, 'Service'),
            schedule: getField(content, 'Desired schedule'),
            message: getField(content, 'Message')
        };
        const parsed = parseMessage(fields.message);
        const qualification = inferQualification(fields, parsed);
        const attachments = content.querySelector('.submission-attachments')?.outerHTML || '';
        const replyDetails = content.querySelector('.reply-details')?.outerHTML || '';
        const emailHref = normalizeMissing(fields.email) ? '' : `mailto:${fields.email}`;
        const phoneHref = normalizeMissing(fields.phone) ? '' : `tel:${fields.phone.replace(/[^+\d]/g, '')}`;

        const qualificationBadge = qualification.status === 'needs_qualification'
            ? `<span class="lead-qualification lead-qualification--needs">Needs qualification</span>`
            : `<span class="lead-qualification lead-qualification--ready">Ready for review</span>`;
        const missingBlock = qualification.missing.length
            ? `<div class="lead-missing"><strong>Missing information:</strong> ${escapeHtml(qualification.missing.join(', '))}</div>`
            : '';

        content.innerHTML = `
            <div class="lead-summary-line">
                <strong>${escapeHtml(fields.service || 'Website inquiry')}</strong>
                ${qualificationBadge}
            </div>
            <div class="lead-sections">
                <section class="lead-section">
                    <h3>Contact</h3>
                    <div class="lead-detail-grid">
                        ${detail('Name', fields.name)}
                        ${detail('Company', fields.company)}
                        ${detail('Email', fields.email, { href: emailHref })}
                        ${detail('Phone', fields.phone, { href: phoneHref })}
                    </div>
                </section>
                <section class="lead-section">
                    <h3>Project</h3>
                    <div class="lead-detail-grid">
                        ${detail('Location', fields.location)}
                        ${detail('Acreage', fields.acreage)}
                        ${detail('Facility', parsed.facilityType)}
                        ${detail('Service', fields.service)}
                        ${detail('Frequency', parsed.serviceFrequency)}
                        ${detail('Vegetation', parsed.vegetationCondition)}
                        ${detail('Desired schedule', fields.schedule)}
                    </div>
                </section>
            </div>
            <section class="lead-notes">
                <h3>Customer notes</h3>
                <p>${escapeHtml(parsed.notes || 'None provided')}</p>
            </section>
            ${missingBlock}
            ${attachments}
            ${replyDetails}
        `;

        card.dataset.leadCardEnhanced = 'true';
    }

    function enhanceAll(root) {
        root.querySelectorAll('.submission-item').forEach(enhanceCard);
    }

    function init() {
        const list = document.getElementById('submissionsList');
        if (!list || list.dataset.leadObserverAttached === 'true') return;

        list.dataset.leadObserverAttached = 'true';
        enhanceAll(list);
        const observer = new MutationObserver(() => enhanceAll(list));
        observer.observe(list, { childList: true, subtree: false });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}());
