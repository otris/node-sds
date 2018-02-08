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

import * as assert from 'assert';
import { EventEmitter } from 'events';
import { connect } from 'net';
import * as os from 'os';
import { timeout } from 'promised-timeout';
import * as cryptmd5 from './cryptmd5';
import { htonl, ntohl, SocketLike } from './network';

const HELLO: Buffer = Buffer.from('GGCH$1$$', 'ascii');
const ACK: Buffer = Buffer.from(term_utf8('valid'));
const INVALID: Buffer = Buffer.from('invalid', 'ascii');
const INITIAL_BUFFER_SIZE = 4 * 1024;
const MESSAGE_HEAD_LENGTH = 13;
const OID_LOW_INDEX = 4;
const OID_HIGH_INDEX = 8;
const OPERATION_INDEX = 12;
const FIRST_PARAM_INDEX = 13;
const JANUS_CRYPTMD5_SALT: string = 'o3';

export type JanusPassword = '' | cryptmd5.Hash;

/**
 * Return an array of all UTF-16 code units in given string plus a 0-terminus.
 *
 * Hint: returns the code point of every character of the string, not the bytes
 *
 * @param {string} str An arbitrary string
 * @returns An array containing all code units plus a final '0'.
 */
function term(str: string): number[] {
    const units = str.split('').map(char => char.charCodeAt(0));
    units.push(0);
    return units;
}

/**
 * Return a buffer (the bytes) of an utf-8 string plus a 0-terminus.
 *
 * @param {string} str An arbitrary string
 * @returns An array containing all code units plus a final '0'.
 */
function term_utf8(str: string): Buffer {
    const byteLength = Buffer.byteLength(str);
    const buffer = Buffer.alloc(byteLength + 1, str, 'utf-8');
    buffer[byteLength] = 0;
    return buffer;
}

/**
 * Return the number of bytes of an utf-8 string plus a 0-terminus.
 *
 * @param {string} str An arbitrary string
 * @returns Number of all code units plus a final '0'.
 */
function size_term_utf8(str: string): number {
    const byteLength = Buffer.byteLength(str);
    return byteLength + 1;
}

export function getJanusPassword(val: string): JanusPassword {
    if (val.length > 0) {
        return cryptmd5.crypt_md5(val, JANUS_CRYPTMD5_SALT);
    }
    return '';
}

/**
 * Return a string where all bytes in given Buffer object are printed conveniently in hexadecimal notation. Only useful
 * when logging or debugging.
 *
 * @param {string} msg A string that is printed as prefix
 * @param {Buffer} buf The buffer to print
 * @returns A string with given buffer's contents in hexadecimal notation.
 */
function printBytes(msg: string | undefined, buf: Buffer): string {
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
        const hex: string = buf[i].toString(16);
        str += (hex.length === 1 ? '0x0' + hex : '0x' + hex) + ', ';
    }
    str += `\n]`;
    return str;
}

export enum Operation {
    ChangeUser = 27,
    DisconnectClient = 49,
    SetLanguage = 59,
    CallClassOperation = 101,
    COMOperation = 199,
    ChangePrincipal = 203,
    SrvGui = 209,
}

export enum COMOperation {
    ErrorMessage = 17,
    RunScriptOnServer = 42,
}

export enum SrvGuiOperation {
    GetMessages = 10,
}

export enum ParameterName {
    ClientId = 1,
    ClassAndOp = 2,
    Value = 4,
    ReturnValue = 5,
    Something = 8,
    Index = 13,
    Language = 14, // COMMS_LANG Int32
    User = 21, // COMMS_USER String
    Password = 22, // COMMS_PASSWORD String
    Last = 25,
    UserId = 40,
    Parameter = 48,
    ParameterPDO = 49,
    Conversion = 51,
    Principal = 80,
    Filename = 87,
    Opcode = 88,
    Flag = 119,
}

export enum Type {
    Boolean = 2,
    Int32 = 3,
    Date = 4,
    String = 7,
    OID = 9,
    Int32List = 10,
    StringList = 11,
    OIDList = 12,
    NullFlag = 128,
}

export class Message {
    /**
     * Create an arbitrary message from the given buffer.
     */
    public static from(buf: Buffer): Message {
        const msg = new Message();
        msg.buffer = buf;
        msg.bufferedLength = buf.length;
        return msg;
    }

