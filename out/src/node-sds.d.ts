declare module 'node-sds' {
	export class Hash {
	    value: string;
	    constructor(value: string);
	}

}
declare module 'node-sds' {
	export type LogLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
	export interface LogConfiguration {
	    /** The name of the logfile. */
	    fileName?: string;
	    /** The minimum loglevel(s) for messages written to the logfile. */
	    logLevel?: {
	        [logName: string]: LogLevel;
	    };
	}
	export class Logger {
	    private name;
	    static create(name: string): Logger;
	    private static loggers;
	    private static _config;
	    private static fd;
	    private static startTime;
	    private logLevel;
	    constructor(name: string);
	    debug(msg: string): void;
	    info(msg: string): void;
	    warn(msg: string): void;
	    error(msg: string): void;
	    static config: LogConfiguration;
	    private log(level, displayLevel, msg);
	    private configure();
	}

}
declare module 'node-sds' {
	/// <reference types="node" />
	/**
	 * Something that behaves like a bloody Node socket.
	 */
	export interface SocketLike {
	    on(event: string, handler: Function): any;
	    write(buffer: Buffer): any;
	    write(str: string, encoding: string): any;
	    end(): any;
	}
	/**
	 * Convert a 32-bit quantity (long integer) from host byte order to network byte order (little- to big-endian).
	 *
	 * @param {Buffer} b Buffer of octets
	 * @param {number} i Zero-based index at which to write into b
	 * @param {number} v Value to convert
	 */
	export function htonl(b: Buffer, i: number, val: number): void;
	/**
	 * Convert a 32-bit quantity (long integer) from network byte order to host byte order (big- to little-endian).
	 *
	 * @param {Buffer} b Buffer to read value from
	 * @param {number} i Zero-based index at which to read from b
	 */
	export function ntohl(b: Buffer, i: number): number;

}
import { EventEmitter } from 'events';
import * as cryptmd5 from './cryptmd5';
import { SocketLike } from './network';
declare module 'node-sds' {
	/// <reference types="node" />
	export enum Operation {
	    ChangeUser = 27,
	    DisconnectClient = 49,
	    PDCCallOperation = 101,
	    COMOperation = 199,
	    ChangePrincipal = 203,
	}
	export enum COMOperation {
	    ErrorMessage = 17,
	    RunScriptOnServer = 42,
	}
	export enum ParameterName {
	    ClientId = 1,
	    ClassName = 2,
	    Value = 4,
	    ReturnValue = 5,
	    Index = 13,
	    User = 21,
	    Password = 22,
	    UserId = 40,
	    Parameter = 48,
	    Principal = 80,
	    FileName = 117,
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
	    static from(buf: Buffer): Message;
	    /**
	     * Create a "Hello" message.
	     *
	     * This is the very first message send to the server.
	     */
	    static hello(): Message;
	    /**
	     * Create a "DisconnectClient" message.
	     *
	     * This message disconnects the client from the server in an orderly fashion.
	     */
	    static disconnectClient(): Message;
	    /**
	     * Create a "ErrorMessage" message.
	     *
	     * This message returns a human-readable string (probably in German) for a given error code.
	     * @param {number} errorCode The error code from a previous SDS call.
	     */
	    static errorMessage(errorCode: number): Message;
	    /**
	     * Create a "ChangeUser" message.
	     *
	     * This message logs in the given user.
	     *
	     * @param {string} username The user to login. Can be with principal name (e.g., 'duckburg.mickey').
	     * @param {Hash} password The user's password hashed with crypt_md5.
	     */
	    static changeUser(username: string, password: cryptmd5.Hash): Message;
	    /**
	     * Create a "ChangePrincipal" message.
	     *
	     * @param {string} principalName: The client affiliation of the logged-in user.
	     */
	    static changePrincipal(principalName: string): Message;
	    /**
	     * Create a "RunScriptOnServer" message.
	     *
	     * @param {string} sourceCode The complete script that is to be executed on the server.
	     */
	    static runScriptOnServer(sourceCode: string): Message;
	    /**
	     * Create a "pdcCallOperation" message.
	     *
	     * @param {string} className: The class name and the operation name (e.g. "PortalScript.uploadScript")
	     * @param {string[]} paramList: The parameters of the operation (e.g. [scriptName, scriptSource])
	     */
	    static pdcCallOperation(className: string, paramList: string[]): Message;
	    private buffer;
	    private bufferedLength;
	    name: string;
	    constructor();
	    /**
	     * Add given bytes to this message.
	     *
	     * @param {Buffer} bytes A buffer or array of 8-bit unsigned integer values.
	     */
	    add(bytes: Buffer | number[]): void;
	    /**
	     * Add given string to this message.
	     *
	     * @param {Parameter} parameterName The name of the parameter you want to add.
	     * @param {string} value The string you want to add.
	     */
	    addString(parameterName: ParameterName, value: string): void;
	    /**
	     * Add given string-list to this message.
	     *
	     * @param {Parameter} parameterName The name of the parameter you want to add.
	     * @param {string} value1 The first string you want to add.
	     * @param {string} value2 The second string you want to add.
	     */
	    addStringList(parameterName: ParameterName, values: string[]): void;
	    addInt32(parameterName: ParameterName, value: number): void;
	    /**
	     * Prepare this message to be send.
	     */
	    pack(): Buffer;
	    private appendToBuffer(chunk);
	}
	export class Response {
	    private buffer;
	    readonly length: number;
	    constructor(buffer: Buffer);
	    isSimple(): boolean;
	    getInt32(name: ParameterName): number;
	    getString(name: ParameterName): string;
	    getBool(name: ParameterName): boolean;
	    /**
	     * Returns true if this response and otherBuffer have exactly the same bytes and length, false otherwise.
	     */
	    equals(otherBuffer: Buffer): boolean;
	    /**
	     * Returns true if this response starts with given characters, false otherwise.
	     */
	    startsWith(str: string): boolean;
	    private getParamIndex(name);
	    private paramLength(paramIndex);
	}
	export class SDSProtocolTransport extends EventEmitter {
	    private socket;
	    constructor(socket: SocketLike);
	    /**
	     * Send given message on TCP socket.
	     */
	    send(msg: Message): void;
	    /**
	     * Disconnect from the server by ending the TCP connection.
	     *
	     * Actually, this half-closes the socket, so there still might come a response from the other end.
	     */
	    disconnect(): Promise<void>;
	    private scanParseAndEmit(chunk);
	}
	export type ClientId = number;
	export type UserId = number;
	export class SDSConnection {
	    private _clientId;
	    private _timeout;
	    private transport;
	    /**
	     * Create a new connection on given socket.
	     */
	    constructor(socket: SocketLike);
	    /**
	     * Connect to server.
	     *
	     */
	    connect(): Promise<void>;
	    changeUser(username: string, password: cryptmd5.Hash): Promise<UserId>;
	    changePrincipal(principalName: string): Promise<void>;
	    runScriptOnServer(sourceCode: string): Promise<string>;
	    pdcCallOperation(operation: string, parameters?: string[], debug?: boolean): Promise<string[]>;
	    errorMessage(errorCode: number): Promise<string>;
	    /**
	     * Send given message on the wire and immediately return a promise that is fulfilled whenever the response
	     * comes in or the timeout is reached.
	     */
	    send(msg: Message): Promise<Response>;
	    /**
	     * Returns the timeout in milliseconds.
	     */
	    /**
	     * Set the time in milliseconds after all future requests will timeout.
	     * @param {timeout} timeout The timeout in milliseconds.
	     */
	    timeout: number;
	    /**
	     * Disconnect from the server.
	     */
	    disconnect(): Promise<void>;
	    /**
	     * Returns the client ID.
	     */
	    readonly clientId: number | undefined;
	    /**
	     * Make a new promise that is resolved once a 'response' event is triggered.
	     */
	    private waitForResponse;
	}

}
