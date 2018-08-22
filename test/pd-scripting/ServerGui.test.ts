import { expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { ADMIN_USER, ADMIN_USER_PASS, HOST, isLiveMode, PORT, TEST_PRINCIPAL } from "../env.test";
import { MockedJanusServer } from "../MockedJanusServer";

/* tslint:disable:no-unused-expression */
chai.use(chaiAsPromised);

describe("Tests for the PDClass-library of the JANUS-application", async () => {
	// For the unit tests we need to mock a JANUS-server that sends back meaningful and
	// correct responses to incoming requests
	const mockedJANUSServer = new MockedJanusServer();
	const sdsConnection = new SDSConnection();

	before(async () => {
		// Init the mocked JANUS-server and connect with it to test operations of the PDClass
		await mockedJANUSServer.init();
		await sdsConnection.connect("test.node-sds.pdclass", HOST, PORT);
		await sdsConnection.PDClass.changeUser(ADMIN_USER, ADMIN_USER_PASS);
		await sdsConnection.PDClass.changePrincipal(TEST_PRINCIPAL);
	});

	// @todo: This test case can only be executed once the "runScript" command is implemented.
	(!isLiveMode()) ? it.skip : it("should request logs from the server", async () => {
		// 1. request logs from the server
		let logMessages = await sdsConnection.ServerGui.getLogMessages();

		// 2. execute a script which produces log messages
		const outputString = "Test for the operation 'ServerGui.getLogMessages'";
		// const scriptToExecute = `util.out("${outputString}");`;

		// 3. again, request logs from the server, but pass the lastSeen-attribute to only receive the newly logs
		logMessages = await sdsConnection.ServerGui.getLogMessages(logMessages.lastSeen);

		// 4. the received logs should contain the produced log messages
		expect(logMessages.messages).contains(outputString);
	});
});
