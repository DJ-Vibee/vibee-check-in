// JotForm API integration for waiver verification
// Uses vibee.jotform.com subdomain with APIKEY header

const JOTFORM_API_BASE = 'https://vibee.jotform.com/API';

/**
 * Check if a waiver submission exists for a given order number
 * @param {string} apiKey - JotForm API key
 * @param {string} formId - JotForm form ID
 * @param {string} orderNumber - Order number to search for
 * @returns {Promise<{found: boolean, submission?: object}>}
 */
export const checkWaiverSubmission = async (apiKey, formId, orderNumber) => {
    if (!apiKey || !formId || !orderNumber) {
        return { found: false, error: 'Missing required parameters' };
    }

    try {
        const cleanOrderNum = orderNumber.replace('#', '').trim();

        // Fetch recent submissions and search for order number
        const response = await fetch(
            `${JOTFORM_API_BASE}/form/${formId}/submissions?limit=100`,
            {
                method: 'GET',
                headers: {
                    'APIKEY': apiKey,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.responseCode === 200 && data.content) {
            // Search through submissions for matching order number
            const matchingSubmission = data.content.find(sub => {
                const answers = sub.answers || {};
                // Check the 'order' field specifically
                const orderAnswer = Object.values(answers).find(a =>
                    a.name === 'order' || a.name?.toLowerCase().includes('order')
                );
                if (orderAnswer) {
                    return String(orderAnswer.answer || '').includes(cleanOrderNum);
                }
                // Fallback: check all fields
                return Object.values(answers).some(answer => {
                    const answerText = String(answer.answer || '');
                    return answerText === cleanOrderNum;
                });
            });

            if (matchingSubmission) {
                return {
                    found: true,
                    submission: matchingSubmission
                };
            }
        }

        return { found: false };
    } catch (error) {
        console.error('JotForm API error:', error);
        return { found: false, error: error.message };
    }
};

/**
 * Batch check multiple order numbers against JotForm submissions
 * @param {string} apiKey - JotForm API key
 * @param {string} formId - JotForm form ID  
 * @param {string[]} orderNumbers - Array of order numbers to check
 * @returns {Promise<Map<string, boolean>>} Map of orderNumber -> hasWaiver
 */
export const batchCheckWaivers = async (apiKey, formId, orderNumbers) => {
    const results = new Map();

    if (!apiKey || !formId) {
        orderNumbers.forEach(num => results.set(num, false));
        return results;
    }

    try {
        // Fetch all submissions in batches (JotForm limits to ~1000 per request)
        let allSubmissions = [];
        let offset = 0;
        const limit = 1000;

        // Keep fetching until we have all submissions
        while (true) {
            const response = await fetch(
                `${JOTFORM_API_BASE}/form/${formId}/submissions?limit=${limit}&offset=${offset}`,
                {
                    method: 'GET',
                    headers: {
                        'APIKEY': apiKey,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.responseCode === 200 && data.content && data.content.length > 0) {
                allSubmissions = allSubmissions.concat(data.content);
                if (data.content.length < limit) break; // No more pages
                offset += limit;
            } else {
                break;
            }
        }

        console.log(`Fetched ${allSubmissions.length} JotForm submissions`);

        // Build a set of submitted order numbers from the 'order' field
        const submittedOrders = new Set();

        allSubmissions.forEach(sub => {
            const answers = sub.answers || {};
            // Look for the 'order' field
            Object.values(answers).forEach(answer => {
                if (answer.name === 'order' || answer.name?.toLowerCase().includes('order')) {
                    const orderVal = String(answer.answer || '').trim();
                    if (orderVal) {
                        submittedOrders.add(orderVal);
                    }
                }
            });
        });

        console.log(`Found ${submittedOrders.size} unique order numbers with waivers`);

        // Set results - match against our guest order numbers
        orderNumbers.forEach(num => {
            const cleanNum = String(num).replace('#', '').trim();
            results.set(num, submittedOrders.has(cleanNum));
        });

    } catch (error) {
        console.error('JotForm batch check error:', error);
        orderNumbers.forEach(num => results.set(num, false));
    }

    return results;
};

export default { checkWaiverSubmission, batchCheckWaivers };
