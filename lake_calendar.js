(() => {
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

    function getTypeInfo(type) {
        return eventTypes[type] || eventTypes.general;
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
            .sort((a, b) => {
                const dateDifference =
                    parseLocalDate(a.date) - parseLocalDate(b.date);

                if (dateDifference !== 0) return dateDifference;

                return (a.time || '').localeCompare(b.time || '');
            });
    }

    function formatEventDate(event) {
        const eventDate = parseLocalDate(event.date);

        const dateText = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        if (!event.time) return dateText;

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
        popupClose.focus();
    }

    function closeEventPopup() {
        popup.style.display = 'none';
        popup.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('event-popup-open');
    }

    function createEventButton(event, className) {
        const typeInfo = getTypeInfo(event.type);
        const button = document.createElement('button');

        button.type = 'button';
        button.className = className;
        button.dataset.eventType = event.type || 'general';
        button.title = event.title;

        button.innerHTML = `
            <span class="lake-event-icon" aria-hidden="true">${typeInfo.icon}</span>
            <span class="lake-event-button-title">${event.title}</span>
        `;

        button.addEventListener('click', () => openEventPopup(event));

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

        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

        for (let blank = 0; blank < firstDayOfMonth; blank += 1) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'lake-calendar-day lake-calendar-day-empty';
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

            const visibleEvents = eventsForDay.slice(0, 2);

            visibleEvents.forEach(event => {
                dayCell.appendChild(
                    createEventButton(event, 'lake-calendar-event')
                );
            });

            if (eventsForDay.length > 2) {
                const moreButton = document.createElement('button');
                moreButton.type = 'button';
                moreButton.className = 'lake-calendar-more';
                moreButton.textContent = `+${eventsForDay.length - 2} more`;

                moreButton.addEventListener('click', () => {
                    const firstHiddenEvent = eventsForDay[2];
                    openEventPopup(firstHiddenEvent);
                });

                dayCell.appendChild(moreButton);
            }

            calendarGrid.appendChild(dayCell);
        }

        renderEventList(monthEvents);
    }

    function renderEventList(monthEvents) {
        eventList.innerHTML = '';

        if (!monthEvents.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'lake-event-list-empty';
            emptyMessage.textContent = 'No events are currently listed for this month.';
            eventList.appendChild(emptyMessage);
            return;
        }

        monthEvents.forEach(event => {
            const eventDate = parseLocalDate(event.date);
            const typeInfo = getTypeInfo(event.type);

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'lake-event-list-item';
            item.dataset.eventType = event.type || 'general';

            item.innerHTML = `
                <span class="lake-event-list-date">
                    <span class="lake-event-list-month">
                        ${eventDate.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span class="lake-event-list-day">${eventDate.getDate()}</span>
                </span>

                <span class="lake-event-list-details">
                    <span class="lake-event-list-title">
                        <span aria-hidden="true">${typeInfo.icon}</span>
                        ${event.title}
                    </span>

                    <span class="lake-event-list-meta">
                        ${event.time || 'All day'}
                        ${event.location ? ` • ${event.location}` : ''}
                    </span>
                </span>
            `;

            item.addEventListener('click', () => openEventPopup(event));
            eventList.appendChild(item);
        });
    }

    async function loadEvents() {
        try {
            const response = await fetch('lake_events.json', {
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`Event file returned ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error('lake_events.json must contain an array');
            }

            events = data.filter(event => event.title && event.date);
            renderCalendar();
        } catch (error) {
            console.error('Unable to load lake events:', error);

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

    popupClose?.addEventListener('click', closeEventPopup);

    popup?.addEventListener('click', event => {
        if (event.target === popup) {
            closeEventPopup();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && popup?.style.display === 'flex') {
            closeEventPopup();
        }
    });

    loadEvents();
})();
