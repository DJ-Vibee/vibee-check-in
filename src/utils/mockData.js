// Generate mock guests with realistic event dates spanning 10 weeks (Thu/Fri/Sat)
export const generateMockGuests = (count = 25) => {
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    const hotels = ['The Venetian', 'Palazzo', 'Virgin Hotels', 'Bellagio', 'Wynn', 'Encore', 'Caesars Palace', 'Aria', 'Cosmopolitan', 'MGM Grand'];
    const ticketTiers = ['Signature: General Admission', 'Signature: Reserved', 'Perfect Fan: GA', 'Perfect Fan: Reserved'];

    // Generate event dates across 10 weeks (Thu/Fri/Sat pattern)
    const generateEventDates = () => {
        const dates = [];
        const startDate = new Date('2025-12-26'); // Start from late Dec 2025

        for (let week = 0; week < 10; week++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + (week * 7));

            // Find Thursday, Friday, Saturday of this week
            const dayOfWeek = weekStart.getDay();
            const thursday = new Date(weekStart);
            thursday.setDate(thursday.getDate() + (4 - dayOfWeek + 7) % 7);

            const friday = new Date(thursday);
            friday.setDate(friday.getDate() + 1);

            const saturday = new Date(friday);
            saturday.setDate(saturday.getDate() + 1);

            dates.push(thursday, friday, saturday);
        }

        return dates.map(d => d.toLocaleDateString('en-US'));
    };

    const eventDates = generateEventDates();

    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randomBool = (pct = 0.5) => Math.random() < pct;

    return Array.from({ length: count }, (_, i) => {
        const eventDate = random(eventDates);
        const ticketType = randomBool(0.3) ? 'VIP' : 'Signature';
        const hasWellness = randomBool(0.25);
        const hasGondola = randomBool(0.2);
        const waiverSigned = randomBool(0.7);
        const idVerified = waiverSigned && randomBool(0.85);
        const checkedIn = idVerified && randomBool(0.7);

        return {
            id: `guest-${i + 1}`,
            orderNumber: `${110000 + i}`,
            status: checkedIn ? 'checked' : 'pending',
            event: 'BSB Into The Millennium',
            email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}@email.com`,
            billingFirst: random(firstNames),
            billingLast: random(lastNames),
            billingPhone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
            hotel: random(hotels),
            checkInDate: eventDate,
            ticketTierName: random(ticketTiers),
            quantity: Math.floor(Math.random() * 4) + 1,
            eventDate: eventDate,
            ticketType: ticketType,
            idChecked: idVerified,
            checked: checkedIn,
            laminatePickUp: checkedIn && randomBool(0.8),
            gondola: hasGondola && checkedIn && randomBool(0.5),
            wellnessPU: hasWellness && checkedIn && randomBool(0.5),
            wellness: hasWellness ? 'Wellness Package' : '',
            gondolaAddon: hasGondola ? 'Gondola Addon' : '',
            jotformWaiver: waiverSigned ? 'Signed' : ''
        };
    });
};

// Parse imported data from Google Sheet / Excel format
export const parseImportedData = (rows) => {
    return rows.map((row, i) => ({
        id: `imported-${Date.now()}-${i}`,
        orderNumber: row['Order #'] || row.orderNumber || `IMP${i}`,
        status: row['Checked'] ? 'checked' : 'pending',
        event: row['Event'] || 'BSB Into The Millennium',
        email: row['Email'] || '',
        billingFirst: row['Billing First'] || row.billingFirst || '',
        billingLast: row['Billing Last'] || row.billingLast || '',
        billingPhone: row['Billing Phone'] || '',
        hotel: row['Hotel'] || '',
        checkInDate: row['Check In Date'] || '',
        ticketTierName: row['Ticket Tier #1 Name'] || '',
        quantity: parseInt(row['Ticket Tier #1 Quantity']) || 1,
        eventDate: row['Event Date'] || '',
        ticketType: row['Ticket Type'] || 'Signature',
        idChecked: !!row['ID Checked'],
        checked: !!row['Checked'],
        laminatePickUp: !!row['Laminate Pick Up'],
        gondola: !!row['Gondola'],
        wellnessPU: !!row['Wellness PU'],
        wellness: row['Wellness'] || '',
        gondolaAddon: row['Gondola Addon'] || '',
        jotformWaiver: row['Jotform Waiver'] || ''
    }));
};
