const fs = require('node:fs');

const PRIMARY_ADMIN = 'aaronreifschneider@outlook.com';
const SECOND_ADMIN = 'rfschndr@outlook.com';

function updateFile(path, transform) {
    const before = fs.readFileSync(path, 'utf8');
    const after = transform(before);
    if (after === before) {
        console.log(`No change needed: ${path}`);
        return false;
    }
    fs.writeFileSync(path, after);
    console.log(`Updated: ${path}`);
    return true;
}

function patchDatabaseRules(source) {
    let text = source;
    if (!text.includes(SECOND_ADMIN)) {
        text = text.replaceAll(
            `auth.token.email == '${PRIMARY_ADMIN}'`,
            `(auth.token.email == '${PRIMARY_ADMIN}' || auth.token.email == '${SECOND_ADMIN}')`
        );
    }

    if (!text.includes('"facilityType"')) {
        const scheduleBlock = `        "schedule": {\n          ".validate": "newData.isString() && newData.val().length <= 100"\n        },\n        "message": {\n          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 2000"\n        },`;
        const expandedBlock = `        "schedule": {\n          ".validate": "newData.isString() && newData.val().length <= 100"\n        },\n        "facilityType": {\n          ".validate": "newData.isString() && newData.val().length <= 80"\n        },\n        "serviceFrequency": {\n          ".validate": "newData.isString() && newData.val().length <= 100"\n        },\n        "vegetationCondition": {\n          ".validate": "newData.isString() && newData.val().length <= 120"\n        },\n        "customerNotes": {\n          ".validate": "newData.isString() && newData.val().length <= 2000"\n        },\n        "qualificationStatus": {\n          ".validate": "newData.isString() && (newData.val() == 'ready' || newData.val() == 'needs_qualification')"\n        },\n        "missingQualificationFields": {\n          "$field": {\n            ".validate": "$field.matches(/^[0-9]+$/) && newData.isString() && newData.val().length > 0 && newData.val().length <= 80"\n          }\n        },\n        "source": {\n          ".validate": "newData.isString() && newData.val() == 'website'"\n        },\n        "message": {\n          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 3000"\n        },`;
        if (!text.includes(scheduleBlock)) {
            throw new Error('Could not find the contact submission schedule/message rule block.');
        }
        text = text.replace(scheduleBlock, expandedBlock);
    }

    return text;
}

function patchStorageRules(source) {
    if (source.includes(SECOND_ADMIN)) return source;
    return source.replace(
        `request.auth.token.email == '${PRIMARY_ADMIN}'`,
        `(request.auth.token.email == '${PRIMARY_ADMIN}' || request.auth.token.email == '${SECOND_ADMIN}')`
    );
}

function patchFunctionsIndex(source) {
    let text = source;
    if (!text.includes('const ADMIN_EMAILS = new Set')) {
        text = text.replace(
            `const ADMIN_EMAIL = '${PRIMARY_ADMIN}';`,
            `const ADMIN_EMAILS = new Set([\n    '${PRIMARY_ADMIN}',\n    '${SECOND_ADMIN}'\n]);`
        );
    }
    text = text.replaceAll(
        'decodedToken.email !== ADMIN_EMAIL',
        '!ADMIN_EMAILS.has(decodedToken.email)'
    );
    text = text.replace(
        'administratorEmail: ADMIN_EMAIL,',
        'administratorEmails: [...ADMIN_EMAILS],'
    );
    return text;
}

function patchBusinessApi(source) {
    let text = source;
    if (!text.includes('const administratorEmails = new Set')) {
        text = text.replace(
            '    const administratorEmail = options.administratorEmail;',
            `    const administratorEmails = new Set([\n        ...(Array.isArray(options.administratorEmails) ? options.administratorEmails : []),\n        options.administratorEmail\n    ].filter(Boolean));`
        );
    }
    text = text.replace(
        'if (administratorEmail && token.email === administratorEmail) {',
        'if (administratorEmails.has(token.email)) {'
    );
    return text;
}

let changed = false;
changed = updateFile('database.rules.json', patchDatabaseRules) || changed;
changed = updateFile('storage.rules', patchStorageRules) || changed;
changed = updateFile('functions/index.js', patchFunctionsIndex) || changed;
changed = updateFile('functions/business-api.js', patchBusinessApi) || changed;

console.log(changed ? 'Admin access migration produced changes.' : 'Admin access migration is already applied.');
