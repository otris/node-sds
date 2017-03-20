/*
   I could not find any document describing the protocol but there is a fairly easy to read C++ library that you can
   use to "reverse-engineer" the protocol (You'll find it under `src/janus/2.9.6/srvclnt`) plus you can always analyze
   the TCP stream with Wireshark.

   Layout of a Typical Message

   The protocol seems to be modeled with RPC in mind. You have operations that are invoked with a single message that is
   send to the server along with a bunch of parameters. The response usually contains the return value of that
   operation.

    ╔═════ > Message Head
    ║ 0
    ║ 1  First 4-bytes are the length of the entire message in network byte order, including the length itself. It seems
    ║ 2  that it is possible to bit-wise OR some flags in here, but we do not do this.
    ║ 3
    ╠══
    ║ 0
    ║ 1
    ║ 2
    ║ 3  These 8 bytes are reserved for a 64-bit data structure called OID. An OID is a unique identifier (application
    ║ 4  wide, I guess) that identifies a single object. Rarely used here. Most of the times these are just 0-bytes.
    ║ 5
    ║ 6
    ║ 7
    ╠══
    ║ 0  The last byte of the message head encodes the operation used. See enum below.
    ╚══
    ╔══
    ║ 0  First byte of this block is the type of this parameter. See enum below.
    ╠══
    ║ 1  Second byte is the parameter name. See enum below.
    ╠══
    ║ 2
    ║ 3
    ║ 4  The remainder is the actual data of the parameter. This data block is of variable length, depending on the
    ║ 5  parameter type.
    ║ 6
    ║ 7
    ║ .
    ║ .
    ║ .
    ╚═════ > Message parameter

   Each message possibly consists of multiple parameters. There must be at least one, I think.

   There are also "simple" messages. Simple messages have no message parameters and consist solely of the message head,
   actually just the first four bytes of it (thus are 8-bytes in total). Simple messages are also not used here.

   Saying "Hello" in SDS

   Precondition: TCP connection established. A SDS connection is "established" after following sequence of messages got
   exchanged.

   1. We send a short "Hello"-like message.
   2. The server acknowledges this message with a short response, possibly negotiating SSL terms.
   3. We introduce ourselves by sending a short string containing our client's name.
   4. The server responds with a client ID that we store.

   After that it seems that we can do pretty much what we like.

   The "Hello"-like message consists of a 8-byte buffer whereas the first four bytes can be picked at random and the
   last four bytes are a crypt(3) with MD5 variation encrypted of the first 4 bytes. We don't bother and always send the
   same 8 bytes.

   The client ID can be used to track this connection in the server's log files later on. I presume this client ID is
   solely useful for logging and debugging purposes. A connection is closed simply by ending the TCP connection (by
   sending a FIN packet). The server usually notes this as a "client crashed" event in the log files. However, every
   existing client seems to do it this way. You can use the disconnect() method for this.

*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const events_1 = require("events");
const os = require("os");
const promised_timeout_1 = require("promised-timeout");
const cryptmd5 = require("./cryptmd5");
const log_1 = require("./log");
const network_1 = require("./network");
const HELLO = Buffer.from('GGCH$1$$', 'ascii');
const ACK = Buffer.from(term_utf8('valid'));
const INVALID = Buffer.from('invalid', 'ascii');
const INITIAL_BUFFER_SIZE = 4 * 1024;
const FIRST_PARAM_INDEX = 13;
const UTF8_BOM = "\xEF\xBB\xBF";
const JANUS_CRYPTMD5_SALT = 'o3';
/**
 * Return an array of all UTF-16 code units in given string plus a 0-terminus.
 *
 * Hint: returns the code point of every character of the string, not the bytes
 *
 * @param {string} str An arbitrary string
 * @returns An array containing all code units plus a final '0'.
 */
function term(str) {
    let units = str.split('').map(char => { return char.charCodeAt(0); });
    units.push(0);
    return units;
}
/**
 * Return a buffer (the bytes) of an utf-8 string plus a 0-terminus.
 *
 * @param {string} str An arbitrary string
 * @returns An array containing all code units plus a final '0'.
 */
