import { expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { HOST, PORT, TEST_PRINCIPAL, TEST_USER, TEST_USER_PASS } from "../env.test";
import { MockedJanusServer } from "../MockedJanusServer";

/* tslint:disable:no-unused-expression */
chai.use(chaiAsPromised);

describe("Tests for the connection handler for the communication with the JANUS-server", () => {
	// For the unit tests we need to mock a JANUS-server that sends back meaningful and
	// correct responses to incoming requests
	const mockedJANUSServer = new MockedJanusServer();
	const sdsConnection = new SDSConnection();

	before(async () => {
		// Init the mocked JANUS-server and connect with it to test operations of the PDClass
		await mockedJANUSServer.init();
		await sdsConnection.connect("test.node-sds.pdclass", HOST, PORT);
		await sdsConnection.PDClass.changeUser(TEST_USER, TEST_USER_PASS);
		await sdsConnection.PDClass.changePrincipal(TEST_PRINCIPAL);
	});

	it("should successfully execute a sync operation", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		return expect(pdObject.sync()).to.not.be.eventually.rejected;
	});
});

