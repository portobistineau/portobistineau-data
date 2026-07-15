(() => {
    const UPCOMING_EVENT_COUNT = 4;

    const monthTitle = document.getElementById('calendar-month-title');
    const calendarGrid = document.getElementById('lake-calendar-grid');
    const eventList = document.getElementById('lake-event-list');
    const previousButton = document.getElementById('calendar-prev');
    const nextButton = document.getElementById('calendar-next');

    const popup = document.getElementById('event-popup');
    const popupClose = document.getElementById('event-popup-close');
    const popupTitle = document.getElementById('event-popup-title');
    const popupDate = document.getElementById('event-popup-date');
    const popupLocation = document.getElementById('event-popup-location');
    const popupDescription = document.getElementById('event-popup-description');

    if (
        !monthTitle ||
        !calendarGrid ||
        !eventList ||
        !previousButton ||
        !nextButton
    ) {
        return;
    }

    let events = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let displayedYear = today.getFullYear();
    let displayedMonth = today.getMonth();

    const eventTypes = {
        tournament: {
            label: 'Fishing Tournament',
            icon: '🎣'
        },
        drawdown: {
            label: 'Drawdown',
            icon: '💧'
        },
        'boat-parade': {
            label: 'Boat Parade',
            icon: '🚤'
        },
        closure: {
            label: 'Closure',
            icon: '🚧'
        },
        cleanup: {
            label: 'Lake Cleanup',
            icon: '🧹'
        },
        holiday: {
            label: 'Holiday Event',
            icon: '🎆'
        },
        meeting: {
            label: 'Meeting',
            icon: '📅'
        },
        general: {
            label: 'Lake Event',
            icon: '📌'
        }
    };

    function parseLocalDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function getEventKey(event) {
        return event.id || `${event.date}-${event.time || ''}-${event.title}`;
    }

    function getTypeInfo(type) {
        return eventTypes[type] || eventTypes.general;
    }

    function getNthWeekday(year, month, weekday, occurrence) {
        const firstDay = new Date(year, month, 1);
        const adjustment = (7 + weekday - firstDay.getDay()) % 7;

        return 1 + adjustment + ((occurrence - 1) * 7);
    }

    function getLastWeekday(year, month, weekday) {
        const lastDate = new Date(year, month + 1, 0);
        const adjustment = (7 + lastDate.getDay() - weekday) % 7;

        return lastDate.getDate() - adjustment;
    }

    function getEasterDate(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);

        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;

        return new Date(year, month - 1, day);
    }

    function getHoliday(year, month, day) {
        const fixedHolidays = {
            '0-1': "New Year's Day",
            '1-14': "Valentine's Day",
            '2-17': "St. Patrick's Day",
            '4-5': 'Cinco de Mayo',
            '5-19': 'Juneteenth',
            '6-4': 'Independence Day',
            '9-31': 'Halloween',
            '10-11': 'Veterans Day',
            '11-24': 'Christmas Eve',
            '11-25': 'Christmas Day',
            '11-26': 'Boxing Day',
            '11-31': "New Year's Eve"
        };

        const fixedHoliday = fixedHolidays[`${month}-${day}`];

        if (fixedHoliday) {
            return fixedHoliday;
        }

        if (
            month === 0 &&
            day === getNthWeekday(year, 0, 1, 3)
        ) {
            return 'Martin Luther King Jr. Day';
        }

        if (
            month === 1 &&
            day === getNthWeekday(year, 1, 1, 3)
        ) {
            return "Presidents' Day";
        }

        if (
            month === 4 &&
            day === getNthWeekday(year, 4, 0, 2)
        ) {
            return "Mother's Day";
        }

        if (
            month === 4 &&
            day === getLastWeekday(year, 4, 1)
        ) {
            return 'Memorial Day';
        }

        if (
            month === 5 &&
            day === getNthWeekday(year, 5, 0, 3)
        ) {
            return "Father's Day";
        }

        if (
            month === 8 &&
            day === getNthWeekday(year, 8, 1, 1)
        ) {
            return 'Labor Day';
        }

        if (
            month === 9 &&
            day === getNthWeekday(year, 9, 1, 2)
        ) {
            return 'Columbus Day';
        }

        if (
            month === 10 &&
            day === getNthWeekday(year, 10, 4, 4)
        ) {
            return 'Thanksgiving';
        }

        const easter = getEasterDate(year);

        if (
            month === easter.getMonth() &&
            day === easter.getDate()
        ) {
            return 'Easter';
        }

        return '';
    }

    function getMonthEvents() {
        return events
            .filter(event => {
                const eventDate = parseLocalDate(event.date);

                return (
                    eventDate.getFullYear() === displayedYear &&
                    eventDate.getMonth() === displayedMonth
                );
            })
            .sort(sortEvents);
    }

    function sortEvents(a, b) {
        const dateDifference =
            parseLocalDate(a.date) - parseLocalDate(b.date);

        if (dateDifference !== 0) {
            return dateDifference;
        }

        return (a.time || '').localeCompare(b.time || '');
    }

    function getFutureEvents() {
        return events
            .filter(event => parseLocalDate(event.date) >= today)
            .sort(sortEvents);
    }

    function getUpcomingEvents() {
        const futureEvents = getFutureEvents();
        const normalUpcoming = futureEvents.slice(0, UPCOMING_EVENT_COUNT);

        const displayedMonthEvents = futureEvents.filter(event => {
            const eventDate = parseLocalDate(event.date);

            return (
                eventDate.getFullYear() === displayedYear &&
                eventDate.getMonth() === displayedMonth
            );
        });

        if (!displayedMonthEvents.length) {
            return normalUpcoming;
        }

        const normalUpcomingKeys = new Set(
            normalUpcoming.map(getEventKey)
        );

        const displayedMonthHasHiddenEvents =
            displayedMonthEvents.some(
                event => !normalUpcomingKeys.has(getEventKey(event))
            );

        if (!displayedMonthHasHiddenEvents) {
            return normalUpcoming;
        }

        const firstDisplayedMonthEvent = displayedMonthEvents[0];

        const startingIndex = futureEvents.findIndex(
            event =>
                getEventKey(event) ===
                getEventKey(firstDisplayedMonthEvent)
        );

        if (startingIndex < 0) {
            return normalUpcoming;
        }

        return futureEvents.slice(
            startingIndex,
            startingIndex + UPCOMING_EVENT_COUNT
        );
    }

    function formatEventDate(event) {
        const eventDate = parseLocalDate(event.date);

        const dateText = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        if (!event.time) {
            return dateText;
        }

        if (event.endTime) {
            return `${dateText} • ${event.time}–${event.endTime}`;
        }

        return `${dateText} • ${event.time}`;
    }

    function openEventPopup(event) {
        const typeInfo = getTypeInfo(event.type);

        popupTitle.textContent = `${typeInfo.icon} ${event.title}`;
        popupDate.textContent = formatEventDate(event);

        if (event.location) {
            popupLocation.textContent = `Location: ${event.location}`;
            popupLocation.style.display = 'block';
        } else {
            popupLocation.textContent = '';
            popupLocation.style.display = 'none';
        }

        popupDescription.textContent =
            event.description || 'No additional details are available.';

        popup.style.display = 'flex';
        popup.setAttribute('aria-hidden', 'false');
        document.body.classList.add('event-popup-open');

        popupClose?.focus();
    }

    function closeEventPopup() {
        popup.style.display = 'none';
        popup.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('event-popup-open');
    }

    function createCalendarEventButton(event) {
        const typeInfo = getTypeInfo(event.type);
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'lake-calendar-event';
        button.dataset.eventType = event.type || 'general';
        button.title = event.title;

        button.innerHTML = `
            <span class="lake-event-icon" aria-hidden="true">
                ${typeInfo.icon}
            </span>

            <span class="lake-event-button-title">
                ${event.title}
            </span>
        `;

        button.addEventListener(
            'click',
            () => openEventPopup(event)
        );

        return button;
    }

    function renderCalendar() {
        const monthEvents = getMonthEvents();

        monthTitle.textContent = new Date(
            displayedYear,
            displayedMonth,
            1
        ).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        calendarGrid.innerHTML = '';

        const weekdays = [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat'
        ];

        weekdays.forEach(dayName => {
            const heading = document.createElement('div');
            heading.className = 'lake-calendar-weekday';
            heading.textContent = dayName;
            calendarGrid.appendChild(heading);
        });

        const firstDayOfMonth = new Date(
            displayedYear,
            displayedMonth,
            1
        ).getDay();

        const daysInMonth = new Date(
            displayedYear,
            displayedMonth + 1,
            0
        ).getDate();

        for (
            let blank = 0;
            blank < firstDayOfMonth;
            blank += 1
        ) {
            const emptyCell = document.createElement('div');

            emptyCell.className =
                'lake-calendar-day lake-calendar-day-empty';

            emptyCell.setAttribute('aria-hidden', 'true');
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const dayCell = document.createElement('div');
            dayCell.className = 'lake-calendar-day';

            const isToday =
                day === today.getDate() &&
                displayedMonth === today.getMonth() &&
                displayedYear === today.getFullYear();

            if (isToday) {
                dayCell.classList.add('lake-calendar-today');
            }

            const dayNumber = document.createElement('div');
            dayNumber.className = 'lake-calendar-day-number';
            dayNumber.textContent = day;
            dayCell.appendChild(dayNumber);

            const eventsForDay = monthEvents.filter(event => {
                return parseLocalDate(event.date).getDate() === day;
            });

            eventsForDay.forEach(event => {
                dayCell.appendChild(
                    createCalendarEventButton(event)
                );
            });

            const holidayName = getHoliday(
                displayedYear,
                displayedMonth,
                day
            );

            if (holidayName) {
                const holiday = document.createElement('div');
                holiday.className = 'lake-calendar-holiday';
                holiday.textContent = holidayName;
                dayCell.appendChild(holiday);
            }

            calendarGrid.appendChild(dayCell);
        }

        renderEventList(getUpcomingEvents());
    }

    function renderEventList(upcomingEvents) {
        eventList.innerHTML = '';

        if (!upcomingEvents.length) {
            const emptyMessage = document.createElement('p');

            emptyMessage.className = 'lake-event-list-empty';
            emptyMessage.textContent =
                'No upcoming events are currently listed.';

            eventList.appendChild(emptyMessage);
            return;
        }

        upcomingEvents.forEach(event => {
            const eventDate = parseLocalDate(event.date);
            const typeInfo = getTypeInfo(event.type);

            const item = document.createElement('button');

            item.type = 'button';
            item.className = 'lake-event-list-item';
            item.dataset.eventType = event.type || 'general';

            item.innerHTML = `
                <span class="lake-event-list-date">
                    <span class="lake-event-list-month">
                        ${eventDate.toLocaleDateString(
                            'en-US',
                            { month: 'short' }
                        )}
                    </span>

                    <span class="lake-event-list-day">
                        ${eventDate.getDate()}
                    </span>
                </span>

                <span class="lake-event-list-details">
                    <span class="lake-event-list-title">
                        <span aria-hidden="true">
                            ${typeInfo.icon}
                        </span>

                        ${event.title}
                    </span>

                    <span class="lake-event-list-meta">
                        ${event.time || 'All day'}
                        ${event.location
                            ? ` • ${event.location}`
                            : ''}
                    </span>
                </span>
            `;

            item.addEventListener(
                'click',
                () => openEventPopup(event)
            );

            eventList.appendChild(item);
        });
    }

    async function loadEvents() {
        try {
            const response = await fetch(
                'lake_events.json',
                { cache: 'no-store' }
            );

            if (!response.ok) {
                throw new Error(
                    `Event file returned ${response.status}`
                );
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error(
                    'lake_events.json must contain an array'
                );
            }

            events = data
                .filter(event => event.title && event.date)
                .sort(sortEvents);

            renderCalendar();

        } catch (error) {
            console.error(
                'Unable to load lake events:',
                error
            );

            calendarGrid.innerHTML =
                '<p class="lake-calendar-error">Unable to load the calendar.</p>';

            eventList.innerHTML =
                '<p class="lake-calendar-error">Unable to load the event list.</p>';
        }
    }

    previousButton.addEventListener('click', () => {
        displayedMonth -= 1;

        if (displayedMonth < 0) {
            displayedMonth = 11;
            displayedYear -= 1;
        }

        renderCalendar();
    });

    nextButton.addEventListener('click', () => {
        displayedMonth += 1;

        if (displayedMonth > 11) {
            displayedMonth = 0;
            displayedYear += 1;
        }

        renderCalendar();
    });

    popupClose?.addEventListener(
        'click',
        closeEventPopup
    );

    popup?.addEventListener('click', event => {
        if (event.target === popup) {
            closeEventPopup();
        }
    });

    document.addEventListener('keydown', event => {
        if (
            event.key === 'Escape' &&
            popup?.style.display === 'flex'
        ) {
            closeEventPopup();
        }
    });

    loadEvents();
})();
