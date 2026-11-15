// Gold and silver: each purchase at today's price, totals, and purchases grouped into sets
function computeMetalHoldings(entries, pricePerGram) {
    const holdings = entries.map((entry) => {
        const totalInvested = parseFloat((entry.quantity * entry.purchasePrice).toFixed(2));
        const currentValue = parseFloat((entry.quantity * pricePerGram).toFixed(2));
        const gain = parseFloat((currentValue - totalInvested).toFixed(2));
        const gainPercent = totalInvested > 0 ? parseFloat(((gain / totalInvested) * 100).toFixed(2)) : 0;
        const holdingDays = Math.floor(
            (Date.now() - new Date(entry.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return { ...entry, totalInvested, currentValue, gain, gainPercent, holdingDays };
    });

    const totals = holdings.reduce(
        (acc, h) => ({
            totalQuantity: acc.totalQuantity + h.quantity,
            totalInvested: acc.totalInvested + h.totalInvested,
            totalCurrentValue: acc.totalCurrentValue + h.currentValue,
            totalGain: acc.totalGain + h.gain,
        }),
        { totalQuantity: 0, totalInvested: 0, totalCurrentValue: 0, totalGain: 0 }
    );
    totals.totalQuantity = parseFloat(totals.totalQuantity.toFixed(4));
    totals.totalInvested = parseFloat(totals.totalInvested.toFixed(2));
    totals.totalCurrentValue = parseFloat(totals.totalCurrentValue.toFixed(2));
    totals.totalGain = parseFloat(totals.totalGain.toFixed(2));
    totals.totalGainPercent =
        totals.totalInvested > 0
            ? parseFloat(((totals.totalGain / totals.totalInvested) * 100).toFixed(2))
            : 0;

    // Group entries into sets (optional `set` field) -> weighted avg buy price per set
    const setMap = new Map();
    for (const h of holdings) {
        const name = h.set || 'Unassigned';
        if (!setMap.has(name)) setMap.set(name, []);
        setMap.get(name).push(h);
    }
    const sets = [...setMap.entries()].map(([name, items]) => {
        const quantity = parseFloat(items.reduce((a, h) => a + h.quantity, 0).toFixed(4));
        const invested = parseFloat(items.reduce((a, h) => a + h.totalInvested, 0).toFixed(2));
        const currentValue = parseFloat(items.reduce((a, h) => a + h.currentValue, 0).toFixed(2));
        const gain = parseFloat((currentValue - invested).toFixed(2));
        const dates = items.map((h) => h.purchaseDate).sort();
        return {
            name,
            from: dates[0],
            to: dates[dates.length - 1],
            entryCount: items.length,
            quantity,
            invested,
            avgPrice: quantity > 0 ? parseFloat((invested / quantity).toFixed(2)) : 0,
            currentValue,
            gain,
            gainPercent: invested > 0 ? parseFloat(((gain / invested) * 100).toFixed(2)) : 0,
        };
    }).sort((a, b) => a.from.localeCompare(b.from));

    return { holdings, totals, sets };
}

module.exports = { computeMetalHoldings };
