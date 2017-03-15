'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
var NumericLogLevel;
(function (NumericLogLevel) {
    NumericLogLevel[NumericLogLevel["Debug"] = 0] = "Debug";
    NumericLogLevel[NumericLogLevel["Info"] = 1] = "Info";
    NumericLogLevel[NumericLogLevel["Warn"] = 2] = "Warn";
    NumericLogLevel[NumericLogLevel["Error"] = 3] = "Error";
})(NumericLogLevel || (NumericLogLevel = {}));
function toNumericLogLevel(logLevel) {
    // tslint:disable-next-line:switch-default
    switch (logLevel) {
        case 'Debug':
            return NumericLogLevel.Debug;
        case 'Info':
            return NumericLogLevel.Info;
        case 'Warn':
            return NumericLogLevel.Warn;
        case 'Error':
            return NumericLogLevel.Error;
    }
}
class Logger {
    constructor(name) {
        this.name = name;
        this.configure();
        Logger.loggers.set(name, this);
    }
    static create(name) {
        return new Logger(name);
    }
    debug(msg) { this.log(NumericLogLevel.Debug, 'DEBUG', msg); }
    info(msg) { this.log(NumericLogLevel.Info, 'INFO', msg); }
    warn(msg) { this.log(NumericLogLevel.Warn, 'WARN', msg); }
    error(msg) { this.log(NumericLogLevel.Error, 'ERROR', msg); }
    static set config(newConfig) {
        if (Logger.fd !== undefined) {
            fs.closeSync(Logger.fd);
            Logger.fd = undefined;
        }
        Logger._config = newConfig;
        if (Logger._config.fileName) {
            try {
                Logger.fd = fs.openSync(Logger._config.fileName, 'w');
            }
            catch (err) {
                // Swallow
            }
        }
        Logger.loggers.forEach(logger => logger.configure());
    }
    log(level, displayLevel, msg) {
        if (level < this.logLevel) {
            return;
        }
        const elapsedTime = (Date.now() - Logger.startTime) / 1000;
        let elapsedTimeString = elapsedTime.toFixed(3);
        while (elapsedTimeString.length < 9) {
            elapsedTimeString = '0' + elapsedTimeString;
        }
        while (displayLevel.length < 5) {
            displayLevel = displayLevel + ' ';
        }
        const logLine = displayLevel + '|' + elapsedTimeString + '|' + this.name + ': ' + msg;
        if ((Logger.fd !== undefined)) {
            fs.write(Logger.fd, logLine + '\n');
        }
    }
    configure() {
        if (Logger._config.fileName && Logger._config.logLevel) {
            try {
                this.logLevel = toNumericLogLevel(Logger._config.logLevel[this.name]);
            }
            catch (err) {
                this.logLevel = toNumericLogLevel(Logger._config.logLevel['default']);
                throw err;
            }
        }
        else {
            this.logLevel = NumericLogLevel.Debug;
        }
    }
}
Logger.loggers = new Map();
Logger._config = {};
Logger.startTime = Date.now();
exports.Logger = Logger;
//# sourceMappingURL=log.js.map