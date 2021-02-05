const { jsonc } = require('jsonc');
const moment = require('moment');
const ics = require("ics");
const rrule = require("./docs/rrule.min.js");
const RRule = rrule.RRule;
const RRuleSet = rrule.RRuleSet;
const FileSaver = require("file-saver");

const DATA_FOLDER = "sem-data/";
const SCHEDULE_FILE = DATA_FOLDER + "ScheduleSem2_2020-21.jsonc"
const SLOTTING_FILE = DATA_FOLDER + "SlottingPattern.jsonc"

const DATE_FORMAT = "DD/MM/YYYY";
const TIME_FORMAT = "hh:mmA"
const TIMEZONE = "Asia/Calcutta";
const PROD_ID = "arpit-saxena/schedule-maker"

let scheduleJSON, slottingJSON;

const setExcludedDates =  (scheduleJSON) => {
    let excludedDates = [];
    for (const interval of scheduleJSON.excludedDates) {
        if (interval.length == 1) {
            excludedDates.push(moment.utc(interval[0], DATE_FORMAT));
        } else { // interval.length == 2
            const date1 = moment.utc(interval[0], DATE_FORMAT);
            const date2 = moment.utc(interval[1], DATE_FORMAT);

            for (let date = date1; date.diff(date2, 'days') <= 0; date.add(1, 'days')) {
                excludedDates.push(date.clone());
            }
        }
    }
    scheduleJSON.excludedDates = excludedDates;
};

const initSchedule = async () => {
    const scheduleJSON = await getJSONC(SCHEDULE_FILE);
    scheduleJSON.startingDate = moment.utc(scheduleJSON.startingDate, DATE_FORMAT);
    scheduleJSON.endingDate = moment.utc(scheduleJSON.endingDate, DATE_FORMAT);

    setExcludedDates(scheduleJSON);

    for (const date of scheduleJSON.extraDays) {
        date[0] = moment.utc(date[0], DATE_FORMAT);
    }

    return scheduleJSON;
}

// Copies date, month, year from date2 to date1
const setDate = (date1, date2) => {
    date1.date(date2.date());
    date1.month(date2.month());
    date1.year(date2.year());
}

const initSlotting = async () => {
    const slottingJSON = await getJSONC(SLOTTING_FILE);
    for (const slot in slottingJSON) {
        const schedule = slottingJSON[slot];
        for (const sameTimeSchedule of schedule) {
            for (let i = 0; i < sameTimeSchedule[0].length; i++) {
                sameTimeSchedule[0][i] = getDayEnum(sameTimeSchedule[0][i]);
            }
            sameTimeSchedule[1][0] = moment.utc(sameTimeSchedule[1][0], TIME_FORMAT);
            setDate(sameTimeSchedule[1][0], scheduleJSON.startingDate);
            sameTimeSchedule[1][1] = moment.utc(sameTimeSchedule[1][1], TIME_FORMAT);
            setDate(sameTimeSchedule[1][1], scheduleJSON.startingDate);
        }
    }
    
    return slottingJSON;
}

const getDayEnum = (day) => {
    return RRule[day.toUpperCase()];
}

const getRRule = (days, startingTime, scheduleJSON) => {
    const rruleSet = new RRuleSet();

    rruleSet.rrule(new RRule({
        freq: RRule.WEEKLY,
        dtstart: scheduleJSON.startingDate.toDate(),
        until: scheduleJSON.endingDate.toDate(),
        byweekday: days,
        tzid: TIMEZONE,
    }));

    for (const date of scheduleJSON.excludedDates) {
        const dateTime = date.clone();
        dateTime.hour(startingTime.hour());
        dateTime.minute(startingTime.minute());
        rruleSet.exdate(dateTime.toDate());
    }

    for (const date of scheduleJSON.extraDays) {
        if (days.indexOf(getDayEnum(date[1])) != -1) {
            const dateTime = date[0].clone();
            dateTime.hour(startingTime.hour());
            dateTime.minute(startingTime.minute());
            rruleSet.rdate(dateTime.utc().toDate());
        }
    }

    return rruleSet.toString();
}

