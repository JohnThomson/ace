'use strict';

const fs = require('fs');
const meow = require('meow');
const path = require('path');
const winston = require('winston');

const logger = require('@daisy/ace-logger');
const ace = require('@daisy/ace-core');

const { config, paths } = require('@daisy/ace-config');
const defaults = require('./defaults');
const cliConfig  = config.get('cli', defaults.cli);

const pkg = require('@daisy/ace-meta/package');

const meowHelpMessage = `
  Usage: ace [options] <input>

  Options:

    -h, --help             output usage information
    -v, --version          output the version number

    -o, --outdir  <path>   save final reports to the specified directory
    -t, --tempdir <path>   specify a custom directory to store the temporary reports
    -f, --force            override any existing output file or directory
        --subdir           output reports to a sub-directory named after the input EPUB

    -V, --verbose          display verbose output
    -s, --silent           do not display any output

    -l, --lang  <language> language code for localized messages (e.g. "fr"), default is "en"
  Examples
    $ ace -o out ~/Documents/book.epub`;
const meowOptions = {
  autoHelp: false,
  autoVersion: false,
  version: pkg.version,
  flags: {
    force: {
      alias: 'f',
      type: 'boolean'
    },
    help: {
      alias: 'h'
    },
    outdir: {
      alias: 'o',
      type: 'string'
    },
    silent: {
      alias: 's',
      type: 'boolean'
    },
    tempdir: {
      alias: 't',
      type: 'string'
    },
    subdir: {
      type: 'boolean'
    },
    version: {
      alias: 'v'
    },
    verbose: {
      alias: 'V',
      type: 'boolean'
    },
    lang: {
      alias: 'l',
      type: 'string'
    }
  }
};
const cli = meow(meowHelpMessage, meowOptions);

async function run(axeRunner, exit) {

  if (cli.flags.help) {
    cli.showHelp(0);
    return;
  }

  if (cli.flags.version) {
    cli.showVersion(2);
    return;
  }

  let timeBegin = process.hrtime();
  function quit() {
    const timeElapsed = process.hrtime(timeBegin);
    const allowPerfReport = process.env.ACE_PERF; // !cli.flags.silent && cli.flags.verbose;
    if (allowPerfReport) console.log(`>>> ACE PERF: ${timeElapsed[0]} seconds + ${timeElapsed[1]} nanoseconds`);
    exit(...arguments);
  }

  logger.initLogger({ verbose: cli.flags.verbose, silent: cli.flags.silent });

  // Check that an EPUB path is specified
  if (cli.input.length === 0) {
    const res = await winston.logAndWaitFinish('error', 'Input required');
    console.log(cli.help);
    quit(1);
    return;
  }

  // Check that output directories can be overridden
  let outdir = cli.flags.outdir;
  if (outdir) {
    if (cli.flags.subdir) {
      outdir = path.join(outdir, path.parse(cli.input[0]).name);
    }
    if (!cli.flags.force) {
      const overrides = ['report.json', 'report.html', 'data', 'js']
        .map(file => path.join(outdir, file))
        .filter(fs.existsSync);
      if (overrides.length > 0) {
        const res = await winston.logAndWaitFinish('warn',
          `\
Output directory is not empty.

  Running Ace would override the following files or directories:

${overrides.map(file => `  - ${file}`).join('\n')}

  Use option --force to override.
`
        );
        quit(1);
        return;
      }
    }
  }

  // finally, invoke Ace
  ace(cli.input[0], {
    cwd: cli.flags.cwd || process.cwd(),
    outdir,
    tmpdir: cli.flags.tempdir,
    verbose: cli.flags.verbose,
    silent: cli.flags.silent,
    jobId: '',
    lang: cli.flags.lang,
  }, axeRunner)
  .then(async (jobData) => {
    var reportJson = jobData[1];
    // if there were violations from the validation process, return 2
    const fail = cliConfig['return-2-on-validation-error'] && reportJson['earl:result']['earl:outcome'] === 'fail';
    const res = await winston.logAndWaitFinish('info', 'Closing logs.');
    quit(fail ? 2 : 0);
  })
  .catch(async (err) => {
    if (err && err.message) {
      winston.error(err.message);
    }
    
    const res = await winston.logAndWaitFinish('info', 'Closing logs.');
    console.log('Re-run Ace using the --verbose option to enable full debug logging.');
    quit(1);
  });
}

module.exports = { run };
