import { expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { MockedJanusServer } from "./MockedJanusServer";

chai.use(chaiAsPromised);

// For the unit tests we need to mock a JANUS-server that sends back meaningful and
// correct responses to incoming requests

describe("Tests for the connection handler for the communication with the JANUS-server", async () => {
	const mockedJANUSServer = new MockedJanusServer();

	before(async () => {
		await mockedJANUSServer.init();
	});

	it("should connect successfully", () => {
		const sdsConnection = new SDSConnection();
		return expect(sdsConnection.connect("test123", "127.0.0.1", 11001)).to.not.be.eventually.rejected;
	});

	it("should fail to connect", () => {
		const sdsConnection = new SDSConnection();

		// on this port no server is running
		return expect(sdsConnection.connect("test123", "127.0.0.1", 11111)).to.be.eventually.rejectedWith("Unhandled error ocurred: The TCP-connection failed: connect ECONNREFUSED 127.0.0.1:11111");
	});

	it("should return a client id on connect", async () => {
		const sdsConnection = new SDSConnection();
		const clientId: number = await sdsConnection.connect("test123", "127.0.0.1", 11001);
		expect(clientId).to.be.a("number");
	});
});
