'use strict';

const PRICING_VERSION = 'openai-standard-short-2026-08-02';
const WEB_SEARCH_MICRO_USD_PER_CALL = 10000;
const MODEL_RATES_USD_PER_MILLION = {
    'gpt-5.6-sol': {
        input: 5,
        cachedInput: 0.5,
        cacheWrite: 6.25,
        output: 30
    },
    'gpt-5.6-terra': {
        input: 2,
        cachedInput: 0.2,
        cacheWrite: 2.5,
        output: 12
    },
    'gpt-5.6-luna': {
        input: 0.2,
        cachedInput: 0.02,
        cacheWrite: 0.25,
        output: 1.2
    }
};

function nonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function pricingModelFor(model) {
    const name = String(model || '').toLowerCase();
    if (name === 'gpt-5.6' || name.startsWith('gpt-5.6-sol')) return 'gpt-5.6-sol';
    if (name.startsWith('gpt-5.6-terra')) return 'gpt-5.6-terra';
    if (name.startsWith('gpt-5.6-luna')) return 'gpt-5.6-luna';
    if (name.startsWith('gpt-5.6-')) return 'gpt-5.6-sol';
    return '';
}

function countWebSearchCalls(response) {
    return (Array.isArray(response?.output) ? response.output : [])
        .filter((item) => item?.type === 'web_search_call')
        .length;
}

function estimateResponseCost(response) {
    const actualModel = String(response?.model || '');
    const pricingModel = pricingModelFor(actualModel);
    const rates = MODEL_RATES_USD_PER_MILLION[pricingModel];
    const usage = response?.usage || {};
    const details = usage.input_tokens_details || {};
    const inputTokens = nonNegativeInteger(usage.input_tokens);
    const cachedInputTokens = Math.min(
        inputTokens,
        nonNegativeInteger(details.cached_tokens)
    );
    const cacheWriteTokens = Math.min(
        Math.max(0, inputTokens - cachedInputTokens),
        nonNegativeInteger(details.cache_write_tokens)
    );
    const uncachedInputTokens = Math.max(
        0,
        inputTokens - cachedInputTokens - cacheWriteTokens
    );
    const outputTokens = nonNegativeInteger(usage.output_tokens);
    const webSearchCalls = countWebSearchCalls(response);

    const common = {
        available: Boolean(rates),
        pricingVersion: PRICING_VERSION,
        actualModel,
        pricingModel,
        inputTokens,
        cachedInputTokens,
        cacheWriteTokens,
        outputTokens,
        webSearchCalls
    };
    if (!rates) return { ...common, estimatedMicroUsd: 0 };

    const inputMicroUsd = Math.round(uncachedInputTokens * rates.input);
    const cachedInputMicroUsd = Math.round(cachedInputTokens * rates.cachedInput);
    const cacheWriteMicroUsd = Math.round(cacheWriteTokens * rates.cacheWrite);
    const outputMicroUsd = Math.round(outputTokens * rates.output);
    const webSearchMicroUsd = webSearchCalls * WEB_SEARCH_MICRO_USD_PER_CALL;

    return {
        ...common,
        estimatedMicroUsd: inputMicroUsd
            + cachedInputMicroUsd
            + cacheWriteMicroUsd
            + outputMicroUsd
            + webSearchMicroUsd,
        inputMicroUsd,
        cachedInputMicroUsd,
        cacheWriteMicroUsd,
        outputMicroUsd,
        webSearchMicroUsd,
        ratesUsdPerMillion: rates
    };
}

module.exports = {
    MODEL_RATES_USD_PER_MILLION,
    PRICING_VERSION,
    WEB_SEARCH_MICRO_USD_PER_CALL,
    countWebSearchCalls,
    estimateResponseCost,
    pricingModelFor
};
