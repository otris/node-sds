import { expect, should } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { ADMIN_USER, ADMIN_USER_PASS, HOST, isLiveMode, PORT, TEST_PRINCIPAL } from "../env.test";
import { MockedJanusServer } from "../MockedJanusServer";

/* tslint:disable:no-unused-expression */
chai.use(chaiAsPromised);

describe("Tests for custom pd operations", async () => {
	// For the unit tests we need to mock a JANUS-server that sends back meaningful and
	// correct responses to incoming requests
	const mockedJANUSServer = new MockedJanusServer();
	const sdsConnection = new SDSConnection();

	before(async () => {
		// Init the mocked JANUS-server and connect with it to test operations of the PDClass
		await mockedJANUSServer.init();
		await sdsConnection.connect("test.node-sds.customOperations", HOST, PORT);
		await sdsConnection.PDClass.changeUser(ADMIN_USER, ADMIN_USER_PASS);
		await sdsConnection.PDClass.changePrincipal(TEST_PRINCIPAL);
	});

	(!isLiveMode()) ? it.skip : it("should successfully execute the passed script on the server", () => {
		const returnValue = "Hello from the node-sds module!";
		return expect(sdsConnection.CustomOperations.runScriptOnServer(`return '${returnValue}';`))
			.to.eventually.equal(returnValue);
	});

	// @todo: add tests for the second parameter of CustomOperations.runScriptOnServer

	after(() => {
		sdsConnection.disconnect();
		mockedJANUSServer.close();
	});
});