function term_utf8(str) {
    let bytestrlen = Buffer.byteLength(str);
    let buffer = Buffer.alloc(bytestrlen + 1, str, 'utf-8');
    buffer[bytestrlen] = 0;
    return buffer;
}
// not used
function term_utf8bom(str) {
    return term_utf8(UTF8_BOM + str);
}
function getJanusPassword(val) {
    if (val.length > 0) {
        return cryptmd5.crypt_md5(val, JANUS_CRYPTMD5_SALT);
    }
    return '';
}
exports.getJanusPassword = getJanusPassword;
/**
 * Return a string where all bytes in given Buffer object are printed conveniently in hexadecimal notation. Only useful
 * when logging or debugging.
 *
 * @param {string} msg A string that is printed as prefix
 * @param {Buffer} buf The buffer to print
 * @returns A string with given buffer's contents in hexadecimal notation.
 */
function printBytes(msg, buf) {
    let str = `${buf.length}: [\n`;
    if (msg !== undefined) {
        str = `${msg} ` + str;
    }
    let column = 0;
    let i = 0;
    for (; i < buf.length; i++) {
        if (column === 8) {
            column = 0;
            str += `\n`;
        }
        column++;
        let hex = buf[i].toString(16);
        str += (hex.length === 1 ? '0x0' + hex : '0x' + hex) + ', ';
    }
    str += `\n]`;
    return str;
}
var Operation;
(function (Operation) {
    Operation[Operation["ChangeUser"] = 27] = "ChangeUser";
    Operation[Operation["DisconnectClient"] = 49] = "DisconnectClient";
    Operation[Operation["CallClassOperation"] = 101] = "CallClassOperation";
    Operation[Operation["COMOperation"] = 199] = "COMOperation";
    Operation[Operation["ChangePrincipal"] = 203] = "ChangePrincipal";
})(Operation = exports.Operation || (exports.Operation = {}));
var COMOperation;
(function (COMOperation) {
    COMOperation[COMOperation["ErrorMessage"] = 17] = "ErrorMessage";
    COMOperation[COMOperation["RunScriptOnServer"] = 42] = "RunScriptOnServer";
})(COMOperation = exports.COMOperation || (exports.COMOperation = {}));
var ParameterName;
(function (ParameterName) {
    ParameterName[ParameterName["ClientId"] = 1] = "ClientId";
    ParameterName[ParameterName["ClassAndOp"] = 2] = "ClassAndOp";
    ParameterName[ParameterName["Value"] = 4] = "Value";
    ParameterName[ParameterName["ReturnValue"] = 5] = "ReturnValue";
    ParameterName[ParameterName["Index"] = 13] = "Index";
    ParameterName[ParameterName["User"] = 21] = "User";
    ParameterName[ParameterName["Password"] = 22] = "Password";
    ParameterName[ParameterName["UserId"] = 40] = "UserId";
    ParameterName[ParameterName["Parameter"] = 48] = "Parameter";
    ParameterName[ParameterName["Principal"] = 80] = "Principal";
})(ParameterName = exports.ParameterName || (exports.ParameterName = {}));
var Type;
(function (Type) {
    Type[Type["Boolean"] = 2] = "Boolean";
    Type[Type["Int32"] = 3] = "Int32";
    Type[Type["Date"] = 4] = "Date";
    Type[Type["String"] = 7] = "String";
    Type[Type["OID"] = 9] = "OID";
    Type[Type["Int32List"] = 10] = "Int32List";
    Type[Type["StringList"] = 11] = "StringList";
    Type[Type["OIDList"] = 12] = "OIDList";
    Type[Type["NullFlag"] = 128] = "NullFlag";
})(Type = exports.Type || (exports.Type = {}));
class Message {
    /**
     * Create an arbitrary message from the given buffer.
     */
    static from(buf) {
        let msg = new Message();
        msg.buffer = buf;
        msg.bufferedLength = buf.length;
        return msg;
    }
    /**
     * Create a "Hello" message.
     *
     * This is the very first message send to the server.
     */
    static hello() {
        let msg = Message.from(HELLO);
        msg.pack = () => {
            return msg.buffer;
        };
        return msg;
    }
    /**
     * Create a "DisconnectClient" message.
     *
     * This message disconnects the client from the server in an orderly fashion.
     */
    static disconnectClient() {
        let msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.DisconnectClient]);
        return msg;
    }
    /**
     * Create a "ErrorMessage" message.
     *
     * This message returns a human-readable string (probably in German) for a given error code.
     * @param {number} errorCode The error code from a previous SDS call.
     */
    static errorMessage(errorCode) {
        let msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.COMOperation]);
        msg.addInt32(ParameterName.Index, COMOperation.ErrorMessage);
        msg.addInt32(ParameterName.Value, errorCode);
        return msg;
    }
    /**
     * Create a "ChangeUser" message.
     *
     * This message logs in the given user. The username is usually prepended with the principal name followed by a dot
     * (e.g., 'duckburg.mickey'). In this case, the server expects that the next message it receives will be
     * 'ChangePrincipal'. If not the server will disconnect.
     *
     * The password is allowed to be empty.
     *
     * @param {string} username The user to login.
     * @param {Hash} password The user's password hashed with crypt_md5 or the empty string.
     */
    static changeUser(username, password) {
        let msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.ChangeUser]);
        msg.addString(ParameterName.User, username);
        if (password instanceof cryptmd5.Hash) {
            msg.addString(ParameterName.Password, password.value);
        }
        else {
            msg.addString(ParameterName.Password, '');
        }
        return msg;
    }
    /**
     * Create a "ChangePrincipal" message.
     *
     * @param {string} principalName: The client affiliation of the logged-in user.
     */
    static changePrincipal(principalName) {
        let msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.ChangePrincipal]);
        msg.addString(ParameterName.Principal, principalName);
        return msg;
    }
    /**
     * Create a "RunScriptOnServer" message.
     *
     * @param {string} sourceCode The complete script that is to be executed on the server.
     */
    static runScriptOnServer(sourceCode) {
        let msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.COMOperation]);
        msg.addInt32(ParameterName.Index, COMOperation.RunScriptOnServer);
        msg.addString(ParameterName.Parameter, sourceCode);
        return msg;
    }
    /**
     * Create a "callClassOperation" message.
     *
     * @param {string} classAndOp: The class name and the operation name (e.g. "PortalScript.uploadScript")
     * @param {string[]} parameters: The parameters of the operation (e.g. ["scriptName", "scriptSource as string"])
     */
    static callClassOperation(classAndOp, parameters) {
        let msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.CallClassOperation]);
        msg.addString(ParameterName.ClassAndOp, classAndOp);
        if (parameters.length) {
            msg.addStringList(ParameterName.Parameter, parameters);
        }
        return msg;
    }
    constructor() {
        this.buffer = Buffer.alloc(INITIAL_BUFFER_SIZE);
        this.bufferedLength = 0;
    }
    /**
     * Add given bytes to this message.
     *
     * @param {Buffer} bytes A buffer or array of 8-bit unsigned integer values.
     */
    add(bytes) {
        if (!Buffer.isBuffer(bytes)) {
            bytes = Buffer.from(bytes);
        }
        this.appendToBuffer(bytes);
    }
    /**
     * Add given string to this message.
     *
     * @param {Parameter} parameterName The name of the parameter you want to add.
     * @param {string} value The string you want to add.
     */
    addString(parameterName, value) {
        this.add([Type.String, parameterName]);
        let stringSize = Buffer.from([0, 0, 0, 0]);
        network_1.htonl(stringSize, 0, value.length + 1);
        this.add(stringSize);
        this.add(term_utf8(value));
    }
    /**
     * Add given string-list to this message.
     *
     * @param {Parameter} parameterName The name of the parameter you want to add.
     * @param {string} value1 The first string you want to add.
     * @param {string} value2 The second string you want to add.
     */
    addStringList(parameterName, values) {
        // head-part of parameter
        // add type and name
        this.add([Type.StringList, parameterName]);
        // data-part of parameter
        // solve size (bytes) of the data-part
        let varSize = 0;
        // size of data-size (number)
        varSize += 32;
        // size of list-size (number)
        varSize += 32;
        for (let value of values) {
            // size of the current string-size (number)
            varSize += 32;
            // size of the current string
            varSize += value.length;
        }
        // add size (bytes) of the data-part
        let dataSize = Buffer.from([0, 0, 0, 0]);
        network_1.htonl(dataSize, 0, varSize);
        this.add(dataSize);
        // add size of stringlist (number of elements)
        let numElem = values.length;
        let listSize = Buffer.from([0, 0, 0, 0]);
        network_1.htonl(listSize, 0, numElem);
        this.add(listSize);
        // add size and value of all strings
        for (let value of values) {
            let stringSize = Buffer.from([0, 0, 0, 0]);
            network_1.htonl(stringSize, 0, value.length + 1);
            this.add(stringSize);
            this.add(term_utf8(value));
        }
    }
    addInt32(parameterName, value) {
        this.add([Type.Int32, parameterName]);
        let bytes = Buffer.from([0, 0, 0, 0]);
        network_1.htonl(bytes, 0, value);
        this.add(bytes);
    }
    /**
     * Prepare this message to be send.
     */
    pack() {
        // First 4 bytes of the head are the length of the entire message, including the length itself, or'ed with
        // flags, always 0 in our case, in network byte order
        const size = this.bufferedLength + 4;
        let msg = Buffer.alloc(size);
        network_1.htonl(msg, 0, size);
        this.buffer.copy(msg, 4, 0, this.bufferedLength);
        return msg;
    }
    appendToBuffer(chunk) {
        const spaceLeft = this.buffer.length - this.bufferedLength;
        if (spaceLeft < chunk.length) {
            const newCapacity = Math.max(this.bufferedLength + chunk.length, 1.5 * this.buffer.length);
            let newBuffer = Buffer.alloc(newCapacity);
            this.buffer.copy(newBuffer);
            this.buffer = newBuffer;
        }
        chunk.copy(this.buffer, this.bufferedLength);
        this.bufferedLength += chunk.length;
    }
}
exports.Message = Message;
let responseLog = log_1.Logger.create('Response');
class Response {
    constructor(buffer) {
        this.buffer = buffer;
        this.length = network_1.ntohl(buffer, 0);
        if (this.length !== this.buffer.length) {
            responseLog.warn(`response length is ${this.length} but received chunk with length ${this.buffer.length}`);
        }
    }
    isSimple() {
        return this.length === 8;
    }
    getInt32(name) {
        responseLog.debug(`getInt32(${ParameterName[name]})`);
        const paramIndex = this.getParamIndex(name);
        const headType = this.buffer[paramIndex];
        assert.ok((headType & ~Type.NullFlag) === Type.Int32);
        return network_1.ntohl(this.buffer, paramIndex + 2);
    }
    getString(name) {
        responseLog.debug(`getString(${ParameterName[name]})`);
        const paramIndex = this.getParamIndex(name);
        const headType = this.buffer[paramIndex];
        assert.ok((headType & ~Type.NullFlag) === Type.String);
        if (headType & Type.NullFlag) {
            return '';
        }
        const strLength = network_1.ntohl(this.buffer, paramIndex + 2) - 1;
        // Note: we expect here that the opposite party is a JANUS server compiled with UTF-8 support.
        return this.buffer.toString('utf8', paramIndex + 6, paramIndex + 6 + strLength);
    }
    getStringList(name) {
        responseLog.debug(`getString(${ParameterName[name]})`);
        const paramIndex = this.getParamIndex(name);
        const headType = this.buffer[paramIndex];
        assert.ok((headType & ~Type.NullFlag) === Type.StringList);
        if (headType & Type.NullFlag) {
            return [];
        }
        // ----- header of parameter -----
        // paramIndex[0]: type
        // paramIndex[1]: name-code
        // ----- data-part of parameter -----
        // paramIndex[2..5]: size of data-part of the parameter (stringlist)
        // paramIndex[6..9]: size of the stringlist (number of elements)
        // paramIndex[10..13]: strLen: size of the first string (bytes)
        // paramIndex[14...]: first string
        // paramIndex[14 + strLen ...]: size of second string
        // paramIndex[14 + strLen + 4 ...]: second string
        // ...
        // const dataPartSize = ntohl(this.buffer, paramIndex + 2);
        const numElem = network_1.ntohl(this.buffer, paramIndex + 6);
        let returnList = [];
        let listPtr = paramIndex + 10;
        let strLen = 0;
        let str = '';
        for (let i = 0; i < numElem; i++) {
            strLen = network_1.ntohl(this.buffer, listPtr);
            listPtr += 4;
            str = this.buffer.toString('utf8', listPtr, listPtr + strLen - 1);
            listPtr += strLen;
            returnList.push(str);
        }
        return returnList;
    }
    getBool(name) {
        responseLog.debug(`getBool(${ParameterName[name]})`);
        const paramIndex = this.getParamIndex(name);
        const headType = this.buffer[paramIndex];
        assert.ok((headType & ~Type.NullFlag) === Type.Boolean);
        if (headType & Type.NullFlag) {
            return false;
        }
        else {
            return true;
        }
    }
    /**
     * Returns true if this response and otherBuffer have exactly the same bytes and length, false otherwise.
     */
    equals(otherBuffer) {
        return this.buffer.equals(otherBuffer);
    }
    /**
     * Returns true if this response starts with given characters, false otherwise.
     */
    startsWith(str) {
        return this.buffer.includes(str);
    }
    getParamIndex(name) {
        if (this.isSimple()) {
            throw new Error('simple response cannot have a parameter');
        }
        for (let i = FIRST_PARAM_INDEX; i < this.buffer.length; i = i + this.paramLength(i)) {
            const headName = this.buffer[i + 1];
            if (headName === name) {
                return i;
            }
        }
        // No parameter in this response with that name
        throw new Error(`no such parameter in response: ${ParameterName[name]}`);
    }
    paramLength(paramIndex) {
        // head: 2 bytes
        //       head.type: 1 byte
        //       head.name: 1 byte
        //
        // data: 0 or more bytes, depending on head.type
        //       if head.type is Type.Int32 or Type.Date: 4 bytes
        //       if head.type is Type.OID: 8 bytes
        //       and so on
        assert.ok(paramIndex >= FIRST_PARAM_INDEX && paramIndex < this.buffer.length);
        const headType = this.buffer[paramIndex];
        if (headType & Type.NullFlag) {
            // No data, just the head
            return 2;
        }
        switch (headType & ~Type.NullFlag) {
            case Type.Boolean:
                return 2;
            case Type.Int32:
            case Type.Date:
                return 2 + 4;
            case Type.OID:
                // head: 2 + oid.low: 4 + oid.high: 4
                return 2 + (2 * 4);
            default:
                // head: 2 + size: 4 + whatever the size is
                return 2 + 4 + network_1.ntohl(this.buffer, paramIndex + 2);
        }
    }
}
exports.Response = Response;
let log = log_1.Logger.create('SDSProtocolTransport');
class SDSProtocolTransport extends events_1.EventEmitter {
    constructor(socket) {
        super();
        this.socket = socket;
        this.buffer = Buffer.alloc(INITIAL_BUFFER_SIZE);
        this.bufferedLength = 0;
        this.messageSize = 0;
        this.socket.on('data', (chunk) => {
            this.scanParseAndEmit(chunk);
        });
    }
    /**
     * Send given message on TCP socket.
     */
    send(msg) {
        let packedMessage = msg.pack();
        log.debug(printBytes('sending', packedMessage));
        this.socket.write(packedMessage);
    }
    /**
     * Disconnect from the server by ending the TCP connection.
     *
     * Actually, this half-closes the socket, so there still might come a response from the other end.
     */
    disconnect() {
        return new Promise((resolve, reject) => {
            this.socket.on('close', () => resolve());
            this.socket.end();
        });
    }
    scanParseAndEmit(chunk) {
        log.debug(printBytes('received', chunk));
        if (chunk.equals(ACK) || chunk.equals(INVALID)) {
            let res = new Response(chunk);
            this.emit('response', res);
            return;
        }
        if (this.messageSize === 0) {
            // start of message
            const size = network_1.ntohl(chunk, 0);
            if (chunk.length === size) {
                // Got whole message in one chunk. No need to copy anything
                let res = new Response(chunk);
                this.emit('response', res);
                return;
            }
            else {
                // message longer than chunk, so we'll need a buffer
                this.buffer.fill(0);
                this.bufferedLength = 0;
                this.messageSize = size;
            }
        }
        if (chunk.length < (this.messageSize - this.bufferedLength)) {
            // No end of message, still wait, don't emit anything
            this.appendToBuffer(chunk);
            return;
        }
        else if (chunk.length === (this.messageSize - this.bufferedLength)) {
            this.appendToBuffer(chunk);
            // Buffer contains a complete response. Parse and emit
            let res = new Response(this.buffer);
            this.emit('response', res);
            // reset variable
            this.messageSize = 0;
            return;
        }
        // else if(chunk.length > (this.messageSize - this.bufferedLength))
        {
            // received chunk longer than the message, so remainder is from next message
            const lastByteIdx = this.messageSize - this.bufferedLength - 1;
            let test = chunk.slice(0, lastByteIdx);
            this.appendToBuffer(chunk.slice(0, lastByteIdx));
            if ((lastByteIdx + 1) < chunk.length) {
                // Continue with remainder
                this.scanParseAndEmit(chunk.slice(lastByteIdx + 1));
            }
        }
    }
    appendToBuffer(chunk) {
        const spaceLeft = this.buffer.length - this.bufferedLength;
        if (spaceLeft < chunk.length) {
            const newCapacity = Math.max(this.bufferedLength + chunk.length, 1.5 * this.buffer.length);
            let newBuffer = Buffer.alloc(newCapacity);
            this.buffer.copy(newBuffer);
            this.buffer = newBuffer;
        }
        chunk.copy(this.buffer, this.bufferedLength);
        this.bufferedLength += chunk.length;
    }
}
exports.SDSProtocolTransport = SDSProtocolTransport;
let connectionLog = log_1.Logger.create('SDSConnection');
class SDSConnection {
    /**
     * Create a new connection on given socket.
     */
    constructor(socket) {
        /**
         * Make a new promise that is resolved once a 'response' event is triggered.
         */
        this.waitForResponse = () => {
            return new Promise(resolve => {
                this.transport.once('response', resolve);
            });
        };
        this._timeout = 6000;
        this.transport = new SDSProtocolTransport(socket);
        this._clientId = undefined;
    }
    /**
     * Connect to server.
     *
     */
    connect(clientName) {
        connectionLog.debug(`connect`);
        return this.send(Message.hello()).then((response) => {
            if (!response.equals(ACK)) {
                if (response.startsWith('invalid')) {
                    throw new Error(`server refused connection`);
                }
                else {
                    throw new Error(`unexpected response`);
                }
            }
            // Hello ack'ed, no SSL, send intro
            let msg = new Message();
            msg.add([0, 0, 0, 0, 0, 0, 0, 0, 0]);
            msg.add(Buffer.from(term_utf8(`${clientName} on ${os.platform()}`)));
            return this.send(msg);
        }).then((response) => {
            this._clientId = response.getInt32(ParameterName.ClientId);
        });
    }
    changeUser(username, password) {
        connectionLog.debug(`changeUser`);
        return new Promise((resolve, reject) => {
            this.send(Message.changeUser(username, password)).then((response) => {
                const result = response.getInt32(ParameterName.ReturnValue);
                log.debug(`changeUser returned: ${result}`);
                if (result > 0) {
                    return this.errorMessage(result).then(localizedReason => {
                        let reason;
                        if (localizedReason.startsWith('Login-Name oder Passwort')) {
                            reason = 'username or password incorrect';
                        }
                        reject(reason === undefined ? new Error(`login failed`) : new Error(reason));
                    });
                }
                else {
                    log.debug(`getting user ID from response`);
                    const userId = response.getInt32(ParameterName.UserId);
                    log.debug(`response contained user ID: ${userId}`);
                    resolve(userId);
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }
    changePrincipal(principalName) {
        connectionLog.debug(`changePrincipal`);
        return new Promise((resolve, reject) => {
            this.send(Message.changePrincipal(principalName)).then((response) => {
                const result = response.getInt32(ParameterName.ReturnValue);
                if (result !== 0) {
                    reject(new Error(`unable to change principle to ${principalName}`));
                }
                else {
                    resolve();
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }
    runScriptOnServer(sourceCode) {
        connectionLog.debug(`runScriptOnServer`);
        return new Promise((resolve, reject) => {
            this.send(Message.runScriptOnServer(sourceCode)).then((response) => {
                const success = response.getBool(ParameterName.ReturnValue);
                if (success) {
                    const returnedString = response.getString(ParameterName.Parameter);
                    resolve(returnedString);
                }
                else {
                    reject(new Error(`unable to execute script`));
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }
    // Calls function on server: PDClass::callOperation
    callClassOperation(classAndOp, parameters, debug = false) {
        connectionLog.debug(`callClassOperation`);
        return new Promise((resolve, reject) => {
            this.send(Message.callClassOperation(classAndOp, parameters), false, debug).then((response) => {
                const result = response.getInt32(ParameterName.ReturnValue);
                if (result === 0) {
                    const returnedList = response.getStringList(ParameterName.Parameter);
                    resolve(returnedList);
                }
                else if (result < 0) {
                    reject(new Error(`unable to call operation ${classAndOp}`));
                }
                else {
                    // TODO: check this return value
                    resolve();
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }
    errorMessage(errorCode) {
        connectionLog.debug(`errorMessage`);
        return new Promise((resolve, reject) => {
            this.send(Message.errorMessage(errorCode)).then((response) => {
                const reason = response.getString(ParameterName.ReturnValue);
                resolve(reason);
            }).catch((reason) => {
                reject(reason);
            });
        });
    }
    /**
     * Send given message on the wire and immediately return a promise that is fulfilled whenever the response
     * comes in or the timeout is reached.
     */
    send(msg, ignoreTimeout = false, debugServerMode) {
        // if send is called by disconnect, the server sends no response,
        // so call send without timeout to avoid the timeout-reject
        if (ignoreTimeout) {
            this.transport.send(msg);
            return new Promise((resolve) => {
                resolve();
            });
        }
        else {
            // normal case: call send with timeout
            let timeoutId;
            let ms = this._timeout || 6000;
            if (debugServerMode) {
                ms = 0x7FFFFFFF;
            }
            let response = this.waitForResponse();
            this.transport.send(msg);
            // clear timeouts if response finishes in time
            // see motivation of npm promised-timeout
            return promised_timeout_1.timeout({
                promise: response,
                time: ms,
                error: new Error('Request timed out'),
            });
        }
    }
    /**
     * Set the time in milliseconds after all future requests will timeout.
     * @param {timeout} timeout The timeout in milliseconds.
     */
    set timeout(timeout) {
        this._timeout = timeout;
    }
    /**
     * Returns the timeout in milliseconds.
     */
    get timeout() {
        return this._timeout;
    }
    /**
     * Disconnect from the server.
     */
    disconnect() {
        connectionLog.debug(`disconnect`);
        return this.send(Message.disconnectClient(), true).then(() => {
            return this.transport.disconnect();
        });
    }
    /**
     * Returns the client ID.
     */
    get clientId() {
        return this._clientId;
    }
}
exports.SDSConnection = SDSConnection;
//# sourceMappingURL=sds.js.map