    /**
     * Create a "Hello" message.
     *
     * This is the very first message send to the server.
     */
    public static hello(): Message {
        const msg = Message.from(HELLO);
        msg.pack = (): Buffer => {
            return msg.buffer;
        };
        return msg;
    }

    /**
     * Create a "DisconnectClient" message.
     *
     * This message disconnects the client from the server in an orderly fashion.
     */
    public static disconnectClient(): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.DisconnectClient]);
        return msg;
    }

    /**
     * Create a "ErrorMessage" message.
     *
     * This message returns a human-readable string (probably in German) for a given error code.
     * @param {number} errorCode The error code from a previous SDS call.
     */
    public static errorMessage(errorCode: number): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.COMOperation]);
        msg.addInt32(ParameterName.Index, COMOperation.ErrorMessage);
        msg.addInt32(ParameterName.Value, errorCode);
        return msg;
    }

    /**
     * Create a "GetLogMessages" message.
     * @param {number} lastSeen A transient number that identifies the log lines already retrieved.
     * Returned in the response to this message. Set it to -1 initially.
     */
    public static getLogMessages(lastSeen: number): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.SrvGui]);
        msg.addInt32(ParameterName.Opcode, SrvGuiOperation.GetMessages);
        msg.addInt32(ParameterName.Something, lastSeen);
        msg.addBoolean(ParameterName.Conversion, true); // Convert to UTF-8
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
    public static changeUser(username: string, password: cryptmd5.Hash | ''): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.ChangeUser]);
        msg.addString(ParameterName.User, username);
        if (password instanceof cryptmd5.Hash) {
            msg.addString(ParameterName.Password, password.value);
        } else {
            msg.addString(ParameterName.Password, '');
        }
        return msg;
    }

    /**
     * Create a "SetLanugage" message.
     *
     * @param {string} language The number of the language (e.g. for documents see model).
     */
    public static setLanguage(language: number): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.SetLanguage]);
        msg.addInt32(ParameterName.Language, language);
        return msg;
    }

    /**
     * Create a "ChangePrincipal" message.
     *
     * @param {string} principalName: The client affiliation of the logged-in user.
     */
    public static changePrincipal(principalName: string): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.ChangePrincipal]);
        msg.addString(ParameterName.Principal, principalName);
        return msg;
    }

    /**
     * Create a "RunScriptOnServer" message.
     *
     * @param {string} sourceCode The complete script that is to be executed on the server.
     * @param {string} scriptUrl An (optional) string that is used to identify the script, e.g., the filename or a URL.
     */
    public static runScriptOnServer(sourceCode: string, scriptUrl?: string): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.COMOperation]);
        msg.addInt32(ParameterName.Index, COMOperation.RunScriptOnServer);
        msg.addString(ParameterName.Parameter, sourceCode);
        if (scriptUrl) {
            msg.addString(ParameterName.Filename, scriptUrl);
        }
        return msg;
    }

    /**
     * Create a "callClassOperation" message.
     *
     * @param {string} classAndOp: The class name and the operation name (e.g. "PortalScript.uploadScript")
     * @param {string[]} parameters: The parameters of the operation (e.g. ["scriptName", "scriptSource as string"])
     */
    public static callClassOperation(classAndOp: string, parameters: string[], parametersPDO?: string[]): Message {
        const msg = new Message();
        msg.add([0, 0, 0, 0, 0, 0, 0, 0, Operation.CallClassOperation]);
        msg.addString(ParameterName.ClassAndOp, classAndOp);
        if (parameters.length) {
            msg.addStringList(ParameterName.Parameter, parameters);
        }
        if (parametersPDO && parametersPDO.length) {
            msg.addStringList(ParameterName.ParameterPDO, parametersPDO);
        }
        return msg;
    }

    private buffer: Buffer;
    private bufferedLength: number;

    constructor() {
        this.buffer = Buffer.alloc(INITIAL_BUFFER_SIZE);
        this.bufferedLength = 0;
    }

    /**
     * Add given bytes to this message.
     *
     * @param {Buffer} bytes A buffer or array of 8-bit unsigned integer values.
     */
    public add(bytes: Buffer | number[]): void {
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
    public addString(parameterName: ParameterName, value: string): void {
        this.add([Type.String, parameterName]);
        const stringSize = Buffer.from([0, 0, 0, 0]);
        htonl(stringSize, 0, size_term_utf8(value));
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
    public addStringList(parameterName: ParameterName, values: string[]): void {
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
        for (const value of values) {
            // size of the current string-size (number)
            varSize += 32;
            // size of the current string
            varSize += size_term_utf8(value);
        }

        // add size (bytes) of the data-part
        const dataSize = Buffer.from([0, 0, 0, 0]);
        htonl(dataSize, 0, varSize);
        this.add(dataSize);

        // add size of StringList (number of elements)
        const numElem = values.length;
        const listSize = Buffer.from([0, 0, 0, 0]);
        htonl(listSize, 0, numElem);
        this.add(listSize);

        // add size and value of all strings
        for (const value of values) {
            const stringSize = Buffer.from([0, 0, 0, 0]);
            htonl(stringSize, 0, size_term_utf8(value));
            this.add(stringSize);
            this.add(term_utf8(value));
        }
    }

    public addInt32(parameterName: ParameterName, value: number): void {
        this.add([Type.Int32, parameterName]);
        const bytes = Buffer.from([0, 0, 0, 0]);
        htonl(bytes, 0, value);
        this.add(bytes);
    }

    public addBoolean(parameterName: ParameterName, value: boolean): void {
        let type = Type.Boolean;
        if (!value) {
            type |= Type.NullFlag;
        }
        this.add([type, parameterName]);
    }

    /**
     * Prepare this message to be send.
     */
    public pack(): Buffer {

        // First 4 bytes of the head are the length of the entire message, including the length itself, or'ed with
        // flags, always 0 in our case, in network byte order

        const size = this.bufferedLength + 4;
        const msg: Buffer = Buffer.alloc(size);
        htonl(msg, 0, size);
        this.buffer.copy(msg, 4, 0, this.bufferedLength);
        return msg;
    }

    private appendToBuffer(chunk: Buffer): void {
        const spaceLeft = this.buffer.length - this.bufferedLength;
        if (spaceLeft < chunk.length) {
            const newCapacity = Math.max(this.bufferedLength + chunk.length, 1.5 * this.buffer.length);
            const newBuffer = Buffer.alloc(newCapacity);
            this.buffer.copy(newBuffer);
            this.buffer = newBuffer;
        }
        chunk.copy(this.buffer, this.bufferedLength);
        this.bufferedLength += chunk.length;
    }
}

export class Response {
    public readonly length: number;

    constructor(private buffer: Buffer) {
        this.length = ntohl(buffer, 0);
        if (this.length !== this.buffer.length) {
            // responseLog.warn(`response length is ${this.length} but received chunk with length ${this.buffer.length}`);
        }
    }

    public isSimple(): boolean {
        return this.length === 8;
    }

    public getInt32(name: ParameterName): number {
        // responseLog.debug(`getInt32(${ParameterName[name]})`);
        const paramIndex = this.getParamIndex(name);
        const headType = this.buffer[paramIndex];
        assert.ok((headType & ~Type.NullFlag) === Type.Int32);
        return ntohl(this.buffer, paramIndex + 2);
    }

    public getString(name: ParameterName): string {
        // responseLog.debug(`getString(${ParameterName[name]})`);
        const paramIndex = this.getParamIndex(name);
        const headType = this.buffer[paramIndex];
        assert.ok((headType & ~Type.NullFlag) === Type.String);
        if (headType & Type.NullFlag) {
            return '';
        }
        const strLength = ntohl(this.buffer, paramIndex + 2) - 1;
        // Note: we expect here that the opposite party is a JANUS server compiled with UTF-8 support.
        return this.buffer.toString('utf8', paramIndex + 6, paramIndex + 6 + strLength);
    }

    public getStringList(name: ParameterName): string[] {
        // responseLog.debug(`getString(${ParameterName[name]})`);
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
        // paramIndex[2..5]: size of data-part of the parameter (StringList)
        // paramIndex[6..9]: size of the StringList (number of elements)
        // paramIndex[10..13]: strLen: size of the first string (bytes)
        // paramIndex[14...]: first string
        // paramIndex[14 + strLen ...]: size of second string
        // paramIndex[14 + strLen + 4 ...]: second string
        // ...

        // const dataPartSize = ntohl(this.buffer, paramIndex + 2);

        const numElem = ntohl(this.buffer, paramIndex + 6);
        const returnList: string[] = [];
        let listPtr = paramIndex + 10;
        let strLen = 0;
        let str = '';

        for (let i = 0; i < numElem; i++) {
            strLen = ntohl(this.buffer, listPtr);
            listPtr += 4;
            str = this.buffer.toString('utf8', listPtr, listPtr + strLen - 1);
            listPtr += strLen;
            returnList.push(str);
        }

        return returnList;
    }

    public getBoolean(name: ParameterName): boolean {
        // responseLog.debug(`getBool(${ParameterName[name]})`);
        const paramIndex = this.getParamIndex(name);
        const headType = this.buffer[paramIndex];
        assert.ok((headType & ~Type.NullFlag) === Type.Boolean);
        if (headType & Type.NullFlag) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * Returns true if this response and otherBuffer have exactly the same bytes and length, false otherwise.
     */
    public equals(otherBuffer: Buffer): boolean {
        return this.buffer.equals(otherBuffer);
    }

    /**
     * Returns true if this response starts with given characters, false otherwise.
     */
    public startsWith(str: string): boolean {
        return this.buffer.includes(str);
    }

    /**
     * Sometimes the server simply sends an empty message as response (e.g. in setLanguage).
     * In this cases we can just check, if the returned message is ok.
     */
    public isEmpty(): boolean {
        // the buffer should only contain the header part
        if (this.buffer.length !== MESSAGE_HEAD_LENGTH) {
            return false;
        }
        // OID part of message head should be empty
        const oidlow = ntohl(this.buffer, OID_LOW_INDEX);
        if (oidlow !== 0) {
            return false;
        }
        const oidhigh = ntohl(this.buffer, OID_HIGH_INDEX);
        if (oidhigh !== 0) {
            return false;
        }
        // operation part of message head should be empty
        if (this.buffer[OPERATION_INDEX]  !== 0) {
            return false;
        }
        return true;
    }

    private getParamIndex(name: ParameterName) {
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

    private paramLength(paramIndex: number): number {

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
                return 2 + 4 + ntohl(this.buffer, paramIndex + 2);
        }
    }
}

export class SDSProtocolTransport extends EventEmitter {
    private buffer: Buffer;
    private bufferedLength: number;
    private messageSize: number;

    constructor(private socket: SocketLike) {
        super();

        this.buffer = Buffer.alloc(INITIAL_BUFFER_SIZE);
        this.bufferedLength = 0;
        this.messageSize = 0;

        this.socket.on('data', (chunk: Buffer) => {
            this.scanParseAndEmit(chunk);
        });
    }

    /**
     * Send given message on TCP socket.
     */
    public send(msg: Message): void {
        const packedMessage = msg.pack();
        // log.debug(printBytes('sending', packedMessage));
        this.socket.write(packedMessage);
    }

    /**
     * Disconnect from the server by ending the TCP connection.
     *
     * Actually, this half-closes the socket, so there still might come a response from the other end.
     */
    public disconnect(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.socket.on('close', () => resolve());
            this.socket.end();
        });
    }

    private scanParseAndEmit(chunk: Buffer): void {
        // log.debug(printBytes('received', chunk));

        if (chunk.equals(ACK) || chunk.equals(INVALID)) {
            const res = new Response(chunk);
            this.emit('response', res);
            return;
        }

        if (this.messageSize === 0) {
            // start of message

            const size = ntohl(chunk, 0);

            if (chunk.length === size) {
                // Got whole message in one chunk. No need to copy anything
                const res = new Response(chunk);
                this.emit('response', res);
                return;
            } else {
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
        } else if (chunk.length === (this.messageSize - this.bufferedLength)) {
            this.appendToBuffer(chunk);

            // Buffer contains a complete response. Parse and emit
            const res = new Response(this.buffer);
            this.emit('response', res);

            // reset variable
            this.messageSize = 0;
            return;
        }

        // else if(chunk.length > (this.messageSize - this.bufferedLength))
        {
            // received chunk longer than the message, so remainder is from next message
            const lastByteIdx = this.messageSize - this.bufferedLength - 1;
            const test = chunk.slice(0, lastByteIdx);
            this.appendToBuffer(chunk.slice(0, lastByteIdx));
            if ((lastByteIdx + 1) < chunk.length) {
                // Continue with remainder
                this.scanParseAndEmit(chunk.slice(lastByteIdx + 1));
            }
        }
    }

    private appendToBuffer(chunk: Buffer): void {
        const spaceLeft = this.buffer.length - this.bufferedLength;
        if (spaceLeft < chunk.length) {
            const newCapacity = Math.max(this.bufferedLength + chunk.length, 1.5 * this.buffer.length);
            const newBuffer = Buffer.alloc(newCapacity);
            this.buffer.copy(newBuffer);
            this.buffer = newBuffer;
        }
        chunk.copy(this.buffer, this.bufferedLength);
        this.bufferedLength += chunk.length;
    }
}

export interface LogMessages {
    /**
     * A transient number that identifies the lines already retrieved.
     * Returned in the response to this message. Set it to -1 initially.
     */
    lastSeen: number;

    /**
     * A bunch of log lines that the server logged since lastSeen.
     */
    lines: string[];
}

export type ClientId = number;

export type UserId = number;

export class SDSConnection {
    private _clientId: ClientId | undefined;
    private _timeout: number;
    private transport: SDSProtocolTransport;

    /**
     * Create a new connection on given socket.
     */
    constructor(socket: SocketLike) {
        this._timeout = 6000;
        this.transport = new SDSProtocolTransport(socket);
        this._clientId = undefined;
    }

    /**
     * Connect to server.
     *
     */
    public connect(clientName: string): Promise<void> {
        // connectionLog.debug(`connect`);
        return this.send(Message.hello()).then((response: Response) => {

            if (!response.equals(ACK)) {
                if (response.startsWith('invalid')) {
                    throw new Error(`server refused connection`);
                } else {
                    throw new Error(`unexpected response`);
                }
            }

            // Hello ack'ed, no SSL, send intro
            const msg = new Message();
            msg.add([0, 0, 0, 0, 0, 0, 0, 0, 0]);
            msg.add(Buffer.from(term_utf8(`${clientName} on ${os.platform()}`)));
            return this.send(msg);

        }).then((response: Response) => {

            this._clientId = response.getInt32(ParameterName.ClientId);

        });
    }

    public changeUser(username: string, password: cryptmd5.Hash | ''): Promise<UserId> {
        // connectionLog.debug(`changeUser`);
        return new Promise<UserId>((resolve, reject) => {
            this.send(Message.changeUser(username, password)).then((response: Response) => {
                const result = response.getInt32(ParameterName.ReturnValue);
                // log.debug(`changeUser returned: ${result}`);
                if (result > 0) {
                    return this.errorMessage(result).then(localizedReason => {
                        let reason: string | undefined;
                        if (localizedReason.startsWith('Login-Name oder Passwort')) {
                            reason = 'username or password incorrect';
                        }
                        reject(reason === undefined ? new Error(`login failed`) : new Error(reason));
                    });
                } else {
                    // log.debug(`getting user ID from response`);
                    const userId = response.getInt32(ParameterName.UserId);
                    // log.debug(`response contained user ID: ${userId}`);
                    resolve(userId);
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    public changePrincipal(principalName: string): Promise<void> {
        // connectionLog.debug(`changePrincipal`);
        return new Promise<void>((resolve, reject) => {
            this.send(Message.changePrincipal(principalName)).then((response: Response) => {
                const result = response.getInt32(ParameterName.ReturnValue);
                if (result !== 0) {
                    reject(new Error(`unable to change principle to ${principalName}`));
                } else {
                    resolve();
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    /**
     * Set the language.
     * If the language number does not match a language, the server
     * sets the language to 0 without error message.
     *
     * @param language The language number (e.g. for documents see model)
     */
    public setLanguage(language: number): Promise<void> {
        // connectionLog.debug(`setLanguage`);
        return new Promise<void>((resolve, reject) => {
            this.send(Message.setLanguage(language)).then((response: Response) => {
                const result = response.isEmpty();
                if (result === false) {
                    reject(new Error(`set language failed, server sent invalid response`));
                } else {
                    resolve();
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    public runScriptOnServer(sourceCode: string, scriptUrl?: string): Promise<string> {
        // connectionLog.debug(`runScriptOnServer`);
        return new Promise<string>((resolve, reject) => {
            this.send(Message.runScriptOnServer(sourceCode, scriptUrl)).then((response: Response) => {
                const success = response.getBoolean(ParameterName.ReturnValue);
                if (success) {
                    const returnedString = response.getString(ParameterName.Parameter);
                    resolve(returnedString);
                } else {
                    reject(new Error(`unable to execute script`));
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    // Calls function on server: PDClass::callOperation
    public callClassOperation(classAndOp: string, parameters: string[], parametersPDO?: string[]): Promise<string[]> {
        // connectionLog.debug(`callClassOperation`);
        return new Promise<string[]>((resolve, reject) => {
            this.send(Message.callClassOperation(classAndOp, parameters, parametersPDO)).then((response: Response) => {
                const result = response.getInt32(ParameterName.ReturnValue);
                if ('PortalScript.runScript' === classAndOp) {
                    // special case runScript
                    // if the executed script has a return value, result is -1, that is a
                    // bug in documents that cannot be fixed because of historical reasons
                    const returnedList = response.getStringList(ParameterName.Parameter);
                    resolve(returnedList);
                } else if (result >= 0) {
                    const returnedList = response.getStringList(ParameterName.Parameter);
                    resolve(returnedList);
                } else {
                    const returnedList = response.getStringList(ParameterName.Parameter);
                    let errorMessage = returnedList[0];
                    if (!errorMessage) {
                        errorMessage = `operation ${classAndOp} failed on server`;
                    }
                    reject(new Error(errorMessage));
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    public errorMessage(errorCode: number): Promise<string> {
        // connectionLog.debug(`errorMessage`);
        return new Promise((resolve, reject) => {
            this.send(Message.errorMessage(errorCode)).then((response: Response) => {
                const reason: string = response.getString(ParameterName.ReturnValue);
                resolve(reason);
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    public getLogMessages(lastSeen: number): Promise<LogMessages> {
        // connectionLog.debug(`getLogMessages`);
        return new Promise((resolve, reject) => {
            this.send(Message.getLogMessages(lastSeen)).then((response: Response) => {
                let messages: LogMessages;
                try {
                    const content = response.getString(ParameterName.ReturnValue);
                    const newLastSeen = response.getInt32(ParameterName.Last);
                    const isUtf8Encoded = response.getBoolean(ParameterName.Conversion);
                    assert.ok(isUtf8Encoded);
                    const lines = content.length === 0 ? [] : content.trim().split(/\r?\n/g);
                    messages = { lines, lastSeen: newLastSeen };
                } catch (err) {
                    reject(err.toString());
                    return;
                }
                resolve(messages);
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    /**
     * Send given message on the wire and immediately return a promise that is fulfilled whenever the response
     * comes in or the timeout is reached.
     *
     * @param waitForResponse when send() is called from disconnect(), we shouldn't wait for a response because
     *                        we won't get one. When setting this variable to false, we can avoid the timeout error.
     */
    public send(msg: Message, waitForResponse = true): Promise<any> {

        // if send is called by disconnect(), the server sends no response,
        // so call send without waiting for response to avoid the timeout error
        if (!waitForResponse) {
            this.transport.send(msg);
            return new Promise<void>((resolve) => {
                resolve();
            });
        } else {

            // normal case: call send with timeout

            const ms = this._timeout || 6000;

            const response: Promise<Response> = this.waitForResponse();
            this.transport.send(msg);

            // clear timeouts if response finishes in time
            // see motivation of npm promised-timeout
            return timeout({
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
    set timeout(timeout: number) {
        this._timeout = timeout;
    }

    /**
     * Returns the timeout in milliseconds.
     */
    get timeout(): number {
        return this._timeout;
    }

    /**
     * Disconnect from the server.
     */
    public disconnect(): Promise<void> {
        // connectionLog.debug(`disconnect`);
        return this.send(Message.disconnectClient(), false).then(() => {
            return this.transport.disconnect();
        });
    }

    /**
     * Returns the client ID.
     */
    get clientId(): number | undefined {
        return this._clientId;
    }

    /**
     * Make a new promise that is resolved once a 'response' event is triggered.
     */
    private waitForResponse = (): Promise<Response> => {
        return new Promise(resolve => {
            this.transport.once('response', resolve);
        });
    }
}