const getJSONC = async (fileURL) => {
    const response = await fetch(fileURL);
    const text = await response.text();
    return jsonc.parse(text);
};

const momentToArray = (mom) => {
    let arr = mom.toArray().slice(0, 5);
    arr[1] += 1; // convert month to 1-based index
    return arr;
}

events = [];

const addCustomEvent = (name, days, startMoment, endMoment) => {
    events.push({
        start: momentToArray(startMoment),
        end: momentToArray(endMoment),
        productId: PROD_ID,
        title: name,
        recurrenceRule: getRRule(days, startMoment, scheduleJSON)
    });
}

const addSlotEvent = (name, slot) => {
    for (const sameTimeSchedule of slottingJSON[slot]) {
        addCustomEvent(
            name,
            sameTimeSchedule[0], 
            sameTimeSchedule[1][0], 
            sameTimeSchedule[1][1],
        );
    }
}

const getWeekdaySelectRow = (idx) => {
    const row = document.createElement("div");
    row.classList.add("row", "p-2", "weekdays");

    const span = document.createElement("span");
    span.textContent = "Repeat days:";
    span.classList.add("col-sm");
    row.appendChild(span);

    let shortNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

    for (let i = 0; i < 7; i++) {
        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = shortNames[i] + "-checkbox-" + idx;
        checkbox.classList.add("btn-check");
        row.appendChild(checkbox);

        let label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.classList.add("btn", "btn-outline-primary", "col", "m-1");
        label.innerText = shortNames[i];
        row.appendChild(label);
    }

    return row;
}

const getTimeInput = (className, idx, labelText) => {
    const div = document.createElement("div");
    div.classList.add("form-group", "col-sm");
    const input = document.createElement("input");
    input.type = "time";
    input.classList.add("form-control", className);
    input.id = className + "-" + idx;
    div.appendChild(input);
    const startTimeLabel = document.createElement("label");
    startTimeLabel.htmlFor = input.id;
    startTimeLabel.textContent = labelText;
    div.appendChild(startTimeLabel);
    return [input, div];
}

const getCourseSlotInput = (idx) => {
    const div = document.createElement("div");
    div.classList.add("course-input");

    const row1 = document.createElement("div");
    row1.classList.add("row", "g-3", "m-1");
    div.appendChild(row1);

    const customSlotDiv = document.createElement("div");
    customSlotDiv.classList.add("form-check", "form-switch", "col-sm-auto", "align-middle");
    const customSlotCheckbox = document.createElement("input");
    customSlotCheckbox.type = "checkbox";
    customSlotCheckbox.id = "slot-checkbox-" + idx;
    customSlotCheckbox.classList.add("form-check-input", "custom-slot-checkbox");
    customSlotDiv.appendChild(customSlotCheckbox);
    const customSlotLabel = document.createElement("label");
    customSlotLabel.htmlFor = customSlotCheckbox.id;
    customSlotLabel.classList.add("form-check-label");
    customSlotLabel.innerText = "Custom Slot";
    customSlotDiv.appendChild(customSlotLabel);
    row1.appendChild(customSlotDiv);

    const courseNameDiv = document.createElement("div");
    courseNameDiv.classList.add("form-group", "col-sm");
    const courseNameInput = document.createElement("input");
    courseNameInput.type = "text";
    courseNameInput.classList.add("form-control", "course-name");
    courseNameInput.placeholder = "Course name";
    courseNameInput.required = true;
    courseNameDiv.appendChild(courseNameInput);
    row1.appendChild(courseNameDiv);

    const courseSlotDiv = document.createElement("div");
    courseSlotDiv.classList.add("form-group", "col-sm");
    const courseSlotInput = document.createElement("input");
    courseSlotInput.type = "text";
    courseSlotInput.classList.add("form-control", "slot");
    courseSlotInput.placeholder = "Slot name";
    courseSlotInput.required = true;
    courseSlotInput.pattern = "A|B|C|D|E|F|H|J|K|L|M|AA|AB|AC|AD";
    courseSlotDiv.appendChild(courseSlotInput);
    row1.appendChild(courseSlotDiv);

    const [customStartTimeInput, customStartTimeDiv] = getTimeInput("start-time", idx, "Start Time");
    const [customEndTimeInput, customEndTimeDiv] = getTimeInput("end-time", idx, "End Time");
    
    const row2 = getWeekdaySelectRow(idx);

    const customSlotCheckboxListener = (_) => {
        if (customSlotCheckbox.checked) {
            row1.removeChild(courseSlotDiv);
            row1.appendChild(customStartTimeDiv);
            row1.appendChild(customEndTimeDiv);
            div.appendChild(row2);
            courseSlotInput.required = false;
            customStartTimeInput.required = true;
            customEndTimeInput.required = true;
        } else {
            row1.removeChild(customStartTimeDiv);
            row1.removeChild(customEndTimeDiv);
            div.removeChild(row2);
            row1.appendChild(courseSlotDiv);
            courseSlotInput.required = true;
            customStartTimeInput.required = false;
            customEndTimeInput.required = false;
        }
    }
    customSlotCheckbox.addEventListener("change", customSlotCheckboxListener);

    return div;
}

