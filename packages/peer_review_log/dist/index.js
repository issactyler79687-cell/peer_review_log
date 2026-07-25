import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || Buffer;
}
export const networks = {
    testnet: {
        networkPassphrase: "Test SDF Network ; September 2015",
        contractId: "CA5J2DIS47ZNE27KQQ33QTV3GHM4QI3Q263Y2UBH3OYX7GPNPW5G4UVY",
    }
};
export const ContractError = {
    1: { message: "InvalidPaperId" },
    2: { message: "InvalidScore" },
    3: { message: "DuplicateReview" },
    4: { message: "ArithmeticOverflow" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy(null, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAQAAAAAAAAAAAAAABlJldmlldwAAAAAABQAAAAAAAAAMY29udGVudF9oYXNoAAAD7gAAACAAAAAAAAAACHBhcGVyX2lkAAAABgAAAAAAAAAJcmV2aWV3X2lkAAAAAAAABAAAAAAAAAAIcmV2aWV3ZXIAAAATAAAAAAAAAAVzY29yZQAAAAAAAAQ=",
            "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAEAAAAAAAAAA5JbnZhbGlkUGFwZXJJZAAAAAAAAQAAAAAAAAAMSW52YWxpZFNjb3JlAAAAAgAAAAAAAAAPRHVwbGljYXRlUmV2aWV3AAAAAAMAAAAAAAAAEkFyaXRobWV0aWNPdmVyZmxvdwAAAAAABA==",
            "AAAAAQAAAAAAAAAAAAAADVBhcGVyU25hcHNob3QAAAAAAAAEAAAAAAAAAA1hdmVyYWdlX3Njb3JlAAAAAAAABAAAAAAAAAAIcGFwZXJfaWQAAAAGAAAAAAAAAAxyZXZpZXdfY291bnQAAAAEAAAAAAAAAAlzY29yZV9zdW0AAAAAAAAE",
            "AAAABQAAAAAAAAAAAAAAD1Jldmlld1N1Ym1pdHRlZAAAAAABAAAAEHJldmlld19zdWJtaXR0ZWQAAAAFAAAAAAAAAAhwYXBlcl9pZAAAAAYAAAABAAAAAAAAAAhyZXZpZXdlcgAAABMAAAABAAAAAAAAAAlyZXZpZXdfaWQAAAAAAAAEAAAAAAAAAAAAAAAMY29udGVudF9oYXNoAAAD7gAAACAAAAAAAAAAAAAAAAVzY29yZQAAAAAAAAQAAAAAAAAAAg==",
            "AAAAAAAAAAAAAAAKZ2V0X3JldmlldwAAAAAAAQAAAAAAAAAJcmV2aWV3X2lkAAAAAAAABAAAAAEAAAPoAAAH0AAAAAZSZXZpZXcAAA==",
            "AAAAAAAAAAAAAAAMaGFzX3Jldmlld2VkAAAAAgAAAAAAAAAIcmV2aWV3ZXIAAAATAAAAAAAAAAhwYXBlcl9pZAAAAAYAAAABAAAAAQ==",
            "AAAAAAAAAAAAAAANc3VibWl0X3JldmlldwAAAAAAAAQAAAAAAAAACHJldmlld2VyAAAAEwAAAAAAAAAIcGFwZXJfaWQAAAAGAAAAAAAAAAxjb250ZW50X2hhc2gAAAPuAAAAIAAAAAAAAAAFc2NvcmUAAAAAAAAEAAAAAQAAA+kAAAAEAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
            "AAAAAAAAAAAAAAANdG90YWxfcmV2aWV3cwAAAAAAAAAAAAABAAAABA==",
            "AAAAAAAAAAAAAAAOcGFwZXJfc25hcHNob3QAAAAAAAEAAAAAAAAACHBhcGVyX2lkAAAABgAAAAEAAAfQAAAADVBhcGVyU25hcHNob3QAAAA="]), options);
        this.options = options;
    }
    fromJSON = {
        get_review: (this.txFromJSON),
        has_reviewed: (this.txFromJSON),
        submit_review: (this.txFromJSON),
        total_reviews: (this.txFromJSON),
        paper_snapshot: (this.txFromJSON)
    };
}
