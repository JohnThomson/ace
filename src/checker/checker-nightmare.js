'use strict';

const fs = require('fs');
const path = require('path');
const Nightmare = require('nightmare');
const report = require('../report/report.js');
const axe2ace = require('../report/axe2ace.js');
const winston = require('winston');

const PATH_TO_AXE = path.join(path.dirname(require.resolve('axe-core')), 'axe.min.js');
if (!fs.existsSync(PATH_TO_AXE)) {
  winston.verbose(PATH_TO_AXE);
  process.exit(1);
}

const PATH_TO_H5O = path.join(path.dirname(require.resolve('h5o')), 'dist/outliner.min.js');
if (!fs.existsSync(PATH_TO_H5O)) {
  winston.verbose(PATH_TO_H5O);
  process.exit(1);
}

const PATH_TO_ACE_AXE = path.join(__dirname, '../scripts/ace-axe.js');
if (!fs.existsSync(PATH_TO_ACE_AXE)) {
  winston.verbose(PATH_TO_ACE_AXE);
  process.exit(1);
}

const PATH_TO_ACE_EXTRACTION = path.join(__dirname, '../scripts/ace-extraction.js');
if (!fs.existsSync(PATH_TO_ACE_EXTRACTION)) {
  winston.verbose(PATH_TO_ACE_EXTRACTION);
  process.exit(1);
}
// EMXIF

Nightmare.action('axe', function axe(done) {
  // Node JS runtime
  this.evaluate_now(
    (callback) => {
      // Browser JS runtime
      /* eslint-disable */
      window.daisy.ace.run(callback);
      /* eslint-enable */
    }, done);
});

const nightmare = Nightmare({
  show: false,
  alwaysOnTop: false,
  openDevTools: {
    mode: 'detach',
  },
});

function checkSingle(spineItem) {
  winston.info(`- ${spineItem.relpath}`);

  return nightmare
    .goto(spineItem.url)
    .inject('js', PATH_TO_AXE)
    .inject('js', PATH_TO_H5O)
    .inject('js', PATH_TO_ACE_AXE)
    .inject('js', PATH_TO_ACE_EXTRACTION)
    .wait(50)
    .axe()
    .then((json) => {
      const results = json;
      results.assertions = (json.axe != null) ? axe2ace.axe2ace(spineItem, json.axe) : [];
      delete results.axe;
      var numIssues = 0;
      if (results.assertions != null) {
        numIssues = results.assertions.assertions.length;
        report.addContentDocAssertion(results.assertions);
      }
      winston.info(`- ${numIssues} issues found`);
      if (results.data != null && results.data.images != null) {
        results.data.images.forEach((img) => {
          img.filepath = path.resolve(path.dirname(spineItem.filepath), img.path);
          img.location = `${spineItem.relpath}#epubcfi(${img.cfi})`;
        });
      }
      return results;
    });
}

module.exports.check = spineItems =>
  spineItems.reduce((sequence, spineItem) =>
    sequence.then(results =>
      checkSingle(spineItem)
      .then((result) => {
        results.push(result);
        return results;
      })), Promise.resolve([]))
  .then(results => nightmare.end(() => results));
