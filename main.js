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

const init = async () => {
    await initSchedule();
    await initSlotting();
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

const addEvent = (name, slot) => {
    for (const sameTimeSchedule of slottingJSON[slot]) {
        events.push({
            start: momentToArray(sameTimeSchedule[1][0]),
            end: momentToArray(sameTimeSchedule[1][1]),
            productId: PROD_ID,
            title: name,
            recurrenceRule: getRRule(sameTimeSchedule[0], sameTimeSchedule[1][0], scheduleJSON)
        });
    }
}

const getCourseSlotInput = () => {
    const row = document.createElement("div");
    row.className = "row";

    const courseNameDiv = document.createElement("div");
    courseNameDiv.classList.add("form-group", "col-sm");
    const courseNameInput = document.createElement("input");
    courseNameInput.type = "text";
    courseNameInput.classList.add("form-control", "course-name");
    courseNameInput.placeholder = "Course name";
    courseNameInput.required = true;
    courseNameDiv.appendChild(courseNameInput);
    row.appendChild(courseNameDiv);

    const courseSlotDiv = document.createElement("div");
    courseSlotDiv.classList.add("form-group", "col-sm");
    const courseSlotInput = document.createElement("input");
    courseSlotInput.type = "text";
    courseSlotInput.classList.add("form-control", "slot");
    courseSlotInput.placeholder = "Slot name";
    courseSlotInput.required = true;
    courseSlotInput.pattern = "A|B|C|D|E|F|H|J|K|L|M|AA|AB|AC|AD";
    courseSlotDiv.appendChild(courseSlotInput);

    row.appendChild(courseSlotDiv);

    return row;
}

const addNumCoursesCallback = () => {
    const numCoursesInput = document.getElementById("num-courses");
    const inputDiv = document.getElementById("course-slots")
    const callback = (event) => {
        const numCourses = numCoursesInput.value;
        const currRows = inputDiv.children.length;
        if (numCourses == currRows) return;
        if (numCourses > currRows) {
            for (let i = 0; i < numCourses - currRows; i++) {
                inputDiv.appendChild(getCourseSlotInput());
            }
        } else {
            while (inputDiv.children.length > numCourses) {
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
    const courseNames = document.querySelectorAll("#course-slots .course-name");
    const slots = document.querySelectorAll("#course-slots .slot");
    event.preventDefault();
    for (let i = 0; i < courseNames.length; i++) {
        addEvent(courseNames[i].value, slots[i].value);
    }
    const { err, value } = ics.createEvents(events);
    events = [];
    if (err) {
        console.error(err);
        alert("Error occured in generation of ics file. See console for details");
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