const addNumCoursesCallback = () => {
    const numCoursesInput = document.getElementById("num-courses");
    const inputDiv = document.getElementById("course-slots")
    let deletedElements = [];
    const callback = (event) => {
        const numCourses = numCoursesInput.value;
        const currRows = inputDiv.children.length;
        if (numCourses == currRows) return;
        if (numCourses > currRows) {
            for (let i = currRows; i < numCourses; i++) {
                if (deletedElements.length > 0) {
                    inputDiv.appendChild(deletedElements.pop());
                } else {
                    inputDiv.appendChild(getCourseSlotInput(i));
                }
            }
        } else {
            while (inputDiv.children.length > numCourses) {
                deletedElements.push(inputDiv.lastChild);
                inputDiv.lastChild.remove();
            }
        }
    };
    numCoursesInput.addEventListener("change", callback);
    numCoursesInput.addEventListener("keyup", callback);
    numCoursesInput.addEventListener("focusout", callback);
    callback();
}

const formCallback = (event) => {
    event.preventDefault();

    const coursesInput = document.querySelectorAll("#course-slots .course-input");;

    for (let i = 0; i < coursesInput.length; i++) {
        const courseName = coursesInput[i].querySelector(".course-name");
        const slot = coursesInput[i].querySelector(".slot");
        const customSlotCheckbox = coursesInput[i].querySelector(".custom-slot-checkbox");
        const startTime = coursesInput[i].querySelector(".start-time");
        const endTime = coursesInput[i].querySelector(".end-time");
        const weekDays = coursesInput[i].querySelector(".weekdays");

        if (customSlotCheckbox.checked) {
            let startMoment = moment.utc(startTime.value, "HH:mm");
            setDate(startMoment, scheduleJSON.startingDate);
            let endMoment = moment.utc(endTime.value, "HH:mm");
            setDate(endMoment, scheduleJSON.startingDate);
            
            let days = [];
            weekDays.querySelectorAll("input").forEach(input => {
                if (!input.checked) return;
                days.push(input.nextElementSibling.innerText);
            });
            days = days.map(getDayEnum);

            if (days.length == 0) {
                alert("Please select days for " + courseName.value);
                return;
            }

            addCustomEvent(courseName.value, days, startMoment, endMoment);
        } else {
            addSlotEvent(courseName.value, slot.value);
        }
    }
    const { err, value } = ics.createEvents(events);
    events = [];
    if (err) {
        console.error(err);
        alert("Error occurred in generation of ics file. See console for details");
    } else {
        const cal = value.replace(/^RRULE:DTSTART;.*$/gm, '').replace(/\n/gm, '\n\r');
        const blob = new Blob([cal], {type: "text/plain;charset=utf-8"});
        FileSaver.saveAs(blob, "schedule.ics");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    scheduleJSON = await initSchedule();
    slottingJSON = await initSlotting();

    addNumCoursesCallback();
    document.getElementById("slots-form").addEventListener("submit", formCallback);
});