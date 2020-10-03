const { jsonc } = require('jsonc');
const moment = require('moment');
const ics = require("ics");
const rrule = require("./public/rrule.min.js");
const RRule = rrule.RRule;
const RRuleSet = rrule.RRuleSet;

const DATA_FOLDER = "sem-data/";
const SCHEDULE_FILE = DATA_FOLDER + "ScheduleSem1_2020-21.jsonc"
const SLOTTING_FILE = DATA_FOLDER + "SlottingPattern.jsonc"

const DATE_FORMAT = "DD/MM/YYYY";
const TIME_FORMAT = "hh:mmA"
const TIMEZONE = "Asia/Calcutta";

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
    scheduleJSON.endingDate = moment.utc(scheduleJSON.endingDate, DATE_FORMAT).add(1, 'days');
    // ^Adding 1 day to make ending date exclusive

    setExcludedDates(scheduleJSON);

    for (const date of scheduleJSON.extraDays) {
        date[0] = moment.utc(date[0], DATE_FORMAT);
    }

    return scheduleJSON;
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
            sameTimeSchedule[1][1] = moment.utc(sameTimeSchedule[1][1], TIME_FORMAT);
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
    return arr;
}

events = [];

const addEvent = (name, slot, scheduleJSON, slottingJSON) => {
    for (const sameTimeSchedule of slottingJSON[slot]) {
        events.push({
            start: momentToArray(sameTimeSchedule[1][0]),
            end: momentToArray(sameTimeSchedule[1][1]),
            title: name,
            recurrenceRule: getRRule(sameTimeSchedule[0], sameTimeSchedule[1][0], scheduleJSON)
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const div = document.getElementById("data-out");

    const scheduleJSON = await initSchedule();
    const slottingJSON = await initSlotting();

    addEvent("K slot", "K", scheduleJSON, slottingJSON);

    const { err, value } = ics.createEvents(events);

    if (err) {
        console.log(err);
        return;
    }

    const cal = value.replace(/^RRULE:DTSTART;.*$/gm, '').replace(/\n/gm, '\n\r');
    console.log(cal);
});