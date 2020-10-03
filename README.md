# Schedule Generator

Generates an ICS file given a set of courses and their slots, which can be imported in any
calendar client.

## Background

Class schedule for a semester can be created by simply creating a recurring event in any
calendar of one's choice, but that doesn't contain Saturdays which are working, and also
doesn't exclude the days on which there is a holiday.

This is an attempt to do the work automatically, given a list of the holidays and extra
working days along with the slotting pattern

## Data Files

- `docs/sem-data/ScheduleSem1_2020-21.jsonc` - JSON file written from academic calendar
- `docs/sem-data/SlottingPattern.jsonc` - JSON file written from slotting pattern

While I have tried to ensure correctness, an error might have crept up or the original
sources might get updated at any time.
If you find any error in these files, please file an issue/create a PR, thank you.
One can also use this data for all sorts of applications.

## Contributing

Anyone is welcome to contribute, see open issues for things that require work.

## For local development

Firstly, install the npm packages by running `npm install`, then to run the website
in watch mode, do the following:

```sh
# Tab 1
cd docs
python -m http.server
# Tab 2
npm run watch
```
