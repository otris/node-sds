### TODOs
| Filename | line # | TODO
|:------|:------:|:------
| src/pd-scripting/PDObject.ts | 26 | Fetch this property if it's not set
| src/pd-scripting/PDObject.ts | 32 | Fetch this property if it's not set
| src/pd-scripting/PDObject.ts | 55 | The return value represent some flags which gives us informations about the success of this operation
| src/pd-scripting/PDObject.ts | 99 | The sync operation can now not be used to change values of the object,
| src/sds/SDSConnection.ts | 2 | Function missing: setLanguage (see https://github.com/otris/node-sds/blob/master/src/sds.ts#L313)
| src/sds/SDSConnection.ts | 3 | Function missing: callClassOperation (see https://github.com/otris/node-sds/blob/master/src/sds.ts#L355)
| src/sds/SDSConnection.ts | 159 | send a disconnect message to the client (see https://github.com/otris/node-sds/blob/master/src/sds.ts#L250)
| src/sds/SDSConnection.ts | 275 | Create a qualified "disconnect" response
| src/sds/SDSRequest.ts | 81 | Maybe we should use Buffer.concat instead (test which one is faster)
| test/MockedJanusServer.ts | 99 | The magic can look different. For now, the magic send by the SDS-API will be fixed,
| test/MockedJanusServer.ts | 106 | I don't know how the id has to look like. For now, send a random 6 digit long number
| test/pd-scripting/CustomOperations.test.ts | 31 | add tests for the second parameter of CustomOperations.runScriptOnServer
| test/pd-scripting/PDClass.test.ts | 55 | For now it's not possible to request the current principal. But the server sends no response if two changeUser-requests
| test/pd-scripting/ServerGui.test.ts | 25 | This test case can only be executed once the "runScript" command is implemented.
