// SIP months between two dates: the month of `endDate` counts once its 5th (the SIP day) has come
function getMonthsDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
    const includeCurrentMonth = end.getDate() >= 5;
    return Math.max(0, months + (includeCurrentMonth ? 1 : 0));
}

// 'YYYY-MM-DD' as local midnight (new Date('YYYY-MM-DD') would be UTC midnight)
function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// A date as YYYY-MM-DD in the server's own time zone
function isoDay(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { getMonthsDifference, parseLocalDate, isoDay };
