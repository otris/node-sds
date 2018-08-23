import { expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { ADMIN_USER, ADMIN_USER_PASS, HOST, isLiveMode, PORT, TEST_PRINCIPAL } from "../env.test";
import { MockedJanusServer } from "../MockedJanusServer";

/* tslint:disable:no-unused-expression */
chai.use(chaiAsPromised);

describe("Tests for PDObject specific operations", () => {
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

	it("should successfully execute a sync operation", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		return expect(pdObject.sync()).to.not.be.eventually.rejected;
	});

	it("should set and get the attribute value of an object", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		await pdObject.setAttribute("Name", "1234");
		await pdObject.sync();

		// ensure that the attribute was set successfully
		return expect(pdObject.getAttribute("Name"))
			.to.eventually.equals(`1234`);
	});

	it("should fail when trying to set an unknown attribute", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		return expect(pdObject.setAttribute("notExistingAttribute", "1234"))
			.to.be.eventually.rejectedWith(Error)
			.and.have.property("message").which.matches(/Can't set attribute 'notExistingAttribute' to '1234'/);
	});

	(!isLiveMode()) ? it.skip : it("callOperationAsync no params", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		await pdObject.setAttribute("Name", "node-sds");
		await pdObject.setAttribute("SourceCode", `util.out("script 'node-sds' executed");`);
		await pdObject.sync();
		const ret = await pdObject.callOperationAsync("encryptScript");
		expect(ret).to.eq(undefined);
	});
	(!isLiveMode()) ? it.skip : it("callOperation sync no params", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		await pdObject.setAttribute("Name", "node-sds");
		await pdObject.setAttribute("SourceCode", `util.out("script 'node-sds' executed");`);
		await pdObject.sync();
		const ret = await pdObject.callOperation("encryptScript");
		expect(ret).to.eq(0);
	});
	(!isLiveMode()) ? it.skip : it("callOperationAsync with params", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		await pdObject.setAttribute("Name", "node-sds");
		await pdObject.setAttribute("SourceCode", `util.out("script 'node-sds' executed");`);
		await pdObject.sync();
		const ret = await pdObject.callOperationAsync("encryptScript", []);
		expect(ret).to.eq(undefined);
	});
	(!isLiveMode()) ? it.skip : it("callOperation sync with params", async () => {
		const pdObject = await sdsConnection.PDClass.newObject("PortalScript");
		await pdObject.setAttribute("Name", "node-sds");
		await pdObject.setAttribute("SourceCode", `util.out("script 'node-sds' executed");`);
		await pdObject.sync();
		const ret = await pdObject.callOperation("encryptScript", []);
		expect(ret).to.eq(0);
	});

	after(() => {
		sdsConnection.disconnect();
		mockedJANUSServer.close();
	});
});
